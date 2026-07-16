# Home Sampler Wave 1 Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five new tiles to the `/home` sampler — Notes, Verse-level Fax, Cross-references, Relationships, and Map-story (static MVP) — per the approved spec `docs/specs/2026-07-16-home-sampler-wave1-tiles-design.md`.

**Architecture:** Each tile follows the established homesampler extension path: seeded sampler fn in `backend/src/graphql/resolvers/homesampler.ts` → field on `backend/schema/HomeSampler.graphql` → field in the frontend `homesampler` query → tile component in `frontend/webapp/src/views/Home/tiles/` → `registry.js` entry. Four tiles join the infinite-scroll pool; map-story renders once per page at the tail of the masonry.

**Tech Stack:** Backend: TypeScript, GraphQL Yoga, Kysely (MySQL), vitest. Frontend: React 17 (CRA), react-router v5, react-masonry-css, OpenLayers (`ol`), jest + @testing-library/react.

---

## Context an implementer must know

- **Repo root:** `/home/bom/BookofMormonOnline`. Two live subprojects matter here: `backend/` (the greenfield GraphQL backend, port :5006, systemd unit `bom-greenfield`) and `frontend/webapp/` (the CRA app). Ignore `_deprecated/src/`.
- **Determinism convention:** every sampler orders by `MD5(CONCAT(<pk>, ':', <seed>))` via the `seededOrder(column, seed)` helper in `homesampler.ts`. Same seed ⇒ same result. Tests rely on this.
- **The resolver runs ALL samplers on every request** (`Promise.all` over the `samplers` map), regardless of query selection. Each sampler must be cheap (single-digit ms to low tens of ms) and must return `null`/`[]` gracefully — a thrown error is caught and nulled per-key, but don't rely on that.
- **Backend tests** run against the live remote DB (read-only queries) through an in-process yoga instance: `cd backend && npx vitest run test/graphql/<file>.test.ts`. `.env` is loaded via `dotenv/config` in the test file.
- **Codegen:** after editing `backend/schema/*.graphql`, run `cd backend && npm run codegen:graphql`. DB types (`codegen/db.d.ts`) already include every table used in this plan (`bom_xtras_commentary`, `bom_xtras_fax_index`, `lds_scriptures_crossref`, `bom_xrels`, `bom_map_story`, `bom_map_move`, `bom_places`, `bom_places_coords`).
- **Frontend tests:** `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern="<pattern>" --watchAll=false`. Bare `npx jest` does NOT work (JSX not enabled outside react-scripts).
- **Frontend tile props contract** (`Sampler.js` `renderTile`/`renderBatchTile`): every tile receives `data={payload[key]}`, `seed`, and the whole `payload`. `isReady(payload)` gates rendering; `isReady({})` must be falsy (a registry contract test asserts this).
- **`label(key)`** (`src/models/Utils.js:95`) falls back to returning the raw key when the dictionary lacks it — safe to use new keys like `"cross_references"`.
- **MapTile is NOT dead** (correction to a line in the spec): it lives in `RESERVE_POOL` in `Sampler.js:22-30` as a balancer reserve. Leave it alone. `MapStoryTile` is a NEW, separate tile.
- **Verification host:** check `http://localhost:8200` (Next front door → CRA), never `bom.kckern.net` (Cloudflare edge-caches the bundle for 4h).
- **Do not push.** Commit locally to `dev` only. Restarting `bom-greenfield` is authorized: `systemctl --user restart bom-greenfield && sleep 5`.

## File structure (whole plan)

**Backend**
- Modify `backend/schema/HomeSampler.graphql` — 5 new fields + 7 new types (Tasks 1–5)
- Modify `backend/src/graphql/resolvers/homesampler.ts` — `pickVaried` helper + 5 samplers + map entries (Tasks 1–5)
- Modify `backend/src/data/loaders/objects.ts` — export `parseVerseIdFromNote` (Task 4)
- Create `backend/test/graphql/homesampler-wave1.test.ts` — contract tests, one describe block per tile (Tasks 1–5)

**Frontend**
- Modify `frontend/webapp/src/models/GraphQLQueries.js` — homesampler query fields (Task 6)
- Create `tiles/NotesTile.js` + `tiles/__tests__/NotesTile.test.js` (Task 7)
- Create `tiles/FaxVerseTile.js` + `tiles/__tests__/FaxVerseTile.test.js` (Task 8)
- Create `tiles/CrossReferencesTile.js` + `tiles/__tests__/CrossReferencesTile.test.js` (Task 9)
- Create `tiles/RelationshipsTile.js` + `tiles/__tests__/RelationshipsTile.test.js` (Task 10)
- Create `tiles/MapStoryTile.js`, `tiles/MapStoryTileInner.js` + `tiles/__tests__/MapStoryTile.test.js` (Task 11)
- Modify `tiles/registry.js` — one entry per task (Tasks 7–11)
- Modify `src/views/Home/Sampler.js` — `INFINITE_REGISTRY_KEYS` additions (Tasks 7–10), `FIXED_TAIL` map-story placement (Task 11), `est()` cases (Tasks 7–11)
- Modify `src/views/Home/Sampler.css` — per-tile styles (Tasks 7–11)

(All tile paths relative to `frontend/webapp/src/views/Home/`.)

---

### Task 1: Backend — Notes sampler

Notes are `bom_xtras_commentary` rows with `is_note = 1` (short annotations, avg 133 chars; the commentary loader filters them OUT with `is_note != 1`). They reuse the existing `Commentary` GraphQL type — its `reference` resolver already derives a scripture ref from `verse_id`+`verse_range`, and `publication` resolves the source. Return up to 2 with distinct authors and non-overlapping verse spans (same variety rule as `sampleCommentaries`).

**Files:**
- Create: `backend/test/graphql/homesampler-wave1.test.ts`
- Modify: `backend/schema/HomeSampler.graphql` (add `notes: [Commentary]` to `type HomeSampler`)
- Modify: `backend/src/graphql/resolvers/homesampler.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/test/graphql/homesampler-wave1.test.ts`:

```ts
/**
 * test/graphql/homesampler-wave1.test.ts
 *
 * Contract tests for the Wave-1 sampler fields (notes, faxVerse, crossrefs,
 * relationship, mapstory). Spec: docs/specs/2026-07-16-home-sampler-wave1-tiles-design.md
 * Same harness as homesampler.test.ts: in-process yoga, read-only live-DB queries.
 * Each tile gets its own describe block with its own query, so blocks land
 * one per implementation task without touching earlier blocks.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;

beforeAll(async () => {
  yoga = createYoga({
    schema: buildSchema(),
    context: () => buildContext(db, 'en'),
  });
  // warm the pool so the first timed assertion doesn't hit a cold connection
  await db.selectFrom('bom_people').select('slug').limit(1).execute();
});

afterAll(async () => {
  await closeDb();
});

/** Execute a homesampler selection through yoga; returns data.homesampler. */
async function exec<T>(selection: string, seed: number): Promise<T> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      query: `query W($seed: Int) { homesampler(seed: $seed) { seed ${selection} } }`,
      variables: { seed },
    }),
  });
  const body = (await res.json()) as {
    data?: { homesampler: T | null };
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body.data!.homesampler as T;
}

// ─── notes ────────────────────────────────────────────────────────────────────

type NotesPayload = {
  notes: { id: string; text: string; reference: string }[] | null;
};
const NOTES_SEL = `notes { id text reference }`;

describe('homesampler.notes', () => {
  it('returns 1-2 short annotations with references', async () => {
    const s = await exec<NotesPayload>(NOTES_SEL, 31001);
    expect(s.notes?.length).toBeGreaterThanOrEqual(1);
    expect(s.notes!.length).toBeLessThanOrEqual(2);
    for (const n of s.notes!) {
      expect(n.id).toBeTruthy();
      expect(n.text.length).toBeGreaterThan(40);
      expect(n.reference).toBeTruthy(); // e.g. "Alma 32:21"
    }
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<NotesPayload>(NOTES_SEL, 777),
      exec<NotesPayload>(NOTES_SEL, 777),
      exec<NotesPayload>(NOTES_SEL, 778),
    ]);
    expect(a.notes!.map((n) => n.id)).toEqual(b.notes!.map((n) => n.id));
    expect(a.notes!.map((n) => n.id)).not.toEqual(c.notes!.map((n) => n.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: FAIL — GraphQL error `Cannot query field "notes" on type "HomeSampler"`.

- [ ] **Step 3: Add the schema field and run codegen**

In `backend/schema/HomeSampler.graphql`, inside `type HomeSampler { ... }` after `witnesses: [Witness]`, add:

```graphql
  notes: [Commentary]
```

Run: `cd /home/bom/BookofMormonOnline/backend && npm run codegen:graphql`
Expected: exits 0, regenerates `codegen/graphql.ts`.

- [ ] **Step 4: Implement the sampler**

In `backend/src/graphql/resolvers/homesampler.ts`:

4a. Extract the variety-picking loop from `sampleCommentaries` (currently the `picked` loop at its tail, lines ~223-236) into a shared helper placed just above `sampleCommentaries`:

```ts
// Variety rule shared by commentaries + notes: distinct source AND distinct
// author, non-overlapping verse spans; first n that qualify from a seeded pool.
type VariedRow = {
  source: string | null;
  _author: string | null;
  verse_id: number | null;
  verse_range: number | null;
};
function pickVaried<T extends VariedRow>(rows: T[], n: number): T[] {
  const spanOf = (r: T) => {
    const start = Number(r.verse_id) || 0;
    return [start, start + Math.max(1, Number(r.verse_range) || 1) - 1] as const;
  };
  const picked: T[] = [];
  for (const r of rows) {
    if (picked.length === n) break;
    if (picked.some((p) => p.source === r.source || (p._author && p._author === r._author))) continue;
    const [s1, e1] = spanOf(r);
    if (picked.some((p) => { const [s2, e2] = spanOf(p); return s1 <= e2 && s2 <= e1; })) continue;
    picked.push(r);
  }
  return picked;
}
```

4b. In `sampleCommentaries`, delete the local `spanOf`/`picked` loop and replace with:

```ts
  return pickVaried(rows, 3);
```

(The local `type Row = (typeof rows)[number];` line goes too.)

4c. Add the notes sampler after `sampleCommentary`:

```ts
// Short scholarly annotations — the is_note=1 rows the commentary sampler
// EXCLUDES. Same source-rating/lang gates and variety rule; notes are short
// (avg 133 chars) so the tile stacks two. Reuses the Commentary GraphQL type
// (reference/publication/preview resolvers all apply).
const sampleNotes = async (ctx: AppContext, seed: number) => {
  const lang = !ctx.lang || !/^[a-z]{2,3}$/.test(ctx.lang) || ctx.lang === 'dev' ? 'en' : ctx.lang;
  const rows = await ctx.db
    .selectFrom('bom_xtras_commentary')
    .innerJoin('bom_xtras_source', 'bom_xtras_source.source_id', 'bom_xtras_commentary.source')
    .selectAll('bom_xtras_commentary')
    .select('bom_xtras_source.source_name as _author')
    .where('bom_xtras_commentary.is_note', '=', 1)
    .where(sql<boolean>`CHAR_LENGTH(bom_xtras_commentary.text) > 40`)
    .where('bom_xtras_source.source_lang', '=', lang)
    .where('bom_xtras_source.source_rating', '=', 'G')
    .orderBy(seededOrder('bom_xtras_commentary.id', seed))
    .limit(10)
    .execute();
  return pickVaried(rows, 2);
};
```

4d. Register it in the `samplers` map (after `commentaries: sampleCommentaries,`):

```ts
  notes: sampleNotes,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Regression + typecheck**

Run: `cd /home/bom/BookofMormonOnline/backend && npm run typecheck && npx vitest run test/graphql/homesampler.test.ts`
Expected: typecheck clean; the original 5 homesampler tests still PASS (the `pickVaried` refactor must not change commentary picks).

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/HomeSampler.graphql backend/src/graphql/resolvers/homesampler.ts backend/test/graphql/homesampler-wave1.test.ts backend/codegen
git commit -m "feat(sampler): notes field — is_note=1 annotations via shared pickVaried"
```

---

### Task 2: Backend — Verse-level fax sampler

One facsimile page anchored to the verse it depicts: seeded pick from `bom_xtras_fax_index` (columns: `version`, `page`, `verse_id`) joined to `bom_xtras_fax` for title/format, ref via `generateReference`.

**Files:**
- Modify: `backend/test/graphql/homesampler-wave1.test.ts` (append describe block)
- Modify: `backend/schema/HomeSampler.graphql`
- Modify: `backend/src/graphql/resolvers/homesampler.ts`

- [ ] **Step 1: Write the failing test**

Append to `backend/test/graphql/homesampler-wave1.test.ts`:

```ts
// ─── faxVerse ─────────────────────────────────────────────────────────────────

type FaxVersePayload = {
  faxVerse: {
    version: string; title: string | null; format: string;
    page: number; verseId: number; ref: string;
  } | null;
};
const FAXVERSE_SEL = `faxVerse { version title format page verseId ref }`;

describe('homesampler.faxVerse', () => {
  it('returns one verse-anchored facsimile page', async () => {
    const s = await exec<FaxVersePayload>(FAXVERSE_SEL, 32002);
    expect(s.faxVerse).toBeTruthy();
    expect(s.faxVerse!.version).toBeTruthy();
    expect(s.faxVerse!.page).toBeGreaterThan(0);
    expect(s.faxVerse!.verseId).toBeGreaterThan(0);
    expect(s.faxVerse!.ref).toBeTruthy();
    expect(s.faxVerse!.format).toBeTruthy();
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<FaxVersePayload>(FAXVERSE_SEL, 888),
      exec<FaxVersePayload>(FAXVERSE_SEL, 888),
      exec<FaxVersePayload>(FAXVERSE_SEL, 889),
    ]);
    expect(`${a.faxVerse!.version}:${a.faxVerse!.page}`).toBe(`${b.faxVerse!.version}:${b.faxVerse!.page}`);
    expect(`${a.faxVerse!.version}:${a.faxVerse!.page}`).not.toBe(`${c.faxVerse!.version}:${c.faxVerse!.page}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: notes tests PASS; faxVerse tests FAIL with `Cannot query field "faxVerse"`.

- [ ] **Step 3: Add schema type + field, run codegen**

In `backend/schema/HomeSampler.graphql`: add to `type HomeSampler`:

```graphql
  faxVerse: FaxVersePage
```

and after `type FaxPageRef { ... }` add:

```graphql
type FaxVersePage {
  version: String
  title: String
  format: String
  page: Int
  verseId: Int
  ref: String
}
```

Run: `npm run codegen:graphql`. Expected: exits 0.

- [ ] **Step 4: Implement the sampler**

In `homesampler.ts` after `sampleFaxMore`, add:

```ts
// One facsimile page anchored to the verse it depicts — the inverse framing of
// the fax tile ("the page for THIS verse", not "this edition"). Seeded over the
// whole verse index across visible editions.
const sampleFaxVerse = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_fax_index as i')
    .innerJoin('bom_xtras_fax as f', 'f.slug', 'i.version')
    .select(['i.version as version', 'i.page as page', 'i.verse_id as verseId', 'f.title as title', 'f.format as format'])
    .where('f.hide', '=', 0)
    .where('i.verse_id', 'is not', null)
    .orderBy(sql`MD5(CONCAT(${sql.ref('i.version')}, ':', ${sql.ref('i.page')}, ':', ${seed}))`)
    .limit(1)
    .execute();
  const r = rows[0];
  if (!r) return null;
  const verseId = Number(r.verseId);
  return {
    version: String(r.version),
    title: r.title ?? null,
    format: r.format || 'jpg',
    page: Number(r.page),
    verseId,
    ref: generateReference([verseId]),
  };
};
```

Register in the `samplers` map (after `faxMore: sampleFaxMore,`):

```ts
  faxVerse: sampleFaxVerse,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/HomeSampler.graphql backend/src/graphql/resolvers/homesampler.ts backend/test/graphql/homesampler-wave1.test.ts backend/codegen
git commit -m "feat(sampler): faxVerse field — verse-anchored facsimile page"
```

---

### Task 3: Backend — Cross-references sampler

> **CORRECTION (applied during implementation):** the `significant = 1` filter below is WRONG — it matches zero `xref` rows (for xrefs `significant` is only `-1`/`0`, ~58k/51k, and is not an importance ranking). The shipped sampler filters on `type='xref'` only, with no `significant` condition. Ignore the `significant = 1` / `.where('significant', '=', 1)` lines in the code blocks that follow; everything else stands.

A source verse plus its footnote cross-references from `lds_scriptures_crossref` (153k rows; columns `src_verse_id`, `dst_verse_id`, `src_ref`, `dst_ref`, `type`, `significant`). Scope: `type='xref'` (see correction above). There are no topical titles in the data — each cross-reference is "titled" by its reference string, generated fresh via `generateReference` (the stored `dst_ref` strings are in mixed shorthand).

**Files:**
- Modify: `backend/test/graphql/homesampler-wave1.test.ts` (append)
- Modify: `backend/schema/HomeSampler.graphql`
- Modify: `backend/src/graphql/resolvers/homesampler.ts`

- [ ] **Step 1: Write the failing test**

Append to `homesampler-wave1.test.ts`:

```ts
// ─── crossrefs ────────────────────────────────────────────────────────────────

type CrossRefsPayload = {
  crossrefs: {
    srcRef: string; srcVerseId: number;
    refs: { ref: string; verseId: number }[];
  } | null;
};
const CROSSREFS_SEL = `crossrefs { srcRef srcVerseId refs { ref verseId } }`;

describe('homesampler.crossrefs', () => {
  it('returns a source verse with 2-4 significant cross-references', async () => {
    const s = await exec<CrossRefsPayload>(CROSSREFS_SEL, 33003);
    expect(s.crossrefs).toBeTruthy();
    expect(s.crossrefs!.srcVerseId).toBeGreaterThan(0);
    expect(s.crossrefs!.srcRef).toBeTruthy();
    expect(s.crossrefs!.refs.length).toBeGreaterThanOrEqual(2);
    expect(s.crossrefs!.refs.length).toBeLessThanOrEqual(4);
    for (const r of s.crossrefs!.refs) {
      expect(r.verseId).toBeGreaterThan(0);
      expect(r.ref).toBeTruthy();
      expect(r.verseId).not.toBe(s.crossrefs!.srcVerseId); // no self-reference
    }
    // no duplicate destinations
    const ids = s.crossrefs!.refs.map((r) => r.verseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<CrossRefsPayload>(CROSSREFS_SEL, 999),
      exec<CrossRefsPayload>(CROSSREFS_SEL, 999),
      exec<CrossRefsPayload>(CROSSREFS_SEL, 1000),
    ]);
    expect(a.crossrefs!.srcVerseId).toBe(b.crossrefs!.srcVerseId);
    expect(a.crossrefs!.srcVerseId).not.toBe(c.crossrefs!.srcVerseId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: earlier blocks PASS; crossrefs FAIL with `Cannot query field "crossrefs"`.

- [ ] **Step 3: Add schema types + field, run codegen**

`type HomeSampler` gains:

```graphql
  crossrefs: CrossRefSet
```

After `type FaxVersePage { ... }` add:

```graphql
type CrossRefSet {
  srcRef: String
  srcVerseId: Int
  refs: [CrossRef]
}

type CrossRef {
  ref: String
  verseId: Int
}
```

Run: `npm run codegen:graphql`. Expected: exits 0.

- [ ] **Step 4: Implement the sampler**

In `homesampler.ts` (after `sampleFaxVerse`), add:

```ts
// A verse plus its SIGNIFICANT footnote cross-references. The crossref table
// has no topical titles — the "title" of each link is its reference string,
// regenerated via generateReference (stored dst_ref shorthand is inconsistent).
// GROUP BY + HAVING needs raw sql (kysely's builder types fight aggregates here).
const sampleCrossRefs = async (ctx: AppContext, seed: number) => {
  const hub = await sql<{ src_verse_id: number }>`
    SELECT src_verse_id FROM lds_scriptures_crossref
    WHERE \`type\` = 'xref' AND significant = 1
    GROUP BY src_verse_id HAVING COUNT(DISTINCT dst_verse_id) >= 2
    ORDER BY MD5(CONCAT(src_verse_id, ':', ${seed}))
    LIMIT 1
  `.execute(ctx.db);
  const src = Number(hub.rows[0]?.src_verse_id);
  if (!src) return null;
  const rows = await ctx.db
    .selectFrom('lds_scriptures_crossref')
    .select('dst_verse_id')
    .where('src_verse_id', '=', src)
    .where('type', '=', 'xref')
    .where('significant', '=', 1)
    .orderBy(seededOrder('dst_verse_id', seed))
    .limit(8)
    .execute();
  const dsts = [...new Set(rows.map((r) => Number(r.dst_verse_id)))]
    .filter((v) => v > 0 && v !== src)
    .slice(0, 4);
  if (dsts.length < 2) return null;
  return {
    srcVerseId: src,
    srcRef: generateReference([src]),
    refs: dsts.map((v) => ({ verseId: v, ref: generateReference([v]) })),
  };
};
```

Register:

```ts
  crossrefs: sampleCrossRefs,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/HomeSampler.graphql backend/src/graphql/resolvers/homesampler.ts backend/test/graphql/homesampler-wave1.test.ts backend/codegen
git commit -m "feat(sampler): crossrefs field — significant footnote cross-references"
```

---

### Task 4: Backend — Relationships sampler

A "hub" entity with 2–4 typed edges from `bom_xrels` (columns used: `src_type`, `src_slug`, `rel`, `dst_type`, `dst_slug`, `note`, `srcweight`). Types are `'people' | 'place' | 'object'`. Display names resolve from `bom_people` (name/title), `bom_places` (name/info), `bom_objects` (name/subtitle) — mirroring `xrelsBySlug` in `backend/src/data/loaders/objects.ts:211`. Edge notes often end in a parenthesized scripture ref; `parseVerseIdFromNote` in `objects.ts:73` extracts the verse_id — export it and reuse.

**Files:**
- Modify: `backend/test/graphql/homesampler-wave1.test.ts` (append)
- Modify: `backend/schema/HomeSampler.graphql`
- Modify: `backend/src/data/loaders/objects.ts` (export `parseVerseIdFromNote`)
- Modify: `backend/src/graphql/resolvers/homesampler.ts`

- [ ] **Step 1: Write the failing test**

Append to `homesampler-wave1.test.ts`:

```ts
// ─── relationship ─────────────────────────────────────────────────────────────

type RelationshipPayload = {
  relationship: {
    hubType: string; hubSlug: string; hubName: string; hubTitle: string | null;
    edges: {
      rel: string; dstType: string; dstSlug: string; dstName: string;
      dstTitle: string | null; note: string | null; ref: string | null;
    }[];
  } | null;
};
const REL_SEL = `relationship { hubType hubSlug hubName hubTitle edges { rel dstType dstSlug dstName dstTitle note ref } }`;

describe('homesampler.relationship', () => {
  it('returns a hub with 2-4 resolved edges', async () => {
    const s = await exec<RelationshipPayload>(REL_SEL, 34004);
    expect(s.relationship).toBeTruthy();
    const r = s.relationship!;
    expect(['people', 'place', 'object']).toContain(r.hubType);
    expect(r.hubSlug).toBeTruthy();
    expect(r.hubName).toBeTruthy();
    expect(r.edges.length).toBeGreaterThanOrEqual(2);
    expect(r.edges.length).toBeLessThanOrEqual(4);
    for (const e of r.edges) {
      expect(e.rel).toBeTruthy();
      expect(['people', 'place', 'object']).toContain(e.dstType);
      expect(e.dstSlug).toBeTruthy();
      expect(e.dstName).toBeTruthy(); // resolved, not just the slug echoed on a miss
    }
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<RelationshipPayload>(REL_SEL, 1111),
      exec<RelationshipPayload>(REL_SEL, 1111),
      exec<RelationshipPayload>(REL_SEL, 1112),
    ]);
    expect(`${a.relationship!.hubType}:${a.relationship!.hubSlug}`)
      .toBe(`${b.relationship!.hubType}:${b.relationship!.hubSlug}`);
    expect(`${a.relationship!.hubType}:${a.relationship!.hubSlug}`)
      .not.toBe(`${c.relationship!.hubType}:${c.relationship!.hubSlug}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: relationship block FAILS with `Cannot query field "relationship"`.

- [ ] **Step 3: Add schema types + field, run codegen**

`type HomeSampler` gains:

```graphql
  relationship: Relationship
```

After `type CrossRef { ... }` add:

```graphql
type Relationship {
  hubType: String
  hubSlug: String
  hubName: String
  hubTitle: String
  edges: [RelEdge]
}

type RelEdge {
  rel: String
  dstType: String
  dstSlug: String
  dstName: String
  dstTitle: String
  note: String
  ref: String
}
```

Run: `npm run codegen:graphql`. Expected: exits 0.

- [ ] **Step 4: Export `parseVerseIdFromNote`**

In `backend/src/data/loaders/objects.ts:73`, change:

```ts
function parseVerseIdFromNote(note: string | null): number | null {
```

to:

```ts
export function parseVerseIdFromNote(note: string | null): number | null {
```

- [ ] **Step 5: Implement the sampler**

In `homesampler.ts`:

5a. Add to the imports at the top:

```ts
import { parseVerseIdFromNote } from '../../data/loaders/objects.js';
```

5b. After `sampleCrossRefs`, add:

```ts
// Entity display-name lookup for relationship hubs/edges. Column meanings per
// type mirror xrelsBySlug in loaders/objects.ts: people name/title,
// places name/info, objects name/subtitle.
const entityNames = async (
  ctx: AppContext,
  wanted: { type: string; slug: string }[],
): Promise<Map<string, { name: string; title: string | null }>> => {
  const slugsOf = (t: string) => [...new Set(wanted.filter((w) => w.type === t).map((w) => w.slug))];
  const [people, places, objects] = await Promise.all([
    slugsOf('people').length
      ? ctx.db.selectFrom('bom_people').select(['slug', 'name', 'title']).where('slug', 'in', slugsOf('people')).execute()
      : [],
    slugsOf('place').length
      ? ctx.db.selectFrom('bom_places').select(['slug', 'name', 'info']).where('slug', 'in', slugsOf('place')).execute()
      : [],
    slugsOf('object').length
      ? ctx.db.selectFrom('bom_objects').select(['slug', 'name', 'subtitle']).where('slug', 'in', slugsOf('object')).execute()
      : [],
  ]);
  const map = new Map<string, { name: string; title: string | null }>();
  for (const p of people) if (p.name) map.set(`people:${p.slug}`, { name: p.name, title: p.title ?? null });
  for (const p of places) if (p.name) map.set(`place:${p.slug}`, { name: p.name, title: p.info ?? null });
  for (const o of objects) if (o.name) map.set(`object:${o.slug}`, { name: o.name, title: o.subtitle ?? null });
  return map;
};

// One well-connected hub entity and up to 4 of its typed relations. The hub is
// seeded over all (src_type, src_slug) pairs with >=2 edges; GROUP BY needs raw
// sql. Edges whose dst can't be resolved to a display name are dropped (a bare
// slug reads as a bug on the front door); if that leaves <2, return null.
const sampleRelationship = async (ctx: AppContext, seed: number) => {
  const hub = await sql<{ src_type: string; src_slug: string }>`
    SELECT src_type, src_slug FROM bom_xrels
    GROUP BY src_type, src_slug HAVING COUNT(*) >= 2
    ORDER BY MD5(CONCAT(src_type, ':', src_slug, ':', ${seed}))
    LIMIT 1
  `.execute(ctx.db);
  const h = hub.rows[0];
  if (!h) return null;
  const edgeRows = await ctx.db
    .selectFrom('bom_xrels')
    .select(['rel', 'dst_type', 'dst_slug', 'note'])
    .where('src_type', '=', h.src_type)
    .where('src_slug', '=', h.src_slug)
    .orderBy(seededOrder('dst_slug', seed))
    .limit(6)
    .execute();
  const names = await entityNames(ctx, [
    { type: h.src_type, slug: h.src_slug },
    ...edgeRows.map((e) => ({ type: e.dst_type, slug: e.dst_slug })),
  ]);
  const hubName = names.get(`${h.src_type}:${h.src_slug}`);
  if (!hubName) return null;
  const edges = edgeRows
    .map((e) => {
      const dst = names.get(`${e.dst_type}:${e.dst_slug}`);
      if (!dst) return null;
      const verseId = parseVerseIdFromNote(e.note ?? null);
      return {
        rel: e.rel,
        dstType: e.dst_type,
        dstSlug: e.dst_slug,
        dstName: dst.name,
        dstTitle: dst.title,
        note: e.note ?? null,
        ref: verseId ? generateReference([verseId]) : null,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .slice(0, 4);
  if (edges.length < 2) return null;
  return {
    hubType: h.src_type,
    hubSlug: h.src_slug,
    hubName: hubName.name,
    hubTitle: hubName.title,
    edges,
  };
};
```

5c. Register:

```ts
  relationship: sampleRelationship,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: PASS (8 tests). If the "returns a hub" test flakes on a seed whose hub filters down to <2 resolved edges (sampler returns null), that is a legitimate data condition: pick a different seed constant in the test (e.g. 34005) rather than weakening assertions — the determinism test must keep both seeds returning non-null.

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/HomeSampler.graphql backend/src/graphql/resolvers/homesampler.ts backend/src/data/loaders/objects.ts backend/test/graphql/homesampler-wave1.test.ts backend/codegen
git commit -m "feat(sampler): relationship field — bom_xrels hub with resolved edges"
```

---

### Task 5: Backend — Map-story sampler

One journey with ≥2 ordered moves, coordinates from the FARMS `internal` map (the projection `MapTileInner` renders). Tables: `bom_map_story` (guid, slug, title, description), `bom_map_move` (parent → story guid, seq, start/end place slugs, travelers, description, duration, ref), coords via `bom_places` + `bom_places_coords` (guid, map, lat, lng). Mirror the join shape of `storiesByMapSlug` in `backend/src/data/loaders/maps.ts:162`.

**Files:**
- Modify: `backend/test/graphql/homesampler-wave1.test.ts` (append)
- Modify: `backend/schema/HomeSampler.graphql`
- Modify: `backend/src/graphql/resolvers/homesampler.ts`

- [ ] **Step 1: Write the failing test**

Append to `homesampler-wave1.test.ts`:

```ts
// ─── mapstory ─────────────────────────────────────────────────────────────────

type MapStoryPayload = {
  mapstory: {
    slug: string; title: string; description: string | null;
    moves: {
      seq: number; start: string; end: string; travelers: string | null;
      description: string | null; duration: string | null; ref: string | null;
      startLat: number; startLng: number; endLat: number; endLng: number;
    }[];
  } | null;
};
const MAPSTORY_SEL = `mapstory { slug title description moves { seq start end travelers description duration ref startLat startLng endLat endLng } }`;

describe('homesampler.mapstory', () => {
  it('returns one story with >=2 ordered, coordinated moves', async () => {
    const s = await exec<MapStoryPayload>(MAPSTORY_SEL, 35005);
    expect(s.mapstory).toBeTruthy();
    const m = s.mapstory!;
    expect(m.slug).toBeTruthy();
    expect(m.title).toBeTruthy();
    expect(m.moves.length).toBeGreaterThanOrEqual(2);
    const seqs = m.moves.map((x) => x.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs); // ordered by seq
    for (const mv of m.moves) {
      expect(mv.start).toBeTruthy();
      expect(mv.end).toBeTruthy();
      expect(Number.isFinite(mv.startLat)).toBe(true);
      expect(Number.isFinite(mv.startLng)).toBe(true);
      expect(Number.isFinite(mv.endLat)).toBe(true);
      expect(Number.isFinite(mv.endLng)).toBe(true);
    }
  });

  it('is deterministic per seed', async () => {
    const [a, b] = await Promise.all([
      exec<MapStoryPayload>(MAPSTORY_SEL, 1212),
      exec<MapStoryPayload>(MAPSTORY_SEL, 1212),
    ]);
    expect(a.mapstory!.slug).toBe(b.mapstory!.slug);
    expect(a.mapstory!.moves.length).toBe(b.mapstory!.moves.length);
  });
});
```

(No "varies across seeds" here: the story catalog may be small; two seeds can legitimately collide.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/graphql/homesampler-wave1.test.ts`
Expected: mapstory block FAILS with `Cannot query field "mapstory"`.

- [ ] **Step 3: Add schema types + field, run codegen**

`type HomeSampler` gains:

```graphql
  mapstory: MapStorySample
```

After `type RelEdge { ... }` add:

```graphql
type MapStorySample {
  slug: String
  title: String
  description: String
  moves: [MapMoveSample]
}

type MapMoveSample {
  seq: Int
  start: String
  end: String
  travelers: String
  description: String
  duration: String
  ref: String
  startLat: Float
  startLng: Float
  endLat: Float
  endLng: Float
}
```

Run: `npm run codegen:graphql`. Expected: exits 0.

- [ ] **Step 4: Implement the sampler**

In `homesampler.ts` after `sampleRelationship`, add:

```ts
// One scripture journey for the map-story tile: seeded story pick among stories
// whose moves ALL have start+end coords on the FARMS 'internal' map (the tile
// renders that projection — a partially-coordinated story would draw a broken
// path). Join shape mirrors storiesByMapSlug in loaders/maps.ts.
const INTERNAL_MAP = 'internal';
const sampleMapStory = async (ctx: AppContext, seed: number) => {
  const hub = await sql<{ guid: string }>`
    SELECT s.guid AS guid
    FROM bom_map_story s
    INNER JOIN bom_map_move m ON m.parent = s.guid
    INNER JOIN bom_places sp ON sp.slug = m.start
    INNER JOIN bom_places_coords spc ON spc.guid = sp.guid AND spc.map = ${INTERNAL_MAP}
    INNER JOIN bom_places ep ON ep.slug = m.end
    INNER JOIN bom_places_coords epc ON epc.guid = ep.guid AND epc.map = ${INTERNAL_MAP}
    GROUP BY s.guid HAVING COUNT(*) >= 2
    ORDER BY MD5(CONCAT(s.guid, ':', ${seed}))
    LIMIT 1
  `.execute(ctx.db);
  const guid = hub.rows[0]?.guid;
  if (!guid) return null;
  const rows = await ctx.db
    .selectFrom('bom_map_move as m')
    .innerJoin('bom_map_story as s', 's.guid', 'm.parent')
    .innerJoin('bom_places as sp', 'sp.slug', 'm.start')
    .innerJoin('bom_places_coords as spc', (join) =>
      join.onRef('spc.guid', '=', 'sp.guid').on('spc.map', '=', INTERNAL_MAP),
    )
    .innerJoin('bom_places as ep', 'ep.slug', 'm.end')
    .innerJoin('bom_places_coords as epc', (join) =>
      join.onRef('epc.guid', '=', 'ep.guid').on('epc.map', '=', INTERNAL_MAP),
    )
    .select([
      's.slug as storySlug', 's.title as storyTitle', 's.description as storyDescription',
      'm.seq', 'm.start', 'm.end', 'm.travelers', 'm.description as moveDescription',
      'm.duration', 'm.ref',
      'spc.lat as startLat', 'spc.lng as startLng',
      'epc.lat as endLat', 'epc.lng as endLng',
    ])
    .where('s.guid', '=', guid)
    .orderBy('m.seq', 'asc')
    .execute();
  if (rows.length < 2) return null;
  const first = rows[0];
  return {
    slug: first.storySlug,
    title: first.storyTitle,
    description: first.storyDescription ?? null,
    moves: rows.map((r) => ({
      seq: Number(r.seq),
      start: r.start,
      end: r.end,
      travelers: r.travelers ?? null,
      description: r.moveDescription ?? null,
      duration: r.duration ?? null,
      ref: r.ref ?? null,
      startLat: Number(r.startLat),
      startLng: Number(r.startLng),
      endLat: Number(r.endLat),
      endLng: Number(r.endLng),
    })),
  };
};
```

Register:

```ts
  mapstory: sampleMapStory,
```

- [ ] **Step 5: Run tests + typecheck + perf sanity**

Run: `npx vitest run test/graphql/homesampler-wave1.test.ts && npx vitest run test/graphql/homesampler.test.ts && npm run typecheck`
Expected: all PASS, typecheck clean.

Then confirm the five new samplers haven't blown up response time (they run on EVERY homesampler call):

```bash
cd /home/bom/BookofMormonOnline/backend && node -e '
const q = "{ homesampler(seed: 42) { seed notes { id } faxVerse { page } crossrefs { srcVerseId } relationship { hubSlug } mapstory { slug } } }";
const t0 = Date.now();
fetch("http://localhost:5006/en", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) })
  .then(r => r.json()).then(j => { console.log(Date.now() - t0, "ms", JSON.stringify(j).slice(0, 200)); });
'
```

NOTE: this curl hits the RUNNING service, which still has old code — restart first: `systemctl --user restart bom-greenfield && sleep 5`. Expected: response contains all five fields non-null, total time not meaningfully above the pre-change baseline (~2.5–4s; the new samplers should add <200ms combined). If one sampler dominates, note it in the commit message — do not silently accept a regression above ~500ms.

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/HomeSampler.graphql backend/src/graphql/resolvers/homesampler.ts backend/test/graphql/homesampler-wave1.test.ts backend/codegen
git commit -m "feat(sampler): mapstory field — seeded journey with internal-map coords"
```

---

### Task 6: Frontend — homesampler query fields

Add the five new selections to the `homesampler` query so first-load AND infinite-scroll batches (which reuse the same query builder) carry the data. No component work yet.

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js:1741-1758` (the `homesampler` query string)

- [ ] **Step 1: Add the fields**

In the `homesampler` query template (after the `text { ... }` line, before the closing backtick `}`), add:

```
        notes { id title text reference publication { source_name } }
        faxVerse { version title format page verseId ref }
        crossrefs { srcRef srcVerseId refs { ref verseId } }
        relationship { hubType hubSlug hubName hubTitle edges { rel dstType dstSlug dstName dstTitle note ref } }
        mapstory { slug title description moves { seq start end travelers description duration ref startLat startLng endLat endLng } }
```

(`assemblePayload` spreads the sampler object — `{ ...sampler, ... }` at `Sampler.js:117` — so the new keys flow into the payload with no further wiring.)

- [ ] **Step 2: Verify against the live backend**

The backend restarted in Task 5 already serves the fields. Sanity-check the exact query string the frontend will send:

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp && node -e '
const q = `{ homesampler(seed: 4242) {
  notes { id title text reference publication { source_name } }
  faxVerse { version title format page verseId ref }
  crossrefs { srcRef srcVerseId refs { ref verseId } }
  relationship { hubType hubSlug hubName hubTitle edges { rel dstType dstSlug dstName dstTitle note ref } }
  mapstory { slug title description moves { seq start end travelers description duration ref startLat startLng endLat endLng } }
} }`;
fetch("http://localhost:5006/en", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) })
  .then(r => r.json()).then(j => {
    if (j.errors) { console.error("ERRORS", j.errors); process.exit(1); }
    const s = j.data.homesampler;
    console.log("notes:", s.notes?.length, "faxVerse:", !!s.faxVerse, "crossrefs:", s.crossrefs?.refs?.length, "relationship:", s.relationship?.edges?.length, "mapstory moves:", s.mapstory?.moves?.length);
  });
'
```

Expected: no ERRORS; all five counts/flags truthy.

- [ ] **Step 3: Run the existing frontend Home tests (guard against query-string regressions)**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --testPathPattern="Home" --watchAll=false`
Expected: PASS (same counts as before this task).

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/models/GraphQLQueries.js
git commit -m "feat(sampler): query wave-1 fields (notes, faxVerse, crossrefs, relationship, mapstory)"
```

---

### Task 7: Frontend — NotesTile

Scripture-first annotation card, structured like `ImageArtTile`: for each of the 1–2 notes, the actual passage via `ScriptureExcerpt` (Read-experience rendering) with the short annotation beneath, plus source attribution and a see-in-context link. Joins the infinite pool.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/NotesTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/NotesTile.test.js`
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js` (`INFINITE_REGISTRY_KEYS`, `est()`)
- Modify: `frontend/webapp/src/views/Home/Sampler.css`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/NotesTile.test.js`:

```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotesTile from "../NotesTile";

// ScriptureExcerpt fetches the passage via the API on mount; keep it pending so
// the excerpt stays empty and assertions target the note content only.
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));

const notes = [
  { id: "n1", title: null, text: "Alma gave the same admonition to Helaman at Alma 36:3.", reference: "Alma 36:3", publication: { source_name: "BMC Notes" } },
  { id: "n2", title: null, text: "Fulfilled at Mosiah 19:13-15.", reference: "Mosiah 19:13", publication: { source_name: "Second Source" } },
];

const renderTile = (data) =>
  render(
    <MemoryRouter>
      <NotesTile data={data} />
    </MemoryRouter>
  );

describe("NotesTile", () => {
  test("renders each note's text and source", () => {
    renderTile(notes);
    expect(screen.getByText(/same admonition to Helaman/)).toBeTruthy();
    expect(screen.getByText(/Fulfilled at Mosiah/)).toBeTruthy();
    expect(screen.getByText("BMC Notes")).toBeTruthy();
    expect(screen.getByText("Second Source")).toBeTruthy();
  });

  test("returns null for empty data", () => {
    const { container } = renderTile([]);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --testPathPattern="NotesTile" --watchAll=false`
Expected: FAIL — `Cannot find module '../NotesTile'`.

- [ ] **Step 3: Implement the tile**

Create `frontend/webapp/src/views/Home/tiles/NotesTile.js`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { label } from "src/models/Utils";
import ScriptureExcerpt, { readPath } from "src/views/_Common/ScriptureExcerpt";

/**
 * Short scholarly annotations (is_note=1 commentary rows) rendered as margin
 * glosses on the ACTUAL passage: scripture first (Read-experience typography
 * via ScriptureExcerpt), the note beneath, source attribution under that.
 */
export default function NotesTile({ data }) {
  const notes = (data || []).filter((n) => n?.text && n?.reference);
  if (!notes.length) return null;
  return (
    <div className="samplerTileInner notesTile">
      <h3 className="tileHeading">{label("notes")}</h3>
      {notes.map((n) => {
        const to = readPath(n.reference);
        return (
          <div key={n.id} className="notesEntry">
            <div className="read-content scriptureExcerptCompact">
              <ScriptureExcerpt refText={n.reference} hideStudy />
            </div>
            <div className="notesText">{Parser(n.text)}</div>
            <div className="notesMeta">
              {n.publication?.source_name ? (
                <span className="notesSource">{n.publication.source_name}</span>
              ) : null}
              {to ? (
                <Link to={to} className="tileMoreLink">{label("view_in_context")}</Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --testPathPattern="NotesTile" --watchAll=false`
Expected: PASS (2 tests).

- [ ] **Step 5: Register the tile**

In `frontend/webapp/src/views/Home/tiles/registry.js`:

```js
import NotesTile from "./NotesTile";
```

and append to `tileRegistry` (after the `art` entry):

```js
  { key: "notes",       component: NotesTile,       span: "tile-notes",       isReady: (p) => (p?.notes?.length || 0) > 0 },
```

In `frontend/webapp/src/views/Home/Sampler.js`:
- Add `"notes"` to `INFINITE_REGISTRY_KEYS` (line 67).
- Add a case to `est()` (in the switch, after the `chiasmus` case): `case "notes": return 24;`

In `frontend/webapp/src/views/Home/Sampler.css`, append:

```css
/* ---- notes tile (wave 1) ---- */
.notesTile .notesEntry + .notesEntry {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(128, 128, 128, 0.25);
}
.notesTile .notesText { font-size: 0.95rem; margin-top: 0.5rem; }
.notesTile .notesMeta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-top: 0.35rem;
}
.notesTile .notesSource { font-size: 0.8rem; opacity: 0.7; }
```

- [ ] **Step 6: Run the Home suite (registry contract + Sampler tests)**

Run: `CI=true npx react-scripts test --testPathPattern="Home" --watchAll=false`
Expected: PASS — the `tileRegistry contract` tests in `Sampler.test.js` cover the new entry automatically (`isReady({})` is falsy ✓).

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Home/tiles/NotesTile.js frontend/webapp/src/views/Home/tiles/__tests__/NotesTile.test.js frontend/webapp/src/views/Home/tiles/registry.js frontend/webapp/src/views/Home/Sampler.js frontend/webapp/src/views/Home/Sampler.css
git commit -m "feat(sampler): NotesTile — scripture-first annotations in the infinite pool"
```

---

### Task 8: Frontend — FaxVerseTile

One facsimile page at natural aspect with the verse it depicts: page image (deep-link to `/fax/:version/:page`), the ref bar (ref opens the scripture popup — same pattern as `FaxTile`), and the verse text below via `ScriptureExcerpt`.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/FaxVerseTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js`
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.css`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js`:

```jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaxVerseTile from "../FaxVerseTile";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  version: "1830",
  title: "1830 Edition",
  format: "jpg",
  page: 117,
  verseId: 15234,
  ref: "Mosiah 2:17",
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <FaxVerseTile data={d} />
    </MemoryRouter>
  );

describe("FaxVerseTile", () => {
  test("renders the page image with zero-padded thumb URL and deep link", () => {
    renderTile(data);
    const img = screen.getByAltText("1830 Edition p.117");
    expect(img.getAttribute("src")).toBe("https://media.test/fax/thumb/1830/117.jpg");
    expect(img.closest("a").getAttribute("href")).toBe("/fax/1830/117");
  });

  test("ref bar opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("Mosiah 2:17"));
    expect(openScripture).toHaveBeenCalledWith("Mosiah 2:17");
  });

  test("returns null without a page", () => {
    const { container } = renderTile(null);
    expect(container.firstChild).toBeNull();
  });
});
```

NOTE the thumb URL: `bom_xtras_fax_index.page` values are the REAL page numbers `FaxTile` zero-pads to 3 digits (`String(p.page).padStart(3, "0")` → `117` stays `117`; page 7 → `007`). The test uses 117 so padStart is a no-op in the expected string; the implementation must still pad.

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --testPathPattern="FaxVerseTile" --watchAll=false`
Expected: FAIL — `Cannot find module '../FaxVerseTile'`.

- [ ] **Step 3: Implement the tile**

Create `frontend/webapp/src/views/Home/tiles/FaxVerseTile.js`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt from "src/views/_Common/ScriptureExcerpt";
import { openScripture } from "./ScripturePopup";

/**
 * A facsimile page anchored to the verse it depicts — "here is this passage in
 * the 1830 edition". Page image at natural aspect (deep-links into the viewer),
 * the FaxTile ref-bar pattern (ref opens the scripture popup), and the verse
 * itself rendered below via ScriptureExcerpt.
 */
export default function FaxVerseTile({ data }) {
  if (!data?.version || !data?.page) return null;
  const nnn = String(data.page).padStart(3, "0");
  const format = data.format || "jpg";
  return (
    <div className="samplerTileInner faxVerseTile">
      <h3 className="tileHeading">
        <Link to={`/fax/${data.version}`}>{label("facsimiles")}</Link>
      </h3>
      <Link to={`/fax/${data.version}/${data.page}`} className="faxTilePage faxVersePage">
        <img
          src={`${assetUrl}/fax/thumb/${data.version}/${nnn}.${format}`}
          alt={`${data.title || data.version} p.${data.page}`}
          loading="lazy"
          onError={(e) => (e.target.style.display = "none")}
        />
        <span className="faxPageBar">
          {data.ref ? (
            <span
              className="faxPageBarRef"
              role="button"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScripture(data.ref); }}
            >
              {data.ref}
            </span>
          ) : <span />}
          <span className="faxPageBarNum">p. {data.page}</span>
        </span>
      </Link>
      {data.title ? <div className="faxVerseTitle">{data.title}</div> : null}
      {data.ref ? (
        <div className="read-content scriptureExcerptCompact">
          <ScriptureExcerpt refText={data.ref} hideStudy />
        </div>
      ) : null}
    </div>
  );
}
```

(`.faxTilePage`/`.faxPageBar` classes reuse the existing FaxTile CSS for the overlay bar.)

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --testPathPattern="FaxVerseTile" --watchAll=false`
Expected: PASS (3 tests).

- [ ] **Step 5: Register the tile**

`registry.js`: add `import FaxVerseTile from "./FaxVerseTile";` and append:

```js
  { key: "faxVerse",    component: FaxVerseTile,    span: "tile-faxVerse",    isReady: (p) => !!p?.faxVerse?.page },
```

`Sampler.js`: add `"faxVerse"` to `INFINITE_REGISTRY_KEYS`; add `est()` case: `case "faxVerse": return 30;`

`Sampler.css`, append:

```css
/* ---- verse-fax tile (wave 1) ---- */
.faxVerseTile .faxVersePage { display: block; }
.faxVerseTile .faxVersePage img { width: 100%; display: block; border-radius: 4px; }
.faxVerseTile .faxVerseTitle { font-size: 0.85rem; opacity: 0.8; margin: 0.4rem 0; }
```

- [ ] **Step 6: Run the Home suite**

Run: `CI=true npx react-scripts test --testPathPattern="Home" --watchAll=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Home/tiles/FaxVerseTile.js frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js frontend/webapp/src/views/Home/tiles/registry.js frontend/webapp/src/views/Home/Sampler.js frontend/webapp/src/views/Home/Sampler.css
git commit -m "feat(sampler): FaxVerseTile — verse-anchored facsimile page in the infinite pool"
```

---

### Task 9: Frontend — CrossReferencesTile

Source passage on top (ScriptureExcerpt), the cross-references beneath as reference-labeled buttons that open the scripture popup (rendering every destination passage inline would make the tile too tall — spec allows the link form).

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/CrossReferencesTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/CrossReferencesTile.test.js`
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.css`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/CrossReferencesTile.test.js`:

```jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CrossReferencesTile from "../CrossReferencesTile";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  srcRef: "Alma 32:21",
  srcVerseId: 20000,
  refs: [
    { ref: "Hebrews 11:1", verseId: 30001 },
    { ref: "Ether 12:6", verseId: 30002 },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <CrossReferencesTile data={d} />
    </MemoryRouter>
  );

describe("CrossReferencesTile", () => {
  test("renders each cross-reference labeled by its ref", () => {
    renderTile(data);
    expect(screen.getByText("Hebrews 11:1")).toBeTruthy();
    expect(screen.getByText("Ether 12:6")).toBeTruthy();
  });

  test("clicking a cross-reference opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("Hebrews 11:1"));
    expect(openScripture).toHaveBeenCalledWith("Hebrews 11:1");
  });

  test("returns null without refs", () => {
    const { container } = renderTile({ srcRef: "Alma 32:21", refs: [] });
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --testPathPattern="CrossReferencesTile" --watchAll=false`
Expected: FAIL — `Cannot find module '../CrossReferencesTile'`.

- [ ] **Step 3: Implement the tile**

Create `frontend/webapp/src/views/Home/tiles/CrossReferencesTile.js`:

```jsx
import React from "react";
import { label } from "src/models/Utils";
import ScriptureExcerpt from "src/views/_Common/ScriptureExcerpt";
import { openScripture } from "./ScripturePopup";

/**
 * A passage and its significant footnote cross-references. The source verse
 * renders in full (Read typography); each cross-reference is a chip labeled by
 * its reference (the data has no topical titles) opening the scripture popup.
 */
export default function CrossReferencesTile({ data }) {
  const refs = (data?.refs || []).filter((r) => r?.ref);
  if (!data?.srcRef || !refs.length) return null;
  return (
    <div className="samplerTileInner crossRefsTile">
      <h3 className="tileHeading">{label("cross_references")}</h3>
      <div className="read-content scriptureExcerptCompact">
        <ScriptureExcerpt refText={data.srcRef} hideStudy />
      </div>
      <div className="crossRefsList">
        {refs.map((r) => (
          <button
            key={r.verseId}
            type="button"
            className="crossRefItem"
            onClick={() => openScripture(r.ref)}
          >
            {r.ref}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --testPathPattern="CrossReferencesTile" --watchAll=false`
Expected: PASS (3 tests).

- [ ] **Step 5: Register the tile**

`registry.js`: add `import CrossReferencesTile from "./CrossReferencesTile";` and append:

```js
  { key: "crossrefs",   component: CrossReferencesTile, span: "tile-crossrefs", isReady: (p) => (p?.crossrefs?.refs?.length || 0) > 0 },
```

`Sampler.js`: add `"crossrefs"` to `INFINITE_REGISTRY_KEYS`; add `est()` case: `case "crossrefs": return 20;`

`Sampler.css`, append:

```css
/* ---- cross-references tile (wave 1) ---- */
.crossRefsTile .crossRefsList {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.6rem;
}
.crossRefsTile .crossRefItem {
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-size: 0.85rem;
  padding: 0.15rem 0.7rem;
  cursor: pointer;
}
.crossRefsTile .crossRefItem:hover { border-color: currentColor; }
```

- [ ] **Step 6: Run the Home suite**

Run: `CI=true npx react-scripts test --testPathPattern="Home" --watchAll=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Home/tiles/CrossReferencesTile.js frontend/webapp/src/views/Home/tiles/__tests__/CrossReferencesTile.test.js frontend/webapp/src/views/Home/tiles/registry.js frontend/webapp/src/views/Home/Sampler.js frontend/webapp/src/views/Home/Sampler.css
git commit -m "feat(sampler): CrossReferencesTile — passage + significant xrefs in the infinite pool"
```

---

### Task 10: Frontend — RelationshipsTile

A "connections" card: hub entity heading (deep-linked to its profile), then 2–4 typed edges, each deep-linking to the destination profile, with the note as a subtitle and an optional ref chip. Profile routes (from `src/models/Routes.js`): `people → /people/:slug`, `place → /places/:slug`, `object → /objects/:slug`. Heading links to the existing `/relationships` view.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/RelationshipsTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/RelationshipsTile.test.js`
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.css`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/RelationshipsTile.test.js`:

```jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RelationshipsTile from "../RelationshipsTile";

jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  hubType: "people",
  hubSlug: "alma2",
  hubName: "Alma the Younger",
  hubTitle: "High Priest",
  edges: [
    { rel: "father of", dstType: "people", dstSlug: "helaman", dstName: "Helaman", dstTitle: null, note: null, ref: null },
    { rel: "traveled to", dstType: "place", dstSlug: "zarahemla", dstName: "Zarahemla", dstTitle: "Capital city", note: "Returned to preach (Alma 5:1)", ref: "Alma 5:1" },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <RelationshipsTile data={d} />
    </MemoryRouter>
  );

describe("RelationshipsTile", () => {
  test("renders the hub linked to its profile", () => {
    renderTile(data);
    const hub = screen.getByText("Alma the Younger");
    expect(hub.closest("a").getAttribute("href")).toBe("/people/alma2");
  });

  test("renders edges with rel labels and profile links per dstType", () => {
    renderTile(data);
    expect(screen.getByText("father of")).toBeTruthy();
    expect(screen.getByText("Helaman").closest("a").getAttribute("href")).toBe("/people/helaman");
    expect(screen.getByText("Zarahemla").closest("a").getAttribute("href")).toBe("/places/zarahemla");
  });

  test("ref chip opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("Alma 5:1"));
    expect(openScripture).toHaveBeenCalledWith("Alma 5:1");
  });

  test("returns null with fewer than 2 edges", () => {
    const { container } = renderTile({ ...data, edges: data.edges.slice(0, 1) });
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --testPathPattern="RelationshipsTile" --watchAll=false`
Expected: FAIL — `Cannot find module '../RelationshipsTile'`.

- [ ] **Step 3: Implement the tile**

Create `frontend/webapp/src/views/Home/tiles/RelationshipsTile.js`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { openScripture } from "./ScripturePopup";

// entity-type → profile route (matches src/models/Routes.js)
const PROFILE_PATH = {
  people: (slug) => `/people/${slug}`,
  place: (slug) => `/places/${slug}`,
  object: (slug) => `/objects/${slug}`,
};
const profileTo = (type, slug) => (PROFILE_PATH[type] ? PROFILE_PATH[type](slug) : null);

/**
 * A connections card from bom_xrels: one hub entity and its typed relations,
 * every name deep-linking to the entity's profile. Notes render as subtitles;
 * a parsed scripture ref (when the note carried one) opens the popup.
 */
export default function RelationshipsTile({ data }) {
  const edges = (data?.edges || []).filter((e) => e?.dstName && e?.dstSlug);
  if (!data?.hubName || edges.length < 2) return null;
  const hubTo = profileTo(data.hubType, data.hubSlug);
  return (
    <div className="samplerTileInner relationshipsTile">
      <h3 className="tileHeading">
        <Link to="/relationships">{label("relationships")}</Link>
      </h3>
      {hubTo ? (
        <Link to={hubTo} className="relHub">{data.hubName}</Link>
      ) : (
        <span className="relHub">{data.hubName}</span>
      )}
      {data.hubTitle ? <div className="relHubTitle">{data.hubTitle}</div> : null}
      <ul className="relEdges">
        {edges.map((e, i) => {
          const to = profileTo(e.dstType, e.dstSlug);
          return (
            <li key={`${e.dstSlug}-${i}`} className="relEdge">
              <span className="relEdgeRel">{e.rel}</span>{" "}
              {to ? <Link to={to} className="relEdgeName">{e.dstName}</Link> : <span className="relEdgeName">{e.dstName}</span>}
              {e.ref ? (
                <button type="button" className="relEdgeRef" onClick={() => openScripture(e.ref)}>
                  {e.ref}
                </button>
              ) : null}
              {e.note ? <div className="relEdgeNote">{e.note}</div> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --testPathPattern="RelationshipsTile" --watchAll=false`
Expected: PASS (4 tests).

- [ ] **Step 5: Register the tile**

`registry.js`: add `import RelationshipsTile from "./RelationshipsTile";` and append:

```js
  { key: "relationship", component: RelationshipsTile, span: "tile-relationship", isReady: (p) => (p?.relationship?.edges?.length || 0) >= 2 },
```

`Sampler.js`: add `"relationship"` to `INFINITE_REGISTRY_KEYS`; add `est()` case: `case "relationship": return 18;`

`Sampler.css`, append:

```css
/* ---- relationships tile (wave 1) ---- */
.relationshipsTile .relHub { font-weight: 600; font-size: 1.1rem; }
.relationshipsTile .relHubTitle { font-size: 0.85rem; opacity: 0.75; }
.relationshipsTile .relEdges { list-style: none; padding: 0; margin: 0.6rem 0 0; }
.relationshipsTile .relEdge + .relEdge { margin-top: 0.55rem; }
.relationshipsTile .relEdgeRel { font-size: 0.85rem; opacity: 0.7; }
.relationshipsTile .relEdgeName { font-weight: 500; }
.relationshipsTile .relEdgeRef {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 0.8rem;
  opacity: 0.75;
  text-decoration: underline;
  cursor: pointer;
  margin-left: 0.35rem;
  padding: 0;
}
.relationshipsTile .relEdgeNote { font-size: 0.85rem; opacity: 0.8; }
```

- [ ] **Step 6: Run the Home suite**

Run: `CI=true npx react-scripts test --testPathPattern="Home" --watchAll=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Home/tiles/RelationshipsTile.js frontend/webapp/src/views/Home/tiles/__tests__/RelationshipsTile.test.js frontend/webapp/src/views/Home/tiles/registry.js frontend/webapp/src/views/Home/Sampler.js frontend/webapp/src/views/Home/Sampler.css
git commit -m "feat(sampler): RelationshipsTile — bom_xrels connections card in the infinite pool"
```

---

### Task 11: Frontend — MapStoryTile (static MVP, once per page)

A journey drawn as a static path: OpenLayers map (code-split like `MapTile`/`MapTileInner`) with a line through the ordered stops and numbered markers, plus a readable move list below. Placed ONCE per page at the tail of the first-batch masonry (below the fold) — NOT in the infinite pool, NOT in `RESERVE_POOL`.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/MapStoryTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js`
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js` (FIXED_TAIL placement + `est()`)
- Modify: `frontend/webapp/src/views/Home/Sampler.css`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js`:

```jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MapStoryTile from "../MapStoryTile";

// The inner map is OpenLayers — mock it out (jsdom has no canvas); the lazy
// import resolves to this stub.
jest.mock("../MapStoryTileInner", () => ({
  __esModule: true,
  default: () => <div data-testid="map-canvas" />,
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  slug: "lehis-journey",
  title: "Lehi's Journey",
  description: "From Jerusalem to the promised land",
  moves: [
    { seq: 1, start: "Jerusalem", end: "Valley of Lemuel", travelers: "Lehi's family", description: "Fled into the wilderness", duration: "3 days", ref: "1 Nephi 2:4", startLat: "18.1", startLng: "-97.2", endLat: "18.3", endLng: "-97.0" },
    { seq: 2, start: "Valley of Lemuel", end: "Bountiful", travelers: "Lehi's family", description: "Eight years in the wilderness", duration: "8 years", ref: "1 Nephi 17:4", startLat: "18.3", startLng: "-97.0", endLat: "18.6", endLng: "-96.7" },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <MapStoryTile data={d} />
    </MemoryRouter>
  );

describe("MapStoryTile", () => {
  test("renders the story title and ordered move list", () => {
    renderTile(data);
    expect(screen.getByText("Lehi's Journey")).toBeTruthy();
    expect(screen.getByText(/Jerusalem → Valley of Lemuel/)).toBeTruthy();
    expect(screen.getByText(/Valley of Lemuel → Bountiful/)).toBeTruthy();
  });

  test("move ref opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("1 Nephi 2:4"));
    expect(openScripture).toHaveBeenCalledWith("1 Nephi 2:4");
  });

  test("renders the lazy map canvas", async () => {
    renderTile(data);
    expect(await screen.findByTestId("map-canvas")).toBeTruthy();
  });

  test("returns null with fewer than 2 moves", () => {
    const { container } = renderTile({ ...data, moves: data.moves.slice(0, 1) });
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --testPathPattern="MapStoryTile" --watchAll=false`
Expected: FAIL — `Cannot find module '../MapStoryTile'`.

- [ ] **Step 3: Implement the shell tile**

Create `frontend/webapp/src/views/Home/tiles/MapStoryTile.js`:

```jsx
import React, { Suspense } from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { openScripture } from "./ScripturePopup";

// Code-split: OpenLayers loads only when this tile actually renders — same
// pattern as MapTile/MapTileInner.
const MapStoryTileInner = React.lazy(() => import("./MapStoryTileInner"));

/**
 * A scripture journey as a STATIC path on the internal map (MVP: numbered
 * stops + connecting line, no animation) with a readable move list below.
 * Rendered once per page at the masonry tail — below the fold, never repeated
 * by the infinite feed.
 */
export default function MapStoryTile({ data }) {
  const moves = (data?.moves || []).filter((m) => m?.start && m?.end);
  if (moves.length < 2) return null;
  return (
    <div className="samplerTileInner mapStoryTile">
      <h3 className="tileHeading">
        <Link to="/map">{label("map")}</Link>
      </h3>
      {data.title ? <div className="mapStoryTitle">{data.title}</div> : null}
      <div className="mapTileFrame">
        <Suspense fallback={<div className="mapTileLoading">…</div>}>
          <MapStoryTileInner moves={moves} />
        </Suspense>
      </div>
      <ol className="mapStoryMoves">
        {moves.map((m) => (
          <li key={m.seq} className="mapStoryMove">
            <span className="mapStoryLeg">{m.start} → {m.end}</span>
            {m.ref ? (
              <button type="button" className="mapStoryRef" onClick={() => openScripture(m.ref)}>
                {m.ref}
              </button>
            ) : null}
            {m.description ? <div className="mapStoryDesc">{m.description}</div> : null}
          </li>
        ))}
      </ol>
      <Link to="/map" className="mapTileCta tileMoreLink">{label("view_more")}</Link>
    </div>
  );
}
```

- [ ] **Step 4: Implement the OpenLayers inner**

Create `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js`:

```jsx
import React, { useEffect, useRef } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import { Style, Stroke, Fill, Text, Circle as CircleStyle } from "ol/style";
import * as OlProj from "ol/proj";
import * as Interaction from "ol/interaction";
import "ol/ol.css";

// Same FARMS "internal" model as MapTileInner — a non-geographic tile
// projection; lat/lng here are its own coordinates, not real geography.
const SLUG = "internal";
const MIN_ZOOM = 6;
const MAX_ZOOM = 10;

/** Ordered journey coordinates: first move's start, then every move's end. */
const pathCoords = (moves) => {
  const coords = [];
  moves.forEach((m, i) => {
    if (i === 0) coords.push(OlProj.fromLonLat([Number(m.startLng), Number(m.startLat)]));
    coords.push(OlProj.fromLonLat([Number(m.endLng), Number(m.endLat)]));
  });
  return coords;
};

const stopStyle = (n) =>
  new Style({
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: "#8b1e1e" }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
    text: new Text({
      text: String(n),
      fill: new Fill({ color: "#ffffff" }),
      font: "bold 11px sans-serif",
    }),
  });

/**
 * Static journey path on the internal map: one LineString through the ordered
 * stops plus numbered circle markers, view fitted to the path extent. Loaded
 * lazily (React.lazy in MapStoryTile) so OL never ships on pages without it.
 */
export default function MapStoryTileInner({ moves }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined;
    const coords = pathCoords(moves);
    const line = new Feature({ geometry: new LineString(coords) });
    line.setStyle(new Style({ stroke: new Stroke({ color: "#8b1e1e", width: 3, lineDash: [8, 6] }) }));
    const stops = coords.map((c, i) => {
      const f = new Feature({ geometry: new Point(c) });
      f.setStyle(stopStyle(i + 1));
      return f;
    });
    const vector = new VectorLayer({ source: new VectorSource({ features: [line, ...stops] }) });
    mapRef.current = new Map({
      target: elRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: `${assetUrl}/map/${SLUG}/{z}/{x}/{y}`,
            tilePixelRatio: 2,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
          }),
        }),
        vector,
      ],
      view: new View({ center: coords[0], zoom: MIN_ZOOM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }),
      controls: [],
      interactions: Interaction.defaults({ mouseWheelZoom: false }),
    });
    mapRef.current.getView().fit(line.getGeometry().getExtent(), {
      padding: [28, 28, 28, 28],
      maxZoom: MAX_ZOOM,
    });
    const map = mapRef.current;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [moves]);
  return <div ref={elRef} className="mapTileCanvas" />;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npx react-scripts test --testPathPattern="MapStoryTile" --watchAll=false`
Expected: PASS (4 tests — the Inner is mocked, so OL never loads in jsdom).

- [ ] **Step 6: Register + place once per page**

`registry.js`: add `import MapStoryTile from "./MapStoryTile";` and append:

```js
  { key: "mapstory",    component: MapStoryTile,    span: "tile-mapstory",    isReady: (p) => (p?.mapstory?.moves?.length || 0) >= 2 },
```

`Sampler.js` — three edits:

6a. After `const FIXED_TOP = ["people"];` (line 57), add:

```js
// FIXED_TAIL renders once at the END of the first-batch masonry — the feature
// tile slot (map-story). Below the fold, never repeated by the infinite feed.
const FIXED_TAIL = ["mapstory"];
```

6b. Exclude it from the variable shuffle — BOTH occurrences (initial state ~line 127 and `resample` ~line 160) change from:

```js
shuffle(tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key)))
```

to:

```js
shuffle(tileRegistry.filter((t) => !FIXED_LEFT.includes(t.key) && !FIXED_TOP.includes(t.key) && !FIXED_TAIL.includes(t.key)))
```

6c. In the return JSX, the Masonry children array (currently `orderedGrid → reserves → mainInfinite`) gains the tail between orderedGrid and the reserves:

```jsx
            {[
              ...orderedGrid.map((t) => renderTile(t)),
              ...FIXED_TAIL.map((k) => tileRegistry.find((t) => t.key === k))
                .filter(Boolean)
                .map((t) => renderTile(t)),
              ...reserves.filter((r) => r.side === "main").map(renderReserve),
              ...mainInfinite,
            ].filter(Boolean)}
```

6d. Add the `est()` case: `case "mapstory": return 40;`

`Sampler.css`, append:

```css
/* ---- map-story tile (wave 1) ---- */
.mapStoryTile .mapStoryTitle { font-weight: 600; margin-bottom: 0.4rem; }
.mapStoryTile .mapTileFrame { height: 260px; }
.mapStoryTile .mapStoryMoves { padding-left: 1.2rem; margin: 0.6rem 0 0; }
.mapStoryTile .mapStoryMove + .mapStoryMove { margin-top: 0.5rem; }
.mapStoryTile .mapStoryLeg { font-weight: 500; }
.mapStoryTile .mapStoryRef {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 0.8rem;
  opacity: 0.75;
  text-decoration: underline;
  cursor: pointer;
  margin-left: 0.35rem;
  padding: 0;
}
.mapStoryTile .mapStoryDesc { font-size: 0.85rem; opacity: 0.8; }
```

- [ ] **Step 7: Run the Home suite**

Run: `CI=true npx react-scripts test --testPathPattern="Home" --watchAll=false`
Expected: PASS — registry contract covers the new entry; Sampler tests must still pass with the FIXED_TAIL exclusion.

- [ ] **Step 8: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Home/tiles/MapStoryTile.js frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js frontend/webapp/src/views/Home/tiles/registry.js frontend/webapp/src/views/Home/Sampler.js frontend/webapp/src/views/Home/Sampler.css
git commit -m "feat(sampler): MapStoryTile — static journey path, once per page at the masonry tail"
```

---

### Task 12: Integration verification

Full suites + live-page verification on the dev host.

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run`
Expected: everything passes EXCEPT the 10 pre-existing `test/messaging/*` DB-integration failures (they predate this work; unrelated). `test/graphql/socket.test.ts` skips (no MESSENGER_TEST_TOKEN). Any NEW failure is a regression — fix before proceeding.

- [ ] **Step 2: Full frontend Home + tiles suites**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --testPathPattern="(Home|_Common)" --watchAll=false`
Expected: all pass, including the 5 new tile test files. (There are 8 pre-existing failures elsewhere in the frontend suite — outside this pattern — that predate this work.)

- [ ] **Step 3: Restart the backend and verify live payload**

```bash
systemctl --user restart bom-greenfield && sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5006/en   # expect 200 or 400 (GET on a POST endpoint is fine — service is up)
```

Then re-run the Task 6 Step 2 node fetch snippet. Expected: all five fields non-null.

- [ ] **Step 4: Verify the rendered page**

Load `http://localhost:8200/home` (NOT bom.kckern.net — CDN cache). Confirm, over a couple of resamples (↻ button) and a long scroll:

1. Notes / verse-fax / cross-refs / relationships tiles appear among the variable tiles AND repeat with fresh content in infinite-scroll batches.
2. The map-story tile appears exactly ONCE, below the fold, with a dashed path + numbered stops + move list; it does NOT reappear in later batches.
3. Ref chips open the scripture popup; entity links navigate to `/people/...`, `/places/...`, `/objects/...`; fax page links open `/fax/:version/:page`.
4. No console errors (React key warnings from NarrationTile:71 are pre-existing).

A Playwright pass is available if preferred: chromium at `/usr/bin/chromium-browser`, playwright-core in `frontend/next/node_modules`, and homesampler responses take 3-9s — wait accordingly before asserting tiles.

- [ ] **Step 5: Update the spec status + commit**

In `docs/specs/2026-07-16-home-sampler-wave1-tiles-design.md`, change `**Status:** Approved design → ready for implementation plan` to `**Status:** Implemented (see docs/plans/2026-07-16-home-sampler-wave1-tiles.md)`. Also correct the spec's "reviving a built-but-unregistered map tile" framing if desired — `MapTile` was in fact live via `RESERVE_POOL`; `MapStoryTile` is new alongside it.

```bash
cd /home/bom/BookofMormonOnline
git add docs/specs/2026-07-16-home-sampler-wave1-tiles-design.md
git commit -m "docs(sampler): mark wave-1 tiles spec implemented"
```

Do NOT push. Report results (including the homesampler timing from Task 5 Step 5) to KC.
