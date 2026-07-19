// src/views/pages/transactionsList.js
const { escapeHtml } = require('../../utils/html');
const { transactionStatusBadgeClasses } = require('../badges');

const STATUSES = [
  'PENDING_CREATION',
  'FORWARDING',
  'RECOVERING',
  'INITIALIZED',
  'PAID',
  'FAILED',
  'SUPERSEDED',
  'SUPERSEDED_ORPHANED_ON_GATEWAY',
  'ABORTED',
];

function renderTransactionsListBody({ transactions, currentStatus, search, page, totalPages }) {
  const optionsHtml = STATUSES.map(
    (s) => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`
  ).join('');

  const rowsHtml = transactions
    .map(
      (t) => `<tr class="border-b border-slate-100">
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(t.app_name)}</td>
        <td class="py-2 px-3 text-sm text-slate-900">
          <a href="/ui/transactions/${escapeHtml(t.id)}" class="hover:underline font-medium">${escapeHtml(
        t.client_order_id
      )}</a>
        </td>
        <td class="py-2 px-3 text-sm font-mono text-slate-500">${escapeHtml(t.attempt_count)}</td>
        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${transactionStatusBadgeClasses(
          t.status
        )}">${escapeHtml(t.status)}</span></td>
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(t.amount)} ${escapeHtml(t.currency)}</td>
        <td class="py-2 px-3 text-sm text-slate-500">${escapeHtml(new Date(t.created_at).toLocaleString())}</td>
      </tr>`
    )
    .join('');

  const statusQuery = currentStatus ? `&status=${escapeHtml(currentStatus)}` : '';
  const searchQuery = search ? `&q=${escapeHtml(search)}` : '';
  const prevLink =
    page > 1
      ? `<a href="/ui/transactions?page=${page - 1}${statusQuery}${searchQuery}" class="text-sm text-slate-600 hover:underline">&larr; Previous</a>`
      : '<span></span>';
  const nextLink =
    page < totalPages
      ? `<a href="/ui/transactions?page=${page + 1}${statusQuery}${searchQuery}" class="text-sm text-slate-600 hover:underline">Next &rarr;</a>`
      : '<span></span>';

  return `
    <div class="flex items-center justify-between mb-6 gap-4">
      <h1 class="text-lg font-semibold text-slate-900">Transactions</h1>
      <form method="GET" action="/ui/transactions" class="flex gap-2">
        <input type="text" name="q" value="${escapeHtml(search || '')}" placeholder="Search order ID or tx_ref..."
          class="rounded-md border border-slate-300 px-3 py-2 text-sm w-64" />
        <select name="status" onchange="this.form.submit()" class="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          ${optionsHtml}
        </select>
        <button type="submit" class="bg-slate-900 text-white rounded-md px-3 py-2 text-sm hover:bg-slate-800">Search</button>
      </form>
    </div>

    <div class="bg-white rounded-lg border border-slate-200">
      <table class="w-full">
        <thead>
          <tr class="text-left text-xs font-medium text-slate-500 border-b border-slate-100">
            <th class="py-2 px-3">Application</th>
            <th class="py-2 px-3">Order ID</th>
            <th class="py-2 px-3">Attempt</th>
            <th class="py-2 px-3">Status</th>
            <th class="py-2 px-3">Amount</th>
            <th class="py-2 px-3">Created</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td class="py-4 px-3 text-sm text-slate-400" colspan="6">No transactions found</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between mt-4">
      ${prevLink}
      <span class="text-sm text-slate-400">Page ${page} of ${Math.max(totalPages, 1)}</span>
      ${nextLink}
    </div>
  `;
}

module.exports = { renderTransactionsListBody };
