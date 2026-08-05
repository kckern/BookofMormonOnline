# Wave 1 — Authorization Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). This FIXES real backend security defects — verify each fix closes the bypass with the cited probe/scenario before moving on.

**Goal:** Close the 4 P0 authorization bypasses + the metadata data-loss defect from the prod audit, by fixing the **two systemic root causes** (client-`userId`-arg trust; write path has no per-action authz) rather than one-off patches.

**Architecture:** Two small helpers do the heavy lifting: `requireSelf(ctx, userId)` (messenger resolvers) and `getMembership(db, channelUrl, userId)` (a joined/banned/role lookup) used by the socket write handlers. Ownership on edit/delete, auth on channel-create, and a metadata *merge* round it out. Every fix is verified against the live backend with `scripts/study/probe.mjs` (GraphQL authz) and `scripts/study.cli.mjs` scenarios (socket authz) — the harnesses that *proved* the bypasses.

**Tech Stack:** TypeScript (graphql-yoga + Kysely), `backend/` greenfield. Runs via `tsx` on dev `:5006` (auto-reloads on save; if not, `systemctl --user restart bom-dev`). Backend tests: `vitest` (`cd backend && npx vitest run <path>`). Adversarial harness: `scripts/study/` (Node).

**Audit source:** `docs/audits/2026-08-05-prod-audit-summary.md` (findings P-1, M-1, M-2, M-3, M-4, M-5, P-2).

---

## File structure

- `backend/src/messaging/members.ts` — **modify.** Add `getMembership()` (single-row role/state/mute lookup) — the write-authz primitive.
- `backend/src/messaging/members.test.ts` (or add to existing `backend/test/messaging/`) — **test.**
- `backend/src/realtime/handlers/message.ts` — **modify.** Membership guard on send/edit/delete + ownership on edit/delete.
- `backend/src/realtime/handlers/reaction.ts` — **modify.** Membership guard on add/remove reaction.
- `backend/src/graphql/resolvers/messenger.ts` — **modify.** `requireSelf` helper (RC#1) applied to updateUser/updateUserMetadata/accept/decline/unreadDMs/myChannels; auth on createChannel; membership gate on messengerMessages.
- `backend/src/messaging/users.ts` — **modify.** `updateUserMetadata` full-replace → merge (P-2).
- `scripts/study/scenarios/authz/` — **use** existing `ban-bypass.yaml`, `edit-others-message.yaml` as regression (expect rejection now).

---

## Task 1: `getMembership` write-authz primitive

**Files:**
- Modify: `backend/src/messaging/members.ts`
- Test: `backend/test/messaging/membership.test.ts` (new)

- [ ] **Step 1: Write the failing test** (mirror the DB setup of an existing `backend/test/messaging/*.test.ts` — `buildWriteDb()` + `itWrite()`; read `messages.test.ts` head for the exact harness). The behavioral assertions:

```typescript
// backend/test/messaging/membership.test.ts  (harness copied from messages.test.ts)
import { describe, expect, beforeAll, afterAll } from 'vitest';
import { getMembership, addUserToChannel, banUserFromChannel } from '../../src/messaging/members.js';
// ... buildWriteDb(), a throwaway channelUrl, and itWrite() as in messages.test.ts ...

describe('getMembership', () => {
  itWrite('returns null for a non-member', async () => {
    expect(await getMembership(db, channelUrl, 'nobody-' + nanoid())).toBeNull();
  });
  itWrite('returns state=joined for a joined member and reflects a ban', async () => {
    const uid = 'gm-' + nanoid();
    await addUserToChannel(db, channelUrl, uid, 'member');
    expect((await getMembership(db, channelUrl, uid))?.state).toBe('joined');
    await banUserFromChannel(db, channelUrl, uid);
    expect((await getMembership(db, channelUrl, uid))?.state).toBe('banned');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `cd backend && npx vitest run test/messaging/membership.test.ts` → FAIL (`getMembership` not exported).

- [ ] **Step 3: Implement `getMembership`** in `members.ts` (place near `isMemberMuted`):

```typescript
export interface Membership {
  role: 'operator' | 'member';
  state: 'joined' | 'invited' | 'requested' | 'banned';
  is_muted: boolean;
}

/** Single-row membership lookup — the write-authz primitive. null = no row. */
export async function getMembership(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<Membership | null> {
  const row = await db
    .selectFrom('messenger_members')
    .select(['role', 'state', 'is_muted'])
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!row) return null;
  return {
    role: row.role as Membership['role'],
    state: row.state as Membership['state'],
    is_muted: Boolean(row.is_muted),
  };
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `cd backend && npx vitest run test/messaging/membership.test.ts` → PASS (or BLOCKED/skipped if the test DB is read-only — record which; the guard code is what matters).

- [ ] **Step 5: Commit** — `git add backend/src/messaging/members.ts backend/test/messaging/membership.test.ts && git commit -m "feat(messaging): getMembership write-authz primitive"`

---

## Task 2: Socket write authorization + message ownership (RC#2, closes M-1/M-2)

**Files:**
- Modify: `backend/src/realtime/handlers/message.ts` (send ~79, edit ~136, delete ~168)
- Modify: `backend/src/realtime/handlers/reaction.ts` (add ~54, remove ~85)

- [ ] **Step 1: Add the membership guard to `send_message`.** Import at top of `message.ts`: change `import { isMemberMuted } from '../../messaging/members.js';` to `import { isMemberMuted, getMembership } from '../../messaging/members.js';` (and ensure `getMessage` is imported — it already is via `../../messaging/messages.js`). In `send_message`, immediately after the `if (!user) {…}` block and BEFORE the mute check, add:

```typescript
        const membership = await getMembership(db, payload.channelUrl, user.userId);
        if (!membership || membership.state !== 'joined') {
          ack?.({ success: false, error: 'not a joined member of this channel' });
          return;
        }
```

(A banned member has `state='banned'` → rejected; a non-member has no row → rejected.)

- [ ] **Step 2: Guard + ownership on `edit_message`.** After its `if (!user) {…}`, add:

```typescript
        const db = getDb();
        const membership = await getMembership(db, payload.channelUrl, user.userId);
        if (!membership || membership.state !== 'joined') {
          ack?.({ success: false, error: 'not a joined member of this channel' });
          return;
        }
        const existing = await getMessage(db, payload.channelUrl, payload.messageId);
        if (!existing) { ack?.({ success: false, error: 'message not found' }); return; }
        if (existing.user?.user_id !== user.userId) {
          ack?.({ success: false, error: 'not the author' });
          return;
        }
```

Then remove the now-duplicate `const db = getDb();` that followed the auth check (the edit handler declared it right before `updateMessage`). Keep the existing `updateMessage(...)` call.

- [ ] **Step 3: Guard + ownership on `delete_message`.** After its `if (!user) {…}`, add (delete allows author OR operator — moderation):

```typescript
        const db = getDb();
        const membership = await getMembership(db, payload.channelUrl, user.userId);
        if (!membership || membership.state !== 'joined') {
          ack?.({ success: false, error: 'not a joined member of this channel' });
          return;
        }
        const existing = await getMessage(db, payload.channelUrl, payload.messageId);
        if (!existing) { ack?.({ success: false, error: 'message not found' }); return; }
        if (existing.user?.user_id !== user.userId && membership.role !== 'operator') {
          ack?.({ success: false, error: 'not the author or an operator' });
          return;
        }
```

Remove the duplicate `const db = getDb();` that preceded `deleteMessage`.

- [ ] **Step 4: Guard `add_reaction`/`remove_reaction`** in `reaction.ts`. Import `getMembership`; in each handler after the auth check add the same joined-member guard (`getDb()` → `getMembership` → reject if not joined). Reactions have no ownership concept — membership is the gate.

- [ ] **Step 5: Restart backend if needed + verify the bypasses are CLOSED.**

Run: `systemctl --user restart bom-dev` (wait for `curl -s -X POST http://localhost:5006/ -d '{"query":"{__typename}"}' -H 'content-type: application/json'` to return). Then:
```bash
export STUDY_CLI_HOME=/tmp/wave1
node scripts/study.cli.mjs run scripts/study/scenarios/authz/ban-bypass.yaml 2>&1 | grep -E "posted|✗"
node scripts/study.cli.mjs run scripts/study/scenarios/authz/edit-others-message.yaml 2>&1 | grep -E "edited|✗|msga:"
```
Expected NOW: ban-bypass → bob's post FAILS with `✗ send_message failed: not a joined member…`; edit-others-message → bob's edit FAILS with `✗ edit_message failed: not the author`, and the final `msgs` still shows alice's original text. (Both previously succeeded.)

- [ ] **Step 6: Commit** — `git add backend/src/realtime/handlers/message.ts backend/src/realtime/handlers/reaction.ts && git commit -m "fix(realtime): enforce channel membership + message ownership on socket writes"`

---

## Task 3: Require auth to create a channel (closes M-3)

**Files:** Modify `backend/src/graphql/resolvers/messenger.ts` (`messengerCreateChannel` ~350).

- [ ] **Step 1: Require the acting user.** Replace `if (!name) return null;` and the later in-`try` `const actingUserId = await resolveActingUserId(ctx);` so the acting user is resolved once, up front, and required:

```typescript
      if (!name) return null;
      const actingUserId = await resolveActingUserId(ctx);
      if (!actingUserId) return null; // authentication required — no anonymous channel creation

      try {
        const operators: string[] = (operatorIds?.filter(Boolean) as string[]) ?? [];
        // actingUserId already resolved above; keep the existing "ensure acting user is operator" logic
```

(Delete the duplicate `const actingUserId = await resolveActingUserId(ctx);` inside the `try`.)

- [ ] **Step 2: Verify.** Restart if needed, then:
```bash
export STUDY_CLI_HOME=/tmp/wave1
node scripts/study/probe.mjs --as w1a --anon 'mutation{ messengerCreateChannel(name:"anon-should-fail"){ channel_url } }'
node scripts/study/probe.mjs --as w1a 'mutation{ messengerCreateChannel(name:"authed-ok"){ channel_url name } }'
```
Expected: the `--anon` call returns `{ "messengerCreateChannel": null }` (no channel); the authenticated call returns a `channel_url`.

- [ ] **Step 3: Commit** — `git add backend/src/graphql/resolvers/messenger.ts && git commit -m "fix(messenger): require authentication to create a channel"`

---

## Task 4: `requireSelf` on client-`userId`-arg resolvers (RC#1, closes P-1/M-5)

**Files:** Modify `backend/src/graphql/resolvers/messenger.ts` (helper near `requireOperator` ~62; resolvers updateUser ~454, updateUserMetadata ~482, acceptInvitation ~730, declineInvitation ~764, unreadDMs ~234, myChannels ~145).

- [ ] **Step 1: Add the helper** near `requireOperator`:

```typescript
/**
 * Resolve the acting user and require any client-supplied userId to target SELF.
 * Returns the acting user_id when authorized (arg absent, or equal to the actor);
 * null when unauthenticated or the arg names a different user. Stops the
 * "act on behalf of an arbitrary userId" class of bug.
 */
async function requireSelf(ctx: AppContext, argUserId?: string | null): Promise<string | null> {
  const actingUserId = await resolveActingUserId(ctx);
  if (!actingUserId) return null;
  if (argUserId != null && argUserId !== actingUserId) return null;
  return actingUserId;
}
```

- [ ] **Step 2: Apply to the write/self resolvers.** In each, replace `const targetUserId = userId ?? (await resolveActingUserId(ctx));` with `const targetUserId = await requireSelf(ctx, userId);` (keeping each resolver's existing `if (!targetUserId …) return null/false;`). Do this in: `messengerUpdateUser`, `messengerUpdateUserMetadata`, `messengerAcceptInvitation`, `messengerDeclineInvitation`. For `messengerUnreadDMs` (~234) and `messengerMyChannels` (~145) — which read personal data — replace their `const userId = args.userId ?? (await resolveActingUserId(ctx));` with `const userId = await requireSelf(ctx, args.userId);` and return `[]` when null.

- [ ] **Step 3: Verify the takeover is CLOSED.** Restart if needed, then:
```bash
export STUDY_CLI_HOME=/tmp/wave1
BOBID=$(node scripts/study/probe.mjs --as w1b --uid w1b '{ __typename }' 2>&1 | sed -n 's/^# uid(w1b) = //p')
node scripts/study/probe.mjs --as w1a "mutation{ messengerUpdateUser(userId:\"$BOBID\", nickname:\"SHOULD-FAIL\"){ user_id nickname } }"
node scripts/study/probe.mjs --as w1a --anon "mutation{ messengerUpdateUser(userId:\"$BOBID\", nickname:\"ANON-FAIL\"){ user_id nickname } }"
node scripts/study/probe.mjs --as w1b "mutation{ messengerUpdateUser(nickname:\"self-ok\"){ user_id nickname } }"
```
Expected: the cross-user (`w1a` editing `w1b`) and `--anon` calls return `{ "messengerUpdateUser": null }` (rejected); the self call (`w1b` editing itself, no `userId` arg) succeeds with `nickname:"self-ok"`.

- [ ] **Step 4: Commit** — `git add backend/src/graphql/resolvers/messenger.ts && git commit -m "fix(messenger): require self for userId-arg profile/invite/DM resolvers"`

---

## Task 5: Metadata merge, not replace (closes P-2)

**Files:** Modify `backend/src/messaging/users.ts` (`updateUserMetadata` ~256-290).

- [ ] **Step 1: Read the current `updateUserMetadata`** and change it from full-replace to a shallow merge over the existing `metadata` JSON. Fetch the current row's `metadata`, spread the incoming keys over it, write the merged object:

```typescript
// inside updateUserMetadata(db, userId, metadata):
const existing = await db
  .selectFrom('messenger_users')
  .select('metadata')
  .where('user_id', '=', userId)
  .executeTakeFirst();
let base: Record<string, unknown> = {};
if (existing?.metadata) {
  try { base = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata) : (existing.metadata as Record<string, unknown>); }
  catch { base = {}; }
}
const merged = { ...base, ...metadata };
// ...then the existing UPDATE, writing JSON.stringify(merged) instead of the raw arg.
```

Match the column's storage convention (string vs JSON) exactly as the current code writes it.

- [ ] **Step 2: Verify keys are preserved.** Restart if needed:
```bash
export STUDY_CLI_HOME=/tmp/wave1
node scripts/study/probe.mjs --as w1c 'mutation{ messengerUpdateUserMetadata(metadata:"{\"summary\":\"s1\",\"bookmark\":\"b1\"}") }'
node scripts/study/probe.mjs --as w1c 'mutation{ messengerUpdateUserMetadata(metadata:"{\"summary\":\"s2\"}") }'
CID=$(node scripts/study/probe.mjs --as w1c --uid w1c '{ __typename }' 2>&1 | sed -n 's/^# uid(w1c) = //p')
node scripts/study/probe.mjs --as w1c "{ messengerUser(userId:\"$CID\"){ metadata } }"
```
Expected: the final metadata contains BOTH `summary:"s2"` (updated) AND `bookmark:"b1"` (preserved) — previously `bookmark` was wiped.

- [ ] **Step 3: Commit** — `git add backend/src/messaging/users.ts && git commit -m "fix(messaging): merge user metadata instead of full-replace"`

---

## Task 6: Membership gate on reading private-channel messages (closes M-4)

**Files:** Modify `backend/src/graphql/resolvers/messenger.ts` (`messengerMessages` ~190).

- [ ] **Step 1: Gate non-public channels.** Add a channel-privacy + membership check before returning messages. Public/open channels stay readable; private/DM require a joined membership. Import `getMembership` (from `../../messaging/members.js`) at the top of the resolver file if not present. Rewrite the resolver body:

```typescript
    messengerMessages: async (_root, args, ctx: AppContext) => {
      if (!args.channelUrl) return [];
      // Read authz: public/open channels are readable by anyone; private/DM
      // require a joined membership.
      const ch = await ctx.db
        .selectFrom('messenger_channels')
        .select('custom_type')
        .where('channel_url', '=', args.channelUrl)
        .executeTakeFirst();
      const isPublic = ch != null && (ch.custom_type === 'public' || ch.custom_type === 'open');
      if (!isPublic) {
        const actingUserId = await resolveActingUserId(ctx);
        const m = actingUserId ? await getMembership(ctx.db, args.channelUrl, actingUserId) : null;
        if (!m || m.state !== 'joined') return [];
      }
      const customTypes = (args.customTypes ?? []).filter(
        (t): t is string => typeof t === 'string' && t.length > 0,
      );
      return getMessages(ctx.db, args.channelUrl, {
        limit: args.limit ?? 30,
        before: args.before ?? undefined,
        ...(customTypes.length ? { customTypes } : {}),
      });
    },
```

- [ ] **Step 2: Verify.** Have `w1a` create a private channel (default customType `group` is private), then read it as non-member `w1b`:
```bash
export STUDY_CLI_HOME=/tmp/wave1
CH=$(node scripts/study/probe.mjs --as w1a 'mutation{ messengerCreateChannel(name:"private-read-test", customType:"group"){ channel_url } }' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).messengerCreateChannel.channel_url))")
node scripts/study.cli.mjs post --as w1a --group "$CH" --text "secret" >/dev/null 2>&1
node scripts/study/probe.mjs --as w1b "{ messengerMessages(channelUrl:\"$CH\", limit:5){ message_id message } }"
node scripts/study/probe.mjs --as w1a "{ messengerMessages(channelUrl:\"$CH\", limit:5){ message_id message } }"
```
Expected: `w1b` (non-member) gets `{ "messengerMessages": [] }`; `w1a` (member) sees the message.

- [ ] **Step 3: Commit** — `git add backend/src/graphql/resolvers/messenger.ts && git commit -m "fix(messenger): gate private-channel message reads on membership"`

---

## Task 7: Full regression + typecheck

- [ ] **Step 1: Typecheck** — Run: `cd backend && npx tsc --noEmit` → no NEW errors beyond the pre-existing `scriptureextras.ts:57` pair (record any new ones).
- [ ] **Step 2: Backend tests** — Run: `cd backend && npx vitest run test/messaging/membership.test.ts` (and any messaging suites touching members/messages) → pass (or BLOCKED if read-only DB — note).
- [ ] **Step 3: Adversarial regression (the proof).** With `STUDY_CLI_HOME=/tmp/wave1`, re-run every closed bypass and record CLOSED:
  - ban-bypass.yaml → post rejected
  - edit-others-message.yaml → edit rejected, text unchanged
  - probe: anon create → null; cross-user updateUser → null; anon updateUser → null
  - probe: partial metadata → both keys present
  - probe: non-member private read → []
  Also run `node scripts/study.cli.mjs run scripts/study/scenarios/demo.yaml` → still `✔ 8 steps` (legitimate member flows unbroken).
- [ ] **Step 4: Cleanup + commit note.** `STUDY_CLI_HOME=/tmp/wave1 node scripts/study.cli.mjs cleanup`. Append a short "Wave 1 remediation — CLOSED" note to `docs/audits/2026-08-05-prod-audit-summary.md` (P-1/M-1/M-2/M-3/M-4/M-5/P-2 → fixed, with the commit SHAs). Commit `docs(audit): mark Wave 1 authz findings remediated`.

---

## Self-review notes
- **Coverage:** P-1→Task 4; M-1→Task 2 (membership); M-2→Task 2 (ownership); M-3→Task 3; M-4→Task 6; M-5→Task 4; P-2→Task 5. `getMembership` (Task 1) is the shared primitive for Tasks 2 & 6.
- **Type consistency:** `getMembership`/`Membership` names used identically in Tasks 1/2/6; `requireSelf` in Task 4; the ack `{success,error}` shape matches the handlers; probe/scenario harness matches the tools built earlier.
- **Regression safety:** legitimate member flows are covered by `demo.yaml` (Task 7 Step 3) — members still send/edit-own/react; only cross-user/non-member/banned/anon paths are newly rejected.
- **Not in Wave 1 (separate):** A1 (lang overflow), A2 (password reset), and the P1 batch (rate-limit, feed privacy, join-type, LLM cost, N+1s, stubs, perf) + the prod-config gate — tracked in the review plan's later waves.
