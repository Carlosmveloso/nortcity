import { MapPin, Phone, MessageCircle, Globe, Store } from 'lucide-react';
import { FaInstagram } from 'react-icons/fa6';

function toWhatsappLink(phone) {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/55${digits}`;
}

function BusinessCard({ business }) {
    return (
        <article className="flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm">
            <div className="h-40 w-full overflow-hidden bg-sand-dark">
                {business.image ? (
                    <img
                        src={business.image}
                        alt={business.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-dark-ocean/30">
                        <Store size={40} aria-hidden="true" />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="font-head text-lg font-semibold text-foreground">{business.name}</h3>
                        <span className="text-sm text-muted-foreground">{business.subcategory}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold text-turquoise">
                        {business.category}
                    </span>
                </div>

                {business.description && <p className="text-sm text-foreground/80">{business.description}</p>}

                {business.address && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={16} className="shrink-0 text-turquoise" aria-hidden="true" />
                        {business.address}
                    </p>
                )}

                <div className="mt-2 flex flex-col gap-2">
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
