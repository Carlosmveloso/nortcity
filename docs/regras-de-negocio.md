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
| Planos | Periodicidade, preços, recursos além de ofertas e retenção. Limites de ofertas ativas decididos em 05/10/2026 (seção 14). |
| Ofertas | Expiração automática por job, revisão de ofertas aprovadas/agendadas/suspensas, retenção ao excluir conta e bloqueio financeiro na reativação. |
| Financeiro | Tolerância, retries e efeito temporal do downgrade. |
| Verificação | Critérios e processo do selo Verificado. |

---

## 12. Invariantes comerciais a preservar (FUTURO)

Documentados para o desenho futuro não nascer incompatível. Assinatura, cobrança e downgrade **não
estão implementados**. Desde 05/10/2026 existem apenas os planos mínimos do módulo de ofertas, com
atribuição manual pelo admin (seção 14).

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

Também continuam fora do escopo: cobrança/Stripe, cupons, galeria comercial, patrocinados, selo
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

## 14. Ofertas e planos mínimos

**IMPLEMENTADO NO BANCO — Sprint 1, 05/10/2026, branch `feat/offers-sprint-01`.** Migrations `20261005000001` a `20261005000003`, cobertas por `src/test/db/offers.test.js`. Ainda sem interface, não aplicadas em nenhum ambiente hospedado e sem homologação.

### Planos

- `plans`: Gratuito (0 ofertas ativas), Básico (1), Profissional (3), Premium (5).
- Todo negócio começa no Gratuito: sem linha em `business_plan_assignments`, o plano é `gratuito`. Enquanto não houver assinatura, só o admin atribui outro plano, por `admin_set_business_plan`. Cada troca vira uma linha nova; nada é sobrescrito.
- A troca de plano não altera o status do negócio. O rebaixamento para um limite menor que o número de ofertas ativas é recusado (`plan_offer_limit_exceeded`): o admin suspende ou encerra antes.
- `plan_coupon_fees` guarda a taxa por cupom utilizado, com vigência. Os valores iniciais, desde 01/10/2026, são: Básico R$1,50, Profissional R$1,00 e Premium R$0,50. O Gratuito não tem taxa. Regras do mesmo plano não se sobrepõem no tempo, e uma regra publicada só pode ganhar data de fim; um valor novo exige uma regra nova.

### Oferta e versões

- `offers` guarda o negócio, o status e a versão publicada. O conteúdo comercial fica em `offer_versions`, e as decisões em `offer_reviews`, que só aceita inclusões.
- Só o proprietário do negócio cria ofertas (`create_offer`). Toda oferta começa em `draft`, com a versão 1.
- Só a versão em `draft` é editável. Ao ser enviada, ela fica imutável para qualquer papel. Quando a análise pede ajustes, a próxima edição cria a versão seguinte e a versão analisada fica como estava.
- Uma oferta ativa recebe revisão (`create_offer_revision`). A versão publicada continua no ar até a revisão ser aprovada e publicada. Ofertas aprovadas, agendadas ou suspensas ainda não recebem revisão.
- Os tipos de benefício são enum. O percentual deve ficar entre 0 e 100, e o desconto em valor deve ser positivo. Brinde, produto ou serviço adicional, condição especial e outros não exigem valor.
- O banco garante: `starts_at < ends_at`, `per_user_limit >= 1`, `total_limit > 0` quando informado, `per_user_limit <= total_limit` e `coupon_validity_minutes > 0`.
- Dias ISO (1 = segunda … 7 = domingo); os sete dias significam todos os dias. Faixas em `time_windows` no formato `[{day, start, end}]`, em horário local de Pitimbu. Cada faixa precisa estar em um dos dias escolhidos, não atravessa a meia-noite e não se sobrepõe a outra do mesmo dia. Lista vazia significa o dia inteiro.
- Negócio e conta com ofertas não são apagados em cascata: o histórico financeiro permanece. Um negócio com ofertas é suspenso, não excluído.

### Aceite financeiro e envio

- `accept_offer_financial_terms(oferta, taxa_exibida)` copia para a versão a regra vigente do plano: `fee_amount`, `fee_rule_id`, quem aceitou e quando. Se a taxa exibida não for a vigente, o aceite é recusado (`fee_changed`). No Gratuito o aceite é recusado (`plan_fee_unavailable`), então a oferta não passa de rascunho.
- Cada versão enviada carrega o próprio aceite. Depois de um pedido de ajustes, o reenvio exige novo aceite.
- `submit_offer_for_review` exige o negócio publicado, título, descrição e tipo de benefício, o valor nos descontos, o período ainda não encerrado, o prazo do cupom e o aceite da regra ainda vigente. Se o plano ou a taxa mudaram depois do aceite, o envio é recusado (`fee_changed`).
- O histórico registra `submitted` no primeiro envio e `resubmitted` depois de um pedido de ajustes.

### Transições

| De → para | Quem / operação | Observação |
|---|---|---|
| `draft`/`changes_requested` → `pending_review` | proprietário, `submit_offer_for_review` | aceite obrigatório |
| `pending_review` → `changes_requested` | admin, `request_offer_changes` | motivo obrigatório |
| `pending_review` → `rejected` | admin, `reject_offer` | motivo obrigatório; a oferta não é apagada |
| `pending_review` → `approved` | admin, `approve_offer` | aprovar não publica |
| `approved` → `active` | admin, `publish_offer` | início já passou; exige vaga no plano |
| `approved` → `scheduled` | admin, `publish_offer` | início futuro |
| `scheduled` → `active` | sistema, `activate_due_offers` | exige vaga no plano; ainda sem agendamento no cron |
| `active` → `suspended` | admin, `suspend_offer` | motivo obrigatório |
| `suspended` → `active` | admin, `reactivate_offer` | período válido, negócio ativo, vaga no plano |
| `approved`/`scheduled`/`active`/`suspended` → `ended` | admin, `end_offer` | definitivo |

A trigger `offers_guard` aplica essa máquina de estados a qualquer papel, inclusive `service_role`, e só aceita mudanças vindas das operações da tabela acima. `authenticated` não tem grant de escrita nas tabelas de ofertas.

Antes de ativar, `publish_offer` e `reactivate_offer` travam o negócio e contam as ofertas `active`. Sem vaga, recusam com `plan_offer_limit_reached` e a oferta continua `approved` (ou `suspended`). Se a vaga não existir na hora de ativar uma oferta agendada, ela continua `scheduled`.

As decisões sobre uma revisão de oferta ativa valem só para a versão: a oferta continua `active`. Publicar a revisão aprovada troca `published_version_id`, desde que o novo período já tenha começado.

### Visibilidade

- Visitante e outras contas veem só a versão publicada de uma oferta `active`, de um negócio `active` e dentro do período. Uma oferta vencida sai da vitrine mesmo antes de ser encerrada.
- O visitante (`anon`) recebe apenas as colunas de vitrine: sem autoria, sem andamento da análise e sem taxa. Consultas pela API precisam listar as colunas; `select=*` é recusado para `anon`.
- O proprietário vê as ofertas, versões e o histórico do próprio negócio. O admin vê tudo.
- `get_business_offer_terms` informa ao proprietário ou ao admin o plano, o limite, as ofertas ativas e a taxa vigente.

As sete decisões de implementação foram aprovadas na revisão de 05/10/2026: versão congelada a cada envio com novo aceite, rascunho no Gratuito, revisão só de oferta ativa, rebaixamento bloqueado, encerramento a partir de `approved`/`scheduled`, preservação do histórico e vitrine filtrada pelo período.

**Invariante de auditoria (ajuste da revisão de 05/10/2026).** Toda gravação em `offers`, `offer_versions` e `offer_reviews` passa pelas operações oficiais, inclusive quando o chamador é `service_role` ou `postgres`. As RPCs ligam o sinal interno `farol.offer_write` ao começar e o desligam antes de retornar. As triggers primeiro validam a transição (`invalid_transition`, `version_immutable`) e, se ela for válida mas vier de fora das RPCs, recusam com `direct_write_not_allowed`. O sinal vale só para a transação; como é desligado no fim de cada operação, um `UPDATE` direto feito depois de uma RPC, na mesma transação, também é recusado. Isso protege contra erro de Edge Function, script ou manutenção, não contra quem liga o sinal manualmente. Correções excepcionais exigem desligar a trigger como dono da tabela, de forma explícita.

**DÍVIDA TÉCNICA.**
- **Exclusão de negócio com histórico.** Hoje `admin_delete_business` falha por FK quando há ofertas. Isso preserva o histórico, mas não é a solução definitiva: o admin precisará retirar um negócio da operação sem destruir os registros. O modelo futuro é arquivamento (soft delete, por exemplo `archived`) em vez de exclusão física.
- **Jobs.** A vitrine já esconde ofertas vencidas, mas o status persistido precisa refletir a realidade. Quando os jobs forem configurados: agendar `activate_due_offers` (`scheduled` → `active`) e criar o encerramento automático `active` → `ended` ao fim de `ends_at`, para não acumular ofertas `active` encerradas há meses.

**PENDENTE/FUTURO.** Interface do proprietário e do admin, com mensagens de produto para códigos como `plan_fee_unavailable` ("Seu plano atual não inclui publicação de ofertas."); cupons e cobrança; bloqueio financeiro na reativação; revisão de oferta aprovada, agendada ou suspensa; retenção ao excluir conta com ofertas. Uma revisão em análise quando a oferta é encerrada continua no histórico e não pode mais ser publicada.
