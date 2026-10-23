/* =============== PWA HELPER (install prompt + SW update) ===============
 * Menampilkan tombol "Install" saat browser memberi beforeinstallprompt.
 * Dipakai juga oleh js/tower-lobby.js untuk menyalakan tombol install.
 * ============================================================ */
(function () {
  let deferredPrompt = null;

  function isStandalone() {
    return (
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true
    );
  }

  function btns() {
    return Array.prototype.slice.call(document.querySelectorAll("#pwaInstallBtn, #hubInstallBtn, .pwa-install-btn"));
  }

  function showBtn(v) {
    btns().forEach(function (b) { b.style.display = v ? "inline-flex" : "none"; });
  }

  function createBtn() {
    if (btns().length) return;
    const b = document.createElement("button");
    b.id = "pwaInstallBtn";
    b.type = "button";
    b.className = "pwa-install-btn hub-install-btn";
    b.title = "Install aplikasi (PWA)";
    b.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg><span>INSTALL</span>';
    b.style.display = "none";
    document.body.appendChild(b);
  }

  async function install() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
    deferredPrompt = null;
    showBtn(false);
    return true;
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    createBtn();
    showBtn(true);
  });

  /* Lobby me-render ulang tombol INSTALL, jadi sinkronkan visibility
   * whenever DOM berubah. */
  function sync() {
    if (!deferredPrompt) return;
    btns().forEach(function (b) { if (b.style.display === "none") b.style.display = "inline-flex"; });
  }
  if (typeof MutationObserver === "function") {
    const mo = new MutationObserver(sync);
    const start = function () {
      if (document.body) { mo.observe(document.body, { childList: true, subtree: true }); return true; }
      return false;
    };
    if (!start()) document.addEventListener("DOMContentLoaded", start);
  }

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    showBtn(false);
  });

  /* Delegated click: tombol bisa di-render ulang oleh lobby. */
  document.addEventListener("click", function (e) {
    const t = e.target && e.target.closest
      ? e.target.closest("#pwaInstallBtn, #hubInstallBtn, .pwa-install-btn")
      : null;
    if (!t) return;
    e.preventDefault();
    install();
  });

  document.addEventListener("DOMContentLoaded", function () {
    createBtn();
    /* Kalau sudah ter-install (standalone), tombol tidak perlu tampil. */
    showBtn(!isStandalone() && !!deferredPrompt);
  });

  window.PWA = {
    install: install,
    isStandalone: isStandalone,
    canInstall: function () { return !!deferredPrompt; },
  };
})();
