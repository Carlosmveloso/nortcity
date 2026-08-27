import { rawBusinesses } from './businesses.data';

const images = import.meta.glob('../assets/businesses/*.webp', {
    eager: true,
    import: 'default',
});

function getImage(id) {
    const entry = Object.entries(images).find(([path]) => path.includes(`/${id}.`));
    return entry ? entry[1] : null;
}

export const businesses = rawBusinesses.map((business) => ({
    ...business,
    image: getImage(business.id),
}));
