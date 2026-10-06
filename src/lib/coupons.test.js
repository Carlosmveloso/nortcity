import { afterEach, describe, expect, it, vi } from 'vitest';
import { couponDisplayStatus, couponErrorMessage, couponQrPayload, formatCouponDateTime } from './coupons';

describe('apresentação do cupom', () => {
    it('mostra data e hora no horário de Pitimbu', () => {
        // 02:59:59 UTC do dia 21 = 23:59:59 do dia 20 em Pitimbu.
        expect(formatCouponDateTime('2026-11-21T02:59:59Z')).toBe('20/11/2026 às 23:59');
        expect(formatCouponDateTime('2026-10-06T21:42:00Z')).toBe('06/10/2026 às 18:42');
    });

    it('disponível vencido aparece como expirado', () => {
        const now = new Date('2026-10-06T12:00:00Z');
        expect(couponDisplayStatus({ status: 'available', expires_at: '2026-10-06T11:59:59Z' }, now)).toBe('expired');
        expect(couponDisplayStatus({ status: 'available', expires_at: '2026-10-06T12:00:01Z' }, now)).toBe('available');
        expect(couponDisplayStatus({ status: 'canceled', expires_at: '2026-10-07T00:00:00Z' }, now)).toBe('canceled');
    });

    it('QR leva só o token opaco', () => {
        expect(couponQrPayload('abc_DEF-123')).toBe('farol-cupom:1:abc_DEF-123');
        expect(couponQrPayload(null)).toBeNull();
    });
});

describe('couponErrorMessage', () => {
    afterEach(() => vi.restoreAllMocks());

    it('traduz os códigos de geração sem expor o identificador', () => {
        for (const code of ['offer_sold_out', 'coupon_already_available', 'terms_not_accepted', 'offer_not_started', 'offer_expired', 'terms_outdated']) {
            const text = couponErrorMessage({ message: code });
            expect(text).not.toContain(code);
            expect(text.length).toBeGreaterThan(15);
        }
        expect(couponErrorMessage({ message: 'offer_sold_out' })).toMatch(/temporariamente esgotados/);
    });

    it('erro desconhecido vira mensagem genérica', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(couponErrorMessage({ message: 'xyz', code: 'P0001' })).toBe('Não foi possível concluir. Tente novamente em instantes.');
    });
});
