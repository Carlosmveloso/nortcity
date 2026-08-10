import { ChevronRight, Mail, MapPin, MessageCircle, Phone, Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import emailjs from '@emailjs/browser';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white px-4 py-3 text-dark-ocean focus:border-turquoise focus:outline-none';

function Contato() {
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [errors, setErrors] = useState({});
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState(false);

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validate = () => {
        const nextErrors = {};
        if (!formData.name.trim()) nextErrors.name = 'Informe seu nome.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) nextErrors.email = 'Informe um e-mail válido.';
        if (!formData.message.trim()) nextErrors.message = 'Escreva sua mensagem.';
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validate()) return;
        setSending(true);
        setSendError(false);
        try {
            await emailjs.send(
                import.meta.env.VITE_EMAILJS_SERVICE_ID,
                import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
                {
                    name: formData.name,
                    email: formData.email,
                    subject: formData.subject,
                    message: formData.message,
                },
                { publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY },
            );
            setSent(true);
        } catch {
            setSendError(true);
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Contato</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Fale conosco</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">Contato</h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Dúvidas, sugestões ou parcerias — estamos por aqui para ajudar.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
                <div className="container mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="flex flex-col gap-4 lg:col-span-1">
                        <div className="flex items-start gap-3 rounded-3xl bg-card p-5 shadow-sm">
                            <Mail size={20} className="mt-0.5 shrink-0 text-turquoise" aria-hidden="true" />
                            <div>
                                <p className="font-head font-semibold text-foreground">E-mail</p>
                                <p className="text-sm break-all text-muted-foreground">carloseduardomveloso@gmail.com</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-3xl bg-card p-5 shadow-sm">
                            <Phone size={20} className="mt-0.5 shrink-0 text-turquoise" aria-hidden="true" />
                            <div>
                                <p className="font-head font-semibold text-foreground">Telefone</p>
                                <p className="text-sm text-muted-foreground">(83) 99113-4990</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-3xl bg-card p-5 shadow-sm">
                            <MapPin size={20} className="mt-0.5 shrink-0 text-turquoise" aria-hidden="true" />
                            <div>
                                <p className="font-head font-semibold text-foreground">Localização</p>
                                <p className="text-sm text-muted-foreground">Pitimbu, Paraíba - Brasil</p>
                            </div>
                        </div>
                        <a
                            href="https://wa.me/5583991134990"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-full bg-whatsapp-green px-6 py-3 font-bold text-white"
                        >
                            <MessageCircle size={18} aria-hidden="true" />
                            Falar no WhatsApp
                        </a>
                    </div>

                    <div className="lg:col-span-2">
                        {sent ? (
                            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl bg-card p-10 text-center shadow-sm">
                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-turquoise/10 text-turquoise">
                                    <Check size={26} aria-hidden="true" />
                                </span>
                                <h2 className="font-head text-xl font-bold text-foreground">Mensagem enviada!</h2>
                                <p className="max-w-sm text-sm text-muted-foreground">
                                    Obrigado pelo contato, {formData.name}. Vamos responder assim que possível.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} noValidate className="rounded-3xl bg-card p-6 shadow-sm sm:p-8">
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="contato-name" className="mb-1.5 block text-sm font-semibold text-foreground">
                                            Nome
                                        </label>
                                        <input
                                            id="contato-name"
                                            type="text"
                                            value={formData.name}
                                            onChange={(event) => updateField('name', event.target.value)}
                                            className={inputClasses}
                                        />
                                        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="contato-email" className="mb-1.5 block text-sm font-semibold text-foreground">
                                            E-mail
                                        </label>
                                        <input
                                            id="contato-email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(event) => updateField('email', event.target.value)}
                                            className={inputClasses}
                                        />
                                        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                                    </div>
                                </div>
                                <div className="mt-5">
                                    <label htmlFor="contato-subject" className="mb-1.5 block text-sm font-semibold text-foreground">
                                        Assunto (opcional)
                                    </label>
                                    <input
                                        id="contato-subject"
                                        type="text"
                                        value={formData.subject}
                                        onChange={(event) => updateField('subject', event.target.value)}
                                        className={inputClasses}
                                    />
                                </div>
                                <div className="mt-5">
                                    <label htmlFor="contato-message" className="mb-1.5 block text-sm font-semibold text-foreground">
                                        Mensagem
                                    </label>
                                    <textarea
                                        id="contato-message"
                                        rows={5}
                                        value={formData.message}
                                        onChange={(event) => updateField('message', event.target.value)}
                                        className={inputClasses}
                                    />
                                    {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
                                </div>
                                {sendError && (
                                    <p className="mt-4 text-sm text-red-600">
                                        Não foi possível enviar. Tente novamente ou fale pelo WhatsApp.
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="mt-6 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                                >
                                    {sending ? 'Enviando...' : 'Enviar mensagem'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}

export default Contato;
