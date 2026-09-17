// @vitest-environment node
//
// As oito RPCs de leitura do painel (migration 20260915000003).
//
// Duas coisas se testam aqui. A primeira é o cerco: são as únicas funções do
// projeto que devolvem o comportamento agregado de todo mundo, e só admin pode
// chamá-las. A segunda é a aritmética — um painel que soma errado é pior do que
// painel nenhum, porque alguém decide com base nele.
import { beforeAll, describe, expect, it } from 'vitest';
import { asAnon, asService, asUser, businessPayload, createTestDb, createUser, expectError, seedCategories } from './harness';

let db;
let admin;
let comum;
let negocioAtivo;
let negocioRemovido;
let inicio;
let fim;

const SESSAO_DESKTOP = '11111111-1111-4111-8111-111111111111';
const SESSAO_MOBILE = '22222222-2222-4222-8222-222222222222';

async function evento(tipo, opcoes = {}) {
    const {
        pathname = '/',
        metadata = {},
        device = 'desktop',
        anonymous = 'visitante-1',
        session = SESSAO_DESKTOP,
        entity = null,
        dias = 1,
    } = opcoes;

    await db.query(
        `insert into public.analytics_events
             (session_id, anonymous_id, event_type, pathname, entity_type, entity_id, device_type, metadata, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now() - ($9 || ' days')::interval)`,
        [session, anonymous, tipo, pathname, entity ? 'business' : null, entity, device, JSON.stringify(metadata), dias]
    );
}

async function rpc(nome, params) {
    const marcadores = params.map((_, index) => `$${index + 1}`).join(', ');
    const { rows } = await db.query(`select * from public.${nome}(${marcadores})`, params);
    return rows;
}

async function comoAdmin(nome, params) {
    await asUser(db, admin);
    return rpc(nome, params);
}

beforeAll(async () => {
    db = await createTestDb();
    const cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });
    comum = await createUser(db);

    const donoA = await createUser(db);
    const donoB = await createUser(db);

    async function criarNegocio(dono, nome) {
        await asUser(db, dono);
        const { rows } = await db.query(
            'select public.submit_business($1::jsonb, $2::uuid[], $3::uuid) as id',
            [JSON.stringify(businessPayload({ name: nome })), [cats.hospedagem], null]
        );
        await asUser(db, admin);
        await db.query(`select public.moderate_business($1, 'approve')`, [rows[0].id]);
        return rows[0].id;
    }

    negocioAtivo = await criarNegocio(donoA, 'Pousada Farol');
    negocioRemovido = await criarNegocio(donoB, 'Quiosque Fantasma');

    await asService(db);
    await db.query(
        `insert into public.analytics_sessions (id, anonymous_id, device_type) values ($1, 'visitante-1', 'desktop'), ($2, 'visitante-2', 'mobile')`,
        [SESSAO_DESKTOP, SESSAO_MOBILE]
    );

    const mobile = { device: 'mobile', anonymous: 'visitante-2', session: SESSAO_MOBILE };

    for (let i = 0; i < 3; i += 1) await evento('page_view', { pathname: '/' });
    for (let i = 0; i < 2; i += 1) await evento('page_view', { pathname: '/', ...mobile });
    await evento('page_view', { pathname: '/explorar' });
    // Fora da janela de 30 dias: nenhuma consulta pode enxergar.
    await evento('page_view', { pathname: '/', dias: 60 });

    await evento('business_view', { pathname: '/negocio/pousada-farol', entity: negocioAtivo });
    await evento('business_view', { pathname: '/negocio/pousada-farol', entity: negocioAtivo, ...mobile });
    await evento('business_whatsapp_click', { pathname: '/negocio/pousada-farol', entity: negocioAtivo });
    await evento('business_view', { pathname: '/negocio/quiosque-fantasma', entity: negocioRemovido });

    await evento('search', { pathname: '/explorar', metadata: { query: 'Café', resultsCount: 3 } });
    await evento('search', { pathname: '/explorar', metadata: { query: ' cafe ', resultsCount: 0 } });
    await evento('search', { pathname: '/explorar', metadata: { query: 'pousada', resultsCount: 'quebrado' } });

    await evento('element_click', { metadata: { element: 'hero-search', x_percent: 0.5, y_percent: 0.25 } });
    await evento('element_click', { metadata: { element: 'hero-search', x_percent: 0.5, y_percent: 0.25 } });
    // Extremo: sem clamp viraria o balde 20 numa faixa de 0 a 19.
    await evento('element_click', { metadata: { element: 'rodape', x_percent: 1, y_percent: 1 } });
    // Clique de teclado: conta em elementos, não entra no mapa.
    await evento('element_click', { metadata: { element: 'hero-search' } });
    await evento('element_click', { metadata: { element: 'so-mobile', x_percent: 0.1, y_percent: 0.1 }, ...mobile });
    await evento('element_click', {
        pathname: '/explorar',
        metadata: { element: 'explore-search-submit', x_percent: 0.3, y_percent: 0.3 },
    });

    for (const depth of [25, 50, 75]) await evento('scroll_depth', { metadata: { depth } });
    await evento('scroll_depth', { metadata: { depth: 25 }, ...mobile });

    // Apagado DEPOIS de gerar histórico: entity_id não é chave estrangeira, as
    // linhas continuam lá e a RPC tem de lidar com isso.
    await asUser(db, admin);
    await db.query(`select public.moderate_business($1, 'suspend', 'business_closed')`, [negocioRemovido]);
    await db.query('select public.admin_delete_business($1)', [negocioRemovido]);

    inicio = new Date(Date.now() - 30 * 864e5).toISOString();
    fim = new Date(Date.now() + 864e5).toISOString();
}, 60_000);

describe('quem pode ler', () => {
    it('visitante anônimo não executa nenhuma RPC de leitura', async () => {
        await asAnon(db);

        expect(await expectError(rpc('analytics_overview', [inicio, fim]))).toMatch(
            /permission denied|permissão negada/i
        );
        expect(await expectError(rpc('analytics_top_pages', [inicio, fim, 10]))).toMatch(
            /permission denied|permissão negada/i
        );
    });

    it('usuário autenticado sem papel de admin recebe forbidden, não dados', async () => {
        await asUser(db, comum);

        for (const [nome, params] of [
            ['analytics_overview', [inicio, fim]],
            ['analytics_top_pages', [inicio, fim, 10]],
            ['analytics_top_businesses', [inicio, fim, 10]],
            ['analytics_top_searches', [inicio, fim, 20]],
            ['analytics_top_elements', [inicio, fim, null, null, 20]],
            ['analytics_click_heatmap', [inicio, fim, '/', null]],
            ['analytics_heatmap_pages', [inicio, fim, null, 50]],
            ['analytics_scroll_funnel', [inicio, fim, '/', null]],
        ]) {
            expect(await expectError(rpc(nome, params))).toBe('forbidden');
        }
    });

    it('admin recebe dados', async () => {
        expect((await comoAdmin('analytics_overview', [inicio, fim]))).toHaveLength(1);
    });
});

describe('validação de parâmetros', () => {
    it('recusa período invertido, vazio ou nulo', async () => {
        await asUser(db, admin);
        expect(await expectError(rpc('analytics_overview', [fim, inicio]))).toBe('invalid_period');
        expect(await expectError(rpc('analytics_overview', [inicio, inicio]))).toBe('invalid_period');
        expect(await expectError(rpc('analytics_overview', [null, fim]))).toBe('invalid_period');
    });

    it('recusa dispositivo que não existe', async () => {
        await asUser(db, admin);
        expect(await expectError(rpc('analytics_top_elements', [inicio, fim, null, 'smartwatch', 20]))).toBe(
            'invalid_device_type'
        );
        expect(await expectError(rpc('analytics_click_heatmap', [inicio, fim, '/', 'tv']))).toBe(
            'invalid_device_type'
        );
    });

    it('exige página onde ela é obrigatória', async () => {
        await asUser(db, admin);
        expect(await expectError(rpc('analytics_click_heatmap', [inicio, fim, '  ', null]))).toBe(
            'pathname_required'
        );
        expect(await expectError(rpc('analytics_scroll_funnel', [inicio, fim, null, null]))).toBe(
            'pathname_required'
        );
    });

    it('corta limite absurdo no teto em vez de derrubar a consulta', async () => {
        const linhas = await comoAdmin('analytics_top_pages', [inicio, fim, 100000]);
        expect(linhas.length).toBeGreaterThan(0);
        expect(linhas.length).toBeLessThanOrEqual(100);
    });
});

describe('analytics_overview', () => {
    it('conta visitantes, sessões e eventos do período', async () => {
        const [geral] = await comoAdmin('analytics_overview', [inicio, fim]);

        expect(Number(geral.unique_visitors)).toBe(2);
        expect(Number(geral.sessions)).toBe(2);
        expect(Number(geral.page_views)).toBe(6);
        expect(Number(geral.whatsapp_clicks)).toBe(1);
        expect(Number(geral.business_views)).toBe(3);
        expect(Number(geral.searches)).toBe(3);
    });

    it('o recorte de período exclui o que está fora', async () => {
        // A janela de 90 dias alcança o page_view de 60 dias atrás; a de 30 não.
        const amplo = new Date(Date.now() - 90 * 864e5).toISOString();
        const [noventa] = await comoAdmin('analytics_overview', [amplo, fim]);
        const [trinta] = await comoAdmin('analytics_overview', [inicio, fim]);

        expect(Number(noventa.page_views)).toBe(Number(trinta.page_views) + 1);
    });
});

describe('analytics_top_pages', () => {
    it('agrupa por caminho e ordena por visualizações', async () => {
        const linhas = await comoAdmin('analytics_top_pages', [inicio, fim, 10]);

        expect(linhas[0].pathname).toBe('/');
        expect(Number(linhas[0].views)).toBe(5);
        expect(Number(linhas[0].unique_visitors)).toBe(2);
        expect(Number(linhas[0].sessions)).toBe(2);
        expect(linhas.map((linha) => linha.pathname)).toContain('/explorar');
    });

    it('respeita o limite', async () => {
        expect(await comoAdmin('analytics_top_pages', [inicio, fim, 1])).toHaveLength(1);
    });
});

describe('analytics_top_businesses', () => {
    it('junta com o catálogo e separa visualização de clique', async () => {
        const linhas = await comoAdmin('analytics_top_businesses', [inicio, fim, 10]);
        const ativo = linhas.find((linha) => linha.business_id === negocioAtivo);

        expect(ativo.business_name).toBe('Pousada Farol');
        expect(ativo.business_slug).toBe('pousada-farol');
        expect(Number(ativo.views)).toBe(2);
        expect(Number(ativo.whatsapp_clicks)).toBe(1);
        expect(Number(ativo.unique_visitors)).toBe(2);
        expect(Number(ativo.whatsapp_rate)).toBe(50);
    });

    it('negócio apagado continua no relatório, com rótulo honesto', async () => {
        const linhas = await comoAdmin('analytics_top_businesses', [inicio, fim, 10]);
        const removido = linhas.find((linha) => linha.business_id === negocioRemovido);

        expect(removido.business_name).toBe('Negócio removido');
        expect(removido.business_slug).toBeNull();
        expect(Number(removido.views)).toBe(1);
        // Teve visualização e nenhum clique: a taxa existe e vale 0. Nula seria
        // o caso de clique sem visualização nenhuma.
        expect(Number(removido.whatsapp_rate)).toBe(0);
    });
});

describe('analytics_top_searches', () => {
    it('agrupa ignorando acento, caixa e espaço em volta', async () => {
        const linhas = await comoAdmin('analytics_top_searches', [inicio, fim, 20]);
        const cafe = linhas.find((linha) => linha.query_normalized === 'cafe');

        expect(Number(cafe.searches)).toBe(2);
        expect(cafe.query_sample).toBe('Café');
        expect(Number(cafe.avg_results)).toBe(1.5);
        expect(Number(cafe.zero_result_searches)).toBe(1);
    });

    it('resultsCount fora de formato não derruba a consulta nem vira número', async () => {
        const linhas = await comoAdmin('analytics_top_searches', [inicio, fim, 20]);
        const pousada = linhas.find((linha) => linha.query_normalized === 'pousada');

        expect(Number(pousada.searches)).toBe(1);
        expect(pousada.avg_results).toBeNull();
        expect(Number(pousada.zero_result_searches)).toBe(0);
    });
});

describe('analytics_top_elements', () => {
    it('conta por identificador, incluindo clique sem coordenada', async () => {
        const linhas = await comoAdmin('analytics_top_elements', [inicio, fim, null, null, 20]);
        const hero = linhas.find((linha) => linha.element === 'hero-search');

        // Dois com posição e um de teclado.
        expect(Number(hero.clicks)).toBe(3);
        expect(Number(hero.unique_visitors)).toBe(1);
    });

    it('filtra por página e por dispositivo', async () => {
        const naHome = await comoAdmin('analytics_top_elements', [inicio, fim, '/', null, 20]);
        expect(naHome.map((linha) => linha.element)).not.toContain('explore-search-submit');

        const noMobile = await comoAdmin('analytics_top_elements', [inicio, fim, null, 'mobile', 20]);
        expect(noMobile.map((linha) => linha.element)).toEqual(['so-mobile']);
    });
});

describe('analytics_click_heatmap', () => {
    it('devolve o centro do balde, não a borda', async () => {
        const pontos = await comoAdmin('analytics_click_heatmap', [inicio, fim, '/', null]);
        const hero = pontos.find((ponto) => Number(ponto.clicks) === 2);

        // x 0,5 cai no balde 10 de 20 -> centro (10 + 0,5) / 20 = 0,525
        // y 0,25 cai no balde 7 de 30 -> centro (7 + 0,5) / 30 = 0,25
        expect(Number(hero.x)).toBeCloseTo(0.525, 4);
        expect(Number(hero.y)).toBeCloseTo(0.25, 4);
    });

    it('o clique no canto extremo continua dentro da grade', async () => {
        const pontos = await comoAdmin('analytics_click_heatmap', [inicio, fim, '/', null]);
        const canto = pontos.find((ponto) => Number(ponto.x) > 0.9);

        // Sem o clamp, floor(1 * 20) = 20 e o centro seria 1,025 — fora da tela.
        expect(Number(canto.x)).toBeCloseTo(0.975, 4);
        expect(Number(canto.y)).toBeCloseTo(0.9833, 4);
        expect(Number(canto.x)).toBeLessThan(1);
        expect(Number(canto.y)).toBeLessThan(1);
    });

    it('ignora clique sem coordenada e evento que não é clique', async () => {
        const pontos = await comoAdmin('analytics_click_heatmap', [inicio, fim, '/', null]);

        // Na home há 5 element_click: 2 no hero, 1 no rodapé, 1 no mobile e 1
        // disparado por teclado. Só o de teclado não tem posição.
        expect(pontos.reduce((soma, ponto) => soma + Number(ponto.clicks), 0)).toBe(4);
    });

    it('filtra por página e por dispositivo', async () => {
        expect(await comoAdmin('analytics_click_heatmap', [inicio, fim, '/explorar', null])).toHaveLength(1);
        expect(await comoAdmin('analytics_click_heatmap', [inicio, fim, '/', 'mobile'])).toHaveLength(1);
        expect(await comoAdmin('analytics_click_heatmap', [inicio, fim, '/nao-existe', null])).toHaveLength(0);
    });

    it('respeita o período', async () => {
        const antigo = new Date(Date.now() - 90 * 864e5).toISOString();
        const recorteVazio = new Date(Date.now() - 80 * 864e5).toISOString();
        expect(await comoAdmin('analytics_click_heatmap', [antigo, recorteVazio, '/', null])).toHaveLength(0);
    });
});

describe('analytics_heatmap_pages', () => {
    it('lista só páginas que têm clique com posição', async () => {
        const linhas = await comoAdmin('analytics_heatmap_pages', [inicio, fim, null, 50]);

        expect(linhas.map((linha) => linha.pathname)).toEqual(['/', '/explorar']);
        expect(Number(linhas[0].clicks)).toBe(4);
        // /negocio/pousada-farol teve visualização, não clique: fica fora.
        expect(linhas.map((linha) => linha.pathname)).not.toContain('/negocio/pousada-farol');
    });
});

describe('analytics_scroll_funnel', () => {
    it('devolve os cinco marcos mesmo quando não houve rolagem', async () => {
        const passos = await comoAdmin('analytics_scroll_funnel', [inicio, fim, '/negocio/pousada-farol', null]);

        expect(passos.map((passo) => passo.depth)).toEqual([25, 50, 75, 90, 100]);
        expect(passos.every((passo) => Number(passo.reached) === 0)).toBe(true);
    });

    it('divide pelos page views da mesma página e período', async () => {
        const passos = await comoAdmin('analytics_scroll_funnel', [inicio, fim, '/', null]);
        const porMarco = Object.fromEntries(passos.map((passo) => [passo.depth, passo]));

        // 5 page views na home; 25 alcançado por dois visitantes, 50 e 75 por um.
        expect(Number(porMarco[25].page_views)).toBe(5);
        expect(Number(porMarco[25].reached)).toBe(2);
        expect(Number(porMarco[25].rate)).toBe(40);
        expect(Number(porMarco[50].reached)).toBe(1);
        expect(Number(porMarco[50].rate)).toBe(20);
        expect(Number(porMarco[100].reached)).toBe(0);
        expect(Number(porMarco[100].rate)).toBe(0);
    });

    it('filtra por dispositivo dos dois lados da divisão', async () => {
        const passos = await comoAdmin('analytics_scroll_funnel', [inicio, fim, '/', 'mobile']);
        const porMarco = Object.fromEntries(passos.map((passo) => [passo.depth, passo]));

        expect(Number(porMarco[25].page_views)).toBe(2);
        expect(Number(porMarco[25].reached)).toBe(1);
        expect(Number(porMarco[25].rate)).toBe(50);
        expect(Number(porMarco[50].reached)).toBe(0);
    });
});
