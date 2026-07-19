// src/middleware/requireAuth.js
async function requireAuth(request, reply) {
  const adminUserId = request.session.get('adminUserId');
  if (!adminUserId) {
    reply.redirect('/ui/login');
    return reply;
  }
  request.adminUserId = adminUserId;
}

module.exports = requireAuth;
