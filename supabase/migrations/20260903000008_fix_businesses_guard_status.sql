-- A versão original de businesses_guard_status() (migration 0006) tratava
-- auth.uid() = null (conexão direta: seed, SQL editor, service_role) como
-- "não-admin" e forçava status='pending' também nesses casos — quebrando o
-- seed, que insere os 78 negócios já como 'active'. O guard só deve valer
-- para inserts feitos por um usuário autenticado via PostgREST.

create or replace function public.businesses_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
            new.status := 'pending';
        end if;
    elsif tg_op = 'UPDATE' then
        if new.status is distinct from old.status
            and auth.uid() is not null
            and not public.has_role(auth.uid(), 'admin') then
            new.status := old.status;
        end if;
    end if;
    return new;
end;
$$;
