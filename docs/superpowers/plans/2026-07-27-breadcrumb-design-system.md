# Breadcrumb Design-System Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five hand-rolled breadcrumb implementations with one reusable, extensible compound `<Breadcrumb>` component family, then migrate every existing usage to it.

**Architecture:** A compound-component family in `src/views/_Common/Breadcrumb/`. A container `<Breadcrumb>` renders an `items` shorthand OR composed children, auto-inserts separators between segments, and applies a `--bc-*` CSS-custom-property token layer. Segment building blocks: `.Root` (optional far-left icon), `.Link`, `.Current`, `.Dropdown`. The `.Dropdown` owns the interactive machinery (open/close, click-outside, Escape, desktop-panel-vs-mobile-`Drawer`, chevron, aria), built on an exported `useBreadcrumbDropdown()` hook; its children are a content slot accepting a node or a `({ close }) => node` render prop.

**Tech Stack:** React 17 (function components + hooks), react-router-dom v5 `<Link>`, `react-modern-drawer`, CRA Jest + React Testing Library 11, plain paired CSS. Module alias `src/*` → `<rootDir>/src/*` (jest `moduleNameMapper`). i18n via `label()` and mobile detection via `isMobile()`, both from `src/models/Utils`.

**Working directory for all commands:** `/home/bom/BookofMormonOnline/frontend/webapp`

**Run a single test file:** `CI=true npx react-scripts test <path> --watchAll=false`

---

## File Structure

**Create:**
- `src/views/_Common/Breadcrumb/Breadcrumb.jsx` — the component family + `useBreadcrumbDropdown` hook.
- `src/views/_Common/Breadcrumb/Breadcrumb.css` — shared styling + `--bc-*` tokens.
- `src/views/_Common/Breadcrumb/Breadcrumb.test.jsx` — behavior tests.
- `docs/reference/breadcrumb-component.md` — API + token reference (evergreen).

**Modify (migrations):**
- `src/views/_Common/StudyBreadcrumb.jsx` — delegate to `<Breadcrumb>`.
- `src/views/Home/tiles/NarrationTile.js` — use `<Breadcrumb items>`.
- `src/views/Analysis/Bible/Reader.jsx` + `AnchorView.jsx` — use `<Breadcrumb>`.
- `src/views/History/Witnesses.js` — use `<Breadcrumb>` + `.Dropdown`.
- `src/views/Facsimiles/FaxBreadcrumbs.jsx` — use `<Breadcrumb>` + `.Dropdown`.
- CSS cleanups: `Facsimiles.scss`, `Witnesses.css`, `crossref.css`, `Sampler.css`, `FacsimilePageViewer.scss`.

---

## Task 1: Breadcrumb container + Root/Link/Current segments

**Files:**
- Create: `src/views/_Common/Breadcrumb/Breadcrumb.jsx`
- Test: `src/views/_Common/Breadcrumb/Breadcrumb.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/views/_Common/Breadcrumb/Breadcrumb.test.jsx`:

```jsx
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";

jest.mock("src/models/Utils", () => ({
  label: (key) => key,
  isMobile: jest.fn(() => false),
}));

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Breadcrumb — trail", () => {
  test("items shorthand renders segments with a separator between them", () => {
    const { container } = wrap(
      <Breadcrumb items={[{ label: "Alma", to: "/alma" }, { label: "War Chapters", current: true }]} />
    );
    expect(screen.getByText("Alma")).toBeInTheDocument();
    expect(screen.getByText("War Chapters")).toBeInTheDocument();
    expect(container.querySelectorAll(".bc-sep")).toHaveLength(1);
  });

  test("current item is non-interactive with aria-current, linked item is a link", () => {
    wrap(<Breadcrumb items={[{ label: "Alma", to: "/alma" }, { label: "War Chapters", current: true }]} />);
    expect(screen.getByText("Alma").closest("a")).toHaveAttribute("href", "/alma");
    expect(screen.getByText("War Chapters")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("War Chapters").closest("a")).toBeNull();
  });

  test("Breadcrumb.Link renders a Link for `to` and a button for `onClick`", () => {
    const onClick = jest.fn();
    wrap(
      <Breadcrumb>
        <Breadcrumb.Link to="/history">History</Breadcrumb.Link>
        <Breadcrumb.Link onClick={onClick}>Back</Breadcrumb.Link>
      </Breadcrumb>
    );
    expect(screen.getByText("History").closest("a")).toHaveAttribute("href", "/history");
    const btn = screen.getByText("Back");
    expect(btn.tagName).toBe("BUTTON");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("root prop renders an icon segment first, linkable, with a separator after it", () => {
    const { container } = wrap(
      <Breadcrumb
        root={{ icon: <svg data-testid="home-svg" />, to: "/", "aria-label": "Home" }}
        items={[{ label: "History", to: "/history" }]}
      />
    );
    const root = container.querySelector(".bc-root");
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("href", "/");
    expect(root).toHaveAttribute("aria-label", "Home");
    expect(screen.getByTestId("home-svg")).toBeInTheDocument();
    // root + one item => exactly one separator between them
    expect(container.querySelectorAll(".bc-sep")).toHaveLength(1);
    // root is the first rendered child of the nav
    expect(container.querySelector("nav").firstChild).toBe(root);
  });

  test("size prop applies the size class", () => {
    const { container } = wrap(<Breadcrumb size="sm" items={[{ label: "A", to: "/a" }]} />);
    expect(container.querySelector(".breadcrumb")).toHaveClass("bc-size-sm");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/views/_Common/Breadcrumb/Breadcrumb.test.jsx --watchAll=false`
Expected: FAIL — `Cannot find module './Breadcrumb'`.

- [ ] **Step 3: Write the component (container + Root/Link/Current only)**

Create `src/views/_Common/Breadcrumb/Breadcrumb.jsx`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import "./Breadcrumb.css";

/**
 * Breadcrumb — reusable hierarchy trail for the whole app.
 *
 * Two ways to use it:
 *   1. Shorthand:  <Breadcrumb items={[{ label, to?, onClick?, current?, key? }]} />
 *   2. Composed:   <Breadcrumb><Breadcrumb.Link/>…<Breadcrumb.Dropdown/></Breadcrumb>
 *
 * The container auto-inserts a separator (default "›") between every rendered
 * segment, including after an optional far-left root icon.
 *
 * Props:
 *  - items?:     shorthand trail. An item renders as a Link when it has `to`/`onClick`,
 *                otherwise (or when `current:true`) as non-interactive current text.
 *  - children?:  composed segments (use instead of `items`).
 *  - separator?: node between segments. Default "›".
 *  - size?:      "sm" (0.72rem) | "md" (0.9rem, default).
 *  - root?:      { icon, to?, onClick?, label?, 'aria-label'? } optional far-left segment.
 *  - className?, aria-label? (default "Breadcrumb").
 */
export default function Breadcrumb({
  items,
  children,
  separator = "›",
  size = "md",
  root,
  className = "",
  "aria-label": ariaLabel = "Breadcrumb",
  ...rest
}) {
  const segments = [];

  if (root) {
    segments.push(
      <Breadcrumb.Root
        key="__root"
        icon={root.icon}
        label={root.label}
        to={root.to}
        onClick={root.onClick}
        aria-label={root["aria-label"]}
      />
    );
  }

  if (items && items.length) {
    items.forEach((it, i) => {
      const key = it.key != null ? it.key : `item-${i}`;
      if (it.current) {
        segments.push(<Breadcrumb.Current key={key}>{it.label}</Breadcrumb.Current>);
      } else if (it.to || it.onClick) {
        segments.push(
          <Breadcrumb.Link key={key} to={it.to} onClick={it.onClick}>
            {it.label}
          </Breadcrumb.Link>
        );
      } else {
        // Non-link, non-current items are plain muted text — NOT aria-current
        // (only `current: true` marks the current page).
        segments.push(<span className="bc-text" key={key}>{it.label}</span>);
      }
    });
  } else if (children) {
    React.Children.toArray(children).forEach((child) => segments.push(child));
  }

  const withSeps = [];
  segments.forEach((seg, i) => {
    if (i > 0) {
      withSeps.push(
        <span className="bc-sep" aria-hidden="true" key={`sep-${i}`}>
          {separator}
        </span>
      );
    }
    withSeps.push(seg);
  });

  return (
    <nav className={`breadcrumb bc-size-${size} ${className}`.trim()} aria-label={ariaLabel} {...rest}>
      {withSeps}
    </nav>
  );
}

Breadcrumb.Root = function BreadcrumbRoot({ icon, label, to, onClick, className = "", ...rest }) {
  const cls = `bc-root ${className}`.trim();
  const inner = (
    <>
      {icon}
      {label ? <span className="bc-root-label">{label}</span> : null}
    </>
  );
  if (to) return <Link to={to} className={cls} onClick={onClick} {...rest}>{inner}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} {...rest}>{inner}</button>;
  return <span className={cls} {...rest}>{inner}</span>;
};

Breadcrumb.Link = function BreadcrumbLink({ to, onClick, className = "", children, ...rest }) {
  const cls = `bc-link ${className}`.trim();
  if (to) return <Link to={to} className={cls} onClick={onClick} {...rest}>{children}</Link>;
  return <button type="button" className={cls} onClick={onClick} {...rest}>{children}</button>;
};

Breadcrumb.Current = function BreadcrumbCurrent({ className = "", children, ...rest }) {
  return (
    <span className={`bc-current ${className}`.trim()} aria-current="page" {...rest}>
      {children}
    </span>
  );
};
```

- [ ] **Step 4: Create a minimal stylesheet so the CSS import resolves**

Create `src/views/_Common/Breadcrumb/Breadcrumb.css` with a placeholder body (Task 3 fills it out):

```css
/* Breadcrumb tokens + styling — see Task 3. */
.breadcrumb { display: flex; align-items: center; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/views/_Common/Breadcrumb/Breadcrumb.test.jsx --watchAll=false`
Expected: PASS (all trail/root/size tests green).

- [ ] **Step 6: Commit**

```bash
git add src/views/_Common/Breadcrumb/Breadcrumb.jsx src/views/_Common/Breadcrumb/Breadcrumb.css src/views/_Common/Breadcrumb/Breadcrumb.test.jsx
git commit -m "feat(breadcrumb): container + Root/Link/Current segments"
```

---

## Task 2: `useBreadcrumbDropdown` hook + `Breadcrumb.Dropdown`

**Files:**
- Modify: `src/views/_Common/Breadcrumb/Breadcrumb.jsx`
- Modify: `src/views/_Common/Breadcrumb/Breadcrumb.test.jsx`

- [ ] **Step 1: Add the failing tests**

First, add `isMobile` to the existing top-of-file import so the mobile case can drive the mock (keep it with the other imports — not mid-file — to satisfy `import/first`):

```jsx
import { isMobile } from "src/models/Utils";
```

Then append this `describe` block to `Breadcrumb.test.jsx` (below the existing one):

```jsx
describe("Breadcrumb.Dropdown", () => {
  beforeEach(() => isMobile.mockReturnValue(false));

  const Grid = ({ onPick }) => (
    <button type="button" onClick={onPick}>Pick me</button>
  );

  test("toggles open on trigger click and shows slotted content", () => {
    wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="David Whitmer"><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    const trigger = screen.getByRole("button", { name: /David Whitmer/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Pick me")).toBeInTheDocument();
  });

  test("closes on outside click and on Escape, firing onOpenChange", () => {
    const onOpenChange = jest.fn();
    wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu" onOpenChange={onOpenChange}><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    const trigger = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText("Pick me")).toBeNull();

    fireEvent.click(trigger); // reopen
    fireEvent.mouseDown(document.body); // outside click
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  test("render-prop children receive `close` that dismisses the dropdown", () => {
    wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu">
          {({ close }) => <button type="button" onClick={close}>Choose</button>}
        </Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    fireEvent.click(screen.getByText("Choose"));
    expect(screen.queryByText("Choose")).toBeNull();
  });

  test("controlled mode reflects the `open` prop", () => {
    const { rerender } = wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu" open={false} onOpenChange={() => {}}><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    expect(screen.queryByText("Pick me")).toBeNull();
    rerender(
      <MemoryRouter>
        <Breadcrumb>
          <Breadcrumb.Dropdown label="Menu" open onOpenChange={() => {}}><Grid /></Breadcrumb.Dropdown>
        </Breadcrumb>
      </MemoryRouter>
    );
    expect(screen.getByText("Pick me")).toBeInTheDocument();
  });

  test("mobileDrawer renders the Drawer instead of the inline panel when mobile", () => {
    isMobile.mockReturnValue(true);
    const { container } = wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu" mobileDrawer><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    expect(container.querySelector(".bc-dropdown")).toBeNull(); // no inline panel
    expect(screen.getByText("Pick me")).toBeInTheDocument(); // drawer content present
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test src/views/_Common/Breadcrumb/Breadcrumb.test.jsx --watchAll=false`
Expected: FAIL — `Breadcrumb.Dropdown is not a function` / undefined.

- [ ] **Step 3: Add the hook + Dropdown to `Breadcrumb.jsx`**

Add these imports at the top of `Breadcrumb.jsx`, replacing the existing React import line:

```jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Drawer from "react-modern-drawer";
import "react-modern-drawer/dist/index.css";
import { isMobile } from "src/models/Utils";
import "./Breadcrumb.css";
```

Then append to the bottom of the file:

```jsx
/**
 * useBreadcrumbDropdown — the open/close/click-outside/Escape machinery behind
 * Breadcrumb.Dropdown, exported as an escape hatch for fully custom markup.
 *
 * Controlled via { open, onOpenChange }; uncontrolled via { defaultOpen }.
 * When { mobileDrawer } and isMobile(), only Escape is wired (the Drawer owns
 * its own overlay/outside handling). Attach `ref` to the trigger+panel wrapper.
 */
export function useBreadcrumbDropdown({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  onClose,
  mobileDrawer = false,
} = {}) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const ref = useRef(null);

  const setOpen = useCallback(
    (next) => {
      if (!isControlled) setUncontrolledOpen(next);
      if (onOpenChange) onOpenChange(next);
      if (!next && onClose) onClose();
    },
    [isControlled, onOpenChange, onClose]
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        close();
      }
    };
    // On the mobile drawer, the drawer's own overlay handles dismissal — wiring a
    // document mousedown handler here would fight it. Only wire Escape.
    if (mobileDrawer && isMobile()) {
      document.addEventListener("keydown", onKey, true);
      return () => document.removeEventListener("keydown", onKey, true);
    }
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close, mobileDrawer]);

  return { open, toggle: () => setOpen(!open), close, setOpen, ref };
}

/**
 * Breadcrumb.Dropdown — interactive terminal segment. Owns the dropdown/drawer
 * machinery; its children are the content slot (a node, or ({close}) => node).
 *
 * Props: label, open?/onOpenChange? (controlled) | defaultOpen?, onClose?,
 * mobileDrawer?, drawerProps?, chevron? (default "▾"), className, children.
 */
Breadcrumb.Dropdown = function BreadcrumbDropdown({
  label,
  open,
  defaultOpen,
  onOpenChange,
  onClose,
  mobileDrawer = false,
  drawerProps = {},
  chevron = "▾",
  className = "",
  children,
  ...rest
}) {
  const dd = useBreadcrumbDropdown({ open, defaultOpen, onOpenChange, onClose, mobileDrawer });
  const content = typeof children === "function" ? children({ close: dd.close }) : children;
  const mobile = mobileDrawer && isMobile();

  return (
    <span className="bc-dropdown-wrap" ref={dd.ref}>
      <button
        type="button"
        className={`bc-current bc-trigger${dd.open ? " open" : ""} ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={dd.open}
        onClick={dd.toggle}
        {...rest}
      >
        {label}
        <span className="bc-chevron" aria-hidden="true">{chevron}</span>
      </button>
      {mobile ? (
        <Drawer open={dd.open} direction="right" size="85vw" onClose={dd.close} {...drawerProps}>
          {content}
        </Drawer>
      ) : (
        dd.open && (
          <div className="bc-dropdown" role="listbox">
            {content}
          </div>
        )
      )}
    </span>
  );
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx react-scripts test src/views/_Common/Breadcrumb/Breadcrumb.test.jsx --watchAll=false`
Expected: PASS (all dropdown tests green, plus Task 1 tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/Breadcrumb/Breadcrumb.jsx src/views/_Common/Breadcrumb/Breadcrumb.test.jsx
git commit -m "feat(breadcrumb): Dropdown segment + useBreadcrumbDropdown hook"
```

---

## Task 3: Canonical styling + `--bc-*` token layer

**Files:**
- Modify: `src/views/_Common/Breadcrumb/Breadcrumb.css`

- [ ] **Step 1: Replace `Breadcrumb.css` with the full stylesheet**

```css
/* Breadcrumb — shared design-system component.
   Tokens live on .breadcrumb and are remapped once for dark mode; a variant or
   one-off theme overrides a --bc-* variable instead of forking these rules. */
.breadcrumb {
  --bc-link: #555;
  --bc-link-hover: #323b4d;
  --bc-sep: #bbb;
  --bc-current: #111;
  --bc-root: #777;
  --bc-gap: 0.3em;
  --bc-size: 0.9rem;

  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--bc-gap);
  font-size: var(--bc-size);
  line-height: 1.4;
}
.breadcrumb.bc-size-sm { --bc-size: 0.72rem; }

html[data-theme="dark"] .breadcrumb {
  --bc-link: #bbb;
  --bc-link-hover: #fff;
  --bc-sep: #666;
  --bc-current: #fff;
  --bc-root: #999;
}

.bc-sep { color: var(--bc-sep); user-select: none; }

.bc-link {
  color: var(--bc-link);
  text-decoration: none;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
.bc-link:hover { color: var(--bc-link-hover); text-decoration: underline; }

.bc-current { color: var(--bc-current); font-weight: 600; }

.bc-text { color: var(--bc-link); }

.bc-root {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  color: var(--bc-root);
  text-decoration: none;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.bc-root:hover { color: var(--bc-link-hover); }
.bc-root svg { width: 1.05em; height: 1.05em; }

.bc-dropdown-wrap { position: relative; display: inline-flex; align-items: center; }

.bc-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.2em;
  padding: 0.05em 0.25em;
  border-radius: 4px;
  color: var(--bc-current);
  font-weight: 600;
  background: none;
  border: 0;
  font: inherit;
  cursor: pointer;
}
.bc-trigger:hover { background: rgba(0, 0, 0, 0.05); }
html[data-theme="dark"] .bc-trigger:hover { background: rgba(255, 255, 255, 0.08); }

.bc-chevron { font-size: 0.7em; transition: transform 0.15s ease; }
.bc-trigger.open .bc-chevron { transform: rotate(180deg); }

.bc-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 50;
  margin-top: 0.35em;
  max-height: 62vh;
  overflow: auto;
  padding: 0.5em;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}
html[data-theme="dark"] .bc-dropdown {
  background: #262626;
  border-color: #3a3a3a;
}
```

- [ ] **Step 2: Re-run the component tests (guard against CSS-class regressions)**

Run: `CI=true npx react-scripts test src/views/_Common/Breadcrumb/Breadcrumb.test.jsx --watchAll=false`
Expected: PASS (unchanged — CSS is not asserted on beyond class names already covered).

- [ ] **Step 3: Commit**

```bash
git add src/views/_Common/Breadcrumb/Breadcrumb.css
git commit -m "style(breadcrumb): canonical styling + --bc-* token layer"
```

---

## Task 4: Migrate `StudyBreadcrumb` to delegate (2 call sites unchanged)

`StudyBreadcrumb` keeps its exact public API (`page`, `section`, `linked`, `className`) so its two call sites — `FaxVerseCutout.jsx:96` and `FaxVerseModal.jsx:140` — do not change. Internally it now builds a `<Breadcrumb items size="sm">`. The separator changes from `▸` to `›` (standardized).

**Files:**
- Modify: `src/views/_Common/StudyBreadcrumb.jsx`
- Modify: `src/views/Facsimiles/FacsimilePageViewer.scss` (remove dead `.sb-*`/`.studyBreadcrumb` rules)

- [ ] **Step 1: Replace `StudyBreadcrumb.jsx`**

```jsx
import React from "react";
import Breadcrumb from "./Breadcrumb/Breadcrumb";

/**
 * "Page › Section" study-location breadcrumb — the pattern used in the feed's
 * scripture panel, reused by the fax verse tooltip/modal. Thin adapter over the
 * shared <Breadcrumb> component (size="sm").
 *
 * Props:
 *  - page/section: { title, slug } (either may be null)
 *  - linked: render each part as a Link to `/{slug}` in the study view
 */
export default function StudyBreadcrumb({ page, section, linked = false, className = "" }) {
  if (!page?.title && !section?.title) return null;

  const items = [];
  const push = (ref) => {
    if (!ref?.title) return;
    items.push({ label: ref.title, to: linked && ref.slug ? `/${ref.slug}` : undefined });
  };
  push(page);
  push(section);

  return <Breadcrumb size="sm" items={items} className={`studyBreadcrumb ${className}`.trim()} />;
}
```

- [ ] **Step 2: Verify the two call sites compile unchanged**

Run: `grep -n "StudyBreadcrumb" src/views/Facsimiles/FaxVerseCutout.jsx src/views/Facsimiles/FaxVerseModal.jsx`
Expected: two matches, prop usage `page={…} section={…}` (and `linked` on the modal) — unchanged. No edits needed here.

- [ ] **Step 3: Remove the now-dead `.sb-*` / `.studyBreadcrumb` CSS**

Run: `grep -n "studyBreadcrumb\|sb-page\|sb-section\|sb-sep" src/views/Facsimiles/FacsimilePageViewer.scss`
Delete the matched rule blocks (the old `▸`-separator styling is superseded by `Breadcrumb.css`). Leave the surrounding `.faxVerseTooltip-loc` / `.faxVerseModal-loc` wrappers intact.

- [ ] **Step 4: Run the full frontend test suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS (no test references `.sb-*`; Breadcrumb tests green).

- [ ] **Step 5: Manual parity check**

Start dev if needed (`systemctl --user status bom-dev`), open `http://localhost:8200`, open a fax verse tooltip and the verse modal. Confirm the `Page › Section` trail renders (now with `›`), and that `linked` in the modal still navigates. Check dark mode.

- [ ] **Step 6: Commit**

```bash
git add src/views/_Common/StudyBreadcrumb.jsx src/views/Facsimiles/FacsimilePageViewer.scss
git commit -m "refactor(breadcrumb): StudyBreadcrumb delegates to shared Breadcrumb"
```

---

## Task 5: Migrate `NarrationTile`

**Files:**
- Modify: `src/views/Home/tiles/NarrationTile.js`
- Modify: `src/views/Home/Sampler.css` (remove `.narrationCrumbs` / `.narrationCrumbSep`)

- [ ] **Step 1: Add the import**

At the top of `NarrationTile.js`, after the existing imports, add:

```jsx
import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
```

- [ ] **Step 2: Replace the `narrationCrumbs` block**

Replace lines 59-67 (the `<div className="narrationCrumbs">…</div>`) with:

```jsx
      <Breadcrumb
        size="sm"
        className="narrationCrumbs"
        items={[
          ...(data.page?.title ? [{ label: data.page.title, to: `/${data.page.slug}` }] : []),
          { label: data.title, to: `/${data.slug}` },
        ]}
      />
```

Note: the final segment keeps its link (it has `to`), matching current behavior where the title is a `<Link>`. The `narrationTileTitle` class is dropped; if its styling matters, verify against Sampler.css in the next step.

- [ ] **Step 3: Reconcile CSS**

Run: `grep -n "narrationCrumbs\|narrationCrumbSep\|narrationTileTitle" src/views/Home/Sampler.css`
Delete `.narrationCrumbs`/`.narrationCrumbSep` rules that only styled the old separator/links (now handled by `Breadcrumb.css`). If `.narrationCrumbs` carries layout (margins/spacing) unique to the tile, KEEP those declarations (the `className="narrationCrumbs"` is still applied to the `<nav>`). If `.narrationTileTitle` set a distinct weight/color for the title, either drop it (title now uses `--bc-link`) or move that rule to target `.narrationCrumbs .bc-link:last-child`.

- [ ] **Step 4: Run the suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Manual parity check**

`http://localhost:8200` home/sampler feed → a Narration tile shows `Page › Section-title`, both links work, `sm` size matches the old look. Check dark mode.

- [ ] **Step 6: Commit**

```bash
git add src/views/Home/tiles/NarrationTile.js src/views/Home/Sampler.css
git commit -m "refactor(breadcrumb): NarrationTile uses shared Breadcrumb"
```

---

## Task 6: Migrate the Bible cross-reference breadcrumbs

Both `ReaderHeader` (`Reader.jsx`) and `AnchorView.jsx` render `⌂ Overview › …`. Migrate the `⌂ Overview` into the `root` segment (icon `⌂` + label `Overview`, linking to `/analysis/bible`). **Intentional visual change:** links unify to the standard `--bc-link` grey instead of the old `--link` blue (#345496). To preserve the blue accent on these instances, add `style={{ "--bc-link": "#345496" }}` to the `<Breadcrumb>` — decide during the parity check.

**Files:**
- Modify: `src/views/Analysis/Bible/Reader.jsx`
- Modify: `src/views/Analysis/Bible/AnchorView.jsx`
- Modify: `src/views/Analysis/Bible/crossref.css` (remove `.xref-breadcrumb` rules)

- [ ] **Step 1: Import Breadcrumb in both files**

Add to the top imports of `Reader.jsx` and `AnchorView.jsx`:

```jsx
import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
```

- [ ] **Step 2: Replace the `xref-breadcrumb` nav in `Reader.jsx`**

Replace lines 213-222 (the `<nav className="xref-breadcrumb">…</nav>`) with:

```jsx
      <Breadcrumb root={{ icon: "⌂", label: "Overview", to: "/analysis/bible" }}>
        <Breadcrumb.Link onClick={() => navigate(backState)}>
          {anchorBook}
          {anchorCanon === "bom" && bomChapter ? ` › ch. ${bomChapter}` : ""}
        </Breadcrumb.Link>
        <Breadcrumb.Current>{bomBook} × {bibleBook}</Breadcrumb.Current>
      </Breadcrumb>
```

- [ ] **Step 3: Replace the `xref-breadcrumb` nav in `AnchorView.jsx`**

Replace lines 41-45 with:

```jsx
        <Breadcrumb root={{ icon: "⌂", label: "Overview", to: "/analysis/bible" }}>
          <Breadcrumb.Current>{book}</Breadcrumb.Current>
        </Breadcrumb>
```

- [ ] **Step 4: Remove dead CSS**

Run: `grep -n "xref-breadcrumb\|xref-backlink" src/views/Analysis/Bible/crossref.css`
Delete the `.xref-breadcrumb`, `.xref-breadcrumb a`, and `.xref-backlink` rule blocks (styling now comes from `Breadcrumb.css`). Keep `.xref-header`, `.xref-readertitle`, `.xref-readercount`, `.xref-flip`.

- [ ] **Step 5: Run the suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS. (`AnchorView` has a `data-testid="xref-anchor"` but no existing test asserts the breadcrumb markup; if `crossref`-related tests exist they should still pass.)

- [ ] **Step 6: Manual parity check**

`http://localhost:8200/analysis/bible/bom/2-nephi` and a reader view. Confirm `⌂ Overview › {book} › {current}` renders, the `⌂ Overview` root links to the overview, the middle backlink button still calls `navigate(backState)`, and decide on the blue-accent override. Check dark mode.

- [ ] **Step 7: Commit**

```bash
git add src/views/Analysis/Bible/Reader.jsx src/views/Analysis/Bible/AnchorView.jsx src/views/Analysis/Bible/crossref.css
git commit -m "refactor(breadcrumb): Bible xref breadcrumbs use shared Breadcrumb + root icon"
```

---

## Task 7: Migrate `WitnessBreadcrumbs`

The witness dropdown content (grouped avatar grid) stays as a small local component and is slotted into `Breadcrumb.Dropdown` via the render-prop form so option clicks close the menu. All the open/close/Escape/outside-click machinery is deleted (now owned by the shared component).

**Files:**
- Modify: `src/views/History/Witnesses.js`
- Modify: `src/views/History/Witnesses.css` (remove `.witness-breadcrumbs` / `.breadcrumb-*`, keep the avatar-grid rules the slot still uses)

- [ ] **Step 1: Add the import**

At the top of `Witnesses.js`, add:

```jsx
import Breadcrumb from "../_Common/Breadcrumb/Breadcrumb";
```

- [ ] **Step 2: Replace the `WitnessBreadcrumbs` component (lines 65-132)**

```jsx
const WitnessGrid = ({ witness, onPick }) => (
    <div className='witness-grid'>
        {Object.keys(data).map(groupKey => (
            <div key={groupKey} className='witness-group'>
                <div className='witness-group-label'>{GROUP_LABELS[groupKey] || groupKey}</div>
                {data[groupKey].map(w => {
                    const isCurrent = w.slug === witness.slug;
                    return (
                        <Link
                            key={w.slug}
                            to={`/history/witnesses/${w.slug}`}
                            className={`witness-option${isCurrent ? ' current' : ''}`}
                            aria-current={isCurrent ? 'page' : undefined}
                            onClick={onPick}
                        >
                            <img
                                className='witness-avatar'
                                src={`${assetUrl}/history/witnesses/people/${w.slug}.jpg`}
                                alt=''
                                aria-hidden='true'
                                loading='lazy'
                                onError={(e) => { e.target.style.visibility = 'hidden'; }}
                            />
                            <span className='witness-option-name'>{w.name}</span>
                        </Link>
                    );
                })}
            </div>
        ))}
    </div>
);

const WitnessBreadcrumbs = ({ witness }) => (
    <Breadcrumb>
        <Breadcrumb.Link to='/history'>History</Breadcrumb.Link>
        <Breadcrumb.Link to='/history/witnesses'>Witnesses</Breadcrumb.Link>
        <Breadcrumb.Dropdown label={witness.name}>
            {({ close }) => <WitnessGrid witness={witness} onPick={close} />}
        </Breadcrumb.Dropdown>
    </Breadcrumb>
);
```

- [ ] **Step 3: Rename the dropdown-content CSS in `Witnesses.css`**

The old grid rules were keyed to `.breadcrumb-dropdown .breadcrumb-group` etc. Re-key the ones the slot still uses to the new class names introduced above, and delete the trail/machinery rules. Run:

`grep -n "witness-breadcrumbs\|breadcrumb-link\|breadcrumb-sep\|breadcrumb-current\|breadcrumb-chevron\|breadcrumb-dropdown\|breadcrumb-group\|breadcrumb-option\|breadcrumb-avatar" src/views/History/Witnesses.css`

- Delete: `.witness-breadcrumbs`, `.breadcrumb-link`, `.breadcrumb-sep`, `.breadcrumb-current`, `.breadcrumb-chevron`, `.breadcrumb-dropdown` (the panel chrome — now `.bc-dropdown`).
- Rename/keep the grid layout rules, retargeting selectors: `.breadcrumb-group` → `.witness-group`, `.breadcrumb-group-label` → `.witness-group-label`, `.breadcrumb-option` → `.witness-option`, `.breadcrumb-avatar` → `.witness-avatar`, `.breadcrumb-option-name` → `.witness-option-name`. Nest them under `.bc-dropdown` if they relied on the panel context (e.g. `.bc-dropdown .witness-grid { display: grid; grid-template-columns: repeat(3, minmax(160px, 1fr)); … }`).

- [ ] **Step 4: Run the suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Manual parity check**

`http://localhost:8200/history/witnesses/david-whitmer`. Confirm `History › Witnesses › David Whitmer ▾`, the dropdown opens, shows the grouped avatar grid, clicking a witness navigates AND closes the menu, Escape/outside-click close it, and the current witness is marked. Check dark mode + a narrow (mobile) width — note `WitnessBreadcrumbs` did not use a drawer before, so it stays an inline dropdown (no `mobileDrawer`).

- [ ] **Step 6: Commit**

```bash
git add src/views/History/Witnesses.js src/views/History/Witnesses.css
git commit -m "refactor(breadcrumb): Witnesses uses shared Breadcrumb + Dropdown"
```

---

## Task 8: Migrate `FaxBreadcrumbs`

The most involved case: edition-switcher dropdown with thumbnails AND a mobile `Drawer`. The `targetFor`/`optionList` logic stays; only the nav shell + open/close machinery is replaced by `<Breadcrumb>` + `<Breadcrumb.Dropdown mobileDrawer>`.

**Files:**
- Modify: `src/views/Facsimiles/FaxBreadcrumbs.jsx`
- Modify: `src/views/Facsimiles/Facsimiles.scss` (remove `.fax-breadcrumbs` / `.breadcrumb-*`, keep the thumbnail/grid rules the slot uses)

- [ ] **Step 1: Replace `FaxBreadcrumbs.jsx`**

```jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { assetUrl } from 'src/models/BoMOnlineAPI';
import { label } from 'src/models/Utils';
import { generateReference, lookupReference } from 'scripture-guide';
import Breadcrumb from 'src/views/_Common/Breadcrumb/Breadcrumb';

/**
 * FaxBreadcrumbs — `Facsimiles › [Edition ▾]` header with an edition-switcher.
 * Built on the shared <Breadcrumb> component; the edition list is slotted into
 * Breadcrumb.Dropdown (mobileDrawer), which owns open/close/Escape/outside-click
 * and the desktop-panel-vs-mobile-Drawer switch.
 *
 * Switching editions carries the current scripture reference into the target so
 * the reader stays on the same passage. Non-indexed editions fall back to root.
 *
 * Props:
 *  - editions: renderable edition objects ({ slug, title, pages })
 *  - current: the active edition object
 *  - currentRef: the current spread's scripture reference (null in grid mode)
 */
export default function FaxBreadcrumbs({ editions = [], current, currentRef }) {
  // Build the target path for an edition, carrying the current reference.
  const targetFor = (ed) => {
    if (currentRef) {
      try {
        const verseIds = lookupReference(currentRef)?.verse_ids || [];
        if (verseIds.length) {
          const minId = Math.min(...verseIds);
          const slugRef = generateReference([minId]).replace(/[ :]+/g, '.').toLowerCase();
          return `/fax/${ed.slug}/${slugRef}`;
        }
      } catch { /* fall through to the edition root */ }
    }
    return `/fax/${ed.slug}`;
  };

  const EditionList = ({ onPick }) => editions.map((ed) => {
    const isCurrent = ed.slug === current?.slug;
    const indexed = !!ed.indexRef;
    const inner = (
      <>
        <span className="fax-edition-thumb">
          <img
            className="fax-edition-avatar"
            src={`${assetUrl}/fax/covers/${ed.slug}`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={(e) => { e.target.style.visibility = 'hidden'; }}
          />
          {indexed && (
            <span className="fax-edition-index-flag has-index" title="Verse-level facsimile index" aria-label="Verse-indexed">¶</span>
          )}
        </span>
        <span className="fax-edition-name">{ed.title}</span>
      </>
    );
    return isCurrent ? (
      <div key={ed.slug} className="fax-edition-option current" role="option" aria-selected="true" aria-current="page">
        {inner}
      </div>
    ) : (
      <Link
        key={ed.slug}
        to={{ pathname: targetFor(ed), state: { faxPageOnly: true } }}
        className="fax-edition-option"
        role="option"
        aria-selected="false"
        onClick={onPick}
      >
        {inner}
      </Link>
    );
  });

  return (
    <Breadcrumb>
      <Breadcrumb.Link to="/fax">{label('menu_fax') || 'Facsimiles'}</Breadcrumb.Link>
      <Breadcrumb.Dropdown
        label={current?.title}
        mobileDrawer
        drawerProps={{ className: 'faxEditionDrawer' }}
      >
        {({ close }) => (
          <div className="fax-edition-list" role="listbox">
            <div className="faxEditionDrawer-head">{label('menu_fax') || 'Facsimiles'}</div>
            <EditionList onPick={close} />
          </div>
        )}
      </Breadcrumb.Dropdown>
    </Breadcrumb>
  );
}
```

Note: the desktop panel and the mobile drawer now share one `.fax-edition-list` slot. The old `faxEditionDrawer-head` label shows in both; if the head should be drawer-only, wrap it in a check — decide during parity.

- [ ] **Step 2: Reconcile `Facsimiles.scss`**

Run: `grep -n "fax-breadcrumbs\|breadcrumb-link\|breadcrumb-sep\|breadcrumb-current\|breadcrumb-chevron\|breadcrumb-dropdown\|breadcrumb-thumb\|breadcrumb-avatar\|breadcrumb-option\|breadcrumb-index-flag" src/views/Facsimiles/Facsimiles.scss`

- Delete the trail/machinery rules: `.fax-breadcrumbs`, `.breadcrumb-link`, `.breadcrumb-sep`, `.breadcrumb-current`, `.breadcrumb-chevron`, `.breadcrumb-dropdown` (panel chrome → now `.bc-dropdown`).
- Retarget the surviving thumbnail/grid rules to the new class names: `.breadcrumb-thumb` → `.fax-edition-thumb`, `.breadcrumb-avatar` → `.fax-edition-avatar`, `.breadcrumb-index-flag` → `.fax-edition-index-flag`, `.breadcrumb-option` → `.fax-edition-option`, `.breadcrumb-option-name` → `.fax-edition-name`. Scope the grid layout under `.bc-dropdown .fax-edition-list` (desktop) — the existing `.faxEditionDrawer` rules for the mobile drawer stay as-is.

- [ ] **Step 3: Run the suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS.

- [ ] **Step 4: Manual parity check (desktop + mobile)**

`http://localhost:8200/fax/1840`.
- Desktop: `Facsimiles › 1840 Edition ▾`, dropdown opens as an inline grid of edition thumbnails, the `¶` index flag shows on indexed editions, clicking an edition navigates carrying the reference AND closes, Escape/outside-click close, current edition marked.
- Narrow width: the dropdown becomes the right-side `Drawer` (85vw); selecting an edition closes it. Check dark mode.

- [ ] **Step 5: Commit**

```bash
git add src/views/Facsimiles/FaxBreadcrumbs.jsx src/views/Facsimiles/Facsimiles.scss
git commit -m "refactor(breadcrumb): FaxBreadcrumbs uses shared Breadcrumb + Dropdown (mobileDrawer)"
```

---

## Task 9: Documentation

**Files:**
- Create: `docs/reference/breadcrumb-component.md`

- [ ] **Step 1: Write the reference doc**

Create `docs/reference/breadcrumb-component.md`:

```markdown
# Breadcrumb component

Reusable hierarchy-trail component. Lives at
`frontend/webapp/src/views/_Common/Breadcrumb/Breadcrumb.jsx`.

## Usage

Shorthand (plain trails):

    <Breadcrumb items={[{ label: "Alma", to: "/alma" }, { label: "War Chapters", current: true }]} />

Composed (interactive / custom segments):

    <Breadcrumb root={{ icon: <HomeIcon/>, to: "/", "aria-label": "Home" }}>
      <Breadcrumb.Link to="/history">History</Breadcrumb.Link>
      <Breadcrumb.Dropdown label="David Whitmer" mobileDrawer={isMobile()}>
        {({ close }) => <WitnessGrid onPick={close} />}
      </Breadcrumb.Dropdown>
    </Breadcrumb>

## API

- **`<Breadcrumb>`** — `items?`, `children?`, `separator?` (default `›`), `size?`
  (`sm` | `md`), `root?` ({ icon, to?, onClick?, label?, 'aria-label'? }),
  `className?`, `aria-label?`. Auto-inserts separators between all segments.
- **`<Breadcrumb.Root>`** — optional far-left icon segment; `icon`, `to?`,
  `onClick?`, `label?`, `aria-label?`. Equivalent to the `root` prop.
- **`<Breadcrumb.Link>`** — `to` → router `<Link>`, else `onClick` → `<button>`.
- **`<Breadcrumb.Current>`** — terminal, `aria-current="page"`, not a link.
- **`<Breadcrumb.Dropdown>`** — interactive terminal segment. `label`,
  `open?`/`onOpenChange?` (controlled) or `defaultOpen?`, `onClose?`,
  `mobileDrawer?`, `drawerProps?`, `chevron?` (default `▾`), `children`
  (node or `({ close }) => node`). Owns open/close, click-outside, Escape,
  and the desktop-panel-vs-`react-modern-drawer` switch.
- **`useBreadcrumbDropdown(opts)`** — the same machinery as a hook, for fully
  headless custom markup. Returns `{ open, toggle, close, setOpen, ref }`.

## Tokens

Defined on `.breadcrumb`, remapped once under `html[data-theme="dark"]`.
Override a variable (e.g. `style={{ "--bc-link": "#345496" }}`) instead of
forking CSS.

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--bc-link` | #555 | #bbb | link text |
| `--bc-link-hover` | #323b4d | #fff | link/hover + root hover |
| `--bc-sep` | #bbb | #666 | separator |
| `--bc-current` | #111 | #fff | terminal/current + trigger |
| `--bc-root` | #777 | #999 | root icon |
| `--bc-gap` | 0.3em | — | segment spacing |
| `--bc-size` | 0.9rem (`sm` 0.72rem) | — | font size |

## Adding a new segment type

Add a `Breadcrumb.Foo = function BreadcrumbFoo(props){…}` to `Breadcrumb.jsx`
returning a single element with a `bc-foo` class. The container interleaves it
with separators automatically (it appears as one child in `React.Children`).
Style `.bc-foo` in `Breadcrumb.css` using the `--bc-*` tokens.

## Dropdown content

The dropdown's *content* (grids, avatars) is NOT owned by this component — each
caller passes its own child (e.g. Witnesses' `WitnessGrid`, Fax's edition list)
and styles it in its own CSS, scoped under `.bc-dropdown` for the desktop panel.
```

- [ ] **Step 2: Add a JSDoc completeness check**

Confirm `Breadcrumb.jsx` has JSDoc headers on `Breadcrumb`, `useBreadcrumbDropdown`, and `Breadcrumb.Dropdown` (added in Tasks 1-2). No code change if already present.

- [ ] **Step 3: Commit**

```bash
git add docs/reference/breadcrumb-component.md
git commit -m "docs(breadcrumb): API + token reference"
```

---

## Final verification

- [ ] **Full suite green:** `CI=true npx react-scripts test --watchAll=false` → PASS.
- [ ] **No stragglers:** `grep -rn "fax-breadcrumbs\|witness-breadcrumbs\|xref-breadcrumb\|narrationCrumbs\|studyBreadcrumb\|sb-page\|sb-sep\|breadcrumb-dropdown\|breadcrumb-current\|breadcrumb-chevron" src/` returns only intentional survivors (retained layout rules re-keyed to `.witness-*` / `.fax-edition-*`, and the `studyBreadcrumb` className passthrough). No orphaned `.breadcrumb-link`/`.breadcrumb-sep` rules remain.
- [ ] **Lint:** `npx eslint src/views/_Common/Breadcrumb/` → clean.
- [ ] **Manual sweep** on `http://localhost:8200` (NOT `bom.kckern.net` — CDN-cached bundle): `/fax/1840`, `/history/witnesses/david-whitmer`, `/analysis/bible/bom/2-nephi`, a home Narration tile, a fax verse modal — each in light and dark, one at a narrow width for the fax drawer.
```
