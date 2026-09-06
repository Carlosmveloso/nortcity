import { describe, expect, it } from 'vitest';
import { normalize } from './text';

describe('normalize', () => {
    it('deixa o texto em minúsculas', () => {
        expect(normalize('Pousada')).toBe('pousada');
    });

    it('remove acentos pra "café" bater com "cafe"', () => {
        expect(normalize('café')).toBe('cafe');
    });

    it('permite que buscas ignorem acento e caixa ao mesmo tempo', () => {
        expect(normalize('Açaí Pitimbu')).toBe(normalize('acai pitimbu'));
    });
});
