/* ==========================================================================
   HIGH-OCTANE ANIME CINEMATIC COMBAT ENGINE (6 CORE ARCHETYPES)
   Efek serangan level AAA dengan Canvas 2D + Glow Compositing:
   Impact Frame Invert (1 frame hitam-putih), Screen Shake, Flash,
   Proyektil melesat cepat dan ledakan partikel pecah di kartu lawan!
   1. BRAWLER (Taijutsu/Heavy Punch)
   2. BLADE (Nichirin/Katana Sharp Wave)
   3. LIGHTNING (Thunder Zigzag Warp)
   4. FIRE (Katon/Inferno Blast)
   5. ICE (Cryo Glacier Freeze)
   6. ENERGY (Nen/Chakra/Magic Sphere)
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

  // Flash & Impact Frame ala Anime Shonen
  function triggerImpactFrame(ctx, W, H, progress){
    // Di tengah tumbukan: 1-2 frame flash monokrom
    if(progress > 0.46 && progress < 0.52){
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
    } else if(progress >= 0.52 && progress < 0.58){
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  // 1. 👊 BRAWLER ARCHETYPE (Gatling Mirage Barrage / Ora Ora Multi-Fist Impact Stream)
  function fxBrawler(x1, y1, x2, y2, colMain, colGlow){
    var c = getCanvas();
    var ctx = c.ctx, cv = c.cv, W = c.W, H = c.H, t0 = performance.now(), DUR = 560;
    colMain = colMain || "#ff5722";
    colGlow = colGlow || "#ff9800";
    SFX.boom();

    var dx = x2 - x1, dy = y2 - y1;
    var distTotal = Math.hypot(dx, dy);
    var baseAngle = Math.atan2(dy, dx);
    var perpX = -Math.sin(baseAngle);
    var perpY = Math.cos(baseAngle);

    // 8 Kepalan tinju bayangan bertubi-tubi (Gatling Multi-Fists Stream)
    var fists = [];
    for(var i=0; i<8; i++){
      fists.push({
        delay: i * 0.04, // Jeda milidetik per tinju
        sideOffset: (Math.random() - 0.5) * 45,
        yJitter: (Math.random() - 0.5) * 20,
        scale: 0.8 + Math.random() * 0.4
      });
    }

    // Rentetan cincin benturan hantaman (Multi-Impact Rings) di kartu target
    var hitImpacts = [];
    for(var k=0; k<6; k++){
      hitImpacts.push({
        pAt: 0.28 + k * 0.08,
        offsetX: (Math.random() - 0.5) * 45,
        offsetY: (Math.random() - 0.5) * 45,
        radius: 35 + Math.random() * 25
      });
    }

    // Debris percikan hantaman tinju bertubi-tubi
    var barrageSparks = [];
    for(var s=0; s<30; s++){
      var ang = Math.random() * Math.PI * 2;
      var spd = 160 + Math.random() * 260;
      barrageSparks.push({
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.4 ? "#ffffff" : (Math.random() > 0.5 ? "#facc15" : colMain)
      });
    }

    // Fungsi menggambar satu kepalan tinju energi melesat
    function drawEnergyFist(cx, cy, scale){
      var r = 18 * scale;
      var fGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.8);
      fGrad.addColorStop(0, "#ffffff");
      fGrad.addColorStop(0.35, colGlow);
      fGrad.addColorStop(0.85, colMain);
      fGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Inti tinju putih padat
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    function frame(now){
      var p = (now - t0) / DUR;
      if(p >= 1){ return false; }
      triggerImpactFrame(ctx, W, H, p);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // FASE 1: RENTETAN 8 KEPALAN TINJU BAYANGAN MELUNCUR BERTUBI-TUBI (0.0 -> 0.52)
      for(var i=0; i<fists.length; i++){
        var fst = fists[i];
        var fp = Math.max(0, p - fst.delay) / 0.35; // Waktu tempuh per tinju cepat (0.35s)
        if(fp > 0 && fp <= 1){
          var easeFp = fp < 0.5 ? 2 * fp * fp : -1 + (4 - 2 * fp) * fp;
          var curFx = x1 + dx * easeFp + perpX * fst.sideOffset;
          var curFy = y1 + dy * easeFp + perpY * fst.sideOffset + fst.yJitter;

          // Ekor garis kecepatan tinju
          var tLen = Math.min(distTotal * easeFp, 75);
          var tX = curFx - (dx / distTotal) * tLen;
          var tY = curFy - (dy / distTotal) * tLen;

          ctx.strokeStyle = colGlow;
          ctx.shadowColor = colMain; ctx.shadowBlur = 16;
          ctx.lineWidth = 5 * fst.scale;
          ctx.beginPath();
          ctx.moveTo(tX, tY);
          ctx.lineTo(curFx, curFy);
          ctx.stroke();

          // Render tinju bayangan
          drawEnergyFist(curFx, curFy, fst.scale);
        }
      }

      // FASE 2: RENTETAN DENTUMAN HANTAMAN TINJU DI TARGET MUSUH (0.28 -> 1.0)
      for(var h=0; h<hitImpacts.length; h++){
        var hit = hitImpacts[h];
        if(p > hit.pAt){
          var hp = (p - hit.pAt) / (1 - hit.pAt);
          var hFade = 1 - hp;
          var hx = x2 + hit.offsetX;
          var hy = y2 + hit.offsetY;

          // Cincin hantaman tinju bertubi-tubi
          ctx.strokeStyle = colMain;
          ctx.shadowColor = colGlow; ctx.shadowBlur = 24;
          ctx.lineWidth = 8 * hFade;
          ctx.beginPath();
          ctx.arc(hx, hy, hp * hit.radius * 2, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5 * hFade;
          ctx.beginPath();
          ctx.arc(hx, hy, hp * hit.radius * 2.3, 0, Math.PI * 2);
          ctx.stroke();

          // Kilatan bintang flash di titik hantaman
          var starR = 18 * Math.sin(hp * Math.PI);
          if(starR > 0){
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(hx, hy, starR, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Cincin shockwave gempa raksasa saat rentetan tinju tuntas
      if(p > 0.45){
        var bp = (p - 0.45) / 0.55;
        var bFade = 1 - bp;

        ctx.strokeStyle = colGlow;
        ctx.lineWidth = 12 * bFade;
        ctx.beginPath();
        ctx.ellipse(x2, y2, bp * 165, bp * 115, baseAngle, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3.5 * bFade;
        ctx.beginPath();
        ctx.ellipse(x2, y2, bp * 190, bp * 135, baseAngle, 0, Math.PI * 2);
        ctx.stroke();

        // Debris semburan percikan
        var timeSec = (p - 0.45) * (DUR / 1000);
        for(var s=0; s<barrageSparks.length; s++){
          var spk = barrageSparks[s];
          var sx = x2 + spk.vx * timeSec;
          var sy = y2 + spk.vy * timeSec;

          ctx.fillStyle = spk.color;
          ctx.beginPath();
          ctx.arc(sx, sy, spk.size * bFade, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
    registerFrame(frame);
  }

    // 2. ⚔️ BLADE ARCHETYPE (Grand Crescent Moon / Moon Breathing Gigantic Cleave + Orbital Eclipse Burst)
  function fxBlade(x1, y1, x2, y2, colMain, colGlow){
    var c = getCanvas();
    var ctx = c.ctx, cv = c.cv, W = c.W, H = c.H, t0 = performance.now(), DUR = 560;
    colMain = colMain || "#00f5d4";
    colGlow = colGlow || "#ffffff";
    SFX.slash();

    var dx = x2 - x1, dy = y2 - y1;
    var distTotal = Math.hypot(dx, dy);
    var baseAngle = Math.atan2(dy, dx);
    var perpX = -Math.sin(baseAngle);
    var perpY = Math.cos(baseAngle);

    // Bintang-bintang sabit mikro / serpihan debu bulan (Moon Dust Embers)
    var moonDust = [];
    for(var i=0; i<FXQ(36); i++){
      moonDust.push({
        pAt: 0.05 + Math.random() * 0.42,
        side: (Math.random() - 0.5) * 65,
        driftX: (Math.random() - 0.5) * 45,
        driftY: (Math.random() - 0.5) * 45,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.35 ? "#ffffff" : colMain
      });
    }

    // Debris potongan sabit bulan mini yang memancar saat menabrak target
    var crescentShards = [];
    for(var k=0; k<16; k++){
      var ang = Math.random() * Math.PI * 2;
      var spd = 160 + Math.random() * 260;
      crescentShards.push({
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 12 + Math.random() * 14,
        rot: ang,
        color: Math.random() > 0.4 ? "#ffffff" : colMain
      });
    }

    // Fungsi menggambar BUSUR BULAN SABIT RAKSASA (Grand Crescent Moon)
    function drawGrandCrescent(cx, cy, radius, thickness, angle){
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Bentuk Bulan Sabit Raksasa Sempurna (Crescent arc tip to tip)
      ctx.beginPath();
      // Busur luar (cembung tajam ke arah depan lawan)
      ctx.arc(0, 0, radius, -Math.PI * 0.42, Math.PI * 0.42, false);
      // Busur dalam (cekung memotong dari belakang)
      ctx.arc(-thickness * 0.6, 0, radius * 0.86, Math.PI * 0.42, -Math.PI * 0.42, true);
      ctx.closePath();

      // Gradien Cahaya Bulan Menyala Terang
      var grad = ctx.createLinearGradient(-thickness, 0, radius, 0);
      grad.addColorStop(0, "rgba(0, 245, 212, 0)");
      grad.addColorStop(0.3, colMain);
      grad.addColorStop(0.8, "#ffffff");
      grad.addColorStop(1, "#ffffff");

      ctx.fillStyle = grad;
      ctx.shadowColor = colMain;
      ctx.shadowBlur = 35;
      ctx.fill();

      // Tulang punggung sabit bulan putih super tajam
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI * 0.4, Math.PI * 0.4, false);
      ctx.stroke();

      // Garis sabit kedua yang lebih tipis di dalam (efek aura bulan berlapis)
      ctx.strokeStyle = colMain;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-thickness * 0.3, 0, radius * 0.92, -Math.PI * 0.36, Math.PI * 0.36, false);
      ctx.stroke();

      ctx.restore();
    }

    function frame(now){
      var p = (now - t0) / DUR;
      if(p >= 1){ return false; }
      triggerImpactFrame(ctx, W, H, p);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // FASE 1: BULAN SABIT RAKSASA MELUNCUR MENYEBERANG LAYAR (0.0 -> 0.42)
      var flightP = Math.min(1, p / 0.42);
      var easeFlight = flightP < 0.5 ? 2 * flightP * flightP : -1 + (4 - 2 * flightP) * flightP;
      var curX = x1 + dx * easeFlight;
      var curY = y1 + dy * easeFlight;

      if(flightP < 1){
        // Jejak cahaya bulan (moonlight trail) di belakang sabit besar
        var tLen = Math.min(distTotal * easeFlight, 110);
        var tX = curX - (dx / distTotal) * tLen;
        var tY = curY - (dy / distTotal) * tLen;

        ctx.strokeStyle = "rgba(0, 245, 212, 0.45)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(tX, tY);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Render BUSUR BULAN SABIT BESAR (Radius 62px -> rentang total tinggi ~124px!)
        drawGrandCrescent(curX, curY, 62, 28, baseAngle);
      }

      // Debu Partikel Cahaya Bulan (Moon Dust) di Jalur
      for(var s=0; s<moonDust.length; s++){
        var mst = moonDust[s];
        if(p > mst.pAt){
          var age = (p - mst.pAt) / (1 - mst.pAt);
          var sx = x1 + dx * (mst.pAt / 0.42) + perpX * mst.side + mst.driftX * age;
          var sy = y1 + dy * (mst.pAt / 0.42) + perpY * mst.side + mst.driftY * age;
          ctx.fillStyle = mst.color;
          ctx.beginPath();
          ctx.arc(sx, sy, mst.size * (1 - age), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // FASE 2: ORBITAL ECLIPSE BURST DI TARGET MUSUH (0.38 -> 1.0)
      if(p > 0.38){
        var bp = (p - 0.38) / 0.62;
        var fade = 1 - bp;

        // 1. Cincin Cahaya Gerhana Bulan (Orbital Eclipse Ring) Meledak
        ctx.shadowColor = colMain;
        ctx.shadowBlur = 32;

        ctx.strokeStyle = colMain;
        ctx.lineWidth = 14 * fade;
        ctx.beginPath();
        ctx.arc(x2, y2, bp * 155, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4 * fade;
        ctx.beginPath();
        ctx.arc(x2, y2, bp * 180, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Belahan Tebasan Bulan Melengkung Ganda di Kartu Target
        var cleaveLen = bp * 175;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 5 * fade;
        ctx.beginPath();
        ctx.moveTo(x2 + perpX * cleaveLen, y2 + perpY * cleaveLen);
        ctx.quadraticCurveTo(x2 + (dx/distTotal)*35, y2 + (dy/distTotal)*35, x2 - perpX * cleaveLen, y2 - perpY * cleaveLen);
        ctx.stroke();

        // 3. Debris pecahan sabit bulan mini (Moon Shards) memancar ke segala arah
        var timeSec = (p - 0.38) * (DUR / 1000);
        for(var d=0; d<crescentShards.length; d++){
          var csh = crescentShards[d];
          var cx = x2 + csh.vx * timeSec;
          var cy = y2 + csh.vy * timeSec;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(csh.rot + timeSec * 4);
          ctx.strokeStyle = csh.color;
          ctx.lineWidth = 2 * fade;
          // Busur sabit mini
          ctx.beginPath();
          ctx.arc(0, 0, csh.radius * fade, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();
    }
    registerFrame(frame);
  }

    // 3. ⚡ LIGHTNING ARCHETYPE (Thunder Flash / Godspeed Warp Lance + Forked Discharge + Plasma Cage)
  function fxLightning(x1, y1, x2, y2, colMain, colGlow){
    var c = getCanvas();
    var ctx = c.ctx, cv = c.cv, W = c.W, H = c.H, t0 = performance.now(), DUR = 480;
    colMain = colMain || "#facc15";
    colGlow = colGlow || "#eab308";
    SFX.thunder();

    var dx = x2 - x1, dy = y2 - y1;
    var distTotal = Math.hypot(dx, dy);
    var baseAngle = Math.atan2(dy, dx);
    var perpX = -Math.sin(baseAngle);
    var perpY = Math.cos(baseAngle);

    var numSegments = 9;
    var boltOffsetsA = [];
    var boltOffsetsB = [];
    for(var i=1; i<numSegments; i++){
      boltOffsetsA.push((Math.random() - 0.5) * 38);
      boltOffsetsB.push((Math.random() - 0.5) * 28);
    }

    var sparkEmbers = [];
    for(var s=0; s<24; s++){
      sparkEmbers.push({
        pAt: 0.05 + Math.random() * 0.35,
        side: (Math.random() - 0.5) * 45,
        driftX: (Math.random() - 0.5) * 40,
        driftY: (Math.random() - 0.5) * 40,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.3 ? "#ffffff" : "#facc15"
      });
    }

    var impactForks = [];
    for(var k=0; k<8; k++){
      var ang = (k / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      var segCount = 4;
      var points = [{ x: 0, y: 0 }];
      var curR = 0;
      for(var p=1; p<=segCount; p++){
        curR += (120 / segCount) + (Math.random() - 0.5) * 15;
        var pAng = ang + (Math.random() - 0.5) * 0.6;
        points.push({
          x: Math.cos(pAng) * curR,
          y: Math.sin(pAng) * curR
        });
      }
      impactForks.push(points);
    }

    function drawFork(points, originX, originY, width, alpha){
      ctx.beginPath();
      ctx.moveTo(originX + points[0].x, originY + points[0].y);
      for(var i=1; i<points.length; i++){
        var jx = (Math.random() - 0.5) * 6;
        var jy = (Math.random() - 0.5) * 6;
        ctx.lineTo(originX + points[i].x + jx, originY + points[i].y + jy);
      }
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function frame(now){
      var p = (now - t0) / DUR;
      if(p >= 1){ return false; }
      triggerImpactFrame(ctx, W, H, p);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // FASE 1: KILATAN WARP PETIR SECEPAT CAHAYA (0.0 -> 0.35)
      var warpP = Math.min(1, p / 0.28);
      var curX = x1 + dx * warpP;
      var curY = y1 + dy * warpP;

      var boltAlpha = Math.max(0, 1 - p * 1.5);
      if(boltAlpha > 0){
        // Sambaran Petir Cabang 1 (Kuning Emas Tebal)
        ctx.strokeStyle = colMain;
        ctx.shadowColor = colGlow;
        ctx.shadowBlur = 28;
        ctx.lineWidth = 14 * boltAlpha;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        var curSegCount = Math.ceil((numSegments - 1) * warpP);
        for(var i=0; i<curSegCount; i++){
          var sp = (i + 1) / numSegments;
          var segX = x1 + dx * sp;
          var segY = y1 + dy * sp;
          var jitter = (Math.random() - 0.5) * 8;
          var px = segX + perpX * (boltOffsetsA[i] + jitter);
          var py = segY + perpY * (boltOffsetsA[i] + jitter);
          ctx.lineTo(px, py);
        }
        ctx.lineTo(curX, curY);
        ctx.stroke();

        // Sambaran Petir Cabang 2 (Garpu Sekunder Halus)
        ctx.strokeStyle = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.lineWidth = 5 * boltAlpha;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for(var j=0; j<curSegCount; j++){
          var sp2 = (j + 1) / numSegments;
          var segX2 = x1 + dx * sp2;
          var segY2 = y1 + dy * sp2;
          var jitter2 = (Math.random() - 0.5) * 6;
          var px2 = segX2 + perpX * (boltOffsetsB[j] + jitter2);
          var py2 = segY2 + perpY * (boltOffsetsB[j] + jitter2);
          ctx.lineTo(px2, py2);
        }
        ctx.lineTo(curX, curY);
        ctx.stroke();

        // Inti Kilat Putih Lurus di Tengah
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3 * boltAlpha;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(curX, curY);
        ctx.stroke();
      }

      // Spark Ion Listrik di Sekitar Lintasan
      for(var s=0; s<sparkEmbers.length; s++){
        var spk = sparkEmbers[s];
        if(p > spk.pAt){
          var age = (p - spk.pAt) / (1 - spk.pAt);
          var sx = x1 + dx * (spk.pAt / 0.28) + perpX * spk.side + spk.driftX * age;
          var sy = y1 + dy * (spk.pAt / 0.28) + perpY * spk.side + spk.driftY * age;
          ctx.fillStyle = spk.color;
          ctx.beginPath();
          ctx.arc(sx, sy, spk.size * (1 - age), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // FASE 2: ELECTRIC DISCHARGE & PLASMA CAGE DI TARGET (0.25 -> 1.0)
      if(p > 0.25){
        var ep = (p - 0.25) / 0.75;
        var fade = 1 - ep;

        // 1. Cincin Sengatan Listrik Mengembang Cepat
        ctx.lineWidth = 10 * fade;
        ctx.strokeStyle = colMain;
        ctx.shadowColor = colGlow; ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x2, y2, ep * 145, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 4 * fade;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x2, y2, ep * 170, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Kilatan Bola Plasma Listrik di Tengah
        var plasmaR = 48 * Math.sin(ep * Math.PI);
        if(plasmaR > 0){
          var pGrad = ctx.createRadialGradient(x2, y2, 2, x2, y2, plasmaR);
          pGrad.addColorStop(0, "#ffffff");
          pGrad.addColorStop(0.4, colMain);
          pGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(x2, y2, plasmaR, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Cabang Sambaran Petir Liar Menyetrum Target
        ctx.strokeStyle = "#ffffff";
        ctx.shadowColor = colMain; ctx.shadowBlur = 16;
        for(var f=0; f<impactForks.length; f++){
          drawFork(impactForks[f], x2, y2, 3 * fade, fade);
        }
      }

      ctx.restore();
    }
    registerFrame(frame);
  }

    // 4. 🔥 FIRE ARCHETYPE (Flame Lance / Phoenix Streak + Eruption Vortex + Floating Embers)
  function fxFire(x1, y1, x2, y2){
    var c = getCanvas();
    var ctx = c.ctx, cv = c.cv, W = c.W, H = c.H, t0 = performance.now(), DUR = 560;
    SFX.boom();

    var dx = x2 - x1, dy = y2 - y1;
    var distTotal = Math.hypot(dx, dy);
    var baseAngle = Math.atan2(dy, dx);
    var perpX = -Math.sin(baseAngle);
    var perpY = Math.cos(baseAngle);

    // Partikel bara api (embers) yang tertinggal di jalur tembakan
    var trailEmbers = [];
    for(var i=0; i<FXQ(32); i++){
      trailEmbers.push({
        pAt: 0.05 + Math.random() * 0.4,
        side: (Math.random() - 0.5) * 28,
        driftX: (Math.random() - 0.5) * 60,
        driftY: -30 - Math.random() * 70,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.35 ? "#fbbf24" : "#f97316"
      });
    }

    // Partikel letupan letusan api saat menabrak musuh
    var burstPillars = [];
    for(var k=0; k<18; k++){
      var ang = -Math.PI/2 + (Math.random() - 0.5) * 1.8;
      var spd = 160 + Math.random() * 240;
      burstPillars.push({
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.4 ? "#fef08a" : (Math.random() > 0.5 ? "#f97316" : "#ef4444")
      });
    }

    function frame(now){
      var p = (now - t0) / DUR;
      if(p >= 1){ return false; }
      triggerImpactFrame(ctx, W, H, p);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // FASE 1: FLAME LANCE / PHOENIX STREAK MELUNCUR (0.0 -> 0.42)
      var flightP = Math.min(1, p / 0.42);
      var easeFlight = flightP < 0.5 ? 2 * flightP * flightP : -1 + (4 - 2 * flightP) * flightP;
      var curX = x1 + dx * easeFlight;
      var curY = y1 + dy * easeFlight;

      // Gambar lidah api lance (meruncing di kepala, mekar di ekor)
      if(flightP < 1){
        var trailLen = Math.min(distTotal * easeFlight, 130);
        var tailX = curX - (dx / distTotal) * trailLen;
        var tailY = curY - (dy / distTotal) * trailLen;

        // Ekor api menyala tebal
        var gradBody = ctx.createLinearGradient(tailX, tailY, curX, curY);
        gradBody.addColorStop(0, "rgba(239, 68, 68, 0)");
        gradBody.addColorStop(0.35, "rgba(249, 115, 22, 0.7)");
        gradBody.addColorStop(0.8, "#fbbf24");
        gradBody.addColorStop(1, "#ffffff");

        // Badan api berbentuk lance tajam
        ctx.fillStyle = gradBody;
        ctx.beginPath();
        var flicker1 = Math.sin((now - t0) * 0.05) * 6;
        var flicker2 = Math.cos((now - t0) * 0.06) * 5;
        ctx.moveTo(curX + (dx/distTotal)*18, curY + (dy/distTotal)*18);
        ctx.lineTo(curX - (dx/distTotal)*20 + perpX * (14 + flicker1), curY - (dy/distTotal)*20 + perpY * (14 + flicker1));
        ctx.lineTo(tailX + perpX * (22 + flicker2), tailY + perpY * (22 + flicker2));
        ctx.lineTo(tailX - (dx/distTotal)*15, tailY - (dy/distTotal)*15);
        ctx.lineTo(tailX - perpX * (22 - flicker2), tailY - perpY * (22 - flicker2));
        ctx.lineTo(curX - (dx/distTotal)*20 - perpX * (14 - flicker1), curY - (dy/distTotal)*20 - perpY * (14 - flicker1));
        ctx.closePath();
        ctx.shadowColor = "#f97316"; ctx.shadowBlur = 28;
        ctx.fill();

        // Inti putih super panas (White-hot Core)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(curX - (dx/distTotal)*40, curY - (dy/distTotal)*40);
        ctx.lineTo(curX + (dx/distTotal)*12, curY + (dy/distTotal)*12);
        ctx.stroke();

        // Kilatan orb kecil di ujung moncong
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(curX, curY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bara Api (Ember Trail) melayang naik ke atas
      for(var e=0; e<trailEmbers.length; e++){
        var emb = trailEmbers[e];
        if(p > emb.pAt){
          var age = (p - emb.pAt) / (1 - emb.pAt);
          var embBaseX = x1 + dx * (emb.pAt / 0.42);
          var embBaseY = y1 + dy * (emb.pAt / 0.42);
          var ex = embBaseX + perpX * emb.side + emb.driftX * age;
          var ey = embBaseY + perpY * emb.side + emb.driftY * age;
          ctx.fillStyle = emb.color;
          ctx.shadowColor = "#f97316"; ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(ex, ey, emb.size * (1 - age), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // FASE 2: LETUSAN ERUPSI API DI TARGET MUSUH (0.4 -> 1.0)
      if(p > 0.4){
        var bp = (p - 0.4) / 0.6;
        var fade = 1 - bp;

        // 1. Kubah ledakan api mekar
        var blastR = bp * 140;
        var bGrad = ctx.createRadialGradient(x2, y2, 4, x2, y2, blastR);
        bGrad.addColorStop(0, "rgba(255, 255, 255, " + fade + ")");
        bGrad.addColorStop(0.35, "rgba(251, 191, 36, " + (0.85 * fade) + ")");
        bGrad.addColorStop(0.7, "rgba(239, 68, 68, " + (0.5 * fade) + ")");
        bGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bGrad;
        ctx.shadowColor = "#f97316"; ctx.shadowBlur = 32;
        ctx.beginPath();
        ctx.arc(x2, y2, blastR, 0, Math.PI * 2);
        ctx.fill();

        // 2. Cincin gelombang panas api (shockwave)
        ctx.lineWidth = 10 * fade;
        ctx.strokeStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(x2, y2, bp * 165, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Lidah semburan bara ke atas & samping
        var timeSec = (p - 0.4) * (DUR / 1000);
        for(var b=0; b<burstPillars.length; b++){
          var bpil = burstPillars[b];
          var bx = x2 + bpil.vx * timeSec;
          var by = y2 + bpil.vy * timeSec + 0.5 * (-120) * (timeSec * timeSec);
          ctx.fillStyle = bpil.color;
          ctx.beginPath();
          ctx.arc(bx, by, bpil.size * fade, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
    registerFrame(frame);
  }

  // 5. ❄️ ICE ARCHETYPE (Frost Lance & Glacial Crystal Shatter + Sparkling Flakes)
  function fxIce(x1, y1, x2, y2){
    var c = getCanvas();
    var ctx = c.ctx, cv = c.cv, W = c.W, H = c.H, t0 = performance.now(), DUR = 560;
    SFX.ice();

    var dx = x2 - x1, dy = y2 - y1;
    var distTotal = Math.hypot(dx, dy);
    var baseAngle = Math.atan2(dy, dx);
    var perpX = -Math.sin(baseAngle);
    var perpY = Math.cos(baseAngle);

    // Kepingan salju berkilau (sparkling frost flakes) di jalur terbang
    var trailFlakes = [];
    for(var i=0; i<FXQ(28); i++){
      trailFlakes.push({
        pAt: 0.05 + Math.random() * 0.42,
        side: (Math.random() - 0.5) * 32,
        size: 2 + Math.random() * 2.5,
        driftX: (Math.random() - 0.5) * 20,
        driftY: (Math.random() - 0.5) * 25,
        color: Math.random() > 0.3 ? "#e0f2fe" : "#7dd3fc"
      });
    }

    // Bongkahan pecahan kristal es tajam saat menabrak target
    var iceShards = [];
    for(var k=0; k<26; k++){
      var ang = Math.random() * Math.PI * 2;
      var spd = 180 + Math.random() * 260;
      iceShards.push({
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12,
        w: 5 + Math.random() * 7,
        h: 12 + Math.random() * 16,
        color: Math.random() > 0.4 ? "#ffffff" : (Math.random() > 0.5 ? "#bae6fd" : "#38bdf8")
      });
    }

    // Tiga tombak es (1 utama di tengah, 2 pendamping di kiri/kanan)
    var lances = [
      { offsetPerp: 0, lag: 0, scale: 1.0 },
      { offsetPerp: -18, lag: 0.04, scale: 0.75 },
      { offsetPerp: 18, lag: 0.06, scale: 0.75 }
    ];

    function drawLance(lx, ly, len, scale){
      var w = 9 * scale;
      var halfLen = len * scale;
      // Gambar bentuk prisma kristal berlian lancip
      var tipX = lx + (dx / distTotal) * halfLen;
      var tipY = ly + (dy / distTotal) * halfLen;
      var backX = lx - (dx / distTotal) * halfLen;
      var backY = ly - (dy / distTotal) * halfLen;
      var midX = lx;
      var midY = ly;

      // Sisi kristal kiri (highlight terang)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(midX + perpX * w, midY + perpY * w);
      ctx.lineTo(backX, backY);
      ctx.closePath();
      ctx.fill();

      // Sisi kristal kanan (cyan es)
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(midX - perpX * w, midY - perpY * w);
      ctx.lineTo(backX, backY);
      ctx.closePath();
      ctx.fill();

      // Garis tengah punggung kristal
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(backX, backY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }

    function frame(now){
      var p = (now - t0) / DUR;
      if(p >= 1){ return false; }
      triggerImpactFrame(ctx, W, H, p);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // FASE 1: 3 TOMBAK KRISTAL ES MELUNCUR MENEMBUS UDARA (0.0 -> 0.42)
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 24;

      for(var l=0; l<lances.length; l++){
        var lc = lances[l];
        var lp = Math.max(0, p - lc.lag) / 0.42;
        if(lp > 0 && lp < 1){
          var easeLp = lp < 0.5 ? 2 * lp * lp : -1 + (4 - 2 * lp) * lp;
          var curLx = x1 + dx * easeLp + perpX * lc.offsetPerp;
          var curLy = y1 + dy * easeLp + perpY * lc.offsetPerp;

          // Jejak kabut beku di belakang tombak
          var trailLen = 65 * lc.scale;
          var tX = curLx - (dx / distTotal) * trailLen;
          var tY = curLy - (dy / distTotal) * trailLen;
          var gradTrail = ctx.createLinearGradient(tX, tY, curLx, curLy);
          gradTrail.addColorStop(0, "rgba(56, 189, 248, 0)");
          gradTrail.addColorStop(0.5, "rgba(186, 230, 253, 0.4)");
          gradTrail.addColorStop(1, "rgba(255, 255, 255, 0.85)");
          ctx.strokeStyle = gradTrail;
          ctx.lineWidth = 5 * lc.scale;
          ctx.beginPath();
          ctx.moveTo(tX, tY);
          ctx.lineTo(curLx, curLy);
          ctx.stroke();

          // Render tombak es kristal
          drawLance(curLx, curLy, 32, lc.scale);
        }
      }

      // Kepingan Salju & Partikel Es Melayang di Jalur
      for(var f=0; f<trailFlakes.length; f++){
        var flk = trailFlakes[f];
        if(p > flk.pAt){
          var age = (p - flk.pAt) / (1 - flk.pAt);
          var fx = x1 + dx * (flk.pAt / 0.42) + perpX * flk.side + flk.driftX * age;
          var fy = y1 + dy * (flk.pAt / 0.42) + perpY * flk.side + flk.driftY * age;
          ctx.fillStyle = flk.color;
          ctx.beginPath();
          ctx.arc(fx, fy, flk.size * (1 - age), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // FASE 2: GLACIAL CRYSTAL SHATTER DI TARGET MUSUH (0.4 -> 1.0)
      if(p > 0.4){
        var bp = (p - 0.4) / 0.6;
        var fade = 1 - bp;

        // 1. Cincin gelombang beku kristal heksagonal mekar
        ctx.lineWidth = 12 * fade;
        ctx.strokeStyle = "#38bdf8";
        ctx.shadowColor = "#bae6fd"; ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(x2, y2, bp * 145, 0, Math.PI * 2);
        ctx.stroke();

        // Cincin kedua putih
        ctx.lineWidth = 4 * fade;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x2, y2, bp * 175, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Kilatan bintang es heksagonal di pusat benturan
        var starR = 50 * Math.sin(bp * Math.PI);
        if(starR > 0){
          for(var s=0; s<6; s++){
            var sa = (s / 6) * Math.PI * 2;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3.5 * fade;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 + Math.cos(sa) * starR, y2 + Math.sin(sa) * starR);
            ctx.stroke();
          }
        }

        // 3. Bongkahan pecahan kristal es tajam terlempar & berputar
        var timeSec = (p - 0.4) * (DUR / 1000);
        for(var s=0; s<iceShards.length; s++){
          var shd = iceShards[s];
          var sx = x2 + shd.vx * timeSec;
          var sy = y2 + shd.vy * timeSec;
          var curRot = shd.rot + shd.rotSpeed * timeSec;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(curRot);
          ctx.fillStyle = shd.color;
          ctx.globalAlpha = fade;
          // Bentuk serpihan kristal tajam
          ctx.beginPath();
          ctx.moveTo(0, -shd.h / 2);
          ctx.lineTo(shd.w / 2, 0);
          ctx.lineTo(0, shd.h / 2);
          ctx.lineTo(-shd.w / 2, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    }
    registerFrame(frame);
  }

    // 5. 🌌 ENERGY ARCHETYPE (Balanced Anime Energy: Orbiting Plasma Orb + Double-Helix Trail + Radial Burst)
  function fxEnergy(x1, y1, x2, y2, colMain, colGlow){
    var c = getCanvas();
    var ctx = c.ctx, cv = c.cv, W = c.W, H = c.H, t0 = performance.now(), DUR = 520;
    colMain = colMain || "#c084fc";
    colGlow = colGlow || "#9333ea";
    SFX.boom();

    // Partikel percikan orbit di sekitar orb
    var sparkCount = FXQ(18);
    var sparks = [];
    for(var i=0; i<sparkCount; i++){
      sparks.push({
        angle: (i / sparkCount) * Math.PI * 2,
        speed: 0.12 + Math.random() * 0.15,
        dist: 16 + Math.random() * 16,
        size: 2 + Math.random() * 2.5
      });
    }

    // Debris ledakan impact
    var impactDebris = [];
    for(var k=0; k<24; k++){
      var ang = Math.random() * Math.PI * 2;
      var spd = 200 + Math.random() * 280;
      impactDebris.push({
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.5 + Math.random() * 3,
        color: Math.random() > 0.4 ? colMain : "#ffffff"
      });
    }

    var dx = x2 - x1, dy = y2 - y1;
    var distTotal = Math.hypot(dx, dy);
    var baseAngle = Math.atan2(dy, dx);
    var perpX = -Math.sin(baseAngle);
    var perpY = Math.cos(baseAngle);

    function frame(now){
      var p = (now - t0) / DUR;
      if(p >= 1){ return false; }
      triggerImpactFrame(ctx, W, H, p);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // FASE 1: PROYEKTIL ORB MELUNCUR DARI PENYERANG KE TARGET (0.0 -> 0.45)
      var flightP = Math.min(1, p / 0.45);
      var easeFlight = flightP < 0.5 ? 2 * flightP * flightP : -1 + (4 - 2 * flightP) * flightP;
      var curX = x1 + dx * easeFlight;
      var curY = y1 + dy * easeFlight;

      // Double-Helix Spiral Trail (jejak aura spiral di belakang orb)
      var trailSteps = 28;
      var curDist = distTotal * easeFlight;
      if(curDist > 10){
        ctx.lineWidth = 3;
        for(var h = -1; h <= 1; h += 2){
          ctx.beginPath();
          ctx.strokeStyle = h === 1 ? colMain : "#ffffff";
          ctx.shadowColor = colGlow; ctx.shadowBlur = 14;
          for(var s = 0; s <= trailSteps; s++){
            var sp = s / trailSteps;
            var d = curDist * sp;
            var stepX = x1 + (dx / distTotal) * d;
            var stepY = y1 + (dy / distTotal) * d;
            var wave = Math.sin(sp * Math.PI * 4 - (now - t0) * 0.02) * (14 * sp) * h;
            var wx = stepX + perpX * wave;
            var wy = stepY + perpY * wave;
            if(s === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
        }

        // Inti beam lurus tipis di tengah
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(curX, curY);
        ctx.lineWidth = 4;
        ctx.strokeStyle = colMain;
        ctx.shadowColor = colGlow; ctx.shadowBlur = 18;
        ctx.stroke();
      }

      // Bola Energi (Plasma Orb) di kepala proyektil
      if(flightP < 1){
        var orbRadius = 18;
        var grad = ctx.createRadialGradient(curX, curY, 2, curX, curY, orbRadius * 2);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.35, colMain);
        grad.addColorStop(0.85, colGlow);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(curX, curY, orbRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(curX, curY, orbRadius * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Partikel orbit di sekeliling bola energi
        for(var s=0; s<sparks.length; s++){
          var spk = sparks[s];
          spk.angle += spk.speed;
          var sx = curX + Math.cos(spk.angle) * spk.dist;
          var sy = curY + Math.sin(spk.angle) * (spk.dist * 0.65);
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(sx, sy, spk.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // FASE 2: IMPACT BURST SAAT MENABRAK KARTU TARGET (0.4 -> 1.0)
      if(p > 0.4){
        var bp = (p - 0.4) / 0.6;
        var fade = 1 - bp;

        // 1. Cincin gelombang kejut radial yang mengembang
        ctx.lineWidth = 12 * fade;
        ctx.strokeStyle = colMain;
        ctx.shadowColor = colGlow; ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(x2, y2, bp * 135, 0, Math.PI * 2);
        ctx.stroke();

        // Cincin kedua
        ctx.lineWidth = 4 * fade;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x2, y2, bp * 165, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Kilatan kubah plasma di titik tabrakan
        var burstRad = 55 * Math.sin(bp * Math.PI);
        if(burstRad > 0){
          var bGrad = ctx.createRadialGradient(x2, y2, 2, x2, y2, burstRad);
          bGrad.addColorStop(0, "#ffffff");
          bGrad.addColorStop(0.5, colMain);
          bGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(x2, y2, burstRad, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Debris partikel energi melesat keluar
        var timeSec = (p - 0.4) * (DUR / 1000);
        for(var d=0; d<impactDebris.length; d++){
          var deb = impactDebris[d];
          var debX = x2 + deb.vx * timeSec;
          var debY = y2 + deb.vy * timeSec;
          ctx.fillStyle = deb.color;
          ctx.beginPath();
          ctx.arc(debX, debY, deb.size * fade, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
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
    var x1 = fr.left + fr.width/2, y1 = fr.top + fr.height * 0.38;
    var x2 = tr.left + tr.width/2, y2 = tr.top + tr.height * 0.38;

    var cId = (charId || "").toUpperCase();
    var cDef = (typeof CARDS !== "undefined" && CARDS) ? CARDS[charId] : null;
    var skill = cDef ? (cDef.skill || "").toUpperCase() : "";
    var cName = cDef ? (cDef.name || "").toUpperCase() : "";

    // ==========================================
    // 1. LIGHTNING ARCHETYPE (Godspeed / Petir)
    // ==========================================
    if(
      cId.includes("ZENITSU") || cId.includes("LUCK") || cId.includes("KILLUA") || cId.includes("CHIDORI") || cId.includes("THUNDER") || cId.includes("LIGHTNING") ||
      cName.includes("LIGHTNING") || cName.includes("THUNDER") ||
      skill.includes("THUNDER") || skill.includes("LIGHTNING") || skill.includes("CHIDORI") || skill.includes("GODSPEED") || skill.includes("VOLT")
    ){
      fxLightning(x1, y1, x2, y2, "#facc15", "#eab308");
      return true;
    }

    // ==========================================
    // 2. FIRE ARCHETYPE (Flame Lance / Phoenix)
    // ==========================================
    if(
      cId.includes("FIREBALL") || cId.includes("FIRE") || cId.includes("ACE") || cId.includes("RENGOKU") || cId.includes("KATON") || cId.includes("IGNITE") || cId.includes("CRIMSON_WARLORD") ||
      cName.includes("FIRE") || cName.includes("FLAME") || cName.includes("INFERNO") ||
      skill.includes("FIRE") || skill.includes("KATON") || skill.includes("FLAME") || skill.includes("BURN") || skill.includes("IGNITE") || skill.includes("INFERNO") || skill.includes("AMATERASU") || skill.includes("METEOR SHOWER")
    ){
      fxFire(x1, y1, x2, y2);
      return true;
    }

    // ==========================================
    // 3. ICE ARCHETYPE (Triple Frost Lance)
    // Sea Sovereign (Poseidon) di sini sesuai arahan user
    // ==========================================
    if(
      cId.includes("CAPTAIN") || cId.includes("ICE_REAPER") || cId.includes("FROST") || cId.includes("SEA_SOVEREIGN") || cId.includes("ABSOLUTE_ZERO") || cId.includes("ICE_QUEEN") || cId.includes("BLIZZARD") || cId.includes("ETERNAL_DRAGON") ||
      cName.includes("ICE") || cName.includes("FROST") || cName.includes("SEA SOVEREIGN") ||
      skill.includes("HYORINMARU") || skill.includes("HAKKA") || skill.includes("ICE") || skill.includes("FREEZE") || skill.includes("BLIZZARD") || skill.includes("GLACIER") || skill.includes("DIVINE TRIDENT")
    ){
      fxIce(x1, y1, x2, y2);
      return true;
    }

    // ==========================================
    // 4. BLADE ARCHETYPE (Grand Crescent Moon)
    // Soul Reaper (Bleach) & Noble Companion (Yuta) di sini sesuai arahan user
    // ==========================================
    if(
      cId.includes("TITAN_HUNTER") || cId.includes("TITAN_BLADE") || cName.includes("TITAN HUNTER") || cId.includes("SOUL_REAPER") || cId.includes("NOBLE_COMPANION") || cId.includes("RIKAS_BLESSING") || cId.includes("JINWOO") || cId.includes("SHADOW_KING") || cId.includes("SHADOW_MONARCH") ||
      cId.includes("TANJIRO") || cId.includes("DRAGON_SIN") || cId.includes("COPYBLADE") || cId.includes("COPY_NINJA") || cId.includes("ZORO") || cId.includes("THREEBLADE") || cId.includes("STRUGGLER") || cId.includes("DARKIN") || cId.includes("NULLBLADE") || cId.includes("DEVIL_HUNTER") || cId.includes("RULER") || cId.includes("OMNI_SOVEREIGN") || cId.includes("WHITE_HAWK") || cId.includes("SANEMI") ||
      cName.includes("SWORD") || cName.includes("BLADE") || cName.includes("RONIN") || cName.includes("SOUL REAPER") || cName.includes("NOBLE COMPANION") ||
      skill.includes("WATER BREATHING") || skill.includes("FULL COUNTER") || skill.includes("BLADE") || skill.includes("SWORD") || skill.includes("SLASH") || skill.includes("CLEAVE") || skill.includes("KATANA") || skill.includes("WORLD ENDER") || skill.includes("BERSERKER") || skill.includes("VENUZDONOA") || skill.includes("SHUKATSU")
    ){
      fxBlade(x1, y1, x2, y2, "#00f5d4", "#ffffff");
      return true;
    }

    // ==========================================
    // 5. ENERGY ARCHETYPE (Orb + Double-Helix)
    // Trickster Ace (Hisoka) di sini sesuai arahan user
    // Solar Brawler / Goku DIKECUALIKAN dari Energy (akan masuk Brawler/Punch)
    // ==========================================
    var isSolar = cId.includes("SOLAR_BRAWLER") || cId.includes("ULTIMATE_WARRIOR") || cName.includes("SOLAR BRAWLER");
    if(!isSolar && (
      cId.includes("TRICKSTER") || cId.includes("PROMISED_CHILD") || cId.includes("WILDHEART") || cId.includes("INUIZO") || cId.includes("SAND") || cId.includes("PAPER") || cId.includes("IMMORTAL_VAMPIRE") || cId.includes("THE WORLD") || cId.includes("SORCERER") || cId.includes("LIMITLESS") || cId.includes("MONARCH") || cId.includes("SHADOW_SUMMONER") || cId.includes("SIXFOLD") || cId.includes("SIX_PATHS") || cId.includes("ALMIGHTY") || cId.includes("KING_OF_CURSES") || cId.includes("TYRANT") || cId.includes("DEMON_SLIME") || cId.includes("MOON_MOTHER") || cId.includes("SHINOBU") || cId.includes("OTHERWORLD") || cId.includes("UNDYING_ROGUE") || cId.includes("COLOSSUS") || cId.includes("PORCO") || cId.includes("GLITCHED") || cId.includes("GRIEFER") || cId.includes("HEIGHT_OF_PAINTING") || cId.includes("HEAVENS_DOOR") || cId.includes("PUPPET") || cId.includes("CURSED_DOLL") || cId.includes("LIGHTBORNE") || cId.includes("ASTRAL_DEVOURER") || cId.includes("NINE_TAIL") || cId.includes("BIJUU") ||
      skill.includes("JAJANKEN") || skill.includes("BUNGEE") || skill.includes("SAND") || skill.includes("ZEPHYR") || skill.includes("TIME STOP") || skill.includes("CORRUPT") || skill.includes("ALMIGHTY PUSH") || skill.includes("ARISE") || skill.includes("HOLLOW PURPLE") || skill.includes("DEATH BEAM") || skill.includes("DRAIN") || skill.includes("SUPERNOVA")
    )){
      var col = skill.includes("JAJANKEN") ? "#f97316" : skill.includes("BUNGEE") ? "#ec4899" : skill.includes("SAND") ? "#d97706" : skill.includes("TIME STOP") ? "#facc15" : "#c084fc";
      fxEnergy(x1, y1, x2, y2, col, "#ffffff");
      return true;
    }

    // ==========================================
    // 6. BRAWLER ARCHETYPE (Gatling Multi-Fists)
    // Solar Brawler (Goku), Saitama, Lee, Luffy, Whitebeard, dll.
    // ==========================================
    fxBrawler(x1, y1, x2, y2, "#ff5722", "#ff9800");
    return true;
  };
})();
