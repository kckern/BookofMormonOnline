# Production SSR and SEO readiness audit

**Audit date:** 2026-08-28 (post-cutover; production verification continued into
2026-08-29 UTC)  
**Production commit:** `8d1ca223`  
**Domain:** `https://bookofmormon.online` and language domains/subdomains  
**Verdict:** **Ready for organic crawler traffic, with high-priority hardening still
required before deliberately starting a 2,592-page crawl.**

This is the post-deployment source of truth. It supersedes the pre-cutover findings in
[`2026-08-27-ssr-cutover-seo-gaps.md`](2026-08-27-ssr-cutover-seo-gaps.md), several of
which were fixed during the cutover (host-aware canonicals, hreflang, JSON-LD, feature
SEO intent, and History noindex behavior).

## Executive summary

The live site now gives complete SSR HTML to Googlebot, ScrepyBot, social clients, and
**unrecognized non-browser clients by default**. Crawler access no longer depends on a
bot-name allowlist. A client only gets the CRA application shell when it positively
looks like an interactive browser navigation.

The largest live reliability failure was also fixed. Next and Fastify run in the same
container, so every server-side GraphQL fetch arrived from `127.0.0.1`. Fastify's global
300-request/minute limiter grouped all SSR traffic into that one bucket. Before the fix,
the last 10,000 backend log lines contained 2,316 rate-limit events, and an earlier
five-minute window contained 6,884 HTTP 429 responses. Valid SSR pages intermittently
returned 500 or false 404 responses.

Commit `8d1ca223` exempted only the trusted loopback SSR hop from the public limiter,
kept the public limit in place, changed unknown clients to SSR-by-default, and stopped
the People and Place data loaders from converting upstream errors into false 404s.
After deployment, 3,461 backend log lines accumulated under real traffic with **zero
429s**, representative routes all returned 200, and all PM2 restart counters remained
zero.

The site is therefore open and functional for organic indexing now. A forced whole-site
crawl should wait for the short acceptance gate near the end of this report, primarily
because arbitrary one-segment URLs still return indexable soft-404 pages and several
other data loaders still hide backend failures.

## Request and deployment architecture

```text
Crawler / browser
    |
    v
Cloudflare
    |
    v
AWS load-balancing / TLS layer
    |
    v
Nginx Proxy Manager (proxy-host 8)
    |-- /graphql, /api, /messenger --> Fastify + GraphQL Yoga :5005
    `-- everything else -----------> Next.js front door :8200
                                         |
                                         |-- confirmed browser navigation --> CRA :8201
                                         `-- all other document clients ----> Next SSR
                                                               |
                                                               `--> GraphQL :5005 over loopback
                                                                        |
                                                                        `--> bom_prd
```

Production uses one image, `kckern/bookofmormon-online:prod`, with three PM2 processes:

| Process | Purpose | Port | PM2 memory restart |
|---|---|---:|---:|
| `backend` | Fastify, GraphQL Yoga, API, realtime | 5005 | 500 MiB |
| `next` | crawler-facing SSR and browser/analytics front door | 8200 | 400 MiB |
| `cra` | interactive legacy React application | 8201 | 128 MiB |

GitHub Actions builds and pushes the image after a push to `prod`. Watchtower polls the
moving tag every 300 seconds and replaces the labeled container. For this deployment:

- origin `dev` and `prod` both reached `8d1ca223`;
- GitHub Actions run `33222114752` succeeded in 3m30s;
- Watchtower found image `bb8444a9141f`, replaced the container, and reported
  `failed=0 updated=1`;
- replacement container `8fec984cf70a` started at `2026-08-29T00:04:54Z`.

## Crawler access policy: open by default

### Previous behavior

[`frontend/next/middleware.ts`](../../frontend/next/middleware.ts) used a regular
expression containing known crawler and social-service names. Matching clients received
SSR; every non-match received CRA. That was effectively an SSR allowlist even though it
was implemented as user-agent detection.

A live pre-fix comparison on `/lehites` demonstrated the gap:

| Client | Result before fix |
|---|---|
| Googlebot | SSR, about 15 KB |
| ScrepyBot | SSR, about 15 KB |
| `ResearchIndexer/1.0` | CRA shell, 3,159 bytes |
| blank user agent | CRA shell, 3,159 bytes |

An unknown search engine, feed reader, research indexer, link preview, or scraper could
therefore miss the semantic HTML unless it happened to use a recognized name or execute
JavaScript.

### Current behavior

The routing rule is now:

1. SEO assets (`robots.txt`, `sitemap.xml`, and OG endpoints) always use Next.
2. Known crawler/social identifiers always use SSR, including crawlers that may send
   browser-like headers.
3. A GET/HEAD request gets CRA only when it has a browser UA **and** positive browser
   signals (`Sec-Fetch-*` navigation metadata or `Sec-CH-UA`).
4. Everything else defaults to SSR.

This is presentation selection, not a security boundary. Headers are spoofable, but that
does not weaken access control because SSR is intentionally public. Abuse control must
be based on traffic behavior and trustworthy client IP at Cloudflare/Nginx, independent
of whether a UA is on a crawler list. Persistent abusive sources can then be blocked
surgically without denying new or small crawlers.

Cache-busted post-deployment results for `/lehites`:

| Client | HTTP | Bytes | SSR header | Canonical | H1 |
|---|---:|---:|---|---:|---:|
| Chrome navigation with browser headers | 200 | 3,159 | absent (CRA) | 0 in shell | 0 in shell |
| Googlebot | 200 | 81,726 | `en` | 1 | 1 |
| ScrepyBot | 200 | 81,726 | `en` | 1 | 1 |
| unrecognized `ResearchIndexer/1.0` | 200 | 82,386 | `en` | 1 | 1 |

The differing Google/Screpy and unknown sizes came from cache/render timing; all three
SSR responses contained the required semantic document.

## Production route verification

The following cache-busted requests used the unrecognized `ResearchIndexer/1.0` UA after
the deployment. This specifically verifies that a crawler does not need to be named in
the middleware.

| Route | HTTP | Bytes | Content type |
|---|---:|---:|---|
| `/` | 200 | 15,132 | HTML |
| `/read/1.nephi.1` | 200 | 27,076 | HTML |
| `/people/nephi1` | 200 | 30,501 | HTML |
| `/place/jerusalem-1` | 200 | 26,942 | HTML |
| `/map/neareast` | 200 | 11,837 | HTML |
| `/about` | 200 | 22,168 | HTML |
| `/lehites` | 200 | 82,386 | HTML |
| `/sitemap.xml` | 200 | 531,519 | XML |
| `/robots.txt` | 200 | 73 | text |

The live sitemap is well-formed and contains **2,592 unique URLs**. `robots.txt` allows
all user agents and advertises `https://bookofmormon.online/sitemap.xml`.

## SEO capability scorecard

| Area | State | Evidence / qualification |
|---|---|---|
| Unknown crawler access | **Pass** | SSR is the default for non-browser clients after `8d1ca223`. |
| Google/social crawler access | **Pass** | Googlebot, ScrepyBot, and known preview clients route to SSR. |
| Robots and sitemap | **Pass** | allow-all robots; valid 2,592-URL sitemap. |
| Titles and descriptions | **Pass with gaps** | centralized metadata; representative pages pass; some older routes retain weak/empty descriptions. |
| Canonicals | **Pass** | host-aware self-canonicals on representative SSR pages. |
| Hreflang | **Pass** | supported language hosts plus `x-default`; intentionally omitted where slugs/content are not equivalent. |
| Open Graph / Twitter | **Pass** | centralized 1200x630 OG endpoint and social metadata. |
| Structured data | **Pass with coverage gaps** | breadcrumb and content-specific JSON-LD on core entity/content routes. |
| Noindex/remove intent | **Pass** | History emits meta and `X-Robots-Tag: noindex, follow`; removed features are excluded. |
| Correct not-found behavior | **Fail** | arbitrary one-segment paths remain indexable 200 soft-404s. |
| Upstream failure semantics | **Partial** | People/Place corrected; several other loaders still collapse errors to null/empty. |
| SSR capacity under current traffic | **Pass observed** | thousands of post-deploy requests, zero 429s, zero PM2 restarts. |
| Startup readiness | **Fail** | Next accepts traffic before backend is listening; no Docker healthcheck. |
| Security headers | **Needs work** | HSTS/CSP/X-Content-Type-Options/frame protections were absent from sampled public HTML. |
| Production crawl regression test | **Fail** | tests cover routes locally but not a concurrent sitemap-wide production gate. |

## Findings and remediation

### P0 — Resolved: internal SSR traffic shared one public rate-limit bucket

**Cause.** [`backend/src/index.ts`](../../backend/src/index.ts) globally limited requests
to 300/minute using Fastify's peer IP. Next calls `http://localhost:5005/graphql`, so all
SSR calls appeared to come from the same loopback address.

**Impact before fix.** Search traffic across every path and language competed for one
bucket. Sitemap generation and page renders failed with `GraphQL fetch failed: 429`.
People and Place loaders converted those failures into 404s, creating a direct deindexing
risk.

**Resolution.** [`backend/src/http/rateLimit.ts`](../../backend/src/http/rateLimit.ts)
allows only IPv4, IPv6, and IPv4-mapped loopback peers to bypass the public limiter. The
backend port is not published; external requests still arrive through Nginx and remain
limited. Seven unit cases cover allowed and rejected peers.

**Live acceptance.** 3,461 backend lines, 0 `Rate limit exceeded`, 0 GraphQL 429 errors,
and 0 process restarts after deployment under ongoing crawler traffic.

### P0 — Resolved: crawler access required a recognized name

**Cause.** The middleware's negative branch sent every UA not matching `BOT_RE` to CRA.

**Resolution.** Unknown clients now default to SSR; only confirmed interactive browser
navigations get CRA. A Playwright regression proves an unrecognized indexer gets SSR.

**Policy.** Do not add crawler allowlists as a prerequisite to indexing. Use a generous
behavioral rate policy, verified real client IPs, and narrow deny rules for demonstrated
abuse. A Cloudflare allow rule for a specific audit vendor can be useful if another WAF
rule accidentally blocks it, but it must not be required for normal crawlability and
must never rely on UA alone.

### P1 — Arbitrary one-segment paths are indexable soft 404s

[`frontend/next/app/[...path]/page.tsx`](../../frontend/next/app/[...path]/page.tsx)
returns `DefaultShell` when a single-segment page lookup misses. The response is HTTP 200,
gets a self-canonical, and has generic crawlable content. For example, a made-up route can
look like a valid page to a search engine.

**Required change:** return `notFound()` for a confirmed data miss. Preserve explicit
known aliases in a route table rather than retaining blanket PHP parity.

**Acceptance:** a random single-segment path returns HTTP 404, has no self-canonical as a
valid document, and is absent from internal links and the sitemap.

### P1 — Several data loaders still turn outages into false content states

People and Place now distinguish a real empty result from an exception. Other libraries
still catch all GraphQL failures and return `null` or `[]`, including sections, page
content, maps, lists, timeline, commentary, art, and History. Depending on the caller,
this produces a false 404, a soft 404, or a thin 200 page.

**Required change:** only return null/empty for a successful GraphQL response with no
matching entity. Let transport, rate-limit, timeout, and GraphQL errors become 5xx. Add a
typed `NotFound`/upstream error distinction if a loader needs custom handling.

**Acceptance:** inject a backend 429/500 and assert every valid representative page
returns 5xx, never 404 or empty 200; a genuinely unknown entity still returns 404.

### P1 — Deployment has a startup race and no application healthcheck

The image starts backend, Next, and CRA concurrently under PM2. During the verified
Watchtower replacement, Next accepted SSR requests before Fastify opened port 5005. The
new container logged 35 lines of `fetch failed / ECONNREFUSED`; the error count then
stopped increasing. Docker reports no health state for the application container, and
Watchtower/Nginx therefore cannot gate traffic on application readiness.

**Required change:**

1. add a container healthcheck that verifies backend `/health`, Next, and CRA;
2. start or expose Next only after backend health passes, or make SSR GraphQL fetches use
   bounded retry/backoff during the startup window;
3. ensure the upstream load-balancer health check targets an aggregate readiness endpoint;
4. confirm Watchtower does not remove the old container until the replacement is ready,
   or use blue/green orchestration if Watchtower cannot provide that guarantee.

### P1 — Public API rate limiting still needs trustworthy client-IP verification

Fastify is not configured with `trustProxy`; its default rate-limit key is the socket peer.
Nginx sends `X-Real-IP` and `X-Forwarded-For`, and application context manually reads the
first forwarded value, but the limiter itself uses `request.ip`. Public clients can still
collapse into a proxy/load-balancer bucket.

**Required change:** document the exact Cloudflare → AWS → Nginx hop chain, configure a
bounded trusted-proxy function/hop count, and test the limiter key from two real clients.
Do not blindly trust arbitrary forwarded headers.

### P1 — SSR cache strategy increases origin load

Sample SSR responses used `Cache-Control: private, no-cache, no-store, max-age=0,
must-revalidate`. Cloudflare served one repeated bot response as a HIT while browser and
unknown-indexer probes were dynamic. The current policy works, but it is not an explicit,
easily reasoned cache contract and every uncached crawler render can query GraphQL.

**Required change:** define cacheability by route and language, include all representation
dimensions in the cache key, and use stale-if-error or persisted pre-rendering for stable
content. Confirm a browser CRA shell can never populate a cache entry later served to a
crawler, or vice versa.

### P2 — Security headers are incomplete

Sampled public HTML omitted HSTS, Content-Security-Policy, X-Content-Type-Options, and
frame protection. This is primarily security hardening rather than a ranking factor, but
it is part of production readiness and was also visible in the older Screpy audit.

**Required change:** define these at the outermost correct layer (normally Cloudflare or
Nginx), stage CSP in report-only mode, then enforce after checking CRA, Next, images,
Clicky, and API connections.

### P2 — Next and workflow maintenance

The runtime is Next 15.3.3 and identifies itself as outdated in development. The GitHub
workflow also emits a warning that several actions target deprecated Node 20 action
runtimes and are being forced onto Node 24. Neither blocked this deployment, but both
belong in maintenance before they become emergency work.

## Metadata and content implementation

[`frontend/next/lib/seo.ts`](../../frontend/next/lib/seo.ts) is the central metadata
builder. It currently provides:

- host-aware canonical URLs;
- supported-language hreflang alternates and `x-default`;
- normalized titles and truncated descriptions;
- Open Graph and Twitter cards;
- language-aware OG images;
- Korean Naver verification;
- safe host handling to prevent attacker-controlled canonical hosts.

Core content routes emit semantic H1/body/link markup and route-specific JSON-LD through
[`frontend/next/lib/jsonld.ts`](../../frontend/next/lib/jsonld.ts). The current test suite
covers representative metadata, hreflang, JSON-LD, OG images, sitemap composition,
feature noindex/remove rules, and core route status. Its main blind spots are concurrency,
production edge behavior, full-sitemap status validation, SSR/CRA content parity, and
injected upstream failures.

Dynamic rendering itself is not automatically a problem, but search engines must receive
content materially equivalent to what a user can reach in CRA. Add an automated parity
test comparing title, primary heading, canonical identity, body topic/entities, and
internal destinations for a representative matrix. Do not serve crawler-only claims or
links that humans cannot reach.

## Sitemap and Screpy readiness

The Screpy project previously had a 250-page project crawl setting even though the account
supports 5,000 crawler pages. The project setting has been raised to **5,000**, which is
enough for the current **2,592** sitemap URLs. The only stored audit is stale (created
August 10, completed August 12, 254 pages, health 74), so it does not validate this
cutover.

Do not reduce organic accessibility while waiting for the audit. Organic crawlers are
welcome now. Before manually forcing Screpy's full crawl, run this small gate:

1. wait at least 15 minutes after the most recent deployment;
2. confirm zero new backend 429s and zero PM2 restarts;
3. sample at least one URL from every sitemap route family with an unrecognized UA;
4. verify each sample's HTTP status, title, canonical, H1, description, and internal link;
5. verify a random invalid route is a true 404 after the soft-404 fix;
6. start Screpy with conservative concurrency, monitor CPU/memory/5xx/429 live, and stop
   the crawl if error rate rises above the agreed threshold.

The gate is about preventing a self-inflicted outage, not granting Screpy permission to
index. No crawler whitelist should be necessary.

## Current production resource snapshot

After the replacement stabilized under live traffic:

- application container: about 573 MiB / 3.754 GiB, about 54% CPU at sample time;
- Next: about 339 MiB, zero restarts;
- backend: about 254 MiB, zero restarts;
- CRA: about 88 MiB, zero restarts;
- host memory before deployment: 3,844 MiB total, 1,735 MiB available, 723 MiB swap used;
- root disk: 34 GiB total, 22 GiB used, 13 GiB available (63%);
- application container has Docker restart policy `always` but no Docker healthcheck.

Next's 400 MiB PM2 restart limit is close enough to observed usage that it should remain
under observation during a full crawl. Do not raise it reflexively: first profile cache
growth and verify host headroom, then set a deliberate process/container budget.

## Prioritized completion plan

### Immediate (next production patch)

1. Replace arbitrary single-segment soft 200s with true 404s.
2. Remove catch-all error swallowing from remaining identity/list loaders.
3. Add startup/readiness gating and a Docker healthcheck.
4. Configure and test trusted real-client IP handling for the public limiter.

### Before the forced 2,592-page crawl

1. Add a sitemap-driven status/head smoke test with bounded concurrency.
2. Run the 15-minute stability gate above.
3. Monitor 429, 5xx, PM2 restarts, Next memory, CPU, and response latency throughout.

### After crawl stability

1. Resolve Screpy's current critical/warning findings against fresh results.
2. Formalize edge caching and stale-on-error behavior.
3. Add security headers in staged form.
4. Upgrade Next and GitHub action runtimes.
5. Add ongoing synthetic tests for browser CRA, known bot SSR, unknown crawler SSR,
   sitemap validity, valid entity 200, invalid entity 404, and upstream outage 5xx.

## Final readiness statement

The production cutover is now **open to any crawler by default** and the shared internal
rate-limit failure has been removed. Googlebot and other real indexers can arrive now and
receive complete SSR HTML without waiting for a Screpy run or a whitelist change.

The remaining work is correctness and resilience, not crawler gatekeeping. Organic
indexing can proceed. Deliberately launching the full audit crawl should follow the short
gate above so a known soft-404 and startup/readiness debt do not turn an SEO validation
exercise into avoidable production load or misleading results.
