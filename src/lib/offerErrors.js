// Tradução dos erros do módulo de ofertas. As RPCs levantam `message` = código
// estável e `detail` = frase técnica em PT-BR; a interface mostra só o texto
// abaixo. Códigos que não são de ofertas caem no mapa geral de negócios.
import { businessErrorMessage } from './businessErrors';

const FALLBACK = 'Não foi possível concluir. Tente novamente em instantes.';

const MESSAGES = {
    forbidden: 'Você não tem permissão para esta ação.',
    not_found: 'Oferta não encontrada.',
    auth_required: 'Entre na sua conta para continuar.',

    plan_fee_unavailable:
        'Seu plano atual não inclui publicação de ofertas. Fale com a equipe do Farol para alterar seu plano.',
    fee_changed: 'A taxa do seu plano mudou. Confira o novo valor e aceite as condições novamente.',
    financial_terms_required: 'Aceite as condições comerciais antes de enviar a oferta.',
    plan_offer_limit_reached: 'Este negócio atingiu o limite de ofertas ativas do plano atual.',
    plan_offer_limit_exceeded:
        'O negócio tem mais ofertas ativas do que o novo plano permite. Suspenda ou encerre ofertas antes de alterar o plano.',
    plan_not_found: 'Plano desconhecido.',
    plan_unchanged: 'O negócio já está neste plano.',

    business_not_active: 'O negócio precisa estar publicado no Farol para enviar ou ativar ofertas.',
    offer_not_editable: 'Esta versão da oferta não pode mais ser editada.',
    revision_already_open: 'Já existe uma alteração em andamento para esta oferta.',
    offer_incomplete: 'Preencha título, descrição e tipo de benefício antes de enviar.',
    benefit_value_required: 'Informe o valor do desconto.',
    offer_period_required: 'Informe a data inicial e a data final da oferta.',
    offer_period_ended: 'O período desta oferta já terminou. Ajuste as datas para continuar.',
    coupon_validity_required: 'Escolha por quanto tempo o cupom vale depois de gerado.',
    revision_not_started: 'A alteração só pode entrar no ar quando o novo período já tiver começado.',
    reason_required: 'Escreva o motivo para o proprietário entender a decisão.',
    field_not_editable: 'Um dos campos enviados não pode ser alterado por aqui.',
    invalid_payload: 'Os dados da oferta não foram reconhecidos. Recarregue a página e tente novamente.',

    // Proteções do banco: chegar aqui indica estado desatualizado na tela.
    invalid_transition: 'Esta ação não está disponível para a oferta no estado atual. Recarregue a página.',
    version_immutable: 'Uma versão já enviada para análise não pode ser alterada.',
    version_not_approved: 'Só uma versão aprovada pode ser publicada.',
    direct_write_not_allowed: 'Esta alteração precisa passar pelas operações oficiais do Farol.',
    offer_not_deletable: 'Ofertas não são apagadas; elas podem ser encerradas.',
    review_immutable: 'O histórico da oferta não pode ser alterado.',
};

// Violação de constraint (23514) traz o nome dela na mensagem.
const CONSTRAINTS = {
    offer_versions_period_check: 'A data final precisa ser posterior à data inicial.',
    offer_versions_limits_check: 'O limite por pessoa não pode passar da quantidade total.',
    offer_versions_benefit_value_check: 'O valor do benefício está fora do permitido para o tipo escolhido.',
    offer_versions_schedule_check: 'Revise os dias e horários: cada faixa precisa estar em um dia escolhido, sem sobreposição.',
    offer_versions_title_check: 'O título precisa ter entre 3 e 80 caracteres.',
    offer_versions_description_check: 'A descrição pode ter no máximo 1000 caracteres.',
    offer_versions_minimum_purchase_check: 'A compra mínima precisa ser maior que zero.',
    offer_versions_total_limit_check: 'A quantidade total precisa ser maior que zero.',
    offer_versions_per_user_limit_check: 'O limite por pessoa precisa ser pelo menos 1.',
    offer_versions_coupon_validity_minutes_check: 'A validade do cupom precisa ser maior que zero.',
};

/** @param {{message?: string, code?: string, details?: string} | null | undefined} error */
export function offerErrorMessage(error, fallback = FALLBACK) {
    if (!error) return fallback;
    const known = MESSAGES[error.message];
    if (known) return known;

    if (error.code === '23514' || /check constraint/.test(error.message ?? '')) {
        const name = Object.keys(CONSTRAINTS).find((constraint) => (error.message ?? '').includes(constraint));
        if (name) return CONSTRAINTS[name];
    }
    if (error.code === '22P02') return 'Um dos valores informados não é válido.';
    if (error.code === '42501') return MESSAGES.forbidden;

    // Código de negócio (contrato geral) ou falha desconhecida: nunca exibir o
    // identificador bruto; o detalhe vai para o console.
    const general = businessErrorMessage({ message: error.message }, '');
    if (general && !general.includes('(código:')) return general;
    console.error('[farol] erro de oferta não mapeado:', error);
    return fallback;
}
