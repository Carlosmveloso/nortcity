-- Papéis de usuário em tabela separada (não em profiles) para permitir a
-- função has_role() SECURITY DEFINER sem recursão de RLS.

create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    role app_role not null,
    created_at timestamptz not null default now(),
    unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles(user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.user_roles
        where user_id = _user_id and role = _role
    )
$$;

alter table public.user_roles enable row level security;

create policy "user_roles_select_own_or_admin"
    on public.user_roles for select
    using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "user_roles_admin_write"
    on public.user_roles for all
    using (public.has_role(auth.uid(), 'admin'))
    with check (public.has_role(auth.uid(), 'admin'));
