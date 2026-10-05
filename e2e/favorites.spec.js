import { test, expect, BUSINESS_ID, USER_ID } from './fixtures';

test.use({ initialStatus: 'active' });
const favoriteWrites = (api) =>
    api.calls.filter(
        (call) => call.path === '/rest/v1/business_favorites' && call.method !== 'GET',
    );
const saveName = 'Salvar Restaurante Fixture nos favoritos';
const removeName = 'Remover Restaurante Fixture dos favoritos';

test('card salva, perfil sincroniza, recarregar mantém e lista remove', async ({
    page,
    api,
}, testInfo) => {
    await page.goto('/explorar?categoria=gastronomia');
    const save = page.getByRole('button', { name: saveName });
    await expect(save).toBeEnabled();
    await save.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: removeName })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    expect(favoriteWrites(api)[0].body).toEqual({ user_id: USER_ID, business_id: BUSINESS_ID });
    await page.getByRole('link', { name: 'Ver mais', exact: true }).click();
    await expect(page.getByRole('button', { name: removeName })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await page.reload();
    await expect(page.getByRole('button', { name: removeName })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await page.goto('/favoritos');
    await expect(page.getByRole('heading', { name: 'Restaurante Fixture' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
    await page
        .locator('main')
        .screenshot({ path: testInfo.outputPath('favoritos-salvos.png'), scale: 'css' });
    await page.getByRole('button', { name: removeName }).click();
    await expect(
        page.getByRole('heading', { name: 'Você ainda não tem favoritos publicados' }),
    ).toBeVisible();
    expect(api.favorites).toHaveLength(0);
});

test('falha de gravação preserva coração e mostra erro recuperável', async ({ page, api }) => {
    await page.goto('/negocio/restaurante-fixture');
    await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
    api.favoritesError = true;
    await page.getByRole('button', { name: saveName }).click();
    await expect(page.getByRole('alert')).toContainText('Não foi possível salvar');
    await expect(page.getByRole('button', { name: saveName })).toHaveAttribute(
        'aria-pressed',
        'false',
    );
    api.favoritesError = null;
    await page.getByRole('button', { name: saveName }).click();
    await expect(page.getByRole('button', { name: removeName })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
});

test('carregamento e erro da lista permitem tentar novamente', async ({ page, api }) => {
    let release;
    api.favoritesGate = new Promise((resolve) => {
        release = resolve;
    });
    api.favoritesError = true;
    await page.goto('/favoritos');
    await expect(page.getByRole('status')).toHaveText('Carregando seus favoritos…');
    api.favoritesGate = null;
    release();
    await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
    api.favoritesError = null;
    api.favorites = [{ user_id: USER_ID, business_id: BUSINESS_ID }];
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Restaurante Fixture' })).toBeVisible();
});

test('negócios suspensos e favoritos de outra conta não aparecem', async ({ page, api }) => {
    api.favorites = [{ user_id: 'outra-conta', business_id: BUSINESS_ID }];
    await page.goto('/favoritos');
    await expect(
        page.getByRole('heading', { name: 'Você ainda não tem favoritos publicados' }),
    ).toBeVisible();
    api.favorites = [{ user_id: USER_ID, business_id: BUSINESS_ID }];
    api.business.status = 'suspended';
    await page.reload();
    await expect(
        page.getByRole('heading', { name: 'Você ainda não tem favoritos publicados' }),
    ).toBeVisible();
    api.business.status = 'active';
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Restaurante Fixture' })).toBeVisible();
});

test.describe('visitante', () => {
    test.use({ role: 'anon' });
    test('coração exige login e retorna aos filtros sem salvar silenciosamente', async ({
        page,
        api,
    }) => {
        await page.goto('/explorar?categoria=gastronomia');
        await page.getByRole('button', { name: saveName }).click();
        await expect(page).toHaveURL(/\/entrar$/);
        expect(favoriteWrites(api)).toHaveLength(0);
        await page.getByLabel('E-mail', { exact: true }).fill('proprietario@example.test');
        await page.getByLabel('Senha', { exact: true }).fill('senha-teste');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page).toHaveURL(/\/explorar\?categoria=gastronomia$/);
        await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
        await page.getByRole('button', { name: saveName }).click();
        await expect(page.getByRole('button', { name: removeName })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });
    test('página de favoritos oferece login e retorna à lista', async ({ page }) => {
        await page.goto('/favoritos');
        await page.getByRole('link', { name: 'Entrar na minha conta' }).click();
        await page.getByLabel('E-mail', { exact: true }).fill('proprietario@example.test');
        await page.getByLabel('Senha', { exact: true }).fill('senha-teste');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page).toHaveURL(/\/favoritos$/);
        await expect(
            page.getByRole('heading', { name: 'Você ainda não tem favoritos publicados' }),
        ).toBeVisible();
    });
});
