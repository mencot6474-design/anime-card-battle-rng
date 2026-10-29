/* ============================================================
   SHEET FX + PGR × SOLO LEVELING CYBER-PHANTOM VFX & SFX ENGINE
   Dipakai battle.js, tower-lobby.js, dan raid.js:
   · CyberSfx        — Procedural Web Audio Synthesizer (menghormati state.muted)
   · PgrVfx          — Canvas 2D Neon Katana Arcs, Plasma Burn, Cryo Shards,
                       Matrix Space Dodge, Transparent Passive Cut-In, & 3-Stage Overdrive AOE
   · strikeFx()      — tebasan + impact ber-ELEMEN + Neon Katana Arcs
   · statusSync()    — watcher freeze/stun/burn + overlay .is-stunned / .is-frozen / .is-burning
   ============================================================ */
(function(){
"use strict";
var VFX_BASE="assets/vfx/";
var SHEETS={
  white_slash:{src:"combat/sheets/256/white/white_slash.png",frames:16,fps:30,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.5},
  white_hit:{src:"combat/sheets/256/white/white_hit.png",frames:12,fps:30,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.5},
  white_spark:{src:"combat/sheets/256/white/white_spark.png",frames:16,fps:30,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.5},
  gold_crit:{src:"combat/sheets/256/gold/gold_crit.png",frames:20,fps:30,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.5},
  fire_impact:{src:"spell/sheets/256/fire/fire_impact.webp",frames:24,fps:30,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.5},
  ice_bolt:{src:"spell/sheets/256/ice/ice_bolt.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:128,ax:.78,ay:.5,loop:true},
  ice_impact:{src:"spell/sheets/256/ice/ice_impact.webp",frames:24,fps:30,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.5},
  burn_start:{src:"status/sheets/256/burn/burn_start.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9},
  burn_loop:{src:"status/sheets/256/burn/burn_loop.png",frames:24,fps:24,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.9,loop:true},
  burn_end:{src:"status/sheets/256/burn/burn_end.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9},
  stun_start:{src:"status/sheets/256/stun/stun_start.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9},
  stun_loop:{src:"status/sheets/256/stun/stun_loop.png",frames:24,fps:24,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.9,loop:true},
  stun_end:{src:"status/sheets/256/stun/stun_end.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9}
};

/* ===== PROCEDURAL WEB AUDIO SYNTHESIZER (PGR × SOLO LEVELING SFX) ===== */
var CyberSfx=(function(){
  var ac=null;
  function isMuted(){return typeof state!=="undefined" && !!state && !!state.muted;}
  function ctx(){
    if(isMuted())return null;
    if(!ac){
      var AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(AudioCtx)ac=new AudioCtx();
    }
    if(ac&&ac.state==="suspended")ac.resume().catch(function(){});
    return ac;
  }
  function noiseBurst(o){
    var c=ctx();if(!c)return;
    var dur=o.dur||0.18,delay=o.delay||0,t0=c.currentTime+delay;
    var len=Math.max(1,Math.floor(c.sampleRate*dur));
    var buf=c.createBuffer(1,len,c.sampleRate);
    var data=buf.getChannelData(0);
    for(var i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.4);
    var src=c.createBufferSource();src.buffer=buf;
    var flt=c.createBiquadFilter();
    flt.type=o.filterType||"bandpass";
    flt.frequency.setValueAtTime(o.freq||1800,t0);
    if(o.endFreq)flt.frequency.exponentialRampToValueAtTime(Math.max(40,o.endFreq),t0+dur);
    flt.Q.value=o.q||1.5;
    var g=c.createGain();
    g.gain.setValueAtTime(0.001,t0);
    g.gain.linearRampToValueAtTime(o.gain||0.2,t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    src.connect(flt);flt.connect(g);g.connect(c.destination);
    src.start(t0);src.stop(t0+dur+0.02);
  }
  function tone(o){
    var c=ctx();if(!c)return;
    var dur=o.dur||0.2,delay=o.delay||0,t0=c.currentTime+delay;
    var osc=c.createOscillator(),g=c.createGain();
    osc.type=o.type||"sine";
    var f1=Math.max(20,o.f1||440),f2=Math.max(20,o.f2||f1);
    osc.frequency.setValueAtTime(f1,t0);
    if(f2!==f1)osc.frequency.exponentialRampToValueAtTime(f2,t0+dur);
    g.gain.setValueAtTime(0.001,t0);
    g.gain.linearRampToValueAtTime(o.gain||0.16,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(g);g.connect(c.destination);
    osc.start(t0);osc.stop(t0+dur+0.02);
  }
  return {
    katanaSlash:function(p){
      p=p||1;
      noiseBurst({dur:0.13,filterType:"bandpass",freq:3400*p,endFreq:950,q:2.4,gain:0.24});
      tone({type:"sawtooth",f1:1900*p,f2:260,dur:0.11,gain:0.12});
      tone({type:"sine",f1:150,f2:42,dur:0.16,gain:0.22});
    },
    katanaFinisher:function(){
      noiseBurst({dur:0.26,filterType:"highpass",freq:1800,endFreq:420,q:1.2,gain:0.28});
      tone({type:"sine",f1:135,f2:32,dur:0.34,gain:0.34});
      tone({type:"triangle",f1:2400,f2:680,dur:0.22,gain:0.14});
    },
    plasmaBurn:function(){
      tone({type:"sawtooth",f1:180,f2:55,dur:0.36,gain:0.2});
      noiseBurst({dur:0.42,filterType:"bandpass",freq:1200,endFreq:3200,q:1.1,gain:0.24});
      for(var i=0;i<4;i++)noiseBurst({dur:0.06,filterType:"highpass",freq:4200,q:3,gain:0.12,delay:0.08*i});
    },
    systemLock:function(){
      [980,1480,1960].forEach(function(f,idx){tone({type:"square",f1:f,f2:f*1.02,dur:0.07,gain:0.09,delay:idx*0.055});});
      tone({type:"sine",f1:520,f2:130,dur:0.35,gain:0.22,delay:0.16});
    },
    cryoFreeze:function(){
      [2200,2950,3520,4400].forEach(function(f,idx){tone({type:"sine",f1:f,f2:f*0.88,dur:0.3,gain:0.1,delay:idx*0.045});});
      noiseBurst({dur:0.34,filterType:"highpass",freq:3800,endFreq:1600,q:2.2,gain:0.2});
    },
    matrixSpace:function(){
      tone({type:"sine",f1:420,f2:38,dur:0.55,gain:0.34});
      tone({type:"sine",f1:2800,f2:1400,dur:0.45,gain:0.1});
      noiseBurst({dur:0.2,filterType:"bandpass",freq:2200,endFreq:480,q:2.5,gain:0.16});
    },
    cutInActivate:function(){
      tone({type:"sine",f1:80,f2:240,dur:0.28,gain:0.26});
      tone({type:"sawtooth",f1:660,f2:1320,dur:0.22,gain:0.11,delay:0.06});
      tone({type:"triangle",f1:1760,f2:880,dur:0.42,gain:0.14,delay:0.12});
    },
    aoeCharge:function(){
      tone({type:"sawtooth",f1:110,f2:720,dur:0.38,gain:0.18});
      tone({type:"sine",f1:220,f2:1440,dur:0.38,gain:0.15});
    },
    aoeDetonate:function(){
      tone({type:"sine",f1:160,f2:28,dur:0.58,gain:0.4});
      noiseBurst({dur:0.48,filterType:"lowpass",freq:1600,endFreq:180,q:1.0,gain:0.34});
    },
    aoeChainTick:function(idx){
      var p=1+(idx||0)*0.15;
      tone({type:"triangle",f1:920*p,f2:260,dur:0.14,gain:0.16});
      noiseBurst({dur:0.1,filterType:"bandpass",freq:2800*p,q:2.5,gain:0.18});
    },
    /* AudioContext yang dibuat di luar gesture (mis. di dalam setTimeout battle) tetap
       "suspended" di WebView Android → hening. Resume dipicu listener gesture di state.js. */
    unlock:function(){
      var c=ctx();
      if(c&&c.state==="suspended")c.resume().catch(function(){});
    }
  };
})();
window.CyberSfx=CyberSfx;
(window.__aabAudioUnlockers=window.__aabAudioUnlockers||[]).push(function(){CyberSfx.unlock();});

/* ===== CANVAS 2D PGR × SOLO LEVELING VFX OVERLAY ENGINE (EXACT PROTOTYPE RENDERER) ===== */
var fxCv=null,fxCtx=null,fxRunning=false;
var katanaArcs=[],laserBeams=[],curvedArcs=[],glassShards=[],sparks=[],pulseRings=[];

function ensureFxCanvas(){
  if(!fxCv||!document.body.contains(fxCv)){
    fxCv=document.createElement("canvas");
    fxCv.id="pgrBattleFxCanvas";
    fxCv.style.cssText="position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:62;";
    document.body.appendChild(fxCv);
    fxCtx=fxCv.getContext("2d");
    resizeFxCanvas();
    window.addEventListener("resize",resizeFxCanvas);
  }
  if(!fxRunning){fxRunning=true;requestAnimationFrame(tickFxCanvas);}
}
function resizeFxCanvas(){
  if(!fxCv)return;
  var dpr=FXDPR();
  fxCv.width=Math.round(window.innerWidth*dpr);
  fxCv.height=Math.round(window.innerHeight*dpr);
  /* Box px, bukan 100vh: 100vh != innerHeight di PWA/HP -> FX melenceng ke bawah. */
  fxCv.style.width=window.innerWidth+"px";
  fxCv.style.height=window.innerHeight+"px";
  if(fxCtx)fxCtx.setTransform(dpr,0,0,dpr,0,0);
}
function ensureDomOverlays(){
  if(!document.getElementById("pgrMatrixOverlay")){
    var m=document.createElement("div");m.id="pgrMatrixOverlay";document.body.appendChild(m);
  }
  if(!document.getElementById("pgrAoeVignette")){
    var v=document.createElement("div");v.id="pgrAoeVignette";document.body.appendChild(v);
  }
  if(!document.getElementById("pgrCutinOverlay")){
    var c=document.createElement("div");c.id="pgrCutinOverlay";
    c.innerHTML='<div class="pgr-cutin-panel"><div class="pgr-cutin-portrait-box"><img id="pgrCutinImg" src="" alt=""></div><div class="pgr-cutin-info"><div class="pgr-cutin-tag" id="pgrCutinTag">SYSTEM OVERDRIVE // PASSIVE ACTIVATED</div><div class="pgr-cutin-title" id="pgrCutinTitle">PASSIVE SKILL</div><div class="pgr-cutin-desc" id="pgrCutinDesc">Efek pasif diaktifkan.</div></div></div>';
    document.body.appendChild(c);
  }
}

function spawnKatanaArc(x,y,angleRad,color,core,radius){
  ensureFxCanvas();
  katanaArcs.push({x:x,y:y,angle:angleRad,color:color||"#00f5d4",core:core||"#ffffff",radius:radius||140,progress:0});
}
function spawnPhantomBeam(x1,y1,x2,y2,color){
  ensureFxCanvas();
  laserBeams.push({x1:x1,y1:y1,x2:x2,y2:y2,color:color||"#00f5d4",alpha:1});
}
function spawnCurvedChainArc(x1,y1,x2,y2,color){
  ensureFxCanvas();
  var cx=(x1+x2)/2+(Math.random()-0.5)*110;
  var cy=Math.min(y1,y2)-60-Math.random()*50;
  curvedArcs.push({x1:x1,y1:y1,cx:cx,cy:cy,x2:x2,y2:y2,color:color||"#c77dff",progress:0});
}
function spawnRealityShards(x,y,count,cols){
  ensureFxCanvas();
  cols=cols||["#00f5d4","#c77dff","#ff2a5f","#ffffff"];
  var shardN=Math.min(24,FXQ(count||22));
  for(var i=0;i<shardN;i++){
    var ang=Math.random()*Math.PI*2;
    var spd=3+Math.random()*11;
    glassShards.push({
      x:x,y:y,
      vx:Math.cos(ang)*spd,
      vy:Math.sin(ang)*spd,
      size:7+Math.random()*13,
      rot:Math.random()*Math.PI*2,
      vrot:(Math.random()-0.5)*0.22,
      color:cols[Math.floor(Math.random()*cols.length)],
      alpha:0.95
    });
  }
}
function spawnPulseRing(x,y,maxR,color,thick){
  ensureFxCanvas();
  pulseRings.push({x:x,y:y,r:14,maxR:maxR||165,color:color||"#00f5d4",alpha:0.95,thick:thick||2.5});
}
function spawnSparks(x,y,count,palette,opts){
  ensureFxCanvas();
  opts=opts||{};
  palette=palette||["#00f5d4","#c77dff","#ffffff"];
  var upward=!!(opts.upward||opts.upBias>2);
  var sparkN=Math.min(30,FXQ(count||26));
  for(var i=0;i<sparkN;i++){
    var ang=Math.random()*Math.PI*2;
    var spd=2+Math.random()*(opts.maxSpd||8);
    sparks.push({
      x:x+(Math.random()-0.5)*(opts.spread||50),
      y:y+(Math.random()-0.5)*(opts.spread||50),
      vx:upward?(Math.random()-0.5)*2.2:Math.cos(ang)*spd,
      vy:upward?-(2.2+Math.random()*4.8):Math.sin(ang)*spd,
      size:2+Math.random()*3,
      color:palette[Math.floor(Math.random()*palette.length)],
      alpha:1,
      decay:0.022+Math.random()*0.018,
      upward:upward
    });
  }
}

function tickFxCanvas(){
  if(!fxCtx){fxRunning=false;return;}
  fxCtx.clearRect(0,0,window.innerWidth,window.innerHeight);

  /* 1. Curved Homing Chain Arcs */
  for(var c=curvedArcs.length-1;c>=0;c--){
    var ca=curvedArcs[c];
    ca.progress+=0.075;
    if(ca.progress>=1){curvedArcs.splice(c,1);continue;}
    fxCtx.save();
    var cal=Math.sin(ca.progress*Math.PI);
    fxCtx.globalAlpha=cal;
    fxCtx.strokeStyle=ca.color;
    fxCtx.shadowColor=ca.color;
    fxCtx.shadowBlur=18;
    fxCtx.lineWidth=3.5;
    fxCtx.beginPath();
    fxCtx.moveTo(ca.x1,ca.y1);
    fxCtx.quadraticCurveTo(ca.cx,ca.cy,ca.x2,ca.y2);
    fxCtx.stroke();
    fxCtx.strokeStyle="#ffffff";
    fxCtx.lineWidth=1.4;
    fxCtx.stroke();
    fxCtx.restore();
  }

  /* 2. Straight Phantom Dash Beams (Basic Attack) */
  for(var b=laserBeams.length-1;b>=0;b--){
    var bm=laserBeams[b];
    bm.alpha-=0.085;
    if(bm.alpha<=0){laserBeams.splice(b,1);continue;}
    fxCtx.save();
    fxCtx.globalAlpha=Math.max(0,bm.alpha);
    fxCtx.strokeStyle=bm.color;
    fxCtx.shadowColor=bm.color;
    fxCtx.shadowBlur=18;
    fxCtx.lineWidth=3*bm.alpha;
    fxCtx.beginPath();
    fxCtx.moveTo(bm.x1,bm.y1);
    fxCtx.lineTo(bm.x2,bm.y2);
    fxCtx.stroke();
    fxCtx.restore();
  }

  /* 3. Cyber Shockwave Rings */
  for(var r=pulseRings.length-1;r>=0;r--){
    var rg=pulseRings[r];
    rg.r+=(rg.maxR-rg.r)*0.16;
    rg.alpha-=0.03;
    if(rg.alpha<=0){pulseRings.splice(r,1);continue;}
    fxCtx.save();
    fxCtx.beginPath();
    fxCtx.arc(rg.x,rg.y,rg.r,0,Math.PI*2);
    fxCtx.strokeStyle=rg.color;
    fxCtx.globalAlpha=Math.max(0,rg.alpha);
    fxCtx.lineWidth=rg.thick||2.5;
    fxCtx.shadowColor=rg.color;
    fxCtx.shadowBlur=16;
    fxCtx.stroke();
    fxCtx.restore();
  }

  /* 4. Razor-Thin Neon Katana Arcs (Exact Prototype Sweep) */
  for(var s=katanaArcs.length-1;s>=0;s--){
    var ka=katanaArcs[s];
    ka.progress+=0.075;
    if(ka.progress>=1){katanaArcs.splice(s,1);continue;}
    fxCtx.save();
    fxCtx.translate(ka.x,ka.y);
    fxCtx.rotate(ka.angle);
    var sal=Math.sin(ka.progress*Math.PI);
    fxCtx.globalAlpha=sal;
    fxCtx.lineCap="round";
    var startA=-Math.PI*0.65+ka.progress*0.55;
    var endA=startA+Math.PI*0.95*Math.sin(ka.progress*Math.PI);
    fxCtx.strokeStyle=ka.color;
    fxCtx.shadowColor=ka.color;
    fxCtx.shadowBlur=22;
    fxCtx.lineWidth=6*(1-ka.progress*0.5);
    fxCtx.beginPath();
    fxCtx.arc(0,0,ka.radius,startA,endA);
    fxCtx.stroke();
    fxCtx.strokeStyle=ka.core;
    fxCtx.lineWidth=2;
    fxCtx.beginPath();
    fxCtx.arc(0,0,ka.radius,startA,endA);
    fxCtx.stroke();
    fxCtx.restore();
  }

  /* 5. Dimensional Glass Shards */
  for(var sh=glassShards.length-1;sh>=0;sh--){
    var g=glassShards[sh];
    g.x+=g.vx;g.y+=g.vy;
    g.vx*=0.95;g.vy*=0.95;
    g.rot+=g.vrot;
    g.alpha-=0.024;
    if(g.alpha<=0){glassShards.splice(sh,1);continue;}
    fxCtx.save();
    fxCtx.globalAlpha=Math.max(0,g.alpha);
    fxCtx.translate(g.x,g.y);
    fxCtx.rotate(g.rot);
    fxCtx.fillStyle=g.color;
    fxCtx.strokeStyle="#ffffff";
    fxCtx.lineWidth=0.8;
    /* Glow murah: segitiga halo lebih besar & transparan (pengganti shadowBlur per partikel). */
    fxCtx.globalAlpha=Math.max(0,g.alpha*0.28);
    fxCtx.beginPath();
    fxCtx.moveTo(0,-g.size*1.9);
    fxCtx.lineTo(g.size*1.4,g.size*0.95);
    fxCtx.lineTo(-g.size*1.15,g.size*1.5);
    fxCtx.closePath();
    fxCtx.fill();
    fxCtx.globalAlpha=Math.max(0,g.alpha);
    fxCtx.beginPath();
    fxCtx.moveTo(0,-g.size);
    fxCtx.lineTo(g.size*0.75,g.size*0.5);
    fxCtx.lineTo(-g.size*0.6,g.size*0.8);
    fxCtx.closePath();
    fxCtx.fill();
    fxCtx.stroke();
    fxCtx.restore();
  }

  /* 6. Neon Streak Sparks */
  for(var k=sparks.length-1;k>=0;k--){
    var sp=sparks[k];
    sp.x+=sp.vx;sp.y+=sp.vy;
    sp.vx*=0.94;sp.vy*=0.94;
    sp.alpha-=sp.decay;
    if(sp.alpha<=0){sparks.splice(k,1);continue;}
    fxCtx.save();
    fxCtx.strokeStyle=sp.color;
    fxCtx.fillStyle=sp.color;
    /* Glow murah: sapuan lebar & transparan (pengganti shadowBlur per partikel). */
    fxCtx.globalAlpha=Math.max(0,sp.alpha*0.3);
    fxCtx.lineCap="round";
    fxCtx.lineWidth=sp.size*2.4;
    fxCtx.beginPath();
    fxCtx.moveTo(sp.x,sp.y);
    fxCtx.lineTo(sp.x-sp.vx*2.2,sp.y-sp.vy*2.2);
    fxCtx.stroke();
    fxCtx.globalAlpha=Math.max(0,sp.alpha);
    if(sp.upward){
      fxCtx.beginPath();
      fxCtx.arc(sp.x,sp.y,sp.size,0,Math.PI*2);
      fxCtx.fill();
    }else{
      fxCtx.lineWidth=2;
      fxCtx.beginPath();
      fxCtx.moveTo(sp.x,sp.y);
      fxCtx.lineTo(sp.x-sp.vx*2.2,sp.y-sp.vy*2.2);
      fxCtx.stroke();
    }
    fxCtx.restore();
  }

  if(katanaArcs.length||laserBeams.length||curvedArcs.length||glassShards.length||sparks.length||pulseRings.length){
    requestAnimationFrame(tickFxCanvas);
  }else{
    fxRunning=false;
  }
}

function centerOf(el){var r=el.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2];}
function sheetFx(){return {el:null,stop:function(){}};}
window.sheetFx=sheetFx;

/* ledakan api + plasma vortex pas tick burn (dipanggil battle.js) — PERSIS PROTOTIPE */
window.burnSheetTick=function(side){
  var el=document.querySelector(side==="me"?".fighter.me":".fighter.foe");if(!el)return;
  var c=centerOf(el);
  spawnPulseRing(c[0],c[1],165,"#ff2a5f",2.5);
  spawnSparks(c[0],c[1]+25,36,["#ff2a5f","#c77dff","#ffaa00"],{upward:true,spread:50,maxSpd:8});
  CyberSfx.plasmaBurn();
};

/* ===== strikeFx (DEPRECATED & REPLACED) =====
   Animasi tebasan katana bawaan lama & audio synth lama dinonaktifkan.
   Digantikan sepenuhnya oleh Anime Archetype Attacks Engine (6 Core Archetypes). */
function strikeFx(Dsel, o){
  // Animasi dan SFX lama dinonaktifkan agar tidak tumpang tindih dengan proyektil archetype baru.
  return;
}
window.strikeFx = strikeFx;

/* ===== PGR MATRIX SPACE DODGE FX (DENGAN AFTERIMAGE GHOST CLONES PERSIS PROTOTIPE) ===== */
window.playMatrixDodgeFx=function(targetSel){
  ensureDomOverlays();
  var el=document.querySelector(targetSel||".fighter.me");
  var mat=document.getElementById("pgrMatrixOverlay");
  CyberSfx.matrixSpace();
  if(mat){
    mat.classList.add("active");
    setTimeout(function(){mat.classList.remove("active");},580);
  }
  if(el){
    el.classList.remove("matrix-dodge");
    void el.offsetWidth;
    el.classList.add("matrix-dodge");
    setTimeout(function(){el.classList.remove("matrix-dodge");},640);

    /* Spawn 2 holographic afterimage ghost clones behind the card */
    var imgEl=el.querySelector(".f-banner img");
    var artSrc=imgEl?imgEl.getAttribute("src"):"";
    if(artSrc){
      var g1=document.createElement("div"),g2=document.createElement("div");
      g1.className="pgr-ghost-clone";g2.className="pgr-ghost-clone";
      g1.style.backgroundImage="url('"+artSrc+"')";
      g2.style.backgroundImage="url('"+artSrc+"')";
      el.appendChild(g1);el.appendChild(g2);
      requestAnimationFrame(function(){
        g1.style.opacity="0.6";g1.style.transform="translate3d(-34px,-4px,0) scale(0.99)";
        g2.style.opacity="0.32";g2.style.transform="translate3d(30px,4px,0) scale(0.97)";
      });
      setTimeout(function(){
        g1.style.opacity="0";g2.style.opacity="0";
        setTimeout(function(){try{g1.remove();g2.remove();}catch(e){}},320);
      },520);
    }

    var c=centerOf(el);
    spawnPulseRing(c[0],c[1],165,"#00f5d4",2.5);
    spawnSparks(c[0],c[1],24,["#00f5d4","#ffffff"],{upward:false});
  }
};

/* ===== TRANSPARENT SOLO LEVELING × PGR PASSIVE CUT-IN BANNER ===== */
var _cutinLock=false;
window.playPassiveCutIn=function(opts){
  if(_cutinLock)return;
  opts=opts||{};
  ensureDomOverlays();
  var ov=document.getElementById("pgrCutinOverlay");
  if(!ov)return;
  _cutinLock=true;
  let released=false;
  try{
    var imgEl=document.getElementById("pgrCutinImg");
    var tagEl=document.getElementById("pgrCutinTag");
    var ttlEl=document.getElementById("pgrCutinTitle");
    var dscEl=document.getElementById("pgrCutinDesc");
    var artSrc=opts.img||(opts.charId&&typeof window.cardImg==="function"?window.cardImg(opts.charId):"");
    var cName=opts.name||(opts.charId&&typeof window.cardName==="function"?window.cardName(opts.charId):"UNIT");
    if(imgEl&&artSrc)imgEl.src=artSrc;
    if(tagEl)tagEl.textContent=opts.tag||("SYSTEM OVERDRIVE // "+cName);
    if(ttlEl)ttlEl.textContent=opts.title||opts.passiveName||"PASSIVE OVERDRIVE";
    if(dscEl)dscEl.textContent=opts.desc||opts.quote||"Kekuatan pasif kartu bangkit menembus batas pertahanan.";
    CyberSfx.cutInActivate();
    ov.classList.add("active");
    var dur=typeof window.bsMs==="function"?window.bsMs(1150):1150;
    setTimeout(function(){
      ov.classList.remove("active");
      released=true;
      setTimeout(function(){_cutinLock=false;},250);
    },Math.max(450,dur));
  } finally {
    if(!released)_cutinLock=false;
  }
};

/* ===== PASSIVE AOE SPLASH FX (TANPA LASER/PILAR CAHAYA — HANYA PERCIKAN & SHOCKWAVE KE SLOT CADANGAN) ===== */
window.playOverdriveAoeFx=function(dmg,opts){
  opts=opts||{};
  var foeEl=document.querySelector(".fighter.foe");
  if(!foeEl)return;
  var fc=centerOf(foeEl);
  var benchNodes=Array.from(document.querySelectorAll(".foe-side .bench-rail .bench-sq:not(.empty)"));

  /* Efek di kartu utama: cincin shockwave + serpihan kristal + percikan neon (tanpa laser vertikal) */
  spawnKatanaArc(fc[0],fc[1],-0.65,"#00f5d4","#ffffff",162);
  spawnKatanaArc(fc[0],fc[1],0.65,"#ff2a5f","#ffffff",162);
  spawnPulseRing(fc[0],fc[1],220,"#00f5d4",3.5);
  spawnRealityShards(fc[0],fc[1],20,["#00f5d4","#c77dff","#ff2a5f","#ffffff"]);
  spawnSparks(fc[0],fc[1],32,["#00f5d4","#c77dff","#ff2a5f","#ffffff"],{upward:false});

  benchNodes.forEach(function(sq){sq.classList.add("aoe-locked");});

  /* Percikan yang menyerang ke tiap slot cadangan secara berurutan (tanpa garis laser/pilar) */
  benchNodes.forEach(function(sq,idx){
    var stepDelay=typeof window.bsMs==="function"?window.bsMs(90*(idx+1)):90*(idx+1);
    setTimeout(function(){
      var r=sq.getBoundingClientRect();
      if(!r.width)return;
      var bx=r.left+r.width/2,by=r.top+r.height/2;
      CyberSfx.aoeChainTick(idx);
      spawnPulseRing(bx,by,64,idx%2===0?"#00f5d4":"#c77dff",2.2);
      spawnRealityShards(bx,by,8,["#00f5d4","#c77dff","#ffffff"]);
      spawnSparks(bx,by,18,["#00f5d4","#c77dff","#ff2a5f","#ffffff"],{upward:false,spread:24,maxSpd:7.5});
      sq.classList.remove("aoe-locked","aoe-struck");
      void sq.offsetWidth;
      sq.classList.add("aoe-struck");
      setTimeout(function(){sq.classList.remove("aoe-struck");},480);
    },stepDelay);
  });
};

/* ===== STATUS WATCHER — MURNI ORNATE CARD OVERLAYS (.is-frozen / .is-stunned / .is-burning) + CANVAS 2D + CYBERSFX ===== */
var _prev={foe:{stun:0,burn:0},me:{stun:0,burn:0}},_frzPrev=false,_meFrzPrev=false;
function selOf(side){return ".fighter."+side;}
function stPlay(side,type){
  var el=document.querySelector(selOf(side));if(!el)return;
  var c=centerOf(el);
  if(type==="stun"){
    var g=window.bt,frz=(g&&((side==="foe"&&g.freezeLeft>0)||(side==="me"&&g.pFreeze>0)));
    if(!frz){
      CyberSfx.systemLock();
      spawnPulseRing(c[0],c[1],130,"#ffaa00",3.5);
      spawnSparks(c[0],c[1],16,["#ffaa00","#fde047","#ffffff"],{maxSpd:8});
    }
  }else if(type==="burn"){
    CyberSfx.plasmaBurn();
    spawnPulseRing(c[0],c[1],120,"#c77dff",3.5);
    spawnSparks(c[0],c[1],22,["#9d4edd","#ff2a5f","#c77dff","#ffffff"],{upBias:4.2,gravity:-0.08,spread:65});
  }
}
function stStop(side,type){
  var el=document.querySelector(selOf(side));if(!el)return;
  var c=centerOf(el);
  if(type==="stun"){
    spawnRealityShards(c[0],c[1],12,["#ffaa00","#fde047","#ffffff"]);
  }
}
function upd(side,type,on){
  var was=!!_prev[side][type];
  if(on&&!was)stPlay(side,type);
  else if(!on&&was)stStop(side,type);
  _prev[side][type]=on?1:0;
}
function stAllStop(){
  upd("foe","stun",false);upd("foe","burn",false);upd("me","stun",false);upd("me","burn",false);
  _frzPrev=false;_meFrzPrev=false;
  document.querySelectorAll(".fighter.is-stunned,.fighter.is-frozen,.fighter.is-burning").forEach(function(el){
    el.classList.remove("is-stunned","is-frozen","is-burning");
  });
}
function statusSync(){
  try{
    var g=window.bt;
    if(!g||g.over){if(_prev.foe.stun||_prev.foe.burn||_prev.me.stun||_prev.me.burn)stAllStop();return;}
    var freeze=(g.freezeLeft||0)>0;
    var foeStun=freeze||(g.eStun||0)>0;
    var foeBurn=(g.eBurn||0)>0;
    var meFreeze=(g.pFreeze||0)>0;
    var meStun=meFreeze||(g.pStun||0)>0;
    var meBurn=(g.pBurn||0)>0;

    var foeEl=document.querySelector(".fighter.foe");
    var meEl=document.querySelector(".fighter.me");
    if(foeEl){
      foeEl.classList.toggle("is-frozen",freeze);
      foeEl.classList.toggle("is-stunned",!freeze&&foeStun);
      foeEl.classList.toggle("is-burning",foeBurn);
    }
    if(meEl){
      meEl.classList.toggle("is-frozen",meFreeze);
      meEl.classList.toggle("is-stunned",!meFreeze&&meStun);
      meEl.classList.toggle("is-burning",meBurn);
    }

    if(freeze&&!_frzPrev){
      if(foeEl){
        var c=centerOf(foeEl);
        spawnPulseRing(c[0],c[1],175,"#48cae4",2.5);
        spawnRealityShards(c[0],c[1],16,["#48cae4","#00f5d4","#ffffff"]);
        spawnSparks(c[0],c[1],30,["#48cae4","#00f5d4","#ffffff"],{upward:false});
      }
      CyberSfx.cryoFreeze();
    }else if(!freeze&&_frzPrev&&foeEl){
      var fc2=centerOf(foeEl);
      spawnRealityShards(fc2[0],fc2[1],18,["#48cae4","#00f5d4","#ffffff"]);
    }
    _frzPrev=freeze;

    if(meFreeze&&!_meFrzPrev){
      if(meEl){
        var mc=centerOf(meEl);
        spawnPulseRing(mc[0],mc[1],175,"#48cae4",2.5);
        spawnRealityShards(mc[0],mc[1],16,["#48cae4","#00f5d4","#ffffff"]);
        spawnSparks(mc[0],mc[1],30,["#48cae4","#00f5d4","#ffffff"],{upward:false});
      }
      CyberSfx.cryoFreeze();
    }else if(!meFreeze&&_meFrzPrev&&meEl){
      var mc2=centerOf(meEl);
      spawnRealityShards(mc2[0],mc2[1],18,["#48cae4","#00f5d4","#ffffff"]);
    }
    _meFrzPrev=meFreeze;

    upd("foe","stun",foeStun);
    upd("foe","burn",foeBurn);
    upd("me","stun",meStun);
    upd("me","burn",meBurn);
  }catch(e){}
}
/* Watcher status hanya perlu jalan selama battle hidup. Setelah battle selesai
   ia tetap dipanggil sekali lagi (cleanup class stun/freeze/burn), lalu diam. */
var _stWasActive=false;
setInterval(function(){
  var g=window.bt;
  var active=!!(g&&!g.over);
  if(active||_stWasActive)statusSync();
  _stWasActive=active;
},220);
window.sheetStatusSync=statusSync;
})();
