// App-wide a11y inventory: inject axe-core, run across main routes, aggregate
// violations by rule and by element/source. Logs JSON to stdout.
const { run } = require('./driver');
const path = require('path');
const fs = require('fs');

const AXE_PATH = path.resolve(__dirname, '../../frontend/webapp/node_modules/axe-core/axe.min.js');

const ROUTES = (process.env.A11Y_ROUTES || '/,/study,/contents,/lehites/1,/home,/people,/places,/search')
  .split(',').map(s => s.trim()).filter(Boolean);

async function injectAxe(page) {
  if (fs.existsSync(AXE_PATH)) {
    await page.addScriptTag({ path: AXE_PATH });
  } else {
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  }
  await page.waitForFunction(() => !!window.axe, null, { timeout: 10000 });
}

async function runAxe(page) {
  return await page.evaluate(async () => {
    const res = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
    return res.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map(n => ({ target: n.target, html: (n.html || '').slice(0, 200) })),
    }));
  });
}

run(async ({ page, baseUrl }) => {
  const byRoute = {};
  const byRule = {};
  const ruleSamples = {};

  for (const route of ROUTES) {
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(6000);
      await injectAxe(page);
      const violations = await runAxe(page);
      const routeCounts = {};
      let total = 0;
      for (const v of violations) {
        const n = v.nodes.length;
        total += n;
        routeCounts[v.id] = (routeCounts[v.id] || 0) + n;
        byRule[v.id] = (byRule[v.id] || 0) + n;
        if (!ruleSamples[v.id]) ruleSamples[v.id] = [];
        for (const node of v.nodes) {
          if (ruleSamples[v.id].length < 12) ruleSamples[v.id].push(node.html);
        }
      }
      byRoute[route] = { total, counts: routeCounts };
      console.log(`[axe] ${route} total=${total} ${JSON.stringify(routeCounts)}`);
    } catch (e) {
      byRoute[route] = { error: e.message };
      console.log(`[axe] ${route} ERROR ${e.message}`);
    }
  }

  console.log('\n[axe-by-rule] ' + JSON.stringify(byRule, null, 2));
  console.log('\n[axe-samples] ' + JSON.stringify(ruleSamples, null, 2));
  const grand = Object.values(byRule).reduce((a, b) => a + b, 0);
  console.log('\n[axe-grand-total] ' + grand);

  const out = process.env.A11Y_OUT || '/tmp/a11y_result.json';
  fs.writeFileSync(out, JSON.stringify({ byRoute, byRule, ruleSamples, grand }, null, 2));
  console.log('[axe] wrote ' + out);
});
