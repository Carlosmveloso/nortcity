import { useContext } from 'react';
import { FavoritesContext } from '@/contexts/favorites-context';

export function useFavorites() {
    const context = useContext(FavoritesContext);
    if (!context) throw new Error('useFavorites precisa ser usado dentro de <FavoritesProvider>.');
    return context;
}
