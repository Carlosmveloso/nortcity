import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Confirmação em <dialog> nativo: foco preso no modal, Esc fecha e o foco
 * volta ao botão que abriu. Com `messageMode = 'required'` o texto é
 * obrigatório antes de chamar `onConfirm`.
 *
 * `onConfirm(message)` deve devolver `{ error }`; com erro o diálogo continua
 * aberto e mostra `errorMessage(error)`.
 */
export default function ActionDialog({
    open,
    title,
    description,
    confirmLabel,
    tone = 'primary',
    messageMode = 'none',
    messageLabel = 'Mensagem',
    messageHint,
    messagePlaceholder,
    onConfirm,
    onClose,
    errorMessage,
}) {
    const ref = useRef(null);
    const ids = useId();
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            setMessage('');
            setError('');
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        } else if (!open && dialog.open) {
            if (typeof dialog.close === 'function') dialog.close();
            else dialog.removeAttribute('open');
        }
    }, [open]);

    const confirm = async (event) => {
        event.preventDefault();
        if (busy) return;
        if (messageMode === 'required' && !message.trim()) {
            setError(`Preencha: ${messageLabel.toLowerCase()}.`);
            return;
        }
        setBusy(true);
        setError('');
        const result = await onConfirm(message.trim());
        setBusy(false);
        if (result?.error) {
            setError(errorMessage ? errorMessage(result.error) : 'Não foi possível concluir.');
            return;
        }
        onClose();
    };

    const confirmClass =
        tone === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-turquoise text-sand hover:bg-ocean';

    return (
        <dialog
            ref={ref}
            aria-labelledby={`${ids}-title`}
            aria-describedby={description ? `${ids}-description` : undefined}
            onCancel={(event) => {
                event.preventDefault();
                if (!busy) onClose();
            }}
            className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl bg-card p-0 text-foreground shadow-xl backdrop:bg-dark-ocean/50"
        >
            {open && (
                <form onSubmit={confirm} className="flex flex-col gap-4 p-6">
                    <h2 id={`${ids}-title`} className="font-head text-xl font-bold">
                        {title}
                    </h2>
                    {description && (
                        <div id={`${ids}-description`} className="text-sm text-dark-ocean/80">
                            {description}
                        </div>
                    )}
                    {messageMode !== 'none' && (
                        <div>
                            <label htmlFor={`${ids}-message`} className="mb-1.5 block text-sm font-semibold">
                                {messageLabel}
                                {messageMode === 'optional' && <span className="font-normal text-dark-ocean/60"> (opcional)</span>}
                            </label>
                            <textarea
                                id={`${ids}-message`}
                                rows={4}
                                autoFocus
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                placeholder={messagePlaceholder}
                                maxLength={2000}
                                aria-required={messageMode === 'required'}
                                aria-invalid={Boolean(error) && messageMode === 'required' && !message.trim()}
                                aria-describedby={[messageHint && `${ids}-hint`, error && `${ids}-error`].filter(Boolean).join(' ') || undefined}
                                className="w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 text-dark-ocean focus:border-turquoise focus:outline-none focus-visible:ring-2 focus-visible:ring-turquoise/40"
                            />
                            {messageHint && (
                                <p id={`${ids}-hint`} className="mt-1 text-xs text-dark-ocean/60">
                                    {messageHint}
                                </p>
                            )}
                        </div>
                    )}
                    {error && (
                        <p id={`${ids}-error`} role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="rounded-full px-5 py-2.5 text-sm font-semibold text-dark-ocean/80 hover:bg-sand-dark/60 disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            autoFocus={messageMode === 'none'}
                            aria-busy={busy}
                            className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-70 ${confirmClass}`}
                        >
                            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {confirmLabel}
                        </button>
                    </div>
                </form>
            )}
        </dialog>
    );
}
