import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3001',
    extraHTTPHeaders: { Accept: 'text/html,application/xhtml+xml,*/*' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      GRAPHQL_URL: process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql',
    },
  },
})
