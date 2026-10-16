// Validação e utilização de cupons (migration 20261016000002). O banco
// decide; aqui ficam o texto para o validador e a tradução dos erros.
import { couponErrorMessage } from './coupons';

const QR_PREFIX = 'farol-cupom:1:';
const CODE_ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/**
 * Espelho de parse_coupon_input: só para mostrar ao validador o que foi
 * entendido. O servidor normaliza de novo e é quem decide.
 * @returns {{ method: 'qr' | 'code', value: string } | null}
 */
export function readCouponInput(input) {
    const raw = (input ?? '').trim();
    if (raw.toLowerCase().startsWith(QR_PREFIX) && raw.length === QR_PREFIX.length + 43) return { method: 'qr', value: raw };
    let compact = raw.replace(/[\s-]/g, '').toUpperCase();
    if (compact.startsWith('FP') && compact.length === 8) compact = compact.slice(2);
    if (CODE_ALPHABET.test(compact)) return { method: 'code', value: `FP-${compact}` };
    return null;
}

/** Motivo de recusa devolvido por verify_coupon, em linguagem de balcão. */
export const VERIFY_REASONS = {
    coupon_already_used: 'Este cupom já foi utilizado.',
    coupon_canceled: 'Este cupom foi cancelado pelo Farol Pitimbu e não pode ser utilizado.',
    coupon_expired: 'Este cupom expirou e não pode ser utilizado.',
    offer_time_window_not_allowed: 'Este cupom não vale neste dia ou horário. Confira os dias e horários da oferta.',
};

const MESSAGES = {
    ...VERIFY_REASONS,
    not_a_validator: 'Sua conta não valida cupons deste estabelecimento.',
    coupon_not_found: 'Cupom não encontrado para este estabelecimento. Confira o código.',
    user_limit_reached: 'Esta pessoa já atingiu o limite de utilizações desta oferta.',
    account_not_found: 'Nenhuma conta encontrada com esse e-mail. A pessoa precisa criar uma conta no Farol Pitimbu antes.',
    validator_is_owner: 'O proprietário já valida os cupons do próprio negócio.',
    validator_already_active: 'Essa conta já é validadora deste negócio.',
    too_many_attempts: 'Muitas tentativas sem sucesso. Aguarde alguns minutos e tente novamente.',
};

export function validationErrorMessage(error) {
    if (!error) return couponErrorMessage(null);
    return MESSAGES[error.message] ?? couponErrorMessage(error);
}
