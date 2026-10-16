import { test, expect, BUSINESS_ID, USER_ID } from './fixtures';
import { couponToken, seedCoupon, seedOffer } from './offersMock';

const CUSTOMER = '99999999-9999-4999-8999-999999999999';
const calls = (api, name) => api.calls.filter((call) => call.path === `/rest/v1/rpc/${name}`);

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

function todayIsoDow() {
    const day = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCDay();
    return day === 0 ? 7 : day;
}

function activeOffer(api, overrides = {}) {
    return seedOffer(api.offers, {
        businessId: BUSINESS_ID,
        ownerId: USER_ID,
        status: 'active',
        versions: [{ review_status: 'approved', published: true, title: 'Sobremesa grátis', minimum_purchase: '80.00', fee_amount: '1.00', ...overrides }],
    });
}

async function verifyCode(page, code) {
    await page.getByLabel('Código do cupom ou conteúdo do QR').fill(code);
    await page.getByRole('button', { name: 'Verificar' }).click();
}

test.describe('validação no balcão', () => {
    test.use({ initialStatus: 'active' });

    test('código manual: verificar → confirmar → utilização registrada', async ({ page, api }) => {
        const offer = activeOffer(api);
        const coupon = seedCoupon(api.offers, { offer, userId: CUSTOMER });
        await page.goto('/meu-negocio');
        await page.getByRole('link', { name: 'Gerenciar cupons' }).click();
        await page.getByRole('link', { name: 'Validar cupom' }).click();
        await expect(page).toHaveURL(/\/validar$/);
        await expect(page.getByText('Validando para', { exact: false })).toContainText('Restaurante Fixture');

        await verifyCode(page, coupon.code.toLowerCase().replace('-', ' '));
        const result = page.getByRole('region', { name: 'Cupom válido' });
        await expect(result).toBeVisible();
        await expect(result.getByText(coupon.code)).toBeVisible();
        await expect(result.getByText('Brinde').first()).toBeVisible();
        await expect(result.getByText('R$ 80,00', { exact: false }).first()).toBeVisible();
        expect(calls(api, 'confirm_coupon_usage')).toHaveLength(0);
        await noOverflow(page);

        await page.getByRole('button', { name: 'Confirmar utilização' }).click();
        const dialog = page.getByRole('dialog', { name: 'Confirmar utilização' });
        await expect(dialog).toContainText('não poderá ser usado de novo');
        await dialog.getByRole('button', { name: 'Confirmar utilização' }).click();
        await expect(page.getByRole('heading', { name: 'Utilização confirmada' })).toBeVisible();
        expect(calls(api, 'confirm_coupon_usage')).toHaveLength(1);
        expect(calls(api, 'confirm_coupon_usage')[0].body).toMatchObject({ p_business_id: BUSINESS_ID });
        expect(api.offers.coupons[0].status).toBe('used');

        await page.getByRole('button', { name: 'Validar outro cupom' }).click();
        await verifyCode(page, coupon.code);
        await expect(page.getByRole('region', { name: 'Cupom não pode ser utilizado' })).toContainText('Este cupom já foi utilizado.');
        await expect(page.getByText(/Utilizado em \d{2}\/\d{2}\/\d{4} às/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Confirmar utilização' })).toHaveCount(0);
    });

    test('expirado e fora do horário são recusados sem botão de confirmar', async ({ page, api }) => {
        const offer = activeOffer(api);
        const expired = seedCoupon(api.offers, { offer, userId: CUSTOMER, expiresInMinutes: -5 });
        const otherDay = (todayIsoDow() % 7) + 1;
        const closed = activeOffer(api, { title: 'Só amanhã', days_of_week: [otherDay], time_windows: [] });
        const outside = seedCoupon(api.offers, { offer: closed, userId: CUSTOMER });

        await page.goto('/validar');
        await verifyCode(page, expired.code);
        await expect(page.getByText('Este cupom expirou e não pode ser utilizado.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Confirmar utilização' })).toHaveCount(0);

        await verifyCode(page, outside.code);
        await expect(page.getByText(/não vale neste dia ou horário/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Confirmar utilização' })).toHaveCount(0);
        expect(api.offers.coupons.find((c) => c.id === outside.id).status).toBe('available');
    });

    test('câmera indisponível cai na entrada manual; conteúdo do QR digitado por leitor funciona', async ({ page, api }) => {
        const offer = activeOffer(api);
        const coupon = seedCoupon(api.offers, { offer, userId: CUSTOMER });
        // O comportamento sem câmera varia com o sistema (macOS recusa na hora;
        // o Linux da CI pode nem responder). O teste fixa a recusa do navegador.
        await page.addInitScript(() => {
            const deny = () => Promise.reject(new DOMException('Permissão negada', 'NotAllowedError'));
            if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = deny;
            else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: deny } });
        });
        await page.goto('/validar');
        await page.getByRole('button', { name: 'Ler QR com a câmera' }).click();
        await expect(page.getByRole('alert')).toContainText('Permissão da câmera negada');
        await expect(page.getByRole('alert')).toContainText(/digite o código abaixo/i);

        const payload = `farol-cupom:1:${couponToken(coupon)}`;
        await page.getByLabel('Código do cupom ou conteúdo do QR').fill(payload);
        await expect(page.getByText('Conteúdo de QR Code reconhecido.')).toBeVisible();
        await page.getByRole('button', { name: 'Verificar' }).click();
        await expect(page.getByRole('region', { name: 'Cupom válido' })).toBeVisible();
        await page.getByRole('button', { name: 'Confirmar utilização' }).click();
        await page.getByRole('dialog', { name: 'Confirmar utilização' }).getByRole('button', { name: 'Confirmar utilização' }).click();
        await expect(page.getByRole('heading', { name: 'Utilização confirmada' })).toBeVisible();
        expect(calls(api, 'confirm_coupon_usage')[0].body.p_input).toBe(payload);
    });

    test('clique repetido na confirmação gera uma única chamada', async ({ page, api }) => {
        const offer = activeOffer(api);
        const coupon = seedCoupon(api.offers, { offer, userId: CUSTOMER });
        await page.goto('/validar');
        await verifyCode(page, coupon.code);
        await page.getByRole('button', { name: 'Confirmar utilização' }).click();
        let release;
        api.offers.gate = new Promise((resolve) => {
            release = resolve;
        });
        const confirm = page.getByRole('dialog', { name: 'Confirmar utilização' }).getByRole('button', { name: 'Confirmar utilização' });
        await confirm.click();
        await expect(confirm).toBeDisabled();
        await confirm.click({ force: true });
        api.offers.gate = null;
        release();
        await expect(page.getByRole('heading', { name: 'Utilização confirmada' })).toBeVisible();
        expect(calls(api, 'confirm_coupon_usage')).toHaveLength(1);
    });

    test('proprietário cadastra e desativa validador e vê as utilizações', async ({ page, api }) => {
        const offer = activeOffer(api);
        const coupon = seedCoupon(api.offers, { offer, userId: CUSTOMER });
        await page.goto('/meu-negocio/cupons');
        const validators = page.getByRole('region', { name: 'Validadores' });
        await validators.getByLabel('E-mail da conta').fill('naoexiste@example.test');
        await validators.getByRole('button', { name: 'Cadastrar validador' }).click();
        await expect(validators.getByText(/Nenhuma conta encontrada com esse e-mail/)).toBeVisible();
        await validators.getByLabel('E-mail da conta').fill('caixa@example.test');
        await validators.getByRole('button', { name: 'Cadastrar validador' }).click();
        await expect(validators.getByText('Validador cadastrado.', { exact: true })).toBeVisible();
        await expect(validators.getByRole('list', { name: 'Validadores ativos' })).toContainText('caixa@example.test');

        await validators.getByRole('button', { name: 'Desativar caixa@example.test' }).click();
        await page.getByRole('dialog', { name: 'Desativar validador' }).getByRole('button', { name: 'Desativar' }).click();
        await expect(validators.getByText('Nenhum validador cadastrado.')).toBeVisible();
        await expect(validators.getByText('Desativados (1)')).toBeVisible();

        await page.goto('/validar');
        await verifyCode(page, coupon.code);
        await page.getByRole('button', { name: 'Confirmar utilização' }).click();
        await page.getByRole('dialog', { name: 'Confirmar utilização' }).getByRole('button', { name: 'Confirmar utilização' }).click();
        await expect(page.getByRole('heading', { name: 'Utilização confirmada' })).toBeVisible();
        await page.goto('/meu-negocio/cupons');
        const usages = page.getByRole('region', { name: 'Cupons utilizados' });
        await expect(usages.getByText(coupon.code)).toBeVisible();
        await expect(usages.getByText('taxas lançadas', { exact: false })).toContainText('R$ 1,00');
        await noOverflow(page);
    });

    test('cliente vê "Utilizados" e a oferta respeita o limite por pessoa', async ({ page, api }) => {
        const offer = activeOffer(api, { per_user_limit: 1 });
        const used = seedCoupon(api.offers, { offer, userId: USER_ID, status: 'used' });
        await page.goto('/meus-cupons?situacao=used');
        const card = page.getByRole('listitem').filter({ hasText: 'Sobremesa grátis' });
        await expect(card.getByText('Utilizado', { exact: true })).toBeVisible();
        await expect(card.getByText(/Utilizado em/)).toBeVisible();
        await card.getByRole('link', { name: /Ver cupom/ }).click();
        await expect(page.getByText(/Cupom utilizado em .* em Restaurante Fixture/)).toBeVisible();
        await expect(page.getByRole('img', { name: /QR Code/ })).toHaveCount(0);
        expect(calls(api, 'get_coupon_qr_token')).toHaveLength(0);

        await page.goto(`/ofertas/${offer.id}`);
        await expect(page.getByText('Você já utilizou esta oferta o número máximo de vezes permitido.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Gerar meu cupom' })).toHaveCount(0);
        expect(used.status).toBe('used');
    });
});

test.describe('navegador sem acesso à câmera', () => {
    test.use({ initialStatus: 'active' });
    test('informa e mantém a entrada manual', async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
        });
        await page.goto('/validar');
        await page.getByRole('button', { name: 'Ler QR com a câmera' }).click();
        await expect(page.getByRole('alert')).toContainText('Este navegador não permite usar a câmera aqui');
        await expect(page.getByLabel('Código do cupom ou conteúdo do QR')).toBeEnabled();
    });
});

test.describe('conta sem negócio', () => {
    test.use({ initialStatus: null });
    test('não valida cupons', async ({ page }) => {
        await page.goto('/validar');
        await expect(page.getByRole('heading', { name: 'Sua conta não valida cupons' })).toBeVisible();
        await expect(page.getByLabel('Código do cupom ou conteúdo do QR')).toHaveCount(0);
    });
});
