// src/utils/crypto.js
const crypto = require('crypto');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function generateApiKey(environment) {
  const envTag = environment === 'production' ? 'live' : 'test';
  const randomPart = crypto.randomBytes(32).toString('hex');
  const fullKey = `btb_${envTag}_${randomPart}`;
  const keyHash = sha256Hex(fullKey);
  const keyPrefix = fullKey.slice(0, 16);
  return { fullKey, keyHash, keyPrefix };
}

function generateUuid() {
  return crypto.randomUUID();
}

function timingSafeEqualHex(aHex, bHex) {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Deterministic per-attempt Chapa tx_ref: hash(app_id + client_order_id + attempt_count).
 */
function generateChapaTxRef(appId, clientOrderId, attemptCount) {
  const raw = `${appId}:${clientOrderId}:${attemptCount}`;
  const hash = sha256Hex(raw).slice(0, 24);
  return `btb_${hash}`;
}

module.exports = {
  sha256Hex,
  generateApiKey,
  generateUuid,
  timingSafeEqualHex,
  generateChapaTxRef,
};
