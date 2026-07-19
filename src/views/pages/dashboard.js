// src/views/pages/dashboard.js
const { escapeHtml } = require('../../utils/html');
const { transactionStatusBadgeClasses } = require('../badges');

function renderDashboardBody(stats) {
  const circuitBadge =
    stats.circuitBreaker.chapa_status === 'OPERATIONAL'
      ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">OPERATIONAL</span>'
      : `<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">${escapeHtml(
          stats.circuitBreaker.chapa_status
        )}</span>`;

  const statusCountsHtml = stats.statusCounts
    .map(
      (row) =>
        `<div class="flex items-center justify-between py-1">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${transactionStatusBadgeClasses(
            row.status
          )}">${escapeHtml(row.status)}</span>
          <span class="text-sm font-medium text-slate-700">${escapeHtml(row.count)}</span>
        </div>`
    )
    .join('');

  const recentRowsHtml = stats.recentTransactions
    .map(
      (t) => `<tr class="border-b border-slate-100">
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(t.app_name)}</td>
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(t.client_order_id)}</td>
        <td class="py-2 px-3 text-sm"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${transactionStatusBadgeClasses(
          t.status
        )}">${escapeHtml(t.status)}</span></td>
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(t.amount)} ${escapeHtml(t.currency)}</td>
        <td class="py-2 px-3 text-sm text-slate-500">${escapeHtml(new Date(t.created_at).toLocaleString())}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <h2 class="text-sm font-medium text-slate-500 mb-3">Gateway status</h2>
        ${circuitBadge}
      </div>
      <a href="/ui/dlq" class="bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-300 block">
        <h2 class="text-sm font-medium text-slate-500 mb-3">Unresolved delivery failures</h2>
        <span class="text-2xl font-semibold text-slate-900">${escapeHtml(stats.dlqUnresolvedCount)}</span>
      </a>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <h2 class="text-sm font-medium text-slate-500 mb-3">Transactions, last 24h</h2>
        ${statusCountsHtml || '<p class="text-sm text-slate-400">No transactions yet</p>'}
      </div>
    </div>

    <div class="bg-white rounded-lg border border-slate-200">
      <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 class="text-sm font-medium text-slate-700">Recent transactions</h2>
        <a href="/ui/transactions" class="text-sm text-slate-500 hover:underline">View all &rarr;</a>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-left text-xs font-medium text-slate-500 border-b border-slate-100">
            <th class="py-2 px-3">Application</th>
            <th class="py-2 px-3">Order ID</th>
            <th class="py-2 px-3">Status</th>
            <th class="py-2 px-3">Amount</th>
            <th class="py-2 px-3">Created</th>
          </tr>
        </thead>
        <tbody>
          ${recentRowsHtml || '<tr><td class="py-4 px-3 text-sm text-slate-400" colspan="5">No transactions yet</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

module.exports = { renderDashboardBody };
