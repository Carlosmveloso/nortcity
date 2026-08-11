import {
    UtensilsCrossed,
    BedDouble,
    Waves,
    Wrench,
    Briefcase,
    PartyPopper,
    Store,
    HardHat,
    Palette,
} from 'lucide-react';
import { businesses } from './businesses';
import foodCategory from '../assets/images/category-food.jpg';
import accommodationCategory from '../assets/images/category-accommodation.jpg';
import toursCategory from '../assets/images/category-tours.jpg';
import servicesCategory from '../assets/images/category-services.jpg';
import professionalsCategory from '../assets/images/category-professionals.jpg';

function countByCategory(slug) {
    return businesses.filter((business) => business.categories.includes(slug)).length;
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
    {
        slug: 'eventos',
        label: 'Eventos',
        description: 'Festas, shows e celebrações',
        icon: PartyPopper,
        count: countByCategory('eventos'),
    },
    {
        slug: 'lojas',
        label: 'Lojas',
        description: 'Comércio local e utilidades',
        icon: Store,
        count: countByCategory('lojas'),
    },
    {
        slug: 'construcao',
        label: 'Construção',
        description: 'Construção civil e reformas',
        icon: HardHat,
        count: countByCategory('construcao'),
    },
    {
        slug: 'artesanato',
        label: 'Artesanato',
        description: 'Artesãos e produtos locais feitos à mão',
        icon: Palette,
        count: countByCategory('artesanato'),
    },
];
