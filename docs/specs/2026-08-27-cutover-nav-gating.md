# Cutover nav-gating + centralized feature-flag config

**Date:** 2026-08-27
**Status:** Design (revised after Fable review), pending implementation plan
**Author:** Claude (brainstormed with KC)
**Paths:** all relative to `frontend/webapp/` unless noted.

## Goals

1. **Hide three features from navigation at prod cutover** — Home-Explore +
   Community, Matters, and History — while leaving their routes live for
   direct-URL / permalink access. "Hide the entrances, leave the rooms."
   Additionally, **disable the whole PassageNotes reader-margin panel in prod
   builds** (a reader feature, not a route — it simply doesn't render in prod).
2. **Put the nav + PassageNotes flags in a single, human-editable `features.yml`**
   rather than inline `process.env` checks. (Messenger keeps its existing runtime
   hostname logic in `featureFlags.js` — out of scope, untouched.)
3. **Honor the hide flags in production builds only.** Local dev (`npm start`)
   and Jest always show everything, so developers never lose access locally.

The `/home/user*` account area (profile, preferences, history, sign-in) stays
reachable via the UserInfo profile card / avatar / progress images — NOT a "Home"
menu item.

### Scope of "entrance" (per KC)

Gate **sidebar menu items + search-result entrances**. **Deep-link permalinks
stay live** (that's the whole point). Concretely:
- Home / Matters / History: remove sidebar menu items.
- Matters: also remove its search-result group.
- History: has no search-result group (see below), so menu removal suffices.

**PassageNotes** (the reader-margin panel: Commentary / People / Places / Matters
/ Images / Chiasmus / References tabs) is disabled entirely in prod builds via its
own flag (see below) — so its Matters tab is gone in prod along with the rest of
the panel. In dev it renders in full.

## Verified structural facts (checked against code)

- Routes: `models/Routes.js`. `/` renders the scripture reader (`ReadScripture`,
  Routes.js:58-63), **not** Home. `/home` (`:68`, non-exact, un-gated), `/matters`
  + `/matters/:matterSlug` (`:251-256`, un-gated), and all History routes
  (`:195-220`: `/history`, `/history/:slug`, `/history/lost-116-pages`,
  `/history/reception/:slug`, `/history/witnesses`, `/history/joseph-smith`,
  `/history/translation`) stay reachable by direct URL. **Routes.js is not touched.**
- Sidebar builds its menu from `views/_Common/menuConfig.js` and filters items in
  `loadMenu()` (`Sidebar.js:99-142`) by `requiresMessenger`, `dev`, `lang`,
  `langNot`. Menu items: `home` (`menuConfig.js:18-21`), `matters` (`:63-66`),
  `history` (`:82-86`, `lang:["en"]`).
- Existing flags: `models/featureFlags.js` (`USE_MESSENGER`,
  `isMessengerEnabled()`). Messenger's runtime per-hostname logic is intentional
  and **unchanged**.
- Toolchain split: `start`/`build` run via `react-app-rewired`
  (`config-overrides.js` applies); `test` runs plain `react-scripts test` (Jest,
  no `config-overrides.js`). `js-yaml` currently resolves only transitively.
- Search results: `views/Search/Search.js:126-132` renders one `ResultGroup` per
  kind; only `kind="matter"` (`:129`, `sa.matters`) maps to a gated feature.
  There is **no History search group**. Cards link via `views/Search/cards.js:9`.
- Mobile menu (`MobileMenu.js`) consumes `loadMenu()`, so it inherits the gate
  for free; the mobile header (`Header.js:113`) links only to `/home/user`
  (preserved).

## Config mechanism: build-time YAML → committed JSON

CRA can't import `.yml` natively, and a webpack yaml-loader would break `npm test`
(Jest can't parse a `.yml` import). So we compile at build time:

```
config/features.yml                 ← THE single source of truth (commented YAML)
scripts/gen-features.js             ← parses yml (js-yaml), writes the json
src/config/features.generated.json  ← generated + committed, imported natively
src/models/featureFlags.js          ← reads the json, exports the constants
```

- Add `js-yaml` as an explicit `devDependency`.
- `scripts/gen-features.js` reads `config/features.yml`, writes
  `src/config/features.generated.json` **only if the content changed**
  (compare-before-write — avoids churning webpack's watch tree on the long-lived
  dev `npm start`), pretty-printed with stable key order.
- Wired before every build/start:
  ```json
  "prestart": "node scripts/gen-features.js",
  "prebuild": "node scripts/gen-features.js",
  ```
- The generated JSON is **committed** (Jest/CI need it — the codegen prestart
  hook does not run under `react-scripts test`). CI drift check:
  `node scripts/gen-features.js && git diff --exit-code src/config/features.generated.json`.
- Build-time and synchronous — no runtime fetch; `USE_MESSENGER` stays a plain
  constant.

### `features.yml`

```yaml
# Feature-flag config. Hand-edited; scripts/gen-features.js compiles it to
# src/config/features.generated.json at build time (prestart/prebuild).
#
# All flags below are HONORED IN PRODUCTION BUILDS ONLY. In dev (npm start) and
# tests everything is shown regardless of these values. NOTE: a single prod build
# serves both staging and prod, so STAGING ALSO applies these (accepted).

homeNav:      { hidden: true }   # hide "Home" (Explore + Community) menu entrance
mattersNav:   { hidden: true }   # hide "Matters" menu + search-result group
historyNav:   { hidden: true }   # hide "History" menu entrance
passageNotes: { hidden: true }   # disable the whole reader-margin PassageNotes panel
```

### `featureFlags.js` (additive)

```js
import features from '../config/features.generated.json';

const IS_PROD = process.env.NODE_ENV === 'production';

// Cutover flags: honored in production builds only. (Staging shares the prod
// build, so it applies too — accepted; `npm start` / Jest are NODE_ENV !== production.)
export const HIDE_HOME_NAV      = IS_PROD && !!features.homeNav?.hidden;
export const HIDE_MATTERS_NAV   = IS_PROD && !!features.mattersNav?.hidden;
export const HIDE_HISTORY_NAV   = IS_PROD && !!features.historyNav?.hidden;
export const HIDE_PASSAGE_NOTES = IS_PROD && !!features.passageNotes?.hidden;

// (existing USE_MESSENGER / isMessengerEnabled() below — UNCHANGED)
```

Purely additive to `featureFlags.js`: existing messenger exports and call sites
are unchanged.

## Nav-gating edits (consumer side)

**`menuConfig.js`** — tag the three items (file's "consumer applies the gate"
convention, like `requiresMessenger`):
```js
{ slug: "home",    labelKey: "menu_home",    hiddenFlag: "home" },
{ slug: "matters", labelKey: "menu_matters", hiddenFlag: "matters" },
{ slug: "history", labelKey: "menu_history", lang: ["en"], hiddenFlag: "history" },
```

**`Sidebar.js loadMenu()`** — TWO edits:
1. **Forward the prop** (BLOCKER B1): `loadMenu()` rebuilds each item and only
   copies specific keys (`Sidebar.js:107-115`). Add `hiddenFlag: item.hiddenFlag`
   to that `return {...}`, or the filter below is a silent no-op.
2. **Filter** beside the `requiresMessenger` step:
   ```js
   const HIDDEN = { home: HIDE_HOME_NAV, matters: HIDE_MATTERS_NAV, history: HIDE_HISTORY_NAV };
   // ...in the filter chain:
   if (i.hiddenFlag && HIDDEN[i.hiddenFlag]) return false;
   ```

**`Sidebar.js` active-path (S2 fix)** — `resolveActivePath(pathname, slugs)`
(`sidebarPath.js`) returns `"/study"` when `root` isn't in `slugs`. Pass the
**unfiltered** `menuConfig` slugs (not the filtered menu) so a direct-URL visit
to a hidden room doesn't mis-highlight "Study".

**`Header.js:37`** — guard the logo's `/home` link:
```js
homeLink = (USE_MESSENGER && !HIDE_HOME_NAV) ? <Link to="/home">{homeLink}</Link> : homeLink;
```

**`Search.js:129`** — gate the Matters result group:
```js
{!HIDE_MATTERS_NAV && (
  <ResultGroup label={label("menu_matters", [-1]) || "Matters"} cards={sa.matters} kind="matter" query={keyword} semantic={semantic} />
)}
```
(No History search group exists, so nothing to gate there.)

**PassageNotes flag consolidation** — `Read.js:26` and
`views/Read/components/ChapterContent.js:11` each currently define
`const PASSAGE_NOTES_ENABLED = process.env.REACT_APP_ENABLE_PASSAGE_NOTES === 'true';`
(off-by-default opt-in). Replace both with a single source from `featureFlags.js`:
```js
import { HIDE_PASSAGE_NOTES } from "src/models/featureFlags";
const PASSAGE_NOTES_ENABLED = !HIDE_PASSAGE_NOTES; // dev/test: on; prod: off
```
This preserves the existing `PASSAGE_NOTES_ENABLED` consumers unchanged
(`ChapterContent.js:79` render gate; `Read.js:242,425,451` data-fetch gates — so
prod also skips the passagenotes API calls). **Retires the
`REACT_APP_ENABLE_PASSAGE_NOTES` env var** (remove from `.env.example` if present).

**Matters reader-margin tab** — `views/Read/PassageNotes.js` renders a "Matters"
tab (~:67, :128-134). Per "no link in," gate it behind `!HIDE_MATTERS_NAV`.
*Flag for KC review:* this is an in-app entrance, not a permalink — included to
honor "no link in"; easy to drop if you'd rather leave it.

## Accepted / noted (not fixed)

- **Programmatic `history.push("/home")`** exists outside the dashboard
  (`Study/StudyHall.js:300` on thread-panel cleanup; `User/Invitation.js:126,132,161`).
  Routes stay live, so these still function; they just land on the hidden Explore.
  Accepted as "rooms stay live." (StudyHall's push-to-`/home` is a pre-existing UX
  nit, out of scope.)
- **Next.js SSR front door** (`frontend/next/`) serves bots. If its nav/sitemap
  lists Home/Matters/History, crawlers still see those entrances after cutover.
  Out of scope here; track separately if pre-launch SEO hiding is wanted.

## Scope summary

**New files:** `config/features.yml`, `scripts/gen-features.js`,
`src/config/features.generated.json` (committed).

**Edited:** `package.json` (prestart/prebuild + `js-yaml` devDep),
`src/models/featureFlags.js` (additive), `src/views/_Common/menuConfig.js`,
`src/views/_Common/Sidebar.js` (forward prop + filter + unfiltered slugs for
active-path), `src/views/_Common/Header.js`, `src/views/Search/Search.js`,
`src/views/Read/Read.js` + `src/views/Read/components/ChapterContent.js`
(`PASSAGE_NOTES_ENABLED` now sourced from `HIDE_PASSAGE_NOTES`), CI config (drift
check). `.env.example` (drop `REACT_APP_ENABLE_PASSAGE_NOTES` if listed).

**New test:** `loadMenu` unit test asserting `hiddenFlag` items are filtered when
the corresponding flag is set (guards against B1 regression).

**NOT touched:** `models/Routes.js` (routes/permalinks stay live), any
Home/Matters/History/Community view component, the `/home/user*` account links.

## Verification

- **`npm start` (development):** Sidebar shows Home, Matters, History; all open
  normally; Matters search group present; **PassageNotes renders** in the reader.
  No regression. `bom.kckern.net` (dev, runs `start`) also shows them — expected
  (incl. the in-progress PassageNotes panel, per KC's decision).
- **Prod build (`npm run build`, `NODE_ENV=production`) served statically:**
  Sidebar shows none of the three; header logo not a link to `/home`; Matters
  search group gone; **PassageNotes panel does not render and its API calls are
  skipped**; but `/home`, `/home/community`, `/matters`, `/matters/<slug>`,
  `/history`, `/history/lost-116-pages`, `/history/<slug>` still render by direct
  URL. Direct-URL visit to a hidden room does NOT mis-highlight "Study". User
  account still reachable via profile card/avatar.
- **`npm test`:** flags not honored (NODE_ENV=test); generated JSON present
  (committed); `loadMenu` gate test passes.
- **Per-feature independence:** `mattersNav.hidden:true` with the others `false`
  hides only Matters (menu + search) in a prod build; `passageNotes.hidden` is
  independent of the nav flags.
- **Config drift:** `node scripts/gen-features.js && git diff --exit-code
  src/config/features.generated.json` is clean.

## Reversibility

Set the relevant `hidden: false` in `features.yml`, rebuild. No routing/data
changes; permalinks unaffected throughout.
