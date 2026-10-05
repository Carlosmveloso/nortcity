import { test, expect, BUSINESS_ID, CATEGORY_ID } from './fixtures';

const writes = (api, name) => api.calls.filter((call) => call.path === `/rest/v1/rpc/${name}`);

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('visitante', () => {
    test.use({ role: 'anon', initialStatus: null });
    test('rotas privadas exigem login', async ({ page }) => {
        for (const path of ['/meu-negocio', '/cadastrar-negocio', '/admin']) {
            await page.goto(path);
            await expect(page).toHaveURL(/\/entrar$/);
            await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
        }
    });
    test('login mostra erro e depois volta à área solicitada', async ({ page }) => {
        await page.goto('/meu-negocio');
        await page.getByLabel('E-mail', { exact: true }).fill('proprietario@example.test');
        await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
        await page.getByLabel('Senha', { exact: true }).fill('senha-teste');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page).toHaveURL(/\/meu-negocio$/);
        await expect(page.getByRole('heading', { name: 'Meu Negócio', exact: true })).toBeVisible();
    });
    test('planos e favoritos comunicam apenas o disponível', async ({ page }, testInfo) => {
        await page.goto('/planos');
        await expect(page.getByRole('heading', { name: 'Planos pagos em planejamento' })).toBeVisible();
        await expect(page.getByRole('link', { name: /assinar/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Começar grátis' })).toHaveAttribute('href', '/cadastrar-negocio');
        await noOverflow(page);
        // Percorre as seções para validar também o conteúdo revelado ao rolar.
        for (const section of await page.locator('main .duration-700').all()) {
            // Centralizar ultrapassa a margem de 80px do IntersectionObserver.
            await section.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await expect(section).toHaveCSS('opacity', '1');
        }
        await page.locator('main > section').nth(1).screenshot({ path: testInfo.outputPath('planos.png'), scale: 'css' });
        await page.goto('/favoritos');
        await expect(page.getByRole('heading', { name: 'Entre para ver seus favoritos' })).toBeVisible();
        await expect(page.getByText(/Toque no coração/)).toHaveCount(0);
        await noOverflow(page);
        await page.locator('main').screenshot({ path: testInfo.outputPath('favoritos.png'), scale: 'css' });
    });
});

test.describe('novo proprietário', () => {
    test.use({ initialStatus: null });
    test('cadastro valida etapas e envia categorias e contato por RPC', async ({ page, api }) => {
        await page.goto('/cadastrar-negocio');
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await expect(page.getByLabel('Nome do negócio')).toBeVisible();
        expect(writes(api, 'submit_business')).toHaveLength(0);
        await page.getByLabel('Nome do negócio').fill('Restaurante Novo');
        await page.getByRole('button', { name: 'Gastronomia', exact: true }).click();
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await page.getByLabel('Rua / Avenida').fill('Rua da Praia');
        await page.getByLabel('Número', { exact: true }).fill('10');
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
        await page.getByLabel('Telefone', { exact: true }).fill('83999998888');
        await page.getByRole('button', { name: 'Enviar cadastro' }).click();
        await expect(page.getByRole('heading', { name: 'Recebemos seu cadastro!' })).toBeVisible();
        expect(writes(api, 'submit_business')).toHaveLength(1);
        expect(writes(api, 'submit_business')[0].body).toMatchObject({
            p_payload: { name: 'Restaurante Novo', phone: '83999998888' },
            p_category_ids: [CATEGORY_ID], p_primary_category_id: CATEGORY_ID,
        });
        await page.getByRole('link', { name: 'Ir para Meu Negócio' }).click();
        await expect(page.getByText('Em análise', { exact: true })).toBeVisible();
        await noOverflow(page);
    });
});

test('proprietário corrige pendente e não abre segundo cadastro', async ({ page, api }) => {
    await page.goto('/cadastrar-negocio');
    await expect(page).toHaveURL(/\/meu-negocio$/);
    await page.getByLabel('Nome do negócio').fill('Restaurante Corrigido');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Cadastro atualizado.')).toBeVisible();
    expect(writes(api, 'update_own_business')[0].body).toMatchObject({ p_business_id: BUSINESS_ID, p_payload: { name: 'Restaurante Corrigido' } });
    await page.reload();
    await expect(page.getByLabel('Nome do negócio')).toHaveValue('Restaurante Corrigido');
    await noOverflow(page);
});

test('proprietário não acessa painel admin', async ({ page, api }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Adicionar negócio' })).toHaveCount(0);
    expect(writes(api, 'moderate_business')).toHaveLength(0);
});

test.describe('publicado', () => {
    test.use({ initialStatus: 'active' });
    test('telefone atualiza e alteração de nome aguarda moderação', async ({ page, api }) => {
        await page.goto('/meu-negocio');
        await page.getByLabel('Telefone', { exact: true }).fill('83988887777');
        await page.getByRole('button', { name: 'Salvar', exact: true }).click();
        await expect(page.getByText('Telefone atualizado no perfil público.')).toBeVisible();
        expect(writes(api, 'update_own_active_business')[0].body.p_changes).toEqual({ phone: '83988887777' });
        await page.getByLabel('Nome do negócio').fill('Nome Proposto');
        await page.getByRole('button', { name: 'Enviar para análise' }).click();
        await expect(page.getByRole('button', { name: /Cancelar/ })).toBeVisible();
        expect(writes(api, 'request_business_changes')[0].body.p_changes).toEqual({ name: 'Nome Proposto' });
        expect(api.business.name).toBe('Restaurante Fixture');
        expect(api.business.status).toBe('active');
    });
});

test.describe('administrador', () => {
    test.use({ role: 'admin' });
    test('aprova negócio e atualiza a listagem', async ({ page, api }) => {
        await page.goto('/admin');
        await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
        await expect(page.getByText('Nenhum negócio nesse filtro.')).toBeVisible();
        expect(writes(api, 'moderate_business')[0].body).toMatchObject({ p_business_id: BUSINESS_ID, p_action: 'approve' });
        await page.getByRole('button', { name: 'Publicado', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Restaurante Fixture' })).toBeVisible();
        await noOverflow(page);
    });
    test('rejeição exige motivo antes de enviar a RPC', async ({ page, api }) => {
        await page.goto('/admin');
        await page.getByRole('button', { name: 'Rejeitar', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
        await expect(page.getByText('Escolha o motivo da decisão.')).toBeVisible();
        expect(writes(api, 'moderate_business')).toHaveLength(0);
        await page.getByRole('combobox').selectOption('insufficient_information');
        await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
        await expect(page.getByText('Nenhum negócio nesse filtro.')).toBeVisible();
        expect(writes(api, 'moderate_business')[0].body).toMatchObject({ p_action: 'reject', p_reason: 'insufficient_information' });
    });
    test('erro na aprovação mantém o negócio na fila', async ({ page, api }) => {
        api.failRpc = 'moderate_business';
        await page.goto('/admin');
        await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
        await expect(page.getByText('Falha simulada para teste.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Restaurante Fixture' })).toBeVisible();
        expect(api.business.status).toBe('pending');
    });
});
