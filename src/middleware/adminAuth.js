// src/middleware/adminAuth.js
const config = require('../config');

async function adminAuth(request, reply) {
  const token = request.headers['x-admin-token'];
  if (!token || token !== config.admin.token) {
    reply.code(403).send({ error: 'Forbidden' });
    return reply;
  }
}

module.exports = adminAuth;
