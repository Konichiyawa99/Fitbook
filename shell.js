/* Shared page behaviour: close the settings menu when clicking outside it. */
document.addEventListener('click', function (e) {
  document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});
