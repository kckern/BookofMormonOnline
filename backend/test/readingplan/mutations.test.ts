import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { createPlanForUser, endPlanForUser, updatePlanForUser } from '../../src/graphql/resolvers/readingplan.js';

function buildWriteDb(): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: process.env['MYSQL_HOST'] ?? process.env['DB_HOST'] ?? '127.0.0.1',
        port: Number(process.env['MYSQL_PORT'] ?? process.env['DB_PORT'] ?? 3306),
        database: process.env['MYSQL_DB'] ?? process.env['DB_NAME'] ?? 'bom_prd',
        user: process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root',
        password: process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '',
        connectionLimit: 3,
      }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

const db = buildWriteDb();
const testUser = `test_rp_${nanoid(8)}`;
let canWrite = false;

const CONFIG = {
  scope: { type: 'range', start: 31103, end: 31602 },
  pacing: { type: 'cadence', unit: 'day', count: 5 },
  segmentation: { type: 'even', parts: 5 },
  credit: 'fresh',
} as const;

async function cleanup() {
  if (!canWrite) return;
  const plans = await db.selectFrom('bom_readingplan').select('slug').where('owner', 'in', [testUser, `${testUser}x`]).execute();
  const slugs = plans.map((p) => p.slug!).filter(Boolean);
  if (slugs.length) await db.deleteFrom('bom_readingplan_seg').where('plan', 'in', slugs).execute();
  await db.deleteFrom('bom_readingplan').where('owner', 'in', [testUser, `${testUser}x`]).execute();
}

beforeAll(async () => {
  try { await db.selectFrom('bom_readingplan').select('guid').limit(1).execute(); canWrite = true; } catch { canWrite = false; }
  await cleanup();
});
afterAll(async () => { await cleanup(); await db.destroy(); });

describe('plan lifecycle', () => {
  it('creates an active plan with materialized segments', async () => {
    const res = await createPlanForUser(db, testUser, { config: JSON.stringify(CONFIG), startdate: '2026-07-15' });
    expect(res.isSuccess).toBe(true);
    const segs = await db.selectFrom('bom_readingplan_seg').selectAll().where('plan', '=', res.slug!).execute();
    expect(segs).toHaveLength(5);
    expect(JSON.parse(String(segs[0]!.sectionGuids)).length).toBeGreaterThan(0);
  });

  it('refuses a second active plan', async () => {
    const res = await createPlanForUser(db, testUser, { config: JSON.stringify(CONFIG), startdate: '2026-07-15' });
    expect(res.isSuccess).toBe(false);
    expect(res.msg).toBe('ACTIVE_PLAN_EXISTS');
  });

  it('abandon frees the slot; abandoned plan is history', async () => {
    const end = await endPlanForUser(db, testUser, 'ABANDON');
    expect(end.isSuccess).toBe(true);
    const res = await createPlanForUser(db, testUser, { config: JSON.stringify(CONFIG), startdate: '2026-07-15' });
    expect(res.isSuccess).toBe(true);
    const all = await db.selectFrom('bom_readingplan').select(['status']).where('owner', '=', testUser).execute();
    expect(all.map((r) => r.status).sort()).toEqual(['abandoned', 'active']);
  });

  it('re-paces: replaces segments, scope immutable', async () => {
    // active plan exists from the abandon test above (5 daily parts, range 31103..31602)
    const rePace = { ...CONFIG, pacing: { type: 'cadence', unit: 'day', count: 3 }, segmentation: { type: 'even', parts: 3 } };
    const ok = await updatePlanForUser(db, testUser, JSON.stringify(rePace));
    expect(ok.isSuccess).toBe(true);
    const segs = await db.selectFrom('bom_readingplan_seg').selectAll().where('plan', '=', ok.slug!).execute();
    expect(segs).toHaveLength(3);

    const newScope = { ...CONFIG, scope: { type: 'range', start: 31103, end: 31200 } };
    const bad = await updatePlanForUser(db, testUser, JSON.stringify(newScope));
    expect(bad.msg).toBe('SCOPE_IMMUTABLE');
  });

  it('rejects invalid config and empty scope', async () => {
    const bad = await createPlanForUser(db, `${testUser}x`, { config: '{not json' });
    expect(bad.msg).toBe('INVALID_CONFIG');
    const empty = await createPlanForUser(db, `${testUser}x`, {
      config: JSON.stringify({ ...CONFIG, scope: { type: 'sections', guids: [] } }),
    });
    expect(empty.msg).toBe('EMPTY_SCOPE');
  });
});
