// scripts/run-dlq-digest.js
const { pool } = require('../src/db/pool');
const jobLockService = require('../src/services/jobLockService');
const mailer = require('../src/utils/mailer');

const JOB_NAME = 'dlq_digest';

async function run() {
  const acquired = await jobLockService.acquireLock(JOB_NAME);
  if (!acquired) {
    console.log(`Lock not acquired for ${JOB_NAME}. Exiting.`);
    return;
  }

  try {
    const [rows] = await pool.query(
      `SELECT df.id, df.app_id, df.reason, df.created_at, a.name AS app_name
       FROM dlq_failures df
       JOIN applications a ON a.id = df.app_id
       WHERE df.digested_at IS NULL
       ORDER BY df.created_at ASC`
    );

    if (rows.length === 0) {
      console.log('No new DLQ failures to digest.');
      return;
    }

    const lines = rows.map(
      (r) => `- [${r.created_at}] app="${r.app_name}" (${r.app_id}) reason="${r.reason}"`
    );
    const body = `${rows.length} webhook delivery failure(s) since the last digest:\n\n${lines.join('\n')}`;

    await mailer.sendDigestEmail(`Birtu Bridge: ${rows.length} delivery failure(s)`, body);

    const ids = rows.map((r) => r.id);
    await pool.query(`UPDATE dlq_failures SET digested_at = NOW() WHERE id IN (:ids)`, { ids });

    console.log(`Digested ${rows.length} DLQ failure(s).`);
  } finally {
    await jobLockService.releaseLock(JOB_NAME);
    await pool.end();
  }
}

run().catch((err) => {
  console.error('DLQ digest failed:', err);
  process.exit(1);
});
