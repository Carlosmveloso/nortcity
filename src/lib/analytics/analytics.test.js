import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
    supabase: { rpc: (...args) => rpc(...args) },
}));

async function carregar(flag = 'true') {
    vi.resetModules();
    vi.stubEnv('VITE_ANALYTICS_ENABLED', flag);
    return import('./analytics');
}

beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('ambiente', () => {
    // O .env local aponta para o mesmo projeto Supabase de produção: coletar em
    // desenvolvimento sujaria a base de verdade.
    it('sem a variável definida, não coleta fora de produção', async () => {
        const { analyticsEnabled } = await carregar('');
        expect(analyticsEnabled).toBe(false);
    });

    it('a variável vence nos dois sentidos', async () => {
        expect((await carregar('true')).analyticsEnabled).toBe(true);
        expect((await carregar('false')).analyticsEnabled).toBe(false);
    });

    it('desligado, não toca no banco', async () => {
        const { track } = await carregar('false');
        await track('page_view');
        expect(rpc).not.toHaveBeenCalled();
    });
});

describe('track', () => {
    it('preenche sozinho sessão, visitante, caminho e dispositivo', async () => {
        const { track } = await carregar();
        await track('business_view', { entityType: 'business', entityId: 'uuid-do-negocio' });

        expect(rpc.mock.calls.map(([nome]) => nome)).toEqual([
            'analytics_start_session',
            'analytics_track',
        ]);

        const [, payload] = rpc.mock.calls[1];
        expect(payload.p_event_type).toBe('business_view');
        expect(payload.p_entity_type).toBe('business');
        expect(payload.p_entity_id).toBe('uuid-do-negocio');
        expect(payload.p_pathname).toBe('/');
        expect(payload.p_device_type).toBeTruthy();
        expect(payload.p_session_id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(payload.p_anonymous_id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('anuncia a sessão uma vez só, por mais eventos que venham', async () => {
        const { track } = await carregar();
        await track('page_view');
        await track('page_view');
        await track('search', { metadata: { query: 'pousada', resultsCount: 3 } });

        const inicios = rpc.mock.calls.filter(([nome]) => nome === 'analytics_start_session');
        expect(inicios).toHaveLength(1);
    });

    it('manda da busca só o termo e a contagem', async () => {
        const { track } = await carregar();
        await track('search', { metadata: { query: 'pousada', resultsCount: 12 } });

        const [, payload] = rpc.mock.calls[1];
        expect(payload.p_metadata).toEqual({ query: 'pousada', resultsCount: 12 });
    });

    it('evento fora do contrato não vira requisição', async () => {
        const { track } = await carregar();
        await track('rage_click');
        expect(rpc).not.toHaveBeenCalled();
    });
});

// A regra dura da Sprint: se o analytics falhar, a ação original continua. Um
// `track` que lançasse dentro de um onClick levaria o ErrorBoundary junto e
// deixaria o visitante numa tela de erro em vez de abrir o WhatsApp.
describe('analytics nunca quebra o site', () => {
    it('não lança quando a rede cai', async () => {
        const { track } = await carregar();
        rpc.mockRejectedValue(new Error('Failed to fetch'));

        await expect(
            track('business_whatsapp_click', { entityType: 'business', entityId: 'uuid' })
        ).resolves.toBeUndefined();
    });

    it('não lança quando o banco recusa a chamada', async () => {
        const { track } = await carregar();
        rpc.mockResolvedValue({ error: { message: 'permission denied for function analytics_track' } });

        await expect(track('page_view')).resolves.toBeUndefined();
    });

    it('não lança quando o anúncio da sessão falha, e ainda assim grava o evento', async () => {
        const { track } = await carregar();
        rpc.mockImplementation((nome) =>
            nome === 'analytics_start_session'
                ? Promise.reject(new Error('sem rede'))
                : Promise.resolve({ error: null })
        );

        await expect(track('page_view')).resolves.toBeUndefined();
        expect(rpc.mock.calls.map(([nome]) => nome)).toContain('analytics_track');
    });
});
