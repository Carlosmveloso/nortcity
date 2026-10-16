// Utilização de cupom contra o Supabase de DESENVOLVIMENTO: cliente gera,
// validador confirma no balcão. Massa: offers_e2e_dev_setup.sql seguido de
// coupon_usage_e2e_dev_offers.sql. Limpeza: offers_e2e_dev_cleanup.sql.
import { test, expect } from '@playwright/test';

const CONSUMER = 'offers.e2e.consumer@example.test';
const VALIDATOR = 'offers.e2e.validator@example.test';
const PASSWORD = process.env.E2E_DEV_PASSWORD;
const DEV_ORIGIN = process.env.E2E_DEV_SUPABASE_ORIGIN;
const ANON_KEY = process.env.E2E_DEV_ANON_KEY;
const FORBIDDEN_ORIGIN = process.env.E2E_FORBIDDEN_SUPABASE_ORIGIN;

test.skip(!PASSWORD || !DEV_ORIGIN || !ANON_KEY, 'Defina E2E_DEV_PASSWORD e use playwright.dev.config.js.');

async function context(browser, testInfo, violations, errors) {
    const ctx = await browser.newContext({ ...testInfo.project.use, baseURL: 'http://127.0.0.1:4174' });
    await ctx.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin === 'http://127.0.0.1:4174' || url.origin === DEV_ORIGIN) return route.continue();
        if (FORBIDDEN_ORIGIN && url.origin === FORBIDDEN_ORIGIN) violations.push(url.href);
        return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    return { ctx, page };
}

async function login(page, email) {
    await page.goto('/entrar');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).not.toHaveURL(/\/entrar/);
}

async function restAsUser(page, path) {
    const token = await page.evaluate(() => {
        const key = Object.keys(localStorage).find((name) => name.startsWith('sb-') && name.endsWith('-auth-token'));
        return JSON.parse(localStorage.getItem(key)).access_token;
    });
    const response = await page.request.get(`${DEV_ORIGIN}/rest/v1/${path}`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
    return { status: response.status(), body: await response.json() };
}

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('cliente gera, validador confirma no balcão, segunda confirmação é recusada', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const title = `Uso E2E ${testInfo.project.name}`;
    const violations = [];
    const errors = [];
    const customer = await context(browser, testInfo, violations, errors);
    const validator = await context(browser, testInfo, violations, errors);

    // CLIENTE — gera o cupom.
    await login(customer.page, CONSUMER);
    await customer.page.goto('/negocio/restaurante-ofertas-e2e');
    await customer.page.getByRole('region', { name: 'Ofertas do Farol' }).getByRole('link', { name: new RegExp(title) }).click();
    const offerId = customer.page.url().split('/ofertas/')[1];
    await customer.page.getByLabel(/Li e concordo com o Regulamento de Utilização dos Cupons/).check();
    await customer.page.getByRole('button', { name: 'Gerar meu cupom' }).click();
    await expect(customer.page).toHaveURL(/\/meus-cupons\/[0-9a-f-]{36}$/);
    const couponId = customer.page.url().split('/meus-cupons/')[1];
    const code = await customer.page.locator('p.font-mono').innerText();

    // VALIDADOR — verifica pelo código digitado e confirma.
    await login(validator.page, VALIDATOR);
    await validator.page.goto('/validar');
    await expect(validator.page.getByText('Validando para', { exact: false })).toContainText('Restaurante Ofertas E2E');
    await validator.page.getByLabel('Código do cupom ou conteúdo do QR').fill(code.replace('-', ' ').toLowerCase());
    await validator.page.getByRole('button', { name: 'Verificar' }).click();
    const valid = validator.page.getByRole('region', { name: 'Cupom válido' });
    await expect(valid).toContainText('15% de desconto');
    await expect(valid).toContainText('R$ 50,00');
    await noOverflow(validator.page);
    await validator.page.getByRole('button', { name: 'Confirmar utilização' }).click();
    await validator.page.getByRole('dialog', { name: 'Confirmar utilização' }).getByRole('button', { name: 'Confirmar utilização' }).click();
    await expect(validator.page.getByRole('heading', { name: 'Utilização confirmada' })).toBeVisible();

    // Banco, pela visão do cliente: cupom utilizado; tabela de utilizações fechada.
    const row = await restAsUser(customer.page, `coupons?select=status,used_at&id=eq.${couponId}`);
    expect(row.body).toEqual([{ status: 'used', used_at: expect.any(String) }]);
    expect(await restAsUser(customer.page, 'coupon_usages?select=id')).toEqual({ status: 200, body: [] });

    // CLIENTE — vê "Utilizado" e o limite por pessoa na oferta.
    await customer.page.goto('/meus-cupons?situacao=used');
    await expect(customer.page.getByRole('listitem').filter({ hasText: title }).getByText('Utilizado', { exact: true })).toBeVisible();
    await customer.page.goto(`/ofertas/${offerId}`);
    await expect(customer.page.getByText('Você já utilizou esta oferta o número máximo de vezes permitido.')).toBeVisible();
    await noOverflow(customer.page);

    // VALIDADOR — nova tentativa é recusada.
    await validator.page.getByRole('button', { name: 'Validar outro cupom' }).click();
    await validator.page.getByLabel('Código do cupom ou conteúdo do QR').fill(code);
    await validator.page.getByRole('button', { name: 'Verificar' }).click();
    await expect(validator.page.getByRole('region', { name: 'Cupom não pode ser utilizado' })).toContainText('Este cupom já foi utilizado.');
    await expect(validator.page.getByRole('button', { name: 'Confirmar utilização' })).toHaveCount(0);

    await customer.ctx.close();
    await validator.ctx.close();
    expect(violations, 'Nenhuma requisição ao projeto de produção').toEqual([]);
    expect(errors, 'Nenhuma exceção de JavaScript').toEqual([]);
});
