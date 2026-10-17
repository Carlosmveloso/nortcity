import { test, expect, BUSINESS_ID, USER_ID } from './fixtures';
import { seedCoupon, seedOffer } from './offersMock';

const OTHER_USER = '99999999-9999-4999-8999-999999999999';
const calls = (api, name) => api.calls.filter((call) => call.path === `/rest/v1/rpc/${name}`);

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

function activeOffer(api, overrides = {}) {
    return seedOffer(api.offers, {
        businessId: BUSINESS_ID,
        ownerId: USER_ID,
        status: 'active',
        versions: [{ review_status: 'approved', published: true, title: 'Sobremesa grátis', total_limit: 10, coupon_validity_minutes: 120, minimum_purchase: '80.00', ...overrides }],
    });
}

test.describe('visitante gera cupom', () => {
    test.use({ role: 'anon', initialStatus: 'active' });

    test('perfil → oferta → login → aceite → cupom → Meus cupons', async ({ page, api }) => {
        const offer = activeOffer(api);
        await page.goto('/negocio/restaurante-fixture');
        const section = page.getByRole('region', { name: 'Ofertas do Farol' });
        await expect(section.getByText('Cupons disponíveis')).toBeVisible();
        await section.getByRole('link', { name: /Sobremesa grátis/ }).click();
        await expect(page).toHaveURL(new RegExp(`/ofertas/${offer.id}$`));
        await expect(page.getByRole('heading', { name: 'Sobremesa grátis', level: 1 })).toBeVisible();
        await expect(page.getByText('R$ 80,00', { exact: false }).first()).toBeVisible();
        await expect(page.getByText('2 horas após a geração')).toBeVisible();

        await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
        await expect(page).toHaveURL(/\/entrar$/);
        await expect(page.getByText('Entre para gerar este cupom.')).toBeVisible();
        await page.getByLabel('E-mail', { exact: true }).fill('proprietario@example.test');
        await page.getByLabel('Senha', { exact: true }).fill('senha-teste');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/ofertas/${offer.id}$`));

        await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
        await expect(page.getByText(/Marque a concordância/)).toBeVisible();
        expect(calls(api, 'generate_coupon')).toHaveLength(0);
        await page.getByLabel(/Li e concordo com o Regulamento de Utilização dos Cupons/).check();
        await page.getByRole('button', { name: 'Gerar meu cupom' }).click();

        await expect(page).toHaveURL(/\/meus-cupons\/[^/]+$/);
        expect(calls(api, 'generate_coupon')[0].body).toEqual({ p_offer_id: offer.id, p_terms_version: '2026-10-v1' });
        const coupon = api.offers.coupons[0];
        const couponBox = page.getByRole('region', { name: `Cupom ${coupon.code}` });
        await expect(couponBox.getByText(coupon.code, { exact: true })).toBeVisible();
        await expect(page.getByRole('img', { name: `QR Code do cupom ${coupon.code}, para apresentar em Restaurante Fixture` })).toBeVisible();
        await expect(page.getByText(/^Válido até \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/)).toBeVisible();
        await expect(page.getByText('Apresente este cupom no estabelecimento antes de concluir a compra.')).toBeVisible();
        await expect(page.getByText('Disponível', { exact: true })).toBeVisible();
        const qrBox = await page.getByRole('img', { name: /QR Code do cupom/ }).boundingBox();
        expect(qrBox.width).toBeLessThanOrEqual(page.viewportSize().width - 32);
        await noOverflow(page);

        await page.getByRole('link', { name: 'Meus cupons', exact: true }).first().click();
        const card = page.getByRole('listitem').filter({ hasText: 'Sobremesa grátis' });
        await expect(card.getByText('Disponível')).toBeVisible();
        await expect(card.getByText(/Válido até/)).toBeVisible();
        await noOverflow(page);
    });
});

test.describe('cupons — usuário autenticado', () => {
    test.use({ initialStatus: 'active' });

    test('temporariamente esgotado não oferece geração', async ({ page, api }) => {
        const offer = activeOffer(api, { total_limit: 1 });
        seedCoupon(api.offers, { offer, userId: OTHER_USER });
        await page.goto(`/ofertas/${offer.id}`);
        await expect(page.getByText('Cupons temporariamente esgotados')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Gerar meu cupom' })).toHaveCount(0);
        await page.goto('/negocio/restaurante-fixture');
        await expect(page.getByText('Cupons temporariamente esgotados')).toBeVisible();
    });

    test('esgotou entre a consulta e o clique: mensagem traduzida', async ({ page, api }) => {
        const offer = activeOffer(api);
        api.offers.fail.generate_coupon = 'offer_sold_out';
        await page.goto(`/ofertas/${offer.id}`);
        await page.getByLabel(/Li e concordo/).check();
        await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
        await expect(page.getByRole('alert')).toContainText('temporariamente esgotados');
        await expect(page.getByText('offer_sold_out')).toHaveCount(0);
    });

    test('quem já tem cupom disponível é levado a ele', async ({ page, api }) => {
        const offer = activeOffer(api);
        const coupon = seedCoupon(api.offers, { offer, userId: USER_ID });
        await page.goto(`/ofertas/${offer.id}`);
        await expect(page.getByText('Você já tem um cupom disponível desta oferta.')).toBeVisible();
        await page.getByRole('link', { name: 'Ver meu cupom' }).click();
        await expect(page).toHaveURL(new RegExp(`/meus-cupons/${coupon.id}$`));
    });

    test('cupom expirado fica sem QR e em Expirados; nova geração liberada', async ({ page, api }) => {
        const offer = activeOffer(api);
        const coupon = seedCoupon(api.offers, { offer, userId: USER_ID, expiresInMinutes: -5 });
        await page.goto(`/meus-cupons/${coupon.id}`);
        await expect(page.getByText('Expirado', { exact: true })).toBeVisible();
        await expect(page.getByText(/expirou em .* e não pode mais ser utilizado/)).toBeVisible();
        await expect(page.getByRole('img', { name: /QR Code/ })).toHaveCount(0);
        expect(calls(api, 'get_coupon_qr_token')).toHaveLength(0);

        await page.goto('/meus-cupons');
        await expect(page.getByText('Nenhum cupom nesta situação.')).toBeVisible();
        await page.getByRole('button', { name: /Expirados/ }).click();
        await expect(page.getByRole('listitem').filter({ hasText: 'Sobremesa grátis' }).getByText('Expirado')).toBeVisible();

        await page.goto(`/ofertas/${offer.id}`);
        await page.getByLabel(/Li e concordo/).check();
        await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
        await expect(page).toHaveURL(/\/meus-cupons\/[^/]+$/);
        expect(api.offers.coupons).toHaveLength(2);
    });

    test('condições exibidas vêm da versão aceita, não da publicada hoje', async ({ page, api }) => {
        const offer = seedOffer(api.offers, {
            businessId: BUSINESS_ID,
            ownerId: USER_ID,
            status: 'active',
            versions: [
                { review_status: 'approved', title: 'Versão antiga', minimum_purchase: '50.00' },
                { review_status: 'approved', published: true, title: 'Versão nova', minimum_purchase: '120.00' },
            ],
        });
        const coupon = seedCoupon(api.offers, { offer, userId: USER_ID, versionNumber: 1 });
        await page.goto(`/meus-cupons/${coupon.id}`);
        await expect(page.getByText('Versão antiga', { exact: false }).first()).toBeVisible();
        await expect(page.getByText('R$ 50,00', { exact: false })).toBeVisible();
        await expect(page.getByText(/Versão 1 da oferta/)).toBeVisible();
        await expect(page.getByText('R$ 120,00')).toHaveCount(0);
    });

    test('clique repetido gera um único cupom', async ({ page, api }) => {
        const offer = activeOffer(api);
        await page.goto(`/ofertas/${offer.id}`);
        await page.getByLabel(/Li e concordo/).check();
        let release;
        api.offers.gate = new Promise((resolve) => {
            release = resolve;
        });
        await page.getByRole('button', { name: 'Gerar meu cupom' }).click();
        await expect(page.getByRole('button', { name: 'Gerando...' })).toBeDisabled();
        await page.getByRole('button', { name: 'Gerando...' }).click({ force: true });
        api.offers.gate = null;
        release();
        await expect(page).toHaveURL(/\/meus-cupons\/[^/]+$/);
        expect(calls(api, 'generate_coupon')).toHaveLength(1);
    });

    test('regulamento versionado é exibido', async ({ page }) => {
        await page.goto('/regulamento-cupons?versao=2026-10-v1');
        await expect(page.getByRole('heading', { name: 'Regulamento de Utilização dos Cupons', level: 1 })).toBeVisible();
        await expect(page.getByText('Versão 2026-10-v1', { exact: false })).toBeVisible();
        await expect(page.getByRole('heading', { name: '1. Condições da oferta' })).toBeVisible();
        await noOverflow(page);
    });
});
