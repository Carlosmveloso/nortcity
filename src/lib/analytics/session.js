// Identidade do visitante e ciclo de vida da sessão, tudo no navegador.
//
// São duas coisas diferentes e é a distinção que dá valor ao dado: o
// `anonymous_id` é a pessoa e atravessa visitas; a sessão é uma visita e morre
// com 30 minutos de inatividade. Um `anonymous_id` acumula várias sessões — é
// daí que sai, depois, "esse visitante voltou três vezes nesta semana".
//
// As chaves têm o nome que a especificação da Sprint pediu, e não o padrão
// `farol-pitimbu:<assunto>` do cache de marés, porque o roteiro de teste manual
// manda procurar exatamente por elas no DevTools.
const ANONYMOUS_ID_KEY = 'farol_anonymous_id';
const SESSION_ID_KEY = 'farol_analytics_session_id';
const LAST_ACTIVITY_KEY = 'farol_analytics_last_activity';

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Reserva em memória: modo privado, cota cheia ou storage bloqueado por
// extensão não podem derrubar nada. Sem localStorage o visitante volta a ser
// "novo" a cada aba — perda de precisão aceitável, travar a navegação não seria.
const memory = new Map();

function readKey(key) {
    try {
        const stored = window.localStorage.getItem(key);
        if (stored !== null) return stored;
    } catch {
        // localStorage indisponível; segue pela memória.
    }
    return memory.get(key) ?? null;
}

function writeKey(key, value) {
    memory.set(key, value);
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // localStorage indisponível; a memória já guardou o valor desta aba.
    }
}

// `crypto.randomUUID` só existe em contexto seguro e a partir do Safari 15.4.
// Um id fraco é muito melhor do que uma exceção no meio da navegação.
export function randomId() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;

            const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
            return [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20),
            ].join('-');
        }
    } catch {
        // sem crypto disponível; cai no gerador abaixo.
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
}

// Devolve o id e diz se ele acabou de nascer — `resolveSession` precisa saber,
// porque visitante novo não pode herdar sessão.
function readOrCreateAnonymousId() {
    const stored = readKey(ANONYMOUS_ID_KEY);
    if (stored) return { anonymousId: stored, created: false };

    const anonymousId = randomId();
    writeKey(ANONYMOUS_ID_KEY, anonymousId);
    return { anonymousId, created: true };
}

export function getAnonymousId() {
    return readOrCreateAnonymousId().anonymousId;
}

// Devolve a sessão corrente, criando uma nova quando a anterior expirou.
// `isNew` diz a quem chamou que essa sessão ainda precisa ser anunciada ao
// banco com origem, dispositivo e UTMs.
export function resolveSession(now = Date.now()) {
    const { anonymousId, created } = readOrCreateAnonymousId();
    const storedId = readKey(SESSION_ID_KEY);
    const lastActivity = Number(readKey(LAST_ACTIVITY_KEY));

    // `created` derruba a sessão de propósito. Se o id do visitante sumiu mas o
    // da sessão ficou (alguém apagou uma chave só, uma escrita falhou por cota),
    // herdar a sessão mandaria um anonymous_id novo com um session_id que, no
    // banco, pertence a outro dono — e a guarda de `analytics_track` descartaria
    // os eventos em silêncio até a sessão expirar. Visitante novo, sessão nova.
    const alive =
        !created &&
        Boolean(storedId) &&
        Number.isFinite(lastActivity) &&
        lastActivity > 0 &&
        now - lastActivity < SESSION_TIMEOUT_MS;

    const sessionId = alive ? storedId : randomId();
    if (!alive) writeKey(SESSION_ID_KEY, sessionId);

    // Carimbo local a cada evento, sem rede: é ele que decide a expiração.
    // O `last_seen_at` do banco é outra coisa, e tem freio próprio na RPC.
    writeKey(LAST_ACTIVITY_KEY, String(now));

    return { sessionId, anonymousId, isNew: !alive };
}

// Só para os testes: as chaves sobreviveriam entre casos.
export function resetAnalyticsSessionForTests() {
    memory.clear();
    try {
        [ANONYMOUS_ID_KEY, SESSION_ID_KEY, LAST_ACTIVITY_KEY].forEach((key) =>
            window.localStorage.removeItem(key)
        );
    } catch {
        // storage indisponível; limpar a memória já bastou.
    }
}
