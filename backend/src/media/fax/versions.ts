// backend/src/media/fax/versions.ts
import { getDb } from '../../data/db.js';

// A version is renderable IFF it has geometry rows in bom_xtras_fax_index — that
// table IS the box geometry the render path reads, so it is the single source of
// truth for "can this render?". (bom_xtras_fax is optional metadata: `1829` has
// no row there yet renders; `earliest`/`poetic`/`rebom` render with fax=0 and an
// empty indexRef.) Load a new edition's boxes and it becomes renderable with no
// code change, within the cache TTL below.
//
// `SELECT DISTINCT version FROM bom_xtras_fax_index` is a scan of a large table
// (~150k rows, non-unique index on version), so it must NOT run per request:
// the result is cached in-process with a TTL, and concurrent refreshes coalesce
// into a single query.

const TTL_MS = 15 * 60_000; // editions are added by hand, rarely — 15 min is ample
// Reject arbitrary input before it reaches the query. Every real slug is short
// and [a-z0-9] (verified against all 22 current slugs).
const VERSION_RE = /^[a-z0-9]{1,20}$/;

let cache: { set: ReadonlySet<string>; at: number } | null = null;
let inflight: Promise<ReadonlySet<string>> | null = null;

async function loadFromDb(): Promise<ReadonlySet<string>> {
  const rows = await getDb()
    .selectFrom('bom_xtras_fax_index')
    .select('version')
    .distinct()
    .execute();
  return new Set(rows.map((r) => String(r.version)).filter(Boolean));
}

/**
 * The distinct set of renderable version slugs, cached with a TTL and coalesced.
 * Throws if the DB lookup fails and nothing fresh is cached — callers must fail
 * closed (503), never treat a lookup failure as "no versions exist" (→ bogus 400).
 */
export async function renderableVersions(): Promise<ReadonlySet<string>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.set;
  if (!inflight) {
    inflight = loadFromDb()
      .then((set) => { cache = { set, at: Date.now() }; return set; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/**
 * True IFF `version` currently has geometry in bom_xtras_fax_index. Junk input
 * is rejected without touching the DB. Propagates DB errors so the caller 503s.
 */
export async function isRenderableVersion(version: string): Promise<boolean> {
  if (!VERSION_RE.test(version)) return false;
  return (await renderableVersions()).has(version);
}

/** Test-only: drop the in-process cache so a test starts from a cold lookup. */
export function __clearVersionCache(): void {
  cache = null;
  inflight = null;
}
