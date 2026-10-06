// Vocabulário e apresentação do módulo de ofertas. Os valores vêm dos enums do
// banco (migration 20261005000002); aqui fica só o texto que a pessoa lê.

/** @typedef {'draft'|'pending_review'|'changes_requested'|'approved'|'scheduled'|'active'|'suspended'|'rejected'|'ended'} OfferStatus */

export const OFFER_STATUS_LABELS = {
    draft: 'Rascunho',
    pending_review: 'Em análise',
    changes_requested: 'Ajustes solicitados',
    approved: 'Aprovada',
    scheduled: 'Agendada',
    active: 'Ativa',
    suspended: 'Suspensa',
    rejected: 'Não aprovada',
    ended: 'Encerrada',
};

export const OFFER_STATUS_STYLE = {
    draft: 'bg-sand-dark text-dark-ocean',
    pending_review: 'bg-sun/15 text-dark-ocean',
    changes_requested: 'bg-sun/15 text-dark-ocean',
    approved: 'bg-turquoise/10 text-ocean',
    scheduled: 'bg-turquoise/10 text-ocean',
    active: 'bg-turquoise/15 text-ocean',
    suspended: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
    ended: 'bg-sand-dark text-dark-ocean/70',
};

export const BENEFIT_TYPES = [
    { value: 'percentage_discount', label: 'Desconto percentual' },
    { value: 'fixed_discount', label: 'Desconto em valor' },
    { value: 'gift', label: 'Brinde' },
    { value: 'extra_product', label: 'Produto adicional' },
    { value: 'extra_service', label: 'Serviço adicional' },
    { value: 'special_condition', label: 'Condição especial' },
    { value: 'other', label: 'Outro' },
];

/** Tipos em que o valor é obrigatório e tem significado monetário/percentual. */
export const VALUED_BENEFITS = ['percentage_discount', 'fixed_discount'];

export const REVIEW_ACTION_LABELS = {
    submitted: 'Oferta enviada para análise',
    changes_requested: 'Ajustes solicitados',
    resubmitted: 'Nova versão enviada',
    approved: 'Oferta aprovada',
    rejected: 'Oferta não aprovada',
    published: 'Oferta publicada',
    scheduled: 'Publicação agendada',
    suspended: 'Oferta suspensa',
    reactivated: 'Oferta reativada',
    ended: 'Oferta encerrada',
};

// ISO: 1 = segunda … 7 = domingo, como em offer_versions.days_of_week.
export const WEEKDAYS = [
    { value: 1, short: 'Seg', label: 'Segunda' },
    { value: 2, short: 'Ter', label: 'Terça' },
    { value: 3, short: 'Qua', label: 'Quarta' },
    { value: 4, short: 'Qui', label: 'Quinta' },
    { value: 5, short: 'Sex', label: 'Sexta' },
    { value: 6, short: 'Sáb', label: 'Sábado' },
    { value: 7, short: 'Dom', label: 'Domingo' },
];

// coupon_validity_minutes precisa ser positivo: "até o fim da oferta" não tem
// representação no banco e por isso não é oferecido.
export const COUPON_VALIDITY_OPTIONS = [
    { value: 120, label: '2 horas' },
    { value: 360, label: '6 horas' },
    { value: 720, label: '12 horas' },
    { value: 1440, label: '24 horas' },
    { value: 2880, label: '48 horas' },
    { value: 4320, label: '3 dias' },
    { value: 10080, label: '7 dias' },
];

// Pitimbu fica em America/Recife: UTC−3 o ano todo, sem horário de verão.
export const OFFER_TIME_ZONE = 'America/Recife';
export const OFFER_UTC_OFFSET = '-03:00';

const MONEY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PLAIN = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const DAY = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: OFFER_TIME_ZONE,
});
const DAY_TIME = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: OFFER_TIME_ZONE,
});
const ISO_DAY = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: OFFER_TIME_ZONE,
});

function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/** numeric chega do PostgREST como string; formata como R$. */
export function formatMoney(value) {
    const number = toNumber(value);
    return number === null ? '—' : MONEY.format(number);
}

export function formatOfferDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : DAY.format(date);
}

export function formatOfferDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : DAY_TIME.format(date);
}

/** Data (YYYY-MM-DD) do instante no fuso de Pitimbu, para inputs type=date. */
export function isoDayInPitimbu(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : ISO_DAY.format(date);
}

export function benefitTypeLabel(type) {
    return BENEFIT_TYPES.find((item) => item.value === type)?.label ?? 'Benefício';
}

/** "20% de desconto", "R$ 15,00 de desconto", "Brinde"… */
export function benefitSummary(version) {
    if (!version?.benefit_type) return 'Benefício a definir';
    const value = toNumber(version.benefit_value);
    if (version.benefit_type === 'percentage_discount' && value !== null) return `${PLAIN.format(value)}% de desconto`;
    if (version.benefit_type === 'fixed_discount' && value !== null) return `${MONEY.format(value)} de desconto`;
    return benefitTypeLabel(version.benefit_type);
}

export function periodSummary(version) {
    if (!version?.starts_at || !version?.ends_at) return 'Período a definir';
    return `${formatOfferDate(version.starts_at)} a ${formatOfferDate(version.ends_at)}`;
}

function daysLabel(days) {
    const sorted = [...(days ?? [])].sort((a, b) => a - b);
    if (sorted.length === 7) return 'Todos os dias';
    if (sorted.join(',') === '1,2,3,4,5') return 'Segunda a sexta';
    if (sorted.join(',') === '6,7') return 'Sábado e domingo';
    return sorted.map((day) => WEEKDAYS.find((item) => item.value === day)?.label ?? day).join(', ');
}

/**
 * Linhas legíveis de dias e horários. Sem faixas, vale o dia inteiro.
 * @returns {string[]}
 */
export function scheduleLines(version) {
    const days = version?.days_of_week ?? [];
    const windows = version?.time_windows ?? [];
    if (windows.length === 0) return [`${daysLabel(days)} · dia inteiro`];

    return [...days]
        .sort((a, b) => a - b)
        .map((day) => {
            const label = WEEKDAYS.find((item) => item.value === day)?.label ?? String(day);
            const slots = windows
                .filter((window) => Number(window.day) === day)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((window) => `${window.start}–${window.end}`);
            return `${label}: ${slots.length ? slots.join(', ') : 'sem horário definido'}`;
        });
}

export function couponValidityLabel(minutes) {
    const value = toNumber(minutes);
    if (value === null) return 'A definir';
    const option = COUPON_VALIDITY_OPTIONS.find((item) => item.value === value);
    if (option) return option.label;
    if (value % 1440 === 0) return `${value / 1440} dias`;
    if (value % 60 === 0) return `${value / 60} horas`;
    return `${value} minutos`;
}

export function totalLimitLabel(limit) {
    const value = toNumber(limit);
    return value === null ? 'Sem limite total' : `${PLAIN.format(value)} utilizações`;
}

export function perUserLimitLabel(limit) {
    const value = toNumber(limit) ?? 1;
    return value === 1 ? '1 utilização por pessoa' : `${PLAIN.format(value)} utilizações por pessoa`;
}

// ---------------------------------------------------------------------------
// Situação derivada da oferta e das versões
// ---------------------------------------------------------------------------

/**
 * Junta a oferta com as versões e responde o que a tela precisa: versão mais
 * recente, versão publicada e se há revisão de oferta ativa em andamento.
 * Nada aqui decide transição — só descreve o que o banco já registrou.
 */
export function describeOffer(offer, versions = []) {
    const ordered = [...versions]
        .filter((version) => version.offer_id === offer.id)
        .sort((a, b) => a.version_number - b.version_number);
    const latest = ordered.at(-1) ?? null;
    const published = ordered.find((version) => version.id === offer.published_version_id) ?? null;
    const hasRevision = Boolean(published && latest && latest.id !== published.id);
    return {
        latest,
        published,
        versions: ordered,
        // Revisão de oferta ativa: o status continua active; quem conta é a versão.
        revisionStatus: hasRevision ? latest.review_status : null,
        awaitingReview: latest?.review_status === 'submitted',
        // O que mostrar como "a oferta": publicada, se houver; senão a mais recente.
        display: published ?? latest,
    };
}

/** Rótulo curto para revisão em andamento de uma oferta já publicada. */
export const REVISION_STATUS_LABELS = {
    draft: 'Alteração em rascunho',
    submitted: 'Alteração em análise',
    changes_requested: 'Ajustes solicitados na alteração',
    approved: 'Alteração aprovada, aguardando publicação',
    rejected: 'Alteração não aprovada',
};

/** Última mensagem administrativa que explica o estado atual ao proprietário. */
export function latestAdminMessage(reviews = [], actions = ['changes_requested', 'rejected', 'suspended']) {
    return (
        [...reviews]
            .filter((review) => actions.includes(review.action) && review.message)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null
    );
}

