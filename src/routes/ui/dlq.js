// src/routes/ui/dlq.js
const requireAuth = require('../../middleware/requireAuth');
const dlqService = require('../../services/dlqService');
const { setFlash, popFlash } = require('../../utils/flash');
const { renderLayout } = require('../../views/layout');
const { renderDlqListBody } = require('../../views/pages/dlqList');

async function dlqUiRoutes(fastify) {
  fastify.get('/ui/dlq', { preHandler: requireAuth }, async (request, reply) => {
    const failures = await dlqService.listFailures();
    const csrfToken = await reply.generateCsrf();
    reply.type('text/html');
    return renderLayout({
      title: 'Delivery Failures',
      activeNav: 'dlq',
      flash: popFlash(request),
      bodyHtml: renderDlqListBody({ failures, csrfToken }),
    });
  });

  fastify.post(
    '/ui/dlq/:deliveryId/retry',
    { preHandler: [requireAuth, fastify.csrfProtection] },
    async (request, reply) => {
      const retried = await dlqService.retryDelivery(request.params.deliveryId);
      setFlash(
        request,
        retried ? 'success' : 'error',
        retried ? 'Delivery re-queued for retry.' : 'Could not retry — it may have already been retried.'
      );
      return reply.redirect('/ui/dlq');
    }
  );
}

module.exports = dlqUiRoutes;
