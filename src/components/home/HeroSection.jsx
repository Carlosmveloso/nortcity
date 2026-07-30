import { Search } from 'lucide-react';
import GlassButton from '../ui/GlassButton';

//* Primeira dobra da página

function HeroSection() {

    //Styles
    const heroImg = `
    bg-[linear-gradient(rgba(0,0,0,0.30),rgba(0,0,0,0.10)),url('/hero-beach1.jpeg')]
    bg-cover bg-center bg-no-repeat
    min-h-[700px]
    flex flex-col items-center justify-center
    shadow-xl`;
    const heroCta = `
    w-9/10 h-full
    py-4
    flex flex-col gap-7 items-center`;
    return (
        <>
            <section className={`${heroImg}`}>
                <section className={`${heroCta}`}>
                    <GlassButton>Tudo de Pitimbu em um só lugar!</GlassButton>
                    <h1 className="text-4xl font-head text-white text-center font-semibold text-shadow-lg">
                        Descubra Pitimbu com o{' '}
                        <span className="text-turquoise ">NortCity</span>
                    </h1>
                    <p className="text-white text-center text-lg/7 font-semibold">
                        Encontre passeios, gastronomia, hospedagem e serviços locais em um só lugar
                        !
                    </p>
                    <section className="w-full bg-white rounded-4xl p-2 flex flex-col md:flex-row gap-2">
                        <section className="flex p-3 bg-sand-dark/50 gap-3 text-dark-ocean rounded-full flex-grow-4">
                            <Search />
                            <input
                                className=" w-full"
                                type="text"
                                placeholder="O que você procura? ex: pousada, passeio de barco."
                            />
                        </section>
                        <button className="w-full sm:w-1/5 bg-turquoise p-3 rounded-3xl">
                            <p className="text-sand font-bold ">Buscar</p>
                        </button>
                    </section>
                    <section className="flex flex-wrap gap-2 py-3 justify-center">
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
