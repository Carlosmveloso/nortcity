-- Sprint 01 do Farol Analytics: a coleta, sem nenhuma tela.
--
-- O site não guarda nada sobre quem o visita. O @vercel/analytics dá pageview
-- agregado, mas não responde as perguntas do produto: qual negócio é aberto,
-- quantos cliques de WhatsApp cada um recebe, o que as pessoas buscam e não
-- encontram. Sem esse histórico não há como construir depois o painel do
-- proprietário, que é o que o plano pago promete vender.
--
-- Duas decisões desta migration merecem explicação.
--
-- 1. A escrita é por RPC, não por INSERT direto com policy.
--
-- É a convenção do projeto desde a migration 20260906000010, que revogou
-- insert/update em businesses. Aqui ela paga quatro contas de uma vez:
--
--   - `user_id` vem de `auth.uid()` dentro da função. Com INSERT direto o
--     cliente manda a coluna e a policy tem de conferir se ele mentiu; aqui ele
--     não tem como mentir, nem precisa enviar nada.
--   - `created_at` é carimbado pelo servidor, imune a relógio errado no
--     aparelho do visitante — e a série temporal inteira depende disso.
--   - `last_seen_at` é atualizado sem conceder UPDATE a ninguém. A alternativa
--     seria dar `update` a anon, e aí qualquer pessoa reescreveria qualquer
--     sessão.
--   - A sessão é criada de forma preguiçosa dentro da própria chamada, então um
--     evento nunca é perdido por violação de chave estrangeira.
--
-- 2. Entrada inválida é descartada em silêncio, sem `farol_error`.
--
-- As RPCs de negócio levantam erro porque a pessoa está esperando o resultado
-- de um formulário. Analytics roda nas costas de quem navega: erro aqui não tem
-- ninguém para ler, e um `raise` que chegasse ao cliente arriscaria exatamente o
-- que a Sprint proíbe — quebrar a navegação por causa da telemetria. Por isso as
-- funções normalizam (device_type desconhecido vira null, entity pela metade
-- zera, texto longo é cortado) e, no que não dá para normalizar, apenas
-- retornam. As constraints ficam como rede de segurança, sem poder disparar a
-- partir do app.
--
-- 3. `set search_path = ''`, e não `= public`.
--
-- Função SECURITY DEFINER roda com os privilégios do dono, então o search_path
-- dela é superfície de ataque: com `public` no caminho, quem puder criar objeto
-- nesse schema pode plantar uma função ou um operador que a função passe a
-- resolver no lugar do pretendido. Com o caminho vazio nada é resolvido por
-- proximidade — só `pg_catalog`, que o Postgres sempre busca implicitamente.
-- Por isso toda referência aqui é qualificada: `public.analytics_sessions`,
-- `public.analytics_events`, `auth.uid()`.
--
-- 4. A sessão tem dono, e o dono é conferido.
--
-- `p_session_id` vem do navegador, como tudo mais. Sem conferência, quem
-- descobrisse (ou adivinhasse) o id de sessão de outra pessoa poderia pendurar
-- eventos nela, mexer no `last_seen_at` dela e — pior — fazer a sessão anônima
-- de alguém ser vinculada a uma conta que não é a dela. `analytics_track`
-- confere, depois da criação preguiçosa, se a sessão pertence ao mesmo
-- `anonymous_id` que chegou na chamada; se não pertencer, o evento é descartado
-- em silêncio, como qualquer outra entrada inválida.
--
-- `analytics_start_session` não precisa da mesma guarda: o `on conflict do
-- nothing` já faz com que anunciar uma sessão alheia não altere coisa alguma.

create table public.analytics_sessions (
    id uuid primary key default gen_random_uuid(),
    anonymous_id text not null,
    user_id uuid references auth.users(id) on delete set null,
    started_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    landing_page text,
    referrer text,
    device_type text,
    browser text,
    os text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    created_at timestamptz not null default now(),
    constraint analytics_sessions_anonymous_id_check
        check (char_length(anonymous_id) between 1 and 64),
    constraint analytics_sessions_device_type_check
        check (device_type is null or device_type in ('mobile', 'tablet', 'desktop'))
);

-- O id da sessão é gerado no navegador (crypto.randomUUID) e enviado pronto.
-- Ler de volta um id gerado aqui exigiria SELECT, e anon não tem — nem deve ter.
-- O default fica por convenção do projeto; na prática nunca é usado.

create index analytics_sessions_anonymous_started_idx
    on public.analytics_sessions (anonymous_id, started_at desc);

-- Parcial: a esmagadora maioria das sessões é anônima, e um índice sobre uma
-- coluna quase toda nula custa espaço sem servir a consulta nenhuma.
create index analytics_sessions_user_id_idx
    on public.analytics_sessions (user_id)
    where user_id is not null;

create index analytics_sessions_started_at_idx on public.analytics_sessions (started_at desc);
create index analytics_sessions_last_seen_at_idx on public.analytics_sessions (last_seen_at desc);

create table public.analytics_events (
    id bigint generated always as identity primary key,
    session_id uuid references public.analytics_sessions(id) on delete cascade,
    anonymous_id text not null,
    user_id uuid references auth.users(id) on delete set null,
    event_type text not null,
    pathname text,
    entity_type text,
    entity_id uuid,
    device_type text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint analytics_events_anonymous_id_check
        check (char_length(anonymous_id) between 1 and 64),
    constraint analytics_events_event_type_check check (event_type in (
        'page_view',
        'business_view',
        'business_whatsapp_click',
        'business_location_click',
        'search'
    )),
    -- Entidade é par: tipo sem id (ou id sem tipo) é linha que nenhuma consulta
    -- futura consegue interpretar.
    constraint analytics_events_entity_check check (
        (entity_type is null and entity_id is null)
        or (entity_type is not null and entity_id is not null)
    ),
    constraint analytics_events_device_type_check
        check (device_type is null or device_type in ('mobile', 'tablet', 'desktop'))
);

-- Também obrigatório pelo `on delete cascade`: sem índice, apagar uma sessão
-- varre a tabela de eventos inteira.
create index analytics_events_session_id_idx on public.analytics_events (session_id);

-- Cobre `event_type` sozinho (prefixo) e "eventos deste tipo no período", que é
-- a forma de toda pergunta do painel futuro.
create index analytics_events_type_created_idx
    on public.analytics_events (event_type, created_at desc);

create index analytics_events_created_at_idx on public.analytics_events (created_at desc);

-- O índice do futuro painel do proprietário: views e cliques de um negócio ao
-- longo do tempo. Parcial porque metade dos eventos (page_view) não tem entidade.
create index analytics_events_entity_idx
    on public.analytics_events (entity_type, entity_id, created_at desc)
    where entity_id is not null;

create index analytics_events_anonymous_created_idx
    on public.analytics_events (anonymous_id, created_at desc);

create index analytics_events_user_id_idx
    on public.analytics_events (user_id)
    where user_id is not null;

-- Sem índice em `pathname`, de propósito. A consulta real é "páginas mais vistas
-- no período", um group by que varre a fatia de tempo e já usa
-- (event_type, created_at); índice em pathname só serviria a filtro por caminho
-- exato, que ninguém faz. Fica registrado que foi avaliado, não esquecido.

alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;

-- Só leitura, só admin. Não existe policy de insert/update/delete: a escrita
-- inteira mora nas RPCs abaixo, que rodam como dono e não passam por policy.
create policy "analytics_sessions_select_admin"
    on public.analytics_sessions for select
    using (public.has_role(auth.uid(), 'admin'));

create policy "analytics_events_select_admin"
    on public.analytics_events for select
    using (public.has_role(auth.uid(), 'admin'));

-- GRANT na mesma migration que cria a tabela: é a lição que já custou caro três
-- vezes neste projeto (businesses na 0009, categories na 0010, a trigger de
-- categorias na 20260907000002). `anon` não recebe nada — nem select.
grant select on public.analytics_sessions to authenticated;
grant select on public.analytics_events to authenticated;

create or replace function public.analytics_start_session(
    p_session_id uuid,
    p_anonymous_id text,
    p_landing_page text default null,
    p_referrer text default null,
    p_device_type text default null,
    p_browser text default null,
    p_os text default null,
    p_utm_source text default null,
    p_utm_medium text default null,
    p_utm_campaign text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anonymous_id text := left(p_anonymous_id, 64);
    v_device text := case
        when p_device_type in ('mobile', 'tablet', 'desktop') then p_device_type
    end;
begin
    if p_session_id is null or coalesce(p_anonymous_id, '') = '' then
        return;
    end if;

    -- `do nothing` porque a mesma sessão pode ser anunciada duas vezes: duas
    -- abas do mesmo visitante, ou o efeito do React em modo estrito.
    insert into public.analytics_sessions (
        id, anonymous_id, user_id, landing_page, referrer, device_type, browser, os,
        utm_source, utm_medium, utm_campaign
    )
    values (
        p_session_id,
        v_anonymous_id,
        auth.uid(),
        left(p_landing_page, 255),
        left(p_referrer, 255),
        v_device,
        left(p_browser, 40),
        left(p_os, 40),
        left(p_utm_source, 120),
        left(p_utm_medium, 120),
        left(p_utm_campaign, 120)
    )
    on conflict (id) do nothing;
end;
$$;

create or replace function public.analytics_track(
    p_session_id uuid,
    p_anonymous_id text,
    p_event_type text,
    p_pathname text default null,
    p_entity_type text default null,
    p_entity_id uuid default null,
    p_device_type text default null,
    p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_anonymous_id text := left(p_anonymous_id, 64);
    v_device text := case
        when p_device_type in ('mobile', 'tablet', 'desktop') then p_device_type
    end;
    v_has_entity boolean := p_entity_type is not null and p_entity_id is not null;
    v_metadata jsonb := case
        when p_metadata is null then '{}'::jsonb
        when length(p_metadata::text) > 1000 then '{}'::jsonb
        else p_metadata
    end;
begin
    if p_session_id is null
        or coalesce(p_anonymous_id, '') = ''
        or p_event_type not in (
            'page_view',
            'business_view',
            'business_whatsapp_click',
            'business_location_click',
            'search'
        )
    then
        return;
    end if;

    -- Rede de segurança. Se analytics_start_session não chegou (conexão caiu no
    -- primeiro pedido, aba aberta offline), a sessão nasce aqui com o mínimo. Sem
    -- isto a chave estrangeira derrubaria, em silêncio, todos os eventos daquele
    -- visitante — e a falha só apareceria como um buraco no relatório.
    insert into public.analytics_sessions (id, anonymous_id, user_id, landing_page, device_type)
    values (p_session_id, v_anonymous_id, v_uid, left(p_pathname, 255), v_device)
    on conflict (id) do nothing;

    -- A sessão tem de ser deste visitante. Depois do passo acima ela existe;
    -- se o anonymous_id não bate, o id veio de outra pessoa (reaproveitado,
    -- copiado ou adivinhado) e o evento inteiro é descartado — nada de
    -- last_seen_at, nada de vincular user_id, nada de gravar o evento.
    if not exists (
        select 1
          from public.analytics_sessions
         where id = p_session_id
           and anonymous_id = v_anonymous_id
    ) then
        return;
    end if;

    -- No máximo uma escrita a cada 5 minutos por sessão: `last_seen_at` serve
    -- para saber se a sessão está viva, e não vale um UPDATE por clique.
    -- O mesmo comando vincula quem entrou na conta no meio da sessão.
    update public.analytics_sessions
       set last_seen_at = now(),
           user_id = coalesce(user_id, v_uid)
     where id = p_session_id
       and (
            last_seen_at < now() - interval '5 minutes'
            or (user_id is null and v_uid is not null)
       );

    insert into public.analytics_events (
        session_id, anonymous_id, user_id, event_type, pathname,
        entity_type, entity_id, device_type, metadata
    )
    values (
        p_session_id,
        v_anonymous_id,
        v_uid,
        p_event_type,
        left(p_pathname, 255),
        case when v_has_entity then p_entity_type end,
        case when v_has_entity then p_entity_id end,
        v_device,
        v_metadata
    );
end;
$$;

-- Função nasce com EXECUTE para PUBLIC. Sem o revoke, conceder a anon e
-- authenticated não restringe nada: qualquer papel do banco, hoje ou no futuro,
-- já podia chamar as duas RPCs por herança. Medido neste projeto — um papel
-- criado sem grant nenhum passava em `has_function_privilege(..., 'execute')`.
--
-- A migration 20260906000010 fez o mesmo com as funções internas de negócio. A
-- diferença é que lá o objetivo era "isto não é endpoint"; aqui elas são
-- endpoint, e ainda assim o conjunto de quem escreve precisa ser exatamente
-- anon e authenticated, não "todo mundo".
revoke all on function public.analytics_start_session(
    uuid, text, text, text, text, text, text, text, text, text
) from public;

revoke all on function public.analytics_track(
    uuid, text, text, text, text, uuid, text, jsonb
) from public;

grant execute on function public.analytics_start_session(
    uuid, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

grant execute on function public.analytics_track(
    uuid, text, text, text, text, uuid, text, jsonb
) to anon, authenticated;
