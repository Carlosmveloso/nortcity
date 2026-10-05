-- Planos mínimos para o módulo de ofertas (Sprint 1, 05/10/2026).
--
-- Não há assinatura nem cobrança: o plano de cada negócio é atribuído
-- manualmente pelo admin. Negócio sem atribuição está no Gratuito — por isso
-- nenhuma linha é criada para os negócios existentes e `businesses` não ganha
-- coluna nova (que dispararia o guard e o rebuild do site sem necessidade).
--
-- Plano, propriedade e status do negócio continuam independentes: trocar o
-- plano não aprova, não reativa nem suspende o negócio.

create table public.plans (
    id text primary key check (id ~ '^[a-z_]+$'),
    name text not null,
    -- Quantas ofertas o negócio pode manter com status `active` ao mesmo tempo.
    active_offer_limit int not null check (active_offer_limit >= 0),
    sort_order int not null unique,
    created_at timestamptz not null default now()
);

insert into public.plans (id, name, active_offer_limit, sort_order) values
    ('gratuito', 'Gratuito', 0, 0),
    ('basico', 'Básico', 1, 1),
    ('profissional', 'Profissional', 3, 2),
    ('premium', 'Premium', 5, 3);

-- Taxa por cupom utilizado, com vigência. O valor nunca é escrito na
-- aplicação: a oferta copia a regra vigente no aceite (offer_versions).
-- Gratuito não tem taxa — e, sem taxa, não há aceite financeiro possível.
create table public.plan_coupon_fees (
    id uuid primary key default gen_random_uuid(),
    plan_id text not null references public.plans(id),
    amount numeric(10, 2) not null check (amount > 0),
    valid_from timestamptz not null,
    valid_until timestamptz,
    created_at timestamptz not null default now(),
    constraint plan_coupon_fees_validity_check check (valid_until is null or valid_until > valid_from)
);

create index plan_coupon_fees_plan_idx on public.plan_coupon_fees(plan_id, valid_from);

-- Regra já aceita por alguma oferta é contrato: só pode ganhar data de fim.
-- E duas regras do mesmo plano não podem valer no mesmo instante, senão "a
-- taxa vigente" deixa de ser uma só.
create or replace function public.plan_coupon_fees_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'UPDATE' and (
        new.plan_id is distinct from old.plan_id
        or new.amount is distinct from old.amount
        or new.valid_from is distinct from old.valid_from
    ) then
        perform public.farol_error('fee_rule_immutable', 'Uma taxa publicada só pode ser encerrada; crie uma nova regra para outro valor.');
    end if;

    perform 1 from public.plans where id = new.plan_id for update;

    if exists (
        select 1 from public.plan_coupon_fees f
         where f.plan_id = new.plan_id
           and f.id <> new.id
           and tstzrange(f.valid_from, f.valid_until) && tstzrange(new.valid_from, new.valid_until)
    ) then
        perform public.farol_error('fee_rule_overlap', 'Já existe uma taxa vigente para este plano no mesmo período.');
    end if;

    return new;
end;
$$;

create trigger plan_coupon_fees_guard_trigger
before insert or update on public.plan_coupon_fees
for each row execute function public.plan_coupon_fees_guard();

-- Valores iniciais decididos em 05/10/2026.
insert into public.plan_coupon_fees (plan_id, amount, valid_from) values
    ('basico', 1.50, '2026-10-01 00:00:00-03'),
    ('profissional', 1.00, '2026-10-01 00:00:00-03'),
    ('premium', 0.50, '2026-10-01 00:00:00-03');

-- Histórico de atribuições manuais. A linha mais recente é o plano atual;
-- nada é sobrescrito.
create table public.business_plan_assignments (
    id bigint generated always as identity primary key,
    business_id uuid not null references public.businesses(id) on delete cascade,
    plan_id text not null references public.plans(id),
    assigned_by uuid references public.profiles(id) on delete set null,
    note text check (note is null or char_length(note) <= 500),
    created_at timestamptz not null default now()
);

create index business_plan_assignments_business_idx on public.business_plan_assignments(business_id, id desc);

create or replace function public.business_plan_id(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select plan_id from public.business_plan_assignments
          where business_id = p_business_id
          order by id desc limit 1),
        'gratuito'
    );
$$;

create or replace function public.current_plan_coupon_fee(p_plan_id text, p_at timestamptz default now())
returns public.plan_coupon_fees
language sql
stable
security definer
set search_path = public
as $$
    select * from public.plan_coupon_fees
     where plan_id = p_plan_id
       and valid_from <= p_at
       and (valid_until is null or valid_until > p_at)
     limit 1;
$$;

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plan_coupon_fees enable row level security;
alter table public.business_plan_assignments enable row level security;

revoke all on public.plans from public, anon, authenticated;
revoke all on public.plan_coupon_fees from public, anon, authenticated;
revoke all on public.business_plan_assignments from public, anon, authenticated;

grant select on public.plans to anon, authenticated;
grant select on public.plan_coupon_fees to authenticated;
grant select on public.business_plan_assignments to authenticated;
grant all on public.plans, public.plan_coupon_fees, public.business_plan_assignments to service_role;

create policy plans_select_all on public.plans
    for select to anon, authenticated using (true);

create policy plan_coupon_fees_select_authenticated on public.plan_coupon_fees
    for select to authenticated using (true);

create policy business_plan_assignments_owner_or_admin on public.business_plan_assignments
    for select to authenticated using (
        public.is_admin()
        or exists (
            select 1 from public.businesses b
             where b.id = business_plan_assignments.business_id
               and b.owner_id = (select auth.uid())
        )
    );

revoke all on function public.plan_coupon_fees_guard() from public, anon, authenticated;
revoke all on function public.business_plan_id(uuid) from public, anon, authenticated;
revoke all on function public.current_plan_coupon_fee(text, timestamptz) from public, anon, authenticated;
