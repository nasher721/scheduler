import { defineConfig, devices } from '@playwright/test';

// These scenarios use a synthetic roster and never contact cloud storage.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'physician-scheduling.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 1024 } } }],
  webServer: {
    command: 'VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= pnpm dev --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
