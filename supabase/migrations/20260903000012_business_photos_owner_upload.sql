-- Permite que o dono do negócio (não só admin) suba/atualize a própria foto
-- de capa durante o cadastro (CadastrarNegocio.jsx). O caminho do objeto é
-- sempre `{business_id}/cover.<ext>` — storage.foldername() extrai o
-- primeiro segmento do path pra conferir se aquele negócio é do usuário.

create policy "business_photos_owner_insert"
    on storage.objects for insert
    with check (
        bucket_id = 'business-photos'
        and exists (
            select 1 from public.businesses b
            where b.id::text = (storage.foldername(name))[1]
              and b.owner_id = auth.uid()
        )
    );

create policy "business_photos_owner_update"
    on storage.objects for update
    using (
        bucket_id = 'business-photos'
        and exists (
            select 1 from public.businesses b
            where b.id::text = (storage.foldername(name))[1]
              and b.owner_id = auth.uid()
        )
    );
