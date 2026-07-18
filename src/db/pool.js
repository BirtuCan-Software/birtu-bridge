// src/db/pool.js
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.poolMax,
  queueLimit: 0,
  connectTimeout: config.db.connectTimeoutMs,
  // Explicitly disabled: multi-statement batching widens SQL-injection blast radius.
  multipleStatements: false,
  namedPlaceholders: true,
});

async function healthCheck() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
    return true;
  } finally {
    conn.release();
  }
}

module.exports = { pool, healthCheck };
