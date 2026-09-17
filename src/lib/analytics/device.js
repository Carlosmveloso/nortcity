// Tipo de dispositivo pelos mesmos cortes do Tailwind que o site usa para
// decidir layout (md = 768, lg = 1024): assim "mobile" no relatório quer dizer
// a mesma coisa que "mobile" no CSS.
export function getDeviceType() {
    if (typeof window === 'undefined') return null;

    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

// Navegador e sistema por palpite no user agent, de propósito. Uma biblioteca
// de detecção custa mais quilobytes do que o dado vale nesta Sprint, e as duas
// colunas aceitam null — desconhecido é resposta válida.
//
// A ordem importa: Edge, Opera e Samsung também dizem "Chrome" no user agent, e
// Chrome no iPhone diz "CriOS". Quem chega primeiro na lista vence.
const BROWSERS = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/SamsungBrowser/, 'Samsung Internet'],
    [/CriOS/, 'Chrome'],
    [/FxiOS/, 'Firefox'],
    [/Firefox\//, 'Firefox'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
];

const SYSTEMS = [
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Android/, 'Android'],
    [/Mac OS X|Macintosh/, 'macOS'],
    [/Windows/, 'Windows'],
    [/Linux/, 'Linux'],
];

function matchUserAgent(table) {
    if (typeof navigator === 'undefined') return null;

    const userAgent = navigator.userAgent ?? '';
    const found = table.find(([pattern]) => pattern.test(userAgent));
    return found ? found[1] : null;
}

export function getBrowser() {
    return matchUserAgent(BROWSERS);
}

export function getOs() {
    return matchUserAgent(SYSTEMS);
}
