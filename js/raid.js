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
function wbOnline(){return !!((typeof currentUser!=="undefined"&&currentUser)&&window.CloudDB&&typeof window.CloudDB.wbState==="function");}
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
   skill:"Galaxy Roar",mod:"GRAVITY SURGE",art:"assets/raid/eternal-dragon-hd.webp",alt:false,
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
  const cgF=document.getElementById("cgHpFill");if(cgF)cgF.style.width=Math.max(0,Math.min(100,pct)).toFixed(2)+"%";
  const cgV=document.getElementById("cgHpValues");if(cgV)cgV.innerHTML=`<b>${fmtBig(left)}</b> / ${fmtBig(pool)} HP (${pct.toFixed(1)}%)`;
  const ab=document.getElementById("attBadge");if(ab)ab.textContent=wbAttLabel();
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

/* Helper format leaderboard rows like prototype */
function renderLbRowsFromData(){
  const d=wbData();
  const top=(d&&d.top)||[];
  if(!top.length){
    const mockHunters = [
      { rank: 1, name: "Sung_Monarch", title: "Shadow Sovereign", dmg: 142800000000 },
      { rank: 2, name: "Kuro_Cyber", title: "Void Blade", dmg: 119500000000 },
      { rank: 3, name: "Aether_Strike", title: "Grand Marshall", dmg: 98200000000 },
      { rank: 4, name: "Valkyrie_7", title: "Apex Vanguard", dmg: 76400000000 },
      { rank: 5, name: "Ghost_Rider", title: "Abyss Stalker", dmg: 54100000000 }
    ];
    return mockHunters.map((h, i)=>{
      const rankClass = i===0 ? 'top1' : i===1 ? 'top2' : i===2 ? 'top3' : '';
      return `
      <div class="lb-hunter-item">
        <div class="lb-hunter-left">
          <span class="lb-rank-num ${rankClass}">${h.rank}</span>
          <div>
            <div class="lb-hunter-name">${h.name}</div>
            <small style="color:var(--text-muted);font-size:11px;">Title: ${h.title}</small>
          </div>
        </div>
        <div class="lb-hunter-dmg">${fmtBig(h.dmg)}</div>
      </div>`;
    }).join("");
  }
  return top.slice(0, 6).map((h, i)=>{
    const rankClass = i===0 ? 'top1' : i===1 ? 'top2' : i===2 ? 'top3' : '';
    return `
    <div class="lb-hunter-item">
      <div class="lb-hunter-left">
        <span class="lb-rank-num ${rankClass}">${i+1}</span>
        <div>
          <div class="lb-hunter-name">${h.name || 'Hunter'}</div>
          <small style="color:var(--text-muted);font-size:11px;">Title: ${h.title || 'Solo Hunter'}</small>
        </div>
      </div>
      <div class="lb-hunter-dmg">${fmtBig(h.dmg || h.score || 0)}</div>
    </div>`;
  }).join("");
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
  const threatTag=pct<15?"CRITICAL":pct<40?"WARNING":"STABLE";
  const tok=state.wbTokens||0;

  const cardItems=WB_SHOP.filter(x=>x.card);
  const bossTotal=cardItems.length,bossCount=cardItems.filter(x=>bossRollUnlocked(x.card.char)).length;

  let claimBtn="";
  if(y&&y.claimed)claimBtn=`<div style="margin-top:6px;text-align:center;font-size:11px;color:#4ade80;font-family:var(--font-mono);padding:4px;background:rgba(74,222,128,0.1);border-radius:4px;border:1px solid rgba(74,222,128,0.3);">KLAIM KEMARIN &#10004;</div>`;
  else if(y&&y.claimable)claimBtn=`<button class="wbr-claim" id="wbClaim" type="button" style="margin-top:6px;width:100%;padding:7px;border-radius:6px;background:linear-gradient(135deg,rgba(0,240,255,0.3),rgba(168,85,247,0.3));border:1px solid #00f0ff;color:#fff;font-family:var(--font-display);font-size:11px;cursor:pointer;">KLAIM ${y.gems||0} GEM · ${fmt(y.tokens||0)} TOKEN</button>`;

  const modTxt=locked?b.mod:(wbModText()||b.mod);

  app.innerHTML=`
  <!-- Atmospheric Cyber Abyss Layers -->
  <div class="cyber-abyss-bg"></div>
  <div class="cyber-grid"></div>
  <div class="cyber-scanlines"></div>

  <div class="app-viewport">
    
    <!-- Top System Telemetry Bar -->
    <header class="proto-top-nav">
      <div class="system-title-tag">
        <div class="system-icon-pulse"></div>
        <div class="system-label-text">
          SYSTEM: <b>HUNTER RAID MATRIX</b> // <span class="monarch-tag">MONARCH S-RANK GATE</span>
        </div>
      </div>

      <!-- Navigation Pills -->
      <div class="proto-tab-pills">
        <button class="proto-tab-btn" id="raidLobby" type="button" title="Kembali ke Lobby">
          ◀ LOBBY
        </button>
        <button class="proto-tab-btn active" id="tabHub" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          WORLD BOSS COMMAND
        </button>
        <button class="proto-tab-btn" id="raidShopBtn" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          SHADOW HUNTER ARMORY
        </button>
      </div>

      <!-- Live Token & Cores Telemetry -->
      <div class="live-currencies">
        <div class="currency-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg>
          <div class="label">WB TOKEN:</div>
          <div class="value" id="dispToken">${fmt(tok)}</div>
        </div>
        <div class="currency-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <div class="label">CORES:</div>
          <div class="value" style="color:var(--monarch-purple);" id="dispCores">${bossCount} / ${bossTotal}</div>
        </div>
      </div>
    </header>

    <!-- Main Command Hub View (Full-Bleed 1-Screen) -->
    <main class="view-stage active" id="viewHub">
      <div class="wb-hub-grid">
        
        <!-- LEFT: BOSS ARENA STAGE WITH 4 BRACKETS & 3D HOLOGRAM -->
        <section class="wb-stage-arena" id="wbrStage">
          <div class="corner-bracket tl"></div>
          <div class="corner-bracket tr"></div>
          <div class="corner-bracket bl"></div>
          <div class="corner-bracket br"></div>

          <!-- Stage Header: Warning & Boss Switcher Tabs -->
          <div class="wb-arena-header">
            <div class="calamity-warning-tag">
              <span class="warn-icon">⚠</span>
              <span>${locked ? 'SEGERA TERSEDIA' : 'CALAMITY CLASS: S-RANK THREAT'}</span>
            </div>

            <div class="wb-boss-switcher">
              <button class="wb-boss-tab ${wbBossIdx===0?'active':''}" id="btnBoss0" type="button" onclick="goBoss(0 - wbBossIdx)">
                01 // ETERNAL DRAGON
              </button>
              <button class="wb-boss-tab ${wbBossIdx===1?'active':''}" id="btnBoss1" type="button" onclick="goBoss(1 - wbBossIdx)">
                02 // SHADOW KING
              </button>
            </div>
          </div>

          <!-- 3D Perspective Floor & Concentric Pedestal Rings -->
          <div class="wbr-floor"></div>
          <div class="wbr-ped-rings">
            <div class="wbr-ped-ring"></div>
            <div class="wbr-ped-ring inner"></div>
            <div class="wbr-ped-ring core"></div>
            <div class="wbr-holo-burst" id="holoBurst"></div>
          </div>

          <!-- 3D Swipe Stage Chevrons -->
          <button class="wbr-stage-arrow wbr-arrow-prev" id="btnArrowPrev" type="button" onclick="goBoss(-1)" title="Previous Boss (3D Swipe)" aria-label="Previous Boss">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span class="wbr-arrow-label">PREV</span>
          </button>
          <button class="wbr-stage-arrow wbr-arrow-next" id="btnArrowNext" type="button" onclick="goBoss(1)" title="Next Boss (3D Swipe)" aria-label="Next Boss">
            <span class="wbr-arrow-label">NEXT</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>

          <!-- Tactical Swipe Guide Hint -->
          <div class="wbr-swipe-hint">
            <span class="hint-chevron">❮</span>
            <span>DRAG / SWIPE 3D CARD</span>
            <span class="hint-chevron">❯</span>
          </div>

          <!-- 3D Holographic Boss Card Chamber -->
          <div class="wbr-c3d-wrap" id="bossCardWrap">
            <div class="wbr-c3d" id="bossCard3d">
              <div class="wbr-c3d-float">
                <!-- Physical Card 3D Thickness Layers -->
                <div class="wbr-c3d-l wbr-c3d-back b4"></div>
                <div class="wbr-c3d-l wbr-c3d-back b3"></div>
                <div class="wbr-c3d-l wbr-c3d-back b2"></div>
                <div class="wbr-c3d-l wbr-c3d-back b1"></div>

                <!-- Main Artwork -->
                <div class="wbr-c3d-l wbr-c3d-art">
                  <img id="bossImg" 
                       src="${b.art}" 
                       alt="${b.name}" 
                       onerror="this.src='assets/cards/art/eternal-dragon.webp'">
                </div>

                <!-- Gradient Shadow Veil -->
                <div class="wbr-c3d-l wbr-c3d-veil"></div>

                <!-- 3D Cyber Frame & 4 Glowing Corner Brackets -->
                <div class="wbr-c3d-l wbr-c3d-frame">
                  <i></i><i></i><i></i><i></i>
                </div>

                <!-- 3D Floating Labels & Badges -->
                <div class="wbr-c3d-l wbr-c3d-label">
                  <div class="wbr-c3d-top-tag">
                    <span class="dot"></span>
                    <span id="cardTopTag">EX // CALAMITY CLASS</span>
                  </div>
                  <div class="wbr-c3d-bottom-info">
                    <span class="kicker" id="cardKicker">${b.tag || 'ANCIENT MONARCH SOVEREIGN'}</span>
                    <span class="title" id="cardTitle">${b.name}</span>
                    <span class="meta" id="cardMeta">${locked ? 'TERKUNCI' : fmtBig(pool) + ' SHARED CALAMITY POOL'}</span>
                  </div>
                </div>

                <!-- Dynamic Holographic Foil Shimmer -->
                <div class="wbr-c3d-l wbr-c3d-foil"></div>

                <!-- Specular Reflection Glass -->
                <div class="wbr-c3d-l wbr-c3d-glass"></div>
              </div>
            </div>
            <!-- 3D Projected Floor Shadow -->
            <div class="wbr-c3d-shadow"></div>
          </div>

          <!-- Stage Footer: Boss Identity & Calamity HP Gauge -->
          <div class="wb-arena-footer">
            <div class="wb-boss-meta-row">
              <div class="wb-boss-name-group">
                <div class="boss-subtitle" id="bossSubtitle">ANCIENT MONARCH CALAMITY // EX CORE</div>
                <h2 id="bossName">${b.name} <small style="font-size:14px;color:var(--monarch-purple);">${b.tag || ''}</small></h2>
              </div>
              <div class="wb-boss-tags">
                <span class="wb-boss-tag" id="bossSkillTag">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  SKILL: ${b.skill}
                </span>
                <span class="wb-boss-tag mod" id="bossModTag">MOD: ${modTxt}</span>
                <span class="wb-boss-tag timer">RESET ${wbResetText()}</span>
              </div>
            </div>

            <!-- Calamity HP Bar -->
            <div class="calamity-gauge-wrapper">
              <div class="cg-telemetry-row">
                <div class="hp-label">
                  <span class="warn-icon">⚡</span>
                  <span id="cgLabel">GLOBAL THREAT LEVEL: ${locked ? 'STANDBY' : threatTag}</span>
                </div>
                <div class="hp-numbers" id="cgHpValues">
                  <b>${locked ? '—' : fmtBig(poolLeft)}</b> / ${locked ? '—' : fmtBig(pool)} HP (${locked ? '100%' : pct.toFixed(1) + '%'})${pool - poolLeft > 0 ? ' · TERKIKIS ' + fmtBig(pool - poolLeft) : ''}
                </div>
              </div>
              <div class="calamity-bar-track">
                <div class="calamity-bar-fill" id="cgHpFill" style="width: ${locked ? 100 : Math.max(0, Math.min(100, pct)).toFixed(2)}%;"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- RIGHT: HUNTER CONSOLE & ACTIONS (ZERO EMPTY SPACE) -->
        <aside class="wb-console-rail">
          
          <!-- Panel 1: Strike Authorization & Stats -->
          <div class="tactical-panel">
            <div class="tactical-panel-hdr">
              <div class="title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                STRIKE AUTHORIZATION
              </div>
              <div class="badge" id="attBadge">${locked ? "—" : (attLeft||0) + " / 3 ATTEMPTS"}</div>
            </div>
            
            <div class="strike-crystals-row">
              <div class="strike-crystal ${!locked && (attLeft||0) >= 1 ? 'active' : ''}"><span>CRYSTAL 01</span></div>
              <div class="strike-crystal ${!locked && (attLeft||0) >= 2 ? 'active' : ''}"><span>CRYSTAL 02</span></div>
              <div class="strike-crystal ${!locked && (attLeft||0) >= 3 ? 'active' : ''}"><span>CRYSTAL 03</span></div>
            </div>

            <div class="strike-stats-grid">
              <div class="strike-stat-box">
                <div class="stat-label">PERSONAL BEST</div>
                <div class="stat-val gold">${wbBest ? fmtBig(wbBest) : "—"}</div>
              </div>
              <div class="strike-stat-box">
                <div class="stat-label">GLOBAL RANK</div>
                <div class="stat-val cyan">${rank ? "#" + rank + (totalPlayers ? "/" + totalPlayers : "") : "—"}</div>
              </div>
              <div class="strike-stat-box">
                <div class="stat-label">CYCLE LIMIT</div>
                <div class="stat-val"> TURNS</div>
              </div>
              <div class="strike-stat-box">
                <div class="stat-label">THREAT STATUS</div>
                <div class="stat-val" style="color:${threatTag==='CRITICAL'?'#ff2a5f':threatTag==='WARNING'?'#fbbf24':'#4ade80'};">${locked ? "STANDBY" : threatTag}</div>
              </div>
            </div>
            ${claimBtn}
          </div>

          <!-- Panel 2: Reward Track (Harian) -->
          <div class="tactical-panel">
            <div class="tactical-panel-hdr">
              <div class="title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                REWARD TRACK // HARIAN
              </div>
              <div class="badge" style="color:var(--monarch-purple);">DAILY CYCLE</div>
            </div>

            <div class="reward-track-list">
              <div class="reward-track-item rank1">
                <span class="reward-track-pill">#1</span>
                <div class="reward-track-info">
                  <span class="reward-track-name">JUARA HARIAN</span>
                  <span class="reward-track-val">1.000 GEM · 10K TOK</span>
                </div>
              </div>
              <div class="reward-track-item rank2">
                <span class="reward-track-pill">#2</span>
                <div class="reward-track-info">
                  <span class="reward-track-name">RUNNER-UP</span>
                  <span class="reward-track-val">500 GEM · 5K TOK</span>
                </div>
              </div>
              <div class="reward-track-item rank3">
                <span class="reward-track-pill">#3</span>
                <div class="reward-track-info">
                  <span class="reward-track-name">TOP 3</span>
                  <span class="reward-track-val">250 GEM · 2.5K TOK</span>
                </div>
              </div>
              <div class="reward-track-item rankAll">
                <span class="reward-track-pill">ALL</span>
                <div class="reward-track-info">
                  <span class="reward-track-name">PARTISIPAN</span>
                  <span class="reward-track-val">100 GEM · 1K TOK</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel 3: Live Hunter Standings -->
          <div class="tactical-panel" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
            <div class="tactical-panel-hdr">
              <div class="title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                TOP RAID HUNTERS (TODAY)
              </div>
              <button class="badge" id="wbTopAll" type="button" style="cursor:pointer;border:none;">${hunters} ACTIVE HUNTERS ↗</button>
            </div>

            <div class="lb-hunter-list" id="wbrTop" style="flex: 1; min-height: 0; overflow-y: auto;">
              ${renderLbRowsFromData()}
            </div>
          </div>

          <!-- Action Dock -->
          <div class="wb-action-dock">
            <button class="btn-enter-shop" id="raidShopBtnBottom" type="button">
              <small>EXCHANGE DEPOT</small>
              HUNTER ARMORY
            </button>
            <button class="btn-strike-deploy ${dead||locked?'dead':''}" id="raidGo" type="button" ${dead||locked?'disabled':''}>
              <small>${locked ? "TERKUNCI" : dead ? "TIDAK BISA DEPLOY" : "AUTHORIZE COMBAT // 20 TURNS"}</small>
              ${locked ? "BUKA SETELAH UPDATE" : dead ? "ATTEMPT HABIS" : "INITIALIZE STRIKE ▶"}
            </button>
          </div>
        </aside>

      </div>
    </main>
  </div>`;

  // Action listeners
  document.getElementById("raidGo").onclick=()=>{
    if(locked){raidToast("BOSS INI BELUM TERSEDIA");return;}
    if(poolLeft<=0){raidToast("WORLD BOSS SUDAH TUMBANG · RESET 00:00 WIB");return;}
    if(wbOnline()&&d&&(d.attempts_left||0)<=0){raidToast("ATTEMPT HARI INI HABIS · RESET 00:00 WIB");return;}
    wbrDeployPulse(()=>{sfx.hit();raidView="pick";renderRaid();});
  };
  document.getElementById("raidShopBtn").onclick=()=>{sfx.hit();raidView="shop";renderRaid();};
  {const rsb=document.getElementById("raidShopBtnBottom");if(rsb)rsb.onclick=()=>{sfx.hit();raidView="shop";renderRaid();};}
  {const wc=document.getElementById("wbClaim");if(wc)wc.onclick=wbClaim;}
  {const ta=document.getElementById("wbTopAll");if(ta)ta.onclick=()=>{sfx.hit();if(typeof openRanking==="function")openRanking(b.board);else raidToast("Papan peringkat belum tersedia");};}
  {const rl=document.getElementById("raidLobby");if(rl)rl.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};}
  {const pv=document.getElementById("btnArrowPrev");if(pv)pv.onclick=()=>goBoss(-1);}
  {const nx=document.getElementById("btnArrowNext");if(nx)nx.onclick=()=>goBoss(1);}

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
/* ---------- ganti boss (3D Directional Swipe / panah / swipe / dot) ---------- */
let wbrSwapping=false;
function goBoss(dir){
  const n=WB_BOSSES.length;
  if(wbrSwapping||n<2)return;
  const next=((wbBossIdx+dir)%n+n)%n;
  if(next===wbBossIdx)return;
  try{sfx.hit();}catch(e){}
  const card=document.getElementById("bossCard3d");
  const burst=document.getElementById("holoBurst");

  if(wbReduceMotion()||!card){
    wbBossIdx=next;
    renderRaidHub();
    return;
  }

  wbrSwapping=true;
  const exitClass=dir>0?"swipe-exit-left":"swipe-exit-right";
  const enterClass=dir>0?"swipe-enter-right":"swipe-enter-left";

  card.className="wbr-c3d "+exitClass;

  setTimeout(()=>{
    wbBossIdx=next;
    renderRaidHub();
    const newCard=document.getElementById("bossCard3d");
    const newBurst=document.getElementById("holoBurst");
    if(newBurst){
      newBurst.classList.remove("pulse");
      void newBurst.offsetWidth;
      newBurst.classList.add("pulse");
    }
    if(newCard){
      newCard.className="wbr-c3d "+enterClass;
      setTimeout(()=>{
        newCard.className="wbr-c3d";
        newCard.style.transform="";
        wbrSwapping=false;
      }, 420);
    }else{
      wbrSwapping=false;
    }
  }, 320);
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
/* ---------- bind stage: real-time 3D drag physics & swipe gesture ---------- */
function wbrBindStage(){
  const stage=document.getElementById("wbrStage");
  const cardWrap=document.getElementById("bossCardWrap");
  const card=document.getElementById("bossCard3d");
  if(!stage||!cardWrap||!card)return;

  let isPointerDown=false, startX=0, startY=0, dragDistX=0, hasDragged=false;

  cardWrap.addEventListener("pointerdown", e=>{
    if(wbrSwapping)return;
    if(e.target&&e.target.closest&&e.target.closest("button"))return;
    isPointerDown=true;
    hasDragged=false;
    startX=e.clientX;
    startY=e.clientY;
    dragDistX=0;
    try{cardWrap.setPointerCapture(e.pointerId);}catch(err){}
    card.style.transition="none";
  });

  cardWrap.addEventListener("pointermove", e=>{
    if(!isPointerDown||wbrSwapping)return;
    const dx=e.clientX-startX;
    const dy=e.clientY-startY;
    if(Math.abs(dx)>6||Math.abs(dy)>6)hasDragged=true;
    if(hasDragged){
      dragDistX=dx;
      const rotY=Math.max(-46, Math.min(46, dx*0.15));
      const rotZ=Math.max(-8, Math.min(8, dx*0.03));
      const transZ=-Math.min(190, Math.abs(dx)*0.55);
      const scale=Math.max(0.82, 1-Math.abs(dx)*0.0006);
      card.style.transform=`translateX(${dx}px) translateZ(${transZ}px) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`;
      card.style.filter=`brightness(${1+Math.abs(dx)*0.0018}) drop-shadow(0 0 ${Math.min(40, Math.abs(dx)*0.3)}px rgba(0, 240, 255, 0.45))`;
    }
  });

  const endDrag=e=>{
    if(!isPointerDown)return;
    isPointerDown=false;
    try{cardWrap.releasePointerCapture(e.pointerId);}catch(err){}
    if(wbrSwapping)return;
    card.style.filter="";
    if(hasDragged&&Math.abs(dragDistX)>65){
      const dir=dragDistX<0?1:-1;
      card.style.transition="";
      goBoss(dir);
    } else {
      card.style.transition="transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)";
      card.style.transform="translateX(0px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)";
      setTimeout(()=>{
        if(!isPointerDown&&!wbrSwapping){card.style.transition="";}
      }, 400);
    }
  };

  cardWrap.addEventListener("pointerup", endDrag);
  cardWrap.addEventListener("pointercancel", endDrag);

  // Normal mousemove parallax tilt when not dragging
  stage.addEventListener("mousemove", e=>{
    if(isPointerDown||wbrSwapping)return;
    const rect=stage.getBoundingClientRect();
    const x=((e.clientX-rect.left)/rect.width-0.5)*2;
    const y=((e.clientY-rect.top)/rect.height-0.5)*2;
    const rx=(-y*14).toFixed(2);
    const ry=(x*16).toFixed(2);
    const dx=(x*12).toFixed(1);
    card.style.setProperty("--rx", rx+"deg");
    card.style.setProperty("--ry", ry+"deg");
    card.style.setProperty("--dx", dx+"px");
  });

  stage.addEventListener("mouseleave", ()=>{
    if(isPointerDown||wbrSwapping)return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--dx", "0px");
  });
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
      return `<div class="bp-tile${c.fullArt?' fa':''}${mounted?'':' lz-ph'}" data-lz="${s.id}" data-sid="${s.id}" data-pick="${s.id}" data-name="${c.name.toLowerCase()}" style="--tcol:${(s.tier&&TIER_COLOR[s.tier])||'var(--line2)'}">${mounted?_rd[s.id]:''}</div>`;
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
        <div class="stat-row"><div class="stat hp"><i>HP</i> <b>${fmtStat(b.hp)}</b></div><div class="stat atk"><i>ATK</i> <b>${fmtStat(999999)}</b></div></div>
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
/* =============== TOKO RAID: 300PX HORIZONTAL SHELF (ANTI-LUBER) =============== */
window.raidShopFilter = window.raidShopFilter || "all";

function renderRaidShop(){
  const tok=state.wbTokens||0;

  const cardItems=WB_SHOP.filter(x=>x.card);
  const bossTotal=cardItems.length,bossCount=cardItems.filter(x=>bossRollUnlocked(x.card.char)).length;

  const ITEMS=WB_SHOP.map(it=>{
    let cat="potion", catLabel="POTION", tier="SPEC", accent="#00f0ff", art="assets/images/pot-luck-1.webp";

    if(it.id==="gem"){
      cat="currency"; catLabel="EXCHANGE"; tier="GEM"; accent="#ffd700"; art="assets/images/premium-currency.webp";
    } else if(it.id==="coins"){
      cat="currency"; catLabel="CREDITS"; tier="COINS"; accent="#ffd27a"; art="assets/images/coins.webp";
    } else if(it.id==="card_edragon"){
      cat="ex-core"; catLabel="EX CORE"; tier="EX-CH"; accent="#00f0ff"; art="assets/raid/eternal-dragon-hd.webp";
    } else if(it.id==="card_shadowking"){
      cat="ex-core"; catLabel="EX CORE"; tier="EX-CH"; accent="#a855f7"; art="assets/cards/art/shadow-king.webp";
    } else if(it.id.startsWith("helm")){
      cat="relic"; catLabel="RELIC GEAR"; tier="MYTHIC"; accent="#ffb703"; art="assets/artifacts/abyss-helm.webp";
    } else if(it.id.includes("wisp")){
      cat="relic"; catLabel="FAMILIAR"; tier="COSMIC"; accent="#7df9ff"; art="assets/pets/nebula-wisp.webp";
    } else if(it.id.includes("luck")){
      cat="potion"; catLabel="AUGMENT"; tier="MK-"+it.id.replace("luck",""); accent="#4ade80"; art="assets/images/pot-luck-"+it.id.replace("luck","")+".webp";
    } else if(it.id.includes("speed")){
      cat="potion"; catLabel="OVERCLOCK"; tier="MK-"+it.id.replace("speed",""); accent="#fbbf24"; art="assets/images/pot-speed-"+it.id.replace("speed","")+".webp";
    }

    return {
      id: it.id,
      name: it.name.toUpperCase(),
      desc: it.desc,
      cost: it.cost,
      cat,
      catLabel,
      tier,
      accent,
      art,
      it
    };
  });

  const filter = window.raidShopFilter;
  const filtered = ITEMS.filter(it => filter === "all" || it.cat === filter);

  app.innerHTML=`
  <!-- Atmospheric Cyber Abyss Layers -->
  <div class="cyber-abyss-bg"></div>
  <div class="cyber-grid"></div>
  <div class="cyber-scanlines"></div>

  <div class="app-viewport">
    
    <!-- Top System Telemetry Bar -->
    <header class="proto-top-nav">
      <div class="system-title-tag">
        <div class="system-icon-pulse"></div>
        <div class="system-label-text">
          SYSTEM: <b>HUNTER RAID MATRIX</b> // <span class="monarch-tag">SHADOW HUNTER ARMORY</span>
        </div>
      </div>

      <!-- Navigation Pills -->
      <div class="proto-tab-pills">
        <button class="proto-tab-btn" id="raidShopBack" type="button" title="Kembali ke World Boss">
          ◀ WORLD BOSS
        </button>
        <button class="proto-tab-btn" id="tabHub" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          WORLD BOSS COMMAND
        </button>
        <button class="proto-tab-btn active" id="tabShop" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          SHADOW HUNTER ARMORY
        </button>
      </div>

      <!-- Live Token & Cores Telemetry -->
      <div class="live-currencies">
        <div class="currency-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h6"/></svg>
          <div class="label">WB TOKEN:</div>
          <div class="value" id="dispToken">${fmt(tok)}</div>
        </div>
        <div class="currency-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <div class="label">CORES:</div>
          <div class="value" style="color:var(--monarch-purple);" id="dispCores">${bossCount} / ${bossTotal}</div>
        </div>
      </div>
    </header>

    <!-- Main Shop View Container (Zero Luber / Isolated) -->
    <main class="view-stage active" id="viewShop">
      <div class="shop-view-container">
        
        <!-- Controls Bar & Category Filter Pills -->
        <div class="shop-controls-bar">
          <div class="shop-cat-tabs" id="shopCatBar">
            <button class="shop-cat-btn ${filter==='all'?'active':''}" data-cat="all">ALL SUPPLIES (${ITEMS.length})</button>
            <button class="shop-cat-btn ${filter==='ex-core'?'active':''}" data-cat="ex-core">EX CORES (BOSS)</button>
            <button class="shop-cat-btn ${filter==='relic'?'active':''}" data-cat="relic">RELIC GEAR & PET</button>
            <button class="shop-cat-btn ${filter==='potion'?'active':''}" data-cat="potion">AUGMENT & SPEED</button>
            <button class="shop-cat-btn ${filter==='currency'?'active':''}" data-cat="currency">CREDITS & GEMS</button>
          </div>

          <div class="shop-matrix-tag">
            TRANSACTION MATRIX // INSTANT DELIVERY TO INVENTORY
          </div>
        </div>

        <!-- Horizontal Shelf Outer with Floating Nav Arrows -->
        <div class="shop-shelf-outer">
          <button class="shelf-arrow-btn left" id="shopScrollLeft" type="button" title="Scroll Kiri">◀</button>
          
          <div class="shop-inventory-scroll" id="shopTrack">
            ${filtered.map(it=>{
              const isOwned = !!((it.it.card && (stackHas(it.it.card.char, it.it.card.mut) || (state.raidShopOwned && state.raidShopOwned[it.it.card.char]))) || (it.it.owned && it.it.owned()));
              const canAfford = tok >= it.cost;
              const isBossCard = it.cat === "ex-core";
              const cardObj = it.it.card ? CARDS[it.it.card.char] : null;

              return `
              <div class="armory-300-card ${isOwned ? 'purchased' : ''}" style="--card-accent: ${it.accent}">
                <!-- Top Row Badges -->
                <div class="a3c-top-row">
                  <span class="a3c-cat-badge">${it.catLabel}</span>
                  <span class="a3c-tier-pill">${it.tier}</span>
                </div>

                <!-- AAA Holographic Chamber -->
                <div class="a3c-chamber ${isBossCard ? 'boss-card-frame' : ''}">
                  <div class="a3c-holo-foil"></div>
                  <div class="a3c-scanlines"></div>
                  <div class="a3c-rarity-crest">
                    <span>★</span>
                    <span>${it.tier}</span>
                  </div>
                  <img src="${it.art}" alt="${it.name}" onerror="this.onerror=null;this.src='assets/cards/art/eternal-dragon.webp'">
                  ${isOwned ? '<div class="a3c-owned-ribbon">✔ OWNED</div>' : ''}
                  <div class="a3c-card-barcode">${isBossCard ? 'SYS//MONARCH' : 'SYS//DEPOT'}</div>
                </div>

                <!-- Body: Title & Unclipped Multi-Line Details -->
                <div class="a3c-body">
                  <h3 class="a3c-title">${it.name}</h3>
                  <p class="a3c-desc">${it.desc}</p>
                  ${cardObj ? `
                    <div class="a3c-passive-box">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      <span>${cardObj.passive ? cardObj.passive.name + ': ' + cardObj.passive.desc : 'PASSIVE: ' + it.it.desc}</span>
                    </div>
                  ` : it.it.effect ? `
                    <div class="a3c-passive-box param">
                      <span>PARAM: ${it.it.effect}</span>
                    </div>
                  ` : `
                    <div class="a3c-passive-box param">
                      <span>PARAM: INSTANT SUPPLY DELIVERY</span>
                    </div>
                  `}
                </div>

                <!-- Footer: Price & Action -->
                <div class="a3c-footer">
                  <div class="a3c-price-box">
                    <span class="lbl">EXCHANGE PRICE</span>
                    <div class="val"><b>${fmt(it.cost)}</b> <small>TOKEN</small></div>
                  </div>
                  <button class="a3c-buy-btn ${isOwned ? 'purchased' : ''}" 
                          type="button" 
                          data-id="${it.id}"
                          ${isOwned || !canAfford ? 'disabled' : ''}>
                    ${isOwned ? '✔ TERBELI' : (!canAfford ? 'TOKEN DEFISIT' : 'ACQUIRE // TUKAR ▶')}
                  </button>
                </div>
              </div>
              `;
            }).join("")}
          </div>

          <button class="shelf-arrow-btn right" id="shopScrollRight" type="button" title="Scroll Kanan">▶</button>
        </div>

      </div>
    </main>
  </div>`;

  // Bind Navigation
  const rb=document.getElementById("raidShopBack");
  if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}raidView="hub";renderRaid();};
  const th=document.getElementById("tabHub");
  if(th)th.onclick=()=>{try{sfx.hit();}catch(e){}raidView="hub";renderRaid();};

  // Bind Category Filters
  const bar=document.getElementById("shopCatBar");
  if(bar){
    bar.querySelectorAll(".shop-cat-btn").forEach(btn=>{
      btn.onclick=()=>{
        const cat=btn.getAttribute("data-cat");
        if(cat && cat !== window.raidShopFilter){
          try{sfx.hit();}catch(e){}
          window.raidShopFilter=cat;
          renderRaidShop();
        }
      };
    });
  }

  // Bind Buy Buttons
  const track=document.getElementById("shopTrack");
  if(track){
    track.querySelectorAll(".a3c-buy-btn:not([disabled])").forEach(btn=>{
      btn.onclick=()=>{
        const id=btn.getAttribute("data-id");
        if(id) raidShopBuy(id);
      };
    });

    // Horizontal Mouse Wheel Scroll
    track.addEventListener("wheel", (e)=>{
      if(e.deltaY !== 0){
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // Bind Shelf Arrow Buttons
  const leftBtn=document.getElementById("shopScrollLeft");
  const rightBtn=document.getElementById("shopScrollRight");
  if(leftBtn && track){
    leftBtn.onclick=()=>{
      track.scrollBy({ left: -320, behavior: "smooth" });
    };
  }
  if(rightBtn && track){
    rightBtn.onclick=()=>{
      track.scrollBy({ left: 320, behavior: "smooth" });
    };
  }
}
