-- Homologação dos cupons (Sprint 2) — APENAS farol-pitimbu-dev.
--
-- Pré-requisitos: migration 20261007000001 aplicada e segredo
-- `coupon_qr_key_v1` criado no Vault do projeto (ver docs/ambientes.md).
-- Executar como postgres. Tudo em uma transação com ROLLBACK.
-- Sucesso: última linha `coupons_qa_passed_with_rollback`.

begin;
set local statement_timeout = '60s';
set local lock_timeout = '5s';

create temp table qa_ids (key text primary key, id uuid not null);
create temp table qa_values (key text primary key, value text);
grant all on qa_ids, qa_values to authenticated, anon, service_role;

create function pg_temp.qa(p_key text) returns uuid language sql stable as $$ select id from qa_ids where key = p_key $$;
create function pg_temp.val(p_key text) returns text language sql stable as $$ select value from qa_values where key = p_key $$;
create function pg_temp.check(p_condition boolean, p_message text) returns void
language plpgsql as $$
begin
    if not coalesce(p_condition, false) then raise exception 'coupons_qa_failed: %', p_message; end if;
end;
$$;
create function pg_temp.expect_error(p_sql text, p_expected text, p_label text) returns void
language plpgsql as $$
begin
    begin
        execute p_sql;
    exception when others then
        if sqlstate = p_expected or position(p_expected in sqlerrm) > 0 then return; end if;
        raise exception 'coupons_qa_failed: % (recebido % / %)', p_label, sqlstate, sqlerrm;
    end;
    raise exception 'coupons_qa_failed: % (a operação foi concluída sem erro)', p_label;
end;
$$;
grant execute on function pg_temp.qa(text), pg_temp.val(text), pg_temp.check(boolean, text), pg_temp.expect_error(text, text, text)
    to authenticated, anon, service_role;

create function pg_temp.as_user(p_id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p_id, true) $$;

-- ---------------------------------------------------------------------------
-- 0. Catálogo, grants, cron e chave
-- ---------------------------------------------------------------------------

select pg_temp.check(public.coupon_qr_current_key_version() >= 1, '0.1 segredo coupon_qr_key_vN presente no Vault');
select pg_temp.check(public.current_coupon_terms_version() = '2026-10-v1', '0.2 regulamento vigente 2026-10-v1');
select pg_temp.check(
    (select jsonb_array_length(content) = 11 from public.coupon_terms where version = '2026-10-v1'),
    '0.3 regulamento com introdução e 10 seções'
);
select pg_temp.check(
    (select count(*) = 1 and bool_and(schedule = '*/5 * * * *' and command = 'select public.expire_due_coupons()' and active)
       from cron.job where jobname = 'coupon-expiration'),
    '0.4 cron coupon-expiration ativo'
);
select pg_temp.check(
    not has_table_privilege('anon', 'public.coupons', 'SELECT')
    and not has_table_privilege('anon', 'public.coupon_events', 'SELECT')
    and has_table_privilege('anon', 'public.coupon_terms', 'SELECT')
    and (select bool_and(not has_table_privilege(r, t, p))
           from unnest(array['anon', 'authenticated']) r,
                unnest(array['public.coupons', 'public.coupon_events', 'public.coupon_terms']) t,
                unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p)
    and not has_column_privilege('authenticated', 'public.coupons', 'qr_token_hash', 'SELECT')
    and has_column_privilege('authenticated', 'public.coupons', 'code', 'SELECT'),
    '0.5 grants de tabelas e colunas'
);
select pg_temp.check(
    (select bool_and(not has_function_privilege('anon', f, 'EXECUTE'))
       from unnest(array['public.generate_coupon(uuid,text)', 'public.get_my_coupons()', 'public.get_my_coupon(uuid)',
                         'public.get_coupon_qr_token(uuid)', 'public.admin_cancel_coupon(uuid,text)']) f)
    and (select bool_and(not has_function_privilege(r, f, 'EXECUTE'))
           from unnest(array['anon', 'authenticated']) r,
                unnest(array['public.expire_due_coupons(timestamptz,uuid)', 'public.coupon_qr_token(uuid,integer)',
                             'public.generate_coupon_code()', 'public.coupon_qr_current_key_version()',
                             'public.begin_coupon_write()', 'public.coupon_view(public.coupons)']) f)
    and has_function_privilege('anon', 'public.offer_coupon_availability(uuid[])', 'EXECUTE'),
    '0.6 privilégios de função'
);

-- ---------------------------------------------------------------------------
-- 1. Massa
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at) values
    ('76000000-0000-4000-8000-000000000001', 'coupons.owner@example.test', now(), '{}', now(), now()),
    ('76000000-0000-4000-8000-000000000002', 'coupons.alice@example.test', now(), '{}', now(), now()),
    ('76000000-0000-4000-8000-000000000003', 'coupons.bob@example.test', now(), '{}', now(), now()),
    ('76000000-0000-4000-8000-000000000004', 'coupons.admin@example.test', now(), '{}', now(), now());
insert into public.user_roles (user_id, role) values ('76000000-0000-4000-8000-000000000004', 'admin');
insert into public.categories (id, name, slug, order_index) values ('76000000-0000-4000-8000-0000000000c1', 'Cupons QA', 'cupons-qa', 995);

select pg_temp.as_user('76000000-0000-4000-8000-000000000001');
insert into qa_ids values ('biz', public.submit_business(
    '{"name":"Restaurante Cupons QA","description":"Cadastro descartável dos cupons.","service_area":"Pitimbu","phone":"83991114444"}',
    array['76000000-0000-4000-8000-0000000000c1'::uuid], '76000000-0000-4000-8000-0000000000c1'::uuid));
select pg_temp.as_user('76000000-0000-4000-8000-000000000004');
select public.moderate_business(pg_temp.qa('biz'), 'approve');
select public.admin_set_business_plan(pg_temp.qa('biz'), 'profissional', 'Cupons QA');

create function pg_temp.offer(p_key text, p_title text, p_limit int, p_validity int) returns void
language plpgsql as $$
declare v_id uuid;
begin
    perform pg_temp.as_user('76000000-0000-4000-8000-000000000001');
    v_id := public.create_offer(pg_temp.qa('biz'), jsonb_build_object(
        'title', p_title, 'description', 'Oferta descartável dos cupons.', 'benefit_type', 'gift',
        'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '10 days',
        'total_limit', p_limit, 'coupon_validity_minutes', p_validity));
    insert into qa_ids values (p_key, v_id);
    perform public.accept_offer_financial_terms(v_id, 1.00);
    perform public.submit_offer_for_review(v_id);
    perform pg_temp.as_user('76000000-0000-4000-8000-000000000004');
    perform public.approve_offer(v_id);
    perform public.publish_offer(v_id);
end;
$$;
select pg_temp.offer('limited', 'Cupom limitado QA', 1, 60);
select pg_temp.offer('open', 'Cupom livre QA', null, 60);
select pg_temp.as_user('');

-- ---------------------------------------------------------------------------
-- 2. Geração como authenticated
-- ---------------------------------------------------------------------------

select pg_temp.as_user('76000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.expect_error(format('select public.generate_coupon(%L, null)', pg_temp.qa('limited')), 'terms_not_accepted', '2.1 sem aceite');
select pg_temp.expect_error(format('select public.generate_coupon(%L, %L)', pg_temp.qa('limited'), '2020-01-v1'), 'terms_outdated', '2.2 versão antiga');
insert into qa_ids select 'alice_coupon', (public.generate_coupon(pg_temp.qa('limited'), '2026-10-v1') ->> 'coupon_id')::uuid;
select pg_temp.expect_error(format('select public.generate_coupon(%L, %L)', pg_temp.qa('limited'), '2026-10-v1'), 'coupon_already_available', '2.3 segundo disponível do mesmo usuário');
select pg_temp.check((select count(*) = 1 from public.coupons), '2.4 alice lê só o próprio cupom');
insert into qa_values values ('alice_token', public.get_coupon_qr_token(pg_temp.qa('alice_coupon')));
select pg_temp.expect_error('select qr_token_hash from public.coupons', '42501', '2.5 hash do QR fora do alcance');
reset role;

select pg_temp.check(
    (select c.status = 'available' and c.offer_version_id = o.published_version_id and c.business_id = pg_temp.qa('biz')
            and c.code ~ '^FP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' and c.terms_version = '2026-10-v1'
            and c.expires_at = c.generated_at + interval '60 minutes' and c.qr_key_version >= 1
       from public.coupons c join public.offers o on o.id = c.offer_id where c.id = pg_temp.qa('alice_coupon')),
    '2.6 cupom com versão publicada, código, validade e aceite'
);
select pg_temp.check(
    (select qr_token_hash = encode(extensions.digest(pg_temp.val('alice_token'), 'sha256'), 'hex')
       from public.coupons where id = pg_temp.qa('alice_coupon'))
    and pg_temp.val('alice_token') ~ '^[A-Za-z0-9_-]{43}$',
    '2.7 token HMAC do dono confere com o hash guardado'
);
select pg_temp.check(
    (select count(*) = 1 from public.coupon_events
      where coupon_id = pg_temp.qa('alice_coupon') and action = 'generated' and actor_id = '76000000-0000-4000-8000-000000000002'),
    '2.8 evento generated com autor'
);

-- ---------------------------------------------------------------------------
-- 3. Outro usuário, visitante e vagas
-- ---------------------------------------------------------------------------

select pg_temp.as_user('76000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.expect_error(format('select public.generate_coupon(%L, %L)', pg_temp.qa('limited'), '2026-10-v1'), 'offer_sold_out', '3.1 vaga única ocupada');
select pg_temp.check((select count(*) = 0 from public.coupons), '3.2 bob não lê o cupom de alice');
select pg_temp.expect_error(format('select public.get_my_coupon(%L)', pg_temp.qa('alice_coupon')), 'coupon_not_found', '3.3 bob não abre o cupom de alice');
select pg_temp.expect_error(format('select public.get_coupon_qr_token(%L)', pg_temp.qa('alice_coupon')), 'coupon_not_found', '3.4 bob não obtém o token de alice');
select pg_temp.expect_error(format('select public.admin_cancel_coupon(%L, %L)', pg_temp.qa('alice_coupon'), 'x'), 'forbidden', '3.5 usuário não cancela');
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.expect_error('select id from public.coupons', '42501', '3.6 visitante não lê cupons');
select pg_temp.expect_error(format('select public.generate_coupon(%L, %L)', pg_temp.qa('open'), '2026-10-v1'), '42501', '3.7 visitante não gera');
select pg_temp.check(
    (select available = false from public.offer_coupon_availability(array[pg_temp.qa('limited')])),
    '3.8 disponibilidade pública: esgotada'
);
select pg_temp.check(
    (select available from public.offer_coupon_availability(array[pg_temp.qa('open')])),
    '3.9 disponibilidade pública: sem limite'
);
reset role;

-- ---------------------------------------------------------------------------
-- 4. Versão congelada
-- ---------------------------------------------------------------------------

select pg_temp.as_user('76000000-0000-4000-8000-000000000001');
select public.create_offer_revision(pg_temp.qa('limited'));
select public.update_offer_draft(pg_temp.qa('limited'), '{"title":"Cupom limitado QA v2"}');
select public.accept_offer_financial_terms(pg_temp.qa('limited'), 1.00);
select public.submit_offer_for_review(pg_temp.qa('limited'));
select pg_temp.as_user('76000000-0000-4000-8000-000000000004');
select public.approve_offer(pg_temp.qa('limited'));
select public.publish_offer(pg_temp.qa('limited'));
select pg_temp.as_user('76000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.check(
    (public.get_my_coupon(pg_temp.qa('alice_coupon')) -> 'version' ->> 'title') = 'Cupom limitado QA'
    and (public.get_my_coupon(pg_temp.qa('alice_coupon')) -> 'version' ->> 'version_number') = '1'
    and (public.get_my_coupon(pg_temp.qa('alice_coupon')) -> 'version') ? 'fee_amount' = false,
    '4.1 cupom mostra a versão 1 aceita, sem taxa'
);
reset role;

-- ---------------------------------------------------------------------------
-- 5. Expiração e devolução da vaga
-- ---------------------------------------------------------------------------

select pg_temp.check(public.expire_due_coupons(now() + interval '59 minutes') = 0, '5.1 antes do vencimento nada expira');
select pg_temp.check(public.expire_due_coupons(now() + interval '2 hours') >= 1, '5.2 vencido expira');
select pg_temp.check(public.expire_due_coupons(now() + interval '2 hours') = 0, '5.3 segunda execução não repete');
select pg_temp.check(
    (select status = 'expired' and expired_at is not null from public.coupons where id = pg_temp.qa('alice_coupon'))
    and (select count(*) = 1 from public.coupon_events where coupon_id = pg_temp.qa('alice_coupon') and action = 'expired' and actor_id is null),
    '5.4 expirado pelo sistema, um evento só'
);
select pg_temp.check(
    (select available from public.offer_coupon_availability(array[pg_temp.qa('limited')])),
    '5.5 vaga devolvida'
);
select pg_temp.as_user('76000000-0000-4000-8000-000000000003');
set local role authenticated;
insert into qa_ids select 'bob_coupon', (public.generate_coupon(pg_temp.qa('limited'), '2026-10-v1') ->> 'coupon_id')::uuid;
reset role;
select pg_temp.check(
    (select offer_version_id = (select published_version_id from public.offers where id = pg_temp.qa('limited'))
       from public.coupons where id = pg_temp.qa('bob_coupon')),
    '5.6 novo cupom usa a versão 2 publicada'
);

-- ---------------------------------------------------------------------------
-- 6. Escrita direta e cancelamento
-- ---------------------------------------------------------------------------

select pg_temp.as_user('76000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.expect_error(format($q$update public.coupons set status = 'expired' where id = %L$q$, pg_temp.qa('bob_coupon')), '42501', '6.1 usuário não altera');
select pg_temp.expect_error(format('delete from public.coupons where id = %L', pg_temp.qa('bob_coupon')), '42501', '6.2 usuário não apaga');
reset role;
set local role service_role;
select pg_temp.expect_error(format($q$update public.coupons set status = 'expired', expired_at = now() where id = %L$q$, pg_temp.qa('bob_coupon')), 'direct_write_not_allowed', '6.3 service_role não expira por fora');
select pg_temp.expect_error(format($q$update public.coupons set expires_at = expires_at + interval '1 day' where id = %L$q$, pg_temp.qa('bob_coupon')), 'coupon_immutable', '6.4 validade imutável');
select pg_temp.expect_error(format($q$insert into public.coupon_events (coupon_id, action) values (%L, 'expired')$q$, pg_temp.qa('bob_coupon')), 'direct_write_not_allowed', '6.5 evento à mão recusado');
select pg_temp.expect_error(format('delete from public.coupons where id = %L', pg_temp.qa('bob_coupon')), 'coupon_not_deletable', '6.6 cupom não é apagado');
reset role;
select pg_temp.expect_error(format($q$update public.coupons set status = 'canceled', canceled_at = now(), cancel_reason = 'x' where id = %L$q$, pg_temp.qa('bob_coupon')), 'direct_write_not_allowed', '6.7 postgres depois de RPCs também é recusado');
select pg_temp.expect_error($q$update public.coupon_terms set title = 'x'$q$, 'terms_immutable', '6.8 regulamento publicado imutável');

select pg_temp.as_user('76000000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.expect_error(format('select public.admin_cancel_coupon(%L, %L)', pg_temp.qa('bob_coupon'), ' '), 'reason_required', '6.9 cancelar exige motivo');
select public.admin_cancel_coupon(pg_temp.qa('bob_coupon'), 'Uso indevido identificado.');
reset role;
select pg_temp.check(
    (select status = 'canceled' and cancel_reason = 'Uso indevido identificado.' and canceled_by = '76000000-0000-4000-8000-000000000004'
       from public.coupons where id = pg_temp.qa('bob_coupon')),
    '6.10 cancelado com motivo e autor'
);
select pg_temp.as_user('76000000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.expect_error(format('select public.admin_cancel_coupon(%L, %L)', pg_temp.qa('bob_coupon'), 'De novo.'), 'invalid_transition', '6.11 cancelado não volta nem recancela');
reset role;

-- ---------------------------------------------------------------------------
-- 7. Suspensão da oferta não cancela cupons emitidos
-- ---------------------------------------------------------------------------

select pg_temp.as_user('76000000-0000-4000-8000-000000000002');
set local role authenticated;
insert into qa_ids select 'open_coupon', (public.generate_coupon(pg_temp.qa('open'), '2026-10-v1') ->> 'coupon_id')::uuid;
reset role;
select pg_temp.as_user('76000000-0000-4000-8000-000000000004');
select public.suspend_offer(pg_temp.qa('open'), 'Apuração.');
select pg_temp.check((select status = 'available' from public.coupons where id = pg_temp.qa('open_coupon')), '7.1 cupom emitido continua disponível');
select pg_temp.as_user('76000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.expect_error(format('select public.generate_coupon(%L, %L)', pg_temp.qa('open'), '2026-10-v1'), 'offer_not_active', '7.2 oferta suspensa não emite');
reset role;

rollback;
select 'coupons_qa_passed_with_rollback' as result;
