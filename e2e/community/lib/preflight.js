/**
 * Preflight guards — refuse to run the write-capable community E2E unless we are
 * intentionally pointed at bom_prd with sandbox OFF and an explicit opt-in. This
 * prevents an accidental run from writing to production, and fails loudly if the
 * backend is still read-only (in which case UI writes silently wouldn't persist).
 */
const cfg = require('./config');

function assertProdWriteGuards() {
  const problems = [];
  if (process.env.ALLOW_PROD_WRITES !== '1') {
    problems.push('ALLOW_PROD_WRITES must be "1" (explicit opt-in to write to prod)');
  }
  if (cfg.db.database !== 'bom_prd') {
    problems.push(`backend/.env MYSQL_DB is "${cfg.db.database}", expected "bom_prd"`);
  }
  if (String(cfg.sandbox) === '1') {
    problems.push('SANDBOX=1 in backend/.env — UI writes would be suppressed; set SANDBOX=0 + restart bom-greenfield');
  }
  if (!cfg.db.user || !cfg.db.password) {
    problems.push('backend/.env lacks RW MYSQL creds (teardown needs them)');
  }
  if (!cfg.username || !cfg.password) {
    problems.push('regression creds missing (tests/.env.test TEST_USERNAME/TEST_PASSWORD)');
  }
  if (problems.length) {
    throw new Error('community E2E preflight failed:\n  - ' + problems.join('\n  - '));
  }
}

module.exports = { assertProdWriteGuards };
