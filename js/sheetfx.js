/* ============================================================
   SHEET FX + CYBER SFX (CLEAN HAZARD EDITION)
   Seluruh partikel lama & dentuman status (burn, freeze, stun, dodge,
   afterimage clone, shards, sparks, pulseRings) DIHAPUS sesuai revisi user.
   Hanya menyisakan CyberSfx ringan dan fungsi stub aman (no-op) agar
   pemanggil di battle.js / raid.js tidak error.
   ============================================================ */
(function(){
"use strict";

var CyberSfx=(function(){
  var ac=null;
  function isMuted(){return !!(window.state&&window.state.muted);}
  function ctx(){
    if(isMuted())return null;
    if(!ac){
      var AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(AudioCtx){try{ac=new AudioCtx();}catch(e){}}
    }
    if(ac&&ac.state==="suspended")ac.resume().catch(function(){});
    return ac;
  }
  function noiseBurst(o){
    var c=ctx();if(!c)return;
    var dur=o.dur||0.15,delay=o.delay||0,t0=c.currentTime+delay;
    var len=Math.max(1,Math.floor(c.sampleRate*dur));
    var buf=c.createBuffer(1,len,c.sampleRate);
    var data=buf.getChannelData(0);
    for(var i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.5);
    var src=c.createBufferSource();src.buffer=buf;
    var flt=c.createBiquadFilter();
    flt.type=o.filterType||"bandpass";
    flt.frequency.setValueAtTime(o.freq||1800,t0);
    if(o.endFreq)flt.frequency.exponentialRampToValueAtTime(Math.max(40,o.endFreq),t0+dur);
    flt.Q.value=o.q||1.5;
    var g=c.createGain();
    g.gain.setValueAtTime(0.001,t0);
    g.gain.linearRampToValueAtTime(o.gain||0.16,t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    src.connect(flt);flt.connect(g);g.connect(c.destination);
    src.start(t0);src.stop(t0+dur+0.02);
  }
  function tone(o){
    var c=ctx();if(!c)return;
    var dur=o.dur||0.16,delay=o.delay||0,t0=c.currentTime+delay;
    var osc=c.createOscillator(),g=c.createGain();
    osc.type=o.type||"sine";
    var f1=Math.max(20,o.f1||440),f2=Math.max(20,o.f2||f1);
    osc.frequency.setValueAtTime(f1,t0);
    if(f2!==f1)osc.frequency.exponentialRampToValueAtTime(f2,t0+dur);
    g.gain.setValueAtTime(0.001,t0);
    g.gain.linearRampToValueAtTime(o.gain||0.12,t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(g);g.connect(c.destination);
    osc.start(t0);osc.stop(t0+dur+0.02);
  }
  return {
    katanaSlash:function(p){
      p=p||1;
      noiseBurst({dur:0.11,filterType:"bandpass",freq:3200*p,endFreq:950,q:2.2,gain:0.18});
      tone({type:"sawtooth",f1:1600*p,f2:260,dur:0.10,gain:0.09});
    },
    katanaFinisher:function(){
      noiseBurst({dur:0.16,filterType:"highpass",freq:1800,endFreq:520,q:1.2,gain:0.20});
      tone({type:"triangle",f1:2000,f2:620,dur:0.16,gain:0.11});
    },
    /* Semua dentuman/suara lama burn, freeze, stun, dodge, aoe dinonaktifkan */
    plasmaBurn:function(){},
    systemLock:function(){},
    cryoFreeze:function(){},
    matrixSpace:function(){},
    cutInActivate:function(){},
    aoeCharge:function(){},
    aoeDetonate:function(){},
    aoeChainTick:function(){},
    rebirthAscendCharge:function(){
      tone({type:"sine",f1:80,f2:240,dur:0.3,gain:0.16});
    },
    rebirthAscendBoom:function(){
      [523,659,784,1046].forEach(function(f,idx){
        tone({type:"triangle",f1:f,f2:f*1.01,dur:0.4-idx*0.04,gain:0.12,delay:0.045*idx});
      });
    },
    unlock:function(){
      var c=ctx();
      if(c&&c.state==="suspended")c.resume().catch(function(){});
    }
  };
})();
window.CyberSfx=CyberSfx;
(window.__aabAudioUnlockers=window.__aabAudioUnlockers||[]).push(function(){CyberSfx.unlock();});

/* Semua partikel & efek lama (burn, freeze, stun, dodge, cutin, aoe) dinonaktifkan */
function noop(){}
window.sheetFx=function(){return {el:null,stop:noop};};
window.burnSheetTick=noop;
window.strikeFx=noop;
window.playMatrixDodgeFx=noop;
window.playPassiveCutIn=noop;
window.playOverdriveAoeFx=noop;
window.playRebirthAscensionVfx=noop;
window.sheetStatusSync=noop;
})();
