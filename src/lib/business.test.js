import { describe, expect, it } from 'vitest';
import { categoryLabel, toWhatsappLink } from './business';

describe('toWhatsappLink', () => {
    it('monta o link wa.me com o DDI 55 e só dígitos', () => {
        expect(toWhatsappLink('(83) 99113-4990')).toBe('https://wa.me/5583991134990');
    });

    it('remove qualquer caractere não numérico', () => {
        expect(toWhatsappLink('83 9 9113.4990')).toBe('https://wa.me/5583991134990');
    });

    it('preenche a mensagem sem perder acentos, espaços ou caracteres especiais', () => {
        const message = 'Olá! Vi Café & Mar no Farol Pitimbu. Gostaria de informações?';
        const url = new URL(toWhatsappLink('(83) 99113-4990', message));
        expect(url.pathname).toBe('/5583991134990');
        expect(url.searchParams.get('text')).toBe(message);
        expect([...url.searchParams.keys()]).toEqual(['text']);
    });

    // Telefone é opcional: basta um contato público qualquer para publicar. Um
    // negócio cadastrado só com WhatsApp chegava aqui como null e derrubava a
    // listagem inteira (segunda página de /explorar?categoria=servicos).
    it.each([null, undefined, '', '   ', '---'])('devolve null quando não há número (%p)', (phone) => {
        expect(toWhatsappLink(phone)).toBeNull();
    });
});

describe('categoryLabel', () => {
    it('traduz um slug conhecido pro rótulo em PT-BR', () => {
        expect(categoryLabel('gastronomia')).toBe('Gastronomia');
    });

    it('devolve o próprio slug quando não reconhece a categoria', () => {
        expect(categoryLabel('slug-inexistente')).toBe('slug-inexistente');
    });
});
