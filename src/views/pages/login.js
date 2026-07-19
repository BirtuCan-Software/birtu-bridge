// src/views/pages/login.js
const { escapeHtml } = require('../../utils/html');

function renderLoginPage({ csrfToken, error }) {
  const errorHtml = error
    ? `<div class="mb-4 rounded-md border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">${escapeHtml(
        error
      )}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in · Birtu Bridge</title>
  <link rel="stylesheet" href="/ui/assets/app.css" />
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-sm bg-white rounded-lg shadow p-8 border border-slate-200">
    <h1 class="text-xl font-semibold text-slate-900 mb-1">Birtu Bridge</h1>
    <p class="text-sm text-slate-500 mb-6">Operator sign in</p>
    ${errorHtml}
    <form method="POST" action="/ui/login" class="space-y-4">
      <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input type="email" name="email" required
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
        <input type="password" name="password" required
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </div>
      <button type="submit"
        class="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium hover:bg-slate-800">
        Sign in
      </button>
    </form>
  </div>
</body>
</html>`;
}

module.exports = { renderLoginPage };
