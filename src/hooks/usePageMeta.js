import { useEffect } from 'react';
import {
    DEFAULT_DESCRIPTION,
    DEFAULT_OG_IMAGE,
    DEFAULT_TITLE,
    SITE_URL,
} from '../lib/siteMeta';

function setTag(selector, attribute, name, content) {
    let tag = document.head.querySelector(selector);

    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, name);
        document.head.appendChild(tag);
    }

    tag.setAttribute('content', content);
}

function applyMeta({ title, description, image, url }) {
    document.title = title;
    setTag('meta[name="description"]', 'name', 'description', description);
    setTag('meta[property="og:title"]', 'property', 'og:title', title);
    setTag('meta[property="og:description"]', 'property', 'og:description', description);
    setTag('meta[property="og:image"]', 'property', 'og:image', image);
    setTag('meta[property="og:url"]', 'property', 'og:url', url);
}

// Os crawlers já recebem o HTML pré-renderizado (scripts/prerender-meta.mjs);
// isto só mantém título e meta tags corretos na navegação dentro da SPA.
export function usePageMeta(meta) {
    const { title, description, image, path } = meta ?? {};

    useEffect(() => {
        if (!title) {
            return undefined;
        }

        applyMeta({
            title,
            description,
            image: `${SITE_URL}${image}`,
            url: `${SITE_URL}${path}`,
        });

        return () => {
            applyMeta({
                title: DEFAULT_TITLE,
                description: DEFAULT_DESCRIPTION,
                image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
                url: `${SITE_URL}/`,
            });
        };
    }, [title, description, image, path]);
}
