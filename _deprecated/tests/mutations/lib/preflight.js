/**
 * Preflight guards — refuse to run the write suite unless we're intentionally
 * pointed at bom_prd with sandbox off and an explicit opt-in. Prevents an
 * accidental CI run from writing to production.
 */
const { db, sandbox, operatorToken } = require('./config');

function assertProdWriteGuards() {
  const problems = [];
  if (process.env.ALLOW_PROD_WRITES !== '1') {
    problems.push('ALLOW_PROD_WRITES must be "1" (explicit opt-in to write to prod)');
  }
  if (db.database !== 'bom_prd') {
    problems.push(`MYSQL_DB is "${db.database}", expected "bom_prd"`);
  }
  if (String(sandbox) === '1') {
    problems.push('SANDBOX=1 in backend/.env — writes would be suppressed; set SANDBOX=0');
  }
  if (!operatorToken) {
    problems.push('operator token missing (STAFF_TOKEN / MESSENGER_TEST_TOKEN)');
  }
  if (problems.length) {
    throw new Error('mutation suite preflight failed:\n  - ' + problems.join('\n  - '));
  }
}

module.exports = { assertProdWriteGuards };
