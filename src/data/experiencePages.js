import bgFood from '../assets/images/category-food.jpg';
import bgTours from '../assets/images/praias.jpeg';
import bgServices from '../assets/images/artesanato.jpeg';
import bgRoteiro from '../assets/images/roteiro.jpeg';
import { beaches } from './beaches';
import { businesses } from './businesses';

const restaurantIds = ['assador-brasil-hispano', 'restaurante-e-bar-da-cioba', 'pousada-beira-mar-pitimbu'];
const extraArtesanatoIds = ['ama-marisqueiras-acau', 'astanova'];

export const experiencePages = {
    'roteiro-1-dia': {
        eyebrow: 'Roteiro',
        title: 'O melhor de Pitimbu em 24 horas',
        description: 'Pontos turísticos',
        heroImg: bgRoteiro,
        items: [
            { id: 'mirante-senhor-do-bonfim', title: 'Mirante Senhor do Bonfim' },
            { id: 'piscinas-naturais-de-pitimbu', title: 'Piscinas Naturais de Pitimbu' },
            { id: 'croas-de-pitimbu', title: 'Croas de Pitimbu' },
            { id: 'por-do-sol-de-pontinha', title: 'Pôr do sol de Pontinha' },
            { id: 'museu-arqueologico-de-pitimbu', title: 'Museu Arqueológico de Pitimbu (Taquara)' },
            { id: 'memorial-mestra-zefinha', title: 'Memorial Mestra Zefinha' },
            { id: 'ruina-nossa-senhora-dos-prazeres', title: 'Ruína Nossa Senhora dos Prazeres' },
            { id: 'pedra-da-gale', title: 'Pedra da Galé' },
            { id: 'casarao-do-barao-do-abiai', title: 'Casarão do Barão do Abiaí' },
            { id: 'casarao-dos-goncalves-gondim', title: 'Casarão dos Gonçalves Gondim' },
            { id: 'estuario-rio-mucatu', title: 'Estuário Rio Mucatu' },
            { id: 'estuario-rio-grau', title: 'Estuário Rio Graú' },
            { id: 'estuario-rio-abiai', title: 'Estuário Rio Abiaí' },
            { id: 'festival-da-lagosta', title: 'Festival da Lagosta' },
        ],
    },
    'praias-mirantes': {
        eyebrow: 'Praias',
        title: 'Praias e mirantes',
        description: 'Algumas praias do litoral',
        heroImg: bgTours,
        mapLink: '/mapa',
        items: beaches.map((beach) => ({
            id: beach.id,
            title: beach.name,
            description: beach.description,
            image: beach.image,
        })),
    },
    'onde-comer': {
        eyebrow: 'Gastronomia',
        title: 'Melhores restaurantes',
        description: 'Gastronomia local imperdível',
        heroImg: bgFood,
        items: businesses
            .filter((business) => restaurantIds.includes(business.id))
            .map((business) => ({
                id: business.id,
                title: business.name,
                description: business.description,
                image: business.image,
                address: business.address,
                link: `/negocio/${business.id}`,
            })),
    },
    'artesanato-local': {
        eyebrow: 'Cultura',
        title: 'Artesanato e cultura',
        description: 'Cultura e tradição regional',
        heroImg: bgServices,
        items: businesses
            .filter(
                (business) => business.categories.includes('artesanato') || extraArtesanatoIds.includes(business.id)
            )
            .map((business) => ({
                id: business.id,
                title: business.name,
                description: business.description,
                image: business.image,
                address: business.address,
                link: `/negocio/${business.id}`,
            })),
    },
};
