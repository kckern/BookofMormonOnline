/**
 * realtime-thread.test.js — home-feed comment-on-a-post propagation + the
 * remaining realtime events.
 *
 * Headline (your scenario): op publishes a post; member comments on it
 * (send_message + parentMessageId); op — just listening — sees the comment
 * appear live via message_received, no poll. The comment is also readable in the
 * thread via homethread.
 *
 * Plus: edit_message→message_updated, add/remove_reaction→reaction_changed,
 * mark_read→unread_count_changed, typing_start/stop→typing, fire_action→channel_action.
 */
const { runId } = require('./lib/config');
const { gql } = require('./lib/gql');
const { setupChannel } = require('./lib/scenario');

const idOf = (m) => m.message_id ?? m.messageId ?? m.id;
let S = null;
let postId = null;
let commentId = null;

beforeAll(async () => { S = await setupChannel({ customType: 'open', connect: 'both', label: 'thread' }); }, 30000);
afterAll(async () => { if (S) await S.teardown(); await require('./lib/db').close(); });

test('op publishes a post (a feed message with a content link)', async () => {
  const t0 = Date.now();
  S.opSocket.emit('send_message', { channelUrl: S.channelUrl, message: `post-${runId}`, customType: '1-nephi/1', link: { text: '1' } });
  const got = await S.memberSocket.waitFor('message_received', (p) => p.message === `post-${runId}`, { since: t0 });
  postId = idOf(got);
  expect(postId).toBeTruthy();
});

test('HOME-FEED COMMENT PROPAGATION: member comments → op sees it live', async () => {
  const text = `comment-${runId}`;
  const t0 = Date.now();
  S.memberSocket.emit('send_message', { channelUrl: S.channelUrl, message: text, parentMessageId: String(postId) });
  // op is only listening — the event bus must push the comment to it.
  const got = await S.opSocket.waitFor('message_received',
    (p) => p.message === text && String(p.parent_message_id ?? p.parentMessageId ?? '') === String(postId), { since: t0 });
  expect(got).toBeTruthy();
  commentId = idOf(got);
  expect(commentId).toBeTruthy();
});

test('the comment is readable in the thread (homethread)', async () => {
  // small settle for the write to be durably queryable
  let found = null;
  for (let i = 0; i < 5 && !found; i++) {
    const { data } = await gql(`{ homethread(token:"${require('./lib/config').operatorToken}", channel:"${S.channelUrl}", message:"${postId}"){ id msg } }`);
    found = (data.homethread || []).find((m) => String(idOf(m)) === String(commentId) || m.msg === `comment-${runId}`);
    if (!found) await new Promise((r) => setTimeout(r, 300));
  }
  expect(found).toBeTruthy();
});

test('edit_message → other party sees message_updated', async () => {
  const text = `comment-edited-${runId}`;
  const t0 = Date.now();
  S.memberSocket.emit('edit_message', { channelUrl: S.channelUrl, messageId: String(commentId), message: text });
  const got = await S.opSocket.waitFor('message_updated', (p) => idOf(p) === String(commentId) || p.message === text, { since: t0 });
  expect(got).toBeTruthy();
});

test('add_reaction then remove_reaction → reaction_changed both ways', async () => {
  let t0 = Date.now();
  S.opSocket.emit('add_reaction', { channelUrl: S.channelUrl, messageId: String(commentId), reactionKey: 'like' });
  const added = await S.memberSocket.waitFor('reaction_changed', (p) => idOf(p) === String(commentId) && JSON.stringify(p.reactions || []).includes('like'), { since: t0 });
  expect(added).toBeTruthy();
  t0 = Date.now();
  S.opSocket.emit('remove_reaction', { channelUrl: S.channelUrl, messageId: String(commentId), reactionKey: 'like' });
  const removed = await S.memberSocket.waitFor('reaction_changed', (p) => idOf(p) === String(commentId) && !JSON.stringify(p.reactions || []).includes('like'), { since: t0 });
  expect(removed).toBeTruthy();
});

test('mark_read → unread_count_changed', async () => {
  const t0 = Date.now();
  S.memberSocket.emit('mark_read', { channelUrl: S.channelUrl });
  const got = await Promise.race([
    S.memberSocket.waitFor('unread_count_changed', () => true, { since: t0, timeout: 6000 }),
    S.opSocket.waitFor('unread_count_changed', () => true, { since: t0, timeout: 6000 }),
  ]);
  expect(got).toBeTruthy();
});

test('typing_start/stop → typing broadcast to the other party', async () => {
  const t0 = Date.now();
  S.opSocket.emit('typing_start', { channelUrl: S.channelUrl });
  const got = await S.memberSocket.waitFor('typing', (p) => p.channelUrl === S.channelUrl || p.channel_url === S.channelUrl, { since: t0 });
  expect(got).toBeTruthy();
  S.opSocket.emit('typing_stop', { channelUrl: S.channelUrl });
});

test('fire_action → channel_action broadcast (study-group nav sync)', async () => {
  const t0 = Date.now();
  S.opSocket.emit('fire_action', { channelUrl: S.channelUrl, action: JSON.stringify({ kind: 'nav', page: '1-nephi/1' }) });
  const got = await S.memberSocket.waitFor('channel_action', () => true, { since: t0 });
  expect(got).toBeTruthy();
});
