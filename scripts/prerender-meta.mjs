// Gera um HTML por rota com as meta tags certas (Open Graph / Twitter).
// O site é uma SPA: sem isso, o crawler do WhatsApp — que não roda JavaScript —
// recebe sempre o index.html genérico e mostra o favicon como preview.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_NAME,
    SITE_URL,
    prerenderedRoutes,
} from '../src/lib/siteMeta.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildHead({ path, title, description, image, imageAlt }) {
    const url = `${SITE_URL}${path}`;
    const imageUrl = `${SITE_URL}${image}`;

    return [
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="description" content="${escapeHtml(description)}" />`,
        `<link rel="canonical" href="${escapeHtml(url)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
        `<meta property="og:locale" content="pt_BR" />`,
        `<meta property="og:url" content="${escapeHtml(url)}" />`,
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        `<meta property="og:description" content="${escapeHtml(description)}" />`,
        `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
        `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
        `<meta property="og:image:type" content="image/jpeg" />`,
        `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />`,
        `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />`,
        `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
        `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    ]
        .map((tag) => `    ${tag}`)
        .join('\n');
}

// Remove as tags padrão do index.html para não duplicá-las com as da rota.
function stripDefaultMeta(html) {
    return html
        .replace(/\s*<title>[\s\S]*?<\/title>/, '')
        .replace(/\s*<meta\s+(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*>/g, '')
        .replace(/\s*<link\s+rel="canonical"[^>]*>/g, '');
}

export async function prerenderMeta(distDir) {
    const template = await readFile(join(distDir, 'index.html'), 'utf8');
    const base = stripDefaultMeta(template);
    const routes = prerenderedRoutes();

    for (const route of routes) {
        const html = base.replace(/\s*<\/head>/, `\n${buildHead(route)}\n  </head>`);
        // Arquivo plano + "cleanUrls" na Vercel: /negocio/<slug> serve
        // negocio/<slug>.html, e o rewrite catch-all só pega o que sobrar.
        const outFile = join(distDir, `${route.path}.html`);

        await mkdir(dirname(outFile), { recursive: true });
        await writeFile(outFile, html);
    }

    return routes.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const count = await prerenderMeta(join(root, 'dist'));
    console.log(`Pré-renderizadas ${count} rotas com meta tags próprias.`);
}
