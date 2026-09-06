-- Capa em revisão (EDI-02), proteção da capa aprovada e correção de um bug de
-- captura de nome nas policies da migration 0012.
--
-- O bug: `(storage.foldername(name))[1]` dentro de
-- `exists (select 1 from public.businesses b where ...)` resolve `name` para
-- `b.name` — o nome do NEGÓCIO — e não para o caminho do arquivo. A policy
-- comparava o uuid do negócio com o primeiro pedaço do nome dele, o que nunca
-- casa: o upload de capa pelo dono durante o cadastro sempre foi negado pelo
-- RLS (a UI só registrava a falha e seguia sem imagem). Aqui a referência é
-- sempre qualificada como `objects.name`.
--
-- Convenção de caminho dentro do bucket business-photos:
--   {business_id}/cover.<ext>            capa aprovada, leitura pública
--   {business_id}/review/<uuid>.<ext>    capa proposta, só dono e admin leem
--
-- Além da correção: o dono só escreve em {id}/cover.* enquanto o negócio está
-- pendente ou rejeitado. Publicado, a capa é campo sensível — o upload vai
-- para review/ e só entra no ar quando a alteração for aprovada.

drop policy "business_photos_public_read" on storage.objects;
drop policy "business_photos_owner_insert" on storage.objects;
drop policy "business_photos_owner_update" on storage.objects;

create policy "business_photos_public_read"
    on storage.objects for select
    using (
        bucket_id = 'business-photos'
        and (storage.foldername(objects.name))[2] is distinct from 'review'
    );

create policy "business_photos_review_read"
    on storage.objects for select
    using (
        bucket_id = 'business-photos'
        and (storage.foldername(objects.name))[2] = 'review'
        and (
            public.has_role(auth.uid(), 'admin')
            or exists (
                select 1 from public.businesses b
                where b.id::text = (storage.foldername(objects.name))[1]
                  and b.owner_id = auth.uid()
            )
        )
    );

create policy "business_photos_owner_insert"
    on storage.objects for insert
    with check (
        bucket_id = 'business-photos'
        and exists (
            select 1 from public.businesses b
            where b.id::text = (storage.foldername(objects.name))[1]
              and b.owner_id = auth.uid()
              and (
                  (storage.foldername(objects.name))[2] = 'review'
                  or b.status in ('pending', 'rejected')
              )
        )
    );

create policy "business_photos_owner_update"
    on storage.objects for update
    using (
        bucket_id = 'business-photos'
        and exists (
            select 1 from public.businesses b
            where b.id::text = (storage.foldername(objects.name))[1]
              and b.owner_id = auth.uid()
              and (
                  (storage.foldername(objects.name))[2] = 'review'
                  or b.status in ('pending', 'rejected')
              )
        )
    );
