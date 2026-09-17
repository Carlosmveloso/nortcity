// Clique semântico: só conta o que a interface marcou como digno de contagem.
//
// O identificador vem exclusivamente do atributo `data-analytics`. Nada é
// inferido do elemento — nem texto, nem valor, nem id, nem classe. O metadata é
// montado por lista branca justamente para que ampliar o que se coleta exija
// editar este arquivo, e não acontecer por acidente ao mexer numa tela.
export const ANALYTICS_ATTRIBUTE = 'data-analytics';
export const ELEMENT_NAME_MAX = 80;
const COORDINATE_DECIMALS = 4;

// Quatro casas bastam para o heatmap (numa tela de 1440px, ~0,14px) e mantêm o
// JSON curto.
function ratio(value, total) {
    const safeTotal = Math.max(total || 0, 1);
    const result = Math.min(1, Math.max(0, value / safeTotal));
    return Number(result.toFixed(COORDINATE_DECIMALS));
}

function documentHeight() {
    return Math.max(document.documentElement.scrollHeight, window.innerHeight, 1);
}

/**
 * Metadata do clique, ou `null` quando o clique não deve ser registrado.
 *
 * `closest` resolve o caso comum de clicar no <svg> ou no texto dentro do
 * botão: o evento sobe até o elemento marcado. Como o listener é único e
 * `closest` devolve só o ancestral mais próximo, um clique gera no máximo um
 * evento, mesmo com marcações aninhadas.
 */
export function clickMetadata(event) {
    const target = event?.target;
    if (!target || typeof target.closest !== 'function') return null;

    const element = target.closest(`[${ANALYTICS_ATTRIBUTE}]`);
    if (!element) return null;

    const name = (element.getAttribute(ANALYTICS_ATTRIBUTE) ?? '').trim();
    if (!name || name.length > ELEMENT_NAME_MAX) return null;

    const metadata = { element: name };

    // `detail` é a contagem de cliques do ponteiro; vale 0 quando o clique veio
    // do teclado (Enter/Espaço num botão ou link). Nesse caso clientX e clientY
    // são 0, e registrá-los criaria um ponto quente falso no canto superior
    // esquerdo do mapa. O clique continua contando — só não tem posição.
    if (event.detail > 0) {
        metadata.x_percent = ratio(event.clientX, window.innerWidth);
        // Horizontal é medido na viewport (a página não rola de lado); vertical
        // é medido no documento inteiro, que é o que permite sobrepor cliques
        // de telas de alturas diferentes no mesmo mapa.
        metadata.y_percent = ratio(event.clientY + window.scrollY, documentHeight());
    }

    return metadata;
}
