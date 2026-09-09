import { describe, expect, it } from 'vitest';

import { buildExperiencePages } from './experiencePages';

const catalogo = [
    { id: 'assador-brasil-hispano', name: 'Assador Brasil Hispano', description: 'Carnes.', categories: ['gastronomia'], address: 'Rua A', image: 'capa-1.jpg' },
    { id: 'restaurante-e-bar-da-cioba', name: 'Bar da Cioba', description: 'Peixes.', categories: ['gastronomia'], address: 'Rua B', image: 'capa-2.jpg' },
    { id: 'eliane-trancados', name: 'Eliane Trançados', description: 'Palha.', categories: ['artesanato'], address: null, image: 'capa-3.jpg' },
    { id: 'ama-marisqueiras-acau', name: 'AMA Marisqueiras', description: 'Mariscos.', categories: ['gastronomia'], address: null, image: 'capa-4.jpg' },
    { id: 'padaria-qualquer', name: 'Padaria Qualquer', description: 'Pães.', categories: ['gastronomia'], address: 'Rua C', image: 'capa-5.jpg' },
];

describe('buildExperiencePages', () => {
    // Enquanto o banco não responde, a página existe e as duas experiências que
    // não dependem dele aparecem na hora — só a lista fica vazia.
    it('sem catálogo, ainda devolve as quatro experiências', () => {
        const paginas = buildExperiencePages();

        expect(Object.keys(paginas)).toEqual([
            'roteiro-1-dia',
            'praias-mirantes',
            'onde-comer',
            'artesanato-local',
        ]);
        expect(paginas['roteiro-1-dia'].items.length).toBeGreaterThan(0);
        expect(paginas['onde-comer'].items).toEqual([]);
    });

    it('"onde comer" mostra só os restaurantes escolhidos a dedo', () => {
        const items = buildExperiencePages(catalogo)['onde-comer'].items;

        expect(items.map((item) => item.id)).toEqual([
            'assador-brasil-hispano',
            'restaurante-e-bar-da-cioba',
        ]);
        expect(items[0].link).toBe('/negocio/assador-brasil-hispano');
    });

    it('"artesanato local" junta a categoria do banco com os convidados fixos', () => {
        const items = buildExperiencePages(catalogo)['artesanato-local'].items;

        expect(items.map((item) => item.id)).toEqual(['eliane-trancados', 'ama-marisqueiras-acau']);
    });

    // O ponto de toda a mudança: negócio que saiu do ar não pode continuar
    // listado com um link que devolve 404.
    it('não lista negócio que não está mais publicado', () => {
        const semCioba = catalogo.filter((item) => item.id !== 'restaurante-e-bar-da-cioba');
        const items = buildExperiencePages(semCioba)['onde-comer'].items;

        expect(items.map((item) => item.id)).toEqual(['assador-brasil-hispano']);
    });
});
