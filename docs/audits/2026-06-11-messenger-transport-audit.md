# Messenger Transport Audit — socket push vs GraphQL pull

**Date:** 2026-06-11
**Scope:** `src/socket.ts` (535 lines), `src/library/messenger.ts`, `frontend/webapp/src/models/MessengerController.js` — which messenger data flows ride which transport, and which are on the wrong one.
**Trigger:** While verifying the SendBird-parity plan's backend assumptions, the socket layer turned out to be half-connected: the server broadcasts a richer event set than the client subscribes to, and the client polls GraphQL for data the server is already pushing.

## 1. The headline finding: a vocabulary mismatch, not missing infrastructure

Both halves of a push protocol exist; they were never reconciled:

| Server EMITS (`socket.ts`) | Client LISTENS (`MessengerController`) | Status |
|---|---|---|
| `message_received` / `message_updated` / `message_deleted` | same | ✅ connected |
| `typing` | `typing` | ✅ connected |
| `channel_action` | `channel_action` | ✅ connected |
| `member_joined` / `member_left` (socket.ts:456,464) | `user_joined` / `user_left` / `membership_changed` | ❌ **name mismatch — never received** |
| `reaction_added` / `reaction_removed` (socket.ts:474,482 — `io.emit`, global!) | `reaction_changed` | ❌ **name mismatch — live reactions dead** |
| `user_presence` (connect/disconnect/join/leave lifecycle, socket.ts:179,351,367) | *(nothing)* | ❌ **pushed, ignored** |
| `user_state` (update_state broadcast, socket.ts:304) | *(nothing)* | ❌ **pushed, ignored** |
| `read_receipt` (socket.ts:281) | *(nothing)* | ❌ pushed, ignored |
| *(nothing)* | `unread_count_changed` | ❌ **listened, never emitted** |

Server-side room plumbing is already correct: sockets auto-join all the user's channel rooms on connect (socket.ts:160-167), with explicit `join_channel`/`leave_channel` and a presence lifecycle on each transition.

## 2. Flow-by-flow: current transport vs right transport

| Flow | Today | Cost today | Right transport |
|---|---|---|---|
| **Study-room roster + presence dots** | GraphQL poll: `messengerUsers` on mount + every 60s per client (StudyGroupBar/StudyHall/StudyGroupCall), plus full-channel `refreshChannel` GraphQL re-fetch on every incoming message | N clients × 60s polls + a channel re-fetch per message; presence latency up to 60s | **Socket.** Subscribe to the already-broadcast `user_presence` + `user_state` + `member_joined`/`member_left` and patch the cached roster in place. Keep one GraphQL fetch for the initial roster. |
| **Channel list (initial)** | GraphQL `messengerMyChannels` on connect | one round trip | **GraphQL — correct as is.** Request/response data with no liveness requirement at load. |
| **Channel list (live membership changes)** | Broken: client waits for `membership_changed` which never arrives; admin actions rely on `channel.refresh()` (being added by the parity plan) | stale member lists until manual refresh | **Socket.** Rename-align `member_joined`/`member_left` (or subscribe to the server's names) → targeted member patch or single-channel re-fetch. |
| **Unread DM counts** | `loadUnreadDMs()` GraphQL call fired on **every** `message_received` (MessengerController:210) | one GQL query per incoming message per client — the chattiest path in the app | **Socket.** Either emit `unread_count_changed` server-side in `postMessage` (the client already listens for exactly this!) or include per-channel unread deltas in the `message_received` payload. |
| **Reactions (live)** | Client applies own reactions locally; remote reactions never arrive (name mismatch); server broadcast is `io.emit` — **global to all connected clients**, leaking reaction activity across channels and wasting fan-out | dead feature + global broadcast smell | **Socket**, fixed: align names AND scope to `io.to(channelUrl)`. |
| **Read receipts** | Emitted server-side, ignored client-side | dead traffic | Either subscribe (drives "seen" indicators) or stop emitting. Decide by product need. |
| **Message history / thread loads** | GraphQL | fine | **GraphQL — correct as is.** |

## 3. Recommendation

Yes — roster/presence, membership, reactions, and unread counts belong on the socket, and **the unlock is cheap**: this is event-name alignment plus client-side subscription handlers that patch cached state, not new infrastructure. The server already rooms correctly and broadcasts most of what's needed. Concretely:

1. **Align the vocabulary** (pick one side; renaming the client's listeners to the server's names is zero-risk since the client handlers are currently dead): `member_joined`/`member_left`, `reaction_added`/`reaction_removed`, `user_presence`, `user_state`.
2. **Patch, don't refetch:** new handlers update the `channels` Map members/roster in place (the parity plan's `messengerShapes` makes the shapes uniform, which is what makes in-place patching safe).
3. **Kill the polls:** delete the 60s roster interval and the per-message `refreshChannel` + `loadUnreadDMs` calls once push handlers cover them.
4. **Server fixes (small):** scope reaction broadcasts to the channel room; emit `unread_count_changed` (or unread deltas) from `postMessage`; optionally emit `member_joined`/`member_left` from the `messengerAddMember`/`messengerRemoveMember` mutation paths too (today only socket-initiated joins/leaves broadcast — GraphQL-initiated admin changes don't).
5. **Sequencing:** do this AFTER the SendBird-parity plan lands — parity normalizes the shapes and adds `refresh()`/roster code-paths this work then replaces, and both touch the same files. Backend `socket.ts` edits require a `bom-dev` restart (bounces the public dev URL — coordinate per CLAUDE.md).

**Suggested follow-up:** a "messenger live-transport" spec+plan (brainstorm → spec → plan) once parity is merged and verified. Estimated shape: ~2 backend tasks (event scoping/emission), ~3 frontend tasks (subscriptions + patching + poll removal), all guardable by the existing e2e login harness plus a two-client socket test in `test/socket.test.ts` (which already exists as a harness).
