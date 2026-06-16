const { defineSuite, loadMatrix } = require('../harness/runner');

const TYPES = ['scripture', 'verses', 'read', 'lookup', 'versehighlights', 'chiasmus', 'chiasm'];

defineSuite(TYPES.filter((t) => loadMatrix()[t]));
