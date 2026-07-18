// src/config/index.js
require('dotenv').config();

function requireEnv(name, fallback = undefined) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  db: {
    host: requireEnv('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    poolMax: parseInt(process.env.DB_POOL_MAX || '8', 10),
    connectTimeoutMs: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '10000', 10),
  },

  chapa: {
    secretKey: process.env.CHAPA_SECRET_KEY || '',
    webhookSecret: process.env.CHAPA_WEBHOOK_SECRET || '',
    apiBase: process.env.CHAPA_API_BASE || 'https://api.chapa.co/v1',
    timeoutMs: parseInt(process.env.CHAPA_TIMEOUT_MS || '7000', 10),
  },

  circuitBreaker: {
    cooldownSeconds: parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_SECONDS || '30', 10),
    probeStaleSeconds: parseInt(process.env.CIRCUIT_BREAKER_PROBE_STALE_SECONDS || '15', 10),
  },

  reconciler: {
    forwardingStaleMinutes: parseInt(process.env.RECONCILER_FORWARDING_STALE_MINUTES || '5', 10),
    recoveringStaleSeconds: parseInt(process.env.RECONCILER_RECOVERING_STALE_SECONDS || '15', 10),
    initializedStaleMinutes: parseInt(process.env.RECONCILER_INITIALIZED_STALE_MINUTES || '10', 10),
  },

  jobLockTtlMinutes: parseInt(process.env.JOB_LOCK_TTL_MINUTES || '5', 10),

  admin: {
    token: requireEnv('ADMIN_TOKEN'),
  },

  rateLimit: {
    perMinutePerKey: parseInt(process.env.RATE_LIMIT_PER_MINUTE_PER_KEY || '60', 10),
    perMinutePerIp: parseInt(process.env.RATE_LIMIT_PER_MINUTE_PER_IP || '20', 10),
  },

  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',

  webhookSignatureHeader: process.env.CHAPA_WEBHOOK_SIGNATURE_HEADER || 'Chapa-Signature',

  delivery: {
    maxAttempts: parseInt(process.env.DELIVERY_MAX_ATTEMPTS || '8', 10),
    backoffBaseSeconds: parseInt(process.env.DELIVERY_BACKOFF_BASE_SECONDS || '5', 10),
    timeoutMs: parseInt(process.env.DELIVERY_TIMEOUT_MS || '8000', 10),
  },

  alerting: {
    emailTo: process.env.ALERT_EMAIL_TO || '',
    emailFrom: process.env.ALERT_EMAIL_FROM || 'no-reply@birtu-bridge.local',
  },
};

module.exports = config;
