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
function sharePreviews(env, outDir = 'dist') {
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
      const images = await generateOgImages(`${outDir}/og`, publicados)
      const routes = await prerenderMeta(outDir, publicados)
      this.info(
        `preview: ${publicados.length} negócios do banco, ${images} imagens em ${outDir}/og, ${routes} rotas pré-renderizadas`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // CI e navegador não herdam arquivos .env nem credenciais VITE_* do shell.
  const isolated = mode === 'ci' || mode === 'e2e'
  const outDir = isolated ? 'dist-check' : 'dist'
  const testEnv = {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_SUPABASE_ANON_KEY: 'local-browser-test-key',
    VITE_ANALYTICS_ENABLED: 'false',
    VITE_EMAILJS_SERVICE_ID: '',
    VITE_EMAILJS_TEMPLATE_ID: '',
    VITE_EMAILJS_PUBLIC_KEY: '',
  }
  return {
    envDir: isolated ? false : __dirname,
    envPrefix: isolated ? 'ISOLATED_UNUSED_' : 'VITE_',
    define: isolated ? Object.fromEntries(Object.entries(testEnv).map(([key, value]) => [
      `import.meta.env.${key}`, JSON.stringify(value),
    ])) : {},
    plugins: [react(), tailwindcss(), sharePreviews(isolated ? {} : loadEnv(mode, __dirname, ''), outDir)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir,
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
      include: ['src/**/*.test.{js,jsx}'],
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
  }
})
