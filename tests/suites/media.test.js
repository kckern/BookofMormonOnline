const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = [
  'image', 'imageInFeed', 'imageLocations',
  'commentary', 'commentaryInFeed', 'commentaryLocations',
  'textInFeed', 'sectionInFeed', 'fax', 'faxIndex',
  'maplist', 'map', 'mapstories', 'timeline', 'publications',
];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
