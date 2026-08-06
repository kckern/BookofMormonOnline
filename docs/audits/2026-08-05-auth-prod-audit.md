# Auth / User-Functions Prod Audit — 2026-08-05

**Auditor:** automated agent (Task 2 of prod-readiness audit plan)
**Surface:** Auth/User-Functions (§5A findings A1–A7)
**Backend under test:** `http://localhost:5006` (bom-greenfield unit)
**Isolation:** `STUDY_CLI_HOME=/tmp/audit-auth`

---

## Surface Summary

The auth surface has two launch-blocking issues and three meaningful P1s. The most severe is A1: the `/graphql` endpoint—which must be left reachable for GraphQL Playground and legacy client compatibility—triggers a MySQL `ER_DATA_TOO_LONG` error on signup because the URL path segment `graphql` (7 chars) overflows the `lang` column (`varchar(3)`). This is reproducible with a plain curl; the error code is also leaked raw to the caller (A4). A5 is a silent information-disclosure bug: the `users(user_ids)` query returns real email addresses to completely unauthenticated callers with no bearer token. A6 is REFUTED in the specific claim but a narrower real issue exists. A7 is a genuine low-severity concern. A2 (no password reset) and A3 (no rate limiting on auth) are both CONFIRMED structural gaps.

---

## Findings

### A1 — lang overflow — CONFIRMED (severity: P0)

- **Claim:** Signing up via the `/graphql` endpoint writes `lang='graphql'` (7 chars) into the `bom_user.lang varchar(3)` column, producing `ER_DATA_TOO_LONG`.
- **Method:** DB schema check + curl to `/graphql`; contrasted with `POST /`.
- **Evidence:**
  - DB: `SHOW COLUMNS FROM bom_user LIKE 'lang'` → `varchar(3)` confirmed.
  - `backend/src/graphql/lang.ts:21`: `pathlang = urlPath.split('?')[0]?.split('/').reverse()[0] || 'en'` — last path segment.
  - `backend/src/data/loaders/userauth.ts:350`: `lang: lang || 'en'` written directly to INSERT without validation.
  - `backend/src/index.ts:102`: `app.route({ url: '/*', handler: graphqlHandler })` — `/graphql` matches this catch-all; `resolveLang(host, '/graphql')` → `pathlang='graphql'` (7 chars).
  - Live probe: `curl -X POST http://localhost:5006/graphql -d '{"query":"mutation{signup(token:\"probelang123\",username:\"probelanguser\",...)...}"}'` → `{"data":{"signup":{"isSuccess":false,"msg":"ER_DATA_TOO_LONG"}}}`.
  - Contrast: same query to `POST /` (lang resolves to `en`) → `{"data":{"signup":{"isSuccess":true,"msg":"sign_up_success"}}}`.
- **Impact:** Any signup sent directly to `/graphql` (e.g., older clients, curl tests, legacy bots) fails with a MySQL truncation error. Also leaks the internal DB error code (see A4).
- **Fix sketch:** Clamp `lang` to the `SUPPORTED` list (or `'en'` fallback) before the INSERT; alternatively, widen the column to `varchar(10)`.

---

### A2 — password reset missing — CONFIRMED (severity: P0)

- **Claim:** There is no forgot-password / email-based password reset flow in the green-field backend.
- **Method:** `grep -rniE "resetPassword|forgotPassword|password.*reset" backend/src backend/schema` — zero hits. Schema review of all Mutation fields.
- **Evidence:**
  - grep output: empty (no results) across `backend/src/` and `backend/schema/`.
  - `backend/schema/BomUser.graphql:17-23` Mutation block lists: `log`, `changePassword`, `signup`, `signout`, `editProfile`, `uploadProfileImage`. No `resetPassword` or `forgotPassword` mutation exists.
  - `changePassword` (line 19) requires a valid session `token` arg — there is no unauthenticated recovery path.
- **Impact:** Users who forget their password and cannot social-sign-in have no self-service recovery. This is a hard launch blocker for a public-facing service. Requires a plan for who owns this (legacy box? new email flow?).
- **Fix sketch:** Implement `mutation forgotPassword(email: String!): Boolean` + token-based email link + `mutation resetPassword(resetToken: String!, newPassword: String!): Boolean`; or document explicitly that legacy box still owns this path.

---

### A3 — no rate limiting on auth endpoints — CONFIRMED (severity: P1)

- **Claim:** Auth mutations (`signin`, `signup`, `changePassword`) are not rate-limited; only the fax route has a rate limiter.
- **Method:** `grep -rniE "rate-limit|rateLimit|@fastify/rate-limit" backend/src` + review of `backend/src/index.ts` route registration.
- **Evidence:**
  - grep: only two hits, both in `backend/src/media/fax/route.ts:44-45` (`@fastify/rate-limit`, max 120/min on fax only).
  - `backend/src/index.ts:100-102`: all GraphQL traffic (including auth mutations) goes through `graphqlHandler` with no rate-limiting plugin registered globally.
  - No per-resolver throttle or field-level complexity limit is in the Yoga plugin stack (`index.ts:30-66`).
- **Impact:** Brute-force password guessing, username enumeration, and credential stuffing are unbounded. An attacker can attempt millions of `signin` mutations with no server-side slowdown.
- **Fix sketch:** Register `@fastify/rate-limit` globally (or just on the GraphQL handler) with a conservative limit (e.g., 30 req/min per IP) before go-live; or add per-resolver depth/cost limits via `graphql-query-complexity`.

---

### A4 — error/enumeration leaks — CONFIRMED (severity: P1)

- **Claim:** Raw MySQL error codes (e.g., `ER_DUP_ENTRY`) are returned in `msg` on signup failure because `maskedErrors: false` is set and the catch block passes `err.code` directly.
- **Method:** Read `backend/src/index.ts:27` + `backend/src/data/loaders/userauth.ts:378-391`. Live probe via curl (duplicate username).
- **Evidence:**
  - `backend/src/index.ts:27`: `maskedErrors: false` — raw resolver errors pass through Yoga unmasked. Comment says "COMPAT: legacy Apollo exposes raw resolver error messages."
  - `backend/src/data/loaders/userauth.ts:378-391`: catch block explicitly extracts `err.code` and returns it as `msg`:
    ```typescript
    const code = err && typeof err === 'object' && 'code' in err
      ? (err as { code: string }).code
      : undefined;
    return { isSuccess: false, msg: code ?? 'error_creating_user', ... };
    ```
  - Live probe: `curl ... -d '{"query":"mutation{signup(token:\"probe-dup\",username:\"simauda\",...)}"}}'` → `{"data":{"signup":{"isSuccess":false,"msg":"ER_DUP_ENTRY"}}}`.
  - Combined with brute-force login (A3 absence), this enables username enumeration: `ER_DUP_ENTRY` = username taken; any other msg = username free.
- **Impact:** Username enumeration (does account X exist?) is trivially easy; internal DB error semantics are exposed. Combined with A3, credential stuffing is fully unblocked.
- **Fix sketch:** Map internal DB codes to generic user-facing messages in the signup catch (e.g., `ER_DUP_ENTRY` → `'username_taken'`); evaluate whether the `maskedErrors: false` compat flag can be narrowed.

---

### A5 — `users(user_ids)` unauthenticated email dump — CONFIRMED (severity: P1)

- **Claim:** The `users(user_ids)` query returns user emails without requiring any authentication.
- **Method:** Read `backend/src/graphql/resolvers/ported_user.ts:147-154` + `backend/src/data/loaders/ported_user.ts:205-217`. Probe with `--anon` (no bearer).
- **Evidence:**
  - `ported_user.ts:147-154`: the `users` resolver calls `getUsersByIds(ctx.db, args.user_ids)` with no `ctx.bearerToken` guard — zero auth check.
  - `ported_user.ts (data loader) :213`: `SELECT user, name, email FROM bom_user WHERE user IN (...)` — email is fetched unconditionally.
  - `backend/schema/BomUser.graphql:52-67`: `type User { ... email: String ... }` — email is in the SDL output type.
  - Anonymous curl: `curl -X POST http://localhost:5006/ -d '{"query":"{ users(user_ids:[\"08wmarsh\"]){ user email name } }"}'` → `{"data":{"users":[{"user":"08wmarsh","email":"wmarsh08@hotmail.com","name":"Weston"}]}}`.
  - Probe: `node scripts/study/probe.mjs --as auda --anon 'query{ users(user_ids:["08wmarsh"]){ user email name } }'` → same result (email returned, no auth).
  - Note: kckern's email is stored as empty string `""` (stripped by `stripEmptyDeep`), which is why that specific test showed no email; real user emails are exposed.
- **Impact:** Any party that knows a username can retrieve the associated email address with zero authentication. Given that usernames are visible throughout the app (leaderboard, comments, DMs), this is a full email enumeration / harvesting surface.
- **Fix sketch:** Either require a bearer token in the `users` resolver (check `ctx.bearerToken`), or remove `email` from the `getUsersByIds` SELECT and the public `User` SDL type.

---

### A6 — Facebook access_token echo — PARTIAL (severity: P1)

- **Claim:** The raw Facebook `access_token` is echoed back in `SignIn.profile_url` (embedded in the picture URL) rather than being stripped.
- **Method:** Read `backend/src/data/loaders/socialsignin.ts` — `verifySocialToken` (line 47), `processSocialUser` (lines 150-176), `refreshMessengerAvatar` (lines 98-124).
- **Evidence:**
  - Line 47 of `socialsignin.ts` builds the Facebook profile picture URL with the access token embedded: `` `https://graph.facebook.com/${data.id}/picture?type=large&access_token=${encodeURIComponent(socialToken)}` ``.
  - Line 104: `refreshMessengerAvatar` strips `access_token` before persisting to `messenger_users` (correct).
  - BUT lines 153/162/176 — `processSocialUser` returns `{ ..., social, profile_url }` where both `social.profile_url` and the top-level `SignIn.profile_url` are the **raw** token-bearing URL from `verifySocialToken`. The strip only happens on the DB persist path, not on the response path.
  - The `Social` SDL type has `access_token: String` (line 44 of `BomUser.graphql`) which is **not** populated by `sendbird.loadUser/createUser` — so that specific field is not the vector. The token leaks via the URL in `profile_url`.
  - Dynamic probe not run for Facebook (would require a live FB token); the code path is unambiguous from static review.
- **Impact:** The Facebook user's short-lived access token is returned to the client in the `profile_url` field of the `SignIn` response and `Social` sub-type. While the client may already hold this token, logging/proxying the GraphQL response (CDN, WAF, browser history) captures a live credential. PARTIAL because the Social.access_token SDL field is not populated (the specific claim about that field is wrong), but the URL-embedded token is a real leak.
- **Fix sketch:** In `processSocialUser`, strip `access_token` from the profile_url before returning the `SignIn` shape (reuse the same `URL.searchParams.delete('access_token')` logic from `refreshMessengerAvatar`).

---

### A7 — deterministic `generateToken` — CONFIRMED (severity: P2)

- **Claim:** `generateToken(seed: Int)` is fully deterministic — `md5('bom-token-seed:N')` — so any caller can enumerate all possible tokens by iterating over integer seeds.
- **Method:** Read `backend/src/graphql/resolvers/ported_user.ts:138-141`. Live probe twice with same seed; probe unauthenticated.
- **Evidence:**
  - `ported_user.ts:138-141`:
    ```typescript
    generateToken: (_root, args) => {
      const seed = args.seed ?? 0;
      return md5(`bom-token-seed:${seed}`);
    },
    ```
  - No auth guard, no randomness, no nonce.
  - Live probe (authenticated): `node scripts/study/probe.mjs --as auda 'query{ generateToken(seed: 42) }'` → `"83bb33ceeec77a2e218afb762911d5e3"` (both calls).
  - Live probe (unauthenticated): `node scripts/study/probe.mjs --as auda --anon 'query{ generateToken(seed: 42) }'` → same hash `"83bb33ceeec77a2e218afb762911d5e3"`.
  - Enumerable: an attacker iterating `seed` 0..10M can precompute the entire token space offline.
- **Impact:** If `generateToken` is used anywhere to mint real session tokens (e.g., password-reset links, signup flows using a predictable seed), those tokens are forgeable. If seeds are user IDs (integers), attackers can precompute session tokens for arbitrary users. Severity depends on where the frontend calls this resolver.
- **Fix sketch:** Replace with a cryptographically random token (`crypto.randomBytes(16).toString('hex')`); remove the `seed` arg entirely, or require a valid session token to call.

---

## Top-3 Blockers

1. **A1 — lang overflow (P0):** The `/graphql` endpoint is unusable for new signups — they all fail with `ER_DATA_TOO_LONG`. This is a silent data-integrity bomb: any client pointing directly at `/graphql` (older app versions, some social OAuth redirects) cannot create accounts. Fix is one line: clamp or validate `lang` before the INSERT.

2. **A2 — no password reset (P0):** Users who lose access and cannot social-sign-in are permanently locked out. A public-facing launch without any self-service recovery mechanism is not viable. Needs either a new email reset flow or an explicit decision that the legacy box owns this path and a routing plan.

3. **A5 — unauthenticated email dump (P1):** Any unauthenticated HTTP client can retrieve real user email addresses by username. With leaderboard/DM usernames being public, this is a full harvesting surface. One-line guard: check `ctx.bearerToken` at the top of the `users` resolver, or drop `email` from the public type.

---

## A2 Remediation Status (2026-08-05)

**Finding:** Password reset is genuinely absent from the green-field backend. `grep -rniE "resetPassword|forgotPassword|password.*reset"` across `backend/src/` and `backend/schema/` returns zero hits. The `BomUser.graphql` Mutation block has no `forgotPassword` or `resetPassword` field. The only password change path (`changePassword`) requires a valid session token — there is no unauthenticated recovery path.

**Owner determination:** The legacy `src/` stack (`_deprecated/`) is confirmed deprecated and not running. The green-field `backend/` is the sole live backend. There is no PHP box or separate legacy service currently serving a password-reset flow for this backend's users. Existing bom_user rows with only a hashed password and no social link have no self-service recovery path today.

**Decision needed (not a code change):** This is a genuine gap requiring a product/engineering decision: either implement `mutation forgotPassword(email: String!): Boolean` + token-based email link + `mutation resetPassword(resetToken: String!, newPassword: String!): Boolean`, or formally route this surface back to a legacy owner. Building a placeholder or stub flow without the email-delivery infrastructure in place would be misleading. **No fake reset flow was implemented.** This remains open as a P0 launch blocker pending owner assignment.
