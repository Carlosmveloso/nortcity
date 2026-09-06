# Farol Pitimbu

> O guia digital do litoral sul da Paraíba — Portal de turismo + diretório de negócios locais.

## 🚀 Quick Start

### Setup
```bash
git clone https://github.com/Carlosmveloso/nortcity.git
cd nortcity
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Acessa em `http://localhost:5173/`.

> Sem as variáveis do Supabase preenchidas, o app carrega mas `/explorar`, `/negocio/:slug` e login/cadastro não funcionam (ver `.env.example`).

### Build e testes
```bash
npm run build
npm run preview
npm run lint
npm run test        # Vitest (unitários)
```

## 📚 Documentação

- **[CLAUDE.md](./CLAUDE.md)** — Guia de desenvolvimento, convenções, fluxo de Git e boas práticas.
- **[docs/farol-pitimbu-contexto.md](./docs/farol-pitimbu-contexto.md)** — Especificação completa do projeto (requisitos, fluxos, modelagem, roadmap, stack).

## 🛠 Tech Stack

- **Frontend:** React 19 + Vite 8 + JavaScript (sem TypeScript — tipagem leve via JSDoc)
- **Styling:** Tailwind CSS v4
- **Backend:** Supabase — PostgreSQL + RLS, Auth (e-mail/senha) e Storage já conectados; Edge Functions e Realtime ainda não
- **Routing:** react-router-dom v7
- **Mapa:** react-leaflet
- **Icons:** lucide-react
- **Testes:** Vitest + Testing Library

> Stack alvo descrito em `docs/farol-pitimbu-contexto.md` (TypeScript, shadcn/ui, framer-motion, react-query, react-hook-form+zod) ainda não foi adotado — ver a "Nota de stack" nesse documento.

## 🎨 Design System

**"Litoral Premium"** — Cores oceânicas, tipografia modern, border radius 20px.

| Cor | Hex | Uso |
|-----|-----|-----|
| Ocean | #0A4D68 | Primária |
| Turquesa | #05BFDB | Acentos |
| Areia | #F6F3EA | Backgrounds |
| Sol | #FFB703 | CTAs |

Ver [CLAUDE.md](./CLAUDE.md#5-design-system-litoral-premium) para detalhes.

## 📁 Estrutura

```
src/
├── components/       # Componentes React reutilizáveis (inclui AdminRoute, ProtectedRoute)
├── contexts/         # AuthContext (sessão, roles, isAdmin)
├── pages/           # Páginas/rotas (inclui Admin.jsx)
├── hooks/           # React hooks customizados (useAuth, useBusiness(es), useAdmin*)
├── integrations/    # Cliente Supabase (client.js) + tipos JSDoc (types.js)
├── lib/             # Utilitários
└── assets/          # Imagens estáticas — só compartilhamento (OG) e 2 páginas de experiência;
                     # negócios já usam Supabase Storage
```

## 🔄 Fluxo de Desenvolvimento

1. Crie branch a partir de `develop`: `git checkout -b feat/sua-feature`
2. Desenvolva e teste localmente (mobile + desktop).
3. Commit atomicamente: `git commit -m "feat: descrição"`
4. Abra PR em GitHub (base: `develop`).
5. Code review + merge.

Ver [CLAUDE.md — Fluxo de Git e PRs](./CLAUDE.md#6-fluxo-de-git-e-prs).

## 📊 Status (MVP - v1.0)

- [x] Home + páginas institucionais (Explorar, Categorias, Profissionais, Sobre, Contato, Planos)
- [x] Design system completo
- [x] Animações, hover effects, header
- [x] Backend Supabase (Postgres + RLS) — negócios e categorias reais, não mais mockados
- [x] Auth (e-mail/senha) — Google ainda pendente
- [x] CRUD de negócios (parcial) — criação e leitura reais; edição de negócio já cadastrado só pelo admin por enquanto
- [x] Painel admin — aprovar/rejeitar negócios, editar negócios e imagem, CRUD de categorias
- [x] Upload de imagens (Supabase Storage) — os 78 negócios já migrados; dono também pode subir a própria foto no cadastro
- [x] Honeypot anti-spam nos formulários públicos
- [x] Testes automatizados (Vitest) e bundle otimizado (~136kB no chunk principal)
- [ ] Dashboard do dono do negócio
- [ ] Sistema de pagamentos (Stripe)

Ver roadmap completo em [contexto do projeto](./docs/farol-pitimbu-contexto.md#10-roadmap).

## 🤝 Contribuição

1. Leia [CLAUDE.md](./CLAUDE.md) antes de começar.
2. Siga as convenções (Tailwind mobile-first, componentes React, semantic HTML).
3. Teste em múltiplos breakpoints e navegadores.
4. Verifique acessibilidade (WCAG AA).

## 📧 Contato

**Responsável:** Carlos Eduardo Mveloso  
**Email:** carloseduardomveloso@gmail.com
