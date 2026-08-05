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

## Cleanup

A `cleanup` verb deletes `sim_*` users' `bom_user_token` rows (and optionally the scratch groups they created). Sim accounts are clearly namespaced so they're identifiable in `bom_user`.
