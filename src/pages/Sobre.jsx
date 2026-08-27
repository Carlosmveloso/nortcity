import { ChevronRight, Compass, HeartHandshake, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { statsSection } from '../data/statsSection';
import StatsCard from '../components/ui/StatsCard';
import Reveal from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

const pillars = [
    {
        icon: Compass,
        title: 'Facilitar a descoberta',
        description: 'Reunir passeios, gastronomia, hospedagem e serviços de Pitimbu em um só lugar.',
    },
    {
        icon: HeartHandshake,
        title: 'Fortalecer o comércio local',
        description: 'Dar visibilidade gratuita para pequenos negócios e profissionais da região.',
    },
    {
        icon: MapPin,
        title: 'Valorizar Pitimbu',
        description: 'Mostrar o litoral sul da Paraíba para quem visita e para quem vive por aqui.',
    },
];

function Sobre() {
    usePageMeta(staticPageMeta('/sobre'));

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Sobre nós</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Sobre nós</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        O guia digital do litoral sul da Paraíba
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        O Farol Pitimbu nasceu para conectar turistas e moradores a tudo que Pitimbu tem a oferecer —
                        e para dar visibilidade a quem faz a cidade acontecer todos os dias.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <Reveal>
                        <h2 className="font-head text-2xl font-bold text-foreground">Nossa história</h2>
                        <p className="mt-3 max-w-3xl text-foreground/80">
                            Pitimbu tem praias, trilhas e uma culinária que muita gente ainda descobre só de boca em
                            boca. Criamos o Farol Pitimbu para organizar essas informações num só lugar — e para que
                            negócios locais, muitos deles sem site próprio, tenham uma vitrine digital gratuita e
                            fácil de encontrar.
                        </p>
                    </Reveal>

                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
                        {pillars.map((pillar, index) => {
                            const Icon = pillar.icon;
                            return (
                                <Reveal key={pillar.title} delay={index * 80}>
                                    <div className="flex h-full flex-col gap-3 rounded-3xl bg-card p-6 shadow-sm">
                                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-turquoise/10 text-turquoise">
                                            <Icon size={22} aria-hidden="true" />
                                        </span>
                                        <h3 className="font-head font-semibold text-foreground">{pillar.title}</h3>
                                        <p className="text-sm text-muted-foreground">{pillar.description}</p>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-gradient-ocean py-16 md:py-24">
                <div className="flex flex-col gap-8 lg:flex-row lg:justify-evenly lg:px-10">
                    {statsSection.map((stat, index) => (
                        <Reveal key={`${stat.title}-${index}`} delay={index * 120}>
                            <StatsCard stat={stat} />
                        </Reveal>
                    ))}
                </div>
            </section>

            <section className="bg-background px-4 py-14 text-center sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-2xl">
                    <h2 className="font-head text-2xl font-bold text-foreground">Tem um negócio em Pitimbu?</h2>
                    <p className="mt-2 text-muted-foreground">
                        Cadastre gratuitamente e apareça para quem está buscando exatamente o que você oferece.
                    </p>
                    <Link
                        to="/cadastrar-negocio"
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                    >
                        Cadastrar meu negócio
                    </Link>
                </div>
            </section>
        </>
    );
}

export default Sobre;
