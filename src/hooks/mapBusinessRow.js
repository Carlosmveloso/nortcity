// Colunas e shape de saída da ficha pública de um negócio (useBusiness).
// A listagem de /explorar não passa por aqui: usa a RPC search_businesses,
// que resolve ordenação e paginação no servidor.
export const BUSINESS_SELECT =
    'id, slug, name, subcategory, description, address, neighborhood, service_area, phone, whatsapp, email, instagram, website, cover_image, business_categories(is_primary, categories(slug, name))';

export function mapBusinessRow(row) {
    const links = [...row.business_categories].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary)
    );
    const categories = links.map((entry) => entry.categories.slug);

    return {
        id: row.slug,
        businessId: row.id,
        name: row.name,
        categories,
        // Nome vindo do banco: categoria criada pelo admin não depende de
        // atualizar categoryLabels.js para ter rótulo.
        categoryNames: links.map((entry) => entry.categories.name),
        subcategory: row.subcategory,
        description: row.description,
        address: row.address,
        neighborhood: row.neighborhood,
        serviceArea: row.service_area,
        phone: row.phone,
        whatsapp: row.whatsapp,
        email: row.email,
        instagram: row.instagram,
        website: row.website,
        image: row.cover_image,
    };
}
