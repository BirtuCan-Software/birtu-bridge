// src/services/jobLockService.js
const { pool } = require('../db/pool');
const config = require('../config');

async function acquireLock(jobName, ttlMinutes = config.jobLockTtlMinutes) {
  const [result] = await pool.query(
    `INSERT INTO job_locks (job_name, locked_at, expires_at)
     VALUES (:jobName, NOW(), NOW() + INTERVAL :ttlMinutes MINUTE)
     ON DUPLICATE KEY UPDATE
       locked_at = IF(expires_at < NOW(), NOW(), locked_at),
       expires_at = IF(expires_at < NOW(), NOW() + INTERVAL :ttlMinutes MINUTE, expires_at)`,
    { jobName, ttlMinutes }
  );
  return result.affectedRows === 1 || result.affectedRows === 2;
}

async function releaseLock(jobName) {
  await pool.query(`DELETE FROM job_locks WHERE job_name = :jobName`, { jobName });
}

module.exports = { acquireLock, releaseLock };
