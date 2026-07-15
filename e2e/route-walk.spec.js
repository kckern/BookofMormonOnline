/**
 * route-walk.spec.js
 *
 * Walks the app's routes (src/models/Routes.js) the way the menu does: every
 * top-level "menu item" plus a representative drill-down per feature. For each
 * route it asserts the page hydrates — no uncaught page errors, no GraphQL
 * `errors` in any response, and the view rendered real content (not a blank /
 * error boundary). This is the broad regression net against green-field
 * main-site parity gaps the full cutover surfaced.
 *
 * Detail-page params are real slugs/ids from the seed (person nephi1, place
 * jerusalem-1, object akishs-prison, commentary 1007619201). The sampler home
 * (/home) renders for everyone. Messaging routes (/community) need a member
 * token: set E2E_TOKEN (or MESSENGER_TEST_TOKEN); without it those are skipped
 * (the flag/route redirects to / anyway).
 *
 * Run: cd e2e && E2E_TOKEN=<token> npx playwright test route-walk
 */
const { test, expect } = require('@playwright/test');

const TOKEN = process.env.E2E_TOKEN || process.env.MESSENGER_TEST_TOKEN || '';

// Representative routes from Routes.js. `login` routes are messaging-gated.
const ROUTES = [
  { name: 'read scripture (/)', path: '/' },
  { name: 'people list', path: '/people' },
  { name: 'person detail', path: '/people/nephi1' },
  { name: 'places list', path: '/places' },
  { name: 'place detail', path: '/place/jerusalem-1' },
  { name: 'objects list', path: '/objects' },
  { name: 'object detail', path: '/objects/akishs-prison' },
  { name: 'timeline', path: '/timeline' },
  { name: 'relationships (people network)', path: '/relationships' },
  { name: 'maps', path: '/maps' },
  { name: 'history', path: '/history' },
  { name: 'history: joseph smith', path: '/history/joseph-smith' },
  { name: 'history: witnesses', path: '/history/witnesses' },
  { name: 'search', path: '/search/faith' },
  { name: 'about', path: '/about' },
  { name: 'contact', path: '/contact' },
  { name: 'analysis', path: '/analysis' },
  { name: 'contents', path: '/contents' },
  { name: 'commentary detail', path: '/commentary/1007619201' },
  { name: 'read deep (1 Nephi 1)', path: '/read/1-nephi-1' },
  { name: 'facsimiles', path: '/fax' },
  { name: 'sampler (/home)', path: '/home' },
  { name: 'community (/community)', path: '/community', login: true },
];

for (const route of ROUTES) {
  test(`hydrates: ${route.name} (${route.path})`, async ({ page, context }) => {
    test.skip(route.login && !TOKEN, 'needs E2E_TOKEN');
    if (route.login && TOKEN) {
      await context.addInitScript((t) => localStorage.setItem('token', t), TOKEN);
    }

    const pageErrors = [];
    const gqlErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)));
    page.on('response', async (res) => {
      if (res.request().method() !== 'POST') return;
      const u = res.url();
      if (!/\/graphql(\?|$)/.test(u) && !/:\d+\/[a-z]{2,4}$/.test(u)) return;
      let json;
      try { json = await res.json(); } catch { return; }
      if (json.errors?.length) {
        let q = '?';
        try { q = (JSON.parse(res.request().postData() || '{}').query || '').replace(/\s+/g, ' ').slice(0, 80); } catch {}
        gqlErrors.push(`${json.errors.map((e) => e.message).join('; ')} :: ${q}`);
      }
    });

    await page.goto(route.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Hydration signal: real content rendered (not blank / pure spinner / error boundary).
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';

    expect(gqlErrors, `[${route.path}] GraphQL errors:\n${gqlErrors.join('\n')}`).toEqual([]);
    expect(pageErrors, `[${route.path}] uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(bodyText.trim().length, `[${route.path}] page rendered no content`).toBeGreaterThan(40);
  });
}
