// src/repositories/transactionRepo.js
const { pool } = require('../db/pool');

async function getLatestAttempt(appId, clientOrderId) {
  const [rows] = await pool.query(
    `SELECT * FROM transactions
     WHERE app_id = :appId AND client_order_id = :clientOrderId
     ORDER BY attempt_count DESC
     LIMIT 1`,
    { appId, clientOrderId }
  );
  return rows[0] || null;
}

async function getById(transactionId) {
  const [rows] = await pool.query(`SELECT * FROM transactions WHERE id = :transactionId`, {
    transactionId,
  });
  return rows[0] || null;
}

async function getByChapaTxRef(chapaTxRef) {
  const [rows] = await pool.query(`SELECT * FROM transactions WHERE chapa_tx_ref = :chapaTxRef`, {
    chapaTxRef,
  });
  return rows[0] || null;
}

async function insertPendingCreation({
  appId,
  clientOrderId,
  attemptCount,
  chapaTxRef,
  amount,
  currency,
  customerEmail,
  returnUrl,
}) {
  const [result] = await pool.query(
    `INSERT INTO transactions
       (app_id, client_order_id, attempt_count, chapa_tx_ref, amount, currency, customer_email, return_url, status)
     VALUES
       (:appId, :clientOrderId, :attemptCount, :chapaTxRef, :amount, :currency, :customerEmail, :returnUrl, 'PENDING_CREATION')`,
    { appId, clientOrderId, attemptCount, chapaTxRef, amount, currency, customerEmail, returnUrl: returnUrl || null }
  );
  return result.insertId;
}

async function insertNextAttemptWithRetry({
  appId,
  clientOrderId,
  baseAttemptCount,
  amount,
  currency,
  customerEmail,
  returnUrl,
  generateTxRefFn,
}) {
  let attemptCount = baseAttemptCount;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    const chapaTxRef = generateTxRefFn(attemptCount);
    try {
      const [result] = await pool.query(
        `INSERT INTO transactions
           (app_id, client_order_id, attempt_count, chapa_tx_ref, amount, currency, customer_email, return_url, status)
         VALUES
           (:appId, :clientOrderId, :attemptCount, :chapaTxRef, :amount, :currency, :customerEmail, :returnUrl, 'PENDING_CREATION')`,
        { appId, clientOrderId, attemptCount, chapaTxRef, amount, currency, customerEmail, returnUrl: returnUrl || null }
      );
      return { transactionId: result.insertId, attemptCount, chapaTxRef };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        attemptCount += 1;
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Failed to insert next attempt after retries');
}

async function markForwarding(transactionId) {
  await pool.query(
    `UPDATE transactions SET status = 'FORWARDING' WHERE id = :transactionId AND status = 'PENDING_CREATION'`,
    { transactionId }
  );
}

async function markInitialized(transactionId, { chapaReference, checkoutUrl }) {
  await pool.query(
    `UPDATE transactions
     SET status = 'INITIALIZED', chapa_reference = :chapaReference, checkout_url = :checkoutUrl
     WHERE id = :transactionId`,
    { transactionId, chapaReference: chapaReference || null, checkoutUrl }
  );
}

async function markFailed(transactionId, errorDetail) {
  await pool.query(
    `UPDATE transactions SET status = 'FAILED', error_detail = :errorDetail WHERE id = :transactionId`,
    { transactionId, errorDetail: JSON.stringify(errorDetail || {}) }
  );
}

async function markPaid(transactionId, detail) {
  await pool.query(
    `UPDATE transactions SET status = 'PAID', error_detail = :detail WHERE id = :transactionId`,
    { transactionId, detail: JSON.stringify(detail || {}) }
  );
}

async function claimForRecovery(appId, clientOrderId) {
  const [result] = await pool.query(
    `UPDATE transactions
     SET status = 'RECOVERING', claimed_at = NOW()
     WHERE app_id = :appId AND client_order_id = :clientOrderId AND status = 'FORWARDING'`,
    { appId, clientOrderId }
  );
  return result.affectedRows === 1;
}

async function resetToPendingCreationForRetry(transactionId) {
  const [result] = await pool.query(
    `UPDATE transactions SET status = 'PENDING_CREATION' WHERE id = :transactionId AND status = 'RECOVERING'`,
    { transactionId }
  );
  return result.affectedRows === 1;
}

async function markSupersededOrphaned(transactionId, chapaVerifyPayload) {
  await pool.query(
    `UPDATE transactions
     SET status = 'SUPERSEDED_ORPHANED_ON_GATEWAY', error_detail = :detail
     WHERE id = :transactionId`,
    { transactionId, detail: JSON.stringify(chapaVerifyPayload || {}) }
  );
}

async function getStaleForwarding(minutesOld) {
  const [rows] = await pool.query(
    `SELECT * FROM transactions
     WHERE status = 'FORWARDING' AND created_at < NOW() - INTERVAL :minutesOld MINUTE`,
    { minutesOld }
  );
  return rows;
}

async function getStaleRecovering(secondsOld) {
  const [rows] = await pool.query(
    `SELECT * FROM transactions
     WHERE status = 'RECOVERING' AND claimed_at < NOW() - INTERVAL :secondsOld SECOND`,
    { secondsOld }
  );
  return rows;
}

async function reclaimStaleRecovering(transactionId, secondsOld) {
  const [result] = await pool.query(
    `UPDATE transactions SET claimed_at = NOW()
     WHERE id = :transactionId AND status = 'RECOVERING'
       AND claimed_at < NOW() - INTERVAL :secondsOld SECOND`,
    { transactionId, secondsOld }
  );
  return result.affectedRows === 1;
}

async function getStaleInitialized(minutesOld) {
  const [rows] = await pool.query(
    `SELECT * FROM transactions
     WHERE status = 'INITIALIZED' AND updated_at < NOW() - INTERVAL :minutesOld MINUTE`,
    { minutesOld }
  );
  return rows;
}

async function markPaidIfStillInitialized(transactionId, detail) {
  const [result] = await pool.query(
    `UPDATE transactions SET status = 'PAID', error_detail = :detail
     WHERE id = :transactionId AND status = 'INITIALIZED'`,
    { transactionId, detail: JSON.stringify(detail || {}) }
  );
  return result.affectedRows === 1;
}

async function markFailedIfStillInitialized(transactionId, detail) {
  const [result] = await pool.query(
    `UPDATE transactions SET status = 'FAILED', error_detail = :detail
     WHERE id = :transactionId AND status = 'INITIALIZED'`,
    { transactionId, detail: JSON.stringify(detail || {}) }
  );
  return result.affectedRows === 1;
}

async function getUnresolvedSuperseded() {
  const [rows] = await pool.query(
    `SELECT * FROM transactions WHERE status IN ('SUPERSEDED', 'SUPERSEDED_ORPHANED_ON_GATEWAY')`
  );
  return rows;
}

async function markAbortedIfSuperseded(transactionId) {
  const [result] = await pool.query(
    `UPDATE transactions SET status = 'ABORTED'
     WHERE id = :transactionId AND status IN ('SUPERSEDED', 'SUPERSEDED_ORPHANED_ON_GATEWAY')`,
    { transactionId }
  );
  return result.affectedRows === 1;
}

async function annotateConfirmedOrphan(transactionId, detail) {
  await pool.query(
    `UPDATE transactions SET error_detail = :detail
     WHERE id = :transactionId AND status IN ('SUPERSEDED', 'SUPERSEDED_ORPHANED_ON_GATEWAY')`,
    { transactionId, detail: JSON.stringify(detail || {}) }
  );
}

async function listTransactions({ status, search, limit, offset }) {
  const params = { limit, offset };
  const clauses = [];
  if (status) {
    clauses.push('t.status = :status');
    params.status = status;
  }
  if (search) {
    clauses.push('(t.client_order_id LIKE :search OR t.chapa_tx_ref LIKE :search)');
    params.search = `%${search}%`;
  }
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT t.id, t.client_order_id, t.attempt_count, t.status, t.amount, t.currency, t.created_at, t.chapa_tx_ref, a.name AS app_name
     FROM transactions t
     JOIN applications a ON a.id = t.app_id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT :limit OFFSET :offset`,
    params
  );
  return rows;
}

async function countTransactions({ status, search }) {
  const params = {};
  const clauses = [];
  if (status) {
    clauses.push('status = :status');
    params.status = status;
  }
  if (search) {
    clauses.push('(client_order_id LIKE :search OR chapa_tx_ref LIKE :search)');
    params.search = `%${search}%`;
  }
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM transactions ${whereClause}`,
    params
  );
  return rows[0]?.count || 0;
}

async function countTransactionsByApp(appId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM transactions WHERE app_id = :appId`,
    { appId }
  );
  return rows[0]?.count || 0;
}

module.exports = {
  getLatestAttempt,
  getById,
  getByChapaTxRef,
  insertPendingCreation,
  insertNextAttemptWithRetry,
  markForwarding,
  markInitialized,
  markFailed,
  markPaid,
  claimForRecovery,
  resetToPendingCreationForRetry,
  markSupersededOrphaned,
  getStaleForwarding,
  getStaleRecovering,
  reclaimStaleRecovering,
  getStaleInitialized,
  markPaidIfStillInitialized,
  markFailedIfStillInitialized,
  getUnresolvedSuperseded,
  markAbortedIfSuperseded,
  annotateConfirmedOrphan,
  listTransactions,
  countTransactions,
  countTransactionsByApp,
};
