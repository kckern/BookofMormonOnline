/**
 * postbuild: stamp a unique cache version into build/sw.js.
 *
 * public/sw.js ships the literal placeholder `{{BUILD_VERSION}}`. CRA copies it
 * to build/ verbatim (no templating), so without this step every deploy reuses
 * the same service-worker cache name and the activate handler never evicts the
 * previous deploy's cache — which let a stale (SSR) app-shell persist forever.
 *
 * We replace the placeholder with a value that is unique per build: the CI
 * commit SHA when available, otherwise a build timestamp. Either way, each
 * deploy yields a new cache name, so `activate` deletes the old cache.
 */
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'build', 'sw.js');
if (!fs.existsSync(swPath)) {
  console.warn('[stamp-sw-version] build/sw.js not found — skipping (nothing to stamp).');
  process.exit(0);
}

const raw = (process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || '').trim();
const version = (raw ? raw.slice(0, 12) : String(Date.now())).replace(/[^A-Za-z0-9._-]/g, '');

const sw = fs.readFileSync(swPath, 'utf8');
if (sw.indexOf('{{BUILD_VERSION}}') === -1) {
  console.warn('[stamp-sw-version] no {{BUILD_VERSION}} placeholder in build/sw.js — nothing to replace.');
  process.exit(0);
}
fs.writeFileSync(swPath, sw.split('{{BUILD_VERSION}}').join(version));
console.log('[stamp-sw-version] build/sw.js cache version =', version);
