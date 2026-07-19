// src/auth/mysqlSessionStore.js
class MySQLSessionStore {
  constructor(pool) {
    this.pool = pool;
  }

  get(sessionId, callback) {
    this.pool
      .query(`SELECT session_data, expires_at FROM sessions WHERE session_id = :sessionId`, {
        sessionId,
      })
      .then(async ([rows]) => {
        const row = rows[0];
        if (!row) return callback(null, null);
        if (new Date(row.expires_at).getTime() < Date.now()) {
          await this.destroy(sessionId, () => {});
          return callback(null, null);
        }
        callback(null, JSON.parse(row.session_data));
      })
      .catch((err) => callback(err));
  }

  set(sessionId, session, callback) {
    const expiresAt =
      session.cookie && session.cookie.expires
        ? new Date(session.cookie.expires)
        : new Date(Date.now() + 12 * 3600 * 1000);

    this.pool
      .query(
        `INSERT INTO sessions (session_id, session_data, expires_at)
         VALUES (:sessionId, :data, :expiresAt)
         ON DUPLICATE KEY UPDATE session_data = :data, expires_at = :expiresAt`,
        { sessionId, data: JSON.stringify(session), expiresAt }
      )
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  destroy(sessionId, callback) {
    this.pool
      .query(`DELETE FROM sessions WHERE session_id = :sessionId`, { sessionId })
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  touch(sessionId, session, callback) {
    this.set(sessionId, session, callback);
  }
}

module.exports = MySQLSessionStore;
