# App-Wide Accessibility Inventory — 2026-06-13

axe-core (v4.x, bundled in `frontend/webapp/node_modules/axe-core`) run across the
main app routes, logged in as **Staff** via `e2e/adversarial/driver.js`, against the
local dev frontend **http://localhost:8200**. Tag set:
`wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice`.

Harness: `e2e/adversarial/a11y_axe.js` (reusable — routes via `A11Y_ROUTES`, output
JSON via `A11Y_OUT`). Counts are **node-level** violation instances (one per offending
element), the metric the brief targets.

## Totals (before → after this pass)

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| **Grand total** | **6075** | **147** | **−97.6%** |

## By rule (before → after)

| Rule | Before | After | Notes |
|---|---:|---:|---|
| image-alt | 2577 | **0** | systemic — icon/avatar components fixed at source |
| region | 1798 | 56 | `<main>` landmark added; residual = header/study chrome + tooltip portals |
| color-contrast | 1118 | 26 | shared badge/theme tokens darkened to WCAG AA; residual = `/` splash `<sup>` + a few study greys |
| nested-interactive | 296 | **0** | bogus `role="tab"`/`tablist` removed from scripture-reference accordions |
| aria-allowed-attr | 96 | **0** | `role="button"` added to reactstrap `DropdownToggle tag="div"` |
| duplicate-id | 51 | 51 | **remaining** — `react-tooltip` portals emit duplicate ids (3rd-party) |
| list | 49 | **0** | Contents `<ul>` restructured so children are `<li>` |
| aria-required-children | 20 | **0** | removed with the bogus `tablist` roles |
| aria-progressbar-name | 16 | **0** | `aria-label` added to all `role="progressbar"` (Header/Sidebar/StudyGroupBar) |
| link-name | 16 | **0** | icon-only links/buttons given `aria-label` |
| tabindex | 16 | **0** | StudyGroupBar positive `tabIndex` → `0` |
| landmark-one-main | 8 | **0** | route container `<div id=main-panel>` → `<main>` |
| heading-order | 13 | 13 | **remaining** — page heading hierarchy (h3→h5 skips) |
| label | 1 | 1→0* | search box `aria-label` added after the final axe snapshot |

\* the `label` fix (Search box) landed after the final inventory run; verified in source.

## By route (total node-level violations)

| Route | Before | After |
|---|---:|---:|
| `/` (welcome) | 305 | 25 |
| `/study` | 1619 | 37 |
| `/contents` | 159 | 9 |
| `/lehites/1` (Page) | 1628 | 37 |
| `/home` (community feed) | 468 | 11 |
| `/people` | 1361 | 9 |
| `/places` | 484 | 9 |
| `/search` | 51 | 10 |

## Where the bulk lived (root-cause map)

- **image-alt (2577):** not 2577 distinct images — a handful of *components* rendered
  one-or-more `<img>` per list item across long lists:
  - `views/People/People.js` — per-person classification/unit/affiliation icons (≈917 on `/people`)
  - `views/Page/TextContent.js` — per-verse people/place/fax/study/notes counter icons (≈688 each on `/study` & `/lehites/1`)
  - `views/Places/Places.js` — per-place classification icons (≈210 on `/places`)
  - shared chrome: `Header.js`, `Sidebar.js`, `StudyGroupBar.js`, `StudyChat.js`,
    `StudyHall.js`, `Main.js`, `Home.js`, `Feed.js`, `models/Utils.js` (commentary/link previews)
- **region (1798):** route content not inside a landmark + `react-tooltip` spans portaled
  to `<body>`. Fixed the former with `<main>`; the latter is third-party residue.
- **color-contrast (1118):** repeated low-contrast *tokens*, not one-offs —
  the shared `.IdBadge.*` palette (People/Places), home-feed greys
  (`#888`/`#AAA`/`#777` on light), reading-plan tiles, and the scripture-reference
  header (`white on #999`). Fixed at the shared CSS, not per element.
- **nested-interactive (296):** scripture-reference cards used `role="tablist"` +
  `role="tab"` wrapping an `<a>`/`<Link>` (TextContent.js, PageLink.js) — a real
  interactive nested inside an ARIA-interactive container.

See `2026-06-13-app-wide-a11y-pass.md` for the full fix log, modal focus-trap result,
and the prioritized remaining-work breakdown.
