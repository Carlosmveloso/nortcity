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

### Automatizado

```bash
npm run test          # Vitest (unitários + testes de banco)
npm run test:watch    # Vitest em modo watch
npm run lint          # ESLint
```

Duas camadas de teste:

- **Funções puras e utilitários** (`src/lib/`, `src/hooks/mapBusinessRow.js`) e um componente simples
  (`HoneypotField`) — arquivos `*.test.js`/`*.test.jsx` ao lado do arquivo testado.
- **Banco de verdade** (`src/test/db/`) — RLS, autorização, invariantes e concorrência rodando contra
  Postgres real e descartável (PGlite, Postgres em WASM: esta máquina não tem Docker, então
  `supabase start` não sobe). `src/test/db/harness.js` recria o mínimo dos schemas `auth` e `storage`
  do Supabase e aplica **todas** as migrations do zero a cada suíte. É onde se testa "usuário A não lê
  negócio de B", "duas submissões simultâneas não criam dois negócios" e afins.

**Nunca teste escrita contra o Supabase de produção** — o `.env` local aponta para o mesmo projeto.
Escreva o teste em `src/test/db/`, onde o banco é descartável.

Ainda não existe teste E2E de navegador.

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

### Backend Supabase (03/09/2026)

Primeira etapa do backend real: schema + RLS + Storage + Auth + painel admin (ver seção 11 e
`docs/farol-pitimbu-contexto.md` seção 6/10 para detalhes completos). Duas lições que valem lembrar:

- **Tabelas criadas via CLI/migrations não recebem GRANT automático para `anon`/`authenticated`** — só
  criar a tabela + RLS não basta; sem `grant select/insert/... on <tabela> to anon, authenticated`, o
  Postgres nega a operação antes mesmo de avaliar as policies. Isso já causou `/explorar` retornar 0
  resultados com o banco populado corretamente.
- **`auth.uid()` é `null` em conexões diretas** (seed via `db push`, SQL Editor, `service_role`) — um
  trigger que checa `has_role(auth.uid(), 'admin')` sem primeiro checar `auth.uid() is not null` trata
  essas conexões como "usuário não-admin" e pode sobrescrever dados do seed (aconteceu com `status` dos
  negócios seedados virando `pending` em vez de `active`).
- **Coluna `not null` sem valor no formulário = bug silencioso até testar de ponta a ponta.**
  `businesses.slug` é obrigatória, mas `/cadastrar-negocio` nunca a preenchia — o cadastro esteve
  quebrado desde que foi implementado e só foi descoberto testando o fluxo completo no navegador (editar
  negócios já seedados no admin não expõe esse tipo de bug, porque eles já têm slug). Lição: sempre testar
  o caminho de **criação** de dado novo, não só leitura/edição de dado que já existe.

### Auditoria e melhorias (03/09/2026)

Revisão do projeto inteiro (não só do código novo desta sessão) pedida explicitamente pelo usuário.
Resultado: 3 links mortos (`href="#"`) corrigidos, dados fabricados removidos de `/profissionais`,
honeypot anti-spam adicionado nos formulários públicos, Vitest configurado do zero (16 testes em
utils puros), e bundle principal reduzido de ~586kB pra ~136kB via `manualChunks` no Vite — ver
`docs/farol-pitimbu-contexto.md` seção 10 para a lista completa. Lição: pedir pra revisar "o projeto
todo" acha bugs que revisões focadas na mudança do momento não acham (nenhum dos 3 links mortos e o
bug do slug tinham relação com o que estava sendo implementado ali).

### Regras de negócio do diretório (06/09/2026)

Implementação das fases 0 a 4 do núcleo funcional: um negócio por conta, categorias do banco também no
formulário público, motivo obrigatório de rejeição/suspensão, área `/meu-negocio`, cadastro de
profissional autônomo sem endereço público, busca ordenada no servidor, sinalização de duplicidade,
vínculo manual de proprietário e edição de negócio ativo com moderação. Ver `docs/regras-de-negocio.md`
(o que vale hoje), `docs/plano-migracao-regras-negocio.md` (como aplicar) e
`supabase/diagnostics/business_data_audit.sql` (diagnóstico antes de aplicar).

Lições que valem para o próximo trabalho no banco:

- **`GRANT` esquecido continua sendo o erro mais caro, e ele se repete.** Depois do caso de
  `businesses` (migration 0009), a mesma armadilha estava em `categories`: só `select` foi concedido,
  então o CRUD de categorias do painel admin **nunca funcionou** — a policy `categories_admin_write`
  existia, mas o Postgres nega a operação antes de avaliar policy. Ao criar tabela por migration,
  conceda os GRANTs na mesma migration e escreva um teste que exercite a escrita como o papel real.
- **Subquery dentro de policy captura coluna do escopo de fora.** As policies de upload usavam
  `storage.foldername(name)` dentro de `exists (select 1 from businesses b ...)`, e `name` resolveu
  para `b.name` — o nome do negócio. A policy comparava o uuid do negócio com um pedaço do nome dele:
  o upload de capa pelo dono foi negado por RLS desde que foi escrito, em silêncio. Qualifique sempre
  (`objects.name`) quando a policy tiver subquery.
- **Invariante que envolve duas tabelas não cabe no PostgREST.** Negócio + categorias precisam de uma
  transação; por isso a escrita direta foi revogada e tudo passa por RPC `SECURITY DEFINER`. Guard
  trigger é segunda barreira, não a primeira — e deve levantar erro, não reverter em silêncio, senão o
  app acha que deu certo.
- **Restrição nova encontra dado velho.** Exigir 40 caracteres de descrição em toda escrita impediria
  o admin de corrigir um telefone dos 78 cadastros do seed. A descrição passou a ser validada quando é
  criada ou alterada, nunca como pedágio para mexer em outro campo. Antes de ativar restrição, rode o
  diagnóstico e decida o que fazer com o que não se encaixa — sem escolher em silêncio pelo usuário.

### Descrição opcional e a trava que ficou só no cliente (07/09/2026)

O mínimo de 40 caracteres foi revertido: descrição agora é opcional, com teto de 1500
(`supabase/migrations/20260907000001_description_optional.sql`). Duas lições:

- **A tolerância implementada no SQL precisa ser copiada na tela.** `admin_update_business` só cobra
  descrição e localização quando esses campos mudam, mas `BusinessEditor` no `/admin` rodava
  `validateBusinessForm` inteiro e bloqueava o salvamento de qualquer negócio publicado com um campo
  fora do contrato. Resultado medido em produção: **59 dos 78 negócios publicados eram impossíveis de
  salvar** (53 por descrição curta, 30 por falta de endereço) — e o banco teria aceitado todos. Quando
  o servidor tem uma regra condicional, o cliente precisa da mesma condição, não da versão rígida.
- **Fallback de erro sem código é um bug invisível.** `businessErrorMessage` devolvia "Não foi possível
  concluir" para qualquer erro fora do mapa, sem `console.error` e sem o código bruto. Foi só anexar o
  código à mensagem para o erro real aparecer na primeira tentativa seguinte:
  `permission denied for function assert_business_categories`.
- **GRANT esquecido, terceira vez — agora numa trigger DEFERRED.**
  `business_categories_check()` nasceu sem `security definer` (migration 0003) e depois
  `assert_business_categories()` teve `execute` revogado de PUBLIC (migration 0010). Cada decisão está
  certa sozinha; juntas quebraram **toda** escrita de categoria vinda do app. O detalhe que fecha a
  armadilha é o `deferrable initially deferred`: a trigger não roda dentro da RPC `SECURITY DEFINER`,
  roda no COMMIT, quando o papel corrente já voltou a ser `authenticated`. Atingia
  `submit_business` (/cadastrar-negocio), `admin_create_business` e `admin_update_business` com
  categorias; moderação não toca a tabela, e por isso o painel parecia funcionar pela metade.
  Corrigido em `20260907000002_categories_trigger_security_definer.sql`.
- **Este bug o PGlite não pega — e mesmo assim dá para testá-lo.** O harness em WASM não recusa a
  chamada que o Postgres do servidor recusa, então nenhum teste de execução acusaria. A guarda que
  funciona é de catálogo: `src/test/db/function-privileges.test.js` lê `pg_trigger`/`pg_proc` e falha
  se alguma trigger sem `SECURITY DEFINER` chamar função cujo `execute` foi revogado. Quando o
  ambiente de teste não reproduz a falha, teste o invariante em vez de desistir.

### A capa do admin e o bug que já estava corrigido (07/09/2026)

Relato: "troco a imagem no /admin, ela sobe, mas o formulário continua mostrando a antiga; ao salvar
aparecem duas mensagens de erro; e mesmo com os erros a imagem muda". Três sintomas, três causas
distintas — nenhuma delas onde o relato apontava.

- **Antes de caçar a causa, confira qual build está no ar.** As duas mensagens de erro
  (40 caracteres + "o negócio está publicado: corrija os campos") vinham da `main`, que ainda tinha
  `DESCRIPTION_MIN = 40`. O código já corrigido estava numa branch local que nunca havia sido enviada ao
  remoto — a produção rodava outra coisa. Um `git show main:src/lib/businessForm.js` resolveu em
  segundos o que uma leitura do working tree jamais explicaria: no código atual aquela combinação de
  mensagens é impossível. Bug relatado em produção começa por identificar o commit que está servindo.
- **Escrita disparada fora do botão Salvar quebra tudo que o Salvar promete.** A capa era gravada no
  instante do `change` do input de arquivo, por um RPC próprio: escapava da validação, ia ao ar mesmo
  com o formulário bloqueado, e Cancelar não desfazia. Seleção de arquivo deve virar **estado
  pendente** (arquivo + prévia por `URL.createObjectURL`), e a gravação acontece no mesmo payload do
  resto — `admin_update_business` já aceitava `cover_image`. O padrão certo já existia em
  `MeuNegocio.jsx`; o `/admin` é que tinha o seu próprio.
- **Sentinela combinada de um lado só vira no-op silencioso.** `handleImageChange` chamava
  `onSave(null)` querendo dizer "recarrega a lista"; o pai respondia `if (!patch) return { error: null }`
  e não chamava `refetch()`. Ninguém errou em voz alta: o upload deu certo, o banco atualizou, e a tela
  ficou mostrando a imagem velha. Quando o filho precisa de uma ação do pai, peça por prop com nome
  (`onCoverChanged`), não por parâmetro nulo com significado implícito.
- **`upsert` em caminho fixo destrói o dado atual antes de a gravação confirmar.** Se o upload sobrescreve
  `{id}/cover.<ext>` e a escrita seguinte falha, a capa que está no ar já foi perdida — e a URL antiga
  passa a servir a imagem nova. Nome único por envio (`cover-<ts>.<ext>`, como `publishReviewImage` já
  fazia) troca esse risco por, no pior caso, um arquivo órfão.
- **Para testar escrita em produção, crie o que der para apagar.** O fluxo "imagem + Salvar" só se prova
  gravando de verdade, e fazer isso num dos 78 cadastros reais trocaria a capa de um negócio por uma
  imagem de teste sem volta fácil. Um cadastro descartável (criado como pendente, apagado no fim)
  prova o caminho inteiro sem tocar em dado de ninguém. Nota de automação: o botão de excluir usa
  `window.confirm`, que congela o controle do navegador — sobrescrever `window.confirm` antes do clique
  evita o diálogo em vez de ficar preso nele.

### Os negócios que sumiam a cada merge (09/09/2026)

Relato: "adiciono negócios numa branch, faço PR pra main, e eles voltam ao que eram". Aconteceu duas
vezes, por duas causas diferentes — nenhuma delas um bug do site.

- **Arquivo que muda de papel engole a edição de quem não sabia.** Em 20/08 a `develop` dividiu
  `businesses.js` (760 linhas de dados) num wrapper de 16 linhas + `businesses.data.js`. No mesmo dia
  a `main` adicionou negócios **no arquivo antigo**. O merge deu conflito, foi resolvido pegando o
  wrapper da `develop`, e as 18 linhas de dados não tinham para onde ir: 4 negócios sumiram e um
  removido ressuscitou. Renomear/dividir arquivo de dados é mudança de contrato — vale avisar quem
  edita esse arquivo antes, não depois do conflito.
- **Seed é fotografia, e fotografia envelhece.** O `seed.sql` de 06/09 foi gerado do arquivo estático
  num commit anterior à correção; ao popular o banco, republicou os mesmos negócios errados. Pior:
  `on conflict (slug) do nothing` **não** protege contra ressurreição — depois que alguém apaga um
  negócio, o slug fica livre e o insert passa. Um `db push --include-seed` desfazia a limpeza. Agora
  o gerador lê do banco e `[db.seed]` está desligado.
- **Trocar a fonte de dados sem trocar todos os consumidores deixa metade do site mentindo.** Quando
  `/explorar` passou a ler do Supabase, o sitemap, o HTML pré-renderizado e os cards de OG continuaram
  saindo do arquivo. Resultado medido: 4 URLs no sitemap que o app não encontrava e 3 negócios no ar
  sem título nem imagem ao compartilhar. Ninguém percebeu por meses porque **nada compara as duas
  listas**. A correção não foi criar um verificador: foi passar a lista do banco para os três
  geradores, para divergir deixar de ser possível. Vigia a gente esquece de olhar.
- **`grep --include` com glob sem aspas no zsh falha em silêncio.** `grep -rn x src --include=*.js`
  aborta com "no matches found" e devolve nada — que parece "nenhum consumidor". Confiei nisso,
  apaguei `businesses.data.js`, e o build quebrou apontando três importadores reais
  (`categories.js`, `statsSection.js`, `experiencePages.js`). Sempre cite o glob
  (`--include='*.js'`), e desconfie de busca que devolve zero em arquivo que você sabe que existe.

### Home Page Refinements

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

**Status:** conectado desde 03/09/2026 (Postgres + RLS, Auth por e-mail/senha, Storage). Edge Functions e Realtime ainda não usados.

### Cliente Supabase

Importar do `src/integrations/supabase/client.js` (alias `@/` configurado em `vite.config.js` + `jsconfig.json`):
```jsx
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase
  .from('businesses')
  .select('*')
  .eq('status', 'active');
```

### Types

O projeto é **JavaScript puro** (sem TypeScript) — `src/integrations/supabase/types.js` tem `@typedef` em
JSDoc (`Business`, `Category`, `Profile`, `BusinessCategory`), mantidos manualmente. **Não** há
`types.ts` gerado automaticamente.

### Schema e migrations

Migrations SQL vivem em `supabase/migrations/` (aplicadas com `npx supabase db push`). Tabelas
implementadas hoje: `profiles`, `user_roles` (+ função `has_role()`), `categories`, `businesses`,
`business_categories` (junção N:N), `business_private_locations` e `business_change_requests`.
Detalhamento completo e o que ainda falta (reviews, plans, etc.) em `docs/farol-pitimbu-contexto.md`,
seção 6.

**Escrita em `businesses`/`business_categories` é só por RPC.** `authenticated` não tem GRANT de
insert/update nessas tabelas: use `submit_business`, `update_own_business`, `resubmit_business`,
`set_business_cover_image`, `update_own_active_business`, `request_business_changes`,
`cancel_business_change_request`, `moderate_business`, `admin_create_business`,
`admin_update_business`, `admin_delete_business`, `admin_link_business_owner`,
`admin_unlink_business_owner`, `admin_resolve_duplicate`, `review_business_change_request`. Leitura
pública de listagem passa por `search_businesses`. As RPCs levantam erro com `message` = código
estável em inglês e `detail` = frase em PT-BR; `src/lib/businessErrors.js` traduz para a UI.

Seed de dados (`scripts/generate-supabase-seed.mjs`, que **lê do banco** e escreve `supabase/seed.sql`)
e migração de imagens estáticas pro Storage (`scripts/migrate-business-images-to-storage.sh`) são
scripts únicos, não fazem parte do build normal. `[db.seed]` está desligado no `config.toml`: aplicar
seed é decisão explícita, nunca efeito de um `db push --include-seed`.

**O build lê o catálogo do banco.** `scripts/publishedBusinesses.mjs` busca os negócios publicados e
alimenta o sitemap, o HTML pré-renderizado (`prerender-meta.mjs`) e os cards de compartilhamento
(`generate-og-images.mjs`). Nenhum dos três lê `src/data/businesses.data.js` — esse arquivo ainda
serve a `categories.js`, `statsSection.js` e `experiencePages.js`, que **continuam mostrando dado
estático desatualizado** (ver seção 9).

### Auth e Admin

- `AuthContext`/`useAuth` (`src/contexts/`, `src/hooks/useAuth.js`) expõem `user`, `session`, `roles`, `isAdmin`.
- `ProtectedRoute` exige login; `AdminRoute` exige login + role `admin`.
- Painel admin em `/admin` (`src/pages/Admin.jsx`): moderação com motivo, revisão de alterações de
  negócios publicados, CRUD de categorias, vínculo de proprietário e resolução de duplicatas.
- Área do proprietário em `/meu-negocio` (`src/pages/MeuNegocio.jsx`), disponível no plano Gratuito:
  status, motivo da decisão, correção de pendente, reenvio de rejeitado e edição de ativo.

### Environment Variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Sem essas variáveis, `src/integrations/supabase/client.js` usa uma URL de placeholder para não derrubar o
app inteiro — mas nenhuma chamada ao Supabase funciona.

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

**Última atualização:** 2026-09-09
**Versão:** 1.5 (sitemap, prerender e cards de compartilhamento lendo o catálogo do banco)
