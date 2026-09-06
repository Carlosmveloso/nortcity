-- Diagnóstico dos dados existentes antes de aplicar as migrations restritivas
-- de 06/09/2026. É SOMENTE LEITURA: nenhuma linha é alterada, apagada ou
-- reassociada. Rode no SQL Editor do Supabase (ou com `psql`) e revise cada
-- bloco antes de decidir a adequação — ver docs/plano-migracao-regras-negocio.md.
--
-- Ordem recomendada: rodar isto → resolver o bloco 1 (é o único que faz a
-- migration falhar) → aplicar as migrations → rodar de novo para conferir o
-- que continua fora do padrão.

-- ---------------------------------------------------------------------------
-- 1. BLOQUEANTE — contas com mais de um negócio
-- A migration 20260906000009_one_business_per_owner falha enquanto houver
-- linhas aqui. Decida qual negócio fica com cada conta; os demais devem ficar
-- sem proprietário (admin_unlink_business_owner) ou ser transferidos para a
-- conta certa. Não escolha automaticamente.
-- ---------------------------------------------------------------------------
select
    b.owner_id,
    p.email as conta,
    count(*) as negocios,
    string_agg(b.slug || ' (' || b.status || ')', ', ' order by b.created_at) as quais
from public.businesses b
left join public.profiles p on p.id = b.owner_id
where b.owner_id is not null
group by b.owner_id, p.email
having count(*) > 1;

-- Caso mais provável: o painel admin gravava owner_id = conta do admin em todo
-- negócio criado por lá. Esta consulta mostra os negócios que pertencem a
-- alguma conta admin — candidatos naturais a ficar sem proprietário, já que
-- não foram cadastrados pelo dono real.
select b.id, b.slug, b.name, b.status, p.email as admin_dono
from public.businesses b
join public.user_roles r on r.user_id = b.owner_id and r.role = 'admin'
left join public.profiles p on p.id = b.owner_id
order by b.created_at;

-- ---------------------------------------------------------------------------
-- 2. Categorias fora do intervalo de 1 a 3, ou sem primária
-- Não bloqueia a aplicação das migrations (a constraint trigger só dispara
-- quando as categorias do negócio são alteradas), mas estes cadastros vão
-- recusar qualquer edição de categoria até serem corrigidos.
-- ---------------------------------------------------------------------------
select
    b.id, b.slug, b.name, b.status,
    count(bc.category_id) as categorias,
    count(*) filter (where bc.is_primary) as primarias
from public.businesses b
left join public.business_categories bc on bc.business_id = b.id
group by b.id, b.slug, b.name, b.status
having count(bc.category_id) not between 1 and 3
    or count(*) filter (where bc.is_primary) <> 1
order by b.status, b.name;

-- ---------------------------------------------------------------------------
-- 3. Negócios publicados que não atendem aos dados mínimos de hoje
-- Nenhum deles sai do ar: a validação só roda em cadastro novo, reenvio,
-- aprovação e em edição que mexa no campo. A lista serve para priorizar
-- curadoria — e para saber quais cadastros vão pedir texto novo se alguém
-- editar a descrição.
-- ---------------------------------------------------------------------------
select
    b.slug, b.name, b.status,
    coalesce(length(btrim(b.description)), 0) as tamanho_descricao,
    case when public.business_has_location(b) then 'ok' else 'sem localização' end as localizacao,
    case when public.business_has_public_contact(b) then 'ok' else 'sem contato válido' end as contato
from public.businesses b
where b.status = 'active'
  and (
      coalesce(length(btrim(b.description)), 0) < 40
      or not public.business_has_location(b)
      or not public.business_has_public_contact(b)
  )
order by b.name;

-- ---------------------------------------------------------------------------
-- 4. Suspeitas de duplicidade entre os cadastros que já existem
-- A detecção passa a rodar automaticamente em cadastro novo; isto aplica o
-- mesmo critério ao acervo atual. Cada caso é decisão humana: nada é fundido
-- nem apagado por semelhança.
-- ---------------------------------------------------------------------------
select b.slug, b.name, b.status, public.find_duplicate_candidates(b.id) as candidatos
from public.businesses b
where jsonb_array_length(public.find_duplicate_candidates(b.id)) > 0
order by b.name;

-- ---------------------------------------------------------------------------
-- 5. Rejeitados e suspensos sem motivo registrado
-- Cadastros decididos antes de o motivo passar a ser obrigatório. O
-- proprietário não vê explicação nenhuma em Meu Negócio até um admin
-- reprocessar a decisão.
-- ---------------------------------------------------------------------------
select b.slug, b.name, b.status, b.moderated_at
from public.businesses b
where b.status in ('rejected', 'suspended')
  and b.moderation_reason is null
order by b.name;

-- ---------------------------------------------------------------------------
-- 6. Slugs com o sufixo aleatório antigo
-- slugify() no cliente sempre acrescentava 5 caracteres aleatórios. Não é
-- erro e não precisa ser corrigido — trocar o slug quebra links já
-- compartilhados. Os cadastros novos passam a receber slug limpo.
-- ---------------------------------------------------------------------------
select count(*) filter (where slug ~ '-[a-z0-9]{5}$') as com_sufixo_aleatorio,
       count(*) as total
from public.businesses;
