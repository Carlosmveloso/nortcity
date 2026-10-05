-- Apenas desenvolvimento. Usa usuários fictícios, papéis reais e ROLLBACK.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

create temp table qa_favorites (active_id uuid, pending_id uuid);
grant select, insert on qa_favorites to authenticated;

create function pg_temp.assert_favorite(condition boolean, message text)
returns void language plpgsql as $$
begin
    if not coalesce(condition, false) then raise exception 'favorites_qa_failed: %', message; end if;
end;
$$;
grant execute on function pg_temp.assert_favorite(boolean, text) to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at) values
    ('61000000-0000-4000-8000-000000000001', 'favorite.alice@example.test', now(), '{}', now(), now()),
    ('61000000-0000-4000-8000-000000000002', 'favorite.bob@example.test', now(), '{}', now(), now()),
    ('61000000-0000-4000-8000-000000000003', 'favorite.admin@example.test', now(), '{}', now(), now());
insert into public.user_roles (user_id, role) values ('61000000-0000-4000-8000-000000000003', 'admin');
insert into public.categories (id, name, slug, order_index)
values ('62000000-0000-4000-8000-000000000001', 'Favoritos QA', 'favoritos-qa', 999);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
set local role authenticated;
insert into qa_favorites values (
    public.admin_create_business('{"name":"Favorito publicado QA","service_area":"Pitimbu","phone":"83999999999"}', array['62000000-0000-4000-8000-000000000001'::uuid], null, 'active'),
    public.admin_create_business('{"name":"Favorito pendente QA","service_area":"Pitimbu","phone":"83999999999"}', array['62000000-0000-4000-8000-000000000001'::uuid], null, 'pending')
);
set constraints all immediate;
reset role;

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into public.business_favorites (business_id) select active_id from qa_favorites;
do $$
begin
    begin
        insert into public.business_favorites (business_id) select active_id from qa_favorites;
        raise exception 'duplicata permitida';
    exception when unique_violation then null; end;
    begin
        insert into public.business_favorites (business_id) select pending_id from qa_favorites;
        raise exception 'pendente permitido';
    exception when insufficient_privilege then null; end;
    begin
        insert into public.business_favorites (user_id, business_id)
        select '61000000-0000-4000-8000-000000000002', active_id from qa_favorites;
        raise exception 'escrita alheia permitida';
    exception when insufficient_privilege then null; end;
    begin
        update public.business_favorites set user_id = '61000000-0000-4000-8000-000000000002' where user_id = auth.uid();
        raise exception 'update permitido';
    exception when insufficient_privilege then null; end;
end;
$$;
select pg_temp.assert_favorite((select count(*) = 1 from public.business_favorites), 'Alice lê seu favorito');
reset role;

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.assert_favorite((select count(*) = 0 from public.business_favorites), 'Bob não lê Alice');
delete from public.business_favorites where user_id = '61000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.assert_favorite((select count(*) = 1 from public.business_favorites where user_id = '61000000-0000-4000-8000-000000000001'), 'Bob não remove Alice');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.assert_favorite((select count(*) = 0 from public.business_favorites), 'admin não lê favoritos alheios');
select public.moderate_business((select active_id from qa_favorites), 'suspend', 'business_closed', null);
reset role;

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.assert_favorite((select count(*) = 0 from public.business_favorites f join public.businesses b on b.id = f.business_id where b.status = 'active'), 'suspenso não aparece');
delete from public.business_favorites where business_id = (select active_id from qa_favorites);
select pg_temp.assert_favorite((select count(*) = 0 from public.business_favorites), 'remove mesmo suspenso');
reset role;

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select public.moderate_business((select active_id from qa_favorites), 'reactivate', null, null);
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into public.business_favorites (business_id) select active_id from qa_favorites;
reset role;
delete from auth.users where id = '61000000-0000-4000-8000-000000000001';
select pg_temp.assert_favorite((select count(*) = 0 from public.business_favorites where user_id = '61000000-0000-4000-8000-000000000001'), 'cascata da conta');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
set local role authenticated;
insert into public.business_favorites (business_id) select active_id from qa_favorites;
reset role;
delete from public.businesses where id = (select active_id from qa_favorites);
select pg_temp.assert_favorite((select count(*) = 0 from public.business_favorites where user_id = '61000000-0000-4000-8000-000000000002'), 'cascata do negócio');

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
    begin
        perform * from public.business_favorites;
        raise exception 'anon lê favoritos';
    exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
select 'favorites_qa_passed_with_rollback' as result;
