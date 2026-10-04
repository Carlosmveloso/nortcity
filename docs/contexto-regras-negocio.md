# Contexto para Discussão de Regras de Negócio — Farol Pitimbu

> **Como usar este documento:** é um retrato do estado **real e atual** do projeto (código + banco de
> dados), separado do que é só intenção/roadmap. Feito para ser colado como contexto em uma conversa com
> outra IA sobre regras de negócio — não é a documentação técnica completa (essa está em
> `docs/farol-pitimbu-contexto.md` e `CLAUDE.md`, na raiz do projeto).
>
> **Gerado em:** 2026-09-05. Como o projeto muda rápido, se este documento tiver mais de algumas semanas,
> vale conferir se ainda bate com o código antes de confiar cegamente nele.
>
> ⚠️ **DESATUALIZADO desde 06/09/2026.** As regras de negócio discutidas a partir deste retrato foram
> implementadas: um negócio por conta, categorias do banco no formulário público, motivo obrigatório de
> moderação, área Meu Negócio, área de atendimento sem endereço público, busca ordenada no servidor,
> sinalização de duplicidade, vínculo manual de proprietário e edição de negócio ativo com moderação.
> O estado atual está em **`docs/regras-de-negocio.md`**. Este arquivo fica como registro do ponto de
> partida — as seções 3.3, 5 e 7 já não descrevem o sistema.

---

## 1. O que é o produto

**Farol Pitimbu** — portal de turismo + diretório de negócios locais de Pitimbu (litoral sul da Paraíba,
Brasil). Dois públicos principais:
- **Visitantes/moradores**: descobrem negócios, praias, eventos, profissionais da cidade.
- **Donos de negócio**: cadastram o próprio negócio pra ganhar visibilidade.

Modelo de negócio pretendido é **freemium** (cadastro grátis + planos pagos de destaque), mas isso ainda
**não existe de verdade** — ver seção 3.

---

## 2. Papéis de usuário (o que existe hoje)

Implementado via tabela `user_roles` (enum `app_role`) + função `has_role()`:

| Papel | Como se torna | O que pode fazer hoje |
|---|---|---|
| **Visitante (anônimo)** | padrão | Ver negócios ativos, categorias, páginas públicas |
| **Usuário autenticado** | signup e-mail/senha | Cadastrar o próprio negócio (entra pendente); nada além disso ainda (sem favoritos/avaliações reais) |
| **Admin** | promovido manualmente via SQL | Aprovar/rejeitar negócios, editar qualquer negócio, CRUD de categorias, trocar imagem de qualquer negócio |

**Não existem ainda** (mesmo que apareçam no doc de roadmap como planejados): moderador, "dono" como papel
distinto de usuário comum, profissional autônomo como entidade separada. Hoje só tem `user` e `admin`.

Dono de negócio **não tem dashboard** — depois de cadastrar, não consegue editar/ver métricas do próprio
negócio. Só o admin edita.

---

## 3. Regras de negócio — o que é REAL hoje vs. o que é intenção

### 3.1 Implementado e valendo de verdade

- **Todo negócio novo entra como `pending`.** Forçado por trigger no banco
  (`businesses_guard_status()`) sempre que quem grava não é admin — não dá pra burlar via app. Só admin
  muda o status (`active`, `suspended`, `rejected`).
- **Um negócio pode ter várias categorias.** Relação N:N via tabela `business_categories`
  (não é mais 1 categoria por negócio). Índice único garante no máximo **uma** categoria marcada como
  `is_primary=true` por negócio. Implementado tanto no formulário público (`/cadastrar-negocio`) quanto
  no painel admin (`/admin`, aba Negócios) — ambos agora deixam marcar múltiplas.
- **Categorias só são criadas/editadas/excluídas por admin.** RLS da tabela `categories` bloqueia
  escrita de não-admin. Exclusão falha (erro tratado na UI) se algum negócio ainda usa a categoria.
- **Visibilidade pública:** só negócio com `status='active'` aparece pra visitante anônimo. Dono vê o
  próprio mesmo pendente; admin vê tudo. Isso é RLS no banco, não só filtro de UI.
- **Slug é obrigatório e único** por negócio, gerado automaticamente a partir do nome
  (`slugify()`) — o usuário nunca digita o slug.
- **Honeypot anti-spam** (campo invisível) nos formulários públicos de contato, criar conta e cadastrar
  negócio. Não é CAPTCHA de verdade, só barra bots simples.
- **Upload de imagem de capa**: dono escolhe uma foto no ato do cadastro; admin pode trocar a de qualquer
  negócio depois. É **uma imagem só** por negócio (capa) — não existe galeria com múltiplas fotos ainda.

### 3.2 Só existe como texto/intenção — banco e código NÃO fazem nada disso

Isso é o desenho original do produto (documentado em `docs/farol-pitimbu-contexto.md`), mas nada disso
tem tabela, coluna ou lógica implementada:
- Planos pagos (Gratuito/Básico/Profissional/Premium), cobrança recorrente, Stripe, downgrade automático.
- Selo "Verificado" (exigiria CNPJ/CPF + comprovante) — não existe coluna `verified`.
- Avaliações/comentários (reviews), resposta do dono, moderação de avaliação reportada.
- Favoritos, histórico "já fui", roteiros salvos, alertas de promoção.
- Destaques semanais escolhidos pelo admin.
- Moderação automática de fotos (IA).
- Google OAuth (login só e-mail/senha por enquanto).
- Dashboard do dono do negócio (métricas, edição do próprio perfil).

**Se for discutir regra de negócio com outra IA, deixe claro pra ela qual dessas duas listas está usando
como premissa** — é fácil a conversa derivar pra cima de uma feature de plano pago que não existe.

### 3.3 Inconsistência conhecida que vale mencionar

O formulário público (`/cadastrar-negocio`) usa uma **lista fixa de 9 categorias** hardcoded no código
(`src/data/categoryLabels.js`). Já o painel admin busca as categorias **direto do banco**
(`useAdminCategories`, tabela `categories`). Ou seja: se um admin criar uma categoria nova pelo painel,
ela aparece na hora pra escolher num negócio criado *pelo admin*, mas **não aparece** no formulário
público até alguém atualizar `categoryLabels.js` no código. Isso não foi decidido como regra de negócio —
é uma pendência técnica que ainda não foi resolvida.

---

## 4. Modelo de dados (tabelas que existem de verdade no Postgres/Supabase)

```
auth.users 1—1 profiles
auth.users 1—* user_roles (role: admin | moderator | owner | professional | user — só admin/user usados)
businesses *—* categories   (via business_categories, com is_primary)
businesses  —  owner_id → profiles (nullable)
```

- **profiles**: id, full_name, avatar_url, phone. Criado automaticamente no signup.
- **user_roles**: user_id, role. `has_role()` é usada em todas as policies de RLS.
- **categories**: id, slug (único), name, description, icon, image_url, featured, order_index.
- **businesses**: id, owner_id, slug (único), name, subcategory, description, address, neighborhood, lat,
  lng, phone, whatsapp, email, website, instagram, facebook, hours (jsonb), price_range,
  status (`pending`|`active`|`suspended`|`rejected`), cover_image, created_at, updated_at.
  **Não tem** `category_id` (virou N:N), nem `verified`, `plan_id`, `avg_rating`, `review_count`,
  `views_count`, `gallery` — nenhuma dessas colunas existe.
- **business_categories**: business_id + category_id (PK composta), is_primary.

Nenhuma tabela de reviews, favorites, subscriptions, plans, analytics_events, weekly_highlights ou
professionals existe ainda.

---

## 5. Fluxos reais hoje

**Cadastro de negócio (usuário comum):**
1. Precisa estar logado (`/entrar`) — sem isso `/cadastrar-negocio` bloqueia (`ProtectedRoute`).
2. Wizard de 4 passos: dados básicos (nome + **uma ou mais categorias** + descrição) → endereço → fotos
   (opcional, 1 imagem de capa) → contato.
3. Envia → grava em `businesses` com `status='pending'` (forçado, não é escolha do usuário) + linhas em
   `business_categories` (uma por categoria marcada, a primeira selecionada vira `is_primary`).
4. Fica invisível pro público até um admin aprovar.

**Aprovação (admin):**
1. Painel `/admin`, aba Negócios, filtro "Pendente" (padrão ao abrir).
2. Botões "Aprovar" (→ `active`) / "Rejeitar" (→ `rejected`) direto na lista, sem passo intermediário.
3. Admin também pode criar negócio direto por lá (já nasce com o status que ele escolher no formulário,
   inclusive `active` de cara, pulando a fila de pendentes).

**Descoberta (visitante):**
1. Home → busca ou `/explorar` com filtros.
2. `/explorar` e `/negocio/:slug` leem **direto do Supabase** (não usam mais os arquivos mockados
   `src/data/businesses.js`/`professionals.js` em runtime pra negócios — esses arquivos hoje são
   resquício/dados de outras seções, não a fonte de negócios do diretório).

---

## 6. Ambientes (ponto que já gerou dúvida)

**Não existe banco "de teste" separado.** O `.env` local aponta para o **mesmo projeto Supabase**
(hospedado na nuvem) que a produção usa — contanto que o deploy (Vercel) esteja configurado com as
mesmas `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. Ou seja: qualquer negócio criado rodando
`npm run dev` localmente já cai no banco real, visível em produção assim que for aprovado (ou
imediatamente, se criado como `active` direto pelo admin). Isso é relevante pra discutir regra de negócio
porque **não há sandbox** hoje — todo teste manual mexe em dado real.

---

## 7. Perguntas em aberto que fazem sentido levar pra discussão

- Vale a pena ter uma categoria "primária" de fato (hoje é meio vestigial — só usada pra ordenar a
  exibição, não muda nada de regra de negócio real)?
- Sem plano pago implementado, faz sentido negócio ter posição "aleatória" ou por ordem de cadastro em
  `/explorar`? Hoje não há lógica de destaque nenhuma.
- Sem dono conseguir editar o próprio negócio, qual o processo real hoje se o dono errar um dado — abre
  chamado pro admin corrigir manualmente?
- Vale reduzir a lista de papéis (`moderator`, `owner`, `professional` no enum `app_role`) já que nenhum
  dos três é usado, ou manter porque o roadmap prevê usá-los depois?
