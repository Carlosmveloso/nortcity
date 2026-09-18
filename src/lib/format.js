// Números do painel em pt-BR. O Postgres devolve `numeric` como string (o
// PostgREST preserva a precisão), e `bigint` como número — por isso tudo passa
// por Number() antes de formatar.
const NUMBER = new Intl.NumberFormat('pt-BR');
const DECIMAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Travessão para ausência de dado: "0" diria que a medição aconteceu e deu
// zero, que é outra coisa.
const EMPTY = '—';

function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function formatNumber(value) {
    const number = toNumber(value);
    return number === null ? EMPTY : NUMBER.format(number);
}

export function formatDecimal(value) {
    const number = toNumber(value);
    return number === null ? EMPTY : DECIMAL.format(number);
}

export function formatPercent(value) {
    const number = toNumber(value);
    return number === null ? EMPTY : `${DECIMAL.format(number)}%`;
}

const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});
const RELATIVE = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const UNITS = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
];

// `new Date('2026-09-14')` é interpretado como meia-noite UTC, que no Brasil é
// 21h do dia 13 — uma data pura exibida assim aparece um dia antes. Por isso a
// string de data é montada com os componentes locais, e só o que tem hora passa
// pelo construtor normal.
function toDate(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
    const date = toDate(value);
    return date === null ? EMPTY : DATE.format(date);
}

export function formatDateTime(value) {
    const date = toDate(value);
    return date === null ? EMPTY : DATE_TIME.format(date);
}

export function formatRelativeTime(value, now = Date.now()) {
    const date = toDate(value);
    if (date === null) return EMPTY;

    const seconds = Math.round((date.getTime() - now) / 1000);
    const distancia = Math.abs(seconds);
    if (distancia < 60) return 'agora mesmo';

    for (const [unit, size] of UNITS) {
        if (distancia >= size) return RELATIVE.format(Math.round(seconds / size), unit);
    }

    return 'agora mesmo';
}
