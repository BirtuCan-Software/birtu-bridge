// src/views/pages/transactionDetail.js
const { escapeHtml } = require('../../utils/html');
const { transactionStatusBadgeClasses } = require('../badges');

function copyButton(value) {
  return `<button type="button" class="copy-button text-xs text-slate-500 hover:text-slate-800 underline" data-copy-value="${escapeHtml(
    value
  )}">Copy</button>`;
}

function renderTransactionDetailBody({ txn }) {
  let errorObj = null;
  if (txn.error_detail) {
    errorObj = typeof txn.error_detail === 'string' ? JSON.parse(txn.error_detail) : txn.error_detail;
  }

  const errorHtml = errorObj
    ? `<pre class="bg-slate-50 border border-slate-200 rounded-md p-4 text-xs overflow-x-auto">${escapeHtml(
        JSON.stringify(errorObj, null, 2)
      )}</pre>`
    : '<p class="text-sm text-slate-400">None</p>';

  const checkoutUrlHtml = txn.checkout_url
    ? `<a href="${escapeHtml(txn.checkout_url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline break-all text-sm">${escapeHtml(
        txn.checkout_url
      )}</a>`
    : '<span class="text-sm text-slate-400">None</span>';

  const rows = [
    ['Client order ID', txn.client_order_id, true],
    ['Attempt', txn.attempt_count, false],
    ['Chapa tx_ref', txn.chapa_tx_ref, true],
    ['Chapa reference', txn.chapa_reference || '—', false],
    ['Amount', `${txn.amount} ${txn.currency}`, false],
    ['Customer email', txn.customer_email || '—', false],
    ['Return URL', txn.return_url || '—', false],
    ['Created', new Date(txn.created_at).toLocaleString(), false],
    ['Last updated', new Date(txn.updated_at).toLocaleString(), false],
  ];

  const rowsHtml = rows
    .map(
      ([label, value, copyable]) => `<div class="flex items-center justify-between py-2 border-b border-slate-100">
        <span class="text-sm text-slate-500">${escapeHtml(label)}</span>
        <span class="text-sm text-slate-900 font-mono flex items-center gap-2">
          ${escapeHtml(value)} ${copyable ? copyButton(value) : ''}
        </span>
      </div>`
    )
    .join('');

  return `
    <a href="/ui/transactions" class="text-sm text-slate-500 hover:underline">&larr; All transactions</a>
    <div class="flex items-center justify-between mt-1 mb-6">
      <h1 class="text-lg font-semibold text-slate-900">Transaction detail</h1>
      <span class="px-2 py-0.5 rounded-full text-xs font-medium ${transactionStatusBadgeClasses(
        txn.status
      )}">${escapeHtml(txn.status)}</span>
    </div>

    <div class="bg-white rounded-lg border border-slate-200 p-5 mb-6">
      ${rowsHtml}
    </div>

    <div class="bg-white rounded-lg border border-slate-200 p-5 mb-6">
      <h2 class="text-sm font-medium text-slate-700 mb-2">Checkout URL</h2>
      ${checkoutUrlHtml}
    </div>

    <div class="bg-white rounded-lg border border-slate-200 p-5">
      <h2 class="text-sm font-medium text-slate-700 mb-2">Error / gateway detail</h2>
      ${errorHtml}
    </div>
  `;
}

module.exports = { renderTransactionDetailBody };
