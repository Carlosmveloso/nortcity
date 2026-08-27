// Monta a mensagem que vai junto com o link ao compartilhar.
// O WhatsApp entrega só a URL quando `navigator.share` recebe apenas `url`,
// então o texto completo vai em `text` — e é ele que cai na área de
// transferência quando o navegador não tem menu de compartilhamento nativo.
import { SITE_NAME, SITE_URL, businessSubtitle } from './siteMeta.js';

export function absoluteUrl(path) {
    const origin = typeof window === 'undefined' ? SITE_URL : window.location.origin;
    return `${origin}${path}`;
}

// `*negrito*` é a sintaxe que o WhatsApp renderiza.
function buildMessage({ heading, subtitle, description, address, url }) {
    const lines = [subtitle ? `*${heading}* — ${subtitle}` : `*${heading}*`];

    if (description) {
        lines.push(description);
    }
    if (address) {
        lines.push('', `📍 ${address}`);
    }
    lines.push('', `Veja no ${SITE_NAME}:`, url);

    return lines.join('\n');
}

export function businessShare(business) {
    const url = absoluteUrl(`/negocio/${business.id}`);

    return {
        title: `${business.name} — ${SITE_NAME}`,
        url,
        message: buildMessage({
            heading: business.name,
            subtitle: businessSubtitle(business),
            description: business.description,
            address: business.address,
            url,
        }),
    };
}

export function beachShare(beach) {
    const url = absoluteUrl(`/mapa#${beach.id}`);

    return {
        title: `${beach.name} — ${SITE_NAME}`,
        url,
        message: buildMessage({ heading: beach.name, description: beach.description, url }),
    };
}

export function experienceShare(slug, experience) {
    const url = absoluteUrl(`/experiencia/${slug}`);

    return {
        title: `${experience.title} — ${SITE_NAME}`,
        url,
        message: buildMessage({
            heading: experience.title,
            subtitle: experience.eyebrow,
            description: experience.description,
            url,
        }),
    };
}
