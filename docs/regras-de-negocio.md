# Regras de negócio — Farol Pitimbu

Estado **implementado** em 06/09/2026, depois da execução das fases 0 a 4 do núcleo funcional.
Documento de referência para o que vale hoje; o retrato anterior (05/09) está em
`docs/contexto-regras-negocio.md` e ficou desatualizado nos pontos marcados abaixo.

| Marcador | Significado |
|---|---|
| **ATUAL** | Implementado e valendo, verificado por teste automatizado ou inspeção do código. |
| **PENDENTE** | Decisão de produto ainda aberta. |
| **FUTURO** | Fora do escopo desta execução. |

Ambientes e validação: [ambientes.md](ambientes.md). O plano de 06/09 é histórico.

Atualização documental de 01/10/2026: o código inclui analytics administrativo e republicação automática (migrations de 15, 18 e 23/09). As regras abaixo descrevem o núcleo de negócios; não comprovam a aplicação das migrations em produção.
Diagnóstico dos dados antes de aplicar: `supabase/diagnostics/business_data_audit.sql`.

---

## 1. Papéis, propriedade e autorização

**ATUAL.** Só `user` e `admin` são efetivos. `moderator`, `owner` e `professional` continuam no enum
`app_role` sem uso — não foram removidos porque o roadmap ainda prevê `moderator`.

**ATUAL.** Propriedade é `businesses.owner_id`, nunca uma role. Uma conta possui **zero ou um**
negócio, contando todos os status; um negócio tem zero ou um proprietário. A garantia é o índice
parcial `businesses_one_per_owner` — não uma checagem de aplicação —, então duas requisições
simultâneas não produzem dois vínculos.

**ATUAL.** Admin cria negócio **sem proprietário**. Antes, `Admin.jsx` gravava `owner_id = conta do
admin` em tudo que criava por lá: a conta do admin virava dona de dezenas de negócios, o que é
incompatível com o limite de um por conta. Corrigido em `admin_create_business`.

**ATUAL — mudança estrutural.** `authenticated` não tem mais GRANT de `insert`/`update` em
`businesses` nem de escrita em `business_categories`. Toda alteração passa por RPC `SECURITY DEFINER`,
que valida autorização, invariantes e concorrência numa transação só. O motivo: negócio e categorias
vivem em duas tabelas e o PostgREST não tem transação entre chamadas — o fluxo antigo deixava negócio
sem categoria sempre que a segunda chamada falhava. O guard `businesses_guard_status()` continua como
segunda barreira e passou a **levantar erro** em vez de reverter em silêncio; além de `status`, protege
`owner_id`, `slug` e os campos de moderação e duplicidade.

---

## 2. Ciclo de vida e moderação

**ATUAL.** Quatro status, com as transições concentradas em `moderate_business(id, ação, motivo, nota)`:

| De → para | Quem | Motivo |
|---|---|---|
| novo → `pending` | cadastro comum autenticado | — |
| novo → `pending`/`active` | admin | — (publicar direto exige o mínimo cumprido) |
| `pending` → `active` | admin | dispensado |
| `pending` → `rejected` | admin | **obrigatório** |
| `active` → `suspended` | admin | **obrigatório** |
| `suspended` → `active` | admin | dispensado |
| `rejected` → `pending` | proprietário, via `resubmit_business` | — |

Qualquer outra transição é recusada com `invalid_transition`.

**ATUAL.** Motivo é enum (`business_moderation_reason`), com data (`moderated_at`) e responsável
(`moderated_by`). O proprietário vê o rótulo e a explicação em Meu Negócio; `moderation_note` é
observação interna e **não** é exibida a ele. Encerramento de negócio usa `suspended` com motivo
`business_closed` — não existe status `closed`.

**ATUAL.** Proprietário não exclui. Admin exclui por `admin_delete_business`, e o botão do painel só
aparece para negócio que não está publicado. Falha de pagamento nunca será motivo de suspensão.

---

## 3. Categorias

**ATUAL.** De uma a três categorias, exatamente uma primária. A garantia é uma constraint trigger
`DEFERRABLE INITIALLY DEFERRED` em `business_categories`: a troca do conjunto inteiro acontece numa
transação e, se o resultado for inválido, tudo é desfeito — não existe estado intermediário em que o
negócio fica sem categoria ou com primária inválida.

**ATUAL.** Categoria única vira primária automaticamente; com mais de uma, a escolha é explícita e tem
de pertencer ao conjunto. Nunca "a primeira que foi clicada".

**ATUAL.** `categories` é fonte única, inclusive no formulário público — a lista fixa de nove
categorias em `src/data/categoryLabels.js` deixou de ser fonte de verdade (continua existindo como
fallback de rótulo para dados antigos e para as páginas estáticas de `src/data/categories.js`).
Categoria criada no admin aparece no cadastro público sem deploy.

**ATUAL.** Só admin cria/edita/exclui categoria, e categoria em uso não pode ser excluída
(`on delete restrict`). **A escrita nunca funcionou de verdade**: a migration `20260903000009` concedeu
apenas `select` em `categories` para `authenticated`, então o Postgres negava insert/update/delete
antes de avaliar a policy. Corrigido na migration `20260906000010`.

**FUTURO.** Desativar categoria sem apagar histórico.

---

## 4. Dados mínimos e aprovação

**ATUAL.** Cadastro exige nome, uma a três categorias com primária, localização
identificável e ao menos um contato público válido. Um contato só conta como válido se for utilizável:
telefone/WhatsApp com 10 a 15 dígitos, e-mail com domínio, site com ponto, Instagram com dois
caracteres ou mais.

**ATUAL — decisão de 07/09/2026.** Descrição **opcional**, com teto de **1500** caracteres. O mínimo
de 40 caracteres, decidido em 06/09/2026, foi revertido: dos 78 negócios publicados, 53 têm descrição
mais curta que isso e 30 não têm endereço nem bairro, e o editor do `/admin` recusava a gravação
inteira quando qualquer campo não atendia ao contrato — 59 dos 78 cadastros ficaram impossíveis de
editar, nem para corrigir um telefone. Descrição vazia é um estado válido; o teto é checado quando o
texto é escrito, nunca como pedágio para mexer em outro campo.

**ATUAL — compatibilidade.** A localização segue a mesma regra: é validada quando é criada ou
alterada. O editor do `/admin` espelha isso (`checkLocation` em `validateBusinessForm`) — antes ele
era mais rígido que o banco e essa divergência era o bug. Reativar um negócio antigo não reabre
contrato nenhum. Nenhum cadastro existente saiu do ar.

**ATUAL.** Capa, horário, faixa de preço e coordenadas continuam opcionais. Não se exige CNPJ, CPF,
documento, plano pago nem rede social específica.

**ATUAL.** `NegocioPerfil` não assume mais que existe telefone — antes, `business.phone.replace(...)`
derrubava a página de qualquer negócio cujo contato fosse só Instagram ou e-mail, o que tornava o
mínimo aprovado impossível de exibir.

---

## 5. Localização e profissionais autônomos

**ATUAL.** Cobertura é o município inteiro; negócio de município vizinho que atende Pitimbu entra
normalmente, sem rótulo de "de fora" e sem endereço fictício.

**ATUAL.** Serviço móvel e profissional autônomo se cadastram sem endereço público: preenchem
`service_area`, que aparece na ficha no lugar do endereço. Nada de tabela `professionals`, role
`professional` ou `entity_type` — é o mesmo `businesses`, com a mesma moderação, busca e template.

**ATUAL.** Endereço privado (residencial, para conferência da equipe) fica em
`business_private_locations`, uma tabela sem GRANT para `anon` e com RLS de dono/admin. Não é
"escondido no componente": não existe caminho de leitura pública para esse dado.

**FUTURO.** Catálogo controlado de localidades; modelo explícito de endereço físico público × privado
× atendimento móvel; ordenação por proximidade.

---

## 6. Busca e descoberta

**ATUAL.** `/explorar` usa a RPC `search_businesses`, que resolve ordenação, relevância e paginação
sobre o conjunto inteiro. Antes a página baixava todos os ativos sem `ORDER BY` e paginava no cliente.

- Sem texto: ordem alfabética por nome, com acento normalizado, inclusive dentro de categoria.
- Com texto, prioridade: nome (1) → categoria primária (2) → categorias secundárias (3) → descrição (4)
  → bairro/endereço/área de atendimento (5).
- Desempate sempre por nome normalizado e depois por id, para a ordem não mudar entre páginas.
- Filtros de dimensões diferentes são cumulativos (categoria + bairro + faixa de preço). Categoria
  casa tanto na primária quanto nas secundárias.
- Nenhuma promoção por data de cadastro, origem administrativa, completude, aleatoriedade ou plano.

**ATUAL.** A função é `SECURITY INVOKER`: o RLS continua sendo a autoridade sobre o que é público, então
nem a busca nem a paginação conseguem vazar cadastro pendente, rejeitado ou suspenso.

**PENDENTE.** Semântica de múltiplas opções no mesmo filtro. Hoje cada filtro é seleção única, como já
era; não foi alterado sem decisão.

**FUTURO.** Proximidade geográfica; destaques pagos (que, quando existirem, terão de ser identificados
visualmente, sem mistura no ranking orgânico).

---

## 7. Duplicidade, slug e vínculo manual

**ATUAL.** `find_duplicate_candidates()` combina nome, endereço, telefone, WhatsApp, Instagram e site,
com pontuação. Nome igual pontua 3 e o limite de suspeita é 4: homônimo legítimo não vira suspeita
sozinho, mas nome igual + mesmo telefone vira. O cadastro suspeito **continua pendente** e o admin vê o
alerta — nada é bloqueado nem fundido automaticamente.

**ATUAL.** Slug legível com sufixo numérico só quando há colisão real: o primeiro "Bar do Zé" fica
`bar-do-ze` e o segundo, legítimo, `bar-do-ze-2`. Antes, `slugify()` no cliente sempre acrescentava
cinco caracteres aleatórios. A geração é no banco, com retry em `unique_violation` — o UNIQUE continua
sendo a autoridade sob concorrência. Slugs antigos não foram alterados: trocar slug quebra link já
compartilhado.

**ATUAL.** `admin_link_business_owner` só vincula negócio **sem** proprietário e recusa conta que já
tenha outro negócio, inclusive sob concorrência. Não existe reivindicação pública, botão "este negócio
é seu?" nem `business_claims`.

**ATUAL.** `admin_resolve_duplicate(original, duplicata)` apaga a duplicata e vincula a conta ao
original numa transação, sem passar por um estado em que a conta tem dois negócios. Recusa duplicata
já publicada — negócio no ar não é apagado por semelhança.

**ATUAL.** O painel permite remover o proprietário e vincular outro pelo procedimento administrativo. As RPCs continuam impedindo vínculo com conta que já possui outro negócio.

**FUTURO.** Troca atômica entre contas que já possuem negócios; sugerir negócios parecidos antes do envio do formulário.

---

## 8. Meu Negócio (`/meu-negocio`)

**ATUAL.** Área mínima para todo proprietário, sem depender de plano pago. Mostra o negócio, o status
com explicação, o motivo de rejeição ou suspensão em linguagem compreensível, e os dados básicos da
conta. Estados vazio, de carregamento e de erro são tratados.

- Sem negócio: caminho claro para o cadastro.
- Com negócio: `/cadastrar-negocio` redireciona para cá, em vez de abrir um segundo cadastro.
- `pending`/`rejected`: edição completa do cadastro; rejeitado ganha "Reenviar para análise".
- `active`: ver seção 9.
- `suspended`: consulta e motivo, sem reativar e sem editar.

**ATUAL.** O bloco de plano mostra apenas a condição gratuita real. Não há métrica fictícia nem botão
de compra sem funcionalidade.

**PENDENTE.** Edição corretiva pelo dono enquanto suspenso. Não foi liberada por inferência.

---

## 9. Edição de negócio ativo

**ATUAL — decisão de 06/09/2026.** No plano Gratuito, o proprietário de um negócio publicado pode
alterar **nome, imagem, telefone, categorias, endereço e descrição**. Telefone é o único simples
(publica na hora); os outros cinco são sensíveis e viram proposta. Campos fora da lista (WhatsApp,
e-mail, site, Instagram, horários, faixa de preço, subcategoria, área de atendimento) são definidos no
cadastro e depois só o admin altera.

> **Divergência registrada:** EDI-01 da especificação consolidada previa WhatsApp, e-mail, horário,
> redes e site como alterações simples. A decisão de 06/09/2026 restringiu a matriz do Gratuito, e é a
> mais recente — prevalece. A separação simples × sensível continua valendo para o que estiver
> disponível.

**ATUAL.** Proposta em `business_change_requests`, com autor, campos propostos, **snapshot dos valores
base**, categorias propostas, caminho da capa proposta e decisão. Enquanto a proposta espera, o negócio
continua `active` e público com o conteúdo aprovado.

**ATUAL.** Aprovar aplica **só os campos propostos**, então uma alteração simples feita depois (o
telefone) não é sobrescrita. Recusar preserva a versão anterior.

**ATUAL — conflito.** Se algum campo proposto mudou desde a criação da proposta (correção do admin,
outra aprovação), a aprovação falha com `base_changed` em vez de sobrescrever às cegas. A comparação é
contra o snapshot dos valores base, não contra `updated_at` — assim uma edição simples posterior não
gera falso conflito.

**ATUAL.** A aprovação revalida autorização, status e invariantes: proposta não reativa negócio
suspenso (`business_not_active`) nem transfere dono.

**ATUAL — capa proposta.** Vai para `{business_id}/review/<uuid>.<ext>`, caminho que a policy de
leitura pública exclui; o admin vê por URL assinada. A capa aprovada em `{business_id}/cover.*` não é
tocada até a decisão. Na aprovação, o arquivo é copiado para um caminho público **antes** da RPC: se a
cópia falhar, nada é aplicado.

**ATUAL — decisão de 06/09/2026.** Uma proposta aberta por negócio de cada vez, garantido por índice
único parcial. O dono pode cancelar a sua e enviar outra.

---

## 10. Storage

**ATUAL — bug corrigido.** As policies de upload do dono (migration `20260903000012`) usavam
`storage.foldername(name)` dentro de um subquery sobre `businesses`, e `name` resolvia para
`businesses.name` — o nome do negócio — em vez do caminho do arquivo. A policy comparava o uuid do
negócio com o primeiro pedaço do nome dele, o que nunca casa: **o upload de capa pelo dono durante o
cadastro sempre foi negado pelo RLS**, e a UI seguia sem imagem. Corrigido com referência qualificada
(`objects.name`) na migration `20260906000008`.

**ATUAL.** O dono só escreve em `{id}/cover.*` enquanto o cadastro está pendente ou rejeitado. Com o
negócio publicado, o upload vai para `review/` e só entra no ar quando a alteração for aprovada — sem
isso a capa seria o único campo sensível alterável sem moderação.

---

## 11. Decisões de produto ainda em aberto

| Ponto | O que falta decidir |
|---|---|
| Filtros | Semântica de múltiplas opções dentro do mesmo filtro em `/explorar`. |
| Suspensão | Se o dono poderá editar o cadastro enquanto suspenso. |
| Busca | Se a relevância deve casar palavra a palavra (hoje é a expressão inteira como substring). |
| Propriedade | Transferência entre dois proprietários já vinculados. |
| Planos | Periodicidade, limites, recursos e retenção. |
| Financeiro | Tolerância, retries e efeito temporal do downgrade. |
| Verificação | Critérios e processo do selo Verificado. |

---

## 12. Invariantes comerciais a preservar (FUTURO)

Documentados para o desenho futuro não nascer incompatível. **Nada disto está implementado** e nenhuma
tabela comercial foi criada.

- Planos pretendidos: Gratuito, Básico R$39, Profissional R$89, Premium R$179. Periodicidade e limites
  não fechados.
- Plano pertence ao negócio; no máximo uma assinatura ativa por negócio.
- Propriedade, status do negócio e assinatura são independentes.
- Upgrade depende de pagamento confirmado e não aprova nem reativa negócio.
- Cancelamento retorna ao Gratuito ao fim do período pago.
- Inadimplência terá tolerância e downgrade, nunca suspensão do negócio.
- Downgrade oculta excedentes conforme o limite, sem apagar dados.
- Premium não implica Verificado nem recomendação editorial.
- Publicidade terá de ser identificada, sem mistura silenciosa no ranking orgânico.

Analytics administrativo está implementado; métricas comerciais para proprietários continuam futuras.

Também continuam fora do escopo: cobrança/Stripe, galeria comercial, ofertas, patrocinados, selo
Verificado, avaliações, roteiros, alertas, moderação de fotos por IA, Google OAuth,
moderador com permissões próprias, equipes, múltiplos negócios por conta, status `closed` e
reivindicação pública.

## 13. Favoritos por conta

**ATUAL — implementação de 04/10/2026, homologada no desenvolvimento; migration aplicada em produção em 05/10/2026.** Uma conta autenticada salva negócios publicados em `business_favorites`. A chave primária `(user_id, business_id)` impede duplicatas, inclusive sob pedidos simultâneos. Favoritos são gratuitos e independentes da propriedade de um negócio.

RLS permite ler, inserir e remover apenas os próprios vínculos, inclusive para contas administrativas. Visitantes não têm grants e não existem contagens públicas. A inserção exige negócio `active`; UPDATE não é permitido. Excluir conta ou negócio remove seus vínculos por cascata.

A lista mostra somente negócios ativos, mesmo para proprietários e administradores que podem ler outros status no banco. Suspender não apaga o favorito: ele reaparece após republicação. A remoção do vínculo continua permitida mesmo com o negócio fora do ar.

Cards e ficha compartilham o estado na sessão. A lista é consultada ao abrir/recarregar a aplicação, paginando sem truncar no limite da API. Troca de conta e logout descartam o estado anterior e suas respostas pendentes. Falha de gravação mantém o estado confirmado; falha de leitura permite tentar novamente.

Visitante que tenta salvar é encaminhado ao login e retorna à página com seus filtros. Depois de entrar, confirma o salvamento pelo coração. A página `/favoritos` oferece acesso à conta para visitantes.

**FUTURO.** Favoritos anônimos, sincronização offline/em tempo real entre abas, pastas, compartilhamento de listas, métricas e recomendações. A aplicação em produção deve anteceder a publicação do front-end desta versão.
