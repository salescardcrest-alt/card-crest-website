/* Dark mode: a saved choice wins, otherwise the device setting. The early script in index.html sets the
   attribute before the page paints; this file wires up the buttons and keeps them in sync. */
(function (w, d) {
  'use strict';
  var KEY = 'cc.theme';
  function saved() { try { return w.localStorage.getItem(KEY); } catch (e) { return null; } }
  function systemDark() { return !!(w.matchMedia && w.matchMedia('(prefers-color-scheme: dark)').matches); }
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
  if (w.matchMedia) {
    var mq = w.matchMedia('(prefers-color-scheme: dark)');
    var follow = function () { if (!saved()) apply(mq.matches ? 'dark' : 'light'); };
    if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow);
  }
  apply(saved() || (systemDark() ? 'dark' : 'light'));
})(window, document);
