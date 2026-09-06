-- Escrita direta em businesses/business_categories sai do alcance do
-- PostgREST: toda alteração passa pelas RPCs, que validam autorização,
-- invariantes de categoria e concorrência numa transação só.
--
-- Sem isto, o guard da migration 0005 seria a única barreira contra um cliente
-- montando um PATCH à mão — e o guard não tem como garantir "de uma a três
-- categorias" nem atomicidade entre as duas tabelas.
revoke insert, update on public.businesses from authenticated;
revoke insert, update, delete on public.business_categories from authenticated;

-- Leitura continua direta: RLS já limita anon a negócios ativos e o dono ao
-- próprio cadastro.
grant select on public.businesses to anon, authenticated;
grant select on public.business_categories to anon, authenticated;

-- Funções internas não são endpoint: só as RPCs abaixo ficam expostas.
revoke execute on function public.farol_error(text, text) from public;
revoke execute on function public.apply_business_payload(public.businesses, jsonb, text[]) from public;
revoke execute on function public.set_business_categories(uuid, uuid[], uuid) from public;
revoke execute on function public.assert_business_minimums(public.businesses, boolean, boolean) from public;
revoke execute on function public.assert_business_categories(uuid) from public;
revoke execute on function public.generate_business_slug(text) from public;
revoke execute on function public.find_duplicate_candidates(uuid) from public;

grant execute on function public.submit_business(jsonb, uuid[], uuid, text, numeric, numeric) to authenticated;
grant execute on function public.update_own_business(uuid, jsonb, uuid[], uuid) to authenticated;
grant execute on function public.resubmit_business(uuid) to authenticated;
grant execute on function public.set_business_cover_image(uuid, text) to authenticated;
grant execute on function public.update_own_active_business(uuid, jsonb) to authenticated;
grant execute on function public.request_business_changes(uuid, jsonb, uuid[], uuid, text) to authenticated;
grant execute on function public.cancel_business_change_request(uuid) to authenticated;

grant execute on function public.moderate_business(uuid, text, business_moderation_reason, text) to authenticated;
grant execute on function public.admin_create_business(jsonb, uuid[], uuid, business_status) to authenticated;
grant execute on function public.admin_update_business(uuid, jsonb, uuid[], uuid) to authenticated;
grant execute on function public.admin_delete_business(uuid) to authenticated;
grant execute on function public.admin_link_business_owner(uuid, uuid) to authenticated;
grant execute on function public.admin_unlink_business_owner(uuid) to authenticated;
grant execute on function public.admin_resolve_duplicate(uuid, uuid) to authenticated;
grant execute on function public.admin_mark_duplicate_reviewed(uuid) to authenticated;
grant execute on function public.review_business_change_request(uuid, text, text, text) to authenticated;

grant execute on function public.search_businesses(text, text, text, text, int, int) to anon, authenticated;
grant execute on function public.business_neighborhoods() to anon, authenticated;
grant execute on function public.normalize_search(text) to anon, authenticated;

-- Bug encontrado pelos testes de RLS: a migration 0009 concedeu apenas SELECT
-- em `categories`, então o CRUD de categorias do painel admin nunca funcionou
-- de verdade — a policy `categories_admin_write` existia, mas o Postgres nega
-- a operação antes de avaliar policy quando falta o GRANT. É exatamente a
-- lição registrada no CLAUDE.md, repetida numa tabela que passou despercebida.
grant insert, update, delete on public.categories to authenticated;
