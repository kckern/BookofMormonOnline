# Notification Bell — End-to-End Wiring

Date: 2026-06-13
Author: Claude (full-stack)
Status: Implemented + verified on dev (frontend HMR live, backend `bom-greenfield` restarted)

## Problem

The header notification bell (`Header.js`) opened a `NotificationList` that
hard-coded "no notifications" — no data, no mark-as-read, no badge. Make it
real, end-to-end, without polling, and keyboard-accessible.

## Data source chosen — and why

**No notifications table exists** anywhere in `backend/` (a full search for
"notification" returned nothing). Rather than invent a table, the feed is
**derived from existing messenger data** — the events that are genuinely
relevant to a user:

| Type       | Derived from                                                                 |
|------------|------------------------------------------------------------------------------|
| `reply`    | `messenger_messages` rows whose `parent_message_id` points at a top-level message the user authored (and `user_id != me`). |
| `reaction` | `messenger_reactions` rows on a message the user authored (`user_id != me`). |
| `invite`   | `messenger_members` rows where `user_id = me AND state = 'invited'`, joined to `messenger_channels` for the group name. |

These are real, user-relevant events with real actors and real navigation
targets — not fabricated placeholders.

### Read state (no schema change)

There is no per-notification read column, so read state is persisted in the
user's existing `messenger_users.metadata` JSON:

- `notificationsReadAt` — ms-epoch watermark. Everything with `created_at <=`
  this is read. "Mark all read" sets it to `NOW()` and clears the explicit set.
- `notificationsRead` — `string[]` of notification ids explicitly marked read
  (single mark-read) for items newer than the watermark.

Notification ids are deterministic from their source so the same event always
yields the same id (idempotent mark-read across refetches):
`reply:<messageId>` · `reaction:<messageId>:<actorId>:<key>` · `invite:<channelUrl>`.

A 30-day lookback window and a 50-item cap keep the derivation bounded (this is
an unread feed, not an archive).

## Backend

New service: `backend/src/messaging/notifications.ts`
- `getNotifications(db, userId)` — bulk-assembled (one query per source + one
  `getUsers()` for all actors; no N+1, matching the codebase pattern).
- `getUnreadNotificationCount(db, userId)`
- `markNotificationRead(db, userId, id)` / `markAllNotificationsRead(db, userId)`
- `pushNotificationForEvent(db, {...})` — realtime helper (see below).

GraphQL surface (SDL in `backend/schema/Messenger.graphql`, resolvers in
`backend/src/graphql/resolvers/messenger.ts`):
- Query `notifications: [Notification]`
- Query `notificationUnreadCount: Int`
- Mutation `markNotificationRead(notificationId: String): Boolean`
- Mutation `markAllNotificationsRead: Boolean`
- Type `Notification { id type actor channel_url message_id text created_at is_read }`

All are auth-only: the resolver derives the acting user via the existing
`resolveActingUserId(ctx)` (bearer token → `md5(username)`); an unauthenticated
caller gets `[]` / `0` / `false`.

Tests: `backend/test/messaging/notifications.test.ts` (vitest, real DB, tracked
throwaway rows cleaned in `afterEach`) — 6 tests, all passing: reply/reaction/
invite surfacing, own-event exclusion, single mark-read, mark-all.

## Realtime (no polling — socket push + in-place patch)

Per the project directive, new notifications are **pushed**, not polled:

1. `server.ts` now joins each socket to a personal room `user:<userId>` on
   connect (alongside its channel rooms).
2. The `send_message` handler (on a reply) and the `add_reaction` handler call
   `pushNotificationForEvent`, which resolves the target message's author and
   emits `notification_received` to `user:<authorId>` (self-events skipped).
   Fire-and-forget — never blocks the message/reaction ack.
3. The frontend `MessengerController` listens for `notification_received` and
   dispatches `addNotification`, which prepends the item and bumps the badge in
   place (deduped by id).

Non-realtime refresh: the badge count is seeded once on login bootstrap
(`MessengerContext`), and the full feed is fetched lazily when the bell is
opened. No `setInterval` anywhere.

## Frontend

- `appController.js` — `notification` state extended with `items`,
  `unreadCount`, `loading`; new dispatch fns: `setNotifications`,
  `setNotificationUnreadCount`, `addNotification`, `markNotificationRead`,
  `markAllNotificationsRead`. `openNotification` now lazy-fetches the feed.
- `MessengerController.js` — `loadNotifications`, `loadNotificationUnreadCount`,
  `markNotificationRead`, `markAllNotificationsRead`, and the
  `notification_received` socket listener.
- `MessengerContext.js` — bootstraps the unread count on login; noop-stub gains
  the four notification methods.
- `Header.js` — the bell shows an unread-count badge; `NotificationList` binds
  to real data, renders actor avatar + text + unread dot, has a "mark all read"
  control, and an empty state shown only when genuinely empty. Clicking an item
  navigates to its target (`group/<channel>/<message>` for reply/reaction,
  `group/<channel>` for invite), marks it read, and closes the dropdown.
- `Header.css` — badge, dropdown header, item button, unread styles.

## Accessibility

- Bell trigger is a real `<button>` with `aria-haspopup`, `aria-expanded`
  (reflects open state), and an `aria-label` that includes the unread count
  ("Notifications (2 unread)").
- The dropdown is `role="dialog"` with an `aria-label`; `Escape` closes it.
- Each notification item is a `<button>` (keyboard-focusable/operable); the
  "mark all read" control is a `<button>`. The unread dot/badge are
  `aria-hidden` (count is already in the bell's label).

## Verification (evidence)

Verified as Staff (`b0c4b5`, messenger id `fd1bfdfce58c2f8523c1bb067f705668`)
via Playwright (`e2e/adversarial/driver.js`) against `http://localhost:8200`.

Test data generated (DB insert, tagged `__e2e__`, since cleaned up):
- a reply to Staff's message `17812297128` ("are we back?") from Member A, in
  channel `08e1a6987e4d8dab52919b6191f279aa`;
- a `love` reaction on the same message from Member D.

GraphQL (direct, Staff bearer):
- `notificationUnreadCount` = **2**; `notifications` returned the reply +
  reaction with correct actor names, channel, target message, `is_read: false`.
- `markNotificationRead(reaction…)` → unread **2 → 1** (correct item flipped).
- `markAllNotificationsRead` → unread **→ 0**.

Browser (UI):
- Bell badge shows **2**; `aria-label` = "Notifications (2 unread)";
  `aria-expanded` toggles `false → true` on open.
- Dropdown lists both real items: "Member A replied to your comment",
  "Member D reacted to your message".
- Items are focusable `<button>`s (focused element class
  `NotificationList-item`).
- Clicking the reply navigated to
  `/group/08e1a6987e4d8dab52919b6191f279aa/17812297128`; on reopen the badge
  was **1** with a single unread dot (reply read, reaction still unread).
- "Mark all read" cleared the badge to **0** and removed all unread dots.

Screenshots: `docs/audits/study-group-loop-screenshots/bell/`
- `01-01-bell-with-badge.png`, `02-02-dropdown-open.png`,
  `03-03-item-focused.png`, `04-04-after-mark-all-read.png`,
  `01-05-after-item-click-navigated.png`, `02-06-after-click-reopened.png`.

### Cleanup

All `__e2e__` rows deleted (1 reply + 1 reaction — only rows I created;
verified 0 remaining). Staff's notification metadata keys removed. Temp driver
scripts and the cached token file removed.

## Checks

- `cd backend && npm run typecheck` — clean.
- Backend notifications tests — 6/6 pass (also pass alongside `messages.test.ts`).
- `cd frontend/webapp && npx eslint <changed files>` — 0 errors (3 warnings, all
  pre-existing in `MobileHeader` / the `lang` import, untouched by this work).
- Frontend bundle compiles on the CRA dev server (:8201); changed symbols
  present in the live bundle.

## Out of scope / notes

- `backend/test/messaging/readstate.test.ts` and `presence.test.ts` have
  pre-existing failures (oversized `test_msg_${nanoid(8)}` ids > `varchar(11)`,
  and a `last_seen_at` assertion). They fail in isolation on the untouched
  branch and are unrelated to this change — left as-is.
- Reply/reaction notifications require the parent message to be within the
  30-day lookback. Invites have no lookback (a pending invite is always
  actionable).
