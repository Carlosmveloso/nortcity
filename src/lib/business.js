import { businesses } from '../data/businesses';
import { popularCategories, otherCategories } from '../data/categories';

const categoryLabels = new Map(
    [...popularCategories, ...otherCategories].map((category) => [category.slug, category.label])
);

export function toWhatsappLink(phone) {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/55${digits}`;
}

export function categoryLabel(slug) {
    return categoryLabels.get(slug) ?? slug;
}

export function findBusinessBySlug(slug) {
    return businesses.find((business) => business.id === slug) ?? null;
}

export function findRelatedBusinesses(business, limit = 3) {
    return businesses
        .filter((other) => other.category === business.category && other.id !== business.id)
        .slice(0, limit);
}
