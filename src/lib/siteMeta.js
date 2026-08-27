// Fonte única das meta tags de SEO/compartilhamento.
// Sem imports de imagem nem de React: também é lido por Node nos scripts de build.
import { rawBusinesses } from '../data/businesses.data.js';
import { experienceMeta } from '../data/experienceMeta.js';
import { categoryLabels } from '../data/categoryLabels.js';

export const SITE_URL = 'https://www.farolpitimbu.com.br';
export const SITE_NAME = 'Farol Pitimbu';
export const DEFAULT_TITLE = 'Farol Pitimbu — O guia digital do litoral sul da Paraíba';
export const DEFAULT_DESCRIPTION =
    'Descubra praias, pousadas, restaurantes, passeios e negócios locais de Pitimbu e do litoral sul da Paraíba.';
export const DEFAULT_OG_IMAGE = '/og/default.jpg';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

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
        ...rawBusinesses.map((business) => businessPageMeta(business)),
        ...Object.keys(experienceMeta).map((slug) => experiencePageMeta(slug)),
    ];
}
