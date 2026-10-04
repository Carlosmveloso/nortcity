import { Heart, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';

export default function FavoriteButton({ business, variant = 'icon' }) {
    const { user } = useAuth();
    const { ids, pending, loading, error: loadError, setFavorite, reload } = useFavorites();
    const [error, setError] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const saved = ids.has(business.businessId);
    const saving = pending.has(business.businessId);
    const label = loadError
        ? 'Tentar carregar favoritos novamente'
        : `${saved ? 'Remover' : 'Salvar'} ${business.name} ${saved ? 'dos' : 'nos'} favoritos`;

    async function handleClick() {
        setError('');
        if (!user) {
            navigate('/entrar', {
                state: { from: location.pathname + location.search + location.hash },
            });
            return;
        }
        if (loadError) {
            reload();
            return;
        }
        try {
            await setFavorite(business, !saved);
        } catch (failure) {
            setError(failure.message);
        }
    }

    return (
        <div
            className={
                variant === 'icon'
                    ? 'absolute top-3 left-3 z-20 max-w-[calc(100%-5rem)]'
                    : 'relative'
            }
        >
            <button
                type="button"
                aria-label={label}
                aria-pressed={saved}
                aria-busy={saving}
                disabled={loading || saving}
                onClick={handleClick}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white text-dark-ocean shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquoise disabled:opacity-60 ${variant === 'icon' ? 'h-11 w-11' : 'w-full border border-dark-ocean/15 px-4 py-3'}`}
            >
                {loadError ? (
                    <RotateCw size={18} aria-hidden="true" />
                ) : (
                    <Heart size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
                )}
                {variant !== 'icon' &&
                    (loadError
                        ? 'Tentar novamente'
                        : saving
                          ? 'Salvando…'
                          : saved
                            ? 'Remover dos favoritos'
                            : 'Salvar nos favoritos')}
            </button>
            {error && (
                <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </p>
            )}
        </div>
    );
}
