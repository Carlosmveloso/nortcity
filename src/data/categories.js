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
import { categoryLabels } from './categoryLabels';
import foodCategory from '../assets/images/category-food.jpg';
import accommodationCategory from '../assets/images/category-accommodation.jpg';
import toursCategory from '../assets/images/category-tours.jpg';
import servicesCategory from '../assets/images/category-services.jpg';
import professionalsCategory from '../assets/images/category-professionals.jpg';

// A contagem de cada categoria não mora mais aqui: vem do banco, em
// /categorias, por countByCategory() de src/lib/businessCatalog.js. Este módulo
// guarda só o que é apresentação — rótulo, ícone, imagem e descrição.

export const popularCategories = [
    {
        slug: 'gastronomia',
        label: categoryLabels.gastronomia,
        description: 'Restaurantes, bares e lanchonetes',
        icon: UtensilsCrossed,
        img: foodCategory,
    },
    {
        slug: 'hospedagem',
        label: categoryLabels.hospedagem,
        description: 'Pousadas, hotéis e casas',
        icon: BedDouble,
        img: accommodationCategory,
    },
    {
        slug: 'passeios',
        label: categoryLabels.passeios,
        description: 'Ilhas, trilhas e aventuras',
        icon: Waves,
        img: toursCategory,
    },
    {
        slug: 'servicos',
        label: categoryLabels.servicos,
        description: 'Lojas e utilidades gerais',
        icon: Wrench,
        img: servicesCategory,
    },
    {
        slug: 'negocio',
        label: categoryLabels.negocio,
        description: 'Comércios e empreendedores locais',
        icon: Briefcase,
        img: professionalsCategory,
    },
];

export const otherCategories = [
    {
        slug: 'eventos',
        label: categoryLabels.eventos,
        description: 'Festas, shows e celebrações',
        icon: PartyPopper,
    },
    {
        slug: 'lojas',
        label: categoryLabels.lojas,
        description: 'Comércio local e utilidades',
        icon: Store,
    },
    {
        slug: 'construcao',
        label: categoryLabels.construcao,
        description: 'Construção civil e reformas',
        icon: HardHat,
    },
    {
        slug: 'artesanato',
        label: categoryLabels.artesanato,
        description: 'Artesãos e produtos locais feitos à mão',
        icon: Palette,
    },
];
