import { Check, MapPin, Phone, MessageCircle, Globe, Send, Store } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaInstagram } from 'react-icons/fa6';
import { categoryLabel, toWhatsappLink } from '../../lib/business';

function BusinessCard({ business }) {
    const [copied, setCopied] = useState(false);

    async function handleShare(event) {
        event.preventDefault();
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
        <article
            id={business.id}
            className="group relative flex h-full scroll-mt-24 flex-col overflow-hidden rounded-3xl bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
            <div className="h-56 w-full overflow-hidden bg-sand-dark">
                {business.image ? (
                    <img
                        src={business.image}
                        alt={business.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-dark-ocean/30">
                        <Store size={40} aria-hidden="true" />
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={handleShare}
                aria-label={`Compartilhar ${business.name}`}
                className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-dark-ocean shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            >
                {copied ? <Check size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            </button>
            <span className="sr-only" role="status">
                {copied ? 'Link copiado para a área de transferência' : ''}
            </span>

            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="font-head text-lg font-semibold text-foreground">
                            {/* Link "esticado": cobre o card inteiro sem aninhar <a> dentro de <a>,
                                mantendo os botões de contato clicáveis via z-10. */}
                            <Link
                                to={`/negocio/${business.id}`}
                                className="transition-colors after:absolute after:inset-0 group-hover:text-turquoise"
                            >
                                {business.name}
                            </Link>
                        </h3>
                        <span className="text-sm text-muted-foreground">{business.subcategory}</span>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {business.categories.map((slug) => (
                            <span
                                key={slug}
                                className="rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold text-turquoise"
                            >
                                {categoryLabel(slug)}
                            </span>
                        ))}
                    </div>
                </div>

                {business.description && <p className="text-sm text-foreground/80">{business.description}</p>}

                {business.address && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={16} className="shrink-0 text-turquoise" aria-hidden="true" />
                        {business.address}
                    </p>
                )}

                <div className="relative z-10 mt-auto flex flex-col gap-2 pt-2">
                    <a
                        href={`tel:${business.phone.replace(/\D/g, '')}`}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-primary py-2.5 text-sm text-muted"
                    >
                        <Phone size={16} aria-hidden="true" />
                        {business.phone}
                    </a>
                    <div className="flex items-center gap-2">
                        <a
                            href={toWhatsappLink(business.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-1 items-center justify-center rounded-full bg-whatsapp-green p-2.5 text-white"
                            aria-label={`Contatar ${business.name} pelo WhatsApp`}
                        >
                            <MessageCircle size={18} aria-hidden="true" />
                        </a>
                        {business.instagram && (
                            <a
                                href={`https://instagram.com/${business.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-1 items-center justify-center rounded-full bg-sand-dark p-2.5 text-dark-ocean"
                                aria-label={`Instagram de ${business.name}`}
                            >
                                <FaInstagram size={18} aria-hidden="true" />
                            </a>
                        )}
                        {business.website && (
                            <a
                                href={`https://${business.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-1 items-center justify-center rounded-full bg-sand-dark p-2.5 text-dark-ocean"
                                aria-label={`Site de ${business.name}`}
                            >
                                <Globe size={18} aria-hidden="true" />
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}

export default BusinessCard;
