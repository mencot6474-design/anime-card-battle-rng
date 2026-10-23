/* =============== BOSS RAID (layar + engine) =============== */
let raid=null, raidView="hub", raidPicked=null;
function stopRaid(){
  if(raid){ if(raid.timer)clearTimeout(raid.timer); raid=null; }
  if(typeof fightTimer!=="undefined"&&fightTimer){ clearTimeout(fightTimer); fightTimer=null; }
  raidView="hub"; raidPicked=null;
}
function raidToast(msg){
  let el=document.getElementById("raidToast");
  if(!el){el=document.createElement("div");el.id="raidToast";document.body.appendChild(el);}
  el.textContent=msg;el.classList.add("show");
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),2200);
}
function renderRaid(){
  hoverHide(); /* fix: popup hover picker jangan nyusul ke battle — mouseout gak fire saat DOM di-replace */
  if(raidView==="pick")return renderRaidPick();
  if(raidView==="battle")return renderRaidBattle();
  if(raidView==="result")return renderRaidResult();
  if(raidView==="shop")return renderRaidShop();
  renderRaidHub();
}
function renderRaidHub(){
  const curDiff=RAID_DIFFS.find(d=>d.k===state.raidDiff)||RAID_DIFFS[0];
  const b=raidBossOf(curDiff);
  const isCleared=!!(state.raidCleared&&state.raidCleared[curDiff.k]);
  const clearedTotal=RAID_DIFFS.filter(d=>state.raidCleared&&state.raidCleared[d.k]).length;

  app.innerHTML=`
  <div class="tw-page rd-page">
    <div class="hunter-raid-hub cp-raid-hub">
      
      <!-- TOP CYBERPUNK HUD BAR -->
      <div class="hr-topbar cp-topbar">
        <div class="hr-tb-left">
          <div class="hr-gate-badge cp-gate-badge">
            <span class="cp-pulse-dot"></span>
            <b>NEURAL APEX // WORLD RAID PROTOCOL</b>
          </div>
          <span class="hr-gate-sub cp-sub">ANOMALY DETECTED &bull; PURGE THREAT MATRIX WITHIN ${RAID_TURNS} CYCLES</span>
        </div>
        <div class="hr-tb-right">
          <div class="hr-wallet-chip cp-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg>
            <div class="cp-chip-col"><small>RAID TOKEN</small><b class="cyan">${fmt(state.raidTokens||0)}</b></div>
          </div>
          <div class="hr-wallet-chip cp-chip subtle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div class="cp-chip-col"><small>SECTORS PURGED</small><b>${clearedTotal}/${RAID_DIFFS.length}</b></div>
          </div>
          <button class="hr-hub-back-btn cp-back-btn" id="raidLobby" type="button" title="Return to Main Interface">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
            <span>LOBBY</span>
          </button>
        </div>
      </div>

      <!-- MAIN HUNT BOARD: 4 CYBERPUNK SECTOR CARDS -->
      <div class="hr-board-section">
        <div class="hr-board-title cp-board-title">
          <span class="hbt-bracket">[</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>ACTIVE SECTOR OVERVIEW &bull; SELECT CALAMITY TARGET</span>
          <span class="hbt-bracket">]</span>
        </div>

        <div class="hr-cards-grid">
          ${RAID_DIFFS.map((d,idx)=>{
            const unl=raidDiffUnlocked(d.k);
            const on=d.k===state.raidDiff;
            const diffBoss=raidBossOf(d);
            const cleared=!!(state.raidCleared&&state.raidCleared[d.k]);
            const rankLetter=["MK-I","MK-II","MK-III","OVERCLOCK"][idx]||"EX";
            const clr=d.color||"#B58CFF";

            return `
            <div class="hr-hunt-card cp-card ${on?'selected':''} ${unl?'':'locked'}" data-rd="${d.k}" style="--hunt-c:${clr}">
              <div class="cp-card-scanline"></div>
              
              <!-- CARD HEADER -->
              <div class="hhc-top">
                <div class="hhc-rank-badge cp-badge" style="border-color:${clr};color:${clr}">${rankLetter}</div>
                <div class="hhc-gate-title">${d.l}</div>
                ${cleared ? `<span class="hhc-cleared-tag cp-tag-green">&#10004; PURGED</span>` : (!unl ? `<span class="hhc-locked-tag cp-tag-red">&#128274; ENCRYPTED</span>` : `<span class="hhc-active-tag cp-tag-gold">ACTIVE</span>`)}
              </div>

              <!-- MONSTER ART FRAME -->
              <div class="hhc-art-frame cp-art-frame">
                <img src="${diffBoss.img}" alt="${diffBoss.name}">
                <div class="hhc-art-gradient"></div>
                <div class="hhc-monster-name">${diffBoss.name}</div>
                <div class="hhc-monster-skill"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> ${diffBoss.skill.toUpperCase()}</div>
              </div>

              <!-- TELEMETRY STATS -->
              <div class="hhc-stats-grid">
                <div class="hhc-stat-box cp-stat-box">
                  <span class="hsb-lbl">CORE HP</span>
                  <b class="hsb-val">${fmt(diffBoss.hp)}</b>
                </div>
                <div class="hhc-stat-box cp-stat-box">
                  <span class="hsb-lbl">OUTPUT ATK</span>
                  <b class="hsb-val">${fmt(diffBoss.power)}</b>
                </div>
                <div class="hhc-stat-box full cp-stat-box">
                  <span class="hsb-lbl">YIELD MULTIPLIER</span>
                  <b class="hsb-val gold">+${Math.round(20*(d.rw||1))} TOKEN <small>(x${d.rw||1})</small></b>
                </div>
              </div>

              <!-- CARD FOOTER / SELECT STATUS -->
              <div class="hhc-footer-status">
                ${unl ? (on ? `<span class="hhc-state-lbl ready cp-ready">&#9670; DEPLOY TARGET</span>` : `<span class="hhc-state-lbl">&#9671; SELECT SECTOR</span>`) : `<span class="hhc-state-lbl lock">REQUIRE CLEARANCE ${raidNextUnlock(d.k)}</span>`}
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <!-- BOTTOM CONTROL PANEL: SELECTED DUNGEON BRIEFING & DEPLOY ACTION -->
      <div class="hr-deploy-dock cp-deploy-dock">
        <div class="hdd-briefing">
          <div class="hdd-tag cp-dock-tag">ENGAGEMENT TARGET: <b style="color:${curDiff.color}">${curDiff.l} (${["TIER 1","TIER 2","TIER 3","OVERDRIVE"][RAID_DIFFS.findIndex(d=>d.k===curDiff.k)]||"EX"})</b></div>
          <div class="hdd-boss-desc">
            ${b.name} &bull; Tahan serangan monster selama <b>${RAID_TURNS} siklus</b> &bull; Reward: 30% HP &rarr; <b>+${Math.round(5*(b.rw||1))}</b> | 50% &rarr; <b>+${Math.round(10*(b.rw||1))}</b> | 100% &rarr; <b>+${Math.round(20*(b.rw||1))} Token</b>
          </div>
        </div>

        <div class="hdd-actions">
          <button class="hdd-btn shop cp-btn-shop" id="raidShopBtn" type="button">
            <div class="hdd-btn-ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <div class="hdd-btn-text">
              <small>PROCUREMENT</small>
              <b>TOKO RAID</b>
            </div>
          </button>

          <button class="hdd-btn deploy cp-btn-deploy" id="raidGo" type="button">
            <div class="hdd-btn-ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <div class="hdd-btn-text">
              <small>INITIALIZE STRIKE</small>
              <b>MULAI RAID</b>
            </div>
          </button>
        </div>
      </div>

    </div>
  </div>`;

  document.getElementById("raidGo").onclick=()=>{
    if(!raidDiffUnlocked(state.raidDiff)){raidToast("Gate ini masih terkunci. Taklukkan gate sebelumnya terlebih dahulu.");return;}
    sfx.hit();raidView="pick";renderRaid();
  };
  document.getElementById("raidShopBtn").onclick=()=>{sfx.hit();raidView="shop";renderRaid();};
  const rl=document.getElementById("raidLobby");
  if(rl)rl.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};
  
  app.querySelectorAll(".hr-hunt-card").forEach(btn=>{
    btn.onclick=()=>{
      const k=btn.dataset.rd;
      if(!raidDiffUnlocked(k)){raidToast("Taklukkan "+raidNextUnlock(k)+" Gate terlebih dahulu untuk membuka segel ini.");return;}
      if(state.raidDiff===k)return;
      state.raidDiff=k;sfx.hit();save();renderRaidHub();
    };
  });
}
function renderRaidPick(){
  const stacks=state.stacks.slice().sort((a,b)=>(b.fav?1:0)-(a.fav?1:0));
  const b=raidBossOf(),df=raidDiffOf();
  app.innerHTML=`
  <div class="rd-page rd-pick">
    <div class="rd-pick-head">
      <button class="rd-pick-back" id="raidPickBack" title="Kembali ke hub raid">&#8592;</button>
      <div class="rd-pick-ttl"><span class="eyebrow">PILIH KARTU RAID</span><b>SATU KARTU vs ${b.name.toUpperCase()}</b></div>
      <div class="rd-pick-boss"><img src="${b.img}" alt="${b.name}"><div class="rpb-i"><span class="rpb-k">BOSS &middot; ${b.diffLabel}</span><span class="rpb-n">${b.name}</span><span class="rpb-hp">HP ${fmt(b.hp)} &middot; ${RAID_TURNS} TURN</span><span class="rpb-df" style="color:${df.color}">${df.l} ×${df.rw||1}</span></div></div>
    </div>
    <label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="raidSearch" type="text" placeholder="Cari kartu…" autocomplete="off"></label>
    <div class="raid-pick-grid" id="raidPickGrid">${stacks.map(s=>{
      const c=CARDS[s.char];
      const shny=s.shiny?'<span class="bpt-shiny shiny-pill">SHINY</span>':'';
      const mut=(s.mut&&s.mut!=='none')?s.mut:null;
      const trait=(s.trait&&s.trait!=='none')?s.trait:null;
      const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
      const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,mutPill(mut,'bpt-mut')):''}${trait?traitChip(trait,`<span class="bpt-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
      return `<div class="bp-tile" data-sid="${s.id}" data-pick="${s.id}" data-name="${c.name.toLowerCase()}" style="--tcol:${TIER_COLOR[s.tier]}"><img src="${cardImg(s.char)}" alt="">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}');renderRaidPick()" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}');renderRaidPick()" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${c.name}</div></div>`;
    }).join("")}</div>
    <div class="no-result" id="raidSearch-nr">Tidak ada kartu yang cocok dengan pencarian.</div>
  </div>`;
  bpsHoverBind();bpsHoverHide(); /* hover tile -> reveal kartu penuh (stat/passive) kayak tab DECK */
  {const bk=document.getElementById("raidPickBack");if(bk)bk.onclick=()=>{sfx.hit();raidView="hub";renderRaid();};}
  {const rs=document.getElementById("raidSearch");if(rs){rs.value=raidSearch;rs.oninput=()=>{raidSearch=rs.value;runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));};if(raidSearch)runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));}}
  app.querySelectorAll("[data-pick]").forEach(btn=>btn.onclick=()=>{
    sfx.hit();
    if(typeof hideRollResult==="function")hideRollResult();
    raidPicked=state.stacks.find(s=>s.id===btn.dataset.pick)||state.stacks[0];
    raidView="battle";renderRaid();
  });
}
function renderRaidBattle(){
  const b=raidBossOf(), eq=raidPicked||equipped();
  app.innerHTML=`
  <div class="battle-grid raid-stage">
    <div class="me-col"><div class="fighter me${eq&&eq.mut&&eq.mut!=='none'?' mut-'+eq.mut:''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}">${meFighterHtml(eq)}</div>${typeof benchRailHtml==="function"?benchRailHtml([],"RAID STRIKER (SOLO DEPLOY)"):""}</div>
    <div class="vs-col"><div class="t">VS</div><div class="s" id="raidTurnLabel">TURN<br>0/${RAID_TURNS}</div></div>
    <div class="me-col foe-side"><div class="fighter foe" data-tier="EX">
      ${typeof foeFighterInnerHtml==="function"?foeFighterInnerHtml({name:b.name,img:b.img,tier:"BOSS",boss:true},{hp:b.hp,atk:999999},{hpId:"hpRaid",hpTid:"hpRaidT",subtitle:"RAID · "+b.diffLabel,skill:b.skill}):`
      <div class="f-banner"><img src="${b.img}" alt="${b.name}"><div class="f-name">${b.name}</div></div>
      <div class="hpbar"><i id="hpRaid"></i><span id="hpRaidT">${fmt(b.hp)} / ${fmt(b.hp)}</span></div>
      <div class="f-body">
        <div class="f-title">${rarityText(b.tier)} · RAID · ${b.diffLabel}</div>
        <div class="f-skill">${b.skill}</div>
        <div class="stat-row"><div class="stat">♡ ${fmt(b.hp)}</div><div class="stat">${ATKIC} ${fmt(999999)}</div></div>
      </div>`}
    </div>${typeof benchRailHtml==="function"?benchRailHtml([],"RAID CALAMITY (SINGLE BOSS)"):""}</div>
  </div>`;
  if(typeof wireSpeedBtn==="function")wireSpeedBtn();
  startRaid();
}
function startRaid(){
  const b=raidBossOf(), eq=raidPicked||equipped(), base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  raid={boss:b,hp:b.hp,max:b.hp,dealt:0,turn:0,cap:RAID_TURNS,atk:base.atk,fx:resolveFx(eq,b.fx||{}),cid:eq.char,over:false,timer:null,domainUsed:false,domainLeft:0,diffKey:b.diffKey,rw:b.rw,havocUses:0,havocGuard:true};
  playFight(()=>{ if(raid&&!raid.over)raid.timer=setTimeout(raidStep,500); });
}
function raidStep(){
  if(!raid||raid.over)return;
  raid.turn++;
  if(raid.turn>raid.cap){ if(raid.hp>0){ raidFinisher(()=>endRaid()); } else { endRaid(); } return; }
  const fx=raid.fx;
  if(fx.statGrow){raid.atk=Math.round(raid.atk*(1+(fx.statGrow.pct||15)/100));setTimeout(()=>{if(raid&&!raid.over)floatText(".fighter.me","STATS +"+(fx.statGrow.pct||15)+"%","heal");},160);}
  const dmg=Math.round(raid.atk*(fx.dmgMult||1)), id=raid.cid;
  const domainActive=fx.domain&&id==="CH_EX_GOJO"&&Math.random()*100<(fx.domain.chance||100);
  const hits=[1];
  let crit=false,purple=false,ranton=false,barrageN=0,iceBlastN=0,wePhase=-1,gammaRayHit=false;
  if(fx.everyNth){
    raid.nthCount=(raid.nthCount||0)+1;
    if(raid.nthCount%fx.everyNth.n===0){
      hits[0]*=fx.everyNth.mult||1;
      crit=true;
      if(fx.everyNth.text==="GAMMA RAY BURST")gammaRayHit=true;
      setTimeout(()=>{if(raid&&!raid.over)floatText(".fighter.me",fx.everyNth.text||"SUSANOO CHIDORI","crit");},gammaRayHit?500:220);
    }
  }
  if(fx.worldEnder){
    wePhase=(raid.weCount||0)%3;
    raid.weCount=(raid.weCount||0)+1;
    if(wePhase===0){hits[0]=fx.worldEnder.cyc1||1.5;crit=true;}
    else if(wePhase===1){hits[0]=fx.worldEnder.cyc2||0.4;}
    else{hits[0]=fx.worldEnder.pierce||0.8;crit=true;}
  }
  if(fx.double&&Math.random()*100<fx.double)hits.push(1);
  if(fx.crit&&Math.random()*100<fx.crit.chance){crit=true;hits[hits.length-1]*=fx.crit.mult;}
  else if(Math.random()*100<BASE_CRIT.chance){crit=true;hits[hits.length-1]*=BASE_CRIT.mult;}
  if(fx.purple&&Math.random()*100<fx.purple.chance){purple=true;crit=true;hits[hits.length-1]*=fx.purple.mult;}
  if(fx.ranton&&Math.random()*100<fx.ranton.chance){ranton=true;crit=true;hits.length=0;const rh=Math.max(1,fx.ranton.hits||5),rm=fx.ranton.mult||1;for(let k=0;k<rh;k++)hits.push(rm);}
  if(fx.barrage&&Math.random()*100<fx.barrage.chance){const n=fx.barrage.min+Math.floor(Math.random()*(fx.barrage.max-fx.barrage.min+1)),bm=fx.barrage.mult||1;hits.length=0;for(let i=0;i<n;i++)hits.push(bm);barrageN=hits.length;}
  if(ranton&&!barrageN)barrageN=hits.length;
  /* ICE BLAST (kartu BOSS): N tembakan @ pct% ATK — pola hits angka polos di raid */
  if(fx.iceBlast&&Math.random()*100<fx.iceBlast.chance){const n=Math.max(1,fx.iceBlast.hits||3),pm=(fx.iceBlast.pct!=null?fx.iceBlast.pct:100)/100;hits.length=0;for(let i=0;i<n;i++)hits.push(pm);iceBlastN=n;barrageN=n;}
  // DOMAIN aktif: serangan jadi 10× barrage @30% ATK
  if(domainActive){hits.length=0;const dn=fx.domain.min||10,dm=(fx.domain.mult!=null?fx.domain.mult:0.3);for(let i=0;i<dn;i++)hits.push(dm);barrageN=dn;crit=false;purple=false;ranton=false;}
  const ariseMode=id==="CH_EX_JINWOO"&&barrageN>=9;
  /* Galaxy Roar = satu semburan laser: seluruh damage ditumpuk ke satu sambaran
     supaya jatuh di menit GALAXY.hit, bukan di awal serangan. */
  const galaxyMode=id==="CH_ETERNAL_DRAGON"&&purple;
  if(galaxyMode){const m=hits[hits.length-1];hits.length=0;hits.push(m);barrageN=0;}
  let total=0;hits.forEach(m=>total+=Math.round(dmg*m));
  anim(".fighter.me","lunge-r");
  if(wePhase>=0&&window.worldEnderFx)window.worldEnderFx({fromSel:".fighter.me",toSel:".fighter.foe",phase:wePhase,revived:false});
  if(gammaRayHit&&window.gammaRayFx)window.gammaRayFx({fromSel:".fighter.me",toSel:".fighter.foe"});
  /* All cut-in removed */
  const setRaidBar=hp=>{const v=Math.max(0,hp);const p=Math.max(0,Math.min(100,v/raid.max*100));const b=document.getElementById("hpRaid");if(b)b.style.width=p+"%";const tt=document.getElementById("hpRaidT");if(tt)tt.textContent=fmt(v)+" / "+fmt(raid.max);};
  /* panjang rantai animasi hit ronde ini, dihitung SINKRON (di depan setTimeout) supaya cabang kematian
     bisa menunggu sambaran terakhir selesai — bukan memotong getar + angkanya lewat guard raid.over */
  const rHstep=domainActive?80:160;
  const rMd=ranton&&id==="CH_EX_MADARA";
  const rWeWait=(wePhase>=0&&typeof WE_T!=="undefined")?WE_T.first:(gammaRayHit&&typeof GR_T!=="undefined")?GR_T.first:0;
  const rChainEnd=(rMd?MADARA_T.slash+Math.max(0,hits.length-1)*MADARA_T.step+40:180+rWeWait+Math.max(0,hits.length-1)*rHstep)+520;
  setTimeout(()=>{
    if(domainActive&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.me","DOMAIN EXPANSION","crit"),220);}
    if(ariseMode&&raid&&!raid.over){floatText(".fighter.foe","ARMY OF SHADOWS","crit");}
    const susStart=(ranton&&id==="CH_EX_MADARA"&&raid&&!raid.over)?MADARA_T.slash:rWeWait;
    {
      const hstep=domainActive?80:160;
      const susDelay=susStart;
      const md=ranton&&id==="CH_EX_MADARA";
      const dlyAt=i=> galaxyMode ? GALAXY.hit : md ? (susDelay+i*MADARA_T.step) : (i*hstep+susDelay);
      let rShown=raid.hp+total,rBarEnd=0;const rEndHp=raid.hp;
      const ultBarrage=(domainActive||ariseMode||md);
      const jwLag=(id==="CH_EX_JINWOO"&&barrageN&&!domainActive)?170:0;
      hits.forEach((m,i)=>{
        const dl=dlyAt(i),ft=dl+(md?40:0);
        /* getar DIJARAKI per sambaran (dl), sama seperti story/tower: sebelumnya hit non-Madara digetarkan
           sekaligus di menit yang sama jadi kartu cuma bergetar satu kali untuk 10× damage */
        setTimeout(()=>{if(raid&&!raid.over){anim(".fighter.foe","hit",ultBarrage);if(window.strikeFx&&!md&&!galaxyMode)window.strikeFx(".fighter.foe",{big:crit&&i===hits.length-1,fx:fx});}},dl+jwLag);
        const dd=Math.round(dmg*m);rShown-=dd;rBarEnd=Math.max(rBarEnd,ft);const stepHp=Math.max(0,rShown);
        setTimeout(()=>floatText(".fighter.foe","-"+fmt(dd),(crit&&i===hits.length-1)?"crit":""),ft);
        setTimeout(()=>setRaidBar(stepHp),ft);
      });
      setTimeout(()=>setRaidBar(rEndHp),rBarEnd+520);
      if(barrageN>1)setTimeout(()=>floatText(".fighter.foe",(iceBlastN?"ICE BLAST ×":domainActive?"UNLIMITED VOID ×":ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+barrageN,"crit"),md?MADARA_T.slash:320);
      else if(hits.length>1&&!ranton)setTimeout(()=>floatText(".fighter.foe","DOUBLE!","crit"),260+rWeWait);
    }
  },180);
  raid.hp-=total;raid.dealt+=total;
  /* SUPER MEGA DEATH ROCKET (HAVOC WREACKER di Raid): langsung aktif saat masuk/turn 1, maks 3x per battle */
  let havocFired=false;
  if(fx.havocRocket&&raid.hp>0&&raid.havocGuard&&(raid.havocUses||0)<(fx.havocRocket.maxUses||3)){
    raid.havocGuard=false;
    raid.havocUses=(raid.havocUses||0)+1;
    havocFired=true;
    const rk=Math.round(raid.atk*(fx.havocRocket.pct||50)/100);
    raid.hp-=rk;raid.dealt+=rk;
    if(window.havocRocketFx)havocRocketFx({fromSel:".fighter.me",toSel:".fighter.foe"});
    setTimeout(()=>{
      if(raid&&!raid.over){
        anim(".fighter.foe","hit");
        shakeScreen(true);if(window.CyberSfx)window.CyberSfx.aoeDetonate();
        floatText(".fighter.foe","SUPER MEGA DEATH ROCKET -"+fmt(rk)+" ("+raid.havocUses+"/"+(fx.havocRocket.maxUses||3)+")","crit");
        setRaidBar(raid.hp);
      }
    },typeof HR_T!=="undefined"?HR_T.first:620);
  }
  setRaidBar(raid.hp+total);
  const tl=document.getElementById("raidTurnLabel");if(tl)tl.innerHTML="TURN<br>"+raid.turn+"/"+raid.cap;
  if(raid.hp<=0){
    const special=(domainActive||ariseMode||ranton||galaxyMode||havocFired||gammaRayHit);
    const killWait=Math.max(rChainEnd, special?(ranton?MADARA_T.total+160:galaxyMode?GALAXY.total:1700):0);
    if(killWait>260){ setTimeout(()=>{if(raid&&!raid.over)endRaid();},killWait); }
    else endRaid();
    return;
  }
  raid.timer=setTimeout(raidStep,ariseMode?2200:domainActive?1900:ranton?MADARA_T.total+260:galaxyMode?GALAXY.total+260:gammaRayHit?1550:1100);
}
function raidFinisher(done){
  if(!raid||raid.over){ if(done)done(); return; }
  if(raid.timer){clearTimeout(raid.timer);raid.timer=null;}
  const grid=document.querySelector(".battle-grid");
  const meEl=document.querySelector(".fighter.me"), foeEl=document.querySelector(".fighter.foe");
  if(!grid||!meEl||!foeEl){ if(done)done(); return; }
  const skill=(raid.boss&&raid.boss.skill)||"GALAXY ROAR";
  const mr=meEl.getBoundingClientRect(), fr=foeEl.getBoundingClientRect();
  const sx=Math.round(fr.left+fr.width/2), sy=Math.round(fr.top+fr.height*0.42);
  const tx=Math.round(mr.left+mr.width/2), ty=Math.round(mr.top+mr.height*0.42);
  const dx=tx-sx, dy=ty-sy;
  const fly=470, gap=620, N=3, HITS=10, DMG=999999;
  // telegraph: boss membuka daya
  anim(".fighter.foe","lunge-l");
  floatText(".fighter.foe",skill,"crit");
  sfx.crit();
  playClipDur(domainAudio,1100,350);
  let impacts=0;
  const fireImpact=()=>{
    const fl=document.createElement("div");fl.className="eb-flash";
    fl.style.setProperty("--fx",(tx/window.innerWidth*100).toFixed(1)+"%");
    fl.style.setProperty("--fy",(ty/window.innerHeight*100).toFixed(1)+"%");
    document.body.appendChild(fl);setTimeout(()=>fl.remove(),460);
    floatText(".fighter.me","BARRAGE ×"+HITS,"crit");
    /* getar per sambaran, sejalan dengan angka + suara (60+h*80) — sama seperti ritme barrage di story/tower */
    for(let h=0;h<HITS;h++){ setTimeout(()=>{ const t=document.querySelector(".fighter.me"); if(t){anim(".fighter.me","hit");floatText(".fighter.me","-"+fmt(DMG),"crit");} },60+h*80); }
    impactBoom();
    for(let h=0;h<HITS;h++){ setTimeout(()=>playClip(punchAudio),60+h*80); }
    const bar=document.getElementById("hpMe");if(bar)bar.style.width="0%";
    const t=document.getElementById("hpMeT");if(t)t.textContent="0 / 0";
    meEl.classList.add("ko");
    if(++impacts>=N) setTimeout(()=>{ if(done)done(); },760);
  };
  for(let i=0;i<N;i++){
    setTimeout(()=>{
      playClipDur(purpleAudio,470,120);
      const o=document.createElement("div");o.className="ebfx";
      o.innerHTML=`<span class="eb-ball${i===N-1?" big":""}" style="left:${sx}px;top:${sy}px;--dx:${dx}px;--dy:${dy}px;--fly:${fly}ms"></span>`;
      document.body.appendChild(o);
      setTimeout(()=>{ o.remove(); fireImpact(); },fly);
    },i*gap);
  }
}
function endRaid(){
  if(!raid||raid.over)return;
  raid.over=true;if(raid.timer){clearTimeout(raid.timer);raid.timer=null;}
  const pct=Math.round((raid.max-Math.max(0,raid.hp))/raid.max*100);
  const tokens=raidTokenFor(pct,{rw:raid.rw});
  raid.pct=pct;raid.tokens=tokens;
  if(pct>=100&&raid.diffKey){state.raidCleared=state.raidCleared||{};state.raidCleared[raid.diffKey]=true;}
  if(tokens>0){state.raidTokens=(state.raidTokens||0)+tokens;save();renderShell();sfx.win();}else sfx.lose();
  setTimeout(()=>{raidView="result";renderRaid();},2000);
}
function renderRaidResult(){
  const pct=raid?raid.pct:0, tokens=raid?raid.tokens:0, nx=raidNextTier(pct,{rw:raid?raid.rw:1});
  const dLabel=raid?(RAID_DIFFS.find(d=>d.k===raid.diffKey)||{}).l:"";
  app.innerHTML=`
  <div class="tw-page rd-page"><div class="raid-result">
    <div class="eyebrow">HASIL RAID${dLabel?" · "+dLabel:""}</div>
    <div class="rr-title disp${pct>=100?"":" lose"}">${pct>=100?"BOSS TUMBANG":"RAID SELESAI"}</div>
    <div class="rr-pct">Damage ke Boss <b>${pct}%</b></div>
    <div class="rr-token">+${tokens} <span>TOKEN RAID</span></div>
    <div class="rr-tier">${nx?`Butuh ${nx.pct}% damage untuk +${nx.tokens} token.`:"Semua tier terklaim!"}</div>
    <div class="rr-actions"><button class="btn-grad" id="rrAgain">RAID LAGI</button><button class="btn-ghost" id="rrHub">KEMBALI</button></div>
  </div></div>`;
  document.getElementById("rrAgain").onclick=()=>{sfx.hit();raidView="pick";renderRaid();};
  document.getElementById("rrHub").onclick=()=>{raidView="hub";renderRaid();};
}
function stackHas(char,mut){mut=mut||"none";return state.stacks.some(s=>s.char===char&&(s.mut||"none")===mut);}
const RAID_SHOP=[
  {id:"coins",name:"2.000 Coin",cost:5,desc:"Koin untuk roll trait & kebutuhan lain.",apply:()=>{state.coins+=2000;return "+2.000 coin";}},
  {id:"card_edragon",name:"Eternal Dragon",cost:120,desc:"Kartu BOSS eksklusif — beli SEKALI, roll terbuka PERMANEN di semua gacha. Chance dasar 1 in 25 jt · ICE BLAST 50% (3×75% ATK) · immune semua status effect.",card:{char:"CH_ETERNAL_DRAGON",mut:"none"},
    apply:()=>{state.raidShopOwned=state.raidShopOwned||{};state.raidShopOwned.CH_ETERNAL_DRAGON=true;return gmGrantCard("CH_ETERNAL_DRAGON");}},
  {id:"helm-abyss",name:"HELM ABYSS",cost:5000,desc:"Artefak CRAYON V2 — +80 flat & +120% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot artefak, equip 2 slot).",effect:"+80 FLAT & +120% LUCK",owned:()=>state.artOwned.includes("helm-abyss"),
    apply:()=>{state.artOwned=state.artOwned||[];if(!state.artOwned.includes("helm-abyss"))state.artOwned.push("helm-abyss");return "HELM ABYSS · +80 FLAT & +120% LUCK";}},
  {id:"nebula-wisp",name:"NEBULA WISP",cost:15000,desc:"Pet CRAYON V2 — +150 flat & +220% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot pet, equip 1).",effect:"+150 FLAT & +220% LUCK",owned:()=>state.petOwned.includes("nebula-wisp"),
    apply:()=>{state.petOwned=state.petOwned||[];if(!state.petOwned.includes("nebula-wisp"))state.petOwned.push("nebula-wisp");return "NEBULA WISP · +150 FLAT & +220% LUCK";}},
  /* LUCK & SPEED POTION L1-L3 — consumable, harga token sama dgn Toko Inf. */
  {id:"luck1",name:"Luck Potion L1",cost:10,desc:"+3 flat luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+3 FLAT LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[0]++;return "LUCK POTION L1";}},
  {id:"luck2",name:"Luck Potion L2",cost:50,desc:"+5 flat luck & +10% luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+5 FLAT & +10% LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[1]++;return "LUCK POTION L2";}},
  {id:"luck3",name:"Luck Potion L3",cost:250,desc:"+10 flat luck & +20% luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+10 FLAT & +20% LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[2]++;return "LUCK POTION L3";}},
  {id:"speed1",name:"Speed Potion L1",cost:10,desc:"Roll speed +0.2× (≈1.2×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +0.2× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[0]++;return "SPEED POTION L1";}},
  {id:"speed2",name:"Speed Potion L2",cost:50,desc:"Roll speed +0.5× (≈1.5×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +0.5× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[1]++;return "SPEED POTION L2";}},
  {id:"speed3",name:"Speed Potion L3",cost:250,desc:"Roll speed +1.0× (2×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +1.0× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[2]++;return "SPEED POTION L3";}}
];
/* =============== TOKO RAID — layout master-detail ala TOKO INF (.tw-hub) ===============
   Kiri: daftar item (.srow). Kanan: stats token + detail (.sdetail) + tombol beli (.act.go.buyswap).
   Kartu BOSS: status ROLL TERKUNCI/TERBUKA ditampilkan; beli = raidShopOwned[id]=true (permanen). */
function raidShopBuy(id){
  const it=RAID_SHOP.find(x=>x.id===id);if(!it)return;
  const tok=state.raidTokens||0;
  if(tok<it.cost){raidToast("TOKEN KURANG — butuh "+it.cost+" token");return;}
  if(it.card&&stackHas(it.card.char,it.card.mut)){raidToast("Kartu itu sudah ada di Deck kamu");return;}
  if(it.owned&&it.owned()){raidToast("Sudah dibeli — permanen di Backpack");return;}
  state.raidTokens-=it.cost;
  const msg=it.apply();save();sfx.crit();renderShell();
  raidToast(msg+" · −"+it.cost+" token");
  renderRaidShop();
}
function renderRaidShop(){
  const tok=state.raidTokens||0;
  
  /* Cyberpunk Vector Hologram Icons (Custom inline SVG ala Honkai / PGR / Cyberpunk 2077) */
  const ICO={
    coins:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6" stroke="#ffd27a"/></svg>`,
    card_edragon:`<img src="assets/cards/art/eternal-dragon.webp?v=trans1" onerror="this.parentNode.textContent='🐉'">`,
    "helm-abyss":`<img src="assets/artifacts/abyss-helm.png" onerror="this.parentNode.textContent='🪖'">`,
    "nebula-wisp":`<img src="assets/pets/nebula-wisp.png" onerror="this.parentNode.textContent='🌌'">`,
    luck1:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12" stroke="#5cf0a8"/><circle cx="12" cy="12" r="4" fill="rgba(92,240,168,0.2)" stroke="#5cf0a8"/></svg>`,
    luck2:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-5-6.5 5 2-7.5-5.5-4.5h7z" fill="rgba(92,240,168,0.2)" stroke="#5cf0a8"/><path d="M12 8v8M8 12h8" stroke="#fff"/></svg>`,
    luck3:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.5 8.5 22 9.5 17 14.5 18.5 21 12 17.5 5.5 21 7 14.5 2 9.5 8.5 8.5 12 2" fill="rgba(92,240,168,0.3)" stroke="#5cf0a8"/><circle cx="12" cy="12" r="5" stroke="#fff"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`,
    speed1:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(255,210,122,0.2)" stroke="#ffd27a"/></svg>`,
    speed2:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(255,210,122,0.3)" stroke="#ffd27a"/><line x1="4" y1="4" x2="9" y2="4" stroke="#fff"/><line x1="2" y1="8" x2="6" y2="8" stroke="#fff"/></svg>`,
    speed3:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(255,210,122,0.4)" stroke="#ffd27a"/><path d="M19 4l3 3-3 3M15 14l3 3-3 3" stroke="#fff"/></svg>`
  };
  
  const cardItems=RAID_SHOP.filter(x=>x.card);
  const bossTotal=cardItems.length,bossCount=cardItems.filter(x=>bossRollUnlocked(x.card.char)).length;
  
  const ITEMS=RAID_SHOP.map(it=>{
    let cat="POTION", tier="SPEC";
    if(it.card) { cat="EX CORE"; tier="CH-EX"; }
    else if(it.id.startsWith("helm")) { cat="RELIC GEAR"; tier="MYTHIC"; }
    else if(it.id.includes("wisp")) { cat="FAMILIAR"; tier="COSMIC"; }
    else if(it.id==="coins") { cat="CREDITS"; tier="CURR"; }
    else if(it.id.includes("luck")) { cat="AUGMENT"; tier="MK-"+it.id.replace("luck",""); }
    else if(it.id.includes("speed")) { cat="OVERCLOCK"; tier="MK-"+it.id.replace("speed",""); }

    return {
      k:it.id,
      label:it.name.toUpperCase(),
      sub:it.card?"Kartu BOSS &bull; Beli sekali buka roll permanen di semua gacha":it.desc,
      cost:it.cost,
      ac:it.card?"#B58CFF":it.id.includes("helm")?"#FFD27A":it.id.includes("wisp")?"#7DF9FF":"#5CF0A8",
      cat,
      tier,
      it
    };
  });

  if(window.raidShopSel==null||window.raidShopSel>=ITEMS.length)window.raidShopSel=0;
  let swapT=null;

  const renderGrid=()=>{
    const gridEl=document.getElementById("hunterShopGrid");
    if(!gridEl)return;
    gridEl.innerHTML=ITEMS.map((it,i)=>{
      const isSel=i===window.raidShopSel;
      const isOwned=!!((it.it.card&&stackHas(it.it.card.char,it.it.card.mut))||(it.it.owned&&it.it.owned()));
      const canAfford=(tok>=it.cost);

      return `
      <div class="hsg-card cp-shop-card ${isSel?'selected':''} ${isOwned?'owned':''} ${!canAfford&&!isOwned?'insufficient':''}" data-i="${i}" style="--item-c:${it.ac}">
        <div class="hsg-card-top">
          <span class="hsg-cat-badge cp-cat">${it.cat}</span>
          <span class="hsg-tier-tag cp-tier">${it.tier}</span>
        </div>
        <div class="hsg-art-wrap cp-art-wrap ${it.it.card?'boss-card':''}">
          ${ICO[it.k]||"🎁"}
        </div>
        <div class="hsg-card-name">${it.label}</div>
        <div class="hsg-price-badge">
          ${isOwned ? `<span class="hsg-owned-lbl">&#10004; PURCHASED</span>` : `<b>${fmt(it.cost)}</b> <small>TOKEN</small>`}
        </div>
      </div>`;
    }).join("");

    gridEl.querySelectorAll(".hsg-card").forEach(c=>{
      c.onclick=()=>{
        window.raidShopSel=+c.dataset.i;
        renderGrid();
        renderDetail();
      };
    });
  };

  const renderBuy=()=>{
    const it=ITEMS[window.raidShopSel],btn=document.getElementById("raidShopBuy");
    if(!btn||!it)return;
    btn.style.animation="none";void btn.offsetWidth;btn.style.animation="";
    const have=!!(it.it.card&&stackHas(it.it.card.char,it.it.card.mut))||(it.it.owned?it.it.owned():false);
    let small="AUTHORIZE PROCUREMENT",big=`ACQUIRE &bull; ${fmt(it.cost)} TOKEN`,dis=false;
    if(have){
      small=it.it.card?"Roll gacha sudah permanen terbuka":"Permanen tersimpan di Backpack";
      big="SUDAH DIMILIKI";
      dis=true;
    } else if(tok<it.cost){
      small="INSUFFICIENT RAID TOKENS";
      big=`DEFISIT ${fmt(it.cost-tok)} TOKEN`;
      dis=true;
    }
    btn.disabled=dis;
    btn.className="hsd-buy-action cp-buy-action" + (dis?" disabled":"");
    btn.innerHTML=`
      <div class="hsd-ba-ic">${ICO[it.k]||"🎁"}</div>
      <div class="hsd-ba-text">
        <small>${small}</small>
        <b>${big}</b>
      </div>
      <div class="hsd-ba-arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>`;
  };

  const renderDetail=immediate=>{
    const it=ITEMS[window.raidShopSel],box=document.getElementById("raidShopDetail");
    if(!box||!it)return;
    clearTimeout(swapT);
    const paint=()=>{
      box.classList.remove("out");
      const isCard=!!it.it.card;
      const c=isCard?CARDS[it.it.card.char]:null;
      const unlocked=!isCard||bossRollUnlocked(it.it.card.char);
      const cnt=isCard?state.stacks.filter(s=>s.char===it.it.card.char).reduce((n,s)=>n+(s.count||1),0):0;
      
      box.innerHTML=`
      <div class="hsd-spec-header cp-spec-header" style="--spec-c:${it.ac}">
        <div class="hsd-icon-box cp-hero-ic ${isCard?'boss-art':''}">${ICO[it.k]||"🎁"}</div>
        <div class="hsd-meta-col">
          <div class="hsd-meta-kicker"><span class="hsd-tier-pill">${it.tier}</span> SUPPLY DEPOT &bull; ${it.cat}</div>
          <div class="hsd-meta-title">${it.label}</div>
          <div class="hsd-meta-price">${fmt(it.cost)} RAID TOKENS</div>
        </div>
      </div>

      <div class="hsd-desc-block cp-desc-block">
        <div class="hsd-sec-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          SPECIFICATION // EFFECT PARAMETERS
        </div>
        <p class="hsd-desc-text">${it.it.desc}</p>
        ${c ? `
        <div class="hsd-skill-box cp-skill-box">
          <div class="hsb-title">&#9889; ${c.passive.name}</div>
          <div class="hsb-text">${c.passive.desc}</div>
        </div>` : ''}
      </div>

      <div class="hsd-matrix-grid cp-matrix-grid">
        <div class="hsd-mg-cell">
          <span class="hm-lbl">EXCHANGE PRICE</span>
          <b class="hm-val gold">${fmt(it.cost)} TOKEN</b>
        </div>
        <div class="hsd-mg-cell">
          <span class="hm-lbl">GACHA UNLOCK STATUS</span>
          <b class="hm-val ${unlocked?'green':'warn'}">${isCard ? (unlocked?'PERMANENT UNLOCKED':'LOCKED // PURCHASE FIRST') : 'INSTANT ACTIVE'}</b>
        </div>
        <div class="hsd-mg-cell">
          <span class="hm-lbl">AVAILABLE DEPOSIT</span>
          <b class="hm-val cyan">${fmt(tok)} TOKEN</b>
        </div>
        <div class="hsd-mg-cell">
          <span class="hm-lbl">OWNED STOCK</span>
          <b class="hm-val ${cnt>0?'green':''}">${isCard ? (cnt ? 'x'+cnt : '0') : 'Tersedia'}</b>
        </div>
      </div>`;
      renderBuy();
    };
    if(immediate||!box.children.length){paint();return;}
    box.classList.add("out");
    swapT=setTimeout(paint,110);
  };

  app.innerHTML=`
  <div class="tw-page rd-page">
    <div class="hunter-shop-hub cp-shop-hub">
      
      <!-- TOP MARKET HEADER -->
      <div class="hsh-header cp-header">
        <div class="hsh-header-left">
          <button class="hsh-back-btn cp-back-btn" id="raidShopBack" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            <span>RETURN TO HUNT BOARD</span>
          </button>
          <div class="hsh-title-wrap">
            <div class="hsh-kicker"><span class="hsh-dot cp-dot"></span> PROCUREMENT MATRIX // LEVEL 01+</div>
            <div class="hsh-title">TACTICAL <span class="hsh-cyan">RAID EXCHANGE</span></div>
          </div>
        </div>
        <div class="hsh-header-right">
          <div class="hsh-token-chip cp-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg>
            <div class="htc-col"><small>RAID TOKEN</small><b class="cyan">${fmt(tok)}</b></div>
          </div>
          <div class="hsh-token-chip subtle cp-chip">
            <div class="htc-col"><small>BOSS CORES</small><b>${bossCount}/${bossTotal}</b></div>
          </div>
        </div>
      </div>

      <!-- MAIN MARKET SPLIT: LEFT GRID CARDS & RIGHT DETAIL INSPECTOR -->
      <div class="hsh-content-split">
        <!-- LEFT: HUNTER SHOP GRID -->
        <section class="hsh-grid-panel cp-panel">
          <div class="hsh-grid-subhdr">
            <span class="hgs-txt">[ EXCLUSIVE ARMORY SUPPLY &bull; CLICK TO INSPECT TELEMETRY ]</span>
          </div>
          <div class="hunter-shop-grid" id="hunterShopGrid"></div>
        </section>

        <!-- RIGHT: INSPECT SPECIFICATION PANEL -->
        <section class="hsh-detail-panel cp-panel">
          <div class="hsd-panel-title cp-panel-title">TELEMETRY INSPECTION // PROCUREMENT</div>
          <div class="hsd-detail-content" id="raidShopDetail"></div>
          <div class="hsd-action-footer">
            <button class="hsd-buy-action cp-buy-action" id="raidShopBuy" type="button"></button>
          </div>
        </section>
      </div>

    </div>
  </div>`;

  renderGrid();
  renderDetail(true);

  const rb=document.getElementById("raidShopBack");
  if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}raidView="hub";renderRaid();};
  const bi=document.getElementById("raidShopBuy");
  if(bi)bi.onclick=()=>{
    if(bi.disabled)return;
    raidShopBuy(ITEMS[window.raidShopSel].k);
  };
}

/* =============== INDEX CARD (popup) =============== */
const IX_MUTS=["none","gold","rainbow","secret","ultima"];
let ixState={q:"",mut:"all",shiny:false,owned:false,sort:"name"};
function openIndex(){
  /* Katalog SEMUA kartu — layout meniru referensi "INDEX!": search di header, toolbar
     chip mutasi + toggle SHINY + OWNED ONLY + sort, grid full-art (nama, centang owned
     x/10, pips mut×shiny, nama+deskripsi skill di atas art), footer strip progres varian
     (segmen per mutasi) -> milestone INTAN ROLL 100K. Klik kartu = detail passive
     lengkap di #skillPop. Filter/sort state disimpan di ixState biar gak reset. */
  idxRewardSync(true);
  ixRender();
  document.getElementById("indexModal").classList.add("show");
  const sx=document.getElementById("ixSearch");
  sx.value=ixState.q;
  sx.oninput=()=>{ixState.q=sx.value.trim().toLowerCase();ixRender();};
  document.getElementById("spClose").onclick=()=>document.getElementById("skillPop").classList.remove("show");
  document.getElementById("skillPop").onclick=(e)=>{if(e.target.id==="skillPop")document.getElementById("skillPop").classList.remove("show");};
}
function ixRender(){
  const P=idxProgress();
  const ownCnt=(c,mut,sh)=>P.owned.has(`${c.char_id}|${mut}|${sh?1:0}`);
  const ownedN=(c,sh)=>IX_MUTS.reduce((n,m)=>n+(ownCnt(c,m,sh)?1:0),0);
  /* --- toolbar: chip mutasi + shiny + owned-only + sort --- */
  /* parse filter sekali: chip "s-*" = mutasi versi SHINY; fmSel = mutasi murni (null = semua) */
  const shChip=ixState.mut.startsWith("s-");
  const fmSel=ixState.mut==="all"?null:ixState.mut.slice(shChip?2:0);
  const fShiny=shChip||ixState.shiny;
  const chip=(k,l,cls)=>`<button class="ix-chip ${cls||""}${ixState.mut===k?' on':''}" type="button" data-mut="${k}">${l}</button>`;
  const toolbar=`<div class="ix-bar">
    <div class="ix-chips">${chip("all","ALL MATRIX","all")}${IX_MUTS.map(m=>chip(m,m==="none"?"PURE":MUT_LABEL[m],"m-"+m)).join("")}
      ${chip("s-gold","GOLD + SHINY","m-gold shp")}${chip("s-rainbow","RAINBOW + SHINY","m-rainbow shp")}${chip("s-secret","SECRET + SHINY","m-secret shp")}${chip("s-ultima","ULTIMA + SHINY","m-ultima shp")}
      <button class="ix-chip shiny${ixState.shiny?' on':''}" type="button" data-shiny="1">★ SHINY</button></div>
    <span class="ix-sp"></span>
    <button class="ix-tog${ixState.owned?' on':''}" type="button" data-owned="1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> OWNED ONLY</button>
    <div class="ix-sort-wrap">
      <select class="ix-sort" id="ixSort" title="Urutkan">
        <option value="name">SORT: NAME</option><option value="tier">SORT: TIER</option>
        <option value="own">SORT: VARIANTS</option><option value="chance">SORT: CHANCE</option>
      </select>
    </div></div>`;
  /* --- filter + sort --- */
  const TIER_RANK={R:0,SR:1,SSR:2,UR:3,EX:4,BOSS:5};
  let list=MASTER_CARD_INDEX.filter(c=>{
    if(c.isStoryEnemy||(c.noGacha&&!c.chance))return false;
    if(ixState.q&&!c.name.toLowerCase().includes(ixState.q))return false;
    /* Jika toggle OWNED ONLY aktif: hanya tampilkan yang sudah didapat */
    if(ixState.owned){
      if(fmSel){
        if(!ownCnt(c,fmSel,fShiny))return false;
      } else if(fShiny){
        if(!ownedN(c,true))return false;
      } else {
        if(!(ownedN(c,false)+ownedN(c,true)))return false;
      }
    }
    /* Default: Tampilkan semua kartu (termasuk yang belum dapat) di setiap tab mutasi */
    return true;
  });
  const T={name:(a,b)=>a.name.localeCompare(b.name),
    tier:(a,b)=>(TIER_RANK[a.tier]??9)-(TIER_RANK[b.tier]??9)||a.name.localeCompare(b.name),
    own:(a,b)=>(ownedN(b,false)+ownedN(b,true))-(ownedN(a,false)+ownedN(a,true))||a.name.localeCompare(b.name),
    chance:(a,b)=>(a.chance==null?1e9:a.chance)-(b.chance==null?1e9:b.chance)||a.name.localeCompare(b.name)};
  list.sort(T[ixState.sort]||T.name);
  /* --- kartu full-art --- */
  const cells=list.map(c=>{
    const any=ownedN(c,false)+ownedN(c,true);
    const anySh=ownedN(c,true)>0;

    /* Cek kepemilikan varian spesifik sesuai filter aktif:
       - fmSel ada & fShiny aktif: wajib punya varian (fmSel, SHINY)
       - fmSel ada & fShiny nonaktif: punya varian (fmSel, non-shiny) atau (fmSel, shiny)
       - fmSel null (tab ALL): cek fShiny ? anySh : any > 0 */
    const isSpecificVariantOwned = fmSel
      ? (fShiny ? ownCnt(c, fmSel, true) : (ownCnt(c, fmSel, false) || ownCnt(c, fmSel, true)))
      : (fShiny ? anySh : any > 0);

    /* Cek apakah kartu ini sedang berstatus SHINY dalam konteks tab saat ini:
       1) Tab SHINY aktif (fShiny == true) -> kartu tampil shiny (jika owned, atau preview shiny jika filter shiny)
       2) Tab ALL -> kartu tampil shiny jika pemain memiliki varian shiny kartu ini (anySh) */
    const isShinyActive = fShiny || (ixState.mut === "all" && anySh);

    const bestMut=ownCnt(c,"ultima",false)||ownCnt(c,"ultima",true)?"ultima":
      (ownCnt(c,"secret",false)||ownCnt(c,"secret",true)?"secret":
      ownCnt(c,"rainbow",false)||ownCnt(c,"rainbow",true)?"rainbow":
      (ownCnt(c,"gold",false)||ownCnt(c,"gold",true))?"gold":null);

    const fm = ixState.mut === "all" ? bestMut : fmSel;
    const hasMut = !!(fm && fm !== "none");
    const bc = hasMut ? MUT_COLOR[fm] : (isSpecificVariantOwned ? "#9AA6B2" : "#3A3F47");
    const chanceColor = hasMut ? MUT_COLOR[fm] : "#9AA6B2";
    const chanceText = `1 IN ${fmtChance(effChance(c.char_id, fmSel || "none", fShiny))}`;
    const chanceHtml = hasMut && (fm === 'rainbow' || fm === 'ultima') ? mutText(fm, chanceText) : chanceText;
    const lockBoss = !!(c.raidBoss && !bossRollUnlocked(c.char_id));

    const shFx = isShinyActive;
    const comboFx = !!(shFx && hasMut);
    const cls = `ix-cell${isSpecificVariantOwned ? '' : ' no-own'}${lockBoss ? ' boss-locked' : ''}${shFx ? ' shiny' : ''}${hasMut ? ' m-' + fm : ''}${comboFx ? ' combo-mut' : ''}`;

    const safeName = String(c.name).replace(/"/g, '&quot;');
    const shinyStyle = hasMut && fm === 'gold' ? '--sh-base:#E0BC6E;--sh-edge:rgba(224,188,110,.95);--sh-glow:rgba(224,188,110,.55)'
      : hasMut && fm === 'rainbow' ? '--sh-base:#B58CFF;--sh-edge:rgba(90,200,250,.95);--sh-glow:rgba(181,140,255,.55)'
      : hasMut && fm === 'secret' ? '--sh-base:#A855F7;--sh-edge:rgba(168,85,247,.95);--sh-glow:rgba(168,85,247,.55)'
      : hasMut && fm === 'ultima' ? '--sh-base:#FF0055;--sh-edge:rgba(255,51,102,.95);--sh-glow:rgba(255,0,85,.6)'
      : '--sh-base:#22d3ee;--sh-edge:rgba(34,211,238,.95);--sh-glow:rgba(34,211,238,.55)';

    /* Tampilan Nama Kartu:
       - Jika SHINY: WAJIB gunakan kelas .hc-name-shine + .hc-name-shine-{mutasi} agar gradien animasinya aktif dan BUKAN mutText
       - Jika BUKAN SHINY: gunakan .hc-mut-name (animasi sweep mutasi biasa) */
    let nameHtml = '';
    if (shFx) {
      nameHtml = `<span class="ixc-name hc-name-top hc-name-shine${hasMut ? ' hc-name-shine-' + fm : ''}" data-text="${safeName}" style="${shinyStyle}">${c.name}</span>`;
    } else if (hasMut) {
      nameHtml = `<span class="ixc-name hc-name-top hc-mut-name" data-text="${safeName}">${fm === 'rainbow' || fm === 'ultima' ? mutText(fm, c.name) : c.name}</span>`;
    } else {
      nameHtml = `<span class="ixc-name hc-name-top">${c.name}</span>`;
    }

    return `<button class="${cls}" type="button" data-c="${c.char_id}" data-mut="${hasMut ? fm : 'none'}" data-shiny="${shFx ? '1' : '0'}"${lockBoss ? ' title="BELUM DIBELI - beli di TOKO RAID untuk buka roll"' : ''} style="--tc:#9AA6B2;--bc:${bc}">
      <img src="${c.sprite_asset}" alt="${c.name}">
      <span class="ixc-stack">${nameHtml}<span class="ixc-chance${hasMut && (fm === 'rainbow' || fm === 'ultima') ? ' ixc-chance-rainbow' : ''}" style="color:${chanceColor}"><span class="ixc-chance-text">${chanceHtml}</span></span></span>
      <span class="ixc-own${isSpecificVariantOwned ? ' on' : ''}">${any}/10</span>
    </button>`;
  }).join("");
  /* --- footer: strip progres SEGMENT per mutasi + milestone INTAN ROLL --- */
  const validCards=MASTER_CARD_INDEX.filter(c=>!c.isStoryEnemy);
  const t=validCards.length;
  const segs=IX_MUTS.map(m=>{let n=0;for(const c of validCards)if(ownCnt(c,m,false))n++;
    return `<i title="${MUT_LABEL[m]||'MURNI'} ${n}/${t}" style="--p:${t?Math.round(n/t*100):0}%;--c:${m==='none'?'#9AA6B2':MUT_COLOR[m]}"></i>`;}).join("");
  const pct=P.total?Math.min(100,Math.round(P.count/P.total*100)):0;
  const complete=P.total>0&&P.count>=P.total;
  const next=Math.max(0,IDX_MILESTONE-(P.count%IDX_MILESTONE));
  const claimable = P.blocks - P.claimed;
  const strip=`<div class="ix-prog">
    <div class="ixp-col">
      <div class="ixp-lbl">VARIAN TERKUMPUL</div>
      <div class="ixp-val">${fmt(P.count)}<em> / ${fmt(P.total)}</em></div>
    </div>
    <div class="ixp-track ix-seg" title="${pct}%">${segs}</div>
    <div class="ixp-rw-box">
      <div class="ixp-rw-icon">
        <img src="assets/images/instanpack-5k.webp?v=trans1" alt="5K Pack" width="38" height="38">
      </div>
      <div class="ixp-rw-text">
        <div class="ixp-rw-title">MILESTONE REWARD</div>
        <div class="ixp-rw-sub">${complete ? "SEMUA VARIAN LENGKAP" : `${next} varian lagi menuju +1 Pack 5K`}</div>
      </div>
      <div class="ixp-rw-btn-wrap">
        <button class="ix-claim-btn ${claimable > 0 ? 'ready' : 'locked'}" type="button" onclick="claimIndexReward()" ${claimable > 0 ? '' : 'disabled'}>
          ${claimable > 0 ? `KLAIM REWARD (+${claimable})` : 'BELUM BISA KLAIM'}
        </button>
      </div>
    </div>
  </div>`;
  document.getElementById("ixToolbar").innerHTML=toolbar;
  document.getElementById("ixBody").innerHTML=(list.length?"":`<div class="ix-empty">Tidak ada kartu yang cocok</div>`)+`<div class="ix-grid">${cells}</div>`;
  document.getElementById("ixFoot").innerHTML=strip;
  const sel=document.getElementById("ixSort");sel.value=ixState.sort;
  sel.onchange=()=>{ixState.sort=sel.value;ixRender();};
  document.querySelectorAll("#ixToolbar .ix-chip[data-mut]").forEach(b=>b.onclick=()=>{ixState.mut=b.dataset.mut;ixRender();});
  const shb=document.querySelector("#ixToolbar [data-shiny]");if(shb)shb.onclick=()=>{ixState.shiny=!ixState.shiny;ixRender();};
  const owb=document.querySelector("#ixToolbar [data-owned]");if(owb)owb.onclick=()=>{ixState.owned=!ixState.owned;ixRender();};
  document.querySelectorAll("#ixBody .ix-cell").forEach(cell=>{
    cell.onclick=()=>{
      const c=CARDS[cell.dataset.c];
      if(!c)return;
      const mut=cell.dataset.mut||"none";
      const isShiny=cell.dataset.shiny==="1";
      const hasMut=mut&&mut!=="none";
      const spArtCard=document.getElementById("spArtCard");
      if(spArtCard){
        spArtCard.classList.toggle("shiny", isShiny);
        ["m-gold","m-rainbow","m-secret","m-ultima"].forEach(k=>spArtCard.classList.remove(k));
        if(hasMut)spArtCard.classList.add("m-"+mut);
        spArtCard.style.borderColor="";
        spArtCard.style.boxShadow="";
      }
      const spImg=document.getElementById("spImg");
      if(spImg){
        spImg.src=c.sprite_asset||"";
        if(c.pos)spImg.style.objectPosition=c.pos;
        else spImg.style.objectPosition="center";
      }
      const spCardName=document.getElementById("spCardName");
      if(spCardName){
        let displayName=c.name||"";
        if(hasMut&&mut==="ultima"){
          spCardName.innerHTML=`<span style="color:#FF0033;text-shadow:0 0 10px rgba(255,0,51,.85), 0 0 20px rgba(255,0,51,.5);font-weight:900">${displayName}</span>`+(isShiny?' <span style="color:#7DF9FF;font-size:.7em">★ SHINY</span>':'');
        } else if(hasMut&&mut==="rainbow"){
          spCardName.innerHTML=mutText(mut,displayName)+(isShiny?' <span style="color:#7DF9FF;font-size:.7em">★ SHINY</span>':'');
        } else if(hasMut){
          spCardName.innerHTML=`<span style="color:${MUT_COLOR[mut]}">${displayName}</span>`+(isShiny?' <span style="color:#7DF9FF;font-size:.7em">★ SHINY</span>':'');
        } else if(isShiny){
          spCardName.innerHTML=`<span style="color:#7DF9FF">${displayName}</span> <span style="font-size:.7em">★ SHINY</span>`;
        } else {
          spCardName.textContent=displayName;
        }
      }
      const chVal=effChance(c.char_id, mut, isShiny);
      const spCardRarity=document.getElementById("spCardRarity");
      if(spCardRarity){
        const chanceStr="1 in "+fmtChance(chVal);
        if(hasMut&&(mut==="rainbow"||mut==="ultima")){
          spCardRarity.innerHTML=mutText(mut, chanceStr);
        } else if(hasMut){
          spCardRarity.innerHTML=`<span style="color:${MUT_COLOR[mut]}">${chanceStr}</span>`;
        } else if(isShiny){
          spCardRarity.innerHTML=`<span style="color:#7DF9FF">${chanceStr}</span>`;
        } else {
          spCardRarity.textContent=chanceStr;
        }
      }
      const st=cardStats(c.char_id, mut, "none", isShiny);
      const spHp=document.getElementById("spHp");
      if(spHp)spHp.textContent=fmtC(st.hp||c.base_hp||0);
      const spAtk=document.getElementById("spAtk");
      if(spAtk)spAtk.textContent=fmtC(st.atk||c.base_atk||0);
      const spName=document.getElementById("spName");
      if(spName)spName.textContent=c.passive?c.passive.name:"-";
      const spDesc=document.getElementById("spDesc");
      if(spDesc)spDesc.textContent=c.passive?c.passive.desc:"-";
      document.getElementById("skillPop").classList.add("show");
    };
  });
}



/* =============== TRAIT ROLL (popup) =============== */
let traitTarget=null;
let pendingRare=null;
/* ===== AUTO ROLL TRAIT ===== — target dicentang di list DROP RATE; state session-only (tidak disave) */
let autoRoll=false,autoRollTimer=null,autoRollN=0;
let pendingRareAuto=false;
let autoTargets=new Set();
const AUTO_TICK=100; // ms antar roll (kecepatan auto roll)
function traitTargetStack(){let s=state.stacks.find(x=>x.id===traitTarget);if(!s){s=equipped();traitTarget=s?s.id:null;}return s;}
function openTrait(){
  traitTarget=null;pendingRare=null;pendingRareAuto=false;renderTrait();document.getElementById("traitModal").classList.add("show");
}
function closeTrait(){autoStop();document.getElementById("traitModal").classList.remove("show");hideTraitTip();}
function renderTrait(){
  const b=document.getElementById("trBody");
  if(!state.stacks.length){b.innerHTML=`<div class="tr-empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><p class="sub">DECK SYNAPSE KOSONG. Buka kartu terlebih dahulu via Gacha Summon.</p></div>`;return;}
  const tgt=traitTargetStack();
  const hasT=!!(tgt.trait&&tgt.trait!=="none");
  const tt=hasT?TRAIT[tgt.trait]:null;
  const curColor=tt?tt.color:"var(--cyan)";
  const cur=tt?traitChip(tt.k,`<span class="tc-trait-pill" style="--tcol:${tt.color}"><span class="tc-gem-wrap">${traitGem(16,tt.k)}</span> <span class="tc-name-glow">${traitLabel(tt.k)}</span></span>`):`<span class="tc-trait-none"><span class="tc-none-dot"></span>TANPA TRAIT</span>`;
  const curStat=tt?`<div class="tc-badge-stat"><span class="tcb-tag">ATK</span> <b class="tcb-val">+${Math.round((tt.atk-1)*100)}%</b></div><div class="tc-badge-stat"><span class="tcb-tag">HP</span> <b class="tcb-val">+${Math.round((tt.hp-1)*100)}%</b></div>`:`<div class="tc-badge-stat tc-stat-empty">ROLL UNTUK MENGAKTIFKAN MODIFIER</div>`;
  const rates=TRAIT_TIERS.filter(t=>t.chance>0).map(t=>{
    const own=tgt.trait===t.k;
    const isTarget=autoTargets.has(t.k);
    const aPct=Math.round((t.atk-1)*100),hPct=Math.round((t.hp-1)*100);
    const bar=Math.max(2,Math.round((t.chance/55)*1000)/10);
    return `<div class="trr-item${own?" own":""}${isTarget?" is-target":""}" data-tk="${t.k}" style="--tcol:${t.color}" title="${t.name} • RARITY ${t.rar} • ATK +${aPct}% • HP +${hPct}%">
      <div class="trr-row">
        <span class="trr-gem" style="color:${t.color}">${traitGem(16,t.k)}</span>
        <span class="trr-name">${t.name}</span>
        ${own?`<span class="trr-flag">ACTIVE</span>`:""}
        <span class="trr-rar">${t.rar}</span>
        <span class="trr-pct">${t.chance}%</span>
        <label class="trr-tgt" title="Target Auto Roll">
          <input type="checkbox" data-atgt="${t.k}"${isTarget?" checked":""}>
          <span class="trr-tgt-box">
            <svg class="trr-tgt-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </span>
        </label>
      </div>
      <div class="trr-bar"><i style="width:${bar}%;background:linear-gradient(90deg,${t.color},#7DF9FF)"></i></div>
    </div>`;}).join("");
  b.innerHTML=`
    <div class="tr-grid">
      <div class="tr-main">
        <div class="tr-cur tr-cur-btn" id="trPickCard" role="button" title="Ganti target kartu" style="--tcol:${curColor}">
          <div class="tr-cur-thumb-wrap">
            <img src="${cardImg(tgt.char)}" alt="">
            <span class="tr-cur-scanline"></span>
          </div>
          <div class="tr-cur-info">
            <div class="tc-lbl-row">
              <span class="tc-lbl">SUBJECT MATRIX</span>
              <span class="tc-code">NODE #${tgt.id ? tgt.id.slice(0,5).toUpperCase() : '001'}</span>
            </div>
            <div class="tc-name">${cardName(tgt.char)}</div>
            <div class="tc-tline">${cur}</div>
            <div class="tc-tstat-wrap">${curStat}</div>
          </div>
          <button class="tr-change-ic" type="button" title="Ganti Target Kartu">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17v-2a4 4 0 0 0-4-4H4"/><path d="m14 7 4 4-4 4"/><path d="M4 7v2a4 4 0 0 0 4 4h12"/><path d="m10 17-4-4 4-4"/></svg>
          </button>
        </div>

        <div class="tr-controls">
          <button class="tr-btn tr-roll" id="trRoll" ${state.coins<TRAIT_COST||autoRoll?"disabled":""}>
            <span class="tr-btn-glow"></span>
            <span class="tr-btn-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>${autoRoll?"SYNTHESIS RUNNING...":"ROLL TRAIT"}</span>
              <span class="tr-cost-badge">${coinIcon(15)} ${fmt(TRAIT_COST)}</span>
            </span>
          </button>
        </div>

        <div class="tr-auto-panel${autoRoll?" on":""}">
          <div class="tr-auto-top">
            <button class="tr-btn tr-auto-btn" id="trAuto"${!autoRoll&&state.coins<TRAIT_COST?" disabled":""}>
              ${autoRoll?`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> ABORT AUTO`:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg> INITIATE AUTO ROLL`}
            </button>
            <div class="tr-pulse-indicator${autoRoll?' pulse-run':''}">
              <span class="tr-pi-dot"></span>
              <span class="tr-pi-txt">${autoRoll?'OVERCLOCK 100ms':'IDLE'}</span>
            </div>
          </div>
          <div class="tr-auto-meta">
            <div class="tram-row"><span class="tram-k">LOCKED TARGET:</span> <b class="tram-v">${targetLabel()}</b></div>
            <div class="tram-row"><span class="tram-k">ITERATION:</span> <b class="tram-n" id="trAutoN">#${autoRollN}</b></div>
          </div>
        </div>

        <div class="tr-footer-status">
          <div class="tr-coin-pill">
            ${coinIcon(16)}
            <span>CREDITS:</span>
            <b class="tr-coin" id="trCoinVal">${fmt(state.coins)}</b>
          </div>
          <div class="tr-tip-txt">Roll menyuntikkan trait mod ke target & berhenti otomatis jika target matrix cocok.</div>
        </div>
      </div>

      <div class="tr-rates">
        <div class="trr-h">
          <div class="trr-h-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            TRAIT PROBABILITY
          </div>
          <span class="trr-h-sub">CENTANG TARGET AUTO</span>
        </div>
        <div class="trr-list">${rates}</div>
      </div>
    </div>`;
  const r=document.getElementById("trRoll");if(r)r.onclick=rollTrait;
  const ab=document.getElementById("trAuto");if(ab)ab.onclick=toggleAuto;
  b.querySelectorAll("input[data-atgt]").forEach(cb=>{cb.onchange=()=>{
    const key=cb.getAttribute("data-atgt");
    if(cb.checked)autoTargets.add(key);else autoTargets.delete(key);
    const m=b.querySelector(".tram-v");
    if(m)m.textContent=targetLabel();
    const item=cb.closest('.trr-item');
    if(item)item.classList.toggle('is-target',cb.checked);
  };});
  const pc=document.getElementById("trPickCard");if(pc)pc.onclick=()=>openDeckPick();
}
let cardPickCfg=null;
function openDeckPick(cfg){dpSearch="";cardPickCfg=(cfg&&cfg.getSel&&cfg.onPick)?cfg:null;document.getElementById("deckPickModal").classList.toggle("dp-dark",!cardPickCfg);renderDeckPick();document.getElementById("deckPickModal").classList.add("show");}
function closeDeckPick(){document.getElementById("deckPickModal").classList.remove("show");hideTraitTip();cardPickCfg=null;}
function renderDeckPick(){
  const b=document.getElementById("dpBody");
  if(!state.stacks.length){b.innerHTML=`<p class="sub">Deck kosong.</p>`;return;}
  const selId=cardPickCfg?cardPickCfg.getSel():traitTargetStack().id;
  b.innerHTML=`<label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="dpSearch" type="text" placeholder="Cari kartu…" autocomplete="off"></label><div class="dp-grid" id="dpGrid">${state.stacks.map(s=>{
    return `<button class="dp-card${s.id===selId?" sel":""}${s.mut&&s.mut!=="none"?(s.shiny?" dp-mut-shiny-"+s.mut:" dp-mut-"+s.mut):""}${s.shiny?" shiny":""}" data-tid="${s.id}" data-name="${cardName(s.char).toLowerCase()}">
      <img src="${cardImg(s.char)}" alt="">
      ${s.shiny||(s.mut&&s.mut!=="none")||(s.trait&&s.trait!=="none")?`<span class="dp-badges">${s.shiny?'<span class="shiny-badge shiny-pill">SHINY</span>':""}${s.mut&&s.mut!=="none"?mutChip(s.mut,mutPill(s.mut,'mut-badge dp-mut')):""}${s.trait&&s.trait!=="none"?traitChip(s.trait,`<span class="trait-badge dp-gem" style="border-color:${TRAIT_COLOR[s.trait]}">${traitGem(13,s.trait)}</span>`):""}</span>`:""}
      <span class="dp-name">${cardName(s.char)}</span>
    </button>`;}).join("")}</div><div class="no-result" id="dpSearch-nr">Tidak ada kartu yang cocok.</div>`;
  {const dps=document.getElementById("dpSearch");if(dps){dps.value=dpSearch;dps.oninput=()=>{dpSearch=dps.value;runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));};if(dpSearch)runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));}}
  b.querySelectorAll(".dp-card").forEach(el=>el.onclick=()=>{const tid=el.getAttribute("data-tid");sfx.hit();if(cardPickCfg){cardPickCfg.onPick(tid);}else{traitTarget=tid;closeDeckPick();renderTrait();}});
}
/* Trait transiden ke atas = langka; jangan ditimpa tanpa konfirmasi */
const RARE_TRAIT_GUARD=["transiden","demigod","cosmic","bigbang"];
let traitRareBusy=false;
function isRareTrait(k){return RARE_TRAIT_GUARD.indexOf(k)>=0;}
function confirmRareReplace(k,auto){
  const t=TRAIT[k];if(!t)return Promise.resolve(true);
  if(traitRareBusy)return Promise.resolve(false);
  traitRareBusy=true;
  const tgt=traitTargetStack();
  const nm=tgt?cardName(tgt.char):"kartu target";
  const body=
    '<div class="glcf-row"><span class="glcf-label">TRAIT</span><span class="glcf-val" style="color:'+t.color+'"><b>'+t.name+'</b> · '+t.rar+'</span></div>'+
    '<div class="glcf-row"><span class="glcf-label">POWER</span><span class="glcf-val">ATK +'+Math.round((t.atk-1)*100)+'% · HP +'+Math.round((t.hp-1)*100)+'%</span></div>'+
    '<div class="glcf-row"><span class="glcf-label">KARTU</span><span class="glcf-val">'+nm+'</span></div>'+
    '<div class="glcf-warn">'+(auto
      ? 'Auto roll akan mulai mengganti trait ini. Trait hanya aman kalau sudah dicentang sebagai target (auto berhenti saat kena). Sisa coin: '+fmt(state.coins)+'.'
      : 'Trait ini akan <b>hilang tertimpa</b> kalau kamu roll lagi. Sisa coin: '+fmt(state.coins)+'.')+'</div>';
  return showConfirmDialog({title:"TRAIT LANGKA TERPASANG",body:body,okText:auto?"LANJUT AUTO":"ROLL JUGA"}).then(v=>{traitRareBusy=false;return v;});
}
async function rollTrait(){
  if(autoRoll)return; // tombol manual diblokir selama auto roll jalan
  if(state.coins<TRAIT_COST)return;
  const tgt=traitTargetStack();if(!tgt)return;
  if(isRareTrait(tgt.trait)){
    if(!(await confirmRareReplace(tgt.trait)))return;
    if(autoRoll||state.coins<TRAIT_COST)return;
  }
  state.coins-=TRAIT_COST;
  const k=rollTraitPick();
  sfx.crit();
  if(TRAIT[k].atk>=1.5){ save(); renderShell(); renderTrait(); showRarePrompt(k); }
  else { tgt.trait=k; save(); if(!state.battle&&typeof render==="function")render(); renderTrait(); traitNotify(k); }
}
function showRarePrompt(k,auto){
  const t=TRAIT[k];if(!t)return;
  pendingRare=k;
  pendingRareAuto=!!auto;
  const b=document.getElementById("rpBody");
  const canRoll=state.coins>=TRAIT_COST;
  b.innerHTML=`
    <div class="rp-rays"></div>
    ${traitGem(78,k,"rp-gem")}
    <div class="rp-kicker">${auto?"TRAIT LANGKA · AUTO ROLL BERHENTI":"TRAIT LANGKA"}</div>
    <div class="rp-name" style="color:${t.color}">${t.name}</div>
    <div class="rp-rar" style="color:${t.color}">RARITY ${t.rar}</div>
    <div class="rp-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</div>
    <div class="rp-fx">${traitFxList(k)}</div>
    <div class="rp-btns">
      <button class="rp-btn rp-save" id="rpSave">${auto?"STOP · SIMPAN INI":"SIMPAN"}</button>
      <button class="rp-btn rp-roll" id="rpRoll" ${canRoll?"":"disabled"}>${auto?`ROLL LAGI · LANJUT AUTO · ${fmt(TRAIT_COST)} COIN`:`ROLL LAGI · ${fmt(TRAIT_COST)} COIN`}</button>
    </div>
    <div class="rp-note">${auto?"STOP mengunci trait ini ke kartu target &amp; menghentikan auto roll. ROLL LAGI membuang hasil ini dan melanjutkan auto roll (bayar coin lagi).":"SIMPAN memasang trait ini ke kartu target. ROLL LAGI membuang hasil ini dan mencoba lagi (bayar coin lagi)."}</div>`;
  const box=document.getElementById("rpBox");box.style.color=t.color;box.style.borderColor=t.color;
  document.getElementById("rarePromptModal").classList.add("show");
  document.getElementById("rpSave").onclick=saveRare;
  const rr=document.getElementById("rpRoll");if(rr)rr.onclick=auto?resumeAutoRoll:rerollRare;
}
function closeRarePrompt(){document.getElementById("rarePromptModal").classList.remove("show");}
function saveRare(){const k=pendingRare;autoStop();pendingRareAuto=false;const tgt=traitTargetStack();if(tgt&&k)tgt.trait=k;pendingRare=null;closeRarePrompt();save();if(!state.battle&&typeof render==="function")render();renderTrait();if(k)traitNotify(k);}
function rerollRare(){pendingRare=null;pendingRareAuto=false;closeRarePrompt();rollTrait();}
/* ===== AUTO ROLL (loop 100ms) ===== */
function targetLabel(){return autoTargets.size?[...autoTargets].map(k=>TRAIT[k]?TRAIT[k].name:"").filter(Boolean).join(" · "):"centang di DROP RATE";}
function autoStop(){autoRoll=false;clearTimeout(autoRollTimer);autoRollTimer=null;}
function toggleAuto(){autoRoll?stopAutoRoll():startAutoRoll();}
async function startAutoRoll(){
  if(autoRoll)return;
  if(state.coins<TRAIT_COST){autoToast(`BUTUH ${fmt(TRAIT_COST)} COIN UNTUK AUTO ROLL`);return;}
  const tgt=traitTargetStack();
  if(tgt&&isRareTrait(tgt.trait)){
    if(!(await confirmRareReplace(tgt.trait,true)))return;
    if(autoRoll||state.coins<TRAIT_COST)return;
  }
  autoRoll=true;autoRollN=0;renderTrait();autoTick();
}
function stopAutoRoll(){autoStop();renderTrait();if(!state.battle&&typeof render==="function")render();}
function traitUiRefresh(){
  const tgt=traitTargetStack();
  const root=document.getElementById("traitModal");
  if(!root||!tgt)return;
  const hasT=!!(tgt.trait&&tgt.trait!=="none");
  const tt=hasT?TRAIT[tgt.trait]:null;
  /* --- SUBJECT MATRIX: pill trait + stat badge (SCOPED ke modal trait!) --- */
  const tl=root.querySelector(".tc-tline");
  if(tl){
    tl.innerHTML=tt
      ? traitChip(tt.k,`<span class="tc-trait-pill" style="--tcol:${tt.color}"><span class="tc-gem-wrap">${traitGem(16,tt.k)}</span> <span class="tc-name-glow">${traitLabel(tt.k)}</span></span>`)
      : `<span class="tc-trait-none"><span class="tc-none-dot"></span>TANPA TRAIT</span>`;
  }
  const tsw=root.querySelector(".tc-tstat-wrap");
  if(tsw){
    tsw.innerHTML=tt
      ? `<div class="tc-badge-stat"><span class="tcb-tag">ATK</span> <b class="tcb-val">+${Math.round((tt.atk-1)*100)}%</b></div><div class="tc-badge-stat"><span class="tcb-tag">HP</span> <b class="tcb-val">+${Math.round((tt.hp-1)*100)}%</b></div>`
      : `<div class="tc-badge-stat tc-stat-empty">ROLL UNTUK MENGAKTIFKAN MODIFIER</div>`;
  }
  const curCard=document.getElementById("trPickCard");
  if(curCard)curCard.style.setProperty("--tcol",tt?tt.color:"var(--cyan)");
  /* --- DROP RATE list: pindahkan flag ACTIVE ke tier yang sedang aktif --- */
  root.querySelectorAll(".trr-item").forEach(it=>{
    const k=it.getAttribute("data-tk");
    const own=(!!tt&&k===tt.k);
    it.classList.toggle("own",own);
    const nameRow=it.querySelector(".trr-row");
    if(!nameRow)return;
    const old=nameRow.querySelector(".trr-flag");
    if(old)old.remove();
    if(own){
      const flag=document.createElement("span");
      flag.className="trr-flag";
      flag.textContent="ACTIVE";
      const rar=nameRow.querySelector(".trr-rar");
      if(rar)nameRow.insertBefore(flag,rar);else nameRow.appendChild(flag);
    }
  });
}
function autoPaint(){
  const cv=document.getElementById("coinVal");if(cv)cv.textContent=fmt(state.coins);
  const c=document.getElementById("trCoinVal");if(c)c.textContent=fmt(state.coins);
  const n=document.getElementById("trAutoN");if(n)n.textContent="#"+autoRollN;
}
/* FX per tick auto roll: retrigger class supaya animasi CSS jalan tiap roll */
function traitFxTick(k){
  const root=document.getElementById("traitModal");if(!root)return;
  const t=TRAIT[k];
  const card=document.getElementById("trPickCard");
  if(card){
    if(t)card.style.setProperty("--tcol",t.color);
    card.classList.remove("tr-tick");void card.offsetWidth;card.classList.add("tr-tick");
  }
  const n=document.getElementById("trAutoN");
  if(n){n.classList.remove("tr-n-pop");void n.offsetWidth;n.classList.add("tr-n-pop");}
  root.querySelectorAll(".trr-item.trr-hit").forEach(el=>el.classList.remove("trr-hit"));
  const own=root.querySelector(".trr-item.own");
  if(own){void own.offsetWidth;own.classList.add("trr-hit");}
}
function autoTick(){
  if(!autoRoll)return;
  if(state.coins<TRAIT_COST){stopAutoRoll();save();renderShell();autoToast("AUTO ROLL STOP · COIN HABIS");return;}
  const tgt=traitTargetStack();if(!tgt){stopAutoRoll();return;}
  state.coins-=TRAIT_COST;autoRollN++;
  const k=rollTraitPick();
  if(autoRollN%10===0)sfx.crit(); // sfx ditahan tiap 10 roll biar gak nembak terus di 100ms
  if(autoTargets.has(k)){tgt.trait=k;autoStop();save();if(!state.battle&&typeof render==="function")render();renderTrait();traitNotify(k);return;} // TARGET KENA → simpan + stop
  tgt.trait=k;
  if(autoRollN%10===0)save();
  autoPaint();
  traitUiRefresh();
  traitFxTick(k);
  autoRollTimer=setTimeout(autoTick,AUTO_TICK);
}
function resumeAutoRoll(){pendingRare=null;pendingRareAuto=false;closeRarePrompt();if(!autoRoll){renderTrait();return;}autoRollTimer=setTimeout(autoTick,AUTO_TICK);}
function autoToast(msg){
  const el=document.getElementById("traitNotify");if(!el)return;
  el.innerHTML=`<div class="tn-card tn-toast"><div class="tn-body"><div class="tn-top" style="color:#FFCf6E">${msg}</div></div></div>`;
  el.classList.add("show");
  clearTimeout(el._t);el._t=setTimeout(()=>{el.classList.remove("show");},2200);
}
function traitNotify(k){
  const t=TRAIT[k];if(!t)return;
  const el=document.getElementById("traitNotify");if(!el)return;
  const rare=t.atk>=1.5;
  el.innerHTML=`<div class="tn-card${rare?" tn-rare":""}" style="border-color:${t.color};color:${t.color}">
    ${traitGem(46,k,"tn-gem")}
    <div class="tn-body">
      <div class="tn-top" style="color:${t.color}">${t.name}</div>
      <div class="tn-rar">RARITY ${t.rar}</div>
      <div class="tn-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</div>
      <div class="tn-fx">${traitFxList(k)}</div>
    </div></div>`;
  el.classList.add("show");
  clearTimeout(el._t);el._t=setTimeout(()=>{el.classList.remove("show");},2800);
}
/* global trait/mut tooltip (fixed → tidak memicu scroll horizontal modal) */
let __traitTipEl=null;
function hideTraitTip(){if(__traitTipEl)__traitTipEl.classList.remove("show");}
function tipHtmlFor(el){const tk=el.getAttribute("data-trait");if(tk&&TRAIT[tk])return traitTipInner(tk);const mk=el.getAttribute("data-mut");if(mk&&MUT_LABEL[mk])return mutTipInner(mk);return "";}
function showTraitTip(el){
  const html=tipHtmlFor(el);if(!html)return;
  if(!__traitTipEl){__traitTipEl=document.createElement("div");__traitTipEl.id="traitTip";document.body.appendChild(__traitTipEl);}
  __traitTipEl.innerHTML=html;
  __traitTipEl.classList.add("show");
  const r=el.getBoundingClientRect(),tw=__traitTipEl.offsetWidth,th=__traitTipEl.offsetHeight;
  let left=r.left+r.width/2-tw/2;left=Math.max(8,Math.min(left,window.innerWidth-tw-8));
  let top=r.top-th-10;if(top<8)top=r.bottom+10;
  __traitTipEl.style.left=left+"px";__traitTipEl.style.top=top+"px";
}
document.addEventListener("mouseover",e=>{const el=e.target.closest&&e.target.closest(".trait-hover,.mut-hover");if(el)showTraitTip(el);});
document.addEventListener("mouseout",e=>{const el=e.target.closest&&e.target.closest(".trait-hover,.mut-hover");if(el)hideTraitTip();});
window.addEventListener("scroll",hideTraitTip,true);

