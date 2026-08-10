import {
    UtensilsCrossed,
    BedDouble,
    Waves,
    Wrench,
    Briefcase,
    Truck,
    PartyPopper,
    Palette,
    Car,
    HeartPulse,
    Scissors,
    Hammer,
} from 'lucide-react';
import { businesses } from './businesses';
import foodCategory from '../assets/images/category-food.jpg';
import accommodationCategory from '../assets/images/category-accommodation.jpg';
import toursCategory from '../assets/images/category-tours.jpg';
import servicesCategory from '../assets/images/category-services.jpg';
import professionalsCategory from '../assets/images/category-professionals.jpg';

function countByCategory(slug) {
    return businesses.filter((business) => business.category === slug).length;
}

export const popularCategories = [
    {
        slug: 'gastronomia',
        label: 'Gastronomia',
        description: 'Restaurantes, bares e lanchonetes',
        icon: UtensilsCrossed,
        count: countByCategory('gastronomia'),
        img: foodCategory,
    },
    {
        slug: 'hospedagem',
        label: 'Hospedagem',
        description: 'Pousadas, hotéis e casas',
        icon: BedDouble,
        count: countByCategory('hospedagem'),
        img: accommodationCategory,
    },
    {
        slug: 'passeios',
        label: 'Passeios',
        description: 'Ilhas, trilhas e aventuras',
        icon: Waves,
        count: countByCategory('passeios'),
        img: toursCategory,
    },
    {
        slug: 'servicos',
        label: 'Serviços',
        description: 'Lojas e utilidades gerais',
        icon: Wrench,
        count: countByCategory('servicos'),
        img: servicesCategory,
    },
    {
        slug: 'negocio',
        label: 'Negócio',
        description: 'Comércios e empreendedores locais',
        icon: Briefcase,
        count: countByCategory('negocio'),
        img: professionalsCategory,
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
