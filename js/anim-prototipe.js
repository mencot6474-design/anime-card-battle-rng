/* ============================================================
   ANIM PROTOTIPE — file terpisah, NOL perubahan ke battle.js.
   Cara kerja: "mengintip" panggilan floatText() global yang udah
   dipakai battle.js, lalu meledakkan FX visual sendiri sesuai
   keyword teksnya.
   Matiin prototype = hapus <script> ini dari index.html.
   ============================================================ */
(function(){
"use strict";
var ANIM_FX={on:function(){window.ANIM_FX.enabled=true;},off:function(){window.ANIM_FX.enabled=false;}};
window.ANIM_FX=ANIM_FX;
ANIM_FX.enabled=true;

/* ---------- FEEL LAB v2 — panel tuning feel ----------
   Rujukan riset: Swink "Game Feel" (feedback multi-lapis simultan),
   trauma² shake (amplitude = trauma², decay eksponensial),
   FGC frame data (startup/active/recovery), pitch randomization
   (SFX identik berulang bikin telinga kebal). */
var FEEL={hitstop:90,critHitstop:140,trauma:.6,shakeDecay:1.9,knock:26,camPunch:1,sloMo:false,pitchRand:true};
ANIM_FX.FEEL=FEEL;
var _duck=1; /* audio ducking selama hitstop */
ANIM_FX.presets={
  ARCADE:{hitstop:70,trauma:.7,shakeDecay:2.4,knock:30,camPunch:1.1},
  SUBTLE:{hitstop:35,trauma:.25,shakeDecay:1.6,knock:12,camPunch:.5},
  HEAVY:{hitstop:150,trauma:.95,shakeDecay:1.25,knock:44,camPunch:1.4},
  SNAPPY:{hitstop:55,trauma:.5,shakeDecay:2.9,knock:20,camPunch:.9}
};
ANIM_FX.applyPreset=function(name){
  var p=ANIM_FX.presets[name];if(!p)return false;
  for(var k in p)FEEL[k]=p[k];
  FEEL.critHitstop=Math.round(FEEL.hitstop*1.55);
  return true;
};
ANIM_FX.exportConfig=function(){
  return "FEEL="+JSON.stringify({hitstop:FEEL.hitstop,critHitstop:FEEL.critHitstop,trauma:FEEL.trauma,shakeDecay:FEEL.shakeDecay,knock:FEEL.knock,camPunch:FEEL.camPunch,sloMo:FEEL.sloMo,pitchRand:FEEL.pitchRand});
};
/* trauma² shake + camera punch — 1 loop rAF, decay eksponensial */
var _trauma=0,_punch=0,_camLast=0,_camRaf=null,_tt=0;
function camKick(traumaAdd,punchAdd){
  _trauma=Math.min(1.3,_trauma+(traumaAdd||0)*FEEL.trauma);
  _punch=Math.min(1.3,_punch+(punchAdd||0)*FEEL.camPunch);
  if(!_camRaf){_camLast=performance.now();_camRaf=requestAnimationFrame(camLoop);}
}
function camLoop(now){
  var g=document.querySelector(".arena");if(!g){_camRaf=null;return;}
  var dt=Math.min(.05,(now-_camLast)/1000);_camLast=now;_tt+=dt;
  _trauma*=Math.exp(-FEEL.shakeDecay*dt);
  _punch*=Math.exp(-9*dt);
  var t=Math.min(1.3,_trauma),amp=10*t*t;
  var x=(Math.sin(_tt*31)*.62+Math.sin(_tt*47+1.7)*.38)*amp,
      y=(Math.cos(_tt*37+2.3)*.62+Math.sin(_tt*29)*.38)*amp,rot=Math.sin(_tt*25+.6)*t*t*1.2,z=1+_punch*.06;
  g.style.transform="translate("+x.toFixed(2)+"px,"+y.toFixed(2)+"px) rotate("+rot.toFixed(2)+"deg) scale("+z.toFixed(3)+")";
  if(_trauma<.003&&_punch<.004){g.style.transform="";_camRaf=null;return;}
  _camRaf=requestAnimationFrame(camLoop);
}
ANIM_FX.camKick=camKick;
/* slow-mo: selama hitstop semua animasi browser melambat */
function slowAll(on){
  if(!document.getAnimations)return;
  try{document.getAnimations().forEach(function(a){
    if(on){if(a._fp==null)a._fp=a.playbackRate;a.playbackRate=.1;}
    else if(a._fp!=null){a.playbackRate=a._fp;a._fp=null;}
  });}catch(e){}
}
ANIM_FX.slowAll=slowAll;
/* freeze WAAPI beneran pas hitstop (CSS keyframes udah dipause .hitstop) */
function freezeW(ms){
  if(!document.getAnimations)return;
  var list=[];
  try{document.getAnimations().forEach(function(a){
    var isCss=(typeof CSSAnimation!=="undefined"&&a instanceof CSSAnimation);
    if(!isCss){list.push([a,a.playbackRate]);a.playbackRate=0;}
  });}catch(e){}
  setTimeout(function(){list.forEach(function(p){try{p[0].playbackRate=p[1];}catch(e){}});},ms);
}
ANIM_FX.freezeW=freezeW;
/* knockback + dust — target ngegas ke belakang; transform di wrapper
   .fw biar gak tabrakan sama squash (keduanya animate transform) */
function knock(d,p){
  var w=d.parentNode;if(!w||!w.classList)return;
  w.style.setProperty("--kb",((p>0?1:-1)*FEEL.knock)+"px");var dir=p>0?1:-1,kb=dir*FEEL.knock;
  if(w.animate){try{w.animate([
    {transform:"translateX(0) rotate(0deg)"},
    {transform:"translateX("+kb.toFixed(1)+"px) rotate("+(dir*2.6)+"deg)",offset:.3},
    {transform:"translateX("+(kb*.5).toFixed(1)+"px) rotate("+(-dir*.7)+"deg)",offset:.64},
    {transform:"translateX(0) rotate(0deg)"}
  ],{duration:470,easing:"cubic-bezier(.2,1.15,.4,1)"});}catch(e){}}else{
  w.style.setProperty("--kbr",((p>0?1:-1)*2.4)+"deg");
  w.classList.remove("knock");void w.offsetWidth;w.classList.add("knock");
  setTimeout(function(){w.classList.remove("knock");},500);
  }
}
ANIM_FX.knock=knock;
/* ---------- motion via Web Animations API — easing lembut + overshoot
   (keyframe CSS statis terasa kaku; WAAPI bisa multi-keyframe halus) ---------- */
function windAnim(a,p){
  if(!a||!a.animate)return;
  try{a.animate([
    {transform:"scale(1) translateY(0) rotate(0deg)",filter:"brightness(1)"},
    {transform:"scale(.94) translateY(2%) rotate("+(-2*p)+"deg)",filter:"brightness(1.12)",offset:.6},
    {transform:"scale(1) translateY(0) rotate(0deg)",filter:"brightness(1)"}
  ],{duration:150,easing:"cubic-bezier(.45,0,.35,1.06)"});}catch(e){}
}
function dashAnim(a,p){
  if(!a||!a.animate)return;
  var acc="#8ef";
  try{acc=getComputedStyle(a.parentNode).getPropertyValue("--acc").trim()||"#8ef";}catch(e){}
  var tilt=(p>0?-3:3); /* condong ke arah target */
  try{a.animate([
    {transform:"scale(1) translateY(0) rotate(0deg)",filter:"brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0))",boxShadow:"0 0 0 rgba(0,0,0,0)",offset:0,easing:"cubic-bezier(.1,.9,.2,1)"},
    {transform:"scale(1.3) translateY(-5%) rotate("+tilt+"deg)",filter:"brightness(1.25) drop-shadow(0 0 18px "+acc+")",boxShadow:"0 18px 36px rgba(0,0,0,.55)",offset:.152,easing:"cubic-bezier(.4,0,.4,1)"},
    {transform:"scale(1.12) translateY(-2.5%) rotate("+(tilt*.6)+"deg)",filter:"brightness(1.14) drop-shadow(0 0 12px "+acc+")",boxShadow:"0 12px 24px rgba(0,0,0,.4)",offset:.45,easing:"cubic-bezier(.3,0,.4,1.12)"},
    {transform:"scale(1.05) translateY(-1%) rotate("+(tilt*.2)+"deg)",filter:"brightness(1.04) drop-shadow(0 0 6px "+acc+")",boxShadow:"0 6px 14px rgba(0,0,0,.28)",offset:.72,easing:"cubic-bezier(.2,.9,.3,1)"},
    {transform:"scale(1) translateY(0) rotate(0deg)",filter:"brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0))",boxShadow:"0 0 0 rgba(0,0,0,0)",offset:1}
  ],{duration:460});}catch(e){}
}
function sqAnim(d,p){
  if(!d||!d.animate)return;
  try{d.animate([
    {transform:"translateX("+(13*p)+"px) scale(1.13,.87)",filter:"brightness(2.3)",offset:0},
    {transform:"translateX("+(7*p)+"px) scale(1.05,.97)",filter:"brightness(1.6)",offset:.3},
    {transform:"translateX("+(-3*p)+"px) scale(.99,1.02)",filter:"brightness(1.2)",offset:.62},
    {transform:"none",filter:"brightness(1)",offset:1}
  ],{duration:360,easing:"cubic-bezier(.22,1.1,.36,1)"});}catch(e){}
}
ANIM_FX.windAnim=windAnim;ANIM_FX.dashAnim=dashAnim;ANIM_FX.sqAnim=sqAnim;
/* ---------- SLASH FX - cuma sheet (busur/garis prosedural udah dibuang) ---------- */
function slashFx(d,p,o){
  if(!d)return;
  var crit=!!(o&&o.crit);
  var _sc=centerOf(d);
  sheetFx(crit?"gold_crit":"white_slash",_sc[0],_sc[1],{size:crit?230:170,flip:p<0});
}
ANIM_FX.slashFx=slashFx;
/* frame bar — timeline startup/active/recovery (konsep frame data fighting game) */
function frameBar(startup,active,recovery){
  var bar=document.getElementById("framebar");if(!bar)return;
  var segs=bar.querySelectorAll("i");if(segs.length<3)return;
  var tot=startup+active+recovery;
  segs[0].style.width=(startup/tot*100)+"%";
  segs[1].style.width=(active/tot*100)+"%";
  segs[2].style.width=(recovery/tot*100)+"%";
  bar.classList.remove("run");void bar.offsetWidth;bar.classList.add("run");
  var mark=bar.querySelector("b");if(!mark)return;
  if(bar._raf)cancelAnimationFrame(bar._raf);
  var t0=performance.now();
  (function tick(now){
    var t=now-t0;
    if(t>=tot){mark.style.left="100%";for(var j=0;j<segs.length;j++)segs[j].classList.remove("act");bar._raf=null;return;}
    mark.style.left=(t/tot*100)+"%";
    segs[0].classList.toggle("act",t<startup);
    segs[1].classList.toggle("act",t>=startup&&t<startup+active);
    segs[2].classList.toggle("act",t>=startup+active);
    bar._raf=requestAnimationFrame(tick);
  })(t0);
}
ANIM_FX.frameBar=frameBar;
/* combo counter — serangan beruntun < 1.3 dtk */
var _combo=0,_comboT=0,_comboHide=null;
function comboHit(){
  var now=performance.now();
  _combo=(now-_comboT<1300)?_combo+1:1;
  _comboT=now;
  var el=document.getElementById("combo");
  if(el){
    if(_combo>=2){
      var bb=el.querySelector("b");
      bb.textContent="×"+_combo;
      bb.classList.remove("pop");void bb.offsetWidth;bb.classList.add("pop");
      el.classList.add("on");
    }
    clearTimeout(_comboHide);
    _comboHide=setTimeout(function(){_combo=0;el.classList.remove("on");},1400);
  }
}
ANIM_FX.comboHit=comboHit;
/* ---------- FX status: STUN / FREEZE / BURN ---------- */
/* ---------- FX status: STUN / FREEZE / BURN / POISON - sheet aja ---------- */
function statusFx(sel,type){
  if(type==="burn"){burnFx(sel);return;}
  var el=document.querySelector(sel);if(!el)return;
  if(type==="freeze"){var c=centerOf(el);sheetFx("ice_impact",c[0],c[1],{size:240});return;}
  statusSheet(sel,type);
}
ANIM_FX.statusFx=statusFx;

/* ---------- BURN - sheet start - loop - end (auto 6 dtk demo) ---------- */
function burnFx(sel){
  var el=document.querySelector(sel);if(!el)return;
  statusSheet(sel,"burn");
  if(SFX.fire)SFX.fire();
}
ANIM_FX.burnFx=burnFx;
function burnTick(sel,amount){
  var el=document.querySelector(sel);if(!el)return;
  dmgFloat(el,"-"+(amount||"120"),"burn");
  if(SFX.fire)SFX.fire();
  var c=centerOf(el);
  sheetFx("fire_impact",c[0],c[1],{size:160});
}
ANIM_FX.burnTick=burnTick;

/* ---------- Cut-in jurus unik: dim + potret + nama diagonal ---------- */
function skillCutIn(name,side,kind){
  if(!name)return;
  var old=document.getElementById("skillCutin");
  if(old&&old.getAttribute("data-name")===name)return; /* jangan tumpuk jurus sama */
  if(old)old.parentNode.removeChild(old);
  var owner=null;
  try{owner=(side==="foe"&&window.bt&&bt.en)?bt.en:(window.bt&&bt.eq?bt.eq:null);}catch(e){}
  var art=(owner&&owner.art)?owner.art:"";
  if(!art&&window.ANIM_FX&&ANIM_FX.demoArt&&ANIM_FX.demoArt[side])art=ANIM_FX.demoArt[side];
  var d=document.createElement("div");
  d.id="skillCutin";d.className="sc-"+(side==="foe"?"foe":"me");
  d.style.setProperty("--acc",(CUT_KINDS[kind]||CUT_KINDS.strike).acc);
  d.setAttribute("data-name",name);
  d.innerHTML='<span class="sc-dim"></span><span class="sc-sweep"></span>'+
    (art?'<span class="sc-art" style="background-image:url(\''+art+'\')"></span>':'')+
    '<span class="sc-txt"><small class="sc-tag"></small><b></b></span>';
  d.querySelector(".sc-tag").textContent=(CUT_KINDS[kind]||CUT_KINDS.strike).tag;
  d.querySelector("b").textContent=name;
  document.body.appendChild(d);
  setTimeout(function(){try{d.parentNode.removeChild(d);}catch(e){}},1250);
}
/* ---------- CUT-IN SISTEMIK: 5 template kategori, queue + cooldown ----------
   FULL (layar penuh) buat jurus besar; < 3 dtk sejak FULL terakhir →
   otomatis turun ke MINI banner (lower third) biar gak pernah spam. */
var CUT_KINDS={
  strike:{tag:"SERANGAN",acc:"#FF5C7A"},
  burst:{tag:"SERBUAN",acc:"#FFA53F"},
  hex:{tag:"SENGATAN",acc:"#B98BFF"},
  time:{tag:"RUANG-WAKTU",acc:"#6ED4FF"},
  guard:{tag:"PERTAHANAN",acc:"#5CE8A4"}
};
ANIM_FX.CUT_KINDS=CUT_KINDS;
var _cutLast=0;
function bannerCut(name,side,kind){
  var k=CUT_KINDS[kind]||CUT_KINDS.strike,art="";
  try{art=(side==="foe"&&window.bt&&bt.en&&bt.en.art)?bt.en.art:(window.bt&&bt.eq&&bt.eq.art)?bt.eq.art:"";}catch(e){}
  if(!art&&ANIM_FX.demoArt&&ANIM_FX.demoArt[side])art=ANIM_FX.demoArt[side];
  var w=document.getElementById("cutBanner");
  if(!w){w=document.createElement("div");w.id="cutBanner";document.body.appendChild(w);}
  var card=w.querySelector(".cb-card");
  if(!card){card=document.createElement("div");card.className="cb-card";w.appendChild(card);}
  card.style.setProperty("--acc",k.acc);
  card.innerHTML='<span class="cb-thumb"'+(art?' style="background-image:url(\''+art+'\')"':'')+'></span>'+
    '<span><small class="cb-tag"></small><b class="cb-name"></b></span>';
  card.querySelector(".cb-tag").textContent=k.tag;
  card.querySelector(".cb-name").textContent=name;
  card.classList.remove("cb-card");void card.offsetWidth;card.classList.add("cb-card"); /* restart anim */
  clearTimeout(w._t);w._t=setTimeout(function(){try{card.remove();}catch(e){}},560);
}
function triggerCutIn(name,side,kind){
  if(!name)return;
  kind=CUT_KINDS[kind]?kind:"strike";
  var now=Date.now();
  if(now-_cutLast<3000){bannerCut(name,side,kind);return;}
  _cutLast=now;
  skillCutIn(name,side,kind);
}
ANIM_FX.skillCutIn=triggerCutIn;
ANIM_FX.fullCut=skillCutIn;
ANIM_FX.bannerCut=bannerCut;

/* ---------- Keyword → aksi ----------
   teks persis datang dari floatText() yang dipanggil battle.js:
   "BURN" / "STUNNED" / "BEKU"  → status card
   "THE WORLD" / "UNLIMITED VOID" / "SUPERNOVA" → status + cut-in  */
var CUTINS={
  "THE WORLD":1,"UNLIMITED VOID":1,"SUPERNOVA":1,
  "DOMAIN EXPANSION":1,"ULTIMATE CANON":1,"STARDIVISION":1,
  "NINE CIRCLES":1,"HAKAI":1,"GERUDO WINDFALL":1,"METEOR CRASH":1,
  "KILLER QUEEN":1,"ZANSHIN":1,"LAGU PEMBUASAR":1
};
var STATUSES={
  "BURN":"burn","BEKU":"freeze",
  "STUNNED":"stun","STUN":"stun"
};
function hookText(target,text){
  var t=(text||"").toUpperCase(),side=(target&&target.indexOf("foe")>=0)?"foe":"me";
  /* status: cek kata mana pun di dalam teks (mis. "HAKKA NO TOGAME · BEKU") */
  for(var k in STATUSES){
    if(t.indexOf(k)>=0){
      if(k==="BURN"){
        if(/-[\d.,]+/.test(t))burnTick(target,(t.match(/-([\d.,]+)/)||[])[1]);
        else burnFx(target);
      }else statusFx(target,STATUSES[k]);
      break;
    }
  }
  /* cut-in: nama jurus yang dikenali */
  for(var c in CUTINS){
    if(t.indexOf(c)>=0){triggerCutIn(c,side);break;}
  }
}
ANIM_FX.hookText=hookText;

/* ---------- Bungkus floatText global — cuma kalo game ke-load
    (halaman prototipe murni: tombol demo manggil fx langsung) ---------- */
function install(){
  if(typeof window.floatText!=="function"||window.floatText.__animFx)return;
  var orig=window.floatText;
  var wrapped=function(sel,text,cls,dur){
    try{if(ANIM_FX.enabled)hookText(sel,text);}catch(e){}
    return orig.apply(this,arguments);
  };
  wrapped.__animFx=true;
  window.floatText=wrapped;
}
if(typeof window.floatText==="function"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
  else install();
  var tries=setInterval(function(){
    if(window.floatText&&window.floatText.__animFx){clearInterval(tries);return;}
    if(typeof window.floatText!=="function"){clearInterval(tries);return;}
    install();
  },250);
  setTimeout(function(){clearInterval(tries);},10000);
}
/* ---------- SERANGAN LAMA (salinan persis battle.js — demo mandiri) ----------
   lunge penyerang -> [180ms] target: hitShake + impact + speed-lines + screen shake
   + hit-stop + damage float + sfx. Panggil satu-satu lewat tombol, atau
   attackOld() buat urutan penuh kayak aslinya. */
function pulse(sel,cls,dur){
  var el=document.querySelector(sel);if(!el)return;
  el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
  setTimeout(function(){el.classList.remove(cls);},dur||520);
}
ANIM_FX.pulse=pulse;
function attackLunge(sel,wind){
  var foe=sel.indexOf("Foe")>=0;
  pulse(sel,wind?(foe?"windlunge-l":"windlunge-r"):(foe?"lunge-l":"lunge-r"));
}
ANIM_FX.attackLunge=attackLunge;
function shakeScreen(big){
  var g=document.querySelector(".arena");if(!g)return;
  var cls=big?"shk-big":"shk";g.classList.remove("shk","shk-big");void g.offsetWidth;g.classList.add(cls);
  setTimeout(function(){g.classList.remove(cls);},big?460:300);
}
ANIM_FX.shakeScreen=shakeScreen;
function hitStop(ms){
  var g=document.querySelector(".arena");if(!g)return;
  ms=ms||90;
  if(FEEL.sloMo){slowAll(true);setTimeout(function(){slowAll(false);},ms);}
  else{g.classList.add("hitstop");setTimeout(function(){g.classList.remove("hitstop");},ms);freezeW(ms);}
  _duck=.4;setTimeout(function(){_duck=1;},ms);
}
ANIM_FX.hitStop=hitStop;
function impactFx(sel,big,ang){ /* ang tetap buat kompat tanda arah - visual = sheet */
  var f=document.querySelector(sel);if(!f)return;
  var c=centerOf(f);
  sheetFx(big?"white_hit":"white_spark",c[0],c[1],{size:big?220:150});
}
ANIM_FX.impactFx=impactFx;
function dmgFloat(sel,txt,cls){
  var f=document.querySelector(sel);if(!f)return;
  var r=f.getBoundingClientRect();if(!r.width)return;
  var l=document.getElementById("dmgLayer");
  if(!l){l=document.createElement("div");l.id="dmgLayer";document.body.appendChild(l);}
  var d=document.createElement("div");
  d.className="dmg-float"+(cls?" "+cls:"");d.textContent=txt;
  d.style.left=(r.left+r.width/2)+"px";d.style.top=(r.top-28)+"px";
  l.appendChild(d);setTimeout(function(){d.remove();},950);
}
ANIM_FX.dmgFloat=dmgFloat;

/* ---------- SFX — beep synth (persis state.js) + pemutar mp3 asli ---------- */
var _actx=null;
function beep(freq,dur,type,gain){
  try{
    _actx=_actx||new (window.AudioContext||window.webkitAudioContext)();
    var o=_actx.createOscillator(),g=_actx.createGain();
    o.type=type||"square";o.frequency.value=freq;
    g.gain.setValueAtTime((gain||.05)*_duck,_actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,_actx.currentTime+(dur||.08));
    o.connect(g);g.connect(_actx.destination);o.start();o.stop(_actx.currentTime+(dur||.08));
  }catch(e){}
}
function nz(dur,freq,q,vol){ /* noise transient — biar impact gak "beep doang" */
  try{
    _actx=_actx||new (window.AudioContext||window.webkitAudioContext)();
    var buf=_actx.createBuffer(1,Math.floor(_actx.sampleRate*dur),_actx.sampleRate),ch=buf.getChannelData(0);
    for(var i=0;i<ch.length;i++)ch[i]=Math.random()*2-1;
    var src=_actx.createBufferSource();src.buffer=buf;
    var f=_actx.createBiquadFilter();f.type="bandpass";f.frequency.value=freq;f.Q.value=q||1;
    var g=_actx.createGain();
    g.gain.setValueAtTime(vol||.1,_actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,_actx.currentTime+dur);
    src.connect(f);f.connect(g);g.connect(_actx.destination);src.start();
  }catch(e){}
}
var SFX={
  hit:function(){beep(FEEL.pitchRand?160+Math.random()*60:180,.07);nz(.08,1500,1.2,.10*_duck);},
  crit:function(){beep(FEEL.pitchRand?520+Math.random()*90:560,.12,"sawtooth",.06);nz(.14,2400,1,.13*_duck);},
  dodge:function(){beep(760,.06,"sine");},
  win:function(){[523,659,784,1046].forEach(function(f,i){setTimeout(function(){beep(f,.14,"triangle",.06);},i*110);});},
  lose:function(){[330,262,196].forEach(function(f,i){setTimeout(function(){beep(f,.18,"sine",.06);},i*140);});},
  pull:function(){beep(880,.2,"sine",.05);},
  fire:function(){
    try{
      _actx=_actx||new (window.AudioContext||window.webkitAudioContext)();
      var dur=.3,buf=_actx.createBuffer(1,Math.floor(_actx.sampleRate*dur),_actx.sampleRate),ch=buf.getChannelData(0);
      for(var i=0;i<ch.length;i++)ch[i]=(Math.random()*2-1)*(1-i/ch.length);
      var src=_actx.createBufferSource();src.buffer=buf;
      var f=_actx.createBiquadFilter();f.type="lowpass";
      f.frequency.setValueAtTime(2600,_actx.currentTime);
      f.frequency.exponentialRampToValueAtTime(280,_actx.currentTime+dur);
      var g=_actx.createGain();
      g.gain.setValueAtTime(.16,_actx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,_actx.currentTime+dur);
      src.connect(f);f.connect(g);g.connect(_actx.destination);src.start();
    }catch(e){}
  },
  mp3:function(f){try{var a=new Audio("assets/audio/"+f);a.volume=.7;a.play();}catch(e){}}
};
ANIM_FX.sfx=SFX;

/* ---------- Urutan penuh serangan lama (satu tombol) ----------
   o: {wind, big, txt, mp3, sfx:false} — durasi default sama kayak game (lunge .5s,
   pukulan jatuh di +180ms pas puncak windlunge). */
function attackOld(aSel,dSel,o){
  o=o||{};
  var big=!!o.big;
  attackLunge(aSel,!!o.wind);
  if(o.sfx!==false)SFX.mp3(o.mp3||"punch.mp3");
  setTimeout(function(){
    pulse(dSel,"hit",460);
    impactFx(dSel,big);slashFx(dSel,(o.p!=null?o.p:1),o);
    shakeScreen(big);
    hitStop(big?130:90);
    dmgFloat(dSel,o.txt||"47",big?"crit":null);
    SFX.hit();
  },180);
}
ANIM_FX.attackOld=attackOld;

/* ---------- FASE 1 — FEEL LAB: pipeline 4 tahap ----------
   windup (antisipasi) → commit (dash + afterimage) → impact (hitstop,
   flash, squash, shockring, shake tajam) → settle (number pop + HP tween).
   Tiap layer bisa dimatikan lewat ANIM_FX.layers buat A/B ngerasain bedanya. */
ANIM_FX.layers={windup:true,trail:true,impact:true,settle:true};
function relDir(a,d){ /* +1 = target di kanan penyerang */
  var ra=a.getBoundingClientRect(),rd=d.getBoundingClientRect();
  return (ra.left+ra.width/2<rd.left+rd.width/2)?1:-1;
}
function spawnCharge(a){
  clearCharge(a);
  var g=document.createElement("span");g.className="chg-glow";a.appendChild(g);
}
function clearCharge(a){var g=a.querySelector(".chg-glow");if(g)try{g.remove();}catch(e){}}
function afterimages(a,p){
  var bg="",r=a.getBoundingClientRect();
  try{bg=getComputedStyle(a).backgroundImage;}catch(e){}
  for(var i=0;i<3;i++)(function(i){
    var gh=document.createElement("div");gh.className="ghost";
    gh.style.left=r.left+"px";gh.style.top=r.top+"px";
    gh.style.width=r.width+"px";gh.style.height=r.height+"px";
    if(bg&&bg!=="none")gh.style.backgroundImage=bg;
    gh.style.setProperty("--gx",((p>0?1:-1)*(26+i*22))+"px");gh.style.setProperty("--gs",(1.16-i*.05));
    gh.style.animationDelay=(i*.05)+"s";
    document.body.appendChild(gh);
    setTimeout(function(){try{gh.remove();}catch(e){}},480);
  })(i);
}
function shakeSharp(big){
  var g=document.querySelector(".arena");if(!g)return;
  camKick(big?.9:.6,big?1:.6); /* trauma² shake + zoom punch */
  return;
  /* bekas class-shake lama diganti trauma loop camKick() */
}
function dmgPop(d,txt,cls){
  var r=d.getBoundingClientRect();if(!r.width)return;
  var l=document.getElementById("dmgLayer");
  if(!l){l=document.createElement("div");l.id="dmgLayer";document.body.appendChild(l);}
  var e=document.createElement("div");
  e.className="dmg-float pop"+(cls?" "+cls:"");e.textContent=txt;
  e.style.left=(r.left+r.width/2)+"px";e.style.top=(r.top-30)+"px";
  l.appendChild(e);setTimeout(function(){try{e.remove();}catch(x){}},1150);
}
function hpTween(d,amount){
  var m=d.querySelector(".hpmock");if(!m)return;
  if(m._cur==null){
    m._cur=parseInt(m.getAttribute("data-cur"),10)||1000;
    m._max=parseInt(m.getAttribute("data-max"),10)||m._cur;
  }
  var from=m._cur,to=Math.max(0,from-(amount||0));
  m._cur=to;
  var fill=m.querySelector(".hp-fill"),num=m.querySelector(".hp-num");
  if(!fill||!num)return;
  fill.style.width=(to/m._max*100)+"%";
  m.classList.toggle("low",to/m._max<.35);
  m.classList.remove("hitflash");void m.offsetWidth;m.classList.add("hitflash");
  var t0=performance.now(),dur=520;
  (function tick(now){
    var k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);
    num.textContent=Math.round(from+(to-from)*e)+"/"+m._max;
    if(k<1)requestAnimationFrame(tick);
    else if(to===0)setTimeout(function(){ /* reload bar demo */
      m._cur=m._max;fill.style.width="100%";m.classList.remove("low");
      num.textContent=m._max+"/"+m._max;
    },900);
  })(t0);
}
function hpLocalShake(d){
  var m=d.querySelector(".hpmock");if(!m)return;
  m.classList.remove("shk");void m.offsetWidth;m.classList.add("shk");
  setTimeout(function(){m.classList.remove("shk");},340);
}
function attackNew(aSel,dSel,o){
  o=o||{};if(!ANIM_FX.enabled)return;
  var a=document.querySelector(aSel),d=document.querySelector(dSel);
  if(!a||!d)return;
  var L=ANIM_FX.layers,big=!!o.big,txt=o.txt||"47";
  var p=relDir(a,d);
  var wind=p>0?"nu-windL":"nu-windR", dash=p>0?"nu-dashR":"nu-dashL",
      plain=p>0?"lunge-r":"lunge-l", sq=p>0?"nu-sqR":"nu-sqL";
  function goWind(){
    comboHit();frameBar(150,70,390);
    if(L.windup){
      spawnCharge(a);windAnim(a,p);
      setTimeout(function(){clearCharge(a);goDash();},150);
    }else goDash();
  }
  function goDash(){
    if(L.trail)afterimages(a,p);
    dashAnim(a,p);
    setTimeout(function(){goImpact();},70); /* strike = 4 frame (~70ms) — aturan "anime attack" */
  }
  function goImpact(){
    if(L.impact){
      hitStop(big?FEEL.critHitstop:FEEL.hitstop);
      sqAnim(d,p);
      slashFx(d,p,o);
      impactFx(d,big,p>0?0:Math.PI);
      shakeSharp(big);knock(d,p);
      /* sound coherence: SFX tepat di frame impact, pas hitstop mulai */
      if(o.sfx!==false){SFX.mp3(o.mp3||"punch.mp3");SFX.hit();if(big)SFX.crit();}
      setTimeout(goSettle,Math.max(30,(big?FEEL.critHitstop:FEEL.hitstop)-60));
    }else goSettle();
  }
  function goSettle(){
    if(L.settle){
      dmgPop(d,txt,big?"crit":null);
      hpTween(d,parseInt(txt,10)||0);
      hpLocalShake(d);
    }else dmgFloat(d,txt,null);
  }
  goWind();
}
ANIM_FX.attackNew=attackNew;

function centerOf(el){var r=el.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2];}
function laterRemove(el,ms){setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},ms);}
/* ============================================================
   SHEET FX — player spritesheet (pack "Combat FX Free", CC BY 4.0)
   ============================================================ */
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
ANIM_FX.sheetFx=sheetFx;
/* sheet status start→loop (ganti sheet aktif sebelumnya) */
var _sheetSt=null,_sheetStT=null,_sheetStE=null;
function statusSheet(sel,type){
  if(_sheetSt){_sheetSt.stop();_sheetSt=null;}
  clearTimeout(_sheetStT);clearTimeout(_sheetStE);
  if(!SHEETS[type+"_start"])return;
  var el=document.querySelector(sel);if(!el)return;
  var c=centerOf(el);
  sheetFx(type+"_start",c[0],c[1],{size:200});
  _sheetStT=setTimeout(function(){
    _sheetSt=sheetFx(type+"_loop",c[0],c[1],{size:200});
  },650);
  _sheetStE=setTimeout(function(){ /* demo: 6 dtk loop - putar sheet _end */
    if(_sheetSt){_sheetSt.stop();_sheetSt=null;}
    if(SHEETS[type+"_end"])sheetFx(type+"_end",c[0],c[1],{size:200});
  },6000);
}
ANIM_FX.statusSheet=statusSheet;


})();
