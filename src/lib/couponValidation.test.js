import { describe, expect, it } from 'vitest';
import { readCouponInput, validationErrorMessage } from './couponValidation';

describe('readCouponInput', () => {
    it('normaliza o código como o banco', () => {
        for (const input of ['FP-7A39K2', ' fp-7a39k2 ', 'FP7A39K2', '7a39k2', 'fp 7a3 9k2']) {
            expect(readCouponInput(input)).toEqual({ method: 'code', value: 'FP-7A39K2' });
        }
        expect(readCouponInput('FP-0O1IL2')).toBeNull();
        expect(readCouponInput('')).toBeNull();
    });

    it('reconhece o conteúdo do QR', () => {
        const payload = `farol-cupom:1:${'a'.repeat(43)}`;
        expect(readCouponInput(payload)).toEqual({ method: 'qr', value: payload });
        expect(readCouponInput('farol-cupom:1:curto')).toBeNull();
    });
});

describe('validationErrorMessage', () => {
    it('traduz os códigos da validação sem expor o identificador', () => {
        for (const code of ['coupon_already_used', 'coupon_expired', 'offer_time_window_not_allowed', 'not_a_validator', 'coupon_not_found', 'user_limit_reached', 'account_not_found']) {
            const text = validationErrorMessage({ message: code });
            expect(text).not.toContain(code);
            expect(text.length).toBeGreaterThan(15);
        }
    });
});
