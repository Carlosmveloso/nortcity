import { ChevronRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

function Favoritos() {
    usePageMeta(staticPageMeta('/favoritos'));

    return (
        <section className="min-h-screen bg-background px-4 pt-28 pb-20 sm:px-6 lg:px-8 lg:pt-32">
            <div className="container mx-auto max-w-3xl">
                <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-dark-ocean/60">
                    <Link to="/" className="hover:text-dark-ocean">
                        Início
                    </Link>
                    <ChevronRight size={14} aria-hidden="true" />
                    <span className="text-dark-ocean">Favoritos</span>
                </nav>
                <p className="text-sm font-bold tracking-wide text-turquoise uppercase">Seus salvos</p>
                <h1 className="mt-2 font-head text-3xl font-extrabold text-dark-ocean md:text-4xl">Favoritos</h1>
                <p className="mt-2 text-dark-ocean/70">Tudo o que você marcou para não esquecer.</p>

                <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-dark-ocean/20 py-16 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
                        <Heart size={28} aria-hidden="true" />
                    </span>
                    <h2 className="font-head text-lg font-semibold text-dark-ocean">Nada por aqui ainda</h2>
                    <p className="max-w-sm text-dark-ocean/70">
                        Toque no coração em qualquer card para salvar aqui.
                    </p>
                    <Link
                        to="/explorar"
                        className="mt-2 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                    >
                        Explorar Pitimbu
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default Favoritos;
