-- Favoritos privados da conta. Nenhuma alteração nas regras de negócios.
create table public.business_favorites (
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    business_id uuid not null references public.businesses(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, business_id)
);

create index business_favorites_business_id on public.business_favorites (business_id);
alter table public.business_favorites enable row level security;
revoke all on public.business_favorites from public, anon, authenticated;
grant select, insert, delete on public.business_favorites to authenticated;
grant all on public.business_favorites to service_role;

create policy favorites_select_own on public.business_favorites
    for select to authenticated using (user_id = (select auth.uid()));

create policy favorites_insert_own_active on public.business_favorites
    for insert to authenticated with check (
        user_id = (select auth.uid())
        and exists (
            select 1 from public.businesses b
            where b.id = business_favorites.business_id and b.status = 'active'
        )
    );

-- Remover continua permitido mesmo quando o negócio deixa de ser público.
create policy favorites_delete_own on public.business_favorites
    for delete to authenticated using (user_id = (select auth.uid()));
