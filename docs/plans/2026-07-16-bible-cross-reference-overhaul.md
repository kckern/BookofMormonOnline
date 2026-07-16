# Bible Cross-Reference Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the circle-matrix at `/analysis/bible` with the ribbon overview + anchored master-detail + repaired reader specified in `docs/specs/2026-07-16-bible-cross-reference-overhaul.md`.

**Architecture:** Four pure, unit-tested modules (`canon`, `aggregate`, `urlState`, `ribbonLayout`) feed thin React components; a single controller derives every render from the URL (no component-held navigation state). The verse-pair reader is repaired in place. Old matrix code is deleted at the end.

**Tech Stack:** React 17 (functional components), react-router v5 (`useRouteMatch`/`useHistory`), CRA 5 via react-app-rewired, Jest + @testing-library/react (already in devDeps), hand-rolled SVG (no new dependencies), `scripture-guide` (already a dependency), app dark-mode tokens (`html[data-theme="dark"]` CSS vars).

**Working directory for all commands:** `frontend/webapp/` unless stated. Test command shorthand used throughout:

```bash
CI=true npm test -- --watchAll=false --testPathPattern="views/Analysis/Bible"
```

**Read first:** the spec (above), the audit (`docs/audits/2026-07-16-bible-cross-reference-ux-dataviz-audit.md`), and skim `src/views/Analysis/Bible/Bible.js` + `VerseView.js` — you are replacing the former and repairing the latter.

**Key domain facts you need:**
- `src/views/Analysis/Bible/data.js` exports `index`: 2,957 triplets `[bomVerseId, bibleVerseId, isQuote]`. **The first element is the Book of Mormon verse id** (range 31103–37706), the second is the Bible verse id (1–31102). The old code destructures these with reversed names — do not copy its naming.
- Verse ids are global sequential ints. Book ranges live in the `bible`/`bom` literals in `Bible.js:18-126`.
- The `bom` literal contains **two "Mormon" rows** (Plates of Mormon group: 36884–37032, ch 1–7; Moroni group: 37033–37110, ch 8–9). The canon module must merge them into one 9-chapter book.
- `scripture-guide` provides `lookupReference(ref, lang) → {verse_ids}` and `generateReference(vid, lang) → "1 Nephi 3:12"`.
- Routing: `models/Routes.js:157` maps `/analysis/:value*` → `views/Analysis/Analysis.js`, which renders the Bible view when `value` starts with `"bible"`. The view receives the rest of the path via `useRouteMatch().params.value`.

---

## Phase 0 — Branch

### Task 0: Create the feature branch

**Step 1:** From repo root:
```bash
git checkout dev && git pull && git checkout -b feature/bible-crossref-overhaul
```
**Step 2:** Confirm clean: `git status` → "nothing to commit".

---

## Phase 1 — Pure modules (all TDD, no React)

### Task 1: `canon.js` — canon structure + slug resolution

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Bible/canon.js`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/canon.test.js`

**Step 1: Write the failing test**

```js
import { canons, bookBySlug, bookOfVid, slugify } from "../canon";

describe("canon", () => {
  test("slugify strips apostrophes and lowercases", () => {
    expect(slugify("Solomon's Song")).toBe("solomons-song");
    expect(slugify("1 Nephi")).toBe("1-nephi");
  });

  test("bible canon has 66 books in 9 groups; bom has 15 in 3", () => {
    expect(canons.kjv.books).toHaveLength(66);
    expect(canons.kjv.groups).toHaveLength(9);
    expect(canons.bom.books).toHaveLength(15);
    expect(canons.bom.groups).toHaveLength(3);
  });

  test("duplicate Mormon rows are merged into one 9-chapter book", () => {
    const mormon = canons.bom.books.filter((b) => b.name === "Mormon");
    expect(mormon).toHaveLength(1);
    expect(mormon[0]).toMatchObject({ start: 36884, end: 37110, chapters: 9 });
  });

  test("bookBySlug is case-insensitive and canon-scoped", () => {
    expect(bookBySlug("bom", "2-NEPHI").name).toBe("2 Nephi");
    expect(bookBySlug("kjv", "isaiah").name).toBe("Isaiah");
    expect(bookBySlug("kjv", "2-nephi")).toBeUndefined();
  });

  test("bookOfVid finds the containing book", () => {
    expect(bookOfVid("bom", 31103).name).toBe("1 Nephi");
    expect(bookOfVid("kjv", 17656).name).toBe("Isaiah");
    expect(bookOfVid("bom", 37110).name).toBe("Mormon");
    expect(bookOfVid("kjv", 99999)).toBeUndefined();
  });

  test("every book knows its group and verse count", () => {
    const isaiah = bookBySlug("kjv", "isaiah");
    expect(isaiah.group).toBe("Major Prophets");
    expect(isaiah.verses).toBe(18947 - 17656 + 1);
  });
});
```

**Step 2: Run to verify it fails**

```bash
CI=true npm test -- --watchAll=false --testPathPattern="views/Analysis/Bible"
```
Expected: FAIL — `Cannot find module '../canon'`.

**Step 3: Implement**

Copy the `bible` and `bom` object literals **verbatim** from `Bible.js:18-101` and `Bible.js:103-126` into `canon.js` as `const BIBLE_RAW` / `const BOM_RAW` (they stay in `Bible.js` too until the Task 14 cleanup). Then:

```js
export const slugify = (str) =>
  (str || "").toLowerCase().replace(/['’]/g, "").replace(/\s+/g, "-");

const buildCanon = (key, label, raw) => {
  const books = [];
  const groups = [];
  for (const [groupName, rows] of Object.entries(raw)) {
    const group = { name: groupName, slug: slugify(groupName), books: [] };
    for (const [name, start, end, chapters] of rows) {
      const existing = books.find((b) => b.name === name);
      if (existing) {
        // canon splits one book across two groups (e.g. Mormon): merge.
        existing.start = Math.min(existing.start, start);
        existing.end = Math.max(existing.end, end);
        existing.chapters += chapters;
        existing.verses = existing.end - existing.start + 1;
        continue;
      }
      const book = {
        name, start, end, chapters,
        verses: end - start + 1,
        group: groupName,
        slug: slugify(name),
        canon: key,
      };
      books.push(book);
      group.books.push(book);
    }
    groups.push(group);
  }
  return { key, label, books, groups };
};

export const canons = {
  kjv: buildCanon("kjv", "Bible", BIBLE_RAW),
  bom: buildCanon("bom", "Book of Mormon", BOM_RAW),
};

export const bookBySlug = (canonKey, slug) =>
  canons[canonKey]?.books.find((b) => b.slug === slugify(slug));

export const bookOfVid = (canonKey, vid) =>
  canons[canonKey]?.books.find((b) => vid >= b.start && vid <= b.end);
```

**Step 4: Run tests — expect PASS** (same command).

**Step 5: Commit**
```bash
git add src/views/Analysis/Bible/canon.js src/views/Analysis/Bible/__tests__/canon.test.js
git commit -m "feat(analysis/bible): canon module with merged books and slug lookup"
```

---

### Task 2: `urlState.js` — URL codec (the single source of truth)

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Bible/urlState.js`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/urlState.test.js`

**Step 1: Failing test**

```js
import { parseValue, serialize } from "../urlState";

describe("urlState", () => {
  test.each([
    ["bible", { view: "overview" }],
    ["bible/", { view: "overview" }],
    ["bible/bom/2-nephi", { view: "anchor", canon: "bom", book: "2 Nephi" }],
    ["bible/bom/2-nephi/12", { view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 }],
    ["bible/kjv/isaiah", { view: "anchor", canon: "kjv", book: "Isaiah" }],
    ["bible/bom/2-nephi~isaiah", { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" }],
    ["bible/bom/2-nephi/12~isaiah", { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", bomChapter: 12 }],
  ])("parses %s", (value, expected) => {
    expect(parseValue(value)).toEqual(expected);
  });

  test("legacy two-book URL becomes a reader state", () => {
    expect(parseValue("bible/1-nephi~genesis")).toEqual({
      view: "reader", bomBook: "1 Nephi", bibleBook: "Genesis",
    });
  });

  test("legacy group/garbage slugs degrade to overview, never throw", () => {
    expect(parseValue("bible/plates-of-mormon~torah")).toEqual({ view: "overview" });
    expect(parseValue("bible/nonsense/whatever")).toEqual({ view: "overview" });
    expect(parseValue(undefined)).toEqual({ view: "overview" });
  });

  test("serialize ⇄ parse round-trips every state shape", () => {
    const states = [
      { view: "overview" },
      { view: "anchor", canon: "bom", book: "2 Nephi" },
      { view: "anchor", canon: "kjv", book: "Isaiah" },
      { view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 },
      { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" },
      { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", bomChapter: 12 },
    ];
    for (const s of states) {
      expect(parseValue(serialize(s).replace(/^\/analysis\//, ""))).toEqual(s);
    }
  });

  test("serialize produces /analysis/bible paths", () => {
    expect(serialize({ view: "anchor", canon: "kjv", book: "Isaiah" }))
      .toBe("/analysis/bible/kjv/isaiah");
  });
});
```

**Step 2: Run — expect FAIL** (module not found).

**Step 3: Implement**

```js
import { bookBySlug, slugify } from "./canon";

const OVERVIEW = { view: "overview" };

// value is useRouteMatch().params.value, e.g. "bible/bom/2-nephi/12~isaiah"
export const parseValue = (value) => {
  if (!value) return OVERVIEW;
  const rest = value.replace(/^bible\/?/, "").replace(/\/+$/, "");
  if (!rest) return OVERVIEW;

  const [left, right] = rest.split("~");
  const seg = left.split("/").filter(Boolean);

  if (right !== undefined) {
    const bible = bookBySlug("kjv", right);
    if (!bible) return OVERVIEW;
    if (seg[0] === "bom") {
      const bom = bookBySlug("bom", seg[1]);
      if (!bom) return OVERVIEW;
      const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
      const state = { view: "reader", bomBook: bom.name, bibleBook: bible.name };
      if (chapter >= 1 && chapter <= bom.chapters) state.bomChapter = chapter;
      return state;
    }
    // legacy: "<bom-book>~<bible-book>"
    const bom = bookBySlug("bom", seg[0]);
    if (seg.length === 1 && bom)
      return { view: "reader", bomBook: bom.name, bibleBook: bible.name };
    return OVERVIEW;
  }

  if (seg[0] === "bom" || seg[0] === "kjv") {
    const book = bookBySlug(seg[0], seg[1]);
    if (!book) return OVERVIEW;
    const state = { view: "anchor", canon: seg[0], book: book.name };
    const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
    if (chapter >= 1 && chapter <= book.chapters) state.chapter = chapter;
    return state;
  }
  return OVERVIEW;
};

export const serialize = (state) => {
  const base = "/analysis/bible";
  if (!state || state.view === "overview") return base;
  if (state.view === "anchor")
    return `${base}/${state.canon}/${slugify(state.book)}${state.chapter ? `/${state.chapter}` : ""}`;
  if (state.view === "reader")
    return `${base}/bom/${slugify(state.bomBook)}${state.bomChapter ? `/${state.bomChapter}` : ""}~${slugify(state.bibleBook)}`;
  return base;
};
```

**Step 4: Run — expect PASS.**

**Step 5: Commit** — `feat(analysis/bible): URL codec with legacy fallback`

---

### Task 3: `aggregate.js` — rollups of the pair index

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Bible/aggregate.js`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/aggregate.test.js`

**Step 1: Failing test**

```js
import {
  headline, partnersFor, pairStats, chapterCounts, pairsFor, bookTotal,
} from "../aggregate";

describe("aggregate", () => {
  test("headline matches the dataset", () => {
    expect(headline.total).toBe(2957);
    expect(headline.quotes).toBe(766);
    expect(headline.phrases).toBe(2957 - 766);
  });

  test("partnersFor(bom, 2 Nephi) is ranked with Isaiah first", () => {
    const partners = partnersFor("bom", "2 Nephi");
    expect(partners[0].book.name).toBe("Isaiah");
    expect(partners[0].total).toBeGreaterThan(partners[1]?.total ?? 0);
    // quotes + phrases always sum to total
    for (const p of partners) expect(p.quotes + p.phrases).toBe(p.total);
  });

  test("partnersFor is symmetric in total mass", () => {
    const fromBom = partnersFor("bom", "2 Nephi").find((p) => p.book.name === "Isaiah");
    const fromKjv = partnersFor("kjv", "Isaiah").find((p) => p.book.name === "2 Nephi");
    expect(fromBom.total).toBe(fromKjv.total);
    expect(pairStats("2 Nephi", "Isaiah").total).toBe(fromBom.total);
  });

  test("bookTotal sums that book's partner list", () => {
    const partners = partnersFor("bom", "2 Nephi");
    const sum = partners.reduce((a, p) => a + p.total, 0);
    expect(bookTotal("bom", "2 Nephi")).toBe(sum);
  });

  test("chapterCounts covers every chapter and sums to the book total", () => {
    const counts = chapterCounts("bom", "2 Nephi");
    expect(counts).toHaveLength(33);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(bookTotal("bom", "2 Nephi"));
  });

  test("pairsFor returns raw triplets scoped to the pair (and chapter)", () => {
    const all = pairsFor("2 Nephi", "Isaiah");
    expect(all.length).toBe(pairStats("2 Nephi", "Isaiah").total);
    const ch12 = pairsFor("2 Nephi", "Isaiah", 12);
    expect(ch12.length).toBeGreaterThan(0);
    expect(ch12.length).toBeLessThan(all.length);
  });
});
```

**Step 2: Run — expect FAIL.**

> If Jest instead fails to parse `scripture-guide` (ESM import error), add to the existing `"jest"` block in `frontend/webapp/package.json`:
> ```json
> "transformIgnorePatterns": ["node_modules/(?!(scripture-guide)/)"]
> ```
> CRA 5 supports this key. Commit that separately if needed.

**Step 3: Implement**

```js
import { generateReference } from "scripture-guide";
import { index } from "./data";
import { canons, bookOfVid } from "./canon";

// index rows are [bomVerseId, bibleVerseId, isQuote] — verified against canon
// ranges (bom: 31103+, bible: <=31102). Keep this ordering everywhere.

const pairMap = new Map();      // "2 Nephi|Isaiah" -> {total, quotes}
const totals = { bom: new Map(), kjv: new Map() };

for (const [bomVid, bibleVid, isQuote] of index) {
  const bomBook = bookOfVid("bom", bomVid);
  const bibleBook = bookOfVid("kjv", bibleVid);
  if (!bomBook || !bibleBook) continue;
  const key = `${bomBook.name}|${bibleBook.name}`;
  const entry = pairMap.get(key) || { total: 0, quotes: 0 };
  entry.total += 1;
  if (isQuote) entry.quotes += 1;
  pairMap.set(key, entry);
  totals.bom.set(bomBook.name, (totals.bom.get(bomBook.name) || 0) + 1);
  totals.kjv.set(bibleBook.name, (totals.kjv.get(bibleBook.name) || 0) + 1);
}

export const headline = {
  total: index.length,
  quotes: index.reduce((a, [, , q]) => a + (q ? 1 : 0), 0),
  get phrases() { return this.total - this.quotes; },
};

export const pairStats = (bomBookName, bibleBookName) => {
  const e = pairMap.get(`${bomBookName}|${bibleBookName}`);
  return e
    ? { total: e.total, quotes: e.quotes, phrases: e.total - e.quotes }
    : { total: 0, quotes: 0, phrases: 0 };
};

export const bookTotal = (canonKey, bookName) => totals[canonKey].get(bookName) || 0;

export const allPairs = () =>
  [...pairMap.entries()].map(([key, e]) => {
    const [bomBookName, bibleBookName] = key.split("|");
    return { bomBookName, bibleBookName, total: e.total, quotes: e.quotes, phrases: e.total - e.quotes };
  });

export const partnersFor = (canonKey, bookName) => {
  const partnerCanon = canonKey === "bom" ? "kjv" : "bom";
  return canons[partnerCanon].books
    .map((book) => {
      const s = canonKey === "bom" ? pairStats(bookName, book.name) : pairStats(book.name, bookName);
      return { book, ...s };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);
};

// --- chapter machinery -------------------------------------------------
const chapterCache = new Map();

export const chapterOfVid = (vid) => {
  // "1 Nephi 3:12" -> 3. Digits-before-colon is locale-stable for our use.
  const ref = generateReference(vid);
  const m = String(ref).match(/(\d+):\d+\s*$/);
  return m ? Number(m[1]) : 1; // single-chapter books may omit the chapter
};

export const chapterCounts = (canonKey, bookName, partnerName) => {
  const cacheKey = `${canonKey}|${bookName}|${partnerName || ""}`;
  if (chapterCache.has(cacheKey)) return chapterCache.get(cacheKey);
  const book = canons[canonKey].books.find((b) => b.name === bookName);
  const counts = Array.from({ length: book.chapters }, () => 0);
  const vidCol = canonKey === "bom" ? 0 : 1;
  const otherCol = 1 - vidCol;
  const partnerCanon = canonKey === "bom" ? "kjv" : "bom";
  for (const row of index) {
    const vid = row[vidCol];
    if (vid < book.start || vid > book.end) continue;
    if (partnerName && bookOfVid(partnerCanon, row[otherCol])?.name !== partnerName) continue;
    const ch = chapterOfVid(vid);
    if (ch >= 1 && ch <= book.chapters) counts[ch - 1] += 1;
  }
  chapterCache.set(cacheKey, counts);
  return counts;
};

export const pairsFor = (bomBookName, bibleBookName, bomChapter) => {
  const bom = canons.bom.books.find((b) => b.name === bomBookName);
  const bible = canons.kjv.books.find((b) => b.name === bibleBookName);
  if (!bom || !bible) return [];
  return index.filter(([bomVid, bibleVid]) => {
    if (bomVid < bom.start || bomVid > bom.end) return false;
    if (bibleVid < bible.start || bibleVid > bible.end) return false;
    if (bomChapter && chapterOfVid(bomVid) !== bomChapter) return false;
    return true;
  });
};
```

**Step 4: Run — expect PASS.** If `headline.quotes` differs from 766, the dataset changed since this plan — update the literal in the test to the printed actual and note it in the commit message.

**Step 5: Commit** — `feat(analysis/bible): pair-index aggregation module`

---

### Task 4: `ribbonLayout.js` — pure geometry for the overview

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Bible/ribbonLayout.js`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/ribbonLayout.test.js`

**Step 1: Failing test**

```js
import { layoutSpine, layoutRibbons, ribbonPath } from "../ribbonLayout";

const left = [{ key: "A", weight: 100 }, { key: "B", weight: 300 }];
const right = [{ key: "X", weight: 200 }, { key: "Y", weight: 200 }];
const links = [
  { left: "A", right: "X", value: 10 },
  { left: "B", right: "X", value: 30 },
  { left: "B", right: "Y", value: 10 },
];

describe("ribbonLayout", () => {
  test("layoutSpine is proportional, gapped, ordered, and fills the height", () => {
    const spine = layoutSpine(left, 402, 2); // 400 usable + one 2px gap
    expect(spine.get("A").y0).toBe(0);
    expect(spine.get("A").y1).toBeCloseTo(100, 5);
    expect(spine.get("B").y0).toBeCloseTo(102, 5);
    expect(spine.get("B").y1).toBeCloseTo(402, 5);
  });

  test("ribbons partition each node's span pro-rata and respect minPx", () => {
    const { ribbons } = layoutRibbons({ left, right, links, height: 402, gap: 2, minPx: 1.5 });
    expect(ribbons).toHaveLength(3);
    const bX = ribbons.find((r) => r.left === "B" && r.right === "X");
    const bY = ribbons.find((r) => r.left === "B" && r.right === "Y");
    // B's two ribbons tile B's left-side span without overlap
    expect(bX.lY1).toBeLessThanOrEqual(bY.lY0 + 0.001);
    // every ribbon at least minPx thick on both ends
    for (const r of ribbons) {
      expect(r.lY1 - r.lY0).toBeGreaterThanOrEqual(1.5);
      expect(r.rY1 - r.rY0).toBeGreaterThanOrEqual(1.5);
    }
  });

  test("ribbonPath emits a closed cubic path", () => {
    const d = ribbonPath({ lY0: 0, lY1: 10, rY0: 50, rY1: 80 }, 0, 300);
    expect(d).toMatch(/^M 0,0 C /);
    expect(d).toMatch(/Z$/);
  });
});
```

**Step 2: Run — expect FAIL.**

**Step 3: Implement**

```js
// Pure geometry for the bipartite ribbon overview. No React, no DOM.

export const layoutSpine = (items, height, gap = 2) => {
  const totalWeight = items.reduce((a, i) => a + i.weight, 0);
  const usable = height - gap * (items.length - 1);
  const scale = usable / totalWeight;
  const out = new Map();
  let y = 0;
  for (const item of items) {
    const h = item.weight * scale;
    out.set(item.key, { y0: y, y1: y + h });
    y += h + gap;
  }
  return out;
};

// Allocate each node's span among its ribbons pro-rata by value, ordered by
// the partner's position (reduces crossings). minPx keeps hairlines visible.
export const layoutRibbons = ({ left, right, links, height, gap = 2, minPx = 1.5 }) => {
  const leftSpine = layoutSpine(left, height, gap);
  const rightSpine = layoutSpine(right, height, gap);

  const slot = (spine, key, myLinks, valueOf, partnerY) => {
    const { y0, y1 } = spine.get(key);
    const span = y1 - y0;
    const total = myLinks.reduce((a, l) => a + valueOf(l), 0);
    const sorted = [...myLinks].sort((a, b) => partnerY(a) - partnerY(b));
    const raw = sorted.map((l) => (valueOf(l) / total) * span);
    const scaled = raw.map((h) => Math.max(h, minPx));
    const overflow = scaled.reduce((a, b) => a + b, 0) - span;
    // if minPx pushed us over the span, shrink the largest slots to fit
    if (overflow > 0) {
      const shrinkable = scaled.map((h) => h - minPx);
      const shrinkTotal = shrinkable.reduce((a, b) => a + b, 0) || 1;
      for (let i = 0; i < scaled.length; i++)
        scaled[i] -= (shrinkable[i] / shrinkTotal) * overflow;
    }
    const out = new Map();
    let y = y0;
    for (let i = 0; i < sorted.length; i++) {
      out.set(sorted[i], { y0: y, y1: y + scaled[i] });
      y += scaled[i];
    }
    return out;
  };

  const ribbons = [];
  const byLeft = new Map(), byRight = new Map();
  for (const l of links) {
    (byLeft.get(l.left) || byLeft.set(l.left, []).get(l.left)).push(l);
    (byRight.get(l.right) || byRight.set(l.right, []).get(l.right)).push(l);
  }
  const leftSlots = new Map(), rightSlots = new Map();
  for (const [key, ls] of byLeft)
    leftSlots.set(key, slot(leftSpine, key, ls, (l) => l.value, (l) => rightSpine.get(l.right).y0));
  for (const [key, ls] of byRight)
    rightSlots.set(key, slot(rightSpine, key, ls, (l) => l.value, (l) => leftSpine.get(l.left).y0));

  for (const l of links) {
    const L = leftSlots.get(l.left).get(l);
    const R = rightSlots.get(l.right).get(l);
    ribbons.push({ ...l, lY0: L.y0, lY1: L.y1, rY0: R.y0, rY1: R.y1 });
  }
  return { leftSpine, rightSpine, ribbons };
};

export const ribbonPath = ({ lY0, lY1, rY0, rY1 }, x0, x1) => {
  const mx = (x0 + x1) / 2;
  return [
    `M ${x0},${lY0}`,
    `C ${mx},${lY0} ${mx},${rY0} ${x1},${rY0}`,
    `L ${x1},${rY1}`,
    `C ${mx},${rY1} ${mx},${lY1} ${x0},${lY1}`,
    "Z",
  ].join(" ");
};
```

**Step 4: Run — expect PASS.** (If the `byLeft.get(...) || byLeft.set(...)` idiom trips lint, expand it to a plain two-line guard — behavior over cleverness.)

**Step 5: Commit** — `feat(analysis/bible): pure ribbon layout geometry`

---

## Phase 2 — Controller shell

### Task 5: `index.jsx` — URL-driven controller

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Bible/index.jsx`
- Create (placeholders): `Overview.jsx`, `AnchorView.jsx`, `Reader.jsx` in the same directory
- Modify: `frontend/webapp/src/views/Analysis/Analysis.js:12` — change `import Bible from "./Bible/Bible.js"` to `import Bible from "./Bible"`
- Test: `__tests__/controller.test.js`

**Step 1: Failing test**

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import Bible from "../index";

const at = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Route path="/analysis/:value*"><Bible /></Route>
    </MemoryRouter>
  );

describe("controller", () => {
  test("overview at /analysis/bible", () => {
    at("/analysis/bible");
    expect(screen.getByTestId("xref-overview")).toBeInTheDocument();
  });
  test("anchor at /analysis/bible/bom/2-nephi", () => {
    at("/analysis/bible/bom/2-nephi");
    expect(screen.getByTestId("xref-anchor")).toBeInTheDocument();
    expect(document.title).toMatch(/2 Nephi/);
  });
  test("reader at /analysis/bible/bom/2-nephi~isaiah", () => {
    at("/analysis/bible/bom/2-nephi~isaiah");
    expect(screen.getByTestId("xref-reader")).toBeInTheDocument();
  });
  test("garbage URL falls back to overview", () => {
    at("/analysis/bible/plates-of-mormon~torah");
    expect(screen.getByTestId("xref-overview")).toBeInTheDocument();
  });
});
```

**Step 2: Run — expect FAIL.**

**Step 3: Implement.** Placeholders first (`Overview.jsx` etc. each render `<div data-testid="xref-overview" />`-style stubs accepting the props below). Controller:

```jsx
import React, { useEffect } from "react";
import { useRouteMatch, useHistory } from "react-router-dom";
import { parseValue, serialize } from "./urlState";
import { label } from "src/models/Utils";
import Overview from "./Overview";
import AnchorView from "./AnchorView";
import Reader from "./Reader";
import "./crossref.css";

export default function BibleCrossRef() {
  const { params: { value } } = useRouteMatch();
  const history = useHistory();
  const state = parseValue(value);
  const navigate = (next) => history.push(serialize(next));

  useEffect(() => {
    const name =
      state.view === "anchor" ? state.book :
      state.view === "reader" ? `${state.bomBook} × ${state.bibleBook}` :
      label("menu_analysis");
    document.title = `${name} | ${label("home_title")}`;
  }, [value]); // derived from URL, never from rendered DOM

  if (state.view === "anchor") return <AnchorView state={state} navigate={navigate} />;
  if (state.view === "reader") return <Reader state={state} navigate={navigate} />;
  return <Overview navigate={navigate} />;
}
```

Create an empty `crossref.css` now so the import resolves. Update the `Analysis.js` import.

**Step 4: Run — expect PASS.** Also boot the dev server (`BROWSER=none PORT=8210 npm start`) and confirm `/analysis/bible` renders the stub, and browser Back/Forward moves between stub states after clicking a nav you temporarily wire (or just editing the URL bar).

**Step 5: Commit** — `feat(analysis/bible): URL-driven controller shell replacing matrix entry`

---

## Phase 3 — Anchored view (the workhorse; build before the ribbon)

### Task 6: `PartnerBars.jsx` — ranked stacked bars

**Files:** Create `PartnerBars.jsx`; test `__tests__/partnerBars.test.js`

**Step 1: Failing test** — render `<PartnerBars canon="bom" book="2 Nephi" onSelect={jest.fn()} />`; assert: Isaiah is the first row; each row's `aria-label` matches `/Isaiah, \d+ references, \d+ quotes/`; rows beyond 8 are hidden behind a "Show all" button that reveals them; clicking a row calls `onSelect` with the partner book name.

**Step 2: FAIL. Step 3: Implement.**

```jsx
import React, { useState } from "react";
import { partnersFor } from "./aggregate";

const FOLD = 8;

export default function PartnerBars({ canon, book, chapter, highlight, onSelect }) {
  const [showAll, setShowAll] = useState(false);
  const partners = partnersFor(canon, book); // chapter scoping added in Task 8
  const max = partners[0]?.total || 1;
  const visible = showAll ? partners : partners.slice(0, FOLD);

  if (!partners.length)
    return (
      <div className="xref-empty">
        No known correspondences between {book} and the {canon === "bom" ? "Bible" : "Book of Mormon"}.
      </div>
    );

  return (
    <div className="xref-bars" role="list">
      {visible.map(({ book: partner, total, quotes, phrases }) => (
        <button
          key={partner.name}
          role="listitem"
          className={`xref-bar ${highlight === partner.name ? "highlighted" : ""}`}
          aria-label={`${partner.name}, ${total} references, ${quotes} quotes`}
          onClick={() => onSelect(partner.name)}
        >
          <span className="xref-bar-label">{partner.name}</span>
          <span className="xref-bar-track">
            <span className="xref-bar-quote" style={{ width: `${(quotes / max) * 100}%` }} />
            <span className="xref-bar-phrase" style={{ width: `${(phrases / max) * 100}%` }} />
          </span>
          <span className="xref-bar-count">{total}</span>
        </button>
      ))}
      {partners.length > FOLD && !showAll && (
        <button className="xref-showall" onClick={() => setShowAll(true)}>
          Show all {partners.length}
        </button>
      )}
    </div>
  );
}
```

**Step 4: PASS. Step 5: Commit** — `feat(analysis/bible): ranked quote/phrase partner bars`

### Task 7: `Rail.jsx` + `ChapterStrip.jsx`

**Files:** Create both; test `__tests__/rail.test.js`

**Step 1: Failing test** — `<Rail canon="bom" book="2 Nephi" onAnchor={fn} onChapter={fn} />`: renders 15 book buttons; the anchored book is `aria-current`; the chapter strip renders 33 cells as a `radiogroup`; clicking cell 12 calls `onChapter(12)`; clicking the current chapter calls `onChapter(undefined)` (toggle off); each cell's `aria-label` includes its count.

**Step 2: FAIL. Step 3: Implement.** `Rail` maps `canons[canon].books` grouped by `groups`, each row: name + mini density bar (`bookTotal / max(bookTotal over canon)` width). `ChapterStrip` maps `chapterCounts(canon, book)` to cells; fill class = ramp step `Math.ceil((count / maxChapterCount) * 6)` (0 = blank cell); `role="radio"`, `aria-checked`, arrow-key handler moving focus. Keep both components under ~60 lines; counts printed only in `aria-label`/tooltip, not inside 12px cells.

**Step 4: PASS. Step 5: Commit** — `feat(analysis/bible): anchor rail with chapter density strip`

### Task 8: `AnchorView.jsx` — assembly

**Files:** Create `AnchorView.jsx` (replace stub); test `__tests__/anchorView.test.js`

**Step 1: Failing test** — render at `state={view:'anchor',canon:'bom',book:'2 Nephi'}` with a spy `navigate`:
- heading "2 Nephi draws on"; flip button labeled `anchor on Bible`; breadcrumb links Overview.
- clicking flip calls `navigate({view:'anchor',canon:'kjv',book:<top partner>})` when a partner is highlighted, else `{view:'overview'}`→ **no**: flip with no pair context anchors the mirror question — assert it navigates to `{view:'anchor',canon:'kjv',book:'Isaiah'}` only when Isaiah is highlighted; with no highlight it navigates to overview-with-bible-rail? — **Decision (spec §4.2):** flip with no pair context re-anchors on the anchor's *top partner*. Assert that.
- selecting a partner calls `navigate({view:'reader',bomBook:'2 Nephi',bibleBook:'Isaiah'})`; with chapter 12 in state, `bomChapter: 12` is included.
- chapter select calls `navigate({view:'anchor',...,chapter:12})`; scope chip renders and its ✕ clears chapter.

**Step 2: FAIL. Step 3: Implement.** Compose Rail + PartnerBars + header (heading, total via `bookTotal`, legend, flip, breadcrumb, scope chip). Chapter scoping of bars: when `state.chapter` set, compute per-partner chapter-scoped totals with `chapterCounts(canon, book, partnerName)[chapter-1]` — add a `scopedPartnersFor(canon, book, chapter)` helper to `aggregate.js` (with a unit test) rather than filtering in the component. Bible-anchored reader selection maps to `{view:'reader', bomBook: partnerName, bibleBook: state.book}`.

**Step 4: PASS. Step 5:** Manual check in the dev server: `/analysis/bible/bom/2-nephi` and `/analysis/bible/kjv/isaiah` render real ranked data; browser Back walks history. **Step 6: Commit** — `feat(analysis/bible): anchored master-detail view`

---

## Phase 4 — Reader repairs

### Task 9: `highlighter.jsx` — remove debug output, pin behavior

**Files:** Modify `highlighter.jsx:1-14`; test `__tests__/highlighter.test.js`

**Step 1: Failing test**

```js
import { generateHighlightedText } from "../highlighter";
import { highlightTextJSX } from "../highlighter";
import { render } from "@testing-library/react";

test("matched phrase is wrapped in a highlight span", () => {
  const { container } = render(<p>{highlightTextJSX("I have dreamed a dream", ["dreamed a dream"], 1)}</p>);
  expect(container.querySelector(".highlight").textContent).toBe("dreamed a dream");
});

test("unmatched highlight degrades to plain text — never a debug dump", () => {
  const { container } = render(<p>{highlightTextJSX("plain verse text", ["no such phrase"], 1)}</p>);
  expect(container.querySelector("pre")).toBeNull();
  expect(container.textContent).toBe("plain verse text");
});
```

**Step 2: FAIL** (the `<pre>` renders today). **Step 3:** Rewrite `highlightTextJSX` to return only the JSX span (delete the `debug`/`cutpointCount` branch); verify the unmatched-case text passes through unchanged (fix `generateHighlightedText`'s cut logic if the second test exposes text loss — it currently blanks `cutText[0]` unconditionally when no match starts at 0). **Step 4: PASS. Step 5: Commit** — `fix(analysis/bible): highlighter degrades gracefully, no debug output`

### Task 10: `Reader.jsx` — URL-scoped, paginated, de-alerted

**Files:** Create `Reader.jsx` (replace stub; port from `VerseView.js`); test `__tests__/reader.test.js` (mock `src/models/BoMOnlineAPI`)

**Step 1: Failing test** — with `BoMOnlineAPI` mocked to resolve canned verses/highlights:
- renders pair rows for `pairsFor("2 Nephi","Isaiah")` scope, first page only (20), with a "Load more (N remaining)" button;
- quote rows show a `QUOTE` badge;
- no `alert` spy fired anywhere; zero-pair scope renders inline empty state (component, not `window.alert`);
- BoM ref cell is a link with `href^="/read/"`; Bible ref cell is not a link;
- sort toggle flips row order and the active arrow sits on the sorted column.

**Step 2: FAIL. Step 3: Implement.** Port the table rendering from `VerseView.js` (keep the two-column layout, `header_container` markup, Esc handling — Esc now calls `navigate` back to the anchor state). Changes:
- scope from `props.state` (`bomBook`, `bibleBook`, `bomChapter`) via `pairsFor`;
- fetch in pages of 20 (`BoMOnlineAPI({verses, versehighlights})` per chunk, default cache **on**), append results; keep previous page rendered while loading the next;
- `navigateToSearch` replaced by `<Link to={"/read/" + verseIdToSlug([vid])}>` for BoM refs (import `verseIdToSlug` the same way `views/Read/Read.js:330` does); Bible refs plain text;
- sort arrow: `active = sort.column === col`, glyph by `sort.direction` — delete the `sort.column !== 'row'` branch;
- delete `console.log`, both `alert()`s, and the `className={isQuote ? "" : ""}` no-ops; add `{isQuote && <span className="xref-quote-badge">QUOTE</span>}` to the ref row.

**Step 4: PASS**, plus manual check against the live backend if available (dev host) — otherwise note in the commit that live fetch was not exercised. **Step 5: Commit** — `feat(analysis/bible): scoped paginated reader with quote badges`

### Task 11: Delete `VerseView.js`

**Files:** Delete `VerseView.js`; grep `git grep -n "VerseView"` → only historical docs may reference it.
**Steps:** delete, run full test pattern, commit — `chore(analysis/bible): remove superseded VerseView`.

---

## Phase 5 — Overview

### Task 12: `Overview.jsx` — spines + ribbons

**Files:** Create `Overview.jsx` (replace stub) + `TableTwin.jsx`; test `__tests__/overview.test.js`

**Step 1: Failing test**
- renders an SVG with 66 + 15 spine segments (`[data-book]` rects) and one path per nonzero book pair (assert count equals `allPairs().length`);
- headline strip shows `2,957` (or current) total;
- each spine segment button has an `aria-label` with name + total refs;
- clicking a BoM segment calls `navigate({view:'anchor',canon:'bom',book:...})`; clicking a ribbon calls `navigate({view:'anchor',canon:'bom',book:<bom side>, highlight:<bible side>})` — add optional `highlight` passthrough to `AnchorView` (query-free: keep it in component state passed via `history.push` location state, since it's ephemeral emphasis, not addressable state);
- toggle switches to `TableTwin` (a `<table>` with one row per pair, sortable by refs).

**Step 2: FAIL. Step 3: Implement.**
- Build spine inputs from `canons` (`{key: book.name, weight: book.verses}`), links from `allPairs()` (`{left: bibleBookName, right: bomBookName, value: total}`); call `layoutRibbons` with measured container height (use a `ResizeObserver` or `useLayoutEffect` + `clientHeight`; re-layout on resize — this also replaces the old mount-time-only orientation sampling).
- Each ribbon = **two paths** sharing the slot: quote core (`--xref-quote`, thickness ∝ quotes) and phrase remainder (`--xref-phrase`), 0.65 fill-opacity.
- Hover/focus: set `active` state = book or ribbon; CSS dims `.xref-ribbon:not(.active)` to 0.15 when anything is active. Tooltip = positioned `<div role="status">` fed by the active item (content per spec §4.1).
- Spine keyboard: segments are `<g role="listitem"><rect/><text/></g>` wrapped in focusable buttons via `tabIndex=0` + `onKeyDown` arrows; canonical order.
- Load animation: CSS `@keyframes` fade with `animation-delay: calc(var(--i) * 4ms)`; wrap in `@media (prefers-reduced-motion: no-preference)`.
- Mobile (<700px): pass division-level spines/links (aggregate `allPairs()` by group) — compute with a `groupPairs()` helper added to `aggregate.js` (unit-tested).

**Step 4: PASS + visual QA milestone (spec §10):** screenshot the rendered overview (dev server + Playwright, as in the audit). If ribbons read as spaghetti, flip the default to division-level with per-division expand — this is a pre-agreed fallback, decide from the screenshot, note the decision in the commit.
**Step 5: Commit** — `feat(analysis/bible): bipartite ribbon overview with table twin`

---

## Phase 6 — Styles, cleanup, verification

### Task 13: `crossref.css` — tokens, marks, dark mode

**Files:** Modify `crossref.css` (created empty in Task 5)

**Step 1:** Define the validated palette as vars scoped to the view root, with dark overrides:

```css
.xref-root {
  --xref-quote: #1a6446;
  --xref-phrase: #4ea578;
  --xref-ramp-1: #dcece4; --xref-ramp-2: #a8d2bd; --xref-ramp-3: #6fb392;
  --xref-ramp-4: #3f9169; --xref-ramp-5: #1a6446; --xref-ramp-6: #0b4530;
}
html[data-theme="dark"] .xref-root {
  --xref-quote: #4ea578;
  --xref-phrase: #1a6446;
  --xref-ramp-1: #0b4530; --xref-ramp-2: #1a6446; --xref-ramp-3: #3f9169;
  --xref-ramp-4: #6fb392; --xref-ramp-5: #a8d2bd; --xref-ramp-6: #dcece4;
}
```

All other colors use the app's semantic tokens (`--surface-*`, `--text-*`, `--border`) — never raw hex. Mark rules per spec §5: bar height ≤16px, 2px gaps between segments/bars/cells, 4px radius on the data end only, hairline rules, visible `:focus-visible` outline, `prefers-reduced-motion` guard around all transitions. Bars/strips/ribbons must render legibly in **both** themes — verify by toggling `data-theme` in devtools and screenshotting each.

**Step 2:** Commit — `style(analysis/bible): crossref token system and mark styles`

### Task 14: Delete the old matrix

**Files:**
- Delete: `frontend/webapp/src/views/Analysis/Bible/Bible.js` (grid, `GridCell`, `getStartEnd`, `levels` — all superseded), `frontend/webapp/src/views/Analysis/Bible.js` (dead sibling file)
- Modify: `Bible.css` → delete entirely if the reader styles were ported into `crossref.css` in Task 10; otherwise trim to only the reader rules still referenced

**Steps:**
1. `git grep -n "Bible/Bible\|getStartEnd\|GridCell"` → fix any remaining references (none expected beyond docs).
2. Full test run + `npm run build` (catches import breakage lint doesn't).
3. Commit — `chore(analysis/bible): remove circle-matrix implementation`

### Task 15: Accessibility + responsive pass

**Steps:**
1. Keyboard-walk every state (Tab/arrows/Enter/Esc) in the dev server; fix traps/ordering.
2. Verify `aria-label`s with the Accessibility tree in devtools for: spine segments, ribbons container summary, bars, chapter cells, sort buttons.
3. Screenshot at 1440, 900, 700, 390 widths × both themes × all four states (Playwright script pattern from the audit works; scratchpad, not repo). Fix overflow/clipping — page body must never scroll horizontally.
4. Commit — `fix(analysis/bible): a11y and responsive polish`

### Task 16: Acceptance verification & docs

**Steps:**
1. Walk `docs/specs/2026-07-16-bible-cross-reference-overhaul.md` §9 checklist item by item against the running app; check every box in a copy of the checklist appended to the spec (with date), or file follow-ups for any deferred item — no silent skips.
2. Full suite: `CI=true npm test -- --watchAll=false` (whole app, not just the view) and `npm run build`. Both must pass.
3. Use the superpowers:verification-before-completion skill before claiming done.
4. Update `docs/audits/2026-07-16-bible-cross-reference-ux-dataviz-audit.md` header with a one-line "Superseded by implementation — see spec/plan" note.
5. Final commit; then use superpowers:finishing-a-development-branch to decide merge/PR (target branch: `dev`).

---

## Execution notes

- **Order matters:** Phases 1–2 unblock everything; Phase 3 before Phase 5 (the ribbon needs the anchor view as its click target); Phase 4 is independent after Phase 2 and can interleave.
- **The dev host serves `bom.kckern.net` from this working tree's service** — do all live checks against a local `PORT=8210 npm start`, never by restarting `bom-dev` (see CLAUDE.md).
- **Do not** copy the old code's reversed `[bibleId, bomId]` destructuring; the data rows are `[bomVid, bibleVid, isQuote]`.
- If any test's expected literal (2957/766, partner rankings) mismatches reality, print the actual, update the literal, and say so in the commit — the dataset is the source of truth, not this plan.
