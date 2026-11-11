/* ============================================================
   SHEET FX + CYBER SFX (ZERO-PARTICLE HAZARD STUDIO EDITION)
   All battle FX run strictly with 0 particles, 0 shadowBlur,
   0 backdrop-filter, using GPU WAAPI + SVG overlays + #animeAtkCanvas.
   ============================================================ */
(function () {
  "use strict";

  var CyberSfx = (function () {
    var ac = null;
    function isMuted() { return !!(window.state && window.state.muted); }
    function ctx() {
      if (isMuted()) return null;
      if (!ac) {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) { try { ac = new AudioCtx(); } catch (e) {} }
      }
      if (ac && ac.state === "suspended") ac.resume().catch(function () {});
      return ac;
    }
    function noiseBurst(o) {
      var c = ctx(); if (!c) return;
      var dur = o.dur || 0.14, delay = o.delay || 0, t0 = c.currentTime + delay;
      var len = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);
      var src = c.createBufferSource(); src.buffer = buf;
      var flt = c.createBiquadFilter();
      flt.type = o.filterType || "bandpass";
      flt.frequency.setValueAtTime(o.freq || 1800, t0);
      if (o.endFreq) flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.endFreq), t0 + dur);
      flt.Q.value = o.q || 1.4;
      var g = c.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(o.gain || 0.15, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(c.destination);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }
    function tone(o) {
      var c = ctx(); if (!c) return;
      var dur = o.dur || 0.14, delay = o.delay || 0, t0 = c.currentTime + delay;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || "sine";
      var f1 = Math.max(20, o.f1 || 440), f2 = Math.max(20, o.f2 || f1);
      osc.frequency.setValueAtTime(f1, t0);
      if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(o.gain || 0.10, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }
    return {
      dash: function () {
        noiseBurst({ dur: 0.09, filterType: "bandpass", freq: 1600, endFreq: 4200, q: 1.6, gain: 0.10 });
      },
      katanaSlash: function (p) {
        p = p || 1;
        noiseBurst({ dur: 0.12, filterType: "bandpass", freq: 3200 * p, endFreq: 700, q: 1.8, gain: 0.16 });
        tone({ type: "sawtooth", f1: 1400 * p, f2: 210, dur: 0.11, gain: 0.08 });
      },
      katanaFinisher: function () {
        noiseBurst({ dur: 0.22, filterType: "lowpass", freq: 1800, endFreq: 220, q: 0.9, gain: 0.20 });
        tone({ type: "triangle", f1: 220, f2: 52, dur: 0.22, gain: 0.13 });
        noiseBurst({ dur: 0.14, filterType: "bandpass", freq: 3400, endFreq: 1100, q: 2.0, gain: 0.15, delay: 0.02 });
      },
      plasmaBurn: function () {
        noiseBurst({ dur: 0.26, filterType: "lowpass", freq: 1200, endFreq: 280, q: 0.8, gain: 0.18 });
        tone({ type: "sawtooth", f1: 240, f2: 88, dur: 0.22, gain: 0.08 });
        tone({ type: "triangle", f1: 680, f2: 310, dur: 0.15, gain: 0.05, delay: 0.03 });
      },
      cryoFreeze: function () {
        tone({ type: "triangle", f1: 1760, f2: 2640, dur: 0.13, gain: 0.08 });
        tone({ type: "sine", f1: 2480, f2: 1240, dur: 0.22, gain: 0.08, delay: 0.04 });
        noiseBurst({ dur: 0.10, filterType: "highpass", freq: 3600, endFreq: 2200, q: 1.5, gain: 0.07 });
      },
      cryoShatter: function () {
        noiseBurst({ dur: 0.18, filterType: "highpass", freq: 2800, endFreq: 900, q: 1.2, gain: 0.16 });
        tone({ type: "triangle", f1: 1900, f2: 480, dur: 0.15, gain: 0.10 });
        tone({ type: "sine", f1: 120, f2: 48, dur: 0.16, gain: 0.09 });
      },
      systemLock: function () {
        tone({ type: "square", f1: 980, f2: 140, dur: 0.12, gain: 0.08 });
        tone({ type: "sawtooth", f1: 1680, f2: 260, dur: 0.15, gain: 0.07, delay: 0.03 });
        noiseBurst({ dur: 0.14, filterType: "highpass", freq: 2600, endFreq: 900, q: 1.1, gain: 0.12 });
      },
      thunderShock: function () { this.systemLock(); },
      matrixSpace: function () {
        noiseBurst({ dur: 0.14, filterType: "bandpass", freq: 900, endFreq: 3800, q: 1.6, gain: 0.13 });
        tone({ type: "sine", f1: 520, f2: 1180, dur: 0.11, gain: 0.07 });
      },
      cutInActivate: function () {},
      aoeCharge: function () {},
      aoeDetonate: function () {},
      aoeChainTick: function () {},
      rebirthAscendCharge: function () {
        tone({ type: "sine", f1: 80, f2: 240, dur: 0.3, gain: 0.16 });
      },
      rebirthAscendBoom: function () {
        [523, 659, 784, 1046].forEach(function (f, idx) {
          tone({ type: "triangle", f1: f, f2: f * 1.01, dur: 0.4 - idx * 0.04, gain: 0.12, delay: 0.045 * idx });
        });
      },
      unlock: function () {
        var c = ctx();
        if (c && c.state === "suspended") c.resume().catch(function () {});
      }
    };
  })();
  window.CyberSfx = CyberSfx;
  (window.__aabAudioUnlockers = window.__aabAudioUnlockers || []).push(function () { CyberSfx.unlock(); });

  function spdMs(ms) {
    return (typeof window.bsMs === "function") ? Math.max(70, window.bsMs(ms)) : ms;
  }

  function resolveFighter(selOrSide) {
    if (!selOrSide || selOrSide === "foe" || selOrSide === ".fighter.foe") return document.querySelector(".fighter.foe");
    if (selOrSide === "me" || selOrSide === ".fighter.me") return document.querySelector(".fighter.me");
    return (typeof selOrSide === "string") ? document.querySelector(selOrSide) : selOrSide;
  }

  function flashCardFx(selOrSide, kind) {
    var fighter = resolveFighter(selOrSide);
    if (!fighter) return;
    var fl = fighter.querySelector(".fx-flash");
    if (!fl) return;
    fl.classList.remove("is-hit", "is-burn", "is-shock");
    void fl.offsetWidth;
    fl.classList.add(kind === "shock" ? "is-shock" : kind === "burn" ? "is-burn" : "is-hit");
  }
  window.hzFlashCard = flashCardFx;

  function sheetStatusSync() {
    var b = (typeof bt !== "undefined" && bt && !bt.over) ? bt : null;
    var pairs = [
      {
        sel: ".fighter.me",
        burn: b ? Math.max(0, b.pBurn || 0) : 0,
        freeze: b ? Math.max(0, b.pFreeze || 0) : 0,
        shock: b && !(b.pFreeze > 0) ? Math.max(0, b.pStun || 0) : 0
      },
      {
        sel: ".fighter.foe",
        burn: b ? Math.max(0, b.eBurn || 0) : 0,
        freeze: b ? Math.max(0, b.freezeLeft || 0) : 0,
        shock: b && !(b.freezeLeft > 0) ? Math.max(0, b.eStun || 0) : 0
      }
    ];
    if (!b) {
      document.querySelectorAll(".dodge-ghost").forEach(function (g) {
        if (g.parentNode) g.parentNode.removeChild(g);
      });
    }
    pairs.forEach(function (item) {
      var fighter = document.querySelector(item.sel);
      if (!fighter) return;
      var shell = fighter.querySelector(".fc-frame.card-shell") || fighter;
      shell.classList.toggle("is-burning", item.burn > 0);
      shell.classList.toggle("is-frozen", item.freeze > 0);
      shell.classList.toggle("is-shocked", item.shock > 0);

      var key = item.burn + "|" + item.freeze + "|" + item.shock;
      var strip = fighter.querySelector(".hz-status-strip");
      if (!strip) {
        strip = document.createElement("div");
        strip.className = "hz-status-strip";
        fighter.insertBefore(strip, fighter.firstChild);
      }
      if (strip.dataset.key === key) return;
      strip.dataset.key = key;
      var html = "";
      if (item.burn > 0) html += '<span class="st-pill burn"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c1 4-2 6-2 9a2 2 0 0 0 4 0c0-2 2-3 2-3s3 3 3 7a7 7 0 1 1-14 0c0-4 3-7 7-13z"/></svg>BURN ' + item.burn + "T</span>";
      if (item.freeze > 0) html += '<span class="st-pill freeze"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v20M4.9 6.5l14.2 11M19.1 6.5L4.9 17.5"/></svg>FROZEN ' + item.freeze + "T</span>";
      if (item.shock > 0) html += '<span class="st-pill shock"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>SHOCK ' + item.shock + "T</span>";
      strip.innerHTML = html;
    });
  }
  window.sheetStatusSync = sheetStatusSync;

  function burnSheetTick(sideOrIgnite, isIgniteOpt) {
    var side = (sideOrIgnite === "me" || sideOrIgnite === ".fighter.me") ? "me" : "foe";
    var isIgnite = (sideOrIgnite === true) ? true : !!isIgniteOpt;
    var fighter = resolveFighter(side);
    if (!fighter) return;
    var card = fighter.querySelector(".card-shell") || fighter;
    var r = card.getBoundingClientRect();
    CyberSfx.plasmaBurn();
    if (r.width && typeof window.fxBurnInferno === "function") {
      try { window.fxBurnInferno(r, !isIgnite); } catch (e) {}
    }
    flashCardFx(fighter, "burn");
    if (isIgnite && typeof window.triggerStageShake === "function") window.triggerStageShake(false);
    if (typeof fighter.animate === "function") {
      try {
        fighter.animate([
          { transform: "translate3d(0,0,0) scale(1)", offset: 0 },
          { transform: "translate3d(-5px,-6px,0) scale(0.94)", offset: 0.24 },
          { transform: "translate3d(5px,3px,0) scale(1.03)", offset: 0.56 },
          { transform: "translate3d(0,0,0) scale(1)", offset: 1 }
        ], { duration: spdMs(320), easing: "ease-out" });
      } catch (e) {}
    }
    sheetStatusSync();
  }
  window.burnSheetTick = burnSheetTick;

  function playFreezeFx(sideOrSel, isShatter) {
    var fighter = resolveFighter(sideOrSel);
    if (!fighter) return;
    var card = fighter.querySelector(".card-shell") || fighter;
    var r = card.getBoundingClientRect();
    if (isShatter) {
      CyberSfx.cryoShatter();
      flashCardFx(fighter, "hit");
      if (typeof window.triggerStageShake === "function") window.triggerStageShake(true);
    } else {
      CyberSfx.cryoFreeze();
    }
    if (r.width && typeof window.fxFreezeSpears === "function") {
      try { window.fxFreezeSpears(r, !!isShatter); } catch (e) {}
    }
    if (typeof fighter.animate === "function") {
      try {
        fighter.animate([
          { transform: "translate3d(0,0,0) scale(1)", offset: 0 },
          { transform: "translate3d(-7px,0,0) scale(0.95)", offset: 0.2 },
          { transform: "translate3d(7px,0,0) scale(0.97)", offset: 0.45 },
          { transform: "translate3d(-3px,0,0) scale(1.02)", offset: 0.72 },
          { transform: "translate3d(0,0,0) scale(1)", offset: 1 }
        ], { duration: spdMs(280), easing: "ease-out" });
      } catch (e) {}
    }
    sheetStatusSync();
  }
  window.playFreezeFx = playFreezeFx;

  function playShockFx(sideOrSel) {
    var fighter = resolveFighter(sideOrSel);
    if (!fighter) return;
    var card = fighter.querySelector(".card-shell") || fighter;
    var r = card.getBoundingClientRect();
    CyberSfx.thunderShock();
    if (r.width && typeof window.fxThunderJudgment === "function") {
      try { window.fxThunderJudgment(r); } catch (e) {}
    }
    flashCardFx(fighter, "shock");
    if (typeof window.triggerStageShake === "function") window.triggerStageShake(true);
    if (typeof fighter.animate === "function") {
      try {
        fighter.animate([
          { transform: "translate3d(0,0,0)", offset: 0 },
          { transform: "translate3d(-9px,-4px,0) scale(0.94)", offset: 0.14 },
          { transform: "translate3d(9px,4px,0) scale(0.97)", offset: 0.30 },
          { transform: "translate3d(-7px,3px,0)", offset: 0.48 },
          { transform: "translate3d(6px,-3px,0)", offset: 0.66 },
          { transform: "translate3d(-3px,2px,0)", offset: 0.82 },
          { transform: "translate3d(0,0,0) scale(1)", offset: 1 }
        ], { duration: spdMs(320), easing: "linear" });
      } catch (e) {}
    }
    sheetStatusSync();
  }
  window.playShockFx = playShockFx;

  function ensureGhostPair(col, card) {
    if (!col) return null;
    var gb = col.querySelector(".dodge-ghost.g-b");
    var ga = col.querySelector(".dodge-ghost.g-a");
    if (!gb) {
      gb = document.createElement("div");
      gb.className = "dodge-ghost g-b";
      col.insertBefore(gb, col.firstChild);
    }
    if (!ga) {
      ga = document.createElement("div");
      ga.className = "dodge-ghost g-a";
      col.insertBefore(ga, col.firstChild);
    }
    if (card && card.offsetHeight) {
      var h = card.offsetHeight + "px";
      gb.style.height = h;
      ga.style.height = h;
    }
    return { a: ga, b: gb };
  }

  function playMatrixDodgeFx(defSel, atkSel) {
    var defEl = resolveFighter(defSel || ".fighter.me");
    if (!defEl) return;
    var isMeDef = defEl.classList.contains("me");
    var atkEl = resolveFighter(atkSel || (isMeDef ? ".fighter.foe" : ".fighter.me"));
    var defCard = defEl.querySelector(".card-shell") || defEl;
    var atkCard = atkEl ? (atkEl.querySelector(".card-shell") || atkEl) : null;
    var toR = defCard.getBoundingClientRect();
    var fromR = atkCard ? atkCard.getBoundingClientRect() : null;
    if (!toR.width) return;

    CyberSfx.matrixSpace();

    var rawDir = isMeDef ? -1 : 1;
    var step = Math.round(Math.min(68, toR.width * 0.42));
    var dir = rawDir;
    var vw = window.innerWidth || 1200;
    if (rawDir > 0 && toR.right + step > vw - 8) dir = -1;
    else if (rawDir < 0 && toR.left - step < 8) dir = 1;
    var sideDist = step * dir;

    if (typeof window.fxDodgeShunpo === "function") {
      try { window.fxDodgeShunpo(fromR, toR, sideDist, !isMeDef); } catch (e) {}
    }

    var col = defEl.closest(".me-col") || defEl.parentElement;
    var ghosts = ensureGhostPair(col, defCard);
    if (ghosts) {
      ghosts.b.style.top = (defEl.offsetTop || 0) + "px";
      ghosts.a.style.top = (defEl.offsetTop || 0) + "px";
      ghosts.b.style.setProperty("--gx", "0px");
      ghosts.b.style.setProperty("--gsk", "0deg");
      ghosts.a.style.setProperty("--gx", Math.round(sideDist * 0.42) + "px");
      ghosts.a.style.setProperty("--gsk", (-6 * dir) + "deg");
      ghosts.b.classList.remove("is-show");
      ghosts.a.classList.remove("is-show");
      void ghosts.b.offsetWidth;
      ghosts.b.classList.add("is-show");
      ghosts.a.classList.add("is-show");
      clearTimeout(col._ghostHideT);
      col._ghostHideT = setTimeout(function () {
        if (ghosts.b) ghosts.b.classList.remove("is-show");
        if (ghosts.a) ghosts.a.classList.remove("is-show");
      }, spdMs(540));
    }

    if (typeof defEl.animate === "function") {
      try {
        defEl.getAnimations().forEach(function (a) { a.cancel(); });
        defEl.animate([
          { transform: "translate3d(0,0,0) skewX(0deg) scale(1)", offset: 0 },
          { transform: "translate3d(" + Math.round(sideDist * 0.35) + "px,-2px,0) skewX(" + (-12 * dir) + "deg) scale(0.88,1.08)", offset: 0.15 },
          { transform: "translate3d(" + sideDist + "px,-8px,0) skewX(" + (-8 * dir) + "deg) scale(0.98)", offset: 0.32, easing: "cubic-bezier(0.16,1,0.3,1)" },
          { transform: "translate3d(" + Math.round(sideDist * 0.65) + "px,-3px,0) skewX(" + (-3 * dir) + "deg) scale(1)", offset: 0.70 },
          { transform: "translate3d(0,0,0) skewX(0deg) scale(1)", offset: 1 }
        ], { duration: spdMs(520), easing: "ease-out" });
      } catch (e) {}
    }
  }
  window.playMatrixDodgeFx = playMatrixDodgeFx;

  /* Unused heavy/legacy cut-in/AOE particle effects remain no-op */
  function noop() {}
  window.sheetFx = function () { return { el: null, stop: noop }; };
  window.strikeFx = noop;
  window.playPassiveCutIn = noop;
  window.playOverdriveAoeFx = noop;
  window.playRebirthAscensionVfx = noop;
})();
