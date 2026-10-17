import { ArrowLeft, LogIn, Mail, Lock, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import HoneypotField from '../components/HoneypotField';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';
import { useAuth } from '../hooks/useAuth';
import {
    authErrorCode,
    authErrorMessage,
    confirmationError,
    confirmationRedirectUrl,
} from '../lib/authFeedback';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white py-3 pr-4 pl-11 text-dark-ocean focus:border-turquoise focus:outline-none';

function Entrar() {
    usePageMeta(staticPageMeta('/entrar'));

    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading: authLoading } = useAuth();
    const redirectTo = location.state?.from ?? '/';
    const returningFromConfirmation =
        new URLSearchParams(location.search).get('confirmacao') === '1';

    const [mode, setMode] = useState('signIn');
    const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
    const [honeypot, setHoneypot] = useState('');
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle');
    const [formError, setFormError] = useState('');
    const [confirmacaoPendente, setConfirmacaoPendente] = useState(false);
    const [confirmationEmail, setConfirmationEmail] = useState('');
    const [callbackError] = useState(
        () =>
            confirmationError(location.search, location.hash) ??
            location.state?.confirmationError ??
            null,
    );
    const [resendStatus, setResendStatus] = useState('idle');
    const [resendMessage, setResendMessage] = useState('');
    const [resendAvailableAt, setResendAvailableAt] = useState(0);

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (mode === 'signUp' && !formData.fullName.trim())
            nextErrors.fullName = 'Informe seu nome.';
        const email = formData.email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            nextErrors.email = 'Informe um e-mail válido.';
        if (!formData.password || formData.password.length < 6)
            nextErrors.password = 'A senha precisa ter pelo menos 6 caracteres.';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        if (mode === 'signUp' && honeypot) {
            // Bot: finge sucesso sem criar conta de verdade.
            navigate(redirectTo, { replace: true });
            return;
        }

        setFormError('');
        setConfirmacaoPendente(false);
        setStatus('loading');
        try {
            const { data, error } =
                mode === 'signIn'
                    ? await supabase.auth.signInWithPassword({
                          email,
                          password: formData.password,
                      })
                    : await supabase.auth.signUp({
                          email,
                          password: formData.password,
                          options: {
                              data: { full_name: formData.fullName.trim() },
                              emailRedirectTo: confirmationRedirectUrl(window.location.origin),
                          },
                      });

            if (error) {
                setFormError(authErrorMessage(error));
                if (authErrorCode(error) === 'email_not_confirmed') {
                    setConfirmacaoPendente(true);
                    setConfirmationEmail(email);
                }
                return;
            }

            // Sem sessão, oriente a confirmação sem afirmar que uma conta foi
            // criada: o Supabase também pode ocultar cadastros duplicados.
            if (!data?.session) {
                setConfirmacaoPendente(true);
                setConfirmationEmail(email);
                setResendAvailableAt(Date.now() + 60_000);
                return;
            }

            navigate(redirectTo, { replace: true });
        } catch (error) {
            setFormError(authErrorMessage(error));
        } finally {
            setStatus('idle');
        }
    };

    const resendConfirmation = async () => {
        const email = formData.email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setErrors((prev) => ({
                ...prev,
                email: 'Informe seu e-mail para reenviar a confirmação.',
            }));
            return;
        }
        if (Date.now() < resendAvailableAt) {
            setResendMessage('Aguarde um minuto após o último pedido antes de reenviar.');
            return;
        }
        setResendStatus('loading');
        setResendMessage('');
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
                options: { emailRedirectTo: confirmationRedirectUrl(window.location.origin) },
            });
            if (error) {
                setResendStatus('error');
                setResendMessage(authErrorMessage(error));
                return;
            }
            setResendAvailableAt(Date.now() + 60_000);
            setResendStatus('success');
            setResendMessage(
                'Se houver uma conta aguardando confirmação para esse e-mail, você receberá um novo link. Confira também o spam e use o e-mail mais recente.',
            );
        } catch (error) {
            setResendStatus('error');
            setResendMessage(authErrorMessage(error));
        }
    };

    if (returningFromConfirmation && !callbackError && authLoading) {
        return (
            <p role="status" className="min-h-screen bg-background px-6 py-32 text-center">
                Verificando confirmação…
            </p>
        );
    }

    if (returningFromConfirmation && !callbackError && user) {
        return (
            <section className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 py-32 text-center">
                <h1 className="font-head text-3xl font-bold text-dark-ocean">Acesso confirmado</h1>
                <p className="max-w-md text-dark-ocean/80">
                    Sua sessão está ativa. Você já pode acessar sua área e acompanhar seu negócio.
                </p>
                <Link
                    to="/meu-negocio"
                    className="rounded-full bg-blue-primary px-6 py-3 font-semibold text-sand"
                >
                    Ir para Meu Negócio
                </Link>
            </section>
        );
    }

    return (
        <section className="flex min-h-screen items-center justify-center bg-background px-4 py-28 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
                <Link
                    to="/"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-dark-ocean/70"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Voltar
                </Link>

                <div className="rounded-3xl bg-card p-6 shadow-sm sm:p-8">
                    <h1 className="font-head text-2xl font-bold text-foreground">
                        {mode === 'signIn' ? 'Entrar' : 'Criar conta'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {mode === 'signIn'
                            ? 'Acesse sua conta do Farol Pitimbu.'
                            : 'Crie sua conta para salvar favoritos e cadastrar seu negócio.'}
                    </p>

                    {location.state?.reason && !callbackError && (
                        <p role="status" className="mt-5 rounded-2xl bg-turquoise/10 px-4 py-3 text-sm font-semibold text-ocean">
                            {location.state.reason}
                        </p>
                    )}

                    {callbackError && (
                        <p
                            role="alert"
                            className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
                            {authErrorMessage({ code: callbackError })}
                        </p>
                    )}
                    {returningFromConfirmation && !callbackError && !user && (
                        <p
                            role="status"
                            className="mt-5 rounded-2xl bg-sand px-4 py-3 text-sm text-dark-ocean"
                        >
                            Entre com seu e-mail e senha para continuar. Se o e-mail ainda não
                            estiver confirmado, solicite outro link abaixo.
                        </p>
                    )}
                    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
                        <HoneypotField
                            value={honeypot}
                            onChange={(e) => setHoneypot(e.target.value)}
                        />
                        {mode === 'signUp' && (
                            <div>
                                <label
                                    htmlFor="entrar-nome"
                                    className="mb-1.5 block text-sm font-semibold text-foreground"
                                >
                                    Nome
                                </label>
                                <div className="relative">
                                    <User
                                        size={18}
                                        className="absolute top-1/2 left-4 -translate-y-1/2 text-dark-ocean/50"
                                        aria-hidden="true"
                                    />
                                    <input
                                        id="entrar-nome"
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(event) =>
                                            updateField('fullName', event.target.value)
                                        }
                                        placeholder="Seu nome"
                                        className={inputClasses}
                                    />
                                </div>
                                {errors.fullName && (
                                    <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
                                )}
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="entrar-email"
                                className="mb-1.5 block text-sm font-semibold text-foreground"
                            >
                                E-mail
                            </label>
                            <div className="relative">
                                <Mail
                                    size={18}
                                    className="absolute top-1/2 left-4 -translate-y-1/2 text-dark-ocean/50"
                                    aria-hidden="true"
                                />
                                <input
                                    id="entrar-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(event) => updateField('email', event.target.value)}
                                    placeholder="voce@email.com"
                                    className={inputClasses}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                            )}
                        </div>

                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label
                                    htmlFor="entrar-password"
                                    className="block text-sm font-semibold text-foreground"
                                >
                                    Senha
                                </label>
                                {mode === 'signIn' && (
                                    <span className="text-sm text-turquoise">
                                        Esqueci minha senha
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <Lock
                                    size={18}
                                    className="absolute top-1/2 left-4 -translate-y-1/2 text-dark-ocean/50"
                                    aria-hidden="true"
                                />
                                <input
                                    id="entrar-password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(event) =>
                                        updateField('password', event.target.value)
                                    }
                                    placeholder="••••••••"
                                    className={inputClasses}
                                />
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>

                        {confirmacaoPendente && (
                            <p
                                role="status"
                                className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm text-dark-ocean"
                            >
                                <strong className="font-semibold">Confirme seu e-mail.</strong>{' '}
                                Confira a caixa de entrada e o spam de{' '}
                                <strong className="font-semibold">{confirmationEmail}</strong>. Abra
                                o link de confirmação mais recente para ativar sua conta. Se você já
                                confirmou antes, tente entrar com sua senha.
                            </p>
                        )}

                        {formError && (
                            <p
                                role="alert"
                                className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
                            >
                                {formError}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                        >
                            <LogIn size={18} aria-hidden="true" />
                            {status === 'loading'
                                ? 'Enviando...'
                                : mode === 'signIn'
                                  ? 'Entrar'
                                  : 'Criar conta'}
                        </button>
                    </form>

                    {(confirmacaoPendente || callbackError || returningFromConfirmation) && (
                        <div className="mt-5 border-t border-sand-dark pt-4">
                            <p className="text-sm text-dark-ocean/80">
                                Para receber outro link, confira o e-mail preenchido acima.
                            </p>
                            <button
                                type="button"
                                disabled={resendStatus === 'loading' || status === 'loading'}
                                onClick={resendConfirmation}
                                className="mt-3 font-semibold text-dark-ocean underline disabled:opacity-60"
                            >
                                {resendStatus === 'loading'
                                    ? 'Reenviando…'
                                    : 'Reenviar confirmação'}
                            </button>
                            {resendMessage && (
                                <p
                                    role={resendStatus === 'error' ? 'alert' : 'status'}
                                    className="mt-3 text-sm text-dark-ocean"
                                >
                                    {resendMessage}
                                </p>
                            )}
                        </div>
                    )}

                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        {mode === 'signIn' ? (
                            <>
                                Ainda não tem conta?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode('signUp');
                                        setConfirmacaoPendente(false);
                                        setFormError('');
                                    }}
                                    className="font-semibold text-turquoise"
                                >
                                    Cadastre-se
                                </button>
                            </>
                        ) : (
                            <>
                                Já tem conta?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode('signIn');
                                        setConfirmacaoPendente(false);
                                        setFormError('');
                                    }}
                                    className="font-semibold text-turquoise"
                                >
                                    Entrar
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </section>
    );
}

export default Entrar;
