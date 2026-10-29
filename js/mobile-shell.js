/* =========================================================================
   mobile-shell.js — Unit 6-1: touch-only responsive shell foundation.
   Activates for a coarse primary pointer (touch) OR a desktop window no wider
   than 720px CSS px, so the phone layout can be checked on a PC without a
   handset. A touch-capable desktop (precision trackpad => maxTouchPoints>0 but
   pointer:fine) at a normal window width stays desktop.
   - Swaps the hard-locked <meta viewport> to real device-width (and back).
   - Keeps <html> orientation classes current: .m-portrait / .m-landscape.
   - Builds + swaps a bottom tabbar (portrait) or left rail (landscape)
     OUTSIDE #app so router render() innerHTML overwrites never wipe it.
   Nav wiring reuses EXISTING open calls (no invented function names).
   ========================================================================= */
(function () {
  "use strict";

  var COARSE_MQ = window.matchMedia('(pointer:coarse)');
  var NARROW_MQ = window.matchMedia('(max-width: 720px)');
  function shellWanted() { return COARSE_MQ.matches || NARROW_MQ.matches; }

  var VIEWPORT_META = document.querySelector('meta[name="viewport"]');
  var DESKTOP_VIEWPORT = VIEWPORT_META ? VIEWPORT_META.getAttribute("content") : null;

  /* ---------------------------------------------------------------------
     1) Real device viewport (mobile shell only). This is THE fix for every
        dead mobile @media rule.
     --------------------------------------------------------------------- */
  function applyViewport() {
    if (!VIEWPORT_META) return;
    VIEWPORT_META.setAttribute("content",
      "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no");
  }
  function revertViewport() {
    if (VIEWPORT_META && DESKTOP_VIEWPORT !== null) VIEWPORT_META.setAttribute("content", DESKTOP_VIEWPORT);
  }

  /* ---------------------------------------------------------------------
     2) Orientation root classes + nav, re-synced whenever the shell is
        wanted or the window crosses the 720px threshold.
     --------------------------------------------------------------------- */
  var portraitMQ = window.matchMedia("(orientation:portrait)");
  var installed = null; // tri-state: unknown / shell on / shell off
  function applyOrientation() {
    var r = document.documentElement;
    if (!shellWanted()) {
      if (installed === false) return;
      installed = false;
      r.classList.remove("m-portrait", "m-landscape");
      var stale = document.querySelector(".m-tabbar,.m-rail");
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      revertViewport();
      return;
    }
    installed = true;
    applyViewport();
    var isPortrait = portraitMQ.matches;
    r.classList.toggle("m-portrait", isPortrait);
    r.classList.toggle("m-landscape", !isPortrait);
    buildNav(isPortrait);
  }

  /* ---------------------------------------------------------------------
     5) Nav component — built into document.body (not #app).
        Each act reuses the exact existing open call from the dock/drawer.
     --------------------------------------------------------------------- */
  var TABS = [
    { key: "home",    label: "Home",    icon: "home",
      act: function () { location.hash = "#/"; } },
    { key: "summon",  label: "Summon",  icon: "dice",
      act: function () {
        // Summon = the dock's one-tap roll (no open-only gacha screen exists;
        // the premium shop is a separate store, already reachable via the
        // lobby foot-menu). Reuse the real #rollBtn handler so all its gating
        // (server srOn()/srOne, anti-spam lock, currency spend, reveal) is
        // reused verbatim. Fallback: command drawer if #rollBtn is absent.
        var rb = document.getElementById("rollBtn");
        if (rb) rb.click();
        else if (window.openCommandDrawer) window.openCommandDrawer();
      } },
    { key: "deck",    label: "Deck",    icon: "layers",
      act: function () {
        // Exact existing team-builder open (panels.js:1249): open backpack,
        // then switch to the 'deck' tab. Only opens if currently closed.
        var p = document.getElementById("backpackPanel");
        var isOpen = p && (document.body.classList.contains("bp-open")
          || (p.style.display !== "none" && p.style.display !== ""));
        if (typeof toggleBackpack === "function") { if (!isOpen) toggleBackpack(); }
        else if (window.openCommandDrawer) { window.openCommandDrawer(); return; }
        if (typeof bpSetTab === "function") bpSetTab("deck");
      } },
    { key: "koleksi", label: "Koleksi", icon: "grid",
      act: function () {
        if (typeof renderBackpackPanel === "function") renderBackpackPanel();
        var p = document.getElementById("backpackPanel");
        var isOpen = p && (document.body.classList.contains("bp-open")
          || (p.style.display !== "none" && p.style.display !== ""));
        if (!isOpen && typeof toggleBackpack === "function") toggleBackpack();
      } },
    { key: "more",    label: "More",    icon: "menu",
      act: function () {
        if (typeof openCommandDrawer === "function") openCommandDrawer();
      } }
  ];

  var ICONS = {
    home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    dice:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="8" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="8" cy="16" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    grid:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    menu:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>'
  };

  function currentHash() {
    var h = location.hash || "#/";
    return h;
  }
  function isActive(key) {
    var h = currentHash();
    if (key === "home") return h === "#/" || h === "" || h === "#/lobby" || h === "#/";
    if (key === "more") return h === "#/settings";
    return false;
  }

  function makeButtons(isPortrait) {
    return TABS.map(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-mtab", t.key);
      b.setAttribute("aria-label", t.label);
      if (isActive(t.key)) b.setAttribute("aria-current", "page");
      var icon = ICONS[t.icon] || ICONS.menu;
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
    nav.querySelectorAll("[data-mtab]").forEach(function (b) {
      if (isActive(b.getAttribute("data-mtab"))) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
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
      nav.setAttribute("aria-label", isPortrait ? "Main navigation" : "Main navigation rail");
      document.body.appendChild(nav);
      nav.innerHTML = "";
      makeButtons(isPortrait).forEach(function (b) { nav.appendChild(b); });
    }
  }

  function init() {
    applyOrientation();

    [portraitMQ, COARSE_MQ, NARROW_MQ].forEach(function (mq) {
      if (mq.addEventListener) mq.addEventListener("change", applyOrientation);
      else if (mq.addListener) mq.addListener(applyOrientation);
    });
    window.addEventListener("orientationchange", applyOrientation);
    window.addEventListener("resize", applyOrientation);
    window.addEventListener("hashchange", refreshActive);

    // Re-assert the device-width viewport if the router/boot code ever resets
    // the <meta> back to the desktop lock (idempotent; cheap). Only while the
    // shell is wanted — a wide desktop window must keep the 1900 lock.
    new MutationObserver(function () {
      if (!shellWanted()) return;
      var m = document.querySelector('meta[name="viewport"]');
      if (m && /width=1900/.test(m.getAttribute("content") || "")) applyViewport();
    }).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
