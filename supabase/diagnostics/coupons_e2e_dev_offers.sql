-- Ofertas do E2E real de cupons — APENAS farol-pitimbu-dev.
--
-- Depois de offers_e2e_dev_setup.sql. Publica duas ofertas no negócio
-- 74000000-…-0000000000b1, uma por projeto do Playwright, com 1 vaga e
-- cupom válido por 1 minuto (o banco aceita qualquer validade positiva; a
-- interface oferece de 2 h a 7 dias). Assim o teste observa a expiração e a
-- devolução da vaga sem esperar horas. Limpeza: offers_e2e_dev_cleanup.sql.

begin;
set local statement_timeout = '30s';

create function pg_temp.coupon_offer(p_title text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000001', true);
    v_id := public.create_offer('74000000-0000-4000-8000-0000000000b1', jsonb_build_object(
        'title', p_title, 'description', 'Oferta do E2E real de cupons.', 'benefit_type', 'gift',
        'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '2 days',
        'total_limit', 1, 'per_user_limit', 1, 'coupon_validity_minutes', 1));
    perform public.accept_offer_financial_terms(v_id, 1.00);
    perform public.submit_offer_for_review(v_id);
    perform set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000002', true);
    perform public.approve_offer(v_id);
    perform public.publish_offer(v_id);
    perform set_config('request.jwt.claim.sub', '', true);
    return v_id;
end;
$$;

select pg_temp.coupon_offer('Cupom E2E desktop') as desktop, pg_temp.coupon_offer('Cupom E2E mobile') as mobile;
commit;
