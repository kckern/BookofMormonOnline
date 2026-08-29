# Clicky analytics integration

How Book of Mormon Online wires up Clicky (getclicky.com) for traffic and goal tracking. This is a **first-party / anti-adblock** deployment using Clicky's official reverse-proxy method (https://clicky.com/help/proxy), implemented in the **Next.js front door** (`frontend/next/`). The tracker JS and all beacons route through obfuscated first-party paths on our own origin, so filter lists (EasyPrivacy, uBlock Origin) can't match a `getclicky.com` domain or a known path like `/stats.js`.

> **History:** this replaced an earlier homegrown variant (a vendored/patched `public/stats.js` posting base64 to an Express `/ping` proxy). That approach is fully removed from the live path. See [Migration notes](#migration-notes).

## Secrets / public-repo rule

**This repo is public.** Clicky's obfuscated proxy paths are account-specific and are **never committed**. They live only in env (Infisical / gitignored `.env` files) and are referenced by variable name:

| Variable | Side | Purpose |
|---|---|---|
| `CLICKY_JS_PATH` | Next (server) | Public path the browser requests the tracker JS from, e.g. `/<obfuscated>.js`. Middleware matches it. |
| `CLICKY_BEACON_PATH` | Next (server) | Public path beacons POST to, e.g. `/<obfuscated>`. Middleware matches it; also baked into the served JS via the `in=` param. |
| `REACT_APP_CLICKY_SITE_ID` | CRA (browser) | Clicky numeric site id (`data-id`). Public by design, but env-sourced for consistency. |
| `REACT_APP_CLICKY_JS_PATH` | CRA (browser) | Same value as `CLICKY_JS_PATH`; substituted into the `<script src>` at build. |

`REACT_APP_*` are read by the CRA (`react-app-rewired`) and substituted into `public/index.html` at build/serve time. The two server vars are read by Next middleware at runtime. On the dev host they sit in gitignored `frontend/next/.env.local` and `frontend/webapp/.env.development.local`; the durable/prod home is Infisical (`bom-dev.env`, loaded via the service `EnvironmentFile`).

## Pieces

| File | Role |
|---|---|
| `frontend/next/lib/clicky.ts` | `clickyPaths()` (reads env) + `proxyClickyJs()` / `proxyClickyBeacon(req)`. Edge-compatible (only `fetch`/`Response`/`Headers`). The JS proxy fetches `static.getclicky.com/js?in=<beacon-path>`; the beacon proxy forwards to `in.getclicky.com/in.php`, passing the real visitor IP via `X-Forwarded-For` and the UA. |
| `frontend/next/middleware.ts` | Early carve-out: if the request path equals `CLICKY_JS_PATH` or `CLICKY_BEACON_PATH`, it returns the proxied response directly (before the human→CRA rewrite and before the bot-SSR branch). Nothing Clicky-related is a routable app path. |
| `frontend/webapp/public/index.html` (L81–99) | Vendor-neutral `<title>` observer that emits `bom:analytics-pageview` only for later SPA navigations. It contains no Clicky global or loader code. |
| `frontend/webapp/src/models/analytics/index.js` | `createProvider()` factory + the singleton `export const analytics`. `NoopProvider` under SSR / when `config.enabled === false`; otherwise `ClickyProvider`. Re-exports `GOALS`. |
| `frontend/webapp/src/models/analytics/providers/clicky.js` | `ClickyProvider` — the only code that touches `window.clicky`. `identify`/`pageview`/`goal`, each wrapped in `safe()` so analytics can never break the UI. `init()` is a deliberate no-op (the Clicky loader self-inits from `data-id`; a second `init()` would double-fire). |
| `frontend/webapp/src/models/analytics/{goals.js,contract.js,useAnalytics.js,noop.js}` | `GOALS` string constants (single source of truth), JSDoc provider contract, `useAnalytics()` hook, `NoopProvider`. |
| `frontend/webapp/src/models/analytics/*.test.js` | Jest tests incl. `callsites-migration.test.js` (guards against any view re-introducing a raw `window.clicky` call). |

## Bootstrap flow (browser)

1. `index.html` initializes `lastPath`; its vendor-neutral observer emits `bom:analytics-pageview` only after the pathname changes.
2. The analytics adapter initializes during the app bootstrap, configures Clicky with only `history_disable`, and injects `<script async data-id="66488278" src="/<CLICKY_JS_PATH>">` from `providers/clicky.js`. Keeping the automatic initial pageview enabled preserves `document.referrer` without producing a duplicate observer hit.
3. The Next front door's `middleware.ts` sees the path == `CLICKY_JS_PATH` and returns `proxyClickyJs()` — which fetches `static.getclicky.com/js?in=<CLICKY_BEACON_PATH>` and returns it as `application/javascript` (`Cache-Control: public, max-age=3600`). The `in=` param makes the returned tracker send its beacons to `CLICKY_BEACON_PATH` on our origin.
4. The Clicky loader auto-registers the site from `data-id`, captures the original external referrer, emits the initial pageview, and exposes `window.clicky` (with `.log()`, `.goal()`, `.custom_data()`).
5. The title `MutationObserver` emits a vendor-neutral browser event after pathname changes. The analytics bootstrap passes it to `analytics.pageview(...)`; only the Clicky adapter translates that into the vendor API call.
6. Middleware sees the path == `CLICKY_BEACON_PATH` and returns `proxyClickyBeacon(req)` — forwarding to `in.getclicky.com/in.php` with `X-Forwarded-For` (real visitor IP), UA, and `Cache-Control: no-store`.

> **Localhost:** Clicky's tracker no-ops on `localhost`, so `localhost:8200` doesn't beacon. The proxy endpoints themselves are still directly testable with curl (see [Verification](#verification)).

## Goal calls (conversion events)

React fires goals via `analytics.goal(GOALS.<NAME>)` (never `window.clicky` directly). `GOALS` lives in `analytics/goals.js`.

| Goal id | Call site | Trigger |
|---|---|---|
| `signin` | `appController.js:675` | after `analytics.identify(...)` on sign-in |
| `signup` | `views/User/SignUp.js:45` | new-account creation |
| `comment` | `Study/StudyChat.js:120,687`; `Study/Study.js:152`; `Home/Feed.js:850` | message sent (Sendbird `onSucceeded`) |
| `study` | `Study/StudyHall.js:289` | opening a study group |
| `read` | `views/Page/Page.js:218` | page progress saved |
| `watch` | `views/Theater/Theater.js:1015` | theater progress saved |
| `finish` | `views/User/Victory.js:45` | victory modal mount |
| `language` | `_Common/Sidebar.js:393` | language host switch |
| `kr_buy`, `kr_download` | `views/About/KRSEB.js:28-29` | Korean CTA buttons (correctly click-deferred) |

An explicit pageview also fires at `views/Page/Narration.js:749` (`analytics.pageview('/lookup/…', 'Lookup: …')`).

## User identification

`analytics.identify({ userid, username })` (`providers/clicky.js`) sets `window.clicky_custom.visitor` and calls `window.clicky.custom_data()`, adding `&custom[userid]=…&custom[username]=…` to subsequent beacons. `identify(null)` clears the visitor. Called from `appController.js:327` (token sign-in) and `:674` (social refresh, followed by the `signin` goal).

## Verification

Proxy endpoints (work on any host, incl. dev):

```bash
# JS path → 200, application/javascript, real tracker ("var _CLOB=…")
curl -sD- -o/dev/null "http://localhost:8200/<CLICKY_JS_PATH>"
# beacon → 200, Clicky's response ("if( window._cgen ) { }"), Cache-Control: no-store
curl -sD- -o/dev/null "http://localhost:8200/<CLICKY_BEACON_PATH>?site_id=66488278&type=pageview&href=%2Ftest"
```

End-to-end (real, non-localhost browser): load a page, watch DevTools → Network for POSTs to `CLICKY_BEACON_PATH` on title changes and goal calls; confirm hits land in the Clicky dashboard for the site id.

## Deployment / prod checklist

- [ ] Add `CLICKY_JS_PATH`, `CLICKY_BEACON_PATH` to Infisical for the Next service (dev + prod) so they survive beyond the gitignored `.env.local`.
- [ ] Add `REACT_APP_CLICKY_SITE_ID`, `REACT_APP_CLICKY_JS_PATH` to the prod CRA build env.
- [ ] **Cloudflare:** the beacon path must not be edge-cached. We send `Cache-Control: no-store` and the path has no file extension (CF won't cache it by default) — confirm there's no override cache rule matching it. The JS path (`.js`, `max-age=3600`) caching at the edge is fine.
- [ ] Verify beacons in a real browser on the public host + confirm hits in the Clicky dashboard.

## Migration notes

The previous homegrown method (`public/stats.js` patched to POST base64 to an Express `/ping` handler in `src/library/ping.ts`, authenticated server-side with `clickySiteAdmin`) is removed from the live path: `public/stats.js` is deleted and `index.html` no longer references it. The deprecated `src/` backend still contains `ping.ts` and the `/ping` mount; those can be dropped whenever `_deprecated/src` is cleaned up (nothing calls `/ping` anymore). The new method needs **no** server-side `sitekey_admin` — the browser's beacon carries its own session, and we merely forward it.

## Related

- Env loading: CLAUDE.md → "On this dev host" (Infisical → `bom-load-env` → `$XDG_RUNTIME_DIR/bom-dev.env`, consumed by the service `EnvironmentFile`).
- Front-door architecture: `docs/reference/nextjs-ssr-parity.md` (UA-gated middleware, human→CRA proxy).
