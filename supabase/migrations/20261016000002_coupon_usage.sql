-- Sprint 3 — validação e utilização dos cupons (decisões de 16/10/2026).
--
-- Fluxo: o validador verifica o cupom (somente leitura) e confirma a
-- utilização numa operação atômica: available → used, coupon_usages,
-- lançamento da taxa em fee_ledger_entries e evento `used`.
--
-- Regras:
-- * Quem valida: o proprietário do negócio, automaticamente, e validadores
--   vinculados individualmente (business_validators). O admin não valida.
-- * Janela: só dentro dos dias e faixas da VERSÃO DO CUPOM, no horário de
--   America/Fortaleza. Fora dela a confirmação falha
--   (offer_time_window_not_allowed) e o cupom continua available.
-- * Taxa: a fee_amount aceita na versão do cupom. Nunca a taxa atual do plano.
-- * Oferta ou negócio fora do ar não impede usar cupom já emitido.
-- * available → used é terminal nesta sprint; correção e estorno são da
--   Sprint 4 (fee_ledger_entries já prevê outros `kind`).
-- * per_user_limit conta só `used` da oferta inteira, atravessando versões.
--
-- Concorrência: a confirmação trava a oferta e depois o cupom (mesma ordem
-- de generate_coupon, que trava a oferta). Confirmações e gerações da mesma
-- oferta passam uma de cada vez; a expiração pula cupons travados.

-- ---------------------------------------------------------------------------
-- Cupom utilizado
-- ---------------------------------------------------------------------------

alter table public.coupons add column used_at timestamptz;
alter table public.coupons
    add constraint coupons_used_check check ((status = 'used') = (used_at is not null));

-- Substitui a guarda da migration 20261007000001: inclui available → used.
create or replace function public.coupons_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        perform public.farol_error('coupon_not_deletable', 'Cupons não são apagados; eles expiram ou são cancelados.');
    end if;

    if tg_op = 'INSERT' then
        if new.status <> 'available' or new.expired_at is not null or new.canceled_at is not null or new.used_at is not null then
            perform public.farol_error('invalid_transition', 'Todo cupom novo nasce disponível.');
        end if;
        perform public.assert_coupon_write_authorized();
        return new;
    end if;

    if (to_jsonb(new) - array['status', 'expired_at', 'canceled_at', 'canceled_by', 'cancel_reason', 'used_at', 'updated_at'])
        is distinct from (to_jsonb(old) - array['status', 'expired_at', 'canceled_at', 'canceled_by', 'cancel_reason', 'used_at', 'updated_at']) then
        perform public.farol_error('coupon_immutable', 'Código, vínculos, validade e aceite do cupom não mudam.');
    end if;

    if new.status is distinct from old.status
        and not (old.status = 'available' and new.status in ('expired', 'canceled', 'used')) then
        perform public.farol_error('invalid_transition', format('O cupom não pode passar de %s para %s.', old.status, new.status));
    end if;
    if new.status = old.status and (
        new.expired_at is distinct from old.expired_at
        or new.canceled_at is distinct from old.canceled_at
        or new.canceled_by is distinct from old.canceled_by
        or new.cancel_reason is distinct from old.cancel_reason
        or new.used_at is distinct from old.used_at
    ) then
        perform public.farol_error('coupon_immutable', 'Os dados de expiração, cancelamento e utilização não mudam depois de registrados.');
    end if;

    perform public.assert_coupon_write_authorized();
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Validadores
-- ---------------------------------------------------------------------------

-- Cada vínculo ativo é uma linha; desativar encerra a linha e um novo
-- cadastro cria outra. O histórico de quem podia validar e quando fica.
create table public.business_validators (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id),
    user_id uuid not null references public.profiles(id),
    active boolean not null default true,
    added_by uuid not null references public.profiles(id),
    added_at timestamptz not null default now(),
    deactivated_by uuid references public.profiles(id),
    deactivated_at timestamptz,
    constraint business_validators_deactivation_check check (active = (deactivated_at is null) and active = (deactivated_by is null))
);

create unique index business_validators_one_active
    on public.business_validators(business_id, user_id)
    where active;
create index business_validators_user_idx on public.business_validators(user_id) where active;

create or replace function public.business_validators_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        perform public.farol_error('validator_not_deletable', 'Vínculos de validador não são apagados; eles são desativados.');
    end if;
    if tg_op = 'INSERT' then
        if not new.active then
            perform public.farol_error('invalid_transition', 'Todo vínculo novo nasce ativo.');
        end if;
        perform public.assert_coupon_write_authorized();
        return new;
    end if;
    if (to_jsonb(new) - array['active', 'deactivated_by', 'deactivated_at'])
        is distinct from (to_jsonb(old) - array['active', 'deactivated_by', 'deactivated_at'])
        or not (old.active and not new.active) then
        perform public.farol_error('validator_immutable', 'Um vínculo de validador só pode ser desativado.');
    end if;
    perform public.assert_coupon_write_authorized();
    return new;
end;
$$;

create trigger business_validators_guard_trigger
before insert or update or delete on public.business_validators
for each row execute function public.business_validators_guard();

-- Proprietário do negócio ou validador ativo. Admin não entra aqui.
create or replace function public.can_validate_business(p_user_id uuid, p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select p_user_id is not null and (
        exists (select 1 from public.businesses where id = p_business_id and owner_id = p_user_id)
        or exists (select 1 from public.business_validators
                    where business_id = p_business_id and user_id = p_user_id and active)
    );
$$;

-- ---------------------------------------------------------------------------
-- Utilizações e lançamentos
-- ---------------------------------------------------------------------------

create type coupon_validation_method as enum ('qr', 'code');
create type fee_entry_kind as enum ('usage_fee');

-- Uma utilização por cupom. Registro financeiro: sem cascata, só inclusão.
create table public.coupon_usages (
    id uuid primary key default gen_random_uuid(),
    coupon_id uuid not null unique references public.coupons(id),
    offer_id uuid not null references public.offers(id),
    offer_version_id uuid not null,
    business_id uuid not null references public.businesses(id),
    user_id uuid not null references public.profiles(id),
    validator_id uuid not null references public.profiles(id),
    validation_method coupon_validation_method not null,
    used_at timestamptz not null default now(),
    fee_amount numeric(10, 2) not null check (fee_amount > 0),
    fee_rule_id uuid not null references public.plan_coupon_fees(id),
    created_at timestamptz not null default now(),
    foreign key (offer_id, offer_version_id) references public.offer_versions(offer_id, id)
);

create index coupon_usages_business_idx on public.coupon_usages(business_id, used_at desc);
create index coupon_usages_user_offer_idx on public.coupon_usages(user_id, offer_id);

-- Livro-razão do que o negócio deve ao Farol. A Sprint 4 acrescenta outros
-- `kind` (estorno, crédito) como novas linhas, sem alterar as existentes.
create table public.fee_ledger_entries (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id),
    kind fee_entry_kind not null,
    coupon_usage_id uuid references public.coupon_usages(id),
    amount numeric(10, 2) not null,
    created_at timestamptz not null default now(),
    constraint fee_ledger_usage_fee_check check (kind <> 'usage_fee' or (coupon_usage_id is not null and amount > 0))
);

create unique index fee_ledger_one_usage_fee on public.fee_ledger_entries(coupon_usage_id) where kind = 'usage_fee';
create index fee_ledger_business_idx on public.fee_ledger_entries(business_id, created_at);

create or replace function public.coupon_append_only_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        perform public.assert_coupon_write_authorized();
        return new;
    end if;
    perform public.farol_error('record_immutable', 'Utilizações e lançamentos não são alterados nem apagados.');
    return null;
end;
$$;

create trigger coupon_usages_guard_trigger
before insert or update or delete on public.coupon_usages
for each row execute function public.coupon_append_only_guard();

create trigger fee_ledger_entries_guard_trigger
before insert or update or delete on public.fee_ledger_entries
for each row execute function public.coupon_append_only_guard();

-- ---------------------------------------------------------------------------
-- Identificação do cupom e janela de uso
-- ---------------------------------------------------------------------------

-- Aceita o conteúdo do QR (farol-cupom:1:<token>) ou o código, com espaços,
-- minúsculas e sem hífen ("fp 7a3 9k2", "FP7A39K2", "7A39K2").
create or replace function public.parse_coupon_input(p_input text)
returns table (method coupon_validation_method, code text, token_hash text)
language plpgsql
immutable
set search_path = public
as $$
declare
    v_raw text := btrim(coalesce(p_input, ''));
    v_compact text;
begin
    if v_raw ~* '^farol-cupom:1:[A-Za-z0-9_-]{43}$' then
        return query select 'qr'::coupon_validation_method, null::text,
            public.coupon_qr_token_hash(substring(v_raw from 15));
        return;
    end if;
    v_compact := upper(regexp_replace(v_raw, '[\s-]', '', 'g'));
    if v_compact ~ '^FP[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
        v_compact := substring(v_compact from 3);
    end if;
    if v_compact ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
        return query select 'code'::coupon_validation_method, 'FP-' || v_compact, null::text;
    end if;
end;
$$;

-- Dentro dos dias e faixas da versão, no horário de Pitimbu. Faixa fechada
-- no início e aberta no fim: 11:00–15:00 vale de 11:00:00 a 14:59:59.
create or replace function public.coupon_usage_window_open(p_version_id uuid, p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    with local as (select (p_at at time zone 'America/Fortaleza') as ts)
    select extract(isodow from l.ts)::smallint = any(v.days_of_week)
       and (
            jsonb_array_length(v.time_windows) = 0
            or exists (
                select 1 from jsonb_array_elements(v.time_windows) w
                 where (w ->> 'day')::int = extract(isodow from l.ts)::int
                   and l.ts::time >= (w ->> 'start')::time
                   and l.ts::time < (w ->> 'end')::time
            )
       )
      from public.offer_versions v, local l
     where v.id = p_version_id;
$$;

-- Localiza o cupom do negócio informado. Cupom de outro negócio é tratado
-- como inexistente, sem revelar que existe.
create or replace function public.find_coupon_for_business(p_business_id uuid, p_input text)
returns table (coupon_id uuid, method coupon_validation_method)
language sql
stable
security definer
set search_path = public
as $$
    select c.id, p.method
      from public.parse_coupon_input(p_input) p
      join public.coupons c
        on (p.method = 'code' and c.code = p.code)
        or (p.method = 'qr' and c.qr_token_hash = p.token_hash)
     where c.business_id = p_business_id;
$$;

create or replace function public.require_validator(p_business_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
begin
    if not public.can_validate_business(v_uid, p_business_id) then
        perform public.farol_error('not_a_validator', 'Sua conta não valida cupons deste negócio.');
    end if;
    return v_uid;
end;
$$;

-- Condições públicas da versão (mesmas colunas de coupon_view).
create or replace function public.coupon_version_public(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'id', v.id, 'version_number', v.version_number, 'title', v.title, 'description', v.description,
        'benefit_type', v.benefit_type, 'benefit_value', v.benefit_value, 'starts_at', v.starts_at,
        'ends_at', v.ends_at, 'days_of_week', v.days_of_week, 'time_windows', v.time_windows,
        'minimum_purchase', v.minimum_purchase, 'eligible_items', v.eligible_items,
        'stackable', v.stackable, 'conditions', v.conditions, 'total_limit', v.total_limit,
        'per_user_limit', v.per_user_limit, 'coupon_validity_minutes', v.coupon_validity_minutes
    )
      from public.offer_versions v where v.id = p_version_id;
$$;

-- ---------------------------------------------------------------------------
-- Verificação (somente leitura)
-- ---------------------------------------------------------------------------

-- Devolve o que o validador precisa para decidir. Nenhum dado do cliente.
create or replace function public.verify_coupon(p_business_id uuid, p_input text)
returns jsonb
language plpgsql
stable
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
    select * into v_found from public.find_coupon_for_business(p_business_id, p_input) limit 1;
    if v_found.coupon_id is null then
        perform public.farol_error('coupon_not_found', 'Cupom não encontrado para este estabelecimento.');
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

-- ---------------------------------------------------------------------------
-- Confirmação (atômica)
-- ---------------------------------------------------------------------------

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
    select * into v_found from public.find_coupon_for_business(p_business_id, p_input) limit 1;
    if v_found.coupon_id is null then
        perform public.farol_error('coupon_not_found', 'Cupom não encontrado para este estabelecimento.');
    end if;

    -- Mesma ordem de generate_coupon: oferta, depois cupom. Serializa as
    -- confirmações e gerações da oferta e protege o per_user_limit.
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
    -- Utilizações efetivas do usuário na oferta inteira, atravessando versões.
    if (select count(*) from public.coupons
         where user_id = v_coupon.user_id and offer_id = v_coupon.offer_id and status = 'used')
        >= v_version.per_user_limit then
        perform public.farol_error('user_limit_reached', 'O limite de utilizações desta oferta para esta pessoa já foi atingido.');
    end if;

    perform public.begin_coupon_write();
    update public.coupons set status = 'used', used_at = v_now where id = v_coupon.id;
    -- Taxa congelada na versão do cupom, aceita pelo proprietário.
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

    return jsonb_build_object('coupon_id', v_coupon.id, 'code', v_coupon.code, 'used_at', v_now, 'method', v_found.method);
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções existentes que passam a considerar `used`
-- ---------------------------------------------------------------------------

/** Vagas ocupadas: available ainda válidos + used, oferta inteira. */
create or replace function public.offer_reserved_coupons(p_offer_id uuid, p_now timestamptz default now())
returns int
language sql
stable
security definer
set search_path = public
as $$
    select count(*)::int from public.coupons
     where offer_id = p_offer_id
       and (status = 'used' or (status = 'available' and expires_at > p_now));
$$;

-- Substitui a versão da Sprint 2: aplica o per_user_limit sobre utilizações.
create or replace function public.generate_coupon(p_offer_id uuid, p_terms_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_offer public.offers;
    v_version public.offer_versions;
    v_terms text := public.current_coupon_terms_version();
    v_key int := public.coupon_qr_current_key_version();
    v_id uuid := gen_random_uuid();
    v_code text;
    v_expires timestamptz;
    v_attempt int := 0;
begin
    if p_terms_version is null then
        perform public.farol_error('terms_not_accepted', 'Aceite o regulamento e as condições da oferta para gerar o cupom.');
    end if;
    if p_terms_version is distinct from v_terms then
        perform public.farol_error('terms_outdated', 'O regulamento foi atualizado. Leia a nova versão antes de gerar o cupom.');
    end if;
    if v_key is null then
        perform public.farol_error('qr_key_unavailable', 'A chave do QR do cupom não está configurada.');
    end if;

    -- Trava a oferta: gerações e confirmações da mesma oferta passam uma de
    -- cada vez, e vagas e limite por usuário não sofrem corrida.
    select * into v_offer from public.offers where id = p_offer_id for update;
    if not found then
        perform public.farol_error('offer_not_found', 'Oferta não encontrada.');
    end if;

    select * into v_version from public.offer_versions where id = v_offer.published_version_id;
    if v_offer.status = 'scheduled' or (v_offer.status = 'active' and v_version.starts_at > now()) then
        perform public.farol_error('offer_not_started', 'Esta oferta ainda não começou.');
    end if;
    if v_offer.status = 'ended' or (v_offer.status = 'active' and v_version.ends_at <= now()) then
        perform public.farol_error('offer_expired', 'Esta oferta já terminou.');
    end if;
    if v_offer.status <> 'active' or v_version.id is null then
        perform public.farol_error('offer_not_active', 'Esta oferta não está disponível no momento.');
    end if;
    if not exists (select 1 from public.businesses where id = v_offer.business_id and status = 'active') then
        perform public.farol_error('offer_not_active', 'Esta oferta não está disponível no momento.');
    end if;

    perform public.expire_due_coupons(now(), p_offer_id);
    perform public.begin_coupon_write();

    if exists (select 1 from public.coupons where offer_id = p_offer_id and user_id = v_uid and status = 'available') then
        perform public.farol_error('coupon_already_available', 'Você já tem um cupom disponível desta oferta.');
    end if;

    -- Limite por usuário: utilizações efetivas (`used`) da oferta inteira,
    -- atravessando versões, contra o per_user_limit da versão publicada.
    if (select count(*) from public.coupons where offer_id = p_offer_id and user_id = v_uid and status = 'used')
        >= v_version.per_user_limit then
        perform public.farol_error('user_limit_reached', 'Você já utilizou todas as vezes permitidas desta oferta.');
    end if;

    if v_version.total_limit is not null
        and public.offer_reserved_coupons(p_offer_id) >= v_version.total_limit then
        perform public.farol_error('offer_sold_out', 'Os cupons desta oferta estão temporariamente esgotados.');
    end if;

    v_expires := least(now() + make_interval(mins => v_version.coupon_validity_minutes), v_version.ends_at);

    loop
        v_attempt := v_attempt + 1;
        v_code := public.generate_coupon_code();
        begin
            insert into public.coupons (
                id, code, qr_token_hash, qr_key_version, offer_id, offer_version_id, business_id, user_id,
                expires_at, terms_version, terms_accepted_at
            ) values (
                v_id, v_code, public.coupon_qr_token_hash(public.coupon_qr_token(v_id, v_key)), v_key,
                p_offer_id, v_version.id, v_offer.business_id, v_uid, v_expires, p_terms_version, now()
            );
            exit;
        exception when unique_violation then
            if sqlerrm like '%coupons_one_available_per_user%' then
                perform public.farol_error('coupon_already_available', 'Você já tem um cupom disponível desta oferta.');
            end if;
            if v_attempt >= 5 then
                perform public.farol_error('coupon_code_unavailable', 'Não foi possível gerar o código do cupom. Tente novamente.');
            end if;
        end;
    end loop;

    insert into public.coupon_events (coupon_id, actor_id, action) values (v_id, v_uid, 'generated');
    perform public.end_coupon_write();

    return jsonb_build_object('coupon_id', v_id, 'code', v_code, 'expires_at', v_expires);
end;
$$;

-- coupon_view passa a informar a utilização (sem validador nem taxa).
create or replace function public.coupon_view(c public.coupons)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'id', c.id,
        'code', c.code,
        'status', public.coupon_effective_status(c),
        'generated_at', c.generated_at,
        'expires_at', c.expires_at,
        'expired_at', c.expired_at,
        'canceled_at', c.canceled_at,
        'cancel_reason', c.cancel_reason,
        'used_at', c.used_at,
        'terms_version', c.terms_version,
        'terms_accepted_at', c.terms_accepted_at,
        'offer_id', c.offer_id,
        'business', jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug),
        'version', public.coupon_version_public(c.offer_version_id)
    )
      from public.businesses b
     where b.id = c.business_id;
$$;

-- ---------------------------------------------------------------------------
-- Gestão de validadores (proprietário)
-- ---------------------------------------------------------------------------

create or replace function public.require_business_owner(p_business_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
begin
    if not exists (select 1 from public.businesses where id = p_business_id and owner_id = v_uid) then
        perform public.farol_error('forbidden', 'Só o proprietário do negócio gerencia os validadores.');
    end if;
    return v_uid;
end;
$$;

create or replace function public.owner_list_validators(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    perform public.require_business_owner(p_business_id);
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', v.id, 'user_id', v.user_id, 'email', p.email, 'full_name', p.full_name,
            'active', v.active, 'added_at', v.added_at, 'deactivated_at', v.deactivated_at
        ) order by v.active desc, v.added_at desc)
          from public.business_validators v
          join public.profiles p on p.id = v.user_id
         where v.business_id = p_business_id
    ), '[]'::jsonb);
end;
$$;

-- Vincula uma conta existente pelo e-mail. Convite para quem ainda não tem
-- conta fica para depois (exigiria envio de e-mail e estado pendente).
create or replace function public.owner_add_validator(p_business_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner uuid := public.require_business_owner(p_business_id);
    v_user uuid;
    v_id uuid;
begin
    select id into v_user from public.profiles where lower(email) = lower(btrim(p_email)) limit 1;
    if v_user is null then
        perform public.farol_error('account_not_found', 'Nenhuma conta encontrada com esse e-mail. A pessoa precisa criar a conta antes.');
    end if;
    if v_user = v_owner then
        perform public.farol_error('validator_is_owner', 'O proprietário já valida cupons do próprio negócio.');
    end if;
    if exists (select 1 from public.business_validators where business_id = p_business_id and user_id = v_user and active) then
        perform public.farol_error('validator_already_active', 'Essa conta já é validadora deste negócio.');
    end if;
    perform public.begin_coupon_write();
    insert into public.business_validators (business_id, user_id, added_by)
    values (p_business_id, v_user, v_owner)
    returning id into v_id;
    perform public.end_coupon_write();
    return v_id;
end;
$$;

create or replace function public.owner_deactivate_validator(p_validator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.business_validators;
    v_owner uuid;
begin
    select * into v_row from public.business_validators where id = p_validator_id for update;
    if not found then
        perform public.farol_error('not_found', 'Validador não encontrado.');
    end if;
    v_owner := public.require_business_owner(v_row.business_id);
    if not v_row.active then
        perform public.farol_error('invalid_transition', 'Este validador já está desativado.');
    end if;
    perform public.begin_coupon_write();
    update public.business_validators
       set active = false, deactivated_by = v_owner, deactivated_at = now()
     where id = p_validator_id;
    perform public.end_coupon_write();
end;
$$;

-- Negócios em que a conta pode validar (para o seletor da tela).
create or replace function public.my_validation_businesses()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug, 'role', r.role) order by b.name), '[]'::jsonb)
      from (
        select id as business_id, 'owner' as role from public.businesses where owner_id = public.require_auth()
        union
        select business_id, 'validator' from public.business_validators where user_id = public.require_auth() and active
      ) r
      join public.businesses b on b.id = r.business_id;
$$;

-- ---------------------------------------------------------------------------
-- Utilizações (proprietário e admin)
-- ---------------------------------------------------------------------------

-- Proprietário vê o próprio negócio; admin vê qualquer um ou todos (null).
create or replace function public.list_coupon_usages(
    p_business_id uuid default null,
    p_from timestamptz default null,
    p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
begin
    if not public.is_admin() then
        if p_business_id is null
            or not exists (select 1 from public.businesses where id = p_business_id and owner_id = v_uid) then
            perform public.farol_error('forbidden', 'Você não tem permissão para ver estas utilizações.');
        end if;
    end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', u.id, 'used_at', u.used_at, 'code', c.code, 'method', u.validation_method,
            'fee_amount', u.fee_amount, 'business_id', u.business_id, 'business_name', b.name,
            'offer_id', u.offer_id, 'offer_title', v.title, 'version_number', v.version_number,
            'validator_name', coalesce(nullif(btrim(p.full_name), ''), p.email)
        ) order by u.used_at desc)
          from public.coupon_usages u
          join public.coupons c on c.id = u.coupon_id
          join public.businesses b on b.id = u.business_id
          join public.offer_versions v on v.id = u.offer_version_id
          join public.profiles p on p.id = u.validator_id
         where (p_business_id is null or u.business_id = p_business_id)
           and (p_from is null or u.used_at >= p_from)
           and (p_to is null or u.used_at < p_to)
    ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e grants: leitura só pelas RPCs
-- ---------------------------------------------------------------------------

alter table public.business_validators enable row level security;
alter table public.coupon_usages enable row level security;
alter table public.fee_ledger_entries enable row level security;

revoke all on public.business_validators, public.coupon_usages, public.fee_ledger_entries from public, anon, authenticated;
grant all on public.business_validators, public.coupon_usages, public.fee_ledger_entries to service_role;

-- Admin com leitura direta para auditoria; demais papéis só via RPC.
grant select on public.business_validators, public.coupon_usages, public.fee_ledger_entries to authenticated;
create policy business_validators_admin_select on public.business_validators for select to authenticated using (public.is_admin());
create policy coupon_usages_admin_select on public.coupon_usages for select to authenticated using (public.is_admin());
create policy fee_ledger_entries_admin_select on public.fee_ledger_entries for select to authenticated using (public.is_admin());

-- O dono do cupom continua lendo o cupom (agora com used_at).
grant select (used_at) on public.coupons to authenticated;

revoke all on function public.business_validators_guard() from public, anon, authenticated;
revoke all on function public.coupon_append_only_guard() from public, anon, authenticated;
revoke all on function public.can_validate_business(uuid, uuid) from public, anon, authenticated;
revoke all on function public.parse_coupon_input(text) from public, anon, authenticated;
revoke all on function public.coupon_usage_window_open(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.find_coupon_for_business(uuid, text) from public, anon, authenticated;
revoke all on function public.require_validator(uuid) from public, anon, authenticated;
revoke all on function public.require_business_owner(uuid) from public, anon, authenticated;
revoke all on function public.coupon_version_public(uuid) from public, anon, authenticated;
revoke all on function public.verify_coupon(uuid, text) from public, anon;
revoke all on function public.confirm_coupon_usage(uuid, text) from public, anon;
revoke all on function public.owner_list_validators(uuid) from public, anon;
revoke all on function public.owner_add_validator(uuid, text) from public, anon;
revoke all on function public.owner_deactivate_validator(uuid) from public, anon;
revoke all on function public.my_validation_businesses() from public, anon;
revoke all on function public.list_coupon_usages(uuid, timestamptz, timestamptz) from public, anon;

grant execute on function public.verify_coupon(uuid, text) to authenticated;
grant execute on function public.confirm_coupon_usage(uuid, text) to authenticated;
grant execute on function public.owner_list_validators(uuid) to authenticated;
grant execute on function public.owner_add_validator(uuid, text) to authenticated;
grant execute on function public.owner_deactivate_validator(uuid) to authenticated;
grant execute on function public.my_validation_businesses() to authenticated;
grant execute on function public.list_coupon_usages(uuid, timestamptz, timestamptz) to authenticated;
