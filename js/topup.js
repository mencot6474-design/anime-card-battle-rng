/* =============== TOP-UP GEMS (Google Play Billing + Trakteer Shop) ===============
 * Android (Capacitor) : beli lewat Google Play Billing (Edge Function play-verify).
 * Web (PWA)           : beli lewat Trakteer Shop (QRIS/VA) -> kode redeem,
 *                       atau tukar kode redeem langsung (Edge Function redeem-code).
 *
 * Flow client:
 *  1. buy(packId) -> plugin native PlayBilling.startPurchase(productId)
 *  2. plugin mengembalikan purchaseToken setelah Google Play mengonfirmasi bayar
 *  3. client kirim purchaseToken ke Edge Function `play-verify`
 *  4. server memverifikasi ke Play Developer API lalu mengkredit gems 1x (idempotent)
 *  5. client sinkron saldo gems dari cloud
 *
 * Flow web (redeem):
 *  1. user Beli di Trakteer Shop -> dapat kode redeem
 *  2. user input kode di tab "PUNYA KODE"
 *  3. client kirim kode ke Edge Function `redeem-code`
 *  4. server validasi + kredit gems 1x (idempotent, atomik)
 *
 * Gems SELALU dihitung server. Client tidak pernah menambah saldo sendiri.
 * ============================================================ */
(function () {
  const PLUGIN = "PlayBilling";

  let busy = false;

  function toastFn() { return typeof toast === "function" ? toast : function () {}; }

  function isNative() {
    return (typeof window.IS_NATIVE_BUILD === "function" && window.IS_NATIVE_BUILD())
        || (typeof window.Capacitor !== "undefined" && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    if (!cap.Plugins || !cap.Plugins[PLUGIN]) return null;
    return cap.Plugins[PLUGIN];
  }

  /** Password hash user ini (disimpan lokal saat login/register). */
  function passHashOf(user) {
    if (!user) return "";
    try {
      const users = (typeof getUsers === "function") ? getUsers() : {};
      const rec = users[String(user).toLowerCase()];
      return rec && rec.pass ? rec.pass : "";
    } catch (e) { return ""; }
  }

  function requireLogin() {
    var u = (typeof currentUser !== "undefined") ? currentUser : null;
    if (!u) {
      toastFn()("LOGIN DULU", "Top-up hanya untuk akun yang sudah login.", "#fbbf24");
      return false;
    }
    return true;
  }

  function currentUserName() {
    return (typeof currentUser !== "undefined" && currentUser) ? String(currentUser) : "";
  }

  /* ---------- UI status di dalam modal ---------- */
  function statusBox() { return document.getElementById("topupStatusBox"); }

  function setStatus(html) {
    const b = statusBox();
    if (b) b.innerHTML = html || "";
  }

  function setButtonsBusy(v) {
    document.querySelectorAll(".topup-buy-btn").forEach(function (b) { b.disabled = !!v; });
    busy = !!v;
  }

  function renderInfo(title, text, cls) {
    setButtonsBusy(false);
    setStatus(
      '<div class="topup-status topup-status--' + (cls || "wait") + '">' +
        '<div class="topup-status-title">' + title + '</div>' +
        '<div class="topup-status-text">' + text + '</div>' +
      '</div>'
    );
  }

  /* Ikon resmi mata uang premium. */
  function gemIconHTML(size) {
    return '<img class="topup-inline-gem" src="assets/images/premium-currency.webp" alt="" width="' + size + '" height="' + size + '">';
  }

  function renderSuccess(gems, balance) {
    setButtonsBusy(false);
    setStatus(
      '<div class="topup-status topup-status--ok">' +
        '<div class="topup-status-title">' + gemIconHTML(20) + ' PEMBAYARAN BERHASIL!</div>' +
        '<div class="topup-status-text">+' + gems.toLocaleString("id-ID") +
        ' Gems masuk ke akunmu. Saldo sekarang <b>' +
        (typeof balance === "number" ? balance.toLocaleString("id-ID") : "-") + ' Gems</b>.</div>' +
      '</div>'
    );
    try {
      var b = typeof beep === "function" ? beep : null;
      if (b) { b(960, 0.25, "triangle", 0.15); setTimeout(function () { b(1200, 0.2, "triangle", 0.12); }, 200); }
    } catch (e) { /* ignore */ }
    toastFn()("GEMS DITAMBAHKAN!", "+" + gems.toLocaleString("id-ID") + " Gems berhasil masuk ke akunmu", "#ffd700");
  }

  /* ---------- Sinkron saldo gems dari cloud ---------- */
  async function syncGemsFromCloud(username) {
    try {
      if (window.CloudDB && typeof window.CloudDB.getCloudGems === "function") {
        const g = await window.CloudDB.getCloudGems(username);
        if (typeof g === "number" && typeof state !== "undefined" && state) {
          state.premiumGems = g;
          if (typeof save === "function") { try { save(); } catch (e) {} }
        }
        return g;
      }
    } catch (e) { /* ignore */ }
    return null;
  }


  /* ---------- Aksi utama ---------- */
  async function buy(packId) {
    if (busy) return;

    if (!isNative()) {
      /* Build web: arahkan ke flow Trakteer Shop (kode redeem). */
      openShop(packId);
      return;
    }
    if (!requireLogin()) return;

    const pack = (typeof window.TOPUP_PACKS !== "undefined") ? window.TOPUP_PACKS[packId] : null;
    if (!pack) { toastFn()("ERROR", "Paket tidak ditemukan.", "#f87171"); return; }

    const username = currentUserName().toLowerCase();
    const passHash = passHashOf(username);
    if (!passHash) {
      toastFn()("ERROR", "Sesi login tidak lengkap. Silakan logout lalu login ulang.", "#f87171");
      return;
    }

    const p = plugin();
    if (!p) {
      toastFn()("ERROR", "Modul pembelian tidak tersedia di perangkat ini.", "#f87171");
      return;
    }

    setButtonsBusy(true);
    setStatus('<div class="topup-status topup-status--wait"><div class="topup-status-title">⏳ MEMBUKA GOOGLE PLAY…</div></div>');

    let purchase;
    try {
      purchase = await p.startPurchase({ productId: pack.productId });
    } catch (err) {
      renderInfo("❌ PEMBELIAN GAGAL", String((err && err.message) || err || "Tidak bisa memulai pembelian."), "fail");
      toastFn()("GAGAL", String((err && err.message) || err || "Pembelian gagal."), "#f87171");
      return;
    }

    if (!purchase || !purchase.purchaseToken) {
      const reason = purchase && purchase.cancelled ? "Pembelian dibatalkan." : "Pembelian tidak terkonfirmasi.";
      renderInfo("ℹ️ PEMBELIAN SELESAI", reason, "fail");
      return;
    }

    setStatus('<div class="topup-status topup-status--wait"><div class="topup-status-title">⏳ MEMVERIFIKASI PEMBAYARAN…</div></div>');

    const res = await window.CloudDB.invokeFunction("play-verify", {
      username: username,
      password_hash: passHash,
      product_id: pack.productId,
      purchase_token: purchase.purchaseToken,
      order_id: purchase.orderId || "",
      acknowledged: purchase.acknowledged === true,
    });

    if (!res.ok) {
      renderInfo("❌ VERIFIKASI GAGAL", res.error || "Gagal memverifikasi pembelian ke Google Play.", "fail");
      toastFn()("GAGAL", res.error || "Verifikasi pembelian gagal.", "#f87171");
      return;
    }

    renderSuccess(res.gems || pack.gems, res.balance);
    await syncGemsFromCloud(username);
  }

  /* ---------- Trakteer Shop (web build) ---------- */
  /* URL toko + slug produk berasal dari js/config.js (window.ACB_CONFIG).
   * Fallback: window.TRAKTEER_SHOP_URL (index.html). */
  const CFG = (typeof window !== "undefined" && window.ACB_CONFIG) || {};
  const TRAKTEER_SHOP_URL =
    CFG.trakteerShopUrl ||
    (typeof window !== "undefined" && window.TRAKTEER_SHOP_URL) ||
    "";
  const TRAKTEER_PRODUCTS = CFG.trakteerProducts || {};

  function shopUrlFor(packId) {
    if (!TRAKTEER_SHOP_URL) return "";
    const pack = (typeof window.TOPUP_PACKS !== "undefined") ? window.TOPUP_PACKS[packId] : null;
    if (!pack) return TRAKTEER_SHOP_URL;
    /* Slug produk Trakteer (bisabeda dari product ID Google Play). */
    const slug = TRAKTEER_PRODUCTS[pack.id] || pack.productId;
    /* Produk Trakteer dipanggil via ?product=<slug> atau path /<slug>. */
    return TRAKTEER_SHOP_URL + (TRAKTEER_SHOP_URL.indexOf("?") >= 0 ? "&" : "?") +
      "product=" + encodeURIComponent(slug);
  }

  function openShop(packId) {
    const url = shopUrlFor(packId);
    if (!url) {
      renderInfo(
        "ℹ️ TOKO BELUM DIKONFIGURASI",
        "Link toko Trakteer belum diatur. Bookmark dulu halaman ini, atau cek kembali nanti.",
        "fail",
      );
      toastFn()("TOKO BELUM SIAP", "Link toko Trakteer belum dikonfigurasi.", "#fbbf24");
      return;
    }
    try { window.open(url, "_blank", "noopener"); }
    catch (e) { window.location.href = url; }
    renderInfo(
      "🛒 LALU KE TOKO TRAKTEER",
      "Selesaikan pembayaran di tab toko. Setelah bayar, kode redeem dikirim ke Anda. " +
      "Kembali ke sini dan masukkan kodenya di tab PUNYA KODE.",
      "wait",
    );
  }

  /* ---------- Tukar kode redeem ---------- */
  async function redeem() {
    if (busy) return;
    if (!requireLogin()) return;
    if (!window.CloudDB || typeof window.CloudDB.invokeFunction !== "function") {
      renderInfo("❌ SERVER BELUM SIAP", "Modul sinkronisasi cloud belum termuat. Muat ulang halaman.", "fail");
      return;
    }

    const input = document.getElementById("topupCodeInput");
    const code = input ? String(input.value || "").trim().toUpperCase() : "";
    if (!code) {
      renderInfo("⚠️ KODE KOSONG", "Masukkan kode redeem dulu.", "fail");
      return;
    }

    const username = currentUserName().toLowerCase();
    const passHash = passHashOf(username);
    if (!passHash) {
      renderInfo("❌ SESI TIDAK LENGKAP", "Silakan logout lalu login ulang.", "fail");
      return;
    }

    setButtonsBusy(true);
    setStatus('<div class="topup-status topup-status--wait"><div class="topup-status-title">⏳ MEMERIKSA KODE…</div></div>');

    const res = await window.CloudDB.invokeFunction("redeem-code", {
      username: username,
      password_hash: passHash,
      code: code,
    });

    /* Pesan ramah per kode error server. */
    const FRIENDLY = {
      KODE_TIDAK_DITEMUKAN: "Kode tidak ditemukan. Cek kembali kode dari Trakteer.",
      KODE_NONAKTIF: "Kode ini sudah dinonaktifkan.",
      KODE_KEDALUWARSA: "Kode ini sudah kedaluwarsa.",
      KODE_SUDAH_DIPAKAI: "Kode ini sudah pernah dipakai akun lain.",
      PASSWORD_SALAH: "Password salah. Silakan logout lalu login ulang.",
      AKUN_TIDAK_DITEMUKAN: "Akun tidak ditemukan di server.",
      INPUT_TIDAK_VALID: "Data tidak valid.",
      KODE_WAJIB_DIISI: "Masukkan kode redeem dulu.",
    };

    if (!res.ok) {
      const msg = FRIENDLY[res.error] || res.error || "Kode tidak valid atau sudah dipakai.";
      renderInfo("❌ KODE GAGAL DITERIMA", msg, "fail");
      toastFn()("GAGAL", msg, "#f87171");
      return;
    }

    if (res.already) {
      renderInfo("ℹ️ KODE SUDAH DIPAKAI", "Kode ini sudah pernah ditukar. Saldo tidak ditambah lagi.", "fail");
      toastFn()("SUDAH DIPAKAI", "Kode ini sudah pernah ditukar.", "#fbbf24");
      await syncGemsFromCloud(username);
      return;
    }

    renderSuccess(res.gems || 0, res.balance);
    if (input) input.value = "";
    await syncGemsFromCloud(username);
  }

  window.Topup = {
    buy: buy,
    redeem: redeem,
    openShop: openShop,
    checkNow: function () {},
    cancel: function () {},
  };
})();

