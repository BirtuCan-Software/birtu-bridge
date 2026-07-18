// src/middleware/gatewayEntry.js
const apiKeyService = require('../services/apiKeyService');

/**
 * Fastify preHandler hook. Attaches request.app, request.apiKeyId,
 * and request.circuitBreaker on success. Sends 401/429 directly on failure.
 */
async function gatewayEntry(request, reply) {
  const authHeader = request.headers['authorization'] || '';
  const providedKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const clientIp = request.ip;

  const result = await apiKeyService.authenticateAndCheckLimits({ providedKey, clientIp });

  if (!result.authenticated) {
    if (result.rateLimited) {
      reply.code(429).send({ error: 'Too many requests' });
      return reply;
    }
    reply.code(401).send({ error: 'Invalid or missing API key' });
    return reply;
  }

  if (result.rateLimited) {
    reply.code(429).send({ error: 'Too many requests' });
    return reply;
  }

  request.app = result.app;
  request.apiKeyId = result.apiKeyId;
  request.circuitBreaker = result.circuitBreaker;
}

module.exports = gatewayEntry;
