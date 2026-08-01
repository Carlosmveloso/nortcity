import bgFood from '../assets/images/category-food.jpg';
import bgTours from '../assets/images/category-tours.jpg';
import bgServices from "../assets/images/category-services.jpg";


export const experiencesSection = {
    title: "Explorar por experiência",
    description: "Roteiros e guias especiais para aproveitar o melhor de Pitimbu.",
    experiences: [
        {
            title: 'Roteiro 1 dia em Pitimbu',
            description: 'O melhor de Pitimbu em 24 horas',
            link: '/explorar?experiencia=roteiro-1-dia',
            bgImg: '/hero-beach.jpg',
        },
        {
            title: 'Praias e Mirantes',
            description: 'Os melhores pontos de vista',
            link: '/explorar?experiencia=praias-mirantes',
            bgImg: bgTours,
        },
        {
            title: 'Onde comer bem',
            description: 'Gastronomia local imperdível',
            link: '/explorar?experiencia=onde-comer',
            bgImg: bgFood,
        },
        {
            title: 'Artesanato local',
            description: 'Cultura e tradição regional',
            link: '/explorar?experiencia=artesanato-local',
            bgImg: bgServices,
        },
    ]
};
