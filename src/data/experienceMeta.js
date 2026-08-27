// Metadados das páginas de experiência: usados pela própria página e pelo
// script de build que gera as meta tags de compartilhamento (scripts/).
// Sem imports: precisa ser legível por Node puro, fora do Vite.

export const experienceMeta = {
    'roteiro-1-dia': {
        eyebrow: 'Roteiro',
        title: 'O melhor de Pitimbu em 24 horas',
        description: 'Pontos turísticos',
        image: 'roteiro.jpeg',
    },
    'praias-mirantes': {
        eyebrow: 'Praias',
        title: 'Praias e mirantes',
        description: 'Algumas praias do litoral',
        image: 'praias.jpeg',
    },
    'onde-comer': {
        eyebrow: 'Gastronomia',
        title: 'Melhores restaurantes',
        description: 'Gastronomia local imperdível',
        image: 'category-food.jpg',
    },
    'artesanato-local': {
        eyebrow: 'Cultura',
        title: 'Artesanato e cultura',
        description: 'Cultura e tradição regional',
        image: 'artesanato.jpeg',
    },
};
