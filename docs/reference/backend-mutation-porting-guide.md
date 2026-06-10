# Green-Field Mutation / Auth Porting Guide

Addendum to `backend-resolver-porting-guide.md` for the **user/auth slice** —
mutations and authenticated reads. **These cannot be regression-suite-tested**
(stateful writes; the suite's sandbox targets suppress writes). You build them
fully and verify by **manual smoke test** + **response-shape A/B against live
legacy (:5005)**. Leave them otherwise untested; a human validates persistence later.

## What's different from the read guide

- **No suite gate.** Do NOT rely on `TARGET=next ... -t`. Your gate is: (a) `tsc`
  clean, (b) the mutation runs without throwing, (c) its response SHAPE matches
  legacy live for the same inputs (values like tokens/timestamps will differ).
- **Writes go through `runWrite(ctx, builder)`** (`src/data/writes.ts`) — never call
  `.execute()` on an insert/update/delete directly. Under `env.SANDBOX` (dev), writes
  are suppressed and return `{executed:false, rows:[]}`; the mutation must still return a
  realistic response. On a prod-like target it executes. This is the Kysely analog of
  legacy `sandboxMode.ts`.
- **Context now carries `ctx.db` (writable Kysely), `ctx.ip`, `ctx.sandbox`.**

## Shared infra already built (use it, don't re-implement)

- `src/auth/password.ts` — `hashPassword`, `verifyPassword` (bcrypt + legacy-MD5
  dual-verify), `needsRehash`. Organic migration: on a successful signin where
  `needsRehash(storedHash)`, rehash to bcrypt via `runWrite`. **Do not** rehash dormant
  accounts otherwise.
- `src/auth/identity.ts` — `md5`, `cleanUsername(username,email)` (**email prefix wins**
  — a real constraint), `genUserAvatar(hash)`.
- `src/auth/sendbirdShim.ts` — `sendbird.loadUser/createUser` returning the gutted social
  shim shape that legacy emits when `MESSENGER_ENABLED=false`. The `social` field on
  signin/signup responses uses this.
- `ctx.loaders.userByToken.load(token)` — `{token,user,email,name,zip,finished,complete,
  started,time,pass}` or null. The acting-user resolver for every authed op.

## The surface (this slice)

Query/Mutation split is a legacy quirk — `signin`/`tokensignin` are **Query** (the
frontend sends them as query ops); the rest are **Mutation**. Both live in the same
domain files (the merge unions Query and Mutation maps).

| Field | Map | Legacy (`src/resolvers/BomUser.ts`) | Notes |
|---|---|---|---|
| `signin` | Query | :99 + `services/AuthService.ts` | dual-verify, rehash, upsert `bom_user_token`, relink `bom_log`, return SignIn{user,social} |
| `tokensignin` | Query | :179 | look up user by token, return SignIn |
| `signup` | Mutation | :395 | `cleanUsername`, bcrypt hash, create `bom_user`, token upsert, gravatar-or-avatar, dup → `msg: error code` |
| `signout` | Mutation | :382 | delete the token row; return Boolean |
| `editProfile` | Mutation | :478 | update name/email/zip by token; return User |
| `changePassword` | Mutation | :523 | bcrypt-hash new pass; reject if same as current bcrypt; return Boolean |
| `uploadProfileImage` | Mutation | :506 | store avatar by user md5; return Boolean (image sink may be a no-op under sandbox) |
| `log` | Mutation | :561 | insert `bom_log` row + progress scoring; return LogResult{logged,progress} |
| `shortlink` (setShortLink) | Mutation | `BomUtils.ts:208` | find-or-create by string; return `{hash}` |

Plus the **User type field resolvers** the responses select: `user/email/name/zip/
bookmark/complete/started/time/finished` (scalars off the row), `social` (shim),
`progress` (ProgressScore — port the scorer if your response selects it), `networks`
(parked/empty unless data), `history`.

**Parked (do NOT build):** `socialsignin` (third-party OAuth), all Sendbird group
mutations (`joinGroup`, `addBot`, …). Leave their resolvers absent.

## Manual smoke protocol (per mutation)

1. Boot your port: `cd backend && PORT=<port> SANDBOX=1 npx tsx src/index.ts`.
2. Run the mutation with the same body the frontend sends (see
   `frontend/webapp/src/models/GraphQLQueries.js`), e.g.:
   ```bash
   curl -s -X POST http://localhost:<port>/en -H 'Content-Type: application/json' \
     -d '{"query":"mutation{ signout(token:\"sometoken\") }"}'
   ```
   (Mutations need the `mutation{…}` keyword; signin/tokensignin are plain `{…}` queries.)
3. Diff the response SHAPE against legacy live (:5005) with the same query. Tokens,
   timestamps, and persisted state will differ under sandbox — that's expected. What must
   match: field presence, types, success/error message strings, null-stripping.
4. With `SANDBOX=1` confirm no write throws and the response is well-formed. Note in your
   report what would persist on a non-sandbox run.

## Gotchas (carried over + auth-specific)

- All the read-guide gotchas still apply (null-strip, key order, error-as-contract,
  case-insensitive collation, string verse_ids, per-call lang).
- **Never** hold the writable db globally; use `ctx.db` per request.
- `signin` is a Query that writes (token upsert) — that write also goes through
  `runWrite`.
- Legacy `signup` dup-user path returns `msg: error.parent?.code` (e.g. `ER_DUP_ENTRY`) —
  replicate the message; the regression baseline pinned exactly that.
- `cleanUsername` forces username = email local-part when email present.
- Bcrypt is slow by design (~12 rounds); fine for auth, don't batch-hash.
- Progress scoring (`scoreSlugsfromUserInfo`, `src/resolvers/lib.ts`) is heavy — only port
  it if a response you own selects `User.progress` / `progress`. Coordinate: if two
  domains need it, put it in core. Flag it in your report rather than duplicating.

## Report format

Per field: Status (DONE | DONE_WITH_CONCERNS | BLOCKED), what you built, the manual smoke
command + observed response, shape-match vs legacy (y/n + what differs), files changed
(your two domain files only), and what would persist on a real (non-sandbox) run.
