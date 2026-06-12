# Social Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the invite authorization gap, implement real bans, delete the remaining polling loops, gut voice calls, and surface replier faces on every thread.

**Architecture:** Backend gates live in `backend/src/graphql/resolvers/messenger.ts` (pattern: `requireOperator`); membership semantics in `backend/src/messaging/members.ts`; thread assembly in `backend/src/messaging/messages.ts` `assembleMessages`. Frontend: admin UI `frontend/webapp/src/views/_Common/Study/StudyGroupAdmin.js`, feed `views/Home/Feed.js`, call surfaces across `views/_Common/Study/*` + `models/*`.

**Tech Stack:** Kysely/MySQL + SDL-first graphql-yoga + codegen + vitest (DB-backed; copy `test/messaging/messages.test.ts` seeding patterns); React 17 CRA + jest.

**Spec:** `docs/specs/2026-06-12-social-hardening.md` (read it first — it IS the contract).

**Shared context for every task:** repo `/home/bom/BookofMormonOnline`, branch `dev`, direct commits with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, no push. Backend: `cd backend && npm run codegen:graphql && npx tsc --noEmit` after SDL changes; restart with `systemctl --user restart bom-greenfield` (pre-authorized; takes ~90s, stop times out to SIGKILL — that's known) before live curls. Frontend: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false`; webpack status via `journalctl --user -u bom-dev --since "2 minutes ago" | grep -E "webpack compiled|ERROR in"`. Operator-gate test pattern exists in `backend/test/messaging/community-graphql-auth.test.ts`; token-gated suites skip without `MESSENGER_TEST_TOKEN` — write DB-level service tests instead where possible.

---

### Task 1: Invite authorization (operator-or-flag)

**Files:** `backend/src/graphql/resolvers/messenger.ts` (messengerInviteMembers ~line 520-560; messengerUpdateChannel), `backend/schema/Messenger.graphql` (updateChannel arg), `backend/src/messaging/channels.ts` (updateChannel service — read it), `backend/test/messaging/inviteAuth.test.ts` (new), frontend `StudyGroupAdmin.js` + its controller call path (find how rename/description save works and mirror it).

1. - [ ] Read the spec §1 and the current `messengerInviteMembers` resolver. Write a DB-backed vitest (`inviteAuth.test.ts`, seeding pattern from messages.test.ts) that exercises the AUTHORIZATION HELPER you'll extract — `canInvite(ctx-ish args)` is hard to test through GraphQL without tokens, so structure the resolver logic as an exported pure-ish helper in the resolver module OR (preferred) a service function `canUserInvite(db, channelUrl, userId): Promise<boolean>` in `backend/src/messaging/members.ts`: true if user is operator; true if channel metadata `membersCanInvite === true` AND user state='joined'; else false. Tests: operator → true; joined member, no flag → false; joined member + flag → true; non-member + flag → false; banned member + flag → false (state check is 'joined', covers it).
2. - [ ] Implement `canUserInvite`; wire into `messengerInviteMembers`: resolve acting user (`resolveActingUserId`), `if (!(await canUserInvite(...))) return false;` before the insert loop.
3. - [ ] `messengerUpdateChannel` gains `membersCanInvite: Boolean` SDL arg; resolver (already operator-gated — verify) merges `{ membersCanInvite: !!value }` into channel metadata when the arg is provided (read how metadata is stored/updated in channels.ts — add an `updateChannelMetadataKey` service fn if none exists; JSON_SET or read-modify-write under the existing update path).
4. - [ ] Codegen + tsc + vitest green. Live curl: updateChannel with the arg on a test channel (use the channel seeded by your test, before cleanup, or a manual seed) then read back `metadata` via messengerChannel.
5. - [ ] Frontend: `StudyGroupAdmin.js` — add a "Members can invite others" checkbox/toggle alongside existing channel settings, calling the controller's updateChannel pathway (find it: grep `messengerUpdateChannel` in MessengerController.js; extend its args to pass membersCanInvite). Initial value from `activeGroup.metadata?.membersCanInvite`. Frontend suite green, webpack green.
6. - [ ] Commit: `feat(messenger): invites gated — operators always, members via membersCanInvite channel flag`

### Task 2: Real bans

**Files:** `backend/src/messaging/members.ts` (+ ban/unban + re-entry rejection), `backend/src/graphql/resolvers/messenger.ts` + `community.ts` (banMember alias → real), `backend/schema/Messenger.graphql` (two mutations), `backend/test/messaging/bans.test.ts` (new), frontend `StudyGroupAdmin.js` (+ Ban/Unban actions + Banned section), MessengerController (mutation wrappers).

1. - [ ] Read spec §2; read members.ts fully (addUserToChannel, removeUserFromChannel, state handling) and where the invite-link join lands (`joinGroup` — grep backend resolvers for it) plus `messengerAcceptInvitation`. Write `bans.test.ts` (DB-backed): ban inserts/updates row to state='banned'; `addUserToChannel` on a banned row returns false and leaves state='banned'; acceptInvitation path refuses; unban deletes the row; banned members absent from `getChannelMembers` default listing (check current state filtering — if getChannelMembers returns all states, assert the new `state='banned'` rows are excluded from the places that matter: read `assembleChannels` member assembly and filter there; document what you did).
2. - [ ] Implement: `banUserFromChannel(db, channelUrl, userId)` (upsert state='banned'), `unbanUserFromChannel` (delete row where state='banned'), re-entry guards in `addUserToChannel` + the joinGroup/acceptInvitation paths (each checks existing row state before proceeding). Keep `removeUserFromChannel` semantics (kick, may rejoin).
3. - [ ] SDL: `messengerBanMember(channelUrl: String, userId: String): Boolean`, `messengerUnbanMember(...): Boolean` — both `requireOperator`-gated resolvers emitting `membership_changed` on success. Community `banMember` resolver delegates to `banUserFromChannel` (find it: grep banMember in community.ts; keep its arg/return contract).
4. - [ ] Codegen + tsc + vitest green (new suite + existing members/channels suites).
5. - [ ] Frontend: MessengerController wrappers (`banMember(channelUrl, userId)` / `unbanMember`) following the removeMember wrapper pattern (grep messengerRemoveMember in MessengerController.js); StudyGroupAdmin member rows gain Ban action; a "Banned" list section (fetch: the members payload must include banned rows for ADMIN view — simplest: new query arg `messengerChannelOperators`-style or reuse messengerChannel members with a flag; choose the smallest surface and document it) with Unban. Frontend suite + webpack green.
6. - [ ] Commit: `feat(messenger): real bans — banned state blocks all re-entry; operator ban/unban`

### Task 3: Kill the homethread poll

**Files:** `frontend/webapp/src/views/Home/Feed.js` (~line 750-780 — read the whole reply-posting flow).

1. - [ ] Read the post-reply path: what does the 5s `homethread` poll wait for, and what does the mutation that posts the reply return? (grep `homethread` in Feed.js + GraphQLQueries.js.)
2. - [ ] Replace: append the posted reply to component state optimistically from the mutation response (or from the already-known input + current user when the response lacks the row — document which). Delete the interval/timeout. Other viewers already get socket `message_received` — verify the feed thread listens (grep addMessage/fireMessage listeners in Feed.js); if it doesn't, note it in the report as a follow-up rather than building new socket plumbing in this task.
3. - [ ] Frontend suite + webpack green; manual: post a feed reply on dev, reply appears instantly, network tab shows no homethread polling.
4. - [ ] Commit: `perf(feed): optimistic reply append — drop the 5s homethread poll`

### Task 4: Gut voice calls

**Files (discovery-driven):** start from `grep -rn "activeCall\|CallCircle\|fetchRoomFromGroup\|StudyGroupCall\|groupCallMap\|inCall\|mutedCallers\|activeCallers\|enteredCall\|exitedCall\|startCall\|setActiveCall\|x_joined_a_call" frontend/webapp/src --include="*.js"` and delete/simplify every hit. Known surfaces: `views/_Common/Study/StudyGroupCall.js` (delete file + its svg/css imports), StudyGroupBar (CallCircle import, call sounds, blue tier), `getFreshUsers` (drop inCall/callers; colors collapse to green/yellow/grey per spec), appController (`startCall` dispatch fn, activeCall/activeCallers/mutedCallers state in appInit + processSignOut reset block), MessengerController (`fetchRoomFromGroup`, `groupCallMap`), MessengerContext noop stub (`fetchRoomFromGroup` entry + its stub test assertion), Theater/Drawer/PopUp references if grep finds them.

1. - [ ] Run the grep; build the full hit list; read each file's context before deleting (some hits are comments — fine to leave docs/ alone; do NOT edit docs/reference/studygroups.md history sections, but DO update its §5 study-hall text to say calls were removed 2026-06-12).
2. - [ ] Delete/simplify. Update the MessengerContext stub test (remove fetchRoomFromGroup assertion). Keep `preferences.sound` and non-call sounds intact.
3. - [ ] Acceptance: the grep returns zero JS hits (excluding docs/); full frontend suite green; webpack compiles with NO new warnings; localhost:8200 loads; StudyGroupBar renders (manual note for KC).
4. - [ ] Commit: `feat(study): gut stubbed voice calls — UI, state, controller, sounds`

### Task 5: Replier faces on messenger threads

**Files:** `backend/src/messaging/messages.ts` (assembleMessages thread-info block — read it; it already bulk-fetches reply counts), `backend/schema/Messenger.graphql` (MessengerThreadInfo + most_replied_users: [MessengerUser]), `backend/test/messaging/messages.test.ts` (append one test), frontend `models/MessengerController.js` MESSAGE_FIELDS, `models/messengerShapes.js` shapeThreadInfo (verify it maps most_replied_users via shapeUser — it does, just confirm), `views/_Common/Study/Study.js` ThreadedMessages (verify faces render from threadInfo.mostRepliedUsers; it already maps them to UserAvatar).

1. - [ ] Backend: in the thread-info bulk pass, also select per-parent the most-recent ≤5 DISTINCT replier user_ids (one windowed query over replies, mirroring the existing reply-count query; ROW_NUMBER pattern exists in `getMessagesForChannels` ~line 400-440). Resolve those ids through the SAME `getUsers` bulk call already made for authors (add the ids to the set BEFORE the call). Attach `most_replied_users: UserDTO[]` to thread_info.
2. - [ ] Test (append to messages.test.ts): seed parent + replies from 2 distinct users; `getMessages` parent's thread_info.most_replied_users contains both user_ids; reply_count still correct.
3. - [ ] SDL: `type MessengerThreadInfo { reply_count: Int most_replied_users: [MessengerUser] }`; codegen + tsc.
4. - [ ] Frontend: MESSAGE_FIELDS thread_info selection becomes `thread_info { reply_count most_replied_users { user_id nickname profile_url is_bot } }`. Confirm shapeThreadInfo maps it (messengerShapes.js — `most_replied_users` array → shapeUser) and ThreadedMessages renders faces. Add/extend one messengerShapes jest test: thread_info with most_replied_users yields shaped users with plainProfileUrl.
5. - [ ] All suites green both sides; restart bom-greenfield; live curl messengerMessages on a channel with threads (channel `4f7002d41a94cc82c02f8ddb543f6894` has threaded history) asserting most_replied_users appears.
6. - [ ] Commit: `feat(messenger): replier faces — thread_info carries most_replied_users everywhere`

### Task 6: Spec close-out

1. - [ ] Update spec status → Implemented (SHAs); update `docs/reference/studygroups.md` sections touched (invites, bans, calls, thread faces, §12 poll status) and `docs/reference/messenger-backlog.md` (drop stale reacter-avatar entry; mark StudyGroupCall poll resolved-by-removal).
2. - [ ] Commit: `docs: social hardening shipped — reference + backlog sync`
