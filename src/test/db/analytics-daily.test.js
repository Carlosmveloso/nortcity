// @vitest-environment node
//
// A camada agregada (migration 20260915000004).
//
// O que se testa aqui, em ordem de importância: que a fronteira do dia é a
// brasileira e não a de Greenwich; que rodar a agregação duas vezes dá o mesmo
// resultado; e que o painel híbrido não conta o mesmo dia no agregado E no
// bruto. Os três são erros que não levantam exceção — só produzem número errado
// com cara de número certo.
import { beforeEach, describe, expect, it } from 'vitest';
import { asAnon, asService, asUser, createTestDb, createUser, expectError } from './harness';

let db;
let admin;
let comum;
let hoje;
let ontem;
let anteontem;

const SESSAO = '11111111-1111-4111-8111-111111111111';

function iso(date) {
    return date.toISOString().slice(0, 10);
}

// Insere um evento num horário LOCAL de Pitimbu, que é o ponto do exercício.
async function evento(dia, hora, tipo, opcoes = {}) {
    const { metadata = {}, pathname = '/', device = 'desktop', anonymous = 'v1', entity = null } = opcoes;

    await asService(db);
    await db.query(
        `insert into public.analytics_events
             (session_id, anonymous_id, event_type, pathname, entity_type, entity_id, device_type, metadata, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb,
                 (($9::date + $10::time)::timestamp at time zone 'America/Fortaleza'))`,
        [SESSAO, anonymous, tipo, pathname, entity ? 'business' : null, entity, device,
         JSON.stringify(metadata), dia, hora]
    );
}

async function agregar(dia) {
    await asUser(db, admin);
    const { rows } = await db.query('select public.analytics_aggregate_day($1) as linhas', [dia]);
    return Number(rows[0].linhas);
}

async function stats(dia, metric) {
    await asService(db);
    const { rows } = await db.query(
        `select * from public.analytics_daily_stats
          where stat_date = $1 and ($2::text is null or metric = $2)
          order by metric, pathname, element, query_normalized, scroll_depth, device_type`,
        [dia, metric ?? null]
    );
    return rows;
}

beforeEach(async () => {
    db = await createTestDb();
    admin = await createUser(db, { admin: true });
    comum = await createUser(db);

    await asService(db);
    await db.query(
        `insert into public.analytics_sessions (id, anonymous_id, device_type) values ($1, 'v1', 'desktop')`,
        [SESSAO]
    );

    const { rows } = await db.query(`select (now() at time zone 'America/Fortaleza')::date as d`);
    hoje = iso(rows[0].d);
    ontem = iso(new Date(rows[0].d.getTime() - 864e5));
    anteontem = iso(new Date(rows[0].d.getTime() - 2 * 864e5));
}, 60_000);

describe('estrutura e acesso', () => {
    it('as três tabelas têm RLS e o navegador não lê nem escreve nenhuma delas', async () => {
        const tabelas = [
            'analytics_daily_stats',
            'analytics_daily_business_stats',
            'analytics_daily_aggregation',
        ];

        await asService(db);
        const { rows: rls } = await db.query(
            `select relname, relrowsecurity from pg_class
              where relname = any($1) order by relname`,
            [tabelas]
        );
        expect(rls.map((linha) => linha.relrowsecurity)).toEqual([true, true, true]);

        for (const tabela of tabelas) {
            await asAnon(db);
            expect(await expectError(db.query(`select * from public.${tabela}`))).toMatch(
                /permission denied|permissão negada/i
            );

            // O autenticado tem GRANT de select (a policy é a autoridade) e
            // enxerga vazio; escrever, nem com grant nem sem.
            await asUser(db, comum);
            expect((await db.query(`select * from public.${tabela}`)).rows).toHaveLength(0);
            expect(
                await expectError(db.query(`delete from public.${tabela}`))
            ).toMatch(/permission denied|permissão negada/i);
        }
    });

    it('recusa métrica, dispositivo e marco fora do contrato', async () => {
        await asService(db);

        for (const [coluna, valor] of [
            ["metric", "'inventada'"],
            ["device_type", "'smartwatch'"],
            ["scroll_depth", '33'],
        ]) {
            const colunas = { metric: "'page_views'", device_type: "'desktop'", scroll_depth: '0' };
            colunas[coluna] = valor;
            expect(
                await expectError(
                    db.query(`insert into public.analytics_daily_stats
                                  (stat_date, metric, device_type, scroll_depth)
                              values (current_date, ${colunas.metric}, ${colunas.device_type}, ${colunas.scroll_depth})`)
                )
            ).toMatch(/violates check constraint/i);
        }
    });
});

describe('fronteira do dia', () => {
    // O erro que esta Sprint existe para não cometer: em UTC, 23h30 de um sábado
    // em Pitimbu é 02h30 de domingo, e o relatório de sábado perderia a noite.
    it('evento às 23h30 de Pitimbu pertence àquele dia, não ao seguinte', async () => {
        await evento(ontem, '23:30', 'page_view');
        await evento(ontem, '00:15', 'page_view');

        await agregar(ontem);
        await agregar(hoje);

        const doDiaAnterior = await stats(ontem, 'page_views');
        const deHoje = await stats(hoje, 'page_views');

        expect(Number(doDiaAnterior[0].events)).toBe(2);
        expect(deHoje).toHaveLength(0);
    });
});

describe('analytics_aggregate_day', () => {
    it('separa por métrica, caminho, dispositivo, elemento e marco', async () => {
        await evento(ontem, '10:00', 'page_view', { pathname: '/' });
        await evento(ontem, '10:01', 'page_view', { pathname: '/' });
        await evento(ontem, '10:02', 'page_view', { pathname: '/explorar' });
        await evento(ontem, '10:03', 'page_view', { pathname: '/', device: 'mobile' });
        await evento(ontem, '11:00', 'element_click', { pathname: '/', metadata: { element: 'hero-search', x_percent: 0.5, y_percent: 0.5 } });
        await evento(ontem, '11:01', 'element_click', { pathname: '/explorar', metadata: { element: 'hero-search', x_percent: 0.5, y_percent: 0.5 } });
        await evento(ontem, '12:00', 'scroll_depth', { pathname: '/', metadata: { depth: 25 } });
        await evento(ontem, '12:01', 'scroll_depth', { pathname: '/', metadata: { depth: 50 } });

        await agregar(ontem);

        const paginas = await stats(ontem, 'page_views');
        expect(paginas.map((linha) => [linha.pathname, linha.device_type, Number(linha.events)])).toEqual([
            ['/', 'desktop', 2],
            ['/', 'mobile', 1],
            ['/explorar', 'desktop', 1],
        ]);

        // Mesmo elemento em páginas diferentes são linhas diferentes: o pathname
        // faz parte da dimensão.
        const elementos = await stats(ontem, 'element_clicks');
        expect(elementos.map((linha) => linha.pathname)).toEqual(['/', '/explorar']);

        const scroll = await stats(ontem, 'scroll_depth');
        expect(scroll.map((linha) => linha.scroll_depth)).toEqual([25, 50]);
    });

    it('separa clique com posição de clique de teclado', async () => {
        await evento(ontem, '10:00', 'element_click', { metadata: { element: 'x', x_percent: 0.5, y_percent: 0.5 } });
        await evento(ontem, '10:01', 'element_click', { metadata: { element: 'x' } });

        await agregar(ontem);

        const [linha] = await stats(ontem, 'element_clicks');
        expect(Number(linha.events)).toBe(2);
        expect(Number(linha.positioned_events)).toBe(1);
    });

    it('agrupa busca sem acento e sem caixa, guardando o texto legível', async () => {
        await evento(ontem, '10:00', 'search', { metadata: { query: 'Restaurante', resultsCount: 8 } });
        await evento(ontem, '10:01', 'search', { metadata: { query: ' restaurante ', resultsCount: 4 } });
        await evento(ontem, '10:02', 'search', { metadata: { query: 'RESTAURANTE', resultsCount: 0 } });
        await evento(ontem, '10:03', 'search', { metadata: { query: 'café', resultsCount: 'quebrado' } });

        await agregar(ontem);

        const buscas = await stats(ontem, 'searches');
        const restaurante = buscas.find((linha) => linha.query_normalized === 'restaurante');

        expect(Number(restaurante.events)).toBe(3);
        expect(Number(restaurante.results_total)).toBe(12);
        expect(Number(restaurante.results_events)).toBe(3);
        expect(Number(restaurante.zero_results)).toBe(1);
        expect(restaurante.query_sample).toBe('RESTAURANTE');

        // resultsCount fora de formato entra na contagem de buscas e fica fora
        // do denominador da média — que é o que a Sprint 03 já fazia no bruto.
        const cafe = buscas.find((linha) => linha.query_normalized === 'cafe');
        expect(Number(cafe.events)).toBe(1);
        expect(Number(cafe.results_events)).toBe(0);
    });

    it('separa negócios e conta visualização e WhatsApp na mesma linha', async () => {
        const negocioA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const negocioB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

        await evento(ontem, '10:00', 'business_view', { entity: negocioA });
        await evento(ontem, '10:01', 'business_view', { entity: negocioA });
        await evento(ontem, '10:02', 'business_whatsapp_click', { entity: negocioA });
        await evento(ontem, '10:03', 'business_view', { entity: negocioB, device: 'mobile' });

        await agregar(ontem);

        await asService(db);
        const { rows } = await db.query(
            'select * from public.analytics_daily_business_stats where stat_date = $1 order by business_id, device_type',
            [ontem]
        );

        expect(rows).toHaveLength(2);
        expect([rows[0].business_id, Number(rows[0].views), Number(rows[0].whatsapp_clicks)]).toEqual([
            negocioA, 2, 1,
        ]);
        expect([rows[1].business_id, rows[1].device_type, Number(rows[1].views)]).toEqual([
            negocioB, 'mobile', 1,
        ]);
    });

    it('rodar duas vezes não duplica nada', async () => {
        await evento(ontem, '10:00', 'page_view');
        await evento(ontem, '10:01', 'page_view');

        const primeira = await agregar(ontem);
        const antes = await stats(ontem);
        const segunda = await agregar(ontem);
        const depois = await stats(ontem);

        expect(segunda).toBe(primeira);
        expect(depois.map((linha) => Number(linha.events))).toEqual(antes.map((linha) => Number(linha.events)));
        expect(depois).toHaveLength(1);
    });

    it('evento atrasado é incorporado na reexecução', async () => {
        await evento(ontem, '10:00', 'page_view');
        await agregar(ontem);
        expect(Number((await stats(ontem, 'page_views'))[0].events)).toBe(1);

        await evento(ontem, '23:00', 'page_view');
        await agregar(ontem);

        expect(Number((await stats(ontem, 'page_views'))[0].events)).toBe(2);
    });

    it('dia sem evento nenhum fica registrado como processado, sem gerar linha de estatística', async () => {
        const linhas = await agregar(ontem);

        expect(linhas).toBe(0);
        expect(await stats(ontem)).toHaveLength(0);

        await asService(db);
        const { rows } = await db.query('select * from public.analytics_daily_aggregation where stat_date = $1', [ontem]);

        // É esta linha que distingue "dia parado" de "dia que ninguém rodou" —
        // sem ela, o painel híbrido cairia para bruto achando que faltou
        // processar, e a saúde mostraria a data errada.
        expect(rows).toHaveLength(1);
        expect(Number(rows[0].events_seen)).toBe(0);
    });
});

describe('analytics_backfill_daily_stats', () => {
    it('processa cada dia do intervalo e é idempotente', async () => {
        await evento(anteontem, '10:00', 'page_view');
        await evento(ontem, '10:00', 'page_view');

        await asUser(db, admin);
        const { rows } = await db.query('select * from public.analytics_backfill_daily_stats($1, $2)', [
            anteontem,
            hoje,
        ]);
        expect(rows).toHaveLength(3);

        await asUser(db, admin);
        const { rows: denovo } = await db.query(
            'select * from public.analytics_backfill_daily_stats($1, $2)',
            [anteontem, hoje]
        );
        expect(denovo.map((linha) => Number(linha.rows_written))).toEqual(
            rows.map((linha) => Number(linha.rows_written))
        );

        await asService(db);
        const { rows: total } = await db.query('select count(*)::int as n from public.analytics_daily_stats');
        expect(total[0].n).toBe(2);
    });

    it('recusa intervalo invertido e intervalo longo demais', async () => {
        await asUser(db, admin);

        expect(
            await expectError(db.query('select * from public.analytics_backfill_daily_stats($1, $2)', [hoje, anteontem]))
        ).toBe('invalid_period');

        expect(
            await expectError(
                db.query(`select * from public.analytics_backfill_daily_stats($1::date - 400, $1)`, [hoje])
            )
        ).toBe('period_too_long');
    });
});

describe('analytics_health', () => {
    it('separa último evento de última agregação', async () => {
        await evento(anteontem, '10:00', 'page_view');
        await evento(hoje, '10:00', 'page_view');
        await agregar(anteontem);

        await asUser(db, admin);
        const { rows } = await db.query('select * from public.analytics_health()');
        const saude = rows[0];

        expect(Number(saude.events_total)).toBe(2);
        expect(saude.first_event_at).toBeInstanceOf(Date);
        // O evento mais novo é de hoje; a agregação mais nova é de anteontem.
        // Um agendador parado precisa aparecer exatamente assim.
        expect(iso(saude.last_aggregated_date)).toBe(anteontem);
        expect(Number(saude.aggregated_days)).toBe(1);
        expect(Number(saude.daily_rows)).toBe(1);
    });

    it('sem evento nenhum devolve zeros e nulos, sem quebrar', async () => {
        await asUser(db, admin);
        const { rows } = await db.query('select * from public.analytics_health()');

        expect(Number(rows[0].events_total)).toBe(0);
        expect(rows[0].first_event_at).toBeNull();
        expect(rows[0].last_aggregated_date).toBeNull();
        expect(Number(rows[0].aggregated_days)).toBe(0);
    });
});

describe('quem pode agregar', () => {
    it('usuário comum não agrega, não faz backfill e não lê saúde', async () => {
        await asUser(db, comum);

        expect(await expectError(db.query('select public.analytics_aggregate_day($1)', [ontem]))).toBe('forbidden');
        expect(
            await expectError(db.query('select * from public.analytics_backfill_daily_stats($1, $2)', [ontem, ontem]))
        ).toBe('forbidden');
        expect(await expectError(db.query('select * from public.analytics_health()'))).toBe('forbidden');
    });

    it('a função interna não é alcançável por papel nenhum do PostgREST', async () => {
        for (const papel of [() => asAnon(db), () => asUser(db, comum), () => asUser(db, admin)]) {
            await papel();
            expect(
                await expectError(db.query('select public.analytics_aggregate_day_internal($1)', [ontem]))
            ).toMatch(/permission denied|permissão negada/i);
        }
    });
});

// O ponto mais delicado da Sprint: somar agregado com bruto sem contar o mesmo
// dia duas vezes, e sem perder dia nenhum.
//
// Estes testes precisam que a janela agregada esteja COMPLETA — senão a RPC cai
// para bruto e o teste passa medindo outra coisa. Foi o que a verificação por
// mutação pegou: sem o backfill abaixo, trocar `positioned_events` por `events`
// não quebrava nada, porque o ramo agregado nunca era executado.
describe('limite temporal do painel híbrido', () => {
    const JANELA_DIAS = 3;

    function janela() {
        return {
            inicio: new Date(Date.now() - JANELA_DIAS * 864e5).toISOString(),
            fim: new Date(Date.now() + 864e5).toISOString(),
        };
    }

    // Marca como processados todos os dias completos que a janela alcança.
    async function agregarJanela() {
        await asUser(db, admin);
        await db.query('select * from public.analytics_backfill_daily_stats($1::date - $2::int, $1::date - 1)', [
            hoje,
            JANELA_DIAS,
        ]);
    }

    // Prova direta de que o número veio do agregado: sem os eventos brutos dos
    // dias já agregados, o resultado não pode mudar.
    async function apagarBrutoAteOntem() {
        await asService(db);
        await db.query(
            `delete from public.analytics_events
              where created_at < ($1::date::timestamp at time zone 'America/Fortaleza')`,
            [hoje]
        );
    }

    it('agregado de ontem mais bruto de hoje soma certo, sem duplicar', async () => {
        await evento(ontem, '10:00', 'page_view');
        await evento(ontem, '10:01', 'page_view');
        await evento(ontem, '10:02', 'scroll_depth', { metadata: { depth: 25 } });
        await evento(hoje, '09:00', 'page_view');
        await evento(hoje, '09:01', 'scroll_depth', { metadata: { depth: 25 } });

        await agregarJanela();
        const { inicio, fim } = janela();

        await asUser(db, admin);
        const { rows } = await db.query('select * from public.analytics_scroll_funnel($1, $2, $3, $4)', [
            inicio, fim, '/', null,
        ]);
        const marco25 = rows.find((linha) => linha.depth === 25);
        expect(Number(marco25.page_views)).toBe(3);
        expect(Number(marco25.reached)).toBe(2);

        // Agora sem o bruto de ontem: se o número mudar, ontem estava vindo do
        // bruto e o agregado não estava sendo usado.
        await apagarBrutoAteOntem();
        await asUser(db, admin);
        const { rows: depois } = await db.query('select * from public.analytics_scroll_funnel($1, $2, $3, $4)', [
            inicio, fim, '/', null,
        ]);
        const aindaVinte = depois.find((linha) => linha.depth === 25);
        expect(Number(aindaVinte.page_views)).toBe(3);
        expect(Number(aindaVinte.reached)).toBe(2);
    });

    it('faltando um dia processado, cai para bruto e continua correto', async () => {
        await evento(anteontem, '10:00', 'page_view');
        await evento(ontem, '10:00', 'page_view');
        await evento(hoje, '10:00', 'page_view');

        // Só anteontem é agregado: ontem fica com buraco.
        await agregar(anteontem);

        await asUser(db, admin);
        const inicio = new Date(Date.now() - 5 * 864e5).toISOString();
        const fim = new Date(Date.now() + 864e5).toISOString();
        const { rows } = await db.query('select * from public.analytics_scroll_funnel($1, $2, $3, $4)', [
            inicio, fim, '/', null,
        ]);

        // Três visualizações, nem uma a menos: o buraco faz a consulta usar
        // bruto no período inteiro em vez de somar só o que está agregado.
        expect(Number(rows[0].page_views)).toBe(3);
    });

    it('a busca híbrida pondera a média pelas buscas que têm contagem', async () => {
        await evento(ontem, '10:00', 'search', { metadata: { query: 'Café', resultsCount: 4 } });
        await evento(ontem, '10:01', 'search', { metadata: { query: 'cafe', resultsCount: 0 } });
        // Sem contagem válida: entra no total de buscas e fica fora do
        // denominador da média.
        await evento(ontem, '10:02', 'search', { metadata: { query: 'CAFÉ', resultsCount: 'quebrado' } });
        await evento(hoje, '09:00', 'search', { metadata: { query: 'CAFE', resultsCount: 2 } });

        await agregarJanela();
        const { inicio, fim } = janela();

        await asUser(db, admin);
        const { rows } = await db.query('select * from public.analytics_top_searches($1, $2, $3)', [
            inicio, fim, 20,
        ]);

        expect(rows).toHaveLength(1);
        expect(Number(rows[0].searches)).toBe(4);
        // (4 + 0 + 2) dividido por 3 buscas com contagem, não por 4.
        expect(Number(rows[0].avg_results)).toBe(2);
        expect(Number(rows[0].zero_result_searches)).toBe(1);

        await apagarBrutoAteOntem();
        await asUser(db, admin);
        const { rows: depois } = await db.query('select * from public.analytics_top_searches($1, $2, $3)', [
            inicio, fim, 20,
        ]);
        expect(Number(depois[0].searches)).toBe(4);
        expect(Number(depois[0].avg_results)).toBe(2);
    });

    it('o seletor do heatmap soma agregado e bruto contando só clique com posição', async () => {
        await evento(ontem, '10:00', 'element_click', { metadata: { element: 'a', x_percent: 0.2, y_percent: 0.2 } });
        await evento(ontem, '10:01', 'element_click', { metadata: { element: 'a' } });
        await evento(hoje, '09:00', 'element_click', { metadata: { element: 'a', x_percent: 0.3, y_percent: 0.3 } });

        await agregarJanela();
        const { inicio, fim } = janela();

        await asUser(db, admin);
        const { rows } = await db.query('select * from public.analytics_heatmap_pages($1, $2, $3, $4)', [
            inicio, fim, null, 50,
        ]);
        expect(Number(rows[0].clicks)).toBe(2);

        await apagarBrutoAteOntem();
        await asUser(db, admin);
        const { rows: depois } = await db.query('select * from public.analytics_heatmap_pages($1, $2, $3, $4)', [
            inicio, fim, null, 50,
        ]);
        expect(Number(depois[0].clicks)).toBe(2);
    });
});
