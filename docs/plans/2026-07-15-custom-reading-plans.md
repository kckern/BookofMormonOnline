# Custom Reading Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users create personal reading plans (scope × pacing × segmentation) or start one from a seeded program catalog; the dead-plan bug class becomes structurally impossible.

**Architecture:** Config + materialized segments (spec D5): plan rows store a JSON recipe; a deterministic generator materializes real `bom_readingplan_seg` rows so the existing read pipeline, progress SQL, and theater seam survive untouched. New `bom_readingplan_program` catalog table; first-ever write path (3 mutations); rewritten frontend widget with gallery + 3-step wizard.

**Tech Stack:** Backend: TypeScript, GraphQL Yoga, Kysely (MySQL), vitest, `scripture-guide`, `nanoid`. Frontend: React 17, reactstrap, react-bootstrap-sweetalert, jest + RTL 11.

**Spec:** `docs/specs/2026-07-15-custom-reading-plans.md` (decisions D1–D10). Audit: `docs/audits/2026-07-15-reading-plan-audit.md`.

**Conventions the engineer must know:**
- Backend tests: `cd backend && npm test` (vitest). Tests live in `backend/test/<domain>/*.test.ts` and hit the live DB; write-tests build their own RW connection from `MYSQL_WRITE_USER`/`MYSQL_WRITE_PASSWORD` env (see `backend/test/messaging/messages.test.ts:1-83`) and must clean up rows they create.
- Frontend tests: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false <pattern>`.
- Mutations NEVER throw to the client — they return `{ isSuccess, msg, ... }` (see `joinGroup`, `backend/src/graphql/resolvers/community.ts:755-791`).
- Kysely is fully typed from `backend/codegen/db.d.ts`; after any schema change run `cd backend && npm run codegen:db`. After any `.graphql` change run `npm run codegen:graphql`.
- All new tables/columns: `utf8mb4` / `utf8mb4_0900_ai_ci`.
- Do NOT touch `_deprecated/` or root `src/` — the live backend is `backend/`.

---

## File map (what's created/modified)

**Backend — new:**
- `backend/scripts/migrate-readingplan-programs.mjs` — idempotent DDL migration
- `backend/scripts/seed-readingplan-programs.mjs` — program catalog + UI labels seed
- `backend/src/readingplan/types.ts` — config vocabulary types
- `backend/src/readingplan/slice.ts` — pure: sections → chunks (weighting, clamping)
- `backend/src/readingplan/pace.ts` — pure: chunks → segment drafts (dates, periods, refs)
- `backend/src/readingplan/scope.ts` — DB: config scope → ordered whole sections
- `backend/src/readingplan/generate.ts` — orchestrator
- `backend/src/graphql/resolvers/readingplan.ts` — new queries + mutations
- `backend/schema/BomReadingPlan.graphql` — reading-plan SDL (moved out of BomCommunity.graphql + extended)
- `backend/test/readingplan/slice.test.ts`, `pace.test.ts`, `scope.test.ts`, `generate.test.ts`, `mutations.test.ts`

**Backend — modified:**
- `backend/schema/BomCommunity.graphql` — remove readingplan queries/types (moved)
- `backend/src/graphql/resolvers.ts` — merge `readingplanResolvers`
- `backend/src/messaging/readingplan.ts` — active-plan-by-owner, `current`, credit window, auto-complete
- `backend/src/data/loaders/ported_community.ts` — credit window in segment loader

**Frontend — new (folder replaces the old single file):**
- `frontend/webapp/src/views/Home/ReadingPlan/index.js` — widget state machine
- `frontend/webapp/src/views/Home/ReadingPlan/ActivePlan.js` — plan renderer (port, new contract)
- `frontend/webapp/src/views/Home/ReadingPlan/Gallery.js` — program catalog + start flow
- `frontend/webapp/src/views/Home/ReadingPlan/Wizard.js` — 3-step builder
- `frontend/webapp/src/views/Home/ReadingPlan/ReadingPlan.css` — deduped stylesheet (same class names)
- `frontend/webapp/src/views/Home/ReadingPlan/__tests__/*.test.js`

**Frontend — modified/deleted:**
- DELETE `frontend/webapp/src/views/Home/ReadingPlan.js` and `frontend/webapp/src/views/Home/ReadingPlan.css` (folder takes over the import path)
- `frontend/webapp/src/models/GraphQLQueries.js` — new/updated query + mutation entries
- `frontend/webapp/src/views/Home/Home.js:95`, `frontend/webapp/src/views/Welcome/pages/showcase.js:43` — drop hardcoded slug
- `frontend/webapp/src/assets/theme/scss/darkmode.scss` — gallery/wizard dark rules

---

## Phase 1 — Database

### Task 1: Migration script

**Files:** Create `backend/scripts/migrate-readingplan-programs.mjs`

- [ ] **Step 1: Write the migration script**

```javascript
// Idempotent DDL for custom reading plans (spec D6, D10).
// Creates bom_readingplan_program; adds status/config/enddate to bom_readingplan.
// Safe to run repeatedly: checks information_schema before every change.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || process.env.MYSQL_HOST,
  port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_WRITE_USER || process.env.DB_USER || process.env.MYSQL_USER,
  password: process.env.MYSQL_WRITE_PASSWORD || process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQL_DB || 'bom_prd',
});

const db = (process.env.DB_NAME || process.env.MYSQL_DB || 'bom_prd');

async function hasColumn(table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [db, table, column],
  );
  return rows.length > 0;
}
async function hasTable(table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
    [db, table],
  );
  return rows.length > 0;
}
async function hasIndex(table, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?`,
    [db, table, index],
  );
  return rows.length > 0;
}

if (!(await hasTable('bom_readingplan_program'))) {
  await conn.query(`CREATE TABLE bom_readingplan_program (
    guid        varchar(32)  NOT NULL,
    slug        varchar(128) NOT NULL,
    title       varchar(256) NOT NULL,
    description text         NULL,
    config      json         NOT NULL,
    sort        int          NOT NULL DEFAULT 0,
    active      tinyint(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (guid),
    UNIQUE KEY uq_program_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  console.log('created bom_readingplan_program');
} else console.log('bom_readingplan_program exists — skip');

if (!(await hasColumn('bom_readingplan', 'status'))) {
  await conn.query(`ALTER TABLE bom_readingplan ADD COLUMN status ENUM('active','completed','abandoned') NULL DEFAULT NULL`);
  console.log('added bom_readingplan.status');
} else console.log('status exists — skip');

if (!(await hasColumn('bom_readingplan', 'config'))) {
  await conn.query(`ALTER TABLE bom_readingplan ADD COLUMN config json NULL`);
  console.log('added bom_readingplan.config');
} else console.log('config exists — skip');

if (!(await hasColumn('bom_readingplan', 'enddate'))) {
  await conn.query(`ALTER TABLE bom_readingplan ADD COLUMN enddate date NULL`);
  console.log('added bom_readingplan.enddate');
} else console.log('enddate exists — skip');

if (!(await hasIndex('bom_readingplan', 'idx_owner_status'))) {
  await conn.query(`ALTER TABLE bom_readingplan ADD INDEX idx_owner_status (owner, status)`);
  console.log('added idx_owner_status');
} else console.log('idx_owner_status exists — skip');

await conn.end();
console.log('migration complete');
```

- [ ] **Step 2: Run it twice (idempotency proof)**

Run: `cd backend && node scripts/migrate-readingplan-programs.mjs && node scripts/migrate-readingplan-programs.mjs`
Expected: first run prints `created`/`added` lines; second run prints all `— skip` lines. No errors.

- [ ] **Step 3: Regenerate DB types**

Run: `cd backend && npm run codegen:db`
Expected: `codegen/db.d.ts` gains `BomReadingplanProgram` interface and `status`/`config`/`enddate` on `BomReadingplan`. Verify: `grep -n "BomReadingplanProgram" codegen/db.d.ts`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/migrate-readingplan-programs.mjs backend/codegen/db.d.ts
git commit -m "feat(readingplan): program table + plan status/config/enddate migration"
```

### Task 2: Seed script (programs + UI labels)

**Files:** Create `backend/scripts/seed-readingplan-programs.mjs`

- [ ] **Step 1: Write the seed script**

```javascript
// Seeds the program catalog (spec seed list) and readingplan UI labels.
// Idempotent: INSERT ... ON DUPLICATE KEY UPDATE. Verse ranges computed via
// scripture-guide so nothing is hardcoded wrong. Pages-scope program is only
// seeded if its slug exists in bom_slug (skips with a warning otherwise).
import 'dotenv/config';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { lookup } from 'scripture-guide';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || process.env.MYSQL_HOST,
  port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_WRITE_USER || process.env.DB_USER || process.env.MYSQL_USER,
  password: process.env.MYSQL_WRITE_PASSWORD || process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQL_DB || 'bom_prd',
});

const md5_8 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
const md5_32 = (s) => crypto.createHash('md5').update(s).digest('hex');

// Whole Book of Mormon + Mosiah verse ranges from canon (scripture-guide).
const range = (ref) => {
  const ids = lookup(ref).verse_ids ?? lookup(ref); // lookup returns verse id array (or {verse_ids})
  const arr = Array.isArray(ids) ? ids : ids.verse_ids;
  return { start: Math.min(...arr), end: Math.max(...arr) };
};
const wholeBook = { start: range('1 Nephi 1').start, end: range('Moroni 10').end };
const mosiah = range('Mosiah');

const programs = [
  { slug: 'bom-in-a-year', title: 'Book of Mormon in a Year', description: 'A steady weekly walk through the whole book.',
    sort: 1, config: { scope: { type: 'range', ...wholeBook }, pacing: { type: 'cadence', unit: 'week', count: 52 }, segmentation: { type: 'even', parts: 52 }, credit: 'fresh' } },
  { slug: '90-day-challenge', title: '90-Day Challenge', description: 'The whole Book of Mormon in three focused months.',
    sort: 2, config: { scope: { type: 'range', ...wholeBook }, pacing: { type: 'cadence', unit: 'day', count: 90 }, segmentation: { type: 'even', parts: 90 }, credit: 'fresh' } },
  { slug: 'one-page-at-a-time', title: 'One Page at a Time', description: 'No dates, no pressure — one narrative page per sitting.',
    sort: 3, config: { scope: { type: 'range', ...wholeBook }, pacing: { type: 'selfpaced' }, segmentation: { type: 'page' }, credit: 'alltime' } },
  { slug: 'mosiah-in-30-days', title: 'Mosiah in 30 Days', description: 'A daily sprint through the book of Mosiah.',
    sort: 4, config: { scope: { type: 'range', ...mosiah }, pacing: { type: 'cadence', unit: 'day', count: 30 }, segmentation: { type: 'even', parts: 30 }, credit: 'fresh' } },
];

// Pages-scope example — only if the slug exists on this DB.
const [mm] = await conn.query(`SELECT slug FROM bom_slug WHERE slug = 'messianic-ministry' LIMIT 1`);
if (mm.length) {
  programs.push({ slug: 'messianic-ministry-deep-dive', title: 'Messianic Ministry Deep Dive',
    description: 'Self-paced study of the Messianic Ministry, section by section.', sort: 5,
    config: { scope: { type: 'pages', slugs: ['messianic-ministry'] }, pacing: { type: 'selfpaced' }, segmentation: { type: 'section' }, credit: 'alltime' } });
} else console.warn('WARN: slug messianic-ministry not found — skipping pages-scope program');

for (const p of programs) {
  await conn.query(
    `INSERT INTO bom_readingplan_program (guid, slug, title, description, config, sort, active)
     VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, 1)
     ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), config=VALUES(config), sort=VALUES(sort)`,
    [md5_32(`rp-program-${p.slug}`), p.slug, p.title, p.description, JSON.stringify(p.config), p.sort],
  );
  console.log('seeded program:', p.slug);
}

// UI labels (type='readingplan', matching the 5 existing rows).
const labels = {
  rp_start_a_plan: 'Start a Reading Plan', rp_build_your_own: 'Build your own',
  rp_choose_program: 'Choose a program', rp_start_plan: 'Start plan', rp_starting: 'Starting…',
  rp_start_date: 'Start date', rp_count_past_reading: 'Count reading I have already done',
  rp_start_fresh: 'Start fresh', rp_wizard_what: 'What will you read?',
  rp_wizard_pace: 'How fast?', rp_wizard_confirm: 'Your plan', rp_tab_guide: 'Our Guide',
  rp_tab_books: 'Books', rp_pace_daily: 'Daily portions', rp_pace_weekly: 'Weekly portions',
  rp_pace_bydate: 'Finish by a date', rp_pace_selfpaced: 'My own pace — no dates',
  rp_parts: 'portions', rp_sections: 'sections', rp_clamped: 'This selection supports up to $1 portions',
  rp_plan_complete: 'Plan complete!', rp_start_another: 'Start another plan',
  rp_abandon_plan: 'Abandon plan', rp_abandon_confirm: 'Abandon this plan? Your reading history is kept.',
  rp_active_exists: 'You already have an active plan. Finish or abandon it first.',
  rp_error_loading: 'Could not load your reading plan.', rp_retry: 'Retry',
  rp_ends: 'Ends', rp_next: 'Next', rp_back: 'Back', rp_empty_scope: 'Pick at least one thing to read.',
};
for (const [label_id, label_text] of Object.entries(labels)) {
  await conn.query(
    `INSERT INTO bom_label (guid, label_id, label_text, type) VALUES (?, ?, ?, 'readingplan')
     ON DUPLICATE KEY UPDATE label_text=VALUES(label_text)`,
    [md5_8(`rp-label-${label_id}`), label_id, label_text],
  );
}
console.log('seeded', Object.keys(labels).length, 'labels');
await conn.end();
```

- [ ] **Step 2: Check `bom_label`'s unique key before running**

Run: `cd backend && node -e "require('dotenv').config();const m=require('mysql2/promise');m.createConnection({host:process.env.DB_HOST||process.env.MYSQL_HOST,port:process.env.DB_PORT||3306,user:process.env.DB_USER||process.env.MYSQL_USER,password:process.env.DB_PASS||process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD,database:process.env.DB_NAME||'bom_prd'}).then(async c=>{const[r]=await c.query('SHOW INDEX FROM bom_label');console.log(r.map(x=>x.Key_name+':'+x.Column_name).join('\n'));await c.end()})"`
Expected: shows which column is PRIMARY/UNIQUE. If `label_id` is NOT unique, dedupe in the script by `SELECT`-before-`INSERT` on label_id instead of relying on ON DUPLICATE KEY (adjust accordingly — the guid md5 is deterministic so re-runs stay idempotent either way).

- [ ] **Step 3: Run seed twice; verify**

Run: `cd backend && node scripts/seed-readingplan-programs.mjs && node scripts/seed-readingplan-programs.mjs`
Expected: both runs succeed (idempotent). Verify: query `SELECT slug, sort FROM bom_readingplan_program ORDER BY sort` → 4-5 rows; `SELECT COUNT(*) FROM bom_label WHERE type='readingplan'` → ≥ 33 (5 existing + ~28 new).

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed-readingplan-programs.mjs
git commit -m "feat(readingplan): seed program catalog + wizard/gallery UI labels"
```

---

## Phase 2 — Generator (pure logic first, TDD)

### Task 3: Config types + slicer

**Files:** Create `backend/src/readingplan/types.ts`, `backend/src/readingplan/slice.ts`, `backend/test/readingplan/slice.test.ts`

- [ ] **Step 1: Write the types module**

```typescript
// backend/src/readingplan/types.ts
// The config vocabulary (spec "Config JSON vocabulary"). This is the single
// definition — resolvers, generator, and seeds all speak these shapes.
export type ScopeConfig =
  | { type: 'range'; start: number; end: number }
  | { type: 'pages'; slugs: string[] }
  | { type: 'sections'; guids: string[] };

export type PacingConfig =
  | { type: 'cadence'; unit: 'day' | 'week'; count: number }
  | { type: 'calendar'; due: string } // YYYY-MM-DD
  | { type: 'selfpaced' };

export type SegmentationConfig =
  | { type: 'even'; parts: number }
  | { type: 'section' }
  | { type: 'page' };

export interface PlanConfig {
  scope: ScopeConfig;
  pacing: PacingConfig;
  segmentation: SegmentationConfig;
  credit: 'fresh' | 'alltime';
}

/** A whole section resolved from scope — the atomic unit of composition (spec D9). */
export interface ScopedSection {
  guid: string;
  pageGuid: string;
  blocks: number;   // atomic units of MEASUREMENT — used for weighting
  minVerse: number;
  maxVerse: number;
}

export interface SegmentDraft {
  period: string | null;
  ref: string;
  duedate: string | null; // YYYY-MM-DD or null (selfpaced)
  start: number;
  end: number;
  sectionGuids: string[];
}

export interface GenWarning { code: 'PARTS_CLAMPED' | 'EMPTY_SCOPE'; detail?: number }

export function parsePlanConfig(raw: string): PlanConfig | null {
  try {
    const c = JSON.parse(raw) as PlanConfig;
    if (!c?.scope?.type || !c?.pacing?.type || !c?.segmentation?.type) return null;
    if (c.credit !== 'fresh' && c.credit !== 'alltime') return null;
    return c;
  } catch { return null; }
}
```

- [ ] **Step 2: Write failing slicer tests**

```typescript
// backend/test/readingplan/slice.test.ts
import { describe, expect, it } from 'vitest';
import { sliceSections } from '../../src/readingplan/slice.js';
import type { ScopedSection } from '../../src/readingplan/types.js';

const sec = (guid: string, blocks: number, page = 'pg1', v = 0): ScopedSection =>
  ({ guid, pageGuid: page, blocks, minVerse: v, maxVerse: v + blocks - 1 });

describe('sliceSections', () => {
  it('even: divides equal sections into equal parts', () => {
    const sections = Array.from({ length: 6 }, (_, i) => sec(`s${i}`, 10, 'pg1', i * 10));
    const { chunks, warnings } = sliceSections(sections, { type: 'even', parts: 3 });
    expect(warnings).toEqual([]);
    expect(chunks.map((c) => c.length)).toEqual([2, 2, 2]);
  });

  it('even: weights by block count (Alma vs Omni)', () => {
    // one huge section then many tiny ones — the huge one gets its own part
    const sections = [sec('alma', 100, 'pg1', 0), ...Array.from({ length: 5 }, (_, i) => sec(`t${i}`, 10, 'pg2', 200 + i * 10))];
    const { chunks } = sliceSections(sections, { type: 'even', parts: 2 });
    expect(chunks[0].map((s) => s.guid)).toEqual(['alma']);
    expect(chunks[1]).toHaveLength(5);
  });

  it('even: clamps when parts exceed section count', () => {
    const sections = [sec('a', 5), sec('b', 5)];
    const { chunks, warnings } = sliceSections(sections, { type: 'even', parts: 30 });
    expect(chunks).toHaveLength(2);
    expect(warnings).toEqual([{ code: 'PARTS_CLAMPED', detail: 2 }]);
  });

  it('even: every part is non-empty and covers all sections in order', () => {
    const sections = Array.from({ length: 17 }, (_, i) => sec(`s${i}`, 1 + (i * 7) % 13, 'pg1', i * 100));
    const { chunks } = sliceSections(sections, { type: 'even', parts: 5 });
    expect(chunks).toHaveLength(5);
    expect(chunks.flat().map((s) => s.guid)).toEqual(sections.map((s) => s.guid));
    chunks.forEach((c) => expect(c.length).toBeGreaterThan(0));
  });

  it('section: one segment per section', () => {
    const sections = [sec('a', 5), sec('b', 7)];
    const { chunks } = sliceSections(sections, { type: 'section' });
    expect(chunks.map((c) => c.map((s) => s.guid))).toEqual([['a'], ['b']]);
  });

  it('page: groups contiguous sections of the same page', () => {
    const sections = [sec('a', 5, 'p1'), sec('b', 5, 'p1'), sec('c', 5, 'p2'), sec('d', 5, 'p3')];
    const { chunks } = sliceSections(sections, { type: 'page' });
    expect(chunks.map((c) => c.map((s) => s.guid))).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('empty scope warns', () => {
    const { chunks, warnings } = sliceSections([], { type: 'even', parts: 3 });
    expect(chunks).toEqual([]);
    expect(warnings).toEqual([{ code: 'EMPTY_SCOPE' }]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && npx vitest run test/readingplan/slice.test.ts`
Expected: FAIL — cannot resolve `../../src/readingplan/slice.js`.

- [ ] **Step 4: Implement the slicer**

```typescript
// backend/src/readingplan/slice.ts
// Pure slicing: sections → contiguous chunks of WHOLE sections (spec D9).
// 'even' is a greedy balanced partition weighted by block count, guaranteeing
// every part non-empty; parts clamp to section count (spec generator §2).
import type { GenWarning, ScopedSection, SegmentationConfig } from './types.js';

export function sliceSections(
  sections: ScopedSection[],
  seg: SegmentationConfig,
): { chunks: ScopedSection[][]; warnings: GenWarning[] } {
  const warnings: GenWarning[] = [];
  if (!sections.length) return { chunks: [], warnings: [{ code: 'EMPTY_SCOPE' }] };

  if (seg.type === 'section') return { chunks: sections.map((s) => [s]), warnings };

  if (seg.type === 'page') {
    const chunks: ScopedSection[][] = [];
    for (const s of sections) {
      const last = chunks[chunks.length - 1];
      if (last && last[0]!.pageGuid === s.pageGuid) last.push(s);
      else chunks.push([s]);
    }
    return { chunks, warnings };
  }

  let parts = seg.parts;
  if (parts > sections.length) {
    warnings.push({ code: 'PARTS_CLAMPED', detail: sections.length });
    parts = sections.length;
  }
  const chunks: ScopedSection[][] = [];
  let idx = 0;
  let blocksLeft = sections.reduce((a, s) => a + s.blocks, 0);
  for (let p = 0; p < parts; p++) {
    const partsLeft = parts - p;
    const target = blocksLeft / partsLeft;
    const chunk: ScopedSection[] = [sections[idx]!];
    let size = sections[idx]!.blocks;
    idx++;
    // Grow while the next section brings us closer to target AND enough
    // sections remain to give every later part at least one.
    while (
      idx < sections.length &&
      sections.length - idx > partsLeft - 1 &&
      Math.abs(size + sections[idx]!.blocks - target) <= Math.abs(size - target)
    ) {
      size += sections[idx]!.blocks;
      chunk.push(sections[idx]!);
      idx++;
    }
    blocksLeft -= size;
    chunks.push(chunk);
  }
  return { chunks, warnings };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd backend && npx vitest run test/readingplan/slice.test.ts`
Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/readingplan/types.ts backend/src/readingplan/slice.ts backend/test/readingplan/slice.test.ts
git commit -m "feat(readingplan): config types + weighted whole-section slicer (TDD)"
```

### Task 4: Pacing/labeling

**Files:** Create `backend/src/readingplan/pace.ts`, `backend/test/readingplan/pace.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/test/readingplan/pace.test.ts
import { describe, expect, it } from 'vitest';
import { addDays, assignPacing } from '../../src/readingplan/pace.js';
import type { ScopedSection } from '../../src/readingplan/types.js';

const sec = (guid: string, minVerse: number, maxVerse: number): ScopedSection =>
  ({ guid, pageGuid: 'pg', blocks: 3, minVerse, maxVerse });

describe('addDays', () => {
  it('adds across month boundaries in UTC', () => {
    expect(addDays('2026-07-30', 3)).toBe('2026-08-02');
  });
});

describe('assignPacing', () => {
  const chunks = [[sec('a', 1, 20)], [sec('b', 21, 60)], [sec('c', 61, 90)]];

  it('cadence daily: sequential duedates and Day N periods', () => {
    const drafts = assignPacing(chunks, { type: 'cadence', unit: 'day', count: 3 }, '2026-07-15');
    expect(drafts.map((d) => d.duedate)).toEqual(['2026-07-16', '2026-07-17', '2026-07-18']);
    expect(drafts.map((d) => d.period)).toEqual(['Day 1', 'Day 2', 'Day 3']);
  });

  it('cadence weekly: 7-day steps, Week N', () => {
    const drafts = assignPacing(chunks, { type: 'cadence', unit: 'week', count: 3 }, '2026-07-15');
    expect(drafts.map((d) => d.duedate)).toEqual(['2026-07-22', '2026-07-29', '2026-08-05']);
    expect(drafts[0]!.period).toBe('Week 1');
  });

  it('calendar: spreads evenly to the due date', () => {
    const drafts = assignPacing(chunks, { type: 'calendar', due: '2026-07-24' }, '2026-07-15');
    expect(drafts[2]!.duedate).toBe('2026-07-24'); // last segment lands on due
    expect(drafts.map((d) => d.duedate)).toEqual(['2026-07-18', '2026-07-21', '2026-07-24']);
  });

  it('selfpaced: null dates, Part N', () => {
    const drafts = assignPacing(chunks, { type: 'selfpaced' }, '2026-07-15');
    expect(drafts.every((d) => d.duedate === null)).toBe(true);
    expect(drafts.map((d) => d.period)).toEqual(['Part 1', 'Part 2', 'Part 3']);
  });

  it('carries verse extents and sectionGuids; generates a ref', () => {
    const drafts = assignPacing(chunks, { type: 'selfpaced' }, '2026-07-15');
    expect(drafts[0]).toMatchObject({ start: 1, end: 20, sectionGuids: ['a'] });
    expect(typeof drafts[0]!.ref).toBe('string');
    expect(drafts[0]!.ref.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run test/readingplan/pace.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// backend/src/readingplan/pace.ts
// Pure pacing: chunks → SegmentDrafts with dates/periods/refs (spec generator §3).
// Date math is UTC string math — no moment, no local-tz drift (audit P1 #8).
import { generateReference } from 'scripture-guide';
import type { PacingConfig, ScopedSection, SegmentDraft } from './types.js';

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function refFor(start: number, end: number): string {
  const ids = Array.from({ length: end - start + 1 }, (_, k) => start + k);
  return generateReference(ids);
}

export function assignPacing(
  chunks: ScopedSection[][],
  pacing: PacingConfig,
  startdate: string,
): SegmentDraft[] {
  const n = chunks.length;
  return chunks.map((chunk, i) => {
    const start = Math.min(...chunk.map((s) => s.minVerse));
    const end = Math.max(...chunk.map((s) => s.maxVerse));
    let duedate: string | null = null;
    let period: string;
    if (pacing.type === 'cadence') {
      const step = pacing.unit === 'week' ? 7 : 1;
      duedate = addDays(startdate, (i + 1) * step);
      period = `${pacing.unit === 'week' ? 'Week' : 'Day'} ${i + 1}`;
    } else if (pacing.type === 'calendar') {
      const span = Math.max(n, daysBetween(startdate, pacing.due));
      duedate = addDays(startdate, Math.round((span * (i + 1)) / n));
      period = `Part ${i + 1}`;
    } else {
      period = `Part ${i + 1}`;
    }
    return { period, ref: refFor(start, end), duedate, start, end, sectionGuids: chunk.map((s) => s.guid) };
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx vitest run test/readingplan/pace.test.ts`
Expected: 6 passed. If `generateReference(ids)` needs a different call shape, check its use in `backend/src/data/loaders/scripture.ts:7-10` and match — adjust `refFor` only.

- [ ] **Step 5: Commit**

```bash
git add backend/src/readingplan/pace.ts backend/test/readingplan/pace.test.ts
git commit -m "feat(readingplan): pacing/date/ref assignment (TDD)"
```

### Task 5: Scope resolver (DB)

**Files:** Create `backend/src/readingplan/scope.ts`, `backend/test/readingplan/scope.test.ts`

- [ ] **Step 1: Write failing tests** (read-only DB — no cleanup needed; uses the same env the backend uses)

```typescript
// backend/test/readingplan/scope.test.ts
import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { getDb } from '../../src/data/db.js';
import { resolveScope } from '../../src/readingplan/scope.js';

const db = getDb();

describe('resolveScope (live DB, read-only)', () => {
  it('range: returns ordered whole sections with block counts', async () => {
    // First 100 verse ids of the canon window used by the CFM plan
    const sections = await resolveScope(db, { type: 'range', start: 1, end: 100 });
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) {
      expect(s.blocks).toBeGreaterThan(0);
      expect(s.minVerse).toBeLessThanOrEqual(s.maxVerse);
    }
    const mins = sections.map((s) => s.minVerse);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins); // ordered by narrative position
  });

  it('pages: resolves a real page slug to its sections', async () => {
    // Use any real page slug from the DB rather than assuming one:
    const row = await db.selectFrom('bom_slug').select('slug').where('type', '=', 'PG').limit(1).executeTakeFirst();
    expect(row).toBeTruthy();
    const sections = await resolveScope(db, { type: 'pages', slugs: [row!.slug!] });
    expect(sections.length).toBeGreaterThan(0);
  });

  it('sections passthrough aggregates the given guids', async () => {
    const range = await resolveScope(db, { type: 'range', start: 1, end: 100 });
    const guids = range.slice(0, 2).map((s) => s.guid);
    const out = await resolveScope(db, { type: 'sections', guids });
    expect(out.map((s) => s.guid).sort()).toEqual([...guids].sort());
  });

  it('empty input returns empty', async () => {
    expect(await resolveScope(db, { type: 'sections', guids: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run test/readingplan/scope.test.ts`
Expected: FAIL — module not found. (If the `bom_slug.type = 'PG'` assumption fails later, inspect `SELECT DISTINCT type FROM bom_slug` and use the page-type value found; the SlugResolver in `backend/src/data/loaders/ported_community.ts` shows the authoritative usage.)

- [ ] **Step 3: Implement**

```typescript
// backend/src/readingplan/scope.ts
// Scope → ordered WHOLE sections (spec D9). Canonical ranges snap outward to
// any section whose blocks overlap the range; pages resolve via bom_slug.
// Aggregates are computed over the whole section so refs/weights are honest.
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { ScopeConfig, ScopedSection } from './types.js';

async function aggregateSections(db: Kysely<DB>, sectionGuids: string[]): Promise<ScopedSection[]> {
  if (!sectionGuids.length) return [];
  const rows = await db
    .selectFrom('bom_text')
    .innerJoin('bom_lookup', 'bom_lookup.text_guid', 'bom_text.guid')
    .innerJoin('bom_section', 'bom_section.guid', 'bom_text.section')
    .select(({ fn }) => [
      'bom_section.guid as guid',
      'bom_section.parent as pageGuid',
      fn.count<number>('bom_text.guid').distinct().as('blocks'),
      fn.min<number>('bom_lookup.verse_id').as('minVerse'),
      fn.max<number>('bom_lookup.verse_id').as('maxVerse'),
    ])
    .where('bom_text.section', 'in', sectionGuids)
    .groupBy(['bom_section.guid', 'bom_section.parent'])
    .orderBy('minVerse')
    .execute();
  return rows.map((r) => ({
    guid: String(r.guid), pageGuid: String(r.pageGuid ?? ''),
    blocks: Number(r.blocks), minVerse: Number(r.minVerse), maxVerse: Number(r.maxVerse),
  }));
}

export async function resolveScope(db: Kysely<DB>, scope: ScopeConfig): Promise<ScopedSection[]> {
  if (scope.type === 'sections') return aggregateSections(db, scope.guids);

  if (scope.type === 'range') {
    const rows = await db
      .selectFrom('bom_lookup')
      .innerJoin('bom_text', 'bom_text.guid', 'bom_lookup.text_guid')
      .select('bom_text.section')
      .distinct()
      .where('bom_lookup.verse_id', '>=', scope.start)
      .where('bom_lookup.verse_id', '<=', scope.end)
      .execute();
    return aggregateSections(db, rows.map((r) => String(r.section)).filter(Boolean));
  }

  // pages: slugs → page links → sections under those pages
  if (!scope.slugs.length) return [];
  const rows = await db
    .selectFrom('bom_slug')
    .innerJoin('bom_section', 'bom_section.parent', 'bom_slug.link')
    .select('bom_section.guid')
    .where('bom_slug.slug', 'in', scope.slugs)
    .execute();
  return aggregateSections(db, rows.map((r) => String(r.guid)));
}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx vitest run test/readingplan/scope.test.ts`
Expected: 4 passed. If Kysely typing complains about column names, check the real names in `backend/codegen/db.d.ts` (interfaces `BomText`, `BomLookup`, `BomSection`, `BomSlug`) and adjust — the compiler is the source of truth here.

- [ ] **Step 5: Commit**

```bash
git add backend/src/readingplan/scope.ts backend/test/readingplan/scope.test.ts
git commit -m "feat(readingplan): scope→whole-sections resolver (TDD, live-DB read tests)"
```

### Task 6: Generator orchestrator

**Files:** Create `backend/src/readingplan/generate.ts`, `backend/test/readingplan/generate.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// backend/test/readingplan/generate.test.ts
import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { getDb } from '../../src/data/db.js';
import { generatePlanSegments } from '../../src/readingplan/generate.js';
import type { PlanConfig } from '../../src/readingplan/types.js';

const db = getDb();
const cfg = (over: Partial<PlanConfig> = {}): PlanConfig => ({
  scope: { type: 'range', start: 1, end: 500 },
  pacing: { type: 'cadence', unit: 'day', count: 5 },
  segmentation: { type: 'even', parts: 5 },
  credit: 'fresh',
  ...over,
});

describe('generatePlanSegments (live DB)', () => {
  it('produces dated, ref-labeled segments covering the scope', async () => {
    const { segments, warnings } = await generatePlanSegments(db, cfg(), '2026-07-15');
    expect(segments).toHaveLength(5);
    expect(warnings).toEqual([]);
    expect(segments[0]!.duedate).toBe('2026-07-16');
    expect(segments.every((s) => s.sectionGuids.length > 0)).toBe(true);
    expect(segments.every((s) => s.ref.length > 0)).toBe(true);
  });

  it('is deterministic', async () => {
    const a = await generatePlanSegments(db, cfg(), '2026-07-15');
    const b = await generatePlanSegments(db, cfg(), '2026-07-15');
    expect(a).toEqual(b);
  });

  it('clamps and warns when parts exceed sections', async () => {
    const { segments, warnings } = await generatePlanSegments(
      db, cfg({ segmentation: { type: 'even', parts: 5000 } }), '2026-07-15');
    expect(warnings[0]!.code).toBe('PARTS_CLAMPED');
    expect(segments.length).toBe(warnings[0]!.detail);
  });

  it('empty scope yields EMPTY_SCOPE', async () => {
    const { segments, warnings } = await generatePlanSegments(
      db, cfg({ scope: { type: 'sections', guids: [] } }), '2026-07-15');
    expect(segments).toEqual([]);
    expect(warnings).toEqual([{ code: 'EMPTY_SCOPE' }]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd backend && npx vitest run test/readingplan/generate.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// backend/src/readingplan/generate.ts
// The deterministic generator (spec §Segment generator): config → SegmentDrafts.
// Used by BOTH previewReadingPlan (dry-run) and startReadingPlan (persist) so
// preview and reality can never disagree (spec acceptance #7).
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { resolveScope } from './scope.js';
import { sliceSections } from './slice.js';
import { assignPacing } from './pace.js';
import type { GenWarning, PlanConfig, SegmentDraft } from './types.js';

export interface GenerateResult { segments: SegmentDraft[]; warnings: GenWarning[] }

export async function generatePlanSegments(
  db: Kysely<DB>,
  config: PlanConfig,
  startdate: string,
): Promise<GenerateResult> {
  const sections = await resolveScope(db, config.scope);
  const { chunks, warnings } = sliceSections(sections, config.segmentation);
  if (!chunks.length) return { segments: [], warnings };
  return { segments: assignPacing(chunks, config.pacing, startdate), warnings };
}
```

- [ ] **Step 4: Run tests** — `cd backend && npx vitest run test/readingplan/` → all readingplan suites pass (slice 7, pace 6, scope 4, generate 4).

- [ ] **Step 5: Commit**

```bash
git add backend/src/readingplan/generate.ts backend/test/readingplan/generate.test.ts
git commit -m "feat(readingplan): deterministic generator orchestrator (TDD)"
```

---

## Phase 3 — GraphQL surface

### Task 7: Schema — move + extend

**Files:** Create `backend/schema/BomReadingPlan.graphql`; Modify `backend/schema/BomCommunity.graphql`

- [ ] **Step 1: Move + extend the SDL.** Cut the two query lines (`readingplan`, `readingplansegment`, at `backend/schema/BomCommunity.graphql:11-12`) and the `ReadingPlan` + `ReadingPlanSegment` type blocks (lines 154-175) OUT of `BomCommunity.graphql`. Create:

```graphql
# backend/schema/BomReadingPlan.graphql
# Reading plans: user-created plans + program catalog (docs/specs/2026-07-15-custom-reading-plans.md)
extend type Query {
  readingplan(token: String, slug: String): ReadingPlan
  readingplansegment(token: String, guid: String): ReadingPlanSegment
  readingplanprograms(token: String): [ReadingPlanProgram]
  readingplanpreview(token: String, config: String!, startdate: String): ReadingPlanPreview
  readingplanhistory(token: String): [ReadingPlanSummary]
}

extend type Mutation {
  startReadingPlan(token: String!, input: StartPlanInput!): ReadingPlanResult
  updateReadingPlan(token: String!, input: UpdatePlanInput!): ReadingPlanResult
  endReadingPlan(token: String!, action: PlanEndAction!): ReadingPlanResult
}

input StartPlanInput {
  programSlug: String
  title: String
  config: String       # JSON PlanConfig (required when programSlug absent)
  startdate: String    # YYYY-MM-DD, default today
  credit: String       # 'fresh' | 'alltime' override when starting from a program
}

input UpdatePlanInput {
  config: String!      # JSON PlanConfig — scope MUST equal current scope (immutable)
}

enum PlanEndAction { COMPLETE ABANDON }

type ReadingPlanResult {
  isSuccess: Boolean
  msg: String          # OK | ACTIVE_PLAN_EXISTS | INVALID_CONFIG | EMPTY_SCOPE | NOT_AUTHENTICATED | NO_ACTIVE_PLAN | SCOPE_IMMUTABLE
  plan: ReadingPlan
}

type ReadingPlanProgram {
  slug: String
  title: String
  description: String
  config: String
  scopeLabel: String
  durationLabel: String
}

type ReadingPlanPreview {
  parts: Int
  enddate: String
  warnings: [PlanWarning]
  segments: [PreviewSegment]
}
type PlanWarning { code: String, detail: Int }
type PreviewSegment { period: String, ref: String, duedate: String, blocks: Int }

type ReadingPlanSummary {
  slug: String
  title: String
  status: String
  startdate: String
  enddate: String
  progress: Float
}

type ReadingPlan {
  guid: String
  slug: String
  title: String
  startdate: String
  duedate: String
  progress: Float
  status: String
  config: String
  current: Int
  segments: [ReadingPlanSegment]
}

type ReadingPlanSegment {
  guid: String
  period: String
  ref: String
  url: String
  title: String
  duedate: String
  progress: Float
  start: Int
  end: Int
  sections: [Section]
}
```

(The `ReadingPlan`/`ReadingPlanSegment` blocks above are the moved originals from `BomCommunity.graphql:154-175` plus three new fields: `status`, `config`, `current`. Do not leave copies behind — duplicate type definitions fail schema build.)

- [ ] **Step 2: Regenerate + typecheck**

Run: `cd backend && npm run codegen:graphql && npx tsc --noEmit`
Expected: codegen succeeds; tsc passes (no resolver changes yet — existing readingplan resolvers still satisfy the moved types).

- [ ] **Step 3: Boot smoke** — restart backend or run dev server briefly; `curl -s -X POST http://localhost:5006/graphql -H "Content-Type: application/json" -d '{"query":"{ readingplanprograms { slug } }"}'`
Expected: `{"data":{"readingplanprograms":null}}` (schema valid, resolver not yet written).

- [ ] **Step 4: Commit**

```bash
git add backend/schema/BomReadingPlan.graphql backend/schema/BomCommunity.graphql backend/codegen/graphql.ts
git commit -m "feat(readingplan): dedicated SDL — programs, preview, history, mutations"
```

### Task 8: Read resolvers (programs, preview)

**Files:** Create `backend/src/graphql/resolvers/readingplan.ts`; Modify `backend/src/graphql/resolvers.ts`

- [ ] **Step 1: Implement the resolver module** (mutations come in Task 9 — export the object now with Query only)

```typescript
// backend/src/graphql/resolvers/readingplan.ts
// Reading-plan catalog, preview, history + (Task 9) mutations.
// Convention: mutations/queries never throw to the client — structured results.
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { generatePlanSegments } from '../../readingplan/generate.js';
import { parsePlanConfig } from '../../readingplan/types.js';

/** token → bom_user.user username (NOT the messenger md5 id). Null when anonymous. */
export async function resolveUsername(ctx: AppContext, token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const row = await ctx.db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select('bom_user.user as username')
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  return row?.username ?? null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const readingplanResolvers: Resolvers = {
  Query: {
    readingplanprograms: async (_root, _args, ctx: AppContext) => {
      const rows = await ctx.db
        .selectFrom('bom_readingplan_program')
        .selectAll()
        .where('active', '=', 1)
        .orderBy('sort')
        .execute();
      return rows.map((r) => {
        const cfg = parsePlanConfig(typeof r.config === 'string' ? r.config : JSON.stringify(r.config));
        const pacing = cfg?.pacing;
        const durationLabel =
          pacing?.type === 'cadence' ? `${pacing.count} ${pacing.unit}s` :
          pacing?.type === 'calendar' ? `by ${pacing.due}` : 'self-paced';
        const scopeLabel =
          cfg?.scope.type === 'range' ? 'scripture range' :
          cfg?.scope.type === 'pages' ? `${cfg.scope.slugs.length} page(s)` : 'custom selection';
        return {
          slug: r.slug, title: r.title, description: r.description,
          config: typeof r.config === 'string' ? r.config : JSON.stringify(r.config),
          scopeLabel, durationLabel,
        };
      });
    },

    readingplanpreview: async (_root, args, ctx: AppContext) => {
      const config = parsePlanConfig(args.config as string);
      if (!config) return { parts: 0, enddate: null, warnings: [{ code: 'INVALID_CONFIG', detail: null }], segments: [] };
      const startdate = (args.startdate as string | undefined) ?? todayISO();
      const { segments, warnings } = await generatePlanSegments(ctx.db, config, startdate);
      return {
        parts: segments.length,
        enddate: segments.length ? segments[segments.length - 1]!.duedate : null,
        warnings: warnings.map((w) => ({ code: w.code, detail: w.detail ?? null })),
        segments: segments.map((s) => ({
          period: s.period, ref: s.ref, duedate: s.duedate,
          blocks: s.sectionGuids.length, // display proxy; true block counts live in preview later if needed
        })),
      };
    },

    readingplanhistory: async (_root, args, ctx: AppContext) => {
      const username = await resolveUsername(ctx, args.token as string);
      if (!username) return [];
      const rows = await ctx.db
        .selectFrom('bom_readingplan')
        .select(['slug', 'title', 'status', 'startdate', 'enddate'])
        .where('owner', '=', username)
        .where('status', 'in', ['completed', 'abandoned'])
        .orderBy('enddate', 'desc')
        .execute();
      return rows.map((r) => ({
        slug: r.slug, title: r.title, status: r.status,
        startdate: r.startdate ? new Date(r.startdate).toISOString().slice(0, 10) : null,
        enddate: r.enddate ? new Date(r.enddate).toISOString().slice(0, 10) : null,
        progress: null, // filled by ReadingPlanSummary.progress field resolver if ever needed; YAGNI for list view
      }));
    },
  },
};
```

- [ ] **Step 2: Wire into the merged map.** In `backend/src/graphql/resolvers.ts`, add the import and include in `mergeResolverMaps(...)` alongside `communityResolvers`:

```typescript
import { readingplanResolvers } from './resolvers/readingplan.js';
// ... inside mergeResolverMaps(
  readingplanResolvers,
```

- [ ] **Step 3: Typecheck + curl verify**

Run: `cd backend && npx tsc --noEmit` → clean. Restart dev backend, then:
`curl -s -X POST http://localhost:5006/graphql -H "Content-Type: application/json" -d '{"query":"{ readingplanprograms { slug title durationLabel } }"}'`
Expected: the 4-5 seeded programs.
`curl -s -X POST http://localhost:5006/graphql -H "Content-Type: application/json" -d '{"query":"{ readingplanpreview(config: \"{\\\"scope\\\":{\\\"type\\\":\\\"range\\\",\\\"start\\\":1,\\\"end\\\":500},\\\"pacing\\\":{\\\"type\\\":\\\"cadence\\\",\\\"unit\\\":\\\"day\\\",\\\"count\\\":5},\\\"segmentation\\\":{\\\"type\\\":\\\"even\\\",\\\"parts\\\":5},\\\"credit\\\":\\\"fresh\\\"}\") { parts enddate segments { ref duedate } } }"}'`
Expected: `parts: 5` with refs and sequential duedates.

- [ ] **Step 4: Commit**

```bash
git add backend/src/graphql/resolvers/readingplan.ts backend/src/graphql/resolvers.ts
git commit -m "feat(readingplan): programs/preview/history resolvers"
```

### Task 9: Mutations — start + end

**Files:** Modify `backend/src/graphql/resolvers/readingplan.ts`; Create `backend/test/readingplan/mutations.test.ts`

- [ ] **Step 1: Write failing integration tests.** Follow the write-DB + cleanup pattern from `backend/test/messaging/messages.test.ts:1-83` (buildWriteDb, `canWrite` guard, tracked rows):

```typescript
// backend/test/readingplan/mutations.test.ts
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { createPlanForUser, endPlanForUser } from '../../src/graphql/resolvers/readingplan.js';

function buildWriteDb(): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: process.env['MYSQL_HOST'] ?? process.env['DB_HOST'] ?? '127.0.0.1',
        port: Number(process.env['MYSQL_PORT'] ?? process.env['DB_PORT'] ?? 3306),
        database: process.env['MYSQL_DB'] ?? process.env['DB_NAME'] ?? 'bom_prd',
        user: process.env['MYSQL_WRITE_USER'] ?? process.env['DB_USER'] ?? 'root',
        password: process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['DB_PASS'] ?? process.env['DB_PASSWORD'] ?? '',
        connectionLimit: 3,
      }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

const db = buildWriteDb();
const testUser = `test_rp_${nanoid(8)}`;
let canWrite = false;

const CONFIG = {
  scope: { type: 'range', start: 1, end: 500 },
  pacing: { type: 'cadence', unit: 'day', count: 5 },
  segmentation: { type: 'even', parts: 5 },
  credit: 'fresh',
} as const;

async function cleanup() {
  if (!canWrite) return;
  const plans = await db.selectFrom('bom_readingplan').select('slug').where('owner', '=', testUser).execute();
  const slugs = plans.map((p) => p.slug!).filter(Boolean);
  if (slugs.length) await db.deleteFrom('bom_readingplan_seg').where('plan', 'in', slugs).execute();
  await db.deleteFrom('bom_readingplan').where('owner', '=', testUser).execute();
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

  it('rejects invalid config and empty scope', async () => {
    const bad = await createPlanForUser(db, `${testUser}x`, { config: '{not json' });
    expect(bad.msg).toBe('INVALID_CONFIG');
    const empty = await createPlanForUser(db, `${testUser}x`, {
      config: JSON.stringify({ ...CONFIG, scope: { type: 'sections', guids: [] } }),
    });
    expect(empty.msg).toBe('EMPTY_SCOPE');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd backend && npx vitest run test/readingplan/mutations.test.ts` → FAIL (`createPlanForUser` not exported).

- [ ] **Step 3: Implement core functions + mutation resolvers.** Add to `backend/src/graphql/resolvers/readingplan.ts`:

```typescript
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
// (merge these imports with the existing ones at the top of the file)

interface CreateArgs { programSlug?: string | null; title?: string | null; config?: string | null; startdate?: string | null; credit?: string | null }
interface CreateResult { isSuccess: boolean; msg: string; slug?: string }

/** Testable core: create a plan for a resolved username. */
export async function createPlanForUser(db: Kysely<DB>, username: string, args: CreateArgs): Promise<CreateResult> {
  let rawConfig = args.config ?? null;
  let title = args.title ?? null;
  if (args.programSlug) {
    const prog = await db.selectFrom('bom_readingplan_program').selectAll()
      .where('slug', '=', args.programSlug).where('active', '=', 1).executeTakeFirst();
    if (!prog) return { isSuccess: false, msg: 'INVALID_CONFIG' };
    rawConfig = typeof prog.config === 'string' ? prog.config : JSON.stringify(prog.config);
    title = title ?? prog.title;
  }
  const config = rawConfig ? parsePlanConfig(rawConfig) : null;
  if (!config) return { isSuccess: false, msg: 'INVALID_CONFIG' };
  if (args.credit === 'fresh' || args.credit === 'alltime') config.credit = args.credit;

  const active = await db.selectFrom('bom_readingplan').select('guid')
    .where('owner', '=', username).where('status', '=', 'active').executeTakeFirst();
  if (active) return { isSuccess: false, msg: 'ACTIVE_PLAN_EXISTS' };

  const startdate = args.startdate ?? new Date().toISOString().slice(0, 10);
  const gen = await generatePlanSegments(db, config, startdate);
  if (!gen.segments.length) return { isSuccess: false, msg: 'EMPTY_SCOPE' };

  const slug = `rp-${nanoid(10)}`;
  const last = gen.segments[gen.segments.length - 1]!;
  await db.insertInto('bom_readingplan').values({
    guid: randomBytes(16).toString('hex'),
    slug,
    title: title ?? 'Reading Plan',
    owner: username,
    startdate: new Date(`${startdate}T00:00:00Z`),
    duedate: last.duedate ? new Date(`${last.duedate}T00:00:00Z`) : null,
    status: 'active',
    config: JSON.stringify(config),
  }).execute();
  await db.insertInto('bom_readingplan_seg').values(gen.segments.map((s) => ({
    guid: randomBytes(16).toString('hex'),
    plan: slug,
    period: s.period,
    ref: s.ref,
    title: null,
    duedate: s.duedate ? new Date(`${s.duedate}T00:00:00Z`) : null,
    start: s.start,
    end: s.end,
    sectionGuids: JSON.stringify(s.sectionGuids),
  }))).execute();
  return { isSuccess: true, msg: 'OK', slug };
}

/** Testable core: end the active plan. */
export async function endPlanForUser(db: Kysely<DB>, username: string, action: 'COMPLETE' | 'ABANDON'): Promise<CreateResult> {
  const active = await db.selectFrom('bom_readingplan').select(['guid', 'slug'])
    .where('owner', '=', username).where('status', '=', 'active').executeTakeFirst();
  if (!active) return { isSuccess: false, msg: 'NO_ACTIVE_PLAN' };
  await db.updateTable('bom_readingplan')
    .set({ status: action === 'COMPLETE' ? 'completed' : 'abandoned', enddate: new Date() })
    .where('guid', '=', active.guid!)
    .execute();
  return { isSuccess: true, msg: 'OK', slug: active.slug ?? undefined };
}
```

Then the GraphQL `Mutation` block in the same file's `readingplanResolvers` (loadReadingPlan import comes from `'../../messaging/readingplan.js'` — match the existing import in `community.ts:470-486`):

```typescript
  Mutation: {
    startReadingPlan: async (_root, args, ctx: AppContext) => {
      try {
        const username = await resolveUsername(ctx, args.token as string);
        if (!username) return { isSuccess: false, msg: 'NOT_AUTHENTICATED', plan: null };
        const input = args.input as CreateArgs;
        const res = await createPlanForUser(ctx.db, username, input);
        if (!res.isSuccess) return { ...res, plan: null };
        const plan = await loadReadingPlan(ctx.db, res.slug!, { queryBy: username }, ctx.lang);
        return { isSuccess: true, msg: 'OK', plan };
      } catch (err) {
        console.error('startReadingPlan error:', err);
        return { isSuccess: false, msg: 'INVALID_CONFIG', plan: null };
      }
    },
    endReadingPlan: async (_root, args, ctx: AppContext) => {
      try {
        const username = await resolveUsername(ctx, args.token as string);
        if (!username) return { isSuccess: false, msg: 'NOT_AUTHENTICATED', plan: null };
        const res = await endPlanForUser(ctx.db, username, args.action as 'COMPLETE' | 'ABANDON');
        if (!res.isSuccess) return { ...res, plan: null };
        const plan = await loadReadingPlan(ctx.db, res.slug!, { queryBy: username }, ctx.lang);
        return { isSuccess: true, msg: 'OK', plan };
      } catch (err) {
        console.error('endReadingPlan error:', err);
        return { isSuccess: false, msg: 'NO_ACTIVE_PLAN', plan: null };
      }
    },
  },
```

- [ ] **Step 4: Run tests** — `cd backend && npx vitest run test/readingplan/mutations.test.ts` → 4 passed. Also `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/graphql/resolvers/readingplan.ts backend/test/readingplan/mutations.test.ts
git commit -m "feat(readingplan): startReadingPlan/endReadingPlan with one-active enforcement (TDD)"
```

### Task 10: updateReadingPlan (re-pace)

**Files:** Modify `backend/src/graphql/resolvers/readingplan.ts`, `backend/test/readingplan/mutations.test.ts`

- [ ] **Step 1: Add failing test** (append to the lifecycle describe block):

```typescript
  it('re-paces: replaces segments, scope immutable', async () => {
    // active plan exists from the abandon test above (5 daily parts)
    const rePace = { ...CONFIG, pacing: { type: 'cadence', unit: 'day', count: 3 }, segmentation: { type: 'even', parts: 3 } };
    const ok = await updatePlanForUser(db, testUser, JSON.stringify(rePace));
    expect(ok.isSuccess).toBe(true);
    const segs = await db.selectFrom('bom_readingplan_seg').selectAll().where('plan', '=', ok.slug!).execute();
    expect(segs).toHaveLength(3);

    const newScope = { ...CONFIG, scope: { type: 'range', start: 1, end: 200 } };
    const bad = await updatePlanForUser(db, testUser, JSON.stringify(newScope));
    expect(bad.msg).toBe('SCOPE_IMMUTABLE');
  });
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run test/readingplan/mutations.test.ts` → FAIL (`updatePlanForUser` not exported).

- [ ] **Step 3: Implement** (same file):

```typescript
export async function updatePlanForUser(db: Kysely<DB>, username: string, rawConfig: string): Promise<CreateResult> {
  const active = await db.selectFrom('bom_readingplan').selectAll()
    .where('owner', '=', username).where('status', '=', 'active').executeTakeFirst();
  if (!active) return { isSuccess: false, msg: 'NO_ACTIVE_PLAN' };
  const next = parsePlanConfig(rawConfig);
  if (!next) return { isSuccess: false, msg: 'INVALID_CONFIG' };
  const prev = parsePlanConfig(typeof active.config === 'string' ? active.config : JSON.stringify(active.config));
  if (!prev || JSON.stringify(prev.scope) !== JSON.stringify(next.scope)) {
    return { isSuccess: false, msg: 'SCOPE_IMMUTABLE' }; // spec: scope changes are a new plan
  }
  const startdate = new Date(active.startdate as unknown as string | Date).toISOString().slice(0, 10);
  const gen = await generatePlanSegments(db, next, startdate);
  if (!gen.segments.length) return { isSuccess: false, msg: 'EMPTY_SCOPE' };
  const last = gen.segments[gen.segments.length - 1]!;
  await db.deleteFrom('bom_readingplan_seg').where('plan', '=', active.slug!).execute();
  await db.insertInto('bom_readingplan_seg').values(gen.segments.map((s) => ({
    guid: randomBytes(16).toString('hex'), plan: active.slug!, period: s.period, ref: s.ref, title: null,
    duedate: s.duedate ? new Date(`${s.duedate}T00:00:00Z`) : null, start: s.start, end: s.end,
    sectionGuids: JSON.stringify(s.sectionGuids),
  }))).execute();
  await db.updateTable('bom_readingplan')
    .set({ config: JSON.stringify(next), duedate: last.duedate ? new Date(`${last.duedate}T00:00:00Z`) : null })
    .where('guid', '=', active.guid!)
    .execute();
  return { isSuccess: true, msg: 'OK', slug: active.slug ?? undefined };
}
```

And the mutation resolver (same shape as the others):

```typescript
    updateReadingPlan: async (_root, args, ctx: AppContext) => {
      try {
        const username = await resolveUsername(ctx, args.token as string);
        if (!username) return { isSuccess: false, msg: 'NOT_AUTHENTICATED', plan: null };
        const res = await updatePlanForUser(ctx.db, username, (args.input as { config: string }).config);
        if (!res.isSuccess) return { ...res, plan: null };
        const plan = await loadReadingPlan(ctx.db, res.slug!, { queryBy: username }, ctx.lang);
        return { isSuccess: true, msg: 'OK', plan };
      } catch (err) {
        console.error('updateReadingPlan error:', err);
        return { isSuccess: false, msg: 'INVALID_CONFIG', plan: null };
      }
    },
```

- [ ] **Step 4: Run tests** — `npx vitest run test/readingplan/mutations.test.ts` → 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/graphql/resolvers/readingplan.ts backend/test/readingplan/mutations.test.ts
git commit -m "feat(readingplan): updateReadingPlan re-pace with immutable scope (TDD)"
```

### Task 11: Plan loader — active-by-owner, `current`, credit window, auto-complete

**Files:** Modify `backend/src/messaging/readingplan.ts` (loadReadingPlan, lines ~143-209 today), `backend/src/graphql/resolvers/community.ts:470-486` (readingplan resolver), `backend/src/data/loaders/ported_community.ts` (segment loader credit floor)

This task modifies existing, working code — read `backend/src/messaging/readingplan.ts` fully before editing. The current flow: `loadPlanData()` fetches plan+segments, `completedGuids()` fetches the user's completed block guids with `timestamp > startUnix`, `scoreSegment()` scores each, then plan progress aggregates non-future segments.

- [ ] **Step 1: Extend `loadReadingPlan` behavior.** Make these exact semantic changes inside `backend/src/messaging/readingplan.ts`:

1. **Slug optional → active-by-owner.** New signature `loadReadingPlan(db, slug: string | null, { queryBy }, lang)`. When `slug` is falsy: look up `SELECT slug FROM bom_readingplan WHERE owner = queryBy AND status = 'active' LIMIT 1`; if none, return `null`.
2. **Select the new columns.** `loadPlanData` also selects `status`, `config`, `enddate` from `bom_readingplan`.
3. **Credit window.** Parse config with `parsePlanConfig` (import from `../readingplan/types.js`). If `config?.credit === 'alltime'`, call `completedGuids` with a floor of `0` instead of the plan-start unix timestamp. (One parameter — the query already takes the timestamp.)
4. **`current` index.** After computing per-segment progress:
   ```typescript
   const todayStr = fmtDate(new Date());
   let current: number;
   const hasDates = segments.some((s) => !!s.duedate);
   if (hasDates) {
     const idx = segments.findIndex((s) => s.duedate && fmtDate(new Date(s.duedate)) >= todayStr);
     current = idx === -1 ? segments.length - 1 : idx;   // plan over → last segment, never -1
   } else {
     const idx = segments.findIndex((s) => Number(s.progress) < 100);
     current = idx === -1 ? segments.length - 1 : idx;   // all done → last
   }
   ```
5. **Auto-complete.** If computed plan progress ≥ 100 and `status === 'active'`:
   ```typescript
   await db.updateTable('bom_readingplan').set({ status: 'completed', enddate: new Date() }).where('slug', '=', planSlug).execute();
   status = 'completed';
   ```
6. **Return the new fields** on the plan object: `status`, `config` (as the raw JSON string), `current`.

Legacy guard: the old `cfm2024` row has NULL `status`/`config` — all logic above must tolerate that (NULL status is never 'active' so auto-complete skips; NULL config means credit defaults to 'fresh', i.e., existing behavior; `readingplan(slug:"cfm2024")` keeps working unchanged).

- [ ] **Step 2: Update the query resolver.** In `backend/src/graphql/resolvers/community.ts:470-486`: the resolver currently requires a slug. Change so `args.slug` may be null and passes through; keep the anonymous-token fallback for the slug-provided path, but the no-slug path requires a resolved username (return null otherwise).

- [ ] **Step 3: Credit floor in the segment loader.** In `backend/src/data/loaders/ported_community.ts` (`loadReadingPlanSegment`, ~lines 95-270): it computes `planStartTimestamp` from plan startdate (lines ~122-126). It already fetches plan metadata — also fetch `config`; when parsed `credit === 'alltime'`, use `0` for the timestamp bound in the big completion query.

- [ ] **Step 4: Add loader test** (append to `backend/test/readingplan/mutations.test.ts` — the write-db fixture is already there):

```typescript
  it('loadReadingPlan: no-slug resolves active plan; current is never -1; new fields present', async () => {
    const { loadReadingPlan } = await import('../../src/messaging/readingplan.js');
    const plan = await loadReadingPlan(db, null, { queryBy: testUser }, 'en');
    expect(plan).toBeTruthy();
    expect(plan!.status).toBe('active');
    expect(typeof plan!.current).toBe('number');
    expect(plan!.current).toBeGreaterThanOrEqual(0);
    expect(plan!.config).toContain('"scope"');
  });
```

- [ ] **Step 5: Run** — `npx vitest run test/readingplan/` → all pass; `npx tsc --noEmit` → clean. Then curl the legacy path to prove no regression:
`curl -s -X POST http://localhost:5006/graphql -d '{"query":"{ readingplan(slug: \"cfm2024\") { slug title progress segments { period } } }"}' -H "Content-Type: application/json"`
Expected: same shape as before this task (49 segments).

- [ ] **Step 6: Commit**

```bash
git add backend/src/messaging/readingplan.ts backend/src/graphql/resolvers/community.ts backend/src/data/loaders/ported_community.ts backend/test/readingplan/mutations.test.ts
git commit -m "feat(readingplan): active-by-owner lookup, server current, credit window, auto-complete"
```

---

## Phase 4 — Frontend

### Task 12: API client entries

**Files:** Modify `frontend/webapp/src/models/GraphQLQueries.js`

- [ ] **Step 1: Update the existing `readingplan` entry** (lines ~1530-1554): make `slug` optional and add the new fields. Replace the query body with:

```javascript
readingplan: (input) => {
  input = input.shift();
  return {
    type: "readingplan",
    key: "token",
    val: false,
    query:
      `readingplan (token: ${JSON.stringify(input.token || "")}` +
      (input.slug ? `, slug: ${JSON.stringify(input.slug)}` : ``) + `)` +
      `{
        guid slug title startdate duedate progress status config current
        segments { guid period ref title duedate progress start end }
      }`,
  }
},
```

- [ ] **Step 2: Add the four new entries** (adjacent to `readingplan`, matching the house style — see `joinGroup` at lines 1386-1405 for the mutation shape):

```javascript
readingplanprograms: () => ({
  type: "readingplanprograms",
  key: "slug",
  val: false,
  query: `readingplanprograms { slug title description config scopeLabel durationLabel }`,
}),
readingplanpreview: (input) => {
  input = input.shift();
  return {
    type: "readingplanpreview",
    key: 0,
    val: input,
    query:
      `readingplanpreview (config: ${JSON.stringify(input.config)}` +
      (input.startdate ? `, startdate: ${JSON.stringify(input.startdate)}` : ``) + `)` +
      `{ parts enddate warnings { code detail } segments { period ref duedate blocks } }`,
  }
},
startReadingPlan: (input) => {
  input = input.shift();
  return {
    type: "startReadingPlan",
    key: 0,
    val: input,
    query: `mutation {
      startReadingPlan(
        token: ${JSON.stringify(input.token)}
        input: {
          ${input.programSlug ? `programSlug: ${JSON.stringify(input.programSlug)}` : ``}
          ${input.title ? `title: ${JSON.stringify(input.title)}` : ``}
          ${input.config ? `config: ${JSON.stringify(input.config)}` : ``}
          ${input.startdate ? `startdate: ${JSON.stringify(input.startdate)}` : ``}
          ${input.credit ? `credit: ${JSON.stringify(input.credit)}` : ``}
        }
      ) { isSuccess msg plan { slug } }
    }`,
  }
},
endReadingPlan: (input) => {
  input = input.shift();
  return {
    type: "endReadingPlan",
    key: 0,
    val: input,
    query: `mutation {
      endReadingPlan(token: ${JSON.stringify(input.token)}, action: ${input.action}) { isSuccess msg }
    }`,
  }
},
```

(`updateReadingPlan` client entry is deliberately omitted — no v1 UI consumes re-pacing yet; the backend mutation exists for the follow-up. YAGNI.)

- [ ] **Step 3: Manual verify** — with dev servers running, in a browser console on `localhost:8201`: `BoMOnlineAPI({readingplanprograms: null}).then(console.log)` → programs keyed by slug. (Or defer verification to Task 13's component tests, which mock this module.)

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js
git commit -m "feat(readingplan): client API entries for programs/preview/start/end"
```

### Task 13: Widget state machine + ActivePlan port

**Files:** Create `frontend/webapp/src/views/Home/ReadingPlan/index.js`, `ActivePlan.js`, `ReadingPlan.css`, `__tests__/ReadingPlan.test.js`; Delete `frontend/webapp/src/views/Home/ReadingPlan.js` + old `ReadingPlan.css`; Modify `Home.js:95`, `showcase.js:43`

Key contract changes vs the old component (all audit fixes):
- NO date math in the frontend — `plan.current` from the server picks the active segment (kills the `-1`/NaN family).
- NO progress recomputation — `plan.progress` is authoritative; delete the `nonFutureSegments` reduce entirely.
- Resume filter matches `"completed"` (with a not-completed fallback to index 0).
- Real error + empty states; `slug` in effect deps; no `Math.random()` keys; no render-time mutations; ONE ReactTooltip root per id; `Spinner`/`NavLink`/`useRouteMatch`/`history` dead imports not carried over.

- [ ] **Step 1: Write failing tests**

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/__tests__/ReadingPlan.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

jest.mock('src/models/BoMOnlineAPI', () => ({ __esModule: true, default: jest.fn(), ApiBaseUrl: 'http://t' }));
jest.mock('src/contexts/AppControllerContext', () => ({
  useAppController: () => ({ states: { user: { token: 'tkn', user: 'u1', social: null, progress: { completed: 0 } } } }),
}));
import BoMOnlineAPI from 'src/models/BoMOnlineAPI';
import { ReadingPlan } from '../index';

const plan = (over = {}) => ({
  slug: 'rp-x', title: 'My Plan', status: 'active', progress: 40, current: 1, config: '{}',
  startdate: '2026-07-01', duedate: '2026-08-01',
  segments: [
    { guid: 'g0', period: 'Day 1', ref: '1 Nephi 1', duedate: '2026-07-02', progress: 100, start: 1, end: 20 },
    { guid: 'g1', period: 'Day 2', ref: '1 Nephi 2', duedate: '2026-07-03', progress: 0, start: 21, end: 40 },
  ],
  ...over,
});

beforeEach(() => BoMOnlineAPI.mockReset());

test('renders active plan using server current (no local date math)', async () => {
  BoMOnlineAPI.mockImplementation((q) =>
    q.readingplan ? Promise.resolve({ readingplan: [plan()] })
      : Promise.resolve({ readingplansegment: [{ sections: [] }] }));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/My Plan/)).toBeInTheDocument());
  // segment 1 (server current) is the active one
  expect(document.querySelector('.segmentListItem.active')).toHaveTextContent(/2|%/);
  expect(screen.getByText(/40/)).toBeInTheDocument(); // server progress, not recomputed
});

test('no plan → gallery state', async () => {
  BoMOnlineAPI.mockImplementation((q) =>
    q.readingplan ? Promise.resolve({ readingplan: [null] })
      : Promise.resolve({ readingplanprograms: { 'p1': { slug: 'p1', title: 'Program One', description: '', durationLabel: '30 days' } } }));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/Program One/)).toBeInTheDocument());
});

test('fetch failure → error state with retry', async () => {
  BoMOnlineAPI.mockRejectedValue(new Error('boom'));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/rp_error_loading|Could not load/)).toBeInTheDocument());
});

test('completed plan → celebration state', async () => {
  BoMOnlineAPI.mockImplementation((q) =>
    q.readingplan ? Promise.resolve({ readingplan: [plan({ status: 'completed', progress: 100 })] }) : Promise.resolve({}));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/rp_plan_complete|complete/i)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run to verify failure** — `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false ReadingPlan` → FAIL (module not found).

- [ ] **Step 3: Implement `index.js`**

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/index.js
// Widget state machine: loading → none|active|completed|error (spec §Home widget).
// The server is authoritative for progress/current/status — this component does
// ZERO date math and ZERO progress arithmetic (see audit P0 #2/#3, P1 #6).
import React, { useCallback, useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { Card, CardBody, CardHeader, Button } from "reactstrap";
import loading from "../../_Common/svg/loadbar.svg";
import ActivePlan from "./ActivePlan";
import Gallery from "./Gallery";
import "./ReadingPlan.css";

export function ReadingPlan() {
  const appController = useAppController();
  const token = appController.states.user.token;
  const [state, setState] = useState({ phase: "loading", plan: null });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ phase: "loading", plan: null });
    BoMOnlineAPI({ readingplan: { token } }, { useCache: false })
      .then((r) => {
        if (cancelled) return;
        const plan = r?.readingplan?.[0] || Object.values(r?.readingplan || {})[0] || null;
        if (!plan || !plan.slug) setState({ phase: "none", plan: null });
        else setState({ phase: plan.status === "completed" ? "completed" : "active", plan });
      })
      .catch(() => !cancelled && setState({ phase: "error", plan: null }));
    return () => { cancelled = true; };
  }, [token]);
  useEffect(load, [load]);

  if (state.phase === "loading")
    return (
      <Card><CardHeader><h3>{label("reading_plan")}</h3></CardHeader>
        <CardBody className="spinnerBox"><img src={loading} alt="" style={{ height: "4rem" }} /></CardBody></Card>
    );
  if (state.phase === "error")
    return (
      <Card><CardBody className="rpError">
        <p>{label("rp_error_loading")}</p>
        <Button size="sm" onClick={load}>{label("rp_retry")}</Button>
      </CardBody></Card>
    );
  if (state.phase === "none") return <Gallery token={token} onStarted={load} />;
  if (state.phase === "completed")
    return (
      <Card><CardHeader><h3>{label("reading_plan")}: <span className="planName">{state.plan.title}</span></h3></CardHeader>
        <CardBody className="rpComplete">
          <p>🏆 {label("rp_plan_complete")}</p>
          <Button color="primary" size="sm" onClick={async () => {
            // status already completed server-side; just refresh into gallery via history view
            await BoMOnlineAPI({ endReadingPlan: { token, action: "COMPLETE" } });
            load();
          }}>{label("rp_start_another")}</Button>
        </CardBody></Card>
    );
  return <ActivePlan plan={state.plan} token={token} onChanged={load} />;
}
export default ReadingPlan;
```

- [ ] **Step 4: Implement `ActivePlan.js`** — port of the old renderer (old file `views/Home/ReadingPlan.js` is the reference for markup/classes; git history keeps it) with the contract fixes:

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/ActivePlan.js
// Active-plan renderer. Ported from the legacy ReadingPlan.js with the new
// server contract: plan.current picks the segment, plan.progress is authoritative.
import React, { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { Link } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { Card, CardHeader, CardBody, CardFooter, Button, Badge } from "reactstrap";
import SweetAlert from "react-bootstrap-sweetalert";
import { label } from "src/models/Utils";
import green from "../../User/svg/green.svg";
import yellow from "../../User/svg/yellow.svg";
import blank from "../../User/svg/blank.svg";
import theater from "../../_Common/svg/theater.svg";
import study from "../../_Common/svg/study.svg";
import loading from "../../_Common/svg/loadbar.svg";

function statusOf(plan) {
  const p = parseInt(plan.progress, 10) || 0;
  const selfPaced = !plan.segments.some((s) => !!s.duedate);
  if (selfPaced) return { label: `${p}%`, labelClass: p > 0 ? "green" : "gray" };
  if (p > 95) return { label: label("status_ontrack"), labelClass: "green" };
  if (p === 0) return { label: label("status_notstarted"), labelClass: "gray" };
  if (p > 50) return { label: label("status_catchingup"), labelClass: "yellow" };
  return { label: label("status_fallenbehind"), labelClass: "red" };
}

export default function ActivePlan({ plan, token, onChanged }) {
  const [activeSegment, setActiveSegment] = useState(plan.current || 0);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  useEffect(() => setActiveSegment(plan.current || 0), [plan.slug, plan.current]);
  const { label: statusLabel, labelClass } = statusOf(plan);
  const segment = plan.segments[activeSegment] || null;

  const abandon = async () => {
    setConfirmAbandon(false);
    await BoMOnlineAPI({ endReadingPlan: { token, action: "ABANDON" } });
    onChanged();
  };

  return (
    <Card className="noselect">
      <CardHeader>
        <h3>{label("reading_plan")}: <span className="planName">{plan.title}</span>
          <span className="rpAbandon" role="button" tabIndex={0} title={label("rp_abandon_plan")}
            onClick={() => setConfirmAbandon(true)}
            onKeyDown={(e) => e.key === "Enter" && setConfirmAbandon(true)}>×</span></h3>
        <div className="readingplan progressContainer">
          <div><Badge className={labelClass}>{statusLabel}</Badge></div>
          <div className="readingplan progress">
            <div style={{ width: `${plan.progress || 0}%` }} className={`progress-bar ${labelClass}`}> </div>
            <span>{plan.progress || 0}%</span>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <ReactTooltip place="top" effect="solid" id="segmentTips" />
        <div className="segmentList">
          {plan.segments.map((seg, i) => {
            const p = parseInt(seg.progress, 10) || 0;
            const statusClass = p === 100 ? "complete" : p > 0 ? "inProgress" : "notStarted";
            const timeClass = i < (plan.current || 0) ? "past" : i === (plan.current || 0) ? "current" : "future";
            return (
              <div key={seg.guid} role="button" tabIndex={0}
                data-for="segmentTips" data-tip={`${seg.period || ""} • ${seg.ref}`}
                className={`segmentListItem ${timeClass} ${statusClass} ${activeSegment === i ? "active" : ""}`}
                onClick={() => setActiveSegment(i)}
                onKeyDown={(e) => e.key === "Enter" && setActiveSegment(i)}>
                {p ? `${p}%` : i + 1}
              </div>
            );
          })}
        </div>
      </CardBody>
      <CardFooter>
        {segment && <SegmentDetail segment={segment} token={token} />}
      </CardFooter>
      <SweetAlert customClass="custom-alert" show={confirmAbandon} title={label("rp_abandon_plan")}
        onConfirm={abandon} onCancel={() => setConfirmAbandon(false)}
        confirmBtnBsStyle="danger" confirmBtnText={label("rp_abandon_plan")} cancelBtnText={label("cancel")} showCancel btnSize="">
        {label("rp_abandon_confirm")}
      </SweetAlert>
    </Card>
  );
}

function SegmentDetail({ segment, token }) {
  const [sectionData, setSectionData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setSectionData(null);
    BoMOnlineAPI({ readingplansegment: { token, guid: segment.guid } }, { useCache: false })
      .then((d) => !cancelled && setSectionData(d.readingplansegment?.[0] || Object.values(d.readingplansegment || {})[0] || { sections: [] }));
    return () => { cancelled = true; };
  }, [segment.guid, token]);
  if (!sectionData) return <div className="spinnerBox"><img src={loading} alt="" /></div>;

  const flat = (sectionData.sections || []).flatMap((s) => s.sectionText || []);
  // Resume point: first block NOT completed (fixes audit P0 #4 — value is "completed")
  const studySlug = (flat.find((i) => i.status !== "completed") || flat[0])?.slug;
  const title = segment.title ? `${segment.ref} • ${segment.title}` : segment.ref;

  return (
    <div className="segment">
      <h4>{segment.period ? <span className="period">{segment.period}</span> : null}{title}</h4>
      <div className="buttonRow">
        {studySlug && <Link to={`/${studySlug}`}><Button color="primary" size="sm">
          <img src={study} alt="" /> {label("menu_study")}</Button></Link>}
        <Link to={`/theater/plan/${segment.guid}`}><Button color="secondary" size="sm">
          <img src={theater} alt="" /> {label("menu_theater")}</Button></Link>
      </div>
      <div className="segmentSections">
        {(sectionData.sections || []).map((section) => <SectionCard section={section} key={section.guid || section.slug} />)}
      </div>
    </div>
  );
}

function SectionCard({ section }) {
  const { title, slug, sectionText = [] } = section;
  const done = sectionText.filter((i) => i.status === "completed").length;
  const pct = sectionText.length ? ((done / sectionText.length) * 100).toFixed(1) : 0;
  return (
    <>
      <ReactTooltip place="bottom" effect="solid" id={`sectionDotTips-${slug}`} />
      <Link to={`/${slug}`}>
        <div className="segmentSection">
          <div className="miniprogress"><div style={{ width: `${pct}%` }} className="progressBar" /></div>
          <h6>{title}</h6>
          <div className="sectionDots">
            {sectionText.map((item, i) => (
              <img key={i} data-for={`sectionDotTips-${slug}`} data-tip={item.heading} alt=""
                src={item.status === "completed" ? green : item.status === "started" ? yellow : blank} />
            ))}
          </div>
        </div>
      </Link>
    </>
  );
}
```

- [ ] **Step 5: Create `ReadingPlan.css`** in the folder: copy the OLD `frontend/webapp/src/views/Home/ReadingPlan.css` **lines 1-279 only** (the audit found lines ~280-545 are a wholesale duplicate — drop them), keep all class names identical (dark mode depends on them), and append:

```css
/* Gallery / wizard / error additions */
.rpError { text-align: center; padding: 2em; }
.rpComplete { text-align: center; padding: 2em; font-size: 1.2em; }
.rpAbandon { float: right; cursor: pointer; opacity: 0.3; font-weight: 400; }
.rpAbandon:hover { opacity: 1; }
.programGallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1em; }
.programCard { border: 1px solid #ddd; border-radius: 0.5em; padding: 1em; cursor: pointer; }
.programCard:hover { border-color: #6bd098; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.programCard .duration { color: #888; font-size: 0.85em; }
.rpWizard .stepDots { text-align: center; letter-spacing: 0.5em; margin-bottom: 1em; }
.rpWizard .previewRail { border-top: 2px solid #ccc; margin-top: 1em; padding-top: 0.6em; font-size: 0.9em; display: flex; justify-content: space-between; align-items: center; }
.rpWizard .scopeList { max-height: 40vh; overflow-y: auto; text-align: left; }
.rpWizard .scopeList label { display: block; padding: 0.3em 0.5em; cursor: pointer; }
.rpWizard .scopeList .sizeBadge { color: #888; font-size: 0.85em; margin-left: 0.5ex; }
.rpWizard .paceOption { display: block; padding: 0.5em; border: 1px solid #ddd; border-radius: 0.4em; margin: 0.4em 0; cursor: pointer; text-align: left; }
.rpWizard .paceOption.selected { border-color: #6bd098; background: rgba(107, 208, 152, 0.08); }
```

- [ ] **Step 6: Delete old files, fix imports.** `git rm frontend/webapp/src/views/Home/ReadingPlan.js frontend/webapp/src/views/Home/ReadingPlan.css`. In `Home.js:95` and `showcase.js:43` change `<ReadingPlan slug={"cfm2024"}/>` → `<ReadingPlan />` (import path `./ReadingPlan` / `../../Home/ReadingPlan` now resolves to the folder's index.js — verify the exact existing import specifiers and keep them). Note Gallery.js does not exist yet — create a stub so tests compile:

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/Gallery.js  (stub — real version in Task 14)
import React, { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { Card, CardBody, CardHeader } from "reactstrap";
import { label } from "src/models/Utils";
export default function Gallery({ token, onStarted }) {
  const [programs, setPrograms] = useState(null);
  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ readingplanprograms: null }, { useCache: false })
      .then((r) => !c && setPrograms(Object.values(r?.readingplanprograms || {})));
    return () => { c = true; };
  }, []);
  return (
    <Card><CardHeader><h3>{label("rp_start_a_plan")}</h3></CardHeader>
      <CardBody className="programGallery">
        {(programs || []).map((p) => <div className="programCard" key={p.slug}><h5>{p.title}</h5>
          <p>{p.description}</p><div className="duration">{p.durationLabel}</div></div>)}
      </CardBody></Card>
  );
}
```

- [ ] **Step 7: Run tests** — `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false ReadingPlan` → 4 passed. Also run the full suite (`CI=true npx react-scripts test --watchAll=false`) — no regressions (Home.js compiles).

- [ ] **Step 8: Commit**

```bash
git add -A frontend/webapp/src/views/Home
git commit -m "feat(readingplan): widget state machine + ActivePlan on server contract; delete legacy component"
```

### Task 14: Gallery start flow

**Files:** Modify `frontend/webapp/src/views/Home/ReadingPlan/Gallery.js`; Create `__tests__/Gallery.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/__tests__/Gallery.test.js
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('src/models/BoMOnlineAPI', () => ({ __esModule: true, default: jest.fn(), ApiBaseUrl: 'http://t' }));
import BoMOnlineAPI from 'src/models/BoMOnlineAPI';
import Gallery from '../Gallery';

const programs = { p1: { slug: 'p1', title: 'Program One', description: 'desc', durationLabel: '30 days', config: '{}' } };

test('start flow: pick program → confirm → startReadingPlan called → onStarted', async () => {
  const onStarted = jest.fn();
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.readingplanprograms !== undefined) return Promise.resolve({ readingplanprograms: programs });
    if (q.startReadingPlan) return Promise.resolve({ startReadingPlan: { isSuccess: true, msg: 'OK' } });
    return Promise.resolve({});
  });
  render(<Gallery token="tkn" onStarted={onStarted} />);
  await waitFor(() => screen.getByText('Program One'));
  fireEvent.click(screen.getByText('Program One'));
  fireEvent.click(screen.getByText(/rp_start_plan|Start plan/));
  await waitFor(() => expect(onStarted).toHaveBeenCalled());
  const call = BoMOnlineAPI.mock.calls.find((c) => c[0].startReadingPlan);
  expect(call[0].startReadingPlan).toMatchObject({ token: 'tkn', programSlug: 'p1' });
});

test('ACTIVE_PLAN_EXISTS shows the friendly error', async () => {
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.readingplanprograms !== undefined) return Promise.resolve({ readingplanprograms: programs });
    if (q.startReadingPlan) return Promise.resolve({ startReadingPlan: { isSuccess: false, msg: 'ACTIVE_PLAN_EXISTS' } });
    return Promise.resolve({});
  });
  render(<Gallery token="tkn" onStarted={jest.fn()} />);
  await waitFor(() => screen.getByText('Program One'));
  fireEvent.click(screen.getByText('Program One'));
  fireEvent.click(screen.getByText(/rp_start_plan|Start plan/));
  await waitFor(() => expect(screen.getByText(/rp_active_exists|active plan/i)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run to verify failure** — `CI=true npx react-scripts test --watchAll=false Gallery` → FAIL (no confirm UI yet).

- [ ] **Step 3: Implement the full Gallery** (replace stub):

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/Gallery.js
// No-plan state: seeded program cards → confirm (start date + credit) → start.
// "Build your own" opens the Wizard (Task 15).
import React, { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { Card, CardBody, CardHeader, Button } from "reactstrap";
import { toast } from "react-toastify";
import { label } from "src/models/Utils";
import Wizard from "./Wizard";

export default function Gallery({ token, onStarted }) {
  const [programs, setPrograms] = useState(null);
  const [picked, setPicked] = useState(null);        // program being confirmed
  const [credit, setCredit] = useState("fresh");
  const [startdate, setStartdate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ readingplanprograms: null }, { useCache: false })
      .then((r) => !c && setPrograms(Object.values(r?.readingplanprograms || {})));
    return () => { c = true; };
  }, []);

  const start = async () => {
    setBusy(true);
    const r = await BoMOnlineAPI({ startReadingPlan: { token, programSlug: picked.slug, startdate, credit } });
    setBusy(false);
    const res = r?.startReadingPlan;
    if (res?.isSuccess) return onStarted();
    toast.error(res?.msg === "ACTIVE_PLAN_EXISTS" ? label("rp_active_exists") : label("rp_error_loading"));
  };

  return (
    <Card className="noselect">
      <CardHeader><h3>{label("rp_start_a_plan")}</h3></CardHeader>
      <CardBody>
        {!picked && (
          <>
            <div className="programGallery">
              {(programs || []).map((p) => (
                <div className="programCard" key={p.slug} role="button" tabIndex={0}
                  onClick={() => setPicked(p)} onKeyDown={(e) => e.key === "Enter" && setPicked(p)}>
                  <h5>{p.title}</h5><p>{p.description}</p><div className="duration">{p.durationLabel}</div>
                </div>
              ))}
            </div>
            <div className="buttonRow" style={{ marginTop: "1em" }}>
              <Button color="secondary" size="sm" onClick={() => setWizardOpen(true)}>{label("rp_build_your_own")}</Button>
            </div>
          </>
        )}
        {picked && (
          <div className="programConfirm">
            <h5>{picked.title}</h5>
            <div><label>{label("rp_start_date")}{" "}
              <input type="date" value={startdate} onChange={(e) => setStartdate(e.target.value)} /></label></div>
            <div><label><input type="checkbox" checked={credit === "alltime"}
              onChange={(e) => setCredit(e.target.checked ? "alltime" : "fresh")} />{" "}
              {label("rp_count_past_reading")}</label></div>
            <div className="buttonRow" style={{ marginTop: "1em" }}>
              <Button color="secondary" size="sm" onClick={() => setPicked(null)}>{label("rp_back")}</Button>
              <Button color="primary" size="sm" disabled={busy} onClick={start}>
                {label(busy ? "rp_starting" : "rp_start_plan")}</Button>
            </div>
          </div>
        )}
        {wizardOpen && <Wizard token={token} onClose={() => setWizardOpen(false)} onStarted={onStarted} />}
      </CardBody>
    </Card>
  );
}
```

(Task 15 creates Wizard.js — until then add a temporary `Wizard.js` exporting `() => null` so the suite compiles, replaced next task.)

- [ ] **Step 4: Run tests** — both Gallery tests pass; ReadingPlan tests still pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/ReadingPlan
git commit -m "feat(readingplan): gallery start flow with credit toggle + start date"
```

### Task 15: The wizard (3 steps)

**Files:** Replace `frontend/webapp/src/views/Home/ReadingPlan/Wizard.js`; Create `__tests__/Wizard.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/__tests__/Wizard.test.js
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('src/models/BoMOnlineAPI', () => ({ __esModule: true, default: jest.fn(), ApiBaseUrl: 'http://t' }));
import BoMOnlineAPI from 'src/models/BoMOnlineAPI';
import Wizard from '../Wizard';

const contents = {
  d1: { title: 'Division One', slug: 'division-one',
    pages: [{ title: 'Page A', slug: 'page-a', sections: [{ title: 's1', slug: 'x' }, { title: 's2', slug: 'y' }] }] },
};
const preview = { parts: 3, enddate: '2026-08-14', warnings: [], segments: [
  { period: 'Day 1', ref: '1 Nephi 1–2', duedate: '2026-07-16', blocks: 4 }] };

beforeEach(() => {
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.contents !== undefined) return Promise.resolve({ contents });
    if (q.readingplanpreview) return Promise.resolve({ readingplanpreview: [preview] });
    if (q.startReadingPlan) return Promise.resolve({ startReadingPlan: { isSuccess: true, msg: 'OK' } });
    return Promise.resolve({});
  });
});

test('walks scope → pace → confirm → start', async () => {
  const onStarted = jest.fn();
  render(<Wizard token="tkn" onClose={jest.fn()} onStarted={onStarted} />);
  await waitFor(() => screen.getByText('Page A'));
  fireEvent.click(screen.getByLabelText(/Page A/));            // pick scope
  fireEvent.click(screen.getByText(/rp_next|Next/));           // → pace
  fireEvent.click(screen.getByText(/rp_pace_daily|Daily/));    // pick pacing
  fireEvent.click(screen.getByText(/rp_next|Next/));           // → confirm (preview fires)
  await waitFor(() => expect(screen.getByText(/1 Nephi 1–2/)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/rp_start_plan|Start plan/));
  await waitFor(() => expect(onStarted).toHaveBeenCalled());
  const call = BoMOnlineAPI.mock.calls.find((c) => c[0].startReadingPlan)[0].startReadingPlan;
  const cfg = JSON.parse(call.config);
  expect(cfg.scope).toEqual({ type: 'pages', slugs: ['page-a'] });
  expect(cfg.pacing.type).toBe('cadence');
});

test('blocks Next on empty scope', async () => {
  render(<Wizard token="tkn" onClose={jest.fn()} onStarted={jest.fn()} />);
  await waitFor(() => screen.getByText('Page A'));
  fireEvent.click(screen.getByText(/rp_next|Next/));
  expect(screen.getByText(/rp_empty_scope|at least one/i)).toBeInTheDocument();
});

test('shows clamp warning from preview', async () => {
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.contents !== undefined) return Promise.resolve({ contents });
    if (q.readingplanpreview) return Promise.resolve({ readingplanpreview: [{ ...preview, parts: 2, warnings: [{ code: 'PARTS_CLAMPED', detail: 2 }] }] });
    return Promise.resolve({});
  });
  render(<Wizard token="tkn" onClose={jest.fn()} onStarted={jest.fn()} />);
  await waitFor(() => screen.getByText('Page A'));
  fireEvent.click(screen.getByLabelText(/Page A/));
  fireEvent.click(screen.getByText(/rp_next|Next/));
  fireEvent.click(screen.getByText(/rp_pace_daily|Daily/));
  fireEvent.click(screen.getByText(/rp_next|Next/));
  await waitFor(() => expect(screen.getByText(/rp_clamped|supports up to/i)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run to verify failure** — `CI=true npx react-scripts test --watchAll=false Wizard` → FAIL (stub renders null).

- [ ] **Step 3: Implement the wizard**

```javascript
// frontend/webapp/src/views/Home/ReadingPlan/Wizard.js
// 3-step builder (spec D7/D8): What (tabbed checklist+basket) → How fast → Confirm.
// Scope compiles to page slugs (site tab) or a canonical verse range (books tab).
// Preview = the SAME server generator, dry-run — never local math.
import React, { useEffect, useMemo, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import SweetAlert from "react-bootstrap-sweetalert";
import { Button } from "reactstrap";
import { toast } from "react-toastify";
import { label } from "src/models/Utils";
import { lookup } from "scripture-guide";

const BOOKS = ["1 Nephi", "2 Nephi", "Jacob", "Enos", "Jarom", "Omni", "Words of Mormon",
  "Mosiah", "Alma", "Helaman", "3 Nephi", "4 Nephi", "Mormon", "Ether", "Moroni"];

function bookRange(names) {
  // union of contiguous canonical picks → single verse range
  const ids = names.flatMap((n) => { const r = lookup(n); return Array.isArray(r) ? r : r.verse_ids || []; });
  return { type: "range", start: Math.min(...ids), end: Math.max(...ids) };
}

export default function Wizard({ token, onClose, onStarted }) {
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState("guide");
  const [contents, setContents] = useState(null);
  const [pickedPages, setPickedPages] = useState([]);   // page slugs
  const [pickedBooks, setPickedBooks] = useState([]);   // canonical book names
  const [pace, setPace] = useState(null);               // 'daily' | 'weekly' | 'bydate' | 'selfpaced'
  const [count, setCount] = useState(30);
  const [due, setDue] = useState("");
  const [credit, setCredit] = useState("fresh");
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ contents: null }).then((r) => !c && setContents(Object.values(r?.contents || {})));
    return () => { c = true; };
  }, []);

  const config = useMemo(() => {
    const scope = tab === "books" && pickedBooks.length
      ? bookRange(pickedBooks)
      : { type: "pages", slugs: pickedPages };
    const pacing = pace === "daily" ? { type: "cadence", unit: "day", count: Number(count) }
      : pace === "weekly" ? { type: "cadence", unit: "week", count: Number(count) }
      : pace === "bydate" ? { type: "calendar", due }
      : { type: "selfpaced" };
    const segmentation = pace === "daily" || pace === "weekly"
      ? { type: "even", parts: Number(count) }
      : { type: "section" };
    return { scope, pacing, segmentation, credit };
  }, [tab, pickedPages, pickedBooks, pace, count, due, credit]);

  const scopeEmpty = (tab === "guide" && !pickedPages.length) || (tab === "books" && !pickedBooks.length);

  const next = async () => {
    setErr(null);
    if (step === 0 && scopeEmpty) return setErr(label("rp_empty_scope"));
    if (step === 1) {
      if (!pace) return setErr(label("rp_wizard_pace"));
      const r = await BoMOnlineAPI({ readingplanpreview: { config: JSON.stringify(config) } }, { useCache: false });
      setPreview(r?.readingplanpreview?.[0] || Object.values(r?.readingplanpreview || {})[0] || null);
    }
    setStep(step + 1);
  };

  const start = async () => {
    setBusy(true);
    const r = await BoMOnlineAPI({ startReadingPlan: { token, config: JSON.stringify(config) } });
    setBusy(false);
    const res = r?.startReadingPlan;
    if (res?.isSuccess) { onClose(); return onStarted(); }
    toast.error(res?.msg === "ACTIVE_PLAN_EXISTS" ? label("rp_active_exists") : label("rp_error_loading"));
  };

  const togglePage = (slug) => setPickedPages((p) => p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]);
  const toggleBook = (name) => setPickedBooks((p) => p.includes(name) ? p.filter((s) => s !== name) : [...p, name]);
  const clamped = preview?.warnings?.find((w) => w.code === "PARTS_CLAMPED");

  return (
    <SweetAlert customClass="sweet-alert-modal rpWizard" show title={label("rp_start_a_plan")}
      onConfirm={() => {}} onCancel={onClose} showConfirm={false} showCancel cancelBtnText={label("cancel")} btnSize="">
      {() => (
        <div>
          <div className="stepDots">{[0, 1, 2].map((i) => (i === step ? "●" : "○"))}</div>
          {step === 0 && (
            <div>
              <h5>{label("rp_wizard_what")}</h5>
              <div className="buttonRow">
                <Button size="sm" color={tab === "guide" ? "primary" : "secondary"} onClick={() => setTab("guide")}>{label("rp_tab_guide")}</Button>
                <Button size="sm" color={tab === "books" ? "primary" : "secondary"} onClick={() => setTab("books")}>{label("rp_tab_books")}</Button>
              </div>
              <div className="scopeList">
                {tab === "guide" && (contents || []).map((div) => (
                  <div key={div.slug}>
                    <strong>{div.title}</strong>
                    {(div.pages || []).map((pg) => (
                      <label key={pg.slug}>
                        <input type="checkbox" checked={pickedPages.includes(pg.slug)} onChange={() => togglePage(pg.slug)} />
                        {" "}{pg.title}
                        <span className="sizeBadge">({(pg.sections || []).length} {label("rp_sections")})</span>
                      </label>
                    ))}
                  </div>
                ))}
                {tab === "books" && BOOKS.map((b) => (
                  <label key={b}>
                    <input type="checkbox" checked={pickedBooks.includes(b)} onChange={() => toggleBook(b)} /> {b}
                  </label>
                ))}
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <h5>{label("rp_wizard_pace")}</h5>
              {[["daily", "rp_pace_daily"], ["weekly", "rp_pace_weekly"], ["bydate", "rp_pace_bydate"], ["selfpaced", "rp_pace_selfpaced"]].map(([k, lbl]) => (
                <div key={k} role="button" tabIndex={0} className={`paceOption ${pace === k ? "selected" : ""}`}
                  onClick={() => setPace(k)} onKeyDown={(e) => e.key === "Enter" && setPace(k)}>
                  {label(lbl)}
                  {pace === k && (k === "daily" || k === "weekly") && (
                    <input type="number" min="1" max="365" value={count}
                      onClick={(e) => e.stopPropagation()} onChange={(e) => setCount(e.target.value)} style={{ width: "5em", marginLeft: "1ex" }} />
                  )}
                  {pace === k && k === "bydate" && (
                    <input type="date" value={due} onClick={(e) => e.stopPropagation()} onChange={(e) => setDue(e.target.value)} style={{ marginLeft: "1ex" }} />
                  )}
                </div>
              ))}
              <label style={{ display: "block", marginTop: "1em" }}>
                <input type="checkbox" checked={credit === "alltime"} onChange={(e) => setCredit(e.target.checked ? "alltime" : "fresh")} />
                {" "}{label("rp_count_past_reading")}
              </label>
            </div>
          )}
          {step === 2 && (
            <div>
              <h5>{label("rp_wizard_confirm")}</h5>
              {clamped && <p className="text-warning">{label("rp_clamped", [clamped.detail])}</p>}
              <p>{preview?.parts} {label("rp_parts")}{preview?.enddate ? ` · ${label("rp_ends")} ${preview.enddate}` : ""}</p>
              <div className="scopeList">
                {(preview?.segments || []).slice(0, 12).map((s, i) => (
                  <div key={i}>{s.period ? `${s.period} — ` : ""}{s.ref}</div>
                ))}
                {preview?.segments?.length > 12 && <div>…</div>}
              </div>
            </div>
          )}
          {err && <p className="text-danger">{err}</p>}
          <div className="previewRail">
            <span>{step > 0 && <Button size="sm" color="secondary" onClick={() => setStep(step - 1)}>{label("rp_back")}</Button>}</span>
            <span>
              {step < 2 && <Button size="sm" color="primary" onClick={next}>{label("rp_next")}</Button>}
              {step === 2 && <Button size="sm" color="primary" disabled={busy} onClick={start}>{label(busy ? "rp_starting" : "rp_start_plan")}</Button>}
            </span>
          </div>
        </div>
      )}
    </SweetAlert>
  );
}
```

Note: `scripture-guide` must exist in `frontend/webapp/package.json` — check first (`grep scripture-guide frontend/webapp/package.json`). If absent: `cd frontend/webapp && npm install scripture-guide --save`. If its `lookup` return shape differs from `{verse_ids}`/array, probe in a node REPL and fix `bookRange` (same shape question as backend Task 2).

- [ ] **Step 4: Run tests** — all 3 Wizard tests pass; full ReadingPlan folder suite green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/ReadingPlan frontend/webapp/package.json frontend/webapp/package-lock.json
git commit -m "feat(readingplan): 3-step creation wizard with server-driven preview"
```

### Task 16: Dark mode + full-suite + browser smoke

**Files:** Modify `frontend/webapp/src/assets/theme/scss/darkmode.scss` (readingplan block, lines ~130-273)

- [ ] **Step 1: Add dark rules for the new surfaces** inside the existing `html[data-theme="dark"]` readingplan area (~line 252, after the badge rules):

```scss
    /* custom-plans additions: gallery, wizard, error/complete states */
    .programCard {
        border-color: #555;
        background-color: #2a2a2a;
        .duration { color: #999; }
        &:hover { border-color: #5cb85c; }
    }
    .rpWizard .paceOption { border-color: #555; &.selected { border-color: #5cb85c; background: rgba(92, 184, 92, 0.12); } }
    .rpWizard .previewRail { border-top-color: #555; }
    .rpWizard .scopeList .sizeBadge { color: #999; }
    .rpError, .rpComplete { color: #ddd; }
```

- [ ] **Step 2: Full test suites**

Run: `cd backend && npm test` → all green (readingplan suites + pre-existing; note `socket.test.ts` always skips here — expected).
Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` → all green.

- [ ] **Step 3: Browser smoke on dev** (Playwright, system chromium `/usr/bin/chromium-browser` with `--no-sandbox --disable-dev-shm-usage`, against `http://localhost:8201`):
1. `/home` signed-out → gallery renders program cards (no dead CFM widget).
2. Click a program → confirm panel → date + credit toggle visible.
3. "Build your own" → wizard opens → pick a page → Next → Daily → Next → preview shows parts + refs (screenshot).
4. Toggle dark mode (`document.documentElement.setAttribute('data-theme','dark')`) → gallery/wizard legible (screenshot).
5. Zero pageerrors in console capture.

- [ ] **Step 4: Update docs.** `docs/api/queries.md` + `docs/api/mutations.md`: add the new queries/mutations (follow the files' existing entry format). Append a "Resolved by" note to `docs/audits/2026-07-15-reading-plan-audit.md` pointing at this plan.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode.scss docs/api docs/audits/2026-07-15-reading-plan-audit.md
git commit -m "feat(readingplan): dark mode for gallery/wizard; API docs; audit closure note"
```

### Task 17: Acceptance pass + cleanup gate

- [ ] **Step 1: Walk the spec's 8 acceptance criteria** (spec §Acceptance criteria) against the running dev stack; record each result in the final report. #3 (credit toggle changes initial progress) needs a real signed-in user with history — verify via `readingplanpreview`+`startReadingPlan` on a test account, or document as manually-verified-by-owner.

- [ ] **Step 2: cfm2024 cleanup — DO NOT DELETE.** Present to the owner for approval as a follow-up: `DELETE FROM bom_readingplan_seg WHERE plan='cfm2024'; DELETE FROM bom_readingplan WHERE slug='cfm2024';` (prod data removal — owner sign-off required per spec §Rollout 4).

- [ ] **Step 3: Final code review** of the whole branch (subagent-driven-development's final review step), then finishing-a-development-branch.

---

## Self-review (writing-plans checklist)

- **Spec coverage:** D1-D10 all land in tasks (D1/D2/D3 → Task 9/13/14; D4/D6/D10 → Tasks 1-2; D5 → Tasks 3-6, 9; D7/D8 → Task 15; D9 → Tasks 3, 5). Widget states → Task 13; errors → Tasks 8-9, 13-15; rollout order matches phases; acceptance → Task 17. `updateReadingPlan` backend exists (Task 10), client deliberately deferred (YAGNI, noted).
- **Placeholders:** none — every code step has real code; the two runtime-verify points (scripture-guide `lookup` shape, `bom_slug.type` value, `bom_label` unique key) have explicit probe commands and fallback instructions, not TBDs.
- **Type consistency:** `PlanConfig`/`ScopedSection`/`SegmentDraft` defined once (Task 3) and imported everywhere; `createPlanForUser`/`endPlanForUser`/`updatePlanForUser` signatures match between Tasks 9/10 tests and implementations; GraphQL field names match SDL (Task 7) ↔ resolvers (Tasks 8-11) ↔ client entries (Task 12) ↔ component reads (Tasks 13-15).
