// Apenas a oferta disponível. Propostas comerciais antigas: docs/historico/planos-2026-09.md.
export const plans = [
    {
        id: 'gratuito',
        name: 'Gratuito',
        tagline: 'Para divulgar seu negócio local',
        price: 'Grátis',
        period: '',
        featured: false,
        features: [
            { text: 'Perfil no diretório após aprovação', included: true },
            { text: 'Uma imagem de capa', included: true },
            { text: 'Informações de contato', included: true },
            { text: 'Link para WhatsApp, quando informado', included: true },
            { text: 'Área Meu Negócio para acompanhar o cadastro', included: true },
        ],
        cta: 'Começar grátis',
    },
];

export const planBenefits = [
    {
        title: 'Descoberta local',
        description: 'Seja encontrado por turistas e moradores que buscam o que você oferece.',
    },
    {
        title: 'Presença no diretório',
        description: 'Após a aprovação, seu perfil fica disponível para consulta no Farol Pitimbu.',
    },
    {
        title: 'Contato direto',
        description: 'Compartilhe os canais de contato do seu negócio.',
    },
    {
        title: 'Acompanhamento',
        description: 'Consulte o status do cadastro e envie correções pela área Meu Negócio.',
    },
];
