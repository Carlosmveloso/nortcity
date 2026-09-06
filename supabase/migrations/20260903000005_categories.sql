create table public.categories (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    name text not null,
    description text,
    icon text,
    image_url text,
    featured boolean not null default false,
    order_index int not null default 0,
    created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_public"
    on public.categories for select
    using (true);

create policy "categories_admin_write"
    on public.categories for all
    using (public.has_role(auth.uid(), 'admin'))
    with check (public.has_role(auth.uid(), 'admin'));
