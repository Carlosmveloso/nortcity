import { Waves } from 'lucide-react';
import { beachShare } from '../../lib/share';
import ShareButton from './ShareButton';

function BeachCard({ beach }) {
    const share = beachShare(beach);

    return (
        <article
            id={beach.id}
            className="group relative flex h-full scroll-mt-24 flex-col overflow-hidden rounded-3xl bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
            <div className="h-72 w-full overflow-hidden bg-sand-dark">
                {beach.image ? (
                    <img
                        src={beach.image}
                        alt={beach.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-ocean text-card/90">
                        <Waves className="h-12 w-12" aria-hidden="true" />
                    </div>
                )}
            </div>

            <ShareButton {...share} variant="icon" label={`Compartilhar ${beach.name}`} />

            <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="font-head text-lg font-semibold text-foreground">{beach.name}</h3>
                <p className="text-sm text-foreground/80">{beach.description}</p>
                {beach.subDescription && <p className="text-sm text-foreground/80">{beach.subDescription}</p>}
            </div>
        </article>
    );
}

export default BeachCard;
