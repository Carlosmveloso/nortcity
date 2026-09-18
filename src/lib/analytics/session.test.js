import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SESSION_TIMEOUT_MS,
    getAnonymousId,
    resetAnalyticsSessionForTests,
    resolveSession,
} from './session';

// Instante fixo e realista: um carimbo de atividade valendo 0 seria 1970, e a
// sessão nasceria sempre expirada.
const AGORA = Date.parse('2026-09-15T10:00:00Z');

beforeEach(() => {
    resetAnalyticsSessionForTests();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('anonymous_id', () => {
    it('é criado uma vez e reaproveitado', () => {
        const primeiro = getAnonymousId();
        expect(primeiro).toMatch(/^[0-9a-f-]{36}$/i);
        expect(getAnonymousId()).toBe(primeiro);
    });

    it('atravessa sessões: é a pessoa, não a visita', () => {
        const primeira = resolveSession(AGORA);
        const depois = resolveSession(AGORA + SESSION_TIMEOUT_MS + 1);

        expect(depois.sessionId).not.toBe(primeira.sessionId);
        expect(depois.anonymousId).toBe(primeira.anonymousId);
    });
});

describe('sessão', () => {
    it('é reaproveitada enquanto houver atividade dentro de 30 minutos', () => {
        const primeira = resolveSession(AGORA);
        const segunda = resolveSession(AGORA + 29 * 60 * 1000);

        expect(segunda.sessionId).toBe(primeira.sessionId);
        expect(primeira.isNew).toBe(true);
        expect(segunda.isNew).toBe(false);
    });

    it('expira por inatividade, não por tempo de vida: a janela desliza', () => {
        // Duas horas de navegação com pausas de 20 minutos continuam sendo a
        // mesma visita — o que encerra a sessão é ficar parado, não durar muito.
        const primeira = resolveSession(AGORA);
        const vinte = resolveSession(AGORA + 20 * 60 * 1000);
        const quarenta = resolveSession(AGORA + 40 * 60 * 1000);

        expect(vinte.sessionId).toBe(primeira.sessionId);
        expect(quarenta.sessionId).toBe(primeira.sessionId);
    });

    it('vira outra depois de 30 minutos parado', () => {
        const primeira = resolveSession(AGORA);
        const depois = resolveSession(AGORA + SESSION_TIMEOUT_MS + 1);

        expect(depois.sessionId).not.toBe(primeira.sessionId);
        expect(depois.isNew).toBe(true);
    });
});

describe('consistência entre visitante e sessão', () => {
    // O estado é possível de verdade: apagar só uma chave no DevTools, ou uma
    // escrita que falhou por cota. Herdar a sessão aqui mandaria um
    // anonymous_id novo com um session_id que, no banco, é de outro dono — e a
    // guarda de `analytics_track` descartaria os eventos até a sessão expirar.
    it('anonymous_id ausente com sessão antiga presente gera visitante novo e sessão nova', () => {
        localStorage.setItem('farol_analytics_session_id', 'sessao-antiga');
        localStorage.setItem('farol_analytics_last_activity', String(AGORA));

        const sessao = resolveSession(AGORA + 60 * 1000);

        expect(sessao.sessionId).not.toBe('sessao-antiga');
        expect(sessao.isNew).toBe(true);
        expect(sessao.anonymousId).toMatch(/^[0-9a-f-]{36}$/i);

        // E o storage tem de sair consistente, não com a sessão velha de volta.
        expect(localStorage.getItem('farol_analytics_session_id')).toBe(sessao.sessionId);
        expect(localStorage.getItem('farol_analytics_last_activity')).toBe(String(AGORA + 60 * 1000));
        expect(localStorage.getItem('farol_anonymous_id')).toBe(sessao.anonymousId);
    });

    it('visitante que já existia continua herdando a própria sessão', () => {
        const primeira = resolveSession(AGORA);
        const segunda = resolveSession(AGORA + 60 * 1000);

        expect(segunda.sessionId).toBe(primeira.sessionId);
        expect(segunda.isNew).toBe(false);
    });
});

describe('storage indisponível', () => {
    // Modo privado, cota cheia ou extensão bloqueando: nada disso pode derrubar
    // a navegação. A reserva em memória mantém a sessão de pé dentro da aba.
    it('não lança e mantém a sessão viva na memória', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage bloqueado');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage bloqueado');
        });

        const primeira = resolveSession(AGORA);
        const segunda = resolveSession(AGORA + 60 * 1000);

        expect(primeira.sessionId).toBe(segunda.sessionId);
        expect(primeira.anonymousId).toBe(segunda.anonymousId);
    });
});
