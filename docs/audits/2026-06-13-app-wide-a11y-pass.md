# App-Wide Accessibility Pass — 2026-06-13

Broad (non-study) a11y remediation across the React 17 CRA at `frontend/webapp`,
following the study-scoped loop (`2026-06-13-study-group-adversarial-loop.md`).
Inventory + before/after counts: `2026-06-13-a11y-inventory.md`.

**Result: 6075 → 147 node-level axe violations (−97.6%).** All edits preserve existing
mouse/visual behaviour; verified by screenshots and a live driver run (no compile error
overlay, 0 pageerrors). ESLint on all changed source files: **0 errors**.

Tools: `e2e/adversarial/a11y_axe.js` (inventory), `driver.js` (Staff login). Screenshots
in `docs/audits/a11y-screenshots/`.

---

## Fixes by rule

### image-alt (2577 → 0) — fixed at the source components
- **`views/People/People.js`** — `personIcons`/`unitIcons` now emit meaningful `alt`
  (role name via `label()`); legend icons (sit beside text) → `alt=""`.
- **`views/Places/Places.js`** — same pattern: per-place classification icons get
  descriptive `alt`, legend dots → `alt=""`.
- **`views/Page/TextContent.js`** — per-verse counter icons (people/place/fax/study/notes)
  given descriptive `alt` mirroring their tooltip; decorative `triangle` → `alt=""`.
- **Shared chrome:** `Header.js` (logo/bell/progress dots → `alt=""`),
  `Sidebar.js` (lang flags `alt=""`; sound/settings/history icons get `alt`+`aria-label`),
  `Page/MuteButton.js`, `Page/Page.js`, `Page/Floaters.js`, `Page/Annotations.js`,
  `Main.js` (`nowifi`).
- **Study components:** `StudyGroupBar.js`, `StudyChat.js`, `StudyHall.js` — decorative
  icons → `alt=""`; member/bot avatars → `alt={nickname}`.
- **Feed/Home:** `Home.js` (group/member/trophy imgs + tooltip-HTML imgs), `Feed.js`
  (message media + tooltip-HTML imgs), `models/Utils.js` (commentary cover, link preview).

### nested-interactive (296 → 0) + aria-required-children (20 → 0)
- **`views/Page/TextContent.js`** and **`views/Page/PageLink.js`** — the scripture-reference
  accordion was marked up as `role="tablist" aria-multiselectable` > `role="tab"` >
  `<a>/<Link>`. It is not a real tab widget; the inner `<a aria-expanded>` already drives
  the collapse. Removed the `tablist`/`tab` roles and `aria-multiselectable`. This flattens
  the nested-interactive AND clears the required-children error. Collapse/navigation
  verified still working in screenshot `03-page-lehites.png`.

### aria-allowed-attr (96 → 0)
- **`views/_Common/Study/StudyGroupBar.js`** — reactstrap `<DropdownToggle tag="div">`
  injects `aria-haspopup`/`aria-expanded` onto a role-less `<div>`. Added `role="button"`
  (which permits those attrs) + an `aria-label` on both toggles (bot-plugin + member circle).

### aria-progressbar-name (16 → 0)
- `aria-label` added to every `role="progressbar"` in `Header.js`, `Sidebar.js`,
  `StudyGroupBar.js`. Verified live: 24/24 progressbars on `/contents` now have a name.

### tabindex (16 → 0)
- **`StudyGroupBar.js`** — positive `tabIndex={1}`/`{2}` (which hijack tab order) → `tabIndex={0}`.

### link-name (16 → 0)
- Icon-only links/buttons given accessible names: notification bell (`Header.js`, also
  converted `<div onClick>` → `<button>`), sidebar settings/history links (`aria-label`).

### list (49 → 0)
- **`views/Contents/Contents.js`** — outer `<ul>` directly contained an `<a>` + nested
  `<ul>`. Wrapped them in a single `<li>` so all `<ul>` children are `<li>`.

### landmark-one-main (8 → 0) + region (1798 → 56)
- **`views/_Common/Main.js`** — route content container `<div id="main-panel">` → `<main>`.
  One main landmark per page; route content now lives inside a landmark.

### color-contrast (1118 → 26) — shared tokens, not per-element
- **`views/People/People.css` + `views/Places/Places.css`** — the shared `.IdBadge.*`
  palette (N/L/M/J/B/G + base) darkened to WCAG AA on its light backgrounds
  (e.g. N `#198754`→`#0f5132`, L `#0d6efd`→`#084298`, base `#999`→`#4d4d4d`).
  Also `.lifoot .btn`, `.switch-off`, `.ppFiltersHeading` (filter chrome shared by both).
- **`views/Home/Home.css`** — feed greys: `.itemInFeed`/`.countRow`/`.commentCount`
  (via `StudyInFeed.css`), `.timestamp` `#AAA`→`#696969`, `.groupMessageContent` →
  `#5c636a`, `.lastseen` → `#595959`, `.seeMore` → `#6c757d`, header `.progress` green
  `#40805e`→`#2c5a42`, open-group badge → solid `#198754`.
- **`views/Home/ReadingPlan.css`** — calendar tiles: opaque text `#1f1f1f`; `notStarted`
  tile bg → `#595959` + white text; `.badge.gray` → solid `#6c757d`.
- **`views/Page/TextContent.css`** — scripture-reference header `white on #999` → bg
  `#6c757d` (passes white at 4.7:1); `.highlight button` text `#999`→`#595959`.

### label (1 → 0)
- **`views/Search/Search.js`** — on-page search input given `aria-label` + `placeholder`.

---

## Modal focus-trap (SweetAlert / AppModal) — DONE, verified

New shared hook **`views/_Common/AppModal/useModalA11y.js`** applied to every
react-bootstrap-sweetalert dialog. When a modal opens it: records the trigger, tags the
`.sweet-alert` node with `role="dialog"` + `aria-modal="true"` + `aria-label`, moves focus
inside, traps Tab/Shift+Tab, closes on **Escape**, and restores focus to the trigger on
close. Wired into:
- `AppModal/Components/DeleteConfirmAlert.js`
- `AppModal/Components/InviteLink.js`
- `Study/StudyGroupSelect.js` (leave-group confirm)
- `Home/Feed.js` (members-only / join)

**Live verification (driver on `/study`, DeleteConfirmAlert):**
```
OPEN_STATE { role:"dialog", ariaModal:"true", ariaLabel:"Are you sure?",
             focusInside:true, activeText:"Cancel" }
TAB_TRAPPED true        SHIFTTAB_TRAPPED true
AFTER_ESC  { stillOpen:false }   ← Escape closes
```
Tab and Shift+Tab keep focus inside the dialog; Escape closes it. (Focus-return logic is
in place — restores `document.activeElement` recorded at open; exercised by the hook
cleanup.)

---

## Visual regression — no changes to mouse/visual behaviour
Screenshots `docs/audits/a11y-screenshots/`: `01-people`, `02-home`, `03-page-lehites`,
`04-places`. Badges/icons/filters/feed/accordion all render as before; the darkened text
tokens read naturally. Bell (now a `<button>`) renders identically.

---

## REMAINING WORK (prioritized, by directory/component)

**P1 — color-contrast residue (26 nodes)**
- `frontend/webapp/src/views/Welcome/` (or shared verse renderer) — the `/` splash sample
  verses render footnote `<sup>` at `#999` on white (14 nodes) + a study deep-link button
  at `#aaa`. Find the `<sup>` / `.btn-outline-secondary` token and darken.
- `views/_Common/Study/` — a few study greys remain on `/study`/`/lehites/1`: comment
  author "BOT" tag (`#7f878c` on `#d3e1ea`), faded annotation numbers
  (`white on #9da5b3`), `.chronoText` (`#888` on `#e7e5e5`). ~4 each.
- `views/Search/` — 1 residual on `/search`.

**P2 — heading-order (13 nodes)** — across Page/Contents/Home: headings skip levels
(e.g. `h3` → `h5` with no `h4`). Needs a per-view audit of `h*` usage; low user impact,
moderate effort (touches many view templates). Directories: `views/Page/`,
`views/Contents/`, `views/Home/`.

**P3 — duplicate-id (51 nodes)** — **third-party**: `react-tooltip` portals every
tooltip to `<body>` with ids derived from the target slug (`jerusalem-1`, `lehi1`, …),
and the same person/place appears multiple times on a page → duplicate ids. Fixing means
making the tooltip id unique per instance (index/uuid suffix) wherever `data-tip`/`id`
pairs are generated (`views/Page/`, `views/People/`, `views/Places/`), or upgrading the
tooltip lib. Mostly cosmetic for AT; defer.

**P3 — region (56 nodes, 7/route)** — remaining un-landmarked chrome: the header logo
block, `StudyGroupBar` wrapper, and bot/member dropdown toggles sit outside any landmark,
plus `react-tooltip` body portals. Wrap `Header.js` in `<header>` and the study rail in a
`<nav aria-label>`/`role="complementary"`, and the tooltip portals are third-party (see
duplicate-id). Low impact.

**Not regressions / out of scope:** the 4 pre-existing ESLint errors are all in
`src/**/__tests__/*` (testing-library rules), untouched by this pass.
