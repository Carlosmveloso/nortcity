-- Concorrência do módulo de ofertas — APENAS farol-pitimbu-dev.
--
-- Diferente dos roteiros com ROLLBACK, este GRAVA uma massa fictícia (ids
-- 73000000-…) porque duas sessões só enxergam dados confirmados. Remova tudo
-- depois com offers_concurrency_cleanup.sql, mesmo se algum passo falhar.
--
-- Massa: negócio "Concorrência QA" no Básico (limite 1) com duas ofertas
-- aprovadas, "Concorrência QA E" e "Concorrência QA F".
--
-- ===========================================================================
-- Cenário 1 — dois admins ativando ofertas do mesmo negócio ao mesmo tempo
-- ===========================================================================
-- Abra duas sessões psql no banco de desenvolvimento.
--
-- Sessão A:
--   begin;
--   select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000002', true);
--   set local role authenticated;
--   select public.publish_offer((select offer_id from public.offer_versions where title = 'Concorrência QA E'));
--   -- NÃO confirme ainda.
--
-- Sessão B:
--   begin;
--   select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000002', true);
--   set local role authenticated;
--   set local lock_timeout = '60s';
--   select public.publish_offer((select offer_id from public.offer_versions where title = 'Concorrência QA F'));
--   -- Esperado: fica aguardando (bloqueio do negócio).
--
-- Sessão A: commit;
-- Sessão B: esperado ERROR plan_offer_limit_reached. Depois: rollback;
--
-- Conferência (qualquer sessão, como postgres):
--   select v.title, o.status from public.offers o
--     join public.offer_versions v on v.offer_id = o.id and v.version_number = 1
--    where o.business_id = '73000000-0000-4000-8000-0000000000b1' order by v.title;
--   Esperado: E = active, F = approved.
--
-- ===========================================================================
-- Cenário 2 — troca de plano concorrente com publicação
-- ===========================================================================
-- Sessão A:
--   begin;
--   select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000002', true);
--   set local role authenticated;
--   select public.admin_set_business_plan('73000000-0000-4000-8000-0000000000b1', 'profissional', 'QA concorrência');
--   -- NÃO confirme ainda.
--
-- Sessão B:
--   begin;
--   select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000002', true);
--   set local role authenticated;
--   set local lock_timeout = '60s';
--   select public.publish_offer((select offer_id from public.offer_versions where title = 'Concorrência QA F'));
--   -- Esperado: fica aguardando.
--
-- Sessão A: commit;
-- Sessão B: esperado retorno `active` — a publicação enxerga o plano novo
--           depois de obter o bloqueio. Depois: commit;
--
-- Conferência: E = active, F = active; duas linhas em business_plan_assignments.
--
-- Por fim, execute offers_concurrency_cleanup.sql.
-- ===========================================================================

begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
    if exists (select 1 from auth.users where id::text like '73000000-0000-4000-8000-%') then
        raise exception 'offers_concurrency_fixture_exists: execute offers_concurrency_cleanup.sql antes';
    end if;
end;
$$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at) values
    ('73000000-0000-4000-8000-000000000001', 'offers.concurrency.owner@example.test', now(), '{"full_name":"Owner Concorrência QA"}', now(), now()),
    ('73000000-0000-4000-8000-000000000002', 'offers.concurrency.admin@example.test', now(), '{"full_name":"Admin Concorrência QA"}', now(), now());
insert into public.user_roles (user_id, role) values ('73000000-0000-4000-8000-000000000002', 'admin');
insert into public.categories (id, name, slug, order_index)
values ('73000000-0000-4000-8000-0000000000c1', 'Concorrência QA', 'concorrencia-qa', 998);

-- Negócio criado pelo admin com id fixo, vinculado ao proprietário e no Básico.
insert into public.businesses (id, slug, name, description, service_area, phone, status, owner_id)
values (
    '73000000-0000-4000-8000-0000000000b1', 'concorrencia-qa', 'Concorrência QA',
    'Cadastro descartável para homologação de concorrência.', 'Pitimbu e região', '83991119999',
    'active', '73000000-0000-4000-8000-000000000001'
);
insert into public.business_categories (business_id, category_id, is_primary)
values ('73000000-0000-4000-8000-0000000000b1', '73000000-0000-4000-8000-0000000000c1', true);
insert into public.business_plan_assignments (business_id, plan_id, assigned_by, note)
values ('73000000-0000-4000-8000-0000000000b1', 'basico', '73000000-0000-4000-8000-000000000002', 'QA concorrência');

create function pg_temp.approved_offer(p_title text) returns void
language plpgsql as $$
declare
    v_offer uuid;
begin
    perform set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000001', true);
    v_offer := public.create_offer('73000000-0000-4000-8000-0000000000b1', jsonb_build_object(
        'title', p_title,
        'description', 'Oferta descartável para homologação de concorrência.',
        'benefit_type', 'gift',
        'starts_at', now() - interval '1 hour',
        'ends_at', now() + interval '7 days',
        'coupon_validity_minutes', 60
    ));
    perform public.accept_offer_financial_terms(v_offer, 1.50);
    perform public.submit_offer_for_review(v_offer);
    perform set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000002', true);
    perform public.approve_offer(v_offer);
end;
$$;

-- As RPCs são SECURITY DEFINER e identificam a conta por auth.uid(); aqui
-- rodam a partir da sessão postgres com o JWT simulado de cada papel.
select pg_temp.approved_offer('Concorrência QA E');
select pg_temp.approved_offer('Concorrência QA F');
select set_config('request.jwt.claim.sub', '', true);

select v.title, o.status, o.id
  from public.offers o
  join public.offer_versions v on v.offer_id = o.id
 where o.business_id = '73000000-0000-4000-8000-0000000000b1'
 order by v.title;

commit;
