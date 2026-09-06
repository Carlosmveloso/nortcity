// Motivos de moderação (enum business_moderation_reason). O texto aqui é o que
// o proprietário lê em Meu Negócio, então é explicação, não jargão interno.
export const MODERATION_REASONS = [
    { value: 'duplicate_business', label: 'Negócio duplicado', owner: 'Já existe um cadastro deste mesmo negócio no Farol.' },
    { value: 'insufficient_information', label: 'Informações insuficientes', owner: 'O cadastro precisa de mais informações para ser publicado.' },
    { value: 'invalid_contact', label: 'Contato inválido', owner: 'Não conseguimos validar o contato informado.' },
    { value: 'invalid_location', label: 'Localização inválida', owner: 'A localização ou área de atendimento informada não confere.' },
    { value: 'wrong_category', label: 'Categoria incorreta', owner: 'As categorias escolhidas não correspondem ao negócio.' },
    { value: 'inappropriate_content', label: 'Conteúdo inadequado', owner: 'O conteúdo enviado não pode ser publicado no Farol.' },
    { value: 'business_not_found', label: 'Negócio não localizado', owner: 'Não conseguimos confirmar a existência do negócio.' },
    { value: 'outside_service_area', label: 'Fora da área de cobertura', owner: 'O negócio não atende Pitimbu de forma recorrente.' },
    { value: 'suspected_fraud', label: 'Suspeita de fraude', owner: 'Identificamos indícios que precisam ser esclarecidos.' },
    { value: 'business_closed', label: 'Negócio encerrado', owner: 'O negócio foi retirado do ar por encerramento das atividades.' },
    { value: 'other', label: 'Outro motivo', owner: 'Entre em contato com a equipe do Farol para entender os próximos passos.' },
];

const BY_VALUE = Object.fromEntries(MODERATION_REASONS.map((reason) => [reason.value, reason]));

export function moderationReasonLabel(value) {
    return BY_VALUE[value]?.label ?? value;
}

/** Explicação compreensível para o proprietário. Nunca expõe moderation_note. */
export function moderationReasonForOwner(value) {
    return BY_VALUE[value]?.owner ?? null;
}

export const BUSINESS_STATUS_LABELS = {
    pending: 'Em análise',
    active: 'Publicado',
    rejected: 'Não aprovado',
    suspended: 'Suspenso',
};
