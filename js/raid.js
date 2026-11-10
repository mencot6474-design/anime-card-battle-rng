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
  {key:"a",id:"RAID_ETERNAL_DRAGON",board:"world_boss",name:"ETERNAL DRAGON",tab:"DRAGON",tag:"EX · WORLD BOSS",
   skill:"Galaxy Roar",mod:"GRAVITY SURGE",art:"assets/cards/art/eternal-dragon.webp",alt:false,
   holo:"#35F0FF",mag:"#FF3DAE",locked:false},
  {key:"b",id:"RAID_SHADOW_KING",board:"world_boss_b",name:"SHADOW KING",tab:"SHADOW",tag:"EX · WORLD BOSS",
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
/* Persembunyian chrome global (#topbar, #pwaInstallBtn) saat layar raid = TIKET P2:
   satu aturan CSS `body.on-raid:has(#wbView) #topbar, ... #pwaInstallBtn{display:none!important}`
   menang atas inline non-important tanpa observer body-wide (bayar di battle = salah
   tempat di HP lemah). JS ini HANYA menjaga anchor: body.on-raid + #wbView. */
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
  const meta=b.locked?"POOL INTACT · OPENS AFTER UPDATE":
    off?"LOG IN TO JOIN THE POOL COUNT":sync?
    (wbErr?"SERVER NOT READY — OFFLINE PLAY STILL WORKS":"MENGHUBUNGI SERVER…"):
    `${d.total_players||0} HUNTER · TODAY'S DAMAGE ${fmtBig(pool-left)}`;
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
/* Patch ringan 60 detik ke markup wbv2 (proto_wb_3d) — writer kedua setelah
   renderRaidHub/syncBossDOM pada id yang sama; tidak ada writer lain. */
function wbrPatch(){
  const d=wbData();
  const locked=!!wbBoss().locked;
  const {pool,left}=wbPoolVals();
  const pct=pool>0?left/pool*100:0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const f=document.getElementById("wbv2HpFill");
  if(f)f.style.width=locked?"0%":Math.max(0,Math.min(100,pct)).toFixed(1)+"%";
  set("wbv2HpLeft",locked?"—":fmtBig(left));set("wbv2HpPool",locked?"—":fmtBig(pool));
  set("wbv2HpNumLeft",locked?"—":fmtBig(left));set("wbv2HpNumPool",locked?"—":"/ "+fmtBig(pool));
  set("wbv2Reset","⟳ RESET "+wbResetText());
  const crys=document.getElementById("wbv2Crystals");if(crys)crys.innerHTML=wbCrystalsHtml();
  set("wbv2Pb",d&&d.best_dmg?fmtBig(d.best_dmg):"—");
  set("wbv2Tok",fmt(state.wbTokens||0));
  const rp=document.getElementById("wbv2LbPanelRows");if(rp)rp.innerHTML=wbLbPanelHtml();
  wbv2HammerState();
  const m=document.getElementById("wbv2LbModal");
  if(m&&m.classList.contains("show"))wbLbPaint();
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
/* ===== WB V2 — konstanta & helper markup prototipe _tmp/proto_wb_3d.html ===== */
function wbEsc(s){const v=String(s==null?"":s);return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
/* URL ikon untuk --im (CSS mask) — url() relatif dalam var() diselesaikan terhadap
   basis stylesheet, jadi selalu absolut dari dokumen. */
function wbIconU(p){try{return new URL(p,document.baseURI||location.href).href}catch(e){return p}}
/* Bracket reward HARIAN = cermin world_boss_bracket() dari
   supabase/migrations/0010_wb_reward_rebalance.sql — server satu-satunya otoritas
   payout; angka ini hanya cermin tampilan. */
const WBV2_BRACKETS=[
  {tag:"Top 1",gems:1000,tokens:10000,packs:10,title:"APEX SLAYER"},
  {tag:"Top 2",gems:500,tokens:5000,packs:5},
  {tag:"Top 3",gems:250,tokens:2500,packs:3},
  {tag:"Sisanya",gems:100,tokens:1000,packs:1}
];
function wbRewardPanelHtml(){
  return '<div class="wbv2-sp-title">DAILY REWARD</div>'+WBV2_BRACKETS.map(b=>
    `<div class="wbv2-rw-row"><span class="wbv2-rw-icon">${b.tag==="Top 1"?"&#9819;":"&#9679;"}</span><span class="wbv2-rw-label">${b.tag}</span><span class="wbv2-rw-val">+${fmt(b.gems)} Gem · +${fmt(b.tokens)} Tkn · ${b.packs}× Pack${b.title?" · "+b.title:""}</span></div>`
  ).join("");
}
/* Kristal attempt = wbAttOf (dibatasi 3, sama dengan kuota server attempts_used). */
function wbCrystalsHtml(){
  const n=Math.min(3,wbAttOf(wbBossIdx)||0);
  return [0,1,2].map(i=>`<span class="wbv2-cr${i<n?" wbv2-on":" wbv2-off"}"></span>`).join("");
}
function wbv2Dead(){
  const b=wbBoss(),{left}=wbPoolVals();
  const att=wbAttOf(wbBossIdx);
  return !!b.locked||left<=0||(att!=null&&att<=0);
}
function wbv2HammerState(){
  const b=wbBoss(),{left}=wbPoolVals();
  const att=wbAttOf(wbBossIdx),dead=wbv2Dead();
  const el=document.getElementById("wbv2Hammer");
  if(el){
    el.classList.toggle("off",dead||!!b.locked);
    el.textContent=b.locked?"TERKUNCI":dead?(att!=null&&att<=0?"ATTEMPTS USED":"BOSS DEFEATED"):"HAMBAT";
  }
  const hm=document.getElementById("wbv2HammerMeta");
  if(hm)hm.textContent=b.locked?"BOSS TERKUNCI":dead?(att!=null&&att<=0?"CANNOT DEPLOY · RESET "+wbResetText():"TARGET DEFEATED · RESET "+wbResetText()):`AUTHORIZE COMBAT // ${RAID_TURNS} TURNS`;
}
/* Panel TOP DAMAGE (kanan panggung) — data dari wbLbS (jalur get_leaderboard). */
function wbLbPanelHtml(){
  if(!wbOnline())return '<div class="wbv2-lb-row"><span class="wbv2-lb-name">LOG IN FOR GLOBAL BOARD</span></div>';
  if(wbLbS.busy&&!(wbLbS.rows||[]).length)return '<div class="wbv2-lb-row"><span class="wbv2-lb-name">MEMUAT…</span></div>';
  if(wbLbS.err)return '<div class="wbv2-lb-row"><span class="wbv2-lb-name">SERVER NOT RESPONDING</span></div>';
  const rows=(wbLbS.rows||[]).slice(0,5);
  if(!rows.length)return '<div class="wbv2-lb-row"><span class="wbv2-lb-name">NO HUNTERS YET</span></div>';
  return rows.map(r=>`<div class="wbv2-lb-row"><span class="wbv2-lb-rank${(Number(r.rank)||99)<=3?" wbv2-top":""}">${r.rank}</span><span class="wbv2-lb-name">${wbEsc(r.username)}</span><b class="wbv2-lb-dmg">${fmtBig(r.value)}</b></div>`).join("");
}

/* ---------- modal papan peringkat: SATU-satunya tempat papan (kontrak §2) ----------
   Data: jalur CloudDB.leaderboard (RPC get_leaderboard) yang sudah ada, per papan. */
const wbLbS={board:null,rows:null,me:null,busy:false,err:false};
function wbLbFetch(board){
  wbLbS.board=board;
  if(!(window.CloudDB&&typeof window.CloudDB.leaderboard==="function")){
    wbLbS.rows=null;wbLbS.busy=false;wbLbS.err=false;wbLbPaint();return;
  }
  wbLbS.busy=true;wbLbS.err=false;wbLbPaint();
  window.CloudDB.leaderboard(board,null,50,typeof currentUser!=="undefined"?currentUser:null)
    .then(res=>{
      wbLbS.busy=false;
      if(res&&res.ok!==false){wbLbS.rows=res.rows||[];wbLbS.me=res.me||null;}
      else{wbLbS.rows=null;wbLbS.err=true;}
    })
    .catch(()=>{wbLbS.busy=false;wbLbS.rows=null;wbLbS.err=true;})
    .finally(()=>{const rp0=document.getElementById("wbv2LbPanelRows");if(rp0)rp0.innerHTML=wbLbPanelHtml();const m=document.getElementById("wbv2LbModal");if(m&&m.classList.contains("show"))wbLbPaint();});
}
const WBV2_AV_PATH=/^assets\/[A-Za-z0-9._/-]+\.(webp|png|jpg|jpeg)$/;
function wbLbRowHtml(r,i,you){
  const v=Number(r.value)||0,max=wbLbS.rows.length?(Number(wbLbS.rows[0].value)||1):1;
  const name=wbEsc(r.username||"?");
  const avMeta=r.meta&&typeof r.meta.av==="string"&&WBV2_AV_PATH.test(r.meta.av)?r.meta.av:"";
  const avImg=avMeta?`<img src="${avMeta}" alt="" decoding="async" onerror="this.remove()">`:`<span>${wbEsc(String(r.username||"?").slice(0,1).toUpperCase())}</span>`;
  return `<div class="wbv2-frow${you?" wbv2-lb-kamu":""}"><span class="wbv2-dmbar" style="width:${Math.max(4,Math.min(100,v/max*100)).toFixed(1)}%"></span><span class="wbv2-rk">${r.rank||i+1}</span><span class="wbv2-av">${avImg}</span><span class="wbv2-nm">${name}</span><b class="wbv2-dm">${fmtBig(v)}</b></div>`;
}
/* Panggilan SATU-satunya yang menulis daftar papan — dipakai buka modal, pindah
   papan, patch 60s, dan fetch. Tidak ada writer kedua (cacat lama #wbrTop). */
function wbLbPaint(){
  const rp0=document.getElementById("wbv2LbPanelRows");if(rp0)rp0.innerHTML=wbLbPanelHtml();
  const body=document.getElementById("wbv2LbBody");
  if(!body)return;
  const meName=(typeof currentUser!=="undefined"&&currentUser)?String(currentUser).toLowerCase():"";
  const cur=wbBoss();
  document.querySelectorAll("#wbv2LbBoards .wbv2-lbb").forEach(x=>x.classList.toggle("on",x.dataset.board===wbLbS.board));
  let rewardHtml="";
  const d=wbData();
  const y=d&&d.yesterday;
  if(y&&y.claimed)rewardHtml=`<div class="wbv2-lb-reward"><span class="wbv2-rwi" style="--im:url('${wbIconU("assets/icons/check-mark.svg")}');--ic:var(--green)"></span><span class="wbv2-rwt">REWARD KEMARIN</span><b>TERKLAIM</b></div>`;
  else if(y&&y.claimable)rewardHtml=`<div class="wbv2-lb-reward"><span class="wbv2-rwi" style="--im:url('${wbIconU("assets/icons/gems.svg")}');--ic:var(--cyan)"></span><span class="wbv2-rwt">REWARD READY TO CLAIM</span><b>${fmt(y.gems||0)} GEM · ${fmt(y.tokens||0)} TOK</b><button class="wbv2-claim" id="wbv2LbClaim" type="button">CLAIM</button></div>`;
  else rewardHtml=`<div class="wbv2-lb-reward"><span class="wbv2-rwi" style="--im:url('${wbIconU("assets/icons/gems.svg")}');--ic:var(--muted)"></span><span class="wbv2-rwt">DAILY REWARD</span><b>${wbOnline()?"—":"LOG IN FOR COUNTS"}</b></div>`;
  const myRank=wbLbS.me&&wbLbS.me.rank?wbLbS.me.rank:(d&&d.rank?d.rank:null);
  const myVal=wbLbS.me&&wbLbS.me.value?wbLbS.me.value:(d&&d.best_dmg?d.best_dmg:null);
  const youHtml=`<div class="wbv2-lb-you"><span class="wbv2-yrk">KAMU</span><span class="wbv2-ypos">posisi <b>${myRank?"#"+myRank:"—"}</b></span><span class="wbv2-yd">${myVal?fmtBig(myVal):"—"}</span></div>`;
  const top3=(wbLbS.rows||[]).slice(0,3);
  const podHtml=top3.length>=3?`<div class="wbv2-podium">${[1,2,3].map(rk=>{
    const r=top3[rk-1];
    const avR=r&&r.meta&&typeof r.meta.av==="string"&&WBV2_AV_PATH.test(r.meta.av)?r.meta.av:"";
    return `<div class="wbv2-pod wbv2-pod${rk}"><div class="wbv2-pod-top"><span class="wbv2-pod-av">${avR?`<img src="${avR}" alt="" onerror="this.remove()">`:""}</span><span class="wbv2-pod-rk">${rk}</span></div><div class="wbv2-pod-plate"><span class="wbv2-pod-nm">${wbEsc(r&&r.username||"?")}</span><span class="wbv2-pod-val">${fmtBig(r?Number(r.value)||0:0)}</span></div></div>`;
  }).join("")}</div>`:"";
  let listHtml;
  if(!wbOnline())listHtml=`<div class="wbv2-empty"><span class="wbv2-wm"></span><div class="wbv2-big">OFFLINE</div><div class="wbv2-sm">Log in for the global board</div></div>`;
  else if(wbLbS.busy&&!wbLbS.rows)listHtml=`<div class="wbv2-empty"><div class="wbv2-big">MEMUAT…</div></div>`;
  else if(wbLbS.err)listHtml=`<div class="wbv2-empty"><div class="wbv2-big">SERVER NOT RESPONDING</div></div>`;
  else if(!wbLbS.rows||!wbLbS.rows.length)listHtml=`<div class="wbv2-empty"><span class="wbv2-wm"></span><div class="wbv2-big">NO HUNTERS YET</div><div class="wbv2-sm">JADI YANG PERTAMA DI PAPAN ${wbEsc(cur.name)}</div></div>`;
  else listHtml=wbLbS.rows.slice(0,50).map((r,i)=>wbLbRowHtml(r,i,meName&&String(r.username||"").toLowerCase()===meName)).join("");
  body.innerHTML=`${rewardHtml}${podHtml}${youHtml}<div class="wbv2-lb-list">${listHtml}</div>`;
  {const c=document.getElementById("wbv2LbClaim");if(c)c.onclick=()=>{wbLbClose();wbClaim();};}
}
function wbLbOpen(board){
  const m=document.getElementById("wbv2LbModal");
  if(!m)return;
  m.classList.add("show");m.setAttribute("aria-hidden","false");
  wbLbFetch(board||wbBoss().board);
}
function wbLbClose(){
  const m=document.getElementById("wbv2LbModal");
  if(!m)return;
  m.classList.remove("show");m.setAttribute("aria-hidden","true");
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
    raidToast(res&&res.msg==="ALREADY_CLAIMED"?"Yesterday's reward already claimed":"Failed to claim reward — try again");
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
  /* Anchor persembunyian chrome global (lihat catatan P2 di atas wbPoolVals):
     aturan CSS body.on-raid:has(#wbView) yang bekerja, JS hanya menjaga kelas. */
  document.body.classList.toggle("on-raid",route()==="#/raid");
  if(raidView!=="hub")wbrStopPoll(); else if(window.cgGameplayStop) window.cgGameplayStop();
  if(raidView==="pick")return renderRaidPick();
  if(raidView==="battle")return renderRaidBattle();
  if(raidView==="result")return renderRaidResult();
  if(raidView==="shop")return renderRaidShop();
  renderRaidHub();
}

/* ===== WB V2 HUB — port prototipe terkunci docs/prototypes/proto_wb_v1.html =====
   Kontrak: _tmp/wb_port_contract.md. Root tunggal #wbView.wbv2; semua kelas baru
   diprefix wbv2- (aturan CSS P2 di css/world-boss.css). Data 100% dari sumber nyata
   (WB_BOSSES, wbPoolVals/WB_POOL_HP, wbAttOf, RAID_TURNS, get_leaderboard, state.deck). */
let wbHubKeyHandler=null;
function renderRaidHub(){
  wbrStopPoll();
  wbSyncCur();
  const b=wbBoss();
  const locked=!!b.locked;
  const d=wbData();
  const {pool,left:poolLeft}=wbPoolVals();
  const pct=pool>0?Math.max(0,Math.min(100,poolLeft/pool*100)):0;
  const hpTxt=locked?"—":fmtBig(poolLeft);
  const poolTxt=locked?"—":fmtBig(pool);
  const off=!wbOnline();
  const tabs=WB_BOSSES.map((x,i)=>`<button class="wbv2-tab${i===wbBossIdx?" on":""}" type="button" data-i="${i}">${wbEsc(x.tab||x.name)}</button>`).join("");
  const boards=WB_BOSSES.map(x=>`<button class="wbv2-lbb${x.board===b.board?" on":""}" type="button" data-board="${x.board}">${wbEsc(x.tab||x.name)}</button>`).join("");
  app.innerHTML=`
  <div id="wbView" class="wbv2 rd-page">
    <div class="wbv2-bgfx" aria-hidden="true"><div class="wbv2-sweep"></div></div>
    <div class="wbv2-holorail left" aria-hidden="true"></div>
    <div class="wbv2-holorail right" aria-hidden="true"></div>

    <div class="wbv2-topbar">
      <div class="wbv2-tabs" id="wbv2Tabs">${tabs}</div>
      <div class="wbv2-pool">
        <span class="wbv2-pool-k">POOL</span><b id="wbv2HpLeft">${hpTxt}</b><span>/ <span id="wbv2HpPool">${poolTxt}</span></span>
        <span class="wbv2-sep"></span>
        <span class="wbv2-reset" id="wbv2Reset">${locked?"⟳ RESET —":"⟳ RESET "+wbResetText()}</span>
      </div>
    </div>

    <section class="wbv2-stage wbv2-bossarea">
      <div class="wbv2-ringwrap" aria-hidden="true"><i class="wbv2-ring wbv2-r1"></i><i class="wbv2-ring wbv2-r2"></i><i class="wbv2-ring wbv2-r3"></i></div>

      <aside class="wbv2-reward-panel" id="wbv2RewardPanel">${wbRewardPanelHtml()}</aside>

      <aside class="wbv2-lb-panel" id="wbv2LbPanel">
        <div class="wbv2-sp-title">TOP DAMAGE</div>
        <div id="wbv2LbPanelRows">${wbLbPanelHtml()}</div>
      </aside>

      <div class="wbv2-bossart" id="wbv2Art">
        <div class="wbv2-bossframe"><img id="wbv2BossImg" src="${b.art}" alt="${wbEsc(b.name)}"></div>
        <div class="wbv2-hp-overlay">
          <div class="wbv2-hp-name" id="wbv2BossName">${wbEsc(b.name)}</div>
          <div class="wbv2-hpbar"><i class="wbv2-hp-fill" id="wbv2HpFill" style="width:${locked?0:pct.toFixed(1)}%"></i></div>
          <div class="wbv2-hp-nums"><b id="wbv2HpNumLeft">${hpTxt}</b><span id="wbv2HpNumPool">${locked?"—":"/ "+poolTxt}</span></div>
        </div>
        <button class="wbv2-lb" id="wbv2LbBtn" type="button" aria-label="Leaderboard ${wbEsc(b.name)}" title="Leaderboard"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1"/></svg></button>
      </div>
    </section>

    <section class="wbv2-dock">
      <div class="wbv2-dock-rails" aria-hidden="true"><i class="wbv2-drail wbv2-drail-top"></i><i class="wbv2-drail wbv2-drail-bot"></i></div>
      <div class="wbv2-actrow">
        <span class="wbv2-crystals" id="wbv2Crystals">${wbCrystalsHtml()}</span>
        <span class="wbv2-dstats">
          <span class="wbv2-pill"><i class="wbv2-si" style="--im:url('${wbIconU("assets/icons/trophy-cup.svg")}');--ic:var(--gold)"></i><b id="wbv2Pb">${d&&d.best_dmg?fmtBig(d.best_dmg):"—"}</b><small class="wbv2-unit">DMG</small></span>
          <span class="wbv2-pill"><i class="wbv2-si" style="--im:url('${wbIconU("assets/icons/coins.svg")}');--ic:var(--cyan)"></i><b id="wbv2Tok">${fmt(state.wbTokens||0)}</b><small class="wbv2-unit">TKN</small></span>
        </span>
        <button class="wbv2-shopbtn" id="wbv2ShopBtn" type="button">TOKO</button>
        <button class="wbv2-hammer${wbv2Dead()?" off":""}" id="wbv2Hammer" type="button">${locked?"TERKUNCI":wbv2Dead()?(wbAttOf(wbBossIdx)!=null&&wbAttOf(wbBossIdx)<=0?"ATTEMPTS USED":"BOSS DEFEATED"):"HAMBAT"}</button>
      </div>
      <small class="wbv2-hammer-meta" id="wbv2HammerMeta">${locked?"BOSS TERKUNCI":wbv2Dead()?(wbAttOf(wbBossIdx)!=null&&wbAttOf(wbBossIdx)<=0?"CANNOT DEPLOY · RESET "+wbResetText():"TARGET DEFEATED · RESET "+wbResetText()):`AUTHORIZE COMBAT // ${RAID_TURNS} TURNS`}</small>
    </section>

    <div class="wbv2-lb-modal" id="wbv2LbModal" aria-hidden="true">
      <div class="wbv2-lb-head">
        <span class="wbv2-lb-title">PAPAN PERINGKIT</span>
        <div class="wbv2-lb-boards" id="wbv2LbBoards">${boards}</div>
        <button class="wbv2-lb-x" id="wbv2LbClose" type="button" aria-label="Tutup">&#10005;</button>
      </div>
      <div class="wbv2-lb-body" id="wbv2LbBody"></div>
    </div>
  </div>`;

  /* aspect-ratio pane art DI-SET JS dari ukuran natural art boss (kontrak §3, CROP 0). */
  const img=document.getElementById("wbv2BossImg");
  const setAR=()=>{const el=document.getElementById("wbv2Art");if(el&&img&&img.naturalWidth)el.style.setProperty("--ar",Math.round(img.naturalWidth/img.naturalHeight*1000)/1000);};
  img.onload=setAR;
  img.onerror=()=>{img.onerror=null;img.src="assets/cards/art/eternal-dragon.webp";};
  if(img.complete&&img.naturalWidth)setAR();

  document.getElementById("wbv2Tabs").onclick=e=>{
    const t=e.target.closest(".wbv2-tab");
    if(!t)return;
    const i=Number(t.dataset.i);
    if(i!==wbBossIdx)goBoss(i-wbBossIdx);
  };
  document.getElementById("wbv2Hammer").onclick=()=>{
    /* baca state LIVE (bukan closure render) — hub bisa tetap tampil setelah syncBossDOM ganti boss */
    const cb=wbBoss();
    if(cb.locked){raidToast("THIS BOSS IS NOT AVAILABLE YET");return;}
    const cp=wbPoolVals();
    if(cp.left<=0){raidToast("WORLD BOSS ALREADY DOWN · RESET "+wbResetText());return;}
    const cd=wbData();
    if(wbOnline()&&cd&&(cd.attempts_left||0)<=0){raidToast("ATTEMPTS USED TODAY · RESET "+wbResetText());return;}
    wbrDeployPulse(()=>{sfx.hit();raidView="pick";renderRaid();});
  };
  document.getElementById("wbv2LbBtn").onclick=()=>{try{sfx.hit();}catch(e){}wbLbOpen(wbBoss().board);};
  {const sb=document.getElementById("wbv2ShopBtn");if(sb)sb.onclick=()=>{try{sfx.hit();}catch(e){}raidView="shop";renderRaid();};}
  {const x=document.getElementById("wbv2LbClose");if(x)x.onclick=wbLbClose;}
  {const m=document.getElementById("wbv2LbModal");
   if(m)m.addEventListener("click",e=>{if(e.target===m)wbLbClose();});
   const bs=document.getElementById("wbv2LbBoards");
   if(bs)bs.onclick=e=>{const btn=e.target.closest(".wbv2-lbb");if(!btn)return;try{sfx.hit();}catch(e){}wbLbFetch(btn.dataset.board);};}
  if(!wbHubKeyHandler){
    wbHubKeyHandler=e=>{if(e.key==="Escape"){const m=document.getElementById("wbv2LbModal");if(m&&m.classList.contains("show"))wbLbClose();}};
    document.addEventListener("keydown",wbHubKeyHandler);
  }

  wbRefresh();
  wbrStartPoll();
  /* panel TOP DAMAGE real-time: muat papan boss aktif lewat jalur nyata. */
  if(wbOnline())wbLbFetch(b.board);
}
/* ---------- sinkron in-place saat ganti boss (satu-satunya writer pane) ---------- */
function syncBossDOM(){
  const b=wbBoss();
  const locked=!!b.locked;
  const d=wbData();
  const {pool,left:poolLeft}=wbPoolVals();
  const pct=pool>0?Math.max(0,Math.min(100,poolLeft/pool*100)):0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};

  document.querySelectorAll("#wbv2Tabs .wbv2-tab").forEach((t,i)=>t.classList.toggle("on",i===wbBossIdx));

  const img=document.getElementById("wbv2BossImg");
  if(img){
    const setAR=()=>{const el=document.getElementById("wbv2Art");if(el&&img.naturalWidth)el.style.setProperty("--ar",Math.round(img.naturalWidth/img.naturalHeight*1000)/1000);};
    img.onload=setAR;
    img.onerror=()=>{img.onerror=null;img.src="assets/cards/art/eternal-dragon.webp";};
    img.src=b.art;
    img.alt=b.name;
    if(img.complete&&img.naturalWidth)setAR();
  }
  set("wbv2BossName",b.name);
  const f=document.getElementById("wbv2HpFill");
  if(f&&!locked)f.style.width=pct.toFixed(1)+"%";
  if(locked&&f)f.style.width="0%";
  set("wbv2HpLeft",locked?"—":fmtBig(poolLeft));
  set("wbv2HpPool",locked?"—":fmtBig(pool));
  set("wbv2HpNumLeft",locked?"—":fmtBig(poolLeft));
  set("wbv2HpNumPool",locked?"—":"/ "+fmtBig(pool));
  set("wbv2Reset",locked?"⟳ RESET —":"⟳ RESET "+wbResetText());
  const crys=document.getElementById("wbv2Crystals");if(crys)crys.innerHTML=wbCrystalsHtml();
  set("wbv2Pb",d&&d.best_dmg?fmtBig(d.best_dmg):"—");
  const lk=document.getElementById("wbv2LbBtn");if(lk)lk.setAttribute("aria-label","Leaderboard "+b.name);
  const rp=document.getElementById("wbv2LbPanelRows");if(rp)rp.innerHTML=wbLbPanelHtml();
  wbv2HammerState();
  /* papan per-boss: panel + modal ikut papan boss baru lewat jalur nyata. */
  if(wbOnline())wbLbFetch(b.board);
  else{const m=document.getElementById("wbv2LbModal");if(m&&m.classList.contains("show"))wbLbPaint();}
}
/* ---------- ganti boss: satu jalur aksi (tab & swipe memanggil setBoss) ---------- */
function setBoss(i){
  const n=WB_BOSSES.length;
  if(!(i>=0&&i<n)||i===wbBossIdx)return;
  try{sfx.hit();}catch(e){}
  wbBossIdx=i;
  syncBossDOM();
  const art=document.getElementById("wbv2Art");
  if(art&&!wbReduceMotion()){
    art.classList.add("wbv2-glitch");
    setTimeout(()=>{const a=document.getElementById("wbv2Art");if(a)a.classList.remove("wbv2-glitch");},150);
  }
}
function goBoss(dir){const n=WB_BOSSES.length;if(n<2)return;setBoss(((wbBossIdx+dir)%n+n)%n);}
/* ---------- pulse deploy (flash pendek sebelum pindah view) ---------- */
let wbrDeployT=0;
function wbrDeployPulse(next){
  const stage=document.querySelector(".wbv2-stage");
  if(!stage||wbReduceMotion()){if(typeof next==="function")next();return;}
  clearTimeout(wbrDeployT);
  stage.classList.remove("wbv2-strike");
  void stage.offsetWidth;
  stage.classList.add("wbv2-strike");
  wbrDeployT=setTimeout(()=>{
    const s=document.querySelector(".wbv2-stage");
    if(s)s.classList.remove("wbv2-strike");
    if(typeof next==="function")next();
  },180);
}

var _rdTileHtml={},_ixHtml={},_dpHtml={};
function renderRaidPick(){
  const stacks=state.stacks.slice().sort((a,b)=>(b.fav?1:0)-(a.fav?1:0));
  const b=wbBossOf();
  const bossArt = b.img || b.art || (b.name && b.name.toLowerCase().includes("shadow") ? "assets/cards/art/shadow-king.webp" : "assets/cards/art/eternal-dragon.webp");
  app.innerHTML=`
  <div class="rd-page rd-pick">
    <div class="rd-pick-head">
      <button class="rd-pick-back" id="raidPickBack" title="Back to raid hub" aria-label="Kembali">&#8592;</button>
      <div class="rd-pick-ttl"><span class="eyebrow">TACTICAL STRIKER SELECTION</span><b>SELECT CARD vs ${b.name.toUpperCase()}</b></div>
      <div class="rd-pick-boss">
        <img src="${bossArt}" alt="${b.name}">
        <div class="rpb-i">
          <span class="rpb-k">TARGET BOSS &middot; ${b.diffLabel || "WORLD BOSS"}</span>
          <span class="rpb-n">${b.name}</span>
          <span class="rpb-hp">HP ${fmtBig(b.hp)} &middot; ${RAID_TURNS} TURN</span>
        </div>
      </div>
    </div>
    <div class="rd-pick-filter-bar">
      <label class="card-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
        <input class="card-search" id="raidSearch" type="text" placeholder="Search striker card..." autocomplete="off">
      </label>
      <div class="rd-pick-counter"><span class="rpc-val">${stacks.length}</span> CARDS AVAILABLE</div>
    </div>
    <div class="rd-pick-scroll-wrap">
      <div class="raid-pick-grid bp-grid" id="raidPickGrid">${(()=>{const _rd={};const inner=s=>{const c=CARDS[s.char];
        const shny=s.shiny?'<span class="bpt-shiny shiny-pill">SHINY</span>':'';
        const mut=(s.mut&&s.mut!=='none')?s.mut:null;
        const trait=(s.trait&&s.trait!=='none')?s.trait:null;
        const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
        const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,mutPill(mut,'bpt-mut')):''}${trait?traitChip(trait,`<span class="bpt-gem" style="color:${TRAIT_COLOR[trait]};border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
        return `<img src="${cardThumb(s.char)}" alt="" width="360" height="536" decoding="async">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}');renderRaidPick()" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}');renderRaidPick()" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${c.name}</div>`;};
        _rdTileHtml=_rd;
        return stacks.map((s,i)=>{_rd[s.id]=inner(s);const c=CARDS[s.char];const mounted=true;
        return `<div class="bp-tile${c.fullArt?' fa':''}${mounted?'':' lz-ph'}" data-lz="${s.id}" data-sid="${s.id}" data-pick="${s.id}" data-name="${c.name.toLowerCase()}" style="--tcol:${(s.tier&&TIER_COLOR[s.tier])||'var(--line2)'}">${mounted?_rd[s.id]:''}</div>`;
      }).join("");})()}</div>
      <div class="no-result" id="raidSearch-nr">No matching cards dengan pencarian.</div>
    </div>
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
    raidToast("LOCKING ATTEMPT…");
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
        raidToast(res.msg==="NO_ATTEMPTS_LEFT"?"ATTEMPTS USED TODAY · RESET "+wbResetText():"FAILED TO START RUN · TRY AGAIN");
        raidView="hub";renderRaid();
      }else{
        /* server tak terjangkau: boleh main lokal, skor tidak dikirim */
        wbRunId=null;raidToast("OFFLINE · LOCAL PLAY WITHOUT SCORE");raidView="battle";renderRaid();
      }
    }).catch(()=>{
      /* Promise reject (bukan respons ok:false) — tanpa ini wbStarting nyangkut true
         dan semua tap kartu diblokir selamanya. */
      wbStarting=false;wbRunId=null;wbRunBoss=null;
      raidToast("OFFLINE · LOCAL PLAY WITHOUT SCORE");raidView="battle";renderRaid();
    });
  });
  lazyMountGrid(app.querySelector(".rd-pick-scroll-wrap")||app,_rdTileHtml);
}
function renderRaidBattle(){
  if(window.cgGameplayStart) window.cgGameplayStart();
  const b=wbBossOf(), eq=raidPicked||equipped();
  app.innerHTML=`
  <div class="battle-grid raid-stage">
    ${typeof tcgPlayerEquipRailHtml==="function"?tcgPlayerEquipRailHtml():""}
    ${typeof tcgFoeEquipRailHtml==="function"?tcgFoeEquipRailHtml():""}
    <div class="me-col"><div class="fighter me${eq&&eq.mut&&eq.mut!=='none'?' mut-'+eq.mut:''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}">${meFighterHtml(eq)}</div>${typeof benchRailHtml==="function"?benchRailHtml([],"RAID STRIKER (SOLO DEPLOY)"):""}</div>
    <div class="vs-col"><div class="s" id="raidTurnLabel">TURN<br>0/${RAID_TURNS}</div></div>
    <div class="me-col foe-side"><div class="fighter foe" data-tier="EX">
      ${typeof foeFighterInnerHtml==="function"?foeFighterInnerHtml({name:b.name,img:b.img,tier:"BOSS",boss:true},{hp:b.hp,atk:999999},{hpId:"hpRaid",hpTid:"hpRaidT",subtitle:"WORLD BOSS",skill:b.skill,hpFmt:typeof fmtBattleK==="function"?fmtBattleK:fmtBig}):`
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
  if(typeof window.hzBattleDecorate==="function"){try{window.hzBattleDecorate();}catch(e){console.error("hz raid decorate",e);}}
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
    const p=Math.max(0,Math.min(100,hp/raid.max*100))+"%";
    if(hb){hb.style.width=p;const tr=hb.parentElement?hb.parentElement.querySelector(".hp-trail"):null;if(tr)tr.style.width=p;}
    if(ht)ht.textContent=(typeof fmtBattleK==="function"?fmtBattleK(hp):fmtBig(hp));
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
  /* All attacks in Raid use the exact Hazard Basic Attack lunge + slash choreography */
  if(typeof attackLunge==="function"){try{attackLunge(".fighter.me",true);}catch(e){}}
  /* All cut-in removed */
  const setRaidBar=hp=>{const v=Math.max(0,hp);const p=Math.max(0,Math.min(100,v/raid.max*100))+"%";const b=document.getElementById("hpRaid");if(b){b.style.width=p;const tr=b.parentElement?b.parentElement.querySelector(".hp-trail"):null;if(tr)tr.style.width=p;}const tt=document.getElementById("hpRaidT");if(tt)tt.textContent=(typeof fmtBattleK==="function"?fmtBattleK(v):fmtBig(v));const ih=document.getElementById("foeInlineHp");if(ih)ih.textContent=(typeof fmtBattleK==="function"?fmtBattleK(v):fmtBig(v));if(typeof window.hzBattleSync==="function"){try{window.hzBattleSync();}catch(e){}}};
  const rHstep=(psychicActive&&typeof PSY_T!=="undefined")?PSY_T.step:(domainActive?80:160);
  const rMd=md;
  const rHitDelay=273;
  const rChainEnd=(rMd?MADARA_T.slash+Math.max(0,hits.length-1)*MADARA_T.step+40:rHitDelay+Math.max(0,hits.length-1)*rHstep)+420;
  {
    if(domainActive&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.me","DOMAIN EXPANSION","crit"),rHitDelay+40);}
    if(ariseMode&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.foe","ARMY OF SHADOWS","crit"),rHitDelay);}
    const susStart=(md&&raid&&!raid.over)?MADARA_T.slash:rHitDelay;
    {
      const hstep=rHstep;
      const susDelay=susStart;
      const dlyAt=i=> galaxyMode ? rHitDelay : md ? (susDelay+i*MADARA_T.step) : (susDelay+i*hstep);
      let rShown=raid.hp+total,rBarEnd=0;const rEndHp=raid.hp;
      hits.forEach((m,i)=>{
        const dl=dlyAt(i),ft=dl;
        if(i>0){
          setTimeout(()=>{
            if(raid&&!raid.over&&typeof window.playAnimeArchetypeAttack==="function"){
              try{window.playAnimeArchetypeAttack(id,".fighter.me",".fighter.foe");}catch(e){}
            }
          },dl);
        }
        setTimeout(()=>{if(raid&&!raid.over){try{if(crit&&i===hits.length-1)sfx.crit();else playClip(punchAudio);}catch(e){}}},dl);
        const dd=Math.round(dmg*m);rShown-=dd;rBarEnd=Math.max(rBarEnd,ft);const stepHp=Math.max(0,rShown);
        setTimeout(()=>floatText(".fighter.foe","-"+fmt(dd),(crit&&i===hits.length-1)?"crit":""),ft);
        setTimeout(()=>setRaidBar(stepHp),ft);
      });
      setTimeout(()=>setRaidBar(rEndHp),rBarEnd+420);
      if(barrageN>1)setTimeout(()=>floatText(".fighter.foe",(iceBlastN?"ICE BLAST ×":domainActive?"UNLIMITED VOID ×":ariseMode?"ARISE ×":md?"TENSA ×":psychicActive?"PSYCHIC BARRAGE ×":"CLEAVE ×")+barrageN,"crit"),md?MADARA_T.slash:psychicActive?260:280);
      else if(hits.length>1&&!ranton)setTimeout(()=>floatText(".fighter.foe","DOUBLE!","crit"),rHitDelay+60);
      if(bajrangActive)setTimeout(()=>floatText(".fighter.me","BAJRANG GUN!","crit"),rHitDelay+40);
      if(hpPurple)setTimeout(()=>floatText(".fighter.foe","HOLLOW PURPLE","crit"),rHitDelay+40);
    }
  }
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
    setTimeout(()=>{
      if(raid&&!raid.over){
        floatText(".fighter.foe","SUPER MEGA DEATH ROCKET -"+fmt(rk)+" ("+raid.havocUses+"/"+(fx.havocRocket.maxUses||3)+")","crit");
        setRaidBar(raid.hp);
      }
    },320);
  }
  setRaidBar(raid.hp+total);
  const tl=document.getElementById("raidTurnLabel");if(tl)tl.innerHTML="TURN<br>"+raid.turn+"/"+raid.cap;
  if(raid.hp<=0){
    const special=(domainActive||ariseMode||ranton||galaxyMode||havocFired||gammaRayHit||psychicActive||bajrangActive||hpPurple);
    const killWait=Math.max(rChainEnd, special?1100:0);
    if(killWait>260){ setTimeout(()=>{if(raid&&!raid.over)endRaid();},killWait); }
    else endRaid();
    return;
  }
  raid.timer=setTimeout(raidStep,ariseMode?1800:domainActive?1600:ranton?1600:1050);
}
function raidFinisher(done){
  if(!raid||raid.over){ if(done)done(); return; }
  if(raid.timer){clearTimeout(raid.timer);raid.timer=null;}
  const grid=document.querySelector(".battle-grid");
  const meEl=document.querySelector(".fighter.me"), foeEl=document.querySelector(".fighter.foe");
  if(!grid||!meEl||!foeEl){ if(done)done(); return; }
  const skill=(raid.boss&&raid.boss.skill)||"GALAXY ROAR";
  const DMG=999999;
  floatText(".fighter.foe",skill,"crit");
  sfx.crit();
  if(typeof attackLunge==="function"){try{attackLunge(".fighter.foe",true);}catch(e){}}
  setTimeout(()=>{
    floatText(".fighter.me","-"+fmt(DMG),"crit");
    try{playClip(punchAudio);}catch(e){}
    const bar=document.getElementById("hpMe");if(bar){bar.style.width="0%";const tr=bar.parentElement?bar.parentElement.querySelector(".hp-trail"):null;if(tr)tr.style.width="0%";}
    const t=document.getElementById("hpMeT");if(t)t.textContent="0";
    const ih=document.getElementById("meInlineHp");if(ih)ih.textContent="0";
    meEl.classList.add("ko");
    if(typeof window.hzBattleSync==="function"){try{window.hzBattleSync();}catch(e){}}
    setTimeout(()=>{ if(done)done(); },620);
  },280);
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
    else if(raid.wbRes)wbLine=`<div class="rr-wb bad">DAMAGE SUBMIT FAILED (${raid.wbRes.msg||"ERROR"}) · ATTEMPT STILL CONSUMED</div>`;
    else wbLine=`<div class="rr-wb">LOCAL PLAY · DAMAGE NOT SUBMITTED</div>`;
  }
  app.innerHTML=`
  <div class="tw-page rd-page"><div class="raid-result">
    <div class="eyebrow">HASIL WORLD BOSS</div>
    <div class="rr-title disp${pct>=100?"":" lose"}">${pct>=100?"BOSS DEFEATED":"RUN COMPLETE"}</div>
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
  {id:"gem",name:"Token → Gem // 100:20",cost:100,gem:20,desc:"Trade 100 Tokens for 20 Gems. Unlimited.",apply:()=>""},
  {id:"coins",name:"2.000 Coin",cost:12,coinBuy:true,desc:"2,000 Coins for rolls & upgrades.",apply:()=>""},
  {id:"card_edragon",name:"Eternal Dragon",cost:4000,desc:"Exclusive boss card. Buy once — its roll opens permanently in every gacha. Base 1 in 25M.",card:{char:"CH_ETERNAL_DRAGON",mut:"none"},
    apply:()=>{state.raidShopOwned=state.raidShopOwned||{};state.raidShopOwned.CH_ETERNAL_DRAGON=true;return gmGrantCard("CH_ETERNAL_DRAGON");}},
  {id:"card_shadowking",name:"Shadow King",cost:8000,desc:"Exclusive boss card. Buy once — granted instantly + its roll opens permanently. Base 1 in 100M.",card:{char:"CH_SHADOW_KING",mut:"none"},
    apply:()=>{state.raidShopOwned=state.raidShopOwned||{};state.raidShopOwned.CH_SHADOW_KING=true;return gmGrantCard("CH_SHADOW_KING");}},
  {id:"helm-abyss",name:"HELM ABYSS",cost:12000,desc:"Permanent artefact. Delivered to your Backpack.",effect:"+80 FLAT & +120% LUCK",owned:()=>(state.artOwned||[]).includes("helm-abyss"),
    apply:()=>{state.artOwned=state.artOwned||[];if(!state.artOwned.includes("helm-abyss"))state.artOwned.push("helm-abyss");return "HELM ABYSS · +80 FLAT & +120% LUCK";}},
  {id:"nebula-wisp",name:"NEBULA WISP",cost:30000,desc:"Permanent pet. Delivered to your Backpack.",effect:"+150 FLAT & +220% LUCK",owned:()=>(state.petOwned||[]).includes("nebula-wisp"),
    apply:()=>{state.petOwned=state.petOwned||[];if(!state.petOwned.includes("nebula-wisp"))state.petOwned.push("nebula-wisp");return "NEBULA WISP · +150 FLAT & +220% LUCK";}},
  /* LUCK & SPEED POTION L1-L3 — consumable, harga token sama dgn Toko Inf. */
  {id:"luck1",name:"Luck Potion L1",cost:25,desc:"+3 Flat Luck for 5 min. Stacks.",effect:"+3 FLAT LUCK · 5 MIN",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[0]++;return "LUCK POTION L1";}},
  {id:"luck2",name:"Luck Potion L2",cost:125,desc:"+5 Flat & +10% Luck for 5 min. Stacks.",effect:"+5 FLAT & +10% LUCK · 5 MIN",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[1]++;return "LUCK POTION L2";}},
  {id:"luck3",name:"Luck Potion L3",cost:600,desc:"+10 Flat & +20% Luck for 5 min. Stacks.",effect:"+10 FLAT & +20% LUCK · 5 MIN",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[2]++;return "LUCK POTION L3";}},
  {id:"speed1",name:"Speed Potion L1",cost:25,desc:"+0.2× Roll Speed for 5 min. Stacks.",effect:"SPEED +0.2× · 5 MIN",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[0]++;return "SPEED POTION L1";}},
  {id:"speed2",name:"Speed Potion L2",cost:125,desc:"+0.5× Roll Speed for 5 min. Stacks.",effect:"SPEED +0.5× · 5 MIN",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[1]++;return "SPEED POTION L2";}},
  {id:"speed3",name:"Speed Potion L3",cost:600,desc:"+1.0× Roll Speed for 5 min. Stacks.",effect:"SPEED +1.0× · 5 MIN",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[2]++;return "SPEED POTION L3";}}
];
/* =============== TOKO RAID — layout master-detail ala TOKO INF (.tw-hub) ===============
   Kiri: daftar item (.srow). Kanan: stats token + detail (.sdetail) + tombol beli (.act.go.buyswap).
   Kartu BOSS: status ROLL TERKUNCI/TERBUKA ditampilkan; beli = raidShopOwned[id]=true (permanen). */
function raidShopBuy(id){
  const it=WB_SHOP.find(x=>x.id===id);if(!it)return;
  const tok=state.wbTokens||0;
  if(tok<it.cost){raidToast("NOT ENOUGH TOKENS — need "+it.cost+" token");return;}
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
        const why=(res&&res.msg)==="TOKEN_KURANG"?"NOT ENOUGH TOKENS":((res&&res.msg)==="DAILY_CAP"?"DAILY LIMIT":((res&&res.msg)||"try again"));
        raidToast("EXCHANGE FAILED — "+why);
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
        const why=(res&&res.msg)==="TOKEN_KURANG"?"NOT ENOUGH TOKENS":((res&&res.msg)||"try again");
        raidToast("EXCHANGE FAILED — "+why);
      }
      try{renderShell();}catch(e){}
      if(raidView==="shop")renderRaidShop();
    })();
    return;
  }
  if(it.card&&stackHas(it.card.char,it.card.mut)){raidToast("That card is already in your Deck");return;}
  if(it.owned&&it.owned()){raidToast("Already owned — permanent in Backpack");return;}
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
      const why=(res&&res.msg)==="TOKEN_KURANG"?"NOT ENOUGH TOKENS":((res&&res.msg)==="DAILY_CAP"?"DAILY LIMIT":((res&&res.msg)||"try again"));
      raidToast("PURCHASE FAILED — "+why);
    }
    try{renderShell();}catch(e){}
    renderRaidShop();
  })();
}
/* =============== TOKO RAID — "SHADOW ARMORY" ===============
   Port desain terkunci `_tmp/proto_wb_shop_v1.html` (user ACC 2026-11-05):
   cermin toko Tower Inf "SPIRE ARMORY" — satu top bar, PANGGUNG kartu boss
   terpisah di atas, lalu rak supply ber-rail (satu item = satu baris).
   Prefix kelas `wbs-` supaya tidak bentrok dengan `.cs-*` milik toko Tower
   (style.css) maupun `.tw-*`/`.holo-*` milik lab prototipe.
   Data & perilaku beli TIDAK berubah: WB_SHOP + raidShopBuy(). */

/* Kategori visual per item — cermin blok kategori prototipe. */
function wbsMeta(it){
  if(it.id==="gem")            return { cat:"EXCHANGE",   tier:"GEM",    ac:"#ffd700", art:"assets/images/premium-currency.webp" };
  if(it.id==="coins")          return { cat:"CREDITS",    tier:"COINS",  ac:"#ffd27a", art:"assets/icons/coins-gold.svg" };
  if(it.id==="card_edragon")   return { cat:"EX CORE",    tier:"EX-CH",  ac:"#00e5ff", art:"assets/cards/art/eternal-dragon.webp" };
  if(it.id==="card_shadowking")return { cat:"EX CORE",    tier:"EX-CH",  ac:"#a855f7", art:"assets/cards/art/shadow-king.webp" };
  if(it.id==="helm-abyss")     return { cat:"RELIC GEAR", tier:"MYTHIC", ac:"#ffb703", art:"assets/artifacts/abyss-helm.webp" };
  if(it.id==="nebula-wisp")    return { cat:"RELIC GEAR", tier:"COSMIC", ac:"#7df9ff", art:"assets/pets/nebula-wisp.webp" };
  if(it.id.indexOf("luck")===0)  return { cat:"AUGMENT",   tier:"MK-"+it.id.replace("luck",""),  ac:"#4ade80", art:"assets/images/pot-luck-"+it.id.replace("luck","")+".webp" };
  if(it.id.indexOf("speed")===0) return { cat:"OVERCLOCK", tier:"MK-"+it.id.replace("speed",""), ac:"#fbbf24", art:"assets/images/pot-speed-"+it.id.replace("speed","")+".webp" };
  return { cat:"SUPPLY", tier:"SPEC", ac:"#f5f5f5", art:"assets/icons/coins-gold.svg" };
}
/* Rail rak (urutan = prototipe). EX CORE tidak di sini: kartunya dipajang
   di panggung `.wbs-stage-panel` di atas rak. */
const WBS_RAILS=[
  { key:"EXCHANGE",   note:"TOKEN BURN" },
  { key:"CREDITS",    note:"COIN MINT" },
  { key:"RELIC GEAR", note:"PERMANENT" },
  { key:"AUGMENT",    note:"LUCK" },
  { key:"OVERCLOCK",  note:"SPEED" },
];
function wbsIsOwned(it){
  if(it.card) return stackHas(it.card.char,it.card.mut) || !!(state.raidShopOwned && state.raidShopOwned[it.card.char]);
  if(it.owned) return !!it.owned();
  return false;
}
function wbsStock(it,owned){
  if(owned) return "OWNED";
  if(it.id==="gem"||it.id==="coins") return "∞ UNLIMITED";
  if(it.id.indexOf("luck")===0){ const n=(state.luckPots||[])[+it.id.slice(-1)-1]||0; return "×"+n; }
  if(it.id.indexOf("speed")===0){ const n=(state.speedPots||[])[+it.id.slice(-1)-1]||0; return "×"+n; }
  if(it.card) return "ROLL LOCKED";
  return "PERMANENT";
}
/* Label tombol = prototipe: UNLOCKED / DEFICIT n / EXCHANGE (+N) / ACQUIRE. */
function wbsLabel(it,owned){
  const tok=state.wbTokens||0;
  if(owned) return "✔ UNLOCKED";
  if(tok<it.cost) return "DEFICIT "+fmt(it.cost-tok);
  if(it.gem) return "EXCHANGE (+"+it.gem+" GEMS)";
  if(it.coinBuy) return "EXCHANGE (+2,000 COINS)";
  return "ACQUIRE SUPPLY";
}
function wbsRowHtml(it){
  const m=wbsMeta(it), owned=wbsIsOwned(it);
  const dis=owned||(state.wbTokens||0)<it.cost;
  return `<div class="wbs-it" style="--ic:${m.ac}">
    <span class="wbs-it-art"><i class="wbs-it-glow"></i><img src="${m.art}" alt="" decoding="async"></span>
    <span class="wbs-it-mid">
      <span class="wbs-it-cat"><b class="c1">${m.cat}</b><b class="c2">${m.tier}</b></span>
      <span class="wbs-it-nm" title="${it.name}">${it.name}</span>
      <span class="wbs-it-ds">${it.desc}</span>
      <span class="wbs-it-stock">IN STOCK <b>${wbsStock(it,owned)}</b></span>
    </span>
    <span class="wbs-it-right">
      <span class="wbs-it-price"><b>${fmt(it.cost)}<i>TOK</i></b></span>
      <button class="wbs-buy" type="button" data-id="${it.id}" ${dis?"disabled":""}>${wbsLabel(it,owned)}</button>
    </span>
  </div>`;
}
function wbsBossHtml(it){
  const m=wbsMeta(it), owned=wbsIsOwned(it);
  const dis=owned||(state.wbTokens||0)<it.cost;
  return `<div class="wbs-boss${owned?" owned":""}" style="--ic:${m.ac}">
    <span class="wbs-boss-art">
      <i class="wbs-it-glow"></i>
      <img src="${m.art}" alt="${it.name}" decoding="async">
      <span class="wbs-boss-seal${owned?" on":""}">${owned?"✔ OWNED":"ROLL LOCKED"}</span>
    </span>
    <span class="wbs-boss-mid">
      <span class="wbs-it-cat"><b class="c1">${m.cat}</b><b class="c2">${m.tier}</b></span>
      <span class="wbs-boss-nm" title="${it.name}">${it.name}</span>
      <span class="wbs-boss-ds">${it.desc}</span>
    </span>
    <span class="wbs-boss-foot">
      <span class="wbs-boss-price"><b>${fmt(it.cost)}<i>TOK</i></b></span>
      <button class="wbs-buy" type="button" data-id="${it.id}" ${dis?"disabled":""}>${wbsLabel(it,owned)}</button>
    </span>
  </div>`;
}

function renderRaidShop(){
  const tok=state.wbTokens||0;
  const META=WB_SHOP.map(it=>({ it, m:wbsMeta(it) }));
  const bossItems=META.filter(x=>x.m.cat==="EX CORE").map(x=>x.it);
  const bossTotal=bossItems.length;
  const bossCount=bossItems.filter(x=>bossRollUnlocked(x.card.char)).length;

  const railsHtml=WBS_RAILS.map(r=>{
    const rows=META.filter(x=>x.m.cat===r.key).map(x=>x.it);
    if(!rows.length) return "";
    return `<div class="wbs-rail">
      <div class="wbs-rail-h"><b>${r.key}</b><i></i><span>${rows.length} · ${r.note}</span></div>
      <div class="wbs-rail-shelf">${rows.map(wbsRowHtml).join("")}</div>
    </div>`;
  }).join("");

  app.innerHTML=`
  <div class="wbs-page rd-page">
    <div class="wbs-shop">
      <div class="wbs-top">
        <button class="wbs-back" id="raidShopBack" type="button" title="Back to World Boss" aria-label="Back to World Boss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="wbs-ttl">
          <div class="wbs-kick"><i></i>WORLD BOSS · PROCUREMENT</div>
          <div class="wbs-name">SHADOW <em>ARMORY</em></div>
        </div>
        <div class="wbs-meter">
          <div class="wbs-m"><small>TOKEN</small><b class="c">${fmt(tok)}</b></div>
          <div class="wbs-m"><small>CORES</small><b class="k">${bossCount} / ${bossTotal}</b></div>
        </div>
      </div>

      <div class="wbs-body">
        <div class="wbs-shelf">
          <div class="wbs-inner">
            <section class="wbs-stage-panel" aria-label="Ex Core — boss card">
              <div class="wbs-stage-h"><b>EX CORE</b><i></i><span>${bossTotal} · BOSS UNLOCK</span></div>
              <div class="wbs-stage-track">${bossItems.map(wbsBossHtml).join("")}</div>
            </section>
            ${railsHtml}
          </div>
        </div>
      </div>

      <div class="wbs-foot"><span>${WB_SHOP.length} SUPPLIES</span><i></i><span>INSTANT DELIVERY · 1 TOKEN = 1 RUN</span></div>
    </div>
  </div>`;

  const rb=document.getElementById("raidShopBack");
  if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}raidView="hub";renderRaid();};

  app.querySelectorAll(".wbs-buy[data-id]").forEach(btn=>{
    btn.onclick=()=>{
      if(btn.disabled)return;
      const id=btn.getAttribute("data-id");
      if(id)raidShopBuy(id);
    };
  });
}


/* =============== INDEX CARD (layar penuh) =============== */
const IX_MUTS=["none","gold","rainbow","secret","ultima"];
const IX_RB_LETTERS=["#FF6B81","#FFB347","#FFE66D","#6BE08A","#B9C2CC","#B98CFF","#FF6BD6"];
let ixState={q:"",mut:"all",shiny:false,owned:false,sort:"name"};
/* RAINBOW harus terbaca pelangi, bukan ungu tunggal (= warna SECRET).
   Per-letter colour untuk label, gradient text untuk "1 IN X", swatch strip
   untuk segmen footer. */
function ixMutTag(mut){
  if(mut==="rainbow"){
    const txt=MUT_LABEL[mut].split("").map((ch,i)=>`<i style="color:${IX_RB_LETTERS[i%IX_RB_LETTERS.length]}">${ch}</i>`).join("");
    return `<span class="ix-mtag rb">${txt}</span>`;
  }
  return `<span class="ix-mtag" style="--tc:${MUT_COLOR[mut]}">${MUT_LABEL[mut]}</span>`;
}
function ixMutSwatch(mut){return mut==="rainbow"?"var(--rb)":MUT_COLOR[mut];}
function openIndex(){
  /* Katalog SEMUA kartu — layar penuh "HZ / NEURAL ARCHIVE" (port
     _tmp/proto_index_hazard_v1.html): top bar + progress + CLAIM, toolbar tab
     mutasi + SHINY + OWNED ONLY + sort, grid tile 1:1 (badge ×N + 1 IN X),
     footer strip varian, dan detail sheet hazard (§08 prototipe). */
  idxRewardSync(true);
  ixRender();
  document.getElementById("indexModal").classList.add("show");
  document.body.classList.add("index-open");
  ixBannerOpen();
  const sx=document.getElementById("ixSearch");
  sx.value=ixState.q;
  sx.oninput=()=>{ixState.q=sx.value.trim().toLowerCase();clearTimeout(sx._t);sx._t=setTimeout(ixRender,180);};
  const shx=document.getElementById("ixShX");
  if(shx)shx.onclick=()=>ixSheetClose();
  const sheet=document.getElementById("ixSheet");
  if(sheet&&!sheet.__ixBound){
    sheet.__ixBound=true;
    sheet.addEventListener("click",e=>{if(e.target===sheet||e.target.classList.contains("ix-sh-body"))ixSheetClose();});
  }
}
function closeIndex(){
  const m=document.getElementById("indexModal");
  if(!m||!m.classList.contains("show"))return;
  ixSheetClose();
  ixBannerClose(()=>{
    m.classList.remove("show");
    document.body.classList.remove("index-open");
  });
}
/* ===== DETAIL SHEET (port _tmp/proto_index_hazard_v1.html §08) =====
   Panel detail di dalam layar index: thumbnail, kode matriks, nama berwarna
   mutasi, DROP RATE, jumlah varian, HP/ATK, pips mutasi (+★ shiny) dan
   SIGNATURE SKILL. Menggantikan pemakaian #skillPop (tampilan layar lain). */
function ixSheetOpen(charId,mut,isShiny){
  const c=CARDS[charId];
  if(!c)return;
  const sheet=document.getElementById("ixSheet");
  if(!sheet)return;
  const P=idxProgress();
  const own=(m,sh)=>P.owned.has(`${c.char_id}|${m}|${sh?1:0}`);
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const m0=mut&&mut!=="none"?mut:"none";
  const img=document.getElementById("ixShImg");
  if(img){img.src=thumbSrc(c.sprite_asset)||"";img.alt=c.name||"";}
  /* Kode baris mengikuti konteks tile. Kartu pemain tidak punya tier
     (tier hanya untuk musuh story), jadi yang ditampilkan mutasi aktif. */
  set("ixShCode",`MATRIX · ${MUT_LABEL[m0]||"PURE"}${isShiny?" · SHINY":""}`);
  const nameEl=document.getElementById("ixShName");
  if(nameEl)nameEl.textContent=c.name||"—";
  set("ixShChance","1 IN "+fmtChance(effChance(c.char_id,m0,!!isShiny)));
  let cnt=0,shCnt=0;
  for(const m of IX_MUTS){if(own(m,false))cnt++;if(own(m,true))shCnt++;}
  set("ixShOwn",`${cnt}${shCnt?" +"+shCnt+"★":""} / 10 VARIANTS`);
  const pv=c.passive||{};
  set("ixShSkill",pv.name||"—");
  set("ixShDesc",pv.desc||"—");
  const muts=document.getElementById("ixShMuts");
  if(muts){
    muts.innerHTML=IX_MUTS.map(m=>{
      const got=own(m,false)||own(m,true);
      const star=own(m,true)?' ★':'';
      if(m==="rainbow"){
        const txt=MUT_LABEL[m].split("").map((ch,i)=>`<i style="color:${IX_RB_LETTERS[i%IX_RB_LETTERS.length]}">${ch}</i>`).join("");
        return `<span class="ix-sh-mut rb${got?' own':''}">${txt}${star}</span>`;
      }
      return `<span class="ix-sh-mut${got?' own':''}" style="--mc:${MUT_COLOR[m]}">${MUT_LABEL[m]}${star}</span>`;
    }).join("");
  }
  sheet.classList.add("on");
  sheet.setAttribute("aria-hidden","false");
  const body=sheet.querySelector(".ix-sh-body");
  if(body)body.scrollTop=0;
  document.querySelectorAll("#ixBody .ix-cell.sel").forEach(x=>x.classList.remove("sel"));
  const cell=document.querySelector(`#ixBody .ix-cell[data-c="${charId}"]`);
  if(cell)cell.classList.add("sel");
}

function ixSheetClose(){
  const sheet=document.getElementById("ixSheet");
  if(!sheet||!sheet.classList.contains("on"))return false;
  sheet.classList.remove("on");
  sheet.setAttribute("aria-hidden","true");
  document.querySelectorAll("#ixBody .ix-cell.sel").forEach(x=>x.classList.remove("sel"));
  return true;
}
/* ESC: sheet detail dulu, baru layar index. */
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  const m=document.getElementById("indexModal");
  if(!m||!m.classList.contains("show"))return;
  if(ixSheetClose()){e.stopPropagation();return;}
  e.stopPropagation();closeIndex();
},true);
/* ===== banner hazard masuk/keluar (#indexCurtain, pola #traitCurtain) ===== */
let ixHzTimers=[];
function ixHzClear(){for(let i=0;i<ixHzTimers.length;i++)clearTimeout(ixHzTimers[i]);ixHzTimers=[];}
function ixHzSetCopy(mode){
  const kick=document.getElementById("ixHzKick"),title=document.getElementById("ixHzTitle"),
        sub=document.getElementById("ixHzSub"),foot=document.getElementById("ixHzFoot"),
        serial=document.getElementById("ixHzSerial"),water=document.getElementById("ixHzWater");
  if(serial)serial.textContent=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(mode==="open"){
    if(kick)kick.innerHTML="// ARCHIVE <b>SYNC</b>";
    if(title)title.textContent="CARD INDEX";
    if(water)water.textContent="IDX";
    if(sub)sub.textContent="VARIANT VAULT · MUTATIONS · SHINY";
    if(foot)foot.textContent="ENTER ARCHIVE";
  }else{
    if(kick)kick.innerHTML="// LINK <b>STAND BY</b>";
    if(title)title.textContent="HOLD";
    if(water)water.textContent="OUT";
    if(sub)sub.textContent="ARCHIVE DISCONNECTING · DATA SAVED";
    if(foot)foot.textContent="CLOSE SESSION";
  }
}
function ixBannerOpen(){
  const c=document.getElementById("indexCurtain");
  if(!c)return;
  ixHzClear();ixHzSetCopy("open");
  c.className="";void c.offsetWidth;
  c.classList.add("on","smooth","sweep");
  ixHzTimers.push(setTimeout(()=>c.classList.add("revealed"),1080));
  ixHzTimers.push(setTimeout(()=>c.classList.remove("on","smooth","sweep","revealed"),1800));
}
/* EXIT 3 fase: tirai MENUTUP -> konten disembunyikan -> tirai MEMBUKA.
   Fase 3 wajib; tanpanya layar tertahan tertutup ("banner tidak kebuka"). */
function ixBannerClose(onCovered){
  const c=document.getElementById("indexCurtain");
  if(!c){if(onCovered)onCovered();return;}
  ixHzClear();ixHzSetCopy("close");
  c.className="";c.classList.add("on","smooth","revealed");void c.offsetWidth;
  c.classList.remove("revealed");
  ixHzTimers.push(setTimeout(()=>{if(onCovered)onCovered();},560));
  ixHzTimers.push(setTimeout(()=>c.classList.add("revealed"),780));
  ixHzTimers.push(setTimeout(()=>c.classList.remove("on","smooth","revealed"),1560));
}
window.openIndex=openIndex;
window.closeIndex=closeIndex;
window.ixBannerOpen=ixBannerOpen;
window.ixBannerClose=ixBannerClose;
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
  /* --- filter state: tab mutasi murni + toggle SHINY terpisah --- */
  const fmSel=ixState.mut==="all"?null:ixState.mut;
  const fShiny=!!ixState.shiny;
  const validCards=MASTER_CARD_INDEX.filter(c=>!c.isStoryEnemy);
  /* Hitungan tab mengikuti prototipe: setiap tab mutasi = (kartu × 2) varian
     normal + shiny. Tab ALL memakai P.count/P.total dari idxProgress (angka
     server) supaya sinkron dengan bar progres dan tombol CLAIM. */
  const tabTotal=validCards.length*2;
  const tabCount=(m)=>{
    if(m==="all")return `<b>${fmt(P.count)}/${fmt(P.total)}</b>`;
    let own=0;
    for(const c of validCards)own+=(ownCnt(c,m,false)?1:0)+(ownCnt(c,m,true)?1:0);
    return `<b>${fmt(own)}/${fmt(tabTotal)}</b>`;
  };
  const chip=(k,l,cls)=>`<button class="ix-tab ${cls||""}${ixState.mut===k?' on':''}" type="button" data-mut="${k}">${l}${tabCount(k)}</button>`;
  const toolbar=`<div class="ix-tabs">
      ${chip("all","ALL")}${IX_MUTS.map(m=>chip(m,m==="none"?"PURE":MUT_LABEL[m],"m-"+m)).join("")}
      <button class="ix-tab shiny-t${ixState.shiny?' on':''}" type="button" data-shiny="1">★ SHINY</button>
    </div>
    <span class="ix-sp"></span>
    <button class="ix-tog${ixState.owned?' on':''}" type="button" data-owned="1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> OWNED ONLY</button>
    <div class="ix-sort-wrap">
      <select class="ix-sort" id="ixSort" title="Sort">
        <option value="name">SORT: NAME</option><option value="chance">SORT: RARITY</option><option value="own">SORT: VARIANTS</option>
      </select>
    </div>`;
  /* --- filter + sort --- */
  const TIER_RANK={R:0,SR:1,SSR:2,UR:3,EX:4,BOSS:5};
  let list=MASTER_CARD_INDEX.filter(c=>{
    if(c.isStoryEnemy||(c.noGacha&&!c.chance))return false;
    if(ixState.q&&!c.name.toLowerCase().includes(ixState.q))return false;
    if(ixState.owned){
      if(fmSel){
        if(!(ownCnt(c,fmSel,false)||ownCnt(c,fmSel,true)))return false;
      } else if(fShiny){
        if(!ownedN(c,true))return false;
      } else {
        if(!(ownedN(c,false)+ownedN(c,true)))return false;
      }
    }
    return true;
  });
  const T={name:(a,b)=>a.name.localeCompare(b.name),
    tier:(a,b)=>(TIER_RANK[a.tier]??9)-(TIER_RANK[b.tier]??9)||a.name.localeCompare(b.name),
    own:(a,b)=>(ownedN(b,false)+ownedN(b,true))-(ownedN(a,false)+ownedN(a,true))||a.name.localeCompare(b.name),
    chance:(a,b)=>(a.chance==null?1e9:a.chance)-(b.chance==null?1e9:b.chance)||a.name.localeCompare(b.name)};
  list.sort(T[ixState.sort]||T.name);
  /* --- tile 1:1 --- */
  _ixHtml={};
  const cells=list.map((c,i)=>{
    const any=ownedN(c,false)+ownedN(c,true);
    const anySh=ownedN(c,true)>0;
    const isSpecificVariantOwned = fmSel
      ? (fShiny ? ownCnt(c, fmSel, true) : (ownCnt(c, fmSel, false) || ownCnt(c, fmSel, true)))
      : (fShiny ? anySh : any > 0);
    const isShinyActive = fShiny || (ixState.mut === "all" && anySh);
    const bestMut=ownCnt(c,"ultima",false)||ownCnt(c,"ultima",true)?"ultima":
      (ownCnt(c,"secret",false)||ownCnt(c,"secret",true)?"secret":
      ownCnt(c,"rainbow",false)||ownCnt(c,"rainbow",true)?"rainbow":
      (ownCnt(c,"gold",false)||ownCnt(c,"gold",true))?"gold":null);
    const fm = ixState.mut === "all" ? bestMut : fmSel;
    const hasMut = !!(fm && fm !== "none");
    const chanceColor = hasMut ? MUT_COLOR[fm] : "#9AA6B2";
    const chanceText = `1 IN ${fmtChance(effChance(c.char_id, fmSel || "none", fShiny))}`;
    const chanceHtml = hasMut && (fm === 'rainbow' || fm === 'ultima') ? mutText(fm, chanceText) : chanceText;
    const lockBoss = !!((c.raidBoss||c.towerBoss) && !bossRollUnlocked(c.char_id));
    const lockShop = c.towerBoss?"TOKO INF":"TOKO WORLD BOSS";
    const shFx = isShinyActive;
    const cls = `ix-cell${isSpecificVariantOwned ? '' : ' no-own'}${lockBoss ? ' boss-locked' : ''}${shFx ? ' shiny' : ''}${hasMut ? ' m-' + fm : ''}${c.fullArt ? ' fa' : ''}`;
    const safeName = String(c.name).replace(/"/g, '&quot;');
    const shinyStyle = hasMut && fm === 'gold' ? '--sh-base:#E0BC6E;--sh-edge:rgba(224,188,110,.95);--sh-glow:rgba(224,188,110,.55)'
      : hasMut && fm === 'rainbow' ? '--sh-base:#B58CFF;--sh-edge:rgba(90,200,250,.95);--sh-glow:rgba(181,140,255,.55)'
      : hasMut && fm === 'secret' ? '--sh-base:#A855F7;--sh-edge:rgba(168,85,247,.95);--sh-glow:rgba(168,85,247,.55)'
      : hasMut && fm === 'ultima' ? '--sh-base:#FF0055;--sh-edge:rgba(255,51,102,.95);--sh-glow:rgba(255,0,85,.6)'
      : '--sh-base:#22d3ee;--sh-edge:rgba(34,211,238,.95);--sh-glow:rgba(34,211,238,.55)';
    let nameHtml = '';
    if (shFx) {
      nameHtml = `<span class="ixc-name hc-name-top hc-name-shine${hasMut ? ' hc-name-shine-' + fm : ''}" data-text="${safeName}" style="${shinyStyle}">${c.name}</span>`;
    } else if (hasMut) {
      nameHtml = `<span class="ixc-name hc-name-top hc-mut-name" data-text="${safeName}">${fm === 'rainbow' || fm === 'ultima' ? mutText(fm, c.name) : c.name}</span>`;
    } else {
      nameHtml = `<span class="ixc-name hc-name-top">${c.name}</span>`;
    }
    const tags=[];
    if(hasMut)tags.push(ixMutTag(fm));
    if(shFx)tags.push('<span class="ix-mtag sh">SHINY</span>');
    const inner=`<img src="${thumbSrc(c.sprite_asset)}" alt="${c.name}" width="360" height="536" decoding="async">
      ${hasMut && fm==="rainbow" ? '<span class="ix-mring"></span>' : ''}
      ${shFx ? '<span class="ix-sheen"></span>' : ''}
      <span class="ix-count${any?'':' zero'}">×${any}</span>
      ${tags.length?`<span class="ix-tags">${tags.join("")}</span>`:''}
      <span class="ixc-stack">${nameHtml}<span class="ixc-chance${hasMut && (fm === 'rainbow' || fm === 'ultima') ? ' ixc-chance-rainbow' : ''}" style="--tc:${chanceColor}"><span class="ixc-chance-text">${chanceHtml}</span></span></span>`;
    _ixHtml[c.char_id]=inner;
    const mounted=true;
    return `<button class="${cls}${mounted?'':' lz-ph'}" type="button" data-lz="${c.char_id}" data-c="${c.char_id}" data-mut="${hasMut ? fm : 'none'}" data-shiny="${shFx ? '1' : '0'}"${lockBoss ? ' title="NOT OWNED YET - buy it in '+lockShop+' to unlock roll"' : ''}>${mounted?inner:''}</button>`;
  }).join("");
  /* --- progress + claim --- */
  const pct=P.total?Math.min(100,Math.round(P.count/P.total*100)):0;
  const complete=P.total>0&&P.count>=P.total;
  const next=Math.max(0,IDX_MILESTONE-(P.count%IDX_MILESTONE));
  const claimable=Math.max(0,P.blocks-P.claimed);
  const setTxt=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setTxt("ixLevel",(state&&state.playerLv)||1);
  setTxt("ixTsIndexed",fmt(P.count));
  setTxt("ixTsTotal",fmt(P.total));
  setTxt("ixPct",pct+"%");
  setTxt("ixNext",String(next));
  setTxt("ixPtext",`${fmt(P.count)} / ${fmt(P.total)} CARDS INDEXED`);
  const pf=document.getElementById("ixPfill");if(pf)pf.style.width=pct+"%";
  const cb=document.getElementById("ixClaim");
  if(cb){
    cb.classList.toggle("locked",claimable<=0);
    cb.disabled=claimable<=0;
    const n=document.getElementById("ixClaimN");if(n)n.textContent="(+"+claimable+")";
  }
  /* --- footer: strip progres SEGMENT per mutasi + milestone --- */
  const t=validCards.length;
  const segs=IX_MUTS.map(m=>{let n=0;for(const c of validCards)if(ownCnt(c,m,false))n++;
    return `<i title="${MUT_LABEL[m]||'PURE'} ${n}/${t}" style="--p:${t?Math.round(n/t*100):0}%;--c:${ixMutSwatch(m)}"></i>`;}).join("");
  const strip=`<span class="ix-f-lbl">VARIANT MATRIX</span>
    <div class="ix-seg" title="${pct}%">${segs}</div>
    <div class="ix-f-rw">
      <img src="assets/images/instanpack-5k.webp?v=trans1" alt="5K Pack" width="24" height="24">
      <div class="ix-f-rw-t">
        <span class="ix-f-rw-k">MILESTONE REWARD</span>
        <span class="ix-f-rw-v">${complete ? "ALL VARIANTS COMPLETE" : `${next} MORE VARIANTS → +1 PACK`}</span>
      </div>
    </div>`;
  document.getElementById("ixToolbar").innerHTML=toolbar;
  document.getElementById("ixBody").innerHTML=(list.length?"":`<div class="ix-empty">NO MATCHING RECORDS</div>`)+`<div class="ix-grid">${cells}</div>`;
  lazyMountGrid(document.getElementById("ixBody"),_ixHtml);
  ixLiveShimmer();
  document.getElementById("ixFoot").innerHTML=strip;
  const sel=document.getElementById("ixSort");sel.value=ixState.sort;
  sel.onchange=()=>{ixState.sort=sel.value;ixRender();};
  document.querySelectorAll("#ixToolbar .ix-tab[data-mut]").forEach(b=>b.onclick=()=>{ixState.mut=b.dataset.mut;ixRender();});
  const shb=document.querySelector("#ixToolbar [data-shiny]");if(shb)shb.onclick=()=>{ixState.shiny=!ixState.shiny;ixRender();};
  const owb=document.querySelector("#ixToolbar [data-owned]");if(owb)owb.onclick=()=>{ixState.owned=!ixState.owned;ixRender();};
  document.querySelectorAll("#ixBody .ix-cell").forEach(cell=>{
    cell.onclick=()=>ixSheetOpen(cell.dataset.c,cell.dataset.mut||"none",cell.dataset.shiny==="1");
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
/* ===== TRAIT SCREEN (hazard) — render + picker + filters ===== */
function trOddsLabel(t){
  const n=Math.round(100/t.chance);
  if(t.chance<1)return "1 IN "+fmt(n);
  if(n>=5)return "1 IN "+fmt(n);
  return "WEIGHT "+t.chance+"%";
}
function trHitChance(){
  let sum=0;
  autoTargets.forEach(k=>{if(TRAIT[k])sum+=TRAIT[k].chance;});
  return sum;
}
function trHitText(){
  const hc=trHitChance();
  return hc>=1?(hc.toFixed(2)+"%"):(hc.toFixed(3)+"%");
}
function trTargetStackSafe(){
  const s=traitTargetStack();
  return s||null;
}
/* label kecil di bawah nama kartu subjek: pakai chance asli (tier hanya ada di musuh story) */
function trCardCode(charId){
  const c=CARDS[charId];
  if(!c)return "MATRIX · CARD";
  if(c.chance)return "MATRIX · 1 IN "+(typeof fmtChance==="function"?fmtChance(c.chance):c.chance);
  if(c.tier)return "MATRIX · "+c.tier;
  return "MATRIX · CARD";
}
let trForceRender=false;
function openTrait(){
  traitTarget=null;pendingRare=null;pendingRareAuto=false;
  trForceRender=true;
  renderTrait();
  trForceRender=false;
  document.getElementById("traitModal").classList.add("show");
  document.body.classList.add("trait-open");
  trBannerOpen();
}
function closeTrait(){
  autoStop();
  trClosePick();
  trCloseFilter();
  const m=document.getElementById("traitModal");
  if(!m)return;
  trBannerClose(function(){
    m.classList.remove("show");
    document.body.classList.remove("trait-open");
  });
  hideTraitTip();
}
/* shell minimal untuk state kosong: tetap punya top bar + tombol tutup */
function trEmptyShell(line1,line2){
  return `<div class="ts-shell">
    <header class="ts-top">
      <div class="ts-mark">
        <span class="ts-mark-t">TRAITS</span>
        <span class="ts-mark-s">NEURAL MATRIX MOD</span>
      </div>
      <div class="ts-topmid">
        <div class="ts-crumb"><i></i><span>LAB</span><span class="sep">/</span><b>SYNTHESIS</b><span class="sep">/</span><span>SUBJECT</span></div>
      </div>
      <button class="ts-x" id="trShellClose" aria-label="Close traits" title="Close [ESC]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
      </button>
    </header>
    <div class="ts-left" style="flex:1 1 auto;justify-content:center;align-items:center;text-align:center;gap:10px">
      <div class="ts-kicker"><i></i><b>SUBJECT MATRIX</b></div>
      <div class="ts-tp-note" style="font-size:9px;letter-spacing:.16em;max-width:34ch;line-height:1.8">${line1}<br>${line2}</div>
    </div>
  </div>`;
}
function trBindEmptyShell(){
  const x=document.getElementById("trShellClose");
  if(x)x.onclick=closeTrait;
}
function renderTrait(){
  const b=document.getElementById("trBody");
  if(!b)return;
  /* renderTrait juga dipanggil dari jalur cloud-sync; jangan bangun ulang DOM
     (dan menutup picker/filter) saat layar trait sedang tidak terbuka. */
  const _m=document.getElementById("traitModal");
  if(_m&&!_m.classList.contains("show")&&!trForceRender)return;
  if(!state.stacks.length){
    b.innerHTML=trEmptyShell("NO CARDS IN THE MATRIX.","ROLL A CARD FIRST FROM THE SUMMON TERMINAL.");
    trBindEmptyShell();
    return;
  }
  const tgt=trTargetStackSafe();
  if(!tgt){
    b.innerHTML=trEmptyShell("NO SUBJECT SELECTED.","PICK A CARD TO SYNTHESIZE A TRAIT.");
    trBindEmptyShell();
    return;
  }
  const hasT=!!(tgt.trait&&tgt.trait!=="none");
  const tt=hasT?TRAIT[tgt.trait]:null;
  const tcol=tt?tt.color:"#9A8A8B";
  const aPct=tt?Math.round((tt.atk-1)*100):0;
  const hPct=tt?Math.round((tt.hp-1)*100):0;
  const statHtml=(aPct>0||hPct>0)
    ? (aPct>0?`<span class="ts-stat"><i>ATK</i><b>+${aPct}%</b></span>`:"")+(hPct>0?`<span class="ts-stat"><i>HP</i><b>+${hPct}%</b></span>`:"")
    : `<span class="ts-stat empty"><b>NO STAT MODIFIER</b></span>`;
  const note=tt
    ? (tt.atk>=1.5?"Rare artefact-class modifier. Rolling again will overwrite it.":"Modifier is bound to this subject. Rolling again overwrites it.")
    : "No modifier installed. Roll to synthesize one.";
  const rows=TRAIT_TIERS.filter(t=>t.chance>0).map(t=>{
    const on=autoTargets.has(t.k);
    const active=hasT&&tgt.trait===t.k;
    const w=Math.max(1.5,Math.min(100,(t.chance/55)*100));
    const a=Math.round((t.atk-1)*100),h=Math.round((t.hp-1)*100);
    return `<div class="tsr-row${on?" on":""}${active?" active":""}" data-tk="${t.k}" style="--tcol:${t.color}" role="button" tabindex="0" aria-pressed="${on}">
      <span class="tsr-gem">${traitGem(26,t.k)}</span>
      <span class="tsr-name">${t.name}<span class="tsr-rar">${t.rar}</span>${active?'<span class="tsr-cur">CURRENT</span>':""}</span>
      <span class="tsr-chance">${t.chance}%<small>${trOddsLabel(t)}</small></span>
      <span class="tsr-stats">ATK <b>+${a}%</b> · HP <b>+${h}%</b></span>
      <span class="tsr-bar"><i style="width:${w}%"></i></span>
      <span class="tsr-tgt"><span class="tsr-tgt-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></span>
    </div>`;
  }).join("");
  const nT=autoTargets.size;
  b.innerHTML=`
  <div class="ts-shell">
    <header class="ts-top">
      <div class="ts-mark">
        <span class="ts-mark-t">TRAITS</span>
        <span class="ts-mark-s">NEURAL MATRIX MOD</span>
      </div>
      <div class="ts-topmid">
        <div class="ts-crumb">
          <i></i><span>LAB</span><span class="sep">/</span>
          <b>SYNTHESIS</b><span class="sep">/</span><span>SUBJECT</span>
        </div>
        <div class="ts-topstat">
          <div class="ts-ts"><span class="ts-ts-k">TARGETS</span><span class="ts-ts-v hz" id="tsTgtCount">${nT}</span></div>
          <div class="ts-ts"><span class="ts-ts-k">CHANCE HIT</span><span class="ts-ts-v" id="tsHitChance">${trHitText()}</span></div>
        </div>
      </div>
      <button class="ts-x" id="trShellClose" aria-label="Close traits" title="Close [ESC]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
      </button>
    </header>

    <div class="ts-body">
      <section class="ts-left" aria-label="Trait subject">
        <div class="ts-kicker"><i></i><b>SUBJECT MATRIX</b><span>·</span><span id="tsKickCode">NODE #${tgt.id?String(tgt.id).slice(0,5).toUpperCase():"001"}</span></div>

        <div class="ts-subject">
          <button class="ts-card" id="trPickCard" type="button" title="Change subject card">
            <span class="ts-corner tl"></span><span class="ts-corner tr"></span>
            <span class="ts-corner bl"></span><span class="ts-corner br"></span>
            <span class="ts-card-hint">CLICK TO SWITCH</span>
            <span class="ts-card-scan"></span>
            <img id="tsCardImg" src="${cardThumb(tgt.char)}" alt="" decoding="async">
            <div class="ts-card-meta">
              <div>
                <div class="ts-card-name" id="tsCardName">${cardName(tgt.char)}</div>
                <div class="ts-card-code" id="tsCardCode">${trCardCode(tgt.char)}</div>
              </div>
            </div>
          </button>

          <div class="ts-traitplate" id="tsPlate" style="--tcol:${tcol}">
            <div class="ts-tp-top">
              <span class="ts-tp-gem" id="tsGem">${tt?traitGem(30,tt.k):traitGem(30,"none")}</span>
              <span class="ts-tp-name" id="tsTraitName">${tt?tt.name:"NO TRAIT"}</span>
              <span class="ts-tp-rar" id="tsTraitRar">${tt?tt.rar:"—"}</span>
            </div>
            <div class="ts-tp-stats" id="tsStats">${statHtml}</div>
            <div class="ts-tp-note" id="tsTraitNote">${note}</div>
          </div>

          <div class="ts-actions">
            <button class="ts-btn${autoRoll?" live":""}" id="trAuto"${!autoRoll&&state.coins<TRAIT_COST?" disabled":""}>
              <span id="tsAutoLabel">${autoRoll?"ABORT AUTO":"AUTO ROLL"}</span>
              <small id="tsAutoSub">${autoRoll?"overclock running":"until target hit"}</small>
            </button>
            <button class="ts-btn primary" id="trRoll"${state.coins<TRAIT_COST||autoRoll?" disabled":""}>
              <span>ROLL TRAIT</span>
              <small id="tsRollCost">${fmt(TRAIT_COST)} CR</small>
            </button>
            <button class="ts-btn" id="tsFilterBtn" type="button">
              <span>FILTERS</span>
              <small id="tsFilterSub">${nT} checked</small>
            </button>
          </div>

          <div class="ts-balance">
            <div class="ts-coin">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.4 10h5.2M9.4 14h5.2"/></svg>
              <span>CREDITS</span><b id="trCoinVal">${fmt(state.coins)}</b>
            </div>
            <div class="ts-bal-note"><b>${fmt(TRAIT_COST)} CR</b> PER ROLL · AUTO CHARGES EACH ITERATION</div>
          </div>

          <div class="ts-status${autoRoll?" run":""}" id="tsStatus">
            <span class="dot"></span>
            <span id="tsStatusTxt">${autoRoll?"OVERCLOCK · 100MS":"IDLE · OVERCLOCK 100MS"}</span>
            <span class="iter" id="trAutoN">ITER #${autoRollN}</span>
          </div>
        </div>
      </section>

      <aside class="ts-rail" aria-label="Trait chances">
        <div class="tsr-head">
          <div class="tsr-title">CHANCES <b id="tsrHeadN">(${nT} ARMED)</b></div>
          <div class="tsr-sub">CHECKBOX = AUTO STOP</div>
        </div>
        <div class="tsr-list" id="tsrList">${rows}</div>
        <div class="tsr-foot">
          Probabilities are the live tier weights and total <b>100%</b>.<br>
          Checked traits halt AUTO ROLL the moment one of them hits.
        </div>
      </aside>
    </div>

    <footer class="ts-foot">
      <span><b>CLICK CARD</b> switch subject</span>
      <span><b>CHECK ROW</b> auto stop</span>
      <span class="haz" id="tsFootSel">SUBJECT · ${cardName(tgt.char)}</span>
    </footer>

    <div id="trFilter" aria-hidden="true">
      <div class="flt-box" role="dialog" aria-modal="true" aria-label="Trait filters">
        <div class="flt-head">
          <div class="flt-headl">
            <div class="flt-kick"><i></i><span>// AUTO PROTOCOL <b>MANIFEST</b></span></div>
            <div class="flt-title">FILTERS</div>
            <div class="flt-note">Pick the traits AUTO ROLL should stop at. Unchecked tiers are skipped and the loop keeps spending credits.</div>
          </div>
          <button class="flt-x" id="fltX" aria-label="Close filters" title="Close [ESC]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
        </div>
        <div class="flt-scroll"><div class="flt-grid" id="fltGrid"></div></div>
        <div class="flt-foot">
          <div class="flt-count"><b id="fltCount">${nT}</b> / ${TRAIT_TIERS.filter(t=>t.chance>0).length} TIERS ARMED · <span id="fltPct">${trHitText()}</span> HIT CHANCE</div>
          <div class="flt-actions">
            <button class="flt-btn" id="fltClear" type="button">CLEAR</button>
            <button class="flt-btn primary" id="fltDone" type="button">DONE</button>
          </div>
        </div>
      </div>
    </div>

    <div id="trPick" aria-hidden="true">
      <div class="pck-box" role="dialog" aria-modal="true" aria-label="Choose subject card">
        <div class="pck-head">
          <div class="pck-headl">
            <div class="pck-kick"><i></i><span>// SUBJECT <b>SELECT</b></span></div>
            <div class="pck-title">CHOOSE CARD</div>
            <div class="pck-note">The selected card receives the synthesized trait. Only one subject can be bound at a time.</div>
          </div>
          <button class="pck-x" id="pckX" aria-label="Close card picker" title="Close [ESC]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
        </div>
        <div class="pck-tools">
          <label class="pck-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
            <input id="pckSearch" type="text" placeholder="Search card..." autocomplete="off">
          </label>
          <div class="pck-count"><b id="pckCount">0</b> CARDS</div>
        </div>
        <div class="pck-scroll"><div class="pck-grid" id="pckGrid"></div></div>
      </div>
    </div>
  </div>`;

  const x2=document.getElementById("trShellClose");if(x2)x2.onclick=closeTrait;
  const r=document.getElementById("trRoll");if(r)r.onclick=rollTrait;
  const ab=document.getElementById("trAuto");if(ab)ab.onclick=toggleAuto;
  const pc=document.getElementById("trPickCard");if(pc)pc.onclick=trOpenPick;
  const fb=document.getElementById("tsFilterBtn");if(fb)fb.onclick=trOpenFilter;
  const fx=document.getElementById("fltX");if(fx)fx.onclick=trCloseFilter;
  const fd=document.getElementById("fltDone");if(fd)fd.onclick=trCloseFilter;
  const fc=document.getElementById("fltClear");if(fc)fc.onclick=()=>{autoTargets.clear();trSyncTargets();};
  const px=document.getElementById("pckX");if(px)px.onclick=trClosePick;
  const ps=document.getElementById("pckSearch");if(ps)ps.oninput=()=>trRenderPick(ps.value);
  const flt=document.getElementById("trFilter");
  if(flt)flt.onclick=e=>{if(e.target===flt)trCloseFilter();};
  const pk=document.getElementById("trPick");
  if(pk)pk.onclick=e=>{if(e.target===pk)trClosePick();};
  const list=document.getElementById("tsrList");
  if(list)list.querySelectorAll(".tsr-row").forEach(row=>{
    const k=row.getAttribute("data-tk");
    const act=()=>{if(autoTargets.has(k))autoTargets.delete(k);else autoTargets.add(k);trSyncTargets();};
    row.onclick=act;
    row.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();act();}};
  });
  trRenderFilter();
  trRenderPick("");
}
/* sinkronkan semua penanda target setelah autoTargets berubah */
function trSyncTargets(){
  const n=autoTargets.size;
  const list=document.getElementById("tsrList");
  if(list)list.querySelectorAll(".tsr-row").forEach(row=>{
    const on=autoTargets.has(row.getAttribute("data-tk"));
    row.classList.toggle("on",on);
    row.setAttribute("aria-pressed",on?"true":"false");
  });
  const hc=trHitText();
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set("tsrHeadN","("+n+" ARMED)");
  set("tsTgtCount",String(n));
  set("tsHitChance",hc);
  set("tsFilterSub",n+" checked");
  set("fltCount",String(n));
  set("fltPct",hc);
  const grid=document.getElementById("fltGrid");
  if(grid)grid.querySelectorAll(".flt-tile").forEach(tile=>{
    const on=autoTargets.has(tile.getAttribute("data-tk"));
    tile.classList.toggle("on",on);
    tile.setAttribute("aria-pressed",on?"true":"false");
  });
  const m=document.querySelector("#traitModal .tram-v");
  if(m)m.textContent=targetLabel();
}
function trRenderFilter(){
  const host=document.getElementById("fltGrid");
  if(!host)return;
  host.innerHTML=TRAIT_TIERS.filter(t=>t.chance>0).map(t=>{
    const on=autoTargets.has(t.k);
    return `<button class="flt-tile${on?" on":""}" type="button" data-tk="${t.k}" style="--tcol:${t.color}" aria-pressed="${on}">
      <span class="flt-rar">${t.rar}</span>
      <span class="flt-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
      <span class="flt-gem">${traitGem(38,t.k)}</span>
      <span class="flt-name">${t.name}</span>
      <span class="flt-chance">${t.chance}%<small>${trOddsLabel(t)}</small></span>
    </button>`;
  }).join("");
  host.querySelectorAll(".flt-tile").forEach(tile=>{
    const k=tile.getAttribute("data-tk");
    tile.onclick=()=>{if(autoTargets.has(k))autoTargets.delete(k);else autoTargets.add(k);trSyncTargets();};
  });
}
function trOpenFilter(){
  const f=document.getElementById("trFilter");
  if(!f)return;
  trRenderFilter();
  f.classList.add("on");
  f.setAttribute("aria-hidden","false");
}
function trCloseFilter(){
  const f=document.getElementById("trFilter");
  if(!f)return;
  f.classList.remove("on");
  f.setAttribute("aria-hidden","true");
}
function trFilterOpen(){const f=document.getElementById("trFilter");return !!(f&&f.classList.contains("on"));}
function trRenderPick(q){
  const host=document.getElementById("pckGrid");
  if(!host)return;
  const sel=traitTargetStack();
  const selId=sel?sel.id:null;
  const needle=String(q||"").trim().toLowerCase();
  const list=state.stacks.filter(s=>!needle||cardName(s.char).toLowerCase().indexOf(needle)>=0);
  const cnt=document.getElementById("pckCount");
  if(cnt)cnt.textContent=String(list.length);
  if(!list.length){
    host.innerHTML=`<div class="pck-empty">NO MATCHING CARDS</div>`;
    return;
  }
  host.innerHTML=list.map(s=>{
    const badges=(s.shiny||(s.mut&&s.mut!=="none")||(s.trait&&s.trait!=="none"))
      ? `<span class="pck-badges">${s.shiny?'<span class="shiny-badge shiny-pill">SHINY</span>':""}${s.mut&&s.mut!=="none"?mutChip(s.mut,mutPill(s.mut,"mut-badge")):""}${s.trait&&s.trait!=="none"?traitChip(s.trait,`<span class="trait-badge" style="border-color:${TRAIT_COLOR[s.trait]}">${traitGem(13,s.trait)}</span>`):""}</span>`
      : "";
    return `<button class="pck-card${s.id===selId?" sel":""}" type="button" data-tid="${s.id}" title="${cardName(s.char)}">
      <img src="${cardThumb(s.char)}" alt="" decoding="async">
      ${badges}
      <span class="pck-name">${cardName(s.char)}</span>
    </button>`;
  }).join("");
  host.querySelectorAll(".pck-card").forEach(el=>{
    el.onclick=()=>{
      const tid=el.getAttribute("data-tid");
      if(typeof sfx!=="undefined"&&sfx.hit)sfx.hit();
      traitTarget=tid;
      trClosePick();
      renderTrait();
    };
  });
}
function trOpenPick(){
  const p=document.getElementById("trPick");
  if(!p)return;
  const s=document.getElementById("pckSearch");
  if(s)s.value="";
  trRenderPick("");
  p.classList.add("on");
  p.setAttribute("aria-hidden","false");
}
function trClosePick(){
  const p=document.getElementById("trPick");
  if(!p)return;
  p.classList.remove("on");
  p.setAttribute("aria-hidden","true");
}
function trPickOpen(){const p=document.getElementById("trPick");return !!(p&&p.classList.contains("on"));}
/* ESC: tutup lapisan teratas dulu */
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  const m=document.getElementById("traitModal");
  if(!m||!m.classList.contains("show"))return;
  if(trPickOpen()){trClosePick();return;}
  if(trFilterOpen()){trCloseFilter();return;}
  closeTrait();
});
/* ===== hazard banner (pola #deckCurtain) ===== */
let trHzTimers=[];
function trHzClear(){for(let i=0;i<trHzTimers.length;i++)clearTimeout(trHzTimers[i]);trHzTimers=[];}
function trHzSetCopy(mode){
  const kick=document.getElementById("trHzKick"),title=document.getElementById("trHzTitle"),
        sub=document.getElementById("trHzSub"),foot=document.getElementById("trHzFoot"),
        serial=document.getElementById("trHzSerial"),water=document.getElementById("trHzWater");
  if(serial)serial.textContent=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(mode==="open"){
    if(kick)kick.innerHTML="// NEURAL <b>SYNC</b>";
    if(title)title.textContent="TRAITS";
    if(water)water.textContent="MOD";
    if(sub)sub.textContent="TRAIT MATRIX · MODIFIERS · TARGETS";
    if(foot)foot.textContent="ENTER SYNTHESIS";
  }else{
    if(kick)kick.innerHTML="// LINK <b>STAND BY</b>";
    if(title)title.textContent="HOLD";
    if(water)water.textContent="OUT";
    if(sub)sub.textContent="MATRIX DISCONNECTING · DATA SAVED";
    if(foot)foot.textContent="CLOSE SESSION";
  }
}
function trBannerOpen(){
  const c=document.getElementById("traitCurtain");
  if(!c)return;
  trHzClear();trHzSetCopy("open");
  c.className="";void c.offsetWidth;
  c.classList.add("on","smooth","sweep");
  trHzTimers.push(setTimeout(()=>c.classList.add("revealed"),1080));
  trHzTimers.push(setTimeout(()=>c.classList.remove("on","smooth","sweep","revealed"),1800));
}
function trBannerClose(onCovered){
  const c=document.getElementById("traitCurtain");
  if(!c){if(onCovered)onCovered();return;}
  trHzClear();trHzSetCopy("close");
  c.className="";c.classList.add("on","smooth","revealed");void c.offsetWidth;
  c.classList.remove("revealed");
  trHzTimers.push(setTimeout(()=>{if(onCovered)onCovered();},560));
  trHzTimers.push(setTimeout(()=>c.classList.add("revealed"),780));
  trHzTimers.push(setTimeout(()=>c.classList.remove("on","smooth","revealed"),1560));
}

let cardPickCfg=null;
function openDeckPick(cfg){dpSearch="";cardPickCfg=(cfg&&cfg.getSel&&cfg.onPick)?cfg:null;const m=document.getElementById("deckPickModal");m.classList.toggle("dp-dark",!cardPickCfg);m.classList.add("show");renderDeckPick();}
function closeDeckPick(){document.getElementById("deckPickModal").classList.remove("show");hideTraitTip();cardPickCfg=null;}
function renderDeckPick(){
  const b=document.getElementById("dpBody");
  if(!state.stacks.length){b.innerHTML=`<p class="sub">Deck empty.</p>`;return;}
  const selId=cardPickCfg?cardPickCfg.getSel():traitTargetStack().id;
  _dpHtml={};
  b.innerHTML=`<label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="dpSearch" type="text" placeholder="Search card..." autocomplete="off"></label><div class="dp-grid" id="dpGrid">${state.stacks.map((s,i)=>{
    const inner=`<img src="${cardThumb(s.char)}" alt="" width="96" height="96" decoding="async">
      ${s.shiny||(s.mut&&s.mut!=="none")||(s.trait&&s.trait!=="none")?`<span class="dp-badges">${s.shiny?'<span class="shiny-badge shiny-pill">SHINY</span>':""}${s.mut&&s.mut!=="none"?mutChip(s.mut,mutPill(s.mut,'mut-badge dp-mut')):""}${s.trait&&s.trait!=="none"?traitChip(s.trait,`<span class="trait-badge dp-gem" style="border-color:${TRAIT_COLOR[s.trait]}">${traitGem(13,s.trait)}</span>`):""}</span>`:""}
      <span class="dp-name">${cardName(s.char)}</span>`;
    _dpHtml[s.id]=inner;const mounted=true;
    return `<button class="dp-card${isFullArt(s.char)?" fa":""}${s.id===selId?" sel":""}${s.mut&&s.mut!=="none"?(s.shiny?" dp-mut-shiny-"+s.mut:" dp-mut-"+s.mut):""}${s.shiny?" shiny":""}${mounted?"":" lz-ph"}" data-lz="${s.id}" data-tid="${s.id}" data-name="${cardName(s.char).toLowerCase()}">${mounted?inner:""}</button>`;}).join("")}</div><div class="no-result" id="dpSearch-nr">No matching cards.</div>`;
  {const dps=document.getElementById("dpSearch");if(dps){dps.value=dpSearch;dps.oninput=()=>{dpSearch=dps.value;runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));};if(dpSearch)runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));}}
  b.querySelectorAll(".dp-card").forEach(el=>el.onclick=()=>{const tid=el.getAttribute("data-tid");sfx.hit();if(cardPickCfg){cardPickCfg.onPick(tid);}else{traitTarget=tid;closeDeckPick();renderTrait();}});
  lazyMountGrid(b,_dpHtml);
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
  const nm=tgt?cardName(tgt.char):"target card";
  const body=
    '<div class="glcf-row"><span class="glcf-label">TRAIT</span><span class="glcf-val" style="color:'+t.color+'"><b>'+t.name+'</b> · '+t.rar+'</span></div>'+
    '<div class="glcf-row"><span class="glcf-label">POWER</span><span class="glcf-val">ATK +'+Math.round((t.atk-1)*100)+'% · HP +'+Math.round((t.hp-1)*100)+'%</span></div>'+
    '<div class="glcf-row"><span class="glcf-label">CARD</span><span class="glcf-val">'+nm+'</span></div>'+
    '<div class="glcf-warn">'+(auto
      ? 'Auto roll will start replacing this trait. A trait is only safe when checked as a target (auto stops when hit). Coins left: '+fmt(state.coins)+'.'
      : 'This trait will be <b>overwritten</b> if you roll again. Coins left: '+fmt(state.coins)+'.')+'</div>';
  return showConfirmDialog({title:"RARE TRAIT INSTALLED",body:body,okText:auto?"CONTINUE AUTO":"ROLL AGAIN"}).then(v=>{traitRareBusy=false;return v;});
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
  const k=rollTraitPick();
  sfx.crit();
  if(TRAIT[k] && TRAIT[k].atk>=1.5){ save(); renderShell(); renderTrait(); showRarePrompt(k); }
  else { tgt.trait=k; save(); if(!battleLive()&&typeof render==="function")render(); renderTrait(); traitNotify(k); }
}
function showRarePrompt(k,auto){
  const t=TRAIT[k];if(!t)return;
  pendingRare=k;
  pendingRareAuto=!!auto;
  const b=document.getElementById("trRareBody");
  const canRoll=state.coins>=TRAIT_COST;
  b.innerHTML=`
    <div class="rp-rays"></div>
    ${traitGem(78,k,"rp-gem")}
    <div class="rp-kicker">${auto?"RARE TRAIT · AUTO ROLL STOPPED":"RARE TRAIT"}</div>
    <div class="rp-name" style="color:${t.color}">${t.name}</div>
    <div class="rp-rar" style="color:${t.color}">RARITY ${t.rar}</div>
    <div class="rp-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</div>
    <div class="rp-fx">${traitFxList(k)}</div>
    <div class="rp-btns">
      <button class="rp-btn rp-save" id="rpSave">${auto?"STOP · KEEP THIS":"KEEP"}</button>
      <button class="rp-btn rp-roll" id="rpRoll" ${canRoll?"":"disabled"}>${auto?`ROLL AGAIN · CONTINUE AUTO · ${fmt(TRAIT_COST)} COIN`:`ROLL AGAIN · ${fmt(TRAIT_COST)} COINS`}</button>
    </div>
    <div class="rp-note">${auto?"STOP locks this trait to the target card &amp; halts auto roll. ROLL AGAIN discards this result and continues auto roll (coins charged again).":"KEEP applies this trait to the target card. ROLL AGAIN discards this result and retries (coins charged again)."}</div>`;
  const box=document.getElementById("rpBox");box.style.color=t.color;box.style.borderColor=t.color;
  document.getElementById("rarePromptModal").classList.add("show");
  document.getElementById("rpSave").onclick=saveRare;
  const rr=document.getElementById("rpRoll");if(rr)rr.onclick=auto?resumeAutoRoll:rerollRare;
}
function closeRarePrompt(){document.getElementById("rarePromptModal").classList.remove("show");}
function saveRare(){const k=pendingRare;autoStop();pendingRareAuto=false;const tgt=traitTargetStack();if(tgt&&k)tgt.trait=k;pendingRare=null;closeRarePrompt();save();if(!battleLive()&&typeof render==="function")render();renderTrait();if(k)traitNotify(k);}
function rerollRare(){pendingRare=null;pendingRareAuto=false;closeRarePrompt();rollTrait();}
/* ===== AUTO ROLL (loop 100ms) ===== */
function targetLabel(){return autoTargets.size?[...autoTargets].map(k=>TRAIT[k]?TRAIT[k].name:"").filter(Boolean).join(" · "):"check a row in CHANCES";}
function autoStop(){autoRoll=false;clearTimeout(autoRollTimer);autoRollTimer=null;}
function toggleAuto(){autoRoll?stopAutoRoll():startAutoRoll();}
async function startAutoRoll(){
  if(autoRoll)return;
  if(state.coins<TRAIT_COST){autoToast(`NEED ${fmt(TRAIT_COST)} COINS FOR AUTO ROLL`);return;}
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
  const tcol=tt?tt.color:"#9A8A8B";
  /* --- subject card label + node code --- */
  const cn=document.getElementById("tsCardName");
  if(cn)cn.textContent=cardName(tgt.char);
  const cc=document.getElementById("tsCardCode");
  if(cc)cc.textContent=trCardCode(tgt.char);
  const fs=document.getElementById("tsFootSel");
  if(fs)fs.textContent="SUBJECT · "+cardName(tgt.char);
  /* --- trait plate --- */
  const plate=document.getElementById("tsPlate");
  if(plate)plate.style.setProperty("--tcol",tcol);
  const gem=document.getElementById("tsGem");
  if(gem)gem.innerHTML=tt?traitGem(30,tt.k):traitGem(30,"none");
  const nm=document.getElementById("tsTraitName");
  if(nm)nm.textContent=tt?tt.name:"NO TRAIT";
  const rar=document.getElementById("tsTraitRar");
  if(rar)rar.textContent=tt?tt.rar:"—";
  const aPct=tt?Math.round((tt.atk-1)*100):0;
  const hPct=tt?Math.round((tt.hp-1)*100):0;
  const stats=document.getElementById("tsStats");
  if(stats)stats.innerHTML=(aPct>0||hPct>0)
    ? (aPct>0?`<span class="ts-stat"><i>ATK</i><b>+${aPct}%</b></span>`:"")+(hPct>0?`<span class="ts-stat"><i>HP</i><b>+${hPct}%</b></span>`:"")
    : `<span class="ts-stat empty"><b>NO STAT MODIFIER</b></span>`;
  const note=document.getElementById("tsTraitNote");
  if(note)note.textContent=tt
    ? (tt.atk>=1.5?"Rare artefact-class modifier. Rolling again will overwrite it.":"Modifier is bound to this subject. Rolling again overwrites it.")
    : "No modifier installed. Roll to synthesize one.";
  /* --- rail: pindahkan penanda CURRENT + warna ikon --- */
  root.querySelectorAll(".tsr-row").forEach(row=>{
    const k=row.getAttribute("data-tk");
    const own=(!!tt&&k===tt.k);
    row.classList.toggle("active",own);
    const nameBox=row.querySelector(".tsr-name");
    if(!nameBox)return;
    const old=nameBox.querySelector(".tsr-cur");
    if(old)old.remove();
    if(own){
      const flag=document.createElement("span");
      flag.className="tsr-cur";
      flag.textContent="CURRENT";
      nameBox.appendChild(flag);
    }
  });
}
function autoPaint(){
  const cv=document.getElementById("coinVal");if(cv)cv.textContent=fmt(state.coins);
  const c=document.getElementById("trCoinVal");if(c)c.textContent=fmt(state.coins);
  const n=document.getElementById("trAutoN");if(n)n.textContent="ITER #"+autoRollN;
}
/* FX per tick auto roll: retrigger class supaya animasi CSS jalan tiap roll */
function traitFxTick(k){
  const root=document.getElementById("traitModal");if(!root)return;
  const t=TRAIT[k];
  const plate=document.getElementById("tsPlate");
  if(plate){
    if(t)plate.style.setProperty("--tcol",t.color);
    plate.classList.remove("tr-tick");void plate.offsetWidth;plate.classList.add("tr-tick");
  }
  const n=document.getElementById("trAutoN");
  if(n){n.classList.remove("tr-n-pop");void n.offsetWidth;n.classList.add("tr-n-pop");}
  root.querySelectorAll(".tsr-row.trr-hit").forEach(el=>el.classList.remove("trr-hit"));
  const own=root.querySelector(".tsr-row.active");
  if(own){void own.offsetWidth;own.classList.add("trr-hit");}
}
function autoTick(){
  if(!autoRoll)return;
  if(state.coins<TRAIT_COST){stopAutoRoll();save();renderShell();autoToast("AUTO ROLL STOP · OUT OF COINS");return;}
  const tgt=traitTargetStack();if(!tgt){stopAutoRoll();return;}
  coinSpend(TRAIT_COST);autoRollN++;
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

