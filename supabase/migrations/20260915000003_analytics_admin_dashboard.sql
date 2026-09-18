-- Sprint 03 do Farol Analytics: a leitura.
--
-- As Sprints 01 e 02 coletam sete eventos e ninguém consegue olhar para eles
-- sem abrir o SQL Editor. Estas oito funções são o painel /admin/analytics:
-- toda a agregação acontece aqui, e o navegador recebe dezenas de linhas, não
-- dezenas de milhares.
--
-- Três decisões estruturais:
--
-- 1. SECURITY DEFINER não é escolha, é consequência.
--
-- `require_admin()` chama `farol_error()`, que teve execute revogado de PUBLIC
-- na migration 20260906000010. Uma função SECURITY INVOKER rodando como
-- `authenticated` morreria com "permission denied for function farol_error" —
-- e o teste src/test/db/function-privileges.test.js já barra esse padrão. Como
-- efeito colateral bem-vindo, rodar como dono faz o RLS de `businesses` não se
-- aplicar, que é o que permite ao painel mostrar o nome de um negócio suspenso
-- ou pendente.
--
-- 2. `search_path = ''` e tudo qualificado, como nas migrations 01 e 02.
--
-- 3. Entrada inválida levanta erro, ao contrário da coleta.
--
-- `analytics_track` engole entrada inválida porque roda nas costas de quem
-- navega e não pode quebrar o site. Aqui é o oposto: há um admin na frente da
-- tela esperando resposta, e período invertido ou dispositivo inexistente
-- precisam aparecer. Os códigos são estáveis em inglês com detalhe em PT-BR, o
-- contrato que src/lib/businessErrors.js já traduz.
--
-- Sem índice novo: todas as consultas filtram por event_type + created_at, que
-- é exatamente `analytics_events_type_created_idx`. O filtro por pathname vem
-- depois, sobre a fatia já reduzida do período. Ver a nota da migration
-- 20260915000001 sobre por que não existe índice em pathname.

-- ---------------------------------------------------------------------------
-- Visão geral
-- ---------------------------------------------------------------------------
--
-- Visitante e sessão saem de `analytics_events`, não de `analytics_sessions`.
-- Duas razões: todas as outras métricas recortam por `created_at` de evento,
-- então a mesma janela vale para o painel inteiro; e uma sessão pode existir
-- sem evento nenhum (o anúncio chegou, o visitante saiu antes de qualquer
-- ação), o que contaria como visitante sem atividade.
create or replace function public.analytics_overview(
    p_start_at timestamptz,
    p_end_at timestamptz
)
returns table (
    unique_visitors bigint,
    sessions bigint,
    page_views bigint,
    whatsapp_clicks bigint,
    business_views bigint,
    searches bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    return query
    select
        count(distinct e.anonymous_id),
        count(distinct e.session_id),
        count(*) filter (where e.event_type = 'page_view'),
        count(*) filter (where e.event_type = 'business_whatsapp_click'),
        count(*) filter (where e.event_type = 'business_view'),
        count(*) filter (where e.event_type = 'search')
      from public.analytics_events e
     where e.created_at >= p_start_at
       and e.created_at < p_end_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Páginas mais acessadas
-- ---------------------------------------------------------------------------
--
-- `pathname` é guardado sem query string desde a Sprint 01, então o agrupamento
-- é direto. Rota dinâmica continua separada (/negocio/asenza-beach e
-- /negocio/kasa-da-falesia são duas linhas) — agrupar em /negocio/:slug é
-- decisão de produto para depois, e a consulta não impede.
create or replace function public.analytics_top_pages(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_limit int default 10
)
returns table (
    pathname text,
    views bigint,
    unique_visitors bigint,
    sessions bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    -- Clampado, como `search_businesses` já faz: limite absurdo vira o teto, em
    -- vez de derrubar a tela com erro.
    v_limit int := greatest(1, least(coalesce(p_limit, 10), 100));
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    return query
    select
        e.pathname,
        count(*),
        count(distinct e.anonymous_id),
        count(distinct e.session_id)
      from public.analytics_events e
     where e.event_type = 'page_view'
       and e.created_at >= p_start_at
       and e.created_at < p_end_at
       and e.pathname is not null
     group by e.pathname
     order by count(*) desc, e.pathname
     limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Negócios mais vistos
-- ---------------------------------------------------------------------------
--
-- `left join` de propósito: negócio apagado pelo admin continua tendo
-- histórico, e descartar a linha faria a soma do painel não bater com a visão
-- geral. Aparece como "Negócio removido", sem slug.
--
-- Um negócio pode ter clique de WhatsApp sem nenhuma visualização: o botão do
-- BusinessCard em /explorar dispara sem abrir a ficha. Por isso a taxa só é
-- calculada quando há visualização — e é taxa simples de clique por
-- visualização, não inferência de conversão.
create or replace function public.analytics_top_businesses(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_limit int default 10
)
returns table (
    business_id uuid,
    business_name text,
    business_slug text,
    views bigint,
    whatsapp_clicks bigint,
    unique_visitors bigint,
    whatsapp_rate numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_limit int := greatest(1, least(coalesce(p_limit, 10), 100));
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    return query
    with eventos as (
        select
            e.entity_id as id,
            count(*) filter (where e.event_type = 'business_view') as total_views,
            count(*) filter (where e.event_type = 'business_whatsapp_click') as total_clicks,
            count(distinct e.anonymous_id) as total_visitors
          from public.analytics_events e
         where e.event_type in ('business_view', 'business_whatsapp_click')
           and e.entity_type = 'business'
           and e.entity_id is not null
           and e.created_at >= p_start_at
           and e.created_at < p_end_at
         group by e.entity_id
    )
    select
        ev.id,
        coalesce(b.name, 'Negócio removido'),
        b.slug,
        ev.total_views,
        ev.total_clicks,
        ev.total_visitors,
        case
            when ev.total_views > 0
            then round(ev.total_clicks * 100.0 / ev.total_views, 1)
        end
      from eventos ev
      left join public.businesses b on b.id = ev.id
     order by ev.total_views desc, ev.total_clicks desc, coalesce(b.name, '')
     limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pesquisas mais realizadas
-- ---------------------------------------------------------------------------
--
-- O agrupamento usa `normalize_search`, a mesma função que /explorar usa para
-- buscar: "Restaurante", "restaurante" e "RESTAURANTE" caem juntos, e "café"
-- cai com "cafe". O texto legível volta em `query_sample`, porque o
-- normalizado perde acento e caixa.
--
-- `resultsCount` é lido com guarda de tipo: linha forjada ou de formato antigo
-- não pode derrubar a consulta inteira com erro de cast.
create or replace function public.analytics_top_searches(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_limit int default 20
)
returns table (
    query_normalized text,
    query_sample text,
    searches bigint,
    avg_results numeric,
    zero_result_searches bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    return query
    with buscas as (
        select
            public.normalize_search(btrim(e.metadata ->> 'query')) as termo,
            btrim(e.metadata ->> 'query') as original,
            case
                when jsonb_typeof(e.metadata -> 'resultsCount') = 'number'
                then (e.metadata ->> 'resultsCount')::numeric
            end as resultados
          from public.analytics_events e
         where e.event_type = 'search'
           and e.created_at >= p_start_at
           and e.created_at < p_end_at
           and coalesce(btrim(e.metadata ->> 'query'), '') <> ''
    )
    select
        b.termo,
        min(b.original),
        count(*),
        round(avg(b.resultados), 1),
        count(*) filter (where b.resultados = 0)
      from buscas b
     group by b.termo
     order by count(*) desc, b.termo
     limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Elementos mais clicados
-- ---------------------------------------------------------------------------
--
-- Conta clique de teclado também: ele não tem coordenada e fica de fora do
-- mapa, mas a interação aconteceu e vale na contagem.
create or replace function public.analytics_top_elements(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_pathname text default null,
    p_device_type text default null,
    p_limit int default 20
)
returns table (
    element text,
    clicks bigint,
    unique_visitors bigint,
    sessions bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    if p_device_type is not null and p_device_type not in ('mobile', 'tablet', 'desktop') then
        perform public.farol_error('invalid_device_type', 'Dispositivo inválido.');
    end if;

    return query
    select
        e.metadata ->> 'element',
        count(*),
        count(distinct e.anonymous_id),
        count(distinct e.session_id)
      from public.analytics_events e
     where e.event_type = 'element_click'
       and e.created_at >= p_start_at
       and e.created_at < p_end_at
       and coalesce(e.metadata ->> 'element', '') <> ''
       and (p_pathname is null or e.pathname = p_pathname)
       and (p_device_type is null or e.device_type = p_device_type)
     group by e.metadata ->> 'element'
     order by count(*) desc, e.metadata ->> 'element'
     limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mapa de cliques
-- ---------------------------------------------------------------------------
--
-- Agregado em balde de 20 colunas por 30 linhas. Devolver clique individual
-- mandaria milhares de linhas ao navegador para desenhar a mesma imagem.
--
-- O clamp em 0.9999 não é detalhe: x = 1.0 daria floor(1.0 * 20) = 20, um
-- vigésimo-primeiro balde numa faixa de 0 a 19 — e o ponto do canto direito
-- sairia da tela. O retorno é o CENTRO do balde, não a borda.
--
-- Clique sem coordenada (teclado) fica de fora pela guarda de tipo.
create or replace function public.analytics_click_heatmap(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_pathname text,
    p_device_type text default null
)
returns table (
    x numeric,
    y numeric,
    clicks bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_cols int := 20;
    v_rows int := 30;
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    if coalesce(btrim(p_pathname), '') = '' then
        perform public.farol_error('pathname_required', 'Selecione uma página.');
    end if;

    if p_device_type is not null and p_device_type not in ('mobile', 'tablet', 'desktop') then
        perform public.farol_error('invalid_device_type', 'Dispositivo inválido.');
    end if;

    return query
    with pontos as (
        select
            floor(least(greatest((e.metadata ->> 'x_percent')::numeric, 0), 0.9999) * v_cols)::int as bucket_x,
            floor(least(greatest((e.metadata ->> 'y_percent')::numeric, 0), 0.9999) * v_rows)::int as bucket_y
          from public.analytics_events e
         where e.event_type = 'element_click'
           and e.created_at >= p_start_at
           and e.created_at < p_end_at
           and e.pathname = p_pathname
           and (p_device_type is null or e.device_type = p_device_type)
           and jsonb_typeof(e.metadata -> 'x_percent') = 'number'
           and jsonb_typeof(e.metadata -> 'y_percent') = 'number'
    )
    select
        round((p.bucket_x + 0.5) / v_cols, 4),
        round((p.bucket_y + 0.5) / v_rows, 4),
        count(*)
      from pontos p
     group by p.bucket_x, p.bucket_y
     order by count(*) desc, p.bucket_y, p.bucket_x;
end;
$$;

-- ---------------------------------------------------------------------------
-- Páginas que têm mapa de cliques
-- ---------------------------------------------------------------------------
--
-- Alimenta o seletor do heatmap. Existe separada de `analytics_top_pages`
-- porque aquela lista páginas com visualização, e a maioria delas não tem um
-- único clique com coordenada — o seletor ficaria cheio de opção vazia.
create or replace function public.analytics_heatmap_pages(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_device_type text default null,
    p_limit int default 50
)
returns table (
    pathname text,
    clicks bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    if p_device_type is not null and p_device_type not in ('mobile', 'tablet', 'desktop') then
        perform public.farol_error('invalid_device_type', 'Dispositivo inválido.');
    end if;

    return query
    select
        e.pathname,
        count(*)
      from public.analytics_events e
     where e.event_type = 'element_click'
       and e.created_at >= p_start_at
       and e.created_at < p_end_at
       and e.pathname is not null
       and (p_device_type is null or e.device_type = p_device_type)
       and jsonb_typeof(e.metadata -> 'x_percent') = 'number'
     group by e.pathname
     order by count(*) desc, e.pathname
     limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funil de rolagem
-- ---------------------------------------------------------------------------
--
-- Numerador: eventos de scroll_depth por marco. Denominador: page views da
-- mesma página, período e dispositivo.
--
-- A unidade correta seria "visualização de página", que não existe como id
-- próprio no modelo. A aproximação funciona porque a Sprint 02 registra cada
-- marco uma vez por visualização e reinicia o conjunto a cada page view — os
-- dois lados contam a mesma coisa. O que o número NÃO captura: página sem
-- rolagem relevante não gera scroll_depth nenhum (decisão da Sprint 02), então
-- página curta aparece com funil zerado, e isso é ausência de rolagem, não
-- ausência de leitura.
--
-- Os cinco marcos voltam sempre, mesmo sem dado: a tela não precisa inventar
-- linha faltante.
create or replace function public.analytics_scroll_funnel(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_pathname text,
    p_device_type text default null
)
returns table (
    depth int,
    reached bigint,
    page_views bigint,
    rate numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    if coalesce(btrim(p_pathname), '') = '' then
        perform public.farol_error('pathname_required', 'Selecione uma página.');
    end if;

    if p_device_type is not null and p_device_type not in ('mobile', 'tablet', 'desktop') then
        perform public.farol_error('invalid_device_type', 'Dispositivo inválido.');
    end if;

    return query
    with visualizacoes as (
        select count(*) as total
          from public.analytics_events e
         where e.event_type = 'page_view'
           and e.created_at >= p_start_at
           and e.created_at < p_end_at
           and e.pathname = p_pathname
           and (p_device_type is null or e.device_type = p_device_type)
    ),
    marcos as (
        select
            (e.metadata ->> 'depth')::int as marco,
            count(*) as total
          from public.analytics_events e
         where e.event_type = 'scroll_depth'
           and e.created_at >= p_start_at
           and e.created_at < p_end_at
           and e.pathname = p_pathname
           and (p_device_type is null or e.device_type = p_device_type)
           and jsonb_typeof(e.metadata -> 'depth') = 'number'
         group by (e.metadata ->> 'depth')::int
    )
    select
        esperados.valor,
        coalesce(k.total, 0),
        v.total,
        case
            when v.total > 0
            then round(coalesce(k.total, 0) * 100.0 / v.total, 1)
        end
      from unnest(array[25, 50, 75, 90, 100]) as esperados(valor)
      left join marcos k on k.marco = esperados.valor
      cross join visualizacoes v
     order by esperados.valor;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------
--
-- Função nasce com EXECUTE para PUBLIC; sem o revoke, conceder a `authenticated`
-- não restringe nada. `anon` não recebe nada: mesmo que recebesse, o
-- require_admin() barraria — mas a porta fica fechada nas duas camadas.
revoke all on function public.analytics_overview(timestamptz, timestamptz) from public;
revoke all on function public.analytics_top_pages(timestamptz, timestamptz, int) from public;
revoke all on function public.analytics_top_businesses(timestamptz, timestamptz, int) from public;
revoke all on function public.analytics_top_searches(timestamptz, timestamptz, int) from public;
revoke all on function public.analytics_top_elements(timestamptz, timestamptz, text, text, int) from public;
revoke all on function public.analytics_click_heatmap(timestamptz, timestamptz, text, text) from public;
revoke all on function public.analytics_heatmap_pages(timestamptz, timestamptz, text, int) from public;
revoke all on function public.analytics_scroll_funnel(timestamptz, timestamptz, text, text) from public;

grant execute on function public.analytics_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_top_pages(timestamptz, timestamptz, int) to authenticated;
grant execute on function public.analytics_top_businesses(timestamptz, timestamptz, int) to authenticated;
grant execute on function public.analytics_top_searches(timestamptz, timestamptz, int) to authenticated;
grant execute on function public.analytics_top_elements(timestamptz, timestamptz, text, text, int) to authenticated;
grant execute on function public.analytics_click_heatmap(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.analytics_heatmap_pages(timestamptz, timestamptz, text, int) to authenticated;
grant execute on function public.analytics_scroll_funnel(timestamptz, timestamptz, text, text) to authenticated;
