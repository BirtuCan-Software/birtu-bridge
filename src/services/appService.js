// src/services/appService.js
const { pool } = require('../db/pool');
const { generateUuid, generateApiKey, sha256Hex } = require('../utils/crypto');
const auditService = require('./auditService');

async function createApplication({ name, environment, webhookUrl }) {
  const id = generateUuid();
  await pool.query(
    `INSERT INTO applications (id, name, environment, webhook_url, status)
     VALUES (:id, :name, :environment, :webhookUrl, 'active')`,
    { id, name, environment, webhookUrl: webhookUrl || null }
  );
  await auditService.logEvent(id, 'APPLICATION_CREATED', { name, environment });
  return { id, name, environment, webhookUrl: webhookUrl || null };
}

async function getApplication(appId) {
  const [rows] = await pool.query(
    `SELECT id, name, environment, webhook_url, status, created_at
     FROM applications WHERE id = :appId`,
    { appId }
  );
  return rows[0] || null;
}

async function createApiKey(appId, environment) {
  const app = await getApplication(appId);
  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  const id = generateUuid();
  const { fullKey, keyHash, keyPrefix } = generateApiKey(environment || app.environment);

  await pool.query(
    `INSERT INTO api_keys (id, app_id, key_hash, key_prefix, status)
     VALUES (:id, :appId, :keyHash, :keyPrefix, 'active')`,
    { id, appId, keyHash, keyPrefix }
  );

  await auditService.logEvent(appId, 'API_KEY_CREATED', { keyId: id, keyPrefix });

  // fullKey is returned exactly once. It is never retrievable again after this response.
  return { id, keyPrefix, fullKey };
}

async function revokeApiKey(appId, keyId) {
  const [result] = await pool.query(
    `UPDATE api_keys SET status = 'revoked', revoked_at = NOW()
     WHERE id = :keyId AND app_id = :appId AND status = 'active'`,
    { keyId, appId }
  );
  if (result.affectedRows === 1) {
    await auditService.logEvent(appId, 'API_KEY_REVOKED', { keyId });
  }
  return result.affectedRows === 1;
}

async function updateWebhookUrl(appId, webhookUrl) {
  const [result] = await pool.query(
    `UPDATE applications SET webhook_url = :webhookUrl WHERE id = :appId`,
    { appId, webhookUrl }
  );
  if (result.affectedRows === 1) {
    await auditService.logEvent(appId, 'WEBHOOK_URL_UPDATED', { webhookUrl });
  }
  return result.affectedRows === 1;
}

async function addRedirectWhitelistEntry(appId, { protocol, hostname, allowSubdomainWildcard }) {
  await pool.query(
    `INSERT INTO app_redirect_whitelist (app_id, protocol, hostname, allow_subdomain_wildcard)
     VALUES (:appId, :protocol, :hostname, :allowSubdomainWildcard)`,
    {
      appId,
      protocol: protocol || 'https:',
      hostname,
      allowSubdomainWildcard: allowSubdomainWildcard ? 1 : 0,
    }
  );
  await auditService.logEvent(appId, 'REDIRECT_WHITELIST_ADDED', { hostname });
}

module.exports = {
  createApplication,
  getApplication,
  createApiKey,
  revokeApiKey,
  addRedirectWhitelistEntry,
  updateWebhookUrl,
};
