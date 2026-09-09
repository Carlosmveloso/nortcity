import { describe, expect, it } from 'vitest';

import { countByCategory } from './businessCatalog';
import { buildStatsSection } from '../data/statsSection';

describe('countByCategory', () => {
    const catalogo = [
        { id: 'a', categories: ['gastronomia'] },
        { id: 'b', categories: ['construcao', 'servicos'] },
        { id: 'c', categories: ['servicos'] },
    ];

    // O negócio "b" aparece nas duas listas de /categorias, então precisa ser
    // contado nas duas: contar só a primária faria o número discordar do que a
    // própria categoria lista.
    it('conta também as categorias secundárias', () => {
        const contagem = countByCategory(catalogo);

        expect(contagem.get('construcao')).toBe(1);
        expect(contagem.get('servicos')).toBe(2);
        expect(contagem.get('gastronomia')).toBe(1);
    });

    it('devolve nada para categoria sem negócio publicado', () => {
        expect(countByCategory(catalogo).get('hospedagem')).toBeUndefined();
    });

    it('aguenta catálogo vazio (o banco ainda não respondeu)', () => {
        expect(countByCategory([]).size).toBe(0);
    });
});

describe('buildStatsSection', () => {
    // Antes desta mudança o número saía de businesses.data.js e anunciava 81
    // cadastros com 80 publicados.
    it('mostra o total vindo do banco', () => {
        expect(buildStatsSection(80)[0].total).toBe('80');
    });

    it('mostra "—" enquanto a contagem não chegou, em vez de "0"', () => {
        expect(buildStatsSection(null)[0].total).toBe('—');
    });

    it('mostra zero de verdade quando o banco diz zero', () => {
        expect(buildStatsSection(0)[0].total).toBe('0');
    });
});
