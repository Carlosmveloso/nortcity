import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { popularCategories, otherCategories } from '../data/categories';
import Reveal from '../components/ui/Reveal';

function CategoryTile({ category, size = 'default' }) {
    const Icon = category.icon;
    const isLarge = size === 'large';

    return (
        <Link
            to={`/explorar?categoria=${category.slug}`}
            className="group flex flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
            <div
                className={`flex items-center justify-center rounded-2xl bg-gradient-ocean text-card ${
                    isLarge ? 'h-16 w-16' : 'h-12 w-12'
                }`}
            >
                <Icon className={isLarge ? 'h-8 w-8' : 'h-6 w-6'} aria-hidden="true" />
            </div>
            <div>
                <h3 className={`font-head font-semibold text-foreground ${isLarge ? 'text-lg' : 'text-base'}`}>
                    {category.label}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            </div>
            {category.count > 0 && (
                <span className="mt-1 rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold text-turquoise">
                    +{category.count} opções
                </span>
            )}
        </Link>
    );
}

function Categorias() {
    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Categorias</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Diretório</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">Categorias</h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Explore Pitimbu por categoria e encontre exatamente o que você precisa.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-12 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <Reveal>
                        <h2 className="font-head text-2xl font-bold text-foreground">Mais procuradas</h2>
                    </Reveal>
                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        {popularCategories.map((category, index) => (
                            <Reveal key={category.slug} delay={index * 60}>
                                <CategoryTile category={category} size="large" />
                            </Reveal>
                        ))}
                    </div>

                    <Reveal>
                        <h2 className="mt-14 font-head text-2xl font-bold text-foreground">Todas as categorias</h2>
                    </Reveal>
                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {otherCategories.map((category, index) => (
                            <Reveal key={category.slug} delay={index * 60}>
                                <CategoryTile category={category} />
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}

export default Categorias;
