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

export function createOffersState() {
    return { planId: 'profissional', offers: [], versions: [], reviews: [], fail: {}, gate: null };
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
        review(state, offer, version, item.action, item.actor ?? ownerId, item.message);
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
