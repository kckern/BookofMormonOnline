# Auth Provider Abstraction — Design Spec (v2)

**Date:** 2026-08-08
**Status:** Approved direction, revised after adversarial review; pending implementation plan
**Related:**
- `docs/audits/2026-08-08-token-login-analysis.md` — the audit this builds on
- Adversarial review (2026-08-08) that produced this v2. Verified findings folded in below.

## What changed from v1 (and why)

v1 was sent back by review. Verified problems fixed here:
- **Call-site count was wrong.** `bom_user_token` is referenced in **13 files**, not 7. Full list + phasing below.
- **The WebSocket auth path was missing.** `realtime/server.ts:54 verifyToken()` is a second auth entry point (with a `MESSENGER_BOT_TOKEN` bot escape). It is now in scope.
- **Sandbox mode would break server-issued login on dev.** `runWrite` suppresses writes under sandbox; a server-minted token would persist nowhere and the next `verify()` would fail. Explicit sandbox handling added.
- **`issue(userId)` signature was self-contradictory** across Phase 0/1. Reworked; the anonymous-log merge no longer rides on the credential path.
- **`Principal` was lossy** — field resolvers need the full profile row. Split "who is this" (Principal) from "their profile" (loadProfile), so no provider has to smuggle `UserAuthRow` through `raw`.
- **`revoke`/`revokeAll` can't be honored by a stateless JWT provider for free.** Made an explicit provider contract (denylist obligation), not a silent per-impl lie.
- **Redirect hooks had wrong signatures** (no state/nonce/PKCE). Dropped from the v1 interface — see Decision D1.
- **Anon-id relink re-opened the client-controlled-value footgun.** Now gated.
- **"Contract tests against one provider" prove nothing.** A second in-memory provider (denylist JWT fake) is added purely to exercise pluggability.

## Goal

Keep the opaque, DB-backed session-token system as the default, but move **all** authentication behind one `AuthProvider` facade + a shared concrete session store, so a future JWT/Cognito swap is a new adapter (+ a login screen), not a cross-cutting refactor. This effort also lands the two security fixes from the audit: **server-side token issuance** (session fixation) and **session revocation on password reset**.

### The honest scope boundary

This seam insulates every "who is this request?" check and the full credential lifecycle. It does **not** by itself make a Cognito migration turnkey — roles/authz, account linking, the `md5(username)` messenger identity assumption, and the dormant unsalted-MD5 password tail are real blockers that live outside this seam (listed under Out of Scope). The pitch is "make the session/credential seam swappable and fix two security bugs," not "enable an IdP swap." Redirect-login flow code is built when a redirect provider is actually chosen.

## Open decisions (please confirm — D1 reverses a prior v1 choice)

- **D1 (changed):** v1 kept `beginAuthorization`/`completeAuthorization` in the interface for "stability." Review showed the signatures are wrong for any real OIDC flow (no `state`/`nonce`/PKCE/callback URI), so they buy the YAGNI cost without the stability. **v2 drops them**; the first redirect provider defines the real signatures. If you'd rather keep a documented (non-normative) placeholder, say so.
- **D2:** `expires`/`last_used` column + expiry enforcement — this effort, or a Phase 1.5 follow-up?
- **D3:** `AUTH_PROVIDER` default value + Infisical key name.

## Backend design

### Two collaborating pieces

1. **`SessionStore` (concrete module, `backend/src/auth/sessionStore.ts`).** The single home for the `bom_user_token` queries that today live in 13 files: `verifyToken`, `issueToken`, `revokeToken`, `revokeAllForUser`, `rotateToken`, plus the junk-token guard. **Every** call site — resolvers, loaders, and `realtime/server.ts` — routes through this module. This is the piece that actually kills the future refactor; the interface below is a thin cap over it.
2. **`AuthProvider` (interface).** The pluggable cap. `OpaqueTokenProvider` delegates session mechanics to `SessionStore` and owns password auth. Future `JwtProvider`/`CognitoProvider` implement the same interface with their own store.

### The port

```ts
interface Principal   { userId: string; displayName?: string; email?: string; roles?: string[] }
interface Session     { token: string; expiresAt?: Date; refreshToken?: string }
type AuthResult = { ok: true; principal: Principal; session: Session } | { ok: false; error: string }

interface AuthProvider {
  // Hot path — "who is this request?" Bearer credential in, principal or null out.
  verify(rawCredential: string): Promise<Principal | null>;

  // Establish identity from local input. anonToken is the pre-login analytics id
  // (see "Anonymous log merge" — gated, NOT a credential).
  authenticate(input: { username: string; password: string; anonToken?: string }): Promise<AuthResult>;

  // Lifecycle. issue() mints a NEW server-side session for an already-known user
  // (used by signup and refresh). It never accepts a client-chosen token value.
  issue(userId: string): Promise<Session>;
  revoke(rawCredential: string): Promise<boolean>;
  revokeAll(userId: string): Promise<number>;
  refresh(rawCredential: string): Promise<Session | null>;
}
```

**Revocation is a hard contract, not a suggestion.** Every provider MUST make `revoke`/`revokeAll` actually invalidate. The opaque provider deletes rows. A stateless `JwtProvider` MUST back these with a server-side denylist (jti → revoked-at, TTL = token lifetime). Documenting this up front is the point: it tells the future implementer that "stateless JWT" still needs a small stateful denylist, so `resetPassword → revokeAll` (a security guarantee) can never silently degrade to a no-op.

**Profile is separate from identity.** `verify()` returns only what authz needs. The `User` GraphQL field resolvers (`zip/finished/complete/started/time`) and the rehash path (`pass`) read the full row via a separate, cached `ctx.loadProfile(userId)` (backed by `findUserByCredential`). No provider smuggles `UserAuthRow` through a `raw` escape hatch, and no second provider is forced into the opaque row shape.

### `OpaqueTokenProvider` (default)

| Method | Backed by (`SessionStore` unless noted) |
|---|---|
| `verify` | `SessionStore.verifyToken` → `Principal` |
| `authenticate` | `findUserByCredential` + `verifyPassword` (organic MD5→bcrypt rehash stays here) → then `SessionStore.issueToken` |
| `issue` | `SessionStore.issueToken` — **server-generated** `crypto.randomBytes` token |
| `revoke` | `SessionStore.revokeToken` (delete row) |
| `revokeAll` | `SessionStore.revokeAllForUser` (delete by user) |
| `refresh` | `SessionStore.rotateToken` (issue new, delete old) — gated by D2 |

Selected by a factory on `env.AUTH_PROVIDER` (default `opaque`; other branches land in Phase 3).

### Credential extraction (fix the body-sniffing trap)

`ctx.auth` is resolved in `index.ts` from the **`Authorization: Bearer` header only** — one call to `provider.verify()`. Arg-passed tokens are **not** sniffed for `ctx.auth`, because they are not interchangeable: `resetPassword(token)` is a *password-reset* token, `signout(token)`/`tokensignin(token)` are session tokens. Those resolvers keep handling their own argument. The classic queries migrate to sending Bearer in Phase 2, after which the arg path can be retired.

Because `verify()` now potentially runs on more requests, `SessionStore.verifyToken` is cached in Redis (short TTL, invalidated on `revoke`/`revokeAll`) to avoid adding a `bom_user_token` join to every authenticated request.

### Behavior changes (in scope)

1. **Server-side issuance (audit #1, session fixation).** `issue()`/`authenticate` mint the token with `crypto.randomBytes`; a client-supplied value is never bound to an account. The client stores whatever the server returns.
2. **Revoke on reset (audit #4).** `resetPassword` calls `revokeAll(userId)` after updating the hash.

### Anonymous log merge (gated — do not reintroduce the footgun)

Today `upsertTokenAndRelinkLogs` relinks `bom_log WHERE user IN (tokens)`. To keep merging pre-login reading history without re-trusting a client value:
- `anonToken` is accepted **only** on the same `authenticate`/`signup` request that establishes the session — never on an already-authenticated account, never via `verify()`.
- It is stored under a **different** frontend key than the session credential, and is used **solely** to relink `bom_log`, never to resolve identity.
- Preferred hardening: the server signs the anon id on first hand-out so a client can't present an arbitrary/victim id. (Confirm during planning.)

This closes the "attacker seeds a known id → pulls victim's anonymous history into their account" path the review flagged.

### Sandbox mode (dev must keep working)

Dev runs read-only; `runWrite` suppresses the token insert. Server-minted tokens would therefore persist nowhere and break login on the public dev URL. `OpaqueTokenProvider`/`SessionStore` are **sandbox-aware**: when `ctx.sandbox`, `issueToken` echoes back a deterministic in-memory session and `verifyToken` accepts it without a DB round-trip, preserving today's "client holds a working token" behavior on dev. This is written and tested **before** the Phase 1 flip.

## Frontend design

A single `authClient` module (`frontend/webapp/src/models/authClient.js`) owns all token handling now scattered across `App.js`, `BoMOnlineAPI.js`, `GraphQLQueries.js`, the messenger controller, and `Main.js`'s cookie fallback:

```
getCredential()   setSession(session)   clearSession()
signIn(u,pw)      signOut()             attach(request)      getPrincipal()
```

**Designed so an httpOnly-cookie implementation is legal** (audit #3): `attach()` may be a no-op (browser sends the cookie) and `getCredential()` may return nothing. The surface must not assume "JS can read the credential," or it forecloses the cookie move before it starts.

## Full call-site inventory (all 13 + realtime)

Everything below stops touching `bom_user_token` directly and goes through `SessionStore` / `ctx.auth`:

- **Resolvers:** `userauth.ts`, `messenger.ts` (`resolveActingUserId`), `community.ts` (7 refs), `readingplan.ts` (3 refs), `ported_user.ts`, `ported_community.ts`
- **Loaders:** `userauth.ts`, `userprofile.ts`, `studylog.ts`, `queue.ts`, `ported_user.ts`
- **Realtime:** `realtime/server.ts` `verifyToken()` → `SessionStore.verifyToken`, **preserving** the `MESSENGER_BOT_TOKEN` bot path and the junk-token guard. (If a provider is swapped and sockets keep hitting `bom_user_token` directly, every socket user silently degrades to Guest — hence this must route through the same store.)
- **Guard:** `auth/identity.ts` `isValidToken` moves into `SessionStore` as the single junk-token gate.

## Phasing

- **Phase 0 — extract `SessionStore` + wire all 13 files + realtime through it; introduce `AuthProvider`/`OpaqueTokenProvider`/`ctx.auth`.** Behavior-preserving (still binds the client token via the store; sandbox path in place). This is a large but mechanical diff — its risk is breadth, not depth. Given "minimal test coverage" today, Phase 0 **adds** `SessionStore` contract tests + the realtime auth test so "green" means something.
- **Phase 1 — behavior changes:** flip issuance to server-generated (`crypto.randomBytes`); `revokeAll` in `resetPassword`; gated anon-log merge; (D2) `expires` column + expiry.
- **Phase 2 — frontend `authClient`** consolidation; migrate classic queries to Bearer; retire the arg path for `ctx.auth`.
- **Phase 3 — future providers:** `JwtProvider`/`CognitoProvider` (each with its denylist) + redirect login UI + the redirect methods (D1), purely additive.

## Testing

- **Pluggability is proven against TWO providers, not one.** Alongside `OpaqueTokenProvider`, an in-memory `FakeJwtProvider` (denylist-backed) runs the **same** contract suite: `verify/issue/revoke/revokeAll/refresh` round-trips, and specifically that `revokeAll` invalidates a still-unexpired token (the property a naive stateless impl would fail). If both pass the identical suite, the seam is real.
- **Realtime:** a test that `verifyToken` routes through `SessionStore` and that the bot-token path + junk-token rejection still hold.
- **Sandbox:** a test that dev-mode login (issue→verify with writes suppressed) still succeeds — the Phase 1 regression guard.
- **Security regressions get explicit tests:** fresh server token on login ≠ any client-supplied value (#1); reset invalidates all prior tokens (#4); an `anonToken` presented on an already-authenticated request is ignored (footgun guard).
- **Profile split:** `User` field resolvers still return `zip/finished/…` via `ctx.loadProfile`, unchanged externally.

## Out of scope (and why it matters)

Named explicitly because a real IdP swap needs them and this seam does **not** deliver them:
- **Roles/authz** — `Principal.roles` is carried but unused; `requireOperator` does per-channel authz from `messenger_members`, which no session provider knows.
- **Account linking / social** — `bom_user_social` exists; unifying it with an external IdP is separate work.
- **`md5(username)` messenger identity** — assumes local usernames; an external `sub` breaks the derivation.
- **Dormant unsalted-MD5 password tail** (audit #5) — a Cognito migration would force a password-import or reset campaign.
- **`localStorage` → httpOnly cookie** (audit #3) — not done here, but the `authClient` surface is designed not to block it.
