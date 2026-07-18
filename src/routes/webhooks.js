// src/routes/webhooks.js
const config = require('../config');
const webhookService = require('../services/webhookService');

async function webhookRoutes(fastify) {
  fastify.post('/v1/webhooks/chapa', async (request, reply) => {
    try {
      const signatureHeaderValue = request.headers[config.webhookSignatureHeader.toLowerCase()];
      const result = await webhookService.processIncomingWebhook({
        rawBody: request.rawBody,
        signatureHeaderValue,
      });
      reply.code(result.httpStatus);
      return result.body;
    } catch (err) {
      if (err instanceof webhookService.InvalidSignatureError) {
        reply.code(401);
        return { error: 'Invalid signature' };
      }
      request.log.error(err, 'Webhook processing failed');
      reply.code(500);
      return { error: 'Internal error processing webhook' };
    }
  });
}

module.exports = webhookRoutes;
