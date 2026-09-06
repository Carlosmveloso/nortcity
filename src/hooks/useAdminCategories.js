import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function fetchCategories() {
    return supabase
        .from('categories')
        .select('id, slug, name, description, icon, image_url, featured, order_index')
        .order('order_index', { ascending: true });
}

export function useAdminCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        const { data, error: queryError } = await fetchCategories();

        if (queryError) {
            setError(queryError);
            setLoading(false);
            return;
        }

        setError(null);
        setCategories(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            const { data, error: queryError } = await fetchCategories();

            if (cancelled) return;

            if (queryError) {
                setError(queryError);
                setLoading(false);
                return;
            }

            setError(null);
            setCategories(data);
            setLoading(false);
        }

        load();

        return () => {
            cancelled = true;
        };
    }, []);

    const createCategory = useCallback(
        async (category) => {
            const { error: insertError } = await supabase.from('categories').insert(category);
            if (insertError) return { error: insertError };
            await refetch();
            return { error: null };
        },
        [refetch]
    );

    const updateCategory = useCallback(
        async (id, patch) => {
            const { error: updateError } = await supabase.from('categories').update(patch).eq('id', id);
            if (updateError) return { error: updateError };
            await refetch();
            return { error: null };
        },
        [refetch]
    );

    const deleteCategory = useCallback(
        async (id) => {
            const { error: deleteError } = await supabase.from('categories').delete().eq('id', id);
            if (deleteError) return { error: deleteError };
            await refetch();
            return { error: null };
        },
        [refetch]
    );

    return { categories, loading, error, createCategory, updateCategory, deleteCategory };
}
