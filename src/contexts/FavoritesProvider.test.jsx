import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesProvider } from './FavoritesProvider';
import FavoriteButton from '@/components/ui/FavoriteButton';
import { useFavorites } from '@/hooks/useFavorites';

const mocks = vi.hoisted(() => ({
    auth: { user: { id: 'alice' }, loading: false },
    fetch: vi.fn(),
    persist: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/integrations/supabase/favorites', () => ({
    fetchFavorites: mocks.fetch,
    persistFavorite: mocks.persist,
}));
const business = { businessId: 'b1', id: 'negocio', name: 'Negócio X' };

function Probe() {
    const { businesses, loading, error } = useFavorites();
    return (
        <>
            <p>{loading ? 'carregando' : businesses.map((b) => b.name).join(',') || 'vazio'}</p>
            {error && <p>{error}</p>}
            <FavoriteButton business={business} variant="full" />
        </>
    );
}
const tree = () => (
    <MemoryRouter>
        <FavoritesProvider>
            <Probe />
        </FavoritesProvider>
    </MemoryRouter>
);
beforeEach(() => {
    mocks.auth = { user: { id: 'alice' }, loading: false };
    mocks.fetch.mockReset().mockResolvedValue([]);
    mocks.persist.mockReset().mockResolvedValue(undefined);
});

describe('sincronização de favoritos', () => {
    it('salva e remove após confirmação do servidor', async () => {
        render(tree());
        const button = await screen.findByRole('button', { name: /Salvar Negócio X/ });
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);
        await screen.findByRole('button', { name: /Remover Negócio X/ });
        expect(mocks.persist).toHaveBeenCalledWith('alice', 'b1', true);
        expect(screen.getByText('Negócio X')).toBeInTheDocument();
        fireEvent.click(button);
        await screen.findByText('vazio');
        expect(mocks.persist).toHaveBeenLastCalledWith('alice', 'b1', false);
    });
    it('falha ao gravar mantém o estado e permite repetir', async () => {
        mocks.persist.mockRejectedValueOnce(new Error('rede'));
        render(tree());
        const button = screen.getByRole('button');
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
        expect(button).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(button);
        await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    it('não dispara duas gravações enquanto uma está pendente', async () => {
        let finish;
        mocks.persist.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        render(tree());
        const button = screen.getByRole('button');
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);
        fireEvent.click(button);
        expect(mocks.persist).toHaveBeenCalledTimes(1);
        expect(button).toHaveAttribute('aria-busy', 'true');
        await act(async () => {
            finish();
        });
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });
    it('falha ao remover preserva o negócio salvo', async () => {
        mocks.fetch.mockResolvedValue([{ businessId: 'b1', business }]);
        mocks.persist.mockRejectedValueOnce(new Error('rede'));
        render(tree());
        const button = await screen.findByRole('button', { name: /Remover Negócio X/ });
        fireEvent.click(button);
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível remover');
        expect(screen.getByText('Negócio X')).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });
    it('troca de conta descarta uma resposta atrasada da conta anterior', async () => {
        let finish;
        mocks.fetch.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const { rerender } = render(tree());
        mocks.auth = { user: { id: 'bob' }, loading: false };
        rerender(tree());
        await screen.findByText('vazio');
        await act(async () => {
            finish([{ businessId: 'b1', business }]);
        });
        expect(screen.queryByText('Negócio X')).not.toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });
    it('logout limpa a lista e não carrega favoritos anônimos', async () => {
        mocks.fetch.mockResolvedValue([{ businessId: 'b1', business }]);
        const { rerender } = render(tree());
        await screen.findByText('Negócio X');
        mocks.auth = { user: null, loading: false };
        rerender(tree());
        expect(screen.getByText('vazio')).toBeInTheDocument();
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });
    it('gravação concluída depois da troca de conta não contamina a nova lista', async () => {
        let finish;
        mocks.persist.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const { rerender } = render(tree());
        await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
        fireEvent.click(screen.getByRole('button'));
        mocks.auth = { user: { id: 'bob' }, loading: false };
        rerender(tree());
        await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
        await act(async () => {
            finish();
        });
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByText('Negócio X')).not.toBeInTheDocument();
    });
    it('falha de leitura exige recarregar antes de gravar e oculta negócios não públicos', async () => {
        mocks.fetch
            .mockRejectedValueOnce(new Error('rede'))
            .mockResolvedValueOnce([{ businessId: 'hidden', business: null }]);
        render(tree());
        fireEvent.click(
            await screen.findByRole('button', { name: 'Tentar carregar favoritos novamente' }),
        );
        await waitFor(() => expect(screen.getByRole('button', { name: /Salvar/ })).toBeEnabled());
        expect(screen.getByText('vazio')).toBeInTheDocument();
        expect(mocks.persist).not.toHaveBeenCalled();
    });
});
