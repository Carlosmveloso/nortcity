-- Ofertas do E2E real de utilização de cupons — APENAS farol-pitimbu-dev.
--
-- Depois de offers_e2e_dev_setup.sql. Publica "Uso E2E desktop" e "Uso E2E
-- mobile" (todos os dias, dia inteiro, 1 utilização por pessoa, cupom de 60
-- minutos) e cadastra a conta 74…04 como validadora pelo proprietário.
-- Limpeza: offers_e2e_dev_cleanup.sql.

begin;
set local statement_timeout = '30s';

create function pg_temp.usage_offer(p_title text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000001', true);
    v_id := public.create_offer('74000000-0000-4000-8000-0000000000b1', jsonb_build_object(
        'title', p_title, 'description', 'Oferta do E2E real de utilização.', 'benefit_type', 'percentage_discount',
        'benefit_value', 15, 'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '2 days',
        'per_user_limit', 1, 'coupon_validity_minutes', 60, 'minimum_purchase', 50));
    perform public.accept_offer_financial_terms(v_id,
        (public.get_business_offer_terms('74000000-0000-4000-8000-0000000000b1') ->> 'fee_amount')::numeric);
    perform public.submit_offer_for_review(v_id);
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000002', true);
    perform public.approve_offer(v_id);
    perform public.publish_offer(v_id);
    perform set_config('request.jwt.claim.sub', '', true);
    return v_id;
end;
$$;

select pg_temp.usage_offer('Uso E2E desktop') as desktop, pg_temp.usage_offer('Uso E2E mobile') as mobile;

select set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000001', true);
select public.owner_add_validator('74000000-0000-4000-8000-0000000000b1', 'offers.e2e.validator@example.test') as validator_link;
select set_config('request.jwt.claim.sub', '', true);
commit;
