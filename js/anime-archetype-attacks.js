/* ==========================================================================
   ANIME CINEMATIC COMBAT ENGINE - BASIC ATTACK (PHANTOM COMBO)
   Satu animasi serangan dasar untuk SEMUA kartu, digambar di satu canvas
   bersama (#animeAtkCanvas) dengan glow compositing:
   glint -> dash afterimage -> 4 sapuan pedang -> cross finisher + ring.
   Animasi archetype lama (brawler/blade/lightning/fire/ice/energy) dihapus.
   ========================================================================== */

(function(){
  "use strict";

  // Audio Synthesizer untuk efek suara anime yang nendang
  var SFX = {
    ctx: null,
    getCtx: function(){
      if(!this.ctx){
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
      }
      if(this.ctx && this.ctx.state === "suspended"){
        this.ctx.resume().catch(function(){});
      }
      return this.ctx;
    },
    boom: function(){
      var c = this.getCtx(); if(!c) return;
      var t = c.currentTime;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.35);
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.4);
    },
    slash: function(){
      var c = this.getCtx(); if(!c) return;
      var t = c.currentTime;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(850, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.22);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.26);
    },
    thunder: function(){
      var c = this.getCtx(); if(!c) return;
      var t = c.currentTime;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.32);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.36);
    },
    ice: function(){
      var c = this.getCtx(); if(!c) return;
      var t = c.currentTime;
      for(var i=0; i<3; i++){
        var osc = c.createOscillator(), g = c.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1300 + i*350, t + i*0.03);
        osc.frequency.exponentialRampToValueAtTime(350, t + i*0.03 + 0.16);
        g.gain.setValueAtTime(0.2, t + i*0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + i*0.03 + 0.17);
        osc.connect(g); g.connect(c.destination);
        osc.start(t + i*0.03); osc.stop(t + i*0.03 + 0.18);
      }
    },
    unlock: function(){
      var c = this.getCtx();
      if(c && c.state === "suspended") c.resume().catch(function(){});
    }
  };

  (window.__aabAudioUnlockers = window.__aabAudioUnlockers || []).push(function(){ SFX.unlock(); });

  /* ===== SATU CANVAS BERSAMA UNTUK SEMUA SERANGAN =====
     Sebelumnya tiap serangan membuat canvas full-screen baru (alokasi tiap attack,
     dan canvas bisa menumpuk saat efek lain masih jalan). Sekarang satu canvas
     dipakai ulang: layar dibersihkan sekali per frame, lalu semua efek aktif
     digambar di atasnya lewat satu rAF loop. */
  var sharedCv = null, sharedCtx = null, sharedRaf = 0, sharedFns = [];

  function ensureSharedCanvas(){
    var W = window.innerWidth, H = window.innerHeight, dpr = FXDPR();
    if(!sharedCv){
      sharedCv = document.createElement("canvas");
      sharedCv.id = "animeAtkCanvas";
      sharedCv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:78;";
      document.body.appendChild(sharedCv);
      sharedCtx = sharedCv.getContext("2d");
    }
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    /* Kotak CSS = innerWidth x innerHeight px (bukan 100vw/100vh). Di PWA/HP,
       100vh != window.innerHeight (vh = viewport besar), bikin koordinat
       getBoundingClientRect melenceng ke bawah. Box px -> 1:1 dgn backing store + rect. */
    sharedCv.style.width = W + "px";
    sharedCv.style.height = H + "px";
    if(sharedCv.width !== pw || sharedCv.height !== ph){
      sharedCv.width = pw;
      sharedCv.height = ph;
    }
    sharedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cv: sharedCv, ctx: sharedCtx, W: W, H: H };
  }

  function getCanvas(){ return ensureSharedCanvas(); }

  function registerFrame(fn){
    sharedFns.push(fn);
    if(!sharedRaf) sharedRaf = requestAnimationFrame(sharedTick);
  }

  function sharedTick(now){
    var s = ensureSharedCanvas(), ctx = s.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.cv.width, s.cv.height);
    var dpr = FXDPR();
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

  // Flash & Impact Frame ala Anime Shonen - DINONAKTIFKAN (menghilangkan flash putih di basic attack)
  function triggerImpactFrame(ctx, W, H, progress){
    // Flash putih dihapus sesuai permintaan
    return;
  }

  // 1. 👊 BRAWLER ARCHETYPE (Gatling Mirage Barrage / Ora Ora Multi-Fist Impact Stream)
  /* ==========================================================================
     PHANTOM COMBO - BASIC ATTACK (satu animasi untuk SEMUA kartu)
     Ritme: glint -> dash afterimage -> 4 sapuan -> cross finisher + ring.
     Menggambar di #animeAtkCanvas bersama (registerFrame), resolusi 1x.
     ========================================================================== */
  function fxPhantomCombo(fr, tr, accent){
    var c = getCanvas();
    var ctx = c.ctx, t0 = performance.now(), DUR = 900;
    var COL = accent || "243,230,0";
    var meCx = fr.left + fr.width/2, meCy = fr.top + fr.height*0.46;
    var foCx = tr.left + tr.width/2, foCy = tr.top + tr.height*0.46;
    var meW = fr.width, meH = fr.height, foW = tr.width;
    SFX.slash();

    function eOut(p){ return 1 - Math.pow(1 - p, 3); }
    function cl(p){ return p < 0 ? 0 : p > 1 ? 1 : p; }

    /* afterimage kartu (bayangan gerak) */
    function ghost(offX, offY, skew, alpha){
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(meCx + offX, meCy + offY);
      ctx.transform(1, 0, skew, 1, 0, 0);
      var g = ctx.createLinearGradient(-meW/2, 0, meW/2, 0);
      g.addColorStop(0, "rgba(" + COL + ",0)");
      g.addColorStop(0.5, "rgba(" + COL + ",0.55)");
      g.addColorStop(1, "rgba(" + COL + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(-meW/2, -meH/2, meW, meH);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-meW/2, -meH/2, meW, meH);
      ctx.restore();
    }

    /* satu sapuan pedang */
    function slashArc(x, y, ang, len, thick, alpha){
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.lineCap = "round";
      var g = ctx.createLinearGradient(-len/2, 0, len/2, 0);
      g.addColorStop(0, "rgba(" + COL + ",0)");
      g.addColorStop(0.35, "rgba(" + COL + "," + (0.35*alpha) + ")");
      g.addColorStop(0.78, "rgba(255,255,255," + (0.9*alpha) + ")");
      g.addColorStop(1, "rgba(" + COL + ",0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(-len/2, 0);
      ctx.quadraticCurveTo(0, -thick*1.6, len/2, 0);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255," + (0.85*alpha) + ")";
      ctx.lineWidth = Math.max(1, thick*0.2);
      ctx.beginPath();
      ctx.moveTo(-len/2, 0);
      ctx.quadraticCurveTo(0, -thick*1.6, len/2, 0);
      ctx.stroke();
      ctx.restore();
    }

    var arcs = [
      { at: 190, ang: -0.62, len: 1.00 },
      { at: 300, ang:  0.34, len: 1.06 },
      { at: 400, ang: -0.22, len: 0.92 },
      { at: 500, ang:  0.58, len: 1.02 }
    ];
    var sparks = [];
    for(var i=0; i<18; i++){
      var a = Math.random()*Math.PI*2;
      sparks.push({
        vx: Math.cos(a), vy: Math.sin(a)*0.85,
        dist: 18 + Math.random()*78,
        size: 1.6 + Math.random()*1.8,
        born: 190 + Math.random()*340,
        life: 280 + Math.random()*340
      });
    }

    function frame(now){
      var t = now - t0;
      if(t > DUR) return false;
      var p = t / DUR;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      /* glint tipis di target sebelum sabetan */
      if(t < 190){
        var gp = t/190;
        ctx.strokeStyle = "rgba(255,255,255," + (0.55*gp) + ")";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(foCx - foW*0.55, foCy);
        ctx.lineTo(foCx - foW*0.55 + foW*1.1*gp, foCy);
        ctx.stroke();
      }

      /* dash afterimage */
      if(t > 120 && t < 460){
        var dp = cl((t-120)/220);
        for(var g2=1; g2<=3; g2++){
          var f = cl(dp - g2*0.14);
          var gx = (foCx - meCx) * 0.42 * eOut(f);
          ghost(gx - g2*16, -g2*4, -0.16, 0.30*(1 - g2/4)*(1 - dp*0.5));
        }
      }

      /* 4 sapuan */
      for(var k=0; k<arcs.length; k++){
        var ar = arcs[k];
        var ap = cl((t - ar.at)/210);
        if(ap <= 0 || ap >= 1) continue;
        var e = eOut(ap);
        slashArc(foCx + (1-e)*foW*0.35, foCy, ar.ang,
          foW*1.5*ar.len, 16*(1 - ap*0.6), 1 - ap);
      }

      /* cross finisher + ring */
      if(t > 560 && t < 830){
        var cp = (t-560)/270, ca = 1 - cp;
        slashArc(foCx, foCy, -0.72, foW*2.5, 22*(1 - cp*0.7), ca);
        slashArc(foCx, foCy,  0.72, foW*2.5, 22*(1 - cp*0.7), ca);
        var rr = foW*(0.22 + cp*0.9);
        ctx.strokeStyle = "rgba(255,255,255," + (0.6*ca) + ")";
        ctx.lineWidth = 2.6*ca;
        ctx.beginPath(); ctx.arc(foCx, foCy, rr, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = "rgba(" + COL + "," + (0.45*ca) + ")";
        ctx.lineWidth = 8*ca;
        ctx.beginPath(); ctx.arc(foCx, foCy, rr*1.16, 0, Math.PI*2); ctx.stroke();
      }

      /* speed lines radial tipis */
      var sa = 0.30 * (1 - Math.abs(p*2 - 1));
      if(sa > 0.005){
        var cxp = c.W/2, cyp = c.H*0.46;
        var maxR = Math.sqrt(c.W*c.W + c.H*c.H) * 0.62;
        ctx.strokeStyle = "rgba(" + COL + "," + sa + ")";
        for(var sl=0; sl<26; sl++){
          var ang = (sl/26)*Math.PI*2 + Math.sin(t/900 + sl)*0.05;
          var r0 = maxR*(0.18 + 0.16*((sl*37 % 100)/100));
          var r1 = maxR*(0.85 + 0.15*((sl*53 % 100)/100));
          ctx.lineWidth = 1 + ((sl*17) % 3);
          ctx.beginPath();
          ctx.moveTo(cxp + Math.cos(ang)*r0, cyp + Math.sin(ang)*r0*0.72);
          ctx.lineTo(cxp + Math.cos(ang)*r1, cyp + Math.sin(ang)*r1*0.72);
          ctx.stroke();
        }
      }

      /* percikan */
      for(var sp=0; sp<sparks.length; sp++){
        var s2 = sparks[sp];
        var age = (t - s2.born) / s2.life;
        if(age < 0 || age > 1) continue;
        var d = age * s2.dist;
        ctx.fillStyle = "rgba(" + (age > 0.65 ? "255,255,255" : COL) + "," + (1-age) + ")";
        ctx.fillRect(foCx + s2.vx*d - s2.size*0.5, foCy + s2.vy*d - s2.size*0.5, s2.size, s2.size);
      }

      ctx.restore();
      return true;
    }
    registerFrame(frame);
  }

    // DISPATCHER UTAMA: Menentukan 1 dari 6 Archetype Otomatis Berdasarkan Karakter
  window.playAnimeArchetypeAttack = function(charId, fromSel, toSel){
    var fromEl = document.querySelector(fromSel);
    var toEl = document.querySelector(toSel);
    if(!fromEl || !toEl) return false;
    var fr = fromEl.getBoundingClientRect();
    var tr = toEl.getBoundingClientRect();
    if(!fr.width || !tr.width) return false;
    /* BASIC ATTACK tunggal untuk semua kartu (archetype lama tidak dipakai lagi) */
    fxPhantomCombo(fr, tr, "243,230,0");
    return true;
  };

window.registerFrame = registerFrame;
})();
