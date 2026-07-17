# Bible Cross-Reference UX Pass 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix every confirmed defect and design flaw from `docs/audits/2026-07-17-bible-crossref-ux-audit.md` — broken hover dimming, invisible mobile bars, ResizeObserver loop, rail scroll, ref truncation — and re-ground the overview as a true Sankey with a validated light/dark palette, URL-carried state, and an honest navigation model.

**Architecture:** All work is in `frontend/webapp/src/views/Analysis/Bible/` (React 17, plain CSS, jest + React Testing Library in `__tests__/`). No backend changes. The URL codec (`urlState.js`) grows query-param support (`?hl=`, `?from=`, `?view=`, `?expand=`) so every piece of view state survives refresh/share; `ribbonLayout.js` gains a spine-minimum floor and reference-count weighting (true Sankey — user-approved 2026-07-17); colors are the validated pairs below.

**Tech Stack:** React 17, react-router v5 (`useHistory`/`useRouteMatch`), CRA jest (`react-scripts test`), Playwright (python, host-installed) for visual verification against the dev server.

**Decisions already made (do not relitigate):**
- **True Sankey** spine weighting (user picked option A over verse-weighted spines).
- **Palette** (validated with the dataviz six-checks script on 2026-07-17; all PASS):
  - Light (surface `#f0f0f0`): quote `#0f7a4d`, phrase `#5cb98a` (phrase has a 2.1:1 contrast WARN — legal because direct labels + the table twin remain).
  - Dark (surface `#1a1a1a`): quote `#0c7550`, phrase `#57a75f`. Quote stays the darker tone in **both** modes (today dark mode inverts semantics — that inversion is removed).
- **Out of scope:** the verse-heading misassignment (backend data issue — Alma 47:4 shows Alma 34's heading; file separately), reader verse grouping, custom floating tooltips.

**Verification environment:** the CRA dev server runs on the dev host at `http://10.0.0.10:8201` (**not** `:8200` — that's the Next.js migration now). Frontend edits hot-reload. Playwright for python is installed on this Mac (`python3 -c "import playwright"` works). jsdom tests run from `frontend/webapp` with:

```bash
CI=true npm test -- --testPathPattern="views/Analysis/Bible" --watchAll=false
```

---

## Task 0: Branch

**Step 1:** From clean `dev`:

```bash
cd /Users/kckern/Documents/GitHub/BookofMormonOnline
git checkout dev && git pull && git checkout -b feature/bible-crossref-ux-pass2
```

**Step 2:** Run the existing suite to establish a green baseline:

```bash
cd frontend/webapp && CI=true npm test -- --testPathPattern="views/Analysis/Bible" --watchAll=false
```

Expected: all suites pass. If not, STOP and report — the plan assumes a green start.

---

## Task 1: Fix ribbon hover dimming (CSS animation conflict)

The fade-in animation sits on `.xref-ribbon path` with `animation-fill-mode: both`, which pins `opacity: 1` on the paths forever and overrides `.xref-ribbon.dim path { opacity: 0.15 }` (audit §2.1). Move the animation to the `<g>` group; the dim rule targets the paths, so they stop fighting.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/crossref.css:209-214`

**Step 1: Make the change**

Replace:

```css
@media (prefers-reduced-motion: no-preference) {
  .xref-ribbon path {
    animation: xref-fadein 250ms both;
    animation-delay: calc(var(--i, 0) * 4ms);
  }
}
```

with:

```css
@media (prefers-reduced-motion: no-preference) {
  /* animate the group, never the paths — a fill-mode:both animation on the
     paths pins their opacity and defeats the .dim rule below */
  .xref-ribbon {
    animation: xref-fadein 250ms both;
    animation-delay: calc(var(--i, 0) * 4ms);
  }
}
```

**Step 2: Verify live** (CSS is untestable in jsdom; this is the audit's own probe):

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://10.0.0.10:8201/analysis/bible", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector('[data-book="Moroni"]', timeout=60000); pg.wait_for_timeout(1500)
    pg.locator('[data-book="Moroni"]').hover(); pg.wait_for_timeout(400)
    print(pg.evaluate("""() => {
      const g = [...document.querySelectorAll('.xref-ribbon.dim path')][0];
      return g ? getComputedStyle(g).opacity : 'no dim ribbon found';
    }"""))
    b.close()
EOF
```

Expected output: `0.15` (audit measured `1` before the fix).

**Step 3: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Bible/crossref.css
git commit -m "fix(analysis/bible): ribbon hover dimming — animate the group, not the paths"
```

---

## Task 2: Mobile anchor view — restore the partner bars

`.xref-anchorbody { align-items: flex-start }` shrinks children to content width once the ≤700px media query flips it to `column`, collapsing `.xref-detail` to 199px and the bar track to 2px (audit §2.2).

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/crossref.css` (the `@media (max-width: 700px)` block, ~line 563)

**Step 1:** Inside the existing `@media (max-width: 700px)` block, extend the `.xref-anchorbody` rule and add `.xref-detail`:

```css
  .xref-anchorbody {
    flex-direction: column;
    gap: 1rem;
    /* column direction makes align-items:flex-start a width constraint */
    align-items: stretch;
  }
  .xref-detail {
    width: 100%;
  }
```

**Step 2: Verify live**

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto("http://10.0.0.10:8201/analysis/bible/bom/2-nephi", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector('.xref-bar', timeout=60000); pg.wait_for_timeout(800)
    print(pg.evaluate("""() => {
      const w = s => Math.round(document.querySelector(s).getBoundingClientRect().width);
      return {detail: w('.xref-detail'), track: w('.xref-bar-track'), quote: w('.xref-bar-quote')};
    }"""))
    b.close()
EOF
```

Expected: `detail` ≥ 340, `track` ≥ 100, `quote` > 0 (audit measured 199 / 2 / 0).

**Step 3: Commit** — `fix(analysis/bible): mobile anchor detail stretches full width; bars visible again`

---

## Task 3: Rail scrolls the anchored book into view

Anchoring Isaiah leaves the 66-book rail at Genesis (`offsetTop` 1091 in a 680px scrollbox — audit §2.4). Scroll the rail container itself (not `scrollIntoView`, which would also yank page ancestors on mobile).

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Rail.jsx`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/rail.test.js`

**Step 1: Write the failing test** — append to `rail.test.js` inside the `describe`:

```js
  test("centers the anchored book inside the rail on mount", () => {
    // jsdom has zero geometry; fake a 100px-tall rail with the anchor at 500px
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
    Object.defineProperty(HTMLElement.prototype, "offsetTop", {
      configurable: true,
      get() {
        return this.classList?.contains("anchored") ? 500 : 0;
      },
    });
    render(
      <Rail canon="kjv" book="Isaiah" onAnchor={jest.fn()} onChapter={jest.fn()} />
    );
    expect(screen.getByRole("navigation").scrollTop).toBeGreaterThan(0);
    delete HTMLElement.prototype.offsetTop;
    jest.restoreAllMocks();
  });
```

**Step 2: Run it** — `CI=true npm test -- --testPathPattern="rail.test" --watchAll=false`
Expected: FAIL (`scrollTop` is 0).

**Step 3: Implement** — in `Rail.jsx`:

```jsx
import React, { useEffect, useRef } from "react";
```

Inside the component, before `return`:

```jsx
  const railRef = useRef(null);
  const anchorRef = useRef(null);
  useEffect(() => {
    const rail = railRef.current;
    const el = anchorRef.current;
    if (!rail || !el) return;
    rail.scrollTop = Math.max(
      0,
      el.offsetTop - rail.clientHeight / 2 + el.clientHeight / 2
    );
  }, [book]);
```

Wire the refs: `<nav ref={railRef} className="xref-rail" …>` and on the book button `<button ref={isAnchor ? anchorRef : undefined} …>`.

**Step 4: Run the tests** — same command. Expected: PASS (all Rail tests).

**Step 5: Verify live** (Isaiah anchored → rail no longer at top):

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://10.0.0.10:8201/analysis/bible/kjv/isaiah", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector('.xref-rail-book.anchored', timeout=60000); pg.wait_for_timeout(600)
    print(pg.evaluate("() => document.querySelector('.xref-rail').scrollTop"))
    b.close()
EOF
```

Expected: a number in the ~600–900 range, not `0`.

**Step 6: Commit** — `fix(analysis/bible): rail centers the anchored book on mount`

---

## Task 4: Stop the ResizeObserver feedback loop

The Overview measure loop re-fires itself (audit §2.3): rAF-coalesce the observer callback and bail out of `setSize` when nothing changed.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Overview.jsx:22-38`

**Step 1: Replace the effect** with:

```jsx
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let frame = null;
    const measure = () => {
      frame = null;
      // bail when unchanged — the observer re-fires when the svg resizes the
      // wrapper, and echoing identical state back re-triggered it forever
      setSize((prev) => {
        const width = el.clientWidth || 960;
        const height = Math.max(el.clientHeight || 0, FALLBACK_H);
        return prev.width === width && prev.height === height
          ? prev
          : { width, height };
      });
    };
    const schedule = () => {
      if (frame == null) frame = requestAnimationFrame(measure);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(schedule);
      ro.observe(el);
      return () => {
        ro.disconnect();
        if (frame != null) cancelAnimationFrame(frame);
      };
    }
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, []);
```

**Step 2: Run the Overview jsdom suite** (guards against regressions in render):
`CI=true npm test -- --testPathPattern="overview.test" --watchAll=false` → PASS.

**Step 3: Verify live** — mobile page loads with **zero** page errors:

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://10.0.0.10:8201/analysis/bible", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(4000)
    print("pageerrors:", errs or "NONE")
    b.close()
EOF
```

Expected: `pageerrors: NONE` (audit saw a stream of ResizeObserver errors + the CRA overlay).

**Step 4: Commit** — `fix(analysis/bible): rAF-coalesce overview resize measure; kill ResizeObserver loop`

---

## Task 5: Mobile reader — refs never truncate, text unjustifies

"Alma 34:11" renders as "Alma 3" on a phone, and justified text in ~150px columns is rivers (audit §2.5).

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/crossref.css`

**Step 1:** In the base `.verseViewerTable td.scriptureRef .ref` rule (~line 510), add `flex-shrink: 0;` and remove `overflow: hidden;` (the heading is the truncatable element, and it already truncates):

```css
.verseViewerTable td.scriptureRef .ref {
  font-weight: bold;
  font-size: 1rem;
  flex-grow: 0;
  flex-shrink: 0;
  line-height: 1.5rem;
  white-space: nowrap;
  padding-right: 1ex;
  color: var(--text-primary, #212529);
}
```

**Step 2:** In the `@media (max-width: 700px)` block, add:

```css
  /* the ref is the row's identity — give it the space; drop the heading */
  .verseViewerTable td.scriptureRef .heading { display: none; }
  /* justified text in ~150px columns is all rivers */
  .verseViewerTable .scriptureCell p { text-align: left; }
```

**Step 3: Verify live**

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto("http://10.0.0.10:8201/analysis/bible/bom/alma~2-samuel", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector('.scriptureRef .ref', timeout=60000); pg.wait_for_timeout(2000)
    print(pg.evaluate("""() => [...document.querySelectorAll('.scriptureRef .ref')].slice(0,2)
      .map(el => ({t: el.textContent, clipped: el.scrollWidth > el.clientWidth}))"""))
    b.close()
EOF
```

Expected: both entries `clipped: false` with full text `Alma 34:11` / `2 Samuel 14:7`.

**Step 4: Commit** — `fix(analysis/bible): mobile reader keeps full verse refs, unjustifies narrow columns`

---

## Task 6: Validated palette, both modes; retire the red highlight

Swap in the validated quote/phrase pairs (header of this plan), stop inverting quote/phrase semantics in dark mode, and restyle the reader's shared-phrase highlight from alien red-on-yellow to the system's green (audit §3.2, §6).

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/crossref.css:5-41, 546-554`

**Step 1:** Update the tokens (chapter-cell ramp values stay exactly as they are, including the dark-mode reversal — that part works):

```css
.xref-root {
  --xref-quote: #0f7a4d;
  --xref-phrase: #5cb98a;
  /* ramp unchanged … */
```

```css
html[data-theme="dark"] .xref-root {
  /* quote stays the darker, denser tone in BOTH modes — same semantics,
     re-stepped for the #1a1a1a surface (validated 2026-07-17) */
  --xref-quote: #0c7550;
  --xref-phrase: #57a75f;
  /* ramp lines unchanged … */
```

(Only replace the two `--xref-quote`/`--xref-phrase` lines in each block; leave every `--xref-ramp-*` line alone.)

**Step 2:** Replace the highlight rules (~line 546):

```css
.verseViewerTable .scriptureCell p span.highlight {
  background-color: rgba(92, 185, 138, 0.3);
  box-shadow: inset 0 -2px 0 var(--xref-quote);
}

html[data-theme="dark"] .verseViewerTable .scriptureCell p span.highlight {
  background-color: rgba(87, 167, 95, 0.35);
}
```

(The old rules set `color:` — deleting that keeps text ink in text tokens, per dataviz rules.)

**Step 3: Verify live** — dark-mode ribbons must be visible now:

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://10.0.0.10:8201/analysis/bible", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector('.xref-ribbon', timeout=60000)
    pg.evaluate("document.documentElement.setAttribute('data-theme','dark')")
    pg.wait_for_timeout(500)
    pg.screenshot(path="/tmp/xref-dark-check.png")
    print(pg.evaluate("""() => getComputedStyle(document.querySelector('.xref-ribbonphrase')).fill"""))
    b.close()
EOF
```

Expected: `rgb(87, 167, 95)`. **Look at `/tmp/xref-dark-check.png`** — ribbons should read clearly against the dark surface (audit shot `10-overview-dark.png` is the "before": murk).

**Step 4: Commit** — `feat(analysis/bible): validated light/dark chart palette; green shared-phrase highlight`

---

## Task 7: True Sankey — spine floor in the layout engine

Geometry first, component second (next task). `layoutSpine` gains a minimum-height floor (same shrink-the-largest algorithm `slot()` already uses) so every book stays visible and labelable once weights become reference counts.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/ribbonLayout.js`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/ribbonLayout.test.js`

**Step 1: Write the failing tests** — append to the existing describe (match its import style):

```js
  test("layoutSpine floors tiny items at minPx and still fits the height", () => {
    const items = [
      { key: "big", weight: 990 },
      { key: "tiny", weight: 10 },
    ];
    const spine = layoutSpine(items, 500, 0, 20);
    const tiny = spine.get("tiny");
    const big = spine.get("big");
    expect(tiny.y1 - tiny.y0).toBeGreaterThanOrEqual(20);
    expect(big.y1).toBeLessThanOrEqual(500 + 0.001);
  });

  test("layoutRibbons passes spineMinPx through to both spines", () => {
    const left = [{ key: "L1", weight: 999 }, { key: "L2", weight: 1 }];
    const right = [{ key: "R1", weight: 1000 }];
    const links = [
      { left: "L1", right: "R1", value: 999 },
      { left: "L2", right: "R1", value: 1 },
    ];
    const { leftSpine } = layoutRibbons({ left, right, links, height: 400, spineMinPx: 14 });
    const l2 = leftSpine.get("L2");
    expect(l2.y1 - l2.y0).toBeGreaterThanOrEqual(14);
  });
```

**Step 2: Run** — `CI=true npm test -- --testPathPattern="ribbonLayout.test" --watchAll=false` → FAIL (floor not applied).

**Step 3: Implement** — replace `layoutSpine` and thread the option:

```js
export const layoutSpine = (items, height, gap = 2, minPx = 0) => {
  const totalWeight = items.reduce((a, i) => a + i.weight, 0) || 1;
  const usable = height - gap * (items.length - 1);
  const raw = items.map((i) => (i.weight / totalWeight) * usable);
  const scaled = raw.map((h) => Math.max(h, minPx));
  const overflow = scaled.reduce((a, b) => a + b, 0) - usable;
  // if the floor pushed us over the height, shrink the largest items to fit
  if (overflow > 0) {
    const shrinkable = scaled.map((h) => h - minPx);
    const shrinkTotal = shrinkable.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < scaled.length; i++)
      scaled[i] -= (shrinkable[i] / shrinkTotal) * overflow;
  }
  const out = new Map();
  let y = 0;
  items.forEach((item, i) => {
    out.set(item.key, { y0: y, y1: y + scaled[i] });
    y += scaled[i] + gap;
  });
  return out;
};
```

And in `layoutRibbons`, change the signature line and the two spine calls:

```js
export const layoutRibbons = ({ left, right, links, height, gap = 2, minPx = 1.5, spineMinPx = 0 }) => {
  const leftSpine = layoutSpine(left, height, gap, spineMinPx);
  const rightSpine = layoutSpine(right, height, gap, spineMinPx);
```

**Step 4: Run** — same command → PASS (including the pre-existing tests).

**Step 5: Commit** — `feat(analysis/bible): spine minimum-height floor in ribbon layout`

---

## Task 8: True Sankey — weight spines by reference count

Spine heights become "how many references," matching ribbon thickness everywhere (audit §3.1; user-approved). Zero-reference books/divisions drop off the spine (they carry no ribbons). The `> 9` label guard stays but now always passes thanks to the 14px floor — every book gets a label (fixes audit §3.3's anonymous slivers).

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Overview.jsx`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/overview.test.js`

**Step 1: Write the failing test** — append (adapt render/mocks to the file's existing setup — it already renders `Overview`):

```js
  test("every spine segment on screen has a visible label (true-Sankey floor)", () => {
    render(<Overview navigate={jest.fn()} />);
    // small books used to be unlabeled slivers; with ref-count weights + floor
    // every BoM book with references gets a text label
    expect(screen.getByText("Moroni")).toBeInTheDocument();
    expect(screen.getByText("Ether")).toBeInTheDocument();
    expect(screen.getByText("Omni")).toBeInTheDocument();
  });
```

(If Omni genuinely has zero references in the corpus, assert its **absence** instead — the point is: present ⇒ labeled, zero ⇒ dropped. Check with `bookTotal("bom","Omni")` in the test via an import if needed.)

**Step 2: Run** — `CI=true npm test -- --testPathPattern="overview.test" --watchAll=false` → FAIL (small books unlabeled today).

**Step 3: Implement** in `Overview.jsx`:

a. Left spine — inside the `useMemo`, replace the weight lines:

```jsx
    for (const group of canons.kjv.groups) {
      if (group.name === expanded) {
        for (const b of group.books) {
          const weight = bookTotal("kjv", b.name);
          if (!weight) continue; // zero-ref books carry no ribbons
          left.push({ key: b.name, weight, kind: "book", group: group.name });
          leftBookSet.add(b.name);
        }
      } else {
        const weight = group.books.reduce(
          (a, b) => a + bookTotal("kjv", b.name),
          0
        );
        if (!weight) continue;
        left.push({ key: group.name, weight, kind: "division" });
      }
    }
```

b. Right spine:

```jsx
  const right = useMemo(
    () =>
      canons.bom.books
        .map((b) => ({ key: b.name, weight: bookTotal("bom", b.name) }))
        .filter((b) => b.weight > 0),
    []
  );
```

c. `rightSegments` must iterate `right`, not `canons.bom.books`:

```jsx
  const rightSegments = right.map(({ key: name }) => {
    const pos = rightSpine.get(name);
```

(and rename the loop variable uses inside from `b.name` to `name`).

d. Pass the floor to the layout:

```jsx
    () => layoutRibbons({ left, right, links, height: plotH, gap: 3, minPx: 1.5, spineMinPx: 14 }),
```

**Step 4: Run tests** → PASS.

**Step 5: Verify live + look at it** (dataviz procedure step 7):

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://10.0.0.10:8201/analysis/bible", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector('.xref-ribbon', timeout=60000); pg.wait_for_timeout(1500)
    pg.screenshot(path="/tmp/xref-sankey-check.png")
    # Major Prophets (722 refs) must now be taller than Historical (few refs)
    print(pg.evaluate("""() => {
      const h = sel => { const r = document.querySelector(sel); const b = r.getBBox(); return Math.round(b.height); };
      return {majorProphets: h('[data-division="Major Prophets"]'), historical: h('[data-division="Historical"]')};
    }"""))
    b.close()
EOF
```

Expected: `majorProphets` **greater than** `historical` (before: Historical ~3× taller). Open `/tmp/xref-sankey-check.png` and eyeball: the 2 Nephi–Isaiah bundle should now be the fattest mark on the canvas; every visible spine segment labeled; no overlapping labels.

**Step 6: Commit** — `feat(analysis/bible): true-Sankey overview — spines weighted by reference count`

---

## Task 9: Hover readout line (tooltip that works, labels small things)

Native `<title>` is the only magnitude readout and it's delayed/hover-only (audit §3.1, §3.4). Add a fixed one-line readout under the hint that mirrors the active node/ribbon — cheap, no floating positioning, works for keyboard focus too.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Overview.jsx`, `crossref.css`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/overview.test.js`

**Step 1: Write the failing test:**

```js
  test("hovering a spine segment fills the readout line", () => {
    render(<Overview navigate={jest.fn()} />);
    const readout = screen.getByTestId("xref-readout");
    expect(readout).toHaveTextContent(/hover/i);
    fireEvent.mouseEnter(screen.getAllByRole("button", { name: /2 Nephi,/ })[0]);
    expect(readout).toHaveTextContent(/2 Nephi · \d+ references/);
  });
```

**Step 2: Run** → FAIL (no readout element).

**Step 3: Implement** — in `Overview.jsx`, derive the text from the existing `active` state:

```jsx
  const readout = useMemo(() => {
    if (!active) return null;
    if (active.type === "node") {
      const total = links
        .filter((l) => l.left === active.key || l.right === active.key)
        .reduce((a, l) => a + l.value, 0);
      return `${active.key} · ${total} references`;
    }
    const [rightKey, leftKey] = active.key.split("|");
    const link = links.find((l) => l.left === leftKey && l.right === rightKey);
    return link
      ? `${link.left} ↔ ${link.right} · ${link.value} references · ${link.quotes} quotes`
      : null;
  }, [active, links]);
```

Render it directly under the `.xref-hint` paragraph:

```jsx
          <p className="xref-readout" data-testid="xref-readout" aria-live="polite">
            {readout || "Hover a ribbon or book for details"}
          </p>
```

CSS:

```css
.xref-readout {
  margin: 0 0 0.25rem;
  min-height: 1.3em; /* fixed slot — no layout jump when it fills */
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary, #444);
}
```

**Step 4: Run tests** → PASS. **Step 5: Commit** — `feat(analysis/bible): live readout line for hovered/focused spine + ribbon`

---

## Task 10: URL codec — query params for highlight, origin, mode, expanded

Foundation for the three tasks after it. `?hl=` (anchor highlight), `?from=kjv` (reader origin), `?view=table` and `?expand=<division>` (overview state). The route param keeps its exact current shapes — query params are additive, so every legacy URL still parses.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/urlState.js`, `index.jsx`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/urlState.test.js`

**Step 1: Write the failing tests** — append:

```js
  test.each([
    ["bible/bom/2-nephi", "?hl=isaiah",
      { view: "anchor", canon: "bom", book: "2 Nephi", highlight: "Isaiah" }],
    ["bible/bom/2-nephi", "?hl=major-prophets",
      { view: "anchor", canon: "bom", book: "2 Nephi", highlight: "Major Prophets" }],
    ["bible/bom/2-nephi~isaiah", "?from=kjv",
      { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", anchorCanon: "kjv" }],
    ["bible", "?view=table", { view: "overview", mode: "table" }],
    ["bible", "?expand=major-prophets", { view: "overview", expanded: "Major Prophets" }],
    ["bible/bom/2-nephi", "?hl=garbage", { view: "anchor", canon: "bom", book: "2 Nephi" }],
  ])("parses %s with %s", (value, search, expected) => {
    expect(parseValue(value, search)).toEqual(expected);
  });

  test("query states round-trip through serialize", () => {
    const states = [
      { view: "anchor", canon: "bom", book: "2 Nephi", highlight: "Isaiah" },
      { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", anchorCanon: "kjv" },
      { view: "overview", mode: "table" },
      { view: "overview", expanded: "Major Prophets" },
    ];
    for (const s of states) {
      const url = serialize(s);
      const [path, search = ""] = url.split("?");
      expect(parseValue(path.replace(/^\/analysis\//, ""), search ? `?${search}` : "")).toEqual(s);
    }
  });
```

**Step 2: Run** — `CI=true npm test -- --testPathPattern="urlState.test" --watchAll=false` → FAIL.

**Step 3: Implement** — rewrite `urlState.js` (full file):

```js
// URL codec for the cross-reference view. The URL is the single source of
// truth: components never hold navigation state, they parse it from here.
//
// Path shapes (unchanged; legacy URLs all still parse):
//   /analysis/bible                          overview
//   /analysis/bible/bom/2-nephi[/12]         anchored (canon, book, chapter?)
//   /analysis/bible/kjv/isaiah               anchored on the Bible side
//   /analysis/bible/bom/2-nephi[/12]~isaiah  reader (always serialized BoM-first)
// Query params (all optional, all additive):
//   ?hl=<book-or-division-slug>   anchor: emphasized partner
//   ?from=kjv                     reader: which canon anchored it (back target)
//   ?view=table                   overview: table twin instead of the chart
//   ?expand=<division-slug>       overview: expanded Bible division
// Anything unresolvable degrades to the overview, never to a broken screen.

import { canons, bookBySlug, slugify } from "./canon";

const divisionBySlug = (slug) =>
  canons.kjv.groups.find((g) => g.slug === slugify(slug));

// value is useRouteMatch().params.value; search is location.search ("?a=b")
export const parseValue = (value, search = "") => {
  const params = new URLSearchParams(search || "");
  const overview = () => {
    const state = { view: "overview" };
    if (params.get("view") === "table") state.mode = "table";
    const expand = params.get("expand");
    const group = expand && divisionBySlug(expand);
    if (group) state.expanded = group.name;
    return state;
  };

  if (!value) return overview();
  const rest = value.replace(/^bible\/?/, "").replace(/\/+$/, "");
  if (!rest) return overview();

  const [left, right] = rest.split("~");
  const seg = left.split("/").filter(Boolean);

  if (right !== undefined) {
    const bible = bookBySlug("kjv", right);
    if (!bible) return overview();
    const finish = (state) => {
      if (params.get("from") === "kjv") state.anchorCanon = "kjv";
      return state;
    };
    if (seg[0] === "bom") {
      const bom = bookBySlug("bom", seg[1]);
      if (!bom) return overview();
      const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
      const state = { view: "reader", bomBook: bom.name, bibleBook: bible.name };
      if (chapter >= 1 && chapter <= bom.chapters) state.bomChapter = chapter;
      return finish(state);
    }
    // legacy: "<bom-book>~<bible-book>"
    const bom = bookBySlug("bom", seg[0]);
    if (seg.length === 1 && bom)
      return finish({ view: "reader", bomBook: bom.name, bibleBook: bible.name });
    return overview();
  }

  if (seg[0] === "bom" || seg[0] === "kjv") {
    const book = bookBySlug(seg[0], seg[1]);
    if (!book) return overview();
    const state = { view: "anchor", canon: seg[0], book: book.name };
    const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
    if (chapter >= 1 && chapter <= book.chapters) state.chapter = chapter;
    const hl = params.get("hl");
    if (hl) {
      const partnerCanon = seg[0] === "bom" ? "kjv" : "bom";
      const partner = bookBySlug(partnerCanon, hl);
      const group = seg[0] === "bom" ? divisionBySlug(hl) : null;
      if (partner) state.highlight = partner.name;
      else if (group) state.highlight = group.name;
    }
    return state;
  }
  return overview();
};

export const serialize = (state) => {
  const base = "/analysis/bible";
  if (!state || state.view === "overview" || !["anchor", "reader"].includes(state.view)) {
    const q = new URLSearchParams();
    if (state?.mode === "table") q.set("view", "table");
    if (state?.expanded) q.set("expand", slugify(state.expanded));
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  }
  if (state.view === "anchor") {
    const path = `${base}/${state.canon}/${slugify(state.book)}${
      state.chapter ? `/${state.chapter}` : ""
    }`;
    return state.highlight ? `${path}?hl=${slugify(state.highlight)}` : path;
  }
  const path = `${base}/bom/${slugify(state.bomBook)}${
    state.bomChapter ? `/${state.bomChapter}` : ""
  }~${slugify(state.bibleBook)}`;
  return state.anchorCanon === "kjv" ? `${path}?from=kjv` : path;
};
```

**Step 4:** Update `index.jsx` — highlight now lives in the URL, so the `location.state` plumbing goes away:

```jsx
export default function BibleCrossRef() {
  const { params: { value } } = useRouteMatch();
  const history = useHistory();
  const location = useLocation();
  const state = parseValue(value, location.search);
  const navigate = (next) => history.push(serialize(next));
```

(Delete the `if (state.view === "anchor" && location.state?.highlight)` block and the second argument to `history.push`. Keep everything else, including the title effect — but add `location.search` to its dependency array comment line: change `}, [value]);` to `}, [value, location.search]);`.)

**Step 5: Run** the urlState + controller suites:
`CI=true npm test -- --testPathPattern="urlState.test|controller.test" --watchAll=false` → PASS. If `controller.test.js` asserted the old `history.push(path, stateObject)` two-arg call, update those assertions to expect the `?hl=` URL instead.

**Step 6: Commit** — `feat(analysis/bible): URL query params carry highlight, reader origin, overview mode/expand`

---

## Task 11: Overview adopts URL state; collapse button stops jumping the layout

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Overview.jsx`, `index.jsx`, `crossref.css`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/overview.test.js`

**Step 1: Write the failing test:**

```js
  test("mode and expansion round-trip through navigate, not local state", () => {
    const navigate = jest.fn();
    render(<Overview state={{ view: "overview" }} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /view as table/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "overview", mode: "table", expanded: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Major Prophets,.*expand/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "overview", mode: undefined, expanded: "Major Prophets" });
  });
```

**Step 2: Run** → FAIL (Overview takes no `state` prop).

**Step 3: Implement:**

a. `index.jsx`: `<Overview state={state} navigate={navigate} />`.

b. `Overview.jsx` — replace the two `useState` lines for `mode`/`expanded` with derived values + navigate-through setters (keep `active` and `size` as local state):

```jsx
export default function Overview({ state = {}, navigate }) {
  const mode = state.mode === "table" ? "table" : "chart";
  const expanded = state.expanded || null;
  const setMode = (m) =>
    navigate({ view: "overview", mode: m === "table" ? "table" : undefined, expanded: expanded || undefined });
  const setExpanded = (name) =>
    navigate({ view: "overview", mode: mode === "table" ? "table" : undefined, expanded: name || undefined });
```

(The existing `setExpanded(expanded === item.key ? null : item.key)` and `setMode(...)` call sites keep working unchanged.)

c. Move the collapse button out of the hint (audit §3.4 layout jump): delete the `{expanded && (<button …collapse…)}` block from `.xref-hint`, and add it to the header next to the mode toggle:

```jsx
          <button
            className="xref-modetoggle"
            aria-pressed={mode === "table"}
            onClick={() => setMode(mode === "chart" ? "table" : "chart")}
          >
            {mode === "chart" ? "View as table" : "View as chart"}
          </button>
          {expanded && mode === "chart" && (
            <button className="xref-modetoggle" onClick={() => setExpanded(null)}>
              ◂ collapse {expanded}
            </button>
          )}
```

**Step 4: Run** the overview suite → PASS. **Step 5: Commit** — `refactor(analysis/bible): overview mode/expand live in the URL; stable hint row`

---

## Task 12: Ribbon clicks keep both halves; highlight survives refresh

Division-level ribbon clicks currently discard the Bible half (audit §4.2). Send the division (or book) as `highlight` — now URL-carried — and teach PartnerBars to match a division by group membership.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Overview.jsx` (ribbon `target`), `PartnerBars.jsx`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/partnerBars.test.js`

**Step 1: Write the failing test** — append (match the file's existing render helper):

```js
  test("a division highlight marks every partner book in that division", () => {
    render(
      <PartnerBars canon="bom" book="2 Nephi" highlight="Major Prophets" onSelect={jest.fn()} />
    );
    const isaiah = screen.getByRole("button", { name: /^Isaiah,/ });
    expect(isaiah.className).toMatch(/highlighted/);
    const matthew = screen.getByRole("button", { name: /^Matthew,/ });
    expect(matthew.className).not.toMatch(/highlighted/);
  });
```

**Step 2: Run** → FAIL.

**Step 3: Implement:**

a. `Overview.jsx` — the ribbon `target` always carries the left key:

```jsx
                const target = {
                  view: "anchor",
                  canon: "bom",
                  book: r.right,
                  highlight: r.left, // book OR division — both resolve via ?hl=
                };
```

b. `PartnerBars.jsx` — highlight matches name or group:

```jsx
          className={`xref-bar ${
            highlight === partner.name || highlight === partner.group ? "highlighted" : ""
          }`}
```

(`partner` here is the canon book object — it already has `.group` from `canon.js`.)

**Step 4: Run** → PASS.

**Step 5: Verify live:** open `http://10.0.0.10:8201/analysis/bible`, click the Torah→Mosiah ribbon; the Mosiah anchor should load with the URL ending `?hl=torah` and Genesis/Exodus/Deuteronomy bars tinted. Reload the page — the emphasis must survive (it was `location.state`-ephemeral before).

**Step 6: Commit** — `feat(analysis/bible): ribbon clicks carry their division/book as a persistent highlight`

---

## Task 13: Reader remembers its origin; Esc stops being a grenade

Back/Esc/breadcrumb always land on the BoM anchor today, inventing history when you came from the Bible side (audit §4.1); Esc fires even from inside inputs (§4.3).

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Reader.jsx`, `AnchorView.jsx`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/reader.test.js`

**Step 1: Write the failing tests** — append (match the file's mock setup for `BoMOnlineAPI`):

```js
  test("breadcrumb back target honors a kjv origin", () => {
    const navigate = jest.fn();
    render(
      <Reader
        state={{ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", anchorCanon: "kjv" }}
        navigate={navigate}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Isaiah" }));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "kjv", book: "Isaiah" });
  });

  test("Escape inside an input does not navigate", () => {
    const navigate = jest.fn();
    render(
      <>
        <input data-testid="searchbox" />
        <Reader state={{ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" }} navigate={navigate} />
      </>
    );
    fireEvent.keyDown(screen.getByTestId("searchbox"), { key: "Escape" });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "anchor", canon: "bom", book: "2 Nephi" })
    );
  });
```

**Step 2: Run** — `CI=true npm test -- --testPathPattern="reader.test" --watchAll=false` → FAIL.

**Step 3: Implement** in `Reader.jsx`:

a. Derive origin + back state (replaces the current `backState` const):

```jsx
  const anchorCanon = state.anchorCanon === "kjv" ? "kjv" : "bom";
  const backState =
    anchorCanon === "kjv"
      ? { view: "anchor", canon: "kjv", book: bibleBook }
      : {
          view: "anchor",
          canon: "bom",
          book: bomBook,
          ...(bomChapter ? { chapter: bomChapter } : {}),
        };
```

b. Guarded Esc (replace the keydown effect body):

```jsx
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      navigate(backState);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomBook, bibleBook, bomChapter, anchorCanon]);
```

c. `ReaderHeader` — pass `anchorCanon` through the existing prop spread, and make the crumb honest:

```jsx
function ReaderHeader({ bomBook, bibleBook, bomChapter, anchorCanon, navigate, backState }) {
  const anchorBook = anchorCanon === "kjv" ? bibleBook : bomBook;
  return (
    <header className="xref-header">
      <nav className="xref-breadcrumb" aria-label="Breadcrumb">
        <Link to="/analysis/bible">⌂ Overview</Link>
        <span aria-hidden="true"> › </span>
        <button className="xref-backlink" onClick={() => navigate(backState)}>
          {anchorBook}
          {anchorCanon === "bom" && bomChapter ? ` › ch. ${bomChapter}` : ""}
        </button>
        <span aria-hidden="true"> › </span>
        <span aria-current="page">{bomBook} × {bibleBook}</span>
      </nav>
      …
```

Update both `<ReaderHeader {...{ … }} />` call sites to include `anchorCanon`.

d. `AnchorView.jsx` — `openReader` records the origin:

```jsx
  const openReader = (partnerName) => {
    const readerState =
      canon === "bom"
        ? { view: "reader", bomBook: book, bibleBook: partnerName }
        : { view: "reader", bomBook: partnerName, bibleBook: book, anchorCanon: "kjv" };
    if (canon === "bom" && chapter) readerState.bomChapter = chapter;
    navigate(readerState);
  };
```

**Step 4: Run** the reader + anchorView suites → PASS.

**Step 5: Verify live:** `http://10.0.0.10:8201/analysis/bible/kjv/isaiah` → click the 2 Nephi bar → URL ends `?from=kjv` → press Esc → you're back on the **Isaiah** anchor.

**Step 6: Commit** — `fix(analysis/bible): reader back/Esc/breadcrumb honor the originating anchor; Esc guarded`

---

## Task 14: Table twin — sticky header, filter, clickable rows, totals

The 335-row / 11,336px dump becomes a scroll-contained, filterable table whose rows open the reader (audit §3.5).

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/TableTwin.jsx`, `Overview.jsx` (pass `navigate`), `crossref.css`
- Test: Create `frontend/webapp/src/views/Analysis/Bible/__tests__/tableTwin.test.js`

**Step 1: Write the failing tests** (new file):

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import TableTwin from "../TableTwin";

describe("TableTwin", () => {
  test("filter narrows rows by either book name", () => {
    render(<TableTwin navigate={jest.fn()} />);
    const before = screen.getAllByTestId("xref-pairrow").length;
    fireEvent.change(screen.getByRole("searchbox", { name: /filter/i }), {
      target: { value: "isaiah" },
    });
    const after = screen.getAllByTestId("xref-pairrow").length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test("a row link opens the reader for its pair", () => {
    const navigate = jest.fn();
    render(<TableTwin navigate={navigate} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /filter/i }), {
      target: { value: "isaiah" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /open .* × .*/i })[0]);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "reader", bibleBook: "Isaiah" })
    );
  });

  test("active sort column exposes aria-sort", () => {
    render(<TableTwin navigate={jest.fn()} />);
    expect(screen.getByRole("columnheader", { name: /refs/i })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });
});
```

**Step 2: Run** — `CI=true npm test -- --testPathPattern="tableTwin.test" --watchAll=false` → FAIL.

**Step 3: Implement** — rewrite `TableTwin.jsx`:

```jsx
import React, { useMemo, useState } from "react";
import { allPairs, headline } from "./aggregate";

// Sortable, filterable table twin of the ribbon overview — the WCAG-clean
// equivalent. Rows open the same reader the ribbons do.
export default function TableTwin({ navigate }) {
  const [sort, setSort] = useState({ key: "total", dir: -1 });
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const pairs = allPairs().filter(
      (p) =>
        !q ||
        p.bomBookName.toLowerCase().includes(q) ||
        p.bibleBookName.toLowerCase().includes(q)
    );
    pairs.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return cmp * sort.dir;
    });
    return pairs;
  }, [sort, filter]);

  const open = (p) =>
    navigate({ view: "reader", bomBook: p.bomBookName, bibleBook: p.bibleBookName });

  const header = (key, label) => (
    <th aria-sort={sort.key === key ? (sort.dir === -1 ? "descending" : "ascending") : undefined}>
      <button
        className="xref-sort"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
      >
        {label}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === -1 ? " ▼" : " ▲") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="xref-tabletwin-panel">
      <input
        className="xref-tablefilter"
        type="search"
        aria-label="Filter by book"
        placeholder="Filter by book…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="xref-tablewrap">
        <table className="xref-tabletwin">
          <thead>
            <tr>
              {header("bomBookName", "Book of Mormon")}
              {header("bibleBookName", "Bible")}
              {header("total", "Refs")}
              {header("quotes", "Quotes")}
              {header("phrases", "Phrases")}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={`${p.bomBookName}|${p.bibleBookName}`}
                data-testid="xref-pairrow"
                className="xref-pairrow"
                onClick={() => open(p)}
              >
                <td>
                  <button
                    className="xref-rowlink"
                    aria-label={`Open ${p.bomBookName} × ${p.bibleBookName} reader`}
                    onClick={(e) => {
                      e.stopPropagation();
                      open(p);
                    }}
                  >
                    {p.bomBookName}
                  </button>
                </td>
                <td>{p.bibleBookName}</td>
                <td className="num">{p.total}</td>
                <td className="num">{p.quotes}</td>
                <td className="num">{p.phrases}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>All books</td>
              <td className="num">{headline.total}</td>
              <td className="num">{headline.quotes}</td>
              <td className="num">{headline.phrases}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

In `Overview.jsx`: `{mode === "table" ? <TableTwin navigate={navigate} /> : (…)}`.

CSS — replace the existing `.xref-tabletwin` block with:

```css
.xref-tabletwin-panel {
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.xref-tablefilter {
  display: block;
  width: 100%;
  max-width: 280px;
  margin: 0 0 0.5rem;
  padding: 0.3rem 0.6rem;
  font: inherit;
  font-size: 0.9rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 1ex;
  background: var(--surface-1, #f8f8f8);
  color: var(--text-primary, #212529);
}

.xref-tablewrap {
  max-height: calc(100vh - 320px);
  min-height: 300px;
  overflow: auto;
  border: 1px solid var(--border, #ddd);
  border-radius: 0.5ex;
}

.xref-tabletwin {
  width: 100%;
  border-collapse: collapse;
}

.xref-tabletwin thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-1, #f8f8f8);
  box-shadow: 0 1px 0 var(--border, #ddd);
}

.xref-tabletwin th,
.xref-tabletwin td {
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--border, #ddd);
  text-align: left;
}

.xref-tabletwin td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.xref-pairrow {
  cursor: pointer;
}

.xref-pairrow:hover {
  background: var(--surface-2, #f0f0f0);
}

.xref-tabletwin tfoot td {
  font-weight: 700;
  background: var(--surface-1, #f8f8f8);
  border-bottom: none;
}

.xref-rowlink {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--link, #345496);
  cursor: pointer;
}

.xref-rowlink:hover {
  text-decoration: underline;
}
```

**Step 4: Run** the new suite → PASS. **Step 5: Verify live:** toggle "View as table" — header sticks while scrolling inside the panel, page itself no longer scrolls 11k px, typing "moroni" filters, clicking a row opens the reader.

**Step 6: Commit** — `feat(analysis/bible): table twin — sticky header, filter, clickable rows, totals`

---

## Task 15: PartnerBars — real list semantics, stable scale, tidy segments

Fixes: `role="listitem"` on a `<button>` erases its button role (audit §6); chapter-scoped bars rescale to fill (§5); zero-width segments leave orphan radii.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/PartnerBars.jsx`, `crossref.css`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/partnerBars.test.js`

**Step 1: Write the failing tests:**

```js
  test("items are buttons inside listitems, not role-overridden buttons", () => {
    render(<PartnerBars canon="bom" book="2 Nephi" onSelect={jest.fn()} />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].tagName).not.toBe("BUTTON");
    expect(screen.getAllByRole("button", { name: /Isaiah,/ }).length).toBe(1);
  });

  test("chapter scope keeps the unscoped scale (no lone full-width bar)", () => {
    render(<PartnerBars canon="bom" book="2 Nephi" chapter={12} onSelect={jest.fn()} />);
    const track = document.querySelector(".xref-bar-quote, .xref-bar-phrase");
    // ch.12 has ~23 refs vs the unscoped max of ~406 — the widest segment
    // must be nowhere near 100%
    expect(parseFloat(track.style.width)).toBeLessThan(50);
  });
```

**Step 2: Run** → FAIL.

**Step 3: Implement** — rewrite the return in `PartnerBars.jsx`:

```jsx
  const scopeMax = partnersFor(canon, book)[0]?.total || 1; // stable across chapter scoping

  return (
    <div className="xref-bars" role="list">
      {visible.map(({ book: partner, total, quotes, phrases }) => (
        <div role="listitem" key={partner.name}>
          <button
            className={`xref-bar ${
              highlight === partner.name || highlight === partner.group ? "highlighted" : ""
            }`}
            aria-label={`${partner.name}, ${total} references, ${quotes} quotes`}
            onClick={() => onSelect(partner.name)}
          >
            <span className="xref-bar-label">{partner.name}</span>
            <span className="xref-bar-track">
              {quotes > 0 && (
                <span className="xref-bar-quote" style={{ width: `${(quotes / scopeMax) * 100}%` }} />
              )}
              {phrases > 0 && (
                <span className="xref-bar-phrase" style={{ width: `${(phrases / scopeMax) * 100}%` }} />
              )}
            </span>
            <span className="xref-bar-count">{total}</span>
          </button>
        </div>
      ))}
      …
```

(Replace `max` with `scopeMax` in the width math; the `partners`/`visible`/fold logic is unchanged. Note: if Task 12 already landed, keep its group-aware `className`.)

CSS — replace the segment radius rules:

```css
.xref-bar-quote {
  background: var(--xref-quote);
  border-radius: 2px 0 0 2px;
}

.xref-bar-phrase {
  background: var(--xref-phrase);
  border-radius: 0 2px 2px 0;
}

.xref-bar-quote:only-child,
.xref-bar-phrase:only-child {
  border-radius: 2px;
}
```

(The 2px gap between segments stays — that's the dataviz mark spec for stacked fills. The `.xref-bar` inside a listitem wrapper needs `width: 100%` — add it to the `.xref-bar` rule.)

Also widen the lane: `.xref-bars { max-width: 860px; }` (was 640 — audit §5 dead right half).

**Step 4: Run** → PASS (update any existing assertions that queried `role="listitem"` expecting buttons).

**Step 5: Commit** — `fix(analysis/bible): partner bars — list semantics, stable chapter scale, wider lane`

---

## Task 16: AnchorView hierarchy — one scope indicator, honest flip label, sane rail density

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/AnchorView.jsx`, `Rail.jsx`, `crossref.css`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/anchorView.test.js`

**Step 1: Write the failing tests:**

```js
  test("chapter scope appears once — heading owns it, breadcrumb stays clean", () => {
    render(<AnchorView state={{ view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 }} navigate={jest.fn()} />);
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).not.toHaveTextContent(/ch\. 12/);
    expect(screen.getByRole("heading", { name: /2 Nephi 12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear chapter 12/i })).toBeInTheDocument();
  });

  test("flip button names its destination book", () => {
    render(<AnchorView state={{ view: "anchor", canon: "bom", book: "2 Nephi" }} navigate={jest.fn()} />);
    expect(screen.getByRole("button", { name: /isaiah/i })).toBeInTheDocument();
  });

  test("headings say references, not refs", () => {
    render(<AnchorView state={{ view: "anchor", canon: "bom", book: "2 Nephi" }} navigate={jest.fn()} />);
    expect(screen.getByRole("heading", { name: /692 references/ })).toBeInTheDocument();
  });
```

**Step 2: Run** → FAIL.

**Step 3: Implement** in `AnchorView.jsx`:

a. Breadcrumb current crumb: `{book}` only (drop the `ch.` suffix).

b. Flip button:

```jsx
  const flipTarget = highlight || partnersFor(canon, book)[0]?.book.name;
  …
        <button className="xref-flip" onClick={flip}>
          ⇄ view from {flipTarget || partnerLabel}
        </button>
```

c. Heading + legend on one line, "references" spelled out, legend deduped (delete the bottom `.xref-legend` div):

```jsx
        <main className="xref-detail">
          <div className="xref-detailhead">
            <h3 className="xref-detailheading">
              {book}
              {chapter ? ` ${chapter}` : ""} {canon === "bom" ? "draws on" : "appears in"}
              <span className="xref-detailtotal"> {scopeTotal} references</span>
            </h3>
            <span className="xref-legend" aria-hidden="true">
              <span className="xref-swatch quote" /> quote
              <span className="xref-swatch phrase" /> phrase
            </span>
          </div>
          {chapter && (
            <button
              className="xref-scopechip"
              aria-label={`Clear chapter ${chapter} scope`}
              onClick={() => navigate({ view: "anchor", canon, book })}
            >
              ch. {chapter} ✕
            </button>
          )}
          <PartnerBars … />
        </main>
```

CSS:

```css
.xref-detailhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  max-width: 860px;
}
```

d. `Rail.jsx` — sqrt the density so 60 books stop being identical dots:

```jsx
                    style={{ width: `${Math.sqrt(total / max) * 100}%` }}
```

e. Chapter cells get real touch targets — in `crossref.css`:

```css
.xref-chaptercell {
  width: 26px;
  height: 26px;
  …
  font-size: 0.65rem;
```

(keep the rest of the rule as-is).

**Step 4: Run** the anchorView + rail suites → PASS (fix any assertions still expecting "refs" or the breadcrumb chapter).

**Step 5: Commit** — `feat(analysis/bible): anchor view hierarchy — single scope chip, named flip, sqrt rail density`

---

## Task 17: Reader header, counts, and pagination that respects the reader

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/Reader.jsx`, `crossref.css`
- Test: `frontend/webapp/src/views/Analysis/Bible/__tests__/reader.test.js`

**Step 1: Write the failing tests:**

```js
  test("header shows the pair total and quote count", () => {
    render(<Reader state={{ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" }} navigate={jest.fn()} />);
    expect(screen.getByText(/\d+ references · \d+ quotes/)).toBeInTheDocument();
  });

  test("show-all reveals every pair at once", async () => {
    render(<Reader state={{ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" }} navigate={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /show all/i }));
    expect(screen.queryByRole("button", { name: /load|show all/i })).not.toBeInTheDocument();
  });
```

(The suite's existing `BoMOnlineAPI` mock resolves verse fetches — reuse it; `findByRole` handles the loading pass.)

**Step 2: Run** → FAIL.

**Step 3: Implement** in `Reader.jsx`:

a. `const PAGE = 50;` (was 20).

b. Counts in the header — compute in `Reader` and pass down:

```jsx
  const quoteTotal = useMemo(() => pairs.filter((p) => p.isQuote).length, [pairs]);
```

`ReaderHeader` gains `total`/`quoteTotal` props and renders under the title:

```jsx
      <h3 className="xref-readertitle">
        <span className="book">{bomBook}{bomChapter ? ` ${bomChapter}` : ""}</span>
        {" → "}
        <span className="book">{bibleBook}</span>
      </h3>
      <p className="xref-readercount">
        {total} references · {quoteTotal} quotes
      </p>
```

c. Pagination row (replace the lone load-more button):

```jsx
      {remaining > 0 && (
        <div className="xref-loadrow">
          <button className="xref-loadmore" disabled={loading} onClick={() => setPageCount((c) => c + 1)}>
            Load {Math.min(PAGE, remaining)} more
          </button>
          <button
            className="xref-loadmore"
            disabled={loading}
            onClick={() => setPageCount(Math.ceil(sorted.length / PAGE))}
          >
            Show all {sorted.length}
          </button>
        </div>
      )}
```

d. Header stacks instead of shoving the title to the corner — CSS:

```css
.xref-reader .xref-header {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.xref-readercount {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted, #777);
  font-variant-numeric: tabular-nums;
}

.xref-loadrow {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin: 1rem 0 2rem;
}

.xref-loadrow .xref-loadmore {
  margin: 0;
}
```

e. Column sort headers get `aria-sort` (same pattern as Task 14): on each `<th>`:

```jsx
          <tr>
            <th aria-sort={sort.column === "bom" ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
              {sortButton("bom", bomBook)}
            </th>
            <th aria-sort={sort.column === "bible" ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
              {sortButton("bible", bibleBook)}
            </th>
          </tr>
```

and delete `aria-pressed` from `sortButton` (aria-sort on the header is the correct semantic).

**Step 4: Run** the reader suite → PASS (update title assertions: the em-dash arrow title replaced "references to").

**Step 5: Commit** — `feat(analysis/bible): reader header counts, stacked layout, 50-page + show-all`

---

## Task 18: Overview fits the fold on short viewports

1280×700 clips the chart (audit §5); let the plot compress below 640px when the viewport is short.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Bible/crossref.css`, `Overview.jsx`

**Step 1:** `Overview.jsx`: `const FALLBACK_H = 420;` (was 640 — it's only the no-measurement fallback; real height comes from the wrapper).

**Step 2:** CSS:

```css
.xref-ribbonwrap {
  flex: 1;
  min-height: clamp(420px, calc(100vh - 280px), 640px);
}
```

(and in the ≤700px block, the existing `min-height: 420px` line for `.xref-ribbonwrap` can be deleted — the clamp covers it).

**Step 3: Verify live:** at 1280×700, `document.documentElement.scrollHeight` should be ≤ ~710 on `/analysis/bible` (audit measured 823):

```bash
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1280,"height":700})
    pg.goto("http://10.0.0.10:8201/analysis/bible", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector('.xref-ribbon', timeout=60000); pg.wait_for_timeout(1200)
    print(pg.evaluate("() => document.documentElement.scrollHeight"))
    b.close()
EOF
```

**Step 4: Commit** — `fix(analysis/bible): overview compresses to fit short viewports`

---

## Task 19: Full verification sweep + audit closeout

**Step 1:** Full suite:

```bash
cd frontend/webapp && CI=true npm test -- --testPathPattern="views/Analysis/Bible" --watchAll=false
```

Expected: every suite green.

**Step 2:** Re-run the audit's screenshot walk (the script from the audit session; adjust if absent — it's a plain Playwright walk of the three URLs at 1440×900 / 1280×700 / 390×844, light + dark). Save to `docs/audits/bible-analysis-screenshots-2026-07-17-after/`. **Look at every screenshot** — specifically:

- Overview: hover dims; Major Prophets tallest; every segment labeled; no console errors.
- Dark overview: ribbons clearly visible.
- Mobile anchor: bars visible full-width; no error overlay.
- Mobile reader: full refs, left-aligned text.
- Table mode: contained scroll, sticky header.
- Reader from `kjv/isaiah`: `?from=kjv` round-trip.

**Step 3:** Append a status line to `docs/audits/2026-07-17-bible-crossref-ux-audit.md` under the header:

```markdown
**Status:** Addressed by `docs/plans/2026-07-17-bible-crossref-ux-pass2.md` on `feature/bible-crossref-ux-pass2` (all P0/P1 + polish; backend heading misassignment still open).
```

**Step 4:** Commit — `docs: link crossref audit to pass-2 fixes; after screenshots`

**Step 5:** Use superpowers:finishing-a-development-branch to merge/PR per user preference.

---

## Known landmines for the executor

- **Port:** dev server is `10.0.0.10:8201`. `:8200` is Next.js and will 404 this route. `localhost` is not this Mac.
- **`overview.test.js` / `controller.test.js`** mock `BoMOnlineAPI` and may render via `index.jsx` — Task 10/11's prop changes can break their setup; update the mocks' render calls, not the production code, when reconciling.
- **Don't touch** `data.js` (generated pair index), `canon.js` ranges, or the chapter-cell ramp values.
- **CSS custom-prop fallbacks:** every `var(--x, fallback)` in this file carries a light-mode fallback on purpose (tokens load late in some entry paths) — keep that pattern in new rules.
- The dataviz palette WARN on light-mode phrase contrast is only legal while the table twin and direct labels exist — if you cut either, revalidate.
