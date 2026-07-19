// src/services/adminUserService.js
const { pool } = require('../db/pool');
const { generateUuid } = require('../utils/crypto');
const passwordService = require('../auth/passwordService');

async function createAdminUser(email, password) {
  const passwordHash = await passwordService.hashPassword(password);
  const id = generateUuid();
  await pool.query(
    `INSERT INTO admin_users (id, email, password_hash) VALUES (:id, :email, :passwordHash)`,
    { id, email, passwordHash }
  );
  return { id, email };
}

async function findActiveByEmail(email) {
  const [rows] = await pool.query(
    `SELECT * FROM admin_users WHERE email = :email AND status = 'active'`,
    { email }
  );
  return rows[0] || null;
}

async function updateLastLogin(id) {
  await pool.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = :id`, { id });
}

module.exports = { createAdminUser, findActiveByEmail, updateLastLogin };
