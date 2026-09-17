import { supabase } from '@/integrations/supabase/client';

// Camada única de acesso às RPCs de leitura do painel. Nenhum componente chama
// `supabase.rpc` direto: os nomes das funções e a forma dos parâmetros ficam
// neste arquivo, e a tela lida só com objetos.
//
// Todas devolvem `{ data, error }`, como o resto do projeto — nunca lançam. O
// erro é o objeto do PostgREST, com `message` = código estável
// ('forbidden', 'invalid_period', ...), que `businessErrors.js` traduz.

/**
 * @typedef {Object} AnalyticsRange
 * @property {string} startAt instante ISO, início inclusivo
 * @property {string} endAt instante ISO, fim exclusivo
 */

/**
 * @typedef {Object} AnalyticsFilters
 * @property {string} startAt
 * @property {string} endAt
 * @property {string|null} [pathname]
 * @property {'mobile'|'tablet'|'desktop'|null} [deviceType] null = todos
 * @property {number} [limit]
 */

/**
 * @typedef {Object} AnalyticsOverview
 * @property {number} unique_visitors
 * @property {number} sessions
 * @property {number} page_views
 * @property {number} whatsapp_clicks
 * @property {number} business_views
 * @property {number} searches
 */

/**
 * @typedef {Object} AnalyticsHealth
 * @property {number} events_total
 * @property {string|null} first_event_at
 * @property {string|null} last_event_at
 * @property {string|null} last_aggregated_date data pura, sem hora
 * @property {string|null} last_aggregated_at
 * @property {number} aggregated_days
 * @property {number} daily_rows
 */

/**
 * @typedef {Object} HeatmapPoint
 * @property {string} x centro do balde, 0..1 (numeric vem como string)
 * @property {string} y centro do balde, 0..1
 * @property {number} clicks
 */

/**
 * @typedef {Object} ScrollFunnelStep
 * @property {number} depth 25 | 50 | 75 | 90 | 100
 * @property {number} reached
 * @property {number} page_views
 * @property {string|null} rate percentual sobre page_views
 */

async function call(fn, params) {
    const { data, error } = await supabase.rpc(fn, params);
    return { data: error ? null : (data ?? []), error: error ?? null };
}

function period({ startAt, endAt }) {
    return { p_start_at: startAt, p_end_at: endAt };
}

/** @param {AnalyticsRange} range @returns {Promise<{data: AnalyticsOverview|null, error: Object|null}>} */
export async function getAnalyticsOverview(range) {
    const { data, error } = await call('analytics_overview', period(range));
    return { data: error ? null : (data[0] ?? null), error };
}

/** @param {AnalyticsFilters} filters */
export function getTopPages({ startAt, endAt, limit = 10 }) {
    return call('analytics_top_pages', { ...period({ startAt, endAt }), p_limit: limit });
}

/** @param {AnalyticsFilters} filters */
export function getTopBusinesses({ startAt, endAt, limit = 10 }) {
    return call('analytics_top_businesses', { ...period({ startAt, endAt }), p_limit: limit });
}

/** @param {AnalyticsFilters} filters */
export function getTopSearches({ startAt, endAt, limit = 20 }) {
    return call('analytics_top_searches', { ...period({ startAt, endAt }), p_limit: limit });
}

/** @param {AnalyticsFilters} filters */
export function getTopElements({ startAt, endAt, pathname = null, deviceType = null, limit = 20 }) {
    return call('analytics_top_elements', {
        ...period({ startAt, endAt }),
        p_pathname: pathname,
        p_device_type: deviceType,
        p_limit: limit,
    });
}

/** @param {AnalyticsFilters} filters @returns {Promise<{data: HeatmapPoint[]|null, error: Object|null}>} */
export function getClickHeatmap({ startAt, endAt, pathname, deviceType = null }) {
    return call('analytics_click_heatmap', {
        ...period({ startAt, endAt }),
        p_pathname: pathname,
        p_device_type: deviceType,
    });
}

/** @param {AnalyticsFilters} filters */
export function getHeatmapPages({ startAt, endAt, deviceType = null, limit = 50 }) {
    return call('analytics_heatmap_pages', {
        ...period({ startAt, endAt }),
        p_device_type: deviceType,
        p_limit: limit,
    });
}

/** @param {AnalyticsFilters} filters @returns {Promise<{data: ScrollFunnelStep[]|null, error: Object|null}>} */
export function getScrollFunnel({ startAt, endAt, pathname, deviceType = null }) {
    return call('analytics_scroll_funnel', {
        ...period({ startAt, endAt }),
        p_pathname: pathname,
        p_device_type: deviceType,
    });
}

/**
 * Saúde da coleta e da agregação. Não recebe período: é o estado de agora.
 * @returns {Promise<{data: AnalyticsHealth|null, error: Object|null}>}
 */
export async function getAnalyticsHealth() {
    const { data, error } = await call('analytics_health', {});
    return { data: error ? null : (data[0] ?? null), error };
}
