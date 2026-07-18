// src/clients/chapaClient.js
const config = require('../config');
const sleep = require('../utils/sleep');

class ChapaTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChapaTimeoutError';
  }
}

class ChapaNetworkError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ChapaNetworkError';
    this.cause = cause;
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.chapa.timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ChapaTimeoutError(`Chapa request timed out after ${config.chapa.timeoutMs}ms`);
    }
    throw new ChapaNetworkError('Chapa request failed', err);
  } finally {
    clearTimeout(timeout);
  }
}

async function initializeTransaction({
  txRef,
  amount,
  currency,
  email,
  firstName,
  lastName,
  callbackUrl,
  returnUrl,
}) {
  const response = await fetchWithTimeout(`${config.chapa.apiBase}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.chapa.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(amount),
      currency: currency || 'ETB',
      email,
      first_name: firstName || 'Customer',
      last_name: lastName || 'Customer',
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
    }),
  });

  const body = await safeJson(response);

  return {
    httpStatus: response.status,
    ok: response.ok && body?.status === 'success',
    checkoutUrl: body?.data?.checkout_url || null,
    isDuplicateTxRefError: isDuplicateTxRefError(response.status, body),
    raw: body,
  };
}

async function verifyTransaction(txRef) {
  const response = await fetchWithTimeout(
    `${config.chapa.apiBase}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.chapa.secretKey}`,
      },
    }
  );

  const body = await safeJson(response);

  return {
    httpStatus: response.status,
    found: response.status === 200 && body?.status === 'success',
    notFound: response.status === 404,
    paymentStatus: body?.data?.status || null,
    raw: body,
  };
}

/**
 * Verify-first gate: a single 404 is not proof of non-existence (indexing lag is real).
 * Retries up to `maxRetries` additional times before trusting an absence.
 */
async function verifyWithRetries(txRef, { maxRetries = 2, delayMs = 2000 } = {}) {
  let lastResult;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await verifyTransaction(txRef);
    if (!lastResult.notFound) return lastResult;
    if (attempt < maxRetries) await sleep(delayMs);
  }
  return lastResult;
}

function isDuplicateTxRefError(httpStatus, body) {
  if (httpStatus !== 400) return false;
  const message = JSON.stringify(body || {}).toLowerCase();
  return message.includes('used before') || message.includes('already exist') || message.includes('duplicate');
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWithRetries,
  ChapaTimeoutError,
  ChapaNetworkError,
};
