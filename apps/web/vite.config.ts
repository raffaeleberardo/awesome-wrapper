import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In sviluppo l'API gira con `pnpm --filter @git-wrapped/api dev` sulla 3000.
    proxy: { '/api': 'http://localhost:3000' },
  },
  worker: { format: 'es' },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
