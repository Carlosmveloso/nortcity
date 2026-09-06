import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'business-photos';

function extensionOf(file) {
    const extension = file.name.split('.').pop();
    return extension && extension.length <= 5 ? extension : 'jpg';
}

/** Capa do cadastro em análise: caminho fixo {business_id}/cover.<ext>. */
export async function uploadBusinessCoverImage(businessId, file) {
    const path = `${businessId}/cover.${extensionOf(file)}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) return { error: uploadError };

    const {
        data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // Cache-bust: mesmo path, arquivo novo — sem isso o navegador (e o CDN)
    // continuam servindo a imagem antiga com a mesma URL.
    return { url: `${publicUrl}?v=${Date.now()}` };
}

/**
 * Capa proposta para um negócio já publicado. Vai para {business_id}/review/,
 * que a policy de leitura pública exclui: a capa aprovada continua no ar e a
 * imagem em análise não fica acessível por URL até a decisão.
 */
export async function uploadBusinessReviewImage(businessId, file) {
    const path = `${businessId}/review/${crypto.randomUUID()}.${extensionOf(file)}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600' });
    if (error) return { error };

    return { path };
}

/** Link temporário para o admin ver a capa proposta sem torná-la pública. */
export async function reviewImageSignedUrl(path) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error) return { error };
    return { url: data.signedUrl };
}

/**
 * Publica a capa proposta: copia review/ para um caminho público novo (nome
 * único, para não depender de sobrescrever a capa anterior) e devolve a URL
 * que a aprovação vai gravar em businesses.cover_image.
 */
export async function publishReviewImage(businessId, reviewPath) {
    const extension = reviewPath.split('.').pop();
    const target = `${businessId}/cover-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).copy(reviewPath, target);
    if (error) return { error };

    const {
        data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(target);

    return { url: publicUrl };
}
