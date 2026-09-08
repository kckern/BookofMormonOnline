# NPM 5xx burst alarm — SSR 500s from backend PM2 memory-recycle

**Date:** 2026-09-08
**Trigger:** CloudWatch alarm `bom-production-npm-5xx-burst` (≥5 NPM 5xx in 5 min) fired at
04:30:43 UTC on instance `i-02c9619a48343a8d9` (prod EC2 `ip-10-0-1-12`), reporting 16 5xx in
the 04:25 UTC bucket.
**Severity:** Low — no outage, self-healing, bot/scanner-facing only. Real (browser) users unaffected.

## Symptom
16 HTTP 500s in a ~7-second window (04:26:28–04:26:35 UTC), all `render_mode=ssr`,
`client_class=known-crawler` (meta/Facebook external agent), across every language host
(swe/fr/kr/vn/de/en), almost all on `/commentary/<id>` routes. Fast failures (~40–60 ms).

Source of truth: NPM telemetry log `proxy:/data/logs/bom-telemetry.log` (per-request JSON:
`status`, `upstream_status`, `render_mode`, `client_class`, `host`, `uri`).

## Root cause
Backend and Next SSR run in the **same container** (`bookofmormon-online-green`, single greenfield
image) under PM2. At 04:26:27 PM2 recycled the backend:

```
PM2 log: [WORKER] Process 0 restarted because it exceeds --max-memory-restart value
         (current_memory=534880256 max_memory_limit=524288000)
```

For the ~1–2 s the backend (GraphQL on `localhost:5005`) was down, Next Server Components
`fetch()` calls got `ECONNREFUSED`:

```
⨯ [TypeError: fetch failed] { digest: '3227098399', [cause]: [AggregateError] { code: 'ECONNREFUSED' } }
⨯ [Error: An error occurred in the Server Components render...] { digest: '3300647825' }
```

→ SSR render throws → HTTP 500. Only SSR (crawler) traffic hits it because SSR fetches from the
backend at render time; browser traffic renders via CRA (client-side) and fetches after the backend
is back. `max_memory_restart` for `backend` is **500 MB**; the process briefly spiked to 534 MB.
Backend is otherwise healthy (currently 304 MB, 1 restart in 16 h; box has ~1.4 GB available).

## Not the cause (ruled out)
- **Disk pressure** (a known prod failure mode): root fs was 65% / 12 GB free. Not this.
- **Sustained outage**: single 2 s blip; site returns 200 before and after.
- **Upstream/NPM fault**: `upstream_status=500` — the app returned 500, NPM faithfully relayed it.

## Second, independent 5xx source (also crosses the alarm threshold)
07:56:54 UTC — 10 5xx in one second, all from a **vulnerability scanner** hitting non-existent
`api-*.bookofmormon.online` vhosts (`api-prod`, `api-qa-*`, `api-sandbox-*`, `api-preview-*`)
probing `/.env`, `/.env.backup`, `/.env.prod`, `/actuator/configprops`,
`/storage/logs/laravel.log`, `/crusader-404-probe`. These returned **500** (no render_mode /
client_class — hit a fallback vhost that errored) instead of 404/444. **No secret leaked** (the
`.env` probes 500'd, they did not serve a file). This is internet background noise but it trips the
same alarm. Scattered sub-threshold singles (03:44, 04:12, 14:53) were SSR `/` 500s on non-EN hosts.

## Fixes implemented (branch `fix/npm-5xx-hardening`, 2026-09-08)
1. **SSR resilience — DONE.** `frontend/next/lib/graphql.ts`: `gql()` now retries transient
   connection failures (ECONNREFUSED/reset/timeout) with backoff `[200,600,1500]ms` (~2.3s, spans a
   restart) plus an 8s per-attempt `AbortSignal.timeout`. Only network-level errors retry — an HTTP
   5xx or GraphQL business error still surfaces immediately. Unit-tested in
   `test/unit/graphql-retry.test.ts` (`isRetryableFetchError`, `withRetry`). Highest-value fix:
   removes crawler-facing 500s regardless of why the backend blips.
2. **Backend memory ceiling — DONE.** `ecosystem.config.cjs`: backend `max_memory_restart`
   500M → 768M (matches `next`, which already carries a comment about the same recycle→5xx pattern).
   Reduces how often the recycle in fix #1 is exercised. (Leak-vs-working-set investigation still
   open, but with #1 the recycle is no longer user/crawler-visible.)
3. **Scanner probes — reframed + partially DONE.** Investigation showed the app *already* handles the
   original concern: unknown hosts 301 and `/.env` on the canonical host 404s. The 07:56 cluster was
   nginx connection-pressure under a scanner burst (`fallback_error.log`: "512 worker_connections are
   not enough"). Implemented in-repo: `frontend/next/middleware.ts` now short-circuits obvious
   secret/scanner probes (`/.env*`, `/.git`, `/actuator`, `/storage/logs`; `/.well-known` preserved)
   to a cheap 404 before any host-redirect or SSR — cutting the SSR churn those bursts cause. Tested
   in `test/routes/scanner-paths.test.ts`. **Still open (out of this repo):** raise nginx
   `worker_connections`/`worker_rlimit_nofile` in the NPM/BoMDocker layer (default 512 is low for
   this crawler volume).
4. **Alarm tuning — SCRIPTED, needs apply.** `ops/aws/cloudwatch-npm-5xx-alarm.sh` recreates the
   alarm with `evaluation-periods 2` + `datapoints-to-alarm 2` (two consecutive breaching 5-min
   buckets). **Cannot be applied from the box** — the instance role is `PutMetricData`-only; run it
   with CloudWatch-admin creds. This is the lever that neutralizes single-bucket blips of BOTH the
   #1 and #3 kind without hiding a sustained outage.

## Deployment status
Fixes #1–#3 are code/config on branch `fix/npm-5xx-hardening` (283 next tests green) — they reach
prod only via the normal path (merge → push `prod` → CI build → `deploy-blue-green.sh`), which is a
production deploy left to KC. Fix #4 is an out-of-band `aws` call needing admin creds. Nothing has
been deployed or applied to prod by this investigation.

## Access notes
Diagnosed via Infisical prod project `ba310d37-…/prod` → `HOST` + `SSH` key (no AWS_* at path `/`).
Read-only: `docker logs`, `docker exec proxy` log reads, `df`/`free`/`pm2 jlist`. No changes made.
