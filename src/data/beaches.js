import { rawBeaches } from './beaches.data';

const images = import.meta.glob('../assets/beaches/*.webp', {
    eager: true,
    import: 'default',
});

function getImage(id) {
    const entry = Object.entries(images).find(([path]) => path.includes(`/${id}.`));
    return entry ? entry[1] : null;
}

export const beaches = rawBeaches.map((beach) => ({ ...beach, image: getImage(beach.id) }));
