const TARGETS = {
  prod:  { base: 'https://bookofmormon.online', sandbox: false },
  dev:   { base: 'https://bom.kckern.net',      sandbox: true },
  local: { base: 'http://localhost:5005',       sandbox: true },
  next:  { base: process.env.NEXT_BASE || 'http://localhost:5006', sandbox: true }, // green-field /backend
};

function getTarget() {
  const name = process.env.TARGET || 'dev';
  const target = TARGETS[name];
  if (!target) {
    throw new Error(`Unknown TARGET "${name}". Use one of: ${Object.keys(TARGETS).join(', ')}`);
  }
  return { name, ...target };
}

// The backend resolves language from the URL path: POST {base}/{lang}
function urlFor(target, lang) {
  return `${target.base}/${lang}`;
}

module.exports = { getTarget, urlFor, TARGETS };
