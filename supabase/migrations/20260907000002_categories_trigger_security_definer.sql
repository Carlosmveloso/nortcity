-- A trigger de categorias rodava sem privilégio para a função que ela chama.
--
-- `business_categories_check()` foi criada na migration 20260906000003 sem
-- `security definer`. A migration 20260906000010 revogou `execute` de
-- `assert_business_categories()` e `farol_error()` de PUBLIC, porque função
-- interna não é endpoint. As duas decisões, isoladas, estão certas; juntas,
-- quebraram toda escrita de categoria feita por usuário autenticado.
--
-- O detalhe que fecha a armadilha: a trigger é `deferrable initially deferred`,
-- então ela não roda dentro da RPC `SECURITY DEFINER` (onde current_user seria
-- o dono, `postgres`) — roda no COMMIT, quando o papel corrente já voltou a ser
-- `authenticated`. Resultado em produção:
--
--     permission denied for function assert_business_categories
--
-- Atinge tudo que mexe em business_categories vindo do app: `submit_business`
-- (/cadastrar-negocio), `admin_create_business` e `admin_update_business`
-- quando o admin salva com categorias. Moderação (approve/reject/suspend) não
-- toca a tabela, por isso o painel parecia funcionar pela metade.
--
-- Correção: a trigger passa a ser `security definer`, como já era
-- `businesses_guard_status()`. `create or replace` mantém o mesmo oid, então o
-- trigger existente continua apontando para ela — não é preciso recriá-lo.
--
-- Terceira vez que GRANT esquecido morde este projeto (businesses na 0009,
-- categories na 0010, esta agora). Ver o teste
-- `src/test/db/function-privileges.test.js`, que passa a barrar o padrão.

create or replace function public.business_categories_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business_id uuid := coalesce(new.business_id, old.business_id);
begin
    if not exists (select 1 from public.businesses where id = v_business_id) then
        return null;
    end if;

    perform public.assert_business_categories(v_business_id);
    return null;
end;
$$;
