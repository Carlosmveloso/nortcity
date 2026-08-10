import foodCategory from '../assets/images/category-food.jpg';
import accommodationCategory from '../assets/images/category-accommodation.jpg';
import toursCategory from '../assets/images/category-tours.jpg';
import servicesCategory from '../assets/images/category-services.jpg';
import professionalsCategory from '../assets/images/category-professionals.jpg';

export const categoriesSection = {
    title: 'Categorias Populares',
    description: 'Explore Pitimbu por categorias e encontre exatamente o que você precisa',
    categories: [
        {
            title: 'Gastronomia',
            value: 'gastronomia',
            subCategories: ['Restaurantes', 'Bares'],
            options: '+24 opções',
            img: foodCategory,
        },
        {
            title: 'Hospedagem',
            value: 'hospedagem',
            subCategories: ['Pousadas', 'Hotéis'],
            options: '+15 opções',
            img: accommodationCategory,
        },
        {
            title: 'Passeios',
            value: 'passeios',
            subCategories: ['Ilhas', 'Aventuras'],
            options: '+27 opções',
            img: toursCategory,
        },
        {
            title: 'Serviços',
            value: 'servicos',
            subCategories: ['Lojas', 'Utilidades'],
            options: '+22 opções',
            img: servicesCategory,
        },
        {
            title: 'Negócio',
            value: 'negocio',
            subCategories: ['Comércios', 'Empreendedores'],
            options: 'Novidade',
            img: professionalsCategory,
        },
    ],
};
