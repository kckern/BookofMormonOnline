# Facsimile-Highlight Render API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-codebase Fastify endpoint that dynamically renders Book of Mormon facsimile highlight images (full-page-dimmed and cropped) from `bom_xtras_fax_index` geometry, backed by cache-aside S3 writes, with a legacy-compat alias for the existing `fax/text/...` consumers.

**Architecture:** A pure render core (`backend/src/media/fax/`) — geometry math, verse resolution, canonicalization, and `sharp` compositing — with buffers/geometry in and buffers out, wrapped by a thin Fastify route that validates input, runs the pipeline, streams the image, and writes back to S3 asynchronously. CloudFront serves cache hits statically and fails over to the route on a miss (infra wiring is out of scope for this plan).

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Fastify 5, Kysely (`getDb()`), `sharp` 0.33.5, `scripture-guide`, `@aws-sdk/client-s3` (already used in `src/media/s3.ts`), `@fastify/rate-limit` (new dep), Vitest.

**Design spec:** `docs/specs/2026-07-18-fax-render-api-design.md` (v3). Read it first.

**Conventions in this codebase:**
- ESM: every relative import ends in `.js` even for `.ts` files (e.g. `import { x } from './geometry.js'`).
- Tests live in `backend/test/**` and run with `npm test` (`vitest run`) from `backend/`. Integration tests may hit the live remote DB (env from `backend/.env`).
- DB access: `import { getDb } from '../../data/db.js'` → `getDb().selectFrom(...)` (Kysely, table `bom_xtras_fax_index` typed in `codegen/db.d.ts`).
- `scripture-guide`: `import { lookupReference, generateReference } from 'scripture-guide'` (named exports; frontend uses these).

**Two deferred design unknowns (resolved by Task 1, the spike — do it first):**
1. Notch sign convention (`TLW/TLH` top-left vs `BRW/BRH` bottom-right).
2. The column-overlap ε tolerance.

---

## File Structure

```
backend/src/media/fax/
  types.ts        # shared types: FaxBox, Fragment, RenderMode, RenderInput, Selector
  geometry.ts     # sanitizeBoxes, dedupeBoxes, clusterColumns, orderReadingRuns, clampPages
  canonical.ts    # slugify, deslugify, canonicalizeSelector (round-trip gated)
  resolve.ts      # selectorToVerseIds (ids | ref | legacy heading), verseIdsToBoxes (Kysely)
  scan.ts         # fetchScan (S3/HTTP) + assertScanWidth
  render.ts       # renderCrop, renderPage, stitch  (pure, sharp)
  cache.ts        # FaxRenderCache: keyFor, writeBack (retry), inFlight coalescing
  route.ts        # Fastify plugin: /fax/render/* and /fax/text/* (alias)
  constants.ts    # VERSION_SLUGS, WIDTH_WHITELIST, DEFAULTS, DIM_OPACITY
backend/test/fax/
  geometry.test.ts, canonical.test.ts, resolve.test.ts, render.test.ts,
  cache.test.ts, route.test.ts, golden.test.ts
```

Registration: add one line to `backend/src/index.ts` and new env vars to `backend/src/config/env.ts`.

---

## Phase 1 — Pure core (no S3, no Fastify)

### Task 1: Spike — lock the notch convention and column ε (visual, no test)

**Files:**
- Create: `backend/scripts/fax-spike.mjs` (throwaway; delete after)

- [ ] **Step 1: Write a spike script that crops a known verse box and draws its notches**

```js
// backend/scripts/fax-spike.mjs — run with: node backend/scripts/fax-spike.mjs
// Purpose: determine which corner TLW/TLH vs BRW/BRH cut, and eyeball column ε.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import sharp from 'sharp';

const c = await mysql.createConnection({
  host: process.env.MYSQL_HOST, port: +process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DB,
});
// 1837 verse 31103, page 11 (single box, TL=0/0, BR=458/22)
const [[b]] = await c.query(
  `SELECT page+0 page,pageWidth,X,Y,W,H,TLW,TLH,BRW,BRH FROM bom_xtras_fax_index
   WHERE version='1837' AND verse_id='31103'`);
const url = `https://media.bookofmormon.online/fax/pages/1837/${String(b.page).padStart(3,'0')}.jpg`;
const scan = Buffer.from(await (await fetch(url)).arrayBuffer());
// Draw the full box (red), the TL notch rect (blue), the BR notch rect (green).
const svg = Buffer.from(
  `<svg width="${b.pageWidth}" height="2000">
     <rect x="${b.X}" y="${b.Y}" width="${b.W}" height="${b.H}" fill="none" stroke="red" stroke-width="4"/>
     <rect x="${b.X}" y="${b.Y}" width="${b.TLW}" height="${b.TLH}" fill="blue" fill-opacity="0.5"/>
     <rect x="${b.X + b.W - b.BRW}" y="${b.Y + b.H - b.BRH}" width="${b.BRW}" height="${b.BRH}" fill="green" fill-opacity="0.5"/>
   </svg>`);
const meta = await sharp(scan).metadata();
await sharp(scan).composite([{ input: svg, top: 0, left: 0 }]).extract({ left: 0, top: b.Y - 20, width: meta.width, height: b.H + 40 }).toFile('/tmp/fax-spike.png');
console.log('box', b, 'scan', meta.width + 'x' + meta.height);
await c.end();
```

- [ ] **Step 2: Run it and inspect the image**

Run: `cd backend && node scripts/fax-spike.mjs`
Then open `/tmp/fax-spike.png` (or Read it). Confirm: does the **blue** rect (TL notch) sit over blank paper at the *start* of the verse's first line, and the **green** rect (BR notch) over blank paper at the *end* of the last line? Record the answer as a comment in `constants.ts` (Task 2). The crop paper-fill in Task 12 fills exactly these two rects.

- [ ] **Step 3: Eyeball column ε using verse 34284**

Add a second query for `version='2013' verse_id='34284'` (3 boxes, two columns). Log the X-intervals `[X, X+W]`. Confirm the left `[56,341]` and right `[357,646]` intervals are disjoint, and pick `EPSILON_PX` (small, e.g. 4) that keeps them separate while a single-column page's fragments overlap. Record `EPSILON_PX` in `constants.ts`.

- [ ] **Step 4: Delete the spike**

```bash
rm backend/scripts/fax-spike.mjs
```

---

### Task 2: Types and constants

**Files:**
- Create: `backend/src/media/fax/types.ts`
- Create: `backend/src/media/fax/constants.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
// backend/src/media/fax/types.ts
export type RenderMode = 'page' | 'crop';
export type OutputExt = 'jpg' | 'webp';

/** A verse box as stored, already sanitized (non-negative, clipped, non-zero). */
export interface FaxBox {
  verseId: number;
  page: number;        // integer (zero-fill happens at the S3 key boundary)
  pageWidth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  tlw: number; tlh: number;   // top-left notch (verse starts mid-line)
  brw: number; brh: number;   // bottom-right notch (verse ends mid-line)
}

/** A maximal merged vertical run within one (page, column), in reading order. */
export interface Fragment {
  page: number;
  pageWidth: number;
  x: number; y: number; w: number; h: number;   // union bbox of the run
  boxes: FaxBox[];                                // members, verse-id ascending
}

export interface RenderInput {
  version: string;
  verseIds: number[];   // sorted ascending, de-duplicated
  mode: RenderMode;
  width: number | 'full';
  ext: OutputExt;
}
```

- [ ] **Step 2: Write `constants.ts`**

```ts
// backend/src/media/fax/constants.ts
export const VERSION_SLUGS = [
  '1829', '1830', '1837', '1840', '1841', '1879', '1920', '1981', '2013',
  'earliest', 'poetic', 'printer', 'rebom',
] as const;
export type VersionSlug = (typeof VERSION_SLUGS)[number];

export const WIDTH_WHITELIST = [200, 400, 800, 1600] as const; // plus 'full'
export const MAX_PAGES = 5;            // clamp
export const MAX_VERSE_IDS = 40;       // ids/ selector cap (K)
export const DIM_OPACITY = 0.55;       // page-mode dark overlay
export const JPEG_QUALITY = 82;
export const EPSILON_PX = 4;           // column overlap tolerance — SET FROM Task 1 spike
export const DEDUPE_PX = 2;            // near-duplicate box corner tolerance

// Notch convention (confirmed in Task 1 spike):
//   TL notch rect = [X, Y, TLW, TLH] (top-left corner of the box)
//   BR notch rect = [X + W - BRW, Y + H - BRH, BRW, BRH] (bottom-right corner)
// If the spike proved otherwise, correct this comment AND render.ts Task 11.

export const MEDIA_BASE = 'https://media.bookofmormon.online';
export function pageKey(version: string, page: number): string {
  return `fax/pages/${version}/${String(page).padStart(3, '0')}.jpg`;
}
```

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/media/fax/types.ts src/media/fax/constants.ts && \
git commit -m "feat(fax): render module types and constants"
```

---

### Task 3: `geometry.ts` — sanitize boxes

**Files:**
- Create: `backend/src/media/fax/geometry.ts`
- Test: `backend/test/fax/geometry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/fax/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeBoxes } from '../../src/media/fax/geometry.js';
import type { FaxBox } from '../../src/media/fax/types.js';

const raw = (o: Partial<FaxBox>): FaxBox => ({
  verseId: 1, page: 1, pageWidth: 800, x: 0, y: 0, w: 100, h: 20,
  tlw: 0, tlh: 0, brw: 0, brh: 0, ...o,
});

describe('sanitizeBoxes', () => {
  it('clamps negative X/Y to 0', () => {
    const [b] = sanitizeBoxes([raw({ x: -3, y: -1 })]);
    expect(b.x).toBe(0); expect(b.y).toBe(0);
  });
  it('clamps negative notches to 0', () => {
    const [b] = sanitizeBoxes([raw({ brw: -1 })]);
    expect(b.brw).toBe(0);
  });
  it('clips width to the page bound', () => {
    const [b] = sanitizeBoxes([raw({ x: 750, w: 100, pageWidth: 800 })]);
    expect(b.x + b.w).toBe(800);
  });
  it('drops zero-size boxes', () => {
    expect(sanitizeBoxes([raw({ w: 0, h: 0 })])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: FAIL (`sanitizeBoxes` is not exported / file missing).

- [ ] **Step 3: Implement `sanitizeBoxes`**

```ts
// backend/src/media/fax/geometry.ts
import type { FaxBox } from './types.js';

/** Clamp negatives, clip to page width, drop zero-size boxes. Height has no
 * stored page bound, so H is only floored at 0 via the drop rule. */
export function sanitizeBoxes(boxes: FaxBox[]): FaxBox[] {
  const out: FaxBox[] = [];
  for (const b0 of boxes) {
    const x = Math.max(0, b0.x);
    const y = Math.max(0, b0.y);
    let w = b0.w - (x - b0.x);
    let h = b0.h - (y - b0.y);
    if (x + w > b0.pageWidth) w = b0.pageWidth - x;
    if (w <= 0 || h <= 0) continue;
    out.push({
      ...b0, x, y, w, h,
      tlw: Math.max(0, b0.tlw), tlh: Math.max(0, b0.tlh),
      brw: Math.max(0, b0.brw), brh: Math.max(0, b0.brh),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/geometry.ts test/fax/geometry.test.ts && \
git commit -m "feat(fax): sanitizeBoxes — clamp/clip/drop bad geometry"
```

---

### Task 4: `geometry.ts` — dedupe near-identical boxes

**Files:**
- Modify: `backend/src/media/fax/geometry.ts`
- Test: `backend/test/fax/geometry.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to geometry.test.ts
import { dedupeBoxes } from '../../src/media/fax/geometry.js';

describe('dedupeBoxes', () => {
  it('merges boxes within DEDUPE_PX on all corners (same verse)', () => {
    const a = raw({ verseId: 5, x: 357, y: 70, w: 289, h: 87 });
    const b = raw({ verseId: 5, x: 357, y: 71, w: 289, h: 86 });
    expect(dedupeBoxes([a, b])).toHaveLength(1);
  });
  it('keeps legitimately distinct boxes of the same verse', () => {
    const a = raw({ verseId: 5, x: 56, y: 795, w: 285, h: 54 });
    const b = raw({ verseId: 5, x: 357, y: 70, w: 289, h: 87 });
    expect(dedupeBoxes([a, b])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: FAIL (`dedupeBoxes` not exported).

- [ ] **Step 3: Implement `dedupeBoxes`**

```ts
// add to geometry.ts
import { DEDUPE_PX } from './constants.js';

export function dedupeBoxes(boxes: FaxBox[]): FaxBox[] {
  const kept: FaxBox[] = [];
  const near = (a: FaxBox, b: FaxBox) =>
    a.verseId === b.verseId && a.page === b.page &&
    Math.abs(a.x - b.x) <= DEDUPE_PX && Math.abs(a.y - b.y) <= DEDUPE_PX &&
    Math.abs(a.w - b.w) <= DEDUPE_PX && Math.abs(a.h - b.h) <= DEDUPE_PX;
  for (const b of boxes) {
    if (!kept.some((k) => near(k, b))) kept.push(b);
  }
  return kept;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/geometry.ts test/fax/geometry.test.ts && \
git commit -m "feat(fax): dedupeBoxes — merge near-identical rows"
```

---

### Task 5: `geometry.ts` — column clustering by X-interval overlap

**Files:**
- Modify: `backend/src/media/fax/geometry.ts`
- Test: `backend/test/fax/geometry.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to geometry.test.ts
import { clusterColumns } from '../../src/media/fax/geometry.js';

describe('clusterColumns', () => {
  it('collapses a single column when a small fragment is inside the column span', () => {
    // 1830 p459: fragment [482,512] inside column [38,513]
    const col = raw({ x: 38, y: 100, w: 475, h: 400 });   // [38,513]
    const frag = raw({ x: 482, y: 60, w: 30, h: 20 });    // [482,512] ⊂ [38,513]
    expect(clusterColumns([col, frag])).toHaveLength(1);
  });
  it('splits two disjoint columns', () => {
    // 2013 p276: [56,341] vs [357,646]
    const left = raw({ x: 56, y: 795, w: 285, h: 54 });
    const right = raw({ x: 357, y: 70, w: 289, h: 87 });
    const cols = clusterColumns([left, right]);
    expect(cols).toHaveLength(2);
    expect(cols[0][0].x).toBe(56);   // ordered left→right by min X
    expect(cols[1][0].x).toBe(357);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: FAIL (`clusterColumns` not exported).

- [ ] **Step 3: Implement `clusterColumns`**

```ts
// add to geometry.ts
import { EPSILON_PX } from './constants.js';

/** Group boxes on one page into columns by X-interval [x, x+w] overlap
 * (transitive closure). Returns columns ordered left→right by min X. */
export function clusterColumns(boxes: FaxBox[]): FaxBox[][] {
  const cols: { lo: number; hi: number; boxes: FaxBox[] }[] = [];
  // Process by X so overlap chains form left→right.
  for (const b of [...boxes].sort((a, z) => a.x - z.x)) {
    const lo = b.x, hi = b.x + b.w;
    const hit = cols.find((c) => lo < c.hi - EPSILON_PX && hi > c.lo + EPSILON_PX);
    if (hit) {
      hit.lo = Math.min(hit.lo, lo);
      hit.hi = Math.max(hit.hi, hi);
      hit.boxes.push(b);
    } else {
      cols.push({ lo, hi, boxes: [b] });
    }
  }
  return cols.sort((a, z) => a.lo - z.lo).map((c) => c.boxes);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/geometry.ts test/fax/geometry.test.ts && \
git commit -m "feat(fax): clusterColumns by X-interval overlap"
```

---

### Task 6: `geometry.ts` — merged-run ordering + full reading order → fragments

**Files:**
- Modify: `backend/src/media/fax/geometry.ts`
- Test: `backend/test/fax/geometry.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to geometry.test.ts
import { toFragments } from '../../src/media/fax/geometry.js';

describe('toFragments', () => {
  it('orders a nested tail fragment after the taller box it sits inside', () => {
    // 1829 p40: 31631 (x18,y45,small) nested inside 31632 (y37, tall)
    const tall = raw({ verseId: 31632, page: 40, x: 18, y: 37, w: 600, h: 900 });
    const tail = raw({ verseId: 31631, page: 40, x: 18, y: 45, w: 200, h: 20 });
    const frags = toFragments([tail, tall]);
    // single column, boxes vertically overlap -> one merged run
    expect(frags).toHaveLength(1);
    expect(frags[0].y).toBe(37);
  });
  it('emits page→column→run order across a column break', () => {
    const leftBottom = raw({ verseId: 100, page: 276, x: 56, y: 795, w: 285, h: 54 });
    const rightTop = raw({ verseId: 101, page: 276, x: 357, y: 70, w: 289, h: 87 });
    const frags = toFragments([rightTop, leftBottom]);
    expect(frags.map((f) => f.x)).toEqual([56, 357]); // left column first
  });
  it('orders across pages', () => {
    const p15 = raw({ verseId: 200, page: 15, x: 53, y: 162, w: 507, h: 89 });
    const p14 = raw({ verseId: 199, page: 14, x: 170, y: 977, w: 453, h: 77 });
    const frags = toFragments([p15, p14]);
    expect(frags.map((f) => f.page)).toEqual([14, 15]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: FAIL (`toFragments` not exported).

- [ ] **Step 3: Implement `mergeRuns` + `toFragments`**

```ts
// add to geometry.ts
import type { Fragment } from './types.js';

/** Merge a column's boxes into maximal vertical runs (union of boxes whose
 * Y-intervals overlap or touch), ordered top→bottom. */
function mergeRuns(colBoxes: FaxBox[]): Fragment[] {
  const runs: Fragment[] = [];
  for (const b of [...colBoxes].sort((a, z) => a.y - z.y)) {
    const top = b.y, bot = b.y + b.h;
    const last = runs[runs.length - 1];
    if (last && top <= last.y + last.h) {
      // vertically overlaps/touches the open run -> extend it
      const newTop = Math.min(last.y, top);
      const newBot = Math.max(last.y + last.h, bot);
      const newLeft = Math.min(last.x, b.x);
      const newRight = Math.max(last.x + last.w, b.x + b.w);
      last.x = newLeft; last.y = newTop;
      last.w = newRight - newLeft; last.h = newBot - newTop;
      last.boxes.push(b);
    } else {
      runs.push({ page: b.page, pageWidth: b.pageWidth, x: b.x, y: b.y, w: b.w, h: b.h, boxes: [b] });
    }
  }
  for (const r of runs) r.boxes.sort((a, z) => a.verseId - z.verseId);
  return runs;
}

/** Sanitized boxes -> fragments in reading order (page asc, column L→R, run top→bottom). */
export function toFragments(boxes: FaxBox[]): Fragment[] {
  const byPage = new Map<number, FaxBox[]>();
  for (const b of boxes) (byPage.get(b.page) ?? byPage.set(b.page, []).get(b.page)!).push(b);
  const out: Fragment[] = [];
  for (const page of [...byPage.keys()].sort((a, z) => a - z)) {
    for (const col of clusterColumns(byPage.get(page)!)) {
      out.push(...mergeRuns(col));
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/geometry.ts test/fax/geometry.test.ts && \
git commit -m "feat(fax): toFragments — merged-run reading order"
```

---

### Task 7: `geometry.ts` — clamp to N pages

**Files:**
- Modify: `backend/src/media/fax/geometry.ts`
- Test: `backend/test/fax/geometry.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to geometry.test.ts
import { clampPages } from '../../src/media/fax/geometry.js';

describe('clampPages', () => {
  it('keeps only the first N distinct pages and flags truncation', () => {
    const frags = [1, 2, 3, 4, 5, 6, 7].map((p) =>
      ({ page: p, pageWidth: 800, x: 0, y: 0, w: 10, h: 10, boxes: [] }));
    const { fragments, clamped } = clampPages(frags, 5);
    expect(new Set(fragments.map((f) => f.page)).size).toBe(5);
    expect(clamped).toBe(true);
  });
  it('does not flag when within budget', () => {
    const frags = [1, 2].map((p) => ({ page: p, pageWidth: 800, x: 0, y: 0, w: 10, h: 10, boxes: [] }));
    expect(clampPages(frags, 5).clamped).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `clampPages`**

```ts
// add to geometry.ts
export function clampPages(frags: Fragment[], maxPages: number): { fragments: Fragment[]; clamped: boolean } {
  const pages: number[] = [];
  for (const f of frags) if (!pages.includes(f.page)) pages.push(f.page);
  if (pages.length <= maxPages) return { fragments: frags, clamped: false };
  const allowed = new Set(pages.slice(0, maxPages));
  return { fragments: frags.filter((f) => allowed.has(f.page)), clamped: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/geometry.ts test/fax/geometry.test.ts && \
git commit -m "feat(fax): clampPages to N with truncation flag"
```

---

### Task 8: `canonical.ts` — slugify / deslugify / round-trip-gated canonicalization

**Files:**
- Create: `backend/src/media/fax/canonical.ts`
- Test: `backend/test/fax/canonical.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/fax/canonical.test.ts
import { describe, it, expect } from 'vitest';
import { canonicalSelector } from '../../src/media/fax/canonical.js';

describe('canonicalSelector', () => {
  it('uses a ref slug for an in-book contiguous run that round-trips', () => {
    // 1 Nephi 3:2-4
    const r = canonicalSelector([31255, 31256, 31257]);
    expect(r).toMatch(/^1-nephi-3\.2-4$/);
  });
  it('falls back to ids/ for Words of Mormon (slug does not parse)', () => {
    const r = canonicalSelector([37707]); // WoM 1:1 region
    expect(r.startsWith('ids/')).toBe(true);
  });
  it('falls back to ids/ for cross-book contiguous runs', () => {
    const r = canonicalSelector([31719, 31720, 31721, 31722]); // crosses 1 Ne -> 2 Ne
    expect(r.startsWith('ids/')).toBe(true);
  });
  it('uses ids/ for non-contiguous selections', () => {
    expect(canonicalSelector([31103, 31108]).startsWith('ids/')).toBe(true);
  });
});
```

Note: exact verse IDs above are illustrative; when implementing, confirm each with `lookupReference`/`generateReference` in a REPL and adjust the test literals so the *shape* asserted (ref-slug vs `ids/`) is what matters.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/canonical.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `canonical.ts`**

```ts
// backend/src/media/fax/canonical.ts
import { lookupReference, generateReference } from 'scripture-guide';

/** "1 Nephi 3:2–4" -> "1-nephi-3.2-4" (ASCII hyphen, lowercase, ':'→'.', drop commas/spaces). */
export function slugify(ref: string): string {
  return ref
    .replace(/[–—]/g, '-')       // en/em dash -> hyphen
    .replace(/:/g, '.')
    .replace(/,/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** "1-nephi-3.2-4" -> "1 nephi 3:2-4" (best-effort inverse for lookupReference). */
export function deslugify(slug: string): string {
  return slug.replace(/\./g, ':').replace(/-/g, ' ');
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** Canonical selector path segment. Ref slug ONLY if slug→ids→slug is a fixed point;
 * otherwise the ids/ form. `ids` must be sorted ascending, de-duplicated. */
export function canonicalSelector(ids: number[]): string {
  const sorted = [...new Set(ids)].sort((a, z) => a - z);
  try {
    const ref = generateReference(sorted);
    const slug = slugify(ref);
    const round = lookupReference(deslugify(slug))?.verse_ids ?? [];
    if (sameSet(round, sorted)) return slug;
  } catch { /* fall through */ }
  return `ids/${sorted.join('-')}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/canonical.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/canonical.ts test/fax/canonical.test.ts && \
git commit -m "feat(fax): round-trip-gated canonical selector"
```

---

### Task 9: `canonical.ts` — property test over all 6,604 verses

**Files:**
- Test: `backend/test/fax/canonical.test.ts`

- [ ] **Step 1: Add the property test**

```ts
// append to canonical.test.ts
import { slugify, deslugify } from '../../src/media/fax/canonical.js';
import { lookupReference, generateReference } from 'scripture-guide';

describe('canonical property', () => {
  it('every accepted ref slug is a slug→ids→slug fixed point', () => {
    // Book of Mormon verse ids run 31103..37852 (6604 verses).
    for (let v = 31103; v <= 37852; v++) {
      const ref = generateReference([v]);
      const slug = slugify(ref);
      const ids = lookupReference(deslugify(slug))?.verse_ids ?? [];
      // Either it round-trips to exactly [v], or canonicalSelector will use ids/ form.
      if (ids.length === 1 && ids[0] === v) {
        expect(slugify(generateReference(ids))).toBe(slug);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/canonical.test.ts`
Expected: PASS (no throw across the full verse range). If some single verses don't round-trip, that's fine — `canonicalSelector` uses `ids/` for them; the test only asserts consistency for the ones that do.

- [ ] **Step 3: Commit**

```bash
cd backend && git add test/fax/canonical.test.ts && \
git commit -m "test(fax): canonical fixed-point property over all BoM verses"
```

---

### Task 10: `resolve.ts` — selector → verse IDs and verse IDs → boxes

**Files:**
- Create: `backend/src/media/fax/resolve.ts`
- Test: `backend/test/fax/resolve.test.ts`

- [ ] **Step 1: Write the failing test (unit + integration)**

```ts
// backend/test/fax/resolve.test.ts
import { describe, it, expect } from 'vitest';
import { selectorToVerseIds, verseIdsToBoxes, legacyUnitToVerseIds } from '../../src/media/fax/resolve.js';

describe('selectorToVerseIds', () => {
  it('parses an ids/ selector', () => {
    expect(selectorToVerseIds('ids/31103-31104-31108')).toEqual([31103, 31104, 31108]);
  });
  it('parses a ref slug', () => {
    const ids = selectorToVerseIds('1-nephi-1.1');
    expect(ids).toContain(31103);
  });
});

describe('DB integration', () => {   // hits live DB
  it('verseIdsToBoxes returns sanitized boxes for 1837/31103', async () => {
    const boxes = await verseIdsToBoxes('1837', [31103]);
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes[0].page).toBe(11);
  });
  it('legacyUnitToVerseIds resolves ammon-132 -> Alma 26:1-9 (9 verses)', async () => {
    const ids = await legacyUnitToVerseIds('ammon', 132);
    expect(ids).toHaveLength(9);
    expect(ids[0]).toBe(34345);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/resolve.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `resolve.ts`**

```ts
// backend/src/media/fax/resolve.ts
import { lookupReference } from 'scripture-guide';
import { getDb } from '../../data/db.js';
import { sanitizeBoxes } from './geometry.js';
import { deslugify } from './canonical.js';
import type { FaxBox } from './types.js';

/** A selector path segment -> sorted, de-duped verse ids. */
export function selectorToVerseIds(selector: string): number[] {
  let ids: number[];
  if (selector.startsWith('ids/')) {
    ids = selector.slice(4).split('-').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } else {
    ids = lookupReference(deslugify(selector))?.verse_ids ?? [];
  }
  return [...new Set(ids)].sort((a, z) => a - z);
}

/** version + verse ids -> sanitized boxes from bom_xtras_fax_index. */
export async function verseIdsToBoxes(version: string, verseIds: number[]): Promise<FaxBox[]> {
  if (verseIds.length === 0) return [];
  const rows = await getDb()
    .selectFrom('bom_xtras_fax_index')
    .select(['verse_id', 'page', 'pageWidth', 'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH'])
    .where('version', '=', version)
    .where('verse_id', 'in', verseIds.map(String))
    .execute();
  const boxes: FaxBox[] = rows.map((r) => ({
    verseId: Number(r.verse_id), page: Number(r.page), pageWidth: Number(r.pageWidth),
    x: Number(r.X), y: Number(r.Y), w: Number(r.W), h: Number(r.H),
    tlw: Number(r.TLW), tlh: Number(r.TLH), brw: Number(r.BRW), brh: Number(r.BRH),
  }));
  return sanitizeBoxes(boxes);
}

/** Legacy alias: {slug}/{id} text-unit -> verse ids via bom_slug -> bom_text.heading. */
export async function legacyUnitToVerseIds(slug: string, id: number): Promise<number[]> {
  const db = getDb();
  const page = await db.selectFrom('bom_slug')
    .select('link').where('slug', '=', slug).where('type', '=', 'PG').executeTakeFirst();
  if (!page?.link) return [];
  const unit = await db.selectFrom('bom_text')
    .select('heading').where('page', '=', page.link).where('link', '=', id).executeTakeFirst();
  if (!unit?.heading) return [];
  const ref = String(unit.heading).replace(/[–—]/g, '-');
  const ids = lookupReference(ref)?.verse_ids ?? [];
  return [...new Set(ids)].sort((a, z) => a - z);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/resolve.test.ts`
Expected: PASS (4 tests; integration ones hit the live DB).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/resolve.ts test/fax/resolve.test.ts && \
git commit -m "feat(fax): resolve selectors and legacy units to verse ids + boxes"
```

---

### Task 11: `scan.ts` — fetch source scan + width assertion

**Files:**
- Create: `backend/src/media/fax/scan.ts`
- Test: `backend/test/fax/scan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/fax/scan.test.ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { assertScanWidth } from '../../src/media/fax/scan.js';

describe('assertScanWidth', () => {
  it('returns scale 1 when scan width matches stored pageWidth', () => {
    expect(assertScanWidth(768, 768)).toBeCloseTo(1);
  });
  it('returns the rescale factor when they differ', () => {
    expect(assertScanWidth(768, 771)).toBeCloseTo(768 / 771);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/scan.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `scan.ts`**

```ts
// backend/src/media/fax/scan.ts
import { MEDIA_BASE, pageKey } from './constants.js';

/** Fetch a source page scan as a Buffer. (HTTP for now; S3 SDK read is an
 * optional later optimization — the media host is S3-backed either way.) */
export async function fetchScan(version: string, page: number): Promise<Buffer> {
  const url = `${MEDIA_BASE}/${pageKey(version, page)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`scan fetch failed ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Coordinates are in stored-pageWidth space. If the actual scan differs,
 * return the factor to multiply every coordinate by. */
export function assertScanWidth(actualWidth: number, storedPageWidth: number): number {
  if (actualWidth === storedPageWidth) return 1;
  return actualWidth / storedPageWidth;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/scan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/scan.ts test/fax/scan.test.ts && \
git commit -m "feat(fax): fetchScan + assertScanWidth"
```

---

### Task 12: `render.ts` — crop mode (single fragment, paper-fill exterior notches)

**Files:**
- Create: `backend/src/media/fax/render.ts`
- Test: `backend/test/fax/render.test.ts`

- [ ] **Step 1: Write the failing test (dimensions + visual output to /tmp)**

```ts
// backend/test/fax/render.test.ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { renderFragmentCrop } from '../../src/media/fax/render.js';
import type { Fragment } from '../../src/media/fax/types.js';

// A 400x300 synthetic "scan": white paper with a black bar where the "text" is.
async function fakeScan(): Promise<Buffer> {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } })
    .composite([{ input: { create: { width: 300, height: 60, channels: 3, background: '#000000' } }, top: 100, left: 50 }])
    .jpeg().toBuffer();
}

describe('renderFragmentCrop', () => {
  it('crops to the fragment bbox and paper-fills the exterior notches', async () => {
    const frag: Fragment = {
      page: 1, pageWidth: 400, x: 50, y: 100, w: 300, h: 60,
      boxes: [{ verseId: 1, page: 1, pageWidth: 400, x: 50, y: 100, w: 300, h: 60,
        tlw: 40, tlh: 20, brw: 30, brh: 20 }],
    };
    const out = await renderFragmentCrop(await fakeScan(), frag, {
      tl: { w: 40, h: 20 }, br: { w: 30, h: 20 }, paper: '#ffffff',
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(60);
    // top-left 40x20 should now be white (paper-filled), not black
    const px = await sharp(out).extract({ left: 0, top: 0, width: 5, height: 5 }).raw().toBuffer();
    expect(px[0]).toBeGreaterThan(240); // near-white R
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `renderFragmentCrop`**

```ts
// backend/src/media/fax/render.ts
import sharp from 'sharp';
import type { Fragment } from './types.js';

export interface NotchFill {
  tl?: { w: number; h: number };   // exterior top-left notch (first verse), or undefined
  br?: { w: number; h: number };   // exterior bottom-right notch (last verse), or undefined
  paper: string;                    // fill color, e.g. sampled margin or '#faf7f0'
}

/** Crop one fragment's bbox from the scan and paper-fill the exterior notches. */
export async function renderFragmentCrop(scan: Buffer, frag: Fragment, notch: NotchFill): Promise<Buffer> {
  const base = sharp(scan).extract({ left: frag.x, top: frag.y, width: frag.w, height: frag.h });
  const overlays: sharp.OverlayOptions[] = [];
  if (notch.tl && notch.tl.w > 0 && notch.tl.h > 0) {
    overlays.push({
      input: { create: { width: notch.tl.w, height: notch.tl.h, channels: 3, background: notch.paper } },
      top: 0, left: 0,
    });
  }
  if (notch.br && notch.br.w > 0 && notch.br.h > 0) {
    overlays.push({
      input: { create: { width: notch.br.w, height: notch.br.h, channels: 3, background: notch.paper } },
      top: frag.h - notch.br.h, left: frag.w - notch.br.w,
    });
  }
  return (overlays.length ? base.composite(overlays) : base).png().toBuffer();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/render.ts test/fax/render.test.ts && \
git commit -m "feat(fax): renderFragmentCrop with exterior-notch paper-fill"
```

---

### Task 13: `render.ts` — page mode (dim overlay except highlight rects)

**Files:**
- Modify: `backend/src/media/fax/render.ts`
- Test: `backend/test/fax/render.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to render.test.ts
import { renderPageDimmed } from '../../src/media/fax/render.js';

describe('renderPageDimmed', () => {
  it('keeps full page size and brightens only the highlight rects', async () => {
    const rects = [{ x: 50, y: 100, w: 300, h: 60 }];
    const out = await renderPageDimmed(await fakeScan(), 400, 300, rects, 0.55);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
    // a corner outside the highlight should be dimmed (darker than pure white)
    const corner = await sharp(out).extract({ left: 0, top: 0, width: 5, height: 5 }).raw().toBuffer();
    expect(corner[0]).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `renderPageDimmed`**

```ts
// add to render.ts
export interface Rect { x: number; y: number; w: number; h: number; }

/** Full page with a dark overlay everywhere EXCEPT the highlight rects.
 * Technique: build a full-page black layer at `opacity`, punch transparent
 * holes over the rects, composite over the scan. */
export async function renderPageDimmed(
  scan: Buffer, width: number, height: number, rects: Rect[], opacity: number,
): Promise<Buffer> {
  const alpha = Math.round(opacity * 255);
  const holes = rects
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`)
    .join('');
  // White mask = where the dark overlay applies; black holes = transparent.
  const maskSvg = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${holes}</svg>`);
  const darkLayer = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: alpha / 255 } } })
    .composite([{ input: maskSvg, blend: 'dest-in' }]) // keep dark only where mask is opaque (white)
    .png().toBuffer();
  return sharp(scan).composite([{ input: darkLayer, top: 0, left: 0 }]).jpeg().toBuffer();
}
```

Note: the mask blend may need `dest-out` instead of `dest-in` depending on sharp's SVG alpha handling — verify visually in Step 4 and flip if the highlight is dark instead of the background. Write a rendered sample to `/tmp/fax-page.png` in the test and Read it.

- [ ] **Step 4: Run to verify it passes + eyeball**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Add `await sharp(out).toFile('/tmp/fax-page.png')` temporarily and Read it: the highlight band bright, the rest dimmed. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/render.ts test/fax/render.test.ts && \
git commit -m "feat(fax): renderPageDimmed with mask-punched dark overlay"
```

---

### Task 14: `render.ts` — stitch (crop ribbon + page N-up spread) with per-page downscale

**Files:**
- Modify: `backend/src/media/fax/render.ts`
- Test: `backend/test/fax/render.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to render.test.ts
import { stitchVertical, stitchHorizontal } from '../../src/media/fax/render.js';

describe('stitch', () => {
  it('stitchVertical stacks images and sums heights (max width)', async () => {
    const a = await sharp({ create: { width: 200, height: 40, channels: 3, background: '#111' } }).png().toBuffer();
    const b = await sharp({ create: { width: 180, height: 30, channels: 3, background: '#222' } }).png().toBuffer();
    const out = await stitchVertical([a, b], '#ffffff');
    const m = await sharp(out).metadata();
    expect(m.width).toBe(200);
    expect(m.height).toBe(70);
  });
  it('stitchHorizontal places images side by side with a gutter', async () => {
    const a = await sharp({ create: { width: 100, height: 50, channels: 3, background: '#111' } }).png().toBuffer();
    const b = await sharp({ create: { width: 100, height: 60, channels: 3, background: '#222' } }).png().toBuffer();
    const out = await stitchHorizontal([a, b], 10, '#ffffff');
    const m = await sharp(out).metadata();
    expect(m.width).toBe(210);   // 100 + 10 gutter + 100
    expect(m.height).toBe(60);   // max height
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `stitchVertical` + `stitchHorizontal`**

```ts
// add to render.ts
async function dims(buf: Buffer) { const m = await sharp(buf).metadata(); return { w: m.width!, h: m.height! }; }

/** Crop mode: stack fragment images top→bottom, left-aligned, on paper bg. */
export async function stitchVertical(images: Buffer[], paper: string): Promise<Buffer> {
  const ds = await Promise.all(images.map(dims));
  const width = Math.max(...ds.map((d) => d.w));
  const height = ds.reduce((s, d) => s + d.h, 0);
  let top = 0;
  const layers = images.map((input, i) => { const o = { input, top, left: 0 }; top += ds[i].h; return o; });
  return sharp({ create: { width, height, channels: 3, background: paper } }).composite(layers).jpeg().toBuffer();
}

/** Page mode: place page images side-by-side with a gutter, top-aligned. */
export async function stitchHorizontal(images: Buffer[], gutter: number, paper: string): Promise<Buffer> {
  const ds = await Promise.all(images.map(dims));
  const width = ds.reduce((s, d) => s + d.w, 0) + gutter * (images.length - 1);
  const height = Math.max(...ds.map((d) => d.h));
  let left = 0;
  const layers = images.map((input, i) => { const o = { input, top: 0, left }; left += ds[i].w + gutter; return o; });
  return sharp({ create: { width, height, channels: 3, background: paper } }).composite(layers).jpeg().toBuffer();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/render.ts test/fax/render.test.ts && \
git commit -m "feat(fax): stitchVertical + stitchHorizontal"
```

---

### Task 15: `render.ts` — `renderImage` orchestrator (downscale-per-page → stitch → encode)

**Files:**
- Modify: `backend/src/media/fax/render.ts`
- Test: `backend/test/fax/render.test.ts`

- [ ] **Step 1: Add the failing test (integration-lite, uses the fake scan + a scan provider)**

```ts
// append to render.test.ts
import { renderImage } from '../../src/media/fax/render.js';
import type { Fragment } from '../../src/media/fax/types.js';

describe('renderImage', () => {
  const provider = async () => fakeScan();  // one page only
  const frag = (page: number): Fragment => ({
    page, pageWidth: 400, x: 50, y: 100, w: 300, h: 60,
    boxes: [{ verseId: 1, page, pageWidth: 400, x: 50, y: 100, w: 300, h: 60, tlw: 0, tlh: 0, brw: 0, brh: 0 }],
  });

  it('crop mode single page → ~300px wide (downscaled to width=200)', async () => {
    const out = await renderImage({ mode: 'crop', ext: 'jpg', width: 200, fragments: [frag(1)], provider, paper: '#fff' });
    const m = await sharp(out).metadata();
    expect(m.width).toBeLessThanOrEqual(200);
  });
  it('page mode two pages → N-up spread', async () => {
    const out = await renderImage({ mode: 'page', ext: 'jpg', width: 'full', fragments: [frag(1), frag(2)], provider, paper: '#fff' });
    const m = await sharp(out).metadata();
    expect(m.width).toBeGreaterThan(400);   // two pages side by side
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `renderImage`**

```ts
// add to render.ts
import { DIM_OPACITY, JPEG_QUALITY } from './constants.js';

export interface RenderArgs {
  mode: 'page' | 'crop';
  ext: 'jpg' | 'webp';
  width: number | 'full';
  fragments: Fragment[];
  provider: (page: number) => Promise<Buffer>;   // page -> scan buffer
  paper: string;
  gutter?: number;
}

const encode = (img: sharp.Sharp, ext: 'jpg' | 'webp') =>
  (ext === 'webp' ? img.webp({ quality: JPEG_QUALITY }) : img.jpeg({ quality: JPEG_QUALITY })).toBuffer();

const downscale = async (buf: Buffer, width: number | 'full'): Promise<Buffer> => {
  if (width === 'full') return buf;
  const m = await sharp(buf).metadata();
  if ((m.width ?? 0) <= width) return buf;              // never upscale
  return sharp(buf).resize({ width }).toBuffer();
};

export async function renderImage(args: RenderArgs): Promise<Buffer> {
  const { mode, ext, width, fragments, provider, paper, gutter = 12 } = args;
  if (fragments.length === 0) throw new Error('no fragments to render');

  if (mode === 'crop') {
    // one crop per fragment, downscaled, stacked vertically.
    // Exterior notches only: the first fragment's first box carries the TL notch;
    // the last fragment's last box carries the BR notch (spec §7). Interior
    // notches stay lit (no fill).
    const crops: Buffer[] = [];
    for (let i = 0; i < fragments.length; i++) {
      const f = fragments[i];
      const scan = await provider(f.page);
      const notch: NotchFill = { paper };
      if (i === 0 && f.boxes[0]) notch.tl = { w: f.boxes[0].tlw, h: f.boxes[0].tlh };
      const lastBox = f.boxes[f.boxes.length - 1];
      if (i === fragments.length - 1 && lastBox) notch.br = { w: lastBox.brw, h: lastBox.brh };
      const raw = await renderFragmentCrop(scan, f, notch);
      crops.push(await downscale(raw, width));
    }
    return encode(sharp(await stitchVertical(crops, paper)), ext);
  }

  // page mode: group fragments by page, dim each page, downscale, spread horizontally
  const pages = [...new Set(fragments.map((f) => f.page))];
  const pageBufs: Buffer[] = [];
  for (const page of pages) {
    const scan = await provider(page);
    const meta = await sharp(scan).metadata();
    const rects = fragments.filter((f) => f.page === page).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
    const dimmed = await renderPageDimmed(scan, meta.width!, meta.height!, rects, DIM_OPACITY);
    pageBufs.push(await downscale(dimmed, width));
  }
  const spread = pageBufs.length === 1 ? pageBufs[0] : await stitchHorizontal(pageBufs, gutter, paper);
  return encode(sharp(spread), ext);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/render.ts test/fax/render.test.ts && \
git commit -m "feat(fax): renderImage orchestrator (per-page downscale then stitch)"
```

---

## Phase 2 — Serving layer (S3 + Fastify)

### Task 16: `cache.ts` — key derivation, inFlight coalescing, S3 write-back with retry

**Files:**
- Create: `backend/src/media/fax/cache.ts`
- Test: `backend/test/fax/cache.test.ts`

- [ ] **Step 1: Write the failing test (mock S3)**

```ts
// backend/test/fax/cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { keyFor, coalesce, _resetInFlight } from '../../src/media/fax/cache.js';

describe('keyFor', () => {
  it('derives the render S3 key from the canonical path parts', () => {
    expect(keyFor({ version: '1837', mode: 'crop', width: 400, selector: '1-nephi-1.1', ext: 'jpg' }))
      .toBe('fax/render/1837/crop/w400/1-nephi-1.1.jpg');
  });
  it('uses wfull for full width', () => {
    expect(keyFor({ version: '1837', mode: 'page', width: 'full', selector: 'ids/31103', ext: 'jpg' }))
      .toBe('fax/render/1837/page/wfull/ids/31103.jpg');
  });
});

describe('coalesce', () => {
  it('runs one producer for concurrent identical keys', async () => {
    _resetInFlight();
    const producer = vi.fn(async () => Buffer.from('x'));
    const [a, b] = await Promise.all([coalesce('k', producer), coalesce('k', producer)]);
    expect(producer).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});

import { withRenderSlot } from '../../src/media/fax/cache.js';
describe('withRenderSlot', () => {
  it('bounds concurrency (never exceeds the cap)', async () => {
    let active = 0, peak = 0;
    const job = () => withRenderSlot(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--; return 1;
    });
    await Promise.all(Array.from({ length: 20 }, job));
    expect(peak).toBeLessThanOrEqual(Number(process.env.FAX_MAX_RENDERS ?? 4));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/cache.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `cache.ts`**

```ts
// backend/src/media/fax/cache.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface KeyParts { version: string; mode: 'page' | 'crop'; width: number | 'full'; selector: string; ext: 'jpg' | 'webp'; }

export function keyFor(p: KeyParts): string {
  const w = p.width === 'full' ? 'wfull' : `w${p.width}`;
  return `fax/render/${p.version}/${p.mode}/${w}/${p.selector}.${p.ext}`;
}

/** Legacy alias key (§12): fax/text/{version}/{slug}-{id}.jpg */
export function legacyKey(version: string, slug: string, id: number): string {
  return `fax/text/${version}/${slug}-${id}.jpg`;
}

// ── request coalescing ───────────────────────────────────────────────
const inFlight = new Map<string, Promise<Buffer>>();
export function _resetInFlight() { inFlight.clear(); }
export function coalesce(key: string, producer: () => Promise<Buffer>): Promise<Buffer> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = producer().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// ── render concurrency semaphore (§6: bound sharp memory) ────────────
const MAX_CONCURRENT_RENDERS = Number(process.env['FAX_MAX_RENDERS'] ?? 4);
let active = 0;
const waiters: (() => void)[] = [];
export async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_RENDERS) await new Promise<void>((r) => waiters.push(r));
  active++;
  try { return await fn(); }
  finally { active--; waiters.shift()?.(); }
}

// ── S3 write-back (fire-and-forget with bounded retry) ───────────────
const s3 = new S3Client({});
const contentType = (ext: 'jpg' | 'webp') => (ext === 'webp' ? 'image/webp' : 'image/jpeg');

export function writeBack(key: string, body: Buffer, ext: 'jpg' | 'webp'): void {
  const bucket = process.env['FAX_S3_BUCKET'] || process.env['S3_BUCKET'];
  if (!bucket) return;                       // unconfigured -> skip silently
  void (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: body,
          ContentType: contentType(ext),
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        return;
      } catch (err) {
        if (attempt === 2) console.error(`[fax] writeBack failed key=${key}:`, err);
        else await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
  })();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/cache.ts test/fax/cache.test.ts && \
git commit -m "feat(fax): cache keys, coalescing, S3 write-back with retry"
```

---

### Task 17: env vars + rate-limit dependency

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/package.json` (add `@fastify/rate-limit`)

- [ ] **Step 1: Add env vars**

Read `backend/src/config/env.ts`; add to the zod schema (all optional — the route degrades gracefully):

```ts
  FAX_S3_BUCKET: z.string().optional(),
  FAX_S3_PUBLIC_URL: z.string().optional(),
```

- [ ] **Step 2: Install the rate-limit plugin**

Run: `cd backend && npm install @fastify/rate-limit`
Expected: adds to `dependencies`.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/config/env.ts package.json package-lock.json && \
git commit -m "feat(fax): FAX_S3_* env vars + @fastify/rate-limit dep"
```

---

### Task 18: `route.ts` — Fastify plugin for `/fax/render/*`

**Files:**
- Create: `backend/src/media/fax/route.ts`
- Test: `backend/test/fax/route.test.ts`

- [ ] **Step 1: Write the failing test (via Fastify inject)**

```ts
// backend/test/fax/route.test.ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { faxRoutes } from '../../src/media/fax/route.js';

async function app() {
  const f = Fastify();
  await f.register(faxRoutes);
  return f;
}

describe('GET /fax/render', () => {
  it('rejects an unknown version with 400', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/render/9999/crop/w400/1-nephi-1.1.jpg' });
    expect(r.statusCode).toBe(400);
  });
  it('rejects a bad width with 400', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/render/1837/crop/w123/1-nephi-1.1.jpg' });
    expect(r.statusCode).toBe(400);
  });
  it('renders a real verse to a JPEG (integration)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/render/1837/crop/w400/1-nephi-1.1.jpg' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/jpeg');
    expect(r.rawPayload.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `route.ts`**

```ts
// backend/src/media/fax/route.ts
import type { FastifyInstance } from 'fastify';
import { VERSION_SLUGS, WIDTH_WHITELIST, MAX_PAGES } from './constants.js';
import { selectorToVerseIds, verseIdsToBoxes, legacyUnitToVerseIds } from './resolve.js';
import { toFragments, clampPages } from './geometry.js';
import { renderImage } from './render.js';
import { fetchScan } from './scan.js';
import { keyFor, legacyKey, coalesce, writeBack, withRenderSlot } from './cache.js';
import { canonicalSelector } from './canonical.js';
import { createHash } from 'node:crypto';

const etag = (b: Buffer) => `"${createHash('sha1').update(b).digest('hex')}"`;

const PAPER = '#faf7f0'; // fallback paper color; margin-sampling is a later refinement

function parseWidth(seg: string): number | 'full' | null {
  if (seg === 'wfull') return 'full';
  const m = /^w(\d+)$/.exec(seg);
  if (!m) return null;
  const n = Number(m[1]);
  return (WIDTH_WHITELIST as readonly number[]).includes(n) ? n : null;
}

export async function faxRoutes(app: FastifyInstance): Promise<void> {
  // /fax/render/{version}/{mode}/w{width}/{selector...}.{ext}
  app.get('/fax/render/*', async (req, reply) => {
    const rest = (req.params as { '*': string })['*']; // version/mode/wNNN/selector.ext
    const parts = rest.split('/');
    if (parts.length < 4) return reply.code(400).send({ error: 'bad path' });
    const [version, mode, widthSeg, ...selParts] = parts;
    if (!(VERSION_SLUGS as readonly string[]).includes(version)) return reply.code(400).send({ error: 'unknown version' });
    if (mode !== 'page' && mode !== 'crop') return reply.code(400).send({ error: 'bad mode' });
    const width = parseWidth(widthSeg);
    if (width === null) return reply.code(400).send({ error: 'bad width' });

    const selRaw = selParts.join('/');
    const dot = selRaw.lastIndexOf('.');
    if (dot < 0) return reply.code(400).send({ error: 'missing ext' });
    const ext = selRaw.slice(dot + 1);
    const selector = selRaw.slice(0, dot);
    if (ext !== 'jpg' && ext !== 'webp') return reply.code(400).send({ error: 'bad ext' });

    const verseIds = selectorToVerseIds(selector);
    if (verseIds.length === 0) return reply.code(404).send({ error: 'no verses' });

    // canonical redirect (manual Location for Fastify-version safety)
    const canonical = canonicalSelector(verseIds);
    if (canonical !== selector) {
      return reply.code(301)
        .header('cache-control', 'public, max-age=86400')
        .header('location', `/fax/render/${version}/${mode}/${widthSeg}/${canonical}.${ext}`)
        .send();
    }

    const key = keyFor({ version, mode, width, selector, ext });
    try {
      const body = await coalesce(key, () => withRenderSlot(async () => {
        const boxes = await verseIdsToBoxes(version, verseIds);
        if (boxes.length === 0) throw Object.assign(new Error('no boxes'), { statusCode: 404 });
        const { fragments, clamped } = clampPages(toFragments(boxes), MAX_PAGES);
        if (clamped) app.log.info({ key }, 'fax render clamped to N pages');
        return renderImage({ mode, ext, width, fragments, paper: PAPER, provider: (p) => fetchScan(version, p) });
      }));
      writeBack(key, body, ext);
      return reply
        .header('content-type', ext === 'webp' ? 'image/webp' : 'image/jpeg')
        .header('cache-control', 'public, max-age=31536000, immutable')
        .header('etag', etag(body))
        .send(body);
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 502).send({ error: (err as Error).message });
    }
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/route.test.ts`
Expected: PASS (400s for bad input; 200 image/jpeg for a real verse).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/route.ts test/fax/route.test.ts && \
git commit -m "feat(fax): /fax/render route with validation, canonical redirect, writeback"
```

---

### Task 19: `route.ts` — legacy `/fax/text/*` alias

**Files:**
- Modify: `backend/src/media/fax/route.ts`
- Test: `backend/test/fax/route.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to route.test.ts
describe('GET /fax/text (legacy alias)', () => {
  it('renders ammon-132 to a JPEG (integration)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/text/1837/ammon-132' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/jpeg');
  });
  it('404s a topical-heading unit', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/text/1837/lehites-83' });
    expect(r.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run test/fax/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the alias route (add inside `faxRoutes`)**

```ts
// add inside faxRoutes(), after the /fax/render/* handler:
  // Legacy: /fax/text/{version}/{slug}-{id}(.jpg) -> mode=page, width=full
  app.get('/fax/text/*', async (req, reply) => {
    const rest = (req.params as { '*': string })['*'];
    const parts = rest.split('/');
    if (parts.length < 2) return reply.code(400).send({ error: 'bad path' });
    const version = parts[0];
    if (!(VERSION_SLUGS as readonly string[]).includes(version)) return reply.code(400).send({ error: 'unknown version' });
    let tail = parts.slice(1).join('/').replace(/\.jpg$/, '');
    const m = /^([a-z-]{1,50})-(\d{1,6})$/.exec(tail);
    if (!m) return reply.code(400).send({ error: 'bad unit' });
    const slug = m[1], id = Number(m[2]);

    const verseIds = await legacyUnitToVerseIds(slug, id);
    if (verseIds.length === 0) return reply.code(404).send({ error: 'unresolved unit' });

    const key = legacyKey(version, slug, id);
    try {
      const body = await coalesce(key, () => withRenderSlot(async () => {
        const boxes = await verseIdsToBoxes(version, verseIds);
        if (boxes.length === 0) throw Object.assign(new Error('no boxes'), { statusCode: 404 });
        const { fragments } = clampPages(toFragments(boxes), MAX_PAGES);
        return renderImage({ mode: 'page', ext: 'jpg', width: 'full', fragments, paper: PAPER, provider: (p) => fetchScan(version, p) });
      }));
      writeBack(key, body, 'jpg');
      return reply
        .header('content-type', 'image/jpeg')
        .header('cache-control', 'public, max-age=31536000, immutable')
        .header('etag', etag(body))
        .send(body);
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 502).send({ error: (err as Error).message });
    }
  });
```

Note: the `error.statusCode` thrown inside `coalesce` surfaces as a 500 by default. Add a Fastify `setErrorHandler` in Task 20 that maps `err.statusCode` → reply code, or wrap each handler's `coalesce` call in try/catch translating to `reply.code(err.statusCode ?? 502)`. Do the try/catch in both handlers now to keep tests green.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/media/fax/route.ts test/fax/route.test.ts && \
git commit -m "feat(fax): legacy /fax/text alias route"
```

---

### Task 20: Register the plugin + rate limit + error mapping in the server

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/media/fax/route.ts`

- [ ] **Step 1: Add error mapping + rate limit to `faxRoutes`**

At the top of `faxRoutes`, before the routes:

```ts
  const rateLimit = (await import('@fastify/rate-limit')).default;
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.setErrorHandler((err, _req, reply) => {
    const code = (err as { statusCode?: number }).statusCode ?? 502;
    reply.code(code).send({ error: err.message });
  });
```

- [ ] **Step 2: Register the plugin in `index.ts` BEFORE the `/*` catch-all**

In `backend/src/index.ts`, add the import near the others:

```ts
import { faxRoutes } from './media/fax/route.js';
```

And register it just before `app.route({ ... url: '/*' ... })` (line ~100):

```ts
await app.register(faxRoutes);
```

Because `faxRoutes` registers `/fax/render/*` and `/fax/text/*` (more specific than `/*`), Fastify's radix router matches them first.

- [ ] **Step 3: Typecheck + full test run**

Run: `cd backend && npm run typecheck && npx vitest run test/fax/`
Expected: typecheck clean; all fax tests PASS.

- [ ] **Step 4: Manual smoke test against the running dev server**

Run: `cd backend && npm run dev` (in a scratch terminal), then:
`curl -s -o /tmp/r.jpg -w "%{http_code} %{content_type}\n" "http://localhost:5006/fax/render/1837/crop/w400/1-nephi-1.1.jpg"`
Expected: `200 image/jpeg`. Read `/tmp/r.jpg` to confirm the crop looks right.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/index.ts src/media/fax/route.ts && \
git commit -m "feat(fax): register fax routes + rate limit + error mapping"
```

---

### Task 21: Golden-parity test (scale-normalized)

**Files:**
- Test: `backend/test/fax/golden.test.ts`

- [ ] **Step 1: Write the parity test**

```ts
// backend/test/fax/golden.test.ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { legacyUnitToVerseIds, verseIdsToBoxes } from '../../src/media/fax/resolve.js';
import { toFragments } from '../../src/media/fax/geometry.js';

// The golden 2022 asset came from a different scan generation, so we compare
// the RELATIVE vertical band of the highlight, not raw pixels.
describe('golden parity: ammon-132', () => {
  it('resolves to Alma 26:1-9 and the highlight band matches (normalized)', async () => {
    const ids = await legacyUnitToVerseIds('ammon', 132);
    expect(ids).toHaveLength(9);
    const boxes = await verseIdsToBoxes('1837', ids);
    const frags = toFragments(boxes);
    expect(new Set(frags.map((f) => f.page))).toEqual(new Set([317]));

    // current scan height for 1837 p317
    const scan = Buffer.from(await (await fetch('https://media.bookofmormon.online/fax/pages/1837/317.jpg')).arrayBuffer());
    const h = (await sharp(scan).metadata()).height!;
    const top = Math.min(...frags.map((f) => f.y)) / h;
    const bot = Math.max(...frags.map((f) => f.y + f.h)) / h;
    // golden bright band ≈ rows 224..1164 of 1500 => 0.149..0.776 (normalized)
    expect(top).toBeGreaterThan(0.10);
    expect(top).toBeLessThan(0.25);
    expect(bot).toBeGreaterThan(0.60);
    expect(bot).toBeLessThan(0.85);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `cd backend && npx vitest run test/fax/golden.test.ts`
Expected: PASS (band within normalized tolerance).

- [ ] **Step 3: Commit**

```bash
cd backend && git add test/fax/golden.test.ts && \
git commit -m "test(fax): scale-normalized golden parity for ammon-132"
```

---

### Task 22: Full regression + docs note

**Files:**
- Modify: `docs/specs/2026-07-18-fax-render-api-design.md` (mark Implemented)

- [ ] **Step 1: Run the whole backend test suite**

Run: `cd backend && npm test`
Expected: existing suites still pass; new `test/fax/*` pass. Note any pre-existing unrelated failures separately (don't fix here).

- [ ] **Step 2: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: clean.

- [ ] **Step 3: Update the spec status header**

Change the spec `**Status:**` line to `Implemented (Phase 1+2) — CloudFront failover wiring pending infra`.

- [ ] **Step 4: Commit**

```bash
cd backend && git add ../docs/specs/2026-07-18-fax-render-api-design.md && \
git commit -m "docs(fax): mark render API implemented"
```

---

## Out of scope for this plan (tracked follow-ups)

- **CloudFront origin-group failover wiring** (infra): route S3 `403/404` for `fax/render/*` and `fax/text/*` to the Node origin; strip query strings; set error-cache TTLs. Spec §10.
- **Margin-color sampling** for paper-fill (currently a fixed `#faf7f0`). Spec §7.
- **S3 SDK reads** for source scans instead of HTTP (optional latency win). Spec §3.
- **Frontend migration** from `/fax/text/...` to the rich `/fax/render/...` path (opt-in). Spec §12.
- **`FaxRenderCache` Redis/memory tier** behind the existing seam. Spec §9.
