// Coordenadas aproximadas ao redor de Pitimbu-PB (-7.4667, -34.8167) para fins de demonstração.
// Não são coordenadas exatas dos endereços reais — servem para popular o mapa mock até termos
// geocodificação real integrada ao Supabase.

export const mapPoints = [
    { id: 'centro-pitimbu', name: 'Centro de Pitimbu', category: 'referencia', lat: -7.4667, lng: -34.8167 },
    { id: 'praia-de-pitimbu', name: 'Praia de Pitimbu', category: 'atracao', lat: -7.4699, lng: -34.8143 },
    { id: 'praia-bela', name: 'Praia Bela', category: 'atracao', lat: -7.4991, lng: -34.8064 },
    { id: 'distrito-de-acau', name: 'Distrito de Acaú', category: 'atracao', lat: -7.5312, lng: -34.7981 },
    { id: 'barra-de-abiai', name: 'Barra de Abiaí', category: 'atracao', lat: -7.4321, lng: -34.8286 },
    {
        id: 'asenza-beach-resort',
        name: 'Asenza Beach Resort',
        category: 'hospedagem',
        lat: -7.4402,
        lng: -34.8253,
    },
    {
        id: 'pousada-beira-mar-pitimbu',
        name: 'Pousada Beira Mar Pitimbu',
        category: 'hospedagem',
        lat: -7.4681,
        lng: -34.8151,
    },
    {
        id: 'sardinha-gastrobar',
        name: 'Sardinha Gastrobar',
        category: 'gastronomia',
        lat: -7.4675,
        lng: -34.8158,
    },
    {
        id: 'squina-mar',
        name: 'Squina Mar',
        category: 'gastronomia',
        lat: -7.4713,
        lng: -34.8129,
    },
    {
        id: 'restaurante-e-bar-da-cioba',
        name: 'Restaurante e Bar da Cioba',
        category: 'gastronomia',
        lat: -7.4985,
        lng: -34.8071,
    },
    {
        id: 'passeios-pitimbu',
        name: 'Passeios Pitimbu',
        category: 'passeios',
        lat: -7.4690,
        lng: -34.8148,
    },
    {
        id: 'passeios-praia-bela',
        name: 'Passeios Praia Bela',
        category: 'passeios',
        lat: -7.4998,
        lng: -34.8058,
    },
    {
        id: 'cartorio-de-pitimbu',
        name: 'Cartório de Pitimbu',
        category: 'servicos',
        lat: -7.4662,
        lng: -34.8172,
    },
    {
        id: 'extra-popular-farma',
        name: 'Extra Popular Farma',
        category: 'servicos',
        lat: -7.4658,
        lng: -34.8179,
    },
    {
        id: 'gazfit-academia',
        name: 'Gazfit Academia',
        category: 'servicos',
        lat: -7.5289,
        lng: -34.7998,
    },
];

export const mapCategories = [
    { value: 'atracao', label: 'Atrações', color: '#ffad0a' },
    { value: 'hospedagem', label: 'Hospedagem', color: '#094f66' },
    { value: 'gastronomia', label: 'Gastronomia', color: '#04c6db' },
    { value: 'passeios', label: 'Passeios', color: '#25d366' },
    { value: 'servicos', label: 'Serviços', color: '#6b7280' },
];
