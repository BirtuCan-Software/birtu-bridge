// src/utils/flash.js
function setFlash(request, type, message) {
  request.session.set('flash', { type, message });
}

function popFlash(request) {
  const flash = request.session.get('flash');
  request.session.set('flash', undefined);
  return flash || null;
}

module.exports = { setFlash, popFlash };
