/* =============== TOWER (menara tanpa ujung) ===============
   Mode endless: lantai naik terus, tiap 5 lantai = gerbang BOS (2 gelombang: utama + TAG).
   Memakai engine battle cerita (2 arah, passive musuh) dengan flag bt.tower. */
const TOWER_BOSS_ROSTER=[
  {main:"CH_SHADOW_MONARCH",tag:"CH_RULER"},   /* lantai 5, 15, 25 ... */
  {main:"CH_ALMIGHTY_TYRANT",tag:"CH_DEMON_SLIME"} /* lantai 10, 20, 30 ... */
];
function towerIsBossFloor(f){return f%5===0;}
/* ===== DROP INSTAN PACK PER LANTAI (Inf Tower) =====
   BASE rate, TIDAK dipengaruhi luck player. 50K tidak ada drop Tower. */
const TOWER_PACK_DROPS=[
  {k:'r5k',  p:0.05,  name:'INSTANT ROLL 5,000',  icon:'assets/images/instanpack-5k.webp?v=trans1',  label:'5%'},
  {k:'r10k', p:0.02,  name:'INSTANT ROLL 10,000', icon:'assets/images/instanpack-10k.webp?v=trans1', label:'2%'},
  {k:'r25k', p:0.01,  name:'INSTANT ROLL 25,000', icon:'assets/images/instanpack-25k.webp?v=trans1', label:'1%'},
  {k:'r100k',p:0.005, name:'INSTANT ROLL 100,000',icon:'assets/images/instanpack-100k.webp?v=trans1',label:'0.5%'}
];
function towerBossIndex(f){return ((f/5)-1)%TOWER_BOSS_ROSTER.length;}
function towerHash(n){return (((n*2654435761)>>>0)%100000)||0;}
/* Pool musuh menara: semua kartu non-eksklusif + gate kartu BOSS (sama dgn roll: terkunci sebelum dibeli). */
function towerRegularPool(){return MASTER_CARD_INDEX.filter(c=>!c.noGacha&&(!(c.raidBoss||c.towerBoss)||bossRollUnlocked(c.char_id)));}
/* Kurva kesulitan absolut (tidak ikut membengkak oleh stat mentah kartu EX).
   Kartu musuh hanya menentukan identitas/art/passive; HP & ATK ditentukan lantai.
   TIER itu kosmetik — tidak ada lagi stat scaling berdasarkan tier. */
const TOWER_TIER_K={R:1,SR:1,SSR:1,UR:1,EX:1};
function towerEnemyHP(f){return Math.max(1,Math.floor(f||1))*1000;}
function towerEnemyATK(f){return Math.max(1,Math.floor(f||1))*500;}
function towerMakeWave(charId,f,isBoss,role){
  try { const c=CARDS[charId]; if(!c)return null;
  const hpK=isBoss?(role==="main"?2.2:1.4):1;
  const atkK=isBoss?(role==="main"?1.35:1.15):1;
  const tk=TOWER_TIER_K[c.tier]||1;
  const es={hp:Math.round(towerEnemyHP(f)*hpK*tk),atk:Math.round(towerEnemyATK(f)*atkK*tk)};
  const eid=charId,efx=PASSIVE_FX[eid]||{};const en={id:eid,name:c.name,epithet:isBoss?(role==="main"?"FLOOR BOSS":"TAG GUARDIAN"):c.type,img:c.sprite_asset||'_placeholder.boss',boss:!!isBoss,tier:c.tier,mut:"none"};
  return {en,es,eid,efx};} catch(e){console.error("towerMakeWave error:",e);return null;}
  const hpK=isBoss?(role==="main"?2.2:1.4):1;
  const atkK=isBoss?(role==="main"?1.35:1.15):1;
  const tk=TOWER_TIER_K[c.tier]||1;
  const es={hp:Math.round(towerEnemyHP(f)*hpK*tk),atk:Math.round(towerEnemyATK(f)*atkK*tk)};
  const eid=charId,efx=PASSIVE_FX[eid]||{};
  const en={id:eid,name:c.name,epithet:isBoss?(role==="main"?"FLOOR BOSS":"TAG GUARDIAN"):c.type,img:c.sprite_asset,boss:!!isBoss,tier:c.tier,mut:"none"};
  return {en,es,eid,efx};
}
function towerWaves(f){
  const boss=towerIsBossFloor(f);
  const p=towerRegularPool();
  const pick=i=>p.length?p[towerHash(f*4+i)%p.length].char_id:null;
  const ws=[];
  if(boss){
    const r=TOWER_BOSS_ROSTER[towerBossIndex(f)];
    ws.push(towerMakeWave(r.main,f,true,"main"));
    ws.push(towerMakeWave(r.tag,f,true,"tag"));
    if(p.length){ ws.push(towerMakeWave(pick(2),f,true,"tag")); ws.push(towerMakeWave(pick(3),f,true,"tag")); }
  } else {
    for(let i=0;i<4;i++){ const id=pick(i); if(!id)break; ws.push(towerMakeWave(id,f,false,i===0?"main":"tag")); }
  }
  return ws.filter(Boolean);
}
function towerReward(f){const boss=towerIsBossFloor(f);return {coins:boss?(500+f*60):(150+f*30),starStone:0,potion:boss?2:1};}
let towerView="hub", towerRun=null;
function stopTower(){
  towerLossAutoPending=false;
  if(bt&&bt.tower){ if(bt.timer)clearTimeout(bt.timer); bt=null; }
  /* Run ditinggal (END / pindah menu) sebelum kalah: tetap cairkan roll yang sudah ditabung biar nggak hangus. */
  if(towerRun&&(towerRun.pendingRolls||0)>0){
    const n=towerRun.pendingRolls; const loot=instantRoll(n); towerRun.pendingRolls=0;
    /* Popup hasil roll tetap BIKIN pack + artefak/pet ikut tampil (icon sama dgn backpack). */
    if(loot&&loot.length)showTowerLoot(loot,towerRun.drops,null,{packDrops:towerRun.packDrops||{},rareDrops:towerRun.rareDrops||[]}); else toast("TOWER ROLLS WITHDRAWN","+"+n+" CARDS","#7df9ff");
  }
  towerView="hub"; towerRun=null;
}
function towerFoeHtml(w){
  const en=w.en,es=w.es,curHp=(w.hp!=null?w.hp:es.hp),pct=Math.max(0,Math.min(100,curHp/es.hp*100));
  const m=w.mut||(en&&en.mut)||'';
  return `<div class="fighter foe foe-enter${mutGlow(m)}"${mutEdge(m)} data-tier="${en.tier||''}">
    ${typeof foeFighterInnerHtml==="function"?foeFighterInnerHtml(en,es,{subtitle:en.epithet,curHp:curHp,mut:m}):`
    <div class="f-banner"><img src="${en.img}" alt="${en.name}"><div class="f-name">${en.name}</div></div>
    <div class="hpbar"><i id="hpFoe" style="width:${pct}%"></i><span id="hpFoeT">${fmt(curHp)} / ${fmt(es.hp)}</span></div>
    <div class="f-body">
      <div class="f-title">${en.epithet}</div>
      <div class="f-skill">${en.id?passiveName(en.id):"Enemy"}</div>
      <div class="stat-row"><div class="stat hp"><i>HP</i> <b>${fmtStat(es.hp)}</b></div><div class="stat atk"><i>ATK</i> <b>${fmtStat(es.atk)}</b></div></div>
    </div>`}
  </div>`;
}
function towerEnemyBenchRail(){
  const rem=towerRun?towerRun.waves.slice(towerRun.idx+1):[];
  const cap=towerRun?`TOWER WAVE QUEUE (WAVE ${towerRun.idx+1}/${towerRun.waves.length})`:"TOWER WAVE QUEUE";
  let html="";
  for(let i=0;i<3;i++){
    const w=rem[i];
    if(w&&w.en){
      const wHp=(w.hp!=null?w.hp:w.es.hp),wPct=Math.max(0,Math.min(100,Math.round(wHp/w.es.hp*100)));
      const wNum=(towerRun?towerRun.idx+2+i:i+2);
      html+=`<div class="bench-sq foe-sq" data-tier="${w.en.tier||''}" style="border-color:${TIER_COLOR[w.en.tier]||'var(--line)'};${w.dead?'filter:grayscale(1);opacity:.55;':''}" title="Wave ${wNum}: ${w.en.name} (${fmt(wHp)}/${fmt(w.es.hp)} HP)"><span class="bench-mini-tier">W${wNum} · ${w.en.tier||'SR'}</span><img src="${w.en.img}" alt="${w.en.name}"><span class="bhp"><i style="width:${wPct}%"></i></span>${w.dead?'<b style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#ff5c5c;font-weight:800;font-size:11px;z-index:5">KO</b>':''}</div>`;
    } else {
      html+=`<div class="bench-sq empty">—</div>`;
    }
  }
  return `<div class="bench-rail foe-rail" data-caption="${cap}">${html}</div>`;
}
function towerFoeSide(w){return towerFoeHtml(w)+towerEnemyBenchRail();}
// class foe-enter punya spesifisitas lebih tinggi dari .fighter.hit → hapus begitu animasi masuk selesai biar kartu musuh bisa bergoyang kena pukul
function clearFoeEnter(){setTimeout(()=>{const e=document.querySelector(".fighter.foe.foe-enter");if(e)e.classList.remove("foe-enter");},700);}
function towerEnter(f){
  if(typeof hideRollResult==="function")hideRollResult();
  if(!state.tower)state.tower={best:0};
  if(!towerRun)towerRun={cleared:0,cards:0,coins:0,drops:{weather:0,luck:0,speed:0},tokens:0,pendingRolls:0};
  if(towerRun.pendingRolls==null)towerRun.pendingRolls=0;
  towerRun.floor=f; towerRun.waves=towerWaves(f); towerRun.idx=0;
  towerView="battle";
  render();
}
function towerStartRun(){
  if(typeof hideRollResult==="function")hideRollResult();
  towerLossAutoPending=false;
  if(!state.tower)state.tower={best:0,runs:0,auto:false};
  state.tower.runs=(state.tower.runs||0)+1;
  try{save();}catch(e){}
  towerRun={floor:1,waves:towerWaves(1),idx:0,cleared:0,cards:0,coins:0,drops:{weather:0,luck:0,speed:0},tokens:0,pendingRolls:0,packDrops:{},rareDrops:[]};
  towerView="battle";
  render();
}
let _twPrevRoute="", _twPrevView="", _twClosing=false, _twCurtainT=[];
function _twClearCurtain(){ while(_twCurtainT.length)clearTimeout(_twCurtainT.pop()); }
function _twSetCurtainCopy(mode){
  const kick=document.getElementById("twHZKick"), title=document.getElementById("twHZTitle"),
        sub=document.getElementById("twHZSub"), foot=document.getElementById("twHZFoot"),
        serial=document.getElementById("twHZSerial"), water=document.getElementById("twHZWater");
  const hex=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(serial)serial.textContent=hex;
  if(mode==="open"){
    if(kick)kick.innerHTML="// ENDLESS <b>GAUNTLET</b>";
    if(title)title.textContent="INFINITE TOWER";
    if(water)water.textContent="SPIRE";
    if(sub)sub.textContent="4-WAVE CLIMB \u00b7 100 ROLLS/FLOOR \u00b7 BOSS EVERY 5F";
    if(foot)foot.textContent="ESTABLISHING UPLINK";
  }else{
    if(kick)kick.innerHTML="// LINK <b>STAND BY</b>";
    if(title)title.textContent="STANDBY";
    if(water)water.textContent="OUT";
    if(sub)sub.textContent="SPIRE SESSION SEALED \u2014 BEST RECORD SYNCED";
    if(foot)foot.textContent="RETURN TO LOBBY";
  }
}
function twBannerOpen(){
  const c=document.getElementById("towerCurtain");
  const sh=document.getElementById("tw2Shell");
  _twClearCurtain();
  if(!c){ if(sh)sh.classList.add("is-entered"); return; }
  _twSetCurtainCopy("open");
  if(sh)sh.classList.remove("is-entered","is-leaving");
  c.className="";
  void c.offsetWidth;
  c.classList.add("on","smooth","sweep");
  _twCurtainT.push(setTimeout(()=>{
    c.classList.add("revealed");
    const s=document.getElementById("tw2Shell");
    if(s)s.classList.add("is-entered");
  },940));
  _twCurtainT.push(setTimeout(()=>{
    c.classList.remove("on","smooth","sweep","revealed");
  },1680));
}
function twBannerClose(onCovered){
  const c=document.getElementById("towerCurtain");
  const sh=document.getElementById("tw2Shell");
  _twClearCurtain();
  if(!c){ if(onCovered)onCovered(); return; }
  _twSetCurtainCopy("close");
  if(sh)sh.classList.add("is-leaving");
  c.className="";
  c.classList.add("on","smooth","revealed");
  void c.offsetWidth;
  c.classList.remove("revealed");
  _twCurtainT.push(setTimeout(()=>{
    if(onCovered)onCovered();
    const s=document.getElementById("tw2Shell");
    if(s)s.classList.remove("is-leaving","is-entered");
  },560));
  _twCurtainT.push(setTimeout(()=>c.classList.add("revealed"),780));
  _twCurtainT.push(setTimeout(()=>c.classList.remove("on","smooth","revealed"),1560));
}
window.twBannerOpen=twBannerOpen;
window.twBannerClose=twBannerClose;

if(!window.__tw2RouteTrack){
  window.__tw2RouteTrack=true;
  window.addEventListener("hashchange",()=>{
    const r=typeof route==="function"?route():(location.hash||"#/");
    if(r!=="#/tower"){
      _twPrevRoute=r;
      _twPrevView="";
      _twClosing=false;
    }
  });
}

function closeTowerHub(){
  if(_twClosing)return;
  _twClosing=true;
  try{sfx.hit();}catch(e){}
  twBannerClose(()=>{
    _twClosing=false;
    _twPrevRoute="#/lobby";
    _twPrevView="";
    towerView="hub";
    if(location.hash==="#/lobby"||location.hash===""||location.hash==="#/")render();else location.hash="#/lobby";
  });
}
window.closeTowerHub=closeTowerHub;

let _tw2ShopCat="ALL", _tw2ShopScroll=0, _tw2ShopClosing=false, _infBuyingKind=null;

function closeTowerShop(){
  if(_tw2ShopClosing)return;
  _tw2ShopClosing=true;
  try{sfx.hit();}catch(e){}
  const sh=document.getElementById("tw2ShopShell");
  const finish=()=>{
    _tw2ShopClosing=false;
    _tw2ShopScroll=0;
    towerView="hub";
    render();
  };
  if(sh){
    sh.classList.add("is-leaving");
    setTimeout(finish,140);
  }else{
    finish();
  }
}
window.closeTowerShop=closeTowerShop;

function _tw2EnsureEsc(){
  if(window.__tw2EscWired)return;
  window.__tw2EscWired=true;
  document.addEventListener("keydown",(e)=>{
    if(e.key!=="Escape")return;
    if(typeof route==="function"&&route()!=="#/tower")return;
    if(typeof bt!=="undefined"&&bt&&bt.tower)return;
    if(document.querySelector("#deckModal.show,#rollResultPop.show,#towerDropModal.show,#commandDrawer.open,#backpackPanel.open,#profModal.show"))return;
    if(towerView==="shop"){
      e.preventDefault();
      closeTowerShop();
      return;
    }
    if(towerView!=="hub")return;
    e.preventDefault();
    if(typeof window._tw2IsSubOpen==="function"&&window._tw2IsSubOpen()){window._tw2CloseSub();return;}
    if(typeof window._tw2IsTipPinned==="function"&&window._tw2IsTipPinned()){window._tw2HideTip();return;}
    closeTowerHub();
  });
}

function renderTower(){
  const curRoute=typeof route==="function"?route():(location.hash||"#/tower");
  _tw2ShopClosing=false;
  if(towerView==="battle"&&towerRun){
    _twPrevRoute=curRoute;
    _twPrevView="battle";
    renderTowerBattle();
    return;
  }
  if(towerView==="shop"){
    csClearCompact();
    const alreadyShop=(_twPrevRoute==="#/tower"&&_twPrevView==="shop"&&!!(typeof app!=="undefined"&&app&&app.querySelector(".tw2-shop-mode")));
    if(!alreadyShop){
      _tw2ShopCat="ALL";
      _tw2ShopScroll=0;
    }
    _twPrevRoute=curRoute;
    _twPrevView="shop";
    renderTowerShop({animate:!alreadyShop});
    return;
  }
  const alreadyHub=!!(typeof app!=="undefined"&&app&&app.querySelector(".tw2-hub:not(.tw2-shop-mode)"));
  const skipCurtain=(_twPrevRoute==="#/tower"&&(alreadyHub||_twPrevView==="shop"||_twPrevView==="battle"));
  _twPrevRoute=curRoute;
  _twPrevView="hub";
  renderTowerHub({playCurtain:!skipCurtain});
}
function csClearCompact(){ document.body.classList.remove("tw-compact"); }

/* ==================== INFINITE TOWER HUB v2 (HAZARD PROTOCOL) ====================
   Port of _tmp/proto_tower_v2.html — 100% English, WHITE-on-BLACK HAZARD theme,
   real production state/drops/waves/settings, and #towerCurtain enter/exit flow. */
const TW2_FAN_ART=[
  {cls:"l3",src:"assets/cards/art/astral-devourer.webp"},
  {cls:"l2",src:"assets/cards/art/ruler.webp"},
  {cls:"l1",src:"assets/cards/art/shadow-monarch.webp"},
  {cls:"r1",src:"assets/cards/art/almighty-tyrant.webp"},
  {cls:"r2",src:"assets/cards/art/demon-slime.webp"},
  {cls:"r3",src:"assets/cards/art/omni-sovereign.webp"}
];
const TW2_TOK_SVG='<svg viewBox="0 0 24 24"><use href="#tokSvgSymbol"/></svg>';
const TW2_COIN_SVG='<svg viewBox="0 0 24 24"><use href="#coinSvgSymbol"/></svg>';
const TW2_REWARDS=[
  {id:"rolls",cls:"t-guar",tag:"Every Floor",name:"100 Card Rolls",odds:"100% GUARANTEED",src:"GUARANTEED PER FLOOR",cat:"BANKED SUMMONS",img:"assets/images/icon-index-card.webp",desc:"100 instant card rolls are banked for every floor you clear. All accumulated rolls open automatically when your run ends or when you withdraw."},
  {id:"tokens",cls:"t-guar",tag:"Every Floor",name:"Tower Tokens",odds:"+1 / +5 BOSS",src:"GUARANTEED PER FLOOR",cat:"SPIRE CURRENCY",svg:TW2_TOK_SVG,desc:"Grants +1 Tower Token per standard floor and +5 Tower Tokens on every Boss Gate (every 5 floors). Spend Tokens in the Tower Shop."},
  {id:"coins",cls:"t-guar",tag:"Every Floor",name:"Floor Coins",odds:"150 + 30\u00d7F",src:"GUARANTEED PER FLOOR",cat:"GOLD CURRENCY",svg:TW2_COIN_SVG,desc:"Awards 150 + 30\u00d7Floor Coins on standard floors, and 500 + 60\u00d7Floor Coins on every 5th-floor Boss Gate."},
  {id:"r5k",cls:"t-pack",tag:"5% Base",name:"5,000x Instant Roll",odds:"5.0% CHANCE",src:"PURE BASE RATE (NO LUCK)",cat:"INSTANT PACK",img:"assets/images/instanpack-5k.webp",desc:"5% chance on every floor you clear. Adds an Instant Roll 5,000 Pack directly to your Backpack \u2014 open 5,000 cards anytime."},
  {id:"r10k",cls:"t-pack",tag:"2% Base",name:"10,000x Instant Roll",odds:"2.0% CHANCE",src:"PURE BASE RATE (NO LUCK)",cat:"INSTANT PACK",img:"assets/images/instanpack-10k.webp",desc:"2% chance on every floor you clear. Adds an Instant Roll 10,000 Pack to your Backpack for massive burst summons."},
  {id:"r25k",cls:"t-pack",tag:"1% Base",name:"25,000x Instant Roll",odds:"1.0% CHANCE",src:"PURE BASE RATE (NO LUCK)",cat:"INSTANT PACK",img:"assets/images/instanpack-25k.webp",desc:"1% chance on every floor you clear. Adds an Instant Roll 25,000 Pack to your Backpack \u2014 unaffected by player Luck."},
  {id:"r100k",cls:"t-pack",tag:"0.5% Base",name:"100,000x Instant Roll",odds:"0.5% CHANCE",src:"PURE BASE RATE (NO LUCK)",cat:"INSTANT PACK",img:"assets/images/instanpack-100k.webp",desc:"0.5% chance on every floor you clear. Rolls 100,000 cards instantly when opened from your Backpack!"},
  {id:"weather",cls:"t-pot",tag:"5% Base",name:"Weather Potion",odds:"5.0% CHANCE",src:"PURE BASE RATE (NO LUCK)",cat:"CONSUMABLE",img:"assets/images/weather-potion.webp",desc:"5% chance per cleared floor. Randomizes active server weather for 5 minutes with native climate odds."},
  {id:"luck1",cls:"t-pot",tag:"10% Base",name:"Luck Potion L1",odds:"10.0% CHANCE",src:"PURE BASE RATE (NO LUCK)",cat:"CONSUMABLE",img:"assets/images/pot-luck-1.webp",desc:"10% chance per cleared floor. Grants +3 Flat Luck for 5 minutes (stackable duration)."},
  {id:"speed1",cls:"t-pot",tag:"10% Base",name:"Speed Potion L1",odds:"10.0% CHANCE",src:"PURE BASE RATE (NO LUCK)",cat:"CONSUMABLE",img:"assets/images/pot-speed-1.webp",desc:"10% chance per cleared floor. Increases roll speed by +0.2\u00d7 (~1.2\u00d7) for 5 minutes (stackable)."},
  {id:"art",cls:"t-art",tag:"0.1% Trophy",name:"Flame Sword",odds:"0.1% \u00b7 1 IN 1K",src:"PURE BASE RATE (MAX 1)",cat:"PERMANENT ARTIFACT",img:"assets/artifacts/pedang-api.webp",rawImg:true,desc:"0.1% (1 in 1,000) drop per floor! Permanent Artifact granting +120 Flat Luck & +100% (\u00d72) Luck Multiplier forever."},
  {id:"pet",cls:"t-pet",tag:"0.01% Trophy",name:"Kyubi Fox",odds:"0.01% \u00b7 1 IN 10K",src:"PURE BASE RATE (MAX 1)",cat:"MYTHIC PET",img:"assets/pets/kyubi.webp",desc:"0.01% (1 in 10,000) drop per floor! Mythic Companion granting +200 Flat Luck & +300% (\u00d74) Luck Multiplier."}
];

let _tw2SubMode=null, _tw2TipPinned=false, _tw2TipId=null, _tw2IntelFloor=1;

function _tw2ArtUrl(src, raw){
  if(!src)return "";
  if(raw)return src;
  return typeof thumbSrc==="function"?thumbSrc(src):src;
}

function renderTowerHub(opts){
  if(!state.tower)state.tower={best:0,runs:0,auto:false};
  if(typeof state.tower.best!=="number")state.tower.best=0;
  if(typeof state.tower.runs!=="number")state.tower.runs=0;
  _twClosing=false;
  _tw2SubMode=null;
  _tw2TipPinned=false;
  _tw2TipId=null;

  const best=state.tower.best||0;
  const runs=state.tower.runs||0;
  const tokens=state.infTokens||0;
  const nextBoss=Math.ceil(Math.max(1,best+1)/5)*5;
  const deckCnt=(typeof equippedList==="function")?equippedList().length:(Array.isArray(state.deck)?state.deck.filter(Boolean).length:0);
  const autoOn=!!state.tower.auto;
  const playCurtain=!!(opts&&opts.playCurtain);

  const fanHtml=TW2_FAN_ART.map(f=>`<div class="tw2-fcard ${f.cls}"><img src="${_tw2ArtUrl(f.src)}" alt="" decoding="async"></div>`).join("");
  const rwHtml=TW2_REWARDS.map(r=>{
    const media=r.img?`<img src="${_tw2ArtUrl(r.img,r.rawImg)}" alt="${r.name}" decoding="async">`:r.svg;
    return `<button type="button" class="tw2-rtile ${r.cls}" data-rid="${r.id}" aria-label="${r.name} (${r.odds})">`
      +`<span class="tw2-rt-tag">${r.tag}</span>`
      +`<span class="tw2-rt-art">${media}</span>`
      +`<span class="tw2-rt-nm">${r.name}</span>`
      +`</button>`;
  }).join("");

  app.innerHTML=`<div class="tw-page tactical-tower-page">
  <div class="tw2-hub">
    <div class="tw2-shell${playCurtain?"":" is-entered"}" id="tw2Shell" role="dialog" aria-modal="true" aria-label="Infinite Tower Hub">
      <header class="tw2-banner-bar">
        <div class="tw2-banner-ribbon">
          <div class="tw2-banner-cap">
            <div class="tw2-banner-cap-in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8 7h8l-4-5z"/><path d="M9 7l-1.5 14h9L15 7"/><path d="M6 21h12"/><path d="M12 10v5"/></svg>
              <span>SPIRE</span>
            </div>
          </div>
          <div class="tw2-banner-mid">
            <div class="tw2-banner-titles">
              <h1 class="tw2-title">INFINITE <em>TOWER</em></h1>
              <span class="tw2-eyebrow">// ENDLESS 4-WAVE GAUNTLET &middot; CORE SPIRE</span>
            </div>
            <div class="tw2-banner-tags">
              <span class="tw2-banner-tag" id="tw2HdrTok">TOKENS: ${fmt(tokens)}</span>
              <span class="tw2-banner-tag hz">HZ-TOWER</span>
            </div>
          </div>
        </div>
        <div class="tw2-banner-right">
          <button type="button" class="tw2-x" id="tw2Close" aria-label="Close Infinite Tower" title="Return to Lobby [ESC]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
          <div class="tw2-slashes" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </header>

      <section class="tw2-panel">
        <div class="tw2-tape-line" aria-hidden="true"></div>
        <div class="tw2-body">
          <div class="tw2-col-main">
            <div class="tw2-hero">
              <img class="tw2-hero-bgimg" src="assets/bg/tower.jpg" alt="" decoding="async">
              <div class="tw2-hero-bg" aria-hidden="true"></div>
              <div class="tw2-hero-scan" aria-hidden="true"></div>
              <span class="tw2-hero-crn tl"></span><span class="tw2-hero-crn tr"></span>
              <span class="tw2-hero-crn bl"></span><span class="tw2-hero-crn br"></span>

              <div class="tw2-hero-top">
                <div class="tw2-hchip boss"><i></i><span>BOSS GATE: <b>FLOOR ${fmt(nextBoss)}</b></span></div>
                <div class="tw2-hchip tok"><i></i><span>TOKENS: <b id="tw2HeroTok">${fmt(tokens)}</b></span></div>
              </div>

              <div class="tw2-hero-stage" aria-hidden="true">
                <div class="tw2-fan">${fanHtml}</div>
                <div class="tw2-spire-core">
                  <svg viewBox="0 0 120 170" fill="none">
                    <defs>
                      <linearGradient id="tw2SpireGrad" x1="60" y1="8" x2="60" y2="162" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-color="#f3e600"/>
                        <stop offset="0.35" stop-color="#f5f5f5"/>
                        <stop offset="1" stop-color="#28282e"/>
                      </linearGradient>
                    </defs>
                    <line x1="60" y1="2" x2="60" y2="164" stroke="#f3e600" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.65"/>
                    <polygon points="60,8 67,38 74,48 72,82 84,96 81,132 95,152 25,152 39,132 36,96 48,82 46,48 53,38" fill="#0d0d10" stroke="url(#tw2SpireGrad)" stroke-width="2"/>
                    <line x1="48" y1="52" x2="72" y2="52" stroke="#f3e600" stroke-width="1.4"/>
                    <line x1="42" y1="96" x2="78" y2="96" stroke="#f5f5f5" stroke-width="1.2" opacity="0.7"/>
                    <line x1="36" y1="128" x2="84" y2="128" stroke="#f3e600" stroke-width="1.2" opacity="0.8"/>
                    <polygon points="60,58 69,71 60,84 51,71" fill="#f3e600" stroke="#050505" stroke-width="1.5"/>
                    <polygon points="60,64 64,71 60,78 56,71" fill="#050505"/>
                    <rect x="18" y="152" width="84" height="6" fill="#f3e600"/>
                    <rect x="28" y="160" width="64" height="4" fill="#f5f5f5" opacity="0.35"/>
                  </svg>
                </div>
              </div>

              <div class="tw2-hero-stat">
                <div class="tw2-hero-stat-in">
                  <span>BEST FLOOR: <em>${fmt(best)}</em></span>
                  <span class="sep">&mdash;</span>
                  <span>RUNS: <b class="c">${fmt(runs)}</b></span>
                </div>
              </div>
            </div>

            <div class="tw2-brief">
              <p>The <b>Infinite Tower</b> is an endless 4-wave challenge where your deck is pushed to its limit. Enemy stats scale every floor (<b>Floor &times; 1,000 HP</b> &middot; <b>Floor &times; 500 ATK</b>) &mdash; how high can you climb?</p>
              <p>Clearing every floor banks <em>+100 Card Rolls</em> (automatically rolled upon defeat or withdrawal) plus <b>Floor Coins</b> (<b>150 + 30&times;F</b> normal, <b>500 + 60&times;F</b> boss).</p>
              <p>Every <span class="boss">5th Floor</span> is a <span class="boss">Boss Gate</span> led by <b>Shadow Monarch</b> or <b>Almighty Tyrant</b>, awarding <span class="tok">+5 Tower Tokens</span> (<span class="tok">+1</span> on standard floors) for the <b>Tower Shop</b>.</p>
              <p>Potions, <b>Instant Roll Packs (5K&ndash;100K)</b>, and Ultra-Rare Trophies roll at <em>Pure Base Rates</em> on each cleared floor &mdash; unaffected by player Luck.</p>
            </div>

            <div class="tw2-actions">
              <button type="button" class="tw2-act primary" id="towerGo">
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                <span>START</span>
                <small>F1</small>
              </button>
              <button type="button" class="tw2-act" id="tw2DeckBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="12" height="16" rx="1"/><path d="M16 7h4v13H8"/></svg>
                <span>DECK</span>
                <small>${deckCnt}/4</small>
              </button>
              <button type="button" class="tw2-act" id="tw2IntelBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>
                <span>INTEL</span>
                <small>4 WAVES</small>
              </button>
              <button type="button" class="tw2-act${autoOn?" auto-on":""}" id="tw2SettingsBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>
                <span>SETTINGS</span>
                <small id="tw2AutoBadge">${autoOn?"AUTO ON":"OFF"}</small>
              </button>
              <button type="button" class="tw2-act shop" id="towerShop">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>SHOP</span>
                <small>${fmt(tokens)} TOK</small>
              </button>
            </div>
          </div>

          <div class="tw2-col-rw">
            <div class="tw2-rw-head">
              <b>POTENTIAL REWARDS</b>
              <span class="rule"></span>
              <span class="hint">HOVER OR TAP ITEM FOR DROP ODDS</span>
            </div>
            <div class="tw2-rgrid" id="tw2RGrid">${rwHtml}</div>
          </div>
        </div>

        <div class="tw2-tip" id="tw2Tip" role="status" aria-live="polite">
          <div class="tw2-tip-top">
            <div class="tw2-tip-title" id="tw2TipTitle">&mdash;</div>
            <span class="tw2-tip-odds" id="tw2TipOdds">&mdash;</span>
            <button type="button" class="tw2-tip-close" id="tw2TipClose" aria-label="Dismiss reward details">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
            </button>
          </div>
          <div class="tw2-tip-desc" id="tw2TipDesc"></div>
          <div class="tw2-tip-foot">
            <span id="tw2TipSource">PURE BASE RATE</span>
            <span id="tw2TipCategory">INFINITE TOWER</span>
          </div>
        </div>

        <div class="tw2-sub" id="tw2Sub" aria-hidden="true">
          <div class="tw2-sub-box" role="dialog" aria-modal="true" aria-labelledby="tw2SubTitle">
            <div class="tw2-sub-h">
              <div class="tw2-sub-ht">
                <span class="tw2-sub-kick" id="tw2SubKick">// MODULE</span>
                <h2 class="tw2-sub-title" id="tw2SubTitle">MODULE</h2>
              </div>
              <button type="button" class="tw2-sub-x" id="tw2SubClose" aria-label="Close Drawer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
              </button>
            </div>
            <div class="tw2-sub-b" id="tw2SubBody"></div>
          </div>
        </div>
      </section>
    </div>
  </div></div>`;

  const showTip=(rid,pin)=>{
    const idx=TW2_REWARDS.findIndex(x=>x.id===rid);
    const r=idx>=0?TW2_REWARDS[idx]:null;
    if(!r)return;
    _tw2TipId=rid;
    if(pin)_tw2TipPinned=true;
    const tip=document.getElementById("tw2Tip");
    const t=document.getElementById("tw2TipTitle"),o=document.getElementById("tw2TipOdds"),
          d=document.getElementById("tw2TipDesc"),s=document.getElementById("tw2TipSource"),
          c=document.getElementById("tw2TipCategory");
    if(t)t.textContent=r.name;
    if(o)o.textContent=r.odds;
    if(d)d.textContent=r.desc;
    if(s)s.textContent=r.src;
    if(c)c.textContent=r.cat;
    if(tip){
      tip.classList.toggle("on-left",(idx%6)>=3);
      tip.classList.add("on");
    }
    document.querySelectorAll("#tw2RGrid .tw2-rtile").forEach(b=>b.classList.toggle("is-sel",b.getAttribute("data-rid")===rid));
  };
  const hideTip=()=>{
    _tw2TipPinned=false;
    _tw2TipId=null;
    const tip=document.getElementById("tw2Tip");
    if(tip)tip.classList.remove("on","on-left");
    document.querySelectorAll("#tw2RGrid .tw2-rtile").forEach(b=>b.classList.remove("is-sel"));
  };
  const closeSub=()=>{
    _tw2SubMode=null;
    const sub=document.getElementById("tw2Sub");
    if(sub){sub.classList.remove("on");sub.setAttribute("aria-hidden","true");}
  };
  const paintSub=(kind)=>{
    const body=document.getElementById("tw2SubBody");
    const kick=document.getElementById("tw2SubKick");
    const title=document.getElementById("tw2SubTitle");
    if(!body||!kick||!title)return;
    if(kind==="intel"){
      const frontier=Math.max(1,best+1);
      const fl=Math.max(1,_tw2IntelFloor||1);
      const isBoss=towerIsBossFloor(fl);
      const waves=towerWaves(fl);
      const rw=towerReward(fl);
      const tok=isBoss?5:1;
      kick.textContent="// SPIRE TELEMETRY \u00b7 WAVE SCANNER";
      title.textContent="FLOOR WAVE INTEL";
      const presets=[1];
      if(frontier>1&&!presets.includes(frontier))presets.push(frontier);
      [5,10,25,50].forEach(p=>{if(!presets.includes(p))presets.push(p);});
      body.innerHTML=`<div class="sub-sec"><span>TARGET FLOOR: <b>F${fl}${isBoss?" (BOSS GATE)":""}</b></span><span>REWARD: +${fmt(rw.coins)} COINS &middot; +${tok} TOK</span></div>`
        +`<div class="sub-pills" style="margin-bottom:10px">`
        +presets.map(p=>`<button type="button" class="sub-pill${fl===p?" on":""}" data-twfl="${p}">${towerIsBossFloor(p)?"BOSS F"+p:"FLOOR "+p}</button>`).join("")
        +`</div>`
        +`<div class="sub-grid-4">${waves.map((w,i)=>{
          if(!w||!w.en)return "";
          const role=i===0?(w.en.boss?"BOSS":"LEAD"):(w.en.boss?"TAG BOSS":"WAVE "+(i+1));
          const art=typeof thumbSrc==="function"?thumbSrc(w.en.img):w.en.img;
          return `<div class="sub-card">
            <div class="sub-card-img"><img src="${art}" alt="${w.en.name}" decoding="async"><span class="sub-card-tag${w.en.boss?" boss":""}">${role}</span></div>
            <div class="sub-card-nm" title="${w.en.name}">${w.en.name}</div>
            <div class="sub-card-st">${fmtStat(w.es.hp)} HP &middot; ${fmtStat(w.es.atk)} ATK</div>
          </div>`;
        }).join("")}</div>`
        +`<div class="sub-cta-bar">
          <button type="button" class="sub-btn sec" id="tw2IntelDrop">FULL DROP RATES</button>
          <button type="button" class="sub-btn" id="tw2IntelGo">START CLIMB (F1)</button>
        </div>`;
      body.querySelectorAll("[data-twfl]").forEach(b=>{
        b.onclick=()=>{try{sfx.hit();}catch(e){}_tw2IntelFloor=parseInt(b.getAttribute("data-twfl"),10)||1;paintSub("intel");};
      });
      const db=document.getElementById("tw2IntelDrop");
      if(db)db.onclick=()=>{closeSub();try{sfx.hit();}catch(e){}openTowerDropModal();};
      const gb=document.getElementById("tw2IntelGo");
      if(gb)gb.onclick=()=>{closeSub();try{sfx.hit();}catch(e){}towerStartRun();};
    } else if(kind==="settings"){
      const isAuto=!!(state.tower&&state.tower.auto);
      const maxSp=(typeof battleSpeedMax==="function")?battleSpeedMax():1;
      const curSp=(typeof battleSpeedEff==="function")?battleSpeedEff():(state.battleSpeed||1);
      const has3=maxSp>=3;
      kick.textContent="// SPIRE AUTOMATION & COMBAT";
      title.textContent="TOWER SETTINGS";
      body.innerHTML=`<div class="sub-row">
          <div class="sub-row-txt"><b>Auto-Restart on Defeat</b><small>Automatically starts a new Floor 1 run after your squad falls.</small></div>
          <button type="button" class="sub-toggle${isAuto?" on":""}" id="tw2AutoTog">${isAuto?"ON":"OFF"}</button>
        </div>
        <div class="sub-row">
          <div class="sub-row-txt"><b>Battle Speed Multiplier</b><small>Active ${curSp}&times; &middot; ${has3?"3&times; Speed Pass Active":"1&times; &amp; 2&times; Free &middot; 3&times; via Premium Shop Pass"}</small></div>
          <div class="sub-pills">${[1,2,3].map(sp=>{
            const locked=sp>maxSp;
            return `<button type="button" class="sub-pill${curSp===sp?" on":""}${locked?" locked":""}" data-twsp="${sp}" aria-pressed="${curSp===sp?"true":"false"}" title="${locked?"Unlock 3× Speed Pass in Premium Shop (3,000 Gems)":"Battle Speed "+sp+"×"}">${sp}&times;${locked?" (PASS)":""}</button>`;
          }).join("")}</div>
        </div>`;
      const ab=document.getElementById("tw2AutoTog");
      if(ab)ab.onclick=()=>{
        try{sfx.hit();}catch(e){}
        state.tower=state.tower||{best:0,runs:0};
        state.tower.auto=!state.tower.auto;
        try{save();}catch(e){}
        const btn=document.getElementById("tw2SettingsBtn");
        const bdg=document.getElementById("tw2AutoBadge");
        if(btn)btn.classList.toggle("auto-on",!!state.tower.auto);
        if(bdg)bdg.textContent=state.tower.auto?"AUTO ON":"OFF";
        paintSub("settings");
        try{toast(state.tower.auto?"AUTO-RESTART ENABLED":"AUTO-RESTART DISABLED",state.tower.auto?"Next run starts automatically upon defeat.":"Returns to Infinite Tower Hub upon defeat.",state.tower.auto?"#6be08a":"#f3e600");}catch(e){}
      };
      body.querySelectorAll("[data-twsp]").forEach(b=>{
        b.onclick=()=>{
          const v=parseInt(b.getAttribute("data-twsp"),10);
          if(!v)return;if(v>maxSp){try{sfx.hit();}catch(e){}closeSub();if(typeof openPremiumShop==="function")openPremiumShop("speed-3x");return;}
          try{sfx.hit();}catch(e){}
          state.battleSpeed=v;
          if(typeof bt!=="undefined"&&bt)bt.speed=battleSpeedEff();
          try{save();}catch(e){}
          paintSub("settings");
        };
      });
    }
  };
  const openSub=(kind)=>{
    _tw2SubMode=kind;
    hideTip();
    paintSub(kind);
    const sub=document.getElementById("tw2Sub");
    if(sub){sub.classList.add("on");sub.setAttribute("aria-hidden","false");}
  };

  window._tw2CloseSub=closeSub;
  window._tw2HideTip=hideTip;
  window._tw2IsTipPinned=()=>_tw2TipPinned;
  window._tw2IsSubOpen=()=>!!_tw2SubMode;

  const g=document.getElementById("towerGo");if(g)g.onclick=()=>{try{sfx.hit();}catch(e){}towerStartRun();};
  const s=document.getElementById("towerShop");if(s)s.onclick=()=>{try{sfx.hit();}catch(e){}towerView="shop";render();};
  const cBtn=document.getElementById("tw2Close");if(cBtn)cBtn.onclick=closeTowerHub;
  const dkBtn=document.getElementById("tw2DeckBtn");
  if(dkBtn)dkBtn.onclick=()=>{
    try{sfx.hit();}catch(e){}
    if(typeof openDeckModal==="function")openDeckModal();
    else if(typeof toggleBackpack==="function")toggleBackpack();
  };
  const inBtn=document.getElementById("tw2IntelBtn");
  if(inBtn)inBtn.onclick=()=>{try{sfx.hit();}catch(e){}_tw2IntelFloor=Math.max(1,best+1);openSub("intel");};
  const stBtn=document.getElementById("tw2SettingsBtn");
  if(stBtn)stBtn.onclick=()=>{try{sfx.hit();}catch(e){}openSub("settings");};

  const subClose=document.getElementById("tw2SubClose");if(subClose)subClose.onclick=closeSub;
  const subEl=document.getElementById("tw2Sub");
  if(subEl)subEl.onclick=(e)=>{if(e.target===subEl)closeSub();};
  const tipClose=document.getElementById("tw2TipClose");if(tipClose)tipClose.onclick=hideTip;

  document.querySelectorAll("#tw2RGrid .tw2-rtile").forEach(btn=>{
    const rid=btn.getAttribute("data-rid");
    btn.addEventListener("mouseenter",()=>{if(!_tw2TipPinned)showTip(rid,false);});
    btn.addEventListener("mouseleave",()=>{if(!_tw2TipPinned)hideTip();});
    btn.addEventListener("click",()=>{
      try{sfx.hit();}catch(e){}
      if(_tw2TipPinned&&_tw2TipId===rid)hideTip();
      else showTip(rid,true);
    });
  });

  _tw2EnsureEsc();

  window.scrollTo(0,0);
  if(playCurtain){
    twBannerOpen();
  }else{
    const sh=document.getElementById("tw2Shell");
    if(sh)sh.classList.add("is-entered");
  }
}
function renderTowerShop(opts){
  if(!state.tower)state.tower={best:0,runs:0,auto:false};
  const tok=state.infTokens||0;
  const gems=state.premiumGems||0;
  const doAnim=!(opts&&opts.animate===false);
  _tw2EnsureEsc();

  const ART={
    gem:thumbSrc("assets/images/premium-currency.webp"),
    weather:thumbSrc("assets/images/weather-potion.webp"),
    luck1:thumbSrc("assets/images/pot-luck-1.webp"),
    luck2:thumbSrc("assets/images/pot-luck-2.webp"),
    luck3:thumbSrc("assets/images/pot-luck-3.webp"),
    speed1:thumbSrc("assets/images/pot-speed-1.webp"),
    speed2:thumbSrc("assets/images/pot-speed-2.webp"),
    speed3:thumbSrc("assets/images/pot-speed-3.webp")
  };

  /* Data item Tower Shop (Infinite Tower) — FULL ENGLISH */
  const ITEMS=[
    {k:"gem",cat:"EXCHANGE",tier:"GEM",label:"TOKEN \u2192 GEM // 100:10",sub:"Exchange 100 Tower Tokens for 10 Premium Gems. Repeatable without limits.",cost:100,gem:10,req:null,ac:"#ffd700"},
    {k:"weather",cat:"WEATHER",tier:"SPEC-A",label:"ATMOSPHERIC OVERRIDE",sub:"Triggers a random server climate shift using native weather probabilities (5 min duration).",cost:10,req:null,ac:"#22d3ee"},
    {k:"luck1",cat:"AUGMENT",tier:"MK-I",label:"NEURAL LUCK MK-I",sub:"+3 flat luck for 5 minutes. Stackable \u2014 duration extends +5 min per use.",cost:10,req:null,ac:"#6be08a"},
    {k:"luck2",cat:"AUGMENT",tier:"MK-II",label:"NEURAL LUCK MK-II",sub:"+5 flat luck & +10% luck multiplier for 5 minutes. Stackable.",cost:50,req:null,ac:"#6be08a"},
    {k:"luck3",cat:"AUGMENT",tier:"MK-III",label:"NEURAL LUCK MK-III",sub:"+10 flat luck & +20% luck multiplier for 5 minutes. Peak augmentation matrix.",cost:250,req:null,ac:"#6be08a"},
    {k:"speed1",cat:"OVERCLOCK",tier:"MK-I",label:"CHRONO BOOSTER MK-I",sub:"Roll speed +0.2\u00d7 (~1.2\u00d7) for 5 minutes. Accelerates spire RNG cycle.",cost:10,req:null,ac:"#fbbf24"},
    {k:"speed2",cat:"OVERCLOCK",tier:"MK-II",label:"CHRONO BOOSTER MK-II",sub:"Roll speed +0.5\u00d7 (~1.5\u00d7) for 5 minutes. Sync accelerator overclock.",cost:50,req:null,ac:"#fbbf24"},
    {k:"speed3",cat:"OVERCLOCK",tier:"MK-III",label:"CHRONO BOOSTER MK-III",sub:"Roll speed +1.0\u00d7 (2.0\u00d7 instant) for 5 minutes. Maximum overdrive velocity.",cost:250,req:null,ac:"#fbbf24"}
  ];

  const stkOf=k=>k==="weather"?(state.potions||0):k.startsWith("luck")?(state.luckPots&&state.luckPots[+k.slice(-1)-1])||0:k.startsWith("speed")?(state.speedPots&&state.speedPots[+k.slice(-1)-1])||0:(state.mythicPotions||0);
  const cardOwned=it=>!!(it.unlock&&state.towerShopOwned&&state.towerShopOwned[it.unlock]);

  const TABS=[
    {k:"ALL",label:"ALL",cnt:ITEMS.length},
    {k:"EXCHANGE",label:"EXCHANGE",cnt:1},
    {k:"WEATHER",label:"WEATHER",cnt:1},
    {k:"AUGMENT",label:"LUCK",cnt:3},
    {k:"OVERCLOCK",label:"SPEED",cnt:3}
  ];

  const cardHtml=it=>{
    const isOwned=cardOwned(it);
    const canAfford=tok>=it.cost;
    const cnt=it.unlock?state.stacks.filter(s=>s.char===it.unlock).reduce((n,s)=>n+(s.count||1),0):(it.gem?0:stkOf(it.k));
    const dis=isOwned||!canAfford||(it.req&&stkOf(it.req)<=0)||_infBuyingKind===it.k;
    const btnLabel=_infBuyingKind===it.k?"PROCESSING..."
      :(isOwned?"UNLOCKED"
      :(!canAfford?`NEED ${fmt(it.cost-tok)} TOK`
      :(it.gem?"EXCHANGE +10 GEMS":"ACQUIRE")));
    const stockTxt=it.unlock?(cnt?"IN STOCK \u00d7"+cnt:"LOCKED"):(it.gem?"UNLIMITED":"IN STOCK \u00d7"+cnt);
    const art=ART[it.k]||"";
    return `<article class="tw2-sh-card${dis?" is-dis":""}" style="--ic:${it.ac}" data-cat="${it.cat}">
      <div class="tw2-shc-top">
        <div class="tw2-shc-tags">
          <span class="tw2-shc-cat">${it.cat}</span>
          <span class="tw2-shc-tier">${it.tier}</span>
        </div>
        <span class="tw2-shc-stock${it.gem?" unlim":""}"><b>${stockTxt}</b></span>
      </div>
      <div class="tw2-shc-mid">
        <div class="tw2-shc-art">${art?`<img src="${art}" alt="${it.label}" decoding="async">`:""}</div>
        <div class="tw2-shc-info">
          <div class="tw2-shc-nm" title="${it.label}">${it.label}</div>
          <div class="tw2-shc-ds">${it.sub}</div>
        </div>
      </div>
      <div class="tw2-shc-foot">
        <div class="tw2-shc-price">${TW2_TOK_SVG}<b>${fmt(it.cost)}</b><i>TOK</i></div>
        <button type="button" class="tw2-sh-buy${isOwned?" is-owned":""}" data-kind="${it.k}" ${dis?"disabled":""} aria-label="${it.label} — ${btnLabel}">${btnLabel}</button>
      </div>
    </article>`;
  };

  const buildSectionsHtml=(cat)=>{
    if(cat==="ALL"){
      const exItems=ITEMS.filter(i=>i.cat==="EXCHANGE"||i.cat==="WEATHER");
      const augItems=ITEMS.filter(i=>i.cat==="AUGMENT");
      const spdItems=ITEMS.filter(i=>i.cat==="OVERCLOCK");
      return `
        <section class="tw2-sh-sec">
          <div class="tw2-rw-head"><b>EXCHANGE &amp; CLIMATE</b><span class="rule"></span><span class="hint">${exItems.length} SUPPLIES</span></div>
          <div class="tw2-sh-grid cols-2">${exItems.map(cardHtml).join("")}</div>
        </section>
        <section class="tw2-sh-sec">
          <div class="tw2-rw-head"><b>AUGMENT // LUCK MATRIX</b><span class="rule"></span><span class="hint">${augItems.length} TIERS</span></div>
          <div class="tw2-sh-grid">${augItems.map(cardHtml).join("")}</div>
        </section>
        <section class="tw2-sh-sec">
          <div class="tw2-rw-head"><b>OVERCLOCK // ROLL SPEED</b><span class="rule"></span><span class="hint">${spdItems.length} TIERS</span></div>
          <div class="tw2-sh-grid">${spdItems.map(cardHtml).join("")}</div>
        </section>`;
    }
    const list=ITEMS.filter(i=>i.cat===cat);
    const meta={
      EXCHANGE:{title:"TOKEN EXCHANGE",note:"GEM CONVERSION"},
      WEATHER:{title:"CLIMATE OVERRIDE",note:"ATMOSPHERE SHIFT"},
      AUGMENT:{title:"AUGMENT // LUCK MATRIX",note:"STACKABLE BUFF"},
      OVERCLOCK:{title:"OVERCLOCK // ROLL SPEED",note:"RNG ACCELERATION"}
    }[cat]||{title:cat,note:"SUPPLIES"};
    const gridCls=list.length===1?" cols-1":(list.length===2?" cols-2":"");
    return `
      <section class="tw2-sh-sec">
        <div class="tw2-rw-head"><b>${meta.title}</b><span class="rule"></span><span class="hint">${list.length} &middot; ${meta.note}</span></div>
        <div class="tw2-sh-grid${gridCls}">${list.map(cardHtml).join("")}</div>
      </section>`;
  };

  if(!TABS.some(t=>t.k===_tw2ShopCat))_tw2ShopCat="ALL";

  app.innerHTML=`<div class="tw-page tactical-tower-page">
  <div class="tw2-hub tw2-shop-mode">
    <div class="tw2-shell${doAnim?"":" is-entered"}" id="tw2ShopShell" role="dialog" aria-modal="true" aria-label="Infinite Tower Shop">
      <header class="tw2-banner-bar">
        <div class="tw2-banner-ribbon">
          <div class="tw2-banner-cap">
            <div class="tw2-banner-cap-in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>ARMORY</span>
            </div>
          </div>
          <div class="tw2-banner-mid">
            <div class="tw2-banner-titles">
              <h1 class="tw2-title">TOWER <em>SHOP</em></h1>
              <span class="tw2-eyebrow">// SPIRE ARMORY &middot; TOKEN EXCHANGE &amp; SUPPLIES</span>
            </div>
            <div class="tw2-banner-tags">
              <span class="tw2-banner-tag" id="tw2ShopHdrTok">TOKENS: ${fmt(tok)}</span>
              <span class="tw2-banner-tag gold" id="tw2ShopHdrGem">GEMS: ${fmt(gems)}</span>
              <span class="tw2-banner-tag hz">HZ-ARMORY</span>
            </div>
          </div>
        </div>
        <div class="tw2-banner-right">
          <button type="button" class="tw2-x tw2-back-btn" id="towerShopBack" title="Return to Infinite Tower Hub [ESC]" aria-label="Return to Infinite Tower Hub">
            <span class="tw2-back-btn-in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              <span class="tw2-back-lbl">HUB</span>
            </span>
          </button>
          <div class="tw2-slashes" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </header>

      <section class="tw2-panel">
        <div class="tw2-tape-line" aria-hidden="true"></div>
        <div class="tw2-sh-bar">
          <div class="tw2-sh-wallet">
            <div class="tw2-sh-wal tok">
              ${TW2_TOK_SVG}
              <div class="tw2-sh-wal-txt">
                <span>TOWER TOKENS</span>
                <b id="tw2ShopTokVal">${fmt(tok)}</b>
              </div>
            </div>
            <div class="tw2-sh-wal gem">
              <img src="${ART.gem}" alt="Gems" decoding="async">
              <div class="tw2-sh-wal-txt">
                <span>PREMIUM GEMS</span>
                <b id="tw2ShopGemVal">${fmt(gems)}</b>
              </div>
            </div>
          </div>
          <div class="tw2-sh-tabs" id="tw2ShopTabs" role="tablist" aria-label="Shop categories">
            ${TABS.map(t=>`<button type="button" role="tab" aria-selected="${_tw2ShopCat===t.k?"true":"false"}" class="tw2-sh-tab${_tw2ShopCat===t.k?" on":""}" data-cat="${t.k}">${t.label}<small>${t.cnt}</small></button>`).join("")}
          </div>
        </div>

        <div class="tw2-sh-body" id="tw2ShopScroll">
          ${buildSectionsHtml(_tw2ShopCat)}
        </div>

        <div class="tw2-sh-foot">
          <span><b>${ITEMS.length}</b> SUPPLIES AVAILABLE</span>
          <i></i>
          <span class="tw2-sh-foot-tip">+1 TOK / FLOOR &middot; +5 TOK / BOSS GATE</span>
        </div>
      </section>
    </div>
  </div></div>`;

  const bindBuyButtons=()=>{
    const bodyEl=document.getElementById("tw2ShopScroll");
    app.querySelectorAll(".tw2-sh-buy[data-kind]").forEach(btn=>{
      btn.onclick=()=>{
        if(btn.disabled)return;
        const k=btn.dataset.kind;
        if(k){
          if(bodyEl)_tw2ShopScroll=bodyEl.scrollTop;
          try{sfx.hit();}catch(e){}
          infBuy(k);
        }
      };
    });
  };

  const rb=document.getElementById("towerShopBack");
  if(rb)rb.onclick=closeTowerShop;

  const tabsEl=document.getElementById("tw2ShopTabs");
  const scrollEl=document.getElementById("tw2ShopScroll");
  if(tabsEl&&scrollEl){
    tabsEl.querySelectorAll(".tw2-sh-tab[data-cat]").forEach(tb=>{
      tb.onclick=()=>{
        const c=tb.getAttribute("data-cat")||"ALL";
        if(c===_tw2ShopCat)return;
        try{sfx.hit();}catch(e){}
        _tw2ShopCat=c;
        _tw2ShopScroll=0;
        tabsEl.querySelectorAll(".tw2-sh-tab").forEach(x=>{
          const on=x.getAttribute("data-cat")===c;
          x.classList.toggle("on",on);
          x.setAttribute("aria-selected",on?"true":"false");
        });
        scrollEl.innerHTML=buildSectionsHtml(c);
        scrollEl.scrollTop=0;
        bindBuyButtons();
      };
    });
  }

  bindBuyButtons();
  if(scrollEl&&_tw2ShopScroll>0)scrollEl.scrollTop=_tw2ShopScroll;

  if(doAnim){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const sh=document.getElementById("tw2ShopShell");
      if(sh)sh.classList.add("is-entered");
    }));
  }
}
function infBuy(kind){
  const cost={gem:100,weather:10,luck1:10,luck2:50,luck3:250,speed1:10,speed2:50,speed3:250,mythic:50}[kind]; if(cost==null)return;
  if(_infBuyingKind)return;
  /* Kartu unlock permanen */
  const CARD_UNLOCK={} [kind];
  if(CARD_UNLOCK&&state.towerShopOwned&&state.towerShopOwned[CARD_UNLOCK]){toast("ALREADY UNLOCKED","Card roll is already permanently unlocked","#a78bfa");return;}
  if((state.infTokens||0)<cost){toast("INSUFFICIENT TOKENS","NOT ENOUGH TOWER TOKENS","#f87171");return;}
  _infBuyingKind=kind;
  const activeBtn=document.querySelector(`.tw2-sh-buy[data-kind="${kind}"]`);
  if(activeBtn){activeBtn.disabled=true;activeBtn.textContent="PROCESSING...";}
  if(kind==='gem'){
    const GEM_AMT=10;
    (async()=>{
      let res;
      try{
        const u=(typeof currentUser!=='undefined'&&currentUser)?String(currentUser):'';
        if(u&&window.CloudDB&&window.CloudDB.exchangeTokens){
          /* 0023: server potong token + bayar gem (atomik). */
          res=await window.CloudDB.exchangeTokens(u,'inf');
        }else{
          state.infTokens-=cost;
          state.premiumGems=(state.premiumGems||0)+GEM_AMT;
          res={ok:true,gems:GEM_AMT,tokens:state.infTokens};
        }
      }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
      finally{_infBuyingKind=null;}
      if(res&&res.ok){
        if(typeof res.tokens==='number')state.infTokens=res.tokens;
        save(); try{beep(880,.12,"sine",.07);}catch(e){}
        toast("EXCHANGE SUCCESSFUL","-"+cost+" TOKENS \u00b7 +"+(res.gems||GEM_AMT)+" GEMS","#ffd700");
      }else{
        try{save();}catch(e){}
        const why=(res&&res.msg)==="TOKEN_KURANG"?"INSUFFICIENT TOKENS":((res&&res.msg)||"Please try again later");
        toast("EXCHANGE FAILED",why,"#f87171");
      }
      try{renderShell();}catch(e){}
      if(towerView==="shop")render();
    })();
    return;
  }
  /* 0026: saldo token INF milik server */
  (async()=>{
    let res;
    try{
      const u=(typeof currentUser!=="undefined"&&currentUser)?String(currentUser):"";
      if(u&&window.CloudDB&&window.CloudDB.spendTokens){
        res=await window.CloudDB.spendTokens(u,"inf",kind);
      }else{
        state.infTokens-=cost;
        res={ok:true,tokens:state.infTokens};
      }
    }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
    finally{_infBuyingKind=null;}
    if(!res||!res.ok){
      const why=(res&&res.msg)==="TOKEN_KURANG"?"INSUFFICIENT TOKENS":((res&&res.msg)==="DAILY_CAP"?"DAILY CAP REACHED":((res&&res.msg)||"Please try again later"));
      toast("PURCHASE FAILED",why,"#f87171");
      try{renderShell();}catch(e){}
      if(towerView==="shop")render();
      return;
    }
    if(typeof res.tokens==="number")state.infTokens=res.tokens;
    if(CARD_UNLOCK){state.towerShopOwned=state.towerShopOwned||{};state.towerShopOwned[CARD_UNLOCK]=true;}
    else if(kind==='weather')state.potions=(state.potions||0)+1;
    else if(kind.startsWith('luck')){state.luckPots=state.luckPots||[0,0,0];state.luckPots[+kind.slice(-1)-1]++;}
    else if(kind.startsWith('speed')){state.speedPots=state.speedPots||[0,0,0];state.speedPots[+kind.slice(-1)-1]++;}
    save(); beep(660,.1,"sine",.07);
    const label=CARD_UNLOCK?cardName(CARD_UNLOCK):({weather:'WEATHER POTION',mythic:'MYTHIC POTION'}[kind]||(kind.startsWith('luck')?'LUCK POTION L'+kind.slice(-1):'SPEED POTION L'+kind.slice(-1)));
    toast(label,CARD_UNLOCK?"-"+cost+" TOKENS \u00b7 ROLL UNLOCKED":"-"+cost+" TOKENS","#c4b5fd");
    renderShell(); if(towerView==="shop")render();
  })();
}
function renderTowerBattle(){
  const w=towerRun.waves[towerRun.idx];
  if(!w){endBattle(true);return;}
  const eq=equipped(),st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  app.innerHTML=`
  <div class="battle-grid tower-stage">
  ${typeof tcgPlayerEquipRailHtml==="function"?tcgPlayerEquipRailHtml():""}
  ${typeof tcgFoeEquipRailHtml==="function"?tcgFoeEquipRailHtml():""}
  <div class="me-col">
    <div class="fighter me${eq?mutGlow(eq.mut):''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}"${eq?mutEdge(eq.mut):''}>${meFighterHtml(eq)}</div>
    ${benchHtml()}
  </div>
  <div class="vs-col"><div class="s" id="turnLabel">FLOOR <b>${towerRun.floor}</b> · ${towerIsBossFloor(towerRun.floor)?"BOSS ENCOUNTER":"WAVE <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"}</div><button class="bspeed-btn" id="bspeedBtn" type="button">1×</button></div>
  <div class="me-col foe-side" id="foeSide">${towerFoeSide(w)}</div>
  </div>`;
  wireSpeedBtn();
  clearFoeEnter();
  const meEl0=document.querySelector(".fighter.me"),foeEl0=document.querySelector(".fighter.foe");
  if(meEl0){meEl0.classList.add("tag-enter");setTimeout(()=>{try{meEl0.classList.remove("tag-enter");}catch(e){}},650);enterFx(meEl0);}
  if(foeEl0)enterFx(foeEl0);
  /* Infinite Tower: tanpa cut-in intro (langsung masuk arena tiap lantai) */
  if (typeof window.hzBattleDecorate === "function") { try { window.hzBattleDecorate(); } catch(e){ console.error("hz decorate", e); } }
  playFight(startTowerBattle,{skipIntro:true});
}
function startTowerBattle(){
  if(window.cgGameplayStart) window.cgGameplayStart();
  /* Battle lama (over) jangan nutup battle baru; battle hidup → jangan di-reset */
  if(bt&&!bt.over)return;
  if(bt&&bt.over){if(bt.timer)clearTimeout(bt.timer);bt=null;}
  window.cutInShown=false;
  const w=towerRun.waves[towerRun.idx];
  const fighters=equippedList();if(!fighters.length)fighters.push(equipped());
  const eq=fighters[0],base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  if(bt&&bt.timer)clearTimeout(bt.timer);
  bt={speed:battleSpeedEff(),fgen:++FGEN,lv:null,tower:true,en:w.en,es:w.es,eq,fighters,eid:w.eid,efx:w.efx,active:0,cutInShown:false,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:w.es.hp,turn:1,over:false,eBurn:0,ePoison:0,pGuardDr:0,eAbilityOff:0,voidUsed:false,pCopyFx:null,spCd:[],spTurn:[],spArmed:[],spWave:[],meteorGuard:[],phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),shatterGuard:new Array(fighters.length).fill(false),defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,psychic:null,atkEntryGuard:new Array(fighters.length).fill(false),sleepLeft:new Array(fighters.length).fill(0),sleepArmed:new Array(fighters.length).fill(false),overflow:0,rain:null,freezeLeft:0,shockCount:new Array(fighters.length).fill(0),shadow:null,freezeNext:false,valhallaLeft:0,paintHits:[],eInk:0,eInkPct:0,wc:null,rearIdx:-1,rearWaiting:false,rearUsed:[],senzu:{},senzuFin:false,balloon:0,stretchShot:0,turret:0,hvCount:new Array(fighters.length).fill(0),hvUses:new Array(fighters.length).fill(0),hvEntryGuard:new Array(fighters.length).fill(false),eHvUses:0,excited:false,weCount:new Array(fighters.length).fill(0),weRevived:false,pbRocks:0,pbKey:"",pbStreak:0,rubber:false,rbBounce:0,dizzyStack:0,dizzyLeft:0,bajrangUsed:new Array(fighters.length).fill(false)};
  const tfx=resolveFx(eq,w.efx);
  if(tfx&&tfx.entryCounter)bt.entryGuard[0]=true;
  if(tfx&&tfx.entryShatter)bt.shatterGuard[0]=true;
  if(tfx&&tfx.entryMaxHp)bt.bioGuard[0]=true;
  if(tfx&&tfx.meteorWave)bt.meteorGuard[0]=true;
  if(tfx&&tfx.entryAtkPct)bt.atkEntryGuard[0]=true;
  if(tfx&&tfx.havocRocket)bt.hvEntryGuard[0]=true;
  armShotFx(tfx,0);partyDmgApply(tfx);
  if(tfx&&tfx.psychicBarrier)bt.psychic={left:tfx.psychicBarrier.turns,dr:tfx.psychicBarrier.dr,healPct:tfx.psychicBarrier.healPct};
  if(tfx&&tfx.sleepStrike){bt.sleepLeft[0]=tfx.sleepStrike.turns;bt.sleepArmed[0]=true;}
   if(tfx&&tfx.entryFreeze&&!foeStatusImmune()){bt.eStun=tfx.entryFreeze.turns;bt.freezeLeft=tfx.entryFreeze.turns;setTimeout(()=>{floatText(".fighter.foe","FROZEN","crit");if(window.playFreezeFx)playFreezeFx("foe",false);},bsMs(300));}
   if(tfx&&tfx.heavyRain)bt.rain={left:tfx.heavyRain.turns,healPct:tfx.heavyRain.healPct};
   if(tfx&&tfx.timeStop&&!foeStatusImmune()){bt.eStun=tfx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
  if(tfx&&tfx.dimensionShift){bt.eAbilityOff=tfx.dimensionShift.turns;setTimeout(()=>floatText(".fighter.foe","AMENOMINAKA","crit"),bsMs(300));}
if(tfx)bt.pGuardDr=tfx.puppetBody?tfx.puppetBody.dr:(tfx.autoBlock?tfx.autoBlock.pct:0);
if(tfx&&tfx.valhalla){bt.valhallaLeft=tfx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(tfx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(tfx.turret)bt.turret=tfx.turret.start;
bt.rubber=!!(tfx&&tfx.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(tfx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(tfx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(tfx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:tfx.worldCorrupt.every,pct:tfx.worldCorrupt.pct,dmgUp:tfx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  bt.fighters.forEach((f,i)=>{const x=resolveFx(f,w.efx);if(x.splitDeath)bt.splitLeft[i]=x.splitDeath.times;});
  if(typeof applyFoeEntryPassives==="function")applyFoeEntryPassives();
  schedPhase(700,step);
}
function foeDown(){
  /* RE-ENTRANCY GUARD: AOE (meteor/quake) + serangan biasa bisa men-schedule foeDown 2x untuk kill yang sama.
     Tanpa guard ini advanceTowerFoe kejar 2x: gelombang hidup ke-skip, kill-reward dobel, dan musuh kebagian giliran dobel.
     Hasilnya kartu pemain mati mendadak pas ngeluarin AOE di tower. */
  if(!bt||bt.over)return;
  if(bt.eHp>0)return;/* STALE-CALL GUARD: kill ini udah keproses — musuh baru udah ke-load (eHp>0), jangan advance dobel */
  if(bt.foeDowning)return;
  if(typeof foeTrySave==="function"&&foeTrySave())return;
  bt.foeDowning=true;
  /* SNATCH: kartu aktif yang punya fx.snatch mencuri pct% stat musuh yang baru tumbang, permanen */
  if(bt&&!bt.over&&!bt.aftermath&&bt.pHp>0){
    const a=bt.active,sfx=resolveFx(bt.eq,bt.efx);
    if(sfx.snatch){
      const sa=Math.round(bt.es.atk*sfx.snatch.pct/100), sh=Math.round(bt.es.hp*sfx.snatch.pct/100);
      bt.snatchAtk[a]=(bt.snatchAtk[a]||0)+sa; bt.snatchHp[a]=(bt.snatchHp[a]||0)+sh;
      bt.pMax+=sh; bt.pHp=Math.min(bt.pMax,bt.pHp+sh);
      setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","SNATCH +"+fmt(sa)+" ATK +"+fmt(sh)+" HP","crit");}},bsMs(260));
    }
    /* REGRESSION (Regressor): tiap kill nyimpen 1 'charge' buat bangkit nanti (dipakai di trySave) */
    if(sfx.regression){bt.regressCharges[a]=(bt.regressCharges[a]||0)+1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGRESSION READY","heal");},bsMs(300));}
    if(sfx.killHeal&&bt.pHp>0){const kh=Math.max(1,Math.round(bt.pMax*sfx.killHeal.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+kh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","LIFESTEAL +"+fmt(kh),"heal");},bsMs(340));}
    /* FREEZE TRANSFER (ABSOLUTE ZERO): musuh tumbang dalam keadaan BEKU -> freeze pindah ke kartu musuh berikutnya */
    if(sfx.freezeTransfer&&(bt.freezeLeft||0)>0){bt.freezeNext=true;}
    if(sfx.getExcited){bt.excited=true;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GET EXCITED!","crit");},bsMs(300));}
    /* GLUTTONY (Demon Slime): serap pct% ATK & max-HP musuh tumbang (pola snatch) + salin ability musuh TERBARU */
    if(sfx.gluttony){
      const ga=Math.round(bt.es.atk*sfx.gluttony.pct/100),gh=Math.round(bt.es.hp*sfx.gluttony.pct/100);
      bt.snatchAtk[a]=(bt.snatchAtk[a]||0)+ga; bt.snatchHp[a]=(bt.snatchHp[a]||0)+gh;
      bt.pMax+=gh;if(sfx.gluttony&&sfx.gluttony.healPct){const glh=Math.max(1,Math.round(bt.pMax*sfx.gluttony.healPct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+glh);} bt.pHp=Math.min(bt.pMax,bt.pHp+gh);
      if(bt.efx&&!(sfx.gluttony&&sfx.gluttony.noCopy))bt.pCopyFx=Object.assign({},bt.efx);
      setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GLUTTONY +"+fmt(ga)+" ATK +"+fmt(gh)+" HP","crit");},bsMs(300));
    }  }
  /* SHADOW ARMY (SHADOW KING): musuh yang dia kalahkan bangkit jadi Shadow permanen (75% stat) di
     barisan belakang party. NPC bos tidak bisa dibangkitkan. Butuh gelombang berikutnya untuk relevan. */
  if(bt&&!bt.over&&!bt.aftermath&&bt.pHp>0&&!bt.shadow&&!bt.eq.sk&&bt.tower&&towerRun&&towerRun.idx+1<towerRun.waves.length&&bt.eid&&CARDS[bt.eid]){
    const kfx=resolveFx(bt.eq,bt.efx);
    if(kfx.shadowArmy&&!(bt.en&&bt.en.boss)){
      const skHp=Math.max(1,Math.round(bt.es.hp*kfx.shadowArmy.pct/100));
      const skAtk=Math.max(1,Math.round(bt.es.atk*kfx.shadowArmy.pct/100));
      bt.fighters.push({char:bt.eid,mut:"none",trait:"none",shiny:false,sk:true,skAtk:skAtk,skHp:skHp});
      const rail=document.querySelector(".bench-rail");
      if(rail)rail.outerHTML=benchRailHtml(bt.fighters.slice(bt.active+1));
      if(typeof window.hzBattleSync==="function"){try{window.hzBattleSync();}catch(e){}}
      /* FX ARISE: arwah musuh naik dari kartu KO lalu terbang ke tile Shadow baru */
      if(window.skfxArise)window.skfxArise({art:bt.en.img,thumb:cardThumb(bt.eid)});
      else setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","ARISE · SHADOW +1","crit");},bsMs(300));
    }
  }
  /* ARISE (Shadow Monarch): setelah membunuh & masih ada gelombang berikutnya, bangkitkan musuh yang baru mati
     sebagai bayangan (40% stat) yang MENGAMBIL-ALIH slot Monarch. HP asli Monarch disimpan buat balik nanti. */
  if(bt&&!bt.over&&!bt.aftermath&&!bt.shadow&&bt.pHp>0&&bt.tower&&towerRun&&towerRun.idx+1<towerRun.waves.length){
    const mfx=resolveFx(bt.eq,bt.efx);
    if(mfx.arise){
      const pct=mfx.arise.pct;
      bt.shadow={name:bt.en.name,img:bt.en.img,atk:Math.max(1,Math.round(bt.es.atk*pct/100)),maxHp:Math.max(1,Math.round(bt.es.hp*pct/100)),turnsLeft:mfx.arise.turns,retHp:bt.pHp,retMax:bt.pMax};
      bt.pHp=bt.shadow.maxHp;bt.pMax=bt.shadow.maxHp;
      updateMeCard();setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","ARISE!","crit");},bsMs(260));
    }
  }
  if(bt&&bt.tower&&towerRun&&towerRun.idx+1<towerRun.waves.length){advanceTowerFoe();return;}
  endBattle(true);
}
/* lineupAoeHit: damage AoE kena musuh AKTIF (urusan caller) + SELURUH slot CADANGAN tower (waves sisa setelah idx).
   Cadangan lazy-init w.hp = w.es.hp; w.hp habis -> w.dead=true: rail kasih tanda KO, advanceTowerFoe nge-skip,
   dan kalau sisa semua mati -> endBattle(true). Mode story (bukan tower) no-op karena musuh cuma 1. */
/* lineupNextHit: damage FLAT ke slot CADANGAN tower terdepan yang masih hidup (serangan pierce "yang di belakangnya"); story no-op */
function lineupNextHit(dmg){
  if(!bt||bt.over||!bt.tower||!towerRun||!(dmg>0))return;
  let hitW=null,hitSlotIdx=0;
  for(let i=towerRun.idx+1,s=0;i<towerRun.waves.length;i++,s++){
    const w=towerRun.waves[i];
    if(!w||w.dead)continue;
    hitW=w;hitSlotIdx=s;break;
  }
  if(!hitW)return;
  if(hitW.hp==null)hitW.hp=hitW.es.hp;
  hitW.hp-=dmg;
  if(hitW.hp<=0){hitW.hp=0;hitW.dead=true;}
  const rail=document.querySelector(".foe-rail");
  if(rail)rail.outerHTML=towerEnemyBenchRail();
  setTimeout(()=>{
    if(!bt||bt.over)return;
    const sqs=document.querySelectorAll(".foe-rail .bench-sq:not(.empty)");
    const sq=sqs[hitSlotIdx]||sqs[0];
    if(sq){
      sq.classList.remove("aoe-struck");void sq.offsetWidth;sq.classList.add("aoe-struck");
      setTimeout(()=>sq.classList.remove("aoe-struck"),450);
      floatText(sq,"-"+fmt(dmg),"burn mini","PIERCE");
    }else{
      floatText(".fighter.foe","PIERCE -"+fmt(dmg),"crit");
    }
  },bsMs(380));
}
function lineupAoeHit(dmg){
  if(!bt||bt.over||!bt.tower||!towerRun||!(dmg>0))return;
  let killed=0;
  for(let i=towerRun.idx+1;i<towerRun.waves.length;i++){
    const w=towerRun.waves[i];
    if(!w||w.dead)continue;
    if(w.hp==null)w.hp=w.es.hp;
    w.hp-=dmg;
    if(w.hp<=0){w.hp=0;w.dead=true;killed++;}
  }
  const rail=document.querySelector(".foe-rail");
  if(rail)rail.outerHTML=towerEnemyBenchRail();
  if(typeof window.playOverdriveAoeFx==="function")window.playOverdriveAoeFx(dmg);
  const sqs=document.querySelectorAll(".foe-rail .bench-sq:not(.empty)");
  sqs.forEach((sq,idx)=>{
    const wNum=(towerRun.idx+2+idx);
    setTimeout(()=>{
      if(bt&&!bt.over&&sq)floatText(sq,"-"+fmt(dmg),"burn mini","WAVE "+String(wNum).padStart(2,"0"));
    },bsMs(240+idx*85));
  });
  if(killed)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe",killed+" RESERVE KO!","crit");},bsMs(900));
}
function advanceTowerFoe(){
  if(!bt||bt.over)return;
  bt.fgen=++FGEN;/* generasi musuh: cb basi dari kill sebelumnya bakal kebuang */
  const prevWave=(towerRun&&towerRun.waves)?towerRun.waves[towerRun.idx]:null;
  if(prevWave){prevWave.hp=0;prevWave.dead=true;}
  do{towerRun.idx++;}while(towerRun.idx<towerRun.waves.length&&towerRun.waves[towerRun.idx]&&towerRun.waves[towerRun.idx].dead);
  if(towerRun.idx>=towerRun.waves.length){endBattle(true);return;}
  const w=towerRun.waves[towerRun.idx];
  bt.en=w.en;bt.es=w.es;bt.eid=w.eid;bt.efx=w.efx;bt.eHp=(w.hp!=null)?w.hp:w.es.hp;
  bt.openGuard=true;bt.eBurn=0;bt.eStun=0;bt.phase2used=false;bt.domainUsed=false;bt.domainLeft=0;bt.domainNow=false;
  {const rfx=resolveFx(bt.eq,bt.efx);if(rfx.dimensionShift)bt.eAbilityOff=rfx.dimensionShift.turns;}
    {const cfx=resolveFx(bt.eq,bt.efx);if(cfx.copy&&cfx.copy.turns)bt.copyLeft=cfx.copy.turns;}
  {const nfx=resolveFx(bt.eq,bt.efx);
   /* FOE ENTRY FREEZE (ICE QUEEN): musuh baru masuk -> bekukan turns giliran (pola entryFreeze, guard statusImmune) */
   if(nfx.foeEntryFreeze&&!foeStatusImmune()){bt.eStun=nfx.foeEntryFreeze.turns;bt.freezeLeft=nfx.foeEntryFreeze.turns;setTimeout(()=>{floatText(".fighter.foe","FROZEN","crit");if(window.playFreezeFx)playFreezeFx("foe",false);},bsMs(300));}
   /* FREEZE TRANSFER (ABSOLUTE ZERO): musuh ini mewarisi freeze dari target beku yang dibunuh sebelumnya */
   if(bt.freezeNext){bt.freezeNext=false;if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun,1);bt.freezeLeft=Math.max(bt.freezeLeft,1);setTimeout(()=>{floatText(".fighter.foe","FROZEN","crit");if(window.playFreezeFx)playFreezeFx("foe",false);},bsMs(360));}}
  }
bt.ePoison=0;bt.dizzyStack=0;bt.dizzyLeft=0;bt.rbBounce=0;bt.pbKey="";bt.pbStreak=0;
bt.pBurn=0;bt.pFreeze=0;bt.pPoisonCut=0;bt.pInk=0;bt.pInkPct=0;
  /* THUNDERCLAP FLASH overflow dari gelombang sebelumnya langsung menghantam musuh baru ini */
  const hadOverflow=!!(bt.overflow&&bt.overflow>0);
  if(hadOverflow){bt.eHp=Math.max(0,bt.eHp-bt.overflow);bt.overflow=0;}
  w.hp=Math.max(0,bt.eHp);
  /* sama seperti tag-in pemain: slot 1 tumbang dulu di arena, lalu slot 2 naik dan slot 1 jatuh ke TAG
     dengan tanda ✕ — sebelumnya kartu gelombang 1 langsung diganti diam-diam */
  const downEl=document.querySelector(".fighter.foe");
  if(downEl){downEl.classList.remove("foe-enter");downEl.classList.add("ko");koFx(downEl);}
  floatText(".fighter.foe","KO","crit");
  if(typeof window.hzAnimateDeathAndSwap==="function"){
    try{window.hzAnimateDeathAndSwap("foe",prevWave,w);}catch(e){}
  }
  bt.turn++;
  setTimeout(()=>{
    if(!bt||bt.over)return;
    w.hp=Math.max(0,bt.eHp);
    const side=document.getElementById("foeSide");
    if(side)side.innerHTML=towerFoeHtml(w)+towerEnemyBenchRail();
    clearFoeEnter();
    setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    if(hadOverflow)setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","THUNDERCLAP","crit");}},bsMs(500));
    const foeEl=side?side.querySelector(".fighter.foe"):null;
    if(foeEl){foeEl.style.opacity="1";enterFx(foeEl);}
    if(typeof applyFoeEntryPassives==="function")applyFoeEntryPassives();
    const tl=document.getElementById("turnLabel");if(tl)tl.innerHTML="FLOOR <b>"+towerRun.floor+"</b> · WAVE <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>";
    floatText(".fighter.foe","TAG-IN!","tagin");
    if(typeof window.hzBattleSync==="function"){try{window.hzBattleSync();}catch(e){}}
    if(typeof window.sheetStatusSync==="function"){try{window.sheetStatusSync();}catch(e){}}
    /* Musuh baru masuk = giliran MUSUH yang jalan. GET EXCITED satu-satunya yang menyela (serangan ekstra pemain). */
    if(bt.excited){bt.excited=false;floatText(".fighter.foe","EXTRA ATTACK!","crit");schedPhase(450,playerPhase);}else{schedPhase(450,enemyPhase);}
  },bsMs(960));
}
function towerEnd(win){
  if(bt){clearTimeout(bt.timer);bt.over=true;}
  const f=towerRun.floor;
  if(win){
    /* Menang lantai: kasih hadiah lalu LANGSUNG naik lantai berikutnya tanpa overlay. */
    const r=towerReward(f);
    /* 0028: coin ditambah lokal HANYA tanpa sesi cloud; kalau ada sesi, saldo
       menunggu RPC claim_tower_coins. Lihat catatan di battle.js finish(). */
    const coinLocal=!(typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.claimTowerCoins);
    if(coinLocal)state.coins+=r.coins;
    /* 0025: coin lantai dibayar server (claim_tower_coins), batas claim/hari +
       breaker coin harian. Gagal → angka lokal ditarik balik, saldo server menang. */
    (async()=>{
      if(!(typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.claimTowerCoins))return;
      let res=null;
      try{res=await window.CloudDB.claimTowerCoins(currentUser,f);}catch(e){res=null;}
      if(coinLocal&&res&&!res.ok&&(res.msg==="DAILY_CAP"||res.msg==="UNREACHABLE")){
        state.coins=Math.max(0,(state.coins||0)-r.coins);
        try{toast(res.msg==="UNREACHABLE"?"FLOOR LOCKED":"DAILY COIN LIMIT","Floor coins not credited by server","#f87171");}catch(e){}
      }
      try{save();renderShell();}catch(e){}
    })();
    /* Drop tiap floor lolos: Instant roll 100% PASTI (DITABUNG, di-roll saat kalah) — 100 tarikan per lantai · Weather 5% · Luck +1 10% · Speed +1 10% */
    if(!towerRun.drops)towerRun.drops={weather:0,luck:0,speed:0};
    const rr=100;
    towerRun.pendingRolls=(towerRun.pendingRolls||0)+rr; towerRun.cards=(towerRun.cards||0)+rr;
    if(Math.random()<0.05){state.potions=(state.potions||0)+1;towerRun.drops.weather++;}
    if(Math.random()<0.10){state.luckPots=state.luckPots||[0,0,0];state.luckPots[0]++;towerRun.drops.luck++;}
    if(Math.random()<0.10){state.speedPots=state.speedPots||[0,0,0];state.speedPots[0]++;towerRun.drops.speed++;}
    /* DROP INSTAN PACK per lantai — BASE rate, TANPA luck player.
       5K 5% · 10K 2% · 25K 1% · 100K 0,5% (50K tidak ada drop Tower). */
    state.rollPacks=state.rollPacks||{};
    towerRun.packDrops=towerRun.packDrops||{};
    const packGot=[];
    TOWER_PACK_DROPS.forEach(d=>{
      if(Math.random()<d.p){
        state.rollPacks[d.k]=(state.rollPacks[d.k]||0)+1;
        towerRun.packDrops[d.k]=(towerRun.packDrops[d.k]||0)+1;
        packGot.push(d.name);
      }
    });
    /* DROP LANGKAH CRAYON V2 — BASE murni TANPA luck player: pedang-api 0,1% · kyubi 0,01% per lantai. */
    const rare=[];
    towerRun.rareDrops=towerRun.rareDrops||[];
    if(!state.artOwned.includes("pedang-api")&&Math.random()<0.001){state.artOwned.push("pedang-api");rare.push("ARTIFACT FLAME SWORD · +120 FLAT & +100% LUCK");towerRun.rareDrops.push({kind:'art',id:"pedang-api",name:"FLAME SWORD",icon:"assets/artifacts/pedang-api.webp",n:1});}
    if(!state.petOwned.includes("kyubi")&&Math.random()<0.0001){state.petOwned.push("kyubi");rare.push("PET KYUBI FOX · +200 FLAT & +300% LUCK");towerRun.rareDrops.push({kind:'pet',id:"kyubi",name:"KYUBI FOX",icon:"assets/pets/kyubi.webp",n:1});}
    /* Token Inf: +1 per lantai, +5 per lantai bos. */
    const tok=towerIsBossFloor(f)?5:1;
    state.infTokens=(state.infTokens||0)+tok; towerRun.tokens=(towerRun.tokens||0)+tok;
    /* 0026: token lantai dibayar server (claim_tower_tokens). */
    (async()=>{
      if(!(typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.claimTowerTokens))return;
      let res=null;
      try{res=await window.CloudDB.claimTowerTokens(currentUser,f);}catch(e){res=null;}
      if(res&&!res.ok&&(res.msg==="DAILY_CAP"||res.msg==="UNREACHABLE")){
        state.infTokens=Math.max(0,(state.infTokens||0)-tok);
        try{toast(res.msg==="UNREACHABLE"?"FLOOR LOCKED":"DAILY TOKEN LIMIT","Floor tokens not credited by server","#f87171");}catch(e){}
      }
      try{save();renderShell();}catch(e){}
    })();
    towerRun.cleared=f; towerRun.coins=(towerRun.coins||0)+r.coins;
    state.tower.best=Math.max(state.tower.best||0,f);
    if(typeof lbTrackTower==="function")lbTrackTower(state.tower.best);
    save(); renderShell(); fanfare();
    toast("FLOOR "+f+" CONQUERED","+"+rr+" ROLLS STORED · +"+tok+" TOKENS","#7df9ff");
    packGot.forEach((nm,i)=>setTimeout(()=>toast("INSTANT PACK DROP · FLOOR "+f,nm+" · ADDED TO BACKPACK","#FFD700"),500*(i+1)));
    rare.forEach((m,i)=>setTimeout(()=>toast("RARE DROP · FLOOR "+f,m,"#fb923c"),700*(i+1)));
    bt=null;
    towerEnter(f+1);
    return;
  }
  /* Kalah: run berhenti — cairkan SEMUA roll yang ditabung SEBELUM sfx/DOM apa pun */
  const pending=towerRun.pendingRolls||0;
  let loot=[];
  try{ loot=pending>0?instantRoll(pending):[]; }
  catch(err){ console.error("towerEnd instantRoll error",err); }
  towerRun.pendingRolls=0;
  try{ sfx.lose(); }catch(e){}
  const reached=towerRun.cleared||0;
  const dr=towerRun.drops||{weather:0,luck:0,speed:0};
  const auto=!!(state&&state.tower&&state.tower.auto);
  towerLossAutoPending=auto;
  try{ save(); renderShell(); }catch(e){}
  try{ toast("RUN ENDED AT FLOOR "+f,"FLOORS CONQUERED: "+reached+" · CARDS +"+fmt(towerRun.cards||0)+" · TOKENS +"+fmt(towerRun.tokens||0),"#f87171"); }catch(e){}
  /* Popup hasil roll (kartu + potion) tetap tampil — z-220, di atas segalanya. */
  try{ showTowerLoot(loot,dr,null,{packDrops:towerRun.packDrops,rareDrops:towerRun.rareDrops}); }
  catch(err){ console.error("showTowerLoot error",err); }
  /* Lobby Tower muncul di belakang popup: begitu AMBIL diklik, pemain sudah di hub. */
  try{ stopBattleLoop(); }catch(e){}
  towerView="hub";
  try{ render(); }catch(e){}
  /* Auto-restart tapi gak ada yang bisa diklik (run tuntas sebelum lantai apa pun
     ditaklukkan → loot & potion kosong → popup gak muncul): restart setelah jeda singkat. */
  if(auto&&!loot.length&&!(dr.weather+dr.luck+dr.speed)){
    setTimeout(()=>{
      if(!towerLossAutoPending)return;
      towerLossAutoPending=false;
      try{ towerStartRun(); }catch(e){ console.error("tower auto-restart error",e); }
    },1200);
  }
}
/* ==========================================================================
   HASIL DROP — "DROP REPORT" (port _tmp/proto_instantpack_v1.html,
   dikunci user 2026-11-07). Markup hidup di index.html (#rollResultPop),
   isi dirakit di sini. Dipakai bersama: instant pack, tower, intan roll,
   reward iklan — angka tetap dari luckChance/fmtChance/TIER_COLOR/MUT_COLOR.

   Yang berubah vs desain lama (cyan "Solo Leveling"):
     + header hazard DROP REPORT + serial
     + ringkasan 4 sel: TOTAL PULLS / UNIQUE / RAREST / EXTRAS
     + chip filter ALL / TOP RARE / MUTATED / SHINY
     + tile 1:1: border tier, border mutasi, badge SHINY+MUT, ×N, "1 IN …"
     + extras (pack/potion/artefak/pet) tampil paling depan di filter ALL
   ========================================================================== */
const RR_POTION=[
  {k:'weather',label:'WEATHER POTION',icon:'assets/images/weather-potion.webp?v=1'},
  {k:'luck',label:'LUCK POTION',icon:'assets/images/pot-luck-1.webp'},
  {k:'speed',label:'SPEED POTION',icon:'assets/images/pot-speed-1.webp'}
];
const RR_PACK_ICON={r5k:'assets/images/instanpack-5k.webp',r10k:'assets/images/instanpack-10k.webp',r25k:'assets/images/instanpack-25k.webp',r50k:'assets/images/instanpack-50k.webp',r100k:'assets/images/instanpack-100k.webp'};
const RR_TIER_W={R:1,SR:2,SSR:3,UR:4,EX:5,BOSS:6};
const RR_FILTERS=[
  {k:'all',label:'ALL',id:'rrCfAll'},
  {k:'rare',label:'TOP RARE',id:'rrCfRare'},
  {k:'mut',label:'MUTATED',id:'rrCfMut'},
  {k:'shiny',label:'SHINY',id:'rrCfShiny'}
];
let _rrD={list:[],drops:{},extra:{},total:0,filter:'all'};

function rrGroups(results){
  const groups={};
  (results||[]).forEach(r=>{
    const key=r.cardId+'|'+(r.mut||'none')+'|'+(r.shiny?1:0);
    let g=groups[key];
    if(!g)g=groups[key]={cardId:r.cardId,tier:r.tier,mut:(r.mut&&r.mut!=='none')?r.mut:'none',shiny:!!r.shiny,n:0};
    g.n+=(typeof r.n==='number'?r.n:1);
  });
  return Object.values(groups).sort((a,b)=>luckChance(b.cardId,b.mut,b.shiny)-luckChance(a.cardId,a.mut,a.shiny)||b.n-a.n);
}
function rrIsRare(g){
  const tier=g.tier||cardTier(g.cardId)||'';
  return (RR_TIER_W[tier]||1)>=5||(g.mut&&g.mut!=='none');
}
function rrTile(g){
  const name=cardName(g.cardId);
  const isMut=g.mut&&g.mut!=='none', isShiny=!!g.shiny;
  const tier=g.tier||cardTier(g.cardId)||'';
  const cv=luckChance(g.cardId,g.mut,g.shiny);
  const col=isMut?(MUT_COLOR[g.mut]||'#f5f5f5'):((tier&&TIER_COLOR[tier])||'#f5f5f5');
  const badges=(isShiny||isMut)
    ? '<span class="pr-badges">'
      +(isShiny?(typeof shinyStampHtml==='function'?shinyStampHtml(true):'<span class="pr-badge sh">SHINY</span>'):'')
      +(isMut?(typeof mutStampHtml==='function'?mutStampHtml(g.mut,true):'<span class="pr-badge mut" style="--mc:'+(MUT_COLOR[g.mut]||'#fff')+'">'+(MUT_LABEL[g.mut]||g.mut).toUpperCase()+'</span>'):'')
      +'</span>'
    : '';
  const hzCls=(typeof hzBorderCls==='function')?hzBorderCls(isMut?g.mut:'none',isShiny,{tile:true,dense:true}):'';
  const hzLayers=(typeof hzBorderLayerHtml==='function')?hzBorderLayerHtml():'';
  return '<div class="pr-tile'+(isMut?' mut-'+g.mut:'')+(isShiny?' shiny':'')+hzCls+'" data-tier="'+tier+'" title="'+name+'">'
    +hzLayers
    +(g.n>1?'<span class="pr-cnt">×'+fmt(g.n)+'</span>':'')
    +badges
    +'<img src="'+cardThumb(g.cardId)+'" alt="'+name+'" width="96" height="96" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'">'
    +'<div class="pr-tfoot" style="color:'+col+'">1 IN '+fmtChance(cv)+'</div>'
    +'</div>';
}
function rrExtra(kind,key,n){
  const isPack=kind==='pack';
  const pot=RR_POTION.find(p=>p.k===key);
  const icon=isPack?(RR_PACK_ICON[key]||''):(pot?pot.icon:'');
  const label=isPack?('INSTANT '+String(key).replace('r','').toUpperCase()):(pot?pot.label:String(key).toUpperCase());
  return '<div class="pr-tile extra" title="'+label+'">'
    +(n>1?'<span class="pr-cnt">×'+fmt(n)+'</span>':'')
    +'<span class="pr-badge" style="background:#22d3ee;color:#000">'+(isPack?'PACK':'POTION')+'</span>'
    +'<span class="pr-exart"><img src="'+icon+'" alt="'+label+'" width="64" height="64" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'"></span>'
    +'<span class="pr-exnm">'+label+'</span></div>';
}
function rrRare(r){
  let icon=r.icon||'';
  try{
    if(r.kind==='art'&&typeof ART_DEFS!=='undefined'){const d=ART_DEFS.find(x=>x.id===r.id);if(d&&d.img)icon=thumbSrc(d.img);}
    else if(r.kind==='pet'&&typeof PET_DEFS!=='undefined'){const d=PET_DEFS.find(x=>x.id===r.id);if(d&&d.img)icon=thumbSrc(d.img);}
  }catch(e){}
  if(!icon)icon='assets/images/icon-index-card.webp';
  return '<div class="pr-tile extra" title="'+r.name+'">'
    +'<span class="pr-badge" style="background:#b58cff;color:#000">'+(r.kind==='pet'?'PET':'RELIC')+'</span>'
    +'<span class="pr-exart"><img src="'+icon+'" alt="'+r.name+'" width="64" height="64" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'"></span>'
    +'<span class="pr-exnm">'+r.name+'</span></div>';
}
function rrPaint(){
  const st=_rrD, all=st.list;
  const rare=all.filter(rrIsRare);
  const mut=all.filter(g=>g.mut&&g.mut!=='none');
  const shiny=all.filter(g=>g.shiny);
  const counts={all:all.length,rare:rare.length,mut:mut.length,shiny:shiny.length};
  const put=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};

  put('rrTotal',fmt(st.total));
  put('rrUnique',fmt(all.length));
  let best=null,bestC=-1;
  all.forEach(g=>{const c=luckChance(g.cardId,g.mut,g.shiny);if(c>bestC){bestC=c;best=g;}});
  put('rrRarest',best?('1 IN '+fmtChance(bestC)):'—');
  const d=st.drops||{}, ex=st.extra||{};
  let extras=0;
  Object.keys(ex.packDrops||{}).forEach(k=>extras+=(ex.packDrops[k]||0));
  RR_POTION.forEach(p=>extras+=(d[p.k]||0));
  extras+=(ex.rareDrops||[]).length;
  put('rrExtras',extras?('+'+fmt(extras)):'—');
  RR_FILTERS.forEach(f=>put(f.id,counts[f.k]));

  document.querySelectorAll('#rrTools [data-rrf]').forEach(b=>{
    b.classList.toggle('on',b.getAttribute('data-rrf')===st.filter);
  });

  let html='';
  if(st.filter==='all'){
    Object.keys(ex.packDrops||{}).forEach(k=>{const n=ex.packDrops[k]||0;if(n>0)html+=rrExtra('pack',k,n);});
    RR_POTION.forEach(p=>{const n=d[p.k]||0;if(n>0)html+=rrExtra('potion',p.k,n);});
    (ex.rareDrops||[]).forEach(r=>{html+=rrRare(r);});
  }
  const shown=(st.filter==='all')?all:(st.filter==='rare'?rare:(st.filter==='mut'?mut:shiny));
  html+=shown.map(rrTile).join('');
  if(!html)html='<div class="pr-empty">NO ENTRY MATCHES THIS FILTER</div>';
  const body=document.getElementById('rrBody');if(body)body.innerHTML=html;
  const sc=document.getElementById('rrScroll');if(sc)sc.scrollTop=0;
}
function showTowerLoot(results,drops,title,extra){
  const pop=document.getElementById('rollResultPop');if(!pop)return;
  results=results||[];
  const d=drops||{weather:0,luck:0,speed:0};
  const ex=extra||{};
  const totalPot=RR_POTION.reduce((s,p)=>s+(d[p.k]||0),0);
  const totalPack=(typeof TOWER_PACK_DROPS!=='undefined')
    ? TOWER_PACK_DROPS.reduce((s,p)=>s+((ex.packDrops&&ex.packDrops[p.k])||0),0) : 0;
  if(!results.length&&!totalPot&&!totalPack&&!(ex.rareDrops||[]).length)return;

  _rrD={
    list:rrGroups(results),
    drops:d, extra:ex, filter:'all',
    total:(typeof results.totalPulls==='number')?results.totalPulls:results.length
  };
  const t=document.getElementById('rrTitle');
  if(t)t.textContent=String(title||'RUN SPOILS')
    .replace(/^HASIL INSTANT ROLL\s*·\s*/i,'')
    .replace(/^HASIL\s*/i,'')
    .replace(/^REWARD WATCH ADS\s*·\s*/i,'');
  const sr=document.getElementById('rrSerial');
  if(sr)sr.textContent='SERIAL 0x'+(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase()+' · HZ-PROTOCOL 871';

  rrPaint();
  pop.classList.add('show');
  try{armRollPopAutoClose(5000);}catch(e){} /* auto-claim 5 detik: gak nahan AFK / auto-run tower */
}
/* chip filter + tombol X: satu listener, dipasang sekali */
(function rrBind(){
  const pop=document.getElementById('rollResultPop');
  if(!pop||pop.__rrBound)return;
  pop.__rrBound=true;
  pop.addEventListener('click',e=>{
    const f=e.target.closest&&e.target.closest('[data-rrf]');
    if(f){_rrD.filter=f.getAttribute('data-rrf');rrPaint();return;}
    if(e.target.closest&&e.target.closest('#rrX')){try{closeRollPop();}catch(err){}}
  });
})();


/* =============== DECK =============== */
let filter="ALL", deckSearch="", raidSearch="", dpSearch="";
function runCardSearch(inp, grid, nr){
  if(!inp||!grid)return;
  const q=(inp.value||"").trim().toLowerCase();
  let vis=0;
  grid.querySelectorAll("[data-name]").forEach(el=>{const hit=!q||(el.getAttribute("data-name")||"").indexOf(q)>=0;el.style.display=hit?"":"none";if(hit)vis++;});
  for(let p=grid.parentElement;p;p=p.parentElement){if(typeof p.__lzFlush==="function"){p.__lzFlush();break;}}
  if(nr)nr.style.display=vis?"none":"block";
}
function openModal(id){
  const s=state.stacks.find(x=>x.id===id);if(!s)return;
  const c=CARDS[s.char],st=cardStats(s.char,s.mut,s.trait,s.shiny);
  const m=document.getElementById("modal");
  const mcEl=document.getElementById("md-card");mcEl.dataset.tier=s.tier||"";
  const mdMut=(s.mut&&s.mut!=="none")?s.mut:"";
  const mdTrait=(s.trait&&s.trait!=="none")?s.trait:"";
  const mdCls=(typeof hzBorderCls==="function")?hzBorderCls(mdMut||"none",!!s.shiny):"";
  const mdLayers=(typeof hzBorderLayerHtml==="function")?hzBorderLayerHtml():"";
  let mdStamps="";
  if(s.shiny&&typeof shinyStampHtml==="function") mdStamps+=shinyStampHtml(true);
  if(mdMut&&typeof mutStampHtml==="function") mdStamps+=mutStampHtml(mdMut,true);
  if(mdTrait&&typeof traitStampHtml==="function") mdStamps+=traitStampHtml(mdTrait,true);
  mcEl.innerHTML=`
    <span class="md-art${mdCls}">${mdLayers}${mdStamps?`<span class="md-art-stamps">${mdStamps}</span>`:""}<img src="${c.sprite_asset}" alt="${c.name}"></span>
    <div class="md-info">
      <div class="eyebrow" style="color:${(s.tier&&TIER_COLOR[s.tier])||'#7DF9FF'}"><span>${rarityText(s.tier,luckChance(s.char,s.mut,s.shiny))}</span>${mdMut&&typeof mutStampHtml==="function"?mutChip(mdMut,mutStampHtml(mdMut,false)):(mdMut?mutChip(mdMut,mutPill(mdMut)):"")}${s.shiny&&typeof shinyStampHtml==="function"?shinyStampHtml(false):""}${mdTrait&&typeof traitStampHtml==="function"?traitChip(mdTrait,traitStampHtml(mdTrait,false)):""}</div>
      <div class="md-name">${c.name}</div>
      <div class="cr-title" style="margin-bottom:8px">${c.type}</div>
      <div class="cr-stats"><span class="hp"><i>HP</i> <b>${fmtStat(st.hp)}</b></span><span class="atk"><i>ATK</i> <b>${fmtStat(st.atk)}</b></span></div>
      <div class="cr-skill" style="margin-bottom:4px"><span class="ds-skill-badge">✦ ${c.passive.name}<span class="sk-txt">${skillText(s.char)}</span></span></div>
      <div class="md-actions">
        <button class="md-btn primary" id="md-use">${(function(){const di=state.deck.indexOf(s.id);return di>=0?("DI DEK · SLOT "+(di+1)):"EQUIP TO DECK";})()}</button>
        <button class="md-btn${s.fav?" on":""}" id="md-fav">${s.fav?"★ FAVORIT":"FAVORIT"}</button>
        <button class="md-btn${s.lock?" on":""}" id="md-lock">${s.lock?"🔒 LOCKED":"LOCK"}</button>
        <button class="md-btn md-close" id="md-close">TUTUP</button>
      </div>
    </div>`;
  m.classList.add("show");
  document.getElementById("md-use").onclick=()=>{sfx.hit();const di=state.deck.indexOf(s.id);if(di>=0){setDeckSlot(di,null);}else{let e=state.deck.indexOf(null);if(e<0)e=0;setDeckSlot(e,s.id);}openModal(id);renderBackpackPanel();if(!battleLive()&&typeof render==="function")render();};
  document.getElementById("md-fav").onclick=()=>{s.fav=!s.fav;save();openModal(id);renderBackpackPanel();};
  document.getElementById("md-lock").onclick=()=>{s.lock=!s.lock;save();openModal(id);};
  document.getElementById("md-close").onclick=()=>{m.classList.remove("show");renderBackpackPanel();};
}
document.getElementById("modal").addEventListener("click",e=>{
  if(e.target.id==="modal"){document.getElementById("modal").classList.remove("show");renderBackpackPanel();}
});

/* =============== LOBBY =============== */
function renderTitleCrownHtml(titleName, variantCls){
  if (typeof window.renderSoloGodAuraHtml === 'function') {
    const key = titleName || (window.state && window.state.playerTitle) || "ROOKIE";
    const defs = (typeof TITLE_DEFS !== 'undefined') ? TITLE_DEFS : (window.TITLE_DEFS || []);
    let t = defs.find(x => x.id === key || x.name === key);
    if (!t && defs.length > 0) {
      t = defs.find(x => x.id === "ROOKIE") || defs[defs.length - 2] || defs[0];
    }
    if (t) return window.renderSoloGodAuraHtml(t);
  }
  const name = titleName || "ROOKIE";
  const cls = variantCls || ("title-" + name.toLowerCase().replace(/\s+/g,"_"));
  return `<div class="card-floating-title ${cls}">
    <span class="cft-crown">
      <svg width="18" height="14" viewBox="0 0 24 18" fill="none">
        <path d="M2 15L4 4L9 9L12 2L15 9L20 4L22 15H2Z" fill="url(#crownGrad)" stroke="#FFE57F" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="12" cy="2" r="1.5" fill="#FFF9C4"/>
        <circle cx="4" cy="4" r="1.2" fill="#FFF9C4"/>
        <circle cx="20" cy="4" r="1.2" fill="#FFF9C4"/>
        <defs>
          <linearGradient id="crownGrad" x1="2" y1="2" x2="22" y2="15" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FFD700"/>
            <stop offset="1" stop-color="#FF8F00"/>
          </linearGradient>
        </defs>
      </svg>
    </span>
    <span class="cft-wing cft-wing-left">
      <svg width="22" height="16" viewBox="0 0 32 24" fill="none">
        <path d="M30 18C20 18 10 14 2 2C6 10 12 18 20 22C24 23 28 21 30 18Z" fill="url(#wingGradL)" opacity="0.85"/>
        <path d="M28 14C18 14 12 10 6 4C10 9 16 14 24 16" stroke="#BAE6FD" stroke-width="1.2" stroke-linecap="round"/>
        <defs>
          <linearGradient id="wingGradL" x1="30" y1="2" x2="2" y2="22" gradientUnits="userSpaceOnUse">
            <stop stop-color="#38BDF8"/>
            <stop offset="1" stop-color="#0284C7" stop-opacity="0.2"/>
          </linearGradient>
        </defs>
      </svg>
    </span>
    <div class="cft-pill">
      <span class="cft-gem">✦</span>
      <span class="cft-text">${name}</span>
      <span class="cft-gem">✦</span>
      <span class="cft-sheen"></span>
    </div>
    <span class="cft-wing cft-wing-right">
      <svg width="22" height="16" viewBox="0 0 32 24" fill="none">
        <path d="M2 18C12 18 22 14 30 2C26 10 20 18 12 22C8 23 4 21 2 18Z" fill="url(#wingGradR)" opacity="0.85"/>
        <path d="M4 14C14 14 20 10 26 4C22 9 16 14 8 16" stroke="#BAE6FD" stroke-width="1.2" stroke-linecap="round"/>
        <defs>
          <linearGradient id="wingGradR" x1="2" y1="2" x2="30" y2="22" gradientUnits="userSpaceOnUse">
            <stop stop-color="#38BDF8"/>
            <stop offset="1" stop-color="#0284C7" stop-opacity="0.2"/>
          </linearGradient>
        </defs>
      </svg>
    </span>
  </div>`;
}
window.renderTitleCrownHtml = renderTitleCrownHtml;

function hubCardHtml(eq,idAttr,showHideBtn){
  if(!eq||!eq.char||!CARDS[eq.char]) return `<div class="hub-center"${idAttr||''}><div class="hc-info"><div class="hc-name">No cards yet</div></div></div>`;
  const tier=CARDS[eq.char].tier;
  const st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  const mut=(eq.mut&&eq.mut!=='none')?eq.mut:null;
  const trait=(eq.trait&&eq.trait!=='none')?eq.trait:null;
  const chanceText=rarityText(tier,luckChance(eq.char,eq.mut,eq.shiny));
  const hideBtn=showHideBtn?`<button class="roll-hide-btn" type="button">Sembunyikan</button>`:'';
  const hzCls=(typeof hzBorderCls==='function')?hzBorderCls(mut,!!eq.shiny):'';
  const hzLayers=(typeof hzBorderLayerHtml==='function')?hzBorderLayerHtml():'';
  const shBadge=eq.shiny?(typeof shinyStampHtml==='function'?shinyStampHtml(true):'<span class="shiny-badge shiny-pill">SHINY</span>'):'';
  const mBadge=mut?mutChip(mut,typeof mutStampHtml==='function'?mutStampHtml(mut,true):mutPill(mut)):'';
  const tBadge=trait?traitChip(trait,typeof traitStampHtml==='function'?traitStampHtml(trait,true):`<span class="hc-trait hc-gem" style="color:${TRAIT_COLOR[trait]};border-color:${TRAIT_COLOR[trait]}">${traitGem(14,trait)}</span>`):'';
  return `<div class="hub-center${CARDS[eq.char].fullArt?' fa':''}${mut?' mut-'+mut:''}${shinyCls(eq)}${hzCls}"${idAttr||''} data-tier="${tier}" style="--tcol:${mut?MUT_COLOR[mut]:((tier&&TIER_COLOR[tier])||'#7DF9FF')}">
      ${hzLayers}
      <div class="hc-img"><img src="${cardImg(eq.char)}" alt="${cardName(eq.char)}"${CARDS[eq.char].pos?` style="object-position:${CARDS[eq.char].pos}"`:''}>
          ${mut&&!eq.shiny?`<span class="hc-name-top hc-mut-name" data-text="${String(cardName(eq.char)).replace(/"/g,'&quot;')}">${mut==='rainbow'?mutText(mut,cardName(eq.char)):cardName(eq.char)}</span>`:eq.shiny?`<span class="hc-name-top hc-name-shine${mut?' hc-name-shine-'+mut:''}" data-text="${String(cardName(eq.char)).replace(/"/g,'&quot;')}" style="${mut==='gold'?'--sh-base:#E0BC6E;--sh-edge:rgba(224,188,110,.95);--sh-glow:rgba(224,188,110,.55)':mut==='rainbow'?'--sh-base:#B58CFF;--sh-edge:rgba(90,200,250,.95);--sh-glow:rgba(181,140,255,.55)':mut==='secret'?'--sh-base:#A855F7;--sh-edge:rgba(168,85,247,.95);--sh-glow:rgba(168,85,247,.55)':mut==='ultima'?'--sh-base:#FF0055;--sh-edge:rgba(255,51,102,.95);--sh-glow:rgba(255,0,85,.6)':'--sh-base:#22d3ee;--sh-edge:rgba(34,211,238,.95);--sh-glow:rgba(34,211,238,.55)'}">${cardName(eq.char)}</span>`:shinyName('span','hc-name-top','hc-name-shine',mut,eq.shiny,cardName(eq.char))}
          <span class="hc-chance${mut==='rainbow'?' hc-chance-rainbow':''}" style="color:${mut?MUT_COLOR[mut]:"#9AA6B2"}">${mut==='rainbow'?mutText(mut,chanceText):chanceText}</span>
          ${(mut||trait||eq.shiny)?`<div class="hc-badges">${shBadge}${mBadge}${tBadge}</div>`:''}
          <div class="skill-overlay"><b>${passiveName(eq.char)}</b><span class="sk-txt">${skillText(eq.char)}</span></div>
        </div>
        <div class="hc-info">
          <div class="hc-skill">${passiveName(eq.char)}</div>
          <div class="hc-desc">${skillText(eq.char)}</div>
          <div class="hc-stats"><div class="hp"><i>HP</i> <b>${fmtStat(st.hp)}</b></div><div class="atk"><i>ATK</i> <b>${fmtStat(st.atk)}</b></div></div>
        </div>
        ${hideBtn}
    </div>`;
}
/* Loadout kiri kartu: kolom vertikal [ARTEFAK 1][ARTEFAK 2][PET]. Klik → Backpack (tab ARTEFAK/PET). */
function hubLoadoutHtml(){
  const artSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
  const petSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10c-1.1 0-2-.9-2-2 0-.8.5-1.5 1.2-1.8C10.7 4.2 9 2.5 7 2.5 4.5 2.5 2.5 4.5 2.5 7c0 4 3 8 9.5 12.5C18.5 15 21.5 11 21.5 7c0-2.5-2-4.5-4.5-4.5-2 0-3.7 1.7-4.2 3.7.7.3 1.2 1 1.2 1.8 0 1.1-.9 2-2 2z"/></svg>`;

  const slot=(i)=>{
    const id=(state.artSlots||[])[i];
    const d=id?ART_DEFS.find(a=>a.id===id):null;
    return d
      ? `<div class="loadout-slot art-slot filled" data-bp="artefact" role="button" tabindex="0" style="--ac:${d.color}">
          <span class="tile-frame" aria-hidden="true"></span>
          <span class="ls-tag">ART ${i+1}</span>
          ${artIconHtml(d)}
          <span class="ls-tip"><b>${d.name}</b><small>${luckTxt(d)} · TERPASANG</small></span>
        </div>`
      : `<div class="loadout-slot art-slot empty" data-bp="artefact" role="button" tabindex="0">
          <span class="tile-frame" aria-hidden="true"></span>
          <span class="ls-tag">ART ${i+1}</span>
          <span class="ls-mark">${artSvg}</span>
          <span class="ls-lbl">EMPTY</span>
          <span class="ls-tip"><b>SLOT ARTEFAK ${i+1}</b><small>Kosong — klik untuk buka Backpack</small></span>
        </div>`;
  };

  const pet=lobbyPetHtml()
    ? `<div class="loadout-slot pet-slot filled" data-bp="pet" role="button" tabindex="0" title="Active pet — manage in Backpack" style="--ac:#8fd3ff">
        <span class="tile-frame" aria-hidden="true"></span>
        <span class="ls-tag">PET</span>
        ${lobbyPetHtml()}
      </div>`
    : `<div class="loadout-slot pet-slot empty" data-bp="pet" role="button" tabindex="0" title="Pet slot — empty">
        <span class="tile-frame" aria-hidden="true"></span>
        <span class="ls-tag">PET</span>
        <span class="ls-mark">${petSvg}</span>
        <span class="ls-lbl">EMPTY</span>
        <span class="ls-tip"><b>COMPANION PET</b><small>Kosong — klik untuk pasang Pet</small></span>
      </div>`;

  return slot(0)+slot(1)+pet;
}
/* Tile REBIRTH di rail kanan lobby — nilai dup dikumpulin di sini, naikkan luck (x5 per rebirth). */
function rbCompact(n){n=n||0;if(n>=1e9)return (n/1e9).toFixed(n>=1e10?0:1)+'B';if(n>=1e6)return (n/1e6).toFixed(n>=1e7?0:1)+'M';if(n>=1e3)return (n/1e3).toFixed(n>=1e4?0:1)+'K';return String(Math.floor(n));}
function hubRebirthTileHtml(){
  const cnt=typeof rebirthCount==='function'?rebirthCount():0;
  const es=typeof rebirthEssence==='function'?rebirthEssence():0;
  const th=typeof rebirthThreshold==='function'?rebirthThreshold():1000000;
  const mult=typeof rebirthLuckMult==='function'?rebirthLuckMult():1;
  const tier=(typeof rebirthTierMeta==='function')?rebirthTierMeta(cnt):{c1:'#c084fc'};
  const artSvg=(typeof rebirthCrestSvg==='function')
    ? rebirthCrestSvg(cnt)
    : `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M78 50a28 28 0 1 1-9-20.8"/><path d="M70 20l10 9-13 6" stroke-width="2.2"/><circle cx="50" cy="50" r="6" fill="currentColor"/></svg>`;
  const ready=es>=th;
  const pct=Math.max(0,Math.min(100,Math.round(es/th*100)));
  return `
    <div class="hub-box h-rebirth hub-link hub-link-rebirth${ready?' ready':''}" id="hubRebirth" role="button" title="Rebirth: convert duplicate essence into permanent luck (x5 per rebirth)">
      <span class="tile-frame" aria-hidden="true"></span>
      <span class="tile-index"><span class="tile-number" style="color:${tier.c1}">R${cnt}</span><span class="tile-category" style="color:#a855f7">CYCLE / ASCENSION</span></span>
      <span class="tile-art" aria-hidden="true">${artSvg}</span>
      <span class="tile-copy"><span class="hb-lbl" style="color:${tier.c1};text-shadow:0 0 10px rgba(192,132,252,.4)">REBIRTH</span><span class="hb-meta">LUCK ×${mult}</span></span>
      <span class="rebirth-progress">
        <span class="rebirth-meter" id="rebirthMeter" role="progressbar" aria-label="Rebirth progress" aria-valuemin="0" aria-valuemax="${th}" aria-valuenow="${es}"><span id="rebirthFill" style="width:${pct}%"></span></span>
        <span class="rb-sub" id="rebirthSub">${rbCompact(es)} / ${rbCompact(th)}</span>
      </span>
      <span class="tile-action" style="border-color:rgba(192,132,252,.5);color:${ready?'#e9d5ff':'#a855f7'}"><span>${ready?'REBIRTH':'LOCKED'}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>`;
}
/* Patch tile + HUD/drawer in-place tanpa full re-render (dipanggil setelah roll/rebirth). */
function updateRebirthUI(){
  if(typeof rebirthCount!=='function')return;
  const es=rebirthEssence(),th=rebirthThreshold(),cnt=rebirthCount(),mult=rebirthLuckMult();
  const ready=es>=th,pct=Math.max(0,Math.min(100,Math.round(es/th*100)));
  const tier=(typeof rebirthTierMeta==='function')?rebirthTierMeta(cnt):{c1:'#c084fc'};
  const box=document.getElementById('hubRebirth');
  if(box){
    box.classList.toggle('ready',ready);
    const num=box.querySelector('.tile-number');if(num){num.textContent='R'+cnt;num.style.color=tier.c1;}
    const lbl=box.querySelector('.hb-meta');if(lbl)lbl.textContent='LUCK ×'+mult;
    const art=box.querySelector('.tile-art');if(art&&typeof rebirthCrestSvg==='function')art.innerHTML=rebirthCrestSvg(cnt);
    const fill=document.getElementById('rebirthFill');if(fill)fill.style.width=pct+'%';
    const meter=document.getElementById('rebirthMeter');if(meter){meter.setAttribute('aria-valuemax',String(th));meter.setAttribute('aria-valuenow',String(es));}
    const sub=document.getElementById('rebirthSub');if(sub)sub.textContent=rbCompact(es)+' / '+rbCompact(th);
    const act=box.querySelector('.tile-action span');if(act)act.textContent=ready?'REBIRTH':'LOCKED';
  }
  const vest=document.getElementById('l12QsVest');
  if(vest)vest.textContent='R'+cnt;
  const ql=document.getElementById('l12QsLuck');
  if(ql&&typeof fmtLobbyLuck==='function')ql.textContent=fmtLobbyLuck();
  const drwSub=document.getElementById('drwRebirthSub');
  if(drwSub)drwSub.textContent='R'+cnt+' // LUCK ×'+mult+(ready?' · READY':'');
  const rbM=document.getElementById('rebirthModal');
  if(rbM&&rbM.classList.contains('show')&&typeof renderRebirthModal==='function')renderRebirthModal();
}
function onRebirthClick(){
  openRebirthModal();
}


/* ==========================================================================
   LIVING AAA ANIME HERO STANDEE & STAGE ENGINE (100% PURE AAA FIDELITY)
   ========================================================================== */

const LOBBY_FRAMES = {
  holo: { src: 'assets/frames/frame-holo-glass.svg', theme: 'theme-holo', name: 'HOLO GLASS' },
  gilded: { src: 'assets/frames/frame-gilded-ssr.svg', theme: 'theme-gilded', name: 'GILDED SSR' },
  suncrest: { src: 'assets/frames/frame-card-ssr.svg', theme: 'theme-gilded', name: 'SUN CREST' },
  mech: { src: 'assets/frames/frame-tactical-mech.svg', theme: 'theme-mech', name: 'TACTICAL MECH' },
  void: { src: 'assets/frames/frame-void-relic.svg', theme: 'theme-void', name: 'VOID RELIC' },
  cyber: { src: 'assets/frames/frame-hero-card.svg', theme: 'theme-void', name: 'CYBER ARMOR' },
  none: { src: '', theme: 'theme-none', name: 'NO FRAME' }
};

const LOBBY_BGS = {
  sanctuary: { src: 'assets/bg/lobby-wuwa-genshin.webp', name: 'WUWA HORIZON' },
  solaris: { src: 'assets/bg/lobby-solaris-city.webp', name: 'SOLARIS CITY' },
  abyss: { src: 'assets/bg/lobby-void-abyss.webp', name: 'VOID ABYSS' },
  observatory: { src: 'assets/bg/lobby-astral-observatory.webp', name: 'ASTRAL SPIRE' }
};
window.LOBBY_BGS = LOBBY_BGS;

function getLobbyActiveBg() {
  if (typeof state !== 'undefined' && state && state.lobbyBg && LOBBY_BGS[state.lobbyBg]) {
    return LOBBY_BGS[state.lobbyBg].src;
  }
  return LOBBY_BGS.sanctuary.src;
}
window.getLobbyActiveBg = getLobbyActiveBg;

function getLobbyActiveFrame() {
  const key = (typeof state !== 'undefined' && state && state.lobbyFrame && LOBBY_FRAMES[state.lobbyFrame]) 
    ? state.lobbyFrame 
    : 'holo';
  return LOBBY_FRAMES[key];
}

window.cycleLobbyBackground = function() {
  if (typeof playSound === 'function') playSound('switch');
  else if (window.sfx && sfx.hit) sfx.hit();
  const keys = Object.keys(LOBBY_BGS);
  let curIdx = keys.indexOf(state.lobbyBg || 'sanctuary');
  if (curIdx === -1) curIdx = 0;
  const nextKey = keys[(curIdx + 1) % keys.length];
  state.lobbyBg = nextKey;
  if (typeof save === 'function') save();
  else if (typeof saveState === 'function') saveState();

  const layer = document.getElementById('stageBgLayer');
  if (layer) {
    layer.style.opacity = '0.25';
    setTimeout(() => {
      layer.style.backgroundImage = 'url("' + LOBBY_BGS[nextKey].src + '")';
      layer.style.opacity = '1';
    }, 140);
  }
  if (typeof toast === 'function') toast('STAGE BACKGROUND', LOBBY_BGS[nextKey].name, '#38bdf8');
  else if (typeof showToast === 'function') showToast('LOBBY: ' + LOBBY_BGS[nextKey].name);
  if (typeof window.syncBattleBackground === 'function') window.syncBattleBackground();
};

window.cycleCardFrame = function() {
  if (typeof playSound === 'function') playSound('switch');
  else if (window.sfx && sfx.hit) sfx.hit();
  const keys = Object.keys(LOBBY_FRAMES);
  let curIdx = keys.indexOf(state.lobbyFrame || 'holo');
  if (curIdx === -1) curIdx = 0;
  const nextKey = keys[(curIdx + 1) % keys.length];
  state.lobbyFrame = nextKey;
  if (typeof save === 'function') save();
  else if (typeof saveState === 'function') saveState();

  const cfg = LOBBY_FRAMES[nextKey];
  const plate = document.getElementById('heroCardPlate');
  if (plate) plate.className = 'hero-card-plate ' + cfg.theme;

  const heroWrap = document.getElementById('heroStandeeWrap');
  if (heroWrap && heroWrap.classList.contains('hero')) {
    heroWrap.setAttribute('data-frame-theme', cfg.theme || '');
  }

  let frameEl = document.getElementById('heroFrameSvg') || document.querySelector('#heroStandeeWrap .frm');
  if (!frameEl && heroWrap) {
    frameEl = document.createElement('img');
    frameEl.className = 'frm';
    frameEl.id = 'heroFrameSvg';
    frameEl.alt = '';
    heroWrap.appendChild(frameEl);
  }
  if (frameEl) {
    if (cfg.src) {
      frameEl.style.display = 'block';
      frameEl.src = cfg.src;
    } else {
      frameEl.style.display = 'none';
      frameEl.removeAttribute('src');
    }
  }
  if (typeof toast === 'function') toast('HERO CARD FRAME', cfg.name, '#fbbf24');
  else if (typeof showToast === 'function') showToast('FRAME: ' + cfg.name);
};

/* Living Hero Standee HTML */
function hubLivingStandeeHtml(eq) {
  const frameCfg = getLobbyActiveFrame();
  const frameSvgUrl = frameCfg.src;
  const frameTheme = frameCfg.theme;

  if (!eq || !eq.char || !CARDS[eq.char]) {
    return `
    <div class="celestial-rune-ring" id="celestialRune">
      <div class="celestial-inner-hex"></div>
    </div>
    <div class="hero-standee-wrap" id="heroStandeeWrap" onclick="if(window.sfx&&sfx.hit)sfx.hit();if(typeof openDeckModal==='function')openDeckModal();else if(typeof toggleBackpack==='function')toggleBackpack();" title="Kelola Deck">
      <div class="hero-standee-rimlight" id="heroRimlight"></div>
      ${(typeof renderTitleCrownHtml === 'function') ? renderTitleCrownHtml((state && state.playerTitle) || "ROOKIE") : ''}
      <div class="hero-card-plate ${frameTheme}" id="heroCardPlate">
        <div class="hero-card-art">
          <div class="hero-standee-char" id="heroStandeeChar" style="background-image: url('assets/cards/art/shadow-king.webp');"></div>
          <div class="holo-foil-sheen" id="holoFoil"></div>
        </div>
        ${frameSvgUrl ? `<img class="hero-frame-svg" id="heroFrameSvg" src="${frameSvgUrl}" alt="Hero Frame" />` : ''}
      </div>

    </div>`;
  }

  const c = CARDS[eq.char];
  const charImg = (typeof cardImg === 'function') ? cardImg(eq.char) : 'assets/cards/art/shadow-king.webp';
  const name = (typeof cardName === 'function') ? cardName(eq.char) : c.name;
  const tier = c.tier || 'SSR';
  const tierCol = (typeof TIER_COLOR !== 'undefined' && TIER_COLOR[tier]) ? TIER_COLOR[tier] : '#38bdf8';
  const mut = (eq.mut && eq.mut !== 'none') ? eq.mut : null;
  const trait = (eq.trait && eq.trait !== 'none') ? eq.trait : null;
  const skill = (typeof passiveName === 'function') ? passiveName(eq.char) : 'Combat Protocol';
  const sText = (typeof skillText === 'function') ? skillText(eq.char) : 'Tactical Overdrive';
  const pos = c.pos ? ('background-position:' + c.pos + ';') : '';

  return `
  <!-- Rotating Celestial Runic Glyphs -->
  <div class="celestial-rune-ring" id="celestialRune">
    <div class="celestial-inner-hex"></div>
  </div>

  <!-- The Hunter Character Stage with Cyber Armor Frame Overlay -->
  <div class="hero-standee-wrap" id="heroStandeeWrap" onclick="if(window.sfx&&sfx.hit)sfx.hit();if(typeof openDeckModal==='function')openDeckModal();else if(typeof toggleBackpack==='function')toggleBackpack();" title="Kelola Deck">
    <!-- Ambient Rimlight Backglow -->
    <div class="hero-standee-rimlight" id="heroRimlight" style="--tier-col:${tierCol};"></div>

    <!-- Active Equipped Operator Title Floating Aura Crown -->
    ${(typeof renderTitleCrownHtml === 'function') ? renderTitleCrownHtml((state && state.playerTitle) || "ROOKIE") : ''}

    <!-- Beveled Chamfer Plate with Hero Frame -->
    <div class="hero-card-plate ${frameTheme}" id="heroCardPlate">
      <div class="hero-card-art">
        <div class="hero-standee-char" id="heroStandeeChar" style="background-image: url('${charImg}'); ${pos}"></div>
        <!-- Dynamic Prismatic Holographic Foil Sheen -->
        <div class="holo-foil-sheen" id="holoFoil"></div>
      </div>
      ${frameSvgUrl ? `<img class="hero-frame-svg" id="heroFrameSvg" src="${frameSvgUrl}" alt="Hero Frame" />` : ''}
    </div>


  </div>`;
}

/* ================= AMBIENT CANVAS & PARTICLES ================= */
let _ambientCanvasAnimId = null;

function initAmbientCanvas() {
  const canvas = document.getElementById('ambientCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let cw = canvas.width = window.innerWidth;
  let ch = canvas.height = window.innerHeight;

  const onResize = () => {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
  };
  window.removeEventListener('resize', onResize);
  window.addEventListener('resize', onResize, { passive: true });

  /* Titik ambient bergerak <1px/frame, jadi ~20 gambar/detik terasa sama dengan 60.
     Tanpa batas ini loop meraster kanvas se-viewport 60x/detik: 98% waktu idle
     lobby kepakai buat kerja yang tidak bisa dilihat player.
     DRAW_GAP = jarak antar-gambar; STEP_MS = satuan kecepatan lama (1 langkah per frame 60Hz),
     dipakai biar titik-titiknya tidak melambat cuma karena digambar lebih jarang. */
  const DRAW_GAP = 1000 / 24;
  const STEP_MS = 1000 / 60;
  let lastDraw = -Infinity;
  let resumeAt = 0;
  window.addEventListener('scroll', () => { resumeAt = performance.now() + 200; }, { passive: true, capture: true });

  const particles = [];
  for (let i = 0; i < 45; i++) {
    particles.push({
      x: Math.random() * cw,
      y: Math.random() * ch,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -0.35 - Math.random() * 0.55,
      r: 1 + Math.random() * 2.2,
      alpha: 0.15 + Math.random() * 0.6,
      color: Math.random() > 0.45 ? 'rgba(56, 189, 248, ' : 'rgba(192, 132, 252, '
    });
  }

  if (_ambientCanvasAnimId) cancelAnimationFrame(_ambientCanvasAnimId);

  function anim(now) {
    if (!document.getElementById('ambientCanvas')) return;
    _ambientCanvasAnimId = requestAnimationFrame(anim);
    const t = now || performance.now();
    const elapsed = t - lastDraw;
    if (elapsed < DRAW_GAP) return;
    if (document.hidden || document.body.classList.contains('perf-paused') || t < resumeAt) return;
    const steps = Math.min(6, elapsed / STEP_MS);
    lastDraw = t;
    ctx.clearRect(0, 0, cw, ch);
    for (let p of particles) {
      p.x += p.vx * steps;
      p.y += p.vy * steps;
      if (p.y < -10) p.y = ch + 10;
      if (p.x < -10) p.x = cw + 10;
      if (p.x > cw + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.fill();
    }
  }
  anim(performance.now());
}

/* ================= 3D KINETIC HERO PARALLAX ================= */
let _parallaxBound = false;

function initKineticParallax() {
  if (_parallaxBound) return;
  _parallaxBound = true;

  const updateParallax = (clientX, clientY) => {
    const wrap = document.getElementById('heroStandeeWrap');
    if (!wrap) return;
    const char = document.getElementById('heroStandeeChar');
    const rimlight = document.getElementById('heroRimlight');
    const badge = document.getElementById('heroTacticalBadge');
    const rune = document.getElementById('celestialRune');
    const foil = document.getElementById('holoFoil');
    const bgLayer = document.getElementById('stageBgLayer');

    const w = window.innerWidth;
    const h = window.innerHeight;
    const xNorm = (clientX / w) - 0.5;
    const yNorm = (clientY / h) - 0.5;

    const rotY = xNorm * 14;
    const rotX = -yNorm * 14;

    wrap.style.transform = 'rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg)';
    if (char) char.style.transform = 'translate3d(' + (xNorm * 6) + 'px, ' + (yNorm * 6) + 'px, 0)';
    if (foil) foil.style.transform = 'translate(' + (xNorm * 35) + '%, ' + (yNorm * 35) + '%)';
    if (bgLayer) bgLayer.style.transform = 'scale(1.05) translate3d(' + (-xNorm * 18) + 'px, ' + (-yNorm * 18) + 'px, 0)';
    if (rimlight) rimlight.style.transform = 'translate3d(' + (-xNorm * 15) + 'px, ' + (-yNorm * 15) + 'px, -20px) scale(1.05)';
    if (badge) badge.style.transform = 'translate3d(' + (xNorm * 38) + 'px, ' + (yNorm * 38) + 'px, 75px)';
    if (rune) rune.style.transform = 'translate3d(' + (-xNorm * 25) + 'px, ' + (-yNorm * 25) + 'px, -60px)';
  };

  window.addEventListener('mousemove', (e) => {
    updateParallax(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      updateParallax(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    const wrap = document.getElementById('heroStandeeWrap');
    if (!wrap) return;
    wrap.style.transform = 'rotateX(0deg) rotateY(0deg)';
    const char = document.getElementById('heroStandeeChar');
    if (char) char.style.transform = 'translate3d(0,0,0)';
    const foil = document.getElementById('holoFoil');
    if (foil) foil.style.transform = 'translate(0, 0)';
    const bgLayer = document.getElementById('stageBgLayer');
    if (bgLayer) bgLayer.style.transform = 'scale(1.05) translate3d(0, 0, 0)';
    const rimlight = document.getElementById('heroRimlight');
    if (rimlight) rimlight.style.transform = 'translate3d(0,0,-20px)';
    const badge = document.getElementById('heroTacticalBadge');
    if (badge) badge.style.transform = 'translate3d(0,0,75px)';
    const rune = document.getElementById('celestialRune');
    if (rune) rune.style.transform = 'translate3d(0,0,-60px)';
  });
}

/* ================= LIVE TICKING TELEMETRY ================= */
let _telemetryTimer = null;

function initTelemetryTicker() {
  if (_telemetryTimer) return;
  _telemetryTimer = setInterval(() => {
    const coords = document.getElementById('telCoords');
    const freq = document.getElementById('telFreq');
    if (!coords || !freq) {
      clearInterval(_telemetryTimer);
      _telemetryTimer = null;
      return;
    }
    const lat = (35.680 + Math.random() * 0.02).toFixed(3);
    const lon = (139.690 + Math.random() * 0.02).toFixed(3);
    coords.textContent = 'POS: ' + lat + ' // ' + lon;
    const f = (142.75 + Math.random() * 0.15).toFixed(2);
    freq.textContent = 'CARRIER: ' + f + ' MHz';
  }, 1200);
}

/* ================= DRAWER CONTROLLER & SWIPE GESTURES ================= */
window.openCommandDrawer = function() {
  const d = document.getElementById('commandDrawer');
  const b = document.getElementById('drawerBackdrop');
  if (d && d.parentElement !== document.body) document.body.appendChild(d);
  if (b && b.parentElement !== document.body) document.body.appendChild(b);
  if (d) d.classList.add('open');
  if (b) b.classList.add('open');
  document.body.classList.add('drawer-open');

  const closeBtn = document.getElementById('drwCloseBtn');
  if (closeBtn) {
    closeBtn.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeCommandDrawer();
    };
  }
  if (b) {
    b.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeCommandDrawer();
    };
  }

  if (typeof playSubBass === 'function') playSubBass(70, 0.2, 0.22);
  if (typeof playSound === 'function') playSound('open');
  else if (window.sfx && typeof sfx.open === 'function') sfx.open();
};

window.closeCommandDrawer = function() {
  const d = document.getElementById('commandDrawer');
  const b = document.getElementById('drawerBackdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.remove('open');
  document.body.classList.remove('drawer-open');
  if (typeof playSubBass === 'function') playSubBass(50, 0.15, 0.15);
  if (typeof playSound === 'function') playSound('close');
  else if (window.sfx && typeof sfx.close === 'function') sfx.close();
};

window.cleanupCommandDrawer = function() {
  const d = document.getElementById('commandDrawer');
  const b = document.getElementById('drawerBackdrop');
  if (d) d.remove();
  if (b) b.remove();
  document.body.classList.remove('drawer-open');
};

window.toggleCommandDrawer = function() {
  const d = document.getElementById('commandDrawer');
  if (d && d.classList.contains('open')) closeCommandDrawer();
  else openCommandDrawer();
};

let _drawerGesturesBound = false;
function initCommandDrawerGestures() {
  if (_drawerGesturesBound) return;
  _drawerGesturesBound = true;

  // Keyboard shortcut: ESC to close, M to toggle
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const d = document.getElementById('commandDrawer');
      if (d && d.classList.contains('open')) {
        closeCommandDrawer();
      }
    } else if (e.key === 'm' || e.key === 'M') {
      // If typing in input, ignore
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      toggleCommandDrawer();
    }
  });

  // Touch swipe gesture: swipe left from edge opens, swipe right closes
  let touchStartX = 0;
  let touchStartY = 0;

  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (diffY > 80) return; // vertical scroll, ignore

    const d = document.getElementById('commandDrawer');
    const isOpen = d && d.classList.contains('open');

    // Swipe left from right edge (starts in rightmost 25% of screen)
    if (!isOpen && diffX < -60 && touchStartX > window.innerWidth * 0.72) {
      openCommandDrawer();
    }
    // Swipe right to close
    else if (isOpen && diffX > 60) {
      closeCommandDrawer();
    }
  }, { passive: true });
}

/* ================= MAIN RENDER LOBBY ================= */
let _l12HudTick = null;   /* timer HUD v12 (potion / global luck / weather) */
let _lastWxId = undefined;
let _l12DockPanel = null; /* active lobby buff panel: null | 'luck' | 'speed' | 'global' | 'weather' */
let _l12PopKey = "";      /* fingerprint to refresh open panel only on state change */

function _l12Esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
  });
}
function _l12CloverSvg() {
  return '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true">'
    + '<polygon points="18,3 31,10.5 31,25.5 18,33 5,25.5 5,10.5" stroke="#f3e600" stroke-width="1.3" stroke-opacity=".65" fill="rgba(16,185,129,.12)"/>'
    + '<path d="M18 16.5 C15 11.5 10.5 8.5 13 6 C15 4 17.5 6 18 8.5 C18.5 6 21 4 23 6 C25.5 8.5 21 11.5 18 16.5 Z" fill="#6be08a" stroke="#f3e600" stroke-width=".9"/>'
    + '<path d="M18 19.5 C15 24.5 10.5 27.5 13 30 C15 32 17.5 30 18 27.5 C18.5 30 21 32 23 30 C25.5 27.5 21 24.5 18 19.5 Z" fill="#6be08a" stroke="#f3e600" stroke-width=".9"/>'
    + '<path d="M16.5 18 C11.5 15 8.5 10.5 6 13 C4 15 6 17.5 8.5 18 C6 18.5 4 21 6 23 C8.5 25.5 11.5 21 16.5 18 Z" fill="#6be08a" stroke="#f3e600" stroke-width=".9"/>'
    + '<path d="M19.5 18 C24.5 15 27.5 10.5 30 13 C32 15 30 17.5 27.5 18 C30 18.5 32 21 30 23 C27.5 25.5 24.5 21 19.5 18 Z" fill="#6be08a" stroke="#f3e600" stroke-width=".9"/>'
    + '<circle cx="18" cy="18" r="2.2" fill="#f3e600"/>'
    + '</svg>';
}
function _l12CloseSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">'
    + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
}

/* ---- SIMPAN REFERENSI NODE HIDUP YANG DIRELOKASI ----
   #rollBtn/#rollAutoBtn/#footAv aslinya anak .lobby-footer (luar #app, index.html:795).
   Setelah dipindah ke slot v12 mereka jadi anak #app -> innerHTML layar lain
   (#/tower, #/raid, battle) MELEPAS mereka dari DOM. Tanpa referensi kuat node-nya
   di-GC dan hilang permanen (ROLL/AUTO/menu lenyap saat balik ke lobby). Registry
   ini menahan object-nya, jadi renderLobby berikutnya bisa mengadopsi kembali
   node yang SAMA beserta listener boot.js-nya. */
const _l12Live = Object.create(null);

/* ---- Thumb kartu utk panel operator (avatar + 4 slot party) ----
   RIWAYAT PULL sudah DIHAPUS dari lobby v12 (perintah user 2026-10-31: "hapus aja
   ga guna"), tapi fungsi ini tetap dipakai .avatar dan .pslot di renderLobby(). */
function _l12SlotThumb(s) {
  if (!s) return "";
  const st = (typeof CARDS !== "undefined") ? CARDS[s.char] : null;
  const thumb = (typeof cardThumb === "function") ? cardThumb(s.char) : ((st && st.thumb) ? st.thumb : "assets/cards/thumb/" + s.char + ".webp");
  return `<img src="${thumb}" alt="">`;
}

/* ---- SHOWCASE POSTER (4 lingkaran party di kanan-bawah panggung) ----
   Klik salah satu .pav -> poster hero, judul, dan chip meta berganti ke kartu
   slot itu. Murni tampilan: state.deck/save TIDAK diubah (deck leader tetap
   slot 0), jadi tidak menambah payload cloud dan tidak menyentuh roll/battle. */
let _l12ShowIdx = 0;
let _l12ShowParty = [];
try {
  const _sv = parseInt(localStorage.getItem("aab-lobby-showcase"), 10);
  if (isFinite(_sv) && _sv >= 0 && _sv <= 3) _l12ShowIdx = _sv;
} catch (e) {}

function _l12HeroMetaHtml(card, lv, combo) {
  const c = (card && typeof CARDS !== "undefined") ? CARDS[card.char] : null;
  const mut = (card && card.mut && card.mut !== "none") ? String(card.mut).toUpperCase() : "";
  const mutCol = (card && typeof MUT_COLOR !== "undefined" && MUT_COLOR[card.mut]) ? MUT_COLOR[card.mut] : "rgba(245,245,245,.5)";
  const tier = (c && c.tier) ? c.tier : "SSR";
  return (mut ? '<span class="mchip" style="--mc:' + mutCol + '">' + mut + '</span>' : "")
    + '<span class="mchip" style="--mc:rgba(245,245,245,.5)">' + tier + '</span>'
    + '<span class="mchip" style="--mc:rgba(245,245,245,.5)">LV ' + lv + '</span>'
    + '<span class="mchip" style="--mc:rgba(245,245,245,.5)">' + combo + '/4 DECK</span>';
}

/* Tukar poster TANPA renderLobby(): render ulang seluruh #app me-restart ambient
   canvas & memicu flicker, padahal yang berubah cuma satu gambar + 4 chip. */
window.l12Showcase = function (i) {
  i = parseInt(i, 10);
  if (window.sfx && sfx.hit) sfx.hit();
  const party = _l12ShowParty || [];
  /* Slot kosong: jangan buang klik — arahkan ke Backpack (perilaku lama hidup di
     tombol tas, tapi user tetap butuh jalan mengisi slot yang belum terisi). */
  if (!(i >= 0 && i < party.length) || !party[i]) {
    if (typeof toggleBackpack === "function") toggleBackpack();
    return;
  }
  if (i === _l12ShowIdx) return;
  const card = party[i];
  const c = (typeof CARDS !== "undefined") ? CARDS[card.char] : null;
  if (!c) return;
  _l12ShowIdx = i;
  try { localStorage.setItem("aab-lobby-showcase", String(i)); } catch (e) {}
  const root = document.querySelector(".lobby-hub.l12.c12");
  if (!root) return;
  const img = root.querySelector(".c12main .stage .hero .artbox img.art");
  if (img) {
    const src = (typeof cardImg === "function") ? cardImg(card.char) : "";
    if (src) img.setAttribute("src", src);
    /* CSS .art memakai object-position !important, jadi inline pun harus important. */
    img.style.setProperty("object-position", c.pos || "center 12%", "important");
  }
  const ttl = root.querySelector(".c12title");
  if (ttl) ttl.innerHTML = String((typeof cardName === "function") ? cardName(card.char) : (c.name || card.char)).replace(" ", "<br>");
  const meta = root.querySelector(".c12meta");
  if (meta) meta.innerHTML = _l12HeroMetaHtml(card, (state && state.playerLv) || 1, party.filter(Boolean).length);
  root.querySelectorAll(".c12party .pav").forEach(function (b, k) {
    b.classList.toggle("on", k === i);
    b.setAttribute("aria-pressed", k === i ? "true" : "false");
  });
};


/* =====================================================================
   CHIBI HAZARD STREET LOBBY & REALISTIC ANIME WEATHER SYSTEM
   Ported from _tmp/proto_lobby_nh_v1.html (User Locked 2026-11-12)
   ===================================================================== */

const REAL_WEATHERS = [
  { id: "awakened", name: "AWAKENED", rar: "AWAKENED", luckBonus: 15.0, speedBonus: 8.0, color: "#c084fc", accent: "#facc15", skyTop: "#0a0318", skyMid: "#2a0f4a", reflOpacity: 0.38, fx: "awakened" },
  { id: "arcane", name: "ARCANE", rar: "ARCANE", luckBonus: 10.0, speedBonus: 6.0, color: "#a78bfa", accent: "#38bdf8", skyTop: "#07051e", skyMid: "#1e1347", reflOpacity: 0.35, fx: "arcane" },
  { id: "goofy", name: "GOOFY", rar: "RARE", luckBonus: 7.0, speedBonus: 4.5, color: "#fde047", accent: "#f43f5e", skyTop: "#221603", skyMid: "#4c3408", reflOpacity: 0.42, fx: "goofy" },
  { id: "glitch", name: "GLITCH", rar: "RARE", luckBonus: 6.0, speedBonus: 4.0, color: "#f43f5e", accent: "#22d3ee", skyTop: "#18040d", skyMid: "#33081a", reflOpacity: 0.45, fx: "glitch" },
  { id: "doodle", name: "DOODLE", rar: "RARE", luckBonus: 5.0, speedBonus: 3.5, color: "#f1f5f9", accent: "#38bdf8", skyTop: "#111625", skyMid: "#232e42", reflOpacity: 0.30, fx: "doodle" },
  { id: "eclipse", name: "ECLIPSE", rar: "RARE", luckBonus: 4.0, speedBonus: 3.0, color: "#f43f5e", accent: "#fbbf24", skyTop: "#060105", skyMid: "#290410", reflOpacity: 0.48, fx: "eclipse" },
  { id: "iceage", name: "ICE AGE", rar: "UNCOMMON", luckBonus: 3.5, speedBonus: 3.0, color: "#38bdf8", accent: "#ffffff", skyTop: "#031724", skyMid: "#0b344e", reflOpacity: 0.45, fx: "iceage" },
  { id: "galactic", name: "GALACTIC", rar: "UNCOMMON", luckBonus: 3.0, speedBonus: 2.5, color: "#fb923c", accent: "#c084fc", skyTop: "#060618", skyMid: "#1d123a", reflOpacity: 0.36, fx: "galactic" },
  { id: "aurora", name: "AURORA", rar: "UNCOMMON", luckBonus: 2.5, speedBonus: 2.0, color: "#2dd4bf", accent: "#38bdf8", skyTop: "#021417", skyMid: "#073634", reflOpacity: 0.42, fx: "aurora" },
  { id: "monsoon", name: "MONSOON", rar: "UNCOMMON", luckBonus: 2.0, speedBonus: 1.8, color: "#3b82f6", accent: "#93c5fd", skyTop: "#051122", skyMid: "#112644", reflOpacity: 0.55, fx: "monsoon" },
  { id: "sandstorm", name: "SANDSTORM", rar: "COMMON", luckBonus: 1.3, speedBonus: 1.4, color: "#f59e0b", accent: "#fbbf24", skyTop: "#1c1005", skyMid: "#3e2609", reflOpacity: 0.22, fx: "sandstorm" },
  { id: "thunderstorm", name: "THUNDERSTORM", rar: "COMMON", luckBonus: 1.3, speedBonus: 1.4, color: "#eab308", accent: "#ffffff", skyTop: "#0c0d18", skyMid: "#202138", reflOpacity: 0.50, fx: "thunderstorm" },
  { id: "snowfall", name: "SNOWFALL", rar: "COMMON", luckBonus: 1.2, speedBonus: 1.2, color: "#e2e8f0", accent: "#38bdf8", skyTop: "#0a1322", skyMid: "#1e2e47", reflOpacity: 0.35, fx: "snowfall" },
  { id: "windy", name: "WINDY", rar: "COMMON", luckBonus: 1.1, speedBonus: 1.2, color: "#4ade80", accent: "#f472b6", skyTop: "#05160d", skyMid: "#0d351f", reflOpacity: 0.28, fx: "windy" },
  { id: "lightrain", name: "LIGHT RAIN", rar: "COMMON", luckBonus: 1.1, speedBonus: 1.1, color: "#7dd3fc", accent: "#93c5fd", skyTop: "#071220", skyMid: "#10253c", reflOpacity: 0.44, fx: "lightrain" },
  { id: "clear", name: "CLEAR SKY", rar: "COMMON", luckBonus: 1.0, speedBonus: 1.0, color: "#9ca3af", accent: "#e5e7eb", skyTop: "#07080d", skyMid: "#121420", reflOpacity: 0.16, fx: "clear" }
];

let currentVillageWx = REAL_WEATHERS[0];
let _wxParts = [];
let _wxSplashes = [];
let _lightningFlash = 0;
let _lightningBolt = null;
let _shootingStars = [];
let _lastMeteorTime = 0;
let _animTime = 0;
let _wxAnimRunning = false;
let _walkerAnimRunning = false;
let _villageWalkers = [];

const OCCULT_RUNES = ['\u{13080}', '\u2726', '\u2727', '\u25c7', '\u2b21', '\u27c1', '\uaa5c', '\u{10308}', '\u232c', '\u229b'];
const GLITCH_SNIPPETS = ['0x7F', '0101', 'NULL', 'SYNC', 'ERR_404', 'SYS_FAIL', 'CORE', 'BUFFER'];
const DOODLE_MARKS = ['\u2605', '@', '\u{1f4a7}', '///', '\u26a1', '!!', '\u2726'];

function getCelestialSvg(id) {
  switch (id) {
    case "awakened":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <g stroke-width="1.8" opacity="0.85">
          <line x1="50" y1="6" x2="50" y2="18"/><line x1="50" y1="82" x2="50" y2="94"/>
          <line x1="6" y1="50" x2="18" y2="50"/><line x1="82" y1="50" x2="94" y2="50"/>
          <line x1="19" y1="19" x2="28" y2="28"/><line x1="72" y1="72" x2="81" y2="81"/>
          <line x1="81" y1="19" x2="72" y2="28"/><line x1="19" y1="81" x2="28" y2="72"/>
        </g>
        <path d="M14 50 C26 26, 74 26, 86 50 C74 74, 26 74, 14 50 Z" stroke-width="2.2" fill="currentColor" fill-opacity="0.15"/>
        <circle cx="50" cy="50" r="14" stroke-width="2" fill="#0c051a"/>
        <circle cx="50" cy="50" r="8" fill="currentColor"/>
        <circle cx="47" cy="47" r="3" fill="#ffffff"/>
        <circle cx="50" cy="50" r="28" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>
      </svg>`;
    case "arcane":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <polygon points="50,10 85,70 15,70" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/>
        <polygon points="50,90 85,30 15,30" stroke-width="1.8" fill="currentColor" fill-opacity="0.08"/>
        <circle cx="50" cy="50" r="44" stroke-width="1.6"/>
        <circle cx="50" cy="50" r="38" stroke-width="1" stroke-dasharray="4 4" opacity="0.75"/>
        <circle cx="50" cy="50" r="10" stroke-width="2" fill="currentColor" fill-opacity="0.25"/>
        <circle cx="50" cy="10" r="3.5" fill="currentColor"/><circle cx="85" cy="70" r="3.5" fill="currentColor"/><circle cx="15" cy="70" r="3.5" fill="currentColor"/>
        <circle cx="50" cy="90" r="3.5" fill="currentColor"/><circle cx="85" cy="30" r="3.5" fill="currentColor"/><circle cx="15" cy="30" r="3.5" fill="currentColor"/>
      </svg>`;
    case "eclipse":
      return `<svg width="190" height="190" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <g stroke-width="1.8" opacity="0.75">
          <path d="M50 8 Q56 22 50 30 Q44 22 50 8 Z" fill="currentColor"/>
          <path d="M82 24 Q72 36 68 32 Q78 20 82 24 Z" fill="currentColor"/>
          <path d="M92 50 Q78 56 70 50 Q78 44 92 50 Z" fill="currentColor"/>
          <path d="M82 76 Q78 64 68 68 Q72 80 82 76 Z" fill="currentColor"/>
          <path d="M50 92 Q44 78 50 70 Q56 78 50 92 Z" fill="currentColor"/>
          <path d="M18 76 Q28 64 32 68 Q22 80 18 76 Z" fill="currentColor"/>
          <path d="M8 50 Q22 44 30 50 Q22 56 8 50 Z" fill="currentColor"/>
          <path d="M18 24 Q22 36 32 32 Q28 20 18 24 Z" fill="currentColor"/>
        </g>
        <circle cx="50" cy="50" r="32" stroke-width="3" stroke="#f43f5e" opacity="0.9"/>
        <circle cx="50" cy="50" r="30" fill="#020204"/>
        <circle cx="50" cy="50" r="28" stroke-width="1" stroke="#f43f5e" opacity="0.4"/>
      </svg>`;
    case "galactic":
      return `<svg width="190" height="190" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="16" fill="currentColor" fill-opacity="0.3" stroke-width="2"/>
        <circle cx="50" cy="50" r="8" fill="currentColor"/>
        <ellipse cx="50" cy="50" rx="44" ry="14" stroke-width="2" transform="rotate(-24 50 50)"/>
        <ellipse cx="50" cy="50" rx="40" ry="11" stroke-width="1.2" stroke-dasharray="3 3" transform="rotate(-24 50 50)" opacity="0.8"/>
        <ellipse cx="50" cy="50" rx="34" ry="8" stroke-width="1" transform="rotate(40 50 50)" opacity="0.5"/>
        <circle cx="16" cy="34" r="4" fill="currentColor"/><circle cx="84" cy="66" r="3" fill="currentColor"/><circle cx="72" cy="22" r="2.5" fill="#fff"/>
      </svg>`;
    case "aurora":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <path d="M10 32 Q30 18 50 32 T90 32" stroke-width="2.5" opacity="0.85"/>
        <path d="M10 46 Q30 32 50 46 T90 46" stroke-width="2.2" opacity="0.7"/>
        <path d="M10 60 Q30 46 50 60 T90 60" stroke-width="1.8" opacity="0.55"/>
        <path d="M10 74 Q30 60 50 74 T90 74" stroke-width="1.4" opacity="0.4"/>
        <circle cx="50" cy="24" r="6" fill="currentColor"/>
        <line x1="50" y1="12" x2="50" y2="36" stroke-width="1.8"/><line x1="38" y1="24" x2="62" y2="24" stroke-width="1.8"/>
      </svg>`;
    case "thunderstorm":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <path d="M22 62 C14 62, 10 54, 14 46 C12 36, 22 28, 32 30 C38 20, 56 18, 64 26 C74 22, 86 30, 84 42 C92 46, 92 58, 82 62 Z" stroke-width="2" fill="currentColor" fill-opacity="0.18"/>
        <path d="M52 36 L38 58 L50 58 L42 84 L66 52 L54 52 Z" fill="#ffffff" stroke="#facc15" stroke-width="2"/>
        <path d="M42 84 L38 94" stroke="#facc15" stroke-width="1.8"/>
      </svg>`;
    case "monsoon":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="42" stroke-width="1.8" stroke-dasharray="8 6" opacity="0.6"/>
        <path d="M50 14 C70 14 86 30 86 50 C86 64 74 76 60 76 C46 76 38 66 38 54 C38 46 44 40 50 40 C54 40 58 44 58 48 C58 52 54 54 50 54" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="28" cy="24" r="3" fill="currentColor"/><circle cx="76" cy="30" r="3.5" fill="currentColor"/>
        <circle cx="78" cy="74" r="2.5" fill="currentColor"/><circle cx="24" cy="70" r="3" fill="currentColor"/>
      </svg>`;
    case "sandstorm":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="16" fill="currentColor" fill-opacity="0.25" stroke-width="2"/>
        <path d="M12 28 Q40 18 64 30 T96 26" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M6 44 Q36 34 60 46 T94 42" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M14 60 Q44 50 68 62 T98 58" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M8 76 Q38 66 62 78 T92 74" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
    case "iceage":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <line x1="50" y1="8" x2="50" y2="92" stroke-width="2.4"/>
        <line x1="14" y1="29" x2="86" y2="71" stroke-width="2.4"/><line x1="14" y1="71" x2="86" y2="29" stroke-width="2.4"/>
        <path d="M50 20 L42 28 M50 20 L58 28 M50 80 L42 72 M50 80 L58 72" stroke-width="2"/>
        <path d="M26 36 L24 46 M26 36 L34 42 M74 64 L76 54 M74 64 L66 58" stroke-width="2"/>
        <path d="M26 64 L34 58 M26 64 L24 54 M74 36 L66 42 M74 36 L76 46" stroke-width="2"/>
        <polygon points="50,38 60,50 50,62 40,50" fill="currentColor" fill-opacity="0.25" stroke-width="1.6"/>
      </svg>`;
    case "snowfall":
      return `<svg width="170" height="170" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <line x1="50" y1="12" x2="50" y2="88" stroke-width="2"/>
        <line x1="17" y1="31" x2="83" y2="69" stroke-width="2"/><line x1="17" y1="69" x2="83" y2="31" stroke-width="2"/>
        <circle cx="50" cy="50" r="10" stroke-width="1.5" stroke-dasharray="2 3"/>
        <circle cx="50" cy="12" r="3" fill="currentColor"/><circle cx="50" cy="88" r="3" fill="currentColor"/>
        <circle cx="17" cy="31" r="3" fill="currentColor"/><circle cx="83" cy="69" r="3" fill="currentColor"/>
      </svg>`;
    case "lightrain":
      return `<svg width="170" height="170" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <path d="M52 24 A18 18 0 0 0 68 44 A18 18 0 1 1 52 24 Z" fill="currentColor" fill-opacity="0.25" stroke-width="1.8"/>
        <path d="M22 64 C16 64, 12 56, 16 50 C14 40, 24 34, 34 36 C40 28, 56 26, 64 34 C74 32, 82 40, 80 50 C88 54, 88 64, 80 64 Z" stroke-width="2" fill="#07121f"/>
        <line x1="30" y1="72" x2="26" y2="86" stroke-width="2" stroke-linecap="round"/>
        <line x1="46" y1="72" x2="42" y2="86" stroke-width="2" stroke-linecap="round"/>
        <line x1="62" y1="72" x2="58" y2="86" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case "windy":
      return `<svg width="170" height="170" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <path d="M12 36 L64 36 A14 14 0 1 1 54 48" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M8 52 L76 52 A12 12 0 1 0 68 40" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M16 68 L56 68 A10 10 0 1 1 48 76" stroke-width="2" stroke-linecap="round"/>
        <path d="M28 24 Q36 20 38 28 Q34 34 28 24 Z" fill="currentColor"/>
        <path d="M82 62 Q90 58 92 66 Q88 72 82 62 Z" fill="currentColor"/>
      </svg>`;
    case "glitch":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <rect x="22" y="22" width="56" height="56" stroke-width="2" stroke-dasharray="14 6"/>
        <line x1="50" y1="12" x2="50" y2="30" stroke-width="2"/><line x1="50" y1="70" x2="50" y2="88" stroke-width="2"/>
        <line x1="12" y1="50" x2="30" y2="50" stroke-width="2"/><line x1="70" y1="50" x2="88" y2="50" stroke-width="2"/>
        <rect x="28" y="38" width="48" height="6" fill="#22d3ee" stroke="none" opacity="0.8"/>
        <rect x="24" y="48" width="54" height="5" fill="#f43f5e" stroke="none" opacity="0.85"/>
        <rect x="34" y="58" width="40" height="5" fill="#ffffff" stroke="none" opacity="0.9"/>
      </svg>`;
    case "doodle":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="22" stroke-width="2.2" stroke-dasharray="100" fill="currentColor" fill-opacity="0.1"/>
        <path d="M50 14 Q53 20 50 26 M50 74 Q47 80 50 86" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="14" y1="50" x2="26" y2="50" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="74" y1="50" x2="86" y2="50" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="24" y1="24" x2="33" y2="33" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="67" y1="67" x2="76" y2="76" stroke-width="2.2" stroke-linecap="round"/>
        <polygon points="50,38 53,46 62,46 55,51 58,60 50,54 42,60 45,51 38,46 47,46" fill="currentColor"/>
      </svg>`;
    case "goofy":
      return `<svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="22" fill="currentColor" fill-opacity="0.3" stroke-width="2.5"/>
        <g stroke-width="2.4" stroke-linecap="round">
          <path d="M50 12 L50 22 M50 78 L50 88"/><path d="M12 50 L22 50 M78 50 L88 50"/>
          <path d="M24 24 L31 31 M69 69 L76 76"/><path d="M76 24 L69 31 M31 69 L24 76"/>
        </g>
        <polygon points="50,34 54,44 65,44 56,51 60,62 50,55 40,62 44,51 35,44 46,44" fill="#ffffff" stroke="currentColor" stroke-width="1.5"/>
      </svg>`;
    default:
      return `<svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.65"><circle cx="12" cy="12" r="6"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>`;
  }
}

function setVillageWeather(id, silent) {
  const w = REAL_WEATHERS.find(x => x.id === id) || REAL_WEATHERS[0];
  currentVillageWx = w;
  const shell = document.querySelector('.nh-shell');
  const world = document.getElementById('villageWorld');
  if (shell) {
    shell.style.setProperty('--wx-color', w.color);
    shell.style.setProperty('--wx-accent', w.accent);
    shell.style.setProperty('--wx-sky-top', w.skyTop);
    shell.style.setProperty('--wx-sky-mid', w.skyMid);
  }
  if (world) {
    world.className = 'village-world wx-mode-' + w.id;
  }
  document.querySelectorAll('.street-reflections .wet-refl').forEach(r => {
    r.style.setProperty('--RC', w.color);
    r.style.opacity = String(w.reflOpacity || 0.25);
  });
  const celCore = document.getElementById('celCoreSvg');
  if (celCore) celCore.innerHTML = getCelestialSvg(w.id);

  const chipLbl = document.getElementById('wxChipLabel');
  if (chipLbl) {
    chipLbl.textContent = w.name + ' ' + w.luckBonus + '×';
    chipLbl.style.color = w.color;
  }
  const chipBtn = document.getElementById('l12Wx') || document.getElementById('wxChipBtn');
  if (chipBtn) chipBtn.style.borderColor = w.color;

  const activeName = document.getElementById('wxpActiveName');
  if (activeName) activeName.textContent = w.name + ' (' + w.rar + ' · ' + w.luckBonus + '× LUCK · ' + w.speedBonus + '× SPEED)';

  document.querySelectorAll('.wxp-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.wx === w.id);
  });

  initWxParticles();
  if (!silent && window.hzNotify) {
    window.hzNotify('🌩️ WEATHER SKYBOX: ' + w.name + ' (' + w.luckBonus + '× LUCK · ' + w.speedBonus + '× SPEED)');
  }
}
window.setVillageWeather = setVillageWeather;

function toggleWxPicker() {
  const p = document.getElementById('wxPickerBar');
  if (p) p.classList.toggle('open');
}
window.toggleWxPicker = toggleWxPicker;

function initWxParticles() {
  const cv = document.getElementById('weatherSkyCanvas');
  if (!cv) return;
  cv.width = 1440;
  cv.height = 760;
  _wxParts = [];
  _wxSplashes = [];
  _shootingStars = [];
  _lightningFlash = 0;
  _lightningBolt = null;

  const fx = currentVillageWx.fx;
  let count = 45;
  if (fx === 'monsoon' || fx === 'sandstorm' || fx === 'iceage') count = 90;
  else if (fx === 'thunderstorm' || fx === 'galactic' || fx === 'snowfall') count = 65;
  else if (fx === 'lightrain' || fx === 'rain' || fx === 'windy' || fx === 'glitch') count = 55;

  for (let i = 0; i < count; i++) {
    _wxParts.push({
      x: Math.random() * 1440,
      y: Math.random() * 760,
      s: 1.2 + Math.random() * 2.8,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.5 + Math.random() * 3.5,
      a: 0.3 + Math.random() * 0.65,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.08,
      flip: Math.random() * Math.PI,
      seed: Math.random() * 100,
      tag: i % 8
    });
  }
}

function spawnBranchingLightning() {
  const startX = 260 + Math.random() * 920;
  const segments = [];
  let curX = startX;
  let curY = 20;
  const steps = 18;
  const dy = (520 - 20) / steps;

  for (let i = 0; i < steps; i++) {
    const nextY = curY + dy;
    const nextX = curX + (Math.random() - 0.5) * 44;
    segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

    if (Math.random() < 0.28 && i > 3 && i < 15) {
      const branchSteps = 5 + Math.floor(Math.random() * 4);
      let bx = nextX;
      let by = nextY;
      const bDir = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 22);
      for (let b = 0; b < branchSteps; b++) {
        const bNextX = bx + bDir + (Math.random() - 0.5) * 15;
        const bNextY = by + dy * 0.75;
        segments.push({ x1: bx, y1: by, x2: bNextX, y2: bNextY, branch: true });
        bx = bNextX;
        by = bNextY;
      }
    }
    curX = nextX;
    curY = nextY;
  }
  _lightningBolt = { segments, life: 10 };
  _lightningFlash = 0.68;
}

function tickWxCanvas() {
  const cv = document.getElementById('weatherSkyCanvas');
  if (!cv) {
    _wxAnimRunning = false;
    return;
  }
  _wxAnimRunning = true;
  const wxCtx = cv.getContext('2d');
  _animTime++;
  wxCtx.clearRect(0, 0, cv.width, cv.height);
  const fx = currentVillageWx.fx;
  const col = currentVillageWx.color;
  const accent = currentVillageWx.accent || '#ffffff';

  if (fx === 'thunderstorm') {
    if (Math.random() < 0.016 && (!_lightningBolt || _lightningBolt.life <= 0)) {
      spawnBranchingLightning();
    }
    if (_lightningFlash > 0) {
      wxCtx.fillStyle = `rgba(250, 204, 21, ${Math.min(0.35, _lightningFlash * 0.4).toFixed(3)})`;
      wxCtx.fillRect(0, 0, cv.width, cv.height);
      _lightningFlash = Math.max(0, _lightningFlash - 0.045);
    }
    if (_lightningBolt && _lightningBolt.life > 0) {
      _lightningBolt.life--;
      wxCtx.save();
      wxCtx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      wxCtx.lineWidth = 4.5;
      wxCtx.beginPath();
      _lightningBolt.segments.forEach(s => {
        wxCtx.moveTo(s.x1, s.y1);
        wxCtx.lineTo(s.x2, s.y2);
      });
      wxCtx.stroke();
      wxCtx.strokeStyle = '#ffffff';
      wxCtx.lineWidth = 1.8;
      wxCtx.beginPath();
      _lightningBolt.segments.forEach(s => {
        wxCtx.moveTo(s.x1, s.y1);
        wxCtx.lineTo(s.x2, s.y2);
      });
      wxCtx.stroke();
      wxCtx.restore();
    }
  }

  if (fx === 'aurora') {
    wxCtx.save();
    for (let b = 0; b < 3; b++) {
      const baseY = 80 + b * 45;
      const grad = wxCtx.createLinearGradient(0, baseY - 60, 0, baseY + 90);
      grad.addColorStop(0, 'rgba(45, 212, 191, 0)');
      grad.addColorStop(0.4, b === 1 ? 'rgba(56, 189, 248, 0.32)' : 'rgba(45, 212, 191, 0.38)');
      grad.addColorStop(0.8, 'rgba(192, 132, 252, 0.22)');
      grad.addColorStop(1, 'rgba(45, 212, 191, 0)');

      wxCtx.fillStyle = grad;
      wxCtx.beginPath();
      wxCtx.moveTo(0, baseY - 40);
      for (let x = 0; x <= 1440; x += 32) {
        const wave1 = Math.sin((x * 0.004) + (_animTime * 0.015) + b) * 36;
        const wave2 = Math.cos((x * 0.008) - (_animTime * 0.02) + (b * 2)) * 18;
        wxCtx.lineTo(x, baseY + wave1 + wave2);
      }
      wxCtx.lineTo(1440, 0);
      wxCtx.lineTo(0, 0);
      wxCtx.closePath();
      wxCtx.fill();
    }
    wxCtx.restore();
  }

  if (fx === 'galactic') {
    if (_animTime - _lastMeteorTime > 110 && Math.random() < 0.04) {
      _lastMeteorTime = _animTime;
      _shootingStars.push({
        x: 200 + Math.random() * 1000,
        y: Math.random() * 220,
        vx: -(12 + Math.random() * 8),
        vy: 6 + Math.random() * 5,
        len: 120 + Math.random() * 70,
        life: 18, maxLife: 18
      });
    }
    for (let m = _shootingStars.length - 1; m >= 0; m--) {
      const st = _shootingStars[m];
      st.x += st.vx;
      st.y += st.vy;
      st.life--;
      const t = st.life / st.maxLife;
      const grad = wxCtx.createLinearGradient(st.x, st.y, st.x - st.vx * 7, st.y - st.vy * 7);
      grad.addColorStop(0, `rgba(255, 255, 255, ${t.toFixed(2)})`);
      grad.addColorStop(0.4, `rgba(251, 146, 60, ${(t * 0.8).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(192, 132, 252, 0)');
      wxCtx.strokeStyle = grad;
      wxCtx.lineWidth = 2.4;
      wxCtx.beginPath();
      wxCtx.moveTo(st.x, st.y);
      wxCtx.lineTo(st.x - st.vx * 7, st.y - st.vy * 7);
      wxCtx.stroke();
      if (st.life <= 0) _shootingStars.splice(m, 1);
    }
  }

  if (fx === 'awakened') {
    wxCtx.save();
    wxCtx.globalCompositeOperation = 'screen';
    for (let r = 0; r < 4; r++) {
      const rayAngle = (r - 1.5) * 0.22;
      const rayAlpha = (0.06 + Math.sin(_animTime * 0.02 + r) * 0.035).toFixed(3);
      const grad = wxCtx.createRadialGradient(720, 160, 40, 720 + Math.sin(rayAngle) * 500, 520, 280);
      grad.addColorStop(0, `rgba(250, 204, 21, ${rayAlpha})`);
      grad.addColorStop(0.6, `rgba(192, 132, 252, ${(rayAlpha * 0.7).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      wxCtx.fillStyle = grad;
      wxCtx.beginPath();
      wxCtx.moveTo(720, 160);
      wxCtx.lineTo(720 + (r - 1.5) * 360 - 140, 760);
      wxCtx.lineTo(720 + (r - 1.5) * 360 + 140, 760);
      wxCtx.closePath();
      wxCtx.fill();
    }
    wxCtx.restore();
  }

  if (fx === 'iceage') {
    wxCtx.save();
    const frost = wxCtx.createRadialGradient(720, 380, 480, 720, 380, 780);
    frost.addColorStop(0, 'rgba(56, 189, 248, 0)');
    frost.addColorStop(0.85, 'rgba(56, 189, 248, 0.12)');
    frost.addColorStop(1, 'rgba(255, 255, 255, 0.28)');
    wxCtx.fillStyle = frost;
    wxCtx.fillRect(0, 0, cv.width, cv.height);
    wxCtx.restore();
  }

  wxCtx.fillStyle = col;
  wxCtx.strokeStyle = col;

  for (let i = 0; i < _wxParts.length; i++) {
    const p = _wxParts[i];
    wxCtx.globalAlpha = p.a;

    if (fx === 'rain' || fx === 'lightrain' || fx === 'rain_heavy' || fx === 'monsoon' || fx === 'thunderstorm') {
      const isMonsoon = (fx === 'monsoon');
      const isLight = (fx === 'lightrain' || fx === 'rain');
      const speed = isMonsoon ? 14 : (isLight ? 7 : 11);
      const slant = isMonsoon ? -4.5 : -2.0;

      p.x += slant;
      p.y += speed;

      if (p.y >= 510) {
        if (Math.random() < (isMonsoon ? 0.35 : 0.18)) {
          _wxSplashes.push({
            x: p.x, y: 512 + Math.random() * 160,
            r: 2, maxR: isMonsoon ? 14 : 9, a: 0.75, col: col
          });
        }
        p.y = -10;
        p.x = Math.random() * 1440;
      }

      wxCtx.lineWidth = isMonsoon ? 1.8 : 1.3;
      wxCtx.strokeStyle = isMonsoon ? '#93c5fd' : (isLight ? '#bae6fd' : col);
      wxCtx.beginPath();
      wxCtx.moveTo(p.x, p.y);
      wxCtx.lineTo(p.x + slant * 2.2, p.y + (isMonsoon ? 22 : 14));
      wxCtx.stroke();

    } else if (fx === 'snowfall' || fx === 'snow') {
      p.y += (p.s * 0.75);
      p.x += Math.sin((p.y * 0.02) + p.seed) * 0.9;
      wxCtx.fillStyle = '#ffffff';
      wxCtx.beginPath();
      wxCtx.arc(p.x, p.y, p.s * 1.3, 0, Math.PI * 2);
      wxCtx.fill();

    } else if (fx === 'iceage' || fx === 'snow_heavy') {
      p.x -= (14 + p.s * 4);
      p.y += (1.2 + Math.sin(p.x * 0.02) * 1.5);
      wxCtx.lineWidth = 1.6;
      wxCtx.strokeStyle = '#ffffff';
      wxCtx.beginPath();
      wxCtx.moveTo(p.x, p.y);
      wxCtx.lineTo(p.x - (18 + p.s * 10), p.y - 1);
      wxCtx.stroke();

    } else if (fx === 'sandstorm' || fx === 'sand') {
      p.x += (12 + p.s * 5);
      p.y += Math.sin((p.x * 0.015) + p.seed) * 0.8;
      wxCtx.lineWidth = 1.8;
      wxCtx.strokeStyle = p.s > 2.5 ? '#f59e0b' : '#d97706';
      wxCtx.beginPath();
      wxCtx.moveTo(p.x, p.y);
      wxCtx.lineTo(p.x + (20 + p.s * 14), p.y);
      wxCtx.stroke();

    } else if (fx === 'windy' || fx === 'wind') {
      p.x += (4.5 + Math.sin(p.rot) * 2.2);
      p.y += (1.2 + Math.cos(p.rot) * 1.4);
      p.rot += p.vrot;
      p.flip += 0.06;

      wxCtx.save();
      wxCtx.translate(p.x, p.y);
      wxCtx.rotate(p.rot);
      wxCtx.scale(Math.cos(p.flip), 1);
      wxCtx.fillStyle = (i % 2 === 0) ? '#f472b6' : '#4ade80';
      wxCtx.beginPath();
      wxCtx.ellipse(0, 0, p.s * 3.2, p.s * 1.8, 0, 0, Math.PI * 2);
      wxCtx.fill();
      wxCtx.restore();

    } else if (fx === 'glitch') {
      if (Math.random() < 0.12) {
        p.x = Math.random() * 1440;
        p.y = Math.random() * 680;
      }
      if (i % 3 === 0) {
        wxCtx.font = 'bold 11px monospace';
        wxCtx.fillStyle = (i % 2 === 0) ? '#f43f5e' : '#22d3ee';
        wxCtx.fillText(GLITCH_SNIPPETS[p.tag % GLITCH_SNIPPETS.length], p.x, p.y);
      } else {
        wxCtx.fillStyle = (i % 2 === 0) ? '#f43f5e' : '#22d3ee';
        wxCtx.fillRect(p.x, p.y, p.s * 16, p.s * 2.8);
      }

    } else if (fx === 'doodle') {
      p.y -= 0.6;
      p.x += Math.sin(p.y * 0.02) * 0.5;
      wxCtx.font = '14px sans-serif';
      wxCtx.fillStyle = '#f1f5f9';
      wxCtx.fillText(DOODLE_MARKS[p.tag % DOODLE_MARKS.length], p.x, p.y);

    } else if (fx === 'goofy') {
      p.y -= 1.1;
      p.x += Math.sin(p.y * 0.03 + p.seed) * 1.2;
      wxCtx.save();
      wxCtx.translate(p.x, p.y);
      wxCtx.rotate(_animTime * 0.03 + p.seed);
      wxCtx.fillStyle = (i % 3 === 0) ? '#facc15' : (i % 3 === 1 ? '#f43f5e' : '#38bdf8');
      wxCtx.beginPath();
      for (let sp = 0; sp < 5; sp++) {
        const a1 = (sp * Math.PI * 2) / 5;
        const a2 = a1 + Math.PI / 5;
        const r1 = p.s * 3.2;
        const r2 = p.s * 1.4;
        if (sp === 0) wxCtx.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        else wxCtx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        wxCtx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
      }
      wxCtx.closePath();
      wxCtx.fill();
      wxCtx.restore();

    } else if (fx === 'awakened' || fx === 'arcane') {
      p.y -= (0.45 + p.s * 0.18);
      p.x += Math.sin(p.y * 0.02 + p.seed) * 0.6;
      wxCtx.font = `bold ${Math.round(10 + p.s * 3.5)}px sans-serif`;
      wxCtx.fillStyle = (i % 2 === 0) ? col : accent;
      wxCtx.fillText(OCCULT_RUNES[p.tag % OCCULT_RUNES.length], p.x, p.y);

    } else if (fx === 'eclipse') {
      p.y += (0.9 + p.s * 0.4);
      p.x += Math.sin(p.y * 0.025 + p.seed) * 1.1;
      wxCtx.fillStyle = (i % 3 === 0) ? '#facc15' : '#f43f5e';
      wxCtx.beginPath();
      wxCtx.arc(p.x, p.y, p.s * 1.4, 0, Math.PI * 2);
      wxCtx.fill();

    } else {
      p.a = 0.3 + Math.sin(_animTime * 0.05 + p.seed) * 0.4;
      wxCtx.fillStyle = (i % 3 === 0) ? '#fb923c' : (i % 3 === 1 ? '#c084fc' : '#ffffff');
      wxCtx.beginPath();
      wxCtx.arc(p.x, p.y, p.s * 1.2, 0, Math.PI * 2);
      wxCtx.fill();
    }

    if (p.y > 760) { p.y = -10; p.x = Math.random() * 1440; }
    if (p.y < -10) { p.y = 750; p.x = Math.random() * 1440; }
    if (p.x > 1450) p.x = -10;
    if (p.x < -10) p.x = 1440;
  }

  for (let s = _wxSplashes.length - 1; s >= 0; s--) {
    const sp = _wxSplashes[s];
    sp.r += 0.55;
    sp.a -= 0.038;
    wxCtx.save();
    wxCtx.strokeStyle = sp.col || col;
    wxCtx.globalAlpha = Math.max(0, sp.a);
    wxCtx.lineWidth = 1.2;
    wxCtx.beginPath();
    wxCtx.ellipse(sp.x, sp.y, sp.r * 1.9, sp.r * 0.65, 0, 0, Math.PI * 2);
    wxCtx.stroke();
    wxCtx.restore();
    if (sp.a <= 0 || sp.r >= sp.maxR) {
      _wxSplashes.splice(s, 1);
    }
  }

  wxCtx.globalAlpha = 1;
  requestAnimationFrame(tickWxCanvas);
}

function initVillageWalkers(party) {
  const layer = document.getElementById('walkersLayer');
  if (!layer) return;
  layer.innerHTML = '';
  _villageWalkers = [];

  const defaultChars = ['CH_SHADOW_KING', 'CH_SUN_GOD', 'CH_ETERNAL_DRAGON', 'CH_ABSOLUTE_ZERO'];
  const defaultQuotes = [
    ['"Arise... and patrol Sector 01!"', '"Tower Infinite energy feels unstable today."', '"Ready to strike the World Boss!"'],
    ['"SET YOUR HEART ABLAZE! 🔥"', '"Standing guard by the Rebirth Altar!"', '"UMAI! Great luck aura today!"'],
    ['"Swift as the wind."', '"Checking out the Trait & Weather potions~"', '"Let us rip through the Tower!"'],
    ['"Thunderclap and flash! ⚡"', '"World Boss barrier is holding."', '"Ready to roll!"']
  ];

  let draggingCard = null;
  let dragMoved = false;
  let dragStartX = 0, dragStartY = 0, cardStartX = 0, cardStartY = 0;

  for (let i = 0; i < 4; i++) {
    const s = party && party[i];
    const cId = (s && s.char && CARDS[s.char]) ? s.char : defaultChars[i];
    const cData = CARDS[cId] || CARDS['CH_SHADOW_KING'] || Object.values(CARDS)[0] || { name: 'Shadow King', tier: 'UR', base_hp: 1000, base_atk: 500, passive: { name: 'Signature Skill', desc: 'Deals devastating signature damage on strike.' } };
    const art = (typeof cardImg === 'function' && cardImg(cId)) ? cardImg(cId) : 'assets/cards/art/shadow-king.webp';
    const thumb = (typeof cardThumb === 'function' && cardThumb(cId)) ? cardThumb(cId) : art;
    const mut = (s && s.mut) || 'normal';
    const shiny = !!(s && s.shiny);
    const tr = (s && typeof stackTraitOf === 'function') ? stackTraitOf(s) : ((s && s.trait) || 'none');
    const col = (typeof MUT_COLOR !== 'undefined' && MUT_COLOR[mut]) ? MUT_COLOR[mut] : '#f3e600';
    const stats = (typeof cardStats === 'function' && s) ? cardStats(cId, mut, tr, shiny) : { hp: cData.base_hp || cData.hp || 1000, atk: cData.base_atk || cData.atk || 500 };
    const fmtS = (typeof fmtStat === 'function') ? fmtStat : (n => String(n));
    const skTxt = (typeof skillText === 'function' && skillText(cId)) ? skillText(cId) : ((cData.passive && cData.passive.desc) || 'Deals devastating signature damage on strike.');

    const wItem = {
      id: 'vw_' + i,
      slot: 'S' + (i + 1),
      char: cId,
      name: ((typeof cardName === 'function') ? cardName(cId) : (cData.name || 'Hunter')).toUpperCase(),
      tier: String(cData.tier || 'UR').toUpperCase(),
      pwr: fmtS((stats.hp || 0) + (stats.atk || 0)),
      hp: fmtS(stats.hp || 1000),
      atk: fmtS(stats.atk || 500),
      mut: mut,
      mutLabel: String(mut || 'NONE').toUpperCase(),
      mutColor: col,
      shiny: shiny,
      traitName: String(tr || 'NONE').toUpperCase(),
      traitColor: '#c084fc',
      skillName: String((cData.passive && cData.passive.name) || cData.skill || 'SIGNATURE SKILL').toUpperCase(),
      skillDesc: skTxt,
      art: art,
      thumb: thumb,
      color: col,
      x: 200 + i * 280,
      y: 12 + (i % 2) * 14,
      vx: (i % 2 === 0 ? 0.75 : -0.75),
      dir: (i % 2 === 0 ? 1 : -1),
      state: 'walk',
      timer: 140 + i * 35,
      clashCd: 0,
      quotes: defaultQuotes[i] || ['"Patrolling the hazard district."']
    };

    const el = document.createElement('div');
    el.className = 'card-walker state-walk ' + (wItem.dir > 0 ? 'dir-right' : 'dir-left');
    el.style.setProperty('--RC', wItem.color);
    el.style.zIndex = String(20 + Math.round(30 - wItem.y));

    const borderHtml = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
    const hzCls = 'hz-bdr bdr-bracket sh-orbital anim-on m-' + wItem.mut + (wItem.shiny ? ' is-shiny' : '');

    el.innerHTML = `
      <div class="cw-bubble" id="bub_${wItem.id}">${wItem.quotes[0]}</div>
      <div class="cw-shadow"></div>
      <div class="cw-tilt">
        <div class="cw-body ${hzCls}">
          ${borderHtml}
          <img class="cw-art" src="${wItem.art}" onerror="this.src='assets/cards/art/shadow-king.webp'" alt="">
        </div>
      </div>
    `;

    el.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      e.stopPropagation();
      draggingCard = wItem;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      cardStartX = wItem.x;
      cardStartY = wItem.y;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });

    el.addEventListener('pointermove', (e) => {
      if (draggingCard !== wItem) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 9 || Math.abs(dy) > 9) {
        if (!dragMoved) {
          dragMoved = true;
          wItem.state = 'drag';
          wItem.el.classList.remove('state-walk', 'state-idle', 'state-slam');
          wItem.el.classList.add('is-dragging');
          showVillageBubble(wItem, '⚡ REPOSITIONING...', 1500);
        }
        wItem.x = Math.max(70, Math.min(1290, cardStartX + dx));
        wItem.y = Math.max(2, Math.min(48, cardStartY - dy * 0.45));
        wItem.el.style.zIndex = String(20 + Math.round(50 - wItem.y));
      }
    });

    const finishPointer = (e) => {
      if (draggingCard !== wItem) return;
      draggingCard = null;
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      if (dragMoved) {
        wItem.el.classList.remove('is-dragging');
        wItem.state = 'idle';
        wItem.timer = 150;
        wItem.el.classList.add('state-slam');
        spawnVillageStepRipple(wItem.x + 60, wItem.y - 6, '#f3e600');
        showVillageBubble(wItem, '💥 LANDED ON SECTOR-01!', 2000);
        setTimeout(() => {
          if (wItem.el) {
            wItem.el.classList.remove('state-slam');
            wItem.el.classList.add('state-idle');
          }
        }, 400);
      } else {
        onSelectVillageCard(wItem);
      }
    };
    el.addEventListener('pointerup', finishPointer);
    el.addEventListener('pointercancel', finishPointer);

    layer.appendChild(el);
    wItem.el = el;
    wItem.bub = el.querySelector('.cw-bubble');
    _villageWalkers.push(wItem);
  }
}

let _selectedVillageCard = null;

function turnVillageCardDir(c, newDir) {
  if (c.dir === newDir || !c.el) return;
  c.dir = newDir;
  c.el.classList.remove('dir-left', 'dir-right', 'turning');
  void c.el.offsetWidth;
  c.el.classList.add('turning', newDir > 0 ? 'dir-right' : 'dir-left');
  setTimeout(() => { if (c.el) c.el.classList.remove('turning'); }, 320);
}

function showVillageBubble(c, text, ms = 2600) {
  if (!c || !c.bub) return;
  c.bub.textContent = text || c.quotes[Math.floor(Math.random() * c.quotes.length)];
  c.bub.classList.add('show');
  clearTimeout(c._bubTm);
  c._bubTm = setTimeout(() => { if (c.bub) c.bub.classList.remove('show'); }, ms);
}

function spawnVillageStepRipple(x, yBottom, color) {
  const layer = document.getElementById('walkersLayer');
  if (!layer) return;
  const r = document.createElement('div');
  r.className = 'step-ripple';
  r.style.setProperty('--RC', color);
  r.style.left = x + 'px';
  r.style.bottom = yBottom + 'px';
  layer.appendChild(r);
  setTimeout(() => r.remove(), 550);
}

function onSelectVillageCard(c) {
  _villageWalkers.forEach(item => { if (item.el) item.el.classList.remove('is-selected'); });
  _selectedVillageCard = c;
  c.state = 'idle';
  c.timer = 260;
  if (c.el) {
    c.el.classList.remove('state-walk');
    c.el.classList.add('state-idle', 'is-selected');
  }

  const quote = c.quotes[Math.floor(Math.random() * c.quotes.length)];
  showVillageBubble(c, quote, 3500);

  const lImg = document.getElementById('hudLeaderImg');
  if (lImg && c.thumb) lImg.src = c.thumb;
  const cThumb = document.getElementById('cipThumb');
  if (cThumb && c.thumb) cThumb.src = c.thumb;
  const cTier = document.getElementById('cipTier');
  if (cTier) cTier.textContent = c.tier + ' · ' + c.mutLabel + ' · PARTY ' + c.slot;
  const cName = document.getElementById('cipName');
  if (cName) cName.textContent = c.name;
  const cQuote = document.getElementById('cipQuote');
  if (cQuote) cQuote.textContent = quote;
  const pop = document.getElementById('cardPop');
  if (pop) pop.classList.add('open');
}

window.closeCardPop = function closeCardPop() {
  const pop = document.getElementById('cardPop');
  if (pop) pop.classList.remove('open');
  _villageWalkers.forEach(item => { if (item.el) item.el.classList.remove('is-selected'); });
  _selectedVillageCard = null;
};

window.openHoloInspector = function openHoloInspector() {
  const c = _selectedVillageCard || _villageWalkers[0];
  if (!c) return;
  const box = document.getElementById('holoCardBox');
  if (box) {
    const borderHtml = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
    box.className = 'holo-3d-card cw-body hz-bdr bdr-bracket sh-orbital anim-on m-' + c.mut + (c.shiny ? ' is-shiny' : '');
    box.style.setProperty('--RC', c.color);
    box.innerHTML = borderHtml + '<img class="cw-art" src="' + c.art + '" onerror="this.src=\'assets/cards/art/shadow-king.webp\'" alt="">';
  }
  const setTxt = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  setTxt('hiKicker', c.tier + ' // ' + c.slot + ' PARTY UNIT');
  setTxt('hiTitle', c.name);
  setTxt('hiPwr', '⚡ ' + c.pwr + ' PWR');
  setTxt('hiHp', c.hp);
  setTxt('hiAtk', c.atk);
  setTxt('hiMut', c.mutLabel);
  const mEl = document.getElementById('hiMut');
  if (mEl) mEl.style.color = c.mutColor;
  setTxt('hiTrait', c.traitName);
  setTxt('hiSkillName', 'SIGNATURE PASSIVE // ' + c.skillName);
  setTxt('hiSkillDesc', c.skillDesc);
  const modal = document.getElementById('holoModal');
  if (modal) modal.classList.add('open');
};

window.closeHoloInspector = function closeHoloInspector() {
  const modal = document.getElementById('holoModal');
  if (modal) modal.classList.remove('open');
};

window.claimStreetCrate = function claimStreetCrate(el) {
  if (window.hzNotify) window.hzNotify('🎁 STREET SUPPLY CLAIMED: +1,250 COINS & +50 XP!');
  if (typeof coinGain === 'function') coinGain(1250);
  if (typeof xpGain === 'function') xpGain(50);
  if (!el) return;
  el.style.transform = 'scale(0.2)';
  el.style.opacity = '0';
  setTimeout(() => {
    const spots = ['26%', '41%', '58%', '73%'];
    el.style.left = spots[Math.floor(Math.random() * spots.length)];
    el.style.transform = '';
    el.style.opacity = '1';
  }, 4500);
};

function tickVillageWalkers() {
  const layer = document.getElementById('walkersLayer');
  if (!layer) {
    _walkerAnimRunning = false;
    return;
  }
  _walkerAnimRunning = true;
  const minX = 90;
  const maxX = 1260;

  for (let i = 0; i < _villageWalkers.length; i++) {
    const c = _villageWalkers[i];
    if (c.clashCd > 0) c.clashCd--;
    if (c.state === 'drag') {
      c.el.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px, ' + (-c.y - 26).toFixed(1) + 'px, 0) scale(1.08)';
      continue;
    }
    c.timer--;
    if (c.timer <= 0) {
      if (c.state === 'walk' || c.state === 'clash') {
        c.state = 'idle';
        c.timer = 75 + Math.floor(Math.random() * 90);
        c.el.classList.remove('state-walk', 'state-clash');
        c.el.classList.add('state-idle');
        if (Math.random() < 0.45) showVillageBubble(c);
      } else {
        c.state = 'walk';
        c.timer = 140 + Math.floor(Math.random() * 180);
        const nextDir = Math.random() < 0.5 ? -1 : 1;
        turnVillageCardDir(c, nextDir);
        c.vx = (0.58 + Math.random() * 0.42) * c.dir;
        c.el.classList.remove('state-idle', 'state-clash');
        c.el.classList.add('state-walk');
      }
    }

    if (c.state === 'walk') {
      c.x += c.vx;
      if (c.x < minX) { c.x = minX; turnVillageCardDir(c, 1); c.vx = Math.abs(c.vx); }
      if (c.x > maxX) { c.x = maxX; turnVillageCardDir(c, -1); c.vx = -Math.abs(c.vx); }

      c._stepTick = (c._stepTick || 0) + 1;
      if (c._stepTick % 28 === 0) {
        spawnVillageStepRipple(c.x + 60, c.y - 6, c.color);
      }

      for (let j = i + 1; j < _villageWalkers.length; j++) {
        const o = _villageWalkers[j];
        if (o.state === 'walk' && c.clashCd === 0 && o.clashCd === 0 && Math.abs(c.x - o.x) < 95) {
          c.state = o.state = 'clash';
          c.timer = o.timer = 65;
          c.clashCd = o.clashCd = 380;
          turnVillageCardDir(c, c.x < o.x ? 1 : -1);
          turnVillageCardDir(o, o.x < c.x ? 1 : -1);
          c.el.classList.remove('state-walk'); o.el.classList.remove('state-walk');
          c.el.classList.add('state-clash'); o.el.classList.add('state-clash');
          showVillageBubble(c, '⚡ AURA SYNC!', 1600);
          showVillageBubble(o, '🔥 READY FOR BATTLE!', 1600);
          break;
        }
      }
    }
    c.el.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px, ' + (-c.y).toFixed(1) + 'px, 0)';
  }
  requestAnimationFrame(tickVillageWalkers);
}

function setupVillageViewportDrag() {
  const vp = document.getElementById('villageViewport');
  if (!vp) return;
  let isDown = false, startX = 0, scrollL = 0;
  vp.addEventListener('pointerdown', (e) => {
    isDown = true; startX = e.clientX; scrollL = vp.scrollLeft;
  });
  window.addEventListener('pointerup', () => { isDown = false; });
  window.addEventListener('pointercancel', () => { isDown = false; });
  vp.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    vp.scrollLeft = scrollL - dx * 1.2;
  });
}

function renderLobby() {
  if (state.battle) {
    if (typeof cleanupCommandDrawer === 'function') cleanupCommandDrawer();
    return renderBattle();
  }
  _l12DockPanel = null;
  _l12PopKey = "";
  _l12PotTrayClass(false);
  const _oldDrw = document.getElementById('commandDrawer');
  if (_oldDrw && _oldDrw.parentElement === document.body) _oldDrw.remove();
  const _oldBd = document.getElementById('drawerBackdrop');
  if (_oldBd && _oldBd.parentElement === document.body) _oldBd.remove();
  document.body.classList.remove('drawer-open');
  document.body.classList.add('on-lobby');

  let _l12Park = document.getElementById("l12Park");
  if (!_l12Park) {
    _l12Park = document.createElement("div");
    _l12Park.id = "l12Park";
    _l12Park.style.cssText = "display:none!important";
    document.body.appendChild(_l12Park);
  }
  ["rollBtn", "rollAutoBtn", "footAv"].forEach(function (id) {
    let n = document.getElementById(id);
    if (!n && _l12Live[id]) n = _l12Live[id];
    if (n) _l12Live[id] = n;
    if (n && n.parentElement !== _l12Park) _l12Park.appendChild(n);
  });

  const _fmt = (typeof fmt === "function") ? fmt : (n => String(n));
  const _lv = state.playerLv || 1;
  const _xpNeed = Math.max(1, _lv * 1000);
  const _xpPct = Math.max(0, Math.min(100, Math.round((state.xp || 0) / _xpNeed * 100)));
  const _coins = _fmt(state.coins || 0);
  const _gems = _fmt(state.premiumGems || 0);
  const _title = String(state.playerTitle || "ROOKIE").toUpperCase();
  const _heroPower = (typeof totalPower === "function") ? _fmt(totalPower()) : "0";
  const _cLuck = (typeof fmtLobbyLuck === "function") ? fmtLobbyLuck() : ("×" + ((typeof totalLuck === "function" ? totalLuck() : 1).toFixed(1)));

  const _deck = Array.isArray(state.deck) ? state.deck : [null, null, null, null];
  const _byId = {};
  (state.stacks || []).forEach(s => { if (s && s.id) _byId[s.id] = s; });
  const _party = _deck.slice(0, 4).map(id => (id && _byId[id]) ? _byId[id] : null);

  const _leadStack = _party[0] || (state.stacks && state.stacks[0]) || null;
  const _leadChar = (_leadStack && _leadStack.char) || "shadow-king";
  const _leadThumb = (typeof cardImg === "function") ? cardImg(_leadChar, "thumb") : ("assets/cards/thumb/" + _leadChar + ".webp");

  const _now = Date.now();
  const _cd = (typeof fmtCountdown === "function") ? fmtCountdown : (ms => Math.ceil(ms / 1000) + "s");
  const _luckBuffs = (typeof luckBuffs === "function") ? luckBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const _speedBuffs = (typeof speedBuffs === "function") ? speedBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const _potLuck = _luckBuffs[_luckBuffs.length - 1] || null;
  const _potSpeed = _speedBuffs[_speedBuffs.length - 1] || null;
  const _adLuckMs = (typeof adLuckLeftMs === "function") ? adLuckLeftMs() : 0;
  const _gl = (typeof _globalLuckCache !== "undefined") ? _globalLuckCache : null;
  const _glActive = !!(_gl && _now < new Date(_gl.ends_at).getTime());
  const _glMult = _glActive ? (_gl.multiplier || 0) : 0;
  const _wId = (typeof activeWeatherId === "function") ? activeWeatherId() : "awakened";
  const _w = (_wId && typeof WEATHER !== "undefined" && WEATHER[_wId]) ? WEATHER[_wId] : null;

  const _drwGrp = function (icon, label, count, statId, tiles) {
    const rows = tiles.map(function (t, i) {
      const badge = t.badge ? '<span class="hx-b"' + (t.badgeId ? ' id="' + t.badgeId + '"' : "") + ">" + t.badge + "</span>" : "";
      const s2 = t.s2 ? '<span class="hx-s2"' + (t.s2Id ? ' id="' + t.s2Id + '"' : "") + ">" + t.s2 + "</span>" : "";
      const pb = t.pbId ? '<span class="hx-pb" aria-hidden="true"><span id="' + t.pbId + '" style="width:' + (t.pbW || 0) + '%"></span></span>' : "";
      const icon2 = t.img
        ? '<img class="hx-webp" src="assets/icons/drawer/' + t.img + '.webp?v=1" alt="" aria-hidden="true" decoding="async" draggable="false">'
        : ((typeof cyberIcon === "function") ? cyberIcon(t.ic, "hx-svg") : "");
      return '<button class="hx" type="button" id="' + t.id + '" style="--i:' + i + ";--hc:" + t.hc + '" role="button" tabindex="0">'
        + '<span class="hx-f"><i class="hx-corner tl" aria-hidden="true"></i><i class="hx-corner br" aria-hidden="true"></i>'
        + icon2 + "</span>"
        + '<span class="hx-nm">' + t.nm + "</span>"
        + '<span class="hx-s"' + (t.sId ? ' id="' + t.sId + '"' : "") + ">" + (t.s || "") + "</span>"
        + s2 + badge + pb + "</button>";
    }).join("");
    const gIcon = (typeof cyberIcon === "function") ? cyberIcon(icon, "ic-svg") : "";
    return '<section class="grp"><div class="grp-h"><span class="gh-i">' + gIcon
      + '</span><span class="gh-t">' + label + '</span><span class="gh-l" aria-hidden="true"></span>'
      + '<span class="gh-n"' + (statId ? ' id="' + statId + '"' : "") + ">" + count + '</span>'
      + '</div><div class="hex-grid">' + rows + "</div></section>";
  };

  app.innerHTML = `
  <div class="nh-shell" id="nhLobbyShell">
    <!-- TOP HUD -->
    <header class="nh-top-hud">
      <div class="op-pill" onclick="if(typeof openProfileModal==='function')openProfileModal();" title="Profile">
        <div class="op-ava">
          <img id="hudLeaderImg" src="${_leadThumb}" alt="">
          <span class="op-lv"><b id="l12TopLv">${_lv}</b></span>
        </div>
        <div class="op-info">
          <span class="op-name">${(currentUser || "OPERATOR").toUpperCase()}</span>
          <div class="op-pwr"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg><b class="op-pwr-val" id="l12TopPwr">${_heroPower}</b></div>
          <div class="op-xpbar"><i id="l12TopXpBar" style="width: ${_xpPct}%;"></i></div>
        </div>
      </div>

      <!-- Center unobstructed skybox -->

      <div class="res-cluster">
        <div class="res-pill luck" onclick="if(window.hzNotify)hzNotify('TOTAL LUCK: ' + '${_cLuck}');" title="Total Luck">
          <svg class="res-ico" width="18" height="18" viewBox="0 0 32 32" aria-hidden="true"><use href="#luckSvgSymbol"/></svg>
          <b class="res-num" id="l12TopLuck">${_cLuck}</b>
        </div>
        <div class="res-pill coin" onclick="if(typeof openPremiumShop==='function')openPremiumShop();" title="Coins">
          <svg class="res-ico" width="18" height="18" viewBox="0 0 32 32" aria-hidden="true"><use href="#coinSvgSymbol"/></svg>
          <b class="res-num" id="l12TopCoins">${_coins}</b>
        </div>
        <div class="res-pill gem" onclick="if(typeof openTopup==='function')openTopup();else if(typeof openPremiumShop==='function')openPremiumShop();" title="Gems">
          <img class="res-ico" src="assets/images/premium-currency.webp" alt="" width="18" height="18">
          <b class="res-num" id="l12TopGems">${_gems}</b>
          <button class="res-plus-btn" type="button" title="Top-Up Gems" onclick="event.stopPropagation();if(typeof openTopup==='function')openTopup();else if(typeof openPremiumShop==='function')openPremiumShop();">+</button>
        </div>
        <button class="hud-quick-btn daily" type="button" onclick="if(typeof openDaily==='function')openDaily();" title="Daily Rewards" aria-label="Daily Rewards">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8c-2.5 0-4-1-4-2.4S9.4 3 12 8c2.6-5 4-3.8 4-2.4S14.500 8 12 8z"/></svg>
          <span class="hq-dot"></span>
        </button>
        <button class="hud-quick-btn" type="button" onclick="if(location.hash==='#/settings')render();else location.hash='#/settings';" title="Settings" aria-label="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.100a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.100a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.100a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/></svg>
        </button>
      </div>
    </header>

    <!-- PANORAMIC CHIBI VILLAGE STREET -->
    <section class="village-viewport" id="villageViewport">
      <div class="village-world" id="villageWorld">
        <div class="sky-grid"></div>
        <div class="sky-aurora-veil" id="skyAuroraVeil"></div>

        <div class="sky-celestial" id="skyCelestial">
          <div class="cel-ring-outer"></div>
          <div class="cel-ring-inner"></div>
          <div class="cel-core" id="celCoreSvg"></div>
        </div>

        <div class="sky-searchlight b1"></div>
        <div class="sky-searchlight b2"></div>

        <div class="monorail-bridge">
          <div class="monorail-train"></div>
        </div>

        <div class="city-skyline-far">
          <svg viewBox="0 0 1440 230" preserveAspectRatio="none" aria-hidden="true">
            <path fill="#090c14" d="M0,230 L0,120 L55,120 L55,75 L110,75 L110,135 L165,135 L165,50 L230,50 L230,115 L310,115 L310,65 L390,65 L390,130 L470,130 L470,40 L550,40 L550,110 L650,110 L650,25 L770,25 L770,105 L860,105 L860,55 L940,55 L940,125 L1030,125 L1030,45 L1120,45 L1120,115 L1210,115 L1210,70 L1300,70 L1300,120 L1380,120 L1380,85 L1440,85 L1440,230 Z"/>
            <path fill="#0d111c" d="M0,230 L0,150 L85,150 L85,95 L155,95 L155,160 L250,160 L250,85 L340,85 L340,145 L430,145 L430,90 L520,90 L520,155 L610,155 L610,70 L810,70 L810,150 L910,150 L910,88 L1000,88 L1000,155 L1090,155 L1090,92 L1185,92 L1185,148 L1280,148 L1280,102 L1365,102 L1365,152 L1440,152 L1440,230 Z"/>
            <g fill="#f3e600" opacity="0.45">
              <rect x="98" y="108" width="6" height="42"/><rect x="112" y="108" width="6" height="42"/>
              <rect x="270" y="100" width="48" height="3"/><rect x="270" y="112" width="48" height="3"/><rect x="270" y="124" width="48" height="3"/>
              <rect x="450" y="105" width="8" height="36"/><rect x="468" y="105" width="8" height="36"/><rect x="486" y="105" width="8" height="36"/>
              <rect x="930" y="102" width="50" height="4"/><rect x="930" y="116" width="50" height="4"/>
              <rect x="1115" y="106" width="8" height="40"/><rect x="1135" y="106" width="8" height="40"/>
              <rect x="1300" y="116" width="44" height="3"/><rect x="1300" y="128" width="44" height="3"/>
            </g>
            <g fill="#22d3ee" opacity="0.4">
              <rect x="180" y="68" width="34" height="3"/><rect x="180" y="80" width="34" height="3"/>
              <rect x="490" y="56" width="42" height="3"/><rect x="490" y="68" width="42" height="3"/>
              <rect x="1050" y="62" width="52" height="3"/><rect x="1050" y="74" width="52" height="3"/>
            </g>
          </svg>
        </div>

        <canvas class="weather-sky-canvas" id="weatherSkyCanvas"></canvas>

        <div class="village-street">
          <div class="street-curb"></div>
          <div class="street-lanes"></div>
          <div class="street-reflections">
            <div class="wet-refl" style="--RC:#22d3ee"></div>
            <div class="wet-refl" style="--RC:#22d3ee"></div>
            <div class="wet-refl center" style="--RC:#f3e600"></div>
            <div class="wet-refl" style="--RC:#f43f5e"></div>
            <div class="wet-refl" style="--RC:#fbbf24"></div>
          </div>
          <div class="street-markings">
            <div class="spire-crosswalk"></div>
            <div class="road-center-line"></div>
            <div class="road-sub-line"></div>
          </div>
        </div>

        <div class="street-props-layer">
          <div class="street-pylon" style="left: 22%;"><div class="pylon-head"></div><div class="pylon-pole"></div><div class="pylon-base"></div><div class="pylon-cone"></div></div>
          <div class="street-pylon" style="left: 39%;"><div class="pylon-head"></div><div class="pylon-pole"></div><div class="pylon-base"></div><div class="pylon-cone"></div></div>
          <div class="street-pylon" style="left: 61%;"><div class="pylon-head"></div><div class="pylon-pole"></div><div class="pylon-base"></div><div class="pylon-cone"></div></div>
          <div class="street-pylon" style="left: 78%;"><div class="pylon-head"></div><div class="pylon-pole"></div><div class="pylon-base"></div><div class="pylon-cone"></div></div>

          <div class="street-crate" id="streetCrate" onclick="claimStreetCrate(this)" title="Click to claim Street Supply Drop">
            <span class="crate-tag">[!] SUPPLY</span>
            <div class="crate-box"></div>
          </div>
        </div>

        <!-- 5 TRANSPARENT CUTOUT CHIBI BUILDINGS PLANTED ON THE PAVEMENT -->
        <section class="buildings-row">
          <div class="chibi-bldg" style="--BC:#22d3ee" onclick="if(typeof openTrait==='function')openTrait();" title="Enter Trait &amp; Weather Lab">
            <div class="bldg-sign">
              <span class="bldg-title">TRAIT &amp; WEATHER</span>
            </div>
            <img class="bldg-sprite" src="assets/images/buildings/front_b4_trait.png?v=7" alt="Trait &amp; Weather">
            <div class="bldg-landing-pad"></div>
            <div class="bldg-ground-shadow"></div>
            <div class="bldg-ground-glow"></div>
          </div>

          <div class="chibi-bldg" style="--BC:#22d3ee" onclick="if(typeof openStory==='function')openStory();" title="Enter Story Gate">
            <div class="bldg-sign">
              <span class="bldg-title">STORY GATE</span>
            </div>
            <img class="bldg-sprite" src="assets/images/buildings/front_b1_story.png?v=7" alt="Story Gate">
            <div class="bldg-landing-pad"></div>
            <div class="bldg-ground-shadow"></div>
            <div class="bldg-ground-glow"></div>
          </div>

          <div class="chibi-bldg featured" style="--BC:#f3e600" onclick="if(typeof stopTower==='function')stopTower();if(location.hash==='#/tower')render();else location.hash='#/tower';" title="Enter Tower Infinite">
            <div class="bldg-sign">
              <span class="bldg-title">TOWER INFINITE</span>
            </div>
            <img class="bldg-sprite" src="assets/images/buildings/front_b2_tower.png?v=7" alt="Tower Infinite">
            <div class="bldg-landing-pad"></div>
            <div class="bldg-ground-shadow"></div>
            <div class="bldg-ground-glow"></div>
          </div>

          <div class="chibi-bldg" style="--BC:#f43f5e" onclick="window.raidView='hub';if(location.hash==='#/raid')render();else location.hash='#/raid';" title="Enter World Boss Raid">
            <div class="bldg-sign">
              <span class="bldg-title">WORLD BOSS</span>
            </div>
            <img class="bldg-sprite" src="assets/images/buildings/front_b3_raid.png?v=7" alt="World Boss">
            <div class="bldg-landing-pad"></div>
            <div class="bldg-ground-shadow"></div>
            <div class="bldg-ground-glow"></div>
          </div>

          <div class="chibi-bldg" style="--BC:#fbbf24" onclick="if(typeof openRebirthModal==='function')openRebirthModal();" title="Enter Rebirth Altar">
            <div class="bldg-sign">
              <span class="bldg-title">REBIRTH ALTAR</span>
            </div>
            <img class="bldg-sprite" src="assets/images/buildings/front_b5_rebirth.png?v=7" alt="Rebirth Altar">
            <div class="bldg-landing-pad"></div>
            <div class="bldg-ground-shadow"></div>
            <div class="bldg-ground-glow"></div>
          </div>
        </section>

        <!-- WALKING LIVING CARDS LAYER -->
        <div class="walkers-layer" id="walkersLayer"></div>
      </div>
    </section>

    <!-- CLEAN TACTICAL DIALOG BOX WHEN A WALKING CARD IS CLICKED -->
    <aside class="card-inspector-pop" id="cardPop">
      <div class="cip-head">
        <span id="cipTier">SECRET · ULTIMA · PARTY UNIT S1</span>
        <button class="cip-close" type="button" onclick="closeCardPop()" title="Close">×</button>
      </div>
      <div class="cip-body">
        <div class="cip-left">
          <div class="cip-thumb-wrap">
            <img class="cip-thumb" id="cipThumb" src="assets/cards/thumb/shadow-king.webp" alt="">
          </div>
          <div class="cip-meta">
            <div class="cip-nm-row">
              <span class="cip-nm" id="cipName">SHADOW KING</span>
            </div>
            <span class="cip-quote" id="cipQuote">"The shadows answer only to me."</span>
          </div>
        </div>
        <div class="cip-actions">
          <button class="cip-btn pri" type="button" onclick="openHoloInspector()">INSPECT 3D</button>
          <button class="cip-btn" type="button" onclick="closeCardPop();if(typeof openDeckModal==='function')openDeckModal();">SWAP</button>
        </div>
      </div>
    </aside>

    <!-- 3D HOLO CARD INSPECTOR MODAL -->
    <div class="holo-modal-backdrop" id="holoModal" onclick="if(event.target===this)closeHoloInspector()">
      <div class="holo-split-layout">
        <div class="holo-3d-stage" id="holoStage">
          <div class="holo-3d-card" id="holoCardBox"></div>
          <div class="holo-pedestal-ring" id="holoPedestal"></div>
          <span class="holo-drag-hint">↻ MOVE CURSOR OVER CARD FOR 3D TILT</span>
        </div>
        <div class="holo-info-panel">
          <div class="hip-topbar">
            <span class="hi-kicker" id="hiKicker">SECRET // S1 PARTY UNIT</span>
            <button class="cip-close" type="button" onclick="closeHoloInspector()" title="Close">×</button>
          </div>
          <div class="hip-body">
            <div class="hip-hero-head">
              <div class="hi-title" id="hiTitle">SHADOW KING</div>
              <span class="hi-pwr-pill" id="hiPwr">⚡ 540.2K PWR</span>
            </div>
            <div class="hi-stat-grid">
              <div class="hi-stat-box" style="--SC:#4ade80"><span>HP STAT</span><b id="hiHp" style="color:#4ade80">248.5K</b></div>
              <div class="hi-stat-box" style="--SC:#fb7185"><span>ATK STAT</span><b id="hiAtk" style="color:#fb7185">291.7K</b></div>
              <div class="hi-stat-box" style="--SC:#ff0055"><span>MUTATION</span><b id="hiMut" style="color:#ff0055">ULTIMA</b></div>
              <div class="hi-stat-box" style="--SC:#c084fc"><span>TRAIT</span><b id="hiTrait" style="color:#c084fc">MONARCH</b></div>
            </div>
            <div class="hi-skill-box">
              <b id="hiSkillName">SIGNATURE PASSIVE // DOMAIN OF THE MONARCH</b>
              <span id="hiSkillDesc">Summons shadow soldiers on strike, dealing 240% true slash damage and draining 18% foe ATK.</span>
            </div>
            <div class="hip-foot">
              <button class="cip-btn pri" type="button" onclick="closeHoloInspector();if(typeof openDeckModal==='function')openDeckModal();">SWAP PARTY SLOT</button>
              <button class="cip-btn" type="button" onclick="closeHoloInspector()">CLOSE</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- WEATHER SWITCHER DRAWER -->
    <aside class="wx-picker-bar" id="wxPickerBar">
      <div class="wxp-head">
        <span>🌩️ ACTIVE WEATHER: <b id="wxpActiveName">AWAKENED (15× LUCK · 8× SPD)</b></span>
        <button class="cip-close" style="height:26px;width:28px;font-size:13px;" onclick="toggleWxPicker()">×</button>
      </div>
      <div class="wxp-grid" id="wxpGrid"></div>
    </aside>

    <!-- BOTTOM BUFF STRIP + NAV DOCK -->
    <footer class="nh-bottom-hud">
      <section class="pot-tray hz-dock-pop" id="l12PotTray" style="display:none;" aria-live="polite"></section>

      <div class="buff-strip">
        <button class="b-chip${(_potLuck || _adLuckMs > 0) ? " is-on" : ""}" id="l12PotLuck" onclick="window.l12ToggleDockPanel('luck')" title="Luck Potions &amp; Buffs">
          <img id="l12PotLuckImg" src="assets/images/pot-luck-${_potLuck ? _potLuck.lv : 1}.webp" alt="">
          <b id="l12PotLuckVal">${_potLuck ? ("+" + (_potLuck.flat || 0) + " L" + _potLuck.lv) : (_adLuckMs > 0 ? "ADS 2×" : "OFF")}</b>
        </button>

        <button class="b-chip${_potSpeed ? " is-on" : ""}" id="l12PotSpeed" onclick="window.l12ToggleDockPanel('speed')" title="Speed Potions &amp; Buffs">
          <img id="l12PotSpeedImg" src="assets/images/pot-speed-${_potSpeed ? _potSpeed.lv : 1}.webp" alt="">
          <b id="l12PotSpeedVal">${_potSpeed ? ("+" + (_potSpeed.add || 0).toFixed(1) + "× L" + _potSpeed.lv) : "OFF"}</b>
        </button>

        <button class="b-chip${_glActive ? " is-on" : ""}" id="l12Glw" onclick="window.l12ToggleDockPanel('global')" title="Global Luck Shrine">
          <span class="b-ic"><svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true"><use href="#globalLuckSvgSymbol"/></svg></span>
          <b id="l12GlMult">${_glActive ? (_glMult + "× ACTIVE") : "OFFLINE"}</b>
        </button>

        <button class="b-chip${_w ? " is-on" : ""}" id="l12Wx" onclick="window.l12ToggleDockPanel('weather')" style="border-color: var(--wx-color, #c084fc);" title="Weather Dock &amp; Machine">
          <span class="b-ic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.6-7.9A6 6 0 0 1 18 11a3.500 3.500 0 0 1-.5 7H7z"/></svg></span>
          <b id="wxChipLabel" style="color: var(--wx-color, #c084fc);">${_w ? (String(_w.name || _wId).toUpperCase() + " " + _w.luckBonus + "×") : "CLEAR SKY"}</b>
        </button>
      </div>

      <nav class="nav-dock" aria-label="Main Navigation">
        <button class="dock-btn" type="button" onclick="if(typeof openCommandDrawer==='function')openCommandDrawer();" title="Command Menu">
          <span class="dock-ic-wrap">
            <img class="dock-ic" src="assets/icons/dock/home.webp" alt="" decoding="async">
          </span>
          <span class="dock-label">MENU</span>
        </button>

        <button class="dock-btn" type="button" onclick="if(typeof toggleBackpack==='function')toggleBackpack();" title="Backpack">
          <span class="dock-ic-wrap">
            <img class="dock-ic" src="assets/icons/dock/archive.webp" alt="" decoding="async">
          </span>
          <span class="dock-label">BACKPACK</span>
        </button>

        <button class="dock-btn mid-cta${(typeof rollState !== 'undefined' && rollState && rollState.active) ? ' is-rolling' : ''}" id="nhDockRollBtn" type="button" onclick="var b=document.getElementById('rollBtn');if(b)b.click();else if(typeof startRollAnimation==='function')startRollAnimation();" title="Summon / Single Roll">
          <div class="dock-hex-chassis">
            <div class="dock-hex-core">
              <img class="dock-ic hex-ic" src="assets/icons/dock/summon.webp" alt="" decoding="async">
            </div>
          </div>
          <span class="dock-label cta-label" id="nhDockRollLbl">${(typeof rollState !== 'undefined' && rollState && rollState.active) ? 'STOP' : 'ROLL'}</span>
        </button>

        <button class="dock-btn dock-auto-btn${(typeof rollState !== 'undefined' && rollState && rollState.active) ? ' is-on' : ''}" id="nhDockAutoBtn" type="button" onclick="var a=document.getElementById('rollAutoBtn');if(a)a.click();else if(typeof startRollAnimation==='function'){if(window.rollState&&rollState.active)stopRollAnimation();else startRollAnimation();}" title="Toggle Continuous Auto Roll">
          <span class="dock-ic-wrap auto-ic-wrap">
            <svg class="dock-auto-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4.2 12a7.8 7.8 0 0 1 13.3-5.5l2 2"/>
              <path d="M19.8 4.4v4.2h-4.2"/>
              <path d="M19.8 12a7.8 7.8 0 0 1-13.3 5.5l-2-2"/>
              <path d="M4.2 19.6v-4.2h4.2"/>
            </svg>
          </span>
          <span class="dock-label">AUTO ROLL</span>
        </button>

        <button class="dock-btn" type="button" onclick="if(typeof openDeckModal==='function')openDeckModal();" title="Deck Party">
          <span class="dock-ic-wrap">
            <img class="dock-ic" src="assets/icons/dock/deck.webp" alt="" decoding="async">
          </span>
          <span class="dock-label">DECK</span>
        </button>
      </nav>
    </footer>

    <!-- Hidden slots for live nodes -->
    <div style="display:none!important">
      <span id="slotRoll"></span>
      <span id="slotAuto"></span>
    </div>
  </div>

  <div id="drawerBackdrop" onclick="closeCommandDrawer()"></div>

  <aside id="commandDrawer" aria-label="Command drawer">
    <div class="drw-tape" aria-hidden="true"></div>
    <div class="drw-scan" aria-hidden="true"></div>

    <header class="drw-head">
      <div class="drw-head-l">
        <div class="drw-kick"><i aria-hidden="true"></i>TACTICAL HUD // ARCHON COMMAND ONLINE</div>
        <div class="drw-ttl">QUICK <em>ACTIONS</em></div>
      </div>
      <button class="drw-close-btn" id="drwCloseBtn" type="button" onclick="closeCommandDrawer()" title="Close (ESC / Swipe Right)" aria-label="Close command drawer">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </header>

    <div class="drw-body" id="drwBody">
      ${_drwGrp('deck', 'UNITS', '04', 'foldCombatStat', [
        { id: 'drwStoryBtn', img: 'story', ic: 'quests', nm: 'Story', hc: '#f3e600', s: 'CAMPAIGN PROGRESS', sId: 'missionSub', s2: '0% COMPLETE', s2Id: 'drwStoryPercent', pbId: 'missionFill', pbW: 0 },
        { id: 'drwRaidBtn', img: 'world_boss', ic: 'skills', nm: 'World Boss', hc: '#f87171', s: 'SHARED HP RAID' },
        { id: 'drwTowerBtn', img: 'tower', ic: 'home', nm: 'Tower', hc: '#b58cff', s: 'INFINITE SPIRE', sId: 'drwTowerSub' },
        { id: 'drwRankBtn', img: 'ranking', ic: 'luck', nm: 'Ranking', hc: '#ffd700', s: 'GLOBAL RANK', sId: 'drwRankSub' }
      ])}
      ${_drwGrp('daily', 'REWARDS', '04', '', [
        { id: 'drwDailyBtn', img: 'daily', ic: 'daily', nm: 'Daily', hc: '#4ade80', s: 'CLAIM DAILY REWARD', sId: 'drwDailySub' },
        { id: 'drwAdsBtn', img: 'free_luck', ic: 'ads', nm: 'Free Luck', hc: '#ffd700', s: 'WATCH ADS FOR BOOST', sId: 'drwAdsSub' },
        { id: 'drwGlBtn', img: 'global_luck', ic: 'luck', nm: 'Global Luck', hc: '#22d3ee', s: 'COMMUNITY MULTIPLIER', sId: 'drwGlSub' },
        { id: 'drwWeatherBtn', img: 'weather', ic: 'rebirth', nm: 'Weather', hc: '#b58cff', s: 'ATMOSPHERIC BUFF', sId: 'drwWeatherSub' }
      ])}
      ${_drwGrp('supply', 'SHOP', '02', '', [
        { id: 'drwPremiumBtn', img: 'supply_shop', ic: 'supply', nm: 'Supply Shop', hc: '#ffd700', s: 'INSTANT ROLL PACKS', sId: 'drwPremiumSub' },
        { id: 'drwRebirthBtn', img: 'rebirth', ic: 'rebirth', nm: 'Rebirth', hc: '#b58cff', s: 'ASCENSION PROTOCOL', sId: 'drwRebirthSub' }
      ])}
      ${_drwGrp('settings', 'SYSTEM', '05', '', [
        { id: 'drwTraitBtn', img: 'trait', ic: 'more', nm: 'Trait', hc: '#22d3ee', s: 'PASSIVE OPTIMIZER', sId: 'drwTraitSub' },
        { id: 'drwSkillBtn', img: 'skill_tree', ic: 'skills', nm: 'Skill Tree', hc: '#4ade80', s: 'SPEND SKILL POINTS', sId: 'drwSkillSub', badge: '0 SP', badgeId: 'drwSkillSp' },
        { id: 'drwIndexBtn', img: 'archive', ic: 'archive', nm: 'Archive', hc: '#22d3ee', s: 'CARD CATALOG', sId: 'drwIndexSub' },
        { id: 'drwSettingsBtn', img: 'settings', ic: 'settings', nm: 'Settings', hc: '#f5f5f5', s: 'AUDIO · COMBAT · LANGUAGE' },
        { id: 'drwChangelogBtn', img: 'changelog', ic: 'changelog', nm: 'Changelog', hc: '#f87171', s: 'RELEASE NOTES' }
      ])}
    </div>

    <footer class="drw-foot">
      <span class="drw-foot-k"><i class="live-dot" aria-hidden="true"></i>${(currentUser || 'OPERATOR').toUpperCase()} · LV <b>${_lv}</b></span>
      <span class="drw-tel" aria-hidden="true"><i class="tel-bar" style="--n:1"></i><i class="tel-bar" style="--n:2"></i><i class="tel-bar" style="--n:3"></i><i class="tel-bar" style="--n:4"></i><b>LINK</b>&nbsp;STABLE</span>
    </footer>
  </aside>`;

  // Populate weather grid buttons
  const wxGrid = document.getElementById('wxpGrid');
  if (wxGrid) {
    wxGrid.innerHTML = '';
    REAL_WEATHERS.forEach((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wxp-btn' + (w.id === currentVillageWx.id ? ' active' : '');
      b.style.setProperty('--WC', w.color);
      b.dataset.wx = w.id;
      b.innerHTML = '<span class="wxp-dot"></span><span>' + w.name + '</span><small style="opacity:0.7">' + w.luckBonus + '×</small>';
      b.onclick = () => setVillageWeather(w.id);
      wxGrid.appendChild(b);
    });
  }

  const _l12Place = (slotId, elId, cls) => {
    const slot = document.getElementById(slotId);
    const node = document.getElementById(elId);
    if (!slot || !node) return false;
    if (cls) node.classList.add(cls);
    slot.replaceWith(node);
    return true;
  };
  _l12Place("slotRoll", "rollBtn", "cta");
  _l12Place("slotAuto", "rollAutoBtn", "tgl");

  // Interactive 3D tilt inside Holo Inspector
  const holoStage = document.getElementById('holoStage');
  if (holoStage) {
    holoStage.addEventListener('mousemove', (e) => {
      const rect = holoStage.getBoundingClientRect();
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -24;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 24;
      const box = document.getElementById('holoCardBox');
      if (box) box.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    });
    holoStage.addEventListener('mouseleave', () => {
      const box = document.getElementById('holoCardBox');
      if (box) box.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  }

  initVillageWalkers(_party);
  setVillageWeather(_wId || 'awakened', true);
  setupVillageViewportDrag();

  if (!_wxAnimRunning) requestAnimationFrame(tickWxCanvas);
  if (!_walkerAnimRunning) requestAnimationFrame(tickVillageWalkers);

/* ---- LIVE WEATHER DOCK ENGINE (LOBBY V12) ----
   Menyinkronkan icon vektor SVG, warna, nama, rarity badge, dan weather dock
   secara instan setiap ada rotasi cuaca / weather potion tanpa menunggu tick. */
function l12UpdateWeatherDock(force){
  const wxEl = document.getElementById("l12Wx");
  if (!wxEl) return;
  const now = Date.now();
  const curWxId = (typeof activeWeatherId === "function") ? activeWeatherId() : null;
  const curWxBy = (state && state.weather && state.weather.activated_by) ? String(state.weather.activated_by) : "";
  const curWxKey = (curWxId || "") + "|" + curWxBy;
  const wLeft = (state && state.weather && state.weather.endsAt) ? Math.max(0, state.weather.endsAt - now) : 0;
  const tmEl = document.getElementById("l12WxTm");
  if (tmEl) tmEl.textContent = wLeft ? ((typeof fmtCountdown === "function") ? fmtCountdown(wLeft) : "") : "--:--";

  if (!force && curWxKey === _lastWxId) return;
  _lastWxId = curWxKey;

  const curW = (curWxId && typeof WEATHER !== "undefined" && WEATHER[curWxId]) ? WEATHER[curWxId] : null;
  const wColor = curW ? curW.color : "#9ca3af";
  const wName = curW ? String(curW.name || curWxId).toUpperCase() : "CLEAR SKY";
  const wRar = curW ? String(curW.rar || curW.rarity || "COMMON").toUpperCase() : "IDLE";

  wxEl.style.setProperty("--bc", wColor);
  wxEl.classList.toggle("is-on", !!curW);

  const nameEl = document.getElementById("l12WxName");
  if (nameEl) nameEl.textContent = wName;

  const rrEl = document.getElementById("l12WxRr");
  if (rrEl) rrEl.textContent = wRar;

  const lkSub = document.getElementById("l12WxLkSub");
  if (lkSub) lkSub.textContent = curW ? (curW.luckBonus + "× LK") : "IDLE";

  const wxImg = document.getElementById("l12WxImg");
  const wantWxSrc = (typeof weatherPotionSrc === "function")
    ? weatherPotionSrc(curWxId || "clear", true)
    : "assets/images/thumb/weather-clear.webp?v=1";
  if (wxImg) {
    if (wxImg.getAttribute("src") !== wantWxSrc) wxImg.setAttribute("src", wantWxSrc);
  } else {
    const iconEl = document.getElementById("l12WxIcon");
    if (iconEl) iconEl.innerHTML = '<img id="l12WxImg" src="' + wantWxSrc + '" alt="" decoding="async">';
  }

  if (typeof setVillageWeather === "function") {
    setVillageWeather(curWxId || "awakened", true);
  }

  if (_l12DockPanel === "weather" && typeof _l12RenderDockPanel === "function") {
    _l12RenderDockPanel();
  }
}
window.l12UpdateWeatherDock = l12UpdateWeatherDock;

  /* ---- TIMER HUD (potion / global luck / weather) ----
     Menyegar 4 chip & countdown di popover aktif dari sumber data produksi.
     Interval dibersihkan sendiri begitu lobby tidak ada (pola _telemetryTimer). */
  if (_l12HudTick) clearInterval(_l12HudTick);
  _l12HudTick = setInterval(() => {
    if (!document.querySelector(".lobby-hub.l12") && !document.querySelector(".nh-shell")) { clearInterval(_l12HudTick); _l12HudTick = null; return; }
    const now = Date.now();
    const put = (id, txt) => { const e = document.getElementById(id); if (e && e.textContent !== txt) e.textContent = txt; };
    const wid = (id, pct) => { const e = document.getElementById(id); if (e) e.style.width = pct + "%"; };

    if (typeof state !== "undefined" && state) {
      put("l12TopLv", String(state.playerLv || 1));
      const xpNeed = Math.max(1, (state.playerLv || 1) * 1000);
      const xpPct = Math.max(0, Math.min(100, Math.round((state.xp || 0) / xpNeed * 100)));
      put("l12TopXpPct", xpPct + "%");
      wid("l12TopXpBar", xpPct);
      put("l12TopCoins", (typeof fmt === "function") ? fmt(state.coins || 0) : String(state.coins || 0));
      put("l12TopGems", (typeof fmt === "function") ? fmt(state.premiumGems || 0) : String(state.premiumGems || 0));
      put("l12TopPwr", (typeof totalPower === "function") ? ((typeof fmt === "function") ? fmt(totalPower()) : String(totalPower())) : "0");
      put("l12RollTotal", "TOTAL ROLLS \u00b7 " + ((typeof fmt === "function") ? fmt(state.totalRolls || 0) : (state.totalRolls || 0)));
      if (typeof fmtLobbyLuck === "function") put("l12TopLuck", fmtLobbyLuck());
      const bpSub = document.getElementById("nhDockBpSub");
      if (bpSub) bpSub.textContent = ((typeof totalCardsCount === "function") ? totalCardsCount() : (state.collection ? Object.keys(state.collection).length : 0)) + " CARDS";
      if (typeof window.syncNhRollDock === "function") window.syncNhRollDock();
    }

    if (typeof _l12SyncBuffChips === "function") _l12SyncBuffChips(now);
    l12UpdateWeatherDock();
    if (typeof _l12TickDockPanel === "function") _l12TickDockPanel(now);
  }, 1000);

  /* ---- BINDING TOMBOL LOBBY (v12) ---- */
  /* .pslot SEKARANG clickable (user request 2026-10-31): inline onclick ke #/deck
     di template renderLobby(). Touch target 44px via ::before pseudo-element.
     Kartu hero juga clickable ke #/deck (handler JavaScript di bawah). */
  /* Kartu hero + slot party = kelola deck (user request 2026-10-31).
     Hero standee dan pslot sekarang <button> dengan inline onclick ke #/deck.
     Handler JavaScript ini memperkuat inline onclick + tambah sfx. */
  const _hero = document.getElementById("heroStandeeWrap");
  if (_hero) _hero.onclick = () => {
    if (typeof sfx !== "undefined" && sfx.hit) sfx.hit();
    /* Layar DECK sekarang modal full-screen sendiri (port 2026-11-07). */
    if (typeof openDeckModal === "function") openDeckModal();
    else location.hash = "#/deck";
  };
  /* +10x GLOBAL LUCK -> fungsi beli asli panels.js, bukan duplikat logika.
     Tombol SENGAJA tidak di-disable saat gems kurang: buyGlobalLuck() sudah
     memberi toast 'NOT ENOUGH GEMS · Butuh N Gems' (panels.js:3524). Kalau
     disabled, klik tidak sampai ke sana dan tombol cuma diam -> dikira rusak.
     Yang MAXED memang disabled (tidak ada yang bisa dibeli lagi).
     buyGlobalLuck() async: renderLobby() dipanggil SESUDAH janji selesai, tidak
     lagi sinkron seperti sebelumnya (waktu itu buff belum terpasang -> angka basi). */
  /* Global Luck buy button lives inside #l12PotTray Global Luck Shrine panel (l12BuyGlobalLuckFromDock). */
  /* MODE HUB: handler ASLI yang sama dengan command drawer (lihat bindClick
     'drwStoryBtn'/'drwTowerBtn'/'drwRaidBtn' di bawah). .onclick (bukan
     addEventListener) supaya idempoten lintas render — nol kebocoran listener. */
  document.querySelectorAll(".lobby-hub.l12 .hrow[data-hub]").forEach(el => {
    const hub = el.getAttribute("data-hub");
    el.onclick = () => {
      if (typeof sfx !== "undefined" && sfx.hit) sfx.hit();
      if (hub === "story") {
        if (typeof openMission === "function") openMission();
        else location.hash = "#/";
      } else if (hub === "tower") {
        if (typeof stopTower === "function") stopTower();
        location.hash = "#/tower";
      } else if (hub === "raid") {
        window.raidView = "hub";
        location.hash = "#/raid";
      }
    };
  });
  /* AUTO: indikator ON/OFF ikut state asli (#rollAutoBtn sudah punya handler
     milik js/boot.js:494 + js/panels.js). Node ini DIPINDAH, bukan dibuat ulang,
     jadi listener paint-nya harus dipasang SEKALI — kalau tidak, tiap renderLobby()
      nambah satu listener (bukti CDP: click 6 -> 9 sesudah 3 render). */
  const _auto = document.getElementById("rollAutoBtn");
  if (_auto) {
    /* Sumber kebenaran = rollState.active (dinyalakan/dimatikan js/panels.js).
       Sebelum ini cek hanya melihat aria-pressed/class "active"/state.autoRoll,
       yang TIDAK pernah diisi jalur roll — akibatnya paintAuto(0 ms) mencabut
       kelas "on" yang baru dipasang startRollAnimation → indikator tidak pernah
       berputar. rollState dicek lebih dulu supaya kelas .on bertahan. */
    const paintAuto = () => _auto.classList.toggle("on", !!(
      (typeof rollState !== "undefined" && rollState && rollState.active) ||
      _auto.getAttribute("aria-pressed") === "true" ||
      _auto.classList.contains("active") ||
      (typeof state !== "undefined" && state.autoRoll)
    ));
    paintAuto();
    if (!_auto.__l12Paint) {
      _auto.__l12Paint = true;
      _auto.addEventListener("click", () => setTimeout(paintAuto, 0));
    }
  }
  /* MODE HUB: hrow = <a href="#/..."> — navigasi hash asli, tanpa handler baru. */

  // Lift Command Drawer & Backdrop directly to document.body for root layering above topbar
  const _drw = document.getElementById('commandDrawer');
  const _bd = document.getElementById('drawerBackdrop');
  if (_drw && _drw.parentElement !== document.body) document.body.appendChild(_drw);
  if (_bd && _bd.parentElement !== document.body) document.body.appendChild(_bd);
  const _drwClose = document.getElementById('drwCloseBtn');
  if (_drwClose) {
    _drwClose.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeCommandDrawer();
    };
  }
  if (_bd) {
    _bd.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeCommandDrawer();
    };
  }

  // === Dynamic Metric Calculations & Event Bindings ===
  // 1. Mission / Story Progress
  try {
    const ms = document.getElementById('missionSub');
    const fill = document.getElementById('missionFill');
    const percentEl = document.getElementById('drwStoryPercent');
    if (typeof CHAPTERS !== 'undefined' && Array.isArray(CHAPTERS)) {
      const done = CHAPTERS.reduce((a, c) => a + (typeof chapProgMode === 'function' ? chapProgMode(c, state.diff) : 0), 0);
      const tot = CHAPTERS.reduce((a, c) => a + c.levels.length, 0);
      const ratio = tot ? Math.min(100, Math.round(done / tot * 100)) : 0;
      if (ms) ms.textContent = done + ' / ' + tot + ' STAGES';
      if (fill) fill.style.width = ratio + '%';
      if (percentEl) percentEl.textContent = ratio + '% COMPLETE';
    }
  } catch(e) {}

  // 2. 7-Day Login status
  try {
    const dailySub = document.getElementById('drwDailySub');
    if (dailySub) {
      const isReady = (typeof state !== 'undefined' && state && typeof todayStr === 'function') ? (state.lastClaim !== todayStr()) : false;
      dailySub.textContent = isReady ? 'READY TO CLAIM!' : 'ALREADY CLAIMED TODAY';
      dailySub.style.color = isReady ? '#34d399' : '#64748b';
    }
  } catch(e) {}

  // 3. Free Ads status
  try {
    const adsSub = document.getElementById('drwAdsSub');
    if (adsSub) {
      const luckMs = typeof adLuckLeftMs === 'function' ? adLuckLeftMs() : 0;
      if (luckMs > 0) {
        adsSub.textContent = '2x LUCK ACTIVE (' + Math.ceil(luckMs / 60000) + 'm)';
        adsSub.style.color = '#ffd700';
      } else {
        adsSub.textContent = 'WATCH ADS FOR 2x LUCK';
      }
    }
  } catch(e) {}

  // 4. Global Luck status
  try {
    const glSub = document.getElementById('drwGlSub');
    if (glSub) {
      const gl = typeof _globalLuckCache !== 'undefined' ? _globalLuckCache : null;
      const glActive = gl && Date.now() < new Date(gl.ends_at).getTime();
      if (glActive) {
        glSub.textContent = (gl.multiplier || 2) + 'x LUCK ACTIVE';
        glSub.style.color = '#22d3ee';
      } else {
        glSub.textContent = 'SERVER LUCK MULTIPLIER';
      }
    }
  } catch(e) {}

  // 5. Weather Synth status
  try {
    const wSub = document.getElementById('drwWeatherSub');
    if (wSub && typeof state !== 'undefined' && state && state.weather) {
      wSub.textContent = 'WEATHER: ' + (state.weather.name || state.weather.type || 'CLEAR').toUpperCase();
    }
  } catch(e) {}

  // 5b. Skill Tree status (SP tersisa + jumlah node terbuka)
  try {
    const skSub = document.getElementById('drwSkillSub');
    const skSp = document.getElementById('drwSkillSp');
    if (typeof state !== 'undefined' && state && state.player) {
      const sp = state.player.sp || 0;
      const tree = state.player.tree || {};
      const done = Object.keys(tree).filter(k => tree[k]).length;
      const total = (typeof TREE_NODES !== 'undefined' && TREE_NODES.length) ? TREE_NODES.length : 16;
      if (skSp) skSp.textContent = sp + ' SP';
      if (skSub) skSub.textContent = sp > 0
        ? 'SPEND ' + sp + ' SKILL POINT' + (sp === 1 ? '' : 'S') + ' · ' + done + '/' + total + ' LEARNED'
        : 'EARN SKILL POINTS BY LEVELING UP · ' + done + '/' + total + ' LEARNED';
    }
  } catch(e) {}

  // 6. Rebirth Protocol status
  try {
    const rbSub = document.getElementById('drwRebirthSub');
    if (rbSub && typeof state !== 'undefined' && state) {
      const rbCount = (typeof rebirthCount === 'function') ? rebirthCount() : 0;
      const rbMult = (typeof rebirthLuckMult === 'function') ? rebirthLuckMult(rbCount) : (rbCount <= 0 ? 1 : rbCount * 5);
      const rbReady = (typeof canRebirth === 'function') && canRebirth();
      rbSub.textContent = 'R' + rbCount + ' // LUCK ×' + rbMult + (rbReady ? ' · READY' : '');
    }
  } catch(e) {}

  // === Drawer Button Clicks ===
  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) {
      el.onclick = (e) => {
        e.stopPropagation();
        if (typeof playSound === 'function') playSound('click');
        else if (window.sfx && sfx.hit) sfx.hit();
        closeCommandDrawer();
        setTimeout(fn, 120);
      };
    }
  };

  bindClick('drwStoryBtn', () => { if (typeof openMission === 'function') openMission(); });
  bindClick('drwRaidBtn', () => { window.raidView = 'hub'; if (window.location.hash === '#/raid') render(); else window.location.hash = '#/raid'; });
  bindClick('drwTowerBtn', () => { if (typeof stopTower === 'function') stopTower(); if (window.location.hash === '#/tower') render(); else window.location.hash = '#/tower'; });
  bindClick('drwRankBtn', () => { if (typeof openRanking === 'function') openRanking(); });
  bindClick('drwDailyBtn', () => { if (typeof openDaily === 'function') openDaily(); });
  bindClick('drwAdsBtn', () => { if (typeof openWatchAdsModal === 'function') openWatchAdsModal(); });
  bindClick('drwGlBtn', () => { if (typeof buyGlobalLuck === 'function') buyGlobalLuck(); });
  bindClick('drwWeatherBtn', () => { if (typeof openWeatherMachine === 'function') openWeatherMachine(); });
  bindClick('drwTraitBtn', () => { if (typeof openTrait === 'function') openTrait(); });
  bindClick('drwSkillBtn', () => { if (typeof openSkillTree === 'function') openSkillTree(); });
  bindClick('drwIndexBtn', () => { if (typeof openIndex === 'function') openIndex(); });
  bindClick('drwPremiumBtn', () => { if (typeof openPremiumShop === 'function') openPremiumShop(); });
  bindClick('drwRebirthBtn', () => { if (typeof onRebirthClick === 'function') onRebirthClick(); });
  bindClick('drwSettingsBtn', () => { if (location.hash === '#/settings') render(); else location.hash = '#/settings'; });
  bindClick('drwChangelogBtn', () => { if (typeof openChangelogModal === 'function') openChangelogModal(); });

  /* Accordion v2 (.fh/.fold) DIHAPUS: drawer v5 adalah grid heksagon yang
     selalu terbuka, tidak ada header yang bisa dilipat. Handler lama akan
     query elemen yang tidak ada lagi, jadi bloknya dibuang bersama markupnya. */

  // Initialize interactive engines
  initAmbientCanvas();
  initKineticParallax();
  initTelemetryTicker();
  initCommandDrawerGestures();
  if (typeof initAAAInteractiveSuite === 'function') initAAAInteractiveSuite();

  // Render Weather Cards & Roll History
  _l12RenderWxCards(_wId);
  l12UpdateWeatherDock(true);
  l12PaintRollHist();
  _hookRollHistory();
}

/* ==========================================================================
   L12 HELPER ENGINES: WEATHER CARDS, POTION TRAY, AND ROLL HISTORY STRIP
   ========================================================================== */

/* ---- WEATHER CARDS ENGINE (legacy stub; Weather Dock renders exclusive cards) ---- */
function _l12RenderWxCards() {}

/* ---- UNIFIED LOBBY BUFF DOCK PANELS (POTION MATRIX · GLOBAL LUCK · WEATHER DOCK) ---- */
function _l12PotTrayClass(on) {
  try { document.body.classList.toggle("pot-tray-open", !!on); } catch (e) {}
}

function _l12SyncBuffChips(now) {
  now = now || Date.now();
  const put = (id, txt) => { const e = document.getElementById(id); if (e && e.textContent !== txt) e.textContent = txt; };
  const cd = (typeof fmtCountdown === "function") ? fmtCountdown : (ms => Math.max(0, Math.ceil(ms / 1000)) + "s");

  const lbList = (typeof luckBuffs === "function") ? luckBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const sbList = (typeof speedBuffs === "function") ? speedBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const lb = lbList[lbList.length - 1] || null;
  const sb = sbList[sbList.length - 1] || null;
  const adMs = (typeof adLuckLeftMs === "function") ? adLuckLeftMs() : 0;

  if (typeof state !== "undefined" && state) {
    const curLkP = Array.isArray(state.luckPots) ? state.luckPots : [0, 0, 0];
    const curSpP = Array.isArray(state.speedPots) ? state.speedPots : [0, 0, 0];
    put("l12PotLuckStock", "×" + ((curLkP[0] || 0) + (curLkP[1] || 0) + (curLkP[2] || 0)));
    put("l12PotSpeedStock", "×" + ((curSpP[0] || 0) + (curSpP[1] || 0) + (curSpP[2] || 0)));
  }

  const lkChip = document.getElementById("l12PotLuck");
  if (lkChip) {
    lkChip.classList.toggle("is-on", !!(lb || adMs > 0));
    lkChip.classList.toggle("open", _l12DockPanel === "luck");
  }
  const lkImg = document.getElementById("l12PotLuckImg");
  if (lkImg) {
    const want = "assets/images/pot-luck-" + (lb ? lb.lv : 1) + ".webp";
    if (lkImg.getAttribute("src") !== want) lkImg.setAttribute("src", want);
  }
  if (lb) {
    put("l12PotLuckVal", "+" + (lb.flat || 0) + " L" + lb.lv + (lbList.length > 1 ? " (+" + (lbList.length - 1) + ")" : ""));
    put("l12PotLuckTm", cd(lb.endsAt - now));
  } else {
    put("l12PotLuckVal", adMs > 0 ? "ADS 2×" : "OFF");
    put("l12PotLuckTm", adMs > 0 ? cd(adMs) : "--:--");
  }

  const spChip = document.getElementById("l12PotSpeed");
  if (spChip) {
    spChip.classList.toggle("is-on", !!sb);
    spChip.classList.toggle("open", _l12DockPanel === "speed");
  }
  const spImg = document.getElementById("l12PotSpeedImg");
  if (spImg) {
    const want = "assets/images/pot-speed-" + (sb ? sb.lv : 1) + ".webp";
    if (spImg.getAttribute("src") !== want) spImg.setAttribute("src", want);
  }
  if (sb) {
    put("l12PotSpeedVal", "+" + (sb.add || 0).toFixed(1) + "× L" + sb.lv + (sbList.length > 1 ? " (+" + (sbList.length - 1) + ")" : ""));
    put("l12PotSpeedTm", cd(sb.endsAt - now));
  } else {
    put("l12PotSpeedVal", "OFF");
    put("l12PotSpeedTm", "--:--");
  }

  const gl = (typeof _globalLuckCache !== "undefined") ? _globalLuckCache : null;
  const glOn = !!(gl && now < new Date(gl.ends_at).getTime());
  const glStacks = glOn ? Math.min(10, Math.max(1, Math.round((gl.multiplier || 0) / 10))) : 0;
  const glChip = document.getElementById("l12Glw");
  if (glChip) {
    glChip.classList.toggle("is-on", glOn);
    glChip.classList.toggle("open", _l12DockPanel === "global");
  }
  put("l12GlMult", glOn ? ((gl.multiplier || 0) + "× LUCK") : "OFFLINE");
  put("l12GlTm", glOn ? cd(new Date(gl.ends_at).getTime() - now) : "--:--");
  put("l12GlStack", glStacks + "/10");

  const wxChip = document.getElementById("l12Wx");
  if (wxChip) wxChip.classList.toggle("open", _l12DockPanel === "weather");
}

function _l12RenderPotionMatrix(type, now) {
  const isLuck = type === "luck";
  const pac = isLuck ? "#6be08a" : "#5ac8fa";
  const cd = (typeof fmtCountdown === "function") ? fmtCountdown : (ms => Math.max(0, Math.ceil(ms / 1000)) + "s");
  const lkArr = Array.isArray(state && state.luckPots) ? state.luckPots : [0, 0, 0];
  const spArr = Array.isArray(state && state.speedPots) ? state.speedPots : [0, 0, 0];
  const pots = isLuck ? lkArr : spArr;
  const lkTotal = (lkArr[0] || 0) + (lkArr[1] || 0) + (lkArr[2] || 0);
  const spTotal = (spArr[0] || 0) + (spArr[1] || 0) + (spArr[2] || 0);
  const totalStock = isLuck ? lkTotal : spTotal;

  const lbList = (typeof luckBuffs === "function") ? luckBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const sbList = (typeof speedBuffs === "function") ? speedBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const buffs = isLuck ? lbList : sbList;
  const adMs = (typeof adLuckLeftMs === "function") ? adLuckLeftMs() : 0;
  const lpDefs = (typeof LUCK_POTS !== "undefined") ? LUCK_POTS : [null, { flat: 3, pct: 0 }, { flat: 5, pct: 0.1 }, { flat: 10, pct: 0.2 }];
  const spDefs = (typeof SPEED_POTS !== "undefined") ? SPEED_POTS : [null, { add: 0.2 }, { add: 0.5 }, { add: 1.0 }];

  let sumTitle = "NO ACTIVE POTION";
  if (isLuck) {
    const f = lbList.reduce((s, b) => s + (b.flat || 0), 0);
    const p = lbList.reduce((s, b) => s + (b.pct || 0), 0);
    const parts = [];
    if (f) parts.push("+" + f + " FLAT");
    if (p) parts.push("+" + Math.round(p * 100) + "% LUCK");
    if (adMs > 0) parts.push("ADS ×2");
    if (parts.length) sumTitle = parts.join(" · ");
  } else {
    const a = sbList.reduce((s, b) => s + (b.add || 0), 0);
    if (a > 0) sumTitle = "+" + a.toFixed(1) + "× ROLL SPEED";
  }

  const chipHtml = [
    ...(isLuck && adMs > 0 ? ['<span class="pot-achip ad">ADS 2× <b data-pot-cd="' + (now + adMs) + '">' + cd(adMs) + '</b></span>'] : []),
    ...buffs.map(b => '<span class="pot-achip">LV.' + b.lv + ' <b data-pot-cd="' + b.endsAt + '">' + cd(b.endsAt - now) + '</b></span>')
  ].join("");

  const cards = [1, 2, 3].map(lv => {
    const stk = pots[lv - 1] || 0;
    const active = buffs.find(b => b.lv === lv);
    const eff = isLuck
      ? ("+" + lpDefs[lv].flat + " FLAT" + (lpDefs[lv].pct ? " · +" + Math.round(lpDefs[lv].pct * 100) + "%" : ""))
      : ("+" + spDefs[lv].add.toFixed(1) + "× SPEED");
    const nm = (isLuck ? "LUCK" : "SPEED") + " POTION L" + lv;
    const tmStr = active ? cd(active.endsAt - now) : "--:--";
    return '<div class="pot-card' + (active ? " active" : "") + (stk <= 0 ? " empty" : "") + '">'
      + '<div class="pot-c-top"><span class="pot-c-lv">LV.' + lv + '</span><span class="pot-c-stk">×' + stk + '</span></div>'
      + '<div class="pot-c-mid">'
        + '<div class="pot-c-art"><img src="assets/images/pot-' + type + '-' + lv + '.webp" alt="L' + lv + '"></div>'
        + '<div class="pot-c-info">'
          + '<div class="pot-c-name">' + nm + '</div>'
          + '<div class="pot-c-eff">' + eff + '</div>'
          + '<div class="pot-c-dur">+5:00 PER BOTTLE</div>'
          + '<div class="pot-c-mobmeta"><span>STOCK <b>×' + stk + '</b></span>'
            + '<span class="st">' + (active ? ('ON · <span data-pot-cd="' + active.endsAt + '">' + tmStr + '</span>') : "IDLE") + '</span></div>'
        + '</div>'
      + '</div>'
      + '<div class="pot-c-timer"><span class="st">' + (active ? "ACTIVE" : "IDLE") + '</span>'
        + '<b' + (active ? ' data-pot-cd="' + active.endsAt + '"' : '') + '>' + tmStr + '</b></div>'
      + '<button class="pot-c-btn" type="button"' + (stk <= 0 ? " disabled" : "")
        + ' onclick="window.l12InvokePotion(\'' + type + '\',' + lv + ')"'
        + ' title="' + (stk > 0 ? ("Use 1 Level " + lv + " potion (+5:00)") : "Out of stock — obtain from Tower or Shops") + '">'
        + (stk <= 0 ? "EMPTY" : (active ? "EXTEND +5M" : "USE +5:00"))
      + '</button>'
    + '</div>';
  }).join("");

  return {
    pac: pac,
    key: type + "|" + totalStock + "|" + buffs.map(b => b.lv).join(",") + "|" + (adMs > 0 ? 1 : 0),
    html: '<span class="hz-crn tl"></span><span class="hz-crn tr"></span>'
      + '<span class="hz-crn bl"></span><span class="hz-crn br"></span>'
      + '<header class="hzp-head">'
        + '<div class="hzp-hleft">'
          + '<div class="hzp-krow"><span class="hzp-dot"></span><span class="hzp-kick">// CONSUMABLE <b>BOOSTERS</b></span></div>'
          + '<div class="hzp-trow">'
            + '<div class="hzp-title">POTION MATRIX</div>'
            + '<div class="hzp-tabs">'
              + '<button class="hzp-tab' + (isLuck ? " on" : "") + '" type="button" onclick="window.l12ToggleDockPanel(\'luck\',true)">LUCK <span class="cnt">' + lkTotal + '</span></button>'
              + '<button class="hzp-tab' + (!isLuck ? " on" : "") + '" type="button" onclick="window.l12ToggleDockPanel(\'speed\',true)">SPEED <span class="cnt">' + spTotal + '</span></button>'
            + '</div>'
          + '</div>'
        + '</div>'
        + '<button class="hzp-close" type="button" onclick="window.l12CloseDockPanel()" title="Close" aria-label="Close Potion Matrix">' + _l12CloseSvg() + '</button>'
      + '</header>'
      + '<div class="hzp-body">'
        + '<div class="pot-summary">'
          + '<div class="pot-sum-l"><small>COMBINED ACTIVE ' + (isLuck ? "LUCK" : "SPEED") + ' BONUS</small><strong>' + sumTitle + '</strong></div>'
          + '<div class="pot-active-chips">' + (chipHtml || '<span class="pot-none">NO ACTIVE BUFF TIMERS</span>') + '</div>'
        + '</div>'
        + '<div class="hzp-sec"><b>SELECT TIER</b><i></i><span>' + totalStock + ' IN INVENTORY</span></div>'
        + '<div class="pot-grid">' + cards + '</div>'
        + '<div class="hzp-sec"><b>MECHANICS &amp; SOURCES</b><i></i><span>FULL BRIEFING</span></div>'
        + '<div class="hzp-desc">'
          + '<p>' + (isLuck
            ? '<em>Luck Potions</em> boost your Flat &amp; Percentage Luck before Weather, Global Luck, and Rebirth multipliers are applied. <b>Different levels (L1 + L2 + L3) stack simultaneously</b> for combined power!'
            : '<em>Speed Potions</em> accelerate your card summoning speed. <b>Different levels (L1 + L2 + L3) stack simultaneously</b> alongside Skill Tree speed nodes and Weather.')
          + '</p>'
          + '<div class="hzp-rules">'
            + '<div class="hzp-rule"><span>SAME-LEVEL STACK</span><b>EXTENDS +5:00 TIMER</b></div>'
            + '<div class="hzp-rule"><span>' + (isLuck ? "ADS OVERDRIVE" : "SPEED CAP") + '</span><b>' + (isLuck ? "2× TOTAL LUCK (WATCH ADS)" : "MAX 20.0× ROLL SPEED") + '</b></div>'
            + '<div class="hzp-rule"><span>WHERE TO OBTAIN</span><b>TOWER · INF SHOP · RAID SHOP</b></div>'
          + '</div>'
        + '</div>'
      + '</div>'
  };
}

function _l12RenderGlobalLuckPanel(now) {
  const pac = "#f3e600";
  const cd = (typeof fmtCountdown === "function") ? fmtCountdown : (ms => Math.max(0, Math.ceil(ms / 1000)) + "s");
  const gl = (typeof _globalLuckCache !== "undefined") ? _globalLuckCache : null;
  const endsMs = gl && gl.ends_at ? new Date(gl.ends_at).getTime() : 0;
  const active = !!(gl && now < endsMs);
  const mult = active ? (gl.multiplier || 0) : 0;
  const stacks = active ? Math.min(10, Math.max(1, Math.round(mult / 10))) : 0;
  const maxMult = (typeof GLOBAL_LUCK_MAX_MULT !== "undefined") ? GLOBAL_LUCK_MAX_MULT : 100;
  const maxed = active && mult >= maxMult;
  const cost = (typeof GLOBAL_LUCK_COST !== "undefined") ? GLOBAL_LUCK_COST : 1200;
  const gems = (typeof state !== "undefined" && state && state.premiumGems) || 0;
  const canBuy = gems >= cost;
  const buyerSafe = _l12Esc((gl && gl.activated_by) ? gl.activated_by : "HUNTER").toUpperCase();

  const segs = Array.from({ length: 10 }, function (_, i) {
    return '<div class="gl-seg' + (i < stacks ? " on" : "") + '">' + ((i + 1) * 10) + '×</div>';
  }).join("");

  const ctaLabel = maxed
    ? ("MAX " + maxMult + "× REACHED")
    : (active
      ? ("STACK +10× · " + cost.toLocaleString("en-US") + " GEMS")
      : (canBuy ? ("ACTIVATE 10× · " + cost.toLocaleString("en-US") + " GEMS") : ("NEED " + cost.toLocaleString("en-US") + " GEMS")));

  return {
    pac: pac,
    key: "global|" + mult + "|" + (active ? endsMs : 0) + "|" + gems + "|" + buyerSafe,
    html: '<span class="hz-crn tl"></span><span class="hz-crn tr"></span>'
      + '<span class="hz-crn bl"></span><span class="hz-crn br"></span>'
      + '<header class="hzp-head">'
        + '<div class="hzp-hleft">'
          + '<div class="hzp-krow"><span class="hzp-dot"></span><span class="hzp-kick">// SERVER-WIDE <b>MULTIPLIER</b></span></div>'
          + '<div class="hzp-trow">'
            + '<div class="hzp-title">GLOBAL LUCK SHRINE</div>'
            + '<span class="hzp-badge' + (active ? "" : " idle") + '"><span class="live-dot"></span>' + (active ? (stacks + "/10 STACKS ACTIVE") : "OFFLINE") + '</span>'
          + '</div>'
        + '</div>'
        + '<button class="hzp-close" type="button" onclick="window.l12CloseDockPanel()" title="Close" aria-label="Close Global Luck Shrine">' + _l12CloseSvg() + '</button>'
      + '</header>'
      + '<div class="hzp-body">'
        + '<div class="gl-hero">'
          + '<div class="gl-emb">' + _l12CloverSvg() + '</div>'
          + '<div class="gl-main">'
            + '<div class="gl-mult-row">'
              + '<span class="gl-mult' + (active ? "" : " off") + '">' + (active ? (mult + "× LUCK") : "INACTIVE · 1× BASE") + '</span>'
              + '<span class="gl-timer-pill" id="l12PopGlTimer">' + (active ? ("⏱ " + cd(endsMs - now)) : "NO ACTIVE TIMER") + '</span>'
            + '</div>'
            + '<div class="gl-buyer' + (active ? "" : " idle") + '">'
              + (active ? ("ACTIVATED BY: " + buyerSafe) : "WAITING FOR AN OPERATOR TO IGNITE")
            + '</div>'
          + '</div>'
          + '<div class="gl-right">'
            + '<span class="gl-stack-num">' + stacks + ' / 10</span>'
            + '<span class="gl-stack-lbl">SERVER STACKS</span>'
          + '</div>'
        + '</div>'
        + '<div class="gl-segs">' + segs + '</div>'
        + '<div class="gl-specs">'
          + '<div class="gl-spec hot"><k>PER ACTIVATION</k><b>+10× LUCK · +1H</b></div>'
          + '<div class="gl-spec"><k>MAXIMUM CAP</k><b>' + maxMult + '× LUCK · 10H</b></div>'
          + '<div class="gl-spec"><k>COVERAGE</k><b>ALL SERVER PLAYERS</b></div>'
        + '</div>'
        + '<div class="hzp-desc">'
          + '<p>Igniting the <em>Global Luck Shrine</em> applies a server-wide Luck Multiplier for <b>every player online</b> and broadcasts your name across the network. Multiplies directly with Personal Luck, Potions, Weather, and Rebirth.</p>'
          + '<div class="hzp-rules">'
            + '<div class="hzp-rule"><span>STACKING</span><b>ADDS +10× &amp; +60 MIN</b></div>'
            + '<div class="hzp-rule"><span>FORMULA</span><b>TOTAL LUCK × GLOBAL</b></div>'
            + '<div class="hzp-rule"><span>BILLING</span><b>NON-REFUNDABLE · INSTANT</b></div>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<footer class="hzp-foot">'
        + '<div class="hzp-foot-meta">'
          + '<span class="kv"><span>COST</span><img src="assets/images/premium-currency.webp" alt=""><b>' + cost.toLocaleString("en-US") + ' GEMS</b></span>'
          + '<span class="kv"><span>BALANCE</span><b>' + gems.toLocaleString("en-US") + '</b></span>'
        + '</div>'
        + '<button class="hzp-cta' + (maxed ? " off" : "") + '" type="button"' + (maxed ? " disabled" : "")
          + ' onclick="window.l12BuyGlobalLuckFromDock()">' + ctaLabel + '</button>'
      + '</footer>'
  };
}

function _l12RenderWeatherDockPanel(now) {
  const cd = (typeof fmtCountdown === "function") ? fmtCountdown : (ms => Math.max(0, Math.ceil(ms / 1000)) + "s");
  const fmtN = (typeof fmt === "function") ? fmt : (n => String(n));
  const fmtCh = (typeof fmtChance === "function") ? fmtChance : (n => String(n));
  const curWxId = (typeof activeWeatherId === "function") ? activeWeatherId() : null;
  const curW = (curWxId && typeof WEATHER !== "undefined" && WEATHER[curWxId]) ? WEATHER[curWxId] : null;
  const pac = curW ? curW.color : "#9ca3af";
  const wLeft = (state && state.weather && state.weather.endsAt) ? Math.max(0, state.weather.endsAt - now) : 0;
  const wName = curW ? String(curW.name || curWxId).toUpperCase() : "CLEAR SKY";
  const wRar = curW ? String(curW.rar || curW.rarity || "COMMON").toUpperCase() : "IDLE";
  const wLuck = curW ? curW.luckBonus : 1;
  const wSpd = curW ? curW.speedBonus : 1;

  const byUser = (state && state.weather && state.weather.activated_by) ? _l12Esc(state.weather.activated_by).toUpperCase() : "";
  const potWin = (typeof WEATHER_MS !== "undefined") ? WEATHER_MS : 300000;
  let wxSource = "NO ACTIVE CLIMATE";
  if (curW) {
    if (byUser) wxSource = "ACTIVATED BY: " + byUser;
    else if (wLeft > 0 && wLeft <= potWin + 10000) wxSource = "PERSONAL POTION · 5M";
    else wxSource = "SERVER ROTATION · 30M CYCLE";
  }

  let rawCards = (typeof window.l12GetWeatherCards === "function") ? window.l12GetWeatherCards(curWxId) : [];
  if (!curWxId) rawCards = rawCards.slice(0, 4);
  const cardsHtml = rawCards.length
    ? rawCards.map(c => {
        const cid = c.char_id || c.id;
        const thumb = c.thumb || ((typeof cardThumb === "function") ? cardThumb(cid) : "");
        const chStr = fmtCh(c.chance || ((typeof luckChance === "function") ? luckChance(cid) : 0));
        const tag = !curWxId && c.weatherName ? (String(c.weatherName).toUpperCase() + " ONLY") : (c.owned ? "OWNED" : "UNOWNED");
        return '<button type="button" class="wx-c ' + (c.owned ? "owned" : "unowned") + '"'
          + ' onclick="window.l12OpenWeatherMachine()" title="' + _l12Esc(c.name) + ' · 1 in ' + chStr + '">'
          + '<div class="wx-c-img"><img src="' + thumb + '" alt="" decoding="async"></div>'
          + '<div class="wx-c-info">'
            + '<div class="wx-c-nm">' + _l12Esc(c.name) + '</div>'
            + '<div class="wx-c-ch">1 in ' + chStr + '</div>'
            + '<span class="wx-c-own">' + tag + '</span>'
          + '</div>'
        + '</button>';
      }).join("")
    : '<div class="pot-none">NO EXCLUSIVE WEATHER CARDS</div>';

  const wp = (state && state.wpity) || { r: 0, m: 0 };
  const pRareMax = (typeof PITY_RARE !== "undefined") ? PITY_RARE : 100;
  const pMythMax = (typeof PITY_MYTHIC !== "undefined") ? PITY_MYTHIC : 250;
  const pR = Math.min(pRareMax, wp.r || 0);
  const pM = Math.min(pMythMax, wp.m || 0);
  const rPct = Math.min(100, (pR / pRareMax) * 100).toFixed(1);
  const mPct = Math.min(100, (pM / pMythMax) * 100).toFixed(1);
  const pots = (state && state.potions) || 0;
  const mythicPots = (state && state.mythicPotions) || 0;

  return {
    pac: pac,
    key: "weather|" + (curWxId || "idle") + "|" + byUser + "|" + pots + "|" + mythicPots + "|" + pR + "|" + pM,
    html: '<span class="hz-crn tl"></span><span class="hz-crn tr"></span>'
      + '<span class="hz-crn bl"></span><span class="hz-crn br"></span>'
      + '<header class="hzp-head">'
        + '<div class="hzp-hleft">'
          + '<div class="hzp-krow"><span class="hzp-dot"></span><span class="hzp-kick">// ATMOSPHERIC <b>MATRIX</b></span></div>'
          + '<div class="hzp-trow">'
            + '<div class="hzp-title">WEATHER DOCK</div>'
            + '<span class="hzp-badge' + (curW ? "" : " idle") + '"><span class="live-dot"></span>' + wxSource + '</span>'
          + '</div>'
        + '</div>'
        + '<button class="hzp-close" type="button" onclick="window.l12CloseDockPanel()" title="Close" aria-label="Close Weather Dock">' + _l12CloseSvg() + '</button>'
      + '</header>'
      + '<div class="hzp-body">'
        + '<div class="wx-hero">'
          + '<div class="wx-emb"><i class="wx-halo" aria-hidden="true"></i><img class="wx-emb-img" src="' + ((typeof weatherPotionSrc === "function") ? weatherPotionSrc(curWxId || "clear", true) : "assets/images/thumb/weather-clear.webp?v=1") + '" alt="" decoding="async"></div>'
          + '<div class="wx-hinfo">'
            + '<div class="wx-hname"><b>' + wName + '</b><span class="wx-rar">' + wRar + '</span></div>'
            + '<div class="wx-hsub">' + (curW ? "ACTIVE ATMOSPHERIC ANOMALY IN SUMMON POOL" : "NATURAL ROTATION PENDING · OPEN WEATHER MACHINE") + '</div>'
          + '</div>'
          + '<div class="wx-stats">'
            + '<div class="wx-stat"><k>LUCK</k><b>' + wLuck + '×</b></div>'
            + '<div class="wx-stat"><k>SPEED</k><b>' + wSpd + '×</b></div>'
            + '<div class="wx-stat tm"><k>TIMER</k><b id="l12PopWxTimer">' + (wLeft ? cd(wLeft) : "--:--") + '</b></div>'
          + '</div>'
        + '</div>'
        + '<div class="hzp-sec"><b>' + (curW ? "EXCLUSIVE POOL UNLOCKS" : "SAMPLE WEATHER EXCLUSIVES") + '</b><i></i><span>' + rawCards.length + ' CARDS</span></div>'
        + '<div class="wx-cards-grid">' + cardsHtml + '</div>'
        + '<div class="wx-pity">'
          + '<div class="wx-pbox"><div class="wx-prow"><span>RARE CLIMATE PITY</span><b>' + pR + ' / ' + pRareMax + '</b></div><div class="wx-ptrack"><i style="width:' + rPct + '%"></i></div></div>'
          + '<div class="wx-pbox"><div class="wx-prow"><span>AWAKENED PITY</span><b>' + pM + ' / ' + pMythMax + '</b></div><div class="wx-ptrack"><i style="width:' + mPct + '%"></i></div></div>'
        + '</div>'
        + '<div class="hzp-desc">'
          + '<p>Server weather rotates naturally every <b>30 minutes</b> across 15 climates. While active, it multiplies your <em>Total Luck</em> &amp; <em>Roll Speed</em> and unlocks <b>Weather-Exclusive cards</b> inside the Summon pool.</p>'
          + '<div class="hzp-rules">'
            + '<div class="hzp-rule"><span>WEATHER POTION</span><b>EQUAL/RARER SWITCHES (5M)</b></div>'
            + '<div class="hzp-rule"><span>WEAKER ROLL</span><b>KEEPS STRONGER CLIMATE</b></div>'
            + '<div class="hzp-rule"><span>INSTANT WEATHER</span><b>30M SERVER-WIDE IN SHOP</b></div>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<footer class="hzp-foot">'
        + '<div class="hzp-foot-meta">'
          + '<span class="kv"><span>POTIONS</span><b>×' + fmtN(pots) + '</b></span>'
          + (mythicPots > 0 ? '<span class="kv"><span>MYTHIC</span><b style="color:#c084fc">×' + fmtN(mythicPots) + '</b></span>' : '')
        + '</div>'
        + '<button class="hzp-cta sec" type="button" onclick="window.l12OpenInstantWeather()">INSTANT WEATHER</button>'
        + '<button class="hzp-cta" type="button" onclick="window.l12QuickRollWeather()">QUICK ROLL (×1)</button>'
        + '<button class="hzp-cta sec" type="button" onclick="window.l12OpenWeatherMachine()">OPEN MACHINE</button>'
      + '</footer>'
  };
}

function _l12RenderDockPanel() {
  const tray = document.getElementById("l12PotTray");
  if (!tray) return;
  if (!_l12DockPanel) {
    tray.classList.remove("open");
    tray.style.display = "none";
    tray.innerHTML = "";
    _l12PopKey = "";
    _l12PotTrayClass(false);
    _l12SyncBuffChips(Date.now());
    return;
  }
  const now = Date.now();
  let spec = null;
  if (_l12DockPanel === "luck" || _l12DockPanel === "speed") spec = _l12RenderPotionMatrix(_l12DockPanel, now);
  else if (_l12DockPanel === "global") spec = _l12RenderGlobalLuckPanel(now);
  else if (_l12DockPanel === "weather") spec = _l12RenderWeatherDockPanel(now);
  if (!spec) return;

  _l12PopKey = spec.key;
  tray.setAttribute("data-active-type", _l12DockPanel);
  tray.style.setProperty("--pac", spec.pac);
  tray.innerHTML = spec.html;
  tray.style.display = "flex";
  tray.classList.add("open");
  _l12PotTrayClass(true);
  _l12SyncBuffChips(now);
}

function _l12TickDockPanel(now) {
  if (!_l12DockPanel) return;
  const tray = document.getElementById("l12PotTray");
  if (!tray || !tray.classList.contains("open")) return;
  const cd = (typeof fmtCountdown === "function") ? fmtCountdown : (ms => Math.max(0, Math.ceil(ms / 1000)) + "s");

  if (_l12DockPanel === "luck" || _l12DockPanel === "speed") {
    const isLk = _l12DockPanel === "luck";
    const pArr = isLk
      ? (Array.isArray(state && state.luckPots) ? state.luckPots : [0, 0, 0])
      : (Array.isArray(state && state.speedPots) ? state.speedPots : [0, 0, 0]);
    const totalStk = (pArr[0] || 0) + (pArr[1] || 0) + (pArr[2] || 0);
    const bfs = isLk
      ? ((typeof luckBuffs === "function") ? luckBuffs().slice().sort((a, b) => a.lv - b.lv) : [])
      : ((typeof speedBuffs === "function") ? speedBuffs().slice().sort((a, b) => a.lv - b.lv) : []);
    const adMs = (typeof adLuckLeftMs === "function") ? adLuckLeftMs() : 0;
    const wantKey = _l12DockPanel + "|" + totalStk + "|" + bfs.map(b => b.lv).join(",") + "|" + (adMs > 0 ? 1 : 0);
    if (wantKey !== _l12PopKey) { _l12RenderDockPanel(); return; }
    let expired = false;
    tray.querySelectorAll("[data-pot-cd]").forEach(function (el) {
      const ends = Number(el.getAttribute("data-pot-cd")) || 0;
      const rem = ends - now;
      if (rem <= 0) { expired = true; return; }
      const txt = cd(rem);
      if (el.textContent !== txt) el.textContent = txt;
    });
    if (expired) _l12RenderDockPanel();
    return;
  }

  if (_l12DockPanel === "global") {
    const gl = (typeof _globalLuckCache !== "undefined") ? _globalLuckCache : null;
    const endsMs = gl && gl.ends_at ? new Date(gl.ends_at).getTime() : 0;
    const active = !!(gl && now < endsMs);
    const mult = active ? (gl.multiplier || 0) : 0;
    const gems = (typeof state !== "undefined" && state && state.premiumGems) || 0;
    const buyer = _l12Esc((gl && gl.activated_by) ? gl.activated_by : "HUNTER").toUpperCase();
    const wantKey = "global|" + mult + "|" + (active ? endsMs : 0) + "|" + gems + "|" + buyer;
    if (wantKey !== _l12PopKey) { _l12RenderDockPanel(); return; }
    const tm = document.getElementById("l12PopGlTimer");
    if (tm && active) {
      const txt = "⏱ " + cd(endsMs - now);
      if (tm.textContent !== txt) tm.textContent = txt;
    }
    return;
  }

  if (_l12DockPanel === "weather") {
    const curWxId = (typeof activeWeatherId === "function") ? activeWeatherId() : null;
    const byUser = (state && state.weather && state.weather.activated_by) ? _l12Esc(state.weather.activated_by).toUpperCase() : "";
    const pots = (state && state.potions) || 0;
    const mythicPots = (state && state.mythicPotions) || 0;
    const wp = (state && state.wpity) || { r: 0, m: 0 };
    const pR = Math.min((typeof PITY_RARE !== "undefined") ? PITY_RARE : 100, wp.r || 0);
    const pM = Math.min((typeof PITY_MYTHIC !== "undefined") ? PITY_MYTHIC : 250, wp.m || 0);
    const wantKey = "weather|" + (curWxId || "idle") + "|" + byUser + "|" + pots + "|" + mythicPots + "|" + pR + "|" + pM;
    if (wantKey !== _l12PopKey) { _l12RenderDockPanel(); return; }
    const wLeft = (state && state.weather && state.weather.endsAt) ? Math.max(0, state.weather.endsAt - now) : 0;
    const tm = document.getElementById("l12PopWxTimer");
    if (tm) {
      const txt = wLeft ? cd(wLeft) : "--:--";
      if (tm.textContent !== txt) tm.textContent = txt;
    }
  }
}

window.l12ToggleDockPanel = function (type, forceOpen) {
  if (window.sfx && sfx.hit) try { sfx.hit(); } catch (e) {}
  if (!type || type === "none" || (!forceOpen && _l12DockPanel === type)) {
    _l12DockPanel = null;
  } else {
    _l12DockPanel = type;
  }
  _l12RenderDockPanel();
};
window.l12CloseDockPanel = function () {
  _l12DockPanel = null;
  _l12RenderDockPanel();
};
window.l12TogglePotionTray = function (type) {
  window.l12ToggleDockPanel(type || "luck");
};
window.l12ClosePotionTray = function () {
  window.l12CloseDockPanel();
};

window.l12InvokePotion = function (type, lv) {
  let res = null;
  if (typeof window.l12UsePotionQuick === "function") {
    res = window.l12UsePotionQuick(type, lv);
  } else if (type === "luck" && typeof useLuckPotion === "function") {
    res = useLuckPotion(lv, 1);
  } else if (type === "speed" && typeof useSpeedPotion === "function") {
    res = useSpeedPotion(lv, 1);
  }
  _l12SyncBuffChips(Date.now());
  _l12RenderDockPanel();
  return res;
};

window.l12BuyGlobalLuckFromDock = function () {
  if (window.sfx && sfx.hit) try { sfx.hit(); } catch (e) {}
  if (typeof buyGlobalLuck !== "function") return;
  const r = buyGlobalLuck();
  if (r && typeof r.then === "function") {
    r.then(function () {
      if (document.querySelector(".lobby-hub.l12") || document.querySelector(".nh-shell")) renderLobby();
    }).catch(function () {});
  }
};

window.l12QuickRollWeather = function () {
  if (!state || (state.potions || 0) < 1) {
    if (typeof beep === "function") beep(240, 0.12, "square", 0.08);
    if (typeof toast === "function") toast("NO WEATHER POTIONS", "Obtain Weather Potions from Infinite Tower, Tower Shop, or Raid Shop.", "#f87171");
    return;
  }
  if (typeof useWeatherPotion !== "function") return;
  const r = useWeatherPotion();
  if (r && r.ok && r.weather) {
    if (typeof beep === "function") {
      beep(520, 0.1, "triangle", 0.08);
      setTimeout(function () { beep(780, 0.15, "triangle", 0.09); }, 80);
    }
    if (typeof toast === "function") {
      if (r.kept) {
        toast("CLIMATE PRESERVED", "Rolled " + r.weather.name + " (" + r.weather.rar + ") — kept stronger active climate.", r.weather.color);
      } else {
        toast(r.weather.name, r.weather.rar + " WEATHER ACTIVATED · 5 MIN", r.weather.color);
      }
    }
    if (typeof renderShell === "function") renderShell();
    _l12SyncBuffChips(Date.now());
    _l12RenderDockPanel();
  }
};

window.l12OpenInstantWeather = function () {
  if (window.sfx && sfx.hit) try { sfx.hit(); } catch (e) {}
  window.l12CloseDockPanel();
  if (typeof openPremiumShop === "function") openPremiumShop();
  if (typeof premSetTab === "function") premSetTab("weather");
};

window.l12OpenWeatherMachine = function () {
  if (window.sfx && sfx.hit) try { sfx.hit(); } catch (e) {}
  window.l12CloseDockPanel();
  if (typeof openWeatherMachine === "function") openWeatherMachine();
};
window.syncNhRollDock = function (forceActive) { const isRoll = (typeof forceActive === "boolean") ? forceActive : !!(typeof rollState !== "undefined" && rollState && rollState.active); const rBtn = document.getElementById("nhDockRollBtn"); if (rBtn) { rBtn.classList.toggle("is-rolling", isRoll); rBtn.setAttribute("aria-pressed", isRoll ? "true" : "false"); const rLbl = document.getElementById("nhDockRollLbl"); if (rLbl) rLbl.textContent = isRoll ? "STOP" : "ROLL"; const rSub = document.getElementById("nhDockRollSub"); if (rSub) rSub.textContent = isRoll ? "ROLLING" : "SUMMON"; } const aBtn = document.getElementById("nhDockAutoBtn"); if (aBtn) { aBtn.classList.toggle("is-on", isRoll); aBtn.setAttribute("aria-pressed", isRoll ? "true" : "false"); const aSub = document.getElementById("nhDockAutoSub"); if (aSub) aSub.textContent = isRoll ? "ACTIVE" : "OFF"; } };

if (!window._l12DockEscBound) {
  window._l12DockEscBound = true;
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !_l12DockPanel) return;
    if (document.querySelector("#pxConfirmHost .pxcf-backdrop, #weatherMachineModal.show, #premiumModal.show, #backpackPanel.open, #commandDrawer.open")) return;
    e.stopPropagation();
    window.l12CloseDockPanel();
  });
}

/* ---- ROLL HISTORY 10-SLOT STRIP ENGINE (ANTI-LAG) ---- */
let _rhLastPaint = 0;
let _rhRafTimer = null;

function l12ScheduleRollHistPaint() {
  if (_rhRafTimer) return;
  const now = Date.now();
  const delay = Math.max(0, 150 - (now - _rhLastPaint));
  _rhRafTimer = setTimeout(() => {
    _rhRafTimer = null;
    requestAnimationFrame(() => {
      _rhLastPaint = Date.now();
      l12PaintRollHist();
    });
  }, delay);
}
window.l12ScheduleRollHistPaint = l12ScheduleRollHistPaint;

function l12PaintRollHist() {
  const container = document.getElementById("l12RollHist");
  if (!container) return;
  const tot = document.getElementById("l12RollTotal");
  if (tot && typeof state !== "undefined" && state) {
    tot.textContent = "TOTAL: " + ((typeof fmt === "function") ? fmt(state.totalRolls || 0) : (state.totalRolls || 0));
  }

  if (typeof state !== "undefined" && state && Array.isArray(state.rollHistory) && state.rollHistory.length > 10) {
    state.rollHistory.length = 10;
  }
  const list = (typeof state !== "undefined" && state && Array.isArray(state.rollHistory)) ? state.rollHistory.slice(0, 10) : [];
  let html = "";
  for (let i = 0; i < 10; i++) {
    const item = list[i];
    if (item && item.char) {
      const c = (typeof CARDS !== "undefined" && CARDS[item.char]) ? CARDS[item.char] : null;
      const thumb = (typeof cardThumb === "function") ? cardThumb(item.char) : ((c && c.thumb) ? c.thumb : "assets/cards/thumb/" + item.char + ".webp");
      const tier = (c && c.tier) ? String(c.tier).toLowerCase() : "c";
      const tierClass = "r-" + tier;
      const mutClass = (item.mut && item.mut !== "none") ? ("mut-" + String(item.mut).toLowerCase()) : "";
      const isShiny = !!item.shiny;
      const isLatest = (i === 0);
      const chVal = item.chance || (c ? c.chance : 0);
      const chanceStr = (typeof fmtChance === "function") ? ("1:" + fmtChance(chVal)) : (chVal ? ("1:" + chVal) : "?");
      const name = c ? c.name : item.char;

      let bdgTxt = c ? (c.tier || "R") : "R";
      if (item.mut && item.mut !== "none") {
        bdgTxt = String(item.mut).slice(0, 3).toUpperCase();
      } else if (isShiny) {
        bdgTxt = "?" + bdgTxt;
      }
      if (isLatest) {
        bdgTxt = "NEW";
      }

      html += `
        <div class="rh-slot filled ${tierClass} ${mutClass} ${isShiny ? 'shiny' : ''} ${isLatest ? 'latest' : ''}"
             role="button" tabindex="0"
             onclick="window.l12ClickHistCard('${item.char}', '${item.mut || "none"}', ${isShiny}, ${chVal})"
             title="#${i + 1} ${name} (${c ? c.tier : ''}${item.mut && item.mut !== 'none' ? ' ? ' + item.mut.toUpperCase() : ''}${isShiny ? ' ? SHINY' : ''}) ? ${chanceStr}">
          <img src="${thumb}" alt="${name}" decoding="async">
          <span class="rh-bdg">${bdgTxt}</span>
          <span class="rh-ch">${chanceStr}</span>
        </div>
      `;
    } else {
      html += `<div class="rh-slot empty"><span>#${i + 1}</span></div>`;
    }
  }
  container.innerHTML = html;
}
window.l12PaintRollHist = l12PaintRollHist;

window.l12ClickHistCard = function(charId, mut, shiny, chance) {
  if (typeof rollState !== "undefined" && rollState && rollState.active) {
    const c = (typeof CARDS !== "undefined" && CARDS[charId]) ? CARDS[charId] : null;
    const name = c ? c.name : charId;
    const chStr = (typeof fmtChance === "function") ? fmtChance(chance) : chance;
    if (typeof toast === "function") {
      toast(name.toUpperCase(), "1 in " + chStr + (mut && mut !== "none" ? " ? " + mut.toUpperCase() : "") + (shiny ? " ? SHINY" : ""), "#38bdf8");
    }
  } else if (typeof showRollResult === "function") {
    showRollResult({ cardId: charId, mut: mut || "none", shiny: !!shiny, chance: chance || 0 }, true);
  }
};

/* ---- HOOK ROLL HISTORY TO GACHA ROLLS ---- */
function _hookRollHistory() {
  if (typeof state !== "undefined" && state) {
    if (!Array.isArray(state.rollHistory)) state.rollHistory = [];
    if (state.rollHistory.length === 0 && Array.isArray(state.stacks) && state.stacks.length > 0) {
      state.rollHistory = state.stacks.slice(-10).reverse().map(s => {
        const c = (typeof CARDS !== "undefined" && CARDS[s.char]) ? CARDS[s.char] : null;
        return {
          char: s.char,
          tier: (c && c.tier) || s.tier || "R",
          mut: s.mut || 'none',
          shiny: !!s.shiny,
          chance: (c && c.chance) || 100,
          ts: Date.now()
        };
      });
    }
    if (state.rollHistory.length > 10) {
      state.rollHistory.length = 10;
    }
  }
}

/* ========== TOGGLE BACKPACK FUNCTION ========== */
function toggleBackpack() {
  const panel = document.getElementById('backpackPanel');
  const backdrop = document.getElementById('backpackBackdrop');
  if (!panel) return;

  const isVisible = document.body.classList.contains('bp-open') || panel.classList.contains('open') || (panel.style.display !== 'none' && panel.style.display !== '');

  if (isVisible) {
    /* Close: refresh lobby di belakang biar hub card & bench ikut perubahan dek. */
    document.body.classList.remove('bp-open');
    panel.classList.remove('open');
    if (backdrop) backdrop.style.display = 'none';
    bpTarget = null;
    bpItemPopClose();
    panel.style.removeProperty('opacity');
    panel.style.removeProperty('transform');
    /* Banner hazard keluar (3 fase): tirai tutup -> konten hilang -> tirai buka.
       Tanpa fase 3 layar tertahan tertutup. */
    const hide = () => { panel.style.display = 'none'; render(); };
    if (typeof window.bpxBannerClose === 'function') { try { window.bpxBannerClose(hide); } catch (e) { hide(); } }
    else setTimeout(hide, 250);
  } else {
    /* Open */
    document.body.classList.add('bp-open');
    panel.classList.add('open');
    if (backdrop) backdrop.style.display = 'block';
    renderBackpackPanel();
    panel.style.display = 'flex';
    panel.style.removeProperty('opacity');
    panel.style.removeProperty('transform');
    if (typeof window.bpxBannerOpen === 'function') { try { window.bpxBannerOpen(); } catch (e) {} }
    beep(520, 0.1, 'triangle', 0.07);
  }
}

/* ========== MODAL BREAKDOWN DROP RATE INFINITE TOWER (3 kolom) ==========
   Port dari lab (desain terkunci 2026-11-05): 11 baris = 5 guaranteed/potion
   + 4 pack (dari TOWER_PACK_DROPS, tidak diduplikasi) + 2 trophy.
   Perf (AGENTS 2b): tanpa backdrop-filter, tanpa animasi box-shadow; masuk/keluar
   hanya opacity + transform (composited). Warna semantik dipertahankan:
   token = cyan, gem = emas, hazard = merah. */
const TWR_CARD_ICON="assets/images/icon-index-card.webp";
const TWR_TOKEN_ICON="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2322d3ee' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 6v12M8 10h8M8 14h6'/%3E%3C/svg%3E";

const TWR_DROP_GUAR=[
  {nm:"INSTANT CARD ROLLS", rate:"100&times; GUARANTEED", sub:"100 card rolls banked per floor &middot; rolled upon defeat", icon:TWR_CARD_ICON, cls:"guar"},
  {nm:"TOWER TOKENS",       rate:"GUARANTEED",           sub:"+1 regular floor &middot; +5 boss floor (every 5 floors)",  icon:TWR_TOKEN_ICON, cls:"guar"},
  {nm:"WEATHER POTION",     rate:"5%",                   sub:"Randomizes active weather (5 minute duration)",            icon:"assets/images/weather-potion.webp?v=1", cls:""},
  {nm:"LUCK POTION L1",     rate:"10%",                  sub:"+3 Flat Luck for 5 minutes (stackable)",                   icon:"assets/images/pot-luck-1.webp", cls:""},
  {nm:"SPEED POTION L1",    rate:"10%",                  sub:"+0.2&times; Roll Speed for 5 minutes (stackable)",         icon:"assets/images/pot-speed-1.webp", cls:""}
];

const TWR_DROP_RARE=[
  {type:"PERMANENT ARTIFACT", rate:"0.1% &middot; 1 in 1k", name:"FLAME SWORD",
   img:"assets/artifacts/pedang-api.webp",
   perks:[["FLAT","+120 LUCK"],["MULT","+100% (&times;2)"]],
   desc:"Permanent relic (max 1). Luck bonus active forever."},
  {type:"MYTHIC PET", rate:"0.01% &middot; 1 in 10k", name:"KYUBI FOX",
   img:"assets/pets/kyubi.webp",
   perks:[["FLAT","+200 LUCK"],["MULT","+300% (&times;4)"]],
   desc:"Mystical companion (max 1). Highest luck multiplier."}
];

function twrGuarRow(r){
  return `<div class="dpr${r.cls?" "+r.cls:""}">
    <div class="dpr-ico"><img src="${r.icon}" alt="" decoding="async"></div>
    <div class="dpr-txt">
      <span class="dpr-nm">${r.nm}</span>
      <span class="dpr-sub">${r.sub}</span>
    </div>
    <span class="dpr-rate">${r.rate}</span>
  </div>`;
}
function twrPackRow(d){
  return `<div class="dpr">
    <div class="dpr-ico"><img src="${d.icon}" alt="" decoding="async"></div>
    <div class="dpr-txt">
      <span class="dpr-nm">${d.name}</span>
      <span class="dpr-sub">Instant roll pack &middot; ready to use anytime</span>
    </div>
    <span class="dpr-rate">${d.label}</span>
  </div>`;
}
function twrRareCard(r){
  return `<div class="dpr-rare">
    <div class="dpr-rare-top">
      <div class="dpr-rare-img"><img src="${r.img}" alt="${r.name}" decoding="async"></div>
      <div class="dpr-rare-hd">
        <span class="dpr-rare-type">${r.type}</span>
        <span class="dpr-rare-name">${r.name}</span>
        <span class="dpr-rare-rate">${r.rate}</span>
      </div>
    </div>
    <div class="dpr-rare-perks">
      ${r.perks.map(p=>`<span class="dpr-perk ${p[0]==="MULT"?"mult":"flat"}"><i>${p[0]}</i><b>${p[1]}</b></span>`).join("")}
    </div>
    <span class="dpr-rare-desc">${r.desc}</span>
  </div>`;
}

function twrRenderBody(body){
  body.innerHTML=`
    <section class="dpr-col" data-col="guar">
      <h3 class="dpr-ch">GUARANTEED &amp; POTIONS <span>${TWR_DROP_GUAR.length}</span></h3>
      ${TWR_DROP_GUAR.map(twrGuarRow).join("")}
    </section>
    <section class="dpr-col" data-col="pack">
      <h3 class="dpr-ch">RANDOM PACK DROPS <span>${TOWER_PACK_DROPS.length}</span></h3>
      ${TOWER_PACK_DROPS.map(twrPackRow).join("")}
      <p class="dpr-note">Ready to use anytime in your Backpack.</p>
    </section>
    <section class="dpr-col" data-col="rare">
      <h3 class="dpr-ch">ULTRA RARE / TROPHY <span>${TWR_DROP_RARE.length}</span></h3>
      ${TWR_DROP_RARE.map(twrRareCard).join("")}
    </section>`;
}

/* Simpan elemen pemilik fokus sebelum modal dibuka supaya bisa dikembalikan
   (aksesibilitas keyboard: tutup modal = fokus balik ke tombol pemicu). */
let _twrFocusReturn=null;

function openTowerDropModal(){
  const m=document.getElementById("towerDropModal");
  const body=document.getElementById("towerDropModalBody");
  if(!m||!body)return;

  _twrFocusReturn=document.activeElement;
  twrRenderBody(body);

  m.classList.add("show");
  m.setAttribute("aria-hidden","false");
  beep(480,0.08,"triangle",0.06);

  const closeBtn=document.getElementById("twDropModalClose");
  if(closeBtn)closeBtn.onclick=closeTowerDropModal;
  m.onclick=(e)=>{ if(e.target===m) closeTowerDropModal(); };
  if(closeBtn)closeBtn.focus({preventScroll:true});
}

function closeTowerDropModal(){
  const m=document.getElementById("towerDropModal");
  if(!m)return;
  if(!m.classList.contains("show"))return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden","true");
  beep(360,0.07,"triangle",0.05);
  const back=_twrFocusReturn;
  _twrFocusReturn=null;
  /* Kalau pemicunya bukan elemen fokusable (mis. dibuka lewat console/otomatis,
     activeElement = body), fokus dikembalikan ke tombol pemicu di dock. */
  const target=(back&&back!==document.body&&back.focus)?back:document.getElementById("twDropRateBtn");
  if(target&&target.focus){ try{target.focus({preventScroll:true});}catch(e){} }
}

/* ESC untuk modal drop rate: boot.js:1034 hanya menangani profil/changelog/
   rebirth/backpack, jadi modal ini butuh listener sendiri. Dipasang SEKALI dan
   hanya bereaksi kalau modal benar-benar terbuka. */
if(!window.__twrEscWired){
  window.__twrEscWired=true;
  document.addEventListener("keydown",(e)=>{
    if(e.key!=="Escape")return;
    const m=document.getElementById("towerDropModal");
    if(m&&m.classList.contains("show")){ e.preventDefault(); closeTowerDropModal(); }
  });
}
/* Rebirth modal & 5s showcase moved to js/rebirth-hazard.js (WoB Hazard port). */


/* ================= AAA HIGH-PERFORMANCE AUDIO & INTERACTIVE SUITE ================= */
(function() {
  const audioClips = {
    hover: 'assets/audio/sfx/interface/glass_004.ogg',
    click: 'assets/audio/sfx/interface/click_002.ogg',
    open: 'assets/audio/sfx/interface/maximize_008.ogg',
    close: 'assets/audio/sfx/interface/minimize_008.ogg',
    confirm: 'assets/audio/sfx/interface/confirmation_001.ogg',
    deck: 'assets/audio/sfx/interface/drop_002.ogg',
    roll: 'assets/audio/sfx/sci-fi/engineCircular_001.ogg',
    jingle: 'assets/audio/sfx/jingles/jingles_PIZZI10.ogg',
    switch: 'assets/audio/sfx/interface/switch_001.ogg'
  };

  const soundPool = {};
  for (let key in audioClips) {
    soundPool[key] = [];
    for (let i = 0; i < 3; i++) {
      const a = new Audio(audioClips[key]);
      a.volume = (key === 'hover') ? 0.35 : 0.65;
      soundPool[key].push(a);
    }
  }

  window.playSound = function(type) {
    if (typeof state !== 'undefined' && state && state.muted) return;
    try {
      const pool = soundPool[type] || soundPool['click'];
      if (pool && pool.length) {
        const snd = pool.find(a => a.paused) || pool[0];
        snd.currentTime = 0;
        snd.play().catch(() => {});
      }
    } catch (e) {}
  };

  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  window.playSubBass = function(freq = 55, dur = 0.18, vol = 0.25) {
    if (typeof state !== 'undefined' && state && state.muted) return;
    try {
      const c = getAudioCtx();
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.start(now);
      osc.stop(now + dur);
    } catch (e) {}
  };
})();

function initAAAInteractiveSuite() {
  // 3. Tactile Hover Audio
  document.querySelectorAll('.menu-card, .dock-btn-deck, .dock-btn-roll, .cmd-trigger-btn, .currency-pill, .tb-avatar-pod').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (typeof playSound === 'function') playSound('hover');
    });
  });

  // 4. Auto-open drawer if requested in URL
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('drawer') === '1') {
      setTimeout(() => { if (typeof openCommandDrawer === 'function') openCommandDrawer(); }, 400);
    }
    } catch(e) {}
}
