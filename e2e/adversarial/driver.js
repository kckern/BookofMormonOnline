/**
 * Adversarial study-group test driver.
 *
 * Reusable login + screenshot harness for the adversarial QA loop. Logs in as
 * the "Staff" account (creds pulled from env — see scripts that source them from
 * Infisical) via the REAL SignIn form, then exposes a tiny page + shot() helper
 * so per-iteration exploration scripts stay short and reliable.
 *
 * Usage (in a per-iteration script):
 *   const { run } = require('./driver');
 *   run(async ({ page, shot, baseUrl }) => {
 *     await page.goto(`${baseUrl}/study`, { waitUntil: 'domcontentloaded' });
 *     await shot('study-landing');
 *     // ... drive the UI, take more shots ...
 *   });
 *
 * Env:
 *   STAFF_USER, STAFF_PASS  — required, the Staff login (from Infisical /bom)
 *   BASE_URL                — default http://localhost:8200 (NOT 10.0.0.10, NOT
 *                             bom.kckern.net: feature-flag + Cloudflare cache)
 *   SHOT_DIR                — where screenshots land (default ./shots)
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8200';
const SHOT_DIR = process.env.SHOT_DIR || path.resolve(process.cwd(), 'shots');

async function signIn(page) {
  const user = process.env.STAFF_USER;
  const pass = process.env.STAFF_PASS;
  if (!user || !pass) throw new Error('driver: missing STAFF_USER / STAFF_PASS in env');

  await page.goto(`${BASE_URL}/user`, { waitUntil: 'domcontentloaded' });
  await page.locator('#username').waitFor({ state: 'visible', timeout: 25_000 });
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(pass);
  await page.locator('.Login button.login').first().click();
  try {
    await page.waitForFunction(() => !!window.localStorage.getItem('token'), null, { timeout: 25_000 });
  } catch (e) {
    const err = await page.locator('.alert-danger').first().textContent().catch(() => null);
    throw new Error(`driver signIn failed${err ? `: ${err.trim()}` : ' (no token persisted)'}`);
  }
}

/**
 * Boot a browser, log in as Staff, and invoke `fn` with { page, shot, baseUrl }.
 * shot(name) writes <SHOT_DIR>/<NN>-<name>.png (NN auto-increments) and returns
 * the path. Always closes the browser; rethrows after capturing a failure shot.
 */
async function run(fn) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  let n = 0;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  const shot = async (name) => {
    n += 1;
    const file = path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`[shot] ${file}`);
    return file;
  };

  try {
    await signIn(page);
    console.log('[driver] logged in as Staff');
    await fn({ page, shot, baseUrl: BASE_URL });
    if (errors.length) console.log(`[driver] captured ${errors.length} browser errors:\n` + errors.join('\n'));
  } catch (e) {
    try { await shot('FAILURE'); } catch { /* ignore */ }
    console.error('[driver] run failed:', e.message);
    if (errors.length) console.error('[driver] browser errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

module.exports = { run, BASE_URL, SHOT_DIR };
