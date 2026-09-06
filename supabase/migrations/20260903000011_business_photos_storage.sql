-- Bucket público para as fotos de capa dos negócios. Leitura é pública
-- (o site exibe as imagens sem login); escrita só para admin, já que o
-- upload por enquanto só existe no painel admin (Admin.jsx).

insert into storage.buckets (id, name, public)
values ('business-photos', 'business-photos', true)
on conflict (id) do nothing;

create policy "business_photos_public_read"
    on storage.objects for select
    using (bucket_id = 'business-photos');

create policy "business_photos_admin_insert"
    on storage.objects for insert
    with check (bucket_id = 'business-photos' and public.has_role(auth.uid(), 'admin'));

create policy "business_photos_admin_update"
    on storage.objects for update
    using (bucket_id = 'business-photos' and public.has_role(auth.uid(), 'admin'));

create policy "business_photos_admin_delete"
    on storage.objects for delete
    using (bucket_id = 'business-photos' and public.has_role(auth.uid(), 'admin'));
