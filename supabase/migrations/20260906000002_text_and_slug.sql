-- Normalização de texto e geração de slug no banco.
--
-- A normalização espelha src/lib/text.js (minúsculas + sem acento) para que a
-- busca do servidor e a do cliente concordem. Usa translate() em vez da
-- extensão unaccent: é IMMUTABLE de verdade (dá para indexar), não depende de
-- extensão instalada e cobre o alfabeto português, que é o único que aparece
-- em nomes de negócio de Pitimbu.

create or replace function public.normalize_search(p_text text)
returns text
language sql
immutable
strict
as $$
    select lower(translate(
        p_text,
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
        'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
    ));
$$;

comment on function public.normalize_search(text) is
    'Minúsculas sem acento, para busca e ordenação alfabética. Espelha normalize() de src/lib/text.js.';

create index businesses_name_normalized_idx
    on public.businesses (public.normalize_search(name));

-- Slug legível, com sufixo numérico só quando há colisão real (DUP-04).
-- A versão anterior (slugify() no cliente) sempre acrescentava 5 caracteres
-- aleatórios: evitava colisão, mas deixava toda URL ilegível. Aqui o primeiro
-- negócio chamado "Bar do Zé" fica /negocio/bar-do-ze e o segundo, legítimo e
-- homônimo, vira bar-do-ze-2. O UNIQUE do banco continua sendo a autoridade:
-- quem chama isto precisa tratar unique_violation e tentar de novo, porque
-- duas transações concorrentes podem calcular o mesmo sufixo.
create or replace function public.generate_business_slug(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_base text;
    v_candidate text;
    v_suffix int := 1;
begin
    v_base := regexp_replace(
        regexp_replace(public.normalize_search(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)', '', 'g'
    );

    if v_base = '' then
        v_base := 'negocio';
    end if;

    v_base := left(v_base, 60);
    v_candidate := v_base;

    while exists (select 1 from public.businesses where slug = v_candidate) loop
        v_suffix := v_suffix + 1;
        v_candidate := v_base || '-' || v_suffix;
    end loop;

    return v_candidate;
end;
$$;
