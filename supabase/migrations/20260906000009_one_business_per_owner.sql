-- PRO-01: uma conta possui zero ou um negócio, contando todos os status
-- (rejeitado e suspenso também ocupam a vaga). Negócio sem dono continua
-- válido e pode existir aos montes — por isso o índice é parcial.
--
-- Aplicação em banco com dados: rode antes
-- `supabase/diagnostics/business_data_audit.sql`. Se houver conta com mais de
-- um negócio, esta migration FALHA de propósito, com a lista dos casos, em vez
-- de escolher sozinha qual negócio preservar. A adequação é decisão humana:
-- ver `docs/plano-migracao-regras-negocio.md`.
do $$
declare
    v_report text;
begin
    select string_agg(format('owner_id=%s tem %s negócios: %s', owner_id, total, slugs), e'\n')
      into v_report
      from (
        select owner_id, count(*) as total, string_agg(slug, ', ' order by created_at) as slugs
          from public.businesses
         where owner_id is not null
         group by owner_id
        having count(*) > 1
      ) duplicates;

    if v_report is not null then
        raise exception using
            errcode = 'P0001',
            message = 'owner_with_multiple_businesses',
            detail = 'Contas com mais de um negócio impedem o índice único de PRO-01:' || e'\n' || v_report,
            hint = 'Use admin_unlink_business_owner() ou admin_link_business_owner() para decidir qual negócio fica com cada conta antes de reaplicar esta migration.';
    end if;
end;
$$;

create unique index businesses_one_per_owner
    on public.businesses (owner_id)
    where owner_id is not null;
