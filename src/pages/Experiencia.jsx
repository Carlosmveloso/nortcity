import { ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { experiencePages } from '../data/experiencePages';
import ExperienceListItem from '../components/ui/ExperienceListItem';
import Reveal from '../components/ui/Reveal';
import ComingSoon from '../components/ui/ComingSoon';
import ShareButton from '../components/ui/ShareButton';
import SEO from '../components/SEO';

function Experiencia() {
    const { slug } = useParams();
    const experience = experiencePages[slug];

    if (!experience) {
        return (
            <ComingSoon
                title="Experiência não encontrada"
                description="Essa experiência ainda não está disponível."
            />
        );
    }

    const { eyebrow, title, description, heroImg, items, mapLink } = experience;

    return (
        <>
            <SEO title={title} description={description} />
            <section className="relative overflow-hidden bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                {heroImg && (
                    <img
                        src={heroImg}
                        alt=""
                        aria-hidden="true"
                        loading="eager"
                        className="absolute inset-0 h-full w-full object-cover opacity-20"
                    />
                )}
                <div className="container relative mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">{title}</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">{eyebrow}</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">{title}</h1>
                    <p className="mt-2 max-w-2xl text-card/80">{description}</p>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
                <div className="container mx-auto max-w-3xl">
                    <div className="flex justify-end">
                        <ShareButton
                            title={`${title} — Farol Pitimbu`}
                            text={description}
                            url={`${window.location.origin}/experiencia/${slug}`}
                        />
                    </div>
                    <Reveal>
                        <ul className="mt-4 flex flex-col rounded-3xl bg-card p-4 shadow-sm sm:p-6 md:p-8">
                            {items.map((item, index) => (
                                <ExperienceListItem key={item.id} item={item} index={index + 1} />
                            ))}
                        </ul>
                    </Reveal>

                    {mapLink && (
                        <Link
                            to={mapLink}
                            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand sm:w-auto"
                        >
                            Ver no mapa completo
                        </Link>
                    )}
                </div>
            </section>
        </>
    );
}

export default Experiencia;
