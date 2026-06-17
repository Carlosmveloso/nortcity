import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import GlassButton from '../ui/GlassButton';

//* Primeira dobra da página

function HeroSection() {
    //Functions
    const [categoriesOpen, setCategoriesOpen] = useState(false);

    //Styles
    const heroImg = `
    bg-[linear-gradient(rgba(0,0,0,0.30),rgba(0,0,0,0.10)),url('/hero-beach1.jpeg')]
    bg-cover bg-center bg-no-repeat
    max-h-[700px]
    flex flex-col items-center
    shadow-lg`;
    const heroCta = `
    w-9/10 h-dvh
    py-4
    flex flex-col gap-7 items-center`;
    return (
        <>
            <section className={`${heroImg}`}>
                <section className={`${heroCta}`}>
                    <GlassButton>Tudo de Pitimbu em um só lugar!</GlassButton>
                    <h1 className="text-4xl text-white text-center font-semibold">
                        Descubra Pitimbu com o{' '}
                        <span className="text-turquoise ">Farol Pitimbu</span>
                    </h1>
                    <p className="text-white text-center text-lg/7 font-semibold">
                        Encontre passeios, gastronomia, hospedagem e serviços locais em um só lugar
                        !
                    </p>
                    <section className="w-full bg-white rounded-4xl p-2 flex flex-col gap-2">
                        <section className="flex p-3 bg-sand-dark/50 gap-3 text-dark-ocean rounded-full">
                            <Search />
                            <input
                                className=" w-full"
                                type="text"
                                placeholder="O que você procura? ex: pousada, passeio de barco."
                            />
                        </section>
                        <section className="flex justify-between p-4 bg-sand-dark/50 rounded-4xl text-dark-ocean">
                            <section
                                className={`${categoriesOpen ? 'grid w-full grid-cols-2 gap-y-1' : 'w-full flex justify-between'}`}
                            >
                                <p className="self-start">Serviços</p>
                                {/* // className={`${categoriesOpen ? 'block row-start-2 col-start-1' : 'hidden'}`} */}
                                <ul
                                    className={`${categoriesOpen ? 'block row-start-2 col-start-1 menu  rounded-box w-56' : 'hidden'}`}
                                >
                                    <li>
                                        <a>Negócios</a>
                                    </li>
                                    <li>
                                        <a>Profissionais</a>
                                    </li>
                                    <li>
                                        <a>Prestadores de serviços</a>
                                    </li>
                                </ul>
                                <button
                                    className="row-start-1 col-start-2 justify-self-end self-start justify-items-end"
                                    onClick={() => setCategoriesOpen(!categoriesOpen)}
                                >
                                    {categoriesOpen ? <ChevronDown /> : <ChevronRight />}
                                </button>
                            </section>
                            <button></button>
                        </section>
                        <button className="w-full bg-turquoise p-3 rounded-3xl">
                            <p className="text-sand font-bold ">Buscar</p>
                        </button>
                    </section>
                    <section className="flex flex-wrap gap-2 mt-3 justify-center">
                        <GlassButton>Comer</GlassButton>
                        <GlassButton>Passeios</GlassButton>
                        <GlassButton>Hospedagem</GlassButton>
                        <GlassButton>Serviços</GlassButton>
                        <GlassButton>Profissionais</GlassButton>
                    </section>
                </section>
            </section>
        </>
    );
}

export default HeroSection;
