import { useLoader } from './useLoader';
import {
    fetchAdminOffers,
    fetchBusinessOffers,
    fetchOfferDetail,
    fetchOfferTerms,
    fetchProfiles,
} from '@/integrations/supabase/offers';

export function useOfferTerms(businessId) {
    const { data, loading, error, refetch } = useLoader(() => fetchOfferTerms(businessId), businessId, Boolean(businessId));
    return { terms: data?.terms ?? null, loading: Boolean(businessId) && loading, error, refetch };
}

export function useBusinessOffers(businessId) {
    const { data, loading, error, refetch } = useLoader(
        () => fetchBusinessOffers(businessId),
        businessId,
        Boolean(businessId)
    );
    return {
        offers: data?.offers ?? [],
        versions: data?.versions ?? [],
        loading: Boolean(businessId) && loading,
        error,
        refetch,
    };
}

export function useOfferDetail(offerId, { admin = false } = {}) {
    const { data, loading, error, refetch } = useLoader(
        async () => {
            const detail = await fetchOfferDetail(offerId, { admin });
            if (!admin || !detail.offer) return detail;
            // Quem enviou, aceitou e decidiu: nomes só para a análise do admin.
            const ids = [
                detail.offer.business?.owner_id,
                detail.offer.created_by,
                ...detail.versions.map((version) => version.financial_accepted_by),
                ...detail.reviews.map((review) => review.actor_id),
            ];
            const { profiles } = await fetchProfiles(ids);
            return { ...detail, profiles };
        },
        `${offerId}:${admin}`,
        Boolean(offerId)
    );
    return {
        offer: data?.offer ?? null,
        versions: data?.versions ?? [],
        reviews: data?.reviews ?? [],
        profiles: data?.profiles ?? {},
        loading,
        error,
        refetch,
    };
}

export function useAdminOffers() {
    const { data, loading, error, refetch } = useLoader(fetchAdminOffers, 'admin-offers');
    return { offers: data?.offers ?? [], versions: data?.versions ?? [], loading, error, refetch };
}
