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
  {k:'r5k',  p:0.05,  name:'INSTANT ROLL 5.000',  icon:'assets/images/instanpack-5k.webp?v=trans1',  label:'5%'},
  {k:'r10k', p:0.02,  name:'INSTANT ROLL 10.000', icon:'assets/images/instanpack-10k.webp?v=trans1', label:'2%'},
  {k:'r25k', p:0.01,  name:'INSTANT ROLL 25.000', icon:'assets/images/instanpack-25k.webp?v=trans1', label:'1%'},
  {k:'r100k',p:0.005, name:'INSTANT ROLL 100.000',icon:'assets/images/instanpack-100k.webp?v=trans1',label:'0,5%'}
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
    if(loot&&loot.length)showTowerLoot(loot,towerRun.drops,null,{packDrops:towerRun.packDrops||{},rareDrops:towerRun.rareDrops||[]}); else toast("TOWER ROLLS WITHDRAWN","+"+n+" KARTU","#7df9ff");
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
  if(towerView==="shop"){csClearCompact();renderTowerShop();return;}
  renderTowerHub();
}
/* body.tw-compact hanya bermakna selama hub CORE SPIRE tampil. Tanpa ini
   kelasnya tertinggal di layar lain (terukur: masih `true` saat lobby, karena
   csRenderSlabs yang menyalakannya tidak punya pasangan pembersih). */
function csClearCompact(){ document.body.classList.remove("tw-compact"); }
/* ==================== CORE SPIRE — HUB TOWER INFINITE ====================
   Port dari lab `_tmp/proto_tower_skel.html` (desain DIKUNCI user 2026-11-05).
   Struktur: .cs-hub > .cs-top / .cs-body(.cs-stage + .cs-side) / .cs-foot?
   Kontrak boot yang WAJIB dijaga (js/boot.js:341,384 -> body.on-tower):
     root  class="tw-page tactical-tower-page"
     id    towerGo / towerShop / towerLobby / twDropRateBtn
   Algoritma lantai menara (hasil ukur, JANGAN diubah tanpa ukur ulang):
     1. .cs-stage berperspektif -> tinggi lantai yang TAMPAK bukan tinggi CSS
        (terukur 80px DEPLOY di 500x844, 59px di 320x568) dan berbeda per posisi.
     2. Jarak antar-lantai lebih kecil dari tinggi lantai terdekat = lantai
        berikutnya tertutup (terukur -3..-13px).
     3. Umpan balik "jarak terus dinaikkan" DIVERGEN: menaikkan jarak mendorong
        lantai ke atas mendekati perspective-origin sehingga lantai justru
        membesar (terukur meledak 113/200/287/374px). Karena itu yang berubah
        hanya JUMLAH lantai; jarak dihitung ulang dari jumlah itu.
     4. Stage pendek (320x568 -> ~243px) hanya muat 3 lantai rak 3-baris dan
        menyisakan ruang mati -> mode PADAT (body.tw-compact, 2 baris).
   Cara kerja: coba n dari TERBESAR ke terkecil, UKUR hasil nyata, terima n
   pertama yang tidak bertumpuk dan tidak keluar dari stage. */
const CS_SLAB_MAX = 9, CS_SLAB_MIN = 3;

function csPad2(n){ return String(n).padStart(2, "0"); }
function csStageEl(){ return document.querySelector(".cs-hub .cs-stage"); }

/* tinggi stage yang terpasang (dipakai memilih jumlah lantai) */
function csStageH(){
  const st = csStageEl();
  return (st && st.clientHeight) || 300;
}

/* Jendela lantai: frontier (best+1) SELALU ikut tampil supaya pemain tahu
   sasaran berikutnya, sisanya lantai di bawahnya. Biaya DOM tetap <= 9. */
function csWindowFloors(n, best){
  const lo = Math.max(1, (best + 1) - (n - 1));
  const out = [];
  for(let f = lo; f < lo + n; f++) out.push(f);
  return out;
}

/* active  = titik mulai run (produksi selalu mulai lantai 1)
   next    = frontier best+1, sasaran berikutnya
   cleared = sudah ditembus
   locked  = belum terjangkau */
function csFloorStateOf(f, best){
  if(f === 1) return "active";
  if(f === best + 1) return "next";
  if(f <= best) return "cleared";
  return "locked";
}

function csSlabHtml(f, idx, y, best){
  const st = csFloorStateOf(f, best);
  const boss = towerIsBossFloor(f);
  const isAct = st === "active";
  const isRec = f === best && best > 0;
  const kind = boss ? "CRITICAL ANOMALY" : "SECURITY NODE";
  const coin = fmt(towerReward(f).coins);

  let status, sub;
  if(isAct){
    status = "DEPLOY READY";
    sub = boss ? "BOSS GATE" : "4 WAVES &middot; +" + coin + " COIN";
  } else if(st === "next"){
    status = "NEXT TARGET";
    sub = boss ? "HAZARD AHEAD" : "+1 TOKEN &middot; +" + coin + " COIN";
  } else if(st === "cleared"){
    status = "ANALYSIS COMPLETE";
    sub = "CLEARED &middot; +" + coin + " COIN";
  } else {
    status = "ENCRYPTED";
    sub = boss ? "HAZARD SECTOR" : "LOCKED SECTOR";
  }

  const badge = (isRec ? '<span class="cs-sl-badge rec">REKOR</span>' : "")
              + (boss ? '<span class="cs-sl-badge haz">HAZARD</span>' : "");
  const clickable = isAct || st === "next";
  return `<div class="cs-slab" data-state="${st}" data-boss="${boss ? 1 : 0}" data-floor="${f}"`
    + ` style="--h:${idx};--y:${Math.round(y)}px"`
    + (clickable ? ' role="button" tabindex="0" aria-label="Start run from floor ' + f + '"' : '')
    + `>
    <div class="cs-sl">
      <span class="cs-sl-no">${csPad2(f)}</span>
      <span class="cs-sl-mid">
        <span class="cs-sl-k">${kind}</span>
        <span class="cs-sl-n">${status}</span>
        <span class="cs-sl-st">${sub}</span>
      </span>
      ${badge}
    </div>
  </div>`;
}

/* Render menara (jendela lantai). Mengembalikan {n, floors} untuk dipakai
   kalau perlu; tidak ada state global yang diubah selain body.tw-compact. */
function csRenderSlabs(best){
  const host = document.getElementById("csSlabs");
  if(!host) return null;
  const H = csStageH();
  const compact = H < 310;
  document.body.classList.toggle("tw-compact", compact);

  let gap1 = 66, rackStep = compact ? 30 : 42;

  const draw = (n) => {
    const floors = csWindowFloors(n, best);
    const ys = [];
    let y = 0;
    for(let i=0;i<n;i++){ ys.push(Math.round(y)); y += (i === 0) ? gap1 : rackStep; }
    host.innerHTML = floors.map((f, i) => csSlabHtml(f, i, ys[i], best)).join("");
    return { n, floors };
  };

  /* ukur tinggi slab NYATA: perspektif mengubah tinggi tampak per posisi */
  draw(CS_SLAB_MIN + 1);
  const kids = [...host.children];
  if(kids.length >= 2){
    gap1 = Math.ceil(kids[0].getBoundingClientRect().height) + 4;
    rackStep = Math.max(rackStep, Math.ceil(kids[1].getBoundingClientRect().height) + 2);
  }

  const measureOk = () => {
    const rows = [...host.children];                    /* urut: bawah -> atas */
    if(rows.length < 2) return true;
    const rects = rows.map(e => e.getBoundingClientRect());
    const stageEl = host.closest(".cs-stage");
    if(!stageEl) return true;
    const stage = stageEl.getBoundingClientRect();
    /* rows[0] = lantai TERBAWAH; lantai lebih tinggi digambar LEBIH ATAS,
       jadi tumpang-tindih = bottom lantai atas melewati top lantai di bawahnya.
       Membandingkan terbalik membuat SEMUA susunan dianggap tumpang. */
    for(let i=1;i<rects.length;i++){
      if(rects[i-1].top - rects[i].bottom < -1) return false;
    }
    return rects[rects.length-1].top >= stage.top - 1;
  };

  let bestN = CS_SLAB_MIN, geo = draw(CS_SLAB_MIN);
  for(let n = CS_SLAB_MAX; n >= CS_SLAB_MIN; n--){
    geo = draw(n);
    if(measureOk()){ bestN = n; break; }
  }
  if(geo.n !== bestN) geo = draw(bestN);

  /* sebar sisa ruang supaya menara mengisi stage, lalu periksa ulang;
     kalau gagal, kembali ke jarak aman */
  if(bestN > 2){
    const spread = (H - 8 - gap1) / (bestN - 1);
    const tryStep = Math.min(rackStep * 1.5, Math.max(rackStep, spread));
    if(tryStep > rackStep + 1){
      const keep = rackStep;
      rackStep = tryStep;
      geo = draw(bestN);
      if(!measureOk()){ rackStep = keep; geo = draw(bestN); }
    }
  }
  return geo;
}

/* Dossier: 4 kartu wave. PARITAS PRODUKSI — towerWaves() (tower-lobby.js:43-57)
   selalu mengembalikan 4 wave (normal: 4 pick; boss: main + tag + pick(2) +
   pick(3)), dan dulu lab memotong .slice(0,3) sehingga kartu ke-4 hilang.
   Jangan dipotong. */
function csRenderDossier(waves, best){
  const host = document.getElementById("csWaves");
  if(!host) return;
  const boss = towerIsBossFloor(1);
  const fEl = document.getElementById("csDosFloor");
  const bEl = document.getElementById("csDosBoss");
  const rEl = document.getElementById("csDosRec");
  if(fEl) fEl.textContent = "F1";
  if(bEl) bEl.style.display = boss ? "" : "none";
  if(rEl) rEl.style.display = best > 0 ? "" : "none";

  host.innerHTML = (waves || []).map((w, i) => {
    if(!w || !w.en) return "";
    const lead = i === 0;
    const isBoss = !!w.en.boss;
    const tagCls = lead ? "lead" : (isBoss ? "boss" : "");
    const tagTxt = "W" + (i + 1) + (lead ? " LEAD" : (isBoss ? " BOSS" : ""));
    /* Thumb (242x360, -84% byte) cukup untuk kotak 1:1 kecil ini; art penuh
       (600x894) tetap dipakai battle/popup detail. `thumbSrc` ada di cards-fx.js
       dan dimuat sebelum file ini, tapi tetap dijaga: kalau helper tidak ada
       (urutan load berubah), pakai src asli daripada gambar kosong. */
    const art = typeof thumbSrc === "function" ? thumbSrc(w.en.img) : w.en.img;
    return `<div class="cs-wv">
      <div class="cs-wv-art">
        <img src="${art}" alt="${w.en.name}" decoding="async" loading="lazy">
        <span class="cs-wv-tag ${tagCls}">${tagTxt}</span>
      </div>
      <div class="cs-wv-bot">
        <span class="cs-wv-n" title="${w.en.name}">${w.en.name}</span>
        <span class="cs-wv-s"><b>${fmtStat(w.es.hp)}</b> HP &middot; <b>${fmtStat(w.es.atk)}</b> ATK</span>
      </div>
    </div>`;
  }).join("");
}

/* Gambar ulang menara + dossier pada ukuran viewport sekarang.
   Dipakai render pertama (setelah layout terpasang) dan tiap resize/rotasi.
   Aman dipanggil kapan pun: kalau hub tidak ada di DOM, langsung keluar. */
function csRepaintHub(){
  if(!document.querySelector(".cs-hub")) return;
  const best = (state.tower && state.tower.best) || 0;
  /* Dossier DULU: kartu wave mengisi `.cs-side` dan itu yang menentukan tinggi
     akhir `.cs-stage` (flex). Mengukur menara sebelum dossier terisi = mengukur
     stage yang masih terlalu tinggi. */
  csRenderDossier(towerWaves(1), best);
  csRenderSlabs(best);
  csWatchStage();
}

/* Tinggi stage BUKAN konstanta setelah satu rAF: dossier + 4 kartu wave +
   gambar lazy mengisi ruang SETELAH-nya, sehingga stage menyusut (terukur
   320x568: 283px final vs ~350px saat rAF pertama; 500x844: 546 final).
   Akibatnya jumlah lantai + body.tw-compact dihitung dari tinggi basi —
   terukur `slabTopGap` -64px (320) dan -72px (500): lantai teratas keluar
   dari atas stage. ResizeObserver menangkap perubahan tinggi stage dan
   menggambar ulang. Dipasang SEKALI per elemen stage (hub di-render ulang
   tiap navigasi, jadi elemennya diganti dan observer lama dilepas).
   Ambang 3px mencegah loop: slab berposisi absolute, jadi repaint tidak
   mengubah tinggi stage — kalau tidak ada perubahan nyata, tidak ada kerja. */
let _csRO = null, _csROEl = null, _csLastStageH = 0;
function csWatchStage(){
  const st = csStageEl();
  if(!st || typeof ResizeObserver !== "function") return;
  if(_csROEl === st && _csRO) return;
  if(_csRO){ try{ _csRO.disconnect(); }catch(e){} _csRO = null; }
  _csROEl = st;
  _csLastStageH = st.clientHeight;
  _csRO = new ResizeObserver(() => {
    if(!st.isConnected) return;
    const h = st.clientHeight;
    if(Math.abs(h - _csLastStageH) < 3) return;
    _csLastStageH = h;
    if(!document.querySelector(".cs-hub")) return;
    const best = (state.tower && state.tower.best) || 0;
    csRenderSlabs(best);
  });
  try{ _csRO.observe(st); }catch(e){}
}

/* Resize/rotasi: ukuran lantai menara bergantung tinggi stage, jadi WAJIB
   dihitung ulang. Debounce lewat rAF supaya drag-resize tidak memicu puluhan
   pengukuran per frame (setiap ukur memaksa reflow). Listener dipasang sekali. */
if(!window.__csHubResizeWired){
  window.__csHubResizeWired = true;
  let raf = 0;
  const onResize = () => {
    if(raf) return;
    raf = requestAnimationFrame(() => { raf = 0; csRepaintHub(); });
  };
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize, { passive: true });
}

/* ============================== HUB MARKUP ==============================
   Struktur & urutan kelas = cermin lab (dikunci user). Menara (#csSlabs) dan
   kartu wave (#csWaves) sengaja DIKOSONGKAN di sini lalu diisi
   csRenderSlabs/csRenderDossier setelah layout terpasang, karena jumlah lantai
   bergantung tinggi stage yang baru diketahui setelah reflow. */
function renderTowerHub(){
  if(!state.tower)state.tower={best:0};
  const best=state.tower.best||0;
  const start=1;                       /* run selalu dimulai dari lantai 1 */
  const boss=towerIsBossFloor(start);

  app.innerHTML=`<div class="tw-page tactical-tower-page">
  <div class="cs-hub">

    <!-- ============================ TOP BAR ============================ -->
    <div class="cs-top">
      <button class="cs-back" id="towerLobby" type="button" aria-label="Return to Lobby" title="Lobby">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="cs-ttl">
        <span class="cs-kick"><i></i> INFINITE TOWER &middot; NO RUN</span>
        <span class="cs-name">CORE <em>SPIRE</em></span>
      </div>
      <div class="cs-meter">
        <div class="cs-m"><small>BEST</small><b>${fmt(best)}</b></div>
        <div class="cs-m"><small>TOKEN</small><b class="c">${fmt(state.infTokens||0)}</b></div>
      </div>
      <button class="cs-info" type="button" id="twDropRateBtn" aria-label="Drop rates" title="Drop rates">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="17" r="2.6"/></svg>
      </button>
    </div>

    <!-- ======================= MENARA + DOSSIER ======================== -->
    <div class="cs-body">
      <div class="cs-stage">
        <div class="cs-spire">
          <div class="cs-beam"></div>
          <div class="cs-beam b2"></div>
          <div class="cs-reactor">
            <span class="cs-ring"></span><span class="cs-ring"></span><span class="cs-ring"></span>
          </div>
          <div id="csSlabs"></div>
        </div>
      </div>

      <div class="cs-side">
        <div class="cs-dossier">
          <div class="cs-dh">
            <span>NEXT CONTACT</span><b id="csDosFloor">F${start}</b>
            <span class="hb" id="csDosBoss" style="display:none">HAZARD</span>
            <span class="rec" id="csDosRec" style="display:none">REKOR</span>
          </div>
          <div class="cs-waves" id="csWaves"></div>
        </div>

        <div class="cs-dock">
          <button class="cs-cta" id="towerShop" type="button">
            <span class="ci">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </span>
            <span class="cc"><small>EXCHANGE MARKET</small><b>TOWER SHOP</b></span>
          </button>
          <button class="cs-cta primary" id="towerGo" type="button">
            <span class="ci">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/></svg>
            </span>
            <span class="cc">
              <small>INITIALIZE RUN &middot; FLOOR ${start}</small>
              <b>${boss?"ENGAGE BOSS":"INITIATE PENETRATION"}</b>
            </span>
            <span class="cs-chev"><span>&rsaquo;</span><span>&rsaquo;</span><span>&rsaquo;</span></span>
          </button>
        </div>
      </div>
    </div>
  </div></div>`;

  /* ---- binding: id + efek klik SAMA seperti versi lama ---- */
  const g=document.getElementById("towerGo");if(g)g.onclick=()=>{sfx.hit();towerStartRun();};
  const s=document.getElementById("towerShop");if(s)s.onclick=()=>{sfx.hit();towerView="shop";render();};
  const lb=document.getElementById("towerLobby");if(lb)lb.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};
  const dr=document.getElementById("twDropRateBtn");if(dr)dr.onclick=()=>{try{sfx.hit();}catch(e){}openTowerDropModal();};

  /* Lantai DEPLOY & frontier juga bisa ditekan -> jalankan run yang sama
     (run selalu mulai lantai 1, sama seperti CTA). Delegasi supaya tetap hidup
     walau csRenderSlabs menggambar ulang isi menara. */
  const slabHost=document.getElementById("csSlabs");
  if(slabHost){
    const fire=(e)=>{
      const t=e.target;
      const sl=t&&t.closest?t.closest('.cs-slab[role="button"]'):null;
      if(!sl)return;
      try{sfx.hit();}catch(err){}
      towerStartRun();
    };
    slabHost.onclick=fire;
    slabHost.onkeydown=(e)=>{
      if(e.key!=="Enter"&&e.key!==" "&&e.key!=="Spacebar")return;
      if(!e.target.closest||!e.target.closest('.cs-slab[role="button"]'))return;
      e.preventDefault();
      fire(e);
    };
  }

  /* Render menara & wave SETELAH layout terpasang (butuh tinggi stage nyata).
     window.scrollTo(0,0) = pengaman lama: dokumen selalu mulai dari paling atas
     (jangan pakai scrollIntoView — itu ikut men-scroll halaman di HP/APK). */
  requestAnimationFrame(()=>{
    csRepaintHub();
    window.scrollTo(0,0);
  });
}
function renderTowerShop(){
  if(!state.tower)state.tower={best:0};
  const tok=state.infTokens||0;
  /* Potret item: SEMUA ikon lewat `thumbSrc` (242x360, -84% byte) supaya kotak
     42px tidak menarik art penuh. Terukur 8/8 punya `assets/images/thumb/*.webp`.
     Prototipe terkunci (`_tmp/proto_tower_v1.html` S1 HOLO SHELF) memakai satu
     file per item; di produksi yang setara adalah thumb ini. */
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

  /* ------------------------- S1 HOLO SHELF : RAILS ------------------------
     Cermin prototipe terkunci: `RAILS` (lab:1367) + item difilter per `cat`.
     Jumlah = 1 + 1 + 3 + 3 = 8 item, sama persis dengan `ITEMS`. Kalau suatu
     saat isi ITEMS berubah kategori, rail tetap terbentuk dari data — tidak ada
     item yang hilang diam-diam. */
  const RAILS=[
    {key:"EXCHANGE", note:"TOKEN BURN"},
    {key:"WEATHER",  note:"CLIMATE"},
    {key:"AUGMENT",  note:"LUCK"},
    {key:"OVERCLOCK",note:"SPEED"}
  ];

  const shopItemHtml=it=>{
    const isOwned=cardOwned(it);
    const canAfford=tok>=it.cost;
    /* `cnt` = sisa/cadangan yang ditampilkan di baris IN STOCK. `unlock` (kartu
       boss permanen) tidak dipakai ITEMS sekarang, tapi rumusnya dipertahankan
       supaya kalau item `unlock` masuk lagi ia tetap benar. */
    const cnt=it.unlock?state.stacks.filter(s=>s.char===it.unlock).reduce((n,s)=>n+(s.count||1),0):(it.gem?0:stkOf(it.k));
    const dis=isOwned || !canAfford || (it.req && stkOf(it.req)<=0);
    const btnLabel=isOwned ? "✔ UNLOCKED" : (!canAfford ? `DEFICIT ${fmt(it.cost-tok)}` : (it.gem ? "EXCHANGE (+10 GEMS)" : "ACQUIRE SUPPLY"));
    const stock=it.unlock ? (cnt?"×"+cnt:"0") : (it.gem?"∞ UNLIMITED":"×"+cnt);
    const art=ART[it.k]||"";
    /* Struktur = cermin lab `shelfItemHtml` (lab:1385). `data-kind` + kelas
       `fn-buy`/`:disabled` adalah kontrak produksi (binding infBuy di bawah). */
    return `
      <div class="cs-it${dis?" dis":""}" style="--ic:${it.ac}" data-cat="${it.cat}">
        <span class="cs-it-art">
          <i class="cs-it-glow"></i>
          ${art?`<img src="${art}" alt="${it.label}" decoding="async" loading="lazy">`:""}
        </span>
        <span class="cs-it-mid">
          <span class="cs-it-cat"><b class="c1">${it.cat}</b><b class="c2">${it.tier}</b></span>
          <span class="cs-it-nm" title="${it.label}">${it.label}</span>
          <span class="cs-it-ds">${it.sub}</span>
          <span class="cs-it-stock">IN STOCK <b>${stock}</b></span>
        </span>
        <span class="cs-it-right">
          <span class="cs-it-price"><b>${fmt(it.cost)}<i>TOK</i></b></span>
          <button class="fn-buy" type="button" data-kind="${it.k}" ${dis?"disabled":""} title="${it.label}">${btnLabel}</button>
        </span>
      </div>`;
  };

  const railsHtml=RAILS.map(r=>{
    const items=ITEMS.filter(i=>i.cat===r.key);
    if(!items.length)return "";
    return `
      <div class="cs-rail">
        <div class="cs-rail-h"><b>${r.key}</b><i></i><span>${items.length} · ${r.note}</span></div>
        <div class="cs-rail-shelf">${items.map(shopItemHtml).join("")}</div>
      </div>`;
  }).join("");

  /* ============================== SHOP MARKUP =============================
     Port S1 "HOLO SHELF" dari lab terkunci (`_tmp/proto_tower_v1.html`, lab:916
     `#v-shop1`). Mengganti `.tactical-tower-shop-page` + `.tsh-*`/`.thc-*` legacy.
     Struktur: .tw-page > .cs-shop > .cs-shop-top / .cs-shop-body(.cs-shelf >
     .cs-inner > .cs-rail*) / .cs-shop-foot.
     PENTING: container scroll toko = `.cs-shelf`, JANGAN `.cs-stage` — nama
     itu dipakai hub CORE SPIRE (`overflow:hidden` + perspective) dan menang
     cascade, sehingga toko tidak bisa digulir sama sekali.
     Kontrak yang WAJIB tetap: root `.tw-page` (deteksi `body.on-tower` boot.js:341),
     `#towerShopBack` -> `towerView="hub"`, `.fn-buy[data-kind]` -> `infBuy`.
     Nama `.cs-shop`/`.cs-rail`/`.cs-it`/`.fn-buy` diverifikasi 0 aturan lama
     (`grep` 2026-11-05) jadi tidak ada tabrakan cascade. `.tw-hub` SENGAJA tidak
     dipakai: 131 aturan lama + dipakai `js/raid.js`. */
  app.innerHTML=`
  <div class="tw-page tactical-tower-page">
    <div class="cs-shop">

      <!-- ============================ TOP BAR ============================ -->
      <div class="cs-shop-top">
        <button class="cs-back" id="towerShopBack" type="button" title="Return to Spire" aria-label="Return to Spire">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="cs-ttl">
          <div class="cs-kick"><i></i>SPIRE DEPOT · PROCUREMENT</div>
          <div class="cs-name">SPIRE <em>ARMORY</em></div>
        </div>
        <div class="cs-meter">
          <div class="cs-m"><small>TOKEN</small><b class="c">${fmt(tok)}</b></div>
          <div class="cs-m"><small>GEM</small><b class="g">${fmt(state.premiumGems||0)}</b></div>
        </div>
      </div>

      <!-- ======================== BODY : HOLO SHELF ====================== -->
      <div class="cs-shop-body">
        <div class="cs-shelf">
          <div class="cs-inner">${railsHtml}</div>
        </div>
      </div>

      <!-- ============================= FOOT ============================= -->
      <div class="cs-shop-foot">
        <span>${ITEMS.length} SUPPLIES</span><i></i><span>1 TOKEN = 1 RUN</span>
      </div>

    </div>
  </div>`;

  const rb=document.getElementById("towerShopBack");
  if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}towerView="hub";render();};

  app.querySelectorAll(".fn-buy[data-kind]").forEach(btn=>{
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
  if(killed)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe",killed+" CADANGAN KO!","crit");},bsMs(900));
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
    +'<img src="'+cardThumb(g.cardId)+'" alt="'+name+'" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">'
    +'<div class="pr-tfoot" style="color:'+col+'">1 IN '+fmtChance(cv)+'</div>'
    +'</div>';
}
function rrExtra(kind,key,n){
  const isPack=kind==='pack';
  const pot=RR_POTION.find(p=>p.k===key);
  const icon=isPack?(RR_PACK_ICON[key]||''):(pot?pot.icon:'');
  const label=isPack?('INSTAN '+String(key).replace('r','').toUpperCase()):(pot?pot.label:String(key).toUpperCase());
  return '<div class="pr-tile extra" title="'+label+'">'
    +(n>1?'<span class="pr-cnt">×'+fmt(n)+'</span>':'')
    +'<span class="pr-badge" style="background:#22d3ee;color:#000">'+(isPack?'PACK':'POTION')+'</span>'
    +'<span class="pr-exart"><img src="'+icon+'" alt="'+label+'" loading="lazy" decoding="async"></span>'
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
    +'<span class="pr-exart"><img src="'+icon+'" alt="'+r.name+'" loading="lazy" decoding="async"></span>'
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
  const _glLabel = _glActive ? (_glMaxed ? "MAX " + _glMaxMult + "×" : "+10×") : "AKTIFKAN";

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

  /* ---- COMMAND DRAWER v5 markup helpers (ikon inline Solar bold-duotone) ----
     Grup kanan = JUMLAH TILE (prototipe v5 `.gh-n`: "04"/"02"/"05"), bukan
     statistik hidup. Statistik hidup tetap di sub-label tile (missionSub,
     drwDailySub, dst) supaya handler lama tidak perlu diubah. */
  const _drwGrp = function (icon, label, count, statId, tiles) {
    const rows = tiles.map(function (t, i) {
      const badge = t.badge ? '<span class="hx-b"' + (t.badgeId ? ' id="' + t.badgeId + '"' : "") + ">" + t.badge + "</span>" : "";
      const s2 = t.s2 ? '<span class="hx-s2"' + (t.s2Id ? ' id="' + t.s2Id + '"' : "") + ">" + t.s2 + "</span>" : "";
      const pb = t.pbId ? '<span class="hx-pb" aria-hidden="true"><span id="' + t.pbId + '" style="width:' + (t.pbW || 0) + '%"></span></span>' : "";
      const icon2 = (typeof cyberIcon === "function") ? cyberIcon(t.ic, "hx-svg") : "";
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
            return '<button class="pav' + (i === _showIdx ? ' on' : '') + '" type="button" aria-pressed="' + (i === _showIdx ? 'true' : 'false') + '" title="Tampilkan ' + _pn + ' di panggung" style="--mc:' + _pc + '" onclick="if(typeof l12Showcase===\'function\')l12Showcase(' + i + ');">' + _l12SlotThumb(s) + '</button>';
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

      <!-- ============ BAWAH: BUFF (3 chip) + DOCK ============ -->
      <div class="c12foot">
        <div class="hud c12buffs">

          <div class="pots">
            <div class="pot-row" data-block="pot-luck" id="l12PotLuck" role="button" tabindex="0" title="Click to use a Luck Potion" onclick="window.l12TogglePotionTray('luck')">
              <img class="pimg" src="assets/images/pot-luck-${_potLuck ? _potLuck.lv : 1}.webp" alt="">
              <span class="plab">LUCK POT</span><b id="l12PotLuckVal">${_potLuck ? "+" + (_potLuck.flat || 0) + " L" + _potLuck.lv : (_adLuckMs > 0 ? "ADS x2" : "OFF")}</b>
              <span class="tr"><span id="l12PotLuckBar" style="width:${_potLuck ? Math.max(4, Math.min(100, Math.round((_potLuck.endsAt - _now) / _potWin * 100))) : 0}%"></span></span>
              <span class="tm" id="l12PotLuckTm">${_potLuck ? _cd(_potLuck.endsAt - _now) : (_adLuckMs > 0 ? _cd(_adLuckMs) : "--:--")}</span>
              <span class="pstock" id="l12PotLuckStock">${_lkStock}</span>
            </div>
            <div class="pot-row" data-block="pot-speed" id="l12PotSpeed" role="button" tabindex="0" title="Click to use a Speed Potion" onclick="window.l12TogglePotionTray('speed')">
              <img class="pimg" src="assets/images/pot-speed-${_potSpeed ? _potSpeed.lv : 1}.webp" alt="">
              <span class="plab">SPEED POT</span><b id="l12PotSpeedVal">${_potSpeed ? "+" + (_potSpeed.add || 0).toFixed(1) + "x L" + _potSpeed.lv : "OFF"}</b>
              <span class="tr"><span id="l12PotSpeedBar" style="width:${_potSpeed ? Math.max(4, Math.min(100, Math.round((_potSpeed.endsAt - _now) / _potWin * 100))) : 0}%"></span></span>
              <span class="tm" id="l12PotSpeedTm">${_potSpeed ? _cd(_potSpeed.endsAt - _now) : "--:--"}</span>
              <span class="pstock" id="l12PotSpeedStock">${_spStock}</span>
            </div>
            <div class="pot-tray" id="l12PotTray" style="display:none;"></div>
          </div>

          <div class="glw" data-block="global-luck" role="status" id="l12Glw">
            <span class="gicon"><i class="ic i-clover"></i></span>
            <span class="ginfo">
              <span class="ghead"><span class="gtitle">GLOBAL LUCK</span><span class="gpill"><span class="gdot"></span><span id="l12GlStack">${_glStacks}/10</span></span></span>
              <span class="grow"><span class="gmult" id="l12GlMult">${_glMult ? _glMult + "x LUCK" : "OFF"}</span><span class="gtm" id="l12GlTm">${_glActive ? _cd(_glLeft) : "--:--"}</span></span>
            </span>
            <button class="gbtn${_glActive && !_glMaxed ? " stack" : ""}${_glMaxed ? " maxed" : ""}${_glCan ? "" : " unaff"}" type="button" id="l12GlBuy"${_glMaxed ? " disabled" : ""}${_glCan ? "" : ' aria-disabled="true"'} title="${_glCan ? "Buy / stack Global Luck" : "Not enough Gems - need " + _glCost}"><span id="l12GlBuyLab">${_glLabel}</span><span class="gprice"><img src="assets/images/premium-currency.webp" alt=""><span id="l12GlBuyCost">${_glCost}</span></span></button>
          </div>

          <!-- node cuaca tetap ada (JS menulis ke sini) tapi tampil sebagai baris tipis di dock -->
          <div class="wx c12wx" data-block="weather" role="status" id="l12Wx">
            <div class="wx-head">
              <span class="winfo">
                <span class="rdot" style="background:${_w ? _w.color : "var(--cyan)"};"></span>
                <span class="wic" id="l12WxIcon" style="display:inline-flex;align-items:center;justify-content:center;color:${_w ? _w.color : "var(--gold)"};">${_w ? ((typeof weatherSvg === "function") ? weatherSvg(_w.id, 17) : "") : ((typeof weatherSvg === "function") ? weatherSvg("sunny", 17) : '<i class="ic i-sun"></i>')}</span>
                <span class="wname" id="l12WxName">${_w ? String(_w.name || _wId).toUpperCase() : "CLEAR SKY"}</span>
                <span class="wrr" id="l12WxRr">${_wRr || "IDLE"}</span>
              </span>
              <span class="wtm-wrap">
                <span class="wtm" id="l12WxTm">${_wLeft ? _cd(_wLeft) : "--:--"}</span>
              </span>
            </div>
            <div class="wx-cards" id="l12WxCards"></div>
          </div>
        </div>

        <div class="rollbar c12dock">
          <span class="rail rail-roll" aria-hidden="true"></span>
          <span class="l12-slot" id="slotRoll"></span>
          <span class="l12-slot" id="slotAuto"></span>
          <button class="sq c12sq" type="button" onclick="if(typeof toggleBackpack==='function')toggleBackpack();" title="Backpack / Deck">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7.4" width="16" height="13" rx="2"/><path d="M9 7.4V5.6a3 3 0 0 1 6 0v1.8"/></svg>
          </button>
          <button class="sq c12sq" type="button" onclick="if(typeof openPremiumShop==='function')openPremiumShop();" title="Toko Premium">
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
        ${_drwGrp('more', 'UNITS', '04', 'foldCombatStat', [
          { id: 'drwStoryBtn', ic: 'quests', nm: 'Story', hc: '#f3e600', s: 'CAMPAIGN PROGRESS', sId: 'missionSub', s2: '0% COMPLETE', s2Id: 'drwStoryPercent', pbId: 'missionFill', pbW: 0 },
          { id: 'drwRaidBtn', ic: 'skills', nm: 'World Boss', hc: '#f87171', s: 'SHARED HP RAID' },
          { id: 'drwTowerBtn', ic: 'home', nm: 'Tower', hc: '#b58cff', s: 'INFINITE SPIRE', sId: 'drwTowerSub' },
          { id: 'drwRankBtn', ic: 'luck', nm: 'Ranking', hc: '#ffd700', s: 'GLOBAL RANK', sId: 'drwRankSub' }
        ])}
        ${_drwGrp('daily', 'REWARDS', '04', '', [
          { id: 'drwDailyBtn', ic: 'daily', nm: 'Daily', hc: '#4ade80', s: 'CLAIM DAILY REWARD', sId: 'drwDailySub' },
          { id: 'drwAdsBtn', ic: 'ads', nm: 'Free Luck', hc: '#ffd700', s: 'WATCH ADS FOR BOOST', sId: 'drwAdsSub' },
          { id: 'drwGlBtn', ic: 'luck', nm: 'Global Luck', hc: '#22d3ee', s: 'COMMUNITY MULTIPLIER', sId: 'drwGlSub' },
          { id: 'drwWeatherBtn', ic: 'rebirth', nm: 'Weather', hc: '#b58cff', s: 'ATMOSPHERIC BUFF', sId: 'drwWeatherSub' }
        ])}
        ${_drwGrp('supply', 'SHOP', '02', '', [
          { id: 'drwPremiumBtn', ic: 'supply', nm: 'Supply Shop', hc: '#ffd700', s: 'INSTANT ROLL PACKS', sId: 'drwPremiumSub' },
          { id: 'drwRebirthBtn', ic: 'rebirth', nm: 'Rebirth', hc: '#b58cff', s: 'ASCENSION PROTOCOL', sId: 'drwRebirthSub' }
        ])}
        ${_drwGrp('settings', 'SYSTEM', '05', '', [
          { id: 'drwTraitBtn', ic: 'more', nm: 'Trait', hc: '#22d3ee', s: 'PASSIVE OPTIMIZER', sId: 'drwTraitSub' },
          { id: 'drwSkillBtn', ic: 'skills', nm: 'Skill Tree', hc: '#4ade80', s: 'SPEND SKILL POINTS', sId: 'drwSkillSub', badge: '0 SP', badgeId: 'drwSkillSp' },
          { id: 'drwIndexBtn', ic: 'archive', nm: 'Archive', hc: '#22d3ee', s: 'CARD CATALOG', sId: 'drwIndexSub' },
          { id: 'drwSettingsBtn', ic: 'settings', nm: 'Settings', hc: '#f5f5f5', s: 'AUDIO · COMBAT · LANGUAGE' },
          { id: 'drwChangelogBtn', ic: 'changelog', nm: 'Changelog', hc: '#f87171', s: 'RELEASE NOTES' }
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
   Menyinkronkan icon vektor SVG, warna, nama, rarity badge, buff chip, dan kartu eksklusif
   secara instan setiap ada rotasi cuaca / weather potion tanpa menunggu tick. */
function l12UpdateWeatherDock(force){
  const wxEl = document.getElementById("l12Wx");
  if (!wxEl) return;
  const now = Date.now();
  const curWxId = (typeof activeWeatherId === "function") ? activeWeatherId() : null;
  const wLeft = (state && state.weather && state.weather.endsAt) ? Math.max(0, state.weather.endsAt - now) : 0;
  const tmEl = document.getElementById("l12WxTm");
  if (tmEl) tmEl.textContent = wLeft ? ((typeof fmtCountdown === "function") ? fmtCountdown(wLeft) : "") : "--:--";

  if (!force && curWxId === _lastWxId) return;
  _lastWxId = curWxId;

  const curW = (curWxId && typeof WEATHER !== "undefined" && WEATHER[curWxId]) ? WEATHER[curWxId] : null;
  const wColor = curW ? curW.color : "var(--cyan)";
  const wName = curW ? String(curW.name || curWxId).toUpperCase() : "CLEAR SKY · NO ANOMALY";
  const wRar = curW ? String(curW.rar || curW.rarity || "COMMON").toUpperCase() : "IDLE";
  const wBuff = curW ? (curW.luckBonus + "× LUCK · " + curW.speedBonus + "× SPD") : "TARGET WEATHER CARDS";

  const nameEl = document.getElementById("l12WxName");
  if (nameEl) nameEl.textContent = wName;

  const rrEl = document.getElementById("l12WxRr");
  if (rrEl) {
    rrEl.textContent = wRar;
    rrEl.style.borderColor = curW ? curW.color : "rgba(251,113,133,.5)";
    rrEl.style.color = curW ? curW.color : "var(--crimson)";
    rrEl.style.background = curW ? `color-mix(in srgb, ${curW.color} 15%, transparent)` : "rgba(251,113,133,.12)";
  }

  const iconEl = document.getElementById("l12WxIcon") || wxEl.querySelector(".wic");
  if (iconEl) {
    iconEl.id = "l12WxIcon";
    iconEl.style.color = curW ? curW.color : "var(--gold)";
    iconEl.innerHTML = (typeof weatherSvg === "function") ? weatherSvg(curWxId || "sunny", 17) : '<i class="ic i-sun"></i>';
  }

  const rdot = wxEl.querySelector(".rdot");
  if (rdot) rdot.style.background = wColor;

  const wchip = wxEl.querySelector(".wbuff-chip");
  if (wchip) wchip.textContent = wBuff;

  const btnSpan = wxEl.querySelector("#l12WxBtn span");
  if (btnSpan && state) {
    btnSpan.textContent = `SYNTH (${(state.potions || 0) + (state.mythicPotions || 0)})`;
  }

  if (typeof _l12RenderWxCards === "function") {
    _l12RenderWxCards(curWxId);
  }
}
window.l12UpdateWeatherDock = l12UpdateWeatherDock;

  /* ---- TIMER HUD (potion / global luck / weather) ----
     panels.js cuma me-repaint #buffDock/#weatherPanel/#glLobbyWidget miliknya,
     jadi baris v12 ini disegar sendiri dari SUMBER YANG SAMA (luckBuffs(),
     speedBuffs(), _globalLuckCache, state.weather) — bukan angka palsu.
     Interval dibersihkan sendiri begitu lobby tidak ada (pola _telemetryTimer). */
  if (_l12HudTick) clearInterval(_l12HudTick);
  _l12HudTick = setInterval(() => {
    if (!document.querySelector(".lobby-hub.l12")) { clearInterval(_l12HudTick); _l12HudTick = null; return; }
    const now = Date.now();
    const put = (id, txt) => { const e = document.getElementById(id); if (e && e.textContent !== txt) e.textContent = txt; };
    const wid = (id, pct) => { const e = document.getElementById(id); if (e) e.style.width = pct + "%"; };

    // 1. Live Header Telemetry & Live Stats
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

      // Live Potion Stock update
      const curLkP = Array.isArray(state.luckPots) ? state.luckPots : [0,0,0];
      const curSpP = Array.isArray(state.speedPots) ? state.speedPots : [0,0,0];
      put("l12PotLuckStock", "🧪" + ((curLkP[0]||0) + (curLkP[1]||0) + (curLkP[2]||0)));
      put("l12PotSpeedStock", "🧪" + ((curSpP[0]||0) + (curSpP[1]||0) + (curSpP[2]||0)));
    }

    // 2. Potion Buffs
    const lb = (typeof luckBuffs === "function") ? luckBuffs().slice().sort((a, b) => a.lv - b.lv).pop() : null;
    const sb = (typeof speedBuffs === "function") ? speedBuffs().slice().sort((a, b) => a.lv - b.lv).pop() : null;
    const adMs = (typeof adLuckLeftMs === "function") ? adLuckLeftMs() : 0;
    const win = (typeof WEATHER_MS !== "undefined") ? WEATHER_MS : 300000;
    if (lb) {
      put("l12PotLuckVal", "+" + (lb.flat || 0) + " L" + lb.lv);
      put("l12PotLuckTm", (typeof fmtCountdown === "function") ? fmtCountdown(lb.endsAt - now) : "");
      wid("l12PotLuckBar", Math.max(2, Math.min(100, Math.round((lb.endsAt - now) / win * 100))));
    } else {
      put("l12PotLuckVal", adMs > 0 ? "ADS ×2" : "OFF");
      put("l12PotLuckTm", adMs > 0 ? ((typeof fmtCountdown === "function") ? fmtCountdown(adMs) : "") : "--:--");
      wid("l12PotLuckBar", 0);
    }
    if (sb) {
      put("l12PotSpeedVal", "+" + (sb.add || 0).toFixed(1) + "× L" + sb.lv);
      put("l12PotSpeedTm", (typeof fmtCountdown === "function") ? fmtCountdown(sb.endsAt - now) : "");
      wid("l12PotSpeedBar", Math.max(2, Math.min(100, Math.round((sb.endsAt - now) / win * 100))));
    } else {
      put("l12PotSpeedVal", "OFF"); put("l12PotSpeedTm", "--:--"); wid("l12PotSpeedBar", 0);
    }

    // 3. Global Luck
    const gl = (typeof _globalLuckCache !== "undefined") ? _globalLuckCache : null;
    const glOn = !!(gl && now < new Date(gl.ends_at).getTime());
    put("l12GlMult", glOn ? ((gl.multiplier || 0) + "× LUCK") : "OFF");
    put("l12GlTm", glOn ? ((typeof fmtCountdown === "function") ? fmtCountdown(new Date(gl.ends_at).getTime() - now) : "") : "--:--");
    put("l12GlStack", Math.min(10, glOn ? Math.max(1, Math.round((gl.multiplier || 0) / 10)) : 0) + "/10 STACK");

    // 4. Weather live check & auto-refresh cards if weather changes
    l12UpdateWeatherDock();

    /* +10x: label, harga, dan status mampu/tidak ikut saldo gem */
    const glCost = (typeof GLOBAL_LUCK_COST !== "undefined") ? GLOBAL_LUCK_COST : 0;
    const glMax = (typeof GLOBAL_LUCK_MAX_MULT !== "undefined") ? GLOBAL_LUCK_MAX_MULT : 100;
    const glCan = (state && state.premiumGems || 0) >= glCost;
    const glMaxed = glOn && ((gl.multiplier || 0) >= glMax);
    put("l12GlBuyLab", glOn ? (glMaxed ? "MAX " + glMax + "×" : "+10×") : "AKTIFKAN");
    put("l12GlBuyCost", String(glCost));
    const gb = document.getElementById("l12GlBuy");
    if (gb) {
      gb.classList.toggle("unaff", !glCan);
      gb.classList.toggle("maxed", glMaxed);
      gb.classList.toggle("stack", glOn && !glMaxed);
      gb.disabled = glMaxed;
      if (glCan) gb.removeAttribute("aria-disabled"); else gb.setAttribute("aria-disabled", "true");
      gb.title = glCan ? (glMaxed ? "Global Luck already MAX" : "Buy / stack Global Luck") : ("Not enough Gems — need " + glCost);
    }
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
  const _glBuy = document.getElementById("l12GlBuy");
  if (_glBuy) _glBuy.onclick = () => {
    if (typeof sfx !== "undefined" && sfx.hit) sfx.hit();
    if (typeof buyGlobalLuck !== "function") return;
    const r = buyGlobalLuck();
    if (r && typeof r.then === "function") {
      r.then(() => { if (document.querySelector(".lobby-hub.l12")) renderLobby(); }).catch(() => {});
    }
  };
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

/* ---- WEATHER CARDS ENGINE ---- */
function _l12RenderWxCards(activeWeatherId) {
  const container = document.getElementById("l12WxCards");
  if (!container) return;
  let cards = [];
  if (typeof window.l12GetWeatherCards === "function") {
    cards = window.l12GetWeatherCards(activeWeatherId);
  } else if (typeof MASTER_CARD_INDEX !== "undefined") {
    cards = activeWeatherId
      ? MASTER_CARD_INDEX.filter(c => c && c.weatherOnly === activeWeatherId)
      : MASTER_CARD_INDEX.filter(c => c && !!c.weatherOnly).slice(0, 8);
  }
  if (!cards || !cards.length) {
    container.innerHTML = '<span class="wx-cards-empty">NO EXCLUSIVE CARDS</span>';
    return;
  }
  const displayCards = activeWeatherId ? cards : cards.slice(0, 8);
  const stacks = (typeof state !== "undefined" && state && Array.isArray(state.stacks)) ? state.stacks : [];
  const ownedSet = new Set(stacks.map(s => s && s.char));

  container.innerHTML = displayCards.map(c => {
    const cid = c.char_id || c.id;
    const isOwned = typeof c.owned === "boolean" ? c.owned : ownedSet.has(cid);
    const thumb = c.thumb || ((typeof cardThumb === "function") ? cardThumb(cid) : "");
    const tier = c.tier || "UR";
    const wId = c.weatherId || c.weatherOnly || "";
    const wCol = c.weatherColor || ((typeof WEATHER !== "undefined" && WEATHER[wId] && WEATHER[wId].color) ? WEATHER[wId].color : "#38bdf8");
    const tag = (!activeWeatherId && wId) ? String(wId).slice(0, 4).toUpperCase() : tier;
    const rawCh = c.chance || ((typeof luckChance === "function") ? luckChance(cid) : 0);
    const chanceStr = (typeof fmtChance === "function") ? fmtChance(rawCh) : rawCh;
    const wName = c.weatherName || wId.toUpperCase();
    return `
      <div class="wx-card-slot wc-slot ${isOwned ? 'owned' : 'unowned'}"
           style="--wc:${wCol}"
           data-wc="${cid}"
           onclick="if(typeof openWeatherMachine==='function')openWeatherMachine();"
           title="${c.name} [${wName}] ? ${tier} ? 1 in ${chanceStr} (${isOwned ? 'OWNED' : 'NOT OWNED'})">
        <img src="${thumb}" alt="${c.name}" loading="lazy">
        <span class="wx-c-tag">${tag}</span>
        <span class="wx-c-ch">1:${chanceStr}</span>
      </div>
    `;
  }).join("");

  if (typeof wcHoverBind === "function") {
    try { wcHoverBind(); } catch(e) {}
  }
}

/* ---- QUICK-USE POTION POPOVER TRAY ---- */
/* Tray dibuka ke atas dari baris potion dan menutupi 4 lingkaran party
   (terukur 44x44 per slot di 320/500/850/1400). Kelas body ini menyembunyikan
   lingkaran selama tray terbuka; CSS juga punya varian :has() sebagai cadangan. */
function _l12PotTrayClass(on) {
  try { document.body.classList.toggle("pot-tray-open", !!on); } catch (e) {}
}

window.l12TogglePotionTray = function(type) {
  const tray = document.getElementById("l12PotTray");
  if (!tray) return;
  const isOpen = tray.classList.contains("open") && tray.getAttribute("data-active-type") === type;
  if (isOpen) {
    window.l12ClosePotionTray();
    return;
  }
  tray.setAttribute("data-active-type", type);
  tray.classList.add("open");
  tray.style.display = "flex";
  _l12PotTrayClass(true);
  _l12RefreshPotionTray(type);
};

window.l12ClosePotionTray = function() {
  const tray = document.getElementById("l12PotTray");
  if (tray) {
    tray.classList.remove("open");
    tray.style.display = "none";
    tray.removeAttribute("data-active-type");
  }
  _l12PotTrayClass(false);
};

function _l12RefreshPotionTray(type) {
  const tray = document.getElementById("l12PotTray");
  if (!tray) return;
  const t = type || tray.getAttribute("data-active-type") || "luck";
  const pots = t === "luck"
    ? (Array.isArray(state && state.luckPots) ? state.luckPots : [0,0,0])
    : (Array.isArray(state && state.speedPots) ? state.speedPots : [0,0,0]);
  const isLuck = t === "luck";
  const title = isLuck ? "?? LUCK POTION (SELECT LEVEL)" : "? SPEED POTION (SELECT LEVEL)";
  const effs = isLuck
    ? ["+3 LUCK", "+5 & +10%", "+10 & +20%"]
    : ["+0.2? SPD", "+0.5? SPD", "+1.0? SPD"];

  tray.innerHTML = `
    <div class="pot-tray-head">
      <span>${title}</span>
      <button class="pot-tray-close" type="button" onclick="window.l12ClosePotionTray()" title="Close" style="background:none;border:0;color:var(--ice);cursor:pointer;font-size:11px;padding:0 4px;">?</button>
    </div>
    <div class="pot-tray-grid">
      ${[1, 2, 3].map(lv => {
        const stk = pots[lv - 1] || 0;
        const canUse = stk > 0;
        return `
          <button class="pot-lv-btn ${canUse ? 'ready' : 'empty'}" type="button"
                  onclick="window.l12InvokePotion('${t}', ${lv})"
                  title="${canUse ? 'Use 1 bottle Level ' + lv + ' (+5 min)' : 'Out of stock ? get more in Shop / Tower'}">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;font-size:8.5px;">
              <b style="color:var(--gold)">LV.${lv}</b>
              <span style="font-family:var(--mono);color:${canUse ? '#6ee7b7' : '#94a3b8'}">x${stk}</span>
            </div>
            <img src="assets/images/pot-${t}-${lv}.webp" alt="L${lv}" style="width:22px;height:22px;object-fit:contain;">
            <span style="font-size:8px;color:var(--ice);white-space:nowrap;">${effs[lv - 1]}</span>
            <span style="font-size:7.5px;font-weight:800;padding:1px 5px;background:${canUse ? 'rgba(16,185,129,0.22)' : 'rgba(148,163,184,0.12)'};border:1px solid ${canUse ? 'rgba(52,211,153,0.55)' : 'rgba(148,163,184,0.25)'};color:${canUse ? '#6ee7b7' : '#94a3b8'}">${canUse ? '+ PAKAI' : 'EMPTY'}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;

  const curLkP = Array.isArray(state && state.luckPots) ? state.luckPots : [0,0,0];
  const curSpP = Array.isArray(state && state.speedPots) ? state.speedPots : [0,0,0];
  const lkStock = (curLkP[0]||0) + (curLkP[1]||0) + (curLkP[2]||0);
  const spStock = (curSpP[0]||0) + (curSpP[1]||0) + (curSpP[2]||0);
  const lkEl = document.getElementById("l12PotLuckStock");
  if (lkEl) lkEl.textContent = "??" + lkStock;
  const spEl = document.getElementById("l12PotSpeedStock");
  if (spEl) spEl.textContent = "??" + spStock;
}

window.l12InvokePotion = function(type, lv) {
  let res = null;
  if (typeof window.l12UsePotionQuick === "function") {
    res = window.l12UsePotionQuick(type, lv);
  } else if (type === "luck" && typeof useLuckPotion === "function") {
    res = useLuckPotion(lv, 1);
  } else if (type === "speed" && typeof useSpeedPotion === "function") {
    res = useSpeedPotion(lv, 1);
  }
  _l12RefreshPotionTray(type);
  const now = Date.now();
  const win = (typeof WEATHER_MS !== "undefined") ? WEATHER_MS : 300000;
  const lb = (typeof luckBuffs === "function") ? luckBuffs().slice().sort((a, b) => a.lv - b.lv).pop() : null;
  const sb = (typeof speedBuffs === "function") ? speedBuffs().slice().sort((a, b) => a.lv - b.lv).pop() : null;
  if (lb) {
    const v = document.getElementById("l12PotLuckVal"); if (v) v.textContent = "+" + (lb.flat || 0) + " L" + lb.lv;
    const t = document.getElementById("l12PotLuckTm"); if (t && typeof fmtCountdown === "function") t.textContent = fmtCountdown(lb.endsAt - now);
    const b = document.getElementById("l12PotLuckBar"); if (b) b.style.width = Math.max(4, Math.min(100, Math.round((lb.endsAt - now) / win * 100))) + "%";
  }
  if (sb) {
    const v = document.getElementById("l12PotSpeedVal"); if (v) v.textContent = "+" + (sb.add || 0).toFixed(1) + "? L" + sb.lv;
    const t = document.getElementById("l12PotSpeedTm"); if (t && typeof fmtCountdown === "function") t.textContent = fmtCountdown(sb.endsAt - now);
    const b = document.getElementById("l12PotSpeedBar"); if (b) b.style.width = Math.max(4, Math.min(100, Math.round((sb.endsAt - now) / win * 100))) + "%";
  }
  return res;
};

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
          <img src="${thumb}" alt="${name}" loading="lazy">
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
    <div class="dpr-ico"><img src="${r.icon}" alt="" decoding="async" loading="lazy"></div>
    <div class="dpr-txt">
      <span class="dpr-nm">${r.nm}</span>
      <span class="dpr-sub">${r.sub}</span>
    </div>
    <span class="dpr-rate">${r.rate}</span>
  </div>`;
}
function twrPackRow(d){
  return `<div class="dpr">
    <div class="dpr-ico"><img src="${d.icon}" alt="" decoding="async" loading="lazy"></div>
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
      <div class="dpr-rare-img"><img src="${r.img}" alt="${r.name}" decoding="async" loading="lazy"></div>
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
