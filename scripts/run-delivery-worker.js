// scripts/run-delivery-worker.js
const config = require('../src/config');
const { pool } = require('../src/db/pool');
const jobLockService = require('../src/services/jobLockService');

const JOB_NAME = 'webhook_delivery_worker';
const BATCH_SIZE = 20;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getDueJobs() {
  const [rows] = await pool.query(
    `SELECT dq.*, a.webhook_url
     FROM webhook_delivery_queue dq
     JOIN applications a ON a.id = dq.app_id
     WHERE dq.status IN ('PENDING', 'RETRYING') AND dq.next_attempt_at <= NOW()
     ORDER BY dq.next_attempt_at ASC
     LIMIT :limit`,
    { limit: BATCH_SIZE }
  );
  return rows;
}

async function markDelivered(jobId) {
  await pool.query(`UPDATE webhook_delivery_queue SET status = 'DELIVERED' WHERE id = :jobId`, {
    jobId,
  });
}

async function scheduleRetry(jobId, nextAttemptCount) {
  const delaySeconds = config.delivery.backoffBaseSeconds * Math.pow(2, nextAttemptCount);
  await pool.query(
    `UPDATE webhook_delivery_queue
     SET status = 'RETRYING', attempt_count = :attemptCount, next_attempt_at = NOW() + INTERVAL :delaySeconds SECOND
     WHERE id = :jobId`,
    { jobId, attemptCount: nextAttemptCount, delaySeconds }
  );
}

async function moveToDlq(jobId, appId, reason) {
  await pool.query(`UPDATE webhook_delivery_queue SET status = 'FAILED_DLQ' WHERE id = :jobId`, {
    jobId,
  });
  await pool.query(
    `INSERT INTO dlq_failures (delivery_id, app_id, reason) VALUES (:jobId, :appId, :reason)`,
    { jobId, appId, reason: String(reason).slice(0, 1000) }
  );
}

async function processJob(job) {
  if (!job.webhook_url) {
    await moveToDlq(job.id, job.app_id, 'Application has no webhook_url configured');
    return;
  }

  try {
    const response = await fetchWithTimeout(
      job.webhook_url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof job.payload === 'string' ? job.payload : JSON.stringify(job.payload),
      },
      config.delivery.timeoutMs
    );

    if (response.ok) {
      await markDelivered(job.id);
      console.log(`DELIVERED job=${job.id} tx_ref=${job.tx_ref}`);
      return;
    }

    await handleFailure(job, `Client app responded with HTTP ${response.status}`);
  } catch (err) {
    await handleFailure(job, err.message || 'Unknown delivery error');
  }
}

async function handleFailure(job, reason) {
  const nextAttemptCount = job.attempt_count + 1;
  if (nextAttemptCount >= config.delivery.maxAttempts) {
    await moveToDlq(job.id, job.app_id, reason);
    console.log(`DLQ job=${job.id} tx_ref=${job.tx_ref} reason="${reason}"`);
  } else {
    await scheduleRetry(job.id, nextAttemptCount);
    console.log(
      `RETRY scheduled job=${job.id} tx_ref=${job.tx_ref} attempt=${nextAttemptCount} reason="${reason}"`
    );
  }
}

async function run() {
  const acquired = await jobLockService.acquireLock(JOB_NAME);
  if (!acquired) {
    console.log(`Lock not acquired for ${JOB_NAME}, another run is in progress. Exiting.`);
    return;
  }

  try {
    const jobs = await getDueJobs();
    console.log(`Processing ${jobs.length} due delivery job(s).`);
    for (const job of jobs) {
      await processJob(job);
    }
  } finally {
    await jobLockService.releaseLock(JOB_NAME);
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Delivery worker failed:', err);
  process.exit(1);
});
