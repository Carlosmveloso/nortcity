import { Check, Send, Waves } from 'lucide-react';
import { useState } from 'react';

function BeachCard({ beach }) {
    const [copied, setCopied] = useState(false);

    async function handleShare(event) {
        event.preventDefault();
        const shareUrl = `${window.location.origin}/mapa#${beach.id}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${beach.name} — Farol Pitimbu`,
                    text: beach.description,
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

            <button
                type="button"
                onClick={handleShare}
                aria-label={`Compartilhar ${beach.name}`}
                className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-dark-ocean shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            >
                {copied ? <Check size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            </button>
            <span className="sr-only" role="status">
                {copied ? 'Link copiado para a área de transferência' : ''}
            </span>

            <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="font-head text-lg font-semibold text-foreground">{beach.name}</h3>
                <p className="text-sm text-foreground/80">{beach.description}</p>
                {beach.subDescription && <p className="text-sm text-foreground/80">{beach.subDescription}</p>}
            </div>
        </article>
    );
}

export default BeachCard;
