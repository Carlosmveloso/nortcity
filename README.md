# Farol Pitimbu

Portal de turismo e diretório de negócios de Pitimbu, litoral sul da Paraíba. O nome do repositório é `nortcity`.

## Desenvolvimento

Use Node 24 (referência em `.nvmrc`) e npm.

```bash
nvm install
nvm use
npm ci
```

Em um clone novo, copie `.env.example` para `.env.development.local` e configure um **projeto Supabase de desenvolvimento** antes de testar escritas. Preserve os `.env` existentes e confira o destino: esta cópia já foi usada com produção. Veja [ambientes](docs/ambientes.md).

```bash
npm run dev
```

Abra `http://localhost:5173`. Sem Supabase configurado, páginas estáticas carregam, mas autenticação e catálogo não funcionam. EmailJS é opcional para desenvolvimento e necessário para envio real de contato.

## Verificações

```bash
npm run lint
npm test
npm run build:check
npx playwright install chromium
npm run test:e2e
```

`npm test` inclui utilitários, componentes e migrations/RLS em PGlite descartável. Os testes de navegador usam Chromium em desktop e mobile, com API simulada e sem acesso ao Supabase real. Detalhes e limites em [docs/testes.md](docs/testes.md).

`build:check` ignora arquivos de ambiente e gera uma compilação isolada em `dist-check/`, sem catálogo de negócios. **Não use esse resultado para publicação.**

Para o build completo, configure as variáveis do destino e execute:

```bash
npm run build
npm run preview
```

Esse build consulta negócios públicos e baixa capas do Supabase para gerar sitemap, imagens Open Graph e HTML de compartilhamento em `dist/`. Precisa de rede; não altera dados nem faz deploy. Ao navegar no preview, a aplicação usa as credenciais incorporadas ao build.

## Stack e estrutura

- React 19, Vite 8, JavaScript/JSX com JSDoc e React Router 7.
- Tailwind CSS 4; tokens de cor e tipografia em `src/index.css`.
- Supabase: PostgreSQL, RLS, RPCs, autenticação por e-mail/senha e Storage.
- Leaflet/react-leaflet, Lucide, EmailJS e integrações de métricas Vercel.
- Vitest, Testing Library, PGlite e Playwright.

`src/pages/` contém rotas; `components/`, interface reutilizável; `hooks/` e `lib/`, acesso a dados e lógica compartilhada. `supabase/migrations/` contém o histórico SQL. `scripts/` contém geradores de previews e ferramentas operacionais. O catálogo vem do banco; `src/data/` contém curadoria e apresentação.

## Estado da implementação

O código inclui catálogo e busca, perfil público, cadastro, autenticação, Meu Negócio, edição com moderação, gestão administrativa, upload de capa, analytics administrativo e republicação solicitada pelo banco. A presença no código não comprova configuração ou aplicação em produção.

Favoritos por conta estão implementados e homologados no desenvolvimento, com migration incremental aplicada em desenvolvimento e produção. Assinaturas/cobrança, galeria comercial, avaliações e Google OAuth ainda não estão implementados. A interface identifica recursos futuros sem oferecer contratação de planos inexistentes.

## Documentação e colaboração

- [AGENTS.md](AGENTS.md): instruções compartilhadas para agentes.
- [Contexto](docs/farol-pitimbu-contexto.md): arquitetura, estado atual e futuro.
- [Regras de negócio](docs/regras-de-negocio.md): autorização, propriedade, moderação e edição.
- [Ambientes](docs/ambientes.md): configuração e publicação.
- [Testes](docs/testes.md): execução, cobertura e limites.
- [Histórico](docs/historico/README.md): decisões e incidentes preservados.

O fluxo usa branches de trabalho a partir de `develop`, Conventional Commits e PRs para `develop`; `main` é a branch de publicação. O workflow de CI roda lint, testes, build isolado e navegador sem segredos de produção. Tornar os checks obrigatórios depende das regras de proteção configuradas no GitHub.

Responsável: Carlos Eduardo Mveloso — carloseduardomveloso@gmail.com.
