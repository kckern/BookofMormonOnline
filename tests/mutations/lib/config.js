/**
 * Mutation/WebSocket test-suite config.
 *
 * SAFETY: this suite WRITES to bom_prd. Tokens are sourced from the environment /
 * gitignored tests/.env.test — never hardcoded (the repo is public). RW DB creds
 * are read from backend/.env (the same creds the backend runs on).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Parse a simple KEY=VALUE / KEY="VALUE" env file into an object. */
function parseEnvFile(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const backendEnv = parseEnvFile(path.join(REPO_ROOT, 'backend/.env'));
const dotTestEnv = parseEnvFile(path.join(REPO_ROOT, 'tests/.env.test'));

/** md5 — bom_user.user → messenger_users.user_id (and socket handshake userId). */
const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

const config = {
  REPO_ROOT,
  // Every test-created channel carries this marker in its name AND custom_type-adjacent
  // metadata so teardown can positively identify test channels (defense in depth).
  MARKER: '__wftest__',
  // A per-run id; pass via WFTEST_RUN_ID so a re-run can target the same namespace if needed.
  runId: process.env.WFTEST_RUN_ID || String(Math.floor(Date.now() / 1000)),

  baseUrl: process.env.WFTEST_BASE_URL || 'http://localhost:5006',
  langPath: '/en',
  socketUrl: process.env.WFTEST_SOCKET_URL || 'http://localhost:5006',
  socketPath: '/messenger',

  // Operator = Staff (owner-authorized), member = regression throwaway.
  operatorToken: process.env.STAFF_TOKEN || process.env.MESSENGER_TEST_TOKEN || '',
  memberToken: process.env.MEMBER_TOKEN || dotTestEnv.TEST_SESSION_TOKEN || '',

  // RW DB creds for the guarded teardown (same as the backend's runtime creds).
  db: {
    host: backendEnv.MYSQL_HOST || process.env.MYSQL_HOST,
    port: Number(backendEnv.MYSQL_PORT || process.env.MYSQL_PORT || 3306),
    user: backendEnv.MYSQL_USER || process.env.MYSQL_USER,
    password: backendEnv.MYSQL_PASSWORD || process.env.MYSQL_PASSWORD,
    database: backendEnv.MYSQL_DB || process.env.MYSQL_DB,
  },
  sandbox: backendEnv.SANDBOX ?? process.env.SANDBOX,

  md5,
};

module.exports = config;
