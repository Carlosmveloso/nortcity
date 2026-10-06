import { useCallback, useEffect, useState } from 'react';
import {
    fetchAdminOffers,
    fetchBusinessOffers,
    fetchOfferDetail,
    fetchOfferTerms,
    fetchProfiles,
} from '@/integrations/supabase/offers';

/**
 * Carrega dados assíncronos com cancelamento e recarga explícita. `key`
 * identifica o recurso; `loader` deve ser estável para a mesma chave.
 *
 * `loading` sai da comparação entre a requisição atual e a última resposta,
 * sem setState síncrono no efeito. Numa recarga do mesmo recurso os dados
 * anteriores continuam visíveis; em outro recurso, não.
 */
function useLoader(loader, key, enabled = true) {
    const [version, setVersion] = useState(0);
    const [state, setState] = useState({ key: null, request: null, data: null, error: null });
    const request = `${key}#${version}`;

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        loader().then(
            (result) => {
                if (!cancelled) setState({ key, request, data: result, error: result?.error ?? null });
            },
            (error) => {
                if (!cancelled) setState({ key, request, data: null, error });
            }
        );
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `request` resume as dependências do loader.
    }, [request, enabled]);

    const refetch = useCallback(() => setVersion((value) => value + 1), []);
    const sameResource = state.key === key;
    return {
        data: sameResource ? state.data : null,
        error: sameResource ? state.error : null,
        loading: enabled && state.request !== request,
        refetch,
    };
}

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
