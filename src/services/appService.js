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

async function listApplications({ search } = {}) {
  const params = {};
  let whereClause = '';
  if (search) {
    whereClause = 'WHERE a.name LIKE :search';
    params.search = `%${search}%`;
  }
  const [rows] = await pool.query(
    `SELECT a.id, a.name, a.environment, a.status, a.created_at,
            (SELECT COUNT(*) FROM transactions t WHERE t.app_id = a.id) AS transaction_count
     FROM applications a
     ${whereClause}
     ORDER BY a.created_at DESC`,
    params
  );
  return rows;
}

async function getApplication(appId) {
  const [rows] = await pool.query(
    `SELECT id, name, environment, webhook_url, status, created_at
     FROM applications WHERE id = :appId`,
    { appId }
  );
  return rows[0] || null;
}

async function archiveApplication(appId) {
  const [result] = await pool.query(
    `UPDATE applications SET status = 'disabled' WHERE id = :appId AND status = 'active'`,
    { appId }
  );
  if (result.affectedRows === 1) {
    await auditService.logEvent(appId, 'APPLICATION_ARCHIVED', {});
  }
  return result.affectedRows === 1;
}

async function reactivateApplication(appId) {
  const [result] = await pool.query(
    `UPDATE applications SET status = 'active' WHERE id = :appId AND status = 'disabled'`,
    { appId }
  );
  if (result.affectedRows === 1) {
    await auditService.logEvent(appId, 'APPLICATION_REACTIVATED', {});
  }
  return result.affectedRows === 1;
}

async function hardDeleteApplication(appId) {
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS count FROM transactions WHERE app_id = :appId`,
    { appId }
  );
  if ((countRows[0]?.count || 0) > 0) {
    const err = new Error(
      'Cannot permanently delete an application with transaction history. Archive it instead.'
    );
    err.statusCode = 409;
    throw err;
  }
  await auditService.logEvent(appId, 'APPLICATION_DELETED', {});
  await pool.query(`DELETE FROM applications WHERE id = :appId`, { appId });
  return true;
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

  return { id, keyPrefix, fullKey };
}

async function listApiKeysForApp(appId) {
  const [rows] = await pool.query(
    `SELECT id, key_prefix, status, created_at, revoked_at FROM api_keys
     WHERE app_id = :appId ORDER BY created_at DESC`,
    { appId }
  );
  return rows;
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

async function listRedirectWhitelistForApp(appId) {
  const [rows] = await pool.query(
    `SELECT hostname, allow_subdomain_wildcard FROM app_redirect_whitelist
     WHERE app_id = :appId ORDER BY created_at DESC`,
    { appId }
  );
  return rows;
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

module.exports = {
  createApplication,
  listApplications,
  getApplication,
  archiveApplication,
  reactivateApplication,
  hardDeleteApplication,
  createApiKey,
  listApiKeysForApp,
  revokeApiKey,
  addRedirectWhitelistEntry,
  listRedirectWhitelistForApp,
  updateWebhookUrl,
};
