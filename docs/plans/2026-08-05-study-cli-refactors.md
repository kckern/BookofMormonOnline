# study.cli Deferred Refactors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the five deferred streamlining items from the study.cli grouchy review: one shared arg parser, GraphQL variables (kill string interpolation), `msgs` reply counts, name-based `--group` targeting, and `cleanup` that tears down scratch groups.

**Architecture:** `scripts/study.cli.mjs` + `scripts/study/*.mjs` is a plain-ESM Node tool (no manifest; `.mjs` ⇒ ESM). Tests use the built-in runner: `node --test scripts/study/`. Pure helpers get real unit tests; network-touching changes are verified by running `scripts/study/scenarios/demo.yaml` against the live dev backend at `http://localhost:5006` (POST to `/`, never `/graphql`).

**Tech Stack:** Node 24 (global `fetch`, `node:test`, `node:assert`), socket.io-client + js-yaml (via `createRequire(new URL("../../backend/", import.meta.url))`), graphql-yoga backend.

---

## File structure

- `scripts/study/argparse.mjs` — **new.** `tokenize(line)` + `parseVerbArgs(verb, tokens)`. The single arg grammar shared by the CLI and the REPL. Pure.
- `scripts/study/argparse.test.mjs` — **new.** Unit tests.
- `scripts/study.cli.mjs` — **modify.** Use `parseVerbArgs` for one-shot verbs (currently `parseArgv` gives no PRIMARY mapping).
- `scripts/study/repl.mjs` — **modify.** Delete its local `tokenize`/`parse`/`PRIMARY`/`LIST_FLAGS`; import from `argparse.mjs`.
- `scripts/study/gql.mjs` — **modify.** Accept `variables`; drop the `J`/`JA` string helpers once unused.
- `scripts/study/gql.test.mjs` — **new.** Assert the POST body carries `query`+`variables` and that errors throw.
- `scripts/study/session.mjs` — **modify.** Convert every HTTP method to `$`-typed operations with variables (removes all `J()`/`JA()`).
- `scripts/study/commands.mjs` — **modify.** `msgs` shows `(N replies)`; `dispatch` resolves a name-or-url `group`.
- `scripts/study/groups.mjs` — **new.** `looksLikeChannelUrl(s)` + `resolveGroupRef(input, channels)`. Pure.
- `scripts/study/groups.test.mjs` — **new.** Unit tests.
- `scripts/study/manager.mjs` — **modify.** Track created scratch channel_urls in the roster; `cleanup` removes sim members from them (no delete-channel mutation exists).

---

## Task 1: Shared arg parser (`argparse.mjs`)

**Files:**
- Create: `scripts/study/argparse.mjs`
- Create: `scripts/study/argparse.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/study/argparse.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, parseVerbArgs } from "./argparse.mjs";

test("tokenize respects quotes", () => {
  assert.deepEqual(tokenize(`post --group X "hello world"`), ["post", "--group", "X", "hello world"]);
});

test("parseVerbArgs maps a bare trailing string to the verb's primary field", () => {
  assert.deepEqual(parseVerbArgs("post", ["hello", "world"]), { text: "hello world" });
  assert.deepEqual(parseVerbArgs("group.create", ["My", "Group"]), { name: "My Group" });
});

test("parseVerbArgs parses --flags and splits list flags", () => {
  assert.deepEqual(parseVerbArgs("invite", ["--users", "a,b,c"]), { users: ["a", "b", "c"] });
  assert.deepEqual(parseVerbArgs("post", ["--group", "X", "hi"]), { group: "X", text: "hi" });
});

test("a bare --flag with no value is boolean true", () => {
  assert.deepEqual(parseVerbArgs("typing", ["--on"]), { on: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/study/argparse.test.mjs`
Expected: FAIL — cannot find module `./argparse.mjs`.

- [ ] **Step 3: Implement `argparse.mjs`**

```javascript
// scripts/study/argparse.mjs
// The one arg grammar shared by the one-shot CLI and the REPL.
//   parseVerbArgs(verb, tokens) -> params object.
// - `--key value` becomes { key: value }; `--key` alone becomes { key: true }.
// - LIST_FLAGS values are comma-split into arrays.
// - a bare (non-flag) trailing string maps to the verb's PRIMARY field.

const PRIMARY = { post: "text", reply: "text", edit: "text", "group.create": "name", group: "name", join: "url", request: "url" };
const LIST_FLAGS = new Set(["invite", "users"]);

export function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function parseVerbArgs(verb, tokens) {
  const p = {};
  const bare = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const hasVal = tokens[i + 1] !== undefined && !tokens[i + 1].startsWith("--");
      const val = hasVal ? tokens[++i] : "true";
      p[key] = LIST_FLAGS.has(key)
        ? val.split(",").map((x) => x.trim()).filter(Boolean)
        : val === "true" ? true : val;
    } else bare.push(t);
  }
  if (bare.length && PRIMARY[verb]) p[PRIMARY[verb]] = bare.join(" ");
  return p;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/study/argparse.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/study/argparse.mjs scripts/study/argparse.test.mjs
git commit -m "feat(study-cli): shared arg parser module"
```

---

## Task 2: Use the shared parser in the REPL and CLI

**Files:**
- Modify: `scripts/study/repl.mjs` (remove local `tokenize`/`parse`/`PRIMARY`/`LIST_FLAGS`)
- Modify: `scripts/study.cli.mjs` (one-shot verbs use `parseVerbArgs`)

- [ ] **Step 1: Update the REPL imports + delete its local parser**

In `scripts/study/repl.mjs`, replace the top imports and the local `PRIMARY`/`LIST_FLAGS`/`tokenize`/`parse` (lines ~1-35) with:

```javascript
import readline from "readline";
import { SessionManager } from "./manager.mjs";
import { VERBS, dispatch } from "./commands.mjs";
import { tokenize, parseVerbArgs } from "./argparse.mjs";
```

Then, in the `handleLine` body, change the dispatch call from `parse(verb, tokens)` to `parseVerbArgs(verb, tokens)`. (The `tokenize(line.trim())` call stays — it now comes from the import.)

- [ ] **Step 2: Update the one-shot CLI to use the same parser**

In `scripts/study.cli.mjs`: add `import { tokenize, parseVerbArgs } from "./study/argparse.mjs";` to the imports. In the one-shot branch (currently `await dispatch(ctx, cmd, flags, session);`), replace `flags` with parsed verb args so a bare primary works (`post --as alice "hi"`):

```javascript
    // Re-parse the raw argv tail as verb args so `post --as alice "hi"` works
    // (the leading `--as <handle>` is consumed as a normal flag and ignored by verbs).
    const verbArgs = parseVerbArgs(cmd, process.argv.slice(3));
    await dispatch(ctx, cmd, verbArgs, session);
```

Keep the existing `--as` extraction (it reads `flags.as` from `parseArgv` earlier); `parseVerbArgs` will also capture `as` harmlessly. Leave `parseArgv` in place for the top-level `url`/`as`/`watch` flags.

- [ ] **Step 3: Verify REPL + one-shot still work**

Run:
```bash
printf "use alice\nmychannels\nexit\n" | node scripts/study.cli.mjs repl
node scripts/study.cli.mjs post --as alice --group NO_SUCH --text "parser smoke" ; echo "exit=$?"
```
Expected: REPL prints the active user + channels then `bye.`; the post attempt reaches the backend and fails with a GraphQL/socket error (non-zero exit) — proving args parsed and dispatched (a bad channel, not a parse error).

- [ ] **Step 4: Commit**

```bash
git add scripts/study/repl.mjs scripts/study.cli.mjs
git commit -m "refactor(study-cli): REPL + CLI share one arg parser"
```

---

## Task 3: GraphQL variables in `gql.mjs`

**Files:**
- Modify: `scripts/study/gql.mjs`
- Create: `scripts/study/gql.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/study/gql.test.mjs
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { gql } from "./gql.mjs";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("gql posts query + variables to the root mount and returns data", async () => {
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body), auth: opts.headers["authorization"] };
    return { json: async () => ({ data: { ok: 1 } }) };
  };
  const data = await gql("http://x", "query($a:Int){f(a:$a)}", { variables: { a: 3 }, token: "T" });
  assert.equal(seen.url, "http://x/");                 // root mount, not /graphql
  assert.deepEqual(seen.body, { query: "query($a:Int){f(a:$a)}", variables: { a: 3 } });
  assert.equal(seen.auth, "Bearer T");
  assert.deepEqual(data, { ok: 1 });
});

test("gql throws on GraphQL errors", async () => {
  globalThis.fetch = async () => ({ json: async () => ({ errors: [{ message: "boom" }] }) });
  await assert.rejects(() => gql("http://x", "{f}"), /GraphQL: boom/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/study/gql.test.mjs`
Expected: FAIL — `gql` doesn't send `variables` (body lacks the key).

- [ ] **Step 3: Update `gql.mjs`**

Replace the whole file with:

```javascript
// scripts/study/gql.mjs
// GraphQL-over-HTTP helper for the study CLI.
//
// IMPORTANT: POST to the ROOT mount ("/"), never "/graphql". The backend's
// resolveLang() derives the request language from the LAST url path segment, so
// "/graphql" yields ctx.lang="graphql" (7 chars) which overflows
// bom_user.lang varchar(3) on any write. "/" → the empty trailing segment → "en".

const endpoint = (base) => base.replace(/\/+$/, "") + "/";

export async function gql(base, query, { variables, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  const body = { query };
  if (variables) body.variables = variables;

  let res, json;
  try {
    res = await fetch(endpoint(base), { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error(`HTTP request failed (${base}): ${e.message}`);
  }
  try {
    json = await res.json();
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}) from ${base}`);
  }
  if (json.errors && json.errors.length) {
    const err = new Error("GraphQL: " + json.errors.map((e) => e.message).join(" | "));
    err.graphql = json.errors;
    throw err;
  }
  return json.data;
}
```

(The `J`/`JA` exports are intentionally removed — Task 4 drops their last callers.)

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/study/gql.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/study/gql.mjs scripts/study/gql.test.mjs
git commit -m "feat(study-cli): gql() supports GraphQL variables"
```

---

## Task 4: Convert `session.mjs` HTTP methods to variables

Removes all `J()`/`JA()` interpolation (the injection smell). Each method builds a typed operation + a `variables` object.

**Files:**
- Modify: `scripts/study/session.mjs`

- [ ] **Step 1: Update the import**

In `scripts/study/session.mjs`, change `import { gql, J, JA } from "./gql.mjs";` to `import { gql } from "./gql.mjs";`. Update the internal `gql(query)` wrapper to pass variables:

```javascript
  // HTTP as this user (bearer + optional variables).
  gql(query, variables) { return gql(this.base, query, { variables, token: this.token }); }
```

- [ ] **Step 2: Replace the "HTTP surface: Messenger" and "Community / Feed" method blocks**

Replace every method from `createChannel` through `botlist` (the two `---- HTTP surface ----` blocks) with these variable-based versions (identical return values, no `J`/`JA`):

```javascript
  // ---- HTTP surface: Messenger ----
  async createChannel({ name, customType = "group", description = "", userIds = [], operatorIds = [] }) {
    const q = `mutation($n:String,$ct:String,$d:String,$u:[String!],$o:[String]){ messengerCreateChannel(name:$n, customType:$ct, description:$d, userIds:$u, operatorIds:$o){ channel_url name custom_type } }`;
    return (await this.gql(q, { n: name, ct: customType, d: description, u: userIds, o: operatorIds })).messengerCreateChannel;
  }
  async getMessages(channelUrl, limit = 30) {
    const q = `query($c:String,$l:Int){ messengerMessages(channelUrl:$c, limit:$l){ message_id message user{ user_id nickname is_bot } parent_message_id thread_info{ reply_count } created_at } }`;
    return (await this.gql(q, { c: channelUrl, l: limit })).messengerMessages || [];
  }
  async getThread(parentMessageId) {
    const q = `query($p:String){ messengerThreadMessages(parentMessageId:$p){ message_id message user{ nickname } created_at } }`;
    return (await this.gql(q, { p: parentMessageId })).messengerThreadMessages || [];
  }
  async getChannel(channelUrl) {
    const q = `query($c:String){ messengerChannel(channelUrl:$c){ channel_url name custom_type member_count members{ user_id nickname is_bot } } }`;
    return (await this.gql(q, { c: channelUrl })).messengerChannel;
  }
  async myChannels() {
    const q = `query($u:String){ messengerMyChannels(userId:$u){ channel_url name custom_type member_count } }`;
    return (await this.gql(q, { u: this.userId })).messengerMyChannels || [];
  }
  async invite(channelUrl, userIds) {
    const q = `mutation($c:String,$u:[String]){ messengerInviteMembers(channelUrl:$c, userIds:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: userIds })).messengerInviteMembers;
  }
  async acceptInvite(channelUrl) {
    const q = `mutation($c:String,$u:String){ messengerAcceptInvitation(channelUrl:$c, userId:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: this.userId })).messengerAcceptInvitation;
  }
  async setRole(channelUrl, userId, role) {
    const q = `mutation($c:String,$u:String,$r:String){ messengerUpdateMemberRole(channelUrl:$c, userId:$u, role:$r) }`;
    return (await this.gql(q, { c: channelUrl, u: userId, r: role })).messengerUpdateMemberRole;
  }
  async ban(channelUrl, userId) {
    const q = `mutation($c:String,$u:String){ messengerBanMember(channelUrl:$c, userId:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: userId })).messengerBanMember;
  }
  async removeMember(channelUrl, userId) {
    const q = `mutation($c:String,$u:String){ messengerRemoveMember(channelUrl:$c, userId:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: userId })).messengerRemoveMember;
  }

  // ---- HTTP surface: Community / Feed (token ARG) ----
  async joinOpenGroup(url) {
    const q = `mutation($t:String,$u:String){ joinOpenGroup(token:$t, url:$u){ isSuccess msg channel } }`;
    return (await this.gql(q, { t: this.token, u: url })).joinOpenGroup;
  }
  async requestToJoin(url) {
    const q = `mutation($t:String,$u:String){ requestToJoinGroup(token:$t, url:$u){ isSuccess msg channel } }`;
    return (await this.gql(q, { t: this.token, u: url })).requestToJoinGroup;
  }
  async homegroups(grouping = "") {
    const q = `query($t:String,$g:String){ homegroups(token:$t, grouping:$g){ url name privacy members{ user_id nickname } } }`;
    return (await this.gql(q, { t: this.token, g: grouping })).homegroups || [];
  }
  async homefeed() {
    const q = `query($t:String){ homefeed(token:$t){ feed{ id msg user{ nickname } channel_url replycount } } }`;
    return (await this.gql(q, { t: this.token })).homefeed;
  }
  async leaderboard() {
    const q = `query($t:String){ leaderboard(token:$t){ currentProgress{ nickname progress } recentFinishers{ nickname } } }`;
    return (await this.gql(q, { t: this.token })).leaderboard;
  }
  async botlist(channelUrl) {
    const q = `query($c:String){ botlist(channel:$c){ id name enabled } }`;
    return (await this.gql(q, { c: channelUrl })).botlist || [];
  }
```

(`removeMember` is new — Task 7 uses it. `signout` in the teardown section stays; convert it too:)

```javascript
  async signout() {
    const q = `mutation($t:String){ signout(token:$t) }`;
    try { return (await this.gql(q, { t: this.token })).signout; } catch { return false; }
  }
```

- [ ] **Step 3: Update manager.mjs's remaining `J()` calls**

`manager.mjs` still imports `J` and builds `tokensignin`/`signin`/`signup`/`signout` strings with it. Change its import to `import { gql } from "./gql.mjs";` and convert those four calls to variables. Example (do the same shape for all four):

```javascript
// _tokenValid:
const q = `query($t:String){ tokensignin(token:$t){ isSuccess } }`;
return !!(await gql(this.base, q, { variables: { t: token } })).tokensignin?.isSuccess;
// provision fresh-path tokensignin:
await gql(this.base, `query($t:String){ tokensignin(token:$t){ isSuccess } }`, { variables: { t: token } });
// _register signup:
const signup = `mutation($t:String,$u:String,$n:String){ signup(token:$t, username:$u, password:"simpass", name:$n, email:"", zip:""){ isSuccess msg } }`;
res = (await gql(this.base, signup, { variables: { t: token, u: username, n: name } })).signup;
// _register signin (a Query):
const signin = `query($t:String,$u:String){ signin(token:$t, username:$u, password:"simpass"){ isSuccess msg } }`;
si = (await gql(this.base, signin, { variables: { t: token, u: username } })).signin;
// cleanup signout:
await gql(this.base, `mutation($t:String){ signout(token:$t) }`, { variables: { t } });
```

Also `scenario.mjs`'s preflight `gql(base, "{ __typename }")` needs no change.

- [ ] **Step 4: Smoke-test end to end (network)**

Run: `node scripts/study.cli.mjs run scripts/study/scenarios/demo.yaml`
Expected: `✔ scenario complete (8 steps)` with a real group url + message ids, no `✗` lines. Then confirm no stray interpolation helpers remain:
Run: `grep -rn "J(\|JA(" scripts/study/session.mjs scripts/study/manager.mjs` → **no output**.

- [ ] **Step 5: Commit**

```bash
git add scripts/study/session.mjs scripts/study/manager.mjs
git commit -m "refactor(study-cli): GraphQL variables instead of string interpolation"
```

---

## Task 5: `msgs` shows reply counts

**Files:**
- Modify: `scripts/study/commands.mjs`

- [ ] **Step 1: Update the `msgs` verb to print reply counts**

`getMessages` now returns `thread_info{ reply_count }` (Task 4). In `commands.mjs`, change the `msgs` verb's per-message log line to append the count when > 0:

```javascript
  msgs: {
    help: "list recent messages — {group?, limit?}",
    run: async (s, p, ctx) => {
      const msgs = await s.getMessages(p.group || ctx.vars.group, p.limit || 20);
      for (const m of msgs) {
        const replies = m.thread_info && m.thread_info.reply_count ? ` (${m.thread_info.reply_count} replies)` : "";
        ctx.log(`  [${m.message_id}] ${m.user?.nickname || m.user?.user_id}${m.user?.is_bot ? "🤖" : ""}: ${(m.message || "").slice(0, 100)}${replies}`);
      }
      return msgs;
    },
  },
```

- [ ] **Step 2: Verify against live data**

Run:
```bash
node scripts/study.cli.mjs run scripts/study/scenarios/demo.yaml   # creates a group, posts an opener + a threaded reply
```
Then in the demo output's final `msgs` step, the opener line should end with ` (1 replies)`. If the demo's `msgs limit` shows only the opener, that's expected (top-level only) — the point is the ` (N replies)` suffix now appears.

- [ ] **Step 3: Commit**

```bash
git add scripts/study/commands.mjs
git commit -m "feat(study-cli): msgs shows thread reply counts"
```

---

## Task 6: Name-based `--group` targeting

**Files:**
- Create: `scripts/study/groups.mjs`
- Create: `scripts/study/groups.test.mjs`
- Modify: `scripts/study/commands.mjs` (resolve group in `dispatch`)

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/study/groups.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeChannelUrl, resolveGroupRef } from "./groups.mjs";

const channels = [
  { channel_url: "aB3xYz90LmN", name: "Alma 32 study" },
  { channel_url: "Qk7rPd21Vwc", name: "Helaman reading" },
];

test("looksLikeChannelUrl recognises the opaque url shape, not names", () => {
  assert.equal(looksLikeChannelUrl("aB3xYz90LmN"), true);
  assert.equal(looksLikeChannelUrl("Alma 32 study"), false); // has a space
  assert.equal(looksLikeChannelUrl("alma"), false);          // too short / lowercase word
});

test("resolveGroupRef passes urls through unchanged", () => {
  assert.equal(resolveGroupRef("aB3xYz90LmN", channels), "aB3xYz90LmN");
});

test("resolveGroupRef matches a name case-insensitively by prefix", () => {
  assert.equal(resolveGroupRef("alma", channels), "aB3xYz90LmN");
  assert.equal(resolveGroupRef("Helaman reading", channels), "Qk7rPd21Vwc");
});

test("resolveGroupRef throws on no match and on ambiguous match", () => {
  assert.throws(() => resolveGroupRef("nope", channels), /no group/i);
  assert.throws(() => resolveGroupRef("a", [{ channel_url: "x", name: "Alma" }, { channel_url: "y", name: "Abish" }]), /ambiguous/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/study/groups.test.mjs`
Expected: FAIL — cannot find module `./groups.mjs`.

- [ ] **Step 3: Implement `groups.mjs`**

```javascript
// scripts/study/groups.mjs
// Resolve a `--group` value that may be a channel_url OR a (partial) group name.
// Channel urls here are 11-char base64-ish tokens with no spaces; names have
// spaces or don't match that shape.

export function looksLikeChannelUrl(s) {
  return typeof s === "string" && /^[A-Za-z0-9_-]{9,}$/.test(s) && /[A-Z0-9]/.test(s) && !/\s/.test(s);
}

// channels: [{ channel_url, name }]. Returns a channel_url or throws.
export function resolveGroupRef(input, channels) {
  if (looksLikeChannelUrl(input)) return input;
  const needle = String(input).toLowerCase();
  const hits = (channels || []).filter((c) => (c.name || "").toLowerCase().startsWith(needle));
  if (hits.length === 0) throw new Error(`no group matches name "${input}" (run 'mychannels' to list)`);
  if (hits.length > 1) throw new Error(`ambiguous group "${input}" — matches: ${hits.map((c) => c.name).join(", ")}`);
  return hits[0].channel_url;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/study/groups.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire resolution into `dispatch`**

In `scripts/study/commands.mjs`, import the helpers and resolve a name→url before running any verb whose params carry a `group`. Add to the top imports:

```javascript
import { looksLikeChannelUrl, resolveGroupRef } from "./groups.mjs";
```

Then in `dispatch`, after `resolveRefs` and before running the verb, resolve `params.group` when it's a name:

```javascript
export async function dispatch(ctx, verb, params, session) {
  const v = VERBS[verb] || (verb === "group" ? VERBS["group.create"] : null);
  if (!v) throw new Error(`unknown verb '${verb}'. Try: ${Object.keys(VERBS).join(", ")}`);
  const p = resolveRefs(params, ctx.vars);
  if (p.group && !looksLikeChannelUrl(p.group)) {
    p.group = resolveGroupRef(p.group, await session.myChannels());
  }
  return v.run(session, p, ctx);
}
```

(This replaces the old `VERBS[verb.replace(/^group$/, ...)]` alias line and the double `resolveRefs` — `run` now receives the already-resolved `p`. Update `VERBS[...].run` calls in `dispatch` to use `p`, and delete the `resolveRefs` call that previously happened inside dispatch's return.)

- [ ] **Step 6: Verify**

Run: `node --test scripts/study/groups.test.mjs && printf "use alice\nmychannels\nexit\n" | node scripts/study.cli.mjs repl`
Expected: unit tests pass; REPL still lists channels (no dispatch regressions).

- [ ] **Step 7: Commit**

```bash
git add scripts/study/groups.mjs scripts/study/groups.test.mjs scripts/study/commands.mjs
git commit -m "feat(study-cli): resolve --group by name, one alias path in dispatch"
```

---

## Task 7: `cleanup` tears down scratch groups

No delete-channel mutation exists, so "teardown" = record created channel_urls and remove the sim members from them on cleanup (leaving an empty, member-less channel row). Honest and best-effort.

**Files:**
- Modify: `scripts/study/manager.mjs`
- Modify: `scripts/study/commands.mjs` (record created channels)

- [ ] **Step 1: Record created channels in the manager**

In `scripts/study/manager.mjs`, add a `createdChannels` set persisted alongside the roster. In the constructor after `this.roster = this._loadRoster();`:

```javascript
    this.createdChannels = this._loadCreated(); // string[] of channel_urls this tool created
```

Add loader/saver + a record method:

```javascript
  _loadCreated() {
    try { return JSON.parse(fs.readFileSync(path.join(ROSTER_DIR, "created.json"), "utf8")); }
    catch { return []; }
  }
  _saveCreated() {
    fs.mkdirSync(ROSTER_DIR, { recursive: true });
    fs.writeFileSync(path.join(ROSTER_DIR, "created.json"), JSON.stringify(this.createdChannels, null, 2));
  }
  recordChannel(channelUrl) {
    if (channelUrl && !this.createdChannels.includes(channelUrl)) { this.createdChannels.push(channelUrl); this._saveCreated(); }
  }
```

- [ ] **Step 2: Record the channel_url when `group.create` runs**

In `scripts/study/commands.mjs`, in the `group.create` verb's `run`, after `const ch = await s.createChannel(...)` add:

```javascript
      ctx.manager.recordChannel(ch.channel_url);
```

- [ ] **Step 3: Extend `cleanup` to empty the scratch groups**

In `manager.mjs`, replace the `cleanup()` body with one that, for each recorded channel, removes every sim user (by userId) as a member — using an operator session — then signs out tokens:

```javascript
  async cleanup() {
    // Best-effort: no delete-channel mutation exists, so empty the scratch
    // groups by removing every sim member, then revoke tokens.
    const simUserIds = Object.values(this.roster).map((r) => require("crypto").createHash("md5").update(r.username).digest("hex"));
    for (const channelUrl of this.createdChannels) {
      // Any provisioned session can attempt the removals; operators succeed.
      for (const [name] of Object.entries(this.roster)) {
        let s;
        try { s = await this.provision(name); } catch { continue; }
        for (const uid of simUserIds) { try { await s.removeMember(channelUrl, uid); } catch { /* not operator / already gone */ } }
        break; // one session's attempt is enough
      }
    }
    const removed = [];
    for (const [, { username, token }] of Object.entries(this.roster)) {
      try { await gql(this.base, `mutation($t:String){ signout(token:$t) }`, { variables: { t: token } }); removed.push(username); } catch { /* ignore */ }
    }
    try { fs.rmSync(ROSTER_FILE, { force: true }); } catch { /* ignore */ }
    try { fs.rmSync(path.join(ROSTER_DIR, "created.json"), { force: true }); } catch { /* ignore */ }
    const emptied = this.createdChannels.length;
    this.roster = {}; this.createdChannels = []; this.disconnectAll(); this.sessions.clear();
    return { removed, emptied };
  }
```

Add `import crypto from "crypto";` at the top and use `crypto.createHash` instead of the inline `require` (cleaner):

```javascript
const md5 = (s) => crypto.createHash("md5").update(String(s)).digest("hex");
// ...simUserIds: Object.values(this.roster).map((r) => md5(r.username));
```

- [ ] **Step 4: Update the CLI `cleanup` output for the new return shape**

In `scripts/study.cli.mjs`, the `cleanup` branch currently does `console.log(\`revoked ${removed.length}...\`)`. Change to:

```javascript
  if (cmd === "cleanup") { const { removed, emptied } = await manager.cleanup(); console.log(`revoked ${removed.length} sim token(s); emptied ${emptied} scratch group(s): ${removed.join(", ")}`); return; }
```

- [ ] **Step 5: Verify end-to-end**

Run:
```bash
node scripts/study.cli.mjs run scripts/study/scenarios/demo.yaml   # creates + records a scratch group
cat .study-cli/created.json                                        # should list the new channel_url
node scripts/study.cli.mjs cleanup                                 # revokes tokens + empties recorded groups
```
Expected: `created.json` lists the demo group; cleanup prints `revoked N sim token(s); emptied M scratch group(s)`. Then a fresh `run` re-provisions cleanly.

- [ ] **Step 6: Commit**

```bash
git add scripts/study/manager.mjs scripts/study/commands.mjs scripts/study.cli.mjs
git commit -m "feat(study-cli): cleanup records + empties scratch groups"
```

---

## Task 8: Full regression + doc note

**Files:**
- Modify: `docs/specs/2026-08-04-study-cli-design.md` (note the refactors)

- [ ] **Step 1: Run all unit tests + both scenarios**

Run:
```bash
node --test scripts/study/
node scripts/study.cli.mjs run scripts/study/scenarios/demo.yaml
node scripts/study.cli.mjs help
```
Expected: all `node --test` suites pass; demo completes clean; help lists per-verb descriptions.

- [ ] **Step 2: Add a short "Refactors (2026-08-05)" note to the spec**

Append to `docs/specs/2026-08-04-study-cli-design.md`: one paragraph listing the shared arg parser, GraphQL variables, `msgs` reply counts, name-based `--group`, and scratch-group cleanup, with the `node --test scripts/study/` command as the tool's test entry point.

- [ ] **Step 3: Commit**

```bash
git add docs/specs/2026-08-04-study-cli-design.md
git commit -m "docs(study-cli): record deferred-refactor pass"
```

---

## Self-review notes

- **Coverage:** the five deferred items map to Tasks 1-2 (arg parser), 3-4 (GraphQL variables), 5 (msgs replies), 6 (name targeting), 7 (cleanup). Task 8 is regression + docs.
- **Type consistency:** `parseVerbArgs(verb, tokens)` (Task 1) is the name used in Tasks 2 & wherever the CLI/REPL call it; `resolveGroupRef`/`looksLikeChannelUrl` (Task 6) names match their call sites; `session.removeMember` (Task 4) is consumed by `cleanup` (Task 7); `recordChannel`/`createdChannels`/`_saveCreated` are consistent across Task 7. `cleanup()` returns `{removed, emptied}` (Task 7) and the CLI reads exactly those keys (Task 7 Step 4).
- **No-delete caveat:** Task 7 is explicit that no delete-channel mutation exists; "emptied" = members removed, channel row orphaned. Not a placeholder — the real ceiling of the API.
- **Test runner:** `node --test scripts/study/` picks up `*.test.mjs`; pure helpers are unit-tested, network paths are scenario-verified against live dev (the tool has no mock backend, by design).
