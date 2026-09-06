import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { publishReviewImage } from '@/lib/uploadBusinessCoverImage';

const SELECT = `
    id, business_id, status, changes, base_values, category_ids, primary_category_id,
    cover_image_path, created_at,
    businesses(name, slug, status, cover_image)
`;

function fetchRequests() {
    return supabase
        .from('business_change_requests')
        .select(SELECT)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
}

export function useAdminChangeRequests() {
    const [state, setState] = useState({ requests: [], loading: true, error: null });

    const refetch = useCallback(async () => {
        const { data, error } = await fetchRequests();
        setState({ requests: data ?? [], loading: false, error: error ?? null });
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const { data, error } = await fetchRequests();
            if (cancelled) return;
            setState({ requests: data ?? [], loading: false, error: error ?? null });
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    // Aprovar com capa nova: o arquivo sai de review/ para um caminho público
    // ANTES da RPC. Se a cópia falhar, nada é aplicado — a ficha pública
    // continua com o conteúdo aprovado anterior.
    const review = useCallback(
        async (request, action, reason) => {
            let coverUrl = null;

            if (action === 'approve' && request.cover_image_path) {
                const { url, error: copyError } = await publishReviewImage(
                    request.business_id,
                    request.cover_image_path
                );
                if (copyError) return { error: { message: 'cover_publish_failed' } };
                coverUrl = url;
            }

            const { error } = await supabase.rpc('review_business_change_request', {
                p_request_id: request.id,
                p_action: action,
                p_reason: reason ?? null,
                p_cover_public_url: coverUrl,
            });

            if (error) return { error };
            await refetch();
            return { error: null };
        },
        [refetch]
    );

    return { ...state, refetch, review };
}
