import { businesses } from '../data/businesses';
import { categoryLabels } from '../data/categoryLabels';

export function toWhatsappLink(phone) {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/55${digits}`;
}

export function categoryLabel(slug) {
    return categoryLabels[slug] ?? slug;
}

export function findBusinessBySlug(slug) {
    return businesses.find((business) => business.id === slug) ?? null;
}

export function findRelatedBusinesses(business, limit = 3) {
    return businesses
        .filter(
            (other) =>
                other.id !== business.id && other.categories.some((slug) => business.categories.includes(slug))
        )
        .slice(0, limit);
}
