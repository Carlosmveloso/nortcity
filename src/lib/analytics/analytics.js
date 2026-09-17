import { supabase } from '@/integrations/supabase/client';

import { getBrowser, getDeviceType, getOs } from './device';
import { ANALYTICS_EVENT_TYPES } from './events';
import { resolveSession } from './session';

// Produção coleta; desenvolvimento não polui a base — o .env local aponta para
// o mesmo projeto Supabase de produção. `VITE_ANALYTICS_ENABLED` vence quando
// está definida, nos dois sentidos: liga o dev para o teste manual e desliga o
// preview do Vercel, que também é build de produção contra o mesmo banco.
function readEnabledFlag() {
    const flag = import.meta.env.VITE_ANALYTICS_ENABLED;
    if (flag === 'true' || flag === '1') return true;
    if (flag === 'false' || flag === '0') return false;
    return Boolean(import.meta.env.PROD);
}

export const analyticsEnabled = readEnabledFlag();

// Erro de analytics aparece uma vez, só em desenvolvimento. O silêncio em
// produção é proposital: telemetria não vale encher o console de quem está
// navegando, e a regra da Sprint é que ela jamais atrapalhe o site.
function reportError(error) {
    if (import.meta.env.DEV) console.error('[farol] analytics:', error);
}

// Uma chamada por sessão, guardada no módulo: navegar entre páginas não
// reanuncia a sessão, e o efeito duplo do modo estrito do React não vira duas.
let startedSessionId = null;
let startPromise = null;

function readUtm() {
    const params = new URLSearchParams(window.location.search);
    return {
        p_utm_source: params.get('utm_source') || null,
        p_utm_medium: params.get('utm_medium') || null,
        p_utm_campaign: params.get('utm_campaign') || null,
    };
}

function startSession(sessionId, anonymousId) {
    if (startedSessionId === sessionId && startPromise) return startPromise;

    startedSessionId = sessionId;

    // `Promise.resolve` em volta do builder do supabase-js não é enfeite: o
    // builder é preguiçoso e dispara uma requisição a cada `then`, então
    // guardá-lo cru e esperá-lo duas vezes criaria a sessão duas vezes.
    //
    // A origem é lida uma vez, no nascimento da sessão: UTM e referrer dizem de
    // onde a visita veio, não em que página ela está agora.
    startPromise = Promise.resolve(
        supabase.rpc('analytics_start_session', {
            p_session_id: sessionId,
            p_anonymous_id: anonymousId,
            p_landing_page: window.location.pathname,
            p_referrer: document.referrer || null,
            p_device_type: getDeviceType(),
            p_browser: getBrowser(),
            p_os: getOs(),
            ...readUtm(),
        })
    )
        .then(({ error }) => {
            if (error) reportError(error);
        })
        .catch(reportError);

    return startPromise;
}

/**
 * Registra um evento. Preenche sozinho sessão, visitante, caminho e
 * dispositivo — quem chama informa só o que é próprio do evento.
 *
 * Nunca lança e nunca deve ser esperada com `await` por quem chama: se o
 * analytics falhar, a ação original (abrir o WhatsApp, navegar, buscar)
 * continua exatamente igual.
 */
export async function track(eventType, { entityType = null, entityId = null, metadata = null } = {}) {
    if (!analyticsEnabled) return;

    try {
        if (typeof window === 'undefined') return;
        if (!ANALYTICS_EVENT_TYPES.includes(eventType)) return;

        const { sessionId, anonymousId, isNew } = resolveSession();

        // A sessão precisa existir antes do primeiro evento. Se o anúncio
        // falhar, segue mesmo assim: `analytics_track` cria a que faltou, em vez
        // de a chave estrangeira derrubar o evento em silêncio.
        if (isNew || !startPromise) await startSession(sessionId, anonymousId);

        const { error } = await supabase.rpc('analytics_track', {
            p_session_id: sessionId,
            p_anonymous_id: anonymousId,
            p_event_type: eventType,
            // Só o caminho: a querystring carrega filtro e termo de busca, que
            // têm lugar próprio no metadata de `search`.
            p_pathname: window.location.pathname,
            p_entity_type: entityType,
            p_entity_id: entityId,
            p_device_type: getDeviceType(),
            p_metadata: metadata ?? {},
        });

        if (error) reportError(error);
    } catch (error) {
        reportError(error);
    }
}

// Só para os testes: o estado da sessão anunciada sobreviveria entre casos.
export function resetAnalyticsForTests() {
    startedSessionId = null;
    startPromise = null;
}
