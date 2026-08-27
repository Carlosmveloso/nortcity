import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { generateOgImages } from './scripts/generate-og-images.mjs'
import { prerenderMeta } from './scripts/prerender-meta.mjs'

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
})
