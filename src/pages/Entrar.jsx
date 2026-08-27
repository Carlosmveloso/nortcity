import { ArrowLeft, LogIn, Mail, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

const inputClasses =
    'w-full rounded-2xl border border-sand-dark bg-white py-3 pr-4 pl-11 text-dark-ocean focus:border-turquoise focus:outline-none';

function Entrar() {
    usePageMeta(staticPageMeta('/entrar'));

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle');

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) nextErrors.email = 'Informe um e-mail válido.';
        if (!formData.password) nextErrors.password = 'Informe sua senha.';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setStatus('loading');
        setTimeout(() => setStatus('unavailable'), 900);
    };

    return (
        <section className="flex min-h-screen items-center justify-center bg-background px-4 py-28 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
                <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-dark-ocean/70">
                    <ArrowLeft size={16} aria-hidden="true" />
                    Voltar
                </Link>

                <div className="rounded-3xl bg-card p-6 shadow-sm sm:p-8">
                    <h1 className="font-head text-2xl font-bold text-foreground">Entrar</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta do Farol Pitimbu.</p>

                    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
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
                                <span className="text-sm text-turquoise">Esqueci minha senha</span>
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

                        {status === 'unavailable' && (
                            <p className="rounded-2xl bg-turquoise/10 px-4 py-3 text-sm text-turquoise">
                                O login com conta chega em breve — ainda estamos construindo essa parte da plataforma.
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="flex items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand disabled:opacity-70"
                        >
                            <LogIn size={18} aria-hidden="true" />
                            {status === 'loading' ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        Ainda não tem conta? <span className="font-semibold text-turquoise">Cadastre-se em breve</span>
                    </p>
                </div>
            </div>
        </section>
    );
}

export default Entrar;
