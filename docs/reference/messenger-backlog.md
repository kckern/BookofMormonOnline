# Messenger Backlog — known issues deferred from the 2026-06-11 parity effort

Consolidated from the SendBird-parity execution's task reviews (plan: `docs/plans/2026-06-11-sendbird-parity.md`; final review verdict: ready, all items below are pre-existing or accepted-out-of-scope). Update in place as items are fixed.

| # | Item | Where | Notes |
|---|---|---|---|
| 1 | `messageReacters` indexes members by reaction-array position instead of matching ids — wrong avatars on reaction hovers | `frontend/webapp/src/views/_Common/Study/Study.js:1113-1127` | fix: `memberMap.find(m => m.userId === id)` |
| 2 | Notebook `threadInfo.replyCount` snake/camel mismatch — reply badge renders undefined | `MessengerController.js:296`, consumer `StudyGroupNotebook.js:70` | map `thread_info.reply_count` → `{replyCount}` |
| 3 | `loadGroupMessages` hardcodes `limit: 30` — query-object `limit=100` and Page comment counts only ever see the latest 30 messages | `MessengerController.js:492`, `Page.js:508-513` | thread a limit param to the backend query |
| 4 | Edit-path mentions: `updateUserMessage` doesn't merge `mentionedUserIds`; editing can't add/change mentions (existing ones survive) | `MessengerController.js:1263`, `backend/src/realtime/handlers/message.ts` EditMessagePayload | add `data` passthrough with merge semantics mirroring send |
| 5 | StudyGroupCall 1s `getLiveRoom` call-state poll — last surviving poll; convert to socket push | `StudyGroupCall.js:57` | violates the websockets directive; needs a call-state event server-side |
| 6 | readstate test helper builds ids that overflow `message_id` (8 failing tests) + a clock-skew-sensitive assertion | `backend/test/messaging/readstate.test.ts:148-150, 373-375` | test-only; shorten ids, tolerance on timestamp |
| 7 | `/user` Profile crash: `Invalid language tag: ''` passed to `Intl.NumberFormat` via `Duration.durationFormat` — kills the React tree on the profile view | Profile component (User view chunk) | allowlisted in `e2e/study-userlist.spec.js`'s crash guard |
| 8 | Presence is single-instance (REDIS_URL unset) and per-user not per-socket — multi-tab close broadcasts false offline; no cross-replica fan-out | `backend/src/messaging/presence.ts`, `backend/.env` | set REDIS_URL + refcount sockets per user |
| 9 | Dead controller helpers retained pending consumer re-grep (`banMember`, `muteMember`, `declineInvitation`, …) | `MessengerController.js` | prune after grep |
| 10 | `message_received` runs `_normalizeMessage` up to 4× per inbound event | `MessengerController.js:213-234` | normalize once, reuse |

Related (non-messenger) deferred items live in the audits: Read/Theater manual checklists (`docs/plans/2026-06-11-*`), Page reducer per-row `new Audio` + ghost `ended` listeners (`docs/specs/2026-06-11-page-scroll-manager.md` §7).
