/**
 * Study mode + study groups (the top "StudyGroupBar").
 *   - enable/disable study mode via the switch
 *   - create a solo group through the New Group form (verified server-side)
 *   - switch between two groups on the bar
 *
 * Groups are created with MARKER-tagged names and deleted in teardown.
 */
const { test, expect, cfg, cleanup } = require('./lib/fixtures');
const study = require('./lib/study');

test.describe('study mode + groups', () => {
  test('enables and disables study mode from the group bar', async ({ authedPage: page }) => {
    await study.gotoStudy(page);
    await study.openGroupList(page);

    // Toggle to a known OFF baseline, then ON — proving the switch controls it.
    if (await study.isStudyModeOn(page)) await study.toggleStudyMode(page);
    expect(await study.isStudyModeOn(page)).toBe(false);

    expect(await study.toggleStudyMode(page)).toBe(true);
    expect(await study.isStudyModeOn(page)).toBe(true);
  });

  test('creates a solo group through the UI (persisted server-side)', async ({ authedPage: page, created }) => {
    await study.gotoStudy(page);
    const name = cfg.tag('solo');
    const row = await study.createGroup(page, cleanup, { name, type: 'solo' });
    created.channelUrls.push(row.channel_url);

    // Server-side truth: the channel exists, is a solo group, with the user as operator.
    expect(row.name).toBe(name);
    expect(row.custom_type).toBe('solo');
    const members = await cleanup.query('SELECT user_id, role FROM messenger_members WHERE channel_url = ?', [row.channel_url]);
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(members.some((m) => m.role === 'operator')).toBe(true);

    // And it shows up in the group list after a reload.
    await study.gotoStudy(page);
    await study.openGroupList(page);
    await study.ensureStudyModeOn(page);
    await expect(page.locator('.groupListItem', { hasText: name })).toBeVisible();
  });

  test('switches between two groups on the bar', async ({ authedPage: page, created }) => {
    test.setTimeout(120_000);
    // Setup the two groups via the backend (the create-via-UI path is covered by
    // the test above); this keeps the switch test focused and avoids churning the
    // socket through two slow UI creates. Reload picks them up from the server.
    const nameA = cfg.tag('solo-A');
    const nameB = cfg.tag('solo-B');
    const a = await study.createGroupViaApi(cleanup, { name: nameA, type: 'solo' });
    created.channelUrls.push(a.channel_url);
    const b = await study.createGroupViaApi(cleanup, { name: nameB, type: 'solo' });
    created.channelUrls.push(b.channel_url);

    await study.gotoStudy(page);
    await study.openGroupList(page);
    await study.ensureStudyModeOn(page);

    const itemA = page.locator('.groupListItem', { hasText: nameA });
    const itemB = page.locator('.groupListItem', { hasText: nameB });
    await expect(itemA).toBeVisible();
    await expect(itemB).toBeVisible();

    // Switching active group is the real assertion. setActiveStudyGroup persists
    // the active channel to localStorage.activeGroup — a robust signal that
    // doesn't depend on the dropdown staying open after the click.
    const activeGroup = () => page.evaluate(() => window.localStorage.getItem('activeGroup'));

    await itemA.first().click();
    await expect.poll(activeGroup, { timeout: 10_000 }).toBe(a.channel_url);

    await study.openGroupList(page);
    await itemB.first().click();
    await expect.poll(activeGroup, { timeout: 10_000 }).toBe(b.channel_url);

    // And switching back works too.
    await study.openGroupList(page);
    await itemA.first().click();
    await expect.poll(activeGroup, { timeout: 10_000 }).toBe(a.channel_url);
  });
});
