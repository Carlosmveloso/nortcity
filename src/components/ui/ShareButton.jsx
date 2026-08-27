import { Check, Send } from 'lucide-react';
import { useState } from 'react';

const PILL_CLASS = 'gap-2 rounded-full px-5 py-2.5 text-sm font-semibold';
const ICON_CLASS =
    'absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/90 text-dark-ocean shadow-md backdrop-blur-sm transition-colors hover:bg-white';

function ShareButton({ title, message, url, label, variant = 'pill', className = '' }) {
    const [copied, setCopied] = useState(false);
    const isIcon = variant === 'icon';

    async function handleShare(event) {
        // Os cards têm um link "esticado" por cima do artigo inteiro.
        event.preventDefault();

        if (navigator.share) {
            try {
                await navigator.share({ title, text: message, url });
            } catch {
                // usuário fechou o menu de compartilhamento sem escolher nada
            }
            return;
        }

        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const baseClass = isIcon ? ICON_CLASS : PILL_CLASS;
    const fallbackClass = isIcon ? '' : 'border border-dark-ocean/15 text-dark-ocean';

    return (
        <>
            <button
                type="button"
                onClick={handleShare}
                aria-label={label}
                className={`flex items-center justify-center ${baseClass} ${className || fallbackClass}`}
            >
                {copied ? <Check size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                {!isIcon && (copied ? 'Mensagem copiada' : 'Compartilhar')}
            </button>
            <span className="sr-only" role="status">
                {copied ? 'Mensagem copiada para a área de transferência' : ''}
            </span>
        </>
    );
}

export default ShareButton;
