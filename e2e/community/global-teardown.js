/**
 * Global teardown — final leave-no-trace guarantee. Sweeps any MARKER-tagged
 * artifact that slipped past a per-test teardown (e.g. a test that crashed before
 * registering what it created), then asserts nothing marked remains.
 */
const cleanup = require('./lib/cleanup');

module.exports = async () => {
  const swept = await cleanup.sweepAllMarked();
  if (swept.groups || swept.messages) console.log(`[global-teardown] swept residual markers: ${JSON.stringify(swept)}`);
  const left = await cleanup.countMarked();
  await cleanup.close();
  if (left.groups || left.messages) {
    throw new Error(`[global-teardown] LEFT A TRACE: ${left.groups} groups + ${left.messages} messages still carry the marker`);
  }
  console.log('[global-teardown] clean — no marked artifacts remain.');
};
