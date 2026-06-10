/**
 * test/messaging/messages.test.ts
 *
 * Integration tests for messages.ts + reactions.ts (Kysely port, Task 1.4).
 *
 * Targets the real bom_prd DB.  Connection mirrors users.test.ts:
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_DB — from backend/.env (dotenv auto-loaded)
 *   MYSQL_WRITE_USER     — writable user (falls back to MYSQL_USER)
 *   MYSQL_WRITE_PASSWORD — writable password (falls back to MYSQL_PASSWORD)
 *
 * Tests that INSERT/UPDATE/DELETE are guarded with `itWrite()` and automatically
 * skip when only a read-only user is present, reporting BLOCKED.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  postMessage,
  getMessage,
  getMessages,
  getThread,
  updateMessage,
  deleteMessage,
  getHighlights,
} from '../../src/messaging/messages.js';
import {
  addReaction,
  removeReaction,
  getReactions,
} from '../../src/messaging/reactions.js';

// ─── Write-capable DB instance ────────────────────────────────────────────────

function buildWriteDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user =
    process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password =
    process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';

  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host,
        port,
        database,
        user,
        password,
        connectionLimit: 5,
      }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

// ─── State ────────────────────────────────────────────────────────────────────

let db: Kysely<DB>;
let canWrite = false;

const trackedChannels: string[] = [];
const trackedUsers: string[] = [];
const trackedMessages: string[] = [];

function newChannelUrl(): string {
  const url = `test_ch_${nanoid(12)}`;
  trackedChannels.push(url);
  return url;
}
function newUserId(): string {
  const id = `test_u_${nanoid(12)}`;
  trackedUsers.push(id);
  return id;
}
function trackMessage(id: string): void {
  trackedMessages.push(id);
}

async function cleanup(): Promise<void> {
  if (!canWrite) return;

  if (trackedMessages.length) {
    await db
      .deleteFrom('messenger_reactions')
      .where('message_id', 'in', [...trackedMessages])
      .execute()
      .catch(() => undefined);
    await db
      .deleteFrom('messenger_highlights')
      .where('message_id', 'in', [...trackedMessages])
      .execute()
      .catch(() => undefined);
    await db
      .deleteFrom('messenger_messages')
      .where('message_id', 'in', [...trackedMessages])
      .execute()
      .catch(() => undefined);
    trackedMessages.length = 0;
  }
  if (trackedChannels.length) {
    await db
      .deleteFrom('messenger_channels')
      .where('channel_url', 'in', [...trackedChannels])
      .execute()
      .catch(() => undefined);
    trackedChannels.length = 0;
  }
  if (trackedUsers.length) {
    await db
      .deleteFrom('messenger_users')
      .where('user_id', 'in', [...trackedUsers])
      .execute()
      .catch(() => undefined);
    trackedUsers.length = 0;
  }
}

/** Insert a minimal channel + user; return their IDs. */
async function seedChannelAndUser(): Promise<{
  channelUrl: string;
  userId: string;
}> {
  const channelUrl = newChannelUrl();
  const userId = newUserId();
  await db
    .insertInto('messenger_channels')
    .values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'public' })
    .execute();
  await db
    .insertInto('messenger_users')
    .values({ user_id: userId, nickname: 'Tester' })
    .execute();
  return { channelUrl, userId };
}

// ─── Guard helper (mirrors users.test.ts itWrite) ─────────────────────────────

function itWrite(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!canWrite) {
      console.warn(`  ↳ SKIPPED (no write access): ${name}`);
      return;
    }
    await fn();
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  db = buildWriteDb();

  // Probe: can we reach the DB?
  try {
    await db.selectFrom('messenger_messages').select('message_id').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach messenger_messages —', String(err));
    await db.destroy();
    return;
  }

  // Probe: do we have write access?
  const probeId = `test_probe_${nanoid(8)}`;
  const probeChannel = `test_probe_ch_${nanoid(8)}`;
  try {
    await db
      .insertInto('messenger_channels')
      .values({ channel_url: probeChannel, name: 'probe', custom_type: 'public' })
      .execute();
    await db
      .deleteFrom('messenger_channels')
      .where('channel_url', '=', probeChannel)
      .execute();
    canWrite = true;
  } catch (err) {
    void probeId; // suppress unused-var lint
    console.warn(
      '\n⚠  BLOCKED: messenger tables are read-only for the current user' +
        ` (MYSQL_WRITE_USER=${process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? '?'}).` +
        ' Set MYSQL_WRITE_USER + MYSQL_WRITE_PASSWORD to a writable account to run these tests.\n' +
        `  Error: ${String(err)}`,
    );
  }
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.destroy();
});

// ─── postMessage + getMessage ─────────────────────────────────────────────────

describe('postMessage + getMessage', () => {
  itWrite(
    'inserts a message and returns a MessageDTO with the correct shape',
    async () => {
      const { channelUrl, userId } = await seedChannelAndUser();

      const dto = await postMessage(db, {
        channelUrl,
        userId,
        message: 'Hello world',
        messageType: 'MESG',
        customType: 'test',
      });
      trackMessage(dto.message_id);

      // Shape checks
      expect(typeof dto.message_id).toBe('string');
      expect(dto.message_id).toHaveLength(11);
      expect(dto.channel_url).toBe(channelUrl);
      expect(dto.message).toBe('Hello world');
      expect(dto.message_type).toBe('MESG');
      expect(dto.custom_type).toBe('test');
      expect(dto.parent_message_id).toBeNull();
      expect(dto.thread_info).toBeNull();
      expect(dto.reactions).toEqual([]);
      expect(typeof dto.created_at).toBe('number');
      expect(typeof dto.updated_at).toBe('number');
      expect(dto.created_at).toBeGreaterThan(0);

      // user field
      expect(dto.user).not.toBeNull();
      expect(dto.user!.user_id).toBe(userId);
      expect(dto.user!.nickname).toBe('Tester');
      expect(typeof dto.user!.is_online).toBe('boolean');
      expect(typeof dto.user!.is_bot).toBe('boolean');

      // data is a JSON string (empty object when no link/highlight)
      expect(typeof dto.data).toBe('string');
      const parsed = JSON.parse(dto.data) as Record<string, unknown>;
      expect(parsed).toEqual({});
    },
  );

  itWrite('getMessage returns null for an unknown message_id', async () => {
    const { channelUrl } = await seedChannelAndUser();
    const result = await getMessage(db, channelUrl, 'nosuchid123');
    expect(result).toBeNull();
  });

  itWrite('getMessage returns null for a soft-deleted message', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, { channelUrl, userId, message: 'delete me' });
    trackMessage(dto.message_id);

    const deleted = await deleteMessage(db, channelUrl, dto.message_id);
    expect(deleted).toBe(true);

    const result = await getMessage(db, channelUrl, dto.message_id);
    expect(result).toBeNull();
  });
});

// ─── data JSON round-trip ─────────────────────────────────────────────────────

describe('data JSON assembly', () => {
  itWrite('includes links in data when link params are provided', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message: 'See 1 Nephi 1:1',
      link: { type: 'scripture', target: '1ne1:1' },
    });
    trackMessage(dto.message_id);

    const data = JSON.parse(dto.data) as { links?: Record<string, string> };
    expect(data.links).toBeDefined();
    expect(data.links!['scripture']).toBe('1ne1:1');
  });

  itWrite('appends link_aux to the link value with a dot separator', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message: 'See this person',
      link: { type: 'person', target: 'nephi', aux: 'en' },
    });
    trackMessage(dto.message_id);

    const data = JSON.parse(dto.data) as { links?: Record<string, string> };
    expect(data.links!['person']).toBe('nephi.en');
  });

  itWrite('includes highlights in data when provided', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message: 'Highlighted message',
      highlights: ['1 Nephi 1:1', '2 Nephi 2:2'],
    });
    trackMessage(dto.message_id);

    const data = JSON.parse(dto.data) as { highlights?: string[] };
    expect(data.highlights).toEqual(['1 Nephi 1:1', '2 Nephi 2:2']);
  });

  itWrite('includes both links and highlights together', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message: 'Rich message',
      link: { type: 'scripture', target: 'alma32:21' },
      highlights: ['Alma 32:21'],
    });
    trackMessage(dto.message_id);

    const data = JSON.parse(dto.data) as Record<string, unknown>;
    expect(data['links']).toBeDefined();
    expect(data['highlights']).toEqual(['Alma 32:21']);
  });

  itWrite('persists highlights to messenger_highlights table', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message: 'Highlight test',
      highlights: ['Mosiah 3:19'],
    });
    trackMessage(dto.message_id);

    const hl = await getHighlights(db, dto.message_id);
    expect(hl).toHaveLength(1);
    expect(hl[0]!.text).toBe('Mosiah 3:19');
    expect(hl[0]!.ordinal).toBe(0);
    expect(hl[0]!.message_id).toBe(dto.message_id);
  });
});

// ─── reactions ────────────────────────────────────────────────────────────────

describe('addReaction / removeReaction / getReactions', () => {
  itWrite(
    'addReaction: message starts with empty reactions, then appears aggregated',
    async () => {
      const { channelUrl, userId } = await seedChannelAndUser();
      const dto = await postMessage(db, { channelUrl, userId, message: 'React to me' });
      trackMessage(dto.message_id);

      expect(dto.reactions).toEqual([]);

      const added = await addReaction(db, dto.message_id, userId, '❤️');
      expect(added).toBe(true);

      const rxs = await getReactions(db, dto.message_id);
      expect(rxs).toHaveLength(1);
      expect(rxs[0]!.key).toBe('❤️');
      expect(rxs[0]!.user_ids).toContain(userId);
    },
  );

  itWrite('addReaction: duplicate returns false (idempotent)', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, { channelUrl, userId, message: 'Dupe react' });
    trackMessage(dto.message_id);

    await addReaction(db, dto.message_id, userId, '👍');
    const second = await addReaction(db, dto.message_id, userId, '👍');
    expect(second).toBe(false);

    const rxs = await getReactions(db, dto.message_id);
    expect(rxs[0]!.user_ids).toHaveLength(1);
  });

  itWrite(
    'multiple users adding the same key are aggregated under one entry',
    async () => {
      const { channelUrl, userId: u1 } = await seedChannelAndUser();
      const u2 = newUserId();
      await db
        .insertInto('messenger_users')
        .values({ user_id: u2, nickname: 'User2' })
        .execute();

      const dto = await postMessage(db, { channelUrl, userId: u1, message: 'Group react' });
      trackMessage(dto.message_id);

      await addReaction(db, dto.message_id, u1, '🔥');
      await addReaction(db, dto.message_id, u2, '🔥');

      const rxs = await getReactions(db, dto.message_id);
      expect(rxs).toHaveLength(1);
      expect(rxs[0]!.user_ids).toHaveLength(2);
      expect(rxs[0]!.user_ids).toContain(u1);
      expect(rxs[0]!.user_ids).toContain(u2);
    },
  );

  itWrite(
    'removeReaction: removes and returns true; gone from aggregated list',
    async () => {
      const { channelUrl, userId } = await seedChannelAndUser();
      const dto = await postMessage(db, { channelUrl, userId, message: 'Remove react' });
      trackMessage(dto.message_id);

      await addReaction(db, dto.message_id, userId, '😂');
      const removed = await removeReaction(db, dto.message_id, userId, '😂');
      expect(removed).toBe(true);

      const rxs = await getReactions(db, dto.message_id);
      expect(rxs).toHaveLength(0);
    },
  );

  itWrite('removeReaction: returns false when reaction does not exist', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, { channelUrl, userId, message: 'No react' });
    trackMessage(dto.message_id);

    const removed = await removeReaction(db, dto.message_id, userId, '🤔');
    expect(removed).toBe(false);
  });

  itWrite(
    'getMessage returns reactions aggregated in the MessageDTO',
    async () => {
      const { channelUrl, userId } = await seedChannelAndUser();
      const dto = await postMessage(db, {
        channelUrl,
        userId,
        message: 'Check aggregation',
      });
      trackMessage(dto.message_id);

      await addReaction(db, dto.message_id, userId, '🎉');

      const refreshed = await getMessage(db, channelUrl, dto.message_id);
      expect(refreshed).not.toBeNull();
      const match = refreshed!.reactions.find((r) => r.key === '🎉');
      expect(match).toBeDefined();
      expect(match!.user_ids).toContain(userId);
    },
  );
});

// ─── updateMessage ────────────────────────────────────────────────────────────

describe('updateMessage', () => {
  itWrite('updates the message text and returns the updated DTO', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, { channelUrl, userId, message: 'Original' });
    trackMessage(dto.message_id);

    const updated = await updateMessage(db, channelUrl, dto.message_id, {
      message: 'Edited',
    });

    expect(updated).not.toBeNull();
    expect(updated!.message).toBe('Edited');
    expect(updated!.message_id).toBe(dto.message_id);
  });

  itWrite('replaces highlights when highlights array is provided', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message: 'With highlights',
      highlights: ['Old highlight'],
    });
    trackMessage(dto.message_id);

    const updated = await updateMessage(db, channelUrl, dto.message_id, {
      highlights: ['New highlight 1', 'New highlight 2'],
    });

    expect(updated).not.toBeNull();
    const data = JSON.parse(updated!.data) as { highlights?: string[] };
    expect(data.highlights).toEqual(['New highlight 1', 'New highlight 2']);
  });

  itWrite('clears highlights when an empty array is passed', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, {
      channelUrl,
      userId,
      message: 'Clearing highlights',
      highlights: ['1 Nephi 1:1'],
    });
    trackMessage(dto.message_id);

    const updated = await updateMessage(db, channelUrl, dto.message_id, {
      highlights: [],
    });

    expect(updated).not.toBeNull();
    const data = JSON.parse(updated!.data) as Record<string, unknown>;
    expect(data['highlights']).toBeUndefined();
  });

  itWrite('returns null for a message that does not exist', async () => {
    const { channelUrl } = await seedChannelAndUser();
    const result = await updateMessage(db, channelUrl, 'nosuchid123', {
      message: 'Ghost',
    });
    expect(result).toBeNull();
  });
});

// ─── deleteMessage ────────────────────────────────────────────────────────────

describe('deleteMessage', () => {
  itWrite('soft-deletes a message; getMessage returns null afterwards', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, { channelUrl, userId, message: 'Goodbye' });
    trackMessage(dto.message_id);

    const ok = await deleteMessage(db, channelUrl, dto.message_id);
    expect(ok).toBe(true);

    expect(await getMessage(db, channelUrl, dto.message_id)).toBeNull();
  });

  itWrite('deleted message does not appear in getMessages', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const dto = await postMessage(db, { channelUrl, userId, message: 'Vanish' });
    trackMessage(dto.message_id);

    await deleteMessage(db, channelUrl, dto.message_id);

    const msgs = await getMessages(db, channelUrl);
    expect(msgs.find((m) => m.message_id === dto.message_id)).toBeUndefined();
  });

  itWrite('returns false for a message_id that does not exist', async () => {
    const { channelUrl } = await seedChannelAndUser();
    expect(await deleteMessage(db, channelUrl, 'nosuchid123')).toBe(false);
  });
});

// ─── getMessages ──────────────────────────────────────────────────────────────

describe('getMessages', () => {
  itWrite('returns messages in descending created_at order', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const m1 = await postMessage(db, { channelUrl, userId, message: 'First' });
    trackMessage(m1.message_id);
    await new Promise<void>((r) => setTimeout(r, 20));
    const m2 = await postMessage(db, { channelUrl, userId, message: 'Second' });
    trackMessage(m2.message_id);

    const msgs = await getMessages(db, channelUrl);
    const ids = msgs.map((m) => m.message_id);
    // Newest first
    expect(ids.indexOf(m2.message_id)).toBeLessThan(ids.indexOf(m1.message_id));
  });

  itWrite(
    'excludes replies by default (parent_message_id != null)',
    async () => {
      const { channelUrl, userId } = await seedChannelAndUser();
      const parent = await postMessage(db, { channelUrl, userId, message: 'Parent' });
      trackMessage(parent.message_id);
      const reply = await postMessage(db, {
        channelUrl,
        userId,
        message: 'Reply',
        parentMessageId: parent.message_id,
      });
      trackMessage(reply.message_id);

      const msgs = await getMessages(db, channelUrl);
      expect(msgs.find((m) => m.message_id === reply.message_id)).toBeUndefined();
      expect(msgs.find((m) => m.message_id === parent.message_id)).toBeDefined();
    },
  );

  itWrite('respects the limit option', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    for (let i = 0; i < 5; i++) {
      const m = await postMessage(db, { channelUrl, userId, message: `Msg ${i}` });
      trackMessage(m.message_id);
    }
    const msgs = await getMessages(db, channelUrl, { limit: 3 });
    expect(msgs.length).toBeLessThanOrEqual(3);
  });
});

// ─── getThread + thread_info ──────────────────────────────────────────────────

describe('getThread + thread_info', () => {
  itWrite('getThread returns replies in ascending order', async () => {
    const { channelUrl, userId } = await seedChannelAndUser();
    const parent = await postMessage(db, { channelUrl, userId, message: 'Parent' });
    trackMessage(parent.message_id);

    await new Promise<void>((r) => setTimeout(r, 20));
    const r1 = await postMessage(db, {
      channelUrl,
      userId,
      message: 'Reply 1',
      parentMessageId: parent.message_id,
    });
    trackMessage(r1.message_id);
    await new Promise<void>((r) => setTimeout(r, 20));
    const r2 = await postMessage(db, {
      channelUrl,
      userId,
      message: 'Reply 2',
      parentMessageId: parent.message_id,
    });
    trackMessage(r2.message_id);

    const thread = await getThread(db, parent.message_id);
    expect(thread).toHaveLength(2);
    expect(thread[0]!.message_id).toBe(r1.message_id);
    expect(thread[1]!.message_id).toBe(r2.message_id);
  });

  itWrite(
    'parent message thread_info is populated after a reply is added',
    async () => {
      const { channelUrl, userId } = await seedChannelAndUser();
      const parent = await postMessage(db, {
        channelUrl,
        userId,
        message: 'Parent msg',
      });
      trackMessage(parent.message_id);

      // No replies yet → thread_info is null
      expect(parent.thread_info).toBeNull();

      const reply = await postMessage(db, {
        channelUrl,
        userId,
        message: 'First reply',
        parentMessageId: parent.message_id,
      });
      trackMessage(reply.message_id);

      // Fetch fresh — thread_info should now be populated
      const refreshed = await getMessage(db, channelUrl, parent.message_id);
      expect(refreshed).not.toBeNull();
      expect(refreshed!.thread_info).not.toBeNull();
      expect(refreshed!.thread_info!.reply_count).toBe(1);
      expect(refreshed!.thread_info!.most_replies).toHaveLength(1);
      expect(refreshed!.thread_info!.most_replies[0]!.user_id).toBe(userId);
    },
  );
});
