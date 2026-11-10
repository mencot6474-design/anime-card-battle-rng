/* ==========================================================================
   HAZARD NOTIFICATIONS — port of `_tmp/proto_notify_v1.html` (WoB theme)
   1) window.hzNotify(opts)      global toast stack (max 3 visible, queue, merge by key)
   2) window.hzCinematic(cfg)    full-screen activation cinematic
                                 (Global Luck / Instant Weather Potion only)
   Perf contract: CSS animations use transform/opacity only; one short-lived canvas
   (22-40 particles) exists only while the cinematic plays. No persistent ambient FX.
   ========================================================================== */
(function () {
  "use strict";

  var IC = {
    success: '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
    danger: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reward: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.8z"/></svg>',
    system: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="12"/><path d="M8 21h8M12 17v4"/></svg>',
    luck: (function () {
      var leaf = "M12 12C12 12 6.4 10.6 6.4 6.6A3 3 0 0 1 12 5.2A3 3 0 0 1 17.6 6.6C17.6 10.6 12 12 12 12Z";
      return '<svg viewBox="0 0 24 24" class="hzc-fill"><g style="fill:var(--ac,#f3e600);stroke:#050505;stroke-width:.9;stroke-linejoin:round">' +
        '<path d="' + leaf + '"/><path transform="rotate(90 12 12)" d="' + leaf + '"/>' +
        '<path transform="rotate(180 12 12)" d="' + leaf + '"/><path transform="rotate(270 12 12)" d="' + leaf + '"/></g>' +
        '<circle cx="12" cy="12" r="1.6" style="fill:#050505"/>' +
        '<path d="M12 13.5C12.4 17 14 19.4 16.4 21" style="stroke:var(--ac,#f3e600);stroke-width:1.6;stroke-linecap:round;fill:none"/></svg>';
    })()
  };

  /* hex color -> semantic kind (the hex itself is kept as the accent) */
  var KIND_BY_HEX = {
    "#f87171": "danger", "#ff4757": "danger", "#ff5c5c": "danger", "#ef4444": "danger",
    "#fcd34d": "warn", "#fbbf24": "warn", "#f59e0b": "warn",
    "#ffd700": "reward", "#f3e600": "reward", "#ffd34a": "reward",
    "#34d399": "success", "#4ade80": "success", "#5eead4": "success", "#6be08a": "success"
  };
  function kindOf(color) {
    return KIND_BY_HEX[String(color || "").toLowerCase()] || "info";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return "243,230,0";
    return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
  }

  /* ---------------------------- TOAST STACK ---------------------------- */
  var MAX = 3, live = [], queue = [];
  function host() {
    var h = document.getElementById("hzToasts");
    if (!h) {
      h = document.createElement("div");
      h.id = "hzToasts";
      h.setAttribute("aria-live", "polite");
      document.body.appendChild(h);
    }
    return h;
  }
  function arm(t, ms) { clearTimeout(t.timer); t.timer = setTimeout(function () { close(t); }, ms); }
  function close(t) {
    if (t.closing) return;
    t.closing = true;
    clearTimeout(t.timer);
    t.el.classList.add("out");
    setTimeout(function () {
      if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
      var i = live.indexOf(t);
      if (i > -1) live.splice(i, 1);
      if (queue.length && live.length < MAX) mount(queue.shift());
    }, 300);
  }
  function mount(o) {
    var kind = o.kind || "info", dur = o.dur || 3600;
    var el = document.createElement("div");
    el.className = "hzt k-" + kind;
    el.style.setProperty("--dur", dur + "ms");
    if (o.color) el.style.setProperty("--c", o.color);
    var title = o.html ? o.title : esc(o.title);
    el.innerHTML =
      '<span class="hzt-stripe"></span><span class="hzt-ico">' + (IC[kind] || IC.info) + "</span>" +
      '<div class="hzt-txt"><div class="hzt-kick">// ' + esc(o.kick || kind.toUpperCase()) +
      '<span class="hzt-cnt" hidden></span></div>' +
      '<div class="hzt-ttl">' + title + "</div>" +
      (o.msg ? '<div class="hzt-msg">' + esc(o.msg) + "</div>" : "") + "</div>" +
      '<button class="hzt-x" type="button" aria-label="Dismiss">\u2715</button>' +
      '<span class="hzt-sheen"></span><span class="hzt-tm"><i></i></span>';
    host().insertBefore(el, host().firstChild);
    var t = { el: el, key: o.key, n: 1, dur: dur, cnt: el.querySelector(".hzt-cnt"), timer: null };
    el.querySelector(".hzt-x").onclick = function () { close(t); };
    el.addEventListener("mouseenter", function () { clearTimeout(t.timer); });
    el.addEventListener("mouseleave", function () { arm(t, 1200); });
    live.push(t);
    arm(t, dur);
    return t;
  }
  function hzNotify(o) {
    o = o || {};
    if (o.key) {
      for (var i = 0; i < live.length; i++) {
        var ex = live[i];
        if (ex.key === o.key && !ex.closing) {
          ex.n++;
          ex.cnt.textContent = "\u00d7" + ex.n;
          ex.cnt.hidden = false;
          ex.el.classList.remove("bump");
          void ex.el.offsetWidth;
          ex.el.classList.add("bump");
          var bar = ex.el.querySelector(".hzt-tm i");
          bar.style.animation = "none";
          void bar.offsetWidth;
          bar.style.animation = "";
          arm(ex, ex.dur);
          return ex;
        }
      }
    }
    if (live.length >= MAX) { queue.push(o); return null; }
    return mount(o);
  }
  window.hzNotify = hzNotify;
  window.hzKindOf = kindOf;

  /* ---------------------------- CINEMATIC ---------------------------- */
  var cineEl = null, cineRaf = 0, cineTimer = 0, cineEnd = null;
  function buildCine() {
    if (cineEl && document.body.contains(cineEl)) return cineEl;
    cineEl = document.createElement("div");
    cineEl.id = "hzCine";
    cineEl.setAttribute("aria-hidden", "true");
    cineEl.innerHTML =
      '<div class="hzc-dim"></div><div class="hzc-rays"></div><canvas class="hzc-cv"></canvas>' +
      '<div class="hzc-chips"></div><div class="hzc-tape a"></div><div class="hzc-tape b"></div><div class="hzc-flash"></div>' +
      '<div class="hzc-card"><span class="hzc-crn tl"></span><span class="hzc-crn tr"></span><span class="hzc-crn bl"></span><span class="hzc-crn br"></span>' +
      '<div class="hzc-in"><div class="hzc-krow"><span class="hzc-dot"></span><span class="hzc-kick"></span><span class="hzc-ser">SERIAL 0x<b class="hzc-serv"></b></span></div>' +
      '<div class="hzc-hero"><div class="hzc-emb"></div><div class="hzc-big"><div class="hzc-name"></div><div class="hzc-mult"></div></div></div>' +
      '<div class="hzc-sub"></div><div class="hzc-by"></div><div class="hzc-bar"><i></i></div>' +
      '<div class="hzc-foot"><span>HZ-PROTOCOL</span><b class="hzc-footv"></b></div></div></div>';
    document.body.appendChild(cineEl);
    return cineEl;
  }
  function splitName(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += '<span style="--i:' + i + '">' + (c === " " ? "&nbsp;" : esc(c)) + "</span>";
    }
    return '<b class="hzc-nm">' + out + "</b>";
  }
  function mkP(kind, W, H, init) {
    var p = { x: Math.random() * W, y: init ? Math.random() * H : -20, v: 1, s: 1, a: Math.random() };
    if (kind === "rain" || kind === "storm") { p.v = 14 + Math.random() * 10; p.s = 10 + Math.random() * 16; p.x = Math.random() * (W + 200); }
    else if (kind === "snow") { p.v = 1 + Math.random() * 2; p.s = 1.5 + Math.random() * 2.5; p.dr = Math.random() * 6; }
    else if (kind === "sand") { p.x = -20; p.y = Math.random() * H; p.v = 12 + Math.random() * 14; p.s = 1 + Math.random() * 2; }
    else if (kind === "aurora") { p.y = H * (0.15 + Math.random() * 0.5); p.v = 0.4 + Math.random(); p.s = 60 + Math.random() * 120; }
    else { p.y = init ? Math.random() * H : H + 20; p.v = 2 + Math.random() * 4; p.s = 2 + Math.random() * 3; }
    return p;
  }
  function stepP(p, kind, W, H, cx, rgb, el) {
    var f = Math.min(1, el / 500) * Math.max(0, 1 - (el - 4600) / 600);
    cx.fillStyle = cx.strokeStyle = "rgba(" + rgb + "," + (0.7 * f) + ")";
    if (kind === "rain" || kind === "storm") {
      p.y += p.v; p.x -= p.v * 0.28;
      if (p.y > H) { p.y = -20; p.x = Math.random() * (W + 200); }
      cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + p.s * 0.28, p.y - p.s); cx.stroke();
    } else if (kind === "snow") {
      p.y += p.v; p.x += Math.sin(el / 700 + p.dr) * 0.8;
      if (p.y > H) { p.y = -10; p.x = Math.random() * W; }
      cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.283); cx.fill();
    } else if (kind === "sand") {
      p.x += p.v; p.y += Math.sin(el / 300 + p.a * 9) * 0.6;
      if (p.x > W) { p.x = -20; p.y = Math.random() * H; }
      cx.fillRect(p.x, p.y, p.s * 4, p.s * 0.8);
    } else if (kind === "aurora") {
      p.x += p.v; if (p.x > W + p.s) p.x = -p.s;
      var yy = p.y + Math.sin(el / 900 + p.a * 6) * 30;
      var g = cx.createRadialGradient(p.x, yy, 0, p.x, p.y, p.s);
      g.addColorStop(0, "rgba(" + rgb + "," + (0.16 * f) + ")"); g.addColorStop(1, "rgba(" + rgb + ",0)");
      cx.fillStyle = g; cx.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
    } else {
      p.y -= p.v; p.x += Math.sin(el / 400 + p.a * 9) * 0.7;
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
      cx.save(); cx.translate(p.x, p.y); cx.rotate(el / 600 + p.a * 6); cx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); cx.restore();
    }
  }
  function runParticles(kind, rgb) {
    var cv = cineEl.querySelector(".hzc-cv");
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    var W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    var cx = cv.getContext("2d");
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var N = kind === "luck" ? 22 : (kind === "snow" || kind === "sand") ? 36 : 40, ps = [], i;
    for (i = 0; i < N; i++) ps.push(mkP(kind, W, H, true));
    var t0 = performance.now();
    var raf = window.__rawRaf || window.requestAnimationFrame.bind(window);
    (function loop(now) {
      var el = Math.max(0, now - t0);
      cx.clearRect(0, 0, W, H);
      cx.globalCompositeOperation = "lighter";
      for (var k = 0; k < ps.length; k++) stepP(ps[k], kind, W, H, cx, rgb, el);
      if (el < 5200 && cineEl.classList.contains("on")) cineRaf = raf(loop);
      else cx.clearRect(0, 0, W, H);
    })(t0);
  }
  function endCine() {
    clearTimeout(cineTimer);
    if (!cineEl) return;
    cineEl.classList.add("leave");
    var done = cineEnd; cineEnd = null;
    setTimeout(function () {
      cineEl.classList.remove("on", "leave");
      if (typeof done === "function") { try { done(); } catch (e) {} }
    }, 520);
  }
  /* cfg: { kind:'luck'|<weather particle>, color, kick, name, mult, sub, buyer, foot, iconHtml, chips, hold, after } */
  function hzCinematic(cfg) {
    cfg = cfg || {};
    var el = buildCine();
    clearTimeout(cineTimer);
    cineEnd = cfg.after || null;
    el.classList.remove("on", "leave");
    void el.offsetWidth;
    var ac = cfg.color || "#f3e600";
    el.style.setProperty("--ac", ac);
    el.style.setProperty("--ac-a", "rgba(" + hexToRgb(ac) + ",.38)");
    var q = function (s) { return el.querySelector(s); };
    q(".hzc-kick").innerHTML = cfg.kick || "// PREMIUM <b>ACTIVATED</b>";
    q(".hzc-serv").textContent = Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, "0");
    q(".hzc-emb").innerHTML = cfg.iconHtml || IC.luck;
    q(".hzc-name").innerHTML = splitName(String(cfg.name || "").toUpperCase());
    var m = q(".hzc-mult"); m.textContent = cfg.mult || ""; m.style.display = cfg.mult ? "" : "none";
    q(".hzc-sub").textContent = cfg.sub || "";
    q(".hzc-by").textContent = cfg.buyer ? "ACTIVATED BY: " + String(cfg.buyer).toUpperCase() : "";
    q(".hzc-footv").textContent = cfg.foot || "BUFF ONLINE";
    var ch = q(".hzc-chips"); ch.innerHTML = "";
    if (cfg.chips) {
      for (var i = 0; i < 12; i++) {
        var c = document.createElement("span");
        c.className = "hzc-chip"; c.textContent = cfg.chips;
        c.style.left = (Math.random() * 96) + "%";
        c.style.setProperty("--d", (2.4 + Math.random() * 1.8) + "s");
        c.style.setProperty("--dl", (0.5 + Math.random() * 1.6) + "s");
        c.style.setProperty("--r", (Math.random() * 120 - 60) + "deg");
        ch.appendChild(c);
      }
    }
    el.classList.add("on");
    try {
      if (typeof beep === "function") {
        beep(523.25, 0.14, "triangle", 0.11);
        setTimeout(function () { beep(659.25, 0.16, "triangle", 0.12); }, 110);
        setTimeout(function () { beep(783.99, 0.18, "triangle", 0.13); }, 220);
        setTimeout(function () { beep(1046.5, 0.28, "triangle", 0.14); }, 340);
      }
    } catch (e) {}
    setTimeout(function () { if (el.classList.contains("on")) runParticles(cfg.kind || "luck", hexToRgb(ac)); }, 400);
    cineTimer = setTimeout(endCine, cfg.hold || 4300);
    el.onclick = endCine;
  }
  window.hzCinematic = hzCinematic;
})();
