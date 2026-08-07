# Analytics Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abstract the scattered direct `window.clicky` calls in `frontend/webapp/` behind a single provider-agnostic analytics adapter (Clicky-only impl), with a typed goal catalog, folding in two bug fixes — without changing how/when tracking activates.

**Architecture:** A singleton `analytics` object implementing a small provider contract (`init/identify/pageview/goal`). `ClickyProvider` late-binds `window.clicky` per call (optional-chained → natural no-op on localhost/before load); `NoopProvider` covers SSR/off-switch. All ~13 call sites switch to `analytics.goal(GOALS.X)` / `analytics.identify(...)`. The live activation path (`public/stats.js` self-init of site 66488278, `index.html` flags + title observer, backend `/ping`) is **untouched**.

**Tech Stack:** React 17, CRA/react-scripts (JS only, no TS/tsc), Jest + jsdom.

---

## Ground truth (verified against code; full detail in `docs/specs/2026-08-06-analytics-adapter-design.md`)

- Clicky is **LIVE**: `frontend/webapp/public/stats.js:650` `_cgen.init(66488278)` self-inits on non-localhost; `stats.js:4` returns `{}` on localhost (so `window.clicky` is undefined in dev). Do NOT call `clicky.init()` at runtime (it appends site ids → double beacons). Do NOT default call sites to Noop.
- `window.clicky` API used: `clicky.goal(name, revenue)`, `clicky.log(path, title, 'pageview')`, `clicky.custom_data()`. `clicky_custom` is a global object carrying `pageview_disable`/`history_disable` flags (set in `index.html`) — preserve its identity (`x = x || {}`, never replace with a spread).
- Sign-in paths: `frontend/webapp/src/models/appController.js:326` is the **token-refresh** path (`setPreLoadData` under `input.val.tokenSignIn`); `:673` is **real sign-in** (`processSignIn`). Fire the SIGNIN goal only on 673.
- `clickyUser()` lives at `frontend/webapp/src/models/Utils.js:646` and is imported by `appController.js` (import line ~4). It currently fires `goal("signin")` as a side effect (remove that coupling).
- KRSEB bug: `frontend/webapp/src/views/About/KRSEB.js:27-28` — `onClick={window.clicky?.goal("kr_buy")}` fires at render (needs arrow fn).
- Test runner: `react-scripts test` (Jest + jsdom). Run non-watch from `frontend/webapp/`: `CI=true npx react-scripts test --watchAll=false <path>`. Tests colocate as `*.test.js`.

## File Structure

- **Create** `frontend/webapp/src/models/analytics/contract.js` — JSDoc `@typedef`s (editor hints; no runtime export).
- **Create** `frontend/webapp/src/models/analytics/goals.js` — `GOALS` catalog + `GoalName` typedef.
- **Create** `frontend/webapp/src/models/analytics/providers/noop.js` — `NoopProvider`.
- **Create** `frontend/webapp/src/models/analytics/providers/clicky.js` — `ClickyProvider`.
- **Create** `frontend/webapp/src/models/analytics/index.js` — `createProvider()` + `analytics` singleton; re-exports `GOALS`.
- **Create** `frontend/webapp/src/models/analytics/useAnalytics.js` — `useAnalytics()` hook.
- **Modify** `frontend/webapp/src/models/Utils.js` — delete `clickyUser`.
- **Modify** `frontend/webapp/src/models/appController.js` — identify/goal at 326/673.
- **Modify** 10 view files — swap `window.clicky?.goal(...)` / `.log(...)` for `analytics` calls (incl. KRSEB fix).

All paths below are relative to the repo root `/home/bom/BookofMormonOnline`. Run test/build commands from `frontend/webapp/`.

---

## Task 1: Goal catalog

**Files:**
- Create: `frontend/webapp/src/models/analytics/goals.js`
- Test: `frontend/webapp/src/models/analytics/goals.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { GOALS } from './goals';

test('GOALS catalog has the 10 known goals with stable string values', () => {
  expect(GOALS).toEqual({
    SIGNIN: 'signin', SIGNUP: 'signup', COMMENT: 'comment', STUDY: 'study',
    READ: 'read', WATCH: 'watch', FINISH: 'finish', LANGUAGE: 'language',
    KR_BUY: 'kr_buy', KR_DOWNLOAD: 'kr_download',
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/goals.test.js`
Expected: FAIL — cannot find module `./goals`.

- [ ] **Step 3: Implement**

Create `frontend/webapp/src/models/analytics/goals.js`:

```js
// Single source of truth for Clicky goal names. Editor-hint only (no tsc in this
// CRA/JS app): GOALS.TYPO is undefined and clicky.goal(undefined) safely no-ops.
export const GOALS = {
  SIGNIN: 'signin',
  SIGNUP: 'signup',
  COMMENT: 'comment',
  STUDY: 'study',
  READ: 'read',
  WATCH: 'watch',
  FINISH: 'finish',
  LANGUAGE: 'language',
  KR_BUY: 'kr_buy',
  KR_DOWNLOAD: 'kr_download',
};

/** @typedef {typeof GOALS[keyof typeof GOALS]} GoalName */
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/goals.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/models/analytics/goals.js frontend/webapp/src/models/analytics/goals.test.js
git commit -m "feat(analytics): goal catalog"
```

---

## Task 2: Contract typedefs + NoopProvider

**Files:**
- Create: `frontend/webapp/src/models/analytics/contract.js`
- Create: `frontend/webapp/src/models/analytics/providers/noop.js`
- Test: `frontend/webapp/src/models/analytics/providers/noop.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { NoopProvider } from './noop';

test('NoopProvider methods are safe no-ops and never touch globals', () => {
  const p = new NoopProvider();
  const before = window.clicky_custom;
  expect(() => {
    p.init();
    p.identify({ userid: 'u1', username: 'n' });
    p.identify(null);
    p.pageview('/x', 'X');
    p.goal('signin', { revenue: 5 });
  }).not.toThrow();
  expect(window.clicky_custom).toBe(before); // untouched
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/providers/noop.test.js`
Expected: FAIL — cannot find module `./noop`.

- [ ] **Step 3: Implement contract + noop**

Create `frontend/webapp/src/models/analytics/contract.js`:

```js
// Provider contract (JSDoc typedefs; editor hints only — no runtime export).
/**
 * @typedef {Object} AnalyticsUser
 * @property {string} userid
 * @property {string} [username]
 *
 * @typedef {Object} AnalyticsConfig
 * @property {boolean} [enabled]  // hard off-switch; default true (nothing wires it this phase)
 *
 * @typedef {Object} AnalyticsProvider
 * @property {(cfg?: AnalyticsConfig) => void}                      init
 * @property {(user: AnalyticsUser|null) => void}                   identify
 * @property {(path: string, title?: string) => void}              pageview
 * @property {(name: string, opts?: {revenue?: number}) => void}    goal
 */
export {};
```

Create `frontend/webapp/src/models/analytics/providers/noop.js`:

```js
/** @implements {import('../contract.js').AnalyticsProvider} */
export class NoopProvider {
  init() {}
  identify() {}
  pageview() {}
  goal() {}
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/providers/noop.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/models/analytics/contract.js frontend/webapp/src/models/analytics/providers/noop.js frontend/webapp/src/models/analytics/providers/noop.test.js
git commit -m "feat(analytics): provider contract + NoopProvider"
```

---

## Task 3: ClickyProvider

**Files:**
- Create: `frontend/webapp/src/models/analytics/providers/clicky.js`
- Test: `frontend/webapp/src/models/analytics/providers/clicky.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { ClickyProvider } from './clicky';

function mockClicky() {
  window.clicky = { goal: jest.fn(), log: jest.fn(), custom_data: jest.fn() };
  window.clicky_custom = { pageview_disable: true, history_disable: true };
}

afterEach(() => {
  delete window.clicky;
  delete window.clicky_custom;
});

test('identify sets the GLOBAL visitor, calls custom_data, fires NO goal, keeps flags', () => {
  mockClicky();
  new ClickyProvider().identify({ userid: 'u1', username: 'Neo' });
  expect(window.clicky_custom.visitor).toEqual({ userid: 'u1', username: 'Neo' });
  expect(window.clicky_custom.pageview_disable).toBe(true); // flags survive
  expect(window.clicky.custom_data).toHaveBeenCalled();
  expect(window.clicky.goal).not.toHaveBeenCalled();
});

test('identify(null) deletes visitor (no {userid: undefined} garbage)', () => {
  mockClicky();
  window.clicky_custom.visitor = { userid: 'u1' };
  new ClickyProvider().identify(null);
  expect(window.clicky_custom.visitor).toBeUndefined();
});

test('pageview logs a pageview', () => {
  mockClicky();
  new ClickyProvider().pageview('/lookup/x', 'Lookup: X');
  expect(window.clicky.log).toHaveBeenCalledWith('/lookup/x', 'Lookup: X', 'pageview');
});

test('goal passes name and revenue', () => {
  mockClicky();
  new ClickyProvider().goal('kr_buy', { revenue: 25 });
  expect(window.clicky.goal).toHaveBeenCalledWith('kr_buy', 25);
});

test('init is a no-op and does not init clicky', () => {
  mockClicky();
  window.clicky.init = jest.fn();
  new ClickyProvider().init();
  expect(window.clicky.init).not.toHaveBeenCalled();
});

test('all methods are safe when window.clicky is undefined', () => {
  expect(() => {
    const p = new ClickyProvider();
    p.identify({ userid: 'u1' });
    p.pageview('/x');
    p.goal('signin');
  }).not.toThrow();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/providers/clicky.test.js`
Expected: FAIL — cannot find module `./clicky`.

- [ ] **Step 3: Implement**

Create `frontend/webapp/src/models/analytics/providers/clicky.js`:

```js
// Analytics is non-critical; a failure must never break the UI.
function safe(fn) {
  try { fn(); } catch (_e) { /* swallow */ }
}

/** @implements {import('../contract.js').AnalyticsProvider} */
export class ClickyProvider {
  // No-op: public/stats.js self-inits site 66488278 at load. Calling clicky.init()
  // here would append a second site id and double-fire every beacon.
  init() {}

  identify(user) {
    safe(() => {
      // Preserve the index.html-created global (carries pageview_disable/history_disable).
      window.clicky_custom = window.clicky_custom || {};
      if (user) window.clicky_custom.visitor = { userid: user.userid, username: user.username };
      else delete window.clicky_custom.visitor;
      window.clicky?.custom_data?.();
    });
  }

  pageview(path, title) {
    safe(() => window.clicky?.log?.(path, title, 'pageview'));
  }

  goal(name, opts) {
    safe(() => window.clicky?.goal?.(name, opts?.revenue));
  }
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/providers/clicky.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/models/analytics/providers/clicky.js frontend/webapp/src/models/analytics/providers/clicky.test.js
git commit -m "feat(analytics): ClickyProvider (late-bound, safe, no runtime init)"
```

---

## Task 4: Singleton + hook

**Files:**
- Create: `frontend/webapp/src/models/analytics/index.js`
- Create: `frontend/webapp/src/models/analytics/useAnalytics.js`
- Test: `frontend/webapp/src/models/analytics/index.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { analytics, createProvider, GOALS } from './index';
import { useAnalytics } from './useAnalytics';
import { NoopProvider } from './providers/noop';
import { ClickyProvider } from './providers/clicky';

test('default singleton is a ClickyProvider in the browser (jsdom has window)', () => {
  expect(analytics).toBeInstanceOf(ClickyProvider);
});

test('createProvider returns Noop when disabled', () => {
  expect(createProvider({ enabled: false })).toBeInstanceOf(NoopProvider);
});

test('useAnalytics returns the same singleton', () => {
  expect(useAnalytics()).toBe(analytics);
});

test('re-exports the GOALS catalog', () => {
  expect(GOALS.SIGNIN).toBe('signin');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/index.test.js`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Implement**

Create `frontend/webapp/src/models/analytics/index.js`:

```js
import { ClickyProvider } from './providers/clicky.js';
import { NoopProvider } from './providers/noop.js';
import { GOALS } from './goals.js';

/** @param {import('./contract.js').AnalyticsConfig} [config] */
export function createProvider(config = {}) {
  // SSR / bot SSR (no window) or explicit off-switch → no-op. Otherwise Clicky,
  // which itself late-binds window.clicky (safe on localhost / before stats.js).
  if (typeof window === 'undefined' || config.enabled === false) return new NoopProvider();
  return new ClickyProvider();
}

export const analytics = createProvider();
export { GOALS };
```

Create `frontend/webapp/src/models/analytics/useAnalytics.js`:

```js
import { analytics } from './index.js';

/** @returns {import('./contract.js').AnalyticsProvider} */
export function useAnalytics() {
  return analytics;
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/index.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/models/analytics/index.js frontend/webapp/src/models/analytics/useAnalytics.js frontend/webapp/src/models/analytics/index.test.js
git commit -m "feat(analytics): singleton + useAnalytics hook"
```

---

## Task 5: Migrate identify (Utils.js + appController.js) with the signin fix

**Files:**
- Modify: `frontend/webapp/src/models/Utils.js` (delete `clickyUser`, ~lines 646-651)
- Modify: `frontend/webapp/src/models/appController.js` (import line ~4; sites 326 and 673)
- Test: `frontend/webapp/src/models/analytics/identify-migration.test.js`

- [ ] **Step 1: Write the failing guard test**

This asserts the old coupling is gone and the new wiring is present, by reading the source files.

```js
import fs from 'fs';
import path from 'path';

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

test('Utils.js no longer defines clickyUser', () => {
  expect(read('../Utils.js')).not.toMatch(/export function clickyUser/);
});

test('appController does not import clickyUser and uses analytics.identify + goal(SIGNIN)', () => {
  const src = read('../appController.js');
  expect(src).not.toMatch(/clickyUser/);
  expect(src).toMatch(/analytics\.identify\(/);
  expect(src).toMatch(/analytics\.goal\(GOALS\.SIGNIN\)/);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/identify-migration.test.js`
Expected: FAIL — `clickyUser` still defined/imported.

- [ ] **Step 3: Delete `clickyUser` from `Utils.js`**

Remove the whole function (currently ~lines 646-651):

```js
export function clickyUser(userData) {
  var clicky_custom = window.clicky_custom || {};
  clicky_custom.visitor = userData;
  window.clicky?.custom_data();
  window.clicky?.goal("signin");
}
```

Leave the rest of `Utils.js` unchanged.

- [ ] **Step 4: Rewire `appController.js`**

In the import block (~line 4), remove `clickyUser` from the `./Utils.js` import and add the analytics import. So:

```js
import { determineLanguage, tokenImage } from "./Utils.js";
import { analytics, GOALS } from "./analytics/index.js";
```

At the token-refresh site (~line 326, inside `setPreLoadData`) replace:

```js
clickyUser({ userid: appController.states.user.user, username: appController.states.user.social?.nickname })
```

with (identify only — no signin goal on refresh):

```js
analytics.identify({ userid: appController.states.user.user, username: appController.states.user.social?.nickname })
```

At the real sign-in site (~line 673, inside `processSignIn`) replace:

```js
clickyUser({ userid: user.user.user, username: user.social?.nickname });
```

with (identify + the SIGNIN goal, which is the ONLY place it should fire):

```js
analytics.identify({ userid: user.user.user, username: user.social?.nickname });
analytics.goal(GOALS.SIGNIN);
```

(Preserve the exact surrounding code and the `.user.user` / `.social?.nickname` shapes — these differ between the two sites; copy them verbatim from the originals.)

- [ ] **Step 5: Run the guard test + full analytics suite**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/`
Expected: PASS (all analytics tests incl. the migration guard).

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/models/Utils.js frontend/webapp/src/models/appController.js frontend/webapp/src/models/analytics/identify-migration.test.js
git commit -m "feat(analytics): migrate identify; fire SIGNIN only on real sign-in"
```

---

## Task 6: Migrate goal + pageview call sites (incl. KRSEB fix)

**Files (modify each):**
- `frontend/webapp/src/views/User/SignUp.js:44`
- `frontend/webapp/src/views/_Common/Study/StudyChat.js:119,686`
- `frontend/webapp/src/views/_Common/Study/Study.js:151`
- `frontend/webapp/src/views/Home/Feed.js:849`
- `frontend/webapp/src/views/_Common/Study/StudyHall.js:288`
- `frontend/webapp/src/views/Page/Page.js:217`
- `frontend/webapp/src/views/Theater/Theater.js:1014`
- `frontend/webapp/src/views/User/Victory.js:44`
- `frontend/webapp/src/views/_Common/Sidebar.js:406`
- `frontend/webapp/src/views/About/KRSEB.js:27-28`
- `frontend/webapp/src/views/Page/Narration.js:744`
- Test: `frontend/webapp/src/models/analytics/callsites-migration.test.js`

- [ ] **Step 1: Write the failing guard test**

```js
import fs from 'fs';
import path from 'path';

const files = [
  '../../views/User/SignUp.js',
  '../../views/_Common/Study/StudyChat.js',
  '../../views/_Common/Study/Study.js',
  '../../views/Home/Feed.js',
  '../../views/_Common/Study/StudyHall.js',
  '../../views/Page/Page.js',
  '../../views/Theater/Theater.js',
  '../../views/User/Victory.js',
  '../../views/_Common/Sidebar.js',
  '../../views/About/KRSEB.js',
  '../../views/Page/Narration.js',
];
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

test('no migrated view still calls window.clicky directly', () => {
  for (const f of files) {
    expect(read(f)).not.toMatch(/window\.clicky/);
  }
});

test('KRSEB goals are wrapped in an arrow fn (not fired at render)', () => {
  const src = read('../../views/About/KRSEB.js');
  expect(src).toMatch(/onClick=\{\(\)\s*=>\s*analytics\.goal\(GOALS\.KR_BUY\)\}/);
  expect(src).toMatch(/onClick=\{\(\)\s*=>\s*analytics\.goal\(GOALS\.KR_DOWNLOAD\)\}/);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/callsites-migration.test.js`
Expected: FAIL — `window.clicky` still present in the view files.

- [ ] **Step 3: Migrate each file**

In EACH file, add the import with the CORRECT relative depth (verified — use this map exactly; a wrong depth only fails at build):

| File | Import specifier |
|---|---|
| `views/_Common/Study/StudyChat.js`, `Study.js`, `StudyHall.js` (two dirs under `views`) | `../../../models/analytics/index.js` |
| `views/User/SignUp.js`, `views/User/Victory.js` | `../../models/analytics/index.js` |
| `views/Home/Feed.js` | `../../models/analytics/index.js` |
| `views/Page/Page.js`, `views/Page/Narration.js` | `../../models/analytics/index.js` |
| `views/Theater/Theater.js` | `../../models/analytics/index.js` |
| `views/About/KRSEB.js` | `../../models/analytics/index.js` |
| `views/_Common/Sidebar.js` (one dir under `views`) | `../../models/analytics/index.js` |

```js
import { analytics, GOALS } from "<specifier from the table above>";
```

Then replace the calls (mapping shown; keep any surrounding args/handlers intact):

| File:line | Replace | With |
|---|---|---|
| `SignUp.js:44` | `window.clicky?.goal("signup")` | `analytics.goal(GOALS.SIGNUP)` |
| `StudyChat.js:119` and `:686` | `window.clicky?.goal("comment")` | `analytics.goal(GOALS.COMMENT)` |
| `Study.js:151` | `window.clicky?.goal("comment")` | `analytics.goal(GOALS.COMMENT)` |
| `Feed.js:849` | `window.clicky?.goal("comment")` | `analytics.goal(GOALS.COMMENT)` |
| `StudyHall.js:288` | `window.clicky?.goal("study")` | `analytics.goal(GOALS.STUDY)` |
| `Page.js:217` | `window.clicky?.goal("read")` | `analytics.goal(GOALS.READ)` |
| `Theater.js:1014` | `window.clicky?.goal("watch")` | `analytics.goal(GOALS.WATCH)` |
| `Victory.js:44` | `window.clicky?.goal("finish")` | `analytics.goal(GOALS.FINISH)` |
| `Sidebar.js:406` | `window.clicky?.goal("language")` | `analytics.goal(GOALS.LANGUAGE)` |
| `KRSEB.js:27` | `onClick={window.clicky?.goal("kr_buy")}` | `onClick={() => analytics.goal(GOALS.KR_BUY)}` |
| `KRSEB.js:28` | `onClick={window.clicky?.goal("kr_download")}` | `onClick={() => analytics.goal(GOALS.KR_DOWNLOAD)}` |
| `Narration.js:744` | `window.clicky?.log(\`/lookup/${refSlug}\`, \`Lookup: ${ref}\`, "pageview")` | `analytics.pageview(\`/lookup/${refSlug}\`, \`Lookup: ${ref}\`)` |

Before editing `Narration.js`, open it and copy the exact template-literal argument expressions verbatim (the `refSlug`/`ref` variable names) — do not guess them; use whatever the file actually has.

- [ ] **Step 4: Run the guard test**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/callsites-migration.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views frontend/webapp/src/models/analytics/callsites-migration.test.js
git commit -m "feat(analytics): migrate all goal/pageview call sites; fix KRSEB render-time goals"
```

---

## Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full analytics test suite**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/analytics/`
Expected: all tests PASS.

- [ ] **Step 2: Repo-wide guard — no stray `window.clicky` outside the adapter**

The adapter itself (`src/models/analytics/providers/clicky.js` and its tests) legitimately references `window.clicky`, so exclude that dir:

Run: `cd frontend/webapp && grep -rn "window.clicky" src/ --exclude-dir=analytics || echo "CLEAN"`
Expected: `CLEAN` (the only `window.clicky` references left in `src/` are inside `src/models/analytics/`; `public/index.html` and `public/stats.js` are intentionally untouched and are NOT under `src/`).

- [ ] **Step 3: Production build compiles**

This project builds with `react-app-rewired` (see `package.json` `"build"`), whose `config-overrides.js` adds `src/` to module resolution — plain `react-scripts build` fails on the codebase's existing absolute imports. Do NOT use `CI=true` here (it makes CRA ESLint warnings fatal and would trip on pre-existing warnings unrelated to this work). First confirm a clean baseline, then build:

Run: `cd frontend/webapp && npm run build`
Expected: build succeeds with no NEW errors referencing the analytics module or the migrated imports. (If the build already had warnings before this work, they are not your concern — only regressions from the new imports are.)

- [ ] **Step 4: Manual smoke (optional, dev)**

Serve the app locally (`http://localhost:8200` per CLAUDE.md — note `stats.js` no-ops on localhost, so `window.clicky` is undefined and analytics calls are natural no-ops; verify the app renders and the KRSEB buttons click without console errors). This confirms the adapter degrades safely where Clicky is inactive.

- [ ] **Step 5: Push**

Tasks 1–6 already committed all changes; there is nothing new to commit here (avoid `git add -A`, which would sweep unrelated working-tree files). Just push the branch:

```bash
git push -u origin HEAD
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** contract (Task 2) ✓ · goal catalog (Task 1) ✓ · ClickyProvider mapping incl. identify(null)/flag-preservation/no-goal-side-effect/revenue (Task 3) ✓ · singleton+hook, Noop on SSR/disable (Task 4) ✓ · identify migration + SIGNIN-on-real-signin fix (Task 5) ✓ · all 13 call sites + KRSEB fix + Narration pageview (Task 6) ✓ · grep guard + build (Task 7) ✓. **Explicitly untouched per spec:** `stats.js`, `index.html` flags/observer, backend `/ping`, config-driven site id, second provider — none have tasks (correct).
- **Placeholder scan:** none; every code step shows full code. The two "copy verbatim" notes (appController identity shapes; Narration template args) are deliberate guards against guessing existing code, not placeholders.
- **Type/name consistency:** `analytics`, `GOALS`, `createProvider`, `ClickyProvider`, `NoopProvider`, `useAnalytics`, and the `init/identify/pageview/goal` method names are identical across Tasks 1–6. Import specifier is `./analytics/index.js` from `models/`, and `<n-levels>/models/analytics/index.js` from views (Task 6 tells the engineer to compute the depth per file).
- **Metric deltas** (signin drop; kr_* now real) are documented in the spec §10a; no code impact.
