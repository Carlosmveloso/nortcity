-- Sprint 3 — limite de tentativas na verificação de cupons (decisão de
-- 16/10/2026).
--
-- Regra: 20 verificações SEM ENCONTRAR cupom em uma janela móvel de 10
-- minutos, pelo mesmo validador, somando QR e código manual, bloqueiam novas
-- verificações (`too_many_attempts`) até as falhas antigas saírem da janela.
-- Tentativas que encontram o cupom são registradas, não contam e não zeram as
-- falhas. Não há `blocked_until`: a própria contagem decide. Sem limite por IP
-- ou por negócio nesta etapa.
--
-- Nada do que foi digitado é guardado (nem código nem token). Os registros
-- não são auditoria: ficam 30 dias e um job diário os remove.
--
-- Para a falha ficar registrada, "não encontrado" deixa de ser erro:
-- verify_coupon devolve `reason = coupon_not_found` e confirm_coupon_usage
-- devolve `confirmed = false`. Um erro desfaria a transação inteira, junto
-- com o registro da tentativa. Os demais motivos continuam como antes.
--
-- O limite é checado ANTES de procurar o cupom, para que tempo e resposta
-- não diferenciem código existente de inexistente quando já bloqueado.

create table public.coupon_verification_attempts (
    id bigint generated always as identity primary key,
    validator_id uuid not null references public.profiles(id),
    business_id uuid not null references public.businesses(id),
    -- null: entrada que nem chegou a ser reconhecida como QR ou código.
    method coupon_validation_method,
    -- `coupon_found`, não `found`: em PL/pgSQL, FOUND é variável especial.
    coupon_found boolean not null,
    created_at timestamptz not null default now()
);

create index coupon_verification_attempts_validator_idx
    on public.coupon_verification_attempts(validator_id, created_at);
create index coupon_verification_attempts_business_idx
    on public.coupon_verification_attempts(business_id, created_at);

-- Inclusão e remoção só pelas operações oficiais; sem alteração.
create or replace function public.coupon_verification_attempts_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'UPDATE' then
        perform public.farol_error('record_immutable', 'Tentativas de verificação não são alteradas.');
    end if;
    perform public.assert_coupon_write_authorized();
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger coupon_verification_attempts_guard_trigger
before insert or update or delete on public.coupon_verification_attempts
for each row execute function public.coupon_verification_attempts_guard();

alter table public.coupon_verification_attempts enable row level security;
revoke all on public.coupon_verification_attempts from public, anon, authenticated;
grant all on public.coupon_verification_attempts to service_role;

-- ---------------------------------------------------------------------------
-- Limite
-- ---------------------------------------------------------------------------

-- Serializa as tentativas do mesmo validador (trava da transação, sem
-- tabela) e recusa quando já houver 20 falhas nos últimos 10 minutos.
create or replace function public.assert_verification_attempts_allowed(p_validator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform pg_advisory_xact_lock(hashtextextended('coupon_verification:' || p_validator_id::text, 0));
    if (select count(*) from public.coupon_verification_attempts
         where validator_id = p_validator_id
           and not coupon_found
           and created_at > now() - interval '10 minutes') >= 20 then
        perform public.farol_error('too_many_attempts', 'Muitas verificações sem sucesso. Aguarde alguns minutos.');
    end if;
end;
$$;

create or replace function public.record_verification_attempt(
    p_validator_id uuid,
    p_business_id uuid,
    p_method coupon_validation_method,
    p_found boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.begin_coupon_write();
    insert into public.coupon_verification_attempts (validator_id, business_id, method, coupon_found)
    values (p_validator_id, p_business_id, p_method, p_found);
    perform public.end_coupon_write();
end;
$$;

-- ---------------------------------------------------------------------------
-- Verificação e confirmação com limite
-- ---------------------------------------------------------------------------

-- Substitui a versão da migration 20261016000002: deixa de ser STABLE
-- (registra a tentativa) e devolve `coupon_not_found` sem erro.
create or replace function public.verify_coupon(p_business_id uuid, p_input text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_validator(p_business_id);
    v_found record;
    v_coupon public.coupons;
    v_usage public.coupon_usages;
    v_reason text;
    v_window boolean;
begin
    perform public.assert_verification_attempts_allowed(v_uid);

    select * into v_found from public.find_coupon_for_business(p_business_id, p_input) limit 1;
    perform public.record_verification_attempt(
        v_uid, p_business_id,
        coalesce(v_found.method, (select method from public.parse_coupon_input(p_input) limit 1)),
        v_found.coupon_id is not null
    );
    if v_found.coupon_id is null then
        return jsonb_build_object('valid', false, 'reason', 'coupon_not_found');
    end if;

    select * into v_coupon from public.coupons where id = v_found.coupon_id;
    select * into v_usage from public.coupon_usages where coupon_id = v_coupon.id;
    v_window := public.coupon_usage_window_open(v_coupon.offer_version_id);

    v_reason := case
        when v_coupon.status = 'used' then 'coupon_already_used'
        when v_coupon.status = 'canceled' then 'coupon_canceled'
        when v_coupon.status = 'expired' or v_coupon.expires_at <= now() then 'coupon_expired'
        when not v_window then 'offer_time_window_not_allowed'
        else null
    end;

    return jsonb_build_object(
        'valid', v_reason is null,
        'reason', v_reason,
        'method', v_found.method,
        'window_open', v_window,
        'coupon', jsonb_build_object(
            'id', v_coupon.id,
            'code', v_coupon.code,
            'status', public.coupon_effective_status(v_coupon),
            'generated_at', v_coupon.generated_at,
            'expires_at', v_coupon.expires_at,
            'used_at', v_coupon.used_at,
            'canceled_at', v_coupon.canceled_at
        ),
        'usage', case when v_usage.id is null then null else jsonb_build_object(
            'used_at', v_usage.used_at,
            'validator_name', (select coalesce(nullif(btrim(full_name), ''), email) from public.profiles where id = v_usage.validator_id)
        ) end,
        'version', public.coupon_version_public(v_coupon.offer_version_id)
    );
end;
$$;

-- Substitui a versão da migration 20261016000002: passa pelo mesmo limite,
-- registra a tentativa e devolve `confirmed = false` quando não encontra.
create or replace function public.confirm_coupon_usage(p_business_id uuid, p_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_validator(p_business_id);
    v_found record;
    v_coupon public.coupons;
    v_version public.offer_versions;
    v_usage_id uuid := gen_random_uuid();
    v_now timestamptz := now();
begin
    perform public.assert_verification_attempts_allowed(v_uid);

    select * into v_found from public.find_coupon_for_business(p_business_id, p_input) limit 1;
    perform public.record_verification_attempt(
        v_uid, p_business_id,
        coalesce(v_found.method, (select method from public.parse_coupon_input(p_input) limit 1)),
        v_found.coupon_id is not null
    );
    if v_found.coupon_id is null then
        return jsonb_build_object('confirmed', false, 'reason', 'coupon_not_found');
    end if;

    -- Mesma ordem de generate_coupon: oferta, depois cupom.
    perform 1 from public.offers o
      join public.coupons c on c.offer_id = o.id
     where c.id = v_found.coupon_id
       for update of o;
    select * into v_coupon from public.coupons where id = v_found.coupon_id for update;

    if v_coupon.status = 'used' then
        perform public.farol_error('coupon_already_used', 'Este cupom já foi utilizado.');
    end if;
    if v_coupon.status = 'canceled' then
        perform public.farol_error('coupon_canceled', 'Este cupom foi cancelado.');
    end if;
    if v_coupon.status = 'expired' or v_coupon.expires_at <= v_now then
        perform public.farol_error('coupon_expired', 'Este cupom expirou.');
    end if;
    if not public.coupon_usage_window_open(v_coupon.offer_version_id, v_now) then
        perform public.farol_error('offer_time_window_not_allowed', 'O cupom não vale neste dia ou horário.');
    end if;

    select * into v_version from public.offer_versions where id = v_coupon.offer_version_id;
    if (select count(*) from public.coupons
         where user_id = v_coupon.user_id and offer_id = v_coupon.offer_id and status = 'used')
        >= v_version.per_user_limit then
        perform public.farol_error('user_limit_reached', 'O limite de utilizações desta oferta para esta pessoa já foi atingido.');
    end if;

    perform public.begin_coupon_write();
    update public.coupons set status = 'used', used_at = v_now where id = v_coupon.id;
    insert into public.coupon_usages (
        id, coupon_id, offer_id, offer_version_id, business_id, user_id, validator_id,
        validation_method, used_at, fee_amount, fee_rule_id
    ) values (
        v_usage_id, v_coupon.id, v_coupon.offer_id, v_coupon.offer_version_id, v_coupon.business_id,
        v_coupon.user_id, v_uid, v_found.method, v_now, v_version.fee_amount, v_version.fee_rule_id
    );
    insert into public.fee_ledger_entries (business_id, kind, coupon_usage_id, amount)
    values (v_coupon.business_id, 'usage_fee', v_usage_id, v_version.fee_amount);
    insert into public.coupon_events (coupon_id, actor_id, action) values (v_coupon.id, v_uid, 'used');
    perform public.end_coupon_write();

    return jsonb_build_object('confirmed', true, 'coupon_id', v_coupon.id, 'code', v_coupon.code,
                              'used_at', v_now, 'method', v_found.method);
end;
$$;

-- ---------------------------------------------------------------------------
-- Retenção: 30 dias, job diário
-- ---------------------------------------------------------------------------

create or replace function public.purge_coupon_verification_attempts(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    perform public.begin_coupon_write();
    delete from public.coupon_verification_attempts where created_at < p_now - interval '30 days';
    get diagnostics v_count = row_count;
    perform public.end_coupon_write();
    return v_count;
end;
$$;

revoke all on function public.coupon_verification_attempts_guard() from public, anon, authenticated;
revoke all on function public.assert_verification_attempts_allowed(uuid) from public, anon, authenticated;
revoke all on function public.record_verification_attempt(uuid, uuid, coupon_validation_method, boolean) from public, anon, authenticated;
revoke all on function public.purge_coupon_verification_attempts(timestamptz) from public, anon, authenticated;
revoke all on function public.verify_coupon(uuid, text) from public, anon;
revoke all on function public.confirm_coupon_usage(uuid, text) from public, anon;
grant execute on function public.verify_coupon(uuid, text) to authenticated;
grant execute on function public.confirm_coupon_usage(uuid, text) to authenticated;

-- Todo dia às 03:17 UTC (00:17 em Pitimbu), fora do horário de uso.
select cron.schedule('coupon-verification-attempts-retention', '17 3 * * *', 'select public.purge_coupon_verification_attempts()');
