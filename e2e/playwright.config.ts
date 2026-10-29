import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright (A0, poi A11).
 * - `e2e/**\/*.spec.ts`: percorso completo in demo mode (A11). Richiedono l'API: si lanciano
 *   contro lo stack Docker con `E2E_BASE_URL` (es. `http://localhost:8080` dopo `make demo`).
 * - `apps/web/src/**\/*.e2e.ts`: test dei singoli moduli (A6, A7, A8) sulle rotte `#/dev/*`,
 *   che non richiedono l'API.
 * Senza `E2E_BASE_URL` avvia il dev server Vite e gira solo i test dei moduli.
 * I progetti `firefox` e `webkit` girano solo l'export PNG. WebKit di Playwright non è Safari.
 */
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? 'http://localhost:5173';
const moduleTests = 'apps/web/src/**/*.e2e.ts';
const fullTests = external ? ['e2e/**/*.spec.ts', moduleTests] : [moduleTests];
const exportTests = external
  ? ['e2e/export.spec.ts', 'apps/web/src/cards/cards.e2e.ts']
  : ['apps/web/src/cards/cards.e2e.ts'];

export default defineConfig({
  testDir: '..',
  // I worktree degli agenti (.claude/) contengono copie del repo: mai eseguirli.
  testIgnore: ['**/.claude/**', '**/node_modules/**'],
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', testMatch: fullTests, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: fullTests, use: { ...devices['Pixel 7'] } },
    { name: 'firefox', testMatch: exportTests, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: exportTests, use: { ...devices['Desktop Safari'] } },
  ],
  webServer: external
    ? undefined
    : {
        command: 'pnpm --filter @git-wrapped/web dev --port 5173 --strictPort',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        cwd: '..',
      },
});
