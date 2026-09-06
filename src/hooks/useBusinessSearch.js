import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const SEARCH_PAGE_SIZE = 12;

function mapSearchRow(row) {
    return {
        id: row.slug,
        businessId: row.id,
        name: row.name,
        categories: row.categories ?? [],
        categoryNames: row.category_names ?? [],
        primaryCategory: row.primary_category,
        subcategory: row.subcategory,
        description: row.description,
        address: row.address,
        serviceArea: row.service_area,
        neighborhood: row.neighborhood,
        phone: row.phone,
        whatsapp: row.whatsapp,
        email: row.email,
        instagram: row.instagram,
        website: row.website,
        image: row.cover_image,
    };
}

// Ordenação, relevância e paginação vêm do servidor (RPC search_businesses):
// paginar no cliente só ordenava a página já baixada, e a lista inteira vinha
// sem ORDER BY nenhum.
export function useBusinessSearch({ query, category, neighborhood, priceRange, page = 0 }) {
    const [state, setState] = useState({ results: [], total: 0, loading: true, error: null });

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const { data, error: rpcError } = await supabase.rpc('search_businesses', {
                p_query: query || null,
                p_category_slug: category || null,
                p_neighborhood: neighborhood || null,
                p_price_range: priceRange || null,
                p_limit: SEARCH_PAGE_SIZE,
                p_offset: page * SEARCH_PAGE_SIZE,
            });

            if (cancelled) return;

            if (rpcError) {
                setState({ results: [], total: 0, loading: false, error: rpcError });
                return;
            }

            setState({
                results: (data ?? []).map(mapSearchRow),
                total: data && data.length > 0 ? Number(data[0].total_count) : 0,
                loading: false,
                error: null,
            });
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [query, category, neighborhood, priceRange, page]);

    return state;
}

export function useNeighborhoods() {
    const [neighborhoods, setNeighborhoods] = useState([]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const { data } = await supabase.rpc('business_neighborhoods');
            if (!cancelled) setNeighborhoods(data ?? []);
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return neighborhoods;
}
