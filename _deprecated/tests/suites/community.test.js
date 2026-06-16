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
