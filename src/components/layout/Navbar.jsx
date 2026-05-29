//* Menu do site
import { Menu, X, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import Logo from './Logo';

function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [openDropDown, setOpenDropDown] = useState(null);

    return (
        <>
            <header className="bg-sand w-full shadow-md">
                <section className="mx-auto w-full max-w-7xl xl:flex xl:items-center xl:justify-between xl:p-2">
                    <section className="flex min-h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                        <Logo showText={true} />
                        <button
                            type="button"
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full xl:hidden"
                            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                            aria-expanded={menuOpen}
                        >
                            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </section>
                    <section
                        className={`border-ocean/10 w-full border-t bg-white px-4 sm:px-6 lg:px-8 xl:block xl:w-auto xl:border-t-0 xl:bg-transparent xl:py-0 ${
                            menuOpen ? 'block' : 'hidden'
                        }`}
                    >
                        <nav className="w-full">
                            <ul className="flex flex-col gap-1 xl:flex-row xl:items-center xl:justify-end xl:gap-6">
                                <li className="px-3 py-3 xl:p-0">Explorar</li>

                                <li className="relative px-3 py-3 xl:p-0">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenDropDown(
                                                openDropDown === 'services' ? null : 'services',
                                            )
                                        }
                                        className="flex items-center gap-1"
                                    >
                                        Serviços{' '}
                                        {openDropDown === 'services' ? (
                                            <Minus className="w-3" />
                                        ) : (
                                            <Plus className="w-3" />
                                        )}
                                    </button>
                                    <ul
                                        className={`mt-3 space-y-3 xl:absolute xl:top-full xl:left-0 xl:z-50 xl:mt-4 xl:w-56 xl:rounded-md xl:bg-white xl:p-4 xl:shadow-lg ${openDropDown === 'services' ? 'block' : 'hidden'}`}
                                    >
                                        <li className="my-3">Negócios</li>
                                        <li className="my-3">Profissionais</li>
                                        <li className="my-3">Prestadores de Serviços</li>
                                    </ul>
                                </li>

                                <li className="relative px-3 py-3 xl:p-0">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenDropDown(openDropDown === 'info' ? null : 'info')
                                        }
                                        className="flex items-center gap-1 whitespace-nowrap"
                                    >
                                        Informações úteis{' '}
                                        {openDropDown === 'info' ? (
                                            <Minus className="w-3" />
                                        ) : (
                                            <Plus className="w-3" />
                                        )}
                                    </button>
                                    <ul
                                        className={`mt-3 space-y-3 xl:absolute xl:top-full xl:left-0 xl:z-50 xl:mt-4 xl:w-56 xl:rounded-md xl:bg-white xl:p-4 xl:shadow-lg ${openDropDown === 'info' ? 'block' : 'hidden'}`}
                                    >
                                        <li className="my-3">Tábua de maré</li>
                                        <li className="my-3">Feiras livres</li>
                                        <li className="my-3">Telefones úteis</li>
                                        <li className="my-3">Eventos</li>
                                    </ul>
                                </li>

                                <li className="px-3 py-3 whitespace-nowrap xl:p-0">
                                    Praias e Regiões
                                </li>
                                <li className="px-3 py-3 xl:p-0">Sobre</li>
                                <li className="px-3 py-3 xl:p-0">Contato</li>
                                <li className="px-3 py-3 xl:p-0">Planos</li>
                                <li className="px-3 py-3 xl:p-0">
                                    <a className="bg-turquoise block w-full rounded-full px-5 py-3 text-center whitespace-nowrap sm:w-auto">
                                        Cadastrar meu negócio
                                    </a>
                                </li>
                            </ul>
                        </nav>
                    </section>
                </section>
            </header>
        </>
    );
}

export default Navbar;
