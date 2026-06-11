/**
 * Community E2E config.
 *
 * SAFETY: these specs drive the real UI against the green-field backend (:5006),
 * which writes to bom_prd. We log in as the regression account (gitignored
 * tests/.env.test) and every artifact we create carries MARKER in its
 * name/text so the guarded teardown can positively identify + delete it.
 *
 * Nothing here is hardcoded — creds come from tests/.env.test, RW DB creds from
 * backend/.env (the same creds the backend runs on). The repo is public.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Parse a simple KEY=VALUE / KEY="VALUE" env file. */
function parseEnvFile(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const backendEnv = parseEnvFile(path.join(REPO_ROOT, 'backend/.env'));
const dotTest = parseEnvFile(path.join(REPO_ROOT, 'tests/.env.test'));

const config = {
  REPO_ROOT,
  // NOTE: must be a host where the messenger feature flag is ON (featureFlags.js
  // isMessengerEnabled matches subdomain localhost/bom/staging). The IP
  // 10.0.0.10 does NOT match → study-mode/community would render "Coming Soon".
  // localhost:8200 is the same dev server (and the CLAUDE.md-recommended URL,
  // bypassing Cloudflare edge cache).
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:8200',
  // Green-field backend (GraphQL), for fast API-based test setup.
  apiUrl: process.env.E2E_API_URL || 'http://localhost:5006/en',

  // Every test-created group/message carries this marker so teardown can find it.
  MARKER: '__e2e__',
  // Per-run namespace (so concurrent/re-runs don't collide); seconds since epoch.
  runId: process.env.E2E_RUN_ID || String(Math.floor(Date.now() / 1000)),

  // Login: the regression account, via the real SignIn form.
  username: process.env.E2E_USERNAME || dotTest.TEST_USERNAME || '',
  password: process.env.E2E_PASSWORD || dotTest.TEST_PASSWORD || '',
  sessionToken: process.env.E2E_TOKEN || dotTest.TEST_SESSION_TOKEN || '',
  // Display name the app shows for the account (for "not Guest" assertions).
  displayName: process.env.E2E_NAME || dotTest.TEST_NAME || '',

  // RW DB creds for guarded teardown (same as the backend runtime creds).
  db: {
    host: backendEnv.MYSQL_HOST || process.env.MYSQL_HOST,
    port: Number(backendEnv.MYSQL_PORT || process.env.MYSQL_PORT || 3306),
    user: backendEnv.MYSQL_USER || process.env.MYSQL_USER,
    password: backendEnv.MYSQL_PASSWORD || process.env.MYSQL_PASSWORD,
    database: backendEnv.MYSQL_DB || process.env.MYSQL_DB,
  },
  sandbox: backendEnv.SANDBOX ?? process.env.SANDBOX,
};

/** A unique, marker-tagged label for a created artifact (e.g. a group name). */
config.tag = (kind) => `${config.MARKER} ${kind} ${config.runId}-${Math.floor(Math.random() * 1e4)}`;

module.exports = config;
