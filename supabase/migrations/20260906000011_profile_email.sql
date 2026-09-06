-- E-mail no perfil, para o admin conseguir localizar a conta na hora de
-- vincular um proprietário (PRO-03).
--
-- Sem isto o vínculo manual só seria possível colando um uuid: `auth.users`
-- não é exposta pelo PostgREST e `profiles` não guardava e-mail nenhum. A RLS
-- de profiles continua sendo "próprio perfil ou admin", então o e-mail não
-- fica visível para outros usuários.

alter table public.profiles add column email text;

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id;

create index profiles_email_idx on public.profiles (lower(email));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, email)
    values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);

    insert into public.user_roles (user_id, role)
    values (new.id, 'user');

    return new;
end;
$$;
