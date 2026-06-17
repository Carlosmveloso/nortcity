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
            title: 'Comer',
            subCategories: ['Restaurantes', 'Bares'],
            options: '+24 opções',
            img: foodCategory,
        },
        {
            title: 'Hospedagem',
            subCategories: ['Pousadas', 'Hotéis'],
            options: '+15 opções',
            img: accommodationCategory,
        },
        {
            title: 'Passeios',
            subCategories: ['Ilhas', 'Aventuras'],
            options: '+27 opções',
            img: toursCategory,
        },
        {
            title: 'Serviços',
            subCategories: ['Lojas', 'Utilidades'],
            options: '+22 opções',
            img: servicesCategory,
        },
        {
            title: 'Profissionais',
            subCategories: ['Guias', 'Especialistas'],
            options: '+36 opções',
            img: professionalsCategory,
        },
    ],
};
