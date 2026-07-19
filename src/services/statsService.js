// src/services/statsService.js
const { pool } = require('../db/pool');

async function getDashboardStats() {
  const [statusRows] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM transactions
     WHERE created_at > NOW() - INTERVAL 1 DAY GROUP BY status`
  );

  const [circuitRows] = await pool.query(
    `SELECT chapa_status, last_failure_at FROM system_status WHERE id = 1`
  );

  const [dlqRows] = await pool.query(
    `SELECT COUNT(*) AS count FROM dlq_failures WHERE digested_at IS NULL`
  );

  const [recentTx] = await pool.query(
    `SELECT t.id, t.client_order_id, t.status, t.amount, t.currency, t.created_at, a.name AS app_name
     FROM transactions t
     JOIN applications a ON a.id = t.app_id
     ORDER BY t.created_at DESC
     LIMIT 10`
  );

  return {
    statusCounts: statusRows,
    circuitBreaker: circuitRows[0] || { chapa_status: 'OPERATIONAL', last_failure_at: null },
    dlqUnresolvedCount: dlqRows[0]?.count || 0,
    recentTransactions: recentTx,
  };
}

module.exports = { getDashboardStats };
