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
  In the `items` shorthand, an item renders as a link when it has `to`/`onClick`,
  as the current page (`aria-current="page"`) when `current: true`, and as plain
  muted text (`.bc-text`) otherwise.
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
