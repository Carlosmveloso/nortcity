import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const MY_BUSINESS_SELECT = `
    id, slug, name, subcategory, description, address, neighborhood, service_area,
    phone, whatsapp, email, website, instagram, facebook, price_range, status,
    cover_image, submitted_at, moderation_reason, moderated_at, created_at,
    business_categories(is_primary, categories(id, slug, name))
`;

function mapRow(row) {
    if (!row) return null;
    const links = [...(row.business_categories ?? [])].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary)
    );
    return {
        ...row,
        categoryIds: links.map((link) => link.categories.id),
        categoryNames: links.map((link) => link.categories.name),
        primaryCategoryId: links.find((link) => link.is_primary)?.categories.id ?? null,
    };
}

async function fetchMyBusiness(userId) {
    const { data, error } = await supabase
        .from('businesses')
        .select(MY_BUSINESS_SELECT)
        .eq('owner_id', userId)
        .maybeSingle();

    if (error) return { error };
    if (!data) return { business: null, changeRequest: null };

    const { data: requests } = await supabase
        .from('business_change_requests')
        .select('id, status, changes, category_ids, primary_category_id, cover_image_path, created_at, decision_reason, decided_at')
        .eq('business_id', data.id)
        .eq('status', 'pending')
        .maybeSingle();

    return { business: mapRow(data), changeRequest: requests ?? null };
}

// Área Meu Negócio: o dono lê o próprio cadastro por RLS (nada de RPC), em
// qualquer status. Conta sem negócio devolve business = null — é o estado
// vazio que leva ao cadastro, não um erro.
export function useMyBusiness() {
    const { user, loading: authLoading } = useAuth();
    const [state, setState] = useState({ business: null, changeRequest: null, loading: true, error: null });

    const userId = user?.id ?? null;

    const refetch = useCallback(async () => {
        if (!userId) {
            setState({ business: null, changeRequest: null, loading: false, error: null });
            return;
        }
        const result = await fetchMyBusiness(userId);
        setState({
            business: result.business ?? null,
            changeRequest: result.changeRequest ?? null,
            loading: false,
            error: result.error ?? null,
        });
    }, [userId]);

    useEffect(() => {
        if (authLoading) return undefined;

        let cancelled = false;

        async function load() {
            if (!userId) {
                if (!cancelled) setState({ business: null, changeRequest: null, loading: false, error: null });
                return;
            }

            const result = await fetchMyBusiness(userId);
            if (cancelled) return;
            setState({
                business: result.business ?? null,
                changeRequest: result.changeRequest ?? null,
                loading: false,
                error: result.error ?? null,
            });
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [authLoading, userId]);

    return { ...state, loading: state.loading || authLoading, refetch };
}
