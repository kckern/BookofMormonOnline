-- Single-use, time-limited password-reset tokens for the greenfield backend's
-- transactional email layer. utf8mb4_0900_ai_ci per the DB standardization.
CREATE TABLE IF NOT EXISTS bom_password_reset (
  token      VARCHAR(64)  NOT NULL PRIMARY KEY,
  user       VARCHAR(256) NOT NULL,
  expires    DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user),
  KEY idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
