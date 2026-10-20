/* ============================================================
   Card Crest — authService.js
   Supabase auth when js/config.js has a project URL + anon key;
   otherwise the local demo accounts. Login, signup, changePassword,
   resetPassword and init return Promises; everything else is sync.
   Supabase users are mirrored into the local store (no password)
   so the rest of the app keeps reading Auth.current() as before.
   ============================================================ */
(function (w) {
  'use strict';
  var S = w.CC.Store;
  var cfg = w.CC_CONFIG || {};
  var sb = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && w.supabase) {
    sb = w.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      // PKCE puts the link's ?code= in the query string; the implicit flow would
      // use the URL hash, which the app's hash router already owns.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    });
  }

  w.CC.Sync.init(sb);

  /* Load this user's server-side rows into the local store. */
  function hydrate(u) { return w.CC.Sync.hydrate(u).then(function () { return u; }); }

  function fail(msg) { return { ok: false, error: msg }; }

  function friendly(err) {
    var m = (err && err.message) || 'Something went wrong. Please try again.';
    if (/invalid login credentials/i.test(m)) return 'Email or password is incorrect.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first — check your inbox for the link.';
    if (/already registered|already been registered/i.test(m)) return 'An account already uses that email address.';
    if (/rate limit/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    return m;
  }

  /* Pull the profiles row and mirror it into the local store. */
  function syncUser(authUser) {
    return sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle().then(function (r) {
      var p = r.data || {};
      var meta = authUser.user_metadata || {};
      var row = {
        id: authUser.id,
        name: p.name || meta.name || authUser.email.split('@')[0],
        email: authUser.email,
        mobile: p.mobile || meta.mobile || '',
        role: p.role || 'user',
        city: p.city || '',
        employment: p.employment || '',
        income: Number(p.income) || 0,
        credit: Number(p.credit) || 0,
        joined: p.joined || String(authUser.created_at || '').slice(0, 10),
        active: p.active !== false
      };
      var existing = S.find('users', row.id);
      var user = existing ? S.update('users', row.id, row) : S.insert('users', row);
      return user;
    });
  }

  var Auth = {
    remote: !!sb,

    /* Call once at boot: restores a saved Supabase session. */
    init: function () {
      if (!sb) return Promise.resolve();
      return sb.auth.getSession().then(function (r) {
        if (/[?&]code=/.test(location.search)) { // tidy the one-time code left by an email link
          history.replaceState(null, '', location.pathname + location.hash);
        }
        var s = r.data && r.data.session;
        if (!s) { S.set('session', null); return; }
        return syncUser(s.user).then(hydrate).then(function (u) { S.set('session', u.active ? u.id : null); });
      }).catch(function () { S.set('session', null); });
    },

    current: function () {
      var id = S.get('session');
      return id ? S.find('users', id) : null;
    },
    isAdmin: function () {
      var u = Auth.current();
      return !!u && u.role === 'admin';
    },

    login: function (email, password) {
      email = String(email).trim();
      if (sb) {
        return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
          if (r.error) return fail(friendly(r.error));
          return syncUser(r.data.user).then(hydrate).then(function (u) {
            if (!u.active) {
              return sb.auth.signOut().then(function () {
                return fail('This account has been disabled. Contact support to reopen it.');
              });
            }
            S.set('session', u.id);
            return { ok: true, user: u };
          });
        }).catch(function (e) { return fail(friendly(e)); });
      }
      var u = S.where('users', function (x) {
        return x.email.toLowerCase() === email.toLowerCase();
      })[0];
      if (!u) return Promise.resolve(fail('No account found with that email address.'));
      if (u.password !== password) return Promise.resolve(fail('That password does not match our records.'));
      if (!u.active) return Promise.resolve(fail('This account has been disabled. Contact support to reopen it.'));
      S.set('session', u.id);
      return Promise.resolve({ ok: true, user: u });
    },

    signup: function (data) {
      var email = data.email.trim().toLowerCase();
      if (sb) {
        return sb.auth.signUp({
          email: email, password: data.password,
          options: { data: { name: data.name.trim(), mobile: data.mobile } }
        }).then(function (r) {
          if (r.error) return fail(friendly(r.error));
          // Supabase returns an empty identities list for an email that already exists.
          if (r.data.user && r.data.user.identities && !r.data.user.identities.length) {
            return fail('An account already uses that email address.');
          }
          // No session = email confirmation is switched on in the project.
          if (!r.data.session) return { ok: true, confirmEmail: true };
          return syncUser(r.data.user).then(hydrate).then(function (u) {
            S.set('session', u.id);
            return { ok: true, user: u };
          });
        }).catch(function (e) { return fail(friendly(e)); });
      }
      var exists = S.where('users', function (x) { return x.email.toLowerCase() === email; }).length;
      if (exists) return Promise.resolve(fail('An account already uses that email address.'));
      var u = {
        id: S.uid('u'), name: data.name.trim(), email: email,
        password: data.password, mobile: data.mobile, role: 'user', city: '',
        employment: '', income: 0, credit: 0,
        joined: new Date().toISOString().slice(0, 10), active: true
      };
      S.insert('users', u);
      S.set('session', u.id);
      w.CC.Notifications.push(u.id, 'system', 'Welcome to Card Crest',
        'Start by checking which cards you are eligible for.');
      return Promise.resolve({ ok: true, user: u });
    },

    logout: function () {
      S.set('session', null);
      if (sb) { sb.auth.signOut(); w.CC.Sync.clear(); }
    },

    resetPassword: function (email) {
      if (!sb) return Promise.resolve({ ok: true });
      return sb.auth.resetPasswordForEmail(String(email).trim(), {
        redirectTo: location.origin + location.pathname
      }).then(function (r) { return r.error ? fail(friendly(r.error)) : { ok: true }; })
        .catch(function (e) { return fail(friendly(e)); });
    },

    updateProfile: function (patch) {
      var u = Auth.current();
      if (!u) return { ok: false, error: 'You need to be signed in.' };
      if (sb) {
        patch = Object.assign({}, patch);
        delete patch.email; // email changes go through Supabase's confirmation flow, not here
        var remote = {};
        ['name', 'mobile', 'city', 'employment', 'income', 'credit'].forEach(function (k) {
          if (k in patch) remote[k] = patch[k];
        });
        if (Object.keys(remote).length) sb.from('profiles').update(remote).eq('id', u.id);
      }
      S.update('users', u.id, patch);
      return { ok: true, user: Auth.current() };
    },

    changePassword: function (oldPw, newPw) {
      var u = Auth.current();
      if (!u) return Promise.resolve(fail('You need to be signed in.'));
      if (sb) {
        // Re-verify the current password, then set the new one.
        return sb.auth.signInWithPassword({ email: u.email, password: oldPw }).then(function (r) {
          if (r.error) return fail('Your current password is not correct.');
          return sb.auth.updateUser({ password: newPw }).then(function (r2) {
            return r2.error ? fail(friendly(r2.error)) : { ok: true };
          });
        }).catch(function (e) { return fail(friendly(e)); });
      }
      if (u.password !== oldPw) return Promise.resolve(fail('Your current password is not correct.'));
      S.update('users', u.id, { password: newPw });
      return Promise.resolve({ ok: true });
    },

    referralCode: function (user) {
      var first = (user.name || 'user').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
      return 'CC-' + first.slice(0, 6) + '-' + user.id.slice(-4).toUpperCase();
    },

    /* Gate a route. Returns true if allowed, otherwise redirects. */
    require: function (adminOnly) {
      var u = Auth.current();
      if (!u) {
        w.CC.UI.toast('Sign in to continue', 'error');
        location.hash = '#/login?next=' + encodeURIComponent(location.hash.slice(1));
        return false;
      }
      if (adminOnly && u.role !== 'admin') {
        w.CC.UI.toast('That area is for Card Crest staff', 'error');
        location.hash = '#/dashboard';
        return false;
      }
      return true;
    }
  };

  w.CC.Auth = Auth;
})(window);
