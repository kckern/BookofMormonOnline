# Chiasmus View Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Status: executed 2026-07-16** — all 17 tasks landed on dev (subagent-driven; two-stage review per task).

**Goal:** Rebuild the Chiasmus analysis view (`/analysis/chiasmus`) into a browsable, filterable, visually distinctive index with speaker avatars, a scheme-glyph fingerprint per chiasm, real integration into Read/PassageNotes, and full dark-mode/mobile/i18n/a11y coverage — per the audit at `docs/audits/2026-07-16-chiasmus-view-ux-audit.md`.

**Architecture:** Four phases. P0 makes the existing view sound (pure enrichment module kills the `lookupReference`-per-render storm; regex crash fix; fetch/URL hygiene; dark mode; a11y). P1 adds the browse model (URL-encoded search/group/sort/filter state, sticky group headers, filtered-order navigation). P2 adds the visual identity (ChiasmGlyph SVG, card redesign, pivot emphasis, shared MiniChiasm component that also replaces the PassageNotes JSON dump). P3 extends the backend (`speaker`, `verse_id`, `line_lengths` on the `Chiasmus` type) to unlock avatars and speaker grouping.

**Tech Stack:** React 17 (CRA + react-app-rewired), reactstrap, `scripture-guide` (`lookupReference`), Jest + React Testing Library (`react-scripts test`), Sass dark-mode token partials, backend: Apollo + Kysely + vitest + graphql-codegen.

**Branch/commit rules:** work directly on `dev` (user-approved). One commit per task, message prefixes as given. End every commit message with:
`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

**Test commands (memorize these):**
- Frontend: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern=<pattern> --watchAll=false`
- Backend: `cd backend && npx vitest run <path>`
- Full frontend suite: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false`

**Key reference files (read before starting a task that touches them):**
- View under change: `frontend/webapp/src/views/Analysis/Chiasmus/{Chiasmus.js,Chiasm.js,Chiasmus.css}`
- Avatar/portrait convention: `frontend/webapp/src/views/Read/components/ChapterContent.js:132-143`
- RefPill (reference chip): `frontend/webapp/src/views/Home/tiles/RefPill.js`
- Mini chiasm rendering precedent: `frontend/webapp/src/views/Home/tiles/ChiasmusTile.js`
- Test conventions (API mock, providers): `frontend/webapp/src/views/Home/__tests__/Sampler.test.js`
- Dark tokens: `frontend/webapp/src/assets/theme/scss/darkmode/_tokens.scss` (use `--surface-*`, `--text-*`, `--border*`, never raw hex in dark overrides)
- Backend chiasmus path: `backend/schema/BomNotes.graphql`, `backend/src/graphql/resolvers/scriptureextras.ts`, `backend/src/data/loaders/scriptureextras.ts`
- Speaker lookup precedent: `backend/src/data/loaders/searchhist.ts:230-237` (`lds_scriptures_lines` → `person_slug`, `voice` by `verse_id IN`)

**i18n note:** `label(key)` (from `src/models/Utils`) returns the key string itself when the dictionary lacks it. For new UI strings use the tiny helper `t(key, fallback)` added in Task 4 so untranslated keys render readable English. Dictionary rows for the new keys are a content-ops step outside this repo's code (flag to the user at the end; do not invent a migration).

---

## Phase 0 — Make it sound

### Task 1: Pure enrichment module `chiasmUtils.js`

All derivation (depth, compound, mirror, book, verse_id, biblical) moves into one pure, memoizable module. This is the fix for the `lookupReference` storm.

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Chiasmus/chiasmUtils.js`
- Test: `frontend/webapp/src/views/Analysis/Chiasmus/__tests__/chiasmUtils.test.js`

**Step 1: Write the failing test**

```js
// frontend/webapp/src/views/Analysis/Chiasmus/__tests__/chiasmUtils.test.js
import {
  parseScheme,
  bookFromReference,
  BOOK_GROUPS,
  enrichChiasmus,
  escapeRegex,
} from "../chiasmUtils";

describe("parseScheme", () => {
  test("depth = highest letter", () => {
    expect(parseScheme("ABCCBA").depth).toBe(3);
    expect(parseScheme("ABCDEFGHHGFEDCBA").depth).toBe(8);
  });
  test("depthBucket caps at + above 7", () => {
    expect(parseScheme("ABCCBA").depthBucket).toBe(3);
    expect(parseScheme("ABCDEFGHHGFEDCBA").depthBucket).toBe("+");
  });
  test("compound = repeated Aa pattern", () => {
    expect(parseScheme("AaAbBaBb").isCompound).toBe(true);
    expect(parseScheme("ABBA").isCompound).toBe(false);
  });
  test("perfect mirror ignores sub-letters", () => {
    expect(parseScheme("ABCCBA").isPerfectMirror).toBe(true);
    expect(parseScheme("ABCBA").isPerfectMirror).toBe(true); // odd pivot
    expect(parseScheme("ABCAB").isPerfectMirror).toBe(false);
    expect(parseScheme("AaBbBaAb".replace(/[a-z]/g, "") /* ABBA */).isPerfectMirror).toBe(true);
  });
  test("lineCount counts scheme entries incl. sub-letters", () => {
    expect(parseScheme("ABBA").lineCount).toBe(4);
  });
  test("empty/garbage scheme doesn't throw", () => {
    expect(parseScheme("").depth).toBe(0);
    expect(parseScheme(null).depth).toBe(0);
  });
});

describe("bookFromReference", () => {
  test.each([
    ["Alma 36:1–30", "Alma"],
    ["1 Nephi 19:7-14", "1 Nephi"],
    ["Words of Mormon 1:4", "Words of Mormon"],
    ["3 Nephi 12:1", "3 Nephi"],
  ])("%s → %s", (ref, book) => expect(bookFromReference(ref)).toBe(book));
  test("every extracted book has a group", () => {
    ["1 Nephi", "Alma", "Moroni", "Ether", "3 Nephi", "Words of Mormon"].forEach((b) =>
      expect(BOOK_GROUPS[b]).toBeTruthy()
    );
  });
});

describe("enrichChiasmus", () => {
  const list = [
    { chiasmus_id: "x1", reference: "Alma 36:1-30", scheme: "ABCDCBA", title: "Alma's Conversion" },
    { chiasmus_id: "x2", reference: "2 Nephi 12:1", scheme: "ABBA", title: "Isaiah quote" },
  ];
  test("adds verse_id, book, group, and parsed scheme fields once", () => {
    const out = enrichChiasmus(list, "en");
    expect(out[0].verse_id).toEqual(expect.any(Number));
    expect(out[0].book).toBe("Alma");
    expect(out[0].bookGroup).toBe("abridgment");
    expect(out[0].depth).toBe(4);
    expect(out[1].isBiblical).toBe(true); // 2 Ne 12 is an Isaiah block
    expect(out[0].isBiblical).toBe(false);
  });
  test("does not mutate input", () => {
    enrichChiasmus(list, "en");
    expect(list[0].depth).toBeUndefined();
  });
});

describe("escapeRegex", () => {
  test("escapes special characters", () => {
    expect(new RegExp(escapeRegex("a(b)?c")).test("a(b)?c")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern=chiasmUtils --watchAll=false`
Expected: FAIL — `Cannot find module '../chiasmUtils'`

**Step 3: Write the implementation**

```js
// frontend/webapp/src/views/Analysis/Chiasmus/chiasmUtils.js
import { lookupReference } from "scripture-guide";

// Isaiah/Malachi/Matthew quotation blocks — chiasms here mirror Biblical text.
// (Same list previously hardcoded inside the component.)
const BIBLE_REFS = "2 Nephi 12-24, 1 Nephi 20-21, 3 Nephi 12-14, 3 Nephi 24-25, Mosiah 14";

// The record's own 6-part structure — the categorical color/grouping dimension.
export const BOOK_GROUPS = {
  "1 Nephi": "small-plates",
  "2 Nephi": "small-plates",
  "Jacob": "small-plates",
  "Enos": "small-plates",
  "Jarom": "small-plates",
  "Omni": "small-plates",
  "Words of Mormon": "abridgment",
  "Mosiah": "abridgment",
  "Alma": "abridgment",
  "Helaman": "abridgment",
  "3 Nephi": "ministry",
  "4 Nephi": "ministry",
  "Mormon": "mormon",
  "Ether": "ether",
  "Moroni": "moroni",
};

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseScheme(scheme) {
  const s = scheme || "";
  const seq = s.replace(/[^A-Z]/g, ""); // original order, majors only
  const depth = seq ? Math.max(...seq.split("").map((c) => c.charCodeAt(0) - 64)) : 0;
  const reversed = seq.split("").reverse().join("");
  return {
    depth,
    depthBucket: depth > 7 ? "+" : depth,
    lineCount: s.length,
    isCompound: /Aa/.test(s),
    isPerfectMirror: seq.length > 0 && seq === reversed,
  };
}

// "Words of Mormon 1:4" → "Words of Mormon"; "1 Nephi 19:7-14" → "1 Nephi"
export function bookFromReference(reference) {
  const m = String(reference || "").match(/^([1-4]?\s?[A-Za-z][A-Za-z ]*?)\s+\d/);
  return m ? m[1].trim() : null;
}

let bibleVerseIdCache = {};
function bibleVerseIds(lang) {
  if (!bibleVerseIdCache[lang]) {
    bibleVerseIdCache[lang] = new Set(lookupReference(BIBLE_REFS, lang).verse_ids);
  }
  return bibleVerseIdCache[lang];
}

/**
 * One-shot enrichment of the raw `chiasmus` list query result. Called from a
 * useMemo — after this, every filter/sort/group is a plain array op and
 * lookupReference never runs in a render path again.
 */
export function enrichChiasmus(list, lang) {
  const bibleIds = bibleVerseIds(lang);
  return (list || []).map((c) => {
    const [verse_id] = lookupReference(c.reference, lang).verse_ids || [];
    const book = bookFromReference(c.reference);
    return {
      ...c,
      ...parseScheme(c.scheme),
      verse_id: verse_id ?? null,
      book,
      bookGroup: BOOK_GROUPS[book] || "other",
      isBiblical: verse_id != null && bibleIds.has(verse_id),
    };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern=chiasmUtils --watchAll=false`
Expected: PASS (all suites). If `2 Nephi 12` doesn't flag biblical, debug `lookupReference` output before touching the assertion — the audit confirmed this block is in the Isaiah range.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus/chiasmUtils.js frontend/webapp/src/views/Analysis/Chiasmus/__tests__/chiasmUtils.test.js
git commit -m "feat(chiasmus): pure enrichment module (scheme parse, book groups, biblical flag)"
```

---

### Task 2: Fix the `addHighlights` regex crash

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js:9-24`
- Test: `frontend/webapp/src/views/Analysis/Chiasmus/__tests__/addHighlights.test.js`

**Step 1: Export `addHighlights` from `Chiasm.js`** (change `function addHighlights` to `export function addHighlights`).

**Step 2: Write the failing test**

```js
// frontend/webapp/src/views/Analysis/Chiasmus/__tests__/addHighlights.test.js
import { addHighlights } from "../Chiasm";
import { renderToStaticMarkup } from "react-dom/server";

const html = (nodes) => renderToStaticMarkup(<>{nodes}</>);

describe("addHighlights", () => {
  test("wraps plain matches in highlight spans", () => {
    expect(html(addHighlights("the word of God", ["word of God"]))).toContain(
      '<span class="highlight">word of God</span>'
    );
  });
  test("does not throw on regex special characters", () => {
    expect(() => addHighlights("he said (behold)", ["(behold)"])).not.toThrow();
    expect(html(addHighlights("he said (behold)", ["(behold)"]))).toContain(
      '<span class="highlight">(behold)</span>'
    );
  });
  test("does not double-wrap overlapping highlights", () => {
    const out = html(addHighlights("great faith", ["great faith", "faith"]));
    expect(out.match(/<span/g).length).toBe(1);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern=addHighlights --watchAll=false`
Expected: FAIL — the `(behold)` case throws `SyntaxError: Invalid regular expression`.

**Step 4: Implement**

Replace the body of `addHighlights` in `Chiasm.js`:

```js
import { escapeRegex } from "./chiasmUtils";

export function addHighlights(text, highlights) {
  // Single pass: build one alternation of escaped patterns, longest first, so
  // overlapping highlights can't nest and special chars can't crash RegExp.
  const patterns = (highlights || []).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!patterns.length) return Parser(text);
  const re = new RegExp(patterns.map(escapeRegex).join("|"), "g");
  return Parser(text.replace(re, (m) => `<span class="highlight">${m}</span>`));
}
```

**Step 5: Run tests, expect PASS, then commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js frontend/webapp/src/views/Analysis/Chiasmus/__tests__/addHighlights.test.js
git commit -m "fix(chiasmus): highlight regex crash on special chars; single-pass no-nest highlighting"
```

---

### Task 3: Refactor `Chiasmus.js` onto the enrichment module

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js`

**Steps (no new test file — Task 1's tests cover the logic; this is mechanical rewiring, verified by the smoke test in Step 4):**

1. Delete unused imports: `searchIcon`, `Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Label`, `Switch` (keep `useRouteMatch`). Delete the dead `setOnlyFilter` function and its `{false && …}` button.
2. In the `Chiasmus` component, replace the inline `depthCounts`/`categoryCounts`/`bibleVerseIds` computations with:
   ```js
   const enriched = useMemo(() => enrichChiasmus(chiasmus, lang), [chiasmus, lang]);
   const depthCounts = useMemo(
     () => enriched.reduce((acc, c) => ({ ...acc, [c.depthBucket]: (acc[c.depthBucket] || 0) + 1 }), {}),
     [enriched]
   );
   const categoryCounts = useMemo(
     () => ({
       biblical: enriched.filter((c) => c.isBiblical).length,
       compound: enriched.filter((c) => c.isCompound).length,
     }),
     [enriched]
   );
   ```
3. `filterChiasm` now reads precomputed fields (`c.depthBucket`, `c.isCompound`, `c.isBiblical`) — no `lookupReference` calls. `sortChiasmus` compares `a.verse_id - b.verse_id` for reference sort — no lookups.
4. The list render maps `enriched` directly (drop the per-render depth recompute block at lines 209-216) and uses `key={chiasm.chiasmus_id}`.
5. In `DepthFilter`, wrap the mapped pair in a keyed fragment: `<React.Fragment key={depth}>…</React.Fragment>`.
6. Remove the `await new Promise(resolve => setTimeout(resolve, 1))` line in `navigateChiasmus`.
7. Memoize the card: extract the card JSX into `const ChiasmCard = memo(({chiasm, active, onSelect}) => …)`.

**Step 4: Verify**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern="chiasmUtils|addHighlights" --watchAll=false` → PASS.
Then smoke-run the dev server (`npm start`) and load `http://localhost:3000/analysis/chiasmus`: list renders, depth filter buttons toggle, sort toggles, clicking a card opens the panel. (`localhost:8200` if running on the dev host via `bom-dev`.)

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js
git commit -m "refactor(chiasmus): enrich once via useMemo — no lookupReference in render/sort paths; stable keys; drop dead code"
```

---

### Task 4: `Chiasm.js` hygiene — fetch cancellation, title guard, URL semantics + i18n helper

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js`
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (Container URL reset)
- Create: `frontend/webapp/src/views/Analysis/Chiasmus/t.js`

**Step 1: i18n helper**

```js
// frontend/webapp/src/views/Analysis/Chiasmus/t.js
import { label } from "src/models/Utils";
// label() returns the raw key when the dictionary lacks it — unreadable for
// new keys. Fall back to supplied English until dictionary rows land.
export const t = (key, fallback) => {
  const val = label(key);
  return val === key ? fallback : val;
};
```

**Step 2: Fetch cancellation + title guard in `Chiasm.js`**

Replace the two effects:

```js
useEffect(() => {
  let cancelled = false;
  setChiasm(null);
  BoMOnlineAPI({ chiasm: [chiasm_id] }, { useCache: false }).then((r) => {
    if (!cancelled) setChiasm(r?.chiasm?.[chiasm_id]);
  });
  return () => { cancelled = true; };
}, [chiasm_id]);

const { replace } = useHistory();
useEffect(() => {
  replace(`/analysis/chiasmus/${chiasm_id}`);
}, [chiasm_id]);

useEffect(() => {
  if (title) document.title = title + " | " + label("home_title");
}, [title]);
```

(`replace`, not `push` — flipping through 30 chiasms must not create 30 history entries. The deep-link entry itself is still a normal navigation.)

**Step 3: URL reset on close**

In `Chiasmus.js` `Container`, wrap the close path: wherever `setChiasmusId(null)` fires (Escape key, close ×), also `history.replace('/analysis/chiasmus')`. Cleanest: add
```js
const { replace } = useHistory();
const closeChiasm = () => { setChiasmusId(null); replace("/analysis/chiasmus"); };
```
and pass `closeChiasm` down as the close/Escape handler (keep `setChiasmusId` for open/navigate).

**Step 4: Replace hardcoded strings** in both files using `t()`:
- `"Chiasmus in the Book of Mormon"` → `t("chiasmus_page_title", "Chiasmus in the Book of Mormon")`
- `Sort: {…}` button → `t("sort_by", "Sort")` + `t("sort_reference", "Reference")` / `t("sort_depth", "Depth")`
- `"Chiastic Levels"` → `t("chiastic_levels", "Chiastic Levels")`; `"Biblical"` → `t("biblical", "Biblical")`; `"Compound"` → `t("compound", "Compound")`
- `"⬅ Previous"` / `"Next ⮕"` → `t("previous", "Previous")` / `t("next", "Next")` (keep the arrows).

**Step 5: Verify + commit**

Run the two test suites (still PASS) + dev-server smoke: open a chiasm → URL updates; press Escape → URL is `/analysis/chiasmus`; tab title never shows "undefined".

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus/
git commit -m "fix(chiasmus): fetch cancellation, title guard, replace-not-push URLs, reset on close; i18n via t() helper"
```

---

### Task 5: Dark mode partial + token migration

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_analysis.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/analysis";` after the `content-pages` import, line 12)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css` (swap hardcoded grays for the light-mode token vars where tokens exist)

**Step 1: Migrate `Chiasmus.css` to tokens** (light mode) — mapping:

| Hardcoded | Token |
|---|---|
| card `#DDD` bg | `var(--surface-3)` |
| card hover `#CCC` | `var(--surface-4)` |
| border `#e0e0e0` | `var(--border)` |
| text `#AAA` (line text) | `var(--text-muted)` — **also bump the resting line text from `#AAA`**: the audit flagged AA contrast failure; use `var(--text-secondary)` |
| `#888` badges/scheme | `var(--text-muted)` bg with `var(--surface-0)` text |
| `#444` reference text | `var(--text-secondary)` |
| nav buttons `#DDD`/`#888` | `var(--control)` / `var(--control-hover)` |
| active highlight `#FFFF0022` | `var(--highlight)` at low alpha — keep as `color-mix(in srgb, var(--highlight) 30%, transparent)` or a dedicated var if `color-mix` is out of budget for CRA's browserslist; fall back to keeping the literal but ALSO overriding it in `_analysis.scss` |

**Step 2: `_analysis.scss`** — only what tokens don't already fix (portals none here; mostly verify, then override stragglers):

```scss
// Dark-mode: Analysis views (Chiasmus). Tokens only — no raw hex.
html[data-theme="dark"] {
  .chiasmus_list .chiasmus { background-color: var(--surface-2); border-color: var(--border); }
  .chiasmus_list .chiasmus:hover { background-color: var(--surface-3); outline-color: var(--border-strong); }
  .chiasmus.active, .chiasmus.active:hover { outline-color: var(--text-primary); background-color: var(--surface-3); }
  .chiasmus .title { color: var(--text-primary); }
  .chiasmus .reference, .chiasm h4.title, .chiasm h4.reference { color: var(--text-secondary); }
  .chiasmus_line .text { color: var(--text-secondary); }
  .chiasmus_line:not(.inactive) .highlight { color: var(--text-primary); }
  .chiasmus_line.active .highlight { background-color: rgba(255, 243, 176, 0.14); }
  .chiasmus_nav div { background-color: var(--control); color: var(--text-secondary); }
  .chiasmus_nav div:hover { background-color: var(--control-hover); color: var(--text-primary); }
  .chiasm .chiasmus_lines { border-top-color: var(--border); }
}
```

**Step 3: Verify** — `cd frontend/webapp && npx sass --no-source-map src/assets/theme/scss/darkmode.scss /dev/null` compiles clean (or whatever the repo's compile check is — see `compile-sass` script pattern). Dev-server smoke in both themes (toggle in User Preferences).

**Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_analysis.scss frontend/webapp/src/assets/theme/scss/darkmode.scss frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css
git commit -m "feat(chiasmus): dark-mode coverage via token partial; migrate view CSS to theme tokens; fix AA contrast on line text"
```

---

### Task 6: Accessibility pass

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js`, `Chiasm.js`, `Chiasmus.css`

**Steps:**

1. Cards: `role="button" tabIndex={0}` + Enter/Space `onKeyDown` (RefPill.js:24-30 is the in-repo pattern), or convert the card div to `<button className="chiasmus">` and neutralize button chrome in CSS. Choose the `<button>` route — it's less code and free focus handling. Add `aria-pressed={active}`.
2. Filter buttons: add `aria-pressed={!excluded}` and `title` text (`t("filter_hide_level", "Hide level $1", …)` style is overkill — plain title strings fine).
3. Close ×: `<button className="close" aria-label={t("close", "Close")}>`.
4. Prev/next nav divs → `<button>`s.
5. Global `keydown`: ignore events from editable targets:
   ```js
   const handleKeyDown = (e) => {
     if (e.target.closest("input, textarea, select, [contenteditable]")) return;
     …
   };
   ```
6. CSS: visible `:focus-visible` outline on cards/buttons (`outline: 2px solid var(--link)`).

**Verify:** keyboard-only walkthrough — Tab reaches cards/filters/close, Enter opens, Escape closes. Test suites still PASS.

**Commit:** `git commit -am "a11y(chiasmus): real buttons, focus-visible, aria-pressed, guarded global key handler"`

---

## Phase 1 — Make it browsable

### Task 7: URL-encoded browse state hook

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Chiasmus/useBrowseState.js`
- Test: `frontend/webapp/src/views/Analysis/Chiasmus/__tests__/useBrowseState.test.js`

**Step 1: Failing test**

```js
// __tests__/useBrowseState.test.js
import { renderHook, act } from "@testing-library/react-hooks";
import { MemoryRouter, Route } from "react-router-dom";
import useBrowseState, { DEFAULTS } from "../useBrowseState";

const wrapper = ({ children, initial = "/analysis/chiasmus" }) => (
  <MemoryRouter initialEntries={[initial]}>
    <Route path="/analysis/:value*">{children}</Route>
  </MemoryRouter>
);

test("defaults with empty query string", () => {
  const { result } = renderHook(() => useBrowseState(), { wrapper });
  expect(result.current.state).toEqual(DEFAULTS);
});

test("reads state from query string", () => {
  const { result } = renderHook(() => useBrowseState(), {
    wrapper: (p) => wrapper({ ...p, initial: "/analysis/chiasmus?group=book&sort=depth&dir=desc&d=3,4&type=compound&q=alma" }),
  });
  expect(result.current.state.group).toBe("book");
  expect(result.current.state.depths).toEqual(["3", "4"]);
  expect(result.current.state.q).toBe("alma");
});

test("set() round-trips through the URL", () => {
  const { result } = renderHook(() => useBrowseState(), { wrapper });
  act(() => result.current.set({ group: "depth", q: "faith" }));
  expect(result.current.state.group).toBe("depth");
  expect(result.current.state.q).toBe("faith");
});
```

(If `@testing-library/react-hooks` isn't in `frontend/webapp/package.json` — check first — render a probe component instead: a tiny `<Probe/>` that calls the hook and dumps state into a `data-testid` div. Do NOT add a dependency for this.)

**Step 2: Run — FAIL (module missing).**

**Step 3: Implement**

```js
// useBrowseState.js
import { useCallback, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom/cjs/react-router-dom.min";

export const DEFAULTS = {
  q: "",            // search text
  group: "book",    // book | speaker | depth | type | none
  sort: "canonical",// canonical | depth | length | title
  dir: "asc",
  depths: [],       // INCLUSION list; empty = all
  type: null,       // null | simple | compound | biblical
};

export default function useBrowseState() {
  const { search, pathname } = useLocation();
  const { replace } = useHistory();

  const state = useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      q: p.get("q") || DEFAULTS.q,
      group: p.get("group") || DEFAULTS.group,
      sort: p.get("sort") || DEFAULTS.sort,
      dir: p.get("dir") || DEFAULTS.dir,
      depths: p.get("d") ? p.get("d").split(",") : DEFAULTS.depths,
      type: p.get("type") || DEFAULTS.type,
    };
  }, [search]);

  const set = useCallback((patch) => {
    const next = { ...state, ...patch };
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.group !== DEFAULTS.group) p.set("group", next.group);
    if (next.sort !== DEFAULTS.sort) p.set("sort", next.sort);
    if (next.dir !== DEFAULTS.dir) p.set("dir", next.dir);
    if (next.depths.length) p.set("d", next.depths.join(","));
    if (next.type) p.set("type", next.type);
    const qs = p.toString();
    replace(pathname + (qs ? `?${qs}` : ""));
  }, [state, pathname, replace]);

  return { state, set };
}
```

**Step 4: PASS, commit:** `feat(chiasmus): URL-encoded browse state hook (search/group/sort/filters)`

---

### Task 8: Selector — filter/sort/group the enriched list

Pure function so it's directly testable; the component just calls it.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/chiasmUtils.js` (add `applyBrowseState`)
- Test: extend `__tests__/chiasmUtils.test.js`

**Step 1: Failing tests**

```js
import { applyBrowseState } from "../chiasmUtils";

describe("applyBrowseState", () => {
  const mk = (over) => ({
    chiasmus_id: over.id, title: over.title || "t", reference: "r",
    verse_id: over.v || 1, book: over.book || "Alma", bookGroup: "abridgment",
    depth: over.depth || 2, depthBucket: over.depth || 2, lineCount: 4,
    isCompound: !!over.compound, isBiblical: !!over.biblical, isPerfectMirror: true,
  });
  const list = [
    mk({ id: "a", v: 300, depth: 5, title: "Zeta" }),
    mk({ id: "b", v: 100, depth: 2, title: "Alpha", compound: true }),
    mk({ id: "c", v: 200, depth: 7, title: "Midway", biblical: true, book: "2 Nephi" }),
  ];
  const S = (over) => ({ q: "", group: "none", sort: "canonical", dir: "asc", depths: [], type: null, ...over });

  test("canonical sort by verse_id", () =>
    expect(applyBrowseState(list, S()).flat.map((c) => c.chiasmus_id)).toEqual(["b", "c", "a"]));
  test("depth inclusion filter", () =>
    expect(applyBrowseState(list, S({ depths: ["5", "7"] })).flat.map((c) => c.chiasmus_id)).toEqual(["c", "a"]));
  test("type filter: biblical only", () =>
    expect(applyBrowseState(list, S({ type: "biblical" })).flat).toHaveLength(1));
  test("search matches title and reference, case-insensitive", () =>
    expect(applyBrowseState(list, S({ q: "alpha" })).flat[0].chiasmus_id).toBe("b"));
  test("grouping returns ordered group entries with counts", () => {
    const { groups } = applyBrowseState(list, S({ group: "book" }));
    expect(groups.map((g) => g.key)).toEqual(["2 Nephi", "Alma"]); // canonical book order
    expect(groups[1].items).toHaveLength(2);
  });
});
```

**Step 2: FAIL. Step 3: Implement in `chiasmUtils.js`:**

```js
const BOOK_ORDER = Object.keys(BOOK_GROUPS); // declaration order is canonical

export function applyBrowseState(enriched, s) {
  let flat = enriched.filter((c) => {
    if (s.depths.length && !s.depths.includes(String(c.depthBucket))) return false;
    if (s.type === "biblical" && !c.isBiblical) return false;
    if (s.type === "compound" && !c.isCompound) return false;
    if (s.type === "simple" && (c.isCompound || c.isBiblical)) return false;
    if (s.q) {
      const q = s.q.toLowerCase();
      if (!`${c.title} ${c.reference}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const cmp = {
    canonical: (a, b) => (a.verse_id ?? 0) - (b.verse_id ?? 0),
    depth: (a, b) => a.depth - b.depth || (a.verse_id ?? 0) - (b.verse_id ?? 0),
    length: (a, b) => a.lineCount - b.lineCount || (a.verse_id ?? 0) - (b.verse_id ?? 0),
    title: (a, b) => String(a.title).localeCompare(String(b.title)),
  }[s.sort] || ((a, b) => 0);
  flat = flat.sort((a, b) => (s.dir === "desc" ? -cmp(a, b) : cmp(a, b)));

  if (!s.group || s.group === "none") return { flat, groups: null };

  const keyFn = {
    book: (c) => c.book || "—",
    speaker: (c) => c.speakerName || "—", // populated by P3 backend field; groups under — until then
    depth: (c) => `Level ${c.depthBucket}`,
    type: (c) => (c.isBiblical ? "Biblical" : c.isCompound ? "Compound" : "Simple"),
  }[s.group];
  const map = new Map();
  for (const c of flat) {
    const k = keyFn(c);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(c);
  }
  let keys = [...map.keys()];
  if (s.group === "book") keys.sort((a, b) => BOOK_ORDER.indexOf(a) - BOOK_ORDER.indexOf(b));
  const groups = keys.map((k) => ({ key: k, items: map.get(k) }));
  return { flat, groups };
}
```

**Step 4: PASS. Step 5: commit** `feat(chiasmus): applyBrowseState selector — filter/sort/group over enriched list`

---

### Task 9: Toolbar + grouped list rendering

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (replace `ChiasmusControl`/`DepthFilter`/`SortButton` with a `BrowseToolbar`; render groups)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`

**Steps:**

1. `BrowseToolbar({ state, set, depthCounts, categoryCounts })` — one row:
   - Search `<input type="search">`, debounced 250 ms → `set({ q })`.
   - Group select: None / Book / Depth / Type (+ Speaker once P3 lands) → `set({ group })`.
   - Sort select (canonical/depth/length/title) + direction button (`aria-pressed`) → `set({ sort, dir })`.
   - Depth chips 2..7,+ with counts, **inclusion semantics** (`aria-pressed={selected}`, filled when selected, all-off = show all) → `set({ depths })`.
   - Type chips: Simple / Compound / Biblical (single-select toggle) → `set({ type })`.
   All strings through `t()`.
2. List body: `const { flat, groups } = useMemo(() => applyBrowseState(enriched, state), [enriched, state]);`
   - `groups` render as `<section>` per group with a sticky header `<h4 className="group-header">{key} <span className="count">{items.length}</span></h4>` and the same card grid inside; `flat` renders the plain grid when group = none.
3. Prev/next + arrow keys navigate **`flat` order** (the visible order): `Container` receives `flat` ids (lift `applyBrowseState` result up, or expose via callback) and computes `nextId`/`prevId` from position in `flat`, not the raw fetch order. Escape still closes.
4. CSS: `.group-header { position: sticky; top: 0; background: var(--surface-0); z-index: 1; }`; chip styles on tokens; search input `max-width: 16rem`.
5. Empty state: when `flat.length === 0`, render `t("no_chiasms_match", "No chiasms match — clear a filter or search term.")` with a "clear all" button calling `set(DEFAULTS)`.

**Verify:** unit suites PASS; dev-server smoke: type "alma" → list narrows; group=Book → sticky headers in canonical order; arrow keys walk the *visible* order; URL reflects every control; reload restores it.

**Commit:** `feat(chiasmus): browse toolbar (search/group/sort/inclusion filters), sticky group headers, visible-order navigation`

---

### Task 10: Prefetch + LRU for the detail panel; mobile layout

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js`
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`

**Steps:**

1. Module-level cache in `Chiasm.js`:
   ```js
   const chiasmCache = new Map(); // chiasmus_id → chiasm; LRU cap 10
   const cachePut = (id, val) => {
     if (chiasmCache.has(id)) chiasmCache.delete(id);
     chiasmCache.set(id, val);
     if (chiasmCache.size > 10) chiasmCache.delete(chiasmCache.keys().next().value);
   };
   export const fetchChiasm = (id) =>
     chiasmCache.has(id)
       ? Promise.resolve(chiasmCache.get(id))
       : BoMOnlineAPI({ chiasm: [id] }, { useCache: false }).then((r) => {
           const c = r?.chiasm?.[id];
           if (c) cachePut(id, c);
           return c;
         });
   ```
   The load effect uses `fetchChiasm(chiasm_id)` (keep the cancellation guard), and a second effect prefetches neighbors: `useEffect(() => { [prevId, nextId].filter(Boolean).forEach(fetchChiasm); }, [prevId, nextId]);`
2. Mobile CSS (first `@media` in this file — the audit found none):
   ```css
   @media (max-width: 800px) {
     .innerChiasmContainer { flex-direction: column; }
     .chiasmPanel.open {
       position: fixed; inset: 0; width: 100%; height: 100%;
       background: var(--surface-0); z-index: 1050; padding: 1rem;
     }
     .chiasmus_list { max-height: none; grid-template-columns: 1fr 1fr; }
   }
   @media (max-width: 480px) {
     .chiasmus_list { grid-template-columns: 1fr; }
   }
   ```
3. Ensure the close button is reachable in the fixed panel (sticky header row inside `.chiasm`).

**Verify:** arrow-key through 5 chiasms — second visit to any of them renders instantly (Network tab: no request). Narrow the window below 800px: detail opens full-screen, close works, body doesn't scroll behind (`overflow: hidden` on open if needed).

**Commit:** `feat(chiasmus): prev/next prefetch + LRU detail cache; mobile full-screen detail + single-column grid`

---

## Phase 2 — Make it sing

### Task 11: `ChiasmGlyph` SVG component

**Files:**
- Create: `frontend/webapp/src/views/_Common/ChiasmGlyph.js` (shared — cards, detail header, later PassageNotes/Home)
- Test: `frontend/webapp/src/views/_Common/__tests__/ChiasmGlyph.test.js`

**Step 1: Failing test**

```js
import { render } from "@testing-library/react";
import ChiasmGlyph, { glyphBars } from "../ChiasmGlyph";

describe("glyphBars", () => {
  test("one bar per scheme entry, indent tracks letter depth", () => {
    const bars = glyphBars("ABBA");
    expect(bars).toHaveLength(4);
    expect(bars[0].indent).toBe(0);
    expect(bars[1].indent).toBe(1);
    expect(bars[3].indent).toBe(0);
  });
  test("pivot bars flagged (deepest run)", () => {
    expect(glyphBars("ABCBA").map((b) => b.isPivot)).toEqual([false, false, true, false, false]);
    expect(glyphBars("ABBA").map((b) => b.isPivot)).toEqual([false, true, true, false]);
  });
  test("length buckets map to widths when lineLengths provided (per-chiasm tertiles)", () => {
    const bars = glyphBars("ABA", [10, 200, 12]);
    expect(bars[1].widthFactor).toBeGreaterThan(bars[0].widthFactor);
  });
  test("sub-letters indent under their major", () => {
    const bars = glyphBars("AaB");
    expect(bars[1].indent).toBeGreaterThan(bars[0].indent);
  });
});

test("renders an svg with role=img and a title", () => {
  const { container } = render(<ChiasmGlyph scheme="ABCCBA" size={40} />);
  const svg = container.querySelector("svg");
  expect(svg).toHaveAttribute("role", "img");
  expect(container.querySelectorAll("rect").length).toBe(6);
});
```

**Step 2: FAIL. Step 3: Implement**

```js
// frontend/webapp/src/views/_Common/ChiasmGlyph.js
import React from "react";

/**
 * Bar model for a chiasm scheme string. Pure + exported for tests.
 * indent: 0-based depth (major letter A=0; sub-letters +0.5 under their major)
 * widthFactor: 0.4/0.7/1.0 — per-chiasm tertile of line length (1.0 if unknown)
 * isPivot: bar(s) at maximum depth — the turning point
 */
export function glyphBars(scheme, lineLengths) {
  const chars = (scheme || "").split("");
  const bars = chars.map((ch) => {
    const isMajor = /[A-Z]/.test(ch);
    const major = isMajor ? ch : ch.toUpperCase();
    const base = major.charCodeAt(0) - 65;
    return { indent: isMajor ? base : base + 0.5, widthFactor: 1, isPivot: false };
  });
  const maxIndent = Math.max(...bars.map((b) => b.indent), 0);
  bars.forEach((b) => { b.isPivot = b.indent === maxIndent; });
  if (Array.isArray(lineLengths) && lineLengths.length === bars.length) {
    const sorted = [...lineLengths].sort((a, b) => a - b);
    const t1 = sorted[Math.floor(sorted.length / 3)];
    const t2 = sorted[Math.floor((2 * sorted.length) / 3)];
    bars.forEach((b, i) => {
      b.widthFactor = lineLengths[i] <= t1 ? 0.4 : lineLengths[i] <= t2 ? 0.7 : 1.0;
    });
  }
  return bars;
}

export default function ChiasmGlyph({ scheme, lineLengths, size = 40, title }) {
  const bars = glyphBars(scheme, lineLengths);
  if (!bars.length) return null;
  const rowH = size / bars.length;
  const barH = Math.max(1.5, rowH * 0.55);
  const maxIndent = Math.max(...bars.map((b) => b.indent));
  const indentUnit = maxIndent ? (size * 0.45) / maxIndent : 0;
  return (
    <svg
      className="chiasmGlyph" role="img" width={size} height={size}
      viewBox={`0 0 ${size} ${size}`} aria-label={title || `Chiastic structure ${scheme}`}
    >
      {title ? <title>{title}</title> : null}
      {bars.map((b, i) => {
        const x = b.indent * indentUnit;
        const w = Math.max(2, (size - x) * b.widthFactor);
        return (
          <rect
            key={i} x={x} y={i * rowH + (rowH - barH) / 2}
            width={w} height={barH} rx={barH / 2}
            className={b.isPivot ? "glyphBar pivot" : "glyphBar"}
          />
        );
      })}
    </svg>
  );
}
```

CSS (goes in `Chiasmus.css` now; Sampler/PassageNotes reuse later):
```css
.chiasmGlyph .glyphBar { fill: var(--text-faint); }
.chiasmGlyph .glyphBar.pivot { fill: var(--accent-amber); }
```

**Step 4: PASS. Step 5: commit** `feat: ChiasmGlyph — SVG fingerprint of a chiasm scheme (indent=depth, width=length tertile, accent pivot)`

---

### Task 12: Card redesign + book-group color rails

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (ChiasmCard)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode/_analysis.scss`

**Steps:**

1. Card structure (avatar slot ships hidden until P3 provides `speaker`):
   ```jsx
   <button className={`chiasmus bg-${chiasm.bookGroup} ${active ? "active" : ""}`} onClick={…} aria-pressed={active}>
     <div className="card-head">
       {chiasm.speaker?.person_slug && (
         <img className="speaker-avatar" loading="lazy" width="36" height="36"
              alt={chiasm.speaker.name || ""} src={`${assetUrl}/people/${chiasm.speaker.person_slug}`} />
       )}
       <div className="card-titles">
         <div className="title">{chiasm.title || t("untitled_chiasm", "Untitled")}</div>
         {chiasm.speaker?.name && <div className="speaker-name">{chiasm.speaker.name}</div>}
       </div>
       <span className="depth-chip" title={t("chiastic_depth", "Chiastic depth")}>{chiasm.depthBucket}</span>
     </div>
     <div className="card-body">
       <ChiasmGlyph scheme={chiasm.scheme} lineLengths={chiasm.line_lengths} size={44} />
       <RefPill refText={chiasm.reference} />
     </div>
   </button>
   ```
   Import `RefPill` from `src/views/Home/tiles/RefPill` and `assetUrl` from `src/models/BoMOnlineAPI`. (If RefPill's popup styling depends on `.sampler` scoping — check `Sampler.css` — add an equivalent `.chiasmIndexPanel .scripture_link` rule rather than moving RefPill.)
2. Color rails: 6 book-group hues as CSS custom properties defined **once** in `Chiasmus.css` `:root` scope, e.g. `--bg-small-plates`, `--bg-abridgment`, `--bg-ministry`, `--bg-mormon`, `--bg-ether`, `--bg-moroni`. Apply as `border-left: 4px solid var(--bg-<group>)` per `bg-*` class. **Before committing hex values, run the dataviz palette validator** (`node <dataviz-skill-dir>/scripts/validate_palette.js "<hex,…>" --mode light`, then `--mode dark` against `#1a1a1a`) and use passing steps only; do not eyeball. Group headers get an underline in the same hue when grouping by book.
3. `.depth-chip`: fixed `width/height: 1.4rem; border-radius: 50%; display: grid; place-items: center;` — a circle, not the current padded ellipse.
4. Dark variants of the six rails in `_analysis.scss` (validated against the dark surface — same validator run).

**Verify:** suites PASS; visual smoke light+dark; the six rails distinguishable (validator output in the commit message body is a nice receipt).

**Commit:** `feat(chiasmus): card redesign — glyph, RefPill, circular depth chip, validated book-group color rails (avatar slot ready)`

---

### Task 13: Detail panel — pivot emphasis, pinnable pairs, read-in-context

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js`
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`

**Steps:**

1. Pivot: compute max letter across `lines` (`line_key` majors); `ChiasticLine` at max depth gets `className="… pivot"`. CSS: left border in `var(--accent-amber)`, background `var(--surface-1)`, slightly larger scheme badge.
2. Pin: add `const [pinnedScheme, setPinnedScheme] = useState(null);` — clicking a line's scheme badge toggles pin (`pinnedScheme === letter ? null : letter`); hover still sets `activeScheme` but pinned wins: `const effective = pinnedScheme || activeScheme;` `onMouseLeave` clears hover only. Badge shows pinned state (`aria-pressed`, filled). Works on touch (click = pin).
3. Header row: `<ChiasmGlyph scheme={scheme} size={64} lineLengths={lines?.map(l => (l.line_text || "").length)} />` beside the title (detail has full text — exact lengths, no bucket needed: pass raw lengths, glyphBars tertiles them per-chiasm).
4. Read-in-context: under the reference, a link button:
   ```jsx
   <Link className="read-in-context" to={`/search/${encodeURIComponent(reference)}`}>
     {t("read_in_context", "Read in context")}
   </Link>
   ```
   **Check first** how other views deep-link a reference (grep `to={\`/search/` in `frontend/webapp/src` — follow whatever RefPill's `openScripture` or Read uses; prefer the same affordance: calling `openScripture(reference)` from `./ScripturePopup` sibling import path `src/views/Home/tiles/ScripturePopup` may be the more idiomatic route. Use whichever the grep shows is the app-wide pattern; do not invent a new route shape.)
5. Copy-link button beside close ×: `navigator.clipboard.writeText(window.location.href)` with a transient "copied" state.

**Verify:** suites PASS; smoke: pivot visually distinct, click-pin persists while moving mouse, read-in-context lands on the passage, copy-link pastes the deep URL.

**Commit:** `feat(chiasmus): pivot emphasis, pinnable pair highlighting, read-in-context + copy-link`

---

### Task 14: Shared `MiniChiasm` + real PassageNotes panel

**Files:**
- Create: `frontend/webapp/src/views/_Common/MiniChiasm.js` (extracted from ChiasmusTile's line renderer)
- Modify: `frontend/webapp/src/views/Home/tiles/ChiasmusTile.js` (use MiniChiasm)
- Modify: `frontend/webapp/src/views/Read/CategoryPanels/ChiasmusPanel.js` (replace the JSON dump)
- Test: `frontend/webapp/src/views/_Common/__tests__/MiniChiasm.test.js`

**Step 1: Failing test**

```js
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MiniChiasm from "../MiniChiasm";

const lines = [
  { line_key: "A", line_text: "the _first_ word" },
  { line_key: "B", line_text: "the middle" },
  { line_key: "A", line_text: "the _first_ again" },
];

test("renders one row per line with letter key and mark highlights", () => {
  render(<MemoryRouter><MiniChiasm lines={lines} /></MemoryRouter>);
  expect(screen.getAllByText(/the/).length).toBe(3);
  expect(document.querySelectorAll("mark").length).toBe(2);
});

test("indents by letter depth", () => {
  render(<MemoryRouter><MiniChiasm lines={lines} /></MemoryRouter>);
  const rows = document.querySelectorAll(".miniChiasmLine");
  expect(rows[1].style.paddingLeft).not.toBe(rows[0].style.paddingLeft);
});
```

**Step 2: FAIL. Step 3: Implement** — lift `renderLine` + the indent/row markup out of `ChiasmusTile.js:11-13,51-62` verbatim into:

```js
// frontend/webapp/src/views/_Common/MiniChiasm.js
import React from "react";

const renderLine = (text) =>
  (text || "").split(/_([^_]+)_/).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));

/** Compact chiasm rendering shared by Home tile, PassageNotes, and previews. */
export default function MiniChiasm({ lines, className = "" }) {
  if (!lines?.length) return null;
  return (
    <div className={`miniChiasm ${className}`.trim()}>
      {lines.map((line, i) => (
        <div key={i} className="miniChiasmLine"
             style={{ paddingLeft: `${((line.line_key?.charCodeAt(0) || 65) - 65) * 0.9}rem` }}>
          <span className="miniChiasmKey">{line.line_key}</span>
          <span className="miniChiasmText">{renderLine(line.line_text)}</span>
        </div>
      ))}
    </div>
  );
}
```

`ChiasmusTile` swaps its inline block for `<MiniChiasm lines={chiasm.lines} className="chiasmusTileLines" />` — **keep its existing CSS class names working**: check `Sampler.css` for `.chiasmusTileLine/Key/Text` selectors and either alias the classes in MiniChiasm via props or update Sampler.css selectors to the `miniChiasm*` names. Run the existing Sampler test to be sure: `CI=true npx react-scripts test --testPathPattern=Sampler --watchAll=false`.

`ChiasmusPanel.js` becomes:

```js
import React from "react";
import { Link } from "react-router-dom";
import MiniChiasm from "../../_Common/MiniChiasm";
import { t } from "../../Analysis/Chiasmus/t";

/** data: [{ title, reference, scheme, chiasmus_id?, lines? }] from passagenotes */
const ChiasmusPanel = ({ data }) => {
  if (!data?.length) return null;
  return (
    <div className="chiasmus-panel">
      {data.map((c, i) => (
        <div key={c.chiasmus_id || i} className="chiasmus-panel-item">
          <div className="chiasmus-panel-head">
            <strong>{c.title}</strong> <span className="ref">{c.reference}</span>
          </div>
          {c.lines?.length ? <MiniChiasm lines={c.lines} /> : null}
          {c.chiasmus_id && (
            <Link to={`/analysis/chiasmus/${c.chiasmus_id}`}>{t("view_full_chiasm", "View full chiasm")}</Link>
          )}
        </div>
      ))}
    </div>
  );
};
export default ChiasmusPanel;
```

**Data check before writing this:** the `passagenotes` query (`GraphQLQueries.js:194-198`) currently selects only `title reference scheme` — no `chiasmus_id`, no `lines`. Add `chiasmus_id` to that selection (schema already has it: `BomNotes.graphql:35`). `lines` inside passagenotes may not be resolved — check `scriptureextras.ts` passagenotes path; if lines aren't available there, ship the panel with title/ref/scheme + a `ChiasmGlyph scheme={c.scheme}` instead of MiniChiasm lines, and the deep link. Do not add a heavy per-verse lines fetch.

**Step 4: PASS all three suites (MiniChiasm, Sampler, chiasmUtils). Step 5: commit**

```bash
git commit -m "feat: shared MiniChiasm; PassageNotes chiasmus tab renders real content (was raw JSON)"
```

---

## Phase 3 — Make it connected (backend)

### Task 15: Backend — `verse_id`, `line_lengths`, `speaker` on `Chiasmus`

**Files:**
- Modify: `backend/schema/BomNotes.graphql`
- Modify: `backend/src/data/loaders/scriptureextras.ts`
- Modify: `backend/src/graphql/resolvers/scriptureextras.ts`
- Test: colocate with existing backend tests — find them first: `ls backend/src/**/*.test.ts` / check `backend/vitest` config for test dir conventions; put the test beside existing scriptureextras tests if present, else `backend/src/data/loaders/__tests__/scriptureextras.test.ts` following the nearest existing test's mocking style.

**Step 1: Schema**

```graphql
type Chiasmus {
  chiasmus_id: String
  reference: String
  scheme: String
  title: String
  verse_id: Int
  line_lengths: [Int]
  speaker: ChiasmusSpeaker
  lines: [ChiasmusLine]
}

type ChiasmusSpeaker {
  person_slug: String
  name: String
  voice: String
}
```

Run codegen: `cd backend && npm run codegen:graphql` — commit the regenerated `codegen/graphql.ts` with the schema change.

**Step 2: Failing loader test** — `reduceChiasmusLines` (or a new sibling fn) computes `verse_id` (first line's), `line_lengths` (per-line `line_text.length`), and the reducer output feeds a new `resolveChiasmusSpeakers(chiasms, db)` that batch-queries `lds_scriptures_lines` (`select verse_id, person_slug, voice where verse_id in (…)` — copy the shape of `searchhist.ts:230-237`) and assigns each chiasm the **modal (most frequent) person_slug across its verse span**. Test with an in-memory stub of `db` (see how existing backend tests stub Kysely — mirror that; if none exist for loaders, test the pure parts only: `verse_id`/`line_lengths` from `reduceChiasmusLines`, and the modal-speaker pick as a pure function `pickDominantSpeaker(rows)`).

```ts
// pure fn to test:
export function pickDominantSpeaker(rows: { person_slug: string | null; voice: string | null }[]) {
  const counts = new Map<string, { n: number; voice: string | null }>();
  for (const r of rows) {
    if (!r.person_slug) continue;
    const e = counts.get(r.person_slug) || { n: 0, voice: r.voice };
    e.n++; counts.set(r.person_slug, e);
  }
  let best: string | null = null, bestN = 0;
  for (const [slug, { n }] of counts) if (n > bestN) { best = slug; bestN = n; }
  return best ? { person_slug: best, voice: counts.get(best)!.voice } : null;
}
```

`name` resolution: check how `PeopleItem` (`loaders/scriptureextras.ts:63-67`) gets names for the passagenotes people list and reuse that lookup for the speaker's display name.

**Step 3: Wire resolvers** — `Chiasmus.verse_id`, `Chiasmus.line_lengths`, `Chiasmus.speaker` field resolvers reading what the loader attached (follow the existing `Chiasmus.chiasmus_id` pattern at `resolvers/scriptureextras.ts:130-133`). Speaker resolution must be **batched once per query** (all chiasms' verse_ids in one `IN` query), not per-chiasm N+1 — attach in `Query.chiasmus` after `reduceChiasmusLines`.

**Step 4: `cd backend && npx vitest run` → PASS; `npm run codegen:graphql` clean; boot the backend (`npm run dev` per backend package.json — confirm script name first) and hand-run the query:**

```graphql
{ chiasmus { chiasmus_id verse_id line_lengths speaker { person_slug name voice } } }
```

**Step 5: Commit** `feat(api): Chiasmus.verse_id, line_lengths, speaker (dominant voice over verse span)`

---

### Task 16: Frontend adoption of the new fields

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js:373-389` (add `verse_id line_lengths speaker { person_slug name voice }` to the list query)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/chiasmUtils.js` (`enrichChiasmus`: prefer server `verse_id` when present — skip `lookupReference` entirely; pass through `speaker`, `line_lengths`; add `speakerName: c.speaker?.name` for the group keyFn)
- Modify: `Chiasmus.js` (enable the Speaker option in the group select; avatar block in ChiasmCard now lights up on its own)
- Test: extend `__tests__/chiasmUtils.test.js` — enrich with server `verse_id` present must not call `lookupReference` (jest.mock `scripture-guide` and assert not called for that path).

**Steps:** test-first as above → implement → `CI=true npx react-scripts test --watchAll=false` (full suite) → smoke: cards show avatars for chiasms with portraits, Group: Speaker clusters correctly, index glyphs now length-scaled (server `line_lengths` flowing through).

**IndexedDB cache note:** the list query result is cached client-side; bump whatever cache key/version mechanism `BoMOnlineAPI` uses for query-shape changes — grep `models/BoMOnlineAPI.js` for version/expiry logic and follow its convention, otherwise stale cached lists without the new fields will render avatar-less until users' caches expire.

**Commit:** `feat(chiasmus): speaker avatars, group-by-speaker, length-scaled glyphs from server fields`

---

### Task 17: Docs + wrap-up

**Files:**
- Modify: `docs/api/types.md` (§Chiasmus — add the three fields), `docs/api/queries.md` if it lists the chiasmus query shape
- Modify: `docs/audits/2026-07-16-chiasmus-view-ux-audit.md` — add a status line at top: implemented phases + date
- Verify: run BOTH full suites one last time (frontend `CI=true npx react-scripts test --watchAll=false`; backend `npx vitest run`)

**Commit:** `docs: chiasmus API fields + audit status`

**Then report to the user:** remaining non-code items — (1) dictionary rows for the new `t()` keys (content-ops), (2) the `bom.kckern.net/analysis/chiasmus` Next.js 404 (deployment, out of scope), (3) optional: chiasm titles in `searchAll` (deferred).

---

## Execution notes

- Tasks 1–14 are frontend-only and safe to execute independently of 15–17.
- Task 15 blocks 16; 16 blocks the avatar/speaker parts of 12/9 lighting up, but those ship dormant, so order 1→17 is strictly linear and always shippable.
- After every task: run the named tests, then commit. Never batch commits across tasks.
- The dev host serves this branch live (`bom.kckern.net` = dev via `bom-dev` unit). Committing to dev is user-approved; do **not** restart `bom-dev` without coordination (CLAUDE.md), and verify against `localhost` (Cloudflare caches the public bundle for 4h).
