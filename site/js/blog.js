/* IMRC blog: list, post page and editor.
   Two interchangeable back ends behind one small interface:
   - Supabase (production): set supabaseUrl + supabaseAnonKey in /js/config.js. RLS and the review functions
     (supabase/migrations) decide who can see and do what; this file never decides permissions.
   - Demo (no keys): everything stays in this browser's localStorage so the screens can be tried out. */
(function () {
  'use strict';
  var cfg = window.IMRC_BLOG || {};
  var DEMO = !(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var DEMO_UI = DEMO && /[?&]demo(=|&|$)/.test(location.search);   // role switcher is for developers only: /blog/?demo=1
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var WRITERS = ['author', 'trusted_author', 'reviewer', 'admin'];
  var PER_PAGE = 9;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(d) { try { return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
  function slugify(t) { var s = String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); return (s || 'post') + '-' + Math.random().toString(36).slice(2, 6); }
  function textOf(html) { var d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }

  /* ---------- sanitising: used on render AND before saving ---------- */
  var ALLOWED = ['p', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'br'];
  function sanitize(html) {
    if (!window.DOMPurify) return esc(textOf(html));
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ALLOWED, ALLOWED_ATTR: ['href', 'src', 'alt'],
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|data:image\/(?:png|jpe?g|webp|gif);base64,|\/)/i
    });
  }
  if (window.DOMPurify) {
    window.DOMPurify.addHook('afterSanitizeAttributes', function (n) {
      if (n.tagName === 'A') { n.setAttribute('rel', 'noopener noreferrer nofollow'); n.setAttribute('target', '_blank'); }
      if (n.tagName === 'IMG' && !n.getAttribute('src')) { n.remove(); return; }
      if (n.tagName === 'IMG') { n.setAttribute('loading', 'lazy'); if (!n.getAttribute('alt')) n.setAttribute('alt', ''); }
    });
  }

  /* ---------- image compression (max 1600px, WebP/JPEG) ---------- */
  function compress(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return reject(new Error('Please choose a JPEG, PNG, WebP or GIF image.'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Images must be 5 MB or smaller.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var r = Math.min(1, maxW / img.width), c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not process that image.')); }, 'image/webp', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file does not look like an image.')); };
      img.src = url;
    });
  }
  function blobToDataUrl(b) { return new Promise(function (res) { var f = new FileReader(); f.onload = function () { res(f.result); }; f.readAsDataURL(b); }); }

  /* ---------- back end: demo ---------- */
  function demoAdapter() {
    var K = 'imrc_demo_posts', R = 'imrc_demo_role';
    function load() { try { return JSON.parse(localStorage.getItem(K) || '[]'); } catch (e) { return []; } }
    function store(a) { localStorage.setItem(K, JSON.stringify(a)); }
    function role() { return localStorage.getItem(R) || 'visitor'; }
    var me = { id: 'demo-user', name: 'Demo author' };
    function pub(p) { return p.status === 'published'; }
    return {
      demo: true,
      session: function () { var r = role(); return Promise.resolve(r === 'visitor' ? null : { id: r === 'reviewer' ? 'u-rev' : me.id, name: r === 'reviewer' ? 'Demo reviewer' : me.name, role: r }); },
      setRole: function (r) { localStorage.setItem(R, r); },
      signIn: function () { return Promise.reject(new Error('Sign-in is not available yet. Please check back soon.')); },
      magicLink: function () { return Promise.reject(new Error('Sign-in is not available yet. Please check back soon.')); },
      signUp: function (d) {
        var a = JSON.parse(localStorage.getItem('imrc_demo_apps') || '[]');
        a.push({ id: 'a' + Date.now(), display_name: d.name, email: d.email, bio: d.bio, affiliation: d.affiliation, motivation: d.motivation, created_at: new Date().toISOString(), application_status: 'pending', application_note: '' });
        localStorage.setItem('imrc_demo_apps', JSON.stringify(a)); return Promise.resolve();
      },
      listApplications: function (status) {
        var a = JSON.parse(localStorage.getItem('imrc_demo_apps') || '[]');
        return Promise.resolve(a.filter(function (x) { return x.application_status === status; }).sort(function (x, y) { return x.created_at.localeCompare(y.created_at); }));
      },
      reviewApplication: function (id, approve, note) {
        var a = JSON.parse(localStorage.getItem('imrc_demo_apps') || '[]'), x = a.filter(function (y) { return y.id === id; })[0];
        if (x) { x.application_status = approve ? 'approved' : 'rejected'; x.application_note = note || ''; localStorage.setItem('imrc_demo_apps', JSON.stringify(a)); }
        return Promise.resolve();
      },
      signOut: function () { localStorage.setItem(R, 'visitor'); return Promise.resolve(); },
      listPublished: function () { return Promise.resolve(load().filter(pub).sort(function (a, b) { return (b.published_at || '').localeCompare(a.published_at || ''); })); },
      getPublished: function (slug) { return Promise.resolve(load().filter(function (p) { return pub(p) && p.slug === slug; })[0] || null); },
      listMine: function () { return Promise.resolve(load().sort(function (a, b) { return b.updated_at.localeCompare(a.updated_at); })); },
      getMine: function (id) { return Promise.resolve(load().filter(function (p) { return p.id === id; })[0] || null); },
      save: function (p) {
        var a = load(), now = new Date().toISOString(), i = a.findIndex(function (x) { return x.id === p.id; });
        if (i < 0) { p.id = 'd' + Date.now(); p.status = 'draft'; p.created_at = now; p.author_name = me.name; p.author_id = me.id; a.push(p); i = a.length - 1; }
        else { if (['draft', 'changes_requested'].indexOf(a[i].status) < 0) return Promise.reject(new Error('This post can no longer be edited.')); Object.assign(a[i], p); }
        a[i].updated_at = now; store(a); return Promise.resolve(a[i]);
      },
      submit: function (id) {
        var a = load(), p = a.filter(function (x) { return x.id === id; })[0];
        if (!p) return Promise.reject(new Error('Post not found.'));
        p.status = role() === 'trusted_author' ? 'published' : 'pending_review';
        if (p.status === 'published') p.published_at = new Date().toISOString();
        p.submitted_at = new Date().toISOString(); store(a);
        this._audit({ kind: 'post', actor_name: me.name, subject: p.title, action: p.status === 'published' ? 'auto_publish' : 'submit', note: '', post_id: p.id }); return Promise.resolve(p.status);
      },
      remove: function (id) { store(load().filter(function (x) { return !(x.id === id && x.status === 'draft'); })); return Promise.resolve(); },
      editPublished: function (id, f) {
        var a = load(), p = a.filter(function (x) { return x.id === id; })[0];
        if (!p || p.status !== 'published') return Promise.reject(new Error('Only published posts are edited this way.'));
        if (role() === 'trusted_author') { Object.assign(p, { title: f.title, excerpt: f.excerpt, body: f.body, cover: f.cover, tags: f.tags }); store(a); this._audit({ kind: 'post', actor_name: me.name, subject: f.title, action: 'auto_publish', note: 'edit', post_id: id }); return Promise.resolve(null); }
        if (p.revision && ['pending_review', 'changes_requested'].indexOf(p.revision.status) > -1) return Promise.reject(new Error('This post already has an edit waiting; update that one instead.'));
        p.revision = { id: 'r' + Date.now(), status: 'pending_review', title: f.title, excerpt: f.excerpt, body: f.body, cover: f.cover, tags: f.tags }; store(a); return Promise.resolve(p.revision.id);
      },
      getOpenRevision: function (postId) { var p = load().filter(function (x) { return x.id === postId; })[0]; return Promise.resolve(p && p.revision && ['pending_review', 'changes_requested'].indexOf(p.revision.status) > -1 ? p.revision : null); },
      updateRevision: function (rid, f) {
        var a = load(), p = a.filter(function (x) { return x.revision && x.revision.id === rid; })[0]; if (!p) return Promise.reject(new Error('Edit not found.'));
        Object.assign(p.revision, { title: f.title, excerpt: f.excerpt, body: f.body, cover: f.cover, tags: f.tags, status: 'pending_review' }); store(a); return Promise.resolve('pending_review');
      },
      listMyRevisions: function () { var m = {}; load().forEach(function (p) { if (p.revision && ['pending_review', 'changes_requested'].indexOf(p.revision.status) > -1) m[p.id] = p.revision; }); return Promise.resolve(m); },
      demoApproveRevision: function (postId) { var a = load(), p = a.filter(function (x) { return x.id === postId; })[0]; if (p && p.revision) { Object.assign(p, { title: p.revision.title, excerpt: p.revision.excerpt, body: p.revision.body, cover: p.revision.cover, tags: p.revision.tags }); p.revision.status = 'approved'; store(a); } return Promise.resolve(); },
      /* --- reviewer features (demo) --- */
      _audit: function (e) { var a = JSON.parse(localStorage.getItem('imrc_demo_audit') || '[]'); e.id = Date.now() + Math.random(); e.created_at = new Date().toISOString(); a.unshift(e); localStorage.setItem('imrc_demo_audit', JSON.stringify(a.slice(0, 300))); },
      users: function () {
        var u = JSON.parse(localStorage.getItem('imrc_demo_users') || 'null');
        if (!u) { u = [
          { id: 'demo-user', display_name: 'Demo author', email: 'author@example.org', role: 'author', active: true, ready: 0 },
          { id: 'u-trusted', display_name: 'Tru Sted', email: 'trusted@example.org', role: 'trusted_author', active: true },
          { id: 'u-dana', display_name: 'Dana Lee', email: 'dana@example.org', role: 'author', active: true, ready: 3 },
          { id: 'u-rev', display_name: 'Demo reviewer', email: 'reviewer@example.org', role: 'reviewer', active: true },
          { id: 'u-admin', display_name: 'Ada Admin', email: 'admin@example.org', role: 'admin', active: true },
          { id: 'u-pend', display_name: 'Sam Pending', email: 'sam@example.org', role: 'pending', active: true }]; localStorage.setItem('imrc_demo_users', JSON.stringify(u)); }
        return u;
      },
      listPendingPosts: function () { return Promise.resolve(load().filter(function (p) { return p.status === 'pending_review'; }).sort(function (a, b) { return (a.submitted_at || '').localeCompare(b.submitted_at || ''); })); },
      listPendingRevisions: function () { return Promise.resolve(load().filter(function (p) { return p.revision && p.revision.status === 'pending_review'; }).map(function (p) { return { id: p.revision.id, post_id: p.id, author_id: p.author_id, author_name: p.author_name, title: p.revision.title, body: p.revision.body, excerpt: p.revision.excerpt, tags: p.revision.tags, created_at: p.updated_at, live: { title: p.title, body: p.body } }; })); },
      reviewPost: function (id, action, note) {
        var a = load(), p = a.filter(function (x) { return x.id === id; })[0]; if (!p) return Promise.reject(new Error('Post not found.'));
        if (action !== 'approve' && !(note || '').trim()) return Promise.reject(new Error('A note is required for this action.'));
        var map = { approve: 'published', request_changes: 'changes_requested', reject: 'rejected', unpublish: 'unpublished' };
        p.status = map[action]; p.reviewer_note = note || ''; if (action === 'approve') p.published_at = p.published_at || new Date().toISOString(); store(a);
        this._audit({ kind: 'post', actor_name: 'Demo reviewer', subject: p.title, action: action, note: note || '', post_id: id }); return Promise.resolve();
      },
      reviewRevision: function (rid, action, note) {
        var a = load(), p = a.filter(function (x) { return x.revision && x.revision.id === rid; })[0]; if (!p) return Promise.reject(new Error('Edit not found.'));
        if (action !== 'approve' && !(note || '').trim()) return Promise.reject(new Error('A note is required for this action.'));
        if (action === 'approve') { Object.assign(p, { title: p.revision.title, excerpt: p.revision.excerpt, body: p.revision.body, tags: p.revision.tags }); p.revision.status = 'approved'; }
        else { p.revision.status = action === 'reject' ? 'rejected' : 'changes_requested'; p.revision.reviewer_note = note; }
        store(a); this._audit({ kind: 'post', actor_name: 'Demo reviewer', subject: p.title, action: 'revision_' + (action === 'approve' ? 'approve' : action), note: note || '', post_id: p.id }); return Promise.resolve();
      },
      listAutoPublished: function () {
        var posts = load(), a = JSON.parse(localStorage.getItem('imrc_demo_audit') || '[]');
        return Promise.resolve(a.filter(function (e) { return e.action === 'auto_publish'; }).slice(0, 40).map(function (e) { var p = posts.filter(function (x) { return x.id === e.post_id; })[0] || {}; return { id: e.id, created_at: e.created_at, note: e.note, actor_name: e.actor_name, post_id: e.post_id, title: p.title || e.subject, slug: p.slug, status: p.status }; }));
      },
      listUsers: function () { var self = this, u = this.users(); return Promise.resolve({ users: u, ready: u.filter(function (x) { return x.role === 'author' && x.active && x.ready >= 3; }).map(function (x) { return { user_id: x.id, approved_posts: x.ready }; }) }); },
      setRole: function (id, rl, note) { var u = this.users(), x = u.filter(function (y) { return y.id === id; })[0]; if (!x) return Promise.reject(new Error('Not found.')); var old = x.role; x.role = rl; localStorage.setItem('imrc_demo_users', JSON.stringify(u)); this._audit({ kind: 'role', actor_name: 'Demo reviewer', subject: x.display_name, action: 'role_change · ' + old + ' → ' + rl, note: note || '' }); return Promise.resolve(); },
      setActive: function (id, on, note) { var u = this.users(), x = u.filter(function (y) { return y.id === id; })[0]; if (!x) return Promise.reject(new Error('Not found.')); x.active = on; localStorage.setItem('imrc_demo_users', JSON.stringify(u)); this._audit({ kind: 'role', actor_name: 'Demo reviewer', subject: x.display_name, action: on ? 'reactivate' : 'deactivate', note: note || '' }); return Promise.resolve(); },
      auditLog: function (before) { var a = JSON.parse(localStorage.getItem('imrc_demo_audit') || '[]'); if (before) a = a.filter(function (e) { return e.created_at < before; }); return Promise.resolve(a.slice(0, 50)); },
      demoApprove: function (id) { var a = load(), p = a.filter(function (x) { return x.id === id; })[0]; if (p) { p.status = 'published'; p.published_at = new Date().toISOString(); store(a); } return Promise.resolve(); },
      upload: function (file) { return compress(file, 1000, 0.7).then(blobToDataUrl); }
    };
  }

  /* ---------- back end: Supabase ---------- */
  function supabaseAdapter() {
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    function fail(r) { if (r.error) throw new Error(r.error.message); return r.data; }
    function withAuthors(posts) {
      var ids = posts.map(function (p) { return p.author_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (!ids.length) return Promise.resolve(posts);
      return sb.from('public_authors').select('id,display_name,bio,affiliation').in('id', ids).then(function (r) {
        var m = {}; (r.data || []).forEach(function (a) { m[a.id] = a; });
        posts.forEach(function (p) { var a = m[p.author_id]; p.author_name = a ? a.display_name : 'IMRC'; p.author_bio = a ? a.bio : ''; p.author_affiliation = a ? a.affiliation : ''; });
        return posts;
      });
    }
    function norm(p) { p.cover = p.cover_image_url; return p; }
    var cols = 'id,slug,title,excerpt,body,cover_image_url,tags,status,reviewer_note,published_at,updated_at,author_id';
    var failures = 0, lockedUntil = 0;
    return {
      demo: false,
      session: function () {
        return sb.auth.getSession().then(function (r) {
          var s = r.data.session; if (!s) return null;
          return sb.from('profiles').select('id,display_name,role,active').eq('id', s.user.id).single().then(function (q) {
            if (q.data && q.data.active === false) return sb.auth.signOut().then(function () { return null; });   // deactivated accounts are signed out here too (the database already refuses their writes)
            return q.data ? { id: q.data.id, name: q.data.display_name, role: q.data.role } : null;
          });
        });
      },
      signIn: function (email, pw) {
        // Supabase rate-limits sign-ins server-side; this only slows a user (or script) that keeps failing, and shows the 429 plainly.
        var wait = Math.max(0, lockedUntil - Date.now());
        if (wait) return Promise.reject(new Error('Too many attempts. Please wait ' + Math.ceil(wait / 1000) + ' seconds and try again.'));
        return sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
          if (!r.error) { failures = 0; return; }
          failures += 1;
          if (r.error.status === 429) lockedUntil = Date.now() + 60000;
          else if (failures >= 3) lockedUntil = Date.now() + Math.min(60000, 2000 * Math.pow(2, failures - 3));
          throw new Error(r.error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'That email and password do not match.');
        });
      },
      signOut: function () { return sb.auth.signOut(); },
      magicLink: function (email) {
        // shouldCreateUser:false => a link can only sign in an EXISTING account; new accounts must use the application form
        return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/blog/' } }).then(function () { /* same answer whether or not the address exists */ });
      },
      signUp: function (d) {
        return sb.auth.signUp({ email: d.email, password: d.password, options: {
          data: { display_name: d.name, bio: d.bio, affiliation: d.affiliation, motivation: d.motivation },
          captchaToken: d.captcha || undefined, emailRedirectTo: location.origin + '/blog/' } }).then(function (r) {
          if (r.error) throw new Error(/captcha/i.test(r.error.message) ? 'Please complete the verification check and try again.' : /password/i.test(r.error.message) ? r.error.message : 'We could not create the account. Please try again in a few minutes.');
        });
      },
      listApplications: function (status) {
        return sb.from('profiles').select('id,display_name,email,bio,affiliation,motivation,created_at,application_status,application_note')
          .eq('role', 'pending').eq('email_verified', true).eq('application_status', status).order('created_at', { ascending: true }).then(fail);
      },
      /* --- reviewer features --- */
      _names: function (ids) { ids = ids.filter(function (v, i, x) { return v && x.indexOf(v) === i; }); if (!ids.length) return Promise.resolve({}); return sb.from('profiles').select('id,display_name,role').in('id', ids).then(fail).then(function (a) { var m = {}; a.forEach(function (x) { m[x.id] = x; }); return m; }); },
      listPendingPosts: function () {
        var self = this;
        return sb.from('posts').select('id,title,slug,excerpt,body,tags,author_id,submitted_at,updated_at').eq('status', 'pending_review').order('submitted_at', { ascending: true }).then(fail)
          .then(function (a) { return self._names(a.map(function (p) { return p.author_id; })).then(function (m) { a.forEach(function (p) { p.author_name = (m[p.author_id] || {}).display_name || 'Unknown'; }); return a; }); });
      },
      listPendingRevisions: function () {
        var self = this;
        return sb.from('post_revisions').select('id,post_id,author_id,title,excerpt,body,tags,created_at').eq('status', 'pending_review').order('created_at', { ascending: true }).then(fail).then(function (a) {
          if (!a.length) return a;
          return Promise.all([sb.from('posts').select('id,title,body').in('id', a.map(function (r) { return r.post_id; })).then(fail), self._names(a.map(function (r) { return r.author_id; }))]).then(function (x) {
            var live = {}; x[0].forEach(function (p) { live[p.id] = p; }); a.forEach(function (r) { r.live = live[r.post_id] || { title: '', body: '' }; r.author_name = (x[1][r.author_id] || {}).display_name || 'Unknown'; }); return a;
          });
        });
      },
      reviewPost: function (id, action, note) { return sb.rpc('review_post', { p_post: id, p_action: action, p_note: note || null }).then(fail); },
      reviewRevision: function (rid, action, note) { return sb.rpc('review_revision', { p_revision: rid, p_action: action, p_note: note || null }).then(fail); },
      listAutoPublished: function () {
        return sb.from('post_reviews').select('id,created_at,note,post_id,actor:profiles!post_reviews_actor_id_fkey(display_name),post:posts(title,slug,status)').eq('action', 'auto_publish').order('created_at', { ascending: false }).limit(40).then(fail)
          .then(function (a) { return a.map(function (r) { return { id: r.id, created_at: r.created_at, note: r.note, actor_name: r.actor && r.actor.display_name, post_id: r.post_id, title: r.post && r.post.title, slug: r.post && r.post.slug, status: r.post && r.post.status }; }); });
      },
      listUsers: function () {
        return Promise.all([sb.from('profiles').select('id,display_name,email,role,active,affiliation,created_at').order('created_at', { ascending: false }).then(fail), sb.rpc('trust_candidates').then(fail)])
          .then(function (x) { return { users: x[0], ready: x[1] || [] }; });
      },
      setRole: function (id, rl, note) { return sb.rpc('set_user_role', { p_user: id, p_role: rl, p_note: note || null }).then(fail); },
      setActive: function (id, on, note) {
        return sb.rpc('set_user_active', { p_user: id, p_active: on, p_note: note || null }).then(fail).then(function () {
          // also end their sign-in at the Auth level (edge function); the database already refuses everything they try
          return sb.functions.invoke('ban-user', { body: { user_id: id, banned: !on } }).then(function (r) { if (r.error) throw new Error('Saved, but the sign-in could not be blocked: ' + r.error.message); });
        });
      },
      auditLog: function (before) { return sb.rpc('audit_log', { p_limit: 50, p_before: before || null }).then(fail); },
      reviewApplication: function (id, approve, note) { return sb.rpc('review_application', { p_user: id, p_approve: approve, p_note: note || null }).then(fail); },
      listPublished: function () { return sb.from('posts').select(cols).eq('status', 'published').order('published_at', { ascending: false }).limit(100).then(fail).then(function (a) { return withAuthors(a.map(norm)); }); },
      getPublished: function (slug) { return sb.from('posts').select(cols).eq('status', 'published').eq('slug', slug).maybeSingle().then(fail).then(function (p) { return p ? withAuthors([norm(p)]).then(function (a) { return a[0]; }) : null; }); },
      listMine: function (uid) { return sb.from('posts').select(cols).eq('author_id', uid).order('updated_at', { ascending: false }).then(fail).then(function (a) { return a.map(norm); }); },
      getMine: function (id) { return sb.from('posts').select(cols).eq('id', id).maybeSingle().then(fail).then(function (p) { return p ? norm(p) : null; }); },
      save: function (p, uid) {
        var row = { title: p.title, slug: p.slug || null, excerpt: p.excerpt, body: p.body, cover_image_url: p.cover || null, tags: p.tags };
        if (p.id) return sb.from('posts').update(row).eq('id', p.id).select(cols).single().then(fail).then(norm);
        row.author_id = uid; return sb.from('posts').insert(row).select(cols).single().then(fail).then(norm);
      },
      remove: function (id) { return sb.from('posts').delete().eq('id', id).eq('status', 'draft').then(fail); },
      editPublished: function (id, f) { return sb.rpc('edit_published_post', { p_post: id, p_title: f.title, p_excerpt: f.excerpt, p_body: f.body, p_cover: f.cover || null, p_tags: f.tags }).then(fail); },
      getOpenRevision: function (postId) {
        return sb.from('post_revisions').select('id,title,excerpt,body,cover_image_url,tags,status,reviewer_note').eq('post_id', postId).in('status', ['pending_review', 'changes_requested']).maybeSingle().then(fail)
          .then(function (r) { if (r) r.cover = r.cover_image_url; return r; });
      },
      updateRevision: function (rid, f) { return sb.rpc('update_my_revision', { p_revision: rid, p_title: f.title, p_excerpt: f.excerpt, p_body: f.body, p_cover: f.cover || null, p_tags: f.tags }).then(fail); },
      listMyRevisions: function (uid) {
        return sb.from('post_revisions').select('post_id,id,status,reviewer_note').eq('author_id', uid).in('status', ['pending_review', 'changes_requested']).then(fail)
          .then(function (a) { var m = {}; a.forEach(function (r) { m[r.post_id] = r; }); return m; });
      },
      submit: function (id) { return sb.rpc('submit_post', { p_post: id }).then(fail); },
      upload: function (file, uid) {
        return compress(file, 1600, 0.82).then(function (blob) {
          var path = uid + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + '.webp';
          return sb.storage.from('blog-images').upload(path, blob, { contentType: 'image/webp', upsert: false }).then(function (r) {
            if (r.error) throw new Error(r.error.message);
            return sb.storage.from('blog-images').getPublicUrl(path).data.publicUrl;
          });
        });
      }
    };
  }

  var api = DEMO ? demoAdapter() : supabaseAdapter();
  var isWriter = function (s) { return !!s && WRITERS.indexOf(s.role) > -1; };
  var STATUS = { draft: 'Draft', pending_review: 'In review', changes_requested: 'Changes requested', rejected: 'Not approved', published: 'Published', unpublished: 'Unpublished' };

  /* ---------- shared UI ---------- */
  function demoBar(onChange) {
    if (!DEMO_UI) return;
    var host = $('#blog-demo'); if (!host) return;
    var cur = localStorage.getItem('imrc_demo_role') || 'visitor';
    host.hidden = false;
    host.innerHTML = '<p><strong>Demo mode.</strong> Not connected to a database yet, so posts stay in this browser only. Preview the page as: ' +
      ['visitor', 'author', 'trusted_author', 'reviewer'].map(function (r) { return '<button type="button" class="chipbtn" aria-pressed="' + (r === cur) + '" data-role="' + r + '">' + ({ visitor: 'Visitor', author: 'Author', trusted_author: 'Trusted author', reviewer: 'Reviewer' })[r] + '</button>'; }).join(' ') + '</p>';
    host.addEventListener('click', function (e) { var b = e.target.closest('[data-role]'); if (!b) return; api.setRole(b.dataset.role); onChange(); $$('[data-role]', host).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); });
  }

  function card(p) {
    var img = p.cover ? '<span class="bcard-img" style="background-image:url(\'' + esc(p.cover).replace(/'/g, '%27') + '\')" role="img" aria-label=""></span>' : '<span class="bcard-img bcard-ph" aria-hidden="true"></span>';
    return '<a class="bcard" href="/blog/post/?slug=' + encodeURIComponent(p.slug) + '">' + img + '<span class="bcard-body">' +
      (p.tags && p.tags.length ? '<span class="btags">' + p.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</span>' : '') +
      '<h3>' + esc(p.title) + '</h3><p>' + esc(p.excerpt || textOf(p.body || '').slice(0, 160)) + '</p>' +
      '<span class="meta">' + esc(p.author_name || 'IMRC') + ' · ' + esc(fmtDate(p.published_at)) + '</span></span></a>';
  }

  /* ---------- /blog/ ---------- */
  function initList() {
    var grid = $('#blog-grid'), tagsEl = $('#blog-tags'), pager = $('#blog-pager'), empty = $('#blog-empty'), mine = $('#blog-mine');
    var all = [], tag = (new URLSearchParams(location.search).get('tag') || '').toLowerCase().slice(0, 30), page = 1;
    function draw() {
      var list = all.filter(function (p) { return !tag || (p.tags || []).indexOf(tag) > -1; });
      var pages = Math.max(1, Math.ceil(list.length / PER_PAGE)); page = Math.min(page, pages);
      empty.hidden = all.length > 0; grid.innerHTML = list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(card).join('');
      var ts = []; all.forEach(function (p) { (p.tags || []).forEach(function (t) { if (ts.indexOf(t) < 0) ts.push(t); }); });
      tagsEl.hidden = !ts.length; tagsEl.innerHTML = ts.length ? ['All'].concat(ts).map(function (t) { var on = (t === 'All' && !tag) || t === tag; return '<button type="button" aria-pressed="' + on + '" data-tag="' + (t === 'All' ? '' : esc(t)) + '">' + esc(t) + '</button>'; }).join('') : '';
      pager.hidden = pages < 2; pager.innerHTML = pages < 2 ? '' : '<button type="button" data-p="-1"' + (page < 2 ? ' disabled' : '') + '>Previous</button><span>Page ' + page + ' of ' + pages + '</span><button type="button" data-p="1"' + (page >= pages ? ' disabled' : '') + '>Next</button>';
    }
    tagsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-tag]'); if (b && !(DEMO && !all.length)) { tag = b.dataset.tag; page = 1; draw(); } });
    pager.addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) { page += +b.dataset.p; draw(); window.scrollTo({ top: grid.offsetTop - 120 }); } });

    function render() {
      api.session().then(function (s) {
        api.listPublished().then(function (a) {
          if (DEMO && !a.length && grid.children.length) {   // demo has no database: keep the pre-rendered posts and filter them in place
            all = []; empty.hidden = true;
            var cards = $$('.bcard', grid), ts = [];
            cards.forEach(function (c) { (c.dataset.tags || '').split(',').filter(Boolean).forEach(function (t) { if (ts.indexOf(t) < 0) ts.push(t); }); });
            function applyTag() { cards.forEach(function (c) { c.hidden = !!tag && (c.dataset.tags || '').split(',').indexOf(tag) < 0; }); tagsEl.innerHTML = ts.length ? ['All'].concat(ts).map(function (t) { var on = (t === 'All' && !tag) || t === tag; return '<button type="button" aria-pressed="' + on + '" data-tag="' + (t === 'All' ? '' : esc(t)) + '">' + esc(t) + '</button>'; }).join('') : ''; tagsEl.hidden = !ts.length; }
            tagsEl.onclick = function (e) { var b = e.target.closest('[data-tag]'); if (b) { tag = b.dataset.tag; applyTag(); } };
            applyTag(); return;
          }
          all = a; draw();
        }).catch(function () { if (!grid.children.length) grid.innerHTML = '<p class="muted">The blog could not be loaded right now. Please try again in a moment.</p>'; });
        mine.hidden = !isWriter(s);
        var staff = !!s && (s.role === 'reviewer' || s.role === 'admin');
        $('#blog-review-link').hidden = !staff;
        if (staff) api.listApplications('pending').then(function (a) { $('#blog-review-count').textContent = a.length; $('#blog-review-count').hidden = !a.length; }).catch(function () {});
        $('#blog-signin').hidden = !!s;
        $('#blog-signin-link').hidden = !!s; $('#blog-signout-top').hidden = !s;
        $('#blog-pending').hidden = !(s && !isWriter(s));
        if (isWriter(s)) {
          $('#blog-who').textContent = s.name;
          api.listMine(s.id).then(function (a) {
            var drafts = a.filter(function (p) { return p.status === 'draft' || p.status === 'changes_requested'; });
            var rest = a.filter(function (p) { return drafts.indexOf(p) < 0; });
            $('#drafts-count').textContent = drafts.length;
            $('#drafts-list').innerHTML = drafts.length ? drafts.map(function (p) {
              var snip = textOf(p.body || '').slice(0, 90);
              return '<li class="mine"><span><a href="/blog/write/?id=' + encodeURIComponent(p.id) + '"><strong>' + esc(p.title || 'Untitled draft') + '</strong></a>' +
                (p.status === 'changes_requested' ? ' <span class="badge b-changes_requested">Changes requested</span>' : '') +
                '<br><span class="small muted">Edited ' + esc(fmtDate(p.updated_at)) + (snip ? ' · ' + esc(snip) + (snip.length >= 90 ? '…' : '') : '') + '</span>' +
                (p.reviewer_note ? '<br><span class="small muted">Reviewer note: ' + esc(p.reviewer_note) + '</span>' : '') + '</span>' +
                '<span class="mine-act"><a class="link-arrow" href="/blog/write/?id=' + encodeURIComponent(p.id) + '">Continue</a>' +
                (p.status === 'draft' ? '<button type="button" class="chipbtn" data-delete="' + esc(p.id) + '" aria-label="Delete draft ' + esc(p.title || 'Untitled') + '">Delete</button>' : '') + '</span></li>';
            }).join('') : '<li class="muted">No drafts yet. Start one with “Write a post”.</li>';
            $('#blog-mine-list').innerHTML = rest.length ? rest.map(function (p) {
              return '<li class="mine"><span><strong>' + esc(p.title || 'Untitled') + '</strong> <span class="badge b-' + p.status + '">' + STATUS[p.status] + '</span>' +
                (p.reviewer_note && ['rejected', 'unpublished'].indexOf(p.status) > -1 ? '<br><span class="small muted">Reviewer note: ' + esc(p.reviewer_note) + '</span>' : '') + '</span>' +
                '<span class="mine-act">' + (p.status === 'published' ? '<a class="link-arrow" href="/blog/post/?slug=' + encodeURIComponent(p.slug) + '">View</a>' : '') +
                (DEMO && p.status === 'pending_review' ? '<button type="button" class="chipbtn" data-approve="' + esc(p.id) + '">Approve (demo)</button>' : '') + '</span></li>';
            }).join('') : '<li class="muted">Nothing uploaded yet.</li>';
          }).catch(function () {});
        }
      });
    }
    $('#blog-mine-list').addEventListener('click', function (e) { var b = e.target.closest('[data-approve]'); if (b) api.demoApprove(b.dataset.approve).then(render); });
    $('#drafts-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-delete]'); if (!b) return;
      if (confirm('Delete this draft? This cannot be undone.')) api.remove(b.dataset.delete).then(render).catch(function (err) { alert('Could not delete: ' + err.message); });
    });
    $('#blog-signin').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, st = $('.form-status', f);
      if (!f.password.value) { st.textContent = 'Enter your password, or choose “Email me a sign-in link”.'; st.className = 'form-status show info'; return; }
      api.signIn(f.email.value, f.password.value).then(render).catch(function (err) { st.textContent = err.message; st.className = 'form-status show info'; });
    });
    $('#blog-magic').addEventListener('click', function () {
      var f = $('#blog-signin'), st = $('.form-status', f), em = f.email.value.trim();
      if (!em) { st.textContent = 'Enter your email address first.'; st.className = 'form-status show info'; f.email.focus(); return; }
      api.magicLink(em).then(function () { st.textContent = 'If that address has an account, a sign-in link is on its way.'; st.className = 'form-status show ok'; }).catch(function (err) { st.textContent = err.message; st.className = 'form-status show info'; });
    });
    $$('[data-signout]').forEach(function (b) { b.addEventListener('click', function () { api.signOut().then(render); }); });
    demoBar(render); render();
  }

  /* ---------- /blog/post/ ---------- */
  function initPost() {
    var q = new URLSearchParams(location.search), slug = q.get('slug'), root = $('#post-root');
    if (!slug) { root.innerHTML = '<p>That post could not be found. <a href="/blog/">Back to the blog</a></p>'; return; }
    api.getPublished(slug).then(function (p) {
      if (!p) { root.innerHTML = '<h1 class="h2">Post not found</h1><p>It may have been unpublished or the link may be wrong. <a class="link-arrow" href="/blog/">Back to the blog</a></p>'; return; }
      document.title = p.title + ' · IMRC Blog';
      $('#post-hero-title').textContent = p.title;
      var body = sanitize(p.body || '');
      root.innerHTML = (p.cover ? '<img class="post-cover" src="' + esc(p.cover) + '" alt="">' : '') +
        '<p class="meta">' + esc(p.author_name || 'IMRC') + ' · ' + esc(fmtDate(p.published_at)) + '</p>' +
        '<div class="blog-body">' + body + '</div>' +
        (p.tags && p.tags.length ? '<p class="btags">' + p.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</p>' : '') +
        '<aside class="author-card"><strong>' + esc(p.author_name || 'IMRC') + '</strong>' + (p.author_affiliation ? '<br><span class="muted small">' + esc(p.author_affiliation) + '</span>' : '') + (p.author_bio ? '<p class="small">' + esc(p.author_bio) + '</p>' : '') + '</aside>' +
        '<p class="notice" role="note">This post is for education and is not a substitute for professional assessment or treatment. Views are the author’s own.</p>' +
        '<p><button type="button" class="btn btn-line btn-sm" id="copy-link" style="padding-right:1.1rem"><span>Copy link</span></button></p>';
      $('#copy-link').addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(location.href); this.firstChild.textContent = 'Link copied'; });
      api.listPublished().then(function (all) {
        var rel = all.filter(function (x) { return x.slug !== slug && (x.tags || []).some(function (t) { return (p.tags || []).indexOf(t) > -1; }); }).slice(0, 3);
        if (rel.length) { $('#post-related').hidden = false; $('#post-related-grid').innerHTML = rel.map(card).join(''); }
      });
    }).catch(function () { root.innerHTML = '<p>This post could not be loaded. <a href="/blog/">Back to the blog</a></p>'; });
  }

  /* ---------- /blog/write/ ---------- */
  function initWrite() {
    var form = $('#editor'), gate = $('#write-gate'), ed = $('#ed-body'), status = $('#ed-status'), fmt = $('#ed-fmt'), saved = $('#ed-saved');
    var q = new URLSearchParams(location.search), postId = q.get('id'), isNew = q.get('new') === '1';
    var cover = '', dirty = false, saving = false, me = null, savedRange = null, slugTouched = false, mode = 'new', revId = null, timer = null, loaded = null;

    function say(msg, kind) { status.textContent = msg; status.className = 'form-status show ' + (kind || 'info'); }
    function stamp(msg) { saved.textContent = msg; }
    function nowTime() { return new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }); }
    function words() { var t = textOf(ed.innerHTML); return t ? t.split(' ').length : 0; }
    function counts() { var w = words(); $('#ed-count').textContent = w + (w === 1 ? ' word' : ' words') + ' · ' + Math.max(1, Math.ceil(w / 200)) + ' min read'; }
    function mark() { dirty = true; counts(); stamp('Unsaved changes'); if (mode === 'new' || mode === 'draft') { clearTimeout(timer); timer = setTimeout(autosave, 4000); } }
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    /* toolbar */
    function exec(cmd, val) { ed.focus(); restoreRange(); document.execCommand(cmd, false, val || null); mark(); sync(); }
    function saveRange() { var s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); }
    function restoreRange() { if (savedRange) { var s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } }
    document.addEventListener('selectionchange', function () { if (document.activeElement === ed) { saveRange(); sync(); } });
    function sync() {
      ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].forEach(function (c) { var b = $('[data-cmd="' + c + '"]'); if (b) b.setAttribute('aria-pressed', document.queryCommandState(c)); });
      var blk = (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, ''); fmt.value = ['h2', 'h3', 'blockquote'].indexOf(blk) > -1 ? blk : 'p';
    }
    $$('[data-cmd]').forEach(function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); }); b.addEventListener('click', function () { exec(b.dataset.cmd); }); });
    fmt.addEventListener('change', function () { exec('formatBlock', fmt.value); });
    $('#ed-link').addEventListener('click', function () { saveRange(); var u = prompt('Link address (https://…)'); if (u && /^(https?:|mailto:)/i.test(u)) exec('createLink', u); else if (u) say('Links must start with https:// or mailto:', 'info'); });
    ed.addEventListener('input', mark);
    ed.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); primarySave(); } });
    ed.addEventListener('paste', function (e) {
      e.preventDefault(); var cd = e.clipboardData, html = cd.getData('text/html'), txt = cd.getData('text/plain');
      document.execCommand('insertHTML', false, html ? sanitize(html).replace(/<img[^>]*>/g, '') : esc(txt).replace(/\n/g, '<br>')); mark();
    });
    ed.addEventListener('click', function (e) {   // click a picture to change its description
      if (e.target.tagName === 'IMG') { var a = prompt('Describe this image for people using screen readers', e.target.getAttribute('alt') || ''); if (a) { e.target.setAttribute('alt', a); mark(); } }
    });

    /* images */
    var file = $('#ed-file'), coverFile = $('#ed-cover-file');
    $('#ed-image').addEventListener('click', function () { saveRange(); file.click(); });
    file.addEventListener('change', function () {
      var f = file.files[0]; file.value = ''; if (!f) return; say('Uploading image…', 'info');
      api.upload(f, me.id).then(function (url) {
        var alt = prompt('Describe this image for people using screen readers (required)'); if (!alt) { say('Image not added: a short description is required.', 'info'); return; }
        ed.focus(); restoreRange(); document.execCommand('insertHTML', false, '<img src="' + esc(url) + '" alt="' + esc(alt) + '"><p><br></p>'); mark(); say('Image added. Click it any time to change its description.', 'ok');
      }).catch(function (err) { say(err.message, 'info'); });
    });
    $('#ed-cover-btn').addEventListener('click', function () { coverFile.click(); });
    coverFile.addEventListener('change', function () {
      var f = coverFile.files[0]; coverFile.value = ''; if (!f) return; say('Uploading cover…', 'info');
      api.upload(f, me.id).then(function (url) { cover = url; showCover(); mark(); say('Cover image set.', 'ok'); }).catch(function (err) { say(err.message, 'info'); });
    });
    $('#ed-cover-clear').addEventListener('click', function () { cover = ''; showCover(); mark(); });
    function showCover() { var im = $('#ed-cover-img'); im.hidden = !cover; if (cover) im.src = cover; $('#ed-cover-clear').hidden = !cover; }
    $('#ed-title').addEventListener('input', function () { mark(); if (!slugTouched && mode !== 'published') $('#ed-slug').value = this.value.trim() ? slugify(this.value) : ''; });
    $('#ed-slug').addEventListener('input', function () { slugTouched = true; mark(); });

    function collect() {
      var title = $('#ed-title').value.trim(), body = sanitize(ed.innerHTML), slug = $('#ed-slug').value.trim() || (title ? slugify(title) : '');
      var tags = $('#ed-tags').value.split(',').map(function (t) { return t.trim().toLowerCase().slice(0, 30); }).filter(Boolean).slice(0, 6);
      return { id: postId || undefined, title: title, slug: slug, excerpt: $('#ed-excerpt').value.trim() || textOf(body).slice(0, 180), body: body, cover: cover, tags: tags };
    }
    function friendly(err) {
      var m = err && err.message || '';
      if (/duplicate|unique|slug/i.test(m)) { $('#ed-details').open = true; return 'That web address is already used by another post. Change it under “Post details”.'; }
      if (/unsafe_html/.test(m)) return 'The post contains something that is not allowed (scripts or embedded content). Remove it and try again.';
      if (/too_long/.test(m)) return 'The post is too long. Please shorten it.';
      if (/invalid_tags/.test(m)) return 'Topics must be 1 to 30 characters each, with at most 6.';
      if (/revision_exists/.test(m)) return 'This post already has an edit waiting. Reload the page to continue that edit.';
      return m;
    }
    function busy(on) { saving = on; $$('button', form).forEach(function (b) { b.disabled = on; }); }
    var slugOk = function (v) { return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v); };

    /* ---- save a draft (manual or autosave) ---- */
    function saveDraft(silent) {
      var p = collect();
      if (!silent && !p.title) { say('Add a title first.', 'info'); $('#ed-title').focus(); return Promise.reject(); }
      if (p.slug && !slugOk(p.slug)) { if (!silent) say('The web address can only use lowercase letters, numbers and hyphens.', 'info'); return Promise.reject(); }
      if (saving) return Promise.reject();
      if (silent) saving = true; else busy(true);
      return api.save(p, me.id).then(function (r) {
        var first = !postId; postId = r.id; dirty = false; mode = r.status === 'draft' || r.status === 'changes_requested' ? 'draft' : mode;
        history.replaceState(null, '', '/blog/write/?id=' + encodeURIComponent(r.id)); stamp('Saved · ' + nowTime()); if (first) draftBar(); return r;
      }).catch(function (err) { if (silent) stamp('Could not save automatically. Your text is still here.'); else say('Could not save: ' + friendly(err), 'info'); throw err; })
        .finally(function () { if (silent) saving = false; else busy(false); });
    }
    function autosave() { if (!dirty || saving || (!$('#ed-title').value.trim() && !textOf(ed.innerHTML))) return; saveDraft(true).catch(function () {}); }

    /* ---- save changes to a PUBLISHED post ---- */
    function saveEdit() {
      var p = collect(); if (!p.title || !textOf(p.body)) { say('A post needs a title and some text.', 'info'); return; }
      busy(true);
      (revId ? api.updateRevision(revId, p).then(function () { return revId; }) : api.editPublished(postId, p)).then(function (rid) {
        dirty = false; stamp('Saved · ' + nowTime());
        if (rid === null) say('Your changes are live.', 'ok'); else { revId = rid; say('Your edit was sent to a reviewer. The live post stays as it is until it is approved.', 'ok'); }
      }).catch(function (err) { say('Could not save: ' + friendly(err), 'info'); }).finally(function () { busy(false); });
    }
    function primarySave() { if (mode === 'published') saveEdit(); else saveDraft(false).then(function () { say('Draft saved. Find it in your drafts any time.', 'ok'); }).catch(function () {}); }

    $('#ed-draft').addEventListener('click', primarySave);
    $('#ed-save-edit').addEventListener('click', saveEdit);
    $('#ed-preview').addEventListener('click', function () {
      var box = $('#ed-preview-box'), on = box.hidden; box.hidden = !on; ed.hidden = on; $('#ed-toolbar').hidden = on; this.firstChild.textContent = on ? 'Back to editing' : 'Preview';
      if (on) box.innerHTML = '<h2 class="h2">' + esc($('#ed-title').value || 'Untitled') + '</h2><div class="blog-body">' + sanitize(ed.innerHTML) + '</div>';
    });

    /* ---- upload: pre-flight checklist ---- */
    var dlg = $('#ed-dialog');
    function checks() {
      var p = collect(), w = words(), imgs = $$('img', ed), noAlt = imgs.filter(function (i) { return !(i.getAttribute('alt') || '').trim(); }).length;
      return [
        { ok: !!p.title, text: 'The post has a title' },
        { ok: !!p.slug && slugOk(p.slug), text: 'The web address is valid' },
        { ok: w >= 50, text: 'The post has at least 50 words (now ' + w + ')' },
        { ok: noAlt === 0, text: imgs.length ? 'Every image has a description' + (noAlt ? ' (' + noAlt + ' missing)' : '') : 'No images to describe' },
        { ok: !!cover, info: true, text: cover ? 'Cover image added' : 'No cover image (optional)' }
      ];
    }
    function updateDlg() {
      var c = checks(), req = c.filter(function (x) { return !x.info; }).every(function (x) { return x.ok; });
      $('#dlg-checks').innerHTML = c.map(function (x) { return '<li class="' + (x.ok ? 'ck-ok' : x.info ? 'ck-info' : 'ck-no') + '"><span aria-hidden="true">' + (x.ok ? '✓' : x.info ? '–' : '✕') + '</span> ' + esc(x.text) + '</li>'; }).join('');
      $('#dlg-go').disabled = !(req && $('#dlg-ok1').checked && $('#dlg-ok2').checked);
      return req;
    }
    $('#ed-upload').addEventListener('click', function () {
      $('#dlg-ok1').checked = false; $('#dlg-ok2').checked = false;
      var trusted = me.role === 'trusted_author' || me.role === 'admin';
      $('#dlg-what').textContent = trusted ? 'You are a trusted author, so this post will go live straight away.' : 'A reviewer will check this post before it goes live. You will not be able to edit it while it is in review.';
      updateDlg(); dlg.showModal();
    });
    $$('#ed-dialog input').forEach(function (i) { i.addEventListener('change', updateDlg); });
    $('#dlg-back').addEventListener('click', function () { dlg.close(); });
    $('#dlg-go').addEventListener('click', function () {
      if (!updateDlg()) return; dlg.close(); clearTimeout(timer);
      saveDraft(false).then(function (r) { return api.submit(r.id); }).then(function (st) {
        dirty = false; mode = 'done'; localStorage.removeItem('imrc_blog_autosave');
        say(st === 'published' ? 'Your post is live.' : 'Submitted. A reviewer will check it before it goes live.', 'ok');
        setTimeout(function () { location.href = '/blog/dashboard/'; }, 1400);
      }).catch(function (err) { if (err && err.message) say('Could not upload: ' + friendly(err), 'info'); });
    });

    /* ---- drafts bar ---- */
    function draftBar() {
      api.listMine(me.id).then(function (a) {
        var ds = a.filter(function (p) { return p.status === 'draft' || p.status === 'changes_requested'; }), bar = $('#ed-drafts');
        bar.hidden = false;
        bar.innerHTML = '<span class="small muted">Your drafts</span>' + ds.map(function (p) {
          return '<a class="dchip" href="/blog/write/?id=' + encodeURIComponent(p.id) + '"' + (p.id === postId ? ' aria-current="page"' : '') + '>' + esc(p.title || 'Untitled draft') + '</a>';
        }).join('') + '<a class="dchip dchip-new" href="/blog/write/?new=1">+ New draft</a><a class="dchip" href="/blog/dashboard/">Dashboard</a>';
      }).catch(function () {});
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('#ed-drafts a'); if (!a || !dirty) return;
      if (!confirm('You have unsaved changes in this draft. Leave without saving?')) e.preventDefault(); else dirty = false;
    });

    /* ---- load ---- */
    function fill(p) {
      $('#ed-title').value = p.title || ''; $('#ed-slug').value = p.slug || ''; slugTouched = !!p.slug; ed.innerHTML = sanitize(p.body || ''); $('#ed-excerpt').value = p.excerpt || '';
      $('#ed-tags').value = (p.tags || []).join(', '); cover = p.cover || ''; showCover(); counts();
    }
    function load() {
      api.session().then(function (s) {
        me = s; var ok = isWriter(s); gate.hidden = ok; form.hidden = !ok;
        if (!ok) { $('#gate-msg').textContent = s ? 'Your account is waiting for approval, so you cannot write posts yet.' : 'Only approved IMRC authors can write posts. Sign in on the blog page to continue.'; return; }
        draftBar();
        if (!postId) {
          mode = 'new'; if (isNew) { localStorage.removeItem('imrc_blog_autosave'); }
          counts(); stamp('Not saved yet'); return;
        }
        api.getMine(postId).then(function (p) {
          if (!p) { say('That post could not be found.', 'info'); return; }
          loaded = p;
          if (p.status === 'draft' || p.status === 'changes_requested') { mode = 'draft'; fill(p); stamp('Saved'); if (p.reviewer_note) say('Reviewer note: ' + p.reviewer_note, 'info'); return; }
          if (p.status === 'published') {
            mode = 'published'; fill(p); $('#ed-slug').disabled = true; $('#ed-mode-published').hidden = false; $('#ed-draft').hidden = true; $('#ed-upload').hidden = true; $('#ed-save-edit').hidden = false;
            var trusted = me.role === 'trusted_author' || me.role === 'admin';
            $('#ed-mode-published p').textContent = trusted ? 'You are editing a published post. As a trusted author, your changes go live as soon as you save.' : 'You are editing a published post. The live version stays up until a reviewer approves your changes.';
            stamp('Live post');
            api.getOpenRevision(p.id).then(function (r) { if (r) { revId = r.id; fill(r); say(r.status === 'changes_requested' && r.reviewer_note ? 'A reviewer asked for changes to your edit: ' + r.reviewer_note : 'Your last edit is still waiting for review. You can keep changing it.', 'info'); } }).catch(function () {});
            return;
          }
          // in review / not approved / unpublished: read-only
          form.hidden = true; $('#ed-readonly').hidden = false; $('#ro-title').textContent = p.title || 'Untitled';
          $('#ro-status').textContent = STATUS[p.status]; $('#ro-status').className = 'badge b-' + p.status;
          $('#ro-note').textContent = p.reviewer_note ? 'Reviewer note: ' + p.reviewer_note : '';
          $('#ro-body').innerHTML = sanitize(p.body || '');
          $('#ro-msg').textContent = p.status === 'pending_review' ? 'This post is waiting for a reviewer, so it cannot be edited right now.' : p.status === 'rejected' ? 'This post was not approved.' : 'This post was taken down by a reviewer.';
        });
      });
    }
    window.addEventListener('pagehide', function () { if (dirty && (mode === 'new' || mode === 'draft')) { var p = collect(); try { localStorage.setItem('imrc_blog_autosave', JSON.stringify(p)); } catch (e) {} } });
    demoBar(function () { location.reload(); }); load();
  }

  /* ---------- /blog/dashboard/ ---------- */
  function initDashboard() {
    var gate = $('#db-gate'), main = $('#db-main'), list = $('#db-list'), filt = 'all', all = [], revs = {}, me = null;
    var GROUPS = { all: null, draft: ['draft'], changes: ['changes_requested'], review: ['pending_review'], live: ['published'], off: ['rejected', 'unpublished'] };
    function inGroup(p, g) { return !GROUPS[g] || GROUPS[g].indexOf(p.status) > -1; }
    function row(p) {
      var rv = revs[p.id], notes = [];
      if (p.reviewer_note && ['changes_requested', 'rejected', 'unpublished'].indexOf(p.status) > -1) notes.push('Reviewer note: ' + p.reviewer_note);
      if (rv && rv.reviewer_note && rv.status === 'changes_requested') notes.push('Reviewer note on your edit: ' + rv.reviewer_note);
      var acts = [];
      if (p.status === 'draft' || p.status === 'changes_requested') acts.push('<a class="link-arrow" href="/blog/write/?id=' + encodeURIComponent(p.id) + '">Continue</a>');
      if (p.status === 'draft') acts.push('<button type="button" class="chipbtn" data-delete="' + esc(p.id) + '" aria-label="Delete draft ' + esc(p.title || 'Untitled') + '">Delete</button>');
      if (p.status === 'published') acts.push('<a class="link-arrow" href="/blog/write/?id=' + encodeURIComponent(p.id) + '">Edit</a>', '<a class="link-arrow" href="/blog/post/?slug=' + encodeURIComponent(p.slug) + '">View</a>');
      if (['pending_review', 'rejected', 'unpublished'].indexOf(p.status) > -1) acts.push('<a class="link-arrow" href="/blog/write/?id=' + encodeURIComponent(p.id) + '">Open</a>');
      if (DEMO && p.status === 'pending_review') acts.push('<button type="button" class="chipbtn" data-approve="' + esc(p.id) + '">Approve (demo)</button>');
      if (DEMO && rv && rv.status === 'pending_review') acts.push('<button type="button" class="chipbtn" data-approve-rev="' + esc(p.id) + '">Approve edit (demo)</button>');
      return '<li class="mine"><span><strong>' + esc(p.title || 'Untitled') + '</strong> <span class="badge b-' + p.status + '">' + STATUS[p.status] + '</span>' +
        (rv ? ' <span class="badge b-pending_review">' + (rv.status === 'changes_requested' ? 'Edit sent back' : 'Edit in review') + '</span>' : '') +
        '<br><span class="small muted">Edited ' + esc(fmtDate(p.updated_at)) + (p.status === 'published' ? ' · published ' + esc(fmtDate(p.published_at)) : '') + '</span>' +
        notes.map(function (n) { return '<br><span class="small muted">' + esc(n) + '</span>'; }).join('') + '</span><span class="mine-act">' + acts.join('') + '</span></li>';
    }
    function draw() {
      Object.keys(GROUPS).forEach(function (g) { var n = all.filter(function (p) { return inGroup(p, g); }).length; var b = $('[data-g="' + g + '"] .badge'); if (b) b.textContent = n; });
      var items = all.filter(function (p) { return inGroup(p, filt); });
      list.innerHTML = items.length ? items.map(row).join('') : '<li class="muted">Nothing here yet.</li>';
    }
    function load() {
      api.session().then(function (s) {
        me = s; var ok = isWriter(s); gate.hidden = ok; main.hidden = !ok; if (!ok) return;
        $('#db-who').textContent = s.name;
        Promise.all([api.listMine(s.id), api.listMyRevisions(s.id)]).then(function (r) { all = r[0]; revs = r[1] || {}; draw(); }).catch(function (err) { list.innerHTML = '<li class="muted">Could not load your posts: ' + esc(err.message) + '</li>'; });
      });
    }
    $$('[data-g]').forEach(function (b) { b.addEventListener('click', function () { filt = b.dataset.g; $$('[data-g]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw(); }); });
    list.addEventListener('click', function (e) {
      var d = e.target.closest('[data-delete]'), a = e.target.closest('[data-approve]'), r = e.target.closest('[data-approve-rev]');
      if (d && confirm('Delete this draft? This cannot be undone.')) api.remove(d.dataset.delete).then(load).catch(function (err) { alert('Could not delete: ' + err.message); });
      if (a) api.demoApprove(a.dataset.approve).then(load);
      if (r) api.demoApproveRevision(r.dataset.approveRev).then(load);
    });
    $$('[data-signout]').forEach(function (b) { b.addEventListener('click', function () { api.signOut().then(function () { location.href = '/blog/'; }); }); });
    demoBar(function () { location.reload(); }); load();
  }

  /* ---------- /blog/join/ : apply to write ---------- */
  function initJoin() {
    var f = $('#join-form'), done = $('#join-done'), tsId = null, busy = false;
    var why = $('#j-why'), count = $('#j-why-count');
    function upd() { var n = why.value.trim().length; count.textContent = n + ' / 500 (at least 50)'; count.style.color = n > 500 ? 'var(--err)' : ''; }
    why.addEventListener('input', upd); upd();
    if (DEMO_UI) $('#join-demo').hidden = false;
    if (cfg.turnstileSiteKey && !DEMO) {
      var iv = setInterval(function () { if (window.turnstile) { clearInterval(iv); tsId = window.turnstile.render('#ts-box', { sitekey: cfg.turnstileSiteKey }); } }, 200);
    }
    function bad(id, msg) { var fld = $('#' + id).closest('.field'); fld.classList.add('bad'); $('.err', fld).textContent = msg; return fld; }
    function clear() { $$('.field.bad', f).forEach(function (x) { x.classList.remove('bad'); }); }
    f.addEventListener('submit', function (e) {
      e.preventDefault(); if (busy || $('#j-hp').value) return; clear();
      var d = { name: $('#j-name').value.trim(), email: $('#j-email').value.trim(), password: $('#j-pw').value, bio: $('#j-bio').value.trim(), affiliation: $('#j-aff').value.trim(), motivation: why.value.trim() }, first = null;
      function chk(cond, id, msg) { if (cond) { var fld = bad(id, msg); first = first || fld; } }
      chk(!d.name, 'j-name', 'Enter your name.');
      chk(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email), 'j-email', 'Enter an email address like name@example.org.');
      chk(!DEMO && d.password.length < 10, 'j-pw', 'Use at least 10 characters.');
      chk(!d.bio || d.bio.length > 500, 'j-bio', d.bio ? 'Keep the bio under 500 characters.' : 'Add a short bio (one or two sentences).');
      chk(!d.affiliation, 'j-aff', 'Tell us where you work or study, or write “independent”.');
      chk(d.motivation.length < 50 || d.motivation.length > 500, 'j-why', 'Please write between 50 and 500 characters (now ' + d.motivation.length + ').');
      chk(!$('#j-agree').checked, 'j-agree', 'Please confirm you will follow the writing guidelines.');
      if (first) { $('input,textarea', first).focus(); return; }
      if (tsId !== null && window.turnstile) { d.captcha = window.turnstile.getResponse(tsId); if (!d.captcha) { $('#join-status').textContent = 'Please complete the verification check.'; $('#join-status').className = 'form-status show info'; return; } }
      busy = true; $('button[type=submit]', f).disabled = true;
      api.signUp(d).then(function () { f.hidden = true; done.hidden = false; done.focus(); })
        .catch(function (err) { $('#join-status').textContent = err.message; $('#join-status').className = 'form-status show info'; if (tsId !== null && window.turnstile) window.turnstile.reset(tsId); })
        .finally(function () { busy = false; $('button[type=submit]', f).disabled = false; });
    });
  }

  /* ---------- /blog/review/ : reviewer dashboard ---------- */
  function blocksOf(html) { var d = document.createElement('div'); d.innerHTML = sanitize(html || ''); return [].slice.call(d.children).map(function (e) { return e.outerHTML; }); }
  function diffBlocks(a, b) {   // longest-common-subsequence over top-level blocks
    var n = a.length, m = b.length, t = [], i, j;
    for (i = 0; i <= n; i++) { t.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    var L = [], R = []; i = 0; j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { L.push([a[i], 'same']); R.push([b[j], 'same']); i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) { L.push([a[i], 'del']); i++; } else { R.push([b[j], 'add']); j++; } }
    while (i < n) L.push([a[i++], 'del']); while (j < m) R.push([b[j++], 'add']);
    return { left: L, right: R };
  }
  function diffCol(rows, label) { return '<div class="diffcol"><p class="small muted" style="margin:0 0 .4rem"><strong>' + label + '</strong></p>' + rows.map(function (r) { return '<div class="d-' + r[1] + '">' + r[0] + '</div>'; }).join('') + '</div>'; }
  var AUDIT_LABEL = { submit: 'Submitted for review', auto_publish: 'Published by a trusted author', approve: 'Approved', request_changes: 'Requested changes', reject: 'Rejected', unpublish: 'Unpublished', revision_submit: 'Sent an edit for review', revision_approve: 'Approved an edit', revision_request_changes: 'Requested changes to an edit', revision_reject: 'Rejected an edit' };
  var ROLE_LABEL = { pending: 'Pending', author: 'Author', trusted_author: 'Trusted author', reviewer: 'Reviewer', admin: 'Admin' };

  function initReview() {
    var gate = $('#rv-gate'), main = $('#rv-main'), status = $('#rv-status'), me = null, tab = 'apps';
    function say(m, k) { status.textContent = m; status.className = 'form-status show ' + (k || 'info'); }
    function fail(err) { say('Something went wrong: ' + (err && err.message || err), 'info'); }
    var isAdmin = function () { return me && me.role === 'admin'; };
    function noteOf(card) { return $('textarea', card).value.trim(); }
    function needNote(card, action) { var n = noteOf(card); if (action !== 'approve' && !n) { var f = $('.field', card); f.classList.add('bad'); $('.err', f).textContent = 'A note is required for this action. It is sent to the author.'; $('textarea', card).focus(); return null; } return n; }
    function noteField(id, label) { return '<div class="field"><label for="n-' + esc(id) + '">' + label + '</label><textarea id="n-' + esc(id) + '" maxlength="600" style="min-height:80px"></textarea><p class="err" role="alert"></p></div>'; }
    var ICON = function (d) { return '<svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
    var btn3 = function (kind, act, label, icon) { return '<button type="button" class="btn btn-' + kind + ' btn-sm" data-act="' + act + '"><span>' + label + '</span><span class="arr-wrap">' + ICON(icon) + '</span></button>'; };
    var CHECK = 'M20 6 9 17l-5-5', X = 'M6 6l12 12M18 6 6 18', EDIT = 'M5 12h14M13 6l6 6-6 6';

    /* ---- applications ---- */
    var appView = 'pending';
    function drawApps() {
      var list = $('#rv-apps-list');
      api.listApplications(appView).then(function (a) {
        if (appView === 'pending') $('#cnt-apps').textContent = a.length;
        list.innerHTML = a.length ? a.map(function (x) {
          return '<article class="card app" data-id="' + esc(x.id) + '"><div class="app-head"><div><h3>' + esc(x.display_name) + '</h3><p class="small muted" style="margin:0">' + esc(x.affiliation) + ' · ' + esc(x.email) + ' · applied ' + esc(fmtDate(x.created_at)) + '</p></div></div>' +
            '<dl class="defs"><dt>Bio</dt><dd>' + esc(x.bio) + '</dd><dt>Why write for IMRC</dt><dd>' + esc(x.motivation) + '</dd>' + (x.application_note ? '<dt>Your note</dt><dd>' + esc(x.application_note) + '</dd>' : '') + '</dl>' +
            (appView === 'pending' ? '<div class="field"><label for="an-' + esc(x.id) + '">Note to the applicant (optional, sent by email)</label><textarea id="an-' + esc(x.id) + '" maxlength="500" style="min-height:80px"></textarea></div><div class="btn-row">' + btn3('dark', 'approve-app', 'Approve as author', CHECK) + btn3('line', 'decline-app', 'Decline', X) + '</div>' : '') + '</article>';
        }).join('') : '<div class="empty" style="grid-template-columns:1fr"><div><h3>' + (appView === 'pending' ? 'No applications waiting.' : 'Nothing here yet.') + '</h3><p class="muted">' + (appView === 'pending' ? 'New applications appear once the applicant has verified their email.' : '') + '</p></div></div>';
      }).catch(fail);
    }

    /* ---- posts pending review (new posts + edits to live posts), oldest first ---- */
    function drawPosts() {
      var list = $('#rv-posts-list');
      Promise.all([api.listPendingPosts(), api.listPendingRevisions()]).then(function (r) {
        var items = r[0].map(function (p) { return { type: 'post', when: p.submitted_at || p.updated_at, p: p }; }).concat(r[1].map(function (v) { return { type: 'rev', when: v.created_at, p: v }; }))
          .sort(function (x, y) { return String(x.when).localeCompare(String(y.when)); });
        $('#cnt-posts').textContent = items.length;
        list.innerHTML = items.length ? items.map(function (it) {
          var p = it.p, own = p.author_id === me.id && !isAdmin();
          var head = '<div class="app-head"><div><h3>' + (it.type === 'rev' ? 'Edit to: ' : '') + esc(p.title || 'Untitled') + '</h3><p class="small muted" style="margin:0">by ' + esc(p.author_name) + ' · ' + (it.type === 'rev' ? 'edit sent ' : 'submitted ') + esc(fmtDate(it.when)) + '</p></div>' + (it.type === 'rev' ? '<span class="badge b-pending_review">Edit of a live post</span>' : '') + '</div>';
          var body;
          if (it.type === 'rev') {
            var d = diffBlocks(blocksOf(p.live.body), blocksOf(p.body)), titleChanged = (p.live.title || '') !== (p.title || '');
            body = (titleChanged ? '<p class="small"><strong>Title:</strong> <span class="d-del-inline">' + esc(p.live.title) + '</span> → <span class="d-add-inline">' + esc(p.title) + '</span></p>' : '') +
              '<div class="diff">' + diffCol(d.left, 'Live now') + diffCol(d.right, 'Proposed edit') + '</div>';
          } else {
            body = (p.excerpt ? '<p class="small muted">' + esc(p.excerpt) + '</p>' : '') + (p.tags && p.tags.length ? '<p class="btags">' + p.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</p>' : '') +
              '<details class="acc"><summary>Read the post</summary><div class="blog-body" style="padding-bottom:1rem">' + sanitize(p.body) + '</div></details>';
          }
          var acts = own ? '<p class="notice" role="note">This is your own ' + (it.type === 'rev' ? 'edit' : 'post') + '. Another reviewer or an admin has to review it.</p>'
            : noteField(it.type + p.id, 'Note to the author <span class="small muted">(required to request changes or reject; optional to approve)</span>') + '<div class="btn-row">' + btn3('dark', 'approve', 'Approve', CHECK) + btn3('line', 'changes', 'Request changes', EDIT) + btn3('line', 'reject', 'Reject', X) + '</div>';
          return '<article class="card app" data-type="' + it.type + '" data-id="' + esc(p.id) + '">' + head + body + acts + '</article>';
        }).join('') : '<div class="empty" style="grid-template-columns:1fr"><div><h3>Nothing waiting for review.</h3><p class="muted">Posts and edits sent for review appear here, oldest first.</p></div></div>';
      }).catch(fail);
    }

    /* ---- recently auto-published (trusted authors) ---- */
    function drawAuto() {
      var list = $('#rv-auto-list');
      api.listAutoPublished().then(function (a) {
        list.innerHTML = a.length ? a.map(function (r) {
          var live = r.status === 'published';
          return '<li class="mine" data-id="' + esc(r.post_id) + '"><span><strong>' + (live && r.slug ? '<a href="/blog/post/?slug=' + encodeURIComponent(r.slug) + '">' + esc(r.title || 'Untitled') + '</a>' : esc(r.title || 'Untitled')) + '</strong> ' + (r.note === 'edit' ? '<span class="badge">Edit</span>' : '<span class="badge">New</span>') + (live ? '' : ' <span class="badge b-unpublished">' + esc(STATUS[r.status] || r.status || '') + '</span>') +
            '<br><span class="small muted">' + esc(r.actor_name || '') + ' · ' + esc(fmtDate(r.created_at)) + '</span></span>' + (live ? '<span class="mine-act"><button type="button" class="chipbtn" data-act="unpublish-open">Unpublish…</button></span>' : '') + '</li>';
        }).join('') : '<li class="muted">Nothing published by trusted authors yet.</li>';
      }).catch(fail);
    }

    /* ---- users ---- */
    var userFilter = 'all', usersData = null;
    function drawUsers() {
      function render() {
        var d = usersData, ready = {}; d.ready.forEach(function (x) { ready[x.user_id] = x.approved_posts; });
        var F = { all: function () { return true; }, pending: function (u) { return u.role === 'pending'; }, author: function (u) { return u.role === 'author'; }, trusted_author: function (u) { return u.role === 'trusted_author'; }, reviewer: function (u) { return u.role === 'reviewer'; }, admin: function (u) { return u.role === 'admin'; }, off: function (u) { return !u.active; } };
        $$('[data-uf]').forEach(function (b) { var n = d.users.filter(F[b.dataset.uf]).length; $('.badge', b).textContent = n; });
        var rows = d.users.filter(F[userFilter]);
        $('#rv-users-list').innerHTML = rows.length ? rows.map(function (u) {
          var self = u.id === me.id, acts = [], staffTarget = u.role === 'reviewer' || u.role === 'admin';
          if (!self && u.active) {
            if (u.role === 'author') acts.push('<button type="button" class="chipbtn" data-act="role" data-role="trusted_author">Make trusted</button>');
            if (u.role === 'trusted_author') acts.push('<button type="button" class="chipbtn" data-act="role" data-role="author">Make author</button>');
            if (isAdmin()) acts.push('<select class="roleselect" aria-label="Set role for ' + esc(u.display_name) + '">' + ['pending', 'author', 'trusted_author', 'reviewer', 'admin'].map(function (r) { return '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>'; }).join('') + '</select><button type="button" class="chipbtn" data-act="role-select">Set</button>');
          }
          if (!self && (isAdmin() || !staffTarget)) acts.push('<button type="button" class="chipbtn" data-act="' + (u.active ? 'deactivate' : 'reactivate') + '">' + (u.active ? 'Deactivate' : 'Reactivate') + '</button>');
          return '<li class="mine" data-id="' + esc(u.id) + '" data-name="' + esc(u.display_name) + '"><span><strong>' + esc(u.display_name) + '</strong> <span class="badge">' + ROLE_LABEL[u.role] + '</span>' + (u.active ? '' : ' <span class="badge b-unpublished">Deactivated</span>') + (ready[u.id] ? ' <span class="badge b-published" title="' + ready[u.id] + ' approved posts and no rejections recently">Ready for trust</span>' : '') +
            '<br><span class="small muted">' + esc(u.email) + (u.affiliation ? ' · ' + esc(u.affiliation) : '') + '</span></span><span class="mine-act" style="flex-wrap:wrap">' + acts.join('') + '</span></li>';
        }).join('') : '<li class="muted">No one matches this filter.</li>';
      }
      if (usersData) return render();
      api.listUsers().then(function (d) { usersData = d; render(); }).catch(fail);
      drawUsers.render = render;
    }

    /* ---- audit log ---- */
    var auditRows = [], auditFilter = 'all';
    function drawAudit(more) {
      function render() {
        var rows = auditRows.filter(function (r) { return auditFilter === 'all' || r.kind === auditFilter; });
        $('#rv-audit-list').innerHTML = rows.length ? rows.map(function (r) {
          var what = r.kind === 'post' ? (AUDIT_LABEL[r.action] || r.action) : r.action.replace('application', 'Application decision');
          return '<li class="mine"><span><strong>' + esc(r.actor_name) + '</strong> · ' + esc(what) + ' · <em class="plain">' + esc(r.subject) + '</em>' + (r.note ? '<br><span class="small muted">“' + esc(r.note) + '”</span>' : '') + '</span><span class="small muted">' + esc(new Date(r.created_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })) + '</span></li>';
        }).join('') : '<li class="muted">No activity yet.</li>';
        $('#rv-audit-more').hidden = auditRows.length < 50 || !!drawAudit.done;
      }
      if (!more && auditRows.length) return render();
      var before = more && auditRows.length ? auditRows[auditRows.length - 1].created_at : null;
      api.auditLog(before).then(function (a) { drawAudit.done = a.length < 50; auditRows = more ? auditRows.concat(a) : a; render(); }).catch(fail);
    }

    /* ---- tabs ---- */
    function show(t) {
      tab = t; $$('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t); b.tabIndex = b.dataset.tab === t ? 0 : -1; }); $$('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== t; });
      if (t === 'apps') drawApps(); else if (t === 'posts') drawPosts(); else if (t === 'auto') drawAuto(); else if (t === 'users') { usersData = null; drawUsers(); } else if (t === 'audit') { auditRows = []; drawAudit.done = false; drawAudit(); }
    }
    $$('[data-tab]').forEach(function (b, i, all) {
      b.addEventListener('click', function () { show(b.dataset.tab); });
      b.addEventListener('keydown', function (e) { var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (k) { e.preventDefault(); var n = all[(i + k + all.length) % all.length]; n.focus(); show(n.dataset.tab); } });
    });
    $$('[data-av]').forEach(function (b) { b.addEventListener('click', function () { appView = b.dataset.av; $$('[data-av]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); drawApps(); }); });
    $$('[data-uf]').forEach(function (b) { b.addEventListener('click', function () { userFilter = b.dataset.uf; $$('[data-uf]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); drawUsers(); }); });
    $$('[data-af]').forEach(function (b) { b.addEventListener('click', function () { auditFilter = b.dataset.af; $$('[data-af]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); drawAudit(); }); });
    $('#rv-audit-more').addEventListener('click', function () { drawAudit(true); });

    /* ---- actions ---- */
    function lock(card, on) { $$('button', card).forEach(function (x) { x.disabled = on; }); }
    main.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return; var act = b.dataset.act, card = b.closest('.app, .mine');
      if (act === 'approve-app' || act === 'decline-app') {
        var ok = act === 'approve-app'; if (!ok && !confirm('Decline this application? The person will be told, and the account stays blocked from posting.')) return;
        lock(card, true); return api.reviewApplication(card.dataset.id, ok, $('textarea', card).value.trim()).then(function () { say(ok ? 'Approved. The applicant has been emailed.' : 'Declined. The applicant has been emailed.', 'ok'); drawApps(); }).catch(function (er) { lock(card, false); fail(er); });
      }
      if (act === 'approve' || act === 'changes' || act === 'reject') {
        var map = { approve: 'approve', changes: 'request_changes', reject: 'reject' }, action = map[act], note = needNote(card, action); if (note === null) return;
        if (action === 'reject' && !confirm('Reject this ' + (card.dataset.type === 'rev' ? 'edit' : 'post') + '? The author is told why.')) return;
        lock(card, true);
        var p = card.dataset.type === 'rev' ? api.reviewRevision(card.dataset.id, action, note) : api.reviewPost(card.dataset.id, action, note);
        return p.then(function () { say(({ approve: 'Approved. The author has been emailed.', request_changes: 'Sent back with your note. The author has been emailed.', reject: 'Rejected. The author has been emailed.' })[action], 'ok'); drawPosts(); }).catch(function (er) { lock(card, false); fail(er); });
      }
      if (act === 'unpublish-open') {
        var li = b.closest('.mine'), box = $('.unpub', li); if (box) { box.remove(); return; }
        li.insertAdjacentHTML('beforeend', '<div class="unpub" style="flex-basis:100%">' + noteField('u' + li.dataset.id, 'Why is it being taken down? (required, sent to the author)') + '<div class="btn-row">' + btn3('dark', 'unpublish', 'Unpublish', X) + '</div></div>'); $('textarea', li).focus(); return;
      }
      if (act === 'unpublish') {
        var row = b.closest('.mine'), n = needNote(row, 'unpublish'); if (n === null) return; lock(row, true);
        return api.reviewPost(row.dataset.id, 'unpublish', n).then(function () { say('Unpublished. The author has been emailed.', 'ok'); drawAuto(); }).catch(function (er) { lock(row, false); fail(er); });
      }
      if (act === 'role' || act === 'role-select') {
        var li2 = b.closest('.mine'), newRole = act === 'role' ? b.dataset.role : $('.roleselect', li2).value, note2 = prompt('Note (optional) for the audit log') || '';
        return api.setRole(li2.dataset.id, newRole, note2).then(function () { say(li2.dataset.name + ' is now ' + ROLE_LABEL[newRole].toLowerCase() + '. This is recorded in the audit log.', 'ok'); usersData = null; drawUsers(); }).catch(fail);
      }
      if (act === 'deactivate' || act === 'reactivate') {
        var li3 = b.closest('.mine'), on = act === 'reactivate';
        if (!on && !confirm('Deactivate ' + li3.dataset.name + '? They are signed out and cannot sign back in or post.')) return;
        return api.setActive(li3.dataset.id, on, prompt('Note (optional) for the audit log') || '').then(function () { say(li3.dataset.name + (on ? ' was reactivated.' : ' was deactivated and signed out.'), 'ok'); usersData = null; drawUsers(); }).catch(function (er) { say(er.message, 'info'); usersData = null; drawUsers(); });
      }
    });

    function counts() {
      api.listApplications('pending').then(function (a) { $('#cnt-apps').textContent = a.length; }).catch(function () {});
      Promise.all([api.listPendingPosts(), api.listPendingRevisions()]).then(function (r) { $('#cnt-posts').textContent = r[0].length + r[1].length; }).catch(function () {});
    }
    function load() {
      api.session().then(function (s) {
        me = s; var ok = !!s && (s.role === 'reviewer' || s.role === 'admin'); gate.hidden = ok; main.hidden = !ok;
        if (!ok) return; $('#rv-who').textContent = s.name + ' (' + ROLE_LABEL[s.role].toLowerCase() + ')';
        counts(); var want = new URLSearchParams(location.search).get('tab'); show(['apps', 'posts', 'auto', 'users', 'audit'].indexOf(want) > -1 ? want : 'apps');
      });
    }
    demoBar(function () { location.reload(); }); load();
  }

  /* ---------- home: latest posts ---------- */
  function initLatest() {
    var sec = $('[data-blog-latest]'); if (!sec) return;
    api.listPublished().then(function (a) { if (!a.length) return; sec.hidden = false; $('.cards', sec).innerHTML = a.slice(0, 3).map(card).join(''); }).catch(function () {});
  }

  var mode = document.body.getAttribute('data-blog');
  function start() { if (mode === 'list') initList(); else if (mode === 'post') initPost(); else if (mode === 'write') initWrite(); else if (mode === 'join') initJoin(); else if (mode === 'review') initReview(); else if (mode === 'dashboard') initDashboard(); initLatest(); }
  start();
})();
