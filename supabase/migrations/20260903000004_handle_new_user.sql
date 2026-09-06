-- Cria profile + role 'user' automaticamente a cada signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (new.id, new.raw_user_meta_data ->> 'full_name');

    insert into public.user_roles (user_id, role)
    values (new.id, 'user');

    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
