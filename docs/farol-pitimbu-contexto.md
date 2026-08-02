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

### 6.1 Tabelas Principais

**profiles** (1:1 com auth.users)
- id (uuid, PK, FK auth.users)
- full_name (text)
- avatar_url (text)
- phone (text)
- created_at, updated_at

**user_roles**
- id (uuid, PK)
- user_id (uuid, FK auth.users)
- role (enum: admin | moderator | owner | professional | user)
- UNIQUE(user_id, role)

**categories**
- id (uuid, PK)
- slug (text, unique) — ex: "gastronomia"
- name (text)
- description (text)
- icon (text) — nome do ícone lucide
- image_url (text)
- featured (bool)
- order_index (int)

**businesses**
- id (uuid, PK)
- owner_id (uuid, FK profiles)
- category_id (uuid, FK categories)
- slug (text, unique)
- name (text)
- description (text)
- short_description (text)
- cover_image (text)
- gallery (text[])
- address (text)
- neighborhood (text)
- lat, lng (numeric)
- phone, whatsapp (text)
- email, website (text)
- instagram, facebook (text)
- hours (jsonb) — `{mon: "08:00-18:00", ...}`
- price_range (enum: $, $$, $$$, $$$$)
- status (enum: pending | active | suspended | rejected)
- verified (bool)
- plan_id (uuid, FK plans, nullable)
- avg_rating (numeric, computed)
- review_count (int, computed)
- views_count (int)
- created_at, updated_at

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

### 6.2 Diagrama Resumido
```
auth.users 1—1 profiles 1—* businesses *—1 categories
                       1—* user_roles
businesses 1—* reviews *—1 profiles
businesses 1—* analytics_events
businesses 1—1 subscriptions *—1 plans
businesses 1—* favorites *—1 profiles
businesses *—* weekly_highlights
```

### 6.3 RLS (resumo)
- `businesses`: SELECT público se status=active; INSERT/UPDATE/DELETE só owner ou admin (via has_role).
- `reviews`: SELECT público; INSERT autenticado; UPDATE/DELETE só autor ou admin.
- `user_roles`: SELECT só próprio user_id ou admin; INSERT/UPDATE só admin.
- `analytics_events`: INSERT público; SELECT só owner do business ou admin.

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
  assets/            # imagens locais
  components/
    ui/              # shadcn
    layout/          # Navbar, Footer
    home/            # seções da home
    business/        # cards, badges
  hooks/
  lib/               # utils, supabase client
  pages/
  integrations/
    supabase/        # client + types
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
- [x] Design system completo
- [x] Roteamento (React Router v7, 10 rotas, lazy loading)
- [x] `/explorar` funcional (busca, filtro por categoria, paginação — sobre 78 negócios reais mockados)
- [ ] Páginas institucionais restantes (Categorias, Profissionais, Planos são placeholder "Em construção"; Sobre e Contato nem roteadas)
- [ ] Auth (e-mail + Google)
- [ ] Backend Supabase (tabelas, RLS) — `/explorar` ainda roda sobre dado estático em `data/businesses.js`
- [ ] CRUD de negócios
- [ ] Perfil público `/negocio/:slug`
- [ ] Dashboard básico do dono

> Status detalhado: ver `docs/STATUS-ATUAL.md` e `docs/roadmap-mvp-v1.md`.

### v1.1 — Monetização
- [ ] Integração Stripe + 4 planos
- [ ] Webhook + ciclo de assinatura
- [ ] Selo verificado + destaques

### v1.2 — Engajamento
- [ ] Sistema de avaliações + respostas
- [ ] Favoritos
- [ ] Notificações por e-mail (Resend)

### v1.3 — Admin
- [ ] Painel admin (aprovações, categorias, destaques)
- [ ] Moderação de conteúdo + AI image check

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
