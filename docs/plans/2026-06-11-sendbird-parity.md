# SendBird Compat Shim — Full Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every gap the SendBird-surface sweep found between what the frontend still consumes of the old SendBird SDK and what `MessengerController`'s compat shim implements — 7 crashes-now, 16 silently-wrong (gap table: the sweep report, summarized per task below).

**Architecture:** Almost all gaps are frontend-side: GraphQL queries that don't select fields the backend already exposes (`MessengerMember` has `metadata/is_online/role/state/is_muted`; `MessengerMessage` has `message_type` and a full `user`), and normalizers that don't map them. Strategy: (1) extract the normalizers into a pure, unit-tested `messengerShapes.js` and make them produce the complete SendBird shapes; (2) widen the query field selections; (3) add the missing channel methods/query-objects/callback signatures; (4) mentions ride in the existing `data` JSON passthrough (no DB migration). Crashes-now items land first.

**Tech Stack:** React 17/CRA jest for the pure-shape tests (do NOT import MessengerController in tests — socket.io; only the new pure module); existing e2e harness (`e2e/study-userlist.spec.js` pattern, TEST_USER/TEST_PASS env) for login-path smoke.

**Working directory:** repo root `/home/bom/BookofMormonOnline`; branch `dev`, commit directly. Don't restart `bom-dev`; verify on `localhost:8200`.

**Backend facts (GREEN-FIELD — the backend the dev frontend actually uses: `backend/`, :5006, systemd `bom-greenfield`, plain `tsx` (NO watch — every backend edit needs `systemctl --user restart bom-greenfield`, which is authorized; it drops :5006 sockets but does not touch the frontend). SDL: `backend/schema/Messenger.graphql`; resolvers: `backend/src/graphql/resolvers/messenger.ts`; socket handlers: `backend/src/realtime/handlers/*`; fan-out: `RealtimeBus.emit → io.to(room)`. Logs: `journalctl --user -u bom-greenfield -f`.**

- `MessengerMember { user_id nickname profile_url role state is_muted }` — SDL lacks `metadata/is_online/last_seen_at/is_bot`, but the resolver already returns them (MemberDTO extends UserDTO) → adding the SDL fields is purely additive (Task P2b).
- `MessengerMessage { message_id channel_url user_id user message_type message custom_type link_type link_target parent_message_id thread_info reactions created_at updated_at }` — no `data` field on the GQL surface (socket DTO carries `data` instead of link_type/link_target).
- `MessengerUser { user_id nickname profile_url metadata is_online is_bot last_seen_at }`.
- `messengerCreateChannel(name, customType, description, coverUrl, operatorIds)` — FLAT args; no `input:` wrapper, no `userIds`/`channelUrl` exposed (the underlying service supports them). `messengerUpdateChannel(channelUrl, name, description)` exists. `messengerRemoveMember(channelUrl, userId)` exists (operator-or-self; emits `membership_changed` + `user_left`). There is NO `messengerMarkAsRead` mutation — read-marking is the socket `mark_read` event (the client already uses it).
- Realtime emits use the client's listener names and are channel-scoped: `message_received/updated/deleted`, `typing`, `reaction_changed` (full `reactions[]` snapshot), `channel_action`, `membership_changed`/`user_joined`/`user_left` (including from GraphQL mutations), `unread_count_changed` (from `mark_read` only — unicast to the actor).
- NO presence event is pushed on connect/disconnect; presence is Redis-backed and computed at read time (`getUsers` → `is_online`). `last_seen_at` is DB-durable.
- `messenger_members.state ∈ joined|invited|requested`. No mentions column; green-field does not yet persist/round-trip a raw message `data` blob (Task 7 backend step).
- The client `gqlRequest` takes a QUERY STRING ONLY (no variables argument) — inline args per the `createNewGroup` pattern.

---

### Task 1: `messengerShapes.js` — complete, unit-tested SendBird shapes

**Files:**
- Create: `frontend/webapp/src/models/messengerShapes.js`
- Test: `frontend/webapp/src/models/__tests__/messengerShapes.test.js`
- Modify: `frontend/webapp/src/models/MessengerController.js` (delegate `_normalizeUser`/`_normalizeMessage`/member mapping to the new module; `_normalizeChannel`'s data fields likewise — its method closures stay in the controller)

Closes: crash #3 (`message.mentionedUsers` undefined → `.length` throws in `Utils.formatText`), crash #4 (`message.sender.metaData` destructure throws in Study.js:803/StudyChat.js:1227), silently-wrong #9 `member.plainProfileUrl`, #10 `member.metaData`, #11 `member.connectionStatus`, #12/#13 `_sender` alias, #14 `sender.plainProfileUrl`, #15 `messageType`, #16 `myMemberState`, #17 `joinedMemberCount`, #8 `myRole`, #18 `currentUser.user_id`.

- [ ] **Step 1: Write the failing tests** — create `frontend/webapp/src/models/__tests__/messengerShapes.test.js`:

```js
import {
  shapeUser,
  shapeMember,
  shapeMessage,
  shapeChannelFields,
} from "../messengerShapes";

const gqlUser = {
  user_id: "u1",
  nickname: "Nick",
  profile_url: "http://x/p.png",
  metadata: { activeGroup: "g1", summary: "{}" },
  is_online: true,
  last_seen_at: 123,
  is_bot: false,
};

test("shapeUser maps the full SendBird user shape (incl. snake_case alias)", () => {
  const u = shapeUser(gqlUser);
  expect(u).toMatchObject({
    userId: "u1",
    user_id: "u1", // legacy snake_case consumers (Sidebar.js)
    nickname: "Nick",
    profileUrl: "http://x/p.png",
    plainProfileUrl: "http://x/p.png",
    connectionStatus: "online",
    lastSeenAt: 123,
  });
  expect(u.metaData).toEqual({ activeGroup: "g1", summary: "{}" });
});

test("shapeUser defaults: no metadata → {}, offline, bot flag folded in", () => {
  const u = shapeUser({ user_id: "u2", is_bot: true });
  expect(u.metaData).toEqual({ isBot: true });
  expect(u.connectionStatus).toBe("offline");
});

test("shapeMember includes role/state/muted on top of the user shape", () => {
  const m = shapeMember({ ...gqlUser, role: "operator", state: "joined", is_muted: true });
  expect(m.role).toBe("operator");
  expect(m.state).toBe("joined");
  expect(m.isMuted).toBe(true);
  expect(m.plainProfileUrl).toBe("http://x/p.png");
  expect(m.metaData).toEqual(gqlUser.metadata);
  expect(m.connectionStatus).toBe("online");
});

test("shapeMessage: sender + _sender alias, messageType, safe defaults", () => {
  const msg = shapeMessage({
    message_id: "10",
    channel_url: "c1",
    message: "hello",
    message_type: "MESG",
    user: gqlUser,
    created_at: 5,
  });
  expect(msg.messageId).toBe("10");
  expect(msg.messageType).toBe("user"); // MESG→user, ADMN→admin, FILE→file
  expect(msg.sender.userId).toBe("u1");
  expect(msg.sender.plainProfileUrl).toBe("http://x/p.png");
  expect(msg.sender.metaData).toEqual(gqlUser.metadata);
  expect(msg._sender).toBe(msg.sender); // legacy underscore consumers
  expect(msg.mentionedUsers).toEqual([]); // never undefined (formatText does .length)
});

test("shapeMessage: missing user yields a null-safe sender", () => {
  const msg = shapeMessage({ message_id: "11", message: "x", message_type: "ADMN" });
  expect(msg.messageType).toBe("admin");
  expect(msg.sender.metaData).toEqual({}); // Study.js destructures sender.metaData
  expect(msg.mentionedUsers).toEqual([]);
});

test("shapeMessage: mentions stored in data JSON are surfaced as user-ish objects", () => {
  const msg = shapeMessage(
    {
      message_id: "12",
      message: "@Nick hi",
      message_type: "MESG",
      data: JSON.stringify({ mentionedUserIds: ["u1"], mentionType: "users" }),
    },
    { resolveUser: (id) => (id === "u1" ? shapeUser(gqlUser) : null) }
  );
  expect(msg.mentionedUsers.map((u) => u.userId)).toEqual(["u1"]);
  expect(msg.mentionType).toBe("users");
});

test("shapeChannelFields: myRole/myMemberState/joinedMemberCount for the current user", () => {
  const ch = {
    channel_url: "c1",
    members: [
      { ...gqlUser, role: "operator", state: "joined" },
      { user_id: "u9", role: "member", state: "invited" },
    ],
  };
  const f = shapeChannelFields(ch, "u1");
  expect(f.myRole).toBe("operator");
  expect(f.myMemberState).toBe("joined");
  expect(f.joinedMemberCount).toBe(1);
  expect(f.members[0].plainProfileUrl).toBe("http://x/p.png");
});

test("shapeChannelFields: non-member viewer gets none/undefined gracefully", () => {
  const f = shapeChannelFields({ members: [] }, "stranger");
  expect(f.myRole).toBe("none");
  expect(f.joinedMemberCount).toBe(0);
});
```

- [ ] **Step 2: Run — must fail (module not found):**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/models/__tests__/messengerShapes.test.js
```

- [ ] **Step 3: Create `frontend/webapp/src/models/messengerShapes.js`:**

```js
// Pure GraphQL→SendBird shape mappers for the messenger compat shim.
// MessengerController delegates here; tests import this module only
// (the controller drags in socket.io and can't run under jsdom).

const MESSAGE_TYPE = { MESG: "user", ADMN: "admin", FILE: "file" };

export function shapeUser(u = {}) {
  const metaData = {
    ...(u.metadata || {}),
    ...(u.is_bot ? { isBot: true } : {}),
  };
  return {
    userId: u.user_id,
    user_id: u.user_id, // legacy snake_case consumers (Sidebar.js:384)
    nickname: u.nickname,
    profileUrl: u.profile_url,
    plainProfileUrl: u.profile_url,
    metaData,
    connectionStatus: u.is_online ? "online" : "offline",
    lastSeenAt: u.last_seen_at || null,
  };
}

export function shapeMember(m = {}) {
  return {
    ...shapeUser(m),
    role: m.role || "member",
    state: m.state || "joined",
    isMuted: !!m.is_muted,
  };
}

export function parseMessageData(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

// opts.resolveUser: (userId) => shaped user | null — used to surface
// mentions (stored as ids in the data JSON) as user objects, the shape
// Utils.formatText expects.
export function shapeMessage(msg = {}, opts = {}) {
  const sender = msg.user ? shapeUser(msg.user) : { metaData: {} };
  const dataObj = parseMessageData(msg.data);
  const mentionedIds = Array.isArray(dataObj.mentionedUserIds)
    ? dataObj.mentionedUserIds
    : [];
  const resolveUser = opts.resolveUser || (() => null);
  const mentionedUsers = mentionedIds
    .map((id) => resolveUser(id) || { userId: id, nickname: id, metaData: {} })
    .filter(Boolean);
  return {
    messageId: msg.message_id,
    channelUrl: msg.channel_url,
    message: msg.message,
    messageType: MESSAGE_TYPE[msg.message_type] || "user",
    customType: msg.custom_type,
    data: msg.data,
    parentMessageId: msg.parent_message_id,
    sender,
    _sender: sender, // legacy underscore consumers (StudyGroupSelect, appController)
    mentionedUsers,
    mentionType: dataObj.mentionType || "users",
    createdAt: msg.created_at,
    updatedAt: msg.updated_at,
  };
}

// Channel DATA fields only (methods live on the controller's channel object).
export function shapeChannelFields(ch = {}, currentUserId) {
  const members = (ch.members || []).map(shapeMember);
  const me = members.find((m) => m.userId === currentUserId);
  return {
    members,
    myRole: me ? me.role : "none",
    myMemberState: me ? me.state : "none",
    joinedMemberCount: members.filter((m) => m.state === "joined").length,
  };
}
```

- [ ] **Step 4: Run — 8 passed.**

- [ ] **Step 5: Delegate from `MessengerController.js`.** Add the import at the top of the file:

```js
import { shapeUser, shapeMember, shapeMessage, shapeChannelFields } from './messengerShapes';
```

Then: (a) replace `_normalizeUser(u)`'s body with `return shapeUser(u);`. (b) In `_normalizeMessage(msg)`, replace the hand-built fields with:

```js
  _normalizeMessage(msg) {
    const normalized = shapeMessage(msg, {
      resolveUser: (id) => this._findKnownUser(id),
    });
    // ...keep whatever reaction/threadInfo wiring the method currently adds
    // (reactions normalization, applyReactionEvent, threadInfo) on top of
    // `normalized` — move those assignments onto this object and return it.
  }
```

Add the lookup helper next to it (searches cached channel members):

```js
  _findKnownUser(userId) {
    for (const ch of this.channels.values()) {
      const hit = (ch.members || []).find((m) => m.userId === userId);
      if (hit) return hit;
    }
    return null;
  }
```

(c) In `_normalizeChannel(ch)`, replace the inline `members: (ch.members || []).map(...)` block with the spread of `shapeChannelFields(ch, this.userId)` so the channel object gains `members` (fully shaped), `myRole`, `myMemberState`, `joinedMemberCount`; also run the existing `last_message` through `this._normalizeMessage` if it isn't already. Keep every existing method/property otherwise.

(d) `_currentUser`: wherever the controller builds it (connect path), run the result through `shapeUser` so `user_id`/`plainProfileUrl` exist (fixes Sidebar.js:384/386).

- [ ] **Step 6: Full suite green; manual smoke** (login flow on localhost:8200 — study bar renders, no console TypeErrors). Run the e2e guard:

```bash
set -a; . <(grep -E '^(TEST_USER|TEST_PASS)=' "$XDG_RUNTIME_DIR/bom-dev.env"); set +a
npx playwright test --config e2e/playwright.config.js study-userlist
```

- [ ] **Step 7: Commit** — `fix(messenger): complete SendBird user/member/message shapes (parity 1/7)` + Co-Authored-By trailer. (Use this trailer on every commit in this plan: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

### Task 2: Widen the GraphQL field selections

**Files:**
- Modify: `frontend/webapp/src/models/MessengerController.js` (every query string that selects members / last_message / message user)

Closes: the data half of Task 1's shapes (without these fields the shapes get `undefined`s), #21 (`getMetaData` empty because `messengerChannel` doesn't select `metadata`).

- [ ] **Step 1:** In the `getStudyGroups` query (`messengerMyChannels`, ~line 354): extend `members { ... }` to `members { user_id nickname profile_url metadata is_online role state is_muted }`, and `last_message { ... }` to `last_message { message_id message message_type custom_type data created_at user { user_id nickname profile_url metadata is_bot is_online } }`.
- [ ] **Step 2:** In the `sb.groupChannel.getChannel` query (`messengerChannel`): add `metadata` at channel level (fixes InviteLink hash) and the same widened `members { ... }` selection.
- [ ] **Step 3:** In every message-loading query (`loadGroupMessages`, `loadPreviousMessages`, `loadThreadedMessages`, `messengerMessage`): ensure the selection includes `message_type data` and `user { user_id nickname profile_url metadata is_bot is_online }`.
- [ ] **Step 4:** Verify: full jest suite green; e2e `study-userlist` green; manual: open the study bar → member presence dots and avatars render (this is the visible payoff of #9/#10/#11).
- [ ] **Step 5: Commit** — `fix(messenger): select the member/message fields the shapes need (parity 2/7)`.

---

### Task 3: Channel lifecycle — `refresh()`, `leave()`, fixed `setGroupNameDescription`

**Files:**
- Modify: `frontend/webapp/src/models/MessengerController.js`

Closes: crash #1 (`channel.refresh is not a function` — fired by every admin action, every socket membership event via `Utils.refreshChannel`, and StudyGroupBar group activation), crash #2 (`channel.leave`), crash #5 (`setGroupNameDescription` returns a raw GQL object so `.updateChannel()` doesn't exist on it).

- [ ] **Step 1:** Add to the controller a cache-bypassing fetch:

```js
  async refetchChannel(channelUrl) {
    this.channels.delete(channelUrl);
    return this.sb.groupChannel.getChannel(channelUrl); // re-fetches and re-caches
  }
```

- [ ] **Step 2:** In `_normalizeChannel`, add to the channel object:

```js
      // SendBird-compat: re-fetch this channel from the API and return the
      // fresh channel object (admin actions and socket membership events
      // call this to pick up membership changes).
      refresh: () => this.refetchChannel(ch.channel_url),
      // SendBird-compat: current user leaves the channel.
      leave: async (callback) => {
        try {
          await this.removeMember(channel, this.userId);
          this.channels.delete(ch.channel_url);
          if (callback) callback(null, null);
        } catch (error) {
          if (callback) callback(null, error);
          throw error;
        }
      },
```

(`removeMember` exists; pass the channel object it expects — read its signature in the file and match. `channel` here is the object being built; if `removeMember(channel, userId)` expects `{url}`, the reference is already in scope.)

- [ ] **Step 3:** Fix `setGroupNameDescription` to return a normalized channel: after the `messengerUpdateChannel` mutation succeeds, `return this.refetchChannel(channelUrl)` instead of the raw GQL payload. Then in `StudyGroupAdmin.js:79` the subsequent `.updateChannel(params)` exists. ALSO inspect what `updateChannel(params)` does with `params.coverImage` (a File): if the backend mutation has no upload path, make `updateChannel` ignore `coverImage` with a `console.warn("cover image upload not yet supported")` rather than crashing — and note it in the report as a known limitation.
- [ ] **Step 4:** Verify: jest suite; manual on localhost:8200 — open a study group's admin panel, rename the group (saves without TypeError), remove+re-add a test member (no `refresh is not a function` in console), leave/rejoin a group via the group selector.
- [ ] **Step 5: Commit** — `fix(messenger): channel refresh/leave + normalized updateChannel return (parity 3/7)`.

---

### Task 4: Callback-signature compat on reactions and message fetch

**Files:**
- Modify: `frontend/webapp/src/models/MessengerController.js` (the channel methods `addReaction`, `deleteReaction`, `getMessagesByMessageId`)

Closes: crashes #6/#7 — Feed.js calls the SendBird v3 trailing-callback forms (`addReaction(msg, key, cb)`, `deleteReaction(msg, key, cb)`, `getMessagesByMessageId(id, params, cb)`); the shim only returns promises, so Home-Feed like/unlike never completes.

- [ ] **Step 1:** Wrap each of the three methods with dual-mode support. Pattern (apply to all three; keep each method's existing body as the promise path):

```js
      addReaction: (message, key, callback) => {
        const p = /* existing promise-returning body */;
        if (typeof callback === "function") {
          p.then((event) => callback(event, null)).catch((err) => callback(null, err));
        }
        return p;
      },
```

For `getMessagesByMessageId(messageId, params, callback)`: the callback receives `(messages, error)` — `callback(messages, null)` on success.

- [ ] **Step 2:** Verify: jest suite; manual — in the Home feed (logged in), like and unlike a feed item: the heart toggles and persists after reload.
- [ ] **Step 3: Commit** — `fix(messenger): SendBird v3 callback signatures for reactions/message fetch (parity 4/7)`.

---

### Task 5: Real query objects — previous-message list + channel list filters

**Files:**
- Modify: `frontend/webapp/src/models/MessengerController.js`

Closes: #22 (`createPreviousMessageListQuery` ignores `limit/reverse/customTypesFilter/includeThreadInfo/includeReactions` property assignments and the `load(callback)` form — Page.js loads the wrong message set; StudyGroupNotebook is dead), #19 (`createMyGroupChannelListQuery` ignores `customTypesFilter`/`nicknameContainsFilter` — DM widget wrong).

- [ ] **Step 1:** Replace the `createPreviousMessageListQuery` stub on the channel object with a stateful query object:

```js
      createPreviousMessageListQuery: () => {
        const self2 = this;
        const query = {
          limit: 20,
          reverse: false,
          customTypesFilter: null,
          includeThreadInfo: false,
          includeReactions: false,
          hasMore: true,
          load(callback) {
            const p = self2.loadGroupMessages(channel).then((messages) => {
              let out = messages;
              if (Array.isArray(query.customTypesFilter) && query.customTypesFilter.length) {
                out = out.filter((m) => query.customTypesFilter.includes(m.customType));
              }
              out = query.reverse ? [...out].reverse() : out;
              if (query.limit) out = out.slice(0, query.limit);
              query.hasMore = false; // one-shot: full history arrives in the first load
              return out;
            });
            if (typeof callback === "function") {
              p.then((msgs) => callback(msgs, null)).catch((err) => callback(null, err));
            }
            return p;
          },
        };
        return query;
      },
```

(`channel` is the object under construction — same closure the current stub uses. `includeThreadInfo`/`includeReactions` are satisfied because Task 2's selections always include them.)

- [ ] **Step 2:** Replace `createMyGroupChannelListQuery(params)` in the `sb` getter to honor the two consumed filters:

```js
        createMyGroupChannelListQuery: (params = {}) => ({
          hasNext: true,
          next: (callback) => {
            const p = this.getStudyGroups().then((channels) => {
              let out = channels;
              if (Array.isArray(params.customTypesFilter) && params.customTypesFilter.length) {
                out = out.filter((c) => params.customTypesFilter.includes(c.customType));
              }
              if (params.nicknameContainsFilter) {
                const needle = String(params.nicknameContainsFilter).toLowerCase();
                out = out.filter((c) =>
                  (c.members || []).some((m) =>
                    (m.nickname || "").toLowerCase().includes(needle)
                  )
                );
              }
              if (callback) return callback(out, null);
              return out;
            });
            p.catch((err) => { if (callback) callback(null, err); });
            return p;
          },
        }),
```

- [ ] **Step 3:** Verify: jest suite; manual — Page view comment counts load only page-type messages (`customTypesFilter` honored); DM panel lists only DM channels.
- [ ] **Step 4: Commit** — `fix(messenger): honor query-object filters and load(callback) (parity 5/7)`.

---

### Task 6: DM channel creation parity

**Files:**
- Modify: `frontend/webapp/src/models/MessengerController.js` (`sb.groupChannel.createChannel`)

Closes: #20 — DirectMessages.js passes `{isDistinct, invitedUserIds, customType: "DM", channelUrl}`; the shim forwards to `createNewGroup` which reads none of those (sends `customType: "undefined"`).

- [ ] **Step 0 (BACKEND, green-field):** the live mutation is FLAT — `messengerCreateChannel(name, customType, description, coverUrl, operatorIds)` — and exposes no `userIds`/`channelUrl`, so a DM's second member can't be seeded. Widen it additively: in `backend/schema/Messenger.graphql` (~line 13) add `userIds: [String!]` and `channelUrl: String` args; in `backend/src/graphql/resolvers/messenger.ts` (~lines 256-292) pass them through to the service `createChannel` (`channels.ts:277` already supports the full param set; keep the acting-user-forced-operator behavior). Restart `bom-greenfield` (authorized; note it). Verify with a curl that the new args validate.

- [ ] **Step 1:** Replace the `createChannel` mapping in the `sb` getter with a SendBird-param-aware implementation using the FLAT mutation and INLINE args (the client `gqlRequest` takes a query string only — mirror the `createNewGroup` escaping pattern):

```js
        createChannel: async (params = {}, callback) => {
          try {
            if (params.invitedUserIds || params.isDistinct || params.customType) {
              const userIds = [...new Set([...(params.invitedUserIds || []), this.userId])];
              if (params.isDistinct) {
                const channels = await this.getStudyGroups();
                const found = channels.find(
                  (c) =>
                    c.customType === (params.customType || "DM") &&
                    (c.members || []).length === userIds.length &&
                    userIds.every((id) => (c.members || []).some((m) => m.userId === id))
                );
                if (found) {
                  if (callback) callback(found, null);
                  return found;
                }
              }
              const esc = (v) => JSON.stringify(v ?? "");
              const mutation = `mutation {
                messengerCreateChannel(
                  name: ${esc(params.name || userIds.join("-"))},
                  customType: ${esc(params.customType || "DM")},
                  operatorIds: [${esc(this.userId)}],
                  userIds: ${JSON.stringify(userIds)}${params.channelUrl ? `,\n                  channelUrl: ${esc(params.channelUrl)}` : ""}
                ) { channel_url }
              }`;
              const result = await this.gqlRequest(mutation);
              const created = await this.sb.groupChannel.getChannel(
                result.messengerCreateChannel.channel_url
              );
              if (callback) callback(created, null);
              return created;
            }
            return this.createNewGroup(params, this.userId);
          } catch (error) {
            if (callback) callback(null, error);
            throw error;
          }
        },
```

- [ ] **Step 2:** Verify: jest suite; manual — open Direct Messages with another user (test account → any member): a DM channel is created with `customType: "DM"`, and opening it again reuses the same channel (distinct semantics).
- [ ] **Step 3: Commit** — `fix(messenger): SendBird-param DM channel creation with distinct reuse (parity 6/7)`.

---### Task 7: Mentions persistence + dead-surface pruning + regression guard

**Files:**
- Modify: `frontend/webapp/src/models/MessengerController.js` (`sendUserMessage` data merge; prune dead methods), `e2e/study-userlist.spec.js` (broaden the error guard)

Closes: #23 (mentions dropped), the dead-surface list, and locks the whole parity set behind an e2e guard.

- [ ] **Step 1: Mentions ride the data JSON.** In the channel's `sendUserMessage` implementation, before dispatching, merge mention params into the message `data` payload:

```js
        // Mentions: no dedicated column — persist them inside the data JSON
        // (shapeMessage surfaces them back as mentionedUsers).
        let outData = params.data;
        if (params.mentionedUserIds?.length) {
          let dataObj = {};
          try { dataObj = params.data ? JSON.parse(params.data) : {}; } catch (e) {}
          dataObj.mentionedUserIds = params.mentionedUserIds;
          dataObj.mentionType = params.mentionType || "users";
          outData = JSON.stringify(dataObj);
        }
```

…and use `outData` wherever the implementation currently forwards `params.data` (both the socket emit and any GraphQL fallback). Round-trip is already handled: `shapeMessage` (Task 1) parses `data` and resolves `mentionedUsers`.

**Step 1b (BACKEND, green-field — verified necessary):** the socket `send_message` handler whitelists payload fields and has no `data` passthrough, and `postMessage` neither persists nor reads back a raw `data` blob. Three coordinated edits in `backend/`:

1. `backend/src/realtime/handlers/message.ts` (~lines 37-44): add `data?: string` to `SendMessagePayload` and forward it into the `postMessage` call.
2. `backend/src/messaging/messages.ts`: add a `data?` param to `postMessage` (~line 243) and persist it (the `messenger_messages` table has a JSON `metadata` column — store the raw data string there, or merge with the `buildDataString` output so link/highlights and mentions coexist in one JSON object; read the existing `buildDataString` logic first and merge rather than overwrite).
3. `assembleMessages` (~line 183): read the persisted blob back into `MessageDTO.data` (merged with the link/highlights-derived data so existing consumers keep working).

Run the backend tests from `backend/` (`npm test` — check what suites exist first). Then `systemctl --user restart bom-greenfield` (authorized; note it in the report) and verify a mention round-trips: send a message with `mentionedUserIds` from client A, reload client B, the mention survives.

- [ ] **Step 2: Prune the dead compat surface** (sweep-verified zero consumers — re-grep each before deleting; if a grep finds a consumer, KEEP it and note): channel methods `inviteWithUserIds, declineInvitation, banUserWithUserId, muteUserWithUserId, unmuteUserWithUserId, addOperators, removeOperators, createOperatorListQuery, isGroupChannel, isOpenChannel, getCachedMetadata`.

```bash
for m in inviteWithUserIds declineInvitation banUserWithUserId muteUserWithUserId unmuteUserWithUserId addOperators removeOperators createOperatorListQuery isGroupChannel isOpenChannel getCachedMetadata; do
  echo "== $m =="; grep -rn "$m" frontend/webapp/src --include="*.js" | grep -v MessengerController.js;
done
```

- [ ] **Step 3: Broaden the e2e regression guard.** In `e2e/study-userlist.spec.js`, additionally collect EVERY `pageerror` whose message contains `is not a function` or `Cannot read properties of undefined` and assert that list is empty at the end (catches the whole crashes-now class, not just `createApplicationUserListQuery`). Keep the existing assertions. Known pre-existing exception: the `/user` Profile "Invalid language tag" crash — the spec never idles on `/user`, but if it appears, allowlist exactly that message with a comment referencing the open bug.
- [ ] **Step 4:** Full jest suite; e2e `study-userlist` green; manual: post a message with an @-mention in study chat → reload → mention still highlighted (formatText no longer crashes regardless).
- [ ] **Step 5: Commit** — `fix(messenger): persist mentions in data JSON; prune dead compat surface (parity 7/7)`.

---

## Execution notes

- Tasks 1→2 are ordered (shapes need fields); 3-7 are independent of each other but all build on 1+2. Execute sequentially anyway (single shared file).
- Several verifications need the staff login (TEST_USER/TEST_PASS from `$XDG_RUNTIME_DIR/bom-dev.env`) and a study group with members — same setup as `e2e/study-userlist.spec.js`.
- The cover-image upload (Task 3) and any backend mention-column migration are explicitly OUT of scope; both are noted as known limitations in commit messages.
- After Task 7, run a final whole-plan review (subagent) over the full range before reporting done.

---

# Realtime tasks — RE-GROUNDED against the green-field backend (supersedes the deleted Tasks 8-10)

> The original Tasks 8-10 were derived from the LEGACY socket (`src/socket.ts`) and are **deleted**: the green-field backend already emits the client's exact listener names from both socket and GraphQL-mutation paths (`membership_changed`/`user_joined`/`user_left`), already broadcasts `reaction_changed` as a channel-scoped full-`reactions[]` snapshot the client's `applyReactionEvent` array branch consumes correctly, and has no global-emit leak. Verified working. What follows are the REAL remaining gaps.

### Task P2b — Expose member fields the resolver already returns (backend, trivial)

**Files:** Modify `backend/schema/Messenger.graphql` (~lines 35-42)

Add to `type MessengerMember`: `metadata: JSON`, `is_online: Boolean`, `last_seen_at: Float`, `is_bot: Boolean`. No resolver change — `MemberDTO extends UserDTO` already populates all four (`backend/src/messaging/dto.ts:18`, `members.ts:62-90`). Then `systemctl --user restart bom-greenfield` (authorized; note it). Then in `frontend/webapp/src/models/MessengerController.js`, add `metadata is_online` to the two member selections Task 2 had to exclude (messengerMyChannels + messengerChannel). Verify: curl one query with the new fields (no validation errors, real values); jest 52/52; study-userlist e2e green; manual: study-bar presence dots/avatars now reflect real member state. Commit both repos' files together: `fix(messenger): expose member metadata/presence fields in green-field SDL (parity 2b)`.

### Task 11 (reduced) — Event-driven unread counts on inbound messages

**Files:** Modify `backend/src/realtime/handlers/message.ts` (~line 104), `frontend/webapp/src/models/MessengerController.js` (`_handleMessageReceived` ~line 210 + the `unread_count_changed` listener ~line 172)

Today `unread_count_changed` is emitted only by `mark_read` (unicast to the actor); recipients' badges rely on `_handleMessageReceived` firing `loadUnreadDMs()` per inbound message. Backend: after the `message_received` emit in the send_message handler, add `getBus().emit('unread_count_changed', payload.channelUrl, { channelUrl: payload.channelUrl })`. Client: delete the per-message `loadUnreadDMs().then(setUnreadDMs)` from `_handleMessageReceived`; in the existing `unread_count_changed` listener, refresh via `loadUnreadDMs()` debounced ~500ms (a burst coalesces to one fetch) and keep dispatching the `unreadMessageCountChanged` CustomEvent. Restart `bom-greenfield`. Verify: DM from client A → client B's badge updates; a 5-message burst produces ≤2 unread fetches (watch the network panel). Commit: `perf(messenger): event-driven unread counts; drop per-message poll (parity 11)`.

### Task 12 (rewritten) — Presence push end-to-end; retire the 60s roster poll

**Files:** Modify `backend/src/realtime/server.ts` (connect ~line 230, disconnect ~line 246), `frontend/webapp/src/models/MessengerController.js`, `frontend/webapp/src/views/_Common/Study/StudyGroupBar.js` (~lines 244-252) + `StudyHall.js` + `StudyGroupCall.js` (their polling intervals)

Green-field pushes NO presence event (connect/disconnect only update Redis state). Per the websockets directive:

1. **Backend:** in `server.ts`, after `setOnline` on connect and after `setOffline` on disconnect, broadcast to the user's rooms (`socket.data.channels`): `io.to(channelUrl).emit('user_presence', { channelUrl, userId, isOnline })` for each. Check `backend/.env` `REDIS_URL` is set (single-instance fallback otherwise — note in the report which mode is live). Restart `bom-greenfield` (batch with Task 11's restart if back-to-back).
2. **Client (MessengerController):** subscribe to `user_presence`; patch the cached channel's member `connectionStatus` in place; dispatch a `memberPresenceChanged` CustomEvent `{channelUrl, userId, isOnline}`.
3. **Study components:** replace the 60s `setInterval(getLiveFreshUsers)` with a `memberPresenceChanged` window listener that re-runs `getLiveFreshUsers` (keep the initial fetch; remove the intervals entirely; effect cleanup removes listeners).

Verify: jest green; study-userlist e2e green; two-client manual: B's dot flips when A disconnects/reconnects with no 60s wait; `grep -rn "setInterval" frontend/webapp/src/views/_Common/Study | grep -i fresh` returns nothing. Commit: `perf(study): socket-pushed presence replaces the 60s roster poll (parity 12)`.

### Backlog (recorded, out of scope)

- `messageReacters` index bug: `Study.js:1113-1127` indexes members by reaction-array position instead of matching ids. Pre-existing.
- `read_receipt`-style "seen" indicators (no event exists on green-field; product decision).
- `user_joined` payload field naming (`userId` vs client's destructured `user`) — cosmetic, client only uses `channelUrl`.
- Legacy backend (`src/socket.ts`, :5005) drift — its socket vocabulary differs from green-field; if the legacy backend is ever revived, reconcile or retire it.
