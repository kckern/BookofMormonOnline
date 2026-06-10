const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = [
  'person', 'personList', 'places', 'placeList', 'object', 'objectList',
  'page', 'contents', 'divisionShell', 'markdown', 'about', 'labels',
  'passagenotes', 'passagenotes_0', 'passagenotes_7',
];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
