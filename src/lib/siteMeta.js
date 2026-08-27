// Fonte única das meta tags de SEO/compartilhamento.
// Sem imports de imagem nem de React: também é lido por Node nos scripts de build.
import { rawBeaches } from '../data/beaches.data.js';
import { rawBusinesses } from '../data/businesses.data.js';
import { experienceMeta } from '../data/experienceMeta.js';
import { categoryLabels } from '../data/categoryLabels.js';

export const SITE_URL = 'https://farolpitimbu.com.br';
export const SITE_NAME = 'Farol Pitimbu';
export const DEFAULT_TITLE = 'Farol Pitimbu — O guia digital do litoral sul da Paraíba';
export const DEFAULT_DESCRIPTION =
    'Descubra praias, pousadas, restaurantes, passeios e negócios locais de Pitimbu e do litoral sul da Paraíba.';
export const DEFAULT_OG_IMAGE = '/og/default.jpg';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

// Páginas fixas do site. Precisam de meta próprias porque o index.html declara
// canonical da home: sem isto o Google trata todas como duplicata de "/".
export const staticPages = [
    {
        path: '/',
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
    },
    {
        path: '/explorar',
        title: 'Explorar Pitimbu',
        description:
            'Explore negócios, passeios, gastronomia, hospedagem e serviços de Pitimbu e do litoral sul da Paraíba.',
    },
    {
        path: '/categorias',
        title: 'Categorias',
        description:
            'Explore Pitimbu por categoria e encontre exatamente o que você precisa: gastronomia, passeios, hospedagem e serviços.',
    },
    {
        path: '/atracoes',
        title: 'Atrações em Pitimbu',
        description: 'Do mar às tradições: os lugares que fazem Pitimbu única.',
    },
    {
        path: '/eventos',
        title: 'Agenda de eventos em Pitimbu',
        description: 'Festas, celebrações e programação cultural de Pitimbu para não perder nada.',
    },
    {
        path: '/mapa',
        title: 'Praias e mapa de Pitimbu',
        description:
            'Conheça as praias de Pitimbu, localize negócios e atrações no mapa e planeje seu roteiro pela região.',
    },
    {
        path: '/profissionais',
        title: 'Profissionais em Pitimbu',
        description: 'Encontre guias, técnicos, artesãos e prestadores de serviço locais de Pitimbu.',
    },
    {
        path: '/blog',
        title: 'Blog',
        description:
            'Histórias e guias de Pitimbu: leia, planeje e descubra a região com quem conhece de perto.',
    },
    {
        path: '/planos',
        title: 'Divulgue seu negócio em Pitimbu',
        description:
            'Escolha o plano ideal e seja encontrado por milhares de visitantes e moradores do litoral sul da Paraíba.',
    },
    {
        path: '/guia-local',
        title: 'Guia Local',
        description: 'Maré, feiras livres, eventos e telefones úteis de Pitimbu, tudo em um só lugar.',
    },
    {
        path: '/cadastrar-negocio',
        title: 'Cadastrar meu negócio',
        description:
            'Cadastre seu negócio no Farol Pitimbu e alcance turistas e moradores do litoral sul da Paraíba.',
    },
    {
        path: '/sobre',
        title: 'Sobre',
        description:
            'O Farol Pitimbu nasceu para conectar turistas e moradores a tudo que Pitimbu tem a oferecer e dar visibilidade a quem faz a cidade acontecer.',
    },
    {
        path: '/contato',
        title: 'Contato',
        description: 'Dúvidas, sugestões ou parcerias — fale com o time do Farol Pitimbu.',
    },
    // Páginas de conta: têm canonical próprio, mas ficam fora do índice.
    {
        path: '/favoritos',
        title: 'Favoritos',
        description: 'Tudo o que você marcou para não esquecer no Farol Pitimbu.',
        noindex: true,
    },
    {
        path: '/entrar',
        title: 'Entrar',
        description: 'Acesse sua conta do Farol Pitimbu.',
        noindex: true,
    },
];

function withDefaults(page) {
    return {
        ...page,
        title: page.path === '/' ? page.title : `${page.title} — ${SITE_NAME}`,
        image: DEFAULT_OG_IMAGE,
        imageAlt: 'Praia de Pitimbu, litoral sul da Paraíba',
    };
}

// 404: o que importa é sair do índice; o canonical acompanha a URL pedida.
export function notFoundMeta() {
    return {
        path: typeof window === 'undefined' ? '/' : window.location.pathname,
        title: `Página não encontrada — ${SITE_NAME}`,
        description: DEFAULT_DESCRIPTION,
        image: DEFAULT_OG_IMAGE,
        noindex: true,
    };
}

export function staticPageMeta(path) {
    const page = staticPages.find((item) => item.path === path);

    return page ? withDefaults(page) : null;
}

export function businessSubtitle(business) {
    return business.subcategory ?? categoryLabels[business.categories[0]] ?? null;
}

function sentence(text) {
    const trimmed = text.trim();
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function businessPageMeta(business) {
    const subtitle = businessSubtitle(business);
    const parts = [sentence(business.description)];

    if (subtitle) {
        parts.push(`${subtitle} em Pitimbu, PB.`);
    }
    parts.push('Veja contato e endereço no Farol Pitimbu.');

    return {
        path: `/negocio/${business.id}`,
        title: `${business.name} — ${SITE_NAME}`,
        description: parts.join(' '),
        image: `/og/${business.id}.jpg`,
        imageAlt: `${business.name} — ${SITE_NAME}`,
    };
}

export function beachPageMeta(beach) {
    return {
        path: `/praia/${beach.id}`,
        title: `${beach.name} — ${SITE_NAME}`,
        description: `${sentence(beach.description)} Veja o guia completo no Farol Pitimbu.`,
        image: `/og/${beach.id}.jpg`,
        imageAlt: `${beach.name}, Pitimbu — ${SITE_NAME}`,
    };
}

export function experiencePageMeta(slug) {
    const meta = experienceMeta[slug];

    if (!meta) {
        return null;
    }

    return {
        path: `/experiencia/${slug}`,
        title: `${meta.title} — ${SITE_NAME}`,
        description: `${sentence(meta.description)} Veja o guia completo no Farol Pitimbu.`,
        image: `/og/experiencia-${slug}.jpg`,
        imageAlt: `${meta.title} — ${SITE_NAME}`,
    };
}

// Todas as rotas que ganham HTML pré-renderizado com meta tags próprias.
export function prerenderedRoutes() {
    return [
        ...staticPages.map((page) => withDefaults(page)),
        ...rawBusinesses.map((business) => businessPageMeta(business)),
        ...rawBeaches.map((beach) => beachPageMeta(beach)),
        ...Object.keys(experienceMeta).map((slug) => experiencePageMeta(slug)),
    ];
}

// Só o que deve aparecer no sitemap.xml.
export function indexableRoutes() {
    return prerenderedRoutes().filter((route) => !route.noindex);
}
