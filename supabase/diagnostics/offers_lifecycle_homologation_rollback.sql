-- Homologação do job offer-lifecycle — APENAS farol-pitimbu-dev.
--
-- Pré-requisito: migration 20261006000001 aplicada. Executar como postgres.
-- Tudo em uma transação com ROLLBACK. now() é fixo na transação, então os
-- instantes são passados explicitamente em process_offer_lifecycle(p_now);
-- o cron real chama sem argumento.
--
-- Sucesso: última linha `offers_lifecycle_qa_passed_with_rollback`.

begin;
set local statement_timeout = '60s';
set local lock_timeout = '5s';

create temp table qa_ids (key text primary key, id uuid not null);

create function pg_temp.qa(p_key text) returns uuid
language sql stable as $$ select id from qa_ids where key = p_key $$;

create function pg_temp.check(p_condition boolean, p_message text) returns void
language plpgsql as $$
begin
    if not coalesce(p_condition, false) then
        raise exception 'offers_lifecycle_qa_failed: %', p_message;
    end if;
end;
$$;

create function pg_temp.status(p_key text) returns text
language sql stable as $$ select status::text from public.offers where id = pg_temp.qa(p_key) $$;

-- Dia D (UTC−3) deslocado, no formato que o frontend grava.
create function pg_temp.day(p_offset int) returns date
language sql stable as $$ select ((now() at time zone '-03') + make_interval(days => p_offset))::date $$;
create function pg_temp.start_of(p_offset int) returns timestamptz
language sql stable as $$ select (pg_temp.day(p_offset)::text || ' 00:00:00-03')::timestamptz $$;
create function pg_temp.end_of(p_offset int) returns timestamptz
language sql stable as $$ select (pg_temp.day(p_offset)::text || ' 23:59:59-03')::timestamptz $$;

-- ---------------------------------------------------------------------------
-- 0. Agendamento e privilégios
-- ---------------------------------------------------------------------------

select pg_temp.check(
    (select count(*) = 1 and bool_and(schedule = '*/5 * * * *' and command = 'select public.process_offer_lifecycle()' and active)
       from cron.job where jobname = 'offer-lifecycle'),
    '0.1 cron offer-lifecycle ativo a cada 5 minutos'
);
select pg_temp.check(
    (select bool_and(not has_function_privilege(r, f, 'EXECUTE'))
       from unnest(array['anon', 'authenticated']) r,
            unnest(array['public.process_offer_lifecycle(timestamptz)', 'public.end_expired_offers(timestamptz)',
                         'public.activate_due_offers(timestamptz)', 'public.offer_period_version(public.offers)']) f),
    '0.2 funções do job sem EXECUTE para anon/authenticated'
);
select pg_temp.check(
    not exists (select 1 from pg_proc where proname = 'activate_due_offers' and pronargs = 0),
    '0.3 versão antiga sem parâmetro removida'
);

-- ---------------------------------------------------------------------------
-- 1. Massa
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at) values
    ('75000000-0000-4000-8000-000000000001', 'lifecycle.premium@example.test', now(), '{}', now(), now()),
    ('75000000-0000-4000-8000-000000000002', 'lifecycle.basic@example.test', now(), '{}', now(), now()),
    ('75000000-0000-4000-8000-000000000003', 'lifecycle.admin@example.test', now(), '{}', now(), now());
insert into public.user_roles (user_id, role) values ('75000000-0000-4000-8000-000000000003', 'admin');
insert into public.categories (id, name, slug, order_index)
values ('75000000-0000-4000-8000-0000000000c1', 'Ciclo QA', 'ciclo-qa', 996);

create function pg_temp.as_user(p_id text) returns void
language sql as $$ select set_config('request.jwt.claim.sub', p_id, true) $$;

create function pg_temp.business(p_key text, p_owner text, p_name text, p_phone text, p_plan text) returns void
language plpgsql as $$
begin
    perform pg_temp.as_user(p_owner);
    insert into qa_ids values (p_key, public.submit_business(
        jsonb_build_object('name', p_name, 'description', 'Cadastro descartável do ciclo de ofertas.',
                           'service_area', 'Pitimbu e região', 'phone', p_phone),
        array['75000000-0000-4000-8000-0000000000c1'::uuid], '75000000-0000-4000-8000-0000000000c1'::uuid));
    perform pg_temp.as_user('75000000-0000-4000-8000-000000000003');
    perform public.moderate_business(pg_temp.qa(p_key), 'approve');
    perform public.admin_set_business_plan(pg_temp.qa(p_key), p_plan, 'Ciclo QA');
end;
$$;

-- Leva a oferta até o estado pedido pelas RPCs oficiais.
create function pg_temp.offer(p_key text, p_biz text, p_owner text, p_fee numeric, p_state text,
                              p_starts timestamptz, p_ends timestamptz) returns void
language plpgsql as $$
declare
    v_id uuid;
    v_admin text := '75000000-0000-4000-8000-000000000003';
begin
    perform pg_temp.as_user(p_owner);
    v_id := public.create_offer(pg_temp.qa(p_biz), jsonb_build_object(
        'title', 'Ciclo ' || p_key, 'description', 'Oferta do ciclo de vida.', 'benefit_type', 'gift',
        'starts_at', p_starts, 'ends_at', p_ends, 'coupon_validity_minutes', 60));
    insert into qa_ids values (p_key, v_id);
    if p_state = 'draft' then return; end if;
    perform public.accept_offer_financial_terms(v_id, p_fee);
    perform public.submit_offer_for_review(v_id);
    if p_state = 'pending_review' then return; end if;
    perform pg_temp.as_user(v_admin);
    if p_state = 'changes_requested' then perform public.request_offer_changes(v_id, 'Ajuste.'); return; end if;
    if p_state = 'rejected' then perform public.reject_offer(v_id, 'Não confere.'); return; end if;
    perform public.approve_offer(v_id);
    if p_state = 'approved' then return; end if;
    perform public.publish_offer(v_id);
    if p_state = 'suspended' then perform public.suspend_offer(v_id, 'Pausa.'); end if;
end;
$$;

select pg_temp.business('premium', '75000000-0000-4000-8000-000000000001', 'Ciclo Premium QA', '83991115551', 'premium');
select pg_temp.business('basic', '75000000-0000-4000-8000-000000000002', 'Ciclo Básico QA', '83991115552', 'basico');
select pg_temp.as_user('');

-- ---------------------------------------------------------------------------
-- 2. Limites de horário em UTC−3
-- ---------------------------------------------------------------------------

select pg_temp.offer('edge', 'premium', '75000000-0000-4000-8000-000000000001', 0.50, 'scheduled',
                     pg_temp.start_of(20), pg_temp.end_of(25));
select pg_temp.as_user('');
select pg_temp.check(pg_temp.status('edge') = 'scheduled', '2.1 início futuro → scheduled');
select public.process_offer_lifecycle((pg_temp.day(19)::text || ' 23:59:59-03')::timestamptz);
select pg_temp.check(pg_temp.status('edge') = 'scheduled', '2.2 23:59:59 da véspera (02:59:59 UTC do dia) não ativa');
select public.process_offer_lifecycle(pg_temp.start_of(20));
select pg_temp.check(pg_temp.status('edge') = 'active', '2.3 00:00 de Pitimbu ativa');
select public.process_offer_lifecycle((pg_temp.day(25)::text || ' 23:59:58-03')::timestamptz);
select pg_temp.check(pg_temp.status('edge') = 'active', '2.4 23:59:58 do último dia (já dia seguinte em UTC) continua ativa');
select public.process_offer_lifecycle(pg_temp.end_of(25));
select pg_temp.check(pg_temp.status('edge') = 'ended', '2.5 23:59:59 do último dia encerra');
select pg_temp.check(
    (select count(*) = 2 from public.offer_reviews
      where offer_id = pg_temp.qa('edge') and actor_id is null
        and ((action = 'published' and message is null) or (action = 'ended' and message = 'Período da oferta encerrado'))),
    '2.6 publicação e encerramento automáticos sem autor'
);

-- ---------------------------------------------------------------------------
-- 3. Quem é encerrado e quem fica intacto
-- ---------------------------------------------------------------------------

create temp table qa_reviews_before as select offer_id, count(*) as n from public.offer_reviews group by offer_id;

select pg_temp.offer(s, 'premium', '75000000-0000-4000-8000-000000000001', 0.50, s, pg_temp.start_of(-1), pg_temp.end_of(3))
  from unnest(array['active', 'suspended', 'approved', 'draft', 'pending_review', 'changes_requested', 'rejected']) s;
select pg_temp.offer('scheduled', 'premium', '75000000-0000-4000-8000-000000000001', 0.50, 'scheduled',
                     pg_temp.start_of(1), pg_temp.end_of(3));
select pg_temp.as_user('');
drop table qa_reviews_before;
create temp table qa_reviews_before as select offer_id, count(*) as n from public.offer_reviews group by offer_id;

select pg_temp.check(
    public.process_offer_lifecycle(pg_temp.end_of(4)) = '{"ended": 4, "activated": 0}'::jsonb,
    '3.1 quatro vencidas encerradas, nenhuma ativada'
);
select pg_temp.check(
    (select bool_and(pg_temp.status(s) = 'ended') from unnest(array['active', 'suspended', 'approved', 'scheduled']) s),
    '3.2 active, suspended, approved e scheduled → ended'
);
select pg_temp.check(
    (select bool_and(pg_temp.status(s) = s) from unnest(array['draft', 'pending_review', 'changes_requested', 'rejected']) s),
    '3.3 draft, pending_review, changes_requested e rejected intactos'
);
select pg_temp.check(
    (select bool_and(r.n = b.n)
       from qa_reviews_before b
       join lateral (select count(*) as n from public.offer_reviews where offer_id = b.offer_id) r on true
      where b.offer_id in (select pg_temp.qa(s) from unnest(array['draft', 'pending_review', 'changes_requested', 'rejected']) s)),
    '3.4 histórico dos intactos não ganhou linhas'
);
select pg_temp.check(
    not exists (select 1 from public.offer_reviews where offer_id = pg_temp.qa('scheduled') and action = 'published'),
    '3.5 agendada vencida vai direto para ended, sem published'
);
select pg_temp.check(
    public.process_offer_lifecycle(pg_temp.end_of(4)) = '{"ended": 0, "activated": 0}'::jsonb,
    '3.6 segunda execução não faz nada'
);

-- ---------------------------------------------------------------------------
-- 4. Plano sem vaga
-- ---------------------------------------------------------------------------

select pg_temp.offer('slot_a', 'basic', '75000000-0000-4000-8000-000000000002', 1.50, 'active', pg_temp.start_of(-1), pg_temp.end_of(30));
select pg_temp.offer('slot_b', 'basic', '75000000-0000-4000-8000-000000000002', 1.50, 'scheduled', pg_temp.start_of(2), pg_temp.end_of(30));
select pg_temp.as_user('');
select public.process_offer_lifecycle(pg_temp.start_of(3));
select public.process_offer_lifecycle(pg_temp.start_of(3));
select pg_temp.check(pg_temp.status('slot_b') = 'scheduled', '4.1 sem vaga continua scheduled');
select pg_temp.check(
    (select count(*) = 3 from public.offer_reviews where offer_id = pg_temp.qa('slot_b')),
    '4.2 tentativas sem vaga não criam histórico'
);
select pg_temp.as_user('75000000-0000-4000-8000-000000000003');
select public.end_offer(pg_temp.qa('slot_a'), 'Abre vaga.');
select pg_temp.as_user('');
-- Duas instruções: na mesma, status() leria o snapshot anterior ao job.
select pg_temp.check(
    public.process_offer_lifecycle(pg_temp.start_of(3)) = '{"ended": 0, "activated": 1}'::jsonb,
    '4.3 com a vaga aberta, a próxima execução ativa uma oferta'
);
select pg_temp.check(pg_temp.status('slot_b') = 'active', '4.4 a oferta que aguardava vaga está ativa');

-- ---------------------------------------------------------------------------
-- 5. Proteção de escrita depois do job
-- ---------------------------------------------------------------------------

do $$
begin
    begin
        update public.offers set status = 'ended', ended_at = now() where id = pg_temp.qa('slot_b');
        raise exception 'offers_lifecycle_qa_failed: 5.1 UPDATE direto aceito depois do job';
    exception when others then
        if sqlerrm <> 'direct_write_not_allowed' then
            raise exception 'offers_lifecycle_qa_failed: 5.1 esperado direct_write_not_allowed, recebido %', sqlerrm;
        end if;
    end;
end;
$$;

rollback;
select 'offers_lifecycle_qa_passed_with_rollback' as result;
