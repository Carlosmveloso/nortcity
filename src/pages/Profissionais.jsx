import { Search, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { professionals, professionalRoles } from '../data/professionals';
import ProfessionalCard from '../components/ui/ProfessionalCard';
import Reveal from '../components/ui/Reveal';

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function Profissionais() {
    const [query, setQuery] = useState('');
    const [activeRole, setActiveRole] = useState('');

    const results = useMemo(() => {
        const normalizedQuery = normalize(query.trim());
        return professionals.filter((professional) => {
            if (activeRole && professional.role !== activeRole) return false;
            if (!normalizedQuery) return true;
            const haystack = normalize([professional.name, professional.role, professional.description].join(' '));
            return haystack.includes(normalizedQuery);
        });
    }, [query, activeRole]);

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Profissionais</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Diretório</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        Profissionais em Pitimbu
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Encontre guias, técnicos, artesãos e prestadores de serviço locais.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="flex w-full max-w-xl items-center gap-3 rounded-full bg-white p-3 shadow-sm">
                        <Search className="shrink-0 text-dark-ocean" aria-hidden="true" />
                        <label htmlFor="profissionais-search" className="sr-only">
                            Buscar profissional
                        </label>
                        <input
                            id="profissionais-search"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar por nome ou especialidade"
                            className="w-full min-w-0 bg-transparent text-dark-ocean focus:outline-none"
                        />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveRole('')}
                            aria-pressed={activeRole === ''}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                activeRole === '' ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                            }`}
                        >
                            Todos
                        </button>
                        {professionalRoles.map((role) => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => setActiveRole(activeRole === role ? '' : role)}
                                aria-pressed={activeRole === role}
                                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                    activeRole === role ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {role}
                            </button>
                        ))}
                    </div>

                    <p className="mt-6 text-sm text-dark-ocean/70">
                        {results.length} {results.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}
                    </p>

                    {results.length > 0 ? (
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {results.map((professional, index) => (
                                <Reveal key={professional.id} delay={index * 60} className="h-full">
                                    <ProfessionalCard professional={professional} />
                                </Reveal>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-4 rounded-3xl border border-dashed border-dark-ocean/20 p-10 text-center">
                            <p className="text-dark-ocean/70">Nenhum profissional encontrado. Tente outro termo.</p>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}

export default Profissionais;
