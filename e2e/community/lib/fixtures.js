/**
 * Shared Playwright fixtures for the community E2E suite.
 *
 * - `authedPage`: a page already logged in as the regression account via the
 *   REAL SignIn form (no token injection). Use for every flow that needs auth.
 * - `created`: a per-test registry of artifacts to delete in teardown. Push
 *   `{ channelUrl }` for a created group or `{ messageId }` for a posted message;
 *   the afterEach hook deletes them (marker-gated) so every test leaves no trace.
 */
const base = require('@playwright/test').test;
const { expect } = require('@playwright/test');
const cfg = require('./config');
const { signIn } = require('./auth');
const cleanup = require('./cleanup');

const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  created: async ({}, use) => {
    const reg = { channelUrls: [], messageIds: [] };
    await use(reg);
    // Teardown: delete this test's artifacts (each delete is marker-gated).
    for (const url of reg.channelUrls) {
      try { await cleanup.deleteGroupCascade(url); } catch (e) { console.error('[teardown] group', url, e.message); }
    }
    if (reg.messageIds.length) {
      try { await cleanup.deleteMessagesByIds(reg.messageIds); } catch (e) { console.error('[teardown] messages', e.message); }
    }
  },

  authedPage: async ({ page }, use) => {
    await signIn(page);
    await use(page);
  },
});

module.exports = { test, expect, cfg, cleanup };
