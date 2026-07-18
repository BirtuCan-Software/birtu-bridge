// src/routes/transactions.js
const gatewayEntry = require('../middleware/gatewayEntry');
const transactionService = require('../services/transactionService');

async function transactionRoutes(fastify) {
  fastify.post('/v1/transactions/initialize', { preHandler: gatewayEntry }, async (request, reply) => {
    try {
      const result = await transactionService.initializeTransaction({
        app: request.app,
        input: request.body || {},
      });
      reply.code(200);
      return result;
    } catch (err) {
      reply.code(err.statusCode || 500);
      if (err.retryAfterSeconds) {
        reply.header('Retry-After', String(err.retryAfterSeconds));
      }
      return { error: err.message, detail: err.detail };
    }
  });
}

module.exports = transactionRoutes;
