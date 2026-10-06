// @vitest-environment node
//
// Sprint 2 — geração de cupons: elegibilidade, aceite, vagas, validade,
// versão congelada, QR com HMAC, expiração, RLS e escrita protegida.
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

const TERMS = '2026-10-v1';
const DAY = 24 * 60 * 60 * 1000;
let db, cats, admin;
let counter = 0;

function localDay(offsetDays) {
    return new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetDays * DAY).toISOString().slice(0, 10);
}
const startOf = (day) => `${day}T00:00:00-03:00`;
const endOf = (day) => `${day}T23:59:59-03:00`;

beforeAll(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
    await asService(db);
    await db.query(
        "insert into vault.decrypted_secrets (name, decrypted_secret) values ('coupon_qr_key_v1', repeat('k1', 24))"
    );
}, 60_000);

async function call(userId, sql, params = []) {
    await asUser(db, userId);
    return db.query(sql, params);
}

async function newBusiness(plan = 'profissional') {
    const owner = await createUser(db);
    counter += 1;
    await asUser(db, owner);
    const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], null) as id', [
        JSON.stringify(businessPayload({ name: `Cupom ${counter}`, phone: `(83) 9${String(counter).padStart(4, '0')}-2222` })),
        [cats.gastronomia],
    ]);
    const businessId = rows[0].id;
    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'approve')`, [businessId]);
    await db.query('select public.admin_set_business_plan($1, $2)', [businessId, plan]);
    return { owner, businessId, fee: { basico: 1.5, profissional: 1, premium: 0.5 }[plan] };
}

/** Oferta até o estado pedido. */
async function offer(ctx, state = 'active', overrides = {}) {
    const payload = {
        title: 'Sobremesa grátis',
        description: 'Uma sobremesa por mesa.',
        benefit_type: 'gift',
        starts_at: startOf(localDay(-1)),
        ends_at: endOf(localDay(30)),
        coupon_validity_minutes: 120,
        total_limit: null,
        ...overrides,
    };
    const { rows } = await call(ctx.owner, 'select public.create_offer($1, $2::jsonb) as id', [ctx.businessId, JSON.stringify(payload)]);
    const id = rows[0].id;
    if (state === 'draft') return id;
    await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [id, ctx.fee]);
    await call(ctx.owner, 'select public.submit_offer_for_review($1)', [id]);
    await call(admin, 'select public.approve_offer($1)', [id]);
    await call(admin, 'select public.publish_offer($1)', [id]);
    return id;
}

async function generate(userId, offerId, terms = TERMS) {
    const { rows } = await call(userId, 'select public.generate_coupon($1, $2) as r', [offerId, terms]);
    return rows[0].r;
}

async function couponRow(id) {
    await asService(db);
    return (await db.query('select * from public.coupons where id = $1', [id])).rows[0];
}

async function events(id) {
    await asService(db);
    return (await db.query('select action, actor_id, message from public.coupon_events where coupon_id = $1 order by created_at, action', [id])).rows;
}

async function availability(offerId) {
    await asAnon(db);
    return (await db.query('select available from public.offer_coupon_availability($1::uuid[])', [[offerId]])).rows[0]?.available;
}

describe('elegibilidade', () => {
    it('01/07 — oferta ativa gera cupom disponível, com versão, negócio, aceite e histórico', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx);
        const user = await createUser(db);
        const result = await generate(user, offerId);
        expect(result.code).toMatch(/^FP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
        const row = await couponRow(result.coupon_id);
        await asService(db);
        const published = (await db.query('select published_version_id from public.offers where id = $1', [offerId])).rows[0].published_version_id;
        expect(row).toMatchObject({
            status: 'available', offer_id: offerId, offer_version_id: published, business_id: ctx.businessId,
            user_id: user, terms_version: TERMS, qr_key_version: 1,
        });
        expect(row.terms_accepted_at).not.toBeNull();
        expect(await events(result.coupon_id)).toEqual([{ action: 'generated', actor_id: user, message: null }]);
    });

    it('02 — rascunho não gera', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, 'draft');
        expect(await expectError(generate(await createUser(db), offerId))).toBe('offer_not_active');
    });

    it('03 — agendada não gera antes do início', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, 'active', { starts_at: startOf(localDay(3)) });
        expect(await expectError(generate(await createUser(db), offerId))).toBe('offer_not_started');
    });

    it('04 — encerrada não gera; suspensa também não, mas cupons emitidos continuam', async () => {
        const ctx = await newBusiness();
        const ended = await offer(ctx);
        await call(admin, 'select public.end_offer($1)', [ended]);
        expect(await expectError(generate(await createUser(db), ended))).toBe('offer_expired');

        const suspended = await offer(ctx);
        const holder = await createUser(db);
        const coupon = await generate(holder, suspended);
        await call(admin, 'select public.suspend_offer($1, $2)', [suspended, 'Apuração.']);
        expect(await expectError(generate(await createUser(db), suspended))).toBe('offer_not_active');
        expect((await couponRow(coupon.coupon_id)).status).toBe('available');
    });

    it('05 — visitante não gera', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx);
        await asAnon(db);
        expect(await expectError(db.query('select public.generate_coupon($1, $2)', [offerId, TERMS]))).toContain('permission denied');
    });

    it('06 — aceite obrigatório e na versão vigente do regulamento', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx);
        const user = await createUser(db);
        expect(await expectError(generate(user, offerId, null))).toBe('terms_not_accepted');
        expect(await expectError(generate(user, offerId, '2020-01-v1'))).toBe('terms_outdated');
        await asService(db);
        expect((await db.query('select count(*)::int as n from public.coupons where user_id = $1', [user])).rows[0].n).toBe(0);
    });
});

describe('código e QR', () => {
    it('08/09 — código e hash do QR únicos; token do dono confere com o hash', async () => {
        const ctx = await newBusiness('premium');
        const ids = [];
        for (let i = 0; i < 5; i += 1) {
            const offerId = await offer(ctx);
            ids.push((await generate(await createUser(db), offerId)).coupon_id);
        }
        await asService(db);
        const { rows } = await db.query('select code, qr_token_hash, user_id, id from public.coupons where id = any($1::uuid[])', [ids]);
        expect(new Set(rows.map((r) => r.code)).size).toBe(5);
        expect(new Set(rows.map((r) => r.qr_token_hash)).size).toBe(5);

        const { user_id: owner, id } = rows[0];
        const token = (await call(owner, 'select public.get_coupon_qr_token($1) as t', [id])).rows[0].t;
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(token).not.toContain(owner);
        await asService(db);
        const hash = (await db.query("select encode(digest($1, 'sha256'), 'hex') as h", [token])).rows[0].h;
        expect(hash).toBe(rows[0].qr_token_hash);
        expect(await expectError(call(rows[1].user_id, 'select public.get_coupon_qr_token($1)', [id]))).toBe('coupon_not_found');
    });

    it('rotação de chave: novos cupons usam a versão nova e os antigos continuam verificáveis', async () => {
        const ctx = await newBusiness();
        const user = await createUser(db);
        const old = await generate(user, await offer(ctx));
        await asService(db);
        await db.query("insert into vault.decrypted_secrets (name, decrypted_secret) values ('coupon_qr_key_v2', repeat('k2', 24))");
        try {
            const fresh = await generate(user, await offer(ctx));
            expect((await couponRow(fresh.coupon_id)).qr_key_version).toBe(2);
            const oldRow = await couponRow(old.coupon_id);
            expect(oldRow.qr_key_version).toBe(1);
            const token = (await call(user, 'select public.get_coupon_qr_token($1) as t', [old.coupon_id])).rows[0].t;
            await asService(db);
            expect((await db.query("select encode(digest($1, 'sha256'), 'hex') as h", [token])).rows[0].h).toBe(oldRow.qr_token_hash);
        } finally {
            await asService(db);
            await db.query("delete from vault.decrypted_secrets where name = 'coupon_qr_key_v2'");
        }
    });

    it('sem chave no Vault, a geração recusa com código próprio', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx);
        await asService(db);
        await db.query("update vault.decrypted_secrets set name = 'coupon_qr_key_off' where name = 'coupon_qr_key_v1'");
        try {
            expect(await expectError(generate(await createUser(db), offerId))).toBe('qr_key_unavailable');
        } finally {
            await asService(db);
            await db.query("update vault.decrypted_secrets set name = 'coupon_qr_key_v1' where name = 'coupon_qr_key_off'");
        }
    });
});

describe('versão congelada', () => {
    it('10/20 — cupom guarda a versão da geração e mostra as condições dela', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, 'active', { title: 'Versão um' });
        const user = await createUser(db);
        const coupon = await generate(user, offerId);

        await call(ctx.owner, 'select public.create_offer_revision($1)', [offerId]);
        await call(ctx.owner, 'select public.update_offer_draft($1, $2::jsonb)', [offerId, JSON.stringify({ title: 'Versão dois' })]);
        await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, ctx.fee]);
        await call(ctx.owner, 'select public.submit_offer_for_review($1)', [offerId]);
        await call(admin, 'select public.approve_offer($1)', [offerId]);
        await call(admin, 'select public.publish_offer($1)', [offerId]);

        const view = (await call(user, 'select public.get_my_coupon($1) as v', [coupon.coupon_id])).rows[0].v;
        expect(view.version).toMatchObject({ version_number: 1, title: 'Versão um' });
        expect(view.version.fee_amount).toBeUndefined();
        const list = (await call(user, 'select public.get_my_coupons() as v')).rows[0].v;
        expect(list.find((item) => item.id === coupon.coupon_id).version.title).toBe('Versão um');
    });
});

describe('validade', () => {
    it('11 — expira em geração + validade quando a oferta termina depois', async () => {
        const ctx = await newBusiness();
        const coupon = await generate(await createUser(db), await offer(ctx, 'active', { coupon_validity_minutes: 120 }));
        const row = await couponRow(coupon.coupon_id);
        expect(new Date(row.expires_at) - new Date(row.generated_at)).toBe(120 * 60 * 1000);
    });

    it('12 — nunca passa do fim da oferta, no horário de Pitimbu', async () => {
        const ctx = await newBusiness();
        const today = localDay(0);
        const coupon = await generate(
            await createUser(db),
            await offer(ctx, 'active', { ends_at: endOf(today), coupon_validity_minutes: 10080 })
        );
        const row = await couponRow(coupon.coupon_id);
        expect(new Date(row.expires_at).toISOString()).toBe(new Date(endOf(today)).toISOString());

        // 23:59:58 em Pitimbu já é o dia seguinte em UTC: ainda vale.
        await asService(db);
        await db.query('select public.expire_due_coupons($1::timestamptz)', [`${today}T23:59:58-03:00`]);
        expect((await couponRow(coupon.coupon_id)).status).toBe('available');
        await db.query('select public.expire_due_coupons($1::timestamptz)', [endOf(today)]);
        expect((await couponRow(coupon.coupon_id)).status).toBe('expired');
    });
});

describe('vagas e limite', () => {
    it('13/15/16 — limite total, liberação por expiração e nova geração', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, 'active', { total_limit: 1, per_user_limit: 1 });
        const alice = await createUser(db);
        const bob = await createUser(db);
        expect(await availability(offerId)).toBe(true);
        const first = await generate(alice, offerId);
        expect(await availability(offerId)).toBe(false);
        expect(await expectError(generate(bob, offerId))).toBe('offer_sold_out');

        await asService(db);
        const later = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
        expect((await db.query('select public.expire_due_coupons($1::timestamptz) as n', [later])).rows[0].n).toBeGreaterThanOrEqual(1);
        expect((await db.query('select public.expire_due_coupons($1::timestamptz) as n', [later])).rows[0].n).toBe(0);
        expect(await events(first.coupon_id)).toEqual([
            { action: 'generated', actor_id: alice, message: null },
            { action: 'expired', actor_id: null, message: null },
        ]);
        expect(await availability(offerId)).toBe(true);

        const bobs = await generate(bob, offerId);
        expect((await couponRow(bobs.coupon_id)).status).toBe('available');
        expect(await expectError(generate(alice, offerId))).toBe('offer_sold_out');
    });

    it('14 — mesmo usuário não tem dois disponíveis; depois de expirar, gera de novo', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx);
        const user = await createUser(db);
        const first = await generate(user, offerId);
        expect(await expectError(generate(user, offerId))).toBe('coupon_already_available');
        await asService(db);
        await db.query('select public.expire_due_coupons($1::timestamptz)', [new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()]);
        const second = await generate(user, offerId);
        expect(second.coupon_id).not.toBe(first.coupon_id);
    });

    it('cupom vencido ainda não processado pelo job aparece expirado e libera vaga na geração', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, 'active', { total_limit: 1, coupon_validity_minutes: 1 });
        const alice = await createUser(db);
        const coupon = await generate(alice, offerId);
        expect(await expectError(generate(await createUser(db), offerId))).toBe('offer_sold_out');
        // Simula o tempo passando: só o vencimento é recuado, com a guarda desligada.
        await asService(db);
        await db.exec('alter table public.coupons disable trigger coupons_guard_trigger');
        await db.query("update public.coupons set generated_at = now() - interval '10 minutes', expires_at = now() - interval '1 minute' where id = $1", [coupon.coupon_id]);
        await db.exec('alter table public.coupons enable trigger coupons_guard_trigger');

        expect((await call(alice, 'select public.get_my_coupon($1) as v', [coupon.coupon_id])).rows[0].v.status).toBe('expired');
        expect((await call(alice, 'select public.get_coupon_qr_token($1) as t', [coupon.coupon_id])).rows[0].t).toBeNull();
        const other = await generate(await createUser(db), offerId);
        expect((await couponRow(coupon.coupon_id)).status).toBe('expired');
        expect((await couponRow(other.coupon_id)).status).toBe('available');
    });
});

describe('cancelamento', () => {
    it('admin cancela com motivo; cancelado não volta e libera vaga', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, 'active', { total_limit: 1 });
        const user = await createUser(db);
        const coupon = await generate(user, offerId);
        expect(await expectError(call(user, 'select public.admin_cancel_coupon($1, $2)', [coupon.coupon_id, 'x']))).toBe('forbidden');
        expect(await expectError(call(admin, 'select public.admin_cancel_coupon($1, $2)', [coupon.coupon_id, ' ']))).toBe('reason_required');
        await call(admin, 'select public.admin_cancel_coupon($1, $2)', [coupon.coupon_id, 'Uso indevido identificado.']);
        expect(await couponRow(coupon.coupon_id)).toMatchObject({ status: 'canceled', canceled_by: admin, cancel_reason: 'Uso indevido identificado.' });
        expect((await events(coupon.coupon_id)).at(-1)).toEqual({ action: 'canceled', actor_id: admin, message: 'Uso indevido identificado.' });
        expect(await expectError(call(admin, 'select public.admin_cancel_coupon($1, $2)', [coupon.coupon_id, 'De novo.']))).toBe('invalid_transition');
        await asService(db);
        expect(await expectError(db.query("update public.coupons set status = 'available', canceled_at = null, canceled_by = null, cancel_reason = null where id = $1", [coupon.coupon_id]))).toBe('invalid_transition');
        expect(await generate(await createUser(db), offerId)).toHaveProperty('code');
    });
});

describe('RLS e escrita protegida', () => {
    it('17/19 — dono lê os próprios; outro usuário e visitante não', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx);
        const alice = await createUser(db);
        const bob = await createUser(db);
        const coupon = await generate(alice, offerId);
        expect((await call(alice, 'select id from public.coupons')).rows).toEqual([{ id: coupon.coupon_id }]);
        expect(await expectError(call(alice, 'select qr_token_hash from public.coupons'))).toContain('permission denied');
        expect((await call(bob, 'select id from public.coupons where id = $1', [coupon.coupon_id])).rows).toEqual([]);
        expect(await expectError(call(bob, 'select public.get_my_coupon($1)', [coupon.coupon_id]))).toBe('coupon_not_found');
        expect((await call(bob, 'select public.get_my_coupons() as v')).rows[0].v).toEqual([]);
        expect((await call(bob, 'select * from public.coupon_events where coupon_id = $1', [coupon.coupon_id])).rows).toEqual([]);
        expect((await call(admin, 'select id from public.coupons where id = $1', [coupon.coupon_id])).rows).toHaveLength(1);
        await asAnon(db);
        expect(await expectError(db.query('select id from public.coupons'))).toContain('permission denied');
        expect(await expectError(db.query('select public.get_my_coupons()'))).toContain('permission denied');
        expect((await db.query("select version from public.coupon_terms where version = '2026-10-v1'")).rows).toHaveLength(1);
    });

    it('18 — escrita direta bloqueada para usuário, service_role e postgres', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx);
        const user = await createUser(db);
        const coupon = await generate(user, offerId);
        expect(await expectError(call(user, "update public.coupons set status = 'expired' where id = $1", [coupon.coupon_id]))).toContain('permission denied');
        expect(await expectError(call(user, 'delete from public.coupons where id = $1', [coupon.coupon_id]))).toContain('permission denied');
        await asService(db);
        await db.exec('set role service_role');
        try {
            expect(await expectError(db.query("update public.coupons set status = 'expired', expired_at = now() where id = $1", [coupon.coupon_id]))).toBe('direct_write_not_allowed');
            expect(await expectError(db.query("update public.coupons set expires_at = expires_at + interval '1 day' where id = $1", [coupon.coupon_id]))).toBe('coupon_immutable');
            expect(await expectError(db.query("insert into public.coupon_events (coupon_id, action) values ($1, 'expired')", [coupon.coupon_id]))).toBe('direct_write_not_allowed');
            expect(await expectError(db.query('delete from public.coupons where id = $1', [coupon.coupon_id]))).toBe('coupon_not_deletable');
        } finally {
            await db.exec('reset role');
        }
        expect(await expectError(db.query("update public.coupon_terms set title = 'x'"))).toBe('terms_immutable');
        // O sinal não sobra depois de uma operação oficial na mesma transação.
        await asUser(db, await createUser(db));
        await db.exec('begin');
        try {
            await db.query('select public.generate_coupon($1, $2)', [offerId, TERMS]);
            await db.exec('reset role');
            expect(await expectError(db.query("update public.coupons set status = 'expired', expired_at = now() where id = $1", [coupon.coupon_id]))).toBe('direct_write_not_allowed');
        } finally {
            await db.exec('rollback');
        }
    });

    it('job coupon-expiration registrado e funções internas sem grant', async () => {
        await asService(db);
        const { rows } = await db.query("select schedule, command from cron.job where jobname = 'coupon-expiration'");
        expect(rows).toEqual([{ schedule: '*/5 * * * *', command: 'select public.expire_due_coupons()' }]);
        for (const fn of ['expire_due_coupons()', 'generate_coupon_code()', "coupon_qr_token(gen_random_uuid(), 1)"]) {
            await asUser(db, admin);
            expect(await expectError(db.query(`select public.${fn}`))).toContain('permission denied');
        }
    });
});
