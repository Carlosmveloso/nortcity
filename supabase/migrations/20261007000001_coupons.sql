-- Sprint 2 — geração de cupons (decisões de 07/10/2026).
--
-- O cupom é um registro único no banco; código e QR só o identificam, e o
-- servidor decide a situação real. Nesta sprint não há utilização: os estados
-- são `available`, `expired` e `canceled`. A Sprint 3 acrescenta `used`
-- (ALTER TYPE … ADD VALUE) e a contagem de utilizações descrita em
-- generate_coupon().
--
-- Vagas: contam os cupons `available` (e, na Sprint 3, os `used`) da oferta
-- inteira, atravessando versões, contra o total_limit da versão publicada no
-- momento da geração. Limite por usuário: conta só utilizações (Sprint 3);
-- até lá vale a regra independente de um único `available` por usuário e
-- oferta. Expirado e cancelado nunca consomem vaga nem limite.
--
-- Suspender/encerrar oferta ou negócio bloqueia novas emissões, mas não
-- cancela cupons já emitidos: cancelamento é ação administrativa explícita.
--
-- QR: token = HMAC-SHA256(id do cupom, segredo do Vault `coupon_qr_key_vN`).
-- O banco guarda só o hash do token e a versão da chave; o token é
-- recalculado apenas para o dono, por RPC. O segredo nunca sai do banco.

create type coupon_status as enum ('available', 'expired', 'canceled');
create type coupon_event_action as enum ('generated', 'expired', 'canceled');

-- ---------------------------------------------------------------------------
-- Regulamento versionado
-- ---------------------------------------------------------------------------

-- Texto integral de cada versão do "Regulamento de Utilização dos Cupons".
-- Versões antigas nunca são apagadas nem reescritas: o cupom aponta para a
-- versão aceita.
create table public.coupon_terms (
    version text primary key check (version ~ '^\d{4}-\d{2}-v\d+$'),
    title text not null,
    content jsonb not null check (jsonb_typeof(content) = 'array'),
    published_at timestamptz not null default now()
);

create or replace function public.coupon_terms_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.farol_error('terms_immutable', 'Uma versão publicada do regulamento não é alterada; publique uma nova versão.');
    return null;
end;
$$;

create trigger coupon_terms_guard_trigger
before update or delete on public.coupon_terms
for each row execute function public.coupon_terms_guard();

-- Conteúdo do documento oficial (Regulamento de Utilização dos Cupons —
-- Farol Pitimbu), seção a seção, sem cortes.
insert into public.coupon_terms (version, title, content, published_at) values (
    '2026-10-v1',
    'Regulamento de Utilização dos Cupons',
    $json$[
      {"heading": null, "blocks": [
        {"p": "Os cupons disponibilizados pelo Farol Pitimbu correspondem a benefícios oferecidos pelos estabelecimentos participantes aos usuários da plataforma."},
        {"p": "Ao gerar um cupom, o usuário declara que leu e concorda com as condições da oferta e com as regras abaixo."}
      ]},
      {"heading": "1. Condições da oferta", "blocks": [
        {"p": "Antes de gerar o cupom, o usuário deverá verificar as condições específicas da oferta, incluindo:"},
        {"list": ["benefício oferecido;", "período de validade;", "dias e horários de utilização;", "estabelecimento participante;", "valor mínimo de compra, quando houver;", "produtos ou serviços participantes, quando aplicável;", "limite de utilização;", "possibilidade ou não de acumulação com outras promoções;", "demais condições informadas pelo estabelecimento."]},
        {"p": "A utilização do cupom está condicionada ao cumprimento dessas regras."}
      ]},
      {"heading": "2. Geração do cupom", "blocks": [
        {"p": "O cupom será gerado pelo Farol Pitimbu após o usuário concordar com as condições da oferta."},
        {"p": "Cada cupom receberá uma identificação própria, que poderá ser apresentada por meio de código e/ou QR Code."},
        {"p": "O cupom deverá ser apresentado ao estabelecimento no momento da utilização."}
      ]},
      {"heading": "3. Validade", "blocks": [
        {"p": "O cupom somente poderá ser utilizado dentro do período de validade informado na oferta."},
        {"p": "Após o vencimento, o cupom não poderá ser utilizado."},
        {"p": "A oferta poderá estabelecer dias e horários específicos para utilização, que deverão ser observados pelo usuário."}
      ]},
      {"heading": "4. Utilização", "blocks": [
        {"p": "O cupom deverá ser apresentado antes da conclusão da compra ou contratação do produto ou serviço."},
        {"p": "O estabelecimento poderá solicitar a apresentação do cupom na tela do dispositivo utilizado pelo cliente para realizar a validação."},
        {"p": "Após a validação e confirmação da utilização, o cupom será registrado como utilizado e não poderá ser utilizado novamente, salvo quando a própria oferta permitir mais de uma utilização."}
      ]},
      {"heading": "5. Validação", "blocks": [
        {"p": "A validação poderá ser realizada por meio do QR Code ou código de identificação apresentado no cupom."},
        {"p": "O sistema verificará, quando aplicável:"},
        {"list": ["autenticidade do cupom;", "validade;", "estabelecimento participante;", "condições da oferta;", "situação do cupom;", "eventual utilização anterior."]},
        {"p": "Somente um cupom considerado válido poderá ser confirmado como utilizado."}
      ]},
      {"heading": "6. Limite de utilização", "blocks": [
        {"p": "Cada oferta poderá estabelecer limite de utilização por usuário ou quantidade total de cupons disponíveis."},
        {"p": "Quando houver limite, essa informação será apresentada na respectiva oferta."},
        {"p": "O usuário não poderá utilizar o mesmo cupom mais de uma vez após sua confirmação como utilizado."}
      ]},
      {"heading": "7. Alterações ou encerramento da oferta", "blocks": [
        {"p": "As condições e o período de validade de cada oferta serão informados no momento da geração do cupom."},
        {"p": "O estabelecimento poderá solicitar ao Farol Pitimbu a alteração, suspensão ou encerramento de uma oferta."},
        {"p": "As alterações serão aplicadas às novas emissões de cupons após sua publicação na plataforma."}
      ]},
      {"heading": "8. Responsabilidade pela oferta", "blocks": [
        {"p": "A oferta, seus produtos ou serviços, preços, descontos, benefícios e condições comerciais são de responsabilidade do estabelecimento que a disponibilizou."},
        {"p": "O Farol Pitimbu atua como plataforma de divulgação, geração e gerenciamento dos cupons."},
        {"p": "Eventuais dúvidas sobre o produto, serviço ou condição comercial da oferta poderão ser esclarecidas diretamente com o estabelecimento participante."}
      ]},
      {"heading": "9. Utilização indevida", "blocks": [
        {"p": "Não será permitida a utilização de cupons:"},
        {"list": ["vencidos;", "já utilizados;", "adulterados;", "com código inválido;", "incompatíveis com a oferta apresentada;", "obtidos mediante fraude ou uso indevido da plataforma."]},
        {"p": "O Farol Pitimbu poderá cancelar ou bloquear cupons identificados como inválidos ou utilizados de forma irregular."}
      ]},
      {"heading": "10. Aceite do usuário", "blocks": [
        {"p": "Ao marcar a opção “Li e concordo com o Regulamento de Utilização dos Cupons e com as condições específicas desta oferta.” e selecionar “Gerar meu cupom”, o usuário declara que leu e concorda com este regulamento e com as condições específicas da oferta."},
        {"p": "Importante: o benefício somente poderá ser utilizado de acordo com as condições apresentadas nesta oferta."}
      ]}
    ]$json$::jsonb,
    '2026-10-06 00:00:00-03'
);

-- Versão vigente: a mais recente já publicada.
create or replace function public.current_coupon_terms_version()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select version from public.coupon_terms where published_at <= now() order by published_at desc limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Cupons e histórico
-- ---------------------------------------------------------------------------

-- business_id e user_id sem cascata: o cupom é registro do benefício
-- concedido (e, na Sprint 3, da cobrança). Conta ou negócio com cupons não é
-- excluído fisicamente — mesma dívida registrada para ofertas.
create table public.coupons (
    id uuid primary key default gen_random_uuid(),
    code text not null unique check (code ~ '^FP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
    qr_token_hash text not null unique check (qr_token_hash ~ '^[0-9a-f]{64}$'),
    qr_key_version int not null check (qr_key_version > 0),
    offer_id uuid not null references public.offers(id),
    offer_version_id uuid not null,
    business_id uuid not null references public.businesses(id),
    user_id uuid not null references public.profiles(id),
    status coupon_status not null default 'available',
    generated_at timestamptz not null default now(),
    expires_at timestamptz not null,
    terms_version text not null references public.coupon_terms(version),
    terms_accepted_at timestamptz not null,
    expired_at timestamptz,
    canceled_at timestamptz,
    canceled_by uuid references public.profiles(id),
    cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    foreign key (offer_id, offer_version_id) references public.offer_versions(offer_id, id),
    constraint coupons_validity_check check (expires_at > generated_at),
    constraint coupons_expired_check check ((status = 'expired') = (expired_at is not null)),
    constraint coupons_canceled_check check (
        (status = 'canceled') = (canceled_at is not null)
        and (status <> 'canceled' or nullif(btrim(cancel_reason), '') is not null)
    )
);

-- Um único cupom disponível por usuário e oferta, garantido sob concorrência.
create unique index coupons_one_available_per_user
    on public.coupons(user_id, offer_id)
    where status = 'available';

create index coupons_offer_status_idx on public.coupons(offer_id, status);
create index coupons_user_idx on public.coupons(user_id, generated_at desc);
create index coupons_available_expires_idx on public.coupons(expires_at) where status = 'available';

create trigger coupons_set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

create table public.coupon_events (
    id uuid primary key default gen_random_uuid(),
    coupon_id uuid not null references public.coupons(id),
    -- null = sistema (expiração automática).
    actor_id uuid references public.profiles(id),
    action coupon_event_action not null,
    message text check (message is null or char_length(message) <= 1000),
    created_at timestamptz not null default now()
);

create index coupon_events_coupon_idx on public.coupon_events(coupon_id, created_at);

-- ---------------------------------------------------------------------------
-- Escrita só pelas operações oficiais
-- ---------------------------------------------------------------------------

-- Mesmo padrão de farol.offer_write: as RPCs ligam o sinal e o desligam
-- antes de retornar; as triggers validam a mudança e recusam o que vier de
-- fora delas, inclusive de service_role e postgres.
create or replace function public.begin_coupon_write()
returns void
language plpgsql
as $$
begin
    perform set_config('farol.coupon_write', 'on', true);
end;
$$;

create or replace function public.end_coupon_write()
returns void
language plpgsql
as $$
begin
    perform set_config('farol.coupon_write', 'off', true);
end;
$$;

create or replace function public.assert_coupon_write_authorized()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(current_setting('farol.coupon_write', true), 'off') <> 'on' then
        perform public.farol_error('direct_write_not_allowed', 'Cupons só mudam pelas operações oficiais, que registram o histórico.');
    end if;
end;
$$;

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
        if new.status <> 'available' or new.expired_at is not null or new.canceled_at is not null then
            perform public.farol_error('invalid_transition', 'Todo cupom novo nasce disponível.');
        end if;
        perform public.assert_coupon_write_authorized();
        return new;
    end if;

    -- Só a situação muda; identidade, vínculos, validade e aceite são fixos.
    if (to_jsonb(new) - array['status', 'expired_at', 'canceled_at', 'canceled_by', 'cancel_reason', 'updated_at'])
        is distinct from (to_jsonb(old) - array['status', 'expired_at', 'canceled_at', 'canceled_by', 'cancel_reason', 'updated_at']) then
        perform public.farol_error('coupon_immutable', 'Código, vínculos, validade e aceite do cupom não mudam.');
    end if;

    if new.status is distinct from old.status
        and not (old.status = 'available' and new.status in ('expired', 'canceled')) then
        perform public.farol_error('invalid_transition', format('O cupom não pode passar de %s para %s.', old.status, new.status));
    end if;
    if new.status = old.status and (
        new.expired_at is distinct from old.expired_at
        or new.canceled_at is distinct from old.canceled_at
        or new.canceled_by is distinct from old.canceled_by
        or new.cancel_reason is distinct from old.cancel_reason
    ) then
        perform public.farol_error('coupon_immutable', 'Os dados de expiração e cancelamento não mudam depois de registrados.');
    end if;

    perform public.assert_coupon_write_authorized();
    return new;
end;
$$;

create trigger coupons_guard_trigger
before insert or update or delete on public.coupons
for each row execute function public.coupons_guard();

create or replace function public.coupon_events_guard()
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
    perform public.farol_error('event_immutable', 'O histórico do cupom não é alterado nem apagado.');
    return null;
end;
$$;

create trigger coupon_events_guard_trigger
before insert or update or delete on public.coupon_events
for each row execute function public.coupon_events_guard();

-- ---------------------------------------------------------------------------
-- QR: HMAC com chave versionada no Vault
-- ---------------------------------------------------------------------------

-- Versão de chave vigente: a maior N com segredo `coupon_qr_key_vN` no Vault.
-- Rotação = criar `coupon_qr_key_v(N+1)`; cupons antigos guardam a versão
-- usada e continuam verificáveis enquanto o segredo antigo existir.
create or replace function public.coupon_qr_current_key_version()
returns int
language sql
stable
security definer
set search_path = public
as $$
    select max(substring(name from '^coupon_qr_key_v([0-9]+)$')::int)
      from vault.decrypted_secrets
     where name ~ '^coupon_qr_key_v[0-9]+$';
$$;

create or replace function public.coupon_qr_token(p_coupon_id uuid, p_key_version int)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
    v_secret text;
begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'coupon_qr_key_v' || p_key_version;
    if v_secret is null or length(v_secret) < 32 then
        perform public.farol_error('qr_key_unavailable', 'A chave do QR do cupom não está configurada.');
    end if;
    -- base64url sem preenchimento: 43 caracteres, seguro em URL e no QR.
    return rtrim(translate(encode(hmac(p_coupon_id::text, v_secret, 'sha256'), 'base64'), '+/', '-_'), '=');
end;
$$;

create or replace function public.coupon_qr_token_hash(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
    select encode(digest(p_token, 'sha256'), 'hex');
$$;

-- Código público: FP- + 6 caracteres sem 0/O/1/I/L, 31^6 ≈ 887 milhões de
-- combinações, sorteados com bytes criptográficos e sem viés de módulo.
create or replace function public.generate_coupon_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
    v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    v_bytes bytea;
    v_code text := '';
    v_index int := 0;
    v_byte int;
begin
    while length(v_code) < 6 loop
        if v_bytes is null or v_index >= length(v_bytes) then
            v_bytes := gen_random_bytes(16);
            v_index := 0;
        end if;
        v_byte := get_byte(v_bytes, v_index);
        v_index := v_index + 1;
        continue when v_byte >= 248; -- 248 = 8 × 31
        v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
    end loop;
    return 'FP-' || v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expiração e disponibilidade
-- ---------------------------------------------------------------------------

/** Expira cupons vencidos; idempotente. Sem p_offer_id, todos. */
create or replace function public.expire_due_coupons(p_now timestamptz default now(), p_offer_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_coupon public.coupons;
    v_count int := 0;
begin
    perform public.begin_coupon_write();
    for v_coupon in
        select c.* from public.coupons c
         where c.status = 'available'
           and c.expires_at <= p_now
           and (p_offer_id is null or c.offer_id = p_offer_id)
         order by c.expires_at
           for update skip locked
    loop
        update public.coupons set status = 'expired', expired_at = now() where id = v_coupon.id;
        insert into public.coupon_events (coupon_id, actor_id, action) values (v_coupon.id, null, 'expired');
        v_count := v_count + 1;
    end loop;
    perform public.end_coupon_write();
    return v_count;
end;
$$;

/** Vagas ocupadas: available ainda válidos (+ used na Sprint 3), oferta inteira. */
create or replace function public.offer_reserved_coupons(p_offer_id uuid, p_now timestamptz default now())
returns int
language sql
stable
security definer
set search_path = public
as $$
    select count(*)::int from public.coupons
     where offer_id = p_offer_id and status = 'available' and expires_at > p_now;
$$;

-- Disponibilidade pública: só sim/não, sem quantidades. Informativa — a
-- autoridade é generate_coupon(), que decide sob lock.
create or replace function public.offer_coupon_availability(p_offer_ids uuid[])
returns table (offer_id uuid, available boolean)
language sql
stable
security definer
set search_path = public
as $$
    select o.id,
           v.total_limit is null or public.offer_reserved_coupons(o.id) < v.total_limit
      from public.offers o
      join public.offer_versions v on v.id = o.published_version_id
     where o.id = any(p_offer_ids)
       and public.offer_version_is_public(o.published_version_id);
$$;

-- ---------------------------------------------------------------------------
-- Geração
-- ---------------------------------------------------------------------------

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

    -- Trava a oferta: gerações da mesma oferta passam uma de cada vez, e a
    -- contagem de vagas abaixo não sofre corrida.
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

    -- Vencidos desta oferta liberam a vaga já, sem esperar o job.
    perform public.expire_due_coupons(now(), p_offer_id);
    perform public.begin_coupon_write();

    if exists (select 1 from public.coupons where offer_id = p_offer_id and user_id = v_uid and status = 'available') then
        perform public.farol_error('coupon_already_available', 'Você já tem um cupom disponível desta oferta.');
    end if;

    -- Limite por usuário: conta só utilizações efetivas (status `used`, em
    -- todas as versões da oferta). Depende da Sprint 3: quando `used`
    -- existir, comparar aqui a contagem com v_version.per_user_limit e
    -- recusar com `user_limit_reached`. Expirado e cancelado não contam.

    if v_version.total_limit is not null
        and public.offer_reserved_coupons(p_offer_id) >= v_version.total_limit then
        perform public.farol_error('offer_sold_out', 'Os cupons desta oferta estão temporariamente esgotados.');
    end if;

    -- Nunca além do fim da oferta.
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
            -- Mesmo usuário em paralelo: o índice parcial é a garantia final.
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

-- ---------------------------------------------------------------------------
-- Leitura do dono
-- ---------------------------------------------------------------------------

-- Situação exibida: available vencido aparece como expired mesmo antes do
-- job registrar a expiração.
create or replace function public.coupon_effective_status(c public.coupons)
returns text
language sql
stable
as $$
    select case when c.status = 'available' and c.expires_at <= now() then 'expired' else c.status::text end;
$$;

-- Cupom com as condições da versão aceita (não da publicada hoje), negócio
-- e regulamento. Só colunas públicas da versão: nada de taxa ou autoria.
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
        'terms_version', c.terms_version,
        'terms_accepted_at', c.terms_accepted_at,
        'offer_id', c.offer_id,
        'business', jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug),
        'version', jsonb_build_object(
            'id', v.id, 'version_number', v.version_number, 'title', v.title, 'description', v.description,
            'benefit_type', v.benefit_type, 'benefit_value', v.benefit_value, 'starts_at', v.starts_at,
            'ends_at', v.ends_at, 'days_of_week', v.days_of_week, 'time_windows', v.time_windows,
            'minimum_purchase', v.minimum_purchase, 'eligible_items', v.eligible_items,
            'stackable', v.stackable, 'conditions', v.conditions, 'total_limit', v.total_limit,
            'per_user_limit', v.per_user_limit, 'coupon_validity_minutes', v.coupon_validity_minutes
        )
    )
      from public.businesses b, public.offer_versions v
     where b.id = c.business_id and v.id = c.offer_version_id;
$$;

create or replace function public.get_my_coupons()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(public.coupon_view(c) order by c.generated_at desc), '[]'::jsonb)
      from public.coupons c
     where c.user_id = public.require_auth();
$$;

create or replace function public.get_my_coupon(p_coupon_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_coupon public.coupons;
begin
    select * into v_coupon from public.coupons where id = p_coupon_id and user_id = public.require_auth();
    if not found then
        perform public.farol_error('coupon_not_found', 'Cupom não encontrado.');
    end if;
    return public.coupon_view(v_coupon);
end;
$$;

-- Token do QR só para o dono e só enquanto o cupom vale; expirado ou
-- cancelado não recebe QR utilizável.
create or replace function public.get_coupon_qr_token(p_coupon_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_coupon public.coupons;
begin
    select * into v_coupon from public.coupons where id = p_coupon_id and user_id = public.require_auth();
    if not found then
        perform public.farol_error('coupon_not_found', 'Cupom não encontrado.');
    end if;
    if public.coupon_effective_status(v_coupon) <> 'available' then
        return null;
    end if;
    return public.coupon_qr_token(v_coupon.id, v_coupon.qr_key_version);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelamento administrativo
-- ---------------------------------------------------------------------------

create or replace function public.admin_cancel_coupon(p_coupon_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin uuid := public.require_admin();
    v_coupon public.coupons;
begin
    if nullif(btrim(p_reason), '') is null then
        perform public.farol_error('reason_required', 'Informe o motivo do cancelamento.');
    end if;
    select * into v_coupon from public.coupons where id = p_coupon_id for update;
    if not found then
        perform public.farol_error('coupon_not_found', 'Cupom não encontrado.');
    end if;
    if v_coupon.status <> 'available' then
        perform public.farol_error('invalid_transition', 'Só um cupom disponível pode ser cancelado.');
    end if;

    perform public.begin_coupon_write();
    update public.coupons
       set status = 'canceled', canceled_at = now(), canceled_by = v_admin, cancel_reason = btrim(p_reason)
     where id = p_coupon_id;
    insert into public.coupon_events (coupon_id, actor_id, action, message)
    values (p_coupon_id, v_admin, 'canceled', btrim(p_reason));
    perform public.end_coupon_write();
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.coupon_terms enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_events enable row level security;

revoke all on public.coupon_terms, public.coupons, public.coupon_events from public, anon, authenticated;
grant all on public.coupon_terms, public.coupons, public.coupon_events to service_role;

grant select on public.coupon_terms to anon, authenticated;
create policy coupon_terms_select_all on public.coupon_terms for select to anon, authenticated using (true);

-- Dono e admin leem o cupom; o hash do QR fica de fora mesmo para eles.
grant select (
    id, code, qr_key_version, offer_id, offer_version_id, business_id, user_id, status, generated_at,
    expires_at, terms_version, terms_accepted_at, expired_at, canceled_at, canceled_by, cancel_reason,
    created_at, updated_at
) on public.coupons to authenticated;
create policy coupons_select_own_or_admin on public.coupons
    for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

grant select on public.coupon_events to authenticated;
create policy coupon_events_select_own_or_admin on public.coupon_events
    for select to authenticated using (
        public.is_admin()
        or exists (select 1 from public.coupons c where c.id = coupon_events.coupon_id and c.user_id = (select auth.uid()))
    );

revoke all on function public.coupon_terms_guard() from public, anon, authenticated;
revoke all on function public.current_coupon_terms_version() from public, anon;
revoke all on function public.begin_coupon_write() from public, anon, authenticated;
revoke all on function public.end_coupon_write() from public, anon, authenticated;
revoke all on function public.assert_coupon_write_authorized() from public, anon, authenticated;
revoke all on function public.coupons_guard() from public, anon, authenticated;
revoke all on function public.coupon_events_guard() from public, anon, authenticated;
revoke all on function public.coupon_qr_current_key_version() from public, anon, authenticated;
revoke all on function public.coupon_qr_token(uuid, int) from public, anon, authenticated;
revoke all on function public.coupon_qr_token_hash(text) from public, anon, authenticated;
revoke all on function public.generate_coupon_code() from public, anon, authenticated;
revoke all on function public.expire_due_coupons(timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.offer_reserved_coupons(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.coupon_effective_status(public.coupons) from public, anon, authenticated;
revoke all on function public.coupon_view(public.coupons) from public, anon, authenticated;
revoke all on function public.offer_coupon_availability(uuid[]) from public;
revoke all on function public.generate_coupon(uuid, text) from public, anon;
revoke all on function public.get_my_coupons() from public, anon;
revoke all on function public.get_my_coupon(uuid) from public, anon;
revoke all on function public.get_coupon_qr_token(uuid) from public, anon;
revoke all on function public.admin_cancel_coupon(uuid, text) from public, anon;

grant execute on function public.current_coupon_terms_version() to authenticated;
grant execute on function public.offer_coupon_availability(uuid[]) to anon, authenticated;
grant execute on function public.generate_coupon(uuid, text) to authenticated;
grant execute on function public.get_my_coupons() to authenticated;
grant execute on function public.get_my_coupon(uuid) to authenticated;
grant execute on function public.get_coupon_qr_token(uuid) to authenticated;
grant execute on function public.admin_cancel_coupon(uuid, text) to authenticated;

-- Job separado do offer-lifecycle: responsabilidade e falhas independentes.
select cron.schedule('coupon-expiration', '*/5 * * * *', 'select public.expire_due_coupons()');
