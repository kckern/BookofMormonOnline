const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = ['search', 'shortLink', 'setShortLink', 'history'];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
