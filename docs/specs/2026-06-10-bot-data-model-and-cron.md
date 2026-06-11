# Bot data model + cron system — design

**Goal:** Move the hardcoded bot config (`src/api/virtualgroup.ts`) into the database — personas,
bot-centered channels ("virtual groups"), comment cadence, LLM scaffolding, and a **schedule** so
bots post proactively (cron), with **placeholder** tables for future RAG resources.

## Current state
- **Bots = messenger_users** with `is_bot=1` (186 of them, Sendbird-migrated). They function as users.
- **Discussion prompts** already in data: `bom_virtualgroup_prompts` (guid, lang, group_id,
  reference, prompt, thread_id, bot_id). `thread_id IS NULL` = not yet posted; posting sets it.
- **Everything else is hardcoded** in `virtualgroup.ts`'s `virtualgroups` object:
  - group → `channel_url`, `comments:[min,max]` cadence, `prompt_thread` (LLM priming messages),
  - per-bot `persona` (system prompt) + `nickname` (e.g. "Martin Luther").
- **No scheduler.** Legacy posting was triggered by an external hit to `/virtualgrouptrigger`.
  Reactive replies (`botResponder`) already exist in green-field; proactive scheduled posting does not.

## Design decision (final): reuse messenger_channels; minimal bot tables
A bot-driven group **is** a `messenger_channel` (same class — no separate group/channel table). Bot
grouping is a **JSON `tags` column** on `bom_bot` (no join table). Net: **3 new tables.**

| Thing | Home |
|---|---|
| Bot identity (user_id, nickname, avatar) | `messenger_users` (exists) |
| Bot **persona / system prompt** + model + **tags** | **`bom_bot`** (new; `tags` JSON, e.g. `["reformers"]`) |
| Bot-channel config (which tag, cadence, LLM `prompt_thread`, enabled) | **`messenger_channels.metadata.bot`** (existing JSON column) |
| **Discussion prompts** (the questions) | `bom_virtualgroup_prompts` (exists; `group_id` == tag) |
| **Schedule** (the cron) | **`bom_bot_schedule`** (new; keyed by `channel_url`, indexed on `(enabled, next_run_at)`) |
| **RAG resources** (future) | **`bom_bot_rag`** (new, placeholder; bot/tag/channel) |

`messenger_channels.metadata.bot` shape: `{ tag, comment_min, comment_max, prompt_thread, enabled }`.
The scheduler joins a `bom_bot_schedule` row → its `channel_url` → that channel's `metadata.bot` for
the config, and selects participating bots via `bom_bot.tags` containing the channel's `bot.tag`.

All new tables: `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci` (per the utf8mb4
standardization). FK columns to `messenger_users.user_id` / `messenger_channels.channel_url` match
their `varchar` collation.

## DDL

> **Applied 2026-06-10** to bom_prd as the channel+tags model: `bom_bot`,
> `bom_bot_tag (bot_id, tag)`, `bom_bot_channel (channel_url PK, bot_tag, comment_min/max,
> prompt_thread, lang, enabled)`, `bom_bot_schedule (channel_url, action, cron/cadence, next_run_at)`,
> `bom_bot_rag (bot_id/tag/channel_url, resource_type, uri, config)`. All utf8mb4_0900_ai_ci, FKs to
> messenger_users/messenger_channels. The block below is the earlier group-based draft (superseded).

```sql
-- 1. Bot-specific config (one row per bot; bot_id = messenger_users.user_id).
CREATE TABLE IF NOT EXISTS bom_bot (
  bot_id       VARCHAR(32)  NOT NULL,
  display_name VARCHAR(190) NOT NULL,
  persona      MEDIUMTEXT   NULL,          -- the system prompt / character
  temperament  VARCHAR(190) NULL,
  model        VARCHAR(64)  NULL,          -- LLM model override (else gateway default)
  enabled      TINYINT      NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (bot_id),
  CONSTRAINT fk_bom_bot_user FOREIGN KEY (bot_id) REFERENCES messenger_users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Bot-centered channel ("virtual group").
CREATE TABLE IF NOT EXISTS bom_bot_group (
  group_id      VARCHAR(64)  NOT NULL,
  channel_url   VARCHAR(190) NULL,         -- the channel posts land in
  lang          VARCHAR(8)   NOT NULL DEFAULT 'en',
  title         VARCHAR(190) NULL,
  comment_min   INT          NOT NULL DEFAULT 1,   -- bot comments per posted prompt
  comment_max   INT          NOT NULL DEFAULT 3,
  prompt_thread JSON         NULL,         -- LLM priming messages [{role,content}]
  enabled       TINYINT      NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id),
  KEY idx_bot_group_channel (channel_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Bots in a group.
CREATE TABLE IF NOT EXISTS bom_bot_group_member (
  group_id VARCHAR(64)  NOT NULL,
  bot_id   VARCHAR(32)  NOT NULL,
  nickname VARCHAR(190) NULL,              -- group-specific display name
  weight   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, bot_id),
  KEY idx_bgm_bot (bot_id),
  CONSTRAINT fk_bgm_group FOREIGN KEY (group_id) REFERENCES bom_bot_group(group_id) ON DELETE CASCADE,
  CONSTRAINT fk_bgm_bot   FOREIGN KEY (bot_id)   REFERENCES bom_bot(bot_id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Schedule (the cron). One+ rows per group.
CREATE TABLE IF NOT EXISTS bom_bot_schedule (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  group_id    VARCHAR(64)  NOT NULL,
  action      VARCHAR(32)  NOT NULL DEFAULT 'new_prompt',  -- new_prompt | comment
  cron        VARCHAR(64)  NULL,           -- cron expr; or use cadence_minutes
  cadence_minutes INT      NULL,
  enabled     TINYINT      NOT NULL DEFAULT 1,
  last_run_at DATETIME     NULL,
  next_run_at DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sched_group (group_id),
  KEY idx_sched_due (enabled, next_run_at),
  CONSTRAINT fk_sched_group FOREIGN KEY (group_id) REFERENCES bom_bot_group(group_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. RAG resources (placeholder for future retrieval-augmented bots).
CREATE TABLE IF NOT EXISTS bom_bot_rag (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  bot_id        VARCHAR(32)  NULL,         -- per-bot, or
  group_id      VARCHAR(64)  NULL,         -- per-group resource
  resource_type VARCHAR(32)  NOT NULL,     -- document | url | vector_index | ...
  uri           VARCHAR(512) NULL,
  config        JSON         NULL,         -- embedding model, top_k, namespace, ...
  enabled       TINYINT      NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rag_bot (bot_id),
  KEY idx_rag_group (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

> `bom_virtualgroup_prompts` stays as the discussion-question store; later we may add a `group_id`
> FK to `bom_bot_group` and a `posted_at` column, but no change is required now.

## Cron architecture (what needs to be in place)
1. **Tables** above (data-driven config + schedule).
2. **Scheduler** in the green-field backend (`src/realtime` or a new `src/bots/scheduler.ts`): a
   single `node-cron` (or 60s `setInterval`) tick that selects due `bom_bot_schedule` rows
   (`enabled=1 AND next_run_at <= now`), runs the action, and advances `last_run_at`/`next_run_at`.
   Guard against multi-instance double-fire with a short Redis lock (the realtime server already
   uses Redis).
3. **Post logic** (port of legacy `firstPost`/`commentPost`):
   - `new_prompt`: pick an unposted `bom_virtualgroup_prompts` row (`thread_id IS NULL`), have a
     group bot `postMessage` the prompt to the channel, set `thread_id` = the new message_id.
   - `comment`: load the thread, pick a bot (≠ last speaker), `LlmGateway.generate` with the bot's
     `persona` + `bom_bot_group.prompt_thread` priming, post the reply (reuses `botResponder` pieces).
4. **Reuse:** `postMessage`, `LlmGateway`, `getBotMembers`; `getPersona` is repointed from
   `bom_virtualgroup_prompts.bot_id` (always null) to `bom_bot.persona`.

## Migration (port the hardcoded config)
Seed `bom_bot` (personas for Luther/Wesley/Knox/Calvin/Henry VIII…), `bom_bot_group` (`reformers` →
channel `36eddcfa…`, comments, prompt_thread), `bom_bot_group_member`, and one `bom_bot_schedule`
row — extracted from `virtualgroup.ts`. The 1330 `bom_virtualgroup_prompts` rows already exist.

## Rollout
Phase 1 (now): create tables + seed reformers + repoint `getPersona` to `bom_bot`. Phase 2: the
scheduler + post logic. Phase 3: admin GraphQL for prompt management; RAG wiring.
