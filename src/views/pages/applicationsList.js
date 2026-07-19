// src/views/pages/applicationsList.js
const { escapeHtml } = require('../../utils/html');
const { environmentBadgeClasses, appStatusBadgeClasses } = require('../badges');

function renderApplicationsListBody({ applications, csrfToken, search }) {
  const rowsHtml = applications
    .map((app) => {
      const envBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${environmentBadgeClasses(
        app.environment
      )}">${escapeHtml(app.environment)}</span>`;
      const statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${appStatusBadgeClasses(
        app.status
      )}">${escapeHtml(app.status)}</span>`;

      let actionsHtml = '';
      if (app.status === 'active') {
        actionsHtml += `<form method="POST" action="/ui/applications/${escapeHtml(app.id)}/archive"
          class="inline confirm-submit" data-confirm-message="Archive this application? Its API keys stop working immediately, but all data is kept.">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
          <button type="submit" class="text-amber-700 hover:underline text-sm mr-3">Archive</button>
        </form>`;
      } else {
        actionsHtml += `<form method="POST" action="/ui/applications/${escapeHtml(app.id)}/reactivate" class="inline">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
          <button type="submit" class="text-green-700 hover:underline text-sm mr-3">Reactivate</button>
        </form>`;
        if (Number(app.transaction_count) === 0) {
          actionsHtml += `<form method="POST" action="/ui/applications/${escapeHtml(app.id)}/delete"
            class="inline confirm-submit" data-confirm-message="Permanently delete this application? This cannot be undone.">
            <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
            <button type="submit" class="text-red-700 hover:underline text-sm">Delete permanently</button>
          </form>`;
        }
      }

      return `<tr class="border-b border-slate-100">
        <td class="py-2 px-3 text-sm text-slate-900 font-medium">
          <a href="/ui/applications/${escapeHtml(app.id)}" class="hover:underline">${escapeHtml(app.name)}</a>
        </td>
        <td class="py-2 px-3">${envBadge}</td>
        <td class="py-2 px-3">${statusBadge}</td>
        <td class="py-2 px-3 text-sm text-slate-500">${escapeHtml(app.transaction_count)}</td>
        <td class="py-2 px-3 text-sm text-slate-500">${escapeHtml(new Date(app.created_at).toLocaleDateString())}</td>
        <td class="py-2 px-3">${actionsHtml}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-lg font-semibold text-slate-900">Applications</h1>
      <form method="GET" action="/ui/applications">
        <input type="text" name="q" value="${escapeHtml(search || '')}" placeholder="Search by name..."
          class="rounded-md border border-slate-300 px-3 py-2 text-sm w-64" />
      </form>
    </div>

    <div class="bg-white rounded-lg border border-slate-200 mb-8">
      <div class="px-5 py-4 border-b border-slate-200">
        <h2 class="text-sm font-medium text-slate-700">Create a new application</h2>
      </div>
      <form method="POST" action="/ui/applications" class="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Name</label>
          <input type="text" name="name" required class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Environment</label>
          <select name="environment" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="sandbox">sandbox</option>
            <option value="production">production</option>
          </select>
        </div>
        <div class="flex items-end">
          <button type="submit" class="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium hover:bg-slate-800">
            Create
          </button>
        </div>
      </form>
    </div>

    <div class="bg-white rounded-lg border border-slate-200">
      <table class="w-full">
        <thead>
          <tr class="text-left text-xs font-medium text-slate-500 border-b border-slate-100">
            <th class="py-2 px-3">Name</th>
            <th class="py-2 px-3">Environment</th>
            <th class="py-2 px-3">Status</th>
            <th class="py-2 px-3">Transactions</th>
            <th class="py-2 px-3">Created</th>
            <th class="py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td class="py-4 px-3 text-sm text-slate-400" colspan="6">No applications found</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

module.exports = { renderApplicationsListBody };
