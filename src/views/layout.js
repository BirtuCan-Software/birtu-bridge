// src/views/layout.js
const { escapeHtml } = require('../utils/html');

function renderLayout({ title, bodyHtml, activeNav, flash }) {
  const navItems = [
    { href: '/ui', label: 'Dashboard', key: 'dashboard' },
    { href: '/ui/applications', label: 'Applications', key: 'applications' },
    { href: '/ui/transactions', label: 'Transactions', key: 'transactions' },
    { href: '/ui/dlq', label: 'Delivery Failures', key: 'dlq' },
    { href: '/ui/docs', label: 'Docs', key: 'docs' },
  ];

  const navHtml = navItems
    .map((item) => {
      const activeClasses =
        activeNav === item.key
          ? 'bg-slate-900 text-white'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white';
      return `<a href="${item.href}" class="px-3 py-2 rounded-md text-sm font-medium ${activeClasses}">${escapeHtml(
        item.label
      )}</a>`;
    })
    .join('');

  const flashHtml = flash
    ? `<div class="mb-4 rounded-md border px-4 py-3 text-sm ${
        flash.type === 'error'
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-green-300 bg-green-50 text-green-800'
      }">${escapeHtml(flash.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} · Birtu Bridge</title>
  <link rel="stylesheet" href="/ui/assets/app.css" />
  <script src="https://unpkg.com/htmx.org@1.9.12"></script>
</head>
<body class="bg-slate-50 min-h-screen">
  <nav class="bg-slate-900 border-b border-slate-800">
    <div class="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
      <div class="flex items-center gap-1">
        <span class="text-white font-semibold mr-4">Birtu Bridge</span>
        ${navHtml}
      </div>
      <form method="POST" action="/ui/logout">
        <button type="submit" class="text-slate-300 hover:text-white text-sm">Log out</button>
      </form>
    </div>
  </nav>
  <main class="max-w-6xl mx-auto px-4 py-8">
    ${flashHtml}
    ${bodyHtml}
  </main>
  <script src="/ui/assets/confirm.js"></script>
  <script src="/ui/assets/ui.js"></script>
</body>
</html>`;
}

module.exports = { renderLayout };
