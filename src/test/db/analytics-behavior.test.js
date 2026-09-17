// @vitest-environment node
//
// Os dois eventos de comportamento da Sprint 02 (migration 20260915000002).
//
// O metadata aqui não é enfeite: `scroll_depth` sem profundidade e
// `element_click` sem elemento são linhas que nenhuma consulta do mapa de calor
// consegue usar. A RPC valida e descarta em silêncio — e é isso que se testa.
//
// Banco real e descartável (ver harness.js), um por arquivo: cada caso usa o
// próprio visitante, então não há estado compartilhado a limpar.
import { beforeAll, describe, expect, it } from 'vitest';
import { asAnon, asService, createTestDb } from './harness';

let db;

beforeAll(async () => {
    db = await createTestDb();
}, 60_000);

// Cada caso é um visitante próprio, com a sessão já anunciada.
async function novoVisitante(nome) {
    const sessionId = crypto.randomUUID();
    const anonymousId = `${nome}-${crypto.randomUUID().slice(0, 8)}`;

    await asAnon(db);
    await db.query('select public.analytics_start_session($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [
        sessionId, anonymousId, '/', null, 'desktop', null, null, null, null, null,
    ]);

    return { sessionId, anonymousId };
}

async function track({ sessionId, anonymousId }, eventType, metadata = {}) {
    await asAnon(db);
    await db.query('select public.analytics_track($1, $2, $3, $4, $5, $6, $7, $8::jsonb)', [
        sessionId, anonymousId, eventType, '/', null, null, 'desktop', JSON.stringify(metadata),
    ]);
}

async function eventosDe({ anonymousId }) {
    await asService(db);
    const { rows } = await db.query(
        'select event_type, metadata from public.analytics_events where anonymous_id = $1 order by id',
        [anonymousId]
    );
    return rows;
}

describe('scroll_depth', () => {
    it('grava os cinco marcos e mais nenhum número', async () => {
        const visitante = await novoVisitante('scroll-validos');

        for (const depth of [25, 50, 75, 90, 100]) {
            await track(visitante, 'scroll_depth', { depth });
        }

        expect((await eventosDe(visitante)).map((row) => row.metadata.depth)).toEqual([
            25, 50, 75, 90, 100,
        ]);
    });

    it('descarta profundidade fora da lista, ausente ou em formato errado', async () => {
        const visitante = await novoVisitante('scroll-invalidos');

        await track(visitante, 'scroll_depth', { depth: 30 });
        await track(visitante, 'scroll_depth', { depth: 0 });
        await track(visitante, 'scroll_depth', { depth: 101 });
        await track(visitante, 'scroll_depth', {});
        // Número em string é o erro clássico de quem monta o JSON à mão.
        await track(visitante, 'scroll_depth', { depth: '50' });
        await track(visitante, 'scroll_depth', { depth: null });
        await track(visitante, 'scroll_depth', { profundidade: 50 });

        expect(await eventosDe(visitante)).toHaveLength(0);
    });
});

describe('element_click', () => {
    it('grava elemento e coordenadas', async () => {
        const visitante = await novoVisitante('click-valido');

        await track(visitante, 'element_click', {
            element: 'business-card',
            x_percent: 0.4821,
            y_percent: 0.6174,
        });

        const [evento] = await eventosDe(visitante);
        expect(evento.metadata).toEqual({
            element: 'business-card',
            x_percent: 0.4821,
            y_percent: 0.6174,
        });
    });

    // Clique de teclado não tem posição de ponteiro: o evento vale, as
    // coordenadas não existem.
    it('aceita clique sem coordenadas', async () => {
        const visitante = await novoVisitante('click-teclado');

        await track(visitante, 'element_click', { element: 'login-submit' });

        expect((await eventosDe(visitante))[0].metadata).toEqual({ element: 'login-submit' });
    });

    it('aceita os extremos de 0 e 1', async () => {
        const visitante = await novoVisitante('click-extremos');

        await track(visitante, 'element_click', { element: 'canto', x_percent: 0, y_percent: 0 });
        await track(visitante, 'element_click', { element: 'fim', x_percent: 1, y_percent: 1 });

        expect(await eventosDe(visitante)).toHaveLength(2);
    });

    it('descarta elemento ausente, vazio ou longo demais', async () => {
        const visitante = await novoVisitante('click-elemento');

        await track(visitante, 'element_click', {});
        await track(visitante, 'element_click', { element: '' });
        await track(visitante, 'element_click', { element: 'x'.repeat(81) });
        await track(visitante, 'element_click', { element: 42 });
        await track(visitante, 'element_click', { elemento: 'business-card' });

        expect(await eventosDe(visitante)).toHaveLength(0);
    });

    it('aceita o limite de 80 caracteres', async () => {
        const visitante = await novoVisitante('click-limite');

        await track(visitante, 'element_click', { element: 'x'.repeat(80) });

        expect(await eventosDe(visitante)).toHaveLength(1);
    });

    it('descarta coordenada fora de 0..1 ou que não seja número', async () => {
        const visitante = await novoVisitante('click-coordenadas');

        await track(visitante, 'element_click', { element: 'ok', x_percent: -0.1 });
        await track(visitante, 'element_click', { element: 'ok', x_percent: 1.5 });
        await track(visitante, 'element_click', { element: 'ok', y_percent: -1 });
        await track(visitante, 'element_click', { element: 'ok', y_percent: 2 });
        await track(visitante, 'element_click', { element: 'ok', x_percent: 'meio' });
        await track(visitante, 'element_click', { element: 'ok', y_percent: null });

        expect(await eventosDe(visitante)).toHaveLength(0);
    });
});

describe('o que a Sprint 02 não pode ter mexido', () => {
    it('os eventos da Sprint 01 continuam gravando, com o metadata de sempre', async () => {
        const visitante = await novoVisitante('sprint-01');

        await track(visitante, 'page_view');
        await track(visitante, 'business_view');
        await track(visitante, 'business_whatsapp_click');
        await track(visitante, 'business_location_click');
        await track(visitante, 'search', { query: 'pousada', resultsCount: 12 });

        const eventos = await eventosDe(visitante);
        expect(eventos.map((row) => row.event_type)).toEqual([
            'page_view',
            'business_view',
            'business_whatsapp_click',
            'business_location_click',
            'search',
        ]);
        expect(eventos[4].metadata).toEqual({ query: 'pousada', resultsCount: 12 });
    });

    // A whitelist cresceu de 5 para 7, não virou portão aberto.
    it('eventos de sprints futuras continuam recusados', async () => {
        const visitante = await novoVisitante('futuros');

        await track(visitante, 'rage_click', { element: 'business-card' });
        await track(visitante, 'dead_click', { element: 'business-card' });
        await track(visitante, 'session_replay', {});
        await track(visitante, 'mouse_move', { x_percent: 0.5 });
        await track(visitante, 'attention_map', {});

        expect(await eventosDe(visitante)).toHaveLength(0);
    });

    it('a guarda de dono da sessão continua valendo para os eventos novos', async () => {
        const dono = await novoVisitante('dono-scroll');

        await asAnon(db);
        await db.query('select public.analytics_track($1, $2, $3, $4, $5, $6, $7, $8::jsonb)', [
            dono.sessionId, 'intruso-sprint-02', 'scroll_depth', '/', null, null, 'desktop',
            JSON.stringify({ depth: 50 }),
        ]);

        await asService(db);
        const { rows } = await db.query(
            "select 1 from public.analytics_events where anonymous_id = 'intruso-sprint-02'"
        );
        expect(rows).toHaveLength(0);
    });

    it('metadata gigante continua barrado antes da validação', async () => {
        const visitante = await novoVisitante('metadata-grande');

        // O teto de 1000 caracteres zera o metadata; sem profundidade, o evento
        // de scroll deixa de ser válido e é descartado inteiro.
        await track(visitante, 'scroll_depth', { depth: 50, lixo: 'x'.repeat(1200) });

        expect(await eventosDe(visitante)).toHaveLength(0);
    });
});
