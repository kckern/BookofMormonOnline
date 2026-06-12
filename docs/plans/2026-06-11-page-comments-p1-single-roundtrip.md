# Page Comments P1 — One Round Trip, One Paint: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page-scoped study comments load in exactly one GraphQL round trip and paint in exactly one React commit (no intermediate `counts: null` render).

**Architecture:** New backend service `getPageComments(db, channelUrl, pageSlug)` returns `{ messages, counts }` — messages SQL-filtered by `custom_type = pageSlug`, with com/img → verse counts resolved server-side via `SlugResolver` (the location join the frontend currently does with a second round trip). Exposed as `pagecomments` in the Messenger SDL (counts as `JSON`). The frontend controller gains `loadPageComments`; `Page.js` drops its two-phase index→count pipeline and dispatches `setPageComments` once, merging the (purely client-side) facsimile counts.

**Tech Stack:** Backend: Kysely/MySQL, graphql-yoga SDL-first + codegen, vitest (DB-backed). Frontend: React 17 CRA, jest.

**Spec:** `docs/specs/2026-06-11-page-comments-best-in-class.md` (P1 section)

**Shared context for all tasks:**
- Backend tests: `cd /home/bom/BookofMormonOnline/backend && npx vitest run <file>`; they hit the real DB using `backend/.env` (`MYSQL_*`), helpers seed throwaway rows (`test_<nanoid>`) and clean up. See `backend/test/messaging/messages.test.ts` for `seedChannelAndUser`/`trackMessage`/`itWrite` patterns — copy them.
- Frontend tests: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --testPathPattern '<pattern>'`.
- The live dev server (systemd `bom-dev`) serves this working tree with HMR; backend is systemd `bom-greenfield` on :5006 (restart it after backend changes: `systemctl --user restart bom-greenfield` — pre-authorized).
- Work on `dev` directly; commit per task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; do NOT push.
- Data model facts (verified): message `data` is a JSON string like `{"links":{"com":"1017218101","img":"123","fax":"x"}}`. `bom_xtras_commentary` and `bom_xtras_image` both have `location_guid`. `SlugResolver` (`backend/src/data/slugResolver.ts`) `pathsForLinks(guids)` maps entity guids → full slug paths (e.g. `"alma-32/21"`); instantiate as `new SlugResolver(db)` (pattern: `backend/src/data/loaders/ported_community.ts:164`). The frontend matches location slugs with `/(.*?)\/(\d+)$/` and keeps those whose prefix equals the page slug; the verse number keys the counts: `counts[num] = { com: [ids], img: [ids], fax: [vers] }`.

---

### Task 1: Backend service `getPageComments`

**Files:**
- Create: `backend/src/messaging/pagecomments.ts`
- Test: `backend/test/messaging/pagecomments.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/test/messaging/pagecomments.test.ts
/**
 * DB-backed test for getPageComments. Seeds throwaway channel/user/messages;
 * uses a REAL commentary row (content tables are stable) discovered at
 * runtime so no content id is hardcoded.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { getPageComments } from '../../src/messaging/pagecomments.js';
import { postMessage } from '../../src/messaging/messages.js';
import { SlugResolver } from '../../src/data/slugResolver.js';

function buildWriteDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user = process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password = process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({ host, port, database, user, password, connectionLimit: 5 }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

let db: Kysely<DB>;
let canWrite = false;
const channelUrl = `test_ch_${nanoid(10)}`;
const userId = `test_u_${nanoid(10)}`;
const messageIds: string[] = [];

// Discovered at setup: a real commentary and the page/verse its location maps to.
let comId: number;
let pageSlug: string;
let verseNum: string;

beforeAll(async () => {
  db = buildWriteDb();
  try {
    await db.insertInto('messenger_users').values({ user_id: userId, nickname: 'T', profile_url: '', is_bot: 0 }).execute();
    await db.insertInto('messenger_channels').values({ channel_url: channelUrl, name: 'T', custom_type: 'private' }).execute();
    canWrite = true;
  } catch {
    canWrite = false; // read-only env: suite becomes a no-op
  }
  if (!canWrite) return;

  // Find a commentary whose location resolves to a "<page>/<num>" slug.
  const candidates = await db
    .selectFrom('bom_xtras_commentary')
    .select(['id', 'location_guid'])
    .where('location_guid', 'is not', null)
    .where('location_guid', '!=', 'NULL')
    .limit(25)
    .execute();
  const slugs = await new SlugResolver(db).pathsForLinks(candidates.map((c) => c.location_guid as string));
  for (const c of candidates) {
    const slug = slugs.get(c.location_guid as string);
    const m = slug?.match(/(.*?)\/(\d+)$/);
    if (m) {
      comId = Number(c.id);
      pageSlug = m[1].split('/').pop() as string; // page slug segment the frontend compares
      // NOTE: frontend compares match[1] (full prefix) to pageData.slug; mirror service behavior in assertions below
      pageSlug = m[1];
      verseNum = m[2];
      break;
    }
  }
  expect(comId).toBeDefined();

  const seed = async (message: string, customType: string, data: string | undefined) => {
    const dto = await postMessage(db, { channelUrl, userId, message, customType, data });
    messageIds.push(dto.message_id);
  };
  await seed('on this page w/ commentary', pageSlug, JSON.stringify({ links: { com: String(comId) } }));
  await seed('on this page, plain', pageSlug, undefined);
  await seed('different page', 'some-other-page', JSON.stringify({ links: { com: String(comId) } }));
});

afterAll(async () => {
  if (canWrite) {
    if (messageIds.length) await db.deleteFrom('messenger_messages').where('message_id', 'in', messageIds).execute();
    await db.deleteFrom('messenger_channels').where('channel_url', '=', channelUrl).execute();
    await db.deleteFrom('messenger_users').where('user_id', '=', userId).execute();
  }
  await db.destroy();
});

describe('getPageComments', () => {
  it('returns only page-scoped messages with server-resolved verse counts', async () => {
    if (!canWrite) return;
    const { messages, counts } = await getPageComments(db, channelUrl, pageSlug);
    const ids = messages.map((m) => m.message_id);
    expect(ids).toContain(messageIds[0]);
    expect(ids).toContain(messageIds[1]);
    expect(ids).not.toContain(messageIds[2]); // other page's message excluded in SQL
    expect(counts[verseNum]?.com).toContain(comId);
  });

  it('returns empty counts when no com/img links exist', async () => {
    if (!canWrite) return;
    const { counts } = await getPageComments(db, channelUrl, 'page-with-no-comments-xyz');
    expect(counts).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/messaging/pagecomments.test.ts`
Expected: FAIL — `Cannot find module '../../src/messaging/pagecomments.js'`

- [ ] **Step 3: Implement the service**

```ts
// backend/src/messaging/pagecomments.ts
/**
 * messaging/pagecomments.ts — page-scoped study comments + per-verse counts
 * in one unit of work (spec P1: docs/specs/2026-06-11-page-comments-best-in-class.md).
 *
 * Messages are SQL-filtered to custom_type = pageSlug (getMessages customTypes),
 * then com/img ids referenced in each message's data JSON `links` are resolved
 * to location slugs via SlugResolver and reduced to per-verse counts —
 * replacing the frontend's second commentaryLocations/imageLocations round
 * trip. Facsimile ("fax") counts stay client-side (they derive from the index
 * alone; no location lookup involved).
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getMessages } from './messages.js';
import type { MessageDTO } from './dto.js';
import { SlugResolver } from '../data/slugResolver.js';

export type PageCommentCounts = Record<string, { com?: number[]; img?: number[] }>;

const PAGE_COMMENTS_LIMIT = 500;

function collectLinkIds(messages: MessageDTO[]): { com: number[]; img: number[] } {
  const com = new Set<number>();
  const img = new Set<number>();
  for (const m of messages) {
    if (!m.data) continue;
    let meta: unknown;
    try {
      meta = JSON.parse(m.data);
    } catch {
      continue;
    }
    const links = (meta as { links?: Record<string, unknown> } | null)?.links;
    if (!links) continue;
    const c = Number(links['com']);
    if (Number.isFinite(c)) com.add(c);
    const i = Number(links['img']);
    if (Number.isFinite(i)) img.add(i);
  }
  return { com: [...com], img: [...img] };
}

async function locationGuids(
  db: Kysely<DB>,
  table: 'bom_xtras_commentary' | 'bom_xtras_image',
  ids: number[],
): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await db
    .selectFrom(table)
    .select(['id', 'location_guid'])
    .where('id', 'in', ids)
    .execute();
  const out = new Map<number, string>();
  for (const r of rows) {
    const g = r.location_guid as string | null;
    if (g && g !== 'NULL') out.set(Number(r.id), g);
  }
  return out;
}

export async function getPageComments(
  db: Kysely<DB>,
  channelUrl: string,
  pageSlug: string,
): Promise<{ messages: MessageDTO[]; counts: PageCommentCounts }> {
  const messages = await getMessages(db, channelUrl, {
    customTypes: [pageSlug],
    limit: PAGE_COMMENTS_LIMIT,
  });

  const { com, img } = collectLinkIds(messages);
  const counts: PageCommentCounts = {};
  if (!com.length && !img.length) return { messages, counts };

  const [comLocs, imgLocs] = await Promise.all([
    locationGuids(db, 'bom_xtras_commentary', com),
    locationGuids(db, 'bom_xtras_image', img),
  ]);
  const allGuids = [...new Set([...comLocs.values(), ...imgLocs.values()])];
  const slugs = await new SlugResolver(db).pathsForLinks(allGuids);

  const tally = (locs: Map<number, string>, kind: 'com' | 'img') => {
    for (const [id, guid] of locs) {
      const slug = slugs.get(guid);
      const m = slug?.match(/(.*?)\/(\d+)$/);
      if (!m || m[1] !== pageSlug) continue; // located on a different page
      const verse = m[2];
      (counts[verse] ??= {});
      ((counts[verse] as Record<string, number[]>)[kind] ??= []).push(id);
    }
  };
  tally(comLocs, 'com');
  tally(imgLocs, 'img');

  return { messages, counts };
}
```

(`messaging/` and `data/` are siblings under `src/`, hence `../data/slugResolver.js`.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/messaging/pagecomments.test.ts && npx tsc --noEmit`
Expected: 2 tests PASS, tsc clean. If `postMessage` rejects the seeded `data` argument, check its `params` type in `backend/src/messaging/messages.ts` (~line 287) — it accepts `data?: string`.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/messaging/pagecomments.ts backend/test/messaging/pagecomments.test.ts
git commit -m "feat(messenger): getPageComments — page-scoped messages + server-resolved verse counts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: SDL field + resolver

**Files:**
- Modify: `backend/schema/Messenger.graphql` (Query block, after `messengerMessages`)
- Modify: `backend/src/graphql/resolvers/messenger.ts`
- Regenerate: `backend/codegen/graphql.ts` (via npm script)

- [ ] **Step 1: SDL**

In `backend/schema/Messenger.graphql` add inside `extend type Query`:

```graphql
  pagecomments(channelUrl: String, pageSlug: String): MessengerPageComments
```

and a new type (next to the other type definitions):

```graphql
type MessengerPageComments {
  messages: [MessengerMessage]
  counts: JSON
}
```

(`JSON` scalar already exists — `MessengerChannel.metadata` and `MessengerUser.metadata` use it.)

- [ ] **Step 2: Resolver**

In `backend/src/graphql/resolvers/messenger.ts`, import the service alongside the existing messaging imports:

```ts
import { getPageComments } from '../../messaging/pagecomments.js';
```

and add to `Query` (after `messengerMessages`):

```ts
    /**
     * pagecomments(channelUrl, pageSlug) — page-scoped study comments plus
     * per-verse com/img counts resolved server-side (spec P1): one round trip
     * where the client previously needed messages + commentaryLocations/
     * imageLocations.
     */
    pagecomments: async (_root, args, ctx: AppContext) => {
      if (!args.channelUrl || !args.pageSlug) return null;
      return getPageComments(ctx.db, args.channelUrl, args.pageSlug);
    },
```

- [ ] **Step 3: Codegen + typecheck**

Run: `cd /home/bom/BookofMormonOnline/backend && npm run codegen:graphql && npx tsc --noEmit`
Expected: codegen SUCCESS lines, tsc clean.

- [ ] **Step 4: Live verify**

```bash
systemctl --user restart bom-greenfield && sleep 6
curl -s -X POST http://localhost:5006/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ pagecomments(channelUrl: \"4f7002d41a94cc82c02f8ddb543f6894\", pageSlug: \"isaiah\") { messages { message_id custom_type } counts } }"}' \
  | head -c 600
```
Expected: JSON with `messages` all `custom_type: "isaiah"` (63 of them) and a `counts` object keyed by verse numbers. (Channel verified earlier today: it has 63 isaiah-scoped messages.) Note: the legacy response filter strips empty objects/arrays — `counts` may be absent if (unexpectedly) empty; messages must not be.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/Messenger.graphql backend/src/graphql/resolvers/messenger.ts backend/codegen/graphql.ts
git commit -m "feat(messenger): pagecomments query — messages + counts in one round trip

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — controller method + fax counts module

**Files:**
- Modify: `frontend/webapp/src/models/MessengerController.js` (add `loadPageComments` near `loadGroupMessages`, ~line 508)
- Create: `frontend/webapp/src/views/Page/pageCommentCounts.js`
- Test: `frontend/webapp/src/views/Page/__tests__/pageCommentCounts.test.js`

- [ ] **Step 1: Failing test for the fax/merge module**

```js
// frontend/webapp/src/views/Page/__tests__/pageCommentCounts.test.js
import { countFaxFromIndex, mergeCounts } from "../pageCommentCounts";

test("countFaxFromIndex groups fax versions by verse num", () => {
  const index = { fax: { "21.a": {}, "21.b": {}, "3.a": {} } };
  expect(countFaxFromIndex(index)).toEqual({
    21: { fax: ["a", "b"] },
    3: { fax: ["a"] },
  });
});

test("countFaxFromIndex tolerates missing fax key", () => {
  expect(countFaxFromIndex({})).toEqual({});
  expect(countFaxFromIndex(undefined)).toEqual({});
});

test("mergeCounts merges server com/img with client fax per verse", () => {
  const server = { 21: { com: [1, 2] }, 5: { img: [9] } };
  const fax = { 21: { fax: ["a"] }, 7: { fax: ["b"] } };
  expect(mergeCounts(server, fax)).toEqual({
    21: { com: [1, 2], fax: ["a"] },
    5: { img: [9] },
    7: { fax: ["b"] },
  });
});

test("mergeCounts tolerates null server counts (stripped empty object)", () => {
  expect(mergeCounts(null, { 1: { fax: ["a"] } })).toEqual({ 1: { fax: ["a"] } });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --testPathPattern 'pageCommentCounts'`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```js
// frontend/webapp/src/views/Page/pageCommentCounts.js
// Pure helpers for page-comment count assembly. com/img counts come from the
// backend (pagecomments query, spec P1); facsimile counts derive purely from
// the message index (no location lookup), so they stay client-side.

// index.fax keys look like "<verseNum>.<version>" — group versions by verse.
export function countFaxFromIndex(index) {
  const counts = {};
  const fax = index?.fax || {};
  for (const key of Object.keys(fax)) {
    const [num, ver] = key.split(".");
    if (!counts[num]) counts[num] = {};
    if (!counts[num].fax) counts[num].fax = [];
    counts[num].fax.push(ver);
  }
  return counts;
}

// Merge per-verse count objects ({num: {com/img/fax: []}}); later sources
// add keys to existing verses without clobbering.
export function mergeCounts(...sources) {
  const out = {};
  for (const src of sources) {
    if (!src) continue;
    for (const num of Object.keys(src)) {
      out[num] = { ...(out[num] || {}), ...src[num] };
    }
  }
  return out;
}
```

- [ ] **Step 4: Controller method**

In `frontend/webapp/src/models/MessengerController.js`, directly after the `loadGroupMessages` method, add:

```js
  // One-round-trip page comments (spec P1): page-scoped messages (SQL
  // custom_type filter) + per-verse com/img counts resolved server-side.
  // Returns { messages: normalized[], counts: object } — counts may be {}
  // (the legacy response filter strips empty objects to absent).
  async loadPageComments(group, pageSlug) {
    const channelUrl = group.channel_url || group.url;
    try {
      const query = `query {
        pagecomments(channelUrl: "${channelUrl}", pageSlug: ${JSON.stringify(pageSlug)}) {
          counts
          messages {
            message_id
            channel_url
            user_id
            user {
              user_id
              nickname
              profile_url
              metadata
              is_bot
              is_online
            }
            message_type
            message
            custom_type
            data
            link_type
            link_target
            parent_message_id
            thread_info { reply_count }
            reactions { reaction_key user_ids }
            created_at
            updated_at
          }
        }
      }`;
      const result = await this.gqlRequest(query);
      const pc = result?.pagecomments || {};
      return {
        messages: (pc.messages || []).map((msg) => this._normalizeMessage(msg)),
        counts: pc.counts || {},
      };
    } catch (error) {
      console.error('Messenger: loadPageComments error', error);
      return { messages: [], counts: {} };
    }
  }
```

NOTE: there is already a `loadThreadedMessages` and similar methods on this class — confirm no existing method named `loadPageComments` exists before adding (grep). If the no-op stub list in `src/contexts/MessengerContext.js` (`noopController`) should expose it for signed-out safety, add `loadPageComments: () => Promise.resolve({ messages: [], counts: {} }),` to the stub object and extend the stub test in `frontend/webapp/src/contexts/__tests__/MessengerContext.test.js` ("noopController has the legacy stub surface") with:
```js
  await expect(stub.loadPageComments()).resolves.toEqual({ messages: [], counts: {} });
```

- [ ] **Step 5: Run tests**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --testPathPattern 'pageCommentCounts|MessengerContext'`
Expected: all PASS (4 new + 9 context).

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Page/pageCommentCounts.js frontend/webapp/src/views/Page/__tests__/pageCommentCounts.test.js frontend/webapp/src/models/MessengerController.js frontend/webapp/src/contexts/
git commit -m "feat(page): loadPageComments controller method + fax/merge count helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Page.js — single dispatch, drop the second round trip

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js` (`loadPageComments` fn ~line 445-553; `countPageComments` fn ~line 846-896; imports)

Read the whole `loadPageComments` function and `countPageComments` before editing.

- [ ] **Step 1: Rewire the load pipeline**

In Page.js `loadPageComments(pageController, setReadyToScroll)`:

KEEP unchanged: the `newPageLoad`/`switchToOtherGroup` gating, the reset dispatch (`setPageComments({ groupId: null, index: null, counts: null })`), the add/update/delete window listeners, the `COMMENTS_FALLBACK_MS` fallback timer and its `recordDeepLinkEvent`, and `setReadyToScroll` semantics.

REPLACE the `listQuery` construction + `listQuery.load().then(...)` block (the part that builds `createPreviousMessageListQuery`, indexes, dispatches `counts: null`, then calls `countPageComments`) with:

```js
    const sendbird = pageController.appController.sendbird;
    if (!sendbird?.loadPageComments) {
      clearTimeout(fallbackTimer);
      setReadyToScroll(true);
      return false;
    }
    setCommentState("made query");
    sendbird
      .loadPageComments(group, pageController.pageData?.slug)
      .then(({ messages, counts }) => {
        clearTimeout(fallbackTimer);
        setCommentState("indexing");
        const index = indexPageComments(messages);
        // Single paint: index AND counts land in one dispatch (spec P1) —
        // fax counts derive from the index client-side, com/img came from
        // the server.
        setCommentState("placing");
        pageController.functions.setPageComments({
          groupId,
          index,
          counts: mergeCounts(counts, countFaxFromIndex(index)),
        });
      })
      .catch((error) => {
        clearTimeout(fallbackTimer);
        console.log({ error });
        setReadyToScroll(true);
      });
```

Note `groupId` is already defined above the replaced block (`let groupId = group.url;`) — keep it. The legacy non-messenger group objects (if any) without `loadPageComments` hit the guard and behave as before (no comments).

- [ ] **Step 2: Delete `countPageComments` and its callers**

Delete the whole `countPageComments` function (~line 846-896, including the commentary/image locations `BoMOnlineAPI` query and both tally loops — the fax block at its top is superseded by `countFaxFromIndex`). Grep for remaining `countPageComments` references — must be zero.

- [ ] **Step 3: Imports**

Add to Page.js imports:

```js
import { countFaxFromIndex, mergeCounts } from "./pageCommentCounts";
```

- [ ] **Step 4: Verify**

1. `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false 2>&1 | tail -4` — ALL suites pass.
2. `sleep 10; journalctl --user -u bom-dev --since "2 minutes ago" --no-pager | grep -iE "webpack compiled|ERROR in" | tail -2` — compiled, no `ERROR in`.
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8200/` → 200.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Page/Page.js
git commit -m "feat(page): comments load in one round trip and paint once

Replaces the messages→index→locations second query with the pagecomments
field; setPageComments dispatches once with index AND counts (no
intermediate counts:null render).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end acceptance check

**Files:** none (verification)

- [ ] **Step 1: Single-request proof**

`journalctl --user -u bom-greenfield -f` while loading a page with comments in the browser (or simulate: the Task 2 curl). On a page load with an active study group, exactly ONE `/graphql` POST should correspond to comments (it's the `pagecomments` op). The old behavior was two (messages, then locations).

- [ ] **Step 2: Single-paint proof (code-level)**

Grep Page.js: exactly ONE `setPageComments` call with non-null payload in the load path (the reset dispatch with nulls on group-switch is allowed). `counts: null` must not appear in the success path.

- [ ] **Step 3: Report**

Report to controller: request count evidence, dispatch audit, full test totals.
