-- Substitui businesses_guard_status() por um guard de colunas administrativas.
--
-- Duas mudanças de comportamento em relação à migration 0008:
--   1. Além de `status`, protege owner_id, slug e os campos de moderação e de
--      duplicidade — antes o dono podia renomear o próprio slug (quebrando as
--      URLs já compartilhadas) e ninguém validava owner_id na atualização.
--   2. Passa a levantar erro em vez de reverter em silêncio. Reverter calado
--      fazia o app achar que a operação deu certo.
--
-- As RPCs confiáveis (SECURITY DEFINER, migration 0007) sinalizam que já
-- validaram autorização ligando `farol.trusted_write` na própria transação.
-- Escrita direta via PostgREST não consegue ligar esse GUC porque nem a
-- função set_config nem os GRANTs de escrita ficam disponíveis para
-- `authenticated` (ver migration 0010).
create or replace function public.businesses_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_trusted boolean := coalesce(current_setting('farol.trusted_write', true), 'off') = 'on';
    v_actor uuid := auth.uid();
begin
    -- Conexão direta (seed, SQL editor, service_role) e admin autenticado
    -- continuam livres; RPC confiável já validou o que precisava.
    if v_trusted or v_actor is null or public.has_role(v_actor, 'admin') then
        return new;
    end if;

    if tg_op = 'INSERT' then
        if new.status is distinct from 'pending' then
            perform public.farol_error('status_not_allowed', 'Todo cadastro novo entra como pendente de análise.');
        end if;
        if new.owner_id is distinct from v_actor then
            perform public.farol_error('owner_not_allowed', 'O negócio precisa ser cadastrado na própria conta.');
        end if;
        if new.moderation_reason is not null or new.moderated_at is not null or new.moderated_by is not null then
            perform public.farol_error('moderation_not_allowed', 'Campos de moderação são preenchidos apenas pela análise.');
        end if;
        return new;
    end if;

    if new.status is distinct from old.status then
        perform public.farol_error('status_not_allowed', 'Só a análise do Farol muda o status do negócio.');
    end if;
    if new.owner_id is distinct from old.owner_id then
        perform public.farol_error('owner_not_allowed', 'O proprietário do negócio não pode ser alterado por aqui.');
    end if;
    if new.slug is distinct from old.slug then
        perform public.farol_error('slug_not_allowed', 'O endereço público do negócio não pode ser alterado.');
    end if;
    if new.moderation_reason is distinct from old.moderation_reason
        or new.moderation_note is distinct from old.moderation_note
        or new.moderated_at is distinct from old.moderated_at
        or new.moderated_by is distinct from old.moderated_by
        or new.duplicate_candidates is distinct from old.duplicate_candidates
        or new.duplicate_reviewed_at is distinct from old.duplicate_reviewed_at then
        perform public.farol_error('moderation_not_allowed', 'Campos de moderação são preenchidos apenas pela análise.');
    end if;

    return new;
end;
$$;
