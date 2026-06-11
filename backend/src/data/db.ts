import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import { env } from '../config/env.js';
import type { DB } from '../../codegen/db.js';
import { sandboxDialect } from './sandboxDialect.js';

let instance: Kysely<DB> | null = null;

export function getDb(): Kysely<DB> {
  if (!instance) {
    const base = new MysqlDialect({
      // kysely's bundled mysql2 type declarations lag the installed mysql2;
      // the runtime pool API is compatible
      pool: createPool({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DB,
        connectionLimit: 15,
        // The DB is REMOTE (public host); idle TCP connections get silently
        // dropped by NAT/firewall, and mysql2 hands those dead connections back
        // out — queries on them hang until the OS socket timeout (minutes),
        // which surfaces as the UI "spinning forever". TCP keepalive detects and
        // evicts stale connections so the pool replaces them.
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        // Fail fast on a bad connect instead of hanging the request.
        connectTimeout: 15_000,
        // Recycle idle connections so stale ones don't accumulate.
        maxIdle: 15,
        idleTimeout: 60_000,
        // Don't queue unbounded if the DB is unreachable — surface the error.
        waitForConnections: true,
        queueLimit: 0,
      }) as unknown as MysqlDialectConfig['pool'],
    });
    // SANDBOX (dev): suppress every query-builder write at the driver, so raw
    // ctx.db writes are safe by construction — no per-call runWrite discipline.
    instance = new Kysely<DB>({ dialect: env.SANDBOX ? sandboxDialect(base) : base });
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
