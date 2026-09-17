import { afterEach, describe, expect, it } from 'vitest';
import { MIN_SCROLLABLE_PX, SCROLL_MILESTONES, pendingMilestones, readScrollDepth } from './scroll';

// O jsdom não faz layout: altura de documento e posição de rolagem não existem
// até serem declaradas. É o que esta função faz.
function setGeometry({ scrollY = 0, innerHeight = 1000, scrollHeight = 3000 }) {
    Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: scrollHeight,
        configurable: true,
        writable: true,
    });
}

afterEach(() => {
    setGeometry({});
});

describe('readScrollDepth', () => {
    it('mede a fração já rolada da área rolável, não da altura total', () => {
        // 3000 de documento menos 1000 de tela = 2000 roláveis. Estar em 1000
        // significa metade do caminho percorrido, não um terço do documento.
        setGeometry({ scrollY: 1000, innerHeight: 1000, scrollHeight: 3000 });
        expect(readScrollDepth()).toBe(50);

        setGeometry({ scrollY: 0, innerHeight: 1000, scrollHeight: 3000 });
        expect(readScrollDepth()).toBe(0);

        setGeometry({ scrollY: 2000, innerHeight: 1000, scrollHeight: 3000 });
        expect(readScrollDepth()).toBe(100);
    });

    it('limita a 100 quando o navegador devolve rolagem além do fim (bounce do iOS)', () => {
        setGeometry({ scrollY: 2400, innerHeight: 1000, scrollHeight: 3000 });
        expect(readScrollDepth()).toBe(100);
    });

    // A decisão da Sprint: página que cabe na tela não gera scroll_depth. Sem
    // isto, o fallback `min-h-screen` do <Suspense> marcaria "leu tudo" em toda
    // rota preguiçosa antes de o conteúdo existir.
    it('devolve null quando não há área rolável relevante', () => {
        setGeometry({ scrollY: 0, innerHeight: 1000, scrollHeight: 1000 });
        expect(readScrollDepth()).toBeNull();

        setGeometry({ scrollY: 0, innerHeight: 1000, scrollHeight: 900 });
        expect(readScrollDepth()).toBeNull();
    });

    it('ignora páginas logo abaixo do piso e aceita logo acima', () => {
        setGeometry({ scrollY: 0, innerHeight: 1000, scrollHeight: 1000 + MIN_SCROLLABLE_PX - 1 });
        expect(readScrollDepth()).toBeNull();

        setGeometry({ scrollY: 0, innerHeight: 1000, scrollHeight: 1000 + MIN_SCROLLABLE_PX });
        expect(readScrollDepth()).toBe(0);
    });
});

describe('pendingMilestones', () => {
    it('devolve só os marcos alcançados que ainda não saíram', () => {
        expect(pendingMilestones(26, new Set())).toEqual([25]);
        expect(pendingMilestones(54, new Set([25]))).toEqual([50]);
        expect(pendingMilestones(100, new Set())).toEqual(SCROLL_MILESTONES);
    });

    it('não repete marco já registrado, mesmo subindo e descendo', () => {
        const sent = new Set([25, 50]);

        // Voltou ao topo e desceu de novo até o mesmo ponto.
        expect(pendingMilestones(20, sent)).toEqual([]);
        expect(pendingMilestones(54, sent)).toEqual([]);
    });

    it('entrega de uma vez os marcos pulados num salto de rolagem', () => {
        // Barra arrastada do topo ao fim: os cinco valem, e valem uma vez só.
        const sent = new Set();
        const alcancados = pendingMilestones(100, sent);
        alcancados.forEach((milestone) => sent.add(milestone));

        expect(alcancados).toEqual([25, 50, 75, 90, 100]);
        expect(pendingMilestones(100, sent)).toEqual([]);
    });

    it('não devolve nada quando a página não é rolável', () => {
        expect(pendingMilestones(null, new Set())).toEqual([]);
    });
});
