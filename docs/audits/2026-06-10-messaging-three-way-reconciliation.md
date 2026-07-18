# Messaging: Three-Way Reconciliation (Sendbird export ↔ DB tables ↔ code)

**Date:** 2026-06-10
**Question:** Do the `messenger_*` tables fit the Sendbird export and the green-field code,
or do we need to rethink the schema? And what's the path to tie all three together?

## Verdict

**The schema is sound — no rethink needed.** The Sendbird export maps onto the existing
`messenger_*` tables with well-understood transforms, and — critically — **identity aligns
1:1**: the export's 32-char `user_id` is `md5(bom_user.user)`, which is exactly our
`messenger_users.user_id` convention *and* what the socket handshake auth + `messenger*`
resolvers already use. The work is a **seed/import script**, not a redesign.

## The three areas, current state

| | What it is | State |
|---|---|---|
| **Export** `/home/bom/sendbird/` | Sendbird YAML dump: `users/*.yml` (2,790), `channels/*.yml` (274, each with channel + members + messages + threads + stats), export scripts, profile-image migration (already done) | Full dataset, ~40MB |
| **DB tables** `messenger_*` (live `bom_prd`) | 7 tables, proper PKs/FKs/indexes, JSON metadata. users/channels/members/messages/reactions/highlights/files | **Partial TEST seed only** — 213 users (just 7 with `bom_user_id`), 98 channels, 48 messages. To be replaced by the real import. |
| **Code** `/backend` + frontend | Kysely messaging services + `messenger*` GraphQL + socket.io (backend); `MessengerController` + `.sb` shim + feature flag (frontend) | Built; expects `user_id = md5(bom_user.user)`, `message_id` ≤ 11-char string |

## Reconciliation matrix (export → table → transform)

### Users (`users/*.yml` → `messenger_users`)
| Export | Column | Note |
|---|---|---|
| `user_id` (32-hex) | `user_id` (varchar32) | **1:1** — already `md5(bom_user.user)`. Verified 6/8 sample. |
| (reverse lookup) | `bom_user_id` | recover via `SELECT user FROM bom_user WHERE md5(user) = user_id`; null if no match (deleted user) or bot |
| `nickname` | `nickname` | direct |
| `profile_url` | `profile_url` | direct (profile-image migration already ran — URLs current) |
| `metadata{activeCall,activeGroup,bookmark,summary}` | `metadata` (json) | direct; these are bom-app state confirming identity |
| `is_online` / `last_seen_at` | `is_online` / `last_seen_at` | `last_seen_at` is **ms epoch** → `FROM_UNIXTIME(ms/1000)` |
| — | `is_bot` | set 1 for the ~4 non-32-char staff/bot ids (e.g. `b0c4b5`, `stevenrushing`); `bom_user_id` null |
| `created_at` | `created_at` | **seconds epoch** → `FROM_UNIXTIME(s)` |

### Channels (`channels/*.yml` `channel:` → `messenger_channels`)
| Export | Column | Note |
|---|---|---|
| `channel_url` | `channel_url` | direct |
| `name`, `cover_url` | `name`, `cover_url` | direct |
| `custom_type` | `custom_type` (enum) | export values: **DM(142), private(64), solo(26), open(13), public(13)** — all fit the enum. **SENDBIRD_DESK_CHANNEL_CUSTOM_TYPE(16) → skip** (support/desk channels, out of scope) |
| `data`, `is_distinct`, `is_public`, `has_bot`, … | `metadata` (json) | fold flags into metadata |
| `created_at` (s) | `created_at` | `FROM_UNIXTIME(s)` |
| — | `lang` | infer from members' content or default `en` |

### Members (`channels/*.yml` `members:` + operators → `messenger_members`)
| Export | Column | Note |
|---|---|---|
| member `user_id` | `user_id` | 1:1 (FK to messenger_users — import users first) |
| `state` (joined/invited) | `state` (enum) | direct; `requested` unused by Sendbird |
| operator membership | `role` (enum) | Sendbird channels carry an operators list / `created_by`; mark those `operator`, rest `member` |
| `joined_ts` | `created_at` | ms → datetime |
| member `metadata` (bookmark/summary) | → **messenger_users.metadata** | it's user-level state duplicated per channel; dedupe to the user row, NOT a member column (there isn't one) |

### Messages (`channels/*.yml` `messages:` → `messenger_messages` + `_reactions` + `_files`)
| Export | Column | Note |
|---|---|---|
| `message_id` (numeric, **all 10 digits**) | `message_id` (varchar11) | store as string — fits; won't collide with new `nanoid(11)` |
| `type` MESG/ADMM | `message_type` enum MESG/FILE/ADMN | **ADMM → ADMN** rename; `file:{}` present → FILE |
| `message` | `message` | direct |
| `custom_type` (comment, SENDBIRD:AUTO_EVENT_MESSAGE,…) | `custom_type` | varchar(100), fits |
| `data` (links/highlights JSON) | parse → `link_type`/`link_target`/`link_aux` + `messenger_highlights` rows | matches how the code packs `data` |
| thread parent | `parent_message_id` | FK self-ref; `threads:` mostly empty in export |
| `created_at` (**ms**) | `created_at` | `FROM_UNIXTIME(ms/1000)` |
| `user.user_id` | `user_id` | 1:1 |
| `reactions[]` (inline) | → `messenger_reactions` rows | flatten {key,user_ids} → (message_id,user_id,reaction_key) |
| `file{}` (on FILE msgs) | → `messenger_files` rows | url/name/type/size |
| **decision:** ADMM "USER_JOIN" auto-events (1,183 of them) | keep as ADMN, or skip | recommend keep — the UI renders join notices |

Export totals to import: ~2,790 users · ~258 channels (274 − 16 desk) · members per channel · **4,603 MESG + 1,183 ADMM** messages · inline reactions/files.

## Gotchas (the import script must handle)

1. **Timestamp units differ within the export:** channel/user `created_at` = **seconds**;
   message `created_at`, `last_seen_at`, `joined_ts` = **milliseconds**. Normalize per field.
2. **ADMM → ADMN** message_type rename; FILE inferred from `file:{}`.
3. **Desk channels** (`SENDBIRD_DESK_CHANNEL_CUSTOM_TYPE`, 16) — skip.
4. **bom_user_id recovery** by reverse md5; null for deleted users / bots (don't drop the
   messenger_user — orphan messages still need their author row).
5. **Member metadata is user state** — dedupe to `messenger_users.metadata` (a user appears
   in many channels with the same metadata).
6. **Import order (FK-safe):** users → channels → members → messages → reactions/highlights/
   files. FKs are ON DELETE CASCADE, so a clean reload is easy.
7. **The 4 non-md5 user_ids** (staff/bots): `is_bot=1`, `bom_user_id=null`, keep as-is
   (varchar(32) holds them).
8. **Idempotency:** upsert by PK so re-runs are safe; or TRUNCATE-in-FK-order then bulk load.

## Schema tweaks (optional, minor — none block import)

- None required. The enums, types, and lengths all accommodate the export.
- *Nice-to-have:* a `legacy: 1` flag or note in `metadata` to distinguish imported vs
  native rows (helps future audits) — but `message_id` numeric-vs-nanoid already
  distinguishes messages.
- The current 213/98/48 **test rows should be cleared** before the real load (they have
  fabricated content and mostly-null `bom_user_id`).

## Path forward

1. **Verify identity at scale** (read-only): of 2,790 export users, how many `user_id`
   match `md5(bom_user.user)`? Quantify the bot/orphan tail. (Sample says ~75%+ on a tiny
   set; run the full join.) Decide the handling for non-matches (keep as bot/orphan).
2. **Write the import script** `backend/scripts/import-sendbird.mjs` (Node + Kysely,
   writable creds): parse YAML (`js-yaml`), apply the transforms above, bulk-insert in
   FK-safe order, idempotent. Dry-run mode that reports counts without writing.
3. **Clear the test seed** (TRUNCATE messenger_* in FK order) on the target DB.
4. **Run against a writable DB** (`bom_app` in the private workspace repo — the dev host is
   read-only `reader`): import, then validate row counts vs export, spot-check a DM and a
   group thread, confirm reactions/files landed.
5. **End-to-end with real data:** point a backend at the seeded DB, run the
   `tests/messaging` integration suite (`MESSAGING_WRITE_TESTS=1`) + a manual study-group
   smoke. Real channels/messages now flow through `messenger*` + sockets to the unchanged
   frontend.
6. **Cutover:** flip the staging subdomain (frontend flag) at the seeded green-field
   backend; prod stays off.

## Bottom line

Three areas, one clean seam: **the export's identity already matches our schema and our
code's auth**, so this is an ETL job (YAML → transforms → tables), not a redesign. The
only true dependency is a **writable DB** to load into — the same gate the rest of the
messaging build has been waiting on. Schema: keep as-is.
