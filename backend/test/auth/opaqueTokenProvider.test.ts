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
  // self-clean: drop any tokens the contract minted for the test user
  if (U) await db?.deleteFrom('bom_user_token').where('user', '=', U).execute().catch(() => {});
  await db?.destroy();
});

d('AuthProvider contract — OpaqueTokenProvider (live)', () => {
  runAuthProviderContract(async () => ({
    provider: new OpaqueTokenProvider({ db, sandbox: false }),
    username: U, password: P,
  }));
});
