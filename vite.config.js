import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { generateOgImages } from './scripts/generate-og-images.mjs'
import { prerenderMeta } from './scripts/prerender-meta.mjs'
import { fetchPublishedBusinesses } from './scripts/publishedBusinesses.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Gera as imagens e o HTML de preview de cada negócio/experiência depois do
// build. Sem isso o WhatsApp mostra o favicon ao compartilhar um link.
//
// A lista de negócios vem do banco, buscada uma vez e passada aos dois
// geradores: preview e sitemap saindo da mesma consulta não têm como
// discordar entre si nem do que /explorar mostra.
function sharePreviews(env) {
  return {
    name: 'farol-share-previews',
    apply: 'build',
    async closeBundle() {
      const businesses = await fetchPublishedBusinesses(env)

      if (!businesses) {
        // Build local sem .env: o site funciona, só sai sem preview de
        // negócio. Em produção as variáveis existem — o app não sobe sem elas.
        this.warn(
          'sem credencial do Supabase: pulando previews e sitemap dos negócios. ' +
            'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para gerar o build completo.'
        )
      }

      const publicados = businesses ?? []
      const images = await generateOgImages('dist/og', publicados)
      const routes = await prerenderMeta('dist', publicados)
      this.info(
        `preview: ${publicados.length} negócios do banco, ${images} imagens em dist/og, ${routes} rotas pré-renderizadas`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), sharePreviews(loadEnv(mode, __dirname, ''))],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa vendors grandes e estáveis do código da app: navegações
        // seguintes reaproveitam o cache desses chunks mesmo quando só o
        // código da app muda (deploy novo), e o download inicial paraleliza
        // melhor do que um único chunk de 580kB+.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
          if (id.includes('@supabase')) return 'supabase-vendor'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
}))
