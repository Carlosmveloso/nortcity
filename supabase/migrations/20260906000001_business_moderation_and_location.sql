-- Fase 1 — colunas de moderação (motivo/data/autor), área de atendimento e
-- localização privada.
--
-- Contexto: aprovar não exige justificativa, mas rejeitar e suspender exigem
-- motivo estruturado (MOD-02). O motivo é mostrado ao dono em /meu-negocio,
-- então precisa ser um enum traduzível, não texto livre — `moderation_note`
-- fica para a observação complementar, que NÃO é exibida ao público.
--
-- `service_area` existe para profissional autônomo / serviço móvel que atende
-- Pitimbu sem endereço público (LOC-02, AUT-02). Quando o endereço existe mas
-- não pode ser publicado (endereço residencial), ele vai para
-- `business_private_locations`, que anon nem sequer tem GRANT para ler — a
-- coluna pública `businesses.address` passa a conter apenas endereço público.

create type business_moderation_reason as enum (
    'duplicate_business',
    'insufficient_information',
    'invalid_contact',
    'invalid_location',
    'wrong_category',
    'inappropriate_content',
    'business_not_found',
    'outside_service_area',
    'suspected_fraud',
    'business_closed',
    'other'
);

alter table public.businesses
    add column service_area text,
    add column submitted_at timestamptz,
    add column moderation_reason business_moderation_reason,
    add column moderation_note text,
    add column moderated_at timestamptz,
    add column moderated_by uuid references public.profiles(id) on delete set null,
    add column duplicate_candidates jsonb,
    add column duplicate_reviewed_at timestamptz;

-- Negócios que já existiam entraram na fila (ou foram publicados) antes desta
-- migration; usar created_at como data de submissão preserva a ordem real.
update public.businesses set submitted_at = created_at where submitted_at is null;

comment on column public.businesses.service_area is
    'Região atendida quando não há endereço público (profissional autônomo, serviço móvel).';
comment on column public.businesses.moderation_note is
    'Observação interna do admin. Nunca exibida ao público; o dono vê apenas moderation_reason.';

create table public.business_private_locations (
    business_id uuid primary key references public.businesses(id) on delete cascade,
    address text,
    lat numeric,
    lng numeric,
    updated_at timestamptz not null default now()
);

create trigger business_private_locations_set_updated_at
before update on public.business_private_locations
for each row execute function public.set_updated_at();

alter table public.business_private_locations enable row level security;

-- Sem policy para anon e sem GRANT: endereço privado não sai em consulta
-- pública, metadado ou resposta de API, não só "escondido no componente".
create policy "business_private_locations_owner_or_admin"
    on public.business_private_locations for select
    using (
        exists (
            select 1 from public.businesses b
            where b.id = business_id
              and (b.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
        )
    );

grant select on public.business_private_locations to authenticated;
