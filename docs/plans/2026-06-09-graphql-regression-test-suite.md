# GraphQL Regression Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Golden-snapshot regression suite covering the entire `GraphQLQueries.js` surface (en + ko), captured from prod and verifiable against prod/dev/local, as the safety net for the resolver overhaul.

**Architecture:** A standalone Jest project in root `tests/` imports the real frontend `prepareQueries()` to build queries, POSTs them to `{target}/{lang}` exactly as `BoMOnlineAPI.js` does, normalizes responses by per-query volatility tier, and either captures baselines (`CAPTURE=1`, prod only) or diffs against committed baselines. A one-time harvest script discovers real slugs/IDs from prod and writes the committed input matrix.

**Tech Stack:** Jest 30 + babel-jest (`@babel/preset-env` to import the frontend ESM file), axios, dotenv, scripture-guide (all but babel already root deps).

**Spec:** `docs/specs/2026-06-09-graphql-regression-test-suite.md`

**Verified facts (do not re-derive):**
- `POST {base}/en` and `POST {base}/ko` work on prod (`https://bookofmormon.online`), dev (`https://bom.kckern.net`), and local (`http://localhost:5005`). Body: `{"query":"{...}"}`, header `Content-Type: application/json`.
- Dev's public `/ko` returns **English** — pre-existing `setupProxy.js` mount-path-strip defect. Expected failure on `TARGET=dev`, documented in Task 12.
- `frontend/webapp/src/models/GraphQLQueries.js` and its only import `Cache.js` have no top-level browser API access; safe to import under babel-jest with `configFile:false`.
- `prepareQueries(input, token)` is the exported entry. `normalizeVal` wraps scalars in arrays; `val===true → false`; `[null]`/`[false]` first element → `false` (means "no args").
- Compound wrapping is `"{" + query + "}"` then `.replace(/{mutation(.*)}/, 'mutation$1')` (`BoMOnlineAPI.js:39-40`). Mutation builders emit single-line strings so the regex works.
- `versehighlights` arg `verse_pairs` = `[[bom_verse_id, bible_verse_id], ...]` (resolver `BomScripture.ts:109-117`). 2 Nephi 12 quotes Isaiah 2 verse-for-verse; `scripture-guide`'s `lookupReference` gives both id ranges.
- `queue` items: `[{slug}]` or `[{reference}]` or `[{plan}]` (`Theater.js:218-228`).
- `readingplan`/`readingplansegment` return `[]` without a valid token+slug/guid — that empty contract is still a capturable baseline.

---

## File map

| File | Responsibility |
|---|---|
| `tests/jest.config.js` | Standalone Jest project; babel transform with forced inline options |
| `tests/jest.setup.js` | Load `tests/.env.test` via dotenv |
| `tests/.env.test.example` | Committed template for test-user credentials |
| `tests/harness/targets.js` | `TARGET` env → base URL + sandbox flag; `urlFor(target, lang)` |
| `tests/harness/client.js` | `wrapCompound()` + `postQuery()` (45s timeout, 1 retry, non-GraphQL-body detection) |
| `tests/harness/normalize.js` | `scrub()`, `shapeOf()`, `shapesCompatible()`, `normalize(body, tier)` |
| `tests/harness/baseline.js` | `saveBaseline()` (RECAPTURE guard) / `loadBaseline()` (loud missing-baseline error) |
| `tests/harness/auth.js` | `creds()` from env; `ensureSignedIn(target)` signin→fallback signup |
| `tests/harness/runner.js` | `defineSuite(types)` — the glue: matrix → build → post → normalize → capture/compare |
| `tests/harness/*.test.js` | Unit tests colocated with each harness module |
| `tests/matrix/harvest.mjs` | One-time prod discovery → writes `inputs.json` |
| `tests/matrix/inputs.json` | Committed matrix: query type → {tier, auth, langs, cases} |
| `tests/suites/{content,scripture,media,search,user,community}.test.js` | Thin `defineSuite()` calls + parked todos |
| `tests/baselines/{en,ko}/<type>/<case>.json` | Committed prod-captured baselines |
| `tests/README.md` | Workflow documentation |

---

### Task 1: Scaffold the Jest project (riskiest assumption first: importing the frontend ESM file)

**Files:**
- Create: `tests/jest.config.js`, `tests/jest.setup.js`, `tests/harness/surface.test.js`, `tests/.env.test.example`
- Modify: `package.json` (scripts + devDependencies), `.gitignore`

- [ ] **Step 1: Install babel devDependencies**

```bash
npm install --save-dev @babel/core @babel/preset-env babel-jest
```

- [ ] **Step 2: Write the failing smoke test** — proves we can import the real frontend query builder

```js
// tests/harness/surface.test.js
const { prepareQueries } = require('../../frontend/webapp/src/models/GraphQLQueries');

describe('frontend GraphQLQueries import', () => {
  test('builds a person query from the real frontend module', () => {
    const built = prepareQueries({ person: ['nephi'] });
    expect(built).toHaveLength(1);
    expect(built[0].type).toBe('person');
    expect(built[0].query).toContain('person (slug: "nephi")');
  });

  test('builds a mutation string for signout', () => {
    const built = prepareQueries({ signout: [{ token: 'abc' }] });
    expect(built[0].query).toContain('mutation signout');
  });

  test('builds the dynamic passagenotes_7 alias', () => {
    const built = prepareQueries({ passagenotes_7: [31103] });
    expect(built[0].query).toContain('passagenotes_7: passagenotes (verse_ids: 31103)');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest --config tests/jest.config.js 2>&1 | tail -5`
Expected: FAIL — config file does not exist yet.

- [ ] **Step 4: Write the Jest config and setup file**

```js
// tests/jest.config.js
const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  roots: ['<rootDir>/tests'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testTimeout: 120000,
  maxWorkers: 1, // serial: mutation ordering + politeness to prod
  verbose: true,
  transform: {
    // configFile/babelrc false: never pick up CRA babel config from frontend/webapp
    '^.+\\.js$': ['babel-jest', {
      configFile: false,
      babelrc: false,
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
};
```

```js
// tests/jest.setup.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });
```

- [ ] **Step 5: Write the env template**

```bash
# tests/.env.test.example
# Copy to tests/.env.test (gitignored — repo is public, NEVER commit the real file).
# The test user exists only for this suite; mutations run against it.
TEST_USERNAME=regressiontest
TEST_PASSWORD=<generate: openssl rand -hex 12>
TEST_SESSION_TOKEN=<generate: openssl rand -hex 16>
TEST_NAME=Regression Test
TEST_EMAIL=bomtest+regression@example.com
TEST_ZIP=84604
```

- [ ] **Step 6: Add npm scripts and gitignore entry**

In root `package.json` `"scripts"`, add:

```json
"test:gql": "jest --config tests/jest.config.js",
"test:gql:capture": "CAPTURE=1 TARGET=prod jest --config tests/jest.config.js",
"test:gql:harvest": "node tests/matrix/harvest.mjs"
```

Append to `.gitignore`:

```
tests/.env.test
```

- [ ] **Step 7: Run the smoke test to verify it passes**

Run: `npm run test:gql 2>&1 | tail -10`
Expected: PASS (3 tests). If babel fails on the ESM import, the error will name `GraphQLQueries.js` — fix the transform before proceeding; everything else depends on this.

- [ ] **Step 8: Commit**

```bash
git add tests/ package.json package-lock.json .gitignore
git commit -m "test(gql): scaffold regression jest project importing frontend query surface"
```

---

### Task 2: targets.js

**Files:**
- Create: `tests/harness/targets.js`, `tests/harness/targets.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/targets.test.js
const { getTarget, urlFor } = require('./targets');

describe('targets', () => {
  const oldEnv = process.env.TARGET;
  afterEach(() => { process.env.TARGET = oldEnv; });

  test('defaults to dev', () => {
    delete process.env.TARGET;
    expect(getTarget().name).toBe('dev');
    expect(getTarget().sandbox).toBe(true);
  });

  test('resolves prod as non-sandbox', () => {
    process.env.TARGET = 'prod';
    const t = getTarget();
    expect(t.base).toBe('https://bookofmormon.online');
    expect(t.sandbox).toBe(false);
  });

  test('builds language URLs', () => {
    process.env.TARGET = 'local';
    expect(urlFor(getTarget(), 'ko')).toBe('http://localhost:5005/ko');
  });

  test('rejects unknown targets', () => {
    process.env.TARGET = 'staging';
    expect(() => getTarget()).toThrow(/Unknown TARGET/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --config tests/jest.config.js targets -t targets 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './targets'`

- [ ] **Step 3: Implement**

```js
// tests/harness/targets.js
const TARGETS = {
  prod:  { base: 'https://bookofmormon.online', sandbox: false },
  dev:   { base: 'https://bom.kckern.net',      sandbox: true },
  local: { base: 'http://localhost:5005',       sandbox: true },
};

function getTarget() {
  const name = process.env.TARGET || 'dev';
  const target = TARGETS[name];
  if (!target) {
    throw new Error(`Unknown TARGET "${name}". Use one of: ${Object.keys(TARGETS).join(', ')}`);
  }
  return { name, ...target };
}

// The backend resolves language from the URL path: POST {base}/{lang}
function urlFor(target, lang) {
  return `${target.base}/${lang}`;
}

module.exports = { getTarget, urlFor, TARGETS };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --config tests/jest.config.js targets 2>&1 | tail -5`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/harness/targets.js tests/harness/targets.test.js
git commit -m "test(gql): add target resolution (prod/dev/local, lang path URLs)"
```

---

### Task 3: client.js

**Files:**
- Create: `tests/harness/client.js`, `tests/harness/client.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/client.test.js
const { wrapCompound, postQuery } = require('./client');

describe('wrapCompound', () => {
  test('wraps plain queries in braces (mirrors BoMOnlineAPI.js:39)', () => {
    expect(wrapCompound('person (slug: "nephi"){ slug }')).toBe('{person (slug: "nephi"){ slug }}');
  });

  test('unwraps mutations (mirrors BoMOnlineAPI.js:40)', () => {
    expect(wrapCompound('mutation signout{ signout( token: "x" ) } '))
      .toBe('mutation signout{ signout( token: "x" ) } ');
  });
});

describe('postQuery', () => {
  test('returns a GraphQL body on success', async () => {
    const post = async () => ({ status: 200, data: { data: { labels: [] } } });
    await expect(postQuery('http://x/en', '{labels{key}}', { post }))
      .resolves.toEqual({ data: { labels: [] } });
  });

  test('retries once on transport failure', async () => {
    let calls = 0;
    const post = async () => {
      calls += 1;
      if (calls === 1) throw new Error('socket hang up');
      return { status: 200, data: { data: { ok: true } } };
    };
    await expect(postQuery('http://x/en', '{q}', { post })).resolves.toEqual({ data: { ok: true } });
    expect(calls).toBe(2);
  });

  test('rejects non-GraphQL bodies (e.g. proxy HTML error pages)', async () => {
    const post = async () => ({ status: 404, data: '<!DOCTYPE html>Cannot POST /' });
    await expect(postQuery('http://x/en', '{q}', { post })).rejects.toThrow(/Non-GraphQL response/);
  });

  test('keeps bodies that carry GraphQL errors — error behavior is contract', async () => {
    const post = async () => ({ status: 400, data: { errors: [{ message: 'bad field' }] } });
    await expect(postQuery('http://x/en', '{q}', { post }))
      .resolves.toEqual({ errors: [{ message: 'bad field' }] });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --config tests/jest.config.js client.test 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: Implement**

```js
// tests/harness/client.js
const axios = require('axios');

// Mirrors BoMOnlineAPI.js:39-40 exactly — this IS the contract under test.
function wrapCompound(queryString) {
  let compound = '{' + queryString + '}';
  compound = compound.replace(/{mutation(.*)}/, 'mutation$1');
  return compound;
}

const defaultPost = (url, query) => axios({
  method: 'post',
  url,
  timeout: 45000, // matches the frontend client timeout
  headers: { 'Content-Type': 'application/json' },
  data: { query },
  validateStatus: () => true, // Apollo sends GraphQL errors with 400; those bodies are contract
});

async function postQuery(url, queryString, { post = defaultPost } = {}) {
  const compound = wrapCompound(queryString);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await post(url, compound);
      const body = response.data;
      if (body && typeof body === 'object' && ('data' in body || 'errors' in body)) return body;
      lastError = new Error(
        `Non-GraphQL response (HTTP ${response.status}) from ${url}: ${JSON.stringify(body).slice(0, 200)}`
      );
    } catch (error) {
      lastError = new Error(`Transport failure POSTing to ${url}: ${error.message}`);
    }
  }
  throw lastError;
}

module.exports = { wrapCompound, postQuery };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --config tests/jest.config.js client.test 2>&1 | tail -5`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/harness/client.js tests/harness/client.test.js
git commit -m "test(gql): add HTTP client mirroring frontend compound-query behavior"
```

---

### Task 4: normalize.js

**Files:**
- Create: `tests/harness/normalize.js`, `tests/harness/normalize.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/normalize.test.js
const { scrub, shapeOf, shapesCompatible, normalize } = require('./normalize');

describe('scrub', () => {
  test('masks volatile keys recursively, preserves nulls', () => {
    const input = {
      data: {
        tokensignin: {
          user: { name: 'Test', time: 1749480000, access_token: 'abc', bookmark: null },
          sessions: [{ datetime: '2026-06-09', duration: 42 }],
        },
      },
    };
    expect(scrub(input)).toEqual({
      data: {
        tokensignin: {
          user: { name: 'Test', time: '[SCRUBBED]', access_token: '[SCRUBBED]', bookmark: null },
          sessions: [{ datetime: '[SCRUBBED]', duration: '[SCRUBBED]' }],
        },
      },
    });
  });
});

describe('shapeOf', () => {
  test('maps primitives to type names and merges array element shapes', () => {
    expect(shapeOf({ a: 'x', b: 3, c: null, d: [{ e: 1 }, { e: null }] }))
      .toEqual({ a: 'string', b: 'number', c: 'null', d: [{ e: 'number' }] });
  });

  test('empty arrays stay empty', () => {
    expect(shapeOf({ a: [] })).toEqual({ a: [] });
  });
});

describe('shapesCompatible', () => {
  test('accepts matching shapes and treats null as wildcard', () => {
    expect(shapesCompatible({ a: 'string', b: 'null' }, { a: 'string', b: 'number' })).toEqual([]);
  });

  test('reports mismatch paths', () => {
    const problems = shapesCompatible({ a: 'string' }, { a: 'number' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('.a');
  });

  test('reports missing and unexpected keys', () => {
    expect(shapesCompatible({ a: 'string' }, { b: 'string' })).toHaveLength(2);
  });
});

describe('normalize', () => {
  test('exact passes through, scrubbed scrubs, shape shapes', () => {
    const body = { data: { x: { timestamp: 5, name: 'n' } } };
    expect(normalize(body, 'exact')).toEqual(body);
    expect(normalize(body, 'scrubbed').data.x.timestamp).toBe('[SCRUBBED]');
    expect(normalize(body, 'shape')).toEqual({ data: { x: { timestamp: 'number', name: 'string' } } });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --config tests/jest.config.js normalize 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './normalize'`

- [ ] **Step 3: Implement**

```js
// tests/harness/normalize.js
// Volatile keys masked under the "scrubbed" tier. Applied ONLY to scrubbed-tier
// queries, so e.g. stable content `duration` on text blocks (exact tier) is untouched.
const SCRUB_KEYS = new Set([
  'access_token', 'token', 'time', 'timestamp', 'datetime', 'date',
  'lastseen', 'laststudied', 'last_seen_at', 'joined_ts', 'created_at',
  'duration', 'first', 'startdate', 'duedate',
]);

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SCRUB_KEYS.has(k) && v != null ? '[SCRUBBED]' : scrub(v);
    }
    return out;
  }
  return value;
}

function mergeShapes(a, b) {
  if (a === 'null') return b;
  if (b === 'null') return a;
  if (typeof a === 'string' || typeof b === 'string') return a === b ? a : 'mixed';
  if (Array.isArray(a) && Array.isArray(b)) {
    if (!a.length) return b;
    if (!b.length) return a;
    return [mergeShapes(a[0], b[0])];
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? mergeShapes(out[k], v) : v;
    return out;
  }
  return 'mixed';
}

function shapeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return [value.map(shapeOf).reduce(mergeShapes)];
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = shapeOf(v);
    return out;
  }
  return typeof value;
}

// Compares two shape trees; 'null' acts as a wildcard on either side so nullable
// fields don't flake. Returns a list of human-readable mismatch paths (empty = ok).
function shapesCompatible(expected, actual, path = '$', problems = []) {
  if (expected === 'null' || actual === 'null') return problems;
  if (typeof expected === 'string' || typeof actual === 'string') {
    if (expected !== actual) {
      problems.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    return problems;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      problems.push(`${path}: array/object mismatch`);
      return problems;
    }
    if (expected.length && actual.length) shapesCompatible(expected[0], actual[0], `${path}[]`, problems);
    return problems;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const k of keys) {
    if (!(k in expected)) problems.push(`${path}.${k}: unexpected key`);
    else if (!(k in actual)) problems.push(`${path}.${k}: missing key`);
    else shapesCompatible(expected[k], actual[k], `${path}.${k}`, problems);
  }
  return problems;
}

function normalize(body, tier) {
  if (tier === 'shape') return shapeOf(body);
  if (tier === 'scrubbed') return scrub(body);
  return body;
}

module.exports = { SCRUB_KEYS, scrub, shapeOf, mergeShapes, shapesCompatible, normalize };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --config tests/jest.config.js normalize 2>&1 | tail -5`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/harness/normalize.js tests/harness/normalize.test.js
git commit -m "test(gql): add volatility normalization (scrub/shape tiers)"
```

> **Note for executor:** `date` is in SCRUB_KEYS but `history.date` and `person.date` are *stable content* — they're fine because those queries are `exact` tier and scrub never runs on them. If a scrubbed-tier query later needs a stable `date`, split the key lists per query — don't weaken the global list silently.

---

### Task 5: baseline.js

**Files:**
- Create: `tests/harness/baseline.js`, `tests/harness/baseline.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/baseline.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { saveBaseline, loadBaseline } = require('./baseline');

describe('baseline storage', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.RECAPTURE; });

  test('round-trips a body', () => {
    saveBaseline('en', 'person', 'single', { data: { person: [{ slug: 'nephi' }] } }, { dir });
    expect(loadBaseline('en', 'person', 'single', { dir }))
      .toEqual({ data: { person: [{ slug: 'nephi' }] } });
  });

  test('refuses overwrite without RECAPTURE=1', () => {
    saveBaseline('en', 'person', 'single', { v: 1 }, { dir });
    const second = saveBaseline('en', 'person', 'single', { v: 2 }, { dir });
    expect(second.written).toBe(false);
    expect(loadBaseline('en', 'person', 'single', { dir })).toEqual({ v: 1 });
  });

  test('overwrites with RECAPTURE=1', () => {
    saveBaseline('en', 'person', 'single', { v: 1 }, { dir });
    process.env.RECAPTURE = '1';
    saveBaseline('en', 'person', 'single', { v: 2 }, { dir });
    expect(loadBaseline('en', 'person', 'single', { dir })).toEqual({ v: 2 });
  });

  test('missing baseline fails loudly with capture instructions', () => {
    expect(() => loadBaseline('ko', 'person', 'single', { dir }))
      .toThrow(/Missing baseline.*test:gql:capture/s);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --config tests/jest.config.js baseline 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './baseline'`

- [ ] **Step 3: Implement**

```js
// tests/harness/baseline.js
const fs = require('fs');
const path = require('path');

const BASELINE_DIR = path.resolve(__dirname, '..', 'baselines');

function baselinePath(lang, type, caseName, dir) {
  return path.join(dir, lang, type, `${caseName}.json`);
}

function saveBaseline(lang, type, caseName, body, { dir = BASELINE_DIR } = {}) {
  const file = baselinePath(lang, type, caseName, dir);
  if (fs.existsSync(file) && process.env.RECAPTURE !== '1') {
    return { written: false, file };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
  return { written: true, file };
}

function loadBaseline(lang, type, caseName, { dir = BASELINE_DIR } = {}) {
  const file = baselinePath(lang, type, caseName, dir);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing baseline ${path.relative(process.cwd(), file)}.\n` +
      'Capture baselines from prod first: npm run test:gql:capture'
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { saveBaseline, loadBaseline, BASELINE_DIR };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --config tests/jest.config.js baseline 2>&1 | tail -5`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/harness/baseline.js tests/harness/baseline.test.js
git commit -m "test(gql): add baseline storage with recapture guard and loud missing-file errors"
```

---

### Task 6: auth.js

**Files:**
- Create: `tests/harness/auth.js`, `tests/harness/auth.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/auth.test.js
const { creds, ensureSignedIn } = require('./auth');

const TEST_ENV = {
  TEST_USERNAME: 'regressiontest',
  TEST_PASSWORD: 'pw',
  TEST_SESSION_TOKEN: 'feedfacefeedfacefeedfacefeedface',
  TEST_NAME: 'Regression Test',
  TEST_EMAIL: 'bomtest+regression@example.com',
  TEST_ZIP: '84604',
};

describe('auth', () => {
  const saved = {};
  beforeEach(() => {
    for (const [k, v] of Object.entries(TEST_ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  });
  afterEach(() => {
    for (const k of Object.keys(TEST_ENV)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  });

  test('creds throws a setup hint when env is missing', () => {
    delete process.env.TEST_USERNAME;
    expect(() => creds()).toThrow(/\.env\.test/);
  });

  test('returns the session token when signin succeeds', async () => {
    const post = async () => ({ status: 200, data: { data: { signin: { isSuccess: true } } } });
    const target = { name: 'prod', base: 'https://x', sandbox: false };
    await expect(ensureSignedIn(target, { post })).resolves.toBe(TEST_ENV.TEST_SESSION_TOKEN);
  });

  test('falls back to signup, then signs in', async () => {
    const sent = [];
    const post = async (url, query) => {
      sent.push(query);
      if (query.includes('signup')) return { status: 200, data: { data: { signup: { isSuccess: true } } } };
      // first signin fails, signin after signup succeeds
      const isRetry = sent.filter((q) => q.includes('signin')).length > 1;
      return { status: 200, data: { data: { signin: { isSuccess: isRetry } } } };
    };
    const target = { name: 'prod', base: 'https://x', sandbox: false };
    await expect(ensureSignedIn(target, { post })).resolves.toBe(TEST_ENV.TEST_SESSION_TOKEN);
    expect(sent.some((q) => q.includes('signup'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --config tests/jest.config.js auth.test 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 3: Implement**

```js
// tests/harness/auth.js
const { prepareQueries } = require('../../frontend/webapp/src/models/GraphQLQueries');
const { postQuery } = require('./client');
const { urlFor } = require('./targets');

function creds() {
  const {
    TEST_USERNAME, TEST_PASSWORD, TEST_SESSION_TOKEN, TEST_NAME, TEST_EMAIL, TEST_ZIP,
  } = process.env;
  if (!TEST_USERNAME || !TEST_PASSWORD || !TEST_SESSION_TOKEN || !TEST_EMAIL) {
    throw new Error('Missing test-user credentials: copy tests/.env.test.example to tests/.env.test and fill it in.');
  }
  return {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    token: TEST_SESSION_TOKEN,
    name: TEST_NAME || 'Regression Test',
    email: TEST_EMAIL,
    zip: TEST_ZIP || '00000',
  };
}

// signin binds the client-supplied session token to the user; the token itself
// is the credential all gated queries use afterward.
async function ensureSignedIn(target, { post } = {}) {
  const c = creds();
  const opts = post ? { post } : {};
  const url = urlFor(target, 'en');
  const signinQuery = () =>
    prepareQueries({ signin: [{ username: c.username, password: c.password, token: c.token }] })[0].query;

  let body = await postQuery(url, signinQuery(), opts);
  if (body.data?.signin?.isSuccess) return c.token;

  const signupQuery = prepareQueries({
    signup: [{ token: c.token, username: c.username, password: c.password, name: c.name, email: c.email, zip: c.zip }],
  })[0].query;
  await postQuery(url, signupQuery, opts);

  body = await postQuery(url, signinQuery(), opts);
  if (!body.data?.signin?.isSuccess) {
    throw new Error(
      `Could not sign in or sign up test user "${c.username}" on ${target.name}: ${JSON.stringify(body).slice(0, 300)}`
    );
  }
  return c.token;
}

module.exports = { creds, ensureSignedIn };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --config tests/jest.config.js auth.test 2>&1 | tail -5`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/harness/auth.js tests/harness/auth.test.js
git commit -m "test(gql): add self-bootstrapping test-user auth"
```

---

### Task 7: runner.js

**Files:**
- Create: `tests/harness/runner.js`, `tests/harness/runner.test.js`

- [ ] **Step 1: Write the failing test** (pure helpers only — `defineSuite` is exercised by the real suites)

```js
// tests/harness/runner.test.js
const { fillPlaceholders, buildQuery } = require('./runner');

describe('fillPlaceholders', () => {
  test('replaces tokens deep in arrays and objects', () => {
    const input = [{ token: '{{TOKEN}}', items: [{ slug: 'abinadi' }] }];
    expect(fillPlaceholders(input, { TOKEN: 'abc123' }))
      .toEqual([{ token: 'abc123', items: [{ slug: 'abinadi' }] }]);
  });

  test('leaves non-strings untouched', () => {
    expect(fillPlaceholders([31103, true, null], { TOKEN: 'x' })).toEqual([31103, true, null]);
  });
});

describe('buildQuery', () => {
  test('builds exactly one query through the real frontend module', () => {
    const query = buildQuery('person', ['nephi']);
    expect(query).toContain('person (slug: "nephi")');
  });

  test('passes token to arity-2 builders', () => {
    const query = buildQuery('divisionProgress', ['bofm'], 'tok123');
    expect(query).toContain('progress(token: "tok123")');
  });

  test('throws on unknown query types', () => {
    expect(() => buildQuery('nosuchquery', ['x'])).toThrow(/nosuchquery/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --config tests/jest.config.js runner.test 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './runner'`

- [ ] **Step 3: Implement**

```js
// tests/harness/runner.js
const fs = require('fs');
const path = require('path');
const { prepareQueries } = require('../../frontend/webapp/src/models/GraphQLQueries');
const { postQuery } = require('./client');
const { getTarget, urlFor } = require('./targets');
const { normalize, shapeOf, shapesCompatible } = require('./normalize');
const { saveBaseline, loadBaseline } = require('./baseline');
const { ensureSignedIn, creds } = require('./auth');

const MATRIX_PATH = path.resolve(__dirname, '..', 'matrix', 'inputs.json');
const CAPTURE = process.env.CAPTURE === '1';

let matrixCache = null;
function loadMatrix() {
  if (!matrixCache) {
    if (!fs.existsSync(MATRIX_PATH)) {
      throw new Error(`Missing ${MATRIX_PATH}. Generate it first: npm run test:gql:harvest`);
    }
    matrixCache = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
  }
  return matrixCache;
}

function fillPlaceholders(value, replacements) {
  if (typeof value === 'string') {
    return Object.entries(replacements).reduce(
      (acc, [k, v]) => acc.split(`{{${k}}}`).join(v ?? ''), value
    );
  }
  if (Array.isArray(value)) return value.map((v) => fillPlaceholders(v, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillPlaceholders(v, replacements)]));
  }
  return value;
}

function buildQuery(type, caseInput, token) {
  const built = prepareQueries({ [type]: caseInput }, token);
  if (built.length !== 1) {
    throw new Error(`prepareQueries built ${built.length} queries for type "${type}" — expected exactly 1`);
  }
  return built[0].query;
}

// Defines one describe-block per query type, one test per (lang, case).
// Capture mode (CAPTURE=1) writes baselines and is allowed ONLY against prod.
function defineSuite(types) {
  const target = getTarget();
  if (CAPTURE && target.name !== 'prod') {
    throw new Error('Baselines are prod truth: capture requires TARGET=prod (npm run test:gql:capture).');
  }

  for (const type of types) {
    const def = loadMatrix()[type];
    if (!def) {
      throw new Error(`Query type "${type}" missing from tests/matrix/inputs.json — re-run npm run test:gql:harvest`);
    }

    describe(type, () => {
      let token = null;
      if (def.auth) {
        beforeAll(async () => {
          token = await ensureSignedIn(target);
        });
      }

      for (const lang of def.langs || ['en', 'ko']) {
        for (const [caseName, rawInput] of Object.entries(def.cases)) {
          test(`${type}.${caseName} [${lang}]`, async () => {
            const c = def.auth ? creds() : {};
            const input = fillPlaceholders(rawInput, {
              TOKEN: token, USER: c.username, PASS: c.password,
              NAME: c.name, EMAIL: c.email, ZIP: c.zip,
            });
            const query = buildQuery(type, input, token);
            const body = await postQuery(urlFor(target, lang), query);
            const stored = normalize(body, def.tier); // capture-normalization, always per declared tier

            if (CAPTURE) {
              const { written, file } = saveBaseline(lang, type, caseName, stored);
              if (!written) console.warn(`baseline exists, skipped (RECAPTURE=1 to overwrite): ${file}`);
              return;
            }

            const baseline = loadBaseline(lang, type, caseName);
            // Sandbox targets (dev/local) swallow user writes, so auth'd queries
            // can only be shape-verified there.
            const downgraded = def.auth && target.sandbox && def.tier !== 'shape';
            if (def.tier === 'shape' || downgraded) {
              const expected = downgraded ? shapeOf(baseline) : baseline;
              const actual = downgraded ? shapeOf(stored) : stored;
              expect(shapesCompatible(expected, actual)).toEqual([]);
            } else {
              expect(stored).toEqual(baseline);
            }
          });
        }
      }
    });
  }
}

module.exports = { defineSuite, fillPlaceholders, buildQuery, loadMatrix };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --config tests/jest.config.js runner.test 2>&1 | tail -5`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/harness/runner.js tests/harness/runner.test.js
git commit -m "test(gql): add suite runner with capture/verify modes and sandbox downgrade"
```

---

### Task 8: Harvest script + committed input matrix

**Files:**
- Create: `tests/matrix/harvest.mjs`
- Generate + commit: `tests/matrix/inputs.json`

- [ ] **Step 1: Write the harvest script**

```js
// tests/matrix/harvest.mjs
// One-time discovery: samples real slugs/IDs from prod and writes the committed
// input matrix. Re-run only when the data pool needs refreshing; baselines must
// be recaptured (RECAPTURE=1) afterwards.
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookupReference } from 'scripture-guide';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROD = 'https://bookofmormon.online/en';

async function gql(query) {
  const { data } = await axios.post(PROD, { query }, {
    headers: { 'Content-Type': 'application/json' }, timeout: 45000,
  });
  if (!data?.data) throw new Error(`Harvest probe failed: ${query.slice(0, 60)} → ${JSON.stringify(data).slice(0, 200)}`);
  return data.data;
}

// Deterministic sample: first, last, and evenly spaced middles.
function spread(arr, n) {
  if (arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(arr[Math.floor((i * (arr.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}

const warnings = [];
async function probe(label, query, extract) {
  try {
    const pool = extract(await gql(query)).filter((v) => v !== null && v !== undefined);
    if (!pool.length) throw new Error('empty pool');
    console.log(`✓ ${label}: ${pool.length} items`);
    return pool;
  } catch (error) {
    warnings.push(`${label}: ${error.message}`);
    console.warn(`✗ ${label}: ${error.message}`);
    return null;
  }
}

const REQUIRED = ['people', 'places', 'objects', 'divisions', 'maps', 'commentaries', 'images', 'texts'];

async function main() {
  const pools = {
    people:       await probe('people',       '{person{slug}}',                (d) => d.person.map((x) => x.slug)),
    places:       await probe('places',       '{place{slug}}',                 (d) => d.place.map((x) => x.slug)),
    objects:      await probe('objects',      '{object{slug}}',                (d) => d.object.map((x) => x.slug)),
    divisions:    await probe('divisions',    '{division{slug pages{slug}}}',  (d) => d.division.map((x) => x.slug)),
    pages:        await probe('pages',        '{division{slug pages{slug}}}',  (d) => d.division.flatMap((x) => x.pages.map((p) => p.slug))),
    maps:         await probe('maps',         '{maps{slug}}',                  (d) => d.maps.map((x) => x.slug)),
    commentaries: await probe('commentaries', '{commentary{id}}',              (d) => d.commentary.map((x) => x.id)),
    images:       await probe('images',       '{image{id}}',                   (d) => d.image.map((x) => x.id)),
    texts:        await probe('texts',        '{text{slug}}',                  (d) => d.text.map((x) => x.slug)),
    sections:     await probe('sections',     '{section{slug}}',               (d) => d.section.map((x) => x.slug)),
    publications: await probe('publications', '{publications{source_slug}}',   (d) => d.publications.map((x) => x.source_slug)),
    chiasms:      await probe('chiasms',      '{chiasmus{chiasmus_id}}',       (d) => d.chiasmus.map((x) => x.chiasmus_id)),
    histories:    await probe('histories',    '{history{slug archive principal}}', (d) => d.history.map((x) => x.slug)),
    archives:     await probe('archives',     '{history{slug archive principal}}', (d) => [...new Set(d.history.map((x) => x.archive))]),
    principals:   await probe('principals',   '{history{slug archive principal}}', (d) => [...new Set(d.history.flatMap((x) => x.principal || []))]),
    faxes:        await probe('faxes',        '{fax{slug}}',                   (d) => d.fax.map((x) => x.slug)),
    markdowns:    await probe('markdowns',    '{markdown{slug}}',              (d) => d.markdown.map((x) => x.slug)),
  };

  const missing = REQUIRED.filter((k) => !pools[k]);
  if (missing.length) {
    throw new Error(`Required pools failed to harvest: ${missing.join(', ')} — aborting without writing inputs.json`);
  }

  // shortLink needs a known hash: create one deterministic shortlink and record it.
  const shortlinkData = await gql('mutation shortlink{shortlink(string:"/regression-suite-anchor"){hash}}');
  const shortlinkHash = shortlinkData.shortlink.hash;
  console.log(`✓ shortlink anchor hash: ${shortlinkHash}`);

  // 2 Nephi 12 quotes Isaiah 2 verse-for-verse → aligned verse_pairs.
  const bomIds = lookupReference('2 Nephi 12:1-5').verse_ids;
  const bibleIds = lookupReference('Isaiah 2:1-5').verse_ids;
  const pairs = bomIds.map((id, i) => [id, bibleIds[i]]);

  const p = (pool, n) => spread(pools[pool] || [], n);
  const NEPHI1 = lookupReference('1 Nephi 1:1-5').verse_ids; // stable verse_id anchor

  const matrix = {
    // ---- content suite (anonymous reads, en+ko) ----
    person:     { tier: 'exact', cases: { single: [p('people', 1)[0]], batch: p('people', 4), missing: ['zz-no-such-person'] } },
    personList: { tier: 'exact', cases: { batch: p('people', 4) } },
    places:     { tier: 'exact', cases: { single: [p('places', 1)[0]], batch: p('places', 4), missing: ['zz-no-such-place'] } },
    placeList:  { tier: 'exact', cases: { batch: p('places', 4) } },
    object:     { tier: 'exact', cases: { single: [p('objects', 1)[0]], batch: p('objects', 4), missing: ['zz-no-such-object'] } },
    objectList: { tier: 'exact', cases: { batch: p('objects', 4) } },
    page:       { tier: 'exact', cases: { single: [p('pages', 1)[0]], batch: p('pages', 2) } },
    contents:   { tier: 'exact', cases: { single: [p('divisions', 1)[0]], batch: p('divisions', 2) } },
    divisionShell: { tier: 'exact', cases: { single: [p('divisions', 1)[0]] } },
    markdown:   pools.markdowns ? { tier: 'exact', cases: { single: [p('markdowns', 1)[0]] } } : undefined,
    about:      { tier: 'exact', cases: { all: true } },
    labels:     { tier: 'exact', cases: { all: true } },
    passagenotes:   { tier: 'exact', cases: { single: [NEPHI1[0]], batch: NEPHI1 } },
    passagenotes_0: { tier: 'exact', cases: { batch: NEPHI1 } },
    passagenotes_7: { tier: 'exact', cases: { batch: NEPHI1 } },

    // ---- scripture suite ----
    scripture: { tier: 'exact', cases: { verse: ['1 Nephi 3:7'], range: ['Mosiah 2:17-19'], chapter: ['3 Nephi 11'] } },
    verses:    { tier: 'exact', cases: { single: [NEPHI1[0]], batch: NEPHI1 } },
    read:      { tier: 'exact', cases: { chapter: ['1 Nephi 1'], range: ['Alma 17-18'] } },
    lookup:    { tier: 'exact', cases: { single: ['1 Nephi 1:1'], batch: ['Alma 32:21', 'Ether 12:6'] } },
    versehighlights: { tier: 'exact', cases: { single: [pairs[0]], batch: pairs } },
    chiasmus:  { tier: 'exact', cases: { all: true } },
    chiasm:    { tier: 'exact', cases: { single: [p('chiasms', 1)[0]], batch: p('chiasms', 3) } },

    // ---- media suite ----
    image:      { tier: 'exact', cases: { single: [p('images', 1)[0]], batch: p('images', 3), missing: [99999999] } },
    imageInFeed:    { tier: 'exact', cases: { single: [p('images', 1)[0]] } },
    imageLocations: { tier: 'exact', cases: { batch: p('images', 3) } },
    commentary: { tier: 'exact', cases: { single: [p('commentaries', 1)[0]], batch: p('commentaries', 3), missing: [99999999] } },
    commentaryInFeed:    { tier: 'exact', cases: { single: [p('commentaries', 1)[0]] } },
    commentaryLocations: { tier: 'exact', cases: { batch: p('commentaries', 3) } },
    textInFeed:    { tier: 'exact', cases: { single: [p('texts', 1)[0]] } },
    sectionInFeed: pools.sections ? { tier: 'exact', cases: { single: [p('sections', 1)[0]] } } : undefined,
    fax:      pools.faxes ? { tier: 'exact', cases: { all: true, single: [p('faxes', 1)[0]] } } : undefined,
    faxIndex: pools.faxes ? { tier: 'exact', cases: { single: [p('faxes', 1)[0]] } } : undefined,
    maplist:  { tier: 'exact', cases: { all: true } },
    map:      { tier: 'exact', cases: { single: [p('maps', 1)[0]], batch: p('maps', 2) } },
    mapstories: { tier: 'exact', cases: { single: [p('maps', 1)[0]] } },
    timeline: { tier: 'exact', cases: { all: true } },
    publications: { tier: 'exact', cases: { all: true } },

    // ---- search suite ----
    search:    { tier: 'shape', cases: { word: ['faith'], phrase: ['sword of laban'], noresults: ['zzqxnoresults'] } },
    shortLink: { tier: 'exact', cases: { single: [shortlinkHash], missing: ['zzzzzz'] } },
    setShortLink: { tier: 'exact', langs: ['en'], cases: { fixed: ['/regression-suite-anchor'] } },
    history:   { tier: 'exact', cases: {
      single: [p('histories', 1)[0]],
      archive: [{ archive: p('archives', 1)[0] }],
      principal: [{ principal: p('principals', 1)[0] }],
      missing: ['zz-no-such-history'],
    } },

    // ---- user suite (auth; mutations en-only; reads en+ko) ----
    log:            { tier: 'scrubbed', auth: true, langs: ['en'], cases: { bookmark: [{ token: '{{TOKEN}}', key: 'bookmark', val: p('texts', 1)[0] }] } },
    editProfile:    { tier: 'scrubbed', auth: true, langs: ['en'], cases: { same: [{ token: '{{TOKEN}}', name: '{{NAME}}', email: '{{EMAIL}}', zip: '{{ZIP}}' }] } },
    changePassword: { tier: 'scrubbed', auth: true, langs: ['en'], cases: { same: [{ token: '{{TOKEN}}', password: '{{PASS}}' }] } },
    uploadProfileImage: { tier: 'shape', auth: true, langs: ['en'], cases: { tiny: [{ token: '{{TOKEN}}', imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }] } },
    tokenSignIn:  { tier: 'scrubbed', auth: true, cases: { single: ['{{TOKEN}}'] } },
    signin:       { tier: 'scrubbed', auth: true, langs: ['en'], cases: { valid: [{ username: '{{USER}}', password: '{{PASS}}', token: '{{TOKEN}}' }], badpassword: [{ username: '{{USER}}', password: 'wrong-password', token: '{{TOKEN}}' }] } },
    studylog:        { tier: 'shape', auth: true, cases: { single: ['{{TOKEN}}'] } },
    userdailyscores: { tier: 'shape', auth: true, cases: { single: ['{{TOKEN}}'] } },
    userprogress:    { tier: 'scrubbed', auth: true, cases: { single: ['{{TOKEN}}'] } },
    divisionProgress:        { tier: 'scrubbed', auth: true, cases: { single: [p('divisions', 1)[0]] } },
    divisionProgressDetails: { tier: 'scrubbed', auth: true, cases: { single: [p('divisions', 1)[0]] } },
    pageprogress:     { tier: 'scrubbed', auth: true, cases: { single: [{ token: '{{TOKEN}}', slug: [p('pages', 1)[0]] }] } },
    pageinfoprogress: { tier: 'scrubbed', auth: true, cases: { single: [{ token: '{{TOKEN}}', slug: [p('pages', 1)[0]] }] } },
    readingplan:        { tier: 'exact', auth: true, cases: { unknown: [{ slug: 'zz-no-such-plan', token: '{{TOKEN}}' }] } },
    readingplansegment: { tier: 'exact', auth: true, cases: { unknown: [{ guid: 'zz-no-such-guid', token: '{{TOKEN}}' }] } },
    queue:       { tier: 'scrubbed', auth: true, cases: { noitems: [{ token: '{{TOKEN}}', items: null }], byslug: [{ token: '{{TOKEN}}', items: [{ slug: p('texts', 1)[0] }] }] } },
    queuestatus: { tier: 'scrubbed', auth: true, cases: { noitems: [{ token: '{{TOKEN}}', items: null }] } },
    sourceUsage: pools.publications ? { tier: 'exact', auth: true, langs: ['en'], cases: { single: [{ token: '{{TOKEN}}', source: p('publications', 1)[0] }] } } : undefined,
    signout: { tier: 'scrubbed', auth: true, langs: ['en'], cases: { current: [{ token: '{{TOKEN}}' }] } },
    signup:  { tier: 'scrubbed', auth: true, langs: ['en'], cases: { duplicate: [{ token: '{{TOKEN}}', username: '{{USER}}', password: '{{PASS}}', name: '{{NAME}}', email: '{{EMAIL}}', zip: '{{ZIP}}' }] } },

    // ---- community suite ----
    leaderboard: { tier: 'shape', auth: true, cases: { single: [{ token: '{{TOKEN}}' }] } },
  };

  // Drop entries whose optional pools failed.
  for (const [k, v] of Object.entries(matrix)) if (v === undefined) delete matrix[k];

  const outPath = path.join(__dirname, 'inputs.json');
  fs.writeFileSync(outPath, JSON.stringify({ _warnings: warnings, ...matrix }, null, 2) + '\n');
  console.log(`\nWrote ${outPath} with ${Object.keys(matrix).length} query types.`);
  if (warnings.length) console.warn(`Warnings (omitted/degraded): \n  - ${warnings.join('\n  - ')}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
```

- [ ] **Step 2: Run the harvest against prod**

Run: `npm run test:gql:harvest`
Expected: `✓` lines for all REQUIRED pools, `Wrote .../inputs.json with ~50 query types.` Optional pools (`markdowns`, `faxes`, `sections`, `texts` if huge) may warn — that's acceptable *except* the REQUIRED list, which aborts.

If a probe fails because the unfiltered list form isn't supported (e.g. `{text{slug}}` errors), substitute a pool extracted from an already-working probe (e.g. take text slugs from `{page(slug:"<first page>"){sections{rows{narration{text{slug}}}}}}`) and re-run. Record what you changed in the commit message.

- [ ] **Step 3: Sanity-check inputs.json**

Run: `node -e "const m=require('/home/bom/BookofMormonOnline/tests/matrix/inputs.json'); console.log(Object.keys(m).length, 'types'); console.log(m._warnings); console.log(JSON.stringify(m.person))"`
Expected: ~45-50 types; `person.cases.single` holds a real slug. The `_warnings` key is metadata — `runner.js` only looks up types by name, so it's inert (no type is named `_warnings` in any suite).

- [ ] **Step 4: Commit**

```bash
git add tests/matrix/harvest.mjs tests/matrix/inputs.json
git commit -m "test(gql): add harvest script and committed prod input matrix"
```

---

### Task 9: Suite files

**Files:**
- Create: `tests/suites/content.test.js`, `tests/suites/scripture.test.js`, `tests/suites/media.test.js`, `tests/suites/search.test.js`, `tests/suites/user.test.js`, `tests/suites/community.test.js`

- [ ] **Step 1: Write the six suite files**

Types listed conditionally (`markdown`, `fax`, etc.) are filtered against the matrix so harvest omissions don't crash the suite.

```js
// tests/suites/content.test.js
const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = [
  'person', 'personList', 'places', 'placeList', 'object', 'objectList',
  'page', 'contents', 'divisionShell', 'markdown', 'about', 'labels',
  'passagenotes', 'passagenotes_0', 'passagenotes_7',
];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
```

```js
// tests/suites/scripture.test.js
const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = ['scripture', 'verses', 'read', 'lookup', 'versehighlights', 'chiasmus', 'chiasm'];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
```

```js
// tests/suites/media.test.js
const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = [
  'image', 'imageInFeed', 'imageLocations',
  'commentary', 'commentaryInFeed', 'commentaryLocations',
  'textInFeed', 'sectionInFeed', 'fax', 'faxIndex',
  'maplist', 'map', 'mapstories', 'timeline', 'publications',
];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
```

```js
// tests/suites/search.test.js
const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = ['search', 'shortLink', 'setShortLink', 'history'];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
```

```js
// tests/suites/user.test.js
// ORDER MATTERS (maxWorkers:1 keeps it serial):
// idempotent same-value mutations first so user state reaches its fixed point,
// then state reads, then signout LAST (it invalidates the session token).
const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = [
  'log', 'editProfile', 'changePassword', 'uploadProfileImage',
  'tokenSignIn', 'signin', 'studylog', 'userdailyscores', 'userprogress',
  'divisionProgress', 'divisionProgressDetails', 'pageprogress', 'pageinfoprogress',
  'readingplan', 'readingplansegment', 'queue', 'queuestatus', 'sourceUsage',
  'signout', 'signup',
];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
```

```js
// tests/suites/community.test.js
const { defineSuite, loadMatrix } = require('../harness/runner');

defineSuite(['leaderboard'].filter((t) => loadMatrix()[t]));

// Sendbird was gutted from the backend (BomCommunity.ts shim, MESSENGER_ENABLED=false)
// pending the messaging rip-and-replace. Inventoried but parked — activate after
// the replacement lands. See docs/specs/2026-06-09-graphql-regression-test-suite.md.
const PARKED_SENDBIRD = [
  'loadGroupsFromHash', 'homegroups', 'homefeed', 'homethread',
  'requestedUsers', 'processRequest', 'joinGroup', 'joinOpenGroup',
  'requestToJoinGroup', 'withdrawRequest', 'botlist', 'addBot', 'removeBot',
];

describe('parked', () => {
  for (const type of PARKED_SENDBIRD) test.todo(`PARKED-SENDBIRD: ${type}`);
  test.todo('PARKED-OAUTH: socialsignin (needs a live third-party social token)');
});
```

- [ ] **Step 2: Create the real env file** (needed before any user-suite run)

```bash
cd /home/bom/BookofMormonOnline/tests
cp .env.test.example .env.test
sed -i "s|<generate: openssl rand -hex 12>|$(openssl rand -hex 12)|" .env.test
sed -i "s|<generate: openssl rand -hex 16>|$(openssl rand -hex 16)|" .env.test
git check-ignore -q .env.test && echo "ignored OK" || echo "DANGER: .env.test NOT gitignored"
```

Expected: `ignored OK`. **Stop and fix `.gitignore` if not.**

- [ ] **Step 3: Verify the loud-fail path** — run verify with no baselines

Run: `TARGET=prod npx jest --config tests/jest.config.js tests/suites/content.test.js -t "person.single" 2>&1 | tail -8`
Expected: FAIL with `Missing baseline tests/baselines/en/person/single.json` and the capture instruction. This proves missing baselines can never silently pass.

- [ ] **Step 4: Commit**

```bash
git add tests/suites/
git commit -m "test(gql): add six suites covering full query surface, sendbird cases parked"
```

---

### Task 10: Capture baselines from prod

- [ ] **Step 1: Capture**

Run: `npm run test:gql:capture 2>&1 | tail -30`
Expected: all tests pass (capture mode writes instead of comparing). Duration: several minutes — ~190 cases (≈80 read cases × 2 langs + ~25 en-only auth/mutation cases), serial.

If individual cases fail: a transport error fails the case without writing (correct behavior — rerun); a `Could not sign in or sign up` error means the test user bootstrap hit a validation rule (inspect the response text, adjust `.env.test` values, rerun).

- [ ] **Step 2: Run capture a second time** — proves user-state reached its fixed point and the overwrite guard works

Run: `npm run test:gql:capture 2>&1 | grep -c "baseline exists, skipped" ; npm run test:gql:capture 2>&1 | tail -3`
Expected: every case logs `baseline exists, skipped`; zero baselines change (`git status --short tests/baselines | wc -l` → 0).

- [ ] **Step 3: Inspect baseline sizes**

Run: `du -sh tests/baselines/ && find tests/baselines -size +1M -exec ls -lh {} \;`
Expected: total in the tens of MB at most. If any single file exceeds ~5MB (candidates: `page`, `timeline`, `history.archive`), trim that case's inputs in `harvest.mjs` (smaller batch, drop the case), re-run harvest with `RECAPTURE=1` capture for that type, and note it in the commit.

- [ ] **Step 4: Verify Korean actually differs** — guards against silently capturing English twice

Run: `node -e "const en=require('/home/bom/BookofMormonOnline/tests/baselines/en/verses/single.json'); const ko=require('/home/bom/BookofMormonOnline/tests/baselines/ko/verses/single.json'); console.log(JSON.stringify(en)===JSON.stringify(ko) ? 'IDENTICAL — BUG' : 'translated OK')"`
Expected: `translated OK`

- [ ] **Step 5: Commit**

```bash
git add tests/baselines/
git commit -m "test(gql): capture prod golden baselines (en + ko)"
```

---

### Task 11: Verify against prod (must be green)

- [ ] **Step 1: Full verify run**

Run: `TARGET=prod npm run test:gql 2>&1 | tail -15`
Expected: **100% pass** (plus 14 todo). This is acceptance criterion #2.

- [ ] **Step 2: Triage any failures**

A failure here means a case is *nondeterministic*, not that prod regressed seconds after capture. Fix by moving that query down a tier (exact → scrubbed: add the offending key to `SCRUB_KEYS` if genuinely volatile; scrubbed → shape: change `tier` in `harvest.mjs` AND `inputs.json`), then recapture just that type: `RECAPTURE=1 CAPTURE=1 TARGET=prod npx jest --config tests/jest.config.js -t "<type>."`. Repeat Step 1 until green. Known candidates: `queue` (coms/imgs ordering), `sourceUsage`, `setShortLink` (if hash isn't stable for a repeated string).

- [ ] **Step 3: Commit any tier adjustments**

```bash
git add tests/
git commit -m "test(gql): stabilize volatile cases found in prod verify"
```

---

### Task 12: Verify against dev + document known diffs

- [ ] **Step 1: Run against dev**

Run: `TARGET=dev npm run test:gql 2>&1 | tail -30`
Expected outcomes:
- `[en]` content/scripture/media/search cases: **pass** (dev shares the prod DB).
- `[ko]` cases: **fail** — the `setupProxy.js` mount-path-strip defect returns English. Pre-existing bug, not suite noise.
- auth/user cases: pass in downgraded shape mode (sandbox).
- Anything else that fails: investigate individually — it's either a real prod/dev behavioral difference (the dev branch is ahead) or a case that needs stabilizing.

- [ ] **Step 2: Write the proxy bug report**

Create `docs/bugs/2026-06-09-dev-proxy-strips-language-path.md`:

```markdown
# Dev CRA proxy strips the language path — /ko serves English

**Symptom:** `POST https://bom.kckern.net/ko {query}` returns English content;
`POST http://localhost:5005/ko` (direct backend) correctly returns Korean.
Found while building the GraphQL regression suite (every `[ko]` case fails on TARGET=dev).

**Root cause:** `frontend/webapp/src/setupProxy.js` mounts http-proxy-middleware with
`app.use(['/en','/es',...,'/ko',...], createProxyMiddleware({target}))`. Express strips the
mount path before the middleware sees the request, so the proxied request hits the backend
as `/` and the backend's language detection falls back to English.

**Fix sketch:** mount at root with a path filter instead, or restore the prefix via
`pathRewrite`/`(path, req) => req.originalUrl`, so the backend receives `/ko/...`.

**Regression test:** `TARGET=dev npm run test:gql` — all `[ko]` cases. They must pass
once this is fixed.

**Status:** open; fix is out of scope for the regression-suite task.
```

- [ ] **Step 3: Document any further prod/dev diffs found in Step 1**

For each: a short entry in the same style in `docs/bugs/` (one file per distinct root cause, dated 2026-06-09). If a diff is *expected* (dev branch ahead of prod deploy), note it in `tests/README.md` under "Known diffs" instead.

- [ ] **Step 4: Commit**

```bash
git add docs/bugs/ tests/README.md 2>/dev/null
git commit -m "docs(bugs): document dev /ko proxy defect + prod/dev known-diffs from regression run"
```

---

### Task 13: Tamper smoke check (acceptance criterion #5)

- [ ] **Step 1: Corrupt one baseline field**

```bash
cd /home/bom/BookofMormonOnline
sed -i 's/"verse_id": 31103/"verse_id": 99999/' tests/baselines/en/verses/single.json
```

- [ ] **Step 2: Verify the failure names query, case, and field path**

Run: `TARGET=prod npx jest --config tests/jest.config.js -t "verses.single" 2>&1 | grep -A8 "verses.single \[en\]"`
Expected: FAIL on `verses.single [en]` only, with Jest's diff showing the `verse_id` path (`- 99999` / `+ 31103`). `verses.single [ko]` still passes.

- [ ] **Step 3: Restore**

```bash
git checkout tests/baselines/en/verses/single.json
TARGET=prod npx jest --config tests/jest.config.js -t "verses.single" 2>&1 | tail -3
```

Expected: PASS. Nothing to commit.

---

### Task 14: README + wrap-up

**Files:**
- Create: `tests/README.md`
- Modify: `docs/specs/2026-06-09-graphql-regression-test-suite.md` (status line)

- [ ] **Step 1: Write the README**

```markdown
# GraphQL Regression Suite

Golden-snapshot regression tests for the full `GraphQLQueries.js` surface, captured from
prod. Safety net for the resolver overhaul: the refactored backend must produce identical
responses. Spec: `docs/specs/2026-06-09-graphql-regression-test-suite.md`.

## Setup (once)

    cp tests/.env.test.example tests/.env.test   # fill in; NEVER commit (public repo)

## Daily use

| Command | What it does |
|---|---|
| `TARGET=prod npm run test:gql` | verify prod against baselines (should always pass) |
| `TARGET=dev npm run test:gql` | verify dev; see Known diffs below |
| `TARGET=local npm run test:gql` | verify a local backend (`npm run dev:backend`) |
| `npm run test:gql:capture` | (re)capture baselines from prod; existing files skipped |
| `RECAPTURE=1 npm run test:gql:capture` | force-overwrite baselines — only after intentional content/contract changes |
| `npm run test:gql:harvest` | regenerate the input matrix from prod (then recapture) |

Scope a run: `TARGET=prod npx jest --config tests/jest.config.js -t "person."`

## How it works

Queries are built by the real frontend module (`prepareQueries`), POSTed to
`{target}/{en|ko}` exactly like `BoMOnlineAPI.js`, normalized by per-query volatility
tier (`exact` | `scrubbed` | `shape` — declared in `tests/matrix/inputs.json`), and
compared to `tests/baselines/<lang>/<type>/<case>.json`.

- Mutations run against the dedicated test user only, idempotently (same values each run).
- On sandbox targets (dev/local) auth'd queries auto-downgrade to shape comparison —
  sandboxMode swallows writes there.
- Capture only runs against prod (baselines are prod truth).

## Known diffs

- **dev `/ko` returns English** — setupProxy.js strips the language mount path.
  See `docs/bugs/2026-06-09-dev-proxy-strips-language-path.md`. All `[ko]` cases fail
  on `TARGET=dev` until fixed.

## Parked

Sendbird-dependent queries (`joinGroup`, `homefeed`, `homegroups`, `botlist`, …13 total)
are `test.todo` entries in `tests/suites/community.test.js` pending the messaging
rip-and-replace. `socialsignin` is parked on third-party OAuth.
```

- [ ] **Step 2: Mark the spec implemented**

In `docs/specs/2026-06-09-graphql-regression-test-suite.md`, change
`**Status:** Approved design, pre-implementation` to
`**Status:** Implemented 2026-06-09 — see tests/README.md`.

- [ ] **Step 3: Full final run**

Run: `TARGET=prod npm run test:gql 2>&1 | tail -5`
Expected: all pass, 14 todo.

- [ ] **Step 4: Commit**

```bash
git add tests/README.md docs/specs/2026-06-09-graphql-regression-test-suite.md
git commit -m "test(gql): add suite README; mark spec implemented"
```

---

## Execution notes

- **Network dependency:** Tasks 8-14 hit live prod. Transient failures → rerun the step; the client already retries once.
- **Prod writes are limited to:** the test user's own rows (signup/log/editProfile/changePassword/uploadProfileImage/signin sessions) and one deterministic shortlink (`/regression-suite-anchor`). Nothing else writes.
- **Do not** restart `bom-dev` for any of this; the suite is read-only with respect to services.
- If `prepareQueries`'s import chain ever gains a browser-API top-level statement, Task 1's smoke test is the canary.
