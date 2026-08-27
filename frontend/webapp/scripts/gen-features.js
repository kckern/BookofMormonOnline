/* Compiles config/features.yml -> src/config/features.generated.json at build
 * time (wired to package.json prestart/prebuild). Writes only when the output
 * content changes, so it never churns webpack's watch tree on `npm start`. */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'config', 'features.yml');
const OUT = path.join(ROOT, 'src', 'config', 'features.generated.json');

const parsed = yaml.load(fs.readFileSync(SRC, 'utf8')) || {};
const json = JSON.stringify(parsed, null, 2) + '\n';

const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (current === json) {
  console.log('[gen-features] up to date');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  console.log(`[gen-features] wrote ${path.relative(ROOT, OUT)}`);
}
