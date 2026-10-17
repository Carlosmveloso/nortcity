// Geração de cupom contra o Supabase de DESENVOLVIMENTO: Auth, RLS, RPCs,
// Vault e expiração reais. Massa: offers_e2e_dev_setup.sql seguido de
// coupons_e2e_dev_offers.sql (ofertas com 1 vaga e cupom de 1 minuto).
import { test, expect } from '@playwright/test';

const CONSUMER = 'offers.e2e.consumer@example.test';
const PASSWORD = process.env.E2E_DEV_PASSWORD;
const DEV_ORIGIN = process.env.E2E_DEV_SUPABASE_ORIGIN;
const ANON_KEY = process.env.E2E_DEV_ANON_KEY;
const FORBIDDEN_ORIGIN = process.env.E2E_FORBIDDEN_SUPABASE_ORIGIN;

test.skip(!PASSWORD || !DEV_ORIGIN || !ANON_KEY, 'Defina E2E_DEV_PASSWORD e use playwright.dev.config.js.');

async function guard(context, violations) {
    await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin === 'http://127.0.0.1:4174' || url.origin === DEV_ORIGIN) return route.continue();
        if (FORBIDDEN_ORIGIN && url.origin === FORBIDDEN_ORIGIN) violations.push(url.href);
        return route.abort();
    });
}

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

/** REST com o JWT da sessão do navegador: o que a RLS deixa o usuário ver. */
async function restAsUser(page, path) {
    const token = await page.evaluate(() => {
        const key = Object.keys(localStorage).find((name) => name.startsWith('sb-') && name.endsWith('-auth-token'));
        return JSON.parse(localStorage.getItem(key)).access_token;
    });
    const response = await page.request.get(`${DEV_ORIGIN}/rest/v1/${path}`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    return { status: response.status(), body: await response.json() };
}

test('consumidor gera cupom, vê QR e validade, cupom expira e a vaga volta', async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const title = `Cupom E2E ${testInfo.project.name}`;
    const violations = [];
    const errors = [];
    const context = await browser.newContext({ ...testInfo.project.use, baseURL: 'http://127.0.0.1:4174' });
    await guard(context, violations);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));

    // Visitante encontra a oferta no perfil do negócio.
    await page.goto('/negocio/restaurante-ofertas-e2e');
    const section = page.getByRole('region', { name: 'Ofertas do Farol' });
    await section.getByRole('link', { name: new RegExp(title) }).click();
    const offerId = page.url().split('/ofertas/')[1];
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

    // Login obrigatório e retorno à oferta.
    await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
    await expect(page.getByText('Entre para gerar este cupom.')).toBeVisible();
    await page.getByLabel('E-mail', { exact: true }).fill(CONSUMER);
    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/ofertas/${offerId}$`));

    // Aceite e geração.
    await page.getByLabel(/Li e concordo com o Regulamento de Utilização dos Cupons/).check();
    await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
    await expect(page).toHaveURL(/\/meus-cupons\/[0-9a-f-]{36}$/);
    const couponId = page.url().split('/meus-cupons/')[1];
    const codeText = await page.locator('p.font-mono').innerText();
    expect(codeText).toMatch(/^FP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    await expect(page.getByRole('img', { name: new RegExp(`QR Code do cupom ${codeText}`) })).toBeVisible();
    await expect(page.getByText(/^Válido até \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/)).toBeVisible();
    await noOverflow(page);

    // Banco: vínculo com a versão publicada e RLS do próprio cupom.
    const coupon = await restAsUser(page, `coupons?select=id,code,status,offer_version_id,terms_version&id=eq.${couponId}`);
    const offer = await restAsUser(page, `offers?select=published_version_id&id=eq.${offerId}`);
    expect(coupon.body).toEqual([
        { id: couponId, code: codeText, status: 'available', offer_version_id: offer.body[0].published_version_id, terms_version: '2026-10-v1' },
    ]);
    // Coluna sem grant para o usuário: PostgREST responde 403 (42501).
    const hash = await restAsUser(page, 'coupons?select=qr_token_hash');
    expect(hash.status).toBe(403);
    expect(hash.body.code).toBe('42501');

    // Meus cupons mostra o registro.
    await page.goto('/meus-cupons');
    await expect(page.getByRole('listitem').filter({ hasText: title }).getByText('Disponível')).toBeVisible();

    // Vaga única ocupada: a oferta aparece esgotada.
    await page.goto(`/ofertas/${offerId}`);
    await expect(page.getByText('Você já tem um cupom disponível desta oferta.')).toBeVisible();

    // Expiração controlada: cupom de 1 minuto.
    await page.waitForTimeout(65_000);
    await page.goto(`/meus-cupons/${couponId}`);
    await expect(page.getByText('Expirado', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /QR Code/ })).toHaveCount(0);

    // Vaga liberada: a mesma pessoa gera outro cupom.
    await page.goto(`/ofertas/${offerId}`);
    await page.getByLabel(/Li e concordo/).check();
    await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
    await expect(page).toHaveURL(/\/meus-cupons\/[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain(couponId);
    const first = await restAsUser(page, `coupons?select=status&id=eq.${couponId}`);
    expect(first.body).toEqual([{ status: 'expired' }]);

    await context.close();
    expect(violations, 'Nenhuma requisição ao projeto de produção').toEqual([]);
    expect(errors, 'Nenhuma exceção de JavaScript').toEqual([]);
});
