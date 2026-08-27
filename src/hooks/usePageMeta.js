import { useEffect } from 'react';
import {
    DEFAULT_DESCRIPTION,
    DEFAULT_OG_IMAGE,
    DEFAULT_TITLE,
    SITE_URL,
} from '../lib/siteMeta';

function setMeta(selector, attribute, name, content) {
    let tag = document.head.querySelector(selector);

    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, name);
        document.head.appendChild(tag);
    }

    tag.setAttribute('content', content);
}

function setCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');

    if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
    }

    link.setAttribute('href', url);
}

// `noindex` só existe nas páginas de conta: nas demais a tag é removida para não
// sobrar de uma navegação anterior dentro da SPA.
function setRobots(noindex) {
    const tag = document.head.querySelector('meta[name="robots"]');

    if (!noindex) {
        tag?.remove();
        return;
    }

    setMeta('meta[name="robots"]', 'name', 'robots', 'noindex, follow');
}

// Os crawlers já recebem o HTML pré-renderizado (scripts/prerender-meta.mjs);
// isto mantém título, meta tags e canonical corretos na navegação dentro da SPA.
export function usePageMeta(meta) {
    const { title, description, image, path, noindex } = meta ?? {};

    useEffect(() => {
        const pageTitle = title ?? DEFAULT_TITLE;
        const pageDescription = description ?? DEFAULT_DESCRIPTION;
        const url = `${SITE_URL}${path ?? '/'}`;
        const imageUrl = `${SITE_URL}${image ?? DEFAULT_OG_IMAGE}`;

        document.title = pageTitle;
        setMeta('meta[name="description"]', 'name', 'description', pageDescription);
        setMeta('meta[property="og:title"]', 'property', 'og:title', pageTitle);
        setMeta('meta[property="og:description"]', 'property', 'og:description', pageDescription);
        setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
        setMeta('meta[property="og:url"]', 'property', 'og:url', url);
        setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle);
        setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', pageDescription);
        setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);
        setCanonical(url);
        setRobots(noindex);
    }, [title, description, image, path, noindex]);
}
