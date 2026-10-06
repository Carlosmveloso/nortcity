// @vitest-environment node
//
// Job offer-lifecycle (migration 20261006000001): encerra vencidas antes de
// ativar as agendadas, respeitando o limite do plano e o fuso de Pitimbu.
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

const DAY = 24 * 60 * 60 * 1000;
let db, cats, admin;
let counter = 0;

/** Data (YYYY-MM-DD) em UTC−3, deslocada em dias a partir de hoje. */
function localDay(offsetDays) {
    return new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetDays * DAY).toISOString().slice(0, 10);
}
// Mesmos instantes que o frontend grava: dia inteiro no horário de Pitimbu.
const startOf = (day) => `${day}T00:00:00-03:00`;
const endOf = (day) => `${day}T23:59:59-03:00`;

beforeAll(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
}, 60_000);

async function call(userId, sql, params = []) {
    await asUser(db, userId);
    return db.query(sql, params);
}

async function newOwner(plan = 'profissional') {
    const owner = await createUser(db);
    counter += 1;
    await asUser(db, owner);
    const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], null) as id', [
        JSON.stringify(businessPayload({ name: `Ciclo ${counter}`, phone: `(83) 9${String(counter).padStart(4, '0')}-1111` })),
        [cats.gastronomia],
    ]);
    const businessId = rows[0].id;
    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'approve')`, [businessId]);
    await db.query('select public.admin_set_business_plan($1, $2)', [businessId, plan]);
    const fee = { basico: 1.5, profissional: 1, premium: 0.5 }[plan];
    return { owner, businessId, fee };
}

/** Oferta até o estado pedido; período em dias relativos a hoje (UTC−3). */
async function offerIn(ctx, state, { from = -1, to = 10, starts, ends } = {}) {
    const payload = {
        title: `Oferta ${state}`,
        description: 'Oferta para testar o ciclo de vida.',
        benefit_type: 'gift',
        starts_at: starts ?? startOf(localDay(from)),
        ends_at: ends ?? endOf(localDay(to)),
        coupon_validity_minutes: 60,
    };
    const { rows } = await call(ctx.owner, 'select public.create_offer($1, $2::jsonb) as id', [ctx.businessId, JSON.stringify(payload)]);
    const id = rows[0].id;
    if (state === 'draft') return id;
    await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [id, ctx.fee]);
    await call(ctx.owner, 'select public.submit_offer_for_review($1)', [id]);
    if (state === 'pending_review') return id;
    if (state === 'changes_requested') {
        await call(admin, 'select public.request_offer_changes($1, $2)', [id, 'Ajuste o texto.']);
        return id;
    }
    if (state === 'rejected') {
        await call(admin, 'select public.reject_offer($1, $2)', [id, 'Não confere.']);
        return id;
    }
    await call(admin, 'select public.approve_offer($1)', [id]);
    if (state === 'approved') return id;
    await call(admin, 'select public.publish_offer($1)', [id]);
    if (state === 'suspended') await call(admin, 'select public.suspend_offer($1, $2)', [id, 'Pausa.']);
    return id;
}

async function status(offerId) {
    await asService(db);
    return (await db.query('select status from public.offers where id = $1', [offerId])).rows[0].status;
}

async function reviews(offerId) {
    await asService(db);
    return (
        await db.query(
            'select action, actor_id, message from public.offer_reviews where offer_id = $1 order by created_at, action',
            [offerId]
        )
    ).rows;
}

async function lifecycle(at) {
    await asService(db);
    return (await db.query('select public.process_offer_lifecycle($1::timestamptz) as r', [at])).rows[0].r;
}

describe('agendamento', () => {
    it('registra offer-lifecycle a cada 5 minutos', async () => {
        await asService(db);
        const { rows } = await db.query("select schedule, command from cron.job where jobname = 'offer-lifecycle'");
        expect(rows).toEqual([{ schedule: '*/5 * * * *', command: 'select public.process_offer_lifecycle()' }]);
    });

    it('funções do job não são endpoint', async () => {
        for (const fn of ['process_offer_lifecycle()', 'end_expired_offers()', 'activate_due_offers()']) {
            await asUser(db, admin);
            expect(await expectError(db.query(`select public.${fn}`))).toContain('permission denied');
            await asAnon(db);
            expect(await expectError(db.query(`select public.${fn}`))).toContain('permission denied');
        }
    });
});

describe('limites de horário em UTC−3', () => {
    it('ativa às 00:00 e encerra às 23:59:59 de Pitimbu, não três horas antes', async () => {
        const ctx = await newOwner();
        const first = localDay(20);
        const last = localDay(25);
        const id = await offerIn(ctx, 'scheduled', { starts: startOf(first), ends: endOf(last) });
        expect(await status(id)).toBe('scheduled');

        // 23:59:59 da véspera em Pitimbu = 02:59:59 UTC do dia de início.
        expect(await lifecycle(`${localDay(19)}T23:59:59-03:00`)).toEqual({ ended: 0, activated: 0 });
        expect(await status(id)).toBe('scheduled');

        expect(await lifecycle(startOf(first))).toEqual({ ended: 0, activated: 1 });
        expect(await status(id)).toBe('active');

        // 23:59:58 do último dia em Pitimbu já é o dia seguinte em UTC.
        expect(await lifecycle(`${last}T23:59:58-03:00`)).toEqual({ ended: 0, activated: 0 });
        expect(await status(id)).toBe('active');

        expect(await lifecycle(endOf(last))).toEqual({ ended: 1, activated: 0 });
        expect(await status(id)).toBe('ended');
        expect(await reviews(id)).toEqual(
            expect.arrayContaining([
                { action: 'published', actor_id: null, message: null },
                { action: 'ended', actor_id: null, message: 'Período da oferta encerrado' },
            ])
        );
    });
});

describe('encerramento automático', () => {
    it('encerra active, suspended, scheduled e approved vencidas e não toca nos demais', async () => {
        const ctx = await newOwner('premium');
        const ids = {};
        for (const state of ['active', 'suspended', 'approved', 'draft', 'pending_review', 'changes_requested', 'rejected']) {
            ids[state] = await offerIn(ctx, state, { to: 3 });
        }
        ids.scheduled = await offerIn(ctx, 'scheduled', { from: 1, to: 3 });
        expect(await status(ids.scheduled)).toBe('scheduled');

        const before = {};
        for (const [state, id] of Object.entries(ids)) before[state] = await reviews(id);

        const result = await lifecycle(endOf(localDay(4)));
        expect(result).toEqual({ ended: 4, activated: 0 });
        for (const state of ['active', 'suspended', 'approved', 'scheduled']) {
            expect(await status(ids[state])).toBe('ended');
            expect((await reviews(ids[state])).at(-1)).toEqual({ action: 'ended', actor_id: null, message: 'Período da oferta encerrado' });
        }
        for (const state of ['draft', 'pending_review', 'changes_requested', 'rejected']) {
            expect(await status(ids[state])).toBe(state);
            expect(await reviews(ids[state])).toEqual(before[state]);
        }
        // Agendada que venceu antes de ativar vai direto para ended.
        expect((await reviews(ids.scheduled)).map((row) => row.action)).not.toContain('published');
        expect(await lifecycle(endOf(localDay(4)))).toEqual({ ended: 0, activated: 0 });
    });
});

describe('plano sem vaga', () => {
    it('agendada continua scheduled e ativa quando a vaga abre', async () => {
        const ctx = await newOwner('basico');
        const a = await offerIn(ctx, 'active', { to: 30 });
        const b = await offerIn(ctx, 'scheduled', { from: 2, to: 30 });
        const reviewsBefore = await reviews(b);

        const at = startOf(localDay(3));
        expect(await lifecycle(at)).toEqual({ ended: 0, activated: 0 });
        expect(await lifecycle(at)).toEqual({ ended: 0, activated: 0 });
        expect(await status(b)).toBe('scheduled');
        expect(await reviews(b)).toEqual(reviewsBefore);

        await call(admin, 'select public.end_offer($1, $2)', [a, 'Abre vaga.']);
        expect(await lifecycle(at)).toEqual({ ended: 0, activated: 1 });
        expect(await status(b)).toBe('active');
    });
});

describe('proteções', () => {
    it('o sinal de escrita não sobra depois do job na mesma transação', async () => {
        const ctx = await newOwner();
        const id = await offerIn(ctx, 'approved');
        await asService(db);
        await db.exec('begin');
        try {
            await db.query('select public.process_offer_lifecycle()');
            expect(
                await expectError(db.query("update public.offers set status = 'ended', ended_at = now() where id = $1", [id]))
            ).toBe('direct_write_not_allowed');
        } finally {
            await db.exec('rollback');
        }
        expect(await status(id)).toBe('approved');
    });
});
