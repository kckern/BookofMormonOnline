# Home Tiles — Bring the Directory Up to Par Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the audit gaps in `frontend/webapp/src/views/Home/tiles/` — add tests for the high-risk logic, consolidate the two divergent tile registries into one source of truth, internationalise the last hardcoded English strings, and remove dead/inconsistent code.

**Architecture:** The Home Sampler renders a grid of "tiles" driven by `tiles/registry.js`, plus two extra tile pools (`RESERVE_POOL`, `BATCH_TILES`) currently defined inline in `Sampler.js`. Most tiles are presentational; the breakable logic lives in a handful of pure functions (`assemblePayload`, `parseTeaser`, `markShared`, `textUtils`) and one stateful component (`ReadingPlanTile`). This plan adds tests around that logic, moves the two extra pools into `registry.js` so there is a single registry module, routes the remaining literal strings through the existing `label()` + backend seed-script i18n mechanism, and deletes leftover code.

**Tech Stack:** React 17, Jest + `@testing-library/react` run via `react-scripts test`, `label()` i18n backed by a MySQL `bom_label` table seeded through `backend/scripts/seed-sampler-labels.mjs`.

---

## Conventions used throughout this plan

**Run tests with `react-scripts` (NOT raw `npx jest`).** Raw `npx jest` cannot parse JSX in this project and every suite will fail to parse. Always:

```bash
cd frontend/webapp
CI=true npx react-scripts test <pattern> --watchAll=false
```

`<pattern>` is a substring matched against test file paths, e.g. `textUtils` matches `__tests__/textUtils.test.js`.

**`label()` in tests returns `" "`.** `label(key)` reads `global.dictionary` (`src/models/Utils.js:95-114`); when it is unset (the default in jsdom), `label()` returns a single space `" "`. Existing tile tests therefore never assert on `label()` output — they assert on data-derived text, class names, or `data-testid`s. Follow that convention **except** where a test explicitly seeds `global.dictionary` (Task 8).

**Test file location:** all tile tests live in `frontend/webapp/src/views/Home/tiles/__tests__/`.

**File structure this plan creates or modifies:**
- Create: `tiles/__tests__/textUtils.test.js` — unit tests for the shared text helpers (Task 1)
- Create: `tiles/__tests__/assemblePayload.test.js` — tests for the Sampler payload merge (Task 2)
- Create: `tiles/__tests__/HistoryTile.test.js` — tests for `parseTeaser` (Task 3)
- Create: `tiles/__tests__/BiblePhrasesTile.test.js` — tests for `markShared` (Task 4)
- Create: `tiles/__tests__/ReadingPlanTile.test.js` — routing tests (Task 5)
- Create: `tiles/__tests__/registry.test.js` — registry invariants (Task 9)
- Modify: `tiles/HistoryTile.js` — export `parseTeaser` (Task 3)
- Modify: `tiles/BiblePhrasesTile.js` — export `markShared` (Task 4)
- Modify: `tiles/CommentaryTile.js` — delete dead `avail` line (Task 6)
- Modify: `tiles/NotesTile.js` — import `openScripture` via the local shim (Task 7)
- Modify: `tiles/MapStoryTile.js`, `tiles/MapStoryCard.js` — route strings through `label()` (Task 8)
- Modify: `tiles/__tests__/MapStoryTile.test.js` — seed `global.dictionary` (Task 8)
- Modify: `backend/scripts/seed-sampler-labels.mjs` — add the 7 mapstory keys (Task 8)
- Modify: `docs/reference/sampler-label-keys.md` — inventory the new keys (Task 8)
- Modify: `tiles/registry.js` — add `reservePool` + `batchTiles` exports (Task 9)
- Modify: `views/Home/Sampler.js` — import the pools from `registry.js`, delete the inline definitions (Task 9)

---

## Task 1: Unit tests for the shared text helpers (`textUtils.js`)

`textUtils.js` (`flatten`, `supDigits`, `enDash`, `clampWords`) is imported by ~12 tiles and has zero tests. These are pure functions — no mocking, no render. The tests below characterise the *current* behaviour; they should PASS on first run. If any assertion fails, it has found a real bug — fix the util, not the test.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/textUtils.test.js`

- [ ] **Step 1: Write the test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/textUtils.test.js`:

```javascript
import { flatten, supDigits, enDash, clampWords } from "../textUtils";

describe("supDigits", () => {
  test("turns a name-attached disambiguation digit into a superscript", () => {
    expect(supDigits("Heth2")).toBe("Heth²");
    expect(supDigits("Nephi1 and Lamanite3")).toBe("Nephi¹ and Lamanite³");
  });
  test("leaves standalone or non-1-4 digits alone", () => {
    expect(supDigits("Alma 32")).toBe("Alma 32"); // space before the digit → no match
    expect(supDigits("A9")).toBe("A9"); // 9 is not in the 1-4 set
  });
  test("tolerates empty/nullish input", () => {
    expect(supDigits("")).toBe("");
    expect(supDigits(undefined)).toBe("");
  });
});

describe("flatten", () => {
  test("resolves {Name|slug} and [Name|slug] link markup to the display name", () => {
    expect(flatten("{Alma|alma} taught [Helaman|helaman]")).toBe("Alma taught Helaman");
  });
  test("strips HTML, collapses whitespace, and tightens parentheses", () => {
    expect(flatten("Alma said <b>hi</b>  ( there )")).toBe("Alma said hi (there)");
  });
  test("superscripts disambiguation digits after flattening", () => {
    expect(flatten("{Heth2|heth} reigned")).toBe("Heth² reigned");
  });
  test("tolerates empty/nullish input", () => {
    expect(flatten("")).toBe("");
    expect(flatten(undefined)).toBe("");
  });
});

describe("enDash", () => {
  test("renders a hyphen between two digits as an en-dash", () => {
    expect(enDash("2-3")).toBe("2–3");
    expect(enDash("1 Nephi 3:7-8")).toBe("1 Nephi 3:7–8");
  });
  test("leaves non-numeric hyphens alone", () => {
    expect(enDash("valley-of-gideon")).toBe("valley-of-gideon");
  });
});

describe("clampWords", () => {
  test("returns the text unchanged when within the word budget", () => {
    expect(clampWords("one two three", 5)).toBe("one two three");
  });
  test("truncates on the word boundary with an ellipsis when over budget", () => {
    expect(clampWords("one two three four five", 3)).toBe("one two three…");
  });
  test("prefers a sentence boundary that lands in the back half of the cut", () => {
    expect(clampWords("Gamma delta epsilon zeta. Eta theta iota", 6)).toBe(
      "Gamma delta epsilon zeta."
    );
  });
  test("never strands an open parenthetical", () => {
    expect(clampWords("word word word word (open paren here", 5)).toBe(
      "word word word word…"
    );
  });
});
```

- [ ] **Step 2: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test textUtils --watchAll=false`
Expected: PASS, 4 suites-worth of `describe` blocks green (13 assertions across 4 describes, all passing).

If a test FAILS, the util has a real bug: fix the function in `tiles/textUtils.js` so the documented behaviour holds, then re-run.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/__tests__/textUtils.test.js
git commit -m "test(tiles): cover shared textUtils helpers"
```

---

## Task 2: Tests for the Sampler payload merge (`assemblePayload`)

`assemblePayload` (`Sampler.js:84`) is already exported and is the pure seam where the compound API response is merged into one tile payload — dedupe, freshness, join/left filtering, recency sort, commentary spread. It has no tests. Characterisation tests below; expect PASS on first run.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/assemblePayload.test.js`

- [ ] **Step 1: Write the test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/assemblePayload.test.js`:

```javascript
import { assemblePayload } from "../../Sampler";

const NOW = Date.now();

const baseResponse = () => ({
  homesampler: [
    {
      people: [{ slug: "alma" }],
      commentaries: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
  ],
  homegroups: [
    {
      url: "g1",
      name: "Group One",
      picture: "p1",
      members: [{ user_id: 1 }],
      latest: { id: "m1", timestamp: NOW, msg: "Hello there", user: { nickname: "Al" } },
    },
    {
      url: "g2",
      name: "Group Two",
      picture: "p2",
      members: [],
      latest: { id: "m2", timestamp: NOW - 1000, msg: "Bob joined", user: { nickname: "Bob" } },
    },
  ],
  leaderboard: [
    {
      recentFinishers: [{ nickname: "Fin" }, { nickname: "Fin" }, { nickname: "Nia" }],
      currentProgress: [{ nickname: "Reader", progress: 40 }],
    },
  ],
});

describe("assemblePayload", () => {
  test("spreads the three commentaries into commentary / commentary2 / commentary3", () => {
    const p = assemblePayload(baseResponse());
    expect(p.commentary).toEqual({ id: 1 });
    expect(p.commentary2).toEqual({ id: 2 });
    expect(p.commentary3).toEqual({ id: 3 });
  });

  test("passes through the sampler's own fields", () => {
    const p = assemblePayload(baseResponse());
    expect(p.people).toEqual([{ slug: "alma" }]);
  });

  test("builds a community block sorted by recency", () => {
    const p = assemblePayload(baseResponse());
    expect(p.community.groups.map((g) => g.url)).toEqual(["g1", "g2"]);
  });

  test("drops join/left system messages from the message strip", () => {
    const p = assemblePayload(baseResponse());
    // g2's latest ("Bob joined") is a membership event → excluded; only g1 remains
    expect(p.community.messages).toHaveLength(1);
    expect(p.community.messages[0].channel).toBe("g1");
  });

  test("marks a recent message fresh and an old one stale", () => {
    const p = assemblePayload(baseResponse());
    expect(p.community.messages[0].fresh).toBe(true);
  });

  test("dedupes finishers and readers by nickname", () => {
    const p = assemblePayload(baseResponse());
    expect(p.community.finishers.map((u) => u.nickname)).toEqual(["Fin", "Nia"]);
    expect(p.community.reading).toHaveLength(1);
  });

  test("community is null when there are no groups and no finishers", () => {
    const empty = {
      homesampler: [{}],
      homegroups: [],
      leaderboard: [{ recentFinishers: [], currentProgress: [] }],
    };
    expect(assemblePayload(empty).community).toBeNull();
  });

  test("tolerates a wholly empty response", () => {
    expect(() => assemblePayload({})).not.toThrow();
    expect(assemblePayload({}).community).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test assemblePayload --watchAll=false`
Expected: PASS, 8 tests green.

Note: importing `../../Sampler` pulls the whole Sampler module (which imports `react-masonry-css` and the tile registry). This import has no network side effects, so no mocks are needed. If the import throws on a transitive dependency, add `jest.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: jest.fn(() => new Promise(() => {})), assetUrl: "https://media.test", renderBaseUrl: "http://localhost:5006", ApiBaseUrl: "http://localhost:5005" }));` at the top of the test file and re-run.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/__tests__/assemblePayload.test.js
git commit -m "test(tiles): cover Sampler assemblePayload merge + community assembly"
```

---

## Task 3: Export and test `parseTeaser` (`HistoryTile.js`)

`parseTeaser` (`HistoryTile.js:11-19`) turns a teaser HTML blob into a lead paragraph + up-to-4 key-point bullets. It is module-private. Export it, then test it (RED = import is `undefined`, GREEN = export added).

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/HistoryTile.js:11`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.test.js`:

```javascript
import { parseTeaser } from "../HistoryTile";

describe("parseTeaser", () => {
  test("extracts the lead paragraph before 'Key Points:' and the <li> bullets after", () => {
    const html =
      "<p>An intro lead sentence.</p> Key Points: <ul><li>First point</li><li>Second point</li></ul>";
    const { lead, bullets } = parseTeaser(html);
    expect(lead).toContain("An intro lead sentence");
    expect(bullets).toEqual(["First point", "Second point"]);
  });

  test("caps bullets at four", () => {
    const html =
      "Lead. Key points: <ul>" +
      "<li>a</li><li>b</li><li>c</li><li>d</li><li>e</li>" +
      "</ul>";
    expect(parseTeaser(html).bullets).toEqual(["a", "b", "c", "d"]);
  });

  test("returns empty bullets and the whole text as lead when there is no list", () => {
    const { lead, bullets } = parseTeaser("Just a plain teaser with no bullets.");
    expect(bullets).toEqual([]);
    expect(lead).toContain("Just a plain teaser");
  });

  test("tolerates empty/nullish input", () => {
    expect(parseTeaser("")).toEqual({ lead: "", bullets: [] });
    expect(parseTeaser(undefined)).toEqual({ lead: "", bullets: [] });
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test HistoryTile --watchAll=false`
Expected: FAIL — `parseTeaser is not a function` (it is not exported yet).

- [ ] **Step 3: Export `parseTeaser`**

In `frontend/webapp/src/views/Home/tiles/HistoryTile.js`, change line 11 from:

```javascript
const parseTeaser = (html) => {
```

to:

```javascript
export const parseTeaser = (html) => {
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test HistoryTile --watchAll=false`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/HistoryTile.js frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.test.js
git commit -m "test(tiles): export and cover HistoryTile parseTeaser"
```

---

## Task 4: Export and test `markShared` (`BiblePhrasesTile.js`)

`markShared` (`BiblePhrasesTile.js:18-50`) diffs two passages and wraps 4+-word verbatim overlaps in `<mark>` in BOTH — the highlight is the whole point of the tile. It is module-private and uses `diff-match-patch`. Export it and test its observable contract (RED = import `undefined`, GREEN = export). Returns `[bomNodes, kjvNodes]`, each an array mixing plain strings and React `<mark>` elements.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/BiblePhrasesTile.js:18`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/BiblePhrasesTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/BiblePhrasesTile.test.js`:

```javascript
import React from "react";
import { markShared } from "../BiblePhrasesTile";

// A <mark> element vs a plain string: React elements are objects with a `type`.
const isMark = (node) => React.isValidElement(node) && node.type === "mark";
const markedText = (nodes) =>
  nodes.filter(isMark).map((n) => n.props.children).join("|");

describe("markShared", () => {
  test("marks a 4+ word verbatim run in both passages", () => {
    const [a, b] = markShared(
      "and it came to pass that Nephi went up",
      "and it came to pass that Lehi departed"
    );
    // the shared opening clause is >= 4 words → marked on both sides
    expect(markedText(a).toLowerCase()).toContain("and it came to pass");
    expect(markedText(b).toLowerCase()).toContain("and it came to pass");
  });

  test("does not mark an overlap shorter than four words", () => {
    const [a] = markShared("the ark of God", "the temple of Solomon");
    // only "the" (and "of") overlap — never a 4-word run → nothing marked
    expect(a.some(isMark)).toBe(false);
  });

  test("preserves the original casing of the marked fragment", () => {
    const [a] = markShared(
      "And It Came To Pass that they journeyed",
      "and it came to pass that they rested"
    );
    // matching is case-insensitive but the emitted text keeps side A's casing
    expect(markedText(a)).toMatch(/And It Came To Pass/);
  });

  test("returns two node arrays even when nothing is shared", () => {
    const result = markShared("alpha beta", "gamma delta");
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test BiblePhrasesTile --watchAll=false`
Expected: FAIL — `markShared is not a function`.

- [ ] **Step 3: Export `markShared`**

In `frontend/webapp/src/views/Home/tiles/BiblePhrasesTile.js`, change line 18 from:

```javascript
const markShared = (a, b) => {
```

to:

```javascript
export const markShared = (a, b) => {
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test BiblePhrasesTile --watchAll=false`
Expected: PASS, 4 tests green.

If the casing test fails because `diff-match-patch`'s `diff_cleanupSemantic` split the phrase differently than expected, relax that single assertion to `expect(markedText(a).length).toBeGreaterThan(0)` — the phrase-marking contract is what matters, not the exact boundary. Do not weaken the other three tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/BiblePhrasesTile.js frontend/webapp/src/views/Home/tiles/__tests__/BiblePhrasesTile.test.js
git commit -m "test(tiles): export and cover BiblePhrasesTile markShared highlighting"
```

---

## Task 5: Routing tests for `ReadingPlanTile`

`ReadingPlanTile` (`ReadingPlanTile.js:178-203`) is the one genuinely stateful tile: it fetches a bookmark and routes to one of three sub-views — `ReadingProgressTile` (bookmark present), `GuestPlanPreview` (guest, no bookmark), or `SignedInPlanTile` (signed-in, no bookmark). Test the routing decision by mocking the API, the app controller, and the two heavy child components.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/ReadingPlanTile.test.js`

- [ ] **Step 1: Write the test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/ReadingPlanTile.test.js`:

```javascript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mutable per-test fixtures (must be `mock`-prefixed to satisfy jest.mock hoisting).
let mockBookmark = null;
let mockSignedIn = false;

const apiMock = jest.fn((q) => {
  if ("mybookmark" in q) return Promise.resolve({ mybookmark: mockBookmark });
  if ("readingplanprograms" in q) return Promise.resolve({ readingplanprograms: {} });
  if ("readingplan" in q) return Promise.resolve({ readingplan: null });
  return new Promise(() => {}); // readingplanpreview etc. — stay pending
});

jest.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: (...args) => apiMock(...args),
}));
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: (...args) => apiMock(...args),
  assetUrl: "https://media.test",
}));

jest.mock("src/contexts/AppControllerContext", () => ({
  __esModule: true,
  useAppController: () => ({
    states: { user: { token: "tok", user: mockSignedIn ? 42 : null, social: {}, progress: {} } },
  }),
}));

// The two heavy children are irrelevant to the routing decision — stub them.
jest.mock("../ReadingProgressTile", () => ({
  __esModule: true,
  default: () => <div data-testid="reading-progress" />,
}));
jest.mock("../../ReadingPlan", () => ({
  __esModule: true,
  ReadingPlan: () => <div data-testid="reading-plan-gallery" />,
}));

import ReadingPlanTile from "../ReadingPlanTile";

const renderTile = () =>
  render(
    <MemoryRouter>
      <ReadingPlanTile />
    </MemoryRouter>
  );

beforeEach(() => {
  apiMock.mockClear();
  mockBookmark = null;
  mockSignedIn = false;
});

describe("ReadingPlanTile routing", () => {
  test("renders the reading-progress view when a bookmark exists", async () => {
    mockBookmark = { pageSlug: "1-nephi-1", pagetitle: "1 Nephi 1" };
    renderTile();
    expect(await screen.findByTestId("reading-progress")).toBeTruthy();
  });

  test("a guest with no bookmark sees the plan preview, not the progress view", async () => {
    mockBookmark = null;
    mockSignedIn = false;
    const { container } = renderTile();
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(screen.queryByTestId("reading-progress")).toBeNull();
    expect(container.querySelector(".valuePropTile")).toBeTruthy();
  });

  test("a signed-in user with no bookmark queries their reading plan", async () => {
    mockBookmark = null;
    mockSignedIn = true;
    renderTile();
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        expect.objectContaining({ readingplan: expect.anything() }),
        expect.anything()
      )
    );
    expect(screen.queryByTestId("reading-progress")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test ReadingPlanTile --watchAll=false`
Expected: PASS, 3 tests green.

Note: `ReadingPlanTile.js` imports `BoMOnlineAPI` from `"src/models/BoMOnlineAPI.js"` (with the `.js` extension) while its children import it without — both `jest.mock` calls above are required so every path resolves to the same stub. If a test hangs, it means a real `BoMOnlineAPI` slipped through; verify both mock paths match the import strings in the component tree.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/__tests__/ReadingPlanTile.test.js
git commit -m "test(tiles): cover ReadingPlanTile bookmark/guest/signed-in routing"
```

---

## Task 6: Remove dead code in `CommentaryTile.js`

`CommentaryTile.js:50` declares `const avail = aside.offsetHeight - (body.offsetTop - aside.offsetTop >= 0 ? 0 : 0);` — the ternary evaluates to `0` on both branches (a no-op) and `avail` is never read (the next line recomputes from `aside.offsetHeight` directly). Delete the line. The existing `CommentaryTile.test.js` (3 tests) is the regression guard.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/CommentaryTile.js:50`

- [ ] **Step 1: Delete the dead line**

In `frontend/webapp/src/views/Home/tiles/CommentaryTile.js`, delete this line (currently line 50):

```javascript
    const avail = aside.offsetHeight - (body.offsetTop - aside.offsetTop >= 0 ? 0 : 0);
```

Leave the following comment and `target` computation intact. After the edit, the block reads:

```javascript
    const aside = asideRef.current;
    const body = bodyRef.current;
    if (!aside || !body) return;
    // clamp height = aside height minus the title above the excerpt
    const titleH = body.previousElementSibling ? body.previousElementSibling.offsetHeight + 6 : 0;
    const target = Math.max(72, aside.offsetHeight - titleH - 26); // 26 ≈ read-more row
```

- [ ] **Step 2: Run the CommentaryTile tests — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test CommentaryTile --watchAll=false`
Expected: PASS, 3 tests green (unchanged behaviour — dead code only).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/CommentaryTile.js
git commit -m "refactor(tiles): drop dead no-op 'avail' var in CommentaryTile"
```

---

## Task 7: Make `NotesTile` import `openScripture` via the local shim

Every tile imports `openScripture` from the local `./ScripturePopup` shim, which exists specifically to "keep tile imports stable" (`ScripturePopup.js:1-3`). `NotesTile.js:8` bypasses it and imports from `src/views/_Common/ScripturePopup` directly. Same resolved module, but it defeats the shim's purpose. Route it through the shim for consistency. The existing `NotesTile.test.js` mocks `src/views/_Common/ScripturePopup`, which the shim re-exports, so the test keeps passing.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/NotesTile.js:8`

- [ ] **Step 1: Change the import**

In `frontend/webapp/src/views/Home/tiles/NotesTile.js`, change line 8 from:

```javascript
import { openScripture } from "src/views/_Common/ScripturePopup";
```

to:

```javascript
import { openScripture } from "./ScripturePopup";
```

- [ ] **Step 2: Run the NotesTile tests — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test NotesTile --watchAll=false`
Expected: PASS, 2 tests green.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/NotesTile.js
git commit -m "refactor(tiles): route NotesTile openScripture through the local shim"
```

---

## Task 8: Internationalise the MapStory tile strings

The MapStory tiles are the only place in the directory with hardcoded English:
- `MapStoryTile.js:102` — `"Play journey"` / `"Pause journey"` (aria-label)
- `MapStoryTile.js:147` — `"Story summary"` / `` `Move ${i+1}` `` (aria-label)
- `MapStoryCard.js:40` — `title="This move does not continue from the previous one"`
- `MapStoryCard.js:41` — `"not continuous"`
- `MapStoryCard.js:82` — `` `${moveCount} moves · ${stopCount} places` ``

Route them through `label()` like the rest of the codebase, add the keys to the backend seed script (the sanctioned mechanism — see `docs/reference/sampler-label-keys.md`), and inventory them in that doc. **Because `MapStoryTile.test.js` asserts on these exact strings and `label()` returns `" "` in tests, the test must seed `global.dictionary` so `label()` resolves to real English.** That change is part of this task and is what keeps the WCAG pause-control test meaningful.

Seeding the DB row itself requires write access (the dev DB user is read-only), exactly as the reference doc describes — until seeded, these strings render as their raw keys. That is the project's accepted transitional state for new sampler labels.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:102,147`
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryCard.js` (add `label` import; lines 40-41, 82)
- Modify: `frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js:55-62`
- Modify: `backend/scripts/seed-sampler-labels.mjs:11-27`
- Modify: `docs/reference/sampler-label-keys.md`

- [ ] **Step 1: Seed `global.dictionary` in the MapStory test**

In `frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js`, replace the `beforeEach`/`afterEach` block (currently lines 55-62):

```javascript
beforeEach(() => {
  jest.useFakeTimers();
  openScripture.mockClear();
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
```

with:

```javascript
beforeEach(() => {
  jest.useFakeTimers();
  openScripture.mockClear();
  // The component now routes its strings through label(); seed the dictionary so
  // label() resolves to real English (it returns " " when the dictionary is unset).
  global.dictionary = {
    mapstory_play: "Play journey",
    mapstory_pause: "Pause journey",
    mapstory_summary: "Story summary",
    mapstory_move: "Move $1",
    mapstory_detached: "not continuous",
    mapstory_detached_title: "This move does not continue from the previous one",
    mapstory_meta: "$1 moves · $2 places",
    map: "Map",
    view_more: "View more",
  };
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  delete global.dictionary;
});
```

- [ ] **Step 2: Run the MapStory test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test MapStoryTile --watchAll=false`
Expected: FAIL. Seeding `global.dictionary` makes `label("map")` return `"Map"` instead of `" "`, but the component still emits hardcoded `"Pause journey"` etc. The assertions using `getByLabelText("Pause journey")` still pass (component unchanged), so this step primarily confirms the dictionary seeding did not break the suite. If the suite is GREEN here, that is also acceptable — proceed. (The real RED→GREEN is the label wiring below; this ordering keeps the dictionary and the component changes in one reviewable commit.)

- [ ] **Step 3: Route `MapStoryTile.js` strings through `label()`**

`label` is already imported in `MapStoryTile.js` (line 3). Change the pause button `aria-label` (line 102) from:

```javascript
          aria-label={paused ? "Play journey" : "Pause journey"}
```

to:

```javascript
          aria-label={paused ? label("mapstory_play") : label("mapstory_pause")}
```

Change the dot `aria-label` (line 147) from:

```javascript
              aria-label={i === moves.length ? "Story summary" : `Move ${i + 1}`}
```

to:

```javascript
              aria-label={i === moves.length ? label("mapstory_summary") : label("mapstory_move", [i + 1])}
```

- [ ] **Step 4: Route `MapStoryCard.js` strings through `label()`**

In `frontend/webapp/src/views/Home/tiles/MapStoryCard.js`, add the `label` import after the existing imports (after line 3):

```javascript
import { label } from "src/models/Utils";
```

Change the detached marker (currently lines 39-43) from:

```javascript
        {move.detached ? (
          <span className="mapStoryDetached" title="This move does not continue from the previous one">
            not continuous
          </span>
        ) : null}
```

to:

```javascript
        {move.detached ? (
          <span className="mapStoryDetached" title={label("mapstory_detached_title")}>
            {label("mapstory_detached")}
          </span>
        ) : null}
```

Change the title-card meta line (currently line 82) from:

```javascript
          {moveCount} moves · {stopCount} places
```

to:

```javascript
          {label("mapstory_meta", [moveCount, stopCount])}
```

- [ ] **Step 5: Run the MapStory test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test MapStoryTile --watchAll=false`
Expected: PASS, all 15 tests green. The seeded dictionary makes `label("mapstory_pause")` → `"Pause journey"`, `label("mapstory_move",[1])` → `"Move 1"`, `label("mapstory_detached")` → `"not continuous"`, so every existing assertion (`getByLabelText("Pause journey")`, the `Move \d+|Story summary` dot regex, `getByText("not continuous")`) resolves exactly as before.

- [ ] **Step 6: Add the seven keys to the backend seed script**

In `backend/scripts/seed-sampler-labels.mjs`, add these entries to the `labels` object (after the `sampler_value_prop` entry, before the closing `};` at line 27):

```javascript
  // Map-story tile (WCAG pause control, discontinuity marker, summary meta).
  mapstory_play: 'Play journey',
  mapstory_pause: 'Pause journey',
  mapstory_summary: 'Story summary',
  mapstory_move: 'Move $1',
  mapstory_detached: 'not continuous',
  mapstory_detached_title: 'This move does not continue from the previous one',
  mapstory_meta: '$1 moves · $2 places',
```

- [ ] **Step 7: Verify the seed script still parses**

Run: `node --check backend/scripts/seed-sampler-labels.mjs`
Expected: no output, exit 0 (syntax valid). Do NOT run the seed itself — it needs DB write credentials not available in this environment; seeding is an out-of-band step for someone with `bom_app` access, as documented in the reference file.

- [ ] **Step 8: Inventory the new keys in the reference doc**

In `docs/reference/sampler-label-keys.md`, add these rows to the `## Keys` table (after the `menu_community` row):

```markdown
| `mapstory_play` | Play journey | new |
| `mapstory_pause` | Pause journey | new |
| `mapstory_summary` | Story summary | new |
| `mapstory_move` | Move $1 | new |
| `mapstory_detached` | not continuous | new |
| `mapstory_detached_title` | This move does not continue from the previous one | new |
| `mapstory_meta` | $1 moves · $2 places | new |
```

And add a bullet to the `## Notes` section:

```markdown
- The `mapstory_*` keys back the map-story tile (`tiles/MapStoryTile.js`,
  `tiles/MapStoryCard.js`). `mapstory_move` and `mapstory_meta` use `$1`/`$2`
  insert placeholders (e.g. `label("mapstory_meta", [moveCount, stopCount])`).
  They are seeded by `backend/scripts/seed-sampler-labels.mjs`; until that runs
  against a writable DB they render as their raw keys.
```

- [ ] **Step 9: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MapStoryTile.js \
        frontend/webapp/src/views/Home/tiles/MapStoryCard.js \
        frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js \
        backend/scripts/seed-sampler-labels.mjs \
        docs/reference/sampler-label-keys.md
git commit -m "i18n(tiles): route MapStory strings through label() + seed keys"
```

---

## Task 9: Consolidate the two tile registries into one source of truth

Today `registry.js` documents itself as *the* place to add a tile, but `Sampler.js` holds two more pools inline — `RESERVE_POOL` (balancer fill tiles) and `BATCH_TILES` (infinite-scroll tiles) — which own `personProfile`, `placeProfile`, `witness`, and `map`. A developer following `registry.js`'s documented process never finds them. Move both pools into `registry.js` as named exports so there is one registry module, then have `Sampler.js` import them. Add a `registry.test.js` guarding the invariants.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/registry.test.js`

- [ ] **Step 1: Write the registry test (RED — `reservePool`/`batchTiles` not exported yet)**

Create `frontend/webapp/src/views/Home/tiles/__tests__/registry.test.js`:

```javascript
// Importing the registry pulls every tile component. Stub the API layer so no
// module-level network/side effects fire during the import.
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  renderBaseUrl: "http://localhost:5006",
  ApiBaseUrl: "http://localhost:5005",
}));

import { tileRegistry, reservePool, batchTiles } from "../registry";

const isFn = (x) => typeof x === "function";
const allEntriesValid = (pool) =>
  pool.every((t) => typeof t.key === "string" && isFn(t.component) && isFn(t.isReady));
const uniqueKeys = (pool) => new Set(pool.map((t) => t.key)).size === pool.length;

describe("tile registry", () => {
  test("all three pools export a non-empty array", () => {
    [tileRegistry, reservePool, batchTiles].forEach((p) => {
      expect(Array.isArray(p)).toBe(true);
      expect(p.length).toBeGreaterThan(0);
    });
  });

  test("every entry has a key, a component, and an isReady predicate", () => {
    expect(allEntriesValid(tileRegistry)).toBe(true);
    expect(allEntriesValid(reservePool)).toBe(true);
    expect(allEntriesValid(batchTiles)).toBe(true);
  });

  test("keys are unique within each pool", () => {
    expect(uniqueKeys(tileRegistry)).toBe(true);
    expect(uniqueKeys(reservePool)).toBe(true);
    expect(uniqueKeys(batchTiles)).toBe(true);
  });

  test("batchTiles carries the repeatable content types", () => {
    const keys = batchTiles.map((t) => t.key);
    ["commentary", "history", "fax", "places", "text"].forEach((k) =>
      expect(keys).toContain(k)
    );
  });

  test("the map reserve is main-only so it lands below the fold", () => {
    expect(reservePool.find((t) => t.key === "map").mainOnly).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test tiles/__tests__/registry --watchAll=false`
Expected: FAIL — `reservePool`/`batchTiles` are `undefined` (not exported yet).

- [ ] **Step 3: Add the pool exports to `registry.js`**

In `frontend/webapp/src/views/Home/tiles/registry.js`, add these imports below the existing `import MapStoryTile ...` line (after line 16):

```javascript
import PersonProfileTile from "./PersonProfileTile";
import PlaceProfileTile from "./PlaceProfileTile";
import WitnessTile from "./WitnessTile";
import MapTile from "./MapTile";
```

Note `ImageArtTile` and `ChiasmusTile` are already imported at the top of `registry.js`.

Then, at the END of `registry.js` (after the `tileRegistry` array's closing `];`), append:

```javascript

/**
 * Reserve tiles: NOT part of the default rotation. Sampler's balancer measures
 * the left rail against the masonry and inserts these onto the shorter side
 * until the columns bottom out together. Cheap/relevant first; the map (heavy,
 * lazy) last and always into the masonry (below the fold). `mainOnly` forces a
 * tile into the masonry; `props` are passed through; `dataKey`/`seedOffset` are
 * read by Sampler's renderReserve.
 */
export const reservePool = [
  { key: "personProfile", component: PersonProfileTile, isReady: (p) => (p?.people?.length || 0) > 14 },
  { key: "witness",       component: WitnessTile,       dataKey: "witnesses", isReady: (p) => (p?.witnesses?.length || 0) > 0 },
  { key: "placeProfile",  component: PlaceProfileTile,  isReady: (p) => (p?.places?.length || 0) > 11 },
  { key: "artFill1",      component: ImageArtTile,      props: { artIndex: 1 }, isReady: (p) => (p?.art?.length || 0) > 1 },
  { key: "chiasmus2",     component: ChiasmusTile,      props: { seed: 0 }, seedOffset: 97, isReady: () => true },
  { key: "artFill2",      component: ImageArtTile,      props: { artIndex: 2 }, isReady: (p) => (p?.art?.length || 0) > 2 },
  { key: "map",           component: MapTile,           isReady: () => true, mainOnly: true },
];

// Infinite-scroll batch tiles: the repeatable content types re-sampled under a
// fresh seed as the reader nears the bottom. Fixed/live tiles (reading plan,
// narration, contents, community) are excluded — they render once.
const INFINITE_REGISTRY_KEYS = ["art", "commentary", "commentary2", "commentary3", "history", "fax", "faxVerse", "places", "biblephrases", "chiasmus", "text", "notes"];
export const batchTiles = [
  ...tileRegistry
    .filter((t) => INFINITE_REGISTRY_KEYS.includes(t.key))
    .map((t) => ({ key: t.key, component: t.component, isReady: t.isReady, span: t.span })),
  { key: "personProfile", component: PersonProfileTile, isReady: (p) => (p?.people?.length || 0) > 0, span: "tile-personProfile" },
  { key: "placeProfile",  component: PlaceProfileTile,  isReady: (p) => (p?.places?.length || 0) > 0, span: "tile-placeProfile" },
  { key: "witness",       component: WitnessTile, dataKey: "witnesses", isReady: (p) => (p?.witnesses?.length || 0) > 0, span: "tile-witness" },
  { key: "artB",          component: ImageArtTile, props: { artIndex: 1 }, isReady: (p) => (p?.art?.length || 0) > 1, span: "tile-art" },
];
```

Then update the registry doc comment (the JSDoc block above `export const tileRegistry`) so it points at all three exports. Change the last two sentences of that comment block from:

```javascript
 * span is a CSS class in Sampler.css controlling the grid footprint (col- and
 * row-spans). ORDER IS LAYOUT: the left rail (Sampler.js LEFT_KEYS) holds
 * narration, contents, community + activity; people spans the grid top, the
 * rest pairs beneath (text-with-text, visual-with-visual for balanced rows).
 */
```

to:

```javascript
 * span is a CSS class in Sampler.css controlling the grid footprint (col- and
 * row-spans). ORDER IS LAYOUT: the left rail (Sampler.js LEFT_KEYS) holds
 * narration, contents, community + activity; people spans the grid top, the
 * rest pairs beneath (text-with-text, visual-with-visual for balanced rows).
 *
 * This module is the SINGLE registry. Besides `tileRegistry` (the default grid)
 * it also exports `reservePool` (balancer fill tiles) and `batchTiles`
 * (infinite-scroll tiles) — see their definitions below. `personProfile`,
 * `placeProfile`, `witness`, and `map` live ONLY in those pools, not in the
 * default rotation, so add such tiles to the matching pool here.
 */
```

- [ ] **Step 4: Run the registry test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test tiles/__tests__/registry --watchAll=false`
Expected: PASS, 5 tests green.

If the import throws on a transitive dependency other than `BoMOnlineAPI` (e.g. a component that fetches at module load), add a targeted `jest.mock("<that module>", ...)` alongside the existing one and re-run. Do not weaken the assertions.

- [ ] **Step 5: Point `Sampler.js` at the registry pools and delete the inline definitions**

In `frontend/webapp/src/views/Home/Sampler.js`:

**(a)** Change the registry import (line 7) from:

```javascript
import { tileRegistry } from "./tiles/registry";
```

to:

```javascript
import { tileRegistry, reservePool, batchTiles } from "./tiles/registry";
```

**(b)** Delete the now-unused component imports (lines 8-13):

```javascript
import PersonProfileTile from "./tiles/PersonProfileTile";
import PlaceProfileTile from "./tiles/PlaceProfileTile";
import WitnessTile from "./tiles/WitnessTile";
import ImageArtTile from "./tiles/ImageArtTile";
import ChiasmusTile from "./tiles/ChiasmusTile";
import MapTile from "./tiles/MapTile";
```

**(c)** Delete the `RESERVE_POOL` block and its comment (lines 17-30):

```javascript
// Reserve tiles: NOT rendered by default. The balancer measures the left rail
// against the masonry and inserts reserves onto the shorter side until the two
// bottom out together. Cheap/relevant tiles first; the map (heavy, lazy) last
// and always into the masonry (below the fold). `data` names a payload field
// the tile reads via its `data` prop; profiles/art read the whole payload.
const RESERVE_POOL = [
  { key: "personProfile", component: PersonProfileTile, isReady: (p) => (p?.people?.length || 0) > 14 },
  { key: "witness",       component: WitnessTile,       dataKey: "witnesses", isReady: (p) => (p?.witnesses?.length || 0) > 0 },
  { key: "placeProfile",  component: PlaceProfileTile,  isReady: (p) => (p?.places?.length || 0) > 11 },
  { key: "artFill1",      component: ImageArtTile,      props: { artIndex: 1 }, isReady: (p) => (p?.art?.length || 0) > 1 },
  { key: "chiasmus2",     component: ChiasmusTile,      props: { seed: 0 }, seedOffset: 97, isReady: () => true },
  { key: "artFill2",      component: ImageArtTile,      props: { artIndex: 2 }, isReady: (p) => (p?.art?.length || 0) > 2 },
  { key: "map",           component: MapTile,           isReady: () => true, mainOnly: true },
];
```

Keep the `const MAX_RESERVES = 5;` line that follows.

**(d)** Delete the `INFINITE_REGISTRY_KEYS` + `BATCH_TILES` block and its comment (lines 62-79):

```javascript
// ---- infinite scroll -------------------------------------------------------
// The fixed panels (rail: reading plan → narration → contents → community; top:
// people) and the first tile batch render once. Past that, the page grows by
// appending fresh batches: each is a homesampler call under a NEW seed —
// distinct random people/places/art/commentary/history/fax — sampled in the
// background and revealed as the reader nears the bottom. These are the
// repeatable content tile types; fixed/live ones (reading plan, narration,
// contents, community) are excluded.
const INFINITE_REGISTRY_KEYS = ["art", "commentary", "commentary2", "commentary3", "history", "fax", "faxVerse", "places", "biblephrases", "chiasmus", "text", "notes"];
const BATCH_TILES = [
  ...tileRegistry
    .filter((t) => INFINITE_REGISTRY_KEYS.includes(t.key))
    .map((t) => ({ key: t.key, component: t.component, isReady: t.isReady, span: t.span })),
  { key: "personProfile", component: PersonProfileTile, isReady: (p) => (p?.people?.length || 0) > 0, span: "tile-personProfile" },
  { key: "placeProfile",  component: PlaceProfileTile,  isReady: (p) => (p?.places?.length || 0) > 0, span: "tile-placeProfile" },
  { key: "witness",       component: WitnessTile, dataKey: "witnesses", isReady: (p) => (p?.witnesses?.length || 0) > 0, span: "tile-witness" },
  { key: "artB",          component: ImageArtTile, props: { artIndex: 1 }, isReady: (p) => (p?.art?.length || 0) > 1, span: "tile-art" },
];
```

Replace it with the short infinite-scroll comment (the pool now lives in the registry):

```javascript
// ---- infinite scroll -------------------------------------------------------
// The fixed panels (rail: reading plan → narration → contents → community; top:
// people) and the first tile batch render once. Past that, the page grows by
// appending fresh batches under new seeds. The repeatable tile types are
// `batchTiles`, imported from the registry.
```

Keep the `const MAX_BATCHES = 30;` and `const nextBatchSeed = ...` lines that follow.

**(e)** Update the three references to the deleted constants:
- In the balancer `useLayoutEffect`, change `const next = RESERVE_POOL.find(` to `const next = reservePool.find(`.
- In `renderReserve`, change `const def = RESERVE_POOL.find((r) => r.key === key);` to `const def = reservePool.find((r) => r.key === key);`.
- In `prefetchBatch`, change `reserveRef.current = { payload: assemblePayload(r), tiles: shuffle(BATCH_TILES) };` to `reserveRef.current = { payload: assemblePayload(r), tiles: shuffle(batchTiles) };`.

- [ ] **Step 6: Verify no dangling references remain**

Run: `cd frontend/webapp && grep -nE "RESERVE_POOL|BATCH_TILES|INFINITE_REGISTRY_KEYS" src/views/Home/Sampler.js`
Expected: no output (every reference renamed or removed).

Run: `cd frontend/webapp && grep -nE "PersonProfileTile|PlaceProfileTile|WitnessTile|MapTile|ChiasmusTile|ImageArtTile" src/views/Home/Sampler.js`
Expected: no output (component imports moved to the registry; Sampler no longer references them directly).

- [ ] **Step 7: Run the registry test AND the existing assemblePayload test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test "tiles/__tests__/registry|assemblePayload" --watchAll=false`
Expected: PASS. `assemblePayload` still imports cleanly from the refactored `Sampler.js`, and the registry invariants hold.

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/registry.js \
        frontend/webapp/src/views/Home/Sampler.js \
        frontend/webapp/src/views/Home/tiles/__tests__/registry.test.js
git commit -m "refactor(sampler): consolidate reserve + batch tile pools into the registry"
```

---

## Task 10: Full-suite verification and production build

Confirm the whole tiles suite is green and the app still compiles after the registry refactor.

**Files:** none (verification only)

- [ ] **Step 1: Run every tile test**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Home/tiles --watchAll=false`
Expected: PASS. Suites: the 5 pre-existing (`CommentaryTile`, `FaxVerseTile`, `NotesTile`, `MapStoryTile`, `mapStoryPath`) plus the 6 added by this plan (`textUtils`, `assemblePayload`, `HistoryTile`, `BiblePhrasesTile`, `ReadingPlanTile`, `registry`) — 11 suites, all green.

- [ ] **Step 2: Confirm the production build compiles (catches unused-import / lint-as-error regressions from Task 9)**

Run: `cd frontend/webapp && CI=true npx react-scripts build`
Expected: "Compiled successfully." (or compiled with only pre-existing warnings). If it fails with an unused-variable error pointing at `Sampler.js`, an import from Task 9 Step 5(b) was missed — remove it and rebuild.

- [ ] **Step 3: Final commit (only if the build surfaced a fix; otherwise skip)**

```bash
git add -A
git commit -m "chore(tiles): clean up after registry consolidation"
```

---

## Self-Review

**1. Spec coverage** — every audit finding maps to a task:
- Finding #1 (test coverage, high-risk logic only) → Tasks 1 (textUtils), 2 (assemblePayload), 3 (parseTeaser), 4 (markShared), 5 (ReadingPlanTile). `mapStoryPath` was already covered. Presentational-only tiles are intentionally out of scope per the chosen "high-risk logic only" option.
- Finding #2 (two divergent registries → consolidate) → Task 9.
- Finding #3 (hardcoded English in MapStory) → Task 8.
- Finding #4 (dead `avail` in CommentaryTile) → Task 6.
- Finding #5 (NotesTile import inconsistency) → Task 7.
- Cross-cutting verification → Task 10.

**2. Placeholder scan** — every code step shows complete code; every command shows the exact invocation and expected result. The one deliberately-not-run command (the DB seed in Task 8) is called out with its reason, matching the project's documented read-only-dev constraint.

**3. Type/name consistency** — the pool exports are named `reservePool` and `batchTiles` consistently in Tasks 9's registry additions, the Sampler edits, and the `registry.test.js` import. The seven label keys (`mapstory_play`, `mapstory_pause`, `mapstory_summary`, `mapstory_move`, `mapstory_detached`, `mapstory_detached_title`, `mapstory_meta`) are identical across the component edits, the seeded test dictionary, the seed script, and the reference doc. `parseTeaser` and `markShared` are exported with the same signatures the tests import.

**Known limitation (documented, not a gap):** the Sampler's DOM-measurement balancer (`useLayoutEffect` height binning, `est`/`estBatch`) is not unit-testable in jsdom (no layout engine → all `offsetHeight` are 0) and is deliberately out of scope; the testable seam of that subsystem, `assemblePayload`, is covered in Task 2. A full balancer test would require a browser-driver harness (Playwright) and belongs in a separate effort.
