// Vocabulário dos cupons (migration 20261007000001). O banco decide a
// situação; aqui fica o texto que a pessoa lê e a tradução dos erros.
import { businessErrorMessage } from './businessErrors';
import { OFFER_TIME_ZONE } from './offers';

export const COUPON_STATUS_LABELS = {
    available: 'Disponível',
    expired: 'Expirado',
    canceled: 'Cancelado',
};

export const COUPON_STATUS_STYLE = {
    available: 'bg-turquoise/15 text-ocean',
    expired: 'bg-sand-dark text-dark-ocean/80',
    canceled: 'bg-red-100 text-red-700',
};

// "Utilizados" só entra quando a Sprint 3 criar o estado `used`.
export const COUPON_FILTERS = [
    { value: 'available', label: 'Disponíveis' },
    { value: 'expired', label: 'Expirados' },
    { value: 'canceled', label: 'Cancelados' },
];

export const COUPON_TERMS_CHECKBOX =
    'Li e concordo com o Regulamento de Utilização dos Cupons e com as condições específicas desta oferta.';

// Conteúdo do QR: só o token opaco, com prefixo de formato para a leitura
// futura (Sprint 3). Nada de dados pessoais ou condições da oferta.
export function couponQrPayload(token) {
    return token ? `farol-cupom:1:${token}` : null;
}

const VALID_UNTIL = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: OFFER_TIME_ZONE,
});

/** "06/10/2026 às 18:42", no horário de Pitimbu. */
export function formatCouponDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const parts = Object.fromEntries(VALID_UNTIL.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`;
}

/**
 * Situação exibida. O banco já devolve `expired` para disponível vencido;
 * isto cobre o cupom que vence com a tela aberta.
 */
export function couponDisplayStatus(coupon, now = new Date()) {
    if (coupon?.status === 'available' && new Date(coupon.expires_at) <= now) return 'expired';
    return coupon?.status;
}

const MESSAGES = {
    auth_required: 'Entre na sua conta para gerar este cupom.',
    offer_not_found: 'Oferta não encontrada.',
    offer_not_active: 'Esta oferta não está disponível no momento.',
    offer_not_started: 'Esta oferta ainda não começou. Volte na data de início.',
    offer_expired: 'Esta oferta já terminou.',
    offer_sold_out: 'Os cupons desta oferta estão temporariamente esgotados. Uma vaga pode voltar quando algum cupom expirar.',
    coupon_already_available: 'Você já tem um cupom disponível desta oferta.',
    user_limit_reached: 'Você já atingiu o limite de utilizações desta oferta.',
    terms_not_accepted: 'Aceite o regulamento e as condições da oferta para gerar o cupom.',
    terms_outdated: 'O regulamento foi atualizado. Leia a nova versão e confirme o aceite novamente.',
    qr_key_unavailable: 'Não foi possível gerar o cupom agora. Tente novamente em instantes.',
    coupon_code_unavailable: 'Não foi possível gerar o código do cupom. Tente novamente.',
    coupon_not_found: 'Cupom não encontrado.',
};

export function couponErrorMessage(error, fallback = 'Não foi possível concluir. Tente novamente em instantes.') {
    if (!error) return fallback;
    const known = MESSAGES[error.message];
    if (known) return known;
    if (error.code === '42501') return 'Entre na sua conta para continuar.';
    const general = businessErrorMessage({ message: error.message }, '');
    if (general && !general.includes('(código:')) return general;
    console.error('[farol] erro de cupom não mapeado:', error);
    return fallback;
}
