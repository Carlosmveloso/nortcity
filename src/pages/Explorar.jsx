import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { businesses } from '../data/businesses';
import BusinessCard from '../components/ui/BusinessCard';

const quickFilters = [
    { label: 'Gastronomia', value: 'gastronomia' },
    { label: 'Passeios', value: 'passeios' },
    { label: 'Hospedagem', value: 'hospedagem' },
    { label: 'Serviços', value: 'servicos' },
    { label: 'Negócio', value: 'negocio' },
];

const PAGE_SIZE = 12;

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function Explorar() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') ?? '';
    const initialCategory = searchParams.get('categoria') ?? '';

    const [query, setQuery] = useState(initialQuery);
    const [category, setCategory] = useState(initialCategory);

    const results = useMemo(() => {
        const normalizedQuery = normalize(initialQuery.trim());
        return businesses.filter((business) => {
            const matchesCategory = !initialCategory || business.categories.includes(initialCategory);
            if (!matchesCategory) return false;
            if (!normalizedQuery) return true;
            const haystack = normalize(
                [business.name, business.subcategory, business.description].filter(Boolean).join(' ')
            );
            return haystack.includes(normalizedQuery);
        });
    }, [initialQuery, initialCategory]);

    const filterKey = `${initialQuery}|${initialCategory}`;
    const [appliedFilterKey, setAppliedFilterKey] = useState(filterKey);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    if (filterKey !== appliedFilterKey) {
        setAppliedFilterKey(filterKey);
        setVisibleCount(PAGE_SIZE);
    }

    const visibleResults = results.slice(0, visibleCount);
    const hasMore = visibleCount < results.length;

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        const nextParams = {};
        if (query) nextParams.q = query;
        if (category) nextParams.categoria = category;
        setSearchParams(nextParams);
    };

    const applyCategory = (nextCategory) => {
        setCategory(nextCategory);
        const nextParams = {};
        if (initialQuery) nextParams.q = initialQuery;
        if (nextCategory) nextParams.categoria = nextCategory;
        setSearchParams(nextParams);
    };

    const handleQuickFilter = (value) => {
        applyCategory(initialCategory === value ? '' : value);
    };

    const handleCategorySelect = (event) => {
        applyCategory(event.target.value);
    };

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Explorar</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Descubra Pitimbu</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        Explore tudo o que Pitimbu oferece
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Encontre passeios, gastronomia, hospedagem e serviços locais em Pitimbu.
                    </p>
                </div>
            </section>
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
            <div className="container mx-auto max-w-5xl">
                <form
                    role="search"
                    onSubmit={handleSearchSubmit}
                    className="mt-8 flex w-full max-w-3xl flex-col gap-2 rounded-3xl bg-white p-2 shadow-sm sm:flex-row"
                >
                    <div className="flex flex-1 items-center gap-3 rounded-full bg-sand-dark/50 p-3 text-dark-ocean">
                        <Search className="shrink-0" aria-hidden="true" />
                        <label htmlFor="explorar-search" className="sr-only">
                            O que você procura?
                        </label>
                        <input
                            id="explorar-search"
                            className="w-full min-w-0 bg-transparent focus:outline-none"
                            type="search"
                            name="query"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="O que você procura? ex: pousada, passeio de barco."
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="relative flex-1 sm:flex-none">
                            <label htmlFor="explorar-category" className="sr-only">
                                Categoria
                            </label>
                            <select
                                id="explorar-category"
                                value={category}
                                onChange={handleCategorySelect}
                                className="h-full w-full appearance-none rounded-full bg-sand-dark/50 py-3 pl-5 pr-10 text-dark-ocean focus:outline-none sm:w-40"
                            >
                                <option value="">Categoria</option>
                                {quickFilters.map((filter) => (
                                    <option key={filter.value} value={filter.value}>
                                        {filter.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-dark-ocean"
                                size={18}
                                aria-hidden="true"
                            />
                        </div>
                        <button type="submit" className="shrink-0 rounded-full bg-turquoise px-6 py-3">
                            <span className="font-bold text-sand">Buscar</span>
                        </button>
                    </div>
                </form>

                <div className="mt-8 flex flex-wrap items-center gap-2">
                    {quickFilters.map((filter) => (
                        <button
                            key={filter.value}
                            type="button"
                            onClick={() => handleQuickFilter(filter.value)}
                            aria-pressed={initialCategory === filter.value}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                initialCategory === filter.value
                                    ? 'bg-turquoise text-sand'
                                    : 'bg-white text-dark-ocean shadow-sm'
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <p className="mt-6 text-sm text-dark-ocean/70">
                    {results.length} {results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                </p>

                {results.length > 0 ? (
                    <>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleResults.map((business) => (
                                <BusinessCard key={business.id} business={business} />
                            ))}
                        </div>
                        {hasMore && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                                    className="rounded-full bg-white px-6 py-3 font-semibold text-dark-ocean shadow-sm"
                                >
                                    Carregar mais
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-4 rounded-3xl border border-dashed border-dark-ocean/20 p-10 text-center">
                        <p className="text-dark-ocean/70">
                            Nenhum resultado encontrado. Tente outro termo de busca ou categoria.
                        </p>
                    </div>
                )}
            </div>
            </section>
        </>
    );
}

export default Explorar;
