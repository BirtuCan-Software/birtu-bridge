// src/routes/ui/applications.js
const requireAuth = require('../../middleware/requireAuth');
const appService = require('../../services/appService');
const txnRepo = require('../../repositories/transactionRepo');
const { setFlash, popFlash } = require('../../utils/flash');
const { renderLayout } = require('../../views/layout');
const { renderApplicationsListBody } = require('../../views/pages/applicationsList');
const { renderApplicationDetailBody } = require('../../views/pages/applicationDetail');

async function applicationsRoutes(fastify) {
  fastify.get('/ui/applications', { preHandler: requireAuth }, async (request, reply) => {
    const search = request.query.q || '';
    const applications = await appService.listApplications({ search: search || null });
    const csrfToken = await reply.generateCsrf();
    const flash = popFlash(request);
    reply.type('text/html');
    return renderLayout({
      title: 'Applications',
      activeNav: 'applications',
      flash,
      bodyHtml: renderApplicationsListBody({ applications, csrfToken, search }),
    });
  });

  fastify.post(
    '/ui/applications',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const { name, environment } = request.body || {};
      if (!name || !['sandbox', 'production'].includes(environment)) {
        setFlash(request, 'error', 'Name and a valid environment are required.');
        return reply.redirect('/ui/applications');
      }
      await appService.createApplication({ name, environment });
      setFlash(request, 'success', `Application "${name}" created.`);
      return reply.redirect('/ui/applications');
    }
  );

  fastify.get('/ui/applications/:appId', { preHandler: requireAuth }, async (request, reply) => {
    const app = await appService.getApplication(request.params.appId);
    if (!app) {
      reply.code(404);
      return 'Application not found';
    }
    const apiKeys = await appService.listApiKeysForApp(app.id);
    const redirectRules = await appService.listRedirectWhitelistForApp(app.id);
    const transactionCount = await txnRepo.countTransactionsByApp(app.id);
    const csrfToken = await reply.generateCsrf();

    const newApiKey = request.session.get('flashApiKey') || null;
    request.session.set('flashApiKey', undefined);
    const flash = popFlash(request);

    reply.type('text/html');
    return renderLayout({
      title: app.name,
      activeNav: 'applications',
      flash,
      bodyHtml: renderApplicationDetailBody({
        app,
        apiKeys,
        redirectRules,
        csrfToken,
        newApiKey,
        transactionCount,
      }),
    });
  });

  fastify.post(
    '/ui/applications/:appId/api-keys',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const key = await appService.createApiKey(request.params.appId);
      request.session.set('flashApiKey', key.fullKey);
      return reply.redirect(`/ui/applications/${request.params.appId}`);
    }
  );

  fastify.post(
    '/ui/applications/:appId/api-keys/:keyId/revoke',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const revoked = await appService.revokeApiKey(request.params.appId, request.params.keyId);
      setFlash(request, revoked ? 'success' : 'error', revoked ? 'API key revoked.' : 'Key not found or already revoked.');
      return reply.redirect(`/ui/applications/${request.params.appId}`);
    }
  );

  fastify.post(
    '/ui/applications/:appId/redirect-whitelist',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const { hostname, allowSubdomainWildcard } = request.body || {};
      if (hostname) {
        await appService.addRedirectWhitelistEntry(request.params.appId, {
          hostname,
          allowSubdomainWildcard: allowSubdomainWildcard === 'true',
        });
        setFlash(request, 'success', `Added ${hostname} to the redirect whitelist.`);
      }
      return reply.redirect(`/ui/applications/${request.params.appId}`);
    }
  );

  fastify.post(
    '/ui/applications/:appId/webhook-url',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const { webhookUrl } = request.body || {};
      if (webhookUrl) {
        await appService.updateWebhookUrl(request.params.appId, webhookUrl);
        setFlash(request, 'success', 'Webhook URL updated.');
      }
      return reply.redirect(`/ui/applications/${request.params.appId}`);
    }
  );

  fastify.post(
    '/ui/applications/:appId/archive',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const archived = await appService.archiveApplication(request.params.appId);
      setFlash(
        request,
        archived ? 'success' : 'error',
        archived ? 'Application archived. Its API keys no longer authenticate.' : 'Could not archive application.'
      );
      return reply.redirect(`/ui/applications/${request.params.appId}`);
    }
  );

  fastify.post(
    '/ui/applications/:appId/reactivate',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const reactivated = await appService.reactivateApplication(request.params.appId);
      setFlash(
        request,
        reactivated ? 'success' : 'error',
        reactivated ? 'Application reactivated.' : 'Could not reactivate application.'
      );
      return reply.redirect(`/ui/applications/${request.params.appId}`);
    }
  );

  fastify.post(
    '/ui/applications/:appId/delete',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      try {
        await appService.hardDeleteApplication(request.params.appId);
        setFlash(request, 'success', 'Application permanently deleted.');
        return reply.redirect('/ui/applications');
      } catch (err) {
        setFlash(request, 'error', err.message);
        return reply.redirect(`/ui/applications/${request.params.appId}`);
      }
    }
  );
}

module.exports = applicationsRoutes;
