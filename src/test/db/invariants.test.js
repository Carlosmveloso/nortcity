// @vitest-environment node
//
// Testes das regras de negócio no banco: RLS, autorização, invariantes e
// concorrência. Rodam contra um Postgres real e descartável (ver harness.js),
// nunca contra o Supabase de produção.
import { beforeAll, describe, expect, it } from 'vitest';
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

beforeAll(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
}, 60_000);

async function submitAs(userId, { payload = {}, categories, primary = null } = {}) {
    await asUser(db, userId);
    const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], $3::uuid) as id', [
        JSON.stringify(businessPayload(payload)),
        categories ?? [cats.gastronomia],
        primary,
    ]);
    return rows[0].id;
}

async function approve(businessId) {
    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'approve')`, [businessId]);
}

describe('visibilidade pública (RLS)', () => {
    it('visitante não lê negócio pendente, rejeitado ou suspenso nem por requisição direta', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner);

        await asAnon(db);
        expect((await db.query('select id from public.businesses where id = $1', [id])).rows).toHaveLength(0);
        expect((await db.query('select * from public.business_categories where business_id = $1', [id])).rows).toHaveLength(0);

        await approve(id);
        await asAnon(db);
        expect((await db.query('select id from public.businesses where id = $1', [id])).rows).toHaveLength(1);

        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'suspend', 'business_closed')`, [id]);
        await asAnon(db);
        expect((await db.query('select id from public.businesses where id = $1', [id])).rows).toHaveLength(0);
    });

    it('localização privada não sai em consulta pública', async () => {
        const owner = await createUser(db);
        await asUser(db, owner);
        const { rows } = await db.query(
            `select public.submit_business($1::jsonb, $2::uuid[], null, 'Rua Particular, 45') as id`,
            [JSON.stringify(businessPayload({ address: null, service_area: 'Pitimbu e Acaú' })), [cats.servicos]]
        );
        const id = rows[0].id;
        await approve(id);

        await asAnon(db);
        // anon nem tem GRANT na tabela de localização privada.
        const message = await expectError(db.query('select * from public.business_private_locations'));
        expect(message).toMatch(/permission denied|permissão negada/i);

        // E o endereço público continua vazio: quem atende sem ponto fixo
        // aparece pela área de atendimento.
        const row = (await db.query('select address, service_area from public.businesses where id = $1', [id])).rows[0];
        expect(row.address).toBeNull();
        expect(row.service_area).toBe('Pitimbu e Acaú');

        await asUser(db, owner);
        expect((await db.query('select address from public.business_private_locations where business_id = $1', [id])).rows[0].address)
            .toBe('Rua Particular, 45');
    });

    it('usuário A não lê nem edita o negócio pendente de B, e manipular owner_id não dá acesso', async () => {
        const ownerA = await createUser(db);
        const ownerB = await createUser(db);
        const idB = await submitAs(ownerB);

        await asUser(db, ownerA);
        expect((await db.query('select id from public.businesses where id = $1', [idB])).rows).toHaveLength(0);

        expect(
            await expectError(db.query(`select public.update_own_business($1, '{"name":"Sequestrado"}'::jsonb)`, [idB]))
        ).toBe('forbidden');

        // Escrita direta em businesses não é mais possível nem para o próprio dono.
        expect(await expectError(db.query(`update public.businesses set owner_id = $1 where id = $2`, [ownerA, idB])))
            .toMatch(/permission denied|permissão negada/i);
    });
});

describe('um negócio por conta', () => {
    it('segunda submissão da mesma conta é recusada', async () => {
        const owner = await createUser(db);
        await submitAs(owner);
        expect(await expectError(submitAs(owner, { payload: { name: 'Outro Negócio' } })))
            .toBe('business_limit_reached');
    });

    it('duas submissões simultâneas da mesma conta não criam dois negócios', async () => {
        const owner = await createUser(db);
        await asUser(db, owner);

        const call = () =>
            db.query('select public.submit_business($1::jsonb, $2::uuid[], null) as id', [
                JSON.stringify(businessPayload({ name: 'Corrida Simultânea' })),
                [cats.gastronomia],
            ]);

        const results = await Promise.allSettled([call(), call()]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

        await asService(db);
        const { rows } = await db.query('select count(*)::int as total from public.businesses where owner_id = $1', [owner]);
        expect(rows[0].total).toBe(1);
    });

    it('vínculo manual preserva o original e não substitui proprietário existente', async () => {
        const owner = await createUser(db);
        const other = await createUser(db);

        await asUser(db, admin);
        const { rows } = await db.query(
            `select public.admin_create_business($1::jsonb, $2::uuid[], null, 'active') as id`,
            [JSON.stringify(businessPayload({ name: 'Peixaria do Cais' })), [cats.gastronomia]]
        );
        const original = rows[0].id;

        // Negócio criado pelo admin não pertence à conta do admin.
        await asService(db);
        expect((await db.query('select owner_id from public.businesses where id = $1', [original])).rows[0].owner_id).toBeNull();

        await asUser(db, admin);
        await db.query('select public.admin_link_business_owner($1, $2)', [original, owner]);

        // A conta vinculada agora está ocupada.
        expect(await expectError(submitAs(owner, { payload: { name: 'Mais um' } }))).toBe('business_limit_reached');

        // E o original não troca de dono.
        await asUser(db, admin);
        expect(await expectError(db.query('select public.admin_link_business_owner($1, $2)', [original, other])))
            .toBe('already_owned');
    });

    it('vínculo recusa conta que já possui negócio', async () => {
        const owner = await createUser(db);
        await submitAs(owner);

        await asUser(db, admin);
        const { rows } = await db.query(
            `select public.admin_create_business($1::jsonb, $2::uuid[], null, 'pending') as id`,
            [JSON.stringify(businessPayload({ name: 'Sem Dono' })), [cats.servicos]]
        );
        expect(await expectError(db.query('select public.admin_link_business_owner($1, $2)', [rows[0].id, owner])))
            .toBe('owner_has_business');
    });
});

describe('categorias', () => {
    it('zero ou quatro categorias não persistem', async () => {
        const owner = await createUser(db);
        expect(await expectError(submitAs(owner, { categories: [] }))).toBe('categories_required');
        expect(
            await expectError(
                submitAs(owner, {
                    categories: [cats.gastronomia, cats.hospedagem, cats.servicos, cats.passeios],
                    primary: cats.gastronomia,
                })
            )
        ).toBe('categories_too_many');
    });

    it('com mais de uma categoria exige primária explícita e dentro do conjunto', async () => {
        const owner = await createUser(db);
        expect(await expectError(submitAs(owner, { categories: [cats.gastronomia, cats.hospedagem] })))
            .toBe('primary_category_required');
        expect(
            await expectError(
                submitAs(owner, { categories: [cats.gastronomia, cats.hospedagem], primary: cats.passeios })
            )
        ).toBe('primary_category_invalid');
    });

    it('categoria única vira primária automaticamente', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner, { categories: [cats.hospedagem] });
        await asService(db);
        const { rows } = await db.query('select is_primary from public.business_categories where business_id = $1', [id]);
        expect(rows).toEqual([{ is_primary: true }]);
    });

    it('duas primárias não persistem e a troca de categorias é atômica', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner, { categories: [cats.gastronomia, cats.hospedagem], primary: cats.gastronomia });

        await asService(db);
        expect(
            await expectError(db.query('update public.business_categories set is_primary = true where business_id = $1', [id]))
        ).toBeTruthy();

        // Falha no meio da troca não deixa o negócio sem categoria.
        await asUser(db, owner);
        expect(
            await expectError(
                db.query('select public.update_own_business($1, $2::jsonb, $3::uuid[], null)', [
                    id,
                    JSON.stringify({}),
                    [cats.passeios, cats.servicos],
                ])
            )
        ).toBe('primary_category_required');

        await asService(db);
        const { rows } = await db.query(
            'select count(*)::int as total, count(*) filter (where is_primary)::int as primaries from public.business_categories where business_id = $1',
            [id]
        );
        expect(rows[0]).toEqual({ total: 2, primaries: 1 });
    });

    it('categoria nova do admin fica disponível na hora e categoria em uso não pode ser excluída', async () => {
        await asUser(db, admin);
        const { rows } = await db.query(
            `insert into public.categories (slug, name) values ('pesca', 'Pesca') returning id`
        );
        const pesca = rows[0].id;

        const owner = await createUser(db);
        const id = await submitAs(owner, { categories: [pesca] });
        expect(id).toBeTruthy();

        await asUser(db, admin);
        expect(await expectError(db.query('delete from public.categories where id = $1', [pesca])))
            .toMatch(/foreign key|chave estrangeira/i);
    });
});

describe('dados mínimos e aprovação', () => {
    it('serviço elegível sem endereço público pode ser cadastrado e aprovado', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner, {
            payload: {
                name: 'Marcos Eletricista',
                address: null,
                neighborhood: null,
                service_area: 'Pitimbu, Acaú e Praia dos Mariscos',
                phone: null,
                whatsapp: '(83) 98888-1234',
            },
            categories: [cats.servicos],
        });
        await approve(id);

        await asAnon(db);
        expect((await db.query('select status from public.businesses where id = $1', [id])).rows[0].status).toBe('active');
    });

    it('cadastro sem contato válido é recusado', async () => {
        const owner = await createUser(db);
        expect(
            await expectError(submitAs(owner, { payload: { phone: null, whatsapp: null, email: null, instagram: null, website: null } }))
        ).toBe('contact_required');

        // Telefone que não é telefone não conta como contato válido.
        expect(await expectError(submitAs(owner, { payload: { phone: 'liga lá' } }))).toBe('contact_required');
    });

    // Descrição voltou a ser opcional em 07/09/2026: quem tem o que dizer
    // escreve, e o teto de 1500 é o único contrato que sobrou.
    it('descrição é opcional, mas não passa de 1500 caracteres', async () => {
        const owner = await createUser(db);
        await submitAs(owner, { payload: { description: null } });

        const outro = await createUser(db);
        await submitAs(outro, { payload: { description: 'Bom demais' } });

        const terceiro = await createUser(db);
        expect(await expectError(submitAs(terceiro, { payload: { description: 'a'.repeat(1501) } }))).toBe('description_too_long');
    });
    // Cadastro novo é o caminho que mais esconde bug: dado que já existe não
    // exercita coluna obrigatória nem RPC de criação (lição do slug, 03/09).
    it('cadastro novo sem descrição entra, é aprovado e fica público', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner, { payload: { description: null } });

        await approve(id);

        await asAnon(db);
        const { rows } = await db.query(
            'select status, description, slug from public.businesses where id = $1',
            [id]
        );
        expect(rows[0].status).toBe('active');
        expect(rows[0].description).toBeNull();
        expect(rows[0].slug).toBeTruthy();
    });

    it('admin publica direto um cadastro sem descrição', async () => {
        await asUser(db, admin);
        const { rows } = await db.query(
            `select public.admin_create_business($1::jsonb, $2::uuid[], null, 'active') as id`,
            [JSON.stringify(businessPayload({ description: null })), [cats.gastronomia]]
        );

        await asAnon(db);
        const publicado = await db.query('select status, description from public.businesses where id = $1', [rows[0].id]);
        expect(publicado.rows[0].status).toBe('active');
        expect(publicado.rows[0].description).toBeNull();
    });
});

describe('moderação', () => {
    it('rejeição e suspensão exigem motivo; aprovação não', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner);

        await asUser(db, admin);
        expect(await expectError(db.query(`select public.moderate_business($1, 'reject')`, [id]))).toBe('reason_required');

        await db.query(`select public.moderate_business($1, 'reject', 'insufficient_information', 'Faltou o endereço')`, [id]);
        await asService(db);
        const row = (await db.query('select status, moderation_reason, moderated_by, moderated_at from public.businesses where id = $1', [id])).rows[0];
        expect(row.status).toBe('rejected');
        expect(row.moderation_reason).toBe('insufficient_information');
        expect(row.moderated_by).toBe(admin);
        expect(row.moderated_at).toBeTruthy();
    });

    it('rejeitado corrigido volta para pending e o dono não se aprova', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner);
        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'reject', 'invalid_contact')`, [id]);

        await asUser(db, owner);
        expect(await expectError(db.query(`select public.moderate_business($1, 'approve')`, [id]))).toBe('forbidden');

        await db.query(`select public.update_own_business($1, $2::jsonb)`, [id, JSON.stringify({ phone: '(83) 99111-2222' })]);
        await db.query('select public.resubmit_business($1)', [id]);

        await asService(db);
        const row = (await db.query('select status, moderation_reason from public.businesses where id = $1', [id])).rows[0];
        expect(row.status).toBe('pending');
        expect(row.moderation_reason).toBeNull();
    });

    it('dono não reativa negócio suspenso', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner);
        await approve(id);
        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'suspend', 'suspected_fraud')`, [id]);

        await asUser(db, owner);
        expect(await expectError(db.query(`select public.moderate_business($1, 'reactivate')`, [id]))).toBe('forbidden');
        expect(await expectError(db.query(`select public.update_own_business($1, '{"phone":"(83) 90000-0000"}'::jsonb)`, [id])))
            .toBe('status_not_editable');

        // Mas continua conseguindo consultar o próprio registro e o motivo.
        const { rows } = await db.query('select status, moderation_reason from public.businesses where id = $1', [id]);
        expect(rows[0]).toEqual({ status: 'suspended', moderation_reason: 'suspected_fraud' });
    });

    it('transições inválidas são recusadas', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner);
        await asUser(db, admin);
        expect(await expectError(db.query(`select public.moderate_business($1, 'suspend', 'other')`, [id])))
            .toBe('invalid_transition');
    });
});

describe('slug e duplicidade', () => {
    it('nomes iguais legítimos coexistem com slugs únicos e legíveis', async () => {
        const a = await createUser(db);
        const b = await createUser(db);
        const idA = await submitAs(a, { payload: { name: 'Bar do Zé', phone: '(83) 91111-1111' } });
        const idB = await submitAs(b, { payload: { name: 'Bar do Zé', phone: '(83) 92222-2222', address: 'Outra rua, 9' } });

        await asService(db);
        const { rows } = await db.query('select id, slug from public.businesses where id = any($1::uuid[]) order by slug', [[idA, idB]]);
        expect(rows.map((r) => r.slug)).toEqual(['bar-do-ze', 'bar-do-ze-2']);
    });

    it('suspeita de duplicidade é sinalizada sem bloquear o cadastro', async () => {
        const a = await createUser(db);
        const b = await createUser(db);
        await submitAs(a, { payload: { name: 'Sorveteria Maré', phone: '(83) 93333-3333' } });
        const idB = await submitAs(b, { payload: { name: 'Sorveteria Maré', phone: '(83) 93333-3333' } });

        await asService(db);
        const { rows } = await db.query('select status, duplicate_candidates from public.businesses where id = $1', [idB]);
        expect(rows[0].status).toBe('pending');
        expect(rows[0].duplicate_candidates).toHaveLength(1);
        expect(rows[0].duplicate_candidates[0].name).toBe('Sorveteria Maré');
    });

    it('resolução administrativa de duplicata preserva o original e respeita um negócio por conta', async () => {
        await asUser(db, admin);
        const { rows: originalRows } = await db.query(
            `select public.admin_create_business($1::jsonb, $2::uuid[], null, 'active') as id`,
            [JSON.stringify(businessPayload({ name: 'Restaurante Maré Alta', phone: '(83) 94444-4444' })), [cats.gastronomia]]
        );
        const original = originalRows[0].id;

        const owner = await createUser(db);
        const duplicate = await submitAs(owner, {
            payload: { name: 'Restaurante Maré Alta', phone: '(83) 94444-4444' },
        });

        await asUser(db, admin);
        await db.query('select public.admin_resolve_duplicate($1, $2)', [original, duplicate]);

        await asService(db);
        expect((await db.query('select owner_id, status from public.businesses where id = $1', [original])).rows[0])
            .toMatchObject({ owner_id: owner, status: 'active' });
        expect((await db.query('select id from public.businesses where id = $1', [duplicate])).rows).toHaveLength(0);
        expect((await db.query('select count(*)::int as total from public.businesses where owner_id = $1', [owner])).rows[0].total).toBe(1);
    });

    it('duplicata publicada não é apagada por semelhança', async () => {
        const owner = await createUser(db);
        const duplicate = await submitAs(owner, { payload: { name: 'Quiosque do Sol' } });
        await approve(duplicate);

        await asUser(db, admin);
        const { rows } = await db.query(
            `select public.admin_create_business($1::jsonb, $2::uuid[], null, 'active') as id`,
            [JSON.stringify(businessPayload({ name: 'Quiosque do Sol' })), [cats.gastronomia]]
        );
        expect(await expectError(db.query('select public.admin_resolve_duplicate($1, $2)', [rows[0].id, duplicate])))
            .toBe('duplicate_is_active');
    });
});

describe('storage das imagens', () => {
    async function upload(userId, path) {
        await asUser(db, userId);
        return db.query(`insert into storage.objects (bucket_id, name) values ('business-photos', $1)`, [path]);
    }

    it('dono envia a capa enquanto o cadastro está pendente; terceiro não envia nada', async () => {
        const owner = await createUser(db);
        const intruder = await createUser(db);
        const id = await submitAs(owner);

        await expect(upload(owner, `${id}/cover.webp`)).resolves.toBeTruthy();
        expect(await expectError(upload(intruder, `${id}/outra.webp`)))
            .toMatch(/row-level security|violates row-level/i);
    });

    it('com o negócio publicado, a capa aprovada não é sobrescrita direto: o upload vai para review/', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner);
        await approve(id);

        expect(await expectError(upload(owner, `${id}/cover.webp`))).toMatch(/row-level security|violates row-level/i);
        await expect(upload(owner, `${id}/review/proposta.webp`)).resolves.toBeTruthy();
    });

    it('mídia em revisão não é legível pelo público', async () => {
        const owner = await createUser(db);
        const id = await submitAs(owner);
        await approve(id);
        await upload(owner, `${id}/review/proposta.webp`);

        await asService(db);
        await db.query(`insert into storage.objects (bucket_id, name) values ('business-photos', $1)`, [`${id}/cover.webp`]);

        await asAnon(db);
        const visible = await db.query(`select name from storage.objects where bucket_id = 'business-photos' and name like $1`, [`${id}/%`]);
        expect(visible.rows.map((r) => r.name)).toEqual([`${id}/cover.webp`]);

        await asUser(db, owner);
        const asOwner = await db.query(`select name from storage.objects where bucket_id = 'business-photos' and name like $1`, [`${id}/%`]);
        expect(asOwner.rows).toHaveLength(2);

        await asUser(db, admin);
        const asAdmin = await db.query(`select name from storage.objects where bucket_id = 'business-photos' and name like $1`, [`${id}/%`]);
        expect(asAdmin.rows).toHaveLength(2);
    });
});

describe('compatibilidade com cadastros legados', () => {
    // Diagnóstico do acervo real em 06/09/2026: dos 78 negócios publicados, 53
    // têm descrição com menos de 40 caracteres e 30 não têm endereço nem
    // bairro. Nenhum está sem contato válido.
    async function legacyActiveBusiness(description, address = 'Reserva do Abiaí') {
        await asService(db);
        const { rows } = await db.query(
            `insert into public.businesses (slug, name, description, address, phone, status)
             values ('legado-' || substr(gen_random_uuid()::text, 1, 8), 'Resort Legado', $1,
                     $2, '(83) 3041-8645', 'active')
             returning id`,
            [description, address]
        );
        const id = rows[0].id;
        await db.query(
            `insert into public.business_categories (business_id, category_id, is_primary) values ($1, $2, true)`,
            [id, cats.hospedagem]
        );
        return id;
    }

    it('admin corrige telefone de cadastro antigo sem precisar reescrever a descrição curta', async () => {
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.');

        await asUser(db, admin);
        await db.query(`select public.admin_update_business($1, '{"phone":"(83) 3041-0000"}'::jsonb)`, [id]);

        await asService(db);
        expect((await db.query('select phone from public.businesses where id = $1', [id])).rows[0].phone)
            .toBe('(83) 3041-0000');
    });

    it('e uma descrição nova curta também passa: o mínimo deixou de existir', async () => {
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.');

        await asUser(db, admin);
        await db.query(`select public.admin_update_business($1, '{"description":"Curta"}'::jsonb)`, [id]);

        await asService(db);
        expect((await db.query('select description from public.businesses where id = $1', [id])).rows[0].description)
            .toBe('Curta');
    });

    it('mas o teto de 1500 caracteres continua valendo', async () => {
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.');

        await asUser(db, admin);
        expect(
            await expectError(
                db.query('select public.admin_update_business($1, jsonb_build_object($2::text, repeat($3::text, 1501)))', [
                    id,
                    'description',
                    'a',
                ])
            )
        ).toBe('description_too_long');
    });

    it('reativar cadastro antigo não reabre o contrato de descrição', async () => {
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.');

        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'suspend', 'business_closed')`, [id]);
        await db.query(`select public.moderate_business($1, 'reactivate')`, [id]);

        await asService(db);
        expect((await db.query('select status from public.businesses where id = $1', [id])).rows[0].status).toBe('active');
    });

    it('admin corrige cadastro antigo sem endereço nem bairro', async () => {
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.', null);

        await asUser(db, admin);
        await db.query(`select public.admin_update_business($1, '{"instagram":"resortlegado"}'::jsonb)`, [id]);

        await asService(db);
        expect((await db.query('select instagram from public.businesses where id = $1', [id])).rows[0].instagram)
            .toBe('resortlegado');
    });

    it('mas nenhuma edição pode deixar o negócio sem contato público válido', async () => {
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.', null);

        await asUser(db, admin);
        expect(await expectError(db.query(`select public.admin_update_business($1, '{"phone":null}'::jsonb)`, [id])))
            .toBe('contact_required');
    });

    it('dono troca o telefone de cadastro antigo sem endereço, mas não o apaga', async () => {
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.', null);
        const owner = await createUser(db);

        await asUser(db, admin);
        await db.query('select public.admin_link_business_owner($1, $2)', [id, owner]);

        await asUser(db, owner);
        await db.query(`select public.update_own_active_business($1, '{"phone":"(83) 3041-1111"}'::jsonb)`, [id]);
        expect(
            await expectError(db.query(`select public.update_own_active_business($1, '{"phone":null}'::jsonb)`, [id]))
        ).toBe('contact_required');

        await asService(db);
        expect((await db.query('select phone from public.businesses where id = $1', [id])).rows[0].phone)
            .toBe('(83) 3041-1111');
    });

    it('escrita direta em businesses continua bloqueada mesmo para admin autenticado', async () => {
        // Admin passa pelas RPCs; o PostgREST não tem GRANT de escrita para
        // ninguém, então nenhum PATCH montado à mão contorna as invariantes.
        const id = await legacyActiveBusiness('Resort à beira-mar na Reserva do Abiaí.');
        await asUser(db, admin);
        expect(await expectError(db.query(`update public.businesses set status = 'suspended' where id = $1`, [id])))
            .toMatch(/permission denied|permissão negada/i);
    });
});
