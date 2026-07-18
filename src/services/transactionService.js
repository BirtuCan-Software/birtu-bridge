// src/services/transactionService.js
const config = require('../config');
const chapaClient = require('../clients/chapaClient');
const txnRepo = require('../repositories/transactionRepo');
const redirectWhitelistService = require('./redirectWhitelistService');
const recoveryService = require('./recoveryService');
const circuitBreakerService = require('./circuitBreakerService');
const { generateChapaTxRef } = require('../utils/crypto');

const TERMINAL_RETRYABLE_STATES = ['FAILED', 'ABORTED'];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

async function initializeTransaction({ app, input }) {
  const { clientOrderId, amount, currency, customerEmail, returnUrl, firstName, lastName } = input;

  if (!clientOrderId || typeof clientOrderId !== 'string') {
    throw new ValidationError('clientOrderId is required');
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new ValidationError('amount must be a positive number');
  }
  if (!customerEmail) {
    throw new ValidationError('customerEmail is required');
  }

  const returnUrlAllowed = await redirectWhitelistService.isReturnUrlAllowed(app.id, returnUrl);
  if (!returnUrlAllowed) {
    throw new ValidationError('returnUrl is not in this application\'s registered redirect whitelist');
  }

  const existing = await txnRepo.getLatestAttempt(app.id, clientOrderId);

  if (existing) {
    if (existing.status === 'INITIALIZED') {
      return {
        status: 'INITIALIZED',
        checkoutUrl: existing.checkout_url,
        chapaTxRef: existing.chapa_tx_ref,
        attemptCount: existing.attempt_count,
      };
    }

    if (existing.status === 'FORWARDING' || existing.status === 'RECOVERING') {
      const settled = await recoveryService.recoverOrWait(app.id, existing);

      if (settled.status === 'INITIALIZED') {
        return {
          status: 'INITIALIZED',
          checkoutUrl: settled.checkout_url,
          chapaTxRef: settled.chapa_tx_ref,
          attemptCount: settled.attempt_count,
        };
      }

      if (settled.status === 'FAILED') {
        const err = new Error('Payment gateway rejected the transaction.');
        err.statusCode = 502;
        err.detail = settled.error_detail;
        throw err;
      }

      const err = new Error('Unexpected transaction state during recovery.');
      err.statusCode = 500;
      throw err;
    }

    if (!TERMINAL_RETRYABLE_STATES.includes(existing.status)) {
      const err = new Error(`Order is already in a non-retryable state: ${existing.status}`);
      err.statusCode = 409;
      throw err;
    }
  }

  const attemptCount = existing ? existing.attempt_count + 1 : 1;
  const chapaTxRef = generateChapaTxRef(app.id, clientOrderId, attemptCount);
  const callbackUrl = `${config.publicBaseUrl}/v1/webhooks/chapa`;

  const transactionId = await txnRepo.insertPendingCreation({
    appId: app.id,
    clientOrderId,
    attemptCount,
    chapaTxRef,
    amount: Number(amount),
    currency: currency || 'ETB',
    customerEmail,
    returnUrl,
  });

  await txnRepo.markForwarding(transactionId);

  let chapaResult;
  try {
    const statusAtEntry = await circuitBreakerService.readStatus();
    chapaResult = await circuitBreakerService.guardedCall(statusAtEntry, () =>
      chapaClient.initializeTransaction({
        txRef: chapaTxRef,
        amount: Number(amount),
        currency: currency || 'ETB',
        email: customerEmail,
        firstName,
        lastName,
        callbackUrl,
        returnUrl,
      })
    );
  } catch (err) {
    if (err instanceof circuitBreakerService.CircuitOpenError) {
      throw err;
    }
    const transientErr = new Error(
      'Payment gateway did not respond in time. Please retry this request.'
    );
    transientErr.statusCode = 504;
    transientErr.retryAfterSeconds = 5;
    throw transientErr;
  }

  if (chapaResult.ok && chapaResult.checkoutUrl) {
    await txnRepo.markInitialized(transactionId, {
      chapaReference: chapaResult.raw?.data?.reference || null,
      checkoutUrl: chapaResult.checkoutUrl,
    });
    return {
      status: 'INITIALIZED',
      checkoutUrl: chapaResult.checkoutUrl,
      chapaTxRef,
      attemptCount,
    };
  }

  await txnRepo.markFailed(transactionId, {
    httpStatus: chapaResult.httpStatus,
    raw: chapaResult.raw,
  });
  const err = new Error('Payment gateway rejected the transaction.');
  err.statusCode = 502;
  err.detail = chapaResult.raw;
  throw err;
}

module.exports = { initializeTransaction, ValidationError };
