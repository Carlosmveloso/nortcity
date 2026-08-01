# CLAUDE.md — Guia de Desenvolvimento Farol Pitimbu

Documento de referência para colaboração, padrões e fluxo de desenvolvimento do projeto Farol Pitimbu.

---

## 1. Visão Geral do Projeto

**Nome:** Farol Pitimbu — O guia digital do litoral sul da Paraíba.
**Tipo:** Portal de turismo + diretório de negócios locais (marketplace freemium).
**Tech Stack:** React 18 + Vite 5 + JavaScript + Tailwind CSS + Supabase.
**Documentação oficial:** `docs/farol-pitimbu-contexto.md`

> Para contexto completo de requisitos, fluxos, modelagem de dados, roadmap, ver `docs/farol-pitimbu-contexto.md`.

---

## 2. Setup e Desenvolvimento Local

### Pré-requisitos
- Node.js 18+
- npm ou pnpm
- Git

### Instalação
```bash
git clone https://github.com/Carlosmveloso/nortcity.git
cd nortcity
npm install
```

### Rodar dev server
```bash
npm run dev
```

Acessa em `http://localhost:5173/`.

### Build e preview
```bash
npm run build
npm run preview
```

### Lint e verificações
```bash
npm run lint
```

---

## 3. Estrutura de Pastas

```
src/
├── assets/               # Imagens e arquivos estáticos
├── components/
│   ├── ui/              # shadcn/ui + componentes reutilizáveis
│   ├── layout/          # Navbar, Footer, Layout wrapper
│   ├── home/            # Componentes da página Home (HeroSection, CategoriesSection, etc)
│   ├── business/        # Cards, badges e componentes para perfil de negócios
│   └── [...outros]/
├── hooks/               # React hooks customizados
├── pages/               # Páginas/rotas principais
├── integrations/
│   └── supabase/        # Cliente Supabase + tipos gerados
├── lib/                 # Utilitários, helpers, configs
├── styles/              # CSS globals (Tailwind)
└── main.jsx             # Entry point
```

---

## 4. Convenções de Código

### Componentes React

**Estrutura básica:**
- Use **functional components** com hooks.
- Nomeie componentes em **PascalCase** (ex: `HeroSection.jsx`).
- Nomeie arquivos = nome do componente.
- Props bem definidas (preferencialmente TypeScript).

**Exemplo:**
```jsx
export function HeroSection() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <section className="min-h-screen bg-gradient-ocean">
      {/* Conteúdo */}
    </section>
  );
}
```

### Tailwind CSS

- Use **classes Tailwind** diretamente no JSX.
- Defina **breakpoints** padrão: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px).
- Mobile-first: estilo para mobile, depois breakpoints maiores.

**Exemplo:**
```jsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {/* Cards */}
</div>
```

### Componentes shadcn/ui

- Importe de `@/components/ui/`.
- Use quando necessário (Button, Input, Dialog, etc).
- Customize via className quando necessário.

**Exemplo:**
```jsx
import { Button } from "@/components/ui/button";

export function MyComponent() {
  return (
    <Button 
      className="bg-ocean hover:bg-ocean/90"
      onClick={handleClick}
    >
      Ação
    </Button>
  );
}
```

---

## 5. Design System "Litoral Premium"

### Cores (HSL/Tailwind)

| Nome | Hex | Tailwind Class | Uso |
|------|-----|---|---|
| Ocean | #0A4D68 | `bg-ocean` / `text-ocean` | Primária, headers |
| Turquesa | #05BFDB | `bg-turquoise` / `text-turquoise` | Acentos, hover, links |
| Areia | #F6F3EA | `bg-sand` / `text-sand` | Backgrounds claros, text light |
| Sol | #FFB703 | `bg-sun` / `text-sun` | CTAs, destaque |
| Cinza (texto) | #4B5563 | `text-slate-700` | Body text |

**Configurado em:** `tailwind.config.js`

### Tipografia

| Elemento | Fonte | Peso | Tamanho |
|----------|-------|------|---------|
| Headings (h1-h6) | Poppins | 600-700 | 2xl-4xl |
| Body | Inter | 400-500 | base-lg |
| Buttons | Inter | 600 | base |

### Spacing e Border Radius

- **Gap / Padding padrão:** `4px`, `8px`, `16px`, `24px`, `32px`.
- **Border radius:** `20px` (1.25rem, `rounded-xl` no Tailwind).
- **Sombras:** `shadow-md` (cards), `shadow-lg` (hover).

### Gradientes

- **Gradient Ocean:** `linear-gradient(135deg, #0A4D68, #05BFDB)`
- Classe Tailwind: `bg-gradient-ocean` (se configurado)

---

## 6. Fluxo de Git e PRs

### Branches

- **`main`** — Branch de produção (protegida).
- **`develop`** — Branch de desenvolvimento (base para features).
- **`feat/<feature-name>`** — Novas features (ex: `feat/auth-google`).
- **`fix/<bug-name>`** — Correções de bugs (ex: `fix/hero-responsivity`).
- **`refactor/<scope>`** — Refatorações (ex: `refactor/navbar-spacing`).
- **`docs/<topic>`** — Atualizações de documentação.

### Fluxo de trabalho

1. **Crie uma branch a partir de `develop`:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/minha-feature
   ```

2. **Faça commits atomicamente:**
   ```bash
   git commit -m "feat: adiciona filtro de categoria na home"
   ```

3. **Push para remote:**
   ```bash
   git push -u origin feat/minha-feature
   ```

4. **Abra PR no GitHub:**
   - Base: `develop` (ou `main` se hotfix).
   - Descreva o que foi alterado, por quê e como testar.
   - Link issues relacionadas (ex: `Closes #42`).

5. **Code review:**
   - Pelo menos 1 aprovação antes de merge.
   - Resolva comentários / aplique sugestões.

6. **Merge:**
   - Use "Squash and merge" para PRs pequenas.
   - Use "Create a merge commit" para PRs maiores (mantém histórico).

### Mensagens de commit

Siga o padrão **Conventional Commits**:
- `feat: descrição da feature`
- `fix: descrição do bug`
- `refactor: descrição da refatoração`
- `docs: descrição da doc`
- `test: adiciona testes`
- `chore: atualizações de config/deps`

---

## 7. Testes e QA

### Manual (antes de PR)

- [ ] Testar em **desktop** (Chrome, Firefox, Safari).
- [ ] Testar em **mobile** (Chrome DevTools ou dispositivo real).
- [ ] Testar **responsividade** em breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`.
- [ ] Verificar **acessibilidade:** navegação por teclado, contraste, screen reader.
- [ ] Verificar **performance:** LCP < 2.5s (Google PageSpeed).
- [ ] Testar funcionalidades interativas: cliques, forms, filtros.

### Automatizado (se aplicável)

```bash
npm run test          # Jest (se configurado)
npm run lint          # ESLint
```

---

## 8. Performance e Acessibilidade

### Performance

- **Lazy load images:** Use `loading="lazy"` em `<img>`.
- **Code splitting:** React Router suporta lazy routes.
- **Bundle size:** Monitorar com Vite.
- **LCP target:** < 2.5s no 4G.

**Ferramentas:**
- Google PageSpeed Insights
- Lighthouse (Chrome DevTools)
- Vite analyzer

### Acessibilidade (WCAG AA)

- Use **semantic HTML** (`<header>`, `<nav>`, `<main>`, `<footer>`).
- **Alt text** em imagens: `<img alt="Descrição" />`.
- **Headings hierarchy:** `<h1>` → `<h2>` → `<h3>` (sem pular níveis).
- **Contraste:** ≥ 4.5:1 para text, ≥ 3:1 para UI components.
- **Navegação por teclado:** Focus states visíveis, Tab order lógica.
- **ARIA labels:** `aria-label`, `aria-labelledby` quando necessário.
- **Forms:** `<label for="id">` vinculada ao input.

---

## 9. Melhorias Recentes e Lições Aprendidas

### Home Page Refinements (Recent)

**6 problemas identificados e em processo de resolução:**

1. **Hero Section (100vh)** — `min-h-[700px]` → `h-screen`
2. **Search Filter (UX)** — Melhorar responsividade e funcionalidade
3. **Experience Cards** — Fazer card inteiro ser link (`<a>`, não só arrow)
4. **CTA Section** — Pixel-perfect alignment com design Lovable
5. **Footer (Email Responsivity)** — Corrigir overlap em mobile/tablet
6. **Navbar (Spacing)** — Balancear espaçamento logo/links/button

**Arquivos-chave:** `HeroSection.jsx`, `ExperienceCard.jsx`, `CallToActionSection.jsx`, `Footer.jsx`, `Navbar.jsx`.

### Boas Práticas Emergentes

- **Test componentes em múltiplos breakpoints durante desenvolvimento.**
- **Use design tokens (cores, spacing) consistentemente.**
- **Faça cards inteiros clicáveis quando comportam links** (melhor UX).
- **Verify pixel-perfect alignment com Figma/Lovable antes de marcar "pronto".**
- **Mobile-first: sempre começar pelo mobile, depois incrementar.**

---

## 10. Checklist para Novas Features

Antes de abrir PR:

- [ ] Código segue convenções (componentes, nomes, estrutura).
- [ ] Tailwind classes usadas corretamente (mobile-first).
- [ ] Testado em mobile, tablet e desktop.
- [ ] Acessibilidade verificada (contraste, keyboard nav, alt text).
- [ ] Performance aceitável (sem imagens grandes não otimizadas).
- [ ] Sem console errors ou warnings.
- [ ] Commit messages seguem Conventional Commits.
- [ ] PR descreve mudanças e como testar.
- [ ] Documentação atualizada (se necessário).

---

## 11. Integração com Supabase

### Cliente Supabase

Importar do `src/integrations/supabase/client.js`:
```jsx
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase
  .from('businesses')
  .select('*')
  .eq('status', 'active');
```

### Types

Tipos TypeScript gerados automaticamente em `src/integrations/supabase/types.ts`.

### Environment Variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 12. Deployment

**Branches automáticas:**
- `main` → Produção (Vercel/similar)
- `develop` → Staging/preview

**Processo:**
1. Merge PR em `develop` → deploy automático em staging.
2. Testes finais em staging.
3. Merge em `main` (via PR) → deploy em produção.

---

## 13. Contato e Dúvidas

**Responsável:** Carlos Eduardo Mveloso
**Email:** carloseduardomveloso@gmail.com
**Docs:** Ver `docs/` para especificações detalhadas.

---

**Última atualização:** 2026-08-01
**Versão:** 1.0 (pós-home-refinement)
