// src/routes/ui/transactions.js
const requireAuth = require('../../middleware/requireAuth');
const txnRepo = require('../../repositories/transactionRepo');
const { popFlash } = require('../../utils/flash');
const { renderLayout } = require('../../views/layout');
const { renderTransactionsListBody } = require('../../views/pages/transactionsList');
const { renderTransactionDetailBody } = require('../../views/pages/transactionDetail');

const PAGE_SIZE = 25;

async function transactionsUiRoutes(fastify) {
  fastify.get('/ui/transactions', { preHandler: requireAuth }, async (request, reply) => {
    const status = request.query.status || '';
    const search = request.query.q || '';
    const page = Math.max(parseInt(request.query.page || '1', 10), 1);
    const offset = (page - 1) * PAGE_SIZE;

    const [transactions, total] = await Promise.all([
      txnRepo.listTransactions({ status: status || null, search: search || null, limit: PAGE_SIZE, offset }),
      txnRepo.countTransactions({ status: status || null, search: search || null }),
    ]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    reply.type('text/html');
    return renderLayout({
      title: 'Transactions',
      activeNav: 'transactions',
      flash: popFlash(request),
      bodyHtml: renderTransactionsListBody({
        transactions,
        currentStatus: status,
        search,
        page,
        totalPages,
      }),
    });
  });

  fastify.get('/ui/transactions/:transactionId', { preHandler: requireAuth }, async (request, reply) => {
    const txn = await txnRepo.getById(request.params.transactionId);
    if (!txn) {
      reply.code(404);
      return 'Transaction not found';
    }
    reply.type('text/html');
    return renderLayout({
      title: `Transaction ${txn.client_order_id}`,
      activeNav: 'transactions',
      flash: popFlash(request),
      bodyHtml: renderTransactionDetailBody({ txn }),
    });
  });
}

module.exports = transactionsUiRoutes;
