# Plano histórico de aplicação — regras de negócio (06/09/2026)

> Registro de 06/09/2026, preservado em 01/10/2026. As afirmações sobre migrations ainda não aplicadas e RPCs ausentes descrevem aquela data, não o estado atual da produção. Não execute este roteiro como atualização pendente. Confira o histórico do ambiente de destino; o procedimento atual está em [ambientes.md](ambientes.md).

Como aplicar e validar em ambiente de destino as 11 migrations criadas em
`supabase/migrations/20260906*`. Nada disto foi executado contra o Supabase de produção.

---

## 1. Situação dos ambientes

**Não existe banco de teste separado.** O `.env` local aponta para o mesmo projeto Supabase da
produção, e o Docker não está disponível nesta máquina, então `supabase start` não sobe a stack local.

A validação foi feita contra **PGlite** (Postgres 18 em WASM, devDependency `@electric-sql/pglite`):
`src/test/db/harness.js` cria um banco descartável, recria o mínimo dos schemas `auth` e `storage` do
Supabase e aplica **todas** as migrations na ordem, do zero. Os 58 testes de `src/test/db/` rodam RLS,
autorização e concorrência nesse banco, como `anon`, como usuário autenticado e como admin.

O que **não** é coberto por esse ambiente, e portanto ainda precisa de conferência manual no destino:

- comportamento real do PostgREST (formato de erro das RPCs, cache de schema);
- Storage do Supabase de verdade (as policies são exercitadas, o serviço de arquivos não);
- Auth de verdade (o harness insere direto em `auth.users`);
- dados reais — o harness começa vazio.

---

## 2. Ordem de aplicação

As migrations são incrementais e nenhuma migration anterior a 06/09/2026 foi editada.

| # | Arquivo | O que faz | Reversível? |
|---|---|---|---|
| 1 | `..0001_business_moderation_and_location` | enum de motivos, colunas de moderação, `service_area`, tabela `business_private_locations` | sim (drop das colunas) |
| 2 | `..0002_text_and_slug` | `normalize_search()`, índice de nome, `generate_business_slug()` | sim |
| 3 | `..0003_business_invariants` | dados mínimos, invariantes de categoria, constraint trigger | sim (drop do trigger) |
| 4 | `..0004_business_write_guard` | guard de colunas administrativas (passa a levantar erro) | sim (recriar versão 0008 antiga) |
| 5 | `..0005_business_rpcs` | RPCs de cadastro, edição, moderação, vínculo e duplicidade | sim |
| 6 | `..0006_business_change_requests` | tabela e RPCs de proposta de alteração | sim |
| 7 | `..0007_business_search` | `search_businesses()`, `business_neighborhoods()` | sim |
| 8 | `..0008_storage_review_paths` | corrige as policies de storage e cria a pasta `review/` | sim |
| 9 | `..0009_one_business_per_owner` | **índice único parcial de um negócio por conta** | sim (drop do índice) |
| 10 | `..0010_grants` | revoga escrita direta, concede execute nas RPCs, corrige GRANT de `categories` | sim |
| 11 | `..0011_profile_email` | e-mail no perfil para o vínculo manual | sim |

### Passo a passo

1. **Rode o diagnóstico primeiro**: `supabase/diagnostics/business_data_audit.sql` no SQL Editor.
   É somente leitura.
2. **Resolva o bloco 1 do diagnóstico** (contas com mais de um negócio). É o único bloqueante: a
   migration 9 falha de propósito, listando os casos, em vez de escolher sozinha qual negócio
   preservar. O caso esperado é o painel admin ter gravado `owner_id = conta do admin` em todo negócio
   criado por lá — esses devem ficar **sem proprietário**, porque não foram cadastrados pelo dono real.
   Como o índice ainda não existe nesse momento, a correção é um `update` revisado manualmente:

   ```sql
   -- Confira a lista antes. Um update por vez, com a decisão registrada.
   update public.businesses set owner_id = null where id = '<uuid do negócio>';
   ```

   Depois que as migrations estiverem aplicadas, o mesmo é feito por
   `admin_unlink_business_owner(<uuid>)`.
3. **Aplique**: `npx supabase db push`. Se a migration 9 falhar, o erro traz a lista completa; volte
   ao passo 2. As migrations 1–8 já terão sido aplicadas — são todas aditivas e o site continua
   funcionando com elas.
4. **Recarregue o schema do PostgREST** (Dashboard → API → Reload schema, ou aguardar o reload
   automático) para as novas RPCs ficarem visíveis.
5. **Rode o diagnóstico de novo** e trate os blocos 2, 3 e 5 como curadoria, no ritmo da operação.
   Nenhum deles tira negócio do ar.

### Recuperação

Cada migration é reversível pelo inverso do que cria (drop de índice, coluna, trigger ou função). O
ponto de não retorno prático é o passo 2, que altera `owner_id` de linhas reais — por isso ele é
manual, um caso por vez, e depois de listar os casos. Guarde a saída do bloco 1 antes de alterar
qualquer linha: é o registro de qual conta era dona de quê.

Se for preciso voltar atrás depois da aplicação, o mínimo para destravar a escrita antiga é
reconceder os GRANTs revogados pela migration 10 e recriar `businesses_guard_status()` na versão da
migration `20260903000008`.

---

## 3. Validação depois de aplicar

Em ambiente de destino, com uma conta de teste:

1. **Visitante**: `/explorar` lista, ordena alfabeticamente, filtra por categoria e bairro, e pagina.
   `/negocio/:slug` abre. Nenhum cadastro pendente aparece.
2. **Cadastro**: `/cadastrar-negocio` mostra as categorias do banco (crie uma nova em `/admin` e
   confira que ela aparece sem deploy). Envie um cadastro; ele deve entrar como pendente e o slug deve
   sair limpo, sem sufixo aleatório.
3. **Limite**: tente cadastrar um segundo negócio na mesma conta — deve redirecionar para
   `/meu-negocio`.
4. **Meu Negócio**: corrija o cadastro pendente. Rejeite pelo admin com motivo; confira que o motivo
   aparece para o dono e que "Reenviar para análise" devolve o cadastro para pendente.
5. **Aprovação**: aprove; confira que o negócio aparece em `/explorar`.
6. **Edição de ativo**: troque o telefone (entra na hora) e envie uma alteração de nome (o perfil
   público deve continuar com o nome antigo até a aprovação na aba Alterações).
7. **Storage**: suba uma capa durante o cadastro (esta é a operação que estava quebrada pela policy
   da migration 0012) e uma capa proposta com o negócio publicado.
8. **Regressão**: login, logout, `/contato`, home e as páginas estáticas.

---

## 4. O que ainda exige autorização explícita

- Aplicar as migrations em produção (`supabase db push` contra o projeto real).
- Qualquer alteração de `owner_id` nos dados existentes (passo 2).
- Deploy do front-end. O front novo depende das RPCs: **publique o front só depois das migrations**,
  porque `submit_business`, `search_businesses` e as RPCs de admin não existem no banco atual.
