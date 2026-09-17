// Fonte única dos eventos que o Farol coleta.
//
// A mesma lista é constraint em `analytics_events` (migrations 20260915000001 e
// 20260915000002). String solta espalhada pelas telas vira evento que o banco
// descarta sem ninguém ficar sabendo — daí a constante.
export const AnalyticsEvents = {
    PAGE_VIEW: 'page_view',

    BUSINESS_VIEW: 'business_view',
    BUSINESS_WHATSAPP_CLICK: 'business_whatsapp_click',
    BUSINESS_LOCATION_CLICK: 'business_location_click',

    SEARCH: 'search',

    // Sprint 02: comportamento, não intenção. Alimentam o mapa de calor futuro.
    SCROLL_DEPTH: 'scroll_depth',
    ELEMENT_CLICK: 'element_click',
};

export const ANALYTICS_EVENT_TYPES = Object.values(AnalyticsEvents);
