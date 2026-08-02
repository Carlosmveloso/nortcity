import {
    UtensilsCrossed,
    BedDouble,
    Waves,
    Wrench,
    Users,
    Truck,
    PartyPopper,
    Palette,
    Car,
    HeartPulse,
    Scissors,
    Hammer,
} from 'lucide-react';
import { businesses } from './businesses';

function countByCategory(slug) {
    return businesses.filter((business) => business.category === slug).length;
}

export const popularCategories = [
    {
        slug: 'gastronomia',
        label: 'Comer',
        description: 'Restaurantes, bares e lanchonetes',
        icon: UtensilsCrossed,
        count: countByCategory('gastronomia'),
    },
    {
        slug: 'hospedagem',
        label: 'Hospedagem',
        description: 'Pousadas, hotéis e casas',
        icon: BedDouble,
        count: countByCategory('hospedagem'),
    },
    {
        slug: 'passeios',
        label: 'Passeios',
        description: 'Ilhas, trilhas e aventuras',
        icon: Waves,
        count: countByCategory('passeios'),
    },
    {
        slug: 'servicos',
        label: 'Serviços',
        description: 'Lojas e utilidades gerais',
        icon: Wrench,
        count: countByCategory('servicos'),
    },
    {
        slug: 'profissionais',
        label: 'Profissionais',
        description: 'Guias, técnicos e especialistas',
        icon: Users,
        count: countByCategory('profissionais'),
    },
];

export const otherCategories = [
    { slug: 'delivery', label: 'Delivery', description: 'Comida e produtos em casa', icon: Truck },
    { slug: 'eventos', label: 'Eventos', description: 'Festas, shows e celebrações', icon: PartyPopper },
    { slug: 'artesanato', label: 'Artesanato', description: 'Cultura e tradição local', icon: Palette },
    { slug: 'transporte', label: 'Transporte', description: 'Táxi, transfer e aluguel', icon: Car },
    { slug: 'saude', label: 'Saúde', description: 'Clínicas, farmácias e bem-estar', icon: HeartPulse },
    { slug: 'beleza', label: 'Beleza', description: 'Salões, barbearias e estética', icon: Scissors },
    { slug: 'manutencao', label: 'Manutenção', description: 'Reparos e assistência técnica', icon: Hammer },
];
