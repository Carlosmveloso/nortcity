const MESSAGES = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed:
        'Seu e-mail ainda não foi confirmado. Abra o link recebido ou solicite uma nova confirmação abaixo.',
    user_already_exists: 'Já existe uma conta com este e-mail. Tente entrar.',
    email_exists: 'Já existe uma conta com este e-mail. Tente entrar.',
    otp_expired:
        'O link de confirmação expirou ou já foi utilizado. Tente entrar; se o e-mail ainda não estiver confirmado, solicite um novo link abaixo.',
    over_email_send_rate_limit:
        'Aguarde alguns minutos antes de pedir outro e-mail de confirmação.',
    over_request_rate_limit:
        'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
    weak_password: 'Escolha uma senha mais forte para criar sua conta.',
    signup_disabled: 'O cadastro está temporariamente indisponível. Tente novamente mais tarde.',
    confirmation_failed:
        'Não foi possível concluir a confirmação por este link. Tente entrar ou solicite uma nova confirmação abaixo.',
};

const LEGACY_CODES = {
    'Invalid login credentials': 'invalid_credentials',
    'Email not confirmed': 'email_not_confirmed',
    'User already registered': 'user_already_exists',
};

export function authErrorCode(error) {
    return error?.code ?? LEGACY_CODES[error?.message];
}

export function authErrorMessage(error) {
    const code = authErrorCode(error);
    if (MESSAGES[code]) return MESSAGES[code];
    if (error?.status === 429) return MESSAGES.over_request_rate_limit;
    return 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}

// Não propaga descrições arbitrárias nem tokens recebidos pela URL.
export function confirmationError(search = '', hash = '') {
    const query = new URLSearchParams(search);
    const fragment = new URLSearchParams(hash.replace(/^#/, ''));
    for (const params of [fragment, query]) {
        if (params.has('error') || params.has('error_code') || params.has('error_description')) {
            return params.get('error_code') === 'otp_expired'
                ? 'otp_expired'
                : 'confirmation_failed';
        }
    }
    return null;
}

export function confirmationRedirectUrl(origin) {
    return new URL('/entrar?confirmacao=1', origin).href;
}
