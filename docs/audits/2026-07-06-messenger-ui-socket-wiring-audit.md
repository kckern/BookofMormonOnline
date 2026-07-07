# Messenger UI ↔ WebSocket Wiring Audit

> **Resolution (2026-07-06, same day):** G1–G5 fixed on dev. G1: `RealtimeBus.joinRoom/leaveRoom` (`socketsJoin`/`socketsLeave` via the personal room) called from every membership mutation — create/accept/joinGroup/joinOpenGroup/processRequest-grant/addBot join; remove/ban/removeBot leave (emits fire before eviction so the affected user gets their live kick) — covered by `test/realtime/roomSync.test.ts` (4 tests, green) + token-gated cases in `socket.test.ts`. G2: LikeButton listener moved into a keyed `useEffect` with cleanup. G3: `user_left` naming me now refreshes the group list (live kick); StudyGroupAdmin re-syncs roster + operators off a roster signature. G4: Feed items subscribe to `addMessageToThread<id>` — others' replies render live (backlog #12 closed). G5: Notebook crash guard + debug output removed (panel remains hidden). Remaining "fix soon after" items below are still open, including the Invitation.js retry interval (kept: it papers over an activeGroup state race, not just the room gap).

**Date:** 2026-07-06
**Scope:** Realtime websocket contracts between the UI components and the greenfield backend — `frontend/webapp/src/views/_Common/Study/*`, `_Common/Group.js`, `_Common/Main.js`, `Home/*`, `Page/*`, `User/Invitation.js`, via `MessengerController.js` (socket.io `/messenger`) against `backend/src/realtime/`.
**Question:** Any wiring gaps, or ready for prime time?
**Companion:** `2026-07-06-sendbird-replacement-launch-readiness.md` (deps/parity/deploy).

---

## Verdict

**The event contract itself is healthy** — every client emit has a backend handler, every backend broadcast has a client listener, no orphans, no dead listeners. The core chat loop (send/edit/delete → broadcast → render), reactions, typing, page comments, and the notification bell are all wired end-to-end and clean up their listeners.

**But there is one structural hole and a handful of component-level gaps that I would fix before prime time:**

1. **Socket rooms are joined only at connect — nothing updates them mid-session.** Join a group, create a group, accept an invite, get a DM started with you: your live socket is not in that channel's room, so you receive **no realtime events for it until you reload**. Conversely, get banned or removed: your socket **stays in the room** and keeps receiving the channel's live traffic for the rest of your session.
2. **Study.js reaction listeners stack up per render** (registered in the render body, never cleaned up) — duplicate reaction application and a leak.
3. **StudyGroupAdmin has zero realtime wiring** — member/role/ban changes made by others never appear without a manual refresh.
4. **Known backlog #12 confirmed live:** the home feed gets other users' replies only on visibility-triggered refetch.
5. **StudyGroupNotebook is prototype-grade** (hardcoded badge, hardcoded verse, crash on null `threadInfo`, debug output) — hide it or finish it before launch.

Details and evidence below. Findings marked ✅ were verified directly in source; the rest come from the fan-out audit passes and matched all spot-checks.

---

## 1. Socket contract inventory (both directions) — HEALTHY

### Client → server (all handled)

| Event | Client emit | Backend handler | Ack | Notes |
|---|---|---|---|---|
| `send_message` | MC.js:692,1292 | handlers/message.ts:79 | ✓ | payload fields match |
| `edit_message` | MC.js:1432 | handlers/message.ts:136 | ✓ | client sends `customType`; `EditMessagePayload` doesn't declare it (works at runtime, drift) |
| `delete_message` | MC.js:1452 | handlers/message.ts:168 | ✓ | |
| `add_reaction` / `remove_reaction` | MC.js:1381,1406 | handlers/reaction.ts:54,85 | ✓ | |
| `typing_start` / `typing_stop` | MC.js:1371,1374 | handlers/typing.ts:36,48 | — | |
| `mark_read` | MC.js:1333 | handlers/read.ts:38 | ✓ | |
| `fire_action` | MC.js:721 | handlers/action.ts:38 | — | study-group action relay (typing location, page position) |
| `update_state` | MC.js:731 | handlers/action.ts:49 | — | ⚠ persists via `updateUserMetadata` — the backlog #11 clobber path |

### Server → client (all listened)

| Event | Backend origin | Room | Client listener | Notes |
|---|---|---|---|---|
| `message_received` | message.ts:108, botResponder.ts:139 | channel | MC.js:140 | full MessageDTO incl. `thread_info`, `reactions`, `user` |
| `message_updated` / `message_deleted` | message.ts:156,185 | channel | MC.js:145,150 | |
| `reaction_changed` | reaction.ts:41 | channel | MC.js:164 | full reaction snapshot |
| `typing` | typing.ts:40,51 | channel (sender excluded) | MC.js:156 | |
| `channel_action` | action.ts:40 | channel (sender excluded) | MC.js:171 | |
| `user_presence` | server.ts:241,265 | channel rooms | MC.js:235 | |
| `unread_count_changed` | message.ts:111 (broadcast `{channelUrl}`), read.ts:54 (unicast adds `unreadCount`) | channel / socket | MC.js:207 | ✅ listener ignores payload entirely — 500ms-debounced `loadUnreadDMs()` refetch; unicast `unreadCount` field is dead weight |
| `notification_received` | notifications.ts:317 | `user:<id>` | MC.js:226 | in-place bell patch, no refetch ✓ |
| `membership_changed` | messenger.ts (8 mutation sites) | channel | MC.js:181 | flexible payload → `refreshChannel()` |
| `user_joined` | messenger.ts:728 emits `{channelUrl, userId}` | channel | MC.js:191 destructures `{channelUrl, user}` | ✅ field-name mismatch — harmless today (`user` unused; both just `refreshChannel`), but the contract has drifted |
| `user_left` | messenger.ts:598,627 emits `{channelUrl, user}` | channel | MC.js:199 | inconsistent with `user_joined`'s `userId` key |

**Moderation actions** (ban/unban/remove/mute/role/invite/accept/decline) travel as GraphQL mutations that then broadcast `membership_changed` (+ `user_joined`/`user_left`) to the channel room — the transport loop is correct; whether components *react* is a different story (§3).

---

## 2. The structural gap: static room membership ✅ VERIFIED

`backend/src/realtime/server.ts:226,232` is the **only** place sockets join rooms — at connect, from `getUserChannelUrls(userId)` (state=`joined` at that moment) plus the personal `user:<id>` room. `grep socketsJoin|socketsLeave` across `backend/src` returns **nothing**, and the client never joins rooms.

Consequences, all until the affected user happens to reconnect (reload):

| Scenario | Effect |
|---|---|
| Create a new study group | Creator's live socket is not in the new room — **no live messages/typing/reactions in their own new group** |
| Accept an invitation | Same for the accepter. This is almost certainly why `Invitation.js:86-93` has a 5s×10 `setInterval` retry hack (see §4) |
| Someone opens a new DM with you | Your socket isn't in the DM room → the messages AND the room-scoped `unread_count_changed` never reach you → **new DM conversations are completely silent until reload** (`notification_received` doesn't cover plain DMs — only replies/reactions/invites) |
| You get banned/removed | Your socket **stays in the room** — you keep receiving that channel's live messages for the rest of your session (privacy/moderation leak; the ban blocks re-entry and posting, but not the already-open firehose) |

**Fix (server-side, small):** in the membership mutations (`messenger.ts` accept/invite/create/join) call `io.in('user:<userId>').socketsJoin(channelUrl)`, and in ban/remove call `socketsLeave(channelUrl)`. Socket.io's server API supports this without client cooperation. Add a room-membership assertion to `backend/test/messaging/socket.test.ts`.

This is the single highest-value fix in the audit: it converts four user-visible realtime failures (and one leak) with one mechanism.

---

## 3. Per-cluster findings

### Study cluster

| Component | Realtime wiring | Gaps |
|---|---|---|
| **Study.js** (comment threads) | Thread listeners (`addMessageToThread<id>`, `updateMessageInThread<id>`, `deleteMessageFromThread<id>`) registered/unregistered correctly in useEffect (644-675) ✓. Typing-location round trip verified end-to-end (emit `fire_action` → `channel_action` → Main.js → appController → render). | ✅ **Reaction listener registered in render body** (`if (!init)` at ~1211): the handler is a new identity each render, so the preceding `removeEventListener` never removes anything — **a new duplicate listener stacks on every render until the first reaction event arrives, and none are removed on unmount**. Duplicate `applyReactionEvent` application + leak. Move to useEffect with cleanup. |
| **StudyChat.js** | `addMessage`/`updateMessage`/`deleteChatMessage` + per-thread reply-count listeners all registered/cleaned ✓; message dedup on append ✓. | `note.threadInfo.replyCount`-style unguarded reads (line ~83); explicit TODO at ~793: notebook reply counts not live. Unguarded `sb.currentUser.nickname` read (~689) vs the signed-out noop stub. |
| **StudyHall.js** | `memberPresenceChanged` listener with 1s debounce, cleaned up ✓. | Join/leave reaches it only via `refreshChannel` GraphQL refetch — acceptable. |
| **StudyGroupBar.js** | Presence listener + debounce cleaned up ✓. The previously reported "dead 60s presence poll" is **gone** — current timers are debounces (1s presence, 100ms initial fetch), not polls. | Roster capped at 11 rendered users — presence changes for #12+ invisible (cosmetic). |
| **StudyGroupAdmin.js** | ✅ **Zero realtime listeners.** Fetches operators once on mount (48-58); after its *own* actions it does `group.refresh()` — reactive only. | Another operator's ban/mute/role change, or any join/leave, never appears live. The banned user gets no live kick (compounded by §2: they keep receiving room traffic). Wire it to `membership_changed`/`user_joined`/`user_left` (a window listener re-fetching members would do). Also unguarded `activeGroup.members` read (line 238). |
| **StudyGroupNotebook.js** | ✅ **Prototype-grade, no realtime.** Hardcoded badge `{5}` (line 74), hardcoded heading `1 Nephi 4:3`, debug `{activeNotes?.length}` rendered into the DOM, raw `note.data` in a `<pre>`, and `note.threadInfo.replyCount` unguarded → **TypeError when threadInfo is null** (line 83; backlog #2 territory). | Hide the tab or finish the component before launch. |
| **DirectMessages.js** | Delegates to the chat panel; DM-pair dedup + isMounted guards ✓. | New-DM arrival for the *recipient* is broken by §2, not by this component. |
| **Main.js** (event hub) | `fireStudyGroupAction`/`fireMessage`/`typingStatusUpdated`/`visibilitychange`/`beforeunload` wired ✓. ✅ The remove-before-add pattern in its useEffect is ineffective across mounts (new function identities) and there is **no unmount cleanup** — listeners from a dead mount survive with stale `appController` closures. Low blast radius while Main mounts once per session; fix is a cleanup return. | `beforeunload` sendBeacon posts a `closetab` GraphQL query — fine, but note it bypasses the socket. `visibilitychange` → `update_state` is the backlog #11 metadata-clobber trigger. |

### Home / Page / Group cluster

| Component | Realtime wiring | Gaps |
|---|---|---|
| **Feed.js / Home.js** | Own posts/replies optimistic ✓; likes go over socket `reaction_changed` ✓. | ✅ **Backlog #12 confirmed in current code:** no `addMessage`/`fireMessage` listener anywhere in Feed.js — other users' replies arrive only via `handleVisibilityChange` → `loadCommentsFromAPI` (295-299). MC.js already dispatches a global `addMessage` CustomEvent (261); Feed just needs to subscribe and route matching parents into state. |
| **Page.js** (page comments) | Best-wired consumer: posts with `custom_type=<pageSlug>`; MC.js:266-272 dispatches `addMessageToPage-<slug>` / `updateMessageToPage-<slug>`; Page reducer patches `pageComments` in place ✓. Remove-before-add listener pattern acceptable for page-scoped loads. | **Per-verse comment counts are load-time snapshots** — a comment arriving live updates the thread but not the verse-count badges until navigation. 2.5s `COMMENTS_FALLBACK_MS` timer is cleared ✓. |
| **GroupComment.js** | ✅ Dead code: `return null` on line 5, unreachable JSX below, **imported nowhere**. Delete it. | — |
| **Narration.js** | `updatePagePosition` → `fire_action` relay ✓, optional-chained ✓. | — |
| **Group.js** (deep-link to a group thread) | Loads via `loadPreviousMessages` after a hardcoded `setTimeout(…, 2000)`. | ✅ Timer is never cleared in the effect cleanup (only `setParentMessage(false)`) → late setState on unmount; and no null guard on `appController.sendbird` (crash if signed out on a deep link). Replace magic 2s wait with a readiness signal. |
| **Invitation.js** | Accept flow works (GraphQL join → `getStudyGroups` refresh). | ✅ **5s×10 `setInterval`** (86-93) re-asserting `setActiveStudyGroup` until local state sticks — a state-sync retry hack, likely compensating for the §2 room gap / refresh races. No `sendbird` null guard in the accept path. Other members see the join only via `membership_changed`→`refreshChannel` (works — their sockets are already in the room). |
| **ReadingPlan.js** | REST-only; peers' progress not live. | Acceptable for launch; note it against the no-polling directive's spirit. |
| **Notification bell** (Header) | `notification_received` → `addNotification` in-place patch + optimistic mark-read ✓. | Notifications emitted while disconnected are lost (no backfill on reconnect) — the bell's initial fetch on load covers most of this. |

### Lifecycle / robustness (controller level)

- **Reconnect:** socket.io auto-reconnect (1s→5s backoff, 10 attempts); backend re-derives rooms at handshake — so a reload/reconnect *heals* all §2 staleness. **No missed-event backfill** on reconnect (messages sent during a disconnect are absent until the next channel load).
- **Sign-out teardown:** MessengerContext swaps in the noop stub, disconnects, and a singleton guard (MC.js:107-110) force-kills leaked sockets (HMR/re-signin) ✓. Two unguarded `sb.currentUser.nickname` reads (Study.js:107, StudyChat.js:689) can hit the stub.
- **Token expiry mid-session:** handshake-only auth; a revoked token surfaces only as failed reconnects with no user-facing recovery. Acceptable now; log it.

---

## 4. Ranked gap list

### Fix before prime time

| # | Gap | Where | Fix shape |
|---|---|---|---|
| G1 | **No mid-session room sync** — new groups/DMs/invites deaf until reload; banned users keep receiving room traffic | `backend/src/realtime/server.ts:226` (only join site); membership mutations in `messenger.ts` | `socketsJoin`/`socketsLeave` in the membership mutations + socket test |
| G2 | **Reaction listener stacking** — duplicate handlers per render, never removed | `Study.js` ~1206-1222 | move to useEffect keyed on `message.messageId` with cleanup |
| G3 | **StudyGroupAdmin not live** — others' moderation/membership changes invisible; no live kick for banned users | `StudyGroupAdmin.js` (no listeners) | subscribe to `membership_changed`/`user_joined`/`user_left` → refetch members |
| G4 | **Feed #12** — others' replies only on visibility refetch | `Feed.js:295-299` | subscribe to MC's existing `addMessage` CustomEvent |
| G5 | **Notebook prototype** — crash on null `threadInfo`, hardcoded badge/verse, debug output, no realtime | `StudyGroupNotebook.js:74-83` | hide the tab for launch, or finish it |

### Fix soon after

- Invitation.js 5s retry interval → delete once G1 lands (`Invitation.js:86-93`); add `sendbird` null guards there and in `Group.js`.
- Group.js: clear the 2s timer in cleanup; replace magic delay with readiness check (`Group.js:30-40`).
- Main.js: add unmount cleanup for its five window listeners.
- Page per-verse count badges: bump counts from the `addMessageToPage` path.
- Guard `sb.currentUser.nickname` reads against the noop stub (Study.js:107, StudyChat.js:689).

### Cosmetic / contract hygiene

- Unify `user_joined`(`userId`) vs `user_left`(`user`) payload keys (harmless today — both unused).
- Declare `customType` in `EditMessagePayload` (`handlers/message.ts:51-56`).
- Drop the unused `unreadCount` field from the `mark_read` unicast, or use it and skip the refetch.
- Delete dead `GroupComment.js`.
- Notebook badge `{5}` (subsumed by G5).

### Explicitly OK

- No polls remain anywhere in the audited surface — all timers are debounces/one-shots. The previously reported StudyGroupBar 60s presence poll is gone. KC's no-polling directive: **compliant** (Invitation's retry interval is a local-state hack, not a network poll — and dies with G1).
- Listener cleanup is correct in Study.js threads, StudyChat, StudyHall, StudyGroupBar, Page.js, DirectMessages.
- Optimistic updates (feed posts, page comments, reactions) all reconcile against socket broadcasts without duplication (message dedup by id).

---

## 5. Bottom line

The transport layer is prime-time ready; the wiring above it is ~80% there. **G1 (room sync) is the one backend change I'd insist on before launch** — it silently breaks the "join a group and start talking" first-run experience and leaks live traffic to banned users. G2–G5 are small, contained frontend fixes (a day of work total). Everything else is post-launch hygiene.

Verified-by-hand items are marked ✅; the full three-pass agent evidence (per-file, file:line) matched every spot-check performed.
