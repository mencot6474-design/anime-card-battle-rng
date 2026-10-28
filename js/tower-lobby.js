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
  {k:'r5k',  p:0.05,  name:'INSTAN ROLL 5.000',  icon:'assets/images/instanpack-5k.webp?v=trans1',  label:'5%'},
  {k:'r10k', p:0.02,  name:'INSTAN ROLL 10.000', icon:'assets/images/instanpack-10k.webp?v=trans1', label:'2%'},
  {k:'r25k', p:0.01,  name:'INSTAN ROLL 25.000', icon:'assets/images/instanpack-25k.webp?v=trans1', label:'1%'},
  {k:'r100k',p:0.005, name:'INSTAN ROLL 100.000',icon:'assets/images/instanpack-100k.webp?v=trans1',label:'0,5%'}
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
    if(loot&&loot.length)showTowerLoot(loot,towerRun.drops,null,{packDrops:towerRun.packDrops||{},rareDrops:towerRun.rareDrops||[]}); else toast("ROLL TOWER DITARIK","+"+n+" KARTU","#7df9ff");
  }
  towerView="hub"; towerRun=null;
}
function towerFoeHtml(w){
  const en=w.en,es=w.es,curHp=(w.hp!=null?w.hp:es.hp),pct=Math.max(0,Math.min(100,curHp/es.hp*100));
  const m=w.mut||(en&&en.mut)||'';
  return `<div class="fighter foe foe-enter${mutGlow(m)}"${mutEdge(m)} data-tier="${en.tier||''}">
    ${typeof foeFighterInnerHtml==="function"?foeFighterInnerHtml(en,es,{subtitle:en.epithet,curHp:curHp}):`
    <div class="f-banner"><img src="${en.img}" alt="${en.name}"><div class="f-name">${en.name}</div></div>
    <div class="hpbar"><i id="hpFoe" style="width:${pct}%"></i><span id="hpFoeT">${fmt(curHp)} / ${fmt(es.hp)}</span></div>
    <div class="f-body">
      <div class="f-title">${en.epithet}</div>
      <div class="f-skill">${en.id?passiveName(en.id):"Musuh"}</div>
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
  if(!state.tower)state.tower={best:0};
  towerRun={floor:1,waves:towerWaves(1),idx:0,cleared:0,cards:0,coins:0,drops:{weather:0,luck:0,speed:0},tokens:0,pendingRolls:0,packDrops:{},rareDrops:[]};
  towerView="battle";
  render();
}
function renderTower(){
  if(towerView==="battle"&&towerRun){renderTowerBattle();return;}
  if(towerView==="shop"){renderTowerShop();return;}
  renderTowerHub();
}
function towerPreviewCard(w,isBoss,role,idx){
  const id=w.eid, c=CARDS[id]; if(!c) return "";
  const tier=c.tier,bossBadge=isBoss&&idx===0;
  const waveNum=idx+1;
  return `<div class="tw-fcard${bossBadge?" bossx":""}" data-tier="${tier}">
    <div class="tw-fcard-inner">
      <div class="tw-fcard-top">
        <span class="tw-fcard-wave">WAVE 0${waveNum}</span>
        ${bossBadge?'<span class="fb bossx">⚠️ BOSS</span>':`<span class="tw-fcard-role">${role==="main"?"VANGUARD":"RESERVE"}</span>`}
      </div>
      <div class="tw-fcard-img">
        <img src="${c.sprite_asset}" alt="${c.name}"${c.pos?` style="object-position:${c.pos}"`:''}>
        <div class="tw-fcard-sweep"></div>
      </div>
      <div class="tw-fcard-meta">
        <span class="tw-fcard-type">${c.type || "COMBATANT"}</span>
        <span class="fn" title="${c.name}">${c.name}</span>
        <div class="fs"><span class="hp"><i>HP</i> <b>${fmtStat(w.es.hp)}</b></span><span class="atk"><i>ATK</i> <b>${fmtStat(w.es.atk)}</b></span></div>
      </div>
    </div>
  </div>`;
}
function renderTowerHub(){
  if(!state.tower)state.tower={best:0};
  const best=state.tower.best||0;
  const start=1;                       /* selalu mulai Lantai 1 */
  const boss=towerIsBossFloor(start);
  const waves=towerWaves(start);

  /* Tactical Spire Node List (Ala PGR / Honkai Star Rail Spire)
     Dinamis sampai rekor tertinggi pemain + sektor tantangan berikutnya */
  const maxFloor = Math.max(15, Math.ceil((best + 5) / 5) * 5);
  let fl="";
  for(let f=maxFloor; f>=1; f--){
    const isB = towerIsBossFloor(f);
    const isCurrent = f === start;
    const isCleared = f <= best;
    const isRecord = f === best && best > 0;
    const cls = (isCurrent ? "node-active" : (isCleared ? "node-cleared" : "node-locked")) + (isB ? " node-boss" : "");

    fl += `<div class="spire-node ${cls}">
      <div class="sn-left">
        <span class="sn-tag">${isB ? 'BOSS SECTOR' : 'SECTOR'}</span>
        <span class="sn-num">${String(f).padStart(2, "0")}</span>
      </div>
      <div class="sn-mid">
        <span class="sn-label">${isB ? 'CRITICAL ANOMALY' : 'SECURITY NODE'}</span>
        <span class="sn-status">${isCurrent ? 'DEPLOY READY' : (isCleared ? 'ANALYSIS COMPLETE' : 'ENCRYPTED')}</span>
      </div>
      <div class="sn-badge">
        ${isRecord ? '<span class="sn-rekor"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> REKOR</span>' : ''}
        ${isB ? '<span class="sn-boss-badge">HAZARD</span>' : (isCurrent ? '<span class="sn-curr-pulse"></span>' : '')}
      </div>
    </div>`;
  }

  app.innerHTML=`<div class="tw-page tactical-tower-page">
  <div class="tactical-tower-hub">
    
    <!-- SISI KIRI: SPIRE NODE STREAM (PGR / Star Rail Style) -->
    <aside class="spire-stream-panel">
      <div class="spire-stream-hdr">
        <div class="ssh-tag"><span class="ssh-dot"></span> SECTOR MATRIX</div>
        <div class="ssh-title">ASCENT STREAM</div>
      </div>
      <div class="spire-node-list">${fl}</div>
      <div class="spire-stream-ftr">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>CONTINUOUS RUN &middot; UNTIL DEFEAT</span>
      </div>
    </aside>

    <!-- SISI KANAN: TACTICAL MISSION DOSSIER -->
    <main class="tactical-dossier-panel">
      
      <!-- HEADER DOSSIER -->
      <div class="dossier-header">
        <div class="dh-titles">
          <div class="dh-kicker"><span class="dh-kicker-dot"></span>NEURAL SPIRE // INFINITE ASCENT PROTOCOL</div>
          <div class="dh-title">INFINITE <span class="dh-cyan">TOWER</span></div>
          <div class="dh-sub">ENDLESS VIRTUAL SPIRE PENETRATION FROM FLOOR 01 TO OVERLOAD</div>
        </div>
        <div class="dh-actions">
          <button class="dh-lobby-btn" id="towerLobby" type="button" title="Return to Lobby">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>LOBBY</span>
          </button>
        </div>
      </div>

      <!-- HUD TELEMETRY METRICS -->
      <div class="dossier-metrics">
        <div class="dm-card dm-best">
          <div class="dm-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
          <div class="dm-data">
            <span class="dm-label">RECORD HIGHEST</span>
            <b class="dm-val">FL.${String(best).padStart(2, "0")}</b>
            <span class="dm-sub-tag">${best>=50?'✦ APEX CLIMBER':(best>=25?'⚡ HIGH REACH':'STANDBY')}</span>
          </div>
        </div>
        <div class="dm-card dm-tokens">
          <div class="dm-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg></div>
          <div class="dm-data">
            <span class="dm-label">TOWER TOKENS</span>
            <b class="dm-val">${fmt(state.infTokens||0)}</b>
            <span class="dm-sub-tag">AVAILABLE DEPOSIT</span>
          </div>
        </div>
        <div class="dm-card dm-start">
          <div class="dm-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></div>
          <div class="dm-data">
            <span class="dm-label">START SECTOR</span>
            <b class="dm-val">FL.${String(start).padStart(2, "0")}</b>
            <span class="dm-sub-tag">READY TO ENGAGE</span>
          </div>
        </div>
      </div>

      <!-- ENCOUNTER TARGET DOSSIER (ENEMY LIST) -->
      <div class="dossier-sec">
        <div class="dossier-sec-hdr">
          <div class="dsh-left">
            <span class="dsh-bracket">[</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
            <span class="dsh-txt">TARGET PROTOCOL &middot; FLOOR ${start}</span>
            <span class="dsh-bracket">]</span>
          </div>
          <span class="dsh-status-tag">${boss?'⚠️ HAZARD: BOSS ENCOUNTER':'STANDARD WAVE QUEUE'}</span>
        </div>
        <div class="tw-foes">${waves.map((w,i)=>towerPreviewCard(w,boss,i===0?"main":"tag",i)).join("")}</div>
      </div>

      <!-- TACTICAL CLEAR REWARDS CHIPS -->
      <div class="dossier-sec">
        <div class="dossier-sec-hdr">
          <div class="dsh-left">
            <span class="dsh-bracket">[</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span class="dsh-txt">CLEARANCE SUPPLY MATRIX</span>
            <span class="dsh-bracket">]</span>
          </div>
          <button class="r-info-pill-btn" id="twDropRateBtn" type="button" title="View Drop Rate Probabilities">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>DROP PROBABILITY</span>
          </button>
        </div>
        <div class="rewards-summary-bar">
          <div class="r-chip r-chip-rolls">
            <span class="rc-dot c"></span>
            <div class="rc-info">
              <span class="rc-label">CARD ROLLS</span>
              <b>+100 Rolls / Floor</b>
            </div>
          </div>
          <div class="r-chip r-chip-tokens">
            <span class="rc-dot v"></span>
            <div class="rc-info">
              <span class="rc-label">TOWER TOKENS</span>
              <b>+1 Token (Boss +5)</b>
            </div>
          </div>
          <div class="r-chip r-chip-pots">
            <span class="rc-dot g"></span>
            <div class="rc-info">
              <span class="rc-label">POTION SUPPLY</span>
              <b>Drop 5% &ndash; 10%</b>
            </div>
          </div>
          <div class="r-chip r-chip-rare">
            <span class="rc-dot r"></span>
            <div class="rc-info">
              <span class="rc-label">ULTRA RARE</span>
              <b>Flame Sword &bull; Kyubi</b>
            </div>
          </div>
        </div>
      </div>

      <!-- ACTION BUTTONS: DUAL TACTICAL CTA -->
      <div class="dossier-actions">
        <button class="tactical-btn shop-cta" id="towerShop" type="button">
          <div class="tb-glow"></div>
          <div class="tb-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
          <div class="tb-content">
            <small>EXCHANGE MARKET</small>
            <b>TOWER SHOP</b>
          </div>
        </button>

        <button class="tactical-btn deploy-cta" id="towerGo" type="button">
          <div class="tb-glow"></div>
          <div class="tb-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          <div class="tb-content">
            <small>INITIALIZE RUN &middot; FLOOR ${start}</small>
            <b>INITIATE PENETRATION</b>
          </div>
          <div class="tb-chevrons"><span>&rsaquo;</span><span>&rsaquo;</span><span>&rsaquo;</span></div>
        </button>
      </div>

    </main>
  </div></div>`;

  const g=document.getElementById("towerGo");if(g)g.onclick=()=>{sfx.hit();towerStartRun();};
  const s=document.getElementById("towerShop");if(s)s.onclick=()=>{sfx.hit();towerView="shop";render();};
  const lb=document.getElementById("towerLobby");if(lb)lb.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};
  const dr=document.getElementById("twDropRateBtn");if(dr)dr.onclick=()=>{try{sfx.hit();}catch(e){}openTowerDropModal();};

  requestAnimationFrame(()=>{
    /* Fix: jangan pakai scrollIntoView — ikut men-scroll halaman/dokumen
       (akibatnya layar "ketarik ke atas" pas hub dibuka, khususnya di HP/APK).
       Scroll hanya di dalam .spire-node-list, pakai rumus manual. */
    const act=app.querySelector(".spire-node.node-active");
    const list=act?act.closest(".spire-node-list"):null;
    if(list&&act){
      const lr=list.getBoundingClientRect(),ar=act.getBoundingClientRect();
      const target=list.scrollTop+(ar.top-lr.top)-(list.clientHeight-ar.height)/2;
      list.scrollTop=Math.max(0,target);
    }
    window.scrollTo(0,0); /* pengaman: pastikan dokumen mulai dari posisi paling atas */
  });
}
function renderTowerShop(){
  if(!state.tower)state.tower={best:0};
  const tok=state.infTokens||0;
  /* Cyberpunk Vector Hologram Icons ala Sci-Fi AAA */
  const ICONS={
    weather:`<img src="assets/images/weather-potion.webp?v=1" alt="Weather Potion" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='🧪'">`,
    mythic:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(192,132,252,0.25)" stroke="#c084fc"/><circle cx="12" cy="12" r="3" stroke="#fff"/></svg>`,
    luck1:`<img src="${thumbSrc('assets/images/pot-luck-1.webp')}" alt="Luck Potion L1" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='🍀'">`,
    luck2:`<img src="${thumbSrc('assets/images/pot-luck-2.webp')}" alt="Luck Potion L2" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='🍀'">`,
    luck3:`<img src="${thumbSrc('assets/images/pot-luck-3.webp')}" alt="Luck Potion L3" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='🍀'">`,
    speed1:`<img src="${thumbSrc('assets/images/pot-speed-1.webp')}" alt="Speed Potion L1" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='⚡'">`,
    speed2:`<img src="${thumbSrc('assets/images/pot-speed-2.webp')}" alt="Speed Potion L2" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='⚡'">`,
    speed3:`<img src="${thumbSrc('assets/images/pot-speed-3.webp')}" alt="Speed Potion L3" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='⚡'">`,
    gem:`<img src="assets/images/premium-currency.webp" alt="Gems" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='💎'">`
  };

  /* Data item Cyberpunk Supply - FULL ENGLISH */
  const ITEMS=[
    {k:"gem",cat:"EXCHANGE",tier:"GEM",label:"TOKEN → GEM // 100:10",sub:"Exchange 100 TOWER TOKENS for 10 Premium GEMS. Repeatable without limits.",cost:100,gem:10,req:null,ac:"#ffd700"},
    {k:"weather",cat:"WEATHER",tier:"SPEC-A",label:"ATMOSPHERIC OVERRIDE",sub:"Force climate shift with native probability (5 minute duration).",cost:10,req:null,ac:"#00d9ff"},
    {k:"luck1",cat:"AUGMENT",tier:"MK-I",label:"NEURAL LUCK MK-I",sub:"+3 flat luck for 5 minutes. Stackable — duration increases +5 minutes per use.",cost:10,req:null,ac:"#00ffaa"},
    {k:"luck2",cat:"AUGMENT",tier:"MK-II",label:"NEURAL LUCK MK-II",sub:"+5 flat luck & +10% luck multiplier for 5 minutes. Stackable.",cost:50,req:null,ac:"#00ffaa"},
    {k:"luck3",cat:"AUGMENT",tier:"MK-III",label:"NEURAL LUCK MK-III",sub:"+10 flat luck & +20% luck multiplier for 5 minutes. Peak augmentation matrix.",cost:250,req:null,ac:"#00ffaa"},
    {k:"speed1",cat:"OVERCLOCK",tier:"MK-I",label:"CHRONO BOOSTER MK-I",sub:"Roll speed +0.2× (≈1.2×) for 5 minutes. Accelerates spire RNG cycle.",cost:10,req:null,ac:"#fbbf24"},
    {k:"speed2",cat:"OVERCLOCK",tier:"MK-II",label:"CHRONO BOOSTER MK-II",sub:"Roll speed +0.5× (≈1.5×) for 5 minutes. Accelerator synchronization overclock.",cost:50,req:null,ac:"#fbbf24"},
    {k:"speed3",cat:"OVERCLOCK",tier:"MK-III",label:"CHRONO BOOSTER MK-III",sub:"Roll speed +1.0× (2.0× instant) for 5 minutes. Maximum overdrive velocity.",cost:250,req:null,ac:"#fbbf24"}
  ];

  const stkOf=k=>k==="weather"?(state.potions||0):k.startsWith("luck")?(state.luckPots&&state.luckPots[+k.slice(-1)-1])||0:k.startsWith("speed")?(state.speedPots&&state.speedPots[+k.slice(-1)-1])||0:(state.mythicPotions||0);
  const cardOwned=it=>!!(it.unlock&&state.towerShopOwned&&state.towerShopOwned[it.unlock]);

  const cardsHtml=ITEMS.map(it=>{
    const isOwned=cardOwned(it);
    const canAfford=tok>=it.cost;
    const cnt=it.unlock?state.stacks.filter(s=>s.char===it.unlock).reduce((n,s)=>n+(s.count||1),0):(it.gem?0:stkOf(it.k));
    const dis=isOwned || !canAfford || (it.req && stkOf(it.req)<=0);
    const btnLabel=isOwned ? '✔ UNLOCKED' : (!canAfford ? `DEFICIT ${fmt(it.cost-tok)}` : (it.gem ? `EXCHANGE (+10 GEMS)` : `ACQUIRE SUPPLY`));

    return `
    <div class="tsh-h-card ${!canAfford&&!isOwned?'insufficient':''} ${isOwned?'owned':''}" style="--item-c:${it.ac}">
      <div class="thc-left">
        <div class="thc-art-box ${it.unlock?'boss-art':''}">
          <div class="thc-art-halo"></div>
          ${ICONS[it.k]||"🎁"}
          <div class="thc-art-sweep"></div>
        </div>
        <div class="thc-badges">
          <span class="thc-cat">${it.cat}</span>
          <span class="thc-tier">${it.tier}</span>
        </div>
      </div>

      <div class="thc-mid">
        <div class="thc-title-row">
          <div class="thc-name" title="${it.label}">${it.label}</div>
        </div>
        <div class="thc-desc">${it.sub}</div>
        <div class="thc-meta-row">
          <span class="thc-stock-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span>IN STOCK: <b>${it.unlock ? (cnt ? '×'+cnt : '0') : (it.gem ? '∞ UNLIMITED' : '×'+cnt)}</b></span>
          </span>
          ${it.gem ? '<span class="thc-perk-pill">✦ YIELD: +10 GEMS</span>' : ''}
        </div>
      </div>

      <div class="thc-right">
        <div class="thc-price-box">
          <span class="thc-price-lbl">EXCHANGE COST</span>
          <div class="thc-price-val"><b>${fmt(it.cost)}</b> <small>TOKENS</small></div>
        </div>
        <button class="thc-buy-btn ${dis?'disabled':''}" type="button" data-kind="${it.k}" ${dis?'disabled':''} title="${it.label}">
          <span class="thc-btn-scan"></span>
          <span class="thc-btn-txt">${btnLabel}</span>
          <span class="thc-btn-chev">&rsaquo;</span>
        </button>
      </div>
    </div>`;
  }).join("");

  app.innerHTML=`
  <div class="tw-page tactical-tower-page tactical-tower-shop-page">
    <div class="tactical-shop-hub horizontal-layout">

      <!-- TOP MARKET HEADER -->
      <header class="tsh-header">
        <div class="tsh-header-left">
          <button class="tsh-back-btn" id="towerShopBack" type="button" title="Return to Spire">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>RETURN TO SPIRE</span>
          </button>
          <div class="tsh-titles">
            <div class="tsh-kicker"><span class="tsh-kicker-dot"></span>NEURAL PROCUREMENT MATRIX // SPIRE DEPOT</div>
            <div class="tsh-title">TOWER <span class="tsh-cyan">MARKET</span></div>
            <div class="tsh-sub">TACTICAL SUPPLY CATALOG &bull; UNLIMITED SPIRE TOKEN EXCHANGE MATRIX</div>
          </div>
        </div>
        <div class="tsh-header-right">
          <div class="tsh-chip tsh-token-chip">
            <div class="tc-icon-wrap token-ic">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg>
            </div>
            <div class="tc-col"><small>TOWER TOKENS</small><b class="tsh-cyan">${fmt(tok)}</b></div>
          </div>
          <div class="tsh-chip tsh-gem-chip">
            <div class="tc-icon-wrap gem-ic">
              <img src="assets/images/premium-currency.webp" alt="Gems" width="16" height="16">
            </div>
            <div class="tc-col"><small>GEMS BALANCE</small><b class="tsh-gold">${fmt(state.premiumGems||0)}</b></div>
          </div>
        </div>
      </header>

      <!-- HORIZONTAL SUPPLY CATALOG GRID -->
      <main class="tsh-h-container">
        <div class="tsh-h-subhdr">
          <div class="ths-left">
            <span class="tsh-bracket">[</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span class="ths-txt">TACTICAL HORIZONTAL SUPPLY CATALOG</span>
            <span class="tsh-bracket">]</span>
          </div>
          <span class="ths-count-tag">${ITEMS.length} SUPPLIES AVAILABLE</span>
        </div>
        <div class="tsh-h-grid">${cardsHtml}</div>
      </main>

    </div>
  </div>`;

  const rb=document.getElementById("towerShopBack");
  if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}towerView="hub";render();};

  app.querySelectorAll(".thc-buy-btn").forEach(btn=>{
    btn.onclick=()=>{
      if(btn.disabled)return;
      const k=btn.dataset.kind;
      if(k){
        try{sfx.hit();}catch(e){}
        infBuy(k);
      }
    };
  });
}
function infBuy(kind){
  const cost={gem:100,weather:10,luck1:10,luck2:50,luck3:250,speed1:10,speed2:50,speed3:250,mythic:50}[kind]; if(cost==null)return;
  /* Kartu unlock permanen */
  const CARD_UNLOCK={} [kind];
  if(CARD_UNLOCK&&state.towerShopOwned&&state.towerShopOwned[CARD_UNLOCK]){toast("ALREADY UNLOCKED","Card roll is already permanently unlocked","#a78bfa");return;}
  if((state.infTokens||0)<cost){toast("INSUFFICIENT TOKENS","NOT ENOUGH TOWER TOKENS","#f87171");return;}
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
      if(res&&res.ok){
        if(typeof res.tokens==='number')state.infTokens=res.tokens;
        save(); try{beep(880,.12,"sine",.07);}catch(e){}
        toast("EXCHANGE SUCCESSFUL","-"+cost+" TOKENS · +"+(res.gems||GEM_AMT)+" GEMS","#ffd700");
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
    toast(label,CARD_UNLOCK?"-"+cost+" TOKENS · ROLL UNLOCKED":"-"+cost+" TOKENS","#c4b5fd");
    renderShell(); if(towerView==="shop")render();
  })();
}
function renderTowerBattle(){
  const w=towerRun.waves[towerRun.idx];
  if(!w){endBattle(true);return;}
  const eq=equipped(),st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  app.innerHTML=`
  <div class="battle-grid tower-stage">
  <div class="me-col">
    <div class="fighter me${eq?mutGlow(eq.mut):''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}"${eq?mutEdge(eq.mut):''}>${meFighterHtml(eq)}</div>
    ${benchHtml()}
  </div>
  <div class="vs-col"><div class="t">VS</div><div class="s" id="turnLabel">FLOOR <b>${towerRun.floor}</b> · ${towerIsBossFloor(towerRun.floor)?"BOSS ENCOUNTER":"WAVE <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"}</div><button class="bspeed-btn" id="bspeedBtn" type="button">1×</button></div>
  <div class="me-col foe-side" id="foeSide">${towerFoeSide(w)}</div>
  </div>`;
  wireSpeedBtn();
  clearFoeEnter();
  const meEl0=document.querySelector(".fighter.me"),foeEl0=document.querySelector(".fighter.foe");
  if(meEl0){meEl0.classList.add("tag-enter");setTimeout(()=>{try{meEl0.classList.remove("tag-enter");}catch(e){}},650);enterFx(meEl0);}
  if(foeEl0)enterFx(foeEl0);
  /* Infinite Tower: tanpa cut-in intro (langsung masuk arena tiap lantai) */
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
   if(tfx&&tfx.entryFreeze&&!foeStatusImmune()){bt.eStun=tfx.entryFreeze.turns;bt.freezeLeft=tfx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
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
    if(sfx.killHeal&&bt.pHp>0){const kh=Math.max(1,Math.round(bt.pMax*sfx.killHeal.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+kh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","HISAP DARAH +"+fmt(kh),"heal");},bsMs(340));}
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
  if(killed)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe",killed+" CADANGAN KO!","crit");},bsMs(900));
}
function advanceTowerFoe(){
  if(!bt||bt.over)return;
  bt.fgen=++FGEN;/* generasi musuh: cb basi dari kill sebelumnya bakal kebuang */
  do{towerRun.idx++;}while(towerRun.idx<towerRun.waves.length&&towerRun.waves[towerRun.idx]&&towerRun.waves[towerRun.idx].dead);
  if(towerRun.idx>=towerRun.waves.length){endBattle(true);return;}
  const w=towerRun.waves[towerRun.idx];
  bt.en=w.en;bt.es=w.es;bt.eid=w.eid;bt.efx=w.efx;bt.eHp=(w.hp!=null)?w.hp:w.es.hp;
  bt.openGuard=true;bt.eBurn=0;bt.eStun=0;bt.phase2used=false;bt.domainUsed=false;bt.domainLeft=0;bt.domainNow=false;
  {const rfx=resolveFx(bt.eq,bt.efx);if(rfx.dimensionShift)bt.eAbilityOff=rfx.dimensionShift.turns;}
    {const cfx=resolveFx(bt.eq,bt.efx);if(cfx.copy&&cfx.copy.turns)bt.copyLeft=cfx.copy.turns;}
  {const nfx=resolveFx(bt.eq,bt.efx);
   /* FOE ENTRY FREEZE (ICE QUEEN): musuh baru masuk -> bekukan turns giliran (pola entryFreeze, guard statusImmune) */
   if(nfx.foeEntryFreeze&&!foeStatusImmune()){bt.eStun=nfx.foeEntryFreeze.turns;bt.freezeLeft=nfx.foeEntryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
   /* FREEZE TRANSFER (ABSOLUTE ZERO): musuh ini mewarisi freeze dari target beku yang dibunuh sebelumnya */
   if(bt.freezeNext){bt.freezeNext=false;if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun,1);bt.freezeLeft=Math.max(bt.freezeLeft,1);setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(360));}}
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
    if(foeEl){enterFx(foeEl);}
    if(typeof applyFoeEntryPassives==="function")applyFoeEntryPassives();
    const tl=document.getElementById("turnLabel");if(tl)tl.innerHTML="FLOOR <b>"+towerRun.floor+"</b> · WAVE <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>";
    floatText(".fighter.foe","TAG-IN!","tagin");
    /* Musuh baru masuk = giliran MUSUH yang jalan. GET EXCITED satu-satunya yang menyela (serangan ekstra pemain). */
    if(bt.excited){bt.excited=false;floatText(".fighter.foe","EXTRA ATTACK!","crit");schedPhase(1000,playerPhase);}else{schedPhase(1000,enemyPhase);}
  },bsMs(2000));
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
function showTowerLoot(results,drops,title,extra){
  const pop=document.getElementById("rollResultPop");if(!pop)return;
  results=results||[];
  const d=drops||{weather:0,luck:0,speed:0};
  const ex=extra||{};
  const POTION=[{k:'weather',name:'WEATHER',icon:'assets/images/weather-potion.webp?v=1',emoji:'🧪'},{k:'luck',name:'LUCK',icon:'assets/images/pot-luck-1.webp',emoji:'🍀'},{k:'speed',name:'SPEED',icon:'assets/images/pot-speed-1.webp',emoji:'⚡'}];
  const totalPot=POTION.reduce((s,p)=>s+(d[p.k]||0),0);
  /* Chips Instan Pack + artefak/pet dari drop Tower (icon ASLI dari backpack). */
  const packChips=TOWER_PACK_DROPS.filter(p=>(ex.packDrops&&ex.packDrops[p.k])>0).map(p=>{const n=ex.packDrops[p.k]||0;return `<div class="twr-loot-chip" title="${p.name}"><span class="twr-loot-ic"><img src="${p.icon}" alt="${p.name}" onerror="this.onerror=null;this.parentNode.textContent='📦'"></span><span class="twr-loot-name">${p.name}</span>${n>1?`<span class="twr-loot-cnt">×${n}</span>`:''}</div>`;}).join("");
  /* Icon artefak/pet: ambil dari definisi BACKPACK (ART_DEFS/PET_DEFS) supaya identik dgn tile backpack. */
  const rareChips=(ex.rareDrops||[]).map(r=>{
    let icon=r.icon||"";
    try{
      if(r.kind==='art'&&typeof ART_DEFS!=="undefined"){const d=ART_DEFS.find(x=>x.id===r.id);if(d&&d.img)icon=d.img;}
      else if(r.kind==='pet'&&typeof PET_DEFS!=="undefined"){const d=PET_DEFS.find(x=>x.id===r.id);if(d&&d.img)icon=d.img;}
    }catch(e){}
    if(!icon)icon='assets/images/icon-index-card.webp';
    const fb=r.kind==='pet'?'🐾':(r.kind==='art'?'◈':'✦');
    return `<div class="twr-loot-chip rare" title="${r.name}"><span class="twr-loot-ic"><img src="${icon}" alt="${r.name}" onerror="this.onerror=null;this.parentNode.textContent='${fb}'"></span><span class="twr-loot-name">${r.name}</span></div>`;
  }).join("");
  const lootChips=(packChips||rareChips)?`<div class="twr-loot-wrap">${packChips}${rareChips}</div>`:"";
  const totalPack=TOWER_PACK_DROPS.reduce((s,p)=>s+((ex.packDrops&&ex.packDrops[p.k])||0),0);
  if(!results.length&&!totalPot&&!totalPack&&!rareChips)return;
  const potChips=POTION.filter(p=>(d[p.k]||0)>0).map(p=>{const n=d[p.k]||0;return `<div class="rrc rrc-potion" title="${p.name} POTION"><i class="rrc-sizer"></i><span class="rrc-pot-ic"><img src="${p.icon}" alt="${p.name}" onerror="this.parentNode.textContent='${p.emoji}'"></span>${n>1?`<span class="rrc-cnt">×${n}</span>`:''}<span class="rrc-name">${p.name}</span></div>`;}).join("");
  const groups={};
  results.forEach(r=>{const key=r.cardId+"|"+(r.mut||"none")+"|"+(r.shiny||"none");{const g=(groups[key]||(groups[key]={cardId:r.cardId,tier:r.tier,mut:r.mut||"none",shiny:!!(r.shiny&&r.shiny!=="none"),n:0}));g.n+=(typeof r.n==="number"?r.n:1);}});
  const list=Object.values(groups).sort((a,b)=>luckChance(b.cardId,b.mut,b.shiny)-luckChance(a.cardId,a.mut,a.shiny)||b.n-a.n);
  const totalCards=(typeof results.totalPulls==="number")?results.totalPulls:results.length;
  document.getElementById("rrTotal").textContent=fmt(totalCards)+" cards"+(list.length?" · "+list.length+" unique":"")+(totalPot?" · "+fmt(totalPot)+" potions":"")+(totalPack?" · "+fmt(totalPack)+" packs":"");
  document.getElementById("rrBody").innerHTML=lootChips+potChips+list.map(g=>{
    const name=cardName(g.cardId),img=cardThumb(g.cardId);
    const isShiny=g.shiny&&g.shiny!=="none", isMut=g.mut&&g.mut!=="none";
    const mut=isMut?g.mut:null;
    let rc="rrc";if(isMut)rc+=" mut-"+g.mut;if(isShiny)rc+=" shiny";
    const chanceVal=luckChance(g.cardId,g.mut,g.shiny);
    const chanceText="1 in "+fmtChance(chanceVal);
    const tier=g.tier||cardTier(g.cardId)||"";
    const chanceColor=mut?MUT_COLOR[mut]:((tier&&TIER_COLOR[tier])||"var(--sl-cyan,#00d9ff)");
    return `<div class="${rc} sl-item" data-tier="${tier}">
      <i class="rrc-sizer"></i>
      <div class="rrc-glow"></div>
      <img src="${img}" alt="${name}" title="${name}" onerror="this.style.display='none'">
      ${g.n>1?`<span class="rrc-cnt">×${g.n}</span>`:''}
      <div class="rrc-footer">
        <span class="rrc-chance-text" style="color:${chanceColor}">${chanceText}</span>
      </div>
    </div>`;
  }).join("");
  {const rt=document.getElementById("rrTitle");if(rt)rt.textContent=title||"TOWER RUN SPOILS";}
  pop.classList.add("show");
  try{armRollPopAutoClose(5000);}catch(e){} /* auto-claim 5 detik: gak nahan AFK / auto-run tower */
}

/* =============== DECK =============== */
let filter="ALL", deckSearch="", raidSearch="", dpSearch="";
function runCardSearch(inp, grid, nr){
  if(!inp||!grid)return;
  const q=(inp.value||"").trim().toLowerCase();
  let vis=0;
  grid.querySelectorAll("[data-name]").forEach(el=>{const hit=!q||(el.getAttribute("data-name")||"").indexOf(q)>=0;el.style.display=hit?"":"none";if(hit)vis++;});
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
        <button class="md-btn primary" id="md-use">${(function(){const di=state.deck.indexOf(s.id);return di>=0?("DI DEK · SLOT "+(di+1)):"PASANG KE DEK";})()}</button>
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
  if(!eq||!eq.char||!CARDS[eq.char]) return `<div class="hub-center"${idAttr||''}><div class="hc-info"><div class="hc-name">Belum ada kartu</div></div></div>`;
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
    ? `<div class="loadout-slot pet-slot filled" data-bp="pet" role="button" tabindex="0" title="Pet aktif — kelola di Backpack" style="--ac:#8fd3ff">
        <span class="tile-frame" aria-hidden="true"></span>
        <span class="ls-tag">PET</span>
        ${lobbyPetHtml()}
      </div>`
    : `<div class="loadout-slot pet-slot empty" data-bp="pet" role="button" tabindex="0" title="Slot pet — kosong">
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
    <div class="hub-box h-rebirth hub-link hub-link-rebirth${ready?' ready':''}" id="hubRebirth" role="button" title="Rebirth: tukar essence duplikat jadi luck permanen">
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
  if (typeof saveState === 'function') saveState();

  const layer = document.getElementById('stageBgLayer');
  if (layer) {
    layer.style.opacity = '0.25';
    setTimeout(() => {
      layer.style.backgroundImage = 'url("' + LOBBY_BGS[nextKey].src + '")';
      layer.style.opacity = '1';
    }, 160);
  }
  if (typeof showToast === 'function') showToast('LOBBY: ' + LOBBY_BGS[nextKey].name);
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
  if (typeof saveState === 'function') saveState();

  const plate = document.getElementById('heroCardPlate');
  const frameSvg = document.getElementById('heroFrameSvg');
  const cfg = LOBBY_FRAMES[nextKey];
  if (plate) plate.className = 'hero-card-plate ' + cfg.theme;
  if (frameSvg) {
    if (cfg.src) {
      frameSvg.style.display = 'block';
      frameSvg.src = cfg.src;
    } else {
      frameSvg.style.display = 'none';
    }
  }
  if (typeof showToast === 'function') showToast('FRAME: ' + cfg.name);
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
    <div class="hero-standee-wrap" id="heroStandeeWrap" onclick="if(window.sfx&&sfx.hit)sfx.hit();if(typeof toggleBackpack==='function')toggleBackpack();" title="Pilih Hunter di Deck">
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
  <div class="hero-standee-wrap" id="heroStandeeWrap" onclick="if(window.sfx&&sfx.hit)sfx.hit();if(typeof toggleBackpack==='function')toggleBackpack();" title="Klik Hunter untuk Kelola Party &amp; Deck">
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

  function anim() {
    if (!document.getElementById('ambientCanvas')) return;
    ctx.clearRect(0, 0, cw, ch);
    for (let p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) p.y = ch + 10;
      if (p.x < -10) p.x = cw + 10;
      if (p.x > cw + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.fill();
    }
    _ambientCanvasAnimId = requestAnimationFrame(anim);
  }
  anim();
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
function renderLobby(){
  if(state.battle){
    if(typeof cleanupCommandDrawer==='function') cleanupCommandDrawer();
    return renderBattle();
  }
  const _oldDrw = document.getElementById('commandDrawer');
  if(_oldDrw && _oldDrw.parentElement === document.body) _oldDrw.remove();
  const _oldBd = document.getElementById('drawerBackdrop');
  if(_oldBd && _oldBd.parentElement === document.body) _oldBd.remove();
  document.body.classList.remove('drawer-open');
  const eq = equipped();
  const activeBg = getLobbyActiveBg();

  app.innerHTML = `
  <div class="lobby-hub stage-root" id="stage">
    <!-- 1. Cinematic AAA Anime Landscape Background Layer -->
    <div class="stage-bg-layer" id="stageBgLayer" style="background-image: url('${activeBg}');"></div>
    <div class="stage-vignette"></div>
    <div class="distant-skyline"></div>
    <div class="floor-fog"></div>
    <canvas id="ambientCanvas"></canvas>

    <!-- 2. Live Ticking Telemetry Feed (Top Left) -->
    <div class="telemetry-feed" id="telemetryFeed">
      <span id="telCoords">POS: 35.689 // 139.692</span>
      <span id="telSync">NEURAL SYNC: 99.4%</span>
      <span id="telFreq">CARRIER: 142.80 MHz</span>
    </div>

    <!-- 3. The Living Anime Hero Standee (PURE AAA - ZERO CLUTTER) -->
    <main class="hero-stage-container" id="heroStage">
      ${hubLivingStandeeHtml(eq)}


    </main>

    <!-- 4. Minimalist Right-Edge Tactical Command Trigger Handle -->
    <div class="cmd-trigger-btn" id="cmdTriggerBtn" title="Buka Command Terminal (M / Swipe Kiri)" onclick="openCommandDrawer()">
      <div class="cmd-icon-core">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      <span class="cmd-trigger-label">COMMAND</span>
    </div>

    <!-- 5. Backdrop Overlay for Command Drawer -->
    <div id="drawerBackdrop" onclick="closeCommandDrawer()"></div>

    <!-- 6. Archon Command Drawer (The Living Swipe Menu) -->
    <aside id="commandDrawer">
      <div class="drw-head">
        <div class="drw-title-wrap">
          <div class="drw-eyebrow">
            <span class="live-dot"></span>
            <span>TACTICAL HUD // ARCHON COMMAND ONLINE</span>
          </div>
          <div class="drw-title">ARCHON COMMAND TERMINAL</div>
        </div>
        <button class="drw-close-btn" id="drwCloseBtn" onclick="closeCommandDrawer()" title="Tutup (ESC / Swipe Kanan)">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="drw-body">
        <!-- 1. OPERASI TEMPUR UTAMA -->
        <section>
          <div class="cat-header">
            <span class="cat-title">OPERASI TEMPUR UTAMA</span>
            <span class="cat-meta">COMBAT DEPLOYMENT</span>
          </div>

          <!-- Banner 1: Story Campaign -->
          <div class="hero-banner-card menu-card stagger-in" style="--stagger: 1;" id="drwStoryBtn">
            <img class="banner-frame-svg" src="assets/frames/frame-holo-banner.svg" alt="Frame" />
            <div class="banner-bg" style="background-image: url('assets/images/story-bab3-shibuya.webp');"></div>
            <div class="banner-overlay"></div>
            <div class="specular-shine"></div>
            <div class="banner-content">
              <div class="banner-left">
                <div class="banner-icon-pod glow-cyan">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polygon>
                    <line x1="13" y1="19" x2="19" y2="13"></line>
                    <line x1="16" y1="16" x2="20" y2="20"></line>
                    <line x1="19" y1="21" x2="21" y2="19"></line>
                  </svg>
                </div>
                <div class="banner-info">
                  <div class="banner-badge-row">
                    <span class="banner-tag tag-cyan">STORY CAMPAIGN // CHAPTERS</span>
                    <span id="drwStoryPercent" style="font-family:var(--font-mono);font-size:11px;color:#38bdf8;font-weight:700">ACTIVE</span>
                  </div>
                  <div class="banner-title">STORY CAMPAIGN</div>
                  <div class="banner-metric-row">
                    <span class="bm-val" id="missionSub" style="color:#ffffff">PROGRESS</span>
                    <span style="color:var(--text-dim)">•</span>
                    <span style="color:#fbbf24;font-weight:700">CLEARANCE REWARDS</span>
                  </div>
                  <div class="banner-progress-wrap">
                    <div class="banner-progress-fill fill-cyan" id="missionFill" style="width: 50%;"></div>
                  </div>
                </div>
              </div>
              <div class="banner-cta">
                <span>MASUK</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>

          <!-- Banner 2: World Boss Raid -->
          <div class="hero-banner-card menu-card stagger-in" style="--stagger: 2;" id="drwRaidBtn">
            <img class="banner-frame-svg" src="assets/frames/frame-holo-banner.svg" alt="Frame" />
            <div class="banner-bg" style="background-image: url('assets/raid/raid-banner-hd.webp');"></div>
            <div class="banner-overlay"></div>
            <div class="specular-shine"></div>
            <div class="banner-content">
              <div class="banner-left">
                <div class="banner-icon-pod glow-crimson">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="22" y1="12" x2="18" y2="12"></line>
                    <line x1="6" y1="12" x2="2" y2="12"></line>
                    <line x1="12" y1="6" x2="12" y2="2"></line>
                    <line x1="12" y1="22" x2="12" y2="18"></line>
                    <circle cx="12" cy="12" r="4"></circle>
                  </svg>
                </div>
                <div class="banner-info">
                  <div class="banner-badge-row">
                    <span class="banner-tag tag-crimson"><span class="live-dot" style="background:#fb7185"></span>GLOBAL RAID // LIVE</span>
                    <span style="font-family:var(--font-mono);font-size:11px;color:#fb7185;font-weight:700">SHARED HP</span>
                  </div>
                  <div class="banner-title">WORLD BOSS RAID</div>
                  <div class="banner-metric-row">
                    <span class="bm-val" style="color:#ffffff">SHADOW DRAGON</span>
                    <span style="color:var(--text-dim)">•</span>
                    <span style="color:#fb7185;font-weight:700">TOP 10% LOOT</span>
                  </div>
                  <div class="banner-progress-wrap">
                    <div class="banner-progress-fill fill-crimson" style="width: 68%;"></div>
                  </div>
                </div>
              </div>
              <div class="banner-cta">
                <span>DEPLOY</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>

          <!-- Tactical Split Cards: Infinite Spire & Leaderboard -->
          <div class="op-split-grid">
            <div class="op-card menu-card stagger-in" style="--stagger: 3;" id="drwTowerBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Holo Glass Frame" />
              <div class="specular-shine"></div>
              <div class="op-top-row">
                <div class="op-icon-pod glow-purple">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <span class="banner-tag tag-purple">NEURAL SPIRE</span>
              </div>
              <div class="op-info">
                <div class="op-title">INFINITE TOWER</div>
                <span class="op-metric">CLIMB NEURAL FLOORS</span>
              </div>
            </div>

            <div class="op-card menu-card stagger-in" style="--stagger: 4;" id="drwRankBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Holo Glass Frame" />
              <div class="specular-shine"></div>
              <div class="op-top-row">
                <div class="op-icon-pod glow-gold">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                    <path d="M4 22h16"></path>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                  </svg>
                </div>
                <span class="banner-tag tag-gold">GLOBAL RANK</span>
              </div>
              <div class="op-info">
                <div class="op-title" style="color:#fbbf24">LEADERBOARD</div>
                <span class="op-metric" style="color:#fbbf24">TOP HUNTERS CLASSIFIED</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. AKTIVITAS HARIAN & BOOSTER -->
        <section>
          <div class="cat-header">
            <span class="cat-title">AKTIVITAS HARIAN &amp; BOOSTER</span>
            <span class="cat-meta">DAILY OPERATIONS</span>
          </div>

          <div class="modular-grid">
            <!-- 7-Day Login -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 5;" id="drwDailyBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-emerald">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                  <polyline points="9 16 11 18 15 13"></polyline>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">7-Day Login</span>
                  <span class="banner-tag tag-emerald">HARIAN</span>
                </div>
                <span class="pod-sub" id="drwDailySub">KLAIM REWARD HARIAN</span>
              </div>
            </div>

            <!-- Free Ads & Luck Booster -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 6;" id="drwAdsBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-gold">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  <line x1="19" y1="5" x2="19" y2="19"></line>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">Free 2x Luck</span>
                  <span class="banner-tag tag-gold">BOOST</span>
                </div>
                <span class="pod-sub" id="drwAdsSub">FREE 2X LUCK &amp; PACK</span>
              </div>
            </div>

            <!-- Global Luck -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 7;" id="drwGlBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-cyan">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">Global Luck</span>
                  <span class="banner-tag tag-cyan">SERVER</span>
                </div>
                <span class="pod-sub" id="drwGlSub">PENGALI LUCK KOMUNITAS</span>
              </div>
            </div>

            <!-- Weather Machine -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 8;" id="drwWeatherBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-cyan">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path>
                  <polyline points="13 11 9 17 15 17 11 23"></polyline>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">Weather Synth</span>
                  <span class="banner-tag tag-cyan">CLIMATE</span>
                </div>
                <span class="pod-sub" id="drwWeatherSub">ATMOSPHERIC BUFF</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. SISTEM & ARSIP -->
        <section>
          <div class="cat-header">
            <span class="cat-title">SISTEM &amp; ARSIP</span>
            <span class="cat-meta">SYSTEM &amp; GEAR</span>
          </div>

          <div class="modular-grid">
            <!-- Trait Overclock -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 9;" id="drwTraitBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-gold">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                  <rect x="9" y="9" width="6" height="6"></rect>
                  <line x1="9" y1="1" x2="9" y2="4"></line>
                  <line x1="15" y1="1" x2="15" y2="4"></line>
                  <line x1="9" y1="20" x2="9" y2="23"></line>
                  <line x1="15" y1="20" x2="15" y2="23"></line>
                  <line x1="20" y1="9" x2="23" y2="9"></line>
                  <line x1="20" y1="14" x2="23" y2="14"></line>
                  <line x1="1" y1="9" x2="4" y2="9"></line>
                  <line x1="1" y1="14" x2="4" y2="14"></line>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">Trait Overclock</span>
                  <span class="banner-tag tag-gold">REFINE</span>
                </div>
                <span class="pod-sub">OPTIMASI STAT PASIF</span>
              </div>
            </div>

            <!-- Neural Archive -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 10;" id="drwIndexBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-cyan">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  <line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="8" y1="10" x2="14" y2="10"></line>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">Neural Archive</span>
                  <span class="banner-tag tag-cyan">DATABASE</span>
                </div>
                <span class="pod-sub">KATALOG KARTU</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. FASILITAS & ASCENSION -->
        <section>
          <div class="cat-header">
            <span class="cat-title">FASILITAS &amp; ASCENSION</span>
            <span class="cat-meta">SPECIAL PROTOCOLS</span>
          </div>

          <div class="modular-grid">
            <!-- Premium Shop -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 11;" id="drwPremiumBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-gold">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="6 3 18 3 22 9 12 22 2 9 6 3"></polygon>
                  <line x1="12" y1="22" x2="6" y2="9"></line>
                  <line x1="12" y1="22" x2="18" y2="9"></line>
                  <line x1="2" y1="9" x2="22" y2="9"></line>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">Supply Shop</span>
                  <span class="banner-tag tag-gold">VIP</span>
                </div>
                <span class="pod-sub">INSTANT ROLL PACKS</span>
              </div>
            </div>

            <!-- Rebirth Protocol -->
            <div class="mod-pod menu-card stagger-in" style="--stagger: 12;" id="drwRebirthBtn">
              <img class="pod-frame-svg" src="assets/frames/frame-holo-pod.svg" alt="Frame" />
              <div class="specular-shine"></div>
              <div class="pod-icon-wrap glow-crimson">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
              </div>
              <div class="pod-content">
                <div class="pod-head">
                  <span class="pod-name">Rebirth Protocol</span>
                  <span class="banner-tag tag-crimson">REBIRTH</span>
                </div>
                <span class="pod-sub" id="drwRebirthSub">PENGALI SINGULARITAS</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  </div>`;

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
      if (ms) ms.textContent = done + ' / ' + tot + ' SELESAI';
      if (fill) fill.style.width = ratio + '%';
      if (percentEl) percentEl.textContent = ratio + '% COMPLETE';
    }
  } catch(e) {}

  // 2. 7-Day Login status
  try {
    const dailySub = document.getElementById('drwDailySub');
    if (dailySub) {
      const isReady = (typeof state !== 'undefined' && state && typeof todayStr === 'function') ? (state.lastClaim !== todayStr()) : false;
      dailySub.textContent = isReady ? 'SIAP DIKLAIM!' : 'SUDAH DIKLAIM HARI INI';
      dailySub.style.color = isReady ? '#34d399' : '#64748b';
    }
  } catch(e) {}

  // 3. Free Ads status
  try {
    const adsSub = document.getElementById('drwAdsSub');
    if (adsSub) {
      const luckMs = typeof adLuckLeftMs === 'function' ? adLuckLeftMs() : 0;
      if (luckMs > 0) {
        adsSub.textContent = '2x LUCK AKTIF (' + Math.ceil(luckMs / 60000) + 'm)';
        adsSub.style.color = '#fbbf24';
      } else {
        adsSub.textContent = 'TONTON ADS UNTUK 2x LUCK';
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
        glSub.textContent = (gl.multiplier || 2) + 'x LUCK AKTIF';
        glSub.style.color = '#38bdf8';
      } else {
        glSub.textContent = 'PENGALI LUCK SERVER';
      }
    }
  } catch(e) {}

  // 5. Weather Synth status
  try {
    const wSub = document.getElementById('drwWeatherSub');
    if (wSub && typeof state !== 'undefined' && state && state.weather) {
      wSub.textContent = 'CUACA: ' + (state.weather.name || state.weather.type || 'CLEAR').toUpperCase();
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
  bindClick('drwIndexBtn', () => { if (typeof openIndex === 'function') openIndex(); });
  bindClick('drwPremiumBtn', () => { if (typeof openPremiumShop === 'function') openPremiumShop(); });
  bindClick('drwRebirthBtn', () => { if (typeof onRebirthClick === 'function') onRebirthClick(); });

  // Initialize interactive engines
  initAmbientCanvas();
  initKineticParallax();
  initTelemetryTicker();
  initCommandDrawerGestures();
  if (typeof initAAAInteractiveSuite === 'function') initAAAInteractiveSuite();
}


/* ========== TOGGLE BACKPACK FUNCTION ========== */
function toggleBackpack() {
  const panel = document.getElementById('backpackPanel');
  if (!panel) return;

  const isVisible = document.body.classList.contains('bp-open') || panel.classList.contains('open') || (panel.style.display !== 'none' && panel.style.display !== '');

  if (isVisible) {
    /* Close: refresh lobby di belakang biar hub card & bench ikut perubahan dek. */
    document.body.classList.remove('bp-open');
    panel.classList.remove('open');
    bpTarget = null;
    bpItemPopClose();
    panel.style.opacity = '0';
    panel.style.transform = 'translate(-50%, -45%) scale(0.95)';
    setTimeout(() => { panel.style.display = 'none'; render(); }, 250);
  } else {
    /* Open */
    document.body.classList.add('bp-open');
    panel.classList.add('open');
    renderBackpackPanel();
    panel.style.display = 'flex';

    setTimeout(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);

    beep(520, 0.1, 'triangle', 0.07);
  }
}

/* ========== MODAL BREAKDOWN DROP RATE INFINITE TOWER ==========
   Redesign minimalis: 3 blok ringkas (PASTI / INSTAN PACK / ARTEFAK & PET).
   Semua ikon pakai file ASLI yang sudah ada (backpack/premium shop), bukan emoji. */
const TWR_CARD_ICON="assets/images/icon-index-card.webp";
const TWR_TOKEN_ICON="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237df9ff' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 6v12M8 10h8M8 14h6'/%3E%3C/svg%3E";
function openTowerDropModal(){
  const m = document.getElementById("towerDropModal");
  const body = document.getElementById("towerDropModalBody");
  if(!m || !body) return;

  const guarItems = [
    {name:"INSTANT CARD ROLLS", rate:"100× GUARANTEED", sub:"100 card rolls banked per floor · rolled upon defeat", icon:TWR_CARD_ICON, cls:"guar"},
    {name:"TOWER TOKENS", rate:"GUARANTEED", sub:"+1 regular floor · +5 boss floor (every 5 floors)", icon:TWR_TOKEN_ICON, cls:"guar"},
    {name:"WEATHER POTION", rate:"5%", sub:"Randomizes active weather (5 minute duration)", icon:"assets/images/weather-potion.webp?v=1", cls:""},
    {name:"LUCK POTION L1", rate:"10%", sub:"+3 Flat Luck for 5 minutes (stackable)", icon:"assets/images/pot-luck-1.webp", cls:""},
    {name:"SPEED POTION L1", rate:"10%", sub:"+0.2× Roll Speed for 5 minutes (stackable)", icon:"assets/images/pot-speed-1.webp", cls:""}
  ];

  const packItems = TOWER_PACK_DROPS.map(p=>({
    name: p.name,
    rate: p.label,
    sub: "Automatically stored in Backpack ITEMS tab",
    icon: p.icon,
    cls: "pack"
  }));

  body.innerHTML = `
    <div class="tw-drop-h-deck">
      <!-- COL 1: GUARANTEED & POTIONS -->
      <div class="tw-col tw-col-guar">
        <div class="tw-col-head">
          <span class="tw-col-pill guar"><span class="tw-dot"></span>GUARANTEED & POTIONS</span>
          <h3 class="tw-col-title">EVERY FLOOR REWARDS</h3>
        </div>
        <div class="tw-col-list">
          ${guarItems.map(it=>`
            <div class="tw-item-row">
              <span class="tw-item-ic"><img src="${it.icon}" alt="${it.name}" onerror="this.parentNode.textContent='✦'"></span>
              <span class="tw-item-txt">
                <span class="tw-item-name">${it.name}</span>
                <span class="tw-item-sub">${it.sub}</span>
              </span>
              <span class="tw-item-rate ${it.cls}">${it.rate}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- COL 2: RANDOM PACK DROPS -->
      <div class="tw-col tw-col-pack">
        <div class="tw-col-head">
          <span class="tw-col-pill pack"><span class="tw-dot"></span>RANDOM PACK DROPS</span>
          <h3 class="tw-col-title">INSTANT ROLL PACKS</h3>
        </div>
        <div class="tw-col-list">
          ${packItems.map(it=>`
            <div class="tw-item-row">
              <span class="tw-item-ic"><img src="${it.icon}" alt="${it.name}" onerror="this.parentNode.textContent='📦'"></span>
              <span class="tw-item-txt">
                <span class="tw-item-name">${it.name}</span>
                <span class="tw-item-sub">${it.sub}</span>
              </span>
              <span class="tw-item-rate ${it.cls}">${it.rate}</span>
            </div>
          `).join("")}
        </div>
        <div class="tw-col-foot-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>
          <span>Ready to use anytime in your Backpack</span>
        </div>
      </div>

      <!-- COL 3: ULTRA RARE / TROPHY -->
      <div class="tw-col tw-col-rare">
        <div class="tw-col-head">
          <span class="tw-col-pill rare"><span class="tw-dot"></span>ULTRA RARE / TROPHY</span>
          <h3 class="tw-col-title">MYTHIC ARTIFACTS & PETS</h3>
        </div>
        <div class="tw-col-trophy-list">
          <!-- Pedang Api -->
          <div class="tw-trophy-card art">
            <div class="tw-tc-art">
              <img src="assets/artifacts/pedang-api.webp" alt="Flame Sword" onerror="this.parentNode.textContent='⚔️'">
            </div>
            <div class="tw-tc-info">
              <div class="tw-tc-top">
                <span class="tw-tc-type">PERMANENT ARTIFACT</span>
                <span class="tw-tc-rate ultra">0.1% · 1 in 1k</span>
              </div>
              <div class="tw-tc-name">FLAME SWORD</div>
              <div class="tw-tc-perks">
                <span class="tw-perk-badge"><small>FLAT</small> <b>+120 LUCK</b></span>
                <span class="tw-perk-badge"><small>MULT</small> <b>+100% (×2)</b></span>
              </div>
              <div class="tw-tc-desc">Permanent relic (max 1). Luck bonus active forever.</div>
            </div>
          </div>

          <!-- Kyubi Fox -->
          <div class="tw-trophy-card pet">
            <div class="tw-tc-art">
              <img src="assets/pets/kyubi.webp" alt="Kyubi Fox" onerror="this.parentNode.textContent='🦊'">
            </div>
            <div class="tw-tc-info">
              <div class="tw-tc-top">
                <span class="tw-tc-type">MYTHIC PET</span>
                <span class="tw-tc-rate ultra">0.01% · 1 in 10k</span>
              </div>
              <div class="tw-tc-name">KYUBI FOX</div>
              <div class="tw-tc-perks">
                <span class="tw-perk-badge"><small>FLAT</small> <b>+200 LUCK</b></span>
                <span class="tw-perk-badge"><small>MULT</small> <b>+300% (×4)</b></span>
              </div>
              <div class="tw-tc-desc">Mystical companion (max 1). Highest luck multiplier.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ticker Footer Bar -->
    <div class="tw-drop-footer-bar">
      <div class="tw-df-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
        <span>All drops calculated <b>per cleared floor</b>. Instant Pack, Artifact & Pet odds are <b>Pure Base Rates</b> (not affected by player Luck).</span>
      </div>
    </div>
  `;

  m.classList.add("show");
  beep(480, 0.08, "triangle", 0.06);

  const closeBtn = document.getElementById("twDropModalClose");
  if(closeBtn) closeBtn.onclick = closeTowerDropModal;
  m.onclick = (e)=>{ if(e.target === m) closeTowerDropModal(); };
}

function closeTowerDropModal(){
  const m = document.getElementById("towerDropModal");
  if(!m) return;
  m.classList.remove("show");
  beep(360, 0.07, "triangle", 0.05);
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
            <span class="rb-rank-lbl">${isEn ? 'CURRENT CYCLE' : 'SIKLUS SAAT INI'}</span>
            <span class="rb-rank-val">R${cnt}</span>
          </div>
        </div>
        <div class="rb-sigil-meta">
          <span class="rb-cycle-tag">HUNTER ASCENSION</span>
          <span class="rb-cycle-sub">${isEn ? 'CYCLE RANK' : 'PANGKAT SIKLUS'} ${cnt} · LEVEL ${typeof state !== 'undefined' && state?.playerLv ? state.playerLv : 1}</span>
        </div>
      </div>

      <!-- COL 2: Telemetry & Mechanics Breakdown -->
      <div class="rb-col rb-col-info">
        <!-- Stat Transition Cards: CURRENT -> NEXT -->
        <div class="rb-mult-compare">
          <div class="rb-compare-box prev">
            <span class="rcb-tag">${isEn ? 'CURRENT PERK' : 'BONUS SAAT INI'}</span>
            <span class="rcb-val">×${mult}</span>
            <span class="rcb-desc">${isEn ? 'LUCK MULTIPLIER' : 'PENGALI LUCK'}</span>
          </div>
          <div class="rb-compare-arrow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
          </div>
          <div class="rb-compare-box next">
            <span class="rcb-tag">${isEn ? 'NEXT ASCENSION' : 'KENAIKAN BERIKUTNYA'}</span>
            <span class="rcb-val">×${nextMult}</span>
            <span class="rcb-desc">${isEn ? '+100% PERMANENT BOOST' : '+100% BONUS PERMANEN'}</span>
          </div>
        </div>

        <!-- Progress & Fuel Bar -->
        <div class="rb-progress-card">
          <div class="rb-pc-head">
            <span class="rb-pc-lbl"><span class="rb-glow-dot"></span>${isEn ? 'ESSENCE POOL CHARGE' : 'PENGISIAN POOL ESSENCE'}</span>
            <span class="rb-pc-nums"><b>${fmtEs}</b> / ${fmtTh}</span>
          </div>
          <div class="rb-bar-wrap">
            <div class="rb-bar-fill" style="width: ${pct}%">
              <span class="rb-bar-glow"></span>
            </div>
          </div>
          <div class="rb-pc-foot">
            <span class="rb-foot-pct">${pct}% ${isEn ? 'CHARGED' : 'TERISI'}</span>
            <span class="rb-foot-need ${ready ? 'ready' : ''}">${ready ? (isEn ? '✓ THRESHOLD REACHED · READY TO ASCEND' : '✓ AMBANG TERCAPAI · SIAP REBIRTH') : (isEn ? `NEED ${fmtNeed} MORE ESSENCE` : `BUTUH ${fmtNeed} ESSENCE LAGI`)}</span>
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
            ${ready ? (isEn ? 'READY TO ASCEND' : 'SIAP REBIRTH') : (isEn ? 'CHARGING ESSENCE' : 'MENGISI ESSENCE')}
          </span>
          <span class="rb-ah-title">ASCENSION PROTOCOL</span>
        </div>

        <div class="rb-perks-list">
          <div class="rb-perk-item">
            <span class="rpi-check">✓</span>
            <span>${isEn ? '<b>Permanent:</b> Luck multiplier rises to ' : '<b>Permanen:</b> Luck multiplier naik ke '}<b>×${nextMult}</b></span>
          </div>
          <div class="rb-perk-item">
            <span class="rpi-check">✓</span>
            <span>${isEn ? '<b>Safe:</b> Cards, Decks, Artefacts & Pets stay intact' : '<b>Aman:</b> Koleksi, Dek, Artefak & Pet tetap aman'}</span>
          </div>
          <div class="rb-perk-item">
            <span class="rpi-check">✓</span>
            <span>${isEn ? '<b>Prestige:</b> Rebirth rank showcased on Hunter Profile' : '<b>Pangkat:</b> Rank Rebirth tampil di Profil Hunter'}</span>
          </div>
        </div>

        <button type="button" class="rb-execute-btn ${ready ? 'is-ready' : 'is-locked'}" id="rbExecBtn" onclick="executeRebirthFromModal()" ${ready ? '' : 'disabled'}>
          <span class="reb-btn-glow"></span>
          <span class="reb-btn-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2v20m-7-7 7-7 7 7"/></svg>
            <span>${ready ? (isEn ? 'ACTIVATE REBIRTH' : 'AKTIFKAN REBIRTH') : (isEn ? 'INSUFFICIENT ESSENCE' : 'ESSENCE KURANG')}</span>
          </span>
          <span class="reb-btn-sub">${ready ? (isEn ? `ASCEND TO ×${nextMult} LUCK` : `NAIK KE ×${nextMult} LUCK`) : `${pct}% ${isEn ? 'CHARGED' : 'TERISI'}`}</span>
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
  if (modal) modal.classList.remove('show');
  document.body.classList.remove('hide-docks-modal');
}

function executeRebirthFromModal(){
  const isEn = (typeof getLang === 'function' && getLang() === 'en') || (typeof state !== 'undefined' && state && state.lang === 'en');
  if (typeof canRebirth !== 'function' || !canRebirth()) {
    const need = rebirthThreshold() - rebirthEssence();
    const fmtNeed = (typeof fmt === 'function' ? fmt(need) : need);
    if (typeof toast === 'function') {
      toast(
        isEn ? 'INSUFFICIENT ESSENCE' : 'ESSENCE KURANG',
        isEn ? ('Need ' + fmtNeed + ' more essence') : ('Butuh ' + fmtNeed + ' lagi'),
        '#a855f7'
      );
    }
    return;
  }
  doRebirth();
  const mult = rebirthLuckMult();
  if (typeof sfx !== 'undefined' && sfx.win) sfx.win();
  if (typeof toast === 'function') {
    toast(
      isEn ? 'ASCENSION SUCCESS!' : 'REBIRTH BERHASIL!',
      isEn ? ('Luck multiplier increased permanently to ×' + mult) : ('Luck multiplier naik permanen ke ×' + mult),
      '#c084fc'
    );
  }
  renderRebirthModal();
  if (typeof updateRebirthUI === 'function') updateRebirthUI();
  if (typeof renderShell === 'function') renderShell();
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
