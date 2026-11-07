/* =========================================================================
   mobile-shell.js — responsive shell foundation, now the DEFAULT on every
   device: the phone layout IS the product, so the old width=1900 desktop
   canvas is gone and orientation alone picks the variant.
   - Swaps the hard-locked <meta viewport> to real device-width.
   - Keeps <html> orientation classes current: .m-portrait / .m-landscape.
   - Builds + swaps a bottom tabbar (portrait) or left rail (landscape)
     OUTSIDE #app so router render() innerHTML overwrites never wipe it.
   Nav wiring reuses EXISTING open calls (no invented function names).
   ========================================================================= */
(function () {
  "use strict";

  var VIEWPORT_META = document.querySelector('meta[name="viewport"]');

  /* ---------------------------------------------------------------------
     1) Real device viewport. This is THE fix for every dead mobile @media
        rule: without it the page renders a 1900px canvas and gets scaled
        down on a phone instead of re-laying out.
     --------------------------------------------------------------------- */
  function applyViewport() {
    if (!VIEWPORT_META) return;
    VIEWPORT_META.setAttribute("content",
      "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no");
  }

  /* ---------------------------------------------------------------------
     2) Orientation root classes + nav, kept current on every change.
     --------------------------------------------------------------------- */
  var portraitMQ = window.matchMedia("(orientation:portrait)");
  function applyOrientation() {
    var r = document.documentElement;
    applyViewport();
    var isPortrait = portraitMQ.matches;
    r.classList.toggle("m-portrait", isPortrait);
    r.classList.toggle("m-landscape", !isPortrait);
    buildNav(isPortrait);
  }

  /* ---------------------------------------------------------------------
     5) Nav component — built into document.body (not #app).
        Each act reuses the exact existing open call from the dock/drawer.
        4 tab (bukan 5): "Summon" dibuang karena tombol ROLL di bar lobby
        sudah memanggil handler #rollBtn yang sama persis — satu aksi, satu
        kontrol. Roll tetap bisa diakses dari lobby.
     --------------------------------------------------------------------- */
  var TABS = [
    { key: "home",    label: "Home",    icon: "i-home",
      act: function () { location.hash = "#/"; } },
    { key: "deck",    label: "Deck",    icon: "i-deck",
      act: function () {
        /* Tab Deck = layar DECK sendiri (modal full-screen + banner hazard).
           Fallback lama (Backpack tab 'deck') hanya kalau deck-modal.js belum termuat. */
        if (typeof openDeckModal === "function") { openDeckModal(); return; }
        var p = document.getElementById("backpackPanel");
        var isOpen = p && (document.body.classList.contains("bp-open")
          || (p.style.display !== "none" && p.style.display !== ""));
        if (typeof toggleBackpack === "function") { if (!isOpen) toggleBackpack(); }
        else if (window.openCommandDrawer) { window.openCommandDrawer(); return; }
        if (typeof bpSetTab === "function") bpSetTab("deck");
      } },
    { key: "koleksi", label: "Koleksi", icon: "i-book",
      act: function () {
        if (typeof renderBackpackPanel === "function") renderBackpackPanel();
        var p = document.getElementById("backpackPanel");
        var isOpen = p && (document.body.classList.contains("bp-open")
          || (p.style.display !== "none" && p.style.display !== ""));
        if (!isOpen && typeof toggleBackpack === "function") toggleBackpack();
        else if (typeof bpSetTab === "function") bpSetTab("item");
      } },
    { key: "more",    label: "More",    icon: "i-menu",
      act: function () {
        if (typeof openCommandDrawer === "function") openCommandDrawer();
      } }
  ];

  /* Ikon = file SVG asli project yang di-tint lewat mask (currentColor),
     bukan inline-SVG karangan: warna ikut state aktif, dan rupa = lobby v12. */
  var ICON_URL = {
    "i-home":   "assets/icons/portal.svg",
    "i-deck":   "assets/icons/card-play.svg",
    "i-book":   "assets/icons/backpack.svg",
    /* "More" = pembuka command DRAWER, bukan Settings. Gerigi (gears.svg) dulu
       dipakai di sini padahal secara universal berarti Settings (dan Settings di
       produksi memang berikon gerigi di dalam drawer) -> menipu. Scroll = daftar
       perintah. Aksi & label tidak berubah. */
    "i-menu":   "assets/icons/scroll-unfurled.svg"
  };
  function iconHtml(name) {
    return '<i class="ic ' + name + '" aria-hidden="true" style="-webkit-mask:url(' +
      ICON_URL[name] + ') center/contain no-repeat;mask:url(' + ICON_URL[name] +
      ') center/contain no-repeat"></i>';
  }

  function currentHash() {
    var h = location.hash || "#/";
    return h;
  }
  function bpOpen() {
    var p = document.getElementById("backpackPanel");
    /* HANYA class: toggleBackpack() (js/tower-lobby.js:2069) melepas bp-open/.open
       secara sinkron saat menutup, tapi panel.style.display baru jadi "none" 250ms
       kemudian (animasi fade). Ikut baca display = tab bisa "nyangkut" selama
       jendela animasi itu. */
    return !!(p && (document.body.classList.contains("bp-open") || p.classList.contains("open")));
  }
  function drawerOpen() {
    return document.body.classList.contains("drawer-open");
  }
  /* "deck vs Koleksi" bukan rute — sumbernya tab aktif Backpack. Baca binding
     global panels.js (bpTab) duluan, fallback ke DOM (.bp-tab.on). */
  function bpCurrentTab() {
    try { if (typeof bpTab !== "undefined" && bpTab) return String(bpTab); } catch (e) {}
    var t = document.querySelector(".bp-tabs .bp-tab.on");
    if (t) {
      var m = /bpSetTab\(['"]([^'"]+)['"]\)/.exec(t.getAttribute("onclick") || "");
      if (m) return m[1];
    }
    return "deck";
  }
  function isActive(key) {
    var h = currentHash();
    /* Prioritas dari lapisan yang paling di atas: drawer (More) > panel Backpack
       (deck/koleksi) > rute. Tanpa ini "More" tidak pernah bisa aktif selama
       panel masih terbuka di belakangnya. */
    if (drawerOpen()) return key === "more";
    if (bpOpen()) {
      var t = bpCurrentTab();
      return key === "deck" ? t === "deck" : (key === "koleksi" && t !== "deck");
    }
    if (key === "more") return h === "#/settings";
    if (key === "home") return h === "#/" || h === "" || h === "#/lobby";
    return false;
  }

  function makeButtons(isPortrait) {
    return TABS.map(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-mtab", t.key);
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", t.label);
      if (isActive(t.key)) b.setAttribute("aria-current", "page");
      var icon = iconHtml(t.icon);
      if (isPortrait) {
        b.innerHTML = icon + '<span class="m-tab-label">' + t.label + "</span>";
      } else {
        b.innerHTML = icon;
      }
      b.addEventListener("click", function () {
        try { if (window.sfx && window.sfx.hit) window.sfx.hit(); } catch (e) {}
        try { t.act(); } catch (e) { /* never let a nav tap throw */ }
        refreshActive();
      });
      return b;
    });
  }

  function refreshActive() {
    var nav = document.querySelector(".m-tabbar,.m-rail");
    if (!nav) return;
    var activeIndex = -1;
    [].slice.call(nav.querySelectorAll("[data-mtab]")).forEach(function (b, i) {
      if (isActive(b.getAttribute("data-mtab"))) {
        b.setAttribute("aria-current", "page");
        activeIndex = i;
      } else {
        b.removeAttribute("aria-current");
      }
    });
    var ind = nav.querySelector(".ind");
    if (ind) ind.style.setProperty("--i", activeIndex < 0 ? 0 : activeIndex);
  }

  function buildNav(isPortrait) {
    var wantClass = isPortrait ? "m-tabbar" : "m-rail";
    var wrongClass = isPortrait ? "m-rail" : "m-tabbar";
    // Remove whichever nav variant is not current.
    var wrong = document.querySelector("." + wrongClass);
    if (wrong) wrong.parentNode.removeChild(wrong);

    var nav = document.querySelector("." + wantClass);
    if (!nav) {
      nav = document.createElement("nav");
      nav.className = wantClass;
      nav.setAttribute("role", "tablist");
      nav.setAttribute("aria-label", isPortrait ? "Main navigation" : "Main navigation rail");
      document.body.appendChild(nav);
      nav.innerHTML = isPortrait ? '<span class="ind" aria-hidden="true"></span>' : "";
      makeButtons(isPortrait).forEach(function (b) { nav.appendChild(b); });
    }
  }

  function init() {
    applyOrientation();

    if (portraitMQ.addEventListener) portraitMQ.addEventListener("change", applyOrientation);
    else if (portraitMQ.addListener) portraitMQ.addListener(applyOrientation);
    window.addEventListener("orientationchange", applyOrientation);
    window.addEventListener("resize", applyOrientation);
    window.addEventListener("hashchange", refreshActive);

    /* Deck/Koleksi aktif ikut state panel Backpack, bukan hash — jadi pantau
       class <body> (bp-open/drawer-open) dan display #backpackPanel. Debounce
       rAF supaya tidak refresh tiap mutasi. */
    var _raf = 0;
    function queueRefresh() {
      if (_raf) return;
      _raf = requestAnimationFrame(function () { _raf = 0; refreshActive(); });
    }
    new MutationObserver(queueRefresh).observe(document.body, {
      attributes: true, attributeFilter: ["class"]
    });
    var _bp = document.getElementById("backpackPanel");
    if (_bp) new MutationObserver(queueRefresh).observe(_bp, {
      attributes: true, attributeFilter: ["class", "style"]
    });

    // Re-assert the device-width viewport if the router/boot code ever resets
    // the <meta> back to the old desktop lock (idempotent; cheap).
    new MutationObserver(function () {
      var m = document.querySelector('meta[name="viewport"]');
      if (m && /width=1900/.test(m.getAttribute("content") || "")) applyViewport();
    }).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
