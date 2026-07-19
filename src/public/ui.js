document.addEventListener('click', function (e) {
  var btn = e.target.closest('.copy-button');
  if (!btn) return;
  var value = btn.getAttribute('data-copy-value') || '';
  navigator.clipboard.writeText(value).then(function () {
    var original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function () {
      btn.textContent = original;
    }, 1500);
  });
});
