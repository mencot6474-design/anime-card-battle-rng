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
  const en=w.en,es=w.es;
  return `<div class="fighter foe foe-enter" data-tier="${en.tier||''}">
    <div class="f-banner"><img src="${en.img}" alt="${en.name}"><div class="f-name">${en.name}</div>
      </div>
    <div class="hpbar"><i id="hpFoe"></i><span id="hpFoeT">${fmt(es.hp)} / ${fmt(es.hp)}</span></div>
    <div class="f-body">
      <div class="f-title">${en.epithet}</div>
      <div class="f-skill">${en.id?passiveName(en.id):"Musuh"}</div>
      <div class="stat-row"><div class="stat">&#9825; ${fmt(es.hp)}</div><div class="stat">${ATKIC} ${fmt(es.atk)}</div></div>
    </div>
  </div>`;
}
/* Rail slot musuh = 3 kotak gambar gelombang BERIKUTNYA (miror bench-rail pemain), ditambal placeholder biar tetap 3.
   Diposisikan grid CSS (.foe-side .bench-rail{grid-area:foe-slot}) jadi nongol di ATAS arena, sejajar kartu+HP pemain. */
function towerEnemyBenchRail(){
  const rem=towerRun?towerRun.waves.slice(towerRun.idx+1):[];
  let html="";
  for(let i=0;i<3;i++){
    const w=rem[i];
    if(w&&w.en){
      const wHp=(w.hp!=null?w.hp:w.es.hp),wPct=Math.max(0,Math.min(100,Math.round(wHp/w.es.hp*100)));
      html+=`<div class="bench-sq foe-sq" data-tier="${w.en.tier||''}" style="border-color:${TIER_COLOR[w.en.tier]||'var(--line)'};${w.dead?'filter:grayscale(1);opacity:.55;':''}" title="${w.en.name}${w.dead?' (KO)':''}"><img src="${w.en.img}" alt="${w.en.name}"><span class="bhp"><i style="width:${wPct}%"></i></span>${w.dead?'<b style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#ff5c5c;font-weight:800;font-size:11px">KO</b>':''}</div>`;
    } else {
      html+=`<div class="bench-sq empty"></div>`;
    }
  }
  return `<div class="bench-rail foe-rail">${html}</div>`;
}
function towerFoeSide(w){return towerFoeHtml(w)+towerEnemyBenchRail();}
// class foe-enter punya spesifisitas lebih tinggi dari .fighter.hit → hapus begitu animasi masuk selesai biar kartu musuh bisa bergoyang kena pukul
function clearFoeEnter(){setTimeout(()=>{const e=document.querySelector(".fighter.foe.foe-enter");if(e)e.classList.remove("foe-enter");},700);}
function towerEnter(f){
  if(!state.tower)state.tower={best:0};
  if(!towerRun)towerRun={cleared:0,cards:0,coins:0,drops:{weather:0,luck:0,speed:0},tokens:0,pendingRolls:0};
  if(towerRun.pendingRolls==null)towerRun.pendingRolls=0;
  towerRun.floor=f; towerRun.waves=towerWaves(f); towerRun.idx=0;
  towerView="battle";
  render();
}
function towerStartRun(){
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
  const tier=c.tier;
  const badge=(isBoss&&idx===0)?"BOSS":tier;
  return `<div class="tw-fcard${isBoss&&idx===0?" bossx":""}" data-tier="${tier}" style="--fc:${TIER_COLOR[tier]};animation-delay:${-idx*0.7}s">
    <img src="${c.sprite_asset}" alt="${c.name}"${c.pos?` style="object-position:${c.pos}"`:''}>
    <span class="fn">${c.name}</span>
    <span class="fb">${badge}</span>
    <span class="fs"><span class="hp"><i>HP</i> <b>${fmt(w.es.hp)}</b></span><span class="atk"><i>ATK</i> <b>${fmt(w.es.atk)}</b></span></span>
  </div>`;
}
function renderTowerHub(){
  if(!state.tower)state.tower={best:0};
  const best=state.tower.best||0;
  const start=1;                       /* selalu mulai Lantai 1 */
  const boss=towerIsBossFloor(start);
  const waves=towerWaves(start);
  /* tangga: jendela 1-12; pin REKOR di lantai best (kalau muat di jendela) */
  let fl="";
  for(let f=1;f<=12;f++){
    const isB=towerIsBossFloor(f);
    const cls=(f===start?"next":(f<=best?"cleared":"locked"))+(isB?" boss":"");
    fl+=`<div class="fl ${cls}"><span class="num">${String(f).padStart(2,"0")}</span><span class="lbl">${isB?"BOS":"GELOMBANG"}</span>${f===best&&best>0?'<span class="pin">REKOR</span>':""}</div>`;
  }
  app.innerHTML=`<div class="tw-page">
  <div class="tw-hub">
    <section class="tw-stage">
      <div class="tw-stage-eyebrow">INFINITE TOWER</div>
      <div class="twr-watermark">${start}</div>
      <div class="twr-wrap">
        <div class="beacon"></div>
        <div class="twr-shadow"></div>
        <div class="twr">${fl}</div>
      </div>
      <div class="tw-stage-hint"><kbd>MULAI</kbd> NAIK SETINGGI MUNGKIN</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="tw-title">INFINITE TOWER</div>
        <div class="tw-sub">MENARA TANPA UJUNG &middot; SEKALI JALAN DARI LANTAI 1 SAMPAI KALAH</div>
      </div>
      <div class="tw-stats">
        <div class="tbs acc"><span>BEST LANTAI</span><b>${best}</b></div>
        <div class="tbs vio"><span>TOKEN INF</span><b>${fmt(state.infTokens||0)}</b></div>
        <div class="tbs"><span>LANTAI MULAI</span><b>${start}</b></div>
      </div>
      <div class="eyebrow">MUSUH &middot; LANTAI ${start}</div>
      <div class="tw-foes">${waves.map((w,i)=>towerPreviewCard(w,boss,i===0?"main":"tag",i)).join("")}</div>
      <div class="tw-acts">
        <button class="act go" id="towerGo">
          <span class="amed"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M19 21l2-2"/></svg></span>
          <span class="atxt"><small>Mulai run baru</small><b>MULAI DARI LANTAI ${start}</b></span>
        </button>
        <button class="act violet" id="towerShop">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>
          <span class="atxt"><small>Belanja token</small><b>TOKO INF</b></span>
        </button>
        <button class="act cyan" id="towerLobby">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></span>
          <span class="atxt"><small>Kembali</small><b>LOBBY</b></span>
        </button>
      </div>
      <p class="tw-note">Tiap lantai ditaklukkan: musuh mati &rarr; otomatis naik ke lantai berikutnya (tanpa konfirmasi). Peluang hadiah per lantai: <b class="c">Instant roll 50 kartu (50%)</b> &middot; Weather Potion (5%) &middot; Luck Potion +1 (10%) &middot; Speed Potion +1 (10%). Tiap lantai juga kasih <b class="v">+1 Token Inf</b> (bos +5) buat dibelanjakan di TOKO INF.</p>
    </section>
  </div></div>`;
  const g=document.getElementById("towerGo");if(g)g.onclick=()=>{sfx.hit();towerStartRun();};
  const s=document.getElementById("towerShop");if(s)s.onclick=()=>{sfx.hit();towerView="shop";render();};
  const lb=document.getElementById("towerLobby");if(lb)lb.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};
}
function renderTowerShop(){
  if(!state.tower)state.tower={best:0};
  const tok=state.infTokens||0;
  const ICON={weather:'<img src="assets/images/icon-potion.png" onerror="this.parentNode.textContent=\'🧪\'">',mythic:'✨',
    luck1:'<img src="assets/images/pot-luck-1.png" onerror="this.parentNode.textContent=\'🍀\'">',luck2:'<img src="assets/images/pot-luck-2.png" onerror="this.parentNode.textContent=\'🍀\'">',luck3:'<img src="assets/images/pot-luck-3.png" onerror="this.parentNode.textContent=\'🍀\'">',
    speed1:'<img src="assets/images/pot-speed-1.png" onerror="this.parentNode.textContent=\'⚡\'">',speed2:'<img src="assets/images/pot-speed-2.png" onerror="this.parentNode.textContent=\'⚡\'">',speed3:'<img src="assets/images/pot-speed-3.png" onerror="this.parentNode.textContent=\'⚡\'">'};
  const item=(k,label,desc,cost)=>`<div class="inf-item">
      <div class="inf-item-ic">${ICON[k]||'🧪'}</div>
      <div class="inf-item-info"><div class="inf-item-name">${label}</div><div class="inf-item-desc">${desc}</div></div>
      <button class="inf-item-buy" ${tok<cost?'disabled':''} onclick="infBuy('${k}')">${cost}<small>TOKEN</small></button>
    </div>`;
  /* data item (teks & harga = versi live) — state dari state live */
  const ITEMS=[
    {k:"weather",label:"WEATHER POTION",sub:"Gacha cuaca ikut chance asli, 5 menit (hasil sama/lebih bagus dari cuaca aktif = pindah + reset timer; lebih jelek = cuaca tetep).",cost:10,req:null,ac:"var(--ice)"},
    {k:"luck1",label:"LUCK POTION L1",sub:"+3 flat luck selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:10,req:null,ac:"var(--green)"},
    {k:"luck2",label:"LUCK POTION L2",sub:"+5 flat luck & +10% luck selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:50,req:null,ac:"var(--green)"},
    {k:"luck3",label:"LUCK POTION L3",sub:"+10 flat luck & +20% luck selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:250,req:null,ac:"var(--green)"},
    {k:"speed1",label:"SPEED POTION L1",sub:"Roll speed +0.2× (≈1.2×) selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:10,req:null,ac:"var(--amber)"},
    {k:"speed2",label:"SPEED POTION L2",sub:"Roll speed +0.5× (≈1.5×) selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:50,req:null,ac:"var(--amber)"},
    {k:"speed3",label:"SPEED POTION L3",sub:"Roll speed +1.0× (2×) selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:250,req:null,ac:"var(--amber)"},
    {k:"mythic",label:"MYTHIC WEATHER POTION",sub:"Upgrade 1 Weather Potion -> Mythic: APOCALYPSE chance 3% (durasi 5 menit). Butuh 1 Weather Potion.",cost:50,req:"weather",ac:"var(--violet)"}
  ];
  const stkOf=k=>k==="weather"?(state.potions||0):k.startsWith("luck")?(state.luckPots&&state.luckPots[+k.slice(-1)-1])||0:k.startsWith("speed")?(state.speedPots&&state.speedPots[+k.slice(-1)-1])||0:(state.mythicPotions||0);
  if(window.shopSel==null||window.shopSel>=ITEMS.length)window.shopSel=0;
  let swapT=null;
  const renderList=()=>{
    document.getElementById("shopList").innerHTML=ITEMS.map((it,i)=>`
      <div class="srow${i===window.shopSel?" on":""}" data-i="${i}" style="--ac:${it.ac}">
        <span class="sic">${ICON[it.k]||"🧪"}</span>
        <span class="sinfo"><span class="sname">${it.label}</span></span>
        <span class="scost"><b>${it.cost}</b><span>TOKEN</span></span>
        ${stkOf(it.k)>0?`<span class="sown">&times;${stkOf(it.k)}</span>`:""}
      </div>`).join("");
    document.querySelectorAll(".srow").forEach(r=>r.onclick=()=>{window.shopSel=+r.dataset.i;renderList();renderDetail();});
  };
  const renderBuy=()=>{
    const it=ITEMS[window.shopSel],btn=document.getElementById("shopBuy");
    /* restart animasi biar tombol ikut gerak tiap ganti item */
    btn.style.animation="none";void btn.offsetWidth;btn.style.animation="";
    let small="Beli item ini",big=`BELI — ${it.cost} TOKEN`,dis=false;
    if(tok<it.cost){small="Token tidak cukup";big=`KURANG ${it.cost-tok} TOKEN`;dis=true;}
    else if(it.req&&stkOf(it.req)<=0){small="Syarat belum terpenuhi";big="BUTUH 1 WEATHER POTION";dis=true;}
    btn.disabled=dis;
    btn.innerHTML=`<span class="amed">${ICON[it.k]||"🧪"}</span><span class="atxt"><small>${small}</small><b>${big}</b></span>`;
  };
  const renderDetail=immediate=>{
    const it=ITEMS[window.shopSel],box=document.getElementById("shopDetail");
    clearTimeout(swapT);
    const paint=()=>{
      box.classList.remove("out");
      box.innerHTML=`
      <div class="sd-head" style="--ac:${it.ac}">
        <span class="sbig">${ICON[it.k]||"🧪"}</span>
        <span><span class="sd-kicker">${it.k==="mythic"?"UPGRADE · MYTHIC":"POTION · KONSUMSI"}</span><div class="sd-name">${it.label}</div></span>
      </div>
      <p class="sd-desc">${it.sub}</p>
      <div class="sd-meta" style="--ac:${it.ac}">
        <div class="sd-mrow"><span class="k">HARGA</span><span class="v c">${it.cost} TOKEN INF</span></div>
        <div class="sd-mrow"><span class="k">DIMILIKI</span><span class="v g">&times;${stkOf(it.k)}</span></div>
        ${it.req?`<div class="sd-mrow"><span class="k">SYARAT</span><span class="v ${stkOf(it.req)>0?"v":"no"}">${stkOf(it.req)>0?"PUNYA ×"+stkOf(it.req)+" WEATHER":"BUTUH 1 WEATHER POTION"}</span></div>`:""}
        <div class="sd-mrow"><span class="k">SISA TOKEN</span><span class="v c">${tok} / ${it.cost}</span></div>
      </div>`;
      renderBuy();
    };
    if(immediate||!box.children.length){paint();return;}
    box.classList.add("out");              /* fade + geser keluar dulu */
    swapT=setTimeout(paint,140);           /* lalu ganti isi + stagger masuk */
  };
  app.innerHTML=`<div class="tw-page">
  <div class="tw-hub shop-hub">
    <section class="tw-stage shop-stage">
      <div class="tw-stage-top">
        <button class="backlink" id="shopBack">&#8592; KEMBALI KE TOWER</button>
        <div class="tw-stage-eyebrow">TOKO INF</div>
      </div>
      <div class="slist" id="shopList"></div>
      <div class="tw-stage-hint"><kbd>TOKEN</kbd> DIDAPAT TIAP LANTAI DITAKLUKKAN</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="tw-title">TOKO INF</div>
        <div class="tw-sub">BELANJA PAKAI TOKEN INF &middot; HASIL NAIK LANTAI</div>
      </div>
      <div class="tw-stats">
        <div class="tbs acc"><span>TOKEN INF</span><b>${fmt(tok)}</b></div>
        <div class="tbs vio"><span>MYTHIC</span><b>${fmt(state.mythicPotions||0)}</b></div>
        <div class="tbs"><span>WEATHER</span><b>${fmt(state.potions||0)}</b></div>
      </div>
      <div class="eyebrow">DETAIL ITEM</div>
      <div class="sdetail" id="shopDetail"></div>
      <button class="act go buyswap" id="shopBuy"></button>
      <p class="tw-note">Tiap lantai ditaklukkan: <b class="v">+1 Token Inf</b> (bos lantai kelipatan 5: <b class="v">+5</b>) &middot; Drop potion per lantai: <b class="c">Weather 5%</b> &middot; Luck 10% &middot; Speed 10%.</p>
    </section>
  </div></div>`;
  renderList();renderDetail(true);
  const rb=document.getElementById("shopBack");if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}towerView="hub";render();};
  const bi=document.getElementById("shopBuy");if(bi)bi.onclick=()=>{if(bi.disabled)return;infBuy(ITEMS[window.shopSel].k);};
}
function infBuy(kind){
  const cost={weather:10,luck1:10,luck2:50,luck3:250,speed1:10,speed2:50,speed3:250,mythic:50}[kind]; if(cost==null)return;
  if((state.infTokens||0)<cost){toast("TOKEN KURANG","TOKEN INF TIDAK CUKUP","#f87171");return;}
  if(kind==='mythic'&&(state.potions||0)<1){toast("Butuh 1 Weather Potion","GAK BISA","#f87171");return;}
  state.infTokens-=cost;
  if(kind==='weather')state.potions=(state.potions||0)+1;
  else if(kind.startsWith('luck')){state.luckPots=state.luckPots||[0,0,0];state.luckPots[+kind.slice(-1)-1]++;}
  else if(kind.startsWith('speed')){state.speedPots=state.speedPots||[0,0,0];state.speedPots[+kind.slice(-1)-1]++;}
  else if(kind==='mythic'){state.potions--;state.mythicPotions=(state.mythicPotions||0)+1;}
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
  bt={speed:battleSpeedEff(),fgen:++FGEN,lv:null,tower:true,en:w.en,es:w.es,eq,fighters,eid:w.eid,efx:w.efx,active:0,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:w.es.hp,turn:1,over:false,eBurn:0,ePoison:0,pGuardDr:0,eAbilityOff:0,voidUsed:false,pCopyFx:null,spCd:[],spTurn:[],spArmed:[],spWave:[],meteorGuard:[],phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),shatterGuard:new Array(fighters.length).fill(false),defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,psychic:null,atkEntryGuard:new Array(fighters.length).fill(false),sleepLeft:new Array(fighters.length).fill(0),sleepArmed:new Array(fighters.length).fill(false),overflow:0,rain:null,freezeLeft:0,shockCount:new Array(fighters.length).fill(0),shadow:null,freezeNext:false,valhallaLeft:0,paintHits:[],eInk:0,eInkPct:0,wc:null,rearIdx:-1,rearWaiting:false,rearUsed:[],senzu:{},senzuFin:false,balloon:0,stretchShot:0,turret:0,hvCount:new Array(fighters.length).fill(0),excited:false,weCount:new Array(fighters.length).fill(0),weRevived:false,pbRocks:0,pbKey:"",pbStreak:0,rubber:false,rbBounce:0,dizzyStack:0,dizzyLeft:0};
  const tfx=resolveFx(eq,w.efx);
  if(tfx&&tfx.entryCounter)bt.entryGuard[0]=true;
  if(tfx&&tfx.entryShatter)bt.shatterGuard[0]=true;
  if(tfx&&tfx.entryMaxHp)bt.bioGuard[0]=true;
  if(tfx&&tfx.meteorWave)bt.meteorGuard[0]=true;
  if(tfx&&tfx.entryAtkPct)bt.atkEntryGuard[0]=true;
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
  schedPhase(700,step);
}
function foeDown(){
  /* RE-ENTRANCY GUARD: AOE (meteor/quake) + serangan biasa bisa men-schedule foeDown 2x untuk kill yang sama.
     Tanpa guard ini advanceTowerFoe kejar 2x: gelombang hidup ke-skip, kill-reward dobel, dan musuh kebagian giliran dobel.
     Hasilnya kartu pemain mati mendadak pas ngeluarin AOE di tower. */
  if(!bt||bt.over)return;
  if(bt.eHp>0)return;/* STALE-CALL GUARD: kill ini udah keproses — musuh baru udah ke-load (eHp>0), jangan advance dobel */
  if(bt.foeDowning)return;
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
  let hitW=null;
  for(let i=towerRun.idx+1;i<towerRun.waves.length;i++){
    const w=towerRun.waves[i];
    if(!w||w.dead)continue;
    hitW=w;break;
  }
  if(!hitW)return;
  if(hitW.hp==null)hitW.hp=hitW.es.hp;
  hitW.hp-=dmg;
  if(hitW.hp<=0){hitW.hp=0;hitW.dead=true;}
  const rail=document.querySelector(".foe-rail");
  if(rail)rail.outerHTML=towerEnemyBenchRail();
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","PIERCE -"+fmt(dmg),"crit");},bsMs(640));
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
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","AOE -"+fmt(dmg)+" (lineup)","crit");},bsMs(640));
  if(killed)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe",killed+" CADANGAN KO!","crit");},bsMs(900));
}
function advanceTowerFoe(){
  if(!bt||bt.over)return;
  bt.fgen=++FGEN;/* generasi musuh: cb basi dari kill sebelumnya bakal kebuang */
  do{towerRun.idx++;}while(towerRun.idx<towerRun.waves.length&&towerRun.waves[towerRun.idx]&&towerRun.waves[towerRun.idx].dead);
  if(towerRun.idx>=towerRun.waves.length){endBattle(true);return;}
  const w=towerRun.waves[towerRun.idx];
  bt.en=w.en;bt.es=w.es;bt.eid=w.eid;bt.efx=w.efx;bt.eHp=w.es.hp;
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
  if(bt.overflow&&bt.overflow>0){bt.eHp-=bt.overflow;bt.overflow=0;}
  /* sama seperti tag-in pemain: slot 1 tumbang dulu di arena, lalu slot 2 naik dan slot 1 jatuh ke TAG
     dengan tanda ✕ — sebelumnya kartu gelombang 1 langsung diganti diam-diam */
  const downEl=document.querySelector(".fighter.foe");
  if(downEl){downEl.classList.remove("foe-enter");downEl.classList.add("ko");koFx(downEl);}
  floatText(".fighter.foe","KO","crit");
  bt.turn++;
  setTimeout(()=>{
    if(!bt||bt.over)return;
    const side=document.getElementById("foeSide");
    if(side)side.innerHTML=towerFoeHtml(w)+towerEnemyBenchRail();
    clearFoeEnter();
    setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    if(bt.eHp<bt.es.hp)setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","THUNDERCLAP","crit");}},bsMs(500));
    const foeEl=side?side.querySelector(".fighter.foe"):null;
    if(foeEl){enterFx(foeEl);}
    const tl=document.getElementById("turnLabel");if(tl)tl.innerHTML="LANTAI <b>"+towerRun.floor+"</b> · GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>";
    floatText(".fighter.foe","TAG-IN!","heal");
    if(bt.excited){bt.excited=false;floatText(".fighter.foe","EXTRA ATTACK!","crit");schedPhase(1000,playerPhase);}else schedPhase(1000,enemyPhase);
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
    const varTag=(isShiny||isMut)?`<span class="rrc-var">${isShiny?'<span class="rrc-shine">SHINY</span>':''}${isMut?`<span class="rrc-mut" style="border-color:${MUT_COLOR[g.mut]||'#fff'}">${mutBadge(g.mut)}</span>`:''}</span>`:'';
    let rc="rrc";if(isMut)rc+=" mut-"+g.mut;if(isShiny)rc+=" shiny";
    return `<div class="${rc}"><i class="rrc-sizer"></i><img src="${img}" alt="${name}" title="${name}" onerror="this.style.display='none'">${varTag}${g.n>1?`<span class="rrc-cnt">×${g.n}</span>`:''}<span class="rrc-name">1/${fmtC(luckChance(g.cardId,g.mut,g.shiny))}</span></div>`;
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
      <div class="eyebrow" style="color:${TIER_COLOR[s.tier]}">${rarityText(s.tier,luckChance(s.char,s.mut,s.shiny))}${s.mut&&s.mut!=="none"?` · ${mutChip(s.mut,`<span>${mutBadge(s.mut)}</span>`)}`:""}${s.shiny?' · <span class="shiny-badge">SHINY</span>':""}</div>
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
  document.getElementById("md-use").onclick=()=>{sfx.hit();const di=state.deck.indexOf(s.id);if(di>=0){setDeckSlot(di,null);}else{let e=state.deck.indexOf(null);if(e<0)e=0;setDeckSlot(e,s.id);}openModal(id);renderBackpackPanel();};
  document.getElementById("md-fav").onclick=()=>{s.fav=!s.fav;save();openModal(id);renderBackpackPanel();};
  document.getElementById("md-lock").onclick=()=>{s.lock=!s.lock;save();openModal(id);};
  document.getElementById("md-close").onclick=()=>{m.classList.remove("show");renderBackpackPanel();};
}
document.getElementById("modal").addEventListener("click",e=>{
  if(e.target.id==="modal"){document.getElementById("modal").classList.remove("show");renderBackpackPanel();}
});

/* =============== LOBBY =============== */
function hubCardHtml(eq,idAttr){
  if(!eq||!eq.char||!CARDS[eq.char]) return `<div class="hub-center"${idAttr||''}><div class="hc-info"><div class="hc-name">Belum ada kartu</div></div></div>`;
  const tier=CARDS[eq.char].tier;
  const st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  const mut=(eq.mut&&eq.mut!=='none')?eq.mut:null;
  const trait=(eq.trait&&eq.trait!=='none')?eq.trait:null;
  return `<div class="hub-center${mut?' mut-'+mut:''}${shinyCls(eq)}"${idAttr||''} data-tier="${tier}" style="--tcol:${mut?MUT_COLOR[mut]:TIER_COLOR[tier]}${mut&&!eq.shiny?`;border-color:${MUT_COLOR[mut]}`:''}">
      <div class="hc-img"><img src="${cardImg(eq.char)}" alt="${cardName(eq.char)}"${CARDS[eq.char].pos?` style="object-position:${CARDS[eq.char].pos}"`:''}>
          ${mut&&!eq.shiny?`<span class="hc-name-top hc-mut-name" data-text="${String(cardName(eq.char)).replace(/"/g,'&quot;')}">${mut==='rainbow'?mutText(mut,cardName(eq.char)):cardName(eq.char)}</span>`:eq.shiny?`<span class="hc-name-top hc-name-shine${mut?' hc-name-shine-'+mut:''}" style="${mut==='gold'?'--sh-base:#E0BC6E;--sh-edge:rgba(224,188,110,.95);--sh-glow:rgba(224,188,110,.55)':mut==='rainbow'?'--sh-base:#B58CFF;--sh-edge:rgba(90,200,250,.95);--sh-glow:rgba(181,140,255,.55)':mut==='secret'?'--sh-base:#A855F7;--sh-edge:rgba(168,85,247,.95);--sh-glow:rgba(168,85,247,.55)':'--sh-base:#22d3ee;--sh-edge:rgba(34,211,238,.95);--sh-glow:rgba(34,211,238,.55)'}">${cardName(eq.char)}</span>`:shinyName('span','hc-name-top','hc-name-shine',mut,eq.shiny,cardName(eq.char))}
          <span class="hc-chance" style="color:${TIER_COLOR[tier]}">${rarityText(tier,luckChance(eq.char,eq.mut,eq.shiny))}</span>
          ${(mut||trait||eq.shiny)?`<div class="hc-badges">${eq.shiny?'<span class="shiny-badge">SHINY</span>':''}${mut?mutChip(mut,`<span class="mut-badge" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="hc-trait hc-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(14,trait)}</span>`):''}</div>`:''}
          <div class="skill-overlay"><b>${passiveName(eq.char)}</b><span class="sk-txt">${skillText(eq.char)}</span></div>
        </div>
        <div class="hc-info">
          <div class="hc-skill">${passiveName(eq.char)}</div>
          <div class="hc-desc">${skillText(eq.char)}</div>
          <div class="hc-stats"><div class="hp">♡ ${fmt(st.hp)}</div><div class="atk">${ATKIC} ${fmt(st.atk)}</div></div>
        </div>
    </div>`;
}
/* Tilt 3D + glare buat kartu tengah lobby. Diikat tiap renderLobby (elemen #hubCard baru
   tiap render, jadi listener lama ikut hilang — gak dobel). Skip di perangkat sentuh. */
function initHubTilt(card){
  if(!card || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return;
  let glare=card.querySelector('.hc-glare');
  if(!glare){glare=document.createElement('div');glare.className='hc-glare';card.appendChild(glare);}
  const MAX=12; let raf=null;
  card.addEventListener('mousemove',(e)=>{
    const r=card.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
    const rx=((0.5-py)*2*MAX), ry=((px-0.5)*2*MAX);
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      card.style.transform=`rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      card.style.setProperty('--pf',(px-0.5).toFixed(3));
      card.style.setProperty('--pfy',(py-0.5).toFixed(3));
      glare.style.setProperty('--gx',(px*100).toFixed(1)+'%');
      glare.style.setProperty('--gy',(py*100).toFixed(1)+'%');
      glare.style.opacity='1';
    });
  });
  card.addEventListener('mouseleave',()=>{
    if(raf)cancelAnimationFrame(raf);
    card.style.transform='rotateX(0deg) rotateY(0deg)';
    card.style.setProperty('--pf','0');
    card.style.setProperty('--pfy','0');
    glare.style.opacity='0';
  });
}
function renderLobby(){
  if(state.battle)return renderBattle();
  const eq=equipped();
  const st=eq?cardStats(eq.char,eq.mut,eq.trait,eq.shiny):null;
  const tier=eq?CARDS[eq.char].tier:null;
  app.innerHTML=`
  <div class="lobby-hub">
    <div class="hub-box h-l1 hub-link" id="hubRaid" role="button" title="Masuk Boss Raid"><span class="hb-eyebrow">01</span><img class="hi-ic" src="assets/raid/eternal-dragon-hd.png" alt=""><span class="hb-lbl">BOSS RAID</span></div>
    <div class="hub-box h-l2 hub-link" id="hubTower" role="button" title="Masuk Infinite Tower"><span class="hb-eyebrow">02</span><svg class="tw-ic" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M9 21V9l3-6 3 6v12"/><path d="M9 12h6M9 16h6"/><path d="M5 21V11M19 21V11"/></svg><span class="hb-lbl">INFINITE TOWER</span></div>
    <div class="hub-mid">
    <div class="seam"></div>
    <div class="stage-eyebrow">ACTIVE CARD</div>
    <div class="card-float">${hubCardHtml(eq,' id="hubCard"')}</div>
    ${lobbyPetHtml()}
    <div class="stage-hint"><kbd>KLIK</kbd> UNTUK BUKA BACKPACK</div>
    </div>
    <div class="hub-box h-r1 hub-link" id="hubIndex" role="button" title="Buka Katalog Kartu"><span class="hb-eyebrow">03</span><img class="hi-ic" src="assets/images/icon-index-card.png" alt=""><span class="hb-lbl">INDEX CARD</span></div>
    <div class="hub-box h-r2 hub-link" id="hubTrait" role="button" title="Roll Trait untuk kartu aktif"><span class="hb-eyebrow">04</span><img class="hi-ic" src="assets/images/icon-trait.svg" alt=""><span class="hb-lbl">TRAIT</span></div>
    <div class="hub-box h-mission hub-link" id="missionBtn" role="button" title="Buka daftar misi"><svg class="tw-ic" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 4 6v13l5-2 6 2 5-2V4l-5 2-6-2Z"/><path d="M9 4v13M15 6v13"/></svg><span class="hb-lbl">MISSION</span><span class="mb-sub" id="missionSub"></span></div>
  </div>`;
  const hc=document.getElementById("hubCard");if(hc){hc.onclick=()=>{sfx.hit();toggleBackpack();};initHubTilt(hc);}
  const hi=document.getElementById("hubIndex");if(hi)hi.onclick=()=>{sfx.hit();openIndex();};
  const ht=document.getElementById("hubTrait");if(ht)ht.onclick=()=>{sfx.hit();openTrait();};
  const hr=document.getElementById("hubRaid");if(hr)hr.onclick=()=>{sfx.hit();raidView="hub";location.hash="#/raid";};
  const ht2=document.getElementById("hubTower");if(ht2)ht2.onclick=()=>{sfx.hit();stopTower();location.hash="#/tower";};
  const mb=document.getElementById("missionBtn");if(mb)mb.onclick=()=>{sfx.hit();openMission();};
  const ms=document.getElementById("missionSub");if(ms){const done=CHAPTERS.reduce((a,c)=>a+chapProgMode(c,state.diff),0),tot=CHAPTERS.reduce((a,c)=>a+c.levels.length,0);ms.textContent=done+"/"+tot+" SELESAI";}
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

