import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { attractions, attractionTypes } from '../data/attractions';
import AttractionCard from '../components/ui/AttractionCard';
import Reveal from '../components/ui/Reveal';

function Atracoes() {
    const [activeType, setActiveType] = useState('');

    const results = useMemo(
        () => attractions.filter((attraction) => !activeType || attraction.type === activeType),
        [activeType]
    );

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Atrações</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Turismo</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">Atrações em Pitimbu</h1>
                    <p className="mt-2 max-w-2xl text-card/80">Do mar às tradições: os lugares que fazem Pitimbu única.</p>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveType('')}
                            aria-pressed={activeType === ''}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                activeType === '' ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                            }`}
                        >
                            Todos
                        </button>
                        {attractionTypes.map((type) => (
                            <button
                                key={type.value}
                                type="button"
                                onClick={() => setActiveType(activeType === type.value ? '' : type.value)}
                                aria-pressed={activeType === type.value}
                                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                    activeType === type.value
                                        ? 'bg-turquoise text-sand'
                                        : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    <p className="mt-6 text-sm text-dark-ocean/70">
                        {results.length} {results.length === 1 ? 'atração encontrada' : 'atrações encontradas'}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {results.map((attraction, index) => (
                            <Reveal key={attraction.id} delay={index * 60}>
                                <AttractionCard attraction={attraction} />
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}

export default Atracoes;
