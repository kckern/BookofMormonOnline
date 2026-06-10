/**
 * Sandbox-aware write helpers — the Kysely analog of legacy
 * src/library/sandboxMode.ts (which monkey-patched Sequelize). When
 * `env.SANDBOX` is on (dev pointed at the read-only `reader` DB user), every
 * INSERT/UPDATE/DELETE is suppressed and a synthetic "no rows affected" result
 * is returned, so auth/log mutations still resolve with realistic shapes
 * without actually persisting. When off (prod-like), the builder executes.
 *
 * Usage: build the query with Kysely, then pass it here instead of calling
 * `.execute()` yourself:
 *     await runWrite(ctx, db.insertInto('bom_log').values(row));
 *     await runWrite(ctx, db.updateTable('bom_user').set(...).where(...));
 */
import type { Compilable } from 'kysely';
import { env } from '../config/env.js';

const suppressed = new Set<string>();

function noteOnce(op: string): void {
  if (suppressed.has(op)) return;
  suppressed.add(op);
  // eslint-disable-next-line no-console
  console.log(`🧪 sandbox: ${op} suppressed (further ${op}s silent)`);
}

/**
 * Execute a write builder unless sandboxed. Returns the driver result when it
 * runs, or a synthetic empty result `{ numAffectedRows: 0n, …, rows: [] }`
 * when suppressed — shaped like Kysely's InsertResult/UpdateResult/DeleteResult
 * so callers can read `numAffectedRows`/`insertId` uniformly.
 */
export async function runWrite<T>(
  ctx: { sandbox: boolean },
  builder: Compilable<T> & { execute: () => Promise<T[]> },
): Promise<{ executed: boolean; rows: T[] }> {
  if (ctx.sandbox) {
    const sql = builder.compile().sql.split(' ').slice(0, 2).join(' ');
    noteOnce(sql);
    return { executed: false, rows: [] };
  }
  const rows = await builder.execute();
  return { executed: true, rows };
}
