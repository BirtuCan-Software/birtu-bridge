// src/server.js
const path = require('path');
const config = require('./config');
const { pool, healthCheck } = require('./db/pool');
const MySQLSessionStore = require('./auth/mysqlSessionStore');

const adminRoutes = require('./routes/admin');
const pingRoutes = require('./routes/ping');
const transactionRoutes = require('./routes/transactions');
const webhookRoutes = require('./routes/webhooks');
const authUiRoutes = require('./routes/ui/auth');
const dashboardUiRoutes = require('./routes/ui/dashboard');
const applicationsUiRoutes = require('./routes/ui/applications');
const transactionsUiRoutes = require('./routes/ui/transactions');
const dlqUiRoutes = require('./routes/ui/dlq');

const fastify = require('fastify')({
  trustProxy: config.env === 'production',
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

async function registerPlugins() {
  await fastify.register(require('@fastify/formbody'));

  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://unpkg.com'],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  });

  await fastify.register(require('@fastify/cookie'));

  await fastify.register(require('@fastify/session'), {
    secret: config.session.secret,
    cookieName: config.session.cookieName,
    cookie: {
      secure: config.env === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: config.session.ttlHours * 3600 * 1000,
    },
    store: new MySQLSessionStore(pool),
    saveUninitialized: true,
  });

  await fastify.register(require('@fastify/csrf-protection'), {
    sessionPlugin: '@fastify/session',
  });

  await fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'),
    prefix: '/ui/assets/',
  });
}

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

async function start() {
  try {
    await registerPlugins();

    fastify.register(adminRoutes);
    fastify.register(pingRoutes);
    fastify.register(transactionRoutes);
    fastify.register(webhookRoutes);
    fastify.register(authUiRoutes);
    fastify.register(dashboardUiRoutes);
    fastify.register(applicationsUiRoutes);
    fastify.register(transactionsUiRoutes);
    fastify.register(dlqUiRoutes);

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`birtu-bridge listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
