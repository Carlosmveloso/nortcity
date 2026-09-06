import { describe, expect, it } from 'vitest';
import { mapBusinessRow } from './mapBusinessRow';

function makeRow(overrides = {}) {
    return {
        id: 'uuid-1',
        slug: 'pousada-beira-mar',
        name: 'Pousada Beira Mar',
        subcategory: 'Pousada',
        description: 'Hospedagem à beira-mar.',
        address: 'Av. Beira Mar, 100',
        phone: '(83) 99999-0000',
        instagram: 'pousadabeiramar',
        website: null,
        cover_image: null,
        business_categories: [{ is_primary: true, categories: { slug: 'hospedagem' } }],
        ...overrides,
    };
}

describe('mapBusinessRow', () => {
    it('usa o slug como id público e guarda o uuid real em businessId', () => {
        const mapped = mapBusinessRow(makeRow());
        expect(mapped.id).toBe('pousada-beira-mar');
        expect(mapped.businessId).toBe('uuid-1');
    });

    it('ordena categorias colocando a primária primeiro', () => {
        const row = makeRow({
            business_categories: [
                { is_primary: false, categories: { slug: 'gastronomia' } },
                { is_primary: true, categories: { slug: 'hospedagem' } },
            ],
        });
        expect(mapBusinessRow(row).categories).toEqual(['hospedagem', 'gastronomia']);
    });

    it('usa cover_image do banco quando presente', () => {
        const row = makeRow({ cover_image: 'https://cdn.example.com/cover.webp' });
        expect(mapBusinessRow(row).image).toBe('https://cdn.example.com/cover.webp');
    });

    it('não inventa imagem quando cover_image é null', () => {
        const row = makeRow({ cover_image: null });
        expect(mapBusinessRow(row).image).toBeNull();
    });
});
