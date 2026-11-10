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
    location.hash="#/lobby";
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
      const reqLv={1:1,2:10,3:25,4:50};
      kick.textContent="// SPIRE AUTOMATION & COMBAT";
      title.textContent="TOWER SETTINGS";
      body.innerHTML=`<div class="sub-row">
          <div class="sub-row-txt"><b>Auto-Restart on Defeat</b><small>Automatically starts a new Floor 1 run after your squad falls.</small></div>
          <button type="button" class="sub-toggle${isAuto?" on":""}" id="tw2AutoTog">${isAuto?"ON":"OFF"}</button>
        </div>
        <div class="sub-row">
          <div class="sub-row-txt"><b>Battle Speed Multiplier</b><small>Player Lv ${state.playerLv||1} &middot; Active ${curSp}&times;${maxSp<4?" (Next unlocks at Lv "+reqLv[maxSp+1]+")":" (Max unlocked)"}</small></div>
          <div class="sub-pills">${[1,2,3,4].map(sp=>{
            const locked=sp>maxSp;
            return `<button type="button" class="sub-pill${curSp===sp?" on":""}${locked?" locked":""}" data-twsp="${sp}" ${locked?`disabled title="Unlocks at Lv ${reqLv[sp]}"`:""}>${sp}&times;${locked?" (LV"+reqLv[sp]+")":""}</button>`;
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
          if(!v||v>maxSp)return;
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
   if(tfx&&tfx.entryFreeze&&!foeStatusImmune()){bt.eStun=tfx.entryFreeze.turns;bt.freezeLeft=tfx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","FROZEN","crit"),bsMs(300));}
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
   if(nfx.foeEntryFreeze&&!foeStatusImmune()){bt.eStun=nfx.foeEntryFreeze.turns;bt.freezeLeft=nfx.foeEntryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","FROZEN","crit"),bsMs(300));}
   /* FREEZE TRANSFER (ABSOLUTE ZERO): musuh ini mewarisi freeze dari target beku yang dibunuh sebelumnya */
   if(bt.freezeNext){bt.freezeNext=false;if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun,1);bt.freezeLeft=Math.max(bt.freezeLeft,1);setTimeout(()=>floatText(".fighter.foe","FROZEN","crit"),bsMs(360));}}
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
      +(isShiny?'<span class="pr-badge sh">SHINY</span>':'')
      +(isMut?'<span class="pr-badge mut" style="--mc:'+(MUT_COLOR[g.mut]||'#fff')+'">'+(MUT_LABEL[g.mut]||g.mut).toUpperCase()+'</span>':'')
      +'</span>'
    : '';
  return '<div class="pr-tile'+(isMut?' mut-'+g.mut:'')+(isShiny?' shiny':'')+'" data-tier="'+tier+'" title="'+name+'">'
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
  mcEl.innerHTML=`
    <span class="md-art"><img src="${c.sprite_asset}" alt="${c.name}"></span>
    <div class="md-info">
      <div class="eyebrow" style="color:${(s.tier&&TIER_COLOR[s.tier])||'#7DF9FF'}">${rarityText(s.tier,luckChance(s.char,s.mut,s.shiny))}${s.mut&&s.mut!=="none"?` · ${mutChip(s.mut,mutPill(s.mut))}`:""}${s.shiny?' · <span class="shiny-badge shiny-pill">SHINY</span>':""}</div>
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
  return `<div class="hub-center${CARDS[eq.char].fullArt?' fa':''}${mut?' mut-'+mut:''}${shinyCls(eq)}"${idAttr||''} data-tier="${tier}" style="--tcol:${mut?MUT_COLOR[mut]:((tier&&TIER_COLOR[tier])||'#7DF9FF')}${mut&&!eq.shiny?`;border-color:${MUT_COLOR[mut]}`:''}">
      <div class="hc-img"><img src="${cardImg(eq.char)}" alt="${cardName(eq.char)}"${CARDS[eq.char].pos?` style="object-position:${CARDS[eq.char].pos}"`:''}>
          ${mut&&!eq.shiny?`<span class="hc-name-top hc-mut-name" data-text="${String(cardName(eq.char)).replace(/"/g,'&quot;')}">${mut==='rainbow'?mutText(mut,cardName(eq.char)):cardName(eq.char)}</span>`:eq.shiny?`<span class="hc-name-top hc-name-shine${mut?' hc-name-shine-'+mut:''}" data-text="${String(cardName(eq.char)).replace(/"/g,'&quot;')}" style="${mut==='gold'?'--sh-base:#E0BC6E;--sh-edge:rgba(224,188,110,.95);--sh-glow:rgba(224,188,110,.55)':mut==='rainbow'?'--sh-base:#B58CFF;--sh-edge:rgba(90,200,250,.95);--sh-glow:rgba(181,140,255,.55)':mut==='secret'?'--sh-base:#A855F7;--sh-edge:rgba(168,85,247,.95);--sh-glow:rgba(168,85,247,.55)':mut==='ultima'?'--sh-base:#FF0055;--sh-edge:rgba(255,51,102,.95);--sh-glow:rgba(255,0,85,.6)':'--sh-base:#22d3ee;--sh-edge:rgba(34,211,238,.95);--sh-glow:rgba(34,211,238,.55)'}">${cardName(eq.char)}</span>`:shinyName('span','hc-name-top','hc-name-shine',mut,eq.shiny,cardName(eq.char))}
          <span class="hc-chance${mut==='rainbow'?' hc-chance-rainbow':''}" style="color:${mut?MUT_COLOR[mut]:"#9AA6B2"}">${mut==='rainbow'?mutText(mut,chanceText):chanceText}</span>
          ${(mut||trait||eq.shiny)?`<div class="hc-badges">${eq.shiny?'<span class="shiny-badge shiny-pill">SHINY</span>':''}${mut?mutChip(mut,mutPill(mut)):''}${trait?traitChip(trait,`<span class="hc-trait hc-gem" style="color:${TRAIT_COLOR[trait]};border-color:${TRAIT_COLOR[trait]}">${traitGem(14,trait)}</span>`):''}</div>`:''}
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
/* Tile REBIRTH di rail kanan lobby — nilai dup dikumpulin di sini, naikkan luck. */
function rbCompact(n){n=n||0;if(n>=1e9)return (n/1e9).toFixed(n>=1e10?0:1)+'B';if(n>=1e6)return (n/1e6).toFixed(n>=1e7?0:1)+'M';if(n>=1e3)return (n/1e3).toFixed(n>=1e4?0:1)+'K';return String(Math.floor(n));}
function hubRebirthTileHtml(){
  const cnt=typeof rebirthCount==='function'?rebirthCount():0;
  const es=typeof rebirthEssence==='function'?rebirthEssence():0;
  const th=typeof rebirthThreshold==='function'?rebirthThreshold():1000000;
  const mult=typeof rebirthLuckMult==='function'?rebirthLuckMult():1;
  const ready=es>=th;
  const pct=Math.max(0,Math.min(100,Math.round(es/th*100)));
  return `
    <div class="hub-box h-rebirth hub-link hub-link-rebirth${ready?' ready':''}" id="hubRebirth" role="button" title="Rebirth: convert duplicate essence into permanent luck">
      <span class="tile-frame" aria-hidden="true"></span>
      <span class="tile-index"><span class="tile-number" style="color:#c084fc">R${cnt}</span><span class="tile-category" style="color:#a855f7">CYCLE / ASCENSION</span></span>
      <span class="tile-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M78 50a28 28 0 1 1-9-20.8"/>
          <path d="M70 20l10 9-13 6" stroke-width="2.2"/>
          <circle cx="50" cy="50" r="6" fill="currentColor"/>
        </svg>
      </span>
      <span class="tile-copy"><span class="hb-lbl" style="color:#c084fc;text-shadow:0 0 10px rgba(192,132,252,.4)">REBIRTH</span><span class="hb-meta">LUCK ×${mult}</span></span>
      <span class="rebirth-progress">
        <span class="rebirth-meter" id="rebirthMeter" role="progressbar" aria-label="Rebirth progress" aria-valuemin="0" aria-valuemax="${th}" aria-valuenow="${es}"><span id="rebirthFill" style="width:${pct}%"></span></span>
        <span class="rb-sub" id="rebirthSub">${rbCompact(es)} / ${rbCompact(th)}</span>
      </span>
      <span class="tile-action" style="border-color:rgba(192,132,252,.5);color:${ready?'#e9d5ff':'#a855f7'}"><span>${ready?'REBIRTH':'LOCKED'}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>`;
}
/* Patch tile in-place tanpa full re-render (dipanggil setelah roll selesai). */
function updateRebirthUI(){
  const box=document.getElementById('hubRebirth');
  if(!box||typeof rebirthCount!=='function')return;
  const es=rebirthEssence(),th=rebirthThreshold(),cnt=rebirthCount(),mult=rebirthLuckMult();
  const ready=es>=th,pct=Math.max(0,Math.min(100,Math.round(es/th*100)));
  box.classList.toggle('ready',ready);
  const num=box.querySelector('.tile-number');if(num)num.textContent='R'+cnt;
  const lbl=box.querySelector('.hb-meta');if(lbl)lbl.textContent='LUCK ×'+mult;
  const fill=document.getElementById('rebirthFill');if(fill)fill.style.width=pct+'%';
  const meter=document.getElementById('rebirthMeter');if(meter){meter.setAttribute('aria-valuemax',String(th));meter.setAttribute('aria-valuenow',String(es));}
  const sub=document.getElementById('rebirthSub');if(sub)sub.textContent=rbCompact(es)+' / '+rbCompact(th);
  const act=box.querySelector('.tile-action span');if(act)act.textContent=ready?'REBIRTH':'LOCKED';
  const rbM=document.getElementById('rebirthModal');if(rbM&&rbM.classList.contains('show'))renderRebirthModal();
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

function renderLobby(){
  if(state.battle){
    if(typeof cleanupCommandDrawer==='function') cleanupCommandDrawer();
    return renderBattle();
  }
  /* Tray potion tidak hidup lagi setelah #app ditimpa render lain. */
  _l12DockPanel = null;
  _l12PopKey = "";
  _l12PotTrayClass(false);
  const _oldDrw = document.getElementById('commandDrawer');
  if(_oldDrw && _oldDrw.parentElement === document.body) _oldDrw.remove();
  const _oldBd = document.getElementById('drawerBackdrop');
  if(_oldBd && _oldBd.parentElement === document.body) _oldBd.remove();
  document.body.classList.remove('drawer-open');
  const eq = equipped();
  const activeBg = getLobbyActiveBg();

  /* ---- RELOKASI (teknik A): parkir dulu node hidup SEBELUM #app ditimpa.
     Node yang sudah dipindah ke dalam #app akan MUSNAH bersama innerHTML, jadi
     tiap render mereka diparkir di luar #app (identitas elemen + listener
     boot.js/panels.js ikut pindah, bukan disalin -> nol duplikat id). ---- */
  let _l12Park = document.getElementById("l12Park");
  if (!_l12Park) {
    _l12Park = document.createElement("div");
    _l12Park.id = "l12Park";
    _l12Park.style.cssText = "display:none!important";
    document.body.appendChild(_l12Park);
  }
  ["rollBtn", "rollAutoBtn", "footAv"].forEach(function (id) {
    let n = document.getElementById(id);
    /* Tidak ada di DOM -> mungkin baru dilepas innerHTML layar lain; adopsi dari registry. */
    if (!n && _l12Live[id]) n = _l12Live[id];
    /* Masih ada di DOM tapi belum pernah direlokasi (render pertama) -> kenali. */
    if (n) _l12Live[id] = n;
    if (n && n.parentElement !== _l12Park) _l12Park.appendChild(n);
  });

  /* ---- DATA ASLI (tidak ada yang pseudo) ---- */
  const _fmt = (typeof fmt === "function") ? fmt : (n => String(n));
  const _lv = state.playerLv || 1;
  const _xpNeed = Math.max(1, _lv * 1000);                       /* state.js:507 — xp per level = lv*1000 */
  const _xpPct = Math.max(0, Math.min(100, Math.round((state.xp || 0) / _xpNeed * 100)));
  const _coins = _fmt(state.coins || 0);
  const _gems = _fmt(state.premiumGems || 0);
  const _luckMult = (typeof totalLuck === "function") ? totalLuck() : 1;
  const _luckFlat = (state.player && state.player.luckFlat) || 0;
  const _luckPct = (state.player && state.player.luckPercent) || 0;
  /* Meter luck = skala 0..10x (produksi TIDAK punya target "3000" seperti prototipe). */
  const _luckPctW = Math.max(3, Math.min(100, Math.round(_luckMult / 10 * 100)));

  const _deck = Array.isArray(state.deck) ? state.deck : [null, null, null, null];
  const _byId = {};
  (state.stacks || []).forEach(s => { if (s && s.id) _byId[s.id] = s; });
  const _party = _deck.slice(0, 4).map(id => (id && _byId[id]) ? _byId[id] : null);
  const _combo = _party.filter(Boolean).length;
  /* Slot terpilih untuk poster panggung (klik lingkaran party). Kalau slot yang
     tersimpan kosong, jatuh ke slot terisi pertama supaya poster tak hilang. */
  const _showIdx = (_l12ShowIdx >= 0 && _l12ShowIdx < 4 && _party[_l12ShowIdx])
    ? _l12ShowIdx
    : (function () { const f = _party.findIndex(Boolean); return f >= 0 ? f : 0; })();
  /* Data untuk handler klik .pav (l12Showcase). _l12ShowIdx sengaja TIDAK
     ditimpa dengan fallback: kalau slot pilihan sedang kosong, pilihan pemain
     tetap disimpan supaya poster balik lagi saat slot itu diisi. */
  _l12ShowParty = _party;

  /* POTION (sumber sama dengan #buffDock milik panels.js) */
  const _now = Date.now();
  const _cd = (typeof fmtCountdown === "function") ? fmtCountdown : (ms => Math.ceil(ms / 1000) + "s");
  const _luckBuffs = (typeof luckBuffs === "function") ? luckBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const _speedBuffs = (typeof speedBuffs === "function") ? speedBuffs().slice().sort((a, b) => a.lv - b.lv) : [];
  const _potLuck = _luckBuffs[_luckBuffs.length - 1] || null;
  const _potSpeed = _speedBuffs[_speedBuffs.length - 1] || null;
  const _adLuckMs = (typeof adLuckLeftMs === "function") ? adLuckLeftMs() : 0;
  const _lkPots = Array.isArray(state.luckPots) ? state.luckPots : [0,0,0];
  const _spPots = Array.isArray(state.speedPots) ? state.speedPots : [0,0,0];
  const _lkStock = (_lkPots[0]||0) + (_lkPots[1]||0) + (_lkPots[2]||0);
  const _spStock = (_spPots[0]||0) + (_spPots[1]||0) + (_spPots[2]||0);

  /* GLOBAL LUCK */
  const _gl = (typeof _globalLuckCache !== "undefined") ? _globalLuckCache : null;
  const _glActive = !!(_gl && _now < new Date(_gl.ends_at).getTime());
  const _glMult = _glActive ? (_gl.multiplier || 0) : 0;
  const _glLeft = _glActive ? (new Date(_gl.ends_at).getTime() - _now) : 0;
  const _glStacks = Math.min(10, Math.round(_glMult / 10) || (_glActive ? 1 : 0));
  const _glCost = (typeof GLOBAL_LUCK_COST !== "undefined") ? GLOBAL_LUCK_COST : 0;
  const _glCan = (state.premiumGems || 0) >= _glCost;
  const _glMaxMult = (typeof GLOBAL_LUCK_MAX_MULT !== "undefined") ? GLOBAL_LUCK_MAX_MULT : 100;
  const _glMaxed = _glMult >= _glMaxMult;
  /* Label ikut widget asli panels.js:3317 (AKTIFKAN / +10× / MAX 100×) + HARGA
     selalu tampil: user mengira tombolnya rusak karena harganya tak pernah kelihatan. */
  const _glLabel = _glActive ? (_glMaxed ? "MAX " + _glMaxMult + "×" : "+10×") : "ACTIVATE";

  /* WEATHER */
  const _wId = (typeof activeWeatherId === "function") ? activeWeatherId() : null;
  const _w = (_wId && typeof WEATHER !== "undefined" && WEATHER[_wId]) ? WEATHER[_wId] : null;
  const _wLeft = (state.weather && state.weather.endsAt) ? Math.max(0, state.weather.endsAt - _now) : 0;
  const _wRr = _w ? (String(_w.rar || _w.rarity || "COMMON").toUpperCase()) : "";

  /* MODE HUB — progress asli */
  let _storyBadge = "CH" + ((state.chap || 0) + 1);
  if (typeof CHAPTERS !== "undefined" && Array.isArray(CHAPTERS) && typeof chapProgMode === "function") {
    const _done = CHAPTERS.reduce((a, c) => a + chapProgMode(c, state.diff), 0);
    const _tot = CHAPTERS.reduce((a, c) => a + c.levels.length, 0);
    if (_tot) _storyBadge = Math.round(_done / _tot * 100) + "%";
  }
  const _towerBadge = "F" + ((state.tower && state.tower.best) || 0);
  const _raidBadge = "#" + ((state.raidCleared && state.raidCleared.normal) ? Object.keys(state.raidCleared.normal).length : 0);

  /* HERO */
  const _potWin = (typeof WEATHER_MS !== "undefined") ? WEATHER_MS : 300000;  /* panels.js:16 — window potion 5 menit */
  const _luckTxt = [_luckFlat ? "+" + _luckFlat : "", _luckPct ? "+" + Math.round(_luckPct * 100) + "%" : ""].filter(Boolean).join(" · ");
  const _frameCfg = (typeof getLobbyActiveFrame === "function") ? getLobbyActiveFrame() : { src: "" };
  /* Kartu yang dipamerkan di poster = slot party terpilih (fallback deck leader). */
  const _show = _party[_showIdx] || eq;
  const _hasEq = !!(_show && _show.char && CARDS[_show.char]);
  const _c = _hasEq ? CARDS[_show.char] : null;
  const _art = _hasEq ? ((typeof cardImg === "function") ? cardImg(_show.char) : "assets/cards/art/shadow-king.webp") : "assets/cards/art/shadow-king.webp";
  const _heroName = _hasEq ? ((typeof cardName === "function") ? cardName(_show.char) : _c.name) : "NO FIGHTER";
  const _heroPower = (typeof totalPower === "function") ? _fmt(totalPower()) : "0";
  const _pos = (_c && _c.pos) ? ("object-position:" + _c.pos + ";") : "";

  /* ---- turunan layout C HAZARD (semua dari state asli, tanpa angka palsu) ---- */
  const _cWbAtt = (function () {
    try { if (typeof wbAttOf === "function") { const n = wbAttOf(); return (n == null) ? "\u2014" : (n + " / 3"); } } catch (e) {}
    return "3 / 3";
  })();
  const _cAvatar = _l12SlotThumb(_party[0] || (state.stacks && state.stacks[state.stacks.length - 1]) || null);
  /* luck bisa membesar (rebirth x14 + weather); diringkas supaya tidak meluber */
  const _cLuck = (function () {
    var v = (typeof totalLuck === "function") ? totalLuck() : 1;
    if (!isFinite(v) || v <= 0) v = 1;
    var t = v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toFixed(2));
    return "x" + t;
  })();
  /* Shiny chance = angka produksi yang sama dengan layar PROFILE (1 in N). */
  const _cShiny = (function () {
    try {
      if (typeof SHINY_CHANCE_MULT !== "undefined" && typeof fmtChance === "function")
        return "1 in " + fmtChance(100 * SHINY_CHANCE_MULT);
    } catch (e) {}
    return "\u2014";
  })();
  /* Vestige rank R0/R1/... dari rebirthCount() (bukan angka karangan). */
  const _cVest = "R" + ((typeof rebirthCount === "function") ? rebirthCount() : 0);

  /* ---- COMMAND DRAWER v5 markup helpers (tile icon = 2.5D WebP hazard set,
     group header = inline Solar SVG 15px). Statistik hidup tetap di sub-label
     tile (missionSub, drwDailySub, dst) supaya handler lama tetap utuh. */
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
  <div class="lobby-hub stage-root l12 c12" id="stage">
    <div class="colw c12wrap">

      <div class="c12main">

        <!-- ============ KIRI: PANEL HAZARD ============ -->
        <div class="c12panel">
          <span class="rail rail-panel" aria-hidden="true"></span>

          <div class="c12kick">
            <span class="c12dot" aria-hidden="true"></span>
            <span class="c12kickt">SHADOW OPERATOR // ${(currentUser || "GUEST").toUpperCase()}</span>
            <span class="c12live"><i></i>ONLINE</span>
          </div>

          <h1 class="c12title">${String(_heroName).replace(" ", "<br>")}</h1>

          <div class="c12meta">${_l12HeroMetaHtml(_show, _lv, _combo)}</div>

          <div class="c12pow">
            <b id="l12TopPwr">${_heroPower}</b><span>COMBAT POWER</span>
          </div>

          <!-- POD LEVEL / XP = pintu masuk layar PROFILE (perintah user 2026-11-09).
               Seluruh blok bisa diklik; judul di dalamnya tetap membuka TITLES. -->
          <div class="l12-lvl-pod c12lvl" id="l12LvlPod" role="button" tabindex="0" data-pfopen
               title="Open Operator Profile" aria-label="Open Operator Profile"
               onclick="if(typeof openProfileModal==='function')openProfileModal();"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();if(typeof openProfileModal==='function')openProfileModal();}">
            <span class="lv-badge">LV <b id="l12TopLv">${_lv}</b></span>
            <span class="lv-info">
              <span class="lv-meta">
                <span class="lv-title" onclick="event.stopPropagation();if(typeof openTitlesModal==='function')openTitlesModal();" title="Change Title">[${String(state.playerTitle || "ROOKIE").toUpperCase()}]</span>
                <span class="lv-pct" id="l12TopXpPct">${_xpPct}%</span>
              </span>
              <span class="bar"><span id="l12TopXpBar" style="width:${_xpPct}%"></span></span>
            </span>
            <span class="lv-open" aria-hidden="true">PROFILE<i></i></span>
          </div>

          <div class="c12rule" aria-hidden="true"></div>

          <div class="c12brief">
            <div class="c12br"><span class="c12bk">CLEARED</span><span class="c12bv">${_storyBadge}</span></div>
            <div class="c12br"><span class="c12bk">BEST FLOOR</span><span class="c12bv">${_towerBadge}</span></div>
            <div class="c12br hot"><span class="c12bk">WB ATTEMPTS</span><span class="c12bv">${_cWbAtt}</span></div>
          </div>

          <!-- QUICK STATS: mengisi ruang kosong panel kiri dengan data asli
               (totalRolls, totalLuck, shiny chance, vestige/rebirth). -->
          <div class="c12qs">
            <div class="c12q"><span class="c12qk">TOTAL ROLLS</span><b class="c12qv" id="l12QsRolls">${_fmt(state.totalRolls || 0)}</b></div>
            <div class="c12q"><span class="c12qk">LUCK</span><b class="c12qv" id="l12QsLuck">${_cLuck}</b></div>
            <div class="c12q"><span class="c12qk">SHINY</span><b class="c12qv" id="l12QsShiny">${_cShiny}</b></div>
            <div class="c12q"><span class="c12qk">VESTIGE</span><b class="c12qv" id="l12QsVest">${_cVest}</b></div>
          </div>

          <!-- DECK // 4 dihapus (perintah user 2026-11-06): panel kiri
               dibiarkan kosong bersih. Info deck masih ada di chip meta dan
               avatar party di kanan-bawah panggung. -->

          <div class="c12gap" aria-hidden="true"></div>

          <!-- RIWAYAT ROLL: JS menggambar 10 sel, 4 terlihat -->
          <div class="c12hist" id="l12RollHistWrap">
            <span class="c12hl" id="l12RollTotal">TOTAL ROLLS · ${_fmt(state.totalRolls || 0)}</span>
            <div class="rh-strip c12strip" id="l12RollHist"></div>
          </div>

          <!-- MODE HUB -->
          <div class="hlist c12modes">
            <button class="hrow" type="button" data-hub="story"><span class="mn">01</span><i class="ic i-story"></i><span class="mt">STORY</span><b class="bd">${_storyBadge}</b><i class="chv"></i></button>
            <button class="hrow" type="button" data-hub="tower"><span class="mn">02</span><i class="ic i-tower"></i><span class="mt">TOWER</span><b class="bd">${_towerBadge}</b><i class="chv"></i></button>
            <button class="hrow" type="button" data-hub="raid"><span class="mn">03</span><i class="ic i-raid"></i><span class="mt">RAID</span><b class="bd">${_raidBadge}</b><i class="chv"></i></button>
          </div>
        </div>

        <!-- ============ KANAN: POSTER HERO (full-bleed, tanpa bingkai) ============ -->
        <div class="stage" id="c12Stage">
          <div class="stage-bg-layer" id="stageBgLayer" style="background-image: url('${activeBg}');"></div>
          <canvas id="ambientCanvas"></canvas>

          <div class="hero" id="heroStandeeWrap" title="Click Hunter to manage Party &amp; Deck" onclick="if(window.sfx&&sfx.hit)sfx.hit();if(typeof toggleBackpack==='function')toggleBackpack();">
            <div class="artbox"><img class="art" src="${_art}" alt="" style="${_pos}"></div>
            <span class="cast" aria-hidden="true"></span>
          </div>

          <div class="c12party">${(_party || []).slice(0, 4).map(function (s, i) {
            if (!s) return '<button class="pav empty" type="button" title="Empty slot — click to open Backpack" onclick="if(typeof toggleBackpack===\'function\')toggleBackpack();">+</button>';
            var _pn = (typeof cardName === 'function') ? cardName(s.char) : s.char;
            var _pc = (typeof MUT_COLOR !== 'undefined' && MUT_COLOR[s.mut]) ? MUT_COLOR[s.mut] : 'rgba(245,245,245,.26)';
            /* Klik lingkaran = tukar poster showcase (bukan buka Backpack; tombol tas ada di dock). */
            return '<button class="pav' + (i === _showIdx ? ' on' : '') + '" type="button" aria-pressed="' + (i === _showIdx ? 'true' : 'false') + '" title="Showcase ' + _pn + ' on stage" style="--mc:' + _pc + '" onclick="if(typeof l12Showcase===\'function\')l12Showcase(' + i + ');">' + _l12SlotThumb(s) + '</button>';
          }).join("")}</div>
        </div>

        <!-- resource kanan-atas -->
        <div class="c12res">
          <button class="pill coin-pill" type="button" onclick="if(typeof openPremiumShop==='function')openPremiumShop();" title="Gold Coins">
            <span class="p-ic">${typeof coinIcon === 'function' ? coinIcon(15) : '<i class="ic i-coin"></i>'}</span><b id="l12TopCoins">${_coins}</b>
          </button>
          <button class="pill gem-pill" type="button" onclick="if(typeof openPremiumShop==='function')openPremiumShop();" title="Premium Gems">
            <img class="p-gem" src="assets/images/premium-currency.webp" alt=""><b id="l12TopGems">${_gems}</b><span class="p-plus">+</span>
          </button>
        </div>


      </div>

      <!-- ============ BAWAH: BUFF (4 chip + Hazard popovers) + DOCK ============ -->
      <div class="c12foot">
        <section class="pot-tray hz-dock-pop" id="l12PotTray" style="display:none;" aria-live="polite"></section>

        <div class="hud c12buffs">
          <button type="button" class="l12-bchip${(_potLuck || _adLuckMs > 0) ? " is-on" : ""}" id="l12PotLuck"
                  data-block="pot-luck" style="--bc:var(--luck)" title="Luck Potions &amp; Buffs"
                  onclick="window.l12ToggleDockPanel('luck')">
            <span class="l12-bchip-ic"><img id="l12PotLuckImg" src="assets/images/pot-luck-${_potLuck ? _potLuck.lv : 1}.webp" alt=""></span>
            <span class="l12-bchip-txt">
              <span class="l12-bchip-k">LUCK POT <span class="tag" id="l12PotLuckStock">&times;${_lkStock}</span></span>
              <span class="l12-bchip-v" id="l12PotLuckVal">${_potLuck ? ("+" + (_potLuck.flat || 0) + " L" + _potLuck.lv + (_luckBuffs.length > 1 ? " (+" + (_luckBuffs.length - 1) + ")" : "")) : (_adLuckMs > 0 ? "ADS 2&times;" : "OFF")}</span>
            </span>
            <span class="l12-bchip-cd"><span id="l12PotLuckTm">${_potLuck ? _cd(_potLuck.endsAt - _now) : (_adLuckMs > 0 ? _cd(_adLuckMs) : "--:--")}</span></span>
          </button>

          <button type="button" class="l12-bchip${_potSpeed ? " is-on" : ""}" id="l12PotSpeed"
                  data-block="pot-speed" style="--bc:var(--spd)" title="Speed Potions &amp; Buffs"
                  onclick="window.l12ToggleDockPanel('speed')">
            <span class="l12-bchip-ic"><img id="l12PotSpeedImg" src="assets/images/pot-speed-${_potSpeed ? _potSpeed.lv : 1}.webp" alt=""></span>
            <span class="l12-bchip-txt">
              <span class="l12-bchip-k">SPEED POT <span class="tag" id="l12PotSpeedStock">&times;${_spStock}</span></span>
              <span class="l12-bchip-v" id="l12PotSpeedVal">${_potSpeed ? ("+" + (_potSpeed.add || 0).toFixed(1) + "&times; L" + _potSpeed.lv + (_speedBuffs.length > 1 ? " (+" + (_speedBuffs.length - 1) + ")" : "")) : "OFF"}</span>
            </span>
            <span class="l12-bchip-cd"><span id="l12PotSpeedTm">${_potSpeed ? _cd(_potSpeed.endsAt - _now) : "--:--"}</span></span>
          </button>

          <button type="button" class="l12-bchip${_glActive ? " is-on" : ""}" id="l12Glw"
                  data-block="global-luck" style="--bc:var(--haz)" title="Global Luck Shrine"
                  onclick="window.l12ToggleDockPanel('global')">
            <span class="l12-bchip-ic">${_l12CloverSvg()}</span>
            <span class="l12-bchip-txt">
              <span class="l12-bchip-k">GLOBAL LUCK <span class="tag" id="l12GlStack">${_glStacks}/10</span></span>
              <span class="l12-bchip-v" id="l12GlMult">${_glActive ? (_glMult + "&times; LUCK") : "OFFLINE"}</span>
            </span>
            <span class="l12-bchip-cd"><span id="l12GlTm">${_glActive ? _cd(_glLeft) : "--:--"}</span></span>
          </button>

          <button type="button" class="l12-bchip${_w ? " is-on" : ""}" id="l12Wx"
                  data-block="weather" style="--bc:${_w ? _w.color : "#9ca3af"}" title="Weather Dock &amp; Exclusive Cards"
                  onclick="window.l12ToggleDockPanel('weather')">
            <span class="l12-bchip-ic" id="l12WxIcon"><img id="l12WxImg" src="${(typeof weatherPotionSrc === "function") ? weatherPotionSrc((_w && _w.id) || "clear", true) : "assets/images/thumb/weather-clear.webp?v=1"}" alt="" decoding="async"></span>
            <span class="l12-bchip-txt">
              <span class="l12-bchip-k">WEATHER <span class="tag" id="l12WxRr">${_wRr || "IDLE"}</span></span>
              <span class="l12-bchip-v" id="l12WxName">${_w ? String(_w.name || _wId).toUpperCase() : "CLEAR SKY"}</span>
            </span>
            <span class="l12-bchip-cd"><span id="l12WxTm">${_wLeft ? _cd(_wLeft) : "--:--"}</span><span class="stk" id="l12WxLkSub">${_w ? (_w.luckBonus + "&times; LK") : "IDLE"}</span></span>
          </button>
        </div>

        <div class="rollbar c12dock">
          <span class="rail rail-roll" aria-hidden="true"></span>
          <span class="l12-slot" id="slotRoll"></span>
          <span class="l12-slot" id="slotAuto"></span>
          <button class="sq c12sq" type="button" onclick="if(typeof toggleBackpack==='function')toggleBackpack();" title="Backpack / Deck">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7.4" width="16" height="13" rx="2"/><path d="M9 7.4V5.6a3 3 0 0 1 6 0v1.8"/></svg>
          </button>
          <button class="sq c12sq" type="button" onclick="if(typeof openPremiumShop==='function')openPremiumShop();" title="Premium Shop">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h2l2.2 10.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 9H7"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>
          </button>
          <button class="sq c12sq" type="button" onclick="location.hash='#/settings'" title="Settings">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>
    </div>
    </div>

    <!-- 5. Backdrop Overlay for Command Drawer -->
    <div id="drawerBackdrop" onclick="closeCommandDrawer()"></div>

    <!-- 6. Command Anchor Drawer v5 — hex tile hub (desain dikunci _tmp/proto_drawer_v5) -->
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
    </aside>
  </div>`;

  /* ---- TAHAP 2: dudukan node hidup ke slot v12 (teknik A) ----
     replaceWith(node) = node yang SAMA pindah, listener boot.js (#rollBtn) dan
     state panels.js tetap menempel; placeholder .l12-slot ikut hilang sehingga
     tidak ada id ganda. Dipanggil ulang tiap render karena innerHTML membuat
     slot baru dan node-nya ada di park. */
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

  /* Label "1 IN <chance>" di tombol ROLL DIHAPUS (perintah user 2026-11-06).
     Tombol kini hanya punya .roll-txt: "SUMMON" saat idle, "STOP" saat roll
     berjalan (dipasang dari kelas .active di css/mobile-shell.css), jadi tidak
     ada angka yang perlu diisi ulang di sini. */
  /* #footAv burger removed from header per user request */

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
    if (!document.querySelector(".lobby-hub.l12")) { clearInterval(_l12HudTick); _l12HudTick = null; return; }
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
      const rbCount = state.rebirthCount || 0;
      const rbMult = typeof rebirthLuckMult === 'function' ? rebirthLuckMult(rbCount) : (1 + rbCount * 0.5);
      rbSub.textContent = 'R' + rbCount + ' // LUCK ' + rbMult.toFixed(1) + 'x';
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
  bindClick('drwRaidBtn', () => { window.raidView = 'hub'; window.location.hash = '#/raid'; });
  bindClick('drwTowerBtn', () => { if (typeof stopTower === 'function') stopTower(); window.location.hash = '#/tower'; });
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
  bindClick('drwSettingsBtn', () => { location.hash = '#/settings'; });
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
      if (document.querySelector(".lobby-hub.l12")) renderLobby();
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
/* ========== HORIZONTAL REBIRTH MODAL ========== */
function renderRebirthModal(){
  const body = document.getElementById("rebirthBody");
  if (!body) return;
  const isEn = (typeof getLang === 'function' && getLang() === 'en') || (typeof state !== 'undefined' && state && state.lang === 'en');
  const cnt = typeof rebirthCount === 'function' ? rebirthCount() : 0;
  const es = typeof rebirthEssence === 'function' ? rebirthEssence() : 0;
  const th = typeof rebirthThreshold === 'function' ? rebirthThreshold() : 1000000;
  const mult = typeof rebirthLuckMult === 'function' ? rebirthLuckMult() : 1;
  const ready = es >= th;
  const pct = Math.max(0, Math.min(100, Math.round(es / th * 100)));
  const nextMult = mult + 1;
  const need = Math.max(0, th - es);
  const fmtEs = (typeof fmt === 'function' ? fmt(es) : es);
  const fmtTh = (typeof fmt === 'function' ? fmt(th) : th);
  const fmtNeed = (typeof fmt === 'function' ? fmt(need) : need);

  body.innerHTML = `
    <div class="rb-h-layout">
      <!-- COL 1: Visual Sigil / Ascension Core -->
      <div class="rb-col rb-col-sigil">
        <div class="rb-sigil-wrap">
          <div class="rb-sigil-rings">
            <div class="rb-ring r1"></div>
            <div class="rb-ring r2"></div>
            <div class="rb-ring r3"></div>
          </div>
          <div class="rb-sigil-art">
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor">
              <circle cx="50" cy="50" r="40" stroke="#7e22ce" stroke-width="1.8" stroke-dasharray="5 3" opacity="0.4"/>
              <path d="M78 50a28 28 0 1 1-9-20.8" stroke="url(#rbAscGrad)" stroke-width="3" stroke-linecap="round"/>
              <path d="M70 20l10 9-13 6" stroke="url(#rbAscGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="50" cy="50" r="14" fill="rgba(192,132,252,0.12)" stroke="#a855f7" stroke-width="1.6"/>
              <circle cx="50" cy="50" r="6" fill="#c084fc"/>
              <defs>
                <linearGradient id="rbAscGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#f5d0fe"/>
                  <stop offset="50%" stop-color="#c084fc"/>
                  <stop offset="100%" stop-color="#9333ea"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="rb-rank-badge">
            <span class="rb-rank-lbl">${isEn ? 'CURRENT CYCLE' : 'CURRENT CYCLE'}</span>
            <span class="rb-rank-val">R${cnt}</span>
          </div>
        </div>
        <div class="rb-sigil-meta">
          <span class="rb-cycle-tag">HUNTER ASCENSION</span>
          <span class="rb-cycle-sub">${isEn ? 'CYCLE RANK' : 'CYCLE RANK'} ${cnt} · LEVEL ${typeof state !== 'undefined' && state?.playerLv ? state.playerLv : 1}</span>
        </div>
      </div>

      <!-- COL 2: Telemetry & Mechanics Breakdown -->
      <div class="rb-col rb-col-info">
        <!-- Stat Transition Cards: CURRENT -> NEXT -->
        <div class="rb-mult-compare">
          <div class="rb-compare-box prev">
            <span class="rcb-tag">${isEn ? 'CURRENT PERK' : 'CURRENT BONUS'}</span>
            <span class="rcb-val">×${mult}</span>
            <span class="rcb-desc">${isEn ? 'LUCK MULTIPLIER' : 'PENGALI LUCK'}</span>
          </div>
          <div class="rb-compare-arrow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
          </div>
          <div class="rb-compare-box next">
            <span class="rcb-tag">${isEn ? 'NEXT ASCENSION' : 'NEXT ASCENSION'}</span>
            <span class="rcb-val">×${nextMult}</span>
            <span class="rcb-desc">${isEn ? '+100% PERMANENT BOOST' : '+100% PERMANENT BONUS'}</span>
          </div>
        </div>

        <!-- Progress & Fuel Bar -->
        <div class="rb-progress-card">
          <div class="rb-pc-head">
            <span class="rb-pc-lbl"><span class="rb-glow-dot"></span>${isEn ? 'ESSENCE POOL CHARGE' : 'ESSENCE POOL CHARGE'}</span>
            <span class="rb-pc-nums"><b>${fmtEs}</b> / ${fmtTh}</span>
          </div>
          <div class="rb-bar-wrap">
            <div class="rb-bar-fill" style="width: ${pct}%">
              <span class="rb-bar-glow"></span>
            </div>
          </div>
          <div class="rb-pc-foot">
            <span class="rb-foot-pct">${pct}% ${isEn ? 'CHARGED' : 'TERISI'}</span>
            <span class="rb-foot-need ${ready ? 'ready' : ''}">${ready ? (isEn ? '✓ THRESHOLD REACHED · READY TO ASCEND' : '✓ THRESHOLD REACHED · READY TO REBIRTH') : (isEn ? `NEED ${fmtNeed} MORE ESSENCE` : `BUTUH ${fmtNeed} MORE ESSENCE`)}</span>
          </div>
        </div>

        <!-- Info Protocol Pill -->
        <div class="rb-protocol-info">
          <div class="rb-pi-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
          </div>
          <div class="rb-pi-text">
            <b>${isEn ? 'HOW TO ACQUIRE ESSENCE:' : 'CARA MENDAPATKAN ESSENCE:'}</b> ${isEn ? 'Any duplicate cards obtained from Gacha Rolls or Instant Packs are automatically transmuted into Rebirth Essence without losing any Cards, Decks, or Levels.' : 'Setiap kartu duplikat yang didapat dari Gacha Roll atau Instant Pack otomatis diubah jadi Essence tanpa mengurangi Kartu, Dek, atau Level.'}
          </div>
        </div>
      </div>

      <!-- COL 3: Action & Rewards Confirmation -->
      <div class="rb-col rb-col-action">
        <div class="rb-action-head">
          <span class="rb-ah-status ${ready ? 'ready' : 'charging'}">
            <span class="rb-status-dot"></span>
            ${ready ? (isEn ? 'READY TO ASCEND' : 'READY TO REBIRTH') : (isEn ? 'CHARGING ESSENCE' : 'MENGISI ESSENCE')}
          </span>
          <span class="rb-ah-title">ASCENSION PROTOCOL</span>
        </div>

        <div class="rb-perks-list">
          <div class="rb-perk-item">
            <span class="rpi-check">✓</span>
            <span>${isEn ? '<b>Permanent:</b> Luck multiplier rises to ' : '<b>Permanent:</b> Luck multiplier rises to '}<b>×${nextMult}</b></span>
          </div>
          <div class="rb-perk-item">
            <span class="rpi-check">✓</span>
            <span>${isEn ? '<b>Safe:</b> Cards, Decks, Artefacts & Pets stay intact' : '<b>Aman:</b> Koleksi, Dek, Artefak & Pet tetap aman'}</span>
          </div>
          <div class="rb-perk-item">
            <span class="rpi-check">✓</span>
            <span>${isEn ? '<b>Prestige:</b> Rebirth rank showcased on Hunter Profile' : '<b>Rank:</b> Rebirth Rank shown on Hunter Profile'}</span>
          </div>
        </div>

        <button type="button" class="rb-execute-btn ${ready ? 'is-ready' : 'is-locked'}" id="rbExecBtn" onclick="executeRebirthFromModal()" ${ready ? '' : 'disabled'}>
          <span class="reb-btn-glow"></span>
          <span class="reb-btn-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2v20m-7-7 7-7 7 7"/></svg>
            <span>${ready ? (isEn ? 'ACTIVATE REBIRTH' : 'AKTIFKAN REBIRTH') : (isEn ? 'INSUFFICIENT ESSENCE' : 'NOT ENOUGH ESSENCE')}</span>
          </span>
          <span class="reb-btn-sub">${ready ? (isEn ? `ASCEND TO ×${nextMult} LUCK` : `RISE TO ×${nextMult} LUCK`) : `${pct}% ${isEn ? 'CHARGED' : 'TERISI'}`}</span>
        </button>
      </div>
    </div>
  `;
}

function openRebirthModal(){
  if (typeof sfx !== 'undefined' && sfx.hit) sfx.hit();
  renderRebirthModal();
  const modal = document.getElementById('rebirthModal');
  if (modal) modal.classList.add('show');
  document.body.classList.add('hide-docks-modal');
  const closeBtn = document.getElementById('rebirthClose');
  if (closeBtn) closeBtn.onclick = closeRebirthModal;
  if (modal) modal.onclick = function(e){ if(e.target === modal) closeRebirthModal(); };
}

function closeRebirthModal(){
  const modal = document.getElementById('rebirthModal');
  if (modal) {
    modal.classList.remove('show');
    modal.classList.remove('is-ascending');
    modal.style.zIndex = '';
  }
  document.body.classList.remove('hide-docks-modal');
  const cutin = document.getElementById('rebirthAscensionCutin');
  if (cutin) cutin.classList.remove('show');
}

function executeRebirthFromModal(){
  const isEn = (typeof getLang === 'function' && getLang() === 'en') || (typeof state !== 'undefined' && state && state.lang === 'en');
  if (typeof canRebirth !== 'function' || !canRebirth()) {
    const need = rebirthThreshold() - rebirthEssence();
    const fmtNeed = (typeof fmt === 'function' ? fmt(need) : need);
    if (typeof toast === 'function') {
      toast(
        isEn ? 'INSUFFICIENT ESSENCE' : 'NOT ENOUGH ESSENCE',
        isEn ? ('Need ' + fmtNeed + ' more essence') : ('Butuh ' + fmtNeed + ' lagi'),
        '#a855f7'
      );
    }
    return;
  }

  const oldMult = (typeof rebirthLuckMult === 'function') ? rebirthLuckMult() : 1;
  const oldCnt = (typeof rebirthCount === 'function') ? rebirthCount() : 0;
  const nextMult = oldMult + 1;
  const nextCnt = oldCnt + 1;

  // 1. Pastikan modal Rebirth berada di layer depan (z-index 100010) dan aktifkan state is-ascending
  const modalEl = document.getElementById('rebirthModal');
  if (modalEl) {
    modalEl.classList.add('is-ascending');
    modalEl.style.zIndex = '100010';
  }

  const execBtn = document.getElementById('rbExecBtn');
  if (execBtn) {
    execBtn.classList.add('is-ascending');
    execBtn.disabled = true;
    const btnSpan = execBtn.querySelector('.reb-btn-content span') || execBtn.querySelector('span');
    if (btnSpan) btnSpan.textContent = 'ASCENDING...';
  }

  const sigilWrap = document.querySelector('.rb-sigil-wrap');
  if (sigilWrap) sigilWrap.classList.add('is-charging');

  if (window.CyberSfx && typeof window.CyberSfx.rebirthAscendCharge === 'function') {
    window.CyberSfx.rebirthAscendCharge();
  } else if (typeof playSubBass === 'function') {
    playSubBass(50, 0.4, 0.3);
  }

  // 2. Fase burst (+500ms): jalankan doRebirth, update modal segera, taruh animasi cutscene di belakang modal
  setTimeout(() => {
    if (typeof doRebirth === 'function') doRebirth();

    // Re-render modal SEGERA saat burst agar pemain melihat nilai baru R{nextCnt} dan ×{nextMult} langsung menyala
    if (typeof renderRebirthModal === 'function') renderRebirthModal();

    // Pertahankan z-index dan class is-ascending pada modal & sigil yang baru dirender
    if (modalEl) {
      modalEl.classList.add('is-ascending');
      modalEl.style.zIndex = '100010';
    }
    const newSigil = document.querySelector('.rb-sigil-wrap');
    if (newSigil) newSigil.classList.add('is-charging');

    // Overlay cutin di layer BELAKANG modal Rebirth (z-index 100002)
    let cutin = document.getElementById('rebirthAscensionCutin');
    if (!cutin) {
      cutin = document.createElement('div');
      cutin.id = 'rebirthAscensionCutin';
      cutin.className = 'rb-cutin-backdrop';
      document.body.appendChild(cutin);
    }
    cutin.style.zIndex = '100002';
    cutin.style.pointerEvents = 'none';

    cutin.innerHTML = `
      <div class="rb-cutin-card">
        <div class="rb-cutin-pill"><span class="rb-cutin-dot"></span>SYSTEM OVERRIDE // QUANTUM ASCENSION PROTOCOL</div>
        <div class="rb-cutin-sigil-ring">
          <svg viewBox="0 0 100 100" class="rb-cutin-svg">
            <circle cx="50" cy="50" r="42" stroke="#c084fc" stroke-width="2" stroke-dasharray="6 4" opacity="0.6"/>
            <circle cx="50" cy="50" r="32" stroke="#ffd700" stroke-width="2.5" stroke-dasharray="10 6"/>
            <circle cx="50" cy="50" r="20" stroke="#7df9ff" stroke-width="2"/>
            <circle cx="50" cy="50" r="7" fill="#ffffff"/>
          </svg>
        </div>
        <div class="rb-cutin-title">REBIRTH ASCENSION</div>
        <div class="rb-cutin-cycle">CYCLE R${nextCnt}</div>
        <div class="rb-cutin-cycle-sub">${isEn ? 'CONSCIOUSNESS ELEVATED' : 'HIGHER CONSCIOUSNESS ACHIEVED'}</div>
        <div class="rb-cutin-mult">
          <span class="rcm-lbl">LUCK MULTIPLIER:</span>
          <span class="rcm-val">×${oldMult} <i class="rcm-arr">➔</i> <b>×${nextMult}</b></span>
          <span class="rcm-badge">+100% PERMANENT BOOST</span>
        </div>
      </div>
    `;

    cutin.classList.add('show');

    // VFX canvas partikel di layer belakang modal (z-index 100005)
    if (typeof window.playRebirthAscensionVfx === 'function') {
      window.playRebirthAscensionVfx(window.innerWidth / 2, window.innerHeight / 2);
      const cv = document.getElementById('pgrBattleFxCanvas');
      if (cv) cv.style.zIndex = '100005';
    }

    if (window.CyberSfx && typeof window.CyberSfx.rebirthAscendBoom === 'function') {
      window.CyberSfx.rebirthAscendBoom();
    } else if (typeof sfx !== 'undefined' && sfx.win) {
      sfx.win();
    }

    // Tampilkan notifikasi toast di layer terdepan (z-index 200000)
    if (typeof toast === 'function') {
      toast(
        isEn ? 'ASCENSION SUCCESS!' : 'REBIRTH BERHASIL!',
        isEn ? ('Luck multiplier increased permanently to ×' + nextMult) : ('Luck multiplier permanently rises to ×' + nextMult),
        '#c084fc'
      );
    }

    // 3. Fase resolusi (+2200ms)
    setTimeout(() => {
      if (cutin) cutin.classList.remove('show');
      if (modalEl) {
        modalEl.classList.remove('is-ascending');
        modalEl.style.zIndex = '';
      }
      const cv = document.getElementById('pgrBattleFxCanvas');
      if (cv) cv.style.zIndex = '';

      const sigilWrapEnd = document.querySelector('.rb-sigil-wrap');
      if (sigilWrapEnd) sigilWrapEnd.classList.remove('is-charging');

      if (typeof updateRebirthUI === 'function') updateRebirthUI();
      if (typeof renderShell === 'function') renderShell();
    }, 2200);

  }, 500);
}

window.openRebirthModal = openRebirthModal;
window.closeRebirthModal = closeRebirthModal;
window.renderRebirthModal = renderRebirthModal;
window.executeRebirthFromModal = executeRebirthFromModal;


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
