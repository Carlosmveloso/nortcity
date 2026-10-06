import { test, expect, BUSINESS_ID, USER_ID } from './fixtures';
import { seedOffer } from './offersMock';

const calls = (api, name) => api.calls.filter((call) => call.path === `/rest/v1/rpc/${name}`);

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

function day(offset) {
    const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
}

function seed(api, options = {}) {
    return seedOffer(api.offers, { businessId: BUSINESS_ID, ownerId: USER_ID, ...options });
}

async function continueStep(page) {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

test.describe('ofertas — proprietário', () => {
    test.use({ initialStatus: 'active' });

    test('estado vazio, assistente em 4 passos, aceite e envio', async ({ page, api }) => {
        await page.goto('/meu-negocio');
        await page.getByRole('link', { name: 'Ver ofertas' }).click();
        await expect(page.getByRole('heading', { name: 'Nenhuma oferta ainda' })).toBeVisible();
        await page.getByRole('link', { name: 'Criar primeira oferta' }).click();

        // Passo 1: validação antes de criar qualquer coisa.
        await continueStep(page);
        await expect(page.getByText('Informe o título da oferta.')).toBeVisible();
        await expect(page.getByLabel('Título')).toBeFocused();
        expect(calls(api, 'create_offer')).toHaveLength(0);
        await page.getByLabel('Título').fill('20% no almoço');
        await page.getByLabel('Descrição', { exact: true }).fill('Desconto no almoço executivo.');
        await page.getByLabel('Tipo de benefício').selectOption('percentage_discount');
        await page.getByLabel('Percentual de desconto (%)').fill('120');
        await continueStep(page);
        await expect(page.getByText('O percentual vai de 0 a 100.')).toBeVisible();
        await page.getByLabel('Percentual de desconto (%)').fill('20');
        await continueStep(page);
        await expect(page).toHaveURL(/\/meu-negocio\/ofertas\/[^/]+\/editar\?etapa=2$/);
        await expect(page.getByText('Rascunho salvo.')).toBeVisible();
        expect(calls(api, 'create_offer')).toHaveLength(1);
        expect(calls(api, 'create_offer')[0].body).toMatchObject({
            p_business_id: BUSINESS_ID,
            p_payload: { title: '20% no almoço', benefit_type: 'percentage_discount', benefit_value: 20 },
        });

        // Passo 2: período, dias e horários estruturados.
        await page.getByLabel('Data inicial').fill(day(0));
        await page.getByLabel('Data final').fill(day(30));
        await page.getByRole('button', { name: 'Segunda a sexta' }).click();
        for (const name of ['Quarta', 'Quinta', 'Sexta']) await page.getByRole('checkbox', { name }).setChecked(false, { force: true });
        await page.getByRole('radio', { name: 'Horários específicos' }).check();
        await continueStep(page);
        await expect(page.getByText(/ao menos um horário para cada dia/)).toBeVisible();
        await page.getByRole('button', { name: 'Adicionar horário em Segunda' }).click();
        await page.getByRole('button', { name: /Usar os horários de Segunda/ }).click();
        await page.getByLabel('Compra mínima (R$)').fill('80');
        await continueStep(page);
        expect(calls(api, 'update_offer_draft').at(-1).body.p_payload).toMatchObject({
            days_of_week: [1, 2],
            time_windows: [
                { day: 1, start: '11:00', end: '15:00' },
                { day: 2, start: '11:00', end: '15:00' },
            ],
            minimum_purchase: 80,
        });

        // Passo 3: regras dos cupons.
        await continueStep(page);
        await expect(page.getByText('Escolha se a oferta tem quantidade limitada ou não.')).toBeVisible();
        await page.getByRole('radio', { name: 'Quantidade limitada' }).check();
        await page.getByLabel('Quantidade', { exact: true }).fill('100');
        await page.getByLabel('Validade do cupom após a geração').selectOption('1440');
        await continueStep(page);

        // Passo 4: prévia, taxa vinda do backend e aceite obrigatório.
        await expect(page.getByRole('heading', { name: 'Passo 4 — Revisão' })).toBeVisible();
        await expect(page.getByText('Segunda: 11:00–15:00')).toBeVisible();
        await expect(page.getByText('24 horas após a geração')).toBeVisible();
        await expect(page.getByText('R$ 1,00', { exact: false })).toBeVisible();
        await expect(page.getByText(/A geração do cupom não gera cobrança/)).toBeVisible();
        const submit = page.getByRole('button', { name: 'Enviar para análise' });
        await expect(submit).toBeDisabled();
        await page.getByLabel('Li e concordo com as condições comerciais desta oferta.').check();
        await expect(submit).toBeEnabled();
        await noOverflow(page);
        await submit.click();

        await expect(page.getByText('Oferta enviada para análise.', { exact: false })).toBeVisible();
        await expect(page.getByText('Em análise', { exact: true }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'Continuar edição' })).toHaveCount(0);
        expect(calls(api, 'accept_offer_financial_terms')[0].body).toMatchObject({ p_expected_fee: 1 });
        expect(calls(api, 'submit_offer_for_review')).toHaveLength(1);
        await noOverflow(page);

        await page.getByRole('link', { name: 'Ofertas', exact: true }).click();
        const card = page.getByRole('listitem').filter({ hasText: '20% no almoço' });
        await expect(card.getByText('Em análise')).toBeVisible();
        await expect(card.getByText(/Versão 1/)).toBeVisible();
    });

    test('rascunho é retomado e salvo sem envio', async ({ page, api }) => {
        const offer = seed(api);
        await page.goto('/meu-negocio/ofertas');
        await page.getByRole('link', { name: /Sobremesa grátis/ }).click();
        await expect(page).toHaveURL(new RegExp(`/meu-negocio/ofertas/${offer.id}$`));
        await page.getByRole('link', { name: 'Continuar edição' }).click();
        await expect(page.getByLabel('Título')).toHaveValue('Sobremesa grátis');
        await page.getByLabel('Título').fill('Sobremesa grátis no almoço');
        await page.getByRole('button', { name: 'Salvar rascunho' }).click();
        await expect(page.getByText('Rascunho salvo.')).toBeVisible();
        expect(calls(api, 'update_offer_draft')[0].body.p_payload.title).toBe('Sobremesa grátis no almoço');
        expect(calls(api, 'submit_offer_for_review')).toHaveLength(0);
        await page.reload();
        await expect(page.getByLabel('Título')).toHaveValue('Sobremesa grátis no almoço');
    });

    test('plano Gratuito prepara a oferta mas não envia', async ({ page, api }) => {
        api.offers.planId = 'gratuito';
        const offer = seed(api);
        await page.goto('/meu-negocio/ofertas');
        await expect(page.getByText(/Seu plano atual não inclui publicação de ofertas/)).toBeVisible();
        await page.goto(`/meu-negocio/ofertas/${offer.id}/editar?etapa=4`);
        await expect(page.getByText('Seu plano atual (Gratuito) não inclui publicação de ofertas.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Enviar para análise' })).toHaveCount(0);
        await expect(page.getByLabel(/Li e concordo/)).toHaveCount(0);
        expect(calls(api, 'accept_offer_financial_terms')).toHaveLength(0);
        await noOverflow(page);
    });

    test('taxa exibida é a do plano atual', async ({ page, api }) => {
        api.offers.planId = 'premium';
        const offer = seed(api);
        await page.goto(`/meu-negocio/ofertas/${offer.id}/editar?etapa=4`);
        await expect(page.getByText('Plano Premium', { exact: false }).first()).toBeVisible();
        await expect(page.getByText('R$ 0,50', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Enviar para análise' })).toBeDisabled();
    });

    test('ajustes solicitados: nova versão, novo aceite e reenvio', async ({ page, api }) => {
        const offer = seed(api, {
            status: 'changes_requested',
            versions: [{ review_status: 'changes_requested', fee_amount: '1.00', fee_rule_id: 'fee-profissional', financial_accepted_by: USER_ID, financial_accepted_at: '2026-10-02T12:00:00Z' }],
            reviews: [
                { action: 'submitted' },
                { action: 'changes_requested', message: 'Informe quais pratos participam da promoção.' },
            ],
        });
        await page.goto(`/meu-negocio/ofertas/${offer.id}`);
        await expect(page.getByText('Informe quais pratos participam da promoção.').first()).toBeVisible();
        await page.getByRole('link', { name: 'Corrigir e criar nova versão' }).click();
        await expect(page.getByText(/A versão 1 analisada fica preservada/)).toBeVisible();
        await continueStep(page);
        await page.getByLabel(/Produtos ou serviços participantes/).fill('Pudim e mousse de maracujá');
        await continueStep(page);
        await continueStep(page);
        const accept = page.getByLabel('Li e concordo com as condições comerciais desta oferta.');
        await expect(accept).not.toBeChecked();
        await expect(page.getByRole('button', { name: 'Enviar para análise' })).toBeDisabled();
        await accept.check();
        await page.getByRole('button', { name: 'Enviar para análise' }).click();
        await expect(page.getByText('Oferta enviada para análise.', { exact: false })).toBeVisible();

        const versions = api.offers.versions.filter((version) => version.offer_id === offer.id);
        expect(versions.map((version) => [version.version_number, version.review_status])).toEqual([
            [1, 'changes_requested'],
            [2, 'submitted'],
        ]);
        expect(versions[0].eligible_items).toBeNull();
        expect(versions[1].eligible_items).toBe('Pudim e mousse de maracujá');
        expect(calls(api, 'accept_offer_financial_terms')).toHaveLength(1);
        await expect(page.getByText('Nova versão enviada')).toBeVisible();
    });

    test('versão em análise não pode ser editada', async ({ page, api }) => {
        const offer = seed(api, { status: 'pending_review', versions: [{ review_status: 'submitted' }], reviews: [{ action: 'submitted' }] });
        await page.goto(`/meu-negocio/ofertas/${offer.id}`);
        await expect(page.getByText(/não pode ser alterada/)).toBeVisible();
        await expect(page.getByRole('link', { name: /Continuar|Corrigir/ })).toHaveCount(0);
        await page.goto(`/meu-negocio/ofertas/${offer.id}/editar`);
        await expect(page.getByText('Esta versão da oferta já foi enviada e não pode mais ser alterada.')).toBeVisible();
        await expect(page.getByLabel('Título')).toHaveCount(0);
    });

    test('clique repetido no envio não duplica a operação', async ({ page, api }) => {
        const offer = seed(api);
        await page.goto(`/meu-negocio/ofertas/${offer.id}/editar?etapa=4`);
        await page.getByLabel(/Li e concordo/).check();
        let release;
        api.offers.gate = new Promise((resolve) => {
            release = resolve;
        });
        const submit = page.getByRole('button', { name: 'Enviar para análise' });
        await submit.click();
        await expect(page.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
        await page.getByRole('button', { name: 'Enviando...' }).click({ force: true });
        api.offers.gate = null;
        release();
        await expect(page.getByText('Oferta enviada para análise.', { exact: false })).toBeVisible();
        expect(calls(api, 'accept_offer_financial_terms')).toHaveLength(1);
        expect(calls(api, 'submit_offer_for_review')).toHaveLength(1);
    });

    test('oferta ativa recebe alteração sem sair do ar', async ({ page, api }) => {
        const offer = seed(api, {
            status: 'active',
            versions: [{ review_status: 'approved', published: true }],
            reviews: [{ action: 'submitted' }, { action: 'approved' }, { action: 'published' }],
        });
        await page.goto(`/meu-negocio/ofertas/${offer.id}`);
        await page.getByRole('button', { name: 'Propor alteração' }).click();
        await expect(page.getByText('A versão publicada continua no ar', { exact: false })).toBeVisible();
        expect(calls(api, 'create_offer_revision')).toHaveLength(1);
        expect(api.offers.offers[0].published_version_id).toBe(api.offers.versions[0].id);
    });

    test('proprietário não acessa a análise de ofertas', async ({ page, api }) => {
        await page.goto('/admin/ofertas');
        await expect(page).toHaveURL(/\/$/);
        expect(calls(api, 'approve_offer')).toHaveLength(0);
    });
});

test.describe('ofertas — admin', () => {
    test.use({ role: 'admin', initialStatus: 'active' });

    test('fila pendente, análise e pedido de ajustes com motivo obrigatório', async ({ page, api }) => {
        const offer = seed(api, { status: 'pending_review', versions: [{ review_status: 'submitted' }], reviews: [{ action: 'submitted' }] });
        await page.goto('/admin');
        await page.getByRole('link', { name: 'Ofertas', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Pendentes (1)' })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('link', { name: /Analisar/ }).click();
        await expect(page).toHaveURL(new RegExp(`/admin/ofertas/${offer.id}$`));
        await expect(page.getByRole('heading', { name: 'Versão em análise (versão 1)' })).toBeVisible();
        await expect(page.getByText('Restaurante Fixture').first()).toBeVisible();
        await expect(page.getByText(/Plano Profissional/)).toBeVisible();

        await page.getByRole('button', { name: 'Solicitar ajustes' }).click();
        const dialog = page.getByRole('dialog', { name: 'Solicitar ajustes' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Enviar solicitação' }).click();
        await expect(dialog.getByText(/Preencha: motivo/)).toBeVisible();
        expect(calls(api, 'request_offer_changes')).toHaveLength(0);
        await dialog.getByLabel('Motivo / instruções').fill('Informe quais pratos participam.');
        await dialog.getByRole('button', { name: 'Enviar solicitação' }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByText('Ajustes solicitados ao proprietário.')).toBeVisible();
        expect(calls(api, 'request_offer_changes')[0].body).toMatchObject({ p_offer_id: offer.id, p_message: 'Informe quais pratos participam.' });
        await expect(page.getByText('Ajustes solicitados', { exact: true }).first()).toBeVisible();
        await noOverflow(page);
    });

    test('rejeição exige motivo e mantém a oferta no histórico', async ({ page, api }) => {
        const offer = seed(api, { status: 'pending_review', versions: [{ review_status: 'submitted' }], reviews: [{ action: 'submitted' }] });
        await page.goto(`/admin/ofertas/${offer.id}`);
        await page.getByRole('button', { name: 'Rejeitar' }).click();
        const dialog = page.getByRole('dialog', { name: 'Rejeitar oferta' });
        await dialog.getByRole('button', { name: 'Rejeitar' }).click();
        expect(calls(api, 'reject_offer')).toHaveLength(0);
        await dialog.getByLabel('Motivo da não aprovação').fill('Benefício não confirmado pelo negócio.');
        await dialog.getByRole('button', { name: 'Rejeitar' }).click();
        await expect(page.getByText('Oferta não aprovada.', { exact: true })).toBeVisible();
        await expect(page.getByText('Benefício não confirmado pelo negócio.')).toBeVisible();
    });

    test('aprova e publica; oferta futura é agendada', async ({ page, api }) => {
        const now = seed(api, { status: 'pending_review', versions: [{ review_status: 'submitted', title: 'Começa hoje' }], reviews: [{ action: 'submitted' }] });
        await page.goto(`/admin/ofertas/${now.id}`);
        await page.getByRole('button', { name: 'Aprovar' }).click();
        await page.getByRole('dialog', { name: 'Aprovar oferta' }).getByRole('button', { name: 'Aprovar' }).click();
        await expect(page.getByText('Oferta aprovada. Agora ela pode ser publicada.')).toBeVisible();
        await page.getByRole('button', { name: 'Publicar', exact: true }).click();
        await page.getByRole('dialog', { name: 'Publicar oferta' }).getByRole('button', { name: 'Publicar' }).click();
        await expect(page.getByText('Oferta ativa e visível para o público.')).toBeVisible();
        expect(api.offers.offers.find((item) => item.id === now.id)).toMatchObject({ status: 'active' });

        const future = seed(api, {
            status: 'pending_review',
            versions: [{ review_status: 'submitted', title: 'Começa depois', starts_at: `${day(10)}T03:00:00Z` }],
            reviews: [{ action: 'submitted' }],
        });
        await page.goto(`/admin/ofertas/${future.id}`);
        await page.getByRole('button', { name: 'Aprovar' }).click();
        await page.getByRole('dialog', { name: 'Aprovar oferta' }).getByRole('button', { name: 'Aprovar' }).click();
        await page.getByRole('button', { name: 'Agendar publicação' }).click();
        await page.getByRole('dialog', { name: 'Publicar oferta' }).getByRole('button', { name: 'Agendar' }).click();
        await expect(page.getByText(/Publicação agendada para/)).toBeVisible();
        await expect(page.getByText('Agendada', { exact: true }).first()).toBeVisible();
        expect(calls(api, 'publish_offer')).toHaveLength(2);
    });

    test('suspende, traduz limite do plano na reativação e encerra', async ({ page, api }) => {
        const offer = seed(api, {
            status: 'active',
            versions: [{ review_status: 'approved', published: true }],
            reviews: [{ action: 'submitted' }, { action: 'approved' }, { action: 'published' }],
        });
        await page.goto(`/admin/ofertas/${offer.id}`);
        await page.getByRole('button', { name: 'Suspender' }).click();
        const suspend = page.getByRole('dialog', { name: 'Suspender oferta' });
        await suspend.getByRole('button', { name: 'Suspender' }).click();
        expect(calls(api, 'suspend_offer')).toHaveLength(0);
        await suspend.getByLabel('Motivo da suspensão').fill('Denúncia em apuração.');
        await suspend.getByRole('button', { name: 'Suspender' }).click();
        await expect(page.getByText('Oferta suspensa.')).toBeVisible();

        api.offers.fail.reactivate_offer = 'plan_offer_limit_reached';
        await page.getByRole('button', { name: 'Reativar' }).click();
        const reactivate = page.getByRole('dialog', { name: 'Reativar oferta' });
        await reactivate.getByRole('button', { name: 'Reativar' }).click();
        await expect(reactivate.getByText('Este negócio atingiu o limite de ofertas ativas do plano atual.')).toBeVisible();
        await expect(page.getByText('plan_offer_limit_reached')).toHaveCount(0);
        await reactivate.getByRole('button', { name: 'Reativar' }).click();
        await expect(page.getByText('Oferta reativada.')).toBeVisible();

        await page.getByRole('button', { name: 'Encerrar' }).click();
        const end = page.getByRole('dialog', { name: 'Encerrar oferta' });
        await expect(end.getByText('O encerramento é definitivo.')).toBeVisible();
        await end.getByRole('button', { name: 'Encerrar definitivamente' }).click();
        await expect(page.getByText('Oferta encerrada.')).toBeVisible();
        await expect(page.getByText(/Nenhuma ação disponível/)).toBeVisible();
        await noOverflow(page);
    });

    test('Esc fecha o diálogo sem chamar a operação', async ({ page, api }) => {
        const offer = seed(api, { status: 'pending_review', versions: [{ review_status: 'submitted' }], reviews: [{ action: 'submitted' }] });
        await page.goto(`/admin/ofertas/${offer.id}`);
        const trigger = page.getByRole('button', { name: 'Rejeitar' });
        await trigger.click();
        await expect(page.getByRole('dialog', { name: 'Rejeitar oferta' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(calls(api, 'reject_offer')).toHaveLength(0);
    });

    test('plano é atribuído em Admin › Negócios', async ({ page, api }) => {
        api.offers.planId = 'gratuito';
        await page.goto('/admin');
        await page.getByRole('button', { name: 'Publicado', exact: true }).click();
        await page.getByRole('button', { name: 'Plano e ofertas' }).click();
        await expect(page.getByText(/Plano atual: Gratuito/)).toBeVisible();
        await page.getByLabel('Novo plano').selectOption('profissional');
        await page.getByRole('button', { name: 'Salvar plano' }).click();
        await expect(page.getByText('Plano atualizado.')).toBeVisible();
        expect(calls(api, 'admin_set_business_plan')[0].body).toMatchObject({ p_business_id: BUSINESS_ID, p_plan_id: 'profissional' });
    });
});
