import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright (A0, poi A11).
 * - `e2e/**\/*.spec.ts`: percorso completo, di A11.
 * - `apps/web/src/**\/*.e2e.ts`: test dei singoli moduli (A6, A7, A8) sulle rotte `#/dev/*`,
 *   che non richiedono l'API.
 * Di default avvia il dev server Vite; con `E2E_BASE_URL` punta a un'istanza già avviata
 * (es. `http://localhost:8080` dopo `make demo`).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: '..',
  testMatch: ['e2e/**/*.spec.ts', 'apps/web/src/**/*.e2e.ts'],
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @git-wrapped/web dev --port 5173 --strictPort',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        cwd: '..',
      },
});
