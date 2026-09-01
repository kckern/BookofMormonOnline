# Greenfield Single-Image Prod Cutover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. This is an **infrastructure** plan — "tests" are build/smoke verification commands with expected output, not unit tests.

**Goal:** Ship the greenfield stack (Fastify backend + Next front door + CRA) to prod as **one Docker image** run by pm2, fronted by the existing ALB→NPM, with Clicky anti-adblock, GitHub-Actions build, and Watchtower auto-deploy — without disturbing the `php`/Scripture-Guide container.

**Architecture:** One image `kckern/bookofmormon-online` runs 3 processes under **pm2**: `backend` (Fastify GraphQL+socket, `:5005`), `next` (front door, `:8200`), `cra` (static SPA via `serve`, `:8201`). **NPM host 8** routes `/graphql`,`/api`,`/messenger`(WS) → `:5005`, everything else → Next `:8200`; Next SSRs bots and proxies humans to CRA `:8201`. Env from Infisical via a box-side compose; `REACT_APP_*`/`CLICKY_*` baked at build via GH-Actions build-args.

**Tech Stack:** Docker multi-stage (node 24-alpine), pm2, `serve`, Fastify/graphql-yoga, Next 15, CRA (react-app-rewired), nginx-proxy-manager, Watchtower, VictoriaLogs (already live).

**Reference:** backend env + DB migrations + smoke suite are in `docs/plans/2026-08-05-prod-cutover-runbook.md` (do not duplicate — this plan links to it). Prod access/topology: `docs/reference/… (memory: prod-infra-access)`.

**Guardrail (every task):** never `docker compose up` the `BoMDocker` project (recreates `php`). The greenfield stack is its own compose project. After any NPM/traffic change: `curl https://api.scripture.guide/john.3.16` → HTTP 200.

---

## File structure

| Path | Responsibility |
|---|---|
| `Dockerfile` (repo root, **new**) | Multi-stage: build backend+CRA+Next; runtime image with pm2 + all 3 apps. |
| `.dockerignore` (repo root, **new**) | Exclude `node_modules`, `.next`, `build`, `dist`, `_deprecated`, docs, `.git`. |
| `ecosystem.config.cjs` (repo root, **new**) | pm2 app list: backend / next / cra. |
| `.github/workflows/deploy-prod.yml` (**modify**) | Point at `./Dockerfile`; add `REACT_APP_*`/`CLICKY_*` build-args from secrets. |
| `deploy/greenfield/docker-compose.yml` (**new, repo copy**) | Reference copy of the box-side compose (single service, labels, env, network). |
| Box: `/home/ubuntu/greenfield/docker-compose.yml` | Live compose (mirrors the repo copy; env from `env_file` sourced from Infisical). |
| Box: NPM host 8 advanced config | API routes → `:5005`, default → `:8200`. |
| Infisical `ba310d37/prod` | Greenfield runtime env (per 08-05) + `CLICKY_JS_PATH`/`CLICKY_BEACON_PATH` (present) + build-arg values mirrored to GitHub secrets. |

---

## Task 1: Root Dockerfile

**Files:** Create `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Write `.dockerignore`**
```
**/node_modules
**/.next
**/build
**/dist
_deprecated
docs
.git
*.log
```

- [ ] **Step 2: Write `Dockerfile`**
```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=24.15.0
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /src
COPY backend/package*.json backend/
RUN cd backend && npm ci
COPY frontend/webapp/package*.json frontend/webapp/
RUN cd frontend/webapp && npm ci
COPY frontend/next/package*.json frontend/next/
RUN cd frontend/next && npm ci
COPY . .
# browser/build-time config (baked into CRA + Next bundles)
ARG REACT_APP_CLICKY_SITE_ID
ARG REACT_APP_CLICKY_JS_PATH
ARG CLICKY_JS_PATH
ARG CLICKY_BEACON_PATH
ENV REACT_APP_CLICKY_SITE_ID=$REACT_APP_CLICKY_SITE_ID \
    REACT_APP_CLICKY_JS_PATH=$REACT_APP_CLICKY_JS_PATH \
    CLICKY_JS_PATH=$CLICKY_JS_PATH \
    CLICKY_BEACON_PATH=$CLICKY_BEACON_PATH
RUN cd backend && npm run build
RUN cd frontend/webapp && npm run build
RUN cd frontend/next && npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
RUN npm i -g pm2 serve
COPY --from=build /src/backend/dist ./backend/dist
COPY --from=build /src/backend/node_modules ./backend/node_modules
COPY --from=build /src/backend/package*.json ./backend/
COPY --from=build /src/frontend/next/.next ./frontend/next/.next
COPY --from=build /src/frontend/next/node_modules ./frontend/next/node_modules
COPY --from=build /src/frontend/next/package*.json ./frontend/next/
COPY --from=build /src/frontend/next/public ./frontend/next/public
COPY --from=build /src/frontend/next/config ./frontend/next/config
COPY --from=build /src/frontend/webapp/build ./frontend/webapp/build
COPY ecosystem.config.cjs ./
EXPOSE 8200 8201 5005
CMD ["pm2-runtime", "ecosystem.config.cjs"]
```

- [ ] **Step 3: Commit**
```bash
git add Dockerfile .dockerignore && git commit -m "build: greenfield single-image Dockerfile (backend+next+cra via pm2)"
```

## Task 2: pm2 ecosystem

**Files:** Create `ecosystem.config.cjs`

- [ ] **Step 1: Write it**
```js
// pm2 runs the 3 greenfield processes in one container. Real runtime env is
// injected by the container (compose env_file from Infisical); values here are
// only the fixed intra-container ports.
module.exports = {
  apps: [
    { name: 'backend', cwd: '/app/backend', script: 'dist/src/index.js',
      env: { PORT: '5005' }, max_memory_restart: '500M' },
    { name: 'next', cwd: '/app/frontend/next', script: '/app/frontend/next/node_modules/.bin/next',
      args: 'start --port 8200', max_memory_restart: '400M' },
    { name: 'cra', cwd: '/app', script: '/usr/local/bin/serve',
      args: '-s frontend/webapp/build -l 8201', max_memory_restart: '128M' },
  ],
};
```

- [ ] **Step 2: Commit**
```bash
git add ecosystem.config.cjs && git commit -m "build: pm2 ecosystem for the 3 greenfield processes"
```

## Task 3: Build & smoke-test the image (off-box, GH runner or local buildx)

**Verification (the "test"):** the image builds and all 3 processes answer inside the container.

- [ ] **Step 1: Build with the Clicky build-args** (values from Infisical `CLICKY_JS_PATH` etc.; never echo them)
```bash
docker buildx build --load \
  --build-arg REACT_APP_CLICKY_SITE_ID=66488278 \
  --build-arg REACT_APP_CLICKY_JS_PATH="$CLICKY_JS_PATH" \
  --build-arg CLICKY_JS_PATH="$CLICKY_JS_PATH" \
  --build-arg CLICKY_BEACON_PATH="$CLICKY_BEACON_PATH" \
  -t kckern/bookofmormon-online:cutover-test .
```
Expected: build completes; no `[object Promise]` / tsc errors (SSR spec C1 makes tsc a hard gate).

- [ ] **Step 2: Run it with a throwaway env and probe the 3 ports**
```bash
docker run -d --name gftest -e SANDBOX=1 -e NODE_ENV=production kckern/bookofmormon-online:cutover-test
sleep 20
docker exec gftest wget -qO- localhost:5005/health          # backend -> {"ok":true}
docker exec gftest wget -qO- --post-data '{"query":"{__typename}"}' --header 'content-type: application/json' localhost:5005/  # -> {"data":{"__typename":"Query"}}
docker exec gftest wget -qSO- localhost:8200/ 2>&1 | head -1 # next front door -> HTTP 200
docker exec gftest wget -qSO- localhost:8201/ 2>&1 | head -1 # cra static -> HTTP 200
docker rm -f gftest
```
Expected: backend health + `__typename`, Next 200, CRA 200.

*(No commit — verification only.)*

## Task 4: Finalize the GH Actions workflow

**Files:** Modify `.github/workflows/deploy-prod.yml`

- [ ] **Step 1: Uncomment `file: ./Dockerfile` and the `build-args` block; reference secrets:**
```yaml
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            kckern/bookofmormon-online:prod
            kckern/bookofmormon-online:prod-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            REACT_APP_CLICKY_SITE_ID=66488278
            REACT_APP_CLICKY_JS_PATH=${{ secrets.CLICKY_JS_PATH }}
            CLICKY_JS_PATH=${{ secrets.CLICKY_JS_PATH }}
            CLICKY_BEACON_PATH=${{ secrets.CLICKY_BEACON_PATH }}
```

- [ ] **Step 2: Set the two build-arg secrets from Infisical (piped, never printed):**
```bash
for K in CLICKY_JS_PATH CLICKY_BEACON_PATH; do
  V="$(infisical-get ba310d37/prod "$K")"   # helper: auth + fetch one secret value
  printf '%s' "$V" | gh secret set "$K" --repo kckern/BookofMormonOnline
done
gh secret list --repo kckern/BookofMormonOnline | grep -i clicky   # expect both present
```

- [ ] **Step 3: Commit**
```bash
git add .github/workflows/deploy-prod.yml && git commit -m "ci: wire greenfield Dockerfile + Clicky build-args into deploy workflow"
```

## Task 5: Provision greenfield prod env (Infisical)

**Reference:** `docs/plans/2026-08-05-prod-cutover-runbook.md` §1 — the authoritative var list.

- [ ] **Step 1:** In Infisical `ba310d37/prod`, ensure every §1 var is present with prod values: `SANDBOX=0`, `NODE_ENV=production`, `MYSQL_HOST/PORT/USER/PASSWORD/DB` (writable user), `SOCKET_CORS_ORIGIN=https://bookofmormon.online`, `MAIL_FROM`, `APP_BASE_URL=https://bookofmormon.online`, `S3_BUCKET`, `PROFILE_IMAGE_BASE_URL`, plus existing `clickySiteAdmin`, `CLICKY_JS_PATH`, `CLICKY_BEACON_PATH`. Leave `REDIS_URL` **unset** (Redis is being removed — single-instance).
- [ ] **Step 2:** Export the prod env to a box file for the compose `env_file` (mode 600, gitignored/off-repo): `infisical-dump ba310d37/prod > /home/ubuntu/greenfield/.env` on the box.
- [ ] **Step 3 (verify):** `grep -c . /home/ubuntu/greenfield/.env` ≥ the §1 count; `grep -E '^(SANDBOX|NODE_ENV|MYSQL_DB)=' /home/ubuntu/greenfield/.env` present.

## Task 6: Verify DB schema on `bom_prd`

**Reference:** 08-05 runbook §2 (migrations already applied to shared `bom_prd` — verify, don't re-run blindly).

- [ ] **Step 1:** `SHOW COLUMNS FROM bom_password_reset;` → `token,user,expires,created_at`.
- [ ] **Step 2:** `SHOW INDEX FROM bom_readingplan WHERE Key_name='uniq_owner_active';` → present.
- [ ] **Step 3:** Confirm messaging/notification tables exist (`SHOW TABLES LIKE 'messenger_%';`, `bom_notification`). If any missing, apply the corresponding `scripts/sql/*.sql` per that runbook first.

## Task 7: Box-side compose (staged, NOT yet fronted)

**Files:** Create `deploy/greenfield/docker-compose.yml` (repo) + `/home/ubuntu/greenfield/docker-compose.yml` (box)

- [ ] **Step 1: Write the compose** (single service; on the shared NPM network; watchtower label; ports NOT published to host — only reachable by NPM over the docker network):
```yaml
name: greenfield
services:
  app:
    image: kckern/bookofmormon-online:prod
    container_name: bom-greenfield-app
    restart: unless-stopped
    env_file: [ .env ]
    networks: [ bomdocker_default ]
    labels:
      com.centurylinklabs.watchtower.enable: "true"
    expose: [ "8200", "5005" ]
    mem_limit: 1200m
    logging: { driver: json-file, options: { max-size: "20m", max-file: "3" } }
networks:
  bomdocker_default:
    external: true
```
*(Confirm the actual NPM network name first: `docker inspect proxy -f '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}'` — replace `bomdocker_default` if different.)*

- [ ] **Step 2:** Commit the repo copy.
```bash
git add deploy/greenfield/docker-compose.yml && git commit -m "deploy: box-side greenfield compose (single image, watchtower label)"
```

- [ ] **Step 3 (bring up, alongside old — old still serves traffic):**
```bash
cd /home/ubuntu/greenfield && docker-compose up -d
docker exec bom-greenfield-app wget -qO- localhost:5005/health   # {"ok":true}
```

- [ ] **Step 4 (smoke the new container directly over the docker network, before any NPM change):** from the `proxy` container, `curl bom-greenfield-app:8200/` (Next 200), `curl -A Googlebot bom-greenfield-app:8200/` (SSR HTML), `curl -X POST bom-greenfield-app:5005/ -d '{"query":"{__typename}"}'` (GraphQL). All green before Task 8.

## Task 8: NPM host 8 re-point (the flip — reversible)

**Files:** NPM host 8 advanced config (via NPM API `localhost:81`, creds `NPM_USER`/`NPM_PASS` from Infisical).

- [ ] **Step 1: Record rollback** — save host 8's current config (`set $server "bookofmormon-online"; set $port 5005;`) so it can be restored verbatim.
- [ ] **Step 2: Set host 8 forward target → `bom-greenfield-app:8200`, and add advanced location routing for the API/socket to the backend:**
```nginx
location ~ ^/(graphql|api|messenger) {
    proxy_pass http://bom-greenfield-app:5005;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # /messenger WS upgrade
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $host;
}
```
(Default `location /` → the host's forward target `bom-greenfield-app:8200`.)
- [ ] **Step 3: Reload NPM** (API apply, or `docker exec proxy nginx -s reload`).

## Task 9: Verify through the real path + guardrail

- [ ] **Step 1 (human):** `curl -s -H 'User-Agent: Mozilla/5.0 Chrome' https://bookofmormon.online/ | grep -c '<div id="root"'` → CRA served.
- [ ] **Step 2 (bot SSR):** `curl -s -A Googlebot https://bookofmormon.online/ | grep -ci '<title'` → SSR HTML.
- [ ] **Step 3 (GraphQL):** `curl -s -X POST https://bookofmormon.online/graphql -H 'content-type: application/json' -d '{"query":"{__typename}"}'` → `{"data":{"__typename":"Query"}}`.
- [ ] **Step 4 (Clicky):** `curl -sD- -o/dev/null "https://bookofmormon.online/$CLICKY_JS_PATH"` → JS 200; POST beacon → 200.
- [ ] **Step 5 (socket):** open the app in a browser, confirm messaging socket connects (Network → `/messenger` 101 Switching Protocols).
- [ ] **Step 6 (GUARDRAIL):** `curl -s -o/dev/null -w '%{http_code}' https://api.scripture.guide/john.3.16` → `200`.
- [ ] **Step 7:** Run the 08-05 §4 smoke suite (`STUDY_CLI_URL=https://bookofmormon.online node scripts/study.cli.mjs run …`) — authz + signup + reset all green.

## Task 10: Cloudflare beacon cache-bypass (KC)

- [ ] **Step 1:** In Cloudflare, add a Cache Rule: if URI path == `CLICKY_BEACON_PATH` → **Bypass cache**. (JS path may stay cached.)
- [ ] **Step 2 (verify):** `curl -sD- -o/dev/null "https://bookofmormon.online/$CLICKY_BEACON_PATH?type=pageview"` → `cf-cache-status: BYPASS` (or DYNAMIC), never `HIT`.

## Task 11: Decommission old + hand deploys to CI/Watchtower

- [ ] **Step 1:** Stop (don't remove) the old app: `docker stop bookofmormon-online`. Keep it as the instant rollback.
- [ ] **Step 2 (label check):** `docker ps --filter label=com.centurylinklabs.watchtower.enable=true` → shows `bom-greenfield-app` only.
- [ ] **Step 3:** Merge `dev` → `prod`: `git checkout prod && git merge --ff-only dev && git push origin prod`. This puts the workflow + Dockerfile on `prod` → the next prod push builds+pushes `:prod` → Watchtower redeploys `bom-greenfield-app` automatically.
- [ ] **Step 4 (verify the loop):** confirm the Actions run goes green and Watchtower's next poll pulls the new `:prod` digest (VictoriaLogs: `container_name:watchtower _time:10m`).

## Rollback

Any failure at/after Task 8: restore host 8's saved config (`$server bookofmormon-online / $port 5005`), reload NPM, `docker start bookofmormon-online`. The greenfield container can stay up (idle) for diagnosis. DB DDL is additive — no data rollback. Old image/container untouched throughout.

---

## Self-review notes
- **Coverage:** all 6 blockers mapped — #1 Dockerfile→T1/T2, #2 compose→T7, #3 env→T5, #4 NPM→T8, #5 DB→T6, #6 Cloudflare→T10; plus build/CI (T3/T4), verify (T9), cutover/rollback (T11).
- **Open confirmations flagged inline:** NPM docker network name (T7), backend `PORT` env name (assumed `PORT`, per old container), whether Next needs `output:'standalone'` (plan uses full `.next`+node_modules — works; standalone is an optimization for later).
- **Guardrail** (php untouched) is a step in T9 and a standing rule.
