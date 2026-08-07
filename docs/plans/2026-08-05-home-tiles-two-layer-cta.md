# Home Tiles — Two-Layer CTA Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every Home Sampler tile into compliance with a consistent two-layer CTA pattern — **Layer 1** an in-place reveal (expand/accordion/modal, stays on page) and **Layer 2** a deeplink into the associated content — routed through shared, reusable components, with Layer 2 gated behind Layer 1 on prose-expand tiles.

**Architecture:** Introduce three small design-system primitives under `tiles/_ds/` — a `RevealProvider`/`useReveal` context (gating state), a `TileCTA` presentational pill (one component, one a11y story, reusing the existing `.readMorePill`/`.tileMoreLink` styles), and a `TileDeepLink` (the Layer-2 control that hides until reveal unless `always`). Make `ExpandableText` reveal-aware so any tile that clamps prose automatically drives its own Layer-2 gate. Then migrate each tile: convert ad-hoc deeplinks to `TileDeepLink`, and add the missing Layer 1 to the three tiles that lack it (Community, History, Witness).

**Tech Stack:** React 17, `react-router-dom` v5 (`<Link>`), Jest + `@testing-library/react` via `react-scripts test`, `label()` i18n backed by the MySQL `bom_label` table seeded through `backend/scripts/seed-sampler-labels.mjs`.

---

## Conventions used throughout this plan

**Run tests with `react-scripts` (NOT raw `npx jest`).** Raw `npx jest` cannot parse JSX here. Always:

```bash
cd frontend/webapp
CI=true npx react-scripts test <pattern> --watchAll=false
```

`<pattern>` is a substring matched against test file paths, e.g. `TileCTA` matches `_ds/__tests__/TileCTA.test.js`.

**`label()` returns `" "` in tests.** With `global.dictionary` unset (the jsdom default), `label(key)` returns a single space (`src/models/Utils.js:95-114`). Therefore **never assert on `label()` output** — assert on roles, class names, `data-testid`, or data-derived text. This matches every existing tile test.

**Component location:** shared primitives live in `frontend/webapp/src/views/Home/tiles/_ds/`. Their tests live in `frontend/webapp/src/views/Home/tiles/_ds/__tests__/`. Tile tests continue to live in `frontend/webapp/src/views/Home/tiles/__tests__/`.

**Router in tests:** any test that renders a `<Link>` (i.e. anything rendering `TileCTA`/`TileDeepLink` with `to`) must wrap the tree in `<MemoryRouter>` from `react-router-dom`, or `<Link>` throws "You should not use <Link> outside a <Router>".

## Compliance definition (the bar every tile must meet)

1. **Layer 1 present:** a discrete in-place reveal. For prose tiles this is `ExpandableText` or a read-more expand of the tile's own body. For tiles whose body is inherently complete, an existing modal opener (scripture popup via `RefPill`/`ScriptureExcerpt`, or an interactive body like MapStory playback) satisfies Layer 1.
2. **Layer 2 present:** a discrete deeplink rendered via the shared `TileDeepLink` component — never a bare `<Link className="tileMoreLink">`, and never "the whole card is one link" with no separate control.
3. **Gating:** on prose-expand tiles the deeplink is **gated** (hidden until Layer 1 fires); on modal/interactive tiles it is `always` visible (there is no expand state to wait on).

**Documented exceptions (compliant as-is, no gating):**
- `PeopleTile` / `PlacesTile` — the end-of-grid "view all" mosaic card is their always-visible Layer 2; `ExpandableText` on the featured bio is Layer 1.
- `CommunityTile` — a live activity hub; keeps all state glanceable with an **always-visible** deeplink, not a gated one (product decision, 2026-08-05).
- `ReadingPlanTile` — already has a real in-place Layer 1 (the chooser, `setChooser`) and a Layer-2 deeplink (`Start Reading` → `/contents`); left as-is and exempt from the compliance invariant (product decision, 2026-08-05).
- `MapTile` — the map body is its Layer 1; keeps an `always` deeplink.

## File structure this plan creates or modifies

- Create: `tiles/_ds/Reveal.js` — `RevealProvider` + `useReveal` (Task 1)
- Create: `tiles/_ds/TileCTA.js` — the one CTA pill (Task 2)
- Create: `tiles/_ds/TileDeepLink.js` — gated Layer-2 control (Task 3)
- Create: `tiles/_ds/__tests__/Reveal.test.js`, `TileCTA.test.js`, `TileDeepLink.test.js`
- Modify: `tiles/ExpandableText.js` — reveal-aware, uses `TileCTA` (Task 4)
- Modify: `tiles/ChiasmusTile.js`, `BiblePhrasesTile.js`, `NotesTile.js`, `ImageArtTile.js`, `MapStoryTile.js`, `MapTile.js` — convert deeplink to `TileDeepLink always` (Task 5)
- Modify: `tiles/CommentaryTile.js` (+ test) — gate deeplink behind read-more (Task 6)
- Modify: `tiles/ContentsTile.js` (+ test) — provider + gated deeplink (Task 7)
- Modify: `tiles/PersonProfileTile.js`, `PlaceProfileTile.js` (+ test) — provider + gated deeplink (Task 8)
- Modify: `tiles/HistoryTile.js` (+ test) — restructure to div, add Layer 1 + gated deeplink (Task 9)
- Modify: `tiles/WitnessTile.js` (+ test) — restructure to div, add Layer 1 + gated deeplink (Task 10)
- Modify: `tiles/CommunityTile.js` (+ test) — add an always-visible deeplink (Task 11)
- Modify: `tiles/TextTile.js`, `NarrationTile.js`, `FaxTile.js`, `FaxVerseTile.js` — add `always` deeplink footer (Task 12)
- Modify: `backend/scripts/seed-sampler-labels.mjs`, `docs/reference/sampler-label-keys.md` — verify CTA label keys (Task 13, only if missing)
- Create: `tiles/__tests__/twoLayerCompliance.test.js` — folder-wide invariant (Task 14)

---

## Task 1: Reveal gating context (`_ds/Reveal.js`)

The state seam for "Layer 2 appears after Layer 1." A tile wraps its body in `<RevealProvider>`; a Layer-1 control that *actually has something to expand* calls `registerGate()` (marking "there is a pending reveal"), and calls `reveal()` when the user expands. `TileDeepLink` hides only when `gated && !revealed`.

**This two-flag model is deliberate** (it fixes the fatal trap in a naive `revealed`-only design): a tile whose prose is short and does NOT truncate never registers a gate, so its deeplink shows immediately instead of being invisible forever. Gating engages *only* when a real Layer-1 expand is present and unused. Without a provider, `gated` is `false`, so a bare `TileDeepLink` is always visible (safe, backward-compatible).

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/_ds/Reveal.js`
- Create: `frontend/webapp/src/views/Home/tiles/_ds/__tests__/Reveal.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/_ds/__tests__/Reveal.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevealProvider, useReveal } from "../Reveal";

function Probe() {
  const { revealed, gated, reveal, registerGate } = useReveal();
  return (
    <div>
      <span data-testid="revealed">{revealed ? "y" : "n"}</span>
      <span data-testid="gated">{gated ? "y" : "n"}</span>
      <button onClick={reveal}>reveal</button>
      <button onClick={registerGate}>gate</button>
    </div>
  );
}

describe("Reveal", () => {
  test("starts un-revealed and un-gated inside a provider", () => {
    render(<RevealProvider><Probe /></RevealProvider>);
    expect(screen.getByTestId("revealed").textContent).toBe("n");
    expect(screen.getByTestId("gated").textContent).toBe("n");
  });

  test("registerGate() flips gated; reveal() flips revealed", () => {
    render(<RevealProvider><Probe /></RevealProvider>);
    fireEvent.click(screen.getByText("gate"));
    expect(screen.getByTestId("gated").textContent).toBe("y");
    fireEvent.click(screen.getByText("reveal"));
    expect(screen.getByTestId("revealed").textContent).toBe("y");
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test _ds/__tests__/Reveal --watchAll=false`
Expected: FAIL — `Cannot find module '../Reveal'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/webapp/src/views/Home/tiles/_ds/Reveal.js`:

```javascript
import React, { createContext, useContext, useMemo, useState } from "react";

/**
 * Two-layer CTA gating. A tile wraps its body in <RevealProvider>. A Layer-1
 * control that actually has something to expand calls registerGate() (there IS
 * a pending reveal) and calls reveal() when the user expands. <TileDeepLink>
 * hides only while `gated && !revealed`.
 *
 * The two flags matter: a tile whose prose is short and never truncates never
 * registers a gate, so its deeplink shows immediately instead of being hidden
 * forever. Without a provider, gated stays false → bare TileDeepLink is visible.
 */
const RevealContext = createContext({
  revealed: false,
  gated: false,
  reveal: () => {},
  registerGate: () => {},
});

export function RevealProvider({ children }) {
  const [revealed, setRevealed] = useState(false);
  const [gated, setGated] = useState(false);
  const value = useMemo(
    () => ({ revealed, gated, reveal: () => setRevealed(true), registerGate: () => setGated(true) }),
    [revealed, gated]
  );
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}

export function useReveal() {
  return useContext(RevealContext);
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test _ds/__tests__/Reveal --watchAll=false`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/_ds/Reveal.js frontend/webapp/src/views/Home/tiles/_ds/__tests__/Reveal.test.js
git commit -m "feat(tiles): add Reveal gating context for two-layer CTAs"
```

---

## Task 2: The one CTA pill (`_ds/TileCTA.js`)

One component for every tile CTA. It renders a real `<button>` for actions (native keyboard support — fixes the `role="button"`/no-`onKeyDown` a11y gaps in FaxTile/CommentaryTile/NotesTile) and a real `<Link>` for navigation. It **reuses the existing pill classes** (`.readMorePill` for Layer 1, `.tileMoreLink` for Layer 2) so the visuals are unchanged — the consolidation is at the component level, not a CSS rewrite.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/_ds/TileCTA.js`
- Create: `frontend/webapp/src/views/Home/tiles/_ds/__tests__/TileCTA.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/_ds/__tests__/TileCTA.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TileCTA from "../TileCTA";

describe("TileCTA", () => {
  test("renders a real <button> for onClick actions (native keyboard support)", () => {
    const onClick = jest.fn();
    render(<TileCTA variant="reveal" onClick={onClick}>More</TileCTA>);
    const el = screen.getByRole("button", { name: "More" });
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveClass("readMorePill");
    expect(el).toHaveClass("tileCTA");
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("renders a real <a> for `to` navigation with the deeplink class", () => {
    render(
      <MemoryRouter>
        <TileCTA variant="deeplink" to="/places/nephi">Go</TileCTA>
      </MemoryRouter>
    );
    const el = screen.getByRole("link", { name: "Go" });
    expect(el.getAttribute("href")).toBe("/places/nephi");
    expect(el).toHaveClass("tileMoreLink");
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test _ds/__tests__/TileCTA --watchAll=false`
Expected: FAIL — `Cannot find module '../TileCTA'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/webapp/src/views/Home/tiles/_ds/TileCTA.js`:

```javascript
import React from "react";
import { Link } from "react-router-dom";

/**
 * The single CTA pill for every Home tile. ONE component, ONE a11y story:
 *  - `to`      → a real <Link> (Layer-2 navigation)
 *  - `onClick` → a real <button> (Layer-1 action; native Enter/Space support)
 * Reuses the existing pill styles, so the look is unchanged — this replaces
 * ad-hoc <Link className="tileMoreLink"> sites and `role="button"` spans.
 */
const VARIANT_CLASS = {
  reveal: "readMorePill", // Layer 1 — in-place expand (down-arrow glyph)
  deeplink: "tileMoreLink", // Layer 2 — navigate into content (exit-arrow glyph)
};

export default function TileCTA({ variant, to, onClick, children, className = "", ...rest }) {
  const cls = `tileCTA ${VARIANT_CLASS[variant] || ""} ${className}`.trim();
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test _ds/__tests__/TileCTA --watchAll=false`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/_ds/TileCTA.js frontend/webapp/src/views/Home/tiles/_ds/__tests__/TileCTA.test.js
git commit -m "feat(tiles): add unified TileCTA pill (button/link, a11y-correct)"
```

---

## Task 3: The gated Layer-2 control (`_ds/TileDeepLink.js`)

Wraps `TileCTA variant="deeplink"` with reveal-gating. Hidden until `revealed`, unless `always`. Default children = `label("view_in_context")`.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/_ds/TileDeepLink.js`
- Create: `frontend/webapp/src/views/Home/tiles/_ds/__tests__/TileDeepLink.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/_ds/__tests__/TileDeepLink.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RevealProvider, useReveal } from "../Reveal";
import TileDeepLink from "../TileDeepLink";

// A Layer-1 stand-in: registers a gate on mount (like a truncated ExpandableText),
// then can fire reveal() on click.
const Gate = () => {
  const { reveal, registerGate } = useReveal();
  React.useEffect(registerGate, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <button onClick={reveal}>reveal</button>;
};

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("TileDeepLink", () => {
  test("is hidden while a gate is registered and not yet revealed", () => {
    renderIn(
      <RevealProvider>
        <Gate />
        <TileDeepLink to="/x"><span>deep</span></TileDeepLink>
      </RevealProvider>
    );
    expect(screen.queryByText("deep")).toBeNull();
    fireEvent.click(screen.getByText("reveal"));
    expect(screen.getByText("deep")).toBeInTheDocument();
  });

  test("shows immediately inside a provider when NO gate is registered (short prose)", () => {
    renderIn(
      <RevealProvider>
        <TileDeepLink to="/x"><span>deep</span></TileDeepLink>
      </RevealProvider>
    );
    expect(screen.getByText("deep")).toBeInTheDocument();
  });

  test("`always` shows even with a gate registered", () => {
    renderIn(
      <RevealProvider>
        <Gate />
        <TileDeepLink to="/x" always><span>deep</span></TileDeepLink>
      </RevealProvider>
    );
    expect(screen.getByText("deep")).toBeInTheDocument();
  });

  test("with no provider it is visible (safe default)", () => {
    renderIn(<TileDeepLink to="/x"><span>deep</span></TileDeepLink>);
    const link = screen.getByRole("link");
    expect(within(link).getByText("deep")).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/x");
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test _ds/__tests__/TileDeepLink --watchAll=false`
Expected: FAIL — `Cannot find module '../TileDeepLink'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/webapp/src/views/Home/tiles/_ds/TileDeepLink.js`:

```javascript
import React from "react";
import { label } from "src/models/Utils";
import { useReveal } from "./Reveal";
import TileCTA from "./TileCTA";

/**
 * Layer 2 — the deeplink into the associated content. Hidden only while a
 * Layer-1 reveal is registered (`gated`) but not yet fired (`!revealed`). If no
 * gate was registered (short prose, or a modal/interactive Layer 1) it shows
 * immediately; `always` forces it visible regardless.
 */
export default function TileDeepLink({ to, always = false, children, className = "" }) {
  const { revealed, gated } = useReveal();
  if (!always && gated && !revealed) return null;
  return (
    <TileCTA variant="deeplink" to={to} className={className}>
      {children || label("view_in_context")}
    </TileCTA>
  );
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test _ds/__tests__/TileDeepLink --watchAll=false`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/_ds/TileDeepLink.js frontend/webapp/src/views/Home/tiles/_ds/__tests__/TileDeepLink.test.js
git commit -m "feat(tiles): add gated TileDeepLink (Layer-2 control)"
```

---

## Task 4: Make `ExpandableText` reveal-aware

Any prose tile that clamps with `ExpandableText` should automatically drive its own Layer-2 gate: when the user expands, fire `reveal()`. Also route its read-more button through `TileCTA` for consistency. Safe with no provider (default `reveal` is a no-op).

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/ExpandableText.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/ExpandableText.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/ExpandableText.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RevealProvider, useReveal } from "../_ds/Reveal";
import ExpandableText from "../ExpandableText";

// Force truncation: jsdom reports 0 for scrollHeight/clientHeight, so stub them
// so ExpandableText's "overflowing" check is true and the read-more renders.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const RevealState = () => {
  const { revealed } = useReveal();
  return <span data-testid="revealed">{revealed ? "yes" : "no"}</span>;
};

test("expanding fires reveal() so a sibling Layer-2 can appear", () => {
  render(
    <RevealProvider>
      <RevealState />
      <ExpandableText lines={2}>
        <span>lots of text that overflows the clamp box</span>
      </ExpandableText>
    </RevealProvider>
  );
  expect(screen.getByTestId("revealed").textContent).toBe("no");
  fireEvent.click(screen.getByRole("button")); // the read-more pill
  expect(screen.getByTestId("revealed").textContent).toBe("yes");
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test ExpandableText --watchAll=false`
Expected: FAIL — clicking read-more does not flip `revealed` (ExpandableText doesn't call `reveal()` yet).

- [ ] **Step 3: Update `ExpandableText.js`**

Replace the entire file `frontend/webapp/src/views/Home/tiles/ExpandableText.js` with:

```javascript
import React, { useEffect, useRef, useState } from "react";
import { label } from "src/models/Utils";
import { useReveal } from "./_ds/Reveal";
import TileCTA from "./_ds/TileCTA";

/**
 * Width-aware clamp: collapsed state is a CSS line-clamp (so the cut point
 * tracks the ACTUAL rendered width, not a word budget), with an inline
 * "read more" that expands in place. Truncation is detected by measuring
 * overflow. Safe inside card <Link>s. Expanding also fires the tile's Reveal
 * gate (no-op when there is no <RevealProvider>) so a sibling Layer-2 deeplink
 * can appear only after the reader has expanded.
 */
export default function ExpandableText({ children, lines = 6, className }) {
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef(null);
  const { reveal, registerGate } = useReveal();
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight > el.clientHeight + 2) {
      setTruncated(true);
      registerGate(); // there IS something to expand → gate a sibling deeplink
    }
    // registerGate is intentionally omitted from deps (stable-enough; matches the
    // no-op default when there is no provider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, lines]);
  const expand = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    reveal();
  };
  return (
    <div className={className}>
      <div
        ref={ref}
        className={open ? undefined : "clampLines"}
        style={open ? undefined : { WebkitLineClamp: lines }}
      >
        {children}
      </div>
      {truncated && !open ? (
        <TileCTA variant="reveal" onClick={expand}>
          {label("read_more")}
        </TileCTA>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test ExpandableText --watchAll=false`
Expected: PASS, 1 test green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/ExpandableText.js frontend/webapp/src/views/Home/tiles/__tests__/ExpandableText.test.js
git commit -m "feat(tiles): ExpandableText fires Reveal gate + uses TileCTA"
```

---

## Task 5: Convert modal/interactive tiles to `TileDeepLink always`

These six tiles already satisfy Layer 1 (a scripture popup or interactive body) and already have a Layer-2 deeplink — they just use a bare `<Link className="tileMoreLink">`. Route them through `TileDeepLink always` so all deeplinks share one component. **Mechanical: same edit shape in each file.** No provider (they stay always-visible).

**Files:**
- Modify: `tiles/ChiasmusTile.js`, `tiles/BiblePhrasesTile.js`, `tiles/NotesTile.js`, `tiles/ImageArtTile.js`, `tiles/MapStoryTile.js`, `tiles/MapTile.js`

- [ ] **Step 1: ChiasmusTile** — add import and replace the deeplink.

In `frontend/webapp/src/views/Home/tiles/ChiasmusTile.js`, add after line 8 (`import RefPill from "./RefPill";`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Replace lines 81-83:

```javascript
      <Link to={`/analysis/chiasmus/${chiasm.chiasmus_id}`} className="tileMoreLink">
        {label("view_in_context")}
      </Link>
```

with:

```javascript
      <TileDeepLink to={`/analysis/chiasmus/${chiasm.chiasmus_id}`} always>
        {label("view_in_context")}
      </TileDeepLink>
```

- [ ] **Step 2: BiblePhrasesTile** — add import after line 8 (`import RefPill from "./RefPill";`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Replace lines 118-120:

```javascript
      <Link to={deepTo} className="tileMoreLink">
        {label("view_in_context")}
      </Link>
```

with:

```javascript
      <TileDeepLink to={deepTo} always>
        {label("view_in_context")}
      </TileDeepLink>
```

- [ ] **Step 3: NotesTile** — add import after line 8 (`import { openScripture } from "./ScripturePopup";`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Replace lines 86-90:

```javascript
        {to ? (
          <div className="notesMeta">
            <Link to={to} className="tileMoreLink">{label("view_in_context")}</Link>
          </div>
        ) : null}
```

with:

```javascript
        {to ? (
          <div className="notesMeta">
            <TileDeepLink to={to} always>{label("view_in_context")}</TileDeepLink>
          </div>
        ) : null}
```

**Then remove the now-orphaned import** — that `<Link>` was NotesTile's only use of it. Delete line 2:

```javascript
import { Link } from "react-router-dom";
```

Leaving it triggers eslint `no-unused-vars`, which `CI=true` promotes to a **build error** (the test run won't catch it — `react-scripts build` will). Verify with `grep -n "Link" frontend/webapp/src/views/Home/tiles/NotesTile.js` → only the `TileDeepLink` import should remain.

- [ ] **Step 4: ImageArtTile** — add import after line 5 (`import ScriptureExcerpt, { readPath } ...`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Replace line 43:

```javascript
        {to ? <Link to={to} className="imageArtContext tileMoreLink">{label("view_in_context")}</Link> : null}
```

with:

```javascript
        {to ? <TileDeepLink to={to} always className="imageArtContext">{label("view_in_context")}</TileDeepLink> : null}
```

- [ ] **Step 5: MapStoryTile** — add import (top of file, after its existing imports):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Replace line 154:

```javascript
      <Link to="/map" className="mapTileCta tileMoreLink">{label("view_more")}</Link>
```

with:

```javascript
      <TileDeepLink to="/map" always className="mapTileCta">{label("view_more")}</TileDeepLink>
```

- [ ] **Step 6: MapTile** — add import (after its existing imports):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Replace line 25:

```javascript
      <Link to="/map" className="mapTileCta tileMoreLink">{label("view_more")}</Link>
```

with:

```javascript
      <TileDeepLink to="/map" always className="mapTileCta">{label("view_more")}</TileDeepLink>
```

- [ ] **Step 7: Run the affected tiles' existing tests — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test "BiblePhrasesTile|NotesTile|MapStoryTile" --watchAll=false`
Expected: PASS. These suites render the tiles; the deeplink is now a `TileDeepLink always` that renders identically (same classes via `TileCTA`). If a suite asserted on the old `<Link className="tileMoreLink">` structure, it still matches because `TileCTA` emits `tileMoreLink`.

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/ChiasmusTile.js frontend/webapp/src/views/Home/tiles/BiblePhrasesTile.js frontend/webapp/src/views/Home/tiles/NotesTile.js frontend/webapp/src/views/Home/tiles/ImageArtTile.js frontend/webapp/src/views/Home/tiles/MapStoryTile.js frontend/webapp/src/views/Home/tiles/MapTile.js
git commit -m "refactor(tiles): route modal/interactive deeplinks through TileDeepLink"
```

---

## Task 6: Gate CommentaryTile's deeplink behind read-more

CommentaryTile is the reference tile — it already has a read-more expand (`setExpanded`) and a "see in context" deeplink. Wrap it in `RevealProvider`, fire `reveal()` from the read-more, convert both CTAs to the shared components, and **gate** the deeplink so it appears after expand.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/CommentaryTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/CommentaryTile.twolayer.test.js`

> Note: a `CommentaryTile.test.js` already exists; add a separate `.twolayer` test file so the existing suite is untouched.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/CommentaryTile.twolayer.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommentaryTile from "../CommentaryTile";

// Force the excerpt to look overflowing so the read-more pill renders.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 100 });
});

const data = {
  id: 7,
  title: "A commentary",
  reference: "Alma 32:21",
  preview: "word ".repeat(80),
  publication: { source_name: "Author", source_title: "Work", source_id: 3 },
};

test("the 'see in context' deeplink appears only after read-more is clicked", () => {
  render(
    <MemoryRouter>
      <CommentaryTile data={data} />
    </MemoryRouter>
  );
  const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
  // Layer 2 hidden until Layer 1 fires.
  expect(deep()).toBeNull();
  // Click the read-more pill (Layer 1).
  const readMore = screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") });
  fireEvent.click(readMore);
  expect(deep()).not.toBeNull();
  expect(deep().getAttribute("href")).toBe("/commentary/7");
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test CommentaryTile.twolayer --watchAll=false`
Expected: FAIL — the deeplink is present from the start (not gated yet).

- [ ] **Step 3: Update `CommentaryTile.js`**

In `frontend/webapp/src/views/Home/tiles/CommentaryTile.js`:

Add imports after line 10 (`import { ATVHeader } ...`):

```javascript
import { RevealProvider, useReveal } from "./_ds/Reveal";
import TileCTA from "./_ds/TileCTA";
import TileDeepLink from "./_ds/TileDeepLink";
```

Rename the default export function to an inner component and add a wrapper. Change line 23 from:

```javascript
export default function CommentaryTile({ data }) {
```

to:

```javascript
function CommentaryTileInner({ data }) {
  const { reveal, registerGate } = useReveal();
```

Register the gate whenever there is a real read-more (truncated, non-ATV). Add this effect immediately after the existing `useLayoutEffect` block (right after its closing `}, [text, expanded]);` on line 55):

```javascript
  // Gate the deeplink only when a read-more will actually render. ATV tiles
  // (no truncation path) never gate → their deeplink shows immediately.
  useEffect(() => {
    if (!isAtv && truncated && !expanded) registerGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truncated, isAtv, expanded]);
```

(`useEffect` is already imported on line 1.)

Replace the read-more block (lines 84-88):

```javascript
          {!isAtv && truncated && !expanded ? (
            <button className="readMorePill" onClick={() => setExpanded(true)}>
              {label("read_more")}
            </button>
          ) : null}
```

with:

```javascript
          {!isAtv && truncated && !expanded ? (
            <TileCTA variant="reveal" onClick={() => { setExpanded(true); reveal(); }}>
              {label("read_more")}
            </TileCTA>
          ) : null}
```

Replace the deeplink (line 109):

```javascript
          <Link to={to} className="commentaryTileMore tileMoreLink">{label("view_in_context")}</Link>
```

with:

```javascript
          <TileDeepLink to={to} className="commentaryTileMore">{label("view_in_context")}</TileDeepLink>
```

Then, at the very end of the file (after the `CommentaryTileInner` function's closing brace), add the wrapping export:

```javascript
export default function CommentaryTile(props) {
  return (
    <RevealProvider>
      <CommentaryTileInner {...props} />
    </RevealProvider>
  );
}
```

> Note: because the gate is only registered when a read-more actually renders (the effect above), a short/non-truncated commentary — and every ATV commentary — never gates, so its deeplink shows immediately. Only commentaries that genuinely have "more" hide the deeplink until expanded. No `always` override is needed.

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test CommentaryTile --watchAll=false`
Expected: PASS — both `CommentaryTile.test.js` and `CommentaryTile.twolayer.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/CommentaryTile.js frontend/webapp/src/views/Home/tiles/__tests__/CommentaryTile.twolayer.test.js
git commit -m "feat(tiles): gate CommentaryTile deeplink behind read-more"
```

---

## Task 7: ContentsTile — provider + gated deeplink

ContentsTile has an `ExpandableText` description (Layer 1) and inline outline links, but no discrete Layer-2 deeplink. Wrap it in `RevealProvider` so the `ExpandableText` gate works, and add a gated `TileDeepLink` into the division.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/ContentsTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/ContentsTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/ContentsTile.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ContentsTile from "../ContentsTile";

// Force ExpandableText to see overflow so its read-more (and thus the gate) fires.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const data = {
  slug: "1-nephi",
  title: "1 Nephi",
  description: "A long description that overflows the clamp and truncates.",
  pages: [{ slug: "1-nephi/1", title: "Chapter 1", sections: [] }],
};

const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });

test("deeplink is gated: hidden until the description is expanded", () => {
  render(<MemoryRouter><ContentsTile data={data} /></MemoryRouter>);
  expect(deep()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") }));
  expect(deep().getAttribute("href")).toBe("/1-nephi");
});

test("with NO description there is no gate, so the deeplink shows immediately", () => {
  render(<MemoryRouter><ContentsTile data={{ ...data, description: null }} /></MemoryRouter>);
  expect(deep().getAttribute("href")).toBe("/1-nephi");
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test ContentsTile --watchAll=false`
Expected: FAIL — the current tile renders no `TileDeepLink` at all, so `deep()` is `null` and `deep().getAttribute(...)` throws in both tests. This is a genuine RED (proves the gated deeplink and the no-gate-short-prose path once Step 3 lands).

- [ ] **Step 3: Update `ContentsTile.js`**

Replace the entire file with:

```javascript
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

/**
 * One sampled division rendered like a single /contents entry: banner, title,
 * teaser, then the actual page/section outline — real links into the guide,
 * not just a picture of it. Outer element is a div (not a Link): the outline
 * carries its own nested anchors. Layer 1 = the expandable teaser; Layer 2 =
 * a gated deeplink into the division, revealed once the teaser is expanded.
 */
export default function ContentsTile({ data }) {
  if (!data?.slug) return null;
  return (
    <RevealProvider>
      <div className="samplerTileInner contentsTile">
        <h3 className="tileHeading">
          <Link to="/contents">{label("contents")}</Link>
        </h3>
        <Link to={`/${data.slug}`} className="contentsTileHead">
          <div className="contentsTileTitle">{data.title}</div>
          <img
            src={`${assetUrl}/home/${data.slug}-1`}
            alt=""
            loading="lazy"
            onError={(e) => (e.target.style.display = "none")}
          />
          {data.description ? (
            <ExpandableText className="contentsTileDesc" lines={5}>
              {data.description}
            </ExpandableText>
          ) : null}
        </Link>
        {data.pages?.length ? (
          <div className="contentsOutline">
            {data.pages.map((pg) => (
              <div className="contentsOutlinePage" key={pg.slug}>
                {pg.title !== data.title ? (
                  <Link to={`/${pg.slug}`} className="contentsOutlinePageLink">{pg.title}</Link>
                ) : null}
                {pg.sections?.length ? (
                  <div className="contentsOutlineSections">
                    {pg.sections.map((s, i) => (
                      <React.Fragment key={s.slug}>
                        {i > 0 ? <span className="contentsOutlineDot"> · </span> : null}
                        <Link to={`/${s.slug}`}>{s.title}</Link>
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <TileDeepLink to={`/${data.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test ContentsTile --watchAll=false`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/ContentsTile.js frontend/webapp/src/views/Home/tiles/__tests__/ContentsTile.test.js
git commit -m "feat(tiles): ContentsTile gated deeplink via RevealProvider"
```

---

## Task 8: PersonProfileTile + PlaceProfileTile — provider + gated deeplink

Both have an `ExpandableText` bio/description (Layer 1) but only name/image links — no discrete gated Layer-2. Wrap each in `RevealProvider` and add a gated `TileDeepLink` to the profile page.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/PersonProfileTile.js`
- Modify: `frontend/webapp/src/views/Home/tiles/PlaceProfileTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/ProfileTiles.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/ProfileTiles.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PersonProfileTile from "../PersonProfileTile";
import PlaceProfileTile from "../PlaceProfileTile";

// Force the ExpandableText bio/desc to truncate so the gate fires.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
const readMore = () => screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") });

test("PersonProfileTile: deeplink hidden until the bio is expanded", () => {
  const payload = { people: [{ slug: "alma", name: "Alma", description: "A long bio that overflows." }] };
  renderIn(<PersonProfileTile payload={payload} personIndex={0} />);
  expect(deep()).toBeNull();
  fireEvent.click(readMore());
  expect(deep().getAttribute("href")).toBe("/people/alma");
});

test("PlaceProfileTile: deeplink hidden until the description is expanded", () => {
  const payload = { places: [{ slug: "nephi", name: "Land of Nephi", description: "A long place description." }] };
  renderIn(<PlaceProfileTile payload={payload} placeIndex={0} />);
  expect(deep()).toBeNull();
  fireEvent.click(readMore());
  expect(deep().getAttribute("href")).toBe("/places/nephi");
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test ProfileTiles --watchAll=false`
Expected: FAIL — neither tile renders a `TileDeepLink` yet, so `deep()` is `null` and `deep().getAttribute(...)` throws after the read-more click. Genuine RED.

- [ ] **Step 3a: Update `PersonProfileTile.js`**

Add imports after line 10 (`import ExpandableText from "./ExpandableText";`):

```javascript
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
```

Wrap the returned tree in `<RevealProvider>` and add the deeplink. Change the `return (` block so the outer element is wrapped:

```javascript
  return (
    <RevealProvider>
      <div className="samplerTileInner personProfileTile">
        <h3 className="tileHeading">
          <Link to="/people">{label("people")}</Link>
        </h3>
        <div className="peopleFeature">
          <Link to={`/people/${person.slug}`} className="peopleFeatureImgLink">
            <img
              className="peopleFeatureImg"
              src={`${assetUrl}/people/${person.slug}`}
              alt={person.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
          </Link>
          <div className="peopleFeatureBody">
            <Link to={`/people/${person.slug}`} className="peopleFeatureNameLink">
              <span className="peopleFeatureName">{replaceNumbers(person.name)}</span>
              {person.title ? <span className="peopleFeatureTitle">{supDigits(person.title)}</span> : null}
            </Link>
            <ExpandableText className="peopleFeatureDesc" lines={7}>
              {Parser(getDetectedScripturesHtml(bio), scriptureOpts)}
            </ExpandableText>
          </div>
        </div>
        <TileDeepLink to={`/people/${person.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
```

- [ ] **Step 3b: Update `PlaceProfileTile.js`**

Add imports after line 10 (`import ExpandableText from "./ExpandableText";`):

```javascript
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
```

Wrap the returned tree and add the deeplink:

```javascript
  return (
    <RevealProvider>
      <div className="samplerTileInner placeProfileTile">
        <h3 className="tileHeading">
          <Link to="/places">{label("places")}</Link>
        </h3>
        <div className="placeProfileHead">
          <Link to={`/places/${place.slug}`} className="placeProfileImgLink">
            <img
              src={`${assetUrl}/places/${place.slug}`}
              alt={place.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <span className="peopleFaceName placesNameOverlay">{place.name}</span>
          </Link>
          <Link
            to={`/map/internal/place/${place.slug}`}
            className="placesMapBtn placeProfileMapBtn"
            title={label("map")}
            aria-label={label("map")}
          >
            <img src={pin} alt="" />
          </Link>
        </div>
        {desc ? (
          <ExpandableText className="placeProfileDesc" lines={5}>
            {Parser(getDetectedScripturesHtml(desc), scriptureOpts)}
          </ExpandableText>
        ) : null}
        <TileDeepLink to={`/places/${place.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test ProfileTiles --watchAll=false`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/PersonProfileTile.js frontend/webapp/src/views/Home/tiles/PlaceProfileTile.js frontend/webapp/src/views/Home/tiles/__tests__/ProfileTiles.test.js
git commit -m "feat(tiles): gated deeplinks on Person/Place profile tiles"
```

---

## Task 9: HistoryTile — restructure to div, add Layer 1 + gated deeplink

HistoryTile currently has **no Layer 1** — the whole card is one `<Link>` and the teaser/bullets are statically clamped. Restructure the outer element to a `<div>` (so an inner expand button is legal), clamp the lead with `ExpandableText`, and add a gated `TileDeepLink` into the document.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/HistoryTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.twolayer.test.js`

> Note: a `HistoryTile.test.js` (covering `parseTeaser`) already exists — keep it; add a separate `.twolayer` file.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.twolayer.test.js`:

```javascript
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistoryTile from "../HistoryTile";

const data = {
  id: 12,
  slug: "joseph-diary",
  document: "Joseph's Diary",
  year: "1832",
  teaser: "<p>A lead paragraph.</p> Key Points: <ul><li>One</li><li>Two</li></ul>",
};

test("outer element is a div (not an anchor) so it can hold an inner expand", () => {
  const { container } = render(
    <MemoryRouter>
      <HistoryTile data={data} />
    </MemoryRouter>
  );
  const inner = container.querySelector(".historyTile");
  expect(inner).not.toBeNull();
  expect(inner.tagName).toBe("DIV"); // was an <a> before this task
});

test("deeplink into the document is gated (absent before expand)", () => {
  render(
    <MemoryRouter>
      <HistoryTile data={data} />
    </MemoryRouter>
  );
  const deep = screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
  expect(deep).toBeNull();
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test HistoryTile.twolayer --watchAll=false`
Expected: FAIL — the first test fails because `.historyTile` is currently an `<a>` (the whole card is a `<Link>`).

- [ ] **Step 3: Update `HistoryTile.js`**

Replace the whole file with:

```javascript
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

/**
 * Featured document, structured: thumb · title · provenance · lead paragraph ·
 * REAL Key-Points bullets (parsed from the teaser's list markup) · citation.
 * Layer 1 = the expandable lead; Layer 2 = a gated deeplink into the document
 * (revealed after the lead is expanded). Outer element is a div (not a Link) so
 * the inner read-more button is legal — the title carries the primary anchor.
 */
export const parseTeaser = (html) => {
  const raw = html || "";
  const bullets = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => flatten(m[1]))
    .filter(Boolean)
    .slice(0, 4);
  const lead = flatten(raw.split(/key points:/i)[0]);
  return { lead, bullets };
};

export default function HistoryTile({ data }) {
  if (!data?.id) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history";
  const meta = [data.year, data.source, data.author].filter(Boolean).join(" · ");
  const aspect = parseFloat(data.aspect) || null; // stored as height/width
  const { lead, bullets } = parseTeaser(data.teaser);
  return (
    <RevealProvider>
      <div className="samplerTileInner historyTile">
        <h3 className="tileHeading">{label("history")}</h3>
        <div className="historyTileBody">
          <div className="historyTileMain">
            <Link to={to} className="historyTileTitle">{data.document}</Link>
            {meta ? <div className="historyTileMeta">{meta}</div> : null}
            {data.archive ? <div className="historyTileArchive">{flatten(data.archive)}</div> : null}
            {lead ? (
              <ExpandableText className="historyTileTeaser" lines={3}>
                {lead}
              </ExpandableText>
            ) : null}
            {bullets.length ? (
              <ul className="historyTileBullets">
                {bullets.map((b, i) => (
                  <li key={i}>{clampWords(b, 16)}</li>
                ))}
              </ul>
            ) : null}
            {data.citation ? <div className="historyTileCitation">{flatten(data.citation)}</div> : null}
          </div>
          <Link to={to} className="historyTileThumbLink">
            <img
              className="historyTileThumb"
              style={aspect ? { aspectRatio: `1 / ${aspect}` } : undefined}
              src={`${assetUrl}/history/thumbs/${String(data.id).padStart(4, "0")}`}
              alt={data.document || ""}
              loading="lazy"
              onError={(e) => (e.target.style.display = "none")}
            />
          </Link>
        </div>
        <TileDeepLink to={to}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
```

> Behaviour change: the lead is no longer pre-truncated to 50 words by `clampWords`; `ExpandableText` clamps it visually to 3 lines and expands in place. The existing `HistoryTile.test.js` asserts `parseTeaser` returns a `lead` containing the intro text — still true (we removed only the `clampWords` wrap, so `lead` now holds the full flattened lead; the assertions use `toContain`, which still passes).

- [ ] **Step 4: Run the tests — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test HistoryTile --watchAll=false`
Expected: PASS — both `HistoryTile.test.js` and `HistoryTile.twolayer.test.js` green.

- [ ] **Step 5: (No CSS change needed — verify only)**

The existing `.samplerTileInner a` rule already sets `text-decoration: none`, and `.historyTileTitle` already carries its deliberate color — so the new `<a class="historyTileTitle">` and `<a class="historyTileThumbLink">` inherit correct styling. **Do NOT add `color: inherit`** — it would override the intended title color at equal specificity. The title and thumb are now the card's click targets (the meta/teaser/bullets are intentionally not clickable); confirm both navigate in the browser (Task 15). Add a `.historyTileThumbLink { display: block; }` rule only if the thumb's layout shifts.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/HistoryTile.js frontend/webapp/src/views/Home/tiles/__tests__/HistoryTile.twolayer.test.js
git commit -m "feat(tiles): HistoryTile two-layer CTA (expandable lead + gated deeplink)"
```

---

## Task 10: WitnessTile — restructure to div, add Layer 1 + gated deeplink

WitnessTile has **no Layer 1** — the whole card is one `<Link>` and the money quote is hard-clamped to 60 words. Restructure to a `<div>`, expand the quote via `ExpandableText`, and add a gated `TileDeepLink` into the Witnesses view.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/WitnessTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/WitnessTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/WitnessTile.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WitnessTile from "../WitnessTile";

// Force the ExpandableText quote to truncate so the gate fires.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const data = [
  { principal: "Martin Harris", witnessSlug: "martin-harris", moneyQuote: "I saw the plates and the engravings thereon.", source: "Interview" },
];

const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });

test("outer element is a div and the deeplink is gated behind the quote expand", () => {
  const { container } = render(<MemoryRouter><WitnessTile data={data} /></MemoryRouter>);
  expect(container.querySelector(".witnessTile").tagName).toBe("DIV");
  expect(screen.getByText("Martin Harris")).toBeInTheDocument();
  expect(deep()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") }));
  expect(deep().getAttribute("href")).toBe("/history/witnesses/martin-harris");
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test WitnessTile --watchAll=false`
Expected: FAIL — the current tile has no `ExpandableText`/read-more (the quote is statically clamped), so `getByRole("button", …readMorePill)` throws. Genuine RED.

- [ ] **Step 3: Update `WitnessTile.js`**

Replace **lines 61-96** — the `const quote` / `const source` / `const to` declarations (61-63) through the end of the `return`. Keep the witness-selection logic (lines 1-60) unchanged. **Do not keep the old lines 61-63** — the replacement re-declares those consts, so leaving them causes `Identifier 'quote' has already been declared`. Add imports at the top after line 5 (`import { flatten, clampWords } from "./textUtils";`):

```javascript
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
```

Then replace the `return (...)` block with:

```javascript
  const quote = flatten(w.moneyQuote);
  const source = w.source ? clampWords(flatten(w.source), 18) : null;
  const to = w.witnessSlug ? `/history/witnesses/${w.witnessSlug}` : "/history/witnesses";
  return (
    <RevealProvider>
      <div className="samplerTileInner witnessTile">
        <h3 className="tileHeading">
          <Link to="/history/witnesses">{label("witnesses")}</Link>
        </h3>
        <div className="witnessFeatured">
          <Link to={to} className="witnessLeft">
            <span className="witnessHero">
              {w.witnessSlug ? (
                <img
                  src={`${assetUrl}/history/witnesses/people/${w.witnessSlug}.jpg`}
                  alt={w.principal}
                  loading="lazy"
                  onError={(e) => { e.target.style.display = "none"; e.target.parentNode.classList.add("mono"); }}
                />
              ) : null}
              <span className="witnessMono" aria-hidden="true">{initials(w.principal)}</span>
            </span>
            <span className="witnessName">{w.principal}</span>
          </Link>
          <span className="witnessBody">
            <ExpandableText className="witnessStatement" lines={4}>
              {!w.isWitnessVoice && w.speaker ? <span className="witnessSpeaker">{w.speaker}: </span> : null}
              &ldquo;{withBrackets(quote)}&rdquo;
            </ExpandableText>
            {source ? <span className="witnessSource">{source}</span> : null}
          </span>
        </div>
        <TileDeepLink to={to}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
```

> Notes: (1) the quote is no longer pre-truncated (`clampWords(..., 60)` removed) — `ExpandableText` now clamps to 4 lines and expands in place. (2) `.witnessStatement` was a `<blockquote>`; it is now the div `ExpandableText` renders. If `.witnessStatement` CSS relied on `blockquote` margins, verify visually; add `margin: 0` to `.witnessStatement` in Sampler.css if needed. (3) The portrait+name is now its own `<Link>` inside a `<div class="witnessFeatured">` (which is no longer an anchor) — this is required so the inner read-more button is legal.

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test WitnessTile --watchAll=false`
Expected: PASS, 1 test green.

- [ ] **Step 5: (No CSS change needed — verify only)**

`.witnessFeatured` already carries `text-decoration: none; color: inherit` and `.witnessStatement` already has `margin: 0` in `Sampler.css`, so the anchor→div and blockquote→div swaps are visually inert. Just confirm in the browser (Task 15) that `.witnessLeft` (now the portrait+name `<Link>`) and the deeplink render correctly; add `.witnessLeft { text-decoration: none; color: inherit; }` only if a regression actually appears.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/WitnessTile.js frontend/webapp/src/views/Home/tiles/__tests__/WitnessTile.test.js frontend/webapp/src/views/Home/Sampler.css
git commit -m "feat(tiles): WitnessTile two-layer CTA (expandable quote + gated deeplink)"
```

---

## Task 11: CommunityTile — add an always-visible Layer-2 deeplink

CommunityTile is a live activity hub; per product decision (2026-08-05) its live state (groups, messages, reading, finishers) stays **glanceable** — it is NOT gated behind a click. Treat it like the modal/interactive tiles: keep all content visible exactly as today and add ONE always-visible "Open community" deeplink. No `RevealProvider`, no gating, no new label key.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/CommunityTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/CommunityTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/CommunityTile.test.js`:

```javascript
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommunityTile from "../CommunityTile";

const data = {
  groups: [{ url: "g1", name: "Group One", picture: "p", members: [{ user_id: 1, picture: "a" }] }],
  moreGroups: 0,
  messages: [],
  reading: [{ nickname: "Reader", picture: "r", progress: 40 }],
  finishers: [],
};

test("live activity stays visible and an always-on deeplink into /home/community renders", () => {
  render(<MemoryRouter><CommunityTile data={data} /></MemoryRouter>);
  // Reading-now is visible with no interaction (messages empty → reading shows).
  expect(screen.getByText("Reader")).toBeInTheDocument();
  const deep = screen.getByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
  expect(deep.getAttribute("href")).toBe("/home/community");
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `cd frontend/webapp && CI=true npx react-scripts test CommunityTile --watchAll=false`
Expected: FAIL — there is no `.tileMoreLink` deeplink yet, so `getByRole("link", …)` throws.

- [ ] **Step 3: Update `CommunityTile.js`**

This is a minimal, additive change — the existing structure is untouched. Add the import after line 4 (`import { clampWords } from "./textUtils";`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Then add the deeplink as the last child of the `.communityTile` container — immediately before its closing `</div>` (i.e. after the `finishers.length ? (...) : null` block, which currently ends at line 91):

```javascript
      <TileDeepLink to="/home/community" always>{label("view_more")}</TileDeepLink>
```

(No `RevealProvider`, no `useReveal`, no `TileCTA` — this tile has no Layer-1 gate.)

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test CommunityTile --watchAll=false`
Expected: PASS, 1 test green.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/CommunityTile.js frontend/webapp/src/views/Home/tiles/__tests__/CommunityTile.test.js
git commit -m "feat(tiles): CommunityTile always-visible Layer-2 deeplink"
```

---

## Task 12: Add `always` deeplink footers to Text / Narration / Fax / FaxVerse

These four have a modal/interactive/whole-content Layer 1 but only scattered item links for Layer 2. Add a discrete `TileDeepLink always` footer so each has a clear Layer-2 control. **Mechanical.**

**Files:**
- Modify: `tiles/TextTile.js`, `tiles/NarrationTile.js`, `tiles/FaxTile.js`, `tiles/FaxVerseTile.js`

- [ ] **Step 1: TextTile** — add import after line 4 (`import { TextInFeed } ...`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Replace the tile body (lines 14-20) so the deeplink sits after `TextInFeed`:

```javascript
    <div className="samplerTileInner textTile">
      <h3 className="tileHeading">
        <Link to={`/${data.slug}`}>{label("scripture")}</Link>
      </h3>
      <TextInFeed textData={data} highlights={[]} />
      <TileDeepLink to={`/${data.slug}`} always>{label("view_in_context")}</TileDeepLink>
    </div>
```

- [ ] **Step 2: NarrationTile** — add import after line 11 (`import RefPill from "./RefPill";`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Add a deeplink to the sampled page just before the closing `</div>` of `.narrationTile` (after the `.narrationTileList` block, i.e. before line 91's closing `</div>`):

```javascript
      <TileDeepLink to={`/${data.slug}`} always>{label("view_more")}</TileDeepLink>
```

- [ ] **Step 3: FaxTile** — add import after line 6 (`import { openScripture } ...`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Add a deeplink into the facsimile just before the closing `</div>` of `.faxTile` (after the `editions.length ? (...)` block):

```javascript
      <TileDeepLink to={`/fax/${data.slug}`} always>{label("view_more")}</TileDeepLink>
```

- [ ] **Step 4: FaxVerseTile** — add import after line 5 (`import ScriptureExcerpt ...`):

```javascript
import TileDeepLink from "./_ds/TileDeepLink";
```

Also give the FaxVerse a real primary deeplink into the fax viewer. Add just before the closing `</div>` of `.faxVerseTile` (after the `.faxVerseEditions` block):

```javascript
      {editions[0] ? (
        <TileDeepLink
          to={slug ? `/fax/${editions[0].version}/${slug}` : `/fax/${editions[0].version}/${editions[0].page}`}
          always
        >
          {label("view_more")}
        </TileDeepLink>
      ) : null}
```

- [ ] **Step 5: Run the affected tiles' tests — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test "FaxVerseTile|MapStoryTile" --watchAll=false`
Expected: PASS (FaxVerseTile has an existing suite; adding a footer link does not break its assertions).

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/TextTile.js frontend/webapp/src/views/Home/tiles/NarrationTile.js frontend/webapp/src/views/Home/tiles/FaxTile.js frontend/webapp/src/views/Home/tiles/FaxVerseTile.js
git commit -m "feat(tiles): discrete Layer-2 deeplinks on Text/Narration/Fax/FaxVerse"
```

---

## Task 13: Verify the CTA label keys are seeded

This plan introduces **no new label keys** — every CTA reuses `read_more`, `view_in_context`, and `view_more`. Those must exist in the live dictionary or `label()` renders the raw snake_case key on screen (`Utils.js:100`). Verify, and seed any that are missing.

**Files (only if a key is missing):**
- Modify: `backend/scripts/seed-sampler-labels.mjs`
- Modify: `docs/reference/sampler-label-keys.md`

- [ ] **Step 1: Confirm the keys are actually seeded (not just used)**

Grepping source only proves *usage*. Check the seed source of truth and, if available, the DB:

```bash
grep -nE "read_more|view_in_context|view_more" backend/scripts/seed-sampler-labels.mjs
grep -nE "read_more|view_in_context|view_more" docs/reference/sampler-label-keys.md
```

If a key is absent from BOTH the seed script and the reference inventory, treat it as unseeded.

- [ ] **Step 2: Seed any missing key**

For each missing key, add it to the `labels` object in `backend/scripts/seed-sampler-labels.mjs` (after the `mapstory_meta` line) with an English default:

```javascript
  read_more: 'Read more',
  view_in_context: 'See in context',
  view_more: 'View more',
```

(Include only the ones Step 1 found missing.)

- [ ] **Step 3: Record in the reference doc**

Add a row for each newly-seeded key to the inventory table in `docs/reference/sampler-label-keys.md`, marked as verified/added on 2026-08-05.

- [ ] **Step 4: Commit (skip if nothing was missing)**

```bash
git add backend/scripts/seed-sampler-labels.mjs docs/reference/sampler-label-keys.md
git commit -m "chore(i18n): ensure two-layer CTA label keys are seeded"
```

> Deploy note: if the seed script changed, run it against the target DB before/with deploy (`node backend/scripts/seed-sampler-labels.mjs`), consistent with the existing sampler-label rollout.

---

## Task 14: Folder-wide two-layer compliance invariant

A lightweight guard so a future tile can't silently ship without a deeplink: every non-`_ds`, non-test tile module in `tiles/` must import `TileDeepLink` (its Layer-2 control) — the one structural signal that survives without rendering each tile with fixture data.

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/twoLayerCompliance.test.js`

- [ ] **Step 1: Write the test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/twoLayerCompliance.test.js`:

```javascript
import fs from "fs";
import path from "path";

const TILES_DIR = path.resolve(__dirname, "..");

// Tiles whose Layer 2 is intentionally NOT a TileDeepLink:
//  - People/Places: the "view all" mosaic card is their always-on Layer 2.
//  - ReadingPlan: stateful; its Layer 1 is the in-place chooser (setChooser) and
//    its Layer 2 is start_reading→/contents. A dedicated plan-detail deeplink is
//    tracked as a follow-up (see the audit), out of scope for this plan.
//  - ReadingProgress: a sub-tile rendered by ReadingPlanTile, not registered
//    standalone; it inherits ReadingPlan's CTAs.
//  - Inner/Card fragments render inside a parent tile that carries the deeplink.
//  - Shared/helper modules and re-export shims carry no CTA of their own.
const EXEMPT = new Set([
  "PeopleTile.js",
  "PlacesTile.js",
  "ReadingPlanTile.js",
  "ReadingProgressTile.js",
  "ExpandableText.js",
  "RefPill.js",
  "ScripturePopup.js",
  "textUtils.js",
  "mapStoryPath.js",
  "registry.js",
  "MapTileInner.js",
  "MapStoryTileInner.js",
  "MapStoryCard.js",
]);

const tileFiles = fs
  .readdirSync(TILES_DIR)
  .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));

describe("two-layer CTA compliance", () => {
  test.each(tileFiles.filter((f) => !EXEMPT.has(f)))(
    "%s imports TileDeepLink (has a discrete Layer-2 control)",
    (file) => {
      const src = fs.readFileSync(path.join(TILES_DIR, file), "utf8");
      expect(src).toMatch(/TileDeepLink/);
    }
  );
});
```

- [ ] **Step 2: Run the test — expect PASS**

Run: `cd frontend/webapp && CI=true npx react-scripts test twoLayerCompliance --watchAll=false`
Expected: PASS — every non-exempt tile now imports `TileDeepLink`. If a tile fails, either it genuinely lacks a deeplink (add one) or it is a deliberate exception (add to `EXEMPT` with a comment explaining why).

- [ ] **Step 3: Run the FULL tile suite — regression check**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/Home/tiles --watchAll=false`
Expected: PASS — all `_ds` tests, all tile tests, and the compliance invariant green. Note any pre-existing unrelated failures (per prior sessions there can be a handful of unrelated frontend test failures; confirm none are in `Home/tiles`).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/__tests__/twoLayerCompliance.test.js
git commit -m "test(tiles): folder-wide two-layer CTA compliance invariant"
```

---

## Task 15: Manual verification on dev

Automated tests can't see layout. Verify the gating and visuals in a real browser against `localhost:8200` (NOT `bom.kckern.net` — Cloudflare serves a stale edge bundle; see CLAUDE.md).

- [ ] **Step 1:** `systemctl --user restart bom-dev` (KC has authorized bouncing dev at will), then load `http://localhost:8200`.
- [ ] **Step 2:** Scroll the Home sampler. For a prose tile (Commentary, Contents, Person/Place profile, History, Witness, Community): confirm the deeplink pill is **absent** until you click read-more/"more", then appears.
- [ ] **Step 3:** For modal/interactive tiles (Chiasmus, BiblePhrases, Notes, ImageArt, MapStory, Map, Text, Narration, Fax, FaxVerse): confirm the deeplink pill is present (always) and looks identical to before.
- [ ] **Step 4:** Confirm History and Witness cards still navigate from their title/portrait and that the expanded lead/quote reflow correctly.
- [ ] **Step 5:** Keyboard check: Tab to a read-more pill and a deeplink pill; both should be focusable and activate with Enter/Space (they are now real `<button>`/`<a>`).

---

## Self-Review

**Spec coverage** (against the audit `docs/audits/2026-08-05-home-tiles-two-layer-cta-audit.md`):
- Missing Layer 1 → **HistoryTile** (Task 9), **WitnessTile** (Task 10) get a real expand; **CommunityTile** (Task 11) intentionally keeps its live activity as Layer-0 glance + always-on deeplink (product decision — a live hub shouldn't hide state behind a click). ✓
- Missing discrete Layer 2 → Contents (7), Person/Place profile (8), History (9), Witness (10), Community (11), Text/Narration/Fax/FaxVerse (12). ✓
- Missing sequencing (L2 after L1) → the `RevealProvider`/`useReveal`/`TileDeepLink` gating, applied to every prose-expand tile. ✓
- Reference tile already compliant → CommentaryTile gated (Task 6). ✓
- Documented exceptions → People/Places (view-all card as Layer 2), covered by the `EXEMPT` set in Task 14. ✓
- Reusable abstractions → `Reveal.js`, `TileCTA.js`, `TileDeepLink.js`, reveal-aware `ExpandableText` (Tasks 1-4). ✓
- A11y gaps (role="button" no-keyboard) → `TileCTA` renders real buttons; read-more sites migrated. (Scripture-ref spans in Fax/Notes/Commentary are a separate concern — noted, not in scope here.)

**Type/name consistency:** `RevealProvider`/`useReveal` (Task 1) used identically in Tasks 4, 6, 11. `TileCTA` props `variant`/`to`/`onClick` consistent in Tasks 2, 4, 6, 11. `TileDeepLink` props `to`/`always`/`children`/`className` consistent in Tasks 3, 5, 7-12. Import path `./_ds/...` (from tile files) vs `../Reveal`/`../TileCTA` (from `_ds/__tests__`) used consistently.

**Placeholder scan:** none — every step shows concrete code or an exact command.

**Product decisions resolved with KC (2026-08-05):** (a) CommunityTile keeps its live activity visible with an always-on deeplink — no gating (Task 11 simplified accordingly); (b) ReadingPlanTile is left as-is and stays exempt from the compliance invariant.

**Revisions after adversarial (grouchy) pre-implementation review — all applied:**
1. **Gate design reworked** — the `Reveal` context now carries a `gated` flag set by `registerGate()`, and `TileDeepLink` hides only while `gated && !revealed`. This fixes the fatal trap where a non-truncating (short-prose) tile — Contents/Person/Place/History/Witness — would have hidden its deeplink *forever*. Short prose never gates → deeplink shows immediately. (Tasks 1, 3, 4, 6.)
2. **ATV commentary** — the same `registerGate()`-only-when-truncated rule means ATV tiles never gate, so their deeplink is preserved (was silently dropped). (Task 6.)
3. **Task 10 line range** corrected to 61-96 (the old fix re-declared `const quote/source/to` → syntax error).
4. **NotesTile orphaned `Link` import** now removed in Task 5 (was a `CI=true` build error).
5. **Tasks 7/8/10 tests** rewritten from trivially-passing stubs into real stub→expand→assert RED/GREEN, so the suite can actually catch findings 1-2.
6. **Task 14** now exempts `ReadingPlanTile`/`ReadingProgressTile` (would have failed the invariant); duplicate `textUtils.js` removed.
7. **History/Witness CSS** hand-waves dropped — the reviewer confirmed `.witnessFeatured`/`.witnessStatement` already handle the anchor→div swap, and the proposed `.historyTitle` CSS was dead/harmful; History's thumbnail is now wrapped in a `<Link>` so it isn't an orphaned click-dead zone.

The reviewer separately confirmed (against installed `@testing-library/dom@7.31.2`) that the `name: (n, el) => …` callback receives the element and works, the jsdom `scrollHeight`/`clientHeight` stubs correctly force truncation, and there is no hook-order bug from `RevealProvider` placement.
