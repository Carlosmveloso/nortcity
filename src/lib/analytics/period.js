// Períodos do painel. Os limites são calculados no navegador, em horário local,
// e enviados como instante ISO; o Postgres compara timestamptz com timestamptz,
// sem conversão implícita no meio. "Hoje" é o início do dia de quem está
// olhando a tela — que é a leitura certa para um painel operado de Pitimbu.
export const PERIOD_OPTIONS = [
    { value: 'today', label: 'Hoje' },
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' },
];

export const DEFAULT_PERIOD = '7d';

const DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} value um dos `PERIOD_OPTIONS`
 * @param {Date} [now] só para os testes
 * @returns {{ startAt: string, endAt: string }} instantes ISO
 */
export function periodRange(value, now = new Date()) {
    const startAt =
        value === 'today'
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
            : new Date(now.getTime() - (DAYS[value] ?? DAYS[DEFAULT_PERIOD]) * DAY_MS);

    return { startAt: startAt.toISOString(), endAt: new Date(now).toISOString() };
}

export function periodLabel(value) {
    return PERIOD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
