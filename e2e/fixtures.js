const { test: base, expect } = require("@playwright/test");

const test = base.extend({
  instrumentedPage: async ({ page }, use) => {
    await page.addInitScript(() => { window.__deepLinkInstrument = true; });
    await use(page);
  },
});

async function getEvents(page) {
  return page.evaluate(() => window.__deepLinkEvents || []);
}

async function waitForEvent(page, name, timeout = 15_000) {
  return page.waitForFunction(
    (n) => (window.__deepLinkEvents || []).some(e => e.name === n),
    name,
    { timeout },
  );
}

module.exports = { test, expect, getEvents, waitForEvent };
