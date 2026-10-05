import { supabase } from './client';
import { BUSINESS_SELECT, mapBusinessRow } from '@/hooks/mapBusinessRow';

const PAGE_SIZE = 500;

/** Carrega a lista completa, incluindo vínculos cujo negócio não é mais público. */
export async function fetchFavorites(userId) {
    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
            .from('business_favorites')
            .select(`business_id, businesses(${BUSINESS_SELECT}, status)`)
            .eq('user_id', userId)
            .order('business_id')
            .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(
            ...data.map((row) => ({
                businessId: row.business_id,
                business:
                    row.businesses?.status === 'active' ? mapBusinessRow(row.businesses) : null,
            })),
        );
        if (data.length < PAGE_SIZE) return rows;
    }
}

/** Operação explícita: repetir um pedido nunca inverte o estado desejado. */
export async function persistFavorite(userId, businessId, saved) {
    const { error } = saved
        ? await supabase
              .from('business_favorites')
              .insert({ user_id: userId, business_id: businessId })
        : await supabase
              .from('business_favorites')
              .delete()
              .eq('user_id', userId)
              .eq('business_id', businessId);
    // Outra aba pode ter salvo o mesmo negócio; a PK garante uma única relação.
    if (error && !(saved && error.code === '23505')) throw error;
}
