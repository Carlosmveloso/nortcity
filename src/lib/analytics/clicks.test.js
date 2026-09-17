import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clickMetadata } from './clicks';

function setGeometry({ scrollY = 0, innerWidth = 1000, innerHeight = 1000, scrollHeight = 1000 } = {}) {
    Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: innerWidth, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: scrollHeight,
        configurable: true,
        writable: true,
    });
}

// Evento de clique montado à mão: `detail` é a contagem de cliques do ponteiro
// e vale 0 quando o clique veio do teclado.
function clickOn(target, { clientX = 0, clientY = 0, detail = 1 } = {}) {
    return { target, clientX, clientY, detail };
}

beforeEach(() => {
    setGeometry();
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('o que conta como clique', () => {
    it('ignora clique fora de qualquer elemento marcado', () => {
        document.body.innerHTML = '<div><button>Sem marcação</button></div>';
        const botao = document.querySelector('button');

        expect(clickMetadata(clickOn(botao))).toBeNull();
    });

    it('registra o clique direto no elemento marcado', () => {
        document.body.innerHTML = '<button data-analytics="hero-search">Buscar</button>';
        const botao = document.querySelector('button');

        expect(clickMetadata(clickOn(botao)).element).toBe('hero-search');
    });

    // O caso comum de verdade: o alvo do clique é o ícone, não o botão.
    it('sobe até o elemento marcado quando o clique cai num filho (closest)', () => {
        document.body.innerHTML =
            '<button data-analytics="hero-search"><svg><path /></svg><span>Buscar</span></button>';

        expect(clickMetadata(clickOn(document.querySelector('path'))).element).toBe('hero-search');
        expect(clickMetadata(clickOn(document.querySelector('span'))).element).toBe('hero-search');
    });

    it('usa o marcado mais próximo quando há marcação aninhada, gerando um evento só', () => {
        document.body.innerHTML =
            '<article data-analytics="business-card"><a data-analytics="business-card-whatsapp"><svg /></a></article>';

        expect(clickMetadata(clickOn(document.querySelector('svg'))).element).toBe(
            'business-card-whatsapp'
        );
    });

    it('descarta atributo vazio ou longo demais para a coluna', () => {
        document.body.innerHTML = `
            <button id="vazio" data-analytics="   "></button>
            <button id="longo" data-analytics="${'x'.repeat(81)}"></button>`;

        expect(clickMetadata(clickOn(document.getElementById('vazio')))).toBeNull();
        expect(clickMetadata(clickOn(document.getElementById('longo')))).toBeNull();
    });

    it('não quebra com alvo sem closest (document, nó solto)', () => {
        expect(clickMetadata(clickOn(document))).toBeNull();
        expect(clickMetadata({ target: null })).toBeNull();
        expect(clickMetadata(undefined)).toBeNull();
    });
});

describe('coordenadas normalizadas', () => {
    it('mede o horizontal na largura da viewport', () => {
        document.body.innerHTML = '<button data-analytics="hero-search"></button>';
        const botao = document.querySelector('button');

        setGeometry({ innerWidth: 1000 });
        expect(clickMetadata(clickOn(botao, { clientX: 500 })).x_percent).toBe(0.5);
        expect(clickMetadata(clickOn(botao, { clientX: 0 })).x_percent).toBe(0);
        expect(clickMetadata(clickOn(botao, { clientX: 1000 })).x_percent).toBe(1);
    });

    // O vertical é medido no documento inteiro: é isso que permite sobrepor,
    // num mapa só, cliques feitos em telas de alturas diferentes.
    it('mede o vertical no documento, somando a rolagem', () => {
        document.body.innerHTML = '<button data-analytics="business-card"></button>';
        const botao = document.querySelector('button');

        // viewport 1000, rolagem 1000, clique a 500 da borda = 1500 absolutos
        // num documento de 3000 → metade da página.
        setGeometry({ scrollY: 1000, innerHeight: 1000, scrollHeight: 3000 });
        expect(clickMetadata(clickOn(botao, { clientY: 500 })).y_percent).toBe(0.5);

        setGeometry({ scrollY: 0, innerHeight: 1000, scrollHeight: 3000 });
        expect(clickMetadata(clickOn(botao, { clientY: 0 })).y_percent).toBe(0);
    });

    it('mantém os dois eixos dentro de 0 e 1 mesmo com valor absurdo', () => {
        document.body.innerHTML = '<button data-analytics="x"></button>';
        const botao = document.querySelector('button');

        setGeometry({ innerWidth: 1000, innerHeight: 1000, scrollHeight: 1000 });
        const fora = clickMetadata(clickOn(botao, { clientX: -50, clientY: 99999 }));

        expect(fora.x_percent).toBe(0);
        expect(fora.y_percent).toBe(1);
    });

    it('arredonda para quatro casas, que já é sub-pixel', () => {
        document.body.innerHTML = '<button data-analytics="x"></button>';
        const botao = document.querySelector('button');

        setGeometry({ innerWidth: 1440, innerHeight: 1000, scrollHeight: 1000 });
        expect(clickMetadata(clickOn(botao, { clientX: 767 })).x_percent).toBe(0.5326);
    });

    it('não divide por zero quando a página ainda não tem layout', () => {
        document.body.innerHTML = '<button data-analytics="x"></button>';
        const botao = document.querySelector('button');

        setGeometry({ innerWidth: 0, innerHeight: 0, scrollHeight: 0 });
        const metadata = clickMetadata(clickOn(botao, { clientX: 10, clientY: 10 }));

        expect(Number.isFinite(metadata.x_percent)).toBe(true);
        expect(Number.isFinite(metadata.y_percent)).toBe(true);
    });

    // Enter num botão dispara click com detail 0 e clientX/clientY zerados.
    // Registrar isso como (0,0) criaria um ponto quente falso no canto do mapa.
    it('registra clique de teclado sem posição, em vez de fingir o canto superior esquerdo', () => {
        document.body.innerHTML = '<button data-analytics="login-submit"></button>';
        const botao = document.querySelector('button');

        const metadata = clickMetadata(clickOn(botao, { clientX: 0, clientY: 0, detail: 0 }));

        expect(metadata).toEqual({ element: 'login-submit' });
    });
});

describe('privacidade', () => {
    // A garantia é estrutural: o metadata é montado por lista branca, então
    // ampliar a coleta exige editar clicks.js — não acontece por acidente ao
    // mexer numa tela.
    it('não leva nada além do atributo e das coordenadas, mesmo em campo sensível', () => {
        document.body.innerHTML = `
            <form>
                <input id="senha" type="password" name="password" value="segredo-do-usuario"
                       data-analytics="login-secret-field" />
                <button data-analytics="login-submit" title="Entrar como carlos@exemplo.com">
                    Entrar como carlos@exemplo.com
                </button>
            </form>`;

        const senha = clickMetadata(clickOn(document.getElementById('senha'), { clientX: 10, clientY: 10 }));
        const submit = clickMetadata(clickOn(document.querySelector('button'), { clientX: 10, clientY: 10 }));

        expect(Object.keys(senha).sort()).toEqual(['element', 'x_percent', 'y_percent']);
        expect(Object.keys(submit).sort()).toEqual(['element', 'x_percent', 'y_percent']);

        const serializado = JSON.stringify([senha, submit]);
        expect(serializado).not.toContain('segredo-do-usuario');
        expect(serializado).not.toContain('carlos@exemplo.com');
        expect(serializado).not.toContain('password');
        expect(serializado).not.toContain('Entrar');
    });
});
