/* =============== TOWER (menara tanpa ujung) ===============
   Mode endless: lantai naik terus, tiap 5 lantai = gerbang BOS (2 gelombang: utama + TAG).
   Memakai engine battle cerita (2 arah, passive musuh) dengan flag bt.tower. */
const TOWER_BOSS_ROSTER=[
  {main:"CH_SHADOW_MONARCH",tag:"CH_RULER"},   /* lantai 5, 15, 25 ... */
  {main:"CH_ALMIGHTY_TYRANT",tag:"CH_DEMON_SLIME"} /* lantai 10, 20, 30 ... */
];
function towerIsBossFloor(f){return f%5===0;}
function towerBossIndex(f){return ((f/5)-1)%TOWER_BOSS_ROSTER.length;}
function towerHash(n){return (((n*2654435761)>>>0)%100000)||0;}
/* Pool musuh menara: semua kartu non-eksklusif + gate kartu BOSS (sama dgn roll: terkunci sebelum dibeli). */
function towerRegularPool(){return MASTER_CARD_INDEX.filter(c=>!c.noGacha&&(!c.raidBoss||bossRollUnlocked(c.char_id)));}
/* Kurva kesulitan absolut (tidak ikut membengkak oleh stat mentah kartu EX).
   Kartu musuh hanya menentukan identitas/art/passive; HP & ATK ditentukan lantai.
   TIER itu kosmetik — tidak ada lagi stat scaling berdasarkan tier. */
const TOWER_TIER_K={R:1,SR:1,SSR:1,UR:1,EX:1};
function towerEnemyHP(f){return Math.round(140*Math.pow(1.18,f-1));}
function towerEnemyATK(f){return Math.round(58*Math.pow(1.16,f-1));}
function towerMakeWave(charId,f,isBoss,role){
  const c=CARDS[charId];
  if(!c)return null;
  const hpK=isBoss?(role==="main"?2.2:1.4):1;
  const atkK=isBoss?(role==="main"?1.35:1.15):1;
  const tk=TOWER_TIER_K[c.tier]||1;
  const es={hp:Math.round(towerEnemyHP(f)*hpK*tk),atk:Math.round(towerEnemyATK(f)*atkK*tk)};
  const eid=charId,efx=PASSIVE_FX[eid]||{};
  const en={id:eid,name:c.name,epithet:isBoss?(role==="main"?"BOS LANTAI":"PENJAGA TAG"):c.type,img:c.sprite_asset,boss:!!isBoss,tier:c.tier,mut:"none"};
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
    if(loot&&loot.length)showTowerLoot(loot,towerRun.drops); else toast("ROLL TOWER DITARIK","+"+n+" KARTU","#7df9ff");
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
      <div class="stat-row"><div class="stat">&#9825; ${fmt(es.hp)}</div><div class="stat">${ATKIC} ${fmt(es.atk)}</div></div>
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
  towerRun={floor:1,waves:towerWaves(1),idx:0,cleared:0,cards:0,coins:0,drops:{weather:0,luck:0,speed:0},tokens:0,pendingRolls:0};
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
  return `<div class="tw-fcard${bossBadge?" bossx":""}" data-tier="${tier}" style="animation-delay:${-idx*0.7}s">
    <img src="${c.sprite_asset}" alt="${c.name}"${c.pos?` style="object-position:${c.pos}"`:''}>
    <span class="fn">${c.name}</span>
    ${bossBadge?'<span class="fb">BOSS</span>':''}
    <span class="fs"><span class="hp"><i>HP</i> <b>${fmt(w.es.hp)}</b></span><span class="atk"><i>ATK</i> <b>${fmt(w.es.atk)}</b></span></span>
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
    const nodeStatus = isCurrent ? "ACTIVE" : (isCleared ? "CLEARED" : "LOCKED");
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
    <section class="spire-stream-panel">
      <div class="spire-stream-hdr">
        <div class="ssh-tag"><span class="ssh-dot"></span> SECTOR TOPOLOGY</div>
        <div class="ssh-title">ASCENT STREAM</div>
      </div>
      <div class="spire-node-list">${fl}</div>
      <div class="spire-stream-ftr">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>CONTINUOUS RUN &middot; UNTIL DEFEAT</span>
      </div>
    </section>

    <!-- SISI KANAN: TACTICAL MISSION DOSSIER -->
    <section class="tactical-dossier-panel">
      
      <!-- HEADER DOSSIER -->
      <div class="dossier-header">
        <div class="dh-titles">
          <div class="dh-kicker">NEURAL MATRIX // INFINITE ASCENT PROTOCOL</div>
          <div class="dh-title">INFINITE <span class="dh-cyan">TOWER</span></div>
          <div class="dh-sub">PENETRASI MENARA VIRTUAL TANPA BATAS DARI LANTAI 01 HINGGA OVERLOAD</div>
        </div>
        <button class="dh-lobby-btn" id="towerLobby" type="button" title="Kembali ke Lobby">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span>LOBBY</span>
        </button>
      </div>

      <!-- HUD TELEMETRY METRICS -->
      <div class="dossier-metrics">
        <div class="dm-card dm-best">
          <div class="dm-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
          <div class="dm-data">
            <span class="dm-label">RECORD HIGHEST</span>
            <b class="dm-val">FL.${String(best).padStart(2, "0")}</b>
          </div>
        </div>
        <div class="dm-card dm-tokens">
          <div class="dm-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg></div>
          <div class="dm-data">
            <span class="dm-label">TOKEN INF</span>
            <b class="dm-val">${fmt(state.infTokens||0)}</b>
          </div>
        </div>
        <div class="dm-card dm-start">
          <div class="dm-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></div>
          <div class="dm-data">
            <span class="dm-label">START SECTOR</span>
            <b class="dm-val">FL.${String(start).padStart(2, "0")}</b>
          </div>
        </div>
      </div>

      <!-- ENCOUNTER TARGET DOSSIER (ENEMY LIST) -->
      <div class="dossier-sec">
        <div class="dossier-sec-hdr">
          <span class="dsh-bracket">[</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
          <span class="dsh-txt">TARGET PROTOCOL &middot; LANTAI ${start}</span>
          <span class="dsh-bracket">]</span>
        </div>
        <div class="tw-foes">${waves.map((w,i)=>towerPreviewCard(w,boss,i===0?"main":"tag",i)).join("")}</div>
      </div>

      <!-- TACTICAL CLEAR REWARDS CHIPS -->
      <div class="dossier-sec">
        <div class="dossier-sec-hdr">
          <span class="dsh-bracket">[</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <span class="dsh-txt">CLEARANCE SUPPLY MATRIX</span>
          <span class="dsh-bracket">]</span>
          <button class="r-info-pill-btn" id="twDropRateBtn" type="button" title="Lihat Probabilitas Drop Rate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>DROP RATE</span>
          </button>
        </div>
        <div class="rewards-summary-bar">
          <div class="r-chip"><span class="rc-dot c"></span> <b>+25 Roll</b> (Tabungan)</div>
          <div class="r-chip"><span class="rc-dot v"></span> <b>+1 Token</b> (Boss +5)</div>
          <div class="r-chip"><span class="rc-dot g"></span> <b>Potion Supply</b> (Weather/Luck/Speed)</div>
        </div>
      </div>

      <!-- ACTION BUTTONS: DUAL TACTICAL CTA -->
      <div class="dossier-actions">
        <button class="tactical-btn shop-cta" id="towerShop" type="button">
          <div class="tb-glow"></div>
          <div class="tb-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
          <div class="tb-content">
            <small>EXCHANGE MARKET</small>
            <b>TOKO INF</b>
          </div>
        </button>

        <button class="tactical-btn deploy-cta" id="towerGo" type="button">
          <div class="tb-glow"></div>
          <div class="tb-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          <div class="tb-content">
            <small>INITIALIZE RUN &middot; FLOOR ${start}</small>
            <b>MULAI PENETRASI</b>
          </div>
        </button>
      </div>

    </section>
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
  /* Cyberpunk Vector Hologram Icons ala Sci-Fi AAA (Honkai / PGR / Cyberpunk 2077) */
  const ICONS={
    weather:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m13 13-3 5h4l-2 5" stroke="#7df9ff"/></svg>`,
    mythic:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(192,132,252,0.25)" stroke="#c084fc"/><circle cx="12" cy="12" r="3" stroke="#fff"/></svg>`,
    luck1:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12" stroke="#5cf0a8"/><circle cx="12" cy="12" r="4" fill="rgba(92,240,168,0.2)" stroke="#5cf0a8"/></svg>`,
    luck2:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-5-6.5 5 2-7.5-5.5-4.5h7z" fill="rgba(92,240,168,0.2)" stroke="#5cf0a8"/><path d="M12 8v8M8 12h8" stroke="#fff"/></svg>`,
    luck3:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.5 8.5 22 9.5 17 14.5 18.5 21 12 17.5 5.5 21 7 14.5 2 9.5 8.5 8.5 12 2" fill="rgba(92,240,168,0.3)" stroke="#5cf0a8"/><circle cx="12" cy="12" r="5" stroke="#fff"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`,
    speed1:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(255,210,122,0.2)" stroke="#ffd27a"/></svg>`,
    speed2:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(255,210,122,0.3)" stroke="#ffd27a"/><line x1="4" y1="4" x2="9" y2="4" stroke="#fff"/><line x1="2" y1="8" x2="6" y2="8" stroke="#fff"/></svg>`,
    speed3:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(255,210,122,0.4)" stroke="#ffd27a"/><path d="M19 4l3 3-3 3M15 14l3 3-3 3" stroke="#fff"/></svg>`
  };

  /* Data item Cyberpunk Supply */
  const ITEMS=[
    {k:"weather",cat:"WEATHER",tier:"SPEC-A",label:"ATMOSPHERIC OVERRIDE",sub:"Memaksa cuaca berganti dengan peluang asli (durasi 5 menit). Bila cuaca baru memiliki tingkat rarity sama atau lebih tinggi, durasi di-reset.",cost:10,req:null,ac:"#7df9ff"},
    {k:"luck1",cat:"AUGMENT",tier:"MK-I",label:"NEURAL LUCK MK-I",sub:"+3 flat luck selama 5 menit. Stackable — durasi bertambah +5 menit tiap injeksi serum.",cost:10,req:null,ac:"#5cf0a8"},
    {k:"luck2",cat:"AUGMENT",tier:"MK-II",label:"NEURAL LUCK MK-II",sub:"+5 flat luck & +10% luck multiplier selama 5 menit. Stackable — durasi bertambah +5 menit.",cost:50,req:null,ac:"#5cf0a8"},
    {k:"luck3",cat:"AUGMENT",tier:"MK-III",label:"NEURAL LUCK MK-III",sub:"+10 flat luck & +20% luck multiplier selama 5 menit. Matrix augmentasi maksimal.",cost:250,req:null,ac:"#5cf0a8"},
    {k:"speed1",cat:"OVERCLOCK",tier:"MK-I",label:"CHRONO BOOSTER MK-I",sub:"Roll speed +0.2× (≈1.2×) selama 5 menit. Mempercepat siklus putaran RNG mesin menara.",cost:10,req:null,ac:"#ffd27a"},
    {k:"speed2",cat:"OVERCLOCK",tier:"MK-II",label:"CHRONO BOOSTER MK-II",sub:"Roll speed +0.5× (≈1.5×) selama 5 menit. Overclock sinkronisasi akselerator.",cost:50,req:null,ac:"#ffd27a"},
    {k:"speed3",cat:"OVERCLOCK",tier:"MK-III",label:"CHRONO BOOSTER MK-III",sub:"Roll speed +1.0× (2.0× instan) selama 5 menit. Siklus overdrive kecepatan tertinggi.",cost:250,req:null,ac:"#ffd27a"}
  ];
  const stkOf=k=>k==="weather"?(state.potions||0):k.startsWith("luck")?(state.luckPots&&state.luckPots[+k.slice(-1)-1])||0:k.startsWith("speed")?(state.speedPots&&state.speedPots[+k.slice(-1)-1])||0:(state.mythicPotions||0);
  if(window.shopSel==null||window.shopSel>=ITEMS.length)window.shopSel=0;
  let swapT=null;

  const renderList=()=>{
    const listEl=document.getElementById("shopList");
    if(!listEl)return;
    listEl.innerHTML=ITEMS.map((it,i)=>`
      <div class="cps-row${i===window.shopSel?" sel":""}" data-i="${i}" style="--item-ac:${it.ac}">
        <div class="cps-row-accent"></div>
        <div class="cps-ic">${ICONS[it.k]||""}</div>
        <div class="cps-info">
          <div class="cps-cat"><span class="cps-tier">${it.tier}</span> &middot; ${it.cat}</div>
          <div class="cps-name">${it.label}</div>
        </div>
        <div class="cps-cost-col">
          <div class="cps-cost-val">${it.cost} <small>TOKEN</small></div>
          ${stkOf(it.k)>0?`<span class="cps-stock-badge">OWN &times;${stkOf(it.k)}</span>`:""}
        </div>
      </div>`).join("");
    document.querySelectorAll(".cps-row").forEach(r=>r.onclick=()=>{window.shopSel=+r.dataset.i;renderList();renderDetail();});
  };

  const renderBuy=()=>{
    const it=ITEMS[window.shopSel],btn=document.getElementById("shopBuy");
    if(!btn)return;
    btn.style.animation="none";void btn.offsetWidth;btn.style.animation="";
    let small="OTORISASI TRANSAKSI",big=`ACQUIRE &middot; ${it.cost} TOKEN`,dis=false;
    if(tok<it.cost){small="SALDO TOKEN TIDAK CUKUP";big=`DEFISIT ${it.cost-tok} TOKEN`;dis=true;}
    else if(it.req&&stkOf(it.req)<=0){small="KOMPONEN DASAR DIPERLUKAN";big="BUTUH 1 WEATHER POTION";dis=true;}
    btn.disabled=dis;
    btn.className="cyber-buy-btn" + (dis?" disabled":"");
    btn.innerHTML=`
      <div class="cbb-glow"></div>
      <div class="cbb-ic">${ICONS[it.k]||""}</div>
      <div class="cbb-text">
        <small>${small}</small>
        <b>${big}</b>
      </div>
      <div class="cbb-arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>`;
  };

  const renderDetail=immediate=>{
    const it=ITEMS[window.shopSel],box=document.getElementById("shopDetail");
    if(!box)return;
    clearTimeout(swapT);
    const paint=()=>{
      box.classList.remove("out");
      box.innerHTML=`
      <div class="sd-cyber-hero" style="--hero-ac:${it.ac}">
        <div class="sd-hero-ic-wrap">${ICONS[it.k]||""}</div>
        <div class="sd-hero-meta">
          <div class="sd-hero-tag"><span class="sd-hero-tier">${it.tier}</span> PROTOCOL // ${it.cat}</div>
          <div class="sd-hero-name">${it.label}</div>
        </div>
      </div>
      <div class="sd-cyber-spec">
        <div class="sd-spec-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> PARAMETER EFEK</div>
        <p class="sd-spec-desc">${it.sub}</p>
      </div>
      <div class="sd-cyber-matrix" style="--mat-ac:${it.ac}">
        <div class="scm-row"><span class="scm-k">HARGA PENUKARAN</span><span class="scm-v cyan">${it.cost} TOKEN INF</span></div>
        <div class="scm-row"><span class="scm-k">CADANGAN AMUNISI</span><span class="scm-v green">&times;${stkOf(it.k)} UNIT</span></div>
        ${it.req?`<div class="scm-row"><span class="scm-k">PERSYARATAN SINTESIS</span><span class="scm-v ${stkOf(it.req)>0?"green":"red"}">${stkOf(it.req)>0?"TERSEDIA &times;"+stkOf(it.req)+" WEATHER":"BUTUH 1 WEATHER POTION"}</span></div>`:""}
        <div class="scm-row"><span class="scm-k">STATUS DEPOSIT</span><span class="scm-v">${tok} / ${it.cost} TOKEN</span></div>
      </div>`;
      renderBuy();
    };
    if(immediate||!box.children.length){paint();return;}
    box.classList.add("out");
    swapT=setTimeout(paint,120);
  };

  app.innerHTML=`<div class="tw-page tactical-tower-page">
  <div class="tactical-shop-hub">
    
    <!-- SISI KIRI: CATALOG SUPPLY GRID -->
    <section class="cyber-shop-catalog">
      <div class="csc-header">
        <div class="csc-header-left">
          <button class="cyber-back-pill" id="shopBack" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            <span>KEMBALI KE SPIRE</span>
          </button>
          <div class="csc-title-wrap">
            <span class="csc-kicker"><span class="csc-dot"></span> NEURAL PROCUREMENT // LEVEL 01+</span>
            <div class="csc-title">TACTICAL <span class="csc-cyan">SUPPLY DEPOT</span></div>
          </div>
        </div>
        <div class="csc-header-right">
          <div class="csc-deposit-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg>
            <div class="cdc-col"><small>TOKEN INF</small><b>${fmt(tok)}</b></div>
          </div>
        </div>
      </div>

      <!-- ITEM LIST STREAM -->
      <div class="cyber-item-stream" id="shopList"></div>
      
      <div class="csc-footer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>TOKEN DIPEROLEH DARI SETIAP LANTAI PENETRASI SPIRE (+1 BIASA / +5 BOS SEKTOR)</span>
      </div>
    </section>

    <!-- SISI KANAN: INSPECTION & DOSSIER PANEL -->
    <section class="cyber-shop-dossier">
      <div class="csd-head">
        <div class="csd-kicker">TERMINAL INSPECTION // ITEM DOSSIER</div>
        <div class="csd-title">LOGISTICAL <span class="csd-cyan">OVERVIEW</span></div>
      </div>

      <div class="csd-telemetry">
        <div class="csd-tel-card">
          <small>SALDO TOKEN</small>
          <b class="cyan">${fmt(tok)}</b>
        </div>
        <div class="csd-tel-card">
          <small>WEATHER POT</small>
          <b>${fmt(state.potions||0)}</b>
        </div>
      </div>

      <div class="csd-detail-wrap" id="shopDetail"></div>

      <div class="csd-footnote">
        <span class="csd-fn-icon">⚡</span>
        <span>Drop rate di Tower: <b>Weather 5%</b> &middot; <b>Luck 10%</b> &middot; <b>Speed 10%</b> per lantai. Potion aktif dapat di-stack durasinya.</span>
      </div>

      <button id="shopBuy" class="cyber-buy-btn" type="button"></button>
    </section>

  </div></div>`;

  renderList();
  renderDetail(true);

  const rb=document.getElementById("shopBack");
  if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}towerView="hub";render();};
  const bi=document.getElementById("shopBuy");
  if(bi)bi.onclick=()=>{if(bi.disabled)return;infBuy(ITEMS[window.shopSel].k);};
}
function infBuy(kind){
  const cost={weather:10,luck1:10,luck2:50,luck3:250,speed1:10,speed2:50,speed3:250,mythic:50}[kind]; if(cost==null)return;
  if((state.infTokens||0)<cost){toast("TOKEN KURANG","TOKEN INF TIDAK CUKUP","#f87171");return;}
  state.infTokens-=cost;
  if(kind==='weather')state.potions=(state.potions||0)+1;
  else if(kind.startsWith('luck')){state.luckPots=state.luckPots||[0,0,0];state.luckPots[+kind.slice(-1)-1]++;}
  else if(kind.startsWith('speed')){state.speedPots=state.speedPots||[0,0,0];state.speedPots[+kind.slice(-1)-1]++;}
  save(); beep(660,.1,"sine",.07);
  const label={weather:'WEATHER POTION',mythic:'MYTHIC POTION'}[kind]||(kind.startsWith('luck')?'LUCK POTION L'+kind.slice(-1):'SPEED POTION L'+kind.slice(-1));
  toast(label,"-"+cost+" TOKEN","#c4b5fd");
  renderShell(); if(towerView==="shop")render();
}
function renderTowerBattle(){
  const w=towerRun.waves[towerRun.idx];
  const eq=equipped(),st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  app.innerHTML=`
  <div class="battle-grid tower-stage">
  <div class="me-col">
    <div class="fighter me${eq?mutGlow(eq.mut):''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}"${eq?mutEdge(eq.mut):''}>${meFighterHtml(eq)}</div>
    ${benchHtml()}
  </div>
  <div class="vs-col"><div class="t">VS</div><div class="s" id="turnLabel">LANTAI <b>${towerRun.floor}</b> · ${towerIsBossFloor(towerRun.floor)?"BOS":"GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"}</div><button class="bspeed-btn" id="bspeedBtn" type="button">1×</button></div>
  <div class="me-col foe-side" id="foeSide">${towerFoeSide(w)}</div>
  </div>`;
  wireSpeedBtn();
  clearFoeEnter();
  const meEl0=document.querySelector(".fighter.me"),foeEl0=document.querySelector(".fighter.foe");
  if(meEl0){meEl0.classList.add("tag-enter");setTimeout(()=>{try{meEl0.classList.remove("tag-enter");}catch(e){}},650);enterFx(meEl0);}
  if(foeEl0)enterFx(foeEl0);
  playFight(startTowerBattle);
}
function startTowerBattle(){
  /* Battle lama (over) jangan nutup battle baru; battle hidup → jangan di-reset */
  if(bt&&!bt.over)return;
  if(bt&&bt.over){if(bt.timer)clearTimeout(bt.timer);bt=null;}
  const w=towerRun.waves[towerRun.idx];
  const fighters=equippedList();if(!fighters.length)fighters.push(equipped());
  const eq=fighters[0],base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  if(bt&&bt.timer)clearTimeout(bt.timer);
  bt={speed:battleSpeedEff(),fgen:++FGEN,lv:null,tower:true,en:w.en,es:w.es,eq,fighters,eid:w.eid,efx:w.efx,active:0,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:w.es.hp,turn:1,over:false,eBurn:0,ePoison:0,pGuardDr:0,eAbilityOff:0,voidUsed:false,pCopyFx:null,spCd:[],spTurn:[],spArmed:[],spWave:[],meteorGuard:[],phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),shatterGuard:new Array(fighters.length).fill(false),defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,psychic:null,atkEntryGuard:new Array(fighters.length).fill(false),sleepLeft:new Array(fighters.length).fill(0),sleepArmed:new Array(fighters.length).fill(false),overflow:0,rain:null,freezeLeft:0,shockCount:new Array(fighters.length).fill(0),shadow:null,freezeNext:false,valhallaLeft:0,paintHits:[],eInk:0,eInkPct:0,wc:null,rearIdx:-1,rearWaiting:false,rearUsed:[],senzu:{},senzuFin:false,balloon:0,stretchShot:0,turret:0,hvCount:new Array(fighters.length).fill(0),hvUses:new Array(fighters.length).fill(0),hvEntryGuard:new Array(fighters.length).fill(false),eHvUses:0,excited:false,weCount:new Array(fighters.length).fill(0),weRevived:false,pbRocks:0,pbKey:"",pbStreak:0,rubber:false,rbBounce:0,dizzyStack:0,dizzyLeft:0,bajrangUsed:new Array(fighters.length).fill(false)};
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
    const tl=document.getElementById("turnLabel");if(tl)tl.innerHTML="LANTAI <b>"+towerRun.floor+"</b> · GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>";
    floatText(".fighter.foe","TAG-IN!","tagin");
    if(bt.excited){bt.excited=false;floatText(".fighter.foe","EXTRA ATTACK!","crit");schedPhase(1000,playerPhase);}else if(bt.pStun>0){schedPhase(1000,enemyPhase);}else{schedPhase(1000,playerPhase);}
  },bsMs(2000));
}
function towerEnd(win){
  if(bt){clearTimeout(bt.timer);bt.over=true;}
  const f=towerRun.floor;
  if(win){
    /* Menang lantai: kasih hadiah lalu LANGSUNG naik lantai berikutnya tanpa overlay. */
    const r=towerReward(f); state.coins+=r.coins;
    /* Drop tiap floor lolos: Instant roll 100% PASTI (DITABUNG, di-roll saat kalah) — 25×ceil(lantai/10), +25 tiap band 10 lantai · Weather 5% · Luck +1 10% · Speed +1 10% */
    if(!towerRun.drops)towerRun.drops={weather:0,luck:0,speed:0};
    const rr=25*Math.ceil(f/10);
    towerRun.pendingRolls=(towerRun.pendingRolls||0)+rr; towerRun.cards=(towerRun.cards||0)+rr;
    if(Math.random()<0.05){state.potions=(state.potions||0)+1;towerRun.drops.weather++;}
    if(Math.random()<0.10){state.luckPots=state.luckPots||[0,0,0];state.luckPots[0]++;towerRun.drops.luck++;}
    if(Math.random()<0.10){state.speedPots=state.speedPots||[0,0,0];state.speedPots[0]++;towerRun.drops.speed++;}
    /* DROP LANGKAH CRAYON V2 — BASE murni TANPA luck player (totalLuck TIDAK dipakai): pedang-api 0,1% · kyubi 0,01% per lantai. */
    const rare=[];
    if(!state.artOwned.includes("pedang-api")&&Math.random()<0.001){state.artOwned.push("pedang-api");rare.push("ARTEFAK PEDANG API · +120 FLAT & +100% LUCK");}
    if(!state.petOwned.includes("kyubi")&&Math.random()<0.0001){state.petOwned.push("kyubi");rare.push("PET KYUBI FOX · +200 FLAT & +300% LUCK");}
    /* Token Inf: +1 per lantai, +5 per lantai bos. */
    const tok=towerIsBossFloor(f)?5:1;
    state.infTokens=(state.infTokens||0)+tok; towerRun.tokens=(towerRun.tokens||0)+tok;
    towerRun.cleared=f; towerRun.coins=(towerRun.coins||0)+r.coins;
    state.tower.best=Math.max(state.tower.best||0,f);
    save(); renderShell(); fanfare();
    toast("LANTAI "+f+" DITAKLUKKAN","+"+rr+" ROLL DISIMPAN · "+"+"+tok+" TOKEN","#7df9ff");
    rare.forEach((m,i)=>setTimeout(()=>toast("DROP LANGKAH · LANTAI "+f,m,"#fb923c"),700*(i+1)));
    bt=null;
    towerEnter(f+1);
    return;
  }
  /* Kalah: run berhenti — cairkan SEMUA roll yang ditabung SEBELUM sfx/DOM apa pun
     (apapun yang error sesudahnya, reward tetap aman & pendingRolls gak dobel).
     TANPA overlay KALAH: langsung balik ke hub Tower tepat di balik popup hasil roll,
     dan kalau AUTO RESTART aktif, run baru Lantai 1 menyusul setelah popup ditutup. */
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
  try{ toast("RUN BERAKHIR DI LANTAI "+f,"LANTAI DITAKLUKKAN: "+reached+" · KARTU +"+fmt(towerRun.cards||0)+" · TOKEN +"+fmt(towerRun.tokens||0),"#f87171"); }catch(e){}
  /* Popup hasil roll (kartu + potion) tetap tampil — z-220, di atas segalanya. */
  try{ showTowerLoot(loot,dr); }
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
function showTowerLoot(results,drops,title){
  const pop=document.getElementById("rollResultPop");if(!pop)return;
  results=results||[];
  const d=drops||{weather:0,luck:0,speed:0};
  const POTION=[{k:'weather',name:'WEATHER',icon:'assets/images/icon-potion.png',emoji:'🧪'},{k:'luck',name:'LUCK',icon:'assets/images/pot-luck-1.png',emoji:'🍀'},{k:'speed',name:'SPEED',icon:'assets/images/pot-speed-1.png',emoji:'⚡'}];
  const totalPot=POTION.reduce((s,p)=>s+(d[p.k]||0),0);
  if(!results.length&&!totalPot)return;
  const potChips=POTION.filter(p=>(d[p.k]||0)>0).map(p=>{const n=d[p.k]||0;return `<div class="rrc rrc-potion" title="${p.name} POTION"><i class="rrc-sizer"></i><span class="rrc-pot-ic"><img src="${p.icon}" alt="${p.name}" onerror="this.parentNode.textContent='${p.emoji}'"></span>${n>1?`<span class="rrc-cnt">×${n}</span>`:''}<span class="rrc-name">${p.name}</span></div>`;}).join("");
  const groups={};
  results.forEach(r=>{const key=r.cardId+"|"+(r.mut||"none")+"|"+(r.shiny||"none");(groups[key]=groups[key]||{cardId:r.cardId,tier:r.tier,mut:r.mut||"none",shiny:!!(r.shiny&&r.shiny!=="none"),n:0}).n++;});
  const list=Object.values(groups).sort((a,b)=>luckChance(b.cardId,b.mut,b.shiny)-luckChance(a.cardId,a.mut,a.shiny)||b.n-a.n);
  document.getElementById("rrTotal").textContent=fmt(results.length)+" kartu"+(list.length?" · "+list.length+" jenis unik":"")+(totalPot?" · "+fmt(totalPot)+" potion":"");
  document.getElementById("rrBody").innerHTML=potChips+list.map(g=>{
    const name=cardName(g.cardId),img=cardImg(g.cardId);
    const isShiny=g.shiny&&g.shiny!=="none", isMut=g.mut&&g.mut!=="none";
    const varTag=(isShiny||isMut)?`<span class="rrc-var">${isShiny?'<span class="rrc-shine shiny-pill">SHINY</span>':''}${isMut?mutChip(g.mut,mutPill(g.mut,'rrc-mut')):''}</span>`:'';
    let rc="rrc";if(isMut)rc+=" mut-"+g.mut;if(isShiny)rc+=" shiny";
    const chanceVal=luckChance(g.cardId,g.mut,g.shiny);
    const tier=g.tier||cardTier(g.cardId)||"COMMON";
    return `<div class="${rc} sl-item" data-tier="${tier}">
      <i class="rrc-sizer"></i>
      <div class="rrc-glow"></div>
      <img src="${img}" alt="${name}" title="${name}" onerror="this.style.display='none'">
      <span class="rrc-tier-badge t-${tier.toLowerCase()}">${tier}</span>
      ${varTag}
      ${g.n>1?`<span class="rrc-cnt">×${g.n}</span>`:''}
      <div class="rrc-footer">
        <span class="rrc-name-text">${name}</span>
        <span class="rrc-chance-text">1 in ${fmtChance(chanceVal)}</span>
      </div>
    </div>`;
  }).join("");
  {const rt=document.getElementById("rrTitle");if(rt)rt.textContent=title||"KARTU RUN INI";}
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
  const mcEl=document.getElementById("md-card");mcEl.dataset.tier=s.tier;
  mcEl.innerHTML=`
    <span class="md-art"><img src="${c.sprite_asset}" alt="${c.name}"></span>
    <div class="md-info">
      <div class="eyebrow" style="color:${TIER_COLOR[s.tier]}">${rarityText(s.tier,luckChance(s.char,s.mut,s.shiny))}${s.mut&&s.mut!=="none"?` · ${mutChip(s.mut,mutPill(s.mut))}`:""}${s.shiny?' · <span class="shiny-badge shiny-pill">SHINY</span>':""}</div>
      <div class="md-name">${c.name}</div>
      <div class="cr-title" style="margin-bottom:8px">${c.type}</div>
      <div class="cr-stats"><span>♡ ${fmt(st.hp)}</span><span>${ATKIC} ${fmt(st.atk)}</span></div>
      <div class="cr-skill" style="margin-bottom:4px"><span class="ds-skill-badge">✦ ${c.passive.name}<span class="sk-txt">${skillText(s.char)}</span></span></div>
      <div class="md-actions">
        <button class="md-btn primary" id="md-use">${(function(){const di=state.deck.indexOf(s.id);return di>=0?("DI DEK · SLOT "+(di+1)):"PASANG KE DEK";})()}</button>
        <button class="md-btn${s.fav?" on":""}" id="md-fav">${s.fav?"★ FAVORIT":"FAVORIT"}</button>
        <button class="md-btn${s.lock?" on":""}" id="md-lock">${s.lock?"🔒 LOCKED":"LOCK"}</button>
        <button class="md-btn md-close" id="md-close">TUTUP</button>
      </div>
    </div>`;
  m.classList.add("show");
  document.getElementById("md-use").onclick=()=>{sfx.hit();const di=state.deck.indexOf(s.id);if(di>=0){setDeckSlot(di,null);}else{let e=state.deck.indexOf(null);if(e<0)e=0;setDeckSlot(e,s.id);}openModal(id);renderBackpackPanel();if(!state.battle&&typeof render==="function")render();};
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
  return `<div class="hub-center${mut?' mut-'+mut:''}${shinyCls(eq)}"${idAttr||''} data-tier="${tier}" style="--tcol:${mut?MUT_COLOR[mut]:TIER_COLOR[tier]}${mut&&!eq.shiny?`;border-color:${MUT_COLOR[mut]}`:''}">
      <div class="hc-img"><img src="${cardImg(eq.char)}" alt="${cardName(eq.char)}"${CARDS[eq.char].pos?` style="object-position:${CARDS[eq.char].pos}"`:''}>
          ${mut&&!eq.shiny?`<span class="hc-name-top hc-mut-name" data-text="${String(cardName(eq.char)).replace(/"/g,'&quot;')}">${mut==='rainbow'?mutText(mut,cardName(eq.char)):cardName(eq.char)}</span>`:eq.shiny?`<span class="hc-name-top hc-name-shine${mut?' hc-name-shine-'+mut:''}" data-text="${String(cardName(eq.char)).replace(/"/g,'&quot;')}" style="${mut==='gold'?'--sh-base:#E0BC6E;--sh-edge:rgba(224,188,110,.95);--sh-glow:rgba(224,188,110,.55)':mut==='rainbow'?'--sh-base:#B58CFF;--sh-edge:rgba(90,200,250,.95);--sh-glow:rgba(181,140,255,.55)':mut==='secret'?'--sh-base:#A855F7;--sh-edge:rgba(168,85,247,.95);--sh-glow:rgba(168,85,247,.55)':mut==='ultima'?'--sh-base:#FF0055;--sh-edge:rgba(255,51,102,.95);--sh-glow:rgba(255,0,85,.6)':'--sh-base:#22d3ee;--sh-edge:rgba(34,211,238,.95);--sh-glow:rgba(34,211,238,.55)'}">${cardName(eq.char)}</span>`:shinyName('span','hc-name-top','hc-name-shine',mut,eq.shiny,cardName(eq.char))}
          <span class="hc-chance${mut==='rainbow'?' hc-chance-rainbow':''}" style="color:${mut?MUT_COLOR[mut]:"#9AA6B2"}">${mut==='rainbow'?mutText(mut,chanceText):chanceText}</span>
          ${(mut||trait||eq.shiny)?`<div class="hc-badges">${eq.shiny?'<span class="shiny-badge shiny-pill">SHINY</span>':''}${mut?mutChip(mut,mutPill(mut)):''}${trait?traitChip(trait,`<span class="hc-trait hc-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(14,trait)}</span>`):''}</div>`:''}
          <div class="skill-overlay"><b>${passiveName(eq.char)}</b><span class="sk-txt">${skillText(eq.char)}</span></div>
        </div>
        <div class="hc-info">
          <div class="hc-skill">${passiveName(eq.char)}</div>
          <div class="hc-desc">${skillText(eq.char)}</div>
          <div class="hc-stats"><div class="hp">♡ ${fmt(st.hp)}</div><div class="atk">${ATKIC} ${fmt(st.atk)}</div></div>
        </div>
        ${hideBtn}
    </div>`;
}
/* 3D tilt dihapus sesuai instruksi user: kembali ke display border standar tanpa tilt/transform 3D */
function initHubTilt(card){
  if(!card) return;
  card.style.transform='none';
  card.style.setProperty('--pf','0');
  card.style.setProperty('--pfy','0');
  const glare=card.querySelector('.hc-glare');
  if(glare)glare.remove();
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
          <span class="ls-tag">ART ${i+1}</span>
          ${artIconHtml(d)}
          <span class="ls-tip"><b>${d.name}</b><small>${luckTxt(d)} · TERPASANG</small></span>
        </div>`
      : `<div class="loadout-slot art-slot empty" data-bp="artefact" role="button" tabindex="0">
          <span class="ls-tag">ART ${i+1}</span>
          <span class="ls-mark">${artSvg}</span>
          <span class="ls-lbl">EMPTY</span>
          <span class="ls-tip"><b>SLOT ARTEFAK ${i+1}</b><small>Kosong — klik untuk buka Backpack</small></span>
        </div>`;
  };

  const pet=lobbyPetHtml()
    ? `<div class="loadout-slot pet-slot filled" data-bp="pet" role="button" tabindex="0" title="Pet aktif — kelola di Backpack" style="--ac:#8fd3ff">
        <span class="ls-tag">PET</span>
        ${lobbyPetHtml()}
      </div>`
    : `<div class="loadout-slot pet-slot empty" data-bp="pet" role="button" tabindex="0" title="Slot pet — kosong">
        <span class="ls-tag">PET</span>
        <span class="ls-mark">${petSvg}</span>
        <span class="ls-lbl">EMPTY</span>
        <span class="ls-tip"><b>COMPANION PET</b><small>Kosong — klik untuk pasang Pet</small></span>
      </div>`;

  return slot(0)+slot(1)+pet;
}
function renderLobby(){
  if(state.battle)return renderBattle();
  const eq=equipped();
  const st=eq?cardStats(eq.char,eq.mut,eq.trait,eq.shiny):null;
  const tier=eq?CARDS[eq.char].tier:null;
  app.innerHTML=`
  <div class="lobby-hub">
    <div class="hub-loadout-bar" role="group" aria-label="Loadout artefak & pet">${hubLoadoutHtml()}</div>
    <div class="hub-box h-l1 hub-link hub-link-raid" id="hubRaid" role="button" title="Masuk Boss Raid">
      <span class="tile-index"><span class="tile-number">01</span><span class="tile-category">CYBER / RAID</span></span>
      <span class="tile-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="42" stroke-dasharray="6 4" opacity="0.4"/>
          <circle cx="50" cy="50" r="32" opacity="0.6"/>
          <path d="M50 8v14M50 78v14M8 50h14M78 50h14"/>
          <polygon points="50,22 68,36 68,64 50,78 32,64 32,36" stroke-width="2"/>
          <path d="M42 42l16 16M58 42l-16 16" stroke-width="2.2"/>
          <circle cx="50" cy="50" r="6" fill="currentColor"/>
        </svg>
      </span>
      <span class="tile-copy"><span class="hb-lbl">BOSS RAID</span><span class="hb-meta">Assault cyber menace</span></span>
      <span class="tile-action"><span>INITIALIZE</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>
    <div class="hub-box h-l2 hub-link hub-link-tower" id="hubTower" role="button" title="Masuk Infinite Tower">
      <span class="tile-index"><span class="tile-number">02</span><span class="tile-category">ASCENT / TOWER</span></span>
      <span class="tile-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="50,10 76,28 76,72 50,90 24,72 24,28" stroke-dasharray="5 3" opacity="0.35"/>
          <path d="M50 15L70 30L50 45L30 30Z" stroke-width="2"/>
          <path d="M30 46l20 15 20-15M30 62l20 15 20-15" stroke-width="2"/>
          <line x1="50" y1="15" x2="50" y2="85" stroke-dasharray="4 4" opacity="0.7"/>
          <circle cx="50" cy="15" r="3.5" fill="currentColor"/>
        </svg>
      </span>
      <span class="tile-copy"><span class="hb-lbl">INFINITE TOWER</span><span class="hb-meta">Climb neural layers</span></span>
      <span class="tile-action"><span>ASCEND</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>
    <div class="hub-box h-l3 hub-link hub-link-weather" id="hubWeather" role="button" title="Buka Weather Machine">
      <span class="tile-index"><span class="tile-number" style="color:#38bdf8">03</span><span class="tile-category" style="color:#0ea5e9">CLIMATE / CORE</span></span>
      <span class="tile-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="38" stroke-dasharray="5 3" opacity="0.4"/>
          <path d="M50 18v12M50 70v12M18 50h12M70 50h12" stroke-width="2"/>
          <path d="M28 28l9 9M63 63l9 9M28 72l9-9M63 37l9-9" stroke-width="1.6" opacity="0.6"/>
          <circle cx="50" cy="50" r="16" stroke-width="2.2" fill="currentColor" fill-opacity="0.15"/>
          <circle cx="50" cy="50" r="6" fill="currentColor"/>
        </svg>
      </span>
      <span class="tile-copy"><span class="hb-lbl" style="color:#38bdf8;text-shadow:0 0 10px rgba(56,189,248,.35)">WEATHER MACHINE</span><span class="hb-meta">Atmospheric Catalyst & Odds</span></span>
      <span class="tile-action" style="border-color:rgba(56,189,248,.4);color:#38bdf8"><span>SYNTHESIZE</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>
    <div class="hub-mid">
      <div class="seam"></div>
      <div class="stage-eyebrow">ACTIVE CARD</div>
      <div class="stage-center">
        <div class="card-float">
          ${renderTitleCrownHtml(state.playerTitle || "ROOKIE")}
          ${hubCardHtml(eq,' id="hubCard"')}
        </div>
      </div>
      <div class="stage-hint"><kbd>KLIK</kbd> UNTUK BUKA BACKPACK</div>
    </div>
    <div class="hub-box h-r0 hub-link hub-link-premium" id="hubPremium" role="button" title="Toko Premium - Beli Roll Pack">
      <span class="tile-index"><span class="tile-number" style="color:#FFD700">VIP</span><span class="tile-category" style="color:#FFA000">SPECIAL / SYNDICATE</span></span>
      <span class="tile-art" aria-hidden="true">
        <img src="assets/images/premium-currency.webp" alt="Premium Shop" style="width:52px;height:52px;object-fit:cover;border-radius:50%;filter:drop-shadow(0 0 10px rgba(255,215,0,.6));opacity:0.9">
      </span>
      <span class="tile-copy"><span class="hb-lbl" style="color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.4)">PREMIUM SHOP</span><span class="hb-meta">Instant roll packs</span></span>
      <span class="tile-action" style="border-color:rgba(255,215,0,.4);color:#FFD700"><span>ACCESS</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>
    <div class="hub-box h-r1 hub-link hub-link-index" id="hubIndex" role="button" title="Buka Katalog Kartu">
      <span class="tile-index"><span class="tile-number">04</span><span class="tile-category">DATABASE / ARCHIVE</span></span>
      <span class="tile-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="22" y="20" width="56" height="60" rx="4" stroke-width="2"/>
          <line x1="32" y1="36" x2="68" y2="36" stroke-width="2"/>
          <line x1="32" y1="48" x2="60" y2="48"/>
          <line x1="32" y1="60" x2="52" y2="60"/>
          <path d="M64 60h12v12H64z" fill="currentColor" opacity="0.3"/>
          <circle cx="70" cy="66" r="14" stroke-dasharray="4 2"/>
          <path d="M80 76l10 10" stroke-width="2.4"/>
        </svg>
      </span>
      <span class="tile-copy"><span class="hb-lbl">CARD INDEX</span><span class="hb-meta">Neural database</span></span>
      <span class="tile-action"><span>ACCESS</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>
    <div class="hub-box h-r2 hub-link hub-link-trait" id="hubTrait" role="button" title="Roll Trait untuk kartu aktif">
      <span class="tile-index"><span class="tile-number">05</span><span class="tile-category">CYBER / REFINE</span></span>
      <span class="tile-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="50" r="38" stroke-dasharray="6 4" opacity="0.35"/>
          <polygon points="50,16 60,38 84,50 60,62 50,84 40,62 16,50 40,38" stroke-width="2"/>
          <circle cx="50" cy="50" r="5" fill="currentColor"/>
          <path d="M22 22l8 8M78 22l-8 8M22 78l8-8M78 78l-8-8" opacity="0.5"/>
        </svg>
      </span>
      <span class="tile-copy"><span class="hb-lbl">TRAIT</span><span class="hb-meta">Overclock traits</span></span>
      <span class="tile-action"><span>REFINE</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></span>
    </div>
    <div class="hub-box h-mission hub-link hub-link-mission" id="missionBtn" role="button" title="Buka daftar misi">
      <span class="tile-index"><span class="tile-number">06</span><span class="tile-category">OPS / DIRECTIVES</span></span>
      <span class="tile-art" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="50,14 82,30 82,70 50,86 18,70 18,30" stroke-width="1.8" opacity="0.4"/>
          <path d="M34 50l10 10 22-22" stroke-width="2.4"/>
          <circle cx="50" cy="50" r="28" stroke-dasharray="4 3"/>
        </svg>
      </span>
      <span class="tile-copy"><span class="hb-lbl">MISSION LOG</span><span class="hb-meta">Tactical objectives</span></span>
      <span class="mission-progress">
        <span class="mission-progress-label">CLEARANCE PROTOCOL</span>
        <span class="mission-meter" id="missionMeter" role="progressbar" aria-label="Mission progress" aria-valuemin="0"><span id="missionFill"></span></span>
        <span class="mb-sub" id="missionSub"></span>
      </span>
      <span class="tile-action"><span>VIEW MISSIONS</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>
    </div>
  </div>`;
  const hc=document.getElementById("hubCard");if(hc){hc.onclick=()=>{sfx.hit();toggleBackpack();};initHubTilt(hc);}
  const hp=document.getElementById("hubPremium");if(hp)hp.onclick=()=>{sfx.hit();openPremiumShop();};
  const gp=document.getElementById("gemPill");if(gp)gp.onclick=()=>{sfx.hit();openPremiumShop();};
  const hi=document.getElementById("hubIndex");if(hi)hi.onclick=()=>{sfx.hit();openIndex();};
  const ht=document.getElementById("hubTrait");if(ht)ht.onclick=()=>{sfx.hit();openTrait();};
  const hr=document.getElementById("hubRaid");if(hr)hr.onclick=()=>{sfx.hit();raidView="hub";location.hash="#/raid";};
  const ht2=document.getElementById("hubTower");if(ht2)ht2.onclick=()=>{sfx.hit();stopTower();location.hash="#/tower";};
  const hw=document.getElementById("hubWeather");if(hw)hw.onclick=()=>{sfx.hit();openWeatherMachine();};
  const mb=document.getElementById("missionBtn");if(mb)mb.onclick=()=>{sfx.hit();openMission();};
  const ms=document.getElementById("missionSub");if(ms){const done=CHAPTERS.reduce((a,c)=>a+chapProgMode(c,state.diff),0),tot=CHAPTERS.reduce((a,c)=>a+c.levels.length,0);ms.textContent=done+"/"+tot+" SELESAI";const ratio=tot?Math.min(100,Math.round(done/tot*100)):0;const meter=document.getElementById("missionMeter"),fill=document.getElementById("missionFill");if(meter){meter.setAttribute("aria-valuemax",String(tot));meter.setAttribute("aria-valuenow",String(done));}if(fill)fill.style.width=ratio+"%";}
  document.querySelectorAll(".hub-loadout-bar .loadout-slot, .stage-loadout .loadout-slot").forEach(el=>{el.onclick=()=>{sfx.hit();bpSetTab(el.dataset.bp||"pet");const p=document.getElementById("backpackPanel");if(!p||p.style.display!=="flex")toggleBackpack();};});
}

/* ========== TOGGLE BACKPACK FUNCTION ========== */
function toggleBackpack() {
  const panel = document.getElementById('backpackPanel');
  if (!panel) return;

  const isVisible = panel.style.display !== 'none' && panel.style.display !== '';

  if (isVisible) {
    /* Close: refresh lobby di belakang biar hub card & bench ikut perubahan dek. */
    bpTarget = null;
    bpItemPopClose();
    panel.style.opacity = '0';
    panel.style.transform = 'translate(-50%, -45%) scale(0.95)';
    setTimeout(() => { panel.style.display = 'none'; render(); }, 300);
  } else {
    /* Open */
    renderBackpackPanel();
    panel.style.display = 'flex';

    setTimeout(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);

    beep(520, 0.1, 'triangle', 0.07);
  }
}

/* ========== MODAL BREAKDOWN DROP RATE INFINITE TOWER ========== */
function openTowerDropModal(){
  const m = document.getElementById("towerDropModal");
  const body = document.getElementById("towerDropModalBody");
  if(!m || !body) return;

  const drops = [
    {
      cat: "TABUNGAN RUN (100% GUARANTEED)",
      items: [
        { name: "Instant Card Rolls", chance: "100%", badge: "GUARANTEED", note: "+25 Kartu per lantai (+25 kartu tiap 10 lantai). Di-roll instan saat tamat.", ic: "🎴", col: "#7df9ff" },
        { name: "Token Inf (Lantai Reguler)", chance: "100%", badge: "+1 TOKEN", note: "Diperoleh otomatis tiap membersihkan lantai biasa.", ic: "🪙", col: "#c084fc" },
        { name: "Token Inf (Lantai Boss)", chance: "100%", badge: "+5 TOKEN", note: "Diperoleh khusus saat menaklukkan lantai kelipatan 5.", ic: "👑", col: "#ffd27a" }
      ]
    },
    {
      cat: "TACTICAL REAGENTS (CONSUMABLE)",
      items: [
        { name: "Weather Potion", chance: "5.0%", badge: "1 IN 20", note: "Gacha cuaca aktif (chance cuaca asli, durasi 5 menit).", ic: "🧪", col: "#7df9ff" },
        { name: "Luck Potion L1", chance: "10.0%", badge: "1 IN 10", note: "+3 Flat Luck selama 5 menit. Efek stackable durasi.", ic: "🍀", col: "#5cf0a8" },
        { name: "Speed Potion L1", chance: "10.0%", badge: "1 IN 10", note: "+0.2× Roll Speed selama 5 menit. Efek stackable durasi.", ic: "⚡", col: "#ffd27a" }
      ]
    },
    {
      cat: "SECRET DROPS (BASE PURE RATE - UNMODIFIED BY LUCK)",
      items: [
        { name: "Artefak Pedang Api", chance: "0.10%", badge: "1 : 1.000", note: "Artefak Permanen: +120 Flat Luck & +100% Luck Multiplier (Maks 1).", ic: "🗡️", col: "#ff6b81" },
        { name: "Pet Kyubi Fox", chance: "0.01%", badge: "1 : 10.000", note: "Companion Mythic: +200 Flat Luck & +300% Luck Multiplier (Maks 1).", ic: "🦊", col: "#ff4757" }
      ]
    }
  ];

  body.innerHTML = drops.map(sec => `
    <div class="twd-section">
      <div class="twd-sec-title">
        <span class="twd-dot"></span>
        <span>${sec.cat}</span>
      </div>
      <div class="twd-grid">
        ${sec.items.map(it => `
          <div class="twd-card" style="--it-col:${it.col}">
            <div class="twd-ic-box">
              <span class="twd-glyph">${it.ic}</span>
            </div>
            <div class="twd-info">
              <div class="twd-top">
                <span class="twd-name">${it.name}</span>
                <span class="twd-badge">${it.badge}</span>
              </div>
              <div class="twd-sub">${it.note}</div>
            </div>
            <div class="twd-rate-box">
              <span class="twd-rate-lbl">PROBABILITY</span>
              <span class="twd-rate-val">${it.chance}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

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
