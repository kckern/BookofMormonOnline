-- Durable transactional email and user-notification delivery.
-- Campaign producers can be added later without changing the outbox contract.
-- Runtime sending remains disabled unless MAIL_SENDING_ENABLED=true.

CREATE TABLE IF NOT EXISTS bom_email_template (
  template_key          VARCHAR(96) NOT NULL,
  version               INT UNSIGNED NOT NULL,
  lang                  VARCHAR(16) NOT NULL,
  subject_template      VARCHAR(255) NOT NULL,
  preheader_template    VARCHAR(255) NOT NULL,
  body_markdown         MEDIUMTEXT NOT NULL,
  brand_name            VARCHAR(160) NOT NULL,
  footer_text           VARCHAR(255) NOT NULL,
  active                TINYINT(1) NOT NULL DEFAULT 1,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (template_key, version, lang),
  KEY idx_email_template_active (template_key, lang, active, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- English is the fallback source of truth. Additional languages use the same
-- keys and version with their language code; runtime always requests a lang.
INSERT IGNORE INTO bom_email_template
  (template_key, version, lang, subject_template, preheader_template, body_markdown, brand_name, footer_text)
VALUES
  ('password-reset', 1, 'en',
   'Reset your Book of Mormon Online password',
   'Your secure password-reset link expires in 30 minutes.',
   'We received a request to reset your password. This link is valid for 30 minutes.\n\n[Reset your password]({{resetUrl}})\n\nIf you did not request this, you can safely ignore this email. Your password will not change.',
   'Book of Mormon Online', 'Book of Mormon Online'),
  ('account-recovery', 1, 'en',
   'Your Book of Mormon Online account information',
   'Here is the account name associated with your email address.',
   'The account associated with this email address is **{{username}}**.\n\n[Sign in]({{signinUrl}})\n\nIf you did not request this reminder, you can safely ignore this email.',
   'Book of Mormon Online', 'Book of Mormon Online'),
  ('notification-reply', 1, 'en',
   '{{actorName}} replied to your comment',
   '{{actorName}} replied to your comment.',
   '{{actorName}} replied to your comment.\n\n[View the reply]({{targetUrl}})',
   'Book of Mormon Online', 'Book of Mormon Online'),
  ('notification-mention', 1, 'en',
   '{{actorName}} mentioned you',
   '{{actorName}} mentioned you.',
   '{{actorName}} mentioned you.\n\n[View the mention]({{targetUrl}})',
   'Book of Mormon Online', 'Book of Mormon Online'),
  ('notification-invite', 1, 'en',
   'You received a study-group invitation',
   'You received a study-group invitation.',
   'You received a study-group invitation.\n\n[View the invitation]({{targetUrl}})',
   'Book of Mormon Online', 'Book of Mormon Online'),
  ('notification-direct-message', 1, 'en',
   '{{actorName}} sent you a message',
   '{{actorName}} sent you a message.',
   '{{actorName}} sent you a direct message.\n\n[View the message]({{targetUrl}})',
   'Book of Mormon Online', 'Book of Mormon Online');

-- UI source labels. Existing bom_translation overlays these by
-- (guid, refkey='label_text', lang), exactly like every other application label.
INSERT IGNORE INTO bom_label (guid, label_id, label_text, type) VALUES
  ('eml0000000001', 'forgot_password', 'Forgot password?', 'email'),
  ('eml0000000002', 'forgot_username', 'Forgot username?', 'email'),
  ('eml0000000003', 'email_or_username', 'Email or username', 'email'),
  ('eml0000000004', 'send_recovery_email', 'Send recovery email', 'email'),
  ('eml0000000005', 'recovery_request_received', 'If the account exists, a recovery email is on its way.', 'email'),
  ('eml0000000006', 'reset_password', 'Reset password', 'email'),
  ('eml0000000007', 'reset_password_instructions', 'Choose a new password for your account.', 'email'),
  ('eml0000000008', 'password_reset_success', 'Your password has been reset.', 'email'),
  ('eml0000000009', 'invalid_or_expired_token', 'This recovery link is invalid or has expired.', 'email'),
  ('eml000000000a', 'back_to_login', 'Back to sign in', 'email');

CREATE TABLE IF NOT EXISTS bom_email_outbox (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind                  VARCHAR(24) NOT NULL COMMENT 'transactional | notification',
  category              VARCHAR(32) NOT NULL,
  user_id               VARCHAR(64) NULL,
  recipient_email       VARCHAR(320) NOT NULL,
  template_key          VARCHAR(96) NOT NULL,
  template_version      INT UNSIGNED NOT NULL,
  locale                VARCHAR(16) NOT NULL DEFAULT 'en',
  variables             JSON NOT NULL,
  scrub_after_send      TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'scrub content after provider acceptance',
  rendered_subject      VARCHAR(255) NOT NULL,
  rendered_html         MEDIUMTEXT NOT NULL,
  rendered_text         MEDIUMTEXT NOT NULL,
  idempotency_key       VARCHAR(191) NOT NULL,
  status                VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending | leased | sent | retry | suppressed | failed | cancelled',
  attempt_count         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts          SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  scheduled_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  lease_owner           VARCHAR(96) NULL,
  lease_expires_at      DATETIME(6) NULL,
  last_error            VARCHAR(1000) NULL,
  provider_message_id   VARCHAR(255) NULL,
  sent_at               DATETIME(6) NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_outbox_idempotency (idempotency_key),
  KEY idx_email_outbox_claim (status, scheduled_at, lease_expires_at),
  KEY idx_email_outbox_recipient (recipient_email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_email_preference (
  user_id               VARCHAR(64) NOT NULL,
  category              VARCHAR(32) NOT NULL,
  enabled               TINYINT(1) NOT NULL DEFAULT 1,
  cadence               VARCHAR(16) NOT NULL DEFAULT 'immediate' COMMENT 'immediate | daily | never',
  locale                VARCHAR(16) NULL,
  source                VARCHAR(32) NOT NULL DEFAULT 'default',
  confirmed_at          DATETIME(6) NULL,
  unsubscribed_at       DATETIME(6) NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, category),
  KEY idx_email_preference_category (category, enabled, cadence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_email_suppression (
  email_normalized      VARCHAR(320) NOT NULL,
  reason                VARCHAR(32) NOT NULL COMMENT 'bounce | complaint | manual | unsubscribe',
  source                VARCHAR(32) NOT NULL,
  detail                JSON NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at            DATETIME(6) NULL,
  PRIMARY KEY (email_normalized),
  KEY idx_email_suppression_reason (reason, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bom_email_event (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_event_id     VARCHAR(255) NOT NULL,
  provider_message_id   VARCHAR(255) NULL,
  outbox_id             BIGINT UNSIGNED NULL,
  event_type            VARCHAR(32) NOT NULL,
  recipient_email       VARCHAR(320) NULL,
  payload               JSON NOT NULL,
  occurred_at           DATETIME(6) NOT NULL,
  created_at            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_event_provider_id (provider_event_id),
  KEY idx_email_event_message (provider_message_id, event_type),
  KEY idx_email_event_outbox (outbox_id, event_type),
  CONSTRAINT fk_email_event_outbox FOREIGN KEY (outbox_id) REFERENCES bom_email_outbox(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
