# SSR/CRA gating redesign — single classifier + observable misroute tracking

**Date:** 2026-09-02
**Status:** Design approved (revised after a Fable second-opinion review, empirically verified). Implementation plan pending.
**Area:** `frontend/next/middleware.ts`, new `frontend/next/lib/classify.ts`, `ops/telemetry/vector.yaml`, tests, docs.

## Problem & context

The Next front door routes each request to either the CRA (React app, for humans)
or SSR (for crawlers/unknown clients). The gate previously required a positive
`Sec-Fetch` or `Sec-CH-UA` header to reach the CRA. Those headers only exist on
Chromium/Gecko — WebKit sends neither — so **Safari desktop and every iOS
browser** (Safari, Chrome/CriOS, Firefox/FxiOS), plus Firefox with those headers
stripped, were misrouted to SSR. Fixed on 2026-09-02 (commit `dca2bdc5`) by
gating on User-Agent alone, plus a `render-decision` log with a `suspect` flag.

This redesign hardens that fix into a principled, single-source classifier and
makes both misroute directions measurable — and, per the review below, fixes two
misroute cohorts still broken after `dca2bdc5`.

### North star
**Balance both misroute directions, observably.** Neither "human served SSR"
nor "crawler served the empty CRA shell" dominates; the priority is a principled
classifier plus data to see the misroute rate in both directions and tune with
evidence, not guesses. **Honest scope:** UA-based routing can make the *human→SSR*
direction genuinely observable; the *bot→CRA* direction is only observable for
non-spoofing bots (a scraper sending a clean Chrome UA is undetectable from UA
alone — its signal lives in the IP-bearing NPM access stream, not here).

### Environment facts that shape the design
- Middleware runs on the Next **edge runtime** — classifier must be pure, no Node
  built-ins.
- Prod observability is **Vector → VictoriaLogs** (`:9428`), Docker on the
  `json-file` driver. The app's `console.log` render-decision lines already ship
  to VictoriaLogs via Vector's `docker_logs` source (verified: ~2k lines/30 min;
  `_msg` is clean JSON — no pm2 line prefix — so `unpack_json` works).
- A **second** Vector stream tails NPM's `bom-telemetry.log`, which carries a
  `client_class` field (from the `X-BOM-Client-Class` response header the
  middleware sets) and is enriched with a `crawler_family` taxonomy. The Vector
  config lives in-repo at `ops/telemetry/vector.yaml`.

### Empirical findings from review (isbot 5.2.2, verified)
- isbot **already flags** Yeti, Daumoa, kakaotalk-scrap, kakaostory-og-reader — a
  Korean-crawler regex supplement adds no coverage.
- A `naver|daum|kakao` regex **also matches KakaoTalk and Naver in-app WebViews**
  (real humans) → they get SSR. This bug is **live today** in `KNOWN_CRAWLER_RE`.
- iOS/Android **in-app WebViews** (Facebook, Instagram, Naver, Kakao) end in
  `Mobile/15E148 <App>` with no `Safari/`/`CriOS/` token → today they fail the
  browser UA test → `unknown` → SSR. isbot correctly does not flag them.
- isbot flags **HeadlessChrome, Chrome-Lighthouse, Playwright default UA**, and
  **curl / python-requests / `(compatible; …)`** — the last three classify as
  `known-crawler`, not `unknown`.

## Goals / non-goals

**Goals**
- One classifier module owns the browser-vs-crawler decision in code.
- Adopt `isbot` as the crawler oracle (maintained list); **no** Korean supplement.
- Add `applewebkit\/` to the browser UA test so **in-app WebViews reach the CRA**.
- Emit richer structured fields (incl. raw `isbotHit`/`browserUa`); track misroutes
  with tripwires honest about what each can and cannot see.
- Add **`Vary: User-Agent`** + audited `Cache-Control` so shared caches cannot
  serve the wrong app.
- Align `ops/telemetry/vector.yaml`'s taxonomy to the app + add a drift-guard test.
- Ship a documented LogsQL query set.

**Non-goals (explicit)**
- No NPM `log_format` change (that is the deferred "1a" consolidation).
- No dashboards or alerting (observability = rich logs + documented queries).
- No device detection beyond a boolean `isMobile`.
- No changes to `php` or any other prod container.
- Headless/automated clients (Lighthouse, HeadlessChrome, Playwright) are **left on
  SSR** — the honest served-to-bots page; the project's own verify/screenshot
  workflows hit `:8201` (CRA) directly and are unaffected.

## Architecture — single source of truth

Create `frontend/next/lib/classify.ts` exporting a pure `classify(request) →
Decision`. It becomes the single place the app decides browser vs crawler.
`middleware.ts` shrinks to: call `classify()`, then route (CRA / SSR / asset /
redirect) and log. `isInteractiveBrowserNavigation`, `classifyClient`,
`KNOWN_CRAWLER_RE`, and `BROWSER_UA_RE` collapse into this module.

`Decision` shape (drives routing + logging):
```
{ renderMode, clientClass, crawlerFamily, isMobile, isNav,
  isbotHit, browserUa, signal, suspect, leak }
```

Consumers:
1. **Routing** — middleware reads `renderMode`.
2. **Response headers** — `X-BOM-Client-Class` (unchanged). **No
   `X-BOM-Crawler-Family` header** — under 1b it would have no consumer (NPM
   log_format is a non-goal), so it is cut.
3. **`render-decision` log** — the full `Decision` plus the request-header
   fingerprint (logged only for navigations; see below).

**Vector deference — decision 1b (chosen), revised.** The app is canonical: one
classifier in code drives routing and the render-decision log. Because
`vector.yaml` is in-repo, we **align its `crawler_family` VRL to the app's
taxonomy** (fixing the same in-app-WebView mis-tag on the access stream) and add a
drift-guard unit test that parses the regexes out of `vector.yaml` and asserts
agreement with `classify.ts`. NPM is untouched. The fuller "1a" (app emits a
crawler-family header → NPM log_format → Vector reads it) stays deferred.
*Plan caveat:* confirm the in-repo `vector.yaml` is the deployed copy (prod had
`/home/ubuntu/observability/vector.yaml`); if not synced, the drift test still
guards the repo and prod alignment is a separate documented op.

## The classifier (`classify.ts`)

**Inputs:** `method`, `ua`, headers (`sec-fetch-mode/dest`, `sec-ch-ua`,
`sec-ch-ua-mobile`, `accept`). Pure, no I/O.

**Dependency:** `isbot` (5.2.2; CommonJS with dual exports, named import
`import { isbot } from 'isbot'`; pure regex, edge-compatible). **No Korean
supplement** — verified redundant for crawlers and harmful to in-app-WebView
humans.

**Browser UA test (revised):**
```
BROWSER_UA_RE = /mozilla\/5\.0.*(?:chrome|chromium|crios|firefox|fxios|safari|edg|opr|applewebkit)\//i
```
The added `applewebkit\/` alternative captures iOS/Android in-app WebViews (FB,
IG, Naver, Kakao) that lack a `Safari/`/`CriOS/` token. Safe because crawlers are
screened by isbot **first** (Googlebot-smartphone contains AppleWebKit but is
isbot-flagged before the browser check — verified).

**Decision logic (order matters):**
1. `isNav = method === 'GET' || method === 'HEAD'`.
2. `isbotHit = isbot(ua)`; `browserUa = BROWSER_UA_RE.test(ua)` (raw signals, logged).
3. `clientClass`:
   - `isbotHit` → `known-crawler`
   - else `browserUa` → `browser`
   - else → `unknown`
4. `renderMode` (routing): `browser && isNav` → `cra`; everything else → `ssr`.
   Asset/SEO/redirect overrides remain in middleware, not in `classify`.
5. **Bias for `unknown`:** `unknown` → SSR. It has no browser UA, so it is rarely a
   real human; SSR is the SEO-safe default (and a quiet accessibility win — no-JS
   clients like Lynx get content, not an empty shell). Made *observable*, not guessed.

**Enrichment fields (observability, not routing):**
- `crawlerFamily`: `known-crawler` UA → one of the canonical values
  **`google|bing|meta|openai|screpy|seo-tool|other-crawler`** (exact strings match
  the aligned `vector.yaml` so cross-stream query #4 is comparable);
  `browser`→`browser`; `unknown`→`unknown`.
- `isMobile`: `sec-ch-ua-mobile: ?1` OR UA matches `iPhone|iPad|Android|Mobile`.
- `signal`: why we decided — `isbot | browser-ua | applewebkit | no-browser-ua |
  non-nav`. Key tuning field.

**Tripwires (honest about coverage):**
- `suspect` (human→SSR, the direction UA *can* see): `isNav && renderMode==='ssr'
  && browserUa && !isbotHit`. Excludes non-nav (fixes the observed Chrome-`POST`
  false positive). **Does not** catch isbot-false-positives — those are surfaced by
  a separate documented query on `class:known-crawler AND browserUa:true` (query #6).
- `leak` (bot→CRA): `renderMode==='cra' && isbotHit`. **Structurally constant-false**
  by the decision order — kept only as a cheap invariant assertion (a hit means a
  logic bug). The *real* bot→CRA leak (UA-spoofing scraper) is undetectable here;
  its signal is on the NPM access stream (datacenter-ASN IPs sending
  `client_class=browser`, or navs never followed by a bundle fetch). Documented as a
  query against that stream, not a flag.

**`Sec-Fetch` / `Sec-CH-UA`:** no longer decisive (that was the original bug) but
still **logged** as corroborating signals, so data can show whether they are safe
to reintroduce as a future tiebreaker.

## Caching & edge safety (new — protects the whole design)

UA-based routing means the HTML response **varies by User-Agent**, and shared
caches sit in front (Cloudflare on dev — 4-hour edge cache, has bitten this repo
before; NPM on prod). Without correct cache headers, a cache primed by a crawler
can serve SSR HTML to humans (or the empty CRA shell to Googlebot) — a failure
that **bypasses the classifier entirely** and shows `suspect:0` while users see
the wrong app.

- The `cra` and `ssr` HTML branches MUST set **`Vary: User-Agent`**.
- **Audit `Cache-Control`** actually emitted on each branch (CRA proxy response,
  SSR response) and set an explicit, correct value — do not rely on defaults.
- This is required for compliant dynamic serving (UA-based serving without `Vary`
  is the classic cloaking-adjacent trap Google warns about).

## Observability

**Enhanced `render-decision` log** — one JSON line **per navigation** (`isNav`
only, so GraphQL `POST /en` and other non-navs no longer pollute distribution
stats), carrying the full `Decision`:
```json
{"tag":"render-decision","render":"ssr","class":"known-crawler","crawlerFamily":"google",
 "isMobile":false,"isNav":true,"isbotHit":true,"browserUa":true,"signal":"isbot",
 "suspect":false,"leak":false,"host":"…","path":"…","method":"GET","ua":"…",
 "secFetchMode":null,"secChUa":null,"secChUaMobile":null}
```
Headers-only (no IP/PII); assets/redirects skipped; `BOM_LOG_RENDER_DECISION=0`
disables.

**Querying — decision 3a (chosen): query-time `unpack_json`.** No Vector *ingest*
change (the taxonomy alignment above is a separate, config-only edit). Fields sit
inside `_msg`; documented queries unpack inline. (3b, a Vector transform for
first-class fields, is rejected — VictoriaLogs handles the volume trivially and
`unpack_json` runs after the `render-decision` word filter prunes the stream.)

**Documented query set** → `docs/reference/render-decision-logsql.md`, each a
copy-paste LogsQL line filtered to the app container
(`_stream:{container_name=~"bookofmormon-online.*"} render-decision | unpack_json
from _msg | …`):
1. Human→SSR misroutes: `filter suspect:true`, group by `ua`.
2. Render distribution: `filter isNav:true | stats by (render) count()`.
3. Crawler family breakdown: `stats by (crawlerFamily) count()`.
4. Mobile served CRA (reported symptom, now healthy): `filter isMobile:true
   render:cra | stats count()`.
5. Unknown-UA review (any `unknown→ssr` actually browsers?): `filter class:unknown
   | stats by (ua) count()` top-N.
6. isbot false-positives (real browsers flagged as bots → SSR, incl. headless):
   `filter class:known-crawler browserUa:true | stats by (ua) count()`.
7. Decisive-signal mix: `stats by (signal) count()`.
8. Bot→CRA leak proxy — **on the NPM access stream**: `client_class:browser` from
   datacenter ASNs (documented separately, uses the IP-bearing stream).

**Volume/retention:** unchanged order of magnitude; richer fields; already ingested.

## Testing

**Unit — `test/unit/classify.test.ts`** (the existing `test/unit/*.test.ts` run
under Playwright's runner — no new test framework needed). Table-driven over
**isbot-verified** UA fixtures (fixtures must be checked against isbot 5.2.2, since
curl/python-requests/`(compatible;…)` are bot-flagged):
- Browsers → `browser`/`cra`: Chrome, Firefox desktop, Safari desktop, iOS Safari,
  Firefox-iOS, Chrome-Android, Edge — with/without `Sec-Fetch`/`Sec-CH-UA`.
- **In-app WebViews → `browser`/`cra` (regression for the fix):** Facebook-iOS,
  Instagram, KakaoTalk-Android, Naver-app.
- Crawlers → `known-crawler`/`ssr`: Googlebot, Bingbot, facebookexternalhit,
  GPTBot, AhrefsBot, **Yeti, Daumoa, kakaotalk-scrap** (now via isbot, not a
  supplement), and a browser-UA-spoofing scraper isbot knows.
- **Headless → `known-crawler`/`ssr` (accepted behavior, pinned):** HeadlessChrome,
  Chrome-Lighthouse.
- `unknown` → `ssr`: empty UA, and a non-Mozilla app token (e.g. `Acme-Monitor/1.0`).
- Tripwires: browser `POST` → `suspect:false`; `leak:false` everywhere.
- `crawlerFamily` + `isMobile` spot-checks.

**vector.yaml drift test** — parse the `crawler_family` regexes from
`ops/telemetry/vector.yaml` and assert they agree with `classify.ts` on the family
fixtures (guards 1b honesty; catches the `naver|daum|kakao` in-app tokens and any
`screpy` divergence).

**Integration — extend `test/routes/seo-gating.test.ts`** (reads
`X-BOM-Render-Mode`/`X-BOM-Client-Class`): keep the 5 browser cases already added;
add an in-app-WebView→`cra` case, a headless→`ssr` case, and assert **`Vary:
User-Agent`** is present on both HTML branches.

**isbot verification gate** — the empirical UA/isbot check (already run once during
review) is documented and re-runnable; its result is **binding** on the fixture
lists and the no-supplement decision.

## Rollout
1. Land on `dev`; full `next` test suite green + typecheck (confirm isbot bundles
   in the edge build).
2. Live-probe dev `:8200` with the UA matrix (Safari/iOS/**KakaoTalk-in-app**/
   **FB-iOS**/Googlebot/headless) → header check; confirm `Vary: User-Agent`.
3. Commit `dev` → fast-forward `prod` → CI blue-green deploy.
4. Post-deploy verification:
   - LogsQL query #2 returns **non-zero grouped output** (proves `unpack_json`
     parses — guards against any log-prefix regression).
   - Queries #1 and #6 ≈ 0 and query #4 (mobile→CRA) healthy on real traffic.
   - Header-probe a KakaoTalk-in-app and FB-iOS UA against prod → `cra`.

## Risks
- **isbot misses a crawler spoofing a full browser UA** → served CRA shell (SEO
  cost). Inherent to UA gating; residual cases visible only on the access stream
  (query #8), not from UA.
- **isbot flags a real browser as a bot** → served SSR. Headless is accepted; any
  *interactive* browser so flagged surfaces in query #6 (not hidden in `suspect`).
- **Cache/`Vary` regression** → wrong app served from cache, bypassing the
  classifier. Mitigated by the caching section; verify `Vary` post-deploy.
- **`vector.yaml` deploy drift** — repo copy may not be the running copy; drift
  test guards the repo, prod alignment is a documented follow-up.
- **Edge-runtime import** — confirm isbot bundles cleanly in the middleware edge
  build (typecheck + dev boot).

## Related
- Prior fix: commit `dca2bdc5` (UA-based gate + render-decision logging) — the
  starting point this redesign hardens.
- Fable second-opinion review (2026-09-02) — findings folded in above; the
  empirical isbot results drove the no-supplement, `applewebkit`, and headless
  decisions.
- Documented query set to be written at `docs/reference/render-decision-logsql.md`.
