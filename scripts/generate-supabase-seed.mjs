// Gera supabase/seed.sql a partir do banco, para montar um ambiente novo com o
// catálogo que está publicado hoje.
//
// Antes, este script lia src/data/businesses.data.js. O seed que saiu dele em
// 06/09/2026 era uma foto tirada antes de uma correção, e foi ele que
// republicou negócios que já tinham sido removidos — o mesmo sumiço, pela
// segunda vez. Um seed que copia um arquivo do repositório só descreve a
// verdade enquanto ninguém mexe no banco; lendo do banco, ele descreve o que
// existe no instante em que foi gerado.
//
// Por isso o arquivo gerado NÃO é aplicado automaticamente: [db.seed] está
// desligado no config.toml. Aplicar seed em banco que já tem dado é uma
// decisão, não um efeito colateral de `db push`.
//
// Uso: npm run generate-supabase-seed

import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);

function credenciais() {
    const raw = readFileSync(new URL('.env', ROOT), 'utf8');
    const ler = (chave) => raw.match(new RegExp(`^${chave}=(.*)$`, 'm'))?.[1]?.trim();
    const url = ler('VITE_SUPABASE_URL') ?? process.env.VITE_SUPABASE_URL;
    const key = ler('VITE_SUPABASE_ANON_KEY') ?? process.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes no .env');
    }

    return { url, key };
}

async function consultar(caminho) {
    const { url, key } = credenciais();
    const response = await fetch(`${url}/rest/v1/${caminho}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (!response.ok) {
        throw new Error(`Supabase respondeu ${response.status}: ${await response.text()}`);
    }

    return response.json();
}

function sqlString(value) {
    if (value === null || value === undefined || value === '') return 'null';
    return `'${String(value).replace(/'/g, "''")}'`;
}

const COLUNAS = [
    'slug',
    'name',
    'subcategory',
    'description',
    'address',
    'neighborhood',
    'service_area',
    'phone',
    'whatsapp',
    'email',
    'instagram',
    'website',
    'cover_image',
];

const categorias = await consultar('categories?select=slug,name,order_index&order=order_index');
const negocios = await consultar(
    `businesses?select=${COLUNAS.join(',')},business_categories(is_primary,categories(slug))` +
        '&status=eq.active&order=slug'
);

if (negocios.length === 0) {
    throw new Error('O banco não devolveu nenhum negócio publicado — seed não gerado.');
}

const lines = [
    '-- Gerado por scripts/generate-supabase-seed.mjs a partir do banco — não editar à mão.',
    `-- Instantâneo de ${new Date().toISOString().slice(0, 10)}: ${negocios.length} negócios publicados.`,
    '-- Idempotente: pode ser aplicado várias vezes sem duplicar linhas. Mas repare que',
    '-- `do nothing` não protege contra ressurreição: negócio apagado depois desta data',
    '-- volta se este arquivo for reaplicado. Gere de novo antes de usar.',
    '',
    '-- Categorias',
];

for (const categoria of categorias) {
    lines.push(
        `insert into public.categories (slug, name, order_index) values (` +
            `${sqlString(categoria.slug)}, ${sqlString(categoria.name)}, ${categoria.order_index}) ` +
            `on conflict (slug) do nothing;`
    );
}

lines.push('', '-- Negócios publicados');

for (const negocio of negocios) {
    lines.push(
        `insert into public.businesses (id, ${COLUNAS.join(', ')}, status, owner_id) values (` +
            [
                sqlString(randomUUID()),
                ...COLUNAS.map((coluna) => sqlString(negocio[coluna])),
                "'active'",
                'null',
            ].join(', ') +
            `) on conflict (slug) do nothing;`
    );

    const vinculos = [...negocio.business_categories].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary)
    );

    for (const vinculo of vinculos) {
        lines.push(
            `insert into public.business_categories (business_id, category_id, is_primary) ` +
                `select b.id, c.id, ${vinculo.is_primary} from public.businesses b, public.categories c ` +
                `where b.slug = ${sqlString(negocio.slug)} and c.slug = ${sqlString(vinculo.categories.slug)} ` +
                `on conflict (business_id, category_id) do nothing;`
        );
    }
}

writeFileSync(new URL('supabase/seed.sql', ROOT), lines.join('\n') + '\n');

console.log(
    `supabase/seed.sql gerado do banco com ${categorias.length} categorias e ${negocios.length} negócios.`
);
