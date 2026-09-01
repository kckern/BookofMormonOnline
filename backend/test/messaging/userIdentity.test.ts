/**
 * test/messaging/userIdentity.test.ts
 *
 * Invariant I1 (docs/plans/2026-09-01-identity-avatar-consolidation.md): every
 * human messenger_users row has user_id = md5(bom_user_id), one row per
 * username. The 2026-09-02 merge made that true for existing data; these
 * guards keep the write paths from breaking it again.
 *
 * Compiled against a driverless Kysely so the shape of each write is
 * asserted without a database.
 */
import { createHash } from 'node:crypto';
import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
} from 'kysely';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../codegen/db.js';
import { messengerRowForUsername, upsertUser } from '../../src/messaging/users.js';

const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new MysqlAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (kysely) => new MysqlIntrospector(kysely),
    createQueryCompiler: () => new MysqlQueryCompiler(),
  },
});

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

describe('upsertUser (I1 guard)', () => {
  it('refuses a linked human row whose user_id is not md5(bom_user_id)', async () => {
    await expect(
      upsertUser(db, 'caspianrex', { nickname: 'Cory', bom_user_id: 'caspianrex' }),
    ).rejects.toThrow(/user_id must be md5\(bom_user_id\)/);
  });

  it('refuses a linked row keyed by a different user\'s hash', async () => {
    await expect(
      upsertUser(db, md5('someone.else'), { bom_user_id: 'caspianrex' }),
    ).rejects.toThrow(/user_id must be md5\(bom_user_id\)/);
  });

  it('does not gate bots or unlinked rows (bom_user_id null)', async () => {
    // DummyDriver returns no rows, so the post-insert re-fetch throws — that
    // is the *DB* step, which proves the guard let the write through.
    await expect(upsertUser(db, 'welcome_bot', { nickname: 'Welcome', is_bot: true })).rejects.toThrow(
      /no result/i,
    );
  });
});

describe('messengerRowForUsername', () => {
  it('looks the row up by the md5 of the username', () => {
    const compiled = messengerRowForUsername(db, 'caspianrex').compile();
    expect(compiled.sql).toContain('from `messenger_users`');
    expect(compiled.sql).toContain('`user_id` = ?');
    expect(compiled.parameters).toEqual([md5('caspianrex')]);
  });
});
