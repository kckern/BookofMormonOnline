# Auth Provider Abstraction — Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract every `bom_user_token` access into one concrete `SessionStore` module, introduce a thin pluggable `AuthProvider` cap over it (proven against two independent providers), and resolve the acting principal once into `ctx.auth` — a behavior-preserving refactor that unblocks the Phase 1 security fixes.

**Architecture:** Today 13 backend files hand-write the same `bom_user_token ⋈ bom_user → username` query, plus a second auth entry point in `realtime/server.ts`. This phase funnels all of them through `backend/src/auth/sessionStore.ts`. `AuthProvider`/`OpaqueTokenProvider` wrap the store; a `FakeJwtProvider` exists only to run the same contract suite and prove the seam is real. **No live behavior changes** — signin/signup keep binding the client-supplied token via the store; server-side issuance and reset-revocation land in the Phase 1 plan.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Kysely over MySQL, Vitest (`vitest run`), graphql-yoga context.

**Source of truth:** `docs/specs/2026-08-08-auth-provider-abstraction.md`. This plan implements the Phase 0 slice only.

---

## Scope & sequencing note

This plan is **read-path consolidation + the seam**, deliberately behavior-preserving:

- **In this plan:** `SessionStore` (verify/resolveUsername/bindToken/revokeToken/revokeAllForUser/issueToken), the `AuthProvider` interface + `OpaqueTokenProvider` + `FakeJwtProvider` + factory + contract suite, `ctx.auth`/`ctx.loadProfile`, and routing all 13 files + realtime through the store. `issueToken` (server-mint) is *implemented and contract-tested* but not yet called by any resolver.
- **Deferred to the Phase 1 plan:** switching `signin`/`signup` to `provider.authenticate` + server-minted `issue()`, `resetPassword → revokeAll`, sandbox-aware issuance, the `expires` column, and the gated anon-log merge. Those are the observable behavior changes.

This split is what keeps "Phase 0 = tests stay green" honest: the live app still binds the client token exactly as it does today.

## File structure

**Create:**
- `backend/src/auth/sessionStore.ts` — the single home for `bom_user_token` access + `Principal`/`Session` types.
- `backend/src/auth/authProvider.ts` — the `AuthProvider` interface, `NotSupportedError`, `makeAuthProvider` factory.
- `backend/src/auth/providers/opaqueTokenProvider.ts` — default provider, delegates to `sessionStore`.
- `backend/src/auth/providers/fakeJwtProvider.ts` — in-memory denylist provider, test-only conformance.
- `backend/test/auth/sessionStore.test.ts` — live-gated store tests.
- `backend/test/auth/authProvider.contract.ts` — the shared contract suite (a function, imported by the two provider tests).
- `backend/test/auth/opaqueTokenProvider.test.ts` — runs the contract suite against `OpaqueTokenProvider` (live-gated).
- `backend/test/auth/fakeJwtProvider.test.ts` — runs the contract suite against `FakeJwtProvider` (pure, always runs).
- `backend/test/auth/no-direct-token-access.test.ts` — guard-rail: no `bom_user_token` string outside `sessionStore.ts`.

**Modify (route through the store):**
- `backend/src/graphql/context.ts` — add `auth`/`loadProfile` to `AppContext` + `buildContext`.
- `backend/src/index.ts` — resolve `ctx.auth` from the Bearer header (already extracted).
- `backend/src/graphql/resolvers/userauth.ts`, `.../messenger.ts`, `.../community.ts`, `.../ported_community.ts`, `.../readingplan.ts`, `.../ported_user.ts`
- `backend/src/data/loaders/userauth.ts`, `.../userprofile.ts`, `.../studylog.ts`, `.../queue.ts`, `.../ported_user.ts`
- `backend/src/realtime/server.ts`
- `backend/src/auth/identity.ts` — `isValidToken` is re-exported from `sessionStore` (single gate); leave the definition here, import it into the store.

---

## Task 1: `SessionStore` read path (`verifyToken`, `resolveUsername`)

**Files:**
- Create: `backend/src/auth/sessionStore.ts`
- Test: `backend/test/auth/sessionStore.test.ts`

- [ ] **Step 1: Write the module (read path only)**

```ts
// backend/src/auth/sessionStore.ts
import { randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { runWrite } from '../data/writes.js';
import { isValidToken } from './identity.js';

export { isValidToken };

export interface Principal {
  userId: string;            // bom_user.user (the username)
  displayName?: string;
  email?: string;
  roles?: string[];
}
export interface Session {
  token: string;
  expiresAt?: Date;
  refreshToken?: string;
}
type WriteCtx = { db: Kysely<DB>; sandbox: boolean };

/** token → Principal (lean identity; NOT the full profile row). */
export async function verifyToken(db: Kysely<DB>, token: string): Promise<Principal | null> {
  if (!isValidToken(token)) return null;
  const row = await db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select(['bom_user.user as user', 'bom_user.name as name', 'bom_user.email as email'])
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  if (!row) return null;
  return { userId: row.user, displayName: row.name ?? undefined, email: row.email ?? undefined };
}

/** token → username, the thin form the many call sites need. */
export async function resolveUsername(db: Kysely<DB>, token: string): Promise<string | null> {
  return (await verifyToken(db, token))?.userId ?? null;
}
```

- [ ] **Step 2: Write the live-gated test**

```ts
// backend/test/auth/sessionStore.test.ts
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { verifyToken, resolveUsername } from '../../src/auth/sessionStore.js';

const TOKEN = process.env['MESSENGER_TEST_TOKEN'] ?? '';
const d = TOKEN ? describe : describe.skip;

let db: Kysely<DB>;
beforeAll(() => {
  db = new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
        port: Number(process.env['MYSQL_PORT'] ?? 3306),
        database: process.env['MYSQL_DB'] ?? 'bom_prd',
        user: process.env['MYSQL_USER'] ?? 'reader',
        password: process.env['MYSQL_PASSWORD'] ?? '',
      }),
    }),
  });
});
afterAll(async () => { await db?.destroy(); });

d('sessionStore read path', () => {
  it('resolves a valid token to a username', async () => {
    expect(await resolveUsername(db, TOKEN)).toBeTruthy();
  });
  it('returns a Principal with userId for a valid token', async () => {
    const p = await verifyToken(db, TOKEN);
    expect(p?.userId).toBeTruthy();
  });
  it('rejects junk tokens without a DB hit', async () => {
    expect(await verifyToken(db, 'null')).toBeNull();
    expect(await resolveUsername(db, '')).toBeNull();
  });
  it('returns null for an unknown token', async () => {
    expect(await verifyToken(db, 'deadbeef'.repeat(4))).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `cd backend && npx vitest run test/auth/sessionStore.test.ts`
Expected: PASS (or SKIP if `MESSENGER_TEST_TOKEN` is unset — the junk-token assertions still run under the live block only, so with no token the whole block skips; that's acceptable for Phase 0).

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/sessionStore.ts backend/test/auth/sessionStore.test.ts
git commit -m "feat(auth): SessionStore read path (verifyToken/resolveUsername)"
```

---

## Task 2: `SessionStore` write path (`bindToken`, `revokeToken`, `revokeAllForUser`, `issueToken`)

**Files:**
- Modify: `backend/src/auth/sessionStore.ts`

- [ ] **Step 1: Append the write helpers**

```ts
// --- append to backend/src/auth/sessionStore.ts ---

/**
 * Phase-0 behavior-preserving bind: verbatim extraction of the legacy
 * upsertTokenAndRelinkLogs — upsert the (client-supplied) token, then relink
 * bom_log rows for all of this user's tokens. Kept so signin/signup behave
 * exactly as today until Phase 1 flips to server-minted issuance.
 */
export async function bindToken(ctx: WriteCtx, token: string, username: string): Promise<void> {
  if (!isValidToken(token)) return;
  await runWrite(
    ctx,
    ctx.db.insertInto('bom_user_token').values({ token, user: username })
      .onDuplicateKeyUpdate({ user: username }) as Parameters<typeof runWrite>[1],
  );
  const tokenRows = await ctx.db.selectFrom('bom_user_token').select('token').where('user', '=', username).execute();
  const tokens = tokenRows.map((r) => r.token);
  if (tokens.length > 0) {
    await runWrite(
      ctx,
      ctx.db.updateTable('bom_log').set({ user: username }).where('user', 'in', tokens) as Parameters<typeof runWrite>[1],
    );
  }
}

/** Server-minted session. Implemented + tested now; wired into resolvers in Phase 1. */
export async function issueToken(ctx: WriteCtx, username: string): Promise<Session> {
  const token = randomBytes(32).toString('hex');
  await runWrite(
    ctx,
    ctx.db.insertInto('bom_user_token').values({ token, user: username })
      .onDuplicateKeyUpdate({ user: username }) as Parameters<typeof runWrite>[1],
  );
  return { token };
}

export async function revokeToken(ctx: WriteCtx, token: string): Promise<boolean> {
  if (!isValidToken(token)) return false;
  const res = await runWrite(
    ctx,
    ctx.db.deleteFrom('bom_user_token').where('token', '=', token) as Parameters<typeof runWrite>[1],
  );
  if (!res.executed) return false;
  const rows = res.rows as unknown as Array<{ numDeletedRows?: bigint }>;
  return rows.length > 0 && (rows[0]?.numDeletedRows ?? 0n) >= 1n;
}

export async function revokeAllForUser(ctx: WriteCtx, username: string): Promise<number> {
  const res = await runWrite(
    ctx,
    ctx.db.deleteFrom('bom_user_token').where('user', '=', username) as Parameters<typeof runWrite>[1],
  );
  if (!res.executed) return 0;
  const rows = res.rows as unknown as Array<{ numDeletedRows?: bigint }>;
  return Number(rows[0]?.numDeletedRows ?? 0n);
}
```

- [ ] **Step 2: Type-check compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS (no new type errors from `sessionStore.ts`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/auth/sessionStore.ts
git commit -m "feat(auth): SessionStore write path (bind/revoke/revokeAll/issue)"
```

---

## Task 3: `AuthProvider` interface + `OpaqueTokenProvider` + factory

**Files:**
- Create: `backend/src/auth/authProvider.ts`, `backend/src/auth/providers/opaqueTokenProvider.ts`

- [ ] **Step 1: Write the interface + factory**

```ts
// backend/src/auth/authProvider.ts
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { Principal, Session } from './sessionStore.js';
import { env } from '../config/env.js';
import { OpaqueTokenProvider } from './providers/opaqueTokenProvider.js';

export type { Principal, Session };
export type AuthResult =
  | { ok: true; principal: Principal; session: Session }
  | { ok: false; error: string };

export class NotSupportedError extends Error {
  constructor(method: string) { super(`AuthProvider.${method} not supported by this provider`); }
}

export interface AuthProvider {
  verify(rawCredential: string): Promise<Principal | null>;
  authenticate(input: { username: string; password: string; anonToken?: string }): Promise<AuthResult>;
  issue(userId: string): Promise<Session>;
  revoke(rawCredential: string): Promise<boolean>;
  revokeAll(userId: string): Promise<number>;
  refresh(rawCredential: string): Promise<Session | null>;
}

/** ctx carries db + sandbox; provider selected by env. Non-opaque branches land in Phase 3. */
export function makeAuthProvider(ctx: { db: Kysely<DB>; sandbox: boolean }): AuthProvider {
  switch (env.AUTH_PROVIDER) {
    case 'opaque':
    default:
      return new OpaqueTokenProvider(ctx);
  }
}
```

- [ ] **Step 2: Write `OpaqueTokenProvider`**

```ts
// backend/src/auth/providers/opaqueTokenProvider.ts
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { AuthProvider, AuthResult } from '../authProvider.js';
import type { Session, Principal } from '../sessionStore.js';
import * as store from '../sessionStore.js';
import { findUserByCredential, maybeRehash } from '../../data/loaders/userauth.js';
import { verifyPassword } from '../password.js';

export class OpaqueTokenProvider implements AuthProvider {
  constructor(private ctx: { db: Kysely<DB>; sandbox: boolean }) {}

  verify(raw: string): Promise<Principal | null> {
    return store.verifyToken(this.ctx.db, raw);
  }

  async authenticate(input: { username: string; password: string; anonToken?: string }): Promise<AuthResult> {
    const user = await findUserByCredential(this.ctx.db, input.username);
    if (!user || !(await verifyPassword(input.password, user.pass))) {
      return { ok: false, error: 'Invalid credentials' };
    }
    await maybeRehash(this.ctx, user.user, input.password, user.pass);
    const session = await this.issue(user.user);
    return { ok: true, principal: { userId: user.user, displayName: user.name ?? undefined, email: user.email ?? undefined }, session };
  }

  issue(userId: string): Promise<Session> { return store.issueToken(this.ctx, userId); }
  revoke(raw: string): Promise<boolean> { return store.revokeToken(this.ctx, raw); }
  revokeAll(userId: string): Promise<number> { return store.revokeAllForUser(this.ctx, userId); }

  async refresh(raw: string): Promise<Session | null> {
    const p = await store.verifyToken(this.ctx.db, raw);
    if (!p) return null;
    const next = await store.issueToken(this.ctx, p.userId);
    await store.revokeToken(this.ctx, raw);
    return next;
  }
}
```

- [ ] **Step 3: Add `AUTH_PROVIDER` to env config**

Modify `backend/src/config/env.ts`: add `AUTH_PROVIDER: (process.env['AUTH_PROVIDER'] ?? 'opaque') as 'opaque' | 'jwt' | 'cognito'` to the exported `env` object (match the file's existing style — read it first and follow the pattern).

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/authProvider.ts backend/src/auth/providers/opaqueTokenProvider.ts backend/src/config/env.ts
git commit -m "feat(auth): AuthProvider interface + OpaqueTokenProvider + factory"
```

---

## Task 4: Prove the seam — contract suite against two providers

**Files:**
- Create: `backend/src/auth/providers/fakeJwtProvider.ts`, `backend/test/auth/authProvider.contract.ts`, `backend/test/auth/fakeJwtProvider.test.ts`

- [ ] **Step 1: Write `FakeJwtProvider` (stateless token + denylist)**

```ts
// backend/src/auth/providers/fakeJwtProvider.ts
// Test-only reference impl: proves the interface is satisfiable by a provider
// whose internals are NOTHING like the opaque store (no bom_user_token table).
// "Stateless" JWT + a denylist — exactly the shape a real JwtProvider needs so
// revoke()/revokeAll() are honored. If this passes the SAME contract as the
// opaque provider, the seam is real.
import type { AuthProvider, AuthResult } from '../authProvider.js';
import type { Session, Principal } from '../sessionStore.js';

export class FakeJwtProvider implements AuthProvider {
  private users = new Map<string, string>();      // username → password
  private denylist = new Set<string>();           // revoked jti
  private revokedUsers = new Map<string, number>(); // username → revoked-at (ms)
  private seq = 0;

  seed(username: string, password: string) { this.users.set(username, password); }

  private decode(token: string): { userId: string; jti: string; iat: number } | null {
    try {
      const [userId, jti, iat] = Buffer.from(token, 'base64url').toString('utf8').split('|');
      if (!userId || !jti || !iat) return null;
      return { userId, jti, iat: Number(iat) };
    } catch { return null; }
  }

  async verify(token: string): Promise<Principal | null> {
    const c = this.decode(token);
    if (!c || this.denylist.has(c.jti)) return null;
    const ru = this.revokedUsers.get(c.userId);
    if (ru !== undefined && c.iat <= ru) return null;
    return { userId: c.userId };
  }
  async authenticate(input: { username: string; password: string }): Promise<AuthResult> {
    if (this.users.get(input.username) !== input.password) return { ok: false, error: 'Invalid credentials' };
    return { ok: true, principal: { userId: input.username }, session: await this.issue(input.username) };
  }
  async issue(userId: string): Promise<Session> {
    const jti = `j${this.seq++}`;
    const iat = this.seq; // monotonic stand-in for a timestamp (no Date in this env)
    return { token: Buffer.from(`${userId}|${jti}|${iat}`, 'utf8').toString('base64url') };
  }
  async revoke(token: string): Promise<boolean> {
    const c = this.decode(token);
    if (!c) return false;
    const had = !this.denylist.has(c.jti);
    this.denylist.add(c.jti);
    return had;
  }
  async revokeAll(userId: string): Promise<number> {
    this.revokedUsers.set(userId, this.seq); // everything issued so far is now invalid
    return 1;
  }
  async refresh(token: string): Promise<Session | null> {
    const p = await this.verify(token);
    if (!p) return null;
    await this.revoke(token);
    return this.issue(p.userId);
  }
}
```

- [ ] **Step 2: Write the shared contract suite**

```ts
// backend/test/auth/authProvider.contract.ts
import { expect, it } from 'vitest';
import type { AuthProvider } from '../../src/auth/authProvider.js';

/** Run the identical behavioral contract against any provider. */
export function runAuthProviderContract(
  makeProvider: () => Promise<{ provider: AuthProvider; username: string; password: string }>,
) {
  it('authenticate + verify round-trips a valid credential', async () => {
    const { provider, username, password } = await makeProvider();
    const res = await provider.authenticate({ username, password });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((await provider.verify(res.session.token))?.userId).toBe(username);
  });

  it('rejects a bad password', async () => {
    const { provider, username } = await makeProvider();
    expect((await provider.authenticate({ username, password: 'wrong-xyz' })).ok).toBe(false);
  });

  it('revoke invalidates a single session', async () => {
    const { provider, username, password } = await makeProvider();
    const res = await provider.authenticate({ username, password });
    if (!res.ok) throw new Error('setup');
    await provider.revoke(res.session.token);
    expect(await provider.verify(res.session.token)).toBeNull();
  });

  it('revokeAll invalidates a still-unexpired session (the property a naive stateless impl fails)', async () => {
    const { provider, username, password } = await makeProvider();
    const res = await provider.authenticate({ username, password });
    if (!res.ok) throw new Error('setup');
    await provider.revokeAll(username);
    expect(await provider.verify(res.session.token)).toBeNull();
  });
}
```

- [ ] **Step 3: Run the contract against `FakeJwtProvider`**

```ts
// backend/test/auth/fakeJwtProvider.test.ts
import { describe } from 'vitest';
import { FakeJwtProvider } from '../../src/auth/providers/fakeJwtProvider.js';
import { runAuthProviderContract } from './authProvider.contract.js';

describe('AuthProvider contract — FakeJwtProvider', () => {
  runAuthProviderContract(async () => {
    const provider = new FakeJwtProvider();
    provider.seed('alice', 'pw-alice');
    return { provider, username: 'alice', password: 'pw-alice' };
  });
});
```

- [ ] **Step 4: Run**

Run: `cd backend && npx vitest run test/auth/fakeJwtProvider.test.ts`
Expected: PASS (4 tests). This proves the interface + contract are internally coherent without a DB.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/providers/fakeJwtProvider.ts backend/test/auth/authProvider.contract.ts backend/test/auth/fakeJwtProvider.test.ts
git commit -m "test(auth): AuthProvider contract suite + FakeJwtProvider conformance"
```

---

## Task 5: `OpaqueTokenProvider` conformance (live-gated)

**Files:**
- Create: `backend/test/auth/opaqueTokenProvider.test.ts`

- [ ] **Step 1: Write the live-gated conformance test**

Runs the SAME contract against the real provider. Requires write creds (`MYSQL_WRITE_USER`) so `issue`/`revoke` actually persist; skips otherwise, self-cleans after.

```ts
// backend/test/auth/opaqueTokenProvider.test.ts
import 'dotenv/config';
import { describe, beforeAll, afterAll } from 'vitest';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { OpaqueTokenProvider } from '../../src/auth/providers/opaqueTokenProvider.js';
import { runAuthProviderContract } from './authProvider.contract.js';

const U = process.env['AUTH_TEST_USER'] ?? '';
const P = process.env['AUTH_TEST_PASSWORD'] ?? '';
const canWrite = !!process.env['MYSQL_WRITE_USER'];
const d = U && P && canWrite ? describe : describe.skip;

let db: Kysely<DB>;
beforeAll(() => {
  db = new Kysely<DB>({ dialect: new MysqlDialect({ pool: createPool({
    host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
    port: Number(process.env['MYSQL_PORT'] ?? 3306),
    database: process.env['MYSQL_DB'] ?? 'bom_prd',
    user: process.env['MYSQL_WRITE_USER'],
    password: process.env['MYSQL_WRITE_PASSWORD'] ?? '',
  }) }) });
});
afterAll(async () => {
  // self-clean: drop any tokens the contract minted for the test user
  if (U) await db?.deleteFrom('bom_user_token').where('user', '=', U).execute().catch(() => {});
  await db?.destroy();
});

d('AuthProvider contract — OpaqueTokenProvider (live)', () => {
  runAuthProviderContract(async () => ({
    provider: new OpaqueTokenProvider({ db, sandbox: false }),
    username: U, password: P,
  }));
});
```

- [ ] **Step 2: Run**

Run: `cd backend && npx vitest run test/auth/opaqueTokenProvider.test.ts`
Expected: PASS when `AUTH_TEST_USER`/`AUTH_TEST_PASSWORD`/`MYSQL_WRITE_USER` are set; otherwise SKIP. Both providers passing the identical suite is the Phase 0 "seam is real" gate.

- [ ] **Step 3: Commit**

```bash
git add backend/test/auth/opaqueTokenProvider.test.ts
git commit -m "test(auth): OpaqueTokenProvider passes the shared contract (live-gated)"
```

---

## Task 6: Context — `ctx.auth` + `ctx.loadProfile`

**Files:**
- Modify: `backend/src/graphql/context.ts:47-95`, `backend/src/index.ts:31`

- [ ] **Step 1: Extend `AppContext` and `buildContext`**

In `backend/src/graphql/context.ts`, add to the `AppContext` interface (after `bearerToken`):

```ts
  /** Acting principal resolved once from the Bearer token (null when anonymous). */
  auth: import('../auth/sessionStore.js').Principal | null;
  /** Lazily load the full profile row for a userId (cached per request). */
  loadProfile: (userId: string) => Promise<import('../data/loaders/userauth.js').UserAuthRow | null>;
```

At the top of `context.ts` add imports:

```ts
import { verifyToken } from '../auth/sessionStore.js';
import { findUserByCredential } from '../data/loaders/userauth.js';
```

Change `buildContext` to be async and resolve `auth` once:

```ts
export async function buildContext(db: Kysely<DB>, lang: string, ip = '', bearerToken?: string, ua?: string): Promise<AppContext> {
  // ... existing loaders assembly unchanged ...
  const auth = bearerToken ? await verifyToken(db, bearerToken) : null;
  const profileCache = new Map<string, Promise<UserAuthRow | null>>();
  const loadProfile = (userId: string) => {
    if (!profileCache.has(userId)) profileCache.set(userId, findUserByCredential(db, userId));
    return profileCache.get(userId)!;
  };
  return { lang, sandbox: env.SANDBOX, ip, bearerToken, ua, auth, loadProfile, db, services: { /* unchanged */ }, loaders };
}
```

(Add `import type { UserAuthRow } from '../data/loaders/userauth.js';` for the cache type.)

- [ ] **Step 2: Await `buildContext` in the Yoga wiring**

In `backend/src/index.ts:31`, change:

```ts
  context: ({ lang, ip, bearerToken, ua }) => buildContext(db, lang, ip, bearerToken, ua),
```

to:

```ts
  context: ({ lang, ip, bearerToken, ua }) => buildContext(db, lang, ip, bearerToken, ua),
```

(Yoga already awaits a Promise-returning context factory — no call-site change needed beyond `buildContext` now returning a Promise. Grep for any other `buildContext(` callers, e.g. tests, and add `await`.)

Run: `cd backend && grep -rn "buildContext(" src test`
Expected: update every caller to `await` (the auth tests in `test/messaging/*` construct context — add `await`).

- [ ] **Step 3: Type-check + run existing auth tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run test/messaging/community-graphql-auth.test.ts`
Expected: PASS (context now resolves `auth`; existing behavior unchanged).

- [ ] **Step 4: Commit**

```bash
git add backend/src/graphql/context.ts backend/src/index.ts backend/test
git commit -m "feat(auth): resolve acting principal once into ctx.auth + ctx.loadProfile"
```

---

## Task 7: Route `userauth.ts` (resolver + loader) through the store

**Files:**
- Modify: `backend/src/graphql/resolvers/userauth.ts`, `backend/src/data/loaders/userauth.ts`

- [ ] **Step 1: Delegate the loader helpers to the store**

In `backend/src/data/loaders/userauth.ts`, replace the body of `upsertTokenAndRelinkLogs` (lines 119-156) with a delegation, keeping the exported name for its callers:

```ts
export async function upsertTokenAndRelinkLogs(ctx: { db: Kysely<DB>; sandbox: boolean }, token: string, username: string): Promise<void> {
  await bindToken(ctx, token, username);
}
```

Add `import { bindToken } from '../../auth/sessionStore.js';` at the top. `findUserByToken` stays (it returns the full row for `tokensignin`/`userprogress`); leave it — it is now the ONE place besides the store that reads `bom_user_token`, and Task 12's guard-rail allows it by living behind the store instead. **Move `findUserByToken` into `sessionStore.ts`** as `loadUserRowByToken` and re-export, so the guard-rail holds:

```ts
// in sessionStore.ts — add:
export async function loadUserRowByToken(db: Kysely<DB>, token: string) {
  if (!isValidToken(token)) return null;
  return db.selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select(['bom_user.user as user','bom_user.email as email','bom_user.name as name','bom_user.zip as zip',
             'bom_user.finished as finished','bom_user.complete as complete','bom_user.started as started',
             'bom_user.time as time','bom_user.pass as pass'])
    .where('bom_user_token.token', '=', token).limit(1).executeTakeFirst().then((r) => r ?? null);
}
```

In `loaders/userauth.ts`, replace `findUserByToken`'s body with `return loadUserRowByToken(db, token);` (import it), preserving the export.

- [ ] **Step 2: Point `signout` at the store**

In `backend/src/graphql/resolvers/userauth.ts:146-162`, replace the inline delete with:

```ts
    signout: async (_root, args, ctx: AppContext) => {
      const token = (args.token ?? '') as string;
      return store.revokeToken(ctx, token);
    },
```

Add `import * as store from '../../auth/sessionStore.js';` at the top.

- [ ] **Step 3: Type-check + run**

Run: `cd backend && npx tsc --noEmit && npx vitest run test/auth`
Expected: PASS. Behavior identical (bindToken == old upsert; revokeToken == old delete semantics, now returning `numDeletedRows >= 1`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/graphql/resolvers/userauth.ts backend/src/data/loaders/userauth.ts backend/src/auth/sessionStore.ts
git commit -m "refactor(auth): route userauth resolver+loader through SessionStore"
```

---

## Task 8: Route `messenger.ts` `resolveActingUserId` through `ctx.auth`

**Files:**
- Modify: `backend/src/graphql/resolvers/messenger.ts:44-52`

- [ ] **Step 1: Replace the token join with `ctx.auth`**

The current helper joins `bom_user_token` and returns `md5(username)`. Replace its body:

```ts
async function resolveActingUserId(ctx: AppContext): Promise<string | null> {
  return ctx.auth ? md5(ctx.auth.userId) : null;
}
```

Confirm `md5` is imported in the file (it is used already). Delete the now-unused `bom_user_token` query and any now-unused local `token` extraction inside the helper.

- [ ] **Step 2: Type-check + run messenger auth tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run test/messaging/community-graphql-auth.test.ts`
Expected: PASS — `ctx.auth.userId` is the same username the join produced, so `md5()` yields the same acting id.

- [ ] **Step 3: Commit**

```bash
git add backend/src/graphql/resolvers/messenger.ts
git commit -m "refactor(auth): messenger resolveActingUserId reads ctx.auth"
```

---

## Task 9: Route the remaining token→username call sites

Each of these files hand-writes the identical `bom_user_token ⋈ bom_user → username` (or `→ md5(username)`) query. Replace each with `resolveUsername(db, token)` (then `md5(...)` if the site needs the messenger id). The transformation is the same; the specific site and its post-processing differ.

**Files & exact targets:**
- `backend/src/graphql/resolvers/community.ts:38-41, 56-59` (two helpers; both end in `md5(username)`)
- `backend/src/graphql/resolvers/ported_community.ts:30-33`
- `backend/src/graphql/resolvers/readingplan.ts:27-30`
- `backend/src/graphql/resolvers/ported_user.ts:80` (inline select)
- `backend/src/data/loaders/queue.ts:51-54`
- `backend/src/data/loaders/studylog.ts:80`
- `backend/src/data/loaders/userprofile.ts:32` (joined as `t`)
- `backend/src/data/loaders/ported_user.ts:36, 96-99`

- [ ] **Step 1: Replace each query block with the store call**

Canonical replacement (adapt the variable names already present in each file):

```ts
// BEFORE (representative):
const row = await db.selectFrom('bom_user_token')
  .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
  .select('bom_user.user as user')
  .where('bom_user_token.token', '=', token).executeTakeFirst();
const username = row?.user ?? null;

// AFTER:
import { resolveUsername } from '../../auth/sessionStore.js'; // path adjusts per dir
const username = await resolveUsername(db, token);
```

For sites that returned `md5(username)` (community, ported_community, messenger-style), keep the `md5(...)` wrap around the result. For `userprofile.ts:32` which joins `bom_user_token as t` to fetch a full profile row keyed by token, use `loadUserRowByToken(db, token)` instead and map the fields it already selects. For `ported_user.ts` inline selects, replace with `resolveUsername`/`loadUserRowByToken` as the surrounding code requires.

Work one file at a time; after each file:

- [ ] **Step 2: Type-check after each file**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS after each file's edit (fix import depth `../` vs `../../` per directory).

- [ ] **Step 3: Run the broad suite once all sites are converted**

Run: `cd backend && npx vitest run`
Expected: PASS (no behavior change — same username resolution, now centralized). Note any pre-existing skips/failures unrelated to auth.

- [ ] **Step 4: Commit**

```bash
git add backend/src/graphql/resolvers/community.ts backend/src/graphql/resolvers/ported_community.ts backend/src/graphql/resolvers/readingplan.ts backend/src/graphql/resolvers/ported_user.ts backend/src/data/loaders/queue.ts backend/src/data/loaders/studylog.ts backend/src/data/loaders/userprofile.ts backend/src/data/loaders/ported_user.ts
git commit -m "refactor(auth): route remaining token→username sites through SessionStore"
```

---

## Task 10: Route the WebSocket auth path (`realtime/server.ts`)

**Files:**
- Modify: `backend/src/realtime/server.ts:54-98`

- [ ] **Step 1: Delegate the real-user token check to the store, preserve the bot path**

Keep the `messenger_users` lookup and the `MESSENGER_BOT_TOKEN` bot branch; replace ONLY the Step-3 `bom_user_token` confirmation:

```ts
async function verifyToken(userId: string, token: string): Promise<{ valid: true; bomUserId: string | null } | { valid: false }> {
  try {
    if (!isValidToken(token)) return { valid: false };
    const db = getDb();
    const messengerUser = await db.selectFrom('messenger_users').select(['user_id', 'bom_user_id'])
      .where('user_id', '=', userId).executeTakeFirst();
    if (!messengerUser) return { valid: false };
    const bomUserId = messengerUser.bom_user_id ?? null;

    if (bomUserId === null) { // bot path unchanged
      const botToken = process.env['MESSENGER_BOT_TOKEN'];
      return botToken && token === botToken ? { valid: true, bomUserId: null } : { valid: false };
    }

    // real-user path: the session store owns bom_user_token now.
    const principal = await verifyTokenStore(db, token);
    return principal && principal.userId === bomUserId
      ? { valid: true, bomUserId }
      : { valid: false };
  } catch (err) {
    console.error('[realtime] verifyToken error:', err);
    return { valid: false };
  }
}
```

Add `import { verifyToken as verifyTokenStore } from '../auth/sessionStore.js';` (aliased to avoid clashing with the local `verifyToken`). `isValidToken` is already imported here — if it was imported from `../auth/identity.js`, leave it; it re-exports identically from the store.

- [ ] **Step 2: Type-check + run realtime tests if present**

Run: `cd backend && npx tsc --noEmit && npx vitest run test/messaging`
Expected: PASS. `principal.userId === bomUserId` reproduces the old `(user = bomUserId, token) exists` check exactly (the store confirms the token belongs to that username).

- [ ] **Step 3: Commit**

```bash
git add backend/src/realtime/server.ts
git commit -m "refactor(auth): socket verifyToken confirms via SessionStore (bot path preserved)"
```

---

## Task 11: Guard-rail — no direct `bom_user_token` access outside the store

**Files:**
- Create: `backend/test/auth/no-direct-token-access.test.ts`

- [ ] **Step 1: Write the guard-rail test**

```ts
// backend/test/auth/no-direct-token-access.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

describe('bom_user_token is only accessed via sessionStore', () => {
  it('no src file except sessionStore.ts references bom_user_token', () => {
    const hits = execSync(`grep -rl "bom_user_token" backend/src || true`, { cwd: process.cwd().replace(/\\/backend$/, '') })
      .toString().trim().split('\n').filter(Boolean)
      .filter((f) => !f.endsWith('src/auth/sessionStore.ts'));
    expect(hits, `unexpected direct bom_user_token access:\n${hits.join('\n')}`).toEqual([]);
  });
});
```

(Adjust the `cwd`/path so the grep runs from the repo root regardless of where vitest is invoked; verify by running it.)

- [ ] **Step 2: Run**

Run: `cd backend && npx vitest run test/auth/no-direct-token-access.test.ts`
Expected: PASS — the only remaining reference is `sessionStore.ts`. If it lists other files, route them (they were missed in Tasks 7-10).

- [ ] **Step 3: Full suite + type-check**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: PASS (modulo documented pre-existing skips). This is the Phase 0 done-gate.

- [ ] **Step 4: Commit**

```bash
git add backend/test/auth/no-direct-token-access.test.ts
git commit -m "test(auth): guard-rail — bom_user_token only via SessionStore"
```

---

## Self-review

**Spec coverage (Phase 0 slice):**
- SessionStore concrete module owning all `bom_user_token` access — Tasks 1, 2, 7-11. ✅
- `AuthProvider` interface + `OpaqueTokenProvider` + factory — Task 3. ✅
- Pluggability proven against TWO providers (spec Testing) — Tasks 4-5. ✅
- `ctx.auth` resolved once, Bearer-only extraction (spec "Credential extraction") — Task 6. ✅
- Identity/profile split (`ctx.loadProfile`, no `raw` smuggling) — Task 6. ✅
- Realtime path included, bot path preserved — Task 10. ✅
- Junk-token guard single-gated in the store — Tasks 1, 7 (`loadUserRowByToken`/`revokeToken` all call `isValidToken`). ✅
- Deferred (correctly, per spec Phase 1): server-mint wired into resolvers, `revokeAll` on reset, sandbox-aware issuance, `expires` column, gated anon-log merge, Redis caching of `verify()`. Noted in Scope. ✅

**Placeholder scan:** No "TBD"/"handle edge cases"/uncoded steps — every code step carries the code. The Task 9 canonical-replacement block is intentionally a recipe over 8 mechanically-identical sites with exact file:line targets, not a placeholder.

**Type consistency:** `Principal.userId` (username) is used consistently; `resolveUsername` returns `string | null`; `loadUserRowByToken` returns the `UserAuthRow` shape (9 selected columns matching the original `findUserByToken`); `revokeToken`/`revokeAllForUser` read `numDeletedRows` matching the current `signout` logic; `makeAuthProvider`/`OpaqueTokenProvider` ctx shape (`{db, sandbox}`) matches `runWrite`'s expected ctx.

**Open items surfaced for execution:** env `AUTH_PROVIDER` key name (spec D3) — defaulted to `opaque`; `buildContext` becoming async requires updating every caller (Task 6 Step 2 greps for them).

---

## Next

After Phase 0 lands green, the **Phase 1 plan** covers the behavior changes: switch `signin`/`signup` to `provider.authenticate` + server-minted `issue()`, add `revokeAll` to `resetPassword`, make issuance sandbox-aware, add the `expires` column, and gate the anonymous-log merge.
