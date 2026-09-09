// Negócios publicados, lidos do banco no momento do build.
//
// Até aqui, o sitemap, as páginas pré-renderizadas e as imagens de
// compartilhamento saíam de src/data/businesses.data.js. Esse arquivo deixou
// de mandar no site em 06/09/2026, quando /explorar passou a ler do Supabase —
// mas continuou mandando no que o Google e o WhatsApp enxergavam. As duas
// listas divergiram em silêncio: o sitemap anunciava 4 endereços que o app não
// encontrava e omitia 3 negócios que estavam no ar.
//
// Não existe verificador aqui de propósito. Vigia a gente esquece de olhar;
// com uma fonte só, divergir deixa de ser possível.

const SELECT = [
    'slug',
    'name',
    'description',
    'subcategory',
    'cover_image',
    'business_categories(is_primary,categories(slug))',
].join(',');

/**
 * @returns {Promise<Array|null>} a lista publicada, ou `null` quando o ambiente
 * não tem credencial do Supabase (build local sem .env). Quem chama decide o
 * que fazer com o `null` — aqui não se inventa lista vazia.
 */
export async function fetchPublishedBusinesses(env = process.env) {
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) return null;

    const endpoint =
        `${url}/rest/v1/businesses` +
        `?select=${encodeURIComponent(SELECT)}&status=eq.active&order=slug`;

    const response = await fetch(endpoint, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (!response.ok) {
        throw new Error(
            `Supabase respondeu ${response.status} ao listar os negócios publicados: ${await response.text()}`
        );
    }

    const rows = await response.json();

    // Zero negócio publicado com credencial válida é sintoma, não estado: já
    // aconteceu antes por GRANT faltando (ver CLAUDE.md). Publicar um sitemap
    // vazio esconderia isso por meses — melhor quebrar o build agora.
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(
            'O banco não devolveu nenhum negócio publicado. Build interrompido: ' +
                'seguir geraria um sitemap sem negócio nenhum.'
        );
    }

    return rows.map(toBusiness);
}

// Mesmo shape que mapBusinessRow entrega em runtime, para businessPageMeta
// servir aos dois — build e navegador — sem cada um ter o seu formato.
function toBusiness(row) {
    const links = [...row.business_categories].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary)
    );

    return {
        // As URLs (/negocio/:slug) e os nomes dos arquivos de preview usam o
        // slug, nunca o uuid.
        id: row.slug,
        name: row.name,
        description: row.description,
        subcategory: row.subcategory,
        categories: links.map((link) => link.categories.slug),
        image: row.cover_image,
    };
}
