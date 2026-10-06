// Acesso a ofertas. Leitura direta por RLS, com colunas explícitas; toda
// escrita passa pelas RPCs oficiais (migration 20261005000003). As tabelas de
// ofertas recusam gravação direta (`direct_write_not_allowed`), então não há
// insert/update aqui de propósito.
//
// As consultas são separadas em vez de embutidas: offers ↔ offer_versions e
// offer_reviews ↔ offer_versions têm mais de uma FK entre si, e o embed do
// PostgREST ficaria ambíguo.
import { supabase } from './client';

export const OFFER_COLUMNS =
    'id, business_id, status, published_version_id, created_by, created_at, updated_at, activated_at, suspended_at, ended_at';

export const VERSION_COLUMNS = `
    id, offer_id, version_number, review_status, submitted_at, title, description,
    benefit_type, benefit_value, starts_at, ends_at, days_of_week, time_windows,
    minimum_purchase, eligible_items, stackable, conditions, total_limit,
    per_user_limit, coupon_validity_minutes, fee_amount, fee_rule_id,
    financial_accepted_by, financial_accepted_at, created_at, updated_at
`;

export const REVIEW_COLUMNS = 'id, offer_id, offer_version_id, actor_id, action, message, created_at';

const ADMIN_OFFER_COLUMNS = `${OFFER_COLUMNS}, business:businesses(id, name, slug, status, owner_id)`;

async function versionsFor(offerIds) {
    if (offerIds.length === 0) return { data: [], error: null };
    return supabase
        .from('offer_versions')
        .select(VERSION_COLUMNS)
        .in('offer_id', offerIds)
        .order('version_number', { ascending: true });
}

// ---------------------------------------------------------------------------
// Leitura — proprietário
// ---------------------------------------------------------------------------

/** Plano, limite, ofertas ativas e taxa vigente (null no Gratuito). */
export async function fetchOfferTerms(businessId) {
    const { data, error } = await supabase.rpc('get_business_offer_terms', { p_business_id: businessId });
    return { terms: data ?? null, error };
}

export async function fetchBusinessOffers(businessId) {
    const { data: offers, error } = await supabase
        .from('offers')
        .select(OFFER_COLUMNS)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) return { offers: [], versions: [], error };

    const { data: versions, error: versionsError } = await versionsFor(offers.map((offer) => offer.id));
    return { offers, versions: versions ?? [], error: versionsError };
}

export async function fetchOfferDetail(offerId, { admin = false } = {}) {
    const { data: offer, error } = await supabase
        .from('offers')
        .select(admin ? ADMIN_OFFER_COLUMNS : OFFER_COLUMNS)
        .eq('id', offerId)
        .maybeSingle();
    if (error || !offer) return { offer: null, versions: [], reviews: [], error };

    const [versions, reviews] = await Promise.all([
        versionsFor([offerId]),
        supabase.from('offer_reviews').select(REVIEW_COLUMNS).eq('offer_id', offerId).order('created_at', { ascending: true }),
    ]);
    return {
        offer,
        versions: versions.data ?? [],
        reviews: reviews.data ?? [],
        error: versions.error ?? reviews.error ?? null,
    };
}

// ---------------------------------------------------------------------------
// Leitura — admin
// ---------------------------------------------------------------------------

export async function fetchAdminOffers() {
    const { data: offers, error } = await supabase
        .from('offers')
        .select(ADMIN_OFFER_COLUMNS)
        .order('updated_at', { ascending: false });
    if (error) return { offers: [], versions: [], error };

    const { data: versions, error: versionsError } = await supabase
        .from('offer_versions')
        .select(VERSION_COLUMNS)
        .order('version_number', { ascending: true });
    return { offers, versions: versions ?? [], error: versionsError };
}

/** Nome e e-mail das contas citadas na análise (RLS de profiles libera ao admin). */
export async function fetchProfiles(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return { profiles: {}, error: null };
    const { data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', unique);
    return { profiles: Object.fromEntries((data ?? []).map((row) => [row.id, row])), error };
}

// ---------------------------------------------------------------------------
// Operações oficiais
// ---------------------------------------------------------------------------

async function call(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    return { data: data ?? null, error: error ?? null };
}

export const offerRpc = {
    create: (businessId, payload) => call('create_offer', { p_business_id: businessId, p_payload: payload }),
    updateDraft: (offerId, payload) => call('update_offer_draft', { p_offer_id: offerId, p_payload: payload }),
    createRevision: (offerId) => call('create_offer_revision', { p_offer_id: offerId }),
    acceptTerms: (offerId, expectedFee) =>
        call('accept_offer_financial_terms', { p_offer_id: offerId, p_expected_fee: expectedFee }),
    submit: (offerId) => call('submit_offer_for_review', { p_offer_id: offerId }),

    approve: (offerId, message) => call('approve_offer', { p_offer_id: offerId, p_message: message || null }),
    requestChanges: (offerId, message) => call('request_offer_changes', { p_offer_id: offerId, p_message: message }),
    reject: (offerId, message) => call('reject_offer', { p_offer_id: offerId, p_message: message }),
    publish: (offerId) => call('publish_offer', { p_offer_id: offerId }),
    suspend: (offerId, message) => call('suspend_offer', { p_offer_id: offerId, p_message: message }),
    reactivate: (offerId, message) => call('reactivate_offer', { p_offer_id: offerId, p_message: message || null }),
    end: (offerId, message) => call('end_offer', { p_offer_id: offerId, p_message: message || null }),

    setBusinessPlan: (businessId, planId, note) =>
        call('admin_set_business_plan', { p_business_id: businessId, p_plan_id: planId, p_note: note || null }),
};

export async function fetchPlans() {
    const { data, error } = await supabase
        .from('plans')
        .select('id, name, active_offer_limit, sort_order')
        .order('sort_order', { ascending: true });
    return { plans: data ?? [], error };
}
