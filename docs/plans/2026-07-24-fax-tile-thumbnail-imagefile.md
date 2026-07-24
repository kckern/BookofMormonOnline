# Fax Tile Thumbnail (image-file) Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `FaxTile` home-sampler thumbnail, which shows the wrong scan for offset editions because it uses the printed-folio number as an image-file number.

**Architecture:** The home-sampler's `faxPages` now returns only `page` (the printed folio for indexed editions, per `bom_xtras_fax_index.page`). Since folio became the canonical route identity, `FaxTile`'s deep-link + reference are correct, but its thumbnail asset (`/fax/thumb/{slug}/{NNN}`) is keyed by the **image-file** number, which differs from the folio by the per-edition scan offset. Fix at the source: the sampler emits an `imageFile` field alongside `page`, and `FaxTile` uses `imageFile` for the thumbnail only.

**Tech Stack:** Backend — TypeScript, graphql-yoga (SDL in `backend/schema/*.graphql` + `graphql-codegen`), Kysely/MySQL, **vitest** (`npm test`, integration tests hit the read DB). Frontend — React 17 CRA.

**Background / evidence (verified 2026-07-24):**
- `imageFile = bom_xtras_fax_index.page + offset`, where `offset = imageScanMeta(slug).offset = pgfirstVerse − MIN(page)` (`backend/src/media/fax/resolve.ts:61`). For indexed editions `sampleFaxPages` returns `page` = `bom_xtras_fax_index.page` = the **printed folio**.
- Live proof (1837, offset −4): `homesampler` returns `faxPages: [{page:12, ref:"1 Nephi 1:5-16"}, …]`. Viewer `/fax/1837/12` (folio 12) loads image-file **008.jpg** with ref "1 Nephi 1:5-16" — correct. But `FaxTile` builds the thumbnail `/fax/thumb/1837/012.jpg` (image-file 12) — a 4-page mismatch.
- Offset-0 editions (1830 −6? no; 1841 = 0) where folio == image-file are unaffected; the bug only shows on offset≠0 editions.
- The SSoT context: `docs/audits/2026-07-24-fax-page-numbering-ssot.md`.

**Scope notes (out of scope, verified):**
- `FaxVerseTile` is unaffected — its link is a scripture-ref slug (goes through the viewer's `isReference` branch), and its crop image is a dynamic `/fax/render/.../{selector}.jpg` (offset-independent). Its `ed.page` fallback only fires when there is no ref, which never happens for a verse tile.
- The next sitemap emits only edition-level `/fax/{slug}` (no page numbers) — unaffected.
- Un-indexed editions: `sampleFaxPages.page` is already the image-file number and the viewer treats their slugs as image-file (no index → `faxOffset` 0), so `imageFile` must equal `page` for them (do NOT add offset).

---

## File Structure

**Modify:**
- `backend/schema/HomeSampler.graphql` — add `imageFile: Int` to `type FaxPageRef`.
- `backend/codegen/graphql.ts` — regenerated (not hand-edited) via `npm run codegen:graphql`.
- `backend/src/graphql/resolvers/homesampler.ts` — `sampleFaxPages` returns `imageFile` per page.
- `frontend/webapp/src/models/GraphQLQueries.js` — request `imageFile` in the `faxPages` selection.
- `frontend/webapp/src/views/Home/tiles/FaxTile.js` — thumbnail uses `p.imageFile`.

**Create:**
- `backend/test/graphql/faxpage-imagefile.test.ts` — asserts the `imageFile`/`page` relationship.

---

## Task 1: Backend — `FaxPageRef.imageFile`

**Files:**
- Modify: `backend/schema/HomeSampler.graphql` (type `FaxPageRef`)
- Modify: `backend/src/graphql/resolvers/homesampler.ts` (`sampleFaxPages`, imports)
- Regen: `backend/codegen/graphql.ts` (via script)
- Test: `backend/test/graphql/faxpage-imagefile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/test/graphql/faxpage-imagefile.test.ts`:

```typescript
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';
import { imageScanMeta } from '../../src/media/fax/resolve.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;

beforeAll(async () => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
  await db.selectFrom('bom_people').select('slug').limit(1).execute();
});
afterAll(async () => { await closeDb(); });

const QUERY = /* GraphQL */ `
  query FaxPages($seed: Int) {
    homesampler(seed: $seed) {
      fax { slug }
      faxPages { page imageFile ref }
    }
  }
`;

type Sample = {
  fax: { slug: string } | null;
  faxPages: { page: number; imageFile: number; ref: string | null }[];
};

async function exec(seed: number): Promise<Sample> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { seed } }),
  });
  const body = (await res.json()) as { data?: { homesampler: Sample }; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data!.homesampler;
}

describe('faxPages.imageFile', () => {
  it('an INDEXED edition maps imageFile = page + scan offset', async () => {
    // Scan deterministic seeds for a sample that carries refs (indexed edition).
    let indexed: Sample | null = null;
    for (let seed = 1; seed <= 30 && !indexed; seed++) {
      const s = await exec(seed);
      if (s.faxPages.length && s.faxPages.every((p) => p.ref)) indexed = s;
    }
    expect(indexed, 'no indexed edition sampled in seeds 1..30').toBeTruthy();
    const { offset } = await imageScanMeta(String(indexed!.fax!.slug));
    for (const p of indexed!.faxPages) {
      expect(p.imageFile).toBe(p.page + offset);
    }
  });

  it('an UN-INDEXED edition sets imageFile = page (no offset applied)', async () => {
    let unindexed: Sample | null = null;
    for (let seed = 1; seed <= 60 && !unindexed; seed++) {
      const s = await exec(seed);
      if (s.faxPages.length && s.faxPages.every((p) => p.ref === null)) unindexed = s;
    }
    // Un-indexed editions are rare in the sampler; only assert if one was found.
    if (unindexed) {
      for (const p of unindexed.faxPages) expect(p.imageFile).toBe(p.page);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/faxpage-imagefile.test.ts`
Expected: FAIL — the query errors with `Cannot query field "imageFile" on type "FaxPageRef"` (the SDL field doesn't exist yet).

- [ ] **Step 3: Add the SDL field**

In `backend/schema/HomeSampler.graphql`, change:

```graphql
type FaxPageRef {
  page: Int
  ref: String
}
```

to:

```graphql
type FaxPageRef {
  page: Int
  imageFile: Int
  ref: String
}
```

- [ ] **Step 4: Regenerate GraphQL codegen types**

Run: `cd /home/bom/BookofMormonOnline/backend && npm run codegen:graphql`
Expected: `backend/codegen/graphql.ts` now shows `imageFile?: Maybe<Scalars['Int']…>` inside `export type FaxPageRef`. Do NOT hand-edit the file. Confirm:

Run: `grep -A4 "export type FaxPageRef" codegen/graphql.ts`
Expected: the block includes an `imageFile` line.

- [ ] **Step 5: Emit `imageFile` from the resolver**

In `backend/src/graphql/resolvers/homesampler.ts`, add the import near the other fax imports (after line 17 `import { canonicalSelector } …`):

```typescript
import { imageScanMeta } from '../../media/fax/resolve.js';
```

Replace the indexed-branch return (currently):

```typescript
  if (rows.length) {
    const start = seed % rows.length;
    const picks = [rows[start], rows[(start + 1) % rows.length]]
      .filter((r, i, a) => r && a.findIndex((x) => x?.page === r.page) === i);
    return picks.map((r) => ({
      page: Number(r!.page),
      // the full verse SPAN the page covers (first→last indexed verse), rendered
      // as a compact range like "Alma 26:1-30:4"
      ref: pageRangeRef(Number(r!.firstVerse), Number(r!.lastVerse)),
    }));
  }
```

with:

```typescript
  if (rows.length) {
    const start = seed % rows.length;
    const picks = [rows[start], rows[(start + 1) % rows.length]]
      .filter((r, i, a) => r && a.findIndex((x) => x?.page === r.page) === i);
    // `page` is the printed folio (bom_xtras_fax_index.page, the canonical route
    // identity). The thumbnail asset is keyed by the scan image-file number, which
    // differs by the per-edition offset: imageFile = folio + offset.
    const { offset } = await imageScanMeta(String(fax.slug));
    return picks.map((r) => ({
      page: Number(r!.page),
      imageFile: Number(r!.page) + offset,
      // the full verse SPAN the page covers (first→last indexed verse), rendered
      // as a compact range like "Alma 26:1-30:4"
      ref: pageRangeRef(Number(r!.firstVerse), Number(r!.lastVerse)),
    }));
  }
```

Replace the un-indexed-branch return (currently):

```typescript
  const pages = [mid, Math.min(total, mid + 1)].filter((v, i, a) => a.indexOf(v) === i);
  return pages.map((p) => ({ page: p, ref: null }));
```

with:

```typescript
  const pages = [mid, Math.min(total, mid + 1)].filter((v, i, a) => a.indexOf(v) === i);
  // Un-indexed editions have no folio index; `page` is already the image-file
  // number and the viewer treats their slugs as image-file (no offset), so the
  // thumbnail key equals the page number.
  return pages.map((p) => ({ page: p, imageFile: p, ref: null }));
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/faxpage-imagefile.test.ts`
Expected: PASS (the indexed assertion holds; the un-indexed assertion passes or is skipped when none sampled).

- [ ] **Step 7: Type-check the backend**

Run: `cd /home/bom/BookofMormonOnline/backend && npx tsc --noEmit`
Expected: no new errors from `homesampler.ts` (the `imageScanMeta` import resolves; the returned object shape is accepted).

- [ ] **Step 8: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/HomeSampler.graphql backend/codegen/graphql.ts backend/src/graphql/resolvers/homesampler.ts backend/test/graphql/faxpage-imagefile.test.ts
git commit -m "feat(fax): expose imageFile on homesampler faxPages (folio vs scan file)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Frontend — `FaxTile` thumbnail uses `imageFile`

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` (line ~1783, `faxPages` selection)
- Modify: `frontend/webapp/src/views/Home/tiles/FaxTile.js` (thumbnail `nnn`)

No new unit test (there is no test harness for the home tiles); verified by Task 3.

- [ ] **Step 1: Request `imageFile` in the sampler query**

In `frontend/webapp/src/models/GraphQLQueries.js`, change the line (currently):

```javascript
        faxPages { page ref }
```

to:

```javascript
        faxPages { page imageFile ref }
```

- [ ] **Step 2: Use `imageFile` for the thumbnail only**

In `frontend/webapp/src/views/Home/tiles/FaxTile.js`, find (line ~37):

```javascript
            const nnn = String(p.page).padStart(3, "0");
```

and change it to:

```javascript
            // Thumbnail is keyed by the scan image-file number; the deep-link and
            // the "p. N" label stay on p.page (the printed folio, canonical route id).
            const nnn = String(p.imageFile ?? p.page).padStart(3, "0");
```

Leave the `<Link to={`/fax/${data.slug}/${p.page}`}>` and the `p. {p.page}` label unchanged — those correctly use the folio.

- [ ] **Step 3: Verify the frontend bundle compiles**

Run: `journalctl --user -u bom-dev --since "40 seconds ago" --no-pager | grep -iE "Compiled|ERROR in" | tail -4`
Expected: `Compiled with warnings.` (the pre-existing node_modules source-map warnings) and no new `ERROR in`.

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/models/GraphQLQueries.js frontend/webapp/src/views/Home/tiles/FaxTile.js
git commit -m "fix(fax): FaxTile thumbnail uses image-file, not the folio page number

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Verification (thumbnail matches the linked page)

**Files:** none (verification only).

- [ ] **Step 1: Confirm the sampler now returns `imageFile`**

Run:
```bash
curl -s -X POST http://localhost:5006/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ homesampler(seed:3){ fax{slug} faxPages{ page imageFile ref } } }"}'
```
Expected: each `faxPages` entry has both `page` and `imageFile`. For an offset≠0 indexed edition they differ; for offset-0 (e.g. 1841) they are equal.

- [ ] **Step 2: Cross-check against the viewer for an offset edition**

Find a seed that samples an offset≠0 indexed edition (e.g. 1837/1879/1920/2013), read one `faxPages` entry `{page, imageFile}`, and confirm:
- the viewer at `/fax/{slug}/{page}` (folio) loads the scan file `{imageFile}` (padded to 3 digits) as its page image;
- the thumbnail URL `https://media.bookofmormon.online/fax/thumb/{slug}/{imageFile padded}.jpg` is the SAME page.

Playwright snippet (adjust slug/page/imageFile from Step 1's output; example uses 1837 folio 12 → image-file 8):
```javascript
const { chromium } = require('/home/bom/BookofMormonOnline/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1280,height:900}});
  await p.goto('http://localhost:8200/fax/1837/12', { waitUntil:'networkidle' });
  await p.waitForTimeout(2200);
  const file = await p.$eval('.page.leftPage img', e => (e.getAttribute('src')||'').match(/\/(\d{3})\.[a-z]+$/)?.[1]);
  console.log('viewer image-file for folio 12:', file, '(expect 008)');
  await b.close();
})();
```
Expected: the viewer's image-file for the folio equals the sampler's `imageFile` for that page (008 for 1837 folio 12).

- [ ] **Step 3: Confirm offset-0 editions are unchanged**

Sample an offset-0 edition (1841) and confirm `page === imageFile` for its `faxPages` (no behavior change there).

- [ ] **Step 4: Commit any verification fixes** (only if Steps 1–3 surfaced issues; otherwise skip)

```bash
git add -A
git commit -m "fix(fax): tile thumbnail verification fixes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** The single defect (FaxTile thumbnail keyed by folio instead of image-file) is fixed at the source (Task 1 backend `imageFile`) and consumed correctly (Task 2 frontend). `FaxVerseTile`, the sitemap, and un-indexed editions are shown out of scope with evidence. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact before/after; test code is complete; commands are concrete. ✓

**Type/name consistency:** `imageFile` (Int) is added to the SDL `FaxPageRef`, regenerated in codegen, returned by `sampleFaxPages` in both branches, selected in `GraphQLQueries.js`, and read as `p.imageFile` in `FaxTile.js`. The link + label keep `p.page`. `imageScanMeta(slug).offset` is the same offset used by the viewer (`faxIndex.offset`) and the boxes route, so the identity is consistent end-to-end. ✓
