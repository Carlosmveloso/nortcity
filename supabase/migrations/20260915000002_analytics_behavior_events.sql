-- Sprint 02 do Farol Analytics: os dois eventos de comportamento.
--
-- A Sprint 01 mede intenção (abriu a ficha, clicou no WhatsApp, buscou). O que
-- ela não responde é *onde* na página as pessoas clicam e *até onde* elas leem —
-- que é o insumo do mapa de calor. Daí `scroll_depth` e `element_click`.
--
-- Nenhuma coluna nova: os dois cabem no `metadata` jsonb que já existe.
-- `{"depth": 50}` e `{"element": "business-card", "x_percent": 0.48,
-- "y_percent": 0.61}`. Coluna dedicada só se e quando a agregação da Sprint 03
-- provar que o jsonb não dá conta.
--
-- Por que uma migration nova em vez de editar a 20260915000001: mesmo que ela
-- ainda não tenha sido aplicada, o Supabase registra versões aplicadas e nunca
-- reexecuta um arquivo já registrado. Editar uma migration que já rodou em
-- algum ambiente é uma alteração que nunca chega ao banco — e ninguém fica
-- sabendo. O custo de fazer certo é cosmético: a constraint nasce com 5 valores
-- e é recriada com 7.
--
-- ATENÇÃO para quem editar este arquivo: `create or replace function` substitui
-- a definição INTEIRA, inclusive a cláusula `set search_path`. Os hardenings da
-- Sprint 01 não são herdados — eles estão reescritos abaixo, literalmente, e
-- precisam continuar aqui:
--
--   1. security definer + set search_path = ''
--   2. tudo qualificado (public.*, auth.uid())
--   3. guarda de propriedade da sessão pelo anonymous_id normalizado
--   4. auth.uid() lido no servidor, nunca recebido do cliente
--   5. created_at do banco
--   6. teto de tamanho do metadata
--   7. retorno silencioso para entrada inválida
--   8. nenhum grant de escrita direta nas tabelas
--
-- O ACL sobrevive ao `create or replace`, mas o revoke/grant vai repetido no
-- fim mesmo assim: GRANT esquecido já custou caro três vezes neste projeto.

alter table public.analytics_events
    drop constraint analytics_events_event_type_check;

alter table public.analytics_events
    add constraint analytics_events_event_type_check check (event_type in (
        'page_view',
        'business_view',
        'business_whatsapp_click',
        'business_location_click',
        'search',
        'scroll_depth',
        'element_click'
    ));

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
            'search',
            'scroll_depth',
            'element_click'
        )
    then
        return;
    end if;

    -- Metadata dos eventos de comportamento é o dado inteiro: evento de scroll
    -- sem profundidade, ou clique sem elemento, não é evento incompleto — é
    -- linha que nenhuma consulta futura consegue usar. Validar aqui evita que o
    -- heatmap da Sprint 03 tenha de filtrar lixo depois.
    --
    -- Duas armadilhas de jsonb estão cobertas de propósito: `jsonb_typeof` de
    -- chave ausente devolve NULL, e `NULL <> 'number'` é NULL — que não entra
    -- no `if` — daí o coalesce; e `::int` sobre "25.5" levanta exceção, daí
    -- `::numeric`.
    if p_event_type = 'scroll_depth' then
        if coalesce(jsonb_typeof(v_metadata -> 'depth'), '') <> 'number'
            or (v_metadata ->> 'depth')::numeric not in (25, 50, 75, 90, 100)
        then
            return;
        end if;

    elsif p_event_type = 'element_click' then
        if coalesce(jsonb_typeof(v_metadata -> 'element'), '') <> 'string'
            or char_length(v_metadata ->> 'element') not between 1 and 80
        then
            return;
        end if;

        -- As coordenadas são opcionais: clique disparado pelo teclado (Enter,
        -- Espaço) não tem posição de ponteiro, e mandar 0,0 criaria um ponto
        -- quente falso no canto da tela. Quando vêm, têm de ser número em 0..1.
        if (
            v_metadata ? 'x_percent'
            and (
                coalesce(jsonb_typeof(v_metadata -> 'x_percent'), '') <> 'number'
                or (v_metadata ->> 'x_percent')::numeric not between 0 and 1
            )
        ) or (
            v_metadata ? 'y_percent'
            and (
                coalesce(jsonb_typeof(v_metadata -> 'y_percent'), '') <> 'number'
                or (v_metadata ->> 'y_percent')::numeric not between 0 and 1
            )
        ) then
            return;
        end if;
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

revoke all on function public.analytics_track(
    uuid, text, text, text, text, uuid, text, jsonb
) from public;

grant execute on function public.analytics_track(
    uuid, text, text, text, text, uuid, text, jsonb
) to anon, authenticated;
