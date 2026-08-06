# Prod Cutover Runbook

**Date:** 2026-08-05
**Ships:** the full prod-readiness remediation (all P0 + confirmed P1 audit findings). Everything below is verified on **dev** (`bom-greenfield` @ `:5006`); this runbook is the turnkey checklist to promote it to prod.

**Code state:** all on `dev` = `feat/home-tiles-up-to-par`, HEAD `fc5644b1`. Audit + verdict: `docs/audits/2026-08-05-prod-audit-summary.md`.

> ⚠️ **Confirm the prod deployment target with the team first** (CLAUDE.md: prod is tracked by the `prod` branch and is currently out of date relative to `origin/prod`; the deploy host may differ from this dev box). This runbook assumes prod runs the same greenfield backend (`backend/`, graphql-yoga on a port behind the proxy) against the same MySQL (`bom_prd`).

---

## 0. Pre-flight (before touching prod)

- [ ] Confirm the branch/commit to ship: `git -C <repo> log --oneline -1` → should be `fc5644b1` (or newer on `feat/home-tiles-up-to-par`).
- [ ] Backend builds & typechecks: `cd backend && npx tsc --noEmit` → only the pre-existing `scriptureextras.ts:57` pair (no new errors).
- [ ] Backend deps installed on the prod host (adds `@aws-sdk/client-ses`): `cd backend && npm ci`.
- [ ] Record the **rollback point** = the prod commit currently deployed (write it down before deploying).

---

## 1. Environment variables (set on the prod host BEFORE starting the new build)

| Var | Required? | Purpose / correct value | Failure if wrong |
|---|---|---|---|
| `SANDBOX` | **YES** | `0` — enables writes. Default is `1` (suppresses ALL writes). | Every write silently no-ops (signup, posts, reset). |
| `NODE_ENV` | **YES** | `production` — masks raw resolver errors (A4). | DB errors/stack traces leak to clients. |
| `MYSQL_HOST`/`PORT`/`USER`/`PASSWORD`/`DB` | **YES** | prod DB creds (writable user). | No DB. |
| `REDIS_URL` | **strongly** | reachable Redis — multi-instance presence + socket fan-out. | Split-brain presence, missed cross-node broadcasts (single-node still works). |
| `SOCKET_CORS_ORIGIN` *(see note)* | **YES if socket is internet-facing** | restrict from `*` to the prod web origin(s). | Any origin can open sockets. |
| `MAIL_FROM` | **YES for real email** | verified SES sender (e.g. `no-reply@bookofmormon.online`). Unset → mailer logs instead of sends (password reset "works" but no email leaves). | No reset emails delivered. |
| `MAIL_REGION` | if SES | SES region (default `us-east-1`). | SES calls fail. |
| `MAIL_PROVIDER` | optional | `ses` (default) or `console` (staging log-only). | — |
| `APP_BASE_URL` | **YES** | prod web base for the reset link (default `https://bom.kckern.net` — set to the real prod URL). | Reset links point at the wrong host. |
| AWS creds | if SES | standard chain (`AWS_ACCESS_KEY_ID`/`SECRET`/role) with `ses:SendEmail`. | SES auth fails. |
| `OPENAI_API_KEY` | if bots on | + an org **budget/spend cap** (no app-layer cap exists). | Bots silent (unset) or uncapped cost. |
| `BOT_SCHEDULER_ENABLED` | optional | `true` only if proactive bot posting is wanted. | — |
| `MESSENGER_BOT_TOKEN` | if bots connect via socket | strong random. | Bots can't connect (safe) / weak privileged cred. |
| `MESSENGER_ENABLED` | optional | leave on; note it gates ONLY the socket, not GraphQL messenger resolvers. | Socket dark. |
| `MESSAGE_RETENTION_DAYS` | optional | e.g. `90` to hard-purge soft-deleted messages older than N days (no-op if unset). | Unbounded `messenger_messages` growth (deferred, safe). |
| `S3_BUCKET` / `PROFILE_IMAGE_BASE_URL` | **YES** | avatar/upload asset config. | `uploadProfileImage` crashes / wrong avatar base. |

> **Note — `SOCKET_CORS_ORIGIN`:** the socket CORS is currently hardcoded `origin:'*'` in `backend/src/realtime/server.ts`. If prod exposes the socket port directly, make it env-driven and restrict it as part of this cutover (small follow-up); if it's only reachable behind the proxy that enforces origin, this is lower risk.

---

## 2. Database migrations (apply to prod `bom_prd` BEFORE or WITH deploy)

Two idempotent DDL scripts. Apply with the prod writable user:

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" \
  < scripts/sql/2026-08-05-bom_password_reset.sql
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" \
  < scripts/sql/2026-08-05-bom_readingplan_active_unique.sql
```

- [ ] `bom_password_reset` — verify: `SHOW COLUMNS FROM bom_password_reset;` → `token, user, expires, created_at`.
- [ ] `bom_readingplan_active_unique` — **pre-check on prod first**: `SELECT owner, COUNT(*) c FROM bom_readingplan WHERE status='active' GROUP BY owner HAVING c>1;` must return **zero rows** (else the UNIQUE index creation fails — clean up the duplicates first). Verify after: `SHOW INDEX FROM bom_readingplan WHERE Key_name='uniq_owner_active';` → present.

*(These were already applied on dev's shared `bom_prd`; if prod is the SAME database, they're already in place — just verify.)*

---

## 3. Deploy

- [ ] Merge/fast-forward the release into the prod branch: `git checkout prod && git merge --ff-only feat/home-tiles-up-to-par` (or the team's promotion flow). Resolve if `prod` has diverged.
- [ ] On the prod host: pull, `cd backend && npm ci`, then restart the backend service (equivalent of `systemctl restart <prod-backend-unit>`; on this dev box it's `bom-greenfield`).
- [ ] Confirm it's live: `curl -s -X POST <prod-url>/ -H 'content-type: application/json' -d '{"query":"{__typename}"}'` → `{"data":{"__typename":"Query"}}`.
- [ ] Rebuild/deploy the frontend if it consumes the new `checkUsernameAvailable`/reset mutations.

---

## 4. Post-deploy smoke test (against the prod URL — replace `$U`)

Run these; each must show the NEW (secure) behavior. `$U` = prod backend root URL (post to `/`, not `/graphql`).

**A1 — signup works (was the launch-breaker):**
```bash
curl -s -X POST $U/ -H 'content-type: application/json' \
 -d '{"query":"mutation{ signup(token:\"smoke_ff01ac\", username:\"smoke_user_del\", password:\"x\", name:\"\", email:\"\", zip:\"\"){ isSuccess } }"}'
# expect isSuccess:true  (then delete this test user)
```

**Authz P0s closed** (use the harness if reachable, or raw GraphQL): with two users A/B —
- `messengerCreateChannel` with **no bearer** → `null` (M-3).
- A's token + B's `userId` in `messengerUpdateUser` → `null` (P-1); B self-update → ok.
- socket: a banned/non-member `send_message` → ack `{success:false, error:"not a joined member…"}` (M-1); editing another user's message → `{success:false, error:"not the author"}` (M-2).
- non-member reading a private channel's `messengerMessages` → `[]` (M-4).

The bundled harness reproduces all of these against a URL:
```bash
STUDY_CLI_URL=$U node scripts/study.cli.mjs run scripts/study/scenarios/authz/ban-bypass.yaml      # post → ✗ rejected
STUDY_CLI_URL=$U node scripts/study.cli.mjs run scripts/study/scenarios/authz/edit-others-message.yaml  # edit → ✗ rejected
STUDY_CLI_URL=$U node scripts/study.cli.mjs run scripts/study/scenarios/demo.yaml                  # legit flows → ✔ 8 steps
```

**A2 — password reset E2E:** `requestPasswordReset(email)` → `true`; confirm an email arrives (SES) or the log line (console); then `resetPassword(token, newpass)` → `isSuccess:true`; `signin(username, newpass)` → `isSuccess:true`; reuse token → `invalid_or_expired_token`.

**Hardening spot-checks:** `checkUsernameAvailable("<taken>")`→false / `("<free>")`→true; `users(user_ids:[…])` returns **no email**; `botlist` with no auth → `[]`.

- [ ] All smoke checks pass → **cutover complete.** Delete any `smoke_*` test users created.

---

## 5. Rollback

If a smoke check fails or prod misbehaves:
- [ ] Redeploy the previously-deployed prod commit (recorded in §0) and restart the backend.
- [ ] The DDL is additive and safe to leave (new empty table + a generated column/index); no data rollback needed. If the `uniq_owner_active` index must go: `ALTER TABLE bom_readingplan DROP INDEX uniq_owner_active, DROP COLUMN active_owner_key;`.
- [ ] Code-level: `git revert <range>` for the remediation (from `0d095a94` onward) is possible but prefer redeploying the known-good prod SHA.

---

## 6. Post-launch soak (deferred P1/P2 — safe at current data sizes, revisit under load)

- Perf: unread bulk (done), avatar probe now async (done), `bom_text` scan cached (done) — monitor leaderboard/homefeed latency.
- `MESSAGE_RETENTION_DAYS` — enable once you pick a retention window.
- Socket CORS origin restriction (§1 note) if not done at cutover.
- Bot LLM spend — watch the OpenAI budget (no app-layer cap).

---

## Sign-off
- [ ] Env set (§1) · [ ] Migrations applied + verified (§2) · [ ] Deployed + live (§3) · [ ] Smoke green (§4) · [ ] Rollback point recorded (§0).
