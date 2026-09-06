-- Junção N:N: um negócio pode ter várias categorias (dado real, não só do
-- schema) e no máximo uma marcada como is_primary.

create table public.business_categories (
    business_id uuid not null references public.businesses(id) on delete cascade,
    category_id uuid not null references public.categories(id) on delete restrict,
    is_primary boolean not null default false,
    primary key (business_id, category_id)
);

create unique index business_categories_one_primary
    on public.business_categories(business_id)
    where (is_primary);

alter table public.business_categories enable row level security;

create policy "business_categories_select"
    on public.business_categories for select
    using (
        exists (
            select 1 from public.businesses b
            where b.id = business_id
              and (b.status = 'active' or b.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
        )
    );

create policy "business_categories_write_owner_or_admin"
    on public.business_categories for all
    using (
        exists (
            select 1 from public.businesses b
            where b.id = business_id
              and (b.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
        )
    );
