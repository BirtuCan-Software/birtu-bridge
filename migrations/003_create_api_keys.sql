CREATE TABLE IF NOT EXISTS api_keys (
  id CHAR(36) NOT NULL PRIMARY KEY,
  app_id CHAR(36) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  key_prefix VARCHAR(30) NOT NULL,
  status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  CONSTRAINT fk_apikey_app FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_key_hash (key_hash),
  INDEX idx_apikey_app (app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
