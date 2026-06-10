const fs = require('fs');
const path = require('path');
const { prepareQueries } = require('../../frontend/webapp/src/models/GraphQLQueries');
const { postQuery } = require('./client');
const { getTarget, urlFor, TARGETS } = require('./targets');
const { normalize, shapeOf, shapesCompatible } = require('./normalize');
const { saveBaseline, loadBaseline } = require('./baseline');
const { ensureSignedIn, creds } = require('./auth');

const MATRIX_PATH = path.resolve(__dirname, '..', 'matrix', 'inputs.json');
const CAPTURE = process.env.CAPTURE === '1';

// The backend keeps a process-global scripture-guide language that leaks across
// requests (see docs/bugs/2026-06-09-scripture-guide-global-lang-leak.md). Prime
// the target to this case's language right before each request so captures and
// verifies see steady-state per-language behavior.
const PRIMER_QUERY = 'scripture (ref: "1 Nephi 1:1"){ ref }';

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

    if (def.prodStale && def.auth) {
      throw new Error(`Type "${type}" is both prodStale and auth — token binding would target the wrong host; split the policy before running.`);
    }

    describe(type, () => {
      let token = null;
      if (def.auth) {
        beforeAll(async () => {
          token = await ensureSignedIn(target);
        });
      }

      // prodStale: prod's deployed schema predates this query surface, so prod can
      // neither produce baselines for it nor be verified against it. Capture pulls
      // from the local backend (current code, same DB); prod verify skips visibly.
      const captureTarget = CAPTURE && def.prodStale ? { name: 'local', ...TARGETS.local } : target;
      const skipOnProd = !CAPTURE && def.prodStale && target.name === 'prod';
      // sandboxSkip: sandbox targets mangle this type's response structurally
      // (writes swallowed + Apollo null-stripping, or dev code ahead of the prod
      // deployment), so even shape comparison is meaningless there.
      const skipOnSandbox = !CAPTURE && def.sandboxSkip && target.sandbox;
      const skipReason = skipOnProd ? ' (skipped: prod schema stale)'
        : skipOnSandbox ? ' (skipped: sandbox target mangles response)' : '';

      for (const lang of def.langs || ['en', 'ko']) {
        for (const [caseName, rawInput] of Object.entries(def.cases)) {
          const testFn = skipOnProd || skipOnSandbox ? test.skip : test;
          testFn(`${type}.${caseName} [${lang}]${skipReason}`, async () => {
            const c = def.auth ? creds() : {};
            const input = fillPlaceholders(rawInput, {
              TOKEN: token, USER: c.username, PASS: c.password,
              NAME: c.name, EMAIL: c.email, ZIP: c.zip,
            });
            const query = buildQuery(type, input, token);
            await postQuery(urlFor(captureTarget, lang), PRIMER_QUERY);
            const body = await postQuery(urlFor(captureTarget, lang), query);
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
