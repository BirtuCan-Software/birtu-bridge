// src/views/pages/dlqList.js
const { escapeHtml } = require('../../utils/html');

function renderDlqListBody({ failures, csrfToken }) {
  const rowsHtml = failures
    .map(
      (f) => `<tr class="border-b border-slate-100">
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(f.app_name)}</td>
        <td class="py-2 px-3 text-sm font-mono text-slate-500">${escapeHtml(f.tx_ref)}</td>
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(f.event_type)}</td>
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(f.reason)}</td>
        <td class="py-2 px-3 text-sm text-slate-500">${escapeHtml(new Date(f.created_at).toLocaleString())}</td>
        <td class="py-2 px-3 text-sm">
          ${
            f.delivery_status === 'FAILED_DLQ'
              ? `<form method="POST" action="/ui/dlq/${escapeHtml(f.delivery_id)}/retry">
                  <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
                  <button type="submit" class="text-blue-600 hover:underline text-sm">Retry</button>
                </form>`
              : `<span class="text-xs text-slate-400">${escapeHtml(f.delivery_status)}</span>`
          }
        </td>
      </tr>`
    )
    .join('');

  return `
    <h1 class="text-lg font-semibold text-slate-900 mb-6">Delivery Failures</h1>
    <div class="bg-white rounded-lg border border-slate-200">
      <table class="w-full">
        <thead>
          <tr class="text-left text-xs font-medium text-slate-500 border-b border-slate-100">
            <th class="py-2 px-3">Application</th>
            <th class="py-2 px-3">Tx ref</th>
            <th class="py-2 px-3">Event</th>
            <th class="py-2 px-3">Reason</th>
            <th class="py-2 px-3">Occurred</th>
            <th class="py-2 px-3">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td class="py-4 px-3 text-sm text-slate-400" colspan="6">No delivery failures recorded</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

module.exports = { renderDlqListBody };
