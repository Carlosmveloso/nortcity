import { describe, expect, it } from 'vitest';
import {
    buildAddress,
    buildBusinessPayload,
    emptyBusinessForm,
    hasPublicContact,
    isValidContact,
    nextPrimaryCategory,
    validateBusinessForm,
} from './businessForm';

function form(overrides = {}) {
    return {
        ...emptyBusinessForm,
        name: 'Pousada Beira Mar',
        categories: ['cat-1'],
        primaryCategoryId: 'cat-1',
        description: 'Pousada pé na areia com oito quartos e café da manhã incluso.',
        street: 'Av. Beira Mar',
        number: '100',
        neighborhood: 'Centro',
        phone: '(83) 99999-0000',
        ...overrides,
    };
}

describe('isValidContact', () => {
    it('exige telefone com DDD', () => {
        expect(isValidContact('phone', '(83) 99999-0000')).toBe(true);
        expect(isValidContact('phone', '99999')).toBe(false);
        expect(isValidContact('phone', 'liga lá')).toBe(false);
    });

    it('exige e-mail com domínio e site com ponto', () => {
        expect(isValidContact('email', 'contato@pousada.com.br')).toBe(true);
        expect(isValidContact('email', 'contato')).toBe(false);
        expect(isValidContact('website', 'pousada.com.br')).toBe(true);
        expect(isValidContact('website', 'pousada')).toBe(false);
    });
});

describe('validateBusinessForm', () => {
    it('aceita um cadastro completo', () => {
        expect(validateBusinessForm(form())).toEqual({});
    });

    it('exige descrição informativa', () => {
        expect(validateBusinessForm(form({ description: 'Muito bom' })).description).toMatch(/40 caracteres/);
        expect(validateBusinessForm(form({ description: 'a'.repeat(1501) })).description).toMatch(/1500/);
    });

    it('exige categoria principal explícita quando há mais de uma', () => {
        expect(validateBusinessForm(form({ categories: ['a', 'b'], primaryCategoryId: null })).primaryCategoryId)
            .toBeTruthy();
        expect(validateBusinessForm(form({ categories: ['a', 'b'], primaryCategoryId: 'b' })).primaryCategoryId)
            .toBeUndefined();
    });

    it('limita a três categorias', () => {
        expect(validateBusinessForm(form({ categories: ['a', 'b', 'c', 'd'], primaryCategoryId: 'a' })).categories)
            .toMatch(/no máximo 3 categorias/);
    });

    it('aceita autônomo sem endereço público, mas exige a área de atendimento', () => {
        const autonomo = form({
            hasPublicAddress: false,
            street: '',
            number: '',
            neighborhood: '',
            serviceArea: 'Pitimbu e Acaú',
            phone: '',
            whatsapp: '(83) 98888-1234',
        });
        expect(validateBusinessForm(autonomo)).toEqual({});
        expect(validateBusinessForm({ ...autonomo, serviceArea: '' }).serviceArea).toBeTruthy();
    });

    it('exige ao menos um contato público válido', () => {
        expect(validateBusinessForm(form({ phone: '' })).contact).toBeTruthy();
        expect(validateBusinessForm(form({ phone: '', instagram: 'pousadabeiramar' })).contact).toBeUndefined();
    });
});

describe('buildBusinessPayload', () => {
    it('junta rua e número e remove o @ do Instagram', () => {
        const payload = buildBusinessPayload(form({ instagram: '@pousadabeiramar' }));
        expect(payload.address).toBe('Av. Beira Mar, 100');
        expect(payload.instagram).toBe('pousadabeiramar');
    });

    it('não publica endereço quando o negócio atende sem ponto fixo', () => {
        const payload = buildBusinessPayload(
            form({ hasPublicAddress: false, serviceArea: 'Pitimbu' })
        );
        expect(payload.address).toBeNull();
        expect(payload.service_area).toBe('Pitimbu');
    });

    it('campos vazios viram null em vez de string vazia', () => {
        expect(buildBusinessPayload(form({ whatsapp: '   ' })).whatsapp).toBeNull();
    });
});

describe('nextPrimaryCategory', () => {
    it('marca a única categoria como principal', () => {
        expect(nextPrimaryCategory(['a'], null)).toBe('a');
    });

    it('mantém a principal enquanto ela continuar selecionada', () => {
        expect(nextPrimaryCategory(['a', 'b'], 'b')).toBe('b');
        expect(nextPrimaryCategory(['a', 'c'], 'b')).toBeNull();
    });
});

describe('buildAddress e hasPublicContact', () => {
    it('endereço vazio vira null', () => {
        expect(buildAddress(form({ street: '', number: '' }))).toBeNull();
    });

    it('reconhece contato válido em qualquer um dos cinco campos', () => {
        expect(hasPublicContact(form({ phone: '', website: 'pousada.com.br' }))).toBe(true);
        expect(hasPublicContact(form({ phone: '', website: '' }))).toBe(false);
    });
});
