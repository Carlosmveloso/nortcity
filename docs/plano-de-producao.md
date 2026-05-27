# Plano de producao - Farol Pitimbu

Este documento organiza o passo a passo de desenvolvimento do projeto.
A ideia e construir primeiro um frontend estatico profissional, aprender bem a
base de React e so depois conectar dados reais, login, pagamentos e painel admin.

## Principio principal

Antes de adicionar banco de dados, autenticacao ou pagamentos, o fluxo publico
precisa estar bonito, navegavel e bem componentizado.

Ordem recomendada:

1. Estrutura visual
2. Paginas publicas
3. Componentes reutilizaveis
4. Navegacao com rotas
5. Dados mockados organizados
6. Estado, filtros e busca
7. Dados reais
8. Autenticacao
9. Dashboard
10. Monetizacao e admin

---

## Fase 1 - Base visual e layout global

Objetivo: criar a fundacao visual do site.

### Checklist

- [x] Criar Navbar
- [ ] Criar Footer
- [ ] Revisar `index.css` com tokens do design system
- [ ] Garantir fontes Poppins e Inter
- [ ] Criar estrutura basica de layout da pagina
- [ ] Definir espacamentos padrao das secoes

### O que aprender nesta fase

- Como separar componentes de layout
- Como aplicar classes globais
- Como usar tokens de cor e tipografia
- Como manter consistencia visual entre paginas

### Arquivos principais

```txt
src/components/layout/Navbar.jsx
src/components/layout/Footer.jsx
src/index.css
src/App.jsx
```

### Proximo passo sugerido

Como a Navbar ja foi feita, o proximo passo natural e criar o `Footer`.
Depois disso, voce ja tera a "moldura" do site pronta: topo e rodape.

---

## Fase 2 - Home estatica profissional

Objetivo: montar a primeira pagina completa do projeto.

### Checklist

- [ ] Criar/ajustar `Home.jsx`
- [ ] Criar `HeroSection.jsx`
- [ ] Criar secao de categorias
- [ ] Criar secao de negocios em destaque
- [ ] Criar secao de experiencias ou roteiro turistico
- [ ] Criar secao de estatisticas
- [ ] Criar CTA para cadastrar negocio

### Componentes sugeridos

```txt
src/components/home/HeroSection.jsx
src/components/home/CategoriesSection.jsx
src/components/home/FeaturedBusinesses.jsx
src/components/home/ExperiencesSection.jsx
src/components/home/StatsSection.jsx
src/components/home/CallToActionSection.jsx
```

### O que aprender nesta fase

- Como quebrar uma pagina grande em componentes menores
- Como passar textos e dados por props
- Como montar secoes reutilizaveis
- Como pensar em hierarquia visual

### Observacao importante

A Home deve ser a vitrine do produto. Ela precisa mostrar rapidamente:

- O que e o Farol Pitimbu
- Para quem ele serve
- Quais categorias existem
- Quais negocios aparecem em destaque
- Qual acao o visitante pode tomar

---

## Fase 3 - Componentes reutilizaveis

Objetivo: evitar repeticao e preparar o projeto para crescer.

### Checklist

- [ ] Criar `SectionHeader`
- [ ] Criar `BusinessCard`
- [ ] Criar `CategoryCard`
- [ ] Criar `PlanCard`
- [ ] Criar `Badge` ou usar componente de UI
- [ ] Criar botoes padronizados, se ainda nao existirem

### Estrutura sugerida

```txt
src/components/ui/
  Button.jsx
  Card.jsx
  Badge.jsx

src/components/business/
  BusinessCard.jsx
  CategoryCard.jsx
  PlanCard.jsx
  BusinessRating.jsx

src/components/common/
  SectionHeader.jsx
```

### O que aprender nesta fase

- Como identificar repeticao no codigo
- Como transformar blocos de JSX em componentes
- Como usar props para deixar componentes flexiveis
- Como organizar componentes por responsabilidade

### Exemplo de raciocinio

Se um card de negocio aparece na Home, na pagina Explorar e nos Favoritos,
ele nao deve ser refeito tres vezes. Ele deve virar um componente:

```jsx
<BusinessCard
  name="Pousada Mar Azul"
  category="Hospedagem"
  rating={4.8}
  image="/images/pousada.jpg"
/>
```

---

## Fase 4 - Rotas e paginas publicas

Objetivo: transformar o projeto em uma SPA navegavel.

### Checklist

- [ ] Instalar/configurar `react-router-dom`, se ainda nao estiver configurado
- [ ] Criar pasta `src/pages`
- [ ] Criar pagina `Home`
- [ ] Criar pagina `Explorar`
- [ ] Criar pagina `Categorias`
- [ ] Criar pagina `Planos`
- [ ] Criar pagina `Sobre`
- [ ] Criar pagina `Contato`
- [ ] Criar pagina `PerfilNegocio`
- [ ] Fazer links da Navbar navegarem corretamente

### Rotas sugeridas

```txt
/              Home
/explorar      Explorar negocios
/categorias    Todas as categorias
/planos        Planos de divulgacao
/sobre         Sobre o projeto
/contato       Contato
/negocio/:slug Perfil publico do negocio
```

### O que aprender nesta fase

- Como criar rotas
- Como navegar sem recarregar a pagina
- Como separar pagina de componente
- Como usar parametros de rota, como `:slug`

---

## Fase 5 - Dados mockados

Objetivo: simular dados reais antes de conectar banco.

### Checklist

- [ ] Criar arquivo de categorias mockadas
- [ ] Criar arquivo de negocios mockados
- [ ] Criar arquivo de planos mockados
- [ ] Usar `map()` para renderizar listas
- [ ] Passar dados mockados para cards via props

### Estrutura sugerida

```txt
src/lib/mockData.js
```

### Exemplos de dados

```js
export const categories = [
  {
    id: 1,
    name: "Gastronomia",
    slug: "gastronomia",
    icon: "Utensils",
  },
]

export const businesses = [
  {
    id: 1,
    name: "Restaurante Beira Mar",
    slug: "restaurante-beira-mar",
    category: "Gastronomia",
    rating: 4.8,
    neighborhood: "Centro",
  },
]
```

### O que aprender nesta fase

- Como trabalhar com arrays
- Como renderizar listas no React
- Como separar dados da interface
- Como preparar a estrutura para trocar mock por banco depois

---

## Fase 6 - Explorar, filtros e busca

Objetivo: dar vida ao frontend com estado.

### Checklist

- [ ] Criar listagem de negocios na pagina `Explorar`
- [ ] Criar filtro por categoria
- [ ] Criar filtro por bairro
- [ ] Criar filtro por preco
- [ ] Criar busca por texto
- [ ] Mostrar estado vazio quando nao houver resultado
- [ ] Melhorar responsividade dos filtros no mobile

### O que aprender nesta fase

- `useState`
- Eventos de formulario
- Filtros com `array.filter()`
- Busca por texto
- Renderizacao condicional

### Exemplo de objetivo

O usuario digita "pousada" e o site mostra apenas negocios que combinam com
esse termo. Depois ele pode combinar com categoria, bairro ou avaliacao.

---

## Fase 7 - Pagina de perfil do negocio

Objetivo: criar a pagina publica de cada negocio.

### Checklist

- [ ] Ler o `slug` da URL
- [ ] Encontrar o negocio correspondente nos mocks
- [ ] Mostrar imagem principal
- [ ] Mostrar galeria
- [ ] Mostrar descricao
- [ ] Mostrar endereco
- [ ] Mostrar horario de funcionamento
- [ ] Mostrar botao de WhatsApp
- [ ] Mostrar avaliacao e categoria
- [ ] Mostrar negocios relacionados

### O que aprender nesta fase

- `useParams` do React Router
- Busca de item em array com `find()`
- Pagina dinamica
- Composicao de componentes

---

## Fase 8 - Formularios

Objetivo: aprender entrada de dados no React.

### Checklist

- [ ] Criar formulario de contato
- [ ] Criar validacao simples de campos obrigatorios
- [ ] Mostrar mensagem de sucesso
- [ ] Criar estrutura inicial de formulario de cadastro de negocio

### O que aprender nesta fase

- Inputs controlados
- `useState` com formulario
- Validacao simples
- Feedback visual para usuario

---

## Fase 9 - Preparacao para dados reais

Objetivo: deixar o frontend pronto para trocar mocks por API/banco.

### Checklist

- [ ] Criar hooks para buscar dados
- [ ] Criar `useBusinesses`
- [ ] Criar `useCategories`
- [ ] Separar regras de filtro em funcoes reutilizaveis
- [ ] Organizar constantes em `src/lib`

### Estrutura sugerida

```txt
src/hooks/
  useBusinesses.js
  useCategories.js

src/lib/
  mockData.js
  formatters.js
  filters.js
```

### O que aprender nesta fase

- Como separar logica da tela
- Como hooks ajudam na organizacao
- Como preparar a migracao para dados reais

---

## Fase 10 - Dados reais, autenticacao e dashboard

Objetivo: sair do prototipo estatico para um produto funcional.

Esta fase deve vir apenas depois que o fluxo publico estiver bem resolvido.

### Checklist futuro

- [ ] Escolher banco/backend
- [ ] Configurar Supabase ou outra solucao
- [ ] Criar autenticacao
- [ ] Criar cadastro de negocio
- [ ] Criar dashboard do dono
- [ ] Criar edicao de perfil do negocio
- [ ] Criar upload de fotos
- [ ] Criar sistema de aprovacao

### O que aprender nesta fase

- Banco de dados
- Login e cadastro
- Regras de permissao
- CRUD
- Integracao frontend/backend

---

## Fase 11 - Monetizacao e admin

Objetivo: adicionar modelo de negocio e controle administrativo.

### Checklist futuro

- [ ] Criar planos pagos
- [ ] Integrar Stripe
- [ ] Criar checkout
- [ ] Criar painel admin
- [ ] Criar moderacao de negocios
- [ ] Criar metricas
- [ ] Criar destaques pagos

### Observacao

Esta fase nao deve ser prioridade agora. Primeiro, o site publico precisa estar
solido, bonito e facil de navegar.

---

## Ordem pratica para continuar agora

Como a Navbar ja esta pronta, siga esta ordem:

1. Fazer o Footer
2. Melhorar o Hero da Home
3. Criar `SectionHeader`
4. Criar dados mockados em `src/lib/mockData.js`
5. Criar `CategoryCard`
6. Criar secao de categorias na Home
7. Criar `BusinessCard`
8. Criar secao de negocios em destaque
9. Criar pagina Explorar
10. Adicionar filtros simples
11. Criar pagina Planos
12. Criar pagina Sobre
13. Criar pagina Contato
14. Criar pagina Perfil do Negocio

## Regra de aprendizado

Para cada parte nova, tente responder:

- Qual problema esse componente resolve?
- Ele e especifico do projeto ou generico?
- Ele precisa receber props?
- Ele vai ser reutilizado em outra pagina?
- A pagina continua legivel depois que eu separei os componentes?

Se a resposta for sim, voce esta construindo do jeito certo.
