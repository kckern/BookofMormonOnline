# Clicky analytics integration

How Book of Mormon Online wires up Clicky (getclicky.com) for traffic and goal tracking. This is a **first-party / anti-adblock** deployment — the tracker JS is self-hosted and beacons are proxied through the BoM backend instead of hitting `*.getclicky.com` directly from the browser.

## Pieces

| File | Role |
|---|---|
| `frontend/webapp/public/stats.js` | Vendored Clicky tracker library. Patched: `this.domain = '/ping'` (line 16), beacons POSTed base64-encoded via `sendPostData` (line 442) instead of GET. |
| `frontend/webapp/public/index.html` (L67–88) | Bootstrap config + `MutationObserver` on `<title>` that fires synthetic pageviews; loads `/stats.js` async. |
| `frontend/webapp/src/models/Utils.js` (L713–718) | `clickyUser({ userid, username })` — populates `clicky_custom.visitor`, then fires `signin` goal. |
| `frontend/webapp/src/models/appController.js` (L365, L690) | Calls `clickyUser(...)` after token sign-in and after `processSignIn`. |
| `src/library/ping.ts` | Express handler that decodes the base64 POST body and proxies to `https://in.getclicky.com/in.php?sitekey_admin=...`. |
| `src/index.ts` (L18, L81) | `app.all("/ping", ping)` mounts the proxy. |

## Bootstrap flow (browser)

1. `index.html` defines `clicky_custom` with two opt-outs:
   - `pageview_disable = true` — suppress Clicky's auto-pageview-on-load.
   - `history_disable = true` — suppress Clicky's `history.pushState` hook (the SPA fires its own pageviews via the title observer).
2. `<script async src="/stats.js">` loads the vendored tracker. The IIFE in `stats.js` returns `{}` if `location.hostname === 'localhost'` (L4), so dev on `localhost:8200` is a no-op — `window.clicky` is an empty object.
3. On non-localhost, `clicky_obj.getInstance()` constructs the singleton and assigns it to `window.clicky`. The tail of the file (L647–650) tries to call `clicky.init()` for each entry in `clicky_site_ids` — see the **Caveat** below.
4. The title `MutationObserver` (index.html L74–85) watches the `<title>` element. When the SPA changes the document title (and the path actually changed), it calls `window.clicky.log(path, newTitle, "pageview")`, which fires a pageview beacon.

## Goal calls (conversion events)

`window.clicky?.goal("<name>")` fires a goal beacon. The optional-chaining is universal — the call is always defensive.

| Goal id | File:line | Trigger |
|---|---|---|
| `signin` | `src/models/Utils.js:717` | Called inside `clickyUser()` whenever a user identity is set. |
| `signup` | `src/views/User/SignUp.js:43` | Successful new-account creation. |
| `comment` | `src/views/_Common/Study/StudyChat.js:107`, `:648`; `src/views/_Common/Study/Study.js:123`; `src/views/Home/Feed.js:729` | Sendbird `sendUserMessage().onSucceeded`. Four call sites — chat, threaded reply, study reactions, home feed. |
| `study` | `src/views/_Common/Study/StudyHall.js:277` | StudyHall mount effect — fires once when a user opens a study group. |
| `read` | `src/views/Page/Page.js:690` | After `userprogress` save on a page, before the victory popup decision. |
| `watch` | `src/views/Theater/Theater.js:956` | After `userprogress` save in Theater. |
| `finish` | `src/views/User/Victory.js:42` | Victory modal mount. |
| `language` | `src/views/_Common/Sidebar.js:303` | User picks a different language host from the sidebar. |
| `kr_buy`, `kr_download` | `src/views/About/KRSEB.js:27–28` | Korean special-edition CTA buttons. **Bug:** `onClick={window.clicky?.goal("kr_buy")}` invokes the goal at render time (the result, `undefined`, is set as the handler). To fire on click, this needs to be `onClick={() => window.clicky?.goal("kr_buy")}`. |

## User identification

`clickyUser({ userid, username })` (Utils.js L713):

```js
var clicky_custom = window.clicky_custom || {};
clicky_custom.visitor = userData;
window.clicky?.custom_data();   // attaches visitor fields to subsequent beacons
window.clicky?.goal("signin");
```

`appController.js` calls it from two places:
- L365 — inside `processSignIn` (token-based sign-in path with a Sendbird user).
- L690 — inside the same flow on the user/social refresh path.

The visitor object becomes `&custom[userid]=...&custom[username]=...` query params on subsequent beacons (see `custom_data()` in stats.js L49–87).

## Beacon transport (the anti-adblock path)

Standard Clicky tracking GETs a 1×1 pixel from `in.getclicky.com/in.php?site_id=...&type=pageview&...`. Both the script (`static.getclicky.com`) and the beacon (`in.getclicky.com`) are blocked by common filter lists (EasyPrivacy, uBlock Origin defaults).

This integration sidesteps that:

1. **Script is self-hosted.** `<script src="/stats.js">` serves from the BoM origin — no `getclicky.com` domain in the script tag for filter lists to match.
2. **Beacons go to a first-party endpoint.** `this.domain = '/ping'` (stats.js L16) makes every `beacon()` call POST to `/ping` on the BoM origin.
3. **Payload is base64-encoded inside a POST body.** `sendPostData` (stats.js L442–486) base64-encodes the query string and POSTs it as `data=<base64>` — generic enough that URL-pattern-based blockers don't flag it. It prefers `navigator.sendBeacon` for non-critical types, falls back to `fetch`, then `XMLHttpRequest`.
4. **Backend proxy forwards to Clicky.** `src/library/ping.ts`:
   - Decodes `req.body.data` (base64) → query params.
   - Adds `ip_address` (best public IPv4 from `x-forwarded-for`, filtering private/loopback/link-local) and `ua` (User-Agent header).
   - GETs `https://in.getclicky.com/in.php?sitekey_admin=${process.env.clickySiteAdmin}&<merged-query>`.
   - Pipes Clicky's response back to the client as `text/plain`.

The `sitekey_admin` is what authenticates the write to Clicky; it lives in `process.env.clickySiteAdmin` (sourced from Infisical at service start — see CLAUDE.md). It is never exposed to the browser.

### What still leaks to `*.getclicky.com`

`stats.js` still calls `static.getclicky.com` and `clicky.com/ajax/...` directly for optional features:
- Heatmap script (`heatmap()` L232, L236, L242).
- On-site stats widget (`onsitestats()` L252–273).
- HTML video tracking (`html_media_monitor` L308–310).

None of these are enabled by the current `clicky_custom` config (`heatmap_disable` is unset but the heatmap module is only loaded when the URL hash matches `^#_heatmap`; the others require explicit opt-in via `clicky_custom.html_media_track` etc.). The core pageview/goal path is fully first-party.

## Caveat: `clicky_site_id` is never set in this codebase

`stats.js` only registers a site (and thus only sends beacons) for site IDs pushed onto `clicky_site_ids` before `init()` is called:

```js
var clicky_site_ids = clicky_site_ids || [];
if (window.async_site_id) clicky_site_ids.push(async_site_id);
if (window.clicky_site_id) clicky_site_ids.push(clicky_site_id);
while (clicky_site_ids.length) clicky.init(clicky_site_ids.shift());
```

A repo-wide search finds **no assignment** of `window.clicky_site_id`, `window.async_site_id`, or the `clicky_site_ids` global — not in `index.html`, not in any React component, not in the SSR output (SSR is only registered for `/sitemap.xml`, `/robots.txt`, `/manifest.json`, `/.well-known/assetlinks.json` per `src/ssr/index.ts:71`).

Consequence: `init()` never runs, the internal `site_ids` closure stays empty, and the `for (... site_ids.length ...)` loop in `beacon()` (stats.js L371) is a no-op. **No `/ping` POSTs are actually fired** by the goal/pageview calls scattered through the app, even though every call site is defensively wired with `window.clicky?.`.

To make tracking active you'd need to inject something like:

```html
<script>var clicky_site_id = '<your-public-site-id>';</script>
<script async src="/stats.js"></script>
```

into `frontend/webapp/public/index.html` before the stats.js tag. (The public `site_id` is the numeric ID from your Clicky dashboard; it is separate from `sitekey_admin`, which stays server-side.)

## Quick verification recipe

Once a site_id is configured:

1. From the dev host, `journalctl --user -u bom-dev -f` while loading a page.
2. The browser DevTools Network tab should show POSTs to `/ping` with `data=<base64>` payloads on title changes and goal calls.
3. The backend should see those requests; `axios.get` to `in.getclicky.com/in.php` should return Clicky's `OK` response.
4. Heatmap, on-site-stats, and HTML media tracking will hit `getclicky.com` directly — that traffic is not first-party.

## Related

- Backend env loading: see CLAUDE.md → "On this dev host" (Infisical → `bom-load-env` → `$XDG_RUNTIME_DIR/bom-dev.env`).
- The only external hostname referenced in chat/study code is `getclicky.com` (analytics only) — see `docs/reference/chat-studygroup-inventory.md` for the broader chat data-flow audit.
