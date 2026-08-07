# Notifications Phase 1 — Table-Backed Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the derived-from-messenger notification feed into a durable, table-backed system without changing the GraphQL contract or the socket UX.

**Architecture:** Introduce a `bom_notification` table as durable storage. Producers write a row via a new `notify()` core (idempotent insert + emit-on-fresh). The GraphQL read path becomes a **dual-read** that merges table rows with the still-live derived feed, deduped by the deterministic public id. A backfill script seeds rows for existing users. Read state is written to the table, with the existing `messenger_users.metadata` read-state kept as a compatibility fallback (full metadata retirement is deferred to phase 1.b — see Deviations).

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Kysely + mysql2 (MySQL 8, `utf8mb4_0900_ai_ci`), Socket.io via `RealtimeBus`, Vitest against a real DB.

---

## Context & Ground Truth (verified against the live `backend/` tree)

- Current derivation + read state: `backend/src/messaging/notifications.ts`. Exports:
  - `getNotifications(db, userId): Promise<NotificationDTO[]>`
  - `getUnreadNotificationCount(db, userId): Promise<number>`
  - `markNotificationRead(db, userId, notificationId): Promise<boolean>`
  - `markAllNotificationsRead(db, userId): Promise<boolean>`
  - `userRoom(userId): string` → `"user:<userId>"`
  - `pushNotificationForEvent(db, { type, targetMessageId, actorId, reactionKey? }): Promise<void>` — looks up the target message + actor, builds a `NotificationDTO`, emits `notification_received` to `userRoom(recipientId)`.
  - `type NotificationType = 'reply' | 'reaction' | 'invite'`
  - `interface NotificationDTO { id; type; actor: UserDTO|null; channel_url; message_id; text; created_at /* ms */; is_read }`
- Deterministic public ids: `reply:<msgId>` · `reaction:<msgId>:<actorId>:<reactionKey>` · `invite:<channelUrl>`. These become the table's `dedupe_key` **and stay the public `NotificationDTO.id`** — so the frontend contract does not change.
- DB client: `backend/src/data/db.ts` → `getDb(): Kysely<DB>`. Pool uses `timezone: 'Z'` (UTC). `DB` type is generated in `backend/codegen/db.d.ts`.
- Metadata read-state lives in `messenger_users.metadata` JSON: `notificationsReadAt` (ms watermark) + `notificationsRead` (string[] of read ids). Helpers `getUserMetadata` / `updateUserMetadata` in `backend/src/messaging/notifications.ts` and `backend/src/messaging/users.ts`.
- Producers (emit call sites):
  - `backend/src/realtime/handlers/message.ts:125` (reply)
  - `backend/src/realtime/handlers/reaction.ts:74` (reaction)
- Emit primitive: `getBus().emit('notification_received', userRoom(recipientId), notif)` (`backend/src/realtime/RealtimeBus.ts`). Users auto-join `user:<id>` in `backend/src/realtime/server.ts:243`.
- GraphQL: SDL in `backend/schema/Messenger.graphql`; resolvers in `backend/src/graphql/resolvers/messenger.ts` (`resolveActingUserId(ctx)` → `md5(username)`).
- Tests: Vitest, real DB, write-gated via `MYSQL_WRITE_USER`/`MYSQL_WRITE_PASSWORD`; `itWrite` skips when the DB is read-only. Pattern in `backend/test/messaging/notifications.test.ts`. Run a single file: `npm test -- test/messaging/notifications.test.ts`.
- `messenger_users`: PK `user_id VARCHAR(32)` (md5), `metadata JSON`.

**Decisions (resolved by KC, 2026-08-06):**
- Table name: **`bom_notification`** (site-wide name, not messenger-scoped — anticipates announcements/study activity beyond messenger). Kysely interface: `BomNotification`.
- DB mutations are authorized: subagents apply the DDL and run write-tests/backfill against the DB using the available write creds. (Confirm the target DB in Task 0 before the `CREATE TABLE`.)
- DDL lives in `backend/migrations/` and is applied manually (no migration framework exists yet).
- New module dir: **`backend/src/notifications/`** for the table store + `notify()` core; `backend/src/messaging/notifications.ts` imports from it and keeps its public exports.

**Deviations from the architecture spec's phase-1 sketch:** the spec listed "retire metadata read state" inside phase 1. This plan **keeps** the metadata read-state as a fallback and defers its removal to phase 1.b, so that historical/pre-backfill and derived-only rows keep their read status and nothing regresses on day one. Full retirement happens after backfill is verified in prod.

## File Structure

- **Create** `backend/migrations/2026-08-06-notification-table.sql` — DDL for `bom_notification`.
- **Create** `backend/src/notifications/store.ts` — persistence + row→DTO + table read/mark helpers.
- **Create** `backend/src/notifications/notify.ts` — `notify()` core (persist + emit-on-fresh).
- **Create** `backend/scripts/backfill-notifications.ts` — idempotent backfill from the derived feed.
- **Create** `backend/test/notifications/store.test.ts` — store + notify unit/integration tests.
- **Create** `backend/test/notifications/dual-read.test.ts` — merge + read-state tests.
- **Modify** `backend/codegen/db.d.ts` — add `BomNotification` interface + `bom_notification` to `DB`.
- **Modify** `backend/src/messaging/notifications.ts` — dual-read merge in `getNotifications`/count; write-through in `pushNotificationForEvent`; table update in mark functions.

---

## Task 0: Preflight — verify environment & exact identifiers

**Files:** none (investigation only).

- [ ] **Step 1: Confirm write-DB access for tests/backfill**

`src/data/db.ts` is TypeScript with `.js` import specifiers — it only runs under `tsx`, not bare `node` (env loads via `import 'dotenv/config'` in `src/config/env.ts`).
Run: `cd backend && npx tsx -e "import('./src/data/db.js').then(async m=>{const db=m.getDb();const r=await db.selectFrom('messenger_users').select('user_id').limit(1).execute();console.log('read ok',r.length)})"`
Expected: prints `read ok 1` (or `0`). If it errors, resolve DB connectivity before continuing. Confirm `MYSQL_WRITE_USER`/`MYSQL_WRITE_PASSWORD` are set (required for `itWrite` tests and the DDL apply).

- [ ] **Step 1b: Note the SANDBOX coupling (affects Task 3 & Task 8)**

`getDb()` wraps the dialect in `sandboxDialect` when `env.SANDBOX` is truthy, and `src/config/env.ts` defaults `SANDBOX` to `'1'` — sandboxed inserts return `numAffectedRows: 0n`. That interacts with emit-on-fresh (Task 3) and the manual smoke (Task 8). Confirm the value: `cd backend && npx tsx -e "import('./src/config/env.js').then(m=>console.log('SANDBOX=',m.env.SANDBOX))"`. For write tests and the Task 8 smoke, run with `SANDBOX=0`.

- [ ] **Step 2: Confirm the `UserDTO` import path and `getBus`/`setIo`/`userRoom` exports**

Run: `cd backend && grep -rn "export .*UserDTO" src/messaging/ && grep -n "export function userRoom" src/messaging/notifications.ts && grep -n "export function getBus\|export function setIo" src/realtime/RealtimeBus.ts`
Expected: `UserDTO` resolves to `src/messaging/dto.ts` (imported by `notifications.ts` as `../messaging/dto.js` — this plan uses `../messaging/dto.js`; `UserDTO` exposes `user_id`, NOT `id`). Also confirms `userRoom`, `getBus`, and `setIo` exports. Note: `getBus()` returns a fresh object per call — tests must stub via `setIo(...)`, not by patching `getBus()`'s result (see Task 3).

- [ ] **Step 3: Confirm whether a Kysely codegen script exists**

Run: `cd backend && grep -n "codegen\|kysely-codegen" package.json`
Expected: a `codegen:db` script exists but `kysely-codegen` reads `DATABASE_URL` (the repo uses discrete `MYSQL_*` vars), so it likely won't run out of the box — the hand-edit in Task 1 Step 3 is the realistic path. Clobber risk is benign (a later regen would emit `BomNotification` itself).

- [ ] **Step 4: Confirm Kysely supports `INSERT IGNORE` via `.ignore()`**

Run: `cd backend && node -e "const{Kysely,MysqlDialect}=require('kysely');console.log(typeof Kysely)"` then eyeball `node_modules/kysely` version supports `.ignore()` (Kysely ≥ 0.24). If `.ignore()` is unavailable, substitute `.onDuplicateKeyUpdate({ dedupe_key: (eb)=>eb.ref('bom_notification.dedupe_key') })` everywhere this plan uses `.ignore()`.
Expected: `function`. Note the resolution for the insert builder used in Task 2.

---

## Task 1: Create the `bom_notification` table

**Files:**
- Create: `backend/migrations/2026-08-06-notification-table.sql`
- Modify: `backend/codegen/db.d.ts`

- [ ] **Step 1: Write the DDL**

Create `backend/migrations/2026-08-06-notification-table.sql`:

```sql
-- Notifications phase 1: durable store. Applied manually (no migration framework yet).
-- Apply: mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_WRITE_USER -p $MYSQL_DB < backend/migrations/2026-08-06-notification-table.sql
CREATE TABLE IF NOT EXISTS bom_notification (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       VARCHAR(32)  NOT NULL COMMENT 'recipient; md5(username) = messenger_users.user_id',
  type          VARCHAR(32)  NOT NULL COMMENT 'reply | reaction | invite | ...',
  actor_id      VARCHAR(32)  NULL     COMMENT 'messenger_users.user_id of the actor; NULL for system',
  dedupe_key    VARCHAR(255) NOT NULL COMMENT 'deterministic public id, e.g. reply:<msgId>',
  payload       JSON         NOT NULL COMMENT 'rendered text, channel_url, message_id, actor UserDTO',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at       DATETIME     NULL,
  dismissed_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_dedupe (user_id, dedupe_key),
  KEY idx_user_unread (user_id, read_at),
  KEY idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

- [ ] **Step 2: Apply the DDL to the dev DB**

Run: `mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_WRITE_USER" -p"$MYSQL_WRITE_PASSWORD" "$MYSQL_DB" < backend/migrations/2026-08-06-notification-table.sql`
Then verify: `mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_WRITE_USER" -p"$MYSQL_WRITE_PASSWORD" "$MYSQL_DB" -e "DESCRIBE bom_notification;"`
Expected: the 9 columns listed above.

- [ ] **Step 3: Add the Kysely type (hand-edit) — the `BomNotification` interface**

In `backend/codegen/db.d.ts`, add near the other `Messenger*` interfaces:

```typescript
export interface BomNotification {
  id: Generated<number>;
  user_id: string;
  type: string;
  actor_id: string | null;
  dedupe_key: string;
  payload: Json;
  created_at: Generated<Date>;
  read_at: Date | null;
  dismissed_at: Date | null;
}
```

Then add this line to the `export interface DB { ... }` block (alphabetically near `messenger_*`):

```typescript
  bom_notification: BomNotification;
```

- [ ] **Step 4: Regenerate types if a codegen script exists (preferred over hand-edit)**

The script is `codegen:db`, but it requires `DATABASE_URL` (the repo uses discrete `MYSQL_*` vars), so it likely won't run as-is. If you can supply `DATABASE_URL`: run `cd backend && DATABASE_URL="mysql://$MYSQL_WRITE_USER:$MYSQL_WRITE_PASSWORD@$MYSQL_HOST:$MYSQL_PORT/$MYSQL_DB" npm run codegen:db` and confirm the generated `bom_notification` matches Step 3 (discard the hand-edit if codegen produces it). Otherwise keep the hand-edit.
Expected: `bom_notification` present in `codegen/db.d.ts`.

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS (no errors referencing `bom_notification`).

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/2026-08-06-notification-table.sql backend/codegen/db.d.ts
git commit -m "feat(notifications): add bom_notification table + Kysely types"
```

---

## Task 2: `store.ts` — persist + row→DTO (TDD)

**Files:**
- Create: `backend/src/notifications/store.ts`
- Test: `backend/test/notifications/store.test.ts`

- [ ] **Step 1: Write the failing test (idempotent persist)**

Create `backend/test/notifications/store.test.ts`. Reuse the DB-bootstrap pattern from `backend/test/messaging/notifications.test.ts` (the `buildWriteDb`, `beforeAll` probe, `itWrite`, and `cleanup`/`mkUser`/`mkChannel`/`mkMessage` helpers — copy them verbatim). These tests hit the real `bom_prd` DB, so a leak is a prod-data leak: add the notification delete as the **first** statement inside the copied `cleanup()` body, before the id arrays are reset:

```typescript
// first line inside cleanup(), before userIds is cleared:
if (userIds.length) await db.deleteFrom('bom_notification').where('user_id', 'in', userIds).execute();
```

(The copied test pool omits `timezone: 'Z'` — leave it; writes and reads through the same connection are self-consistent. Do not "fix" it, or absolute `created_at` comparisons will shift by the host TZ offset.)

```typescript
import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { persistNotification, rowToDTO } from '../../src/notifications/store.js';

// ... buildWriteDb(), db, canWrite, itWrite, and mkUser() copied from messaging/notifications.test.ts ...
// afterEach must also run: await db.deleteFrom('bom_notification').where('user_id','in',userIds).execute();

describe('persistNotification', () => {
  itWrite('inserts once and is idempotent on (user_id, dedupe_key)', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Actor');
    const input = {
      userId: me, type: 'reply', actorId: actor, dedupeKey: `reply:${nanoid(11)}`,
      payload: { text: 'nice point', channel_url: 'ch1', message_id: 'm1',
                 actor: { user_id: actor, nickname: 'Actor', profile_url: '' } },
    };
    const first = await persistNotification(db, input);
    const second = await persistNotification(db, input);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    const rows = await db.selectFrom('bom_notification')
      .selectAll().where('user_id', '=', me).execute();
    expect(rows.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- test/notifications/store.test.ts`
Expected: FAIL — `Cannot find module '../../src/notifications/store.js'`.

- [ ] **Step 3: Implement `store.ts`**

Create `backend/src/notifications/store.ts`:

```typescript
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { NotificationDTO } from '../messaging/notifications.js';
import type { UserDTO } from '../messaging/dto.js';  // UserDTO lives in dto.ts (has user_id, NOT id)

export interface NotificationPayload {
  text: string;
  channel_url: string | null;
  message_id: string | null;
  actor: UserDTO | null;
}

export interface PersistNotificationInput {
  userId: string;      // recipient (md5)
  type: string;        // 'reply' | 'reaction' | 'invite' | ...
  actorId: string | null;
  dedupeKey: string;   // deterministic public id; also NotificationDTO.id
  payload: NotificationPayload;
  createdAt?: Date;    // defaults to now
}

// Idempotent write. Duplicate (user_id, dedupe_key) is a no-op (INSERT IGNORE).
export async function persistNotification(
  db: Kysely<DB>,
  input: PersistNotificationInput,
): Promise<{ inserted: boolean }> {
  const result = await db
    .insertInto('bom_notification')
    .ignore()
    .values({
      user_id: input.userId,
      type: input.type,
      actor_id: input.actorId,
      dedupe_key: input.dedupeKey,
      payload: JSON.stringify(input.payload),
      created_at: input.createdAt ?? new Date(),
    })
    .executeTakeFirst();
  return { inserted: Number(result.numInsertedOrUpdatedRows ?? 0n) > 0 };
}

// A stored row → the same DTO shape the derived feed returns. Public id = dedupe_key.
export function rowToDTO(row: {
  type: string; dedupe_key: string; payload: unknown;
  created_at: Date | null; read_at: Date | null;
}): NotificationDTO {
  const p = (typeof row.payload === 'string'
    ? JSON.parse(row.payload) : row.payload) as NotificationPayload;
  return {
    id: row.dedupe_key,
    type: row.type as NotificationDTO['type'],
    actor: p.actor,
    channel_url: p.channel_url,
    message_id: p.message_id,
    text: p.text,
    created_at: (row.created_at ?? new Date()).getTime(),
    is_read: row.read_at != null,
  };
}
```

- [ ] **Step 4: Run the test AND typecheck to verify both pass**

Run: `cd backend && npm test -- test/notifications/store.test.ts && npx tsc --noEmit`
Expected: PASS (test skips with a warning only if the DB is read-only). The `tsc` gate here catches a wrong `UserDTO` import path immediately — `tsconfig.json` excludes `test/`, and vitest transpiles without typechecking, so a type-only import error would otherwise stay hidden until Task 8.

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/store.ts backend/test/notifications/store.test.ts
git commit -m "feat(notifications): idempotent persistNotification + rowToDTO store"
```

---

## Task 3: `notify.ts` — persist + emit-on-fresh (TDD)

**Files:**
- Create: `backend/src/notifications/notify.ts`
- Test: `backend/test/notifications/store.test.ts` (append)

- [ ] **Step 1: Write the failing test (emit only on fresh insert)**

Append to `backend/test/notifications/store.test.ts`:

`getBus()` returns a fresh object literal on every call, so patching its `.emit` can't intercept `notify()`'s own `getBus().emit(...)`. Stub at the singleton seam via `setIo(...)` instead — install a fake socket.io `Server` whose `.to(room).emit(...)` records calls:

```typescript
import { notify } from '../../src/notifications/notify.js';
import { setIo } from '../../src/realtime/RealtimeBus.js';

describe('notify', () => {
  itWrite('emits notification_received exactly once for a fresh row, never for a duplicate', async () => {
    const me = await mkUser('Recipient');
    const events: Array<{ room: string; dto: any }> = [];
    const input = {
      userId: me, type: 'reply', actorId: me, dedupeKey: `reply:${nanoid(11)}`,
      payload: { text: 't', channel_url: 'c', message_id: 'm', actor: null },
    };
    // Stub the io singleton so RealtimeBus.emit routes here.
    setIo({
      to: (room: string) => ({
        emit: (event: string, dto: any) => {
          if (event === 'notification_received') events.push({ room, dto });
        },
      }),
    } as any);
    try {
      await notify(db, input);
      await notify(db, input); // duplicate → no emit
    } finally {
      setIo(null as any);
    }
    expect(events.length).toBe(1);
    expect(events[0]!.room).toBe(`user:${me}`);
    expect(events[0]!.dto.id).toBe(input.dedupeKey);
  });
});
```

Note: this test needs a real insert, so run it with `SANDBOX=0` (see Task 0 Step 1b) — a sandboxed insert reports `inserted: false` and no emit fires.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- test/notifications/store.test.ts`
Expected: FAIL — `Cannot find module '../../src/notifications/notify.js'`.

- [ ] **Step 3: Implement `notify.ts`**

Create `backend/src/notifications/notify.ts`:

```typescript
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getBus } from '../realtime/RealtimeBus.js';
import { userRoom } from '../messaging/notifications.js';
import { persistNotification, rowToDTO, type PersistNotificationInput } from './store.js';

// Durable write + best-effort in-app push. Emits only when a NEW row was inserted,
// so retries and double-fired socket handlers never double-notify.
export async function notify(
  db: Kysely<DB>,
  input: PersistNotificationInput,
): Promise<void> {
  const createdAt = input.createdAt ?? new Date();
  const { inserted } = await persistNotification(db, { ...input, createdAt });
  if (!inserted) return;
  const dto = rowToDTO({
    type: input.type,
    dedupe_key: input.dedupeKey,
    payload: input.payload,
    created_at: createdAt,
    read_at: null,
  });
  getBus().emit('notification_received', userRoom(input.userId), dto);
}
```

**Design decision — SANDBOX suppresses the emit, intentionally.** When `env.SANDBOX` is on (the default in dev), `sandboxDialect` makes the insert report `inserted: false`, so `notify()` skips the push. This is the accepted read-only-dev behavior (matches how sandbox already swallows writes) — the trade-off is that live bell pushes do not fire in sandboxed dev, and Task 8 Step 3's smoke test must run with `SANDBOX=0`. We deliberately couple emit to a successful durable write (no emit for events we didn't persist); a genuine insert error therefore also suppresses the push, and the next `getNotifications` fetch is the recovery path. If phase 1.b needs best-effort push independent of the write, split the emit out then — out of scope here.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- test/notifications/store.test.ts`
Expected: PASS. (Tests use `buildWriteDb()` — a raw pool that bypasses `sandboxDialect` — so the insert persists and the emit fires regardless of `SANDBOX`. The SANDBOX coupling only affects the running app; see the design note above and Task 8 Step 3.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/notify.ts backend/test/notifications/store.test.ts
git commit -m "feat(notifications): notify() core — persist then emit-on-fresh"
```

---

## Task 4: Write-through from producers via `pushNotificationForEvent` (TDD)

**Files:**
- Modify: `backend/src/messaging/notifications.ts` (`pushNotificationForEvent`)
- Test: `backend/test/notifications/store.test.ts` (append)

**Approach:** `pushNotificationForEvent` already resolves the recipient, actor, and builds the `NotificationDTO` before emitting. Change it to build a `PersistNotificationInput` from those same pieces and call `notify()` instead of emitting directly. This persists the row and preserves the identical emit.

- [ ] **Step 1: Write the failing test (a produced event persists a row)**

Append to `backend/test/notifications/store.test.ts`:

```typescript
import { pushNotificationForEvent } from '../../src/messaging/notifications.js';

describe('pushNotificationForEvent write-through', () => {
  itWrite('a reply event persists a durable notification row', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group A', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, actor, 'nice point', parent);

    await pushNotificationForEvent(db, { type: 'reply', targetMessageId: parent, actorId: actor });

    const row = await db.selectFrom('bom_notification')
      .selectAll().where('user_id', '=', me).where('type', '=', 'reply').executeTakeFirst();
    expect(row).toBeDefined();
    expect(row!.dedupe_key).toBe(`reply:${parent}`);
    expect(row!.actor_id).toBe(actor);
  });
});
```

(Use the `mkChannel`/`mkMessage` helpers copied from `messaging/notifications.test.ts` into this file's setup.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- test/notifications/store.test.ts`
Expected: FAIL — no row is written (current `pushNotificationForEvent` only emits).

- [ ] **Step 3: Modify `pushNotificationForEvent` to persist via `notify()`**

In `backend/src/messaging/notifications.ts`, locate the point in `pushNotificationForEvent` where it currently has the recipient id, the built `NotificationDTO` (`notif`), and the deterministic id, then emits `getBus().emit('notification_received', userRoom(recipientId), notif)`. Replace that terminal emit with a `notify()` call that carries the same data:

```typescript
import { notify } from '../notifications/notify.js';

// ...inside pushNotificationForEvent, where `recipientId`, the deterministic `id`,
// and the assembled `notif` (NotificationDTO) are in scope, replacing the direct emit:
await notify(db, {
  userId: recipientId,
  type: params.type,
  actorId: params.actorId,
  dedupeKey: notif.id,           // deterministic id already computed for the DTO
  payload: {
    text: notif.text,
    channel_url: notif.channel_url,
    message_id: notif.message_id,
    actor: notif.actor,
  },
  createdAt: new Date(notif.created_at),
});
```

If the existing function returns early (e.g. recipient is the actor, or the target message is gone), keep those guards ahead of the `notify()` call unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- test/notifications/store.test.ts`
Expected: PASS. Also run the existing suite to confirm no regression: `cd backend && npm test -- test/messaging/notifications.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/messaging/notifications.ts backend/test/notifications/store.test.ts
git commit -m "feat(notifications): write durable rows from producers via notify()"
```

---

## Task 5: Dual-read merge in `getNotifications` + count (TDD)

**Files:**
- Modify: `backend/src/messaging/notifications.ts` (`getNotifications`, `getUnreadNotificationCount`)
- Create: `backend/test/notifications/dual-read.test.ts`

**Approach:** `getNotifications` computes the derived list as today, also queries table rows, merges the two keyed by public id (`dedupe_key`), **prefers the table row** (it carries durable `read_at`), sorts by `created_at` desc, and caps at `MAX_NOTIFICATIONS`. `is_read` stays `row.read_at != null OR metadata-says-read` so pre-backfill/derived-only rows keep their read status.

- [ ] **Step 1: Write the failing test**

The genuinely-failing case is a **stored-only** notification (one with no derived twin) surfacing — that exercises the new table-read arm. A dedup case alone would pass pre-implementation (before the merge, `getNotifications` reads only the derived arm, so a reply appears exactly once anyway), so include both, with the stored-only case first.

Create `backend/test/notifications/dual-read.test.ts` (reuse the same DB bootstrap + helpers, with the `bom_notification` delete added inside `cleanup()` as in Task 2 Step 1):

```typescript
import { describe, expect } from 'vitest';
import { getNotifications, pushNotificationForEvent } from '../../src/messaging/notifications.js';
import { persistNotification } from '../../src/notifications/store.js';
// ... bootstrap, itWrite, mkUser/mkChannel/mkMessage as in the other suites ...

describe('dual-read merge', () => {
  itWrite('surfaces a stored-only notification that has no derived twin', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Ghost');
    // A row whose source message does not exist → the derived arm can never produce it.
    const dedupeKey = `reply:${nanoid(11)}`;
    await persistNotification(db, {
      userId: me, type: 'reply', actorId: actor, dedupeKey,
      payload: { text: 'orphan', channel_url: 'c', message_id: 'gone',
                 actor: { user_id: actor, nickname: 'Ghost', profile_url: '' } },
    });
    const notifs = await getNotifications(db, me);
    expect(notifs.some((n) => n.id === dedupeKey)).toBe(true);
  });

  itWrite('a reply that is both derived and stored appears exactly once', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group A', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, actor, 'nice point', parent);
    await pushNotificationForEvent(db, { type: 'reply', targetMessageId: parent, actorId: actor });

    const replies = (await getNotifications(db, me)).filter((n) => n.id === `reply:${parent}`);
    expect(replies.length).toBe(1); // merged, not duplicated
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- test/notifications/dual-read.test.ts`
Expected: FAIL on the first case — the stored-only orphan does not appear, because `getNotifications` doesn't read the table yet. (The second case already passes; that's expected.)

- [ ] **Step 3: Implement the merge**

In `backend/src/messaging/notifications.ts`, the derived list is the local `items` and the function ends with roughly `items.sort(...); return items.slice(0, MAX_NOTIFICATIONS);`. The read-state values `watermark` and `readIds` are already computed earlier in the function (via `getReadState`). Replace that terminal sort/return with a table-read + merge that also applies the read-state to **stored-only** rows (a stored-only row must still respect a prior `markAllNotificationsRead`, which until Task 6 lives only in metadata):

```typescript
import { rowToDTO } from '../notifications/store.js';

// ...inside getNotifications, `since` is the existing LOOKBACK_DAYS cutoff Date,
// and `watermark` (ms) + `readIds` (Set<string>) are already in scope...
const rows = await db
  .selectFrom('bom_notification')
  .select(['type', 'dedupe_key', 'payload', 'created_at', 'read_at'])
  .where('user_id', '=', userId)
  .where('created_at', '>', since)
  .where('dismissed_at', 'is', null)
  .orderBy('created_at', 'desc')
  .limit(MAX_NOTIFICATIONS)
  .execute();

const byId = new Map<string, NotificationDTO>();
for (const n of items) byId.set(n.id, n);           // derived arm
for (const row of rows) {
  const n = rowToDTO(row);
  const prev = byId.get(n.id);
  // read if: the row itself is read, OR its derived twin was read,
  // OR metadata read-state covers it (watermark / explicit read id).
  const isRead = n.is_read || (prev?.is_read ?? false)
    || n.created_at <= watermark || readIds.has(n.id);
  byId.set(n.id, { ...n, is_read: isRead });
}
return [...byId.values()]
  .sort((a, b) => b.created_at - a.created_at)
  .slice(0, MAX_NOTIFICATIONS);
```

Confirm the exact names of the read-state locals from Task 0 (the function uses `getReadState`); if they are named differently, use those names.

- [ ] **Step 4: Confirm `getUnreadNotificationCount` already delegates to the merged feed**

No change needed — `getUnreadNotificationCount` already calls `getNotifications` and filters `!n.is_read` (verify by reading it). Because it delegates, it inherits the merge for free. If it instead re-derives independently, change its body to `return (await getNotifications(db, userId)).filter((n) => !n.is_read).length;`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && npm test -- test/notifications/dual-read.test.ts && npm test -- test/messaging/notifications.test.ts && npx tsc --noEmit`
Expected: PASS for all.

- [ ] **Step 6: Commit**

```bash
git add backend/src/messaging/notifications.ts backend/test/notifications/dual-read.test.ts
git commit -m "feat(notifications): dual-read merge of stored + derived feed"
```

---

## Task 6: Table-backed read state in mark functions (TDD)

**Files:**
- Modify: `backend/src/messaging/notifications.ts` (`markNotificationRead`, `markAllNotificationsRead`)
- Test: `backend/test/notifications/dual-read.test.ts` (append)

**Approach:** keep the existing metadata writes (fallback) and additionally stamp `read_at` on matching table rows, so read state survives independent of metadata.

- [ ] **Step 1: Write the failing test**

Append to `backend/test/notifications/dual-read.test.ts`:

```typescript
import { markNotificationRead } from '../../src/messaging/notifications.js';

describe('read state on rows', () => {
  itWrite('markNotificationRead stamps read_at on the stored row', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group A', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, actor, 'nice point', parent);
    await pushNotificationForEvent(db, { type: 'reply', targetMessageId: parent, actorId: actor });

    const ok = await markNotificationRead(db, me, `reply:${parent}`);
    expect(ok).toBe(true);
    const row = await db.selectFrom('bom_notification')
      .select('read_at').where('user_id','=',me).where('dedupe_key','=',`reply:${parent}`)
      .executeTakeFirstOrThrow();
    expect(row.read_at).not.toBeNull();

    const notifs = await getNotifications(db, me);
    expect(notifs.find((n) => n.id === `reply:${parent}`)!.is_read).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- test/notifications/dual-read.test.ts`
Expected: FAIL — `read_at` stays null (mark only writes metadata today).

- [ ] **Step 3: Add table updates to the mark functions**

In `backend/src/messaging/notifications.ts`, in `markNotificationRead`, after the existing metadata update, add:

```typescript
await db
  .updateTable('bom_notification')
  .set({ read_at: new Date() })
  .where('user_id', '=', userId)
  .where('dedupe_key', '=', notificationId)
  .where('read_at', 'is', null)
  .executeTakeFirst();
```

In `markAllNotificationsRead`, after the existing metadata watermark update, add:

```typescript
await db
  .updateTable('bom_notification')
  .set({ read_at: new Date() })
  .where('user_id', '=', userId)
  .where('read_at', 'is', null)
  .executeTakeFirst();
```

Keep both functions' existing return semantics (they return `true` on success as today).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- test/notifications/dual-read.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/messaging/notifications.ts backend/test/notifications/dual-read.test.ts
git commit -m "feat(notifications): persist read state on notification rows"
```

---

## Task 7: Idempotent backfill script (TDD)

**Files:**
- Create: `backend/scripts/backfill-notifications.ts`
- Test: `backend/test/notifications/dual-read.test.ts` (append — exercise the backfill function)

**Approach:** export a pure `backfillUser(db, userId)` that runs the existing derived `getNotifications`, and for each derived item calls `persistNotification` (no emit) with `read_at` stamped when the derived item is already read. Re-running is a no-op because of the unique key. The script's CLI wrapper iterates users with recent authored messages.

- [ ] **Step 1: Write the failing test**

Append to `backend/test/notifications/dual-read.test.ts`:

```typescript
import { backfillUser } from '../../scripts/backfill-notifications.js';

describe('backfill', () => {
  itWrite('seeds rows for existing derived notifications and is re-runnable', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group A', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, actor, 'nice point', parent); // derived-only, no row yet

    const first = await backfillUser(db, me);
    const second = await backfillUser(db, me);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0); // idempotent: nothing new inserted

    const rows = await db.selectFrom('bom_notification')
      .selectAll().where('user_id','=',me).execute();
    const row = rows.find((r) => r.dedupe_key === `reply:${parent}`);
    expect(row).toBeDefined();
    expect(row!.actor_id).toBe(actor); // guards against nulling actor_id (UserDTO.user_id, not .id)
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- test/notifications/dual-read.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/backfill-notifications.js'`.

- [ ] **Step 3: Implement the backfill**

Create `backend/scripts/backfill-notifications.ts`:

```typescript
import type { Kysely } from 'kysely';
import type { DB } from '../codegen/db.js';
import { getNotifications } from '../src/messaging/notifications.js';
import { persistNotification } from '../src/notifications/store.js';

// Seed durable rows from the derived feed for one user. Returns count of NEW rows.
// Idempotent: the unique (user_id, dedupe_key) makes re-runs no-ops.
export async function backfillUser(db: Kysely<DB>, userId: string): Promise<number> {
  const derived = await getNotifications(db, userId);
  let inserted = 0;
  for (const n of derived) {
    const res = await persistNotification(db, {
      userId,
      type: n.type,
      actorId: n.actor?.user_id ?? null,   // UserDTO exposes user_id, NOT id
      dedupeKey: n.id,
      payload: { text: n.text, channel_url: n.channel_url, message_id: n.message_id, actor: n.actor },
      createdAt: new Date(n.created_at),
    });
    if (res.inserted) inserted++;
    // Stamp read state to match the derived feed.
    if (n.is_read) {
      await db.updateTable('bom_notification')
        .set({ read_at: new Date(n.created_at) })
        .where('user_id', '=', userId).where('dedupe_key', '=', n.id)
        .where('read_at', 'is', null).executeTakeFirst();
    }
  }
  return inserted;
}

// CLI: backfill every user with authored messages in the lookback window.
async function main(): Promise<void> {
  const { getDb } = await import('../src/data/db.js');
  const db = getDb();
  const users = await db
    .selectFrom('messenger_messages')
    .select('user_id')
    .where('parent_message_id', 'is', null)
    .distinct()
    .execute();
  let total = 0;
  for (const u of users) total += await backfillUser(db, u.user_id);
  console.log(`backfill complete: ${total} new rows across ${users.length} users`);
  await db.destroy();
}

// Run as a script (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('backfill-notifications.ts')
    || process.argv[1]?.endsWith('backfill-notifications.js')) {
  void main();
}
```

Notes:
- `UserDTO` (in `backend/src/messaging/dto.ts`) exposes `user_id`, not `id` — the payload stores the whole `UserDTO` so `rowToDTO` round-trips it unchanged; only `actor_id` needs the scalar.
- The CLI's user selection (`DISTINCT user_id ... WHERE parent_message_id IS NULL`) covers authors of top-level messages but **misses invite-only recipients** who never authored anything. That's acceptable: invites still surface via the derived arm of dual-read, and `pushNotificationForEvent` has no invite branch in phase 1 (so invites are derived + backfilled only, never written live). The scan is also unbounded over history; if it's slow, add `AND created_at > (NOW() - INTERVAL 30 DAY)`.
- `scripts/` is excluded from `tsc --noEmit`, so a wrong field name here would NOT be caught by typecheck — the Task 7 test's `actor_id` assertion is the guard.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- test/notifications/dual-read.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/backfill-notifications.ts backend/test/notifications/dual-read.test.ts
git commit -m "feat(notifications): idempotent backfill from derived feed"
```

---

## Task 8: Full verification & integration checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Typecheck the whole backend**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Run the full notifications + messaging suites**

Run: `cd backend && npm test -- test/notifications test/messaging/notifications.test.ts`
Expected: PASS (or documented skips if the DB is read-only — if skipped, re-run with `MYSQL_WRITE_USER`/`MYSQL_WRITE_PASSWORD` set and confirm PASS before claiming done).

- [ ] **Step 3: Manual smoke — a live reply persists a row and pushes**

The dev backend must run with `SANDBOX=0` for this smoke (otherwise `sandboxDialect` suppresses the insert and no row/push appears — see Task 3's design note). Coordinate before bouncing `bom-dev` (it fronts the public dev URL). With the backend running, post a reply to your own message via the app, then:
Run: `mysql ... -e "SELECT dedupe_key, type, read_at FROM bom_notification ORDER BY id DESC LIMIT 5;"`
Expected: a fresh `reply:<msgId>` row; the bell badge increments in the UI (screenshot `http://localhost:8200`, not `bom.kckern.net` — the CDN caches the bundle).

- [ ] **Step 4: HELD — do NOT run the all-users backfill** (KC decision, 2026-08-06)

The DB is `bom_prd` (production). The all-users backfill (`npx tsx scripts/backfill-notifications.ts`) inserts real notification rows for every user and is deferred to KC to run deliberately as the rollout step. The backfill *code* and its self-cleaning unit test (Task 7) are still built and verified. Do not run the CLI here.

- [ ] **Step 5: Final commit / branch push**

```bash
git add -A && git commit -m "chore(notifications): phase-1 verification checkpoint" || true
git push origin HEAD
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** table (Task 1) ✓ · `notify()` core (Tasks 2–3) ✓ · producer write-through (Task 4) ✓ · dual-read (Task 5) ✓ · read state on table (Task 6) ✓ · backfill (Task 7) ✓. **Scope note:** `pushNotificationForEvent` only has reply + reaction branches, so only those two write live via `notify()`; **invites** have no producer branch in phase 1 and reach the table via backfill only (they still surface through the derived arm). Wiring an invite producer is a small phase-1.b follow-up. **Deferred by design:** full metadata read-state retirement (phase 1.b), new notification *types* (phase 2), email/push adapters (later) — all called out.
- **Type consistency:** `NotificationPayload`/`PersistNotificationInput` defined once in `store.ts`, imported by `notify.ts`, `pushNotificationForEvent`, and the backfill. Public id == `dedupe_key` everywhere. `rowToDTO` is the single row→DTO renderer, reused by `notify()` and `getNotifications`.
- **Open risks flagged for the implementer:** `UserDTO` field name (`id` vs `user_id`) — verified in Task 0; Kysely `.ignore()` availability — verified in Task 0; codegen vs hand-edit of `db.d.ts` — Task 1.
- **Contract stability:** GraphQL SDL and the `notification_received` socket payload are unchanged; the frontend needs no edits in phase 1.
