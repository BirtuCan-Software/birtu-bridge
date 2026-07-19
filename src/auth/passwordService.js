// src/auth/passwordService.js
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(hash, password) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
