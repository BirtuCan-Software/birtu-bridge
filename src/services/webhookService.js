// src/services/webhookService.js
const crypto = require('crypto');
const config = require('../config');
const { pool } = require('../db/pool');
const chapaClient = require('../clients/chapaClient');
const txnRepo = require('../repositories/transactionRepo');
const deliveryQueueService = require('./deliveryQueueService');

class InvalidSignatureError extends Error {
  constructor() {
    super('Invalid webhook signature');
  }
}

function verifySignature(rawBody, signatureHeaderValue) {
  if (!signatureHeaderValue || !config.chapa.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', config.chapa.webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(String(signatureHeaderValue), 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

async function insertIncomingWebhookOrNoop(eventRef, payload) {
  try {
    const [result] = await pool.query(
      `INSERT INTO incoming_webhooks (event_ref, payload, status) VALUES (:eventRef, :payload, 'RECEIVED')`,
      { eventRef, payload: JSON.stringify(payload) }
    );
    return { isNew: true, webhookId: result.insertId };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return { isNew: false, webhookId: null };
    }
    throw err;
  }
}

async function markWebhookStatus(webhookId, status) {
  await pool.query(
    `UPDATE incoming_webhooks SET status = :status, processed_at = NOW() WHERE id = :webhookId`,
    { webhookId, status }
  );
}

async function processIncomingWebhook({ rawBody, signatureHeaderValue }) {
  if (!verifySignature(rawBody, signatureHeaderValue)) {
    throw new InvalidSignatureError();
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return { httpStatus: 400, body: { error: 'Invalid JSON payload' } };
  }

  const txRef = payload.tx_ref || payload.data?.tx_ref;
  if (!txRef) {
    return { httpStatus: 400, body: { error: 'Missing tx_ref in webhook payload' } };
  }

  const eventStatus = payload.status || payload.data?.status || 'unknown';
  const eventRef = `${txRef}:${eventStatus}`;

  const { isNew, webhookId } = await insertIncomingWebhookOrNoop(eventRef, payload);
  if (!isNew) {
    return { httpStatus: 200, body: { received: true, duplicate: true } };
  }

  const transaction = await txnRepo.getByChapaTxRef(txRef);
  if (!transaction) {
    await markWebhookStatus(webhookId, 'DISCARDED');
    return { httpStatus: 200, body: { received: true, matched: false } };
  }

  const verifyResult = await chapaClient.verifyTransaction(txRef);

  let eventType;
  if (verifyResult.found && verifyResult.paymentStatus === 'success') {
    await txnRepo.markPaid(transaction.id, verifyResult.raw);
    eventType = 'payment.success';
  } else {
    await txnRepo.markFailed(transaction.id, verifyResult.raw);
    eventType = 'payment.failed';
  }

  await markWebhookStatus(webhookId, 'PROCESSED');

  await deliveryQueueService.enqueueDelivery({
    txRef,
    eventType,
    appId: transaction.app_id,
    payload: {
      tx_ref: txRef,
      client_order_id: transaction.client_order_id,
      status: eventType === 'payment.success' ? 'success' : 'failed',
      amount: transaction.amount,
      currency: transaction.currency,
    },
  });

  return { httpStatus: 200, body: { received: true, matched: true } };
}

module.exports = { processIncomingWebhook, InvalidSignatureError };
