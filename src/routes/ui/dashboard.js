// src/routes/ui/dashboard.js
const requireAuth = require('../../middleware/requireAuth');
const statsService = require('../../services/statsService');
const { popFlash } = require('../../utils/flash');
const { renderLayout } = require('../../views/layout');
const { renderDashboardBody } = require('../../views/pages/dashboard');

async function dashboardRoutes(fastify) {
  fastify.get('/ui', { preHandler: requireAuth }, async (request, reply) => {
    const stats = await statsService.getDashboardStats();
    reply.type('text/html');
    return renderLayout({
      title: 'Dashboard',
      activeNav: 'dashboard',
      flash: popFlash(request),
      bodyHtml: renderDashboardBody(stats),
    });
  });
}

module.exports = dashboardRoutes;
