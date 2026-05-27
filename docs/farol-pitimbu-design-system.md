# 🎨 Farol Pitimbu — Design System "Litoral Premium"

Documento de referência visual completo para o portal **Farol Pitimbu**. Use este guia como fonte única da verdade para todas as decisões de UI.

---

## 1. Identidade Visual

- **Nome do tema:** Litoral Premium
- **Conceito:** Sofisticação tropical — combina a serenidade do oceano nordestino com a vibração do sol e da areia de Pitimbu-PB.
- **Mood:** Confiável, acolhedor, premium, leve, contemporâneo.
- **Palavras-chave:** azul profundo, turquesa cristalino, areia clara, brisa, generoso, arredondado, fluido.

---

## 2. Paleta de Cores

### 2.1 Cores de Marca

| Token | HSL | HEX | Uso |
|---|---|---|---|
| `ocean` | `195 83% 22%` | `#0A4D68` | Primária — navbar, títulos, botões principais |
| `ocean-dark` | `195 83% 16%` | `#073B52` | Hover de primário, profundidade |
| `turquoise` | `186 96% 44%` | `#05BFDB` | Secundária — CTAs, destaques, links |
| `turquoise-light` | `186 96% 54%` | `#2BD6EF` | Hover de secundário |
| `sand` | `40 33% 94%` | `#F6F3EA` | Background geral |
| `sand-dark` | `40 25% 88%` | `#E8E2D2` | Surfaces sutis, divisores |
| `sun-yellow` | `40 100% 52%` | `#FFB703` | Accent — badges, estrelas, alertas positivos |

### 2.2 Tokens Semânticos (Light)

| Token | Valor HSL | Aplicação |
|---|---|---|
| `--background` | `40 33% 94%` | Fundo das páginas |
| `--foreground` | `215 28% 17%` | Texto principal |
| `--card` | `0 0% 100%` | Fundo de cards/modais |
| `--card-foreground` | `215 28% 17%` | Texto sobre card |
| `--primary` | `195 83% 22%` | Cor primária (ocean) |
| `--primary-foreground` | `0 0% 100%` | Texto sobre primário |
| `--secondary` | `186 96% 44%` | Cor secundária (turquoise) |
| `--secondary-foreground` | `0 0% 100%` | Texto sobre secundário |
| `--muted` | `40 25% 88%` | Backgrounds sutis |
| `--muted-foreground` | `215 16% 47%` | Texto secundário |
| `--accent` | `40 100% 52%` | Destaques pontuais (sun) |
| `--destructive` | `0 84% 60%` | Erros, ações destrutivas |
| `--border` | `40 20% 85%` | Bordas |
| `--input` | `40 20% 85%` | Borda de inputs |
| `--ring` | `186 96% 44%` | Focus ring |

### 2.3 Tokens Semânticos (Dark)

| Token | Valor HSL |
|---|---|
| `--background` | `215 28% 10%` |
| `--foreground` | `40 33% 94%` |
| `--card` | `215 28% 14%` |
| `--primary` | `186 96% 44%` |
| `--secondary` | `195 83% 22%` |
| `--muted` | `215 28% 20%` |
| `--border` | `215 28% 20%` |

> ⚠️ **Regra crítica:** sempre use tokens semânticos em componentes (`bg-primary`, `text-foreground`). Nunca use cores diretas (`bg-blue-500`, `text-white`).

---

## 3. Tipografia

### 3.1 Famílias

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

| Família | Uso | Pesos |
|---|---|---|
| **Poppins** | Títulos (h1-h6), CTAs, números de estatísticas | 400, 500, 600, 700, 800 |
| **Inter** | Corpo de texto, parágrafos, labels, inputs | 400, 500, 600 |

Tailwind: `font-heading` (Poppins) · `font-sans` (Inter, default).

### 3.2 Escala Tipográfica

| Token | Tamanho | Line-height | Weight | Uso |
|---|---|---|---|---|
| `text-6xl` / Hero | 60px (3.75rem) | 1.1 | 800 | Hero principal |
| `text-5xl` / H1 | 48px (3rem) | 1.15 | 700 | Page titles |
| `text-4xl` / H2 | 36px (2.25rem) | 1.2 | 700 | Section titles |
| `text-3xl` / H3 | 30px (1.875rem) | 1.25 | 600 | Subsection |
| `text-2xl` / H4 | 24px (1.5rem) | 1.3 | 600 | Card titles |
| `text-xl` | 20px (1.25rem) | 1.4 | 500 | Lead paragraph |
| `text-base` | 16px (1rem) | 1.6 | 400 | Body padrão |
| `text-sm` | 14px (0.875rem) | 1.5 | 400 | Texto secundário |
| `text-xs` | 12px (0.75rem) | 1.4 | 500 | Badges, captions |

Letter-spacing: títulos usam `tracking-tight` (-0.025em). Corpo usa padrão (0).

---

## 4. Espaçamento (Spacing)

Base: **4px (0.25rem)**. Escala Tailwind padrão.

| Token | px | Uso típico |
|---|---|---|
| `1` | 4px | Ícone-texto interno |
| `2` | 8px | Gap pequeno |
| `3` | 12px | Padding compacto |
| `4` | 16px | Padding padrão de card |
| `6` | 24px | Gap médio entre elementos |
| `8` | 32px | Padding de card grande |
| `12` | 48px | Gap entre blocos |
| `16` | 64px | Padding de seção mobile |
| `24` | 96px | Padding de seção desktop |

### Recomendações por contexto

- **Seções (`<section>`):** `py-16 md:py-24` (64px mobile / 96px desktop)
- **Container:** `padding: 1.5rem`, max-width por breakpoint
- **Cards:** `p-6` ou `p-8`, gap interno `gap-4`
- **Botões:** `px-5 py-2` (default), `px-8` (lg), `px-10` (xl)
- **Grid de cards:** `gap-6 md:gap-8`

---

## 5. Border Radius

```css
--radius: 1.25rem; /* 20px — base do design system */
```

| Classe Tailwind | Valor | Uso |
|---|---|---|
| `rounded-sm` | 12px | Inputs, badges pequenos |
| `rounded-md` | 16px | Botões médios |
| `rounded-lg` | 20px | Cards, botões grandes (padrão) |
| `rounded-xl` | 24px | Cards de destaque, modais |
| `rounded-2xl` | 28px | Hero cards, imagens premium |
| `rounded-full` | 9999px | Avatars, badges, botões pill |

> Cantos arredondados generosos (20px+) são parte essencial da identidade "premium suave".

---

## 6. Sombras

| Token | Valor | Uso |
|---|---|---|
| `shadow-sm` | `0 1px 2px 0 hsl(215 28% 17% / 0.05)` | Inputs, divisores sutis |
| `shadow-md` | `0 4px 6px -1px hsl(215 28% 17% / 0.08)` | Botões em repouso |
| `shadow-lg` | `0 10px 15px -3px hsl(215 28% 17% / 0.1)` | Botões hover, dropdowns |
| `shadow-xl` | `0 20px 25px -5px hsl(215 28% 17% / 0.1)` | Modais, hero CTAs |
| `shadow-card` | `0 4px 20px -2px hsl(195 83% 22% / 0.08)` | **Cards padrão (tint ocean)** |
| `shadow-card-hover` | `0 8px 30px -4px hsl(195 83% 22% / 0.15)` | **Hover de card** |

Sombras com tint ocean (`hsl(195 83% 22%)`) reforçam a marca.

---

## 7. Gradientes

| Token | Valor | Uso |
|---|---|---|
| `--gradient-ocean` | `linear-gradient(135deg, hsl(195 83% 22%) 0%, hsl(186 96% 44%) 100%)` | Stats section, logo, badges premium |
| `--gradient-turquoise` | `linear-gradient(135deg, hsl(186 96% 44%) 0%, hsl(186 96% 54%) 100%)` | Botões secundários hover |
| `--gradient-sand` | `linear-gradient(180deg, hsl(40 33% 94%) 0%, hsl(40 25% 88%) 100%)` | Backgrounds sutis |
| `--gradient-hero` | `linear-gradient(180deg, hsl(215 28% 17% / 0.6) 0%, hsl(215 28% 17% / 0.3) 50%, transparent 100%)` | Overlay em imagens hero |

Utilitários: `.bg-gradient-ocean`, `.bg-gradient-turquoise`, `.bg-gradient-hero`, `.text-gradient-ocean`.

---

## 8. Animações

### 8.1 Keyframes CSS

| Animação | Duração | Easing | Efeito |
|---|---|---|---|
| `fade-up` | 600ms | ease-out | opacity 0→1 + translateY 20px→0 |
| `fade-in` | 500ms | ease-out | opacity 0→1 |
| `scale-in` | 300ms | ease-out | opacity + scale 0.95→1 |
| `accordion-down/up` | 200ms | ease-out | height 0 ↔ auto |
| `shimmer` | — | — | translateX para skeleton loaders |

### 8.2 Padrões de Hover

```css
.hover-lift {
  transition: all 300ms;
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
}
```

### 8.3 Framer Motion

Padrão de entrada de seção:
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: index * 0.1 }}
/>
```

- **Stagger:** 100ms entre itens de grid
- **Duração padrão:** 300-600ms
- **Easing preferido:** `ease-out` para entradas, `ease-in-out` para hovers

---

## 9. Breakpoints e Grid

| Breakpoint | Min-width | Container max-width |
|---|---|---|
| `sm` | 640px | 640px |
| `md` | 768px | 768px |
| `lg` | 1024px | 1024px |
| `xl` | 1280px | 1280px |
| `2xl` | 1440px | 1440px |

**Container:** centrado, `padding: 1.5rem`.

**Padrões de grid:**
- Mobile: 1 coluna
- Tablet (`md:`): 2 colunas
- Desktop (`lg:`): 3-4 colunas
- Hero cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`

**Mobile-first sempre.** Toda media query começa pelo mobile.

---

## 10. Componentes

### 10.1 Button (variantes)

| Variant | Visual | Uso |
|---|---|---|
| `default` | bg-primary (ocean), shadow-md | Ação principal |
| `secondary` | bg-secondary (turquoise) | Ação alternativa |
| `outline` | borda 2px primary, transparente | Ação secundária discreta |
| `ghost` | sem fundo, hover-muted | Navegação, ícones |
| `link` | só texto sublinhado | Links inline |
| `hero` | turquoise + shadow-lg + translateY hover | CTAs principais |
| `heroOutline` | borda card + backdrop-blur | CTAs sobre imagem |
| `whatsapp` | `#25D366` | Botões de contato WhatsApp |
| `destructive` | bg-destructive | Excluir, cancelar |

**Tamanhos:** `sm` (36px) · `default` (40px) · `lg` (48px) · `xl` (56px) · `icon` (40×40).

### 10.2 Card

```tsx
<Card className="rounded-lg shadow-card hover:shadow-card-hover transition-all">
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

- Border-radius: 20px
- Padding: 24px (`p-6`)
- Hover: elevar 4px + shadow-card-hover

### 10.3 Badge

- `default`: bg-primary
- `secondary`: bg-secondary
- `outline`: borda + texto foreground
- Padding: `px-2.5 py-0.5`, text-xs, font-semibold, rounded-full

### 10.4 Navbar

- Altura: 64px mobile / 80px desktop
- Background: `bg-card/95 backdrop-blur-md`
- Border-bottom: 1px border
- Sticky: `fixed top-0 z-50`
- Logo: ícone 40×40 com `bg-gradient-ocean` + nome em Poppins bold

### 10.5 Footer

- Background: `bg-primary` (ocean)
- Texto: `text-card` (branco)
- Padding: `py-12 md:py-16`
- Colunas: 1 mobile / 4 desktop

---

## 11. Iconografia

- **Biblioteca:** [lucide-react](https://lucide.dev)
- **Tamanhos padrão:** 16px (inline), 20px (botões), 24px (navegação), 32px+ (features)
- **Stroke width:** 2 (padrão)
- **Cor:** herda do parent via `currentColor`

Ícones-chave do projeto: `MapPin`, `Compass`, `Waves`, `Sun`, `Star`, `Heart`, `Phone`, `Mail`, `Instagram`, `Menu`, `X`.

---

## 12. Imagens

| Contexto | Aspect Ratio | Border Radius | Tratamento |
|---|---|---|---|
| Hero | 16:9 ou full-bleed | 0 ou 24px | Overlay `gradient-hero` |
| Card de negócio | 4:3 | 20px (topo) | object-cover |
| Card horizontal | 16:9 | 20px | object-cover |
| Avatar | 1:1 | full | object-cover |
| Thumbnail | 1:1 | 12px | object-cover |

**Otimização:** lazy loading (`loading="lazy"`), formatos modernos (WebP/AVIF), `alt` descritivo sempre.

---

## 13. Acessibilidade

- **Contraste:** mínimo WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- **Focus visível:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **Tap targets:** mínimo 44×44px em mobile
- **Alt em imagens:** sempre obrigatório
- **Hierarquia semântica:** um único `<h1>` por página
- **aria-labels:** em botões de ícone (`aria-label="Menu"`)
- **prefers-reduced-motion:** respeitar nas animações decorativas

---

## 14. Princípios de UX

1. **Hierarquia clara:** tamanho, peso e cor guiam o olhar.
2. **Whitespace generoso:** seções respiram (`py-24` desktop).
3. **Microinterações sutis:** todo elemento interativo tem hover/focus.
4. **Mobile-first:** desenhe primeiro para 375px.
5. **Consistência:** mesmos tokens em toda a aplicação.
6. **Performance percebida:** skeleton loaders, fade-in suaves.
7. **Tom local-premium:** linguagem acolhedora, fotos reais de Pitimbu, sem clichês turísticos genéricos.

---

## 15. Checklist de Implementação

- [ ] Importar Poppins + Inter do Google Fonts no `index.html` ou `index.css`
- [ ] Definir todos os tokens HSL em `:root` e `.dark` no `index.css`
- [ ] Configurar `tailwind.config.ts` mapeando tokens semânticos
- [ ] Criar variantes de Button via `cva`
- [ ] Aplicar `shadow-card` + `hover-lift` em todos os cards
- [ ] Usar framer-motion `whileInView` em todas as seções
- [ ] Validar contraste com ferramenta WCAG
- [ ] Testar responsivo em 375px, 768px, 1280px, 1920px

---

*Documento gerado para Farol Pitimbu — Portal de Turismo e Diretório de Negócios de Pitimbu-PB.*
