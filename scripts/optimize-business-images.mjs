import { readdirSync, unlinkSync } from 'node:fs';
import { extname, join, basename } from 'node:path';
import sharp from 'sharp';

const dir = new URL('../src/assets/businesses/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const files = readdirSync(dir).filter((file) => /\.(jpe?g|png)$/i.test(file));

for (const file of files) {
    const inputPath = join(dir, file);
    const outputPath = join(dir, `${basename(file, extname(file))}.webp`);

    await sharp(inputPath).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 72 }).toFile(outputPath);

    unlinkSync(inputPath);
    console.log(`${file} -> ${basename(outputPath)}`);
}

console.log(`Convertidas ${files.length} imagens para WebP.`);
