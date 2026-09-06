# Contexto do Projeto — Farol Pitimbu

Documento base para gerar a documentação oficial do projeto (visão geral, requisitos, regras de negócio, usuários e permissões, fluxos, modelagem de dados, páginas, API, stack/arquitetura e roadmap).

---

## 1. Visão Geral

**Nome:** Farol Pitimbu
**Tagline:** O guia digital do litoral sul da Paraíba.
**Tipo de produto:** Portal de turismo + diretório de negócios locais (marketplace de divulgação).
**Localização:** Pitimbu — Paraíba, Brasil.
**Idioma:** Português (PT-BR).
**Modelo de negócio:** Freemium para negócios locais — cadastro gratuito básico + planos pagos de divulgação (Básico, Profissional, Premium).

**Proposta de valor:**
- Para **turistas/visitantes:** descobrir o que fazer, onde comer, onde ficar e quem contratar em Pitimbu, em um só lugar, com curadoria local.
- Para **moradores:** encontrar serviços, profissionais e eventos da cidade.
- Para **donos de negócio:** ganhar visibilidade digital com perfil profissional, fotos, contato direto (WhatsApp), localização e destaque pago.
- Para **profissionais autônomos:** vitrine de serviços com portfólio e avaliações.

**Diferenciais:**
- Foco hiperlocal (uma única cidade do litoral nordestino).
- Curadoria humana das categorias e destaques semanais.
- Identidade visual "Litoral Premium" (azul oceano + turquesa + areia + sol).
- Experiência mobile-first com busca e filtros rápidos.

---

## 2. Requisitos

### 2.1 Requisitos Funcionais

**Público (sem login):**
- RF01 — Visualizar home com hero, busca, categorias, destaques, experiências, estatísticas e CTA.
- RF02 — Explorar negócios com filtros (categoria, bairro, preço, avaliação).
- RF03 — Navegar todas as categorias e ver contagem por categoria.
- RF04 — Visualizar lista e perfis de profissionais autônomos.
- RF05 — Ler página institucional "Sobre" e enviar mensagem via "Contato".
- RF06 — Consultar planos de divulgação e iniciar contratação.
- RF07 — Acessar perfil público de um negócio (fotos, descrição, horários, contato WhatsApp, mapa, avaliações).
- RF08 — Buscar por texto livre na barra de busca do hero.

**Público (com login):**
- RF09 -> Favoritos/Lista de desejos, salvar praias, restaurantes, pousadas numa lista pessoal.
- RF10 -> Avaliações e comentários, Deixar nota e texto sobre lugares visitados.
- RF11 -> Histórico de visitas, marcar como "Já fui" nos locais.
- RF12 -> Alertar quando um négocio favorito posta promoção ou evento.
- RF13 -> Montar roteiros dia a dia e salvar.
- RF14 -> Denúncia de informações erradas, reportar telefone desatualizado, endereço errado.
- RF15 -> Contato direto via chat, sem ter que passar seu Whatsapp.

**Negócios / Profissionais (autenticados):**
- RF09 — Cadastrar-se e fazer login (e-mail/senha, Google).
- RF10 — Criar e editar perfil do negócio (nome, categoria, descrição, fotos, horários, contato, endereço/mapa, redes sociais).
- RF11 — Escolher e assinar plano (Básico / Profissional / Premium).
- RF12 — Visualizar dashboard com métricas (visualizações, cliques no WhatsApp, cliques em rota).
- RF13 — Responder a avaliações recebidas.
- RF14 — Receber selo "Verificado" após validação.

**Usuários finais (autenticados — opcional):**
- RF15 — Favoritar negócios.
- RF16 — Avaliar e comentar (1-5 estrelas + texto).
- RF17 — Reportar conteúdo inadequado.

**Admin:**
- RF18 — Aprovar/rejeitar cadastros e fotos.
- RF19 — Gerenciar categorias, destaques semanais e banners.
- RF20 — Moderar avaliações e reportes.
- RF21 — Gerenciar planos, cupons e cobranças.
- RF22 — Acessar painel de métricas gerais.

### 2.2 Requisitos Não-Funcionais
- **Performance:** LCP < 2.5s no 4G; imagens lazy + responsivas.
- **SEO:** SSR/SSG não obrigatório, mas meta tags, sitemap, JSON-LD (LocalBusiness) por perfil, URLs amigáveis (`/negocio/slug`).
- **Acessibilidade:** WCAG AA, navegação por teclado, contraste ≥ 4.5:1.
- **Responsividade:** mobile-first (360px+), breakpoints sm/md/lg/xl/2xl.
- **Segurança:** RLS no banco, roles em tabela separada, validação client+server, rate-limit em contato/avaliações.
- **Internacionalização:** PT-BR apenas (v1); arquitetura preparada para i18n futura.
- **Disponibilidade:** 99,5%.

---

## 3. Regras de Negócio

> **Estado implementado (06/09/2026):** ver `docs/regras-de-negocio.md`, que separa o que está valendo
> do que continua intenção. Esta seção 3 descreve o desenho original do produto e permanece como
> referência de roadmap; onde os dois divergirem, vale o documento de regras.

### 3.1 Planos de Divulgação
| Plano | Preço/mês | Limite fotos | Posição em listagens | Selo | Destaque semanal | WhatsApp clicável | Estatísticas |
|---|---|---|---|---|---|---|---|
| **Gratuito** | R$ 0 | 1 | Aleatória, abaixo dos pagos | — | Não | Sim | Básicas (views) |
| **Básico** | R$ 39 | 5 | Acima do gratuito | Verificado | Não | Sim | Views + cliques |
| **Profissional** | R$ 89 | 15 | Acima do Básico | Verificado + Pro | Concorre | Sim | Completas |
| **Premium** | R$ 179 | Ilimitado | Topo + carrossel home | Premium dourado | Garantido (rotativo) | Sim + botão grande | Completas + relatório PDF mensal |

**RN01:** Pagamento mensal recorrente; cancelamento a qualquer momento, vigência até fim do ciclo.
**RN02:** Downgrade reduz benefícios no próximo ciclo; fotos excedentes ficam ocultas, não apagadas.
**RN03:** Plano Premium inclui sessão de fotos profissional uma vez ao ano (regra comercial — opcional v2).
**RN04:** Negócio sem pagamento por 7 dias após vencimento volta para Gratuito automaticamente.

### 3.2 Cadastro e Verificação
**RN05:** Todo novo negócio entra como "Pendente"; admin aprova em até 48h.
**RN06:** Selo "Verificado" exige CNPJ ou CPF + comprovante de endereço.
**RN07:** Profissional autônomo pode cadastrar-se sem CNPJ; usa CPF.

### 3.3 Avaliações
**RN08:** Apenas usuários autenticados podem avaliar.
**RN09:** Uma avaliação por usuário por negócio (pode editar).
**RN10:** Nota média exibida só com ≥ 3 avaliações.
**RN11:** Dono pode responder publicamente uma vez por avaliação.
**RN12:** Avaliações reportadas 3+ vezes vão para moderação automática.

### 3.4 Conteúdo
**RN13:** Fotos passam por moderação automática (sem nudez/violência) + revisão admin para Premium.
**RN14:** Categorias são fixas e gerenciadas só por admin.
**RN15:** "Destaques da Semana" são 6 negócios escolhidos manualmente pelo admin toda segunda-feira.

---

## 4. Usuários e Permissões

### 4.1 Personas
1. **Visitante (anônimo)** — turista ou morador navegando.
2. **Usuário cadastrado** — pode favoritar, avaliar, reportar.
3. **Dono de Negócio** — gerencia 1+ negócios.
4. **Profissional** — gerencia perfil profissional próprio.
5. **Moderador** — modera conteúdo e avaliações.
6. **Admin** — controle total.

### 4.2 Matriz de Permissões
| Ação | Anônimo | Usuário | Dono | Profissional | Moderador | Admin |
|---|---|---|---|---|---|---|
| Ver perfis públicos | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Favoritar | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Avaliar | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Criar negócio | — | ✓ | ✓ | — | — | ✓ |
| Editar próprio negócio | — | — | ✓ | ✓ | — | ✓ |
| Editar qualquer negócio | — | — | — | — | — | ✓ |
| Moderar avaliações | — | — | — | — | ✓ | ✓ |
| Gerenciar categorias | — | — | — | — | — | ✓ |
| Gerenciar planos/cupons | — | — | — | — | — | ✓ |

**Implementação:** roles em tabela `user_roles` separada, com enum `app_role` e função `has_role()` SECURITY DEFINER.

---

## 5. Fluxos do Sistema

### 5.1 Fluxo do Visitante (Descoberta)
1. Acessa Home → vê hero com busca.
2. Filtra por categoria OU usa busca livre.
3. Vai para `/explorar` com resultados filtrados.
4. Clica em card de negócio → `/negocio/:slug`.
5. Clica em "WhatsApp" → abre conversa (track de clique).
6. (Opcional) Cria conta para favoritar/avaliar.

### 5.2 Fluxo do Dono de Negócio (Onboarding)
1. Clica em "Cadastrar meu negócio" (Navbar/CTA).
2. Sign up (e-mail/Google).
3. Wizard: dados básicos → categoria → endereço/mapa → fotos → horários → contato.
4. Escolhe plano (Gratuito / Básico / Pro / Premium).
5. Se pago → checkout Stripe.
6. Status "Pendente" → admin aprova em até 48h.
7. Recebe e-mail de aprovação e acessa dashboard.

### 5.3 Fluxo de Assinatura
1. Dono escolhe plano em `/planos` ou no dashboard.
2. Checkout Stripe (cartão).
3. Webhook atualiza `subscriptions` → ativa benefícios.
4. Renovação automática mensal.
5. Cancelamento: ativo até o fim do ciclo, depois rebaixa para Gratuito.

### 5.4 Fluxo de Avaliação
1. Usuário logado clica "Avaliar" no perfil.
2. Seleciona nota (1-5) + escreve comentário.
3. Avaliação publicada imediatamente.
4. Dono recebe notificação e pode responder.

### 5.5 Fluxo de Moderação
1. Conteúdo reportado entra em fila.
2. Moderador analisa → aprova / remove / suspende usuário.

---

## 6. Modelagem de Dados

> **Atualizado em 03/09/2026.** O backend Supabase saiu do papel nesta data — as subseções abaixo
> distinguem o que está **implementado e rodando em produção** do que ainda é **desenho/planejado**.
> Ver roadmap (seção 10) para o histórico de como isso avançou.

### 6.1 Tabelas implementadas (Supabase/Postgres)

**profiles** (1:1 com auth.users) — ✅ implementada
- id (uuid, PK, FK auth.users)
- full_name (text)
- avatar_url (text)
- phone (text)
- created_at, updated_at
- Trigger `handle_new_user()` cria a linha automaticamente a cada signup (junto com a role `user`).

**user_roles** — ✅ implementada
- id (uuid, PK)
- user_id (uuid, FK auth.users)
- role (enum `app_role`: admin | moderator | owner | professional | user)
- UNIQUE(user_id, role)
- Função `has_role(_user_id, _role) SECURITY DEFINER` — usada em todas as policies de RLS do projeto.
- Hoje só os roles `user` (automático) e `admin` (promovido manualmente via SQL) são usados de fato.

**categories** — ✅ implementada
- id (uuid, PK), slug (unique), name, description, icon, image_url, featured (bool), order_index (int)
- Seed inicial: 9 categorias (gastronomia, hospedagem, passeios, serviços, negócio, eventos, lojas, construção, artesanato).
- CRUD completo (criar, editar, excluir) pelo painel `/admin`.

**businesses** — ✅ implementada, com diferenças do desenho original (ver notas)
- id (uuid, PK), owner_id (uuid, FK profiles, nullable), slug (unique), name, subcategory, description,
  address, neighborhood, lat, lng, phone, whatsapp, email, website, instagram, facebook, hours (jsonb),
  price_range, status (enum: pending | active | suspended | rejected), **cover_image (text)**,
  created_at, updated_at
- **Diferença 1 — sem `category_id` único:** negócios reais têm mais de uma categoria (ex.: uma pousada
  que também é restaurante), então a relação virou N:N via `business_categories` (ver abaixo) em vez de
  uma FK única.
- **Diferença 2 — colunas ainda fora da tabela:** `short_description`, `gallery`, `verified`, `plan_id`,
  `avg_rating`, `review_count`, `views_count` não existem ainda — entram via `ALTER TABLE` quando Storage
  com galeria, reviews, planos pagos e analytics forem implementados (fases v1.1/v1.2 do roadmap).
- Trigger `businesses_guard_status()`: força `status='pending'` em insert/update feito por usuário
  autenticado não-admin (RN05); não se aplica a escrita direta (seed, SQL Editor, admin).
- Os 78 negócios do catálogo original foram migrados para esta tabela via seed (`scripts/generate-supabase-seed.mjs`), todos com `status='active'`.

**business_categories** — ✅ implementada (não estava no desenho original)
- business_id (FK businesses), category_id (FK categories), is_primary (bool)
- PK composta (business_id, category_id); índice único parcial garante no máximo 1 `is_primary=true` por negócio.
- Substitui o `category_id` único do desenho original (ver Diferença 1 acima).

### 6.2 Storage — ✅ implementado (parcial)
- Bucket `business-photos`: leitura pública; escrita via RLS em `storage.objects` — admin pode
  insert/update/delete em qualquer caminho, e o **dono do negócio** pode insert/update só na pasta do
  próprio negócio (`{business_id}/cover.<ext>`, conferido via `storage.foldername(name)` contra
  `businesses.owner_id`).
- Os 78 negócios já têm `cover_image` migrado do bundle estático (`src/assets/businesses/*.webp`) para o
  Storage — migração de dados única, feita em 03/09/2026 (`scripts/migrate-business-images-to-storage.sh`).
- O painel `/admin` permite trocar a imagem de qualquer negócio; o wizard `/cadastrar-negocio` permite ao
  dono subir a própria foto de capa no ato do cadastro (função compartilhada em
  `src/lib/uploadBusinessCoverImage.js`).
- Bucket `avatars` (previsto no desenho original) — **não implementado ainda**.
- Galeria de fotos (múltiplas imagens por negócio, coluna `gallery`) — **não implementada ainda**; existe
  só uma imagem de capa por negócio.

### 6.3 Auth e Admin — ✅ implementado (parcial)
- Supabase Auth por e-mail/senha (login e cadastro) ligado à UI de `/entrar`. **Google OAuth ainda não.**
- `AuthContext`/`useAuth` (React) expõem sessão, usuário e roles (`isAdmin`) para toda a aplicação.
- `/cadastrar-negocio` exige login (`ProtectedRoute`) e insere de verdade em `businesses` (com `slug`
  gerado via `slugify()` a partir do nome — ver `src/lib/business.js`), sempre como `pending`.
- `/admin` (`AdminRoute`, exige role `admin`): aprovar/rejeitar negócios pendentes, editar qualquer negócio
  (inclusive trocar a imagem), CRUD de categorias, busca por nome. **Moderação de avaliações e AI image
  check (RF20, RN13) ainda não existem** — ficam para quando `reviews` for implementada.
- Honeypot anti-spam (campo-armadilha invisível, `src/components/HoneypotField.jsx`) nos formulários
  públicos de contato, cadastro de conta e cadastro de negócio. Não substitui um CAPTCHA de verdade
  (hCaptcha/reCAPTCHA), que exigiria conta própria em serviço externo — ainda não configurado.

### 6.3.1 Tabelas e funções acrescentadas em 06/09/2026

- **`business_private_locations`** — endereço/coordenadas privados de quem atende sem endereço público.
  Sem GRANT para `anon`; RLS de dono/admin.
- **`business_change_requests`** — propostas de alteração sensível de negócio publicado (autor, campos
  propostos, snapshot da base, categorias, capa proposta, decisão).
- **`businesses`** ganhou `service_area`, `submitted_at`, `moderation_reason` (enum
  `business_moderation_reason`), `moderation_note`, `moderated_at`, `moderated_by`,
  `duplicate_candidates`, `duplicate_reviewed_at`. **`profiles`** ganhou `email`.
- **Camada de RPC** (`submit_business`, `update_own_business`, `resubmit_business`,
  `moderate_business`, `admin_*`, `request_business_changes`, `review_business_change_request`,
  `search_businesses`): `authenticated` perdeu o GRANT de escrita direta em `businesses` e
  `business_categories`, porque as invariantes exigem transação entre as duas tabelas.

### 6.4 Tabelas planejadas, ainda não implementadas

**professionals** (subtipo / extensão)
- id (uuid, PK, FK profiles)
- profession (text)
- bio (text)
- portfolio (text[])
- service_area (text)
- cpf (text, encrypted)
- verified (bool)

**plans**
- id (uuid, PK)
- slug (enum: free | basic | pro | premium)
- name (text)
- price_cents (int)
- max_photos (int)
- features (jsonb)
- stripe_price_id (text)

**subscriptions**
- id (uuid, PK)
- business_id (uuid, FK businesses)
- plan_id (uuid, FK plans)
- stripe_subscription_id (text)
- status (enum: active | canceled | past_due | trialing)
- current_period_start, current_period_end (timestamptz)

**reviews**
- id (uuid, PK)
- business_id (uuid, FK businesses)
- user_id (uuid, FK profiles)
- rating (int 1-5)
- comment (text)
- owner_reply (text, nullable)
- reported_count (int, default 0)
- status (enum: visible | hidden | pending)
- created_at
- UNIQUE(business_id, user_id)

**favorites**
- user_id (uuid)
- business_id (uuid)
- created_at
- PK(user_id, business_id)

**weekly_highlights**
- id (uuid, PK)
- business_id (uuid, FK)
- week_start (date)
- position (int)

**analytics_events**
- id (uuid, PK)
- business_id (uuid, FK)
- event_type (enum: view | whatsapp_click | route_click | phone_click | website_click)
- user_id (uuid, nullable)
- created_at

**contact_messages**
- id (uuid, PK)
- name, email, subject (text)
- message (text)
- created_at

### 6.5 Diagrama Resumido (estado atual)
```
auth.users 1—1 profiles 1—* businesses *—* categories (via business_categories)
                       1—* user_roles
```
> As relações com `reviews`, `analytics_events`, `subscriptions`, `favorites` e `weekly_highlights` do
> desenho original ainda não existem — dependem das tabelas da seção 6.4.

### 6.6 RLS (resumo, implementado)
- `businesses`: SELECT público se `status='active'`, ou dono (`owner_id = auth.uid()`), ou admin. INSERT
  autenticado (`owner_id = auth.uid()`, sempre vira `pending` via trigger). UPDATE dono ou admin. DELETE só admin.
- `business_categories`: espelha a visibilidade de `businesses`; escrita só dono/admin do negócio.
- `categories`: SELECT público; INSERT/UPDATE/DELETE só admin.
- `user_roles`: SELECT só próprio `user_id` ou admin; INSERT/UPDATE/DELETE só admin.
- `profiles`: SELECT próprio ou admin; UPDATE só próprio.
- `storage.objects` (bucket `business-photos`): SELECT público; INSERT/UPDATE/DELETE só admin.
> RLS de `reviews`/`analytics_events`/etc. (do desenho original) ainda não existe — tabelas não implementadas.

---

## 7. Páginas e Rotas

| Rota | Página | Acesso | Descrição |
|---|---|---|---|
| `/` | Home | Público | Hero + Categorias + Destaques + Experiências + Stats + CTA |
| `/explorar` | Explorar | Público | Lista + filtros (categoria, bairro, preço, rating) |
| `/categorias` | Categorias | Público | Grid de todas as categorias |
| `/categoria/:slug` | Categoria | Público | Negócios da categoria |
| `/profissionais` | Profissionais | Público | Diretório de autônomos |
| `/negocio/:slug` | Perfil Negócio | Público | Fotos, info, mapa, avaliações, WhatsApp |
| `/profissional/:slug` | Perfil Profissional | Público | Portfólio, contato |
| `/sobre` | Sobre | Público | Institucional |
| `/contato` | Contato | Público | Formulário |
| `/planos` | Planos | Público | 3 tiers + CTA |
| `/auth` | Login/Signup | Público | E-mail/senha + Google |
| `/dashboard` | Dashboard | Auth (owner) | Métricas + edições rápidas |
| `/dashboard/negocios` | Meus negócios | Auth (owner) | Lista + editar |
| `/dashboard/plano` | Minha assinatura | Auth (owner) | Status + upgrade/cancel |
| `/admin` | Admin | Auth (admin) | Painel geral |
| `/admin/aprovacoes` | Moderação | Auth (admin/mod) | Fila pendente |

> **Nota (03/09/2026):** rotas realmente implementadas hoje diferem desta tabela em alguns pontos: login/
> cadastro é `/entrar` (não `/auth`); filtro por categoria é `/explorar?categoria=slug` (não existe rota
> `/categoria/:slug` separada); `/admin` existe e funciona como um painel único com abas (Negócios/
> Categorias), sem sub-rota `/admin/aprovacoes`; `/dashboard*` (dono) e `/profissional/:slug` ainda não
> existem. `/negocio/:slug` está implementado e funcional.

---

## 8. API / Endpoints (Edge Functions + REST via Supabase)

### 8.1 Auto-gerados (Supabase REST/Realtime)
- CRUD em todas as tabelas via PostgREST, regrado por RLS.

### 8.2 Edge Functions (Lovable Cloud)
- `POST /functions/v1/checkout` — cria sessão Stripe Checkout para plano.
- `POST /functions/v1/stripe-webhook` — recebe eventos Stripe (assinatura criada/cancelada/falha).
- `POST /functions/v1/track-event` — registra `analytics_events` (rate-limited por IP).
- `POST /functions/v1/contact` — envia formulário (insere + envia e-mail via Resend).
- `POST /functions/v1/moderate-image` — chama AI para moderar foto no upload.
- `GET  /functions/v1/business-report/:id` — gera PDF mensal (Premium).
- `POST /functions/v1/notify-owner` — dispara e-mail/WhatsApp ao dono em eventos relevantes.

### 8.3 Integrações
- **Stripe** — pagamentos recorrentes.
- **Resend** — e-mails transacionais.
- **Mapbox / Google Maps** — geocoding + mapa.
- **Lovable AI Gateway** — moderação de imagens e geração de descrições sugeridas.

---

## 9. Stack e Arquitetura

### 9.1 Frontend
- **React 18 + Vite 5 + TypeScript 5**
- **Tailwind CSS v3** + design tokens semânticos (HSL)
- **shadcn/ui** (Radix headless)
- **framer-motion** — animações
- **react-router-dom v6** — roteamento
- **@tanstack/react-query** — cache de dados
- **react-hook-form + zod** — formulários e validação
- **lucide-react** — ícones

### 9.2 Backend (Lovable Cloud / Supabase)
- **PostgreSQL** + RLS
- **Supabase Auth** — e-mail/senha + Google OAuth
- **Supabase Storage** — fotos (buckets `business-photos`, `avatars`)
- **Edge Functions (Deno)** — lógica serverless
- **Realtime** — atualização ao vivo de avaliações/dashboard

### 9.3 Design System "Litoral Premium"
- **Cores (HSL):** Ocean `#0A4D68`, Turquesa `#05BFDB`, Areia `#F6F3EA`, Sol `#FFB703`
- **Tipografia:** Poppins (headings) + Inter (body)
- **Border radius:** 20px (1.25rem)
- **Sombras:** card / card-hover
- **Gradientes:** `gradient-ocean`

### 9.4 Arquitetura de Pastas (frontend)
```
src/
  assets/            # imagens locais — só para OG/compartilhamento e 2 páginas de
                      # experiência (onde-comer, artesanato-local); não é mais o
                      # fallback de imagem dos negócios (isso já é 100% Storage)
  components/
    ui/              # componentes reutilizáveis (sem shadcn/Radix instalado)
    layout/          # Navbar, Footer
    home/            # seções da home
    AdminRoute.jsx, ProtectedRoute.jsx  # guards de rota (auth / admin)
    HoneypotField.jsx  # campo-armadilha anti-spam (+ HoneypotField.test.jsx)
  contexts/          # AuthContext (sessão, roles, isAdmin)
  hooks/             # useAuth, useBusiness(es), useAdminBusinesses, useAdminCategories
  lib/               # utils (categoryLabel, toWhatsappLink, slugify, normalize, etc.)
                      # — testados em *.test.js ao lado de cada arquivo
  pages/             # inclui Admin.jsx (painel /admin)
  integrations/
    supabase/        # client.js + types.js (JSDoc, não .ts — ver nota de stack)
  test/              # setup.js do Vitest (jest-dom matchers)
```

### 9.5 Diagrama de Arquitetura (texto)
```
[ Browser ]
    │
    ▼
[ React SPA (Vite) ]
    │  HTTPS
    ├──────────────► [ Supabase Auth ]
    ├──────────────► [ Supabase PostgREST + RLS ]
    ├──────────────► [ Supabase Storage ]
    └──────────────► [ Edge Functions ] ──► Stripe / Resend / AI Gateway / Maps
```

---

## 10. Roadmap

### MVP (v1.0) — atual + curto prazo
- [x] Home com todas as seções (revisada, sem bugs conhecidos em 01/08/2026)
- [x] Estatísticas da home dinâmicas (calculadas a partir dos dados, sem prefixo "+")
- [x] Design system completo
- [x] Roteamento (React Router v7, 15 rotas públicas + catch-all, lazy loading)
- [x] `/explorar` funcional (busca, filtro por categoria, paginação — sobre 78 negócios reais mockados)
- [x] Páginas públicas com UI completa e dados mockados: Categorias, Atrações, Eventos, Mapa
      (React-Leaflet + OpenStreetMap), Profissionais, Blog, Planos, Cadastrar Negócio (wizard 4 passos),
      Sobre, Contato, Favoritos, Entrar
- [x] Página **Guia Local** (nova, fora do escopo original deste doc): tábua de marés (`TideForecast`),
      feiras livres, próximos eventos e telefones úteis
- [x] Seção de praias com cards e botão de compartilhar, integrada ao Guia Local/Mapa
- [x] Padronização de altura dos cards (negócios, praias, profissionais, atrações)
- [x] Formulário de Contato funcional via EmailJS (envio real de e-mail, sem backend próprio)
- [x] Vercel Analytics + Speed Insights integrados
- [x] Favicon e rebranding completo de "Nortcity" para "Farol Pitimbu"
- [x] Deploy configurado na Vercel (rewrite SPA para `main` e `develop`)
- [x] **Backend Supabase (tabelas, RLS)** — implementado em 03/09/2026: `profiles`, `user_roles`,
      `categories`, `businesses`, `business_categories`, todas com RLS. `/explorar` e `/negocio/:slug`
      leem direto do Supabase (não usam mais `src/data/*.js` em runtime — ver seção 6).
- [x] **Auth (e-mail/senha)** — login e cadastro reais via Supabase Auth, ligados a `/entrar`.
      **Google OAuth ainda pendente** (configuração externa no Google Cloud Console + Supabase Dashboard).
- [x] **CRUD de negócios (parcial)** — criação via `/cadastrar-negocio` (autenticado, entra como `pending`,
      incluindo a própria foto de capa); leitura pública real; edição de campos e mudança de status só pelo
      admin por enquanto (dono ainda não edita o próprio negócio depois de cadastrado — falta dashboard do
      dono).
- [x] Perfil público `/negocio/:slug` — confirmado implementado e funcional (a entrada anterior deste
      roadmap estava desatualizada em relação ao código).
- [x] **Painel admin (parcial)** — `/admin`: aprovar/rejeitar negócios pendentes, editar qualquer negócio
      (incluindo trocar imagem de capa), busca por nome, CRUD de categorias. Falta: moderação de
      avaliações e destaques semanais (dependem de `reviews`/`weekly_highlights`, ainda não implementadas).
- [x] **Upload de imagens (Storage)** — bucket `business-photos` no Supabase Storage; os 78 negócios
      seedados já têm `cover_image` migrada do bundle estático para o Storage; dono e admin podem trocar
      a imagem (ver seção 6.2).
- [x] **Honeypot anti-spam** nos formulários públicos (contato, cadastro de conta, cadastro de negócio).
- [x] **Testes automatizados** — Vitest + Testing Library configurados (`npm run test`), 16 testes
      cobrindo utils puros (`slugify`, `toWhatsappLink`, `categoryLabel`, `normalize`) e um componente.
- [x] **Otimização de bundle** — chunk principal caiu de ~586kB para ~136kB via `manualChunks`
      (React e Supabase em chunks de vendor separados e cacheáveis).
- [x] Dados fabricados removidos de `/profissionais` (nota/avaliações inventadas não existem mais).
- [x] 3 links mortos (`href="#"`) corrigidos: "Ver todos" da home, botão de contato dos destaques, FAQ do rodapé.
- [ ] Dashboard do dono do negócio — dono ainda não consegue editar/ver métricas do próprio negócio.

> **Bug crítico corrigido (03/09/2026):** o cadastro de negócio (`/cadastrar-negocio`) esteve quebrado
> desde que foi implementado — a coluna `slug` de `businesses` é obrigatória, mas o formulário nunca a
> preenchia, então todo envio falhava. Corrigido com `slugify()` (nome + sufixo aleatório) em
> `src/lib/business.js`; testado de ponta a ponta no navegador antes de fechar.

> **Nota de stack (atualizada em 03/09/2026):** a Seção 9.1 deste documento descreve um stack alvo
> (TypeScript, shadcn/ui, framer-motion, react-query, react-hook-form+zod). Na prática o projeto continua
> em **JavaScript puro** (tipagem leve via JSDoc em `src/integrations/supabase/types.js`, sem `.ts`/`.tsx`),
> e esses pacotes (shadcn, framer-motion, react-query, react-hook-form, zod) seguem não instalados — ver
> `CLAUDE.md` para as convenções realmente em uso. O Supabase **já está conectado** (Auth, Postgres+RLS,
> Storage) desde 03/09/2026; só Edge Functions e Realtime seguem não implementados. Contato usa EmailJS no
> lugar de Edge Function + Resend. Alias de import `@/` foi configurado (`vite.config.js` + `jsconfig.json`).
>
> `docs/STATUS-ATUAL.md` e `docs/roadmap-mvp-v1.md`, citados abaixo, ainda não existem neste repositório.

### v1.1 — Monetização
- [ ] Integração Stripe + 4 planos
- [ ] Webhook + ciclo de assinatura
- [ ] Selo verificado + destaques

### v1.2 — Engajamento
- [ ] Sistema de avaliações + respostas
- [ ] Favoritos
- [ ] Notificações por e-mail (Resend)

### v1.3 — Admin
- [x] Painel admin — aprovações/rejeições de negócios, CRUD de categorias, edição de negócios e imagem
      (entregue como parte do MVP v1.0, adiantado do roadmap original — ver seção acima)
- [ ] Destaques semanais (depende de `weekly_highlights`, não implementada)
- [ ] Moderação de conteúdo + AI image check (depende de `reviews`, não implementada)

### v2.0 — Crescimento
- [ ] Eventos e agenda da cidade
- [ ] Reservas/agendamento direto
- [ ] App PWA instalável
- [ ] Programa de afiliados/indicação
- [ ] Versão em inglês para turistas estrangeiros
- [ ] Expansão para outras cidades do litoral PB (multi-tenant)

### v2.1+ — Inteligência
- [ ] Recomendações personalizadas (AI)
- [ ] Relatórios avançados Premium
- [ ] Chatbot guia turístico
- [ ] Integração com agências de turismo

---

## 11. Métricas de Sucesso (KPIs)

- **Aquisição:** nº de negócios cadastrados / mês.
- **Ativação:** % de negócios com perfil 100% completo.
- **Receita:** MRR, % de negócios em plano pago, churn mensal.
- **Engajamento:** sessões/mês, cliques no WhatsApp, avaliações postadas.
- **SEO:** posição média para "o que fazer em Pitimbu", "pousadas Pitimbu", etc.

---

*Documento-fonte para gerar: visão-geral.md, requisitos.md, regras-de-negocio.md, usuarios-e-permissoes.md, fluxos.md, modelagem-de-dados.md, paginas-e-rotas.md, api.md, stack-e-arquitetura.md, roadmap.md.*
