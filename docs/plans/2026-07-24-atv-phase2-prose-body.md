# ATV Phase 2 — Prose-body apparatus + shared component

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the ~1,000 textual-variant apparatus units that live *inside commentary prose* (P4) as styled pills instead of raw `[to be A|is BCDEF…]` text, by extracting a reusable `ATVApparatus` component and tokenizing prose-body units before `html-react-parser` runs.

**Architecture:** Phase 1 built the parser and renders only the leading `.source` header block. Prose-body units sit deep inside `<ul><li>` HTML, so they can't be found by walking parsed DOM nodes — they must be located in the raw HTML string (the parser's `scanBracketGroups` + `isApparatus` already do this), each replaced with an inert `<atv-unit>` placeholder, then swapped for a React component via `html-react-parser`'s `replace` hook. A new `ATV/ATVApparatus.jsx` renders one unit's readings as pills and is shared by the header renderer and the prose-body path.

**Tech Stack:** React 17 (CRA), Jest via `react-scripts test`, `@testing-library/react`, `html-react-parser`, `node-html-parser`, `react-tooltip` v4, `scripture-guide` (`detectScriptures`).

**Scope:** P4 (prose-body units) and the shared component only. **Out of scope (later phases):** facsimile crops / hover peek / comparison modal (Phase 3, needs backend Phase 0), `CommentaryTile` compact variant (Phase 4, P3), retiring react-tooltip and the `rebuild()` binding fix (Phase 3), full a11y for interactive pills (Phase 3, when pills gain behavior). See `docs/specs/2026-07-24-atv-textual-variants-ux.md`.

---

## Background you need

Read `docs/specs/2026-07-24-atv-textual-variants-ux.md` §2.3, §6.4 (the "Prose-body units resolve to a different verse" trap) and §6.5 before starting.

Phase 1 (`feat/atv-parser-rewrite`, merged to `dev`) delivered a pure, tested parser in `frontend/webapp/src/views/_Common/ATV/`:
- `parseApparatus(html)` → `{ segments, warnings }`; `segments` interleaves `{kind:"text",text}` and `{kind:"unit",readings}`.
- `scanBracketGroups(html)` → `{ groups:[{inner,start,end}], balanced }` — the shared bracket scanner.
- `isApparatus(inner)` — true iff a bracket group is a variation unit (≥2 pipe-parts, each ending in known sigla).
- `splitReading`, `parseStates` — reading → `{content, sigla, states}`.
- `apparatus.js` exports `WITNESSES` (siglum → `{label, provenance}`).

The current renderer `ATV.js` (rewritten in Phase 1) exports `ATVHeader({atvHTML})`. It parses the `.source` header block and renders `.atv > .source >` pills. Its private helpers `renderStates`, `Reading`, and `tipFor` are what we extract.

**The consumer**, `Commentary.js`:
- `line 301-304`: `htmlObject = text`; pulls the `.source` header out via `node-html-parser`; removes it from `htmlObject`. So `htmlObject` is the **prose body** (`.analysis` content) — this is where prose-body units live.
- `line 320-323`: `htmlObject = detectScriptures(htmlObject, cb, lang)` — linkifies scripture refs in the prose.
- `line 325`: `parserOptions = getHtmlScriptureLinkParserOptions(ref => setPopUpRef(ref))`.
- `line 423-424`: renders `<ATVHeader atvHTML={atvHTML} />` then `{Parser(htmlObject, parserOptions)}`.

**What a prose-body unit looks like** (entry `1001316103`, Skousen quoting parallel passages):
```html
<ul><li>1 Nephi 2:11
  <ul><li>for behold they did murmur ... because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was a visionary man</li></ul>
</li></ul>
```
The unit `[<em>that</em> 01A| BCDEFGHIJKLMNOPQRST]` is embedded in `<li>` text with an inline `<em>`. Measured: **1,028 entries carry 3,483 such units** (§6.5). The scripture ref above each (`1 Nephi 2:11`) *should* still linkify — that's desirable.

**The §6.4 trap — do NOT render fax crops for these.** Prose-body units cite *other* verses than the commentary's own. Phase 2 renders them as pills only (readings + sigla), no crops. Crops need the cited reference resolved and are Phase 3.

---

## Task 1: Extract `ATVApparatus` — the shared pill renderer

Pull the reading/state rendering out of `ATV.js` into a reusable component, so the header and (Task 3) the prose body render identical pills. **No behaviour change** — a pure refactor guarded by the existing `ATVHeader` tests.

**Files:**
- Create: `frontend/webapp/src/views/_Common/ATV/ATVApparatus.jsx`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/ATVApparatus.test.js`
- Modify: `frontend/webapp/src/views/_Common/ATV.js`

**Step 1: Write the failing test**

```js
// frontend/webapp/src/views/_Common/ATV/__tests__/ATVApparatus.test.js
import React from "react";
import { render } from "@testing-library/react";
import { ATVApparatus } from "../ATVApparatus";
import { parseApparatus } from "../parseATV";

// one unit's readings, straight from the parser
const readingsOf = (inner) =>
  parseApparatus(inner).segments.find((s) => s.kind === "unit").readings;

test("renders one .atv-string pill per reading, joined by ' / '", () => {
  const readings = readingsOf("[<em>to be</em> &gt; js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST]");
  const { container } = render(<ATVApparatus readings={readings} />);
  expect(container.querySelectorAll(".atv-string")).toHaveLength(3);
  expect(container.textContent).toContain(" / ");
});

test("pill carries data-indexes, data-tip (witness labels), data-for", () => {
  const readings = readingsOf("[<em>x</em> 1|<em>y</em> BCDEFGHIJKLMNOPQRST]");
  const { container } = render(<ATVApparatus readings={readings} />);
  const last = container.querySelectorAll(".atv-string")[1];
  expect(last.getAttribute("data-indexes")).toBe("BCDEFGHIJKLMNOPQRST");
  expect(last.getAttribute("data-for")).toBe("atv-tooltip");
  expect(last.getAttribute("data-tip")).toContain("1837");
});

test("omission renders as <b>∅</b> inside the pill; correction as .atv-change", () => {
  const readings = readingsOf("[NULL 1|<em>of</em> &gt;js <em>off</em> A]");
  const { container } = render(<ATVApparatus readings={readings} />);
  expect(container.querySelector(".atv-string b").textContent).toContain("∅");
  expect(container.querySelector(".atv-change")).not.toBeNull();
});

test("reading content HTML renders as elements, not literal tags", () => {
  const readings = readingsOf("[<em>to be</em> 1|<em>is</em> A]");
  const { container } = render(<ATVApparatus readings={readings} />);
  expect(container.querySelector(".atv-string em")).not.toBeNull();
  expect(container.textContent).not.toContain("<em>");
});

test("a variant class is applied when given", () => {
  const readings = readingsOf("[<em>x</em> 1|<em>y</em> A]");
  const { container } = render(<ATVApparatus readings={readings} variant="inline" />);
  expect(container.querySelector(".atv-apparatus.atv-inline")).not.toBeNull();
});

test("renders nothing for empty readings", () => {
  const { container } = render(<ATVApparatus readings={[]} />);
  expect(container.firstChild).toBeNull();
});
```

**Step 2: Run to verify it fails**

```bash
cd frontend/webapp
CI=true npx react-scripts test --testPathPattern="ATVApparatus" --watchAll=false
```
Expected: FAIL — `Cannot find module '../ATVApparatus'`.

**Step 3: Implement `ATVApparatus.jsx`**

Move `tipFor`, `renderStates`, `Reading` verbatim out of `ATV.js` into this module. Wrap the readings in a `span.atv-apparatus` carrying an optional variant class.

```jsx
// frontend/webapp/src/views/_Common/ATV/ATVApparatus.jsx
import React from "react";
import Parser from "html-react-parser";
import { WITNESSES } from "./apparatus";

const tipFor = (sigla) =>
  sigla.map((s) => WITNESSES[s] && WITNESSES[s].label).filter(Boolean).join("; ");

// one reading's states, in order: original, then (arrow + next state) per correction
function renderStates(states) {
  const out = [];
  states.forEach((st, i) => {
    if (i > 0) out.push(<span className="atv-change" key={`c${i}`}>⮕ </span>);
    out.push(
      <React.Fragment key={`s${i}`}>
        {st.omitted ? <b>∅</b> : Parser(st.content)}
      </React.Fragment>
    );
  });
  return out;
}

function Reading({ reading }) {
  return (
    <span
      className="atv-string"
      data-indexes={reading.sigla.join("")}
      data-tip={tipFor(reading.sigla)}
      data-for="atv-tooltip"
    >
      {renderStates(reading.states)}
    </span>
  );
}

/** One variation unit's readings as pills, joined by " / ". `variant` is a
 *  styling hook ("inline" in prose, undefined for the header box). */
export function ATVApparatus({ readings, variant }) {
  if (!readings || !readings.length) return null;
  const cls = "atv-apparatus" + (variant ? ` atv-${variant}` : "");
  return (
    <span className={cls}>
      {readings.map((r, j) => (
        <React.Fragment key={j}>
          {j > 0 ? " / " : ""}
          <Reading reading={r} />
        </React.Fragment>
      ))}
    </span>
  );
}
```

**Step 4: Rewrite `ATV.js` to use it.** Replace the inline `renderStates`/`Reading`/unit-mapping with `<ATVApparatus>`. Keep the `.atv > .source` wrapper, the text-segment rendering, the spacing, and the single `<ReactTooltip>`.

```jsx
// frontend/webapp/src/views/_Common/ATV.js
import React from "react";
import Parser from "html-react-parser";
import ReactTooltip from "react-tooltip";
import { parse } from "node-html-parser";
import { parseApparatus } from "./ATV/parseATV";
import { ATVApparatus } from "./ATV/ATVApparatus";

function ATVHeader({ atvHTML }) {
  if (!atvHTML) return null;
  const inner = parse(atvHTML).querySelector(".source");
  const src = inner ? inner.innerHTML : atvHTML;
  const { segments } = parseApparatus(src);
  if (!segments.length) return null;

  return (
    <>
      <div className="atv">
        <div className="source">
          {segments.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 ? " " : ""}
              {seg.kind === "text" ? Parser(seg.text) : <ATVApparatus readings={seg.readings} />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <ReactTooltip id="atv-tooltip" place="top" effect="solid" />
    </>
  );
}

export { ATVHeader };
```

**Step 5: Run all ATV tests — the existing `ATVHeader` suite must still pass unchanged.**

```bash
CI=true npx react-scripts test --testPathPattern="ATV" --watchAll=false
```
Expected: PASS. The 8 `ATVHeader` tests are the regression guard that the refactor changed no behaviour. If any needs editing, STOP — the refactor altered output, which it must not.

**Step 6: Commit**

```bash
git add frontend/webapp/src/views/_Common/ATV/ATVApparatus.jsx \
        frontend/webapp/src/views/_Common/ATV/__tests__/ATVApparatus.test.js \
        frontend/webapp/src/views/_Common/ATV.js
git commit -m "refactor(atv): extract ATVApparatus, the shared pill renderer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `extractApparatusUnits` — tokenize prose-body units

A pure function that finds apparatus units in a prose HTML string and replaces each with an inert `<atv-unit data-atv-i="N">` placeholder, returning the placeholder-ised HTML plus the parsed units. Operates on the raw string (units span multiple DOM nodes, so this must precede parsing). Tokenizing **before** `detectScriptures` also hides reading content from scripture-link detection.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ATV/parseATV.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/parseATV.test.js`

**Step 1: Write the failing test**

```js
import { extractApparatusUnits } from "../parseATV";

test("replaces each apparatus unit with an indexed placeholder", () => {
  const src = "because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was";
  const { html, units } = extractApparatusUnits(src);
  expect(html).toBe('because <atv-unit data-atv-i="0"></atv-unit> he was');
  expect(units).toHaveLength(1);
  expect(units[0]).toHaveLength(2);          // two readings
  expect(units[0][0].sigla).toEqual(["0", "1", "A"]);
});

test("leaves prose brackets and non-apparatus untouched", () => {
  const src = "a note [not apparatus] and [<em>a</em>|<em>o</em>] spelling";
  const { html, units } = extractApparatusUnits(src);
  expect(units).toHaveLength(0);
  expect(html).toBe(src);                     // unchanged
});

test("indexes multiple units in document order", () => {
  const src = "x [a A|b B] y [c A|d B] z";
  const { html, units } = extractApparatusUnits(src);
  expect(html).toBe('x <atv-unit data-atv-i="0"></atv-unit> y <atv-unit data-atv-i="1"></atv-unit> z');
  expect(units).toHaveLength(2);
});

test("preserves surrounding block HTML", () => {
  const src = "<ul><li>ref<ul><li>text [<em>that</em> 0A| BCDEFGHIJKLMNOPQRST] more</li></ul></li></ul>";
  const { html } = extractApparatusUnits(src);
  expect(html).toContain("<ul><li>ref<ul><li>text <atv-unit");
  expect(html).toContain("</atv-unit> more</li></ul></li></ul>");
});

test("empty / null input is safe", () => {
  expect(extractApparatusUnits("")).toEqual({ html: "", units: [] });
  expect(extractApparatusUnits(null)).toEqual({ html: "", units: [] });
});
```

**Step 2: Run to verify it fails** — `extractApparatusUnits is not a function`.

**Step 3: Implement** (add to `parseATV.js`, reusing the existing private `toReading` helper that `parseApparatus` already uses):

```js
/**
 * Find apparatus units in a prose HTML string and replace each with an inert
 * <atv-unit data-atv-i="N"> placeholder. Returns the placeholder-ised html plus
 * `units[N]` = that unit's readings. Units span multiple DOM nodes, so this
 * works on the raw string, NOT parsed nodes. Non-apparatus brackets are left
 * exactly as-is. Never throws.
 */
export function extractApparatusUnits(html) {
  if (!html || typeof html !== "string") return { html: html || "", units: [] };
  const { groups } = scanBracketGroups(html);
  const units = [];
  let out = "";
  let from = 0;
  for (const g of groups) {
    if (!isApparatus(g.inner)) continue;
    const i = units.length;
    units.push(g.inner.split("|").map(toReading));
    out += html.slice(from, g.start) + `<atv-unit data-atv-i="${i}"></atv-unit>`;
    from = g.end + 1;
  }
  out += html.slice(from);
  return { html: out, units };
}
```

**Step 4: Run to verify pass**, then run the full corpus regression to prove it finds the expected count without throwing:

```bash
CI=true npx react-scripts test --testPathPattern="ATV/__tests__/parseATV" --watchAll=false
# with the corpus dump (from the private workspace):
ATV_CORPUS=/tmp/atv.json CI=true npx react-scripts test --testPathPattern="corpusRegression" --watchAll=false
```
(The corpus test still asserts the header baseline; extractApparatusUnits is exercised by the unit tests. If you want a body-unit count guard, that is Task 4's optional addition.)

**Step 5: Commit** `feat(atv): extractApparatusUnits tokenizes prose-body units to placeholders`.

---

## Task 3: Render prose-body units in `Commentary.js`

Wire the tokenizer and a `replace` hook that turns `<atv-unit>` placeholders into `<ATVApparatus variant="inline">`. This touches the commentary body render path — **high blast radius** (every commentary, not just ATV). Guard it well and browser-verify.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Commentary.js`
- Test: `frontend/webapp/src/views/_Common/ATV/__tests__/proseBodyRender.test.js` (a focused render test; do not try to mount the whole popup)

**Step 1: Verify `getHtmlScriptureLinkParserOptions`'s shape** before wiring — you need to compose with its `replace`:

```bash
grep -n "getHtmlScriptureLinkParserOptions" -A 20 frontend/webapp/src/views/_Common/ViewUtils.js | head -30
```
Confirm it returns an object with a `replace(domNode)` function. Your combined options must call it as a fallback so scripture links still work.

**Step 2: Write the failing test** — a small component that reproduces Commentary's body pipeline (tokenize → detectScriptures is optional in the test → Parser with combined replace):

```js
// proseBodyRender.test.js
import React from "react";
import { render } from "@testing-library/react";
import Parser from "html-react-parser";
import { extractApparatusUnits } from "../parseATV";
import { ATVApparatus } from "../ATVApparatus";

function renderBody(html) {
  const { html: tokenized, units } = extractApparatusUnits(html);
  const options = {
    replace: (node) => {
      if (node.name === "atv-unit") {
        const i = Number(node.attribs && node.attribs["data-atv-i"]);
        return <ATVApparatus readings={units[i]} variant="inline" />;
      }
      return undefined;
    },
  };
  return render(<div>{Parser(tokenized, options)}</div>);
}

test("a prose-body unit renders as inline pills, block structure intact", () => {
  const { container } = renderBody(
    "<ul><li>1 Nephi 2:11<ul><li>because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was</li></ul></li></ul>"
  );
  expect(container.querySelector("ul li ul li")).not.toBeNull();          // nesting preserved
  expect(container.querySelector(".atv-apparatus.atv-inline")).not.toBeNull();
  expect(container.querySelectorAll(".atv-string")).toHaveLength(2);
  expect(container.textContent).toContain("because");
  expect(container.textContent).toContain("he was");
});

test("prose with no apparatus renders unchanged", () => {
  const { container } = renderBody("<p>just prose, no variants</p>");
  expect(container.querySelector(".atv-apparatus")).toBeNull();
  expect(container.textContent).toBe("just prose, no variants");
});
```

**Step 3: Run to verify pass** (the test uses only shipped pieces — it should pass once Tasks 1–2 are in; it documents the exact wiring Commentary needs).

**Step 4: Wire `Commentary.js`.** At the body-prep block (around line 301-325), tokenize before `detectScriptures`, and compose the parser options. Concretely:

```js
import { extractApparatusUnits } from "./ATV/parseATV";
import { ATVApparatus } from "./ATV/ATVApparatus";
// ...
let htmlObject = text;
let domObject = parse(text);
let atvHTML = domObject.querySelector(".source")?.outerHTML.trim() || "";
if (atvHTML) htmlObject = htmlObject.replace(atvHTML, "").trim();

// Phase 2: pull prose-body apparatus units out to placeholders BEFORE scripture
// detection, so reading content isn't linkified and units survive as <atv-unit>.
const { html: bodyTokenized, units: bodyUnits } = extractApparatusUnits(htmlObject);
htmlObject = bodyTokenized;
// ... (heading code unchanged) ...
htmlObject = detectScriptures(htmlObject, (scripture) => {
  if (!scripture) return;
  return `<a className="scripture_link">${scripture}</a>`;
}, determineLanguage());

const baseOptions = getHtmlScriptureLinkParserOptions((ref) => setPopUpRef(ref));
const parserOptions = {
  ...baseOptions,
  replace: (node) => {
    if (node && node.name === "atv-unit") {
      const i = Number(node.attribs && node.attribs["data-atv-i"]);
      return <ATVApparatus readings={bodyUnits[i]} variant="inline" />;
    }
    return baseOptions.replace ? baseOptions.replace(node) : undefined;
  },
};
```
Leave `line 423-424` (`<ATVHeader .../>` then `{Parser(htmlObject, parserOptions)}`) as-is.

**Step 5: Full suite + browser-verify.** Run `CI=true npx react-scripts test --testPathPattern="ATV" --watchAll=false` (all green). Then start the app (backend `:5006`, frontend `:3000` — see `CLAUDE.local.md`) and open a commentary with prose-body units, e.g. `http://localhost:3000/commentary/1001316103`. Confirm: the `<li>` cross-reference examples now show inline pills (`that / ∅`), the block list structure is intact, the scripture ref `1 Nephi 2:11` above each is still a link, no console errors. Screenshot.

**Step 6: Commit** `feat(atv): render prose-body apparatus units as inline pills (P4)`.

---

## Task 4: Inline styling + dark mode

The inline pills need to read cleanly in prose — no grey box (that's the header's `.atv`), tighter than the header. Add styles and their dark-mode counterparts.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Commentary.css`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode/_read-page.scss`

**Step 1** (no test — visual). Add to `Commentary.css`:
```css
.atv-apparatus.atv-inline { font-family: "Roboto Condensed", sans-serif; }
.atv-apparatus.atv-inline .atv-string {
  /* inline in prose: keep the white pill but drop the header's monospace context */
  background-color: #f3f3f3;
  padding: 0 0.4ex;
  border-radius: 0.6ex;
  font-weight: bold;
  color: #000;
}
```
(Tune to match the existing `.atv-string` look; keep the ∅/`.atv-change` rules — they already apply.)

**Step 2** — dark mode. `_read-page.scss` already styles `.atv`/`.atv-string`; add the inline variant near line 50:
```scss
.atv-apparatus.atv-inline .atv-string {
  background-color: var(--surface-2);
  color: var(--text-primary);
}
```

**Step 3** — browser-verify light + dark at `/commentary/1001316103`. Screenshot both.

**Step 4: Commit** `style(atv): inline prose-pill styling, light and dark`.

**Optional guard:** add a body-unit count assertion to `corpusRegression.test.js` — run `extractApparatusUnits` over each entry's `.analysis` body and assert the total is 3,483 (the §6.5 baseline), so a tokenizer regression is caught.

---

## Definition of done

- [ ] `CI=true npx react-scripts test --testPathPattern="ATV" --watchAll=false` green; the 8 `ATVHeader` tests unchanged.
- [ ] Prose-body units render as inline pills in the browser at `/commentary/1001316103`; block list structure and scripture links intact; no console errors.
- [ ] The header apparatus is visually unchanged (Task 1 is a pure refactor).
- [ ] Light and dark mode both legible.

## Known deferrals (Phase 3, do NOT do here)

- **Tooltip binding on prose-body pills.** They carry `data-for="atv-tooltip"` and bind to the header's single `<ReactTooltip>` — but react-tooltip v4 binds at mount, so pills added by the body render may need a `ReactTooltip.rebuild()` (P6). Phase 3 retires react-tooltip for the peek/modal; don't chase the binding here. Note it if it shows in the browser.
- **Fax crops / hover peek / modal** — Phase 3, needs backend Phase 0.
- **Provenance & correction-label display, `{text, editorial}` reshape** (§5.2.1) — Phase 3.
- **Full keyboard/focus/ARIA** — Phase 3, when pills gain click behaviour. Inline pills are non-interactive spans in Phase 2, same as the header pills.
