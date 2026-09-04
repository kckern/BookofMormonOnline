# Post Content Model Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sendbird-shaped post↔content model with an indexed `anchor` column (page slug) + a JSON `references[]` of canonical ids resolved at render, so posts (including generated bot posts) reference scripture/entities structurally instead of as inline prose.

**Architecture:** Two tiers on `messenger_messages`: `anchor` (indexed page-slug column, the sole SQL join-key `views/Page` needs) + `references` (JSON, parsed in-app). A pure resolution seam (`contentRefs.ts`) maps canonical ids ↔ display (page slug / ordinal / verse text) using existing primitives (`scripture-guide` `lookupReference`/`generateReference`, `legacyUnitToVerseIds`, `SlugResolver`). Dual-read during cutover, one-shot backfill, then retire the old columns/table.

**Tech Stack:** TypeScript, Kysely + MySQL (`bom_prd`), Vitest, `scripture-guide`. Backend `backend/`; frontend CRA `frontend/webapp/`.

**Spec:** `docs/superpowers/specs/2026-09-03-post-content-model-redesign.md`. Current model it supersedes: `docs/reference/post-scripture-reference-conventions.md`.

**Decisions locked:** `references` is its own JSON column; v1 roles = `subject | highlight` only (enum extensible to mention/quote/crossref + person/place/object, not wired in v1); anchor on the root only (replies inherit via `parent_message_id`).

---

## Phasing (each phase = working, testable software; execute + review in order)

- **Phase 0 — De-risk spike** (this plan, below): prove every legacy reference lifts to a canonical id against real data. Gates Phase 4.
- **Phase 1 — Resolution seam** (this plan, below): `contentRefs.ts`, unit + integration tested. No behavior change.
- **Phase 2 — Schema + dual-read**: add `anchor` + `references` columns; `assembleMessages` reads new refs, falling back to legacy `data.links`/`messenger_highlights`. → own plan after Phase 1.
- **Phase 3 — Write path**: `postMessage` + realtime handler + reader authoring write `anchor` + `references`. → own plan.
- **Phase 4 — Backfill + retire**: migrate legacy → new model, drop old columns + `messenger_highlights` + `"•"`. → own plan (gated by Phase 0).
- **Phase 5 — Bot conformance**: scheduler resolves `passage_ref` → anchor + reference; body = commentary only. → own plan.

This document details **Phase 0 and Phase 1** in full. Phases 2–5 are scoped in the Roadmap section and expanded into their own plans once Phase 1 lands (their concrete signatures depend on `contentRefs.ts`).

---

## File Structure (Phases 0–1)

- Create `backend/src/messaging/contentRefs.ts` — the resolution seam. One responsibility: translate between reference forms (ref string ↔ canonical verse-id ↔ display slug/ordinal/text) and legacy `(slug, ordinal)` → canonical. Pure functions where possible; DB lookups isolated behind small async functions.
- Create `backend/test/messaging/contentRefs.test.ts` — unit tests (pure ref↔verseId) + integration tests (DB-backed verseId→display, legacy lift).
- Create `backend/scripts/derisk-reference-lift.mjs` — Phase 0 spike: scans every legacy reference in `messenger_messages` and reports how many lift cleanly.

---

## Phase 0 — De-risk spike

### Task 0: Prove the legacy reference lift covers real data

**Files:**
- Create: `backend/scripts/derisk-reference-lift.mjs`

- [ ] **Step 1: Write the spike script**

```js
// Reports how many legacy references (link_type/target + messenger_highlights)
// lift to a canonical verse-id via the same path legacyUnitToVerseIds uses:
//   bom_slug(slug,type=PG).link -> bom_text(page,link).heading -> lookupReference.verse_ids
// Read-only. Run: node scripts/derisk-reference-lift.mjs
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import { lookup as lookupReference } from 'scripture-guide';
const env = {};
for (const l of readFileSync('/run/user/1003/bom-dev.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const c = await mysql.createConnection({ host: env.MYSQL_HOST, port: +(env.MYSQL_PORT||3306), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DB }); // pragma: allowlist secret
const [rows] = await c.query(
  "SELECT custom_type slug, link_target id FROM messenger_messages WHERE link_type='text' AND custom_type<>'' AND link_target REGEXP '^[0-9]+$'");
let ok = 0, empty = 0; const fails = [];
const pageCache = new Map();
for (const r of rows) {
  let pageLink = pageCache.get(r.slug);
  if (pageLink === undefined) {
    const [[pg]] = await c.query("SELECT link FROM bom_slug WHERE slug=? AND type='PG' LIMIT 1", [r.slug]);
    pageLink = pg?.link ?? null; pageCache.set(r.slug, pageLink);
  }
  if (!pageLink) { empty++; fails.push(`no-page ${r.slug}/${r.id}`); continue; }
  const [[unit]] = await c.query("SELECT heading FROM bom_text WHERE page=? AND link=? LIMIT 1", [pageLink, r.id]);
  const ids = unit?.heading ? (lookupReference(String(unit.heading).replace(/[–—]/g,'-'))?.verse_ids ?? []) : [];
  if (ids.length) ok++; else { empty++; fails.push(`no-ids ${r.slug}/${r.id} "${unit?.heading ?? ''}"`); }
}
console.log(`text links: ${rows.length}  lifted=${ok}  failed=${empty}`);
console.log('sample failures:', fails.slice(0, 20));
await c.end();
```

- [ ] **Step 2: Run it and record the result**

Run: `cd backend && node scripts/derisk-reference-lift.mjs`
Expected: a `lifted=/failed=` line + sample failures. **Success criterion:** ≥99% lift, and every failure is explainable (deleted page, non-scripture unit). If a class of failures is systematic, STOP and adjust the Phase-4 migration (fallback: keep the raw `(slug, ordinal)` in `references` as `type:"legacy_text"` for the unlifted ones).

- [ ] **Step 3: Commit the spike + findings**

```bash
cd /home/bom/BookofMormonOnline
git add backend/scripts/derisk-reference-lift.mjs
git commit -m "spike(content-model): de-risk legacy reference lift"
```

Record the numbers in the Phase-4 plan when it's written.

---

## Phase 1 — Resolution seam (`contentRefs.ts`)

The one module that knows how canonical ids map to display. Everything else (feed assembly, page-comment index, write path, bot) calls it.

### Task 1: Pure ref ↔ verse-id helpers

**Files:**
- Create: `backend/src/messaging/contentRefs.ts`
- Test: `backend/test/messaging/contentRefs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
process.env.MYSQL_HOST ||= 'test'; process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test'; process.env.SANDBOX ||= '1';
const { refToVerseIds, verseIdsToRef } = await import('../../src/messaging/contentRefs.js');

describe('ref <-> verse-id (pure, scripture-guide)', () => {
  test('a reference string resolves to canonical verse ids', () => {
    const ids = refToVerseIds('Alma 32:21');
    expect(ids.length).toBe(1);
    expect(ids[0]).toBeGreaterThan(31103); // BoM verse-id range
  });
  test('round-trips back to a normalized reference', () => {
    const ids = refToVerseIds('Alma 32:21');
    expect(verseIdsToRef(ids)).toMatch(/^Alma 32:21$/);
  });
  test('empty / unparseable input yields no ids', () => {
    expect(refToVerseIds('')).toEqual([]);
    expect(refToVerseIds('not a reference')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: FAIL — `Cannot find module '../../src/messaging/contentRefs.js'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// backend/src/messaging/contentRefs.ts
import { lookup as lookupReference, generateReference } from 'scripture-guide';

/** A reference string ("Alma 32:21") → sorted, de-duped canonical verse ids. */
export function refToVerseIds(ref: string): number[] {
  if (!ref || typeof ref !== 'string') return [];
  const ids = lookupReference(ref.replace(/[–—]/g, '-'))?.verse_ids ?? [];
  return [...new Set(ids)].sort((a, z) => a - z);
}

/** Canonical verse ids → a normalized reference string. */
export function verseIdsToRef(verseIds: number[]): string {
  if (!verseIds?.length) return '';
  return generateReference([...verseIds].sort((a, z) => a - z));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/messaging/contentRefs.ts backend/test/messaging/contentRefs.test.ts
git commit -m "feat(content-model): ref<->verse-id resolution helpers"
```

### Task 2: Legacy `(slug, ordinal)` → canonical verse-ids

**Files:**
- Modify: `backend/src/messaging/contentRefs.ts`
- Test: `backend/test/messaging/contentRefs.test.ts`

- [ ] **Step 1: Write the failing test** (integration — needs the real DB; guarded skip when unreachable, matching existing suites)

```ts
import { getDb } from '../../src/data/db.js'; // adjust to the project's db accessor
describe('legacy (slug, ordinal) -> verse-ids [integration]', () => {
  test('a known page/ordinal lifts to verse ids', async () => {
    const { legacyRefToVerseIds } = await import('../../src/messaging/contentRefs.js');
    // pick a slug/ordinal confirmed by the Phase-0 spike output:
    const ids = await legacyRefToVerseIds(getDb(), 'lehites', 56);
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.every((n) => typeof n === 'number')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: FAIL — `legacyRefToVerseIds` is not exported.

- [ ] **Step 3: Implement (reuses the proven `bom_slug → bom_text.heading` path)**

```ts
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';

/** Legacy page-internal text unit (custom_type slug + link_target ordinal) →
 *  canonical verse ids. Same path as media/fax legacyUnitToVerseIds. */
export async function legacyRefToVerseIds(db: Kysely<DB>, slug: string, ordinal: number): Promise<number[]> {
  const page = await db.selectFrom('bom_slug')
    .select('link').where('slug', '=', slug).where('type', '=', 'PG').executeTakeFirst();
  if (!page?.link) return [];
  const unit = await db.selectFrom('bom_text')
    .select('heading').where('page', '=', page.link).where('link', '=', ordinal).executeTakeFirst();
  return unit?.heading ? refToVerseIds(String(unit.heading)) : [];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/messaging/contentRefs.ts backend/test/messaging/contentRefs.test.ts
git commit -m "feat(content-model): legacy (slug,ordinal) -> verse-ids"
```

### Task 3: `verseId → display` (page slug + ordinal + verse text)

**Files:**
- Modify: `backend/src/messaging/contentRefs.ts`
- Test: `backend/test/messaging/contentRefs.test.ts`

- [ ] **Step 1: Write the failing test** (integration)

```ts
describe('verse-id -> display [integration]', () => {
  test('resolves a verse id to {slug, ordinal, text}', async () => {
    const { resolveVerseDisplay } = await import('../../src/messaging/contentRefs.js');
    const ids = (await import('../../src/messaging/contentRefs.js')).refToVerseIds('Alma 32:21');
    const d = await resolveVerseDisplay(getDb(), ids[0]);
    expect(d).not.toBeNull();
    expect(typeof d.slug).toBe('string');
    expect(typeof d.ordinal).toBe('number');
    expect(d.text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: FAIL — `resolveVerseDisplay` not exported.

- [ ] **Step 3: Implement** (find the `bom_text` unit whose page/link contains the verse, then page-slug via `SlugResolver`). Confirm the exact `bom_text` verse↔unit columns during implementation from `pagecomments.ts`'s guid→slug path; wire the mirror here.

```ts
import { SlugResolver } from '../data/slugResolver.js';

export interface VerseDisplay { slug: string; ordinal: number; text: string; }

/** Canonical verse id → the page slug + page-internal ordinal + verse text used
 *  for the content card. Returns null if the verse isn't on a reader page. */
export async function resolveVerseDisplay(db: Kysely<DB>, verseId: number): Promise<VerseDisplay | null> {
  // bom_text rows carry (page, link, heading, text) per unit; find the unit whose
  // verse range covers verseId. Implementation confirms the column mapping from
  // media/fax/resolve.ts + pagecomments.ts and reuses SlugResolver.pathsForLinks
  // to turn the page guid into a slug. Return { slug, ordinal: link, text }.
  // (Full body written during implementation once the bom_text verse column is confirmed.)
  throw new Error('resolveVerseDisplay: implement against confirmed bom_text mapping');
}
```

> Note for the implementer: Task 3's body is the one place needing a DB-schema confirmation (which `bom_text` column indexes the verse). Confirm via `SHOW COLUMNS FROM bom_text` + the `pagecomments.ts` resolver, then write the query. Do NOT ship the `throw` — it exists only to make Step 2 fail.

- [ ] **Step 4: Run to verify it passes** (after writing the real body)

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/messaging/contentRefs.ts backend/test/messaging/contentRefs.test.ts
git commit -m "feat(content-model): verse-id -> display (slug/ordinal/text)"
```

### Task 4: `Reference` type + `resolveReference` dispatcher

**Files:**
- Modify: `backend/src/messaging/contentRefs.ts`
- Test: `backend/test/messaging/contentRefs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('Reference shape + dispatcher', () => {
  test('a verse reference resolves to a display payload', async () => {
    const { resolveReference } = await import('../../src/messaging/contentRefs.js');
    const ref = { type: 'verse', id: (await import('../../src/messaging/contentRefs.js')).refToVerseIds('Alma 32:21')[0], role: 'subject' };
    const out = await resolveReference(getDb(), ref);
    expect(out.type).toBe('verse');
    expect(out.display.slug).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: FAIL — `resolveReference` not exported.

- [ ] **Step 3: Implement the type + dispatcher (v1: verse + passthrough for others)**

```ts
export type RefType = 'verse' | 'commentary' | 'image' | 'section' | 'person' | 'place' | 'object';
export type RefRole = 'subject' | 'highlight'; // v1; enum extends later
export interface Reference {
  type: RefType; id: string | number; role: RefRole;
  span?: { text: string }; ordinal?: number;
}
export interface ResolvedReference extends Reference { display: Record<string, unknown>; }

export async function resolveReference(db: Kysely<DB>, ref: Reference): Promise<ResolvedReference> {
  if (ref.type === 'verse') {
    const d = await resolveVerseDisplay(db, Number(ref.id));
    return { ...ref, display: d ?? {} };
  }
  // commentary/image/section reuse the existing SlugResolver path (Phase 2 wires
  // pagecomments' resolver here); person/place/object resolve to entity pages.
  return { ...ref, display: {} };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/messaging/contentRefs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/messaging/contentRefs.ts backend/test/messaging/contentRefs.test.ts
git commit -m "feat(content-model): Reference type + resolveReference dispatcher"
```

---

## Roadmap — Phases 2–5 (own plans, written after Phase 1 lands)

Each becomes its own dated plan under `docs/superpowers/plans/`. Signatures reference `contentRefs.ts` from Phase 1.

### Phase 2 — Schema + dual-read
- Migration `backend/migrations/…-add-anchor-references.sql`: `ALTER TABLE messenger_messages ADD COLUMN anchor VARCHAR(191) NULL, ADD COLUMN references JSON NULL, ADD INDEX idx_anchor (anchor)`. Regen `codegen/db.d.ts`.
- `messages.ts assembleMessages`: build the DTO's refs from the new `references` column when present, else fall back to today's `link_type/target/aux` + `messenger_highlights` (dual-read). New DTO field `references: Reference[]`.
- `community.ts assembleHomeFeedItem` + `ContentInFeed` (frontend): consume `references` (via resolved display) instead of the single `link`. Keep the legacy `link` output during cutover.
- Tests: assembleMessages returns identical output for a legacy row (no `references`) and an equivalent new row.

### Phase 3 — Write path
- `postMessage`: accept `anchor` + `references: Reference[]`; persist `anchor` column + `references` JSON (roots only for anchor). Keep writing legacy columns until Phase 4 backfill completes (belt-and-suspenders) OR gate on a flag.
- Realtime `handlers/message.ts`: translate client payload → `anchor` + `references`.
- Reader authoring (`Study.js`): send `references` (verse `subject` + `highlight` with span) + `anchor = pageSlug`; drop the `"•"` sentinel (empty body + highlight ref suffices).

### Phase 4 — Backfill + retire (GATED by Phase 0 result)
- `backend/scripts/migrate-references.mjs` (dry-run default, `--apply`): for each message, `anchor = custom_type` (page-slug values only); build `references` from `link_type/target/aux` (`text` via `legacyRefToVerseIds` → `{type:'verse', role:'subject'}`; `com/img/section` mapped 1:1) + `messenger_highlights` rows (`{type:'verse', role:'highlight', span:{text}}`). Non-page `custom_type` (`comment`/`formatted_comment`) → `anchor NULL`.
- Verify readback; then drop `link_type/link_target/link_aux`, `messenger_highlights`, and the `"•"` handling. Run on prod via the same `docker exec` workflow pattern as ingest-group-covers.
- Unlifted `text` links (from Phase 0 failures) → `{type:'legacy_text', slug, ordinal}` fallback so nothing is lost.

### Phase 5 — Bot conformance
- Scheduler (`bots/scheduler.ts`): from `bom_ai_topic.passage_ref` → `refToVerseIds` → `anchor = resolveVerseDisplay(...).slug`, push `{type:'verse', id, role:'subject', span:{text}}`; strip the inline citation from the generated body. Renders exactly like an organic verse comment.

---

## Self-Review

- **Spec coverage:** anchor column (Phase 2), references JSON + canonical ids + resolve-at-render (Phase 1 + 2), roles subject/highlight (Task 4), highlights folded in (Phase 4), `"•"`/custom_type retirement (Phase 3–4), bot conformance (Phase 5), migration/dual-read (Phase 2–4), de-risk (Phase 0). Backlinks explicitly deferred (spec §Out of scope). ✓
- **Placeholder scan:** the only non-final body is `resolveVerseDisplay` Step 3, deliberately a failing stub with an explicit implementer note (TDD Step 2 must fail); its real body is written in Step 3-after-fail against a confirmed `bom_text` column. Flagged, not a silent TODO.
- **Type consistency:** `refToVerseIds`, `verseIdsToRef`, `legacyRefToVerseIds`, `resolveVerseDisplay`, `Reference`/`RefType`/`RefRole`, `resolveReference` used consistently across tasks and the roadmap.
