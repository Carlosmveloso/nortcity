# Farol Pitimbu

> O guia digital do litoral sul da Paraíba — Portal de turismo + diretório de negócios locais.

## 🚀 Quick Start

### Setup
```bash
git clone https://github.com/Carlosmveloso/nortcity.git
cd nortcity
npm install
npm run dev
```

Acessa em `http://localhost:5173/`.

### Build
```bash
npm run build
npm run preview
npm run lint
```

## 📚 Documentação

- **[CLAUDE.md](./CLAUDE.md)** — Guia de desenvolvimento, convenções, fluxo de Git e boas práticas.
- **[docs/farol-pitimbu-contexto.md](./docs/farol-pitimbu-contexto.md)** — Especificação completa do projeto (requisitos, fluxos, modelagem, roadmap, stack).
- **[docs/comportamento-codex.md](./docs/comportamento-codex.md)** — Padrões comportamentais e consensos da equipe.

## 🛠 Tech Stack

- **Frontend:** React 18 + Vite 5 + TypeScript
- **Styling:** Tailwind CSS v3 + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Animations:** framer-motion
- **Routing:** react-router-dom v6
- **Data:** @tanstack/react-query
- **Forms:** react-hook-form + zod
- **Icons:** lucide-react

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
├── components/       # Componentes React reutilizáveis
├── pages/           # Páginas/rotas
├── hooks/           # React hooks customizados
├── integrations/    # Integrações (Supabase, etc)
├── lib/             # Utilitários
└── assets/          # Imagens e estáticos
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
- [ ] Auth (e-mail + Google)
- [ ] CRUD de negócios
- [ ] Dashboard do dono
- [ ] Sistema de pagamentos (Stripe)
- [ ] Admin panel

Ver roadmap completo em [contexto do projeto](./docs/farol-pitimbu-contexto.md#10-roadmap).

## 🤝 Contribuição

1. Leia [CLAUDE.md](./CLAUDE.md) antes de começar.
2. Siga as convenções (Tailwind mobile-first, componentes React, semantic HTML).
3. Teste em múltiplos breakpoints e navegadores.
4. Verifique acessibilidade (WCAG AA).

## 📧 Contato

**Responsável:** Carlos Eduardo Mveloso  
**Email:** carloseduardomveloso@gmail.com
