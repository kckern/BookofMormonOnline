/**
 * test/messaging/contentRefs.test.ts
 *
 * TDD tests for backend/src/messaging/contentRefs.ts
 *
 * Pure-function tests run in any environment.
 * Integration tests (legacyRefToVerseIds, resolveVerseDisplay, resolveReference)
 * require a live DB and are skipped gracefully when unavailable.
 */

// Load .env first so real DB creds are available for integration tests, then
// fall back to dummy values so the env schema doesn't blow up in environments
// where no .env is present (CI without secrets, etc.).
import 'dotenv/config';
process.env['MYSQL_HOST'] ||= 'test'; // pragma: allowlist secret
process.env['MYSQL_USER'] ||= 'test'; // pragma: allowlist secret
process.env['MYSQL_PASSWORD'] ||= 'test'; // pragma: allowlist secret
process.env['SANDBOX'] ||= '1';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  refToVerseIds,
  verseIdsToRef,
  legacyRefToVerseIds,
  resolveVerseDisplay,
  resolveReference,
} from '../../src/messaging/contentRefs.js';

// ─── Pure-function tests ───────────────────────────────────────────────────────

describe('refToVerseIds (pure)', () => {
  it('resolves a canonical scripture reference to verse ids', () => {
    const ids = refToVerseIds('Alma 32:21');
    expect(ids.length).toBe(1);
    expect(ids[0]).toBeGreaterThan(31103);
  });

  it('returns [] for empty string', () => {
    expect(refToVerseIds('')).toEqual([]);
  });

  it('returns [] for non-reference text', () => {
    expect(refToVerseIds('not a reference')).toEqual([]);
  });
});

describe('verseIdsToRef (pure)', () => {
  it('round-trips Alma 32:21 verse id back to the reference string', () => {
    const ids = refToVerseIds('Alma 32:21');
    const ref = verseIdsToRef(ids);
    expect(ref).toMatch(/^Alma 32:21$/);
  });

  it('returns empty string for empty array', () => {
    expect(verseIdsToRef([])).toBe('');
  });
});

// ─── Integration-test helpers ─────────────────────────────────────────────────

function buildReadDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user = process.env['MYSQL_USER'] ?? 'root';
  const password = process.env['MYSQL_PASSWORD'] ?? ''; // pragma: allowlist secret
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host,
        port,
        database,
        user,
        password, // pragma: allowlist secret
        connectionLimit: 3,
        connectTimeout: 8000,
      }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

// ─── Integration tests ────────────────────────────────────────────────────────

let db: Kysely<DB>;
let dbReachable = false;

// Known-good slug and ordinal for a verse that resolves via bom_slug+bom_text.
// bom_slug.slug='lehites' (type=PG) → page guid '4becc77f2d75f'
// bom_text(page, link=1).min_verse_id = 31106 (1 Nephi 1:1 area)
// Verified against live DB 2026-09-03.
const KNOWN_SLUG = 'lehites';
const KNOWN_ORDINAL = 1;

beforeAll(async () => {
  db = buildReadDb();
  try {
    // Try a lightweight read to confirm DB is up
    await db.selectFrom('bom_slug').select('guid').limit(1).execute();
    dbReachable = true;
  } catch {
    dbReachable = false;
  }
});

afterAll(async () => {
  await db.destroy().catch(() => {});
});

describe('legacyRefToVerseIds (DB)', () => {
  it('resolves (slug, ordinal) to verse ids via bom_slug + bom_text', async () => {
    if (!dbReachable) {
      console.warn('DB not reachable — skipping legacyRefToVerseIds integration test');
      return;
    }
    const ids = await legacyRefToVerseIds(db, KNOWN_SLUG, KNOWN_ORDINAL);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids[0]).toBeGreaterThan(0);
  });

  it('returns [] for an unknown slug', async () => {
    if (!dbReachable) return;
    const ids = await legacyRefToVerseIds(db, 'this-slug-does-not-exist-xyz', 1);
    expect(ids).toEqual([]);
  });
});

describe('resolveVerseDisplay (DB)', () => {
  it('resolves a verse id to display info (slug, ordinal, text)', async () => {
    if (!dbReachable) {
      console.warn('DB not reachable — skipping resolveVerseDisplay integration test');
      return;
    }
    const verseId = refToVerseIds('Alma 32:21')[0];
    const display = await resolveVerseDisplay(db, verseId);
    expect(display).not.toBeNull();
    expect(typeof display?.slug).toBe('string');
    expect(display?.slug.length).toBeGreaterThan(0);
    expect(typeof display?.ordinal).toBe('number');
    expect(typeof display?.text).toBe('string');
    expect(display?.text.length).toBeGreaterThan(0);
  });

  it('returns null for a nonexistent verse id', async () => {
    if (!dbReachable) return;
    const display = await resolveVerseDisplay(db, 9999999);
    expect(display).toBeNull();
  });
});

describe('resolveReference (DB)', () => {
  it('resolves a verse Reference with display info', async () => {
    if (!dbReachable) {
      console.warn('DB not reachable — skipping resolveReference integration test');
      return;
    }
    const verseId = refToVerseIds('Alma 32:21')[0];
    const ref = { type: 'verse' as const, id: verseId, role: 'subject' as const };
    const out = await resolveReference(db, ref);
    expect(out.type).toBe('verse');
    expect(out.display).toBeDefined();
    expect((out.display as Record<string, unknown>)['slug']).toBeTruthy();
  });

  it('passes through non-verse types with empty display', async () => {
    if (!dbReachable) return;
    const ref = { type: 'commentary' as const, id: 42, role: 'subject' as const };
    const out = await resolveReference(db, ref);
    expect(out.type).toBe('commentary');
    expect(out.display).toEqual({});
  });
});
