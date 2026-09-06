-- Fase 4 — edição de negócio ativo.
--
-- Alteração simples publica na hora; alteração sensível vira proposta e o
-- conteúdo público continua sendo o aprovado até a decisão (EDI-01/EDI-02).
--
-- Matriz de edição do plano Gratuito, decidida em 06/09/2026: o dono de um
-- negócio ativo pode alterar nome, imagem de capa, telefone, categorias,
-- endereço e descrição. Telefone é o único simples da lista; os outros cinco
-- são sensíveis. Campos fora da lista (WhatsApp, e-mail, site, Instagram,
-- horários, faixa de preço, subcategoria, área de atendimento) são definidos
-- no cadastro e depois só o admin altera — isso restringe EDI-01, que previa
-- WhatsApp/e-mail/redes/horário como simples, e a decisão mais recente
-- prevalece.

create or replace function public.owner_simple_fields()
returns text[] language sql immutable as $$ select array['phone']::text[]; $$;

create or replace function public.owner_sensitive_fields()
returns text[] language sql immutable as $$
    select array['name', 'address', 'description', 'cover_image']::text[];
$$;

create table public.business_change_requests (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    requested_by uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
    -- Campos propostos e o valor que eles tinham quando a proposta foi criada.
    -- base_values é o que permite detectar conflito de verdade: se o admin
    -- mudou o nome no meio do caminho, aprovar a proposta cegamente
    -- sobrescreveria a correção dele.
    changes jsonb not null default '{}'::jsonb,
    base_values jsonb not null default '{}'::jsonb,
    category_ids uuid[],
    primary_category_id uuid,
    base_category_ids uuid[],
    -- Caminho da capa proposta dentro de business-photos, sempre em
    -- {business_id}/review/... — a capa aprovada em {business_id}/cover.* fica
    -- intacta até a decisão.
    cover_image_path text,
    decision_reason text,
    decided_at timestamptz,
    decided_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index business_change_requests_business_idx on public.business_change_requests(business_id);

-- Uma proposta aberta por negócio (decisão de 06/09/2026). O índice é a
-- garantia sob concorrência; a mensagem amigável vem da checagem prévia.
create unique index business_change_requests_one_open
    on public.business_change_requests(business_id)
    where status = 'pending';

alter table public.business_change_requests enable row level security;

create policy "business_change_requests_owner_or_admin"
    on public.business_change_requests for select
    using (
        requested_by = auth.uid()
        or public.has_role(auth.uid(), 'admin')
    );

grant select on public.business_change_requests to authenticated;

-- ---------------------------------------------------------------------------

-- Alteração simples: publica direto, mas nunca pode remover o último contato
-- público válido (APR-01).
create or replace function public.update_own_active_business(p_business_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_row public.businesses;
    v_key text;
begin
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_row from public.businesses where id = p_business_id for update;

    if not found or v_row.owner_id is distinct from v_uid then
        perform public.farol_error('forbidden', 'Este negócio não pertence à sua conta.');
    end if;

    if v_row.status <> 'active' then
        perform public.farol_error('status_not_editable', 'Este negócio não está publicado.');
    end if;

    for v_key in select jsonb_object_keys(coalesce(p_changes, '{}'::jsonb)) loop
        if not (v_key = any(public.owner_simple_fields())) then
            perform public.farol_error('field_not_editable', format('O campo "%s" só muda com análise do Farol.', v_key));
        end if;
    end loop;

    v_row := public.apply_business_payload(v_row, p_changes, public.owner_simple_fields());
    -- Só o contato é revalidado: a alteração simples não pode remover o último
    -- contato público válido, mas também não pode cobrar descrição ou endereço
    -- de um cadastro anterior a essas regras.
    perform public.assert_business_minimums(v_row, false, false);

    update public.businesses set phone = v_row.phone where id = p_business_id;
end;
$$;

create or replace function public.request_business_changes(
    p_business_id uuid,
    p_changes jsonb default '{}'::jsonb,
    p_category_ids uuid[] default null,
    p_primary_category_id uuid default null,
    p_cover_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_row public.businesses;
    v_merged public.businesses;
    v_changes jsonb := coalesce(p_changes, '{}'::jsonb);
    v_base jsonb := '{}'::jsonb;
    v_key text;
    v_id uuid;
    v_base_categories uuid[];
begin
    select * into v_row from public.businesses where id = p_business_id for update;

    if not found or v_row.owner_id is distinct from v_uid then
        perform public.farol_error('forbidden', 'Este negócio não pertence à sua conta.');
    end if;

    if v_row.status <> 'active' then
        perform public.farol_error('status_not_editable', 'Propostas de alteração valem para negócio publicado.');
    end if;

    if p_cover_image_path is not null then
        v_changes := v_changes || jsonb_build_object('cover_image', p_cover_image_path);
    end if;

    for v_key in select jsonb_object_keys(v_changes) loop
        if not (v_key = any(public.owner_sensitive_fields())) then
            perform public.farol_error('field_not_editable', format('O campo "%s" não pode ser alterado pelo proprietário.', v_key));
        end if;
    end loop;

    if v_changes = '{}'::jsonb and p_category_ids is null then
        perform public.farol_error('empty_request', 'Nenhuma alteração foi informada.');
    end if;

    if exists (select 1 from public.business_change_requests where business_id = p_business_id and status = 'pending') then
        perform public.farol_error('request_already_open', 'Já existe uma alteração aguardando análise para este negócio.');
    end if;

    -- Snapshot dos campos propostos, para detectar depois se a base mudou.
    for v_key in select jsonb_object_keys(v_changes) loop
        v_base := v_base || jsonb_build_object(
            v_key,
            to_jsonb(v_row) -> (case when v_key = 'cover_image' then 'cover_image' else v_key end)
        );
    end loop;

    -- A proposta precisa resultar num cadastro que continua válido: não dá
    -- para propor descrição vazia ou apagar o último contato.
    v_merged := public.apply_business_payload(v_row, v_changes - 'cover_image', public.owner_sensitive_fields());
    perform public.assert_business_minimums(
        v_merged, v_changes ? 'description', v_changes ? 'address'
    );

    if p_category_ids is not null then
        if array_length(p_category_ids, 1) is null or array_length(p_category_ids, 1) > 3 then
            perform public.farol_error('categories_invalid', 'Selecione de uma a três categorias.');
        end if;
        if array_length(p_category_ids, 1) > 1
           and (p_primary_category_id is null or not (p_primary_category_id = any(p_category_ids))) then
            perform public.farol_error('primary_category_invalid', 'A categoria principal precisa estar entre as escolhidas.');
        end if;
        select array_agg(category_id order by category_id) into v_base_categories
          from public.business_categories where business_id = p_business_id;
    end if;

    insert into public.business_change_requests (
        business_id, requested_by, changes, base_values,
        category_ids, primary_category_id, base_category_ids, cover_image_path
    ) values (
        p_business_id, v_uid, v_changes - 'cover_image', v_base,
        p_category_ids, p_primary_category_id, v_base_categories, p_cover_image_path
    )
    returning id into v_id;

    return v_id;
exception when unique_violation then
    perform public.farol_error('request_already_open', 'Já existe uma alteração aguardando análise para este negócio.');
    return null;
end;
$$;

create or replace function public.cancel_business_change_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_request public.business_change_requests;
begin
    select * into v_request from public.business_change_requests where id = p_request_id for update;

    if not found or v_request.requested_by is distinct from v_uid then
        perform public.farol_error('forbidden', 'Esta solicitação não é sua.');
    end if;

    if v_request.status <> 'pending' then
        perform public.farol_error('invalid_transition', 'Esta solicitação já foi decidida.');
    end if;

    update public.business_change_requests
       set status = 'cancelled', decided_at = now()
     where id = p_request_id;
end;
$$;

-- Aprovar aplica só os campos revisados; recusar preserva a versão pública.
-- p_cover_public_url é obrigatório quando há capa proposta: quem chama copia o
-- arquivo de {business_id}/review/... para a capa pública ANTES de aprovar, e
-- se a cópia falhar nada é aplicado.
create or replace function public.review_business_change_request(
    p_request_id uuid,
    p_action text,
    p_reason text default null,
    p_cover_public_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin uuid := public.require_admin();
    v_request public.business_change_requests;
    v_row public.businesses;
    v_merged public.businesses;
    v_key text;
    v_current_categories uuid[];
begin
    perform set_config('farol.trusted_write', 'on', true);

    select * into v_request from public.business_change_requests where id = p_request_id for update;
    if not found then
        perform public.farol_error('not_found', 'Solicitação não encontrada.');
    end if;

    if v_request.status <> 'pending' then
        perform public.farol_error('invalid_transition', 'Esta solicitação já foi decidida.');
    end if;

    if p_action = 'reject' then
        update public.business_change_requests
           set status = 'rejected', decision_reason = nullif(btrim(p_reason), ''),
               decided_at = now(), decided_by = v_admin
         where id = p_request_id;
        return;
    end if;

    if p_action <> 'approve' then
        perform public.farol_error('invalid_action', 'Ação desconhecida.');
    end if;

    select * into v_row from public.businesses where id = v_request.business_id for update;

    -- Uma proposta não reativa negócio suspenso nem publica rejeitado.
    if v_row.status <> 'active' then
        perform public.farol_error('business_not_active', 'O negócio não está publicado; a alteração não pode ser aplicada.');
    end if;

    -- Conflito: algum campo proposto mudou desde a criação da proposta
    -- (correção do admin, outra aprovação). Não sobrescrever às cegas.
    for v_key in select jsonb_object_keys(v_request.base_values) loop
        if (to_jsonb(v_row) -> v_key) is distinct from (v_request.base_values -> v_key) then
            perform public.farol_error('base_changed', format('O campo "%s" mudou depois que a solicitação foi criada.', v_key));
        end if;
    end loop;

    if v_request.base_category_ids is not null then
        select array_agg(category_id order by category_id) into v_current_categories
          from public.business_categories where business_id = v_request.business_id;
        if v_current_categories is distinct from v_request.base_category_ids then
            perform public.farol_error('base_changed', 'As categorias mudaram depois que a solicitação foi criada.');
        end if;
    end if;

    v_merged := public.apply_business_payload(v_row, v_request.changes, public.owner_sensitive_fields());

    if v_request.cover_image_path is not null then
        if coalesce(btrim(p_cover_public_url), '') = '' then
            perform public.farol_error('cover_url_required', 'A capa proposta precisa ser publicada antes de aprovar a alteração.');
        end if;
        v_merged.cover_image := btrim(p_cover_public_url);
    end if;

    perform public.assert_business_minimums(
        v_merged, v_request.changes ? 'description', v_request.changes ? 'address'
    );

    update public.businesses set
        name = v_merged.name,
        address = v_merged.address,
        description = v_merged.description,
        cover_image = v_merged.cover_image
    where id = v_request.business_id;

    if v_request.category_ids is not null then
        perform public.set_business_categories(
            v_request.business_id, v_request.category_ids, v_request.primary_category_id
        );
    end if;

    update public.business_change_requests
       set status = 'approved', decision_reason = nullif(btrim(p_reason), ''),
           decided_at = now(), decided_by = v_admin
     where id = p_request_id;
end;
$$;
