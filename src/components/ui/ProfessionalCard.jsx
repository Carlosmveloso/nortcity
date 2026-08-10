import { Star, MapPin, MessageCircle } from 'lucide-react';

function toWhatsappLink(phone) {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/55${digits}`;
}

function initials(name) {
    return name
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function ProfessionalCard({ professional }) {
    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-ocean font-head text-lg font-bold text-card">
                        {initials(professional.name)}
                    </div>
                    <div>
                        <h3 className="font-head text-lg font-semibold text-foreground">{professional.name}</h3>
                        <span className="text-sm text-muted-foreground">{professional.role}</span>
                    </div>
                </div>

                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={16} className="shrink-0 text-turquoise" aria-hidden="true" />
                    {professional.location}
                </p>

                <p className="text-sm text-foreground/80">{professional.description}</p>

                <div className="flex flex-wrap gap-2">
                    {professional.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-sand-dark px-3 py-1 text-xs text-dark-ocean">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <Star size={16} className="fill-sun-yellow text-sun-yellow" aria-hidden="true" />
                        {professional.rating}
                        <span className="text-muted-foreground">({professional.reviews})</span>
                    </span>
                    <a
                        href={toWhatsappLink(professional.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-full bg-whatsapp-green px-4 py-2 text-sm font-semibold text-white"
                        aria-label={`Contatar ${professional.name} pelo WhatsApp`}
                    >
                        <MessageCircle size={16} aria-hidden="true" />
                        Contatar
                    </a>
                </div>
            </div>
        </article>
    );
}

export default ProfessionalCard;
