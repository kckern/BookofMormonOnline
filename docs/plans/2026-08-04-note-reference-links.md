# Note-Reference (`<ref>n`) Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Page-view notes panel, turn note-internal `<ref>n` pointers (e.g. `1 Nephi 2:13n`) into a distinctly-styled link that opens the same-source note on that verse inline (accordion beneath the host note).

**Architecture:** A pure resolver (`noteRefs.js`) uses scripture-guide's `findReferences` (context-aware) plus a host-verse implied-book seed to locate `<ref>n` tokens and their target verse_ids. `SingleNoteItem` (in `Narration.js`) masks those tokens into `note_ref` anchors, runs the existing `detectReferences` on the rest, and on click fetches the sibling note(s) via a new `notesForRef` GraphQL query and renders them inline. Backend exposes `verse_id`/`source` on the `Note` type and adds the `notesForRef` fetch.

**Tech Stack:** React 17 (CRA/react-scripts jest), scripture-guide 1.0.95, graphql-yoga + Kysely (backend), MySQL.

**Spec:** `docs/specs/2026-08-04-note-reference-links.md`. **Coverage:** 440/449 note-ref tokens (98%) resolve to a same-source note; all live in sources 192/193.

---

## File structure

- `frontend/webapp/src/views/Page/noteRefs.js` — **new.** Pure `resolveNoteRefs(text, hostVerseId)` → `[{start,end,verseId,rawText}]`. No React/network. The testable core.
- `frontend/webapp/src/views/Page/__tests__/noteRefs.test.js` — **new.** Unit tests.
- `frontend/webapp/src/views/Page/Narration.js` — **modify** `SingleNoteItem` (~579-611): token-mask render, delegated click, accordion inline.
- `frontend/webapp/src/views/Page/Narration.css` (or the notes-panel stylesheet imported there) — **modify:** `.note_ref` styling.
- `frontend/webapp/src/models/GraphQLQueries.js` — **modify:** add `verse_id source` to the note selection(s); add a `notesForRef` query builder.
- `frontend/webapp/src/models/BoMOnlineAPI.js` — **modify:** wire the `notesForRef` request (if not automatic from GraphQLQueries).
- `backend/schema/BomPage.graphql:222` — **modify:** `type Note` gains `verse_id: Int`, `source: String`.
- `backend/schema/BomNotes.graphql` — **modify:** add `notesForRef(source: String!, verse_id: Int!): [Note]` to the `extend type Query`.
- Backend notes loader + `notesForRef` resolver + codegen — **modify/new** (Tasks 6-7).

Frontend-first (Tasks 1-5) delivers the resolver + rendering against the current 3-field note (source via `publication`/derivation fallback); backend (Tasks 6-8) makes `verse_id`/`source`/fetch first-class. Each task is independently testable.

---

## Task 1: `resolveNoteRefs` — qualified + `n`-suffix detection

**Files:**
- Create: `frontend/webapp/src/views/Page/noteRefs.js`
- Test: `frontend/webapp/src/views/Page/__tests__/noteRefs.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/webapp/src/views/Page/__tests__/noteRefs.test.js
import { resolveNoteRefs } from "../noteRefs";

describe("resolveNoteRefs — qualified note-refs", () => {
  test("book-qualified <ref>n is detected with resolved verseId", () => {
    const out = resolveNoteRefs("see 1 Nephi 2:13n here", null);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ verseId: 31135, rawText: "1 Nephi 2:13" });
    // span covers the trailing n so the mask strips it
    expect("see 1 Nephi 2:13n here".slice(out[0].start, out[0].end)).toBe("1 Nephi 2:13n");
  });

  test("a plain ref with no trailing n is NOT a note-ref", () => {
    expect(resolveNoteRefs("see Alma 5:14 here", null)).toEqual([]);
  });

  test("ref followed by a word starting with n is not a note-ref", () => {
    expect(resolveNoteRefs("Alma 5:14 near the end", null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: FAIL — "Cannot find module '../noteRefs'".

- [ ] **Step 3: Write minimal implementation**

```javascript
// frontend/webapp/src/views/Page/noteRefs.js
import { findReferences } from "scripture-guide";

// A findReferences match is a note-ref iff the char right after its end is the
// note marker 'n' followed by a word boundary (so "2:13n)" yes, "2:13 near" no).
const isNoteMarker = (text, end) => {
  if (text[end] !== "n") return false;
  const after = text[end + 1];
  return after === undefined || /[^A-Za-z0-9]/.test(after);
};

export function resolveNoteRefs(text, hostVerseId) {
  if (typeof text !== "string" || !text) return [];
  const results = [];
  const matches = findReferences(text, { chainAcrossMarkers: false }) || [];
  for (const m of matches) {
    if (!isNoteMarker(text, m.end)) continue;
    const verseId = m.verse_ids && m.verse_ids[0];
    if (!verseId) continue;
    results.push({ start: m.start, end: m.end + 1, verseId, rawText: text.slice(m.start, m.end) });
  }
  return results.sort((a, b) => a.start - b.start);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: PASS (3 tests). If `verseId` differs from 31135, correct the expectation to the value scripture-guide 1.0.95 returns for `1 Nephi 2:13` (do not change the code).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Page/noteRefs.js frontend/webapp/src/views/Page/__tests__/noteRefs.test.js
git commit -m "feat(notes): detect book-qualified <ref>n note-references"
```

---

## Task 2: `resolveNoteRefs` — in-context implied book

scripture-guide's context-aware `findReferences` already carries a book mentioned earlier in the same string onto a later bare ref. Lock this in.

**Files:**
- Modify: `frontend/webapp/src/views/Page/__tests__/noteRefs.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
describe("resolveNoteRefs — in-context implied book", () => {
  test("bare <ref>n inherits a book named earlier in the same note", () => {
    const out = resolveNoteRefs("As in 1 Nephi 3:7, see 5:21n.", null);
    const bare = out.find((r) => r.rawText.replace(/\s/g, "").endsWith("5:21"));
    expect(bare).toBeTruthy();
    expect(bare.verseId).toBe(31236); // 1 Nephi 5:21
  });
});
```

- [ ] **Step 2: Run test to verify it passes (no code change expected)**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: PASS — `findReferences` resolves the bare `5:21` to 1 Nephi 5:21 via context, and Task 1's code already picks it up. If verseId differs, correct the expectation to scripture-guide's value.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Page/__tests__/noteRefs.test.js
git commit -m "test(notes): cover in-context implied-book note-refs"
```

---

## Task 3: `resolveNoteRefs` — host-seeded bare refs, with the malformed guard

For a note-ref with NO book in the text at all (`see 5:21n` alone), seed the book from the host note's verse. Guard: never host-seed when an explicit (invalid) book word precedes the token — that is a malformed ref that must stay plain text (spec B1).

**Files:**
- Modify: `frontend/webapp/src/views/Page/noteRefs.js`
- Modify: `frontend/webapp/src/views/Page/__tests__/noteRefs.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
describe("resolveNoteRefs — host-seeded bare refs", () => {
  const HOST_1NE = 31135; // a verse in 1 Nephi -> host book = "1 Nephi"

  test("truly-bare <ref>n seeds the host book", () => {
    const out = resolveNoteRefs("see 5:21n.", HOST_1NE);
    expect(out).toHaveLength(1);
    expect(out[0].verseId).toBe(31236); // 1 Nephi 5:21
  });

  test("malformed explicit-book ref (invalid chapter) is NOT host-seeded", () => {
    // Jacob has 7 chapters; "Jacob 22:30" is invalid. Host is in 1 Nephi (has ch 22).
    // Must NOT fabricate 1 Nephi 22:30 — render as plain text.
    expect(resolveNoteRefs("see Jacob 22.30n.", HOST_1NE)).toEqual([]);
  });

  test("no host verse and no in-text book -> nothing", () => {
    expect(resolveNoteRefs("see 5:21n.", null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify the first two fail**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: the two new host-seed tests FAIL (no pass-2 yet); "no host verse" passes already.

- [ ] **Step 3: Add the guarded host-seed pass**

```javascript
// frontend/webapp/src/views/Page/noteRefs.js  — add imports + helpers + pass 2
import { findReferences, generateReference, lookupReference } from "scripture-guide";

// Cross-reference markers that may legitimately precede a bare note-ref.
const LEADING_MARKER = /(?:see also|see|cf\.?|c\.f\.?|compare|cited\s+at|cp\.?)\s*$/i;
// A bare chapter[:.]verse(range)? immediately followed by the 'n' marker.
const BARE_NOTEREF = /(\d+)[:.](\d+)(?:[-–]\d+)?n(?![A-Za-z0-9])/g;

const bookOf = (verseId) => {
  const ref = generateReference(verseId);
  const m = ref && ref.match(/^(.*?)\s+\d+:\d+/);
  return m ? m[1] : null;
};
const overlaps = (s, e, ranges) => ranges.some(([cs, ce]) => s < ce && e > cs);
```

Then, inside `resolveNoteRefs`, record covered ranges in pass 1 and add pass 2 before the `return`:

```javascript
  // (pass 1) record covered ranges as you iterate matches:
  const covered = [];
  for (const m of matches) {
    covered.push([m.start, m.end]);
    // ...existing isNoteMarker push...
  }

  // (pass 2) host-seed truly-bare tokens findReferences didn't cover
  const hostBook = hostVerseId ? bookOf(hostVerseId) : null;
  if (hostBook) {
    let mm;
    BARE_NOTEREF.lastIndex = 0;
    while ((mm = BARE_NOTEREF.exec(text))) {
      const start = mm.index;
      const end = start + mm[0].length; // includes trailing 'n'
      if (overlaps(start, end, covered)) continue;
      const before = text.slice(0, start).replace(LEADING_MARKER, "").trimEnd();
      if (/[A-Za-z]$/.test(before)) continue; // explicit (invalid) book -> plain text
      const lr = lookupReference(`${hostBook} ${mm[1]}:${mm[2]}`);
      const verseId = lr && lr.verse_ids && lr.verse_ids[0];
      if (!verseId) continue;
      results.push({ start, end, verseId, rawText: mm[0].slice(0, -1) });
    }
  }
```

- [ ] **Step 4: Run to verify all pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: PASS (all tests). Adjust resolved-verseId expectations to scripture-guide's values if needed — never loosen the guard.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Page/noteRefs.js frontend/webapp/src/views/Page/__tests__/noteRefs.test.js
git commit -m "feat(notes): host-seed bare note-refs with malformed-ref guard"
```

---

## Task 4: `buildNoteBodyHtml` — mask note-refs, keep scripture links

Turn note text into HTML where note-refs are `note_ref` anchors (trailing `n` stripped) and remaining refs stay `scripture_link`.

**Files:**
- Modify: `frontend/webapp/src/views/Page/noteRefs.js`
- Modify: `frontend/webapp/src/views/Page/__tests__/noteRefs.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { buildNoteBodyHtml } from "../noteRefs";

describe("buildNoteBodyHtml", () => {
  test("note-ref becomes a note_ref anchor (no trailing n); plain ref stays scripture_link", () => {
    const html = buildNoteBodyHtml("see 1 Nephi 2:13n and Alma 5:14", 31135, "193");
    expect(html).toContain('class="note_ref"');
    expect(html).toContain('data-verse="31135"');
    expect(html).toContain('data-source="193"');
    expect(html).toContain(">1 Nephi 2:13<"); // n stripped from visible text
    expect(html).not.toContain("2:13n");
    expect(html).toContain('scripture_link'); // Alma 5:14 still a scripture link
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: FAIL — `buildNoteBodyHtml` is not exported.

- [ ] **Step 3: Implement `buildNoteBodyHtml`**

```javascript
// frontend/webapp/src/views/Page/noteRefs.js  — add
import { detectReferences } from "scripture-guide";

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Replace note-ref spans with note_ref anchors (trailing 'n' dropped), then run
// the existing scripture detection on the untouched remainder. Working
// right-to-left keeps earlier offsets valid as we splice.
export function buildNoteBodyHtml(text, hostVerseId, source) {
  if (typeof text !== "string" || !text) return text || "";
  const refs = resolveNoteRefs(text, hostVerseId);
  const scriptureLinks = (s) => `<a className="scripture_link">${s}</a>`;
  if (!refs.length) return detectReferences(text, scriptureLinks, { chainAcrossMarkers: false });

  const segments = [];
  let cursor = text.length;
  for (let i = refs.length - 1; i >= 0; i--) {
    const r = refs[i];
    const tail = text.slice(r.end, cursor);
    segments.unshift(detectReferences(tail, scriptureLinks, { chainAcrossMarkers: false }));
    segments.unshift(
      `<a class="note_ref" data-source="${escapeHtml(String(source ?? ""))}" data-verse="${r.verseId}">${escapeHtml(r.rawText)}</a>`,
    );
    cursor = r.start;
  }
  segments.unshift(detectReferences(text.slice(0, cursor), scriptureLinks, { chainAcrossMarkers: false }));
  return segments.join("");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Page/noteRefs.js frontend/webapp/src/views/Page/__tests__/noteRefs.test.js
git commit -m "feat(notes): build note body html with note_ref masking"
```

---

## Task 5: Wire `SingleNoteItem` — render, delegated click, accordion, fallback

**Files:**
- Modify: `frontend/webapp/src/views/Page/Narration.js` (`SingleNoteItem`, ~579-611)

- [ ] **Step 1: Read the current `SingleNoteItem`**

Run: `sed -n '579,611p' frontend/webapp/src/views/Page/Narration.js`
Confirm it strips `<p>` tags, calls `detectReferences(text, scriptureLinks, { chainAcrossMarkers:false })`, renders via `renderPersonPlaceHTML`, and shows `ScripturePanelSingle` on `activeScripture`.

- [ ] **Step 2: Replace its body with note-ref-aware rendering**

Add imports at the top of `Narration.js` (near the other `./` imports):

```javascript
import { buildNoteBodyHtml } from "./noteRefs";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { generateReference } from "scripture-guide";
import { determineLanguage } from "src/models/Utils";
```

Rewrite `SingleNoteItem`:

```javascript
function SingleNoteItem({ item }) {
  const [activeScripture, setActiveScripture] = useState(null);
  const [siblingNotes, setSiblingNotes] = useState(null); // null=closed, []=loading/none, [..]=open

  const source = item.source || (item.id ? item.id.substr(5, 3) : "");
  const text = item.text.replace(/<\/*p.*?>/g, "");
  const bodyHtml = buildNoteBodyHtml(text, item.verse_id, source);

  const onBodyClick = (e) => {
    const a = e.target.closest && e.target.closest("a.note_ref");
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    const verse = parseInt(a.getAttribute("data-verse"), 10);
    const src = a.getAttribute("data-source");
    if (siblingNotes) return setSiblingNotes(null); // toggle closed
    BoMOnlineAPI({ notesForRef: { source: src, verse_id: verse } }).then((resp) => {
      const notes = resp?.notesForRef || [];
      if (notes.length) setSiblingNotes(notes);
      else setActiveScripture(generateReference(verse, determineLanguage())); // fallback: verse text
    });
  };

  return (
    <>
      <div key={item.id} className="noteItem" onClick={onBodyClick}>
        <div className="noteSource">
          <img src={`${assetUrl}/source/cover/${(source || "").padStart(3, "0")}`} alt="Note Source" />
        </div>
        <div className="noteText">
          <span>
            {item.title && (<><em className="focusQuote">{item.title}</em> •{" "}</>)}
            {renderPersonPlaceHTML(bodyHtml, null, (ref) => setActiveScripture(ref))}
          </span>
        </div>
      </div>
      {siblingNotes && siblingNotes.length > 0 && (
        <div className="siblingNotes">
          {siblingNotes.map((n) => (<SingleNoteItem key={n.id} item={n} />))}
        </div>
      )}
      <ScripturePanelSingle scriptureData={{ ref: activeScripture }} />
    </>
  );
}
```

Notes: the cover keeps the padded form (`padStart(3,"0")`); the fetch uses the real `source` (from `item.source` once the backend exposes it — Task 6 — falling back to the derived form until then). Rendering fetched notes through `SingleNoteItem` gives recursion for free.

- [ ] **Step 3: Verify the app compiles (HMR)**

Run: `journalctl --user -u bom-dev --no-pager -n 5 | grep -iE "compiled|error"` after saving.
Expected: "webpack compiled" with no errors. (`assetUrl` and `ScripturePanelSingle` are already in scope in this file — confirm the existing imports; add `assetUrl` import only if not already present.)

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Page/Narration.js
git commit -m "feat(notes): render note_ref links, open sibling note inline with fallback"
```

---

## Task 6: Backend — expose `verse_id` and `source` on `Note`

**Files:**
- Modify: `backend/schema/BomPage.graphql:222-226`
- Modify: the DataLoader backing `Text.notes` (see discovery step)

- [ ] **Step 1: Extend the SDL `Note` type**

In `backend/schema/BomPage.graphql`, change:

```graphql
type Note {
  id: String
  title: String
  text: String
  verse_id: Int
  source: String
}
```

- [ ] **Step 2: Locate the loader backing `Text.notes`**

The resolver is `resolvers.ts:260-261` (`ctx.loaders.notesByText.load(guid)`). The loader definition is not plain-text greppable (generated/spread). Find it:

Run: `grep -rn "notesByText" backend/src && grep -rn "is_note" backend/src/data`
Then open the loader module that constructs the notes DataLoader (it selects `bom_xtras_commentary` `is_note=1` by `location_guid`). Confirm current output shape with the live schema:

Run: `curl -s -X POST http://localhost:5006/graphql -H 'content-type: application/json' -d '{"query":"{ __type(name:\"Note\"){ fields { name } } }"}'`
Expected before edit: `id,title,text`.

- [ ] **Step 3: Add `verse_id`, `source` to that loader's select + row mapping**

In the notes DataLoader: add `'verse_id'` and `'source'` to its `.select([...])`, and include them in the object it maps each row to (keep `id: String(r.id)`). Types: `verse_id: number | null`, `source: string`.

- [ ] **Step 4: Regenerate codegen and typecheck**

Run: `cd backend && npm run codegen:graphql && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Verify the field is live**

Restart dev backend if needed (`systemctl --user restart bom-dev`), then:
Run: `curl -s -X POST http://localhost:5006/graphql -H 'content-type: application/json' -d '{"query":"{ __type(name:\"Note\"){ fields { name } } }"}'`
Expected: now includes `verse_id`, `source`.

- [ ] **Step 6: Commit**

```bash
git add backend/schema/BomPage.graphql backend/src backend/codegen
git commit -m "feat(notes): expose verse_id and source on the Note type"
```

---

## Task 7: Backend — `notesForRef(source, verse_id)` query

**Files:**
- Modify: `backend/schema/BomNotes.graphql` (Query root)
- Modify: a loader module + `backend/src/graphql/resolvers.ts` (Query resolver)

- [ ] **Step 1: Add the SDL query field**

In `backend/schema/BomNotes.graphql`, inside `extend type Query { ... }` add:

```graphql
  notesForRef(source: String!, verse_id: Int!): [Note]
```

- [ ] **Step 2: Add a resolver that returns is_note=1 notes at (source, verse_id)**

In `backend/src/graphql/resolvers.ts`, add to the `Query` resolver map (mirror the `commentary` query's style; use the writable/read `ctx.db` Kysely instance):

```typescript
    notesForRef: async (_root, args: { source: string; verse_id: number }, ctx: AppContext) => {
      const rows = await ctx.db
        .selectFrom('bom_xtras_commentary')
        .select(['id', 'title', 'text', 'verse_id', 'source'])
        .where('is_note', '=', 1)
        .where('source', '=', String(args.source))
        .where('verse_id', '=', args.verse_id)
        .orderBy('id')
        .execute();
      return rows.map((r) => ({
        id: String(r.id), title: r.title, text: r.text,
        verse_id: r.verse_id, source: r.source,
      }));
    },
```

- [ ] **Step 3: Codegen + typecheck**

Run: `cd backend && npm run codegen:graphql && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify against live data (source 193, 1 Nephi 2:13 = verse 31135)**

Run:
```bash
curl -s -X POST http://localhost:5006/graphql -H 'content-type: application/json' \
  -d '{"query":"{ notesForRef(source:\"193\", verse_id:31135){ id title } }"}'
```
Expected: a non-empty `notesForRef` array (the source-193 note on 1 Nephi 2:13).

- [ ] **Step 5: Commit**

```bash
git add backend/schema/BomNotes.graphql backend/src/graphql/resolvers.ts backend/codegen
git commit -m "feat(notes): add notesForRef(source, verse_id) query"
```

---

## Task 8: Frontend API + selection wiring

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js`
- Modify: `frontend/webapp/src/models/BoMOnlineAPI.js` (only if the request map isn't auto-derived)

- [ ] **Step 1: Add `verse_id source` to the Page-view note selection**

Find the note selection feeding the Page view (`grep -n "notes {" frontend/webapp/src/models/GraphQLQueries.js`) and add `verse_id source`:

```graphql
notes { id title text verse_id source }
```

- [ ] **Step 2: Add the `notesForRef` query builder**

In `GraphQLQueries.js`, following the `commentary: (ids) => ({...})` pattern:

```javascript
  notesForRef: (input) => {
    const { source, verse_id } = Array.isArray(input) ? input[0] : input;
    return {
      type: "notesForRef",
      key: "verse_id",
      val: false,
      query: `notesForRef(source: "${source}", verse_id: ${parseInt(verse_id, 10)}) {
        id title text verse_id source
      }`,
    };
  },
```

- [ ] **Step 3: Verify `BoMOnlineAPI({ notesForRef: { source, verse_id } })` resolves**

Confirm `BoMOnlineAPI.js` dispatches by the request key (like `commentary`); add a branch if the map is explicit. Smoke-test in the browser console on a page with a source-193 note:
```js
BoMOnlineAPI({ notesForRef: { source: "193", verse_id: 31135 } }).then(console.log)
```
Expected: `{ notesForRef: [ { id, title, text, ... } ] }`.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js frontend/webapp/src/models/BoMOnlineAPI.js
git commit -m "feat(notes): wire notesForRef fetch + note verse_id/source selection"
```

---

## Task 9: `.note_ref` styling + sibling-note accordion

**Files:**
- Modify: the notes-panel stylesheet imported by `Narration.js` (find via `grep -n "import.*\\.css\\|import.*\\.scss" frontend/webapp/src/views/Page/Narration.js`).

- [ ] **Step 1: Add distinct note-ref + accordion styles**

```css
/* note-references point at a sibling note (not scripture) — visually distinct */
.noteText a.note_ref {
  color: #8a5a00;                /* amber, distinct from scripture_link blue */
  border-bottom: 1px dotted #8a5a00;
  cursor: pointer;
}
.noteText a.note_ref:hover { background: rgba(138, 90, 0, 0.08); }

.siblingNotes {
  margin: 0.25rem 0 0.5rem 1.5rem;
  border-left: 3px solid #8a5a00;
  padding-left: 0.75rem;
}
```

- [ ] **Step 2: Dark-mode parity**

Find the dark-mode notes styles (`grep -rn "noteText\|notesPanel" frontend/webapp/src/assets/theme/scss/darkmode/`) and add a lighter amber (`#e0a75a`) for `.note_ref` there so contrast holds.

- [ ] **Step 3: Verify compile + visual**

Run: `journalctl --user -u bom-dev --no-pager -n 5 | grep -iE "compiled|error"`
Then load `http://localhost:8200`, open a source-193 note with a `<ref>n` (e.g. a note whose text contains `1 Nephi 2:13n`), confirm the amber link, click it, confirm the sibling note expands beneath.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Page
git commit -m "style(notes): distinct note_ref color + sibling-note accordion"
```

---

## Task 10: End-to-end verification + full test run

- [ ] **Step 1: Run the note-ref unit suite**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Page/__tests__/noteRefs.test.js --watchAll=false`
Expected: all PASS.

- [ ] **Step 2: Regression — scripture-guide-importing suites still pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/_Common/ATV/__tests__/proseBodyRender.test.js --watchAll=false`
Expected: PASS (confirms no scripture-guide/version regression).

- [ ] **Step 3: Manual acceptance (against `docs/specs/...` criteria)**

On `http://localhost:8200`, in a source-193 note:
1. `1 Nephi 2:13n` → amber note_ref, no trailing `n`, click opens the source-193 note inline.
2. A book-less `5.21n` in a 1-Nephi note → links to 1 Nephi 5:21's note.
3. A plain `Alma 5:14` → blue scripture_link, opens verse text.
4. A malformed `Jacob 22.30–31n` → plain text, no crash.
5. A note-ref with no sibling note → clicking opens the verse text.

- [ ] **Step 4: Final commit / branch is clean**

Run: `git status --short`
Expected: clean tree; feature complete.

---

## Self-review notes

- **Spec coverage:** functional reqs 1-5 → Tasks 4/5/9 (render, click, distinct style), 1-3 (resolution incl. host-seed); fallback reqs 6-8 → Task 3 guard + Task 5 fallback + Task 4 (plain refs unchanged); backend `verse_id`/`source`/fetch → Tasks 6-8; multi-note accordion → Task 5 (`siblingNotes.map`) + Task 9. Acceptance criteria 1-7 → Task 10.
- **Known discovery step:** Task 6 Step 2 (locate the `notesByText` loader) is a bounded investigation with exact commands, not a logic placeholder — the loader provably exists at runtime (live introspection returns `id,title,text`) but is generated/spread in a form plain grep misses. If it cannot be located/modified, fall back to deriving host `source` from `id.substr(5,3)` (padded) and host `verse_id` by fetching the host note via the existing `commentary([item.id])` query — both keep Tasks 1-5 working without the Note-type change.
- **Type consistency:** `resolveNoteRefs` returns `{start,end,verseId,rawText}` used identically in Task 4; `note_ref` anchor carries `data-source`/`data-verse` written in Task 4 and read in Task 5; `notesForRef` shape `{id,title,text,verse_id,source}` is identical across Tasks 7/8/5.
