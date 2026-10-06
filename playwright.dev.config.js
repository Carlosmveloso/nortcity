import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// E2E contra o Supabase hospedado de DESENVOLVIMENTO (farol-pitimbu-dev).
// Separado da suíte padrão: grava dados reais e exige a massa de
// supabase/diagnostics/offers_e2e_dev_setup.sql e a senha em E2E_DEV_PASSWORD.
// O modo `development` do Vite lê .env.development.local; a fixture recusa
// qualquer requisição que não seja ao projeto de desenvolvimento.
// O destino sai dos mesmos arquivos que o Vite vai ler. Se o modo de
// desenvolvimento cair no mesmo projeto do build de produção, nada roda.
const devEnv = loadEnv('development', process.cwd(), 'VITE_');
const prodEnv = loadEnv('production', process.cwd(), 'VITE_');
if (!devEnv.VITE_SUPABASE_URL || devEnv.VITE_SUPABASE_URL === prodEnv.VITE_SUPABASE_URL) {
    throw new Error('E2E dev recusado: .env.development.local precisa apontar para um projeto diferente do de produção.');
}
process.env.E2E_DEV_SUPABASE_ORIGIN = new URL(devEnv.VITE_SUPABASE_URL).origin;
process.env.E2E_FORBIDDEN_SUPABASE_ORIGIN = prodEnv.VITE_SUPABASE_URL ? new URL(prodEnv.VITE_SUPABASE_URL).origin : '';

export default defineConfig({
    testDir: './e2e-dev',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 120_000,
    reporter: [['list']],
    outputDir: 'test-results/dev',
    use: {
        baseURL: 'http://127.0.0.1:4174',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        serviceWorkers: 'block',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    webServer: {
        command: 'npx vite --mode development --host 127.0.0.1 --port 4174 --strictPort',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: false,
        env: { VITE_ANALYTICS_ENABLED: 'false' },
    },
});
