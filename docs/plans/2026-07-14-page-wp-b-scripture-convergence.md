# Scripture UI Convergence Implementation Plan (WP-B: shared link parser + ref grid)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One scripture-link DOM replacer shared by `renderPersonPlaceHTML` and `ParseMessage` (killing the last duplicated parser), and one scripture-ref grid component shared by Narration's `ScripturePanel` and Utils' `ScripturesContainer`.

**Architecture:** `makeScriptureLinkReplacer({onClick, getClassName})` is a factory returning an html-react-parser `replace`-compatible function; PersonPlace uses it plainly, ParseMessage layers its active-ref-index behavior on top via the two callbacks (the genuinely different part stays at the call site). `ScriptureRefGrid` renders the ref grid with an injectable item renderer so each site keeps its exact current markup (behavior-preserving).

**Tech Stack:** React 17, html-react-parser, Jest + @testing-library/react 11.

**Execution order note:** Independent of the other WP plans; can run any time after WP-A (no file conflicts with WP-C1/WP-D beyond trivial import lines). Origin: WP-B2 + WP-B3 in `docs/specs/2026-07-14-page-view-structural-followups.md`. **WP-B1 (full bubble merge) is intentionally NOT in this plan** — the spec recommends skipping it unless a third bubble type appears.

**Working conventions for every task:**
- Frontend root: `frontend/webapp`; paths relative to it.
- Run tests: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` (scope with a path).
- **Test baseline: fully green — `Tests: 159 passed` (as of `d5c6f8c2`; if WP-A landed first the count is higher — record the number at Task 0 and require zero failures throughout).**
- Smoke on `http://localhost:8200`, never `bom.kckern.net`.
- Grep for quoted snippets; line numbers drift. One commit per task.

---

## Task 1: `makeScriptureLinkReplacer` (TDD)

**Files:**
- Create: `frontend/webapp/src/views/_Common/scriptureLinkReplacer.js`
- Create: `frontend/webapp/src/views/_Common/__tests__/scriptureLinkReplacer.test.js`

Background: `detectReferences`/`detectScripturesPreservingTokens` emit `<a className="scripture_link">Alma 5:2</a>` html strings; html-react-parser lowercases the attribute to `classname`. Today TWO replace-branches turn that into a clickable React anchor: `renderPersonPlaceHTML` (`views/Page/PersonPlace.js`, `attribs?.classname === 'scripture_link'` branch) and `ParseMessage` (`models/Utils.js`, same check plus active-ref index tracking).

- [ ] **Step 1: Write the failing tests**

```js
// frontend/webapp/src/views/_Common/__tests__/scriptureLinkReplacer.test.js
import React from "react";
import Parser from "html-react-parser";
import { render, fireEvent, screen } from "@testing-library/react";
import { makeScriptureLinkReplacer } from "../scriptureLinkReplacer";

const HTML = 'see <a className="scripture_link">Alma 5:2</a> here';

test("turns scripture_link anchors into clickable elements passing the ref text", () => {
  const onClick = jest.fn();
  const replacer = makeScriptureLinkReplacer({ onClick });
  render(<div>{Parser(HTML, { replace: replacer })}</div>);
  const link = screen.getByText("Alma 5:2");
  expect(link.tagName).toBe("A");
  expect(link.className).toBe("scripture_link");
  fireEvent.click(link);
  expect(onClick).toHaveBeenCalledWith("Alma 5:2");
});

test("getClassName customizes the class per ref", () => {
  const replacer = makeScriptureLinkReplacer({
    onClick: () => {},
    getClassName: (ref) => "scripture_link" + (ref === "Alma 5:2" ? " active" : ""),
  });
  render(<div>{Parser(HTML, { replace: replacer })}</div>);
  expect(screen.getByText("Alma 5:2").className).toBe("scripture_link active");
});

test("returns undefined for non-matching nodes (parser falls through)", () => {
  const replacer = makeScriptureLinkReplacer({ onClick: () => {} });
  render(<div>{Parser('<a class="person">Nephi</a>', { replace: replacer })}</div>);
  // Untouched by the replacer: still an anchor with its original class.
  expect(screen.getByText("Nephi").className).toBe("person");
});

test("missing onClick does not throw on click", () => {
  const replacer = makeScriptureLinkReplacer({});
  render(<div>{Parser(HTML, { replace: replacer })}</div>);
  expect(() => fireEvent.click(screen.getByText("Alma 5:2"))).not.toThrow();
});
```

- [ ] **Step 2: Run — FAIL** (`Cannot find module '../scriptureLinkReplacer'`).

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/_Common/__tests__/scriptureLinkReplacer.test.js 2>&1 | tail -12`

- [ ] **Step 3: Implement**

```js
// frontend/webapp/src/views/_Common/scriptureLinkReplacer.js
// The one scripture_link → clickable-anchor transform. detectReferences emits
// `<a className="scripture_link">Ref</a>`; html-react-parser lowercases the
// attribute to `classname`. Previously duplicated in renderPersonPlaceHTML
// (PersonPlace.js) and ParseMessage (models/Utils.js) — the ParseMessage
// variant's active-ref behavior is expressed through the two callbacks.
import React from "react";

export function makeScriptureLinkReplacer({ onClick, getClassName } = {}) {
  return (domNode) => {
    const { name, attribs, children } = domNode || {};
    if (name !== "a" || attribs?.classname !== "scripture_link") return undefined;
    const ref = children?.[0]?.data ?? "";
    const { classname, ...rest } = attribs;
    const className = getClassName ? getClassName(ref) : "scripture_link";
    return (
      <a {...rest} className={className} onClick={() => onClick?.(ref)}>
        {ref}
      </a>
    );
  };
}
```

- [ ] **Step 4: Run — PASS (all 4).** **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/_Common/scriptureLinkReplacer.js frontend/webapp/src/views/_Common/__tests__/scriptureLinkReplacer.test.js
git commit -m "feat(common): shared makeScriptureLinkReplacer for scripture_link anchors (TDD)"
```

## Task 2: PersonPlace.js uses the shared replacer

**Files:**
- Modify: `frontend/webapp/src/views/Page/PersonPlace.js`

- [ ] **Step 1: Read the current scripture branch** in `renderPersonPlaceHTML`'s `options.replace`:

```js
      const attribs = { ...domNode.attribs };
      if (attribs?.classname === 'scripture_link') {
        const ref = domNode.children[0].data;
        // TODO: figure out why not a regular class here insead of className (reparsed?)
        attribs.className = attribs.classname;
        delete attribs.classname;
        return <a {...attribs} onClick={()=>scriptureLinkClickHandler(ref)}>{ref}</a>;
      }
```

- [ ] **Step 2: Replace it.** Add the import at the top:
```js
import { makeScriptureLinkReplacer } from "../_Common/scriptureLinkReplacer";
```
In `renderPersonPlaceHTML`, ABOVE the `const options = {` line, build the replacer once per call:
```js
  const scriptureReplacer = makeScriptureLinkReplacer({
    onClick: (ref) => scriptureLinkClickHandler?.(ref),
  });
```
Then replace the whole branch quoted in Step 1 (including the `const attribs = { ...domNode.attribs };` line IF nothing after the branch uses `attribs` — check: the person/place/react-tooltip branches below read `domNode.attribs` directly, so the local `attribs` copy served only this branch; delete it) with:
```js
      const scriptureEl = scriptureReplacer(domNode);
      if (scriptureEl !== undefined) return scriptureEl;
```
Behavior notes: (a) the shared version adds a `name === "a"` check — strictly safer; (b) `onClick` now optional-chains the handler — previously a scripture link rendered by a caller that passed NO handler would throw on click; now it's a no-op (hardening, document in commit); (c) the stale `// TODO … className` comment dies with the branch.

- [ ] **Step 3: Suite green + smoke:** open a verse's Notes panel (`SingleNoteItem` renders through this path) — scripture refs clickable, inline passage opens. Also open a person popup whose description contains scripture refs (PopUp path) — still clickable.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Page/PersonPlace.js
git commit -m "refactor(page): renderPersonPlaceHTML uses shared scripture-link replacer"
```

## Task 3: ParseMessage uses the shared replacer (keeps active-ref indexing)

**Files:**
- Modify: `frontend/webapp/src/models/Utils.js`

- [ ] **Step 1: Read the current block** in `ParseMessage`:

```js
  const options = {
    replace: ({ name, attribs, children }) => {
      if (name === 'a' && attribs.classname === 'scripture_link') {
        const ref = domToReact(children, options);
        const refIndex = scriptures.indexOf(ref);
        // html-react-parser lower-cases the raw `class` attribute to `classname`;
        // re-emit it as React's `className` (not `class`, which React rejects as
        // an invalid DOM prop and silently drops, killing the link styling).
        const { classname, ...rest } = attribs;
        const isActive = activeRef === refIndex;
        const className = "scripture_link" + (isActive ? " active" : "");
        const activateRef = () => {
          setActiveRef(refIndex);
        }
        return <a {...rest} className={className} onClick={activateRef}>{ref}</a>;
      }
    }
  };
```

- [ ] **Step 2: Replace with the shared factory.** Add the import near the other view imports in Utils.js:
```js
import { makeScriptureLinkReplacer } from "../views/_Common/scriptureLinkReplacer";
```
Replace the whole `const options = { … };` block with:
```js
  // Active-ref selection layered on the shared replacer: index lookup drives
  // both the " active" class and the click-to-select behavior.
  const options = {
    replace: makeScriptureLinkReplacer({
      onClick: (ref) => setActiveRef(scriptures.indexOf(ref)),
      getClassName: (ref) =>
        "scripture_link" +
        (activeRef === scriptures.indexOf(ref) ? " active" : ""),
    }),
  };
```
Parity note: the old `domToReact(children, options)` returned the plain ref string for these text-only anchors — `children[0].data` in the shared replacer yields the identical string, so `scriptures.indexOf(ref)` resolves the same index. If `domToReact` is now unused in Utils.js (`grep -n "domToReact" frontend/webapp/src/models/Utils.js`), remove it from the `html-react-parser` import (keep `Parser` — still used by `ParseMessage` itself).

- [ ] **Step 3: Suite green + smoke:** in a study-group chat (or the messenger dev harness), send/see a message containing a scripture ref — the link renders, clicking it highlights it (" active") and opens the passage below; a message with TWO refs toggles active between them.

- [ ] **Step 4: Verify single implementation**

Run: `grep -rn "classname === .scripture_link\|classname === \"scripture_link\"" frontend/webapp/src --include=*.js`
Expected: only `scriptureLinkReplacer.js`.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/models/Utils.js
git commit -m "refactor(messenger): ParseMessage layers active-ref selection on the shared scripture-link replacer"
```

## Task 4: `ScriptureRefGrid` shared component

**Files:**
- Create: `frontend/webapp/src/views/_Common/ScriptureRefGrid.js`
- Create: `frontend/webapp/src/views/_Common/__tests__/ScriptureRefGrid.test.js`
- Modify: `frontend/webapp/src/views/Page/Narration.js` (ScripturePanel)
- Modify: `frontend/webapp/src/models/Utils.js` (ScripturesContainer)

The two grids share: map refs → `.scriptureItem` divs with `active` on the selected index and click-to-select. They differ in inner markup (Narration wraps each ref in `<div className="ref">`; Utils renders the bare string) and wrapper classes (`noselect` on Narration's). Keep the differences via props — this is behavior-preserving extraction, not markup unification.

- [ ] **Step 1: Write the failing tests**

```js
// frontend/webapp/src/views/_Common/__tests__/ScriptureRefGrid.test.js
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { ScriptureRefGrid } from "../ScriptureRefGrid";

const refs = ["Alma 5:2", "Mosiah 3:19"];

test("renders one item per ref, marks the active index, selects on click", () => {
  const onSelect = jest.fn();
  const { container } = render(
    <ScriptureRefGrid items={refs} activeIndex={1} onSelect={onSelect} />
  );
  const items = container.querySelectorAll(".scriptureItem");
  expect(items).toHaveLength(2);
  expect(items[1].className).toContain("active");
  expect(items[0].className).not.toContain("active");
  fireEvent.click(screen.getByText("Alma 5:2"));
  expect(onSelect).toHaveBeenCalledWith(0);
});

test("renders nothing for empty items", () => {
  const { container } = render(<ScriptureRefGrid items={[]} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});

test("renderItemContent customizes inner markup; className extends the wrapper", () => {
  const { container } = render(
    <ScriptureRefGrid
      items={refs}
      activeIndex={0}
      onSelect={() => {}}
      className="noselect"
      renderItemContent={(ref) => <div className="ref">{ref}</div>}
    />
  );
  expect(container.querySelector(".scripturePanel").className).toBe(
    "scripturePanel noselect"
  );
  expect(container.querySelectorAll(".scriptureItem .ref")).toHaveLength(2);
});
```

- [ ] **Step 2: Run — FAIL** (module missing). **Step 3: Implement**

```js
// frontend/webapp/src/views/_Common/ScriptureRefGrid.js
// Grid of scripture references with an active selection — previously
// duplicated between Narration's ScripturePanel (keyboard-nav variant) and
// Utils' ScripturesContainer (plain variant). Inner item markup is injectable
// because the two sites style their items differently; the keyboard handling
// stays at the Narration call site (it is the genuinely different part).
import React from "react";

export function ScriptureRefGrid({
  items,
  activeIndex = null,
  onSelect,
  className = "",
  renderItemContent = (ref) => ref,
}) {
  if (!items?.length) return null;
  return (
    <div className={("scripturePanel " + className).trim()}>
      {items.map((ref, i) => (
        <div
          key={ref + "_" + i}
          className={"scriptureItem" + (activeIndex === i ? " active" : "")}
          onClick={() => onSelect(i)}
        >
          {renderItemContent(ref)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run — PASS (all 3).**

- [ ] **Step 5: Wire Narration's ScripturePanel.** Its current grid JSX is:
```js
    <div className="scripturePanel noselect">
      {textRefs.map(({ref},i)=> {
        return <div key={ref + "_" + i} className={"scriptureItem" + (activeRef===i?" active":"")} onClick={()=>setActiveRef(i)}>
          <div className="ref">{ref}</div>
          <div>
        </div>
        </div>
      })}
    </div>
```
Replace with:
```js
    <ScriptureRefGrid
      items={textRefs.map(({ ref }) => ref)}
      activeIndex={activeRef}
      onSelect={setActiveRef}
      className="noselect"
      renderItemContent={(ref) => <div className="ref">{ref}</div>}
    />
```
Import in Narration.js: `import { ScriptureRefGrid } from "../_Common/ScriptureRefGrid";`
(Parity note: the old markup contained a stray empty `<div></div>` per item — dropped; it rendered nothing. The keyboard-nav effect above the grid is untouched: it computes `colCount` from `document.querySelector(".scripturePanel")` children widths, which still resolve — same classes, same child count.)

- [ ] **Step 6: Wire Utils' ScripturesContainer.** Its current grid JSX is:
```js
    {(scriptures.length > 1) && <div className="scripturePanel">
      {scriptures.map((scripture, i) =>
      <div key={i} className={"scriptureItem" + (activeRef === i ? " active" : "")} onClick={() => setActiveRef(i)}>{scripture}</div>)}
    </div>}
```
Replace with:
```js
    {scriptures.length > 1 && (
      <ScriptureRefGrid
        items={scriptures}
        activeIndex={activeRef}
        onSelect={setActiveRef}
      />
    )}
```
Import in Utils.js: `import { ScriptureRefGrid } from "../views/_Common/ScriptureRefGrid";`
(Key parity: old keys were bare `i`; the grid uses `ref + "_" + i` — stable-or-better, same list semantics.)

- [ ] **Step 7: Suite green + smoke:** (a) open a verse's related-scriptures panel — grid renders, arrow keys still cycle, click selects, passage shows; (b) view a chat message with 2+ scripture refs — the small grid above the passage still renders and selects.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(common): shared ScriptureRefGrid for Narration ScripturePanel and Utils ScripturesContainer"
```

---

## Self-review notes
- Task 1 must precede 2 and 3; Task 4 is independent of 1–3.
- ParseMessage's `getClassName`/`onClick` closures re-created each render capture current `activeRef`/`scriptures` — same freshness as the old inline `options` object (also per-render). No memoization regression.
- WP-B1 (bubble merge) deliberately excluded — see the spec's recommendation.
