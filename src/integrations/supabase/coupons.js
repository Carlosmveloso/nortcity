// Ofertas públicas e cupons. Leitura pública com colunas explícitas (o
// visitante só tem grant para as colunas de vitrine); tudo o que é do
// usuário passa pelas RPCs da migration 20261007000001, que devolvem as
// condições da versão aceita e nunca a taxa.
import { supabase } from './client';

const PUBLIC_OFFER_COLUMNS = 'id, business_id, status, published_version_id, activated_at';
const PUBLIC_VERSION_COLUMNS = `
    id, offer_id, version_number, title, description, benefit_type, benefit_value,
    starts_at, ends_at, days_of_week, time_windows, minimum_purchase, eligible_items,
    stackable, conditions, total_limit, per_user_limit, coupon_validity_minutes
`;

/** Disponibilidade só sim/não; oferta ausente do resultado não está pública. */
export async function fetchAvailability(offerIds) {
    if (offerIds.length === 0) return { availability: {}, error: null };
    const { data, error } = await supabase.rpc('offer_coupon_availability', { p_offer_ids: offerIds });
    return { availability: Object.fromEntries((data ?? []).map((row) => [row.offer_id, row.available])), error };
}

async function versionsById(ids) {
    if (ids.length === 0) return { data: [], error: null };
    return supabase.from('offer_versions').select(PUBLIC_VERSION_COLUMNS).in('id', ids);
}

/** Ofertas no ar de um negócio, para o perfil público. */
export async function fetchBusinessPublicOffers(businessId) {
    const { data: offers, error } = await supabase
        .from('offers')
        .select(PUBLIC_OFFER_COLUMNS)
        .eq('business_id', businessId)
        .eq('status', 'active')
        .order('activated_at', { ascending: false });
    if (error) return { offers: [], error };
    const ids = offers.map((offer) => offer.id);
    const [{ availability }, versions] = await Promise.all([
        fetchAvailability(ids),
        versionsById(offers.map((offer) => offer.published_version_id)),
    ]);
    const byId = Object.fromEntries((versions.data ?? []).map((version) => [version.id, version]));
    return {
        // Só o que a disponibilidade confirmou como público (período, negócio).
        offers: offers
            .filter((offer) => offer.id in availability && byId[offer.published_version_id])
            .map((offer) => ({ ...offer, version: byId[offer.published_version_id], available: availability[offer.id] })),
        error: versions.error ?? null,
    };
}

export async function fetchPublicOffer(offerId) {
    const { data: offer, error } = await supabase
        .from('offers')
        .select(PUBLIC_OFFER_COLUMNS)
        .eq('id', offerId)
        .eq('status', 'active')
        .maybeSingle();
    if (error || !offer) return { offer: null, error };
    const [{ availability }, versions, business] = await Promise.all([
        fetchAvailability([offer.id]),
        versionsById([offer.published_version_id]),
        supabase.from('businesses').select('id, name, slug, status').eq('id', offer.business_id).maybeSingle(),
    ]);
    if (!(offer.id in availability) || !versions.data?.[0] || !business.data) return { offer: null, error: null };
    return {
        offer: { ...offer, version: versions.data[0], business: business.data, available: availability[offer.id] },
        error: null,
    };
}

export async function fetchCouponTerms(version) {
    let query = supabase.from('coupon_terms').select('version, title, content, published_at');
    query = version ? query.eq('version', version) : query.lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(1);
    const { data, error } = await query;
    return { terms: data?.[0] ?? null, error };
}

async function call(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    return { data: data ?? null, error: error ?? null };
}

export const couponRpc = {
    generate: (offerId, termsVersion) => call('generate_coupon', { p_offer_id: offerId, p_terms_version: termsVersion }),
    mine: () => call('get_my_coupons', {}),
    one: (couponId) => call('get_my_coupon', { p_coupon_id: couponId }),
    qrToken: (couponId) => call('get_coupon_qr_token', { p_coupon_id: couponId }),
};
