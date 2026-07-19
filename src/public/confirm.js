document.addEventListener('submit', function (e) {
  var form = e.target;
  if (form.classList.contains('confirm-submit')) {
    var message = form.getAttribute('data-confirm-message') || 'Are you sure?';
    if (!window.confirm(message)) {
      e.preventDefault();
    }
  }
});
