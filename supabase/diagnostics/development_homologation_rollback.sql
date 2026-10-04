-- Homologação integrada do schema hospedado de desenvolvimento.
--
-- Executa fluxos reais sob os papéis `authenticated` e `anon`, mas envolve
-- tudo em uma transação encerrada com ROLLBACK. Não use em produção.

begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

create temp table qa_state (
    business_id uuid,
    request_id uuid
);
grant all on table qa_state to authenticated;
grant select on table qa_state to anon;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
    if not coalesce(p_condition, false) then
        raise exception 'qa_assertion_failed: %', p_message;
    end if;
end;
$$;
grant execute on function pg_temp.assert_true(boolean, text) to authenticated, anon;

-- Usuários descartáveis. O trigger real cria profiles e a role user.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
    ('10000000-0000-4000-8000-000000000001', 'owner.qa@example.test', now(), '{"full_name":"Owner QA"}', now(), now()),
    ('10000000-0000-4000-8000-000000000002', 'other.qa@example.test', now(), '{"full_name":"Other QA"}', now(), now()),
    ('10000000-0000-4000-8000-000000000003', 'admin.qa@example.test', now(), '{"full_name":"Admin QA"}', now(), now());

insert into public.user_roles (user_id, role)
values ('10000000-0000-4000-8000-000000000003', 'admin');

insert into public.categories (id, name, slug, order_index)
values ('20000000-0000-4000-8000-000000000001', 'Categoria QA', 'categoria-qa', 999);

create or replace function pg_temp.owner_submits()
returns void language plpgsql as $$
declare
    v_business uuid;
    v_second_blocked boolean := false;
begin
    v_business := public.submit_business(
        jsonb_build_object(
            'name', 'Negócio QA',
            'description', 'Cadastro descartável para homologação integrada.',
            'service_area', 'Pitimbu e região',
            'phone', '83999999999'
        ),
        array['20000000-0000-4000-8000-000000000001'::uuid],
        '20000000-0000-4000-8000-000000000001'::uuid
    );

    insert into qa_state (business_id) values (v_business);
    perform pg_temp.assert_true(
        (select status = 'pending' and owner_id = auth.uid()
           from public.businesses where id = v_business),
        'cadastro deveria entrar pendente e pertencer ao usuário'
    );
    perform pg_temp.assert_true(
        (select count(*) = 1 and bool_and(is_primary)
           from public.business_categories where business_id = v_business),
        'cadastro deveria ter exatamente uma categoria principal'
    );

    begin
        perform public.submit_business(
            '{"name":"Segundo negócio QA","service_area":"Pitimbu","phone":"83988888888"}'::jsonb,
            array['20000000-0000-4000-8000-000000000001'::uuid],
            '20000000-0000-4000-8000-000000000001'::uuid
        );
    exception when others then
        v_second_blocked := position('business_limit_reached' in sqlerrm) > 0;
    end;
    perform pg_temp.assert_true(v_second_blocked, 'segundo negócio do mesmo proprietário deveria ser recusado');
end;
$$;
grant execute on function pg_temp.owner_submits() to authenticated;

create or replace function pg_temp.other_is_blocked()
returns void language plpgsql as $$
declare
    v_blocked boolean := false;
begin
    begin
        perform public.update_own_business(
            (select business_id from qa_state),
            '{"phone":"83977777777"}'::jsonb
        );
    exception when others then
        v_blocked := position('forbidden' in sqlerrm) > 0;
    end;
    perform pg_temp.assert_true(v_blocked, 'outro usuário não deveria editar o cadastro');
    perform pg_temp.assert_true(
        (select count(*) = 0 from public.businesses where id = (select business_id from qa_state)),
        'outro usuário não deveria ler cadastro pendente'
    );
end;
$$;
grant execute on function pg_temp.other_is_blocked() to authenticated;

create or replace function pg_temp.admin_rejects()
returns void language plpgsql as $$
begin
    perform public.moderate_business(
        (select business_id from qa_state),
        'reject',
        'insufficient_information',
        'observação interna QA'
    );
    perform pg_temp.assert_true(
        (select status = 'rejected' and moderation_reason = 'insufficient_information'
           from public.businesses where id = (select business_id from qa_state)),
        'admin deveria rejeitar com motivo estruturado'
    );
end;
$$;
grant execute on function pg_temp.admin_rejects() to authenticated;

create or replace function pg_temp.owner_resubmits()
returns void language plpgsql as $$
begin
    perform public.resubmit_business((select business_id from qa_state));
    perform pg_temp.assert_true(
        (select status = 'pending' and moderation_reason is null
           from public.businesses where id = (select business_id from qa_state)),
        'proprietário deveria reenviar rejeitado para análise'
    );
end;
$$;
grant execute on function pg_temp.owner_resubmits() to authenticated;

create or replace function pg_temp.admin_approves()
returns void language plpgsql as $$
begin
    perform public.moderate_business((select business_id from qa_state), 'approve');
    perform pg_temp.assert_true(
        (select status = 'active' from public.businesses where id = (select business_id from qa_state)),
        'admin deveria aprovar cadastro válido'
    );
end;
$$;
grant execute on function pg_temp.admin_approves() to authenticated;

create or replace function pg_temp.owner_edits_active()
returns void language plpgsql as $$
declare
    v_request uuid;
    v_cover_blocked boolean := false;
begin
    perform public.update_own_active_business(
        (select business_id from qa_state),
        '{"phone":"83966666666"}'::jsonb
    );
    perform pg_temp.assert_true(
        (select phone = '83966666666' from public.businesses where id = (select business_id from qa_state)),
        'telefone deveria publicar imediatamente'
    );

    v_request := public.request_business_changes(
        (select business_id from qa_state),
        '{"name":"Negócio QA revisado"}'::jsonb
    );
    update qa_state set request_id = v_request;
    perform pg_temp.assert_true(
        (select name = 'Negócio QA' from public.businesses where id = (select business_id from qa_state)),
        'nome público deveria permanecer até a moderação'
    );

    begin
        insert into storage.objects (bucket_id, name, owner_id)
        values (
            'business-photos',
            (select business_id from qa_state)::text || '/cover.jpg',
            auth.uid()::text
        );
    exception when others then
        v_cover_blocked := true;
    end;
    perform pg_temp.assert_true(v_cover_blocked, 'dono de negócio ativo não deveria sobrescrever a capa pública');

    insert into storage.objects (bucket_id, name, owner_id)
    values (
        'business-photos',
        (select business_id from qa_state)::text || '/review/qa.jpg',
        auth.uid()::text
    );
    perform pg_temp.assert_true(
        (select count(*) = 1 from storage.objects where name = (select business_id from qa_state)::text || '/review/qa.jpg'),
        'dono deveria gravar uma capa em revisão'
    );
end;
$$;
grant execute on function pg_temp.owner_edits_active() to authenticated;

create or replace function pg_temp.admin_approves_change()
returns void language plpgsql as $$
begin
    perform public.review_business_change_request((select request_id from qa_state), 'approve');
    perform pg_temp.assert_true(
        (select name = 'Negócio QA revisado' from public.businesses where id = (select business_id from qa_state)),
        'aprovação deveria aplicar o nome proposto'
    );
end;
$$;
grant execute on function pg_temp.admin_approves_change() to authenticated;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.owner_submits();
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.other_is_blocked();
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.admin_rejects();
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.owner_resubmits();
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.admin_approves();
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.owner_edits_active();
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true(
    (select count(*) = 0 from storage.objects
      where name = (select business_id from qa_state)::text || '/review/qa.jpg'),
    'outro usuário não deveria ler capa em revisão'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.admin_approves_change();
reset role;

set local role anon;
select pg_temp.assert_true(
    (select count(*) = 1 from public.businesses
      where id = (select business_id from qa_state) and status = 'active'),
    'negócio aprovado deveria ser público'
);
reset role;

select
    'passed' as result,
    31 as migrations_expected,
    'cadastro, RLS, moderação, edição, proposta e storage validados com rollback' as coverage;

rollback;
