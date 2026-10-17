// Fluxo completo de ofertas contra o Supabase de DESENVOLVIMENTO, com Auth,
// PostgREST, RLS e RPCs reais. Rode com `npm run test:e2e:dev` depois de
// aplicar supabase/diagnostics/offers_e2e_dev_setup.sql (ver docs/testes.md).
import { test, expect } from '@playwright/test';

const OWNER = 'offers.e2e.owner@example.test';
const ADMIN = 'offers.e2e.admin@example.test';
const PASSWORD = process.env.E2E_DEV_PASSWORD;
const DEV_ORIGIN = process.env.E2E_DEV_SUPABASE_ORIGIN;
const FORBIDDEN_ORIGIN = process.env.E2E_FORBIDDEN_SUPABASE_ORIGIN;

test.skip(!PASSWORD || !DEV_ORIGIN, 'Defina E2E_DEV_PASSWORD e use playwright.dev.config.js.');

/** Só local e o projeto de desenvolvimento; produção derruba o teste. */
async function guard(context, violations) {
    await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin === 'http://127.0.0.1:4174' || url.origin === DEV_ORIGIN) return route.continue();
        if (FORBIDDEN_ORIGIN && url.origin === FORBIDDEN_ORIGIN) violations.push(url.href);
        return route.abort();
    });
}

// Data de hoje em Pitimbu (UTC−3), para a oferta começar hoje e ficar ativa.
function recifeDay(offsetDays = 0) {
    return new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function login(page, email) {
    await page.goto('/entrar');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).not.toHaveURL(/\/entrar/);
}

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const next = (page) => page.getByRole('button', { name: 'Continuar', exact: true }).click();

test('proprietário envia, admin pede ajustes, nova versão é aprovada e publicada', async ({ browser }, testInfo) => {
    const title = `E2E ${testInfo.project.name} ${Date.now().toString(36)}`;
    const violations = [];
    const errors = [];
    const contextOptions = { ...testInfo.project.use, baseURL: 'http://127.0.0.1:4174' };
    const ownerContext = await browser.newContext(contextOptions);
    const adminContext = await browser.newContext(contextOptions);
    await guard(ownerContext, violations);
    await guard(adminContext, violations);
    const owner = await ownerContext.newPage();
    const admin = await adminContext.newPage();
    for (const page of [owner, admin]) page.on('pageerror', (error) => errors.push(error.message));

    // PROPRIETÁRIO — cria, preenche os 4 passos, aceita e envia.
    await login(owner, OWNER);
    await owner.goto('/meu-negocio');
    await owner.getByRole('link', { name: 'Ver ofertas' }).click();
    await expect(owner.getByText('Plano Profissional', { exact: false }).first()).toBeVisible();
    await owner.getByRole('link', { name: /Criar (primeira )?oferta/ }).first().click();
    await owner.getByLabel('Título').fill(title);
    await owner.getByLabel('Descrição', { exact: true }).fill('Desconto no almoço executivo para quem usa o Farol.');
    await owner.getByLabel('Tipo de benefício').selectOption('percentage_discount');
    await owner.getByLabel('Percentual de desconto (%)').fill('20');
    await next(owner);
    await expect(owner.getByText('Rascunho salvo.')).toBeVisible();
    await owner.getByLabel('Data inicial').fill(recifeDay(0));
    await owner.getByLabel('Data final').fill(recifeDay(30));
    await owner.getByRole('button', { name: 'Segunda a sexta' }).click();
    await owner.getByRole('radio', { name: 'Horários específicos' }).check();
    await owner.getByRole('button', { name: 'Adicionar horário em Segunda' }).click();
    await owner.getByRole('button', { name: /Usar os horários de Segunda/ }).click();
    await owner.getByLabel('Compra mínima (R$)').fill('80');
    await next(owner);
    await owner.getByRole('radio', { name: 'Quantidade limitada' }).check();
    await owner.getByLabel('Quantidade', { exact: true }).fill('100');
    await owner.getByLabel('Validade do cupom após a geração').selectOption('1440');
    await next(owner);
    await expect(owner.getByText('Segunda: 11:00–15:00')).toBeVisible();
    await expect(owner.getByText('R$ 1,00', { exact: false }).first()).toBeVisible();
    const submit = owner.getByRole('button', { name: 'Enviar para análise' });
    await expect(submit).toBeDisabled();
    await owner.getByLabel('Li e concordo com as condições comerciais desta oferta.').check();
    await noOverflow(owner);
    await submit.click();
    await expect(owner.getByText('Oferta enviada para análise.', { exact: false })).toBeVisible();
    await expect(owner.getByText('Em análise', { exact: true }).first()).toBeVisible();
    const offerUrl = owner.url();

    // ADMIN — encontra na fila e pede ajustes.
    await login(admin, ADMIN);
    await admin.goto('/admin/ofertas?fila=pending');
    const card = admin.getByRole('listitem').filter({ hasText: title });
    await card.getByRole('link', { name: /Analisar/ }).click();
    await expect(admin.getByRole('heading', { name: 'Versão em análise (versão 1)' })).toBeVisible();
    await expect(admin.getByText('Taxa aceita:', { exact: false }).first()).toBeVisible();
    await admin.getByRole('button', { name: 'Solicitar ajustes' }).click();
    const changes = admin.getByRole('dialog', { name: 'Solicitar ajustes' });
    await changes.getByLabel('Motivo / instruções').fill('Informe quais pratos participam da promoção.');
    await changes.getByRole('button', { name: 'Enviar solicitação' }).click();
    await expect(admin.getByText('Ajustes solicitados ao proprietário.')).toBeVisible();
    await noOverflow(admin);

    // PROPRIETÁRIO — vê o pedido, cria a versão 2 com novo aceite e reenvia.
    await owner.goto(offerUrl);
    await expect(owner.getByText('Informe quais pratos participam da promoção.').first()).toBeVisible();
    await owner.getByRole('link', { name: 'Corrigir e criar nova versão' }).click();
    await expect(owner.getByText(/A versão 1 analisada fica preservada/)).toBeVisible();
    await next(owner);
    await owner.getByLabel(/Produtos ou serviços participantes/).fill('Pratos do almoço executivo, de segunda a sexta');
    await next(owner);
    await next(owner);
    const accept = owner.getByLabel('Li e concordo com as condições comerciais desta oferta.');
    await expect(accept).not.toBeChecked();
    await accept.check();
    await owner.getByRole('button', { name: 'Enviar para análise' }).click();
    await expect(owner.getByText('Oferta enviada para análise.', { exact: false })).toBeVisible();
    await expect(owner.getByText(/Versão 2/).first()).toBeVisible();

    // ADMIN — aprova e publica.
    await admin.goto('/admin/ofertas?fila=pending');
    await admin.getByRole('listitem').filter({ hasText: title }).getByRole('link', { name: /Analisar/ }).click();
    await expect(admin.getByRole('heading', { name: 'Versão em análise (versão 2)' })).toBeVisible();
    await admin.getByRole('button', { name: 'Aprovar' }).click();
    await admin.getByRole('dialog', { name: 'Aprovar oferta' }).getByRole('button', { name: 'Aprovar' }).click();
    await expect(admin.getByText('Oferta aprovada. Agora ela pode ser publicada.')).toBeVisible();
    await admin.getByRole('button', { name: 'Publicar', exact: true }).click();
    await admin.getByRole('dialog', { name: 'Publicar oferta' }).getByRole('button', { name: 'Publicar' }).click();
    await expect(admin.getByText('Oferta ativa e visível para o público.')).toBeVisible();

    // SISTEMA — ativa, com histórico, versão anterior e taxa preservados.
    await expect(admin.getByText('Ativa', { exact: true }).first()).toBeVisible();
    await expect(admin.getByRole('heading', { name: 'Versão publicada (versão 2)' })).toBeVisible();
    const older = admin.getByRole('group').filter({ hasText: 'Versão 1 · Ajustes solicitados' });
    await expect(admin.getByText(/Versão 1 · Ajustes solicitados/)).toBeVisible();
    await expect(older).toHaveCount(1);
    const history = admin.getByRole('region', { name: 'Histórico' }).getByRole('listitem');
    await expect(history).toHaveText([
        /^Oferta enviada para análise · versão 1/,
        /^Ajustes solicitados · versão 1/,
        /^Nova versão enviada · versão 2/,
        /^Oferta aprovada · versão 2/,
        /^Oferta publicada · versão 2/,
    ]);
    await expect(admin.getByText(/Taxa aceita: R\$\s1,00 por cupom utilizado/).first()).toBeVisible();
    await noOverflow(admin);

    await owner.goto(offerUrl);
    await expect(owner.getByText('Ativa', { exact: true }).first()).toBeVisible();
    await expect(owner.getByText(/^Oferta publicada · versão 2/)).toBeVisible();

    await ownerContext.close();
    await adminContext.close();
    expect(violations, 'Nenhuma requisição ao projeto de produção').toEqual([]);
    expect(errors, 'Nenhuma exceção de JavaScript').toEqual([]);
});
