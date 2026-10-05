import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { fetchFavorites, persistFavorite } from '@/integrations/supabase/favorites';
import { FavoritesContext } from './favorites-context';

function AccountFavorites({ children, userId, authLoading }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(Boolean(userId));
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [pending, setPending] = useState(new Set());
    const busy = useRef(new Set());
    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!userId || authLoading) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const data = await fetchFavorites(userId);
                if (!cancelled) setRows(data);
            } catch {
                if (!cancelled)
                    setError('Não foi possível carregar seus favoritos. Tente novamente.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [userId, authLoading, revision]);

    async function setFavorite(business, saved) {
        const id = business.businessId;
        if (!userId || !id || loading || error || busy.current.has(id)) return;
        busy.current.add(id);
        setPending(new Set(busy.current));
        try {
            await persistFavorite(userId, id, saved);
            if (mounted.current)
                setRows((previous) =>
                    saved
                        ? [
                              ...previous.filter((row) => row.businessId !== id),
                              { businessId: id, business },
                          ]
                        : previous.filter((row) => row.businessId !== id),
                );
        } catch {
            throw new Error(
                saved
                    ? 'Não foi possível salvar este negócio. Tente novamente.'
                    : 'Não foi possível remover este favorito. Tente novamente.',
            );
        } finally {
            busy.current.delete(id);
            if (mounted.current) setPending(new Set(busy.current));
        }
    }

    const value = {
        businesses: rows
            .flatMap((row) => (row.business ? [row.business] : []))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        ids: new Set(rows.map((row) => row.businessId)),
        loading: authLoading || loading,
        error,
        pending,
        setFavorite,
        reload: () => setRevision((previous) => previous + 1),
    };
    return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function FavoritesProvider({ children }) {
    const { user, loading } = useAuth();
    // Remontar por conta impede que uma resposta antiga exponha a lista de outra sessão.
    return (
        <AccountFavorites key={user?.id ?? 'anon'} userId={user?.id} authLoading={loading}>
            {children}
        </AccountFavorites>
    );
}
