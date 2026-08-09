import 'dotenv/config';
import { describe, beforeAll, afterAll } from 'vitest';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { OpaqueTokenProvider } from '../../src/auth/providers/opaqueTokenProvider.js';
import { runAuthProviderContract } from './authProvider.contract.js';

const U = process.env['AUTH_TEST_USER'] ?? '';
const P = process.env['AUTH_TEST_PASSWORD'] ?? '';
const canWrite = !!process.env['MYSQL_WRITE_USER'];
const d = U && P && canWrite ? describe : describe.skip;

let db: Kysely<DB>;
beforeAll(() => {
  db = new Kysely<DB>({ dialect: new MysqlDialect({ pool: createPool({
    host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
    port: Number(process.env['MYSQL_PORT'] ?? 3306),
    database: process.env['MYSQL_DB'] ?? 'bom_prd',
    user: process.env['MYSQL_WRITE_USER'],
    password: process.env['MYSQL_WRITE_PASSWORD'] ?? '',
  }) }) });
});
afterAll(async () => {
  // self-clean: drop any tokens the contract minted. Tokens are keyed by
  // bom_user.user, but AUTH_TEST_USER may be a username OR an email (both are
  // valid credentials), so resolve to the stored user id first — otherwise an
  // email-valued AUTH_TEST_USER would delete zero rows and leak tokens.
  if (U && db) {
    const row = await db
      .selectFrom('bom_user')
      .select('user')
      .where((eb) => eb.or([eb('user', '=', U), eb('email', '=', U)]))
      .limit(1)
      .executeTakeFirst()
      .catch(() => undefined);
    const uid = row?.user ?? U;
    await db.deleteFrom('bom_user_token').where('user', '=', uid).execute().catch(() => {});
  }
  await db?.destroy();
});

d('AuthProvider contract — OpaqueTokenProvider (live)', () => {
  runAuthProviderContract(async () => ({
    provider: new OpaqueTokenProvider({ db, sandbox: false }),
    username: U, password: P,
  }));
});
