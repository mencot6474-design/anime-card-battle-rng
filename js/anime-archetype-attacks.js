/* ==========================================================================
   BATTLE HAZARD — ANIME ZERO-PARTICLE VECTOR CANVAS ENGINE
   Ported from `_tmp/proto_battle_anim_studio.html` (v2):
   - Zero particles, zero shadowBlur, single 1x DPR canvas (`#animeAtkCanvas`).
   - Provides:
     1) `fxAnimeSlash(fromRect, toRect, isPlayer, angOffset, scaleMult)`
     2) `fxBurnInferno(toRect, isTick)`
     3) `fxFreezeSpears(toRect, isShatter)`
     4) `fxThunderJudgment(toRect)`
     5) `fxDodgeShunpo(fromRect, toRect, sideDist, isPlayerAtk)`
     6) `fxDeployBurst(rect, isPlayer)`
   ========================================================================== */
(function () {
  "use strict";

  var SFX = {
    ctx: null,
    getCtx: function () {
      if (window.state && window.state.muted) return null;
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(function () {});
      }
      return this.ctx;
    },
    slash: function (pitch) {
      var c = this.getCtx(); if (!c) return;
      var p = pitch || 1;
      var t = c.currentTime;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1100 * p, t);
      osc.frequency.exponentialRampToValueAtTime(190, t + 0.13);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.15);
    },
    unlock: function () {
      var c = this.getCtx();
      if (c && c.state === "suspended") c.resume().catch(function () {});
    }
  };

  (window.__aabAudioUnlockers = window.__aabAudioUnlockers || []).push(function () { SFX.unlock(); });

  var sharedCv = null, sharedCtx = null, sharedRaf = 0, sharedFns = [];
  var _vpW = window.innerWidth || 1024, _vpH = window.innerHeight || 768;
  window.addEventListener("resize", function () {
    _vpW = window.innerWidth || _vpW;
    _vpH = window.innerHeight || _vpH;
    if (sharedCv) sharedCv._sized = false;
  }, { passive: true });

  function ensureSharedCanvas() {
    var W = _vpW, H = _vpH;
    var dpr = (typeof window.FXDPR === "function") ? window.FXDPR() : 1;
    if (!sharedCv || !document.body.contains(sharedCv)) {
      sharedCv = document.createElement("canvas");
      sharedCv.id = "animeAtkCanvas";
      sharedCv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:78;";
      document.body.appendChild(sharedCv);
      sharedCtx = sharedCv.getContext("2d");
      sharedCv._sized = false;
    }
    var pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
    if (!sharedCv._sized || sharedCv.width !== pw || sharedCv.height !== ph) {
      sharedCv.width = pw;
      sharedCv.height = ph;
      sharedCv.style.width = W + "px";
      sharedCv.style.height = H + "px";
      sharedCv._sized = true;
    }
    sharedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cv: sharedCv, ctx: sharedCtx, W: W, H: H };
  }

  var _fastRaf = (typeof window.__rawRaf === "function") ? window.__rawRaf : window.requestAnimationFrame.bind(window);
  var sharedMicro = false;

  function drawSharedFrame(now) {
    var s = (sharedCv && sharedCtx && sharedCv._sized && sharedCv.isConnected) ? { cv: sharedCv, ctx: sharedCtx, W: _vpW, H: _vpH } : ensureSharedCanvas();
    var ctx = s.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.cv.width, s.cv.height);
    var dpr = (typeof window.FXDPR === "function") ? window.FXDPR() : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = sharedFns.length - 1; i >= 0; i--) {
      ctx.save();
      var keep = false;
      try { keep = sharedFns[i](now); } catch (e) { keep = false; }
      ctx.restore();
      if (keep === false) sharedFns.splice(i, 1);
    }
  }

  function registerFrame(fn) {
    ensureSharedCanvas();
    sharedFns.push(fn);
    if (!sharedMicro) {
      sharedMicro = true;
      var flush = function () {
        sharedMicro = false;
        if (!sharedFns.length) return;
        drawSharedFrame(performance.now());
        if (sharedFns.length && !sharedRaf) sharedRaf = _fastRaf(sharedTick);
      };
      if (typeof queueMicrotask === "function") queueMicrotask(flush);
      else Promise.resolve().then(flush);
    } else if (!sharedRaf) {
      sharedRaf = _fastRaf(sharedTick);
    }
  }

  function clearSharedCanvas() {
    sharedFns.length = 0;
    sharedMicro = false;
    if (sharedCv && sharedCtx) {
      sharedCtx.setTransform(1, 0, 0, 1, 0, 0);
      sharedCtx.clearRect(0, 0, sharedCv.width, sharedCv.height);
    }
  }

  function sharedTick(now) {
    sharedRaf = 0;
    if (!sharedFns.length) return;
    drawSharedFrame(now);
    if (sharedFns.length && !sharedRaf) sharedRaf = _fastRaf(sharedTick);
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function spdMs(ms) {
    return (typeof window.bsMs === "function") ? Math.max(150, window.bsMs(ms)) : ms;
  }

  function normRect(r) {
    if (!r) return null;
    var x = r.x != null ? r.x : (r.left || 0);
    var y = r.y != null ? r.y : (r.top || 0);
    var w = Math.max(10, r.w != null ? r.w : (r.width || 160));
    var h = Math.max(10, r.h != null ? r.h : (r.height || 230));
    var cx = r.cx != null ? r.cx : (x + w * 0.5);
    var cy = r.cy != null ? r.cy : (y + h * 0.5);
    return { x: x, y: y, w: w, h: h, cx: cx, cy: cy };
  }

  /* Filled razor-sharp anime crescent blade */
  function drawCrescentBlade(cx, x, y, angle, length, arch, thickness, alpha, rgb) {
    cx.save();
    cx.translate(x, y);
    cx.rotate(angle);
    var hw = length * 0.5;
    cx.beginPath();
    cx.moveTo(-hw, 0);
    cx.quadraticCurveTo(0, -arch - thickness, hw, 0);
    cx.quadraticCurveTo(0, -arch + thickness * 0.45, -hw, 0);
    cx.closePath();
    cx.fillStyle = "rgba(" + rgb + "," + (0.85 * alpha) + ")";
    cx.fill();
    cx.lineWidth = 1.5;
    cx.strokeStyle = "rgba(5,5,5," + (0.65 * alpha) + ")";
    cx.stroke();

    cx.beginPath();
    cx.moveTo(-hw * 0.86, 0);
    cx.quadraticCurveTo(0, -arch - thickness * 0.58, hw * 0.86, 0);
    cx.quadraticCurveTo(0, -arch - thickness * 0.05, -hw * 0.86, 0);
    cx.closePath();
    cx.fillStyle = "rgba(255,255,255," + (0.96 * alpha) + ")";
    cx.fill();
    cx.restore();
  }

  /* 4-point anime impact cross-star */
  function drawImpactStar(cx, x, y, size, rot, alpha, rgb) {
    cx.save();
    cx.translate(x, y);
    cx.rotate(rot);
    var inn = size * 0.16;
    cx.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = i * (Math.PI / 2);
      var aNext = a + Math.PI / 4;
      var len = (i % 2 === 0) ? size : size * 0.72;
      if (i === 0) cx.moveTo(Math.cos(a) * len, Math.sin(a) * len);
      else cx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      cx.lineTo(Math.cos(aNext) * inn, Math.sin(aNext) * inn);
    }
    cx.closePath();
    cx.fillStyle = "rgba(" + rgb + "," + (0.5 * alpha) + ")";
    cx.fill();
    cx.scale(0.68, 0.68);
    cx.fillStyle = "rgba(255,255,255," + (0.98 * alpha) + ")";
    cx.fill();
    cx.restore();
  }

  /* Tactical segmented shock ring */
  function drawSegmentedRing(cx, x, y, r, rot, width, alpha, rgb) {
    cx.save();
    cx.translate(x, y);
    cx.rotate(rot);
    cx.strokeStyle = "rgba(" + rgb + "," + (0.72 * alpha) + ")";
    cx.lineWidth = Math.max(1, width);
    for (var k = 0; k < 4; k++) {
      var a0 = k * (Math.PI / 2) + 0.16;
      cx.beginPath();
      cx.arc(0, 0, Math.max(1, r), a0, a0 + Math.PI / 2 - 0.34);
      cx.stroke();
    }
    cx.strokeStyle = "rgba(255,255,255," + (0.85 * alpha) + ")";
    cx.lineWidth = Math.max(1, width * 0.3);
    cx.beginPath();
    cx.arc(0, 0, Math.max(1, r * 0.86), 0, Math.PI * 2);
    cx.stroke();
    cx.restore();
  }

  /* 1. ANIME CRESCENT SLASH + KINETIC RIBBON + IMPACT STAR */
  function fxAnimeSlash(fromRect, toRect, isPlayer, angOffset, scaleMult) {
    var fr = normRect(fromRect), tr = normRect(toRect);
    if (!fr || !tr) return;
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(420);
    var rgb = isPlayer ? "243,230,0" : "255,84,112";
    var sm = scaleMult || 1;
    var baseAng = Math.atan2(tr.cy - fr.cy, tr.cx - fr.cx) + (angOffset || 0);

    registerFrame(function (now) {
      var elapsed = Math.max(0, (typeof now === "number" ? now : performance.now()) - t0);
      var p = elapsed / dur;
      if (p >= 1) return false;
      var e = easeOutExpo(p), fade = 1 - p;
      cx.globalCompositeOperation = "lighter";

      if (p < 0.40) {
        var rp = 1 - p / 0.40;
        var dx = tr.cx - fr.cx, dy = tr.cy - fr.cy;
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var w = tr.w * 0.12 * rp;
        cx.beginPath();
        cx.moveTo(fr.cx, fr.cy);
        cx.lineTo(tr.cx + nx * w, tr.cy + ny * w);
        cx.lineTo(tr.cx - nx * w, tr.cy - ny * w);
        cx.closePath();
        var g = cx.createLinearGradient(fr.cx, fr.cy, tr.cx, tr.cy);
        g.addColorStop(0, "rgba(" + rgb + ",0)");
        g.addColorStop(0.65, "rgba(" + rgb + "," + (0.45 * rp) + ")");
        g.addColorStop(1, "rgba(255,255,255," + (0.9 * rp) + ")");
        cx.fillStyle = g;
        cx.fill();
      }

      var b1 = clamp01(p / 0.72);
      if (b1 > 0 && b1 < 1) {
        drawCrescentBlade(
          cx, tr.cx, tr.cy,
          baseAng - 0.62,
          tr.w * (1.45 + 0.55 * easeOutCubic(b1)) * sm,
          tr.w * 0.16 * sm,
          18 * (1 - b1 * 0.6) * sm,
          1 - b1, rgb
        );
      }

      if (p < 0.34) {
        var sp = 1 - p / 0.34;
        drawCrescentBlade(cx, tr.cx, tr.cy, baseAng + 0.58, tr.w * 2.2 * sm, 0, 5 * sp, sp, "255,255,255");
        drawImpactStar(cx, tr.cx, tr.cy, tr.w * (0.45 + 0.25 * p) * sm, baseAng, sp, rgb);
      }

      if (sm >= 1.1) {
        var b2 = clamp01((p - 0.12) / 0.72);
        if (b2 > 0 && b2 < 1) {
          drawCrescentBlade(
            cx, tr.cx, tr.cy,
            baseAng + 0.68,
            tr.w * (1.4 + 0.5 * easeOutCubic(b2)) * sm,
            -tr.w * 0.15 * sm,
            16 * (1 - b2 * 0.6) * sm,
            1 - b2, rgb
          );
        }
      }

      drawSegmentedRing(cx, tr.cx, tr.cy, tr.w * (0.24 + 0.88 * e) * sm, p * 1.4, 7 * fade, fade, rgb);
      return true;
    });
  }

  /* 2. BURN: INFERNO FLAME PILLAR + CRESCENT WAVES */
  function fxBurnInferno(toRect, isTick) {
    var tr = normRect(toRect);
    if (!tr) return;
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(isTick ? 420 : 500);

    registerFrame(function (now) {
      var elapsed = Math.max(0, (typeof now === "number" ? now : performance.now()) - t0);
      var p = elapsed / dur;
      if (p >= 1) return false;
      var e = easeOutExpo(p), fade = 1 - p;
      cx.globalCompositeOperation = "lighter";

      var rise = tr.h * (0.2 + 0.95 * e);
      var baseY = tr.y + tr.h * 0.96;
      var w = tr.w * (isTick ? 0.52 : 0.62);
      cx.save();
      cx.beginPath();
      cx.moveTo(tr.cx - w, baseY);
      cx.quadraticCurveTo(tr.cx - w * 1.1, baseY - rise * 0.5, tr.cx - w * 0.45, baseY - rise * 0.82);
      cx.lineTo(tr.cx - w * 0.18, baseY - rise * 0.56);
      cx.lineTo(tr.cx, baseY - rise * 1.08);
      cx.lineTo(tr.cx + w * 0.22, baseY - rise * 0.60);
      cx.lineTo(tr.cx + w * 0.52, baseY - rise * 0.84);
      cx.quadraticCurveTo(tr.cx + w * 1.1, baseY - rise * 0.48, tr.cx + w, baseY);
      cx.closePath();
      var fg = cx.createLinearGradient(0, baseY, 0, baseY - rise);
      fg.addColorStop(0, "rgba(255,77,26," + (0.78 * fade) + ")");
      fg.addColorStop(0.55, "rgba(255,155,38," + (0.62 * fade) + ")");
      fg.addColorStop(1, "rgba(255,243,176,0)");
      cx.fillStyle = fg;
      cx.fill();
      cx.restore();

      if (!isTick) {
        drawCrescentBlade(cx, tr.cx, tr.cy - tr.h * 0.05, -0.52, tr.w * (1.35 + 0.45 * e), tr.w * 0.22, 18 * fade, fade, "255,90,31");
        drawCrescentBlade(cx, tr.cx, tr.cy + tr.h * 0.08, 0.44, tr.w * (1.28 + 0.4 * e), -tr.w * 0.18, 14 * fade, fade, "255,209,102");
      }

      drawSegmentedRing(cx, tr.cx, tr.cy, tr.w * (0.28 + 0.72 * e), -p * 1.8, 7 * fade, fade, "255,90,31");
      return true;
    });
  }

  /* 3. FREEZE: 4 GLACIAL SPEARS CLAMP + HEX SEAL + SHATTER */
  function drawIceSpear(cx, x, y, ang, len, wid, alpha) {
    cx.save();
    cx.translate(x, y);
    cx.rotate(ang);
    cx.beginPath();
    cx.moveTo(-len * 0.5, 0);
    cx.lineTo(0, -wid * 0.5);
    cx.lineTo(len * 0.5, 0);
    cx.closePath();
    cx.fillStyle = "rgba(230,252,255," + (0.94 * alpha) + ")";
    cx.fill();

    cx.beginPath();
    cx.moveTo(-len * 0.5, 0);
    cx.lineTo(len * 0.5, 0);
    cx.lineTo(0, wid * 0.5);
    cx.closePath();
    cx.fillStyle = "rgba(56,189,248," + (0.85 * alpha) + ")";
    cx.fill();

    cx.strokeStyle = "rgba(255,255,255," + (0.9 * alpha) + ")";
    cx.lineWidth = 1.2;
    cx.beginPath();
    cx.moveTo(-len * 0.5, 0); cx.lineTo(0, -wid * 0.5); cx.lineTo(len * 0.5, 0); cx.lineTo(0, wid * 0.5); cx.closePath();
    cx.stroke();
    cx.restore();
  }

  function fxFreezeSpears(toRect, isShatter) {
    var tr = normRect(toRect);
    if (!tr) return;
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(isShatter ? 420 : 480);

    registerFrame(function (now) {
      var elapsed = Math.max(0, (typeof now === "number" ? now : performance.now()) - t0);
      var p = elapsed / dur;
      if (p >= 1) return false;
      var e = easeOutExpo(p), fade = 1 - p;
      cx.globalCompositeOperation = "lighter";

      var count = isShatter ? 6 : 4;
      for (var i = 0; i < count; i++) {
        var ang = (isShatter ? 0.25 : Math.PI / 4) + i * ((Math.PI * 2) / count);
        var dist = isShatter
          ? tr.w * (0.18 + 0.92 * e)
          : tr.w * (1.25 - 0.72 * e);
        var sx = tr.cx + Math.cos(ang) * dist;
        var sy = tr.cy + Math.sin(ang) * dist;
        var spearAng = isShatter ? ang : (ang + Math.PI);
        drawIceSpear(cx, sx, sy, spearAng, tr.w * (isShatter ? 0.52 : 0.62), tr.w * 0.16, fade);
      }

      var hexR = isShatter ? tr.w * (0.35 + 0.85 * e) : tr.w * (1.12 - 0.44 * e);
      cx.save();
      cx.translate(tr.cx, tr.cy);
      cx.rotate(isShatter ? e * 0.5 : (1 - e) * 0.7);
      cx.strokeStyle = "rgba(125,249,255," + (0.9 * fade) + ")";
      cx.lineWidth = Math.max(1.4, 5 * fade);
      cx.beginPath();
      for (var k = 0; k < 6; k++) {
        var ha = (k / 6) * Math.PI * 2;
        if (k === 0) cx.moveTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
        else cx.lineTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
      }
      cx.closePath();
      cx.stroke();
      cx.restore();

      if (p < 0.35) drawImpactStar(cx, tr.cx, tr.cy, tr.w * 0.52, 0.2, 1 - p / 0.35, "125,249,255");
      return true;
    });
  }

  /* 4. SHOCK: VERTICAL THUNDER PILLAR + BRANCHED POLYLINES */
  function buildBolt(x1, y1, x2, y2, segs, seed, spread) {
    var pts = [{ x: x1, y: y1 }];
    for (var i = 1; i < segs; i++) {
      var t = i / segs;
      var s = Math.sin(seed * 21.7 + i * 11.3);
      var off = (i % 2 === 0 ? 1 : -1) * (spread * 0.45 + Math.abs(s) * spread * 0.65);
      pts.push({ x: x1 + (x2 - x1) * t + off, y: y1 + (y2 - y1) * t + s * 6 });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  function fxThunderJudgment(toRect) {
    var tr = normRect(toRect);
    if (!tr) return;
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(460);
    var fIdx = -1, mainBolt = null, brL = null, brR = null;

    registerFrame(function (now) {
      var elapsed = Math.max(0, (typeof now === "number" ? now : performance.now()) - t0);
      var p = elapsed / dur;
      if (p >= 1) return false;
      var e = easeOutExpo(p), fade = 1 - p;

      var f = Math.max(0, Math.min(3, Math.floor(p * 5)));
      if (!mainBolt || f !== fIdx) {
        fIdx = f;
        mainBolt = buildBolt(tr.cx + (f % 2 ? -10 : 10), 0, tr.cx, tr.cy + tr.h * 0.16, 8, f + 1, 28);
        brL = buildBolt(tr.cx, tr.cy - tr.h * 0.25, tr.x - 16, tr.cy + tr.h * 0.35, 5, f + 7, 16);
        brR = buildBolt(tr.cx, tr.cy - tr.h * 0.15, tr.x + tr.w + 16, tr.cy + tr.h * 0.30, 5, f + 13, 16);
      }

      cx.globalCompositeOperation = "lighter";
      cx.lineCap = "round";
      cx.lineJoin = "round";

      if (p < 0.32) {
        var colA = 1 - p / 0.32;
        var bw = Math.max(4, tr.w * 0.36 * colA);
        var bg = cx.createLinearGradient(tr.cx - bw, 0, tr.cx + bw, 0);
        bg.addColorStop(0, "rgba(125,249,255,0)");
        bg.addColorStop(0.5, "rgba(125,249,255," + (0.42 * colA) + ")");
        bg.addColorStop(1, "rgba(125,249,255,0)");
        cx.fillStyle = bg;
        cx.fillRect(tr.cx - bw, 0, bw * 2, tr.cy + tr.h * 0.25);
      }

      if (p < 0.78) {
        var ba = 1 - p / 0.78;
        [
          { pts: mainBolt, w: 12, col: "243,230,0" },
          { pts: brL, w: 7, col: "125,249,255" },
          { pts: brR, w: 7, col: "125,249,255" }
        ].forEach(function (b) {
          cx.strokeStyle = "rgba(" + b.col + "," + (0.82 * ba) + ")";
          cx.lineWidth = b.w;
          cx.beginPath();
          b.pts.forEach(function (pt, idx) { if (idx === 0) cx.moveTo(pt.x, pt.y); else cx.lineTo(pt.x, pt.y); });
          cx.stroke();

          cx.strokeStyle = "rgba(255,255,255," + (0.98 * ba) + ")";
          cx.lineWidth = Math.max(1.8, b.w * 0.26);
          cx.beginPath();
          b.pts.forEach(function (pt, idx) { if (idx === 0) cx.moveTo(pt.x, pt.y); else cx.lineTo(pt.x, pt.y); });
          cx.stroke();
        });
      }

      if (p < 0.35) drawImpactStar(cx, tr.cx, tr.cy, tr.w * 0.56, p * 2, 1 - p / 0.35, "243,230,0");
      drawSegmentedRing(cx, tr.cx, tr.cy, tr.w * (0.22 + 0.92 * e), p * 2.5, 8 * fade, fade, "243,230,0");
      drawSegmentedRing(cx, tr.cx, tr.cy, tr.w * (0.14 + 0.65 * e), -p * 2.0, 4 * fade, fade, "125,249,255");
      return true;
    });
  }

  /* 5. DODGE: SHUNPO MOTION RIBBON + WHIFF CRESCENT + GLINT STAR */
  function fxDodgeShunpo(fromRect, toRect, sideDist, isPlayerAtk) {
    var fr = normRect(fromRect), tr = normRect(toRect);
    if (!tr) return;
    if (!fr) fr = { x: tr.x - 160, y: tr.y + 80, w: tr.w, h: tr.h, cx: tr.cx - 160, cy: tr.cy + 80 };
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(440);
    var rgbAtk = isPlayerAtk ? "243,230,0" : "255,84,112";

    registerFrame(function (now) {
      var elapsed = Math.max(0, (typeof now === "number" ? now : performance.now()) - t0);
      var p = elapsed / dur;
      if (p >= 1) return false;
      var e = easeOutExpo(p), fade = 1 - p;
      cx.globalCompositeOperation = "lighter";

      [-0.22, 0.0, 0.22].forEach(function (yo, idx) {
        var y = tr.cy + tr.h * yo;
        var x1 = tr.cx;
        var x2 = tr.cx + sideDist * (0.85 + 0.35 * e);
        var lg = cx.createLinearGradient(x1, y, x2, y);
        lg.addColorStop(0, "rgba(125,249,255,0)");
        lg.addColorStop(0.45, "rgba(125,249,255," + (0.8 * fade) + ")");
        lg.addColorStop(1, "rgba(255,255,255," + (0.95 * fade) + ")");
        cx.strokeStyle = lg;
        cx.lineWidth = (idx === 1 ? 6 : 3) * fade;
        cx.beginPath(); cx.moveTo(x1, y); cx.lineTo(x2, y); cx.stroke();
      });

      var sw = clamp01((p - 0.14) / 0.68);
      if (sw > 0 && sw < 1) {
        var ang = Math.atan2(tr.cy - fr.cy, tr.cx - fr.cx) - 0.45;
        drawCrescentBlade(cx, tr.cx, tr.cy, ang, tr.w * (1.25 + 0.3 * sw), tr.w * 0.12, 11 * (1 - sw), 0.72 * (1 - sw), rgbAtk);
      }

      if (p > 0.18 && p < 0.72) {
        var gp = 1 - Math.abs((p - 0.45) / 0.27);
        drawImpactStar(cx, tr.cx + sideDist, tr.cy - tr.h * 0.22, tr.w * 0.26 * gp, 0.2, gp, "125,249,255");
      }
      return true;
    });
  }

  /* Deploy ring on card tag-in */
  function fxDeployBurst(rect, isPlayer) {
    var rr = normRect(rect);
    if (!rr) return;
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(360);
    var rgb = isPlayer ? "243,230,0" : "255,84,112";

    registerFrame(function (now) {
      var elapsed = Math.max(0, (typeof now === "number" ? now : performance.now()) - t0);
      var p = elapsed / dur;
      if (p >= 1) return false;
      var fade = 1 - p;
      var r = Math.max(1, rr.w * (0.3 + 0.75 * easeOutCubic(p)));
      cx.globalCompositeOperation = "lighter";
      cx.strokeStyle = "rgba(" + rgb + "," + (0.55 * fade) + ")";
      cx.lineWidth = Math.max(0.5, 6 * fade);
      cx.beginPath();
      cx.arc(rr.cx, rr.cy, r, 0, Math.PI * 2);
      cx.stroke();
      return true;
    });
  }

  function fxImpactSlash(fromRect, toRect, isPlayer) {
    SFX.slash(1.0);
    fxAnimeSlash(fromRect, toRect, isPlayer, 0, 1.15);
  }

  window.fxAnimeSlash = fxAnimeSlash;
  window.fxImpactSlash = fxImpactSlash;
  window.fxBurnInferno = fxBurnInferno;
  window.fxFreezeSpears = fxFreezeSpears;
  window.fxThunderJudgment = fxThunderJudgment;
  window.fxDodgeShunpo = fxDodgeShunpo;
  window.fxDeployBurst = fxDeployBurst;
  window.clearAnimeAtkCanvas = clearSharedCanvas;
  window.registerFrame = registerFrame;

  window.playAnimeArchetypeAttack = function (charId, fromSel, toSel) {
    var fromEl = (typeof fromSel === "string") ? document.querySelector(fromSel) : fromSel;
    var toEl = (typeof toSel === "string") ? document.querySelector(toSel) : toSel;
    if (!fromEl || !toEl) return false;
    var fromCard = fromEl.querySelector(".card-shell") || fromEl;
    var toCard = toEl.querySelector(".card-shell") || toEl;
    var fr = fromCard.getBoundingClientRect();
    var tr = toCard.getBoundingClientRect();
    if (!fr.width || !tr.width) return false;
    var isPlayer = String(fromSel || "").indexOf("foe") === -1;
    SFX.slash(1.1);
    fxAnimeSlash(fr, tr, isPlayer, (Math.random() - 0.5) * 0.7, 1.0);
    return true;
  };
})();
