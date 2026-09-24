# React 17 → 18 Upgrade (CRA, in place)

**Date:** 2026-09-24
**Status:** Spec, pending implementation plan
**Scope:** `frontend/webapp` only. No hosting, routing or Next.js changes.

## Why

`frontend/next` runs Next 15.3.3 on React **18.3.1**. `frontend/webapp` runs React
**17.0.2**. Any plan to host the CRA inside Next therefore forces a React major
upgrade across 503 files, ~60 third-party React libraries and 164 test files.

This is sub-project 1 of the CRA → Next migration, deliberately done **first and
on CRA**, so that the React-compatibility work happens while the existing
toolchain still builds and the existing suite still runs. Doing it during the
Next lift would mean that any broken page has four plausible causes — React 18
semantics, a stale library, the Next client boundary, or the UA rewrite — instead
of one.

It also provides the bail-out: if a library turns out to be genuinely unportable,
that is discovered here, before anything is committed to Next.

## Goals

- `frontend/webapp` runs on React 18.3.1 / react-dom 18.3.1 — the same versions
  `frontend/next` already uses.
- The test suite is no worse than its recorded baseline.
- No user-visible behaviour change, with one deliberate exception (the lightbox,
  below).

## Non-goals

- No Next.js work. No routing, hosting, `middleware.ts` or pm2 changes.
- No React 19. Match what Next already runs (18.3.1) and stop there.
- **Do not enable `StrictMode`.** The app does not use it today; switching it on
  would add double-invoked effects to an unrelated change. Worth doing later, on
  its own, where the failures it surfaces can be read clearly.
- No fixing of the 6 pre-existing failing suites, except where this work touches
  them (see FilterPanel below).
- No `appController` refactor. Its mutable-reducer pattern is assessed as a risk
  here, not redesigned.

## What the codebase actually looks like (measured 2026-09-24)

The dependency list looks alarming and mostly is not. Measured, not assumed:

**Our own code is already React-18 shaped.**

| Legacy pattern | Files |
|---|---|
| `findDOMNode` | 0 |
| `componentWillMount` / `ReceiveProps` / `Update` | 0 |
| `unstable_*` APIs | 0 |
| `ReactDOM.render` | 1 (`src/index.js:82`) |
| class components | 1 of 503 |

**Third-party libraries.** 13 declare a React peer range that excludes 18, but
six of those are open-ended (`react-router-dom: >=15`, `react-bootstrap-switch:
>=15.5.0`, `react-kakao-login: >= 15.3.0`, `react-login-by-naver: >=15.0.0`,
`react-modern-drawer: >16.0.0`, plus `react-dom` itself) and work on 18.

Seven are genuinely capped at 17. **Five of them are not imported anywhere in
`src`:**

| Library | Files using it |
|---|---|
| `react-select` | 0 |
| `react-chartjs-2` | 0 |
| `react-big-calendar` | 0 |
| `react-slick` | 0 |
| `react-avatar-editor` | 0 |
| `bootstrap-switch-button-react` | 2 (+1 test) |
| `simple-react-lightbox` | 2 |

So the dependency work is: delete five unused packages, replace two used ones.

## Design

### 1. Entry point

`src/index.js:82` is the only `ReactDOM.render` call:

```js
ReactDOM.render(<SimpleReactLightbox><App /></SimpleReactLightbox>, document.getElementById('root'));
```

becomes `createRoot(...).render(...)`. Note this line disappears entirely in
sub-project 2, when Next owns the root — so it is deliberately not worth
elaborating here beyond the minimum that works.

### 2. Remove the five unused 17-capped packages

Delete `react-select`, `react-chartjs-2`, `react-big-calendar`, `react-slick` and
`react-avatar-editor` from `package.json`. No source changes; they are pure
`package.json` weight. Confirm with a grep before each removal rather than
trusting this table — an import added after 2026-09-24 would invalidate it.

### 3. Replace `bootstrap-switch-button-react` with Bootstrap's native switch

Capped at React `^16.4.0`, two call sites: `views/_Common/FilterPanel/FilterPanel.jsx:92`
and `views/Matters/MatterDetailColumn.jsx:107`.

Bootstrap 5 is already a dependency and ships `.form-check.form-switch`, so this
removes a dependency rather than swapping one for another. The component takes
`checked` + `onChange`, which maps directly onto a native checkbox input.

`views/_Common/FilterPanel/FilterPanel.test.jsx` asserts against this component
and is **already one of the 6 failing suites**. Rewriting the two assertions that
reference the old component is in scope; making the rest of that suite pass is
not. Record its before/after failure count so the change is legible.

### 4. Replace `simple-react-lightbox`

Capped at React `^17.0.2`, unmaintained, and two call sites:

- `src/index.js:8,82` — a root provider wrapping the whole app.
- `src/views/Page/Narration.js:12,361-372` — an `<SRLWrapper>` around a
  `display: none` div of `<img>` tags, which the library auto-discovers to build
  its gallery. Callbacks feed `onSlideChange` (parses the image id out of the
  slide's `src` with a regex), `onLightboxOpened` and `onLightboxClosed`.

Replace with `yet-another-react-lightbox` (maintained, React 18/19). The port is
small and removes a hack: the slide list becomes an explicit `slides` array built
from `narrationController.states.panelImageIds` — which the component already
has — instead of hidden DOM the library scrapes, and the id no longer has to be
recovered from a URL by regex. `open`/`close` props replace the provider, so the
root wrapper in `index.js` goes away.

**This is the one deliberate behaviour change in the upgrade** — a different
lightbox looks and animates differently. It needs a look on `/read` (Narration's
image panel) before it ships.

### 5. Test tooling

`@testing-library/react@11.2.7` does not support React 18 (`ReactDOM.render`
internally). Upgrade to v14, and `@testing-library/jest-dom` 5 → 6 alongside it.

Expect churn across the 164 test files, all mechanical: v13+ wraps renders in `act`
by default, so tests that manually wrapped state updates may now warn, and some
`waitFor`/`act` sequences get stricter. `react-test-renderer` is not installed,
and there is no enzyme — both of which would have been much worse.

### 6. The real behavioural risk: automatic batching vs `appController`

React 18 batches state updates from *all* contexts (promises, timeouts, native
handlers), not just React event handlers. `appController` is a mutable object
whose reducer mutates in place and returns a shallow copy
(`models/appController.js`, `appControllerReducer`), dispatched through a global
`global._appDispatch` (`Main.js` owns the `useReducer`).

Batching does not change reducer correctness, but it changes *when* a re-render
flushes. The hazard is any code that dispatches and then reads state expecting
the dispatch to have landed — particularly the `BoMOnlineAPI(...).then(...)` →
`setPopUp(...)` pattern in `views/_Common/PopUp.js` and its siblings, which now
runs inside a promise callback where updates were previously unbatched.

This cannot be found by grep with confidence. The verification strategy is
therefore behavioural: exercise the async-dispatch paths in a browser and compare
against the current build. Concretely — open a person, place, matter and
commentary modal; open a chapter with art and activate an image; run a search;
switch study groups. These are the flows where a fetch resolves and immediately
dispatches.

### 7. Verification

- **Suite baseline-diff, not "green".** Current baseline: **22 failed, 6 skipped,
  1297 passed, 1325 total; 6 failing suites** — `Chiasmus/BrowseToolbar`,
  `Chiasmus/Container`, `_Common/FilterPanel`, `_Common/GroupPopUp`,
  `_Common/XrelSection`, `Home/Home`. Record this before starting and compare
  after. Any *new* failing suite is a regression.
- **Production build must still compile:** `npm run build` (not `CI=true`, which
  turns the repo's large pre-existing warning set into errors).
- **Browser smoke at `http://localhost:8201`** — never `bom.kckern.net`, which
  Cloudflare caches for 4 hours — covering the §6 flows plus the routes this
  session already touched (entity pages, the chooser, art, history docs).

## Decision taken (2026-09-24)

**`yet-another-react-lightbox`**, for the reasons below. Recorded here rather
than left open so implementation is unblocked.

**The lightbox replacement.** `yet-another-react-lightbox` is the recommendation,
but it is a visible UI change to the reader's image viewer. The alternatives are
a hand-rolled modal (full control, more code, and the gallery/keyboard/swipe
behaviour has to be rebuilt) or keeping `simple-react-lightbox` pinned and
relying on React 18 not breaking it in practice — which is possible, since its
peer range is advisory, but it leaves an unmaintained React-17 package wired into
the app root.

## Risks

1. **Automatic batching (§6)** — the only risk that can produce subtle, silent
   misbehaviour rather than a loud failure. Mitigated by behavioural smoke, not
   by tests.
2. **testing-library v14 churn across 164 files** — high volume, low severity;
   failures are loud and local.
3. **The 8 React-named packages that declare no React peer at all** — e.g.
   `react-recaptcha`, `react-fb-login-component` — so nothing static says whether
   they work on 18. (60 dependencies declare no React peer, but 52 of those are
   not React packages and are irrelevant here.) They are exercised only by
   running the app, which is what §7's smoke pass is for. The login widgets in
   particular are worth a deliberate click, since a broken auth button fails
   quietly for signed-out visitors.
4. **Bootstrap switch visual drift** — the native switch will not be pixel-identical
   to the old component. Two call sites, both in filter UI.

## Acceptance criteria

- `react` and `react-dom` at 18.3.1 in `frontend/webapp/package.json`.
- No `ReactDOM.render` remains; the app mounts through `createRoot`.
- `simple-react-lightbox` and `bootstrap-switch-button-react` gone from
  `package.json`, along with the five unused 17-capped packages.
- Suite shows no failing suite that is not in the recorded baseline list.
- `npm run build` reports "Compiled with warnings" and emits `build/`.
- The §6 flows behave as they do on the current build, checked in a browser.

## Sequels (specified separately, not here)

- **Sub-project 2 — lift into Next.** A client-rendered catch-all route inside
  `frontend/next`, with `middleware.ts` *rewriting* browser navigations to it
  instead of proxying to `serve` on `:8201`. Crawlers keep falling through to the
  26 existing SSR routes. Deletes `react-scripts`, `react-app-rewired`,
  `config-overrides.js` and the `cra` pm2 process.
- **Sub-project 3 — convert route classes to native Next routes**, entity routes
  first since `views/Entity/EntityPage.js` and `app/people/[slug]/page.tsx` are
  already the same entity implemented twice.
