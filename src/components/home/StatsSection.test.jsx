import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// O hook lê o Supabase; aqui interessa só o que a tela mostra a partir do que
// o banco responde. O cache de módulo do catálogo é limpo entre os casos.
const mockCount = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    then: (resolve, reject) => mockCount().then(resolve, reject),
                }),
            }),
        }),
    },
}));

const { resetBusinessCatalogCache } = await import('../../lib/businessCatalog');
const { default: StatsSection } = await import('./StatsSection');

describe('StatsSection', () => {
    beforeEach(() => {
        resetBusinessCatalogCache();
        mockCount.mockReset();
    });

    it('anuncia o total que o banco devolveu', async () => {
        mockCount.mockResolvedValue({ count: 80, error: null });

        render(<StatsSection />);

        expect(await screen.findByText('80')).toBeInTheDocument();
        expect(screen.getByText('Negócios cadastrados')).toBeInTheDocument();
    });

    // A tela não pode anunciar "0 negócios cadastrados" no primeiro quadro:
    // é a home, e o número aparece antes de a consulta responder.
    it('não mostra zero enquanto a contagem não chegou', () => {
        mockCount.mockReturnValue(new Promise(() => {}));

        render(<StatsSection />);

        expect(screen.getByText('—')).toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('mantém a home de pé quando a consulta falha', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockCount.mockResolvedValue({ count: null, error: new Error('sem rede') });

        render(<StatsSection />);

        expect(await screen.findByText('Negócios cadastrados')).toBeInTheDocument();
        expect(screen.getByText('—')).toBeInTheDocument();
    });
});
