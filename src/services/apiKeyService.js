// src/services/apiKeyService.js
const { pool } = require('../db/pool');
const { sha256Hex } = require('../utils/crypto');
const config = require('../config');

function currentWindow() {
  // Fixed-minute window, e.g. "2026-07-18 14:32"
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(
    now.getUTCHours()
  )}:${pad(now.getUTCMinutes())}`;
}

/**
 * The full gateway entry sequence:
 * 1. Validate API key (SELECT)
 * 2. If invalid: rate-limit by IP only, then stop (do NOT touch rate_limits keyed by the bogus key)
 * 3. If valid: read circuit breaker status (SELECT)
 * 4. Increment rate limit counter for the now-confirmed-valid key (INSERT ... ON DUPLICATE KEY UPDATE)
 * All four steps share ONE connection, released immediately after, no transaction wrapper.
 */
async function authenticateAndCheckLimits({ providedKey, clientIp }) {
  const conn = await pool.getConnection();
  try {
    if (!providedKey) {
      const ipCheck = await incrementAndCheckIpLimit(conn, clientIp);
      return { authenticated: false, reason: 'MISSING_API_KEY', rateLimited: ipCheck.limited };
    }

    const keyHash = sha256Hex(providedKey);

    // Step 1: validate API key
    const [keyRows] = await conn.query(
      `SELECT ak.id AS key_id, ak.app_id, a.name, a.environment, a.webhook_url, a.status AS app_status
       FROM api_keys ak
       JOIN applications a ON a.id = ak.app_id
       WHERE ak.key_hash = :keyHash AND ak.status = 'active'
       LIMIT 1`,
      { keyHash }
    );

    const match = keyRows[0];

    if (!match || match.app_status !== 'active') {
      // Unauthenticated request: rate-limit by IP, never by the bogus key
      // (prevents unbounded row growth in rate_limits from attacker-supplied garbage keys).
      const ipCheck = await incrementAndCheckIpLimit(conn, clientIp);
      return { authenticated: false, reason: 'INVALID_API_KEY', rateLimited: ipCheck.limited };
    }

    // Step 2: circuit breaker read
    const [statusRows] = await conn.query(
      `SELECT chapa_status, last_failure_at FROM system_status WHERE id = 1`
    );
    const circuitBreaker = statusRows[0] || { chapa_status: 'OPERATIONAL', last_failure_at: null };

    // Step 3: rate limit increment, keyed on the confirmed-valid key
    const limiterKey = `apikey:${keyHash}`;
    const window = currentWindow();
    await conn.query(
      `INSERT INTO rate_limits (limiter_key, window_time, request_count)
       VALUES (:limiterKey, :window, 1)
       ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
      { limiterKey, window }
    );
    const [countRows] = await conn.query(
      `SELECT request_count FROM rate_limits WHERE limiter_key = :limiterKey AND window_time = :window`,
      { limiterKey, window }
    );
    const requestCount = countRows[0]?.request_count || 1;
    const limited = requestCount > config.rateLimit.perMinutePerKey;

    return {
      authenticated: true,
      rateLimited: limited,
      app: {
        id: match.app_id,
        name: match.name,
        environment: match.environment,
        webhookUrl: match.webhook_url,
      },
      apiKeyId: match.key_id,
      circuitBreaker: {
        status: circuitBreaker.chapa_status,
        lastFailureAt: circuitBreaker.last_failure_at,
      },
    };
  } finally {
    conn.release();
  }
}

async function incrementAndCheckIpLimit(conn, clientIp) {
  const limiterKey = `ip:${clientIp || 'unknown'}`;
  const window = currentWindow();
  await conn.query(
    `INSERT INTO rate_limits (limiter_key, window_time, request_count)
     VALUES (:limiterKey, :window, 1)
     ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
    { limiterKey, window }
  );
  const [rows] = await conn.query(
    `SELECT request_count FROM rate_limits WHERE limiter_key = :limiterKey AND window_time = :window`,
    { limiterKey, window }
  );
  const requestCount = rows[0]?.request_count || 1;
  return { limited: requestCount > config.rateLimit.perMinutePerIp };
}

module.exports = { authenticateAndCheckLimits };
