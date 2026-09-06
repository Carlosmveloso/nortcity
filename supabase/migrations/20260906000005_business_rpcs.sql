-- Operações de negócio como RPCs SECURITY DEFINER.
--
-- Por que RPC e não escrita direta via PostgREST: negócio + categorias vivem
-- em duas tabelas, e o PostgREST não tem transação entre chamadas. O fluxo
-- antigo (insert em businesses → insert em business_categories → update do
-- cover) deixava negócio sem categoria sempre que a segunda chamada falhava,
-- e o "rollback" do admin (delete) nem GRANT tinha. Aqui cada operação é uma
-- transação só, com a autorização checada no servidor.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select auth.uid() is not null and public.has_role(auth.uid(), 'admin');
$$;

create or replace function public.require_auth()
returns uuid
language plpgsql
stable
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        perform public.farol_error('auth_required', 'Entre na sua conta para continuar.');
    end if;
    return v_uid;
end;
$$;

create or replace function public.require_admin()
returns uuid
language plpgsql
stable
as $$
declare
    v_uid uuid := public.require_auth();
begin
    if not public.has_role(v_uid, 'admin') then
        perform public.farol_error('forbidden', 'Ação disponível apenas para administradores.');
    end if;
    return v_uid;
end;
$$;

-- Aplica só os campos permitidos do payload sobre a linha atual. Chave ausente
-- = campo não mexido; chave presente com null = campo limpo. É isso que
-- permite reaproveitar a mesma função para cadastro, edição do dono, edição do
-- admin e aplicação de proposta aprovada, cada um com sua lista de campos.
create or replace function public.apply_business_payload(
    b public.businesses,
    p_payload jsonb,
    p_fields text[]
)
returns public.businesses
language plpgsql
immutable
as $$
declare
    v_key text;
begin
    if p_payload is null then
        return b;
    end if;

    foreach v_key in array p_fields loop
        if p_payload ? v_key then
            case v_key
                when 'name' then b.name := nullif(btrim(p_payload ->> 'name'), '');
                when 'subcategory' then b.subcategory := nullif(btrim(p_payload ->> 'subcategory'), '');
                when 'description' then b.description := nullif(btrim(p_payload ->> 'description'), '');
                when 'address' then b.address := nullif(btrim(p_payload ->> 'address'), '');
                when 'neighborhood' then b.neighborhood := nullif(btrim(p_payload ->> 'neighborhood'), '');
                when 'service_area' then b.service_area := nullif(btrim(p_payload ->> 'service_area'), '');
                when 'lat' then b.lat := (p_payload ->> 'lat')::numeric;
                when 'lng' then b.lng := (p_payload ->> 'lng')::numeric;
                when 'phone' then b.phone := nullif(btrim(p_payload ->> 'phone'), '');
                when 'whatsapp' then b.whatsapp := nullif(btrim(p_payload ->> 'whatsapp'), '');
                when 'email' then b.email := nullif(btrim(p_payload ->> 'email'), '');
                when 'website' then b.website := nullif(btrim(p_payload ->> 'website'), '');
                when 'instagram' then b.instagram := nullif(btrim(p_payload ->> 'instagram'), '');
                when 'facebook' then b.facebook := nullif(btrim(p_payload ->> 'facebook'), '');
                when 'cover_image' then b.cover_image := nullif(btrim(p_payload ->> 'cover_image'), '');
                when 'hours' then b.hours := p_payload -> 'hours';
                when 'price_range' then b.price_range := nullif(btrim(p_payload ->> 'price_range'), '');
                else null;
            end case;
        end if;
    end loop;

    return b;
end;
$$;

-- Campos que o formulário de cadastro e o admin podem preencher. status,
-- owner_id, slug e moderação ficam de fora de propósito.
create or replace function public.business_editable_fields()
returns text[]
language sql
immutable
as $$
    select array[
        'name', 'subcategory', 'description', 'address', 'neighborhood', 'service_area',
        'lat', 'lng', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook',
        'hours', 'price_range'
    ]::text[];
$$;

-- Troca o conjunto de categorias de uma vez. A constraint trigger é deferida,
-- então o estado intermediário (zero categorias entre o delete e o insert) não
-- derruba a operação, mas um conjunto inválido derruba a transação inteira —
-- não existe "meio caminho" que deixe o negócio sem primária.
create or replace function public.set_business_categories(
    p_business_id uuid,
    p_category_ids uuid[],
    p_primary_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ids uuid[];
    v_primary uuid := p_primary_category_id;
    v_known int;
begin
    select array(select distinct unnest(coalesce(p_category_ids, '{}'::uuid[]))) into v_ids;

    if array_length(v_ids, 1) is null then
        perform public.farol_error('categories_required', 'Selecione ao menos uma categoria.');
    end if;

    if array_length(v_ids, 1) > 3 then
        perform public.farol_error('categories_too_many', 'Selecione no máximo três categorias.');
    end if;

    select count(*) into v_known from public.categories where id = any(v_ids);
    if v_known <> array_length(v_ids, 1) then
        perform public.farol_error('category_not_found', 'Uma das categorias escolhidas não existe mais.');
    end if;

    -- Categoria única é automaticamente a principal (CAT-03); com mais de uma
    -- a escolha tem de ser explícita e pertencer ao conjunto — nunca "a
    -- primeira que foi clicada".
    if array_length(v_ids, 1) = 1 then
        v_primary := v_ids[1];
    elsif v_primary is null then
        perform public.farol_error('primary_category_required', 'Escolha qual categoria é a principal.');
    elsif not (v_primary = any(v_ids)) then
        perform public.farol_error('primary_category_invalid', 'A categoria principal precisa estar entre as escolhidas.');
    end if;

    delete from public.business_categories where business_id = p_business_id;

    insert into public.business_categories (business_id, category_id, is_primary)
    select p_business_id, id, id = v_primary from unnest(v_ids) as id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Duplicidade (DUP-01/DUP-02)
-- ---------------------------------------------------------------------------

-- Combina nome, endereço, telefone/WhatsApp e Instagram. Nome sozinho pontua
-- 3 e o limite é 4: homônimo legítimo ("Bar do Zé" em bairros diferentes) não
-- vira suspeita sozinho, mas nome igual + mesmo telefone vira. O resultado só
-- sinaliza para revisão humana — nada é bloqueado nem fundido.
create or replace function public.find_duplicate_candidates(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    with target as (
        select * from public.businesses where id = p_business_id
    ),
    scored as (
        select
            b.id,
            b.slug,
            b.name,
            b.status,
            (case when public.normalize_search(b.name) = public.normalize_search(t.name) then 3 else 0 end)
          + (case when coalesce(btrim(b.address), '') <> ''
                   and public.normalize_search(b.address) = public.normalize_search(coalesce(t.address, '')) then 2 else 0 end)
          + (case when length(regexp_replace(coalesce(b.phone, ''), '\D', '', 'g')) >= 10
                   and regexp_replace(coalesce(b.phone, ''), '\D', '', 'g') in (
                        regexp_replace(coalesce(t.phone, ''), '\D', '', 'g'),
                        regexp_replace(coalesce(t.whatsapp, ''), '\D', '', 'g')
                   ) then 3 else 0 end)
          + (case when length(regexp_replace(coalesce(b.whatsapp, ''), '\D', '', 'g')) >= 10
                   and regexp_replace(coalesce(b.whatsapp, ''), '\D', '', 'g') in (
                        regexp_replace(coalesce(t.phone, ''), '\D', '', 'g'),
                        regexp_replace(coalesce(t.whatsapp, ''), '\D', '', 'g')
                   ) then 3 else 0 end)
          + (case when coalesce(btrim(b.instagram), '') <> ''
                   and public.normalize_search(b.instagram) = public.normalize_search(coalesce(t.instagram, '')) then 3 else 0 end)
          + (case when coalesce(btrim(b.website), '') <> ''
                   and public.normalize_search(b.website) = public.normalize_search(coalesce(t.website, '')) then 2 else 0 end)
            as score
        from public.businesses b, target t
        where b.id <> t.id
          and b.status <> 'rejected'
    )
    select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'name', name, 'status', status, 'score', score)
                  order by score desc, name),
        '[]'::jsonb
    )
    from scored
    where score >= 4;
$$;

-- ---------------------------------------------------------------------------
-- Cadastro e edição pelo dono
-- ---------------------------------------------------------------------------

create or replace function public.submit_business(
    p_payload jsonb,
    p_category_ids uuid[],
    p_primary_category_id uuid default null,
    p_private_address text default null,
    p_private_lat numeric default null,
    p_private_lng numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_row public.businesses;
    v_id uuid;
    v_attempt int := 0;
begin
    perform set_config('farol.trusted_write', 'on', true);

    -- Checagem amigável; a garantia real contra duas requisições simultâneas é
    -- o índice único businesses_one_per_owner, tratado logo abaixo.
    if exists (select 1 from public.businesses where owner_id = v_uid) then
        perform public.farol_error('business_limit_reached', 'Sua conta já possui um negócio cadastrado.');
    end if;

    v_row.owner_id := v_uid;
    v_row.status := 'pending';
    v_row := public.apply_business_payload(v_row, p_payload, public.business_editable_fields());

    perform public.assert_business_minimums(v_row);

    loop
        v_attempt := v_attempt + 1;
        begin
            insert into public.businesses (
                owner_id, slug, name, subcategory, description, address, neighborhood, service_area,
                lat, lng, phone, whatsapp, email, website, instagram, facebook, hours, price_range,
                status, submitted_at
            ) values (
                v_uid, public.generate_business_slug(v_row.name), v_row.name, v_row.subcategory,
                v_row.description, v_row.address, v_row.neighborhood, v_row.service_area,
                v_row.lat, v_row.lng, v_row.phone, v_row.whatsapp, v_row.email, v_row.website,
                v_row.instagram, v_row.facebook, v_row.hours, v_row.price_range,
                'pending', now()
            )
            returning id into v_id;
            exit;
        exception when unique_violation then
            -- Ou duas contas cadastraram o mesmo nome ao mesmo tempo (slug), ou
            -- a mesma conta enviou dois cadastros simultâneos (owner_id).
            if exists (select 1 from public.businesses where owner_id = v_uid) then
                perform public.farol_error('business_limit_reached', 'Sua conta já possui um negócio cadastrado.');
            end if;
            if v_attempt >= 5 then
                raise;
            end if;
        end;
    end loop;

    perform public.set_business_categories(v_id, p_category_ids, p_primary_category_id);

    if coalesce(btrim(p_private_address), '') <> '' or p_private_lat is not null then
        insert into public.business_private_locations (business_id, address, lat, lng)
        values (v_id, nullif(btrim(p_private_address), ''), p_private_lat, p_private_lng);
    end if;

    update public.businesses
       set duplicate_candidates = public.find_duplicate_candidates(v_id)
     where id = v_id;

    return v_id;
end;
$$;

-- Correção antes da análise (pending) e correção de rejeitado. Não muda
-- status: reenviar é operação própria (resubmit_business).
create or replace function public.update_own_business(
    p_business_id uuid,
    p_payload jsonb,
    p_category_ids uuid[] default null,
    p_primary_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_row public.businesses;
begin
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_row from public.businesses where id = p_business_id for update;

    if not found or v_row.owner_id is distinct from v_uid then
        perform public.farol_error('forbidden', 'Este negócio não pertence à sua conta.');
    end if;

    if v_row.status not in ('pending', 'rejected') then
        perform public.farol_error('status_not_editable', 'Negócio publicado ou suspenso não é editado por aqui.');
    end if;

    v_row := public.apply_business_payload(v_row, p_payload, public.business_editable_fields());
    perform public.assert_business_minimums(v_row);

    update public.businesses set
        name = v_row.name, subcategory = v_row.subcategory, description = v_row.description,
        address = v_row.address, neighborhood = v_row.neighborhood, service_area = v_row.service_area,
        lat = v_row.lat, lng = v_row.lng, phone = v_row.phone, whatsapp = v_row.whatsapp,
        email = v_row.email, website = v_row.website, instagram = v_row.instagram,
        facebook = v_row.facebook, hours = v_row.hours, price_range = v_row.price_range,
        cover_image = v_row.cover_image
    where id = p_business_id;

    if p_category_ids is not null then
        perform public.set_business_categories(p_business_id, p_category_ids, p_primary_category_id);
    end if;

    update public.businesses
       set duplicate_candidates = public.find_duplicate_candidates(p_business_id),
           duplicate_reviewed_at = null
     where id = p_business_id;
end;
$$;

create or replace function public.resubmit_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_row public.businesses;
begin
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_row from public.businesses where id = p_business_id for update;

    if not found or v_row.owner_id is distinct from v_uid then
        perform public.farol_error('forbidden', 'Este negócio não pertence à sua conta.');
    end if;

    if v_row.status <> 'rejected' then
        perform public.farol_error('invalid_transition', 'Só um cadastro rejeitado pode ser reenviado para análise.');
    end if;

    perform public.assert_business_minimums(v_row);
    perform public.assert_business_categories(p_business_id);

    update public.businesses
       set status = 'pending',
           submitted_at = now(),
           moderation_reason = null,
           moderation_note = null,
           moderated_at = null,
           moderated_by = null
     where id = p_business_id;
end;
$$;

-- Capa: durante pending/rejected o dono troca direto; com o negócio ativo a
-- capa é campo sensível e passa por proposta (migration 0008).
create or replace function public.set_business_cover_image(p_business_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_row public.businesses;
begin
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_row from public.businesses where id = p_business_id for update;

    if not found then
        perform public.farol_error('not_found', 'Negócio não encontrado.');
    end if;

    if not public.is_admin() then
        if v_row.owner_id is distinct from v_uid then
            perform public.farol_error('forbidden', 'Este negócio não pertence à sua conta.');
        end if;
        if v_row.status not in ('pending', 'rejected') then
            perform public.farol_error('status_not_editable', 'A troca de capa de um negócio publicado passa por análise.');
        end if;
    end if;

    update public.businesses set cover_image = nullif(btrim(p_url), '') where id = p_business_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderação (admin)
-- ---------------------------------------------------------------------------

create or replace function public.moderate_business(
    p_business_id uuid,
    p_action text,
    p_reason business_moderation_reason default null,
    p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin uuid := public.require_admin();
    v_row public.businesses;
    v_next business_status;
    v_is_approval boolean := p_action = 'approve';
begin
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_row from public.businesses where id = p_business_id for update;
    if not found then
        perform public.farol_error('not_found', 'Negócio não encontrado.');
    end if;

    case p_action
        when 'approve' then
            if v_row.status <> 'pending' then
                perform public.farol_error('invalid_transition', 'Só um cadastro pendente pode ser aprovado.');
            end if;
            v_next := 'active';
        when 'reject' then
            if v_row.status <> 'pending' then
                perform public.farol_error('invalid_transition', 'Só um cadastro pendente pode ser rejeitado.');
            end if;
            v_next := 'rejected';
        when 'suspend' then
            if v_row.status <> 'active' then
                perform public.farol_error('invalid_transition', 'Só um negócio publicado pode ser suspenso.');
            end if;
            v_next := 'suspended';
        when 'reactivate' then
            if v_row.status <> 'suspended' then
                perform public.farol_error('invalid_transition', 'Só um negócio suspenso pode ser reativado.');
            end if;
            v_next := 'active';
        else
            perform public.farol_error('invalid_action', 'Ação de moderação desconhecida.');
    end case;

    -- Aprovar dispensa justificativa; rejeitar e suspender exigem (MOD-02).
    if p_action in ('reject', 'suspend') and p_reason is null then
        perform public.farol_error('reason_required', 'Informe o motivo da decisão.');
    end if;

    -- Revalida no momento da decisão: o cadastro pode ter sido editado pelo
    -- dono depois de entrar na fila.
    -- Aprovar um cadastro novo exige o mínimo completo. Reativar um negócio
    -- que já esteve publicado revalida nome, contato e categorias, mas não
    -- reabre o contrato de descrição e localização: o registro pode ser
    -- anterior a essas regras, e a reativação não é o momento de exigir
    -- retrofit de conteúdo.
    if v_next = 'active' then
        perform public.assert_business_minimums(v_row, v_is_approval, v_is_approval);
        perform public.assert_business_categories(p_business_id);
    end if;

    update public.businesses
       set status = v_next,
           moderation_reason = case when p_action in ('reject', 'suspend') then p_reason else null end,
           moderation_note = case when p_action in ('reject', 'suspend') then nullif(btrim(p_note), '') else null end,
           moderated_at = now(),
           moderated_by = v_admin,
           duplicate_reviewed_at = case when p_action = 'approve' then now() else duplicate_reviewed_at end
     where id = p_business_id;
end;
$$;

create or replace function public.admin_create_business(
    p_payload jsonb,
    p_category_ids uuid[],
    p_primary_category_id uuid default null,
    p_status business_status default 'pending'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin uuid := public.require_admin();
    v_row public.businesses;
    v_id uuid;
    v_attempt int := 0;
begin
    perform set_config('farol.trusted_write', 'on', true);

    if p_status not in ('pending', 'active') then
        perform public.farol_error('invalid_status', 'Negócio criado pelo admin entra como pendente ou ativo.');
    end if;

    v_row := public.apply_business_payload(v_row, p_payload, public.business_editable_fields());

    -- Publicar direto só se o cadastro já atende aos critérios de aprovação.
    if p_status = 'active' then
        perform public.assert_business_minimums(v_row);
    end if;

    loop
        v_attempt := v_attempt + 1;
        begin
            -- owner_id fica nulo: negócio cadastrado pelo admin não pertence à
            -- conta do admin (PRO-02). O vínculo com o responsável real, se
            -- houver, é feito depois por admin_link_business_owner.
            insert into public.businesses (
                owner_id, slug, name, subcategory, description, address, neighborhood, service_area,
                lat, lng, phone, whatsapp, email, website, instagram, facebook, hours, price_range,
                status, submitted_at, moderated_at, moderated_by
            ) values (
                null, public.generate_business_slug(v_row.name), v_row.name, v_row.subcategory,
                v_row.description, v_row.address, v_row.neighborhood, v_row.service_area,
                v_row.lat, v_row.lng, v_row.phone, v_row.whatsapp, v_row.email, v_row.website,
                v_row.instagram, v_row.facebook, v_row.hours, v_row.price_range,
                p_status, now(),
                case when p_status = 'active' then now() end,
                case when p_status = 'active' then v_admin end
            )
            returning id into v_id;
            exit;
        exception when unique_violation then
            if v_attempt >= 5 then raise; end if;
        end;
    end loop;

    perform public.set_business_categories(v_id, p_category_ids, p_primary_category_id);

    update public.businesses
       set duplicate_candidates = public.find_duplicate_candidates(v_id)
     where id = v_id;

    return v_id;
end;
$$;

create or replace function public.admin_update_business(
    p_business_id uuid,
    p_payload jsonb,
    p_category_ids uuid[] default null,
    p_primary_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.businesses;
    v_old public.businesses;
begin
    perform public.require_admin();
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_old from public.businesses where id = p_business_id for update;
    if not found then
        perform public.farol_error('not_found', 'Negócio não encontrado.');
    end if;

    v_row := public.apply_business_payload(
        v_old, p_payload, public.business_editable_fields() || array['cover_image']
    );

    -- Correção de formatação/categoria pelo admin antes de aprovar é
    -- permitida em qualquer status, mas negócio público continua tendo de
    -- atender ao mínimo. A descrição só é validada quando muda, para não
    -- transformar a correção de um telefone de cadastro legado em reescrita
    -- obrigatória do texto.
    if v_row.status = 'active' then
        perform public.assert_business_minimums(
            v_row,
            v_row.description is distinct from v_old.description,
            v_row.address is distinct from v_old.address
                or v_row.neighborhood is distinct from v_old.neighborhood
                or v_row.service_area is distinct from v_old.service_area
        );
    end if;

    update public.businesses set
        name = v_row.name, subcategory = v_row.subcategory, description = v_row.description,
        address = v_row.address, neighborhood = v_row.neighborhood, service_area = v_row.service_area,
        lat = v_row.lat, lng = v_row.lng, phone = v_row.phone, whatsapp = v_row.whatsapp,
        email = v_row.email, website = v_row.website, instagram = v_row.instagram,
        facebook = v_row.facebook, hours = v_row.hours, price_range = v_row.price_range,
        cover_image = v_row.cover_image
    where id = p_business_id;

    if p_category_ids is not null then
        perform public.set_business_categories(p_business_id, p_category_ids, p_primary_category_id);
    end if;
end;
$$;

create or replace function public.admin_delete_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.require_admin();
    perform set_config('farol.trusted_write', 'on', true);
    delete from public.businesses where id = p_business_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vínculo manual de proprietário (PRO-03 / DUP-03)
-- ---------------------------------------------------------------------------

create or replace function public.admin_link_business_owner(p_business_id uuid, p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.businesses;
begin
    perform public.require_admin();
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_row from public.businesses where id = p_business_id for update;
    if not found then
        perform public.farol_error('not_found', 'Negócio não encontrado.');
    end if;

    -- Vincular nunca substitui proprietário existente: o fluxo aprovado é
    -- contato externo + validação, não transferência entre donos (PRO-06).
    if v_row.owner_id is not null then
        perform public.farol_error('already_owned', 'Este negócio já tem proprietário vinculado.');
    end if;

    if not exists (select 1 from public.profiles where id = p_owner_id) then
        perform public.farol_error('profile_not_found', 'Conta não encontrada.');
    end if;

    if exists (select 1 from public.businesses where owner_id = p_owner_id) then
        perform public.farol_error('owner_has_business', 'Esta conta já é proprietária de outro negócio.');
    end if;

    -- Concorrência: o índice parcial businesses_one_per_owner impede que dois
    -- vínculos simultâneos passem, mesmo que ambos vejam a conta livre.
    update public.businesses set owner_id = p_owner_id where id = p_business_id;
exception when unique_violation then
    perform public.farol_error('owner_has_business', 'Esta conta já é proprietária de outro negócio.');
end;
$$;

create or replace function public.admin_unlink_business_owner(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.require_admin();
    perform set_config('farol.trusted_write', 'on', true);
    update public.businesses set owner_id = null where id = p_business_id;
end;
$$;

-- Conta cadastrou duplicata de um registro sem dono: apaga a duplicata e
-- vincula a conta ao original, numa transação só, sem passar por um estado em
-- que a conta tem dois negócios ou nenhum (DUP-03/PRO-05).
create or replace function public.admin_resolve_duplicate(p_original_id uuid, p_duplicate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_original public.businesses;
    v_duplicate public.businesses;
begin
    perform public.require_admin();
    perform set_config('farol.trusted_write', 'on', true);

    if p_original_id = p_duplicate_id then
        perform public.farol_error('invalid_action', 'Original e duplicata precisam ser registros diferentes.');
    end if;

    select * into v_original from public.businesses where id = p_original_id for update;
    if not found then
        perform public.farol_error('not_found', 'Negócio original não encontrado.');
    end if;

    select * into v_duplicate from public.businesses where id = p_duplicate_id for update;
    if not found then
        perform public.farol_error('not_found', 'Duplicata não encontrada.');
    end if;

    if v_original.owner_id is not null then
        perform public.farol_error('already_owned', 'O registro original já tem proprietário: rejeite a duplicata em vez de vincular.');
    end if;

    if v_duplicate.owner_id is null then
        perform public.farol_error('duplicate_without_owner', 'A duplicata não tem proprietário para transferir.');
    end if;

    -- Nunca apagar um registro já público por semelhança.
    if v_duplicate.status = 'active' then
        perform public.farol_error('duplicate_is_active', 'Suspenda a duplicata publicada antes de resolvê-la.');
    end if;

    delete from public.businesses where id = p_duplicate_id;
    update public.businesses set owner_id = v_duplicate.owner_id where id = p_original_id;
end;
$$;

create or replace function public.admin_mark_duplicate_reviewed(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.require_admin();
    perform set_config('farol.trusted_write', 'on', true);
    update public.businesses set duplicate_reviewed_at = now() where id = p_business_id;
end;
$$;
