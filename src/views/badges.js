// src/views/badges.js
function environmentBadgeClasses(environment) {
  return environment === 'production' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-700';
}

function appStatusBadgeClasses(status) {
  return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600';
}

function transactionStatusBadgeClasses(status) {
  const map = {
    PAID: 'bg-green-100 text-green-800',
    INITIALIZED: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    FORWARDING: 'bg-amber-100 text-amber-800',
    RECOVERING: 'bg-amber-100 text-amber-800',
    ABORTED: 'bg-slate-200 text-slate-700',
    SUPERSEDED: 'bg-slate-200 text-slate-700',
    SUPERSEDED_ORPHANED_ON_GATEWAY: 'bg-slate-200 text-slate-700',
    PENDING_CREATION: 'bg-slate-100 text-slate-600',
  };
  return map[status] || 'bg-slate-100 text-slate-700';
}

module.exports = { environmentBadgeClasses, appStatusBadgeClasses, transactionStatusBadgeClasses };
