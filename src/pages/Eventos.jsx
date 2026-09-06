import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { events, eventCategories } from '../data/events';
import EventItem from '../components/ui/EventItem';
import Reveal from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

function Eventos() {
    usePageMeta(staticPageMeta('/eventos'));

    const [activeCategory, setActiveCategory] = useState('');

    const results = useMemo(() => {
        const filtered = events.filter((event) => !activeCategory || event.category === activeCategory);
        return [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    }, [activeCategory]);

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Eventos</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Agenda</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        Agenda de eventos em Pitimbu
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Festas, celebrações e programação cultural para não perder nada.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveCategory('')}
                            aria-pressed={activeCategory === ''}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                activeCategory === '' ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                            }`}
                        >
                            Todos
                        </button>
                        {eventCategories.map((category) => (
                            <button
                                key={category}
                                type="button"
                                onClick={() => setActiveCategory(activeCategory === category ? '' : category)}
                                aria-pressed={activeCategory === category}
                                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                    activeCategory === category
                                        ? 'bg-turquoise text-sand'
                                        : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {results.length > 0 ? (
                        <div className="mt-6 flex flex-col gap-4">
                            {results.map((event, index) => (
                                <Reveal key={event.id} delay={index * 60}>
                                    <EventItem event={event} />
                                </Reveal>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-3xl border border-dashed border-dark-ocean/20 p-10 text-center">
                            <p className="text-dark-ocean/70">Nenhum evento encontrado para essa categoria.</p>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}

export default Eventos;
