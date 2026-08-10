const images = import.meta.glob('../assets/beaches/*.webp', {
    eager: true,
    import: 'default',
});

function getImage(id) {
    const entry = Object.entries(images).find(([path]) => path.includes(`/${id}.`));
    return entry ? entry[1] : null;
}

const rawBeaches = [
    {
        id: 'praia-bela',
        name: 'Praia Bela',
        description:
            'Famosa pelo encontro do Rio Mucatu com o mar, a Praia Bela encanta visitantes com suas águas mornas, paisagens exuberantes e ambiente perfeito para toda a família. A combinação entre a lagoa natural de águas calmas e o mar aberto cria um dos cenários mais bonitos do litoral sul da Paraíba.',
        subDescription:
            'Com excelente estrutura de bares e restaurantes à beira-mar e diversas opções de lazer, como caiaque, stand up paddle e tirolesa, a Praia Bela é o destino ideal para quem deseja relaxar, se divertir e aproveitar a natureza.',
    },
    {
        id: 'praia-do-pontal',
        name: 'Praia do Pontal',
        description:
            'Localizada ao norte da área central de Pitimbu, a Praia do Pontal é um convite para quem busca tranquilidade e contato com a natureza. Com águas calmas, extensa faixa de areia e coqueiros que emolduram a paisagem, é um excelente local para caminhadas e momentos de descanso à beira-mar.',
        subDescription:
            'Além de sua beleza natural, a praia marca o início da rota para algumas das paisagens mais encantadoras da região, como as Piscinas Naturais, a foz do Rio Abiaí e as impressionantes Falésias Coloridas. Um destino perfeito para apreciar a simplicidade, explorar novos cenários e desfrutar do litoral sul paraibano.',
    },
    {
        id: 'praia-guarita-central',
        name: 'Praia Guarita/Central',
        description:
            'A Praia da Guarita, localizada ao lado da Praia Central, próxima ao centro de Pitimbu e é um dos locais muito frequentados por moradores e visitantes. Com águas calmas, ampla faixa de areia e fácil acesso, a praia reúne lazer, tranquilidade e belas paisagens em um ambiente acolhedor.',
        subDescription:
            'Um dos cenários mais marcantes da Guarita/Central é a presença dos barcos de pesca que permanecem atracados ao longo da orla, refletindo a forte tradição pesqueira do município. O encontro do Rio Maceió com o mar completa a paisagem, criando um ambiente único onde natureza, cultura e cotidiano se encontram. Cercada por pequenas pousadas, bares e restaurantes, a Praia da Guarita é um convite para conhecer de perto a essência de Pitimbu.',
    },
    {
        id: 'praia-dos-mariscos',
        name: 'Praia dos Mariscos',
        description:
            'Conhecida pela tranquilidade e pelo charme natural, a Praia dos Mariscos oferece um ambiente acolhedor para quem busca sossego e contato direto com a natureza. Suas águas calmas, cristalinas e a paisagem preservada criam um cenário perfeito para momentos de descanso, contemplação e lazer em família.',
        subDescription:
            'Com uma extensa faixa de areia clara cercada por coqueirais, a praia é frequentada principalmente por moradores locais e pescadores, preservando uma atmosfera tranquila e autêntica. Sua orla predominantemente residencial e o ambiente pouco movimentado fazem da Praia dos Mariscos um dos lugares mais agradáveis para apreciar a simplicidade e a beleza natural do litoral de Pitimbu.',
    },
    {
        id: 'praia-azul',
        name: 'Praia Azul',
        description:
            'A Praia Azul é um dos destinos preferidos de moradores e veranistas que escolhem Pitimbu para aproveitar momentos de lazer à beira-mar. Com águas claras, limpas e ideais para banho, a praia oferece um ambiente agradável para reunir a família, relaxar e desfrutar das belezas do litoral sul paraibano.',
        subDescription:
            'Conhecida pela grande concentração de casas de veraneio ao longo de sua extensa orla, a Praia Azul ganha ainda mais vida durante o verão, feriados e períodos de alta temporada. Seu clima acolhedor e a movimentação característica dessas épocas fazem da praia um dos locais mais procurados para aproveitar dias de descanso e diversão com amigos e familiares.',
    },
    {
        id: 'praia-dos-coqueiros',
        name: 'Praia dos Coqueiros',
        description:
            'A Ponta dos Coqueiros é um verdadeiro refúgio para quem busca tranquilidade, privacidade e contato direto com a natureza. Com mar calmo, extensa faixa de areia dourada e uma atmosfera preservada, a praia encanta pela simplicidade e pela beleza de suas paisagens.',
        subDescription:
            'Como o nome sugere, a região é cercada por um vasto coqueiral que emoldura a orla e oferece sombra natural aos visitantes. Pouco urbanizada e com características ainda rústicas, a Ponta dos Coqueiros proporciona uma experiência única para quem deseja relaxar, contemplar o mar e desfrutar de um dos cenários mais belos e preservados do litoral de Pitimbu.',
    },
    {
        id: 'praia-de-pontinha-acau',
        name: 'Praia de Pontinha/Acaú',
        description:
            'A Praia de Pontinha é um dos destinos mais encantadores do litoral de Pitimbu, marcada pelo encontro das águas do Rio Goiana com o mar e pela divisa natural entre os estados da Paraíba e Pernambuco. Com águas calmas, rasas e um ambiente acolhedor, a praia é ideal para famílias e para quem busca tranquilidade em meio a belas paisagens.',
        subDescription:
            'Cercada por uma tradicional vila de pescadores, Pontinha mantém sua essência simples e autêntica. A região é conhecida pela pesca da lagosta, uma das atividades mais importantes da comunidade local, além dos bares e restaurantes que servem pratos regionais e frutos do mar frescos. Ao final do dia, o pôr do sol completa a experiência, proporcionando um dos cenários mais especiais do litoral sul paraibano.',
    },
];

export const beaches = rawBeaches.map((beach) => ({ ...beach, image: getImage(beach.id) }));
