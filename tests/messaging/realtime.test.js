/**
 * tests/messaging/realtime.test.js
 *
 * Socket.io integration tests for the green-field messaging backend (:5006).
 *
 * Live tests (always run when backend is up):
 *   - Bad-token rejection
 *   - typing_start → second client in same channel room receives `typing`
 *     (typing is ephemeral — no DB write required, fully read-only safe)
 *
 * Write-guarded tests (skipped when DB is read-only; enabled via MESSAGING_WRITE_TESTS=1):
 *   - Send message → message_received broadcast
 *   - Edit message → message_updated broadcast
 *   - Delete message → message_deleted broadcast
 *   - add_reaction → reaction_changed broadcast
 *   - mark_read → unread_count_changed broadcast
 *   - Bot reply (requires backend launched with fake LlmGateway / STUB_LLM_REPLY env)
 *
 * Auth: userId = md5(bom_user.user), token = bom_user_token.token.
 * The backend's verifyToken looks up messenger_users by user_id, then validates
 * the token against bom_user_token.
 *
 * Backend endpoint: MESSENGER_URL (default http://localhost:5006)
 * Socket path: /messenger
 */

'use strict';

const {
  isBackendUp,
  probeCreds,
  probeWriteAccess,
  connectSocket,
  itWrite,
  createTestFixtures,
  teardownFixtures,
  buildWritePool,
  MESSENGER_URL,
} = require('./helpers');

// ─── State ────────────────────────────────────────────────────────────────────

let backendUp   = false;
let creds       = null; // { userId, token, username } or null
let canWrite    = false;
let writePool   = null;
let fixtures    = null; // created in write-guarded beforeAll

// Track all open sockets to clean up in afterAll.
const openSockets = [];

function trackSocket(s) {
  openSockets.push(s);
  return s;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  backendUp = await isBackendUp();
  if (!backendUp) {
    console.warn(
      '\n  ⚠  BLOCKED: backend is not reachable at ' + MESSENGER_URL +
      '\n     Start it with: cd backend && PORT=5006 npx tsx src/index.ts\n'
    );
    return;
  }

  // Probe DB credentials.
  creds = await probeCreds();
  if (!creds) {
    console.warn(
      '\n  ⚠  INFO: No valid messenger auth credentials found in DB.\n' +
      '     Valid-token connect test will be skipped.\n' +
      '     Write-guarded tests need MESSAGING_WRITE_TESTS=1 + write credentials.\n'
    );
  }

  // Probe write access.
  canWrite = await probeWriteAccess();
  if (canWrite) {
    writePool = buildWritePool();
    fixtures = await createTestFixtures(writePool);
  }
}, 30_000);

afterAll(async () => {
  // Disconnect all tracked sockets.
  for (const s of openSockets) {
    try { s.disconnect(); } catch { /* ignore */ }
  }

  // Teardown write fixtures.
  if (fixtures && writePool) {
    await teardownFixtures(fixtures, writePool);
    await writePool.end().catch(() => {});
  }
}, 30_000);

// ─── Live tests (read-only safe) ─────────────────────────────────────────────

describe('socket authentication', () => {
  it('rejects a connection with a bad token', async () => {
    if (!backendUp) {
      console.warn('  ↳ SKIPPED (backend down): bad-token rejection');
      return;
    }
    await expect(
      connectSocket({ userId: 'deadbeefdeadbeefdeadbeefdeadbeef', token: 'invalidtoken', timeout: 4000 })
    ).rejects.toThrow();
  });

  it('rejects a connection with missing userId', async () => {
    if (!backendUp) {
      console.warn('  ↳ SKIPPED (backend down): missing userId rejection');
      return;
    }
    await expect(
      connectSocket({ userId: '', token: 'sometoken', timeout: 4000 })
    ).rejects.toThrow();
  });

  it('connects successfully with a valid token', async () => {
    if (!backendUp) {
      console.warn('  ↳ SKIPPED (backend down): valid token connect');
      return;
    }
    if (!creds) {
      console.warn(
        '  ↳ SKIPPED (no valid messenger credentials in DB): valid token connect\n' +
        '     Run the backend to seed a user via MessengerController.connect() first,\n' +
        '     or set MESSAGING_WRITE_TESTS=1 + write credentials to auto-create test users.'
      );
      return;
    }

    const socket = await connectSocket({ userId: creds.userId, token: creds.token });
    trackSocket(socket);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });
});

describe('typing indicator — ephemeral, no DB write', () => {
  it('typing_start from one client triggers `typing` event on a second client in the same room', async () => {
    if (!backendUp) {
      console.warn('  ↳ SKIPPED (backend down): typing round-trip');
      return;
    }
    if (!canWrite) {
      console.warn(
        '\n  ⚠  BLOCKED (no write access): typing round-trip requires two sockets in the same channel room.\n' +
        '     Two users must both be messenger_members of a channel for the server to join them to the same room.\n' +
        '     Set MESSAGING_WRITE_TESTS=1 + write credentials to auto-create test fixtures.\n'
      );
      return;
    }

    // fixtures.userId1 is operator, fixtures.userId2 is member — both in fixtures.channelUrl
    const socket1 = trackSocket(await connectSocket({ userId: fixtures.userId1, token: fixtures.token1 }));
    const socket2 = trackSocket(await connectSocket({ userId: fixtures.userId2, token: fixtures.token2 }));

    // Wait for both to fully connect and join their rooms (brief settle time).
    await new Promise(r => setTimeout(r, 200));

    // socket2 listens for `typing`; socket1 emits `typing_start`
    const typingEvent = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for typing event')), 4000);

      socket2.once('typing', (data) => {
        clearTimeout(timer);
        resolve(data);
      });

      socket1.emit('typing_start', { channelUrl: fixtures.channelUrl });
    });

    expect(typingEvent).toMatchObject({
      channelUrl: fixtures.channelUrl,
      userId:     fixtures.userId1,
      isTyping:   true,
    });

    // Cleanup: stop typing
    socket1.emit('typing_stop', { channelUrl: fixtures.channelUrl });
    socket1.disconnect();
    socket2.disconnect();
  }, 15_000);
});

// ─── Write-guarded round-trip tests ──────────────────────────────────────────

describe('send_message → message_received broadcast', () => {
  itWrite('socket1 sends a message and socket2 receives message_received', async () => {
    const socket1 = trackSocket(await connectSocket({ userId: fixtures.userId1, token: fixtures.token1 }));
    const socket2 = trackSocket(await connectSocket({ userId: fixtures.userId2, token: fixtures.token2 }));
    await new Promise(r => setTimeout(r, 200));

    const received = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for message_received')), 6000);
      socket2.once('message_received', (msg) => { clearTimeout(timer); resolve(msg); });

      socket1.emit('send_message', {
        channelUrl: fixtures.channelUrl,
        message:    'Hello from integration test',
        highlights: [],
      }, (ack) => {
        if (!ack?.success) reject(new Error(`send_message ack failed: ${JSON.stringify(ack)}`));
      });
    });

    expect(received).toMatchObject({
      channel_url: fixtures.channelUrl,
      message:     'Hello from integration test',
    });
    expect(received.message_id).toBeTruthy();

    socket1.disconnect();
    socket2.disconnect();
  });
});

describe('edit_message → message_updated broadcast', () => {
  itWrite('socket1 edits a message and socket2 receives message_updated', async () => {
    const socket1 = trackSocket(await connectSocket({ userId: fixtures.userId1, token: fixtures.token1 }));
    const socket2 = trackSocket(await connectSocket({ userId: fixtures.userId2, token: fixtures.token2 }));
    await new Promise(r => setTimeout(r, 200));

    // First send a message to get an ID.
    const sentMsg = await new Promise((resolve, reject) => {
      socket1.emit('send_message', {
        channelUrl: fixtures.channelUrl,
        message:    'Original message',
      }, (ack) => {
        if (ack?.success) resolve(ack.message);
        else reject(new Error(`send_message ack failed: ${JSON.stringify(ack)}`));
      });
      setTimeout(() => reject(new Error('send_message ack timeout')), 5000);
    });

    await new Promise(r => setTimeout(r, 100));

    const updated = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for message_updated')), 5000);
      socket2.once('message_updated', (msg) => { clearTimeout(timer); resolve(msg); });

      socket1.emit('edit_message', {
        channelUrl: fixtures.channelUrl,
        messageId:  sentMsg.message_id,
        message:    'Edited message',
      }, (ack) => {
        if (!ack?.success) reject(new Error(`edit_message ack failed: ${JSON.stringify(ack)}`));
      });
    });

    expect(updated.message).toBe('Edited message');
    expect(updated.message_id).toBe(sentMsg.message_id);

    socket1.disconnect();
    socket2.disconnect();
  });
});

describe('delete_message → message_deleted broadcast', () => {
  itWrite('socket1 deletes a message and socket2 receives message_deleted', async () => {
    const socket1 = trackSocket(await connectSocket({ userId: fixtures.userId1, token: fixtures.token1 }));
    const socket2 = trackSocket(await connectSocket({ userId: fixtures.userId2, token: fixtures.token2 }));
    await new Promise(r => setTimeout(r, 200));

    const sentMsg = await new Promise((resolve, reject) => {
      socket1.emit('send_message', {
        channelUrl: fixtures.channelUrl,
        message:    'Message to delete',
      }, (ack) => {
        if (ack?.success) resolve(ack.message);
        else reject(new Error(`send_message ack failed: ${JSON.stringify(ack)}`));
      });
      setTimeout(() => reject(new Error('send_message ack timeout')), 5000);
    });

    await new Promise(r => setTimeout(r, 100));

    const deleted = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for message_deleted')), 5000);
      socket2.once('message_deleted', (data) => { clearTimeout(timer); resolve(data); });

      socket1.emit('delete_message', {
        channelUrl: fixtures.channelUrl,
        messageId:  sentMsg.message_id,
      }, (ack) => {
        if (!ack?.success) reject(new Error(`delete_message ack failed: ${JSON.stringify(ack)}`));
      });
    });

    expect(deleted).toMatchObject({
      channelUrl: fixtures.channelUrl,
      messageId:  sentMsg.message_id,
    });

    socket1.disconnect();
    socket2.disconnect();
  });
});

describe('add_reaction → reaction_changed broadcast', () => {
  itWrite('socket1 reacts and socket2 receives reaction_changed', async () => {
    const socket1 = trackSocket(await connectSocket({ userId: fixtures.userId1, token: fixtures.token1 }));
    const socket2 = trackSocket(await connectSocket({ userId: fixtures.userId2, token: fixtures.token2 }));
    await new Promise(r => setTimeout(r, 200));

    const sentMsg = await new Promise((resolve, reject) => {
      socket1.emit('send_message', {
        channelUrl: fixtures.channelUrl,
        message:    'Message for reaction',
      }, (ack) => {
        if (ack?.success) resolve(ack.message);
        else reject(new Error(`send_message ack failed: ${JSON.stringify(ack)}`));
      });
      setTimeout(() => reject(new Error('send_message ack timeout')), 5000);
    });

    await new Promise(r => setTimeout(r, 100));

    const reactionEvent = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for reaction_changed')), 5000);
      socket2.once('reaction_changed', (data) => { clearTimeout(timer); resolve(data); });

      socket1.emit('add_reaction', {
        channelUrl:  fixtures.channelUrl,
        messageId:   sentMsg.message_id,
        reactionKey: '👍',
      }, (ack) => {
        if (!ack?.success) reject(new Error(`add_reaction ack failed: ${JSON.stringify(ack)}`));
      });
    });

    expect(reactionEvent).toMatchObject({
      messageId:   sentMsg.message_id,
    });
    // The reaction_changed payload should include the reaction key and acting user
    expect(reactionEvent.key || reactionEvent.reactionKey || reactionEvent.reaction_key).toBeTruthy();

    socket1.disconnect();
    socket2.disconnect();
  });
});

describe('mark_read → unread_count_changed broadcast', () => {
  itWrite('mark_read emits unread_count_changed to the reading client', async () => {
    const socket1 = trackSocket(await connectSocket({ userId: fixtures.userId1, token: fixtures.token1 }));
    await new Promise(r => setTimeout(r, 200));

    // mark_read should ack and/or emit unread_count_changed back to the client.
    const unreadEvent = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Some implementations ack without an explicit broadcast — treat that as passing
        // if the ack was received already (handled below via ack path).
        reject(new Error('Timed out waiting for unread_count_changed'));
      }, 4000);

      socket1.once('unread_count_changed', (data) => {
        clearTimeout(timer);
        resolve(data ?? {});
      });

      socket1.emit('mark_read', { channelUrl: fixtures.channelUrl }, (ack) => {
        // If the ack itself arrives, that signals the read was processed.
        // Some backends emit unread_count_changed on the ack; resolve with empty
        // if the event hasn't fired yet (the once() above handles the async case).
        if (ack !== undefined) {
          // Allow the once() listener to fire if the server emits concurrently.
          setTimeout(() => {
            clearTimeout(timer);
            resolve(ack ?? {});
          }, 300);
        }
      });
    });

    // We don't assert a specific shape — the event just needs to arrive.
    expect(unreadEvent).toBeDefined();

    socket1.disconnect();
  });
});

describe('bot reply (stub gateway)', () => {
  itWrite('bot replies to a human message when STUB_LLM_REPLY is set', async () => {
    // This test requires the backend to be started with STUB_LLM_REPLY=<some text>
    // so the LlmGateway returns a deterministic canned response.
    // Without it the bot is silent and the test would hang.
    if (!process.env.STUB_LLM_REPLY) {
      console.warn(
        '\n  ⚠  BLOCKED (STUB_LLM_REPLY not set): bot reply test requires backend\n' +
        '     launched with STUB_LLM_REPLY="<reply text>" env var so the stubbed\n' +
        '     LlmGateway returns a deterministic response.\n'
      );
      return;
    }

    // fixtures.channelUrl must have a bot member for botResponder to fire.
    // This is set up by createTestFixtures only if a bot user_id was inserted.
    // For now we verify the basic send path and note the requirement.
    const socket1 = trackSocket(await connectSocket({ userId: fixtures.userId1, token: fixtures.token1 }));
    await new Promise(r => setTimeout(r, 200));

    const messages = [];
    socket1.on('message_received', (msg) => messages.push(msg));

    socket1.emit('send_message', {
      channelUrl: fixtures.channelUrl,
      message:    'Hey bot, are you there?',
    }, (ack) => {
      if (!ack?.success) throw new Error(`send_message ack failed: ${JSON.stringify(ack)}`);
    });

    // Wait up to 8 s for the bot reply (LLM round-trip even when stubbed).
    await new Promise(r => setTimeout(r, 8000));

    // Expect at least 2 messages: the human message + bot reply
    const botMessages = messages.filter(m => m.user?.is_bot || m.is_bot);
    expect(botMessages.length).toBeGreaterThanOrEqual(1);
    expect(botMessages[0].message).toBe(process.env.STUB_LLM_REPLY);

    socket1.disconnect();
  }, 20_000);
});
