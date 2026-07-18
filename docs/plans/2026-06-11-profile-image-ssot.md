# Profile Image SSoT Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every surface that shows a user's avatar gets it from one resolution path — `messenger_users.profile_url`, asset-verified — so signin can never shadow a real photo with a generated one.

**Architecture:** The green-field messaging layer (`backend/src/messaging/users.ts getUser`) already IS the source of truth: stored `profile_url` passes through, NULL derives `{base}/profiles/<md5>.jpg` and asset-verifies it via `avatarAssets`, missing assets fall back to the deterministic dicebear. The bug (docs/bugs/2026-06-11-profile-image-no-ssot.md) is that the password/token signin path bypasses this and returns `genUserAvatar(hashed_id)` unconditionally. Fix = make signin delegate to the messaging layer, stop persisting generated URLs, and guard against dead legacy hosts stored in the data.

**Tech Stack:** TypeScript (backend/ green-field), Kysely + live read-only MySQL in tests, vitest. Frontend: CRA React 17.

**Context the executor needs:**
- Repo root: `/Users/kckern/Documents/GitHub/BookofMormonOnline`. All backend work in `backend/` (green-field). Do NOT touch the legacy `/src` backend — it is being replaced wholesale.
- Tests run against the live DB read-only: `cd backend && npx vitest run <file>`. Needs `backend/.env` (gitignored) with MYSQL_* reader creds — already present on this machine.
- `SANDBOX=1` suppresses writes in dev; write paths must go through `runWrite` (existing pattern).
- Prior art to mirror: `shouldRefreshStoredAvatar` in `backend/src/messaging/avatarAssets.ts` (pure policy fn + thin DB wrapper) and its tests in `backend/test/messaging/avatarAssets.test.ts`.
- The social-provider sign-in path was already fixed (commit 728aab2, `socialsignin.ts refreshMessengerAvatar`). This plan covers the remaining password/token paths + read-side guards.
- Verified failing behavior to beat (live, staff account `fd1bfdfce58c2f8523c1bb067f705668`): `signin.social.profile_url` → dicebear URL while `messengerUser(...).profile_url` → `https://assets.bookofmormon.online/profiles/fd1bf….jpg`.

---

### Task 1: `resolveSigninAvatar` — one function signin asks for an avatar

**Files:**
- Modify: `backend/src/messaging/users.ts` (add export at end of user-read section, after `getUsers`)
- Test: `backend/test/messaging/users.test.ts` (append describe block)

**Step 1: Write the failing test**

Append to `backend/test/messaging/users.test.ts` (match the file's existing imports/db setup — it already imports `getDb` and user functions; add `resolveSigninAvatar` to the import from `../../src/messaging/users.js` and `generateAvatarUrl` from `../../src/messaging/avatarAssets.js`):

```ts
describe('resolveSigninAvatar', () => {
  it('returns the messenger profile_url for a user with a stored avatar', async () => {
    // Discover any row with an explicit stored avatar (upload/seed).
    const row = await db
      .selectFrom('messenger_users')
      .select(['user_id', 'profile_url'])
      .where('profile_url', 'like', 'https://assets.bookofmormon.online/%')
      .executeTakeFirst();
    if (!row) return; // seed drift — nothing to assert against
    const url = await resolveSigninAvatar(db, row.user_id);
    expect(url).toBe(row.profile_url);
  });

  it('falls back to the deterministic dicebear for an unknown user_id', async () => {
    const ghost = 'ffffffffffffffffffffffffffffffff';
    const url = await resolveSigninAvatar(db, ghost);
    expect(url).toBe(generateAvatarUrl(ghost));
  });
});
```

**Step 2: Run it — must fail on a missing export**

Run: `cd backend && npx vitest run test/messaging/users.test.ts`
Expected: FAIL — `resolveSigninAvatar` is not exported / not a function.

**Step 3: Implement**

In `backend/src/messaging/users.ts`, after `getUsers` (~line 160), add (import `generateAvatarUrl` from `./avatarAssets.js` at top):

```ts
/**
 * Avatar for a sign-in response — the ONE answer for "what picture does this
 * user have". Delegates to getUser (stored profile_url → asset-verified
 * derived URL → dicebear); a user with no messenger row yet gets the same
 * deterministic dicebear the frontend would draw.
 * Replaces ad-hoc genUserAvatar() calls in signin/tokensignin
 * (docs/bugs/2026-06-11-profile-image-no-ssot.md).
 */
export async function resolveSigninAvatar(
  db: Kysely<DB>,
  userId: string,
): Promise<string> {
  const user = await getUser(db, userId);
  return user?.profile_url || generateAvatarUrl(userId);
}
```

**Step 4: Run — both new tests pass, file stays green**

Run: `cd backend && npx vitest run test/messaging/users.test.ts`
Expected: PASS (all).

**Step 5: Commit**

```bash
git add backend/src/messaging/users.ts backend/test/messaging/users.test.ts
git commit -m "feat(avatars): resolveSigninAvatar — canonical avatar lookup for sign-in"
```

---

### Task 2: password signin returns the canonical avatar

**Files:**
- Modify: `backend/src/data/loaders/userauth.ts` (~line 303 inside `doSignin`)

The line today:

```ts
const social = sendbird.loadUser(hashed_id, user.name ?? undefined, genUserAvatar(hashed_id));
```

**Step 1: Change it to**

```ts
const social = sendbird.loadUser(hashed_id, user.name ?? undefined, await resolveSigninAvatar(ctx.db, hashed_id));
```

Add the import at top: `import { resolveSigninAvatar } from '../../messaging/users.js';`
(`doSignin` receives `ctx` — confirm the variable holding the Kysely instance in that scope; the file uses `ctx.db` elsewhere.)

Note on TDD: `doSignin` needs live credentials, so the behavior lock lives in Task 1's unit tests + Task 4's gated e2e. This task is a one-line delegation to the tested helper.

**Step 2: Typecheck + full file's suites**

Run: `cd backend && npx tsc --noEmit && npx vitest run test/graphql/mutations.test.ts test/messaging/users.test.ts`
Expected: clean compile, all PASS.

**Step 3: Commit**

```bash
git add backend/src/data/loaders/userauth.ts
git commit -m "fix(auth): password signin serves the canonical avatar, not a fresh dicebear"
```

---

### Task 3: tokensignin — canonical avatar; stop persisting generated URLs

**Files:**
- Modify: `backend/src/graphql/resolvers/userauth.ts` (~lines 45–77, `tokensignin`)

Today it (a) computes `const avatar = genUserAvatar(hashed_id)`, (b) inserts a missing messenger row with `profile_url: avatar`, (c) returns `sendbird.loadUser(hashed_id, name, avatar)`.

**Step 1: Change the provision insert to persist NULL, and resolve the returned avatar**

```ts
const hashed_id = md5(user.user);

// Onboarding: provision the messenger identity on sign-in (FK target for
// members/messages/reactions). profile_url stays NULL — generated avatars
// are never persisted; the read path (getUser → avatarAssets) derives and
// verifies on demand, so an S3 upload or social refresh wins automatically.
const hasMessengerRow = await ctx.db
  .selectFrom('messenger_users')
  .select('user_id')
  .where('user_id', '=', hashed_id)
  .executeTakeFirst();
if (!hasMessengerRow) {
  await runWrite(
    ctx,
    ctx.db.insertInto('messenger_users').values({
      user_id: hashed_id,
      bom_user_id: user.user,
      nickname: user.name ?? user.user,
      profile_url: null,
      is_bot: 0,
    }) as Parameters<typeof runWrite>[1],
  );
}

const social = sendbird.loadUser(
  hashed_id,
  user.name ?? undefined,
  await resolveSigninAvatar(ctx.db, hashed_id),
);
```

Imports: add `resolveSigninAvatar` from `'../../messaging/users.js'`; remove `genUserAvatar` from the loader import **only if** nothing else in the file still uses it (grep first: `grep -n genUserAvatar backend/src/graphql/resolvers/userauth.ts`).

Check `codegen/db.ts` allows `profile_url: null` on insert (the column is nullable — "Humans' messenger_users.profile_url is NULL" per users.ts comment); if codegen demands `string | null` this is already fine.

**Step 2: Typecheck + suites**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: clean, 169+ tests pass (count grows with Task 1's additions).

**Step 3: Commit**

```bash
git add backend/src/graphql/resolvers/userauth.ts
git commit -m "fix(auth): tokensignin uses canonical avatar; provision rows persist NULL profile_url"
```

---

### Task 4: gated e2e — tokensignin agrees with messengerUser

**Files:**
- Modify: `backend/test/messaging/community-graphql-auth.test.ts` (this is the token-gated suite — it already skips when `MESSENGER_TEST_TOKEN` is unset; follow its exec/yoga pattern)

**Step 1: Write the failing-by-construction test**

```ts
describe('tokensignin avatar SSoT', () => {
  it('social.profile_url equals the messenger record for the same user', async () => {
    const data = await exec(
      `query ($t: String) {
         tokensignin(token: $t) { isSuccess social { user_id profile_url } }
       }`,
      { t: TOKEN },
    );
    const signin = data['tokensignin'] as Record<string, any>;
    expect(signin['isSuccess']).toBe(true);
    const social = signin['social'] as Record<string, string>;
    const userData = await exec(
      `query ($id: String!) { messengerUser(userId: $id) { profile_url } }`,
      { id: social['user_id'] },
    );
    const stored = (userData['messengerUser'] as Record<string, string>)['profile_url'];
    expect(social['profile_url']).toBe(stored);
  });
});
```

Adapt names (`exec`, `TOKEN`, skip-guard) to what the file actually uses — read it first; the suite has an established `describe.skipIf(!token)` or equivalent.

**Step 2: Run gated**

Run: `cd backend && MESSENGER_TEST_TOKEN=claude-verify-test npx vitest run test/messaging/community-graphql-auth.test.ts`
(`claude-verify-test` is a live token for the staff beta account, registered in dev's `bom_user_token` on 2026-06-11.)
Expected: PASS after Tasks 2–3. To watch it fail meaningfully first, run it on the pre-Task-2 checkout (`git stash` the impl, run, unstash) — the dicebear-vs-assets mismatch is exactly the recorded bug. Without the env var: skipped, suite stays green in CI.

**Step 3: Commit**

```bash
git add backend/test/messaging/community-graphql-auth.test.ts
git commit -m "test(auth): tokensignin avatar must match the messenger record (gated)"
```

---

### Task 5: read-side guard — never emit dead-host avatar URLs

`messenger_users.profile_url` still stores `https://avatars.dicebear.com/api/…` URLs (dicebear v1 host, HTTP **410 Gone** since 2023) on legacy rows. Stored values pass through `toUserDTO` untouched, so the API emits dead image URLs (seen on the StudyGroupBar). Treat dead-host stored values as absent so the derivation+verify path replaces them.

**Files:**
- Modify: `backend/src/messaging/avatarAssets.ts` (pure predicate)
- Modify: `backend/src/messaging/users.ts` (apply where raw rows are fetched)
- Test: `backend/test/messaging/avatarAssets.test.ts`, `backend/test/messaging/users.test.ts`

**Step 1: Write the failing pure test** (avatarAssets.test.ts)

```ts
describe('isDeadAvatarHost', () => {
  it('flags the retired dicebear v1 host', () => {
    expect(isDeadAvatarHost('https://avatars.dicebear.com/api/female/abc.svg')).toBe(true);
  });
  it('passes current hosts through', () => {
    expect(isDeadAvatarHost('https://assets.bookofmormon.online/profiles/x.jpg')).toBe(false);
    expect(isDeadAvatarHost('https://api.dicebear.com/7.x/thumbs/svg?seed=x')).toBe(false);
    expect(isDeadAvatarHost(null)).toBe(false);
    expect(isDeadAvatarHost('not a url')).toBe(false);
  });
});
```

**Step 2: Run — fails on missing export.** `cd backend && npx vitest run test/messaging/avatarAssets.test.ts`

**Step 3: Implement predicate** (avatarAssets.ts)

```ts
/** Hosts that no longer serve images (dicebear v1 returns HTTP 410). Stored
 *  profile_url values on these hosts are treated as absent by the read path. */
const DEAD_AVATAR_HOSTS = new Set(['avatars.dicebear.com']);

export function isDeadAvatarHost(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return DEAD_AVATAR_HOSTS.has(new URL(url).host);
  } catch {
    return false;
  }
}
```

**Step 4: Run — passes.** Then write the failing integration test (users.test.ts):

```ts
describe('dead-host avatar guard', () => {
  it('getUser never returns an avatars.dicebear.com URL', async () => {
    const legacy = await db
      .selectFrom('messenger_users')
      .select(['user_id'])
      .where('profile_url', 'like', 'https://avatars.dicebear.com/%')
      .executeTakeFirst();
    if (!legacy) return; // data already cleaned — guard is moot
    const dto = await getUser(db, legacy.user_id);
    expect(dto?.profile_url ?? '').not.toContain('avatars.dicebear.com');
  });
});
```

Run: fails (stored value passes through today; the seed has such rows — 'Cindy Cunningham' et al.).

**Step 5: Apply the guard in `users.ts`**

In each user-read query in `backend/src/messaging/users.ts` that yields `RawUser` rows (`getUser`, `getUsers`, `listUsers`, `listBotUsers` — grep `selectFrom('messenger_users')` in the file), null out dead stored values right after fetch, BEFORE `toUserDTO`/`verifyDerivedAvatars` (both key off `row.profile_url`):

```ts
if (isDeadAvatarHost(row.profile_url)) row.profile_url = null;
```

For array results: `rows.forEach((r) => { if (isDeadAvatarHost(r.profile_url)) r.profile_url = null; });`
Prefer one tiny helper in users.ts (`scrubDeadAvatars(rows)`) over four copies. Import `isDeadAvatarHost` from `./avatarAssets.js`.

**Step 6: Run everything.** `cd backend && npx tsc --noEmit && npx vitest run` → all green.

**Step 7: Commit**

```bash
git add backend/src/messaging/avatarAssets.ts backend/src/messaging/users.ts \
        backend/test/messaging/avatarAssets.test.ts backend/test/messaging/users.test.ts
git commit -m "fix(avatars): treat dead-host (dicebear v1, HTTP 410) stored URLs as absent"
```

---

### Task 6: frontend — one avatar generator, not two

`frontend/webapp/src/models/Utils.js genUserAvatar` (lines ~66–96) duplicates `frontend/webapp/src/components/UserAvatar.js generateAvatarUrl` body-for-body. Duplication invites drift (the backend port's doc comment says "Keep the two in sync" — make that one).

**Files:**
- Modify: `frontend/webapp/src/models/Utils.js`

**Step 1: Replace the duplicated body with a re-export**

Delete the `genUserAvatar` function body in Utils.js and replace with:

```js
import { generateAvatarUrl } from "src/components/UserAvatar";

// Single avatar generator — canonical implementation lives in
// components/UserAvatar.js (mirrored by backend/src/messaging/avatarAssets.ts).
export const genUserAvatar = generateAvatarUrl;
```

Place the import with the other imports at the top of Utils.js. **Check for import cycles first**: `grep -n "from .*Utils" frontend/webapp/src/components/UserAvatar.js` — UserAvatar imports `md5hash` from Utils, so a top-level cycle exists. CRA/webpack tolerates cycles for function declarations but `export const` + cycle can hit TDZ. If `npm start` logs a TDZ/undefined error, fall back to a lazy wrapper:

```js
export function genUserAvatar(user_id) {
  return generateAvatarUrl(user_id);
}
```

(Function declaration + cycle is safe — it's hoisted and only called at runtime.) Prefer the function-wrapper form from the start; it is cycle-proof.

**Step 2: Verify compile + callers**

Run: `grep -rn "genUserAvatar" frontend/webapp/src --include="*.js"` — confirm only Utils.js defines it and existing callers (`breakCache`, `tokenImage`) still resolve.
Run: `cd frontend/webapp && REACT_APP_LOCAL_BACKEND=true BROWSER=none npm start` → "webpack compiled" with no NEW warnings/errors (19 pre-existing warnings are baseline). Ctrl-C after confirming.

**Step 3: Commit**

```bash
git add frontend/webapp/src/models/Utils.js
git commit -m "refactor(avatars): single frontend avatar generator (Utils delegates to UserAvatar)"
```

---

### Task 7: runtime verification + docs + push

**Step 1: Verify at the surface** (recipe proven on 2026-06-11; scripts in `/tmp/test_botplugin4.py` show the pattern):

1. `cd backend && npm run dev` (port 5006) and `cd frontend/webapp && REACT_APP_LOCAL_BACKEND=true BROWSER=none PORT=3000 npm start`, both backgrounded.
2. Playwright (Python, `/opt/homebrew/opt/python@3.14/bin/python3.14`): open `http://localhost:3000`, `localStorage.setItem('token','claude-verify-test')`, reload, wait for sidebar text `Staff`.
   (Login form writes don't persist locally — SANDBOX + reader DB user — hence the injected pre-registered token.)
3. Assert the sidebar `UserAvatar` img src is `https://assets.bookofmormon.online/profiles/fd1bfdfce58c2f8523c1bb067f705668.jpg` — the real photo — NOT `api.dicebear.com`. Screenshot it.
4. Kill both servers.

**Step 2: Update the bug doc** — append a "## Fix" section to `docs/bugs/2026-06-11-profile-image-no-ssot.md` mirroring the style of the botplugin doc's fix section: what changed per layer, the verification evidence, and what remains for the private workspace (rewriting persisted dead-host URLs in bulk is data cleanup; the read guard makes it cosmetic).

**Step 3: Push**

```bash
git pull --ff-only   # dev moves fast today; rebase if needed
git push origin dev
```

---

## Out of scope (deliberate)

- **Legacy `/src` backend** — being replaced; its signin/genUserAvatar copies die with it.
- **`backend/src/auth/identity.ts genUserAvatar`** — byte-parity port pinned by baselines; signup's gravatar-or-dicebear write-time choice (`resolveAvatarUrl`) is a different policy decision and currently fine. Don't merge generators across the parity boundary.
- **Bulk rewrite of stored dead-host URLs** — data migration; SQL belongs in the private workspace repo. The Task 5 read guard makes the API correct meanwhile.
- **`StudyGroupSelect.js` initials generator** — group initials, a different feature, not a user avatar.
