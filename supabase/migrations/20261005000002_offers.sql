-- Módulo de ofertas (Sprint 1, 05/10/2026): identidade, versões e histórico.
--
-- `offers` guarda o ciclo de vida; o conteúdo comercial mora em
-- `offer_versions`. Uma versão enviada para análise fica congelada: pedir
-- ajustes cria a versão seguinte em vez de reescrever a que foi analisada, e
-- alterar uma oferta ativa cria uma revisão sem tirar do ar a versão
-- publicada. Assim o histórico mostra exatamente o que foi decidido, e os
-- cupons futuros poderão apontar para a versão vigente quando foram emitidos.
--
-- `authenticated` só lê estas tabelas. Toda escrita passa pelas RPCs da
-- migration seguinte; as triggers daqui repetem o essencial (máquina de
-- estados, imutabilidade, histórico só de inclusão) para qualquer papel,
-- inclusive service_role.

create type offer_status as enum (
    'draft',
    'pending_review',
    'changes_requested',
    'approved',
    'scheduled',
    'active',
    'suspended',
    'rejected',
    'ended'
);

create type offer_benefit_type as enum (
    'percentage_discount',
    'fixed_discount',
    'gift',
    'extra_product',
    'extra_service',
    'special_condition',
    'other'
);

create type offer_review_action as enum (
    'submitted',
    'changes_requested',
    'resubmitted',
    'approved',
    'rejected',
    'published',
    'scheduled',
    'suspended',
    'reactivated',
    'ended'
);

-- ---------------------------------------------------------------------------
-- Dias e horários
-- ---------------------------------------------------------------------------

-- days_of_week: ISO, 1 = segunda … 7 = domingo; os sete dias = todos os dias.
-- time_windows: [{"day": 1, "start": "11:00", "end": "15:00"}, …] em horário
-- local de Pitimbu (America/Recife). Lista vazia = o dia inteiro em cada dia
-- válido. Uma faixa não atravessa a meia-noite e faixas do mesmo dia não se
-- sobrepõem.
create or replace function public.offer_schedule_is_valid(p_days smallint[], p_windows jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
    v_window jsonb;
begin
    if p_days is null or cardinality(p_days) = 0 or cardinality(p_days) > 7
        or exists (select 1 from unnest(p_days) d where d is null or d not between 1 and 7)
        or (select count(distinct d) from unnest(p_days) d) <> cardinality(p_days) then
        return false;
    end if;

    if p_windows is null or jsonb_typeof(p_windows) <> 'array' or jsonb_array_length(p_windows) > 28 then
        return false;
    end if;

    for v_window in select value from jsonb_array_elements(p_windows) loop
        if jsonb_typeof(v_window) <> 'object'
            or (select count(*) from jsonb_object_keys(v_window)) <> 3
            or coalesce(v_window ->> 'day', '') !~ '^[1-7]$'
            or jsonb_typeof(v_window -> 'day') <> 'number'
            or coalesce(v_window ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            or coalesce(v_window ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
            return false;
        end if;
        if (v_window ->> 'start')::time >= (v_window ->> 'end')::time
            or not ((v_window ->> 'day')::smallint = any(p_days)) then
            return false;
        end if;
    end loop;

    return not exists (
        select 1
          from jsonb_array_elements(p_windows) with ordinality a(w, i)
          join jsonb_array_elements(p_windows) with ordinality b(w, j)
            on a.i < b.j and a.w ->> 'day' = b.w ->> 'day'
         where (a.w ->> 'start')::time < (b.w ->> 'end')::time
           and (b.w ->> 'start')::time < (a.w ->> 'end')::time
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- business_id e created_by sem cascata: oferta já enviada carrega aceite
-- financeiro e decisões, e esse registro não some junto com o negócio ou com
-- a conta. Negócio com ofertas é suspenso, não excluído.
create table public.offers (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id),
    status offer_status not null default 'draft',
    published_version_id uuid,
    created_by uuid not null references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    activated_at timestamptz,
    suspended_at timestamptz,
    ended_at timestamptz,
    constraint offers_published_check check (
        status not in ('active', 'suspended')
        or (published_version_id is not null and activated_at is not null)
    ),
    constraint offers_suspended_check check (status <> 'suspended' or suspended_at is not null),
    constraint offers_ended_check check (status <> 'ended' or ended_at is not null)
);

create index offers_business_status_idx on public.offers(business_id, status);
create index offers_status_idx on public.offers(status);

create table public.offer_versions (
    id uuid primary key default gen_random_uuid(),
    offer_id uuid not null references public.offers(id),
    version_number int not null check (version_number > 0),

    -- Andamento desta versão na análise. `draft` é a única editável.
    review_status text not null default 'draft'
        check (review_status in ('draft', 'submitted', 'changes_requested', 'approved', 'rejected')),
    submitted_at timestamptz,

    title text check (title is null or char_length(title) between 3 and 80),
    description text check (description is null or char_length(description) between 1 and 1000),

    benefit_type offer_benefit_type,
    benefit_value numeric(10, 2),

    starts_at timestamptz,
    ends_at timestamptz,

    days_of_week smallint[] not null default '{1,2,3,4,5,6,7}',
    time_windows jsonb not null default '[]'::jsonb,

    minimum_purchase numeric(10, 2) check (minimum_purchase is null or minimum_purchase > 0),
    eligible_items text check (eligible_items is null or char_length(eligible_items) <= 500),

    stackable boolean not null default false,
    conditions text check (conditions is null or char_length(conditions) <= 1000),

    total_limit int check (total_limit is null or total_limit > 0),
    per_user_limit int not null default 1 check (per_user_limit >= 1),
    coupon_validity_minutes int check (coupon_validity_minutes is null or coupon_validity_minutes > 0),

    fee_amount numeric(10, 2) check (fee_amount is null or fee_amount > 0),
    fee_rule_id uuid references public.plan_coupon_fees(id),
    financial_accepted_by uuid references public.profiles(id),
    financial_accepted_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (offer_id, version_number),
    -- Alvo das FKs compostas: versão publicada e histórico sempre da mesma oferta.
    unique (offer_id, id),

    constraint offer_versions_period_check check (starts_at is null or ends_at is null or starts_at < ends_at),
    constraint offer_versions_limits_check check (total_limit is null or per_user_limit <= total_limit),
    -- Percentual entre 0 e 100; desconto em valor positivo. Brinde, produto ou
    -- serviço adicional e condição especial podem não ter valor monetário.
    constraint offer_versions_benefit_value_check check (
        benefit_value is null
        or (benefit_value > 0 and (benefit_type is distinct from 'percentage_discount' or benefit_value <= 100))
    ),
    constraint offer_versions_schedule_check check (public.offer_schedule_is_valid(days_of_week, time_windows)),
    constraint offer_versions_financial_check check (
        (fee_amount is null and fee_rule_id is null and financial_accepted_by is null and financial_accepted_at is null)
        or (fee_amount is not null and fee_rule_id is not null and financial_accepted_by is not null and financial_accepted_at is not null)
    ),
    constraint offer_versions_submitted_check check ((review_status = 'draft') = (submitted_at is null))
);

-- No máximo uma versão aberta (em edição ou aguardando análise) por oferta.
-- Garante, sob concorrência, que não existam dois rascunhos paralelos.
create unique index offer_versions_one_open
    on public.offer_versions(offer_id)
    where review_status in ('draft', 'submitted');

alter table public.offers
    add constraint offers_published_version_fk
    foreign key (id, published_version_id) references public.offer_versions(offer_id, id);

create table public.offer_reviews (
    id uuid primary key default gen_random_uuid(),
    offer_id uuid not null references public.offers(id),
    offer_version_id uuid not null,
    -- null = ação do sistema (ativação agendada).
    actor_id uuid references public.profiles(id),
    action offer_review_action not null,
    message text check (message is null or char_length(message) <= 2000),
    created_at timestamptz not null default now(),
    foreign key (offer_id, offer_version_id) references public.offer_versions(offer_id, id),
    constraint offer_reviews_message_required check (
        action not in ('changes_requested', 'rejected', 'suspended')
        or nullif(btrim(message), '') is not null
    )
);

create index offer_reviews_offer_idx on public.offer_reviews(offer_id, created_at);

create trigger offers_set_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

create trigger offer_versions_set_updated_at
before update on public.offer_versions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- Escrita autorizada. As operações oficiais (migration seguinte) ligam
-- `farol.offer_write` ao começar e desligam antes de retornar; as triggers
-- abaixo recusam qualquer gravação feita fora delas, inclusive por
-- service_role ou postgres. Sem isso, uma Edge Function, script ou manutenção
-- conseguiria uma transição válida sem a linha correspondente em
-- offer_reviews.
--
-- O sinal é um GUC local à transação. Desligá-lo no fim de cada operação
-- impede que um UPDATE direto posterior, na mesma transação, herde a
-- autorização. É proteção contra erro, não contra quem decide ligá-lo à mão:
-- `authenticated` e `anon` continuam sem grant de escrita nestas tabelas.
-- Correções excepcionais exigem desligar a trigger como dono da tabela, de
-- forma explícita e registrada.
create or replace function public.offer_write_authorized()
returns boolean
language sql
stable
as $$
    select coalesce(current_setting('farol.offer_write', true), 'off') = 'on';
$$;

create or replace function public.assert_offer_write_authorized()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.offer_write_authorized() then
        perform public.farol_error('direct_write_not_allowed', 'Ofertas só mudam pelas operações oficiais, que registram o histórico.');
    end if;
end;
$$;

-- Máquina de estados da oferta, válida para qualquer papel. Nenhuma linha
-- nasce fora de `draft`, `ended` não tem saída e `active` só é alcançado de
-- `approved`, `scheduled` ou `suspended` com uma versão aprovada publicada.
-- A validade é conferida antes da autorização, para o erro dizer o que está
-- errado na transição e não apenas por onde ela veio.
create or replace function public.offers_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        perform public.farol_error('offer_not_deletable', 'Ofertas não são apagadas; encerre ou mantenha no histórico.');
    end if;

    if tg_op = 'INSERT' then
        if new.status <> 'draft' or new.published_version_id is not null
            or new.activated_at is not null or new.suspended_at is not null or new.ended_at is not null then
            perform public.farol_error('invalid_transition', 'Toda oferta nova começa como rascunho.');
        end if;
        perform public.assert_offer_write_authorized();
        return new;
    end if;

    if new.business_id is distinct from old.business_id
        or new.created_by is distinct from old.created_by
        or new.created_at is distinct from old.created_at then
        perform public.farol_error('field_not_editable', 'Negócio e autoria da oferta não mudam.');
    end if;

    if new.status is distinct from old.status and not (
        (old.status::text || '>' || new.status::text) = any (array[
            'draft>pending_review',
            'changes_requested>pending_review',
            'pending_review>changes_requested',
            'pending_review>approved',
            'pending_review>rejected',
            'approved>active',
            'approved>scheduled',
            'scheduled>active',
            'active>suspended',
            'suspended>active',
            'approved>ended',
            'scheduled>ended',
            'active>ended',
            'suspended>ended'
        ])
    ) then
        perform public.farol_error('invalid_transition', format('A oferta não pode passar de %s para %s.', old.status, new.status));
    end if;

    if new.published_version_id is distinct from old.published_version_id then
        if new.published_version_id is null or new.status <> 'active' then
            perform public.farol_error('invalid_transition', 'A versão publicada só muda ao publicar a oferta.');
        end if;
        if not exists (
            select 1 from public.offer_versions
             where id = new.published_version_id and review_status = 'approved'
        ) then
            perform public.farol_error('version_not_approved', 'Só uma versão aprovada pode ser publicada.');
        end if;
    end if;

    perform public.assert_offer_write_authorized();
    return new;
end;
$$;

create trigger offers_guard_trigger
before insert or update or delete on public.offers
for each row execute function public.offers_guard();

-- Versão enviada é imutável: só o andamento da análise muda, e só nos passos
-- previstos. Rascunho continua editável — pelas operações oficiais.
create or replace function public.offer_versions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        if old.review_status <> 'draft' then
            perform public.farol_error('version_immutable', 'Uma versão enviada para análise não pode ser apagada.');
        end if;
        perform public.assert_offer_write_authorized();
        return old;
    end if;

    if tg_op = 'INSERT' then
        if new.review_status <> 'draft' then
            perform public.farol_error('invalid_transition', 'Toda versão nova começa como rascunho.');
        end if;
        perform public.assert_offer_write_authorized();
        return new;
    end if;

    if new.offer_id is distinct from old.offer_id or new.version_number is distinct from old.version_number then
        perform public.farol_error('field_not_editable', 'Oferta e número da versão não mudam.');
    end if;

    if old.review_status <> 'draft' then
        if (to_jsonb(new) - 'review_status' - 'updated_at') is distinct from (to_jsonb(old) - 'review_status' - 'updated_at')
            or not (
                old.review_status = 'submitted'
                and new.review_status in ('changes_requested', 'approved', 'rejected')
            ) then
            perform public.farol_error('version_immutable', 'Uma versão enviada para análise não pode ser alterada.');
        end if;
    elsif new.review_status not in ('draft', 'submitted') then
        perform public.farol_error('invalid_transition', 'Um rascunho precisa ser enviado antes da decisão.');
    end if;

    perform public.assert_offer_write_authorized();
    return new;
end;
$$;

create trigger offer_versions_guard_trigger
before insert or update or delete on public.offer_versions
for each row execute function public.offer_versions_guard();

-- Histórico só de inclusão, e só pelas operações oficiais: uma linha
-- inserida à mão seria uma decisão que ninguém tomou.
create or replace function public.offer_reviews_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        perform public.assert_offer_write_authorized();
        return new;
    end if;
    perform public.farol_error('review_immutable', 'O histórico da oferta não é alterado nem apagado.');
    return null;
end;
$$;

create trigger offer_reviews_guard_trigger
before insert or update or delete on public.offer_reviews
for each row execute function public.offer_reviews_guard();

-- ---------------------------------------------------------------------------
-- Visibilidade
-- ---------------------------------------------------------------------------

create or replace function public.owns_offer_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select auth.uid() is not null and exists (
        select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()
    );
$$;

create or replace function public.owns_offer(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select auth.uid() is not null and exists (
        select 1 from public.offers o
          join public.businesses b on b.id = o.business_id
         where o.id = p_offer_id and b.owner_id = auth.uid()
    );
$$;

-- Público vê só a versão publicada de oferta ativa, de negócio ativo e dentro
-- do período. Oferta vencida sai do ar mesmo antes de algum job encerrá-la.
create or replace function public.offer_version_is_public(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
          from public.offers o
          join public.offer_versions v on v.id = o.published_version_id
          join public.businesses b on b.id = o.business_id
         where o.published_version_id = p_version_id
           and o.status = 'active'
           and b.status = 'active'
           and v.starts_at <= now()
           and v.ends_at > now()
    );
$$;

alter table public.offers enable row level security;
alter table public.offer_versions enable row level security;
alter table public.offer_reviews enable row level security;

revoke all on public.offers from public, anon, authenticated;
revoke all on public.offer_versions from public, anon, authenticated;
revoke all on public.offer_reviews from public, anon, authenticated;

-- Visitante recebe só colunas de vitrine: autoria, andamento da análise e
-- aceite financeiro ficam de fora.
grant select (id, business_id, status, published_version_id, activated_at) on public.offers to anon;
grant select (
    id, offer_id, version_number, title, description, benefit_type, benefit_value,
    starts_at, ends_at, days_of_week, time_windows, minimum_purchase, eligible_items,
    stackable, conditions, total_limit, per_user_limit, coupon_validity_minutes
) on public.offer_versions to anon;

grant select on public.offers, public.offer_versions, public.offer_reviews to authenticated;
grant all on public.offers, public.offer_versions, public.offer_reviews to service_role;

create policy offers_select on public.offers
    for select to anon, authenticated using (
        public.offer_version_is_public(published_version_id)
        or public.owns_offer_business(business_id)
        or public.is_admin()
    );

create policy offer_versions_select on public.offer_versions
    for select to anon, authenticated using (
        public.offer_version_is_public(id)
        or public.owns_offer(offer_id)
        or public.is_admin()
    );

create policy offer_reviews_select on public.offer_reviews
    for select to authenticated using (
        public.owns_offer(offer_id)
        or public.is_admin()
    );

revoke all on function public.offers_guard() from public, anon, authenticated;
revoke all on function public.offer_versions_guard() from public, anon, authenticated;
revoke all on function public.offer_reviews_guard() from public, anon, authenticated;
revoke all on function public.assert_offer_write_authorized() from public, anon, authenticated;
revoke all on function public.offer_write_authorized() from public, anon, authenticated;
grant execute on function public.offer_schedule_is_valid(smallint[], jsonb) to anon, authenticated;
grant execute on function public.owns_offer_business(uuid) to anon, authenticated;
grant execute on function public.owns_offer(uuid) to anon, authenticated;
grant execute on function public.offer_version_is_public(uuid) to anon, authenticated;
