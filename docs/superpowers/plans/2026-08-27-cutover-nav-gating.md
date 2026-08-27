# Cutover Nav-Gating + Centralized Feature-Flag Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the Home (Explore+Community), Matters, and History nav entrances and disable the PassageNotes reader panel in **production builds only**, controlled from a single `config/features.yml`, while every route/permalink stays live.

**Architecture:** A build-time codegen step compiles `config/features.yml` → committed `src/config/features.generated.json`; `src/models/featureFlags.js` reads it and exports `HIDE_*` constants gated on `NODE_ENV==='production'` (so dev/test always show everything). Consumers: a new pure `filterMenu()` drops flagged sidebar items, the header logo link and the Matters search group are guarded, and the existing `PASSAGE_NOTES_ENABLED` env flag is consolidated onto `HIDE_PASSAGE_NOTES`.

**Tech Stack:** React 17 (CRA via react-app-rewired), Jest (react-scripts test), js-yaml (new devDep), Node build script.

**Spec:** `docs/specs/2026-08-27-cutover-nav-gating.md`

**All paths below are relative to `frontend/webapp/`.** Run all commands from `frontend/webapp/`.

---

## File Structure

**Create:**
- `config/features.yml` — the single hand-edited source of truth.
- `scripts/gen-features.js` — Node script: yml → generated json (write-if-changed).
- `src/config/features.generated.json` — generated + committed; imported by featureFlags.
- `src/views/_Common/menuFilter.js` — pure sidebar-menu visibility filter.
- `src/views/_Common/__tests__/menuFilter.test.js` — unit tests for the filter.

**Modify:**
- `package.json` — `prestart`/`prebuild` hooks + `js-yaml` devDep.
- `src/models/featureFlags.js` — read generated json, export `HIDE_*` constants.
- `src/views/_Common/menuConfig.js` — `hiddenFlag` on home/matters/history items.
- `src/views/_Common/Sidebar.js` — imports, refactor `loadMenu` to use `filterMenu`, unfiltered slugs for active-path.
- `src/views/_Common/__tests__/sidebarPath.test.js` — add hidden-room active-path cases.
- `src/views/_Common/Header.js` — guard logo `/home` link.
- `src/views/Search/Search.js` — guard the Matters `ResultGroup`.
- `src/views/Read/Read.js` + `src/views/Read/components/ChapterContent.js` — `PASSAGE_NOTES_ENABLED` from `HIDE_PASSAGE_NOTES`.
- `.env.example` — drop `REACT_APP_ENABLE_PASSAGE_NOTES`.

---

## Task 1: Feature-flag config plumbing (YAML → committed JSON)

**Files:**
- Modify: `package.json`
- Create: `config/features.yml`
- Create: `scripts/gen-features.js`
- Create: `src/config/features.generated.json`

- [ ] **Step 1: Add `js-yaml` as a devDependency**

Run: `npm install --save-dev js-yaml@^4.1.0`
Expected: `package.json` `devDependencies` gains `"js-yaml": "^4.1.0"`; installs without error.

- [ ] **Step 2: Create `config/features.yml`**

Create `config/features.yml`:

```yaml
# Feature-flag config. Hand-edited; scripts/gen-features.js compiles it to
# src/config/features.generated.json at build time (prestart/prebuild).
#
# All flags below are HONORED IN PRODUCTION BUILDS ONLY (NODE_ENV=production).
# In dev (npm start) and tests everything is shown regardless of these values.
# NOTE: one prod build serves both staging and prod, so STAGING ALSO applies
# these (accepted).

homeNav:      { hidden: true }   # hide "Home" (Explore + Community) menu entrance
mattersNav:   { hidden: true }   # hide "Matters" menu + search-result group
historyNav:   { hidden: true }   # hide "History" menu entrance
passageNotes: { hidden: true }   # disable the whole reader-margin PassageNotes panel
```

- [ ] **Step 3: Create `scripts/gen-features.js`**

Create `scripts/gen-features.js`:

```js
/* Compiles config/features.yml -> src/config/features.generated.json at build
 * time (wired to package.json prestart/prebuild). Writes only when the output
 * content changes, so it never churns webpack's watch tree on `npm start`. */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'config', 'features.yml');
const OUT = path.join(ROOT, 'src', 'config', 'features.generated.json');

const parsed = yaml.load(fs.readFileSync(SRC, 'utf8')) || {};
const json = JSON.stringify(parsed, null, 2) + '\n';

const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (current === json) {
  console.log('[gen-features] up to date');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  console.log(`[gen-features] wrote ${path.relative(ROOT, OUT)}`);
}
```

- [ ] **Step 4: Run the codegen and verify the generated JSON**

Run: `node scripts/gen-features.js && cat src/config/features.generated.json`
Expected: prints `[gen-features] wrote src/config/features.generated.json`, then:

```json
{
  "homeNav": {
    "hidden": true
  },
  "mattersNav": {
    "hidden": true
  },
  "historyNav": {
    "hidden": true
  },
  "passageNotes": {
    "hidden": true
  }
}
```

- [ ] **Step 5: Verify write-if-changed is idempotent**

Run: `node scripts/gen-features.js`
Expected: prints `[gen-features] up to date` (no rewrite on the second run).

- [ ] **Step 6: Wire `prestart`/`prebuild` into package.json**

In `package.json` `scripts`, add these two keys (keep existing `start`/`build`):

```json
    "prestart": "node scripts/gen-features.js",
    "prebuild": "node scripts/gen-features.js",
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json config/features.yml scripts/gen-features.js src/config/features.generated.json
git commit -m "$(printf 'build(frontend): compile features.yml to committed json at build time\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Export `HIDE_*` flags from featureFlags.js

**Files:**
- Modify: `src/models/featureFlags.js`

- [ ] **Step 1: Add the JSON import at the top of the file**

At the very top of `src/models/featureFlags.js` (line 1, before the leading `/** @format */` is fine, or immediately after it), add:

```js
import features from '../config/features.generated.json';
```

- [ ] **Step 2: Append the prod-only cutover flags**

At the END of `src/models/featureFlags.js` (after the existing `export const USE_MESSENGER = isMessengerEnabled();` on line 63), append:

```js

/**
 * Cutover flags — honored in PRODUCTION BUILDS ONLY. In dev (`npm start`) and
 * Jest, NODE_ENV !== 'production', so these are always false and nothing is
 * hidden. A single prod build serves both staging and prod, so staging also
 * applies them (accepted). Source of truth: config/features.yml.
 */
const IS_PROD = process.env.NODE_ENV === 'production';

export const HIDE_HOME_NAV      = IS_PROD && !!features.homeNav?.hidden;
export const HIDE_MATTERS_NAV   = IS_PROD && !!features.mattersNav?.hidden;
export const HIDE_HISTORY_NAV   = IS_PROD && !!features.historyNav?.hidden;
export const HIDE_PASSAGE_NOTES = IS_PROD && !!features.passageNotes?.hidden;
```

- [ ] **Step 3: Verify the module compiles and dev-default is false**

Run: `node -e "process.env.NODE_ENV='development'; const f=require('@babel/register'); " 2>/dev/null; CI=true npm test -- --watchAll=false src/views/_Common/__tests__/sidebarPath.test.js`
Expected: the existing sidebarPath suite still PASSES (this confirms the shared module graph, incl. the new import, resolves under Jest). If Jest can't run the one-off node check above, ignore it — the `npm test` run is the real gate.

- [ ] **Step 4: Commit**

```bash
git add src/models/featureFlags.js
git commit -m "$(printf 'feat(frontend): add prod-only cutover feature flags from features.yml\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Pure `filterMenu()` module (TDD)

**Files:**
- Create: `src/views/_Common/menuFilter.js`
- Test: `src/views/_Common/__tests__/menuFilter.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/views/_Common/__tests__/menuFilter.test.js`:

```js
import { filterMenu } from "../menuFilter";

const base = { isDev: false, lang: "en", useMessenger: false, hiddenFlags: {} };
const slugs = (items) => items.map((i) => i.slug);

describe("filterMenu", () => {
  test("keeps a plain item", () => {
    const out = filterMenu([{ slug: "read" }], base);
    expect(slugs(out)).toEqual(["read"]);
  });

  test("hides an item whose hiddenFlag is set true", () => {
    const items = [{ slug: "read" }, { slug: "matters", hiddenFlag: "matters" }];
    const out = filterMenu(items, { ...base, hiddenFlags: { matters: true } });
    expect(slugs(out)).toEqual(["read"]);
  });

  test("keeps a hiddenFlag item when its flag is false", () => {
    const items = [{ slug: "matters", hiddenFlag: "matters" }];
    const out = filterMenu(items, { ...base, hiddenFlags: { matters: false } });
    expect(slugs(out)).toEqual(["matters"]);
  });

  test("hides only the flagged features, not siblings", () => {
    const items = [
      { slug: "home", hiddenFlag: "home" },
      { slug: "matters", hiddenFlag: "matters" },
      { slug: "history", hiddenFlag: "history" },
      { slug: "read" },
    ];
    const out = filterMenu(items, {
      ...base,
      hiddenFlags: { home: true, matters: true, history: true },
    });
    expect(slugs(out)).toEqual(["read"]);
  });

  test("respects requiresMessenger", () => {
    const items = [{ slug: "groups", requiresMessenger: true }];
    expect(slugs(filterMenu(items, { ...base, useMessenger: false }))).toEqual([]);
    expect(slugs(filterMenu(items, { ...base, useMessenger: true }))).toEqual(["groups"]);
  });

  test("respects dev-only items", () => {
    const items = [{ slug: "theology", dev: true }];
    expect(slugs(filterMenu(items, { ...base, isDev: false }))).toEqual([]);
    expect(slugs(filterMenu(items, { ...base, isDev: true }))).toEqual(["theology"]);
  });

  test("respects lang whitelist and langNot blacklist", () => {
    const items = [
      { slug: "fax", lang: ["en", "ko"] },
      { slug: "audit", langNot: ["en"] },
    ];
    expect(slugs(filterMenu(items, { ...base, lang: "en" }))).toEqual(["fax"]);
    expect(slugs(filterMenu(items, { ...base, lang: "fr" }))).toEqual(["audit"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npm test -- --watchAll=false src/views/_Common/__tests__/menuFilter.test.js`
Expected: FAIL — "Cannot find module '../menuFilter'".

- [ ] **Step 3: Implement `menuFilter.js`**

Create `src/views/_Common/menuFilter.js`:

```js
// Pure sidebar-menu visibility filter. Extracted from Sidebar.loadMenu so the
// gating rules (messenger / dev / language / cutover hidden-flags) can be
// unit-tested without importing the full Sidebar (crypto/svg/context imports).
//
// Operates on the RAW menuConfig items — which still carry `hiddenFlag` — so a
// prop-stripping map in loadMenu can never silently disable the hidden gate.
export function filterMenu(items, { hiddenFlags = {}, isDev, lang, useMessenger }) {
  return (items || []).filter((i) => {
    if (i.requiresMessenger && !useMessenger) return false;
    if (i.dev && !isDev) return false;
    if (i.lang && !i.lang.includes(lang)) return false;
    if (i.langNot && i.langNot.includes(lang)) return false;
    if (i.hiddenFlag && hiddenFlags[i.hiddenFlag]) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npm test -- --watchAll=false src/views/_Common/__tests__/menuFilter.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/menuFilter.js src/views/_Common/__tests__/menuFilter.test.js
git commit -m "$(printf 'feat(frontend): pure filterMenu() with cutover hidden-flag support\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Tag menu items + wire `filterMenu` into the Sidebar

**Files:**
- Modify: `src/views/_Common/menuConfig.js`
- Modify: `src/views/_Common/Sidebar.js:2,49-50,94-144`

- [ ] **Step 1: Add `hiddenFlag` to the three menu items**

In `src/views/_Common/menuConfig.js`, edit the three entries:

Replace the `home` entry (lines 18-21):
```js
  {
    slug: "home",
    labelKey: "menu_home",
    hiddenFlag: "home",
  },
```

Replace the `matters` entry (lines 63-66):
```js
  {
    slug: "matters",
    labelKey: "menu_matters",
    hiddenFlag: "matters",
  },
```

Replace the `history` entry (lines 82-86):
```js
  {
    slug: "history",
    labelKey: "menu_history",
    lang: ["en"],
    hiddenFlag: "history",
  },
```

- [ ] **Step 2: Add imports to Sidebar.js**

In `src/views/_Common/Sidebar.js`, replace the featureFlags import on line 2:
```js
import { isMessengerEnabled, HIDE_HOME_NAV, HIDE_MATTERS_NAV, HIDE_HISTORY_NAV } from '../../models/featureFlags';
```

And add, immediately after the `sidebarPath` import on line 50:
```js
import { filterMenu } from "./menuFilter";
```

- [ ] **Step 3: Replace the body of `loadMenu()`**

In `src/views/_Common/Sidebar.js`, replace the entire `loadMenu` function (currently lines 94-144, from `export function loadMenu(){` through its closing `}`) with:

```js
export function loadMenu(){

  const lang = determineLanguage();
  const isDev = /localhost|^dev/.test(window.location.hostname);

  // Cutover hidden-flag map (prod-only; false in dev/test). Keys match the
  // `hiddenFlag` values in menuConfig.
  const hiddenFlags = {
    home: HIDE_HOME_NAV,
    matters: HIDE_MATTERS_NAV,
    history: HIDE_HISTORY_NAV,
  };

  // Filter the RAW menuConfig (still carries hiddenFlag), THEN attach JSX — so
  // the hidden gate can't be defeated by a prop-stripping map.
  const visible = filterMenu(menuConfig, {
    hiddenFlags,
    isDev,
    lang,
    useMessenger: isMessengerEnabled(),
  });

  return visible.map((item) => ({
    slug: item.slug,
    jsx: (
      <MenuItem
        icon={iconMap[item.slug]}
        labelKey={item.labelKey}
        customTitle={item.customTitle}
      />
    ),
    beta: item.beta,
  }));
}
```

- [ ] **Step 4: Verify the existing sidebar/menu tests still pass**

Run: `CI=true npm test -- --watchAll=false src/views/_Common/__tests__/menuConfig.test.js src/views/_Common/__tests__/menuFilter.test.js`
Expected: PASS (menuConfig: 2 tests still green — `home` item still present in config, gating is filter-side; menuFilter: 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/menuConfig.js src/views/_Common/Sidebar.js
git commit -m "$(printf 'feat(frontend): gate home/matters/history sidebar items via filterMenu\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Active-path highlight uses the unfiltered slug list (S2)

**Files:**
- Modify: `src/views/_Common/Sidebar.js:273-276`
- Test: `src/views/_Common/__tests__/sidebarPath.test.js`

- [ ] **Step 1: Add failing active-path cases for hidden rooms**

In `src/views/_Common/__tests__/sidebarPath.test.js`, add these tests inside the `describe("resolveActivePath", ...)` block (the `SLUGS` const at the top of the file does NOT include `matters`/`history`, which is exactly the point):

```js
  test("direct-URL /matters highlights matters when its slug is present", () => {
    expect(resolveActivePath("/matters", [...SLUGS, "matters"])).toBe("/matters");
  });
  test("/matters falls back to /study when matters is filtered out of slugs", () => {
    // Documents why determinePath must pass the UNFILTERED menuConfig slugs:
    // with a filtered list (no 'matters'), a live direct-URL visit mis-highlights Study.
    expect(resolveActivePath("/matters", SLUGS)).toBe("/study");
  });
  test("direct-URL /history/lost-116-pages highlights history when present", () => {
    expect(resolveActivePath("/history/lost-116-pages", [...SLUGS, "history"])).toBe("/history/lost-116-pages");
  });
```

- [ ] **Step 2: Run the test to verify the new cases pass**

Run: `CI=true npm test -- --watchAll=false src/views/_Common/__tests__/sidebarPath.test.js`
Expected: PASS — these assert the pure resolver's existing contract (no resolver change needed). The fix in Step 3 is choosing WHICH slug list Sidebar feeds it.

- [ ] **Step 3: Feed `resolveActivePath` the unfiltered menuConfig slugs**

In `src/views/_Common/Sidebar.js`, replace `determinePath` (lines 273-276):

```js
  const determinePath = () => {
    // Use the UNFILTERED menuConfig slugs: hidden rooms are still routable by
    // direct URL, and their active-highlight must not fall through to /study.
    const slugs = menuConfig.map((m) => m.slug);
    return resolveActivePath(window.location.pathname, slugs);
  };
```

- [ ] **Step 4: Run the sidebarPath suite again**

Run: `CI=true npm test -- --watchAll=false src/views/_Common/__tests__/sidebarPath.test.js`
Expected: PASS (all prior tests + the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/views/_Common/Sidebar.js src/views/_Common/__tests__/sidebarPath.test.js
git commit -m "$(printf 'fix(frontend): highlight sidebar against unfiltered slugs for hidden rooms\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Guard the header logo `/home` link

**Files:**
- Modify: `src/views/_Common/Header.js:37` (+ import)

- [ ] **Step 1: Import `HIDE_HOME_NAV` in Header.js**

In `src/views/_Common/Header.js`, add `HIDE_HOME_NAV` to the existing `featureFlags` import. Find the line importing `USE_MESSENGER`/`isMessengerEnabled` from `../../models/featureFlags` and add `HIDE_HOME_NAV` to its named-import list. (If Header imports `USE_MESSENGER`, the line becomes e.g. `import { USE_MESSENGER, HIDE_HOME_NAV } from '../../models/featureFlags';`.)

Run first to see the exact current import line: `grep -n "featureFlags" src/views/_Common/Header.js`

- [ ] **Step 2: Guard the logo link**

In `src/views/_Common/Header.js`, replace line 37:

```js
    homeLink = (USE_MESSENGER && !HIDE_HOME_NAV) ? <Link to="/home">{homeLink}</Link> : homeLink;
```

- [ ] **Step 3: Verify compile via full test run (smoke)**

Run: `CI=true npm test -- --watchAll=false src/views/_Common`
Expected: PASS — the `_Common` suites run without a module/parse error from the edited Header.

- [ ] **Step 4: Commit**

```bash
git add src/views/_Common/Header.js
git commit -m "$(printf 'feat(frontend): guard header logo home link behind HIDE_HOME_NAV\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Guard the Matters search-result group

**Files:**
- Modify: `src/views/Search/Search.js:129` (+ import)

- [ ] **Step 1: Import `HIDE_MATTERS_NAV` in Search.js**

Inspect current imports: `grep -n "featureFlags\|^import" src/views/Search/Search.js | head`
Then add an import (path is `src/`-absolute-safe in this codebase):

```js
import { HIDE_MATTERS_NAV } from "src/models/featureFlags";
```

- [ ] **Step 2: Wrap the Matters `ResultGroup`**

In `src/views/Search/Search.js`, replace the Matters group line (line 129):

```js
              {!HIDE_MATTERS_NAV && (
                <ResultGroup label={label("menu_matters", [-1]) || "Matters"} cards={sa.matters} kind="matter" query={keyword} semantic={semantic} />
              )}
```

(Leave the People/Places/Commentary/Narration/Pages/Events groups untouched.)

- [ ] **Step 3: Verify compile via Search suite (or full run if none)**

Run: `CI=true npm test -- --watchAll=false src/views/Search`
Expected: PASS, or "No tests found" for that path — either way, no parse/module error. If "No tests found", run `CI=true npm test -- --watchAll=false --passWithNoTests src/views/Search`.

- [ ] **Step 4: Commit**

```bash
git add src/views/Search/Search.js
git commit -m "$(printf 'feat(frontend): hide Matters search-result group behind HIDE_MATTERS_NAV\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: Consolidate PassageNotes onto `HIDE_PASSAGE_NOTES`

**Files:**
- Modify: `src/views/Read/Read.js:24-26`
- Modify: `src/views/Read/components/ChapterContent.js:9-11`
- Modify: `.env.example:27`

- [ ] **Step 1: Repoint the flag in Read.js**

In `src/views/Read/Read.js`, replace lines 24-26:

```js
// Feature flag: PassageNotes panels are gated OFF in prod builds (perf/design
// WIP); ON in dev/test. Source: config/features.yml -> HIDE_PASSAGE_NOTES.
import { HIDE_PASSAGE_NOTES } from "src/models/featureFlags";
const PASSAGE_NOTES_ENABLED = !HIDE_PASSAGE_NOTES;
```

(The four existing `PASSAGE_NOTES_ENABLED` consumers at Read.js:242,425,451 are unchanged — they now gate on the new source, so prod also skips the passagenotes API fetch.)

- [ ] **Step 2: Repoint the duplicate flag in ChapterContent.js**

In `src/views/Read/components/ChapterContent.js`, replace lines 9-11:

```js
// Feature flag: PassageNotes panels are gated OFF in prod builds (perf/design
// WIP); ON in dev/test. Source: config/features.yml -> HIDE_PASSAGE_NOTES.
import { HIDE_PASSAGE_NOTES } from "src/models/featureFlags";
const PASSAGE_NOTES_ENABLED = !HIDE_PASSAGE_NOTES;
```

(The `{PASSAGE_NOTES_ENABLED && (<PassageNotes .../>)}` render gate at ChapterContent.js:79 is unchanged.)

- [ ] **Step 3: Remove the retired env var from .env.example**

In `.env.example`, delete line 27 (`REACT_APP_ENABLE_PASSAGE_NOTES=false`).

Run: `grep -n "REACT_APP_ENABLE_PASSAGE_NOTES" -r . --include=*.js --include=.env.example`
Expected: NO matches remaining anywhere in the tree.

- [ ] **Step 4: Verify the Read module graph compiles**

Run: `CI=true npm test -- --watchAll=false --passWithNoTests src/views/Read`
Expected: PASS / no tests — no parse or module-resolution error from the edited Read files.

- [ ] **Step 5: Commit**

```bash
git add src/views/Read/Read.js src/views/Read/components/ChapterContent.js .env.example
git commit -m "$(printf 'refactor(frontend): source PassageNotes enable from HIDE_PASSAGE_NOTES flag\n\nRetires REACT_APP_ENABLE_PASSAGE_NOTES; panel now on in dev, off in prod builds.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 9: Full verification (dev-default, prod build, drift)

**Files:** none (verification only)

- [ ] **Step 1: Full test suite passes**

Run: `CI=true npm test -- --watchAll=false`
Expected: the new `menuFilter` (7) and added `sidebarPath` cases pass; `menuConfig` passes; no NEW failures introduced. (Per project memory there are ~8 pre-existing frontend test failures unrelated to this work — confirm the set of failures is unchanged from a pre-work baseline, not that zero fail. Capture the baseline first with `git stash` if unsure.)

- [ ] **Step 2: Dev default shows everything (flags not honored)**

Run: `NODE_ENV=development node -e "const f=require('esm')(module)('./src/models/featureFlags.js'); console.log('home',f.HIDE_HOME_NAV,'matters',f.HIDE_MATTERS_NAV,'history',f.HIDE_HISTORY_NAV,'notes',f.HIDE_PASSAGE_NOTES);" 2>/dev/null || echo "esm-not-available: verify via prod build in Step 3 instead"`
Expected: if it runs, all four print `false`. If `esm` isn't available, skip — Step 3 is the authoritative check.

- [ ] **Step 3: Prod build honors the flags (authoritative)**

Run: `npm run build`
Then confirm the flags baked into the production bundle are ON:
Run: `grep -rl "static/js" build/index.html >/dev/null && grep -oh "homeNav" build/static/js/*.js | head -1`
Then, the definitive check — the compiled bundle must NOT wire the home/matters/history menu items as visible. Since bundle grepping is brittle, verify behaviorally by serving the build:
Run: `npx serve -s build -l 5055` (in a background shell), then load `http://localhost:5055` and confirm:
  - Sidebar shows **no** Home / Matters / History items.
  - Header logo is not a link to `/home`.
  - Search for a term with matter hits → **no** "Matters" result group.
  - Reader (`/read/...`) shows **no** PassageNotes margin panel.
  - Direct URLs still render: `/home`, `/home/community`, `/matters`, `/matters/<slug>`, `/history`, `/history/lost-116-pages`.
  - A direct visit to `/matters` does not highlight "Study" in the sidebar.
Stop the server when done.

- [ ] **Step 4: Config drift check is clean**

Run: `node scripts/gen-features.js && git diff --exit-code src/config/features.generated.json`
Expected: exit code 0 (committed JSON matches what the YAML compiles to).

- [ ] **Step 5: (Optional) Add the drift check to CI**

If the repo has a frontend CI workflow, add a step running the Step-4 command so a stale generated JSON fails the build. If no CI exists for the frontend, note this as a follow-up rather than inventing a pipeline.

---

## Self-Review

**Spec coverage:**
- Hide Home/Matters/History nav → Tasks 3, 4 (filterMenu + menuConfig tags). ✓
- Header logo guard → Task 6. ✓
- Matters search-group gate → Task 7. ✓
- PassageNotes disabled in prod, on in dev; env var retired → Task 8. ✓
- YAML → committed JSON, prestart/prebuild, write-if-changed, js-yaml devDep → Task 1. ✓
- Prod-only honoring via NODE_ENV → Task 2. ✓
- B1 (prop not forwarded) → structurally avoided by filtering raw menuConfig in Task 4 + guarded by Task 3 tests. ✓
- S2 (active-path fallback to /study) → Task 5. ✓
- Routes untouched / permalinks live → verified Task 9 Step 3; no task modifies Routes.js. ✓
- Drift check → Task 9 Step 4. ✓
- Accepted/noted items (StudyHall push, Next SSR) → intentionally out of scope per spec; no tasks. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full content; every command has an expected result.

**Type/name consistency:** `filterMenu(items, { hiddenFlags, isDev, lang, useMessenger })` defined in Task 3, called identically in Task 4. `hiddenFlag` (menuConfig prop, singular) vs `hiddenFlags` (the map param) used consistently. `HIDE_HOME_NAV/HIDE_MATTERS_NAV/HIDE_HISTORY_NAV/HIDE_PASSAGE_NOTES` defined in Task 2, imported unchanged in Tasks 4/6/7/8. `PASSAGE_NOTES_ENABLED` name preserved for existing consumers in Task 8.
