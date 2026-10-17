-- Operações do módulo de ofertas. Toda transição de status passa por aqui:
-- `authenticated` não tem GRANT de escrita nas tabelas de ofertas, então não
-- existe `UPDATE offers SET status = 'active'` vindo do navegador.
--
-- Erros seguem farol_error: message = código estável, detail = frase em PT-BR.

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

-- Sinal de escrita autorizada lido pelas triggers da migration anterior.
-- Toda operação oficial liga no início e desliga antes de retornar; em erro,
-- o rollback da transação (ou do subbloco) desfaz o set_config junto.
create or replace function public.begin_offer_write()
returns void
language plpgsql
as $$
begin
    perform set_config('farol.offer_write', 'on', true);
end;
$$;

create or replace function public.end_offer_write()
returns void
language plpgsql
as $$
begin
    perform set_config('farol.offer_write', 'off', true);
end;
$$;

create or replace function public.offer_editable_fields()
returns text[]
language sql
immutable
as $$
    select array[
        'title', 'description', 'benefit_type', 'benefit_value', 'starts_at', 'ends_at',
        'days_of_week', 'time_windows', 'minimum_purchase', 'eligible_items', 'stackable',
        'conditions', 'total_limit', 'per_user_limit', 'coupon_validity_minutes'
    ]::text[];
$$;

-- Mesma semântica de apply_business_payload: chave ausente não mexe, chave
-- com null limpa. Campo fora da lista (status, taxa, aceite…) é recusado em
-- vez de ignorado, para o cliente não achar que gravou.
create or replace function public.apply_offer_payload(v public.offer_versions, p_payload jsonb)
returns public.offer_versions
language plpgsql
security definer
set search_path = public
as $$
declare
    v_key text;
begin
    if p_payload is null then
        return v;
    end if;
    if jsonb_typeof(p_payload) <> 'object' then
        perform public.farol_error('invalid_payload', 'Os dados da oferta precisam ser um objeto.');
    end if;

    for v_key in select jsonb_object_keys(p_payload) loop
        if not (v_key = any(public.offer_editable_fields())) then
            perform public.farol_error('field_not_editable', format('O campo %s não pode ser alterado por aqui.', v_key));
        end if;

        case v_key
            when 'title' then v.title := nullif(btrim(p_payload ->> 'title'), '');
            when 'description' then v.description := nullif(btrim(p_payload ->> 'description'), '');
            when 'benefit_type' then v.benefit_type := (p_payload ->> 'benefit_type')::offer_benefit_type;
            when 'benefit_value' then v.benefit_value := (p_payload ->> 'benefit_value')::numeric;
            when 'starts_at' then v.starts_at := (p_payload ->> 'starts_at')::timestamptz;
            when 'ends_at' then v.ends_at := (p_payload ->> 'ends_at')::timestamptz;
            when 'days_of_week' then
                v.days_of_week := case
                    when jsonb_typeof(p_payload -> 'days_of_week') = 'array'
                        then array(select jsonb_array_elements_text(p_payload -> 'days_of_week')::smallint)
                    else '{1,2,3,4,5,6,7}'::smallint[]
                end;
            when 'time_windows' then v.time_windows := coalesce(nullif(p_payload -> 'time_windows', 'null'::jsonb), '[]'::jsonb);
            when 'minimum_purchase' then v.minimum_purchase := (p_payload ->> 'minimum_purchase')::numeric;
            when 'eligible_items' then v.eligible_items := nullif(btrim(p_payload ->> 'eligible_items'), '');
            when 'stackable' then v.stackable := coalesce((p_payload ->> 'stackable')::boolean, false);
            when 'conditions' then v.conditions := nullif(btrim(p_payload ->> 'conditions'), '');
            when 'total_limit' then v.total_limit := (p_payload ->> 'total_limit')::int;
            when 'per_user_limit' then v.per_user_limit := coalesce((p_payload ->> 'per_user_limit')::int, 1);
            when 'coupon_validity_minutes' then v.coupon_validity_minutes := (p_payload ->> 'coupon_validity_minutes')::int;
        end case;
    end loop;

    return v;
end;
$$;

-- Grava o conteúdo editável de um rascunho. As constraints da tabela fazem a
-- validação de forma (período, limites, valor, horários).
create or replace function public.save_offer_version_content(v public.offer_versions)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.offer_versions
       set title = v.title,
           description = v.description,
           benefit_type = v.benefit_type,
           benefit_value = v.benefit_value,
           starts_at = v.starts_at,
           ends_at = v.ends_at,
           days_of_week = v.days_of_week,
           time_windows = v.time_windows,
           minimum_purchase = v.minimum_purchase,
           eligible_items = v.eligible_items,
           stackable = v.stackable,
           conditions = v.conditions,
           total_limit = v.total_limit,
           per_user_limit = v.per_user_limit,
           coupon_validity_minutes = v.coupon_validity_minutes
     where id = v.id;
end;
$$;

create or replace function public.latest_offer_version(p_offer_id uuid)
returns public.offer_versions
language sql
stable
security definer
set search_path = public
as $$
    select * from public.offer_versions
     where offer_id = p_offer_id
     order by version_number desc
     limit 1;
$$;

-- Nova versão em rascunho copiando o conteúdo de outra. O aceite financeiro
-- não é copiado: cada versão enviada carrega o próprio aceite.
create or replace function public.fork_offer_version(p_source public.offer_versions)
returns public.offer_versions
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new public.offer_versions;
begin
    insert into public.offer_versions (
        offer_id, version_number, title, description, benefit_type, benefit_value,
        starts_at, ends_at, days_of_week, time_windows, minimum_purchase, eligible_items,
        stackable, conditions, total_limit, per_user_limit, coupon_validity_minutes
    )
    select
        p_source.offer_id,
        (select max(version_number) + 1 from public.offer_versions where offer_id = p_source.offer_id),
        p_source.title, p_source.description, p_source.benefit_type, p_source.benefit_value,
        p_source.starts_at, p_source.ends_at, p_source.days_of_week, p_source.time_windows,
        p_source.minimum_purchase, p_source.eligible_items, p_source.stackable, p_source.conditions,
        p_source.total_limit, p_source.per_user_limit, p_source.coupon_validity_minutes
    returning * into v_new;

    return v_new;
end;
$$;

create or replace function public.lock_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers;
begin
    select * into v_offer from public.offers where id = p_offer_id for update;
    if not found then
        perform public.farol_error('not_found', 'Oferta não encontrada.');
    end if;
    return v_offer;
end;
$$;

-- Trava a oferta e confirma que ela é do negócio da conta. Oferta alheia
-- responde como inexistente para não revelar o que não se pode ver.
create or replace function public.lock_owned_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_offer public.offers;
begin
    select o.* into v_offer
      from public.offers o
      join public.businesses b on b.id = o.business_id
     where o.id = p_offer_id and b.owner_id = v_uid
       for update of o;
    if not found then
        perform public.farol_error('not_found', 'Oferta não encontrada.');
    end if;
    return v_offer;
end;
$$;

create or replace function public.log_offer_review(
    p_offer_id uuid,
    p_version_id uuid,
    p_action offer_review_action,
    p_message text default null
)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.offer_reviews (offer_id, offer_version_id, actor_id, action, message)
    values (p_offer_id, p_version_id, auth.uid(), p_action, nullif(btrim(p_message), ''));
$$;

create or replace function public.assert_business_active(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.businesses where id = p_business_id and status = 'active') then
        perform public.farol_error('business_not_active', 'O negócio precisa estar publicado para ter ofertas em análise ou no ar.');
    end if;
end;
$$;

-- Dados obrigatórios para enviar ou aprovar uma versão.
create or replace function public.assert_offer_version_complete(v public.offer_versions)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if v.title is null or v.description is null or v.benefit_type is null then
        perform public.farol_error('offer_incomplete', 'Informe título, descrição e tipo de benefício.');
    end if;
    if v.benefit_type in ('percentage_discount', 'fixed_discount') and v.benefit_value is null then
        perform public.farol_error('benefit_value_required', 'Informe o valor do desconto.');
    end if;
    if v.starts_at is null or v.ends_at is null then
        perform public.farol_error('offer_period_required', 'Informe o início e o fim da oferta.');
    end if;
    if v.ends_at <= now() then
        perform public.farol_error('offer_period_ended', 'O período da oferta já terminou.');
    end if;
    if v.coupon_validity_minutes is null then
        perform public.farol_error('coupon_validity_required', 'Informe o prazo de uso do cupom após a geração.');
    end if;
end;
$$;

-- Trava o negócio (serializa ativações concorrentes e troca de plano) e
-- confere se cabe mais uma oferta ativa no plano atual.
create or replace function public.assert_offer_plan_capacity(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit int;
    v_active int;
begin
    perform 1 from public.businesses where id = p_business_id for update;

    select active_offer_limit into v_limit
      from public.plans where id = public.business_plan_id(p_business_id);
    select count(*) into v_active
      from public.offers where business_id = p_business_id and status = 'active';

    if v_active >= v_limit then
        perform public.farol_error('plan_offer_limit_reached', 'O plano do negócio já atingiu o limite de ofertas ativas.');
    end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plano do negócio
-- ---------------------------------------------------------------------------

-- Enquanto não existir assinatura, só o admin troca o plano. Rebaixar abaixo
-- do número de ofertas ativas é recusado: o admin decide antes quais ofertas
-- suspender ou encerrar, em vez de o banco escolher sozinho.
create or replace function public.admin_set_business_plan(
    p_business_id uuid,
    p_plan_id text,
    p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin uuid := public.require_admin();
    v_limit int;
    v_active int;
begin
    perform 1 from public.businesses where id = p_business_id for update;
    if not found then
        perform public.farol_error('not_found', 'Negócio não encontrado.');
    end if;

    select active_offer_limit into v_limit from public.plans where id = p_plan_id;
    if not found then
        perform public.farol_error('plan_not_found', 'Plano desconhecido.');
    end if;

    if public.business_plan_id(p_business_id) = p_plan_id then
        perform public.farol_error('plan_unchanged', 'O negócio já está neste plano.');
    end if;

    select count(*) into v_active from public.offers where business_id = p_business_id and status = 'active';
    if v_active > v_limit then
        perform public.farol_error('plan_offer_limit_exceeded', 'Suspenda ou encerre ofertas ativas antes de mudar para um plano com limite menor.');
    end if;

    insert into public.business_plan_assignments (business_id, plan_id, assigned_by, note)
    values (p_business_id, p_plan_id, v_admin, nullif(btrim(p_note), ''));
end;
$$;

-- O que o proprietário precisa ver antes do aceite: plano, limite, ofertas
-- ativas e taxa vigente (null no Gratuito).
create or replace function public.get_business_offer_terms(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_plan public.plans;
    v_fee public.plan_coupon_fees;
begin
    perform public.require_auth();
    if not (public.owns_offer_business(p_business_id) or public.is_admin()) then
        perform public.farol_error('not_found', 'Negócio não encontrado.');
    end if;

    select * into v_plan from public.plans where id = public.business_plan_id(p_business_id);
    v_fee := public.current_plan_coupon_fee(v_plan.id);

    return jsonb_build_object(
        'plan_id', v_plan.id,
        'plan_name', v_plan.name,
        'active_offer_limit', v_plan.active_offer_limit,
        'active_offers', (select count(*) from public.offers where business_id = p_business_id and status = 'active'),
        'fee_amount', v_fee.amount,
        'fee_rule_id', v_fee.id
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Proprietário
-- ---------------------------------------------------------------------------

create or replace function public.create_offer(p_business_id uuid, p_payload jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_offer_id uuid;
    v_version public.offer_versions;
begin
    perform public.begin_offer_write();
    if not exists (select 1 from public.businesses where id = p_business_id and owner_id = v_uid) then
        perform public.farol_error('forbidden', 'Só o proprietário do negócio pode criar ofertas para ele.');
    end if;

    insert into public.offers (business_id, created_by)
    values (p_business_id, v_uid)
    returning id into v_offer_id;

    insert into public.offer_versions (offer_id, version_number)
    values (v_offer_id, 1)
    returning * into v_version;

    perform public.save_offer_version_content(public.apply_offer_payload(v_version, p_payload));
    perform public.end_offer_write();
    return v_offer_id;
end;
$$;

-- Edita o rascunho da oferta. Se a última versão voltou com pedido de ajustes,
-- cria a próxima a partir dela — a versão analisada fica como estava.
create or replace function public.update_offer_draft(p_offer_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers := public.lock_owned_offer(p_offer_id);
    v_version public.offer_versions := public.latest_offer_version(p_offer_id);
begin
    perform public.begin_offer_write();
    if v_offer.status not in ('draft', 'changes_requested', 'active') then
        perform public.farol_error('offer_not_editable', 'A oferta não pode ser editada neste status.');
    end if;

    if v_version.review_status = 'changes_requested' then
        v_version := public.fork_offer_version(v_version);
    elsif v_version.review_status <> 'draft' then
        perform public.farol_error('offer_not_editable', 'Não há rascunho aberto para esta oferta.');
    end if;

    perform public.save_offer_version_content(public.apply_offer_payload(v_version, p_payload));
    perform public.end_offer_write();
    return v_version.id;
end;
$$;

-- Revisão de oferta ativa: nova versão em rascunho a partir da publicada. A
-- publicada continua no ar até a revisão ser aprovada e publicada.
create or replace function public.create_offer_revision(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers := public.lock_owned_offer(p_offer_id);
    v_latest public.offer_versions := public.latest_offer_version(p_offer_id);
    v_published public.offer_versions;
    v_revision public.offer_versions;
begin
    perform public.begin_offer_write();
    if v_offer.status <> 'active' then
        perform public.farol_error('offer_not_editable', 'Só uma oferta ativa recebe revisão.');
    end if;
    if v_latest.review_status not in ('approved', 'rejected') then
        perform public.farol_error('revision_already_open', 'Já existe uma revisão em andamento para esta oferta.');
    end if;

    select * into v_published from public.offer_versions where id = v_offer.published_version_id;
    v_revision := public.fork_offer_version(v_published);
    perform public.end_offer_write();
    return v_revision.id;
end;
$$;

-- Aceite das condições financeiras. A taxa vem da regra vigente do plano; o
-- cliente só confirma o valor que mostrou, e se ele mudou nesse meio-tempo o
-- aceite é recusado em vez de gravar um valor que a pessoa não viu.
create or replace function public.accept_offer_financial_terms(p_offer_id uuid, p_expected_fee numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := public.require_auth();
    v_offer public.offers := public.lock_owned_offer(p_offer_id);
    v_version public.offer_versions := public.latest_offer_version(p_offer_id);
    v_fee public.plan_coupon_fees;
begin
    perform public.begin_offer_write();
    if v_version.review_status <> 'draft' then
        perform public.farol_error('offer_not_editable', 'Não há rascunho aberto para esta oferta.');
    end if;

    v_fee := public.current_plan_coupon_fee(public.business_plan_id(v_offer.business_id));
    if v_fee.id is null then
        perform public.farol_error('plan_fee_unavailable', 'O plano atual do negócio não permite ofertas.');
    end if;
    if p_expected_fee is distinct from v_fee.amount then
        perform public.farol_error('fee_changed', 'A taxa vigente mudou. Revise o novo valor antes de aceitar.');
    end if;

    update public.offer_versions
       set fee_amount = v_fee.amount,
           fee_rule_id = v_fee.id,
           financial_accepted_by = v_uid,
           financial_accepted_at = now()
     where id = v_version.id;
    perform public.end_offer_write();
end;
$$;

create or replace function public.submit_offer_for_review(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers := public.lock_owned_offer(p_offer_id);
    v_version public.offer_versions := public.latest_offer_version(p_offer_id);
    v_previous_status text;
    v_fee public.plan_coupon_fees;
begin
    perform public.begin_offer_write();
    if v_offer.status not in ('draft', 'changes_requested', 'active') or v_version.review_status <> 'draft' then
        perform public.farol_error('invalid_transition', 'Não há rascunho desta oferta para enviar.');
    end if;

    perform public.assert_business_active(v_offer.business_id);
    perform public.assert_offer_version_complete(v_version);

    if v_version.financial_accepted_at is null then
        perform public.farol_error('financial_terms_required', 'Aceite as condições financeiras antes de enviar.');
    end if;

    -- O aceite vale para a regra que estava vigente; se o plano ou a taxa
    -- mudaram desde então, é preciso aceitar de novo.
    v_fee := public.current_plan_coupon_fee(public.business_plan_id(v_offer.business_id));
    if v_fee.id is distinct from v_version.fee_rule_id then
        perform public.farol_error('fee_changed', 'A taxa vigente mudou desde o aceite. Aceite as novas condições.');
    end if;

    select review_status into v_previous_status
      from public.offer_versions
     where offer_id = p_offer_id and version_number = v_version.version_number - 1;

    update public.offer_versions
       set review_status = 'submitted', submitted_at = now()
     where id = v_version.id;

    if v_offer.status <> 'active' then
        update public.offers set status = 'pending_review' where id = p_offer_id;
    end if;

    perform public.log_offer_review(
        p_offer_id,
        v_version.id,
        case when v_previous_status = 'changes_requested' then 'resubmitted' else 'submitted' end::offer_review_action
    );
    perform public.end_offer_write();
end;
$$;

-- ---------------------------------------------------------------------------
-- Análise (admin)
-- ---------------------------------------------------------------------------

-- Decide a versão que aguarda análise. Oferta nova acompanha a decisão no
-- status; revisão de oferta ativa decide só a versão.
create or replace function public.decide_offer_version(
    p_offer_id uuid,
    p_decision text,
    p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers := public.lock_offer(p_offer_id);
    v_version public.offer_versions := public.latest_offer_version(p_offer_id);
begin
    perform public.begin_offer_write();
    if v_version.review_status <> 'submitted' then
        perform public.farol_error('invalid_transition', 'Esta oferta não está aguardando análise.');
    end if;

    if p_decision in ('changes_requested', 'rejected') and nullif(btrim(p_message), '') is null then
        perform public.farol_error('reason_required', 'Informe o motivo da decisão.');
    end if;

    if p_decision = 'approved' then
        perform public.assert_business_active(v_offer.business_id);
        perform public.assert_offer_version_complete(v_version);
    end if;

    update public.offer_versions set review_status = p_decision where id = v_version.id;

    if v_offer.status = 'pending_review' then
        update public.offers set status = p_decision::offer_status where id = p_offer_id;
    end if;

    perform public.log_offer_review(p_offer_id, v_version.id, p_decision::offer_review_action, p_message);
    perform public.end_offer_write();
end;
$$;

create or replace function public.request_offer_changes(p_offer_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.require_admin();
    perform public.decide_offer_version(p_offer_id, 'changes_requested', p_message);
end;
$$;

create or replace function public.reject_offer(p_offer_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.require_admin();
    perform public.decide_offer_version(p_offer_id, 'rejected', p_message);
end;
$$;

create or replace function public.approve_offer(p_offer_id uuid, p_message text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.require_admin();
    perform public.decide_offer_version(p_offer_id, 'approved', p_message);
end;
$$;

-- ---------------------------------------------------------------------------
-- Publicação e ciclo de vida (admin)
-- ---------------------------------------------------------------------------

-- Ativa a oferta com a versão aprovada. Chamada já com a oferta travada.
create or replace function public.activate_offer_version(
    p_offer public.offers,
    p_version public.offer_versions,
    p_action offer_review_action
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.assert_business_active(p_offer.business_id);
    perform public.assert_offer_plan_capacity(p_offer.business_id);

    update public.offers
       set status = 'active',
           published_version_id = p_version.id,
           activated_at = now()
     where id = p_offer.id;

    perform public.log_offer_review(p_offer.id, p_version.id, p_action);
end;
$$;

-- approved → active (início já passou) ou scheduled (início futuro). Em uma
-- oferta ativa, publica a revisão aprovada no lugar da versão anterior.
create or replace function public.publish_offer(p_offer_id uuid)
returns offer_status
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers;
    v_version public.offer_versions;
begin
    perform public.begin_offer_write();
    perform public.require_admin();
    v_offer := public.lock_offer(p_offer_id);
    v_version := public.latest_offer_version(p_offer_id);

    if v_version.review_status <> 'approved'
        or v_offer.status not in ('approved', 'active')
        or v_version.id = v_offer.published_version_id then
        perform public.farol_error('invalid_transition', 'Não há versão aprovada desta oferta para publicar.');
    end if;

    if v_version.ends_at <= now() then
        perform public.farol_error('offer_period_ended', 'O período da oferta já terminou.');
    end if;

    if v_offer.status = 'active' then
        if v_version.starts_at > now() then
            perform public.farol_error('revision_not_started', 'A revisão só pode substituir a versão no ar quando o novo período já tiver começado.');
        end if;
        perform public.assert_business_active(v_offer.business_id);
        update public.offers set published_version_id = v_version.id where id = p_offer_id;
        perform public.log_offer_review(p_offer_id, v_version.id, 'published');
        perform public.end_offer_write();
        return 'active';
    end if;

    if v_version.starts_at > now() then
        perform public.assert_business_active(v_offer.business_id);
        update public.offers set status = 'scheduled' where id = p_offer_id;
        perform public.log_offer_review(p_offer_id, v_version.id, 'scheduled');
        perform public.end_offer_write();
        return 'scheduled';
    end if;

    perform public.activate_offer_version(v_offer, v_version, 'published');
    perform public.end_offer_write();
    return 'active';
end;
$$;

-- scheduled → active quando o início chega. Sem grant: é para o job futuro
-- (pg_cron), rodando como dono. Oferta que não cabe no plano ou cujo negócio
-- saiu do ar continua agendada e é tentada de novo na próxima execução.
create or replace function public.activate_due_offers()
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
         order by o.updated_at
           for update skip locked
    loop
        v_version := public.latest_offer_version(v_offer.id);
        continue when v_version.starts_at > now() or v_version.ends_at <= now();
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

create or replace function public.suspend_offer(p_offer_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers;
begin
    perform public.begin_offer_write();
    perform public.require_admin();
    v_offer := public.lock_offer(p_offer_id);

    if v_offer.status <> 'active' then
        perform public.farol_error('invalid_transition', 'Só uma oferta ativa pode ser suspensa.');
    end if;
    if nullif(btrim(p_message), '') is null then
        perform public.farol_error('reason_required', 'Informe o motivo da suspensão.');
    end if;

    update public.offers set status = 'suspended', suspended_at = now() where id = p_offer_id;
    perform public.log_offer_review(p_offer_id, v_offer.published_version_id, 'suspended', p_message);
    perform public.end_offer_write();
end;
$$;

-- suspended → active, desde que o período continue válido, o negócio esteja
-- no ar e o plano tenha vaga. Bloqueio financeiro ainda não existe (não há
-- cobrança); quando existir, entra aqui.
create or replace function public.reactivate_offer(p_offer_id uuid, p_message text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers;
    v_version public.offer_versions;
begin
    perform public.begin_offer_write();
    perform public.require_admin();
    v_offer := public.lock_offer(p_offer_id);

    if v_offer.status <> 'suspended' then
        perform public.farol_error('invalid_transition', 'Só uma oferta suspensa pode ser reativada.');
    end if;

    select * into v_version from public.offer_versions where id = v_offer.published_version_id;
    if v_version.ends_at <= now() then
        perform public.farol_error('offer_period_ended', 'O período da oferta já terminou.');
    end if;

    perform public.assert_business_active(v_offer.business_id);
    perform public.assert_offer_plan_capacity(v_offer.business_id);

    update public.offers set status = 'active' where id = p_offer_id;
    perform public.log_offer_review(p_offer_id, v_version.id, 'reactivated', p_message);
    perform public.end_offer_write();
end;
$$;

-- Encerramento é definitivo. Para repetir a promoção, cria-se outra oferta.
create or replace function public.end_offer(p_offer_id uuid, p_message text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offer public.offers;
begin
    perform public.begin_offer_write();
    perform public.require_admin();
    v_offer := public.lock_offer(p_offer_id);

    if v_offer.status not in ('approved', 'scheduled', 'active', 'suspended') then
        perform public.farol_error('invalid_transition', 'Esta oferta não pode ser encerrada neste status.');
    end if;

    update public.offers set status = 'ended', ended_at = now() where id = p_offer_id;
    perform public.log_offer_review(
        p_offer_id,
        coalesce(v_offer.published_version_id, (public.latest_offer_version(p_offer_id)).id),
        'ended',
        p_message
    );
    perform public.end_offer_write();
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.begin_offer_write() from public, anon, authenticated;
revoke all on function public.end_offer_write() from public, anon, authenticated;
revoke all on function public.offer_editable_fields() from public, anon, authenticated;
revoke all on function public.apply_offer_payload(public.offer_versions, jsonb) from public, anon, authenticated;
revoke all on function public.save_offer_version_content(public.offer_versions) from public, anon, authenticated;
revoke all on function public.latest_offer_version(uuid) from public, anon, authenticated;
revoke all on function public.fork_offer_version(public.offer_versions) from public, anon, authenticated;
revoke all on function public.lock_offer(uuid) from public, anon, authenticated;
revoke all on function public.lock_owned_offer(uuid) from public, anon, authenticated;
revoke all on function public.log_offer_review(uuid, uuid, offer_review_action, text) from public, anon, authenticated;
revoke all on function public.assert_business_active(uuid) from public, anon, authenticated;
revoke all on function public.assert_offer_version_complete(public.offer_versions) from public, anon, authenticated;
revoke all on function public.assert_offer_plan_capacity(uuid) from public, anon, authenticated;
revoke all on function public.decide_offer_version(uuid, text, text) from public, anon, authenticated;
revoke all on function public.activate_offer_version(public.offers, public.offer_versions, offer_review_action) from public, anon, authenticated;
revoke all on function public.activate_due_offers() from public, anon, authenticated;

revoke all on function public.admin_set_business_plan(uuid, text, text) from public, anon;
revoke all on function public.get_business_offer_terms(uuid) from public, anon;
revoke all on function public.create_offer(uuid, jsonb) from public, anon;
revoke all on function public.update_offer_draft(uuid, jsonb) from public, anon;
revoke all on function public.create_offer_revision(uuid) from public, anon;
revoke all on function public.accept_offer_financial_terms(uuid, numeric) from public, anon;
revoke all on function public.submit_offer_for_review(uuid) from public, anon;
revoke all on function public.request_offer_changes(uuid, text) from public, anon;
revoke all on function public.reject_offer(uuid, text) from public, anon;
revoke all on function public.approve_offer(uuid, text) from public, anon;
revoke all on function public.publish_offer(uuid) from public, anon;
revoke all on function public.suspend_offer(uuid, text) from public, anon;
revoke all on function public.reactivate_offer(uuid, text) from public, anon;
revoke all on function public.end_offer(uuid, text) from public, anon;

grant execute on function public.admin_set_business_plan(uuid, text, text) to authenticated;
grant execute on function public.get_business_offer_terms(uuid) to authenticated;
grant execute on function public.create_offer(uuid, jsonb) to authenticated;
grant execute on function public.update_offer_draft(uuid, jsonb) to authenticated;
grant execute on function public.create_offer_revision(uuid) to authenticated;
grant execute on function public.accept_offer_financial_terms(uuid, numeric) to authenticated;
grant execute on function public.submit_offer_for_review(uuid) to authenticated;
grant execute on function public.request_offer_changes(uuid, text) to authenticated;
grant execute on function public.reject_offer(uuid, text) to authenticated;
grant execute on function public.approve_offer(uuid, text) to authenticated;
grant execute on function public.publish_offer(uuid) to authenticated;
grant execute on function public.suspend_offer(uuid, text) to authenticated;
grant execute on function public.reactivate_offer(uuid, text) to authenticated;
grant execute on function public.end_offer(uuid, text) to authenticated;
