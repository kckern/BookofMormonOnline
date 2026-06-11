# Green-field Mutation + WebSocket Test Suite — Plan

> **For agentic workers:** this plan is to be reviewed/approved before execution. It designs a
> full-coverage, leave-no-trace test suite for the green-field **mutation** (GraphQL) and
> **realtime** (Socket.io) surface, run against **bom_prd** with a test account.

**Goal:** Exercise every safe-to-test mutation and every realtime event end-to-end, verifying both
the write itself and its **cascades** (logging → progress/percent → leaderboard/bookmark), then
remove all created data so the run leaves no trace.

**Environment:** backend `:5006` on `bom_app` RW creds, `SANDBOX=0`, DB = **bom_prd** (production,
backed up). Revert to reader + `SANDBOX=1` when done.

---

## 1. Safety model (this is production)

1. **Test account only.** Acting user is the Staff test account (`717ad5e1…` → `b0c4b5…`) — owner-
   authorized — or the regression throwaway (`bomtest+regressionr2`, token in gitignored
   `tests/.env.test`). Never any other user.
2. **Unique run namespace.** Every created channel gets a name/custom_type marker
   `__wftest__<runId>` (runId = unix ts passed in, since `Date.now()` is fine in jest). The suite
   tracks every `channel_url`, `message_id`, `member`, and `bom_log` row it creates in a
   **created-set**.
3. **Teardown deletes only the created-set.** Because there is **no `deleteChannel` API**, channel
   cleanup is a direct scoped SQL delete (`messenger_messages` → `messenger_members` →
   `messenger_channels`) **filtered to `channel_url ∈ created-set`**. A pre-flight guard refuses to
   DELETE any channel_url not in the created-set or not bearing the `__wftest__` marker.
4. **Idempotent + abort-safe teardown.** Teardown runs in `afterAll` AND is re-runnable as a
   standalone script (`npm run test:mutations:cleanup`) that deletes every `__wftest__`-marked
   channel, in case a run aborts mid-way.
5. **Excluded entirely:** `signup`, `changePassword`, delete-account, `uploadProfileImage`
   (S3/CloudFront side effects). `signin`/`signout` and nickname/profile edits are allowed
   (reversible round-trips).
6. **Logging is accepted as non-reversible** but we still record the inserted `bom_log` rows
   (user + timestamp + value) and offer an optional cleanup that deletes exactly those rows.

---

## 2. Surface map (what we test, GQL vs WS)

### GraphQL mutations
| Mutation | Test? | Cleanup |
|---|---|---|
| `editProfile`, `messengerUpdateUser`, `messengerUpdateUserMetadata` | ✅ | restore original |
| `signout` (+ re-`signin` to restore token) | ✅ | re-signin |
| `log(token,key,val)` | ✅ (non-reversible) | optional row delete |
| `messengerCreateChannel` (solo + open) | ✅ | DB delete (created-set) |
| `messengerUpdateChannel` | ✅ | covered by channel delete |
| `joinOpenGroup` / `requestToJoinGroup` / `withdrawRequest` / `processRequest` | ✅ | withdraw/leave + DB |
| `messengerUpdateMemberRole` / `messengerSetMute` | ✅ | reverse op |
| `messengerInviteMembers` / `messengerAcceptInvitation` / `messengerDeclineInvitation` | ✅ | decline/remove |
| `messengerRemoveMember` | ✅ (on a test 2nd member) | re-invite or DB |
| `addBot` / `removeBot` | ✅ | removeBot |
| `shortlink`, `ping` | ✅ | shortlink row delete / none |
| `signup`, `changePassword` | ❌ excluded | — |

### Socket.io `/messenger` (handshake auth `{userId, token}`)
Client→server: `send_message`, `edit_message`, `delete_message`, `add_reaction`,
`remove_reaction`, `mark_read`, `typing_start`, `typing_stop`, `fire_action`, `update_state`.
Server→client (assert received): `message_received`, `message_updated`, `message_deleted`,
`reaction_changed`, `typing`, `unread_count_changed`, `channel_action`, `user_joined`.

> **Messages, reactions, read-state, typing, and study-group nav are WS-only** — the suite needs a
> real socket client; GraphQL `homefeed`/`homethread` are used to *verify persistence*.

---

## 3. Architecture

Build on the existing `tests/` jest harness (client, auth, targets, baselines). New pieces under
`tests/`:

- `tests/mutations/lib/gqlMutate.js` — authenticated POST helper (Bearer + `/en`), returns
  `{data, errors}`; throws on `errors` unless `expectError`.
- `tests/mutations/lib/wsClient.js` — `socket.io-client` wrapper: connect with
  `auth:{userId:md5(user), token}`, `waitFor(event, predicate, timeoutMs)`, `emitAndWait(...)`,
  clean `disconnect()`. (Confirm `socket.io-client` is installed; add if missing.)
- `tests/mutations/lib/registry.js` — the created-set + teardown. Tracks channels/messages/members/
  logs; `cleanup()` does the scoped SQL deletes via a dedicated Kysely/mysql2 connection (RW).
  Hard guard: `assert(channelUrl.includes(MARKER) && createdSet.has(channelUrl))` before any delete.
- `tests/mutations/lib/cascade.js` — helpers to snapshot + diff user progress: `userprogress`,
  `divisionProgress`, `leaderboard` position, `tokensignin.user.{complete,started,finished}`.
- `tests/mutations/*.test.js` — the suites below.
- `package.json`: `test:mutations` (serial, `--runInBand`, single worker — shared account/state),
  `test:mutations:cleanup` (standalone teardown).

Guards: the suite refuses to start unless `SANDBOX=0` **and** `MYSQL_DB==='bom_prd'` confirmed
**and** an explicit `ALLOW_PROD_WRITES=1` env is set (prevents accidental CI runs).

---

## 4. Test suites (each: act → assert write → assert WS event(s) → assert cascade → cleanup)

### A. `profile.test.js` (reversible)
- `editProfile` name/zip round-trip (already proven) → verify via `tokensignin` → restore.
- `messengerUpdateUser` nickname round-trip → verify via `getUser`/homegroup member → restore.
- `messengerUpdateUserMetadata` set summary/bookmark JSON → verify → restore prior metadata.
- `signout` then `signin` to re-mint the token → verify token works again. (Token value preserved.)

### B. `logging-cascade.test.js` (non-reversible, tracked)
- Snapshot progress (completed%, started%, finished, bookmark, leaderboard rank).
- `log(key:'block', val:<test text guid>)` → assert `LogResult`; assert `last_active` bumped;
  assert `userprogress` completed/started **changed in the expected direction**; assert bookmark
  updated; assert leaderboard reflects it (if rank-affecting).
- Repeat for other log keys actually supported (enumerate from the resolver: block/credit/etc.).
- Record inserted `bom_log` rows in registry for optional cleanup.

### C. `community-lifecycle.test.js` (leave-no-trace — the core flow)
1. `messengerCreateChannel(name:'__wftest__<run> solo', customType:'solo', operatorIds:[me])`
   → track channel_url; assert it exists via `homegroups`/`getChannel`.
2. **WS** connect as the test user; `send_message({channelUrl, message:'hello'})`
   → assert own `message_received` event; assert persisted via `homethread`.
3. `edit_message` → assert `message_updated` + persisted text.
4. `add_reaction`/`remove_reaction` → assert `reaction_changed` + persisted.
5. `mark_read` → assert `unread_count_changed`.
6. `typing_start`/`typing_stop`, `fire_action` → assert `typing` / `channel_action` broadcast
   (needs a 2nd socket as observer — see E).
7. `delete_message` → assert `message_deleted` + gone from `homethread`.
8. **Teardown:** DB-delete the channel + its messages/members (created-set).

### D. `membership.test.js` (leave-no-trace)
- Create an **open** `__wftest__` channel (operator = test user).
- `joinOpenGroup` as a 2nd test identity → assert membership (state=joined) + `user_joined` event.
- `messengerSetMute` mute↔unmute; `messengerUpdateMemberRole` promote↔demote (assert each).
- `messengerInviteMembers` → `messengerAcceptInvitation` / `messengerDeclineInvitation`.
- `requestToJoinGroup` (public channel) → `processRequest(grant)` / `withdrawRequest`.
- `messengerRemoveMember` on the 2nd identity.
- Teardown: DB-delete channel + members.

> Needs a **second test identity** with its own token to exercise join/invite/role/mute against
> someone other than the operator. Options: the regression account as member + Staff as operator
> (both owner-authorized). Decide in review.

### E. `realtime-multiclient.test.js`
- Two sockets (operator + member) in the same `__wftest__` channel.
- Assert cross-client fan-out: sender `send_message` → **receiver** gets `message_received`;
  typing/reaction/read/channel_action propagate; presence `update_state` ↔ online set.

### F. `bots.test.js`
- `addBot` to a `__wftest__` channel → assert bot member; (optionally) `send_message` and assert a
  bot reply `message_received` (botResponder) — may be skipped if it calls an external LLM.
- `removeBot` → assert gone. Teardown: channel delete.

---

## 5. Run procedure
1. Pre-flight: confirm `SANDBOX=0`, `MYSQL_DB=bom_prd`, `ALLOW_PROD_WRITES=1`, account tokens resolve.
2. `npm run test:mutations` (serial). Each suite self-cleans; global `afterAll` runs registry cleanup.
3. On any abort: `npm run test:mutations:cleanup` to purge all `__wftest__` channels.
4. Post-run verification: query `homegroups` + `messenger_channels LIKE '__wftest__%'` → assert **0**
   test channels remain; confirm test-account profile/nickname restored.
5. **Revert env:** restore `backend/.env.bak-readonly` (reader + `SANDBOX=1`), restart greenfield,
   confirm a write is now suppressed again.

## 6. Decisions (locked 2026-06-10)
- **Second identity:** Staff (`717ad5e1…`) = **operator**, regression (`bomtest+regressionr2`) =
  **member**. Both owner-authorized.
- **Bots:** **full reply roundtrip** — addBot, post a trigger message, assert the bot's
  `message_received` reply (real LLM call; mark the suite slow + allow a longer timeout).
- **Log rows:** **delete them** in teardown — track every inserted `bom_log` row (user+timestamp+
  value) and scoped-delete so the test account's progress returns to baseline. Snapshot/restore
  `bom_user.complete/started/finished/last_active` if the cascade wrote them.
- **Execution:** **build the harness first** — lib + safety guards, verify guards (especially the
  teardown refuses non-`__wftest__` channels), THEN write/run suites incrementally with checkpoints.

### Still to confirm during build
- **Log keys:** enumerate the `key` values `log` supports + their cascade from `useractivity.ts`
  (+ legacy `BomUser.log`) before asserting direction.
- **Redis:** confirm `infisical-redis` reachable from the backend, else single-node fallback.
