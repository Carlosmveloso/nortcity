-- Coluna adiada na migration 0006 até existir upload de fotos de verdade.
alter table public.businesses add column cover_image text;
