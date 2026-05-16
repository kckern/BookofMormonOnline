const fs = require("fs");
const path = require("path");
const { test: base, expect } = require("@playwright/test");

const localPath = path.resolve(__dirname, "local-fixtures.json");
const defaultPath = path.resolve(__dirname, "fixtures.json");
const fixtureSource = fs.existsSync(localPath) ? localPath : defaultPath;
const fixtures = JSON.parse(fs.readFileSync(fixtureSource, "utf8"));

function getFixture(key) {
  const envName = "E2E_" + key.replace(/([A-Z])/g, "_$1").toUpperCase();
  return process.env[envName] || fixtures[key] || "REPLACE_ME";
}

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

module.exports = { test, expect, getEvents, waitForEvent, getFixture };
