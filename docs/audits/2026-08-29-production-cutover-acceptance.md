# Production cutover acceptance — 2026-08-29

This document is the current acceptance record for the SSR cutover. It updates
the implementation-state sections of
[`2026-08-28-production-ssr-seo-readiness.md`](2026-08-28-production-ssr-seo-readiness.md).

## Deployed application state

- deployed `origin/prod`: `871ee14f5449fde70cc0cc03d556881987f59e55`
- current `origin/dev`: `f1187bffe6fbc19c48b55ccedf8f9174269d4ee9`
- GitHub Actions production run: `33233537694`, successful
- production image: `kckern/bookofmormon-online:prod`
- application container: healthy after deployment
- browser navigation: CRA, HTTP 200 with a non-empty document
- known and unknown crawlers: Next SSR by default
- Docker healthcheck: backend, Next, and CRA are all required
- Next startup: held behind backend readiness
- security headers: HSTS, CSP, content-type protection, frame protection, and
  referrer policy are live
- confirmed unknown one-segment routes: HTTP 404
- GraphQL heading resolution: a missing quoting parent no longer throws
- duplicate `bom_log` beacons: idempotent `INSERT IGNORE`
- SSR loaders: upstream failures propagate instead of becoming empty pages or
  false 404s

`dev` additionally contains the timeline correction, full-crawl tooling,
atomic blue/green migration, production monitoring artifacts, and the Clicky
referrer repair. Those changes are tested but are not represented in the
currently deployed production image.

## Full production sitemap crawl

The controlled regression crawler ran against the live sitemap with a bot user
agent and concurrency 4. Raw results are retained locally at
`/tmp/bom-production-seo-audit.json`; the repeatable crawler is
[`scripts/audit-production-sitemap.mjs`](../../scripts/audit-production-sitemap.mjs).

| Check | Result |
|---|---:|
| Sitemap URLs requested | 2,592 |
| HTTP 200 HTML | 2,592 |
| 4xx / 5xx | 0 / 0 |
| Missing or invalid canonical | 0 |
| Canonical mismatch | 0 |
| Unexpected noindex | 0 |
| Missing expected hreflang | 0 |
| Invalid JSON-LD | 0 |
| Fetch errors | 0 |
| p50 / p95 / p99 | 213 / 553 / 781 ms |
| Maximum response time | 1,223 ms |

Six otherwise complete SSR documents were served from Cloudflare cache entries
created before `X-BOM-Render-Mode` was introduced. Cache-busted requests proved
that current origin responses carry `x-bom-render-mode: ssr`. The diagnostic
header is not an SEO requirement; title, canonical, H1, and body content were
present in all six cached documents.

The crawl found one real data-shape class affecting six timeline URLs. Five are
coordinate-only database markers with no page content. `land-of-nephi` has both
an empty marker row and a real event row, but the old selector chose the empty
row. The pending patch now:

1. selects only timeline rows with content;
2. uses the real `land-of-nephi` event;
3. returns 404 for marker-only pseudo-pages; and
4. excludes marker-only slugs from the sitemap.

Focused Playwright coverage passes all five timeline cases. A fresh Screpy scan
should start only after this patch is deployed, so the paid crawl becomes a clean
post-cutover baseline rather than recording defects already corrected in source.

## Runtime and deployment acceptance

The application health gate works after a container starts: from the first
healthy Docker probe onward, 2,552 sampled requests produced zero 5xx responses.
However, telemetry proved that Watchtower still creates a stop-first outage for
the single container. The complete telemetry window for the most recent
replacement contains 140 HTTP 502 responses, all between
`2026-08-29T04:24:52Z` and `04:25:17Z`. There have been no subsequent 502s.

A blue/green deployment implementation is staged and tested in
[`ops/production`](../../ops/production/README.md). It keeps a stable Nginx
gateway, starts only the inactive application slot, waits for Docker health,
gracefully switches upstreams, verifies ports 8200 and 5005, drains the old slot,
and retains it stopped for one-deployment rollback. A systemd timer replaces
Watchtower only for this application image. Watchtower can continue managing
unrelated labeled containers.

The one-time migration uses the exact existing Docker name
`bookofmormon-online` for the stable gateway. It starts and verifies the blue
slot before renaming the current container to the green rollback slot. NPM's
existing workers retain the old container IP during that handoff; NPM reloads
only after the gateway and both upstreams pass health checks. A pre-commit trap
restores the original name and reloads NPM on any failure. This avoids the DNS
alias collision found in the first draft.

Installing this control plane on production is pending explicit approval because
it creates persistent systemd units. Until installed, the remaining deployment
502 window is known and reproducible.

## Ingress and TLS acceptance

The ALB and EC2 instance currently share security group `sg-08fecaa54d23d309d`.
That group allows public IPv4 access to ports 80 and 443, so it cannot express the
required trust boundaries. The safe final topology is:

1. a dedicated ALB group allowing 80/443 only from current Cloudflare networks;
2. a dedicated EC2 origin group allowing port 80 only from the ALB group;
3. explicitly preserved admin access for SSH, MySQL, and Redis from the existing
   administrator `/32`; and
4. no other direct origin ingress.

This change must wait for the Korean domain delegation. Every observed
`direct_alb` request after the cutover used host `xn--289a67xla.kr`; its registry
delegation still points to Route 53, so those were legitimate GPTBot, ClaudeBot,
Meta, Baidu, and Semrush requests rather than bypasses. Enforcing Cloudflare-only
ingress before delegation would take the Korean site offline.

The ALB remains appropriate because it terminates the ACM certificates. The
HTTPS listener has issued certificates covering every current production host,
including `xn--289a67xla.kr`. That provides the certificate basis for Cloudflare
Full (strict) after activation.

Current Korean state:

- Cloudflare zone: `pending`
- required nameservers: `nero.ns.cloudflare.com`, `phoenix.ns.cloudflare.com`
- public delegation: still the four Route 53 nameservers
- GoDaddy API update: accepted with HTTP 204 at `2026-08-29T05:12:33Z`, but
  GoDaddy's subsequent read API and the `.kr` parent still showed Route 53; the
  registrar/registry update is asynchronous and not yet complete
- DNSSEC: must follow Cloudflare activation
- Route 53 zone: retained as rollback until activation, strict TLS, and DNSSEC
  have been verified

## Monitoring and alerting state

The repaired `bom-health-checker` Lambda now validates a real GraphQL response
through the public `/graphql` path every five minutes and publishes
`BOM/Production APIHealthy`. Three consecutive failures transition
`bom-production-api-unhealthy` to `ALARM`; that transition invokes the existing
reboot Lambda directly through EventBridge. The disabled, unauthenticated API
Gateway endpoint is no longer in the recovery path.

The host metrics timer is installed, enabled, and publishing every five minutes.
Observed samples at 05:00Z and 05:05Z reported Next at approximately 75 MiB,
zero PM2 restart deltas, zero current-window 5xx, healthy Vector ingestion, and
zero non-Cloudflare ingress after the temporary Korean-host exception. Eleven
CloudWatch alarms cover API health, ALB health/5xx, Next memory, PM2 restarts,
NPM 5xx, Vector health, non-Cloudflare ingress, root disk, and telemetry size and
growth. Their SNS topic exists, but the email subscription for `kc@kckern.com`
remains `PendingConfirmation`; alarm delivery is not accepted until that email
link is confirmed.

## Remaining acceptance gates

1. Approve and install the persistent blue/green deployment control, perform
   the health-gated initial gateway cutover, and disable Watchtower management
   of the application slots.
2. Promote `dev` to `prod`, including the timeline and Clicky referrer fixes,
   without a stop-first outage.
3. Verify a real externally referred browser visit is classified by Clicky as
   search/link rather than direct; then rerun the full sitemap regression.
4. Start and monitor the fresh Screpy crawl (project limit is 5,000 pages).
5. Confirm a sustained memory plateau, zero PM2 restarts, and zero steady-state
   502s over several hours of crawler traffic. The current container is healthy,
   Next is approximately 75 MiB, and all restart counts are zero, but the newest
   runtime sample is not yet several hours old.
6. Wait for the accepted Korean nameserver change to reach the `.kr` registry;
   then verify Cloudflare activation, enable Full (strict), enable DNSSEC, and
   add the DS record at GoDaddy.
7. Split the ALB and EC2 security groups and enforce Cloudflare-only ingress
   after the Korean hostname is confirmed through Cloudflare.
8. Confirm the AWS SNS subscription email so existing alarms can deliver.
9. Retire the Korean Route 53 zone only after the agreed rollback window.
10. Review VictoriaLogs and raw telemetry growth after a full 24-hour sample;
   seven-day retention remains in place while bot policy data is collected.
