// src/services/deliveryQueueService.js
const { pool } = require('../db/pool');

async function enqueueDelivery({ txRef, eventType, appId, payload }) {
  await pool.query(
    `INSERT INTO webhook_delivery_queue (tx_ref, event_type, app_id, payload, status, next_attempt_at)
     VALUES (:txRef, :eventType, :appId, :payload, 'PENDING', NOW())
     ON DUPLICATE KEY UPDATE tx_ref = tx_ref`,
    { txRef, eventType, appId, payload: JSON.stringify(payload) }
  );
}

module.exports = { enqueueDelivery };
