/* ==========================================================================
   DEVTOOLS GUARD — peringatan + reset total saat Inspect/F12 terdeteksi.

   ATURAN: file ini HANYA mendeteksi dan melaporkan. Hukuman (save dibangun
   ulang ke kondisi awal) dijalankan SERVER lewat RPC `report_devtools`
   (migration 0031), identitas dari auth.uid(). Jadi file ini tidak bisa
   dipakai untuk mereset akun orang lain.

   Sinyal yang dipakai (desktop saja, lihat _desktopish):
     1. "size"     : selisih outer/inner window > 240 px (DevTools di-dock).
                     Harus positif 2 kali berturut-turut supaya animasi resize
                     / sidebar yang sedang terbuka tidak ikut memicu.
     2. "console"  : getter pada objek yang di-console.log — hanya dieksekusi
                     saat DevTools benar-benar merender objek (paling spesifik).
     3. "debugger" : jeda `debugger` > 300 ms, dicek hanya setelah interaksi
                     pemain (maks 1x/8 detik) supaya HP lambat tidak kena.

   ALUR: deteksi -> overlay peringatan + hitung mundur 6 detik -> RPC reset ->
   hapus cache save lokal -> reload (save baru ditarik dari cloud di enterGame).
   Kalau sinyal "size" hilang sebelum hitung mundur habis (DevTools ditutup),
   reset DIBATALKAN — mencegah pemain jujur kehilangan progres karena false
   positive. Sinyal "console" tidak bisa dibatalkan (sekali terdeteksi = bukti).

   AKUN DEVELOPER: masukkan username ke tabel `guard_allow` (lihat 0031) supaya
   tidak ikut direset saat membuka F12 untuk mengembangkan game.
   ========================================================================== */
(function () {
  if (window.__ACB_DEVGUARD__) return;
  window.__ACB_DEVGUARD__ = true;

  var SIZE_THRESH = 240;
  var CONFIRM_MS = 1200;
  var COUNTDOWN = 6;
  var DBG_MS = 300;

  var armed = false;
  var consoleHit = false;
  var sizeHits = 0;
  var lastDbg = 0;
  var pending = null;
  var resetting = false;
  var log = [];

  function _desktopish() {
    try {
      if (navigator.webdriver) return false;
      if (navigator.maxTouchPoints > 0) return false;
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

  function _showWarning(signal) {
    if (document.getElementById("acbGuardOv")) return;
    var ov = _el("div",
      "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(10,0,2,.94);" +
      "font-family:ui-monospace,Consolas,monospace;color:#fecdd3;padding:24px",
      "<div style='max-width:560px;text-align:center'>" +
      "<div style='font-size:13px;letter-spacing:.3em;color:#f87171'>PELANGGARAN TERDETEKSI</div>" +
      "<div style='font-size:26px;font-weight:800;margin:10px 0 6px;color:#fff'>DEVTOOLS / INSPECT TERBUKA</div>" +
      "<div style='font-size:13px;line-height:1.6;color:#fda4af'>Sinyal: <b id='acbGuardSig'></b><br>" +
      "Save akan <b>DIKEMBALIKAN KE AWAL</b> (coin, kartu, item, progres, peringkat).</div>" +
      "<div id='acbGuardCd' style='font-size:44px;font-weight:900;margin:18px 0 4px;color:#f87171'>" + COUNTDOWN + "</div>" +
      "<div style='font-size:11px;color:#94a3b8'>Tutup DevTools sekarang untuk membatalkan.</div>" +
      "</div>");
    ov.id = "acbGuardOv";
    document.body.appendChild(ov);
    var s = document.getElementById("acbGuardSig");
    if (s) s.textContent = signal;
  }

  function _paintCountdown(n) {
    var c = document.getElementById("acbGuardCd");
    if (c) c.textContent = String(Math.max(0, n));
  }

  function _hideWarning() {
    var ov = document.getElementById("acbGuardOv");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function _showFinal(res) {
    var ov = document.getElementById("acbGuardOv");
    var ok = !!(res && res.reset);
    var exempt = !!(res && res.exempt);
    var body =
      "<div style='max-width:560px;text-align:center'>" +
      "<div style='font-size:13px;letter-spacing:.3em;color:#f87171'>PELANGGARAN TERDETEKSI</div>" +
      "<div style='font-size:26px;font-weight:800;margin:10px 0 6px;color:#fff'>" +
      (exempt ? "AKUN DEVELOPER — DIKECUALIKAN" : ok ? "SAVE DIRESET KE AWAL" : "SAVE LOKAL DIRESET") +
      "</div>" +
      "<div style='font-size:13px;line-height:1.6;color:#fda4af'>" +
      (exempt
        ? "Username ini ada di daftar <b>guard_allow</b>, jadi progres tidak dihapus."
        : "Coin 1.000 · Gem 50 · Lv 1 · kartu starter saja · progres &amp; peringkat dikosongkan.") +
      "</div>" +
      "<div style='font-size:11px;color:#94a3b8;margin-top:14px'>Memuat ulang…</div>" +
      "</div>";
    if (!ov) {
      ov = _el("div",
        "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;" +
        "justify-content:center;background:rgba(10,0,2,.97);" +
        "font-family:ui-monospace,Consolas,monospace;color:#fecdd3;padding:24px", body);
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
        }
      } catch (e) { res = null; }
      _wipeLocal();
      _showFinal(res);
      setTimeout(function () { location.reload(); }, 2400);
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
       Hanya untuk sinyal "size" (sinyal console sudah bukti kuat). */
    var mon = setInterval(function () {
      if (signal !== "size") return;
      if (!_sizeOpen()) {
        clearInterval(tick);
        clearInterval(mon);
        pending = null;
        _hideWarning();
        try { console.info("[guard] dibatalkan — DevTools tertutup"); } catch (e) {}
      }
    }, 700);

    pending = {
      cancel: function () {
        clearInterval(tick);
        clearInterval(mon);
        pending = null;
        _hideWarning();
      }
    };
  }

  /* ---------- loop deteksi ---------- */
  function _tick() {
    if (resetting || pending || document.hidden) return;

    if (consoleHit) { _trigger("console"); return; }

    if (_sizeOpen()) {
      sizeHits++;
      if (sizeHits >= 2) { _trigger("size"); sizeHits = 0; }
    } else {
      sizeHits = 0;
    }
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

    setInterval(_tick, CONFIRM_MS);
    setTimeout(_tick, 600);

    /* sinyal debugger hanya diukur setelah pemain benar-benar berinteraksi */
    ["click", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, function () { setTimeout(_dbgCheck, 120); }, { passive: true });
    });
  }

  function _boot() {
    if (!_desktopish()) return;
    _arm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _boot);
  } else {
    _boot();
  }

  /* status read-only untuk audit manual di console (tidak bisa mereset apa pun) */
  window.ACBGuard = {
    status: function () {
      return {
        armed: armed,
        sizeDelta: _sizeDelta(),
        sizeOpen: _sizeOpen(),
        consoleHit: consoleHit,
        resets: log.slice()
      };
    }
  };
})();
