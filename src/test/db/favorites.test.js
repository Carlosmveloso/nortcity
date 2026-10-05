// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

let db, admin, alice, bob, active, hidden;
const insert = (userId, businessId) =>
    db.query('insert into public.business_favorites (user_id, business_id) values ($1, $2)', [
        userId,
        businessId,
    ]);

beforeAll(async () => {
    db = await createTestDb();
    const cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
    alice = await createUser(db);
    bob = await createUser(db);
    await asUser(db, admin);
    for (const status of ['active', 'pending']) {
        const { rows } = await db.query(
            'select public.admin_create_business($1::jsonb, $2::uuid[], null, $3::business_status) as id',
            [
                JSON.stringify(businessPayload({ name: `Favorito ${status}` })),
                [cats.gastronomia],
                status,
            ],
        );
        if (status === 'active') active = rows[0].id;
        else hidden = rows[0].id;
    }
}, 60_000);
afterAll(async () => {
    await db?.close();
});

describe('favoritos privados por conta', () => {
    it('visitante não lê nem escreve a tabela', async () => {
        await asAnon(db);
        expect(await expectError(db.query('select * from public.business_favorites'))).toContain(
            'permission denied',
        );
        expect(await expectError(insert(alice, active))).toContain('permission denied');
        expect(
            await expectError(
                db.query('delete from public.business_favorites where business_id = $1', [active]),
            ),
        ).toContain('permission denied');
    });
    it('salva apenas para a própria conta e só negócios ativos', async () => {
        await asUser(db, alice);
        expect(await expectError(insert(bob, active))).toContain('row-level security');
        expect(await expectError(insert(alice, hidden))).toContain('row-level security');
        await insert(alice, active);
        expect((await db.query('select business_id from public.business_favorites')).rows).toEqual([
            { business_id: active },
        ]);
    });
    it('duas solicitações concorrentes não duplicam a relação', async () => {
        await asUser(db, bob);
        const results = await Promise.allSettled([insert(bob, active), insert(bob, active)]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((r) => r.status === 'rejected')[0].reason.code).toBe('23505');
    });
    it('outra conta e admin não leem nem removem favoritos alheios', async () => {
        await asUser(db, bob);
        expect((await db.query('select user_id from public.business_favorites')).rows).toEqual([
            { user_id: bob },
        ]);
        expect(
            (
                await db.query(
                    'delete from public.business_favorites where user_id = $1 returning *',
                    [alice],
                )
            ).rows,
        ).toEqual([]);
        await asUser(db, admin);
        expect((await db.query('select * from public.business_favorites')).rows).toEqual([]);
        expect(
            (
                await db.query(
                    'delete from public.business_favorites where user_id = $1 returning *',
                    [alice],
                )
            ).rows,
        ).toEqual([]);
    });
    it('não permite UPDATE ou adulteração de um vínculo', async () => {
        await asUser(db, alice);
        expect(
            await expectError(
                db.query('update public.business_favorites set user_id = $1 where user_id = $2', [
                    bob,
                    alice,
                ]),
            ),
        ).toContain('permission denied');
    });
    it('negócio suspenso some do catálogo, mas permite remover o vínculo', async () => {
        await asUser(db, admin);
        await db.query("select public.moderate_business($1, 'suspend', 'business_closed', null)", [
            active,
        ]);
        await asUser(db, alice);
        expect(
            (
                await db.query(
                    "select b.id from public.business_favorites f join public.businesses b on b.id = f.business_id where b.status = 'active'",
                )
            ).rows,
        ).toEqual([]);
        expect(await expectError(insert(alice, active))).toContain('row-level security');
        expect(
            (
                await db.query(
                    'delete from public.business_favorites where business_id = $1 returning business_id',
                    [active],
                )
            ).rows,
        ).toEqual([{ business_id: active }]);
    });
    it('excluir conta apaga seus vínculos por cascata', async () => {
        await asService(db);
        await db.query('delete from auth.users where id = $1', [bob]);
        expect(
            (await db.query('select * from public.business_favorites where user_id = $1', [bob]))
                .rows,
        ).toEqual([]);
    });
    it('excluir negócio apaga seus vínculos por cascata', async () => {
        await asService(db);
        await insert(alice, active);
        await db.query('delete from public.businesses where id = $1', [active]);
        expect(
            (
                await db.query('select * from public.business_favorites where business_id = $1', [
                    active,
                ])
            ).rows,
        ).toEqual([]);
    });
});
