import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCategories } from '../hooks/useCategories';
import { SEARCH_PAGE_SIZE, useBusinessSearch, useNeighborhoods } from '../hooks/useBusinessSearch';
import BusinessCard from '../components/ui/BusinessCard';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

// Ordenação, relevância e paginação são resolvidas pela RPC search_businesses:
// a lista de categorias vem do banco (não mais de uma constante no arquivo) e
// a ordem vale sobre o conjunto inteiro, não sobre a página já baixada.
function Explorar() {
    usePageMeta(staticPageMeta('/explorar'));

    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') ?? '';
    const initialCategory = searchParams.get('categoria') ?? '';
    const initialNeighborhood = searchParams.get('bairro') ?? '';

    const { categories } = useCategories();
    const neighborhoods = useNeighborhoods();

    const [query, setQuery] = useState(initialQuery);
    const [category, setCategory] = useState(initialCategory);

    const filterKey = `${initialQuery}|${initialCategory}|${initialNeighborhood}`;
    const [appliedFilterKey, setAppliedFilterKey] = useState(filterKey);
    const [page, setPage] = useState(0);

    if (filterKey !== appliedFilterKey) {
        setAppliedFilterKey(filterKey);
        setPage(0);
    }

    const { results, total, loading } = useBusinessSearch({
        query: initialQuery,
        category: initialCategory,
        neighborhood: initialNeighborhood,
        page,
    });

    const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
    const quickFilters = categories.slice(0, 5);

    const updateParams = (next) => {
        const params = {};
        const merged = {
            q: initialQuery,
            categoria: initialCategory,
            bairro: initialNeighborhood,
            ...next,
        };
        Object.entries(merged).forEach(([key, value]) => {
            if (value) params[key] = value;
        });
        setSearchParams(params);
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        updateParams({ q: query, categoria: category });
    };

    const applyCategory = (nextCategory) => {
        setCategory(nextCategory);
        updateParams({ categoria: nextCategory });
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
                                {categories.map((item) => (
                                    <option
                                        key={item.id}
                                        value={item.slug}
                                        className="notranslate"
                                        translate="no"
                                    >
                                        {item.name}
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
                            <span className="font-bold text-sand notranslate" translate="no">
                                Buscar
                            </span>
                        </button>
                    </div>
                </form>

                <div className="mt-8 flex flex-wrap items-center gap-2">
                    {quickFilters.map((filter) => (
                        <button
                            key={filter.id}
                            type="button"
                            onClick={() => handleQuickFilter(filter.slug)}
                            aria-pressed={initialCategory === filter.slug}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                initialCategory === filter.slug
                                    ? 'bg-turquoise text-sand'
                                    : 'bg-white text-dark-ocean shadow-sm'
                            }`}
                        >
                            <span className="notranslate" translate="no">
                                {filter.name}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Filtros de dimensões diferentes se somam: categoria + bairro
                    valem juntos, e não um substituindo o outro. */}
                {neighborhoods.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label htmlFor="explorar-neighborhood" className="text-sm font-semibold text-dark-ocean/70">
                            Bairro
                        </label>
                        <select
                            id="explorar-neighborhood"
                            value={initialNeighborhood}
                            onChange={(event) => updateParams({ bairro: event.target.value })}
                            className="rounded-full bg-white py-2 pr-8 pl-4 text-sm text-dark-ocean shadow-sm focus:outline-none"
                        >
                            <option value="">Todos</option>
                            {neighborhoods.map((item) => (
                                <option key={item.neighborhood} value={item.neighborhood}>
                                    {item.neighborhood} ({item.total})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <p className="mt-6 text-sm text-dark-ocean/70">
                    {loading
                        ? 'Carregando...'
                        : `${total} ${total === 1 ? 'resultado encontrado' : 'resultados encontrados'}`}
                </p>

                {loading ? null : results.length > 0 ? (
                    <>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {results.map((business) => (
                                <BusinessCard key={business.id} business={business} />
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="mt-8 flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                                    disabled={page === 0}
                                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-dark-ocean shadow-sm disabled:opacity-40"
                                >
                                    Anterior
                                </button>
                                <span className="text-sm text-dark-ocean/70">
                                    Página {page + 1} de {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-dark-ocean shadow-sm disabled:opacity-40"
                                >
                                    Próxima
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
