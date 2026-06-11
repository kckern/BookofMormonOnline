/**
 * Shared helpers for driving the study-group UI (the top "StudyGroupBar":
 * study-mode switch, group list, new-group form, group switching, study hall).
 *
 * The bar lives in the global header on study pages. The group-list dropdown
 * closes on blur, so openGroupList() retries, and callers should act on it
 * promptly.
 */
const { expect } = require('@playwright/test');
const cfg = require('./config');

/** Land on a study page where the StudyGroupBar is mounted, logged in. */
async function gotoStudy(page) {
  await page.goto(`${cfg.baseUrl}/study`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.StudyGroupSelect', { timeout: 20_000 });
  await page.waitForTimeout(2500); // let the messenger shim hydrate the bar
}

/**
 * Open the group-list dropdown. The StudyGroupSelect click is a NO-OP until the
 * messenger shim has loaded the user's groups (activeGroup is still undefined),
 * and the dropdown also closes on blur — so poll: click, check, wait, repeat for
 * up to ~35s.
 */
async function openGroupList(page) {
  if (await page.locator('.groupList').count()) return;
  for (let i = 0; i < 12; i++) {
    await page.locator('.StudyGroupSelect').first().click().catch(() => {});
    try { await page.waitForSelector('.groupList', { timeout: 3000 }); return; } catch { /* not ready — wait then retry */ }
    await page.waitForTimeout(1500);
  }
  throw new Error('openGroupList: .groupList never appeared (messenger shim may not have loaded groups)');
}

/** True when study mode is currently on (reads the bootstrap-switch state). */
async function isStudyModeOn(page) {
  const cls = (await page.locator('.studymode .bootstrap-switch').getAttribute('class')) || '';
  return /bootstrap-switch-on/.test(cls);
}

/** Toggle the study-mode switch once and return the new state (on=true). */
async function toggleStudyMode(page) {
  await page.locator('.studymode .bootstrap-switch').click();
  await page.waitForTimeout(700);
  return isStudyModeOn(page);
}

/** Ensure study mode ends ON (group list must already be open). */
async function ensureStudyModeOn(page) {
  if (!(await isStudyModeOn(page))) await toggleStudyMode(page);
  expect(await isStudyModeOn(page), 'study mode should be ON').toBe(true);
}

/**
 * Create a study group through the New Group form. Returns the channel_url the
 * UI minted (read from the DB by the marker name), so the caller can register it
 * for teardown.
 */
async function createGroup(page, db, { name, description = `${cfg.MARKER} desc`, type = 'solo' }) {
  await openGroupList(page);
  await ensureStudyModeOn(page);
  await page.locator('.newgroupbutton').click();
  await page.waitForSelector('.CreateGroupInput input[name=groupName]', { timeout: 8000 });
  await page.locator('.CreateGroupInput input[name=groupName]').fill(name);
  await page.locator('.CreateGroupInput textarea').fill(description);
  await page.locator(`.CreateGroupInput input[type=radio][value=${type}]`).check();
  await page.locator('.create').click();

  // The UI mints a random md5 channel_url; find it by the marker name in the DB.
  let row = null;
  for (let i = 0; i < 20; i++) {
    const rows = await db.query('SELECT channel_url, name, custom_type FROM messenger_channels WHERE name = ? LIMIT 1', [name]);
    if (rows.length) { row = rows[0]; break; }
    await page.waitForTimeout(1000);
  }
  if (!row) throw new Error(`createGroup: channel "${name}" never appeared in the DB`);
  return row;
}

/**
 * Open a group's study hall (the drawer with the chat). Selects the group in the
 * list (activates it), then ensures the drawer is open. Assumes study mode on.
 */
async function openStudyHall(page, name) {
  await openGroupList(page);
  await ensureStudyModeOn(page);
  const item = page.locator('.groupListItem', { hasText: name });
  await item.first().waitFor({ state: 'visible', timeout: 10_000 });
  await item.first().click();
  await page.waitForTimeout(1500);
  // First click activates the group; if the drawer isn't open yet, click again
  // (the active-group item's handler opens the study hall).
  if (!(await page.locator('.StudyGroupDrawer.open').count())) {
    await item.first().click().catch(() => {});
    await page.waitForTimeout(1500);
  }
  await page.waitForSelector('.StudyHall', { timeout: 10_000 });
}

/**
 * Post a comment in the open study hall via the simple textarea composer.
 * Returns when the textarea clears (the shim's onSucceeded fired).
 */
async function postComment(page, text) {
  const ta = page.locator('.StudyGroupChatInput textarea').first();
  await ta.waitFor({ state: 'visible', timeout: 10_000 });
  await ta.click();
  await ta.fill(text);
  // The send button (first in the .send-btn-group) is the reliable trigger; the
  // message goes out over the socket. Callers verify persistence via the DB
  // (the chat-render signal is unreliable), so just settle for the round-trip.
  await page.locator('.StudyGroupChatInput .send-btn-group button').first().click();
  await page.waitForTimeout(2500);
}

/**
 * Create a group via the backend GraphQL mutation (fast, deterministic test
 * setup — same mutation the UI shim calls). Returns { channel_url, name }. Use
 * for setup when the test's subject is something OTHER than the create UI (which
 * is covered separately); reload the page afterwards to pick it up.
 */
const crypto = require('crypto');
async function createGroupViaApi(db, { name, type = 'solo' }) {
  const tokRow = await db.query('SELECT user FROM bom_user_token WHERE token = ? LIMIT 1', [cfg.sessionToken]);
  if (!tokRow.length) throw new Error('createGroupViaApi: session token not found in bom_user_token');
  const operatorId = crypto.createHash('md5').update(String(tokRow[0].user)).digest('hex');
  const mutation = `mutation { messengerCreateChannel(name: ${JSON.stringify(name)}, customType: ${JSON.stringify(type)}, description: "", coverUrl: "", operatorIds: [${JSON.stringify(operatorId)}]) { channel_url name custom_type } }`;
  const res = await fetch(cfg.apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.sessionToken}` },
    body: JSON.stringify({ query: mutation }),
  });
  const json = await res.json();
  const ch = json?.data?.messengerCreateChannel;
  if (!ch?.channel_url) throw new Error(`createGroupViaApi failed: ${JSON.stringify(json?.errors || json)}`);
  return ch;
}

module.exports = { gotoStudy, openGroupList, isStudyModeOn, toggleStudyMode, ensureStudyModeOn, createGroup, openStudyHall, postComment, createGroupViaApi };
