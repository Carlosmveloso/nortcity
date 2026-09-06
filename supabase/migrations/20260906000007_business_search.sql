-- BUS-02/BUS-03 — ordenação e filtros no servidor.
--
-- Antes, /explorar baixava todos os negócios ativos e ordenava/filtrava no
-- cliente: a ordem era a que o Postgres devolvesse (sem ORDER BY), a busca
-- olhava só nome e descrição, e o "carregar mais" paginava uma lista já
-- inteira na memória. Aqui a ordenação e a paginação valem sobre o conjunto
-- inteiro de resultados.
--
-- Prioridade de relevância (decisão de produto): nome → categoria primária →
-- categorias secundárias → descrição → bairro/localização. Sem texto de busca,
-- ordem alfabética pelo nome, inclusive dentro de categoria. Desempate sempre
-- pelo nome normalizado e depois pelo id, para a ordem não mudar entre páginas.
-- Não há promoção por data de cadastro, origem, completude ou plano.
--
-- As funções são SECURITY INVOKER de propósito: o RLS de `businesses` continua
-- sendo a autoridade sobre o que é público, então nem a busca nem a paginação
-- conseguem vazar negócio pendente, rejeitado ou suspenso.

create or replace function public.search_businesses(
    p_query text default null,
    p_category_slug text default null,
    p_neighborhood text default null,
    p_price_range text default null,
    p_limit int default 12,
    p_offset int default 0
)
returns table (
    id uuid,
    slug text,
    name text,
    subcategory text,
    description text,
    address text,
    neighborhood text,
    service_area text,
    phone text,
    whatsapp text,
    email text,
    instagram text,
    website text,
    cover_image text,
    categories text[],
    category_names text[],
    primary_category text,
    total_count bigint
)
language sql
stable
as $$
    with params as (
        select
            nullif(public.normalize_search(btrim(coalesce(p_query, ''))), '') as q,
            greatest(1, least(coalesce(p_limit, 12), 60)) as lim,
            greatest(0, coalesce(p_offset, 0)) as off
    ),
    base as (
        select
            b.id, b.slug, b.name, b.subcategory, b.description, b.address, b.neighborhood,
            b.service_area, b.phone, b.whatsapp, b.email, b.instagram, b.website, b.cover_image,
            b.price_range,
            (select array_agg(c.slug order by bc.is_primary desc, c.name)
               from public.business_categories bc
               join public.categories c on c.id = bc.category_id
              where bc.business_id = b.id) as categories,
            (select array_agg(c.name order by bc.is_primary desc, c.name)
               from public.business_categories bc
               join public.categories c on c.id = bc.category_id
              where bc.business_id = b.id) as category_names,
            (select c.slug
               from public.business_categories bc
               join public.categories c on c.id = bc.category_id
              where bc.business_id = b.id and bc.is_primary
              limit 1) as primary_category,
            (select public.normalize_search(string_agg(c.name || ' ' || c.slug, ' '))
               from public.business_categories bc
               join public.categories c on c.id = bc.category_id
              where bc.business_id = b.id and bc.is_primary) as primary_text,
            (select public.normalize_search(string_agg(c.name || ' ' || c.slug, ' '))
               from public.business_categories bc
               join public.categories c on c.id = bc.category_id
              where bc.business_id = b.id and not bc.is_primary) as secondary_text
        from public.businesses b
        where b.status = 'active'
    ),
    filtered as (
        -- Filtros de dimensões diferentes são cumulativos. Categoria casa
        -- tanto na primária quanto nas secundárias: categoria secundária
        -- também torna o negócio encontrável (BUS-03).
        select base.* from base
        where (p_category_slug is null or p_category_slug = any(coalesce(base.categories, '{}')))
          and (p_neighborhood is null
               or public.normalize_search(coalesce(base.neighborhood, '')) = public.normalize_search(p_neighborhood))
          and (p_price_range is null or base.price_range = p_price_range)
    ),
    ranked as (
        select
            filtered.*,
            case
                when params.q is null then 0
                when position(params.q in public.normalize_search(filtered.name)) > 0 then 1
                when position(params.q in coalesce(filtered.primary_text, '')) > 0 then 2
                when position(params.q in coalesce(filtered.secondary_text, '')) > 0 then 3
                when position(params.q in public.normalize_search(coalesce(filtered.description, ''))) > 0 then 4
                when position(params.q in public.normalize_search(
                        coalesce(filtered.neighborhood, '') || ' ' ||
                        coalesce(filtered.address, '') || ' ' ||
                        coalesce(filtered.service_area, ''))) > 0 then 5
                else null
            end as relevance
        from filtered, params
    )
    select
        ranked.id, ranked.slug, ranked.name, ranked.subcategory, ranked.description,
        ranked.address, ranked.neighborhood, ranked.service_area, ranked.phone, ranked.whatsapp,
        ranked.email, ranked.instagram, ranked.website, ranked.cover_image,
        ranked.categories, ranked.category_names, ranked.primary_category,
        count(*) over () as total_count
    from ranked, params
    where ranked.relevance is not null
    order by ranked.relevance, public.normalize_search(ranked.name), ranked.id
    offset (select off from params)
    limit (select lim from params);
$$;

-- Alimenta o filtro de bairro de /explorar com os bairros que existem de
-- verdade entre os negócios publicados.
create or replace function public.business_neighborhoods()
returns table (neighborhood text, total bigint)
language sql
stable
as $$
    select b.neighborhood, count(*)
      from public.businesses b
     where b.status = 'active'
       and coalesce(btrim(b.neighborhood), '') <> ''
     group by b.neighborhood
     order by public.normalize_search(b.neighborhood);
$$;
