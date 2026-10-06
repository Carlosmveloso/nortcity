import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    benefitSummary,
    couponValidityLabel,
    describeOffer,
    formatMoney,
    latestAdminMessage,
    periodSummary,
    scheduleLines,
} from './offers';
import { offerErrorMessage } from './offerErrors';

describe('apresentação da oferta', () => {
    it('resume benefício, período, horários e validade', () => {
        expect(benefitSummary({ benefit_type: 'percentage_discount', benefit_value: '20.00' })).toBe('20% de desconto');
        expect(benefitSummary({ benefit_type: 'fixed_discount', benefit_value: '15.00' })).toMatch(/R\$\s15,00 de desconto/);
        expect(benefitSummary({ benefit_type: 'gift', benefit_value: null })).toBe('Brinde');
        expect(periodSummary({ starts_at: '2026-11-01T03:00:00Z', ends_at: '2026-12-01T02:59:59Z' })).toBe(
            '01/11/2026 a 30/11/2026'
        );
        expect(scheduleLines({ days_of_week: [1, 2, 3, 4, 5], time_windows: [] })).toEqual(['Segunda a sexta · dia inteiro']);
        expect(
            scheduleLines({
                days_of_week: [2, 1],
                time_windows: [
                    { day: 2, start: '18:00', end: '22:00' },
                    { day: 1, start: '11:00', end: '15:00' },
                    { day: 2, start: '11:00', end: '15:00' },
                ],
            })
        ).toEqual(['Segunda: 11:00–15:00', 'Terça: 11:00–15:00, 18:00–22:00']);
        expect(couponValidityLabel(1440)).toBe('24 horas');
        expect(couponValidityLabel(90)).toBe('90 minutos');
        expect(formatMoney('1.50')).toMatch(/R\$\s1,50/);
    });

    it('descreve revisão de oferta ativa sem mudar o status', () => {
        const offer = { id: 'o1', published_version_id: 'v1', status: 'active' };
        const versions = [
            { id: 'v2', offer_id: 'o1', version_number: 2, review_status: 'submitted' },
            { id: 'v1', offer_id: 'o1', version_number: 1, review_status: 'approved' },
        ];
        expect(describeOffer(offer, versions)).toMatchObject({
            latest: { id: 'v2' },
            published: { id: 'v1' },
            display: { id: 'v1' },
            revisionStatus: 'submitted',
            awaitingReview: true,
        });
        expect(describeOffer({ id: 'o1', published_version_id: null }, versions.slice(1))).toMatchObject({
            revisionStatus: null,
            display: { id: 'v1' },
        });
    });

    it('pega a mensagem administrativa mais recente', () => {
        const reviews = [
            { action: 'changes_requested', message: 'Primeiro', created_at: '2026-10-05T10:00:00Z' },
            { action: 'resubmitted', message: null, created_at: '2026-10-05T11:00:00Z' },
            { action: 'changes_requested', message: 'Segundo', created_at: '2026-10-05T12:00:00Z' },
        ];
        expect(latestAdminMessage(reviews).message).toBe('Segundo');
    });
});

describe('offerErrorMessage', () => {
    afterEach(() => vi.restoreAllMocks());

    it('traduz códigos das RPCs sem expor o identificador', () => {
        expect(offerErrorMessage({ message: 'plan_offer_limit_reached' })).toBe(
            'Este negócio atingiu o limite de ofertas ativas do plano atual.'
        );
        expect(offerErrorMessage({ message: 'plan_fee_unavailable' })).toMatch(/plano atual não inclui publicação/);
        for (const code of ['direct_write_not_allowed', 'invalid_transition', 'version_immutable', 'fee_changed']) {
            const text = offerErrorMessage({ message: code });
            expect(text).not.toContain(code);
            expect(text.length).toBeGreaterThan(10);
        }
    });

    it('traduz violação de constraint pelo nome', () => {
        expect(
            offerErrorMessage({
                code: '23514',
                message: 'new row for relation "offer_versions" violates check constraint "offer_versions_period_check"',
            })
        ).toBe('A data final precisa ser posterior à data inicial.');
    });

    it('erro desconhecido vira mensagem genérica, sem código', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const text = offerErrorMessage({ message: 'something_new', code: 'P0001' });
        expect(text).toBe('Não foi possível concluir. Tente novamente em instantes.');
        expect(text).not.toContain('something_new');
    });
});
