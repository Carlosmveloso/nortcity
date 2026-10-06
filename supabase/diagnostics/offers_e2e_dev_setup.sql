-- Massa do E2E real de ofertas — APENAS farol-pitimbu-dev.
--
-- Grava duas contas fictícias com senha (proprietário e admin), um negócio
-- publicado no plano Profissional e uma categoria, todos com ids reservados
-- 74000000-…. A senha NÃO fica no repositório: o executor substitui
-- __E2E_PASSWORD__ por um valor aleatório e o repassa ao Playwright em
-- E2E_DEV_PASSWORD. Remova tudo depois com offers_e2e_dev_cleanup.sql.

begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
    if '__E2E_PASSWORD__' like '\_\_E2E%' then
        raise exception 'offers_e2e_password_not_set: substitua __E2E_PASSWORD__ antes de executar';
    end if;
    if exists (select 1 from auth.users where id::text like '74000000-0000-4000-8000-%') then
        raise exception 'offers_e2e_fixture_exists: execute offers_e2e_dev_cleanup.sql antes';
    end if;
end;
$$;

insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       extensions.crypt('__E2E_PASSWORD__', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), now(), now(),
       '', '', '', ''
  from (values
    ('74000000-0000-4000-8000-000000000001'::uuid, 'offers.e2e.owner@example.test', 'Proprietário E2E'),
    ('74000000-0000-4000-8000-000000000002'::uuid, 'offers.e2e.admin@example.test', 'Admin E2E')
  ) as fixture(id, email, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
  from auth.users
 where id in ('74000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002');

insert into public.user_roles (user_id, role) values ('74000000-0000-4000-8000-000000000002', 'admin');
insert into public.categories (id, name, slug, order_index)
values ('74000000-0000-4000-8000-0000000000c1', 'Ofertas E2E', 'ofertas-e2e', 997);

insert into public.businesses (id, slug, name, description, service_area, phone, status, owner_id)
values (
    '74000000-0000-4000-8000-0000000000b1', 'restaurante-ofertas-e2e', 'Restaurante Ofertas E2E',
    'Cadastro descartável para o E2E de ofertas.', 'Pitimbu e região', '83991117777',
    'active', '74000000-0000-4000-8000-000000000001'
);
insert into public.business_categories (business_id, category_id, is_primary)
values ('74000000-0000-4000-8000-0000000000b1', '74000000-0000-4000-8000-0000000000c1', true);
insert into public.business_plan_assignments (business_id, plan_id, assigned_by, note)
values ('74000000-0000-4000-8000-0000000000b1', 'profissional', '74000000-0000-4000-8000-000000000002', 'E2E de ofertas');

commit;
select 'offers_e2e_fixture_ready' as result;
