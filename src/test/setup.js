import '@testing-library/jest-dom/vitest';

// O jsdom não implementa IntersectionObserver, e o `Reveal` (useInView) envolve
// boa parte das seções do site: sem este stub, qualquer teste que renderize uma
// delas quebra por causa da animação de entrada, não do que está sendo testado.
// O stub marca tudo como visível para o conteúdo aparecer na árvore.
class IntersectionObserverStub {
    constructor(callback) {
        this.callback = callback;
    }

    observe(target) {
        this.callback([{ target, isIntersecting: true }], this);
    }

    unobserve() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
}

globalThis.IntersectionObserver = IntersectionObserverStub;
