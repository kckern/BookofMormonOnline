# Messenger: Frontend↔Backend Contract & Work-Ahead Roadmap

**Date:** 2026-06-10
**Scope:** Audit of `frontend/webapp/src/models/MessengerController.js` (the Sendbird
WebSocket replacement) against the green-field backend, and the prioritized work to reach
a staging cutover.

## Headline

**The backend is ~90% there.** `MessengerController` talks over two transports — **GraphQL**
(queries + a few mutations) and **Socket.io at `/messenger`** (everything real-time). Both
are live: the socket server is mounted on Fastify with handshake auth, channel rooms, a
RealtimeBus fan-out, presence, and an AI bot responder. Nearly every event the client uses
is implemented. What remains is **conformance verification, a few small gaps, security
hardening, and the complete absence of socket tests** — not building the layer.

---

## Contract matrix

### GraphQL (client → backend) — all IMPLEMENTED & tested
`messengerUser` · `messengerMyChannels` · `messengerChannel` · `messengerChannelOperators`
· `messengerMessages` · `messengerMessage` · `messengerThreadMessages` · `messengerUnreadDMs`
· `messengerCreateChannel` · `messengerUpdateChannel` · `messengerUpdateUser`
· `messengerUpdateUserMetadata` · `messengerUpdateMemberRole` · `messengerRemoveMember`
· `messengerInviteMembers` · `messengerAcceptInvitation` · `messengerDeclineInvitation`

Covered by `test/messaging/community-graphql*.test.ts` + `test/graphql/mutations.test.ts`.
Schema was de-duplicated (dead `BomMessenger.graphql` removed). ✓

### Socket.io events

| Event | Dir | Backend | Notes |
|---|---|---|---|
| send_message | in | ✅ | `postMessage` + broadcast `message_received`; triggers bot responder |
| edit_message | in | ✅ | `updateMessage` + `message_updated` |
| delete_message | in | ✅ | `deleteMessage` + `message_deleted` |
| add_reaction / remove_reaction | in | ✅ | + `reaction_changed` (full reactions array) |
| mark_read | in | ✅ | + `unread_count_changed` (unicast to actor) |
| typing_start / typing_stop | in | ✅ | broadcast `typing` (excl. sender) |
| fire_action | in | ✅ | broadcast `channel_action` (study-group scroll/page sync) |
| update_state | in | ✅ | `updateUserMetadata` + emits `user_state` |
| message_received / _updated / _deleted | out | ✅ | to channel room via RealtimeBus |
| reaction_changed | out | ✅ | `{channelUrl, messageId, reactions[]}` |
| typing / channel_action | out | ✅ | direct `socket.to(channel)` |
| membership_changed / user_joined | out | ✅ | from GraphQL mutations via RealtimeBus |
| unread_count_changed | out | ✅ | unicast on mark_read |
| **user_left** | out | ⚠️ **never emitted** | client listens (line 146) but only `membership_changed` is sent on removal |
| **user_state** | out | ⚠️ **no client listener** | backend broadcasts it; `MessengerController` ignores it |

---

## Gaps & conformance issues (prioritized)

### P1 — must resolve before a staging cutover

1. **Reaction-sync contract is unverified and likely broken.**
   - Backend `reaction_changed` payload = `{channelUrl, messageId, reactions: [{reaction_key, user_ids}]}`.
   - `MessengerController` dispatches `reactTo{messageId}` with `reactionEvent = <that payload>`;
     `Study.js:1140` calls `message.applyReactionEvent(e.reactionEvent)`.
   - But `_normalizeMessage()` (MessengerController.js:228) does **not** attach an
     `applyReactionEvent` method (only `applyThreadInfoUpdateEvent`), and the optimistic
     local path passes a *different* shape `{messageId, key, userId, operation}`. So there are
     two payload shapes and a possibly-missing method. **Verify end-to-end on staging; align the
     payloads and add `applyReactionEvent` to the normalized message** so reactions render live.

2. **No socket-layer tests at all.** The entire real-time surface (auth rejection, acks, room
   broadcasts, reactions, typing, mark_read, fire_action relay, bot responder) is untested.
   Add `test/realtime/*` integration tests driving a real `socket.io-client` against an
   in-process server (reads work read-only; writes assert sandbox/ack shape like the GraphQL
   mutation tests).

3. **`messengerUpdateChannel` has no operator auth gate** (resolver reads no bearer/role) —
   any authenticated user can rename/redescribe any channel. Add an operator check like the
   other channel mutations. (Security.)

### P2 — cleanup / consistency

4. **`user_left` vs `membership_changed`.** Functionally redundant today (both call
   `refreshChannel`), so nothing is broken — but make it intentional: either emit `user_left`
   on removal for symmetry, or drop the dead client listener.
5. **`user_state` is a dead broadcast** (no client listener). Either wire the client to use it
   (presence/active-group sync) or stop emitting it.
6. **Masked write failures.** `requestToJoinGroup` (community.ts) and `messengerInviteMembers`
   (messenger.ts) swallow insert errors in an inner catch and report success — they can't tell
   a real failure from a duplicate. Tighten to detect genuine errors. (Surfaced by the mutation tests.)
7. **Duplicate `shortlink` resolver** in `useractivity.ts` and `searchhist.ts` — consolidate.

### P3 — feature parity / deferred

8. **Ban / mute members.** Schema has `messenger_members.is_muted` + DTO field, but there is **no
   mutation/handler to set it**, and the client `muteMember`/`banMember`/`unMuteMember` are stubs.
   Build the mutations + socket handling if parity is required.
9. **`uploadProfileImage` is a stub** — S3 write not ported (`src/library/s3.ts`). Port the
   resize-to-256²-JPEG → S3 `profiles/<md5>.jpg` path (matches the avatar-derivation convention).
10. **Voice/video calls** — `createNewRoom`/`fetchRoom`/etc. are stubs on both sides. Explicitly
    out of scope unless prioritized.

### Production-readiness

11. **Redis adapter** is optional (single-instance fallback). For multi-instance staging/prod,
    set `REDIS_URL` so fan-out + presence work across nodes; verify the adapter path.
12. **Profile-image S3 migration** (`assets.bookofmormon.online/profiles/`) — the seed assumes
    derived avatars; confirm the migrated images exist or the dicebear fallback covers it.
13. **Load characteristics** — re-check homefeed (post N+1 fix, ~440ms) and socket fan-out under
    realistic channel sizes; the homefeed audit lists further headroom if needed.

---

## Recommended sequence to staging cutover

1. **Harden + verify the core loop (P1).** Add socket integration tests; with them in place,
   fix the reaction-sync contract and the `messengerUpdateChannel` auth gate. This is the
   highest-risk, highest-value block — it makes the live send/react/typing loop trustworthy.
2. **Consistency pass (P2).** Resolve `user_left`/`user_state`, the masked writes, and the
   duplicate resolver — small, mechanical, mostly test-guarded.
3. **Cutover dry-run.** Point a staging subdomain (the runtime feature flag) at the green-field
   backend with `REDIS_URL` set; run the study-group smoke (create group, post, react, thread,
   typing, scroll-sync, DM unread) end-to-end with two browsers.
4. **Parity backlog (P3) as needed** — ban/mute, profile-image S3 — driven by what staging
   surfaces.

## What this means
The remaining work is **verification + hardening + tests**, not construction. The single most
valuable next step is the **socket integration test suite** — it both proves the real-time loop
and de-risks every fix after it. The reaction-sync contract is the one place a real client bug
likely hides.
