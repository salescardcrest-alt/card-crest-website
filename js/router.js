/* ============================================================
   Card Crest — router.js
   Hash routing. Every page module returns
   { html, title, desc, mount(root) }.
   ============================================================ */
(function (w, d) {
  'use strict';

  var routes = [];
  function on(pattern, handler) {
    var keys = [];
    var rx = new RegExp('^' + pattern.replace(/:[^/]+/g, function (m) {
      keys.push(m.slice(1)); return '([^/]+)';
    }).replace(/\//g, '\\/') + '$');
    routes.push({ rx: rx, keys: keys, handler: handler });
  }

  function parse() {
    var raw = location.hash.slice(1) || '/';
    var qi = raw.indexOf('?');
    var path = qi > -1 ? raw.slice(0, qi) : raw;
    var query = {};
    if (qi > -1) {
      raw.slice(qi + 1).split('&').forEach(function (pair) {
        if (!pair) return;
        var kv = pair.split('=');
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    if (path.length > 1 && path.slice(-1) === '/') path = path.slice(0, -1);
    return { path: path, query: query };
  }

  var lastPath = null;

  function render() {
    var loc = parse();
    var root = d.getElementById('view');
    var page = null, params = {};

    for (var i = 0; i < routes.length; i++) {
      var m = loc.path.match(routes[i].rx);
      if (m) {
        routes[i].keys.forEach(function (k, j) { params[k] = m[j + 1]; });
        page = routes[i].handler;
        break;
      }
    }
    if (!page) page = w.CC.Pages.notFound;

    var out;
    try {
      out = page(params, loc.query);
    } catch (err) {
      console.error('[Card Crest] page failed to render', err);
      out = {
        title: 'Something went wrong | Card Crest',
        html: '<div class="wrap section">' + w.CC.UI.empty(
          'This page could not load',
          'Something went wrong while building this view. Reload the page, and if it keeps happening reset the demo data from your profile settings.',
          'Back to home', '#/') + '</div>'
      };
    }
    if (out === false) return; // page handled its own redirect

    root.innerHTML = out.html;
    w.CC.UI.setMeta(out.title || 'Card Crest', out.desc || 'Discover, compare and maximise the value of your credit cards.');
    if (out.mount) {
      try { out.mount(root); }
      catch (err) { console.error('[Card Crest] mount failed', err); }
    }

    w.CC.UI.reveal(root);
    markActive(loc.path);

    if (loc.path !== lastPath) {
      w.scrollTo({ top: 0, behavior: 'instant' in w ? 'instant' : 'auto' });
      lastPath = loc.path;
    }
    root.focus({ preventScroll: true });
    w.dispatchEvent(new CustomEvent('cc:routed', { detail: loc }));
  }

  function markActive(path) {
    d.querySelectorAll('.hdr__nav a').forEach(function (a) {
      var href = a.getAttribute('href').slice(1);
      a.classList.toggle('is-active', href === path || (href !== '/' && path.indexOf(href) === 0));
    });
    d.querySelectorAll('.tabbar a').forEach(function (a) {
      var t = a.dataset.tab;
      a.classList.toggle('is-active', t === '/' ? path === '/' : path.indexOf(t) === 0);
    });
  }

  var Router = {
    start: function () {
      var P = w.CC.Pages;
      on('/', P.home);
      on('/cards', P.cards);
      on('/cards/:id', P.cardDetail);
      on('/compare', P.compare);
      on('/eligibility', P.eligibility);
      on('/calculator', P.calculator);
      on('/offers', P.offers);
      on('/offers/:id', P.offerDetail);
      on('/stores', P.stores);
      on('/stores/:id', P.storeDetail);
      on('/rewards', P.rewards);
      on('/refer', P.refer);
      on('/dashboard', P.dashboard);
      on('/dashboard/cards', P.myCards);
      on('/dashboard/applications', P.applications);
      on('/dashboard/transactions', P.transactions);
      on('/dashboard/notifications', P.notifications);
      on('/profile', P.profile);
      on('/login', P.login);
      on('/signup', P.signup);
      on('/help', P.help);
      on('/how-it-works', P.howItWorks);
      on('/legal/:doc', P.legal);
      on('/admin', P.admin);
      on('/admin/:section', P.admin);

      w.addEventListener('hashchange', render);
      render();
    },
    go: function (hash) { location.hash = hash; },
    refresh: render
  };

  w.CC.Router = Router;
})(window, document);
