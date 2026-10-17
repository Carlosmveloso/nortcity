-- Concorrência da utilização de cupons — APENAS farol-pitimbu-dev.
--
-- Depois de offers_e2e_dev_setup.sql (sem outras ofertas ativas no negócio
-- 74000000-…). Sobe o negócio para Premium (5 ofertas ativas), cadastra a
-- conta 74…04 como validadora, publica uma oferta por cenário e gera um
-- cupom do consumidor 74…03 em cada. Limpeza: offers_e2e_dev_cleanup.sql.
--
-- Método (o mesmo das Sprints 1 e 2): duas conexões em paralelo. A sessão 1
-- faz a operação e segura as travas com pg_sleep(20) antes do COMMIT; a
-- sessão 2 só age depois de VER a sessão 1 dormindo (pg_stat_activity) e
-- registra esse instante, a chamada e o retorno. O laço de detecção precisa
-- chamar pg_stat_clear_snapshot() a cada volta: pg_stat_activity é lido uma
-- vez por transação, e sem isso a sessão 1 pode nunca aparecer. Resultado com
-- a sessão 2 marcada como "não viu" não prova simultaneidade e é descartado.
--
-- | Cenário | Sessão 1                          | Sessão 2                               | Esperado da sessão 2           |
-- |---------|-----------------------------------|----------------------------------------|--------------------------------|
-- | A       | dono confirma o cupom A           | validador confirma o mesmo cupom       | coupon_already_used            |
-- | B       | validador confirma o cupom B      | o mesmo validador confirma de novo     | coupon_already_used            |
-- | C       | dono confirma o cupom C (limite 1)| o consumidor tenta gerar outro cupom   | user_limit_reached             |
-- | D1      | dono confirma o cupom D1          | expire_due_coupons no vencimento       | 0 expirados; D1 termina used   |
-- | D2      | expire_due_coupons segura D2      | dono confirma D2                       | coupon_expired; sem utilização |
--
-- Em D, o vencimento é simulado com expire_due_coupons(now() + 2 horas).
--
-- Conferência:
--   select v.title, c.status, (select count(*) from public.coupon_usages u where u.coupon_id = c.id) usages,
--          (select count(*) from public.fee_ledger_entries l join public.coupon_usages u on u.id = l.coupon_usage_id
--            where u.coupon_id = c.id) fees
--     from public.coupons c join public.offer_versions v on v.id = c.offer_version_id
--    where v.title like 'Concorrência uso%' order by v.title, c.generated_at;

begin;
set local statement_timeout = '60s';

select set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000002', true);
select public.admin_set_business_plan('74000000-0000-4000-8000-0000000000b1', 'premium', 'Concorrência de utilização');
select set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000001', true);
select public.owner_add_validator('74000000-0000-4000-8000-0000000000b1', 'offers.e2e.validator@example.test')
 where not exists (select 1 from public.business_validators
                    where business_id = '74000000-0000-4000-8000-0000000000b1'
                      and user_id = '74000000-0000-4000-8000-000000000004' and active);

create function pg_temp.scenario(p_title text) returns text
language plpgsql as $$
declare
    v_offer uuid;
    v_code text;
begin
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000001', true);
    v_offer := public.create_offer('74000000-0000-4000-8000-0000000000b1', jsonb_build_object(
        'title', p_title, 'description', 'Oferta do teste de concorrência de utilização.', 'benefit_type', 'gift',
        'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '2 days',
        'per_user_limit', 1, 'coupon_validity_minutes', 60));
    perform public.accept_offer_financial_terms(v_offer,
        (public.get_business_offer_terms('74000000-0000-4000-8000-0000000000b1') ->> 'fee_amount')::numeric);
    perform public.submit_offer_for_review(v_offer);
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000002', true);
    perform public.approve_offer(v_offer);
    perform public.publish_offer(v_offer);
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000003', true);
    v_code := public.generate_coupon(v_offer, '2026-10-v1') ->> 'code';
    perform set_config('request.jwt.claim.sub', '', true);
    return v_code;
end;
$$;

select pg_temp.scenario('Concorrência uso A') as a, pg_temp.scenario('Concorrência uso B') as b,
       pg_temp.scenario('Concorrência uso C') as c, pg_temp.scenario('Concorrência uso D1') as d1,
       pg_temp.scenario('Concorrência uso D2') as d2;
commit;
