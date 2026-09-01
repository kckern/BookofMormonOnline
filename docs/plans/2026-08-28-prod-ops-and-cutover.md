# Prod EC2 Ops + Cutover — Course Forward

**Date:** 2026-08-28
**Scope:** Production EC2 Docker host (the cutover destination). Consolidates the audit, Redis removal, NPM upgrade, cleanup, centralized logging, and the Next/Clicky front-door decision.

> **Secrets note:** this file is in a public repo. Concrete IPs, hostnames, AWS account/instance IDs, and the admin source IP are intentionally **redacted** here — they live in Infisical (`ba310d37…/prod`: `HOST`, `SSH`, `AWS_*`).

---

## 1. Current state (evidence)

**Host:** AWS `t3a.medium` (2 vCPU / 3.8 GB RAM), Ubuntu, Docker 29.1.3, region `us-west-2`. Disk 34 GB @ 49%. **No swap.** Load low.

**Front door:** Internet → **ALB `Gateway-LoadBalancer`** (internet-facing) → TLS terminated on :443 (one ACM cert covering `bookofmormon.online` + wildcard + all language domains: `buchmormon.de`, `livredemormon.fr`, Korean `xn--289a67xla.kr`, Vietnamese `sachmacmon.vn`) → forwards to the instance's **private IP :80 = NPM (`proxy`)** → NPM routes to app/php over the Docker network. :80 listener redirects to :443.

- **ALB health check is failing (masked):** checks `HTTP GET / :80` expecting `200`, NPM returns `301` → `Target.ResponseCodeMismatch`. Single target ⇒ ALB **fails open** ⇒ site works but there is **no real health signal / no failover detection**.

**Security group:** `80,443 ← 0.0.0.0/0`; `22,3306,6379 ← <single admin IP>`; metrics ports not exposed. Container `0.0.0.0` bindings exist but SG is the real gate.

**Containers & provenance:**
| Container | Source | Notes |
|---|---|---|
| `proxy` (nginx-proxy-manager) | `BoMDocker/docker-compose.yml` svc `nginx-proxy-manager` | image pulled ~2y ago; volumes: `BoMDocker/config/proxy→/data`, `BoMDocker/config/letsencrypt→/etc/letsencrypt`, docker.sock |
| `php` (bomdocker-php) | `BoMDocker` svc `php` | **🚫 Scripture Guide — DO NOT TOUCH (prod dependency)** |
| `db` (mysql:8.0), `sphinx`, `portainer` | `BoMDocker` | shared compose project with proxy + php |
| `sendy`, `db_sendy` | `Beeloo/docker-compose.yml` | separate email stack; nightly backup cron 3:17 |
| `bookofmormon-online` (+ 3 `…-old-*`) | `docker run` via `/home/ubuntu/deploy-sg197/` | old→new rename deploy; 3 stale `Exited(137)` |
| `bomonline-redis` | standalone `docker run` (redis:alpine) | **idle** — 0 keys, no real clients; not in any compose/script |
| `bom-cadvisor`, `bom-prometheus`, `bom-node-exporter` | standalone `docker run` | monitoring; not exposed at SG |

**Redis usage:** code treats it as optional (`backend/src/config/redis.ts` → null when `REDIS_URL` unset ⇒ single-instance in-process fallback; `presence.ts` + `realtime/server.ts` both have no-Redis paths). Runtime idle. Only needed for multi-instance scaling (not in use).

**Logging:** all containers use `json-file`. Only `bookofmormon-online`/`php`/`sendy`/`db_sendy` are capped (`100m×3`); the rest are **uncapped**. No central aggregation.

**Front-door gap for Clicky:** there is **no Next container on prod**. The Clicky anti-adblock proxy (built in Next middleware, on `dev`, commit `605b3763`) cannot function here until either Next is deployed as the front door, or the two proxy paths are added at the NPM layer.

---

## 2. Constraints & guardrails

- 🚫 **Never touch `php`** (Scripture Guide). It shares the `BoMDocker` compose project with `proxy`/`db`/`sphinx`, so **any compose action must be per-service** (`docker compose up -d --no-deps <svc>`) — never `up -d` on the whole project (would recreate php/db/sphinx).
- Preserve NPM state: the two bind mounts (`/data`, `/etc/letsencrypt`) carry all proxy hosts, DB, and certs.
- Keep `REDIS_URL` unset in the app env so single-instance mode stays active after Redis removal.
- All changes on a live prod box: verify + have rollback before each.

---

## 3. Course forward (workstreams)

### A. Safe cleanup — ~5–6 GB (lowest risk)
- `docker image prune -f`, `docker builder prune -f`, remove 2 of 3 `…-old-*` app containers (keep the newest rollback).
- Rollback: none needed (removes only stale/dangling).

### B. Remove Redis
- Confirm app env has no active `REDIS_URL` (runtime already proves no connection).
- `docker stop bomonline-redis && docker rm bomonline-redis`. No compose/script recreates it. Closes the `6379` binding.
- Rollback: `docker run` redis:alpine again (trivial; state was empty).

### C. Upgrade NPM (`proxy`) to latest
- Pin a current `jc21/nginx-proxy-manager` version in `BoMDocker/docker-compose.yml` (prefer explicit tag over `:latest`).
- `docker compose pull nginx-proxy-manager && docker compose up -d --no-deps nginx-proxy-manager` (per-service — protects php/db/sphinx).
- Volumes preserved (bind mounts). Rollback: revert tag, `up -d --no-deps` again.

### D. Centralized logging — **VictoriaLogs, 7-day retention (primary goal)**
- New isolated stack (e.g. `/home/ubuntu/observability/docker-compose.yml`): **VictoriaLogs** (`-retentionPeriod=7d`) + a collector (**Vector** or **Fluent Bit**) that reads Docker logs via the socket/json-file and ships to VL.
- **Reads** container logs → **no restart of existing containers** ⇒ php-safe. Keep json-file in place (fine as a local buffer).
- Add small memory limits given the 3.8 GB box (VL + collector are light).
- Rollback: stop/remove the observability stack; nothing else affected.

### E. Hardening follow-ups (defense-in-depth)
- **ALB health-check matcher → `200-399`** (or a 200 path) so health reflects reality and fail-open stops masking outages. Low risk, no downtime.
- Optionally rebind `db`/metrics to `127.0.0.1` (SG already restricts, so P2).
- Add a **swapfile (2–4 GB)** — no swap today; `Exited(137)` shows OOM pressure.

### F. Clicky anti-adblock on prod — **REQUIRED for today's cutover (NPM recipe)**
Anti-adblock is a **production** feature that must be live when the frontend cutover ships today. Prod is ALB→NPM (no Next), so implement via NPM's nginx reverse-proxy (Clicky's recipe):
- Add two custom `location`s to the `bookofmormon.online` proxy host in NPM (paths from env, redacted here as `<CLICKY_JS_PATH>` / `<CLICKY_BEACON_PATH>`):
  - `location = <CLICKY_JS_PATH>` → `proxy_pass https://static.getclicky.com/js?in=<url-enc beacon path>;` `proxy_set_header Host static.getclicky.com;`
  - `location = <CLICKY_BEACON_PATH>` → `proxy_pass https://in.getclicky.com/in.php;` `proxy_set_header Host in.getclicky.com;` forward `X-Forwarded-For`; `proxy_no_cache`/no-store.
  - `resolver 1.1.1.1;` per recipe.
- **Prod frontend build env:** `REACT_APP_CLICKY_SITE_ID=66488278`, `REACT_APP_CLICKY_JS_PATH=<CLICKY_JS_PATH>` (the obfuscated path — a secret, from the prod secret source, never committed).
- **Verify:** `GET https://bookofmormon.online/<CLICKY_JS_PATH>` → JS; beacon → 200; confirm any CDN/Cloudflare in front of the ALB does **not** cache the beacon path.

---

## 4. Recommended sequence
1. **A** (cleanup) — immediate, safe.
2. **B** (Redis removal) — quick win, closes a port.
3. **C** (NPM upgrade) — careful, per-service.
4. **D** (VictoriaLogs + 7d) — the main goal; design → deploy → verify.
5. **E** (ALB health check + swap) — small hardening.
6. **F** (Clicky front door) — separate track; needs the front-door decision + prod Clicky env.

## 5. Decisions (resolved 2026-08-28)
- **D:** Collector = **Vector** (native Docker source + VictoriaLogs sink).
- **C:** NPM = **pin a specific version** (no `:latest` drift).
- **E:** Swapfile = **now** (2 GB).
- **F:** **Anti-adblock IS a prod feature** — ship via **NPM nginx recipe** with today's cutover (two proxy locations + prod build env pointing at the obfuscated path). NOT the CDN fallback.

---

## 6. Cutover COMPLETE — verification (2026-09-01)

Prod is live on the greenfield single image. All cutover tasks (T1–T11) done and verified.

**T3 — image built & smoke-tested:** CI builds `kckern/bookofmormon-online:prod`, runs healthy under pm2 (backend :5005, next :8200, cra :8201). Gateway health `{"ok":true}`.

**T4 — CI/CD:** `.github/workflows/deploy-prod.yml` = `build-push` (GH hosted runner → Docker Hub) + `deploy` (self-hosted runner on EC2 `[self-hosted, prod]` → `deploy-blue-green.sh`). Self-hosted avoids inbound SSH (SG blocks :22). Full pipeline proven green (run 33571751206: build 3m46s, deploy 56s, clean blue-green swap). Secrets: DOCKERHUB_TOKEN, CLICKY_JS_PATH, CLICKY_BEACON_PATH.

**T5 — env:** all required vars present in `/home/ubuntu/greenfield/.env` (NODE_ENV, PORT, MYSQL_*, SANDBOX=0, APP_BASE_URL, CLICKY_*, S3_BUCKET, AWS_REGION).

**T6 — DB schema (bom_prd):** `bom_password_reset` ✓ (created_at,expires,token,user), `bom_notification` ✓, `messenger_%` = 10 tables ✓, `uniq_owner_active` index on `bom_readingplan` ✓.

**T7 — deploy mechanism:** `/home/ubuntu/greenfield/docker-compose.yml` (nginx gateway) + `deploy-blue-green.sh` (blue↔green slots, health-gated swap, old slot retained for rollback). Gateway container `bookofmormon-online` proxies to active slot; Watchtower-excluded via label.

**T8 — NPM flip (host 8):** `server_name` covers `bookofmormon.online` + wildcard + all language domains; `location ~ ^/(graphql|api|messenger)` → `backend:5005` (WS-capable); `location /` → `:8200`. Rollback recorded at `proxy_host/8.conf.bak`.

**T9 — real-path smoke through Cloudflare (all pass):**
- Human (Sec-Fetch browser) → `x-bom-render-mode: cra`, 200
- Bot (Googlebot) → `x-bom-render-mode: ssr`, 200
- `POST /graphql` → 200 `{"data":{"__typename":"Query"}}`
- Clicky JS proxy → 200
- `robots.txt` / `sitemap.xml` → 200
- Socket.io on `/messenger` (NOT `/socket.io`) → 200, Engine.IO open packet with `upgrades:["websocket"]`
- **php guardrail:** `scriptureguide.org` → 307→www→200 (untouched)

**T10/T11 — decommission:** 4 old stopped containers + ~6.9 GB dangling images pruned. Blue slot retained for rollback. dev/prod branches synced.
