CREATE TABLE IF NOT EXISTS app_redirect_whitelist (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  app_id CHAR(36) NOT NULL,
  protocol VARCHAR(10) NOT NULL DEFAULT 'https:',
  hostname VARCHAR(255) NOT NULL,
  allow_subdomain_wildcard TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_redirect_app FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE,
  INDEX idx_redirect_app (app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
