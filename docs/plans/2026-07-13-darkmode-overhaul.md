# Dark Mode Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three architectural dark-mode defects and bring dark-theme coverage to 100% of the webapp's surfaces, per the audit in `docs/audits/2026-07-13-darkmode-coverage-audit.md`.

**Architecture:** Move theme scoping from the `.body.dark` wrapper div to `html[data-theme="dark"]` so portals and native UI are covered; introduce CSS design tokens consumed by all overrides; split dark overrides into per-area SCSS partials; add a small JS theme utility for chart/tooltip/canvas colors that CSS cannot reach.

**Tech Stack:** React 17 (CRA), SCSS (dart-sass via react-scripts), react-tooltip 4, Highcharts 9, react-calendar-heatmap, Leaflet, react-bootstrap-sweetalert, react-toastify 7.

**Verification model:** This is ~90% CSS work, which is not unit-testable; the TDD loop applies only to Task 2 (preference migration, pure JS). Every CSS task ends with (a) a dart-sass compile check and (b) a visual check against `http://localhost:8200` (NOT bom.kckern.net — Cloudflare caches the bundle for 4h). The dev server (`bom-dev` systemd unit) hot-reloads source edits automatically.

**Working conventions for every task:**
- Compile check command (run from repo root):
  `cd frontend/webapp && npx sass --no-source-map --load-path=src src/assets/theme/scss/darkmode.scss /tmp/darkmode-check.css && echo COMPILE_OK`
  Expected output ends with: `COMPILE_OK`
- Visual check: open `http://localhost:8200/<route>`, toggle dark mode via `/user/preferences` (or run `localStorage.setItem('preferences', JSON.stringify({...JSON.parse(localStorage.getItem('preferences')||'{}'), darkMode:true})); location.reload()` in the browser console).
- All new dark CSS uses the tokens from Task 4. Never introduce new hardcoded hex values in dark partials — if a needed token is missing, add it to `_tokens.scss` in the same commit.
- Branch: all work on `feat/darkmode-overhaul` (Task 0).

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch from dev**

```bash
cd /home/bom/BookofMormonOnline
git checkout dev && git pull && git checkout -b feat/darkmode-overhaul
```

Expected: `Switched to a new branch 'feat/darkmode-overhaul'`

---

### Task 1: Rescope the theme to `html[data-theme="dark"]`

Portals (react-tooltip, react-modern-drawer, sweetalert, toastify, react-contextmenu) mount outside the `.body` wrapper div and can never match `.body.dark …`. Scope the theme on `<html>` instead. Keep the old `.body.dark` class in the DOM during migration (harmless), but all CSS moves to the new scope.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Main.js:136-140`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss:1-13`

- [ ] **Step 1: Add a theme-sync effect in Main.js**

`Main.js` already imports `useEffect` (line 1). Directly after line 136 (`const isDarkMode = ...`), add:

```js
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDarkMode ? "#1a1a1a" : "#323b4d");
  }, [isDarkMode]);
```

Leave the existing `className={"body"...}` line untouched.

- [ ] **Step 2: Rescope darkmode.scss and fix the dead `:root` rule**

Replace lines 1–13 of `darkmode.scss`:

```scss
// OLD (delete):
.body.dark{
    :root {
        color-scheme: dark;
      }
      


    .main-panel{
        background-color: #1a1a1a;
        color: #fff;
        /* make scrollbars dark */

    }
```

with:

```scss
html[data-theme="dark"] {
    color-scheme: dark;
    background-color: #1a1a1a;

    .main-panel{
        background-color: #1a1a1a;
        color: #fff;
    }
```

The rest of the file (all nested selectors down to the closing `}` at line 1184) stays inside this block unchanged — only the wrapper selector changes. `color-scheme: dark` now actually applies (dark native scrollbars, form controls, pickers), and the `<html>` background kills white overscroll.

- [ ] **Step 3: Compile check**

Run the compile check command (see header). Expected: `COMPILE_OK`.

- [ ] **Step 4: Visual check**

On `http://localhost:8200/home` with dark mode on: page renders dark exactly as before, scrollbars are now dark, and hovering a person/place link shows the tooltip — tooltips are NOT yet dark (that's later tasks); confirm no light-mode regression with dark mode off.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/_Common/Main.js frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "fix(darkmode): scope theme on html[data-theme] so portals and native UI inherit it"
```

---

### Task 2: Unify the preference key (`darkMode`) with migration (TDD)

Today: defaults define `dark_mode` (dead), the toggle writes `darkMode`, the Preferences switch displays `dark_mode` (always wrong). Unify on `darkMode`, migrate stored prefs, default new users to `prefers-color-scheme`.

**Files:**
- Create: `frontend/webapp/src/models/preferenceMigration.js`
- Create: `frontend/webapp/src/models/preferenceMigration.test.js`
- Modify: `frontend/webapp/src/models/appController.js:57-83`
- Modify: `frontend/webapp/src/views/User/Preferences.js:226`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/models/preferenceMigration.test.js`:

```js
import { migratePreferences } from "./preferenceMigration";

describe("migratePreferences", () => {
  it("maps legacy dark_mode to darkMode and removes the old key", () => {
    const result = migratePreferences({ dark_mode: true, sound: true });
    expect(result.darkMode).toBe(true);
    expect(result).not.toHaveProperty("dark_mode");
    expect(result.sound).toBe(true);
  });

  it("keeps an existing darkMode value over legacy dark_mode", () => {
    const result = migratePreferences({ darkMode: true, dark_mode: false });
    expect(result.darkMode).toBe(true);
  });

  it("falls back to the OS preference when neither key exists", () => {
    expect(migratePreferences({}, true).darkMode).toBe(true);
    expect(migratePreferences({}, false).darkMode).toBe(false);
  });

  it("returns a defaulted object when given null", () => {
    expect(migratePreferences(null, true).darkMode).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend/webapp && CI=true npx react-scripts test src/models/preferenceMigration.test.js --watchAll=false
```

Expected: FAIL — `Cannot find module './preferenceMigration'`.

- [ ] **Step 3: Implement the migration**

Create `frontend/webapp/src/models/preferenceMigration.js`:

```js
// Normalizes the dark-mode preference key. Historical clients wrote
// `dark_mode` (defaults) and `darkMode` (toggle); `darkMode` is canonical.
export const migratePreferences = (prefs, osPrefersDark = false) => {
  const p = { ...(prefs || {}) };
  if (p.darkMode === undefined) {
    p.darkMode = p.dark_mode !== undefined ? !!p.dark_mode : !!osPrefersDark;
  }
  delete p.dark_mode;
  return p;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Same command as Step 2. Expected: PASS (4 tests). Note: the suite-wide `npm test` has 8 pre-existing failures unrelated to this work — run only this file.

- [ ] **Step 5: Wire it into appController**

In `frontend/webapp/src/models/appController.js`, add to the imports at the top of the file:

```js
import { migratePreferences } from "./preferenceMigration";
```

Then replace lines 57–83 (the `let preferences = ...` block through the closing `};` of the default object):

```js
  const osPrefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  let preferences = localStorage.getItem("preferences");
  if (preferences) preferences = JSON.parse(preferences);
  else
    preferences = {
      lang: lang,
      audio: false,
      canned_responses: true,
      autoplay: false,
      sound: true,
      art: true,
      commentary: {
        on: true,
        filter: {
          type: "blacklist",
          sources: [41,141,142,143,144,145]
        },
      },
      controversialCommentary:false,
      facsimiles: {
        on: true,
        filter: {
          type: "blacklist",
          versions: [],
        },
      },
    };
  preferences = migratePreferences(preferences, osPrefersDark);
```

(The `dark_mode: false` line is gone from the defaults; `migratePreferences` supplies `darkMode` for both stored and fresh preference objects.)

- [ ] **Step 6: Fix the Preferences switch binding**

In `frontend/webapp/src/views/User/Preferences.js` line 226, change:

```js
value={appController.states.preferences.dark_mode}
```

to:

```js
value={appController.states.preferences.darkMode}
```

- [ ] **Step 7: Visual check**

On `http://localhost:8200/user/preferences`: the Dark Mode switch now reflects the actual state; toggling flips the theme immediately and the switch stays in sync after reload. In a private window (no localStorage) with the OS in dark mode, the site loads dark.

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/models/preferenceMigration.js frontend/webapp/src/models/preferenceMigration.test.js frontend/webapp/src/models/appController.js frontend/webapp/src/views/User/Preferences.js
git commit -m "fix(darkmode): unify preference key on darkMode with migration + OS default"
```

---

### Task 3: FOUC guard + color-scheme meta

**Files:**
- Modify: `frontend/webapp/public/index.html` (head: line ~13 area, where `<meta name="theme-color" content="#323b4d">` lives)

- [ ] **Step 1: Add color-scheme meta and pre-paint theme script**

In `public/index.html`, directly after the existing `<meta name="theme-color" ...>` tag, add:

```html
    <meta name="color-scheme" content="light dark" />
    <script>
      (function () {
        try {
          var p = JSON.parse(localStorage.getItem("preferences") || "{}");
          var dark =
            p.darkMode !== undefined ? !!p.darkMode :
            p.dark_mode !== undefined ? !!p.dark_mode :
            window.matchMedia("(prefers-color-scheme: dark)").matches;
          document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        } catch (e) {}
      })();
    </script>
```

This runs before first paint, so dark users never see the white flash; `html[data-theme="dark"] { background-color: #1a1a1a }` (Task 1) covers the pre-React frame. The React effect from Task 1 keeps it in sync afterward.

- [ ] **Step 2: Visual check**

With dark mode on, hard-reload `http://localhost:8200` (disable cache in devtools): no white flash before the app renders.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/public/index.html
git commit -m "fix(darkmode): pre-paint FOUC guard + color-scheme meta"
```

---

### Task 4: Design tokens + partials skeleton

All subsequent CSS goes into per-area partials under `src/assets/theme/scss/darkmode/`, each self-wrapped in `html[data-theme="dark"]`, consuming tokens.

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_tokens.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (imports at top of file)

- [ ] **Step 1: Create the token sheet**

Create `frontend/webapp/src/assets/theme/scss/darkmode/_tokens.scss`:

```scss
// Semantic theme tokens. Dark overrides must use these vars, never raw hex.
:root {
  --surface-0: #ffffff;   // page background
  --surface-1: #f8f8f8;   // raised card
  --surface-2: #f0f0f0;   // panel / header strip
  --surface-3: #e4e4e4;   // inset / well
  --surface-4: #dddddd;   // control resting bg
  --control: #eeeeee;     // buttons, chips
  --control-hover: #dddddd;
  --text-primary: #212529;
  --text-secondary: #444444;
  --text-muted: #777777;
  --text-faint: #999999;
  --border: #dddddd;
  --border-strong: #bbbbbb;
  --link: #345496;
  --link-hover: #1a3a7a;
  --accent-green: #5cb85c;
  --accent-green-soft: #7cb87c;
  --accent-amber: #f0ad4e;
  --accent-red: #d9534f;
  --highlight: #fff3b0;   // text highlight / selection wash
  --overlay: rgba(0, 0, 0, 0.5);
  --shadow: rgba(0, 0, 0, 0.15);
}

html[data-theme="dark"] {
  --surface-0: #1a1a1a;
  --surface-1: #222222;
  --surface-2: #2a2a2a;
  --surface-3: #333333;
  --surface-4: #444444;
  --control: #555555;
  --control-hover: #666666;
  --text-primary: #ffffff;
  --text-secondary: #dddddd;
  --text-muted: #aaaaaa;
  --text-faint: #888888;
  --border: #555555;
  --border-strong: #666666;
  --link: #a8c7fa;
  --link-hover: #ffffff;
  --accent-green: #5cb85c;
  --accent-green-soft: #7cb87c;
  --accent-amber: #f0ad4e;
  --accent-red: #d9534f;
  --highlight: #55502a;
  --overlay: rgba(0, 0, 0, 0.65);
  --shadow: rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 2: Import it (and reserve the partial list) in darkmode.scss**

At the very top of `darkmode.scss` (line 1, above the `html[data-theme="dark"] {` block from Task 1), add:

```scss
@import "./darkmode/tokens";
```

(Partials from later tasks each add their own `@import "./darkmode/<name>";` line here as they're created.)

- [ ] **Step 3: Compile check** — run the standard compile command; expected `COMPILE_OK`.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_tokens.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): design token sheet + partial structure"
```

---

### Task 5: Framework widgets partial (Bootstrap/paper-dashboard/portal libraries)

Covers globally-unthemed widget families: dropdowns, modals, form inputs, react-select (v1 classes, per `_plugin-react-select.scss`), sweetalert, datetime picker, tables, tabs, pagination, toasts, drawer, context menu, react-tooltip fallback.

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_framework.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add import)

- [ ] **Step 1: Write the partial**

Create `frontend/webapp/src/assets/theme/scss/darkmode/_framework.scss`:

```scss
html[data-theme="dark"] {

  /* ---- Bootstrap dropdowns (incl. reactstrap; render in-tree) ---- */
  .dropdown-menu {
    background-color: var(--surface-2);
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px var(--shadow);
    &::before, &::after { border-bottom-color: var(--surface-2); }
    .dropdown-item {
      color: var(--text-secondary);
      &:hover, &:focus { background-color: var(--surface-3); color: var(--text-primary); }
      &.disabled { color: var(--text-faint); }
    }
    .dropdown-divider { border-color: var(--border); }
  }

  /* ---- Modals ---- */
  .modal-content {
    background-color: var(--surface-2);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .modal-header { border-bottom-color: var(--border); color: var(--text-primary); }
  .modal-footer { border-top-color: var(--border); }
  .modal-body { color: var(--text-secondary); }
  .modal-title { color: var(--text-primary); }
  .close { color: var(--text-muted); text-shadow: none; &:hover { color: var(--text-primary); } }

  /* ---- Form controls ---- */
  .form-control, input.form-control, textarea.form-control, select.form-control {
    background-color: var(--surface-4);
    color: var(--text-primary);
    border-color: var(--border);
    &:focus {
      background-color: var(--surface-4);
      color: var(--text-primary);
      border-color: var(--border-strong);
      box-shadow: 0 0 0 0.2rem rgba(92, 184, 92, 0.25);
    }
    &::placeholder { color: var(--text-faint); }
    &:disabled, &[readonly] { background-color: var(--surface-3); color: var(--text-muted); }
  }
  .input-group-text, .input-group-prepend .input-group-text, .input-group-append .input-group-text {
    background-color: var(--surface-3);
    color: var(--text-muted);
    border-color: var(--border);
  }

  /* ---- Tables ---- */
  .table {
    color: var(--text-secondary);
    th, td { border-color: var(--border); }
    thead th { border-bottom-color: var(--border-strong); color: var(--text-primary); }
  }
  .table-striped tbody tr:nth-of-type(odd) { background-color: var(--surface-2); }
  .table-hover tbody tr:hover { background-color: var(--surface-3); color: var(--text-primary); }

  /* ---- Tabs / pills / pagination ---- */
  .nav-tabs {
    border-bottom-color: var(--border);
    .nav-link { color: var(--text-muted); }
    .nav-link:hover { border-color: var(--border); color: var(--text-primary); }
    .nav-link.active, .nav-item.show .nav-link {
      background-color: var(--surface-3);
      border-color: var(--border) var(--border) var(--surface-3);
      color: var(--text-primary);
    }
  }
  .page-link {
    background-color: var(--surface-2); border-color: var(--border); color: var(--text-secondary);
    &:hover { background-color: var(--surface-3); color: var(--text-primary); }
  }
  .page-item.disabled .page-link { background-color: var(--surface-2); color: var(--text-faint); }

  /* ---- Alerts: darken washes, keep semantic hue ---- */
  .alert-success { background-color: #24391f; border-color: #33552c; color: #b7e0ae; }
  .alert-danger  { background-color: #43201e; border-color: #63302d; color: #efb2ae; }
  .alert-warning { background-color: #453718; border-color: #6a5424; color: #f2d59a; }
  .alert-info    { background-color: #1c333f; border-color: #2b4d5f; color: #a9d3e6; }

  /* ---- react-select (v1 classes, per _plugin-react-select.scss) ---- */
  .Select-control, .Select.is-open > .Select-control, .Select.is-focused > .Select-control {
    background-color: var(--surface-4); border-color: var(--border); color: var(--text-primary);
  }
  .Select-menu-outer { background-color: var(--surface-2); border-color: var(--border); }
  .Select-option {
    background-color: var(--surface-2); color: var(--text-secondary);
    &.is-focused { background-color: var(--surface-3); color: var(--text-primary); }
    &.is-selected { background-color: var(--surface-4); color: var(--text-primary); }
  }
  .Select-placeholder { color: var(--text-faint); }
  .Select-value-label, .Select--single > .Select-control .Select-value .Select-value-label {
    color: var(--text-primary) !important;
  }
  .Select-arrow { border-top-color: var(--text-muted); }

  /* ---- Datetime picker (react-datetime) ---- */
  .rdtPicker {
    background-color: var(--surface-2); border: 1px solid var(--border); color: var(--text-secondary);
    th, td { color: var(--text-secondary); }
    td.rdtDay:hover, td.rdtHour:hover, td.rdtMinute:hover, th.rdtSwitch:hover, th.rdtNext:hover, th.rdtPrev:hover {
      background-color: var(--surface-3);
    }
    td.rdtActive, td.rdtActive:hover { background-color: var(--accent-green); color: #fff; }
    td.rdtOld, td.rdtNew { color: var(--text-faint); }
    th { border-bottom-color: var(--border); }
  }

  /* ---- react-toastify (portal) ---- */
  .Toastify__toast { background-color: var(--surface-2); color: var(--text-primary); box-shadow: 0 4px 12px var(--shadow); }
  .Toastify__close-button { color: var(--text-muted); }
  .Toastify__progress-bar--default { background: var(--accent-green); }

  /* ---- react-modern-drawer (portal) ---- */
  .EZDrawer .EZDrawer__container { background-color: var(--surface-1) !important; color: var(--text-secondary); }

  /* ---- react-contextmenu (portal; overrides StudyGroupAdmin.css:107) ---- */
  .react-contextmenu {
    background-color: var(--surface-2); border: 1px solid var(--border); color: var(--text-secondary);
  }
  .react-contextmenu-item {
    color: var(--text-secondary);
    &:hover, &.react-contextmenu-item--active { background-color: var(--surface-3); color: var(--text-primary); }
    &.react-contextmenu-item--disabled { color: var(--text-faint); }
  }

  /* ---- react-tooltip CSS fallback (JS props handled in Task 17) ---- */
  .__react_component_tooltip.type-light {
    background-color: var(--surface-3); color: var(--text-primary);
    &.place-top::after { border-top-color: var(--surface-3); }
    &.place-bottom::after { border-bottom-color: var(--surface-3); }
    &.place-left::after { border-left-color: var(--surface-3); }
    &.place-right::after { border-right-color: var(--surface-3); }
  }

  /* ---- sweetalert (react-bootstrap-sweetalert + swal2 skin classes) ----
     react-bootstrap-sweetalert inlines some styles; !important is required. */
  .sweet-alert, .swal2-modal {
    background-color: var(--surface-2) !important;
    color: var(--text-secondary) !important;
    h2, .swal2-title { color: var(--text-primary) !important; }
    p, .swal2-content { color: var(--text-secondary) !important; }
  }
}
```

- [ ] **Step 2: Import it** — in `darkmode.scss`, under the tokens import, add `@import "./darkmode/framework";`

- [ ] **Step 3: Compile check** — expected `COMPILE_OK`.

- [ ] **Step 4: Visual check**

Dark mode on `localhost:8200`: open any reactstrap dropdown (user status in StudyGroupBar), open a sweetalert (group select → delete confirm), trigger a toast (e.g. copy an invite link), open the mobile drawer at narrow viewport. All should render dark. If `.sweet-alert` still shows a white body, react-bootstrap-sweetalert's inline style won — in that case add `style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}` to the `<SweetAlert>` elements in `frontend/webapp/src/views/_Common/Study/StudyGroupSelect.js`, `.../DeleteConfirmAlert.js`, and `.../InviteLink.js` (search `<SweetAlert` in each) and include those files in the commit.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_framework.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): dark theme for framework widgets, portals, and overlays"
```

---

### Task 6: Global chrome partial (BottomNav, notifications, mobile menu, sidebar)

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_chrome.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/chrome";`)

- [ ] **Step 1: Write the partial**

```scss
html[data-theme="dark"] {

  /* BottomNav.css:13 — white mobile nav */
  .bottom-nav {
    background-color: var(--surface-2);
    border-top: 1px solid var(--border);
    box-shadow: 0 -2px 8px var(--shadow);
  }
  .bottom-nav-item p { color: var(--text-muted); }
  .bottom-nav-item.active p { color: var(--text-primary); }
  .bottom-nav-item img { filter: invert(1) brightness(0.85); }

  /* Header.css:63 — white notification popup */
  .NotificationList {
    background-color: var(--surface-2);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px var(--shadow);
    li { border-top-color: var(--border); }
    li.unread { background-color: #26313d; }
  }
  .NotificationList-item:hover { background-color: var(--surface-3); }

  /* MobileMenu.css:10 — light menu cards */
  .mobilemenu > a {
    background-color: var(--surface-3);
    color: var(--text-secondary);
    &:hover { background-color: var(--surface-4); }
    > div > div > span { color: var(--text-secondary); }
  }

  /* Sidebar.css */
  .sidebar .progress_text { color: var(--text-secondary); }
  .sidebar .userNav { border-bottom-color: var(--border-strong); }

  /* AppModal/Style.scss:54 — copy modal */
  .copy-modal { background: var(--surface-3); color: var(--text-secondary); }
  .sweet-alert-modal code {
    color: var(--text-muted);
    &:hover { color: var(--text-primary); background-color: var(--surface-4); }
  }
}
```

- [ ] **Step 2: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 3: Visual check** — narrow viewport on `localhost:8200`: bottom nav and mobile menu dark; bell icon → notification list dark; sidebar progress text readable.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_chrome.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): global chrome (bottom nav, notifications, mobile menu, sidebar)"
```

---

### Task 7: Study Hall & chat partial

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_studyhall.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/studyhall";`)

- [ ] **Step 1: Write the partial** (covers StudyHall.css, StudyGroupProgress.css, StudyGroupNotebook.css, ActionBubble.css, MobileStudy.css gaps from the audit)

```scss
html[data-theme="dark"] {

  /* StudyHall.css */
  .StudyHall .StudyHallContents { color: var(--text-secondary); }
  .StudyHall .StudyGroupHeader { background-color: var(--surface-2); color: var(--text-primary); }
  .StudyGroupHeader .Share { background-color: var(--control); &:hover { background-color: var(--control-hover); } }
  .StudyHall .StudyGroupBody > div.StudyGroupSideBar { background-color: var(--surface-2); }
  .StudyHall .StudyGroupBody > div.StudyGroupChatPanel { background-color: var(--surface-1); }
  .StudyHall .StudyGroupBody .StudyGroupChatPanel .PrevMessageLoader { background-color: var(--surface-3); color: var(--text-secondary); }
  .StudyHall .StudyGroupSideBar ul { background-color: var(--surface-2); }
  .StudyHall .StudyGroupSideBar li {
    border-bottom-color: var(--border);
    &:hover { background-color: var(--surface-3); }
    &.active { background-color: var(--surface-4); }
  }
  .StudyHall .StudyGroupSideBar .userInfo .userLink a { color: var(--text-muted); }
  .StudyHall .StudyGroupSideBar .recentContent { color: var(--text-muted); }
  .StudyHall .StudyGroupChatPanel .unreadMsg { border-top-color: var(--border-strong); }
  #inputGroupChat { border-color: var(--border); background-color: var(--surface-4); color: var(--text-primary); }
  .StudyGroupChatInput { background-color: var(--surface-3); border-top-color: var(--border); }
  .StudyGroupChatInput .topRow button.btn-primary { background-color: var(--control-hover); }
  .StudyHall .StudyGroupChatPanel .thread { border-left-color: var(--border); }
  .StudyHall .StudyGroupChatPanel .thread h3.threadHeader { background-color: var(--surface-4); color: var(--text-primary); }
  .StudyHall .likeCount, .DrawerStudyGroupThread .likeCount {
    background-color: var(--surface-4); color: var(--text-secondary);
    &:hover { background-color: var(--control-hover); color: var(--text-primary); }
    &.hasCount { background-color: var(--control-hover); color: var(--text-primary); }
  }
  .StudyHall .thread textarea { color: var(--text-primary); }
  .send-btn-group .btn { background-color: var(--control); &:hover { background-color: var(--control-hover); } }
  .Message a { color: var(--link); &:hover { color: var(--link-hover); } }

  /* StudyGroupProgress.css */
  .StudyHall .StudyGroupChatPanel.progress .progressNotice {
    color: var(--text-secondary); background: var(--surface-3); border-color: var(--border);
  }
  .StudyHall .StudyGroupChatPanel.progress .userCircle { background-color: var(--surface-4); }
  .StudyHall .StudyGroupChatPanel.progress .progressBar { background: var(--surface-4); }
  .StudyHall .StudyGroupChatPanel.progress .progressBadge { color: var(--text-secondary); }

  /* StudyGroupNotebook.css */
  .topTabs div { background-color: var(--surface-4); color: var(--text-primary); }
  .noteList { border-color: var(--border); }
  .noteList .note { border-color: var(--border); }
  .noteList .note h4 { background-color: var(--surface-3); color: var(--text-primary); }
  .noteList .note blockquote { color: var(--text-secondary); }

  /* StudyGroupAdmin.css (context menu handled in _framework) */
  .StudyGroupChatPanel.admin .input-group-text { background-color: var(--surface-3); }
  .membershipRequests .userId { color: var(--text-muted); }
  .userAdminBox .completed { background-color: var(--surface-4); }
  .actions { color: var(--text-muted); }

  /* ActionBubble.css:19 — white bubble */
  .StudyGroupBar .userStatus .userCircle .actionBubble {
    background-color: var(--surface-2); color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .actionBubble .messageText { color: var(--text-secondary); }

  /* Mobile/MobileStudy.css */
  .mobilestudy .StudyGroupChatInput { border-bottom-color: var(--surface-3); }
  .MobileChatHeader { background: var(--surface-2); color: var(--text-primary); }
  .MobileChatHeaderMembers { color: var(--text-muted); }
  .LeaderBoardDrawer .GroupLeaderBoard .leaderBoardItem { border-bottom-color: var(--border); }
  .LeaderBoardDrawer .LeaderBoardDrawerHeader { border-bottom-color: var(--border); background-color: var(--surface-2); color: var(--text-primary); }
}
```

- [ ] **Step 2: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 3: Visual check** — `localhost:8200` → open Study Hall (join a group from Community): sidebar, chat panel, input, threads, like counts, notebook, progress tab, admin tab all dark; mobile viewport chat header dark.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_studyhall.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): Study Hall, chat, notebook, progress, admin surfaces"
```

---

### Task 8: Study bar / group select / study feed partial

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_studybar.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/studybar";`)

- [ ] **Step 1: Write the partial** (StudyGroupSelect.css, StudyGroupBar.scss, Study.css, StudyInFeed.css, TagList.css gaps)

```scss
html[data-theme="dark"] {

  /* StudyGroupSelect.css — white dropdown list */
  .groupList {
    background-color: var(--surface-2); color: var(--text-secondary);
    ul { border-bottom-color: var(--border); }
    li:hover { background-color: var(--surface-3); }
    h5 { color: var(--text-primary); }
    .newgroupbutton { background-color: var(--surface-4); color: var(--text-secondary); }
    .studymode { color: var(--text-muted); }
  }
  .groupListItem { border-top-color: var(--border); }
  .groupListItem.active { background-color: rgba(107, 208, 152, 0.15); }
  .groupListItemContent .lastMessage { color: var(--text-muted); }
  .memberCount { background-color: var(--surface-4); color: var(--text-secondary); }
  .groupMembers span { background-color: var(--surface-4); color: var(--text-muted); }
  .goToStudyHall { background-color: var(--control); color: var(--text-primary); &:hover { background-color: var(--control-hover); } }

  /* StudyGroupBar.scss */
  .StudyGroupBar .StudyGroupDrawer .StudyGroupContents { background-color: var(--surface-2); }
  .studyGroupSelect { background-color: var(--surface-3); color: var(--text-secondary); }
  .studyGroupTickerItem .message { color: var(--text-muted); }
  .CreateGroupInput h5 { color: var(--text-secondary); }
  .CreateGroupInput .optional { color: var(--text-muted); }
  .messageBox { color: var(--text-primary); }
  .userStatus .dropdown-menu .botInfo img { background-color: var(--surface-4); }
  .dropdown-menu .statRow div { color: var(--text-muted); }

  /* Study.css */
  .study .botComment .name > span { background-color: #2d3f4e; color: var(--text-secondary); }
  .study .contenttext { background-color: var(--surface-3); color: var(--text-secondary); }
  .study .mycomment textarea { color: var(--text-primary); }
  .study .notification, .study .warning { background-color: var(--surface-3); color: var(--text-secondary); border-color: var(--border); }

  /* StudyInFeed.css */
  .itemInFeed { color: var(--text-secondary); &:hover { color: var(--text-primary); } }
  .itemInFeed h5 { background-color: var(--surface-4); color: var(--text-primary); }
  .itemInFeed .caption { background-color: var(--surface-4); color: var(--text-secondary); }
  .textInFeed .scripture { background-color: var(--surface-3); color: var(--text-secondary); }
  .sectionItems ul { border-left-color: var(--border); }
  .highlightInFeed { background-color: var(--highlight); }
  .contentPaceholder { background-color: var(--surface-4); }
  .itemPlaceholder .blankWord { background-color: var(--surface-4); }

  /* TagList.css:4 — white floating tag list */
  .tagList { background: var(--surface-2); border: 1px solid var(--border); color: var(--text-secondary); }
  .tagListItem:hover { background: var(--surface-3); }
}
```

- [ ] **Step 2: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 3: Visual check** — study bar at page bottom: group selector dropdown, ticker, user-status dropdown; a study comment thread on any Page route; tag list popup when tagging.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_studybar.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): study bar, group select, study feed, tag list"
```

---

### Task 9: Remove hardcoded inline styles from Study/PopUp JS

Inline `style` attributes beat any stylesheet; these must move to classes (which the partials above/below then style).

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Study/StudyChat.js:287,1777`
- Modify: `frontend/webapp/src/views/_Common/PopUp.js:221,363,512`
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:104`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode/_studybar.scss` (append)

- [ ] **Step 1: StudyChat.js — replace both `backgroundColor: "white"` inline styles**

At `StudyChat.js:287` and `StudyChat.js:1777`, the elements carry `style={{ ... backgroundColor: "white" ... }}`. Remove the `backgroundColor` property from both style objects and add the class `chatSurface` to each element's `className` (append to existing className strings). Keep all other style properties intact.

- [ ] **Step 2: PopUp.js — replace the three `color: "#888"` empty-state styles**

At `PopUp.js:221`, `363`, `512`, remove `color: "#888"` from the inline style objects and add className `emptyState` to those elements.

- [ ] **Step 3: Facsimiles.js — remove `color: "black"`**

At `Facsimiles.js:104`, delete the `color: "black"` inline style property (the element inherits card text color in both themes).

- [ ] **Step 4: Style the new classes**

Append to `_studybar.scss` inside the `html[data-theme="dark"]` block:

```scss
  .chatSurface { background-color: var(--surface-3); }
  .emptyState { color: var(--text-faint); }
```

And add light-theme defaults at the END of `_studybar.scss`, OUTSIDE the dark block:

```scss
.chatSurface { background-color: #ffffff; }
html[data-theme="dark"] .chatSurface { background-color: var(--surface-3); }
.emptyState { color: #888888; }
html[data-theme="dark"] .emptyState { color: var(--text-faint); }
```

(Delete the two lines added inside the dark block in favor of this four-line form — one source of truth per class.)

- [ ] **Step 5: Compile check + visual check** — chat message list and input surfaces dark; person/place/object popups' "nothing here yet" text readable in both themes; light mode unchanged.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/_Common/Study/StudyChat.js frontend/webapp/src/views/_Common/PopUp.js frontend/webapp/src/views/Facsimiles/Facsimiles.js frontend/webapp/src/assets/theme/scss/darkmode/_studybar.scss
git commit -m "fix(darkmode): move hardcoded inline colors to theme-aware classes"
```

---

### Task 10: Read / Page / Search partial

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_read-page.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/read-page";`)

- [ ] **Step 1: Write the partial** (CategoryPanels, PassageNotes, Read skeletons, art bubbles, Narration, ScripturePanel, Commentary/ATV, SearchPopUp, Search, PopUp.css, Page.css gaps)

```scss
html[data-theme="dark"] {

  /* CategoryPanels.scss + BasePanel.scss */
  .base-panel { background: var(--surface-2); color: var(--text-secondary); }
  .category-panel-header { background: var(--surface-3); border-bottom-color: var(--border); color: var(--text-primary); }
  .close-button:hover { background: var(--surface-4); }
  .category-data { background: var(--surface-3); border-color: var(--border); }
  .panel-header { background-color: var(--surface-3); border-bottom-color: var(--border); }

  /* PassageNotes(.new).scss */
  .passage-notes .category-tabs { background: var(--surface-2); border-top-color: var(--border); }
  .category-tabs .category-tab {
    background: var(--surface-3); color: var(--text-secondary); border-color: var(--border);
    &.active { background: var(--surface-4); color: var(--text-primary); }
  }

  /* Read.scss skeleton loaders */
  .skeleton-section { background-color: var(--surface-2); }
  .skeleton-heading, .skeleton-study-btn, .skeleton-avatar, .skeleton-voice, .skeleton-text-line {
    background: linear-gradient(90deg, #2e2e2e 25%, #3a3a3a 50%, #2e2e2e 75%);
    background-size: 200% 100%;
  }

  /* TextContent.css art bubbles */
  .art_bubble {
    background-color: var(--surface-2); border-color: var(--border); color: var(--text-muted);
    &:hover { outline-color: rgba(255, 255, 255, 0.25); }
    &.active { outline-color: rgba(240, 173, 78, 0.4); }
  }

  /* Narration.css panels */
  .narration .images { background-color: var(--surface-3); }
  .thumb_tabs li { background-color: var(--surface-3); &.active { background-color: var(--surface-4); } }
  .peoplePlacePanelWrapper, .notesPanelWrapper, .scripturePanelWrapper { background-color: var(--surface-2); }
  .peoplePlacePanel, .scripturePanel { background-color: var(--surface-3); color: var(--text-secondary); }
  .noteItem { background-color: var(--surface-3); color: var(--text-secondary); }

  /* Page.css:328 mobile alternating rows */
  .card-body:nth-child(even) { background-color: var(--surface-2); }

  /* ScripturePanel.css */
  .scriptureContainerWrapper { background-color: var(--surface-2); }
  .scripturePanelSingle h5 { background-color: var(--surface-3); color: var(--text-secondary); }
  .scripturePanelSingle .text { background-color: var(--surface-2); color: var(--text-secondary); }
  .scripturePanelSingle .scriptureTextHeader .btn { background-color: var(--control); color: var(--text-primary); }

  /* Commentary.css */
  .atv { background-color: var(--surface-3); color: var(--text-muted); }
  .atv-string { background-color: var(--surface-2); color: var(--text-primary); }
  .commentary_hide_button.show_button { background-color: rgba(255, 255, 255, 0.15); }

  /* PopUp.css */
  .popupwindow { background-color: var(--surface-2); color: var(--text-secondary); }
  .popupwindow h3 { border-bottom-color: var(--border-strong); }
  .notice { background-color: rgba(240, 173, 78, 0.12); border-color: rgba(240, 173, 78, 0.4); color: var(--text-secondary); }
  .xrels .xrel { border-bottom-color: var(--border); }
  .xrels .xrel .rel-verb { background: var(--surface-3); a { color: var(--text-secondary); } }

  /* SearchPopUp.css */
  .search-popup {
    background-color: var(--surface-2); color: var(--text-secondary);
    .card-header { border-bottom-color: var(--border); }
    .card-header input { background-color: var(--surface-4); color: var(--text-primary); border-color: var(--border); }
    .search-result.selected { background-color: rgba(147, 198, 239, 0.15); }
    .search-result-info { color: var(--text-muted); }
    .highlight { background-color: var(--highlight); color: var(--text-primary); }
  }

  /* Search.css:98 */
  .search .searchboxWrapper { background-color: var(--surface-2); border: 1px solid var(--border); }
}
```

- [ ] **Step 2: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 3: Visual check** — `/read` (panels + tab bar + reload for skeletons), any Page narration route (image panel, notes, people/places panels, art bubbles), `/search`, and the in-app search popup (keyboard shortcut or header search).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_read-page.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): Read, Page, Narration, scripture panels, search"
```

---

### Task 11: Home / User partial

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_home-user.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/home-user";`)

- [ ] **Step 1: Write the partial** (Home.css, StudyGroupFeed.css, Profile.css, Preferences.css, PictureWithOverlay.css, SignIn.css/User.css heatmap, ProgressBox.css, MobileUser.css gaps)

```scss
html[data-theme="dark"] {

  /* Home.css leftovers */
  .Community .groupCard .groupMessage .groupMessageAvatar img { background-color: var(--surface-4); }
  .Community .groupCard .groupMembers { background-color: var(--surface-4); }
  .cardTip li img { background-color: var(--text-secondary); }
  .cardTip li div.tip-progress div { color: var(--accent-green-soft); background-color: rgba(107, 208, 152, 0.35); }

  /* StudyGroupFeed.css placeholders */
  .homeFeedHeader .blankWord { color: var(--surface-4); background-color: var(--surface-4); }

  /* Profile.css */
  .profileImage { background-color: var(--surface-3); border-color: var(--border); }
  .profileCard .threedots:hover { background-color: var(--surface-3); }
  .profileDropdown .dropdown-menu.show { border-color: var(--border); }

  /* Preferences.css:68 */
  .publicationCard .card-header .source_publisher { color: var(--text-muted); }

  /* PictureWithOverlay.css:65 — white uploader modal */
  .imageUploaderWrapper { background: var(--surface-2); color: var(--text-secondary); }

  /* SignIn.css / User.css: input prepend + study history headers */
  .input-group-prepend { background-color: var(--surface-3); }
  .studyYear > h2 { background-color: var(--surface-3); color: var(--text-primary); }
  .studyMonth > h2 { border-bottom-color: var(--border); }

  /* react-calendar-heatmap (SVG fills; CSS beats presentation attributes) */
  .react-calendar-heatmap .color-scale-null { fill: var(--surface-3); }
  .tab-pane .react-calendar-heatmap rect.color-empty { fill: var(--surface-3); }
  .react-calendar-heatmap text { fill: var(--text-muted); }

  /* ProgressBox.css */
  .ProgressBox .nav-tabs .nav-item:hover a { color: var(--text-primary); background-color: var(--surface-3); }
  .nav-tabs-navigation.verical-navs { border-right-color: var(--border); }
  .ProgressBoxPane .sectionBox { background-color: var(--surface-3); color: var(--text-muted); }
  .ProgressBoxPane .sectionDots { border-right-color: var(--border-strong); }

  /* MobileUser.css CircularProgressbar (SVG) */
  .divisionProgressItem .CircularProgressbar .CircularProgressbar-path { stroke: var(--accent-green); }
  .divisionProgressItem .CircularProgressbar .CircularProgressbar-trail { stroke: var(--surface-4); }
  .divisionProgressItem .CircularProgressbar .CircularProgressbar-text { fill: var(--text-primary); }
}
```

- [ ] **Step 2: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 3: Visual check** — `/home` (group cards, feed placeholders while loading), own profile page (study-history heatmap cells visible, progress box tabs), preferences page, avatar upload dialog, mobile profile view.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_home-user.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): Home and User surfaces incl. heatmap and progress widgets"
```

---

### Task 12: People / Places / Objects partial (shared list-page patterns)

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_lists.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/lists";`)

- [ ] **Step 1: Write the partial**

```scss
html[data-theme="dark"] {

  /* Shared card-footer pattern (People.css:263, Places.css:119, Objects.css:113) */
  .peopleList .card-footer, .PlaceList .card-footer, .ObjectList .card-footer {
    background-color: var(--surface-3);
    border-color: var(--border);
    color: var(--text-secondary);
  }

  /* IdBadges: keep hue identity, normalize for dark. Blanket base then rely on
     existing per-category colors only where they're mid-tone enough to survive. */
  .peopleList .IdBadge, .PlaceList .IdBadge, .ObjectList .IdBadge {
    filter: brightness(0.85) saturate(0.9);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }

  /* People.css */
  h5.ppFiltersHeading { color: var(--text-secondary); }
  .lifoot .btn { background-color: var(--control); border-color: var(--border-strong); color: var(--text-primary); }
  .personIcons img { opacity: 0.75; filter: invert(1); }

  /* Places.css */
  .PlaceList h7 { color: var(--text-muted); }
  .card-body.placeInfo div.location { color: rgba(255, 255, 255, 0.75); }

  /* Objects.css era badges */
  .ObjectList .IdBadge[class*="era-"] { background-color: var(--surface-4) !important; color: var(--text-secondary); }
}
```

- [ ] **Step 2: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 3: Visual check** — `/people`, `/places`, `/objects`: filter panel (already partially covered by legacy `.ppFilters` rules), badges legible, card footers dark. If any specific badge category is still unreadable, add a targeted override in this partial using its class name from `Objects.css:145-187`.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_lists.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): People/Places/Objects list pages"
```

---

### Task 13: History / Witnesses partial + WitnessLifeHeatmap variable conversion

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_history.scss`
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.css` (convert palette to CSS variables)
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/history";`)

- [ ] **Step 1: Write the history partial**

```scss
html[data-theme="dark"] {
  /* History.css */
  .historicaldocs .card { background-color: var(--surface-2); border-color: var(--border); color: var(--text-secondary); }
  .historicaldocs .sourcebox .pub { color: var(--text-secondary); }
  .historicaldocs .sourcebox .date { color: var(--text-muted); }
  .historicaldocs .citation { color: var(--text-muted); }
  .teaser { background-color: var(--surface-3); color: var(--text-secondary); border-color: var(--border); }

  /* Witnesses.css */
  .witnesses .witness-age { background-color: rgba(255, 255, 255, 0.08); color: var(--text-secondary); }
  .witnesses .witness-statement { color: var(--text-secondary); strong, b { color: var(--text-primary); } }
  .witnesses h5 { color: var(--text-muted); }
  .single-witnesses .witness-breadcrumbs { color: var(--text-secondary); a:hover { color: var(--text-primary); } }
  .single-witnesses .witness-breadcrumbs .breadcrumb-dropdown {
    background: var(--surface-2); border-color: var(--border); color: var(--text-secondary);
  }
  .single-witnesses .witness-breadcrumbs .breadcrumb-option:hover { background: var(--surface-3); color: var(--text-primary); }
  .single-witnesses .witness-breadcrumbs .breadcrumb-option.current { background: var(--surface-4); color: var(--text-primary); }
  .single-witnesses .witness-hero-portrait { background-color: var(--surface-3); }
  .single-witnesses .witness-hero-facts { color: var(--text-secondary); }
  .single-witnesses .witness-hero-facts-label { color: var(--text-muted); }
  .single-witnesses .witness-bio { color: var(--text-secondary); }
  .single-witnesses .witness-sources .historycard { background-color: var(--surface-2); border-color: var(--border); }
}
```

- [ ] **Step 2: Convert WitnessLifeHeatmap.css to variables**

At the top of `WitnessLifeHeatmap.css`, add:

```css
.witness-life-heatmap {
  --hm-bg: #ffffff;
  --hm-panel: #fafafa;
  --hm-grid: #c8c8c8;
  --hm-cell: #ffffff;
  --hm-level-1: #c6e48b;
  --hm-level-2: #7bc96f;
  --hm-level-3: #239a3b;
  --hm-level-4: #196127;
  --hm-event: #1565c0;
  --hm-death: #c62828;
  --hm-text: #555555;
  --hm-text-soft: #777777;
  --hm-text-faint: #999999;
  --hm-border: #dcdcdc;
}
html[data-theme="dark"] .witness-life-heatmap {
  --hm-bg: #222222;
  --hm-panel: #2a2a2a;
  --hm-grid: #3a3a3a;
  --hm-cell: #2e2e2e;
  --hm-level-1: #1f4423;
  --hm-level-2: #2c6a30;
  --hm-level-3: #3f9446;
  --hm-level-4: #5cb85c;
  --hm-event: #64a5e8;
  --hm-death: #e57373;
  --hm-text: #cccccc;
  --hm-text-soft: #aaaaaa;
  --hm-text-faint: #888888;
  --hm-border: #444444;
}
```

Then replace every hardcoded occurrence in the rest of the file with the matching variable (exact substitutions):

| Old value | New value |
|---|---|
| `#FFF`, `#fff`, `#ffffff` (cell/backgrounds) | `var(--hm-cell)` (grid cells) / `var(--hm-bg)` (container) |
| `#FAFAFA` | `var(--hm-panel)` |
| `#C8C8C8` | `var(--hm-grid)` |
| `#c6e48b` | `var(--hm-level-1)` |
| `#7bc96f` | `var(--hm-level-2)` |
| `#239a3b` | `var(--hm-level-3)` |
| `#196127` | `var(--hm-level-4)` |
| `#1565c0` | `var(--hm-event)` |
| `#c62828` | `var(--hm-death)` |
| `#555`, `#444`, `#333` (text) | `var(--hm-text)` |
| `#777`, `#666` (text) | `var(--hm-text-soft)` |
| `#999`, `#BBB` | `var(--hm-text-faint)` |
| `#DCDCDC`, `#BBB` (borders) | `var(--hm-border)` |
| `#000` (hover cell border) | `var(--hm-text)` |

Note: if the legend swatches get their colors from inline styles in `WitnessLifeHeatmap.js`, change those inline values to the same `var(--hm-level-N)` strings (CSS variables are valid in inline styles): `style={{ backgroundColor: "var(--hm-level-1)" }}` etc.

- [ ] **Step 3: Import partial, compile check** — expected `COMPILE_OK`.

- [ ] **Step 4: Visual check** — `/history` and a witness detail page: doc cards, teasers, breadcrumb dropdown, and the life heatmap legible in BOTH themes (light mode must look identical to before).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_history.scss frontend/webapp/src/views/History/WitnessLifeHeatmap.css frontend/webapp/src/views/History/WitnessLifeHeatmap.js frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): History/Witnesses + variable-driven life heatmap palette"
```

---

### Task 14: Map / Timeline (Leaflet) partial + RangeSlider tokens

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_maps.scss`
- Modify: `frontend/webapp/src/views/Map/RangeSlider.scss:80-107`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/maps";`)

- [ ] **Step 1: Write the maps partial**

```scss
html[data-theme="dark"] {

  /* Map.css */
  #map { background-color: #22303c; }
  #map .ol-viewport { border-color: var(--border); }
  .mapPanel select, .mapPanel input { border-color: var(--border); background-color: var(--surface-4); color: var(--text-primary); }
  .mapPanel h5 { color: var(--text-primary); }
  .map-type-active { background-color: var(--surface-4); color: var(--text-primary); }
  .map-place-brief-info, .map-place-info { color: var(--text-secondary); }
  .mapTooltip {
    background-color: var(--surface-3); border-color: var(--border-strong); color: var(--text-secondary);
    &::after { border-top-color: var(--surface-3); }
  }
  .closePanelButton { color: var(--text-muted); &:hover { color: var(--text-primary); } }
  .mapPanel .nav-tabs .nav-item { color: var(--text-muted); &:hover { color: var(--text-primary); } }
  .mapPanel .nav-tabs .nav-item.active { color: var(--text-primary); border-color: var(--border); }
  .mapPanel .place_refs .ref { color: var(--text-muted); }
  .mapPanel .counter { background-color: var(--control); color: var(--text-primary); &.active { color: var(--text-primary); background-color: var(--control-hover); } }
  .mapPanel .mapPanelScripture { background-color: rgba(255, 255, 255, 0.06); }
  .map-story { background: var(--surface-3); color: var(--text-secondary); &:hover { background: var(--surface-4); border-color: var(--border-strong); } }
  .rangeSliderContainer span { color: var(--text-muted); }

  /* Leaflet chrome (Timeline + Map) */
  .leaflet-bar a { background-color: var(--surface-3); color: var(--text-primary); border-bottom-color: var(--border); &:hover { background-color: var(--surface-4); } }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: var(--surface-2); color: var(--text-secondary); }
  .leaflet-popup-content h2 { color: var(--text-primary); }
  .leaflet-popup-content p { color: var(--text-muted); }
  .leaflet-popup-content a { color: var(--link); }
  .leaflet-container .leaflet-control-attribution { background: rgba(26, 26, 26, 0.7); color: var(--text-muted); }
  .leaflet-marker-container .heading-link { color: var(--text-secondary); }
  .leaflet-marker-container .heading { color: var(--text-primary); }
  .leaflet-tooltip { background-color: var(--surface-3); border-color: var(--border); color: var(--text-primary); }

  /* Dark tile treatment for the base map (standard dark-map filter) */
  .leaflet-tile-pane { filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7); }
}
```

Note on the tile filter: this is the well-known CSS-filter dark-map technique. If the Timeline's tiles are custom illustrated maps (not street tiles) and the filter looks wrong there, scope it to `#map .leaflet-tile-pane` only (the OpenLayers/Leaflet map view) and leave Timeline tiles unfiltered — decide by looking at both routes.

- [ ] **Step 2: Tokenize RangeSlider.scss**

In `RangeSlider.scss`, replace `background: lightgrey;` (line ~82 in `.rail`) with `background: var(--surface-4);`, and both `#3f51b5` occurrences (`.inner-rail`, `.control`) with `var(--accent-green)`. These vars resolve in both themes via `_tokens.scss` — verify light mode still looks correct (rail was light grey; `--surface-4` is `#dddddd` in light, equivalent).

- [ ] **Step 3: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 4: Visual check** — `/map` (panel, tooltips, controls, slider, tiles) and `/timeline` (Leaflet popups, markers, zoom controls) in dark mode; both unchanged in light mode.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_maps.scss frontend/webapp/src/views/Map/RangeSlider.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): Map and Timeline incl. Leaflet chrome and dark tiles"
```

---

### Task 15: Content pages partial (Facsimiles, About, Contact, Contents, Audit, Analysis, Welcome, Theater)

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_content-pages.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (add `@import "./darkmode/content-pages";`)

- [ ] **Step 1: Write the partial**

```scss
html[data-theme="dark"] {

  /* Facsimiles.scss / FacsimilePageViewer.scss */
  .card .card-body.faxInfo { border-color: var(--border); }
  .faxGridViewer .faxPage { outline-color: var(--border); }
  .facsimile-navigation { background: var(--surface-2); }
  .facsimile-navigation .nav-button {
    background: var(--surface-3); color: var(--text-secondary);
    &:hover { background: var(--surface-4); }
  }
  .custom-slider { background: var(--surface-4); }
  .custom-slider::-webkit-slider-thumb { background: var(--text-secondary); }
  .custom-tooltip { background: var(--surface-3); border-color: var(--border); color: var(--text-secondary); }
  .seekBlocks { outline-color: var(--border); border-color: var(--border); }
  .stack-tooltip-content { background: var(--surface-2); border-color: var(--border); color: var(--text-secondary); }
  .pageReferences h6 { color: var(--text-muted); }

  /* About.css / KRSEB.css */
  .about .card-body a { color: var(--link); &:hover { color: var(--link-hover); } }
  .about .card-body img { opacity: 0.85; }
  .KRSEBDesc .description h2 { color: var(--text-primary); }

  /* Contact.css */
  .contact .btn { background-color: var(--control); color: var(--text-primary); &:hover { background-color: var(--control-hover); } }
  .dragField { border-color: var(--border-strong); }
  .contact .imageUploaderWrapper { background: var(--surface-2); }

  /* Contents.css */
  div.toc ul:not(:first-of-type) { border-color: var(--border); background-color: rgba(255, 255, 255, 0.03); }
  .divImg div { background-color: rgba(0, 0, 0, 0.6); }

  /* Audit.css */
  .keyboardLabel { background-color: rgba(255, 255, 255, 0.12); color: var(--text-secondary); }
  .bomtypes li { background-color: rgba(255, 255, 255, 0.08); }
  .context-card h3 { border-color: var(--border); }

  /* Analysis.css */
  .notready { filter: brightness(0.5) contrast(0.5); }

  /* Theater.css */
  .theater-meta-content-narration li { color: var(--text-muted); }
  .theater-meta-content-narration li.active { background-color: var(--surface-4); color: var(--text-primary); }
  .theater-main-panel .theater-progress-bar-buttons .playbackRateIcon { background-color: var(--surface-4); color: var(--text-primary); }
  .theater-main-panel .theater-config { background-color: var(--surface-2); color: var(--text-secondary); }
  .theater-config-value { background-color: var(--surface-3); color: var(--text-secondary); }
  .theater-comment-feed .comment-text { background-color: var(--surface-3); color: var(--text-secondary); }
  .theater-comment-feed .comment:hover .comment-text { background-color: var(--surface-4); }
  .theater-comment-feed .comment .triangle { color: var(--surface-3); border-right-color: var(--surface-3); }
}
```

- [ ] **Step 2: Import, compile check** — expected `COMPILE_OK`.

- [ ] **Step 3: Visual check** — `/facsimiles` (grid + page viewer + navigation), `/about`, `/contact`, `/contents`, `/theater` (config popover, narration list, comment feed).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/assets/theme/scss/darkmode/_content-pages.scss frontend/webapp/src/assets/theme/scss/darkmode.scss
git commit -m "feat(darkmode): Facsimiles, About, Contact, Contents, Audit, Theater"
```

---

### Task 16: Theme utility for JS-configured colors

Charts/tooltips get colors via JS props; give them one theme source.

**Files:**
- Create: `frontend/webapp/src/utils/themeColors.js`
- Create: `frontend/webapp/src/utils/themeColors.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/utils/themeColors.test.js`:

```js
import { isDarkTheme, tooltipTheme, chartTheme } from "./themeColors";

describe("themeColors", () => {
  afterEach(() => document.documentElement.removeAttribute("data-theme"));

  it("detects the html data-theme attribute", () => {
    expect(isDarkTheme()).toBe(false);
    document.documentElement.setAttribute("data-theme", "dark");
    expect(isDarkTheme()).toBe(true);
  });

  it("returns dark tooltip colors in dark mode", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    expect(tooltipTheme().backgroundColor).toBe("#333333");
    expect(tooltipTheme().textColor).toBe("#ffffff");
  });

  it("returns light tooltip colors otherwise", () => {
    expect(tooltipTheme().backgroundColor).toBe("#666666");
    expect(tooltipTheme().textColor).toBe("#ffffff");
  });

  it("returns a dark chart background in dark mode", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    expect(chartTheme().chart.backgroundColor).toBe("#222222");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend/webapp && CI=true npx react-scripts test src/utils/themeColors.test.js --watchAll=false
```

Expected: FAIL — `Cannot find module './themeColors'`.

- [ ] **Step 3: Implement**

Create `frontend/webapp/src/utils/themeColors.js`:

```js
// Single source of truth for colors configured through JS props
// (Highcharts, react-tooltip, canvas) that CSS cannot reach.
// Reads the html[data-theme] attribute set before first paint (index.html)
// and kept in sync by Main.js.

export const isDarkTheme = () =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "dark";

export const tooltipTheme = () =>
  isDarkTheme()
    ? { backgroundColor: "#333333", textColor: "#ffffff", border: true, borderColor: "#555555" }
    : { backgroundColor: "#666666", textColor: "#ffffff", border: false, borderColor: "#666666" };

export const chartTheme = () =>
  isDarkTheme()
    ? {
        chart: { backgroundColor: "#222222" },
        title: { style: { color: "#ffffff" } },
        subtitle: { style: { color: "#dddddd" } },
        legend: { itemStyle: { color: "#dddddd" }, itemHoverStyle: { color: "#ffffff" } },
        xAxis: { labels: { style: { color: "#aaaaaa" } }, lineColor: "#555555", tickColor: "#555555", gridLineColor: "#333333" },
        yAxis: { labels: { style: { color: "#aaaaaa" } }, lineColor: "#555555", tickColor: "#555555", gridLineColor: "#333333" },
        tooltip: { backgroundColor: "#333333", style: { color: "#ffffff" } },
      }
    : {
        chart: { backgroundColor: "#FFFFFF" },
        title: { style: { color: "#333333" } },
        subtitle: { style: { color: "#666666" } },
        legend: { itemStyle: { color: "#333333" }, itemHoverStyle: { color: "#000000" } },
        xAxis: { labels: { style: { color: "#666666" } }, lineColor: "#ccd6eb", tickColor: "#ccd6eb", gridLineColor: "#e6e6e6" },
        yAxis: { labels: { style: { color: "#666666" } }, lineColor: "#ccd6eb", tickColor: "#ccd6eb", gridLineColor: "#e6e6e6" },
        tooltip: { backgroundColor: "rgba(247,247,247,0.85)", style: { color: "#333333" } },
      };
```

- [ ] **Step 4: Run test to verify it passes** — same command; expected PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/utils/themeColors.js frontend/webapp/src/utils/themeColors.test.js
git commit -m "feat(darkmode): themeColors utility for JS-configured widget colors"
```

---

### Task 17: Apply themeColors to all ReactTooltip call sites

Components re-render on preference change (appController state), so reading the DOM attribute at render time is sufficient.

**Files:**
- Modify: `frontend/webapp/src/views/Home/Home.js:164,172`
- Modify: `frontend/webapp/src/views/Home/Feed.js:143,152`
- Modify: `frontend/webapp/src/views/Page/PersonPlace.js:97`
- Modify: `frontend/webapp/src/views/Page/Section.js:52`
- Modify: `frontend/webapp/src/views/Page/TextContent.js:431`

- [ ] **Step 1: Apply the same mechanical change to each file**

In each listed file, add the import:

```js
import { tooltipTheme } from "src/utils/themeColors";
```

Then on each `<ReactTooltip ...>` at the listed lines, replace the hardcoded color props. Pattern — before:

```jsx
<ReactTooltip id="..." backgroundColor="#666" ... />
```

after:

```jsx
<ReactTooltip id="..." backgroundColor={tooltipTheme().backgroundColor} textColor={tooltipTheme().textColor} ... />
```

Specifics:
- `Home.js:164` (`#666`) and `Home.js:172` (`#EEE` card tip): both become `tooltipTheme().backgroundColor`. For the `#EEE` cardTip, also keep the existing `.cardTip` CSS class overrides (already in darkmode.scss) — the prop change just stops the inline style from fighting them.
- `Feed.js:143` (white privacyTip) and `Feed.js:152` (`#666` + `color="#000"`): replace `backgroundColor` with `tooltipTheme().backgroundColor` and any `color`/`textColor` prop with `tooltipTheme().textColor`.
- `PersonPlace.js:97`, `Section.js:52`, `TextContent.js:431`: replace `backgroundColor={"#666"}`/`backgroundColor="#666"` with `backgroundColor={tooltipTheme().backgroundColor}`.

- [ ] **Step 2: Visual check** — hover the tooltips on `/home` (group cards, like counts, privacy icons) and on a Page route (person/place links, section headers) in both themes. Dark: `#333` tooltip; light: same appearance as before.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Home/Home.js frontend/webapp/src/views/Home/Feed.js frontend/webapp/src/views/Page/PersonPlace.js frontend/webapp/src/views/Page/Section.js frontend/webapp/src/views/Page/TextContent.js
git commit -m "fix(darkmode): theme-aware ReactTooltip colors via themeColors util"
```

---

### Task 18: Theme-aware Highcharts (History.js)

**Files:**
- Modify: `frontend/webapp/src/views/User/History.js:~240-260` (the Highcharts options object containing `backgroundColor: "#FFF"` at line 250)

- [ ] **Step 1: Merge the chart theme into the options**

Add the import:

```js
import { chartTheme } from "src/utils/themeColors";
```

In the options object around line 250, remove the hardcoded `backgroundColor: "#FFF"` from `chart: {...}` and merge the theme. Pattern — if the options are built as an object literal `const options = { chart: {...}, xAxis: {...}, ... }`, wrap with a deep-ish merge:

```js
const theme = chartTheme();
const options = {
  ...baseOptions,
  chart: { ...baseOptions.chart, ...theme.chart },
  title: { ...baseOptions.title, ...theme.title },
  legend: { ...(baseOptions.legend || {}), ...theme.legend },
  xAxis: { ...(baseOptions.xAxis || {}), ...theme.xAxis },
  yAxis: { ...(baseOptions.yAxis || {}), ...theme.yAxis },
  tooltip: { ...(baseOptions.tooltip || {}), ...theme.tooltip },
};
```

(where `baseOptions` is the existing literal, renamed). Preserve every existing option; only layer theme colors on top.

- [ ] **Step 2: Visual check** — profile → study history chart in both themes: dark background/labels in dark mode, unchanged in light mode. Toggle the preference while the chart is visible and confirm it re-renders correctly (navigate away/back if the component doesn't re-render on pref change).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/User/History.js
git commit -m "fix(darkmode): theme-aware Highcharts study history chart"
```

---

### Task 19: Dark-mode logo variant

The logo circle `#323b4d` is near-invisible on `#1a1a1a` (Header.js:13,53).

**Files:**
- Create: `frontend/webapp/src/views/_Common/svg/logo-dark.svg`
- Modify: `frontend/webapp/src/views/_Common/Header.js:13,53` (and mobile logo usage ~line 115 if it uses the same asset)

- [ ] **Step 1: Create the dark variant**

```bash
cp frontend/webapp/src/views/_Common/svg/logo.svg frontend/webapp/src/views/_Common/svg/logo-dark.svg
```

Edit `logo-dark.svg`: replace fill `#323b4d` with `#8a97b3` (lightened ring that reads on `#1a1a1a`; keep the `#FBC658` star unchanged).

- [ ] **Step 2: Swap by theme in Header.js**

```js
import logoDark from "./svg/logo-dark.svg";
import { isDarkTheme } from "src/utils/themeColors";
```

At each `<img src={logo} ...>` site (line ~53; check ~115 for the mobile logo — if it's the same svg, swap it too):

```jsx
<img src={isDarkTheme() ? logoDark : logo} ... />
```

- [ ] **Step 3: Visual check** — header logo clearly visible in both themes (Header re-renders on pref toggle since it subscribes to appController state; verify, and if it doesn't, toggle + reload is acceptable given the FOUC guard sets the attribute pre-paint).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/_Common/svg/logo-dark.svg frontend/webapp/src/views/_Common/Header.js
git commit -m "feat(darkmode): dark-variant logo"
```

---

### Task 20: Full-route QA sweep + audit close-out

**Files:**
- Modify: `docs/audits/2026-07-13-darkmode-coverage-audit.md` (status annotations)

- [ ] **Step 1: Route-by-route two-theme pass**

For each route below, load `http://localhost:8200<route>` in dark then light mode, checking: no white/light panels, all text ≥ readable contrast, hover states visible, tooltips/modals/dropdowns dark, no light-mode regressions.

```
/home  /read  (a Page route, e.g. /alma/32)  /search  /people  /places  /objects
/map  /timeline  /theater  /contents  /facsimiles  /about  /contact
/history  (a witness detail)  /community  (Study Hall)  /user/preferences  (own profile)
```

Also: mobile viewport (bottom nav, mobile menu, mobile study), the notification popup, search popup, a sweetalert, a toast, the drawer, and a fresh private-window load (FOUC + OS-preference default).

- [ ] **Step 2: Fix-forward**

Any residual light surface found: add the override to the matching partial (tokens only), commit as `fix(darkmode): <surface>`.

- [ ] **Step 3: Run the two unit test files**

```bash
cd frontend/webapp && CI=true npx react-scripts test "src/(models/preferenceMigration|utils/themeColors)" --watchAll=false
```

Expected: 8 tests pass.

- [ ] **Step 4: Close out the audit doc**

At the top of `docs/audits/2026-07-13-darkmode-coverage-audit.md`, add:

```markdown
> **Status 2026-MM-DD:** Resolved by `feat/darkmode-overhaul` (see `docs/plans/2026-07-13-darkmode-overhaul.md`). §1 defects fixed (html[data-theme] scoping, color-scheme, darkMode key, FOUC guard); §2 gaps covered by tokenized partials under `src/assets/theme/scss/darkmode/`.
```

- [ ] **Step 5: Commit**

```bash
git add docs/audits/2026-07-13-darkmode-coverage-audit.md
git commit -m "docs(darkmode): mark audit resolved by overhaul branch"
```

---

## Execution notes

- **Order matters for Tasks 0–4** (branch → scope → prefs → FOUC → tokens); Tasks 5–15 are independent of each other and can run in any order (all depend on Task 4's tokens); Tasks 17–19 depend on Task 16; Task 20 is last.
- **Do not restart `bom-dev`** for any of this — CRA HMR picks up all src changes. If `public/index.html` changes don't appear, a hard browser reload suffices; only restart the unit if HMR wedges (restarts are authorized but note them).
- **Never verify against `bom.kckern.net`** — Cloudflare serves a stale bundle for up to 4h.
- The legacy body of `darkmode.scss` (the pre-existing ~1180 lines) intentionally keeps its raw hex values for now; migrating it to tokens is a follow-up refactor, not part of this plan (YAGNI — it already renders correctly).
