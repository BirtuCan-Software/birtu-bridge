// src/services/dlqService.js
const { pool } = require('../db/pool');

async function listFailures() {
  const [rows] = await pool.query(
    `SELECT df.id, df.reason, df.created_at, df.digested_at,
            dq.id AS delivery_id, dq.status AS delivery_status, dq.tx_ref, dq.event_type,
            a.name AS app_name
     FROM dlq_failures df
     JOIN webhook_delivery_queue dq ON dq.id = df.delivery_id
     JOIN applications a ON a.id = df.app_id
     ORDER BY df.created_at DESC
     LIMIT 100`
  );
  return rows;
}

async function retryDelivery(deliveryId) {
  const [result] = await pool.query(
    `UPDATE webhook_delivery_queue
     SET status = 'PENDING', attempt_count = 0, next_attempt_at = NOW()
     WHERE id = :deliveryId AND status = 'FAILED_DLQ'`,
    { deliveryId }
  );
  return result.affectedRows === 1;
}

module.exports = { listFailures, retryDelivery };
