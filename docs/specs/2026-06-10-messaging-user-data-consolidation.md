# Messaging User-Data Consolidation — Deep Dive + Recommended Schema

**Date:** 2026-06-10
**Status:** Recommendation, pre-implementation (precedes the production seed dump)
**Goal:** Fold everything Sendbird tracked per user into our model **without a duplicate
user table** — extend `bom_user` and/or a join-on metadata table — then produce a single
manual MySQL dump that alters schema as needed and populates from the export.

## What Sendbird tracked per user (full inventory, from the export)

Each `users/*.yml`:

| Sendbird field | Meaning | In `bom_user`? | Disposition |
|---|---|---|---|
| `user_id` (32-hex) | `md5(bom_user.user)` | — (`user` = username) | messaging handle, derivable; not stored on bom_user |
| `nickname` | display name | ~ `name` | use `bom_user.name`; bot nicknames live on messenger_users |
| `profile_url` | avatar | **NO** | **derived** — `assets.bookofmormon.online/profiles/{md5(user)}.jpg` (migration target) + dicebear fallback; no column needed for humans |
| `metadata.bookmark` | reading position `{latest,slug,pagetitle,heading}` | **NO** (app read it from Sendbird) | **NEW → bom_user_meta** (the app uses it: `laststudied`, bookmark display) |
| `metadata.summary` | progress `{first,duration,count,completed}` | overlaps `complete/started/time/first/count/finished` | mostly redundant; backfill bom_user progress only if richer |
| `metadata.activeGroup` | current study-group channel_url | **NO** | **NEW → bom_user_meta** |
| `metadata.activeCall` | active call id | **NO** | **skip** (StudyGroupCall deprecated) |
| `last_seen_at` / `is_online` | presence (ms epoch) | **NO** | messaging-ephemeral → `messenger_users` / Redis, not bom_user |
| `is_active` | account active | **NO** | bom_user_meta (or derive) |
| `has_ever_logged_in` | analytics | **NO** | bom_user_meta |
| `preferred_languages` | array | ~ `lang` (single) | bom_user_meta JSON |
| `discovery_keys` | friend discovery | **NO** | bom_user_meta JSON |
| `phone_number` | contact | **NO** | bom_user_meta |
| `is_hide_me_from_friends` | privacy | ~ `visibility` | bom_user_meta |
| `require_auth_for_profile_image` | image privacy | **NO** | bom_user_meta |
| `created_at` | join time | `created_at` | already present |

**Net:** the only Sendbird user data the app actively needs and has nowhere to put is
**`bookmark`, `activeGroup`** (and the soft set: phone, preferred_languages, discovery,
privacy flags, has_ever_logged_in). Progress (`summary`) is already in `bom_user`. Profile
images are derived by convention. Presence is ephemeral.

`bom_user` today: `user`(PK), `last_active`, `pass`, `email`, `name`, `zip`, `first`,
`complete`, `started`, `time`, `count`, `finished`, `visibility`, `lang`, `dnc`,
`created_at`. (Identity + auth + progress — no profile image, no bookmark, no presence.)

## Recommended model — `bom_user` is the one authority

**Principle:** one canonical user table (`bom_user`), one join-on metadata table for the
flexible bag, and `messenger_users` demoted from "user table" to a thin **messaging
participant registry** (humans link to `bom_user`; bots self-contain). No duplication.

### 1. `bom_user` — unchanged (no new columns needed)
Identity, auth, and progress already live here. Profile images are derived from
`md5(user)`; the Sendbird `summary` is redundant with the progress columns. So bom_user
needs **no schema change** — it stays the authority.

### 2. NEW `bom_user_meta` — the join-on metadata table (1:1 with bom_user)
Holds the Sendbird user data bom_user doesn't model; promote the two fields the app
queries to columns, keep the rest in a JSON bag.
```sql
CREATE TABLE bom_user_meta (
  user            VARCHAR(256) NOT NULL,        -- FK → bom_user.user
  bookmark        JSON DEFAULT NULL,            -- {latest,slug,pagetitle,heading}
  active_group    VARCHAR(255) DEFAULT NULL,    -- current study-group channel_url
  metadata        JSON DEFAULT NULL,            -- phone, preferred_languages, discovery_keys,
                                                --   privacy flags, has_ever_logged_in, etc.
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user),
  CONSTRAINT fk_bom_user_meta_user FOREIGN KEY (user) REFERENCES bom_user(user)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
This is the "user metadata table to join on" — extends bom_user without widening it with a
dozen sparse columns, and the green-field `User.progress`/`HomeUser` resolvers read
`bookmark`/`active_group` from here instead of from Sendbird.

### 3. `messenger_users` — demote to a thin participant registry
- **Humans:** `user_id` (md5), `bom_user_id` (→ bom_user.user), `is_bot=0`, presence
  (`is_online`/`last_seen_at`). `nickname`/`profile_url` left NULL — resolved from
  `bom_user.name` + the derived avatar. Not a duplicate user table.
- **Bots / orphans:** `bom_user_id` NULL, `is_bot` as appropriate, `nickname`/`profile_url`
  populated (no bom_user backs them).
- Small green-field change: the messaging services coalesce human display
  (`nickname ?? bom_user.name`, `profile_url ?? derived(md5)`). Contained to the
  user-DTO assembly I built; bots and the wire shape are unchanged.

### 4. Identity key — keep `user_id = md5(bom_user.user)`
Username is the immutable PK of bom_user (verified — no rename path), so md5 is a stable,
client-computable handle the export + socket auth + frontend already use. We no longer
*need* it as a Sendbird↔internal **mapping** (that's what `bom_user_id` is now), but it
stays as the deterministic participant id — zero frontend churn, 1:1 import. A surrogate
UUID would buy nothing here (no renames possible) and force a frontend id-fetch change.

## Why not the alternatives

- **Extend `bom_user` with all the columns:** widens the core table with ~8 sparse,
  mostly-unqueried fields (phone, discovery_keys, privacy flags…). The join table keeps
  bom_user lean and the flexible bag flexible.
- **Keep `messenger_users` as a full denormalized user projection:** that's the
  duplicate-user-table you want to avoid; it re-stores nickname/profile_url and drifts from
  bom_user on profile edits.
- **Separate UUID identity:** solves renames/merges that can't happen here; costs frontend
  + ETL remap. (Full reasoning: `docs/audits/2026-06-10-messaging-three-way-reconciliation.md`.)

## What this means for the dump (next step)

A single `.sql` file (generated by a YAML→SQL script, runnable manually; messaging is off
in prod so a hot load is safe) that:
1. `CREATE TABLE bom_user_meta` (+ no other schema change required).
2. **Clears** the test seed in `messenger_*` (TRUNCATE in FK order).
3. **Loads** from the export, with the transforms from the reconciliation doc (timestamp
   s-vs-ms, ADMM→ADMN, skip desk channels, flatten reactions/files, recover `bom_user_id`
   by reverse-md5):
   - `bom_user_meta` ← each export user's `bookmark`/`activeGroup`/soft-metadata (UPSERT;
     does **not** overwrite bom_user progress — additive).
   - `messenger_users` ← thin human rows (user_id, bom_user_id, presence) + full bot rows.
   - `messenger_channels` / `_members` / `_messages` / `_reactions` / `_highlights` / `_files`.
4. Idempotent (`INSERT … ON DUPLICATE KEY UPDATE`) so you can re-run.

## Open decisions for sign-off

1. **`bom_user_meta` shape:** promote `bookmark`+`active_group` to columns + `metadata`
   JSON for the rest (recommended), or a single `metadata` JSON for everything?
2. **`messenger_users` for humans:** thin (recommended, requires the small coalesce change)
   vs keep denormalized (no code change, accepts duplication)?
3. **Progress backfill:** leave `bom_user` progress as-is (recommended — the app is more
   current), or update from Sendbird `summary` where the export is newer?
