// Simulação em memória do módulo de ofertas para os testes de navegador.
//
// Reproduz as regras das RPCs homologadas (migrations 20261005000001–3) que a
// interface precisa respeitar: versão congelada ao enviar, nova versão ao
// corrigir, aceite por versão, taxa do plano, limite de ativas e motivo
// obrigatório. Não substitui os testes PGlite nem a homologação no Supabase.
import { randomUUID } from 'node:crypto';

const PLANS = {
    gratuito: { id: 'gratuito', name: 'Gratuito', active_offer_limit: 0, sort_order: 0, fee: null },
    basico: { id: 'basico', name: 'Básico', active_offer_limit: 1, sort_order: 1, fee: '1.50' },
    profissional: { id: 'profissional', name: 'Profissional', active_offer_limit: 3, sort_order: 2, fee: '1.00' },
    premium: { id: 'premium', name: 'Premium', active_offer_limit: 5, sort_order: 3, fee: '0.50' },
};

const CONTENT_FIELDS = [
    'title', 'description', 'benefit_type', 'benefit_value', 'starts_at', 'ends_at', 'days_of_week', 'time_windows',
    'minimum_purchase', 'eligible_items', 'stackable', 'conditions', 'total_limit', 'per_user_limit', 'coupon_validity_minutes',
];

export const TERMS_VERSION = '2026-10-v1';

export function createOffersState() {
    return { planId: 'profissional', offers: [], versions: [], reviews: [], coupons: [], fail: {}, gate: null };
}

const couponEffective = (coupon) =>
    coupon.status === 'available' && new Date(coupon.expires_at) <= new Date() ? 'expired' : coupon.status;

/** Cupom direto no estado (cenários de esgotado, expirado e versão antiga). */
export function seedCoupon(state, { offer, userId, versionNumber, status = 'available', expiresInMinutes = 120 }) {
    const version = state.versions.find((v) => v.offer_id === offer.id && (versionNumber ? v.version_number === versionNumber : v.id === offer.published_version_id));
    const coupon = {
        id: randomUUID(), code: `FP-${randomUUID().replace(/[^A-HJ-NP-Z2-9]/gi, '').toUpperCase().slice(0, 6).padEnd(6, 'K')}`,
        status, offer_id: offer.id, offer_version_id: version.id, business_id: offer.business_id, user_id: userId,
        generated_at: iso(), expires_at: new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
        terms_version: TERMS_VERSION, terms_accepted_at: iso(), canceled_at: status === 'canceled' ? iso() : null,
        cancel_reason: status === 'canceled' ? 'Uso indevido.' : null,
    };
    state.coupons.push(coupon);
    return coupon;
}

const iso = () => new Date().toISOString();

function rpcError(code, status = 400) {
    return { status, body: { code: 'P0001', message: code, details: `Erro simulado: ${code}`, hint: null } };
}

function numeric(value) {
    return value === null || value === undefined ? null : Number(value).toFixed(2);
}

function latest(state, offerId) {
    return state.versions.filter((v) => v.offer_id === offerId).sort((a, b) => b.version_number - a.version_number)[0];
}

function newVersion(state, offerId, number, content = {}) {
    const version = {
        id: randomUUID(), offer_id: offerId, version_number: number, review_status: 'draft', submitted_at: null,
        title: null, description: null, benefit_type: null, benefit_value: null, starts_at: null, ends_at: null,
        days_of_week: [1, 2, 3, 4, 5, 6, 7], time_windows: [], minimum_purchase: null, eligible_items: null, stackable: false,
        conditions: null, total_limit: null, per_user_limit: 1, coupon_validity_minutes: null,
        fee_amount: null, fee_rule_id: null, financial_accepted_by: null, financial_accepted_at: null,
        created_at: iso(), updated_at: iso(), ...content,
    };
    state.versions.push(version);
    return version;
}

function applyPayload(version, payload) {
    for (const field of CONTENT_FIELDS) {
        if (field in payload) {
            version[field] = ['benefit_value', 'minimum_purchase'].includes(field) ? numeric(payload[field]) : payload[field];
        }
    }
    version.updated_at = iso();
}

function fork(state, source) {
    const content = Object.fromEntries(CONTENT_FIELDS.map((field) => [field, source[field]]));
    return newVersion(state, source.offer_id, latest(state, source.offer_id).version_number + 1, content);
}

function review(state, offer, version, action, actorId, message = null) {
    state.reviews.push({
        id: randomUUID(), offer_id: offer.id, offer_version_id: version.id, actor_id: actorId,
        action, message: message || null, created_at: iso(),
    });
}

/** Cria uma oferta direto no estado, para cenários que começam no meio do fluxo. */
export function seedOffer(state, { businessId, ownerId, status = 'draft', versions = [{}], reviews = [] }) {
    const offer = {
        id: randomUUID(), business_id: businessId, status, published_version_id: null, created_by: ownerId,
        created_at: '2026-10-01T12:00:00Z', updated_at: iso(), activated_at: null, suspended_at: null, ended_at: null,
    };
    state.offers.push(offer);
    versions.forEach((content, index) => {
        const version = newVersion(state, offer.id, index + 1, {
            title: 'Sobremesa grátis', description: 'Uma sobremesa por mesa no almoço.', benefit_type: 'gift',
            starts_at: '2026-10-01T03:00:00Z', ends_at: '2027-01-31T02:59:59Z', coupon_validity_minutes: 1440,
            total_limit: 50, ...content,
        });
        if (version.review_status !== 'draft') version.submitted_at = '2026-10-02T12:00:00Z';
        if (content.published) {
            offer.published_version_id = version.id;
            offer.activated_at = '2026-10-03T12:00:00Z';
        }
        delete version.published;
    });
    for (const item of reviews) {
        const version = state.versions.find((v) => v.offer_id === offer.id && v.version_number === (item.version ?? 1));
        review(state, offer, version, item.action, 'actor' in item ? item.actor : ownerId, item.message);
    }
    return offer;
}

function filterRows(rows, url) {
    let result = rows;
    for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
        if (value.startsWith('eq.')) result = result.filter((row) => String(row[key]) === value.slice(3));
        if (value.startsWith('in.(')) {
            const list = value.slice(4, -1).split(',').map((item) => item.replace(/"/g, ''));
            result = result.filter((row) => list.includes(String(row[key])));
        }
    }
    return result;
}

/**
 * Atende as rotas de ofertas. Devolve `{ status, body }` ou null quando a rota
 * não é de ofertas.
 */
export async function handleOffers({ state, business, userId, path, url, method, body, accept }) {
    const offersState = state.offers;
    const plan = PLANS[offersState.planId];
    const businessOf = () => business();

    const single = (rows) => (accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);

    const couponView = (coupon) => {
        const current = businessOf();
        const version = offersState.versions.find((v) => v.id === coupon.offer_version_id);
        const publicVersion = Object.fromEntries(
            ['id', 'version_number', ...CONTENT_FIELDS].map((field) => [field, version[field]])
        );
        return {
            id: coupon.id, code: coupon.code, status: couponEffective(coupon), generated_at: coupon.generated_at,
            expires_at: coupon.expires_at, expired_at: null, canceled_at: coupon.canceled_at, cancel_reason: coupon.cancel_reason,
            terms_version: coupon.terms_version, terms_accepted_at: coupon.terms_accepted_at, offer_id: coupon.offer_id,
            business: { id: current.id, name: current.name, slug: current.slug }, version: publicVersion,
        };
    };
    const reserved = (offerId) =>
        offersState.coupons.filter((c) => c.offer_id === offerId && couponEffective(c) === 'available').length;
    const isPublic = (offer) => {
        const version = offersState.versions.find((v) => v.id === offer.published_version_id);
        return offer.status === 'active' && businessOf()?.status === 'active' && version
            && new Date(version.starts_at) <= new Date() && new Date(version.ends_at) > new Date();
    };

    if (path === '/rest/v1/coupon_terms') {
        return { status: 200, body: [{
            version: TERMS_VERSION, title: 'Regulamento de Utilização dos Cupons', published_at: '2026-10-06T03:00:00Z',
            content: [
                { heading: null, blocks: [{ p: 'Os cupons disponibilizados pelo Farol Pitimbu correspondem a benefícios oferecidos pelos estabelecimentos participantes aos usuários da plataforma.' }] },
                { heading: '1. Condições da oferta', blocks: [{ p: 'Antes de gerar o cupom, o usuário deverá verificar as condições específicas da oferta, incluindo:' }, { list: ['benefício oferecido;', 'período de validade;'] }] },
                { heading: '10. Aceite do usuário', blocks: [{ p: 'Importante: o benefício somente poderá ser utilizado de acordo com as condições apresentadas nesta oferta.' }] },
            ],
        }] };
    }

    if (path === '/rest/v1/plans') return { status: 200, body: Object.values(PLANS).map((plan) => ({ id: plan.id, name: plan.name, active_offer_limit: plan.active_offer_limit, sort_order: plan.sort_order })) };
    if (path === '/rest/v1/offers') {
        if (method !== 'GET') return rpcError('direct_write_not_allowed', 403);
        const current = businessOf();
        const rows = filterRows(offersState.offers, url).map((offer) => ({
            ...offer,
            business: current ? { id: current.id, name: current.name, slug: current.slug, status: current.status, owner_id: current.owner_id } : null,
        }));
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
        return { status: 200, body: single(rows) };
    }
    if (path === '/rest/v1/offer_versions') {
        if (method !== 'GET') return rpcError('direct_write_not_allowed', 403);
        return { status: 200, body: filterRows(offersState.versions, url).sort((a, b) => a.version_number - b.version_number) };
    }
    if (path === '/rest/v1/offer_reviews') {
        if (method !== 'GET') return rpcError('direct_write_not_allowed', 403);
        return { status: 200, body: filterRows(offersState.reviews, url).sort((a, b) => a.created_at.localeCompare(b.created_at)) };
    }
    if (path === '/rest/v1/profiles') {
        return { status: 200, body: [{ id: userId, full_name: 'Pessoa de Teste', email: 'proprietario@example.test' }] };
    }

    const rpc = path.split('/rpc/')[1];
    const known = [
        'get_business_offer_terms', 'create_offer', 'update_offer_draft', 'create_offer_revision',
        'accept_offer_financial_terms', 'submit_offer_for_review', 'approve_offer', 'request_offer_changes',
        'reject_offer', 'publish_offer', 'suspend_offer', 'reactivate_offer', 'end_offer', 'admin_set_business_plan',
        'offer_coupon_availability', 'generate_coupon', 'get_my_coupons', 'get_my_coupon', 'get_coupon_qr_token',
    ];
    if (!known.includes(rpc)) return null;

    if (offersState.gate && rpc !== 'get_business_offer_terms') await offersState.gate;
    if (offersState.fail[rpc]) {
        const code = offersState.fail[rpc];
        delete offersState.fail[rpc];
        return rpcError(code);
    }

    const ok = (data = null) => ({ status: 200, body: data });
    const offer = offersState.offers.find((item) => item.id === body?.p_offer_id);
    const last = offer ? latest(offersState, offer.id) : null;
    const activeCount = () => offersState.offers.filter((item) => item.status === 'active').length;
    const requireMessage = () => !(body?.p_message ?? '').trim();

    switch (rpc) {
        case 'offer_coupon_availability':
            return ok(offersState.offers
                .filter((item) => body.p_offer_ids.includes(item.id) && isPublic(item))
                .map((item) => {
                    const version = offersState.versions.find((v) => v.id === item.published_version_id);
                    return { offer_id: item.id, available: version.total_limit === null || reserved(item.id) < version.total_limit };
                }));
        case 'generate_coupon': {
            if (!body.p_terms_version) return rpcError('terms_not_accepted');
            if (body.p_terms_version !== TERMS_VERSION) return rpcError('terms_outdated');
            const target = offersState.offers.find((item) => item.id === body.p_offer_id);
            if (!target || !isPublic(target)) return rpcError('offer_not_active');
            const version = offersState.versions.find((v) => v.id === target.published_version_id);
            if (offersState.coupons.some((c) => c.offer_id === target.id && c.user_id === userId && couponEffective(c) === 'available')) {
                return rpcError('coupon_already_available');
            }
            if (version.total_limit !== null && reserved(target.id) >= version.total_limit) return rpcError('offer_sold_out');
            const expires = Math.min(Date.now() + version.coupon_validity_minutes * 60_000, new Date(version.ends_at).getTime());
            const coupon = seedCoupon(offersState, { offer: target, userId, expiresInMinutes: (expires - Date.now()) / 60_000 });
            return ok({ coupon_id: coupon.id, code: coupon.code, expires_at: coupon.expires_at });
        }
        case 'get_my_coupons':
            return ok(offersState.coupons.filter((c) => c.user_id === userId).reverse().map(couponView));
        case 'get_my_coupon': {
            const coupon = offersState.coupons.find((c) => c.id === body.p_coupon_id && c.user_id === userId);
            return coupon ? ok(couponView(coupon)) : rpcError('coupon_not_found');
        }
        case 'get_coupon_qr_token': {
            const coupon = offersState.coupons.find((c) => c.id === body.p_coupon_id && c.user_id === userId);
            if (!coupon) return rpcError('coupon_not_found');
            return ok(couponEffective(coupon) === 'available' ? `tok_${coupon.id.replace(/-/g, '')}` : null);
        }
        case 'get_business_offer_terms':
            return ok({
                plan_id: plan.id, plan_name: plan.name, active_offer_limit: plan.active_offer_limit,
                active_offers: activeCount(), fee_amount: plan.fee, fee_rule_id: plan.fee ? `fee-${plan.id}` : null,
            });
        case 'create_offer': {
            const created = {
                id: randomUUID(), business_id: body.p_business_id, status: 'draft', published_version_id: null,
                created_by: userId, created_at: iso(), updated_at: iso(), activated_at: null, suspended_at: null, ended_at: null,
            };
            offersState.offers.push(created);
            applyPayload(newVersion(offersState, created.id, 1), body.p_payload ?? {});
            return ok(created.id);
        }
        case 'update_offer_draft': {
            if (!offer) return rpcError('not_found');
            let target = last;
            if (last.review_status === 'changes_requested') target = fork(offersState, last);
            else if (last.review_status !== 'draft') return rpcError('offer_not_editable');
            applyPayload(target, body.p_payload ?? {});
            return ok(target.id);
        }
        case 'create_offer_revision': {
            if (offer.status !== 'active') return rpcError('offer_not_editable');
            if (!['approved', 'rejected'].includes(last.review_status)) return rpcError('revision_already_open');
            const published = offersState.versions.find((v) => v.id === offer.published_version_id);
            return ok(fork(offersState, published).id);
        }
        case 'accept_offer_financial_terms':
            if (last.review_status !== 'draft') return rpcError('offer_not_editable');
            if (!plan.fee) return rpcError('plan_fee_unavailable');
            if (Number(body.p_expected_fee) !== Number(plan.fee)) return rpcError('fee_changed');
            Object.assign(last, {
                fee_amount: plan.fee, fee_rule_id: `fee-${plan.id}`, financial_accepted_by: userId, financial_accepted_at: iso(),
            });
            return ok();
        case 'submit_offer_for_review': {
            if (last.review_status !== 'draft') return rpcError('invalid_transition');
            if (!last.financial_accepted_at) return rpcError('financial_terms_required');
            if (!last.title || !last.description || !last.benefit_type) return rpcError('offer_incomplete');
            const previous = offersState.versions.find((v) => v.offer_id === offer.id && v.version_number === last.version_number - 1);
            last.review_status = 'submitted';
            last.submitted_at = iso();
            if (offer.status !== 'active') offer.status = 'pending_review';
            review(offersState, offer, last, previous?.review_status === 'changes_requested' ? 'resubmitted' : 'submitted', userId);
            return ok();
        }
        case 'approve_offer':
        case 'request_offer_changes':
        case 'reject_offer': {
            const decision = { approve_offer: 'approved', request_offer_changes: 'changes_requested', reject_offer: 'rejected' }[rpc];
            if (last.review_status !== 'submitted') return rpcError('invalid_transition');
            if (decision !== 'approved' && requireMessage()) return rpcError('reason_required');
            last.review_status = decision;
            if (offer.status === 'pending_review') offer.status = decision;
            review(offersState, offer, last, decision, userId, body.p_message);
            return ok();
        }
        case 'publish_offer': {
            if (last.review_status !== 'approved' || !['approved', 'active'].includes(offer.status) || last.id === offer.published_version_id) {
                return rpcError('invalid_transition');
            }
            if (offer.status === 'active') {
                offer.published_version_id = last.id;
                review(offersState, offer, last, 'published', userId);
                return ok('active');
            }
            if (new Date(last.starts_at) > new Date()) {
                offer.status = 'scheduled';
                review(offersState, offer, last, 'scheduled', userId);
                return ok('scheduled');
            }
            if (activeCount() >= plan.active_offer_limit) return rpcError('plan_offer_limit_reached');
            Object.assign(offer, { status: 'active', published_version_id: last.id, activated_at: iso() });
            review(offersState, offer, last, 'published', userId);
            return ok('active');
        }
        case 'suspend_offer':
            if (offer.status !== 'active') return rpcError('invalid_transition');
            if (requireMessage()) return rpcError('reason_required');
            Object.assign(offer, { status: 'suspended', suspended_at: iso() });
            review(offersState, offer, last, 'suspended', userId, body.p_message);
            return ok();
        case 'reactivate_offer':
            if (offer.status !== 'suspended') return rpcError('invalid_transition');
            if (activeCount() >= plan.active_offer_limit) return rpcError('plan_offer_limit_reached');
            offer.status = 'active';
            review(offersState, offer, last, 'reactivated', userId, body.p_message);
            return ok();
        case 'end_offer':
            if (!['approved', 'scheduled', 'active', 'suspended'].includes(offer.status)) return rpcError('invalid_transition');
            Object.assign(offer, { status: 'ended', ended_at: iso() });
            review(offersState, offer, last, 'ended', userId, body.p_message);
            return ok();
        case 'admin_set_business_plan':
            offersState.planId = body.p_plan_id;
            return ok();
        default:
            return null;
    }
}
