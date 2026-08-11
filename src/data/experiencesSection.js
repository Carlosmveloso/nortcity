import bgFood from '../assets/images/category-food.jpg';
import bgTours from '../assets/images/praias.jpeg';
import bgServices from "../assets/images/artesanato.jpeg";
import bgRoteiro from "../assets/images/roteiro.jpeg";


export const experiencesSection = {
    title: "Explorar por experiência",
    description: "Roteiros e guias especiais para aproveitar o melhor de Pitimbu.",
    experiences: [
        {
            title: 'Roteiro',
            description: 'Pontos turísticos',
            link: '/experiencia/roteiro-1-dia',
            bgImg: bgRoteiro,
        },
        {
            title: 'Praias',
            description: 'Algumas praias do litoral',
            link: '/experiencia/praias-mirantes',
            bgImg: bgTours,
        },
        {
            title: 'Melhores restaurantes',
            description: 'Gastronomia local imperdível',
            link: '/experiencia/onde-comer',
            bgImg: bgFood,
        },
        {
            title: 'Artesanato e cultura',
            description: 'Cultura e tradição regional',
            link: '/experiencia/artesanato-local',
            bgImg: bgServices,
        },
    ]
};
