/* IMRC site behaviour — small, dependency-free, progressive enhancement. */
(function () {
  var d = document, root = d.documentElement;
  var lang = (root.lang || "en").slice(0, 2);
  root.classList.remove("no-js");

  var STR = {
    en: { register: "Register", waitlist: "Join waitlist", closed: "Closed", open: "Open", sample: "Sample — not a real session", online: "Online", "in-person": "In person", hybrid: "Hybrid", notConnected: "This form isn't connected to an email service yet, so nothing was sent.", thanks: "Thank you. We'll be in touch.", fix: "Please fix the highlighted fields.", needed: "This field is required.", badEmail: "Enter an email address like name@example.com.", consent: "Please tick the box to confirm you'd like to receive emails.", read: "Read" },
    ko: { register: "신청하기", waitlist: "대기 신청", closed: "마감", open: "신청 가능", sample: "샘플 — 실제 일정이 아닙니다", online: "온라인", "in-person": "대면", hybrid: "혼합", notConnected: "이 양식은 아직 이메일 서비스와 연결되지 않아 아무것도 전송되지 않았습니다.", thanks: "감사합니다. 곧 연락드리겠습니다.", fix: "표시된 항목을 확인해 주세요.", needed: "필수 입력 항목입니다.", badEmail: "name@example.com 형식의 이메일을 입력해 주세요.", consent: "이메일 수신에 동의하시려면 체크해 주세요.", read: "읽기" },
    ja: { register: "申し込む", waitlist: "キャンセル待ち", closed: "受付終了", open: "受付中", sample: "サンプル — 実際の日程ではありません", online: "オンライン", "in-person": "対面", hybrid: "ハイブリッド", notConnected: "このフォームはまだメールサービスに接続されていないため、何も送信されていません。", thanks: "ありがとうございます。追ってご連絡します。", fix: "ハイライトされた項目をご確認ください。", needed: "必須項目です。", badEmail: "name@example.com の形式で入力してください。", consent: "メールの受信に同意する場合はチェックを入れてください。", read: "読む" }
  };
  var S = STR[lang] || STR.en;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var params = new URLSearchParams(location.search);

  /* --- mobile menu --- */
  var menuBtn = d.querySelector(".menu-btn"), mm = d.getElementById("mobile-menu");
  function setMenu(open) {
    d.body.classList.toggle("menu-open", open);
    if (menuBtn) { menuBtn.setAttribute("aria-expanded", open); }
    if (mm) { mm.hidden = !open; }
  }
  if (menuBtn && mm) {
    mm.hidden = true;
    menuBtn.addEventListener("click", function () { setMenu(!d.body.classList.contains("menu-open")); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && d.body.classList.contains("menu-open")) { setMenu(false); menuBtn.focus(); } });
    mm.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    window.matchMedia("(min-width:1320px)").addEventListener("change", function (e) { if (e.matches) setMenu(false); });
  }

  /* --- greeting rotator (decorative; paused for reduced motion) --- */
  var greet = d.querySelector(".greet");
  if (greet && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var words = [["Hello", "en"], ["안녕하세요", "ko"], ["こんにちは", "ja"]], gi = 0;
    setInterval(function () {
      gi = (gi + 1) % words.length;
      greet.style.opacity = 0;
      setTimeout(function () { greet.textContent = words[gi][0]; greet.lang = words[gi][1]; greet.style.opacity = 1; }, 520);
    }, 3200);
  }

  /* --- tabs --- */
  d.querySelectorAll("[data-tabs]").forEach(function (wrap) {
    var tabs = [].slice.call(wrap.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return d.getElementById(t.getAttribute("aria-controls")); });
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on; panels[j].classList.toggle("on", on);
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = tabs.length;
        if (k === "ArrowRight") { e.preventDefault(); select((i + 1) % n, true); }
        else if (k === "ArrowLeft") { e.preventDefault(); select((i - 1 + n) % n, true); }
        else if (k === "Home") { e.preventDefault(); select(0, true); }
        else if (k === "End") { e.preventDefault(); select(n - 1, true); }
      });
    });
    select(0);
  });

  /* --- reveal on scroll --- */
  var items = d.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add("in"); }); }

  /* --- sessions / articles from data (demo with ?demo=1) --- */
  var data = window.IMRC_DATA || {}, demo = params.get("demo") === "1" && window.IMRC_DEMO;
  var sessions = (data.sessions || []).slice(), articles = (data.articles || []).slice();
  if (demo) { sessions = sessions.concat(window.IMRC_DEMO.sessions); articles = articles.concat(window.IMRC_DEMO.articles); }
  var locale = lang === "ko" ? "ko-CA" : lang === "ja" ? "ja-JP" : "en-CA";
  var now = new Date();
  sessions = sessions.filter(function (s) { return new Date(s.start) >= now || demo; }).sort(function (a, b) { return new Date(a.start) - new Date(b.start); });

  d.querySelectorAll("[data-sessions]").forEach(function (box) {
    var limit = parseInt(box.getAttribute("data-limit") || "99", 10);
    var list = sessions.slice(0, limit);
    var empty = d.querySelector(box.getAttribute("data-empty"));
    if (!list.length) { return; }
    if (empty) empty.hidden = true;
    box.innerHTML = list.map(function (s) {
      var dt = new Date(s.start);
      var cls = s.status === "open" ? "tag-open" : s.status === "waitlist" ? "tag-wait" : "tag-closed";
      var cta = s.status === "closed" ? "" : '<a class="btn btn-yellow btn-sm" href="' + esc(s.url) + '"><span>' + (s.status === "waitlist" ? S.waitlist : S.register) + '</span><span class="arr-wrap"><svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a>';
      return '<article class="session" data-format="' + esc(s.format) + '" data-lang="' + esc(s.language) + '"><div class="date" aria-hidden="true"><span>' + esc(dt.toLocaleDateString(locale, { month: "short" })) + '</span><b>' + dt.getDate() + '</b></div><div><h3>' + esc(s.program) + '</h3><div class="meta"><span class="tag ' + cls + '">' + (S[s.status] || s.status) + '</span><span>' + esc(dt.toLocaleString(locale, { weekday: "short", hour: "numeric", minute: "2-digit" })) + '</span><span>' + (S[s.format] || s.format) + (s.place ? " · " + esc(s.place) : "") + '</span><span>' + esc(s.service) + '</span>' + (demo ? '<span class="tag tag-sample">' + S.sample + '</span>' : '') + '</div></div>' + cta + '</article>';
    }).join("");
  });

  /* dates under each garden project (sessions whose `project` or program title names it); "Dates to be announced" stays until one is posted */
  d.querySelectorAll(".proj-dates").forEach(function (box) {
    var name = (box.getAttribute("data-project") || "").toLowerCase();
    var mine = sessions.filter(function (s) { return (s.project || "").toLowerCase() === name || (s.program || "").toLowerCase().indexOf(name) > -1; });
    if (!mine.length) return;
    var tba = box.parentNode.querySelector(".proj-tba"); if (tba) tba.hidden = true;
    box.innerHTML = '<ul class="proj-list">' + mine.map(function (s) {
      var dt = new Date(s.start);
      var when = dt.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" }) + " · " + dt.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
      var where = (S[s.format] || s.format || "") + (s.place ? " · " + s.place : "");
      var cta = s.status === "closed" || !s.url ? "" : ' <a class="link-arrow" href="' + esc(s.url) + '">' + (s.status === "waitlist" ? S.waitlist : S.register) + '</a>';
      return '<li><strong>' + esc(when) + '</strong><br><span class="muted small">' + esc(where) + '</span>' + cta + '</li>';
    }).join("") + '</ul>';
  });

  var filt = d.getElementById("sess-filters");
  if (filt && sessions.length) {
    filt.hidden = false;
    var active = {};
    filt.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-f]"); if (!b) return;
      var on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", on);
      active[b.dataset.f] = on;
      var fm = ["online", "in-person"].filter(function (k) { return active[k]; }), fl = ["en", "ko", "ja"].filter(function (k) { return active[k]; });
      d.querySelectorAll(".session").forEach(function (el) {
        el.hidden = !((!fm.length || fm.indexOf(el.dataset.format) > -1) && (!fl.length || fl.indexOf(el.dataset.lang) > -1));
      });
    });
  }

  d.querySelectorAll("[data-articles]").forEach(function (box) {
    var sec = box.closest("section");
    if (!articles.length) { if (sec && sec.hasAttribute("data-hide-empty")) sec.hidden = true; return; }
    if (sec) sec.hidden = false;
    box.innerHTML = articles.slice(0, 3).map(function (a) {
      return '<article class="card"><h3>' + esc(a.title) + '</h3><p>' + esc(a.quick) + '</p><p class="small muted">' + esc(a.author) + '</p><a class="link-arrow" href="' + esc(a.url) + '">' + S.read + '</a></article>';
    }).join("");
  });

  /* --- not-translated notice on English-only pages --- */
  var notice = d.getElementById("lang-notice"), from = params.get("lang");
  if (notice && (from === "ko" || from === "ja")) {
    notice.textContent = notice.getAttribute("data-" + from); notice.lang = from; notice.hidden = false;
  }

  /* --- copy-link buttons (static blog posts) --- */
  d.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () { var t = b.textContent; b.textContent = "Link copied"; setTimeout(function () { b.textContent = t; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute("data-copy")).then(done); else done();
    });
  });

  /* --- forms: inline validation, honest status --- */
  d.querySelectorAll("form[data-form]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    function show(msg, kind) { if (!status) return; status.textContent = msg; status.className = "form-status show " + kind; }
    function setBad(field, bad, msg) {
      field.classList.toggle("bad", bad);
      var err = field.querySelector(".err"); if (err && msg) err.textContent = msg;
      var inp = field.querySelector("input,select,textarea"); if (inp) inp.setAttribute("aria-invalid", bad);
    }
    function check(field) {
      var inp = field.querySelector("input,select,textarea"); if (!inp) return true;
      var v = (inp.type === "checkbox") ? inp.checked : inp.value.trim();
      if (inp.required && !v) { setBad(field, true, inp.type === "checkbox" ? S.consent : S.needed); return false; }
      if (inp.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setBad(field, true, S.badEmail); return false; }
      setBad(field, false); return true;
    }
    form.querySelectorAll(".field").forEach(function (f) {
      var inp = f.querySelector("input,select,textarea");
      if (inp) inp.addEventListener("blur", function () { if (inp.value || f.classList.contains("bad")) check(f); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var hp = form.querySelector(".hp input"); if (hp && hp.value) return;
      var firstBad = null;
      form.querySelectorAll(".field").forEach(function (f) { if (!check(f) && !firstBad) firstBad = f; });
      if (firstBad) { show(S.fix, "info"); firstBad.querySelector("input,select,textarea").focus(); return; }
      var action = form.getAttribute("data-endpoint");
      if (!action) { show(S.notConnected, "info"); return; }
      // Connect a Canada-hosted form service here; send over HTTPS only and keep nothing longer than needed.
      fetch(action, { method: "POST", body: new FormData(form) }).then(function (r) {
        if (!r.ok) throw 0; form.reset(); show(S.thanks, "ok");
      }).catch(function () { show(S.fix, "info"); });
    });
  });
})();
