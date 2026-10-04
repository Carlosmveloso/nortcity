# Farol Pitimbu — orientações de desenvolvimento

O repositório `nortcity` contém o Farol Pitimbu, portal de turismo e diretório de negócios de Pitimbu/PB.

## Implementação e convenções

- React 19, Vite 8, JavaScript/JSX com JSDoc, Tailwind CSS 4 e React Router 7. Use npm e preserve `package-lock.json`; Node 24 é a referência em `.nvmrc` e CI.
- Componentes em PascalCase, hooks em `src/hooks/`, integrações em `src/integrations/` e utilitários em `src/lib/`. Alias `@/` aponta para `src/`.
- Reutilize os componentes existentes. Não pressuponha TypeScript, shadcn/ui, React Query ou `tailwind.config.js`: não fazem parte da stack atual. Tokens visuais vivem em `src/index.css`.
- Preserve a direção visual, acessibilidade, responsividade e decisões de produto aprovadas. Separe comportamento atual de propostas e roadmap.
- Leia apenas os documentos relevantes: [contexto](docs/farol-pitimbu-contexto.md), [regras de negócio](docs/regras-de-negocio.md), [ambientes](docs/ambientes.md) e [testes](docs/testes.md). `docs/historico/` e o plano de migração de 06/09 são registros, não instruções atuais.

## Banco e publicação

- Confira o ambiente antes de qualquer escrita. Os arquivos locais existentes podem apontar para produção. Não teste formulários ou RPCs de escrita nesse destino.
- Não execute reset, seed, migration, alteração de dados reais ou deploy sem autorização para essa operação. Prepare migrations incrementais; preserve as existentes.
- Escritas de negócios e suas categorias passam por RPCs. RLS, grants, constraints e triggers são a autoridade; a proteção de rota não substitui autorização no banco.
- Preserve um negócio por proprietário, de uma a três categorias com uma principal e os estados `pending`, `active`, `rejected`, `suspended`. Consulte as regras antes de alterar transições ou campos editáveis.
- Catálogo vem do Supabase. `src/data/` contém curadoria/apresentação, não uma cópia autoritativa de negócios.
- O build de publicação consulta negócios ativos e capas para sitemap e prévias. `build:check` é isolado e não gera o catálogo de produção; não publique esse artefato.
- Nunca exponha `.env*`, tokens, service role ou URLs de deploy hooks. `.env.example` contém apenas nomes e valores de exemplo.

## Validação e entrega

- `npm run lint` e `npm test` verificam código e regras de banco em PGlite descartável.
- Para mudanças de interface/fluxo, execute `npm run test:e2e` e confira desktop/mobile. Os testes de navegador usam API simulada; não validam os serviços Supabase reais.
- `npm run build:check` valida a compilação sem ler `.env` nem consultar produção. `npm run build` valida também as prévias com as credenciais do ambiente e exige rede.
- Reporte alterações, verificações, limites e ações pendentes no destino. Não declare produção validada por teste local.
- Preserve alterações existentes. O fluxo usa branches de trabalho a partir de `develop` e PR para `develop`; `main` é a branch de publicação. Commits seguem Conventional Commits.
