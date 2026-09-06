import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { generateOgImages } from './scripts/generate-og-images.mjs'
import { prerenderMeta } from './scripts/prerender-meta.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Gera as imagens e o HTML de preview de cada negócio/experiência depois do
// build. Sem isso o WhatsApp mostra o favicon ao compartilhar um link.
function sharePreviews() {
  return {
    name: 'farol-share-previews',
    apply: 'build',
    async closeBundle() {
      const images = await generateOgImages('dist/og')
      const routes = await prerenderMeta('dist')
      this.info(`preview: ${images} imagens em dist/og, ${routes} rotas pré-renderizadas`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), sharePreviews()],
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
})
