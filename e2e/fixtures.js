import { test as base, expect } from '@playwright/test';

export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const BUSINESS_ID = '22222222-2222-4222-8222-222222222222';
export const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const category = { id: CATEGORY_ID, name: 'Gastronomia', slug: 'gastronomia', order_index: 1 };

export function session() {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const encode = (data) => Buffer.from(JSON.stringify(data)).toString('base64url');
    return {
        access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: USER_ID, exp: expires, role: 'authenticated' })}.test-signature`,
        refresh_token: 'local-test-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expires,
        user: { id: USER_ID, email: 'proprietario@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {} },
    };
}

function business(status = 'pending') {
    return {
        id: BUSINESS_ID, slug: 'restaurante-fixture', name: 'Restaurante Fixture',
        description: '', address: 'Rua da Praia, 10', neighborhood: 'Centro',
        phone: '83999998888', owner_id: USER_ID, status,
        created_at: '2026-09-01T12:00:00Z', submitted_at: '2026-09-01T12:00:00Z',
        business_categories: [{ is_primary: true, categories: category }],
        owner: { id: USER_ID, full_name: 'Pessoa de Teste', email: 'proprietario@example.test' },
    };
}

export const test = base.extend({
    role: ['owner', { option: true }],
    initialStatus: ['pending', { option: true }],
    api: [async ({ context, role, initialStatus }, use) => {
        const state = { business: initialStatus ? business(initialStatus) : null, proposal: null, calls: [], failRpc: null, authError: null, resendError: null,
            favorites: [], favoritesError: null, favoritesGate: null };
        const unexpected = [];
        const pageErrors = [];
        context.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(error.message)));
        if (role !== 'anon') {
            await context.addInitScript((authSession) => {
                if (window.location.origin !== 'http://127.0.0.1:4173') return;
                localStorage.setItem('sb-127-auth-token', JSON.stringify(authSession));
            }, session());
        }
        await context.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.origin === 'http://127.0.0.1:4173') return route.continue();
            if (url.origin !== 'http://127.0.0.1:54321') {
                // Fontes/imagens externas são opcionais. Qualquer API real ou escrita é erro.
                if (url.hostname.endsWith('.supabase.co') || !['GET', 'HEAD'].includes(request.method())) {
                    unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
                }
                return route.abort();
            }
            const path = url.pathname;
            const body = request.postDataJSON();
            state.calls.push({ path, body, method: request.method() });
            const json = (data, status = 200) => route.fulfill({ status, json: data });
            if (path === '/auth/v1/token') {
                if (state.authError) return json(state.authError, 400);
                if (body.password !== 'senha-teste') return json({ message: 'Invalid login credentials', error_code: 'invalid_credentials' }, 400);
                return json(session());
            }
            if (path === '/auth/v1/signup') return json({ ...session().user, identities: [] });
            if (path === '/auth/v1/resend') {
                if (state.resendError) return json(state.resendError, 429);
                return json({});
            }
            if (path === '/auth/v1/user') return json(session().user);
            if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
            if (path === '/rest/v1/user_roles') return json([{ role: role === 'admin' ? 'admin' : 'user' }]);
            if (path === '/rest/v1/categories') return json([category]);
            if (path === '/rest/v1/business_categories') return json([]);
            if (path === '/rest/v1/business_favorites') {
                if (state.favoritesGate) await state.favoritesGate;
                if (state.favoritesError) return json({ message: 'Falha simulada de favoritos', code: '42501' }, 403);
                if (request.method() === 'POST') {
                    state.favorites.push(body);
                    return route.fulfill({ status: 201 });
                }
                if (request.method() === 'DELETE') {
                    state.favorites = state.favorites.filter((row) => !(url.searchParams.get('user_id') === `eq.${row.user_id}` && url.searchParams.get('business_id') === `eq.${row.business_id}`));
                    return route.fulfill({ status: 204 });
                }
                const start = Number(url.searchParams.get('offset') ?? 0);
                const limit = Number(url.searchParams.get('limit') ?? 500);
                return json(state.favorites.filter((row) => url.searchParams.get('user_id') === `eq.${row.user_id}`).slice(start, start + limit).map((row) => ({
                    ...row, businesses: state.business?.status === 'active' && state.business.id === row.business_id ? state.business : null,
                })));
            }
            if (path === '/rest/v1/business_change_requests') return json(state.proposal ? [state.proposal] : []);
            if (path === '/rest/v1/businesses') {
                let rows = state.business ? [state.business] : [];
                if (url.searchParams.get('status') === 'eq.active') rows = rows.filter((row) => row.status === 'active');
                if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${rows.length}` } });
                if (request.headers().accept?.includes('vnd.pgrst.object')) return json(rows[0] ?? null);
                return json(rows);
            }
            const rpc = path.split('/rpc/')[1];
            if (rpc === 'business_neighborhoods') return json([{ neighborhood: 'Centro' }]);
            if (rpc === 'search_businesses') return json(state.business?.status === 'active' ? [{
                ...state.business, categories: ['gastronomia'], category_names: ['Gastronomia'], total_count: 1,
            }] : []);
            if (rpc && state.failRpc === rpc) return json({ message: 'validation_failed', details: 'Falha simulada para teste.' }, 400);
            if (rpc === 'submit_business') {
                state.business = { ...business(), ...body.p_payload };
                return json(BUSINESS_ID);
            }
            if (rpc === 'update_own_business') {
                Object.assign(state.business, body.p_payload);
                return json(null);
            }
            if (rpc === 'update_own_active_business') {
                Object.assign(state.business, body.p_changes);
                return json(null);
            }
            if (rpc === 'request_business_changes') {
                state.proposal = { id: '44444444-4444-4444-8444-444444444444', status: 'pending', changes: body.p_changes, created_at: '2026-10-01T12:00:00Z' };
                return json(state.proposal.id);
            }
            if (rpc === 'moderate_business') {
                state.business.status = body.p_action === 'approve' ? 'active' : 'rejected';
                state.business.moderation_reason = body.p_reason;
                return json(null);
            }
            unexpected.push(`${request.method()} ${path}`);
            return json({ message: 'Endpoint sem fixture' }, 500);
        });
        await use(state);
        expect(unexpected, 'Nenhuma chamada deve escapar para APIs reais ou não previstas').toEqual([]);
        expect(pageErrors, 'Nenhuma exceção de JavaScript no navegador').toEqual([]);
    }, { auto: true }],
});
export { expect };
