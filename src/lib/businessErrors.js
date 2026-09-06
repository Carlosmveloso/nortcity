// As RPCs do banco levantam erro com `message` = código estável em inglês e
// `detail` = frase em PT-BR. O mapa abaixo é a fonte da cópia que o usuário lê;
// o detail do banco é o fallback para código novo que ainda não chegou aqui.
const MESSAGES = {
    auth_required: 'Entre na sua conta para continuar.',
    forbidden: 'Você não tem permissão para esta ação.',
    not_found: 'Registro não encontrado.',

    business_limit_reached: 'Sua conta já possui um negócio cadastrado. Acesse Meu Negócio para editá-lo.',
    owner_has_business: 'Esta conta já é proprietária de outro negócio.',
    already_owned: 'Este negócio já tem proprietário vinculado.',
    profile_not_found: 'Conta não encontrada.',

    name_required: 'Informe o nome do negócio.',
    name_too_long: 'O nome pode ter no máximo 120 caracteres.',
    description_required: 'Escreva uma descrição do negócio.',
    description_too_short: 'A descrição precisa ter pelo menos 40 caracteres.',
    description_too_long: 'A descrição pode ter no máximo 1500 caracteres.',
    location_required: 'Informe o endereço, o bairro ou a área de atendimento.',
    contact_required:
        'Informe ao menos um contato público válido: telefone, WhatsApp, e-mail, Instagram ou site.',

    categories_required: 'Selecione ao menos uma categoria.',
    categories_too_many: 'Selecione no máximo três categorias.',
    categories_invalid: 'Selecione de uma a três categorias.',
    category_not_found: 'Uma das categorias escolhidas não existe mais.',
    primary_category_required: 'Escolha qual categoria é a principal.',
    primary_category_invalid: 'A categoria principal precisa estar entre as escolhidas.',

    status_not_editable: 'Este negócio não pode ser editado neste status.',
    status_not_allowed: 'O status do negócio é definido pela análise do Farol.',
    owner_not_allowed: 'O proprietário do negócio não pode ser alterado por aqui.',
    slug_not_allowed: 'O endereço público do negócio não pode ser alterado.',
    moderation_not_allowed: 'Campos de moderação são preenchidos apenas pela análise.',
    invalid_transition: 'Esta mudança de status não é permitida.',
    invalid_action: 'Ação desconhecida.',
    invalid_status: 'Status inválido para esta operação.',
    reason_required: 'Informe o motivo da decisão.',

    field_not_editable: 'Este campo não pode ser alterado pelo proprietário.',
    request_already_open: 'Já existe uma alteração aguardando análise para este negócio.',
    empty_request: 'Nenhuma alteração foi informada.',
    base_changed:
        'O negócio mudou depois que a solicitação foi criada. Recuse esta solicitação e peça uma nova ao proprietário.',
    business_not_active: 'O negócio não está publicado; a alteração não pode ser aplicada.',
    cover_url_required: 'Publique a imagem proposta antes de aprovar a alteração.',

    duplicate_without_owner: 'A duplicata não tem proprietário para transferir.',
    duplicate_is_active: 'Suspenda a duplicata publicada antes de resolvê-la.',
};

export function businessErrorMessage(error, fallback = 'Não foi possível concluir. Tente novamente em instantes.') {
    if (!error) return fallback;
    return MESSAGES[error.message] ?? error.details ?? fallback;
}
