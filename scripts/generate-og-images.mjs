// Gera as imagens de preview (Open Graph) usadas ao compartilhar links.
// 1200x630 JPEG, porque o WhatsApp não renderiza WebP de forma confiável.
//
// As fotos dos negócios têm proporções muito diferentes (logos 150x150,
// retratos 640x1160), então em vez de recortar montamos um card: gradiente da
// marca ao fundo + a imagem inteira ("contain") centralizada.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { rawBeaches } from '../src/data/beaches.data.js';
import { experienceMeta } from '../src/data/experienceMeta.js';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '../src/lib/siteMeta.js';
import { fetchPublishedBusinesses } from './publishedBusinesses.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PADDING = 56;
const MAX_SCALE = 2.5;

const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}">
        <defs>
            <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0A4D68" />
                <stop offset="100%" stop-color="#05BFDB" />
            </linearGradient>
        </defs>
        <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#ocean)" />
    </svg>`
);

async function writeJpeg(image, outFile) {
    await writeFile(outFile, await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer());
}

// Foto grande o bastante para preencher o card: recorta e usa a imagem inteira.
async function coverCard(inputPath, outFile) {
    await writeJpeg(
        sharp(inputPath).resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, { fit: 'cover', position: 'attention' }),
        outFile
    );
}

// Foto pequena ou de proporção incomum: encaixa inteira sobre o gradiente.
// Limita a ampliação (MAX_SCALE) para os logos pequenos não virarem um borrão.
async function containCard(inputPath, { width, height }, outFile) {
    const boxWidth = Math.min(OG_IMAGE_WIDTH - PADDING * 2, Math.round(width * MAX_SCALE));
    const boxHeight = Math.min(OG_IMAGE_HEIGHT - PADDING * 2, Math.round(height * MAX_SCALE));

    const foreground = await sharp(inputPath)
        .resize(boxWidth, boxHeight, { fit: 'inside', withoutEnlargement: false })
        .toBuffer();

    await writeJpeg(
        sharp(gradient).composite([{ input: foreground, gravity: 'centre' }]),
        outFile
    );
}

// Só recorta quando sobra resolução: senão a foto perde as bordas E fica borrada.
// `input` é um caminho de arquivo (praias, experiências) ou um Buffer já
// baixado (capas dos negócios, que moram no Storage do Supabase).
async function buildCard(input, outFile) {
    const { width, height } = await sharp(input).metadata();
    const ratio = width / height;
    const wideEnough = width >= OG_IMAGE_WIDTH * 0.7 && height >= OG_IMAGE_HEIGHT * 0.7;
    const closeToTarget = ratio > 1.4 && ratio < 2.4;

    if (wideEnough && closeToTarget) {
        await coverCard(input, outFile);
        return;
    }

    await containCard(input, { width, height }, outFile);
}

async function downloadCover(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

// A capa de um negócio pode faltar (cadastro novo sem foto) ou não baixar
// (URL quebrada no Storage). Nos dois casos o card vira o genérico da marca:
// o link continua com preview, e um negócio só não derruba o deploy inteiro.
async function businessCard(business, defaultCard, outFile) {
    if (!business.image) {
        await copyFile(defaultCard, outFile);
        return { fallback: true };
    }

    try {
        await buildCard(await downloadCover(business.image), outFile);
        return { fallback: false };
    } catch (erro) {
        console.warn(`og: capa de "${business.id}" indisponível (${erro.message}) — usando o card padrão.`);
        await copyFile(defaultCard, outFile);
        return { fallback: true };
    }
}

export async function generateOgImages(outDir, businesses = []) {
    await mkdir(outDir, { recursive: true });

    // Negócios e praias dividem a pasta og/: um id repetido sobrescreveria a
    // imagem do outro e o link errado apareceria no WhatsApp.
    const ids = new Set(businesses.map((business) => business.id));
    const colisoes = rawBeaches.filter((beach) => ids.has(beach.id)).map((beach) => beach.id);

    if (colisoes.length > 0) {
        throw new Error(`id repetido entre negócio e praia: ${colisoes.join(', ')}`);
    }

    const defaultCard = join(outDir, 'default.jpg');
    await buildCard(join(root, 'public/hero-beach.jpg'), defaultCard);

    for (const business of businesses) {
        await businessCard(business, defaultCard, join(outDir, `${business.id}.jpg`));
    }

    for (const beach of rawBeaches) {
        await buildCard(
            join(root, 'src/assets/beaches', `${beach.id}.webp`),
            join(outDir, `${beach.id}.jpg`)
        );
    }

    for (const [slug, meta] of Object.entries(experienceMeta)) {
        await buildCard(join(root, 'src/assets/images', meta.image), join(outDir, `experiencia-${slug}.jpg`));
    }

    return businesses.length + rawBeaches.length + Object.keys(experienceMeta).length + 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const businesses = await fetchPublishedBusinesses();

    if (!businesses) {
        throw new Error(
            'Sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY no ambiente: não dá para saber quais negócios estão publicados.'
        );
    }

    const count = await generateOgImages(join(root, 'dist/og'), businesses);
    console.log(`Geradas ${count} imagens de compartilhamento em dist/og.`);
}
