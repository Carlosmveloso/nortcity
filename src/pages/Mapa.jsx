import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { mapPoints, mapCategories } from '../data/mapPoints';
import MapView from '../components/ui/MapView';

function Mapa() {
    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Mapa</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Localização</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        Mapa de Pitimbu
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Localize negócios e atrações no mapa e planeje seu roteiro pela região.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        {mapCategories.map((category) => (
                            <span key={category.value} className="flex items-center gap-2 text-sm text-dark-ocean/80">
                                <span
                                    className="h-3 w-3 rounded-full border border-white"
                                    style={{ backgroundColor: category.color }}
                                    aria-hidden="true"
                                />
                                {category.label}
                            </span>
                        ))}
                    </div>

                    <div className="overflow-hidden rounded-3xl shadow-sm">
                        <MapView points={mapPoints} categories={mapCategories} className="h-[70vh] w-full" />
                    </div>
                </div>
            </section>
        </>
    );
}

export default Mapa;
