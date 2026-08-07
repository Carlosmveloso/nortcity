// Coordenadas de Pitimbu-PB obtidas via geocodificação (OpenStreetMap Nominatim/Overpass)
// e resolução de links do Google Maps de fontes oficiais (site da Prefeitura/Turismo Pitimbu).
// A partir daqui o mapa também reflete os negócios de src/data/businesses.js, os profissionais
// de src/data/professionals.js e as atrações de src/data/attractions.js que tinham algum dado
// de localização (endereço, bairro ou praia). Cada ponto abaixo traz um comentário com a fonte
// usada para posicioná-lo — quando não havia rua/número, o pino foi ancorado no bairro/praia
// citado no cadastro (com um leve deslocamento aleatório só para não empilhar vários pinos
// exatamente no mesmo ponto). Isso significa que a precisão varia por item; onde a fonte diz
// "estimativa fraca" ou "sem endereço", vale confirmar o local certo com o dono do negócio.
//
// Ficaram de fora do mapa (nenhum dado de localização em lugar nenhum, nem endereço nem bairro):
// Aluguel Pitimbu-PB, Edna Lanches, Fitness Food, Tiago Pastelaria, CakeDesigner - Tereu Ribeiro,
// Ubirajara (caranguejo), Poupa de Frutas Du'Carlos, Restaurante Eterno Ex-Gordo, Restaurante
// Nossa Praia, Miqueias (guia), João (passeios de barco), Eliane e Edjane (trançados), Ademir
// Mendes (manutenção), Rogério (gesso), Zel Sonhos Criativos, Neto (ar-condicionado), Aruenda da
// Saudade, e todos os "profissionais" cadastrados em businesses.js (Veloso corretor, Carlos
// Eduardo dev, Eliabe Crispim, Edielson engenheiro, Iremar construtor, Banda Ekklésia, Cezar
// Paredão, Ademir Mendes música). Também ficou de fora "Ilha de Areia Vermelha" — apesar de
// estar em attractions.js, esse ponto turístico fica em Cabedelo, não em Pitimbu (parece um erro
// no cadastro de atrações, vale revisar).

export const mapPoints = [
    { id: 'centro-pitimbu', name: 'Centro de Pitimbu', category: 'referencia', lat: -7.4733, lng: -34.8083 },
    { id: 'praia-de-pitimbu', name: 'Praia de Pitimbu', category: 'atracao', lat: -7.4743, lng: -34.8065 },
    { id: 'praia-bela', name: 'Praia Bela', category: 'atracao', lat: -7.3985, lng: -34.8055 },
    { id: 'distrito-de-acau', name: 'Distrito de Acaú', category: 'atracao', lat: -7.5401, lng: -34.8269 },
    { id: 'barra-de-abiai', name: 'Barra de Abiaí', category: 'atracao', lat: -7.4467, lng: -34.8110 },
    {
        id: 'asenza-beach-resort',
        name: 'Asenza Beach Resort',
        category: 'hospedagem',
        lat: -7.4360,
        lng: -34.8300,
    },
    {
        id: 'pousada-beira-mar-pitimbu',
        name: 'Pousada Beira Mar Pitimbu',
        category: 'hospedagem',
        lat: -7.4768,
        lng: -34.8100,
    },
    {
        id: 'sardinha-gastrobar',
        name: 'Sardinha Gastrobar',
        category: 'gastronomia',
        lat: -7.4762,
        lng: -34.8103,
    },
    {
        id: 'squina-mar',
        name: 'Squina Mar',
        category: 'gastronomia',
        lat: -7.52259,
        lng: -34.81549,
    }, // corrigido: businesses.js diz "Av. Beira Mar, 6326, Ponta de Coqueiro" (estava em Guarita, ~5km errado)
    {
        id: 'restaurante-e-bar-da-cioba',
        name: 'Restaurante e Bar da Cioba',
        category: 'gastronomia',
        lat: -7.39926,
        lng: -34.80471,
    }, // corrigido: businesses.js diz "Av. Beira Mar, Praia Bela" (estava perto do Centro, ~8km errado)
    {
        id: 'passeios-pitimbu',
        name: 'Passeios Pitimbu',
        category: 'passeios',
        lat: -7.4755,
        lng: -34.8090,
    },
    {
        id: 'passeios-praia-bela',
        name: 'Passeios Praia Bela',
        category: 'passeios',
        lat: -7.3978,
        lng: -34.8062,
    },
    {
        id: 'cartorio-de-pitimbu',
        name: 'Cartório de Pitimbu',
        category: 'servicos',
        lat: -7.4727,
        lng: -34.8073,
    }, // ajustado: businesses.js diz "Rua João Bpo. [Bispo], 60, Centro" (geocodificado diretamente)
    {
        id: 'extra-popular-farma',
        name: 'Extra Popular Farma',
        category: 'servicos',
        lat: -7.47515,
        lng: -34.81122,
    }, // corrigido: businesses.js diz "Rua Dr. João Gonçalves, 426, Centro" (mesma rua da Marcas e Modas)
    {
        id: 'gazfit-academia',
        name: 'Gazfit Academia',
        category: 'servicos',
        lat: -7.5390,
        lng: -34.8255,
    },

    // Hospedagem (src/data/businesses.js)
    { id: 'tekoha-vilas', name: 'Tekoha Vilas', category: 'hospedagem', lat: -7.49383, lng: -34.81332 }, // Beira Mar, Praia dos Mariscos
    { id: 'condominio-morada-das-falesias', name: 'Condomínio Morada das Falésias', category: 'hospedagem', lat: -7.39836, lng: -34.80506 }, // endereço genérico ("área beira-mar"); falésias remetem a Praia Bela
    { id: 'paraiso-praia-azul', name: 'Paraíso Praia Azul', category: 'hospedagem', lat: -7.51141, lng: -34.81002 }, // Beira Mar, Praia Azul/Praia dos Mariscos
    { id: 'kasa-da-falesia', name: 'Kasa da Falésia', category: 'hospedagem', lat: -7.39885, lng: -34.80506 }, // Rua das Falésias, Praia Bela
    { id: 'riviera-de-praia-bela', name: 'Riviera de Praia Bela', category: 'hospedagem', lat: -7.39859, lng: -34.80476 }, // Barra do Estoril, Praia Bela
    { id: 'pousada-aconchego', name: 'Pousada Aconchego', category: 'hospedagem', lat: -7.39901, lng: -34.80478 }, // Rua Peixe Boi, 216, Praia Bela
    { id: 'via-mar', name: 'Via Mar', category: 'hospedagem', lat: -7.51098, lng: -34.80993 }, // Av. Antônio Tavares, Praia Azul
    { id: 'casa-de-praia-pitimbu', name: 'Casa de Praia Pitimbu', category: 'hospedagem', lat: -7.51025, lng: -34.8111 }, // Praia Azul
    { id: 'casa-praia-azul-beira-mar', name: 'Casa Praia Azul (Beira Mar)', category: 'hospedagem', lat: -7.51096, lng: -34.81162 }, // Av. Antônio Tavares, Praia Azul
    { id: 'casa-praia-azul-residence', name: 'Casa Praia Azul Residence', category: 'hospedagem', lat: -7.51141, lng: -34.81014 }, // Av. Antônio Tavares, Praia Azul
    { id: 'casa-costa-de-marlin', name: 'Casa Costa de Marlin', category: 'hospedagem', lat: -7.51143, lng: -34.80981 }, // Av. Antônio Tavares, Praia Azul
    { id: 'pitihouse', name: 'Pitihouse', category: 'hospedagem', lat: -7.4953, lng: -34.81487 }, // Av. Antônio Tavares, 55, Praia dos Mariscos
    { id: 'casa-de-praia-pontal', name: 'Casa de Praia (Pontal)', category: 'hospedagem', lat: -7.46866, lng: -34.80531 }, // Praia do Pontal
    { id: 'casas-refugio', name: 'Casas Refúgio', category: 'hospedagem', lat: -7.49428, lng: -34.8141 }, // Av. Antônio Tavares, Praia dos Mariscos
    { id: 'casa-pitimbu10', name: 'Casa Pitimbu10', category: 'hospedagem', lat: -7.51012, lng: -34.81028 }, // Av. Antônio Tavares, Praia Azul
    { id: 'casa-beira-mar-praia-azul', name: 'Casa Beira Mar Praia Azul', category: 'hospedagem', lat: -7.51006, lng: -34.81047 }, // Beira Mar, Praia Azul
    { id: 'casa-praia-azul', name: 'Casa Praia Azul', category: 'hospedagem', lat: -7.51029, lng: -34.81016 }, // Praia Azul

    // Gastronomia (src/data/businesses.js)
    { id: 'assador-brasil-hispano', name: 'Assador Brasil Hispano', category: 'gastronomia', lat: -7.49398, lng: -34.81324 }, // Av. Antônio Tavares, Praia dos Mariscos
    { id: 'chacara-cozinha-da-roca', name: 'Chácara Cozinha da Roça', category: 'gastronomia', lat: -7.416, lng: -34.82468 }, // Sítio Mucatú, Zona Rural — estimativa fraca, sem rua/número
    { id: 'bar-e-restaurante-da-lagosta', name: 'Bar e Restaurante da Lagosta', category: 'gastronomia', lat: -7.39918, lng: -34.80526 }, // Av. Beira Mar, Praia Bela
    { id: 'padaria-senhor-do-bonfim', name: 'Padaria Senhor do Bonfim', category: 'gastronomia', lat: -7.47547, lng: -34.8093 }, // "Rua PB 044, Centro" não geocodificada; usado centro (Praça Senhor do Bonfim é coincidência de nome, não confirmação de rua)
    { id: 'confeitaria-maia', name: 'Confeitaria Maia', category: 'gastronomia', lat: -7.47368, lng: -34.80816 }, // Rua não geocodificada; usado centro
    { id: 'peixaria-do-chorao', name: 'Peixaria do Chorão', category: 'gastronomia', lat: -7.47939, lng: -34.81088 }, // R. Simões Barbosa, Centro
    { id: 'peixaria-do-marconio', name: 'Peixaria do Marconio', category: 'gastronomia', lat: -7.47812, lng: -34.81049 }, // ajustado: Travessa Antônio Tavares, Centro (geocodificado diretamente)

    // Passeios (src/data/businesses.js)
    { id: 'nova-quadritur-praia-bela', name: 'Nova Quadritur Praia Bela', category: 'passeios', lat: -7.39893, lng: -34.80491 }, // Beira Mar, Praia Bela, ao lado da Tirolesa
    { id: 'passeios-acau-beach', name: 'Passeios Acaú Beach', category: 'passeios', lat: -7.53946, lng: -34.82767 }, // sem endereço; inferido pelo nome (Acaú)
    { id: 'transporte-aquatico-acau', name: 'Transporte Aquático', category: 'passeios', lat: -7.53952, lng: -34.82619 }, // sem endereço; travessia Acaú-Carne de Vaca

    // Serviços (src/data/businesses.js)
    { id: 'veloso-rachel-imobiliaria', name: 'Veloso & Rachel', category: 'servicos', lat: -7.49527, lng: -34.814 }, // Av. Antônio Tavares, Praia dos Mariscos
    { id: 'cantinho-da-construcao', name: 'Cantinho da Construção', category: 'servicos', lat: -7.47506, lng: -34.81114 }, // ajustado: Rua do Rio, Centro (geocodificado diretamente)
    { id: 'guerra-construtor', name: 'Guerra Construtor', category: 'servicos', lat: -7.47715, lng: -34.81081 }, // ajustado: Av. Beira Mar, 556 fica na orla perto da Guarita, não no centro histórico
    { id: 'jbc-serralharia', name: 'JBC Serralharia', category: 'servicos', lat: -7.53309, lng: -34.82919 }, // Rua Bela Rosa, Acaú
    { id: 'pitimbu-vidros', name: 'Pitimbu Vidros', category: 'servicos', lat: -7.47364, lng: -34.80987 }, // Rua não geocodificada; usado centro
    { id: 'pitimbu-moveis', name: 'Pitimbu Móveis', category: 'servicos', lat: -7.47845, lng: -34.81146 }, // Travessa Simões Barbosa, 110
    { id: 'arataguy', name: 'Arataguy', category: 'servicos', lat: -7.47607, lng: -34.81046 }, // Rua do Jangadeiro, 42, Centro
    { id: 'arataguy-artesanatos-rogerio', name: 'Arataguy Artesanatos - Rogério', category: 'servicos', lat: -7.47582, lng: -34.81076 }, // Rua do Jangadeiro, 42, Centro (mesmo endereço da Arataguy)
    { id: 'marcas-e-modas', name: 'Marcas e Modas', category: 'servicos', lat: -7.47533, lng: -34.81158 }, // Rua Dr. João Gonçalves, 183, Centro
    { id: 'barbearia-homem-moderno', name: 'Barbearia Homem Moderno', category: 'servicos', lat: -7.478, lng: -34.81206 }, // Rua não geocodificada; usado Guarita
    { id: 'sky-net', name: 'Sky Net', category: 'servicos', lat: -7.47538, lng: -34.80936 }, // "Rua PB 044, Centro" não geocodificada; usado centro
    { id: 'pitimbu-gas', name: 'Pitimbu Gás', category: 'servicos', lat: -7.4746, lng: -34.80994 }, // Rua não geocodificada; usado centro
    { id: 'astanova', name: 'Astanova', category: 'servicos', lat: -7.46057, lng: -34.83572 }, // Zona Rural — estimativa fraca, sem referência específica
    { id: 'ama-marisqueiras-acau', name: 'AMA', category: 'servicos', lat: -7.54004, lng: -34.8266 }, // sem endereço; inferido pelo nome (Acaú)
    { id: 'coelho-pesca-acau', name: 'Coelho Pesca Acaú', category: 'servicos', lat: -7.54111, lng: -34.82589 }, // sem endereço; inferido pelo nome (Acaú)

    // Profissionais (src/data/professionals.js)
    { id: 'roberto-guia', name: 'Roberto Guia', category: 'profissionais', lat: -7.47499, lng: -34.8082 }, // location: 'Pitimbu' (genérico)
    { id: 'fatima-manicure', name: 'Fátima Manicure', category: 'profissionais', lat: -7.47438, lng: -34.80962 }, // location: 'Centro, Pitimbu'
    { id: 'ze-do-barco', name: 'Zé do Barco', category: 'profissionais', lat: -7.3986, lng: -34.80509 }, // location: 'Praia Bela'
    { id: 'dona-rosa-artesa', name: 'Dona Rosa', category: 'profissionais', lat: -7.54102, lng: -34.82793 }, // location: 'Acaú'
    { id: 'marcos-eletricista', name: 'Marcos Eletricista', category: 'profissionais', lat: -7.47446, lng: -34.80963 }, // location: 'Pitimbu' (genérico)
    { id: 'creuza-diarista', name: 'Creuza Diarista', category: 'profissionais', lat: -7.47368, lng: -34.8085 }, // location: 'Centro, Pitimbu'

    // Atrações adicionais (src/data/attractions.js)
    { id: 'trilha-piscinas-naturais', name: 'Trilha Piscinas Naturais', category: 'atracao', lat: -7.5407, lng: -34.82639 }, // location: 'Acaú'
    { id: 'feira-de-artesanato-do-centro', name: 'Feira de Artesanato do Centro', category: 'atracao', lat: -7.47505, lng: -34.80827 }, // location: 'Centro'
    { id: 'rota-gastronomica-da-beira-mar', name: 'Rota Gastronômica da Beira-Mar', category: 'atracao', lat: -7.47634, lng: -34.81189 }, // rota (não é ponto único); ancorado na Beira Mar/Guarita
];

export const mapCategories = [
    { value: 'atracao', label: 'Atrações', color: '#ffad0a' },
    { value: 'hospedagem', label: 'Hospedagem', color: '#094f66' },
    { value: 'gastronomia', label: 'Gastronomia', color: '#04c6db' },
    { value: 'passeios', label: 'Passeios', color: '#25d366' },
    { value: 'servicos', label: 'Serviços', color: '#6b7280' },
    { value: 'profissionais', label: 'Profissionais', color: '#9333ea' },
];
