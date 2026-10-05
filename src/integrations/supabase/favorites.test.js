import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFavorites, persistFavorite } from './favorites';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));
beforeEach(() => mocks.from.mockReset());

function query(result) {
    const chain = {};
    for (const method of ['select', 'eq', 'order', 'delete']) chain[method] = vi.fn(() => chain);
    chain.range = vi.fn().mockResolvedValue(result);
    chain.insert = vi.fn().mockResolvedValue(result);
    chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    mocks.from.mockReturnValue(chain);
    return chain;
}

describe('integração de favoritos', () => {
    it('mapeia só negócios ativos sem perder vínculos invisíveis', async () => {
        const chain = query({
            data: [
                {
                    business_id: 'active',
                    businesses: {
                        id: 'active',
                        slug: 'publicado',
                        name: 'Publicado',
                        status: 'active',
                        business_categories: [],
                    },
                },
                { business_id: 'pending', businesses: { status: 'pending' } },
                { business_id: 'hidden', businesses: null },
            ],
            error: null,
        });
        const rows = await fetchFavorites('alice');
        expect(rows).toMatchObject([
            { businessId: 'active', business: { id: 'publicado', businessId: 'active' } },
            { businessId: 'pending', business: null },
            { businessId: 'hidden', business: null },
        ]);
        expect(chain.eq).toHaveBeenCalledWith('user_id', 'alice');
    });
    it('busca páginas seguintes para não truncar listas grandes', async () => {
        const chain = query({ data: [{ business_id: 'last', businesses: null }], error: null });
        chain.range.mockResolvedValueOnce({
            data: Array.from({ length: 500 }, (_, i) => ({
                business_id: String(i),
                businesses: null,
            })),
            error: null,
        });
        const rows = await fetchFavorites('alice');
        expect(rows).toHaveLength(501);
        expect(chain.range.mock.calls).toEqual([
            [0, 499],
            [500, 999],
        ]);
    });
    it('duplicata já salva é sucesso, outras falhas são propagadas', async () => {
        query({ error: { code: '23505' } });
        await expect(persistFavorite('alice', 'business', true)).resolves.toBeUndefined();
        query({ error: { code: '42501' } });
        await expect(persistFavorite('alice', 'business', true)).rejects.toMatchObject({
            code: '42501',
        });
    });
    it('remoção exige filtros explícitos de usuário e negócio', async () => {
        const chain = query({ error: null });
        await persistFavorite('alice', 'business', false);
        expect(chain.eq.mock.calls).toEqual([
            ['user_id', 'alice'],
            ['business_id', 'business'],
        ]);
    });
});
