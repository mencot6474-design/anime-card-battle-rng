/* ===== SHADOW KING PASSIVE FX (ARISE / SHADOW EXCHANGE / LEGION ABSORB) =====
   Versi engine dari prototipe _tmp/shadow-king-fx.html.
   Semua timing lewat bsMs() & skala FX = battle speed, jadi 4x ikut 4x.
   Partikel di satu canvas (1x DPR, rAF berhenti kalau kosong), kartu terbang pakai
   ghost tile DOM (transform/opacity, bukan clone markup card -> tidak ada id dobel). */
(function(){
  "use strict";
  const VIOLET="#a78bfa",DEEP="#7c3aed",CYAN="#7df9ff";

  const sc=()=>{const v=(typeof bsMs==="function")?bsMs(1000)/1000:1;return v>0?v:1;};
  const wait=ms=>new Promise(r=>setTimeout(r,(typeof bsMs==="function")?bsMs(ms):ms));
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const speedNow=()=>{try{return (typeof bt!=="undefined"&&bt&&bt.speed)||1;}catch(e){return 1;}};
  const alive=()=>{try{return typeof bt!=="undefined"&&!!bt&&!bt.over;}catch(e){return false;}};
  const artOf=(src,thumb)=>/\.(mp4|webm|m4v|mov)(\?|$)/i.test(src||"")?(thumb||src):src;

  /* ---------- layer + canvas ---------- */
  let layer=null,cv=null,ctx=null,W=0,H=0,parts=[],raf=0,lastT=0,fxSpeed=1,token=0;
  function ensure(){
    if(layer&&layer.isConnected)return;
    layer=document.createElement("div");layer.id="skfxLayer";
    layer.innerHTML='<div class="skfx-vig"></div><div class="skfx-flash"></div><canvas class="skfx-cv"></canvas>';
    document.body.appendChild(layer);
    cv=layer.querySelector(".skfx-cv");ctx=cv.getContext("2d");
    resize();window.addEventListener("resize",resize);
  }
  function resize(){if(!cv)return;W=window.innerWidth;H=window.innerHeight;cv.width=W;cv.height=H;ctx.clearRect(0,0,W,H);}
  function begin(){
    ensure();
    token++;parts.length=0;fxSpeed=speedNow();
    ctx.clearRect(0,0,W,H);
    return token;
  }
  const guard=t=>t===token&&alive();

  /* ---------- particles ---------- */
  function addP(p){
    const o=Object.assign({t:0,life:.8,size:2,color:VIOLET,kind:"spark",vx:0,vy:0,g:0,ph:rnd(0,6.28)},p);
    parts.push(o);
    if(parts.length>220)parts.splice(0,parts.length-220);
    startLoop();
  }
  function startLoop(){
    if(raf)return;
    lastT=performance.now();
    raf=requestAnimationFrame(loop);
  }
  function loop(now){
    const dt=Math.min(.05,(now-lastT)/1000);lastT=now;
    const st=Math.min(.16,dt*fxSpeed);
    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation="lighter";
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i];p.t+=st;
      const k=Math.min(1,p.t/p.life);
      if(p.kind==="spark"){
        p.vx+=Math.sin(p.t*7+p.ph)*26*st;
        p.x+=p.vx*st;p.y+=p.vy*st;p.vy+=p.g*st;
        if(k>=1){parts.splice(i,1);continue;}
        ctx.globalAlpha=(1-k)*.9;ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-k*.45),0,6.283);ctx.fill();
      }else if(p.kind==="suck"){
        p.x+=(p.tx-p.x)*Math.min(1,st*4.2);
        p.y+=(p.ty-p.y)*Math.min(1,st*4.2);
        if(k>=1||Math.hypot(p.tx-p.x,p.ty-p.y)<3){parts.splice(i,1);continue;}
        ctx.globalAlpha=(1-k)*.95;ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,6.283);ctx.fill();
      }else if(p.kind==="shard"){
        p.x+=p.vx*st;p.y+=p.vy*st;p.vy+=280*st;
        if(k>=1){parts.splice(i,1);continue;}
        ctx.globalAlpha=(1-k)*.9;ctx.fillStyle=p.color;
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot+p.t*6);
        ctx.beginPath();ctx.moveTo(0,-p.size);ctx.lineTo(p.size*.9,p.size*.7);ctx.lineTo(-p.size*.8,p.size*.5);ctx.closePath();ctx.fill();
        ctx.restore();
      }else if(p.kind==="arc"){
        drawArc(p,k);
        if(k>=1)parts.splice(i,1);
      }else if(p.kind==="ring"){
        const rr=p.r0+(p.r1-p.r0)*k;
        ctx.globalAlpha=(1-k)*.8;ctx.strokeStyle=p.color;ctx.lineWidth=p.w*(1-k*.6);
        ctx.beginPath();ctx.arc(p.x,p.y,rr,0,6.283);ctx.stroke();
        if(k>=1)parts.splice(i,1);
      }
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
    if(parts.length){raf=requestAnimationFrame(loop);}
    else{raf=0;ctx.clearRect(0,0,W,H);}
  }
  function drawArc(p,k){
    const prog=Math.min(1,k*2.6),fade=k<.4?1:1-(k-.4)/.6;
    const a1=p.a0+p.span*prog;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
    ctx.globalAlpha=fade*.85;ctx.fillStyle=p.color;
    ctx.beginPath();
    ctx.arc(0,0,p.r,p.a0,a1,false);
    ctx.arc(0,0,Math.max(1,p.r-p.w),a1,p.a0,true);
    ctx.closePath();ctx.fill();
    ctx.globalAlpha=fade;ctx.strokeStyle="#f3ecff";ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(0,0,p.r-p.w*.35,p.a0,a1,false);ctx.stroke();
    ctx.restore();
  }
  function slashBurst(cx,cy,radius,color){
    for(let i=0;i<3;i++){
      addP({kind:"arc",x:cx,y:cy,r:radius*rnd(.62,1),a0:rnd(0,6.283),span:rnd(1.1,1.9),
        rot:rnd(-.5,.5),w:rnd(9,17),life:rnd(.34,.48),color:color||VIOLET});
    }
    addP({kind:"ring",x:cx,y:cy,r0:radius*.25,r1:radius*1.55,w:5,life:.42,color:"#c4b5fd"});
    for(let i=0;i<18;i++){
      const a=rnd(0,6.283),sp=rnd(50,240);
      addP({kind:"spark",x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:rnd(1,2.6),
        life:rnd(.45,.9),color:i%3?VIOLET:"#f3ecff"});
    }
  }
  function ringBurst(x,y,r,color){
    addP({kind:"ring",x,y,r0:r*.2,r1:r,w:6,life:.5,color:color||VIOLET});
    addP({kind:"ring",x,y,r0:r*.15,r1:r*.8,w:2.5,life:.42,color:"#f3ecff"});
  }
  function emberRise(x,y,n,color){
    for(let i=0;i<n;i++){
      addP({kind:"spark",x:x+rnd(-26,26),y:y+rnd(-6,10),vx:rnd(-16,16),vy:rnd(-95,-35),g:-26,
        size:rnd(1.2,3.2),life:rnd(.6,1.15),color:color||VIOLET});
    }
  }
  function suckTo(x,y,n,color){
    for(let i=0;i<n;i++){
      const a=rnd(0,6.283),d=rnd(24,90);
      addP({kind:"suck",x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,tx:x,ty:y,size:rnd(1.2,2.8),
        life:rnd(.55,.95),color:i%4?color||VIOLET:"#f3ecff"});
    }
  }
  function shatter(box,tx,ty){
    for(let i=0;i<46;i++){
      const sx=box.left+rnd(0,box.width),sy=box.top+rnd(0,box.height);
      addP({kind:"suck",x:sx,y:sy,tx:tx+rnd(-8,8),ty:ty+rnd(-8,8),size:rnd(1.2,3),
        life:rnd(.5,.95),color:i%3?VIOLET:"#c4b5fd"});
    }
    for(let i=0;i<14;i++){
      addP({kind:"shard",x:box.cx,y:box.cy,vx:rnd(-220,220),vy:rnd(-260,40),rot:rnd(0,6.28),
        size:rnd(2,5),life:rnd(.45,.8),color:"#8b5cf6"});
    }
  }

  /* ---------- ghost tile + helpers ---------- */
  function rect(el){
    const r=el.getBoundingClientRect();
    return {left:r.left,top:r.top,width:r.width,height:r.height,
      cx:r.left+r.width/2,cy:r.top+r.height/2,bottom:r.bottom};
  }
  function ghost(art,w,h,opts){
    opts=opts||{};
    const d=document.createElement("div");
    d.className="skfx-ghost"+(opts.shadow===false?" king":"");
    d.style.left=opts.x+"px";d.style.top=opts.y+"px";
    d.style.width=w+"px";d.style.height=h+"px";
    if(art)d.style.backgroundImage='url("'+art+'")';
    layer.appendChild(d);
    return d;
  }
  function fly(el,from,to,ms){
    const d=(typeof bsMs==="function")?bsMs(ms||500):(ms||500);
    el.style.transform="translate(0px,0px) scale(1,1)";
    void el.offsetWidth;
    el.style.transition="transform "+d+"ms cubic-bezier(.5,0,.2,1)";
    el.style.transform="translate("+(to.cx-from.cx)+"px,"+(to.cy-from.cy)+"px) scale("+(to.width/from.width)+","+(to.height/from.height)+")";
    return new Promise(r=>setTimeout(r,d));
  }
  function pulseTile(el){
    if(!el)return;
    el.style.animationDuration=(550*sc())+"ms";
    el.classList.remove("skfx-landed");void el.offsetWidth;el.classList.add("skfx-landed");
    setTimeout(()=>{try{el.classList.remove("skfx-landed");el.style.animationDuration="";}catch(e){}},380*sc()+120);
  }
  function fogOn(){if(layer)layer.querySelector(".skfx-vig").classList.add("on");}
  function fogOff(){if(layer)layer.querySelector(".skfx-vig").classList.remove("on");}
  function flashNow(){
    if(!layer)return;
    const f=layer.querySelector(".skfx-flash");
    f.style.animationDuration=(420*sc())+"ms";
    f.classList.remove("on");void f.offsetWidth;f.classList.add("on");
  }
  function sfxCrit(){try{if(window.sfx&&sfx.crit)sfx.crit();}catch(e){}}
  function sfxHit(){try{if(window.sfx&&sfx.hit)sfx.hit();}catch(e){}}
  function hitFx(el){
    if(!el)return;
    el.style.animationDuration=(340*sc())+"ms";
    el.classList.remove("skfx-hit");void el.offsetWidth;el.classList.add("skfx-hit");
    sfxHit();
    setTimeout(()=>{try{el.classList.remove("skfx-hit");el.style.animationDuration="";}catch(e){}},360*sc());
  }
  function playerRail(){
    const me=document.querySelector(".fighter.me");
    const col=me?me.closest(".me-col"):document.querySelector(".me-col:not(.foe-side)");
    return col?col.querySelector(".bench-rail"):null;
  }
  const tilesOf=rail=>rail?[...rail.querySelectorAll(".bench-sq:not(.empty)")]:[];

  /* ---------- 1. ARISE (musuh tumbang -> Shadow baru di rail) ---------- */
  async function arise(o){
    o=o||{};
    const t=begin();
    const foe=document.querySelector(".fighter.foe");
    if(!foe)return;
    const fr=rect(foe);
    if(!fr.width)return;
    const rail=playerRail();
    const shadows=rail?[...rail.querySelectorAll(".bench-sq.shadow-sq")]:[];
    const slot=shadows[shadows.length-1]||null;
    const art=artOf(o.art,o.thumb);
    let g=null;
    try{
      if(slot)slot.classList.add("skfx-pending");
      await wait(180);if(!guard(t))return;
      hitFx(foe);
      slashBurst(fr.cx,fr.cy,fr.height*.55,VIOLET);
      await wait(170);if(!guard(t))return;
      foe.classList.add("skfx-dead");
      await wait(300);if(!guard(t))return;
      emberRise(fr.cx,fr.bottom-14,26,DEEP);
      ringBurst(fr.cx,fr.bottom-18,fr.width*.8,"#8b5cf6");
      sfxCrit();
      await wait(260);if(!guard(t))return;
      g=ghost(art,fr.width,fr.height,{shadow:true,x:fr.left,y:fr.top});
      g.style.clipPath="inset(100% 0 0 0)";
      g.style.transition="clip-path "+(550*sc())+"ms ease-out, opacity .16s ease";
      void g.offsetWidth;
      g.style.opacity="1";g.style.clipPath="inset(0 0 0 0)";
      await wait(540);if(!guard(t))return;
      const tr=slot?rect(slot):null;
      if(tr&&tr.width){
        emberRise(fr.cx,fr.bottom,14,VIOLET);
        await fly(g,fr,tr,620);
        if(!guard(t))return;
        g.remove();g=null;
        slot.classList.remove("skfx-pending");
        pulseTile(slot);
        ringBurst(tr.cx,tr.cy,Math.max(46,tr.width*2.1),VIOLET);
        suckTo(tr.cx,tr.cy,14,VIOLET);
        floatText(slot,"ARISE · SHADOW +1","heal");
      }else{
        g.remove();g=null;
        floatText(".fighter.me","ARISE · SHADOW +1","heal");
      }
    }finally{
      if(g){try{g.remove();}catch(e){}}
      if(foe)foe.classList.remove("skfx-dead");
      if(slot)slot.classList.remove("skfx-pending");
    }
  }

  /* ---------- 2. SHADOW EXCHANGE (King "mati" -> Shadow maju, King ke belakang) ---------- */
  async function exchange(o){
    o=o||{};
    const t=begin();
    const meEl=o.meEl||document.querySelector(".fighter.me");
    if(!meEl)return;
    const from=o.fromRect||(o.fromEl&&o.fromEl.isConnected?rect(o.fromEl):null);
    const me=rect(meEl);
    const kingTile=o.kingTile&&o.kingTile.isConnected?o.kingTile:null;
    let kg=null,sg=null;
    try{
      if(kingTile)kingTile.classList.add("skfx-pending");
      meEl.classList.remove("tag-enter");
      hitFx(meEl);
      await wait(150);if(!guard(t))return;
      meEl.classList.add("skfx-dead");
      await wait(380);if(!guard(t))return;
      meEl.style.transition="opacity .12s linear";
      meEl.style.opacity="0";
      fogOn();flashNow();
      slashBurst(me.cx,me.cy,me.height*.5,VIOLET);
      slashBurst(me.cx,me.cy,me.height*.34,"#f3ecff");
      sfxCrit();
      await wait(180);if(!guard(t))return;
      kg=ghost(artOf(o.kingArt,o.kingThumb),me.width,me.height,{shadow:false,x:me.left,y:me.top});
      kg.style.opacity="1";
      if(from){
        sg=ghost(artOf(o.shadowArt,o.shadowThumb),from.width,from.height,{shadow:true,x:from.left,y:from.top});
        sg.style.opacity="1";
      }
      suckTo(me.cx,me.cy,22,DEEP);
      const dest=kingTile&&kingTile.isConnected?rect(kingTile):null;
      await Promise.all([
        sg&&from?fly(sg,from,me,520):Promise.resolve(),
        dest?fly(kg,me,dest,540):Promise.resolve()
      ]);
      if(!guard(t))return;
      if(sg){sg.remove();sg=null;}
      if(kg){kg.remove();kg=null;}
      meEl.style.opacity="";meEl.style.transition="";
      enterFx(meEl);
      if(kingTile){kingTile.classList.remove("skfx-pending");pulseTile(kingTile);}
      ringBurst(me.cx,me.cy,Math.max(60,me.width*1.2),CYAN);
      if(dest)ringBurst(dest.cx,dest.cy,Math.max(50,dest.width*2.2),VIOLET);
      suckTo(me.cx,me.cy,14,VIOLET);
      floatText(meEl,"SHADOW EXCHANGE","crit");
    }finally{
      if(sg){try{sg.remove();}catch(e){}}
      if(kg){try{kg.remove();}catch(e){}}
      try{meEl.style.opacity="";meEl.style.transition="";meEl.classList.remove("skfx-dead");}catch(e){}
      if(kingTile)kingTile.classList.remove("skfx-pending");
      fogOff();
    }
  }

  /* ---------- 3. LEGION ABSORB (Shadow tumbang -> stat-nya ditarik ke King) ---------- */
  async function absorb(o){
    o=o||{};
    const t=begin();
    const meEl=o.meEl||document.querySelector(".fighter.me");
    const toEl=o.toEl&&o.toEl.isConnected?o.toEl:null;
    if(!meEl)return;
    const from=rect(meEl);
    const to=toEl?rect(toEl):null;
    try{
      meEl.classList.add("skfx-quake");
      slashBurst(from.cx,from.cy,from.height*.42,VIOLET);
      sfxCrit();
      await wait(240);if(!guard(t))return;
      shatter(from,to?to.cx:from.cx,to?to.cy:from.cy);
      ringBurst(from.cx,from.cy,from.width*1.15,"#8b5cf6");
      meEl.style.transition="opacity "+(400*sc())+"ms ease, transform "+(400*sc())+"ms ease, filter "+(400*sc())+"ms ease";
      meEl.style.opacity="0";meEl.style.transform="scale(.9)";meEl.style.filter="grayscale(1) brightness(.4)";
      await wait(340);if(!guard(t))return;
      meEl.classList.remove("skfx-quake");
      if(to&&toEl){
        pulseTile(toEl);
        ringBurst(to.cx,to.cy,Math.max(46,to.width*2.3),VIOLET);
        suckTo(to.cx,to.cy,18,VIOLET);
        floatText(toEl,"LEGION ATK +"+fmt(o.atk||0),"crit");
        await wait(160);if(!guard(t))return;
        floatText(toEl,"LEGION HP +"+fmt(o.hp||0),"heal");
      }else{
        floatText(meEl,"LEGION ATK +"+fmt(o.atk||0),"crit");
        await wait(160);if(!guard(t))return;
        floatText(meEl,"LEGION HP +"+fmt(o.hp||0),"heal");
      }
    }finally{
      try{meEl.classList.remove("skfx-quake");meEl.style.transition="";meEl.style.opacity="";meEl.style.transform="";meEl.style.filter="";}catch(e){}
    }
  }

  window.skfxArise=arise;
  window.skfxExchange=exchange;
  window.skfxAbsorb=absorb;
})();
