import {
    Check,
    ChevronRight,
    Clock,
    Globe,
    Images,
    Map,
    MapPin,
    MessageCircle,
    Phone,
    Send,
    Star,
    Store,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaInstagram } from 'react-icons/fa6';
import BusinessCard from '../components/ui/BusinessCard';
import Reveal from '../components/ui/Reveal';
import {
    categoryLabel,
    findBusinessBySlug,
    findRelatedBusinesses,
    toWhatsappLink,
} from '../lib/business';
import NotFound from './NotFound';

// Recursos que dependem de dados que ainda não temos (galeria, horários, coordenadas,
// avaliações). Ficam listados de forma honesta em vez de exibir conteúdo fabricado.
const upcomingFeatures = [
    { icon: Clock, label: 'Horário de funcionamento' },
    { icon: Images, label: 'Galeria de fotos' },
    { icon: Map, label: 'Localização no mapa' },
    { icon: Star, label: 'Avaliações de visitantes' },
];

function NegocioPerfil() {
    const { slug } = useParams();
    const business = findBusinessBySlug(slug);
    const [copied, setCopied] = useState(false);

    if (!business) {
        return <NotFound />;
    }

    const related = findRelatedBusinesses(business);
    const primaryCategory = business.categories[0];
    const label = categoryLabel(primaryCategory);

    async function handleShare() {
        const shareUrl = `${window.location.origin}/negocio/${business.id}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${business.name} — Farol Pitimbu`,
                    text: business.description,
                    url: shareUrl,
                });
            } catch {
                // usuário fechou o menu de compartilhamento sem escolher nada
            }
            return;
        }

        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav
                        aria-label="Breadcrumb"
                        className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-card/70"
                    >
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <Link
                            to={`/explorar?categoria=${primaryCategory}`}
                            className="notranslate hover:text-card"
                            translate="no"
                        >
                            {label}
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">{business.name}</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">
                        {business.subcategory}
                    </p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        {business.name}
                    </h1>
                    {business.description && (
                        <p className="mt-2 max-w-2xl text-card/80">{business.description}</p>
                    )}
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
                    <div className="flex flex-col gap-6 lg:col-span-2">
                        <div className="h-64 w-full overflow-hidden rounded-3xl bg-sand-dark sm:h-80">
                            {business.image ? (
                                <img
                                    src={business.image}
                                    alt={business.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-dark-ocean/30">
                                    <Store size={56} aria-hidden="true" />
                                </div>
                            )}
                        </div>

                        <div className="rounded-3xl bg-card p-6 shadow-sm">
                            <h2 className="font-head text-xl font-bold text-foreground">Sobre</h2>
                            <p className="mt-3 text-foreground/80">
                                {business.description ??
                                    `${business.name} faz parte do guia de ${label.toLowerCase()} de Pitimbu.`}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {business.categories.map((slug) => (
                                    <span
                                        key={slug}
                                        className="notranslate rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold text-turquoise"
                                        translate="no"
                                    >
                                        {categoryLabel(slug)}
                                    </span>
                                ))}
                                {business.subcategory && (
                                    <span className="rounded-full bg-sand-dark px-3 py-1 text-xs font-semibold text-dark-ocean">
                                        {business.subcategory}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-dashed border-dark-ocean/20 p-6">
                            <h2 className="font-head text-lg font-bold text-foreground">
                                Em breve nesta página
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Estamos coletando mais informações sobre os negócios de Pitimbu.
                            </p>
                            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                                {upcomingFeatures.map((feature) => (
                                    <li
                                        key={feature.label}
                                        className="flex items-center gap-2 text-sm text-dark-ocean/70"
                                    >
                                        <feature.icon
                                            size={16}
                                            className="shrink-0 text-turquoise"
                                            aria-hidden="true"
                                        />
                                        {feature.label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <aside className="flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-sm lg:h-fit lg:sticky lg:top-24">
                        <h2 className="font-head text-xl font-bold text-foreground">Contato</h2>

                        {business.address && (
                            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                <MapPin size={16} className="mt-0.5 shrink-0 text-turquoise" aria-hidden="true" />
                                {business.address}
                            </p>
                        )}

                        <a
                            href={`tel:${business.phone.replace(/\D/g, '')}`}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-primary py-3 text-sm text-muted"
                        >
                            <Phone size={16} aria-hidden="true" />
                            {business.phone}
                        </a>

                        <a
                            href={toWhatsappLink(business.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-whatsapp-green py-3 text-sm font-semibold text-white"
                        >
                            <MessageCircle size={18} aria-hidden="true" />
                            Conversar no WhatsApp
                        </a>

                        {business.instagram && (
                            <a
                                href={`https://instagram.com/${business.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-sand-dark py-3 text-sm font-semibold text-dark-ocean"
                            >
                                <FaInstagram size={18} aria-hidden="true" />@{business.instagram}
                            </a>
                        )}

                        {business.website && (
                            <a
                                href={`https://${business.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-sand-dark py-3 text-sm font-semibold text-dark-ocean"
                            >
                                <Globe size={18} aria-hidden="true" />
                                {business.website}
                            </a>
                        )}

                        <button
                            type="button"
                            onClick={handleShare}
                            className="flex w-full items-center justify-center gap-2 rounded-full border border-dark-ocean/15 py-3 text-sm font-semibold text-dark-ocean"
                        >
                            {copied ? <Check size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                            {copied ? 'Link copiado' : 'Compartilhar'}
                        </button>
                        <span className="sr-only" role="status">
                            {copied ? 'Link copiado para a área de transferência' : ''}
                        </span>
                    </aside>
                </div>

                {related.length > 0 && (
                    <div className="container mx-auto mt-12 max-w-5xl">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="font-head text-2xl font-bold text-foreground">
                                Outros em {label}
                            </h2>
                            <Link
                                to={`/explorar?categoria=${primaryCategory}`}
                                className="flex items-center gap-1 text-sm font-semibold text-turquoise"
                            >
                                Ver todos
                                <ChevronRight size={16} aria-hidden="true" />
                            </Link>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {related.map((item, index) => (
                                <Reveal key={item.id} delay={index * 60} className="h-full">
                                    <BusinessCard business={item} />
                                </Reveal>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </>
    );
}

export default NegocioPerfil;
