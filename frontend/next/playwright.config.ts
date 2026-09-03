import { defineConfig, devices } from '@playwright/test'
import { BOT_UA } from './test/helpers/meta'

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
      use: { ...devices['Desktop Chrome'], userAgent: BOT_UA },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001/og',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      GRAPHQL_URL: process.env.GRAPHQL_URL ?? 'http://localhost:5006/graphql',
      // Pin the host-allowlist redirect ON for tests, even on a dev box whose
      // .env.local sets BOM_ALLOW_ANY_HOST=1 (Next lets an existing process.env
      // value win over .env.local). Keeps host-allowlist.test.ts deterministic.
      BOM_ALLOW_ANY_HOST: '0',
    },
  },
})
