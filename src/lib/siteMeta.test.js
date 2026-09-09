import { describe, expect, it } from 'vitest';

import { businessPageMeta, prerenderedRoutes } from './siteMeta';

// A lista de negócios não vem mais de arquivo: o build a lê do banco
// (scripts/publishedBusinesses.mjs) e passa por parâmetro. O que chega aqui,
// portanto, é dado de produção — inclusive cadastro sem descrição, que é
// opcional desde 07/09/2026.
describe('businessPageMeta', () => {
    const base = {
        id: 'restaurante-da-lia',
        name: 'Restaurante da Lia',
        subcategory: 'Restaurante',
        categories: ['gastronomia'],
        description: 'Comida caseira à beira-mar',
    };

    it('monta a descrição com a frase do negócio, a subcategoria e a chamada', () => {
        expect(businessPageMeta(base).description).toBe(
            'Comida caseira à beira-mar. Restaurante em Pitimbu, PB. Veja contato e endereço no Farol Pitimbu.'
        );
    });

    // Sem isto, um único cadastro sem descrição derrubava o build inteiro:
    // sentence(null) estourava antes de qualquer página ser escrita.
    it.each([null, undefined, '', '   '])('sobrevive a descrição %p', (description) => {
        const meta = businessPageMeta({ ...base, description });

        expect(meta.description).toBe('Restaurante em Pitimbu, PB. Veja contato e endereço no Farol Pitimbu.');
        expect(meta.title).toBe('Restaurante da Lia — Farol Pitimbu');
    });

    it('não quebra quando o negócio chega sem categoria', () => {
        const meta = businessPageMeta({ ...base, subcategory: null, categories: [] });

        expect(meta.description).toBe('Comida caseira à beira-mar. Veja contato e endereço no Farol Pitimbu.');
    });

    it('aponta a rota e o card de preview pelo slug', () => {
        expect(businessPageMeta(base).path).toBe('/negocio/restaurante-da-lia');
        expect(businessPageMeta(base).image).toBe('/og/restaurante-da-lia.jpg');
    });
});

describe('prerenderedRoutes', () => {
    it('sem negócios, ainda gera as páginas fixas — build local sem credencial não fica sem site', () => {
        const rotas = prerenderedRoutes();

        expect(rotas.some((rota) => rota.path === '/')).toBe(true);
        expect(rotas.some((rota) => rota.path.startsWith('/negocio/'))).toBe(false);
    });

    it('inclui uma rota por negócio publicado', () => {
        const rotas = prerenderedRoutes([
            { id: 'a', name: 'A', categories: ['gastronomia'], description: 'Um.' },
            { id: 'b', name: 'B', categories: ['gastronomia'], description: 'Dois.' },
        ]);

        const negocios = rotas.filter((rota) => rota.path.startsWith('/negocio/'));
        expect(negocios.map((rota) => rota.path)).toEqual(['/negocio/a', '/negocio/b']);
    });
});
