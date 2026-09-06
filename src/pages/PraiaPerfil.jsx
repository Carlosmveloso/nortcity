import { ChevronRight, Map } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { beaches } from '../data/beaches';
import Reveal from '../components/ui/Reveal';
import ShareButton from '../components/ui/ShareButton';
import { usePageMeta } from '../hooks/usePageMeta';
import { beachShare } from '../lib/share';
import { beachPageMeta, notFoundMeta } from '../lib/siteMeta';
import NotFound from './NotFound';

function PraiaPerfil() {
    const { slug } = useParams();
    const beach = beaches.find((item) => item.id === slug) ?? null;

    usePageMeta(beach ? beachPageMeta(beach) : notFoundMeta());

    if (!beach) {
        return <NotFound />;
    }

    const share = beachShare(beach);

    return (
        <>
            <section className="relative overflow-hidden bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                {beach.image && (
                    <img
                        src={beach.image}
                        alt=""
                        aria-hidden="true"
                        loading="eager"
                        className="absolute inset-0 h-full w-full object-cover opacity-20"
                    />
                )}
                <div className="container relative mx-auto max-w-5xl">
                    <nav
                        aria-label="Breadcrumb"
                        className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-card/70"
                    >
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <Link to="/mapa" className="hover:text-card">
                            Praias e Mapa
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">{beach.name}</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Praias de Pitimbu</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">{beach.name}</h1>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-3xl">
                    <div className="flex justify-end">
                        <ShareButton {...share} label={`Compartilhar ${beach.name}`} />
                    </div>

                    <Reveal>
                        <div className="mt-4 overflow-hidden rounded-3xl bg-card shadow-sm">
                            {beach.image && (
                                <img
                                    src={beach.image}
                                    alt={beach.name}
                                    loading="eager"
                                    className="h-64 w-full object-cover sm:h-96"
                                />
                            )}
                            <div className="flex flex-col gap-4 p-6 sm:p-8">
                                <p className="text-foreground/80">{beach.description}</p>
                                {beach.subDescription && (
                                    <p className="text-foreground/80">{beach.subDescription}</p>
                                )}
                            </div>
                        </div>
                    </Reveal>

                    <Link
                        to={`/mapa#${beach.id}`}
                        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand sm:w-auto"
                    >
                        <Map size={18} aria-hidden="true" />
                        Ver no mapa completo
                    </Link>
                </div>
            </section>
        </>
    );
}

export default PraiaPerfil;
