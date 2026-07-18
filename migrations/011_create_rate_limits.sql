CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  limiter_key VARCHAR(191) NOT NULL,
  window_time VARCHAR(20) NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_limiter_window (limiter_key, window_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
