import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
    supabase: { rpc: (...args) => rpc(...args) },
}));

const { default: AdminAnalytics } = await import('./AdminAnalytics');

// `numeric` chega do PostgREST como string e `bigint` como número — as fixtures
// imitam isso de propósito, porque é onde a formatação costuma quebrar.
const DADOS = {
    analytics_overview: [
        {
            unique_visitors: 1284,
            sessions: 1500,
            page_views: 12531,
            whatsapp_clicks: 87,
            business_views: 300,
            searches: 42,
        },
    ],
    analytics_health: [
        {
            events_total: 25482,
            first_event_at: '2026-09-01T12:00:00-03:00',
            last_event_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            last_aggregated_date: '2026-09-14',
            last_aggregated_at: '2026-09-15T03:10:00-03:00',
            aggregated_days: 14,
            daily_rows: 320,
        },
    ],
    analytics_top_pages: [{ pathname: '/explorar', views: 900, unique_visitors: 700, sessions: 800 }],
    analytics_top_businesses: [
        {
            business_id: 'b1',
            business_name: 'Pousada Farol',
            business_slug: 'pousada-farol',
            views: 10,
            whatsapp_clicks: 5,
            unique_visitors: 8,
            whatsapp_rate: '50.0',
        },
    ],
    analytics_top_searches: [
        { query_normalized: 'cafe', query_sample: 'Café', searches: 12, avg_results: '3.0', zero_result_searches: 2 },
    ],
    analytics_heatmap_pages: [
        { pathname: '/', clicks: 40 },
        { pathname: '/explorar', clicks: 12 },
    ],
    analytics_click_heatmap: [{ x: '0.5000', y: '0.2500', clicks: 30 }],
    analytics_top_elements: [{ element: 'hero-search', clicks: 30, unique_visitors: 20, sessions: 25 }],
    analytics_scroll_funnel: [
        { depth: 25, reached: 82, page_views: 100, rate: '82.0' },
        { depth: 50, reached: 69, page_views: 100, rate: '69.0' },
        { depth: 75, reached: 55, page_views: 100, rate: '55.0' },
        { depth: 90, reached: 43, page_views: 100, rate: '43.0' },
        { depth: 100, reached: 38, page_views: 100, rate: '38.0' },
    ],
};

function renderPainel() {
    return render(
        <MemoryRouter>
            <AdminAnalytics />
        </MemoryRouter>
    );
}

function chamadas(nome) {
    return rpc.mock.calls.filter(([fn]) => fn === nome);
}

async function abrirAba(nome) {
    fireEvent.click(screen.getByRole('button', { name: nome }));
}

beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation((fn) => Promise.resolve({ data: DADOS[fn] ?? [], error: null }));
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('visão geral', () => {
    it('mostra os números formatados em pt-BR', async () => {
        renderPainel();

        expect(await screen.findByText('1.284')).toBeInTheDocument();
        expect(screen.getByText('12.531')).toBeInTheDocument();
        expect(screen.getByText('Cliques no WhatsApp')).toBeInTheDocument();
    });

    // Duas seções na aba (números e saúde), cada uma com o próprio estado.
    it('mostra o estado de carregando antes da resposta', () => {
        rpc.mockImplementation(() => new Promise(() => {}));
        renderPainel();

        expect(screen.getAllByText('Carregando...')).toHaveLength(2);
    });

    it('erro de uma seção aparece traduzido, sem derrubar a página', async () => {
        rpc.mockImplementation(() => Promise.resolve({ data: null, error: { message: 'forbidden' } }));
        renderPainel();

        // Cada seção mostra o próprio erro; nenhuma derruba a outra nem a página.
        expect(await screen.findAllByText('Você não tem permissão para esta ação.')).toHaveLength(2);
        expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(2);
    });
});

describe('saúde dos dados', () => {
    it('mostra coleta e agregação como coisas separadas', async () => {
        renderPainel();

        expect(await screen.findByText('25.482')).toBeInTheDocument();
        expect(screen.getByText('há 2 minutos')).toBeInTheDocument();
        // Data pura do banco não pode aparecer como 13/09 por causa de fuso.
        expect(screen.getByText('14/09/2026')).toBeInTheDocument();
        expect(screen.getByText('Última agregação')).toBeInTheDocument();
    });

    // A saúde é estado de agora, não do período: trocar o filtro não pode
    // refazer a consulta dela.
    it('não é reconsultada ao trocar o período', async () => {
        renderPainel();
        await screen.findByText('25.482');
        expect(chamadas('analytics_health')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: '30 dias' }));

        await waitFor(() => expect(chamadas('analytics_overview')).toHaveLength(2));
        expect(chamadas('analytics_health')).toHaveLength(1);
    });
});

describe('filtro de período', () => {
    it('trocar o período refaz a consulta com outro intervalo', async () => {
        renderPainel();
        await screen.findByText('1.284');

        const [, primeiro] = chamadas('analytics_overview')[0];
        fireEvent.click(screen.getByRole('button', { name: '30 dias' }));

        await waitFor(() => expect(chamadas('analytics_overview')).toHaveLength(2));
        const [, segundo] = chamadas('analytics_overview')[1];

        expect(segundo.p_start_at).not.toBe(primeiro.p_start_at);
        expect(new Date(segundo.p_start_at).getTime()).toBeLessThan(new Date(primeiro.p_start_at).getTime());
    });
});

describe('abas', () => {
    it('cada aba consulta a própria RPC', async () => {
        renderPainel();
        await screen.findByText('1.284');

        await abrirAba('Páginas');
        expect(await screen.findByText('/explorar')).toBeInTheDocument();

        await abrirAba('Negócios');
        expect(await screen.findByText('Pousada Farol')).toBeInTheDocument();
        expect(screen.getByText('50,0%')).toBeInTheDocument();

        await abrirAba('Pesquisas');
        expect(await screen.findByText('Café')).toBeInTheDocument();
        expect(screen.getByText('2 busca(s) sem nenhum resultado')).toBeInTheDocument();
    });
});

describe('heatmap', () => {
    it('posiciona o ponto pela coordenada normalizada', async () => {
        renderPainel();
        await abrirAba('Heatmap');

        const ponto = await screen.findByTitle('30 clique(s)');
        expect(ponto).toHaveStyle({ left: '50%', top: '25%' });
    });

    it('a primeira página com cliques é a escolha padrão, e trocar refaz só o mapa', async () => {
        renderPainel();
        await abrirAba('Heatmap');
        await screen.findByTitle('30 clique(s)');

        expect(chamadas('analytics_click_heatmap')[0][1].p_pathname).toBe('/');
        const antes = chamadas('analytics_overview').length;

        fireEvent.change(screen.getByLabelText('Página'), { target: { value: '/explorar' } });

        await waitFor(() =>
            expect(chamadas('analytics_click_heatmap').at(-1)[1].p_pathname).toBe('/explorar')
        );
        // A visão geral não depende de pathname: nenhuma consulta nova.
        expect(chamadas('analytics_overview')).toHaveLength(antes);
    });

    it('o filtro de dispositivo chega na RPC, e "Todos" vira null', async () => {
        renderPainel();
        await abrirAba('Heatmap');
        await screen.findByTitle('30 clique(s)');

        expect(chamadas('analytics_click_heatmap')[0][1].p_device_type).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));

        await waitFor(() =>
            expect(chamadas('analytics_click_heatmap').at(-1)[1].p_device_type).toBe('mobile')
        );
    });

    it('sem cliques no período, diz isso em vez de mostrar mapa vazio', async () => {
        rpc.mockImplementation((fn) =>
            Promise.resolve({ data: fn === 'analytics_click_heatmap' ? [] : (DADOS[fn] ?? []), error: null })
        );
        renderPainel();
        await abrirAba('Heatmap');

        expect(await screen.findByText('Não há cliques suficientes neste período.')).toBeInTheDocument();
    });

    // Sem página nenhuma com clique, `pathname` fica vazio — e as RPCs de mapa e
    // funil recusam pathname vazio com `pathname_required`. O atalho no loader
    // existe para isso: a tela mostra estado vazio, não erro de validação.
    it('sem nenhuma página com cliques, não chama as RPCs que exigem página', async () => {
        rpc.mockImplementation((fn) =>
            Promise.resolve({
                data: fn === 'analytics_heatmap_pages' ? [] : (DADOS[fn] ?? []),
                error: null,
            })
        );
        renderPainel();
        await abrirAba('Heatmap');

        expect(await screen.findByText('Nenhuma página com cliques')).toBeInTheDocument();
        await waitFor(() => expect(chamadas('analytics_heatmap_pages')).toHaveLength(1));

        expect(chamadas('analytics_click_heatmap')).toHaveLength(0);
        expect(chamadas('analytics_scroll_funnel')).toHaveLength(0);
        expect(screen.getByText('Não há cliques suficientes neste período.')).toBeInTheDocument();
    });

    it('mostra o funil de rolagem em número, não só em barra', async () => {
        renderPainel();
        await abrirAba('Heatmap');

        expect(await screen.findByText('82,0% · 82')).toBeInTheDocument();
        expect(screen.getByText('38,0% · 38')).toBeInTheDocument();
        expect(screen.getByText('Base: 100 visualização(ões) desta página no período.')).toBeInTheDocument();
    });

    it('lista os elementos mais clicados junto do mapa', async () => {
        renderPainel();
        await abrirAba('Heatmap');

        expect(await screen.findByText('hero-search')).toBeInTheDocument();
    });
});
