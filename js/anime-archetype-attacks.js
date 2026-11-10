/* ==========================================================================
   BATTLE HAZARD — BASIC ATTACK & DEPLOY CANVAS ENGINE (EXACT PROTOTYPE PORT)
   100% ported from `_tmp/proto_battle_hazard_v1.html`:
   - Zero particles, zero radial speed-lines, zero afterimage ghosts.
   - Smooth 1x shared canvas (`#animeAtkCanvas`) drawing only:
     1) Motion streak line from attacker to target
     2) Two tapered diagonal slash arcs (`drawTaperedSlash`)
     3) Expanding impact shockwave ring (`fxImpactSlash`)
     4) Deploy ring on card tag-in (`fxDeployBurst`)
   ========================================================================== */

(function(){
  "use strict";

  var SFX = {
    ctx: null,
    getCtx: function(){
      if(window.state && window.state.muted) return null;
      if(!this.ctx){
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
      }
      if(this.ctx && this.ctx.state === "suspended"){
        this.ctx.resume().catch(function(){});
      }
      return this.ctx;
    },
    slash: function(){
      var c = this.getCtx(); if(!c) return;
      var t = c.currentTime;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(780, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.21);
    },
    unlock: function(){
      var c = this.getCtx();
      if(c && c.state === "suspended") c.resume().catch(function(){});
    }
  };

  (window.__aabAudioUnlockers = window.__aabAudioUnlockers || []).push(function(){ SFX.unlock(); });

  var sharedCv = null, sharedCtx = null, sharedRaf = 0, sharedFns = [];

  function ensureSharedCanvas(){
    var W = window.innerWidth, H = window.innerHeight;
    var dpr = (typeof window.FXDPR === "function") ? window.FXDPR() : 1;
    if(!sharedCv || !document.body.contains(sharedCv)){
      sharedCv = document.createElement("canvas");
      sharedCv.id = "animeAtkCanvas";
      sharedCv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:78;";
      document.body.appendChild(sharedCv);
      sharedCtx = sharedCv.getContext("2d");
    }
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    sharedCv.style.width = W + "px";
    sharedCv.style.height = H + "px";
    if(sharedCv.width !== pw || sharedCv.height !== ph){
      sharedCv.width = pw;
      sharedCv.height = ph;
    }
    sharedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cv: sharedCv, ctx: sharedCtx, W: W, H: H };
  }

  function registerFrame(fn){
    sharedFns.push(fn);
    if(!sharedRaf) sharedRaf = requestAnimationFrame(sharedTick);
  }

  function sharedTick(now){
    var s = ensureSharedCanvas(), ctx = s.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.cv.width, s.cv.height);
    var dpr = (typeof window.FXDPR === "function") ? window.FXDPR() : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for(var i = sharedFns.length - 1; i >= 0; i--){
      ctx.save();
      var keep = sharedFns[i](now);
      ctx.restore();
      if(keep === false) sharedFns.splice(i, 1);
    }
    if(sharedFns.length) sharedRaf = requestAnimationFrame(sharedTick);
    else sharedRaf = 0;
  }

  function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function spdMs(ms){
    return (typeof window.bsMs === "function") ? Math.max(80, window.bsMs(ms)) : ms;
  }

  function drawTaperedSlash(cx, x, y, angle, length, thickness, alpha, rgb){
    cx.save();
    cx.translate(x, y);
    cx.rotate(angle);
    cx.lineCap = "round";
    var g = cx.createLinearGradient(-length / 2, 0, length / 2, 0);
    g.addColorStop(0, "rgba(" + rgb + ",0)");
    g.addColorStop(0.28, "rgba(" + rgb + "," + (0.65 * alpha) + ")");
    g.addColorStop(0.5, "rgba(255,255,255," + (0.98 * alpha) + ")");
    g.addColorStop(0.72, "rgba(" + rgb + "," + (0.65 * alpha) + ")");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    cx.strokeStyle = g;
    cx.lineWidth = thickness;
    cx.beginPath();
    cx.moveTo(-length / 2, 0);
    cx.quadraticCurveTo(0, -thickness * 1.15, length / 2, 0);
    cx.stroke();

    cx.strokeStyle = "rgba(255,255,255," + (0.9 * alpha) + ")";
    cx.lineWidth = Math.max(1.5, thickness * 0.24);
    cx.beginPath();
    cx.moveTo(-length * 0.42, 0);
    cx.quadraticCurveTo(0, -thickness * 1.15, length * 0.42, 0);
    cx.stroke();
    cx.restore();
  }

  /* Exact Prototype `fxImpactSlash(fromRect, toRect, isPlayer)` */
  function fxImpactSlash(fromRect, toRect, isPlayer){
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(480);
    var RGB = isPlayer ? "243,230,0" : "255,84,112";
    var fromCx = fromRect.cx != null ? fromRect.cx : (fromRect.left + fromRect.width / 2);
    var fromCy = fromRect.cy != null ? fromRect.cy : (fromRect.top + fromRect.height / 2);
    var toCx   = toRect.cx != null ? toRect.cx : (toRect.left + toRect.width / 2);
    var toCy   = toRect.cy != null ? toRect.cy : (toRect.top + toRect.height / 2);
    var toW    = toRect.w != null ? toRect.w : toRect.width;
    var baseAng = Math.atan2(toCy - fromCy, toCx - fromCx);
    SFX.slash();

    registerFrame(function(now){
      var elapsed = now - t0;
      if(elapsed > dur) return false;
      var p = elapsed / dur;
      var e = easeOutCubic(p);
      var fade = 1 - p;

      cx.save();
      cx.globalCompositeOperation = "lighter";

      if(p < 0.48){
        var mp = p / 0.48;
        var sx = fromCx + (toCx - fromCx) * 0.25;
        var sy = fromCy + (toCy - fromCy) * 0.25;
        var lg = cx.createLinearGradient(sx, sy, toCx, toCy);
        lg.addColorStop(0, "rgba(" + RGB + ",0)");
        lg.addColorStop(0.7, "rgba(" + RGB + "," + (0.45 * (1 - mp)) + ")");
        lg.addColorStop(1, "rgba(255,255,255," + (0.75 * (1 - mp)) + ")");
        cx.strokeStyle = lg;
        cx.lineWidth = 10 * (1 - mp);
        cx.beginPath();
        cx.moveTo(sx, sy);
        cx.lineTo(toCx, toCy);
        cx.stroke();
      }

      var s1 = clamp01(p / 0.68);
      if(s1 > 0 && s1 < 1){
        drawTaperedSlash(
          cx, toCx, toCy,
          baseAng - 0.55,
          toW * (1.35 + 0.35 * easeOutCubic(s1)),
          18 * (1 - s1 * 0.65),
          1 - s1,
          RGB
        );
      }

      var s2 = clamp01((p - 0.16) / 0.72);
      if(s2 > 0 && s2 < 1){
        drawTaperedSlash(
          cx, toCx, toCy,
          baseAng + 0.62,
          toW * (1.28 + 0.35 * easeOutCubic(s2)),
          15 * (1 - s2 * 0.65),
          1 - s2,
          RGB
        );
      }

      var rRad = toW * (0.18 + 0.78 * e);
      cx.strokeStyle = "rgba(" + RGB + "," + (0.38 * fade) + ")";
      cx.lineWidth = 9 * fade;
      cx.beginPath();
      cx.arc(toCx, toCy, rRad, 0, Math.PI * 2);
      cx.stroke();

      cx.strokeStyle = "rgba(255,255,255," + (0.75 * fade) + ")";
      cx.lineWidth = 2 * fade;
      cx.beginPath();
      cx.arc(toCx, toCy, rRad * 0.92, 0, Math.PI * 2);
      cx.stroke();

      cx.restore();
      return true;
    });
  }

  /* Exact Prototype `fxDeployBurst(rect, isPlayer)` */
  function fxDeployBurst(rect, isPlayer){
    if(!rect) return;
    var s = ensureSharedCanvas(), cx = s.ctx;
    var t0 = performance.now();
    var dur = spdMs(360);
    var RGB = isPlayer ? "243,230,0" : "255,84,112";
    var rCx = rect.cx != null ? rect.cx : (rect.left + rect.width / 2);
    var rCy = rect.cy != null ? rect.cy : (rect.top + rect.height / 2);
    var rW  = rect.w != null ? rect.w : rect.width;

    registerFrame(function(now){
      var elapsed = now - t0;
      if(elapsed > dur) return false;
      var p = elapsed / dur;
      var fade = 1 - p;
      var r = rW * (0.3 + 0.75 * easeOutCubic(p));
      cx.save();
      cx.globalCompositeOperation = "lighter";
      cx.strokeStyle = "rgba(" + RGB + "," + (0.55 * fade) + ")";
      cx.lineWidth = 6 * fade;
      cx.beginPath();
      cx.arc(rCx, rCy, r, 0, Math.PI * 2);
      cx.stroke();
      cx.restore();
      return true;
    });
  }

  window.fxImpactSlash = fxImpactSlash;
  window.fxDeployBurst = fxDeployBurst;
  window.registerFrame = registerFrame;

  /* Compatibility wrapper if called directly */
  window.playAnimeArchetypeAttack = function(charId, fromSel, toSel){
    var fromEl = (typeof fromSel === "string") ? document.querySelector(fromSel) : fromSel;
    var toEl   = (typeof toSel === "string") ? document.querySelector(toSel) : toSel;
    if(!fromEl || !toEl) return false;
    var fr = fromEl.getBoundingClientRect();
    var tr = toEl.getBoundingClientRect();
    if(!fr.width || !tr.width) return false;
    var isPlayer = String(fromSel || "").indexOf("foe") === -1;
    fxImpactSlash(fr, tr, isPlayer);
    return true;
  };
})();
