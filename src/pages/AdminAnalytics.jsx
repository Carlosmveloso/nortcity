import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AnalyticsSection from '../components/admin/AnalyticsSection';
import ClickHeatmap from '../components/admin/ClickHeatmap';
import HealthSummary from '../components/admin/HealthSummary';
import MetricCards from '../components/admin/MetricCards';
import RankingList from '../components/admin/RankingList';
import ScrollFunnel from '../components/admin/ScrollFunnel';
import { useAnalyticsData } from '../hooks/useAdminAnalytics';
import { usePageMeta } from '../hooks/usePageMeta';
import {
    getAnalyticsHealth,
    getAnalyticsOverview,
    getClickHeatmap,
    getHeatmapPages,
    getScrollFunnel,
    getTopBusinesses,
    getTopElements,
    getTopPages,
    getTopSearches,
} from '../lib/analytics/admin';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, periodRange } from '../lib/analytics/period';
import { formatDecimal, formatNumber, formatPercent } from '../lib/format';
import { staticPageMeta } from '../lib/siteMeta';

const TABS = [
    { value: 'overview', label: 'Visão geral' },
    { value: 'pages', label: 'Páginas' },
    { value: 'businesses', label: 'Negócios' },
    { value: 'searches', label: 'Pesquisas' },
    { value: 'heatmap', label: 'Heatmap' },
];

const DEVICE_OPTIONS = [
    { value: '', label: 'Todos' },
    { value: 'desktop', label: 'Desktop' },
    { value: 'tablet', label: 'Tablet' },
    { value: 'mobile', label: 'Mobile' },
];

// As RPCs de heatmap e funil exigem pathname; sem página escolhida a consulta
// nem sai. Os atalhos ficam no escopo do módulo porque `useAnalyticsData`
// depende da identidade da função para não reexecutar o efeito a cada render.
function loadHeatmap(args) {
    return args.pathname ? getClickHeatmap(args) : Promise.resolve({ data: [], error: null });
}

function loadFunnel(args) {
    return args.pathname ? getScrollFunnel(args) : Promise.resolve({ data: [], error: null });
}

function pill(active) {
    return `rounded-full px-4 py-2 text-sm font-semibold ${
        active ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
    }`;
}

const NO_ARGS = {};

function HealthSection() {
    const { data, loading, error, reload } = useAnalyticsData(getAnalyticsHealth, NO_ARGS);

    return (
        <AnalyticsSection
            title="Saúde dos dados"
            description="Estado da coleta e da agregação diária. Não depende do período selecionado."
            loading={loading}
            error={error}
            isEmpty={!data}
            emptyMessage="Não foi possível ler o estado da coleta."
            onRetry={reload}
        >
            {data && <HealthSummary health={data} />}
        </AnalyticsSection>
    );
}

function OverviewTab({ range }) {
    const { data, loading, error, reload } = useAnalyticsData(getAnalyticsOverview, range);

    const metrics = data
        ? [
              { label: 'Visitantes', value: data.unique_visitors },
              { label: 'Sessões', value: data.sessions },
              { label: 'Visualizações', value: data.page_views },
              { label: 'Cliques no WhatsApp', value: data.whatsapp_clicks },
              { label: 'Visualizações de negócios', value: data.business_views },
              { label: 'Pesquisas', value: data.searches },
          ]
        : [];

    return (
        <div className="flex flex-col gap-4">
            <AnalyticsSection
                title="Visão geral"
                description="Números do período selecionado."
                loading={loading}
                error={error}
                isEmpty={!data}
                emptyMessage="Nenhum evento registrado neste período."
                onRetry={reload}
            >
                <MetricCards metrics={metrics} />
            </AnalyticsSection>

            <HealthSection />
        </div>
    );
}

function PagesTab({ range }) {
    const { data, loading, error, reload } = useAnalyticsData(getTopPages, range);
    const rows = (data ?? []).map((row) => ({
        key: row.pathname,
        label: row.pathname,
        value: row.views,
        metrics: [
            { label: 'Visitantes', value: formatNumber(row.unique_visitors) },
            { label: 'Sessões', value: formatNumber(row.sessions) },
        ],
    }));

    return (
        <AnalyticsSection
            title="Páginas mais acessadas"
            description="Ordenado por visualizações. Endereços dinâmicos aparecem separados."
            loading={loading}
            error={error}
            isEmpty={rows.length === 0}
            emptyMessage="Nenhuma visualização neste período."
            onRetry={reload}
        >
            <RankingList rows={rows} />
        </AnalyticsSection>
    );
}

function BusinessesTab({ range }) {
    const { data, loading, error, reload } = useAnalyticsData(getTopBusinesses, range);
    const rows = (data ?? []).map((row) => ({
        key: row.business_id,
        label: row.business_name,
        sublabel: row.business_slug ? `/negocio/${row.business_slug}` : 'Cadastro removido do catálogo',
        value: row.views,
        metrics: [
            { label: 'WhatsApp', value: formatNumber(row.whatsapp_clicks) },
            { label: 'Visitantes', value: formatNumber(row.unique_visitors) },
            { label: 'Taxa WhatsApp', value: formatPercent(row.whatsapp_rate) },
        ],
    }));

    return (
        <AnalyticsSection
            title="Negócios mais vistos"
            description="Taxa WhatsApp é a divisão simples de cliques por visualizações da ficha."
            loading={loading}
            error={error}
            isEmpty={rows.length === 0}
            emptyMessage="Nenhuma visualização de negócio neste período."
            onRetry={reload}
        >
            <RankingList rows={rows} />
        </AnalyticsSection>
    );
}

function SearchesTab({ range }) {
    const { data, loading, error, reload } = useAnalyticsData(getTopSearches, range);
    const rows = (data ?? []).map((row) => ({
        key: row.query_normalized,
        label: row.query_sample,
        sublabel:
            Number(row.zero_result_searches) > 0
                ? `${formatNumber(row.zero_result_searches)} busca(s) sem nenhum resultado`
                : null,
        value: row.searches,
        metrics: [{ label: 'Resultados em média', value: formatDecimal(row.avg_results) }],
    }));

    return (
        <AnalyticsSection
            title="Pesquisas mais realizadas"
            description="Agrupadas sem acento e sem diferença de maiúsculas. Só buscas com texto digitado entram aqui — filtrar por categoria ou bairro não gera pesquisa."
            loading={loading}
            error={error}
            isEmpty={rows.length === 0}
            emptyMessage="Nenhuma pesquisa neste período."
            onRetry={reload}
        >
            <RankingList rows={rows} />
        </AnalyticsSection>
    );
}

function HeatmapTab({ range }) {
    const [device, setDevice] = useState('');
    const [chosenPathname, setChosenPathname] = useState('');

    const deviceType = device || null;
    const pagesArgs = useMemo(() => ({ ...range, deviceType }), [range, deviceType]);
    const pages = useAnalyticsData(getHeatmapPages, pagesArgs);

    // Derivado, não sincronizado por efeito: a primeira página da lista é a
    // escolha padrão até alguém escolher outra.
    const available = pages.data ?? [];
    const pathname = chosenPathname || available[0]?.pathname || '';

    const filters = useMemo(() => ({ ...range, pathname, deviceType }), [range, pathname, deviceType]);
    const heatmap = useAnalyticsData(loadHeatmap, filters);
    const elements = useAnalyticsData(getTopElements, filters);
    const funnel = useAnalyticsData(loadFunnel, filters);

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-3">
                    <div>
                        <label htmlFor="heatmap-page" className="text-sm font-semibold text-foreground">
                            Página
                        </label>
                        <select
                            id="heatmap-page"
                            value={pathname}
                            onChange={(event) => setChosenPathname(event.target.value)}
                            disabled={available.length === 0}
                            className="mt-1 w-full rounded-2xl border border-sand-dark bg-white px-4 py-2.5 text-sm text-dark-ocean focus:border-turquoise focus:outline-none"
                        >
                            {available.length === 0 && <option value="">Nenhuma página com cliques</option>}
                            {available.map((page) => (
                                <option key={page.pathname} value={page.pathname}>
                                    {page.pathname} ({formatNumber(page.clicks)})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-foreground">Dispositivo</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {DEVICE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setDevice(option.value)}
                                    aria-pressed={device === option.value}
                                    className={pill(device === option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <AnalyticsSection
                title="Mapa de cliques"
                loading={pages.loading || heatmap.loading}
                error={pages.error || heatmap.error}
                isEmpty={(heatmap.data ?? []).length === 0}
                emptyMessage="Não há cliques suficientes neste período."
                onRetry={heatmap.reload}
            >
                <ClickHeatmap points={heatmap.data ?? []} />
            </AnalyticsSection>

            <AnalyticsSection
                title="Elementos mais clicados"
                description="Inclui cliques por teclado, que não aparecem no mapa."
                loading={elements.loading}
                error={elements.error}
                isEmpty={(elements.data ?? []).length === 0}
                emptyMessage="Nenhum clique registrado com estes filtros."
                onRetry={elements.reload}
            >
                <RankingList
                    rows={(elements.data ?? []).map((row) => ({
                        key: row.element,
                        label: row.element,
                        value: row.clicks,
                        metrics: [
                            { label: 'Visitantes', value: formatNumber(row.unique_visitors) },
                            { label: 'Sessões', value: formatNumber(row.sessions) },
                        ],
                    }))}
                />
            </AnalyticsSection>

            <AnalyticsSection
                title="Profundidade de rolagem"
                loading={funnel.loading}
                error={funnel.error}
                isEmpty={(funnel.data ?? []).length === 0}
                emptyMessage="Nenhuma rolagem registrada nesta página."
                onRetry={funnel.reload}
            >
                <ScrollFunnel steps={funnel.data ?? []} />
            </AnalyticsSection>
        </div>
    );
}

function AdminAnalytics() {
    usePageMeta(staticPageMeta('/admin/analytics'));

    const [tab, setTab] = useState('overview');
    const [period, setPeriod] = useState(DEFAULT_PERIOD);

    // Memorizado de propósito: `periodRange` lê o relógio, então sem isto cada
    // render produziria um intervalo novo e as seções consultariam para sempre.
    const range = useMemo(() => periodRange(period), [period]);

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <Link to="/admin" className="hover:text-card">
                            Admin
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Analytics</span>
                    </nav>
                    <h1 className="font-head text-3xl font-extrabold text-card md:text-4xl">Analytics</h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Comportamento de quem visita o Farol. Todos os números são agregados — nenhum dado
                        pessoal de visitante é exibido.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                        {PERIOD_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setPeriod(option.value)}
                                aria-pressed={period === option.value}
                                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                    period === option.value
                                        ? 'bg-card text-dark-ocean'
                                        : 'bg-card/15 text-card'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="flex flex-wrap gap-2">
                        {TABS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setTab(item.value)}
                                aria-pressed={tab === item.value}
                                className={`rounded-full px-5 py-2.5 text-sm font-bold ${
                                    tab === item.value
                                        ? 'bg-turquoise text-sand'
                                        : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-8">
                        {tab === 'overview' && <OverviewTab range={range} />}
                        {tab === 'pages' && <PagesTab range={range} />}
                        {tab === 'businesses' && <BusinessesTab range={range} />}
                        {tab === 'searches' && <SearchesTab range={range} />}
                        {tab === 'heatmap' && <HeatmapTab range={range} />}
                    </div>
                </div>
            </section>
        </>
    );
}

export default AdminAnalytics;
