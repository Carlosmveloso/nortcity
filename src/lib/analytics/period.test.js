import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, periodRange, periodLabel } from './period';

// Terça-feira, 15h30 no horário local de quem roda o teste.
const AGORA = new Date(2026, 8, 15, 15, 30, 0);

describe('periodRange', () => {
    it('"Hoje" começa na meia-noite local, não 24 horas atrás', () => {
        const { startAt, endAt } = periodRange('today', AGORA);

        expect(new Date(startAt).getTime()).toBe(new Date(2026, 8, 15, 0, 0, 0, 0).getTime());
        expect(new Date(endAt).getTime()).toBe(AGORA.getTime());
    });

    it('as janelas de dias contam para trás a partir de agora', () => {
        const dia = 24 * 60 * 60 * 1000;

        for (const [valor, dias] of [
            ['7d', 7],
            ['30d', 30],
            ['90d', 90],
        ]) {
            const { startAt } = periodRange(valor, AGORA);
            expect(new Date(startAt).getTime()).toBe(AGORA.getTime() - dias * dia);
        }
    });

    it('sempre devolve início antes do fim — a RPC recusa o contrário', () => {
        for (const option of PERIOD_OPTIONS) {
            const { startAt, endAt } = periodRange(option.value, AGORA);
            expect(new Date(startAt).getTime()).toBeLessThan(new Date(endAt).getTime());
        }
    });

    it('valor desconhecido cai no padrão em vez de gerar intervalo inválido', () => {
        expect(periodRange('ontem', AGORA)).toEqual(periodRange(DEFAULT_PERIOD, AGORA));
    });
});

describe('periodLabel', () => {
    it('traduz o valor para o rótulo da tela', () => {
        expect(periodLabel('30d')).toBe('30 dias');
        expect(periodLabel('today')).toBe('Hoje');
    });
});
