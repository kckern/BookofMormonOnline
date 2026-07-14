# Dark Mode Coverage Audit — frontend/webapp

**Date:** 2026-07-13
**Scope:** `frontend/webapp/src/` (CRA app). All dark-mode styling lives in one file, `src/assets/theme/scss/darkmode.scss` (~1,185 lines), scoped under `.body.dark`. The app has **182 stylesheets**; the override file reaches only a fraction of them.
**Method:** 5 parallel read-only audit agents (Read/Page/Search, _Common + Study, Home/User/social, content pages, theme/infra/3rd-party), with manual verification of the architectural claims.

---

## 1. Architectural defects (fix these before adding more overrides)

These are the reasons dark mode can never be "best in class" in its current shape, no matter how many selectors get added.

### 1.1 The dark class is on a wrapper div, not the document — portals escape it
`Main.js:140` renders `<div className={"body … dark"}>`. Anything mounted via React portal or appended to `document.body` sits **outside** that div, so `.body.dark …` selectors can never reach it:

| Escapee | Where used |
|---|---|
| `react-modern-drawer` (mobile drawer) | `_Common/Drawer.js:62-74` |
| `react-tooltip` popovers | ChapterNav, PopUp, Theater, FacsimilePageViewer, ATV, Study, Map, Sidebar, Home, Feed… |
| `react-bootstrap-sweetalert` modals | StudyGroupSelect, DeleteConfirmAlert, InviteLink |
| `react-toastify` toasts | global (`App.js`) |
| `react-contextmenu` (group admin) | StudyGroupAdmin |

**Fix:** apply the theme class/attribute to `document.documentElement` (e.g. `html[data-theme="dark"]`) via an effect, and scope overrides to that. Everything—portals included—then inherits.

### 1.2 Dead `color-scheme` rule — native UI stays light
`darkmode.scss:2-4` nests `:root { color-scheme: dark }` inside `.body.dark`. `:root` is `<html>`; it can never be a descendant of the wrapper div, so the rule matches nothing. Consequences: scrollbars, native form controls, date pickers, and select dropdowns render light. Related: `public/index.html` has no `<meta name="color-scheme">`, a hardcoded light `<meta name="theme-color" content="#323b4d">`, and no dark `<body>` background (white overscroll/FOUC).

### 1.3 Preference key split: `dark_mode` vs `darkMode`
- Default prefs define `dark_mode: false` (`models/appController.js:64`) — **dead key**, nothing reads it after toggling.
- The toggle writes `prefs.darkMode` (`User/Preferences.js:71`); `Main.js:136` reads `darkMode` — so toggling works.
- But the Preferences switch displays `appController.states.preferences.dark_mode` (`Preferences.js:226`) — **the switch never shows the real state**.

### 1.4 No FOUC prevention, no OS preference
The class is applied only after React boots and reads localStorage — dark-mode users get a white flash on every load. First-time users never get `prefers-color-scheme: dark` respected.

### 1.5 No design tokens
darkmode.scss is 1,185 lines of repeated hardcoded hexes (`#333`/`#444`/`#555`/`#666`) chasing individual selectors, with internal duplication (e.g. `.leaderBoardItem` styled at both line 87 and 555; `.page .card .scripture .reference` at 52 and 944). With 182 stylesheets this whack-a-mole approach cannot converge. Best-in-class = CSS custom properties (`--bg-0..3`, `--text-1..3`, `--border`, `--accent`) defined once per theme, consumed everywhere.

---

## 2. Coverage gaps by surface

### 2.1 Entirely (or near-entirely) unthemed pages
These routes render large light surfaces untouched in dark mode:

| View | Worst offenders |
|---|---|
| **People** | `.ppFilters` `#DDD` panel (People.css:122), IdBadges, `#CCC` card footers (263), `#595959` headings |
| **Places** | IdBadges, `#CCC` card-footer (119), `#AAA` descriptions |
| **Objects** | `#CCC` card-footer (113), 16+ category IdBadges + era badges all light (145-187) |
| **Map** | `#EEE` viewport border, white `.map-type-active`, `.mapTooltip` `#EEE` bg (374), `.map-story` `#f4f3f3` (668), nav-tabs `#000` active text, RangeSlider `lightgrey` rail + hardcoded `#3f51b5` (RangeSlider.scss:80-107) |
| **Timeline (Leaflet)** | popup content `#000` headings / `#555` links (514, 484), marker `.heading` black text (74), `.leaflet-bar` white controls (258) — Leaflet's own light CSS untouched |
| **Facsimiles** | `.facsimile-navigation` `#f0f0f0` (187), white `.custom-tooltip` (429), `.stack-tooltip-content` white (FacsimilePageViewer.scss:88), `#666` refs headings; `Facsimiles.js:104` inline `color: "black"` |
| **History / Witnesses** | `.historicaldocs .card` `#EEE` (74), `.teaser` `#E4E4E4` (141), witness breadcrumb dropdown white (Witnesses.css:147), near-black text throughout |
| **WitnessLifeHeatmap** | **entire palette hardcoded for light** — white cells, `#c6e48b→#196127` greens, `#1565c0`/`#c62828` markers, `#FAFAFA` hover card (WitnessLifeHeatmap.css:1-296). Needs JS/token-level theming |
| **About / KRSEB** | `#345496` links (About.css:33), `KRSEB.css:76` `color:#000` headings |
| **Contact** | `#ddd` buttons w/ dark text (13), white `.imageUploaderWrapper` (59), black `.dragField` border |
| **Contents** | `.toc` sub-lists `#666` text/`#DDD` borders (25-38) — partially covered by darkmode.scss but mismatched |
| **Audit** | `.bomtypes li` overlays (64), keyboardLabel translucent whites |
| **Analysis / Welcome** | minor: brightness filters may compound with dark bg |

### 2.2 Study / messenger surfaces (heavy gaps)
The whole StudyHall/chat stack is essentially light-only:

- **StudyHall.css**: `.StudyHallContents` `color: black` (52), sidebar `#ccc` (130), chat panel `#eee` (141), sidebar list `#eee` (246), `.StudyGroupChatInput` `#ddd` (672), `.likeCount` `#eee` (816), `.Message a` `#006A` links (938).
- **StudyChat.js inline styles**: message box and input `backgroundColor: "white"` (`StudyChat.js:287, 1777`) — CSS can't override inline styles without `!important` hacks; fix in JS.
- **StudyGroupSelect.css**: white `.groupList` dropdown (6), `#eee` badges, `#ddd` hover (470).
- **StudyGroupBar.scss**: `.StudyGroupContents` `#ddd` (326), `.studyGroupSelect` `#ddd` (230), white-default bootstrap `.dropdown-menu` (354), `.newgroupbutton` `#ddd` (618).
- **Study.css**: botComment badge `#d3e1ea` (12), `.contenttext` `#f8f8f8` (30), `.pagesection > .study` `#eee` (95) — darkmode.scss overrides `.pagesection > .study` but misses the rest.
- **StudyGroupAdmin.css**: white `.react-contextmenu` (107) — also a portal escapee.
- **StudyGroupNotebook.css**: `#CCC` note headers (59), black borders.
- **StudyGroupProgress.css**: `#f2f4f6` notice (24), `#e6e9ec` progress track (76).
- **ActionBubble.css**: white bubble + black text (19-21).
- **Mobile/MobileStudy.css**: white `.MobileChatHeader` (72), `#0005` member text (114), `#eee` likeCount (281).
- **AppModal/Style.scss**: `.copy-modal` `#ddd` bg + `#666` text (54).

### 2.3 Common chrome
- **BottomNav.css:13** — `#fff` bottom nav (every mobile page).
- **Header.css:63** — white `.NotificationList` popup; unread rows `#f1f8ff` (174).
- **MobileMenu.css:10** — `#DDD` menu cards.
- **Sidebar.css:148** — `.progress_text` `#444` on dark sidebar.
- **ScripturePanel.css** — `#EEE` wrapper (5), `#DDD` headers (53), white `.text` (73), `#DDD` buttons (124).
- **SearchPopUp.css** — no dark bg for popup, `#DDD` borders, dim selected-row highlight.
- **Commentary.css** — `.atv` `#DDD` (8), white `.atv-string` (28).
- **PopUp.css** — `.notice` translucent-light (125), `.xrels .rel-verb` `#f4f4f4` (688); plus inline `color:"#888"` empty-states in PopUp.js:221/363/512.
- **ToolTip.css** — minor border issue only.

### 2.4 Read / Page / Search
- **CategoryPanels.scss**: `.base-panel` white (2), `#f8f9fa` headers (11) and `.category-data` (63).
- **PassageNotes(_new).scss**: white `.category-tab` (39), `#f8f8f8` tab bar (28).
- **Read.scss skeletons**: `.skeleton-section` `#FFF` (309) + light gradient shimmer (326-386) — loading state flashes white panels.
- **TextContent.css**: white `.art_bubble` (257/277).
- **Narration.css**: `#ddd` image container (134), `#ddd` panel wrappers (304), `#EEE` panels (375), `#EEE` noteItems (417).
- **Page.css:328**: `#eee` alternating card-body rows (mobile).
- **Search.css:98**: white `.searchboxWrapper`.

### 2.5 Home / User
- **Tooltips configured in JS** (can't be fixed in CSS): `Home.js:164,172` (`#666`, `#EEE`), `Feed.js:143,152` (white privacyTip), `Page/PersonPlace.js:97`, `Section.js:52`, `TextContent.js:431`.
- **react-calendar-heatmap** (User.css:274-280, SignIn.css:276-282): white/`#eee` cell fills — invisible study-history heatmap.
- **History.js:250**: Highcharts `backgroundColor: "#FFF"` — needs a JS chart theme.
- **ProgressBox.css:92-93,148-152**: light hover tabs; `#eee` sectionBoxes.
- **PictureWithOverlay.css:65**: white image-uploader modal.
- **MobileUser.css:143-144**: black CircularProgressbar stroke on dark.
- **Preferences.css:68**: `#0007` publisher text.
- **StudyGroupFeed.css:10-11**: `#DDD` placeholder shimmer.

### 2.6 Theme framework (paper-dashboard / Bootstrap) — widget families with zero dark coverage
Base variables are light-only (`_variables.scss`); no dark counterpart exists for:
form inputs (`_inputs.scss:7` white), dropdown menus (`_dropdown.scss:84` white — affects every reactstrap dropdown), modals (`_modals.scss:60` `color:#000`), react-select (white menu, `#292b2c` options), sweetalert2 skin (white modal, `#595959` title), datetime picker, tables, tabs, pagination, alerts, badges, react-bootstrap-switch (partially covered).

### 2.7 Assets
- **Logo** (`svg/logo.svg`, Header.js): `#323b4d` circle on `#1a1a1a` background — near invisible. Needs a dark-variant logo or lighter ring.
- Existing `filter: invert(1)` hacks (prefHeader, quickstats, ppFilters, triangles) are fragile — they'd corrupt any future colored imagery under those selectors.

---

## 3. What's genuinely covered today
Main panel, cards, generic links, Home feed cards, Reading Plan, Community group cards, leaderboards, scripture text/reference blocks, section headers, chapter nav, panel scrollbars, a few tooltips (`.privacyTip`/`.likeTip`/`.cardTip` — though the JS-side `backgroundColor` props fight these), and the comment textarea. No stale selectors were found — what's in darkmode.scss still matches live markup; the problem is breadth, not rot.

---

## 4. Roadmap to best-in-class

**Phase 0 — foundations (small diffs, big wins)**
1. Move theme scoping to `document.documentElement` (`html[data-theme=dark]`), keep `.body.dark` as a legacy alias during migration. Fixes every portal escapee at once.
2. Hoist `color-scheme: dark` to the new scope; add `<meta name="color-scheme" content="light dark">`; swap `theme-color` meta on toggle.
3. Unify the preference key (`darkMode`), fix the Preferences switch binding (`Preferences.js:226`), delete the dead `dark_mode` default.
4. FOUC guard: tiny inline script in `public/index.html` that reads localStorage (falling back to `prefers-color-scheme`) and sets the attribute before first paint.

**Phase 1 — design tokens**
Define semantic CSS custom properties per theme (`--surface-0..3`, `--text-primary/secondary/muted`, `--border`, `--accent-green/amber/red`). Rewrite darkmode.scss to set tokens only; migrate component CSS to consume tokens opportunistically. New CSS must use tokens.

**Phase 2 — surface sweep (priority order)**
1. Global chrome: BottomNav, NotificationList, MobileMenu, dropdown-menu family, modals/sweetalert, toasts, drawer.
2. Study/messenger stack (StudyHall, chat, group select/bar, admin, notebook, mobile study) + remove inline whites from StudyChat.js.
3. Read/Page interior panels (CategoryPanels, PassageNotes, Narration panels, skeletons, art bubbles, ScripturePanel, Commentary/ATV, SearchPopUp/Search box).
4. Content pages: People/Places/Objects (shared IdBadge/card-footer patterns — one fix covers three views), History/Witnesses, Facsimiles, Map, Timeline, About, Contact, Contents, Audit.

**Phase 3 — JS-level theming (CSS can't reach these)**
- A `useTheme()` hook (reads the same preference) feeding: Highcharts global dark theme (History.js), react-tooltip `backgroundColor` props (or drop the props and style via CSS), WitnessLifeHeatmap palette, RangeSlider colors, CircularProgressbar styles, react-calendar-heatmap `classForValue` palette.
- Leaflet: dark tile treatment (CSS `filter` on `.leaflet-tile-pane` or a dark tile layer) + popup/control overrides.
- Replace inline `style={{color/background}}` hardcodes (PopUp.js, StudyChat.js, StudyGroupSelect.js, Sidebar.js, StudyHall.js, Facsimiles.js) with classes.

**Phase 4 — QA & regression**
- Per-route screenshot pass in both themes on `localhost:8200` (not bom.kckern.net — CDN caches the bundle).
- Contrast check (WCAG AA) on text-over-surface pairs.
- Verify portals (tooltips, drawer, sweetalert, toasts, context menu) after the scope change.

---

## 5. Raw tallies
Across the five sweeps: **~115 high-severity gaps** (full panels/surfaces or unreadable text), **~160 medium**, **~35 low**, plus 2 architectural criticals (§1.1/§1.2) and 1 functional bug (§1.3). Roughly 40% of routes are effectively broken in dark mode today; the framework widget layer (dropdowns, modals, inputs, selects) is unthemed globally.
