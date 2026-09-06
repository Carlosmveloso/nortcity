// @vitest-environment node
//
// Descoberta pública: ordenação, relevância, filtros cumulativos e paginação.
import { beforeAll, describe, expect, it } from 'vitest';
import { asAnon, asUser, businessPayload, createTestDb, createUser, seedCategories } from './harness';

let db;
let cats;
let admin;

async function createActive(payload, categories, primary = null, status = 'active') {
    await asUser(db, admin);
    const { rows } = await db.query(
        'select public.admin_create_business($1::jsonb, $2::uuid[], $3::uuid, $4::business_status) as id',
        [JSON.stringify(businessPayload(payload)), categories, primary, status]
    );
    return rows[0].id;
}

async function search(args = {}) {
    await asAnon(db);
    const { rows } = await db.query(
        'select * from public.search_businesses($1, $2, $3, $4, $5, $6)',
        [
            args.query ?? null,
            args.category ?? null,
            args.neighborhood ?? null,
            args.priceRange ?? null,
            args.limit ?? 12,
            args.offset ?? 0,
        ]
    );
    return rows;
}

beforeAll(async () => {
    db = await createTestDb();
    cats = await seedCategories(db);
    admin = await createUser(db, { admin: true });

    await createActive(
        { name: 'Zé Pescador Passeios', description: 'Passeio de barco pelo estuário do rio Abiaí com o Zé.', neighborhood: 'Centro' },
        [cats.passeios]
    );
    await createActive(
        { name: 'Água Doce Pousada', description: 'Pousada familiar com piscina, a 300 metros da praia central.', neighborhood: 'Centro' },
        [cats.hospedagem]
    );
    await createActive(
        { name: 'Cantinho do Mar', description: 'Restaurante de frutos do mar com vista para a praia dos Mariscos.', neighborhood: 'Mariscos' },
        [cats.gastronomia, cats.passeios],
        cats.gastronomia
    );
    await createActive(
        { name: 'Bar do Farol', description: 'Petiscos e cerveja gelada na orla, aberto todos os dias até tarde.', neighborhood: 'Mariscos', price_range: '$' },
        [cats.gastronomia]
    );
    await createActive(
        { name: 'Escondido Pendente', description: 'Este cadastro ainda está aguardando análise da equipe do Farol.', neighborhood: 'Centro' },
        [cats.gastronomia],
        null,
        'pending'
    );
}, 60_000);

describe('ordenação sem texto de busca', () => {
    it('é alfabética pelo nome, ignorando acento', async () => {
        const rows = await search();
        expect(rows.map((r) => r.name)).toEqual([
            'Água Doce Pousada',
            'Bar do Farol',
            'Cantinho do Mar',
            'Zé Pescador Passeios',
        ]);
    });

    it('continua alfabética dentro de uma categoria', async () => {
        const rows = await search({ category: 'gastronomia' });
        expect(rows.map((r) => r.name)).toEqual(['Bar do Farol', 'Cantinho do Mar']);
    });

    it('não devolve negócio que não está publicado', async () => {
        const rows = await search({ query: 'Escondido' });
        expect(rows).toHaveLength(0);
    });
});

describe('relevância', () => {
    it('nome vem antes de categoria, que vem antes de descrição', async () => {
        // "passeios" casa: no nome de "Zé Pescador Passeios" (1), na categoria
        // primária de nenhum outro, na secundária de "Cantinho do Mar" (3) e na
        // descrição de "Água Doce Pousada"? não — só nos dois primeiros.
        const rows = await search({ query: 'passeios' });
        expect(rows.map((r) => r.name)).toEqual(['Zé Pescador Passeios', 'Cantinho do Mar']);
    });

    it('categoria primária tem prioridade sobre a secundária', async () => {
        const rows = await search({ query: 'gastronomia' });
        // Bar do Farol e Cantinho do Mar têm gastronomia como primária, em
        // ordem alfabética; nenhum tem como secundária.
        expect(rows.map((r) => r.name)).toEqual(['Bar do Farol', 'Cantinho do Mar']);
    });

    it('encontra por descrição e por bairro', async () => {
        expect((await search({ query: 'piscina' })).map((r) => r.name)).toEqual(['Água Doce Pousada']);
        expect((await search({ query: 'mariscos' })).map((r) => r.name)).toEqual([
            // "Mariscos" aparece na descrição do Cantinho (4) e no bairro do Bar (5).
            'Cantinho do Mar',
            'Bar do Farol',
        ]);
    });

    it('busca ignora acento e caixa', async () => {
        expect((await search({ query: 'AGUA' })).map((r) => r.name)).toEqual(['Água Doce Pousada']);
    });
});

describe('filtros e paginação', () => {
    it('filtros de dimensões diferentes são cumulativos', async () => {
        expect((await search({ category: 'gastronomia', neighborhood: 'Mariscos' })).map((r) => r.name)).toEqual([
            'Bar do Farol',
            'Cantinho do Mar',
        ]);
        expect((await search({ category: 'gastronomia', neighborhood: 'Centro' }))).toHaveLength(0);
        expect((await search({ category: 'gastronomia', priceRange: '$' })).map((r) => r.name)).toEqual(['Bar do Farol']);
    });

    it('categoria secundária torna o negócio encontrável no filtro', async () => {
        expect((await search({ category: 'passeios' })).map((r) => r.name)).toEqual([
            'Cantinho do Mar',
            'Zé Pescador Passeios',
        ]);
    });

    it('paginação é consistente e informa o total do conjunto inteiro', async () => {
        const page1 = await search({ limit: 2, offset: 0 });
        const page2 = await search({ limit: 2, offset: 2 });

        expect(page1.map((r) => r.name)).toEqual(['Água Doce Pousada', 'Bar do Farol']);
        expect(page2.map((r) => r.name)).toEqual(['Cantinho do Mar', 'Zé Pescador Passeios']);
        expect(Number(page1[0].total_count)).toBe(4);
        expect(Number(page2[0].total_count)).toBe(4);

        const ids = new Set([...page1, ...page2].map((r) => r.id));
        expect(ids.size).toBe(4);
    });

    it('lista os bairros que existem entre os negócios publicados', async () => {
        await asAnon(db);
        const { rows } = await db.query('select * from public.business_neighborhoods()');
        expect(rows.map((r) => r.neighborhood)).toEqual(['Centro', 'Mariscos']);
    });
});
