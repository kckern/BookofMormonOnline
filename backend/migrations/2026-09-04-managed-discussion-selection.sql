-- Optional curriculum windows + durable passage history for managed discussions.
-- No rows are inserted here: an unconfigured channel keeps whole-corpus selection.

-- Restore the two omitted runs in 1 Nephi 22 from the canonical verse table.
-- These verse ids had no lds_scriptures_lines rows, while every surrounding
-- verse in the chapter is discourse. The deterministic guid + NOT EXISTS make
-- this repair safe to rerun and safe if the source lines are restored upstream.
INSERT INTO lds_scriptures_lines
  (guid, verse_id, line_num, person_slug, voice, text, format, style)
SELECT
  CONCAT('repair-1ne22-', verse.verse_id), verse.verse_id, 1,
  'nephi1', 'vox_nephi1', verse.verse_scripture,
  IF(verse.pilcrow = 1, '¶', NULL), 'discourse'
FROM lds_scriptures_verses verse
WHERE (verse.verse_id BETWEEN 31690 AND 31700 OR verse.verse_id BETWEEN 31707 AND 31713)
  AND NOT EXISTS (
    SELECT 1 FROM lds_scriptures_lines line WHERE line.verse_id = verse.verse_id
  );

-- 2 Nephi 4:35 is the final verse of Nephi's psalm and was independently
-- omitted from the line table. Preserve the surrounding poetry style.
INSERT INTO lds_scriptures_lines
  (guid, verse_id, line_num, person_slug, voice, text, format, style)
SELECT
  'repair-2ne4-31842', verse.verse_id, 1,
  'nephi1', 'vox_nephi1', verse.verse_scripture,
  IF(verse.pilcrow = 1, '¶', NULL), 'poetry'
FROM lds_scriptures_verses verse
WHERE verse.verse_id = 31842
  AND NOT EXISTS (
    SELECT 1 FROM lds_scriptures_lines line WHERE line.verse_id = verse.verse_id
  );

CREATE TABLE IF NOT EXISTS bom_ai_passage_window (
  window_key       VARCHAR(96) NOT NULL,
  channel_url      VARCHAR(255) NOT NULL,
  sequence_no      INT UNSIGNED NOT NULL,
  label            VARCHAR(255) NOT NULL,
  starts_on        DATE NOT NULL,
  ends_on          DATE NOT NULL,
  enabled          TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (window_key),
  KEY idx_ai_passage_window_active (channel_url, enabled, starts_on, ends_on),
  CONSTRAINT chk_ai_passage_window_dates CHECK (starts_on <= ends_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_passage_range (
  window_key       VARCHAR(96) NOT NULL,
  ordinal          SMALLINT UNSIGNED NOT NULL,
  passage_ref      VARCHAR(255) NOT NULL,
  min_verse_id     INT UNSIGNED NOT NULL,
  max_verse_id     INT UNSIGNED NOT NULL,
  PRIMARY KEY (window_key, ordinal),
  KEY idx_ai_passage_range_bounds (min_verse_id, max_verse_id),
  CONSTRAINT fk_ai_passage_range_window FOREIGN KEY (window_key)
    REFERENCES bom_ai_passage_window(window_key) ON DELETE CASCADE,
  CONSTRAINT chk_ai_passage_range_bounds CHECK (min_verse_id <= max_verse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_ai_passage_use (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel_url      VARCHAR(255) NOT NULL,
  text_guid        VARCHAR(50) NOT NULL,
  root_message_id  VARCHAR(11) NOT NULL,
  window_key       VARCHAR(96) NULL,
  used_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_passage_use_root (root_message_id),
  KEY idx_ai_passage_use_recent (channel_url, text_guid, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Rolling-deploy-safe prompt bundle. Existing English constants remain the
-- compatibility fallback until each channel is explicitly configured.
SET @prompt_bundle_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bom_ai_discussion_config'
    AND column_name = 'prompt_bundle'
);
SET @prompt_bundle_sql = IF(
  @prompt_bundle_exists = 0,
  'ALTER TABLE bom_ai_discussion_config ADD COLUMN prompt_bundle JSON NULL AFTER response_guardrails',
  'SELECT 1'
);
PREPARE prompt_bundle_stmt FROM @prompt_bundle_sql;
EXECUTE prompt_bundle_stmt;
DEALLOCATE PREPARE prompt_bundle_stmt;
