// Catálogo publicado, lido do banco.
//
// É a mesma lista que /explorar mostra e que o build usa para montar o sitemap
// (scripts/publishedBusinesses.mjs). Home, /categorias e as páginas de
// experiência liam src/data/businesses.data.js — um arquivo que parou de mandar
// no site em 06/09/2026 e passou meses divergindo do banco em silêncio: a home
// contava 81 negócios com 80 publicados, e "onde comer" linkava para fichas que
// devolviam 404.
//
// As promessas ficam em cache no módulo: navegar entre as páginas não refaz a
// consulta. A home paga só a contagem — não o catálogo inteiro, que pesaria no
// LCP da primeira tela.

import { supabase } from '@/integrations/supabase/client';
import { BUSINESS_SELECT, mapBusinessRow } from '@/hooks/mapBusinessRow';

let countPromise = null;
let catalogPromise = null;

export function fetchPublishedCount() {
    countPromise ??= supabase
        .from('businesses')
        .select('slug', { count: 'exact', head: true })
        .eq('status', 'active')
        .then(({ count, error }) => {
            if (error) {
                // Erro não fica em cache: a próxima tela tenta de novo.
                countPromise = null;
                throw error;
            }

            return count ?? 0;
        });

    return countPromise;
}

export function fetchPublishedCatalog() {
    catalogPromise ??= supabase
        .from('businesses')
        .select(BUSINESS_SELECT)
        .eq('status', 'active')
        .order('name')
        .then(({ data, error }) => {
            if (error) {
                catalogPromise = null;
                throw error;
            }

            return (data ?? []).map(mapBusinessRow);
        });

    return catalogPromise;
}

// Conta quantos negócios publicados há em cada categoria, contando também as
// secundárias: um negócio em "construção" e "serviços" aparece nas duas listas
// de /categorias, e a contagem precisa dizer a mesma coisa que a listagem.
export function countByCategory(businesses) {
    const contagem = new Map();

    for (const business of businesses) {
        for (const slug of business.categories) {
            contagem.set(slug, (contagem.get(slug) ?? 0) + 1);
        }
    }

    return contagem;
}

// Só para os testes: o cache de módulo sobreviveria entre casos.
export function resetBusinessCatalogCache() {
    countPromise = null;
    catalogPromise = null;
}
