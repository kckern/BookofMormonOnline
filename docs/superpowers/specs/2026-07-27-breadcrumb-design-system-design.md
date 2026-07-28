# Breadcrumb Design-System Component — Design Spec

**Date:** 2026-07-27
**Status:** Approved (brainstorm) — pending implementation plan
**Scope:** Frontend CRA app only (`frontend/webapp/src/`). The Next.js app has no multi-segment breadcrumbs and is untouched.

## Problem

Breadcrumb-style navigation has been reinvented independently across the app. A codebase sweep found **six** variants, five of them real breadcrumbs plus one page that wants one:

| # | Variant | Location | Separator | Dropdown |
|---|---------|----------|-----------|----------|
| 1 | FaxBreadcrumbs | `views/Facsimiles/FaxBreadcrumbs.jsx` | `›` | yes (thumbnail grid + mobile Drawer) |
| 2 | WitnessBreadcrumbs | `views/History/Witnesses.js` | `›` | yes (grouped avatar grid) |
| 3 | XrefBreadcrumb | `views/Analysis/Bible/Reader.jsx` + `AnchorView.jsx` | `›` | no |
| 4 | StudyBreadcrumb | `views/_Common/StudyBreadcrumb.jsx` | `▸` | no |
| 5 | NarrationTile crumbs | `views/Home/tiles/NarrationTile.js` | `›` | no |
| 6 | Chiasm detail | `views/Analysis/Chiasmus/Chiasm.js` | (none) | — |

Fax (1) and Witnesses (2) are near-identical copy-paste — same class names (`breadcrumb-link`, `breadcrumb-sep`, `breadcrumb-current`, `breadcrumb-chevron`, `breadcrumb-dropdown`), same colors, same interactive machinery — differing only in the dropdown's *contents*. The duplicated machinery (open/close state, click-outside detection, desktop-dropdown-vs-mobile-`Drawer`, chevron, aria wiring) is the real cost.

## Goal

Formalize and extend the codebase's existing informal design system (tiles, page sections, the seed `StudyBreadcrumb`) with **one reusable, extensible breadcrumb component family**. Extensibility is a first-class requirement along three axes: configuration **props**, behavior **callbacks**, and content **JSX slots / render props**. The component owns the dropdown machinery but never boxes a caller in. The token layer it introduces doubles as the pattern the next formalized component copies.

## House conventions this must match

- Shared components live in `src/views/_Common/`; PascalCase; function components with hooks; paired plain `.css` (no CSS Modules, no styled-components); direct path imports (no `index` barrels).
- i18n via `label()` from `src/models/Utils`.
- Dark mode via `html[data-theme="dark"]` attribute overrides.
- Multi-part components already use a folder (`_Common/AppModal/`, `_Common/Study/`).
- Mobile Drawer uses `react-modern-drawer` (as FaxBreadcrumbs does today).

## Architecture — compound components

**Location:** `src/views/_Common/Breadcrumb/` containing `Breadcrumb.jsx` + `Breadcrumb.css`. Imported as `src/views/_Common/Breadcrumb`.

A parent `<Breadcrumb>` provides React context (separator, size) and auto-inserts separators between children. Three segment building blocks compose inside it. A plain `items` shorthand covers the non-dropdown cases without children.

```jsx
// Dropdown case (Witnesses), with an optional root icon
<Breadcrumb separator="›" size="md" root={{ icon: <HomeIcon/>, to: '/', 'aria-label': 'Home' }}>
  <Breadcrumb.Link to="/history">History</Breadcrumb.Link>
  <Breadcrumb.Link to="/history/witnesses">Witnesses</Breadcrumb.Link>
  <Breadcrumb.Dropdown label="David Whitmer" mobileDrawer={isMobile} onOpenChange={fn}>
    {({ close }) => <WitnessGrid onPick={close} />}
  </Breadcrumb.Dropdown>
</Breadcrumb>

// Plain shorthand (Narration / Xref / Chiasmus / StudyBreadcrumb)
<Breadcrumb items={[{ label: 'Alma', to: '/alma' }, { label: 'The War Chapters', current: true }]} />
```

### API surface

**`<Breadcrumb>`**
- `items?: Array<{ label, to?, onClick?, current?, key? }>` — shorthand trail; renders links + separators; the item with `current: true` (or the last item) renders as non-interactive current text. Mutually exclusive with `children`.
- `children?` — compound subcomponents (takes precedence when both provided; document as "use one or the other").
- `separator?: node` — default `›`.
- `size?: 'sm' | 'md'` — default `md` (0.9rem). `sm` = 0.72rem for inline/study contexts.
- `root?: { icon: node, to?: string, onClick?: fn, label?: node, 'aria-label'?: string }` — optional standalone root segment pinned far-left, followed by its own auto-inserted separator. Absent = no root (default). Icon-only by default; `label` renders text beside the icon. Linkable via `to`/`onClick` (same rules as `.Link`); non-interactive if neither given. Renders with class `bc-root`. Works with the `items` shorthand and the compound form alike. Equivalent compound form: `<Breadcrumb.Root icon to onClick label />` as the first child.
- `className?: string`, `aria-label?: string` — default `"Breadcrumb"`.
- Renders `<nav aria-label>`, supplies `separator`/`size` via context, inserts separators between rendered children (including after the root segment).

**`<Breadcrumb.Root>`** — optional standalone root segment (icon, optionally with a `label`), pinned first, followed by its own separator. `icon: node` (required), `to?` / `onClick?` (linkable, same rules as `.Link`), `label?: node`, `aria-label?`. Class `bc-root`. Must be the first child. Equivalent to the `root` prop on `<Breadcrumb>` — use whichever fits the call site (prop for `items` shorthand, subcomponent for compound children).

**`<Breadcrumb.Link>`** — a navigable segment. `to` → react-router `<Link>`; `onClick` (no `to`) → `<button type="button">`. Class `bc-link`. Passes through `aria-*`.

**`<Breadcrumb.Current>`** — terminal non-interactive segment, `aria-current="page"`, class `bc-current`. (The `items` shorthand emits this automatically for the current item.)

**`<Breadcrumb.Dropdown>`** — interactive terminal segment. Owns the machinery extracted from Fax + Witnesses.
- `label: node` — the trigger text.
- `open?: bool` + `onOpenChange?: (open) => void` — controlled mode. `defaultOpen?: bool` — uncontrolled mode.
- `onClose?: () => void` — fired on any close (outside-click, Escape, programmatic).
- `mobileDrawer?: bool` — when true, render `react-modern-drawer` instead of the inline panel. Caller passes its own `isMobile` boolean (matching how Fax computes it today); the component does not guess the breakpoint.
- `drawerProps?: object` — forwarded to `<Drawer>` (direction, size, className).
- `chevron?: node` — default `▾`; overridable.
- `children: node | (({ close }) => node)` — the content slot. Render-prop form receives `close` so option clicks dismiss the dropdown.
- Internals: open state, `wrapperRef` click-outside close, Escape-to-close, `aria-haspopup="listbox"` / `aria-expanded`, rotating chevron. Desktop → `<div className="bc-dropdown" role="listbox">`; mobile → `<Drawer>`.

**`useBreadcrumbDropdown(opts)`** — exported escape-hatch hook returning `{ open, toggle, close, ref, isMobileDrawer }` (the same open/close/click-outside/Escape logic), for a future exotic case that needs to go fully headless without re-implementing behavior. `Breadcrumb.Dropdown` is built on it.

## Styling & theming

One shared `Breadcrumb.css` replaces the five duplicated copies.

- **Separator standardized to `›`.** StudyBreadcrumb's `▸` converges to `›`. The `separator` prop still overrides per instance.
- **CSS custom-property token layer** — defined on `.breadcrumb`, remapped once under `html[data-theme="dark"]`. A variant or one-off theme overrides a variable instead of forking CSS. This is the formalized-token seed for the design system.
  - `--bc-link` (#555 light / #bbb dark)
  - `--bc-link-hover` (#323b4d light / #fff dark)
  - `--bc-sep` (#bbb light / #666 dark)
  - `--bc-current` (#111 light / #fff dark)
  - `--bc-root` (root icon color; defaults to the muted link/separator color, tunable independently)
  - `--bc-gap` (segment/separator spacing, ~0.3em)
  - `--bc-size` (font-size; `md` 0.9rem, `sm` 0.72rem via the `size` prop)
- **Hover:** links underline and darken to `--bc-link-hover`, 0.15s ease (matches tile hover convention).
- **`.bc-dropdown`** ships neutral chrome only: card background, border-radius, shadow, max-height scroll cap. Each usage's grid/avatar layout lives in the slotted child's own CSS — the shared component never owns dropdown *content* layout.

## Migration & rollout

One PR per row; each existing usage becomes thin. Migrations are behavior-preserving refactors — parity is the bar.

| Usage | Becomes | Shared CSS removed |
|---|---|---|
| `FaxBreadcrumbs.jsx` | `<Breadcrumb>` + `.Dropdown` (slot = fax edition grid, `mobileDrawer`) | `.fax-breadcrumbs` / `.breadcrumb-*` in `Facsimiles.scss` |
| `Witnesses.js` | `<Breadcrumb>` + `.Dropdown` (slot = grouped avatar grid) | `.witness-breadcrumbs` / `.breadcrumb-*` in `Witnesses.css` |
| `Bible Reader.jsx` + `AnchorView.jsx` | `<Breadcrumb>` plain; backlink → `<Breadcrumb.Link onClick>` | `.xref-breadcrumb` in `crossref.css` |
| `StudyBreadcrumb.jsx` | Internals reimplemented to delegate to `<Breadcrumb items size="sm">`; **its 2 call sites unchanged** (`FaxVerseCutout.jsx:96`, `FaxVerseModal.jsx:140`). `▸`→`›`. | `.sb-*` |
| `NarrationTile.js` | `<Breadcrumb items size="sm">` | `.narrationCrumbs` / `.narrationCrumbSep` in `Sampler.css` |

**Out of scope:**
- **Chiasmus** (`Chiasm.js`) — no breadcrumb today; it's a close/prev/next overlay whose existing nav makes a breadcrumb arguably redundant. Not added in this effort; revisit separately if wanted.
- Single "Back to X" links (`fax-back`, `page-back`) — one-hop back buttons, not hierarchy trails. Left alone.

The dropdown *content* (fax grid, witness grouped grid) stays as each view's own child component with its own CSS. Only the trail chrome + dropdown mechanism are shared. Behavior parity to preserve: click-outside close, Escape close, mobile Drawer, avatars/thumbnails, aria attributes.

## Testing

- `Breadcrumb.test.jsx` beside the component (React Testing Library, matching `_Common/__tests__/`). Cover:
  - `items` shorthand renders segments with separators between them.
  - Current/last segment gets `aria-current="page"` and is not a link.
  - `.Link` renders `<Link>` for `to`, `<button>` for `onClick`.
  - `.Dropdown` toggles open; closes on outside-click and on Escape; fires `onOpenChange`; render-prop `close` dismisses it.
  - Controlled (`open`/`onOpenChange`) and uncontrolled (`defaultOpen`) both work.
  - `mobileDrawer` swaps the inline panel for the Drawer.
  - `root` prop / `.Root` renders the icon segment first with a separator after it, is linkable, and is absent when not provided.
- The five migrations add no new tests beyond existing coverage — they are behavior-preserving. Each PR gets a manual parity check on `localhost:8200` including dark mode and mobile width. (Verify against `localhost:8200`, not `bom.kckern.net`, which serves a CDN-cached bundle.)

## Documentation

- JSDoc header on `Breadcrumb.jsx` documenting every prop, the three segment subcomponents, and the render-prop slot (matches the house inline-JSDoc convention).
- `docs/reference/breadcrumb-component.md`: the API, the `--bc-*` token list, and a "how to add a new segment type" note — so this doubles as the reusable pattern the next formalized design-system component copies.

## Non-goals

- No broader design-system framework, Storybook, or styleguide route — this formalizes the *existing* convention-based system, it does not replace it.
- No change to the Next.js app.
- No refactor of dropdown *content* components beyond wiring them into the new slot.
