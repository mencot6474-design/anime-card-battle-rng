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
  const b=raidBossOf();
  const tierTok=RAID_TIERS.slice().reverse();
  app.innerHTML=`
  <div class="tw-page rd-page"><div class="tw-hub rd-hub">
    <section class="tw-stage rd-stage">
      <div class="tw-stage-eyebrow">BOSS RAID</div>
      <div class="rd-wm">EX</div>
      <div class="rd-boss">
        <div class="rd-boss-frame"><img src="${b.img}" alt="${b.name}">
          <div class="rd-boss-tag"><span class="rbt-tier">EX TIER</span><span class="rbt-skill">${b.skill.toUpperCase()}</span></div>
        </div>
      </div>
      <div class="tw-stage-hint"><kbd>MASUK</kbd> KURAS HP BOSS DALAM ${RAID_TURNS} TURN</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="rd-title">${b.name}</div>
        <div class="rd-sub">RAID BOSS &middot; DAMAGE = TOKEN &middot; TOKEN = PERKAKAS</div>
      </div>
      <div class="rd-stats">
        <div class="tbs"><span>TOKEN RAID</span><b>${fmt(state.raidTokens||0)}</b></div>
        <div class="tbs"><span>HP BOSS</span><b>${fmt(b.hp)}</b></div>
        <div class="tbs"><span>BATTLE POWER</span><b>${fmt(b.power)}</b></div>
      </div>
      <div>
        <div class="eyebrow" style="margin-bottom:8px">TINGKAT KESULITAN</div>
        <div class="raid-diff" id="raidDiffRow">${RAID_DIFFS.map(d=>{const unl=raidDiffUnlocked(d.k),on=d.k===state.raidDiff;return `<button class="diff-btn${on?" on":""}${unl?"":" locked"}" data-rd="${d.k}"${on?` style="border-color:${d.color};color:${d.color}"`:""}>${unl?d.l:"&#128274; "+d.l}</button>`;}).join("")}</div>
      </div>
      <div class="rd-tiers">
        ${tierTok.map(t=>`<div class="rd-tier"><span>${t.pct}% DMG</span><b>+${Math.round(t.tokens*(b.rw||1))}</b><i>TOKEN</i></div>`).join("")}
      </div>
      <div class="tw-acts">
        <button class="act go" id="raidGo">
          <span class="amed"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M19 21l2-2"/></svg></span>
          <span class="atxt"><small>Kuras HP boss</small><b>MASUK RAID</b></span>
        </button>
        <button class="act violet" id="raidShopBtn">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>
          <span class="atxt"><small>Belanja token</small><b>TOKO RAID</b></span>
        </button>
        <button class="act cyan" id="raidLobby">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></span>
          <span class="atxt"><small>Kembali</small><b>LOBBY</b></span>
        </button>
      </div>
      <p class="rd-note">Kuras sebagian HP boss dalam satu percobaan untuk klaim token — makin besar <b>% damage</b>, makin banyak token. Makin sulit tingkatnya, HP boss naik tapi token reward ikut berlipat (<b class="v">×${b.rw||1}</b>). Token dibelanjakan di TOKO RAID.</p>
    </section>
  </div></div>`;
  document.getElementById("raidGo").onclick=()=>{if(!raidDiffUnlocked(state.raidDiff)){raidToast("Tingkat ini masih terkunci.");return;}sfx.hit();raidView="pick";renderRaid();};
  document.getElementById("raidShopBtn").onclick=()=>{sfx.hit();raidView="shop";renderRaid();};
  const rl=document.getElementById("raidLobby");if(rl)rl.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};
  app.querySelectorAll("[data-rd]").forEach(btn=>btn.onclick=()=>{
    const k=btn.dataset.rd;
    if(!raidDiffUnlocked(k)){raidToast("Selesaikan tingkat "+raidNextUnlock(k)+" dulu untuk buka "+RAID_DIFFS.find(d=>d.k===k).l+".");return;}
    if(state.raidDiff===k)return;state.raidDiff=k;sfx.hit();save();renderRaidHub();
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
      const shny=s.shiny?'<span class="bpt-shiny">SHINY</span>':'';
      const mut=(s.mut&&s.mut!=='none')?s.mut:null;
      const trait=(s.trait&&s.trait!=='none')?s.trait:null;
      const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
      const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,`<span class="bpt-mut" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="bpt-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
      return `<div class="bp-tile" data-sid="${s.id}" data-pick="${s.id}" data-name="${c.name.toLowerCase()}" style="--tcol:${TIER_COLOR[s.tier]}"><img src="${cardImg(s.char)}" alt="">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}');renderRaidPick()" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}');renderRaidPick()" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${c.name}</div></div>`;
    }).join("")}</div>
    <div class="no-result" id="raidSearch-nr">Tidak ada kartu yang cocok dengan pencarian.</div>
  </div>`;
  bpsHoverBind();bpsHoverHide(); /* hover tile -> reveal kartu penuh (stat/passive) kayak tab DECK */
  {const bk=document.getElementById("raidPickBack");if(bk)bk.onclick=()=>{sfx.hit();raidView="hub";renderRaid();};}
  {const rs=document.getElementById("raidSearch");if(rs){rs.value=raidSearch;rs.oninput=()=>{raidSearch=rs.value;runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));};if(raidSearch)runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));}}
  app.querySelectorAll("[data-pick]").forEach(btn=>btn.onclick=()=>{
    sfx.hit();raidPicked=state.stacks.find(s=>s.id===btn.dataset.pick)||state.stacks[0];
    raidView="battle";renderRaid();
  });
}
function renderRaidBattle(){
  const b=raidBossOf(), eq=raidPicked||equipped();
  app.innerHTML=`
  <div class="battle-grid raid-stage">
    <div class="me-col"><div class="fighter me${eq&&eq.mut&&eq.mut!=='none'?' mut-'+eq.mut:''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}">${meFighterHtml(eq)}</div></div>
    <div class="vs-col"><div class="t">VS</div><div class="s" id="raidTurnLabel">TURN<br>0/${RAID_TURNS}</div></div>
    <div class="me-col foe-side"><div class="fighter foe" data-tier="EX">
      <div class="f-banner"><img src="${b.img}" alt="${b.name}"><div class="f-name">${b.name}</div>
        </div>
      <div class="hpbar"><i id="hpRaid"></i><span id="hpRaidT">${fmt(b.hp)} / ${fmt(b.hp)}</span></div>
      <div class="f-body">
        <div class="f-title">${rarityText(b.tier)} · RAID · ${b.diffLabel}</div>
        <div class="f-skill">${b.skill}</div>
        <div class="stat-row"><div class="stat">♡ ${fmt(b.hp)}</div><div class="stat">${ATKIC} ${fmt(999999)}</div></div>
      </div>
    </div></div>
  </div>`;
  startRaid();
}
function startRaid(){
  const b=raidBossOf(), eq=raidPicked||equipped(), base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  raid={boss:b,hp:b.hp,max:b.hp,dealt:0,turn:0,cap:RAID_TURNS,atk:base.atk,fx:resolveFx(eq,b.fx||{}),cid:eq.char,over:false,timer:null,domainUsed:false,domainLeft:0,diffKey:b.diffKey,rw:b.rw};
  playFight(()=>{ if(raid&&!raid.over)raid.timer=setTimeout(raidStep,500); });
}
function raidStep(){
  if(!raid||raid.over)return;
  raid.turn++;
  if(raid.turn>raid.cap){ if(raid.hp>0){ raidFinisher(()=>endRaid()); } else { endRaid(); } return; }
  const fx=raid.fx, dmg=Math.round(raid.atk*(fx.dmgMult||1)), id=raid.cid;
  const domainActive=fx.domain&&id==="CH_EX_GOJO"&&Math.random()*100<(fx.domain.chance||100);
  const hits=[1];
  let crit=false,purple=false,ranton=false,barrageN=0,iceBlastN=0;
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
  const ownSound=id==="CH_EX_GOJO"||id==="CH_EX_MADARA"||id==="CH_EX_JINWOO"||(id==="CH_ETERNAL_DRAGON"&&purple);
  if(!ownSound)swing();
  const setRaidBar=hp=>{const v=Math.max(0,hp);const p=Math.max(0,Math.min(100,v/raid.max*100));const b=document.getElementById("hpRaid");if(b)b.style.width=p+"%";const tt=document.getElementById("hpRaidT");if(tt)tt.textContent=fmt(v)+" / "+fmt(raid.max);};
  /* panjang rantai animasi hit ronde ini, dihitung SINKRON (di depan setTimeout) supaya cabang kematian
     bisa menunggu sambaran terakhir selesai — bukan memotong getar + angkanya lewat guard raid.over */
  const rHstep=domainActive?80:160;
  const rMd=ranton&&id==="CH_EX_MADARA";
  const rChainEnd=(rMd?MADARA_T.slash+Math.max(0,hits.length-1)*MADARA_T.step+40:180+Math.max(0,hits.length-1)*rHstep)+520;
  setTimeout(()=>{
    if(domainActive&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.me","DOMAIN EXPANSION","crit"),220);}
    if(ariseMode&&raid&&!raid.over){floatText(".fighter.foe","ARMY OF SHADOWS","crit");}
    const susStart=(ranton&&id==="CH_EX_MADARA"&&raid&&!raid.over)?MADARA_T.slash:0;
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
        setTimeout(()=>{if(raid&&!raid.over)anim(".fighter.foe","hit",ultBarrage);},dl+jwLag);
        if(!galaxyMode&&!md&&(domainActive||!purple))setTimeout(()=>playClip(punchAudio),dl);
        const dd=Math.round(dmg*m);rShown-=dd;rBarEnd=Math.max(rBarEnd,ft);const stepHp=Math.max(0,rShown);
        setTimeout(()=>floatText(".fighter.foe","-"+fmt(dd),(crit&&i===hits.length-1)?"crit":""),ft);
        setTimeout(()=>setRaidBar(stepHp),ft);
      });
      setTimeout(()=>setRaidBar(rEndHp),rBarEnd+520);
      if(barrageN>1)setTimeout(()=>floatText(".fighter.foe",(iceBlastN?"ICE BLAST ×":domainActive?"UNLIMITED VOID ×":ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+barrageN,"crit"),md?MADARA_T.slash:320);
      else if(hits.length>1&&!ranton)setTimeout(()=>floatText(".fighter.foe","DOUBLE!","crit"),260);
    }
  },180);
  raid.hp-=total;raid.dealt+=total;
  setRaidBar(raid.hp+total);
  const tl=document.getElementById("raidTurnLabel");if(tl)tl.innerHTML="TURN<br>"+raid.turn+"/"+raid.cap;
  if(raid.hp<=0){
    const special=(domainActive||ariseMode||ranton||galaxyMode);
    const killWait=Math.max(rChainEnd, special?(ranton?MADARA_T.total+160:galaxyMode?GALAXY.total:1700):0);
    if(killWait>260){ setTimeout(()=>{if(raid&&!raid.over)endRaid();},killWait); }
    else endRaid();
    return;
  }
  raid.timer=setTimeout(raidStep,ariseMode?2200:domainActive?1900:ranton?MADARA_T.total+260:galaxyMode?GALAXY.total+260:1100);
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
  const COIN_IC=`<svg viewBox="0 0 24 24" width="100%" height="100%" style="display:block"><circle cx="12" cy="12" r="10" fill="#E8B33A" stroke="#8a6414" stroke-width="1.5"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#B4831E" stroke-width="1.2"/><text x="12" y="16.6" text-anchor="middle" font-size="11" font-weight="900" fill="#6b4a08" font-family="Arial">$</text></svg>`;
  const ICO={coins:COIN_IC,card_edragon:`<img src="assets/raid/eternal-dragon-hd.png" onerror="this.parentNode.textContent='🐉'">`,
    "helm-abyss":`<img src="assets/artifacts/abyss-helm.png" onerror="this.parentNode.textContent='🪖'">`,
    "nebula-wisp":`<img src="assets/pets/nebula-wisp.png" onerror="this.parentNode.textContent='🌌'">`,
    luck1:`<img src="assets/images/pot-luck-1.png" onerror="this.parentNode.textContent='🍀'">`,
    luck2:`<img src="assets/images/pot-luck-2.png" onerror="this.parentNode.textContent='🍀'">`,
    luck3:`<img src="assets/images/pot-luck-3.png" onerror="this.parentNode.textContent='🍀'">`,
    speed1:`<img src="assets/images/pot-speed-1.png" onerror="this.parentNode.textContent='⚡'">`,
    speed2:`<img src="assets/images/pot-speed-2.png" onerror="this.parentNode.textContent='⚡'">`,
    speed3:`<img src="assets/images/pot-speed-3.png" onerror="this.parentNode.textContent='⚡'">`};
  const cardItems=RAID_SHOP.filter(x=>x.card);
  const bossTotal=cardItems.length,bossCount=cardItems.filter(x=>bossRollUnlocked(x.card.char)).length;
  const ITEMS=RAID_SHOP.map(it=>({k:it.id,label:it.name.toUpperCase(),sub:it.card?"Kartu BOSS · TIER BOSS · roll permanen setelah beli":it.desc,cost:it.cost,ac:it.card?"#FFFFFF":"#FFD27A",it}));
  if(window.raidShopSel==null||window.raidShopSel>=ITEMS.length)window.raidShopSel=0;
  let swapT=null;
  const renderList=()=>{
    document.getElementById("raidShopList").innerHTML=ITEMS.map((it,i)=>`
      <div class="srow${i===window.raidShopSel?" on":""}" data-i="${i}" style="--ac:${it.ac}">
        <span class="sic${it.it.card?" card":""}">${ICO[it.k]||"🎁"}</span>
        <span class="sinfo"><span class="sname">${it.label}</span></span>
        <span class="scost"><b>${it.cost}</b><span>TOKEN</span></span>
        ${((it.it.card&&stackHas(it.it.card.char,it.it.card.mut))||(it.it.owned&&it.it.owned()))?`<span class="sown">SUDAH DIBELI</span>`:""}
      </div>`).join("");
    document.querySelectorAll("#raidShopList .srow").forEach(r=>r.onclick=()=>{window.raidShopSel=+r.dataset.i;renderList();renderDetail();});
  };
  const renderBuy=()=>{
    const it=ITEMS[window.raidShopSel],btn=document.getElementById("raidShopBuy");
    btn.style.animation="none";void btn.offsetWidth;btn.style.animation="";
    const have=!!(it.it.card&&stackHas(it.it.card.char,it.it.card.mut))||(it.it.owned?it.it.owned():false);
    let small="Beli item ini",big=`BELI — ${it.cost} TOKEN`,dis=false;
    if(have){small=it.it.card?"Sudah dibeli · roll permanen terbuka":"Sudah dibeli · permanen di Backpack";big="SUDAH DIPUNYA";dis=true;}
    else if(tok<it.cost){small="Token tidak cukup";big=`KURANG ${it.cost-tok} TOKEN`;dis=true;}
    btn.disabled=dis;
    btn.innerHTML=`<span class="amed${it.it.card?" card":""}">${ICO[it.k]||"🎁"}</span><span class="atxt"><small>${small}</small><b>${big}</b></span>`;
  };
  const renderDetail=immediate=>{
    const it=ITEMS[window.raidShopSel],box=document.getElementById("raidShopDetail");
    clearTimeout(swapT);
    const paint=()=>{
      box.classList.remove("out");
      const isCard=!!it.it.card;
      const c=isCard?CARDS[it.it.card.char]:null;
      const unlocked=!isCard||bossRollUnlocked(it.it.card.char);
      const cnt=isCard?state.stacks.filter(s=>s.char===it.it.card.char).reduce((n,s)=>n+(s.count||1),0):0;
      box.innerHTML=`
      <div class="sd-head" style="--ac:${it.ac}">
        <span class="sbig${isCard?" boss-art":""}">${ICO[it.k]||"🎁"}</span>
        <span><span class="sd-kicker">${isCard?"KARTU BOSS · TIER "+(c?c.tier:"BOSS"):"TOKEN · LANGSUNG"}</span><div class="sd-name">${it.label}</div></span>
      </div>
      <p class="sd-desc">${it.it.desc}${c?`<br><b class="sd-skill">${c.passive.name}</b> — ${c.passive.desc}`:""}</p>
      <div class="sd-meta" style="--ac:${it.ac}">
        <div class="sd-mrow"><span class="k">HARGA</span><span class="v c">${it.cost} TOKEN RAID</span></div>
        ${isCard?`<div class="sd-mrow"><span class="k">ROLL</span><span class="v ${unlocked?"g":"no"}">${unlocked?"TERBUKA · PERMANEN":"TERKUNCI — BELUM DIBELI"}</span></div>
        <div class="sd-mrow"><span class="k">DIMILIKI</span><span class="v g">${cnt?"×"+cnt:"—"}</span></div>`
        :`<div class="sd-mrow"><span class="k">EFEK</span><span class="v g">${it.it.effect||"+2.000 COIN LANGSUNG"}</span></div>`}
        <div class="sd-mrow"><span class="k">SISA TOKEN</span><span class="v c">${tok} / ${it.cost}</span></div>
      </div>`;
      renderBuy();
    };
    if(immediate||!box.children.length){paint();return;}
    box.classList.add("out");
    swapT=setTimeout(paint,140);
  };
  app.innerHTML=`<div class="tw-page rd-page">
  <div class="tw-hub shop-hub">
    <section class="tw-stage shop-stage">
      <div class="tw-stage-top">
        <button class="backlink" id="raidShopBack">&#8592; KEMBALI KE RAID</button>
        <div class="tw-stage-eyebrow">TOKO RAID</div>
      </div>
      <div class="slist" id="raidShopList"></div>
      <div class="tw-stage-hint"><kbd>TOKEN</kbd> DIDAPAT DARI % DAMAGE BOSS</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="tw-title">TOKO RAID</div>
        <div class="tw-sub">BELANJA PAKAI TOKEN RAID &middot; KARTU BOSS BUKA ROLL PERMANEN</div>
      </div>
      <div class="tw-stats">
        <div class="tbs acc"><span>TOKEN RAID</span><b>${fmt(tok)}</b></div>
        <div class="tbs vio"><span>BOSS UNLOCKED</span><b>${bossCount}/${bossTotal}</b></div>
      </div>
      <div class="eyebrow">DETAIL ITEM</div>
      <div class="sdetail" id="raidShopDetail"></div>
      <button class="act go buyswap" id="raidShopBuy"></button>
      <p class="tw-note">Dapat token dari Boss Raid: klaim damage 30% &rarr; <b class="v">+5</b>, 50% &rarr; <b class="v">+10</b>, 100% &rarr; <b class="v">+20</b>. Kartu BOSS sekali beli &rarr; roll terbuka <b class="v">selamanya</b> di semua gacha (roll biasa, menara, INTAN ROLL) — sebelum dibeli roll-nya terkunci.</p>
    </section>
  </div></div>`;
  renderList();renderDetail(true);
  const rb=document.getElementById("raidShopBack");if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}raidView="hub";renderRaid();};
  const bi=document.getElementById("raidShopBuy");if(bi)bi.onclick=()=>{if(bi.disabled)return;raidShopBuy(ITEMS[window.raidShopSel].k);};
}

/* =============== INDEX CARD (popup) =============== */
const IX_MUTS=["none","gold","rainbow","secret"];
let ixState={q:"",mut:"all",shiny:false,owned:false,sort:"name"};
function openIndex(){
  /* Katalog SEMUA kartu — layout meniru referensi "INDEX!": search di header, toolbar
     chip mutasi + toggle SHINY + OWNED ONLY + sort, grid full-art (nama, centang owned
     x/8, pips mut×shiny, nama+deskripsi skill di atas art), footer strip progres varian
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
    <div class="ix-chips">${chip("all","SEMUA","all")}${IX_MUTS.map(m=>chip(m,MUT_LABEL[m]||"MURNI","m-"+m)).join("")}
      ${chip("s-gold",MUT_LABEL.gold+" + SHINY","m-gold shp")}${chip("s-rainbow",MUT_LABEL.rainbow+" + SHINY","m-rainbow shp")}${chip("s-secret",MUT_LABEL.secret+" + SHINY","m-secret shp")}
      <button class="ix-chip shiny${ixState.shiny?' on':''}" type="button" data-shiny="1">SHINY</button></div>
    <span class="ix-sp"></span>
    <button class="ix-tog${ixState.owned?' on':''}" type="button" data-owned="1">✓ OWNED</button>
    <select class="ix-sort" id="ixSort" title="Urutkan">
      <option value="name">Nama</option><option value="tier">Tier</option>
      <option value="own">Varian</option><option value="chance">Chance</option>
    </select></div>`;
  /* --- filter + sort --- */
  const TIER_RANK={R:0,SR:1,SSR:2,UR:3,EX:4,BOSS:5};
  let list=MASTER_CARD_INDEX.filter(c=>{
    if(ixState.q&&!c.name.toLowerCase().includes(ixState.q))return false;
    if(ixState.owned&&!(ownedN(c,false)+ownedN(c,true)))return false;
    /* chip mutasi -> wajib punya varian mutasi itu; chip s-* / toggle SHINY -> wajib varian shiny;
       tanpa chip mutasi + toggle SHINY -> punya varian shiny apa pun. */
    if(fmSel){
      if(!(ownCnt(c,fmSel,fShiny)||ownCnt(c,fmSel,!fShiny)))return false;
    } else if(fShiny&&!ownedN(c,true))return false;
    return true;});
  const T={name:(a,b)=>a.name.localeCompare(b.name),
    tier:(a,b)=>(TIER_RANK[a.tier]??9)-(TIER_RANK[b.tier]??9)||a.name.localeCompare(b.name),
    own:(a,b)=>(ownedN(b,false)+ownedN(b,true))-(ownedN(a,false)+ownedN(a,true))||a.name.localeCompare(b.name),
    chance:(a,b)=>(a.chance==null?1e9:a.chance)-(b.chance==null?1e9:b.chance)||a.name.localeCompare(b.name)};
  list.sort(T[ixState.sort]||T.name);
  /* --- kartu full-art --- */
  const cells=list.map(c=>{
    const any=ownedN(c,false)+ownedN(c,true);
    const anySh=ownedN(c,true)>0;
    /* border = mutasi tertinggi yang DIMILIKI (secret > rainbow > gold);
       belum punya mutasi: warna tier; belum owned sama sekali: abu redup.
       Punya varian shiny owned -> class shiny = holo shimmer. */
    const bestMut=ownCnt(c,"secret",false)||ownCnt(c,"secret",true)?"secret":
      ownCnt(c,"rainbow",false)||ownCnt(c,"rainbow",true)?"rainbow":
      (ownCnt(c,"gold",false)||ownCnt(c,"gold",true))?"gold":null;
    /* chip MUTASI sedang aktif -> border & nama ikut mutasi TERPILIH biar filter
       ke-baca visual (semua kartu tampil dgn gaya chip itu);
       MURNI -> tampilan polos (warna tier); ALL -> mutasi tertinggi milik sendiri. */
    const fm=ixState.mut==="all"?bestMut:fmSel;
    const bc=fm?MUT_COLOR[fm]:(any?(TIER_COLOR[c.tier]||"#9AA6B2"):"#3A3F47");
    const lockBoss=!!(c.raidBoss&&!bossRollUnlocked(c.char_id));
    /* holo shimmer HANYA di tab SEMUA atau lagi di konteks shiny (chip s-* / toggle SHINY);
       tab MURNI/GOLD/RAINBOW/SECRET biasa tampil tanpa shimmer biar kebaca beda. */
    const shFx=anySh&&(ixState.mut==="all"||fShiny);
    const cls=`ix-cell${any?'':' no-own'}${lockBoss?' boss-locked':''}${shFx?' shiny':''}${fm?' m-'+fm:''}`;
    /* gaya kartu lobby: NAMA kiri-atas + chance pill di bawahnya + badge ✓ kanan-atas;
       pips & teks passive dibuang — klik kartu tetap buka skillPop buat detail.
       mut=fm -> nama ikut warna mutasi (rainbow = huruf warna-warni). */
    const nameHtml=shinyName('span','ixc-name','ixc-shine',fm,anySh,c.name);
    return `<button class="${cls}" type="button" data-c="${c.char_id}"${lockBoss?' title="BELUM DIBELI — beli di TOKO RAID untuk buka roll"':''} style="--tc:${TIER_COLOR[c.tier]||'#9AA6B2'};--bc:${bc}">
      <img src="${c.sprite_asset}" alt="${c.name}">
      <span class="ixc-stack">${nameHtml}<span class="ixc-chance"${fmSel&&fmSel!=="none"?` style="color:${MUT_COLOR[fmSel]}"`:""}>1 IN ${fmtChance(effChance(c.char_id,fmSel||"none",fShiny))}</span></span>
      <span class="ixc-own${any?' on':''}">✓ ${any}/8</span>
    </button>`;}).join("");
  /* --- footer: strip progres SEGMENT per mutasi + milestone INTAN ROLL --- */
  const t=MASTER_CARD_INDEX.length;
  const segs=IX_MUTS.map(m=>{let n=0;for(const c of MASTER_CARD_INDEX)if(ownCnt(c,m,false))n++;
    return `<i title="${MUT_LABEL[m]||'MURNI'} ${n}/${t}" style="--p:${t?Math.round(n/t*100):0}%;--c:${m==='none'?'#9AA6B2':MUT_COLOR[m]}"></i>`;}).join("");
  const pct=P.total?Math.min(100,Math.round(P.count/P.total*100)):0;
  const complete=P.total>0&&P.count>=P.total;
  const next=Math.max(0,IDX_MILESTONE-(P.count%IDX_MILESTONE));
  const strip=`<div class="ix-prog">
    <div class="ixp-col"><div class="ixp-lbl">VARIAN TERKUMPUL</div><div class="ixp-val">${fmt(P.count)}<em> / ${fmt(P.total)}</em></div></div>
    <div class="ixp-track ix-seg" title="${pct}%">${segs}</div>
    <div class="ixp-rw">
      <div class="ixp-rw-t"><span class="ixp-gem">◆</span> INTAN ROLL 100K</div>
      <div class="ixp-rw-s">${complete?"SEMUA VARIAN LENGKAP":"+"+IDX_MILESTONE+" varian = +1 item"}</div>
      <div class="ixp-own">DIMILIKI <b>${fmt(state.intanRolls||0)}</b>${complete?"":` · ${next} varian lagi`}</div>
    </div></div>`;
  document.getElementById("ixToolbar").innerHTML=toolbar;
  document.getElementById("ixBody").innerHTML=(list.length?"":`<div class="ix-empty">Tidak ada kartu yang cocok</div>`)+`<div class="ix-grid">${cells}</div>`;
  document.getElementById("ixFoot").innerHTML=strip;
  const sel=document.getElementById("ixSort");sel.value=ixState.sort;
  sel.onchange=()=>{ixState.sort=sel.value;ixRender();};
  document.querySelectorAll("#ixToolbar .ix-chip[data-mut]").forEach(b=>b.onclick=()=>{ixState.mut=b.dataset.mut;ixRender();});
  const shb=document.querySelector("#ixToolbar [data-shiny]");if(shb)shb.onclick=()=>{ixState.shiny=!ixState.shiny;ixRender();};
  const owb=document.querySelector("#ixToolbar [data-owned]");if(owb)owb.onclick=()=>{ixState.owned=!ixState.owned;ixRender();};
  document.querySelectorAll("#ixBody .ix-cell").forEach(cell=>{
    cell.onclick=()=>{const c=CARDS[cell.dataset.c];if(!c)return;document.getElementById("spName").textContent=c.passive.name;document.getElementById("spDesc").textContent=c.passive.desc;document.getElementById("skillPop").classList.add("show");};
  });
}



/* =============== TRAIT ROLL (popup) =============== */
let traitTarget=null;
let pendingRare=null;
function traitTargetStack(){let s=state.stacks.find(x=>x.id===traitTarget);if(!s){s=equipped();traitTarget=s?s.id:null;}return s;}
function openTrait(){traitTarget=null;pendingRare=null;renderTrait();document.getElementById("traitModal").classList.add("show");}
function closeTrait(){document.getElementById("traitModal").classList.remove("show");hideTraitTip();}
function renderTrait(){
  const b=document.getElementById("trBody");
  if(!state.stacks.length){b.innerHTML=`<p class="sub">Belum ada kartu. Punya kartu dulu lewat Summon.</p>`;return;}
  const tgt=traitTargetStack();
  const hasT=!!(tgt.trait&&tgt.trait!=="none");
  const tt=hasT?TRAIT[tgt.trait]:null;
  const cur=tt?traitChip(tt.k,`<span class="tc-trait" style="color:${tt.color}">${traitGem(16,tt.k)} ${traitLabel(tt.k)}</span>`):`<span class="tc-trait" style="color:var(--muted)">Belum ada trait</span>`;
  const curStat=tt?`ATK +${Math.round((tt.atk-1)*100)}% · HP +${Math.round((tt.hp-1)*100)}%`:"Roll untuk coba peruntungan bonus ATK &amp; HP.";
  const rates=TRAIT_TIERS.filter(t=>t.chance>0).map(t=>{
    const own=tgt.trait===t.k;
    const aPct=Math.round((t.atk-1)*100),hPct=Math.round((t.hp-1)*100);
    const bar=Math.max(2,Math.round((t.chance/55)*1000)/10);
    return `<div class="trr-item${own?" own":""}"${own?` style="box-shadow:inset 0 0 0 1px ${t.color};background:color-mix(in srgb,${t.color} 10%,transparent)"`:""} title="${t.name} · RARITY ${t.rar} · ATK +${aPct}% · HP +${hPct}%">
      <div class="trr-row"><span class="trr-gem" style="color:${t.color}">${traitGem(15,t.k)}</span><span class="trr-name">${t.name}</span>${own?`<em class="trr-flag" style="background:${t.color}">AKTIF</em>`:""}<em class="trr-rar" style="color:${t.color};border-color:${t.color}">${t.rar}</em><em class="trr-pct" style="color:${t.color}">${t.chance}%</em></div>
      <div class="trr-bar"><i style="width:${bar}%;background:${t.color}"></i></div>
    </div>`;}).join("");
  b.innerHTML=`
    <div class="tr-grid">
      <div class="tr-main">
        <div class="tr-cur tr-cur-btn" id="trPickCard" role="button" title="Ganti kartu target dari deck"><img src="${cardImg(tgt.char)}" alt="">
          <div><div class="tc-lbl">KARTU TARGET · TRAIT SEKARANG</div><div class="tc-name">${cardName(tgt.char)}</div><div class="tc-tline">${cur}</div><div class="tc-tstat"${tt?` style="color:${tt.color}"`:""}>${curStat}</div></div>
          <span class="tr-change">GANTI ▸</span></div>
        <div class="tr-btns"><button class="tr-btn tr-roll" id="trRoll" ${state.coins<TRAIT_COST?"disabled":""}>ROLL TRAIT · ${fmt(TRAIT_COST)} COIN</button></div>
        <div class="tr-note">COIN: <b class="tr-coin">${fmt(state.coins)}</b> · Roll memasang trait ke target. Trait langka minta konfirmasi Simpan / Roll.</div>
      </div>
      <div class="tr-rates"><div class="trr-h">DROP RATE</div>${rates}</div>
    </div>`;
  const r=document.getElementById("trRoll");if(r)r.onclick=rollTrait;
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
    return `<button class="dp-card${s.id===selId?" sel":""}" data-tid="${s.id}" data-name="${cardName(s.char).toLowerCase()}"${s.mut&&s.mut!=="none"?` style="border-color:${MUT_COLOR[s.mut]}"`:""}>
      <img src="${cardImg(s.char)}" alt="">
      ${(s.mut&&s.mut!=="none")||(s.trait&&s.trait!=="none")?`<span class="dp-badges">${s.mut&&s.mut!=="none"?mutChip(s.mut,`<span class="mut-badge dp-mut" style="border-color:${MUT_COLOR[s.mut]}">${mutBadge(s.mut)}</span>`):""}${s.trait&&s.trait!=="none"?traitChip(s.trait,`<span class="trait-badge dp-gem" style="border-color:${TRAIT_COLOR[s.trait]}">${traitGem(13,s.trait)}</span>`):""}</span>`:""}
      <span class="dp-name">${cardName(s.char)}</span>
    </button>`;}).join("")}</div><div class="no-result" id="dpSearch-nr">Tidak ada kartu yang cocok.</div>`;
  {const dps=document.getElementById("dpSearch");if(dps){dps.value=dpSearch;dps.oninput=()=>{dpSearch=dps.value;runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));};if(dpSearch)runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));}}
  b.querySelectorAll(".dp-card").forEach(el=>el.onclick=()=>{const tid=el.getAttribute("data-tid");sfx.hit();if(cardPickCfg){cardPickCfg.onPick(tid);}else{traitTarget=tid;closeDeckPick();renderTrait();}});
}
function rollTrait(){
  if(state.coins<TRAIT_COST)return;
  const tgt=traitTargetStack();if(!tgt)return;
  state.coins-=TRAIT_COST;
  const k=rollTraitPick();
  sfx.crit();
  if(TRAIT[k].atk>=1.5){ save(); renderShell(); renderTrait(); showRarePrompt(k); }
  else { tgt.trait=k; save(); renderShell(); renderTrait(); traitNotify(k); }
}
function showRarePrompt(k){
  const t=TRAIT[k];if(!t)return;
  pendingRare=k;
  const b=document.getElementById("rpBody");
  const canRoll=state.coins>=TRAIT_COST;
  b.innerHTML=`
    <div class="rp-rays"></div>
    ${traitGem(78,k,"rp-gem")}
    <div class="rp-kicker">TRAIT LANGKA</div>
    <div class="rp-name" style="color:${t.color}">${t.name}</div>
    <div class="rp-rar" style="color:${t.color}">RARITY ${t.rar}</div>
    <div class="rp-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</div>
    <div class="rp-fx">${traitFxList(k)}</div>
    <div class="rp-btns">
      <button class="rp-btn rp-save" id="rpSave">SIMPAN</button>
      <button class="rp-btn rp-roll" id="rpRoll" ${canRoll?"":"disabled"}>ROLL LAGI · ${fmt(TRAIT_COST)} COIN</button>
    </div>
    <div class="rp-note">SIMPAN memasang trait ini ke kartu target. ROLL LAGI membuang hasil ini dan mencoba lagi (bayar coin lagi).</div>`;
  const box=document.getElementById("rpBox");box.style.color=t.color;box.style.borderColor=t.color;
  document.getElementById("rarePromptModal").classList.add("show");
  document.getElementById("rpSave").onclick=saveRare;
  const rr=document.getElementById("rpRoll");if(rr)rr.onclick=rerollRare;
}
function closeRarePrompt(){document.getElementById("rarePromptModal").classList.remove("show");}
function saveRare(){const k=pendingRare;const tgt=traitTargetStack();if(tgt&&k)tgt.trait=k;pendingRare=null;closeRarePrompt();save();renderShell();renderTrait();if(k)traitNotify(k);}
function rerollRare(){pendingRare=null;closeRarePrompt();rollTrait();}
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

