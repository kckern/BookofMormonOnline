-- Public, fixed-membership study groups and AI discussion configuration.
--
-- This migration is additive. Existing messenger channels retain legacy
-- behaviour until a messenger_channel_policy row is inserted for them.
-- Foreign keys to legacy messenger/bot tables are intentionally omitted: those
-- tables use older key widths/collations in production. Application validation
-- enforces those references; new-table-to-new-table corpus keys remain strict.

CREATE TABLE IF NOT EXISTS messenger_channel_policy (
  channel_url             VARCHAR(255) NOT NULL,
  owner_user_id           VARCHAR(32) NULL,
  visibility              ENUM('private','public','unlisted') NOT NULL DEFAULT 'private',
  membership_policy       ENUM('open','request','fixed') NOT NULL DEFAULT 'request',
  root_post_policy        ENUM('members','authenticated','nobody') NOT NULL DEFAULT 'members',
  reply_policy            ENUM('members','authenticated','nobody') NOT NULL DEFAULT 'members',
  reaction_policy         ENUM('members','authenticated','nobody') NOT NULL DEFAULT 'members',
  outsider_comments_live  TINYINT(1) NOT NULL DEFAULT 0,
  listed                  TINYINT(1) NOT NULL DEFAULT 1,
  enabled                 TINYINT(1) NOT NULL DEFAULT 0,
  created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (channel_url),
  KEY idx_channel_policy_discovery (enabled, visibility, listed),
  KEY idx_channel_policy_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS messenger_thread_state (
  root_message_id       VARCHAR(11) NOT NULL,
  channel_url           VARCHAR(255) NOT NULL,
  status                ENUM('active','bot_complete','locked') NOT NULL DEFAULT 'active',
  bot_message_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  bot_complete_at       DATETIME(6) NULL,
  locked_at             DATETIME(6) NULL,
  lock_reason           VARCHAR(255) NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (root_message_id),
  KEY idx_thread_state_channel (channel_url, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS messenger_content_report (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id            VARCHAR(11) NOT NULL,
  reporter_user_id      VARCHAR(32) NOT NULL,
  reason                VARCHAR(64) NOT NULL,
  detail                VARCHAR(1000) NULL,
  status                ENUM('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  resolved_at           DATETIME(6) NULL,
  resolved_by           VARCHAR(32) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_message_reporter (message_id, reporter_user_id),
  KEY idx_report_queue (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_discussion_config (
  channel_url             VARCHAR(255) NOT NULL,
  enabled                 TINYINT(1) NOT NULL DEFAULT 0,
  timezone                VARCHAR(64) NOT NULL DEFAULT 'America/Denver',
  local_start_time        TIME NOT NULL DEFAULT '08:00:00',
  discursive_weight       TINYINT UNSIGNED NOT NULL DEFAULT 80,
  narrative_weight        TINYINT UNSIGNED NOT NULL DEFAULT 20,
  audience_response_chance TINYINT UNSIGNED NOT NULL DEFAULT 35,
  min_bot_voices          TINYINT UNSIGNED NOT NULL DEFAULT 3,
  max_bot_voices          TINYINT UNSIGNED NOT NULL DEFAULT 5,
  max_bot_messages        TINYINT UNSIGNED NOT NULL DEFAULT 12,
  bot_window_hours        TINYINT UNSIGNED NOT NULL DEFAULT 72,
  min_delay_minutes       SMALLINT UNSIGNED NOT NULL DEFAULT 45,
  max_delay_minutes       SMALLINT UNSIGNED NOT NULL DEFAULT 240,
  prompt_template         MEDIUMTEXT NOT NULL,
  response_guardrails     MEDIUMTEXT NOT NULL,
  created_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at              DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (channel_url),
  CONSTRAINT chk_discussion_mix CHECK (discursive_weight + narrative_weight = 100),
  CONSTRAINT chk_discussion_voices CHECK (min_bot_voices BETWEEN 1 AND max_bot_voices AND max_bot_voices <= 10),
  CONSTRAINT chk_discussion_limits CHECK (max_bot_messages BETWEEN 1 AND 100 AND bot_window_hours BETWEEN 1 AND 168),
  CONSTRAINT chk_discussion_delays CHECK (min_delay_minutes <= max_delay_minutes AND max_delay_minutes <= 1440)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Idempotent upgrade for an environment where the first version of this
-- additive migration was applied before audience respondents were introduced.
SET @audience_chance_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bom_ai_discussion_config'
    AND column_name = 'audience_response_chance'
);
SET @audience_chance_sql = IF(
  @audience_chance_exists = 0,
  'ALTER TABLE bom_ai_discussion_config ADD COLUMN audience_response_chance TINYINT UNSIGNED NOT NULL DEFAULT 35 AFTER narrative_weight',
  'SELECT 1'
);
PREPARE audience_chance_stmt FROM @audience_chance_sql;
EXECUTE audience_chance_stmt;
DEALLOCATE PREPARE audience_chance_stmt;

-- Non-member bot identities explicitly approved by orchestration to comment on
-- an existing public thread. They never appear in messenger_members and cannot
-- open roots through normal channel authorization.
CREATE TABLE IF NOT EXISTS bom_ai_audience_bot (
  channel_url           VARCHAR(255) NOT NULL,
  bot_id                VARCHAR(32) NOT NULL,
  response_weight       SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  topic_triggers        JSON NOT NULL,
  enabled               TINYINT(1) NOT NULL DEFAULT 1,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (channel_url, bot_id),
  KEY idx_ai_audience_bot_pick (channel_url, enabled, response_weight)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_topic (
  topic_id              VARCHAR(96) NOT NULL,
  channel_url           VARCHAR(255) NOT NULL,
  passage_ref           VARCHAR(255) NOT NULL,
  passage_slug          VARCHAR(255) NULL,
  passage_kind          ENUM('discursive','narrative') NOT NULL,
  question              TEXT NOT NULL,
  context_note          TEXT NULL,
  enabled               TINYINT(1) NOT NULL DEFAULT 1,
  last_used_at          DATETIME(6) NULL,
  use_count             INT UNSIGNED NOT NULL DEFAULT 0,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (topic_id),
  KEY idx_ai_topic_pick (channel_url, enabled, passage_kind, last_used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_discussion_turn (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  root_message_id       VARCHAR(11) NOT NULL,
  bot_id                VARCHAR(32) NOT NULL,
  ordinal               SMALLINT UNSIGNED NOT NULL,
  due_at                DATETIME(6) NOT NULL,
  status                ENUM('pending','leased','posted','skipped','failed') NOT NULL DEFAULT 'pending',
  lease_owner           VARCHAR(96) NULL,
  lease_expires_at      DATETIME(6) NULL,
  message_id            VARCHAR(11) NULL,
  failure_reason        VARCHAR(1000) NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_discussion_turn (root_message_id, ordinal),
  KEY idx_discussion_turn_due (status, due_at, lease_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_corpus (
  corpus_id             VARCHAR(96) NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  author_key            VARCHAR(96) NOT NULL,
  source_uri            VARCHAR(1000) NOT NULL,
  source_sha256         CHAR(64) NULL,
  rights_class          ENUM('citation_eligible','inference_only','blocked') NOT NULL,
  rights_note           VARCHAR(1000) NOT NULL,
  edition               VARCHAR(255) NULL,
  enabled               TINYINT(1) NOT NULL DEFAULT 0,
  ingested_at           DATETIME(6) NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (corpus_id),
  KEY idx_ai_corpus_author (author_key, enabled, rights_class)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_bot_corpus (
  bot_id                VARCHAR(32) NOT NULL,
  corpus_id             VARCHAR(96) NOT NULL,
  retrieval_weight      DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  enabled               TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (bot_id, corpus_id),
  CONSTRAINT fk_ai_bot_corpus_corpus FOREIGN KEY (corpus_id)
    REFERENCES bom_ai_corpus(corpus_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_evidence (
  evidence_id           CHAR(36) NOT NULL,
  message_id            VARCHAR(11) NOT NULL,
  bot_id                VARCHAR(32) NOT NULL,
  corpus_id             VARCHAR(96) NOT NULL,
  locator               VARCHAR(500) NOT NULL COMMENT 'work title + chapter/section/page; no excerpt',
  claim_kind            ENUM('paraphrase','exact_quote') NOT NULL DEFAULT 'paraphrase',
  verification_status   ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (evidence_id),
  KEY idx_ai_evidence_message (message_id),
  CONSTRAINT fk_ai_evidence_corpus FOREIGN KEY (corpus_id)
    REFERENCES bom_ai_corpus(corpus_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
