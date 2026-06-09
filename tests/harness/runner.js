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
