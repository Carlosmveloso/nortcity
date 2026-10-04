import { ChevronRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import BusinessCard from '../components/ui/BusinessCard';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

function Favoritos() {
    usePageMeta(staticPageMeta('/favoritos'));
    const { user } = useAuth();
    const { businesses, loading, error, reload } = useFavorites();

    return (
        <section className="min-h-screen bg-background px-4 pt-28 pb-20 sm:px-6 lg:px-8 lg:pt-32">
            <div className="container mx-auto max-w-3xl">
                <nav
                    aria-label="Breadcrumb"
                    className="mb-4 flex items-center gap-1.5 text-sm text-dark-ocean/60"
                >
                    <Link to="/" className="hover:text-dark-ocean">
                        Início
                    </Link>
                    <ChevronRight size={14} aria-hidden="true" />
                    <span className="text-dark-ocean">Favoritos</span>
                </nav>
                <p className="text-sm font-bold tracking-wide text-turquoise uppercase">
                    Seus salvos
                </p>
                <h1 className="mt-2 font-head text-3xl font-extrabold text-dark-ocean md:text-4xl">
                    Favoritos
                </h1>
                <p className="mt-2 text-dark-ocean/70">
                    Seus lugares preferidos, salvos na sua conta. Apenas negócios publicados
                    aparecem aqui.
                </p>

                {loading ? (
                    <p role="status" className="mt-12">
                        Carregando seus favoritos…
                    </p>
                ) : !user ? (
                    <div className="mt-12 rounded-3xl bg-card p-8 text-center">
                        <h2 className="font-head text-xl font-bold">
                            Entre para ver seus favoritos
                        </h2>
                        <p className="mt-3 text-dark-ocean/70">
                            Salve os negócios que gostar e encontre-os aqui em qualquer dispositivo.
                        </p>
                        <Link
                            to="/entrar"
                            state={{ from: '/favoritos' }}
                            className="mt-6 inline-flex rounded-full bg-blue-primary px-6 py-3 font-bold text-sand"
                        >
                            Entrar na minha conta
                        </Link>
                    </div>
                ) : error ? (
                    <div className="mt-12 rounded-3xl bg-card p-8">
                        <p role="alert">{error}</p>
                        <button
                            type="button"
                            onClick={reload}
                            className="mt-4 rounded-full bg-blue-primary px-6 py-3 font-bold text-sand"
                        >
                            Tentar novamente
                        </button>
                    </div>
                ) : businesses.length ? (
                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {businesses.map((business) => (
                            <BusinessCard key={business.businessId} business={business} />
                        ))}
                    </div>
                ) : (
                    <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-dark-ocean/20 px-6 py-16 text-center">
                        <Heart size={28} className="text-turquoise" aria-hidden="true" />
                        <h2 className="font-head text-lg font-semibold">
                            Você ainda não tem favoritos publicados
                        </h2>
                        <p className="max-w-sm text-dark-ocean/70">
                            Toque no coração de um negócio para salvá-lo. Se ele sair do ar,
                            aparecerá novamente quando for republicado.
                        </p>
                        <Link
                            to="/explorar"
                            className="mt-2 inline-flex rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                        >
                            Explorar Pitimbu
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}

export default Favoritos;
