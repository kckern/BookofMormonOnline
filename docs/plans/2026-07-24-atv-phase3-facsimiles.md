# ATV Phase 3 — Facsimile crops in the apparatus (peek + compare modal)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn each textual-variant reading pill into a window onto the primary source — hover shows one cropped scan of that verse from the earliest witness edition; click opens a modal comparing the reading across every edition that has geometry — replacing the flat year-list tooltip.

**Architecture:** The parser already yields, per reading, its `sigla` (witness editions). A witness→fax-version map turns a siglum into a renderable edition. A `FaxCrop` component fetches `{renderBaseUrl}/fax/render/{version}/crop/w{W}/{selector}.jpg` for the commentary's own verse. `WitnessPeek` (hover, one crop) and `VariantCompare` (click, a scrolling modal of readings × editions) consume it. The Phase-1 `react-tooltip` on `.atv-string` is retired in favour of these.

**Tech Stack:** React 17 (CRA), `@testing-library/react`, `html-react-parser`, `scripture-guide` (`lookupReference`), the existing `/fax/render` + `/fax/boxes` backend (Phase 0 — the db-derived version allowlist — is DEPLOYED on the dev backend `10.0.0.10:5006`).

**Scope (Phase 3):** header-apparatus reading pills gain a hover peek + a compare modal with fax crops; provenance/correction text surfaced; react-tooltip retired; a11y for the now-interactive pills; light/dark styling. **Out of scope:** prose-body-unit crops (those cite *other* verses — §6.4 trap; they open the modal WITHOUT crops), `CommentaryTile` (Phase 4), the `{text, editorial}` gloss reshape unless trivially needed, mouse-tracking magnifier zoom (a possible later refinement).

---

## Background you MUST read first

- `docs/specs/2026-07-24-atv-textual-variants-ux.md` — §5 (the sigla→edition map, J/O placeholders, siglum 0 label-only, the 11 no-geometry editions), §6.3 (crop sizes: 62% ≤100px tall), §6.4 (the two-tier peek/modal, and the "prose-body units resolve to a different verse" trap), §6.5 (the four gap treatments — this is the gap-handling contract), §6.7 (a11y/i18n/dark-mode).
- `docs/specs/2026-07-24-atv-textual-variants-ux.md` §5.2.1 — editorial correction glosses need honest labelling if surfaced.

### Confirmed infrastructure (verified 2026-07-24)

- Crop URL: `GET {base}/fax/render/{version}/crop/w{width}/{selector}.jpg` → `image/jpeg`. Widths: 200/400/800/1600.
- Selector: `ids/{verseId}` (301-redirects to canonical; the browser follows it in an `<img>`), OR the canonical `book-slug-ch.vs` (e.g. `1-nephi-1.1`) direct. Use `ids/` built from `lookupReference(reference).verse_ids` — robust, no book-slug parsing.
- Box geometry: `GET {base}/fax/boxes/{version}/ids/{verseId}` → `{ boxes: [...] }`. **Empty `boxes` means the edition has no geometry for that verse → no crop.**
- Phase 0 is live on `10.0.0.10:5006`: `1888d`, `1907`, `1920` all return real crops. Point local dev's `REACT_APP_RENDER_URL` there.
- The commentary popup (`Commentary.js`) has `commentaryData.reference` (e.g. `"1 Nephi 1:3"`). NO `verse_id` field — derive it with `scripture-guide`'s `lookupReference` (already used in `useFaxHighlight.js`).
- Precedent: `views/Home/tiles/FaxVerseTile.js` builds crop URLs exactly this way.

### The sigla → fax-version map (spec §5, the authority)

| siglum | edition | fax version | geometry | note |
|---|---|---|---|---|
| `0` | Original MS | — | none | **label-only, never a crop** (§5.1) |
| `1` | Printer's MS | `printer` | ✅ | NOT `1829` (retired, §5.1) |
| `A` | 1830 | `1830` | ✅ | |
| `B` | 1837 | `1837` | ✅ | |
| `C` | 1840 | `1840` | ✅ | |
| `D` | 1841 | `1841` | ✅ | |
| `E`–`H`,`K`–`Q`,`S` (11) | 1849…1953R | (scan, no boxes) | none | label-only |
| `I` | 1879 | `1879` | ✅ | |
| `J` | 1888 Juv. Instructor | `1888d` | ✅* | **placeholder** — caption the scan's real title (§5.2) |
| `O` | 1907 vest-pocket | `1907` | ✅* | **placeholder** — same |
| `R` | 1920 | `1920` | ✅ | Phase-0 scan fix deployed |
| `T` | 1981 | `1981` | ✅ | |

`exact: false` for `J`,`O`. `hasGeometry: false` for `0` and the 11.

---

## Task 1: The witness → fax-version map

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/faxVersions.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/faxVersions.test.js`

**Step 1: failing test**
```js
import { FAX_FOR_SIGLUM, faxCandidates } from "../faxVersions";

test("renderable sigla map to their fax version", () => {
  expect(FAX_FOR_SIGLUM["1"]).toMatchObject({ version: "printer", hasGeometry: true });
  expect(FAX_FOR_SIGLUM["A"]).toMatchObject({ version: "1830", hasGeometry: true, exact: true });
  expect(FAX_FOR_SIGLUM["T"]).toMatchObject({ version: "1981", hasGeometry: true });
});

test("J and O are placeholders (exact:false) with a real-scan title", () => {
  expect(FAX_FOR_SIGLUM["J"]).toMatchObject({ version: "1888d", exact: false });
  expect(FAX_FOR_SIGLUM["O"]).toMatchObject({ version: "1907", exact: false });
  expect(FAX_FOR_SIGLUM["J"].scanTitle).toMatch(/Deseret News|1888/);
});

test("siglum 0 and the no-geometry editions never yield a crop", () => {
  expect(FAX_FOR_SIGLUM["0"].hasGeometry).toBe(false);
  for (const s of ["E","F","G","H","K","L","M","N","P","Q","S"]) {
    expect(FAX_FOR_SIGLUM[s].hasGeometry).toBe(false);
  }
});

test("1 maps to printer, never 1829 (retired)", () => {
  expect(FAX_FOR_SIGLUM["1"].version).toBe("printer");
  expect(Object.values(FAX_FOR_SIGLUM).every((v) => v.version !== "1829")).toBe(true);
});

test("faxCandidates returns geometry-bearing sigla in chronological order", () => {
  // a reading attested by B, then everything after — earliest renderable first
  expect(faxCandidates(["B","C","D","T"])[0]).toMatchObject({ siglum: "B", version: "1837" });
  expect(faxCandidates(["E","F"])).toEqual([]);          // no geometry
  expect(faxCandidates(["0","A"])[0].siglum).toBe("A");   // 0 skipped
});
```

**Step 3: implement** — a frozen table keyed by siglum, plus `faxCandidates(sigla)` returning the geometry-bearing entries in `SIGLA_ORDER` (import from `./apparatus`). Each entry: `{ version|null, hasGeometry, exact, label, scanTitle }`. `label` = the witness label from `WITNESSES`. For J/O set `scanTitle` to the real scan name ("1888 Deseret News printing", "1907 Deseret News"). Read spec §5 for exact wording.

**Step 5: commit** `feat(atv): witness→fax-version map for the apparatus crops`.

---

## Task 2: `FaxCrop` — one cropped scan for a version + verse

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/FaxCrop.jsx`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/FaxCrop.test.js`

A presentational component: given `{ version, selector, width, alt }`, render `<img>` pointing at the crop; on error collapse (§6.5 treatment 4). No fetching logic beyond the `<img src>`.

**Step 1: failing test**
```js
import React from "react";
import { render } from "@testing-library/react";
import { FaxCrop } from "../FaxCrop";

jest.mock("src/models/BoMOnlineAPI", () => ({ renderBaseUrl: "http://render.test" }));

test("builds the crop URL from version + selector + width", () => {
  const { container } = render(<FaxCrop version="1837" selector="ids/31103" width={400} alt="1837" />);
  const img = container.querySelector("img");
  expect(img.getAttribute("src")).toBe("http://render.test/fax/render/1837/crop/w400/ids/31103.jpg");
  expect(img.getAttribute("alt")).toBe("1837");
  expect(img.getAttribute("loading")).toBe("lazy");
});

test("renders nothing when version or selector is missing", () => {
  expect(render(<FaxCrop version={null} selector="ids/1" />).container.firstChild).toBeNull();
  expect(render(<FaxCrop version="1837" selector={null} />).container.firstChild).toBeNull();
});

test("onError collapses the image (display:none), no broken-image glyph", () => {
  const { container } = render(<FaxCrop version="1837" selector="ids/31103" />);
  const img = container.querySelector("img");
  img.dispatchEvent(new Event("error"));
  expect(img.style.display).toBe("none");
});
```

**Step 3: implement** — default `width=400`; `src = ${renderBaseUrl}/fax/render/${version}/crop/w${width}/${selector}.jpg`; `loading="lazy"`; `onError` sets `e.target.style.display = "none"` (matching `CommentaryTile.js:86`). Optional `srcSet` at `w800` for retina.

**Step 5: commit** `feat(atv): FaxCrop renders a cropped verse scan, collapses on error`.

---

## Task 3: `VariantCompare` — the comparison modal (the payoff)

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/VariantCompare.jsx`, `.scss`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/VariantCompare.test.js`

Given `{ unit, verseId, onClose }` where `unit` = `{ readings }` for one variation unit, render a modal (React portal, above the draggable popup) that stacks each reading, and under each reading the crops from every geometry-bearing witness of that reading, in chronological order, with edition labels. Follows spec §6.4 tier 2 + §6.5 gaps.

Per-reading rendering rules (spec §6.5):
- **Readings with geometry-bearing sigla:** show `FaxCrop` per witness (dedupe by version; collapse a run of consecutive editions sharing the reading into one representative crop + "+ N later editions", expandable — nice-to-have, can ship without collapsing first).
- **Omission readings (∅):** still show the crop; caption "these words do not appear" (§6.5 treatment 3) — the image IS the evidence.
- **Sigla with no geometry** (0, E–H, K–Q, S): list the witness label, no crop, no empty frame (§6.5 treatments 1–2). Siglum 0 caption: "Original Manuscript — reading attested; page image not yet indexed."
- **Placeholder witnesses (J/O):** caption the scan's real title (`scanTitle`), never Skousen's edition name (§5.2).
- **Correction chains:** render the states with the arrow; a `via.label` line under (P7, the provenance surfacing).
- Header: the reference + the reading texts. Footer per witness: "View full page →" deep-links `/fax/{version}/{ref}`.

**Step 1: failing test** (render with mocked FaxCrop so no network):
```js
jest.mock("../FaxCrop", () => ({ FaxCrop: (p) => <img data-testid="crop" data-version={p.version} /> }));
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariantCompare } from "../VariantCompare";
import { parseApparatus } from "../parseATV";

const unit = parseApparatus("[<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST]").segments.find(s=>s.kind==="unit");

test("renders a crop per geometry-bearing witness, chronological", () => {
  render(<VariantCompare unit={unit} verseId={31103} onClose={()=>{}} />);
  const crops = screen.getAllByTestId("crop");
  // A(1830) for reading 1; B..T geometry-bearing (1837,1840,1841,1879,1888d,1907,1920,1981) for reading 2
  expect(crops.map(c=>c.getAttribute("data-version"))).toContain("1830");
  expect(crops.map(c=>c.getAttribute("data-version"))).toContain("1837");
});

test("Escape and the close button call onClose", () => {
  const onClose = jest.fn();
  render(<VariantCompare unit={unit} verseId={31103} onClose={onClose} />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});

test("a no-geometry witness shows its label but no crop", () => {
  const omit = parseApparatus("[<em>x</em> 0A|<em>y</em> BCDEFGHIJKLMNOPQRST]").segments.find(s=>s.kind==="unit");
  render(<VariantCompare unit={omit} verseId={31103} onClose={()=>{}} />);
  // 0 (Original MS) has no geometry -> its label appears, but no crop with data-version=""
  expect(screen.getByText(/Original Manuscript/)).toBeInTheDocument();
});
```

**Step 3: implement** using `faxCandidates`, `FaxCrop`, `WITNESSES`. Portal via `ReactDOM.createPortal` to `document.body`. Focus trap + Escape + restore focus (spec §6.7) — and **stop propagation** so the draggable popup's own key handler (`Commentary.js:337` arrows/Tab) doesn't fight it. i18n via `label()`.

**Step 5: commit** `feat(atv): VariantCompare modal — a reading across editions in facsimile`.

---

## Task 4: `WitnessPeek` + wire pills; retire react-tooltip

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/WitnessPeek.jsx`, `.scss`
- Modify: `frontend/webapp/src/views/_Common/ATV/ATVApparatus.jsx`, `frontend/webapp/src/views/_Common/ATV.js`
- Test: extend `ATVApparatus.test.js`

Spec §6.4 tier 1: hovering a pill opens a minimal card — one `FaxCrop` (earliest geometry-bearing witness), one label line ("1837 Kirtland · +18 later editions"), an expand affordance. Click (or the affordance, or Enter/Space) opens `VariantCompare`. Touch: no peek, tap → modal.

Changes to `ATVApparatus`/`Reading`:
- Pills become focusable/operable: `role="button"`, `tabIndex={0}`, `onKeyDown` Enter/Space → open modal (matches `CommentaryTile.js:75` precedent).
- `onMouseEnter` (debounced ~250ms) → peek; `onMouseLeave` → close. On touch, no peek.
- **Remove** `data-tip`/`data-for="atv-tooltip"` from the pill and the `<ReactTooltip id="atv-tooltip">` from `ATV.js` (P5/P6 retired). The peek/modal replace it.
- The pill needs the reading's `verseId` — thread it down from `ATVHeader` (derive once via `lookupReference(reference).verse_ids[0]`).
- **Aspect guard** (§6.4): if the crop would be taller than ~2:1 (the double-column editions), the peek shows label-only + "Compare →"; don't scale a tall crop.
- No-geometry / placeholder rules as in Task 3.

**Component state:** a single modal at the `ATVApparatus` (or `ATVHeader`) level, opened with the clicked unit — not one per pill.

**Test additions:** clicking a pill opens the modal (query for the modal root); the pill has `role="button"` and `tabIndex=0`; no `[data-for="atv-tooltip"]` remains; `<ReactTooltip>` is gone.

**Step 5: commit** `feat(atv): witness hover peek + click-to-compare; retire the flat tooltip`.

---

## Task 5: Styling, a11y, i18n, dark mode; browser-verify

**Files:** the new `.scss` files + `Commentary.css` + `darkmode/_read-page.scss`; i18n keys.

- Peek card + modal styling, light and dark (spec §6.7 — scans are cream on white; give the crop frame a border/inset in dark, never invert the photo).
- i18n keys via `label()`: not-yet-indexed, reading-attested-image-missing, words-do-not-appear, n-later-editions, nearest-available-scan, view-full-page. Pluralisation on "+N editions".
- a11y: modal `aria-modal`, labelled, focus-trapped, Escape, focus restore; pills operable by keyboard.
- **Arrow-glyph collision** (spec §6.7): the correction `⮕` must not read as the `→` (`&rarr;`) that appears in quoted prose.

**Browser-verify** against a local frontend pointed at the Phase-0 dev backend:
```bash
cd backend && PORT=5006 npm run dev &   # OR skip local backend and use 10.0.0.10:5006 directly
cd frontend/webapp && PORT=3000 BROWSER=none \
  REACT_APP_LOCAL_BACKEND=true REACT_APP_LOCAL_BACKEND_PORT=5006 \
  REACT_APP_RENDER_URL=http://10.0.0.10:5006 npm start &
```
Open `/commentary/1000216101` (1 Nephi 1:3, `to be`/`is`). Verify: hovering a pill shows one crop; clicking opens the modal with crops across 1830/1837/…/1981; a `∅` reading shows a crop captioned "these words do not appear"; siglum 0 shows label-only; J/O captioned with the Deseret News title; Escape closes; dark mode legible; no console errors. Screenshot light + dark.

**Step 5: commit** `style(atv): facsimile peek/modal styling, a11y, i18n, dark mode`.

---

## Definition of done

- [ ] All ATV tests green; the Phase-1/2 suites unchanged.
- [ ] Hover a header reading pill → one crop of that verse from the earliest edition with geometry.
- [ ] Click → modal comparing the reading across every geometry-bearing edition, in facsimile, chronologically.
- [ ] `∅` readings show the crop ("these words do not appear"); no-geometry witnesses show label-only (no empty frame); J/O captioned honestly.
- [ ] react-tooltip retired from the apparatus; pills keyboard-operable; modal focus-trapped + Escape; the draggable popup's key handler doesn't fight the modal.
- [ ] Light and dark both legible; browser-verified with screenshots.

## Known deferrals (later)

- **Prose-body-unit crops** — those cite other verses (§6.4 trap); prose-body pills open the modal WITHOUT crops until the cited ref is resolved.
- **`CommentaryTile`** compact variant — Phase 4 (P3).
- **Mouse-tracking magnifier zoom** on the modal crops — a possible refinement (there is a fax zoom-box pattern in the app to reuse).
- **Run collapsing** ("+18 later editions") — can ship showing all crops first; collapse is polish.
