-- One-time follow-up for databases that received the email outbox before the
-- sensitive-content retention guard was added. Do not apply to fresh installs;
-- 2026-08-29-email-system.sql already creates this column.
ALTER TABLE bom_email_outbox
  ADD COLUMN scrub_after_send TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'scrub content after provider acceptance' AFTER variables;
