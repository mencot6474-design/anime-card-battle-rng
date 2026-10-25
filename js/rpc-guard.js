/* ==========================================================================
   RPC GUARD — "bom" reset 30 detik saat login untuk akun yang ketahuan
   memanggil RPC lewat curl/Postman/script (migration 0032).

   PEMBAGIAN TUGAS:
     * DETEKSI + HUKUMAN ada di server (`_rpc_pre_request`, honeypot, RPC
       `guard_status` / `guard_nuke`). File ini hanya menampilkan hitung mundur
       30 detik lalu memanggil `guard_nuke` dan membersihkan cache lokal.
     * Server sudah MENGUNCI semua RPC tulis selama `pending_nuke = true`
       (403 GUARD_PENDING), jadi menutup tab tidak menyelamatkan progres.
     * Kalau client ini tidak pernah jalan (build lama di cache), server
       mengeksekusi nuke sendiri setelah `guard_cfg.pending_ttl` (default 24 jam).

   DIPANGGIL DARI `enterGame()` (js/boot.js) setelah sesi Auth siap dan SEBELUM
   save ditarik. Balasan `true` = reset sedang berjalan (jangan lanjut render).

   AKUN DEVELOPER: `guard_allow` (0031) tetap berlaku — server membalas
   `exempt:true`, jadi overlay tidak muncul.
   ========================================================================== */
(function () {
  if (window.__ACB_RPC_GUARD__) return;
  window.__ACB_RPC_GUARD__ = true;

  var COUNTDOWN = 30;
  var RELOAD_MS = 2600;
  var running = false;

  var OV_CSS =
    "position:fixed;inset:0;z-index:2147483200;display:flex;align-items:center;" +
    "justify-content:center;background:rgba(8,0,2,.96);padding:24px;" +
    "font-family:ui-monospace,Consolas,monospace;color:#fecdd3";

  function _el(tag, css, html) {
    var n = document.createElement(tag);
    n.style.cssText = css;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function _ov(body) {
    var ov = document.getElementById("acbNukeOv");
    if (!ov) {
      ov = _el("div", OV_CSS, body);
      ov.id = "acbNukeOv";
      document.body.appendChild(ov);
    } else {
      ov.innerHTML = body;
    }
    return ov;
  }

  function _cd(n) {
    var c = document.getElementById("acbNukeCd");
    if (c) c.textContent = String(Math.max(0, n));
  }

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

  function _showCountdown(reason) {
    _ov(
      "<div style='max-width:600px;text-align:center'>" +
      "<div style='font-size:13px;letter-spacing:.32em;color:#f87171'>PELANGGARAN TERDETEKSI</div>" +
      "<div style='font-size:27px;font-weight:800;margin:10px 0 6px;color:#fff'>AKSES RPC DI LUAR GAME</div>" +
      "<div style='font-size:13px;line-height:1.65;color:#fda4af'>" +
      "Sinyal: <b>" + String(reason || "honeypot").toUpperCase() + "</b><br>" +
      "Save akan <b>DIKEMBALIKAN KE AWAL</b> dalam<br>" +
      "<span style='font-size:11px;color:#94a3b8'>coin · gem · kartu · item · progres · peringkat</span></div>" +
      "<div id='acbNukeCd' style='font-size:56px;font-weight:900;margin:16px 0 2px;color:#f87171'>" + COUNTDOWN + "</div>" +
      "<div style='font-size:11px;color:#94a3b8'>Save sudah dikunci di server — menutup tab tidak membantu.</div>" +
      "</div>");
  }

  function _showFinal(res, failed) {
    var ok = !!(res && res.reset);
    _ov(
      "<div style='max-width:600px;text-align:center'>" +
      "<div style='font-size:13px;letter-spacing:.32em;color:#f87171'>BOM DIJATUHKAN</div>" +
      "<div style='font-size:27px;font-weight:800;margin:10px 0 6px;color:#fff'>" +
      (ok ? "SAVE DIRESET KE AWAL" : failed ? "RESET GAGAL — COBA LAGI" : "RESET DIPROSES") + "</div>" +
      "<div style='font-size:13px;line-height:1.65;color:#fda4af'>" +
      (ok
        ? "Coin 1.000 · Gem 50 · Lv 1 · kartu starter saja · progres &amp; peringkat dikosongkan."
        : failed
          ? "Server tidak menjawab. Akun tetap terkunci; muat ulang halaman untuk mencoba lagi."
          : "Server sedang menyelesaikan reset.") +
      "</div>" +
      "<div style='font-size:11px;color:#94a3b8;margin-top:14px'>Memuat ulang…</div>" +
      "</div>");
  }

  function _sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function _run(username, st) {
    /* Kunci save() lokal (state.js) supaya auto-save playSec tidak menimpa
       save baru setelah reset — sama seperti guard DevTools (0031). */
    window.__ACB_SAVE_LOCK__ = true;
    _showCountdown(st && st.reason);

    for (var left = COUNTDOWN; left > 0; left--) {
      _cd(left);
      await _sleep(1000);
    }
    _cd(0);

    var res = null;
    try {
      res = await window.CloudDB.guardNuke(username);
    } catch (e) {
      res = null;
    }

    var failed = !(res && res.ok);
    _wipeLocal();
    _showFinal(res, failed);
    setTimeout(function () { location.reload(); }, RELOAD_MS);
  }

  async function check(username) {
    if (running) return true;
    if (!username) return false;
    if (!window.CloudDB || !window.CloudDB.guardStatus) return false;

    var st = null;
    try {
      st = await window.CloudDB.guardStatus(username);
    } catch (e) {
      return false;
    }
    if (!st || !st.ok || !st.pending || st.exempt) return false;

    running = true;
    try {
      await _run(username, st);
    } catch (e) {
      running = false;
      return false;
    }
    return true;
  }

  window.ACBRpcGuard = { check: check };
})();
