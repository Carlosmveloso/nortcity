import { Check, Send } from 'lucide-react';
import { useState } from 'react';

function ShareButton({ title, text, url, className = 'border border-dark-ocean/15 text-dark-ocean' }) {
    const [copied, setCopied] = useState(false);

    async function handleShare() {
        const shareUrl = url ?? window.location.href;

        if (navigator.share) {
            try {
                await navigator.share({ title, text, url: shareUrl });
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
            <button
                type="button"
                onClick={handleShare}
                className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${className}`}
            >
                {copied ? <Check size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                {copied ? 'Link copiado' : 'Compartilhar'}
            </button>
            <span className="sr-only" role="status">
                {copied ? 'Link copiado para a área de transferência' : ''}
            </span>
        </>
    );
}

export default ShareButton;
