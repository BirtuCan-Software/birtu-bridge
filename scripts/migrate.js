// scripts/migrate.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getAppliedMigrations(conn) {
  const [rows] = await conn.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function runMigrations() {
  const conn = await pool.getConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`SKIP  ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(`APPLY ${file}`);
      for (const statement of statements) {
        await conn.query(statement);
      }

      await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    }

    console.log('Migrations complete.');
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
