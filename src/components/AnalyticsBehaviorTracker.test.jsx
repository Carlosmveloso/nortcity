import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `analyticsEnabled` é constante de módulo calculada do ambiente; o getter
// permite variá-la por caso sem recarregar módulo. `useLocation` é o único uso
// de router aqui, então controlá-lo direto dispensa MemoryRouter e deixa o
// teste de reset de rota explícito.
const { trackMock, analytics, location } = vi.hoisted(() => ({
    trackMock: vi.fn(),
    analytics: { enabled: true },
    location: { key: 'inicial', pathname: '/' },
}));

vi.mock('../lib/analytics/analytics', () => ({
    get analyticsEnabled() {
        return analytics.enabled;
    },
    track: (...args) => trackMock(...args),
}));

vi.mock('react-router-dom', () => ({
    useLocation: () => location,
}));

const { default: AnalyticsBehaviorTracker } = await import('./AnalyticsBehaviorTracker');

function setGeometry({ scrollY = 0, innerHeight = 1000, scrollHeight = 3000 } = {}) {
    Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: scrollHeight,
        configurable: true,
        writable: true,
    });
}

// O mais recente, não o primeiro: depois de um rerender o efeito já trocou de
// listener, e o antigo continuaria enxergando o conjunto de marcos da rota
// anterior — dando um falso "não duplicou".
function listenerFor(target, type) {
    const call = target.addEventListener.mock.calls.findLast(([registered]) => registered === type);
    return call?.[1];
}

function depthsTracked() {
    return trackMock.mock.calls
        .filter(([type]) => type === 'scroll_depth')
        .map(([, options]) => options.metadata.depth);
}

beforeEach(() => {
    trackMock.mockReset();
    analytics.enabled = true;
    location.key = 'inicial';
    location.pathname = '/';
    setGeometry();
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
    vi.spyOn(document, 'addEventListener');
    vi.spyOn(document, 'removeEventListener');
});

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('ciclo de vida dos listeners', () => {
    it('anexa um listener de scroll e um de clique, e remove os dois ao desmontar', () => {
        const { unmount } = render(<AnalyticsBehaviorTracker />);

        expect(listenerFor(window, 'scroll')).toBeTypeOf('function');
        expect(listenerFor(document, 'click')).toBeTypeOf('function');

        unmount();

        expect(window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        expect(document.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
    });

    it('escuta scroll de forma passiva e clique na captura', () => {
        render(<AnalyticsBehaviorTracker />);

        expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), {
            passive: true,
        });
        // Captura: um stopPropagation no caminho não some com o clique.
        expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
    });

    it('com analytics desligado não anexa listener nenhum', () => {
        analytics.enabled = false;

        render(<AnalyticsBehaviorTracker />);

        expect(listenerFor(window, 'scroll')).toBeUndefined();
        expect(listenerFor(document, 'click')).toBeUndefined();
        expect(trackMock).not.toHaveBeenCalled();
    });
});

describe('scroll', () => {
    it('registra cada marco uma vez, por mais eventos de scroll que cheguem', async () => {
        render(<AnalyticsBehaviorTracker />);
        const onScroll = listenerFor(window, 'scroll');

        // 2000px roláveis. 600 = 30% → só o marco de 25.
        setGeometry({ scrollY: 600 });
        for (let i = 0; i < 50; i += 1) onScroll();

        await waitFor(() => expect(depthsTracked()).toEqual([25]));

        // Sobe de volta e desce de novo até o mesmo ponto: nada novo.
        setGeometry({ scrollY: 100 });
        onScroll();
        setGeometry({ scrollY: 600 });
        onScroll();

        await waitFor(() => expect(depthsTracked()).toEqual([25]));

        setGeometry({ scrollY: 1100 });
        onScroll();

        await waitFor(() => expect(depthsTracked()).toEqual([25, 50]));
    });

    it('entrega os cinco marcos ao chegar no fim, sem repetir', async () => {
        render(<AnalyticsBehaviorTracker />);
        const onScroll = listenerFor(window, 'scroll');

        setGeometry({ scrollY: 2000 });
        onScroll();
        onScroll();

        await waitFor(() => expect(depthsTracked()).toEqual([25, 50, 75, 90, 100]));
    });

    it('não registra nada em página que cabe na tela', async () => {
        render(<AnalyticsBehaviorTracker />);
        const onScroll = listenerFor(window, 'scroll');

        setGeometry({ scrollY: 0, innerHeight: 1000, scrollHeight: 1000 });
        onScroll();

        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(trackMock).not.toHaveBeenCalled();
    });

    // O funil do painel divide marcos por page views, e `page_view` dispara a
    // cada entrada no histórico — inclusive quando só a query string muda. Em
    // /explorar cada filtro chama `setSearchParams`, que empurra entrada nova:
    // sem reiniciar aqui, três filtros dariam 4 page views e 1 conjunto de
    // marcos, e o funil daquela página mostraria um quarto do valor real.
    it('nova entrada no histórico reinicia os marcos, mesmo no mesmo caminho', async () => {
        const { rerender } = render(<AnalyticsBehaviorTracker />);

        setGeometry({ scrollY: 600 });
        listenerFor(window, 'scroll')();
        await waitFor(() => expect(depthsTracked()).toEqual([25]));

        // Mesmo pathname, busca diferente: é outra visualização de página.
        location.key = 'apos-filtro';
        rerender(<AnalyticsBehaviorTracker />);

        setGeometry({ scrollY: 600 });
        listenerFor(window, 'scroll')();

        await waitFor(() => expect(depthsTracked()).toEqual([25, 25]));
    });

    it('trocar de rota reinicia os marcos', async () => {
        const { rerender } = render(<AnalyticsBehaviorTracker />);

        setGeometry({ scrollY: 600 });
        listenerFor(window, 'scroll')();
        await waitFor(() => expect(depthsTracked()).toEqual([25]));

        // Outra página: os 25% dela são um evento novo, não continuação.
        location.key = 'outra-rota';
        location.pathname = '/explorar';
        rerender(<AnalyticsBehaviorTracker />);

        setGeometry({ scrollY: 600 });
        listenerFor(window, 'scroll')();

        await waitFor(() => expect(depthsTracked()).toEqual([25, 25]));
    });
});

describe('clique', () => {
    it('registra element_click a partir do atributo, com coordenadas', async () => {
        render(<AnalyticsBehaviorTracker />);
        document.body.innerHTML = '<button data-analytics="hero-search"><svg /></button>';

        const evento = new MouseEvent('click', {
            bubbles: true,
            clientX: 500,
            clientY: 500,
            detail: 1,
        });
        document.querySelector('svg').dispatchEvent(evento);

        expect(trackMock).toHaveBeenCalledWith('element_click', {
            metadata: { element: 'hero-search', x_percent: expect.any(Number), y_percent: expect.any(Number) },
        });
    });

    it('não registra clique fora de elemento marcado', () => {
        render(<AnalyticsBehaviorTracker />);
        document.body.innerHTML = '<button>Sem marcação</button>';

        document.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

        expect(trackMock).not.toHaveBeenCalled();
    });
});
