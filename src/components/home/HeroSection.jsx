import { Search, ChevronDown, Mouse } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassButton from '../ui/GlassButton';

const quickFilters = [
    { label: 'Gastronomia', emoji: '🍤', value: 'gastronomia' },
    { label: 'Passeios', emoji: '🏖️', value: 'passeios' },
    { label: 'Hospedagem', emoji: '🛏️', value: 'hospedagem' },
    { label: 'Serviços', emoji: '🛠️', value: 'servicos' },
    { label: 'Negócio', emoji: '🏢', value: 'negocio' },
];

function HeroSection() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');

    const heroImg = `
    bg-[linear-gradient(rgba(0,0,0,0.30),rgba(0,0,0,0.10)),url('/hero-beach1.jpeg')]
    bg-cover bg-center bg-no-repeat
    h-screen overflow-hidden
    flex flex-col items-center justify-center
    shadow-xl`;
    const heroCta = `
    w-9/10 h-full max-h-full overflow-y-auto
    py-4
    flex flex-col gap-6 items-center justify-center`;

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (category) params.set('categoria', category);
        navigate(`/explorar${params.toString() ? `?${params.toString()}` : ''}`);
    };

    const handleQuickFilter = (value) => {
        setCategory((current) => (current === value ? '' : value));
    };

    return (
        <section className={heroImg}>
            <div className={heroCta}>
                <GlassButton>Tudo de Pitimbu em um só lugar!</GlassButton>
                <h1 className="text-4xl font-head text-white text-center font-semibold text-shadow-lg">
                    Descubra Pitimbu com o
                    <span className="text-turquoise notranslate ml-2" translate="no">
                        Farol Pitimbu
                    </span>
                </h1>
                <p className="text-white text-center text-lg/7 font-semibold">
                    Encontre passeios, gastronomia, hospedagem e serviços locais em um só lugar!
                </p>
                <form
                    role="search"
                    onSubmit={handleSearchSubmit}
                    className="w-full max-w-3xl bg-white rounded-3xl p-2 flex flex-col gap-2 sm:flex-row"
                >
                    <div className="flex flex-1 items-center p-3 bg-sand-dark/50 gap-3 text-dark-ocean rounded-full">
                        <Search className="shrink-0" aria-hidden="true" />
                        <label htmlFor="hero-search" className="sr-only">
                            O que você procura?
                        </label>
                        <input
                            id="hero-search"
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
                            <label htmlFor="hero-category" className="sr-only">
                                Categoria
                            </label>
                            <select
                                id="hero-category"
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                className="h-full w-full appearance-none rounded-full bg-sand-dark/50 py-3 pl-5 pr-10 text-dark-ocean focus:outline-none sm:w-40"
                            >
                                <option value="">Categoria</option>
                                {quickFilters.map((filter) => (
                                    <option
                                        key={filter.value}
                                        value={filter.value}
                                        className="notranslate"
                                        translate="no"
                                    >
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
                        <button type="submit" className="shrink-0 bg-turquoise px-6 py-3 rounded-full">
                            <span className="text-sand font-bold notranslate" translate="no">
                                Buscar
                            </span>
                        </button>
                    </div>
                </form>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:py-3">
                    {quickFilters.map((filter) => (
                        <GlassButton
                            key={filter.value}
                            as="button"
                            type="button"
                            onClick={() => handleQuickFilter(filter.value)}
                            aria-pressed={category === filter.value}
                            className={category === filter.value ? 'justify-center bg-white/40' : 'justify-center'}
                        >
                            <span aria-hidden="true">{filter.emoji}</span>
                            <span className="notranslate" translate="no">
                                {filter.label}
                            </span>
                        </GlassButton>
                    ))}
                </div>
                <Mouse className="mt-4 h-6 w-6 animate-bounce text-white/70" aria-hidden="true" />
            </div>
        </section>
    );
}

export default HeroSection;
