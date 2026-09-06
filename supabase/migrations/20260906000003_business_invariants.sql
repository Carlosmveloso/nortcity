-- Dados mínimos (APR-01) e invariantes de categoria (CAT-02/CAT-03).
--
-- Todo erro é levantado com `message` = código estável em inglês e `detail` =
-- frase em PT-BR. O cliente decide o que mostrar a partir do código; o detail
-- existe para quem lê o erro direto (SQL editor, log) entender sem consultar
-- tabela de códigos.

create or replace function public.farol_error(p_code text, p_detail text)
returns void
language plpgsql
as $$
begin
    raise exception using errcode = 'P0001', message = p_code, detail = p_detail;
end;
$$;

-- Um contato só conta como "público válido" se tiver forma de contato de
-- verdade: telefone com DDD, e-mail com domínio, site com ponto. Sem isso
-- "telefone: a" satisfaria o mínimo (APR-01) e o negócio seria aprovado sem
-- ninguém conseguir falar com ele.
create or replace function public.is_valid_contact(p_kind text, p_value text)
returns boolean
language sql
immutable
as $$
    select case
        when p_value is null or btrim(p_value) = '' then false
        when p_kind in ('phone', 'whatsapp') then length(regexp_replace(p_value, '\D', '', 'g')) between 10 and 15
        when p_kind = 'email' then p_value ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$'
        when p_kind = 'website' then p_value ~ '\.[a-zA-Z]{2,}'
        when p_kind = 'instagram' then length(btrim(p_value)) >= 2
        else false
    end;
$$;

create or replace function public.business_has_public_contact(b public.businesses)
returns boolean
language sql
immutable
as $$
    select public.is_valid_contact('phone', b.phone)
        or public.is_valid_contact('whatsapp', b.whatsapp)
        or public.is_valid_contact('email', b.email)
        or public.is_valid_contact('instagram', b.instagram)
        or public.is_valid_contact('website', b.website);
$$;

-- Localização identificável = endereço público OU bairro OU área de
-- atendimento. Não exige lat/lng nem endereço residencial de autônomo
-- (LOC-02): quem atende sem ponto fixo preenche apenas service_area.
create or replace function public.business_has_location(b public.businesses)
returns boolean
language sql
immutable
as $$
    select coalesce(btrim(b.address), '') <> ''
        or coalesce(btrim(b.neighborhood), '') <> ''
        or coalesce(btrim(b.service_area), '') <> '';
$$;

-- Contrato de descrição decidido em 06/09/2026: mínimo 40, máximo 1500.
--
-- Os dois parâmetros existem por causa dos dados legados. Diagnóstico do
-- acervo em 06/09/2026 (79 negócios, 78 publicados):
--   53 têm descrição com menos de 40 caracteres;
--   30 não têm endereço nem bairro (vieram de listas onde só o nome e o
--   contato foram levantados);
--    0 estão sem contato público válido.
-- Exigir o mínimo em toda escrita transformaria a correção de um telefone
-- desses cadastros em retrofit obrigatório de texto e endereço. A regra fica:
-- descrição e localização são checadas quando são criadas ou alteradas, nunca
-- como pedágio para mexer em outro campo. Nome e contato público, esses sim,
-- valem sempre — é o que impede uma edição de deixar o negócio inalcançável.
-- Ver `supabase/diagnostics/business_data_audit.sql`.
create or replace function public.assert_business_minimums(
    b public.businesses,
    p_check_description boolean default true,
    p_check_location boolean default true
)
returns void
language plpgsql
as $$
begin
    if coalesce(btrim(b.name), '') = '' or length(btrim(b.name)) < 2 then
        perform public.farol_error('name_required', 'Informe o nome do negócio (mínimo 2 caracteres).');
    end if;

    if length(btrim(b.name)) > 120 then
        perform public.farol_error('name_too_long', 'O nome do negócio deve ter no máximo 120 caracteres.');
    end if;

    if p_check_description then
        if coalesce(btrim(b.description), '') = '' then
            perform public.farol_error('description_required', 'Escreva uma descrição do negócio.');
        end if;

        if length(btrim(b.description)) < 40 then
            perform public.farol_error('description_too_short', 'A descrição precisa ter pelo menos 40 caracteres.');
        end if;

        if length(btrim(b.description)) > 1500 then
            perform public.farol_error('description_too_long', 'A descrição pode ter no máximo 1500 caracteres.');
        end if;
    end if;

    if p_check_location and not public.business_has_location(b) then
        perform public.farol_error('location_required', 'Informe o endereço, o bairro ou a área de atendimento.');
    end if;

    if not public.business_has_public_contact(b) then
        perform public.farol_error('contact_required', 'Informe ao menos um contato público válido: telefone, WhatsApp, e-mail, Instagram ou site.');
    end if;
end;
$$;

-- CAT-02/CAT-03: de uma a três categorias e exatamente uma primária, sempre
-- dentro do conjunto escolhido. O índice único da migration 0007 garantia
-- apenas "no máximo uma primária" — não garantia que existisse nenhuma, nem
-- limitava a quantidade.
create or replace function public.assert_business_categories(p_business_id uuid)
returns void
language plpgsql
as $$
declare
    v_total int;
    v_primary int;
begin
    select count(*), count(*) filter (where is_primary)
      into v_total, v_primary
      from public.business_categories
     where business_id = p_business_id;

    if v_total < 1 then
        perform public.farol_error('categories_required', 'Selecione ao menos uma categoria.');
    end if;

    if v_total > 3 then
        perform public.farol_error('categories_too_many', 'Selecione no máximo três categorias.');
    end if;

    if v_primary <> 1 then
        perform public.farol_error('primary_category_required', 'Escolha exatamente uma categoria principal.');
    end if;
end;
$$;

-- Constraint trigger DEFERRABLE: a checagem roda no commit, então trocar o
-- conjunto de categorias em várias linhas dentro da mesma transação é válido
-- mesmo que o estado intermediário viole a regra. Um negócio removido na
-- mesma transação não é checado.
create or replace function public.business_categories_check()
returns trigger
language plpgsql
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

create constraint trigger business_categories_check_trigger
after insert or update or delete on public.business_categories
deferrable initially deferred
for each row execute function public.business_categories_check();
