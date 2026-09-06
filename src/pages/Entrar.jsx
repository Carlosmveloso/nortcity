import { ArrowLeft, LogIn, Mail, Lock, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import HoneypotField from '../components/HoneypotField';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white py-3 pr-4 pl-11 text-dark-ocean focus:border-turquoise focus:outline-none';

const AUTH_ERROR_MESSAGES = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Já existe uma conta com este e-mail.',
};

function translateAuthError(message) {
    return AUTH_ERROR_MESSAGES[message] ?? 'Não foi possível concluir. Tente novamente.';
}

function Entrar() {
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = location.state?.from ?? '/';

    const [mode, setMode] = useState('signIn');
    const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
    const [honeypot, setHoneypot] = useState('');
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle');
    const [formError, setFormError] = useState('');

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (mode === 'signUp' && !formData.fullName.trim()) nextErrors.fullName = 'Informe seu nome.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) nextErrors.email = 'Informe um e-mail válido.';
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
        setStatus('loading');

        const { error } =
            mode === 'signIn'
                ? await supabase.auth.signInWithPassword({
                      email: formData.email,
                      password: formData.password,
                  })
                : await supabase.auth.signUp({
                      email: formData.email,
                      password: formData.password,
                      options: { data: { full_name: formData.fullName } },
                  });

        if (error) {
            setFormError(translateAuthError(error.message));
            setStatus('idle');
            return;
        }

        setStatus('idle');
        navigate(redirectTo, { replace: true });
    };

    return (
        <section className="flex min-h-screen items-center justify-center bg-background px-4 py-28 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
                <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-dark-ocean/70">
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
                            : 'Crie sua conta para cadastrar seu negócio.'}
                    </p>

                    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
                        <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                        {mode === 'signUp' && (
                            <div>
                                <label htmlFor="entrar-nome" className="mb-1.5 block text-sm font-semibold text-foreground">
                                    Nome
                                </label>
                                <div className="relative">
                                    <User size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dark-ocean/50" aria-hidden="true" />
                                    <input
                                        id="entrar-nome"
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(event) => updateField('fullName', event.target.value)}
                                        placeholder="Seu nome"
                                        className={inputClasses}
                                    />
                                </div>
                                {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                            </div>
                        )}

                        <div>
                            <label htmlFor="entrar-email" className="mb-1.5 block text-sm font-semibold text-foreground">
                                E-mail
                            </label>
                            <div className="relative">
                                <Mail size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dark-ocean/50" aria-hidden="true" />
                                <input
                                    id="entrar-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(event) => updateField('email', event.target.value)}
                                    placeholder="voce@email.com"
                                    className={inputClasses}
                                />
                            </div>
                            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                        </div>

                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label htmlFor="entrar-password" className="block text-sm font-semibold text-foreground">
                                    Senha
                                </label>
                                {mode === 'signIn' && <span className="text-sm text-turquoise">Esqueci minha senha</span>}
                            </div>
                            <div className="relative">
                                <Lock size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dark-ocean/50" aria-hidden="true" />
                                <input
                                    id="entrar-password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(event) => updateField('password', event.target.value)}
                                    placeholder="••••••••"
                                    className={inputClasses}
                                />
                            </div>
                            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                        </div>

                        {formError && (
                            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                        >
                            <LogIn size={18} aria-hidden="true" />
                            {status === 'loading' ? 'Enviando...' : mode === 'signIn' ? 'Entrar' : 'Criar conta'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        {mode === 'signIn' ? (
                            <>
                                Ainda não tem conta?{' '}
                                <button
                                    type="button"
                                    onClick={() => setMode('signUp')}
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
                                    onClick={() => setMode('signIn')}
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
