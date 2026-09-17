// @vitest-environment node
//
// Analytics escreve a partir de visitante anônimo — é o único ponto do projeto
// onde alguém sem conta grava no banco. Por isso o que se testa aqui é, antes de
// tudo, o cerco: quem escreve não lê, quem lê é só o admin, e a escrita só
// existe pela RPC.
//
// Roda contra Postgres real e descartável (ver harness.js), nunca contra o
// Supabase de produção.
import { beforeEach, describe, expect, it } from 'vitest';
import { asAnon, asService, asUser, createTestDb, createUser, expectError } from './harness';

let db;

beforeEach(async () => {
    db = await createTestDb();
}, 60_000);

function newId() {
    return crypto.randomUUID();
}

async function startSession(sessionId, anonymousId, overrides = {}) {
    const { landing = '/', referrer = null, device = 'mobile', utmSource = null } = overrides;
    await db.query('select public.analytics_start_session($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [
        sessionId,
        anonymousId,
        landing,
        referrer,
        device,
        'Chrome',
        'Android',
        utmSource,
        null,
        null,
    ]);
}

async function track(sessionId, anonymousId, eventType, overrides = {}) {
    const {
        pathname = '/',
        entityType = null,
        entityId = null,
        device = 'mobile',
        metadata = {},
    } = overrides;

    await db.query('select public.analytics_track($1, $2, $3, $4, $5, $6, $7, $8::jsonb)', [
        sessionId,
        anonymousId,
        eventType,
        pathname,
        entityType,
        entityId,
        device,
        JSON.stringify(metadata),
    ]);
}

async function rows(sql, params = []) {
    await asService(db);
    const result = await db.query(sql, params);
    return result.rows;
}

describe('coleta', () => {
    it('visitante anônimo cria a sessão e grava evento, com origem e UTM', async () => {
        const sessionId = newId();

        await asAnon(db);
        await startSession(sessionId, 'visitante-1', {
            landing: '/explorar',
            referrer: 'https://instagram.com/',
            utmSource: 'instagram',
        });
        await track(sessionId, 'visitante-1', 'page_view', { pathname: '/explorar' });

        const [session] = await rows('select * from public.analytics_sessions');
        expect(session.anonymous_id).toBe('visitante-1');
        expect(session.landing_page).toBe('/explorar');
        expect(session.utm_source).toBe('instagram');
        expect(session.user_id).toBeNull();

        const [event] = await rows('select * from public.analytics_events');
        expect(event.event_type).toBe('page_view');
        expect(event.session_id).toBe(sessionId);
        expect(event.created_at).toBeInstanceOf(Date);
    });

    it('grava os cinco eventos da Sprint e recusa qualquer outro, sem levantar erro', async () => {
        const sessionId = newId();
        const negocio = newId();

        await asAnon(db);
        await startSession(sessionId, 'visitante-2');

        for (const evento of [
            'page_view',
            'business_view',
            'business_whatsapp_click',
            'business_location_click',
            'search',
        ]) {
            await track(sessionId, 'visitante-2', evento, {
                entityType: evento.startsWith('business') ? 'business' : null,
                entityId: evento.startsWith('business') ? negocio : null,
            });
        }

        // Evento fora do contrato não pode virar erro na tela de quem navega:
        // a RPC descarta em silêncio.
        await track(sessionId, 'visitante-2', 'rage_click');
        await track(sessionId, 'visitante-2', 'scroll_depth');

        const gravados = await rows('select event_type from public.analytics_events order by id');
        expect(gravados.map((row) => row.event_type)).toEqual([
            'page_view',
            'business_view',
            'business_whatsapp_click',
            'business_location_click',
            'search',
        ]);
    });

    it('guarda o termo e a contagem da busca, e nada além disso', async () => {
        const sessionId = newId();

        await asAnon(db);
        await startSession(sessionId, 'visitante-3');
        await track(sessionId, 'visitante-3', 'search', {
            pathname: '/explorar',
            metadata: { query: 'pousada', resultsCount: 12 },
        });

        const [event] = await rows('select metadata from public.analytics_events');
        expect(event.metadata).toEqual({ query: 'pousada', resultsCount: 12 });
    });

    it('normaliza entidade pela metade e dispositivo desconhecido em vez de recusar o evento', async () => {
        const sessionId = newId();

        await asAnon(db);
        await startSession(sessionId, 'visitante-4');
        // Um chamador distraído manda o tipo sem o id. A constraint existe, mas
        // quem tem de não deixá-la disparar é a RPC.
        await track(sessionId, 'visitante-4', 'business_view', {
            entityType: 'business',
            entityId: null,
            device: 'smart-tv',
        });

        const [event] = await rows('select entity_type, entity_id, device_type from public.analytics_events');
        expect(event.entity_type).toBeNull();
        expect(event.entity_id).toBeNull();
        expect(event.device_type).toBeNull();
    });
});

describe('sessão', () => {
    it('não reescreve last_seen_at a cada evento, e reescreve quando envelhece', async () => {
        const sessionId = newId();

        await asAnon(db);
        await startSession(sessionId, 'visitante-5');
        await track(sessionId, 'visitante-5', 'page_view');

        const [inicial] = await rows('select last_seen_at from public.analytics_sessions');

        await asAnon(db);
        await track(sessionId, 'visitante-5', 'page_view');
        await track(sessionId, 'visitante-5', 'business_view');

        const [depois] = await rows('select last_seen_at from public.analytics_sessions');
        expect(depois.last_seen_at).toEqual(inicial.last_seen_at);

        await rows(
            `update public.analytics_sessions set last_seen_at = now() - interval '10 minutes' where id = $1`,
            [sessionId]
        );

        await asAnon(db);
        await track(sessionId, 'visitante-5', 'page_view');

        const [renovado] = await rows('select last_seen_at from public.analytics_sessions');
        expect(renovado.last_seen_at.getTime()).toBeGreaterThan(depois.last_seen_at.getTime() - 1000);
    });

    it('evento com sessão inexistente cria a sessão em vez de ser perdido pela chave estrangeira', async () => {
        const sessionId = newId();

        // O cenário real: analytics_start_session não chegou (conexão caiu) e o
        // primeiro evento chega assim mesmo.
        await asAnon(db);
        await track(sessionId, 'visitante-6', 'page_view', { pathname: '/sobre' });

        const sessoes = await rows('select id, landing_page from public.analytics_sessions');
        const eventos = await rows('select session_id from public.analytics_events');

        expect(sessoes).toHaveLength(1);
        expect(sessoes[0].landing_page).toBe('/sobre');
        expect(eventos[0].session_id).toBe(sessionId);
    });

    it('visitante que entra na conta no meio da sessão passa a ter user_id, sem perder o anonymous_id', async () => {
        const sessionId = newId();
        const user = await createUser(db);

        await asAnon(db);
        await startSession(sessionId, 'visitante-7');
        await track(sessionId, 'visitante-7', 'page_view');

        await asUser(db, user);
        await track(sessionId, 'visitante-7', 'business_view', {
            entityType: 'business',
            entityId: newId(),
        });

        const [session] = await rows('select anonymous_id, user_id from public.analytics_sessions');
        expect(session.anonymous_id).toBe('visitante-7');
        expect(session.user_id).toBe(user);

        const eventos = await rows('select user_id from public.analytics_events order by id');
        expect(eventos.map((row) => row.user_id)).toEqual([null, user]);
    });

    it('o mesmo visitante acumula sessões diferentes', async () => {
        await asAnon(db);
        await startSession(newId(), 'visitante-8');
        await startSession(newId(), 'visitante-8');

        const sessoes = await rows(`select id from public.analytics_sessions where anonymous_id = 'visitante-8'`);
        expect(sessoes).toHaveLength(2);
    });
});

// Guarda de catálogo, no espírito de function-privileges.test.js: o search_path
// vazio não muda comportamento nenhum, então nenhum teste de execução acusaria
// se alguém voltasse para `= public` numa edição futura. Só olhando pg_proc dá
// para barrar a regressão.
//
// As listas são exaustivas de propósito: RPC de analytics nova entra aqui e
// passa a ser obrigada aos mesmos hardenings, ou o teste quebra.
const COLETA = [
    'public.analytics_start_session(uuid,text,text,text,text,text,text,text,text,text)',
    'public.analytics_track(uuid,text,text,text,text,uuid,text,jsonb)',
];

const ADMIN = [
    'public.analytics_overview(timestamptz,timestamptz)',
    'public.analytics_top_pages(timestamptz,timestamptz,integer)',
    'public.analytics_top_businesses(timestamptz,timestamptz,integer)',
    'public.analytics_top_searches(timestamptz,timestamptz,integer)',
    'public.analytics_top_elements(timestamptz,timestamptz,text,text,integer)',
    'public.analytics_click_heatmap(timestamptz,timestamptz,text,text)',
    'public.analytics_heatmap_pages(timestamptz,timestamptz,text,integer)',
    'public.analytics_scroll_funnel(timestamptz,timestamptz,text,text)',
    'public.analytics_aggregate_day(date)',
    'public.analytics_backfill_daily_stats(date,date)',
    'public.analytics_health()',
];

// Sem grant para papel nenhum: só o dono executa. É por ela que um agendador
// entrará no futuro, sem precisar de um auth.uid() que ele não tem.
const INTERNAS = ['public.analytics_aggregate_day_internal(date)'];

describe('endurecimento das funções', () => {
    it('todas rodam como dono e com search_path vazio', async () => {
        const funcoes = await rows(`
            select p.proname, p.prosecdef, p.proconfig
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname like 'analytics%'
             order by p.proname
        `);

        expect(funcoes.map((fn) => fn.proname)).toEqual([
            'analytics_aggregate_day',
            'analytics_aggregate_day_internal',
            'analytics_backfill_daily_stats',
            'analytics_click_heatmap',
            'analytics_health',
            'analytics_heatmap_pages',
            'analytics_overview',
            'analytics_scroll_funnel',
            'analytics_start_session',
            'analytics_top_businesses',
            'analytics_top_elements',
            'analytics_top_pages',
            'analytics_top_searches',
            'analytics_track',
        ]);

        for (const fn of funcoes) {
            expect(fn.prosecdef).toBe(true);
            // `public` no caminho de uma função SECURITY DEFINER é superfície de
            // ataque: quem puder criar objeto lá sequestra a resolução de nome.
            expect(fn.proconfig).toEqual(['search_path=""']);
        }
    });

    // Função nasce com EXECUTE para PUBLIC. Antes do revoke, um papel criado sem
    // grant nenhum passava neste teste — conceder a anon e authenticated não
    // restringia coisa alguma.
    it('nenhuma RPC de analytics herda EXECUTE de PUBLIC', async () => {
        for (const assinatura of [...COLETA, ...ADMIN, ...INTERNAS]) {
            const [privilegios] = await rows(
                `select has_function_privilege('public', $1, 'execute') as publico`,
                [assinatura]
            );
            expect(privilegios.publico).toBe(false);
        }

        // A mesma coisa vista pelo ACL: entrada com beneficiário vazio, do tipo
        // `=X/postgres`, é PUBLIC. E ACL nulo significaria "privilégios padrão",
        // que também incluem PUBLIC — por isso não basta não ter a entrada.
        const funcoes = await rows(`
            select p.proname, p.proacl::text[] as acl
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname like 'analytics%'
        `);

        for (const fn of funcoes) {
            expect(fn.acl).not.toBeNull();
            expect(fn.acl.filter((entrada) => entrada.startsWith('='))).toEqual([]);
        }
    });

    // A separação que importa: o anônimo escreve e não lê; o autenticado alcança
    // as RPCs de admin (que barram por dentro); e a interna não é alcançável
    // pelo PostgREST de jeito nenhum, porque papel nenhum dele tem execute.
    it('cada categoria alcança exatamente o que deve', async () => {
        async function privilegios(assinatura) {
            const [linha] = await rows(
                `select has_function_privilege('anon', $1, 'execute') as anonimo,
                        has_function_privilege('authenticated', $1, 'execute') as autenticado`,
                [assinatura]
            );
            return linha;
        }

        for (const assinatura of COLETA) {
            expect(await privilegios(assinatura)).toEqual({ anonimo: true, autenticado: true });
        }

        for (const assinatura of ADMIN) {
            expect(await privilegios(assinatura)).toEqual({ anonimo: false, autenticado: true });
        }

        for (const assinatura of INTERNAS) {
            expect(await privilegios(assinatura)).toEqual({ anonimo: false, autenticado: false });
        }
    });
});

describe('sessão de outro visitante', () => {
    it('evento com session_id alheio é descartado, sem tocar na sessão de quem é dona', async () => {
        const sessionId = newId();

        await asAnon(db);
        await startSession(sessionId, 'visitante-dono');
        await track(sessionId, 'visitante-dono', 'page_view');

        // Envelhece a sessão: assim o freio de 5 minutos não é o que segura o
        // UPDATE, e o teste mede a guarda de dono, não o throttle.
        await rows(
            `update public.analytics_sessions set last_seen_at = now() - interval '10 minutes' where id = $1`,
            [sessionId]
        );
        const [antes] = await rows('select last_seen_at from public.analytics_sessions where id = $1', [
            sessionId,
        ]);

        await asAnon(db);
        await track(sessionId, 'visitante-intruso', 'business_whatsapp_click', {
            entityType: 'business',
            entityId: newId(),
        });

        const eventos = await rows('select anonymous_id from public.analytics_events');
        expect(eventos).toHaveLength(1);
        expect(eventos[0].anonymous_id).toBe('visitante-dono');

        const sessoes = await rows('select id, last_seen_at from public.analytics_sessions');
        expect(sessoes).toHaveLength(1);
        expect(sessoes[0].last_seen_at).toEqual(antes.last_seen_at);
    });

    it('conta autenticada não se vincula à sessão anônima de outra pessoa', async () => {
        const sessionId = newId();
        const intruso = await createUser(db);

        await asAnon(db);
        await startSession(sessionId, 'visitante-dono');

        await asUser(db, intruso);
        await track(sessionId, 'visitante-intruso', 'page_view');

        const [session] = await rows(
            'select user_id, anonymous_id from public.analytics_sessions where id = $1',
            [sessionId]
        );
        expect(session.user_id).toBeNull();
        expect(session.anonymous_id).toBe('visitante-dono');
        expect(await rows('select * from public.analytics_events')).toHaveLength(0);
    });

    it('a comparação é sobre o id normalizado, então o visitante de id longo não se tranca fora', async () => {
        const sessionId = newId();
        const longo = 'v'.repeat(80);

        await asAnon(db);
        await startSession(sessionId, longo);
        await track(sessionId, longo, 'page_view');

        const eventos = await rows('select anonymous_id from public.analytics_events');
        expect(eventos).toHaveLength(1);
        expect(eventos[0].anonymous_id).toBe('v'.repeat(64));
    });
});

describe('quem lê e quem escreve (RLS)', () => {
    it('visitante anônimo escreve pela RPC mas não lê nem escreve direto', async () => {
        const sessionId = newId();

        await asAnon(db);
        await startSession(sessionId, 'visitante-9');
        await track(sessionId, 'visitante-9', 'page_view');

        await asAnon(db);
        expect(await expectError(db.query('select * from public.analytics_sessions'))).toMatch(
            /permission denied|permissão negada/i
        );
        expect(await expectError(db.query('select * from public.analytics_events'))).toMatch(
            /permission denied|permissão negada/i
        );
        expect(
            await expectError(
                db.query(`insert into public.analytics_events (anonymous_id, event_type) values ('x', 'page_view')`)
            )
        ).toMatch(/permission denied|permissão negada/i);
    });

    it('usuário comum autenticado não enxerga nada de analytics', async () => {
        const sessionId = newId();
        const user = await createUser(db);

        await asUser(db, user);
        await startSession(sessionId, 'visitante-10');
        await track(sessionId, 'visitante-10', 'page_view');

        // Tem GRANT de select (a policy é que decide), então o resultado correto
        // é lista vazia — inclusive das próprias linhas que ele acabou de gerar.
        await asUser(db, user);
        expect((await db.query('select * from public.analytics_sessions')).rows).toHaveLength(0);
        expect((await db.query('select * from public.analytics_events')).rows).toHaveLength(0);
    });

    it('nem o dono da conta altera ou apaga o que já foi coletado', async () => {
        const sessionId = newId();
        const user = await createUser(db);

        await asUser(db, user);
        await startSession(sessionId, 'visitante-11');
        await track(sessionId, 'visitante-11', 'page_view');

        await asUser(db, user);
        expect(
            await expectError(db.query('update public.analytics_events set event_type = $1', ['search']))
        ).toMatch(/permission denied|permissão negada/i);
        expect(await expectError(db.query('delete from public.analytics_sessions'))).toMatch(
            /permission denied|permissão negada/i
        );
    });

    it('admin lê sessões e eventos', async () => {
        const sessionId = newId();
        const admin = await createUser(db, { admin: true });

        await asAnon(db);
        await startSession(sessionId, 'visitante-12');
        await track(sessionId, 'visitante-12', 'business_whatsapp_click', {
            entityType: 'business',
            entityId: newId(),
        });

        await asUser(db, admin);
        expect((await db.query('select * from public.analytics_sessions')).rows).toHaveLength(1);
        expect((await db.query('select * from public.analytics_events')).rows).toHaveLength(1);
    });
});
