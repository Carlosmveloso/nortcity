// @vitest-environment node
//
// Sprint 3 — validação e utilização: quem valida, identificação por QR ou
// código, janela de dias e horários em America/Fortaleza, confirmação
// atômica, taxa da versão, per_user_limit sobre utilizações e escrita
// protegida.
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
/** Dia ISO (1 = segunda) de hoje em Pitimbu. */
function todayIsoDow() {
    const day = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCDay();
    return day === 0 ? 7 : day;
}

beforeAll(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
    await asService(db);
    await db.query("insert into vault.decrypted_secrets (name, decrypted_secret) values ('coupon_qr_key_v1', repeat('k1', 24))");
}, 60_000);

async function call(userId, sql, params = []) {
    await asUser(db, userId);
    return db.query(sql, params);
}

async function userWithEmail(email) {
    const id = await createUser(db);
    await asService(db);
    await db.query('update public.profiles set email = $2, full_name = $3 where id = $1', [id, email, email.split('@')[0]]);
    return id;
}

async function newBusiness(plan = 'profissional') {
    counter += 1;
    const owner = await userWithEmail(`owner${counter}@example.test`);
    await asUser(db, owner);
    const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], null) as id', [
        JSON.stringify(businessPayload({ name: `Uso ${counter}`, phone: `(83) 9${String(counter).padStart(4, '0')}-3333` })),
        [cats.gastronomia],
    ]);
    const businessId = rows[0].id;
    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'approve')`, [businessId]);
    await db.query('select public.admin_set_business_plan($1, $2)', [businessId, plan]);
    return { owner, businessId };
}

async function fee(ctx) {
    return (await call(ctx.owner, 'select public.get_business_offer_terms($1) as t', [ctx.businessId])).rows[0].t.fee_amount;
}

async function offer(ctx, overrides = {}) {
    const payload = {
        title: 'Sobremesa grátis', description: 'Uma sobremesa por mesa.', benefit_type: 'gift',
        starts_at: startOf(localDay(-1)), ends_at: endOf(localDay(30)), coupon_validity_minutes: 120,
        per_user_limit: 1, ...overrides,
    };
    const { rows } = await call(ctx.owner, 'select public.create_offer($1, $2::jsonb) as id', [ctx.businessId, JSON.stringify(payload)]);
    const id = rows[0].id;
    await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [id, await fee(ctx)]);
    await call(ctx.owner, 'select public.submit_offer_for_review($1)', [id]);
    await call(admin, 'select public.approve_offer($1)', [id]);
    await call(admin, 'select public.publish_offer($1)', [id]);
    return id;
}

async function revise(ctx, offerId, changes) {
    await call(ctx.owner, 'select public.create_offer_revision($1)', [offerId]);
    await call(ctx.owner, 'select public.update_offer_draft($1, $2::jsonb)', [offerId, JSON.stringify(changes)]);
    await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, await fee(ctx)]);
    await call(ctx.owner, 'select public.submit_offer_for_review($1)', [offerId]);
    await call(admin, 'select public.approve_offer($1)', [offerId]);
    await call(admin, 'select public.publish_offer($1)', [offerId]);
}

async function generate(userId, offerId) {
    return (await call(userId, 'select public.generate_coupon($1, $2) as r', [offerId, TERMS])).rows[0].r;
}
const verify = async (userId, businessId, input) =>
    (await call(userId, 'select public.verify_coupon($1, $2) as r', [businessId, input])).rows[0].r;
const confirm = async (userId, businessId, input) =>
    (await call(userId, 'select public.confirm_coupon_usage($1, $2) as r', [businessId, input])).rows[0].r;

async function row(table, where, params) {
    await asService(db);
    return (await db.query(`select * from public.${table} where ${where}`, params)).rows;
}

async function qrPayload(userId, couponId) {
    const token = (await call(userId, 'select public.get_coupon_qr_token($1) as t', [couponId])).rows[0].t;
    return `farol-cupom:1:${token}`;
}

describe('quem valida', () => {
    it('01/02/03 — proprietário e validador ativo validam; desativado, comum, admin e outro negócio não', async () => {
        const ctx = await newBusiness();
        const other = await newBusiness();
        const offerId = await offer(ctx);
        const customer = await createUser(db);
        const coupon = await generate(customer, offerId);
        const staff = await userWithEmail(`staff${counter}@example.test`);

        expect(await expectError(verify(staff, ctx.businessId, coupon.code))).toBe('not_a_validator');
        const validatorId = (await call(ctx.owner, 'select public.owner_add_validator($1, $2) as id', [ctx.businessId, `STAFF${counter}@example.test `])).rows[0].id;
        expect((await verify(staff, ctx.businessId, coupon.code)).valid).toBe(true);
        expect((await verify(ctx.owner, ctx.businessId, coupon.code)).valid).toBe(true);

        expect(await expectError(verify(admin, ctx.businessId, coupon.code))).toBe('not_a_validator');
        expect(await expectError(verify(customer, ctx.businessId, coupon.code))).toBe('not_a_validator');
        expect(await expectError(verify(other.owner, other.businessId, coupon.code))).toBe('coupon_not_found');

        await call(ctx.owner, 'select public.owner_deactivate_validator($1)', [validatorId]);
        expect(await expectError(verify(staff, ctx.businessId, coupon.code))).toBe('not_a_validator');
        expect(await expectError(confirm(staff, ctx.businessId, coupon.code))).toBe('not_a_validator');
        const validators = (await call(ctx.owner, 'select public.owner_list_validators($1) as v', [ctx.businessId])).rows[0].v;
        expect(validators).toEqual([expect.objectContaining({ active: false, email: `staff${counter}@example.test` })]);
    });

    it('cadastro de validador: conta inexistente, o próprio dono, duplicado e não proprietário', async () => {
        const ctx = await newBusiness();
        const staff = await userWithEmail(`dup${counter}@example.test`);
        expect(await expectError(call(ctx.owner, 'select public.owner_add_validator($1, $2)', [ctx.businessId, 'ninguem@example.test']))).toBe('account_not_found');
        expect(await expectError(call(ctx.owner, 'select public.owner_add_validator($1, $2)', [ctx.businessId, `owner${counter}@example.test`]))).toBe('validator_is_owner');
        await call(ctx.owner, 'select public.owner_add_validator($1, $2)', [ctx.businessId, `dup${counter}@example.test`]);
        expect(await expectError(call(ctx.owner, 'select public.owner_add_validator($1, $2)', [ctx.businessId, `dup${counter}@example.test`]))).toBe('validator_already_active');
        expect(await expectError(call(staff, 'select public.owner_add_validator($1, $2)', [ctx.businessId, 'x@example.test']))).toBe('forbidden');
        expect((await call(staff, 'select public.my_validation_businesses() as v')).rows[0].v).toEqual([
            expect.objectContaining({ id: ctx.businessId, role: 'validator' }),
        ]);
    });
});

describe('identificação', () => {
    it('04 — QR e código encontram o mesmo cupom; normalização do código', async () => {
        const ctx = await newBusiness();
        const customer = await createUser(db);
        const coupon = await generate(customer, await offer(ctx));
        const suffix = coupon.code.slice(3);
        for (const input of [coupon.code, ` ${coupon.code.toLowerCase()} `, `FP${suffix}`, suffix, `fp ${suffix.slice(0, 3)} ${suffix.slice(3)}`]) {
            const result = await verify(ctx.owner, ctx.businessId, input);
            expect(result).toMatchObject({ method: 'code', coupon: { code: coupon.code } });
        }
        const qr = await verify(ctx.owner, ctx.businessId, await qrPayload(customer, coupon.coupon_id));
        expect(qr).toMatchObject({ method: 'qr', coupon: { code: coupon.code } });
        expect(await expectError(verify(ctx.owner, ctx.businessId, 'farol-cupom:1:' + 'A'.repeat(43)))).toBe('coupon_not_found');
        expect(await expectError(verify(ctx.owner, ctx.businessId, 'qualquer coisa'))).toBe('coupon_not_found');
        // A verificação não expõe dados do cliente nem taxa.
        const text = JSON.stringify(qr);
        expect(text).not.toContain(customer);
        expect(text).not.toContain('fee_amount');
    });
});

describe('situações recusadas', () => {
    it('05 — expirado, cancelado, vencido e utilizado com o motivo certo', async () => {
        const ctx = await newBusiness('premium');
        const customer = await createUser(db);

        const expired = await generate(customer, await offer(ctx));
        await asService(db);
        await db.query('select public.expire_due_coupons($1::timestamptz)', [new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()]);
        expect(await verify(ctx.owner, ctx.businessId, expired.code)).toMatchObject({ valid: false, reason: 'coupon_expired' });
        expect(await expectError(confirm(ctx.owner, ctx.businessId, expired.code))).toBe('coupon_expired');

        const canceled = await generate(customer, await offer(ctx));
        await call(admin, 'select public.admin_cancel_coupon($1, $2)', [canceled.coupon_id, 'Fraude.']);
        expect(await verify(ctx.owner, ctx.businessId, canceled.code)).toMatchObject({ valid: false, reason: 'coupon_canceled' });
        expect(await expectError(confirm(ctx.owner, ctx.businessId, canceled.code))).toBe('coupon_canceled');

        // Disponível vencido ainda não processado pelo job.
        const late = await generate(customer, await offer(ctx, { coupon_validity_minutes: 1 }));
        await asService(db);
        await db.exec('alter table public.coupons disable trigger coupons_guard_trigger');
        await db.query("update public.coupons set generated_at = now() - interval '10 minutes', expires_at = now() - interval '1 minute' where id = $1", [late.coupon_id]);
        await db.exec('alter table public.coupons enable trigger coupons_guard_trigger');
        expect(await verify(ctx.owner, ctx.businessId, late.code)).toMatchObject({ valid: false, reason: 'coupon_expired' });
        expect(await expectError(confirm(ctx.owner, ctx.businessId, late.code))).toBe('coupon_expired');
        expect((await row('coupons', 'id = $1', [late.coupon_id]))[0].status).toBe('available');
    });
});

describe('janela de dias e horários', () => {
    it('06 — limites da faixa em America/Fortaleza, não em UTC', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, {
            days_of_week: [1, 2, 3, 4, 5, 6, 7],
            time_windows: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, start: '11:00', end: '15:00' })),
        });
        await asService(db);
        const versionId = (await db.query('select published_version_id from public.offers where id = $1', [offerId])).rows[0].published_version_id;
        const open = async (at) =>
            (await db.query('select public.coupon_usage_window_open($1, $2::timestamptz) as o', [versionId, at])).rows[0].o;
        expect(await open('2026-10-19T10:59:59-03:00')).toBe(false);
        expect(await open('2026-10-19T11:00:00-03:00')).toBe(true);
        expect(await open('2026-10-19T14:59:59-03:00')).toBe(true);
        expect(await open('2026-10-19T15:00:00-03:00')).toBe(false);
        // 13:30 UTC = 10:30 em Pitimbu: fora, apesar de 13:30 estar na faixa.
        expect(await open('2026-10-19T13:30:00Z')).toBe(false);
        expect(await open('2026-10-19T17:30:00Z')).toBe(true);
    });

    it('06b — fora do dia: confirmação recusada e o cupom continua disponível', async () => {
        const ctx = await newBusiness();
        const otherDay = (todayIsoDow() % 7) + 1;
        const offerId = await offer(ctx, { days_of_week: [otherDay], time_windows: [] });
        const customer = await createUser(db);
        const coupon = await generate(customer, offerId);
        expect(await verify(ctx.owner, ctx.businessId, coupon.code)).toMatchObject({
            valid: false, reason: 'offer_time_window_not_allowed', window_open: false,
        });
        expect(await expectError(confirm(ctx.owner, ctx.businessId, coupon.code))).toBe('offer_time_window_not_allowed');
        expect((await row('coupons', 'id = $1', [coupon.coupon_id]))[0]).toMatchObject({ status: 'available', used_at: null });
        expect(await row('coupon_usages', 'coupon_id = $1', [coupon.coupon_id])).toEqual([]);
    });
});

describe('confirmação', () => {
    it('07/08/09 — cria utilização, lançamento e evento; segunda confirmação recusada; taxa da versão', async () => {
        const ctx = await newBusiness('profissional');
        const offerId = await offer(ctx);
        const customer = await createUser(db);
        const coupon = await generate(customer, offerId);
        // Plano muda depois da geração: a taxa continua a da versão do cupom.
        await call(admin, 'select public.admin_set_business_plan($1, $2)', [ctx.businessId, 'premium']);

        const result = await confirm(ctx.owner, ctx.businessId, await qrPayload(customer, coupon.coupon_id));
        expect(result).toMatchObject({ coupon_id: coupon.coupon_id, code: coupon.code, method: 'qr' });
        expect((await row('coupons', 'id = $1', [coupon.coupon_id]))[0]).toMatchObject({ status: 'used' });
        const [usage] = await row('coupon_usages', 'coupon_id = $1', [coupon.coupon_id]);
        expect(usage).toMatchObject({ validator_id: ctx.owner, user_id: customer, business_id: ctx.businessId, validation_method: 'qr', fee_amount: '1.00' });
        expect(await row('fee_ledger_entries', 'coupon_usage_id = $1', [usage.id])).toEqual([
            expect.objectContaining({ kind: 'usage_fee', amount: '1.00', business_id: ctx.businessId }),
        ]);
        expect((await row('coupon_events', "coupon_id = $1 and action = 'used'", [coupon.coupon_id]))[0]).toMatchObject({ actor_id: ctx.owner });

        expect(await expectError(confirm(ctx.owner, ctx.businessId, coupon.code))).toBe('coupon_already_used');
        expect(await row('coupon_usages', 'coupon_id = $1', [coupon.coupon_id])).toHaveLength(1);
        expect(await row('fee_ledger_entries', 'coupon_usage_id = $1', [usage.id])).toHaveLength(1);
        const verified = await verify(ctx.owner, ctx.businessId, coupon.code);
        expect(verified).toMatchObject({ valid: false, reason: 'coupon_already_used' });
        expect(verified.usage.used_at).toBeTruthy();

        // Cliente vê o cupom utilizado, sem taxa e sem QR.
        const view = (await call(customer, 'select public.get_my_coupon($1) as v', [coupon.coupon_id])).rows[0].v;
        expect(view).toMatchObject({ status: 'used' });
        expect(view.used_at).toBeTruthy();
        expect(JSON.stringify(view)).not.toContain('fee');
        expect((await call(customer, 'select public.get_coupon_qr_token($1) as t', [coupon.coupon_id])).rows[0].t).toBeNull();
    });

    it('09b — taxa da versão do cupom mesmo depois de publicar versão nova com outra taxa', async () => {
        const ctx = await newBusiness('profissional');
        const offerId = await offer(ctx);
        const customer = await createUser(db);
        const coupon = await generate(customer, offerId);
        await call(admin, 'select public.admin_set_business_plan($1, $2)', [ctx.businessId, 'premium']);
        await revise(ctx, offerId, { title: 'Versão 2' });
        await confirm(ctx.owner, ctx.businessId, coupon.code);
        expect((await row('coupon_usages', 'coupon_id = $1', [coupon.coupon_id]))[0].fee_amount).toBe('1.00');
    });
});

describe('limites', () => {
    it('10/11 — per_user_limit conta utilizações em versões diferentes da mesma oferta', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, { per_user_limit: 2 });
        const customer = await createUser(db);
        const first = await generate(customer, offerId);
        await confirm(ctx.owner, ctx.businessId, first.code);

        await revise(ctx, offerId, { title: 'Segunda versão', per_user_limit: 2 });
        const second = await generate(customer, offerId);
        expect((await row('coupons', 'id = $1', [second.coupon_id]))[0].offer_version_id).not.toBe(
            (await row('coupons', 'id = $1', [first.coupon_id]))[0].offer_version_id
        );
        await confirm(ctx.owner, ctx.businessId, second.code);
        expect(await expectError(generate(customer, offerId))).toBe('user_limit_reached');

        // Com limite 1, a primeira utilização já esgota.
        const single = await offer(ctx, { per_user_limit: 1 });
        const once = await generate(customer, single);
        await confirm(ctx.owner, ctx.businessId, once.code);
        expect(await expectError(generate(customer, single))).toBe('user_limit_reached');
    });

    it('12/13 — vagas contam used; expirado e cancelado não; expiração não toca em used', async () => {
        const ctx = await newBusiness();
        const offerId = await offer(ctx, { total_limit: 2, per_user_limit: 1 });
        const alice = await createUser(db);
        const bob = await createUser(db);
        const carol = await createUser(db);
        const a = await generate(alice, offerId);
        await confirm(ctx.owner, ctx.businessId, a.code);
        const b = await generate(bob, offerId);
        expect(await expectError(generate(carol, offerId))).toBe('offer_sold_out');
        await call(admin, 'select public.admin_cancel_coupon($1, $2)', [b.coupon_id, 'Teste.']);
        const c = await generate(carol, offerId);
        await asService(db);
        await db.query('select public.expire_due_coupons($1::timestamptz)', [new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()]);
        expect((await row('coupons', 'id = $1', [a.coupon_id]))[0].status).toBe('used');
        expect((await row('coupons', 'id = $1', [c.coupon_id]))[0].status).toBe('expired');
        expect((await db.query('select public.offer_reserved_coupons($1) as n', [offerId])).rows[0].n).toBe(1);
    });
});

describe('escrita protegida e acesso', () => {
    it('14 — escrita direta bloqueada para usuário, service_role e postgres, inclusive depois da RPC', async () => {
        const ctx = await newBusiness();
        const customer = await createUser(db);
        const coupon = await generate(customer, await offer(ctx));
        await confirm(ctx.owner, ctx.businessId, coupon.code);
        const [usage] = await row('coupon_usages', 'coupon_id = $1', [coupon.coupon_id]);

        for (const table of ['coupon_usages', 'fee_ledger_entries', 'business_validators']) {
            expect(await expectError(call(ctx.owner, `delete from public.${table}`))).toContain('permission denied');
        }
        await asService(db);
        await db.exec('set role service_role');
        try {
            expect(await expectError(db.query("update public.coupon_usages set fee_amount = 0.01 where id = $1", [usage.id]))).toBe('record_immutable');
            expect(await expectError(db.query('delete from public.fee_ledger_entries where coupon_usage_id = $1', [usage.id]))).toBe('record_immutable');
            expect(await expectError(db.query("update public.coupons set status = 'available', used_at = null where id = $1", [coupon.coupon_id]))).toBe('invalid_transition');
            expect(await expectError(db.query(
                "insert into public.business_validators (business_id, user_id, added_by) values ($1, $2, $2)", [ctx.businessId, customer]
            ))).toBe('direct_write_not_allowed');
        } finally {
            await db.exec('reset role');
        }
        const other = await generate(await createUser(db), await offer(ctx));
        await asUser(db, ctx.owner);
        await db.exec('begin');
        try {
            await db.query('select public.confirm_coupon_usage($1, $2)', [ctx.businessId, other.code]);
            await db.exec('reset role');
            expect(await expectError(db.query(
                'insert into public.fee_ledger_entries (business_id, kind, coupon_usage_id, amount) values ($1, $2, $3, 1)',
                [ctx.businessId, 'usage_fee', usage.id]
            ))).toBe('direct_write_not_allowed');
        } finally {
            await db.exec('rollback');
        }
    });

    it('15 — leitura: proprietário e admin pelas RPCs; cliente, validador e visitante sem acesso às tabelas', async () => {
        const ctx = await newBusiness();
        const customer = await createUser(db);
        const staff = await userWithEmail(`reader${counter}@example.test`);
        await call(ctx.owner, 'select public.owner_add_validator($1, $2)', [ctx.businessId, `reader${counter}@example.test`]);
        const coupon = await generate(customer, await offer(ctx));
        await confirm(staff, ctx.businessId, coupon.code);

        const ownerList = (await call(ctx.owner, 'select public.list_coupon_usages($1) as v', [ctx.businessId])).rows[0].v;
        expect(ownerList).toEqual([expect.objectContaining({ code: coupon.code, fee_amount: 1, method: 'code', validator_name: `reader${counter}` })]);
        expect((await call(admin, 'select public.list_coupon_usages(null) as v')).rows[0].v.length).toBeGreaterThanOrEqual(1);
        expect(await expectError(call(staff, 'select public.list_coupon_usages($1)', [ctx.businessId]))).toBe('forbidden');
        expect(await expectError(call(customer, 'select public.list_coupon_usages($1)', [ctx.businessId]))).toBe('forbidden');

        for (const user of [customer, staff, ctx.owner]) {
            expect((await call(user, 'select * from public.coupon_usages')).rows).toEqual([]);
            expect((await call(user, 'select * from public.fee_ledger_entries')).rows).toEqual([]);
        }
        expect((await call(admin, 'select id from public.coupon_usages where coupon_id = $1', [coupon.coupon_id])).rows).toHaveLength(1);
        await asAnon(db);
        for (const table of ['coupon_usages', 'fee_ledger_entries', 'business_validators']) {
            expect(await expectError(db.query(`select * from public.${table}`))).toContain('permission denied');
        }
        expect(await expectError(db.query('select public.verify_coupon($1, $2)', [ctx.businessId, coupon.code]))).toContain('permission denied');
    });
});
