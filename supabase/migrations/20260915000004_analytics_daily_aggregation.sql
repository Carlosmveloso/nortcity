-- Sprint 04 do Farol Analytics: agregação diária, backfill e saúde.
--
-- Hoje toda leitura do painel varre `analytics_events`. Funciona no volume
-- atual; não funciona daqui a um ano. Esta migration cria a camada agregada por
-- dia, o backfill idempotente e a visão de saúde.
--
-- FONTE DE VERDADE: `analytics_events`. As tabelas `analytics_daily_*` são
-- cache derivado — podem ser apagadas inteiras e reconstruídas pelo backfill sem
-- perda nenhuma. Nunca o contrário. Uma falha de agregação não toca em evento
-- bruto, e é por isso que o delete+insert diário é seguro.
--
-- O QUE NÃO ENTRA NO AGREGADO: contagem de distintos. Somar "visitantes únicos
-- do dia 1" com "visitantes únicos do dia 2" não dá "visitantes únicos do
-- período" — a mesma pessoa nos dois dias seria contada duas vezes. Visitantes e
-- sessões continuam saindo de `analytics_events`, e por isso as RPCs que os
-- devolvem continuam brutas: elas já precisam varrer o período inteiro para o
-- distinct, e o `count(*)` sai de graça na mesma varredura.

-- ---------------------------------------------------------------------------
-- Tabela 1: métricas de dimensão textual
-- ---------------------------------------------------------------------------
--
-- Uma tabela para as quatro métricas em vez de quatro tabelas: as consultas têm
-- a mesma forma (igualdade em `metric`, faixa em `stat_date`, group by de uma
-- dimensão), e quatro tabelas quase idênticas custariam quatro conjuntos de
-- índices e quatro caminhos na agregação.
--
-- Dimensão que a métrica não usa guarda '' ou 0, NUNCA null. É isso que permite
-- a chave primária natural funcionar sem depender de `nulls not distinct`: o
-- risco clássico é a unicidade silenciosamente não valer porque null nunca é
-- igual a null. Aqui a PK É a chave lógica, e é o alvo determinístico do
-- delete+insert.
create table public.analytics_daily_stats (
    stat_date date not null,
    metric text not null,
    device_type text not null,
    pathname text not null default '',
    element text not null default '',
    query_normalized text not null default '',
    scroll_depth int not null default 0,

    -- Medidas. Esparsas de propósito: cada métrica preenche as suas e deixa o
    -- resto em zero, que é mais barato e muito mais simples de consultar do que
    -- uma tabela por métrica.
    events bigint not null default 0,
    positioned_events bigint not null default 0,
    query_sample text not null default '',
    results_total bigint not null default 0,
    results_events bigint not null default 0,
    zero_results bigint not null default 0,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint analytics_daily_stats_metric_check check (metric in (
        'page_views', 'element_clicks', 'scroll_depth', 'searches'
    )),
    constraint analytics_daily_stats_device_check check (
        device_type in ('mobile', 'tablet', 'desktop', 'unknown')
    ),
    constraint analytics_daily_stats_depth_check check (
        scroll_depth in (0, 25, 50, 75, 90, 100)
    ),
    -- `metric` na frente porque é sempre igualdade; `stat_date` em segundo
    -- porque é sempre faixa. Nenhum índice extra é necessário hoje.
    primary key (metric, stat_date, device_type, pathname, element, query_normalized, scroll_depth)
);

-- ---------------------------------------------------------------------------
-- Tabela 2: negócios
-- ---------------------------------------------------------------------------
--
-- Tabela própria por dois motivos concretos. `business_id` é uuid e não caberia
-- no esquema de '' da tabela acima sem reintroduzir null na chave. E o painel do
-- proprietário (Sprint 05) vai consultar por negócio, não por período — o que
-- exige um índice com `business_id` na frente.
--
-- SEM chave estrangeira para `businesses`, de propósito: o histórico precisa
-- sobreviver à exclusão do negócio. O painel já mostra "Negócio removido", e um
-- `on delete set null` destruiria exatamente a associação que dá sentido à linha.
create table public.analytics_daily_business_stats (
    stat_date date not null,
    business_id uuid not null,
    device_type text not null,
    views bigint not null default 0,
    whatsapp_clicks bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint analytics_daily_business_stats_device_check check (
        device_type in ('mobile', 'tablet', 'desktop', 'unknown')
    ),
    primary key (stat_date, business_id, device_type)
);

-- O único índice criado por antecipação nesta migration, e com requisito
-- explícito: "views e cliques deste negócio ao longo do tempo". A PK serve a
-- consulta por período, não a consulta por negócio. O custo de escrita é uma
-- linha por negócio, dispositivo e dia.
create index analytics_daily_business_stats_business_idx
    on public.analytics_daily_business_stats (business_id, stat_date desc);

-- ---------------------------------------------------------------------------
-- Tabela 3: o que já foi processado
-- ---------------------------------------------------------------------------
--
-- `max(stat_date)` das tabelas acima quase resolve, e por isso quase não criei
-- esta tabela. Dois problemas concretos decidiram:
--
-- 1. Dia sem evento nenhum não deixa linha em lugar nenhum. Num site do tamanho
--    do Farol isso acontece, e "última agregação" mentiria toda vez que o último
--    dia fosse vazio.
--
-- 2. Pior: sem saber quais dias foram processados, o painel híbrido somaria
--    agregado + bruto com um buraco no meio e devolveria um número menor, sem
--    erro e sem aviso. É a pior classe de defeito de dados. Com esta tabela, a
--    RPC confere se a janela inteira foi processada e, na dúvida, usa bruto.
create table public.analytics_daily_aggregation (
    stat_date date primary key,
    aggregated_at timestamptz not null default now(),
    events_seen bigint not null default 0,
    rows_written bigint not null default 0
);

-- ---------------------------------------------------------------------------
-- RLS e privilégios das tabelas
-- ---------------------------------------------------------------------------
--
-- Mesmo desenho das tabelas de evento: leitura só para admin, escrita para
-- ninguém. O navegador não escreve agregado — quem escreve é a função de
-- agregação, que roda como dono e não passa por policy.
alter table public.analytics_daily_stats enable row level security;
alter table public.analytics_daily_business_stats enable row level security;
alter table public.analytics_daily_aggregation enable row level security;

create policy "analytics_daily_stats_select_admin"
    on public.analytics_daily_stats for select
    using (public.has_role(auth.uid(), 'admin'));

create policy "analytics_daily_business_stats_select_admin"
    on public.analytics_daily_business_stats for select
    using (public.has_role(auth.uid(), 'admin'));

create policy "analytics_daily_aggregation_select_admin"
    on public.analytics_daily_aggregation for select
    using (public.has_role(auth.uid(), 'admin'));

grant select on public.analytics_daily_stats to authenticated;
grant select on public.analytics_daily_business_stats to authenticated;
grant select on public.analytics_daily_aggregation to authenticated;

-- ---------------------------------------------------------------------------
-- Agregação de um dia
-- ---------------------------------------------------------------------------
--
-- FUSO: America/Fortaleza, o fuso IANA da Paraíba, UTC-03 e sem horário de
-- verão desde 2019. Assumir UTC jogaria a madrugada brasileira para o dia
-- seguinte e entortaria todo relatório diário — 21h de um sábado em Pitimbu
-- viraria domingo.
--
-- IDEMPOTÊNCIA: delete do dia + insert, na mesma transação. Rodar duas vezes dá
-- o mesmo resultado; evento que chegou atrasado entra na reexecução. É também o
-- que torna a tabela reconstruível do zero.
--
-- Esta é a função INTERNA: sem grant para ninguém, executável apenas pelo dono.
-- É o ponto de entrada que um agendador (pg_cron roda como postgres) usará sem
-- precisar de `auth.uid()`, que ele não tem.
create or replace function public.analytics_aggregate_day_internal(p_date date)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_zone constant text := 'America/Fortaleza';
    v_starts_at timestamptz := (p_date::timestamp) at time zone v_zone;
    v_ends_at timestamptz := ((p_date + 1)::timestamp) at time zone v_zone;
    v_rows bigint := 0;
    v_written bigint;
    v_seen bigint;
begin
    if p_date is null then
        perform public.farol_error('invalid_period', 'Informe a data a agregar.');
    end if;

    -- Duas agregações do mesmo dia se serializam em vez de colidirem na chave
    -- primária. O primeiro número é só um espaço de nomes arbitrário.
    perform pg_advisory_xact_lock(48151623, (p_date - date '2000-01-01'));

    delete from public.analytics_daily_stats where stat_date = p_date;
    delete from public.analytics_daily_business_stats where stat_date = p_date;

    insert into public.analytics_daily_stats
        (stat_date, metric, device_type, pathname, events)
    select p_date, 'page_views', coalesce(e.device_type, 'unknown'), coalesce(e.pathname, ''), count(*)
      from public.analytics_events e
     where e.event_type = 'page_view'
       and e.created_at >= v_starts_at and e.created_at < v_ends_at
     group by coalesce(e.device_type, 'unknown'), coalesce(e.pathname, '');
    get diagnostics v_written = row_count;
    v_rows := v_rows + v_written;

    -- `positioned_events` separa o clique que tem coordenada do que não tem
    -- (teclado). Sem essa distinção, o seletor de páginas do heatmap ofereceria
    -- páginas onde o mapa sai vazio.
    insert into public.analytics_daily_stats
        (stat_date, metric, device_type, pathname, element, events, positioned_events)
    select p_date,
           'element_clicks',
           coalesce(e.device_type, 'unknown'),
           coalesce(e.pathname, ''),
           left(e.metadata ->> 'element', 80),
           count(*),
           count(*) filter (
               where jsonb_typeof(e.metadata -> 'x_percent') = 'number'
                 and jsonb_typeof(e.metadata -> 'y_percent') = 'number'
           )
      from public.analytics_events e
     where e.event_type = 'element_click'
       and e.created_at >= v_starts_at and e.created_at < v_ends_at
       and coalesce(e.metadata ->> 'element', '') <> ''
     group by coalesce(e.device_type, 'unknown'), coalesce(e.pathname, ''), left(e.metadata ->> 'element', 80);
    get diagnostics v_written = row_count;
    v_rows := v_rows + v_written;

    insert into public.analytics_daily_stats
        (stat_date, metric, device_type, pathname, scroll_depth, events)
    select p_date,
           'scroll_depth',
           coalesce(e.device_type, 'unknown'),
           coalesce(e.pathname, ''),
           (e.metadata ->> 'depth')::numeric::int,
           count(*)
      from public.analytics_events e
     where e.event_type = 'scroll_depth'
       and e.created_at >= v_starts_at and e.created_at < v_ends_at
       and jsonb_typeof(e.metadata -> 'depth') = 'number'
       and (e.metadata ->> 'depth')::numeric in (25, 50, 75, 90, 100)
     group by coalesce(e.device_type, 'unknown'), coalesce(e.pathname, ''), (e.metadata ->> 'depth')::numeric::int;
    get diagnostics v_written = row_count;
    v_rows := v_rows + v_written;

    -- `results_events` existe para a média não mentir: ela é sobre as buscas que
    -- registraram contagem de resultados, não sobre todas. Guardar só a média do
    -- dia e depois tirar média de médias daria peso igual a dias desiguais.
    --
    -- `query_sample` guarda o texto legível, porque `normalize_search` remove
    -- acento e caixa e o painel mostra "Café", não "cafe".
    insert into public.analytics_daily_stats
        (stat_date, metric, device_type, query_normalized, query_sample,
         events, results_total, results_events, zero_results)
    select p_date,
           'searches',
           coalesce(e.device_type, 'unknown'),
           left(public.normalize_search(btrim(e.metadata ->> 'query')), 120),
           min(btrim(e.metadata ->> 'query')),
           count(*),
           coalesce(sum(
               case when jsonb_typeof(e.metadata -> 'resultsCount') = 'number'
                    then (e.metadata ->> 'resultsCount')::numeric end
           ), 0)::bigint,
           count(*) filter (where jsonb_typeof(e.metadata -> 'resultsCount') = 'number'),
           count(*) filter (
               where jsonb_typeof(e.metadata -> 'resultsCount') = 'number'
                 and (e.metadata ->> 'resultsCount')::numeric = 0
           )
      from public.analytics_events e
     where e.event_type = 'search'
       and e.created_at >= v_starts_at and e.created_at < v_ends_at
       and coalesce(btrim(e.metadata ->> 'query'), '') <> ''
     group by coalesce(e.device_type, 'unknown'),
              left(public.normalize_search(btrim(e.metadata ->> 'query')), 120);
    get diagnostics v_written = row_count;
    v_rows := v_rows + v_written;

    insert into public.analytics_daily_business_stats
        (stat_date, business_id, device_type, views, whatsapp_clicks)
    select p_date,
           e.entity_id,
           coalesce(e.device_type, 'unknown'),
           count(*) filter (where e.event_type = 'business_view'),
           count(*) filter (where e.event_type = 'business_whatsapp_click')
      from public.analytics_events e
     where e.event_type in ('business_view', 'business_whatsapp_click')
       and e.entity_type = 'business'
       and e.entity_id is not null
       and e.created_at >= v_starts_at and e.created_at < v_ends_at
     group by e.entity_id, coalesce(e.device_type, 'unknown');
    get diagnostics v_written = row_count;
    v_rows := v_rows + v_written;

    select count(*) into v_seen
      from public.analytics_events e
     where e.created_at >= v_starts_at and e.created_at < v_ends_at;

    -- Gravado SEMPRE, inclusive para dia vazio: é o que distingue "dia sem
    -- movimento" de "dia que ninguém processou".
    insert into public.analytics_daily_aggregation (stat_date, aggregated_at, events_seen, rows_written)
    values (p_date, now(), v_seen, v_rows)
    on conflict (stat_date) do update
        set aggregated_at = now(),
            events_seen = excluded.events_seen,
            rows_written = excluded.rows_written;

    return v_rows;
end;
$$;

-- A porta pública: mesma coisa, com autorização de admin na frente.
create or replace function public.analytics_aggregate_day(p_date date)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.require_admin();
    return public.analytics_aggregate_day_internal(p_date);
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
--
-- Laço por DIA, nunca por evento: cada dia é uma passada agrupada em SQL.
create or replace function public.analytics_backfill_daily_stats(
    p_start_date date,
    p_end_date date
)
returns table (stat_date date, rows_written bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_max_days constant int := 365;
    v_day date;
begin
    perform public.require_admin();

    if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
        perform public.farol_error('invalid_period', 'Informe um intervalo válido.');
    end if;

    if (p_end_date - p_start_date) + 1 > v_max_days then
        perform public.farol_error(
            'period_too_long',
            'O backfill processa no máximo 365 dias por execução.'
        );
    end if;

    v_day := p_start_date;
    while v_day <= p_end_date loop
        stat_date := v_day;
        rows_written := public.analytics_aggregate_day_internal(v_day);
        return next;
        v_day := v_day + 1;
    end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saúde
-- ---------------------------------------------------------------------------
--
-- "Último evento" e "última agregação" são coisas diferentes e aparecem
-- separadas: um agendador parado há três dias continua tendo evento de um minuto
-- atrás, e é exatamente isso que precisa ficar visível.
--
-- O `count(*)` de analytics_events é aceitável neste volume. Se um dia pesar,
-- vira estimativa por `pg_class.reltuples` — não vale complicar antes.
create or replace function public.analytics_health()
returns table (
    events_total bigint,
    first_event_at timestamptz,
    last_event_at timestamptz,
    last_aggregated_date date,
    last_aggregated_at timestamptz,
    aggregated_days bigint,
    daily_rows bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    perform public.require_admin();

    return query
    select
        (select count(*) from public.analytics_events),
        (select min(e.created_at) from public.analytics_events e),
        (select max(e.created_at) from public.analytics_events e),
        (select max(a.stat_date) from public.analytics_daily_aggregation a),
        (select max(a.aggregated_at) from public.analytics_daily_aggregation a),
        (select count(*) from public.analytics_daily_aggregation),
        (select count(*) from public.analytics_daily_stats);
end;
$$;

-- ---------------------------------------------------------------------------
-- Painel híbrido
-- ---------------------------------------------------------------------------
--
-- As três RPCs abaixo passam a ler dias completos do agregado e só o resto dos
-- eventos. O limite temporal é o ponto delicado: contar um dia nas duas fontes
-- dobraria o número em silêncio.
--
-- A janela é partida assim, e o mesmo bloco se repete nas três:
--
--   v_cut      = o menor entre o fim pedido e agora  (dia só vale depois de acabar)
--   v_agg_from = primeiro dia que COMEÇA dentro da janela
--   v_agg_to   = último dia que TERMINA dentro de v_cut
--   v_use_daily só é verdadeiro se TODOS os dias entre eles foram processados
--   cabeça bruta = [p_start_at, início de v_agg_from)
--   cauda bruta  = [fim de v_agg_to, p_end_at)
--
-- Cabeça e cauda não encostam na janela agregada, então nada é contado duas
-- vezes. E se faltar um único dia processado, tudo vem do bruto: mais lento,
-- nunca errado. É a diferença entre um painel devagar e um painel mentiroso.

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
    v_zone constant text := 'America/Fortaleza';
    v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
    v_cut timestamptz;
    v_agg_from date;
    v_agg_to date;
    v_use_daily boolean := false;
    v_head_end timestamptz;
    v_tail_start timestamptz;
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    v_cut := least(p_end_at, now());

    v_agg_from := (p_start_at at time zone v_zone)::date;
    if ((v_agg_from::timestamp) at time zone v_zone) < p_start_at then
        v_agg_from := v_agg_from + 1;
    end if;

    v_agg_to := (v_cut at time zone v_zone)::date;
    if (((v_agg_to + 1)::timestamp) at time zone v_zone) > v_cut then
        v_agg_to := v_agg_to - 1;
    end if;

    if v_agg_from <= v_agg_to then
        select count(*) = (v_agg_to - v_agg_from + 1)
          into v_use_daily
          from public.analytics_daily_aggregation a
         where a.stat_date between v_agg_from and v_agg_to;
    end if;

    if v_use_daily then
        v_head_end := (v_agg_from::timestamp) at time zone v_zone;
        v_tail_start := ((v_agg_to + 1)::timestamp) at time zone v_zone;
    else
        v_head_end := p_end_at;
        v_tail_start := p_end_at;
    end if;

    return query
    with fonte as (
        select d.query_normalized as termo,
               nullif(d.query_sample, '') as amostra,
               d.events as buscas,
               d.results_total as soma_resultados,
               d.results_events as com_resultado,
               d.zero_results as sem_resultado
          from public.analytics_daily_stats d
         where v_use_daily
           and d.metric = 'searches'
           and d.stat_date between v_agg_from and v_agg_to
        union all
        select left(public.normalize_search(btrim(e.metadata ->> 'query')), 120),
               btrim(e.metadata ->> 'query'),
               1::bigint,
               case when jsonb_typeof(e.metadata -> 'resultsCount') = 'number'
                    then (e.metadata ->> 'resultsCount')::numeric::bigint else 0::bigint end,
               case when jsonb_typeof(e.metadata -> 'resultsCount') = 'number'
                    then 1::bigint else 0::bigint end,
               case when jsonb_typeof(e.metadata -> 'resultsCount') = 'number'
                     and (e.metadata ->> 'resultsCount')::numeric = 0
                    then 1::bigint else 0::bigint end
          from public.analytics_events e
         where e.event_type = 'search'
           and coalesce(btrim(e.metadata ->> 'query'), '') <> ''
           and (
                (e.created_at >= p_start_at and e.created_at < v_head_end)
                or (e.created_at >= v_tail_start and e.created_at < p_end_at)
           )
    )
    select f.termo,
           coalesce(min(f.amostra), f.termo),
           sum(f.buscas)::bigint,
           round(sum(f.soma_resultados)::numeric / nullif(sum(f.com_resultado), 0), 1),
           sum(f.sem_resultado)::bigint
      from fonte f
     group by f.termo
     order by sum(f.buscas) desc, f.termo
     limit v_limit;
end;
$$;

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
    v_zone constant text := 'America/Fortaleza';
    v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
    v_cut timestamptz;
    v_agg_from date;
    v_agg_to date;
    v_use_daily boolean := false;
    v_head_end timestamptz;
    v_tail_start timestamptz;
begin
    perform public.require_admin();

    if p_start_at is null or p_end_at is null or p_start_at >= p_end_at then
        perform public.farol_error('invalid_period', 'Informe um período válido.');
    end if;

    if p_device_type is not null and p_device_type not in ('mobile', 'tablet', 'desktop') then
        perform public.farol_error('invalid_device_type', 'Dispositivo inválido.');
    end if;

    v_cut := least(p_end_at, now());

    v_agg_from := (p_start_at at time zone v_zone)::date;
    if ((v_agg_from::timestamp) at time zone v_zone) < p_start_at then
        v_agg_from := v_agg_from + 1;
    end if;

    v_agg_to := (v_cut at time zone v_zone)::date;
    if (((v_agg_to + 1)::timestamp) at time zone v_zone) > v_cut then
        v_agg_to := v_agg_to - 1;
    end if;

    if v_agg_from <= v_agg_to then
        select count(*) = (v_agg_to - v_agg_from + 1)
          into v_use_daily
          from public.analytics_daily_aggregation a
         where a.stat_date between v_agg_from and v_agg_to;
    end if;

    if v_use_daily then
        v_head_end := (v_agg_from::timestamp) at time zone v_zone;
        v_tail_start := ((v_agg_to + 1)::timestamp) at time zone v_zone;
    else
        v_head_end := p_end_at;
        v_tail_start := p_end_at;
    end if;

    return query
    with fonte as (
        -- `positioned_events`, não `events`: página cujo único clique veio do
        -- teclado não tem mapa para mostrar e não deve aparecer no seletor.
        select d.pathname as caminho, d.positioned_events as cliques
          from public.analytics_daily_stats d
         where v_use_daily
           and d.metric = 'element_clicks'
           and d.stat_date between v_agg_from and v_agg_to
           and d.positioned_events > 0
           and (p_device_type is null or d.device_type = p_device_type)
        union all
        select coalesce(e.pathname, ''), 1::bigint
          from public.analytics_events e
         where e.event_type = 'element_click'
           and (p_device_type is null or e.device_type = p_device_type)
           and jsonb_typeof(e.metadata -> 'x_percent') = 'number'
           and (
                (e.created_at >= p_start_at and e.created_at < v_head_end)
                or (e.created_at >= v_tail_start and e.created_at < p_end_at)
           )
    )
    select f.caminho, sum(f.cliques)::bigint
      from fonte f
     where f.caminho <> ''
     group by f.caminho
     order by sum(f.cliques) desc, f.caminho
     limit v_limit;
end;
$$;

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
declare
    v_zone constant text := 'America/Fortaleza';
    v_cut timestamptz;
    v_agg_from date;
    v_agg_to date;
    v_use_daily boolean := false;
    v_head_end timestamptz;
    v_tail_start timestamptz;
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

    v_cut := least(p_end_at, now());

    v_agg_from := (p_start_at at time zone v_zone)::date;
    if ((v_agg_from::timestamp) at time zone v_zone) < p_start_at then
        v_agg_from := v_agg_from + 1;
    end if;

    v_agg_to := (v_cut at time zone v_zone)::date;
    if (((v_agg_to + 1)::timestamp) at time zone v_zone) > v_cut then
        v_agg_to := v_agg_to - 1;
    end if;

    if v_agg_from <= v_agg_to then
        select count(*) = (v_agg_to - v_agg_from + 1)
          into v_use_daily
          from public.analytics_daily_aggregation a
         where a.stat_date between v_agg_from and v_agg_to;
    end if;

    if v_use_daily then
        v_head_end := (v_agg_from::timestamp) at time zone v_zone;
        v_tail_start := ((v_agg_to + 1)::timestamp) at time zone v_zone;
    else
        v_head_end := p_end_at;
        v_tail_start := p_end_at;
    end if;

    return query
    with visualizacoes as (
        select coalesce(sum(origem.total), 0)::bigint as total
          from (
            select d.events as total
              from public.analytics_daily_stats d
             where v_use_daily
               and d.metric = 'page_views'
               and d.stat_date between v_agg_from and v_agg_to
               and d.pathname = p_pathname
               and (p_device_type is null or d.device_type = p_device_type)
            union all
            select 1::bigint
              from public.analytics_events e
             where e.event_type = 'page_view'
               and e.pathname = p_pathname
               and (p_device_type is null or e.device_type = p_device_type)
               and (
                    (e.created_at >= p_start_at and e.created_at < v_head_end)
                    or (e.created_at >= v_tail_start and e.created_at < p_end_at)
               )
          ) origem
    ),
    marcos as (
        select origem.marco, sum(origem.total)::bigint as total
          from (
            select d.scroll_depth as marco, d.events as total
              from public.analytics_daily_stats d
             where v_use_daily
               and d.metric = 'scroll_depth'
               and d.stat_date between v_agg_from and v_agg_to
               and d.pathname = p_pathname
               and (p_device_type is null or d.device_type = p_device_type)
            union all
            select (e.metadata ->> 'depth')::numeric::int, 1::bigint
              from public.analytics_events e
             where e.event_type = 'scroll_depth'
               and e.pathname = p_pathname
               and (p_device_type is null or e.device_type = p_device_type)
               and jsonb_typeof(e.metadata -> 'depth') = 'number'
               and (e.metadata ->> 'depth')::numeric in (25, 50, 75, 90, 100)
               and (
                    (e.created_at >= p_start_at and e.created_at < v_head_end)
                    or (e.created_at >= v_tail_start and e.created_at < p_end_at)
               )
          ) origem
         group by origem.marco
    )
    select
        esperados.valor,
        coalesce(k.total, 0),
        v.total,
        case when v.total > 0 then round(coalesce(k.total, 0) * 100.0 / v.total, 1) end
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
-- `analytics_aggregate_day_internal` não é concedida a NINGUÉM: só o dono a
-- executa. É de propósito — é por ela que um agendador entrará no futuro, e
-- deixá-la sem grant significa que nenhum papel do PostgREST a alcança.
revoke all on function public.analytics_aggregate_day_internal(date) from public;

revoke all on function public.analytics_aggregate_day(date) from public;
revoke all on function public.analytics_backfill_daily_stats(date, date) from public;
revoke all on function public.analytics_health() from public;

grant execute on function public.analytics_aggregate_day(date) to authenticated;
grant execute on function public.analytics_backfill_daily_stats(date, date) to authenticated;
grant execute on function public.analytics_health() to authenticated;

-- `create or replace` preserva o ACL das três já existentes, mas o par vai
-- repetido: GRANT esquecido já custou caro quatro vezes neste projeto.
revoke all on function public.analytics_top_searches(timestamptz, timestamptz, int) from public;
revoke all on function public.analytics_heatmap_pages(timestamptz, timestamptz, text, int) from public;
revoke all on function public.analytics_scroll_funnel(timestamptz, timestamptz, text, text) from public;

grant execute on function public.analytics_top_searches(timestamptz, timestamptz, int) to authenticated;
grant execute on function public.analytics_heatmap_pages(timestamptz, timestamptz, text, int) to authenticated;
grant execute on function public.analytics_scroll_funnel(timestamptz, timestamptz, text, text) to authenticated;
