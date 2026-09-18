// @vitest-environment node
//
// A prévia de compartilhamento é gerada no build (dist/negocio/<slug>.html e
// dist/og/<slug>.jpg). Negócio aprovado depois do deploy não tinha nenhum dos
// dois e o WhatsApp mostrava a imagem genérica da home — o bug que a migration
// 20260918000001 corrige, fazendo o banco pedir o rebuild sozinho.
//
// O que se testa aqui é a seletividade e a coalescência. Marcar demais custa um
// build a cada telefone corrigido; marcar de menos devolve o bug original. E o
// disparo tem de juntar a rajada sem descartar a última alteração dela.
import { beforeAll, describe, expect, it } from 'vitest';
import { asService, asUser, businessPayload, createTestDb, createUser, seedCategories } from './harness';

let db;
let cats;
let admin;

beforeAll(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
}, 60_000);

let sufixo = 0;

async function negocioPublicado(overrides = {}) {
    sufixo += 1;
    const owner = await createUser(db);
    await asUser(db, owner);
    const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], $3::uuid) as id', [
        JSON.stringify(businessPayload({ name: `Pousada Farol ${sufixo}`, ...overrides })),
        [cats.gastronomia],
        null,
    ]);
    const id = rows[0].id;
    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'approve')`, [id]);
    return id;
}

async function adminEdita(id, payload, categorias = null) {
    await asUser(db, admin);
    await db.query('select public.admin_update_business($1, $2::jsonb, $3::uuid[])', [
        id,
        JSON.stringify(payload),
        categorias,
    ]);
}

/** Zera o estado para o teste medir só o que ele mesmo provocar. */
async function zerar() {
    await asService(db);
    await db.query('update public.site_rebuild set requested_seq = 0, fired_seq = 0');
    await db.query('delete from net._sent');
}

async function pendente() {
    await asService(db);
    const { rows } = await db.query('select requested_seq > fired_seq as pendente from public.site_rebuild');
    return rows[0].pendente;
}

async function varrer() {
    await asService(db);
    const { rows } = await db.query('select public.fire_site_rebuild() as disparou');
    return rows[0].disparou;
}

async function disparos() {
    await asService(db);
    const { rows } = await db.query('select url from net._sent order by id');
    return rows.map((row) => row.url);
}

async function segredo(url) {
    await asService(db);
    await db.query(`delete from vault.decrypted_secrets where name = 'vercel_deploy_hook'`);
    if (url) {
        await db.query(
            `insert into vault.decrypted_secrets (name, decrypted_secret) values ('vercel_deploy_hook', $1)`,
            [url]
        );
    }
}

describe('o que marca o site como pendente de republicação', () => {
    it('aprovar um negócio marca; cadastrá-lo, não', async () => {
        sufixo += 1;
        const owner = await createUser(db);
        await asUser(db, owner);
        const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], $3::uuid) as id', [
            JSON.stringify(businessPayload({ name: `Pousada Farol ${sufixo}` })),
            [cats.gastronomia],
            null,
        ]);

        // Cadastro entra pendente: não está no ar, não há prévia a gerar.
        await zerar();
        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'approve')`, [rows[0].id]);

        expect(await pendente()).toBe(true);
    });

    it('trocar a capa de negócio publicado marca', async () => {
        const id = await negocioPublicado();
        await zerar();

        await adminEdita(id, { cover_image: 'https://exemplo.test/capa-nova.jpg' });

        expect(await pendente()).toBe(true);
    });

    it('corrigir o telefone de negócio publicado NÃO marca', async () => {
        // O teste que impede a regressão oposta: sem esta condição, toda
        // correção de contato nos 85 cadastros custaria um build.
        const id = await negocioPublicado();
        await zerar();

        await adminEdita(id, { phone: '(83) 98888-1234' });

        expect(await pendente()).toBe(false);
    });

    it('editar negócio pendente não marca', async () => {
        sufixo += 1;
        const owner = await createUser(db);
        await asUser(db, owner);
        const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], $3::uuid) as id', [
            JSON.stringify(businessPayload({ name: `Pousada Farol ${sufixo}` })),
            [cats.gastronomia],
            null,
        ]);
        await zerar();

        await adminEdita(rows[0].id, { name: 'Outro Nome', cover_image: 'https://exemplo.test/x.jpg' });

        expect(await pendente()).toBe(false);
    });

    it('suspender um negócio marca: a ficha precisa sair do ar', async () => {
        const id = await negocioPublicado();
        await zerar();

        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'suspend', 'business_closed')`, [id]);

        expect(await pendente()).toBe(true);
    });

    it('apagar um negócio publicado marca', async () => {
        const id = await negocioPublicado();
        await zerar();

        await asUser(db, admin);
        await db.query('select public.admin_delete_business($1)', [id]);

        expect(await pendente()).toBe(true);
    });

    it('trocar a categoria marca: ela entra na og:description', async () => {
        const id = await negocioPublicado();
        await zerar();

        await adminEdita(id, {}, [cats.hospedagem]);

        expect(await pendente()).toBe(true);
    });
});

describe('disparo do deploy hook', () => {
    it('sem o segredo no Vault não sai chamada nem erro, e o pedido não se perde', async () => {
        await segredo(null);
        const id = await negocioPublicado();
        await zerar();
        await adminEdita(id, { cover_image: 'https://exemplo.test/a.jpg' });

        expect(await varrer()).toBe(false);
        expect(await disparos()).toEqual([]);
        // Continua pendente: criar o segredo depois publica o que ficou para trás.
        expect(await pendente()).toBe(true);
    });

    it('com o segredo, dispara uma vez e sai do estado pendente', async () => {
        await segredo('https://api.vercel.test/deploy/abc');
        const id = await negocioPublicado();
        await zerar();
        await adminEdita(id, { cover_image: 'https://exemplo.test/b.jpg' });

        expect(await varrer()).toBe(true);
        expect(await disparos()).toEqual(['https://api.vercel.test/deploy/abc']);
        expect(await pendente()).toBe(false);
    });

    it('varrer sem nada pendente não dispara', async () => {
        await segredo('https://api.vercel.test/deploy/abc');
        await zerar();

        expect(await varrer()).toBe(false);
        expect(await disparos()).toEqual([]);
    });

    it('rajada de alterações vira um build só', async () => {
        await segredo('https://api.vercel.test/deploy/abc');
        const um = await negocioPublicado();
        const dois = await negocioPublicado();
        await zerar();

        await adminEdita(um, { cover_image: 'https://exemplo.test/c.jpg' });
        await adminEdita(dois, { name: 'Nome Novo' });
        await adminEdita(um, { description: 'Descrição nova, com folga de caracteres para passar no mínimo.' });

        expect(await varrer()).toBe(true);
        expect(await disparos()).toHaveLength(1);
        expect(await varrer()).toBe(false);
    });

    // Este é o teste que reprovou a primeira versão da migration, que decidia
    // por `requested_at > fired_at`: marcação e disparo caíram no mesmo
    // milissegundo e a segunda alteração foi descartada sem ninguém reclamar.
    // Por isso a decisão é por contador — não apague este caso.
    it('alteração feita depois do disparo sai no disparo seguinte', async () => {
        await segredo('https://api.vercel.test/deploy/abc');
        const id = await negocioPublicado();
        await zerar();

        await adminEdita(id, { cover_image: 'https://exemplo.test/d.jpg' });
        expect(await varrer()).toBe(true);

        await adminEdita(id, { cover_image: 'https://exemplo.test/e.jpg' });
        expect(await varrer()).toBe(true);
        expect(await disparos()).toHaveLength(2);
    });
});
