# Reception History Money/Mini Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feature reception-history money quotes on the reception main view and the Home history tile (mini quotes) by surfacing `mini_quote` in the backend and extracting the witness source-card into one shared money-quote-led component both surfaces render.

**Architecture:** Backend adds one field (`mini_quote`) parallel to `money_quote`. A new shared `HistorySourceCard` (extracted from the witness card) renders the money-quote lead for both Witnesses and reception; the Home tile leads with a compact quote (mini→money→teaser fallback). Spec: `docs/specs/2026-08-07-reception-history-quotes-design.md`.

**Tech Stack:** Backend TypeScript (GraphQL SDL in `backend/schema/*.graphql` loaded at runtime; resolvers codegen-typed). Frontend React 17 + Jest/`@testing-library/react` (`react-scripts test`, `resetMocks:true`), plain CSS.

**Working directory:** paths are relative to repo root `/home/bom/BookofMormonOnline`. Frontend commands run from `frontend/webapp/`:

```bash
cd frontend/webapp
```
Frontend test runner: `CI=true npx react-scripts test <path> --watchAll=false`.

**Branch:** `feat/reception-history-quotes` (already checked out). NOTE: `Witnesses.css` and `Sampler.css` carry the user's pre-existing uncommitted WIP; edits here are additive and the per-task `git add` will include that WIP — that is expected and authorized.

**Backend dev server:** the live backend serves GraphQL at `http://localhost:5006/`. After backend edits, reload it (`systemctl --user restart bom-dev` bounces frontend+backend on this host; confirm status with `systemctl --user status bom-dev`) before curling.

**Commit trailer (every commit):**
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `backend/schema/BomNotes.graphql` | SDL: `mini_quote` on `HistoricalDocument` | 1 |
| `backend/src/data/loaders/searchhist.ts` | Read `mini_quote` from metadata | 1 |
| `backend/src/graphql/resolvers/searchhist.ts` | Expose `mini_quote` (injection pattern) | 1 |
| `frontend/.../History/HistorySourceCard.jsx` | **NEW** shared money-quote-led card + `withBrackets` | 2 |
| `frontend/.../History/HistorySourceCard.css` | **NEW** de-scoped card styles | 2 |
| `frontend/.../History/__tests__/HistorySourceCard.test.jsx` | **NEW** card tests | 2 |
| `frontend/.../History/Witnesses.js` | Render shared card; drop inline card + helper | 3 |
| `frontend/.../History/Witnesses.css` | Remove migrated card-internal rules | 3 |
| `frontend/.../History/History.js` | Render shared card in the reception year grid | 4 |
| `frontend/.../Home/tiles/HistoryTile.js` | mini→money→teaser quote hero | 5 |
| `frontend/.../Home/tiles/__tests__/HistoryTile.test.js` | **NEW** tile tests | 5 |
| `frontend/.../Home/Sampler.css` | Tile quote-hero styles | 5 |
| `frontend/webapp/src/models/GraphQLQueries.js` | `mini_quote` on `history`; quote fields on `homesampler.history` | 6 |

**Dependencies:** Task 2 creates the shared card; Tasks 3–4 adopt it; do 2 before 3/4. Task 1 (backend) and Task 6 (queries) are independent. Task 5 (tile) works with placeholder-quote props and only needs Task 6 for live data.

---

## Task 1: Backend — surface `mini_quote`

**Files:**
- Modify: `backend/schema/BomNotes.graphql:87`
- Modify: `backend/src/data/loaders/searchhist.ts` (HistoryRow interface ~44-49; row builder ~509-514)
- Modify: `backend/src/graphql/resolvers/searchhist.ts` (~line 99, injection block)

- [ ] **Step 1: Add the SDL field**

In `backend/schema/BomNotes.graphql`, in `type HistoricalDocument`, add `mini_quote` right after `money_quote` (line 87). Change:
```graphql
  money_quote: String
  quote_is_witness_voice: Boolean
```
to:
```graphql
  money_quote: String
  mini_quote: String
  quote_is_witness_voice: Boolean
```

- [ ] **Step 2: Read it from metadata in the loader**

In `backend/src/data/loaders/searchhist.ts`, add to the `HistoryRow` interface after `money_quote: string | null;`:
```typescript
  mini_quote: string | null;
```
And in the row-builder object (where `money_quote: metaString('money_quote'),` is), add right after it:
```typescript
      mini_quote: metaString('mini_quote'),
```

- [ ] **Step 3: Expose it via the resolver (injection pattern)**

In `backend/src/graphql/resolvers/searchhist.ts`, the `HistoricalDocument` resolver map is codegen-typed, so add `mini_quote` the same way `highlight` is injected (see the existing `(baseResolvers.SearchResult as Record<string, unknown>).highlight = …` at ~line 98). After the `baseResolvers` object literal and near the other injections, add:
```typescript
// mini_quote is not yet in the codegen snapshot; inject like highlight.
(baseResolvers.HistoricalDocument as Record<string, unknown>).mini_quote =
  (parent: unknown) => (parent as HistoryRow).mini_quote ?? null;
```
(`HistoryRow` is already imported at the top of this file.)

- [ ] **Step 4: Reload the backend and verify the field resolves**

```bash
systemctl --user restart bom-dev && sleep 4
curl -s -m 8 -X POST http://localhost:5006/ -H "Content-Type: application/json" \
  -d '{"query":"{ history(archive:\"reception\"){ slug money_quote mini_quote } }"}' \
  | head -c 400
```
Expected: NO `Cannot query field "mini_quote"` error — the response includes `mini_quote` values.
**Data check:** if `mini_quote` is non-null for at least some docs, the metadata key `mini_quote` is correct. If it is null for EVERY doc while `money_quote` is populated, the metadata key differs — STOP and report (the key needs confirming) rather than shipping an always-null field.

- [ ] **Step 5: Commit**

```bash
git add backend/schema/BomNotes.graphql backend/src/data/loaders/searchhist.ts backend/src/graphql/resolvers/searchhist.ts
git commit -m "feat(history): surface mini_quote on HistoricalDocument

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Shared `HistorySourceCard` component + styles

**Files:**
- Create: `frontend/webapp/src/views/History/HistorySourceCard.jsx`
- Create: `frontend/webapp/src/views/History/HistorySourceCard.css`
- Create: `frontend/webapp/src/views/History/__tests__/HistorySourceCard.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/History/__tests__/HistorySourceCard.test.jsx`:
```jsx
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import HistorySourceCard, { withBrackets } from "../HistorySourceCard";

const base = {
  slug: "doc-1", id: 42, date: "1830-03-26", source: "Palmyra Freeman",
  document: "The Golden Bible", citation: "Palmyra Freeman, 1830.", teaser: "<p>An early notice.</p>",
};

describe("HistorySourceCard", () => {
  test("first-hand voice renders the quote then an em-dash attribution", () => {
    render(<HistorySourceCard doc={{ ...base, money_quote: "I saw the plates", quote_speaker: "Martin Harris", quote_is_witness_voice: true }} onOpen={jest.fn()} />);
    expect(screen.getByText(/I saw the plates/)).toBeInTheDocument();
    expect(screen.getByText(/—\s*Martin Harris/)).toBeInTheDocument();
  });

  test("reporter voice renders a speaker prefix before the quote", () => {
    render(<HistorySourceCard doc={{ ...base, money_quote: "the plates were shown", quote_speaker: "The Editor", quote_is_witness_voice: false }} onOpen={jest.fn()} />);
    expect(screen.getByText(/The Editor:/)).toBeInTheDocument();
    expect(screen.getByText(/the plates were shown/)).toBeInTheDocument();
  });

  test("editorial marks [ ... ] become styled spans", () => {
    const { container } = render(<HistorySourceCard doc={{ ...base, money_quote: "he [Joseph] saw [...] them", quote_speaker: "A Witness", quote_is_witness_voice: true }} onOpen={jest.fn()} />);
    const marks = [...container.querySelectorAll(".editorialMark")].map((n) => n.textContent);
    expect(marks).toContain("[Joseph]");
    expect(marks).toContain("[...]");
  });

  test("a doc with no money quote renders no blockquote (teaser carries it)", () => {
    const { container } = render(<HistorySourceCard doc={base} onOpen={jest.fn()} />);
    expect(container.querySelector(".historyLead")).toBeNull();
    expect(container.querySelector(".historyTeaserText")).toBeInTheDocument();
  });

  test("reception variant shows source + document; witness variant does not", () => {
    const { container: rc } = render(<HistorySourceCard doc={base} variant="reception" onOpen={jest.fn()} />);
    expect(rc.querySelector(".historySource")).toHaveTextContent("Palmyra Freeman");
    expect(rc.querySelector(".historyDocTitle")).toHaveTextContent("The Golden Bible");
    const { container: wc } = render(<HistorySourceCard doc={base} variant="witness" onOpen={jest.fn()} />);
    expect(wc.querySelector(".historySource")).toBeNull();
    expect(wc.querySelector(".historyDocTitle")).toBeNull();
  });

  test("clicking the card calls onOpen with the doc", () => {
    const onOpen = jest.fn();
    render(<HistorySourceCard doc={base} onOpen={onOpen} />);
    fireEvent.click(screen.getByText(/An early notice/));
    expect(onOpen).toHaveBeenCalledWith(base);
  });

  test("withBrackets splits editorial marks from plain text", () => {
    const out = withBrackets("a [b] c");
    // array of parts: "a ", <span>[b]</span>, " c"
    expect(out.filter((p) => p && p.props && p.props.className === "editorialMark")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History/__tests__/HistorySourceCard.test.jsx --watchAll=false
```
Expected: FAIL — "Cannot find module '../HistorySourceCard'".

- [ ] **Step 3: Create the component**

Create `frontend/webapp/src/views/History/HistorySourceCard.jsx`:
```jsx
import React from "react";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import Identicon from "../_Common/Identicon";
import "./HistorySourceCard.css";

// Editorial marks in a money quote — [Name] (supplied referent) / [...] (elision)
// — set apart from the quoted words (grey Roboto, not scripture).
const BRACKET_RE = /(\[[^\]]*\])/g;
export const withBrackets = (text) =>
  String(text || "")
    .split(BRACKET_RE)
    .map((part, i) =>
      part.startsWith("[") && part.endsWith("]")
        ? <span key={i} className="editorialMark">{part}</span>
        : part
    );

// One historical-source card, money-quote-led. Shared by the witness view and
// the reception main view. variant="reception" additionally shows the source
// (header) and document title (support); variant="witness" is the original
// witness card, unchanged. onOpen(doc) fires on click (both open a popup).
export default function HistorySourceCard({ doc, variant = "reception", displayDate, onOpen }) {
  if (!doc) return null;
  const isReception = variant === "reception";
  const dateText = displayDate ? displayDate(doc.date) : (doc.date || "");
  return (
    <div className="historycard historySourceCard card" onClick={() => onOpen && onOpen(doc)}>
      <div className="historyHeader">
        <Identicon seed={doc.slug || doc.document || doc.source || ""} size={34} className="historyIdenticon" />
        {dateText && <span className="dateChip">{dateText}</span>}
        {isReception && doc.source && <div className="historySource">{doc.source}</div>}
        {doc.teaser && <div className="historyTeaserText">{Parser(doc.teaser)}</div>}
      </div>

      {/* Lead with the money quote when we have an attributed one
          (editorially prepared — [Name]/[...] are meaningful). */}
      {doc.money_quote && doc.quote_speaker && (
        <blockquote className={`historyLead${doc.quote_is_witness_voice ? " is-firsthand" : ""}`}>
          {doc.quote_is_witness_voice ? (
            <>
              <span className="money_quote_text">&ldquo;{withBrackets(doc.money_quote)}&rdquo;</span>
              <footer className="money_quote_attribution">
                <span className="money_quote_speaker">&mdash; {doc.quote_speaker}</span>
              </footer>
            </>
          ) : (
            <span className="money_quote_text">
              <span className="money_quote_speaker-prefix">{doc.quote_speaker}:</span>{" "}
              &ldquo;{withBrackets(doc.money_quote)}&rdquo;
            </span>
          )}
        </blockquote>
      )}

      <div className="historySupport">
        {doc.id && (
          <div className="historyThumb">
            <img
              style={{ aspectRatio: "1 / " + (parseFloat(doc.aspect) || 1) }}
              src={`${assetUrl}/history/thumbs/${String(doc.id).padStart(4, "0")}`}
              alt={doc.document}
              loading="lazy"
            />
          </div>
        )}
        {isReception ? (
          <div className="historySupportMain">
            {doc.document && <h5 className="historyDocTitle">{doc.document}</h5>}
            {doc.citation && <div className="citation">{Parser(doc.citation + "")}</div>}
          </div>
        ) : (
          doc.citation && <div className="citation">{Parser(doc.citation + "")}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet (de-scoped from the witness card)**

Create `frontend/webapp/src/views/History/HistorySourceCard.css` (values reproduce `Witnesses.css` lines 319–438 so the witness view is pixel-identical, plus reception-only `.historySource`/`.historyDocTitle`/`.historySupportMain`):
```css
/* Shared historical-source card — money-quote-led. Values migrated verbatim
   from the witness card so the witness view is unchanged; reception reuses it. */

.historySourceCard { cursor: pointer; }

/* ── source card LEADS with the money quote ─────────────────────────── */
.historySourceCard .historyLead {
  margin: 0;
  padding: 0.9rem 0.95rem 0.75rem;
  border-left: 3px solid #c9a24b;      /* warm accent — testimony */
  font-family: "Scripture", Georgia, serif;
  font-size: 1.05rem;
  line-height: 1.12;
  color: #2b2b2b;
}
.historySourceCard .historyLead.is-firsthand { border-left-color: #345496; }
.historySourceCard .historyLead .money_quote_text { font-style: normal; }
.historySourceCard .historyLead .editorialMark {
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  font-style: normal;
  font-size: 0.82em;
  color: #555;
}
.historySourceCard .historyLead .money_quote_speaker-prefix {
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  font-style: normal;
  font-weight: 700;
  color: #000;
  margin-right: 0.15rem;
}
.historySourceCard .historyLead .money_quote_attribution {
  margin-top: 0.5rem;
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  font-style: normal;
  font-size: 0.78rem;
  color: #777;
}
.historySourceCard .historyLead .money_quote_speaker { display: block; text-align: right; }

/* ── card header: date chip floats top-right, teaser wraps around it ──── */
.historySourceCard .historyHeader {
  padding: 0.6rem 0.7rem 0.3rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.07);
  overflow: hidden;
}
.historySourceCard .historyHeader .historyIdenticon {
  float: left;
  display: block;
  width: 34px;
  height: 34px;
  margin: 0 0.5rem 0.15rem 0;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}
.historySourceCard .historyHeader .dateChip {
  float: right;
  margin: 0.1rem 0 0.15rem 0.5rem;
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #555;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
}
.historySourceCard .historyHeader .historySource {
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  color: #333;
}
.historySourceCard .historyHeader .historyTeaserText {
  font-style: italic;
  font-size: 0.8rem;
  line-height: 1;
  color: #888;
}
.historySourceCard .historyHeader .historyTeaserText > p { margin: 0; padding: 0; }

/* ── support row: small thumbnail + metadata ────────────────────────── */
.historySourceCard .historySupport {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.6rem 0.7rem;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.07);
}
.historySourceCard .historyThumb { flex: 0 0 auto; width: 62px; }
.historySourceCard .historyThumb img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
  object-position: top center;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}
.historySourceCard .historySupport > .citation,
.historySourceCard .historySupportMain { flex: 1 1 auto; min-width: 0; align-self: center; }
.historySourceCard .historySupport > .citation { margin: 0; }
.historySourceCard .historyDocTitle {
  font-size: 0.92rem;
  font-weight: 800;
  line-height: 1.15;
  margin: 0 0 0.2rem;
  letter-spacing: -0.3px;
}
.historySourceCard .historySupportMain .citation { margin: 0; }

html[data-theme="dark"] .historySourceCard .historyLead { color: #e8e8e8; }
html[data-theme="dark"] .historySourceCard .historyDocTitle { color: #f0f0f0; }
```

- [ ] **Step 5: Run the card test to verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History/__tests__/HistorySourceCard.test.jsx --watchAll=false
```
Expected: PASS (all 7).

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/History/HistorySourceCard.jsx frontend/webapp/src/views/History/HistorySourceCard.css frontend/webapp/src/views/History/__tests__/HistorySourceCard.test.jsx
git commit -m "feat(history): shared HistorySourceCard (money-quote-led)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Adopt the shared card in the Witnesses view

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js`
- Modify: `frontend/webapp/src/views/History/Witnesses.css`

- [ ] **Step 1: Render the shared card in `SingleWitness`**

In `frontend/webapp/src/views/History/Witnesses.js`:

(a) Add the import (next to the other imports at the top):
```javascript
import HistorySourceCard from "./HistorySourceCard";
```

(b) Remove the now-shared helper — delete the `BRACKET_RE` const and the `withBrackets` function (lines ~19-29).

(c) Replace the inline card markup in the `visibleSources.map(...)` (the whole `<div key={doc.slug || i} className='historycard card' onClick={() => openSource(doc)}> … </div>`, ~lines 231-273) with:
```jsx
                            <HistorySourceCard
                                key={doc.slug || i}
                                doc={doc}
                                variant="witness"
                                displayDate={displayDate}
                                onOpen={openSource}
                            />
```

- [ ] **Step 2: Remove the migrated card-internal rules from `Witnesses.css`**

In `frontend/webapp/src/views/History/Witnesses.css`, DELETE the migrated rules (now owned by `HistorySourceCard.css`): every rule from the `/* ── source card LEADS with the money quote ── */` comment through the end of the `.single-witnesses .witness-sources .historySupport .citation` rule (lines ~318–438), i.e. all `.single-witnesses .witness-sources` rules for `.historyLead`, `.money_quote_*`, `.editorialMark`, `.firsthand-badge`, `.historyHeader`, `.historyIdenticon`, `.dateChip`, `.historyTeaserText`, `.historySupport`, `.historyThumb`, and the support `.citation`.

KEEP the witness-page layout rules that are NOT card internals: `.single-witnesses .witness-sources .my-masonry-grid` (~288), `.my-masonry-grid_column` (~293), `.single-witnesses .witness-sources .historycard` (~302) and `.historycard:hover` (~311), and the `.single-witnesses .witness-sources h5` rule (~439) — these govern the witness masonry/hover and don't belong to the shared card.

- [ ] **Step 3: Verify no regression (tests + visual)**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History --watchAll=false
```
Expected: PASS (existing History tests + the card test).

Then screenshot the witness view at `http://localhost:8200/history/witnesses/martin-harris` and confirm the source cards look **identical** to before (money-quote lead, header identicon/date/teaser, thumb + citation). This is the pixel-parity gate for the extraction.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/History/Witnesses.js frontend/webapp/src/views/History/Witnesses.css
git commit -m "refactor(history): witness view renders the shared HistorySourceCard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Adopt the shared card in the reception main view

**Files:**
- Modify: `frontend/webapp/src/views/History/History.js`

- [ ] **Step 1: Render the shared card in the reception year grid**

In `frontend/webapp/src/views/History/History.js`:

(a) Add the import (next to the others):
```javascript
import HistorySourceCard from "./HistorySourceCard";
```

(b) Replace the reactstrap `Card` in the `docList.filter(...).map((doc, i) => ( … ))` (the whole `<Card key={i} onClick={...} className='historycard'> … </Card>`, ~lines 115-141) with:
```jsx
          <HistorySourceCard
            key={i}
            doc={doc}
            variant="reception"
            displayDate={displayDate}
            onOpen={(d) => appController.functions.setPopUp({
              type: "history",
              ids: [d.slug],
              popUpData: d,
              vhtop: 10,
              underSlug: `history/${match.params.slug?.substr(0, 4) || dateFilter}`,
            })}
          />
```

(c) The reactstrap imports `Card, CardHeader, CardBody, CardTitle, CardFooter` may now be unused — remove any that are no longer referenced elsewhere in the file (keep `Button`, `ButtonGroup`, `Pagination*`, `Row`, `Col` if still used). Run the lint/build to confirm no unused-import errors; if the project treats unused imports as warnings only, leaving them is acceptable but prefer removing the clearly-dead `Card*` ones.

- [ ] **Step 2: Verify (tests + visual)**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History --watchAll=false
```
Expected: PASS.

Then screenshot `http://localhost:8200/history/reception/1830` and confirm: reception cards now lead with the money quote (two voices, editorial marks), show source (header) + document title + citation (support), and clicking a card opens the history popup. Docs without a money quote fall back to the header teaser.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/History/History.js
git commit -m "feat(history): reception main view leads with the money quote

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Home tile — mini→money→teaser quote hero

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/HistoryTile.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.css`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.test.js`:
```jsx
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistoryTile from "../HistoryTile";

const setup = (data) => render(<MemoryRouter><HistoryTile data={data} /></MemoryRouter>);
const base = { id: 7, slug: "d7", document: "A Notice", teaser: "<p>Long teaser lead here.</p> key points: <ul><li>x</li></ul>" };

describe("HistoryTile quote hero", () => {
  test("prefers the mini quote", () => {
    setup({ ...base, mini_quote: "I saw the plates", money_quote: "I saw the plates and the engravings by the power of God", quote_speaker: "Martin Harris", quote_is_witness_voice: true });
    expect(screen.getByText(/I saw the plates/)).toBeInTheDocument();
    expect(screen.getByText(/—\s*Martin Harris/)).toBeInTheDocument();
    // the full money quote is NOT shown when a mini exists
    expect(screen.queryByText(/by the power of God/)).toBeNull();
  });

  test("falls back to a trimmed money quote when there is no mini", () => {
    setup({ ...base, money_quote: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen", quote_speaker: "The Editor", quote_is_witness_voice: false });
    expect(screen.getByText(/The Editor:/)).toBeInTheDocument();
    // clamped to ~14 words → the 16th word must not appear
    expect(screen.queryByText(/sixteen/)).toBeNull();
  });

  test("falls back to the teaser lead when there is no quote at all", () => {
    const { container } = setup(base);
    expect(container.querySelector(".historyTileQuote")).toBeNull();
    expect(container.querySelector(".historyTileTeaser")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles/__tests__/HistoryTile.test.js --watchAll=false
```
Expected: FAIL — no `.historyTileQuote`; the tile renders the teaser lead regardless of quote fields.

- [ ] **Step 3: Add the quote hero to `HistoryTile.js`**

In `frontend/webapp/src/views/Home/tiles/HistoryTile.js`, after `const { lead, bullets } = parseTeaser(data.teaser);` add:
```javascript
  const quote = data.mini_quote || (data.money_quote ? clampWords(data.money_quote, 14) : null);
```
Then replace the teaser-lead block:
```javascript
            {lead ? (
              <ExpandableText className="historyTileTeaser" lines={3}>
                {lead}
              </ExpandableText>
            ) : null}
```
with a quote-first version (quote hero, else the teaser lead):
```javascript
            {quote ? (
              <blockquote className="historyTileQuote">
                {data.quote_speaker && !data.quote_is_witness_voice ? (
                  <span className="historyTileQuoteBy prefix">{data.quote_speaker}:</span>
                ) : null}{" "}
                &ldquo;{quote}&rdquo;
                {data.quote_speaker && data.quote_is_witness_voice ? (
                  <cite className="historyTileQuoteBy">&mdash; {data.quote_speaker}</cite>
                ) : null}
              </blockquote>
            ) : lead ? (
              <ExpandableText className="historyTileTeaser" lines={3}>
                {lead}
              </ExpandableText>
            ) : null}
```
(`clampWords` is already imported from `./textUtils`.)

- [ ] **Step 4: Add tile quote styles**

In `frontend/webapp/src/views/Home/Sampler.css`, add after the `.historyTileTeaser` rules (~line 1093):
```css
.historyTileQuote {
  margin: 0.15rem 0 0.35rem;
  padding-left: 0.55rem;
  border-left: 3px solid #c9a24b;
  font-family: "Scripture", Georgia, serif;
  font-size: 0.9rem;
  line-height: 1.2;
  color: #333;
}
.historyTileQuoteBy {
  display: block;
  margin-top: 0.15rem;
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  font-style: normal;
  font-size: 0.72rem;
  color: #888;
  text-align: right;
}
.historyTileQuoteBy.prefix {
  display: inline;
  margin: 0 0.15rem 0 0;
  font-weight: 700;
  color: #000;
  text-align: left;
}
html[data-theme="dark"] .historyTileQuote { color: #d6d6d6; }
html[data-theme="dark"] .historyTileQuoteBy { color: #a0a0a0; }
```

- [ ] **Step 5: Run the tile test, then verify it passes**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles/__tests__/HistoryTile.test.js --watchAll=false
```
Expected: PASS (all 3).

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/HistoryTile.js frontend/webapp/src/views/Home/Sampler.css frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.test.js
git commit -m "feat(home): history tile leads with the mini/money quote

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire the quote fields into the queries

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` (`history` query ~697; `homesampler` ~1855)

- [ ] **Step 1: Add `mini_quote` to the `history` query**

In `frontend/webapp/src/models/GraphQLQueries.js`, in the `history` query field list, after `money_quote` (line 697) add a line:
```
        mini_quote
```

- [ ] **Step 2: Add the quote fields to the `homesampler` history selection**

In the same file, replace the homesampler history selection (line 1855):
```
        history { id slug year date source archive author document teaser citation aspect }
```
with:
```
        history { id slug year date source archive author document teaser citation aspect money_quote mini_quote quote_speaker quote_is_witness_voice }
```

- [ ] **Step 3: Verify the tile receives quote data end-to-end**

Requires Task 1 (backend `mini_quote`) merged/live. Query the homesampler and confirm the history object carries the quote fields:
```bash
curl -s -m 10 -X POST http://localhost:5006/ -H "Content-Type: application/json" \
  -d '{"query":"{ homesampler { history { document money_quote mini_quote quote_speaker } } }"}' \
  | head -c 500
```
Expected: the `history` object includes `money_quote`/`mini_quote`/`quote_speaker` (some may be null depending on the sampled doc; no validation error). Then load `http://localhost:8200/` and confirm the History tile shows a quote when the sampled doc has one.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js
git commit -m "feat(history): request money/mini quote fields for reception + home tile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Frontend suites:**

```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History src/views/Home/tiles --watchAll=false
```
Expected: all PASS.

- [ ] **End-to-end walk** at `http://localhost:8200` (not `bom.kckern.net`):
  - `/history/witnesses/martin-harris` — witness source cards unchanged (pixel parity).
  - `/history/reception/1830` — reception cards lead with the money quote; source + document + citation as support; click opens the popup; quote-less docs show the teaser.
  - `/` (home) — the History tile leads with the mini quote (or trimmed money quote), attribution shown.

- [ ] **Backend** — `{ history(archive:"reception"){ mini_quote } }` returns non-null for docs that have it (Task 1 data check).

---

## Self-Review (against the spec)

**Spec coverage:**
- §1 backend `mini_quote` → Task 1 ✅
- §2 shared `HistorySourceCard` (markup + `withBrackets` + two voices + variant) → Task 2 ✅
- §3 Witnesses adoption, pixel-identical → Task 3 (+ visual gate) ✅
- §4 reception adoption (money-quote lead, source/document support, popup) → Task 4 ✅
- §5 home tile mini→money→teaser + attribution → Task 5 ✅
- §6 data flow (`history` + `homesampler` queries) → Task 6 ✅
- Testing (card voices/marks/fallback/variant; tile ladder; backend field) → Tasks 2, 5, 1 ✅

**Placeholder scan:** none — every step has concrete code/commands. The one conditional ("if mini_quote is null for every doc, the key differs — report") is a real data-verification branch, not a placeholder.

**Type/name consistency:** class names (`historySourceCard`, `historyLead`, `money_quote_*`, `editorialMark`, `historySource`, `historyDocTitle`, `historySupportMain`, `historyTileQuote`, `historyTileQuoteBy`) match between the component (Task 2), CSS (Tasks 2, 5), and tests. `withBrackets` signature and the `HistorySourceCard` props (`doc`, `variant`, `displayDate`, `onOpen`) match across Tasks 2/3/4. `mini_quote` field name identical across SDL, loader, resolver, and both queries.
```
