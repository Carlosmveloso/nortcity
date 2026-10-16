-- Homologação da validação e utilização de cupons (Sprint 3) — APENAS
-- farol-pitimbu-dev.
--
-- Pré-requisitos: migrations até 20261016000002 e segredo coupon_qr_key_v1
-- no Vault. Executar como postgres. Tudo em uma transação com ROLLBACK.
-- Sucesso: última linha `coupon_usage_qa_passed_with_rollback`.

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
    if not coalesce(p_condition, false) then raise exception 'coupon_usage_qa_failed: %', p_message; end if;
end;
$$;
create function pg_temp.expect_error(p_sql text, p_expected text, p_label text) returns void
language plpgsql as $$
begin
    begin
        execute p_sql;
    exception when others then
        if sqlstate = p_expected or position(p_expected in sqlerrm) > 0 then return; end if;
        raise exception 'coupon_usage_qa_failed: % (recebido % / %)', p_label, sqlstate, sqlerrm;
    end;
    raise exception 'coupon_usage_qa_failed: % (a operação foi concluída sem erro)', p_label;
end;
$$;
grant execute on function pg_temp.qa(text), pg_temp.val(text), pg_temp.check(boolean, text), pg_temp.expect_error(text, text, text)
    to authenticated, anon, service_role;
create function pg_temp.as_user(p_id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p_id, true) $$;

-- ---------------------------------------------------------------------------
-- 0. Catálogo, grants e privilégios
-- ---------------------------------------------------------------------------

select pg_temp.check(
    (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'coupon_status'::regtype)
        = array['available', 'expired', 'canceled', 'used'],
    '0.1 coupon_status com used'
);
select pg_temp.check(
    (select bool_and(not has_table_privilege('anon', t, 'SELECT'))
       from unnest(array['public.business_validators', 'public.coupon_usages', 'public.fee_ledger_entries']) t)
    and (select bool_and(not has_table_privilege(r, t, p))
           from unnest(array['anon', 'authenticated']) r,
                unnest(array['public.business_validators', 'public.coupon_usages', 'public.fee_ledger_entries']) t,
                unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p),
    '0.2 tabelas novas sem escrita e sem leitura para anon'
);
select pg_temp.check(
    (select bool_and(not has_function_privilege('anon', f, 'EXECUTE'))
       from unnest(array['public.verify_coupon(uuid,text)', 'public.confirm_coupon_usage(uuid,text)',
                         'public.owner_add_validator(uuid,text)', 'public.list_coupon_usages(uuid,timestamptz,timestamptz)',
                         'public.my_validation_businesses()']) f)
    and (select bool_and(not has_function_privilege(r, f, 'EXECUTE'))
           from unnest(array['anon', 'authenticated']) r,
                unnest(array['public.can_validate_business(uuid,uuid)', 'public.parse_coupon_input(text)',
                             'public.coupon_usage_window_open(uuid,timestamptz)', 'public.find_coupon_for_business(uuid,text)',
                             'public.require_validator(uuid)', 'public.coupon_version_public(uuid)']) f),
    '0.3 privilégios de função'
);
select pg_temp.check(
    not has_table_privilege('authenticated', 'public.coupon_verification_attempts', 'SELECT')
    and not has_table_privilege('anon', 'public.coupon_verification_attempts', 'SELECT')
    and (select bool_and(not has_function_privilege(r, f, 'EXECUTE'))
           from unnest(array['anon', 'authenticated']) r,
                unnest(array['public.assert_verification_attempts_allowed(uuid)',
                             'public.record_verification_attempt(uuid,uuid,coupon_validation_method,boolean)',
                             'public.purge_coupon_verification_attempts(timestamptz)']) f)
    and (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
          where table_schema = 'public' and table_name = 'coupon_verification_attempts')
        = array['id', 'validator_id', 'business_id', 'method', 'coupon_found', 'created_at']
    and (select count(*) = 1 and bool_and(schedule = '17 3 * * *' and active)
           from cron.job where jobname = 'coupon-verification-attempts-retention'),
    '0.5 tentativas: sem acesso, sem o valor digitado e com retenção agendada'
);
select pg_temp.check(public.coupon_qr_current_key_version() >= 1, '0.4 chave do QR presente');

-- ---------------------------------------------------------------------------
-- 1. Massa
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at) values
    ('77000000-0000-4000-8000-000000000001', 'usage.owner@example.test', now(), '{"full_name":"Dono QA"}', now(), now()),
    ('77000000-0000-4000-8000-000000000002', 'usage.staff@example.test', now(), '{"full_name":"Caixa QA"}', now(), now()),
    ('77000000-0000-4000-8000-000000000003', 'usage.customer@example.test', now(), '{"full_name":"Cliente QA"}', now(), now()),
    ('77000000-0000-4000-8000-000000000004', 'usage.other@example.test', now(), '{"full_name":"Outro dono QA"}', now(), now()),
    ('77000000-0000-4000-8000-000000000005', 'usage.admin@example.test', now(), '{"full_name":"Admin QA"}', now(), now());
insert into public.user_roles (user_id, role) values ('77000000-0000-4000-8000-000000000005', 'admin');
insert into public.categories (id, name, slug, order_index) values ('77000000-0000-4000-8000-0000000000c1', 'Uso QA', 'uso-qa', 994);

create function pg_temp.business(p_key text, p_owner text, p_name text, p_phone text) returns void
language plpgsql as $$
begin
    perform pg_temp.as_user(p_owner);
    insert into qa_ids values (p_key, public.submit_business(
        jsonb_build_object('name', p_name, 'description', 'Cadastro descartável de uso de cupons.', 'service_area', 'Pitimbu', 'phone', p_phone),
        array['77000000-0000-4000-8000-0000000000c1'::uuid], '77000000-0000-4000-8000-0000000000c1'::uuid));
    perform pg_temp.as_user('77000000-0000-4000-8000-000000000005');
    perform public.moderate_business(pg_temp.qa(p_key), 'approve');
    perform public.admin_set_business_plan(pg_temp.qa(p_key), 'profissional', 'Uso QA');
end;
$$;
select pg_temp.business('biz', '77000000-0000-4000-8000-000000000001', 'Restaurante Uso QA', '83991116661');
select pg_temp.business('other_biz', '77000000-0000-4000-8000-000000000004', 'Outro Uso QA', '83991116662');

create function pg_temp.offer(p_key text, p_title text, p_extra jsonb default '{}') returns void
language plpgsql as $$
declare v_id uuid;
begin
    perform pg_temp.as_user('77000000-0000-4000-8000-000000000001');
    v_id := public.create_offer(pg_temp.qa('biz'), jsonb_build_object(
        'title', p_title, 'description', 'Oferta de uso de cupons.', 'benefit_type', 'gift',
        'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '10 days',
        'coupon_validity_minutes', 60, 'per_user_limit', 1) || p_extra);
    insert into qa_ids values (p_key, v_id);
    perform public.accept_offer_financial_terms(v_id, 1.00);
    perform public.submit_offer_for_review(v_id);
    perform pg_temp.as_user('77000000-0000-4000-8000-000000000005');
    perform public.approve_offer(v_id);
    perform public.publish_offer(v_id);
end;
$$;
select pg_temp.offer('main', 'Uso principal QA');
-- Dia de hoje em Pitimbu + 1: nunca vale hoje.
select pg_temp.offer('closed', 'Uso fora do dia QA',
    jsonb_build_object('days_of_week', jsonb_build_array((extract(isodow from now() at time zone 'America/Fortaleza')::int % 7) + 1)));

create function pg_temp.generate(p_key text, p_offer text) returns void
language plpgsql as $$
begin
    perform pg_temp.as_user('77000000-0000-4000-8000-000000000003');
    insert into qa_ids select p_key, (public.generate_coupon(pg_temp.qa(p_offer), '2026-10-v1') ->> 'coupon_id')::uuid;
    insert into qa_values select p_key || '_code', code from public.coupons where id = pg_temp.qa(p_key);
    insert into qa_values values (p_key || '_qr', 'farol-cupom:1:' || public.get_coupon_qr_token(pg_temp.qa(p_key)));
end;
$$;
select pg_temp.generate('c1', 'main');
select pg_temp.generate('c_closed', 'closed');
select pg_temp.as_user('');

-- ---------------------------------------------------------------------------
-- 2. Validadores
-- ---------------------------------------------------------------------------

select pg_temp.as_user('77000000-0000-4000-8000-000000000001');
set local role authenticated;
insert into qa_ids select 'staff_link', public.owner_add_validator(pg_temp.qa('biz'), ' USAGE.STAFF@example.test ');
select pg_temp.expect_error(format('select public.owner_add_validator(%L, %L)', pg_temp.qa('biz'), 'nao.existe@example.test'), 'account_not_found', '2.1 conta inexistente');
select pg_temp.expect_error(format('select public.owner_add_validator(%L, %L)', pg_temp.qa('biz'), 'usage.owner@example.test'), 'validator_is_owner', '2.2 dono não se cadastra');
reset role;
select pg_temp.as_user('77000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.check(
    (public.my_validation_businesses() -> 0 ->> 'role') = 'validator',
    '2.3 caixa vê o negócio que valida'
);
reset role;

-- ---------------------------------------------------------------------------
-- 3. Verificação e confirmação
-- ---------------------------------------------------------------------------

select pg_temp.as_user('77000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.check(
    (public.verify_coupon(pg_temp.qa('biz'), pg_temp.val('c1_qr')) ->> 'method') = 'qr'
    and (public.verify_coupon(pg_temp.qa('biz'), lower(replace(pg_temp.val('c1_code'), '-', ' '))) ->> 'valid')::boolean,
    '3.1 QR e código normalizado encontram o cupom válido'
);
select pg_temp.check(
    position('77000000-0000-4000-8000-000000000003' in public.verify_coupon(pg_temp.qa('biz'), pg_temp.val('c1_code'))::text) = 0
    and position('fee' in public.verify_coupon(pg_temp.qa('biz'), pg_temp.val('c1_code'))::text) = 0,
    '3.2 verificação sem dados do cliente e sem taxa'
);
select pg_temp.check(
    (public.verify_coupon(pg_temp.qa('biz'), pg_temp.val('c_closed_code')) ->> 'reason') = 'offer_time_window_not_allowed',
    '3.3 fora do dia informado na verificação'
);
select pg_temp.expect_error(format('select public.confirm_coupon_usage(%L, %L)', pg_temp.qa('biz'), pg_temp.val('c_closed_code')), 'offer_time_window_not_allowed', '3.4 fora do dia recusado');
reset role;
-- Plano muda antes da utilização: a taxa continua a da versão (R$ 1,00).
select pg_temp.as_user('77000000-0000-4000-8000-000000000005');
select public.admin_set_business_plan(pg_temp.qa('biz'), 'premium', 'Uso QA');
select pg_temp.as_user('77000000-0000-4000-8000-000000000002');
set local role authenticated;
select public.confirm_coupon_usage(pg_temp.qa('biz'), pg_temp.val('c1_qr'));
select pg_temp.expect_error(format('select public.confirm_coupon_usage(%L, %L)', pg_temp.qa('biz'), pg_temp.val('c1_code')), 'coupon_already_used', '3.5 segunda confirmação recusada');
reset role;

select pg_temp.check(
    (select status = 'available' from public.coupons where id = pg_temp.qa('c_closed')),
    '3.6 cupom fora do horário continua disponível'
);
select pg_temp.check(
    (select c.status = 'used' and c.used_at is not null from public.coupons c where c.id = pg_temp.qa('c1'))
    and (select count(*) = 1 and bool_and(u.validator_id = '77000000-0000-4000-8000-000000000002' and u.validation_method = 'qr' and u.fee_amount = 1.00)
           from public.coupon_usages u where u.coupon_id = pg_temp.qa('c1'))
    and (select count(*) = 1 and bool_and(l.kind = 'usage_fee' and l.amount = 1.00)
           from public.fee_ledger_entries l join public.coupon_usages u on u.id = l.coupon_usage_id where u.coupon_id = pg_temp.qa('c1'))
    and (select count(*) = 1 from public.coupon_events where coupon_id = pg_temp.qa('c1') and action = 'used' and actor_id = '77000000-0000-4000-8000-000000000002'),
    '3.7 used, utilização, lançamento com taxa da versão e evento, uma vez só'
);

-- ---------------------------------------------------------------------------
-- 4. Quem não valida
-- ---------------------------------------------------------------------------

select pg_temp.as_user('77000000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.check(
    public.verify_coupon(pg_temp.qa('other_biz'), pg_temp.val('c_closed_code')) = '{"valid": false, "reason": "coupon_not_found"}'::jsonb,
    '4.1 outro negócio não enxerga o cupom'
);
select pg_temp.expect_error(format('select public.verify_coupon(%L, %L)', pg_temp.qa('biz'), pg_temp.val('c_closed_code')), 'not_a_validator', '4.2 dono de outro negócio não valida este');
reset role;
select pg_temp.as_user('77000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.expect_error(format('select public.verify_coupon(%L, %L)', pg_temp.qa('biz'), pg_temp.val('c_closed_code')), 'not_a_validator', '4.3 admin não valida');
reset role;
select pg_temp.as_user('77000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.owner_deactivate_validator(pg_temp.qa('staff_link'));
reset role;
select pg_temp.as_user('77000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.expect_error(format('select public.verify_coupon(%L, %L)', pg_temp.qa('biz'), pg_temp.val('c_closed_code')), 'not_a_validator', '4.4 validador desativado');
reset role;

-- ---------------------------------------------------------------------------
-- 5. Limites
-- ---------------------------------------------------------------------------

select pg_temp.as_user('77000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.expect_error(format('select public.generate_coupon(%L, %L)', pg_temp.qa('main'), '2026-10-v1'), 'user_limit_reached', '5.1 per_user_limit 1 atingido');
reset role;
select pg_temp.check(public.offer_reserved_coupons(pg_temp.qa('main')) = 1, '5.2 vagas contam used');
select pg_temp.check(public.expire_due_coupons(now() + interval '30 days') >= 1, '5.3 expira os disponíveis vencidos');
select pg_temp.check((select status = 'used' from public.coupons where id = pg_temp.qa('c1')), '5.4 expiração não toca em used');

-- ---------------------------------------------------------------------------
-- 6. Leitura e escrita protegida
-- ---------------------------------------------------------------------------

select pg_temp.as_user('77000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.check(jsonb_array_length(public.list_coupon_usages(pg_temp.qa('biz'))) = 1, '6.1 dono lista as utilizações');
select pg_temp.check((select count(*) = 0 from public.coupon_usages), '6.2 dono não lê a tabela direto');
reset role;
select pg_temp.as_user('77000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.check((public.get_my_coupon(pg_temp.qa('c1')) ->> 'status') = 'used', '6.3 cliente vê utilizado');
select pg_temp.expect_error(format('select public.list_coupon_usages(%L)', pg_temp.qa('biz')), 'forbidden', '6.4 cliente não lista utilizações');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.expect_error('select * from public.coupon_usages', '42501', '6.5 visitante sem acesso');
reset role;

set local role service_role;
select pg_temp.expect_error($q$update public.coupon_usages set fee_amount = 0.01$q$, 'record_immutable', '6.6 utilização imutável');
select pg_temp.expect_error($q$delete from public.fee_ledger_entries$q$, 'record_immutable', '6.7 lançamento imutável');
select pg_temp.expect_error(format($q$update public.coupons set status = 'available', used_at = null where id = %L$q$, pg_temp.qa('c1')), 'invalid_transition', '6.8 used é terminal');
select pg_temp.expect_error(format($q$insert into public.business_validators (business_id, user_id, added_by) values (%L, %L, %L)$q$,
    pg_temp.qa('biz'), '77000000-0000-4000-8000-000000000003', '77000000-0000-4000-8000-000000000001'), 'direct_write_not_allowed', '6.9 validador à mão recusado');
reset role;
select pg_temp.expect_error(format($q$insert into public.fee_ledger_entries (business_id, kind, coupon_usage_id, amount)
    select business_id, 'usage_fee', id, 5 from public.coupon_usages where coupon_id = %L$q$, pg_temp.qa('c1')), 'direct_write_not_allowed', '6.10 postgres depois de RPCs também é recusado');

-- ---------------------------------------------------------------------------
-- 7. Limite de tentativas (20 falhas em 10 minutos por validador)
-- ---------------------------------------------------------------------------

select pg_temp.as_user('77000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$
declare v_result jsonb;
begin
    for i in 1..10 loop
        v_result := public.verify_coupon(pg_temp.qa('biz'), 'FP-ZZZZZ' || substr('23456789ABCDEFGH', i, 1));
    end loop;
    for i in 1..9 loop
        v_result := public.verify_coupon(pg_temp.qa('biz'), 'farol-cupom:1:' || repeat('Q', 42) || i::text);
    end loop;
    v_result := public.confirm_coupon_usage(pg_temp.qa('biz'), 'sem formato');
    perform pg_temp.check(v_result = '{"confirmed": false, "reason": "coupon_not_found"}'::jsonb, '7.1 confirmação sem cupom vira resultado registrado');
end;
$$;
select pg_temp.expect_error(format('select public.verify_coupon(%L, %L)', pg_temp.qa('biz'), pg_temp.val('c_closed_code')), 'too_many_attempts', '7.2 21ª verificação bloqueada mesmo com código existente');
select pg_temp.expect_error(format('select public.confirm_coupon_usage(%L, %L)', pg_temp.qa('biz'), pg_temp.val('c_closed_code')), 'too_many_attempts', '7.3 confirmação também bloqueada');
reset role;
select pg_temp.check(
    (select count(*) filter (where not coupon_found) = 20 and count(distinct method) = 2
       from public.coupon_verification_attempts
      where validator_id = '77000000-0000-4000-8000-000000000001' and created_at > now() - interval '10 minutes'),
    '7.4 20 falhas registradas, QR e código somados'
);
select pg_temp.as_user('77000000-0000-4000-8000-000000000001');
set local role service_role;
select pg_temp.expect_error('delete from public.coupon_verification_attempts', 'direct_write_not_allowed', '7.5 service_role não apaga tentativas por fora');
reset role;
select pg_temp.check(public.purge_coupon_verification_attempts(now() + interval '31 days') >= 20, '7.6 retenção remove registros com mais de 30 dias');

rollback;
select 'coupon_usage_qa_passed_with_rollback' as result;
