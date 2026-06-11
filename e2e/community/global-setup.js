/**
 * Global setup for the community E2E suite.
 *  1. Enforce the prod-write guards (ALLOW_PROD_WRITES=1, SANDBOX=0, bom_prd).
 *  2. Sweep any stale MARKER-tagged artifacts left by a previous crashed run, so
 *     the suite starts from a clean slate and leave-no-trace assertions hold.
 */
const { assertProdWriteGuards } = require('./lib/preflight');
const cleanup = require('./lib/cleanup');

module.exports = async () => {
  assertProdWriteGuards();
  const before = await cleanup.countMarked();
  if (before.groups || before.messages) {
    const swept = await cleanup.sweepAllMarked();
    console.log(`[global-setup] swept stale markers: ${JSON.stringify(swept)}`);
  }
  await cleanup.close();
  console.log('[global-setup] preflight OK, starting clean.');
};
