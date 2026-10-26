/* ==========================================================================
   DEVTOOLS GUARD — peringatan + reset total saat Inspect/F12 terdeteksi.

   ATURAN: file ini HANYA mendeteksi dan melaporkan. Hukuman (save dibangun
   ulang ke kondisi awal) dijalankan SERVER lewat RPC `report_devtools`
   (migration 0031), identitas dari auth.uid(). Jadi file ini tidak bisa
   dipakai untuk mereset akun orang lain.

   Sinyal (lihat `_desktopish` — HP/PWA tidak dipasangi guard):
     1. "size"     : selisih outer/inner window > 240 px (DevTools di-dock).
                     Harus positif 2 kali berturut-turut (≈2,4 dtk) supaya
                     animasi resize / sidebar tidak memicu.
     2. "console"  : getter pada objek yang di-console.log — hanya dieksekusi
                     saat DevTools benar-benar merender objek (paling spesifik).
     3. "debugger" : jeda `debugger` > 300 ms, dicek hanya setelah interaksi
                     pemain (maks 1x/8 dtk) supaya HP lambat tidak kena.

   ALUR: deteksi -> overlay peringatan + hitung mundur 6 dtk -> RPC reset ->
   kunci save() lokal -> hapus cache save lokal -> reload (save baru ditarik
   dari cloud di enterGame).

   PEMBATALAN: sinyal "size" yang hilang sebelum hitung mundur habis membatalkan
   reset (anti false positive saat DevTools ditutup). Sinyal "console"/"debugger"
   tidak bisa dibatalkan.

   AKUN DEVELOPER: masukkan username ke tabel `guard_allow` (migration 0031)
   supaya tidak ikut direset saat membuka F12 untuk mengembangkan game.

   VERIFIKASI CEPAT: buka `?devguard=1` -> HUD kecil di kiri bawah menampilkan
   status armed / delta / sinyal, plus tombol TEST. `ACBGuard.status()` dan
   `ACBGuard.force('size')` juga tersedia dari console.
   ========================================================================== */
(function () {
  /* Di localhost / 127.0.0.1 / file:// / iframe (seperti CrazyGames sandbox) devtools guard TIDAK PERNAH aktif */
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:") return;
  try { if (window.self !== window.top) return; } catch (e) { return; }
  if (window.__ACB_DEVGUARD__) return;
  window.__ACB_DEVGUARD__ = true;

  var SIZE_THRESH = 240;
  var TICK_MS = 1200;
  var COUNTDOWN = 6;
  var DBG_MS = 300;
  var HUD = /[?&]devguard=1\b/.test(location.search || "");

  var armed = false;
  var consoleHit = false;
  var sizeHits = 0;
  var lastDbg = 0;
  var pending = null;
  var resetting = false;
  var log = [];
  var tickId = null;

  function _mobileUA() {
    try {
      return /Android|iPhone|iPad|iPod|Mobile|Windows Phone|Opera Mini/i
        .test(navigator.userAgent || "");
    } catch (e) { return true; }
  }

  function _desktopish() {
    try {
      if (navigator.webdriver) return false;
      if (_mobileUA()) return false;
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return false;
      if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return false;
    } catch (e) { return false; }
    return true;
  }

  function _sizeDelta() {
    var dw = Math.abs((window.outerWidth || 0) - (window.innerWidth || 0));
    var dh = Math.abs((window.outerHeight || 0) - (window.innerHeight || 0));
    return Math.max(dw, dh);
  }

  function _sizeOpen() { return _sizeDelta() > SIZE_THRESH; }

  function _debuggerOpen() {
    var t0 = performance.now();
    /* eslint-disable no-debugger */
    debugger;
    /* eslint-enable no-debugger */
    return (performance.now() - t0) > DBG_MS;
  }

  /* ---------- overlay ---------- */
  function _el(tag, css, html) {
    var n = document.createElement(tag);
    n.style.cssText = css;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var OV_CSS =
    "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;" +
    "justify-content:center;background:rgba(10,0,2,.94);" +
    "font-family:ui-monospace,Consolas,monospace;color:#fecdd3;padding:24px";

  function _showWarning(signal) {
    var ov = document.getElementById("acbGuardOv");
    var body =
      "<div style='max-width:560px;text-align:center'>" +
      "<div style='font-size:13px;letter-spacing:.3em;color:#f87171'>PELANGGARAN TERDETEKSI</div>" +
      "<div style='font-size:26px;font-weight:800;margin:10px 0 6px;color:#fff'>DEVTOOLS / INSPECT TERBUKA</div>" +
      "<div style='font-size:13px;line-height:1.6;color:#fda4af'>Sinyal: <b id='acbGuardSig'>" + signal + "</b><br>" +
      "Save akan <b>DIKEMBALIKAN KE AWAL</b> (coin, kartu, item, progres, peringkat).</div>" +
      "<div id='acbGuardCd' style='font-size:44px;font-weight:900;margin:18px 0 4px;color:#f87171'>" + COUNTDOWN + "</div>" +
      "<div style='font-size:11px;color:#94a3b8'>Tutup DevTools sekarang untuk membatalkan.</div>" +
      "</div>";
    if (!ov) {
      ov = _el("div", OV_CSS, body);
      ov.id = "acbGuardOv";
      document.body.appendChild(ov);
    } else {
      ov.innerHTML = body;
    }
  }

  function _paintCountdown(n) {
    var c = document.getElementById("acbGuardCd");
    if (c) c.textContent = String(Math.max(0, n));
  }

  function _hideWarning() {
    var ov = document.getElementById("acbGuardOv");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function _showFinal(res, signal) {
    var ok = !!(res && res.reset);
    var exempt = !!(res && res.exempt);
    var local = !res;
    var body =
      "<div style='max-width:560px;text-align:center'>" +
      "<div style='font-size:13px;letter-spacing:.3em;color:#f87171'>PELANGGARAN TERDETEKSI · " + signal + "</div>" +
      "<div style='font-size:26px;font-weight:800;margin:10px 0 6px;color:#fff'>" +
      (exempt ? "AKUN DEVELOPER — DIKECUALIKAN" : ok ? "SAVE DIRESET KE AWAL" : local ? "SAVE LOKAL DIRESET" : "RESET GAGAL") +
      "</div>" +
      "<div style='font-size:13px;line-height:1.6;color:#fda4af'>" +
      (exempt
        ? "Username ini ada di daftar <b>guard_allow</b>, jadi progres tidak dihapus."
        : ok
          ? "Coin 1.000 · Gem 50 · Lv 1 · kartu starter saja · progres &amp; peringkat dikosongkan."
          : local
            ? "Tidak ada sesi login, jadi hanya save lokal yang dibersihkan."
            : "Server menolak reset (sesi Auth tidak siap). Muat ulang lalu coba lagi.") +
      "</div>" +
      "<div style='font-size:11px;color:#94a3b8;margin-top:14px'>Memuat ulang…</div>" +
      "</div>";
    var ov = document.getElementById("acbGuardOv");
    if (!ov) {
      ov = _el("div", OV_CSS.replace(",.94", ",.97"), body);
      ov.id = "acbGuardOv";
      document.body.appendChild(ov);
    } else {
      ov.innerHTML = body;
    }
  }

  /* ---------- reset ---------- */
  function _wipeLocal() {
    try {
      var kill = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (k.indexOf("aab-state-v2:") === 0 ||
            k.indexOf("aab-lb2-") === 0 ||
            k === "aab-lb-av" || k === "aab-lb-delta") kill.push(k);
      }
      for (var j = 0; j < kill.length; j++) localStorage.removeItem(kill[j]);
    } catch (e) {}
  }

  function _user() {
    try { return (typeof currentUser !== "undefined" && currentUser) ? String(currentUser) : ""; }
    catch (e) { return ""; }
  }

  function _reset(signal) {
    if (resetting) return;
    resetting = true;
    _showWarning(signal);
    _paintCountdown(0);

    (async function () {
      var res = null;
      var key = _user().toLowerCase();
      try {
        if (key && window.CloudAuth && window.CloudAuth._rpcJwt) {
          var s = await window.CloudAuth._fresh(key);
          if (!s) { try { await window.CloudAuth.kick(key); } catch (e) {} s = await window.CloudAuth._fresh(key); }
          if (s) res = await window.CloudAuth._rpcJwt("report_devtools", { p_signal: signal }, s.at);
        } else if (key && window.CloudDB && window.CloudDB._authRpc) {
          res = await window.CloudDB._authRpc(key, "report_devtools", { p_signal: signal });
        }
      } catch (e) { res = null; }

      var exempt = !!(res && res.exempt);
      /* Kunci save() supaya state lama di memori tidak menimpa save baru
         (merge menerima stacks/cleared dari client — tanpa kunci ini reset bisa
         dibatalkan oleh auto-save playSec 30 detik). */
      window.__ACB_SAVE_LOCK__ = true;
      if (!exempt) _wipeLocal();
      _showFinal(res, signal);
      setTimeout(function () { location.reload(); }, 2600);
    })();
  }

  /* ---------- trigger + countdown ---------- */
  function _trigger(signal) {
    if (pending || resetting) return;
    log.push({ signal: signal, at: Date.now() });
    _showWarning(signal);

    var left = COUNTDOWN;
    var tick = setInterval(function () {
      left--;
      _paintCountdown(left);
      if (left <= 0) {
        clearInterval(tick);
        clearInterval(mon);
        pending = null;
        _reset(signal);
      }
    }, 1000);

    /* DevTools ditutup sebelum hitung mundur habis -> batalkan.
       Hanya untuk sinyal "size" (console/debugger sudah bukti kuat). */
    var mon = setInterval(function () {
      if (signal !== "size") return;
      if (!_sizeOpen()) {
        clearInterval(tick);
        clearInterval(mon);
        pending = null;
        _hideWarning();
        try { console.info("[guard] dibatalkan — DevTools tertutup"); } catch (e) {}
        _hud();
      }
    }, 700);

    pending = {
      cancel: function () {
        clearInterval(tick);
        clearInterval(mon);
        pending = null;
        _hideWarning();
        _hud();
      }
    };
    _hud();
  }

  /* ---------- loop deteksi ---------- */
  function _tick() {
    if (resetting || pending || document.hidden) { _hud(); return; }

    if (consoleHit) { _trigger("console"); return; }

    if (_sizeOpen()) {
      sizeHits++;
      if (sizeHits >= 2) { _trigger("size"); sizeHits = 0; }
    } else {
      sizeHits = 0;
    }
    _hud();
  }

  function _dbgCheck() {
    if (resetting || pending || document.hidden) return;
    var now = Date.now();
    if (now - lastDbg < 8000) return;
    lastDbg = now;
    if (!_sizeOpen() && !consoleHit) {
      try { if (_debuggerOpen()) _trigger("debugger"); } catch (e) {}
    }
  }

  function _arm() {
    if (armed) return;
    armed = true;

    /* bait console: getter hanya dipanggil kalau DevTools merender objeknya */
    try {
      var bait = new Image();
      Object.defineProperty(bait, "id", {
        configurable: true,
        get: function () { consoleHit = true; return ""; }
      });
      window.__acbBait = bait;
      console.log(bait);
      setInterval(function () {
        if (consoleHit || resetting || document.hidden) return;
        try { console.log(window.__acbBait); } catch (e) {}
      }, 15000);
    } catch (e) {}

    tickId = setInterval(_tick, TICK_MS);
    setTimeout(_tick, 700);

    /* sinyal debugger hanya diukur setelah pemain benar-benar berinteraksi */
    ["click", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, function () { setTimeout(_dbgCheck, 120); }, { passive: true });
    });

    try { console.info("[guard] armed · sinyal: size/console/debugger"); } catch (e) {}
    _hud();
  }

  /* ---------- HUD diagnostik (hanya dengan ?devguard=1) ---------- */
  function _hud() {
    if (!HUD) return;
    var n = document.getElementById("acbGuardHud");
    if (!n) {
      n = _el("div",
        "position:fixed;left:8px;bottom:8px;z-index:2147482000;background:rgba(0,0,0,.78);" +
        "border:1px solid #334155;border-radius:8px;padding:8px 10px;color:#e2e8f0;" +
        "font:11px/1.5 ui-monospace,Consolas,monospace;max-width:280px",
        "");
      n.id = "acbGuardHud";
      document.body.appendChild(n);
    }
    var st = {
      armed: armed,
      delta: _sizeDelta(),
      sizeOpen: _sizeOpen(),
      consoleHit: consoleHit,
      hits: log.length,
      state: resetting ? "RESET" : pending ? "COUNTDOWN" : "idle"
    };
    n.innerHTML =
      "<b style='color:#7dd3fc'>DEVGUARD</b> " + (st.armed ? "<span style='color:#4ade80'>ARMED</span>" : "<span style='color:#f87171'>OFF</span>") +
      "<br>state: " + st.state +
      "<br>delta: " + st.delta + " (thr " + SIZE_THRESH + ")" +
      "<br>sizeOpen: " + st.sizeOpen + " · console: " + st.consoleHit +
      "<br>hits: " + st.hits +
      "<br><button id='acbGuardTest' style='margin-top:6px;padding:3px 8px;border-radius:6px;" +
      "border:1px solid #f87171;background:#450a0a;color:#fecaca;cursor:pointer'>TEST RESET</button>";
    var b = document.getElementById("acbGuardTest");
    if (b) b.onclick = function () { force("size"); };
  }

  function force(signal) {
    if (resetting) return false;
    _trigger(signal || "size");
    return true;
  }

  function _boot() {
    if (!_desktopish()) {
      try { console.info("[guard] dilewati (mobile/PWA/webdriver)"); } catch (e) {}
      if (HUD) {
        var n = _el("div",
          "position:fixed;left:8px;bottom:8px;z-index:2147482000;background:rgba(0,0,0,.78);" +
          "border:1px solid #7f1d1d;border-radius:8px;padding:8px 10px;color:#fca5a5;" +
          "font:11px/1.5 ui-monospace,Consolas,monospace",
          "<b>DEVGUARD</b> OFF — terdeteksi mobile/PWA/webdriver<br>UA: " +
          String(navigator.userAgent || "").slice(0, 60));
        n.id = "acbGuardHud";
        document.body.appendChild(n);
      }
      return;
    }
    _arm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _boot);
  } else {
    _boot();
  }

  window.ACBGuard = {
    status: function () {
      return {
        armed: armed,
        hud: HUD,
        sizeDelta: _sizeDelta(),
        sizeOpen: _sizeOpen(),
        consoleHit: consoleHit,
        resetting: resetting,
        resets: log.slice()
      };
    },
    force: force
  };
})();
