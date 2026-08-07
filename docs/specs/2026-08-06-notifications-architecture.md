# Notifications System — High-Level Architecture

Date: 2026-08-06
Status: Draft for review (KC input needed on open questions, §5)
Scope: Design only — no implementation plan, no migrations authored here.

## 1. Where we are (verified against the live tree)

The in-app notification bell shipped 2026-06-13 (commit 822688fb; audit:
`docs/audits/2026-06-13-notification-bell.md`). It is a **derived** system:

- `backend/src/messaging/notifications.ts` reconstructs the feed per request
  from three messenger sources — replies to my top-level messages, reactions to
  my messages, pending group invites. 30-day lookback, 50-item cap, constant
  query count.
- **No notifications table.** Read state lives in `messenger_users.metadata`
  JSON: `notificationsReadAt` (ms watermark) + `notificationsRead` (explicit
  read-id set, pruned against the watermark).
- IDs are deterministic from the source event:
  `reply:<msgId>` · `reaction:<msgId>:<actorId>:<key>` · `invite:<channelUrl>`.
- Realtime: sockets auto-join `user:<id>` on connect
  (`backend/src/realtime/server.ts:243`); `pushNotificationForEvent` emits
  `notification_received` to that room from the `send_message` and
  `add_reaction` handlers. Fire-and-forget, no persistence.
- GraphQL: `backend/schema/Messenger.graphql` — `notifications`,
  `notificationUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`,
  `type Notification`. Resolvers in
  `backend/src/graphql/resolvers/messenger.ts`.
- Frontend (`frontend/webapp/`): state + dispatchers in
  `src/models/appController.js` (`notification` slice), socket listener + GQL
  calls in `src/models/MessengerController.js`, bell UI in
  `src/views/_Common/Header.js`.
- Adjacent infra that matters: a provider-agnostic mailer already exists
  (`backend/src/mail/mailer.ts` — SES when `MAIL_FROM` is set, console
  fallback). Mentions already travel in message `data` JSON
  (`mentionedUserIds`) but generate **no** notification today. There is no
  web-push / FCM / service-worker infra anywhere.

The core limitation: the feed can only ever show what can be **re-derived from
messenger tables**. Anything without a durable source row (system announcements,
study-group milestones, mention events once a message is edited/deleted) has no
home, and the socket push path duplicates the derivation logic (two places that
must agree on IDs and text).

## 2. Surfaces impacted

| Surface | Current state | What changes |
|---|---|---|
| **DB / persistence** | No table; read state crammed into `messenger_users.metadata` JSON. No migration framework (ad-hoc scripts in `backend/scripts/`, SQL notes in `docs/sql/`). | New `notification` table (see §3.2) + eventual retirement of the metadata keys. Optional `notification_preference` storage (table vs. metadata — open question). |
| **Backend service layer** | `backend/src/messaging/notifications.ts` — derivation + read state + one realtime helper, messenger-only. | Becomes (or is superseded by) `backend/src/notifications/` — a first-class module: type registry, `notify()` write path, feed read path, preference checks, channel dispatch. Messenger becomes just one *producer*. |
| **GraphQL schema** | Notification bits live inside `Messenger.graphql`; no pagination, no dismiss, no preferences. | Promote to its own SDL file (`backend/schema/Notifications.graphql`), add cursor pagination, `dismissNotification`, preference query/mutation. Keep existing field names so the webapp keeps working during migration. |
| **Realtime / socket layer** | `RealtimeBus` singleton; per-user rooms `user:<id>`; event `notification_received`; emit calls inlined in `message.ts`/`reaction.ts` handlers. | Largely unchanged — it is the in-app *delivery adapter*. Emit moves behind `notify()` so producers stop talking to the bus directly. Event name and payload shape stay stable. |
| **Frontend state / UI** | `appController.js` notification slice, `MessengerController.js` socket listener + GQL, `Header.js` bell/dropdown. All type-agnostic except navigation targets. | Mostly additive: per-type rendering/navigation for new types, "load more" if paginated, a small preferences UI (settings page). Socket contract unchanged. |
| **Next SSR front door** (`frontend/next/`) | Bot-gated (`middleware.ts` UA regex) — serves crawlers/link previews; no authenticated session, no bell. | **No change expected.** Notifications are an authenticated-user surface; bots never see them. Only touchpoint: if email notifications deep-link into the site, links should resolve through canonical URLs the Next layer also understands. |
| **Config / secrets** | Infisical-loaded env (`bom-load-env`); `MAIL_FROM` gates SES mailer. | Later phases only: VAPID keypair for Web Push (or FCM creds), digest cron schedule. Nothing needed for phase 1. |
| **Tests** | `backend/test/messaging/notifications.test.ts` (6 tests, real DB). | New suite for the write path (`notify()` idempotency, preference gating, fan-out), migration/backfill checks, plus e2e bell coverage (`e2e/`). Existing tests keep passing until derived read path is retired. |
| **Prod branch** | `prod` tracked separately; deploy target noted as behind. | Table DDL must ship to prod DB in step with the backend deploy — sequencing note, not a design change. |

## 3. Target architecture

### 3.1 Shape: producers → core → channels

Generalize "derived from messenger" into an **event-driven core with a durable
store**, keeping the current UX contract (bell, badge, `notification_received`)
intact.

```
  PRODUCERS                      CORE                          CHANNELS
  (emit domain events)           (single choke point)          (delivery adapters)

  messenger: reply ────┐
  messenger: reaction ─┤
  messenger: invite ───┤      ┌──────────────────────┐      ┌─ in-app socket ──► RealtimeBus
  messenger: mention ──┼────► │  notify(event)       │      │   emit('notification_received',
  study group activity ┤      │  1. resolve targets  │─────►│        user:<id>, dto)
  reading-plan / system┤      │  2. dedupe (key)     │      ├─ email ──► mailer.ts (SES/console)
  announcements ───────┘      │  3. persist rows     │      │   (immediate or digest)   [later]
                              │  4. dispatch per     │      └─ web push (VAPID/FCM)     [later]
                              │     user preference  │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │  notification table  │◄──── GraphQL read path:
                              │  (source of truth    │      notifications(cursor), unreadCount,
                              │   for the feed)      │      markRead / markAllRead / dismiss
                              └──────────────────────┘
```

Key properties:

- **One write path.** Producers call `notify({type, actorId, targets, payload,
  dedupeKey})` and know nothing about sockets, email, or read state. Today the
  socket emit is inlined in two realtime handlers; that duplication goes away.
- **Channels are adapters** behind the same dispatch step. In-app is the only
  adapter at first. Email and native/web push slot in later as new adapters +
  new preference columns — **zero rework** of producers, model, or read path.
- **Read path serves from the table**, not a per-request 4-query derivation.
  Badge count becomes a single indexed `COUNT(*) WHERE read_at IS NULL`.

### 3.2 Notification model

One envelope, typed payloads:

```
notification
  id            bigint auto-inc (or ulid)
  user_id       recipient (messenger md5 id — same space as messenger_users)
  type          'reply' | 'reaction' | 'invite' | 'mention'
                | 'group_activity' | 'announcement' | ...
  actor_id      nullable (null for system/announcement)
  dedupe_key    varchar — carries over today's deterministic IDs
                (reply:<msgId>, reaction:<msgId>:<actor>:<key>, ...)
                UNIQUE (user_id, dedupe_key)  ← idempotency lives here
  payload       JSON — type-specific: channel_url, message_id, plan_id,
                announcement slug, rendered-text inputs
  created_at    datetime
  read_at       datetime null
  dismissed_at  datetime null (hide without marking channel-read semantics)
```

- **Text is rendered at read time** from `type` + `payload` (as today), not
  stored — keeps copy editable and i18n-ready (channels already carry `lang`).
- **Type registry** in `backend/src/notifications/types/`: each type declares
  how to render text, resolve its navigation target, and (later) its email
  subject/body. Adding a type = one registry entry + one producer call.
- Candidate new types, in likely order of value: `mention` (data already
  exists in message `data.mentionedUserIds` — cheapest win), `group_activity`
  (member joined/accepted, reading-plan segment complete, streak milestones),
  `announcement` (system broadcast).

#### 3.2a Full type taxonomy (confirmed 2026-08-06 — notifications are NOT message-only)

The store is recipient-and-type-agnostic: **every category below is just a
`type` in the registry + a producer that resolves recipients and calls
`notify()`**. Nothing in the table, `notify()`, dual-read, or read-state changes
per category. The taxonomy KC called out:

| Category | type(s) | Recipient resolution | Actor | Value tier | Notes |
|---|---|---|---|---|---|
| Messaging (built) | `reply`, `reaction`, `invite` | single user (msg author / invitee) | user | reply high; reaction/invite low | live today |
| Mentions | `mention` | mentioned user(s) — `data.mentionedUserIds` | user | **high** | producer in `message.ts` |
| Study plan | `plan_reminder`, `plan_progress` | the plan's owner (or plan members) | system/user | high (reminders), low (progress) | reminders may need the cron/job runner (none yet) |
| Group activity | `group_activity` | group members | user | low (coalesced) | member joined, new content, milestones |
| Group-admin | `group_admin` | **admins of group X** (multi-recipient) | user | **high** | join requests, reports, moderation — targeted at role, not a single user |
| Sitewide | `announcement` | **all users** (fan-out-on-write) | null (system) | high, in-app non-opt-out | admin-authored broadcast |

**One API generalization this implies:** `notify()` currently takes a single
`userId`. Group-admin and sitewide are **multi-recipient** — the producer
resolves a recipient set (admins of a group; all users) and fans out one row
per recipient (fan-out-on-write, per §3.3). Add a thin `notifyMany(db, {…,
userIds: string[]})` wrapper over `notify()` (loop + idempotent insert); the
per-row model is unchanged. `dedupe_key` stays per-recipient-unique, e.g.
`announcement:<slug>` (same key, different `user_id` rows) or
`group_admin:join_req:<groupId>:<requesterId>`.

**Recipient-resolution is the only new work per category** — e.g. group-admin
needs "who are the admins of group X" (role/state on `messenger_members`);
study-plan reminders need a scheduler (no job runner exists yet — flagged).

**Sitewide scale:** fan-out-on-write inserts one row per user per announcement.
Fine at the current user base (thousands of rows is trivial for MySQL); if the
base grows ~100×, revisit a broadcast row + per-user read-join. Authoring
(admin mutation / UI) is open question §5.5.
- **Announcements** are the one broadcast-shaped type. Recommend fan-out-on-
  write for the current user base (thousands of rows per announcement is
  trivial for MySQL) rather than a separate broadcast table + per-user read
  join — one model, one read path. Revisit only if the user base grows 100x.

### 3.3 Persistence: recommendation

**Recommend: introduce the table (write-through at `notify()` time), with a
transitional read path.**

| | Keep derived (status quo) | Dedicated table (recommended) |
|---|---|---|
| New types w/o source rows (announcements, milestones) | Impossible or requires fake source tables | Native |
| Mentions after message edit/delete | Fragile (re-derivation shifts) | Row is immutable snapshot |
| Read state | Metadata JSON hack, unbounded-ish set, race-prone read-modify-write | Per-row `read_at`, atomic |
| Badge cost | 4 queries + in-memory filter per check | 1 indexed COUNT |
| Pagination / history > 30 days | Hard cap by design | Natural (cursor on id) |
| Push/email later | Would re-derive per channel | Dispatch from the persisted row |
| Consistency | Self-healing (source of truth is source tables) | Must handle source deletion (e.g. hide notification if message deleted — soft check at render, as `pushNotificationForEvent` already does) |
| Schema/ops cost | Zero | One table + backfill + prod DDL sequencing |

The derived approach was the right call for shipping the bell without schema
changes (the 06-13 audit is explicit about that reasoning). It is the wrong
foundation for growth: every axis in §3.2 fights it. The transition is cheap
because **deterministic IDs become `dedupe_key`s** — a one-time backfill can
run `getNotifications()` per active user and insert rows, and the unique key
makes the backfill + live writes safely re-runnable. During transition the
GraphQL read path can serve `UNION(table, derived)` deduped by key, then drop
the derived arm.

### 3.4 Read/unread and preferences

- `markNotificationRead` → set `read_at` on the row (id or dedupe_key —
  frontend already sends the deterministic id, keep accepting it).
- `markAllNotificationsRead` → `UPDATE ... SET read_at = NOW() WHERE user_id =
  ? AND read_at IS NULL`. The metadata watermark/set are retired after
  backfill (respect them once during backfill: rows derived as read get
  `read_at` stamped).
- **Preferences**: per `(type, channel)` matrix — e.g. mentions: in-app +
  email; reactions: in-app only; announcements: not opt-out-able in-app,
  opt-out-able for email. Small and per-user → storing in
  `messenger_users.metadata` under one `notificationPrefs` key is acceptable
  for phase 1 (matches existing pattern); a table is only warranted when email
  digests need server-side batch queries across users ("everyone with email
  digest on"). Flagged as an open question.

### 3.5 Delivery channels and future push/email

```
dispatch(row):
  prefs = getPrefs(row.user_id)
  if prefs.inApp(row.type):   bus.emit('notification_received', user:<id>, render(row))
  if prefs.email(row.type):   enqueue email (immediate) or leave for digest cron  [later]
  if prefs.push(row.type):    webpush/FCM send to registered subscriptions       [later]
```

- **In-app** — exists; only the call site moves behind `notify()`.
- **Email** — mailer port already exists (`backend/src/mail/mailer.ts`).
  Needs: per-type templates (`templates.ts` pattern), a digest option (cron —
  no job runner exists yet; a systemd timer or in-process interval is the
  likely fit), and unsubscribe links honoring prefs.
- **Native/web push** — needs a service worker in the CRA webapp, a
  `push_subscription` table (endpoint/keys per user-device), VAPID keys in
  Infisical, and expiry handling. Entirely additive: a new adapter reading the
  same persisted row. Nothing in phases before it needs to change.

### 3.6 Idempotency and delivery semantics

- **Write idempotency**: `UNIQUE(user_id, dedupe_key)` + `INSERT ... ON
  DUPLICATE KEY` (or ignore). Retries, double-fired socket handlers, and
  backfill overlaps all collapse to one row.
- **Socket delivery** stays at-most-once best-effort (as today); the durable
  row means a missed emit is only a stale badge until next fetch — acceptable,
  and the badge is already seeded on login bootstrap.
- **Un-events** (reaction removed, invite declined, message deleted): either
  delete/dismiss the row from the producer (reaction removal already has a
  handler) or soft-hide at render if the source is gone. Recommend the former
  for reactions/invites, the latter as a safety net.

## 4. Rough sequencing (for scoping, not a plan)

1. **Foundation** — table + `notify()` core + move existing 3 types onto it;
   dual-read; backfill. (The load-bearing step. **Built 2026-08-06**, minus the
   held all-users backfill run and full metadata retirement.)
2. **Guardrails** (§6) — coalescing + value tiers + caps + coalesce-and-update
   live push. Do before adding noisy new types so they're born throttled.
3. **`notifyMany()` + multi-recipient** — the thin fan-out wrapper (§3.2a) that
   unlocks group-admin and sitewide.
4. **New types**, each = registry entry + producer + recipient resolver:
   `mention` → `group_admin` → `group_activity` → `plan_reminder`/`plan_progress`
   → `announcement`/sitewide. Order by value; `mention` is cheapest.
5. Preferences UI (per-type/-channel opt-out).
6. Email adapter (needs a job runner for digests/reminders — none exists yet).
7. Web/native push adapter.

## 5. Trade-offs and open questions for KC

1. **Table naming/ownership**: `messenger_notification` (messenger-prefixed,
   near its main producers) vs `bom_notification` (site-wide — matches the
   ambition of announcements/study activity)? Affects where the module lives
   (`src/messaging/` vs new `src/notifications/`).
2. **Retention**: derived feed self-bounded at 30 days/50 items. A table needs
   an explicit policy — delete after N days? Keep forever with pagination?
   (`retention.ts` already exists in messaging as a pattern.)
3. **Preferences storage**: metadata JSON (phase 1 cheap, consistent with
   existing patterns) vs table (needed the moment email digests query across
   users). OK to start in metadata and promote later?
4. **Email appetite and cadence**: is email in scope this year? Immediate
   per-event, daily digest, or both? Determines whether a job scheduler needs
   to exist (none does today).
5. **Announcement authoring**: who creates system announcements and how —
   admin GraphQL mutation, direct SQL, or a small admin UI? Also: are
   announcements dismissible/opt-out?
6. **Prod DDL sequencing**: no migration framework exists; prod is tracked on
   the `prod` branch and the deploy target is noted as behind. Manual DDL on
   the prod DB coordinated with deploy, or is this the moment to adopt a real
   migration tool (kysely supports one)?
7. **Aggregation/coalescing**: "3 people reacted to your message" vs 3 rows.
   → **RESOLVED (2026-08-06): coalescing is in scope as a dedicated guardrails
   phase — see §6.**

## 6. Notification quality guardrails (decided 2026-08-06, KC)

A follow-on phase (after the table foundation lands) to keep the feed relevant
and stop repetitive / low-value spam. Decisions:

- **Primary mechanism — coalesce same-target.** Fold N events on the same
  `(recipient, type, target message)` into ONE feed item with a count:
  "5 people reacted to your comment". Not N separate bell items.
- **Value tiers.** *High* = replies + mentions (always surface, always push
  live, never coalesced away). *Low* = reactions + invites (coalesced + capped).
  Encoded as a small per-type config `{ priority, coalesce, cap }` so tiers are
  tunable without code changes; new types (mention, group_activity,
  announcement) slot in with a tier.
- **Per-category cap + overflow.** Surface newest N of each low-value type;
  collapse the rest into a "+X more" affordance so one category can't drown the
  feed.
- **Live-push behaviour — best-practice coalesce-and-update (not re-notify).**
  The FIRST event on a target pushes live. Subsequent same-target low-value
  events do NOT re-buzz the bell; they update the existing item's count in place
  (Slack/GitHub/FB pattern). High-value events always push.

**Implementation lean:** read-time coalescing + caps in the `getNotifications`
merge (no schema change, reversible, tunable) is the default. The live
coalesce-and-update uses a socket event that patches the existing bell item's
count rather than prepending a new one. Write-time aggregation (mutating a
counter column on a live row) is deferred unless the real-time badge must
reflect coalesced counts without a refetch. `dedupe_key` already encodes the
actor, so grouping by `(type, target)` at render time is straightforward.

Open sub-questions for the guardrails plan: exact caps per type; coalescing
window (all-time within lookback vs a rolling window); whether "+X more"
expands inline or navigates; and the socket contract for count-updates.
