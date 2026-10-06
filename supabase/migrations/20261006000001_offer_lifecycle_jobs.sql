-- Ciclo de vida automático das ofertas (decisão de 06/10/2026).
--
-- A cada 5 minutos, `process_offer_lifecycle()`:
--   1. encerra ofertas `active`, `suspended`, `scheduled` e `approved` cujo
--      período já terminou;
--   2. ativa ofertas `scheduled` cujo início chegou.
--
-- Encerrar vem antes de ativar: uma oferta agendada que ficou presa (job
-- parado, plano sem vaga) e já venceu vai direto para `ended`, sem um
-- `published` artificial no histórico.
--
-- Fuso: starts_at/ends_at são timestamptz já normalizados pela aplicação
-- (00:00 e 23:59:59 em UTC−3). A comparação é direta com o instante atual;
-- nada aqui converte para data local ou para UTC.
--
-- `p_now` existe para os testes provarem os limites de horário. O cron chama
-- sem argumento e usa now().
--
-- Rascunhos, ofertas em análise, com ajustes pendentes, rejeitadas e
-- encerradas não são tocadas: o banco já impede aprovar ou publicar versão
-- vencida, e o histórico delas fica como está.

-- Período que vale para a oferta: o da versão publicada; antes da primeira
-- publicação (approved/scheduled), o da versão aprovada mais recente.
create or replace function public.offer_period_version(p_offer public.offers)
returns public.offer_versions
language sql
stable
security definer
set search_path = public
as $$
    select v.*
      from public.offer_versions v
     where v.id = coalesce(p_offer.published_version_id, (public.latest_offer_version(p_offer.id)).id);
$$;

create or replace function public.end_expired_offers(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers;
    v_version public.offer_versions;
    v_count int := 0;
begin
    perform public.begin_offer_write();
    for v_offer in
        select o.* from public.offers o
         where o.status in ('active', 'suspended', 'scheduled', 'approved')
         order by o.created_at
           for update skip locked
    loop
        v_version := public.offer_period_version(v_offer);
        continue when v_version.ends_at is null or v_version.ends_at > p_now;

        update public.offers set status = 'ended', ended_at = now() where id = v_offer.id;
        -- Ação do sistema: sem autor, mesmo que a função seja chamada numa
        -- sessão com JWT.
        insert into public.offer_reviews (offer_id, offer_version_id, actor_id, action, message)
        values (v_offer.id, v_version.id, null, 'ended', 'Período da oferta encerrado');
        v_count := v_count + 1;
    end loop;
    perform public.end_offer_write();
    return v_count;
end;
$$;

-- Substitui a versão sem parâmetro da migration 20261005000003. A regra é a
-- mesma; muda o instante de referência e a ordem: quem começa antes ocupa a
-- vaga do plano primeiro. Sem vaga, a oferta continua `scheduled` e é tentada
-- de novo na próxima execução.
drop function public.activate_due_offers();

create or replace function public.activate_due_offers(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers;
    v_version public.offer_versions;
    v_count int := 0;
begin
    perform public.begin_offer_write();
    for v_offer in
        select o.* from public.offers o
         where o.status = 'scheduled'
         order by (public.latest_offer_version(o.id)).starts_at, o.created_at
           for update skip locked
    loop
        v_version := public.latest_offer_version(v_offer.id);
        continue when v_version.starts_at > p_now or v_version.ends_at <= p_now;
        begin
            perform public.activate_offer_version(v_offer, v_version, 'published');
            v_count := v_count + 1;
        exception when sqlstate 'P0001' then
            null;
        end;
    end loop;
    perform public.end_offer_write();
    return v_count;
end;
$$;

create or replace function public.process_offer_lifecycle(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ended int;
    v_activated int;
begin
    v_ended := public.end_expired_offers(p_now);
    v_activated := public.activate_due_offers(p_now);
    return jsonb_build_object('ended', v_ended, 'activated', v_activated);
end;
$$;

revoke all on function public.offer_period_version(public.offers) from public, anon, authenticated;
revoke all on function public.end_expired_offers(timestamptz) from public, anon, authenticated;
revoke all on function public.activate_due_offers(timestamptz) from public, anon, authenticated;
revoke all on function public.process_offer_lifecycle(timestamptz) from public, anon, authenticated;

select cron.schedule('offer-lifecycle', '*/5 * * * *', 'select public.process_offer_lifecycle()');
