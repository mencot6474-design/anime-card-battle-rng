/* =============== BATTLE =============== */
let bt=null;
/* Token generasi GLOBAL — bukan per-battle, supaya cb basi dari battle sebelumnya gak pernah cocok lagi */
let FGEN=0;
/* ===== BATTLE SPEED: multiplier pacing seluruh engine battle (cerita + Infinite Tower).
   Semua jeda dijadwalkan lewat schedPhase()/bsMs(ms) → dibagi bt.speed. bt.speed dibekukan per battle
   dari battleSpeedEff() (state.battleSpeed; terkunci level: LV25→2x, LV50→3x, LV100→4x).
   Skala linear → urutan antar-timeout di dalam satu fase tetap aman. ===== */
function battleSpeedMax(){const lv=(state&&state.playerLv)||1;return lv>=100?4:lv>=50?3:lv>=25?2:1;}
function battleSpeedEff(){let s=(state&&state.battleSpeed)||1;if(s<1)s=1;const m=battleSpeedMax();return Math.min(Math.floor(s),m);}
function bsMs(ms){const m=(bt&&bt.speed)||1;return m<=1?ms:Math.max(0,Math.round(ms/m));}
/* Tombol speed in-battle (di .vs-col): cycle 1x→2x→3x→4x→1x — hanya tier yang sudah terbuka per level.
   Efek langsung ke bt.speed (timeout berikutnya) + persist state.battleSpeed (ikut ke settings & battle berikut). */
function wireSpeedBtn(){
  const b=document.getElementById("bspeedBtn");
  if(!b)return;
  const upd=()=>{
    const m=battleSpeedMax();
    const sp=battleSpeedEff();
    b.textContent=sp+"×";
    b.disabled=m<=1;
    b.title=m<=1?"Battle speed terbuka di LV 25":("SPEED "+sp+"× · LV "+(state.playerLv||1)+" — tap untuk ganti");
  };
  upd();
  b.onclick=()=>{
    const m=battleSpeedMax();if(m<=1)return;
    const cur=(state.battleSpeed>=1&&state.battleSpeed<=m)?Math.floor(state.battleSpeed):1;
    state.battleSpeed=cur>=m?1:cur+1;
    save();
    if(bt)bt.speed=battleSpeedEff();
    upd();
  };
}
function meFighterHtml(s){
  const st=cardStats(s.char,s.mut,s.trait,s.shiny);
  const mut=(s.mut&&s.mut!=="none")?s.mut:null;
  const trait=(s.trait&&s.trait!=="none")?s.trait:null;
  return `<div class="f-banner"><img src="${cardImg(s.char)}" alt="${cardName(s.char)}"${CARDS[s.char]&&CARDS[s.char].pos?` style="object-position:${CARDS[s.char].pos}"`:''}>${shinyName('div','f-name','f-name-shine',mut,s.shiny,cardName(s.char))}<span class="hc-chance">1 in ${fmtChance(luckChance(s.char,s.mut,s.shiny))}</span>
    ${(s.shiny||mut||trait)?`<div class="f-badges">${s.shiny?'<span class="shiny-badge">SHINY</span>':''}${mut?mutChip(mut,`<span class="mut-badge" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="hc-trait hc-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(14,trait)}</span>`):''}</div>`:""}
    </div>
    <div class="hpbar"><i id="hpMe"></i><span id="hpMeT">${fmt(st.hp)} / ${fmt(st.hp)}</span></div>
    <div class="f-body">
      <div class="f-title">${cardType(s.char)}</div>
      <div class="f-skill">${passiveName(s.char)}</div>
      <div class="stat-row"><div class="stat">♡ ${fmt(st.hp)}</div><div class="stat">${ATKIC} ${fmt(st.atk)}</div></div>
    </div>`;
}
function meShadowHtml(sh){return `<div class="f-banner"><img src="${sh.img}" alt="${sh.name}" style="filter:grayscale(.35) brightness(.72) hue-rotate(215deg) saturate(1.5)"><div class="f-name" style="color:#c4b5fd">SHADOW · ${sh.name}</div><span class="hc-chance">ARISE · ${sh.turnsLeft} giliran</span></div>
    <div class="hpbar"><i id="hpMe"></i><span id="hpMeT">${fmt(sh.maxHp)} / ${fmt(sh.maxHp)}</span></div>
    <div class="f-body"><div class="f-title">Bayangan</div><div class="f-skill">ARISE</div><div class="stat-row"><div class="stat">&#9825; ${fmt(sh.maxHp)}</div><div class="stat">${ATKIC} ${fmt(sh.atk)}</div></div></div>`;}
/* Bayangan jatuh / giliran habis → Monarch kembali ke slot dengan HP aslinya (tak tersentuh selama possess). */
function endPossession(){
  if(!bt||!bt.shadow)return;
  const s=bt.shadow;bt.shadow=null;
  bt.pHp=s.retHp;bt.pMax=s.retMax;
  updateMeCard();setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MONARCH RETURNS","heal");},200);
}
function updateMeCard(){if(!bt)return;const f=document.querySelector(".fighter.me");if(f){if(bt.shadow){f.className="fighter me shadow-fighter";f.dataset.tier="EX";f.dataset.char="";f.style.borderColor="#7c3aed";f.innerHTML=meShadowHtml(bt.shadow);return;}f.className="fighter me"+mutGlow(bt.eq.mut)+shinyCls(bt.eq);f.dataset.tier=bt.eq.tier;f.dataset.char=bt.eq.char;f.style.borderColor=bt.eq.mut&&bt.eq.mut!=="none"?MUT_COLOR[bt.eq.mut]:"";f.innerHTML=meFighterHtml(bt.eq);}}
function benchTile(s){
  return `<div class="bench-sq" data-tier="${s.tier}" style="border-color:${TIER_COLOR[s.tier]}" title="${cardName(s.char)}"><img src="${cardImg(s.char)}" alt="${cardName(s.char)}"><span class="bhp"><i style="width:100%"></i></span></div>`;
}
/* Rail cadangan = 3 kotak gambar sejajar (sisa dek setelah fighter aktif), ditambal placeholder biar tetap 3. */
function benchRailHtml(remaining){
  const list=remaining||[];
  let html="";
  for(let i=0;i<3;i++) html += i<list.length ? benchTile(list[i]) : `<div class="bench-sq empty"></div>`;
  return `<div class="bench-rail">${html}</div>`;
}
/* Bench = kartu dek yang BELUM bertanding (setelah fighter aktif). Saat render awal bt belum ada → pakai equippedList. */
function benchHtml(){
  const list=(bt&&bt.fighters)?bt.fighters.slice(bt.active+1):equippedList().slice(1);
  return benchRailHtml(list);
}
function renderBattle(){
  const lv=state.battle.level,en=enemyOf(lv),es=enemyStats(lv);
  const eq=equipped(),st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  app.innerHTML=`
  <div class="battle-grid">
  <div class="me-col">
    <div class="fighter me${eq?mutGlow(eq.mut):''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}"${eq?mutEdge(eq.mut):''}>${meFighterHtml(eq)}</div>
    ${benchHtml()}
  </div>
  <div class="vs-col"><div class="t">VS</div><div class="s" id="turnLabel">AUTO<br>BATTLE</div><button class="bspeed-btn" id="bspeedBtn" type="button">1×</button></div>
  <div class="me-col foe-side">
    <div class="fighter foe${mutGlow(diffOf().mut)}" data-tier="${en.tier||''}"${mutEdge(diffOf().mut)}>
      <div class="f-banner"><img src="${en.img}" alt="${en.name}"><div class="f-name">${en.name}</div>${diffOf().mut!=="none"?`<div class="f-badges">${mutChip(diffOf().mut,`<span class="fbadge" style="border-color:${MUT_COLOR[diffOf().mut]};color:${MUT_COLOR[diffOf().mut]}">${mutBadge(diffOf().mut)}</span>`)}</div>`:""}
        </div>
      <div class="hpbar"><i id="hpFoe"></i><span id="hpFoeT">${fmt(es.hp)} / ${fmt(es.hp)}</span></div>
      <div class="f-body">
        <div class="f-title">${en.epithet}</div>
        <div class="f-skill">${en.id?passiveName(en.id):"Musuh"}</div>
        <div class="stat-row"><div class="stat">♡ ${fmt(es.hp)}</div><div class="stat">${ATKIC} ${fmt(es.atk)}</div></div>
      </div>
    </div>
    ${benchRailHtml([])}
  </div>
  </div>`;
  wireSpeedBtn();
  playFight(startBattle);
}
function floatText(sel,txt,cls){
  const f=document.querySelector(sel);if(!f)return;
  const r=f.getBoundingClientRect();if(!r.width)return;
  let l=document.getElementById("dmgLayer");
  if(!l){l=document.createElement("div");l.id="dmgLayer";document.body.appendChild(l);}
  const d=document.createElement("div");
  d.className="dmg-float"+(cls?" "+cls:"");d.textContent=txt;
  d.style.left=(r.left+r.width/2)+"px";d.style.top=(r.top-28)+"px";
  l.appendChild(d);setTimeout(()=>d.remove(),950);
}
function anim(sel,cls,noPair){
  const el=document.querySelector(sel);if(!el)return;
  const pulse=(e)=>{e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls);setTimeout(()=>e.classList.remove(cls),520);};
  pulse(el);
}
/* ---------- GALAXY ROAR (Eternal Dragon): charge bola beku -> sembur laser es -> ledakan percikan beku ----------
   Semua timing dibaca dari GALAXY supaya mesin battle (schedPhase / raid.timer / dlyAt) dan
   animasinya tidak saling lepas: kerusakan & getar kartu jatuh tepat di menit GALAXY.hit. */
const GALAXY={chg:520,hit:900,total:2100};
/* Madara Tensa: video Susanoo full-screen di belakang kartu + HUJAN TEBASAN samurai (garis lurus satu layar penuh, kiri→kanan) */
let MADARA_T={wind:280,slash:520,step:120,total:2760};
/* satu tebasan lurus: garis SELEBAR layar penuh (menembus dua tepi), miring random tipis, lewat di sekitar kartu target */
function startBattle(){
  const lv=state.battle.level,en=enemyOf(lv),es=enemyStats(lv);
  const fighters=equippedList();if(!fighters.length)fighters.push(equipped());
  const eq=fighters[0],base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  const eid=en.id||null;
  let efx=eid?(PASSIVE_FX[eid]||{}):{};
  /* SHARINGAN COPY sbg lawan (Kakashi): sekali di awal battle, salin seluruh passive kartu pemain */
  if(efx.copy){const own={...efx};delete own.copy;efx=Object.assign({},fxOf(eq)||{},own);delete efx.copy;}
  if(bt&&bt.timer)clearTimeout(bt.timer);
  bt={speed:battleSpeedEff(),fgen:++FGEN,lv,en,es,eq,fighters,eid,efx,active:0,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:es.hp,turn:1,over:false,eBurn:0,ePoison:0,pGuardDr:0,eAbilityOff:0,voidUsed:false,pCopyFx:null,spCd:[],spTurn:[],spArmed:[],spWave:[],meteorGuard:[],phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),shatterGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),rumbling:0,rumblingPct:0,defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),aftermath:false,gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,psychic:null,atkEntryGuard:new Array(fighters.length).fill(false),sleepLeft:new Array(fighters.length).fill(0),sleepArmed:new Array(fighters.length).fill(false),overflow:0,rain:null,freezeLeft:0,shockCount:new Array(fighters.length).fill(0),shadow:null,freezeNext:false,valhallaLeft:0,paintHits:[],eInk:0,eInkPct:0,wc:null,rearIdx:-1,rearWaiting:false,rearUsed:[],senzu:{},senzuFin:false,balloon:0,stretchShot:0,turret:0,hvCount:new Array(fighters.length).fill(0),excited:false,weCount:new Array(fighters.length).fill(0),weRevived:false,pbRocks:0,pbKey:"",pbStreak:0,rubber:false,rbBounce:0,dizzyStack:0,dizzyLeft:0};
  // BURST: kartu pertama masuk arena langsung dapat boost HP kalau punya fx.burst
  const fx0=resolveFx(eq,efx);
  if(fx0.burst){bt.pMax=Math.round(base.hp*fx0.burst.mult);bt.pHp=bt.pMax;}
  if(fx0.transform){bt.pMax=Math.round(base.hp*fx0.transform.mult);bt.pHp=bt.pMax;}
  if(fx0.entryCounter)bt.entryGuard[0]=true;
  if(fx0.executeOnEntry)bt.execGuard[0]=true;
  if(fx0.entryShatter)bt.shatterGuard[0]=true;
  if(fx0.entryMaxHp)bt.bioGuard[0]=true;
  if(fx0.meteorWave)bt.meteorGuard[0]=true;
  if(fx0.entryAtkPct)bt.atkEntryGuard[0]=true;
  armShotFx(fx0,0);partyDmgApply(fx0);
  if(fx0.psychicBarrier)bt.psychic={left:fx0.psychicBarrier.turns,dr:fx0.psychicBarrier.dr,healPct:fx0.psychicBarrier.healPct};
  if(fx0.sleepStrike){bt.sleepLeft[0]=fx0.sleepStrike.turns;bt.sleepArmed[0]=true;}
   if(fx0.entryFreeze&&!foeStatusImmune()){bt.eStun=fx0.entryFreeze.turns;bt.freezeLeft=fx0.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
   if(fx0.heavyRain)bt.rain={left:fx0.heavyRain.turns,healPct:fx0.heavyRain.healPct};
   if(fx0.timeStop&&!foeStatusImmune()){bt.eStun=fx0.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
  if(fx0.dimensionShift){bt.eAbilityOff=fx0.dimensionShift.turns;setTimeout(()=>floatText(".fighter.foe","AMENOMINAKA","crit"),bsMs(300));}
bt.pGuardDr=(fx0&&fx0.puppetBody)?fx0.puppetBody.dr:((fx0&&fx0.autoBlock)?fx0.autoBlock.pct:0);
if(fx0.valhalla){bt.valhallaLeft=fx0.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(fx0.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(fx0.turret)bt.turret=fx0.turret.start;
bt.rubber=!!(fx0&&fx0.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(fx0.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(fx0.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(fx0.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:fx0.worldCorrupt.every,pct:fx0.worldCorrupt.pct,dmgUp:fx0.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  bt.fighters.forEach((f,i)=>{const x=resolveFx(f,efx);if(x.splitDeath)bt.splitLeft[i]=x.splitDeath.times;});
  schedPhase(700,step);
}
function tagIn(){
  const next=bt.active+1;
  if(next>=bt.fighters.length)return false;
  bt.active=next;bt.eq=bt.fighters[next];bt.justTagged=true;
  const base=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
  bt.pMax=base.hp+(bt.snatchHp[next]||0);bt.pHp=bt.pMax;
  bt.burstStart[next]=bt.turn;
  bt.entryGuard[next]=false;bt.dodgeArmed[next]=false;bt.dodgeCount[next]=0;bt.execGuard[next]=false;bt.wtCount[next]=0;bt.shatterGuard[next]=false;bt.bioGuard[next]=false;
  const nfx=resolveFx(bt.eq,bt.efx);
  if(nfx.burst){bt.pMax=Math.round(base.hp*nfx.burst.mult);bt.pHp=bt.pMax;}
  if(nfx.transform){bt.pMax=Math.round(base.hp*nfx.transform.mult);bt.pHp=bt.pMax;}
  if(nfx.entryCounter)bt.entryGuard[next]=true;
  if(nfx.executeOnEntry)bt.execGuard[next]=true;
  if(nfx.entryShatter)bt.shatterGuard[next]=true;
  if(nfx.entryMaxHp)bt.bioGuard[next]=true;
  if(nfx.meteorWave)bt.meteorGuard[next]=true;
  if(nfx.entryAtkPct)bt.atkEntryGuard[next]=true;
  armShotFx(nfx,next);
  if(nfx.psychicBarrier)bt.psychic={left:nfx.psychicBarrier.turns,dr:nfx.psychicBarrier.dr,healPct:nfx.psychicBarrier.healPct};
  if(nfx.sleepStrike){bt.sleepLeft[next]=nfx.sleepStrike.turns;bt.sleepArmed[next]=true;}
   if(nfx.entryFreeze&&!foeStatusImmune()){bt.eStun=nfx.entryFreeze.turns;bt.freezeLeft=nfx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
   if(nfx.heavyRain)bt.rain={left:nfx.heavyRain.turns,healPct:nfx.heavyRain.healPct};
   if(nfx.timeStop&&!foeStatusImmune()){bt.eStun=nfx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
bt.pGuardDr=(nfx&&nfx.puppetBody)?nfx.puppetBody.dr:((nfx&&nfx.autoBlock)?nfx.autoBlock.pct:0);
if(nfx.valhalla){bt.valhallaLeft=nfx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(nfx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(nfx.turret)bt.turret=nfx.turret.start;
bt.rubber=!!(nfx&&nfx.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(nfx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(nfx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(nfx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:nfx.worldCorrupt.every,pct:nfx.worldCorrupt.pct,dmgUp:nfx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  // fase 1: kartu aktif sekarang tumbang
  const meEl=document.querySelector(".fighter.me");
  if(meEl){meEl.classList.remove("tag-enter");meEl.classList.add("ko");koFx(meEl);}
  floatText(".fighter.me","KO","crit");
  // fase 2: kartu dek berikutnya naik masuk arena; rail bench diperbarui ke sisa setelahnya
  setTimeout(()=>{
    if(!bt||bt.over)return;
    const me2=document.querySelector(".fighter.me");
    if(me2)me2.classList.remove("ko");
    updateMeCard();
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    const rail=document.querySelector(".bench-rail");if(rail)rail.outerHTML=benchRailHtml(bt.fighters.slice(bt.active+1));
    const me3=document.querySelector(".fighter.me");
    if(me3){me3.classList.add("tag-enter");enterFx(me3);setTimeout(()=>me3.classList.remove("tag-enter"),650);}
    floatText(".fighter.me","TAG-IN!","heal");
  },bsMs(2000));
  return true;
}
function trySave(){
  /* Guard cb basi: panggilan stale (timer lama / battle mati) atau HP masih penuh → jangan proses kematian */
  if(!bt||bt.over||bt.pHp>0)return true;
  /* BAYANGAN JATUH: yang mati cuma summoned shadow — Monarch balik utuh, bukan tag-in/kalah */
  if(bt.shadow){endPossession();return true;}
  const a=bt.active,fx=resolveFx(bt.eq,bt.efx);
  /* REGRESSION (Regressor): mati TAPI punya kill tersimpan → bangkit di hpPct% max HP, habisin 1 charge,
     & "skill di-refresh": semua flag sekali-per-battle/window kartu ini di-reset biar balik kayak baru */
  if(fx.regression&&(bt.regressCharges[a]||0)>0){
    bt.regressCharges[a]--;
    bt.pHp=Math.max(1,Math.round(bt.pMax*fx.regression.hpPct/100));
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;bt.weRevived=false;bt.pbRocks=0;bt.pbKey="";bt.pbStreak=0;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;bt.shockCount[a]=0;
    if(fx.entryCounter)bt.entryGuard[a]=true;
    if(fx.executeOnEntry)bt.execGuard[a]=true;
    if(fx.entryShatter)bt.shatterGuard[a]=true;
    if(fx.entryMaxHp)bt.bioGuard[a]=true;
    if(fx.meteorWave)bt.meteorGuard[a]=true;
    if(fx.entryAtkPct)bt.atkEntryGuard[a]=true;
    armShotFx(fx,a);
    if(fx.psychicBarrier)bt.psychic={left:fx.psychicBarrier.turns,dr:fx.psychicBarrier.dr,healPct:fx.psychicBarrier.healPct};
    if(fx.sleepStrike){bt.sleepLeft[a]=fx.sleepStrike.turns;bt.sleepArmed[a]=true;}
     if(fx.entryFreeze&&!foeStatusImmune()){bt.eStun=fx.entryFreeze.turns;bt.freezeLeft=fx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
     if(fx.heavyRain)bt.rain={left:fx.heavyRain.turns,healPct:fx.heavyRain.healPct};
     if(fx.timeStop&&!foeStatusImmune()){bt.eStun=fx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
bt.pGuardDr=(fx&&fx.puppetBody)?fx.puppetBody.dr:((fx&&fx.autoBlock)?fx.autoBlock.pct:0);
if(fx.valhalla){bt.valhallaLeft=fx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(fx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(fx.turret)bt.turret=fx.turret.start;
bt.rubber=!!(fx&&fx.rubberField);
if(fx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(fx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(fx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:fx.worldCorrupt.every,pct:fx.worldCorrupt.pct,dmgUp:fx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGRESSION","heal");},bsMs(400));
    return true;
  }
  /* SPLIT DEATH (BIOKINESIS): mati TAPI charge terbelah masih ada -> badan baru pct% stat (kumulatif),
     HP penuh di max baru, ATK menyusut via bt.splitMult. Flag sekali-per-battle di-refresh kayak regression,
     TAPI efek "saat masuk" TIDAK re-arm (biar entry damage gak triple-dip tiap split). */
  if(fx.splitDeath&&(bt.splitLeft[a]||0)>0){
    bt.splitLeft[a]--;
    bt.splitMult[a]=(bt.splitMult[a]||1)*fx.splitDeath.pct/100;
    bt.pMax=Math.max(1,Math.round(bt.pMax*fx.splitDeath.pct/100));
    bt.pHp=bt.pMax;
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;bt.weRevived=false;bt.pbRocks=0;bt.pbKey="";bt.pbStreak=0;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;bt.shockCount[a]=0;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SPLIT!","heal");},bsMs(400));
    return true;
  }
  /* V-DRIVE RESONANCE (TIME TRICKSTER): mati -> bangkit pct% max HP (sekali) + damage musuh sejumlah heal itu + stun */
  if(fx.rewind&&!bt.revUsed[a]){
    bt.revUsed[a]=true;
    const rh=Math.max(1,Math.round(bt.pMax*fx.rewind.pct/100));
    bt.pHp=Math.min(bt.pMax,rh);
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    if(bt.eHp>0){
      bt.eHp-=rh;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","REWIND -"+fmt(rh),"crit");}},bsMs(420));
    }
    if(fx.rewind.stun&&!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.rewind.stun);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","REWOUND!","crit");},bsMs(560));}
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","V-DRIVE RESONANCE +"+fmt(rh),"heal");},bsMs(300));
    return true;
    }
  /* THE WORLD ENDER (DARKIN LORD): kematian PERTAMA -> revive penuh + DR 40% permanen + heal bonus */
  if(fx.worldEnder&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=bt.pMax;bt.weRevived=true;
    bt.pDr=Math.max(bt.pDr||0,fx.worldEnder.revive.dr);bt.pDrTurns=9999;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>floatText(".fighter.me","THE WORLD ENDER","crit"),bsMs(400));
    return true;
  }
  /* PSYCHIC OVERLOAD (PSYCHIC ESPER): kematian PERTAMA -> full HP + 10 batu per serangan */
  if(fx.psychicBarrage&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=bt.pMax;bt.pbRocks=fx.psychicBarrage.reviveRocks;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>floatText(".fighter.me","PSYCHIC OVERLOAD","crit"),bsMs(400));
    return true;
  }
  if(fx.revive&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=(fx.revive.pct!=null)?Math.max(1,Math.round(bt.pMax*fx.revive.pct/100)):bt.pMax;if(fx.revive.atkPct)bt.atkBuff[a]+=fx.revive.atkPct;
    if(fx.revive.lock){bt.eAbilityOff=Math.max(bt.eAbilityOff||0,fx.revive.lock);setTimeout(()=>floatText(".fighter.foe","ALTER THE FUTURE","crit"),bsMs(600));}
    setTimeout(()=>floatText(".fighter.me","REVIVE!","heal"),bsMs(400));
    if(fx.revive.stun&&!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.revive.stun);setTimeout(()=>floatText(".fighter.foe","INK DEMON STUN","crit"),bsMs(520));}
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    return true;
  }
  /* LAST STAND: fatal pertama ditahan di 1 HP (bukan bangkit penuh) + langsung dapat bonus ATK */
  if(fx.lastStand&&!bt.standUsed[a]){
    bt.standUsed[a]=true;bt.pHp=1;bt.atkBuff[a]+=fx.lastStand.pct;
    setTimeout(()=>floatText(".fighter.me","1% AWAKENED","crit"),bsMs(400));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    return true;
  }
  /* PRIDE OF THE PRINCE: kartu party ini beneran jatuh (revive/lastStand gak nolong) → semua Royal Vanguard di party +pct% ATK permanen (stack di atkBuff, kepakai pas dia masuk/aktif) */
  for(let i=0;i<bt.fighters.length;i++){const pfx=resolveFx(bt.fighters[i],bt.efx);if(pfx.prideOfPrince)bt.atkBuff[i]=(bt.atkBuff[i]||0)+pfx.prideOfPrince.pct;}
  /* RUMBLING: kartu ini beneran tumbang (revive/lastStand gak nolong) → nyalain DoT post-mortem */
  if(fx.rumbling){bt.rumbling=fx.rumbling.turns;bt.rumblingPct=fx.rumbling.pct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","THE RUMBLING","burn");},bsMs(600));}
  /* DEATH HEX (ICE REAPER): beneran tumbang -> freeze turns + ePoison atkCut */
  if(fx.deathHex){
    if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.deathHex.turns);bt.freezeLeft=Math.max(bt.freezeLeft||0,fx.deathHex.turns);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","HAKKA NO TOGAME · BEKU","crit");},bsMs(520));}
    bt.ePoison=Math.min(90,(bt.ePoison||0)+fx.deathHex.atkCut);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","-"+fx.deathHex.atkCut+"% ATK PERMANEN","burn");},bsMs(640));
  }
  /* DEATH REAR (THE GRIEFER): mati PERTAMA kali -> remove dari rotasi sekarang, nunggu balik di belakang party */
  if(fx.deathRear&&!bt.rearUsed[a]){
    bt.rearUsed[a]=true;bt.rearIdx=a;bt.rearWaiting=true;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REMOVED FROM LINE","miss");},bsMs(400));
  }
  if(a+1<bt.fighters.length){tagIn();return true;}
  /* LAST CARD MATI tapi Rumbling masih jalan → jangan langsung kalah; masuk mode aftermath (DoT tick doang) */
  if(bt.rumbling>0){bt.aftermath=true;return true;}
  /* REAR RETURN (THE GRIEFER): rantai party habis -> balik sebagai kartu terakhir dgn hpPct% HP */
  if(bt.rearWaiting&&bt.rearIdx>=0){
    const ri=bt.rearIdx;bt.rearWaiting=false;
    const rfx=resolveFx(bt.fighters[ri],bt.efx);
    bt.active=ri;bt.eq=bt.fighters[ri];bt.justTagged=true;
    const rbase=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
    bt.pMax=rbase.hp+(bt.snatchHp[ri]||0);
    bt.pHp=Math.max(1,Math.round(bt.pMax*((((rfx.deathRear||{}).hpPct)||50)/100)));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","WORLD REWIND!","heal");},bsMs(400));
    return true;
  }
  return false;
}
function setBar(id,tid,cur,max){
  const b=document.getElementById(id);if(!b)return;
  b.style.width=Math.max(0,cur/max*100)+"%";
  const t=tid?document.getElementById(tid):null;if(t)t.textContent=fmt(Math.max(0,cur))+" / "+fmt(max);
}
function step(){ if(!bt||bt.over)return; schedPhase(0,playerPhase); }
// Safe scheduler: guarantees the battle can never hang. If a phase throws,
// the chain is broken (no next timer) — so we force an end instead of freezing.
function schedPhase(ms,fn){
  if(!bt)return;
  clearTimeout(bt.timer);/* timer basi dibatalkan: schedule terakhir menang — cegah rantai giliran dobel */
  bt.timer=setTimeout(()=>{
    bt.timer=null;
    try{ fn(); }
    catch(err){
      console.error("battle phase error",err);
      if(bt&&!bt.over){ bt.timer=null; endBattle(bt.eHp<=0); }
    }
  },bsMs(ms));
}
/* ===== Renderer serangan SATU untuk semua kartu: user & musuh tinggal tukar sisi (A=penyerang, D=target) ===== */
function attackLunge(sel,wind){const foe=sel===".fighter.foe";anim(sel,wind?(foe?"windlunge-l":"windlunge-r"):(foe?"lunge-l":"lunge-r"));}
/* ===== JUICE serangan generik (prototipe attack-fx) — HANYA kartu normal, jalur ULT/galaxy gak disentuh ===== */
function shakeScreen(big){const g=document.querySelector(".battle-grid");if(!g)return;const cls=big?"shk-big":"shk";g.classList.remove("shk","shk-big");void g.offsetWidth;g.classList.add(cls);setTimeout(()=>g.classList.remove(cls),big?460:300);}
function hitStop(ms){const g=document.querySelector(".battle-grid");if(!g)return;g.classList.add("hitstop");setTimeout(()=>g.classList.remove("hitstop"),ms||90);}
function speedLines(big){let l=document.getElementById("speedLayer");if(!l){l=document.createElement("div");l.id="speedLayer";document.body.appendChild(l);}l.className=big?"crit":"";const n=big?14:8;for(let i=0;i<n;i++){const s=document.createElement("span");s.className="spd-line";s.style.top=(Math.random()*100).toFixed(1)+"%";s.style.animationDelay=(Math.random()*.08).toFixed(2)+"s";l.appendChild(s);}setTimeout(()=>{l.innerHTML="";},520);}
/* ===== MASUK / MATI kartu (prototipe card-enter-death) — di-inject, markup kartu gak diubah ===== */
function enterFx(el){if(!el)return;const fx=document.createElement("div");fx.className="enter-fx";fx.innerHTML='<span class="ef-flash"></span><span class="ef-sheen"></span>';el.appendChild(fx);setTimeout(()=>{try{fx.remove();}catch(e){}},900);const r=el.getBoundingClientRect();const ring=document.createElement("div");ring.className="shock-ring";ring.style.left=(r.left+r.width/2)+"px";ring.style.top=(r.top+r.height*0.92)+"px";document.body.appendChild(ring);setTimeout(()=>{try{ring.remove();}catch(e){}},700);}
function koFx(el){if(!el)return;for(let i=0;i<14;i++){const s=document.createElement("span");s.className="ko-shard";s.style.left=(30+Math.random()*40).toFixed(0)+"%";s.style.top=(30+Math.random()*40).toFixed(0)+"%";s.style.setProperty("--sx",(Math.random()*260-130).toFixed(0)+"px");s.style.setProperty("--sy",(Math.random()*220+20).toFixed(0)+"px");s.style.setProperty("--sr",(Math.random()*720-360).toFixed(0)+"deg");s.style.animationDelay=(Math.random()*.12).toFixed(2)+"s";el.appendChild(s);setTimeout(()=>{try{s.remove();}catch(e){}},950);}const st=document.createElement("div");st.className="ko-stamp";st.textContent="K.O.";document.body.appendChild(st);setTimeout(()=>{try{st.remove();}catch(e){}},760);}
function performAttack(o){
  const A=o.A,D=o.D,id=o.id,shots=o.shots;
  const md=o.ranton&&id==="CH_EX_MADARA";
  /* Galaxy Roar = SATU sambaran (waktu damage dipindah ke menit FX); Madara Tensa = HUJAN 15 tebasan,
     tiap sambaran dijadaki MADARA_T.step supaya angka + getar mendarat bareng garisnya. */
  const galaxy=!!o.galaxy;
  const ultBarrage=(o.domainStrike||o.ariseMode||md);
  /* ARISE sengaja TIDAK ikut grid 80ms domain/shrine: 9 sambaran di 80ms cuma kebaca satu getar panjang.
     Pakai ritme sambaran normal (160ms) → 9 hit = 1,28s, masih muat di jendela fase ARISE (2,2s). */
  const hstep=o.domainStrike?80:160;
  const hoff=galaxy?0:md?40:(o.domainStrike||o.ariseMode)?60:500;
  /* Bar dicicil PROPORSIONAL terhadap total damage: damage yang melebihi HP target (one-hit kill)
     tetap tampil nguras dari penuh sampai 0, bukan nyangkut di 100% lalu langsung kosong. */
  const startHp=Math.max(0,Math.min(o.defMax,o.defHpStart));
  const endHp=Math.max(0,o.defHpEnd);
  const span=Math.max(0,startHp-endHp);
  const hpAt=(cum)=>o.total>0?Math.max(endHp,Math.round(startHp-span*Math.min(1,cum/o.total))):endHp;
  const wind=!(ultBarrage||galaxy);
  attackLunge(A,wind);
  if(wind)setTimeout(()=>{if(bt&&!bt.over)swing();},bsMs(120));
  setTimeout(()=>{
    if(!bt)return;
    const self=(o.domainStrike?o.fx.domain:o.ariseMode?o.fx.barrage:null);
    if(self&&self.selfStun&&o.recharge)o.recharge(self);
    /* jurus hujan tebasan MILIK Madara saja — kartu lain (termasuk UR) gak boleh nyomot animasi EX cuma karena punya flag ranton */
    const susStart=(o.ranton&&id==="CH_EX_MADARA"&&!bt.over)?MADARA_T.slash:0;
    const dlyAt=i=> galaxy ? GALAXY.hit : md ? (susStart+i*MADARA_T.step) : (i*hstep+susStart);
    /* Jin-Woo: cakar ARISE digambar 170ms setelah menit sambaran, jadi getarnya ikut digeser supaya getar & visual mendarat bareng */
    const jwLag=(id==="CH_EX_JINWOO"&&o.barrageN&&!o.domainStrike)?170:0;
    let cum=0,barEnd=0;
    shots.forEach((s,i)=>{
      if(s.evade||s.miss){playDodge();floatText(D,s.evade?"DODGE":"MISS","miss");return;}
      if(s.void){anim(D,"hit");setTimeout(()=>floatText(D,"VOID","miss"),bsMs(120));return;}
      const dl=dlyAt(i),ft=dl+(md?40:hoff);
      if(!galaxy&&!md&&(o.domainStrike||(id!=="CH_EX_MADARA"&&id!=="CH_EX_GOJO")))setTimeout(()=>playClip(punchAudio),bsMs(dl));
      setTimeout(()=>{if(bt&&!bt.over){anim(D,"hit",ultBarrage);if(!ultBarrage&&!galaxy){const big=!!(o.crit&&i===shots.length-1);if(window.strikeFx)strikeFx(D,{big:big,fx:o.fx||{},flip:String(A).indexOf("foe")>-1});shakeScreen(big);hitStop(big?140:80);if(!o.barrageN||big)speedLines(big);if(big)sfx.crit(),critBoom();}}},bsMs(dl+jwLag));
      cum+=s.d;barEnd=Math.max(barEnd,ft);const stepHp=hpAt(cum);
      setTimeout(()=>floatText(D,"-"+fmt(s.d),(o.crit&&i===shots.length-1)?"crit":""),bsMs(ft));
      setTimeout(()=>setBar(o.barId,o.barTid,stepHp,o.defMax),bsMs(ft));
      if(s.pierce)setTimeout(()=>floatText(D,"PIERCE","crit"),bsMs(180));
    });
    setTimeout(()=>{
      /* Safety net (pola sama dgn schedPhase): rantai kematian jalan di timeout mentah ini —
         satu exception = battle STUCK tanpa UI/reward. Tangkap + paksa endBattle. */
      try{
        if(bt&&!bt.over)setBar(o.barId,o.barTid,endHp,o.defMax);
        if(bt&&o.onAnimEnd)o.onAnimEnd();
      }catch(err){
        console.error("onAnimEnd error",err);
        if(bt&&!bt.over){ try{ bt.timer=null; endBattle(bt.eHp<=0); }catch(e2){ console.error("force endBattle error",e2); } }
      }
    },bsMs(barEnd+520));
    if(o.barrageN>1)setTimeout(()=>floatText(D,(o.iceBlast?"ICE BLAST ×":o.domainStrike?"UNLIMITED VOID ×":o.ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+o.barrageN,"crit"),bsMs(md?MADARA_T.slash:320));
    else if(shots.length>1&&!o.ranton)setTimeout(()=>floatText(D,"DOUBLE!","crit"),bsMs(260));
  },bsMs(180));
}
function setTurnPill(side,label){
  const col=document.querySelector(".vs-col");if(!col)return;
  const t=col.querySelector(".t");if(!t)return;
  col.classList.toggle("foe",side==="foe");
  t.textContent=label;
}
function playerPhase(){
  if(!bt||bt.over)return;
  bt.foeDowning=false;/* kill berikutnya baru sah setelah giliran ini mulai */
  if(bt.turn>300){ endBattle(bt.eHp<=bt.pHp); return; }
  /* AFTERMATH: kartu terakhir udah mati, Rumbling doang yang jalan — bisa nyulik menang, abis itu kalah */
  if(bt.aftermath){
    if(bt.rumbling>0&&foeStatusImmune()){bt.rumbling=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · RUMBLING","heal"),bsMs(160));}
    if(bt.rumbling>0){
      const rd=Math.round(bt.es.hp*(bt.rumblingPct||10)/100);
      bt.eHp-=rd;bt.rumbling--;
      setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUMBLING -"+fmt(rd),"burn");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
      bt.turn++;schedPhase(1000,playerPhase);return;
    }
    endBattle(false);return;
  }
  /* SHADOW MONARCH: bayangan megang slot — tiap giliran dihitung mundur, habis → Monarch balik */
  if(bt.shadow){ if(bt.shadow.turnsLeft<=0){ endPossession(); } else { bt.shadow.turnsLeft--; } }
  bt.justTagged=false;
  bt.trickNext=false;bt.royalNow=false;bt.gunsNow=false;
  const id=bt.eq.char,t=bt.turn;let fx=resolveFx(bt.eq,bt.efx);
  if(bt.shadow)fx={};
  /* UNLIMITED VOID (BLESSED SORCERER): HP < below% max -> set ke healPct% + stun musuh turns, sekali per battle */
  if(fx.unlimitedVoid&&!bt.voidUsed&&bt.pHp<bt.pMax*fx.unlimitedVoid.below/100){
    bt.voidUsed=true;
    bt.pHp=Math.max(bt.pHp,Math.round(bt.pMax*fx.unlimitedVoid.healPct/100));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","UNLIMITED VOID","heal");},bsMs(220));
    if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE Â· VOID","heal"),bsMs(460));}
    else{bt.eStun+=fx.unlimitedVoid.turns;setTimeout(()=>floatText(".fighter.foe","UNLIMITED VOID","crit"),bsMs(460));}
  }
  document.getElementById("turnLabel").innerHTML=(bt.tower&&towerRun)?("LANTAI <b>"+towerRun.floor+"</b> · GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"):("TURN<br>"+t);
  setTurnPill("you","GILIRANMU");
  /* EVOLUTION TURRET (YORDLE INVENTOR): tiap `every` giliran -> +1 turret */
  if(fx.turret&&bt.turn%fx.turret.every===0){bt.turret++;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TURRET +1 ("+bt.turret+")","heal");},bsMs(320));}
  /* RUMBLING: DoT sisa dari kartu yang udah mati — jalan tiap giliran walau kartu udah ganti */
  if(bt.rumbling>0&&foeStatusImmune()){bt.rumbling=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · RUMBLING","heal"),bsMs(160));}
  if(bt.rumbling>0){
    const rd=Math.round(bt.es.hp*(bt.rumblingPct||10)/100);
    bt.eHp-=rd;bt.rumbling--;
    setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUMBLING -"+fmt(rd),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  /* HEAVY RAIN (OCEAN'S GUARDIAN): selama hujan aktif, kartu ini pulih `healPct`% max HP tiap giliran — jalan walau kena stun (spt turnMaxHp); hujan habis setelah `left` giliran */
  if(bt.rain&&bt.rain.left>0){
    const rh=Math.max(1,Math.round(bt.pMax*bt.rain.healPct/100));
    bt.pHp=Math.min(bt.pMax,bt.pHp+rh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","HUJAN +"+fmt(rh),"heal");},bsMs(260));
    bt.rain.left--;
  }
  /* rotasi snapshot HP buat CAUSALITY (ASTRAL DEVOURER): pHp awal giliran ini jadi hp pembanding giliran berikutnya */
  bt.causalPrev=(bt.causalNow==null)?bt.pHp:bt.causalNow;bt.causalNow=bt.pHp;
  /* STAT GROW (SOLAR BRAWLER / ANT KING): semua stat naik pct% compound per giliran */
  if(fx.statGrow&&bt.pHp>0){const sgd=Math.round(bt.pMax*fx.statGrow.pct/100);bt.pMax+=sgd;bt.pHp+=sgd;bt.atkBuff[bt.active]+=fx.statGrow.pct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","STATS +"+fx.statGrow.pct+"%","heal");},bsMs(300));}
  /* REGEN (BLOODMOON DEMON): pulih pct% max HP tiap giliran, jalan walau kena stun; berhenti di bawah stopBelow% max HP */
  if(fx.regen&&bt.pHp>0&&!(fx.regen.stopBelow!=null&&bt.pHp<bt.pMax*fx.regen.stopBelow/100)){const rh2=Math.max(1,Math.round(bt.pMax*fx.regen.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+rh2);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGEN +"+fmt(rh2),"heal");},bsMs(260));}
  /* METEOR PERIODIC (CRIMSON WARLORD): tiap `every` giliran sejak masuk -> aoe pct% max HP musuh (boss kebal) */
  if(fx.meteorShower&&bt.pHp>0&&bt.eHp>0){bt.msLast=bt.msLast||new Array(bt.fighters.length).fill(-99);if(bt.msLast[bt.active]==null||bt.msLast[bt.active]<-90)bt.msLast[bt.active]=bt.turn;if(bt.turn-bt.msLast[bt.active]>=fx.meteorShower.every){aoeMaxHpFire(fx.meteorShower.pct,"METEOR BERIKUTNYA",true);bt.msLast[bt.active]=bt.turn;}}
  /* TURN MAX HP (BIOKINESIS): tiap giliran kartu ini aktif & hidup, kartu aktif musuh rugi pct% MAX HP (flat).
     Ditaruh SEBELUM cek stun biar aura tetap nyala walau kartu kena stun. Boss NPC kebal. */
  if(fx.turnMaxHp&&!bt.en.boss&&!foeStatusImmune()&&bt.eHp>0){
    const td=Math.max(1,Math.round(bt.es.hp*fx.turnMaxHp.pct/100));
    bt.eHp-=td;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BIOKINESIS -"+fmt(td),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  if((bt.pFreeze||0)>0)bt.pFreeze--;
  if(bt.pStun>0){
    if(fx.statusImmune){
      /* STATUS IMMUNE: stun DIBATALKAN — giliran tetap jalan */
      bt.pStun=0;
      setTimeout(()=>floatText(".fighter.me","IMMUNE · STUN","heal"),bsMs(200));
    }else{
      bt.pStun--;
      const lbl=(bt.pDrTurns>0&&bt.pDr)?"STUN · DR "+bt.pDr+"%":"STUN";
      setTimeout(()=>floatText(".fighter.me",lbl,"crit"),bsMs(200));
      schedPhase(600,enemyPhase);
      return;
    }
  }
  const efx=bt.efx||{};
  const a=bt.active;
  /* SLEEP STRIKE (THUNDER PRODIGY): tidur N giliran sejak masuk — serangan dilewati;
     begitu hitung tidur habis, serangan berikutnya di-arm ×mult (lihat blok dmgMult) */
  if(fx.sleepStrike&&(bt.sleepLeft[a]||0)>0){
    bt.sleepLeft[a]--;
    if(bt.sleepLeft[a]===0){bt.sleepArmed[a]=true;setTimeout(()=>floatText(".fighter.me","BANGUN!","heal"),bsMs(200));}
    else setTimeout(()=>floatText(".fighter.me","TERTIDUR","miss"),bsMs(200));
    schedPhase(600,enemyPhase);
    return;
  }
    /* SERIOUS PUNCH (BALD KING): charge giliran tanpa menyerang -> giliran ke-charge arm pukulan -> cd giliran */
  if(fx.seriousPunch){
    if((bt.spCd[a]||0)>0){bt.spCd[a]=(bt.spCd[a]||0)-1;if(bt.spCd[a]>0)setTimeout(()=>floatText(".fighter.me","SERIOUS PUNCH Â· CD "+bt.spCd[a],"miss"),bsMs(200));schedPhase(600,enemyPhase);return;}
    bt.spTurn[a]=(bt.spTurn[a]||0)+1;
    if(bt.spTurn[a]<fx.seriousPunch.charge){setTimeout(()=>floatText(".fighter.me","CHARGING... "+bt.spTurn[a]+"/"+fx.seriousPunch.charge,"miss"),bsMs(200));schedPhase(600,enemyPhase);return;}
    bt.spTurn[a]=0;bt.spCd[a]=fx.seriousPunch.cd;bt.spArmed[a]=true;
  }
  /* DESPERATE STRIKE: di bawah below% HP -> serangan berikutnya ×mult, sesudahnya tewas di akhir giliran */
  if(fx.desperateStrike&&bt.dsState[a]===0&&bt.pHp>0&&bt.pHp<bt.pMax*fx.desperateStrike.below/100)bt.dsState[a]=1;
  /* DODGE EVERY: setiap N giliran sejak masuk, pasti hindari serangan musuh giliran ini */
  if(fx.dodgeEvery){bt.dodgeCount[a]=(bt.dodgeCount[a]||0)+1;if(bt.dodgeCount[a]%fx.dodgeEvery.turns===0)bt.dodgeArmed[a]=true;}
  /* EXECUTE ON ENTRY (SUPERNOVA): saat masuk, kalau HP musuh < pct% HP kartu ini, hancurkan instan */
  /* ERASE (OMNI SOVEREIGN): entry -> total stat musuh < milik kartu ini -> hapus (pola executeOnEntry) */
  if(fx.eraseOnEntry&&bt.eraseGuard&&bt.eraseGuard[a]){
    bt.eraseGuard[a]=false;
    const ownS=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
    if(bt.eHp>0&&(bt.es.hp+bt.es.atk)<(ownS.hp+ownS.atk)){
      bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
      setTimeout(()=>{anim(".fighter.foe","ko");floatText(".fighter.foe","HAPUS EKSISTENSI","crit");},bsMs(200));
      setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
      return;
    }
  }
  if(fx.executeOnEntry&&bt.execGuard[a]){
    bt.execGuard[a]=false;
    const thr=Math.round(cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).hp*fx.executeOnEntry.pct/100);
    if(bt.eHp>0&&bt.eHp<thr){
      bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
      setTimeout(()=>{anim(".fighter.foe","ko");floatText(".fighter.foe","SUPERNOVA","crit");},bsMs(200));
      setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
      return;
    }
  }
    /* METEORIC BURST (METEOR CONQUEROR): saat masuk, ledakan meteror -> damage FLAT pct% MAX HP kartu ini ke musuh aktif (bypass evasion/void), sekali per masuk */
  if(fx.meteorWave&&bt.meteorGuard[a]){
    bt.meteorGuard[a]=false;
    if(bt.eHp>0){
      const md=Math.max(1,Math.round(bt.pMax*fx.meteorWave.pct/100));
      bt.eHp-=md;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","METEORIC BURST -"+fmt(md),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* ENTRY SHATTER (ALMIGHTY PUSH): saat masuk, ledakan memecah -> damage flat sebesar pct% dari total HP musuh saat ini (bypass evasion/void, spt wallTitans) */
  if(fx.entryShatter&&bt.shatterGuard[a]){
    bt.shatterGuard[a]=false;
    if(bt.eHp>0){
      const sd=Math.max(1,Math.round(bt.eHp*fx.entryShatter.pct/100));
      bt.eHp-=sd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","ALMIGHTY PUSH -"+fmt(sd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* PAPER STORM (PAPER PAL): saat masuk, serpihan kertas memberikan damage FLAT sebesar pct% dari ATK kartu ini ke kartu aktif musuh (bypass evasion/void spt entryShatter). Sekali per masuk. */
  if(fx.entryAtkPct&&bt.atkEntryGuard[a]){
    bt.atkEntryGuard[a]=false;
    if(bt.eHp>0){
      const ownAtk=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
      const pd=Math.max(1,Math.round(ownAtk*fx.entryAtkPct.pct/100));
      bt.eHp-=pd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe",passiveName(id)+" -"+fmt(pd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* ENTRY MAX HP (BIOKINESIS): saat masuk, kartu aktif musuh rugi pct% MAX HP sebagai damage flat (bypass evasion/void).
     Boss NPC kebal. Guard sekali-per-masuk persis pola entryShatter. */
  if(fx.entryMaxHp&&bt.bioGuard[a]){
    bt.bioGuard[a]=false;
    if(bt.eHp>0&&!bt.en.boss&&!foeStatusImmune()){
      const bd=Math.max(1,Math.round(bt.es.hp*fx.entryMaxHp.pct/100));
      bt.eHp-=bd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BIOKINESIS -"+fmt(bd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* LIFETIME: kartu self-destruct setelah N giliran sejak masuk arena */
  if(fx.lifetime&&(t-(bt.burstStart[a]||1))>=fx.lifetime.turns){
    bt.pHp=0;setBar("hpMe","hpMeT",0,bt.pMax);
    setTimeout(()=>{anim(".fighter.me","ko");floatText(".fighter.me","LIFETIME UP","crit");},bsMs(200));
    setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?2700:700,playerPhase);},bsMs(900));
    return;
  }
  /* BURST: revert HP ke normal kalau masa burst sudah lewat (tanpa lifetime) */
  if(fx.burst&&(t-(bt.burstStart[a]||1))>=fx.burst.turns){
    const baseHp=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).hp;
    if(bt.pMax>baseHp){bt.pMax=baseHp;if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}
  }
    /* OVERHEAT (METEOR CONQUEROR): setelah delay giliran sejak masuk -> rugi pct% MAX HP sendiri tiap giliran; habis -> tewas (pola lifetime) */
  if(fx.overheat&&(t-(bt.burstStart[a]||1))>=fx.overheat.delay){
    const oh=Math.max(1,Math.round(bt.pMax*fx.overheat.pct/100));
    bt.pHp=Math.max(0,bt.pHp-oh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","OVERHEAT -"+fmt(oh),"burn");}},bsMs(200));
    if(bt.pHp<=0){setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?2700:700,playerPhase);},bsMs(900));return;}
  }
  /* BERSERKER ARMOR (THE STRUGGLER): tiap giliran rugi selfDmgPct% max HP + atkGainPct% ATK stack; HP < lowPct% -> undying undyingTurns giliran + xatkMult; habis -> tewas */
  if(fx.berserker){
    const bzk=fx.berserker;
    if((bt.berserkLeft||0)>0){
      bt.berserkLeft--;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BERSERKER TURNS "+bt.berserkLeft,"crit");},bsMs(240));
      if(bt.berserkLeft<=0){
        bt.berserkOn=false;
        setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","ARMOR HABIS","crit");}},bsMs(220));
        setTimeout(()=>{if(bt&&!bt.over)endBattle(false);},bsMs(900));
        return;
      }
    }
    const bzd=Math.max(1,Math.round(bt.pMax*bzk.selfDmgPct/100));
    bt.pHp-=bzd;bt.atkBuff[a]+=bzk.atkGainPct;
    setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","BERSERK -"+fmt(bzd)+" +"+bzk.atkGainPct+"% ATK","burn");}},bsMs(200));
    if(!bt.berserkOn&&bt.pHp<=bt.pMax*bzk.lowPct/100){
      bt.berserkOn=true;bt.berserkLeft=bzk.undyingTurns;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BERSERKER ARMOR!","crit");},bsMs(420));
    }
    if(bt.pHp<=0&&!bt.berserkOn){
      setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?2700:700,playerPhase);},bsMs(900));
      return;
    }
  }
   /* TWILIGHT OF VALHALLA (HEIGHT OF PAINTING): tiap giliran selama aktif -> +atkPct% ATK stack; countdown habis -> heal healPct% max HP */
   if(fx.valhalla&&(bt.valhallaLeft||0)>0){
     const vl=fx.valhalla;
     bt.atkBuff[a]+=vl.atkPct;bt.valhallaLeft--;
     setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT +"+vl.atkPct+"% ATK","heal");},bsMs(240));
     if(bt.valhallaLeft<=0){
       const vh=Math.max(1,Math.round(bt.pMax*vl.healPct/100));
       bt.pHp=Math.min(bt.pMax,bt.pHp+vh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
       setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT HABIS +"+fmt(vh),"heal");},bsMs(460));
     }
   }
  let atk=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
  if(bt.atkBuff[a])atk=Math.round(atk*(1+bt.atkBuff[a]/100));
  /* MIRROR status musuh: puppet poison & ink corrupt motong ATK pemain (pola ePoison/eInk) */
  if(bt.pPoisonCut)atk=Math.max(1,Math.round(atk*(1-Math.min(90,bt.pPoisonCut)/100)));
  if((bt.pInk||0)>0&&bt.pInkPct>0)atk=Math.max(1,Math.round(atk*(1-(bt.pInk*bt.pInkPct)/100)));
  /* SPLIT DEATH: ATK badan hasil terbelah ikut menyusut (kumulatif, gaya snatchAtk) */
  if(bt.splitMult&&bt.splitMult[a])atk=Math.round(atk*bt.splitMult[a]);
  if(fx.lowHpAtk&&bt.pHp<bt.pMax*fx.lowHpAtk.below/100)atk=Math.round(atk*(1+fx.lowHpAtk.bonus/100));
  if(fx.burst&&(t-(bt.burstStart[a]||1))<fx.burst.turns)atk=Math.round(atk*fx.burst.mult);
  if(fx.transform)atk=Math.round(atk*fx.transform.mult);
  if(bt.snatchAtk&&bt.snatchAtk[a])atk+=bt.snatchAtk[a];
  if(bt.shadow)atk=bt.shadow.atk;
  let dmgMult=1;
  if(fx.dmgMult)dmgMult*=fx.dmgMult;
  /* OPENING HIT: serangan pertama ke kartu musuh BARU ×(1+pct%) — guard dibuang saat percobaan pertama (miss/evade tetap habis) */
  /* DODGE-NEXT (TITAN HUNTER nextOnly): bonus damage dari dodge dipakai di serangan ini (sekali pakai) */
  if(fx.dodgeAtk&&fx.dodgeAtk.nextOnly){bt.dodgeNext=bt.dodgeNext||new Array(bt.fighters.length).fill(0);if((bt.dodgeNext[a]||0)>0){dmgMult*=1+bt.dodgeNext[a]/100;bt.dodgeNext[a]=0;setTimeout(()=>floatText(".fighter.me","COUNTER DODGE +"+fx.dodgeAtk.pct+"%","crit"),bsMs(150));}}
  if(fx.openingHit&&bt.openGuard&&bt.eHp>0){dmgMult*=(1+fx.openingHit.pct/100);bt.openGuard=false;}
  /* DESPERATE STRIKE dilepas: ×mult sekali lalu state=2 -> mati di awal enemyPhase (lihat blok dsState) */
  if(fx.desperateStrike&&bt.dsState[a]===1){dmgMult*=fx.desperateStrike.mult;bt.dsState[a]=2;setTimeout(()=>floatText(".fighter.me",fx.desperateStrike.text||"DESPERATE STRIKE","crit"),bsMs(200));}
  /* SLEEP STRIKE dilepas: serangan pertama setelah bangun ×mult sekali; overkill disimpan di bt.overflow (dihantamkan ke musuh berikutnya di advanceTowerFoe) */
  let sleepHit=false;
  if(fx.sleepStrike&&bt.sleepArmed[a]){sleepHit=true;dmgMult*=fx.sleepStrike.mult;bt.sleepArmed[a]=false;setTimeout(()=>floatText(".fighter.me",fx.sleepStrike.text||"THUNDERCLAP FLASH","crit"),bsMs(220));}
    /* SERIOUS PUNCH dilepas: giliran ke-charge -> xmult + arm shockwave 10% (dipakai di blok hits) */
  if(fx.seriousPunch&&bt.spArmed[a]){bt.spArmed[a]=false;dmgMult*=fx.seriousPunch.mult;setTimeout(()=>floatText(".fighter.me","SERIOUS PUNCH","crit"),bsMs(200));}
  /* FREEZE (10TH CAPTAIN): selama target BEKU (bt.freezeLeft>0, tick paralel eStun di enemyPhase) serangan kartu ini ×mult */
  if(fx.entryFreeze&&(bt.freezeLeft||0)>0)dmgMult*=fx.entryFreeze.mult;
  /* FREEZE BONUS (ICE QUEEN): selama target BEKU, serangan kartu ini xmult */
  if(fx.hitFreeze&&(bt.freezeLeft||0)>0)dmgMult*=fx.hitFreeze.mult;
   /* MASTERPIECE (HEIGHT OF PAINTING): serangan ke-3 -> xmult + arm stun (dilepas setelah hit, guard statusImmune) */
   let masterpiece=false;
   if(fx.valhalla&&fx.valhalla.master){bt.paintHits[a]=(bt.paintHits[a]||0)+1;if(bt.paintHits[a]%3===0){masterpiece=true;dmgMult*=fx.valhalla.master.mult;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MASTERPIECE!","crit");},bsMs(220));}}
  /* BERSERKER ARMOR aktif (THE STRUGGLER): serangan xatkMult */
  /* DIZZY (RUBBER FIELD): penyerang kena DIZZY -> semua damage yang diterima +20% per stack */
  if((bt.dizzyStack||0)>0&&(bt.dizzyLeft||0)>0)dmgMult*=(1+bt.dizzyStack*0.2);
  if(fx.berserker&&bt.berserkOn&&(bt.berserkLeft||0)>0)dmgMult*=fx.berserker.atkMult;
  /* SATU PERSEN (Ultra Instinct): tiap serangan GENAP (ke-2, ke-4, ...) = 1% kekuatan penuh → ×mult damage + tembus damage reduction musuh */
  let pen=!!fx.ignoreDef;
  if(fx.everySecond){bt.atkCount[a]++;if(bt.atkCount[a]%2===0){dmgMult*=fx.everySecond.mult;pen=true;setTimeout(()=>floatText(".fighter.me","ONE PERCENT","crit"),bsMs(220));}}
  /* SUSANOO CHIDORI: tiap serangan ke-N → ×mult damage + menembus pengurangan damage */
  if(fx.everyNth){bt.atkCount[a]++;if(bt.atkCount[a]%fx.everyNth.n===0){dmgMult*=fx.everyNth.mult;pen=true;setTimeout(()=>floatText(".fighter.me",fx.everyNth.text||"SUSANOO CHIDORI","crit"),bsMs(220));}}if(fx.everyNth&&fx.everyNth.next&&bt.atkCount[a]>0&&bt.atkCount[a]%fx.everyNth.n===0&&bt.eHp>0){const nd=Math.max(1,Math.round(atk*(fx.everyNth.next/100)));if(fx.everyNth.all&&bt.tower&&towerRun){lineupAoeHit(nd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GAMMA RAY -"+fmt(nd),"crit");},bsMs(420));}else if(!fx.everyNth.all&&bt.tower&&towerRun){lineupNextHit(nd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DEATH BEAM -"+fmt(nd),"crit");},bsMs(420));}}
  /* THE WORLD (Immortal Vampire): serangan ke-`every` -> stun musuh `turns` giliran lagi (entry stun sudah arming di 4 titik masuk) */
  if(fx.timeStop){bt.atkCount[a]++;if(bt.atkCount[a]%fx.timeStop.every===0&&!foeStatusImmune()){bt.eStun=fx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(220));}}
  /* 40-DAY FLOOD (Sea Sovereign): serangan ke-`every` -> ×mult + tembus DR + eksekusi kalau musuh <= exec% HP */
  let floodHit=false;
  if(fx.flood){bt.atkCount[a]++;if(bt.atkCount[a]%fx.flood.every===0){floodHit=true;dmgMult*=fx.flood.mult;pen=true;setTimeout(()=>floatText(".fighter.foe",(fx.flood.label||"40-DAY FLOOD"),"crit"),bsMs(220));}}
/* SAND BURIAL (Sand Vessel): serangan ke-`every` -> guaranteed hit xmult, bypass dodge/void via tsLock */
let sandHit=false;
if(fx.sandBurial){bt.atkCount[a]++;if(bt.atkCount[a]%fx.sandBurial.every===0){sandHit=true;dmgMult*=fx.sandBurial.mult;setTimeout(()=>floatText(".fighter.foe","SAND BURIAL","crit"),bsMs(220));}}
  /* STYLE SWITCHING (Devil Hunter): 4 mode bergilir tiap giliran kartu ini menyerang */
  if(fx.styleSwitching){
    const STYLES=["TRICKSTER","SWORDMASTER","ROYALGUARD","GUNSLINGER"];
    const si=bt.styleCount[a]%4;bt.styleCount[a]++;
    setTimeout(()=>floatText(".fighter.me",STYLES[si],"crit"),bsMs(120));
    if(si===0)bt.trickNext=true;
    else if(si===1)dmgMult*=1.5;
    else if(si===2)bt.royalNow=true;
    else if(si===3)bt.gunsNow=true;
  }
  if(fx.highHpDmg&&bt.pHp>bt.pMax*fx.highHpDmg.above/100)dmgMult*=(1+fx.highHpDmg.bonus/100);
  if(fx.grieferAtk)dmgMult*=fx.grieferAtk.mult;
  if(fx.turret&&bt.turret>0)dmgMult*=(1+bt.turret*fx.turret.atkPct/100);
  /* SENZU MUNCH (DUMB HAIR GUY): heal tiap giliran; makan -> x0.5 dmg; finish meal tiap N giliran -> x4 strike */
  if(fx.senzu){
    const sl=fx.senzu;
    bt.senzu.turn++;
    const fin=(bt.senzu.turn%sl.every===0);
    const heal=Math.round(bt.pMax*sl.healPct/100);
    bt.pHp=Math.min(bt.pMax,bt.pHp+heal);
    dmgMult*=fin?sl.strikeMult:sl.eatMult;
    bt.senzuFin=fin;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me",fin?"FINISH THE MEAL!":"MUNCH MUNCH +"+heal,"heal");},bsMs(300));
  }
  /* GOMU GOMU (DUMB STRETCHY GUY): tiap serangan trigger random 1 dari 3 */
  if(fx.stretch){
    const st=fx.stretch;const r=Math.floor(Math.random()*3);
    if(r===0){bt.balloon=st.balloon.reflect;dmgMult=0;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM BALLOON!","heal");},bsMs(300));}
    else if(r===1){dmgMult=0;bt.stretchShot=Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk*st.fireworks.mult);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM FIREWORKS!","crit");},bsMs(300));}
    else{dmgMult=0;const fh=Math.round(bt.pMax*st.flop.healPct/100);bt.pHp=Math.min(bt.pMax,bt.pHp+fh);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM FLOP +"+fh,"heal");},bsMs(300));}
  }
  /* BUNGEE GUM: selama gum masih nempel di musuh (ditempel waktu musuh nyerang), serangan ×(1+bonus%) lalu hitung mundur */
  if(fx.bungeeGum&&bt.gumTurns>0){dmgMult*=(1+fx.bungeeGum.bonus/100);bt.gumTurns--;}
  const hits=[{mult:1}];

  /* THE WORLD ENDER (DARKIN LORD): cycle 3 serangan - 150% / 40% semua / 80% pierce + 80% di belakang */

  let weExtra=0;

  if(fx.worldEnder){

    const we=fx.worldEnder;const ph=bt.weCount[a]%3;bt.weCount[a]++;

    hits.length=0;

    if(ph===0){hits.push({mult:we.cyc1});}

    else if(ph===1){hits.push({mult:we.cyc2});weExtra=Math.round(atk*dmgMult*we.cyc2);lineupAoeHit(weExtra);}

    else{hits.push({mult:we.pierce});weExtra=Math.round(atk*dmgMult*we.pierce);lineupNextHit(weExtra);}

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me",ph===0?"WORLD ENDER":ph===1?"WORLD ENDER - ALL":"WORLD ENDER - PIERCE","crit");},bsMs(240));

  }

  /* PSYCHIC BARRAGE (PSYCHIC ESPER): alih-alih menyerang - N batu acak ke musuh aktif / cadangan tower */

  if(fx.psychicBarrage){

    const pb=fx.psychicBarrage;const n=bt.pbRocks||pb.rocks;

    hits.length=0;

    let railDirty=false;

    for(let i=0;i<n;i++){

      let target=null;

      if(bt.tower&&towerRun){

        const alive=[];

        for(let j=towerRun.idx+1;j<towerRun.waves.length;j++){const w=towerRun.waves[j];if(w&&!w.dead)alive.push(w);}

        if(alive.length&&Math.random()<0.5)target=alive[Math.floor(Math.random()*alive.length)];

      }

      const key=target?("W"+towerRun.waves.indexOf(target)):"A";

      if(key===bt.pbKey)bt.pbStreak++;else bt.pbStreak=0;

      bt.pbKey=key;

      const m=pb.mult*(1+bt.pbStreak*(pb.streakPct||10)/100);

      if(target){

        if(target.hp==null)target.hp=target.es.hp;

        const d=Math.round(atk*dmgMult*m);

        target.hp-=d;

        if(target.hp<=0){target.hp=0;target.dead=true;}

        railDirty=true;

      }else{

        hits.push({mult:m});

      }

    }

    if(!hits.length)hits.push({mult:0});

    if(railDirty){const rail=document.querySelector(".foe-rail");if(rail)rail.outerHTML=towerEnemyBenchRail();}

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","PSYCHIC BARRAGE x"+n,"crit");},bsMs(300));

  }
  if(fx.seriousPunch&&bt.spWave[a]){bt.spWave[a]=false;hits.push({mult:(fx.seriousPunch.wavePct||10)/100});lineupAoeHit(Math.round(atk*dmgMult*((fx.seriousPunch.wavePct||10)/100)));}
  if(fx.tripleHit){hits.length=0;for(let tri=0;tri<fx.tripleHit.hits;tri++)hits.push({mult:fx.tripleHit.mult});}
  if(typeof fx.double==="object"){if(Math.random()*100<(fx.double.chance!=null?fx.double.chance:100))hits.push({mult:(fx.double.pct!=null?fx.double.pct:100)/100});}else if(fx.double&&Math.random()*100<fx.double)hits.push({mult:1});
  let crit=false;
  if(fx.crit&&Math.random()*100<fx.crit.chance){crit=true;hits[hits.length-1].mult*=fx.crit.mult;}
  else if(Math.random()*100<BASE_CRIT.chance){crit=true;hits[hits.length-1].mult*=BASE_CRIT.mult;}
  let purple=false;
  if(fx.purple&&Math.random()*100<fx.purple.chance){purple=true;crit=true;hits[hits.length-1].mult*=fx.purple.mult;}
  let ranton=false;
  if(fx.ranton&&Math.random()*100<fx.ranton.chance){ranton=true;crit=true;hits.length=0;const rh=Math.max(1,fx.ranton.hits||5),rm=fx.ranton.mult||1;for(let k=0;k<rh;k++)hits.push({mult:rm});}
  let barrageN=0,iceBlastN=0;
  if(fx.barrage&&Math.random()*100<fx.barrage.chance){const n=fx.barrage.min+Math.floor(Math.random()*(fx.barrage.max-fx.barrage.min+1));const bm=fx.barrage.mult||1;if(bm!==1){hits.length=0;for(let i=0;i<n;i++)hits.push({mult:bm});}else{while(hits.length<n)hits.push({mult:1});}barrageN=hits.length;}
  if(ranton&&!barrageN)barrageN=hits.length;
  /* ICE BLAST (kartu BOSS): chance% -> ganti hit jadi N tembakan @ pct% ATK, label float di performAttack */
  if(fx.iceBlast&&Math.random()*100<fx.iceBlast.chance){const n=Math.max(1,fx.iceBlast.hits||3),pm=(fx.iceBlast.pct!=null?fx.iceBlast.pct:100)/100;hits.length=0;for(let i=0;i<n;i++)hits.push({mult:pm});iceBlastN=n;barrageN=n;}
  // DOMAIN EXPANSION (Gojo, disamakan dengan Shrine Sukuna): 100% tiap ronde → 15 sambaran @30% ATK + lifesteal + recharge (stun 1 & DR 50% 2 ronde)
  let domainStrike=false;
  if(fx.domain&&id==="CH_EX_GOJO"&&Math.random()*100<(fx.domain.chance||100)){const dn=fx.domain.min||10,dm=(fx.domain.mult!=null?fx.domain.mult:0.3);hits.length=0;for(let i=0;i<dn;i++)hits.push({mult:dm});barrageN=dn;crit=false;purple=false;ranton=false;domainStrike=true;}
  bt.domainNow=domainStrike;
  /* Galaxy Roar = SATU semburan: semua damage ditumpuk ke satu sambaran supaya laser & ledakannya sinkron */
  const galaxy=id==="CH_ETERNAL_DRAGON"&&purple;
  if(galaxy){const m=hits[hits.length-1].mult;hits.length=0;hits.push({mult:m});barrageN=0;}
  const ariseMode=id==="CH_EX_JINWOO"&&barrageN>=9;
  if(bt.gunsNow)hits.push({mult:0.4});
/* THE WORLD: selama time stop aktif serangan tidak bisa di-dodge/void */
  let tsLock=!!(fx.timeStop&&(bt.eStun||0)>0)||!!sandHit;
    let total=0;const shots=[];
  hits.forEach(h=>{
    let d=Math.round(atk*dmgMult*h.mult);
    if(!pen&&!tsLock&&efx.evasion&&t<=efx.evasion.turns&&Math.random()*100<efx.evasion.chance){shots.push({d:0,evade:true});return;}
    const pierce=!!(fx.pierce&&Math.random()*100<fx.pierce);
    if(!pen&&!tsLock&&efx.void&&!pierce&&Math.random()*100<efx.void){shots.push({d:0,void:true});return;}
    shots.push({d,miss:false,pierce});total+=d;
  });
if(floodHit&&total>0&&total<bt.eHp&&((fx.flood.exec!=null?fx.flood.exec:20)>0)&&bt.eHp<=bt.es.hp*((fx.flood.exec!=null?fx.flood.exec:20)/100))total=bt.eHp;
/* HITOKUGUTSU (Puppeteer): tiap hit -> puppet poison -pct% ATK musuh permanen (stacking s/d 90%) */
if(fx.puppetPoison&&total>0){bt.ePoison=Math.min(90,(bt.ePoison||0)+fx.puppetPoison.pct);setTimeout(()=>floatText(".fighter.foe","PUPPET -"+fx.puppetPoison.pct+"% ATK","burn"),bsMs(360));}
if(fx.inkCorrupt&&total>0){bt.eInk=Math.min(fx.inkCorrupt.max,(bt.eInk||0)+1);bt.eInkPct=fx.inkCorrupt.pct;setTimeout(()=>floatText(".fighter.foe","INK CORRUPTION","burn"),bsMs(380));}
    const eHpNext=bt.eHp-total,foeDead=eHpNext<=0;
  /* THUNDERCLAP FLASH overflow: sisa damage serangan sleepStrike yang membunuh target disimpan buat musuh berikutnya */
  if(sleepHit&&foeDead&&eHpNext<0)bt.overflow=-eHpNext;
  const _fgFoe=(bt.fgen||0);const foeDownCb=()=>{if(bt&&!bt.over&&(bt.fgen||0)===_fgFoe)foeDown();};
  performAttack({
    A:".fighter.me",D:".fighter.foe",id,fx,
    barId:"hpFoe",barTid:"hpFoeT",defMax:bt.es.hp,
    defHpStart:bt.eHp+total,defHpEnd:eHpNext,
    shots,total,crit,purple,
    ranton,domainStrike,ariseMode,barrageN,galaxy,iceBlast:!!iceBlastN,
    onAnimEnd:foeDead?foeDownCb:null,
    recharge:(b)=>{if(!bt)return;bt.pStun=(fx&&fx.statusImmune)?0:b.selfStun;bt.pDrTurns=b.selfDrTurns||b.selfStun;bt.pDr=b.selfDr||0;setTimeout(()=>floatText(".fighter.me","RECHARGE","miss"),bsMs(1200));}
  });
  bt.eHp=eHpNext;
  /* ===== MIRROR PASSIVE LAWAN - kartu musuh prok saat kena serangan (counter/poison/ink/drain) ===== */
  const efxM=(bt.eAbilityOff>0)?{}:(bt.efx||{});
  if(total>0&&bt.eHp>0&&bt.pHp>0){
    if(efxM.counterHit&&Math.random()*100<efxM.counterHit.chance){
      const cb=(efxM.counterHit.base==="foeMaxHp")?bt.pMax:bt.es.atk;
      const cd=Math.max(1,Math.round(cb*efxM.counterHit.pct/100));
      bt.pHp=Math.max(0,bt.pHp-cd);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me",(efxM.counterHit.base==="foeMaxHp"?"BLOOD IGNITE -":"FULL COUNTER -")+fmt(cd),"crit");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(560));
      if(bt.pHp<=0)setTimeout(()=>{if(bt&&!bt.over){if(!trySave())endBattle(false);}},bsMs(900));
    }
    if(efxM.puppetPoison){bt.pPoisonCut=Math.min(90,(bt.pPoisonCut||0)+efxM.puppetPoison.pct);setTimeout(()=>floatText(".fighter.me","POISON -"+efxM.puppetPoison.pct+"% ATK","burn"),bsMs(360));}
    if(efxM.inkCorrupt){bt.pInk=Math.min(efxM.inkCorrupt.max,(bt.pInk||0)+1);bt.pInkPct=efxM.inkCorrupt.pct;setTimeout(()=>floatText(".fighter.me","INK CORRUPTION","burn"),bsMs(380));}
    if(efxM.hpDrain&&!fx.statusImmune){bt.pMax=Math.max(1,Math.round(bt.pMax*(1-efxM.hpDrain.pct/100)));if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","HP DRAIN","crit");setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}},bsMs(360));}
  }
  if(ranton&&total>0&&bt.eHp>0&&fx.ranton.stun){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else bt.eStun=fx.ranton.stun;}
   if(masterpiece&&bt.eHp>0&&fx.valhalla.master.stun){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eStun=Math.max(bt.eStun||0,fx.valhalla.master.stun);setTimeout(()=>floatText(".fighter.foe","MASTERPIECE STUN","crit"),bsMs(520));}}
  /* HP DRAIN: tiap serangan yang kena memotong MAX HP musuh secara permanen (compounding) */
  if(fx.hpDrain&&total>0&&bt.eHp>0&&!foeStatusImmune()){
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*(1-fx.hpDrain.pct/100)));
    if(bt.eHp>bt.es.hp)bt.eHp=bt.es.hp;
    setTimeout(()=>floatText(".fighter.foe","HP DRAIN","crit"),bsMs(360));
  }
    /* THE WORLD ENDER lifesteal: heal healPct% dari semua damage giliran ini (x1.3 setelah revive) */

  if(fx.worldEnder&&total+weExtra>0){

    const wh=Math.max(1,Math.round((total+weExtra)*fx.worldEnder.healPct/100*(bt.weRevived?1.3:1)));

    bt.pHp=Math.min(bt.pMax,bt.pHp+wh);

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","LIFESTEAL +"+fmt(wh),"heal");},bsMs(460));

  }

  /* WALL TITANS: tiap `every` giliran, berbaris ngasih bonus pct% ATK ke musuh (di luar serangan normal) */
  if(fx.wallTitans){bt.wtCount[a]=(bt.wtCount[a]||0)+1;if(bt.wtCount[a]%fx.wallTitans.every===0&&bt.eHp>0){const wt=Math.round(atk*fx.wallTitans.pct/100);bt.eHp-=wt;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","WALL TITANS -"+fmt(wt),"crit");}},bsMs(520));}}
  /* SHOCKWAVE (OCEAN'S GUARDIAN): setiap serangan ke-`every`, kartu aktif musuh kena flat pct% ATK di luar serangan normal (gaya wallTitans; arena 1 musuh aktif = "semua musuh" jatuh ke kartu aktif) */
  if(fx.shockwave){bt.shockCount[a]=(bt.shockCount[a]||0)+1;if(bt.shockCount[a]%fx.shockwave.every===0&&bt.eHp>0){const sw=Math.round(atk*fx.shockwave.pct/100);bt.eHp-=sw;lineupAoeHit(sw);setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","SHOCKWAVE -"+fmt(sw),"crit");}},bsMs(560));}}
  /* SUPER MEGA DEATH ROCKET (HAVOC WREACKER): serangan ke-`every` -> flat pct% ATK ke musuh aktif + seluruh slot cadangan (lineupAoeHit) */
  if(fx.havocRocket){bt.hvCount[a]=(bt.hvCount[a]||0)+1;if(bt.hvCount[a]%fx.havocRocket.every===0&&bt.eHp>0){const rk=Math.round(atk*fx.havocRocket.pct/100);bt.eHp-=rk;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","DEATH ROCKET -"+fmt(rk),"crit");}},bsMs(560));lineupAoeHit(rk);}}  if(fx.lifesteal&&total>0){
    const ls=Math.round(total*fx.lifesteal/100);bt.pHp=Math.min(bt.pMax,bt.pHp+ls);
    setTimeout(()=>floatText(".fighter.me","+"+fmt(ls),"heal"),bsMs(300));
  }
   /* INK DRAIN (INK ANAMLOY): serangan ke-every -> heal pct% dari damage yang DIBERIKAN serangan itu */
   if(fx.inkDrain&&total>0){bt.paintHits[a]=(bt.paintHits[a]||0)+1;if(bt.paintHits[a]%fx.inkDrain.every===0){const ih=Math.max(1,Math.round(total*fx.inkDrain.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+ih);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","INK DRAIN +"+fmt(ih),"heal");},bsMs(320));}}
  if(fx.burn&&total>0&&Math.random()*100<fx.burn.chance){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eBurn=fx.burn.turns;setTimeout(()=>floatText(".fighter.foe","BURN","burn"),bsMs(360));}}
  /* HIT FREEZE (ICE QUEEN): chance% per serangan -> bekukan musuh turns giliran (pola burn, guard statusImmune) */
  /* SENZU FINISH MEAL (DUMB HAIR GUY): gain 25% damage sbg flat ATK + 50% sbg max HP, cap maxMultx base */
  if(fx.senzu&&bt.senzuFin&&total>0&&bt.eHp>0){
    const sl=fx.senzu;
    let gA=Math.round(total*sl.atkGain/100);let gH=Math.round(total*sl.hpGain/100);
    gA=Math.max(0,Math.min(gA,bt.senzu.baseAtk*(sl.maxMult-1)-bt.senzu.atkSum));
    gH=Math.max(0,Math.min(gH,bt.senzu.baseHp*(sl.maxMult-1)-bt.senzu.hpSum));
    if(gA>0){bt.senzu.atkSum+=gA;bt.atkBuff[a]+=Math.round(gA/bt.senzu.baseAtk*100);}
    if(gH>0){bt.senzu.hpSum+=gH;bt.pMax=Math.round(bt.senzu.baseHp+bt.senzu.hpSum);if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;}
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SENZU GROW +ATK +MAX HP","crit");},bsMs(360));
  }
  if(fx.senzu)bt.senzuFin=false;
  /* FIREWORKS (DUMB STRETCHY GUY): pukulan ekstra xmult ATK dasar ke musuh */
  if(bt.stretchShot){
    const fd=bt.stretchShot;bt.stretchShot=0;
    if(bt.eHp>0){
      bt.eHp-=fd;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","FIREWORKS -"+fmt(fd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(340));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
  }
  /* MAX CORRUPT (GLITCHED ENTITY): serangan kena -> max HP musuh turun pct% permanen, clamp eHp */
  if(fx.maxCorrupt&&total>0&&bt.eHp>0){
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*(100-fx.maxCorrupt.pct)/100));
    if(bt.eHp>bt.es.hp)bt.eHp=bt.es.hp;
    setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.foe","MAX HP CORRUPT","burn");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(340));
  }
  if(fx.hitFreeze&&total>0&&bt.eHp>0&&Math.random()*100<fx.hitFreeze.chance){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eStun=fx.hitFreeze.turns;bt.freezeLeft=fx.hitFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(360));}}
  /* PERFECT SUSANOO (low HP): di bawah ambang, serangan membakar musuh selama N giliran */
  if(fx.lowHpAura&&total>0&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&bt.eHp>0){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{if(fx.lowHpAura.burn)bt.eBurn=fx.lowHpAura.burn.turns;setTimeout(()=>floatText(".fighter.foe","PERFECT SUSANOO","burn"),bsMs(360));}}
  /* STUN PUNCH (LUCK VOLTIA): counter tiap serangan kena; serangan ke-every -> roll stun + atkBuff permanen */
  if(fx.stunPunch&&total>0&&bt.eHp>0){
    bt.punchCount=bt.punchCount||new Array(bt.fighters.length).fill(0);bt.stunGain=bt.stunGain||new Array(bt.fighters.length).fill(0);
    bt.punchCount[a]=(bt.punchCount[a]||0)+1;
    if(bt.punchCount[a]%fx.stunPunch.every===0&&Math.random()*100<fx.stunPunch.chance&&!foeStatusImmune()){
      bt.eStun=Math.max(bt.eStun||0,fx.stunPunch.turns);
      if(bt.stunGain[a]<(fx.stunPunch.max||5)){bt.stunGain[a]++;bt.atkBuff[a]+=fx.stunPunch.atkPct;}
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","STUN! +"+fx.stunPunch.atkPct+"% ATK","crit");},bsMs(360));
    }
  }
  /* EIGHT GATES (GREEN BEAST): gerbang tiap kena -> atkBuff; gerbang penuh -> rugi selfPct% max HP (mati via gateKill) */
  if(fx.eightGates&&total>0&&bt.eHp>0&&bt.pHp>0){
    bt.gateCount=bt.gateCount||new Array(bt.fighters.length).fill(0);
    if(bt.gateCount[a]<fx.eightGates.max){bt.gateCount[a]++;bt.atkBuff[a]+=fx.eightGates.atkPct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GERBANG "+bt.gateCount[a]+"/"+fx.eightGates.max+" +"+fx.eightGates.atkPct+"%","crit");},bsMs(380));}
    if(bt.gateCount[a]>=fx.eightGates.max){
      const gd=Math.max(1,Math.round(bt.pMax*fx.eightGates.selfPct/100));bt.pHp=Math.max(0,bt.pHp-gd);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","HARGA GERBANG -"+fmt(gd),"burn");setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}},bsMs(440));
      if(bt.pHp<=0)bt.gateKill=true;
    }
  }
  /* SHOCK ALL (TREMOR EMPEROR): shockwave flat pct% ATK ke seluruh lineup musuh / aktif (story) */
  if(fx.shockAll&&total>0&&bt.eHp>0){
    const sd=Math.max(1,Math.round(atk*fx.shockAll.pct/100));
    if(bt.tower&&towerRun){lineupAoeHit(sd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GEMPA -"+fmt(sd),"crit");},bsMs(460));}
    else{bt.eHp-=sd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","GEMPA -"+fmt(sd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(460));}
  }
  /* SPLASH (LIGHTBORNE ADMIRAL): tembusan flat pct% ATK ke lineup BERIKUTNYA / aktif lagi (story) */
  if(fx.splash&&total>0&&bt.eHp>0){
    const pd=Math.max(1,Math.round(atk*fx.splash.pct/100));
    if(bt.tower&&towerRun){lineupNextHit(pd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","YASAKANI -"+fmt(pd),"crit");},bsMs(500));}
    else{bt.eHp-=pd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","YASAKANI -"+fmt(pd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(500));}
  }
  setBar("hpFoe","hpFoeT",bt.eHp+total,bt.es.hp);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  /* STATUS IMMUNE: burn musuh dibatalkan tanpa tick damage */
  if(bt.eBurn>0&&foeStatusImmune()){bt.eBurn=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · BURN","heal"),bsMs(300));}
  if(bt.eBurn>0&&bt.eHp>0){
    const bPct=fx.burn?fx.burn.pct:(fx.lowHpAura&&fx.lowHpAura.burn?fx.lowHpAura.burn.pct:0);
    const bd=Math.round(bt.es.hp*bPct/100);bt.eHp-=bd;bt.eBurn--;
    setTimeout(()=>{anim(".fighter.foe","hit");floatText(".fighter.foe","-"+fmt(bd),"burn");if(window.burnSheetTick)burnSheetTick();},bsMs(420));
  }
  if(bt.eHp<=0){
    // mati karena racun (bukan karena sambaran yang sudah dijadwalkan onAnimEnd)
    if(!foeDead)setTimeout(foeDownCb,bsMs(620));
    return;
  }
  schedPhase(galaxy?GALAXY.total+160:ariseMode?2200:domainStrike?1700:ranton?MADARA_T.total+160:1000,enemyPhase);
}
function enemyPhase(){
  if(!bt||bt.over)return;
  bt.foeDowning=false;/* kill berikutnya baru sah setelah giliran ini mulai */
  /* DEATH DEFY selesai: kartu sudah dapat giliran ekstranya (menyerang) -> tumbang sekarang,
     sebelum musuh sempat menyerang balik. Pola penutup = deathStep (turn++ / trySave / playerPhase). */
  if(bt.defyHold){
    bt.defyHold=false;bt.pHp=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","ASHURA FADES","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;
      bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    },bsMs(900));
    return;
  }
  /* DESPERATE STRIKE tuntas: serangan pamungkas sudah dilepaskan -> mati di akhir giliran (trySave normal) */
  if(bt.dsState&&bt.dsState[bt.active]===2){
    bt.dsState[bt.active]=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","LAST GASP","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;
      bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    },bsMs(900));
    return;
  }
  /* EIGHT GATES harga: kartu tumbang di akhir giliran dia (pola dsState) */
  if(bt.gateKill){
    bt.gateKill=false;bt.pHp=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","GERBANG PENUH...","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    },bsMs(900));
    return;
  }
  setTurnPill("foe","GILIRAN MUSUH");
  if(bt.dizzyLeft>0){bt.dizzyLeft--;if(bt.dizzyLeft<=0){bt.dizzyStack=0;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DIZZY HABIS","miss");},bsMs(300));}}
  const id=bt.eq.char,t=bt.turn;let fx=resolveFx(bt.eq,bt.efx);
  if(bt.shadow)fx={};
  const efx=(bt.eAbilityOff>0)?{}:(bt.efx||{});
  let eDomain=false,eArise=false,eranton=false,eGalaxy=false,eIceBlast=false;
  /* FREEZE tick (10TH CAPTAIN): hitungan beku turun tiap giliran musuh — paralel dgn eStun, sebelum blok stun biar bonus ×mult habis pas 2 giliran */
  if(bt.freezeLeft>0)bt.freezeLeft--;
  if(bt.eAbilityOff>0)bt.eAbilityOff--;
  if(bt.copyLeft>0)bt.copyLeft--;
  if(bt.eStun>0){
    if(efx.statusImmune){
      /* STATUS IMMUNE: stun musuh dibatalkan — musuh tetap menyerang */
      bt.eStun=0;
      setTimeout(()=>floatText(".fighter.foe","IMMUNE · STUN","heal"),bsMs(200));
    }else{
      bt.eStun--;
      anim(".fighter.foe","hit",true);
      setTimeout(()=>floatText(".fighter.foe","STUNNED","crit"),bsMs(200));
      bt.turn++;
      schedPhase(1000,playerPhase);
      return;
    }
  }
  /* ===== MIRROR PASSIVE LAWAN - DoT burn pemain + proc serangan sisi musuh ===== */
  if((bt.pBurn||0)>0&&fx.statusImmune){bt.pBurn=0;setTimeout(()=>floatText(".fighter.me","IMMUNE - BURN","heal"),bsMs(300));}
  if((bt.pBurn||0)>0&&bt.pHp>0){
    const pbPct=efx.burn?efx.burn.pct:(efx.lowHpAura&&efx.lowHpAura.burn?efx.lowHpAura.burn.pct:0);
    const pbd=Math.round(bt.pMax*pbPct/100);bt.pHp=Math.max(0,bt.pHp-pbd);bt.pBurn--;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","-"+fmt(pbd),"burn");if(window.burnSheetTick)burnSheetTick("me");}},bsMs(420));
    if(bt.pHp<=0){bt.turn++;setTimeout(()=>{if(bt&&!bt.over){if(!trySave())endBattle(false);}},bsMs(800));return;}
  }
  if(bt.pHp>0&&bt.eHp>0){
    const eA=bt.es.atk;
    if(efx.wallTitans){bt.eWt=(bt.eWt||0)+1;if(bt.eWt%efx.wallTitans.every===0){const d2=Math.round(eA*efx.wallTitans.pct/100);bt.pHp=Math.max(0,bt.pHp-d2);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","WALL TITANS -"+fmt(d2),"burn");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(520));}}
    if(efx.shockwave){bt.eShock=(bt.eShock||0)+1;if(bt.eShock%efx.shockwave.every===0){const d2=Math.round(eA*efx.shockwave.pct/100);bt.pHp=Math.max(0,bt.pHp-d2);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","SHOCKWAVE -"+fmt(d2),"burn");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(560));}}
    if(efx.havocRocket){bt.eHv=(bt.eHv||0)+1;if(bt.eHv%efx.havocRocket.every===0){const d2=Math.round(eA*efx.havocRocket.pct/100);bt.pHp=Math.max(0,bt.pHp-d2);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","DEATH ROCKET -"+fmt(d2),"burn");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(560));}}
    if(efx.shockAll){const d2=Math.max(1,Math.round(eA*efx.shockAll.pct/100));bt.pHp=Math.max(0,bt.pHp-d2);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","GEMPA -"+fmt(d2),"burn");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(460));}
    if(efx.splash){const d2=Math.max(1,Math.round(eA*efx.splash.pct/100));bt.pHp=Math.max(0,bt.pHp-d2);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","YASAKANI -"+fmt(d2),"burn");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(500));}
    if(efx.maxCorrupt){bt.pMax=Math.max(1,Math.round(bt.pMax*(100-efx.maxCorrupt.pct)/100));if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","MAX HP CORRUPT","burn");setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}},bsMs(340));}
    if(efx.burn&&Math.random()*100<efx.burn.chance){if(fx.statusImmune){setTimeout(()=>floatText(".fighter.me","IMMUNE","heal"),bsMs(360));}else{bt.pBurn=(bt.pBurn||0)+efx.burn.turns;setTimeout(()=>floatText(".fighter.me","BURN","burn"),bsMs(360));}}
    if(efx.lowHpAura&&efx.lowHpAura.burn&&bt.eHp<bt.es.hp*efx.lowHpAura.below/100){if(fx.statusImmune){setTimeout(()=>floatText(".fighter.me","IMMUNE","heal"),bsMs(360));}else{bt.pBurn=(bt.pBurn||0)+efx.lowHpAura.burn.turns;setTimeout(()=>floatText(".fighter.me","PERFECT SUSANOO","burn"),bsMs(360));}}
    if(efx.hitFreeze&&Math.random()*100<efx.hitFreeze.chance){if(fx.statusImmune){setTimeout(()=>floatText(".fighter.me","IMMUNE","heal"),bsMs(360));}else{bt.pStun=Math.max(bt.pStun||0,efx.hitFreeze.turns);bt.pFreeze=efx.hitFreeze.turns;setTimeout(()=>floatText(".fighter.me","BEKU","crit"),bsMs(360));}}
    if(efx.stunPunch){bt.ePunchN=(bt.ePunchN||0)+1;if(bt.ePunchN%efx.stunPunch.every===0&&Math.random()*100<efx.stunPunch.chance&&!fx.statusImmune){bt.pStun=Math.max(bt.pStun||0,efx.stunPunch.turns);setTimeout(()=>floatText(".fighter.me","STUN!","crit"),bsMs(360));}}
    if(efx.timeStop){bt.eTsN=(bt.eTsN||0)+1;if(bt.eTsN%efx.timeStop.every===0&&!fx.statusImmune){bt.pStun=Math.max(bt.pStun||0,efx.timeStop.turns);setTimeout(()=>floatText(".fighter.me","THE WORLD","crit"),bsMs(360));}}
    if(bt.pHp<=0){bt.turn++;setTimeout(()=>{if(bt&&!bt.over){if(!trySave())endBattle(false);}},bsMs(800));return;}
  }
  // DOMAIN aktif ronde ini (Gojo): damage musuh dikurangi 50%
  const domainOn = bt.domainNow;
  const pa=bt.active;
  const entryTrig=!!(fx.entryCounter&&bt.entryGuard[pa]);
  const dodgeTrig=!!(fx.dodgeEvery&&bt.dodgeArmed[pa]);
  /* PIERCE lawan (Promised Child, Namekian, Limitless, Heaven's Door, Shinobu): tembus total pertahanan pemain */
  const ePierce=!!(efx.pierce&&Math.random()*100<efx.pierce);
  const evade=!ePierce&&!!(entryTrig||dodgeTrig||(fx.evasion&&t<=fx.evasion.turns&&Math.random()*100<fx.evasion.chance)||(fx.dodgeAtk&&Math.random()*100<fx.dodgeAtk.chance)||bt.trickNext);
  const eVoid=!!(efx.void&&Math.random()*100<efx.void);
  if(evade){
    if(entryTrig)bt.entryGuard[pa]=false;
    if(dodgeTrig)bt.dodgeArmed[pa]=false;
    /* ULTRA INSTINCT: tiap berhasil menghindar → +pct% ATK permanen, stack sampai max (khusus dodgeAtk; evasion biasa gak kepengaruh) */
    if(fx.dodgeAtk&&fx.dodgeAtk.nextOnly){bt.dodgeNext=bt.dodgeNext||new Array(bt.fighters.length).fill(0);bt.dodgeNext[bt.active]=(bt.dodgeNext[bt.active]||0)+fx.dodgeAtk.pct;}else if(fx.dodgeAtk&&bt.dodgeStack[bt.active]<fx.dodgeAtk.max){bt.dodgeStack[bt.active]++;bt.atkBuff[bt.active]+=fx.dodgeAtk.pct;setTimeout(()=>floatText(".fighter.me","+"+fx.dodgeAtk.pct+"% ATK","heal"),bsMs(420));}
    if(id==="CH_EX_MADARA"){
      anim(".fighter.foe","lunge-l");
      setTimeout(()=>floatText(".fighter.me","LIMBO","miss"),bsMs(220));
    }else{
      setTimeout(()=>{playDodge();floatText(".fighter.me",entryTrig?(fx.entryCounter.text||"AMENOTEJIKARA"):bt.trickNext?"TRICKSTER":"DODGE","miss");},bsMs(200));
    }
    /* AMENOTEJIKARA counter: balasan instan mult× ATK ke musuh (dilewati kalau mult 0 = klon murni menghindar) */
    if(entryTrig){
      const cAtk=Math.round(cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk*(1+(bt.atkBuff[pa]||0)/100)*(fx.entryCounter.mult||0));
      if(cAtk>0){
        bt.eHp-=cAtk;
        setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","COUNTER -"+fmt(cAtk),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(520));
        if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
      }
    }
  }else if(eVoid){
    anim(".fighter.foe","lunge-l");
    const vh=Math.round(bt.es.atk*efx.void/100*2);
    setTimeout(()=>floatText(".fighter.me","VOID","miss"),bsMs(200));
    if(bt.eHp>0){bt.eHp=Math.min(bt.es.hp,bt.eHp+vh);setTimeout(()=>floatText(".fighter.foe","+"+fmt(vh),"heal"),bsMs(420));setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);}
  }else{
    let eAtk=bt.es.atk,edmgMult=1;
if(bt.ePoison>0)eAtk=Math.max(1,Math.round(eAtk*(1-Math.min(90,bt.ePoison)/100)));
    if((bt.eInk||0)>0&&bt.eInkPct>0)eAtk=Math.max(1,Math.round(eAtk*(1-(bt.eInk*bt.eInkPct)/100)));
    if(efx.lowHpAtk&&bt.eHp<bt.es.hp*efx.lowHpAtk.below/100)eAtk=Math.round(eAtk*(1+efx.lowHpAtk.bonus/100));
    if(efx.dmgMult)edmgMult*=efx.dmgMult;
    if(efx.highHpDmg&&bt.eHp>bt.es.hp*efx.highHpDmg.above/100)edmgMult*=(1+efx.highHpDmg.bonus/100);
    const eHits=[{mult:1}];let ecrit=false,epurple=false,eBarrageN=0;
    if(typeof efx.double==="object"){if(Math.random()*100<(efx.double.chance!=null?efx.double.chance:100))eHits.push({mult:(efx.double.pct!=null?efx.double.pct:100)/100});}else if(efx.double&&Math.random()*100<efx.double)eHits.push({mult:1});
    if(efx.crit&&Math.random()*100<efx.crit.chance){ecrit=true;eHits[eHits.length-1].mult*=efx.crit.mult;}
    else if(Math.random()*100<BASE_CRIT.chance){ecrit=true;eHits[eHits.length-1].mult*=BASE_CRIT.mult;}
    if(efx.purple&&Math.random()*100<efx.purple.chance){epurple=true;ecrit=true;eHits[eHits.length-1].mult*=efx.purple.mult;}
    if(efx.ranton&&Math.random()*100<efx.ranton.chance){eranton=true;ecrit=true;eHits.length=0;const rh=Math.max(1,efx.ranton.hits||5),rm=efx.ranton.mult||1;for(let k=0;k<rh;k++)eHits.push({mult:rm});}
    if(efx.barrage&&Math.random()*100<efx.barrage.chance){const n=efx.barrage.min+Math.floor(Math.random()*(efx.barrage.max-efx.barrage.min+1));const bm=efx.barrage.mult||1;if(bm!==1){eHits.length=0;for(let i=0;i<n;i++)eHits.push({mult:bm});}else{while(eHits.length<n)eHits.push({mult:1});}eBarrageN=eHits.length;}
    if(eranton&&!eBarrageN)eBarrageN=eHits.length;
    /* ICE BLAST (kartu BOSS sebagai LAWAN): N tembakan @ pct% ATK */
    if(efx.iceBlast&&Math.random()*100<efx.iceBlast.chance){const n=Math.max(1,efx.iceBlast.hits||3),pm=(efx.iceBlast.pct!=null?efx.iceBlast.pct:100)/100;eHits.length=0;for(let i=0;i<n;i++)eHits.push({mult:pm});eIceBlast=true;eBarrageN=n;}
    if(efx.domain&&bt.eid==="CH_EX_GOJO"&&Math.random()*100<(efx.domain.chance||100)){const dn=efx.domain.min||10,dm=(efx.domain.mult!=null?efx.domain.mult:.3);eHits.length=0;for(let i=0;i<dn;i++)eHits.push({mult:dm});eBarrageN=dn;ecrit=false;epurple=false;eranton=false;eDomain=true;}
    eArise=bt.eid==="CH_EX_JINWOO"&&eBarrageN>=9;
    eGalaxy=bt.eid==="CH_ETERNAL_DRAGON"&&epurple;
    if(eGalaxy){const m=eHits[eHits.length-1].mult;eHits.length=0;eHits.push({mult:m});eBarrageN=0;}
    let etotal=0;const eShots=eHits.map(h=>{let d=Math.round(eAtk*edmgMult*h.mult);let drR=(bt.pDrTurns>0&&bt.pDr>0)?bt.pDr:0;if((bt.pGuardDr||0)>drR)drR=bt.pGuardDr;if(drR>0&&!ePierce){d=Math.round(d*(1-drR/100));}etotal+=d;return{d,pierce:ePierce};});
    /* ROYALGUARD: damage masuk dipangkas 50% (dibalas 30% di bawah) */
    if(!ePierce&&bt.royalNow&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*0.5));etotal=eShots.reduce((x,s)=>x+s.d,0);}
    /* PERFECT SUSANOO (low HP): damage masuk dipangkas `dr`% */
    if(!ePierce&&fx.lowHpAura&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.lowHpAura.dr/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);setTimeout(()=>floatText(".fighter.me","PERFECT SUSANOO","heal"),bsMs(320));}
    /* PSYCHIC BLIZZARD (BLIZZARD BADDIE): barrier aktif -> pangkas damage `dr`% + heal `healPct`% max HP per serangan yang diredam; barrier habis setelah `left` giliran */
    if(!ePierce&&bt.psychic&&bt.psychic.left>0&&etotal>0){
      eShots.forEach(s=>s.d=Math.round(s.d*(1-bt.psychic.dr/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);
      const bh=Math.max(1,Math.round(bt.pMax*bt.psychic.healPct/100));
      bt.pHp=Math.min(bt.pMax,bt.pHp+bh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","PSYCHIC BARRIER +"+fmt(bh),"heal");},bsMs(360));
      bt.psychic.left--;
      if(bt.psychic.left<=0)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BARRIER HABIS","miss");},bsMs(520));
    }
    /* ICE SHELL (10TH CAPTAIN): selama kartu ini AKTIF di arena, damage masuk dipangkas `iceShell`% permanen (tanpa timer; hilang pas tag-out) */
    if(!ePierce&&fx.iceShell&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.iceShell/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}
   /* TWILIGHT OF VALHALLA (HEIGHT OF PAINTING): selama aktif, damage masuk dipangkas dmgCut% */
   if(!ePierce&&fx.valhalla&&(bt.valhallaLeft||0)>0&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.valhalla.dmgCut/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}
   /* INK WARD (INK ANAMLOY): selama kartu aktif, damage masuk dipangkas dmgCut% (pola iceShell) */
   if(!ePierce&&fx.dmgCut&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.dmgCut.pct/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}

    /* RUBBER FIELD (SUN GOD): serangan dipotong 50%, sisanya disimpan buat memantul balik + penyerang jadi DIZZY */

    bt.rbBounce=0;

    if(!ePierce&&bt.rubber&&etotal>0){

      const full=etotal;

      eShots.forEach(s=>s.d=Math.round(s.d*0.5));etotal=eShots.reduce((x,s)=>x+s.d,0);

      bt.rbBounce=full-etotal;

      if(!foeStatusImmune()){bt.dizzyStack=(bt.dizzyStack||0)+1;bt.dizzyLeft=9;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DIZZY x"+bt.dizzyStack,"burn");},bsMs(420));}

    }
    /* EVOLUTION TURRET (YORDLE INVENTOR): kena serangan -> chance% turret nahan semua damage, 1 turret hancur */
    if(!ePierce&&fx.turret&&bt.turret>0&&etotal>0&&Math.random()*100<fx.turret.blockPct){
      etotal=0;eShots.forEach(s=>s.d=0);bt.turret--;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TURRET BLOCK! sisa "+bt.turret,"crit");},bsMs(320));
    }    /* GUM-GUM BALLOON (DUMB STRETCHY GUY): reflect % dari hit musuh berikutnya (sekali pakai) */
    if(!ePierce&&bt.balloon>0&&etotal>0){
      const rd=Math.max(1,Math.round(etotal*bt.balloon/100));
      bt.balloon=0;bt.eHp-=rd;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BALLOON -"+fmt(rd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(380));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));}
    }
    if(bt.pDrTurns>0&&bt.pDr>0){bt.pDrTurns--;setTimeout(()=>floatText(".fighter.me","DR aktif","heal"),bsMs(340));}
    /* BUNGEE GUM: tiap kali musuh KENA menempel ke Trickster (serangan masuk), tempel/renew gum 2 giliran */
    if(fx.bungeeGum&&etotal>0){bt.gumTurns=fx.bungeeGum.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","BUNGEE GUM","crit");},bsMs(300));}
    /* GODHAND CAUSALITY (WHITE HAWK): diserang & kena -> ability musuh dimatikan permanen */
    if(fx.stripAbility&&etotal>0){bt.eAbilityOff=999;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GODHAND - ABILITY ERASED","crit");},bsMs(300));}
    const meStart=bt.pHp;
    bt.pHp-=etotal;
    if(fx.valhalla&&(bt.valhallaLeft||0)>0&&bt.pHp<1){bt.pHp=1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT HOLD!","heal");},bsMs(300));}
    /* REVERSAL (TIME MASTER): serangan mematikan PERTAMA dibalik -> 1 HP (sekali) */
    if(fx.reversal&&bt.pHp<=0){bt.reversalUsed=bt.reversalUsed||new Array(bt.fighters.length).fill(false);if(!bt.reversalUsed[bt.active]){bt.reversalUsed[bt.active]=true;bt.pHp=1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOLD EXPERIENCE REQUIEM!","crit");},bsMs(400));}}
    /* CAUSALITY (ASTRAL DEVOURER): fatal -> balik ke HP awal giliran sebelumnya + atkBuff */
    if(fx.causality&&bt.pHp<=0){bt.causalUsed=bt.causalUsed||new Array(bt.fighters.length).fill(false);if(!bt.causalUsed[bt.active]){bt.causalUsed[bt.active]=true;bt.pHp=Math.max(1,bt.causalPrev||bt.pMax);bt.atkBuff[bt.active]+=fx.causality.atkPct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","KAUSALITAS DIBALIK! +"+fx.causality.atkPct+"% ATK","crit");},bsMs(400));}}
    const pDead=bt.pHp<=0&&!(fx.berserker&&bt.berserkOn&&(bt.berserkLeft||0)>0);
    // kartu tumbang: tag-in / kalah BARU dijalankan setelah seluruh animasi sambaran musuh selesai
    const deathStep=()=>{
      if(!bt||bt.over)return;
      if(domainOn){bt.domainNow=false;}
      bt.turn++;
      /* DEATH STAY (TREMOR EMPEROR): fatal -> bertahan 1 giliran extra (masih menyerang), jatuh di awal enemyPhase berikutnya */
      if(fx.deathStay){bt.stayUsed=bt.stayUsed||new Array(bt.fighters.length).fill(false);if(!bt.stayUsed[bt.active]){bt.stayUsed[bt.active]=true;bt.defyHold=true;bt.pHp=1;setBar("hpMe","hpMeT",1,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GURA GURA HOLD!","crit");},bsMs(400));schedPhase(1100,playerPhase);return;}}
      /* DEATH DEFY (THREEBLADE RONIN): fatal saat HP sebelum pukulan masih < pct% max
         -> TIDAK tumbang: bertahan di 0 HP, dapat 1 giliran ekstra (masih bisa menyerang),
         lalu jatuh di awal enemyPhase berikutnya. Sekali per battle. (fx={}=saat shadow -> gak trigger) */
      if(fx.deathDefy&&!bt.defyUsed[bt.active]&&meStart<bt.pMax*fx.deathDefy.pct/100){
        bt.defyUsed[bt.active]=true;bt.defyHold=true;bt.pHp=0;
        setBar("hpMe","hpMeT",0,bt.pMax);
        setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","ASHURA STANDS","crit");},bsMs(400));
        schedPhase(1100,playerPhase);
        return;
      }
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    };
    performAttack({
      A:".fighter.foe",D:".fighter.me",id:bt.eid,fx:efx,
      barId:"hpMe",barTid:"hpMeT",defMax:bt.pMax,
      defHpStart:meStart,defHpEnd:Math.max(0,bt.pHp),
      shots:eShots,total:etotal,crit:ecrit,purple:epurple,
      ranton:eranton,domainStrike:eDomain,ariseMode:eArise,barrageN:eBarrageN,galaxy:eGalaxy,iceBlast:eIceBlast,
      onAnimEnd:pDead?deathStep:null,
      recharge:(b)=>{if(!bt)return;bt.eStun=b.selfStun;setTimeout(()=>floatText(".fighter.foe","RECHARGE","miss"),bsMs(1200));}
    });
    setBar("hpMe","hpMeT",meStart,bt.pMax);
    if(efx.lifesteal&&etotal>0&&bt.eHp>0){
      const lh=Math.round(etotal*efx.lifesteal/100);bt.eHp=Math.min(bt.es.hp,bt.eHp+lh);
      setTimeout(()=>floatText(".fighter.foe","+"+fmt(lh),"heal"),bsMs(280));
      setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    }
        /* MIRROR INK DRAIN: musuh heal pct% dari damage yang baru DIBERIKAN */
    if(efx.inkDrain&&etotal>0){bt.ePaint=(bt.ePaint||0)+1;if(bt.ePaint%efx.inkDrain.every===0){const ih=Math.max(1,Math.round(etotal*efx.inkDrain.pct/100));bt.eHp=Math.min(bt.es.hp,bt.eHp+ih);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);setTimeout(()=>floatText(".fighter.foe","INK DRAIN +"+fmt(ih),"heal"),bsMs(320));}}
    /* COUNTER HIT (DRAGON SIN base atk / BLOODMOON base foeMaxHp): kena serangan -> balas flat */
  if(fx.counterHit&&etotal>0&&bt.eHp>0&&Math.random()*100<fx.counterHit.chance){
    const cb=(fx.counterHit.base==="foeMaxHp")?bt.es.hp:cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
    const cd=Math.max(1,Math.round(cb*fx.counterHit.pct/100));
    bt.eHp-=cd;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe",(fx.counterHit.base==="foeMaxHp"?"BLOOD IGNITE -":"FULL COUNTER -")+fmt(cd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
  }
  /* ROYALGUARD counter: balas 30% dari damage yang baru diterima ke musuh */
    if(bt.royalNow&&!pDead&&etotal>0){
      const ctr=Math.round(etotal*0.3);bt.eHp-=ctr;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","COUNTER -"+fmt(ctr),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
        /* RUBBER FIELD bounce: separuh damage serangan musuh memantul balik ke penyerang */

    if(bt.rbBounce>0&&!pDead){

      const rb=bt.rbBounce;bt.rbBounce=0;

      bt.eHp-=rb;

      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUBBER -"+fmt(rb),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));

      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}

    }

    if(pDead)return;
  }
  /* WORLD CORRUPT (THE GRIEFER): counter giliran musuh; tiap every -> musuh self-hit + party +dmgUp% dmg */
  if(bt.wc&&bt.eHp>0&&bt.pHp>0){
    bt.wc.c++;
    if(bt.wc.c%bt.wc.every===0){
      const wd=Math.max(1,Math.round(bt.wc.atk*bt.wc.pct/100));
      bt.eHp-=wd;
      for(let i=0;i<bt.fighters.length;i++)bt.atkBuff[i]=(bt.atkBuff[i]||0)+bt.wc.dmgUp;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","GLITCH! -"+fmt(wd),"crit");floatText(".fighter.me","+"+bt.wc.dmgUp+"% DMG","heal");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(500));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
  }
  if(domainOn){bt.domainNow=false;}
  bt.turn++;
  schedPhase(bt.justTagged?2700:(eGalaxy?GALAXY.total+160:eArise?2200:eDomain?1700:eranton?MADARA_T.total+160:1000),playerPhase);
}
function endBattle(win){
  if(!bt||bt.over)return;
  if(bt.timer){clearTimeout(bt.timer);bt.timer=null;}
  bt.over=true;
  /* klimaks: kartu yang kalah beneran tumbang (dulu final death gak ada animasi mati sama sekali) */
  try{
    const deadEl=document.querySelector(win?".fighter.foe":".fighter.me");
    if(deadEl&&!deadEl.classList.contains("ko")){deadEl.classList.add("ko");koFx(deadEl);}
  }catch(e){console.error("endBattle fx error",e);}
  setTimeout(()=>{
    try{
      if(bt&&bt.tower){ towerEnd(win); }
      else if(bt){ finish(win); }
      /* bt keburu di-null tapi masih di tower battle → tetap tutup lewat towerEnd
         (null-safe utk bt) supaya pendingRolls cair, popup roll muncul & pemain balik hub. */
      else if(towerRun&&towerView==="battle"){ towerEnd(win); }
      else{ console.error("endBattle: no battle context, win="+win); }
    }catch(err){
      console.error("finish error",err);
      let recovered=false;
      try{ if(!win&&towerRun){ towerEnd(false); recovered=true; } }catch(e2){ console.error("towerEnd retry error",e2); }
      try{save();}catch(e){}
      if(recovered)return;
      bt=null;state.battle=null;render();
    }
  },bsMs(win?2000:950));
}
function finish(win){
  clearTimeout(bt.timer);bt.over=true;
  const lv=bt.lv,first=!diffProg()[state.diff][lv];
  const reward=win?(first?firstClearReward(lv):Math.round(firstClearReward(lv)*.2)):0;
  if(win){state.cleared[lv]=true;diffProg()[state.diff][lv]=true;state.coins+=reward;state.xp+=20;
    while(state.xp>=state.playerLv*1000){state.xp-=state.playerLv*1000;state.playerLv++;}
    fanfare();
  }else sfx.lose();
  state.history.unshift({char:bt.eq.char,tier:bt.eq.tier,enemy:bt.en.name+(bt.en.boss?", "+bt.en.epithet:""),boss:bt.en.boss,level:lv,result:win?"VICTORY":"DEFEAT"});
  state.history=state.history.slice(0,120);
  save();renderShell();
  const ov=document.getElementById("overlay");
  const ch=chapOf(lv),chDone=win&&chapClearedMode(ch,state.diff),nxtCh=CHAPTERS.find(c=>c.no===ch.no+1);
  document.getElementById("ov-eyebrow").textContent=chDone?"VICTORY · BAB "+ch.no+" SELESAI ("+diffOf().l+")":win?(first?"VICTORY · FIRST CLEAR":"VICTORY · REPLAY"):"DEFEAT";
  const ti=document.getElementById("ov-title");ti.textContent=win?"VICTORY":"DEFEAT";ti.className="ov-title disp"+(win?"":" lose");
  const rw=document.getElementById("ov-reward");rw.style.display=win?"inline-flex":"none";
  rw.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5h4.5a2 2 0 0 1 0 4H10a2 2 0 0 0 0 4h5"/></svg> +'+reward+' <small>COINS</small>';
  document.getElementById("ov-note").textContent=win?(first?"Reward first clear":"Reward replay 20%")+" · "+bt.turn+" turn":"Kartu kalah — upgrade atau ganti kartu aktif.";
  const nx=document.getElementById("ov-next");nx.style.display="";
  if(win&&lv<ch.to){
    nx.textContent="LEVEL "+(lv+1)+" →";
    nx.onclick=()=>{ov.classList.remove("show");state.battle={level:lv+1};render();};
  }else if(win&&nxtCh){
    nx.textContent="KEMBALI";
    nx.onclick=()=>{ov.classList.remove("show");state.battle=null;render();};
  }else{
    nx.textContent="SELESAI";
    nx.onclick=()=>{ov.classList.remove("show");state.battle=null;render();};
  }
  document.getElementById("ov-again").onclick=()=>{ov.classList.remove("show");state.battle={level:lv};render();};
  ov.classList.add("show");
}
document.getElementById("overlay").addEventListener("click",e=>{
  if(e.target.id!=="overlay")return;
  document.getElementById("overlay").classList.remove("show");
  if(bt&&bt.tower){stopBattleLoop();towerView="hub";render();return;}
  if(state.battle){state.battle=null;bt=null;render();}
});
let towerLossAutoPending=false; /* auto-restart tower: nunggu popup roll ditutup (reset di stopTower/towerStartRun) */
let rollPopTimer=null; /* auto-claim popup hasil roll: 5 detik tutup sendiri biar AFK/auto-run gak macet */
function closeRollPop(){ if(rollPopTimer){clearTimeout(rollPopTimer);rollPopTimer=null;} const pop=document.getElementById("rollResultPop"); if(pop)pop.classList.remove("show"); rollPopClosed(); }
function armRollPopAutoClose(ms){
  if(rollPopTimer)clearTimeout(rollPopTimer);
  rollPopTimer=setTimeout(()=>{
    rollPopTimer=null;
    const pop=document.getElementById("rollResultPop");
    if(!pop||!pop.classList.contains("show"))return;
    try{sfx.hit();}catch(e){}
    pop.classList.remove("show"); /* kartu+potion SUDAH tersimpan (instantRoll save()) — ini tampilan doang: tutup = auto-claim */
    rollPopClosed();
  },ms);
}
function rollPopClosed(){ if(!towerLossAutoPending)return; towerLossAutoPending=false; if(state&&state.tower&&state.tower.auto){ try{ towerStartRun(); }catch(e){ console.error("tower auto-restart error",e); } } }
document.getElementById("rrClose").onclick=()=>{try{sfx.hit();}catch(e){}closeRollPop();};
document.querySelector("#rollResultPop .rr-back").onclick=()=>{closeRollPop();};

