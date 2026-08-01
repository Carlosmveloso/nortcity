import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const navLinks = [
    { label: 'Explorar', to: '/explorar' },
    { label: 'Categorias', to: '/categorias' },
    { label: 'Atrações', to: '/atracoes' },
    { label: 'Eventos', to: '/eventos' },
    { label: 'Mapa', to: '/mapa' },
    { label: 'Profissionais', to: '/profissionais' },
    { label: 'Blog', to: '/blog' },
    { label: 'Planos', to: '/planos' },
];

function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="fixed inset-x-0 top-0 z-50 w-full bg-sand/95 shadow-md backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                <Logo showText={true} />

                <nav className="hidden xl:flex xl:items-center" aria-label="Menu principal">
                    <ul className="flex items-center gap-6">
                        {navLinks.map((link) => (
                            <li key={link.to}><Link to={link.to}>{link.label}</Link></li>
                        ))}
                    </ul>
                </nav>

                <Link
                    to="/cadastrar-negocio"
                    className="hidden shrink-0 rounded-full bg-turquoise px-5 py-3 text-center whitespace-nowrap xl:block"
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
                    {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            <div className={`border-ocean/10 border-t bg-white xl:hidden ${menuOpen ? 'block' : 'hidden'}`}>
                <nav className="px-4 py-3 sm:px-6" aria-label="Menu principal mobile">
                    <ul className="flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <li key={link.to} className="px-3 py-3">
                                <Link to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</Link>
                            </li>
                        ))}
                    </ul>
                    <Link
                        to="/cadastrar-negocio"
                        onClick={() => setMenuOpen(false)}
                        className="mx-3 mt-2 block rounded-full bg-turquoise px-5 py-3 text-center whitespace-nowrap"
                    >
                        Cadastrar meu negócio
                    </Link>
                </nav>
            </div>
        </header>
    );
}

export default Navbar;
