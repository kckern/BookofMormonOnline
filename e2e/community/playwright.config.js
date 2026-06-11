/**
 * Playwright config for the community E2E suite (user + community/messaging
 * flows that write to bom_prd via the live UI). Separate from the read-only
 * deep-link suite in e2e/ because this one needs the write guards + cleanup.
 *
 * Run:  ALLOW_PROD_WRITES=1 npm run e2e:community
 * (preflight in global-setup refuses to run without the guards.)
 */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  // These flows write + clean up shared state (the regression account, study
  // hall). Run serially so concurrent specs can't race on that state.
  fullyParallel: false,
  workers: 1,
  // Study-group flows drive a lot of UI (open list → toggle → form → reload →
  // activate), and the messenger shim hydrates slowly — these need headroom.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: require.resolve('./global-setup.js'),
  globalTeardown: require.resolve('./global-teardown.js'),
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://10.0.0.10:8200',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list']],
});
