// src/services/loginRateLimiter.js
const { pool } = require('../db/pool');
const config = require('../config');

function currentWindow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(
    now.getUTCHours()
  )}:${pad(now.getUTCMinutes())}`;
}

async function isLoginRateLimited(identifier) {
  const limiterKey = `login:${identifier}`;
  const window = currentWindow();
  await pool.query(
    `INSERT INTO rate_limits (limiter_key, window_time, request_count)
     VALUES (:limiterKey, :window, 1)
     ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
    { limiterKey, window }
  );
  const [rows] = await pool.query(
    `SELECT request_count FROM rate_limits WHERE limiter_key = :limiterKey AND window_time = :window`,
    { limiterKey, window }
  );
  const count = rows[0]?.request_count || 1;
  return count > config.loginRateLimitPerMinute;
}

module.exports = { isLoginRateLimited };
