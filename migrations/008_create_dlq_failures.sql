CREATE TABLE IF NOT EXISTS dlq_failures (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT NOT NULL,
  app_id CHAR(36) NOT NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  digested_at DATETIME NULL,
  CONSTRAINT fk_dlq_delivery FOREIGN KEY (delivery_id) REFERENCES webhook_delivery_queue(id) ON DELETE CASCADE,
  INDEX idx_dlq_digested (digested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
