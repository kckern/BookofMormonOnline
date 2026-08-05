# Prod-Readiness Audit — Consolidated Go/No-Go

**Date:** 2026-08-05
**Verdict: NO-GO.** 8 confirmed P0 authorization/availability defects block the dev→prod cutover. Most collapse into **two** systemic root causes with high single-fix leverage.

Source reports (evidence + `file:line` in each):
`auth` · `profile` · `progress` · `messaging` · `community` — all `docs/audits/2026-08-05-<surface>-prod-audit.md`.
Method: recon (`docs/plans/2026-08-05-dev-to-prod-final-review-plan.md`) verified per `docs/plans/2026-08-05-prod-audit-execution-plan.md` — code review + live adversarial probes (`scripts/study/probe.mjs`, `scripts/study.cli.mjs`) + DB/schema checks.

---

## Findings register

| ID | Surface | Finding | Verdict | Sev | Blocker |
|----|---------|---------|:------:|:---:|:------:|
| P-1 | profile | Profile takeover via `userId` arg — **works anonymously** (no bearer) | CONFIRMED | P0 | ✅ |
| M-1 | messaging | Socket write: no membership/ban check — banned user posts | CONFIRMED | P0 | ✅ |
| M-2 | messaging | `edit_message`/`delete_message`: no ownership check — edit/delete **anyone's** message | CONFIRMED | P0 | ✅ |
| M-3 | messaging | `messengerCreateChannel`: no auth — anonymous channel creation | CONFIRMED | P0 | ✅ |
| A1 | auth | `POST /graphql` sets `lang="graphql"` → `bom_user.lang` overflow → signup breaks | CONFIRMED | P0 | ✅ |
| A2 | auth | No password reset in the new backend (account-recovery gap) | CONFIRMED | P0 | ✅ (confirm legacy) |
| P-2 | profile | `messengerUpdateUserMetadata` full-replace — wipes `bookmark`/notif watermark | CONFIRMED | P0/P1 | ✅ |
| M-5 | messaging | `messengerAcceptInvitation`/`Decline` honor arbitrary `userId` | CONFIRMED | P1 | — |
| A5 | auth | `users(user_ids)` — unauth email dump, unbounded batch | CONFIRMED | P1 | — |
| A4 | auth | Enumeration: signup returns `ER_DUP_ENTRY`; `maskedErrors:false` | CONFIRMED | P1 | — |
| A3 | auth | No rate limiting on `signin`/`signup`/`changePassword`/`socialsignin` | CONFIRMED | P1 | — |
| A6 | auth | Facebook `access_token` echoed in `SignIn.profile_url` (picture URL) | PARTIAL | P1 | — |
| C-1 | community | Feed `HomeUser` not privacy-masked — real names leak in feeds | CONFIRMED | P1 | — |
| C-2 | community | `joinGroup` (hash) ignores `custom_type` — private channels joinable by hash | CONFIRMED | P1 | — |
| C-4 | community | `studygrouphistory` returns dev accounts `[tytus,kckern]` for **any** id | CONFIRMED | P1 | — |
| C-5 | community | `botlist` — no auth (enumerates bots) | CONFIRMED | P1 | — |
| C-3 | community | Bot LLM: no app-layer rate limit/budget cap; in-flight guard per-process | CONFIRMED | P1 | — |
| M-4 | messaging | `messengerMessages`/`messengerChannel` — no membership check (read any channel) | CONFIRMED | P1 | — |
| M-6 | messaging | Unread count N+1 (2 queries × N channels) | CONFIRMED | P1 | — |
| M-7 | messaging | Soft-deleted messages never purged — unbounded growth | CONFIRMED | P1 | — |
| PR-1 | progress | `loadReadingPlan` write-on-read — a query auto-completes the plan | CONFIRMED | P1 | — |
| PR-2 | progress | `loadReadingPlan` full `bom_text` scan (3,544 rows today; uncached) | CONFIRMED | P1 | — |
| PR-3 | progress | One-active-plan not enforced by a UNIQUE constraint (race) | CONFIRMED | P1 | — |
| PR-4 | progress | `bom_log.value` unindexed for the `standardizedScores` join (`user` IS indexed) | PARTIAL | P1 | — |
| P-3 | profile | Avatar existence probe = synchronous HTTP per user on leaderboard/feed hot path | CONFIRMED | P1 | — |
| P-4 | profile | `uploadProfileImage` — no payload-size cap, no throttle | CONFIRMED | P1 | — |
| A7 | auth | `generateToken(seed)` = `md5('bom-token-seed:N')` (deterministic) | CONFIRMED | P2 | — |
| P-5 | profile | `bom_user.pass` selected into memory (not SDL-exposed today) | PARTIAL | P2 | — |
| PR-5 | progress | Junk-token progress | **REFUTED** | — | — | `isValidToken` IS enforced in the token DataLoader |

**Score:** 26 CONFIRMED, 3 PARTIAL, 1 REFUTED. **8 launch-blockers (P0).**

---

## Two systemic root causes (fix the class, not the instance)

**Root cause #1 — "trust the client-supplied `userId`/`token` arg."** Resolvers resolve the target as `args.userId ?? actingUser(ctx)`, making the credential a *fallback*. Instances: **P-1** (profile takeover, even anonymous), **M-5** (accept/decline as another user), and the read-side of `messengerUser`/`messengerMyChannels`/`messengerUnreadDMs`.
→ **One rule, applied at every messenger resolver:** derive the acting user from the credential; a supplied `userId` must equal it (self) or the caller must be an operator. Reject otherwise. Closes P-1 + M-5 together.

**Root cause #2 — the socket/GraphQL write path has no per-action authorization.** Socket handlers check auth (+ mute on send) but not membership, ban, or message ownership; `messengerCreateChannel` checks nothing. Instances: **M-1, M-2, M-3**, and read-authz **M-4**.
→ **One shared guard** `assertCanWrite(channelUrl, userId)` (joined-member AND not banned) on `send_message`/`edit_message`/`delete_message`/reactions, **plus** an ownership check on edit/delete (`updateMessage`/`deleteMessage` must scope by `user_id` or the handler must verify authorship), **plus** require auth on `messengerCreateChannel`. Closes M-1/M-2/M-3/M-4.

Everything else is independent and smaller.

---

## Go/No-Go decision

### Must-fix before cutover (P0 launch-blockers)
1. **Root cause #1** — messenger `userId`-arg authorization (P-1, M-5). *P-1 is the single most severe: profile overwrite with zero auth.*
2. **Root cause #2** — socket write authorization + message ownership + `messengerCreateChannel` auth (M-1, M-2, M-3, M-4).
3. **A1** — the `lang` overflow: the frontend must never hit an endpoint that yields `lang="graphql"` (route to `/`, or clamp `resolveLang` to `SUPPORTED_LANGUAGES`, or widen the column). Signup is broken otherwise.
4. **A2** — confirm password reset is owned by the legacy box; if not, it's a launch-blocking account-recovery gap.
5. **P-2** — metadata full-replace → make it a merge (silent data loss of bookmark + notification read-state).

### Fix or explicit risk-accept (owner + date) — P1
The 15 confirmed P1s: A3/A4/A5/A6 (rate-limit, enumeration, email dump, FB token), C-1/C-2/C-4/C-5/C-3 (feed privacy, join-type bypass, dev-account leak, botlist auth, LLM cost cap), M-6/M-7 (N+1, retention), PR-1/PR-3 (write-on-read, plan race), P-3/P-4 (avatar hot-path, upload cap). **C-4 (studygrouphistory leaking real dev-account activity for any id) and A5 (unauth email dump) are privacy issues that many teams would also gate on.**

### Fast-follow — P2 / perf
A7, P-5, PR-2, PR-4, M-6, P-3 (the perf items are safe to soak post-launch given current data sizes — `bom_text`=3,544, `bom_log.user` indexed).

### Separate gate — prod config (not re-verified here)
The config checklist in the review plan §6 must be verified against the real prod env: `SANDBOX=0`, `maskedErrors` on, socket CORS restricted, `REDIS_URL`, `OPENAI_API_KEY` + budget, `MESSENGER_BOT_TOKEN`, `S3_BUCKET`/`PROFILE_IMAGE_BASE_URL`, `x-forwarded-for` trust.

---

## Recommended sequence
Wave 1 (both root-cause fixes) clears 6 of 8 P0s in two focused PRs — do it first, and regression-test each with the `scripts/study/scenarios/authz/` suite (ban-bypass + edit-others-message already exist; add profile-takeover and anon-create). Then A1/A2/P-2, then the P1 batch, then the config gate. The `study.cli`/`probe.mjs` harness is the standing regression suite for the authz class.

## Housekeeping
The audit created synthetic `sim*`/`aud*`/`pr*`/`msg*`/`com*` users, scratch channels, and probe messages in the live dev DB (incl. a mutated `simbob` nickname and stub-account reads). Run `node scripts/study.cli.mjs cleanup` (per isolated `STUDY_CLI_HOME`) to revoke tokens; scratch channels are emptied best-effort (no delete-channel mutation).

---

## Wave 1 remediation — CLOSED (2026-08-05)

Both systemic root causes fixed and verified against the live backend with the
`study.cli`/`probe.mjs` adversarial harness. Plan: `docs/plans/2026-08-05-wave1-authz-remediation-plan.md`.

| Finding | Fix | Verified | Commit |
|---|---|---|---|
| **P-1** profile takeover | `requireSelf(userId)` on updateUser/metadata/accept/decline/DMs/myChannels | cross-user & anon → `null`; self → ok | `cc793e3f` |
| **M-1** banned/non-member posts | `getMembership` joined-guard on socket writes | banned post → `✗ not a joined member` | `0f71c72c`+`1aa9ebde` |
| **M-2** edit/delete anyone's msg | author-only (edit) / author-or-op (delete) ownership check | bob's edit of alice → `✗ not the author`; text intact | `1aa9ebde` |
| **M-3** anon channel create | `resolveActingUserId` required in `messengerCreateChannel` | anon → `null`; authed → ok | `cc793e3f` |
| **M-4** private read by non-member | membership gate on `messengerMessages` (public/open exempt) | non-member → `[]`; member → sees msgs | `cc793e3f` |
| **M-5** accept/decline as other | `requireSelf(userId)` | cross-user → `false` | `cc793e3f` |
| **P-2** metadata full-replace wipe | shallow merge over existing metadata | partial update preserves `bookmark` | `35f76537` |

Regression: `demo.yaml` still `✔ 8 steps` (legit member send/edit-own/react/join unbroken); `getMembership` unit test 2/2; `tsc` clean (only the pre-existing `scriptureextras.ts:57` pair). **Remaining before cutover:** A1 (lang overflow), A2 (password reset), the P1 batch, and the prod-config gate (§6 of the review plan) — not in Wave 1.
