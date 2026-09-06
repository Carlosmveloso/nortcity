import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Fonte única de categorias: a tabela `categories`. O formulário público usava
// uma lista fixa em src/data/categoryLabels.js, então categoria criada pelo
// admin só aparecia para o próprio admin — quem cadastrava pelo site continuava
// vendo as nove antigas (CAT-04).
export function useCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const { data, error: queryError } = await supabase
                .from('categories')
                .select('id, slug, name, description, icon, order_index')
                .order('order_index', { ascending: true });

            if (cancelled) return;

            if (queryError) {
                setError(queryError);
                setLoading(false);
                return;
            }

            setCategories(data ?? []);
            setLoading(false);
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return { categories, loading, error };
}
