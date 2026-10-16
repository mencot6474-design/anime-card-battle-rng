/* ============================================================
   SHEET FX — spritesheet "Combat FX Free by heyheythere" (CC BY 4.0)
   Dipakai battle.js:
   · strikeFx()   — tebasan + impact ber-ELEMEN sesuai passive penyerang
   · statusSync() — watcher freeze/stun/burn (start → loop → end)
   ============================================================ */
(function(){
"use strict";
var VFX_BASE="assets/vfx/";
var SHEETS={
  white_slash:{src:"combat/sheets/256/white/white_slash.png",frames:16,fps:30,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.5},
  white_hit:{src:"combat/sheets/256/white/white_hit.png",frames:12,fps:30,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.5},
  white_spark:{src:"combat/sheets/256/white/white_spark.png",frames:16,fps:30,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.5},
  gold_crit:{src:"combat/sheets/256/gold/gold_crit.png",frames:20,fps:30,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.5},
  fire_impact:{src:"spell/sheets/256/fire/fire_impact.png",frames:24,fps:30,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.5},
  ice_bolt:{src:"spell/sheets/256/ice/ice_bolt.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:128,ax:.78,ay:.5,loop:true},
  ice_impact:{src:"spell/sheets/256/ice/ice_impact.png",frames:24,fps:30,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.5},
  burn_start:{src:"status/sheets/256/burn/burn_start.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9},
  burn_loop:{src:"status/sheets/256/burn/burn_loop.png",frames:24,fps:24,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.9,loop:true},
  burn_end:{src:"status/sheets/256/burn/burn_end.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9},
  stun_start:{src:"status/sheets/256/stun/stun_start.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9},
  stun_loop:{src:"status/sheets/256/stun/stun_loop.png",frames:24,fps:24,cols:8,rows:3,cw:256,ch:256,ax:.5,ay:.9,loop:true},
  stun_end:{src:"status/sheets/256/stun/stun_end.png",frames:16,fps:24,cols:8,rows:2,cw:256,ch:256,ax:.5,ay:.9}
};
function centerOf(el){var r=el.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height*.42];}
function sheetFx(name,x,y,opts){
  var m=SHEETS[name];if(!m)return null;
  opts=opts||{};
  var w=opts.size||170,h=w*(m.ch/m.cw),
      ax=(opts.ax!==undefined)?opts.ax:m.ax,
      ay=(opts.ay!==undefined)?opts.ay:m.ay;
  var el=document.createElement("div");el.className="vfx-sheet";
  el.style.width=w+"px";el.style.height=h+"px";
  el.style.left=(x-w*ax)+"px";el.style.top=(y-h*ay)+"px";
  el.style.backgroundImage="url("+VFX_BASE+m.src+")";
  el.style.backgroundSize=(m.cols*w)+"px "+(m.rows*h)+"px";
  if(opts.z)el.style.zIndex=opts.z;
  var tf=[];
  if(opts.flip)tf.push("scaleX(-1)");
  if(opts.rot)tf.push("rotate("+opts.rot+"deg)");
  if(tf.length)el.style.transform=tf.join(" ");
  document.body.appendChild(el);
  var frames=m.frames,f=0,
      dur=Math.max(16,1000/(opts.fps||m.fps)),
      iv=setInterval(function(){
        f++;
        if(f>=frames){
          if(opts.loop||m.loop){f=0;}
          else{clearInterval(iv);if(el.parentNode)el.parentNode.removeChild(el);return;}
        }
        el.style.backgroundPosition=(-(f%m.cols)*w)+"px "+(-Math.floor(f/m.cols)*h)+"px";
      },dur);
  return {el:el,stop:function(){clearInterval(iv);if(el.parentNode)el.parentNode.removeChild(el);}};
}
window.sheetFx=sheetFx;
/* ledakan api kecil pas tick burn (dipanggil battle.js) */
window.burnSheetTick=function(side){
  var el=document.querySelector(side==="me"?".fighter.me":".fighter.foe");if(!el)return;
  var c=centerOf(el);
  sheetFx("fire_impact",c[0],c[1],{size:150});
  if(typeof sfxPlay==="function")sfxPlay("fire",.28,1.15);
};
/* ===== strikeFx — tebasan sheet + impact ELEMEN sesuai passive penyerang ===== */
function strikeFx(Dsel,o){
  o=o||{};
  var d=document.querySelector(Dsel);if(!d)return;
  var c=centerOf(d),big=!!o.big,fx=o.fx||{};
  /* tebasan: crit = gold_crit,normal = white_slash */
  sheetFx(big?"gold_crit":"white_slash",c[0],c[1],{size:big?270:215,flip:!!o.flip});
  /* impact: burn passive → api,freeze passive → es,default → putih */
  var imp=(fx.burn||fx.overheat)?"fire_impact"
        :(fx.hitFreeze||fx.entryFreeze||fx.foeEntryFreeze||fx.deathHex)?"ice_impact"
        :(big?"white_hit":"white_spark");
  sheetFx(imp,c[0],c[1],{size:big?235:160,flip:!!o.flip});
  /* SFX elemen nyambung ke sheet yang sama */
  try{if(typeof sfxPlay==="function"){
    if(fx.burn||fx.overheat)sfxPlay("fire",big?.9:.6);
    else if(fx.hitFreeze||fx.entryFreeze||fx.foeEntryFreeze||fx.deathHex)sfxPlay("iceHit",big?.9:.6);
    else sfxPlay(big?"crit":"slash",.8);
  }}catch(e){}
}
window.strikeFx=strikeFx;
/* ===== STATUS WATCHER — freeze/stun/burn start→loop→end =====
   Interval jalan terus,cuma "nyala" pas counter status > 0 — otomatis nutup
   SEMUA titik pemberian passive (15+ site) tanpa disentuh satu-satu.
   Freeze musuh = eStun + freezeLeft → ledakan es sekali + loop stun (kaku). */
var _prev={foe:{stun:0,burn:0},me:{stun:0}},_loop={},_tim={},_frzPrev=false,_meFrzPrev=false;
function selOf(side){return ".fighter."+side;}
function stPlay(side,type){
  var key=side+":"+type;if(_loop[key])return;
  var el=document.querySelector(selOf(side));if(!el)return;
  var c=centerOf(el);
  sheetFx(type+"_start",c[0],c[1],{size:190});
  /* onset SFX: zap pas stun,batal kalau itu freeze (freeze sendirian bunyi ice-cast) */
  if(typeof sfxPlay==="function"){
    var g=window.bt,frz=(g&&((side==="foe"&&g.freezeLeft>0)||(side==="me"&&g.pFreeze>0)));
    if(!frz)sfxPlay("stun",.65);
  }
  _tim[key]=setTimeout(function(){
    _loop[key]=sheetFx(type+"_loop",c[0],c[1],{size:190});
  },660);
}
function stStop(side,type){
  var key=side+":"+type;
  clearTimeout(_tim[key]);_tim[key]=null;
  if(_loop[key]){_loop[key].stop();_loop[key]=null;}
  var el=document.querySelector(selOf(side));if(!el)return;
  var c=centerOf(el);
  if(SHEETS[type+"_end"])sheetFx(type+"_end",c[0],c[1],{size:190});
}
function upd(side,type,on){
  var was=!!_prev[side][type];
  if(on&&!was)stPlay(side,type);
  else if(!on&&was)stStop(side,type);
  _prev[side][type]=on?1:0;
}
function stAllStop(){
  upd("foe","stun",false);upd("foe","burn",false);upd("me","stun",false);
  _frzPrev=false;_meFrzPrev=false;
}
function statusSync(){
  try{
    var g=window.bt;
    if(!g||g.over){if(_prev.foe.stun||_prev.foe.burn||_prev.me.stun)stAllStop();return;}
    var freeze=(g.freezeLeft||0)>0;
    var foeStun=freeze||(g.eStun||0)>0;
    var foeBurn=(g.eBurn||0)>0;
    var meFreeze=(g.pFreeze||0)>0;
    var meStun=meFreeze||(g.pStun||0)>0;
    if(freeze&&!_frzPrev){ /* onset freeze: ledakan es sekali */
      var el=document.querySelector(".fighter.foe");
      if(el){var c=centerOf(el);sheetFx("ice_impact",c[0],c[1],{size:230});}
      if(typeof sfxPlay==="function")sfxPlay("iceCast",.8);
    }
    _frzPrev=freeze;
    if(meFreeze&&!_meFrzPrev){
      var mel=document.querySelector(".fighter.me");
      if(mel){var mc=centerOf(mel);sheetFx("ice_impact",mc[0],mc[1],{size:230});}
      if(typeof sfxPlay==="function")sfxPlay("iceCast",.8);
    }
    _meFrzPrev=meFreeze;
    upd("foe","stun",foeStun);
    upd("foe","burn",foeBurn);
    upd("me","stun",meStun);
  }catch(e){}
}
setInterval(statusSync,320);
window.sheetStatusSync=statusSync;
})();