-- Notifications phase 1: durable store. Applied manually (no migration framework yet).
-- Apply: mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p $MYSQL_DB < docs/sql/2026-08-06-notification-table.sql
CREATE TABLE IF NOT EXISTS bom_notification (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       VARCHAR(32)  NOT NULL COMMENT 'recipient; md5(username) = messenger_users.user_id',
  type          VARCHAR(32)  NOT NULL COMMENT 'reply | reaction | invite | ...',
  actor_id      VARCHAR(32)  NULL     COMMENT 'messenger_users.user_id of the actor; NULL for system',
  dedupe_key    VARCHAR(255) NOT NULL COMMENT 'deterministic public id, e.g. reply:<msgId>',
  payload       JSON         NOT NULL COMMENT 'rendered text, channel_url, message_id, actor UserDTO',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at       DATETIME     NULL,
  dismissed_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_dedupe (user_id, dedupe_key),
  KEY idx_user_unread (user_id, read_at),
  KEY idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
