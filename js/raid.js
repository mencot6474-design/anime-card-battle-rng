/* =============== BOSS RAID (layar + engine) =============== */
let raid=null, raidView="hub", raidPicked=null;
/* ===== WORLD BOSS (harian, skor & attempt di server) =====
   Attempt dipotong server saat run DIMULAI, bukan saat submit — keluar di tengah
   run tetap memakai 1 attempt. Guest/offline tetap bisa main lokal: tidak memakai
   attempt dan tidak mengirim skor. */
let wb=null, wbAt=0, wbLoading=false, wbRunId=null, wbStarting=false, wbErr=false;
/* Data World Boss per boss (pool/attempt/papan terpisah). `wb` selalu menunjuk
   data boss yang SEDANG dipilih supaya kode lama (wb.xxx) tetap valid. */
const wbByBoss={a:null,b:null};
let wbRunBoss=null;   /* key boss untuk run yang sedang jalan */
const WB_TTL=60000; /* data hub (pool/rank) cukup di-refresh 1x / menit — hemat bandwidth */
const WB_RETRY=8000; /* belum dapat data sama sekali -> jangan fetch tiap render */
function wbOnline(){return !!(currentUser&&window.CloudDB&&typeof window.CloudDB.wbState==="function");}
function wbBossName(id){const b=RAID_BOSSES.find(x=>x.id===id)||RAID_BOSSES[0];return b?b.name:"WORLD BOSS";}
function wbModText(){
  const d=wbData();
  const m=d&&d.modifier;
  if(!m||!m.label)return "";
  const p=[];
  if(m.hp_pct)p.push("HP "+(m.hp_pct>0?"+":"")+m.hp_pct+"%");
  if(m.atk_pct)p.push("ATK "+(m.atk_pct>0?"+":"")+m.atk_pct+"%");
  return m.label+(p.length?" · "+p.join(" · "):"");
}
/* ===== 2 WORLD BOSS — pool, papan, dan attempt TERPISAH =====
   Boss A (Eternal Dragon) -> board "world_boss", Boss B (Shadow King) -> "world_boss_b".
   Server (migration 0009) menyimpan state per boss; client ambil keduanya paralel. */
const WB_BOSSES=[
  {key:"a",id:"RAID_ETERNAL_DRAGON",board:"world_boss",name:"ETERNAL DRAGON",tag:"EX · WORLD BOSS",
   skill:"Galaxy Roar",mod:"GRAVITY SURGE",art:"assets/raid/eternal-dragon-hd.png",alt:false,
   holo:"#35F0FF",mag:"#FF3DAE",locked:false},
  {key:"b",id:"RAID_SHADOW_KING",board:"world_boss_b",name:"SHADOW KING",tag:"EX · WORLD BOSS",
   skill:"Umbra Eclipse",mod:"SHADOW TIDE",art:"assets/cards/art/shadow-king.webp",alt:true,
   holo:"#B98CFF",mag:"#FF3DAE",locked:false}
];
let wbBossIdx=0;
function wbBoss(){return WB_BOSSES[wbBossIdx]||WB_BOSSES[0];}
/* Sinkronkan `wb` ke boss yang sedang dipilih. */
function wbSyncCur(){const k=wbBoss().key;wb=wbByBoss[k]||null;}
/* Data boss ke-i (default: boss aktif). Null = belum ada state dari server. */
function wbData(i){const b=WB_BOSSES[i==null?wbBossIdx:i]||WB_BOSSES[0];return wbByBoss[b.key]||null;}
function wbAttOf(i){
  const b=WB_BOSSES[i==null?wbBossIdx:i];
  if(!b)return null;
  const d=wbByBoss[b.key];
  if(d&&typeof d.attempts_left==="number")return d.attempts_left;
  if(d&&typeof d.attempts_used==="number")return Math.max(0,3-d.attempts_used);
  return b.locked?null:3;
}
function wbAttLabel(){
  return WB_BOSSES.map((b,i)=>{const n=wbAttOf(i);return b.key.toUpperCase()+" "+(n==null?"—":n+"/3");}).join(" · ");
}
function wbReduceMotion(){return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches);}
/* Pool World Boss SELALU 10B — modifier harian tidak menggeser HP boss lagi,
   karena damage run dihitung ABSOLUT terhadap pool (bukan persen). */
function wbBossOf(diff){
  return raidBossOf(diff);
}
/* Ambil state SEMUA boss paralel (pool/papan/attempt terpisah di server).
   silent=true -> jangan re-render hub (dipakai polling 8s supaya tidak flicker). */
function wbRefresh(force,silent){
  if(!wbOnline())return Promise.resolve(null);
  if(wbLoading||(!force&&Date.now()-wbAt<(wbData()?WB_TTL:WB_RETRY)))return Promise.resolve(wb);
  wbLoading=true;
  const jobs=WB_BOSSES.map(b=>window.CloudDB.wbState(currentUser,b.id)
    .then(res=>({b,res})).catch(()=>({b,res:null})));
  return Promise.all(jobs).then(list=>{
    wbLoading=false;
    let okAny=false, dead=false;
    list.forEach(({b,res})=>{
      if(res&&res.ok!==false){wbByBoss[b.key]=res;okAny=true;}
      else if(!res||res.msg==="PLAYER_NOT_FOUND")dead=true;
    });
    wbErr=!okAny&&dead;
    wbAt=Date.now();
    wbSyncCur();
    /* Re-render HANYA kalau ada data baru. Kalau semua RPC balik null (offline / RPC
       belum deploy / player belum punya state), wbData() tetap null -> guard TTL di atas
       tidak pernah kena, renderRaidHub() manggil wbRefresh() lagi, dan loop render+fetch
       berjalan terus tiap round-trip (~100ms): layar flicker & semua klik ketelan. */
    if(okAny&&!silent&&route()==="#/raid"&&raidView==="hub")renderRaidHub();
    return wb;
  }).catch(()=>{wbLoading=false;wbErr=true;return wb;});
}
function fmtBig(n){
  n=Number(n)||0;
  const u=[[1e12,"T"],[1e9,"B"],[1e6,"M"]];
  for(const [d,s] of u)if(n>=d){const v=Math.round(n/d*100)/100;return v.toLocaleString("en-US")+s;}
  return fmt(n);
}
function wbPoolVals(i){
  const d=wbData(i);
  const pool=Number(d&&d.hp_pool)||1e10;
  if(!d)return {pool,left:pool};      // belum ada state dari server -> pool utuh
  const raw=typeof d.hp_left==="number"?d.hp_left:pool;
  return {pool,left:Math.max(0,Math.min(pool,raw))};
}
/* Reset harian mengikuti lb_day() server: tengah malam Asia/Jakarta (UTC+7). */
function wbResetText(){
  const now=Date.now(), jkt=new Date(now+7*3600e3);
  const next=Date.UTC(jkt.getUTCFullYear(),jkt.getUTCMonth(),jkt.getUTCDate()+1)-7*3600e3;
  const ms=Math.max(0,next-now), h=Math.floor(ms/3600e3), m=Math.floor(ms%3600e3/60e3);
  return h>0?h+"J "+m+"M":m+"M";
}
function wbPoolHtml(){
  const b=wbBoss(), d=wbData();
  const {pool,left}=wbPoolVals();
  const pct=pool>0?left/pool*100:0;
  const off=!wbOnline();
  const sync=!off&&!d;
  const meta=b.locked?"POOL UTUH · BUKA SETELAH UPDATE":
    off?"LOGIN UNTUK IKUT HITUNGAN POOL":sync?
    (wbErr?"SERVER BELUM SIAP — MAIN LOKAL TETAP BISA":"MENGHUBUNGI SERVER…"):
    `${d.total_players||0} HUNTER · DAMAGE HARI INI ${fmtBig(pool-left)}`;
  return `<div class="wbr-pool${off||sync||b.locked?" dim":""}">
    <div class="wbr-pool-head">
      <span class="wbr-pool-k"><i class="cp-pulse-dot"></i>WORLD HP POOL</span>
      <span class="wbr-pool-reset" id="wbrReset">${b.locked?"BOS B":off?"OFFLINE":"RESET "+wbResetText()+" · 00:00 WIB"}</span>
    </div>
    <div class="wbr-pool-main">
      <b class="wbr-pool-left" id="wbrLeft">${fmtBig(left)}</b>
      <span class="wbr-pool-of">/ ${fmtBig(pool)}</span>
      <span class="wbr-pool-pct" id="wbrPct">${pct.toFixed(1)}%</span>
    </div>
    <div class="wbr-pool-bar"><i id="wbrFill" style="width:${Math.max(0,Math.min(100,pct)).toFixed(2)}%"></i><span class="wbr-ticks"></span></div>
    <div class="wbr-pool-foot"><span id="wbrPoolMeta">${meta}</span></div>
  </div>`;
}
/* Patch ringan 8 detik — cuma angka pool + board, tidak render ulang seluruh hub.
   Hanya menyentuh boss yang SEDANG tampil (bossIdx). */
function wbrPatch(){
  const b=wbBoss(), d=wbData();
  const {pool,left}=wbPoolVals();
  const pct=pool>0?left/pool*100:0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const f=document.getElementById("wbrFill");
  if(f)f.style.width=Math.max(0,Math.min(100,pct)).toFixed(2)+"%";
  const tf=document.getElementById("wbrThreatFill");
  if(tf)tf.style.width=Math.max(0,Math.min(100,pct)).toFixed(2)+"%";
  set("wbrLeft",fmtBig(left));
  set("wbrPct",pct.toFixed(1)+"%");
  set("wbrThreatPct",pct.toFixed(1)+"%");
  set("wbrAttLabel",wbAttLabel());
  const pips=document.getElementById("wbrPips");
  if(pips){
    const l=wbAttOf(wbBossIdx)||0;
    pips.innerHTML=[0,1,2].map(i=>`<i class="wbr-pip${i<l?" on":""}"></i>`).join("");
  }
  if(!d)return;                       // belum ada state boss ini -> sisanya biarkan statis
  set("wbrPoolMeta",`${d.total_players||0} HUNTER · DAMAGE HARI INI ${fmtBig(pool-left)}`);
  set("wbrFootDrain","TERKIKIS "+fmtBig(pool-left));
  set("wbrFootHunters",(d.total_players||0)+" HUNTER");
  const best=d.best_dmg;
  set("wbrBest",best?fmtBig(best):"—");
  set("wbrRank",d.rank?"#"+d.rank+(d.total_players?"/"+d.total_players:""):"—");
  const tp=document.getElementById("wbrTop");
  if(tp)tp.innerHTML=wbrTopRows();
}
let wbrPoll=null;
function wbrStopPoll(){if(wbrPoll){clearInterval(wbrPoll);wbrPoll=null;}}
function wbrStartPoll(){
  wbrStopPoll();
  if(!wbOnline())return;
  wbrPoll=setInterval(()=>{
    if(raidView!=="hub"||route()!=="#/raid"){wbrStopPoll();return;}
    /* Skip saat tab hidden — user gak ngeliat leaderboard, gak perlu makan bandwidth.
       Leaderboard World Boss harian cukup 1x / menit. */
    if(document.hidden)return;
    wbRefresh(true,true).then(()=>wbrPatch()).catch(()=>{});
  },60000);
}
function wbrTopRows(){
  const b=wbBoss(), d=wbData();
  if(!wbOnline())return `<span class="wbr-lb-empty">LOGIN UNTUK PAPAN GLOBAL</span>`;
  if(!d)return `<span class="wbr-lb-empty">SYNC…</span>`;
  const rows=Array.isArray(d.top)?d.top.slice(0,8):[];
  if(!rows.length)return `<span class="wbr-lb-empty">BELUM ADA SKOR HARI INI — JADI YANG PERTAMA</span>`;
  const me=currentUser?String(currentUser).toLowerCase():"";
  const max=Math.max.apply(null,rows.map(r=>Number(r.value)||0))||1;
  return rows.map(r=>{
    const w=Math.max(6,Math.min(100,(Number(r.value)||0)/max*100));
    return `<div class="wbr-lb-row${r.rank<=3?" r"+r.rank:""}${me&&r.username===me?" me":""}" style="--w:${w.toFixed(1)}%">
    <span class="wbr-lb-rank">#${r.rank}</span>
    <span class="wbr-lb-name">${r.username}</span>
    <b class="wbr-lb-val">${fmtBig(r.value)}</b>
  </div>`;
  }).join("");
}
function fmtPct(v){const n=Math.round((Number(v)||0)*10)/10;return (Number.isInteger(n)?n:n.toFixed(1))+"%";}
async function wbClaim(){
  if(wbLoading||!wbOnline())return;
  const b=wbBoss(), d=wbData();
  wbLoading=true;
  let res=null;
  try{
    /* Klaim baca save_data di server lalu mengembalikan saldo hasil penjumlahan.
       Flush dulu save yang masih antre debounce, kalau tidak spend terakhir hilang
       saat client menimpa state dengan angka dari server yang basi. */
    if(typeof pushCloudNow==="function")await pushCloudNow();
    res=await window.CloudDB.wbClaim(currentUser,b.id);
  }catch(e){
    res={ok:false,msg:"NETWORK"};
  }finally{
    wbLoading=false;
  }
  if(!res||res.ok===false){
    if(res&&res.msg==="ALREADY_CLAIMED"&&d&&d.yesterday){d.yesterday.claimed=true;wbAt=Date.now();}
    raidToast(res&&res.msg==="ALREADY_CLAIMED"?"Reward kemarin sudah diklaim":"Gagal klaim reward — coba lagi");
    if(raidView==="hub")renderRaidHub();
    return;
  }
  if(typeof res.premiumGems==="number")state.premiumGems=res.premiumGems;
  if(typeof res.wbTokens==="number")state.wbTokens=res.wbTokens;
  if(typeof res.packs==="number"&&res.packs>0){
    state.rollPacks=state.rollPacks||{r5k:0,r10k:0,r25k:0,r50k:0,r100k:0};
    state.rollPacks.r100k=(state.rollPacks.r100k||0)+res.packs;
  }
  if(res.title){
    state.titles=Array.isArray(state.titles)?state.titles:[];
    if(!state.titles.includes(res.title))state.titles.push(res.title);
  }
  if(d&&d.yesterday){d.yesterday.claimed=true;wbAt=Date.now();}
  try{save();}catch(e){}
  try{renderShell();}catch(e){}
  sfx.crit();
  showWbRewardModal(res);
  wbRefresh(true,true).then(()=>{if(raidView==="hub")renderRaidHub();});
}
/* Modal klaim reward World Boss — rank + gelar + rincian hadiah (gem / token WB / instan pack). */
function showWbRewardModal(res){
  if(!res||res.ok===false)return;
  const old=document.getElementById("wbRewardModal");if(old)old.remove();
  const pack=res.packs||0;
  const rank=res.rank?`#${res.rank}`:"&mdash;";
  const sub=res.total_players?`<span class="wrm-rank-sub">/ ${fmt(res.total_players)} hunter</span>`:"";
  const title=res.title?`<div class="wrm-title">&#9733; ${res.title}</div>`:"";
  const el=document.createElement("div");
  el.id="wbRewardModal";el.className="wrm-overlay";
  el.innerHTML=`
    <div class="wrm-card">
      <div class="wrm-sweep"></div>
      <div class="wrm-kicker">WORLD BOSS &middot; REWARD DIKLAIM</div>
      <div class="wrm-rank">${rank}${sub}</div>
      ${title}
      <div class="wrm-rewards">
        <div class="wrm-rw" style="--d:.06s">
          <div class="wrm-rw-ic"><img src="assets/images/premium-currency.webp" alt="GEM"></div>
          <div class="wrm-rw-amt">+${fmt(res.gems||0)}</div>
          <div class="wrm-rw-lbl">GEM</div>
        </div>
        <div class="wrm-rw" style="--d:.16s">
          <div class="wrm-rw-ic wrm-tok"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h6M9 14h6"/></svg></div>
          <div class="wrm-rw-amt">+${fmt(res.tokens||0)}</div>
          <div class="wrm-rw-lbl">TOKEN WB</div>
        </div>
        ${pack>0?`<div class="wrm-rw" style="--d:.26s">
          <div class="wrm-rw-ic"><img src="assets/images/instanpack-100k.webp?v=trans1" alt="PACK"></div>
          <div class="wrm-rw-amt">&times;${fmt(pack)}</div>
          <div class="wrm-rw-lbl">INSTAN PACK 100K</div>
        </div>`:""}
      </div>
      <button class="wrm-close" type="button">TUTUP</button>
    </div>`;
  document.body.appendChild(el);
  const close=()=>{el.classList.remove("in");el.classList.add("out");clearTimeout(el._t);el._t=setTimeout(()=>el.remove(),280);};
  el.querySelector(".wrm-close").onclick=close;
  el.addEventListener("click",e=>{if(e.target===el)close();});
  requestAnimationFrame(()=>el.classList.add("in"));
}
function stopRaid(){
  if(raid){ if(raid.timer)clearTimeout(raid.timer); raid=null; }
  if(typeof fightTimer!=="undefined"&&fightTimer){ clearTimeout(fightTimer); fightTimer=null; }
  wbRunId=null; wbRunBoss=null; wbStarting=false;
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
  if(raidView!=="hub")wbrStopPoll();
  if(raidView==="pick")return renderRaidPick();
  if(raidView==="battle")return renderRaidBattle();
  if(raidView==="result")return renderRaidResult();
  if(raidView==="shop")return renderRaidShop();
  renderRaidHub();
}
function renderRaidHub(){
  wbrStopPoll();
  wbSyncCur();
  const b=wbBoss();
  const locked=!!b.locked;
  const d=wbData();
  const {pool,left:poolLeft}=wbPoolVals();
  const pct=pool>0?poolLeft/pool*100:0;
  const attLeft=wbAttOf(wbBossIdx);
  const wbBest=(!locked&&d&&d.best_dmg)||0;
  const rank=!locked&&d&&d.rank, totalPlayers=(!locked&&d&&d.total_players)||0;
  const hunters=(!locked&&d&&d.total_players)||0;
  const y=!locked&&d&&d.yesterday;
  const dead=!locked&&(poolLeft<=0||attLeft<=0);
  const threatTag=pct<15?"KRITIS":pct<40?"WASPADA":"STABIL";
  let claimBtn="";
  if(y&&y.claimed)claimBtn=`<span class="wbr-claimed">KLAIM KEMARIN &#10004;</span>`;
  else if(y&&y.claimable)claimBtn=`<button class="wbr-claim" id="wbClaim" type="button">KLAIM ${y.gems||0} GEM · ${fmt(y.tokens||0)} TOKEN${y.packs?" · "+y.packs+"× PACK 100K":""}${y.title?" · "+y.title:""}</button>`;
  const dayKey=(!locked&&d&&d.day)?String(d.day):"";
  const modTxt=locked?b.mod:(wbModText()||b.mod);
  const deployK=locked?"TERKUNCI":dead?"POOL TUMBANG / ATTEMPT HABIS":"INITIALIZE STRIKE";
  const deployT=locked?"BUKA SETELAH UPDATE":dead?"TIDAK BISA DEPLOY":"DEPLOY &#9654;";

  app.innerHTML=`
  <div class="tw-page rd-page">
    <div class="wbr-hub${dead?" wbr-hub-dead":""}${locked?" wbr-hub-locked":""}" id="wbrHub">
      <section class="wbr-stage" id="wbrStage">
        <div class="wbr-deep">
          <div class="wbr-l wbr-bloom" style="--z:-420px;--m:2"></div>
          <div class="wbr-l wbr-floor" style="--z:-340px;--m:3"></div>
          <div class="wbr-l wbr-ghost" style="--z:-180px;--m:9"><img id="wbrGhost" src="${b.art}" alt=""></div>
          <div class="wbr-l wbr-halo" style="--z:-120px;--m:7"></div>
          <div class="wbr-l wbr-ped" style="--z:-60px;--m:9"></div>
          <div class="wbr-l wbr-beam" style="--z:-30px;--m:9"></div>
          <div class="wbr-artwrap" id="wbrArtWrap" style="--z:0px;--m:14">
            <img class="wbr-art${b.alt?" alt":""}" id="wbrArt" src="${b.art}" alt="${b.name}">
            <div class="wbr-holo" aria-hidden="true"><span class="wh-tint"></span><span class="wh-scan"></span></div>
          </div>
          <div class="wbr-l wbr-veil" style="--z:20px;--m:1"></div>
        </div>
        <div class="wbr-l wbr-rush" style="--z:30px;--m:2"></div>
        <div class="wbr-l wbr-fx" style="--z:40px;--m:1"><div class="wbr-slash"></div><div class="wbr-ring"></div><div class="wbr-flash"></div></div>

        <div class="wbr-topline">
          <span class="wbr-chip live"><i class="cp-pulse-dot"></i>WORLD EVENT</span>
          <span class="wbr-chip${locked?" dim":""}">${locked?"SEGERA":modTxt}</span>
          <div class="wbr-dots" id="wbrDots"></div>
          <button class="wbr-back" id="raidLobby" type="button" title="Kembali ke lobby">&#8592;</button>
        </div>

        <button class="wbr-switch l" id="wbrPrev" type="button" title="Boss sebelumnya">&#8249;</button>
        <button class="wbr-switch r" id="wbrNext" type="button" title="Boss berikutnya">&#8250;</button>
        ${locked?`<div class="wbr-lock"><b>${b.name}</b><small>BUKA SETELAH UPDATE</small></div>`:""}

        <div class="wbr-plate">
          <div class="wbr-plate-main">
            <span class="wbr-eyebrow">WORLD BOSS${dayKey?" · "+dayKey:""}</span>
            <h1 class="wbr-name">${b.name} <small>${b.tag}</small></h1>
            <div class="wbr-tags">
              <span class="wbr-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>${b.skill}</span>
              <span class="wbr-tag hot">${modTxt}</span>
              <span class="wbr-tag gold">RESET ${wbResetText()}</span>
            </div>
          </div>
          ${wbPoolHtml()}
        </div>
      </section>

      <aside class="wbr-rail">
        <div class="wbr-panel wbr-threat">
          <div class="wbr-ptitle"><i class="cp-pulse-dot"></i><span>THREAT LEVEL</span><span class="grow"></span><span class="wbr-mini">${locked?"STANDBY":threatTag}</span></div>
          <div class="wbr-threat-num"><b id="wbrThreatPct">${pct.toFixed(1)}%</b><span>HP TERSISA</span></div>
          <div class="wbr-threat-bar"><i id="wbrThreatFill" style="width:${Math.max(0,Math.min(100,pct)).toFixed(2)}%"></i></div>
          <div class="wbr-threat-foot"><span id="wbrFootDrain">${locked?"TERKIKIS 0":"TERKIKIS "+fmtBig(pool-poolLeft)}</span><span id="wbrFootHunters">${hunters} HUNTER</span></div>
        </div>

        <div class="wbr-panel wbr-run">
          <div class="wbr-ptitle"><span>RUN STATUS</span><span class="grow"></span><span class="wbr-mini" id="wbrAttLabel">${wbAttLabel()}</span></div>
          <div class="wbr-pips" id="wbrPips">${[0,1,2].map(i=>`<i class="wbr-pip${!locked&&i<(attLeft||0)?" on":""}"></i>`).join("")}</div>
          <div class="wbr-stats">
            <div class="wbr-stat"><span class="wbr-stat-k">BEST DMG</span><b class="wbr-stat-v gold" id="wbrBest">${wbBest?fmtBig(wbBest):"—"}</b></div>
            <div class="wbr-stat"><span class="wbr-stat-k">RANK</span><b class="wbr-stat-v" id="wbrRank">${rank?"#"+rank+(totalPlayers?"/"+totalPlayers:""):"—"}</b></div>
            <div class="wbr-stat"><span class="wbr-stat-k">SIKLUS</span><b class="wbr-stat-v">${RAID_TURNS} TURN</b></div>
            <div class="wbr-stat"><span class="wbr-stat-k">ATTEMPT</span><b class="wbr-stat-v">${locked?"—":(attLeft||0)+"/3"}</b></div>
          </div>
          ${claimBtn}
        </div>

        <div class="wbr-panel wbr-track">
          <div class="wbr-ptitle"><span>REWARD TRACK</span><span class="grow"></span><span class="wbr-mini">HARIAN</span></div>
          <div class="wbr-track-list">
            <div class="wbr-tr"><span class="wbr-tr-p">#1</span><span>JUARA HARIAN</span><span class="wbr-tr-r">1.000 GEM · 10K TOK · 10 PACK</span></div>
            <div class="wbr-tr"><span class="wbr-tr-p">#2</span><span>RUNNER-UP</span><span class="wbr-tr-r">500 GEM · 5K TOK · 5 PACK</span></div>
            <div class="wbr-tr"><span class="wbr-tr-p">#3</span><span>TOP 3</span><span class="wbr-tr-r">250 GEM · 2.5K TOK · 3 PACK</span></div>
            <div class="wbr-tr"><span class="wbr-tr-p">ALL</span><span>PARTISIPAN</span><span class="wbr-tr-r">100 GEM · 1K TOK · 1 PACK</span></div>
          </div>
        </div>

        <div class="wbr-panel wbr-lb">
          <div class="wbr-lb-head">
            <div class="wbr-ptitle"><span>TOP HUNTER HARI INI</span><span class="grow"></span><span class="wbr-mini">${hunters}</span></div>
            <button class="wbr-lb-all" id="wbTopAll" type="button">PAPAN PENUH</button>
          </div>
          <div class="wbr-lb-rows" id="wbrTop">${wbrTopRows()}</div>
        </div>

        <div class="wbr-dock">
          <button class="wbr-btn ghost" id="raidShopBtn" type="button" title="World Boss Shop">SHOP</button>
          <button class="wbr-btn${dead||locked?" dead":""}" id="raidGo" type="button"${dead||locked?" disabled":""}>
            <span class="wbr-btn-main"><span class="wbr-btn-k">${deployK}</span><span>${deployT}</span></span>
          </button>
        </div>
      </aside>
    </div>
  </div>`;

  document.getElementById("raidGo").onclick=()=>{
    if(locked){raidToast("BOSS INI BELUM TERSEDIA");return;}
    if(poolLeft<=0){raidToast("WORLD BOSS SUDAH TUMBANG · RESET 00:00 WIB");return;}
    if(wbOnline()&&d&&(d.attempts_left||0)<=0){raidToast("ATTEMPT HARI INI HABIS · RESET 00:00 WIB");return;}
    wbrDeployPulse(()=>{sfx.hit();raidView="pick";renderRaid();});
  };
  document.getElementById("raidShopBtn").onclick=()=>{sfx.hit();raidView="shop";renderRaid();};
  {const wc=document.getElementById("wbClaim");if(wc)wc.onclick=wbClaim;}
  {const ta=document.getElementById("wbTopAll");if(ta)ta.onclick=()=>{sfx.hit();if(typeof openRanking==="function")openRanking(b.board);else raidToast("Papan peringkat belum tersedia");};}
  {const rl=document.getElementById("raidLobby");if(rl)rl.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};}
  {const pv=document.getElementById("wbrPrev");if(pv)pv.onclick=()=>goBoss(-1);}
  {const nx=document.getElementById("wbrNext");if(nx)nx.onclick=()=>goBoss(1);}
  renderDots();
  wbrBindStage();
  wbRefresh();
  wbrStartPoll();
}
/* ---------- indikator boss (dots) ---------- */
function renderDots(){
  const d=document.getElementById("wbrDots");
  if(!d)return;
  d.innerHTML=WB_BOSSES.map((b,i)=>`<button class="wbr-dot${i===wbBossIdx?" on":""}${b.locked?" locked":""}" type="button" data-i="${i}" title="${b.name}" aria-label="${b.name}">${b.key.toUpperCase()}</button>`).join("");
  Array.prototype.forEach.call(d.querySelectorAll(".wbr-dot"),el=>{
    el.onclick=()=>{
      const i=Number(el.getAttribute("data-i"));
      if(i===wbBossIdx)return;
      goBoss(i-wbBossIdx);
    };
  });
}
/* ---------- ganti boss (panah / swipe / dot) ---------- */
let wbrSwapping=false;
function goBoss(dir){
  const n=WB_BOSSES.length;
  if(wbrSwapping||n<2)return;
  const next=((wbBossIdx+dir)%n+n)%n;
  if(next===wbBossIdx)return;
  try{sfx.hit();}catch(e){}
  const stage=document.getElementById("wbrStage");
  const wrap=document.getElementById("wbrArtWrap");
  if(wbReduceMotion()||!stage||!wrap){wbBossIdx=next;renderRaidHub();return;}
  wbrSwapping=true;
  stage.classList.add("swapping");
  wrap.classList.add("swap");
  setTimeout(()=>{
    wbBossIdx=next;
    renderRaidHub();
    const st=document.getElementById("wbrStage"),wr=document.getElementById("wbrArtWrap");
    if(st)st.classList.add("swapping");
    if(wr)wr.classList.add("swap");
    setTimeout(()=>{
      const s2=document.getElementById("wbrStage"),w2=document.getElementById("wbrArtWrap");
      if(s2)s2.classList.remove("swapping");
      if(w2)w2.classList.remove("swap");
      wbrSwapping=false;
    },70);
  },180);
}
/* ---------- pulse deploy (1 ring + flash 180ms) ---------- */
let wbrDeployT=0;
function wbrDeployPulse(next){
  const stage=document.getElementById("wbrStage");
  if(!stage||wbReduceMotion()){if(typeof next==="function")next();return;}
  clearTimeout(wbrDeployT);
  stage.classList.remove("strike");
  void stage.offsetWidth;
  stage.classList.add("strike");
  wbrDeployT=setTimeout(()=>{
    const s=document.getElementById("wbrStage");
    if(s)s.classList.remove("strike");
    if(typeof next==="function")next();
  },180);
}
/* ---------- bind stage: swipe/drag ganti boss (tanpa partikel & parallax) ----------
   Ambang TINGGI (dx>90 + dx>dy*2.2) supaya tap + slide jari 60–80px di HP kentang
   tidak dianggap swipe. Ini yang bikin user dulu ngira "klik sendiri": tap meleset
   dari panah/dot → kena stage → swipe kepicu. */
function wbrBindStage(){
  const stage=document.getElementById("wbrStage");
  if(!stage)return;
  let sx=0,sy=0,drag=false;
  stage.addEventListener("pointerdown",e=>{
    if(e.target&&e.target.closest&&e.target.closest("button"))return;
    drag=true;sx=e.clientX;sy=e.clientY;
  });
  stage.addEventListener("pointerup",e=>{
    if(!drag)return;
    drag=false;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dx)>90&&Math.abs(dx)>Math.abs(dy)*2.2)goBoss(dx<0?1:-1);
  });
  stage.addEventListener("pointercancel",()=>{drag=false;});
}

var _rdTileHtml={},_ixHtml={},_dpHtml={};
function renderRaidPick(){
  const stacks=state.stacks.slice().sort((a,b)=>(b.fav?1:0)-(a.fav?1:0));
  const b=wbBossOf();
  app.innerHTML=`
  <div class="rd-page rd-pick">
    <div class="rd-pick-head">
      <button class="rd-pick-back" id="raidPickBack" title="Kembali ke hub raid">&#8592;</button>
      <div class="rd-pick-ttl"><span class="eyebrow">PILIH KARTU RAID</span><b>SATU KARTU vs ${b.name.toUpperCase()}</b></div>
      <div class="rd-pick-boss"><img src="${b.img}" alt="${b.name}"><div class="rpb-i"><span class="rpb-k">BOSS &middot; ${b.diffLabel}</span><span class="rpb-n">${b.name}</span><span class="rpb-hp">HP ${fmtBig(b.hp)} &middot; ${RAID_TURNS} TURN</span></div></div>
    </div>
    <label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="raidSearch" type="text" placeholder="Cari kartu…" autocomplete="off"></label>
    <div class="raid-pick-grid" id="raidPickGrid">${(()=>{const _rd={};const inner=s=>{const c=CARDS[s.char];
      const shny=s.shiny?'<span class="bpt-shiny shiny-pill">SHINY</span>':'';
      const mut=(s.mut&&s.mut!=='none')?s.mut:null;
      const trait=(s.trait&&s.trait!=='none')?s.trait:null;
      const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
      const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,mutPill(mut,'bpt-mut')):''}${trait?traitChip(trait,`<span class="bpt-gem" style="color:${TRAIT_COLOR[trait]};border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
      return `<img src="${cardThumb(s.char)}" alt="" width="360" height="536" loading="lazy" decoding="async">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}');renderRaidPick()" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}');renderRaidPick()" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${c.name}</div>`;};
      _rdTileHtml=_rd;
      return stacks.map((s,i)=>{_rd[s.id]=inner(s);const c=CARDS[s.char];const mounted=i<48;
      return `<div class="bp-tile${c.fullArt?' fa':''}${mounted?'':' lz-ph'}" data-lz="${s.id}" data-sid="${s.id}" data-pick="${s.id}" data-name="${c.name.toLowerCase()}" style="--tcol:${TIER_COLOR[s.tier]}">${mounted?_rd[s.id]:''}</div>`;
    }).join("");})()}</div>
    <div class="no-result" id="raidSearch-nr">Tidak ada kartu yang cocok dengan pencarian.</div>
  </div>`;
  bpsHoverBind();bpsHoverHide(); /* hover tile -> reveal kartu penuh (stat/passive) kayak tab DECK */
  {const bk=document.getElementById("raidPickBack");if(bk)bk.onclick=()=>{sfx.hit();raidView="hub";renderRaid();};}
  {const rs=document.getElementById("raidSearch");if(rs){rs.value=raidSearch;rs.oninput=()=>{raidSearch=rs.value;runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));};if(raidSearch)runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));}}
  app.querySelectorAll("[data-pick]").forEach(btn=>btn.onclick=()=>{
    if(wbStarting)return;
    sfx.hit();
    if(typeof hideRollResult==="function")hideRollResult();
    raidPicked=state.stacks.find(s=>s.id===btn.dataset.pick)||state.stacks[0];
    if(!wbOnline()){wbRunId=null;wbRunBoss=null;raidView="battle";renderRaid();return;}
    /* Attempt dipotong di sini (server) — run yang ditinggal tetap terhitung. */
    wbStarting=true;
    raidToast("MENGUNCI ATTEMPT…");
    const sb=wbBoss(), sd=wbData();
    window.CloudDB.wbStart(currentUser,sb.id).then(res=>{
      wbStarting=false;
      if(res&&res.ok){
        wbRunId=res.run_id;
        wbRunBoss=sb.key;
        if(sd){
          sd.attempts_used=(sd.attempts_used||0)+1;
          sd.attempts_left=typeof res.attempts_left==="number"?res.attempts_left:Math.max(0,3-sd.attempts_used);
          if(res.modifier)sd.modifier=res.modifier;
          wbAt=Date.now();
        }
        raidView="battle";renderRaid();
      }else if(res&&res.ok===false){
        wbRunId=null;wbRunBoss=null;
        if(res.msg==="NO_ATTEMPTS_LEFT"&&sd){sd.attempts_used=3;sd.attempts_left=0;}
        raidToast(res.msg==="NO_ATTEMPTS_LEFT"?"ATTEMPT HARI INI HABIS · RESET 00:00 WIB":"GAGAL MULAI RUN · COBA LAGI");
        raidView="hub";renderRaid();
      }else{
        /* server tak terjangkau: boleh main lokal, skor tidak dikirim */
        wbRunId=null;raidToast("OFFLINE · MAIN LOKAL TANPA SKOR");raidView="battle";renderRaid();
      }
    }).catch(()=>{
      /* Promise reject (bukan respons ok:false) — tanpa ini wbStarting nyangkut true
         dan semua tap kartu diblokir selamanya. */
      wbStarting=false;wbRunId=null;wbRunBoss=null;
      raidToast("OFFLINE · MAIN LOKAL TANPA SKOR");raidView="battle";renderRaid();
    });
  });
  lazyMountGrid(app,_rdTileHtml);
}
function renderRaidBattle(){
  const b=wbBossOf(), eq=raidPicked||equipped();
  app.innerHTML=`
  <div class="battle-grid raid-stage">
    <div class="me-col"><div class="fighter me${eq&&eq.mut&&eq.mut!=='none'?' mut-'+eq.mut:''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}">${meFighterHtml(eq)}</div>${typeof benchRailHtml==="function"?benchRailHtml([],"RAID STRIKER (SOLO DEPLOY)"):""}</div>
    <div class="vs-col"><div class="t">VS</div><div class="s" id="raidTurnLabel">TURN<br>0/${RAID_TURNS}</div></div>
    <div class="me-col foe-side"><div class="fighter foe" data-tier="EX">
      ${typeof foeFighterInnerHtml==="function"?foeFighterInnerHtml({name:b.name,img:b.img,tier:"BOSS",boss:true},{hp:b.hp,atk:999999},{hpId:"hpRaid",hpTid:"hpRaidT",subtitle:"WORLD BOSS",skill:b.skill,hpFmt:fmtBig}):`
      <div class="f-banner"><img src="${b.img}" alt="${b.name}"><div class="f-name">${b.name}</div></div>
      <div class="hpbar"><i id="hpRaid"></i><span id="hpRaidT">${fmtBig(b.hp)} / ${fmtBig(b.hp)}</span></div>
      <div class="f-body">
        <div class="f-title">${rarityText(b.tier)} · WORLD BOSS</div>
        <div class="f-skill">${b.skill}</div>
        <div class="stat-row"><div class="stat">♡ ${fmtBig(b.hp)}</div><div class="stat">${ATKIC} ${fmt(999999)}</div></div>
      </div>`}
    </div>${typeof benchRailHtml==="function"?benchRailHtml([],"RAID CALAMITY (SINGLE BOSS)"):""}</div>
  </div>
  <div class="wbr-runline"><span>DAMAGE THIS RUN</span><b id="wbrRunDmg">0</b><small>POOL HP ${fmtBig(b.hp)}</small></div>`;
  if(typeof wireSpeedBtn==="function")wireSpeedBtn();
  startRaid();
}
function startRaid(){
  const b=wbBossOf(), eq=raidPicked||equipped(), base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  /* Arena bisa di-render ulang oleh polling/loop global. Kalau raid masih hidup, lanjutkan —
     jangan bikin objek baru (turn balik 0) dan jangan tinggalkan timer lama jalan (speed dobel). */
  if(raid&&!raid.over&&raid.diffKey===b.diffKey&&raid.cid===eq.char){
    /* DOM baru dari render ulang → kembalikan label & HP ke posisi battle yang sedang jalan. */
    const tl=document.getElementById("raidTurnLabel");
    if(tl)tl.innerHTML="TURN<br>"+raid.turn+"/"+raid.cap;
    const hb=document.getElementById("hpRaid"),ht=document.getElementById("hpRaidT");
    const hp=Math.max(0,raid.hp);
    if(hb)hb.style.width=Math.max(0,Math.min(100,hp/raid.max*100))+"%";
    if(ht)ht.textContent=fmtBig(hp)+" / "+fmtBig(raid.max);
    {const rd=document.getElementById("wbrRunDmg");if(rd)rd.textContent=fmtBig(raid.dealt||0);}
    return;
  }
  if(raid&&raid.timer){clearTimeout(raid.timer);raid.timer=null;}
  raid={boss:b,hp:b.hp,max:b.hp,dealt:0,turn:0,cap:RAID_TURNS,atk:base.atk,fx:resolveFx(eq,b.fx||{}),cid:eq.char,over:false,timer:null,domainUsed:false,domainLeft:0,diffKey:b.diffKey,rw:b.rw,havocUses:0,havocGuard:true};
  /* Raid: tanpa cut-in banner VS — langsung masuk arena */
  playFight(()=>{ if(raid&&!raid.over)raid.timer=setTimeout(raidStep,500); },{skipIntro:true});
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
  let psychicActive=false,bajrangActive=false,hpPurple=false,floodHit=false;
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
  /* 40-DAY FLOOD / HOLLOW PURPLE: serangan ke-N xmult (label HOLLOW PURPLE pakai FX ult) */
  if(fx.flood){raid.floodCount=(raid.floodCount||0)+1;if(raid.floodCount%fx.flood.every===0){floodHit=true;hits[hits.length-1]*=(fx.flood.mult||1);if(fx.flood.label==="HOLLOW PURPLE")hpPurple=true;}}
  /* BAJRANG GUN: sekali per raid — ×mult + FX kepalan raksasa */
  if(fx.bajrangGun&&!raid.bajrangUsed){raid.bajrangUsed=true;bajrangActive=true;hits[hits.length-1]*=(fx.bajrangGun.mult||1);}
  // DOMAIN aktif: serangan jadi 10× barrage @30% ATK
  if(domainActive){hits.length=0;const dn=fx.domain.min||10,dm=(fx.domain.mult!=null?fx.domain.mult:0.3);for(let i=0;i<dn;i++)hits.push(dm);barrageN=dn;crit=false;purple=false;ranton=false;}
  /* PSYCHIC BARRAGE: N batu @mult — FX ult levitasi */
  if(fx.psychicBarrage){const pn=Math.max(1,fx.psychicBarrage.rocks||1),pm=fx.psychicBarrage.mult||1;hits.length=0;for(let i=0;i<pn;i++)hits.push(pm);psychicActive=true;barrageN=pn;raid.psyN=pn;}
  const ariseMode=id==="CH_EX_JINWOO"&&barrageN>=9;
  /* Galaxy Roar = satu semburan laser: seluruh damage ditumpuk ke satu sambaran
     supaya jatuh di menit GALAXY.hit, bukan di awal serangan. */
  const galaxyMode=id==="CH_ETERNAL_DRAGON"&&purple;
  if(galaxyMode){const m=hits[hits.length-1];hits.length=0;hits.push(m);barrageN=0;}
  const md=ranton&&id==="CH_EX_MADARA";
  /* Basic attack: archetype FX (6 elemen) — sama seperti battle/tower. Ult & barrage pakai FX khusus. */
  let total=0;hits.forEach(m=>total+=Math.round(dmg*m));
  /* ronde roket Havoc = ronde ult → basic archetype jangan ikut main (dulu dua-duanya keluar bareng) */
  const havocWillFire=!!(fx.havocRocket&&raid.hp-total>0&&raid.havocGuard&&(raid.havocUses||0)<(fx.havocRocket.maxUses||3));
  const basicHit=!domainActive&&!ariseMode&&!md&&!galaxyMode&&!psychicActive&&!bajrangActive&&!hpPurple&&wePhase<0&&!gammaRayHit&&!havocWillFire;
  if(basicHit&&window.playAnimeArchetypeAttack){try{window.playAnimeArchetypeAttack(id,".fighter.me",".fighter.foe");}catch(e){console.error("raid archetype fx",e);}}
  if(psychicActive&&window.psyBarrageFx)window.psyBarrageFx({n:raid.psyN||hits.length,shotCount:hits.length,t0:180});
  if(bajrangActive&&window.bajrangGunFx)window.bajrangGunFx({t0:180});
  if(hpPurple&&window.hollowPurpleFx)window.hollowPurpleFx({t0:180});
  /* SFX ult: basic sudah bunyi dari synth archetype, ult/barrage perlu bunyi sendiri (dulu hening total) */
  try{
    if(psychicActive&&window.CyberSfx)window.CyberSfx.aoeCharge();
    if(bajrangActive&&window.CyberSfx)window.CyberSfx.aoeCharge();
    if(hpPurple&&window.CyberSfx)window.CyberSfx.plasmaBurn();
  }catch(e){}
  anim(".fighter.me","lunge-r");
  if(wePhase>=0&&window.worldEnderFx)window.worldEnderFx({fromSel:".fighter.me",toSel:".fighter.foe",phase:wePhase,revived:false});
  if(gammaRayHit&&window.gammaRayFx)window.gammaRayFx({fromSel:".fighter.me",toSel:".fighter.foe"});
  /* All cut-in removed */
  const setRaidBar=hp=>{const v=Math.max(0,hp);const p=Math.max(0,Math.min(100,v/raid.max*100));const b=document.getElementById("hpRaid");if(b)b.style.width=p+"%";const tt=document.getElementById("hpRaidT");if(tt)tt.textContent=fmtBig(v)+" / "+fmtBig(raid.max);};
  /* panjang rantai animasi hit ronde ini, dihitung SINKRON (di depan setTimeout) supaya cabang kematian
     bisa menunggu sambaran terakhir selesai — bukan memotong getar + angkanya lewat guard raid.over */
  const rHstep=(psychicActive&&typeof PSY_T!=="undefined")?PSY_T.step:(domainActive?80:160);
  const rMd=md;
  const rWeWait=(psychicActive&&typeof PSY_T!=="undefined")?PSY_T.first:(bajrangActive&&typeof BJ_T!=="undefined")?BJ_T.first:(hpPurple&&typeof HP_T!=="undefined")?HP_T.first:(wePhase>=0&&typeof WE_T!=="undefined")?WE_T.first:(gammaRayHit&&typeof GR_T!=="undefined")?GR_T.first:0;
  const rChainEnd=(rMd?MADARA_T.slash+Math.max(0,hits.length-1)*MADARA_T.step+40:180+rWeWait+Math.max(0,hits.length-1)*rHstep)+520;
  setTimeout(()=>{
    if(domainActive&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.me","DOMAIN EXPANSION","crit"),220);}
    if(ariseMode&&raid&&!raid.over){floatText(".fighter.foe","ARMY OF SHADOWS","crit");}
    const susStart=(md&&raid&&!raid.over)?MADARA_T.slash:rWeWait;
    {
      const hstep=rHstep;
      const susDelay=susStart;
      const dlyAt=i=> galaxyMode ? GALAXY.hit : md ? (susDelay+i*MADARA_T.step) : (i*hstep+susDelay);
      let rShown=raid.hp+total,rBarEnd=0;const rEndHp=raid.hp;
      const ultBarrage=(domainActive||ariseMode||md||psychicActive);
      const jwLag=(id==="CH_EX_JINWOO"&&barrageN&&!domainActive)?170:0;
      hits.forEach((m,i)=>{
        const dl=dlyAt(i),ft=dl+(md?40:0);
        /* getar DIJARAKI per sambaran (dl), sama seperti story/tower: sebelumnya hit non-Madara digetarkan
           sekaligus di menit yang sama jadi kartu cuma bergetar satu kali untuk 10× damage */
        setTimeout(()=>{if(raid&&!raid.over){anim(".fighter.foe","hit",ultBarrage);if(window.strikeFx&&!md&&!galaxyMode&&!psychicActive&&!bajrangActive&&!hpPurple)window.strikeFx(".fighter.foe",{big:crit&&i===hits.length-1,fx:fx});}},dl+jwLag);
        /* bunyi impact per sambaran — ritme sama seperti angka HP yang jatuh */
        setTimeout(()=>{if(raid&&!raid.over){try{if(crit&&i===hits.length-1)sfx.crit();else playClip(punchAudio);}catch(e){}}},dl);
        const dd=Math.round(dmg*m);rShown-=dd;rBarEnd=Math.max(rBarEnd,ft);const stepHp=Math.max(0,rShown);
        setTimeout(()=>floatText(".fighter.foe","-"+fmt(dd),(crit&&i===hits.length-1)?"crit":""),ft);
        setTimeout(()=>setRaidBar(stepHp),ft);
      });
      setTimeout(()=>setRaidBar(rEndHp),rBarEnd+520);
      if(barrageN>1)setTimeout(()=>floatText(".fighter.foe",(iceBlastN?"ICE BLAST ×":domainActive?"UNLIMITED VOID ×":ariseMode?"ARISE ×":md?"TENSA ×":psychicActive?"PSYCHIC BARRAGE ×":"CLEAVE ×")+barrageN,"crit"),md?MADARA_T.slash:psychicActive?300:320);
      else if(hits.length>1&&!ranton)setTimeout(()=>floatText(".fighter.foe","DOUBLE!","crit"),260+rWeWait);
      if(bajrangActive)setTimeout(()=>floatText(".fighter.me","BAJRANG GUN!","crit"),BJ_T.first-80);
      if(hpPurple)setTimeout(()=>floatText(".fighter.foe","HOLLOW PURPLE","crit"),HP_T.first-80);
      /* dentuman khas ult saat impact, bukan cuma saat charge */
      if((bajrangActive||hpPurple)&&window.CyberSfx){
        const impDelay=(bajrangActive?BJ_T.first:HP_T.first)+80;
        setTimeout(()=>{if(raid&&!raid.over)window.CyberSfx.aoeDetonate();},impDelay);
      }
    }
  },180);
  raid.hp-=total;raid.dealt+=total;
  {const rdEl=document.getElementById("wbrRunDmg");if(rdEl)rdEl.textContent=fmtBig(raid.dealt);}
  /* SUPER MEGA DEATH ROCKET (HAVOC WREACKER di Raid): langsung aktif saat masuk/turn 1, maks 3x per battle */
  let havocFired=false;
  if(fx.havocRocket&&raid.hp>0&&raid.havocGuard&&(raid.havocUses||0)<(fx.havocRocket.maxUses||3)){
    raid.havocGuard=false;
    raid.havocUses=(raid.havocUses||0)+1;
    havocFired=true;
    const rk=Math.round(raid.atk*(fx.havocRocket.pct||50)/100);
    raid.hp-=rk;raid.dealt+=rk;
    if(window.havocRocketFx)havocRocketFx({fromSel:".fighter.me",toSel:".fighter.foe"});
    try{if(window.CyberSfx)window.CyberSfx.aoeCharge();}catch(e){}
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
    const special=(domainActive||ariseMode||ranton||galaxyMode||havocFired||gammaRayHit||psychicActive||bajrangActive||hpPurple);
    const killWait=Math.max(rChainEnd, special?(ranton?MADARA_T.total+160:galaxyMode?GALAXY.total:1700):0);
    if(killWait>260){ setTimeout(()=>{if(raid&&!raid.over)endRaid();},killWait); }
    else endRaid();
    return;
  }
  raid.timer=setTimeout(raidStep,ariseMode?2200:domainActive?1900:ranton?MADARA_T.total+260:galaxyMode?GALAXY.total+260:bajrangActive?BJ_T.first+1300:hpPurple?HP_T.first+1000:psychicActive?Math.max(1200,PSY_T.first+(hits.length-1)*PSY_T.step+700):gammaRayHit?1550:1100);
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
  const dmg=Math.max(0,Math.round(raid.dealt||0));
  const pct=raid.max>0?(raid.max-Math.max(0,raid.hp))/raid.max*100:0;
  raid.pct=pct;raid.dmg=dmg;
  sfx.win();
  /* Kirim DAMAGE ABSOLUT (damage kartu apa adanya) ke server; server potong pool
     boss itu + simpan best_dmg, lalu membatasi ke _wb_dmg_cap(save). */
  const runId=wbRunId, runBossKey=wbRunBoss;
  wbRunId=null;wbRunBoss=null;
  if(runId&&window.CloudDB&&currentUser){
    const runBoss=WB_BOSSES.find(x=>x.key===runBossKey)||wbBoss();
    raid.wbPending=true;
    window.CloudDB.wbSubmit(currentUser,runId,dmg,runBoss.id).then(res=>{
      raid.wbPending=false;
      raid.wbRes=res||{ok:false,msg:"OFFLINE"};
      if(res&&res.ok){
        const bd=wbByBoss[runBoss.key];
        if(bd){
          bd.best_dmg=Math.max(bd.best_dmg||0,res.best_dmg||dmg);
          if(res.rank)bd.rank=res.rank;
          if(typeof res.attempts_left==="number"){bd.attempts_left=res.attempts_left;bd.attempts_used=3-res.attempts_left;}
          if(typeof res.hp_left==="number"){bd.hp_pool=res.hp_pool;bd.hp_left=res.hp_left;}
          wbAt=Date.now();
        }
      }
      if(raidView==="result")renderRaidResult();
    }).catch(()=>{
      /* Tanpa catch, layar hasil nyangkut di "MENGIRIM DAMAGE…" selamanya. */
      if(raid){raid.wbPending=false;raid.wbRes={ok:false,msg:"NETWORK"};}
      if(raidView==="result")renderRaidResult();
    });
  }
  setTimeout(()=>{raidView="result";renderRaid();},2000);
}
function renderRaidResult(){
  const dmg=raid?raid.dmg||0:0;
  const pct=raid?raid.pct||0:0;
  let wbLine="";
  if(wbOnline()&&raid){
    if(raid.wbPending)wbLine=`<div class="rr-wb">MENGIRIM DAMAGE KE WORLD BOSS…</div>`;
    else if(raid.wbRes&&raid.wbRes.ok)wbLine=`<div class="rr-wb on">DAMAGE TERCATAT · BEST ${fmtBig(raid.wbRes.best_dmg)} · RANK #${raid.wbRes.rank||"—"}${raid.wbRes.total_players?"/"+raid.wbRes.total_players:""} · SISA ${raid.wbRes.attempts_left} ATTEMPT${typeof raid.wbRes.pool_dmg==="number"?" · POOL −"+fmtBig(raid.wbRes.pool_dmg):""}</div>`;
    else if(raid.wbRes)wbLine=`<div class="rr-wb bad">DAMAGE GAGAL DIKIRIM (${raid.wbRes.msg||"ERROR"}) · ATTEMPT TETAP TERPAKAI</div>`;
    else wbLine=`<div class="rr-wb">MAIN LOKAL · DAMAGE TIDAK DIKIRIM</div>`;
  }
  app.innerHTML=`
  <div class="tw-page rd-page"><div class="raid-result">
    <div class="eyebrow">HASIL WORLD BOSS</div>
    <div class="rr-title disp${pct>=100?"":" lose"}">${pct>=100?"BOSS TUMBANG":"RUN SELESAI"}</div>
    <div class="rr-pct">Damage run ini <b>${fmtBig(dmg)}</b></div>
    <div class="rr-token">${pct.toFixed(2)}% <span>DARI POOL 10B</span></div>
    ${wbLine}
    <div class="rr-tier">Damage terbaik 1 run masuk papan peringkat harian. Reward rank diklaim besok di hub.</div>
    <div class="rr-actions"><button class="btn-grad" id="rrAgain">RAID LAGI</button><button class="btn-ghost" id="rrHub">KEMBALI</button></div>
  </div></div>`;
  document.getElementById("rrAgain").onclick=()=>{sfx.hit();raidView="pick";renderRaid();};
  document.getElementById("rrHub").onclick=()=>{raidView="hub";renderRaid();};
  wbRefresh();
}
function stackHas(char,mut){mut=mut||"none";return state.stacks.some(s=>s.char===char&&(s.mut||"none")===mut);}
const WB_SHOP=[
  {id:"gem",name:"Token → Gem // 100:20",cost:100,gem:20,desc:"Tukar 100 TOKEN WORLD BOSS menjadi 20 GEM premium. Bisa ditukar berulang tanpa batas — keran GEM dari World Boss.",apply:()=>""},
  {id:"coins",name:"2.000 Coin",cost:12,coinBuy:true,desc:"Koin untuk roll trait & kebutuhan lain.",apply:()=>""},
  {id:"card_edragon",name:"Eternal Dragon",cost:4000,desc:"Kartu BOSS eksklusif — beli SEKALI, roll terbuka PERMANEN di semua gacha. Chance dasar 1 in 25 jt · ICE BLAST 50% (3×75% ATK) · immune semua status effect.",card:{char:"CH_ETERNAL_DRAGON",mut:"none"},
    apply:()=>{state.raidShopOwned=state.raidShopOwned||{};state.raidShopOwned.CH_ETERNAL_DRAGON=true;return gmGrantCard("CH_ETERNAL_DRAGON");}},
  {id:"card_shadowking",name:"Shadow King",cost:8000,desc:"Kartu BOSS eksklusif — beli SEKALI, LANGSUNG didapat + roll terbuka PERMANEN di semua gacha. Chance dasar 1 in 100 jt · NECROMANCER 'ETERNAL LEGION' (Shadow Army).",card:{char:"CH_SHADOW_KING",mut:"none"},
    apply:()=>{state.raidShopOwned=state.raidShopOwned||{};state.raidShopOwned.CH_SHADOW_KING=true;return gmGrantCard("CH_SHADOW_KING");}},
  {id:"helm-abyss",name:"HELM ABYSS",cost:12000,desc:"Artefak CRAYON V2 — +80 flat & +120% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot artefak, equip 2 slot).",effect:"+80 FLAT & +120% LUCK",owned:()=>state.artOwned.includes("helm-abyss"),
    apply:()=>{state.artOwned=state.artOwned||[];if(!state.artOwned.includes("helm-abyss"))state.artOwned.push("helm-abyss");return "HELM ABYSS · +80 FLAT & +120% LUCK";}},
  {id:"nebula-wisp",name:"NEBULA WISP",cost:30000,desc:"Pet CRAYON V2 — +150 flat & +220% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot pet, equip 1).",effect:"+150 FLAT & +220% LUCK",owned:()=>state.petOwned.includes("nebula-wisp"),
    apply:()=>{state.petOwned=state.petOwned||[];if(!state.petOwned.includes("nebula-wisp"))state.petOwned.push("nebula-wisp");return "NEBULA WISP · +150 FLAT & +220% LUCK";}},
  /* LUCK & SPEED POTION L1-L3 — consumable, harga token sama dgn Toko Inf. */
  {id:"luck1",name:"Luck Potion L1",cost:25,desc:"+3 flat luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+3 FLAT LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[0]++;return "LUCK POTION L1";}},
  {id:"luck2",name:"Luck Potion L2",cost:125,desc:"+5 flat luck & +10% luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+5 FLAT & +10% LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[1]++;return "LUCK POTION L2";}},
  {id:"luck3",name:"Luck Potion L3",cost:600,desc:"+10 flat luck & +20% luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+10 FLAT & +20% LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[2]++;return "LUCK POTION L3";}},
  {id:"speed1",name:"Speed Potion L1",cost:25,desc:"Roll speed +0.2× (≈1.2×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +0.2× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[0]++;return "SPEED POTION L1";}},
  {id:"speed2",name:"Speed Potion L2",cost:125,desc:"Roll speed +0.5× (≈1.5×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +0.5× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[1]++;return "SPEED POTION L2";}},
  {id:"speed3",name:"Speed Potion L3",cost:600,desc:"Roll speed +1.0× (2×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +1.0× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[2]++;return "SPEED POTION L3";}}
];
/* =============== TOKO RAID — layout master-detail ala TOKO INF (.tw-hub) ===============
   Kiri: daftar item (.srow). Kanan: stats token + detail (.sdetail) + tombol beli (.act.go.buyswap).
   Kartu BOSS: status ROLL TERKUNCI/TERBUKA ditampilkan; beli = raidShopOwned[id]=true (permanen). */
function raidShopBuy(id){
  const it=WB_SHOP.find(x=>x.id===id);if(!it)return;
  const tok=state.wbTokens||0;
  if(tok<it.cost){raidToast("TOKEN KURANG — butuh "+it.cost+" token");return;}
  if(it.coinBuy){
    /* 0025: coin milik server — token dipotong + coin dibayar satu RPC atomik,
       dibatasi 100 pembelian/hari (token masih tersimpan di save_data). */
    (async()=>{
      let res;
      try{
        const u=(typeof currentUser!=="undefined"&&currentUser)?String(currentUser):"";
        if(u&&window.CloudDB&&window.CloudDB.buyWbCoins){
          res=await window.CloudDB.buyWbCoins(u);
        }else{
          state.wbTokens-=it.cost;state.coins+=2000;
          res={ok:true,coins:2000,tokens:state.wbTokens};
        }
      }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
      if(res&&res.ok){
        if(typeof res.tokens==="number")state.wbTokens=res.tokens;
        save();sfx.crit();renderShell();
        raidToast("TUKAR BERHASIL · −"+it.cost+" token · +"+fmt(res.coins||2000)+" COIN");
      }else{
        const why=(res&&res.msg)==="TOKEN_KURANG"?"TOKEN KURANG":((res&&res.msg)==="DAILY_CAP"?"BATAS HARIAN":((res&&res.msg)||"coba lagi"));
        raidToast("TUKAR GAGAL — "+why);
      }
      try{renderShell();}catch(e){}
      if(raidView==="shop")renderRaidShop();
    })();
    return;
  }
  if(it.gem){
    const GEM_AMT=it.gem;
    (async()=>{
      let res;
      try{
        const u=(typeof currentUser!=="undefined"&&currentUser)?String(currentUser):"";
        if(u&&window.CloudDB&&window.CloudDB.exchangeTokens){
          /* 0023: server yang potong token + bayar gem (atomik). */
          res=await window.CloudDB.exchangeTokens(u,"wb");
        }else{
          state.wbTokens-=it.cost;
          state.premiumGems=(state.premiumGems||0)+GEM_AMT;
          res={ok:true,gems:GEM_AMT,tokens:state.wbTokens};
        }
      }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
      if(res&&res.ok){
        if(typeof res.tokens==="number")state.wbTokens=res.tokens;
        save();sfx.crit();renderShell();
        raidToast("TUKAR BERHASIL · −"+it.cost+" token · +"+(res.gems||GEM_AMT)+" GEM");
      }else{
        try{save();}catch(e){}
        const why=(res&&res.msg)==="TOKEN_KURANG"?"TOKEN KURANG":((res&&res.msg)||"coba lagi");
        raidToast("TUKAR GAGAL — "+why);
      }
      try{renderShell();}catch(e){}
      if(raidView==="shop")renderRaidShop();
    })();
    return;
  }
  if(it.card&&stackHas(it.card.char,it.card.mut)){raidToast("Kartu itu sudah ada di Deck kamu");return;}
  if(it.owned&&it.owned()){raidToast("Sudah dibeli — permanen di Backpack");return;}
  /* 0026: saldo token milik server. Potong dulu lewat RPC (harga diambil dari
     token_shop_price, bukan angka client); item baru diberikan kalau server setuju. */
  (async()=>{
    let res;
    try{
      const u=(typeof currentUser!=="undefined"&&currentUser)?String(currentUser):"";
      if(u&&window.CloudDB&&window.CloudDB.spendTokens){
        res=await window.CloudDB.spendTokens(u,"wb",it.id);
      }else{
        state.wbTokens-=it.cost;
        res={ok:true,tokens:state.wbTokens};
      }
    }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
    if(res&&res.ok){
      if(typeof res.tokens==="number")state.wbTokens=res.tokens;
      const msg=it.apply();save();sfx.crit();renderShell();
      raidToast(msg+" · −"+it.cost+" token");
    }else{
      try{save();}catch(e){}
      const why=(res&&res.msg)==="TOKEN_KURANG"?"TOKEN KURANG":((res&&res.msg)==="DAILY_CAP"?"BATAS HARIAN":((res&&res.msg)||"coba lagi"));
      raidToast("BELI GAGAL — "+why);
    }
    try{renderShell();}catch(e){}
    renderRaidShop();
  })();
}
function renderRaidShop(){
  const tok=state.wbTokens||0;
  
  /* Cyberpunk Vector Hologram Icons (Custom inline SVG ala Honkai / PGR / Cyberpunk 2077) */
  const ICO={
    gem:`<img src="assets/images/premium-currency.webp" alt="Gem" style="width:100%;height:100%;object-fit:cover;border-radius:50%;filter:drop-shadow(0 0 8px rgba(255,215,0,.55))">`,
    coins:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6" stroke="#ffd27a"/></svg>`,
    card_edragon:`<img src="assets/cards/art/eternal-dragon.webp?v=trans1" onerror="this.parentNode.textContent='🐉'">`,
    card_shadowking:`<img src="${thumbSrc('assets/cards/art/shadow-king.webp')}" alt="Shadow King" onerror="this.parentNode.textContent='👑'">`,
    "helm-abyss":`<img src="assets/artifacts/abyss-helm.png" onerror="this.parentNode.textContent='🪖'">`,
    "nebula-wisp":`<img src="assets/pets/nebula-wisp.png" onerror="this.parentNode.textContent='🌌'">`,
    luck1:`<img src="${thumbSrc('assets/images/pot-luck-1.png')}" alt="Luck Potion L1" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='🍀'">`,
    luck2:`<img src="${thumbSrc('assets/images/pot-luck-2.png')}" alt="Luck Potion L2" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='🍀'">`,
    luck3:`<img src="${thumbSrc('assets/images/pot-luck-3.png')}" alt="Luck Potion L3" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='🍀'">`,
    speed1:`<img src="${thumbSrc('assets/images/pot-speed-1.png')}" alt="Speed Potion L1" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='⚡'">`,
    speed2:`<img src="${thumbSrc('assets/images/pot-speed-2.png')}" alt="Speed Potion L2" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='⚡'">`,
    speed3:`<img src="${thumbSrc('assets/images/pot-speed-3.png')}" alt="Speed Potion L3" class="shop-pot-img" onerror="this.onerror=null;this.parentNode.textContent='⚡'">`
  };
  
  const cardItems=WB_SHOP.filter(x=>x.card);
  const bossTotal=cardItems.length,bossCount=cardItems.filter(x=>bossRollUnlocked(x.card.char)).length;
  
  const ITEMS=WB_SHOP.map(it=>{
    let cat="POTION", tier="SPEC";
    if(it.gem) { cat="EXCHANGE"; tier="GEM"; }
    else if(it.card) { cat="EX CORE"; tier="CH-EX"; }
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
      ac:it.gem?"#ffd700":it.card?"#B58CFF":it.id.includes("helm")?"#FFD27A":it.id.includes("wisp")?"#7DF9FF":"#5CF0A8",
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
    if(it.it.gem){
      small="TUKAR TOKEN → GEM (TANPA BATAS)";
      big=`+${it.it.gem} GEM &bull; ${fmt(it.cost)} TOKEN`;
    }
    if(have){
      small=it.it.card?"Roll gacha sudah permanen terbuka":"Permanen tersimpan di Backpack";
      big="SUDAH DIMILIKI";
      dis=true;
    } else if(tok<it.cost){
      small="INSUFFICIENT WORLD BOSS TOKENS";
      big=`DEFISIT ${fmt(it.cost-tok)} TOKEN`;
      dis=true;
    }
    btn.disabled=dis;
    btn.className="hsd-buy-action cp-buy-action" + (dis?" disabled":"");
    /* Kartu BOSS: JANGAN pasang art di tombol buy — kotak ikon cuma 32px,
       potret boss luber keluar tombol. Sisakan teks + panah. */
    btn.innerHTML=`
      ${it.it.card?"":`<div class="hsd-ba-ic">${ICO[it.k]||"🎁"}</div>`}
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
          <div class="hsd-meta-price">${fmt(it.cost)} WORLD BOSS TOKENS</div>
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
          <b class="hm-val ${cnt>0?'green':''}">${isCard ? (cnt ? 'x'+cnt : '0') : it.it.gem ? '&#8734; UNLIMITED' : 'Tersedia'}</b>
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
            <span>KEMBALI KE WORLD BOSS</span>
          </button>
          <div class="hsh-title-wrap">
            <div class="hsh-kicker"><span class="hsh-dot cp-dot"></span> PROCUREMENT MATRIX // LEVEL 01+</div>
            <div class="hsh-title">WORLD BOSS <span class="hsh-cyan">EXCHANGE</span></div>
          </div>
        </div>
        <div class="hsh-header-right">
          <div class="hsh-token-chip cp-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg>
            <div class="htc-col"><small>WORLD BOSS TOKEN</small><b class="cyan">${fmt(tok)}</b></div>
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
  sx.oninput=()=>{ixState.q=sx.value.trim().toLowerCase();clearTimeout(sx._t);sx._t=setTimeout(ixRender,180);};
  document.getElementById("spClose").onclick=()=>document.getElementById("skillPop").classList.remove("show");
  document.getElementById("skillPop").onclick=(e)=>{if(e.target.id==="skillPop")document.getElementById("skillPop").classList.remove("show");};
}
function ixLiveShimmer(){
  /* Index = 75 tile shiny semua animasi holoSheen -> ~2000 repaint/detik -> fps drop 6.
     Batasi concurrency: hanya ~12 tile yang PALING TENGAH viewport yang ditandai .ix-live,
     sisanya static. Scroll -> live set rotate. Kalau fps-lock lepas, gak ngaruh (rule CSS
     khusus html.fps-locked). */
  const body=document.getElementById("ixBody"); if(!body) return;
  if(body.__ixShimmerIO){try{body.__ixShimmerIO.disconnect();}catch(e){}}
  const cells=[].slice.call(body.querySelectorAll('.ix-cell.shiny'));
  if(!cells.length) return;
  const MAX=8;
  const update=()=>{
    const vr=body.getBoundingClientRect();
    const vc=(vr.top+vr.bottom)/2;
    const vis=cells.filter(c=>{
      if(c.classList.contains('lz-ph'))return false;
      const r=c.getBoundingClientRect();
      return r.bottom>vr.top && r.top<vr.bottom;
    });
    vis.sort((a,b)=>{
      const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
      return Math.abs((ra.top+ra.bottom)/2 - vc) - Math.abs((rb.top+rb.bottom)/2 - vc);
    });
    cells.forEach(c=>{c.classList.remove('ix-live');});
    vis.slice(0,MAX).forEach(c=>{c.classList.add('ix-live');});
  };
  const io=new IntersectionObserver(update,{root:body,rootMargin:'0px',threshold:[0,0.1]});
  cells.forEach(c=>io.observe(c));
  body.addEventListener('scroll',update,{passive:true});
  body.__ixShimmerIO=io;
  update();
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
  _ixHtml={};
  const cells=list.map((c,i)=>{
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
    const lockBoss = !!((c.raidBoss||c.towerBoss) && !bossRollUnlocked(c.char_id));
    const lockShop = c.towerBoss?"TOKO INF":"TOKO WORLD BOSS";

    const shFx = isShinyActive;
    const comboFx = !!(shFx && hasMut);
    const cls = `ix-cell${isSpecificVariantOwned ? '' : ' no-own'}${lockBoss ? ' boss-locked' : ''}${shFx ? ' shiny' : ''}${hasMut ? ' m-' + fm : ''}${comboFx ? ' combo-mut' : ''}${c.fullArt ? ' fa' : ''}`;

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

    const inner=`<img src="${thumbSrc(c.sprite_asset)}" alt="${c.name}" width="360" height="536" loading="lazy" decoding="async">
      ${c.fullArt&&(hasMut||shFx)?`<span class="ix-fa-var">${shFx?'<span class="shiny-badge shiny-pill">SHINY</span>':''}${hasMut?mutChip(fm,mutPill(fm)):''}</span>`:''}
      <span class="ixc-stack">${nameHtml}<span class="ixc-chance${hasMut && (fm === 'rainbow' || fm === 'ultima') ? ' ixc-chance-rainbow' : ''}" style="color:${chanceColor}"><span class="ixc-chance-text">${chanceHtml}</span></span></span>
      <span class="ixc-own${isSpecificVariantOwned ? ' on' : ''}">${any}/10</span>`;
    _ixHtml[c.char_id]=inner;
    const mounted=i<48;
    return `<button class="${cls}${mounted?'':' lz-ph'}" type="button" data-lz="${c.char_id}" data-c="${c.char_id}" data-mut="${hasMut ? fm : 'none'}" data-shiny="${shFx ? '1' : '0'}"${lockBoss ? ' title="BELUM DIBELI - beli di '+lockShop+' untuk buka roll"' : ''} style="--tc:#9AA6B2;--bc:${bc}">${mounted?inner:''}</button>`;
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
  lazyMountGrid(document.getElementById("ixBody"),_ixHtml);
  ixLiveShimmer();
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
            <img src="${cardThumb(tgt.char)}" alt="" loading="lazy" decoding="async">
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
  _dpHtml={};
  b.innerHTML=`<label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="dpSearch" type="text" placeholder="Cari kartu…" autocomplete="off"></label><div class="dp-grid" id="dpGrid">${state.stacks.map((s,i)=>{
    const inner=`<img src="${cardThumb(s.char)}" alt="" loading="lazy" decoding="async">
      ${s.shiny||(s.mut&&s.mut!=="none")||(s.trait&&s.trait!=="none")?`<span class="dp-badges">${s.shiny?'<span class="shiny-badge shiny-pill">SHINY</span>':""}${s.mut&&s.mut!=="none"?mutChip(s.mut,mutPill(s.mut,'mut-badge dp-mut')):""}${s.trait&&s.trait!=="none"?traitChip(s.trait,`<span class="trait-badge dp-gem" style="border-color:${TRAIT_COLOR[s.trait]}">${traitGem(13,s.trait)}</span>`):""}</span>`:""}
      <span class="dp-name">${cardName(s.char)}</span>`;
    _dpHtml[s.id]=inner;const mounted=i<48;
    return `<button class="dp-card${isFullArt(s.char)?" fa":""}${s.id===selId?" sel":""}${s.mut&&s.mut!=="none"?(s.shiny?" dp-mut-shiny-"+s.mut:" dp-mut-"+s.mut):""}${s.shiny?" shiny":""}${mounted?"":" lz-ph"}" data-lz="${s.id}" data-tid="${s.id}" data-name="${cardName(s.char).toLowerCase()}">${mounted?inner:""}</button>`;}).join("")}</div><div class="no-result" id="dpSearch-nr">Tidak ada kartu yang cocok.</div>`;
  {const dps=document.getElementById("dpSearch");if(dps){dps.value=dpSearch;dps.oninput=()=>{dpSearch=dps.value;runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));};if(dpSearch)runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));}}
  b.querySelectorAll(".dp-card").forEach(el=>el.onclick=()=>{const tid=el.getAttribute("data-tid");sfx.hit();if(cardPickCfg){cardPickCfg.onPick(tid);}else{traitTarget=tid;closeDeckPick();renderTrait();}});
  lazyMountGrid(b.closest(".dp-box")||b,_dpHtml);
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
  coinSpend(TRAIT_COST);
  if(window.CloudDB && currentUser && tgt.id){
    const res = await CloudDB.traitRoll(currentUser, tgt.id);
    if(res && res.ok){
      const k = res.trait || "common";
      sfx.crit();
      if(TRAIT[k] && TRAIT[k].atk>=1.5){ save(); renderShell(); renderTrait(); showRarePrompt(k); }
      else { if(tgt) tgt.trait = k; save(); if(!battleLive()&&typeof render==="function")render(); renderTrait(); traitNotify(k); }
      return;
    }else{
      // rollback kalau gagal
      if(typeof coinGain === "function") coinGain(TRAIT_COST);
      else if(state) state.coins = (state.coins||0) + TRAIT_COST;
      if(typeof renderShell==="function") renderShell();
      autoToast(res && res.msg ? res.msg : "TRAIT ROLL GAGAL");
      return;
    }
  }
  const k=rollTraitPick();
  sfx.crit();
  if(TRAIT[k] && TRAIT[k].atk>=1.5){ save(); renderShell(); renderTrait(); showRarePrompt(k); }
  else { tgt.trait=k; save(); if(!battleLive()&&typeof render==="function")render(); renderTrait(); traitNotify(k); }
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
function saveRare(){const k=pendingRare;autoStop();pendingRareAuto=false;const tgt=traitTargetStack();if(tgt&&k)tgt.trait=k;pendingRare=null;closeRarePrompt();save();if(!battleLive()&&typeof render==="function")render();renderTrait();if(k)traitNotify(k);}
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
function stopAutoRoll(){autoStop();renderTrait();if(!battleLive()&&typeof render==="function")render();}
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
  coinSpend(TRAIT_COST);autoRollN++;
  if(window.CloudDB && currentUser && tgt.id){
    CloudDB.traitRoll(currentUser, tgt.id).then(res=>{
      if(!res || !res.ok){
        if(typeof coinGain === "function") coinGain(TRAIT_COST); else if(state) state.coins = (state.coins||0)+TRAIT_COST;
        stopAutoRoll(); save(); renderShell(); autoToast(res && res.msg ? res.msg : "AUTO ROLL STOP · ERROR"); return;
      }
      const k = res.trait || "common";
      if(autoRollN%10===0)sfx.crit();
      if(autoTargets.has(k)){tgt.trait=k;autoStop();save();if(!battleLive()&&typeof render==="function")render();renderTrait();traitNotify(k);return;}
      tgt.trait=k;
      if(autoRollN%10===0)save();
      autoPaint();
      traitUiRefresh();
      traitFxTick(k);
      autoRollTimer=setTimeout(autoTick,AUTO_TICK);
    }).catch(()=>{
      if(typeof coinGain === "function") coinGain(TRAIT_COST); else if(state) state.coins = (state.coins||0)+TRAIT_COST;
      stopAutoRoll(); save(); renderShell(); autoToast("AUTO ROLL STOP · ERROR"); 
    });
    return;
  }
  const k=rollTraitPick();
  if(autoRollN%10===0)sfx.crit(); // sfx ditahan tiap 10 roll biar gak nembak terus di 100ms
  if(autoTargets.has(k)){tgt.trait=k;autoStop();save();if(!battleLive()&&typeof render==="function")render();renderTrait();traitNotify(k);return;} // TARGET KENA → simpan + stop
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

