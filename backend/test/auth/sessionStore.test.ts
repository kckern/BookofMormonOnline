import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { verifyToken, resolveUsername } from '../../src/auth/sessionStore.js';

const TOKEN = process.env['MESSENGER_TEST_TOKEN'] ?? '';
const d = TOKEN ? describe : describe.skip;

let db: Kysely<DB>;
beforeAll(() => {
  db = new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
        port: Number(process.env['MYSQL_PORT'] ?? 3306),
        database: process.env['MYSQL_DB'] ?? 'bom_prd',
        user: process.env['MYSQL_USER'] ?? 'reader',
        password: process.env['MYSQL_PASSWORD'] ?? '',
      }),
    }),
  });
});
afterAll(async () => { await db?.destroy(); });

d('sessionStore read path', () => {
  it('resolves a valid token to a username', async () => {
    expect(await resolveUsername(db, TOKEN)).toBeTruthy();
  });
  it('returns a Principal with userId for a valid token', async () => {
    const p = await verifyToken(db, TOKEN);
    expect(p?.userId).toBeTruthy();
  });
  it('rejects junk tokens without a DB hit', async () => {
    expect(await verifyToken(db, 'null')).toBeNull();
    expect(await resolveUsername(db, '')).toBeNull();
  });
  it('returns null for an unknown token', async () => {
    expect(await verifyToken(db, 'deadbeef'.repeat(4))).toBeNull();
  });
});
