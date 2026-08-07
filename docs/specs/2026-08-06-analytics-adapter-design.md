# Analytics Adapter — Design Spec

Date: 2026-08-06
Status: Approved design (ready for implementation plan)
Scope: Frontend client-side analytics abstraction (`frontend/webapp/`). Backend `/ping` proxy and vendored `public/stats.js` stay as-is (they remain the transport).

## 1. Goal

Abstract the direct `window.clicky` usage scattered across the webapp behind a single, provider-agnostic analytics adapter so the provider is swappable without touching call sites, and expose the full surface Clicky supports (goals with revenue, campaign/UTM attribution, custom visitor data). Clicky is the only implementation for now.

## 2. Context (from the 2026-08-06 audit)

- Clicky is currently **inactive**: no `clicky_site_id` is ever set, so `stats.js` never calls `clicky.init()` and no beacons fire. All calls are defensively optional-chained (`window.clicky?.goal(...)`).
- **Surface today** (all direct, no abstraction): 13 goal call sites (`signin, signup, comment×4, study, read, watch, finish, language, kr_buy, kr_download`); one synthetic-pageview title `MutationObserver` in `public/index.html`; one identify path (`clickyUser()` in `models/Utils.js:646`); the vendored/patched `public/stats.js` (POSTs to first-party `/ping`); a backend proxy (`ping` mutation → `backend/src/media/ping.ts` → `in.getclicky.com`, secret `clickySiteAdmin`).
- No other analytics providers; no existing abstraction. Greenfield.
- Known bug: `views/About/KRSEB.js:27-28` — `onClick={window.clicky?.goal("kr_buy")}` fires at *render* time (missing arrow fn).
- Latent bug: `clickyUser()` fires the `signin` goal on both real sign-in AND every token refresh (`appController.js:326` and `:673`), inflating the metric.

## 3. Approved decisions

- **Architecture:** Approach A — a **singleton module + provider contract** (matches the global nature of `window.clicky`; least ceremony; swappable via one factory line).
- **Provider scope:** provider-agnostic contract + **Clicky-only** implementation now.
- **Surface:** frontend client adapter only. Backend `/ping` and `stats.js` unchanged.
- **Expanded surface:** whatever Clicky natively supports — goals with **revenue**, **campaign/UTM attribution** via visitor custom-data, arbitrary custom data.
- **Transport:** hybrid — keep the first-party `/ping` proxy (adapter routes through `window.clicky` → `stats.js` → `/ping`); provider-specific direct features remain possible.
- **signin goal:** identify on both sign-in and refresh; fire `goal(SIGNIN)` only on real sign-in.
- **Pageview observer:** move it out of `index.html` into the adapter (one home for pageview logic).
- The webapp is JS (React 17, no TS in `src/`), so the "interface" is a JSDoc-typed contract + a base no-op class, not a TS `interface`.

## 4. Module layout

Lives under `src/models/` to match where `clickyUser` lives today.

```
frontend/webapp/src/models/analytics/
├── index.js          # builds the singleton from config; exports `analytics` + re-exports GOALS
├── contract.js       # JSDoc @typedef: AnalyticsProvider, AnalyticsUser, CampaignData, AnalyticsConfig
├── goals.js          # typed GOALS catalog + GoalName typedef
├── campaign.js       # first-touch UTM/referrer capture → CampaignData (sessionStorage-persisted)
├── useAnalytics.js   # thin React hook returning the singleton
└── providers/
    ├── clicky.js     # ClickyProvider — maps the contract onto window.clicky / clicky_custom
    └── noop.js       # NoopProvider — safe no-op when disabled / no site id / SSR
```

## 5. Provider contract (`contract.js`)

```js
/**
 * @typedef {Object} AnalyticsUser
 * @property {string} userid
 * @property {string} [username]
 *
 * @typedef {Object} CampaignData
 * @property {string} [source]   // utm_source
 * @property {string} [medium]   // utm_medium
 * @property {string} [campaign] // utm_campaign
 * @property {string} [term]     // utm_term
 * @property {string} [content]  // utm_content
 * @property {string} [referrer] // document.referrer at first touch
 * @property {string} [landing]  // landing path at first touch
 *
 * @typedef {Object} AnalyticsConfig
 * @property {string} [siteId]        // REACT_APP_CLICKY_SITE_ID; absent → NoopProvider
 * @property {boolean} [enabled]      // hard off-switch
 *
 * @typedef {Object} AnalyticsProvider
 * @property {(cfg: AnalyticsConfig) => void}                       init
 * @property {(user: AnalyticsUser|null) => void}                   identify
 * @property {(path: string, title?: string) => void}              pageview
 * @property {(name: GoalName, opts?: {revenue?: number}) => void}  goal
 * @property {(action: string, opts?: {href?: string, title?: string}) => void} event
 * @property {(campaign: CampaignData) => void}                    setCampaign
 * @property {(data: Record<string, string|number>) => void}       custom
 */
```

## 6. ClickyProvider mapping (`providers/clicky.js`)

| Contract call | Clicky implementation |
|---|---|
| `init(cfg)` | ensure `window.clicky_custom`; set `pageview_disable=true`, `history_disable=true`; `window.clicky.init(cfg.siteId)` at runtime; capture + `setCampaign`; start the title observer |
| `identify(user)` | `clicky_custom.visitor = {userid, username}`; `clicky.custom_data()` |
| `pageview(path,title)` | `clicky.log(path, title, 'pageview')` |
| `goal(name,{revenue})` | `clicky.goal(name, revenue)` |
| `event(action,{href,title})` | `clicky.log(href ?? location.pathname, title, action)` |
| `setCampaign(c)` | merge UTM/referrer into `clicky_custom.visitor` custom keys; `clicky.custom_data()` |
| `custom(data)` | shallow-merge into `clicky_custom.visitor` |

Every method is optional-chained and wrapped so analytics **never throws into the UI**. Runtime `clicky.init(siteId)` means the adapter owns activation — `index.html` no longer juggles the site id.

**NoopProvider** implements the same shape with empty bodies. The singleton selects `ClickyProvider` when `config.enabled !== false`, `config.siteId` is set, `typeof window !== 'undefined'`, and `window.clicky` exists; otherwise `NoopProvider`. With Clicky inactive today (no `REACT_APP_CLICKY_SITE_ID`), the app runs entirely on Noop — identical to current behavior.

## 7. Goal catalog (`goals.js`)

```js
export const GOALS = {
  SIGNIN: 'signin', SIGNUP: 'signup', COMMENT: 'comment', STUDY: 'study',
  READ: 'read', WATCH: 'watch', FINISH: 'finish', LANGUAGE: 'language',
  KR_BUY: 'kr_buy', KR_DOWNLOAD: 'kr_download',
};
/** @typedef {typeof GOALS[keyof typeof GOALS]} GoalName */
```

Typo-safe, discoverable, single source of truth. `KR_BUY` may carry `{revenue}`. Narration "lookup" stays a **pageview** (`analytics.event('lookup', …)` or `pageview`), not a goal.

## 8. Campaign capture (`campaign.js`)

- On init, parse `location.search` for `utm_{source,medium,campaign,term,content}` and read `document.referrer`.
- **First-touch persistence:** store to `sessionStorage['_bom_campaign']` only if not already present, so the entry campaign sticks across SPA navigation.
- Return `CampaignData`; the adapter calls `setCampaign(data)` during `init`, attaching it to the Clicky visitor so every subsequent goal is attributed to its entry campaign.

## 9. Call-site migration

| Location | Today | After |
|---|---|---|
| `models/Utils.js:646` `clickyUser()` | sets visitor + fires `signin` goal | `analytics.identify({userid, username})` (no goal side-effect) |
| `appController.js:326` (real sign-in) | `clickyUser(...)` | `analytics.identify(...)` + `analytics.goal(GOALS.SIGNIN)` |
| `appController.js:673` (token refresh) | `clickyUser(...)` | `analytics.identify(...)` only (no signin goal) |
| `SignUp.js:44` | `window.clicky?.goal("signup")` | `analytics.goal(GOALS.SIGNUP)` |
| `StudyChat.js:119,686` · `Study.js:151` · `Feed.js:849` | `...goal("comment")` | `analytics.goal(GOALS.COMMENT)` |
| `StudyHall.js:288` | `...goal("study")` | `analytics.goal(GOALS.STUDY)` |
| `Page.js:217` | `...goal("read")` | `analytics.goal(GOALS.READ)` |
| `Theater.js:1014` | `...goal("watch")` | `analytics.goal(GOALS.WATCH)` |
| `Victory.js:44` | `...goal("finish")` | `analytics.goal(GOALS.FINISH)` |
| `Sidebar.js:406` | `...goal("language")` | `analytics.goal(GOALS.LANGUAGE)` |
| `KRSEB.js:27-28` | `onClick={window.clicky?.goal("kr_buy")}` (**render-time bug**) | `onClick={() => analytics.goal(GOALS.KR_BUY)}` / `KR_DOWNLOAD` |
| `Narration.js:744` | `window.clicky?.log(path,title,"pageview")` | `analytics.event('lookup', {href, title})` (kept as pageview-type) |
| `public/index.html:87-98` (title observer) | inline observer → `window.clicky.log(...)` | moved into adapter init → `analytics.pageview(path, title)` |
| `public/index.html:82-84` (clicky_custom flags) + `:101` (`stats.js` load) | inline | flags move into adapter init; `index.html` keeps only the `stats.js` `<script>` |

## 10. Config, init, activation

- New env `REACT_APP_CLICKY_SITE_ID` (empty today → Noop → tracking stays inactive, as now).
- Adapter initialized once at app bootstrap (App root / appController init) with `{ siteId: process.env.REACT_APP_CLICKY_SITE_ID, enabled: … }`.
- SSR / Next front door: `typeof window` guard → Noop for server render and bots. No analytics for SSR/bot traffic.

## 11. Error handling & safety

- All provider methods guard on `window.clicky` existence (optional chaining) and are wrapped so a failure is swallowed (analytics is non-critical; must never break the app).
- NoopProvider covers disabled/SSR paths with zero side-effects.

## 12. Testing (Jest / CRA)

- `NoopProvider`: every method is a no-op (no throws, no globals touched).
- `ClickyProvider`: with a mocked `window.clicky`/`clicky_custom`, `goal/pageview/identify/event/setCampaign/custom` call the right underlying methods with the right args (incl. revenue on `goal`).
- `goals.js`: catalog values are stable; `GOALS.X` used everywhere (no string literals left — a repo grep test).
- `campaign.js`: first-touch persistence (second visit doesn't overwrite); UTM parsing.
- Singleton: `analytics` and `useAnalytics()` return the same instance; provider selection (Noop when no siteId, Clicky when siteId + window.clicky).
- No real network/Clicky calls in tests.

## 13. Out of scope (explicitly)

- Backend `ping` mutation / `forwardPageview()` / `clickySiteAdmin` — unchanged; remains the transport.
- Refactoring the vendored `public/stats.js` (654 lines of UTM/referrer/beacon logic) — unchanged; a future phase.
- A second provider implementation (GA4/Plausible/Segment) — the contract makes it a drop-in later; not built now.
- Multi-provider fan-out, an owned analytics DB, server-side funnels — future phases.

## 14. Open items (non-blocking)

- Exact `revenue` value for `KR_BUY` (is the price known at the click site? if not, fire without revenue).
- Whether `event('lookup')` should remain a pageview or become a distinct custom action in Clicky.
