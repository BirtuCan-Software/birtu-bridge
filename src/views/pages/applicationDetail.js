// src/views/pages/applicationDetail.js
const { escapeHtml } = require('../../utils/html');
const { environmentBadgeClasses, appStatusBadgeClasses } = require('../badges');

function renderApplicationDetailBody({ app, apiKeys, redirectRules, csrfToken, newApiKey, transactionCount }) {
  const newKeyBanner = newApiKey
    ? `<div class="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p class="font-medium mb-1">New API key created — copy it now, it will not be shown again:</p>
        <div class="flex items-center gap-3">
          <code class="flex-1 bg-white border border-amber-200 rounded px-3 py-2 text-xs break-all">${escapeHtml(
            newApiKey
          )}</code>
          <button type="button" class="copy-button text-xs font-medium text-amber-800 underline" data-copy-value="${escapeHtml(
            newApiKey
          )}">Copy</button>
        </div>
      </div>`
    : '';

  let lifecycleActionsHtml = '';
  if (app.status === 'active') {
    lifecycleActionsHtml = `<form method="POST" action="/ui/applications/${escapeHtml(app.id)}/archive"
      class="inline confirm-submit" data-confirm-message="Archive this application? Its API keys stop working immediately, but all data is kept.">
      <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
      <button type="submit" class="text-amber-700 hover:underline text-sm">Archive application</button>
    </form>`;
  } else {
    lifecycleActionsHtml = `<form method="POST" action="/ui/applications/${escapeHtml(app.id)}/reactivate" class="inline">
      <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
      <button type="submit" class="text-green-700 hover:underline text-sm mr-4">Reactivate application</button>
    </form>`;
    if (Number(transactionCount) === 0) {
      lifecycleActionsHtml += `<form method="POST" action="/ui/applications/${escapeHtml(app.id)}/delete"
        class="inline confirm-submit" data-confirm-message="Permanently delete this application? This cannot be undone.">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
        <button type="submit" class="text-red-700 hover:underline text-sm">Delete permanently</button>
      </form>`;
    }
  }

  const keysRowsHtml = apiKeys
    .map(
      (key) => `<tr class="border-b border-slate-100">
        <td class="py-2 px-3 text-sm font-mono text-slate-700">${escapeHtml(key.key_prefix)}...</td>
        <td class="py-2 px-3 text-sm text-slate-500">${escapeHtml(key.status)}</td>
        <td class="py-2 px-3 text-sm text-slate-500">${escapeHtml(new Date(key.created_at).toLocaleDateString())}</td>
        <td class="py-2 px-3 text-sm">
          ${
            key.status === 'active'
              ? `<form method="POST" action="/ui/applications/${escapeHtml(app.id)}/api-keys/${escapeHtml(
                  key.id
                )}/revoke" class="confirm-submit" data-confirm-message="Revoke this API key? This cannot be undone.">
                  <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
                  <button type="submit" class="text-red-600 hover:underline text-sm">Revoke</button>
                </form>`
              : ''
          }
        </td>
      </tr>`
    )
    .join('');

  const redirectRowsHtml = redirectRules
    .map(
      (rule) => `<tr class="border-b border-slate-100">
        <td class="py-2 px-3 text-sm text-slate-700">${escapeHtml(rule.hostname)}</td>
        <td class="py-2 px-3 text-sm text-slate-500">${rule.allow_subdomain_wildcard ? 'Yes' : 'No'}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="mb-6">
      <a href="/ui/applications" class="text-sm text-slate-500 hover:underline">&larr; All applications</a>
      <div class="flex items-center justify-between mt-1">
        <div>
          <h1 class="text-lg font-semibold text-slate-900">${escapeHtml(app.name)}</h1>
          <div class="flex items-center gap-2 mt-1">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${environmentBadgeClasses(
              app.environment
            )}">${escapeHtml(app.environment)}</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${appStatusBadgeClasses(
              app.status
            )}">${escapeHtml(app.status)}</span>
            <span class="text-xs text-slate-400">${escapeHtml(transactionCount)} transaction(s)</span>
          </div>
        </div>
        <div>${lifecycleActionsHtml}</div>
      </div>
    </div>

    ${newKeyBanner}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg border border-slate-200">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 class="text-sm font-medium text-slate-700">API keys</h2>
          <form method="POST" action="/ui/applications/${escapeHtml(app.id)}/api-keys">
            <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
            <button type="submit" class="text-sm bg-slate-900 text-white rounded-md px-3 py-1.5 hover:bg-slate-800">
              + New key
            </button>
          </form>
        </div>
        <table class="w-full">
          <tbody>
            ${keysRowsHtml || '<tr><td class="py-4 px-3 text-sm text-slate-400">No API keys yet</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="bg-white rounded-lg border border-slate-200">
        <div class="px-5 py-4 border-b border-slate-200">
          <h2 class="text-sm font-medium text-slate-700">Redirect whitelist</h2>
        </div>
        <table class="w-full mb-2">
          <tbody>
            ${redirectRowsHtml || '<tr><td class="py-4 px-3 text-sm text-slate-400">No entries yet</td></tr>'}
          </tbody>
        </table>
        <form method="POST" action="/ui/applications/${escapeHtml(app.id)}/redirect-whitelist"
          class="p-5 border-t border-slate-100 flex gap-2 items-end">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
          <div class="flex-1">
            <label class="block text-xs font-medium text-slate-500 mb-1">Hostname</label>
            <input type="text" name="hostname" placeholder="example.com" required
              class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <label class="flex items-center gap-1 text-xs text-slate-600 pb-2">
            <input type="checkbox" name="allowSubdomainWildcard" value="true" /> Allow subdomains
          </label>
          <button type="submit" class="bg-slate-900 text-white rounded-md px-3 py-2 text-sm hover:bg-slate-800">
            Add
          </button>
        </form>
      </div>
    </div>

    <div class="bg-white rounded-lg border border-slate-200 mt-6">
      <div class="px-5 py-4 border-b border-slate-200">
        <h2 class="text-sm font-medium text-slate-700">Webhook delivery URL</h2>
      </div>
      <form method="POST" action="/ui/applications/${escapeHtml(app.id)}/webhook-url" class="p-5 flex gap-2 items-end">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
        <div class="flex-1">
          <input type="url" name="webhookUrl" value="${escapeHtml(app.webhook_url || '')}" placeholder="https://your-app.com/webhooks"
            class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" class="bg-slate-900 text-white rounded-md px-3 py-2 text-sm hover:bg-slate-800">
          Save
        </button>
      </form>
    </div>
  `;
}

module.exports = { renderApplicationDetailBody };
