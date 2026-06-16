const fs = require('fs');
const path = require('path');

const BASELINE_DIR = path.resolve(__dirname, '..', 'baselines');

function baselinePath(lang, type, caseName, dir) {
  return path.join(dir, lang, type, `${caseName}.json`);
}

function saveBaseline(lang, type, caseName, body, { dir = BASELINE_DIR } = {}) {
  const file = baselinePath(lang, type, caseName, dir);
  if (fs.existsSync(file) && process.env.RECAPTURE !== '1') {
    return { written: false, file };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
  return { written: true, file };
}

function loadBaseline(lang, type, caseName, { dir = BASELINE_DIR } = {}) {
  const file = baselinePath(lang, type, caseName, dir);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing baseline ${path.relative(process.cwd(), file)}.\n` +
      'Capture baselines from prod first: npm run test:gql:capture'
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { saveBaseline, loadBaseline, BASELINE_DIR };
