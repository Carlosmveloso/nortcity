// Gera supabase/seed.sql a partir dos dados mockados em src/data/, para
// popular categories/businesses/business_categories preservando os ids
// atuais como slugs (não quebra as URLs /negocio/:slug já publicadas).

import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { rawBusinesses } from '../src/data/businesses.data.js';
import { categoryLabels } from '../src/data/categoryLabels.js';

function sqlString(value) {
    if (value === null || value === undefined || value === '') return 'null';
    return `'${String(value).replace(/'/g, "''")}'`;
}

const lines = [
    '-- Gerado por scripts/generate-supabase-seed.mjs — não editar à mão.',
    '-- Idempotente: pode ser aplicado várias vezes sem duplicar linhas.',
    '',
    '-- Categorias (fonte canônica: src/data/categoryLabels.js)',
];

const categorySlugs = Object.keys(categoryLabels);

categorySlugs.forEach((slug, index) => {
    const name = categoryLabels[slug];
    lines.push(
        `insert into public.categories (slug, name, order_index) values (${sqlString(slug)}, ${sqlString(name)}, ${index}) on conflict (slug) do nothing;`
    );
});

lines.push('', '-- Negócios extraídos de src/data/businesses.data.js (todos já públicos hoje).');

for (const business of rawBusinesses) {
    const businessId = randomUUID();

    lines.push(
        `insert into public.businesses (id, slug, name, subcategory, description, address, phone, whatsapp, instagram, website, status, owner_id) values (` +
            [
                sqlString(businessId),
                sqlString(business.id),
                sqlString(business.name),
                sqlString(business.subcategory),
                sqlString(business.description),
                sqlString(business.address),
                sqlString(business.phone),
                sqlString(business.phone),
                sqlString(business.instagram),
                sqlString(business.website),
                "'active'",
                'null',
            ].join(', ') +
            `) on conflict (slug) do nothing;`
    );

    business.categories.forEach((categorySlug, index) => {
        const isPrimary = index === 0;
        lines.push(
            `insert into public.business_categories (business_id, category_id, is_primary) ` +
                `select b.id, c.id, ${isPrimary} from public.businesses b, public.categories c ` +
                `where b.slug = ${sqlString(business.id)} and c.slug = ${sqlString(categorySlug)} ` +
                `on conflict (business_id, category_id) do nothing;`
        );
    });
}

const outputPath = new URL('../supabase/seed.sql', import.meta.url);
writeFileSync(outputPath, lines.join('\n') + '\n');

console.log(`supabase/seed.sql gerado com ${categorySlugs.length} categorias e ${rawBusinesses.length} negócios.`);
