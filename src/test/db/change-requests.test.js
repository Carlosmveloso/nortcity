// @vitest-environment node
//
// Fase 4 — edição de negócio ativo: simples imediato, sensível por proposta.
import { beforeEach, describe, expect, it } from 'vitest';
import {
    asAnon,
    asService,
    asUser,
    businessPayload,
    createTestDb,
    createUser,
    expectError,
    seedCategories,
} from './harness';

let db;
let cats;
let admin;
let owner;
let businessId;

beforeEach(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
    owner = await createUser(db);

    await asUser(db, owner);
    const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], null) as id', [
        JSON.stringify(businessPayload()),
        [cats.gastronomia],
    ]);
    businessId = rows[0].id;

    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'approve')`, [businessId]);
}, 60_000);

async function publicRow() {
    await asAnon(db);
    const { rows } = await db.query(
        'select name, description, address, phone, cover_image from public.businesses where id = $1',
        [businessId]
    );
    return rows[0];
}

async function request(args) {
    await asUser(db, owner);
    const { rows } = await db.query(
        'select public.request_business_changes($1, $2::jsonb, $3::uuid[], $4::uuid, $5) as id',
        [businessId, JSON.stringify(args.changes ?? {}), args.categories ?? null, args.primary ?? null, args.coverPath ?? null]
    );
    return rows[0].id;
}

describe('alteração simples', () => {
    it('telefone é publicado na hora', async () => {
        await asUser(db, owner);
        await db.query(`select public.update_own_active_business($1, '{"phone":"(83) 98888-7777"}'::jsonb)`, [businessId]);
        expect((await publicRow()).phone).toBe('(83) 98888-7777');
    });

    it('não pode remover o último contato público válido', async () => {
        await asUser(db, owner);
        expect(await expectError(db.query(`select public.update_own_active_business($1, '{"phone":null}'::jsonb)`, [businessId])))
            .toBe('contact_required');
    });

    it('campo fora da matriz do plano não passa como alteração simples', async () => {
        await asUser(db, owner);
        expect(
            await expectError(db.query(`select public.update_own_active_business($1, '{"name":"Novo Nome"}'::jsonb)`, [businessId]))
        ).toBe('field_not_editable');
        expect(
            await expectError(db.query(`select public.update_own_active_business($1, '{"website":"site.com"}'::jsonb)`, [businessId]))
        ).toBe('field_not_editable');
    });
});

describe('proposta de alteração sensível', () => {
    it('não muda o conteúdo público enquanto aguarda análise', async () => {
        await request({ changes: { name: 'Pousada Beira Mar Premium', description: 'Descrição nova, com pelo menos quarenta caracteres.' } });
        const row = await publicRow();
        expect(row.name).toBe('Pousada Beira Mar');
        expect(row.description).toBe(businessPayload().description);
    });

    it('o negócio continua ativo e público durante a revisão', async () => {
        await request({ changes: { name: 'Outro Nome' } });
        await asAnon(db);
        const { rows } = await db.query('select status from public.businesses where id = $1', [businessId]);
        expect(rows[0].status).toBe('active');
    });

    it('só existe uma proposta aberta por vez', async () => {
        await request({ changes: { name: 'Primeira Proposta' } });
        expect(await expectError(request({ changes: { name: 'Segunda Proposta' } }))).toBe('request_already_open');
    });

    it('proposta que quebraria o cadastro é recusada na origem', async () => {
        expect(await expectError(request({ changes: { description: 'a'.repeat(1501) } }))).toBe('description_too_long');
        expect(await expectError(request({ changes: { name: '' } }))).toBe('name_required');
    });

    it('descrição curta é proposta válida: o mínimo deixou de existir', async () => {
        await request({ changes: { description: 'curta' } });
    });

    it('campo fora da matriz não vira proposta', async () => {
        expect(await expectError(request({ changes: { whatsapp: '(83) 90000-0000' } }))).toBe('field_not_editable');
    });

    it('visitante não lê propostas', async () => {
        await request({ changes: { name: 'Nome Proposto' } });
        await asAnon(db);
        expect(await expectError(db.query('select * from public.business_change_requests')))
            .toMatch(/permission denied|permissão negada/i);

        const outro = await createUser(db);
        await asUser(db, outro);
        expect((await db.query('select * from public.business_change_requests')).rows).toHaveLength(0);
    });
});

describe('revisão da proposta', () => {
    it('recusa preserva a versão anterior', async () => {
        const id = await request({ changes: { name: 'Nome Recusado' } });
        await asUser(db, admin);
        await db.query(`select public.review_business_change_request($1, 'reject', 'Nome não confere com a fachada')`, [id]);

        expect((await publicRow()).name).toBe('Pousada Beira Mar');
        await asService(db);
        expect((await db.query('select status from public.business_change_requests where id = $1', [id])).rows[0].status)
            .toBe('rejected');
    });

    it('aprovação aplica só os campos revisados e não perde a edição simples posterior', async () => {
        const id = await request({ changes: { name: 'Pousada Beira Mar II' } });

        // Dono troca o telefone (alteração simples) depois de enviar a proposta.
        await asUser(db, owner);
        await db.query(`select public.update_own_active_business($1, '{"phone":"(83) 97777-6666"}'::jsonb)`, [businessId]);

        await asUser(db, admin);
        await db.query(`select public.review_business_change_request($1, 'approve')`, [id]);

        const row = await publicRow();
        expect(row.name).toBe('Pousada Beira Mar II');
        expect(row.phone).toBe('(83) 97777-6666');
    });

    it('conflito: campo proposto mudou por ação administrativa durante a revisão', async () => {
        const id = await request({ changes: { name: 'Nome Proposto' } });

        await asUser(db, admin);
        await db.query(`select public.admin_update_business($1, '{"name":"Nome Corrigido pelo Admin"}'::jsonb)`, [businessId]);

        expect(await expectError(db.query(`select public.review_business_change_request($1, 'approve')`, [id])))
            .toBe('base_changed');
        expect((await publicRow()).name).toBe('Nome Corrigido pelo Admin');
    });

    it('suspensão durante a revisão impede a aplicação da proposta', async () => {
        const id = await request({ changes: { name: 'Nome Proposto' } });

        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'suspend', 'suspected_fraud')`, [businessId]);

        expect(await expectError(db.query(`select public.review_business_change_request($1, 'approve')`, [id])))
            .toBe('business_not_active');

        await asService(db);
        expect((await db.query('select status from public.businesses where id = $1', [businessId])).rows[0].status)
            .toBe('suspended');
    });

    it('capa proposta não substitui a aprovada antes da decisão', async () => {
        await asUser(db, admin);
        await db.query(`select public.admin_update_business($1, '{"cover_image":"https://cdn/aprovada.webp"}'::jsonb)`, [businessId]);

        const id = await request({ coverPath: `${businessId}/review/nova.webp` });
        expect((await publicRow()).cover_image).toBe('https://cdn/aprovada.webp');

        await asUser(db, admin);
        // Aprovar sem publicar o arquivo não passa.
        expect(await expectError(db.query(`select public.review_business_change_request($1, 'approve')`, [id])))
            .toBe('cover_url_required');

        await db.query(`select public.review_business_change_request($1, 'approve', null, 'https://cdn/nova.webp')`, [id]);
        expect((await publicRow()).cover_image).toBe('https://cdn/nova.webp');
    });

    it('proposta de categorias é atômica e respeita a primária', async () => {
        const id = await request({ categories: [cats.gastronomia, cats.passeios], primary: cats.passeios });
        await asUser(db, admin);
        await db.query(`select public.review_business_change_request($1, 'approve')`, [id]);

        await asService(db);
        const { rows } = await db.query(
            `select c.slug, bc.is_primary from public.business_categories bc
               join public.categories c on c.id = bc.category_id
              where bc.business_id = $1 order by c.slug`,
            [businessId]
        );
        expect(rows).toEqual([
            { slug: 'gastronomia', is_primary: false },
            { slug: 'passeios', is_primary: true },
        ]);
    });

    it('dono não aprova a própria proposta', async () => {
        const id = await request({ changes: { name: 'Auto Aprovada' } });
        await asUser(db, owner);
        expect(await expectError(db.query(`select public.review_business_change_request($1, 'approve')`, [id])))
            .toBe('forbidden');
    });

    it('dono pode cancelar a própria proposta e enviar outra', async () => {
        const id = await request({ changes: { name: 'Vai Ser Cancelada' } });
        await asUser(db, owner);
        await db.query('select public.cancel_business_change_request($1)', [id]);
        const next = await request({ changes: { name: 'Nova Proposta' } });
        expect(next).toBeTruthy();
    });
});
