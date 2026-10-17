import { describe, expect, it } from 'vitest';
import {
    buildOfferPayload,
    emptyOfferForm,
    firstStepWithErrors,
    offerFormFromVersion,
    offerPeriodEnded,
    parseDecimal,
    validateOfferStep,
} from './offerForm';

function form(overrides = {}) {
    return {
        ...emptyOfferForm,
        windows: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
        title: '20% no almoço',
        description: 'Desconto no almoço executivo.',
        benefitType: 'percentage_discount',
        benefitValue: '20',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        limitMode: 'limited',
        totalLimit: '100',
        perUserLimit: '1',
        couponValidityMinutes: '1440',
        ...overrides,
    };
}

describe('parseDecimal', () => {
    it('aceita vírgula, ponto e prefixo R$', () => {
        expect(parseDecimal('15,50')).toBe(15.5);
        expect(parseDecimal('R$ 1.234,56')).toBe(1234.56);
        expect(parseDecimal('80')).toBe(80);
        expect(parseDecimal('')).toBeNull();
        expect(parseDecimal('abc')).toBeNaN();
        expect(parseDecimal('1,234')).toBeNaN();
    });
});

describe('buildOfferPayload', () => {
    it('monta datas no fuso de Pitimbu e o payload completo', () => {
        expect(buildOfferPayload(form())).toEqual({
            title: '20% no almoço',
            description: 'Desconto no almoço executivo.',
            benefit_type: 'percentage_discount',
            benefit_value: 20,
            starts_at: '2026-11-01T00:00:00-03:00',
            ends_at: '2026-11-30T23:59:59-03:00',
            days_of_week: [1, 2, 3, 4, 5, 6, 7],
            time_windows: [],
            minimum_purchase: null,
            eligible_items: null,
            stackable: false,
            conditions: null,
            total_limit: 100,
            per_user_limit: 1,
            coupon_validity_minutes: 1440,
        });
    });

    it('brinde descarta valor e "sem limite" envia total nulo', () => {
        const payload = buildOfferPayload(form({ benefitType: 'gift', benefitValue: '20', limitMode: 'unlimited' }));
        expect(payload.benefit_value).toBeNull();
        expect(payload.total_limit).toBeNull();
    });

    it('horários estruturados por dia, ordenados', () => {
        const payload = buildOfferPayload(
            form({
                days: [2, 1],
                hoursMode: 'windows',
                windows: {
                    ...form().windows,
                    1: [{ start: '11:00', end: '15:00' }],
                    2: [
                        { start: '18:00', end: '22:00' },
                        { start: '11:00', end: '15:00' },
                    ],
                },
            })
        );
        expect(payload.days_of_week).toEqual([1, 2]);
        expect(payload.time_windows).toEqual([
            { day: 1, start: '11:00', end: '15:00' },
            { day: 2, start: '11:00', end: '15:00' },
            { day: 2, start: '18:00', end: '22:00' },
        ]);
    });

    it('ida e volta pela versão preserva os campos', () => {
        const version = {
            ...buildOfferPayload(form({ minimumPurchase: '80', conditions: 'Só no salão' })),
            benefit_value: '20.00',
            minimum_purchase: '80.00',
        };
        const back = offerFormFromVersion(version);
        expect(back).toMatchObject({ title: '20% no almoço', benefitValue: '20', minimumPurchase: '80', startDate: '2026-11-01', endDate: '2026-11-30' });
        expect(buildOfferPayload(back)).toEqual(buildOfferPayload(form({ minimumPurchase: '80', conditions: 'Só no salão' })));
    });
});

describe('validateOfferStep', () => {
    it('formulário completo passa em todas as etapas', () => {
        expect(validateOfferStep(form(), 4)).toEqual({});
        expect(firstStepWithErrors(form())).toBeNull();
    });

    it('espelha as constraints do banco', () => {
        expect(validateOfferStep(form({ benefitValue: '120' }), 1).benefitValue).toMatch(/0 a 100/);
        expect(validateOfferStep(form({ benefitType: 'fixed_discount', benefitValue: '0' }), 1).benefitValue).toBeTruthy();
        expect(validateOfferStep(form({ title: 'Oi' }), 1).title).toMatch(/entre 3 e 80/);
        expect(validateOfferStep(form({ endDate: '2026-10-01' }), 2).endDate).toBeTruthy();
        expect(validateOfferStep(form({ days: [] }), 2).days).toBeTruthy();
        expect(validateOfferStep(form({ totalLimit: '0' }), 3).totalLimit).toBeTruthy();
        expect(validateOfferStep(form({ totalLimit: '2', perUserLimit: '3' }), 3).perUserLimit).toMatch(/quantidade total/);
        expect(validateOfferStep(form({ perUserLimit: '0' }), 3).perUserLimit).toBeTruthy();
    });

    it('quantidade total exige escolha explícita', () => {
        expect(validateOfferStep(form({ limitMode: '' }), 3).totalLimit).toMatch(/Escolha se a oferta/);
        expect(offerFormFromVersion({ total_limit: null, coupon_validity_minutes: null }).limitMode).toBe('');
        expect(offerFormFromVersion({ total_limit: null, coupon_validity_minutes: 60 }).limitMode).toBe('unlimited');
    });

    it('brinde não exige valor', () => {
        expect(validateOfferStep(form({ benefitType: 'gift', benefitValue: '' }), 1)).toEqual({});
    });

    it('horários: cada dia escolhido precisa de faixa válida e sem sobreposição', () => {
        const base = { days: [1], hoursMode: 'windows' };
        expect(validateOfferStep(form(base), 2).windows).toMatch(/ao menos um horário/);
        const windows = (list) => ({ ...form().windows, 1: list });
        expect(validateOfferStep(form({ ...base, windows: windows([{ start: '15:00', end: '11:00' }]) }), 2).windows).toMatch(
            /terminar depois/
        );
        expect(
            validateOfferStep(
                form({
                    ...base,
                    windows: windows([
                        { start: '11:00', end: '15:00' },
                        { start: '14:00', end: '16:00' },
                    ]),
                }),
                2
            ).windows
        ).toMatch(/sobrepor/);
    });

    it('rascunho (não estrito) aceita campos vazios, mas não valores inválidos', () => {
        const partial = { ...emptyOfferForm, windows: form().windows, title: 'Oferta parcial' };
        expect(validateOfferStep(partial, 4, { strict: false })).toEqual({});
        expect(validateOfferStep({ ...partial, limitMode: 'limited', totalLimit: '-1' }, 3, { strict: false }).totalLimit).toBeTruthy();
        expect(firstStepWithErrors(partial)).toBe(1);
    });
});

describe('offerPeriodEnded', () => {
    it('considera o fim do dia em Pitimbu', () => {
        expect(offerPeriodEnded(form({ endDate: '2026-10-05' }), new Date('2026-10-06T02:00:00Z'))).toBe(false);
        expect(offerPeriodEnded(form({ endDate: '2026-10-05' }), new Date('2026-10-06T03:00:00Z'))).toBe(true);
    });
});
