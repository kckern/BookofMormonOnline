/**
 * greenfield-readonly.spec.js
 *
 * Guards the green-field backend against main-site GraphQL parity regressions —
 * the kind the full cutover surfaced (people/places returning empty, a missing
 * `userprogress` resolver). Two parts:
 *
 *   1. UI drive — loads the homepage (which fires the real preload sequence:
 *      read, labels, person/place, division/fax/publications, …) and asserts
 *      zero uncaught page errors and zero GraphQL `errors` across every response.
 *   2. Read-surface sweep — fires the frontend's key read queries in sequence
 *      against /graphql and asserts each returns no errors and non-empty data.
 *
 * Logged-in coverage (userprogress) needs a token: set E2E_TOKEN (or
 * MESSENGER_TEST_TOKEN). Absent → those assertions are skipped. Read-only:
 * everything here is a query; the sandbox driver suppresses any incidental write.
 *
 * Run: cd e2e && E2E_BASE_URL=http://localhost:8200 npx playwright test greenfield-readonly
 */
const { test, expect } = require('@playwright/test');

const TOKEN = process.env.E2E_TOKEN || process.env.MESSENGER_TEST_TOKEN || '';

const isGraphqlPost = (res) => {
  if (res.request().method() !== 'POST') return false;
  const u = res.url();
  return /\/graphql(\?|$)/.test(u) || /:\d+\/[a-z]{2,4}$/.test(u); // /graphql or /{lang}
};

test.describe('green-field read-only GraphQL surface', () => {
  test('homepage loads without page or GraphQL errors', async ({ page, context }) => {
    if (TOKEN) await context.addInitScript((t) => localStorage.setItem('token', t), TOKEN);

    const pageErrors = [];
    const gqlErrors = [];
    const seen = new Set();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('response', async (res) => {
      if (!isGraphqlPost(res)) return;
      let json;
      try { json = await res.json(); } catch { return; }
      if (json.data) Object.keys(json.data).forEach((k) => seen.add(k));
      if (json.errors?.length) {
        let q = '?';
        try { q = (JSON.parse(res.request().postData() || '{}').query || '').replace(/\s+/g, ' ').slice(0, 90); } catch {}
        gqlErrors.push(`${json.errors.map((e) => e.message).join('; ')}  ::  ${q}`);
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // The real guard: a clean load. (Endpoint coverage is asserted deterministically
    // by the read-surface sweep below; async response capture here is best-effort.)
    expect(gqlErrors, `GraphQL errors:\n${gqlErrors.join('\n')}`).toEqual([]);
    expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    console.log(`[coverage] homepage hit endpoints: ${[...seen].join(', ') || '(none captured)'}`);
  });

  test('key read queries each return clean, non-empty data', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Post to the LANGUAGE path (/en) like the frontend's main-site client — the
    // green-field resolves lang from the last URL segment, so /graphql would yield
    // lang="graphql" and break lang-sensitive resolvers (e.g. search).
    const gql = async (query) => {
      const res = await page.request.post('/en', {
        headers: { 'content-type': 'application/json' },
        data: { query },
      });
      return res.json();
    };
    const expectData = async (query, key, { nonEmpty = true, requireData = true } = {}) => {
      const j = await gql(query);
      expect(j.errors, `errors for ${key}: ${JSON.stringify(j.errors)}`).toBeFalsy();
      if (requireData) {
        expect(j.data?.[key], `null data for ${key}`).toBeTruthy();
        if (nonEmpty && Array.isArray(j.data[key])) {
          expect(j.data[key].length, `empty array for ${key}`).toBeGreaterThan(0);
        }
      }
      return j.data?.[key];
    };

    // Sequence over the frontend's core read surface.
    await expectData('{ labels { key val } }', 'labels');
    await expectData('{ person { slug name title } }', 'person'); // no slug → full list (was empty before fix)
    await expectData('{ place { slug name } }', 'place', { nonEmpty: false }); // places table may be sparse
    await expectData('{ read(ref:"1 Nephi 1"){ ref verse_id verse_count } }', 'read', { nonEmpty: false });
    await expectData('{ scripture(ref:"1 Nephi 1:1"){ ref } }', 'scripture', { nonEmpty: false });
    // search's primary path is a Sphinx container (not reachable from dev), but the
    // green-field LIKE fallback covers dev — via the /en lang path it returns results.
    await expectData('{ search(query:"faith"){ reference } }', 'search');

    if (TOKEN) {
      // userprogress had no resolver pre-fix (returned null → homepage crash).
      const up = await expectData(
        `{ userprogress(token:"${TOKEN}"){ completed started count } }`,
        'userprogress',
        { nonEmpty: false },
      );
      expect(typeof up.count, 'userprogress.count should be a number').toBe('number');
    }
  });
});
