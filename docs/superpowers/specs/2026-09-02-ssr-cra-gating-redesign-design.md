# SSR/CRA gating redesign — single classifier + observable misroute tracking

**Date:** 2026-09-02
**Status:** Design approved; implementation plan pending.
**Area:** `frontend/next/middleware.ts`, new `frontend/next/lib/classify.ts`, tests, docs.

## Problem & context

The Next front door routes each request to either the CRA (React app, for humans)
or SSR (for crawlers/unknown clients). The gate previously required a positive
`Sec-Fetch` or `Sec-CH-UA` header to reach the CRA. Those headers only exist on
Chromium/Gecko — WebKit sends neither — so **Safari desktop and every iOS
browser** (Safari, Chrome/CriOS, Firefox/FxiOS), plus Firefox with those headers
stripped, were misrouted to SSR. Fixed on 2026-09-02 (commit `dca2bdc5`) by
gating on User-Agent alone, plus a `render-decision` log with a `suspect` flag.

This redesign hardens that fix into a principled, single-source classifier and
makes both misroute directions measurable.

### North star
**Balance both misroute directions, observably.** Neither "human served SSR"
nor "crawler served the empty CRA shell" dominates; the priority is a principled
classifier plus data to see the misroute rate in both directions and tune with
evidence, not guesses.

### Environment facts that shape the design
- Middleware runs on the Next **edge runtime** — classifier must be pure, no Node
  built-ins.
- Prod observability is **Vector → VictoriaLogs** (`:9428`), Docker on the
  `json-file` driver. The app's `console.log` render-decision lines already ship
  to VictoriaLogs via Vector's `docker_logs` source (verified: ~2k lines/30 min).
- A **second** Vector stream tails NPM's `bom-telemetry.log`, which carries a
  `client_class` field (from the `X-BOM-Client-Class` response header the
  middleware sets) and is enriched with a `crawler_family` taxonomy
  (google/bing/meta/openai/seo-tool/other-crawler/browser/unknown).
- Crawler classification therefore lives in **three** places today: middleware
  regex, Vector VRL, and (via header) NPM telemetry.

## Goals / non-goals

**Goals**
- One classifier module owns the browser-vs-crawler decision in code.
- Adopt `isbot` as the crawler oracle (maintained list) + a small Korean-crawler
  supplement; retire the hand-rolled `KNOWN_CRAWLER_RE`.
- Emit richer structured fields; track **both** misroute directions with tripwires.
- Ship a documented LogsQL query set so misroutes can be measured/tuned on demand.

**Non-goals (explicit)**
- No NPM `log_format` change (that is the deferred "1a" consolidation).
- No dashboards or alerting (observability = rich logs + documented queries).
- No device detection beyond a boolean `isMobile`.
- No changes to `php` or any other prod container.

## Architecture — single source of truth

Create `frontend/next/lib/classify.ts` exporting a pure `classify(request) →
Decision`. It becomes the single place the app decides browser vs crawler.
`middleware.ts` shrinks to: call `classify()`, then route (CRA / SSR / asset /
redirect) and log. `isInteractiveBrowserNavigation`, `classifyClient`,
`KNOWN_CRAWLER_RE`, and `BROWSER_UA_RE` collapse into this module.

`Decision` shape (drives routing, headers, and logging):
```
{ renderMode, clientClass, crawlerFamily, isMobile, isNav, signal, suspect, leak }
```

Three consumers, one truth:
1. **Routing** — middleware reads `renderMode`.
2. **Response headers** — `X-BOM-Client-Class` (unchanged) + new
   `X-BOM-Crawler-Family`, so the app log and NPM access log agree.
3. **`render-decision` log** — the full `Decision` plus the request-header
   fingerprint.

**Vector deference — decision 1b (chosen).** The app is canonical for routing and
for the render-decision log. Vector keeps its own `crawler_family` regex for the
**access** stream only (that stream has client IP/status/timing the app log
lacks — a genuinely separate lens). We document that `classify.ts` is the
canonical taxonomy and Vector's regex mirrors it. No NPM config change. The
fuller "1a" (app emits `X-BOM-Crawler-Family` → NPM log_format → Vector reads the
field) is deferred; graduate to it only if the duplication bites.

## The classifier (`classify.ts`)

**Inputs:** `method`, `ua`, headers (`sec-fetch-mode/dest`, `sec-ch-ua`,
`sec-ch-ua-mobile`, `accept`). Pure, no I/O.

**Dependency:** `isbot` (v5, ESM, pure-regex, edge-compatible) as the crawler
oracle. Keep a tiny `KR_CRAWLER_RE` supplement (`yeti|naver|daum|kakao`) — isbot's
list does not reliably cover the Korean preview/crawler agents. Verify against
isbot before shipping (see isbot verification gate).

**Decision logic (order matters):**
1. `isNav = method === 'GET' || method === 'HEAD'`.
2. `clientClass`:
   - `isbot(ua) || KR_CRAWLER_RE.test(ua)` → `known-crawler`
   - else `BROWSER_UA_RE.test(ua)` → `browser`
   - else → `unknown`
3. `renderMode` (routing): `browser && isNav` → `cra`; everything else → `ssr`.
   Asset/SEO/redirect overrides remain in middleware, not in `classify`.
4. **Bias for `unknown`:** `unknown` → SSR. By definition it has no browser UA, so
   it is rarely a real human; SSR is the SEO-safe default and we make it
   *observable* rather than guess.

**Enrichment fields (observability, not routing):**
- `crawlerFamily`: `known-crawler` UA → one of the canonical family values
  **`google|bing|meta|openai|seo-tool|other-crawler`** (exact strings mirror
  Vector's `crawler_family` so query #4 is comparable across both streams; Vector's
  niche `screpy` folds into `seo-tool`); `browser`→`browser`; `unknown`→`unknown`.
- `isMobile`: `sec-ch-ua-mobile: ?1` OR UA matches `iPhone|iPad|Android|Mobile`.
- `signal`: why we decided — `isbot | kr-supplement | browser-ua | no-browser-ua |
  non-nav`. The key tuning field.

**Two tripwires (both misroute directions):**
- `suspect` (human→SSR): `isNav && renderMode==='ssr' && BROWSER_UA_RE.test(ua) &&
  !isbot(ua)`. Excludes non-nav — fixes the observed Chrome-`POST` false positive.
- `leak` (bot→CRA): `renderMode==='cra' && isbot(ua)`. ~Zero by construction; any
  hit is a logic bug worth catching.

**`Sec-Fetch` / `Sec-CH-UA`:** no longer decisive (that was the original bug) but
still **logged** as corroborating signals, so data can show whether they are safe
to reintroduce as a future tiebreaker.

## Observability

**Enhanced `render-decision` log** — one JSON line per navigation, now carrying
the full `Decision`:
```json
{"tag":"render-decision","render":"ssr","class":"known-crawler","crawlerFamily":"google",
 "isMobile":false,"isNav":true,"signal":"isbot","suspect":false,"leak":false,
 "host":"…","path":"…","method":"GET","ua":"…",
 "secFetchMode":null,"secChUa":null,"secChUaMobile":null}
```
Headers-only (no IP/PII); assets/redirects skipped; `BOM_LOG_RENDER_DECISION=0`
disables.

**Querying — decision 3a (chosen): query-time `unpack_json`.** No Vector change.
The render-decision fields sit inside `_msg`; documented queries unpack inline.
(3b, a Vector ingest transform for first-class fields, is rejected as
unnecessary infra churn for a marginal ergonomics gain.)

**Documented query set** → `docs/reference/render-decision-logsql.md`, each a
copy-paste LogsQL line filtered to the app container
(`_stream:{container_name=~"bookofmormon-online.*"} render-decision | unpack_json
from _msg | …`):
1. Human→SSR misroutes: `filter suspect:true`, group by `ua`.
2. Bot→CRA leaks: `filter leak:true`.
3. Render distribution: `stats by (render) count()`.
4. Crawler family breakdown: `stats by (crawlerFamily) count()`.
5. Mobile served CRA (reported symptom, now healthy): `filter isMobile:true
   render:cra | stats count()`.
6. Unknown-UA review (any `unknown→ssr` actually browsers?): `filter class:unknown
   | stats by (ua) count()` top-N.
7. Decisive-signal mix: `stats by (signal) count()`.

**Volume/retention:** unchanged — same line count as today, richer fields;
VictoriaLogs already ingests it.

## Testing

**Unit — `test/unit/classify.test.ts` (new), table-driven over real UA fixtures:**
- Browsers → `browser`/`cra`: Chrome, Firefox desktop, Safari desktop, iOS Safari,
  Firefox-iOS, Chrome-Android, Edge — with and without `Sec-Fetch`/`Sec-CH-UA`.
- Crawlers → `known-crawler`/`ssr`: Googlebot, Bingbot, facebookexternalhit,
  GPTBot, AhrefsBot, Yeti/Daumoa/kakaotalk-scrap (KR supplement), and a
  browser-UA-spoofing scraper isbot knows.
- `unknown` → `ssr`: curl, python-requests, `Mozilla/5.0 (compatible; Foo/1.0)`.
- Tripwires: browser `POST` → `suspect:false`; `leak` false everywhere.
- `crawlerFamily` + `isMobile` spot-checks.

**Integration — extend `test/routes/seo-gating.test.ts`** (reads
`X-BOM-Render-Mode`/`X-BOM-Client-Class`): keep the 5 browser cases already added;
add an `X-BOM-Crawler-Family` header assertion and one spoofing-scraper→SSR case.

**isbot verification gate** — a one-off documented check running the KR agents and
crawler fixtures through isbot to confirm coverage, so `KR_CRAWLER_RE` is exactly
what is needed — no more, no less.

## Rollout
1. Land on `dev`; full `next` test suite green + typecheck.
2. Live-probe dev `:8200` with the UA matrix (Safari/iOS/crawler) → header check.
3. Commit `dev` → fast-forward `prod` → CI blue-green deploy.
4. Post-deploy: run LogsQL #1/#2/#5 against VictoriaLogs to confirm `suspect`/`leak`
   ≈ 0 and mobile→CRA healthy on real traffic.

## Risks
- **isbot misses a crawler that spoofs a full browser UA** → served CRA shell (SEO
  cost). Mitigated: isbot is a better oracle than the flat regex; the `leak`/query
  #6 make residual cases visible.
- **isbot flags a real browser as a bot** (rare) → served SSR. Mitigated: query #1
  (`suspect`) would surface it; unit fixtures guard the common browsers.
- **KR supplement drift** — isbot may add the Korean agents later, making the
  supplement redundant. Mitigated: the verification gate is re-runnable; harmless
  if redundant.
- **Edge-runtime import** — confirm isbot bundles cleanly in the middleware edge
  build (typecheck + dev boot).

## Related
- Prior fix: commit `dca2bdc5` (UA-based gate + render-decision logging) — the
  starting point this redesign hardens.
- Documented query set to be written at `docs/reference/render-decision-logsql.md`.
