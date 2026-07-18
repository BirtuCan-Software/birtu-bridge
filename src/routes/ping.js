// src/routes/ping.js
const gatewayEntry = require('../middleware/gatewayEntry');

async function pingRoutes(fastify) {
  fastify.get('/v1/ping', { preHandler: gatewayEntry }, async (request) => {
    return {
      message: 'pong',
      app: request.app,
      circuitBreaker: request.circuitBreaker,
    };
  });
}

module.exports = pingRoutes;
