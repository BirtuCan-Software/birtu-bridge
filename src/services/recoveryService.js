// src/services/recoveryService.js
const config = require('../config');
const chapaClient = require('../clients/chapaClient');
const txnRepo = require('../repositories/transactionRepo');
const circuitBreakerService = require('./circuitBreakerService');
const { generateChapaTxRef } = require('../utils/crypto');
const sleep = require('../utils/sleep');

const LOSER_POLL_MAX_ITERATIONS = 7;
const LOSER_POLL_INTERVAL_MS = 1500;

class StillProcessingError extends Error {
  constructor() {
    super('A previous request for this order is still being processed. Please retry shortly.');
    this.statusCode = 202;
    this.retryAfterSeconds = 5;
  }
}

async function recoverOrWait(appId, existingRow) {
  const won = await txnRepo.claimForRecovery(appId, existingRow.client_order_id);

  if (won) {
    const claimedRow = await txnRepo.getById(existingRow.id);
    return runRecoveryAsWinner(appId, claimedRow);
  }

  return pollForSettledState(appId, existingRow.client_order_id);
}

async function runRecoveryAsWinner(appId, transactionRow) {
  const verifyResult = await chapaClient.verifyWithRetries(transactionRow.chapa_tx_ref);

  if (verifyResult.notFound) {
    return recoverBranchA(appId, transactionRow);
  }

  return recoverBranchB(appId, transactionRow, verifyResult);
}

async function recoverBranchA(appId, transactionRow) {
  await txnRepo.resetToPendingCreationForRetry(transactionRow.id);
  await txnRepo.markForwarding(transactionRow.id);

  let chapaResult;
  try {
    const statusAtEntry = await circuitBreakerService.readStatus();
    chapaResult = await circuitBreakerService.guardedCall(statusAtEntry, () =>
      chapaClient.initializeTransaction({
        txRef: transactionRow.chapa_tx_ref,
        amount: transactionRow.amount,
        currency: transactionRow.currency,
        email: transactionRow.customer_email,
        callbackUrl: `${config.publicBaseUrl}/v1/webhooks/chapa`,
        returnUrl: transactionRow.return_url,
      })
    );
  } catch (err) {
    if (err instanceof circuitBreakerService.CircuitOpenError) throw err;
    throw new StillProcessingError();
  }

  if (chapaResult.isDuplicateTxRefError) {
    return recoverBranchB(appId, transactionRow, null);
  }

  if (chapaResult.ok && chapaResult.checkoutUrl) {
    await txnRepo.markInitialized(transactionRow.id, {
      chapaReference: chapaResult.raw?.data?.reference || null,
      checkoutUrl: chapaResult.checkoutUrl,
    });
    return txnRepo.getById(transactionRow.id);
  }

  await txnRepo.markFailed(transactionRow.id, {
    httpStatus: chapaResult.httpStatus,
    raw: chapaResult.raw,
  });
  return txnRepo.getById(transactionRow.id);
}

async function recoverBranchB(appId, transactionRow, verifyResult) {
  await txnRepo.markSupersededOrphaned(
    transactionRow.id,
    verifyResult?.raw || { note: 'discovered via duplicate-tx_ref rejection during Branch A retry' }
  );

  const nextAttemptBase = transactionRow.attempt_count + 1;
  const { transactionId, chapaTxRef } = await txnRepo.insertNextAttemptWithRetry({
    appId,
    clientOrderId: transactionRow.client_order_id,
    baseAttemptCount: nextAttemptBase,
    amount: transactionRow.amount,
    currency: transactionRow.currency,
    customerEmail: transactionRow.customer_email,
    returnUrl: transactionRow.return_url,
    generateTxRefFn: (attempt) => generateChapaTxRef(appId, transactionRow.client_order_id, attempt),
  });

  await txnRepo.markForwarding(transactionId);

  let chapaResult;
  try {
    const statusAtEntry = await circuitBreakerService.readStatus();
    chapaResult = await circuitBreakerService.guardedCall(statusAtEntry, () =>
      chapaClient.initializeTransaction({
        txRef: chapaTxRef,
        amount: transactionRow.amount,
        currency: transactionRow.currency,
        email: transactionRow.customer_email,
        callbackUrl: `${config.publicBaseUrl}/v1/webhooks/chapa`,
        returnUrl: transactionRow.return_url,
      })
    );
  } catch (err) {
    if (err instanceof circuitBreakerService.CircuitOpenError) throw err;
    throw new StillProcessingError();
  }

  if (chapaResult.ok && chapaResult.checkoutUrl) {
    await txnRepo.markInitialized(transactionId, {
      chapaReference: chapaResult.raw?.data?.reference || null,
      checkoutUrl: chapaResult.checkoutUrl,
    });
    return txnRepo.getById(transactionId);
  }

  await txnRepo.markFailed(transactionId, {
    httpStatus: chapaResult.httpStatus,
    raw: chapaResult.raw,
  });
  return txnRepo.getById(transactionId);
}

async function pollForSettledState(appId, clientOrderId) {
  for (let i = 0; i < LOSER_POLL_MAX_ITERATIONS; i++) {
    await sleep(LOSER_POLL_INTERVAL_MS);
    const latest = await txnRepo.getLatestAttempt(appId, clientOrderId);
    if (latest && (latest.status === 'INITIALIZED' || latest.status === 'FAILED')) {
      return latest;
    }
  }
  throw new StillProcessingError();
}

module.exports = { recoverOrWait, runRecoveryAsWinner, StillProcessingError };
