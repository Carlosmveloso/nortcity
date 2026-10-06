-- Concorrência da geração de cupons — APENAS farol-pitimbu-dev.
--
-- Depois de offers_e2e_dev_setup.sql (contas e negócio 74000000-…). Publica
-- duas ofertas: "Concorrência 1 vaga" (total_limit 1) e "Concorrência sem
-- limite". Limpeza: offers_e2e_dev_cleanup.sql.
--
-- Cada cenário usa duas sessões (psql ou duas chamadas paralelas da
-- Management API). A sessão 1 gera o cupom e segura a trava da oferta com
-- pg_sleep antes do COMMIT; a sessão 2 só chama generate_coupon depois de
-- ver a sessão 1 dormindo e mede a própria espera.
--
-- ===========================================================================
-- Cenário A — dois usuários, 1 vaga. Esperado: 1 sucesso e offer_sold_out.
-- ===========================================================================
-- Sessão 1 (consumidor 74…03):
--   begin;
--   select set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000003', true);
--   set local role authenticated;
--   select public.generate_coupon((select offer_id from public.offer_versions where title = 'Concorrência 1 vaga'), '2026-10-v1');
--   reset role;
--   select pg_sleep(20) /* qa_coupon_session_1 */;
--   commit;
--
-- Sessão 2 (proprietário 74…01, como outro consumidor), iniciada em paralelo:
--   create temp table qa_b (k text, at timestamptz default clock_timestamp());
--   grant all on qa_b to authenticated;
--   do $$ begin
--       loop
--           exit when exists (select 1 from pg_stat_activity where pid <> pg_backend_pid()
--                              and wait_event = 'PgSleep' and query like '%qa_coupon_' || 'session_1%');
--           perform pg_sleep(0.3);
--       end loop;
--   end $$;
--   begin;
--   select set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000001', true);
--   set local role authenticated;
--   insert into qa_b (k) values ('called');
--   do $$ begin
--       perform public.generate_coupon((select offer_id from public.offer_versions where title = 'Concorrência 1 vaga'), '2026-10-v1');
--       insert into qa_b (k) values ('ok');
--   exception when others then insert into qa_b (k) values ('error:' || sqlerrm);
--   end $$;
--   commit;
--   select k, at from qa_b order by at;
--
-- ===========================================================================
-- Cenário B — mesmo usuário, duas chamadas. Esperado: 1 cupom available e
-- coupon_already_available.
-- ===========================================================================
-- Igual ao cenário A, com a oferta "Concorrência sem limite" e o MESMO
-- usuário (74…03) nas duas sessões.
--
-- Conferência:
--   select v.title, c.user_id, c.status from public.coupons c
--     join public.offer_versions v on v.id = c.offer_version_id
--    where v.title like 'Concorrência%' order by v.title, c.generated_at;
-- ===========================================================================

begin;
set local statement_timeout = '30s';

create function pg_temp.concurrency_offer(p_title text, p_limit int) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000001', true);
    v_id := public.create_offer('74000000-0000-4000-8000-0000000000b1', jsonb_build_object(
        'title', p_title, 'description', 'Oferta do teste de concorrência de cupons.', 'benefit_type', 'gift',
        'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '2 days',
        'total_limit', p_limit, 'coupon_validity_minutes', 60));
    perform public.accept_offer_financial_terms(v_id, 1.00);
    perform public.submit_offer_for_review(v_id);
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000002', true);
    perform public.approve_offer(v_id);
    perform public.publish_offer(v_id);
    perform set_config('request.jwt.claim.sub', '', true);
    return v_id;
end;
$$;

select pg_temp.concurrency_offer('Concorrência 1 vaga', 1) as one_slot,
       pg_temp.concurrency_offer('Concorrência sem limite', null) as unlimited;
commit;
