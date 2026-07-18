// src/server.js
const config = require('./config');
const { healthCheck } = require('./db/pool');
const adminRoutes = require('./routes/admin');
const pingRoutes = require('./routes/ping');
const transactionRoutes = require('./routes/transactions');
const webhookRoutes = require('./routes/webhooks');

const fastify = require('fastify')({
  logger: {
    transport:
      config.env === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
  },
});

fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (req, body, done) {
  req.rawBody = body;
  if (body.length === 0) {
    done(null, {});
    return;
  }
  try {
    const json = JSON.parse(body.toString('utf8'));
    done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

fastify.get('/health', async (request, reply) => {
  try {
    await healthCheck();
    return { status: 'ok', db: 'connected' };
  } catch (err) {
    request.log.error(err, 'Health check DB failure');
    reply.code(503);
    return { status: 'error', db: 'unreachable' };
  }
});

fastify.register(adminRoutes);
fastify.register(pingRoutes);
fastify.register(transactionRoutes);
fastify.register(webhookRoutes);

async function start() {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`birtu-bridge listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
