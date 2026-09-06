-- Criar tabelas via CLI/migrations (em vez do Table Editor do dashboard, que
-- concede privilégios automaticamente) não concede GRANTs de base para
-- anon/authenticated. RLS só restringe LINHAS; sem o GRANT a operação inteira
-- é negada antes mesmo de avaliar as policies — por isso /explorar retornava
-- 0 negócios mesmo com 78 linhas 'active' no banco.

grant usage on schema public to anon, authenticated;

grant select on public.categories to anon, authenticated;

grant select on public.businesses to anon;
grant select, insert, update on public.businesses to authenticated;

grant select on public.business_categories to anon;
grant select, insert, update, delete on public.business_categories to authenticated;

grant select, update on public.profiles to authenticated;

grant select on public.user_roles to authenticated;
