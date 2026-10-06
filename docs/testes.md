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

Favoritos de 04/10/2026: `src/test/db/favorites.test.js` cobre grants, RLS entre usuário/admin/anon, inserção somente de ativos, duplicatas, suspensão e cascatas. Testes da integração cobrem paginação e filtro de status; testes do provider cobrem gravação, falha, cliques repetidos, logout e respostas atrasadas após troca de conta. `e2e/favorites.spec.js` cobre coração no card/ficha, persistência simulada após reload, teclado, carregamento/erro/vazio, lista apenas de ativos e retorno do login com filtros em desktop/mobile.

`supabase/diagnostics/favorites_homologation_rollback.sql` passou no projeto hospedado `farol-pitimbu-dev` depois da migration incremental. Usa os papéis reais para testar isolamento, duplicatas, bloqueio de escrita alheia/UPDATE, suspensão, remoção e cascatas, encerrando com rollback. Não cria sessões nem substitui uma passagem manual pela interface com Auth/PostgREST reais. Os testes de navegador continuam usando a API simulada.

Em 05/10/2026, a publicação dos favoritos foi validada pelo check `quality` no GitHub: lint, 331 testes Vitest/PGlite, build isolado e 44 E2E desktop/mobile. A migration foi aplicada em produção após dry-run e conferência do destino, com verificação de catálogo (RLS, policies, grants, cascatas e histórico) e bloqueio de leitura anônima pelo PostgREST real. O roteiro de homologação com usuários fictícios foi executado somente no desenvolvimento.

Ofertas de 05/10/2026: `src/test/db/offers.test.js` cobre os 15 cenários obrigatórios da Sprint 1 (criação, autorização, aceite financeiro, constraints, transições protegidas, ajustes, reenvio, aprovação, publicação, agendamento, limite do plano, suspensão, encerramento e versionamento), além da troca de plano, do RLS de visitantes e colunas, do histórico só de inclusão e da recusa de gravações válidas feitas fora das RPCs (inclusive por `service_role` e depois de uma RPC na mesma transação). A concorrência na ativação é serializada pelo bloqueio do negócio, mas o PGlite tem uma conexão só e não exercita duas ativações simultâneas.

Homologação de ofertas em `farol-pitimbu-dev`:
- `supabase/diagnostics/offers_homologation_rollback.sql` roda tudo em uma transação com ROLLBACK, sob `authenticated`, `anon` e `service_role`. Começa pelos grants efetivos, porque o Supabase concede privilégios padrão que o PGlite não reproduz. Depois cobre autorização, aceite, imutabilidade, RPC administrativa chamada pelo proprietário, transições inválidas por `service_role`/`postgres`, ajustes e reenvio, publicação, colunas de vitrine, revisão com a versão anterior no ar, agendamento e cancelamento, limite e troca de plano, suspensão e encerramento, Gratuito, rejeição, exclusão de negócio com histórico, negócio suspenso e oferta vencida com status `active`. Como `now()` é fixo na transação, o caso da oferta vencida recua o período com a trigger de imutabilidade desligada dentro da mesma transação, o que trava `offer_versions` até o ROLLBACK.
- `offers_concurrency_setup.sql` grava uma massa marcada (`73000000-…`) e descreve dois cenários em duas sessões `psql`: duas ativações simultâneas no mesmo negócio e troca de plano concorrente com publicação. `offers_concurrency_cleanup.sql` remove a massa desligando as guards só dentro da própria transação.
- Os três roteiros passaram em ensaio no PGlite (os cenários de concorrência foram executados em sequência). Isso confere sintaxe e lógica, não o comportamento do Supabase hospedado.

Execução de 05/10/2026 no projeto hospedado `farol-pitimbu-dev`. Antes, conferimos que o vínculo da CLI e `.env.development.local` apontavam para esse projeto, e o dry-run listou somente as três migrations; produção não foi tocada.
- **Migrations:** aplicadas com `supabase db push`.
- **ROLLBACK:** `offers_homologation_rollback.sql`, executado com `supabase db query --linked`, terminou em `offers_qa_passed_with_rollback`. Depois, a contagem foi zero em ofertas, versões, histórico, planos atribuídos, usuários e categorias QA, com as três triggers de guarda habilitadas.
- **Concorrência:** sem senha do banco para duas sessões `psql`, cada sessão foi uma chamada separada da Management API, em paralelo. A sessão A segurava a transação com `pg_sleep(25)`. A sessão B só chamava `publish_offer` depois de ver A dormindo em `pg_stat_activity` e mediu a própria espera dentro do banco.
  - Cenário 1 (Básico, duas ativações): B esperou 22,8 s, retornou 3 ms depois do commit de A e recebeu `plan_offer_limit_reached`.
  - Cenário 2 (troca para Profissional concorrente com publicação): B esperou 22,7 s, retornou 6 ms depois do commit de A e ativou a oferta, já enxergando o plano novo.
  - Uma primeira tentativa do cenário 1 sem essa sincronização deu o resultado esperado, mas não provava sobreposição. Ela foi repetida com uma terceira oferta da mesma massa.
  - Na sessão B, a RPC foi chamada a partir de `postgres` com o JWT simulado do admin; a função é `SECURITY DEFINER`, então o bloqueio é o mesmo.
- **Limpeza:** `offers_concurrency_cleanup.sql` removeu toda a massa `73000000-…`, e a conferência posterior não encontrou resíduos.

Interface de ofertas, 06/10/2026:
- **Vitest:** `src/lib/offerForm.test.js` e `src/lib/offers.test.js` cobrem o payload e as datas no fuso de Pitimbu, a validação espelhando as constraints, os horários, a escolha explícita de limite, os resumos e a tradução dos erros (sem expor códigos). Total da suíte: 382.
- **Playwright com API simulada:** `e2e/offers.spec.js` usa `e2e/offersMock.js`, que reproduz as regras das RPCs. Roda em desktop e mobile e cobre:
  - proprietário: estado vazio, assistente em 4 passos com validação por etapa, rascunho retomado, Gratuito sem envio, taxa vinda do plano, aceite obrigatório, envio, versão em análise bloqueada, ajustes com nova versão e novo aceite, clique duplo sem operação duplicada, alteração de oferta ativa e acesso negado ao admin;
  - admin: fila, análise, ajustes e rejeição com motivo, aprovação, publicação, agendamento, suspensão, limite do plano traduzido na reativação, encerramento definitivo, Esc no diálogo e atribuição de plano;
  - sem rolagem horizontal nas telas principais.
  
  Suíte completa: 76 testes passando, duas execuções seguidas.
- **E2E real (`npm run test:e2e:dev`, `playwright.dev.config.js` + `e2e-dev/`):** roda contra `farol-pitimbu-dev` com Auth, PostgREST, RLS e RPCs reais.
  - A configuração lê o destino de `.env.development.local` e recusa rodar se ele coincidir com o de produção. A fixture aborta qualquer requisição fora do projeto de desenvolvimento e falha se houver chamada a produção.
  - Massa: `supabase/diagnostics/offers_e2e_dev_setup.sql`, com o placeholder `__E2E_PASSWORD__` substituído por uma senha aleatória fora do repositório e passada em `E2E_DEV_PASSWORD`. Limpeza: `offers_e2e_dev_cleanup.sql`.
  - Execução de 06/10/2026, desktop (1440 px) e mobile (Pixel 7), ambos aprovados. O proprietário criou a oferta pelos 4 passos, aceitou e enviou; o admin pediu ajustes; o proprietário criou a versão 2 com novo aceite e reenviou; o admin aprovou e publicou.
  - Conferido no banco: oferta `active`, versão 1 `changes_requested` e versão 2 publicada, cada uma com a taxa de R$ 1,00 aceita, e histórico submitted → changes_requested → resubmitted → approved → published.
  - Pela API pública com a chave anônima: só a versão publicada aparece; `select=*` responde 401 e `fee_amount` responde 42501.
  - Uma primeira execução em desktop completou o fluxo, mas falhou numa asserção do próprio teste (texto do histórico), corrigida em seguida. A limpeza removeu as três ofertas e toda a massa, sem resíduos e com as triggers reabilitadas.
- **Ainda não coberto:** leitores de tela reais e Safari/iOS.

Job `offer-lifecycle`, 06/10/2026:
- **Vitest/PGlite:** `src/test/db/offer-lifecycle.test.js` cobre:
  - cron registrado (`*/5 * * * *`) e funções sem grant;
  - limites de fuso: 23:59:59 da véspera em UTC−3 não ativa, 00:00 ativa, 23:59:58 do último dia segue ativa e 23:59:59 encerra;
  - `active`, `suspended`, `scheduled` e `approved` vencidas encerradas, com os demais estados e históricos intactos;
  - agendada vencida vai direto para `ended`, sem `published`;
  - plano sem vaga mantém `scheduled` sem criar histórico e ativa quando a vaga abre;
  - o sinal de escrita não sobra depois do job.
- **Playwright:** "Sistema" no histórico e o aviso "Aguardando vaga no plano" para admin e proprietário. Suíte: 80 testes.
- **ROLLBACK em `farol-pitimbu-dev`:** `supabase/diagnostics/offers_lifecycle_homologation_rollback.sql` terminou em `offers_lifecycle_qa_passed_with_rollback`.
- **Cron real em `farol-pitimbu-dev`:** com a massa `74000000-…` de `offers_e2e_dev_setup.sql`, uma oferta foi publicada como `scheduled` às 14:12:06 UTC (11:12:06 em Pitimbu), com início às 14:14:06 UTC (11:14:06) e fim às 14:20:06 UTC (11:20:06). O monitoramento consultou o banco a cada minuto.

  | Execução do cron | UTC | Pitimbu (UTC−3) | Resultado |
  |---|---|---|---|
  | 1ª | 14:15:00 | 11:15:00 | `scheduled → active`, histórico `published` sem autor (Sistema) |
  | 2ª | 14:20:00 | 11:20:00 | continua `active` (fim às 14:20:06) |
  | 3ª | 14:25:00 | 11:25:00 | `active → ended`, histórico `ended` sem autor, "Período da oferta encerrado" |
  | 4ª | 14:30:00 | 11:30:00 | nada muda; histórico continua com 5 eventos, sem duplicação |

  As quatro execuções aparecem como `succeeded` em `cron.job_run_details`. Depois, `offers_e2e_dev_cleanup.sql` removeu a massa sem resíduos, com as triggers de guarda reabilitadas e `offer-lifecycle` ainda ativo.

Ainda falta uma passagem manual da interface completa contra os serviços reais para cadastro com arquivo de imagem e moderação pelo painel. Os testes Playwright cobrem essas telas com API simulada; a homologação transacional cobre as regras e policies no servidor, mas não substitui o upload binário pelo serviço Storage.

Para interface alterada, conferir foco, teclado, contraste, textos longos e responsividade. Um teste com API simulada não substitui essa homologação.

Referências: [Playwright — servidor local](https://playwright.dev/docs/test-webserver) e [simulação de APIs](https://playwright.dev/docs/mock). Node 24 é a referência LTS adotada conforme o [calendário oficial](https://nodejs.org/en/about/previous-releases).
