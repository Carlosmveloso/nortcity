-- Remove a massa de offers_e2e_dev_setup.sql — APENAS farol-pitimbu-dev.
--
-- Mesma técnica de offers_concurrency_cleanup.sql: as guardas de ofertas são
-- desligadas só dentro desta transação, e somente o que pertence ao negócio
-- 74000000-…-0000000000b1 é apagado. Exige o dono das tabelas (postgres).

begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

alter table public.offers disable trigger offers_guard_trigger;
alter table public.offer_versions disable trigger offer_versions_guard_trigger;
alter table public.offer_reviews disable trigger offer_reviews_guard_trigger;

delete from public.offer_reviews
 where offer_id in (select id from public.offers where business_id = '74000000-0000-4000-8000-0000000000b1');

with doomed as (
    select id from public.offers where business_id = '74000000-0000-4000-8000-0000000000b1'
), versions as (
    delete from public.offer_versions where offer_id in (select id from doomed)
)
delete from public.offers where id in (select id from doomed);

alter table public.offers enable trigger offers_guard_trigger;
alter table public.offer_versions enable trigger offer_versions_guard_trigger;
alter table public.offer_reviews enable trigger offer_reviews_guard_trigger;

delete from public.businesses where id = '74000000-0000-4000-8000-0000000000b1';
delete from public.categories where id = '74000000-0000-4000-8000-0000000000c1';
delete from auth.users where id in ('74000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002');

do $$
begin
    if exists (select 1 from public.businesses where id = '74000000-0000-4000-8000-0000000000b1')
        or exists (select 1 from auth.users where id::text like '74000000-0000-4000-8000-%')
        or exists (select 1 from auth.identities where user_id::text like '74000000-0000-4000-8000-%')
        or exists (select 1 from public.categories where id = '74000000-0000-4000-8000-0000000000c1') then
        raise exception 'offers_e2e_cleanup_incomplete';
    end if;
    if exists (
        select 1 from pg_trigger
         where tgname in ('offers_guard_trigger', 'offer_versions_guard_trigger', 'offer_reviews_guard_trigger')
           and tgenabled = 'D'
    ) then
        raise exception 'offers_e2e_cleanup_trigger_disabled';
    end if;
end;
$$;

commit;
select 'offers_e2e_cleanup_done' as result;
