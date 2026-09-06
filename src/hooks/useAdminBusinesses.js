import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_BUSINESS_SELECT = `
    id, slug, name, subcategory, description, address, neighborhood, service_area,
    phone, whatsapp, email, website, instagram, facebook, status, cover_image,
    owner_id, created_at, submitted_at, moderation_reason, moderation_note,
    moderated_at, duplicate_candidates, duplicate_reviewed_at,
    business_categories(is_primary, categories(id, slug, name))
`;

function mapAdminRow(row) {
    const links = [...(row.business_categories ?? [])].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary)
    );
    return {
        ...row,
        categories: links.map((link) => link.categories.name),
        categoryIds: links.map((link) => link.categories.id),
        primaryCategoryId: links.find((link) => link.is_primary)?.categories.id ?? null,
        // Suspeita de duplicidade só é "pendente de decisão" enquanto ninguém
        // olhou: depois de revisada, o alerta some sem apagar o histórico.
        duplicateAlert:
            (row.duplicate_candidates ?? []).length > 0 && !row.duplicate_reviewed_at
                ? row.duplicate_candidates
                : null,
    };
}

function fetchAdminBusinesses() {
    return supabase.from('businesses').select(ADMIN_BUSINESS_SELECT).order('created_at', { ascending: false });
}

// Toda escrita passa por RPC: negócio e categorias mudam na mesma transação, e
// a autorização é checada no banco, não pelo fato de a tela ser /admin.
export function useAdminBusinesses() {
    const [state, setState] = useState({ businesses: [], loading: true, error: null });

    const refetch = useCallback(async () => {
        const { data, error } = await fetchAdminBusinesses();
        if (error) {
            setState((prev) => ({ ...prev, loading: false, error }));
            return;
        }
        setState({ businesses: data.map(mapAdminRow), loading: false, error: null });
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const { data, error } = await fetchAdminBusinesses();
            if (cancelled) return;
            if (error) {
                setState((prev) => ({ ...prev, loading: false, error }));
                return;
            }
            setState({ businesses: data.map(mapAdminRow), loading: false, error: null });
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const run = useCallback(
        async (fn, args) => {
            const { data, error } = await supabase.rpc(fn, args);
            if (error) return { error };
            await refetch();
            return { error: null, data };
        },
        [refetch]
    );

    return {
        ...state,
        refetch,
        moderate: (id, action, reason, note) =>
            run('moderate_business', { p_business_id: id, p_action: action, p_reason: reason ?? null, p_note: note ?? null }),
        updateBusiness: (id, payload, categoryIds, primaryCategoryId) =>
            run('admin_update_business', {
                p_business_id: id,
                p_payload: payload,
                p_category_ids: categoryIds ?? null,
                p_primary_category_id: primaryCategoryId ?? null,
            }),
        createBusiness: (payload, categoryIds, primaryCategoryId, status) =>
            run('admin_create_business', {
                p_payload: payload,
                p_category_ids: categoryIds,
                p_primary_category_id: primaryCategoryId ?? null,
                p_status: status,
            }),
        deleteBusiness: (id) => run('admin_delete_business', { p_business_id: id }),
        linkOwner: (id, ownerId) => run('admin_link_business_owner', { p_business_id: id, p_owner_id: ownerId }),
        unlinkOwner: (id) => run('admin_unlink_business_owner', { p_business_id: id }),
        resolveDuplicate: (originalId, duplicateId) =>
            run('admin_resolve_duplicate', { p_original_id: originalId, p_duplicate_id: duplicateId }),
        markDuplicateReviewed: (id) => run('admin_mark_duplicate_reviewed', { p_business_id: id }),
    };
}
