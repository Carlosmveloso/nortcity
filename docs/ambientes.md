# Ambientes e publicação

## Desenvolvimento e credenciais

Os documentos e comentários anteriores registram que `.env` local aponta para produção. Não trate `localhost` como prova de banco isolado. Os arquivos privados existentes foram preservados durante a preparação para o Codex.

Para desenvolvimento integrado, use um projeto Supabase separado, com dados fictícios, e coloque URL e chave pública em `.env.development.local`, partindo de `.env.example`. Antes de criá-lo, confira custos e quem administrará o projeto. Provisionamento remoto e aplicação de migrations não são executados pelos comandos de teste.

O Vite considera os arquivos do modo (`.env.development.local` no dev, `.env.production.local` no build), além de `.env`/`.env.local`; variáveis já exportadas no shell têm precedência. Confira o destino efetivo sem imprimir segredos. Não copie a service role para variáveis `VITE_*`, pois elas entram no JavaScript público.

- Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Contato: `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`. Deixe vazias em testes sem envio real.
- Métricas: `VITE_ANALYTICS_ENABLED=false` em desenvolvimento e previews de QA. Sem valor, o código habilita o analytics próprio em builds de produção.

Para confirmação de cadastro, redirects e diagnóstico de login, consulte [autenticacao.md](autenticacao.md). O destino hospedado precisa permitir o retorno definido no front-end.

Os modos `ci` e `e2e` ignoram arquivos `.env`, não expõem as variáveis `VITE_*` do shell e fixam destino Supabase em loopback com chave fictícia. EmailJS e analytics próprio ficam desabilitados. O Playwright bloqueia rede externa, inclusive integrações de telemetria, e simula os endpoints usados pelos testes. Esse modo não é um ambiente de homologação real.

## Banco separado

Preparado e conferido em 02/10/2026: projeto `farol-pitimbu-dev`, configuração local em `.env.development.local` e vínculo da CLI nesse destino. As 31 migrations existentes foram aplicadas, com `pg_net` e `pg_cron` habilitados; RLS de profiles/user_roles/businesses e trigger de cadastro foram conferidos. Nenhum catálogo ou segredo de deploy foi copiado. O usuário validou confirmação e novo login.

Em 04/10/2026, a homologação transacional hospedada cobriu cadastro, moderação, edição, propostas e policies de Storage com rollback. Consulte [testes.md](testes.md). O upload binário pela interface e a moderação manual pelo painel ainda são verificações humanas pendentes.

Ainda em 04/10/2026, a migration `20261004000001_account_favorites.sql` foi aplicada exclusivamente em `farol-pitimbu-dev` (32 migrations). O roteiro `favorites_homologation_rollback.sql` passou no servidor hospedado, sem manter os dados fictícios. Para publicar esta funcionalidade, aplicar a migration incremental no destino confirmado antes de promover o front-end para `main`; a homologação em desenvolvimento não comprova aplicação em produção.

Em 05/10/2026, após autorização de publicação, a mesma migration foi aplicada em produção. O destino foi confirmado contra o cliente do site público e o dry-run identificou apenas essa migration pendente. Foram conferidos o registro no histórico, RLS habilitado, três policies, duas referências com cascata e a ausência de SELECT para `anon` e UPDATE para `authenticated`. A API pública recusou a leitura anônima com HTTP 401/código 42501. O vínculo local da CLI e o ambiente de desenvolvimento permanecem no projeto separado. Essa verificação em produção foi de schema e leitura, sem usuários fictícios ou testes de escrita de favoritos.

Em 05/10/2026, as migrations de ofertas e planos mínimos (`20261005000001` a `20261005000003`) foram aplicadas exclusivamente em `farol-pitimbu-dev` (35 migrations) e homologadas com os roteiros de ROLLBACK e de concorrência ([testes.md](testes.md)). Produção não recebeu essas migrations, e a interface de ofertas ainda não existe.

Em 06/10/2026, o E2E real da interface de ofertas rodou contra `farol-pitimbu-dev`, com duas contas fictícias e um negócio de ids reservados `74000000-…`, removidos em seguida por `offers_e2e_dev_cleanup.sql`. Nenhuma migration nova foi aplicada para o frontend.

Ainda em 06/10/2026, a migration `20261006000001_offer_lifecycle_jobs.sql` (job `offer-lifecycle`) foi aplicada exclusivamente em `farol-pitimbu-dev`, depois de dry-run que listou só ela (36 migrations). O job `pg_cron` fica ativo nesse projeto a cada 5 minutos. Produção não recebeu esta migration; ao publicar, aplique as migrations de ofertas na ordem e confirme `cron.job` com `offer-lifecycle` ativo.

Cupons, 06/10/2026, só em `farol-pitimbu-dev`:
- Criado no Vault o segredo `coupon_qr_key_v1`: 64 caracteres hexadecimais gerados dentro do banco, nunca impressos nem copiados.
- Dry-run e aplicação da migration `20261007000001_coupons.sql` (37 migrations). O job `coupon-expiration` ficou ativo a cada 5 minutos.
- O segredo continua no dev, porque a geração depende dele. Produção não recebeu a migration nem o segredo.

**Ordem para publicar ofertas e cupons em produção** (quando autorizado):
1. Aplicar, com dry-run e no destino confirmado: `20261005000001_plans`, `20261005000002_offers`, `20261005000003_offer_rpcs`, `20261006000001_offer_lifecycle_jobs` e `20261007000001_coupons`.
2. Antes de liberar a geração, criar o segredo próprio de produção: `select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'coupon_qr_key_v1', '…');`. Não reutilizar o do dev. Sem ele, a geração recusa com `qr_key_unavailable`.
3. Conferir em `cron.job` que `offer-lifecycle` e `coupon-expiration` estão ativos, conferir os grants (seção 0 dos roteiros de homologação) e só então publicar o front-end.

Rotação de chave: criar `coupon_qr_key_v2`. Os cupons antigos continuam verificáveis enquanto `coupon_qr_key_v1` existir.

Para preparar outro ambiente:

1. Selecionar/criar o projeto de desenvolvimento, sem reutilizar dados pessoais de produção.
2. Conferir extensões exigidas nas migrations (`pg_net`, `pg_cron` e Vault, além das básicas), habilitar o necessário e aplicar o histórico incremental no destino confirmado.
3. Configurar Auth e redirects para localhost/preview; criar contas fictícias de usuário e admin.
4. Conferir policies de Storage e executar os fluxos integrados descritos em [testes.md](testes.md).
5. Manter o segredo `vercel_deploy_hook` ausente no ambiente de desenvolvimento. Sem ele, `fire_site_rebuild()` não dispara deploy. Não copiar o hook de produção.

A alternativa com Supabase local exige Docker e validação das extensões. O PGlite da suíte não substitui a stack completa nem exige Docker.

## Build e publicação

- `npm run build:check`: compilação isolada em `dist-check/`, sem catálogo remoto, sem publicar. Serve para CI.
- `npm run build`: usa as credenciais configuradas, lê negócios públicos e capas e gera `dist/`. O banco é a fonte única do catálogo para sitemap e previews. Falhas na consulta interrompem o build.
- `npm run preview`: serve o último `dist/`; requisições da interface usam o ambiente incorporado naquele build. Desabilite analytics próprio no build de QA e use banco separado antes de testar escritas.

A configuração versionada não comprova os ajustes do painel Vercel/Supabase. O fluxo documentado usa `main` para publicação e `develop` para desenvolvimento. Verifique o destino do preview e suas variáveis antes de usá-lo.

A republicação automática depende de `site_rebuild`, `fire_site_rebuild()`, pg_cron, pg_net e segredo Vault `vercel_deploy_hook`. As migrations de 18/09 e 23/09 registram a lógica e a correção de UPDATE com WHERE. O procedimento original permanece em `historico/guia-claude-2026-09.md`, seção 11. Não habilite esse mecanismo contra produção durante QA.

Para mudanças de banco: prepare migration incremental e teste no PGlite; depois confira o histórico aplicado e valide no ambiente separado. Qualquer execução em produção ou deploy deve fazer parte de uma operação explicitamente autorizada.
