// scripts/timeline-grid/screenshot.js
// Usage: node scripts/timeline-grid/screenshot.js [--url http://localhost:8200/timeline] [--out /tmp/tl-verify]
// Captures: full tall canvas, three 2x detail strips, zoomed gutter.
//
// Playwright is a heavy dev-only dep (~200MB + a browser download) so it is NOT
// pinned in package.json. Install it wherever convenient and this resolver finds
// it: `cd frontend/webapp && npm i -D playwright && npx playwright install chromium`,
// or a global `npm i -g playwright`, or point PLAYWRIGHT_MODULE at an install.
const path = require('path')
function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright', // normal node resolution (repo root, or a global link)
    path.join(__dirname, '../../frontend/webapp/node_modules/playwright'),
    path.join(__dirname, '../../node_modules/playwright'),
  ].filter(Boolean)
  for (const c of candidates) {
    try { return require(c) } catch (e) { /* try next */ }
  }
  console.error(
    'ERROR: playwright not found. Install it, e.g.:\n' +
    '  cd frontend/webapp && npm i -D playwright && npx playwright install chromium\n' +
    '  (or set PLAYWRIGHT_MODULE=/path/to/node_modules/playwright)'
  )
  process.exit(1)
}
const { chromium } = loadPlaywright()
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null)).filter(Boolean)
)
const URL = args.url || 'http://localhost:8200/timeline'
const OUT = args.out || '/tmp/tl-verify'
;(async () => {
  require('fs').mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const tall = await browser.newPage({ viewport: { width: 1600, height: 3000 } })
  await tall.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  await tall.waitForTimeout(5000)
  await tall.screenshot({ path: `${OUT}/full.png` })
  await tall.close()
  const d = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })
  await d.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  await d.waitForTimeout(5000)
  const sc = await d.$('.timeline-grid-scroller')
  if (!sc) { console.error('ERROR: .timeline-grid-scroller not found — is the app running at ' + URL + '?'); await browser.close(); process.exit(1) }
  for (const [name, frac] of [['strip1', 0], ['strip2', 0.5], ['strip3', 1]]) {
    await sc.evaluate((el, f) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * f }, frac)
    await d.waitForTimeout(400)
    await d.screenshot({ path: `${OUT}/${name}.png`, clip: await sc.boundingBox() })
  }
  const zin = await d.$('.tg-zoom button[aria-label="Zoom in"]')
  if (zin) { await zin.click(); await zin.click(); await zin.click(); await d.waitForTimeout(600) }
  await sc.evaluate((el) => { el.scrollTop = el.scrollHeight * 0.4; el.scrollLeft = 350 })
  await d.waitForTimeout(400)
  await d.screenshot({ path: `${OUT}/zoom-gutter.png`, clip: await sc.boundingBox() })
  await d.close()
  await browser.close()
  console.log('screenshots →', OUT)
})()
