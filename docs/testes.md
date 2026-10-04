# Testes e verificações

## Execução

```bash
npm ci
npm run lint
npm test
npm run build:check
npx playwright install chromium
npm run test:e2e
```

No Linux/CI, use `npx playwright install --with-deps chromium`. `npm run test:e2e -- --project=desktop` executa somente desktop. O projeto mobile emula Pixel 7 no Chromium; não cobre Safari/iOS. Relatório em `playwright-report/index.html`; falhas retêm screenshot e trace em `test-results/`. Essas saídas não entram no Git.

## Camadas e limites

- **Vitest/Testing Library:** lógica, mapeamento, componentes, analytics e regressões de metadados. Arquivos `src/**/*.test.{js,jsx}`.
- **PGlite:** aplica todas as migrations em banco descartável e exercita grants, RLS, invariantes, transações, moderação e concorrência. Auth, Storage, Vault, cron e rede usam substitutos mínimos; não valida serviços remotos, PostgREST real ou pg-safeupdate carregado no servidor.
- **Playwright:** navegação desktop/mobile, proteção de rotas, login, cadastro em etapas, edição e moderação, erros de API e comunicação de recursos futuros. A interface real roda contra respostas simuladas em `e2e/`; asserções verificam resultados visíveis e os payloads enviados. Não comprova persistência no Supabase nem suas permissões reais.
- **Build isolado:** compila a aplicação e gera previews estáticos sem consultar o catálogo remoto. Não é artefato de publicação.

O servidor de navegador usa modo `e2e`, porta 4173 e recusa reutilizar outro servidor. Não lê `.env` e não incorpora credenciais reais. A fixture bloqueia requisições externas, recusa endpoints de API não previstos e trata exceções JavaScript como falhas.

## CI

`.github/workflows/ci.yml` executa lint, Vitest/PGlite, build isolado e Playwright em PRs para `develop`/`main` e pushes nessas branches. Usa Node 24, `npm ci`, permissões de leitura e nenhum segredo de produção. Publica relatórios de falha como artifacts.

O workflow só roda no GitHub depois de enviado ao repositório. Para impedir merges com falhas, configure o check `quality` como obrigatório nas regras de proteção das branches. Isso é uma configuração externa, não aplicada por este arquivo.

## Homologação integrada

Em 02/10/2026, cadastro, confirmação de e-mail, logout e novo login foram validados manualmente no projeto `farol-pitimbu-dev`.

Em 04/10/2026, `supabase/diagnostics/development_homologation_rollback.sql` validou no PostgreSQL hospedado de desenvolvimento: criação do perfil pelo trigger de Auth, cadastro com categoria, limite de um negócio, isolamento entre usuários, rejeição com motivo, reenvio, aprovação, alteração imediata de telefone, proposta sensível sem publicação antecipada, moderação da proposta e policies de capa pública/em revisão. O roteiro usa os papéis reais `authenticated` e `anon`, impõe timeouts e termina com `ROLLBACK`, sem deixar usuários ou dados fictícios.

Leituras pela API pública confirmaram respostas do PostgREST para categorias e negócios, recusa de endereço privado e a rota pública do Storage. O webhook de rebuild permanece ausente no desenvolvimento de propósito, portanto não há deploy disparado por essa homologação.

Ainda falta uma passagem manual da interface completa contra os serviços reais para cadastro com arquivo de imagem e moderação pelo painel. Os testes Playwright cobrem essas telas com API simulada; a homologação transacional cobre as regras e policies no servidor, mas não substitui o upload binário pelo serviço Storage.

Para interface alterada, conferir foco, teclado, contraste, textos longos e responsividade. Um teste com API simulada não substitui essa homologação.

Referências: [Playwright — servidor local](https://playwright.dev/docs/test-webserver) e [simulação de APIs](https://playwright.dev/docs/mock). Node 24 é a referência LTS adotada conforme o [calendário oficial](https://nodejs.org/en/about/previous-releases).
