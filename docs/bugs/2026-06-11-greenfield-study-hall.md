# Green-field study-group / study-hall bugs (found via community E2E)

**Date:** 2026-06-11
**Context:** Building the Playwright community E2E suite (`e2e/community/`) surfaced
several green-field messaging-shim bugs. Three were root-caused and fixed; one
display bug remains open. The shim is `frontend/webapp/src/models/MessengerController.js`
(the SendBird-compat layer over the green-field `/messenger` socket + `messenger*`
GraphQL).

---

## FIXED

### 1. `channel.createMetaData` is not a function — aborts the whole post-create flow
- **Symptom:** Creating a study group wrote the channel server-side, but the UI
  never activated it or opened the study hall, and the group list didn't refresh.
- **Cause:** `generateGroupHash()` (StudyGroupSelect.js) calls
  `group.createMetaData(data)`. The normalized channel object only implemented
  `updateMetaData` (SendBird exposed both). The missing method threw, so the
  `.then()` callback that runs `setActiveStudyGroup` / `openDrawer` /
  `getStudyGroups` never fired.
- **Fix:** Added `createMetaData` as an alias of `updateMetaData` on the
  normalized channel (`_normalizeChannel`).

### 2. Study-group bar dead for any account WITH a group (currentUser race)
- **Symptom:** With 0 groups the bar worked; as soon as the account had ≥1 group,
  the StudyGroupBar never became interactive (clicking it was a no-op), so you
  couldn't open the group list, switch groups, or open a study hall.
- **Cause:** On boot, `getStudyGroups()` (a fast GraphQL call) resolves and runs
  `setStudyGroups()` before `connect()` (another GraphQL roundtrip) has populated
  `_currentUser`. `setActiveStudyGroup()` bails early when
  `sb.currentUser` is null, so `activeGroup` was never set (only the
  0-groups path sets `activeGroup = -1` directly). The bar stays in its
  "loading" state forever.
- **Fix:** Initialize `_currentUser` to a synchronous stub
  (`_normalizeUser({ user_id: this.userId, metadata: {} })`) in the constructor;
  `connect()` later overwrites it with the enriched profile.

### 3. Messenger socket rejected as `unauthorized` — no real-time messaging at all
- **Symptom:** WS opens to `/messenger` then immediately `Connection error -
  unauthorized` → close → reconnect loop. No messages could be sent (the study
  hall composer's socket `send_message` never acked).
- **Cause:** `createChatController(...)` was passed
  `appController.states.user.social.access_token` as the socket token, which is
  **empty** after login. The backend `verifyToken` requires a valid
  `bom_user_token` row — i.e. the session token (`appController.states.user.token`).
- **Fix:** All three `createChatController` call sites in `appController.js` now
  pass `appController.states.user.token` (falling back to `social.access_token`).
- **Verified:** after the fix the socket logs `Connected via Socket.io` and a
  study-hall comment persists to `messenger_messages` (custom_type `comment`).

---

## OPEN

### 4. Study-hall message list does not render posted/loaded messages
- **Symptom:** A comment posted in a group's study hall persists to bom_prd
  (verified in the DB) but does **not** appear in the chat panel — the message
  list under the drawer renders empty (`.StudyHall` has no message content, and
  `.StudyGroupChat` is frequently absent).
- **Impact:**
  - You can post but not see your own (or others') messages in the study hall.
  - **Blocks the thread/reply UI** (`💬 reply` / `.replyBubble`) — there's no
    rendered message to start a thread on.
  - Likely blocks the page-linked comment display too (same chat list).
- **Status:** Not yet root-caused. The composer + socket + persistence all work;
  the gap is in `StudyGroupChat` (`StudyChat.js`) loading/rendering
  `loadGroupMessages()` results (possibly compounded by the socket
  reconnect churn after channel creation). The E2E covers the comment **write**
  via DB assertion and marks the thread test `fixme` pending this fix.

---

## E2E coverage status (`e2e/community/`)
| Flow | Status |
|---|---|
| Login (SignIn form) + /user study progress | ✅ passing |
| Enable/disable study mode | ✅ passing |
| Create a solo group (server-side verified) | ✅ passing |
| Switch between groups | ✅ passing |
| Post a comment in the study hall (write → DB) | ✅ passing |
| Start a thread (reply) | ⛔ `fixme` — blocked by bug #4 |
| Comment from a study page | ⛔ blocked by bug #4 (display) |
