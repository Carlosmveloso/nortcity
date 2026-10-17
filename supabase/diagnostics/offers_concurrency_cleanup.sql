-- Remove a massa de offers_concurrency_setup.sql — APENAS farol-pitimbu-dev.
--
-- Ofertas, versões enviadas e histórico são protegidos contra exclusão para
-- qualquer papel. Esta limpeza desliga essas três triggers só dentro da
-- própria transação (ALTER TABLE é transacional: se algo falhar, nada muda)
-- e apaga exclusivamente o que pertence ao negócio 73000000-…-0000000000b1.
-- Exige ser executada como dono das tabelas (postgres).

begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

alter table public.offers disable trigger offers_guard_trigger;
alter table public.offer_versions disable trigger offer_versions_guard_trigger;
alter table public.offer_reviews disable trigger offer_reviews_guard_trigger;

delete from public.offer_reviews
 where offer_id in (select id from public.offers where business_id = '73000000-0000-4000-8000-0000000000b1');

-- offers.published_version_id e offer_versions.offer_id apontam um para o
-- outro; apagando os dois no mesmo comando, as FKs são conferidas no fim.
with doomed as (
    select id from public.offers where business_id = '73000000-0000-4000-8000-0000000000b1'
), versions as (
    delete from public.offer_versions where offer_id in (select id from doomed)
)
delete from public.offers where id in (select id from doomed);

alter table public.offers enable trigger offers_guard_trigger;
alter table public.offer_versions enable trigger offer_versions_guard_trigger;
alter table public.offer_reviews enable trigger offer_reviews_guard_trigger;

delete from public.businesses where id = '73000000-0000-4000-8000-0000000000b1';
delete from public.categories where id = '73000000-0000-4000-8000-0000000000c1';
delete from auth.users where id in (
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000002'
);

do $$
begin
    if exists (select 1 from public.businesses where id = '73000000-0000-4000-8000-0000000000b1')
        or exists (select 1 from auth.users where id::text like '73000000-0000-4000-8000-%')
        or exists (select 1 from public.categories where id = '73000000-0000-4000-8000-0000000000c1') then
        raise exception 'offers_concurrency_cleanup_incomplete';
    end if;
    if exists (
        select 1 from pg_trigger
         where tgname in ('offers_guard_trigger', 'offer_versions_guard_trigger', 'offer_reviews_guard_trigger')
           and tgenabled = 'D'
    ) then
        raise exception 'offers_concurrency_cleanup_trigger_disabled';
    end if;
end;
$$;

commit;
select 'offers_concurrency_cleanup_done' as result;
