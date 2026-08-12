import { Waves, Trees, Palette, UtensilsCrossed, MapPin } from 'lucide-react';

const typeConfig = {
    praia: { label: 'Praia', icon: Waves },
    natureza: { label: 'Natureza', icon: Trees },
    cultura: { label: 'Cultura', icon: Palette },
    gastronomia: { label: 'Gastronomia', icon: UtensilsCrossed },
};

function AttractionCard({ attraction }) {
    const config = typeConfig[attraction.type] ?? typeConfig.praia;
    const Icon = config.icon;

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-36 w-full items-center justify-center bg-gradient-ocean">
                <Icon className="h-12 w-12 text-card/90" aria-hidden="true" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
                <span
                    className="notranslate w-fit rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold tracking-wide text-turquoise uppercase"
                    translate="no"
                >
                    {config.label}
                </span>
                <h3 className="font-head text-lg font-semibold text-foreground">{attraction.name}</h3>
                <p className="text-sm text-foreground/80">{attraction.description}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={16} className="shrink-0 text-turquoise" aria-hidden="true" />
                    {attraction.location}
                </p>
            </div>
        </article>
    );
}

export default AttractionCard;
