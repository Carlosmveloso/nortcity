-- Homologação do módulo de ofertas (Sprint 1) — APENAS farol-pitimbu-dev.
--
-- Pré-requisito: migrations 20261005000001 a 20261005000003 aplicadas no
-- destino confirmado. Executar como `postgres` (psql ou SQL editor).
--
-- Tudo roda em uma transação encerrada com ROLLBACK: usuários, negócios,
-- planos e ofertas fictícios não ficam no banco. Os fluxos usam os papéis
-- reais `authenticated`, `anon` e `service_role`.
--
-- Duas limitações de uma transação única, tratadas assim:
--   * now() é fixo durante a transação. Para provar que oferta vencida some
--     da vitrine, a seção 16 recua o período de uma versão desligando a
--     trigger de imutabilidade dentro desta mesma transação (ALTER TABLE é
--     transacional e também é desfeito no ROLLBACK). Isso trava
--     offer_versions até o fim do roteiro — aceitável só em desenvolvimento.
--   * Concorrência real exige dados confirmados e duas sessões. Está em
--     offers_concurrency_homologation.sql, separado deste roteiro.
--
-- Sucesso: a última linha retorna `offers_qa_passed_with_rollback`.
-- Falha: a execução para em `offers_qa_failed: <passo>` e nada é gravado.

begin;
set local statement_timeout = '60s';
set local lock_timeout = '5s';

create temp table qa_ids (key text primary key, id uuid not null);
create temp table qa_snapshots (key text primary key, data jsonb not null);
grant all on table qa_ids, qa_snapshots to authenticated, service_role;
grant select on table qa_ids to anon;

create function pg_temp.qa(p_key text) returns uuid
language sql stable as $$ select id from qa_ids where key = p_key $$;

create function pg_temp.check(p_condition boolean, p_message text) returns void
language plpgsql as $$
begin
    if not coalesce(p_condition, false) then
        raise exception 'offers_qa_failed: %', p_message;
    end if;
end;
$$;

-- Executa p_sql esperando erro. p_expected é o código farol_error (texto da
-- mensagem), um SQLSTATE de 5 caracteres ou um trecho da mensagem.
create function pg_temp.expect_error(p_sql text, p_expected text, p_label text) returns void
language plpgsql as $$
begin
    begin
        execute p_sql;
    exception when others then
        if sqlstate = p_expected or position(p_expected in sqlerrm) > 0 then
            return;
        end if;
        raise exception 'offers_qa_failed: % (recebido % / %)', p_label, sqlstate, sqlerrm;
    end;
    raise exception 'offers_qa_failed: % (a operação foi concluída sem erro)', p_label;
end;
$$;

grant execute on function pg_temp.qa(text), pg_temp.check(boolean, text), pg_temp.expect_error(text, text, text)
    to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 0. Catálogo: grants efetivos no Supabase real
-- ---------------------------------------------------------------------------
-- O Supabase concede privilégios padrão diretamente a anon/authenticated; o
-- PGlite não. Aqui se confirma que os revokes das migrations valeram.

select pg_temp.check(
    (select bool_and(not has_table_privilege(r, t, p))
       from unnest(array['anon', 'authenticated']) r,
            unnest(array['public.offers', 'public.offer_versions', 'public.offer_reviews',
                         'public.plans', 'public.plan_coupon_fees', 'public.business_plan_assignments']) t,
            unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p),
    '0.1 anon/authenticated sem escrita nas tabelas de ofertas e planos'
);
select pg_temp.check(
    not has_table_privilege('anon', 'public.plan_coupon_fees', 'SELECT')
    and not has_table_privilege('anon', 'public.business_plan_assignments', 'SELECT')
    and not has_table_privilege('anon', 'public.offer_reviews', 'SELECT')
    and not has_column_privilege('anon', 'public.offer_versions', 'fee_amount', 'SELECT')
    and not has_column_privilege('anon', 'public.offer_versions', 'financial_accepted_by', 'SELECT')
    and not has_column_privilege('anon', 'public.offers', 'created_by', 'SELECT')
    and has_column_privilege('anon', 'public.offer_versions', 'title', 'SELECT'),
    '0.2 anon lê só colunas de vitrine'
);
select pg_temp.check(
    (select bool_and(not has_function_privilege('anon', f, 'EXECUTE'))
       from unnest(array[
            'public.create_offer(uuid,jsonb)', 'public.submit_offer_for_review(uuid)',
            'public.accept_offer_financial_terms(uuid,numeric)', 'public.approve_offer(uuid,text)',
            'public.publish_offer(uuid)', 'public.admin_set_business_plan(uuid,text,text)',
            'public.get_business_offer_terms(uuid)']) f),
    '0.3 anon não executa RPCs de ofertas'
);
select pg_temp.check(
    (select bool_and(not has_function_privilege(r, f, 'EXECUTE'))
       from unnest(array['anon', 'authenticated']) r,
            unnest(array[
            'public.activate_due_offers(timestamptz)', 'public.lock_offer(uuid)', 'public.lock_owned_offer(uuid)',
            'public.decide_offer_version(uuid,text,text)', 'public.assert_offer_plan_capacity(uuid)',
            'public.log_offer_review(uuid,uuid,offer_review_action,text)',
            'public.business_plan_id(uuid)', 'public.current_plan_coupon_fee(text,timestamptz)']) f),
    '0.4 funções internas sem EXECUTE para anon/authenticated'
);
select pg_temp.check(
    (select count(*) = 3 from public.plan_coupon_fees
      where (plan_id, amount) in (('basico', 1.50), ('profissional', 1.00), ('premium', 0.50))
        and valid_until is null),
    '0.5 taxas iniciais vigentes'
);

-- ---------------------------------------------------------------------------
-- 1. Massa fictícia
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at) values
    ('71000000-0000-4000-8000-000000000001', 'offers.pro@example.test', now(), '{"full_name":"Pro QA"}', now(), now()),
    ('71000000-0000-4000-8000-000000000002', 'offers.basic@example.test', now(), '{"full_name":"Basic QA"}', now(), now()),
    ('71000000-0000-4000-8000-000000000003', 'offers.free@example.test', now(), '{"full_name":"Free QA"}', now(), now()),
    ('71000000-0000-4000-8000-000000000004', 'offers.user@example.test', now(), '{"full_name":"User QA"}', now(), now()),
    ('71000000-0000-4000-8000-000000000005', 'offers.admin@example.test', now(), '{"full_name":"Admin QA"}', now(), now());
insert into public.user_roles (user_id, role) values ('71000000-0000-4000-8000-000000000005', 'admin');
insert into public.categories (id, name, slug, order_index)
values ('72000000-0000-4000-8000-000000000001', 'Ofertas QA', 'ofertas-qa', 999);

-- Cada proprietário cadastra o próprio negócio.
create function pg_temp.submit_qa_business(p_key text, p_name text, p_phone text) returns void
language plpgsql as $$
begin
    insert into qa_ids values (p_key, public.submit_business(
        jsonb_build_object(
            'name', p_name,
            'description', 'Cadastro descartável para homologação de ofertas.',
            'service_area', 'Pitimbu e região',
            'phone', p_phone
        ),
        array['72000000-0000-4000-8000-000000000001'::uuid],
        '72000000-0000-4000-8000-000000000001'::uuid
    ));
end;
$$;
grant execute on function pg_temp.submit_qa_business(text, text, text) to authenticated;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.submit_qa_business('biz_pro', 'Restaurante Pro QA', '83991110001');
reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.submit_qa_business('biz_basic', 'Pousada Básico QA', '83991110002');
reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.submit_qa_business('biz_free', 'Quiosque Gratuito QA', '83991110003');
reset role;

-- Admin aprova e atribui planos. O Gratuito fica sem atribuição.
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.moderate_business(pg_temp.qa('biz_pro'), 'approve');
select public.moderate_business(pg_temp.qa('biz_basic'), 'approve');
select public.moderate_business(pg_temp.qa('biz_free'), 'approve');
select public.admin_set_business_plan(pg_temp.qa('biz_pro'), 'profissional', 'Homologação');
select public.admin_set_business_plan(pg_temp.qa('biz_basic'), 'basico', 'Homologação');
select pg_temp.check(
    (public.get_business_offer_terms(pg_temp.qa('biz_free')) ->> 'plan_id') = 'gratuito',
    '1.1 negócio sem atribuição está no Gratuito'
);
reset role;

-- Payload completo reaproveitado pelos fluxos.
create function pg_temp.payload(p_title text, p_starts interval default interval '-1 hour') returns jsonb
language sql stable as $$
    select jsonb_build_object(
        'title', p_title,
        'description', 'Desconto válido no almoço executivo.',
        'benefit_type', 'percentage_discount',
        'benefit_value', 20,
        'starts_at', now() + p_starts,
        'ends_at', now() + interval '30 days',
        'days_of_week', jsonb_build_array(1, 2),
        'time_windows', jsonb_build_array(
            jsonb_build_object('day', 1, 'start', '11:00', 'end', '15:00'),
            jsonb_build_object('day', 2, 'start', '18:00', 'end', '22:00')
        ),
        'per_user_limit', 1,
        'total_limit', 100,
        'coupon_validity_minutes', 120
    );
$$;
grant execute on function pg_temp.payload(text, interval) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Criação e autorização
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into qa_ids values ('offer_a', public.create_offer(pg_temp.qa('biz_pro'), pg_temp.payload('20% no almoço QA')));
select pg_temp.check(
    (select status = 'draft' and business_id = pg_temp.qa('biz_pro') and created_by = auth.uid()
       from public.offers where id = pg_temp.qa('offer_a')),
    '2.1 oferta nasce draft, do negócio e da conta'
);
select pg_temp.check(
    (select count(*) = 1 and bool_and(version_number = 1 and review_status = 'draft')
       from public.offer_versions where offer_id = pg_temp.qa('offer_a')),
    '2.2 versão 1 em rascunho'
);
select pg_temp.expect_error(
    format('insert into public.offers (business_id, created_by) values (%L, auth.uid())', pg_temp.qa('biz_pro')),
    '42501', '2.3 INSERT direto em offers recusado'
);
select pg_temp.expect_error(
    format($q$select public.create_offer(%L, pg_temp.payload('Período inválido QA', interval '1 day') || '{"ends_at":"2020-01-01T00:00:00Z"}')$q$, pg_temp.qa('biz_pro')),
    'offer_versions_period_check', '2.4 início depois do fim barrado pela constraint'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select pg_temp.expect_error(
    format('select public.create_offer(%L, %L::jsonb)', pg_temp.qa('biz_pro'), '{}'),
    'forbidden', '2.5 usuário comum não cria oferta'
);
select pg_temp.check(
    (select count(*) = 0 from public.offers where id = pg_temp.qa('offer_a')),
    '2.6 usuário comum não lê rascunho alheio'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.expect_error(
    format('select public.create_offer(%L, %L::jsonb)', pg_temp.qa('biz_pro'), '{}'),
    'forbidden', '2.7 proprietário não cria oferta para outro negócio'
);
reset role;

-- ---------------------------------------------------------------------------
-- 3. Aceite financeiro e envio
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.expect_error(
    format('select public.submit_offer_for_review(%L)', pg_temp.qa('offer_a')),
    'financial_terms_required', '3.1 envio sem aceite recusado'
);
select pg_temp.expect_error(
    format('select public.accept_offer_financial_terms(%L, 0.50)', pg_temp.qa('offer_a')),
    'fee_changed', '3.2 aceite com taxa diferente da vigente recusado'
);
select public.accept_offer_financial_terms(pg_temp.qa('offer_a'), 1.00);
select pg_temp.check(
    (select fee_amount = 1.00 and fee_rule_id is not null and financial_accepted_by = auth.uid()
       from public.offer_versions where offer_id = pg_temp.qa('offer_a') and version_number = 1),
    '3.3 taxa do Profissional congelada na versão'
);
select public.submit_offer_for_review(pg_temp.qa('offer_a'));
select pg_temp.check(
    (select status = 'pending_review' from public.offers where id = pg_temp.qa('offer_a')),
    '3.4 oferta em análise'
);

-- ---------------------------------------------------------------------------
-- 4. Versão submetida é imutável
-- ---------------------------------------------------------------------------

select pg_temp.expect_error(
    format($q$select public.update_offer_draft(%L, '{"title":"Alterado"}')$q$, pg_temp.qa('offer_a')),
    'offer_not_editable', '4.1 proprietário não edita versão enviada pela RPC'
);
select pg_temp.expect_error(
    format($q$update public.offer_versions set title = 'Alterado' where offer_id = %L$q$, pg_temp.qa('offer_a')),
    '42501', '4.2 proprietário não edita versão por UPDATE direto'
);

-- ---------------------------------------------------------------------------
-- 5. Proprietário não chama RPC administrativa
-- ---------------------------------------------------------------------------

select pg_temp.expect_error(format('select public.approve_offer(%L)', pg_temp.qa('offer_a')), 'forbidden', '5.1 approve_offer');
select pg_temp.expect_error(format('select public.request_offer_changes(%L, %L)', pg_temp.qa('offer_a'), 'x'), 'forbidden', '5.2 request_offer_changes');
select pg_temp.expect_error(format('select public.reject_offer(%L, %L)', pg_temp.qa('offer_a'), 'x'), 'forbidden', '5.3 reject_offer');
select pg_temp.expect_error(format('select public.publish_offer(%L)', pg_temp.qa('offer_a')), 'forbidden', '5.4 publish_offer');
select pg_temp.expect_error(format('select public.suspend_offer(%L, %L)', pg_temp.qa('offer_a'), 'x'), 'forbidden', '5.5 suspend_offer');
select pg_temp.expect_error(format('select public.reactivate_offer(%L)', pg_temp.qa('offer_a')), 'forbidden', '5.6 reactivate_offer');
select pg_temp.expect_error(format('select public.end_offer(%L)', pg_temp.qa('offer_a')), 'forbidden', '5.7 end_offer');
select pg_temp.expect_error(format('select public.admin_set_business_plan(%L, %L)', pg_temp.qa('biz_pro'), 'premium'), 'forbidden', '5.8 admin_set_business_plan');
select pg_temp.expect_error(
    format($q$update public.offers set status = 'active' where id = %L$q$, pg_temp.qa('offer_a')),
    '42501', '5.9 UPDATE direto de status recusado'
);
reset role;

-- service_role e postgres também não pulam a máquina de estados nem a imutabilidade.
set local role service_role;
select pg_temp.expect_error(
    format($q$update public.offers set status = 'active' where id = %L$q$, pg_temp.qa('offer_a')),
    'invalid_transition', '5.10 service_role: pending_review → active barrado'
);
select pg_temp.expect_error(
    format($q$update public.offer_versions set title = 'Alterado' where offer_id = %L$q$, pg_temp.qa('offer_a')),
    'version_immutable', '5.11 service_role: versão enviada imutável'
);
select pg_temp.expect_error(
    format($q$insert into public.offers (business_id, created_by, status) values (%L, %L, 'active')$q$,
           pg_temp.qa('biz_pro'), '71000000-0000-4000-8000-000000000001'),
    'invalid_transition', '5.12 service_role: oferta não nasce ativa'
);
reset role;
select pg_temp.expect_error(
    format($q$update public.offers set status = 'scheduled' where id = %L$q$, pg_temp.qa('offer_a')),
    'invalid_transition', '5.13 postgres: pending_review → scheduled barrado'
);

-- Transição VÁLIDA fora da RPC também é recusada: sem a operação oficial não
-- há histórico. Esta transação já executou várias RPCs, então estes passos
-- também provam que o sinal de escrita autorizada não sobra para depois delas.
set local role service_role;
select pg_temp.expect_error(
    format($q$update public.offers set status = 'approved' where id = %L$q$, pg_temp.qa('offer_a')),
    'direct_write_not_allowed', '5.14 service_role: pending_review → approved direto recusado'
);
select pg_temp.expect_error(
    format($q$update public.offer_versions set review_status = 'approved' where offer_id = %L and review_status = 'submitted'$q$, pg_temp.qa('offer_a')),
    'direct_write_not_allowed', '5.15 service_role: decisão da versão direta recusada'
);
select pg_temp.expect_error(
    format($q$insert into public.offer_reviews (offer_id, offer_version_id, action)
              select offer_id, id, 'approved' from public.offer_versions where offer_id = %L$q$, pg_temp.qa('offer_a')),
    'direct_write_not_allowed', '5.16 service_role: histórico inserido à mão recusado'
);
reset role;
select pg_temp.expect_error(
    format($q$update public.offers set status = 'approved' where id = %L$q$, pg_temp.qa('offer_a')),
    'direct_write_not_allowed', '5.17 postgres: pending_review → approved direto recusado'
);
select pg_temp.check(
    (select status = 'pending_review' from public.offers where id = pg_temp.qa('offer_a'))
    and (select count(*) = 1 from public.offer_reviews where offer_id = pg_temp.qa('offer_a')),
    '5.18 status e histórico intactos depois das tentativas diretas'
);

-- ---------------------------------------------------------------------------
-- 6. Ajustes, reenvio, aprovação e publicação
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.expect_error(
    format($q$select public.request_offer_changes(%L, '   ')$q$, pg_temp.qa('offer_a')),
    'reason_required', '6.1 pedido de ajustes sem motivo'
);
select public.request_offer_changes(pg_temp.qa('offer_a'), 'Informe quais pratos participam.');
select pg_temp.check(
    (select status = 'changes_requested' from public.offers where id = pg_temp.qa('offer_a')),
    '6.2 pending_review → changes_requested'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select pg_temp.check(
    (select count(*) = 0 from public.offer_reviews where offer_id = pg_temp.qa('offer_a')),
    '6.3 outra conta não lê o histórico'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.check(
    (select message = 'Informe quais pratos participam.' from public.offer_reviews
      where offer_id = pg_temp.qa('offer_a') and action = 'changes_requested'),
    '6.4 proprietário lê o motivo'
);
select public.update_offer_draft(pg_temp.qa('offer_a'), '{"eligible_items":"Pratos executivos"}');
select pg_temp.expect_error(
    format('select public.submit_offer_for_review(%L)', pg_temp.qa('offer_a')),
    'financial_terms_required', '6.5 nova versão exige novo aceite'
);
select public.accept_offer_financial_terms(pg_temp.qa('offer_a'), 1.00);
select public.submit_offer_for_review(pg_temp.qa('offer_a'));
select pg_temp.check(
    (select status = 'pending_review' from public.offers where id = pg_temp.qa('offer_a'))
    and (select review_status = 'changes_requested' and eligible_items is null
           from public.offer_versions where offer_id = pg_temp.qa('offer_a') and version_number = 1)
    and (select review_status = 'submitted' and eligible_items = 'Pratos executivos'
           from public.offer_versions where offer_id = pg_temp.qa('offer_a') and version_number = 2),
    '6.6 reenvio cria v2 e preserva v1'
);
-- created_at é o mesmo em toda a transação; confere o conjunto, não a ordem.
select pg_temp.check(
    (select array_agg(action::text order by action::text) = array['changes_requested', 'resubmitted', 'submitted']
       from public.offer_reviews where offer_id = pg_temp.qa('offer_a')),
    '6.7 histórico com submitted, changes_requested e resubmitted'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.approve_offer(pg_temp.qa('offer_a'));
select pg_temp.check(
    (select status = 'approved' and published_version_id is null from public.offers where id = pg_temp.qa('offer_a')),
    '6.8 aprovar não publica'
);
select pg_temp.check(
    (select count(*) = 1 from public.offer_reviews
      where offer_id = pg_temp.qa('offer_a') and action = 'approved' and actor_id = auth.uid()),
    '6.8b RPC oficial registra a aprovação com o admin como autor'
);
select pg_temp.check(public.publish_offer(pg_temp.qa('offer_a')) = 'active', '6.9 publish_offer retorna active');
select pg_temp.check(
    (select o.status = 'active' and o.activated_at is not null and v.version_number = 2
       from public.offers o join public.offer_versions v on v.id = o.published_version_id
      where o.id = pg_temp.qa('offer_a')),
    '6.10 approved → active com published_version_id = v2'
);
reset role;

-- ---------------------------------------------------------------------------
-- 7. Visitante
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.check(
    (select count(*) = 1 from public.offers where id = pg_temp.qa('offer_a')),
    '7.1 anon vê oferta ativa'
);
select pg_temp.check(
    (select count(*) = 1 and bool_and(version_number = 2)
       from public.offer_versions where offer_id = pg_temp.qa('offer_a')),
    '7.2 anon vê só a versão publicada'
);
select pg_temp.expect_error('select fee_amount from public.offer_versions', '42501', '7.3 anon não lê taxa');
select pg_temp.expect_error('select * from public.offer_versions', '42501', '7.4 anon não faz select *');
select pg_temp.expect_error('select created_by from public.offers', '42501', '7.5 anon não lê autoria');
select pg_temp.expect_error('select * from public.offer_reviews', '42501', '7.6 anon não lê histórico');
select pg_temp.expect_error('select * from public.plan_coupon_fees', '42501', '7.7 anon não lê tabela de taxas');
select pg_temp.expect_error('select * from public.business_plan_assignments', '42501', '7.8 anon não lê planos atribuídos');
select pg_temp.expect_error(
    format('select public.get_business_offer_terms(%L)', pg_temp.qa('biz_pro')),
    '42501', '7.9 anon não consulta condições financeiras'
);
reset role;

-- ---------------------------------------------------------------------------
-- 8. Revisão: a versão publicada continua no ar até a nova ser publicada
-- ---------------------------------------------------------------------------

insert into qa_snapshots
select 'offer_a_v2', to_jsonb(v) from public.offer_versions v
 where offer_id = pg_temp.qa('offer_a') and version_number = 2;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into qa_ids values ('offer_a_v3', public.create_offer_revision(pg_temp.qa('offer_a')));
select pg_temp.expect_error(
    format('select public.create_offer_revision(%L)', pg_temp.qa('offer_a')),
    'revision_already_open', '8.1 uma revisão aberta por vez'
);
select public.update_offer_draft(pg_temp.qa('offer_a'), '{"title":"25% no almoço QA","benefit_value":25}');
select public.accept_offer_financial_terms(pg_temp.qa('offer_a'), 1.00);
select public.submit_offer_for_review(pg_temp.qa('offer_a'));
select pg_temp.check(
    (select status = 'active' from public.offers where id = pg_temp.qa('offer_a')),
    '8.2 oferta segue ativa durante a análise da revisão'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.check(
    (select title = '20% no almoço QA' from public.offer_versions where offer_id = pg_temp.qa('offer_a')),
    '8.3 visitante continua vendo a v2 durante a revisão'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.approve_offer(pg_temp.qa('offer_a'));
select pg_temp.check(
    (select title = '20% no almoço QA' from public.offer_versions v
       join public.offers o on o.published_version_id = v.id where o.id = pg_temp.qa('offer_a')),
    '8.4 revisão aprovada ainda não substitui a publicada'
);
select public.publish_offer(pg_temp.qa('offer_a'));
select pg_temp.check(
    (select published_version_id = pg_temp.qa('offer_a_v3') from public.offers where id = pg_temp.qa('offer_a')),
    '8.5 publicação troca para a v3'
);
reset role;
select pg_temp.check(
    (select to_jsonb(v) = s.data from public.offer_versions v, qa_snapshots s
      where s.key = 'offer_a_v2' and v.offer_id = pg_temp.qa('offer_a') and v.version_number = 2),
    '8.6 v2 idêntica depois de deixar de ser publicada'
);

-- ---------------------------------------------------------------------------
-- 9. Oferta futura é agendada e pode ser cancelada
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into qa_ids values ('offer_b', public.create_offer(pg_temp.qa('biz_pro'), pg_temp.payload('Oferta futura QA', interval '14 days')));
select public.accept_offer_financial_terms(pg_temp.qa('offer_b'), 1.00);
select public.submit_offer_for_review(pg_temp.qa('offer_b'));
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.approve_offer(pg_temp.qa('offer_b'));
select pg_temp.check(public.publish_offer(pg_temp.qa('offer_b')) = 'scheduled', '9.1 início futuro → scheduled');
reset role;
select public.activate_due_offers();
select pg_temp.check(
    (select status = 'scheduled' and published_version_id is null from public.offers where id = pg_temp.qa('offer_b')),
    '9.2 job não ativa antes do início'
);
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.end_offer(pg_temp.qa('offer_b'), 'Cancelada antes de entrar no ar.');
select pg_temp.check(
    (select status = 'ended' and ended_at is not null from public.offers where id = pg_temp.qa('offer_b')),
    '9.3 scheduled → ended'
);
reset role;

-- ---------------------------------------------------------------------------
-- 10. Limite do plano, troca de plano e publicação imediata
-- ---------------------------------------------------------------------------

create function pg_temp.basic_offer(p_key text, p_title text) returns void
language plpgsql as $$
begin
    insert into qa_ids values (p_key, public.create_offer(pg_temp.qa('biz_basic'), pg_temp.payload(p_title)));
    perform public.accept_offer_financial_terms(pg_temp.qa(p_key), 1.50);
    perform public.submit_offer_for_review(pg_temp.qa(p_key));
end;
$$;
grant execute on function pg_temp.basic_offer(text, text) to authenticated;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.basic_offer('offer_c', 'Café grátis QA');
select pg_temp.basic_offer('offer_d', 'Diária com desconto QA');
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.approve_offer(pg_temp.qa('offer_c'));
select public.approve_offer(pg_temp.qa('offer_d'));
select public.publish_offer(pg_temp.qa('offer_c'));
select pg_temp.expect_error(
    format('select public.publish_offer(%L)', pg_temp.qa('offer_d')),
    'plan_offer_limit_reached', '10.1 Básico com 1 ativa não ativa a segunda'
);
select pg_temp.check(
    (select status = 'approved' from public.offers where id = pg_temp.qa('offer_d')),
    '10.2 oferta barrada continua approved'
);
select pg_temp.expect_error(
    format('select public.admin_set_business_plan(%L, %L)', pg_temp.qa('biz_basic'), 'gratuito'),
    'plan_offer_limit_exceeded', '10.3 downgrade abaixo das ativas recusado'
);
select public.admin_set_business_plan(pg_temp.qa('biz_basic'), 'profissional', 'Upgrade na homologação');
select public.publish_offer(pg_temp.qa('offer_d'));
select pg_temp.check(
    (select count(*) = 2 from public.offers where business_id = pg_temp.qa('biz_basic') and status = 'active'),
    '10.4 upgrade seguido de publicação imediata ativa a segunda'
);
select pg_temp.expect_error(
    format('select public.admin_set_business_plan(%L, %L)', pg_temp.qa('biz_basic'), 'basico'),
    'plan_offer_limit_exceeded', '10.5 voltar ao Básico com 2 ativas recusado'
);
select pg_temp.check(
    (select count(*) = 2 from public.business_plan_assignments where business_id = pg_temp.qa('biz_basic')),
    '10.6 histórico de planos só acumula'
);
reset role;

-- ---------------------------------------------------------------------------
-- 11. Suspensão, reativação e encerramento
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.expect_error(
    format('select public.suspend_offer(%L, null)', pg_temp.qa('offer_c')),
    'reason_required', '11.1 suspensão sem motivo'
);
select public.suspend_offer(pg_temp.qa('offer_c'), 'Apuração de denúncia.');
select pg_temp.check(
    (select status = 'suspended' and suspended_at is not null from public.offers where id = pg_temp.qa('offer_c'))
    and (select message = 'Apuração de denúncia.' and actor_id = auth.uid() from public.offer_reviews
          where offer_id = pg_temp.qa('offer_c') and action = 'suspended'),
    '11.2 active → suspended com motivo e autor'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.check(
    (select count(*) = 0 from public.offers where id = pg_temp.qa('offer_c')),
    '11.3 suspensa sai da vitrine'
);
reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.reactivate_offer(pg_temp.qa('offer_c'));
select public.end_offer(pg_temp.qa('offer_c'), 'Fim da promoção.');
select pg_temp.expect_error(
    format('select public.reactivate_offer(%L)', pg_temp.qa('offer_c')),
    'invalid_transition', '11.4 encerrada não reativa'
);
select pg_temp.expect_error(
    format('select public.publish_offer(%L)', pg_temp.qa('offer_c')),
    'invalid_transition', '11.5 encerrada não republica'
);
reset role;
set local role service_role;
select pg_temp.expect_error(
    format($q$update public.offers set status = 'active' where id = %L$q$, pg_temp.qa('offer_c')),
    'invalid_transition', '11.6 service_role: ended → active barrado'
);
reset role;

-- ---------------------------------------------------------------------------
-- 12. Gratuito prepara rascunho mas não envia
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
set local role authenticated;
insert into qa_ids values ('offer_free', public.create_offer(pg_temp.qa('biz_free'), pg_temp.payload('Água grátis QA')));
select pg_temp.check(
    (public.get_business_offer_terms(pg_temp.qa('biz_free')) -> 'fee_amount') = 'null'::jsonb,
    '12.1 Gratuito sem taxa vigente'
);
select pg_temp.expect_error(
    format('select public.accept_offer_financial_terms(%L, 1.00)', pg_temp.qa('offer_free')),
    'plan_fee_unavailable', '12.2 Gratuito não aceita condições'
);
select pg_temp.expect_error(
    format('select public.submit_offer_for_review(%L)', pg_temp.qa('offer_free')),
    'financial_terms_required', '12.3 Gratuito não envia'
);
reset role;
set local role service_role;
select pg_temp.expect_error(
    format($q$update public.offer_versions set title = 'Fora da RPC' where offer_id = %L$q$, pg_temp.qa('offer_free')),
    'direct_write_not_allowed', '12.4 service_role não edita rascunho fora da RPC'
);
reset role;

-- ---------------------------------------------------------------------------
-- 13. Rejeição permanece no histórico
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into qa_ids values ('offer_r', public.create_offer(pg_temp.qa('biz_pro'), pg_temp.payload('Oferta rejeitada QA')));
select public.accept_offer_financial_terms(pg_temp.qa('offer_r'), 1.00);
select public.submit_offer_for_review(pg_temp.qa('offer_r'));
reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.expect_error(
    format('select public.reject_offer(%L, null)', pg_temp.qa('offer_r')),
    'reason_required', '13.1 rejeição sem motivo'
);
select public.reject_offer(pg_temp.qa('offer_r'), 'Benefício não confirmado pelo negócio.');
select pg_temp.check(
    (select status = 'rejected' from public.offers where id = pg_temp.qa('offer_r')),
    '13.2 pending_review → rejected'
);
reset role;
set local role service_role;
select pg_temp.expect_error(
    format('delete from public.offers where id = %L', pg_temp.qa('offer_r')),
    'offer_not_deletable', '13.3 service_role não apaga oferta'
);
select pg_temp.expect_error(
    format('delete from public.offer_reviews where offer_id = %L', pg_temp.qa('offer_r')),
    'review_immutable', '13.4 service_role não apaga histórico'
);
reset role;

-- ---------------------------------------------------------------------------
-- 14. Negócio com histórico de ofertas não é excluído
-- ---------------------------------------------------------------------------
-- Comportamento provisório aprovado em 05/10/2026; o modelo definitivo será
-- arquivamento (ver regras, seção 14).

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select pg_temp.expect_error(
    format('select public.admin_delete_business(%L)', pg_temp.qa('biz_pro')),
    '23503', '14.1 admin_delete_business barrado por FK'
);
select pg_temp.check(
    (select count(*) = 1 from public.businesses where id = pg_temp.qa('biz_pro')),
    '14.2 negócio continua existindo'
);
reset role;

-- ---------------------------------------------------------------------------
-- 15. Negócio suspenso tira a oferta do ar
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select public.moderate_business(pg_temp.qa('biz_basic'), 'suspend', 'business_closed', null);
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.check(
    (select count(*) = 0 from public.offers where id = pg_temp.qa('offer_d')),
    '15.1 oferta de negócio suspenso some da vitrine'
);
reset role;

-- ---------------------------------------------------------------------------
-- 16. Oferta vencida some da vitrine mesmo com status active
-- ---------------------------------------------------------------------------
-- now() é fixo na transação: recua o período da v3 com a trigger de
-- imutabilidade desligada. O ALTER TABLE é desfeito no ROLLBACK.

alter table public.offer_versions disable trigger offer_versions_guard_trigger;
update public.offer_versions
   set starts_at = now() - interval '10 days', ends_at = now() - interval '1 day'
 where id = pg_temp.qa('offer_a_v3');
alter table public.offer_versions enable trigger offer_versions_guard_trigger;

select pg_temp.check(
    (select status = 'active' from public.offers where id = pg_temp.qa('offer_a')),
    '16.1 status persistido continua active'
);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.check(
    (select count(*) = 0 from public.offers where id = pg_temp.qa('offer_a'))
    and (select count(*) = 0 from public.offer_versions where offer_id = pg_temp.qa('offer_a')),
    '16.2 vencida não aparece para o visitante'
);
reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.check(
    (select count(*) = 1 from public.offers where id = pg_temp.qa('offer_a')),
    '16.3 proprietário continua vendo a própria oferta vencida'
);
reset role;

rollback;
select 'offers_qa_passed_with_rollback' as result;
