import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { popularCategories, otherCategories } from '../data/categories';
import Reveal from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function CategoryTile({ category, size = 'default' }) {
    const Icon = category.icon;
    const isLarge = size === 'large';

    if (isLarge) {
        return (
            <Link
                to={`/explorar?categoria=${category.slug}`}
                style={{ backgroundImage: `url(${category.img})` }}
                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-cover bg-center text-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
                <div className="absolute inset-0 bg-linear-to-t from-ocean/90 via-ocean/40 to-transparent"></div>
                <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-turquoise/20 backdrop-blur-sm">
                        <Icon className="h-5 w-5 text-card" aria-hidden="true" />
                    </div>
                    <h3
                        className="notranslate font-head text-sm leading-tight font-semibold break-words text-card sm:text-lg"
                        translate="no"
                    >
                        {category.label}
                    </h3>
                    <p className="text-sm text-card/80">{category.description}</p>
                    {category.count > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-card/20 px-2 py-1 text-xs text-card backdrop-blur-sm">
                            +{category.count} opções
                        </div>
                    )}
                </div>
            </Link>
        );
    }

    return (
        <Link
            to={`/explorar?categoria=${category.slug}`}
            className="group block rounded-2xl bg-card p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-turquoise/10 transition-colors group-hover:bg-turquoise/20">
                <Icon className="h-6 w-6 text-turquoise" aria-hidden="true" />
            </div>
            <h3
                className="notranslate font-head mb-1 font-semibold break-words text-foreground"
                translate="no"
            >
                {category.label}
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">{category.description}</p>
            {category.count > 0 && (
                <span className="text-xs font-medium text-turquoise">+{category.count}</span>
            )}
        </Link>
    );
}

function Categorias() {
    usePageMeta(staticPageMeta('/categorias'));

    const [query, setQuery] = useState('');

    const filteredPopular = useMemo(() => {
        const normalizedQuery = normalize(query.trim());
        if (!normalizedQuery) return popularCategories;
        return popularCategories.filter((category) =>
            normalize(`${category.label} ${category.description}`).includes(normalizedQuery)
        );
    }, [query]);

    const filteredOther = useMemo(() => {
        const normalizedQuery = normalize(query.trim());
        if (!normalizedQuery) return otherCategories;
        return otherCategories.filter((category) =>
            normalize(`${category.label} ${category.description}`).includes(normalizedQuery)
        );
    }, [query]);

    return (
        <>
            <section className="bg-sand-dark px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-2xl text-center">
                    <h1 className="font-head text-3xl font-bold text-foreground md:text-4xl">Categorias</h1>
                    <p className="mt-4 text-muted-foreground">
                        Explore Pitimbu por categoria e encontre exatamente o que você precisa
                    </p>
                    <div className="relative mx-auto mt-8 max-w-md">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <input
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar categoria..."
                            aria-label="Buscar categoria"
                            className="h-12 w-full rounded-xl border-0 bg-card pl-12 pr-4 text-foreground shadow-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-turquoise focus:outline-none"
                        />
                    </div>
                </div>
            </section>

            <section className="bg-background px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                <div className="container mx-auto max-w-5xl">
                    <Reveal>
                        <h2 className="font-head text-2xl font-bold text-foreground">Mais procuradas</h2>
                    </Reveal>
                    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-5">
                        {filteredPopular.map((category, index) => (
                            <Reveal key={category.slug} delay={index * 60}>
                                <CategoryTile category={category} size="large" />
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-sand-dark px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                <div className="container mx-auto max-w-5xl">
                    <Reveal>
                        <h2 className="font-head text-2xl font-bold text-foreground">Todas as categorias</h2>
                    </Reveal>
                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {filteredOther.map((category, index) => (
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
