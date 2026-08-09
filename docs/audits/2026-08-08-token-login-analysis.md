# Token Login System — Security Analysis

**Date:** 2026-08-08
**Scope:** Active greenfield backend (`backend/`) + CRA frontend (`frontend/webapp/`). The deprecated `_deprecated/src/` stack is out of scope.
**Method:** Read-only review of the auth resolvers, loaders, password/identity helpers, request middleware, and the frontend token bootstrap.

## Model in one paragraph

Auth uses **opaque, database-backed session tokens** — not JWTs. A token is a random string stored in `bom_user_token (token → user)`. There is **no signature, no expiry, and no server-side rotation**. `signin`/`signup` bind a token to a username; `tokensignin` looks a token up and returns the user; `signout` deletes one token row. Passwords are bcrypt (12 rounds) with an organic MD5→bcrypt migration on successful login. Messenger resolvers authenticate via `Authorization: Bearer <token>`; the classic auth queries pass the token as a GraphQL argument in the POST body.

## Key files

| Component | File | Lines |
|---|---|---|
| signin / tokensignin / signout / reset resolvers | `backend/src/graphql/resolvers/userauth.ts` | 61–210 |
| doSignin, token upsert, MD5 rehash, progress | `backend/src/data/loaders/userauth.ts` | 119–312 |
| Password hashing / verify | `backend/src/auth/password.ts` | 11–27 |
| Token validity guard, md5, cleanUsername | `backend/src/auth/identity.ts` | 7–35 |
| Bearer extraction + global rate limit | `backend/src/index.ts` | 78–106 |
| Frontend token bootstrap | `frontend/webapp/src/App.js` | 34–37 |

## What is done well

- **Junk-token guard** (`identity.ts:17`) — `""`, `"null"`, `"undefined"`, etc. can never resolve to or be persisted as a token. This closed a real prior hole where `token="null"` rows made every guest resolve to those users.
- **bcrypt at 12 rounds** for all new/rehashed passwords, with **organic migration** off legacy MD5 on next successful login.
- **No ambient (cookie) auth on the GraphQL API** → effectively immune to CSRF for the token-carrying calls (the credential is explicit, never sent automatically by the browser).
- **Anti-enumeration** on `requestPasswordReset` (always returns `true`) and single-use, 30-min reset tokens.
- **Token travels in the POST body / Authorization header, not the URL** — avoids leaking it into access logs, Referer headers, and browser history.
- **Global per-IP rate limit** 300/min (`index.ts:106`) throttling credential stuffing.

## Findings (highest risk first)

### 1. Session fixation — client chooses its own session token *(High)*
`App.js:34–36` generates the token **on the client** and stores it in `localStorage`. On `signin`/`signup` the server **accepts that client-supplied token verbatim** and binds it to the account (`upsertTokenAndRelinkLogs`, `userauth.ts:119–136`). The server never mints a fresh token at the moment of authentication.

Consequence: if an attacker can plant a known token value in a victim's `localStorage` (e.g. via XSS, a shared kiosk, or a malicious link that seeds it) *before* the victim logs in, that attacker-known token becomes a valid credential for the victim's account after login — classic session fixation → account takeover. The 128-bit random default is fine for *confidentiality*, but the design flaw is that the server trusts a value the client controls.

**Fix:** on successful `signin`/`signup`, generate a new high-entropy token **server-side** (`crypto.randomBytes`), persist it, and return it; ignore any client-supplied token for binding. Keep the client token only as an anonymous pre-login analytics id for log relinking.

### 2. No token expiry or rotation *(High)*
Tokens live in `bom_user_token` forever until `signout` deletes the exact row. A stolen or leaked token is a **permanent** credential. There is no "sign out everywhere," no idle/absolute timeout, and no rotation.

**Fix:** add an `expires`/`last_used` column and reject/prune stale tokens; offer a "revoke all sessions" (delete all rows for a user); rotate on privilege changes (password reset especially — see #4).

### 3. Token in `localStorage` *(Medium, compounds #1 and #2)*
`localStorage` is readable by any JavaScript on the origin, so **any XSS exfiltrates the token**, and because tokens never expire (#2), that theft is permanent. An `HttpOnly; Secure; SameSite` cookie would remove the token from JS reach — though that reintroduces CSRF considerations the current design avoids, so weigh the tradeoff.

### 4. Password reset does not invalidate existing sessions *(Medium)*
`resetPassword` (`userauth.ts:197–210`) updates `bom_user.pass` but leaves all `bom_user_token` rows intact. A user resetting their password (the canonical "I think I was compromised" action) does **not** log the attacker out.

**Fix:** delete all of the user's token rows inside `resetPassword`.

### 5. Legacy MD5 password verification is unsalted *(Medium — data-at-rest risk)*
`verifyPassword` (`password.ts:23–24`) compares `md5(password)` for un-migrated hashes. Dormant accounts keep unsalted 32-hex MD5 indefinitely (organic migration only fires on login). If `bom_user` leaks, those are trivially rainbow-tabled. This is a known, accepted tradeoff (see the bcrypt-migration memory), but the residual risk grows with the dormant-account tail.

**Consider:** a one-time forced rehash-on-reset campaign, or wrapping legacy hashes (`bcrypt(md5(pw))`) so nothing unsalted remains at rest.

### 6. Deterministic guest token generation — verify the seed *(Low, needs follow-up)*
`generateToken` derives a token as `md5("bom-token-seed:" + seed)`. If `seed` is client-predictable, guest tokens are predictable. Guests have no real account, so impact is limited, but confirm what feeds `seed` before dismissing. *(Not fully traced in this pass.)*

### 7. Unbounded token accumulation *(Low)*
Every device/login adds a row and nothing prunes them (no expiry, #2). Over time `bom_user_token` grows without bound. Fixed for free by adding expiry + pruning.

## Recommended priority order
1. Server-generated token on auth (#1) — this is the structural fix and also the prerequisite for treating tokens as real secrets.
2. Invalidate sessions on password reset (#4) — small, high-value.
3. Token expiry + revoke-all + pruning (#2, #7).
4. Revisit `localStorage` vs `HttpOnly` cookie (#3) as a follow-on.
5. Trace `generateToken` seed (#6); plan the dormant-MD5 tail (#5).
