import { describe, expect, it } from 'vitest';
import { authErrorMessage, confirmationError, confirmationRedirectUrl } from './authFeedback';

describe('feedback de autenticação', () => {
    it('distingue falta de confirmação de credenciais incorretas pelo código', () => {
        expect(
            authErrorMessage({ code: 'email_not_confirmed', message: 'different text' }),
        ).toMatch(/ainda não foi confirmado/);
        expect(authErrorMessage({ code: 'invalid_credentials' })).toBe(
            'E-mail ou senha incorretos.',
        );
        expect(authErrorMessage({ message: 'Email not confirmed' })).toMatch(
            /ainda não foi confirmado/,
        );
    });
    it('não exibe mensagens remotas arbitrárias', () => {
        expect(authErrorMessage({ message: 'internal secret' })).not.toContain('internal secret');
        expect(confirmationError('', '#error_description=internal+secret')).toBe(
            'confirmation_failed',
        );
    });
    it('reconhece link expirado em fragmento ou query e ignora hash comum', () => {
        expect(confirmationError('', '#error_code=otp_expired')).toBe('otp_expired');
        expect(confirmationError('?error_code=otp_expired')).toBe('otp_expired');
        expect(confirmationError('', '#main-content')).toBeNull();
        expect(confirmationError('?confirmacao=1')).toBeNull();
    });
    it('gera retorno no ambiente atual sem copiar tokens ou parâmetros de entrada', () => {
        expect(confirmationRedirectUrl('https://farolpitimbu.com.br')).toBe(
            'https://farolpitimbu.com.br/entrar?confirmacao=1',
        );
        expect(confirmationRedirectUrl('http://localhost:5173')).toBe(
            'http://localhost:5173/entrar?confirmacao=1',
        );
    });
});
