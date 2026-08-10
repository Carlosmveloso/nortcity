import { Heart, Menu, User, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const navLinks = [
    { label: 'Explorar', to: '/explorar' },
    { label: 'Categorias', to: '/categorias' },
    { label: 'Praias e Mapa', to: '/mapa' },
    { label: 'Informações', to: '/guia-local' },
    { label: 'Contato', to: '/contato' },
    { label: 'Planos', to: '/planos', hidden: true },
];

function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="fixed inset-x-0 top-0 z-50 w-full bg-sand/95 shadow-md backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-400 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 xl:grid xl:grid-cols-[1fr_auto_1fr]">
                <div className="flex items-center">
                    <Logo showText={true} />
                </div>

                <nav className="hidden xl:flex xl:items-center xl:justify-center" aria-label="Menu principal">
                    <ul className="flex items-center gap-8">
                        {navLinks.map((link) => (
                            <li key={link.to} className={link.hidden ? 'hidden' : undefined}><Link to={link.to}>{link.label}</Link></li>
                        ))}
                    </ul>
                </nav>

                <div className="flex items-center gap-2 xl:justify-self-end">
                    <Link
                        to="/favoritos"
                        aria-label="Favoritos"
                        className="hidden h-10 w-10 items-center justify-center rounded-full text-dark-ocean hover:bg-sand-dark/50"
                    >
                        <Heart className="h-5 w-5" aria-hidden="true" />
                    </Link>
                    <Link
                        to="/entrar"
                        aria-label="Entrar na conta"
                        className="hidden h-10 w-10 items-center justify-center rounded-full text-dark-ocean hover:bg-sand-dark/50"
                    >
                        <User className="h-5 w-5" aria-hidden="true" />
                    </Link>

                    <Link
                        to="/cadastrar-negocio"
                        className="hidden shrink-0 rounded-full bg-turquoise px-5 py-3 text-center whitespace-nowrap"
                    >
                        Cadastrar meu negócio
                    </Link>

                    <button
                        type="button"
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full xl:hidden"
                        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                        aria-expanded={menuOpen}
                    >
                        <span className={`inline-flex transition-transform duration-300 ${menuOpen ? 'rotate-90' : 'rotate-0'}`}>
                            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </span>
                    </button>
                </div>
            </div>

            <div
                aria-hidden={!menuOpen}
                className={`border-ocean/10 overflow-hidden border-t bg-white transition-all duration-300 ease-in-out xl:hidden ${
                    menuOpen ? 'max-h-160 opacity-100' : 'max-h-0 border-t-0 opacity-0'
                }`}
            >
                <nav className="px-4 py-3 sm:px-6" aria-label="Menu principal mobile">
                    <ul className="flex flex-col gap-1">
                        {navLinks.map((link, index) => (
                            <li
                                key={link.to}
                                className={`px-3 py-3 transition-all duration-300 ${link.hidden ? 'hidden' : ''} ${
                                    menuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                                }`}
                                style={{ transitionDelay: menuOpen ? `${index * 40}ms` : '0ms' }}
                            >
                                <Link to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</Link>
                            </li>
                        ))}
                    </ul>

                    <ul className="border-ocean/10 mt-2 hidden flex-col gap-1 border-t pt-2">
                        {[
                            { label: 'Favoritos', to: '/favoritos', icon: Heart },
                            { label: 'Entrar na conta', to: '/entrar', icon: User },
                        ].map((link, index) => (
                            <li
                                key={link.to}
                                className={`px-3 py-3 transition-all duration-300 ${
                                    menuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                                }`}
                                style={{ transitionDelay: menuOpen ? `${(navLinks.length + index) * 40}ms` : '0ms' }}
                            >
                                <Link
                                    to={link.to}
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center gap-2 text-dark-ocean/70"
                                >
                                    <link.icon className="h-4 w-4" aria-hidden="true" />
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <Link
                        to="/cadastrar-negocio"
                        onClick={() => setMenuOpen(false)}
                        className={`mx-3 mt-2 hidden rounded-full bg-turquoise px-5 py-3 text-center whitespace-nowrap transition-all duration-300 ${
                            menuOpen ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                        }`}
                        style={{ transitionDelay: menuOpen ? `${(navLinks.length + 2) * 40}ms` : '0ms' }}
                    >
                        Cadastrar meu negócio
                    </Link>
                </nav>
            </div>
        </header>
    );
}

export default Navbar;
