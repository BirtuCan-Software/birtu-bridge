// src/routes/ui/auth.js
const adminUserService = require('../../services/adminUserService');
const passwordService = require('../../auth/passwordService');
const loginRateLimiter = require('../../services/loginRateLimiter');
const { renderLoginPage } = require('../../views/pages/login');

async function authRoutes(fastify) {
  fastify.get('/ui/login', async (request, reply) => {
    if (request.session.get('adminUserId')) {
      return reply.redirect('/ui');
    }
    const csrfToken = await reply.generateCsrf();
    reply.type('text/html');
    return renderLoginPage({ csrfToken, error: null });
  });

  fastify.post('/ui/login', { preHandler: fastify.csrfProtection }, async (request, reply) => {
    const { email, password } = request.body || {};
    const identifier = (email || 'unknown').toLowerCase();

    const limited = await loginRateLimiter.isLoginRateLimited(identifier);
    if (limited) {
      const csrfToken = await reply.generateCsrf();
      reply.code(429).type('text/html');
      return renderLoginPage({ csrfToken, error: 'Too many login attempts. Please wait a minute and try again.' });
    }

    const user = email ? await adminUserService.findActiveByEmail(email) : null;
    const passwordOk = user ? await passwordService.verifyPassword(user.password_hash, password || '') : false;

    if (!user || !passwordOk) {
      const csrfToken = await reply.generateCsrf();
      reply.code(401).type('text/html');
      return renderLoginPage({ csrfToken, error: 'Invalid email or password.' });
    }

    request.session.set('adminUserId', user.id);
    await adminUserService.updateLastLogin(user.id);
    return reply.redirect('/ui');
  });

  fastify.post('/ui/logout', async (request, reply) => {
    request.session.delete();
    return reply.redirect('/ui/login');
  });
}

module.exports = authRoutes;
