// src/routes/admin.js
const appService = require('../services/appService');
const adminAuth = require('../middleware/adminAuth');

async function adminRoutes(fastify) {
  fastify.addHook('preHandler', adminAuth);

  fastify.post('/admin/applications', async (request, reply) => {
    const { name, environment, webhookUrl } = request.body || {};
    if (!name || !['sandbox', 'production'].includes(environment)) {
      reply.code(400);
      return { error: 'name and environment ("sandbox" or "production") are required' };
    }
    const app = await appService.createApplication({ name, environment, webhookUrl });
    reply.code(201);
    return app;
  });

  fastify.get('/admin/applications/:appId', async (request, reply) => {
    const app = await appService.getApplication(request.params.appId);
    if (!app) {
      reply.code(404);
      return { error: 'Application not found' };
    }
    return app;
  });

  fastify.post('/admin/applications/:appId/api-keys', async (request, reply) => {
    try {
      const key = await appService.createApiKey(request.params.appId);
      reply.code(201);
      return {
        id: key.id,
        keyPrefix: key.keyPrefix,
        apiKey: key.fullKey,
        warning:
          'This is the only time the full API key is shown. Store it securely now.',
      };
    } catch (err) {
      reply.code(err.statusCode || 500);
      return { error: err.message };
    }
  });

  fastify.post('/admin/applications/:appId/api-keys/:keyId/revoke', async (request, reply) => {
    const revoked = await appService.revokeApiKey(request.params.appId, request.params.keyId);
    if (!revoked) {
      reply.code(404);
      return { error: 'Active API key not found for this application' };
    }
    return { revoked: true };
  });

  fastify.patch('/admin/applications/:appId/webhook-url', async (request, reply) => {
    const { webhookUrl } = request.body || {};
    if (!webhookUrl) {
      reply.code(400);
      return { error: 'webhookUrl is required' };
    }
    const updated = await appService.updateWebhookUrl(request.params.appId, webhookUrl);
    if (!updated) {
      reply.code(404);
      return { error: 'Application not found' };
    }
    return { updated: true };
  });

  fastify.post('/admin/applications/:appId/redirect-whitelist', async (request, reply) => {
    const { hostname, protocol, allowSubdomainWildcard } = request.body || {};
    if (!hostname) {
      reply.code(400);
      return { error: 'hostname is required' };
    }
    await appService.addRedirectWhitelistEntry(request.params.appId, {
      hostname,
      protocol,
      allowSubdomainWildcard,
    });
    reply.code(201);
    return { added: true };
  });
}

module.exports = adminRoutes;
