# Spec: `scripts/study.cli.mjs` — multi-user study/community simulator

**Date:** 2026-08-04
**Status:** Approved design (build in progress)

## Goal

A multi-user CLI harness that drives the **full** community surface — Messenger + Community/BomCommunity + Feed, over **HTTP (GraphQL)** and **WebSocket (socket.io)** — to ad-hoc test and simulate conversations (create groups, join, post/edit/delete messages, threads, reactions, typing, DMs, invites/bans/roles, homefeed/leaderboard).

## Validated facts (live dev backend)

- **Endpoint:** GraphQL over HTTP at `http://localhost:5006/` (the root mount). **Do NOT use `/graphql`** — `resolveLang` takes the last URL path segment as the language, so `/graphql` sets `ctx.lang="graphql"` and overflows `bom_user.lang varchar(3)` on writes. `/` → path segment `""` → `en`.
- **Socket:** `io('http://localhost:5006', { path: '/messenger', auth: { userId, token }, transports: ['websocket'] })`. Handshake verifies a `bom_user_token (user, token)` row (or `MESSENGER_BOT_TOKEN` for bots).
- **Auth per user:** client generates a token (≤32 chars, `bom_user_token.token` is `varchar(32)`), calls `signup(token, username, password, name, email, zip)`; the server creates `bom_user` + upserts `bom_user_token`. `user_id = md5(username)`. HTTP: `Authorization: Bearer <token>` (Messenger resolvers) **and** `token:"<token>"` arg (Community/Feed resolvers) — the CLI supplies both. Verified round-trip: signup → `tokensignin` success → `messengerUser` returns the user.
- **Writes are enabled** on dev (signup persists). Sim users must be namespaced `sim_*` and cleaned up.

## Surface

- **GraphQL (HTTP):** Messenger queries/mutations (`messengerCreateChannel`, `messengerMessages`, `messengerThreadMessages`, `messengerInviteMembers`, `messengerBanMember`, `messengerUpdateMemberRole`, `messengerUnreadDMs`, …); Community (`joinOpenGroup`, `requestToJoinGroup`, `processRequest`, `homegroups`, `homefeed`, `homethread`, `postcomments`, `leaderboard`, `botlist`, `addBot`/`removeBot`).
- **Socket (client→server):** `send_message {channelUrl, message, link?, highlights?, customType?, parentMessageId?}`, `edit_message`, `delete_message`, `add_reaction`/`remove_reaction {channelUrl, messageId, reaction}`, `typing_start`/`typing_stop`, `mark_read`.
- **Socket (server→client, logged per user):** `message_received`, `message_updated`, `message_deleted`, `reaction_changed`, `user_presence`, `typing`, `unread_count_changed`.

## Architecture

```
scripts/study/
  gql.mjs        GraphQL POST helper (bearer + token-arg) against the root mount
  session.mjs    UserSession: one user's {username, userId, token} + gql + socket;
                 exposes surface methods; buffers inbound socket events (ring log)
  manager.mjs    SessionManager: roster; provision(username) via signup (idempotent,
                 reuses persisted token); connect/disconnect all; roster persisted to
                 a gitignored dotfile (.study-cli/roster.json)
  commands.mjs   verb table shared by subcommands + REPL (group.create, post, reply,
                 react, join, watch, feed, thread, invite, ban, role, dm, users, ...)
  repl.mjs       interactive shell: `use <user>`, run verbs, live event stream
  scenario.mjs   YAML/JSON playback: users + ordered steps with $last/$vars + delays
  scenarios/reformers.yaml   joins the real "Reformers Discuss the Book of Mormon"
                 group (36eddcfa954553c01a2b8bacb6ff86f4) and posts a verse
scripts/study.cli.mjs   entry: arg parse → subcommand | `repl` | `run <file>`
```

`UserSession` is the one unit everything shares. `SessionManager.provision` is idempotent: a persisted roster token is reused (re-`signup` is harmless — upsert), so re-runs don't spawn duplicate users.

## Interaction model (all three, one core)

1. **Subcommands:** `node scripts/study.cli.mjs <verb> --as <user> [args]` — e.g. `post --as luther --group <url> "text"`.
2. **REPL:** `node scripts/study.cli.mjs repl` → `use luther`, then verbs; `watch` streams live socket events; `who`/`use` switch active user.
3. **Scenario:** `node scripts/study.cli.mjs run scripts/study/scenarios/reformers.yaml` — plays steps through all sessions' HTTP+WS.

## Config

`--url` (default `http://localhost:5006`), `--as` active user, env `STUDY_CLI_URL`. Tokens/roster never committed (`.study-cli/` gitignored).

## Error handling

Each op prints the GraphQL `errors[]` or socket error verbatim. Provisioning surfaces `ER_DATA_TOO_LONG`/sandbox failures with a clear "backend must allow writes and be hit at `/` not `/graphql`" hint.

## Testing

- Unit: `gql.mjs` query building + `session.mjs` event-buffer logic against a mock transport (no network).
- Integration smoke: `run` a tiny scenario that provisions two sim users, one creates a group, invites the other, both post over WS, assert each sees the other's `message_received`.

## Non-goals

- No production/prod-backend targeting (dev only by default).
- No Sendbird direct integration (goes through the backend's socket/GraphQL).
- Not a load-test tool (correctness/simulation, not throughput).

## Findings from live testing (Reformers group)

Validated against the real "Reformers Discuss the Book of Mormon" group (`36eddcfa…`):
- **Bots answer CLI posts.** Posting a question triggers the async `botResponder`
  (fired by the `send_message` handler); a reformer replies with a real,
  contextual LLM answer within ~1–2s. `:5006` has working AI (key from Infisical,
  not in the tmpfs env dump).
- **One bot per human message.** The botResponder's per-channel in-flight lock
  means a single reformer answers each post (anti-spam), not all 10 members.
- **Live socket reception needs membership.** The group is *not* open-enrollment,
  so `joinOpenGroup` fails and the sim users aren't in the channel's socket room
  → they receive no `message_received` broadcast (`--watch` stays quiet) even
  though their posts land. `requestToJoinGroup` is the correct verb (adds a
  pending/member row). For groups where the sim user IS a member (anything the
  CLI creates, per `demo.yaml`), live broadcasts arrive on every member's socket
  as expected. Hence `reformers.yaml` **polls** the reply over HTTP rather than
  watching the socket.
- **`botlist` returns the pluggable study bots** (StudyBuddy/Help Desk/Linguist),
  not the historical-figure members; the reformers are `is_bot` channel members.
- A **second stubbed backend** (`PORT=5007 STUB_LLM_REPLY=… npx tsx src/index.ts`,
  same DB) is a clean way to exercise the bot loop deterministically without LLM
  cost. NB: `pkill -f "tsx src/index.ts"` also matches the shared dev backend —
  kill by PID.

## Cleanup

A `cleanup` verb deletes `sim_*` users' `bom_user_token` rows (and optionally the scratch groups they created). Sim accounts are clearly namespaced so they're identifiable in `bom_user`.

## Refactors (2026-08-05)

Deferred grouchy-review items, done via subagent-driven TDD (plan:
`docs/plans/2026-08-05-study-cli-refactors.md`):
- **One shared arg parser** (`scripts/study/argparse.mjs`) used by both the CLI
  and the REPL (was two drifting grammars).
- **GraphQL variables** everywhere (`gql(base, query, {variables, token})`);
  removed all `J()`/`JA()` string interpolation from `session.mjs`/`manager.mjs`
  (kills the numeric-injection smell).
- **`msgs` shows `(N replies)`** via `thread_info.reply_count`.
- **Name-based `--group`** targeting (`scripts/study/groups.mjs` — url pass-through,
  case-insensitive name prefix match, throws on ambiguous/no-match).
- **`cleanup` empties scratch groups** it created (recorded in
  `.study-cli/created.json`; removes sim members — no delete-channel mutation
  exists — then revokes tokens).

**Test entry point:** `node --test scripts/study/*.test.mjs` (pass explicit
globs; `node --test <dir>` is broken on this Node 24). Pure helpers are unit
tested; network paths are verified by running `scenarios/demo.yaml`.
