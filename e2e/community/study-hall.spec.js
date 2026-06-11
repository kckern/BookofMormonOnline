/**
 * Study hall — posting a comment into a group's chat drawer.
 *
 * Verifies the WRITE path end-to-end: the real composer (textarea + send button)
 * → the messenger socket → bom_prd. Persistence is checked in the DB, because the
 * green-field chat message-LIST does not reliably render posted messages yet (see
 * docs/bugs/2026-06-11-greenfield-study-hall.md) — so a DOM-render assertion would
 * be testing a known-broken surface, not the post itself.
 *
 * The thread/reply UI (💬 reply → .thread panel) depends on a rendered message to
 * click, so it is blocked by the same display gap and is covered as `fixme` below.
 */
const { test, expect, cfg, cleanup } = require('./lib/fixtures');
const study = require('./lib/study');

test.describe('study hall', () => {
  test('posts a comment that persists to the channel', async ({ authedPage: page, created }) => {
    test.setTimeout(160_000);

    await study.gotoStudy(page);
    const name = cfg.tag('hall');
    const group = await study.createGroup(page, cleanup, { name, type: 'solo' });
    created.channelUrls.push(group.channel_url);

    await study.gotoStudy(page);
    await study.openStudyHall(page, name);

    const commentText = `${cfg.MARKER} comment ${cfg.runId}`;
    await study.postComment(page, commentText);

    // Server-side truth: a custom_type="comment" message landed in this channel,
    // authored over the real socket from the real composer.
    let comment = null;
    for (let i = 0; i < 12 && !comment; i++) {
      const rows = await cleanup.query(
        'SELECT message_id, message, custom_type, parent_message_id FROM messenger_messages WHERE channel_url = ? AND custom_type = ? ORDER BY message_id DESC LIMIT 1',
        [group.channel_url, 'comment'],
      );
      if (rows.length) comment = rows[0];
      else await page.waitForTimeout(1000);
    }
    expect(comment, 'the comment persisted as a custom_type=comment message').toBeTruthy();
    expect(comment.message).toContain(commentText);
    expect(comment.parent_message_id == null).toBe(true);
  });

  // Blocked: the chat message-list doesn't render posted messages, so there's no
  // message element to open the 💬 reply thread on. Tracked in
  // docs/bugs/2026-06-11-greenfield-study-hall.md. Re-enable once the list renders.
  test.fixme('starts a thread (reply) on a comment', async () => {});
});
