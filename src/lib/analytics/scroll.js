// Profundidade de leitura da página, em marcos.
//
// O valor bruto de scroll não interessa: interessa saber quantas pessoas
// passaram de cada linha. Cinco marcos por visualização, cada um uma vez só.
export const SCROLL_MILESTONES = [25, 50, 75, 90, 100];

// Abaixo disto a página não tem rolagem de verdade e nada é registrado.
//
// Duas razões. A primeira é o carregamento: as rotas são preguiçosas e o
// fallback do <Suspense> é `min-h-screen`, então durante o carregamento *toda*
// página mede uma tela de altura — registrar 100 ali marcaria "leu a página
// inteira" antes de o conteúdo existir. A segunda é ruído: numa página 40px
// mais alta que a tela, 25% são 10px, e um empurrãozinho de dedo dispararia os
// cinco marcos de uma vez.
export const MIN_SCROLLABLE_PX = 100;

/**
 * Percentual já rolado da página, ou `null` quando não há rolagem relevante.
 * `null` não é erro: é a resposta certa para uma página que cabe na tela.
 */
export function readScrollDepth() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (!Number.isFinite(scrollable) || scrollable < MIN_SCROLLABLE_PX) return null;

    const percent = (window.scrollY / scrollable) * 100;
    if (!Number.isFinite(percent)) return null;

    return Math.min(100, Math.max(0, percent));
}

/**
 * Marcos que este percentual alcança e que ainda não foram registrados.
 * Quem chama é dono do `Set` — é ele que faz "subir e descer não repete".
 */
export function pendingMilestones(percent, sent) {
    if (percent === null) return [];
    return SCROLL_MILESTONES.filter((milestone) => percent >= milestone && !sent.has(milestone));
}
