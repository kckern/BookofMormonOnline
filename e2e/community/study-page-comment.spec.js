/**
 * Comment from a study PAGE.
 *
 * On a scripture study page you select text and comment on it; the comment posts
 * to the active group's study hall linked to that reference, then renders inline
 * on the page. The POST travels the same composer → socket → DB path that the
 * study-hall comment test already exercises (and which is verified working).
 *
 * This is currently `fixme`: the inline rendering of group comments on the page
 * shares the study-hall message-LIST that does not render yet
 * (docs/bugs/2026-06-11-greenfield-study-hall.md, bug #4) — so there is nothing
 * to assert on-page, and the selection→action-bubble entry point depends on that
 * same surface. Re-enable once the message list renders.
 */
const { test } = require('./lib/fixtures');

test.describe('study page comment', () => {
  test.fixme('posts a comment from a scripture page', async () => {});
});
