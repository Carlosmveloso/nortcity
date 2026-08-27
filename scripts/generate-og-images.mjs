// Gera as imagens de preview (Open Graph) usadas ao compartilhar links.
// 1200x630 JPEG, porque o WhatsApp não renderiza WebP de forma confiável.
//
// As fotos dos negócios têm proporções muito diferentes (logos 150x150,
// retratos 640x1160), então em vez de recortar montamos um card: gradiente da
// marca ao fundo + a imagem inteira ("contain") centralizada.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { rawBusinesses } from '../src/data/businesses.data.js';
import { experienceMeta } from '../src/data/experienceMeta.js';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '../src/lib/siteMeta.js';

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
async function buildCard(inputPath, outFile) {
    const { width, height } = await sharp(inputPath).metadata();
    const ratio = width / height;
    const wideEnough = width >= OG_IMAGE_WIDTH * 0.7 && height >= OG_IMAGE_HEIGHT * 0.7;
    const closeToTarget = ratio > 1.4 && ratio < 2.4;

    if (wideEnough && closeToTarget) {
        await coverCard(inputPath, outFile);
        return;
    }

    await containCard(inputPath, { width, height }, outFile);
}

export async function generateOgImages(outDir) {
    await mkdir(outDir, { recursive: true });

    await buildCard(join(root, 'public/hero-beach.jpg'), join(outDir, 'default.jpg'));

    for (const business of rawBusinesses) {
        await buildCard(
            join(root, 'src/assets/businesses', `${business.id}.webp`),
            join(outDir, `${business.id}.jpg`)
        );
    }

    for (const [slug, meta] of Object.entries(experienceMeta)) {
        await buildCard(join(root, 'src/assets/images', meta.image), join(outDir, `experiencia-${slug}.jpg`));
    }

    return rawBusinesses.length + Object.keys(experienceMeta).length + 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const count = await generateOgImages(join(root, 'dist/og'));
    console.log(`Geradas ${count} imagens de compartilhamento em dist/og.`);
}
