import { describe, expect, it } from 'vitest';
import { formatDate, formatDecimal, formatNumber, formatPercent, formatRelativeTime } from './format';

describe('formatNumber', () => {
    it('agrupa milhar no padrão brasileiro', () => {
        expect(formatNumber(1284)).toBe('1.284');
        expect(formatNumber(12531)).toBe('12.531');
        expect(formatNumber(0)).toBe('0');
    });

    // O PostgREST devolve `numeric` como string para não perder precisão, então
    // metade dos números do painel chega assim.
    it('aceita número em string', () => {
        expect(formatNumber('1284')).toBe('1.284');
    });

    it('mostra travessão no que não é número — "0" diria outra coisa', () => {
        expect(formatNumber(null)).toBe('—');
        expect(formatNumber(undefined)).toBe('—');
        expect(formatNumber('')).toBe('—');
        expect(formatNumber('quebrado')).toBe('—');
    });
});

describe('formatPercent', () => {
    it('usa vírgula decimal e uma casa', () => {
        expect(formatPercent(42.7)).toBe('42,7%');
        expect(formatPercent('100.0')).toBe('100,0%');
        expect(formatPercent(0)).toBe('0,0%');
    });

    it('taxa ausente não vira zero por cento', () => {
        expect(formatPercent(null)).toBe('—');
    });
});

describe('formatDecimal', () => {
    it('mantém uma casa para média de resultados', () => {
        expect(formatDecimal('1.5')).toBe('1,5');
        expect(formatDecimal(12)).toBe('12,0');
        expect(formatDecimal(null)).toBe('—');
    });
});

describe('formatDate', () => {
    // O bug clássico: `new Date('2026-09-14')` é meia-noite UTC, que no Brasil é
    // 21h do dia 13 — a data pura do banco apareceria um dia antes.
    it('não desloca uma data pura para o dia anterior', () => {
        expect(formatDate('2026-09-14')).toBe('14/09/2026');
        expect(formatDate('2026-01-01')).toBe('01/01/2026');
    });

    it('aceita instante com hora e devolve travessão no vazio', () => {
        expect(formatDate('2026-09-14T15:30:00-03:00')).toBe('14/09/2026');
        expect(formatDate(null)).toBe('—');
        expect(formatDate('quebrado')).toBe('—');
    });
});

describe('formatRelativeTime', () => {
    const agora = Date.parse('2026-09-15T12:00:00-03:00');

    it('descreve a distância em português', () => {
        expect(formatRelativeTime('2026-09-15T11:58:00-03:00', agora)).toBe('há 2 minutos');
        expect(formatRelativeTime('2026-09-15T09:00:00-03:00', agora)).toBe('há 3 horas');
        expect(formatRelativeTime('2026-09-13T12:00:00-03:00', agora)).toBe('anteontem');
    });

    it('menos de um minuto é agora mesmo', () => {
        expect(formatRelativeTime('2026-09-15T11:59:30-03:00', agora)).toBe('agora mesmo');
    });

    it('sem valor, travessão', () => {
        expect(formatRelativeTime(null, agora)).toBe('—');
    });
});
