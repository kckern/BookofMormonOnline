/**
 * test/mail/passwordreset.test.ts — token layer + mailer fallback.
 * DB harness mirrors messages.test.ts (buildWriteDb + itWrite).
 */
import 'dotenv/config';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import { nanoid } from 'nanoid';
import type { DB } from '../../codegen/db.js';
import { createResetToken, consumeResetToken } from '../../src/data/loaders/passwordreset.js';
import { ConsoleMailer } from '../../src/mail/mailer.js';

function buildWriteDb(): Kysely<DB> {
  const user = process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password = process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
        port: Number(process.env['MYSQL_PORT'] ?? 3306),
        database: process.env['MYSQL_DB'] ?? 'bom_prd',
        user, password,
      }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}
const hasWrite = !!(process.env['MYSQL_WRITE_USER'] || process.env['MYSQL_USER']);
const itWrite = hasWrite ? it : it.skip;

let db: Kysely<DB>;
beforeAll(() => { db = buildWriteDb(); });
afterAll(async () => { if (db) await db.destroy(); });

describe('password reset tokens', () => {
  itWrite('a fresh token resolves to its user and is single-use', async () => {
    const username = 'pwt-' + nanoid();
    const token = await createResetToken(db, username);
    expect(await consumeResetToken(db, token)).toBe(username); // first use
    expect(await consumeResetToken(db, token)).toBeNull();       // replay rejected
  });

  itWrite('an expired token is rejected', async () => {
    const username = 'pwt-' + nanoid();
    const token = nanoid(48);
    await db.insertInto('bom_password_reset')
      .values({ token, user: username, expires: new Date(Date.now() - 60_000) })
      .execute();
    expect(await consumeResetToken(db, token)).toBeNull();
  });

  itWrite('an unknown token is rejected', async () => {
    expect(await consumeResetToken(db, 'nope-' + nanoid())).toBeNull();
  });
});

describe('ConsoleMailer', () => {
  it('reports ok without sending', async () => {
    const r = await new ConsoleMailer().send({ to: 'a@b.c', subject: 's', html: '<p>h</p>', text: 't' });
    expect(r.ok).toBe(true);
  });
});
