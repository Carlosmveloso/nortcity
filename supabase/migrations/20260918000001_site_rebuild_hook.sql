-- Republicar o site quando a vitrine muda.
--
-- A prévia de compartilhamento (WhatsApp, Facebook, Google) é gerada no build:
-- `sharePreviews` em vite.config.js lê os negócios ativos e grava
-- dist/negocio/<slug>.html com as meta tags e dist/og/<slug>.jpg com o card
-- 1200x630. O crawler do WhatsApp não executa JavaScript, então é só isso que
-- ele enxerga — o usePageMeta do cliente não o alcança.
--
-- Consequência medida em 18/09/2026: dos 85 negócios ativos no banco, 83 tinham
-- página publicada. Os dois aprovados depois do último deploy respondiam
-- HTTP 404 com a meta da página "não encontrada", e compartilhá-los mostrava a
-- imagem genérica da home. A ficha abria normal para quem clicava (o React
-- Router resolve no cliente), e foi isso que escondeu o problema por semanas.
--
-- O mesmo congelamento atinge quem troca a capa depois de publicado: o card
-- continua com a foto antiga até alguém lembrar de fazer deploy.
--
-- A correção não é gerar meta sob demanda: 60 das 85 capas estão em WebP no
-- Storage, formato que o WhatsApp não renderiza de forma confiável, e todo o
-- pipeline que converte para JPEG já existe e funciona no build. O que faltava
-- era o build rodar sozinho. Então: uma trigger marca "precisa republicar" e um
-- job varre a marcação e chama o Deploy Hook da Vercel.
--
-- Pré-requisitos no projeto hospedado, uma vez só (ver CLAUDE.md seção 11):
--   1. Database > Extensions: habilitar `pg_net` e `pg_cron`.
--   2. SQL Editor: select vault.create_secret('<url do deploy hook>', 'vercel_deploy_hook');
-- Sem o passo 1 esta migration falha alto, que é o comportamento desejado.
-- Sem o passo 2 ela aplica e o disparo vira no-op silencioso — é o que permite
-- rodar as migrations em dev e no harness de teste sem tentar sair para a rede.


-- Estado de uma linha só. O `check (id)` com pk booleana é o que garante isso:
-- não existe segunda linha possível.
--
-- A decisão de publicar é por CONTADOR, não por relógio. A primeira versão
-- comparava `requested_at > fired_at` e perdia alteração em silêncio quando a
-- marcação e o disparo caíam no mesmo tique do relógio — o teste
-- "alteração feita depois do disparo sai no disparo seguinte" pegou isso no
-- PGlite, que tem resolução de milissegundo. Com contador não há empate
-- possível: o disparo reconhece a versão exata que leu, e qualquer marcação
-- posterior fica estritamente à frente.
create table public.site_rebuild (
    id boolean primary key default true check (id),
    requested_seq bigint not null default 0,
    fired_seq bigint not null default 0,
    -- Só para quem for olhar a tabela querendo saber o que aconteceu e quando.
    requested_at timestamptz,
    fired_at timestamptz
);

insert into public.site_rebuild (id) values (true);

-- Estado de infraestrutura, não dado do app: `anon` e `authenticated` não têm
-- nada aqui, e isso é deliberado. A lição recorrente deste projeto é GRANT
-- esquecido (businesses, categories, assert_business_categories); esta é a
-- exceção — se um dia /explorar quebrar, não é por falta de grant nesta tabela.
revoke all on public.site_rebuild from anon, authenticated;
alter table public.site_rebuild enable row level security;


-- Marca que há algo por publicar. `security definer` porque a tabela não é
-- acessível para quem dispara a trigger (o dono do negócio, o admin).
create or replace function public.mark_site_rebuild()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.site_rebuild
       set requested_seq = requested_seq + 1,
           requested_at = now();
    return null;
end;
$$;

-- O que conta como "a vitrine mudou" é exatamente o que businessPageMeta()
-- consome em src/lib/siteMeta.js — slug (a URL), name (og:title), description e
-- subcategory (og:description), cover_image (og:image) — mais entrar ou sair de
-- `active`, que decide se a página existe. Telefone, endereço e horário ficam de
-- fora de propósito: corrigir um telefone não deve custar um build.
create trigger businesses_mark_site_rebuild_insert
after insert on public.businesses
for each row when (new.status = 'active')
execute function public.mark_site_rebuild();

create trigger businesses_mark_site_rebuild_delete
after delete on public.businesses
for each row when (old.status = 'active')
execute function public.mark_site_rebuild();

create trigger businesses_mark_site_rebuild_update
after update on public.businesses
for each row when (
    (old.status = 'active') is distinct from (new.status = 'active')
    or (
        new.status = 'active'
        and (old.slug, old.name, old.description, old.subcategory, old.cover_image)
            is distinct from
            (new.slug, new.name, new.description, new.subcategory, new.cover_image)
    )
)
execute function public.mark_site_rebuild();


-- A categoria entra na og:description (businessPageMeta monta a frase com o
-- rótulo da categoria), então mexer no vínculo também invalida a prévia.
create or replace function public.mark_site_rebuild_from_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business uuid;
begin
    -- NEW não está atribuído num trigger de DELETE; ler o campo direto levanta
    -- "record new is not assigned yet".
    if tg_op = 'DELETE' then
        v_business := old.business_id;
    else
        v_business := new.business_id;
    end if;

    if exists (select 1 from public.businesses where id = v_business and status = 'active') then
        update public.site_rebuild
           set requested_seq = requested_seq + 1,
               requested_at = now();
    end if;

    return null;
end;
$$;

create trigger business_categories_mark_site_rebuild
after insert or update or delete on public.business_categories
for each row execute function public.mark_site_rebuild_from_category();


-- Chama o Deploy Hook se houver algo por publicar. Devolve true quando
-- disparou, para o job e o SQL Editor conseguirem distinguir "nada a fazer" de
-- "pedido enviado".
--
-- Por que marcar e varrer, em vez de a trigger chamar o hook direto: aprovar um
-- negócio custa mais de um UPDATE (admin_update_business e
-- set_business_cover_image são RPCs separadas, transações separadas), e uma
-- tarde de moderação viraria um build por clique. Varrer junta a rajada num
-- build só. Ao contrário de um cooldown por tempo, não descarta a última
-- alteração da rajada: o que não coube neste disparo continua com
-- requested_seq > fired_seq e sai no próximo.
create or replace function public.fire_site_rebuild()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_state public.site_rebuild;
    v_url text;
begin
    -- O lock serializa contra as triggers: quem for marcar durante o disparo
    -- espera, e sua marcação incrementa o contador para além do que lemos aqui.
    select * into v_state from public.site_rebuild for update;

    if not found or v_state.requested_seq <= v_state.fired_seq then
        return false;
    end if;

    select decrypted_secret into v_url
      from vault.decrypted_secrets
     where name = 'vercel_deploy_hook';

    if v_url is null then
        -- Projeto sem o segredo (dev, harness de teste, um fork): não é erro, é
        -- ausência de configuração. Sair sem tocar em fired_seq deixa o pedido
        -- de pé, então o primeiro disparo depois do segredo publica o acumulado.
        return false;
    end if;

    perform net.http_post(url => v_url, body => '{}'::jsonb);

    -- Reconhece a versão que foi lida, não a atual: fica explícito que o build
    -- pedido cobre até `v_state.requested_seq` e que tudo o que chegar depois
    -- pertence ao próximo disparo. No pior caso sobra um build, que é o lado
    -- seguro para errar.
    update public.site_rebuild
       set fired_seq = v_state.requested_seq,
           fired_at = now();
    return true;
end;
$$;

-- Disparar build é operação de infraestrutura: ninguém do app chama isto.
-- (As duas funções de trigger acima ficam com o execute default de propósito —
-- revogá-lo é o erro que já quebrou toda escrita de categoria neste projeto,
-- ver CLAUDE.md. Elas são inofensivas: chamar função de trigger direto é erro
-- do Postgres, e ambas são SECURITY DEFINER.)
revoke all on function public.fire_site_rebuild() from public;

select cron.schedule('site-rebuild', '*/3 * * * *', 'select public.fire_site_rebuild()');
