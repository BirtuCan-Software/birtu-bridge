// src/services/auditService.js
const { pool } = require('../db/pool');

async function logEvent(appId, eventType, detail = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (app_id, event_type, detail) VALUES (:appId, :eventType, :detail)`,
      { appId, eventType, detail: JSON.stringify(detail) }
    );
  } catch (err) {
    // Audit logging must never break the main request flow.
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logEvent };
