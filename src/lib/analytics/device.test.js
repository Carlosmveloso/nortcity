import { afterEach, describe, expect, it } from 'vitest';
import { getBrowser, getDeviceType, getOs } from './device';

function setWidth(width) {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
}

function setUserAgent(userAgent) {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
}

afterEach(() => {
    setWidth(1024);
});

describe('getDeviceType', () => {
    // Os cortes são os mesmos do Tailwind (md = 768, lg = 1024) que o site usa
    // para decidir layout: se divergirem, "mobile" passa a querer dizer uma
    // coisa no relatório e outra na tela.
    it('classifica pelas bordas de md e lg', () => {
        setWidth(390);
        expect(getDeviceType()).toBe('mobile');

        setWidth(767);
        expect(getDeviceType()).toBe('mobile');

        setWidth(768);
        expect(getDeviceType()).toBe('tablet');

        setWidth(1023);
        expect(getDeviceType()).toBe('tablet');

        setWidth(1024);
        expect(getDeviceType()).toBe('desktop');
    });
});

describe('getBrowser', () => {
    // Edge, Opera e Samsung também escrevem "Chrome" no user agent; quem testa
    // Chrome primeiro classifica os três errado.
    it('não confunde com Chrome quem só diz Chrome por herança', () => {
        setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0');
        expect(getBrowser()).toBe('Edge');

        setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36');
        expect(getBrowser()).toBe('Samsung Internet');
    });

    it('reconhece Chrome no iPhone, que se anuncia como CriOS', () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1');
        expect(getBrowser()).toBe('Chrome');
    });

    it('reconhece Safari e Chrome comuns', () => {
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15');
        expect(getBrowser()).toBe('Safari');

        setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36');
        expect(getBrowser()).toBe('Chrome');
    });

    it('devolve null no que não reconhece, porque a coluna aceita null', () => {
        setUserAgent('curl/8.4.0');
        expect(getBrowser()).toBeNull();
        expect(getOs()).toBeNull();
    });
});

describe('getOs', () => {
    it('separa iOS de macOS mesmo com "Mac OS X" no user agent do iPhone', () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');
        expect(getOs()).toBe('iOS');

        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
        expect(getOs()).toBe('macOS');
    });

    it('reconhece Android e Windows', () => {
        setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-A martphone) AppleWebKit/537.36');
        expect(getOs()).toBe('Android');

        setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        expect(getOs()).toBe('Windows');
    });
});
