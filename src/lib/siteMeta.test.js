import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { HERO_IMAGE, businessPageMeta, prerenderedRoutes } from './siteMeta';

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

// A home e o card de compartilhamento leem a mesma constante. O que ainda pode
// dar errado é ela apontar para um arquivo que não existe: o hero cairia num
// fundo vazio e o `sharp` derrubaria o build ao gerar og/default.jpg — nos dois
// casos só na hora de rodar, não aqui.
describe('HERO_IMAGE', () => {
    it('aponta para um arquivo que existe em public/', () => {
        // `join` em vez de `new URL(..., import.meta.url)`: o Vite reescreve esse
        // padrão como referência de asset e, com caminho montado em runtime,
        // devolve `undefined` em vez do arquivo.
        const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../public');

        expect(existsSync(join(publicDir, HERO_IMAGE))).toBe(true);
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
