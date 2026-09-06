// Regras de formulário do negócio, espelhando as validações do banco
// (assert_business_minimums / set_business_categories). O banco continua sendo
// a autoridade — isto existe para o usuário ver o erro no campo certo antes de
// enviar, não para substituir a checagem do servidor.

export const DESCRIPTION_MIN = 40;
export const DESCRIPTION_MAX = 1500;
export const MAX_CATEGORIES = 3;

export const emptyBusinessForm = {
    name: '',
    categories: [],
    primaryCategoryId: null,
    description: '',
    // Profissional autônomo / serviço móvel atende sem endereço público
    // (LOC-02): nesse caso o endereço não vai para a ficha pública.
    hasPublicAddress: true,
    street: '',
    number: '',
    neighborhood: '',
    serviceArea: '',
    privateAddress: '',
    phone: '',
    whatsapp: '',
    email: '',
    instagram: '',
    website: '',
};

export function isValidContact(kind, value) {
    const text = (value ?? '').trim();
    if (!text) return false;
    if (kind === 'phone' || kind === 'whatsapp') {
        const digits = text.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
    }
    if (kind === 'email') return /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(text);
    if (kind === 'website') return /\.[a-zA-Z]{2,}/.test(text);
    if (kind === 'instagram') return text.length >= 2;
    return false;
}

export function hasPublicContact(form) {
    return ['phone', 'whatsapp', 'email', 'instagram', 'website'].some((kind) =>
        isValidContact(kind, form[kind])
    );
}

export function buildAddress(form) {
    if (!form.hasPublicAddress) return null;
    const address = [form.street, form.number].map((part) => (part ?? '').trim()).filter(Boolean).join(', ');
    return address || null;
}

function clean(value) {
    const text = (value ?? '').trim();
    return text || null;
}

export function buildBusinessPayload(form) {
    return {
        name: form.name.trim(),
        description: form.description.trim(),
        address: buildAddress(form),
        neighborhood: clean(form.neighborhood),
        service_area: clean(form.serviceArea),
        phone: clean(form.phone),
        whatsapp: clean(form.whatsapp),
        email: clean(form.email),
        instagram: clean(form.instagram)?.replace(/^@/, '') ?? null,
        website: clean(form.website),
    };
}

/** Erros por campo. Objeto vazio = pronto para enviar. */
export function validateBusinessForm(form) {
    const errors = {};

    if (!form.name.trim()) errors.name = 'Informe o nome do negócio.';
    else if (form.name.trim().length > 120) errors.name = 'O nome pode ter no máximo 120 caracteres.';

    if (form.categories.length === 0) errors.categories = 'Selecione ao menos uma categoria.';
    else if (form.categories.length > MAX_CATEGORIES)
        errors.categories = `Selecione no máximo ${MAX_CATEGORIES} categorias.`;
    else if (form.categories.length > 1 && !form.categories.includes(form.primaryCategoryId))
        errors.primaryCategoryId = 'Escolha qual categoria é a principal.';

    const description = form.description.trim();
    if (!description) errors.description = 'Escreva uma descrição do negócio.';
    else if (description.length < DESCRIPTION_MIN)
        errors.description = `A descrição precisa ter pelo menos ${DESCRIPTION_MIN} caracteres.`;
    else if (description.length > DESCRIPTION_MAX)
        errors.description = `A descrição pode ter no máximo ${DESCRIPTION_MAX} caracteres.`;

    if (form.hasPublicAddress) {
        if (!buildAddress(form) && !form.neighborhood.trim())
            errors.street = 'Informe a rua ou pelo menos o bairro.';
    } else if (!form.serviceArea.trim()) {
        errors.serviceArea = 'Informe a região que você atende.';
    }

    if (!hasPublicContact(form))
        errors.contact =
            'Informe ao menos um contato público válido: telefone, WhatsApp, e-mail, Instagram ou site.';

    return errors;
}

/** Categoria única é sempre a principal; com várias, a escolha é explícita. */
export function nextPrimaryCategory(categories, currentPrimary) {
    if (categories.length === 0) return null;
    if (categories.length === 1) return categories[0];
    return categories.includes(currentPrimary) ? currentPrimary : null;
}

export function businessFormFromRow(row) {
    if (!row) return emptyBusinessForm;
    return {
        ...emptyBusinessForm,
        name: row.name ?? '',
        categories: row.categoryIds ?? [],
        primaryCategoryId: row.primaryCategoryId ?? null,
        description: row.description ?? '',
        hasPublicAddress: Boolean(row.address) || !row.service_area,
        street: row.address ?? '',
        number: '',
        neighborhood: row.neighborhood ?? '',
        serviceArea: row.service_area ?? '',
        phone: row.phone ?? '',
        whatsapp: row.whatsapp ?? '',
        email: row.email ?? '',
        instagram: row.instagram ?? '',
        website: row.website ?? '',
    };
}
