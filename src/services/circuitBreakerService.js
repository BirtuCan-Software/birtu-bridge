// src/services/circuitBreakerService.js
const { pool } = require('../db/pool');
const config = require('../config');
const { ChapaTimeoutError } = require('../clients/chapaClient');

let consecutiveTimeouts = 0;

class CircuitOpenError extends Error {
  constructor(retryAfterSeconds) {
    super('Payment gateway is temporarily unavailable. Please retry shortly.');
    this.statusCode = 503;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function readStatus() {
  const [rows] = await pool.query(
    `SELECT chapa_status, last_failure_at FROM system_status WHERE id = 1`
  );
  return rows[0] || { chapa_status: 'OPERATIONAL', last_failure_at: null };
}

async function tripToDegraded() {
  await pool.query(
    `UPDATE system_status SET chapa_status = 'DEGRADED', last_failure_at = NOW() WHERE id = 1`
  );
}

async function attemptProbeClaim() {
  const [result] = await pool.query(
    `UPDATE system_status
     SET chapa_status = 'PROBING', last_failure_at = NOW()
     WHERE id = 1 AND chapa_status = 'DEGRADED'
       AND last_failure_at < NOW() - INTERVAL :cooldown SECOND`,
    { cooldown: config.circuitBreaker.cooldownSeconds }
  );
  return result.affectedRows === 1;
}

async function reclaimStaleProbe() {
  const [result] = await pool.query(
    `UPDATE system_status
     SET chapa_status = 'PROBING', last_failure_at = NOW()
     WHERE id = 1 AND chapa_status = 'PROBING'
       AND last_failure_at < NOW() - INTERVAL :stale SECOND`,
    { stale: config.circuitBreaker.probeStaleSeconds }
  );
  return result.affectedRows === 1;
}

async function resolveProbe(success) {
  if (success) {
    await pool.query(
      `UPDATE system_status SET chapa_status = 'OPERATIONAL' WHERE id = 1 AND chapa_status = 'PROBING'`
    );
    consecutiveTimeouts = 0;
  } else {
    await pool.query(
      `UPDATE system_status SET chapa_status = 'DEGRADED', last_failure_at = NOW()
       WHERE id = 1 AND chapa_status = 'PROBING'`
    );
  }
}

async function guardedCall(statusAtEntry, fn) {
  const status = statusAtEntry.chapa_status;

  if (status === 'DEGRADED') {
    const won = await attemptProbeClaim();
    if (!won) throw new CircuitOpenError(config.circuitBreaker.cooldownSeconds);
    return runAndRecord(fn, true);
  }

  if (status === 'PROBING') {
    const won = await reclaimStaleProbe();
    if (!won) throw new CircuitOpenError(config.circuitBreaker.probeStaleSeconds);
    return runAndRecord(fn, true);
  }

  return runAndRecord(fn, false);
}

async function runAndRecord(fn, isProbe) {
  try {
    const result = await fn();
    if (isProbe) {
      await resolveProbe(true);
    } else {
      consecutiveTimeouts = 0;
    }
    return result;
  } catch (err) {
    if (isProbe) {
      await resolveProbe(false);
    } else if (err instanceof ChapaTimeoutError) {
      consecutiveTimeouts += 1;
      if (consecutiveTimeouts >= 3) {
        await tripToDegraded();
        consecutiveTimeouts = 0;
      }
    }
    throw err;
  }
}

module.exports = {
  readStatus,
  guardedCall,
  attemptProbeClaim,
  reclaimStaleProbe,
  resolveProbe,
  CircuitOpenError,
};
