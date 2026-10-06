// @vitest-environment node
//
// Sprint 1 — módulo de ofertas: os 15 testes obrigatórios e as garantias de
// plano, RLS e histórico que eles pressupõem.
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

const HOUR = 60 * 60 * 1000;
const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

let db, cats, admin, commonUser;
let counter = 0;

beforeAll(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
    commonUser = await createUser(db);
}, 60_000);

/** Proprietário com negócio publicado no plano pedido. */
async function newOwner(plan = 'profissional') {
    const owner = await createUser(db);
    counter += 1;
    await asUser(db, owner);
    const { rows } = await db.query('select public.submit_business($1::jsonb, $2::uuid[], null) as id', [
        JSON.stringify(businessPayload({ name: `Negócio ${counter}`, phone: `(83) 9${String(counter).padStart(4, '0')}-0000` })),
        [cats.gastronomia],
    ]);
    const businessId = rows[0].id;
    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'approve')`, [businessId]);
    if (plan !== 'gratuito') {
        await db.query('select public.admin_set_business_plan($1, $2)', [businessId, plan]);
    }
    return { owner, businessId };
}

function offerPayload(overrides = {}) {
    return {
        title: '20% no almoço',
        description: 'Desconto de 20% em qualquer prato do almoço executivo.',
        benefit_type: 'percentage_discount',
        benefit_value: 20,
        starts_at: at(-HOUR),
        ends_at: at(30 * 24 * HOUR),
        days_of_week: [1, 2],
        time_windows: [
            { day: 1, start: '11:00', end: '15:00' },
            { day: 2, start: '11:00', end: '15:00' },
            { day: 2, start: '18:00', end: '22:00' },
        ],
        per_user_limit: 1,
        total_limit: 100,
        coupon_validity_minutes: 120,
        ...overrides,
    };
}

async function call(userId, sql, params = []) {
    await asUser(db, userId);
    return db.query(sql, params);
}

async function createOffer(ctx, overrides) {
    const { rows } = await call(ctx.owner, 'select public.create_offer($1, $2::jsonb) as id', [
        ctx.businessId,
        JSON.stringify(offerPayload(overrides)),
    ]);
    return rows[0].id;
}

async function acceptAndSubmit(ctx, offerId, fee = 1) {
    await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, fee]);
    await call(ctx.owner, 'select public.submit_offer_for_review($1)', [offerId]);
}

async function approvedOffer(ctx, overrides, fee) {
    const offerId = await createOffer(ctx, overrides);
    await acceptAndSubmit(ctx, offerId, fee);
    await call(admin, 'select public.approve_offer($1)', [offerId]);
    return offerId;
}

async function activeOffer(ctx, overrides, fee) {
    const offerId = await approvedOffer(ctx, overrides, fee);
    await call(admin, 'select public.publish_offer($1)', [offerId]);
    return offerId;
}

async function offerRow(offerId) {
    await asService(db);
    const { rows } = await db.query('select * from public.offers where id = $1', [offerId]);
    return rows[0];
}

async function versions(offerId) {
    await asService(db);
    const { rows } = await db.query(
        'select * from public.offer_versions where offer_id = $1 order by version_number',
        [offerId],
    );
    return rows;
}

async function reviews(offerId) {
    await asService(db);
    const { rows } = await db.query(
        'select action, message, actor_id, offer_version_id from public.offer_reviews where offer_id = $1 order by created_at, action',
        [offerId],
    );
    return rows;
}

describe('criação', () => {
    it('01 — proprietário cria oferta em rascunho', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        const offer = await offerRow(offerId);
        expect(offer).toMatchObject({ status: 'draft', business_id: ctx.businessId, created_by: ctx.owner });
        const [v1] = await versions(offerId);
        expect(v1).toMatchObject({ version_number: 1, review_status: 'draft', title: '20% no almoço' });
        expect(v1.fee_amount).toBeNull();
    });

    it('02 — usuário comum não cria oferta', async () => {
        const ctx = await newOwner();
        expect(
            await expectError(call(commonUser, 'select public.create_offer($1, $2::jsonb)', [ctx.businessId, '{}'])),
        ).toBe('forbidden');
        expect(
            await expectError(
                call(commonUser, 'insert into public.offers (business_id, created_by) values ($1, $2)', [
                    ctx.businessId,
                    commonUser,
                ]),
            ),
        ).toContain('permission denied');
        await asAnon(db);
        expect(
            await expectError(db.query('select public.create_offer($1, $2::jsonb)', [ctx.businessId, '{}'])),
        ).toContain('permission denied');
    });

    it('03 — proprietário não cria oferta para outro negócio', async () => {
        const alice = await newOwner();
        const bob = await newOwner();
        expect(
            await expectError(
                call(alice.owner, 'select public.create_offer($1, $2::jsonb)', [bob.businessId, '{}']),
            ),
        ).toBe('forbidden');
        await asService(db);
        expect(
            (await db.query('select count(*)::int as n from public.offers where business_id = $1', [bob.businessId]))
                .rows[0].n,
        ).toBe(0);
    });

    it('campos fora da lista editável são recusados', async () => {
        const ctx = await newOwner();
        expect(
            await expectError(
                call(ctx.owner, 'select public.create_offer($1, $2::jsonb)', [
                    ctx.businessId,
                    JSON.stringify({ title: 'Oferta', fee_amount: 0.01 }),
                ]),
            ),
        ).toBe('field_not_editable');
        expect(
            await expectError(
                call(ctx.owner, 'select public.create_offer($1, $2::jsonb)', [
                    ctx.businessId,
                    JSON.stringify({ benefit_type: 'cashback' }),
                ]),
            ),
        ).toContain('invalid input value for enum');
    });
});

describe('aceite financeiro e envio', () => {
    it('04 — envio sem aceite financeiro é recusado', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        expect(await expectError(call(ctx.owner, 'select public.submit_offer_for_review($1)', [offerId]))).toBe(
            'financial_terms_required',
        );
        expect((await offerRow(offerId)).status).toBe('draft');
        expect(await reviews(offerId)).toEqual([]);
    });

    it('aceite congela a taxa vigente do plano na versão', async () => {
        const ctx = await newOwner('basico');
        const offerId = await createOffer(ctx);
        expect(
            await expectError(call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, 1])),
        ).toBe('fee_changed');
        await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, 1.5]);
        const [v1] = await versions(offerId);
        expect(v1).toMatchObject({ fee_amount: '1.50', financial_accepted_by: ctx.owner });
        expect(v1.fee_rule_id).not.toBeNull();
        expect(v1.financial_accepted_at).not.toBeNull();
    });

    it('Gratuito não tem taxa e não chega a enviar oferta', async () => {
        const ctx = await newOwner('gratuito');
        const offerId = await createOffer(ctx);
        const terms = (await call(ctx.owner, 'select public.get_business_offer_terms($1) as t', [ctx.businessId]))
            .rows[0].t;
        expect(terms).toMatchObject({ plan_id: 'gratuito', active_offer_limit: 0, fee_amount: null });
        expect(
            await expectError(call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, 1])),
        ).toBe('plan_fee_unavailable');
    });

    it('troca de plano depois do aceite exige novo aceite', async () => {
        const ctx = await newOwner('profissional');
        const offerId = await createOffer(ctx);
        await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, 1]);
        await call(admin, 'select public.admin_set_business_plan($1, $2)', [ctx.businessId, 'premium']);
        expect(await expectError(call(ctx.owner, 'select public.submit_offer_for_review($1)', [offerId]))).toBe(
            'fee_changed',
        );
        await acceptAndSubmit(ctx, offerId, 0.5);
        expect((await offerRow(offerId)).status).toBe('pending_review');
        expect((await versions(offerId))[0].fee_amount).toBe('0.50');
    });

    it('envio válido vai para análise e registra o histórico', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        await acceptAndSubmit(ctx, offerId);
        expect((await offerRow(offerId)).status).toBe('pending_review');
        const [v1] = await versions(offerId);
        expect(v1.review_status).toBe('submitted');
        expect(await reviews(offerId)).toEqual([
            { action: 'submitted', message: null, actor_id: ctx.owner, offer_version_id: v1.id },
        ]);
        expect(
            await expectError(
                call(ctx.owner, 'select public.update_offer_draft($1, $2::jsonb)', [offerId, '{"title":"Outro"}']),
            ),
        ).toBe('offer_not_editable');
    });

    it('dados obrigatórios incompletos impedem o envio', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx, { benefit_value: null, coupon_validity_minutes: null });
        await call(ctx.owner, 'select public.accept_offer_financial_terms($1, $2)', [offerId, 1]);
        expect(await expectError(call(ctx.owner, 'select public.submit_offer_for_review($1)', [offerId]))).toBe(
            'benefit_value_required',
        );
    });
});

describe('constraints da versão', () => {
    it('05 — início depois do fim é impedido pela constraint', async () => {
        const ctx = await newOwner();
        expect(
            await expectError(createOffer(ctx, { starts_at: at(10 * 24 * HOUR), ends_at: at(2 * 24 * HOUR) })),
        ).toContain('offer_versions_period_check');
        const offerId = await createOffer(ctx);
        expect(
            await expectError(
                call(ctx.owner, 'select public.update_offer_draft($1, $2::jsonb)', [
                    offerId,
                    JSON.stringify({ ends_at: at(-2 * HOUR) }),
                ]),
            ),
        ).toContain('offer_versions_period_check');
    });

    it('limites, valores e horários inválidos são recusados pelo banco', async () => {
        const ctx = await newOwner();
        const cases = [
            [{ benefit_value: 120 }, 'offer_versions_benefit_value_check'],
            [{ benefit_type: 'fixed_discount', benefit_value: 0 }, 'offer_versions_benefit_value_check'],
            [{ per_user_limit: 0 }, 'per_user_limit_check'],
            [{ total_limit: 0, per_user_limit: 1 }, 'check constraint'],
            [{ total_limit: 2, per_user_limit: 3 }, 'offer_versions_limits_check'],
            [{ coupon_validity_minutes: 0 }, 'coupon_validity_minutes_check'],
            [{ time_windows: [{ day: 3, start: '11:00', end: '15:00' }] }, 'offer_versions_schedule_check'],
            [{ time_windows: [{ day: 1, start: '15:00', end: '11:00' }] }, 'offer_versions_schedule_check'],
            [
                {
                    time_windows: [
                        { day: 1, start: '11:00', end: '15:00' },
                        { day: 1, start: '14:00', end: '16:00' },
                    ],
                },
                'offer_versions_schedule_check',
            ],
            [{ days_of_week: [] }, 'offer_versions_schedule_check'],
        ];
        for (const [overrides, constraint] of cases) {
            expect(await expectError(createOffer(ctx, overrides))).toContain(constraint);
        }
    });

    it('brinde não exige valor monetário', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx, {
            title: 'Sobremesa grátis',
            benefit_type: 'gift',
            benefit_value: null,
            days_of_week: [1, 2, 3, 4, 5, 6, 7],
            time_windows: [],
        });
        await acceptAndSubmit(ctx, offerId);
        expect((await offerRow(offerId)).status).toBe('pending_review');
    });
});

describe('transições protegidas', () => {
    it('06 — parceiro não muda draft → active diretamente', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        expect(
            await expectError(
                call(ctx.owner, "update public.offers set status = 'active' where id = $1", [offerId]),
            ),
        ).toContain('permission denied');
        expect(
            await expectError(
                call(ctx.owner, "update public.offer_versions set review_status = 'approved' where offer_id = $1", [
                    offerId,
                ]),
            ),
        ).toContain('permission denied');
        for (const fn of ['approve_offer', 'publish_offer']) {
            expect(await expectError(call(ctx.owner, `select public.${fn}($1)`, [offerId]))).toBe('forbidden');
        }
        // Nem a conexão de serviço pula a máquina de estados.
        await asService(db);
        expect(
            await expectError(db.query("update public.offers set status = 'active' where id = $1", [offerId])),
        ).toBe('invalid_transition');
        expect((await offerRow(offerId)).status).toBe('draft');
    });
});

describe('escrita só pelas operações oficiais', () => {
    async function pendingOffer() {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        await acceptAndSubmit(ctx, offerId);
        return { ctx, offerId };
    }

    it('service_role não faz transição válida por UPDATE direto', async () => {
        const { ctx, offerId } = await pendingOffer();
        await asService(db);
        await db.exec('set role service_role');
        try {
            expect(
                await expectError(db.query("update public.offers set status = 'approved' where id = $1", [offerId])),
            ).toBe('direct_write_not_allowed');
            expect(
                await expectError(
                    db.query("update public.offer_versions set review_status = 'approved' where offer_id = $1", [
                        offerId,
                    ]),
                ),
            ).toBe('direct_write_not_allowed');
            const [v1] = await versions(offerId);
            expect(
                await expectError(
                    db.query(
                        "insert into public.offer_reviews (offer_id, offer_version_id, action) values ($1, $2, 'approved')",
                        [offerId, v1.id],
                    ),
                ),
            ).toBe('direct_write_not_allowed');
            expect(
                await expectError(
                    db.query('insert into public.offers (business_id, created_by) values ($1, $2)', [
                        ctx.businessId,
                        ctx.owner,
                    ]),
                ),
            ).toBe('direct_write_not_allowed');
        } finally {
            await db.exec('reset role');
        }
        expect((await offerRow(offerId)).status).toBe('pending_review');
        expect((await reviews(offerId)).map((r) => r.action)).toEqual(['submitted']);
    });

    it('rascunho também não é editado fora da RPC', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        await asService(db);
        expect(
            await expectError(db.query("update public.offer_versions set title = 'Fora da RPC' where offer_id = $1", [offerId])),
        ).toBe('direct_write_not_allowed');
    });

    it('RPC oficial do admin muda o status e registra o histórico', async () => {
        const { offerId } = await pendingOffer();
        await call(admin, 'select public.approve_offer($1)', [offerId]);
        expect((await offerRow(offerId)).status).toBe('approved');
        expect((await reviews(offerId)).map((r) => [r.action, r.actor_id])).toEqual([
            ['submitted', expect.any(String)],
            ['approved', admin],
        ]);
    });

    it('a autorização não sobra para um UPDATE direto na mesma transação', async () => {
        const { offerId } = await pendingOffer();
        await asUser(db, admin);
        await db.exec('begin');
        try {
            await db.query('select public.approve_offer($1)', [offerId]);
            await db.exec('reset role');
            expect(
                await expectError(db.query("update public.offers set status = 'ended', ended_at = now() where id = $1", [offerId])),
            ).toBe('direct_write_not_allowed');
        } finally {
            await db.exec('rollback');
        }
        expect((await offerRow(offerId)).status).toBe('pending_review');
    });
});

describe('análise', () => {
    it('07 — admin solicita ajustes com motivo obrigatório', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        await acceptAndSubmit(ctx, offerId);
        expect(await expectError(call(admin, "select public.request_offer_changes($1, '  ')", [offerId]))).toBe(
            'reason_required',
        );
        await call(admin, 'select public.request_offer_changes($1, $2)', [
            offerId,
            'Informe quais pratos participam da promoção.',
        ]);
        expect((await offerRow(offerId)).status).toBe('changes_requested');
        expect((await reviews(offerId)).map((r) => [r.action, r.message, r.actor_id])).toEqual([
            ['submitted', null, ctx.owner],
            ['changes_requested', 'Informe quais pratos participam da promoção.', admin],
        ]);
        // O proprietário lê o motivo; outra conta não.
        expect((await call(ctx.owner, 'select action from public.offer_reviews where offer_id = $1', [offerId])).rows)
            .toHaveLength(2);
        expect((await call(commonUser, 'select * from public.offer_reviews where offer_id = $1', [offerId])).rows)
            .toEqual([]);
    });

    it('08 — parceiro corrige e reenvia sem sobrescrever a versão analisada', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        await acceptAndSubmit(ctx, offerId);
        await call(admin, 'select public.request_offer_changes($1, $2)', [offerId, 'Detalhe os pratos.']);

        await call(ctx.owner, 'select public.update_offer_draft($1, $2::jsonb)', [
            offerId,
            JSON.stringify({ eligible_items: 'Pratos executivos de segunda a sexta' }),
        ]);
        expect(await expectError(call(ctx.owner, 'select public.submit_offer_for_review($1)', [offerId]))).toBe(
            'financial_terms_required',
        );
        await acceptAndSubmit(ctx, offerId);

        expect((await offerRow(offerId)).status).toBe('pending_review');
        const [v1, v2] = await versions(offerId);
        expect(v1).toMatchObject({ review_status: 'changes_requested', eligible_items: null });
        expect(v2).toMatchObject({
            version_number: 2,
            review_status: 'submitted',
            eligible_items: 'Pratos executivos de segunda a sexta',
            title: v1.title,
        });
        expect((await reviews(offerId)).map((r) => [r.action, r.offer_version_id])).toEqual([
            ['submitted', v1.id],
            ['changes_requested', v1.id],
            ['resubmitted', v2.id],
        ]);
    });

    it('09 — admin aprova', async () => {
        const ctx = await newOwner();
        const offerId = await approvedOffer(ctx);
        expect((await offerRow(offerId)).status).toBe('approved');
        expect((await versions(offerId))[0].review_status).toBe('approved');
        expect((await reviews(offerId)).map((r) => r.action)).toEqual(['submitted', 'approved']);
    });

    it('rejeição exige motivo e mantém a oferta no histórico', async () => {
        const ctx = await newOwner();
        const offerId = await createOffer(ctx);
        await acceptAndSubmit(ctx, offerId);
        expect(await expectError(call(admin, 'select public.reject_offer($1, null)', [offerId]))).toBe(
            'reason_required',
        );
        await call(admin, 'select public.reject_offer($1, $2)', [offerId, 'Benefício não é oferecido pelo negócio.']);
        expect((await offerRow(offerId)).status).toBe('rejected');
        await asService(db);
        expect(await expectError(db.query('delete from public.offers where id = $1', [offerId]))).toBe(
            'offer_not_deletable',
        );
        expect(await expectError(db.query('delete from public.offer_reviews where offer_id = $1', [offerId]))).toBe(
            'review_immutable',
        );
    });
});

describe('publicação', () => {
    it('10 — admin publica: approved → active com a versão aprovada', async () => {
        const ctx = await newOwner();
        const offerId = await approvedOffer(ctx);
        const status = (await call(admin, 'select public.publish_offer($1) as s', [offerId])).rows[0].s;
        expect(status).toBe('active');
        const offer = await offerRow(offerId);
        const [v1] = await versions(offerId);
        expect(offer).toMatchObject({ status: 'active', published_version_id: v1.id });
        expect(offer.activated_at).not.toBeNull();
        expect((await reviews(offerId)).map((r) => r.action)).toEqual(['submitted', 'approved', 'published']);

        // Visitante vê a oferta ativa e a versão publicada, sem dados internos.
        await asAnon(db);
        expect((await db.query('select id, published_version_id from public.offers where id = $1', [offerId])).rows)
            .toEqual([{ id: offerId, published_version_id: v1.id }]);
        expect((await db.query('select title from public.offer_versions where offer_id = $1', [offerId])).rows)
            .toEqual([{ title: '20% no almoço' }]);
        expect(
            await expectError(db.query('select fee_amount from public.offer_versions where offer_id = $1', [offerId])),
        ).toContain('permission denied');
        expect(await expectError(db.query('select created_by from public.offers where id = $1', [offerId]))).toContain(
            'permission denied',
        );
        expect(await expectError(db.query('select * from public.offer_reviews'))).toContain('permission denied');
    });

    it('visitante e outras contas não veem rascunho, análise ou aprovada', async () => {
        const ctx = await newOwner();
        const draft = await createOffer(ctx);
        const approved = await approvedOffer(ctx);
        await asAnon(db);
        expect(
            (await db.query('select id from public.offers where id = any($1::uuid[])', [[draft, approved]])).rows,
        ).toEqual([]);
        expect(
            (
                await db.query('select id from public.offer_versions where offer_id = any($1::uuid[])', [
                    [draft, approved],
                ])
            ).rows,
        ).toEqual([]);
        expect(
            (await call(commonUser, 'select id from public.offers where id = any($1::uuid[])', [[draft, approved]]))
                .rows,
        ).toEqual([]);
        expect(
            (await call(ctx.owner, 'select id from public.offers where id = any($1::uuid[])', [[draft, approved]]))
                .rows,
        ).toHaveLength(2);
    });

    it('11 — oferta futura aprovada é agendada, não ativada', async () => {
        const ctx = await newOwner();
        const offerId = await approvedOffer(ctx, { starts_at: at(2 * 24 * HOUR) });
        const status = (await call(admin, 'select public.publish_offer($1) as s', [offerId])).rows[0].s;
        expect(status).toBe('scheduled');
        const offer = await offerRow(offerId);
        expect(offer).toMatchObject({ status: 'scheduled', published_version_id: null, activated_at: null });

        await asService(db);
        expect((await db.query('select public.activate_due_offers() as n')).rows[0].n).toBe(0);
        expect((await offerRow(offerId)).status).toBe('scheduled');
        await asAnon(db);
        expect((await db.query('select id from public.offers where id = $1', [offerId])).rows).toEqual([]);
    });

    it('12 — plano no limite não ativa nova oferta', async () => {
        const ctx = await newOwner('basico');
        await activeOffer(ctx, {}, 1.5);
        const second = await createOffer(ctx);
        await acceptAndSubmit(ctx, second, 1.5);
        await call(admin, 'select public.approve_offer($1)', [second]);
        expect(await expectError(call(admin, 'select public.publish_offer($1)', [second]))).toBe(
            'plan_offer_limit_reached',
        );
        expect((await offerRow(second)).status).toBe('approved');

        // Rebaixar abaixo das ofertas ativas também é recusado.
        expect(
            await expectError(call(admin, 'select public.admin_set_business_plan($1, $2)', [ctx.businessId, 'gratuito'])),
        ).toBe('plan_offer_limit_exceeded');

        // Com upgrade, a oferta aprovada pode ser ativada.
        await call(admin, 'select public.admin_set_business_plan($1, $2)', [ctx.businessId, 'profissional']);
        await call(admin, 'select public.publish_offer($1)', [second]);
        expect((await offerRow(second)).status).toBe('active');
    });

    it('só admin atribui plano', async () => {
        const ctx = await newOwner('gratuito');
        expect(
            await expectError(
                call(ctx.owner, 'select public.admin_set_business_plan($1, $2)', [ctx.businessId, 'premium']),
            ),
        ).toBe('forbidden');
        expect(
            await expectError(
                call(ctx.owner, 'insert into public.business_plan_assignments (business_id, plan_id) values ($1, $2)', [
                    ctx.businessId,
                    'premium',
                ]),
            ),
        ).toContain('permission denied');
        expect(
            (await call(ctx.owner, 'select public.get_business_offer_terms($1) as t', [ctx.businessId])).rows[0].t
                .plan_id,
        ).toBe('gratuito');
    });
});

describe('ciclo de vida', () => {
    it('13 — oferta ativa é suspensa com motivo e registro', async () => {
        const ctx = await newOwner();
        const offerId = await activeOffer(ctx);
        expect(await expectError(call(admin, 'select public.suspend_offer($1, null)', [offerId]))).toBe(
            'reason_required',
        );
        await call(admin, 'select public.suspend_offer($1, $2)', [offerId, 'Denúncia de cliente em apuração.']);
        const offer = await offerRow(offerId);
        expect(offer.status).toBe('suspended');
        expect(offer.suspended_at).not.toBeNull();
        expect((await reviews(offerId)).at(-1)).toMatchObject({
            action: 'suspended',
            message: 'Denúncia de cliente em apuração.',
            actor_id: admin,
            offer_version_id: offer.published_version_id,
        });
        await asAnon(db);
        expect((await db.query('select id from public.offers where id = $1', [offerId])).rows).toEqual([]);

        await call(admin, 'select public.reactivate_offer($1)', [offerId]);
        expect((await offerRow(offerId)).status).toBe('active');
    });

    it('14 — oferta encerrada não volta a ficar ativa', async () => {
        const ctx = await newOwner();
        const offerId = await activeOffer(ctx);
        await call(admin, 'select public.suspend_offer($1, $2)', [offerId, 'Pausa a pedido do parceiro.']);
        await call(admin, 'select public.end_offer($1, $2)', [offerId, 'Promoção encerrada.']);
        const offer = await offerRow(offerId);
        expect(offer.status).toBe('ended');
        expect(offer.ended_at).not.toBeNull();

        expect(await expectError(call(admin, 'select public.reactivate_offer($1)', [offerId]))).toBe(
            'invalid_transition',
        );
        expect(await expectError(call(admin, 'select public.publish_offer($1)', [offerId]))).toBe(
            'invalid_transition',
        );
        await asService(db);
        expect(
            await expectError(db.query("update public.offers set status = 'active' where id = $1", [offerId])),
        ).toBe('invalid_transition');
        expect((await offerRow(offerId)).status).toBe('ended');
    });

    it('negócio suspenso tira a oferta do ar e impede reativação', async () => {
        const ctx = await newOwner();
        const offerId = await activeOffer(ctx);
        await call(admin, "select public.moderate_business($1, 'suspend', 'business_closed', null)", [ctx.businessId]);
        await asAnon(db);
        expect((await db.query('select id from public.offers where id = $1', [offerId])).rows).toEqual([]);
        await call(admin, 'select public.suspend_offer($1, $2)', [offerId, 'Negócio suspenso.']);
        expect(await expectError(call(admin, 'select public.reactivate_offer($1)', [offerId]))).toBe(
            'business_not_active',
        );
    });
});

describe('versionamento', () => {
    it('15 — revisão cria a versão 2 e preserva a versão 1', async () => {
        const ctx = await newOwner();
        const offerId = await activeOffer(ctx);
        const [v1Before] = await versions(offerId);

        const revisionId = (await call(ctx.owner, 'select public.create_offer_revision($1) as id', [offerId])).rows[0]
            .id;
        expect(await expectError(call(ctx.owner, 'select public.create_offer_revision($1)', [offerId]))).toBe(
            'revision_already_open',
        );
        await call(ctx.owner, 'select public.update_offer_draft($1, $2::jsonb)', [
            offerId,
            JSON.stringify({ title: '25% no almoço', benefit_value: 25 }),
        ]);
        await acceptAndSubmit(ctx, offerId);

        // Durante a análise da revisão, a versão 1 continua no ar.
        let offer = await offerRow(offerId);
        expect(offer).toMatchObject({ status: 'active', published_version_id: v1Before.id });
        await asAnon(db);
        expect((await db.query('select title from public.offer_versions where offer_id = $1', [offerId])).rows)
            .toEqual([{ title: '20% no almoço' }]);

        await call(admin, 'select public.approve_offer($1)', [offerId]);
        await call(admin, 'select public.publish_offer($1)', [offerId]);

        offer = await offerRow(offerId);
        const [v1, v2] = await versions(offerId);
        expect(offer.published_version_id).toBe(revisionId);
        expect(v2).toMatchObject({ id: revisionId, version_number: 2, title: '25% no almoço', benefit_value: '25.00' });
        expect(v1).toEqual(v1Before);

        // Nem a conexão de serviço reescreve uma versão enviada.
        await asService(db);
        expect(
            await expectError(db.query("update public.offer_versions set title = 'Outro' where id = $1", [v1.id])),
        ).toBe('version_immutable');
        expect(
            await expectError(db.query('update public.offer_versions set fee_amount = 0.01 where id = $1', [v2.id])),
        ).toBe('version_immutable');
        expect(await expectError(db.query('delete from public.offer_versions where id = $1', [v1.id]))).toBe(
            'version_immutable',
        );
    });
});
