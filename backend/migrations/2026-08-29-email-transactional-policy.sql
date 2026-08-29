-- Transactional notification frequency policy + translation grid metadata.
-- Apply once after 2026-08-29-email-system.sql.

CREATE TABLE bom_email_template_definition (
  template_key          VARCHAR(96) NOT NULL,
  version               INT UNSIGNED NOT NULL,
  category              VARCHAR(32) NOT NULL,
  required_variables    JSON NOT NULL,
  active                TINYINT(1) NOT NULL DEFAULT 1,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (template_key, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE bom_email_template
  ADD COLUMN cta_text VARCHAR(160) NULL AFTER body_markdown,
  ADD COLUMN cta_url_variable VARCHAR(64) NULL AFTER cta_text,
  ADD COLUMN translation_status VARCHAR(16) NOT NULL DEFAULT 'published' AFTER footer_text,
  ADD COLUMN reviewed_by VARCHAR(64) NULL AFTER translation_status,
  ADD COLUMN published_at DATETIME(6) NULL AFTER reviewed_by,
  ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ON UPDATE CURRENT_TIMESTAMP(6) AFTER created_at;

INSERT INTO bom_email_template_definition
  (template_key, version, category, required_variables)
VALUES
  ('password-reset', 1, 'security', '["resetUrl"]'),
  ('account-recovery', 1, 'security', '["username","signinUrl"]'),
  ('notification-reply', 1, 'reply', '["actorName","targetUrl"]'),
  ('notification-mention', 1, 'mention', '["actorName","targetUrl"]'),
  ('notification-invite', 1, 'invite', '["targetUrl"]'),
  ('notification-direct-message', 1, 'direct_message', '["actorName","targetUrl"]'),
  ('notification-summary', 1, 'notification_summary', '["activityCount","targetUrl"]');

UPDATE bom_email_template SET
  body_markdown = 'We received a request to reset your password. This link is valid for 30 minutes.\n\nIf you did not request this, you can safely ignore this email. Your password will not change.',
  cta_text = 'Reset your password', cta_url_variable = 'resetUrl',
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP(6))
WHERE template_key = 'password-reset' AND version = 1 AND lang = 'en';

UPDATE bom_email_template SET
  body_markdown = 'The account associated with this email address is **{username}**.\n\nIf you did not request this reminder, you can safely ignore this email.',
  cta_text = 'Sign in', cta_url_variable = 'signinUrl',
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP(6))
WHERE template_key = 'account-recovery' AND version = 1 AND lang = 'en';

UPDATE bom_email_template SET
  subject_template = '{actorName} replied to your comment',
  preheader_template = '{actorName} replied to your comment.',
  body_markdown = '{actorName} replied to your comment.',
  cta_text = 'View the reply', cta_url_variable = 'targetUrl',
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP(6))
WHERE template_key = 'notification-reply' AND version = 1 AND lang = 'en';

UPDATE bom_email_template SET
  subject_template = '{actorName} mentioned you',
  preheader_template = '{actorName} mentioned you.',
  body_markdown = '{actorName} mentioned you.',
  cta_text = 'View the mention', cta_url_variable = 'targetUrl',
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP(6))
WHERE template_key = 'notification-mention' AND version = 1 AND lang = 'en';

UPDATE bom_email_template SET
  body_markdown = 'You received a study-group invitation.',
  cta_text = 'View the invitation', cta_url_variable = 'targetUrl',
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP(6))
WHERE template_key = 'notification-invite' AND version = 1 AND lang = 'en';

UPDATE bom_email_template SET
  subject_template = '{actorName} sent you a message',
  preheader_template = '{actorName} sent you a message.',
  body_markdown = '{actorName} sent you a direct message.',
  cta_text = 'View the message', cta_url_variable = 'targetUrl',
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP(6))
WHERE template_key = 'notification-direct-message' AND version = 1 AND lang = 'en';

INSERT INTO bom_email_template
  (template_key, version, lang, subject_template, preheader_template, body_markdown,
   cta_text, cta_url_variable, brand_name, footer_text, active, translation_status, published_at)
VALUES
  ('notification-summary', 1, 'en',
   'You have {activityCount, plural, one {# unread update} other {# unread updates}}',
   'You have unread activity on Book of Mormon Online.',
   'You have {activityCount, plural, one {# unread update} other {# unread updates}} waiting for you.',
   'View unread activity', 'targetUrl', 'Book of Mormon Online', 'Book of Mormon Online',
   1, 'published', CURRENT_TIMESTAMP(6));

CREATE TABLE bom_email_notification_state (
  user_id               VARCHAR(64) NOT NULL,
  category              VARCHAR(32) NOT NULL,
  group_key             VARCHAR(191) NOT NULL,
  recipient_email       VARCHAR(320) NOT NULL,
  last_event_at         DATETIME(6) NOT NULL,
  last_immediate_at     DATETIME(6) NULL,
  last_summary_at       DATETIME(6) NULL,
  hold_until            DATETIME(6) NULL,
  backoff_level         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, category, group_key),
  KEY idx_email_notification_state_hold (hold_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bom_email_notification_queue (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_key      VARCHAR(255) NOT NULL,
  user_id               VARCHAR(64) NOT NULL,
  notification_user_id  VARCHAR(64) NOT NULL,
  category              VARCHAR(32) NOT NULL,
  group_key             VARCHAR(191) NOT NULL,
  channel_url           VARCHAR(100) NULL,
  recipient_email       VARCHAR(320) NOT NULL,
  lang                  VARCHAR(16) NOT NULL DEFAULT 'en',
  actor_name            VARCHAR(160) NULL,
  target_url            VARCHAR(1000) NOT NULL,
  event_at              DATETIME(6) NOT NULL,
  eligible_at           DATETIME(6) NOT NULL,
  status                VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending | processing | immediate | summarized | suppressed',
  outbox_id             BIGINT UNSIGNED NULL,
  processed_at          DATETIME(6) NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_notification_key (notification_user_id, notification_key),
  KEY idx_email_notification_due (status, eligible_at),
  KEY idx_email_notification_group (user_id, category, group_key, status),
  CONSTRAINT fk_email_notification_outbox FOREIGN KEY (outbox_id) REFERENCES bom_email_outbox(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bom_email_rate_limit (
  scope_hash            CHAR(64) NOT NULL,
  action                VARCHAR(32) NOT NULL,
  window_start          DATETIME NOT NULL,
  request_count         INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (scope_hash, action, window_start),
  KEY idx_email_rate_limit_cleanup (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Preference UI copy uses the same bom_label + bom_translation mechanism as
-- the rest of the multilingual application. Missing translations fall back to
-- these English source labels through the existing label service.
INSERT IGNORE INTO bom_label (guid, label_id, label_text, type) VALUES
  ('eml000000000b', 'email_notifications', 'Email notifications', 'email'),
  ('eml000000000c', 'email_notifications_description', 'Choose which unread activity may be emailed to you.', 'email'),
  ('eml000000000d', 'email_notification_reply', 'Replies to my comments', 'email'),
  ('eml000000000e', 'email_notification_mention', 'Mentions of me', 'email'),
  ('eml000000000f', 'email_notification_direct_message', 'Direct messages', 'email'),
  ('eml0000000010', 'email_notification_invite', 'Study-group invitations', 'email');
