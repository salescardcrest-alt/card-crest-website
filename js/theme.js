/* Light mode is the default. Dark mode is used only when the person chooses it with the moon button, and that
   choice is remembered. The early script in index.html sets the attribute before the page paints; this file wires up
   the buttons and keeps them in sync. */
(function (w, d) {
  'use strict';
  var KEY = 'cc.theme';
  function saved() { try { return w.localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() { return d.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function apply(mode) {
    d.documentElement.setAttribute('data-theme', mode);
    var m = d.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', mode === 'dark' ? '#0b1410' : '#0E5C3C');
    [].forEach.call(d.querySelectorAll('[data-theme-toggle]'), function (b) {
      b.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
      b.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = mode === 'dark' ? 'Light mode' : 'Dark mode';
    });
  }
  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    try { w.localStorage.setItem(KEY, next); } catch (e) {}
    apply(next);
  }
  w.CC = w.CC || {};
  w.CC.Theme = { toggle: toggle, current: current };

  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (b) toggle();
  });
  apply(saved() === 'dark' ? 'dark' : 'light');
})(window, document);
