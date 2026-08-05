# Messaging Prod Audit — 2026-08-05

**Surface:** Messaging (socket write path + GraphQL resolvers + messaging service layer)
**Auditor:** agentic code review + dynamic probes (study CLI + raw fetch)
**Reference:** `docs/plans/2026-08-05-prod-audit-execution-plan.md` §Task 5
**Isolation:** `STUDY_CLI_HOME=/tmp/audit-messaging`; sim handles `msga`, `msgb`, `msgc`

---

## Summary

| ID | Title | Verdict | Severity |
|----|-------|---------|----------|
| M-1 | Socket write has no ban check | **CONFIRMED** | P0 |
| M-2 | edit/delete no ownership check | **CONFIRMED** | P0 |
| M-3 | `messengerCreateChannel` no auth | **CONFIRMED** | P0 |
| M-4 | `messengerMessages` no membership/auth check | **CONFIRMED** | P1 |
| M-5 | Accept/decline invitation as another user | **CONFIRMED** | P1 |
| M-6 | Unread N+1 (2 queries × N channels) | **CONFIRMED** | P1 |
| M-7 | No message retention/purge | **CONFIRMED** | P1 |

**Top P0 blockers:** M-1, M-2, M-3. All three are real, live, dynamically verified.

---

## Confirmed Authorization Matrix

Write path × guard dimension:

| Operation | Auth required | Membership check | Ban check | Operator check | Mute check |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `send_message` (socket) | ✅ yes | ❌ absent | ❌ absent | n/a | ✅ yes |
| `edit_message` (socket) | ✅ yes | ❌ absent | ❌ absent | n/a | n/a |
| `delete_message` (socket) | ✅ yes | ❌ absent | ❌ absent | n/a | n/a |
| `add_reaction` (socket) | ✅ yes | ❌ absent | ❌ absent | n/a | n/a |
| `remove_reaction` (socket) | ✅ yes | ❌ absent | ❌ absent | n/a | n/a |
| `messengerCreateChannel` (GQL) | ❌ absent | n/a | n/a | n/a | n/a |
| `messengerMessages` (GQL) | ❌ absent | ❌ absent | n/a | n/a | n/a |
| `messengerAcceptInvitation` (GQL) | ✅ yes (bearer) | ❌ userId arg unchecked | n/a | n/a | n/a |

Legend: ✅ guard present and enforced | ❌ guard absent (vulnerability)

---

## Findings

### M-1 — Socket write has no ban check — CONFIRMED (severity: P0)

- **Claim:** A banned channel member can still post messages (and react) via the socket path. The `send_message` handler only checks authentication and mute, not ban state.
- **Method:** Code review `backend/src/realtime/handlers/message.ts:79-133`; dynamic scenario `scripts/study/scenarios/authz/ban-bypass.yaml`.
- **Evidence (code):**
  ```typescript
  // message.ts:91 — the ONLY pre-write guard in send_message
  if (await isMemberMuted(db, payload.channelUrl, user.userId)) {
    ack?.({ success: false, error: 'You are muted in this channel' });
    return;
  }
  // → postMessage() is called with no ban check
  ```
  `isMemberBanned` exists in `members.ts:315-327` but is never imported by `message.ts` or `reaction.ts`.
- **Evidence (dynamic):** Scenario run:
  ```
  group created: "ban bypass test" → 6oMW6fls4h1
  simmsgb posted [17859635169]: posted after ban — should be blocked
  ✔ scenario complete. vars: {"banned_post":"17859635169"}
  ```
  The banned user (msgb) received `ack success:true`, and `msgs` confirmed the message persisted.
- **Impact:** A banned user can continue to post messages and react to messages indefinitely after being banned. Ban enforcement is completely ineffective on the socket path.
- **Fix sketch:** In `send_message` handler (and `edit_message`, `delete_message`, `add_reaction`, `remove_reaction`), call `isUserBanned(db, channelUrl, userId)` before the mute check; ack `{success:false, error:'You are banned from this channel'}` if true.

---

### M-2 — edit/delete no ownership check — CONFIRMED (severity: P0)

- **Claim:** Any authenticated socket user can edit or delete any message in any channel by supplying the message_id, regardless of who authored it.
- **Method:** Code review `backend/src/messaging/messages.ts:500-570`; dynamic scenario `scripts/study/scenarios/authz/edit-others-message.yaml`.
- **Evidence (code):**
  ```typescript
  // messages.ts:525-531 — updateMessage WHERE clause
  await db
    .updateTable('messenger_messages')
    .set(updateData)
    .where('message_id', '=', messageId)
    .where('channel_url', '=', channelUrl)
    .execute();
  // No .where('user_id', '=', callerUserId) — ownership never checked
  ```
  ```typescript
  // messages.ts:564-567 — deleteMessage WHERE clause (same pattern)
  .where('message_id', '=', messageId)
  .where('channel_url', '=', channelUrl)
  // Again: no user_id constraint
  ```
  The socket handler (`message.ts:146`) passes `payload.messageId` directly to `updateMessage` with no ownership assertion.
- **Evidence (dynamic):** Scenario run:
  ```
  simmsga posted [17859635250]: alice's message
  simmsgb edited [17859635250]
  [17859635250] msga: bob edited alice's message
  ✔ scenario complete (5 steps).
  ```
  The final `msgs` step shows alice's message now reads `"bob edited alice's message"`. Alice's original text is gone. Both `message_updated` socket events broadcast to both users confirmed the edit succeeded.
- **Impact:** Any member (or even a banned member, per M-1) can rewrite or delete any message in any channel they're authenticated against, regardless of authorship. Also enables content vandalism.
- **Fix sketch:** `updateMessage` / `deleteMessage` in `messages.ts` should accept a `callerUserId` param and add `.where('user_id', '=', callerUserId)` to the UPDATE/DELETE, OR the socket handler should fetch the message first and reject if `msg.user_id !== user.userId` (with an operator escape hatch).

---

### M-3 — `messengerCreateChannel` no auth — CONFIRMED (severity: P0)

- **Claim:** `messengerCreateChannel` executes with no bearer token — any anonymous HTTP client can create a channel.
- **Method:** Code review `backend/src/graphql/resolvers/messenger.ts:350-404`; raw curl probe.
- **Evidence (code):**
  ```typescript
  // messenger.ts:350-404 — messengerCreateChannel
  const actingUserId = await resolveActingUserId(ctx);  // returns null if no bearer
  const operators: string[] = operatorIds?.filter(Boolean) as string[] ?? [];
  if (actingUserId && !operators.includes(actingUserId)) {
    operators.push(actingUserId);   // conditional: just skipped when null
  }
  // → createChannel() is called with empty operators array, no auth guard
  ```
  `resolveActingUserId` returns `null` when no token; the null is handled by not adding the acting user as operator, but channel creation is NOT blocked.
- **Evidence (dynamic):**
  ```bash
  # probe with --anon (no bearer):
  node scripts/study/probe.mjs --as msga --anon \
    'mutation{ messengerCreateChannel(name:"anon-created"){ channel_url name } }'
  # → {"messengerCreateChannel":{"channel_url":"aaK5Q20Y8k7","name":"anon-created"}}

  # raw curl (no provisioned user at all):
  curl -s -X POST http://localhost:5006/ -H "content-type: application/json" \
    -d '{"query":"mutation{ messengerCreateChannel(name:\"anon-probe-verify\"){ channel_url name } }"}'
  # → {"data":{"messengerCreateChannel":{"channel_url":"de6rf5V8UxJ","name":"anon-probe-verify"}}}
  ```
- **Impact:** Unauthenticated actors can create unlimited channels in the DB. Combined with M-4 (anyone can post to any channel), this is a zero-friction DB spam/pollution vector.
- **Fix sketch:** Add an early auth gate at line ~363: `const actingUserId = await resolveActingUserId(ctx); if (!actingUserId) return null;`.

---

### M-4 — read authz on `messengerMessages` — CONFIRMED (severity: P1)

- **Claim:** `messengerMessages` returns channel history with no authentication or membership check — any caller (including anonymous) can read any channel by URL.
- **Method:** Code review `backend/src/graphql/resolvers/messenger.ts:190-200`; dynamic probe: alice creates private channel, posts a message, then non-member bob and anonymous read it.
- **Evidence (code):**
  ```typescript
  // messenger.ts:190-200 — messengerMessages resolver
  messengerMessages: async (_root, args, ctx: AppContext) => {
    if (!args.channelUrl) return [];
    // ... filter customTypes ...
    return getMessages(ctx.db, args.channelUrl, { ... });
    // No auth check, no membership check — ctx is unused
  },
  ```
- **Evidence (dynamic):**
  ```
  Channel: X22mS3HHvPF (alice's private-only channel, alice posted "alice's secret message")

  BOB READS (non-member, authenticated):
  → {"messengerMessages":[{"message_id":"17859635960","message":"alice's secret message"}]}

  ANON READS (no bearer):
  → {"messengerMessages":[{"message_id":"17859635960","message":"alice's secret message"}]}
  ```
  Both non-member and anonymous callers read the full message history.
- **Impact:** All channel history (private study groups, DMs, etc.) is publicly readable by anyone who knows or can guess the channel_url (nanoid — 11 chars, but guessable via enumeration if channel list is leaked). With M-3, an attacker can create channels, post to them, and read any channel.
- **Fix sketch:** `messengerMessages` resolver: call `resolveActingUserId(ctx)`, then verify the caller has a non-banned membership row in the channel before returning messages. (Allow operator override for admin reads.)

---

### M-5 — Accept/decline invitation as another user — CONFIRMED (severity: P1)

- **Claim:** `messengerAcceptInvitation` accepts an arbitrary `userId` arg and acts on it without verifying the bearer user matches that userId — allowing any authenticated user to accept invitations on behalf of any other user.
- **Method:** Code review `backend/src/graphql/resolvers/messenger.ts:730-752`; dynamic probe.
- **Evidence (code):**
  ```typescript
  // messenger.ts:735
  const targetUserId = userId ?? (await resolveActingUserId(ctx));
  // userId arg from the client is trusted directly — no check that bearerUser === userId
  ```
- **Evidence (dynamic):**
  ```
  Alice invites carol to channel i4JMHsWaz06
  Bob (not invited, different bearer) calls:
    messengerAcceptInvitation(channelUrl:"i4JMHsWaz06", userId:"<carol_id>")
  → {"data":{"messengerAcceptInvitation":true}}

  Channel members after:
  → carol state: "joined"   (carol never clicked accept; bob did it for her)
  ```
- **Impact:** An authenticated user can force-join any other user who has a pending invitation — bypassing the invitee's consent. Also applies to `messengerDeclineInvitation` (same pattern at line 769): a user can decline invitations on behalf of others (forced removal from the invited state).
- **Fix sketch:** Add `if (userId && userId !== (await resolveActingUserId(ctx))) return false;` before acting, OR require the bearer's userId to match the arg unless the bearer is a channel operator.

---

### M-6 — Unread N+1 (2 queries × N channels) — CONFIRMED (severity: P1)

- **Claim:** Loading a user's channel list fires 2 SQL queries per channel for unread counts (a `getUnreadCount` call per channel URL, each doing 2 queries).
- **Method:** Code review `backend/src/messaging/channels.ts:149-157` + `backend/src/messaging/readstate.ts:58-87`.
- **Evidence:**
  ```typescript
  // channels.ts:153-156 — assembleChannels
  Promise.all(
    urls.map((u) => getUnreadCount(db, u, viewerUserId).then((c) => [u, c] as const))
  )
  ```
  ```typescript
  // readstate.ts:64-84 — getUnreadCount — 2 queries per call:
  // Query 1: SELECT last_read_at FROM messenger_members WHERE ...
  const member = await db.selectFrom('messenger_members')...executeTakeFirst();
  // Query 2: SELECT COUNT(*) FROM messenger_messages WHERE ...
  const result = await db.selectFrom('messenger_messages')...executeTakeFirst();
  ```
  For N channels: 2N parallel queries. For a user with 20 channels = 40 queries just for unread counts.
- **Impact:** Channel list load is O(N) in DB round trips for unread count. At modest scale (20–50 channels) this is measurable latency; the `Promise.all` mitigates sequential stacking but not DB connection pressure.
- **Fix sketch:** Single-query unread with a correlated subquery or a LEFT JOIN that computes all channels' unread counts in one SQL statement, grouped by channel_url.

---

### M-7 — No message retention/purge — CONFIRMED (severity: P1)

- **Claim:** There is no scheduled purge of deleted or old messages — soft-deleted rows (`is_deleted=1`) accumulate in `messenger_messages` forever.
- **Method:** `grep -rniE "purge|retention|cron|is_deleted" backend/src/messaging/` — full grep of the messaging module.
- **Evidence:**
  ```
  Matching lines across backend/src/messaging/:
  - readstate.ts, notifications.ts, messages.ts: is_deleted filter in WHERE clauses
  - readingplan.ts: "no cron" comment (confirms intent)
  - NO matches for: purge, retention, cron job, hard delete, cleanup scheduler
  ```
  The only mentions of `cron` are a comment in `readingplan.ts:225` ("no cron" pattern by design). No scheduler, no background worker, no TTL.
- **Impact:** Deleted messages are never hard-purged. Over time the `messenger_messages` table grows unbounded. For a scripture platform with multi-year operation horizon, deleted/spam content accumulates in the DB and is trivially accessible if `is_deleted` filter is bypassed (or via direct DB access). Also impacts GDPR/right-to-erasure scenarios if they apply.
- **Fix sketch:** Add a scheduled task (node-cron or similar) that hard-deletes rows WHERE `is_deleted=1 AND updated_at < NOW() - INTERVAL 30 DAY`. Or implement a DB event for the same. Define and document the retention policy first.

---

## Audit Trail

| Finding | Method | Ran at |
|---------|--------|--------|
| M-1 | `ban-bypass.yaml` scenario + code review `message.ts:79-133` | 2026-08-05 |
| M-2 | `edit-others-message.yaml` scenario + code review `messages.ts:500-570` | 2026-08-05 |
| M-3 | `probe.mjs --anon` + raw curl + code review `messenger.ts:350-404` | 2026-08-05 |
| M-4 | node script (alice post + bob/anon fetch) + code review `messenger.ts:190-200` | 2026-08-05 |
| M-5 | node script (bob accepts carol's invite) + code review `messenger.ts:730-752` | 2026-08-05 |
| M-6 | Static code review `channels.ts:149-157` + `readstate.ts:58-87` | 2026-08-05 |
| M-7 | `grep` of `backend/src/messaging/` for purge/cron/retention | 2026-08-05 |

Scenario files written (not committed):
- `scripts/study/scenarios/authz/ban-bypass.yaml`
- `scripts/study/scenarios/authz/edit-others-message.yaml`
