-- Colunas que dependem de features futuras (plan_id, verified, avg_rating,
-- review_count, views_count, cover_image, gallery) ficam de fora por
-- enquanto: entram via ALTER TABLE junto com cada feature (Storage, Stripe,
-- reviews, analytics).

create table public.businesses (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references public.profiles(id) on delete set null,
    slug text unique not null,
    name text not null,
    subcategory text,
    description text,
    address text,
    neighborhood text,
    lat numeric,
    lng numeric,
    phone text,
    whatsapp text,
    email text,
    website text,
    instagram text,
    facebook text,
    hours jsonb,
    price_range text check (price_range in ('$', '$$', '$$$', '$$$$')),
    status business_status not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index businesses_status_idx on public.businesses(status);
create index businesses_owner_idx on public.businesses(owner_id);

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

-- RN05: todo negócio novo entra pendente; só admin muda status (via client
-- ou seed). Isso é reforçado no servidor porque o client nunca deve poder
-- se autoaprovar.
create or replace function public.businesses_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if not public.has_role(auth.uid(), 'admin') then
            new.status := 'pending';
        end if;
    elsif tg_op = 'UPDATE' then
        if new.status is distinct from old.status and not public.has_role(auth.uid(), 'admin') then
            new.status := old.status;
        end if;
    end if;
    return new;
end;
$$;

create trigger businesses_guard_status_trigger
before insert or update on public.businesses
for each row execute function public.businesses_guard_status();

alter table public.businesses enable row level security;

create policy "businesses_select_public_or_owner_or_admin"
    on public.businesses for select
    using (
        status = 'active'
        or owner_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
    );

create policy "businesses_insert_authenticated"
    on public.businesses for insert
    with check (owner_id = auth.uid());

create policy "businesses_update_owner_or_admin"
    on public.businesses for update
    using (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "businesses_delete_admin_only"
    on public.businesses for delete
    using (public.has_role(auth.uid(), 'admin'));
