import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BUSINESS_SELECT, mapBusinessRow } from './mapBusinessRow';

async function loadRelated(mapped) {
    if (mapped.categories.length === 0) return [];

    const { data: categoryRows } = await supabase
        .from('business_categories')
        .select('business_id, categories!inner(slug)')
        .in('categories.slug', mapped.categories)
        .neq('business_id', mapped.businessId);

    if (!categoryRows || categoryRows.length === 0) return [];

    const relatedIds = [...new Set(categoryRows.map((row) => row.business_id))].slice(0, 3);

    const { data: relatedRows } = await supabase
        .from('businesses')
        .select(BUSINESS_SELECT)
        .in('id', relatedIds)
        .eq('status', 'active');

    return relatedRows ? relatedRows.map(mapBusinessRow) : [];
}

export function useBusiness(slug) {
    const [business, setBusiness] = useState(null);
    const [related, setRelated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setNotFound(false);
            setBusiness(null);
            setRelated([]);

            const { data, error } = await supabase
                .from('businesses')
                .select(BUSINESS_SELECT)
                .eq('slug', slug)
                .eq('status', 'active')
                .maybeSingle();

            if (cancelled) return;

            if (error || !data) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            const mapped = mapBusinessRow(data);
            setBusiness(mapped);

            const relatedBusinesses = await loadRelated(mapped);
            if (!cancelled) setRelated(relatedBusinesses);

            setLoading(false);
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    return { business, related, loading, notFound };
}
