-- `UPDATE requires a WHERE clause` ao criar negócio já publicado.
--
-- O Supabase carrega a extensão pg-safeupdate nas conexões que chegam pela API
-- (PostgREST), e ela recusa UPDATE/DELETE sem WHERE — inclusive dentro de
-- função SECURITY DEFINER e de trigger. As três funções de
-- 20260918000001_site_rebuild_hook.sql atualizavam `site_rebuild` sem WHERE
-- porque a tabela só tem uma linha. A trigger roda na transação da RPC, então
-- toda escrita que mexia na vitrine (criar ativo, aprovar, suspender, trocar
-- nome/descrição/capa/categoria de ativo, excluir ativo) era desfeita inteira.
--
-- O PGlite não carrega o safeupdate, por isso os testes passaram. A guarda agora
-- é de catálogo: src/test/db/safeupdate.test.js.
--
-- `where id` basta: id é a pk booleana, sempre true.

create or replace function public.mark_site_rebuild()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.site_rebuild
       set requested_seq = requested_seq + 1,
           requested_at = now()
     where id;
    return null;
end;
$$;

create or replace function public.mark_site_rebuild_from_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business uuid;
begin
    -- NEW não está atribuído num trigger de DELETE; ler o campo direto levanta
    -- "record new is not assigned yet".
    if tg_op = 'DELETE' then
        v_business := old.business_id;
    else
        v_business := new.business_id;
    end if;

    if exists (select 1 from public.businesses where id = v_business and status = 'active') then
        update public.site_rebuild
           set requested_seq = requested_seq + 1,
               requested_at = now()
         where id;
    end if;

    return null;
end;
$$;

create or replace function public.fire_site_rebuild()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_state public.site_rebuild;
    v_url text;
begin
    select * into v_state from public.site_rebuild for update;

    if not found or v_state.requested_seq <= v_state.fired_seq then
        return false;
    end if;

    select decrypted_secret into v_url
      from vault.decrypted_secrets
     where name = 'vercel_deploy_hook';

    if v_url is null then
        return false;
    end if;

    perform net.http_post(url => v_url, body => '{}'::jsonb);

    update public.site_rebuild
       set fired_seq = v_state.requested_seq,
           fired_at = now()
     where id;
    return true;
end;
$$;

-- `create or replace` preserva os privilégios, mas fica explícito.
revoke all on function public.fire_site_rebuild() from public;
