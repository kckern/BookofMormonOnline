# Analytics Adapter — Design Spec (v2, corrected)

Date: 2026-08-06
Status: Approved design pending re-review (v1 was DENIED for false audit facts — see §2)
Scope: Frontend client-side analytics abstraction (`frontend/webapp/`). The live activation path (`public/stats.js`, `index.html` bootstrap), the backend `/ping` proxy, and the synthetic-pageview observer all stay **untouched** — the refactor must be behavior-identical.

## 1. Goal

Abstract the direct `window.clicky` calls scattered across the webapp behind a single, provider-agnostic adapter so the provider is swappable later without touching call sites, and give goals a clean typed surface (including Clicky's native revenue goals). Clicky is the only implementation now. **This is a pure call-site abstraction — it does not change how/when tracking activates.**

## 2. Corrected context (v1 audit was wrong on two load-bearing facts)

A v1 of this spec claimed Clicky was inactive and mislabeled the sign-in paths. Both were verified false against the code. Corrected facts:

- **Clicky is LIVE.** `public/stats.js:650` hardcodes `_cgen.init(66488278)`. On any non-localhost host, `stats.js` self-initializes with site id **66488278** at load and beacons fire through the first-party `/ping` mutation → `backend/src/media/ping.ts` → `in.getclicky.com` (when `clickySiteAdmin` is set). `stats.js:4` returns `{}` on `localhost`, so `window.clicky` is undefined there (natural no-op in dev). **Implication:** the adapter must NOT default call sites to a no-op provider, or it silently kills live tracking on the deployed host.
- **stats.js `init()` appends** (`stats.js:29` `site_ids.push`), and `beacon()` loops all site ids. A runtime `clicky.init(anotherId)` would double-fire every beacon. **Implication:** the adapter must NOT call `init()` at runtime; activation stays owned by the hardcoded self-init.
- **Sign-in vs refresh:** `appController.js:326` is inside `setPreLoadData` handling `input.val.tokenSignIn` — the **token-refresh / preload** path. `appController.js:673` is `processSignIn` — the **real sign-in**. (v1 had these backwards.)
- `clickyUser()` (`models/Utils.js:646`) sets `clicky_custom.visitor`, calls `clicky.custom_data()`, and fires `clicky.goal("signin")`. Note `custom_data()` **returns a querystring fragment** consumed internally by the next `beacon()` — it is not itself a send. Also `Utils.js:647` has a latent bug: `var clicky_custom = window.clicky_custom || {}` makes a *local* that's never written back if the global is absent, so the visitor can be dropped.
- `stats.js` **already captures** UTM/referrer/campaign (`_utm_og`/`_referrer_og` cookies, `utm_campaign` in `get_href`, `utm_custom[...]` in `custom_data`). Campaign tracking already works at the transport — there is nothing to re-implement.
- Known bug: `views/About/KRSEB.js:27-28` — `onClick={window.clicky?.goal("kr_buy")}` fires at *render* time (missing arrow fn). Same for `kr_download`.
- The webapp is 100% JS (React 17, CRA/react-scripts, no `.ts`/`.tsx`, no `tsc`/`checkJs`). JSDoc typedefs are editor hints only — not compile-enforced.

## 3. Approved decisions (v2)

- **Architecture:** singleton module + JSDoc-typed provider contract; Clicky-only impl; `NoopProvider` only for SSR / an explicit hard off-switch.
- **Pure call-site abstraction.** Do NOT touch: `stats.js`, its hardcoded `init(66488278)`, the `index.html` `clicky_custom` flags, the synthetic-pageview title observer, or the backend `/ping`. Behavior stays identical.
- **Late-bind per call.** Every provider method reads `window.clicky` at call time (optional-chained). No once-at-bootstrap Clicky-vs-Noop decision (that race could lock in Noop forever). On localhost `window.clicky` is absent → natural no-op, exactly as today.
- **Minimal contract** matching real consumers: `identify`, `pageview`, `goal(name,{revenue})`. `init` exists in the contract for future providers but is a **documented no-op** for Clicky (stats.js self-inits).
- **Fixes folded in:** KRSEB render-time bug; fire `goal(SIGNIN)` only on real sign-in (`processSignIn`, 673) with identify on both paths; remove the `goal("signin")` side-effect from `identify`; write to `window.clicky_custom` explicitly (Utils.js:647 bug).
- **Out of scope (explicit):** activation/init changes, config-driven site id, moving the observer/flags, `stats.js` refactor, backend `/ping`, a campaign/attribution API (stats.js already does it — no consumer), a second provider, `event()`/`custom()` (no current consumers).

## 4. Module layout

Under `src/models/` (where `clickyUser` lives today).

```
frontend/webapp/src/models/analytics/
├── index.js          # singleton: ClickyProvider unless SSR/disabled → Noop; exports `analytics` + GOALS
├── contract.js       # JSDoc @typedef: AnalyticsProvider, AnalyticsUser, AnalyticsConfig
├── goals.js          # GOALS catalog + GoalName typedef (editor hint)
├── useAnalytics.js   # thin React hook returning the singleton
└── providers/
    ├── clicky.js     # ClickyProvider — late-binds window.clicky; init() is a no-op
    └── noop.js       # NoopProvider — SSR / hard off-switch
```

## 5. Provider contract (`contract.js`)

```js
/**
 * @typedef {Object} AnalyticsUser
 * @property {string} userid
 * @property {string} [username]
 *
 * @typedef {Object} AnalyticsConfig
 * @property {boolean} [enabled]   // hard off-switch; default true
 *
 * @typedef {Object} AnalyticsProvider
 * @property {(cfg?: AnalyticsConfig) => void}                      init      // no-op for Clicky
 * @property {(user: AnalyticsUser|null) => void}                   identify
 * @property {(path: string, title?: string) => void}              pageview
 * @property {(name: GoalName, opts?: {revenue?: number}) => void}  goal
 */
```

## 6. ClickyProvider mapping (`providers/clicky.js`)

Each method late-binds `window.clicky` / `window.clicky_custom` and is wrapped so analytics never throws into the UI.

| Contract call | Clicky implementation |
|---|---|
| `init()` | **no-op** — `stats.js` self-inits site 66488278 at load; the adapter does not touch activation |
| `identify(user)` | `window.clicky_custom = window.clicky_custom || {}; window.clicky_custom.visitor = {userid, username}; window.clicky?.custom_data?.()` (writes the **global** explicitly — fixes Utils.js:647). No goal side-effect. |
| `pageview(path,title)` | `window.clicky?.log?.(path, title, 'pageview')` |
| `goal(name,{revenue})` | `window.clicky?.goal?.(name, revenue)` — Clicky's native revenue goals |

`NoopProvider` implements the same shape with empty bodies. The singleton picks `NoopProvider` only when `typeof window === 'undefined'` (SSR / Next front door) or `config.enabled === false`; otherwise `ClickyProvider`. Because `ClickyProvider` itself late-binds and optional-chains `window.clicky`, it is already a no-op on localhost and safe before `stats.js` loads — no bootstrap race.

## 7. Goal catalog (`goals.js`)

```js
export const GOALS = {
  SIGNIN: 'signin', SIGNUP: 'signup', COMMENT: 'comment', STUDY: 'study',
  READ: 'read', WATCH: 'watch', FINISH: 'finish', LANGUAGE: 'language',
  KR_BUY: 'kr_buy', KR_DOWNLOAD: 'kr_download',
};
/** @typedef {typeof GOALS[keyof typeof GOALS]} GoalName */
```

Single source of truth + editor autocomplete (an unknown `GOALS.X` is `undefined`, and stats.js `goal(undefined)` silently returns — so it degrades safely, but it is **not** compile-enforced type safety). Narration "lookup" stays a **pageview**, not a goal. `KR_BUY` may pass `{revenue}` if the price is known at the click site (see §12).

## 8. Call-site migration

| Location | Today | After |
|---|---|---|
| `models/Utils.js:646` `clickyUser()` | visitor + `custom_data()` + `goal("signin")` | delete; replaced by `analytics.identify()` (no goal side-effect) |
| `appController.js:326` (`setPreLoadData` — token refresh) | `clickyUser(...)` | `analytics.identify({userid, username})` only |
| `appController.js:673` (`processSignIn` — real sign-in) | `clickyUser(...)` | `analytics.identify(...)` + `analytics.goal(GOALS.SIGNIN)` |
| `SignUp.js:44` | `window.clicky?.goal("signup")` | `analytics.goal(GOALS.SIGNUP)` |
| `StudyChat.js:119,686` · `Study.js:151` · `Feed.js:849` | `...goal("comment")` | `analytics.goal(GOALS.COMMENT)` |
| `StudyHall.js:288` | `...goal("study")` | `analytics.goal(GOALS.STUDY)` |
| `Page.js:217` | `...goal("read")` | `analytics.goal(GOALS.READ)` |
| `Theater.js:1014` | `...goal("watch")` | `analytics.goal(GOALS.WATCH)` |
| `Victory.js:44` | `...goal("finish")` | `analytics.goal(GOALS.FINISH)` |
| `Sidebar.js:406` | `...goal("language")` | `analytics.goal(GOALS.LANGUAGE)` |
| `KRSEB.js:27-28` | `onClick={window.clicky?.goal("kr_buy")}` (**render-time bug**) | `onClick={() => analytics.goal(GOALS.KR_BUY)}` / `KR_DOWNLOAD` |
| `Narration.js:744` | `window.clicky?.log(path,title,"pageview")` | `analytics.pageview(path, title)` |

**Not migrated (stay as-is):** the `index.html` synthetic-pageview title observer, the `index.html` `clicky_custom` flags, the `stats.js` `<script>` load and its hardcoded self-init, and the backend `/ping`.

## 9. Config & init

- No new env var and no config-driven site id in this phase — activation is unchanged. A single call `analytics.init()` at app bootstrap is a no-op for Clicky (present for the future-provider path).
- SSR / Next front door: `typeof window === 'undefined'` → `NoopProvider`, so nothing runs server-side or for bot SSR.

## 10. Error handling & safety

- Every provider method optional-chains `window.clicky` and is wrapped so a failure is swallowed — analytics is non-critical and must never break the UI.
- `NoopProvider` covers SSR and the explicit off-switch with zero side-effects.

## 11. Testing (Jest / react-scripts)

`react-scripts test` + jest exist in `package.json`; `stats.js` never loads in jsdom, which is the right isolation.

- `NoopProvider`: every method is a no-op (no throws, no globals mutated).
- `ClickyProvider` with a mocked `window.clicky` + `window.clicky_custom`: `identify` sets the **global** `clicky_custom.visitor` and calls `custom_data` (and fires **no** goal); `pageview` → `clicky.log(path,title,'pageview')`; `goal` → `clicky.goal(name, revenue)` incl. the revenue arg; all safe when `window.clicky` is undefined.
- `goals.js`: catalog values stable; a repo grep test asserts no `window.clicky` / raw goal-string literals remain in migrated files.
- Singleton: `analytics` and `useAnalytics()` return the same instance; SSR (`window` undefined) selects Noop.
- No real network / Clicky calls.

## 12. Open items (non-blocking)

- `KR_BUY` revenue: only pass `{revenue}` if the price is known at the click site; otherwise fire without it.
- Config-driven site id + a true provider-`init()` path is a **deliberate future step**, to be done safely *together with* adding a real second provider (it would move the hardcoded id out of `stats.js` into an inline `index.html` script templated from env, and strip `stats.js:650` — an owned patch). Explicitly not in this phase.
