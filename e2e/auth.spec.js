import { test, expect, session } from './fixtures';

test.use({ role: 'anon', initialStatus: null });

test('cadastro com confirmação pendente não libera a área privada', async ({ page, api }) => {
    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Cadastre-se' }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Pessoa de Teste');
    await page.getByLabel('E-mail', { exact: true }).fill('proprietario@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('senha-teste');
    const signup = page.waitForRequest((request) => request.url().includes('/auth/v1/signup'));
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    const request = await signup;
    expect(new URL(request.url()).searchParams.get('redirect_to')).toBe(
        'http://127.0.0.1:4173/entrar?confirmacao=1',
    );
    await expect(page.getByText('Confirme seu e-mail.', { exact: true })).toBeVisible();
    // Também vale para cadastro duplicado que o Supabase mascara com identities: [].
    await expect(page.getByText('Conta criada!', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reenviar confirmação' }).click();
    await expect(
        page.getByText('Aguarde um minuto após o último pedido antes de reenviar.'),
    ).toBeVisible();
    expect(api.calls.filter((call) => call.path === '/auth/v1/resend')).toHaveLength(0);
    await page.goto('/meu-negocio');
    await expect(page).toHaveURL(/\/entrar$/);
});

test('login não confirmado explica o bloqueio e permite reenviar sem cadastrar de novo', async ({
    page,
    api,
}) => {
    api.authError = { error_code: 'email_not_confirmed', message: 'Email not confirmed' };
    await page.goto('/entrar');
    await page.getByLabel('E-mail', { exact: true }).fill('proprietario@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('senha-teste');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Seu e-mail ainda não foi confirmado');
    const resend = page.waitForRequest((request) => request.url().includes('/auth/v1/resend'));
    await page.getByRole('button', { name: 'Reenviar confirmação' }).click();
    const request = await resend;
    expect(request.postDataJSON()).toMatchObject({
        type: 'signup',
        email: 'proprietario@example.test',
    });
    expect(new URL(request.url()).searchParams.get('redirect_to')).toBe(
        'http://127.0.0.1:4173/entrar?confirmacao=1',
    );
    await expect(page.getByText(/Se houver uma conta aguardando confirmação/)).toBeVisible();
    expect(api.calls.filter((call) => call.path === '/auth/v1/signup')).toHaveLength(0);
});

test('link expirado que retorna à home encaminha para recuperação da confirmação', async ({
    page,
}) => {
    await page.goto(
        '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
    );
    await expect(page).toHaveURL(/\/entrar\?confirmacao=1#?$/);
    expect(new URL(page.url()).hash).toBe('');
    await expect(page.getByRole('alert')).toContainText(
        'O link de confirmação expirou ou já foi utilizado',
    );
    await page.getByRole('button', { name: 'Reenviar confirmação' }).click();
    await expect(page.getByText('Informe seu e-mail para reenviar a confirmação.')).toBeVisible();
});

test('retorno válido estabelece sessão sem pedir a senha novamente', async ({ page }) => {
    const authSession = session();
    const fragment = new URLSearchParams({
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
        expires_in: '3600',
        token_type: 'bearer',
        type: 'signup',
    });
    await page.goto(`/entrar?confirmacao=1#${fragment}`);
    await expect(page.getByRole('heading', { name: 'Acesso confirmado' })).toBeVisible();
    await expect(page).toHaveURL(/\/entrar\?confirmacao=1#?$/);
    expect(new URL(page.url()).hash).toBe('');
    await page.getByRole('link', { name: 'Ir para Meu Negócio' }).click();
    await expect(page).toHaveURL(/\/meu-negocio$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meu Negócio', exact: true })).toBeVisible();
});

test('marcador de confirmação sozinho não comprova sessão', async ({ page }) => {
    await page.goto('/entrar?confirmacao=1');
    await expect(page.getByRole('heading', { name: 'Acesso confirmado' })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Entre com seu e-mail e senha');
});

test('limite de envio de confirmação é apresentado sem sucesso falso', async ({ page, api }) => {
    api.resendError = {
        error_code: 'over_email_send_rate_limit',
        message: 'Email rate limit exceeded',
    };
    await page.goto('/entrar?confirmacao=1');
    await page.getByLabel('E-mail', { exact: true }).fill('proprietario@example.test');
    await page.getByRole('button', { name: 'Reenviar confirmação' }).click();
    await expect(page.getByRole('alert')).toContainText('Aguarde alguns minutos');
    await expect(page.getByText(/Se houver uma conta aguardando confirmação/)).toHaveCount(0);
});
