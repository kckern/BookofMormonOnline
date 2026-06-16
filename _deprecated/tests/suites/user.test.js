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
