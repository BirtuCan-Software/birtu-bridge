// src/routes/ui/docs.js
const requireAuth = require('../../middleware/requireAuth');
const { popFlash } = require('../../utils/flash');
const { renderLayout } = require('../../views/layout');
const { renderDocsBody } = require('../../views/pages/docs');

async function docsRoutes(fastify) {
  fastify.get('/ui/docs', { preHandler: requireAuth }, async (request, reply) => {
    reply.type('text/html');
    return renderLayout({
      title: 'Docs',
      activeNav: 'docs',
      flash: popFlash(request),
      bodyHtml: renderDocsBody(),
    });
  });
}

module.exports = docsRoutes;
