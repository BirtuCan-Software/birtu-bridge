// src/services/redirectWhitelistService.js
const { pool } = require('../db/pool');

function failsPreParseSanitization(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return true;

  if (rawUrl.includes('\\')) return true;

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(rawUrl)) return true;

  const schemeSplit = rawUrl.split('://');
  if (schemeSplit.length === 2) {
    const afterScheme = schemeSplit[1];
    const firstSlash = afterScheme.indexOf('/');
    const authorityPart = firstSlash === -1 ? afterScheme : afterScheme.slice(0, firstSlash);
    if (authorityPart.includes('@')) return true;
  }

  if (schemeSplit.length === 2) {
    const afterScheme = schemeSplit[1];
    const firstSlash = afterScheme.indexOf('/');
    const hostGuess = firstSlash === -1 ? afterScheme : afterScheme.slice(0, firstSlash);
    if (hostGuess.includes('%')) return true;
  }

  return false;
}

async function isReturnUrlAllowed(appId, returnUrl) {
  if (!returnUrl) return true;

  if (failsPreParseSanitization(returnUrl)) return false;

  let parsed;
  try {
    parsed = new URL(returnUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  if (parsed.username || parsed.password) return false;

  const [rows] = await pool.query(
    `SELECT hostname, allow_subdomain_wildcard FROM app_redirect_whitelist WHERE app_id = :appId`,
    { appId }
  );

  return rows.some((rule) => {
    if (rule.hostname === parsed.hostname) return true;
    if (rule.allow_subdomain_wildcard && parsed.hostname.endsWith(`.${rule.hostname}`)) {
      return true;
    }
    return false;
  });
}

module.exports = { isReturnUrlAllowed, failsPreParseSanitization };
