/* =============== BOSS RAID (World Boss Hub + Engine) =============== */
let raid=null, raidView="hub", raidPicked=null;
/* ===== WORLD BOSS (daily, server-authoritative score, attempts & milestones) =====
   Attempt is deducted when run STARTS on server. Guest/offline plays locally
   without touching server quotas or rankings. */
let wb=null, wbAt=0, wbLoading=false, wbRunId=null, wbStarting=false, wbErr=false;
const wbByBoss={a:null,b:null};
let wbRunBoss=null;
const WB_TTL=60000;
const WB_RETRY=8000;

let wbHubTab="milestones";
let _wbPrevRoute="";
let _wbClosing=false;
let wbStrikerSearch="";
let wbAutoTimer=null;
let wbMsBusy=false;
let wbHubKeyHandler=null;
let wbToastTimer=0;
let wbHzTimers=[];
const wbGuestByBoss={};

if(!window.__wbRouteTrack){
  window.__wbRouteTrack=true;
  window.addEventListener("hashchange",()=>{
    const r=(typeof route==="function")?route():(location.hash||"#/");
    if(r!=="#/raid"){
      _wbPrevRoute=r;
      _wbClosing=false;
      wbClearHz(true);
    }
  });
}

function wbOnline(){return !!((typeof currentUser!=="undefined"&&currentUser)&&window.CloudDB&&typeof window.CloudDB.wbState==="function");}
function wbBossName(id){const b=RAID_BOSSES.find(x=>x.id===id)||RAID_BOSSES[0];return b?b.name:"WORLD BOSS";}
function wbJakartaDay(){
  const j=new Date(Date.now()+7*3600e3);
  return j.getUTCFullYear()+"-"+String(j.getUTCMonth()+1).padStart(2,"0")+"-"+String(j.getUTCDate()).padStart(2,"0");
}
function wbGuestState(i){
  const b=WB_BOSSES[i==null?wbBossIdx:i]||WB_BOSSES[0];
  const day=wbJakartaDay();
  let g=wbGuestByBoss[b.key];
  if(!g||g.day!==day){
    g={day,pool:WB_POOL_HP,left:WB_POOL_HP,attempts_left:3,best_dmg:0,total_dmg:0,claimed:[],total_players:1,yclaimed:false};
    wbGuestByBoss[b.key]=g;
  }
  return g;
}

function wbModText(){
  const d=wbData();
  const m=d&&d.modifier;
  if(m&&m.label){
    const p=[];
    if(m.hp_pct)p.push("HP "+(m.hp_pct>0?"+":"")+m.hp_pct+"%");
    if(m.atk_pct)p.push("ATK "+(m.atk_pct>0?"+":"")+m.atk_pct+"%");
    return m.label+(p.length?" · "+p.join(" · "):"");
  }
  return wbBoss().mod||"STANDARD FIELD";
}

/* ===== 2 WORLD BOSSES — separate pools, leaderboards, attempts & milestones ===== */
const WB_BOSSES=[
  {key:"a",id:"RAID_ETERNAL_DRAGON",board:"world_boss",name:"ETERNAL DRAGON",tab:"DRAGON",tag:"EX · WORLD BOSS",
   skill:"Galaxy Roar",mod:"GRAVITY SURGE",atk:15000,color:"#22d3ee",
   passive:"Armored cosmic drake that unleashes Galaxy Roar across a 10-turn solo duel. Every hit contributes directly to the shared 10B pool.",
   art:"assets/cards/art/eternal-dragon.webp",alt:false,holo:"#22d3ee",mag:"#FF3DAE",locked:false},
  {key:"b",id:"RAID_SHADOW_KING",board:"world_boss_b",name:"SHADOW KING",tab:"SHADOW",tag:"EX · WORLD BOSS",
   skill:"Umbra Eclipse",mod:"SHADOW TIDE",atk:16500,color:"#a855f7",
   passive:"Sovereign of Abyssal Echoes wielding Umbra Eclipse. High attack pressure against unshielded strikers across 10 turns.",
   art:"assets/cards/art/shadow-king.webp",alt:true,holo:"#a855f7",mag:"#FF3DAE",locked:false}
];
let wbBossIdx=0;
function wbBoss(){return WB_BOSSES[wbBossIdx]||WB_BOSSES[0];}
function wbSyncCur(){const k=wbBoss().key;wb=wbByBoss[k]||null;}
function wbData(i){const b=WB_BOSSES[i==null?wbBossIdx:i]||WB_BOSSES[0];return wbByBoss[b.key]||null;}
function wbAttOf(i){
  const b=WB_BOSSES[i==null?wbBossIdx:i];
  if(!b)return null;
  if(!wbOnline())return wbGuestState(i).attempts_left;
  const d=wbByBoss[b.key];
  if(d&&typeof d.attempts_left==="number")return d.attempts_left;
  if(d&&typeof d.attempts_used==="number")return Math.max(0,3-d.attempts_used);
  return b.locked?null:3;
}
function wbAttLabel(){
  return WB_BOSSES.map((b,i)=>{const n=wbAttOf(i);return b.key.toUpperCase()+" "+(n==null?"—":n+"/3");}).join(" · ");
}
function wbReduceMotion(){return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches);}
function wbBossOf(diff){return raidBossOf(diff);}

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
    if(okAny&&!silent&&route()==="#/raid"&&raidView==="hub"){
      if(document.getElementById("wbView"))wbPatchHubDOM();
      else renderRaidHub();
    }
    return wb;
  }).catch(()=>{wbLoading=false;wbErr=true;return wb;});
}

function fmtBig(n){
  n=Number(n)||0;
  const u=[[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];
  for(const [d,s] of u)if(n>=d){const v=Math.round(n/d*100)/100;return v.toLocaleString("en-US")+s;}
  return fmt(n);
}

function wbPoolVals(i){
  if(!wbOnline()){const g=wbGuestState(i);return {pool:g.pool,left:g.left};}
  const d=wbData(i);
  const pool=Number(d&&d.hp_pool)||WB_POOL_HP;
  if(!d)return {pool,left:pool};
  const raw=typeof d.hp_left==="number"?d.hp_left:pool;
  return {pool,left:Math.max(0,Math.min(pool,raw))};
}

function wbBestRunDmg(i){
  if(!wbOnline())return wbGuestState(i).best_dmg||0;
  const d=wbData(i);
  return Number(d&&d.best_dmg)||0;
}

function wbTotalDmg(i){
  if(!wbOnline())return wbGuestState(i).total_dmg||0;
  const d=wbData(i);
  if(d&&typeof d.total_dmg==="number")return Math.max(0,d.total_dmg);
  return Number(d&&d.best_dmg)||0;
}

function wbMilestonesClaimed(i){
  if(!wbOnline())return wbGuestState(i).claimed||[];
  const d=wbData(i);
  return Array.isArray(d&&d.milestones_claimed)?d.milestones_claimed.map(Number):[];
}

/* Daily reset matches lb_day() server: midnight Asia/Jakarta (UTC+7). */
function wbResetText(){
  const now=Date.now(), jkt=new Date(now+7*3600e3);
  const next=Date.UTC(jkt.getUTCFullYear(),jkt.getUTCMonth(),jkt.getUTCDate()+1)-7*3600e3;
  const ms=Math.max(0,next-now), h=Math.floor(ms/3600e3), m=Math.floor(ms%3600e3/60e3);
  return h>0?h+"h "+m+"m":m+"m";
}

function wbEsc(s){const v=String(s==null?"":s);return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function wbIconU(p){try{return new URL(p,document.baseURI||location.href).href}catch(e){return p}}

const WBV2_BRACKETS=[
  {tag:"#1 MVP",gems:1000,tokens:10000,packs:10,title:"APEX SLAYER"},
  {tag:"#2 RUNNER-UP",gems:500,tokens:5000,packs:5},
  {tag:"#3 PODIUM",gems:250,tokens:2500,packs:3},
  {tag:"Everyone",gems:100,tokens:1000,packs:1}
];

/* Calibrated to live DB world_boss_runs distribution & migration 0043_wb_milestones.sql */
const WB_MILESTONES=[
  {tier:1,req:25000,tokens:150,gems:0,pack:null,packQty:0,luck1:2,luck3:0,speed3:0,
   rewards:[{svg:"wbTokSvg",qty:150,label:"WB Tokens"},{img:"assets/images/pot-luck-1.webp",qty:2,label:"Luck Potion L1"}]},
  {tier:2,req:100000,tokens:300,gems:25,pack:null,packQty:0,luck1:0,luck3:0,speed3:0,
   rewards:[{svg:"wbTokSvg",qty:300,label:"WB Tokens"},{img:"assets/images/premium-currency.webp",qty:25,label:"Premium Gems"}]},
  {tier:3,req:500000,tokens:500,gems:0,pack:"r5k",packQty:2,luck1:0,luck3:0,speed3:0,
   rewards:[{svg:"wbTokSvg",qty:500,label:"WB Tokens"},{img:"assets/images/instanpack-5k.webp",qty:2,label:"5K Instant Pack"}]},
  {tier:4,req:2000000,tokens:850,gems:50,pack:null,packQty:0,luck1:0,luck3:0,speed3:1,
   rewards:[{svg:"wbTokSvg",qty:850,label:"WB Tokens"},{img:"assets/images/premium-currency.webp",qty:50,label:"Premium Gems"},{img:"assets/images/pot-speed-3.webp",qty:1,label:"Speed Potion L3"}]},
  {tier:5,req:5000000,tokens:1250,gems:0,pack:"r25k",packQty:1,luck1:0,luck3:0,speed3:0,
   rewards:[{svg:"wbTokSvg",qty:1250,label:"WB Tokens"},{img:"assets/images/instanpack-25k.webp",qty:1,label:"25K Instant Pack"}]},
  {tier:6,req:15000000,tokens:2000,gems:100,pack:null,packQty:0,luck1:0,luck3:2,speed3:0,
   rewards:[{svg:"wbTokSvg",qty:2000,label:"WB Tokens"},{img:"assets/images/premium-currency.webp",qty:100,label:"Premium Gems"},{img:"assets/images/pot-luck-3.webp",qty:2,label:"Luck Potion L3"}]},
  {tier:7,req:40000000,tokens:3500,gems:150,pack:"r100k",packQty:1,luck1:0,luck3:0,speed3:0,
   rewards:[{svg:"wbTokSvg",qty:3500,label:"WB Tokens"},{img:"assets/images/instanpack-100k.webp",qty:1,label:"100K Instant Pack"},{img:"assets/images/premium-currency.webp",qty:150,label:"Premium Gems"}]}
];

/* Leaderboard state (live get_leaderboard RPC) */
const wbLbS={board:null,rows:null,me:null,busy:false,err:false};
function wbLbFetch(board){
  const bTarget=board||wbBoss().board;
  wbLbS.board=bTarget;
  if(!(window.CloudDB&&typeof window.CloudDB.leaderboard==="function")||!wbOnline()){
    wbLbS.rows=null;wbLbS.me=null;wbLbS.busy=false;wbLbS.err=false;
    wbRenderMvp();
    wbRenderLeftMvp();
    return;
  }
  wbLbS.busy=true;wbLbS.err=false;
  wbRenderMvp();
  window.CloudDB.leaderboard(bTarget,null,50,typeof currentUser!=="undefined"?currentUser:null)
    .then(res=>{
      if(wbLbS.board!==bTarget)return;
      wbLbS.busy=false;
      if(res&&res.ok!==false){wbLbS.rows=res.rows||[];wbLbS.me=res.me||null;}
      else{wbLbS.rows=null;wbLbS.err=true;}
    })
    .catch(()=>{if(wbLbS.board===bTarget){wbLbS.busy=false;wbLbS.rows=null;wbLbS.err=true;}})
    .finally(()=>{
      if(route()==="#/raid"&&raidView==="hub"){
        wbRenderMvp();
        wbRenderLeftMvp();
      }
    });
}
const WBV2_AV_PATH=/^assets\/[A-Za-z0-9._/-]+\.(webp|png|jpg|jpeg)$/;

async function wbClaimMilestone(tier){
  const m=WB_MILESTONES.find(x=>x.tier===tier);
  if(!m||wbMsBusy)return;
  const b=wbBoss();
  const dmg=wbTotalDmg();
  const claimed=wbMilestonesClaimed();
  if(dmg<m.req){raidToast("Deal "+fmtBig(m.req)+" cumulative damage to unlock Milestone "+tier+".");return;}
  if(claimed.includes(tier)){raidToast("Milestone "+tier+" already claimed today.");return;}

  if(!wbOnline()){
    const g=wbGuestState();
    g.claimed.push(tier);
    state.wbTokens=(state.wbTokens||0)+m.tokens;
    if(m.gems)state.premiumGems=(state.premiumGems||0)+m.gems;
    if(m.pack&&m.packQty){
      state.rollPacks=state.rollPacks||{r5k:0,r10k:0,r25k:0,r50k:0,r100k:0};
      state.rollPacks[m.pack]=(state.rollPacks[m.pack]||0)+m.packQty;
    }
    state.luckPots=state.luckPots||[0,0,0];
    state.speedPots=state.speedPots||[0,0,0];
    if(m.luck1)state.luckPots[0]=(state.luckPots[0]||0)+m.luck1;
    if(m.luck3)state.luckPots[2]=(state.luckPots[2]||0)+m.luck3;
    if(m.speed3)state.speedPots[2]=(state.speedPots[2]||0)+m.speed3;
    try{save();renderShell();}catch(e){}
    try{sfx.crit();}catch(e){}
    wbPatchHubDOM();
    raidToast("MILESTONE "+tier+" CLAIMED! Rewards delivered.");
    return;
  }

  wbMsBusy=true;
  let res=null;
  try{
    if(typeof pushCloudNow==="function")await pushCloudNow();
    res=await window.CloudDB.wbClaimMilestone(currentUser,b.id,tier);
  }catch(e){
    res={ok:false,msg:"NETWORK"};
  }finally{
    wbMsBusy=false;
  }
  if(!res||res.ok===false){
    const d=wbData();
    if(res&&res.msg==="ALREADY_CLAIMED"&&d){
      d.milestones_claimed=Array.from(new Set([...(d.milestones_claimed||[]),tier]));
    }
    const why=res&&res.msg==="ALREADY_CLAIMED"?"Milestone already claimed today":
              res&&res.msg==="NOT_REACHED"?"Threshold not reached yet":
              "Failed to claim milestone — try again";
    raidToast(why);
    wbPatchHubDOM();
    return;
  }
  const d=wbData()||(wbByBoss[b.key]={});
  d.milestones_claimed=Array.isArray(res.milestones_claimed)?res.milestones_claimed:Array.from(new Set([...(d.milestones_claimed||[]),tier]));
  if(typeof res.total_dmg==="number")d.total_dmg=res.total_dmg;
  wbAt=Date.now();
  try{save();renderShell();}catch(e){}
  try{sfx.crit();}catch(e){}
  wbPatchHubDOM();
  raidToast("MILESTONE "+tier+" CLAIMED! +"+fmt(res.tokens||m.tokens)+" WB Tokens"+(res.gems?" · +"+fmt(res.gems)+" Gems":""));
}

async function wbClaim(){
  if(wbLoading||!wbOnline())return;
  const b=wbBoss(), d=wbData();
  wbLoading=true;
  let res=null;
  try{
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
    if(raidView==="hub")wbPatchHubDOM();
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
  try{sfx.crit();}catch(e){}
  showWbRewardModal(res);
  wbRefresh(true,true).then(()=>{if(raidView==="hub")wbPatchHubDOM();});
}

function showWbRewardModal(res){
  if(!res||res.ok===false)return;
  const old=document.getElementById("wbRewardModal");if(old)old.remove();
  const pack=res.packs||0;
  const rank=res.rank?`#${res.rank}`:"&mdash;";
  const sub=res.total_players?`<span class="wrm-rank-sub">/ ${fmt(res.total_players)} hunters</span>`:"";
  const title=res.title?`<div class="wrm-title">&#9733; ${wbEsc(res.title)}</div>`:"";
  const el=document.createElement("div");
  el.id="wbRewardModal";el.className="wrm-overlay";
  el.innerHTML=`
    <div class="wrm-card">
      <div class="wrm-sweep"></div>
      <div class="wrm-kicker">WORLD BOSS &middot; REWARD CLAIMED</div>
      <div class="wrm-rank">${rank}${sub}</div>
      ${title}
      <div class="wrm-rewards">
        <div class="wrm-rw" style="--d:.06s">
          <div class="wrm-rw-ic"><img src="assets/images/premium-currency.webp" alt="Gems"></div>
          <div class="wrm-rw-amt">+${fmt(res.gems||0)}</div>
          <div class="wrm-rw-lbl">GEMS</div>
        </div>
        <div class="wrm-rw" style="--d:.16s">
          <div class="wrm-rw-ic wrm-tok"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h6M9 14h6"/></svg></div>
          <div class="wrm-rw-amt">+${fmt(res.tokens||0)}</div>
          <div class="wrm-rw-lbl">WB TOKENS</div>
        </div>
        ${pack>0?`<div class="wrm-rw" style="--d:.26s">
          <div class="wrm-rw-ic"><img src="assets/images/instanpack-100k.webp" alt="Pack"></div>
          <div class="wrm-rw-amt">&times;${fmt(pack)}</div>
          <div class="wrm-rw-lbl">100K INSTANT PACK</div>
        </div>`:""}
      </div>
      <button class="wrm-close" type="button">CLOSE</button>
    </div>`;
  document.body.appendChild(el);
  const close=()=>{el.classList.remove("in");el.classList.add("out");clearTimeout(el._t);el._t=setTimeout(()=>el.remove(),280);};
  el.querySelector(".wrm-close").onclick=close;
  el.addEventListener("click",e=>{if(e.target===el)close();});
  requestAnimationFrame(()=>el.classList.add("in"));
}

function wbClearHz(forceResetClass){
  for(let i=0;i<wbHzTimers.length;i++)clearTimeout(wbHzTimers[i]);
  wbHzTimers=[];
  if(forceResetClass){
    const hz=document.getElementById("wbCurtain");
    if(hz)hz.className="";
  }
}
function stopRaid(){
  clearTimeout(wbAutoTimer);wbAutoTimer=null;
  _wbClosing=false;
  wbClearHz(true);
  if(raid){if(raid.timer)clearTimeout(raid.timer);raid=null;}
  if(typeof fightTimer!=="undefined"&&fightTimer){clearTimeout(fightTimer);fightTimer=null;}
  wbRunId=null;wbRunBoss=null;wbStarting=false;
  ["wbInfoDlg","wbStrikerDlg"].forEach(id=>{
    const d=document.getElementById(id);
    if(d&&d.open)try{d.close();}catch(e){}
  });
  raidView="hub";
  const r=(typeof route==="function")?route():(location.hash||"#/");
  if(r!=="#/raid"){
    _wbPrevRoute=r;
    _wbClosing=false;
  }
}

function raidToast(msg){
  const hubToast=document.getElementById("wbToast");
  if(hubToast){
    hubToast.textContent=msg;
    hubToast.classList.add("show");
    clearTimeout(wbToastTimer);
    wbToastTimer=setTimeout(()=>hubToast.classList.remove("show"),2400);
    return;
  }
  let el=document.getElementById("raidToast");
  if(!el){el=document.createElement("div");el.id="raidToast";document.body.appendChild(el);}
  el.textContent=msg;el.classList.add("show");
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),2200);
}

function renderRaid(){
  hoverHide();
  document.body.classList.toggle("on-raid",route()==="#/raid");
  if(raidView!=="hub")wbrStopPoll();else if(window.cgGameplayStop)window.cgGameplayStop();
  if(raidView==="battle")return renderRaidBattle();
  if(raidView==="result")return renderRaidResult();
  renderRaidHub();
}

function wbSelectedStriker(){
  const list=state&&Array.isArray(state.stacks)?state.stacks:[];
  if(!list.length)return null;
  if(raidPicked){
    const hit=list.find(s=>s.id===raidPicked.id);
    if(hit){raidPicked=hit;return hit;}
  }
  if(state.wbStrikerId){
    const saved=list.find(s=>s.id===state.wbStrikerId);
    if(saved){raidPicked=saved;return saved;}
  }
  const eq=(typeof equipped==="function"&&equipped())||list[0];
  raidPicked=eq||list[0];
  return raidPicked;
}

function wbEstRunDmg(s){
  if(!s)return 0;
  try{
    const st=cardStats(s.char,s.mut,s.trait,s.shiny);
    return Math.round((st.atk||0)*RAID_TURNS);
  }catch(e){return 0;}
}

function wbBossMetaOf(b){
  const rb=(typeof RAID_BOSSES!=="undefined"&&RAID_BOSSES.find(x=>x.id===b.id))||{};
  return {
    atk:rb.atk||b.atk||15000,
    skill:rb.skill||b.skill||"Galaxy Roar",
    art:b.art||rb.img||"assets/cards/art/eternal-dragon.webp"
  };
}

function wbRenderLeftMvp(){
  const el=document.getElementById("wbMvpNowTxt");
  if(!el)return;
  const rows=wbLbS.rows||[];
  if(wbOnline()&&wbLbS.board===wbBoss().board&&rows.length){
    const top=rows[0];
    el.innerHTML="MVP NOW: <b>"+wbEsc(top.username)+"</b> ("+fmtBig(top.value)+")";
  }else if(!wbOnline()){
    const best=wbBestRunDmg();
    el.innerHTML=best>0?"LOCAL PEAK: <b>YOU</b> ("+fmtBig(best)+")":"MVP NOW: <b>Log in for Global</b>";
  }else{
    el.innerHTML="MVP NOW: <b>Nobody yet</b>";
  }
}

function wbRenderHeaderAndLeft(){
  const b=wbBoss();
  const meta=wbBossMetaOf(b);
  const {pool,left:poolLeft}=wbPoolVals();
  const pct=pool>0?Math.max(0,Math.min(100,poolLeft/pool*100)):0;
  const dead=poolLeft<=0||!!b.locked;
  const att=wbAttOf(wbBossIdx);
  const totalDmg=wbTotalDmg();
  const bestDmg=wbBestRunDmg();
  const msDone=WB_MILESTONES.filter(m=>totalDmg>=m.req).length;
  const resetStr=wbResetText();

  const hTok=document.getElementById("wbHdrTokens");
  if(hTok)hTok.textContent="TOKENS: "+fmt(state.wbTokens||0);
  const hRst=document.getElementById("wbHdrReset");
  if(hRst)hRst.textContent="RESET: "+resetStr.toUpperCase();

  document.querySelectorAll("#wbView .wb-bsw-btn").forEach((btn,idx)=>{
    btn.setAttribute("aria-pressed",idx===wbBossIdx?"true":"false");
  });

  const nm=document.getElementById("wbBossName");if(nm)nm.textContent=b.name;
  const tg=document.getElementById("wbBossTag");if(tg)tg.textContent=b.tag;
  const img=document.getElementById("wbBossArtImg");
  if(img){
    img.onerror=()=>{img.onerror=null;img.src="assets/cards/art/eternal-dragon.webp";};
    if(img.getAttribute("src")!==meta.art)img.src=meta.art;
    img.alt=b.name;
  }

  const pill=document.getElementById("wbBossStatusPill");
  if(pill)pill.classList.toggle("is-dead",dead);
  const stTxt=document.getElementById("wbBossStatusTxt");
  if(stTxt){
    stTxt.innerHTML=b.locked?"<b>LOCKED</b> — Boss opens after update":
      (poolLeft<=0?"<b>DEFEATED</b> — Next spawn in "+resetStr:"<b>ACTIVE</b> — Daily Reset in "+resetStr);
  }

  const fill=document.getElementById("wbBossHpFill");
  if(fill)fill.style.width=(b.locked?0:pct).toFixed(1)+"%";
  const hpTxt=document.getElementById("wbBossHpTxt");
  if(hpTxt)hpTxt.textContent=b.locked?"LOCKED":fmtBig(poolLeft)+" / "+fmtBig(pool)+" HP ("+pct.toFixed(1)+"%)";

  const badge=document.getElementById("wbBossDmgBadge");
  if(badge){
    badge.innerHTML=bestDmg>0
      ?"<small>YOUR PEAK RUN</small>"+fmtBig(bestDmg)+" DMG"
      :"<small>BOSS ATK</small>"+fmt(meta.atk)+" ATK";
  }

  const pline=document.getElementById("wbPersonalStatsLine");
  if(pline){
    pline.innerHTML="Your damage: <b>"+fmtBig(totalDmg)+"</b> &middot; Milestones: <b>"+msDone+"/7</b>";
  }

  const crys=document.getElementById("wbAttemptCrystals");
  if(crys){
    const n=Math.min(3,Math.max(0,att==null?0:att));
    crys.innerHTML=[0,1,2].map(i=>`<span class="wb-cr${i<n?"":" off"}"></span>`).join("");
    crys.setAttribute("aria-label",n+" of 3 attempts remaining");
  }

  wbRenderLeftMvp();

  const autoBtn=document.getElementById("wbBtnAutoRepeat");
  if(autoBtn){
    autoBtn.classList.toggle("on",!!state.wbAutoRepeat);
    autoBtn.setAttribute("aria-pressed",state.wbAutoRepeat?"true":"false");
  }
  const autoTxt=document.getElementById("wbAutoRepeatTxt");
  if(autoTxt)autoTxt.textContent="AUTO REPEAT: "+(state.wbAutoRepeat?"ON":"OFF");

  const striker=wbSelectedStriker();
  const sCard=(striker&&CARDS[striker.char])||null;
  const sThumb=document.getElementById("wbStrikerThumb");
  const sName=document.getElementById("wbStrikerName");
  if(sThumb){
    sThumb.src=striker?cardThumb(striker.char):"assets/cards/thumb/sun-god.webp";
    sThumb.alt=sCard?sCard.name:"Striker";
  }
  if(sName)sName.textContent=sCard?sCard.name:"SELECT CARD";

  const fBtn=document.getElementById("wbBtnFight");
  if(fBtn){
    if(b.locked){
      fBtn.textContent="BOSS LOCKED";
      fBtn.classList.add("disabled");
    }else if(poolLeft<=0){
      fBtn.textContent="BACK IN "+resetStr.toUpperCase();
      fBtn.classList.add("disabled");
    }else if(att!=null&&att<=0){
      fBtn.textContent="NO ATTEMPTS · "+resetStr.toUpperCase();
      fBtn.classList.add("disabled");
    }else{
      fBtn.textContent="FIGHT BOSS ("+(att==null?3:att)+"/3)";
      fBtn.classList.remove("disabled");
    }
  }
}

function wbRenderMilestones(){
  const el=document.getElementById("wbMsList");
  const callout=document.getElementById("wbMsCallout");
  if(!el)return;
  const b=wbBoss();
  const dmg=wbTotalDmg();
  const claimedSet=new Set(wbMilestonesClaimed());
  if(callout){
    callout.textContent="YOUR cumulative damage on "+b.name+" today (every run adds up) — each milestone pays guaranteed rewards once per reset.";
  }

  let readyCount=0;
  el.innerHTML=WB_MILESTONES.map(m=>{
    const pct=Math.max(0,Math.min(100,Math.floor((dmg/m.req)*100)));
    const reached=dmg>=m.req;
    const claimed=claimedSet.has(m.tier);
    const ready=reached&&!claimed;
    if(ready)readyCount++;
    const cls=claimed?" claimed":(ready?" ready":"");
    const tag=claimed?"CLAIMED":(ready?"READY":"LOCKED");
    const slots=m.rewards.map(rw=>{
      const media=rw.svg
        ?`<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${rw.svg}"/></svg>`
        :`<img src="${rw.img}" alt="${wbEsc(rw.label)}" decoding="async">`;
      return `<span class="wb-rw-slot" title="${wbEsc(rw.label)} &times;${rw.qty}">${media}<b>&times;${rw.qty}</b></span>`;
    }).join("");
    return `<div class="wb-ms-card${cls}">
      <div class="wb-ms-info">
        <div class="wb-ms-title">Milestone ${m.tier} <span class="wb-ms-tag">${tag}</span></div>
        <div class="wb-ms-req">Deal <b>${fmtBig(m.req)}</b> damage to ${wbEsc(b.name)}</div>
      </div>
      <div class="wb-ms-prog">
        <span class="wb-ms-pct">${pct}%</span>
        <span class="wb-ms-bar"><i style="width:${pct}%"></i></span>
      </div>
      <div class="wb-ms-rw-wrap">
        <div class="wb-rw-slots">${slots}</div>
        ${ready?`<button type="button" class="wb-ms-claim" data-claim-ms="${m.tier}">CLAIM</button>`:""}
      </div>
    </div>`;
  }).join("");

  const badge=document.getElementById("wbMsBadge");
  if(badge){
    badge.hidden=readyCount===0;
    badge.textContent=String(readyCount);
  }
  el.querySelectorAll("[data-claim-ms]").forEach(btn=>{
    btn.onclick=()=>wbClaimMilestone(Number(btn.dataset.claimMs));
  });
}

function wbsMeta(it){
  if(it.id==="gem")            return {cat:"EXCHANGE",   tier:"GEM",    ac:"#ffd700",art:"assets/images/premium-currency.webp"};
  if(it.id==="coins")          return {cat:"CREDITS",    tier:"COINS",  ac:"#ffd27a",art:"assets/icons/coins-gold.svg"};
  if(it.id==="card_edragon")   return {cat:"EX CORE",    tier:"1 IN 25M",ac:"#22d3ee",art:"assets/cards/art/eternal-dragon.webp"};
  if(it.id==="card_shadowking")return {cat:"EX CORE",    tier:"1 IN 100M",ac:"#a855f7",art:"assets/cards/art/shadow-king.webp"};
  if(it.id==="helm-abyss")     return {cat:"RELIC GEAR", tier:"MYTHIC", ac:"#ffb703",art:"assets/artifacts/abyss-helm.webp"};
  if(it.id==="nebula-wisp")    return {cat:"RELIC GEAR", tier:"COSMIC", ac:"#7df9ff",art:"assets/pets/nebula-wisp.webp"};
  if(it.id.indexOf("luck")===0)  return {cat:"AUGMENT",   tier:"MK-"+it.id.replace("luck",""),  ac:"#4ade80",art:"assets/images/pot-luck-"+it.id.replace("luck","")+".webp"};
  if(it.id.indexOf("speed")===0) return {cat:"OVERCLOCK", tier:"MK-"+it.id.replace("speed",""), ac:"#fbbf24",art:"assets/images/pot-speed-"+it.id.replace("speed","")+".webp"};
  return {cat:"SUPPLY",tier:"SPEC",ac:"#f5f5f5",art:"assets/icons/coins-gold.svg"};
}
function wbsIsOwned(it){
  if(it.card)return stackHas(it.card.char,it.card.mut)||!!(state.raidShopOwned&&state.raidShopOwned[it.card.char]);
  if(it.owned)return !!it.owned();
  return false;
}
function wbsStock(it,owned){
  if(owned)return "OWNED";
  if(it.id==="gem"||it.id==="coins")return "∞ UNLIMITED";
  if(it.id.indexOf("luck")===0){const n=(state.luckPots||[])[+it.id.slice(-1)-1]||0;return "OWNED ×"+n;}
  if(it.id.indexOf("speed")===0){const n=(state.speedPots||[])[+it.id.slice(-1)-1]||0;return "OWNED ×"+n;}
  if(it.card)return "ROLL LOCKED";
  return "PERMANENT";
}
function wbRenderDrops(){
  const el=document.getElementById("wbDropsList");
  if(!el)return;
  const tok=state.wbTokens||0;
  const cores=WB_SHOP.filter(x=>!!x.card);
  const gear=WB_SHOP.filter(x=>!x.card);

  const coreHtml=`<div class="wb-sec-head"><b>EX CORE BOSS UNLOCKS</b><i></i><span>PERMANENT GACHA UNLOCK</span></div>
    <div class="wb-core-grid">${cores.map(it=>{
      const m=wbsMeta(it), owned=wbsIsOwned(it), canBuy=!owned&&tok>=it.cost;
      const btnTxt=owned?"✔ OWNED":(canBuy?"UNLOCK":"NEED "+fmt(it.cost-tok));
      return `<div class="wb-core-card" style="--ic:${m.ac}">
        <div class="wb-core-art"><img src="${m.art}" alt="${wbEsc(it.name)}" decoding="async"></div>
        <div class="wb-core-mid">
          <div class="wb-core-cat">${m.cat} &middot; ${m.tier}</div>
          <div class="wb-core-nm">${wbEsc(it.name.toUpperCase())}</div>
          <div class="wb-core-ds">${wbEsc(it.desc)}</div>
          <div class="wb-core-foot">
            <span class="wb-price">${fmt(it.cost)}<small>TOK</small></span>
            <button type="button" class="wb-buy-btn${owned?" owned":""}" data-buy="${it.id}" ${canBuy?"":"disabled"}>${btnTxt}</button>
          </div>
        </div>
      </div>`;
    }).join("")}</div>`;

  const gearHtml=`<div class="wb-sec-head"><b>SHADOW ARMORY SUPPLIES</b><i></i><span>RELICS &middot; CURRENCY &middot; POTIONS</span></div>
    <div class="wb-drop-list">${gear.map(it=>{
      const m=wbsMeta(it), owned=wbsIsOwned(it), canBuy=!owned&&tok>=it.cost;
      const stock=wbsStock(it,owned);
      const btnTxt=owned?"✔ OWNED":(canBuy?fmt(it.cost)+" TOK":"NEED "+fmt(it.cost-tok));
      return `<div class="wb-drop-item">
        <div class="wb-drop-art"><img src="${m.art}" alt="${wbEsc(it.name)}" decoding="async"></div>
        <div class="wb-drop-mid">
          <div class="wb-drop-nm">${wbEsc(it.name.toUpperCase())}</div>
          <div class="wb-drop-ds">${wbEsc(it.desc)} <span class="wb-drop-stock">${wbEsc(stock)}</span></div>
        </div>
        <button type="button" class="wb-buy-btn${owned?" owned":""}" data-buy="${it.id}" ${canBuy?"":"disabled"}>${btnTxt}</button>
      </div>`;
    }).join("")}</div>`;

  el.innerHTML=coreHtml+gearHtml;
  el.querySelectorAll("[data-buy]").forEach(btn=>{
    btn.onclick=()=>{if(!btn.disabled)raidShopBuy(btn.dataset.buy);};
  });
}

function wbRenderMvp(){
  const el=document.getElementById("wbMvpList");
  if(!el)return;
  const b=wbBoss();
  const bracketsHtml=`<div class="wb-sec-head"><b>DAILY MVP RANK BRACKETS</b><i></i><span>SINGLE-RUN PEAK DAMAGE</span></div>
    <div class="wb-brackets">
      <div class="wb-brk-card" style="--bc:#ffd700">
        <div class="wb-brk-rank">#1 MVP</div>
        <div class="wb-brk-rw"><b>+1,000</b> Gems &middot; <b>+10,000</b> Tokens &middot; <b>10&times;</b> 100K Pack</div>
        <span class="wb-brk-title">TITLE: APEX SLAYER</span>
      </div>
      <div class="wb-brk-card" style="--bc:#e2e8f0">
        <div class="wb-brk-rank">#2 RUNNER-UP</div>
        <div class="wb-brk-rw"><b>+500</b> Gems &middot; <b>+5,000</b> Tokens &middot; <b>5&times;</b> 100K Pack</div>
      </div>
      <div class="wb-brk-card" style="--bc:#f59e0b">
        <div class="wb-brk-rank">#3 PODIUM</div>
        <div class="wb-brk-rw"><b>+250</b> Gems &middot; <b>+2,500</b> Tokens &middot; <b>3&times;</b> 100K Pack</div>
      </div>
    </div>`;

  const meName=(typeof currentUser!=="undefined"&&currentUser)?String(currentUser).toLowerCase():"";
  let rowsHtml="";
  let countLabel="";
  if(!wbOnline()){
    const best=wbBestRunDmg();
    countLabel=best>0?"1 LOCAL":"OFFLINE";
    rowsHtml=best>0
      ?`<div class="wb-lb-row you top1"><span class="wb-lb-bar" style="width:100%"></span><span class="wb-lb-rk">#1</span><span class="wb-lb-av"><span>Y</span></span><span class="wb-lb-nm">YOU (Offline)<span class="wb-lb-you-tag">LOCAL</span></span><b class="wb-lb-dmg">${fmtBig(best)}</b></div>`
      :`<div class="intel-box">Log in with an account to compete on the global daily leaderboard for ${wbEsc(b.name)}.</div>`;
  }else if(wbLbS.busy&&!(wbLbS.rows||[]).length){
    countLabel="SYNCING";
    rowsHtml=`<div class="intel-box">Synchronizing live leaderboard for ${wbEsc(b.name)}&hellip;</div>`;
  }else if(wbLbS.err){
    countLabel="RETRYING";
    rowsHtml=`<div class="intel-box">Leaderboard server unavailable right now. Your run scores still submit safely.</div>`;
  }else if(!wbLbS.rows||!wbLbS.rows.length){
    countLabel="0 RANKED";
    rowsHtml=`<div class="intel-box">No hunters have damaged ${wbEsc(b.name)} yet today. Be the first MVP!</div>`;
  }else{
    const rows=wbLbS.rows.slice(0,50);
    const maxDmg=Number(rows[0].value)||1;
    countLabel=rows.length+" RANKED";
    rowsHtml=rows.map((r,i)=>{
      const v=Number(r.value)||0;
      const rk=Number(r.rank)||(i+1);
      const isYou=!!(meName&&String(r.username||"").toLowerCase()===meName);
      const w=Math.max(6,Math.min(100,(v/maxDmg)*100)).toFixed(1);
      const cls=(rk<=3?" top"+rk:"")+(isYou?" you":"");
      const avMeta=r.meta&&typeof r.meta.av==="string"&&WBV2_AV_PATH.test(r.meta.av)?r.meta.av:"";
      const avHtml=avMeta?`<img src="${avMeta}" alt="" decoding="async" onerror="this.remove()">`:`<span>${wbEsc(String(r.username||"?").slice(0,1).toUpperCase())}</span>`;
      return `<div class="wb-lb-row${cls}">
        <span class="wb-lb-bar" style="width:${w}%"></span>
        <span class="wb-lb-rk">#${rk}</span>
        <span class="wb-lb-av">${avHtml}</span>
        <span class="wb-lb-nm">${wbEsc(r.username||"?")}${isYou?'<span class="wb-lb-you-tag">YOU</span>':""}</span>
        <b class="wb-lb-dmg">${fmtBig(v)}</b>
      </div>`;
    }).join("");
  }

  const boardHtml=`<div class="wb-sec-head"><b>LIVE TOP DAMAGE — ${wbEsc(b.name)}</b><i></i><span>${countLabel}</span></div>
    <div class="wb-lb-table">${rowsHtml}</div>`;

  el.innerHTML=bracketsHtml+boardHtml;
}

function wbRenderEveryone(){
  const el=document.getElementById("wbEveryoneList");
  if(!el)return;
  const d=wbData();
  const {pool,left:poolLeft}=wbPoolVals();
  const dealt=Math.max(0,pool-poolLeft);
  const totalDmg=wbTotalDmg();
  const totalPlayers=wbOnline()?(Number(d&&d.total_players)||0):1;

  const partHtml=`<div class="wb-ev-card">
    <div class="wb-ev-head">
      <span class="wb-ev-title">EVERYONE / PARTICIPATION BRACKET</span>
      <span class="wb-ev-pill">${totalDmg>0?"✔ QUALIFIED TODAY":"DEAL ANY DMG TO QUALIFY"}</span>
    </div>
    <div class="wb-ev-rewards">
      <span class="wb-ev-chip"><img src="assets/images/premium-currency.webp" alt="Gems"><b>+100</b> Gems</span>
      <span class="wb-ev-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#wbTokSvg"/></svg><b>+1,000</b> WB Tokens</span>
      <span class="wb-ev-chip"><img src="assets/images/instanpack-100k.webp" alt="100K Pack"><b>1&times;</b> 100K Pack</span>
    </div>
  </div>`;

  const statsHtml=`<div class="wb-ev-stats">
    <div class="wb-stat-box"><span>ACTIVE HUNTERS</span><b>${fmt(totalPlayers)}</b></div>
    <div class="wb-stat-box"><span>SERVER DMG TODAY</span><b>${fmtBig(dealt)}</b></div>
    <div class="wb-stat-box"><span>DAILY RESET</span><b>00:00 UTC+7</b></div>
  </div>`;

  const y=d&&d.yesterday;
  let yestCls="", yestTitle="DAILY PAYOUT STATUS", yestSub="Deal damage today to unlock tomorrow's claim after daily reset.", btnDis="disabled", btnTxt="NO PAYOUT";
  if(!wbOnline()){
    yestSub="Log in to record server damage and claim daily World Boss payouts.";
    btnTxt="LOGIN REQUIRED";
  }else if(y&&y.claimed){
    yestCls=" claimed";
    yestTitle="YESTERDAY'S RANK PAYOUT ("+(y.rank?"#"+y.rank:"PARTICIPANT")+")";
    yestSub="Claimed! Today's rewards unlock after the 00:00 UTC+7 daily reset.";
    btnTxt="✔ CLAIMED";
  }else if(y&&y.claimable){
    yestTitle="YESTERDAY'S RANK PAYOUT (#"+(y.rank||"?")+(y.bracket==="rank1"?" MVP":"")+")";
    yestSub="+"+fmt(y.gems||0)+" Gems &middot; +"+fmt(y.tokens||0)+" WB Tokens"+(y.packs?" &middot; "+y.packs+"&times; 100K Pack":"")+(y.title?" &middot; Title: "+wbEsc(y.title):"");
    btnDis="";
    btnTxt="CLAIM REWARD";
  }else if(!d){
    yestSub="Synchronizing yesterday's payout status with server&hellip;";
    btnTxt="SYNCING";
  }

  const yestHtml=`<div class="wb-yest-box${yestCls}">
    <div class="wb-yest-txt"><b>${yestTitle}</b><small>${yestSub}</small></div>
    <button type="button" class="wb-claim-btn" id="wbBtnClaimYest" ${btnDis}>${btnTxt}</button>
  </div>`;

  el.innerHTML=partHtml+statsHtml+yestHtml;
  const yc=document.getElementById("wbBtnClaimYest");
  if(yc&&!yc.disabled)yc.onclick=()=>wbClaim();
}

function wbPatchHubDOM(){
  wbSyncCur();
  wbRenderHeaderAndLeft();
  wbRenderMilestones();
  wbRenderDrops();
  wbRenderMvp();
  wbRenderEveryone();
}

function wbAfterShopBuy(){
  try{renderShell();}catch(e){}
  if(route()==="#/raid"&&raidView==="hub"){
    wbRenderHeaderAndLeft();
    wbRenderDrops();
  }
}

function wbSelectTab(key,focusTab){
  wbHubTab=key||"milestones";
  const btns=document.querySelectorAll("#wbView [role='tab']");
  btns.forEach(btn=>{
    const on=btn.dataset.tab===wbHubTab;
    btn.setAttribute("aria-selected",on?"true":"false");
    btn.tabIndex=on?0:-1;
    const panel=document.getElementById("wbPanel-"+btn.dataset.tab);
    if(panel)panel.hidden=!on;
    if(on&&focusTab)btn.focus();
    if(on&&focusTab)btn.scrollIntoView({block:"nearest",inline:"nearest"});
  });
}

function wbWireDialogLightDismiss(dlg){
  if(!dlg||dlg._wbWired)return;
  dlg._wbWired=true;
  if(!("closedBy" in HTMLDialogElement.prototype)){
    let pressedOut=false;
    const outside=e=>{
      const r=dlg.getBoundingClientRect();
      return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;
    };
    dlg.addEventListener("pointerdown",e=>{pressedOut=outside(e);});
    dlg.addEventListener("pointerup",e=>{if(pressedOut&&outside(e))dlg.close();});
  }
  dlg.querySelectorAll("[data-close]").forEach(btn=>{
    btn.onclick=()=>dlg.close();
  });
}

function wbOpenBossIntelDialog(){
  const b=wbBoss(), meta=wbBossMetaOf(b), {pool}=wbPoolVals();
  const dlg=document.getElementById("wbInfoDlg");
  const ttl=document.getElementById("wbInfoTitle");
  const body=document.getElementById("wbInfoBody");
  if(!dlg||!ttl||!body)return;
  ttl.textContent="BOSS INTEL — "+b.name;
  body.innerHTML=`
    <div class="intel-hero">
      <img class="intel-art" src="${meta.art}" alt="${wbEsc(b.name)}">
      <div class="intel-meta">
        <div class="intel-chips">
          <span class="intel-chip red">${wbEsc(b.tag)}</span>
          <span class="intel-chip haz">${wbEsc(wbModText())}</span>
        </div>
        <div class="intel-name">${wbEsc(b.name)}</div>
        <div class="intel-sub">HP POOL: ${fmtBig(pool)} &middot; ATK: ${fmt(meta.atk)} &middot; ${RAID_TURNS} TURNS</div>
      </div>
    </div>
    <div class="intel-box"><b>SIGNATURE SKILL — ${wbEsc(meta.skill.toUpperCase())}</b><br>${wbEsc(b.passive)}</div>
    <div class="intel-box"><b>COMBAT RULES</b><br>Deploy 1 solo Striker card for a ${RAID_TURNS}-turn duel. Every point of damage reduces the server-wide 10B HP pool, advances your 7 personal Milestones, and records your peak single-run score for daily MVP brackets.</div>`;
  if(!dlg.open)dlg.showModal();
}

function wbOpenHowItWorksDialog(){
  const dlg=document.getElementById("wbInfoDlg");
  const ttl=document.getElementById("wbInfoTitle");
  const body=document.getElementById("wbInfoBody");
  if(!dlg||!ttl||!body)return;
  ttl.textContent="HOW WORLD BOSS RAID WORKS";
  body.innerHTML=`
    <div class="intel-box"><b>1. SERVER-WIDE 10B HP POOL</b><br>All hunters attack the same shared daily boss pool (Eternal Dragon &amp; Shadow King each have separate 10B pools, leaderboards, and 3 daily attempts).</div>
    <div class="intel-box"><b>2. GUARANTEED MILESTONES (1&ndash;7)</b><br>Your damage adds up across all runs today. Reaching each milestone unlocks guaranteed WB Tokens, Gems, Instant Packs, and Potions once per daily reset.</div>
    <div class="intel-box"><b>3. MVP &amp; EVERYONE BRACKETS</b><br>Your highest single ${RAID_TURNS}-turn run determines your daily rank. #1 wins the <b>APEX SLAYER</b> title + 1,000 Gems + 10,000 WB Tokens. Dealing any damage qualifies for the <b>EVERYONE</b> participation reward!</div>
    <div class="intel-box"><b>4. AUTO REPEAT</b><br>Enable <b>AUTO REPEAT</b> to automatically re-deploy your chosen Striker after every raid while daily attempts remain and the boss HP pool is active.</div>`;
  if(!dlg.open)dlg.showModal();
}

function wbRenderStrikerPicker(){
  const body=document.getElementById("wbStrikerBody");
  if(!body)return;
  const sel=wbSelectedStriker();
  const q=wbStrikerSearch.trim().toLowerCase();
  const raw=(state&&Array.isArray(state.stacks))?state.stacks.slice():[];
  raw.sort((a,b)=>{
    if(sel&&a.id===sel.id)return -1;
    if(sel&&b.id===sel.id)return 1;
    if(!!b.fav!==!!a.fav)return b.fav?1:-1;
    return wbEstRunDmg(b)-wbEstRunDmg(a);
  });
  const list=raw.filter(s=>{
    const c=CARDS[s.char];
    return !q||(c&&c.name.toLowerCase().includes(q));
  });

  body.innerHTML=`
    <input type="search" class="striker-search" id="wbStrikerSearch" placeholder="Search your striker cards..." value="${wbEsc(wbStrikerSearch)}" autocomplete="off" aria-label="Search striker cards">
    <div class="striker-grid">${list.length?list.map(s=>{
      const c=CARDS[s.char];
      if(!c)return "";
      const on=!!(sel&&sel.id===s.id);
      const est=wbEstRunDmg(s);
      const mut=(s.mut&&s.mut!=="none")?s.mut.toUpperCase():"";
      const tr=(s.trait&&s.trait!=="none"&&TRAIT[s.trait])?TRAIT[s.trait].name.toUpperCase():"";
      return `<button type="button" class="striker-card${on?" on":""}" data-pick-striker="${wbEsc(s.id)}">
        <img class="striker-img" src="${cardThumb(s.char)}" alt="${wbEsc(c.name)}" decoding="async">
        <div class="striker-nm">${wbEsc(c.name)}</div>
        <div class="striker-st">EST ~${fmtBig(est)} / RUN</div>
        <div class="striker-tags">
          ${s.shiny?'<span class="striker-tag" style="color:var(--haz);border-color:var(--haz)">SHINY</span>':""}
          ${mut?`<span class="striker-tag">${wbEsc(mut)}</span>`:""}
          ${tr?`<span class="striker-tag">${wbEsc(tr)}</span>`:""}
          ${(s.count||1)>1?`<span class="striker-tag">&times;${fmt(s.count)}</span>`:""}
        </div>
      </button>`;
    }).join(""):`<div class="intel-box" style="grid-column:1/-1">No matching striker cards found.</div>`}</div>`;

  const inp=document.getElementById("wbStrikerSearch");
  if(inp){
    inp.oninput=()=>{
      const pos=inp.selectionStart;
      wbStrikerSearch=inp.value;
      wbRenderStrikerPicker();
      const next=document.getElementById("wbStrikerSearch");
      if(next){next.focus();try{next.setSelectionRange(pos,pos);}catch(e){}}
    };
  }
  body.querySelectorAll("[data-pick-striker]").forEach(btn=>{
    btn.onclick=()=>{
      const picked=state.stacks.find(s=>s.id===btn.dataset.pickStriker);
      if(!picked)return;
      raidPicked=picked;
      state.wbStrikerId=picked.id;
      try{save();}catch(e){}
      try{sfx.hit();}catch(e){}
      const dlg=document.getElementById("wbStrikerDlg");
      if(dlg&&dlg.open)dlg.close();
      wbRenderHeaderAndLeft();
      const c=CARDS[picked.char];
      raidToast("STRIKER EQUIPPED: "+(c?c.name:"READY"));
    };
  });
}

function wbOpenStrikerDialog(){
  const dlg=document.getElementById("wbStrikerDlg");
  if(!dlg)return;
  wbRenderStrikerPicker();
  if(!dlg.open)dlg.showModal();
}

function wbEnsureCurtain(){
  let hz=document.getElementById("wbHzCurtain");
  if(!hz){
    hz=document.createElement("div");
    hz.id="wbHzCurtain";
    hz.setAttribute("aria-hidden","true");
    hz.innerHTML=`
      <div class="half top"></div>
      <div class="half bot"></div>
      <div class="tape tape-a"></div>
      <div class="tape tape-b"></div>
      <div class="flash"></div>
      <div class="plate">
        <div class="in">
          <div class="krow">
            <span class="dot"></span>
            <span class="kick" id="wbHzKick">// SERVER-WIDE <b>RAID UPLINK</b></span>
            <span class="serial" id="wbHzSerial">SERIAL 0x9E4A</span>
          </div>
          <div class="title"><span id="wbHzTitle">WORLD BOSS RAID</span></div>
          <div class="sub" id="wbHzSub">10B SHARED HP POOL &middot; 3 DAILY ATTEMPTS PER BOSS</div>
          <div class="bar"><i></i></div>
          <div class="foot"><span>HZ-PROTOCOL</span><span id="wbHzFoot">SYNCHRONIZING TARGETS</span></div>
        </div>
      </div>`;
    document.body.appendChild(hz);
  }
  return hz;
}

function wbSetCurtainCopy(mode){
  const k=document.getElementById("wbHzKick"), t=document.getElementById("wbHzTitle"),
        s=document.getElementById("wbHzSub"), f=document.getElementById("wbHzFoot"),
        sr=document.getElementById("wbHzSerial");
  const hex=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(sr)sr.textContent="SERIAL 0x"+hex;
  if(mode==="open"){
    if(k)k.innerHTML="// SERVER-WIDE <b>RAID UPLINK</b>";
    if(t)t.textContent="WORLD BOSS RAID";
    if(s)s.textContent="10B SHARED HP POOL · 3 DAILY ATTEMPTS PER BOSS";
    if(f)f.textContent="SYNCHRONIZING TARGETS";
  }else{
    if(k)k.innerHTML="// LINK <b>STAND BY</b>";
    if(t)t.textContent="STANDBY";
    if(s)s.textContent="WORLD BOSS SESSION SEALED — RANK SYNCED";
    if(f)f.textContent="RETURNING TO LOBBY";
  }
}

function wbPlayEnterCurtain(forceAnim){
  const hz=wbEnsureCurtain();
  const sh=document.getElementById("wbShell");
  wbClearHz();
  if(!forceAnim||wbReduceMotion()){
    hz.className="";
    if(sh)sh.classList.add("is-entered");
    return;
  }
  wbSetCurtainCopy("open");
  if(sh)sh.classList.remove("is-entered","is-leaving");
  hz.className="";
  void hz.offsetWidth;
  hz.classList.add("on","smooth","sweep");
  wbHzTimers.push(setTimeout(()=>{
    hz.classList.add("revealed");
    const curSh=document.getElementById("wbShell");
    if(curSh)curSh.classList.add("is-entered");
  },880));
  wbHzTimers.push(setTimeout(()=>{
    hz.className="";
  },1580));
}

function wbExitToLobby(){
  if(_wbClosing)return;
  _wbClosing=true;
  clearTimeout(wbAutoTimer);wbAutoTimer=null;
  const hz=wbEnsureCurtain();
  const sh=document.getElementById("wbShell");
  if(wbReduceMotion()){
    _wbClosing=false;
    _wbPrevRoute="#/lobby";
    raidView="hub";
    if(window.location.hash==="#/lobby"||window.location.hash===""||window.location.hash==="#/")render();
    else window.location.hash="#/lobby";
    return;
  }
  wbClearHz();
  wbSetCurtainCopy("close");
  if(sh)sh.classList.add("is-leaving");
  hz.className="";
  hz.classList.add("on","smooth","revealed");
  void hz.offsetWidth;
  hz.classList.remove("revealed");
  wbHzTimers.push(setTimeout(()=>{
    _wbClosing=false;
    _wbPrevRoute="#/lobby";
    raidView="hub";
    if(window.location.hash==="#/lobby"||window.location.hash===""||window.location.hash==="#/")render();
    else window.location.hash="#/lobby";
  },540));
  wbHzTimers.push(setTimeout(()=>{
    hz.classList.add("revealed");
  },760));
  wbHzTimers.push(setTimeout(()=>{
    hz.className="";
  },1520));
}

function wbLaunchRaid(){
  if(wbStarting)return;
  clearTimeout(wbAutoTimer);wbAutoTimer=null;
  const cb=wbBoss();
  if(cb.locked){raidToast("This World Boss is not available yet.");return;}
  const cp=wbPoolVals();
  if(cp.left<=0){raidToast("Boss defeated! Next spawn in "+wbResetText()+".");return;}
  const att=wbAttOf(wbBossIdx);
  if(att!=null&&att<=0){raidToast("No daily attempts left. Resets in "+wbResetText()+".");return;}
  const striker=wbSelectedStriker();
  if(!striker){raidToast("You have no striker cards available.");return;}
  raidPicked=striker;
  state.wbStrikerId=striker.id;
  try{sfx.hit();}catch(e){}
  if(typeof hideRollResult==="function")hideRollResult();

  if(!wbOnline()){
    wbRunId=null;wbRunBoss=cb.key;
    raidView="battle";renderRaid();
    return;
  }
  wbStarting=true;
  raidToast("LOCKING ATTEMPT & DEPLOYING STRIKER...");
  const sd=wbData();
  window.CloudDB.wbStart(currentUser,cb.id).then(res=>{
    wbStarting=false;
    if(res&&res.ok){
      wbRunId=res.run_id;
      wbRunBoss=cb.key;
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
      raidToast(res.msg==="NO_ATTEMPTS_LEFT"?"No attempts left today · Reset "+wbResetText():"Failed to deploy · Try again");
      raidView="hub";renderRaid();
    }else{
      wbRunId=null;wbRunBoss=null;
      raidToast("Server offline · Playing local practice run");
      raidView="battle";renderRaid();
    }
  }).catch(()=>{
    wbStarting=false;wbRunId=null;wbRunBoss=null;
    raidToast("Server unreachable · Playing local practice run");
    raidView="battle";renderRaid();
  });
}

function renderRaidHub(){
  wbrStopPoll();
  wbSyncCur();
  const b=wbBoss();
  app.innerHTML=`
  <div id="wbView" class="wbv2 rd-page">
    <svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
      <defs>
        <g id="wbTokSvg">
          <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" fill="#071a22" stroke="#22d3ee" stroke-width="1.8"/>
          <polygon points="12 5.5 17.5 8.8 17.5 15.2 12 18.5 6.5 15.2 6.5 8.8" fill="rgba(34,211,238,0.22)" stroke="#7df9ff" stroke-width="1.1"/>
          <path d="M9 9.5L10.7 15 12 11 13.3 15 15 9.5" fill="none" stroke="#7df9ff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </defs>
    </svg>

    <div class="wb-shell" id="wbShell">
      <div class="wb-banner-bar">
        <div class="wb-banner-ribbon">
          <div class="wb-banner-cap">
            <div class="wb-banner-cap-in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>
              </svg>
              <span>RAID</span>
            </div>
          </div>
          <div class="wb-banner-mid">
            <div class="wb-banner-titles">
              <h1 class="wb-title">WORLD BOSS <em>RAID</em></h1>
              <span class="wb-eyebrow">// SERVER-WIDE 10B POOL &middot; ${RAID_TURNS}-TURN DEPLOY</span>
            </div>
            <div class="wb-banner-tags">
              <span class="wb-banner-tag" id="wbHdrTokens">TOKENS: 0</span>
              <span class="wb-banner-tag hz" id="wbHdrReset">RESET: --</span>
            </div>
          </div>
        </div>

        <div class="wb-banner-right">
          <button type="button" class="wb-x" id="wbClose" aria-label="Return to Lobby">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <div class="wb-slashes" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </div>

      <div class="wb-panel">
        <div class="wb-tape-line" aria-hidden="true"></div>
        <div class="wb-body">
          <aside class="wb-boss-col" aria-label="Boss Spotlight">
            <div class="wb-boss-sw" role="group" aria-label="Select World Boss">
              ${WB_BOSSES.map((x,i)=>`<button type="button" class="wb-bsw-btn" data-boss-idx="${i}" aria-pressed="${i===wbBossIdx?"true":"false"}" style="--bc:${x.color}">
                <span class="wb-bsw-dot"></span>${wbEsc(x.tab)}
              </button>`).join("")}
            </div>

            <div class="wb-boss-head">
              <div class="wb-boss-name" id="wbBossName">${wbEsc(b.name)}</div>
              <span class="wb-boss-tag" id="wbBossTag">${wbEsc(b.tag)}</span>
            </div>

            <div class="wb-status-pill" id="wbBossStatusPill">
              <span class="wb-status-dot" aria-hidden="true"></span>
              <span id="wbBossStatusTxt"><b>ACTIVE</b></span>
            </div>

            <div class="wb-hp-block">
              <div class="wb-hp-bar">
                <div class="wb-hp-fill" id="wbBossHpFill" style="width:100%"></div>
                <div class="wb-hp-txt" id="wbBossHpTxt">10B / 10B HP</div>
              </div>
            </div>

            <div class="wb-hover-prompt">THE WORLD BOSS (TAP FOR INTEL)</div>

            <button type="button" class="wb-boss-art-btn" id="wbBtnBossIntel" aria-label="Inspect World Boss Intel">
              <img id="wbBossArtImg" src="${b.art}" alt="${wbEsc(b.name)}">
              <span class="wb-art-brk tl" aria-hidden="true"></span>
              <span class="wb-art-brk tr" aria-hidden="true"></span>
              <span class="wb-art-brk bl" aria-hidden="true"></span>
              <span class="wb-art-brk br" aria-hidden="true"></span>
              <span class="wb-art-intel">INTEL</span>
              <div class="wb-art-dmg-badge" id="wbBossDmgBadge"><small>BOSS ATK</small>15,000 ATK</div>
            </button>

            <div class="wb-personal-box">
              <div class="wb-personal-line" id="wbPersonalStatsLine">Your damage: <b>0</b> &middot; Milestones: <b>0/7</b></div>
              <div class="wb-att-row">
                <span>DAILY ATTEMPTS</span>
                <span class="wb-crystals" id="wbAttemptCrystals"></span>
              </div>
              <div class="wb-mvp-bar">
                <span class="wb-mvp-left" id="wbMvpNowTxt">MVP NOW: <b>Nobody yet</b></span>
                <span class="wb-mvp-tok"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#wbTokSvg"/></svg>+10,000</span>
              </div>
            </div>
          </aside>

          <section class="wb-hub-col" aria-label="World Boss Hub Details">
            <div class="wb-tablist" role="tablist" aria-label="World Boss Sections">
              <button type="button" class="wb-tab" role="tab" id="wbTab-milestones" aria-selected="true" data-tab="milestones">
                MILESTONES <span class="wb-tab-badge" id="wbMsBadge" hidden>0</span>
              </button>
              <button type="button" class="wb-tab" role="tab" id="wbTab-drops" aria-selected="false" data-tab="drops">DROPS</button>
              <button type="button" class="wb-tab" role="tab" id="wbTab-mvp" aria-selected="false" data-tab="mvp">MVP</button>
              <button type="button" class="wb-tab" role="tab" id="wbTab-everyone" aria-selected="false" data-tab="everyone">EVERYONE</button>
            </div>

            <div class="wb-tab-panel" role="tabpanel" id="wbPanel-milestones" aria-labelledby="wbTab-milestones" tabindex="0">
              <div class="wb-callout" id="wbMsCallout"></div>
              <div class="wb-scroll" id="wbMsList"></div>
            </div>

            <div class="wb-tab-panel" role="tabpanel" id="wbPanel-drops" aria-labelledby="wbTab-drops" hidden tabindex="0">
              <div class="wb-callout">Spend World Boss Tokens on exclusive EX Core Boss Cards, permanent Luck Relics, Gems, Coins, and Potions.</div>
              <div class="wb-scroll" id="wbDropsList"></div>
            </div>

            <div class="wb-tab-panel" role="tabpanel" id="wbPanel-mvp" aria-labelledby="wbTab-mvp" hidden tabindex="0">
              <div class="wb-callout">Your highest single ${RAID_TURNS}-turn run locks your rank. #1 claims APEX SLAYER title &amp; top daily rewards.</div>
              <div class="wb-scroll" id="wbMvpList"></div>
            </div>

            <div class="wb-tab-panel" role="tabpanel" id="wbPanel-everyone" aria-labelledby="wbTab-everyone" hidden tabindex="0">
              <div class="wb-callout">Every hunter who deals damage today earns guaranteed Participation Rewards — no minimum damage required.</div>
              <div class="wb-scroll" id="wbEveryoneList"></div>
            </div>
          </section>
        </div>

        <footer class="wb-foot">
          <div class="wb-actions">
            <button type="button" class="wb-act auto" id="wbBtnAutoRepeat" aria-pressed="false">
              <span class="wb-auto-dot" aria-hidden="true"></span>
              <span id="wbAutoRepeatTxt">AUTO REPEAT: OFF</span>
            </button>
            <button type="button" class="wb-act info" id="wbBtnHowItWorks">HOW IT WORKS</button>
            <button type="button" class="wb-act deck" id="wbBtnSelectStriker">
              <img class="wb-deck-thumb" id="wbStrikerThumb" src="assets/cards/thumb/sun-god.webp" alt="">
              <span class="wb-deck-lbl"><small>STRIKER</small><span id="wbStrikerName">SELECT</span></span>
              <span aria-hidden="true">&rsaquo;</span>
            </button>
            <button type="button" class="wb-act fight" id="wbBtnFight">FIGHT BOSS (3/3)</button>
          </div>
          <div class="wb-footnote">AUTO REPEAT deploys your selected Striker again after every fight while daily attempts remain and the boss pool is active.</div>
        </footer>
      </div>

      <div class="wb-toast" id="wbToast" role="status" aria-live="polite"></div>
    </div>

    <dialog class="wb-dialog" id="wbInfoDlg" closedby="any" aria-labelledby="wbInfoTitle">
      <div class="dlg-head">
        <h2 id="wbInfoTitle">HOW WORLD BOSS RAID WORKS</h2>
        <button type="button" class="dlg-close" data-close aria-label="Close modal">&times;</button>
      </div>
      <div class="dlg-body" id="wbInfoBody"></div>
    </dialog>

    <dialog class="wb-dialog" id="wbStrikerDlg" closedby="any" aria-labelledby="wbStrikerTitle">
      <div class="dlg-head">
        <h2 id="wbStrikerTitle">SELECT RAID STRIKER</h2>
        <button type="button" class="dlg-close" data-close aria-label="Close striker selector">&times;</button>
      </div>
      <div class="dlg-body" id="wbStrikerBody"></div>
    </dialog>
  </div>`;

  const shouldEnterAnim=(_wbPrevRoute!=="#/raid");
  _wbPrevRoute="#/raid";
  wbPatchHubDOM();
  wbSelectTab(wbHubTab,false);
  wbPlayEnterCurtain(shouldEnterAnim);

  document.querySelectorAll("#wbView .wb-bsw-btn").forEach(btn=>{
    btn.onclick=()=>setBoss(Number(btn.dataset.bossIdx));
  });

  const tabBtns=Array.from(document.querySelectorAll("#wbView [role='tab']"));
  tabBtns.forEach((btn,idx)=>{
    btn.onclick=()=>{try{sfx.hit();}catch(e){}wbSelectTab(btn.dataset.tab,false);};
    btn.addEventListener("keydown",e=>{
      let next=-1;
      if(e.key==="ArrowRight")next=(idx+1)%tabBtns.length;
      else if(e.key==="ArrowLeft")next=(idx-1+tabBtns.length)%tabBtns.length;
      else if(e.key==="Home")next=0;
      else if(e.key==="End")next=tabBtns.length-1;
      if(next>=0){e.preventDefault();wbSelectTab(tabBtns[next].dataset.tab,true);}
    });
  });

  wbWireDialogLightDismiss(document.getElementById("wbInfoDlg"));
  wbWireDialogLightDismiss(document.getElementById("wbStrikerDlg"));

  document.getElementById("wbClose").onclick=wbExitToLobby;
  document.getElementById("wbBtnBossIntel").onclick=()=>{try{sfx.hit();}catch(e){}wbOpenBossIntelDialog();};
  document.getElementById("wbBtnHowItWorks").onclick=()=>{try{sfx.hit();}catch(e){}wbOpenHowItWorksDialog();};
  document.getElementById("wbBtnSelectStriker").onclick=()=>{try{sfx.hit();}catch(e){}wbOpenStrikerDialog();};
  document.getElementById("wbBtnAutoRepeat").onclick=()=>{
    state.wbAutoRepeat=!state.wbAutoRepeat;
    try{save();sfx.hit();}catch(e){}
    wbRenderHeaderAndLeft();
    raidToast("AUTO REPEAT "+(state.wbAutoRepeat?"ENABLED — auto-deploys after raids":"DISABLED"));
  };
  document.getElementById("wbBtnFight").onclick=wbLaunchRaid;

  if(!wbHubKeyHandler){
    wbHubKeyHandler=e=>{
      if(e.key==="Escape"&&route()==="#/raid"&&raidView==="hub"){
        const d1=document.getElementById("wbStrikerDlg");
        const d2=document.getElementById("wbInfoDlg");
        if((d1&&d1.open)||(d2&&d2.open))return;
      }
    };
    document.addEventListener("keydown",wbHubKeyHandler);
  }

  wbRefresh();
  wbrStartPoll();
  if(wbOnline())wbLbFetch(b.board);
}

function wbrStopPoll(){if(wbrPoll){clearInterval(wbrPoll);wbrPoll=null;}}
let wbrPoll=null;
function wbrStartPoll(){
  wbrStopPoll();
  if(!wbOnline())return;
  wbrPoll=setInterval(()=>{
    if(raidView!=="hub"||route()!=="#/raid"){wbrStopPoll();return;}
    if(document.hidden)return;
    wbRefresh(true,true).then(()=>wbPatchHubDOM()).catch(()=>{});
  },60000);
}

function syncBossDOM(){
  wbPatchHubDOM();
  if(wbOnline())wbLbFetch(wbBoss().board);
}

function setBoss(i){
  const n=WB_BOSSES.length;
  if(!(i>=0&&i<n)||i===wbBossIdx)return;
  try{sfx.hit();}catch(e){}
  wbBossIdx=i;
  syncBossDOM();
}
function goBoss(dir){const n=WB_BOSSES.length;if(n<2)return;setBoss(((wbBossIdx+dir)%n+n)%n);}

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
  const setRaidBar=hp=>{const v=Math.max(0,hp);const p=Math.max(0,Math.min(100,v/raid.max*100))+"%";const b=document.getElementById("hpRaid");if(b){b.style.width=p;const tr=b.parentElement?b.parentElement.querySelector(".hp-trail"):null;if(tr)tr.style.width=p;}const tt=document.getElementById("hpRaidT");if(tt)tt.textContent=(typeof fmtBattleK==="function"?fmtBattleK(v):fmtBig(v));const ih=document.getElementById("foeInlineHp");if(ih)ih.textContent=(typeof fmtBattleK==="function"?fmtBattleK(v):fmtBig(v));if(typeof window.hzBattleSync==="function"){try{window.hzBattleSync();}catch(e){}}if(typeof window.sheetStatusSync==="function"){try{window.sheetStatusSync();}catch(e){}}};
  const havocWillFire=!!(fx.havocRocket&&raid.hp>0&&raid.havocGuard&&(raid.havocUses||0)<(fx.havocRocket.maxUses||3));
  const isRaidCombo=hits.length===1&&!domainActive&&!ariseMode&&!galaxyMode&&!psychicActive&&!bajrangActive&&!hpPurple&&!md&&wePhase<0&&!havocWillFire;
  const rHstep=(psychicActive&&typeof PSY_T!=="undefined")?PSY_T.step:(domainActive?80:160);
  const rMd=md;
  const rHitDelay=havocWillFire?(typeof HR_T!=="undefined"?HR_T.first:620):273;
  const rSusStart=psychicActive?(typeof PSY_T!=="undefined"?PSY_T.first:560):bajrangActive?(typeof BJ_T!=="undefined"?BJ_T.first:820):(wePhase>=0)?(typeof WE_T!=="undefined"?WE_T.first:520):rMd?MADARA_T.slash:rHitDelay;
  const rChainEnd=isRaidCombo?860:(rSusStart+Math.max(0,hits.length-1)*(rMd?MADARA_T.step:rHstep)+420);
  const rStartHp=raid.hp;
  const rEndHp=Math.max(0,raid.hp-total);
  if(isRaidCombo&&typeof attackLunge==="function"){
    const d0=Math.min(total,Math.round(total*0.24));
    const d1=Math.min(total-d0,Math.round(total*0.30));
    const d2=Math.max(0,total-d0-d1);
    const rParts=[d0,d1,d2];
    let rShown=rStartHp;
    try{
      attackLunge(".fighter.me",{
        mode:"combo",
        onHit(h){
          if(!raid||raid.over)return;
          const dm=rParts[h]||0;
          rShown=Math.max(0,rShown-dm);
          const isLast=(h===2);
          if(dm>0||isLast)floatText(".fighter.foe","-"+fmt(dm),(crit&&isLast)?"crit":"");
          setRaidBar(isLast?rEndHp:rShown);
        }
      });
    }catch(e){}
    setTimeout(()=>{if(raid&&!raid.over)setRaidBar(rEndHp);},880);
  }else{
    const rSkillFx=!!(psychicActive||bajrangActive||wePhase>=0||havocWillFire);
    if(psychicActive&&typeof window.psyBarrageFx==="function"){
      try{window.psyBarrageFx({fromSel:".fighter.me",toSel:".fighter.foe",n:raid.psyN||hits.length,shotCount:hits.length,revived:false,t0:0});}catch(e){}
      if(window.CyberSfx&&window.CyberSfx.aoeCharge)try{window.CyberSfx.aoeCharge();}catch(e){}
    }
    if(bajrangActive&&typeof window.bajrangGunFx==="function"){
      try{window.bajrangGunFx({fromSel:".fighter.me",toSel:".fighter.foe",t0:0});}catch(e){}
      if(window.CyberSfx&&window.CyberSfx.aoeCharge)try{window.CyberSfx.aoeCharge();}catch(e){}
    }
    if(wePhase>=0&&typeof window.worldEnderFx==="function"){
      try{window.worldEnderFx({fromSel:".fighter.me",toSel:".fighter.foe",phase:wePhase,revived:false});}catch(e){}
    }
    if(!rSkillFx&&typeof attackLunge==="function"){try{attackLunge(".fighter.me",true);}catch(e){}}
    /* All cut-in removed */
    if(domainActive&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.me","DOMAIN EXPANSION","crit"),rHitDelay+40);}
    if(ariseMode&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.foe","ARMY OF SHADOWS","crit"),rHitDelay);}
    const susStart=rSusStart;
    {
      const hstep=rHstep;
      const susDelay=susStart;
      const dlyAt=i=> galaxyMode ? rHitDelay : rMd ? (susDelay+i*MADARA_T.step) : (susDelay+i*hstep);
      let rShown=rStartHp,rBarEnd=susStart;
      hits.forEach((m,i)=>{
        const dl=dlyAt(i),ft=dl;
        if(rSkillFx){
          setTimeout(()=>{
            if(!raid||raid.over)return;
            if(!havocWillFire){
              const foeEl=document.querySelector(".fighter.foe");
              if(foeEl&&typeof window.hzFlashCard==="function"){try{window.hzFlashCard(foeEl,"hit");}catch(e){}}
              if(typeof triggerStageShake==="function"){try{triggerStageShake(!!(bajrangActive||wePhase===2||(crit&&i===hits.length-1)));}catch(e){}}
              if(foeEl&&typeof foeEl.animate==="function"){
                foeEl.animate([
                  {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:0},
                  {transform:"translate3d(16px,-10px,0) scale(0.94) rotate(5deg)",offset:0.26},
                  {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:1}
                ],{duration:320,easing:"cubic-bezier(0.22, 1, 0.36, 1)",fill:"none"});
              }
              if(psychicActive&&window.CyberSfx&&window.CyberSfx.aoeChainTick)try{window.CyberSfx.aoeChainTick(i);}catch(e){}
              else if((bajrangActive||wePhase===2)&&window.CyberSfx&&window.CyberSfx.aoeDetonate)try{window.CyberSfx.aoeDetonate();}catch(e){}
              else if(wePhase>=0&&window.CyberSfx&&window.CyberSfx.katanaFinisher)try{window.CyberSfx.katanaFinisher();}catch(e){}
            }
          },dl);
        }else if(i>0){
          setTimeout(()=>{
            if(raid&&!raid.over&&typeof window.playAnimeArchetypeAttack==="function"){
              try{window.playAnimeArchetypeAttack(id,".fighter.me",".fighter.foe");}catch(e){}
            }
          },dl);
        }
        if(!rSkillFx)setTimeout(()=>{if(raid&&!raid.over){try{if(crit&&i===hits.length-1)sfx.crit();else playClip(punchAudio);}catch(e){}}},dl);
        const dd=Math.round(dmg*m);rShown-=dd;rBarEnd=Math.max(rBarEnd,ft);const stepHp=Math.max(0,rShown);
        setTimeout(()=>{if(raid&&!raid.over)floatText(".fighter.foe","-"+fmt(dd),(crit&&i===hits.length-1)?"crit":"");},ft);
        setTimeout(()=>{if(raid&&!raid.over)setRaidBar(stepHp);},ft);
      });
      setTimeout(()=>{if(raid&&!raid.over)setRaidBar(rEndHp);},rBarEnd+420);
      if(barrageN>1)setTimeout(()=>{if(raid&&!raid.over)floatText(".fighter.foe",(iceBlastN?"ICE BLAST ×":domainActive?"UNLIMITED VOID ×":ariseMode?"ARISE ×":md?"TENSA ×":psychicActive?"PSYCHIC BARRAGE ×":"CLEAVE ×")+barrageN,"crit");},md?MADARA_T.slash:psychicActive?260:280);
      else if(hits.length>1&&!ranton)setTimeout(()=>{if(raid&&!raid.over)floatText(".fighter.foe","DOUBLE!","crit");},rHitDelay+60);
      if(bajrangActive)setTimeout(()=>{if(raid&&!raid.over)floatText(".fighter.me","BAJRANG GUN!","crit");},Math.max(40,(typeof BJ_T!=="undefined"?BJ_T.first:820)-80));
      if(hpPurple)setTimeout(()=>{if(raid&&!raid.over)floatText(".fighter.foe","HOLLOW PURPLE","crit");},rHitDelay+40);
    }
  }
  raid.hp-=total;raid.dealt+=total;
  {const rdEl=document.getElementById("wbrRunDmg");if(rdEl)rdEl.textContent=fmtBig(raid.dealt);}
  /* SUPER MEGA DEATH ROCKET (HAVOC WREACKER di Raid): langsung aktif saat masuk/turn 1, maks 3x per battle */
  let havocFired=false;
  if(havocWillFire){
    raid.havocGuard=false;
    raid.havocUses=(raid.havocUses||0)+1;
    havocFired=true;
    const rk=Math.round(raid.atk*(fx.havocRocket.pct||50)/100);
    raid.hp-=rk;raid.dealt+=rk;
    if(typeof window.havocRocketFx==="function"){try{window.havocRocketFx({fromSel:".fighter.me",toSel:".fighter.foe"});}catch(e){}}
    const hvHit=(typeof HR_T!=="undefined"?HR_T.first:620);
    setTimeout(()=>{
      if(raid&&!raid.over){
        const foeEl=document.querySelector(".fighter.foe");
        if(foeEl&&typeof window.hzFlashCard==="function"){try{window.hzFlashCard(foeEl,"hit");}catch(e){}}
        if(typeof triggerStageShake==="function"){try{triggerStageShake(true);}catch(e){}}
        if(foeEl&&typeof foeEl.animate==="function"){
          try{foeEl.getAnimations().forEach(a=>a.cancel());}catch(e){}
          foeEl.animate([
            {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:0},
            {transform:"translate3d(18px,-12px,0) scale(0.93) rotate(6deg)",offset:0.26},
            {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:1}
          ],{duration:340,easing:"cubic-bezier(0.22, 1, 0.36, 1)",fill:"none"});
        }
        if(window.CyberSfx&&window.CyberSfx.aoeDetonate)try{window.CyberSfx.aoeDetonate();}catch(e){}
        floatText(".fighter.foe","SUPER MEGA DEATH ROCKET -"+fmt(rk)+" ("+raid.havocUses+"/"+(fx.havocRocket.maxUses||3)+")","crit");
        setRaidBar(raid.hp);
      }
    },hvHit);
  }
  setRaidBar(rStartHp);
  const tl=document.getElementById("raidTurnLabel");if(tl)tl.innerHTML="TURN<br>"+raid.turn+"/"+raid.cap;
  if(raid.hp<=0){
    const special=(domainActive||ariseMode||ranton||galaxyMode||havocFired||gammaRayHit||psychicActive||bajrangActive||hpPurple||wePhase>=0);
    const killWait=Math.max(rChainEnd, special?1100:0);
    if(killWait>260){ setTimeout(()=>{if(raid&&!raid.over)endRaid();},killWait); }
    else endRaid();
    return;
  }
  raid.timer=setTimeout(raidStep,bajrangActive?(typeof BJ_T!=="undefined"?BJ_T.first+1300:2120):wePhase>=0?1350:psychicActive?Math.max(1000,(typeof PSY_T!=="undefined"?PSY_T.first:560)+(Math.max(1,raid.psyN||1)-1)*rHstep+640):ariseMode?1800:domainActive?1600:ranton?1600:isRaidCombo?1200:1050);
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
  const runId=wbRunId, runBossKey=wbRunBoss;
  wbRunId=null;wbRunBoss=null;
  if(runId&&window.CloudDB&&currentUser){
    const runBoss=WB_BOSSES.find(x=>x.key===runBossKey)||wbBoss();
    raid.wbPending=true;
    window.CloudDB.wbSubmit(currentUser,runId,dmg,runBoss.id).then(res=>{
      if(!raid)return;
      raid.wbPending=false;
      raid.wbRes=res||{ok:false,msg:"OFFLINE"};
      if(res&&res.ok){
        const bd=wbByBoss[runBoss.key];
        if(bd){
          bd.best_dmg=Math.max(bd.best_dmg||0,res.best_dmg||dmg);
          bd.total_dmg=typeof res.total_dmg==="number"?res.total_dmg:((bd.total_dmg||0)+(res.dmg||dmg));
          if(res.rank)bd.rank=res.rank;
          if(typeof res.attempts_left==="number"){bd.attempts_left=res.attempts_left;bd.attempts_used=3-res.attempts_left;}
          if(typeof res.hp_left==="number"){bd.hp_pool=res.hp_pool;bd.hp_left=res.hp_left;}
          wbAt=Date.now();
        }
      }
      if(raidView==="result"){renderRaidResult();wbScheduleAutoRepeat();}
    }).catch(()=>{
      if(raid){raid.wbPending=false;raid.wbRes={ok:false,msg:"NETWORK"};}
      if(raidView==="result"){renderRaidResult();wbScheduleAutoRepeat();}
    });
  }else if(!wbOnline()){
    const idx=WB_BOSSES.findIndex(x=>x.key===(runBossKey||wbBoss().key));
    const g=wbGuestState(idx>=0?idx:wbBossIdx);
    g.attempts_left=Math.max(0,g.attempts_left-1);
    g.left=Math.max(0,g.left-dmg);
    g.best_dmg=Math.max(g.best_dmg||0,dmg);
    g.total_dmg=(g.total_dmg||0)+dmg;
  }
  setTimeout(()=>{raidView="result";renderRaid();wbScheduleAutoRepeat();},2000);
}

function wbCanAutoRepeat(){
  if(!state||!state.wbAutoRepeat)return false;
  if(wbOnline()&&raid&&raid.wbPending)return false;
  const cb=wbBoss();
  if(cb.locked)return false;
  const {left}=wbPoolVals();
  if(left<=0)return false;
  const att=wbAttOf(wbBossIdx);
  return att==null||att>0;
}

function wbScheduleAutoRepeat(){
  clearTimeout(wbAutoTimer);wbAutoTimer=null;
  if(route()!=="#/raid"||raidView!=="result")return;
  if(!wbCanAutoRepeat())return;
  wbAutoTimer=setTimeout(()=>{
    if(route()==="#/raid"&&raidView==="result"&&wbCanAutoRepeat()){
      wbLaunchRaid();
    }
  },1800);
}

function renderRaidResult(){
  const b=wbBoss();
  const meta=wbBossMetaOf(b);
  const dmg=raid?raid.dmg||0:0;
  const pct=raid?raid.pct||0:0;
  const {pool,left:poolLeft}=wbPoolVals();
  const poolPct=pool>0?Math.max(0,Math.min(100,poolLeft/pool*100)):0;
  const totalDmg=wbTotalDmg();
  const bestDmg=Math.max(wbBestRunDmg(),dmg);
  const att=wbAttOf(wbBossIdx);
  const claimedSet=new Set(wbMilestonesClaimed());
  const msCleared=WB_MILESTONES.filter(m=>totalDmg>=m.req).length;
  const msReady=WB_MILESTONES.filter(m=>totalDmg>=m.req&&!claimedSet.has(m.tier)).length;
  const striker=wbSelectedStriker();
  const strikerCard=(striker&&CARDS[striker.char])||null;

  let statusCls="", statusTxt="";
  if(wbOnline()&&raid){
    if(raid.wbPending){ statusTxt="SUBMITTING DAMAGE TO WORLD BOSS SERVER\u2026"; }
    else if(raid.wbRes&&raid.wbRes.ok){
      statusCls=" ok";
      statusTxt="RECORDED \u00b7 PEAK "+fmtBig(raid.wbRes.best_dmg)+" \u00b7 RANK #"+(raid.wbRes.rank||"\u2014")+(raid.wbRes.total_players?"/"+raid.wbRes.total_players:"")+" \u00b7 "+raid.wbRes.attempts_left+" ATTEMPT(S) LEFT";
    }else if(raid.wbRes){
      statusCls=" bad";
      statusTxt="SUBMIT FAILED ("+(raid.wbRes.msg||"ERROR")+") \u00b7 ATTEMPT CONSUMED";
    }else{
      statusTxt="LOCAL PRACTICE RUN \u00b7 SCORE NOT SUBMITTED";
    }
  }else{
    statusCls=" ok";
    statusTxt="LOCAL RUN SAVED \u00b7 CUMULATIVE "+fmtBig(totalDmg)+" DMG \u00b7 "+(att==null?0:att)+"/3 LEFT";
  }

  const autoReady=wbCanAutoRepeat();
  const autoHtml=autoReady?`<div class="rr-auto-box" id="rrAutoBox"><span>AUTO REPEAT ACTIVE \u2014 RE-DEPLOYING IN 2s\u2026</span><button type="button" class="rr-auto-stop" id="rrAutoStop">STOP AUTO</button></div>`:"";
  const cryHtml=[0,1,2].map(i=>`<span class="wb-cr${i<(att==null?0:att)?"":" off"}"></span>`).join("");
  const canFightAgain=!b.locked&&poolLeft>0&&(att==null||att>0);
  const againTxt=b.locked?"BOSS LOCKED":(poolLeft<=0?"BOSS DEFEATED":((att!=null&&att<=0)?"NO ATTEMPTS LEFT":"RAID AGAIN ("+(att==null?3:att)+"/3)"));
  const defeated=pct>=100||poolLeft<=0;

  app.innerHTML=`
  <div id="wbView" class="wbv2 wb-res-root rd-page">
    <div class="wb-shell wb-res-shell is-entered">
      <div class="wb-banner-bar">
        <div class="wb-banner-ribbon">
          <div class="wb-banner-cap">
            <div class="wb-banner-cap-in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>
              </svg>
              <span>RESULT</span>
            </div>
          </div>
          <div class="wb-banner-mid">
            <div class="wb-banner-titles">
              <h1 class="wb-title">WORLD BOSS <em>RESULT</em></h1>
              <span class="wb-eyebrow">// ${wbEsc(b.name)} &middot; ${RAID_TURNS}-TURN DEBRIEF</span>
            </div>
            <div class="wb-banner-tags">
              ${strikerCard?`<span class="wb-banner-tag">STRIKER: ${wbEsc(strikerCard.name.toUpperCase())}</span>`:""}
              <span class="wb-banner-tag hz">RESET: ${wbResetText().toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div class="wb-banner-right">
          <button type="button" class="wb-x" id="wbResClose" aria-label="Return to World Boss Hub">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <div class="wb-slashes" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </div>

      <div class="wb-panel wb-res-panel">
        <div class="wb-tape-line" aria-hidden="true"></div>
        <div class="wb-res-grid">
          <aside class="wb-res-boss">
            <div class="wb-res-bhead">
              <b>${wbEsc(b.name)}</b>
              <span class="wb-res-state${defeated?" dead":""}">${defeated?"BOSS DEFEATED":"RUN COMPLETE"}</span>
            </div>
            <div class="wb-res-art">
              <img src="${meta.art}" alt="${wbEsc(b.name)}">
              <span class="wb-art-brk tl" aria-hidden="true"></span>
              <span class="wb-art-brk tr" aria-hidden="true"></span>
              <span class="wb-art-brk bl" aria-hidden="true"></span>
              <span class="wb-art-brk br" aria-hidden="true"></span>
            </div>
            <div class="wb-hp-block">
              <div class="wb-hp-bar">
                <div class="wb-hp-fill" style="width:${poolPct.toFixed(1)}%"></div>
                <div class="wb-hp-txt">${fmtBig(poolLeft)} / ${fmtBig(pool)} HP</div>
              </div>
            </div>
          </aside>

          <section class="wb-res-main">
            <div class="wb-res-hero">
              <span class="wb-res-kicker">DAMAGE DEALT THIS RUN</span>
              <div class="wb-res-dmg">${fmtBig(dmg)}</div>
              <div class="wb-res-pct"><b>${pct.toFixed(2)}%</b> <span>OF 10B SERVER POOL</span></div>
            </div>

            <div class="wb-res-stats">
              <div class="wb-res-stat"><small>PEAK SINGLE RUN</small><b>${fmtBig(bestDmg)}</b></div>
              <div class="wb-res-stat"><small>TODAY CUMULATIVE</small><b>${fmtBig(totalDmg)}</b></div>
              <div class="wb-res-stat">
                <small>MILESTONES &middot; ATTEMPTS</small>
                <b>${msCleared}/7${msReady>0?` <em class="wb-res-ready">${msReady} READY</em>`:""}</b>
                <span class="wb-crystals">${cryHtml}</span>
              </div>
            </div>

            <div class="wb-res-status${statusCls}">${wbEsc(statusTxt)}</div>
            ${autoHtml}
            <div class="wb-res-note">Your highest single-run score sets your daily MVP rank. Cumulative damage unlocks Milestones &amp; Everyone payouts in the Hub.</div>
          </section>
        </div>

        <footer class="wb-res-foot">
          <button type="button" class="wb-act fight${canFightAgain?"":" disabled"}" id="rrAgain">${againTxt}</button>
          <button type="button" class="wb-act" id="rrHub">BACK TO HUB${msReady>0?` (${msReady} CLAIMABLE)`:""}</button>
        </footer>
      </div>
    </div>
  </div>`;

  const goHub=()=>{clearTimeout(wbAutoTimer);wbAutoTimer=null;raidView="hub";renderRaid();};
  document.getElementById("rrAgain").onclick=()=>{clearTimeout(wbAutoTimer);wbAutoTimer=null;wbLaunchRaid();};
  document.getElementById("rrHub").onclick=goHub;
  const rc=document.getElementById("wbResClose");
  if(rc)rc.onclick=goHub;
  const stopBtn=document.getElementById("rrAutoStop");
  if(stopBtn){
    stopBtn.onclick=()=>{
      clearTimeout(wbAutoTimer);wbAutoTimer=null;
      state.wbAutoRepeat=false;
      try{save();}catch(e){}
      renderRaidResult();
      raidToast("AUTO REPEAT STOPPED");
    };
  }
  wbRefresh();
}

function stackHas(char,mut){mut=mut||"none";return state.stacks.some(s=>s.char===char&&(s.mut||"none")===mut);}
const WB_SHOP=[
  {id:"gem",name:"Token → Gem // 100:20",cost:100,gem:20,desc:"Trade 100 Tokens for 20 Gems.",apply:()=>""},
  {id:"coins",name:"2,000 Coins",cost:12,coinBuy:true,desc:"Coin Mint · 2,000 Coins for rolls & upgrades.",apply:()=>""},
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
  if(tok<it.cost){raidToast("NOT ENOUGH TOKENS — need "+fmt(it.cost)+" Tokens");return;}
  if(it.coinBuy){
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
        save();try{sfx.crit();}catch(e){}renderShell();
        raidToast("EXCHANGED · -"+fmt(it.cost)+" Tokens · +"+fmt(res.coins||2000)+" Coins");
      }else{
        const why=(res&&res.msg)==="TOKEN_KURANG"?"Not enough tokens":((res&&res.msg)==="DAILY_CAP"?"Daily limit reached":((res&&res.msg)||"Try again"));
        raidToast("EXCHANGE FAILED — "+why);
      }
      wbAfterShopBuy();
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
          res=await window.CloudDB.exchangeTokens(u,"wb");
        }else{
          state.wbTokens-=it.cost;
          state.premiumGems=(state.premiumGems||0)+GEM_AMT;
          res={ok:true,gems:GEM_AMT,tokens:state.wbTokens};
        }
      }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
      if(res&&res.ok){
        if(typeof res.tokens==="number")state.wbTokens=res.tokens;
        save();try{sfx.crit();}catch(e){}renderShell();
        raidToast("EXCHANGED · -"+fmt(it.cost)+" Tokens · +"+(res.gems||GEM_AMT)+" Gems");
      }else{
        try{save();}catch(e){}
        const why=(res&&res.msg)==="TOKEN_KURANG"?"Not enough tokens":((res&&res.msg)||"Try again");
        raidToast("EXCHANGE FAILED — "+why);
      }
      wbAfterShopBuy();
    })();
    return;
  }
  if(it.card&&stackHas(it.card.char,it.card.mut)){raidToast("That card is already in your Deck.");return;}
  if(it.owned&&it.owned()){raidToast("Already owned — permanent in Backpack.");return;}
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
      const msg=it.apply();save();try{sfx.crit();}catch(e){}renderShell();
      raidToast("ACQUIRED "+msg+" · -"+fmt(it.cost)+" Tokens");
    }else{
      try{save();}catch(e){}
      const why=(res&&res.msg)==="TOKEN_KURANG"?"Not enough tokens":((res&&res.msg)==="DAILY_CAP"?"Daily limit reached":((res&&res.msg)||"Try again"));
      raidToast("PURCHASE FAILED — "+why);
    }
    wbAfterShopBuy();
  })();
}

/* =============== INDEX CARD v2 (WoB Hazard Archive + 3D Inspector) =============== */
const IX_MUTS=["none","gold","rainbow","secret","ultima"];
const IX_CAT_ORDER=["all","owned","missing","standard","weather","boss","relics","pets"];
const IX_SORT_ORDER=["default","rarity-asc","rarity-desc","name","variants","atk","hp"];
const IX_SIZE_ORDER=["S","M","L"];
let ixState={
  cat:"all",mut:"all",shiny:false,source:"all",sort:"default",q:"",size:"M",
  selectedId:null,dlgKind:"card",dlgList:[],dlgIdx:0,dlgBorder:"none",dlgShiny:false,
  dlgMovable:true,dlgHideText:false,dlgPeekArt:false,rotX:0,rotY:0,zoom:1,dragging:false,lx:0,ly:0
};
let _ixBound=false,_ixLiveCells=[],_ixClaimBusy=false,_ixRenderRaf=0;
function _ixEl(id){return document.getElementById(id);}
function _ixEsc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function _ixValidCards(){
  return (typeof MASTER_CARD_INDEX!=="undefined"?MASTER_CARD_INDEX:[]).filter(c=>c&&!c.isStoryEnemy&&!(c.noGacha&&!c.chance));
}
function _ixCardDescEn(c){
  const raw=(c&&c.passive&&c.passive.desc)||"";
  return (typeof GameLang!=="undefined"&&GameLang&&typeof GameLang.cardDescEn==="function")
    ? GameLang.cardDescEn(c.char_id,raw) : raw;
}
function _ixGearNameEn(kind,g){
  if(!g)return "";
  if(kind==="relic")return (typeof GameLang!=="undefined"&&GameLang&&GameLang.artNameEn)?GameLang.artNameEn(g.id,g.name):g.name;
  return (typeof GameLang!=="undefined"&&GameLang&&GameLang.petNameEn)?GameLang.petNameEn(g.id,g.name):g.name;
}
function _ixCardSourceLabel(c){
  if(!c)return "STANDARD PACK";
  if(c.towerBoss)return "INF TOWER SHOP";
  if(c.raidBoss)return "WORLD BOSS SHOP";
  if(c.weatherOnly){
    const w=(typeof WEATHER!=="undefined"&&WEATHER)?WEATHER[c.weatherOnly]:null;
    return ((w&&w.name)||String(c.weatherOnly).toUpperCase())+" WEATHER";
  }
  return "STANDARD PACK";
}
function _ixGearSourceLabel(g){
  if(!g||!g.src||g.src==="coin")return "COIN SHOP";
  if(g.src==="tower")return "INFINITE TOWER";
  if(g.src==="raid")return "WORLD BOSS SHOP";
  if(g.src==="premium")return "PREMIUM SHOP";
  return String(g.src).toUpperCase();
}
function _ixBuildOwnMap(validCards){
  const map={};
  for(let i=0;i<validCards.length;i++){
    const c=validCards[i];
    map[c.char_id]={owned:false,variants:0,copies:0,anyShiny:false,best:"none",got:{},shiny:{}};
  }
  const st=(typeof state!=="undefined"&&state&&Array.isArray(state.stacks))?state.stacks:[];
  for(let i=0;i<st.length;i++){
    const s=st[i];if(!s)continue;
    const ow=map[s.char];if(!ow)continue;
    const m=(s.mut&&MUT_LABEL[s.mut])?s.mut:"none";
    const sh=!!s.shiny;
    ow.copies+=Math.max(1,Number(s.count)||1);
    if(sh){ow.shiny[m]=true;ow.anyShiny=true;}
    else ow.got[m]=true;
  }
  const prio=["ultima","secret","rainbow","gold","none"];
  for(const cid in map){
    const ow=map[cid];
    let v=0;
    for(const m of IX_MUTS){if(ow.got[m])v++;if(ow.shiny[m])v++;}
    ow.variants=v;ow.owned=v>0;
    for(const m of prio){if(ow.got[m]||ow.shiny[m]){ow.best=m;break;}}
  }
  return map;
}
function _ixSourcesList(validCards){
  const list=[
    {id:"all",name:"All Sources",color:"#f3e600",fn:()=>true},
    {id:"standard",name:"Standard Pack",color:"#f5f5f5",fn:c=>!c.weatherOnly&&!c.raidBoss&&!c.towerBoss},
    {id:"boss",name:"Boss Shop",color:"#ff4d5e",fn:c=>!!(c.raidBoss||c.towerBoss)}
  ];
  const wx=(typeof WEATHERS!=="undefined"&&Array.isArray(WEATHERS))?WEATHERS:[];
  for(const w of wx){
    if(validCards.some(c=>c.weatherOnly===w.id)){
      const label=w.name.charAt(0)+w.name.slice(1).toLowerCase()+" Weather";
      list.push({id:"w:"+w.id,name:label,color:w.color,fn:((wid)=>c=>c.weatherOnly===wid)(w.id)});
    }
  }
  return list;
}
function _ixCardOwnedInFilter(ow){
  if(!ow)return false;
  if(ixState.mut==="all")return ixState.shiny?ow.anyShiny:ow.owned;
  return ixState.shiny?!!ow.shiny[ixState.mut]:!!(ow.got[ixState.mut]||ow.shiny[ixState.mut]);
}
function _ixFilterCards(validCards,ownMap){
  const q=ixState.q.trim().toLowerCase();
  const srcObj=_ixSourcesList(validCards).find(s=>s.id===ixState.source);
  const srcFn=srcObj?srcObj.fn:()=>true;
  const list=validCards.filter(c=>{
    const ow=ownMap[c.char_id];
    const ownedF=_ixCardOwnedInFilter(ow);
    if(ixState.cat==="owned"&&!ownedF)return false;
    if(ixState.cat==="missing"&&ownedF)return false;
    if(ixState.cat==="standard"&&(c.weatherOnly||c.raidBoss||c.towerBoss))return false;
    if(ixState.cat==="weather"&&!c.weatherOnly)return false;
    if(ixState.cat==="boss"&&!c.raidBoss&&!c.towerBoss)return false;
    if(!srcFn(c))return false;
    if(q){
      const hay=(c.name+" "+(c.type||"")+" "+((c.passive&&c.passive.name)||"")+" "+(c.weatherOnly||"")+" "+_ixCardDescEn(c)).toLowerCase();
      if(!hay.includes(q))return false;
    }
    if((ixState.mut!=="all"||ixState.shiny)&&ixState.cat!=="missing"&&!ownedF)return false;
    return true;
  });
  const baseIdx=Object.fromEntries(validCards.map((c,i)=>[c.char_id,i]));
  const cVal=c=>c.chance||chanceOf(c.tier)||1;
  list.sort((a,b)=>{
    if(ixState.sort==="rarity-asc")return cVal(b)-cVal(a)||(baseIdx[a.char_id]-baseIdx[b.char_id]);
    if(ixState.sort==="rarity-desc")return cVal(a)-cVal(b)||(baseIdx[a.char_id]-baseIdx[b.char_id]);
    if(ixState.sort==="name")return a.name.localeCompare(b.name);
    if(ixState.sort==="variants")return ownMap[b.char_id].variants-ownMap[a.char_id].variants||cVal(b)-cVal(a);
    if(ixState.sort==="atk")return (b.base_atk||0)-(a.base_atk||0)||(baseIdx[a.char_id]-baseIdx[b.char_id]);
    if(ixState.sort==="hp")return (b.base_hp||0)-(a.base_hp||0)||(baseIdx[a.char_id]-baseIdx[b.char_id]);
    return baseIdx[a.char_id]-baseIdx[b.char_id];
  });
  return list;
}
function _ixFilterGear(kind){
  const q=ixState.q.trim().toLowerCase();
  const defs=kind==="relics"?(typeof ART_DEFS!=="undefined"?ART_DEFS:[]):(typeof PET_DEFS!=="undefined"?PET_DEFS:[]);
  const ownSet=new Set(kind==="relics"?((state&&state.artOwned)||[]):((state&&state.petOwned)||[]));
  const srcRank={coin:0,tower:1,raid:2,premium:3};
  const baseIdx=Object.fromEntries(defs.map((d,i)=>[d.id,i]));
  const items=defs.filter(g=>{
    if(!q)return true;
    const nm=_ixGearNameEn(kind==="relics"?"relic":"pet",g);
    return (nm+" "+(g.src||"coin")).toLowerCase().includes(q);
  });
  items.sort((a,b)=>{
    const na=_ixGearNameEn(kind==="relics"?"relic":"pet",a),nb=_ixGearNameEn(kind==="relics"?"relic":"pet",b);
    if(ixState.sort==="name")return na.localeCompare(nb);
    if(ixState.sort==="variants")return (ownSet.has(b.id)?1:0)-(ownSet.has(a.id)?1:0)||(b.pct-a.pct);
    if(ixState.sort==="atk"||ixState.sort==="hp"||ixState.sort==="rarity-asc")return ((b.pct*10+b.flat)-(a.pct*10+a.flat));
    if(ixState.sort==="rarity-desc")return (a.pct*10+a.flat)-(b.pct*10+b.flat);
    return (srcRank[a.src||"coin"]-srcRank[b.src||"coin"])||(baseIdx[a.id]-baseIdx[b.id]);
  });
  return items;
}
function _ixInitVarTabStamps(){
  document.querySelectorAll("#varTabs [data-vtab-ic]").forEach(el=>{
    const k=el.getAttribute("data-vtab-ic");
    el.outerHTML=(k==="shiny")?shinyStampHtml(true):mutStampHtml(k,true,"",true);
  });
}
function ixLiveShimmer(){
  const sc=_ixEl("gridScroll");
  if(!sc)return;
  if(sc.__ixIO){try{sc.__ixIO.disconnect();}catch(e){}}
  const cells=_ixLiveCells=[].slice.call(sc.querySelectorAll(".ix-tile.is-shiny"));
  if(!cells.length)return;
  const MAX=8;
  const update=()=>{
    const vr=sc.getBoundingClientRect();
    const vc=(vr.top+vr.bottom)/2;
    const vis=cells.filter(c=>{
      const r=c.getBoundingClientRect();
      return r.bottom>vr.top&&r.top<vr.bottom;
    });
    vis.sort((a,b)=>{
      const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
      return Math.abs((ra.top+ra.bottom)/2-vc)-Math.abs((rb.top+rb.bottom)/2-vc);
    });
    cells.forEach(c=>c.classList.remove("ix-live"));
    vis.slice(0,MAX).forEach(c=>c.classList.add("ix-live"));
  };
  if(typeof IntersectionObserver==="function"){
    const io=new IntersectionObserver(update,{root:sc,rootMargin:"0px",threshold:[0,0.1]});
    cells.forEach(c=>io.observe(c));
    sc.__ixIO=io;
  }
  if(!sc.__ixScr){
    sc.__ixScr=true;
    sc.addEventListener("scroll",()=>{
      if(_ixRenderRaf)return;
      _ixRenderRaf=requestAnimationFrame(()=>{_ixRenderRaf=0;ixLiveUpdateNow();});
    },{passive:true});
  }
  update();
}
function ixLiveUpdateNow(){
  const sc=_ixEl("gridScroll");if(!sc||!_ixLiveCells.length)return;
  const vr=sc.getBoundingClientRect();
  const vc=(vr.top+vr.bottom)/2;
  const vis=_ixLiveCells.filter(c=>{const r=c.getBoundingClientRect();return r.bottom>vr.top&&r.top<vr.bottom;});
  vis.sort((a,b)=>{const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();return Math.abs((ra.top+ra.bottom)/2-vc)-Math.abs((rb.top+rb.bottom)/2-vc);});
  _ixLiveCells.forEach(c=>c.classList.remove("ix-live"));
  vis.slice(0,8).forEach(c=>c.classList.add("ix-live"));
}
function ixRender(){
  if(!_ixEl("cardGrid"))return;
  _ixBindEvents();
  const validCards=_ixValidCards();
  const ownMap=_ixBuildOwnMap(validCards);
  const P=idxProgress();
  const totalCards=validCards.length;
  const artDefs=(typeof ART_DEFS!=="undefined"?ART_DEFS:[]);
  const petDefs=(typeof PET_DEFS!=="undefined"?PET_DEFS:[]);
  const artOwned=new Set((state&&state.artOwned)||[]);
  const petOwned=new Set((state&&state.petOwned)||[]);

  let ownUnique=0,stdN=0,stdOwn=0,wxN=0,wxOwn=0,bossN=0,bossOwn=0;
  for(const c of validCards){
    const ow=ownMap[c.char_id];
    const has=ow.owned;
    if(has)ownUnique++;
    if(c.raidBoss||c.towerBoss){bossN++;if(has)bossOwn++;}
    else if(c.weatherOnly){wxN++;if(has)wxOwn++;}
    else{stdN++;if(has)stdOwn++;}
  }
  const setT=(id,v)=>{const e=_ixEl(id);if(e)e.textContent=v;};
  setT("cnt-all",ownUnique+"/"+totalCards);
  setT("cnt-owned",ownUnique);
  setT("cnt-missing",Math.max(0,totalCards-ownUnique));
  setT("cnt-standard",stdOwn+"/"+stdN);
  setT("cnt-weather",wxOwn+"/"+wxN);
  setT("cnt-boss",bossOwn+"/"+bossN);
  setT("cnt-relics",artOwned.size+"/"+artDefs.length);
  setT("cnt-pets",petOwned.size+"/"+petDefs.length);

  document.querySelectorAll("#catTabs .ix-cat").forEach(b=>{
    const on=b.dataset.cat===ixState.cat;
    b.classList.toggle("on",on);
    b.setAttribute("aria-selected",on?"true":"false");
  });

  const pct=totalCards?Math.round(ownUnique/totalCards*100):0;
  setT("hdrSubEyebrow","// NEURAL VAULT · "+totalCards+" UNITS · "+fmt(P.total)+" VARIANTS");
  setT("sidePct",pct+"%");
  setT("sideOwn",ownUnique);
  setT("sideTot",totalCards);
  const sb=_ixEl("sideBar");if(sb)sb.style.width=pct+"%";
  setT("sideVarTxt",fmt(P.count)+" / "+fmt(P.total));
  setT("hdrVarBadge","VARIANTS: "+fmt(P.count)+"/"+fmt(P.total));
  setT("hdrPacksBadge","5K PACKS: "+fmt((state&&state.rollPacks&&state.rollPacks.r5k)||0));
  setT("mobProgTxt",ownUnique+" / "+totalCards+" ("+pct+"%)");
  const mp=_ixEl("mobProgBar");if(mp)mp.style.width=pct+"%";

  const segColors={none:"#9AA6B2",gold:"#E0BC6E",rainbow:"var(--rb)",secret:"#A855F7",ultima:"#FF0055"};
  const segEl=_ixEl("sideSegs");
  if(segEl){
    segEl.innerHTML=IX_MUTS.map(m=>{
      let cnt=0;
      for(const c of validCards){if(ownMap[c.char_id].got[m]||ownMap[c.char_id].shiny[m])cnt++;}
      const sp=totalCards?Math.round(cnt/totalCards*100):0;
      return '<i style="--p:'+sp+'%;--c:'+segColors[m]+'" title="'+MUT_LABEL[m]+": "+cnt+"/"+totalCards+'"></i>';
    }).join("");
  }

  const srcs=_ixSourcesList(validCards);
  setT("srcCountLbl",srcs.length+" POOLS");
  const srcList=_ixEl("srcList");
  if(srcList){
    srcList.innerHTML=srcs.map(s=>{
      const pool=validCards.filter(s.fn);
      const got=pool.filter(c=>ownMap[c.char_id].owned).length;
      const on=ixState.source===s.id;
      return '<button type="button" class="ix-src-btn'+(on?" on":"")+'" data-src="'+_ixEsc(s.id)+'" style="--sc:'+s.color+'">'
        +'<span class="ix-src-nm"><i class="ix-src-dot"></i>'+_ixEsc(s.name)+'</span>'
        +'<span class="ix-src-cnt">'+got+'/'+pool.length+'</span></button>';
    }).join("");
    srcList.querySelectorAll("[data-src]").forEach(btn=>{
      btn.onclick=()=>{ixState.source=btn.dataset.src;ixRender();};
    });
  }
  const mobSrc=_ixEl("mobSourceSelect");
  if(mobSrc){
    mobSrc.innerHTML=srcs.map(s=>{
      const pool=validCards.filter(s.fn);
      const got=pool.filter(c=>ownMap[c.char_id].owned).length;
      return '<option value="'+_ixEsc(s.id)+'">'+_ixEsc(s.name.toUpperCase())+' ('+got+'/'+pool.length+')</option>';
    }).join("");
    mobSrc.value=ixState.source;
  }

  const claimable=Math.max(0,P.blocks-P.claimed);
  const toNext=Math.max(0,IDX_MILESTONE-(P.count%IDX_MILESTONE));
  const claimBtn=_ixEl("btnClaim"),claimBadge=_ixEl("claimBadge"),msSub=_ixEl("msSubTxt"),mobClaim=_ixEl("mobClaimBtn");
  if(claimBtn)claimBtn.disabled=claimable<=0||_ixClaimBusy;
  if(claimBadge){claimBadge.hidden=claimable<=0;claimBadge.textContent=String(claimable);}
  if(msSub){
    msSub.innerHTML=claimable>0
      ?('<b>'+claimable+' reward'+(claimable>1?'s':'')+' ready to claim!</b>')
      :('Next pack in <b>'+toNext+'</b> more variants');
  }
  if(mobClaim){mobClaim.disabled=claimable<=0||_ixClaimBusy;mobClaim.textContent="CLAIM (+"+claimable+")";}

  document.querySelectorAll("#varTabs [data-mut]").forEach(b=>b.classList.toggle("on",b.dataset.mut===ixState.mut));
  const shTog=_ixEl("shinyToggle");if(shTog)shTog.classList.toggle("on",ixState.shiny);
  const mobMut=_ixEl("mobMutSelect");if(mobMut)mobMut.value=ixState.shiny?"shiny":ixState.mut;
  const sortSel=_ixEl("sortSelect");if(sortSel)sortSel.value=ixState.sort;

  const grid=_ixEl("cardGrid");
  grid.className="ix-grid sz-"+ixState.size;
  setT("btnCardSize","SIZE: "+ixState.size+" [Z]");
  const clr=_ixEl("searchClr");if(clr)clr.classList.toggle("show",!!ixState.q);

  const isGear=(ixState.cat==="relics"||ixState.cat==="pets");
  const varStrip=_ixEl("varStrip");if(varStrip)varStrip.style.display=isGear?"none":"";

  if(isGear){
    const kind=ixState.cat==="relics"?"relic":"pet";
    const items=_ixFilterGear(ixState.cat);
    const ownSet=ixState.cat==="relics"?artOwned:petOwned;
    let gOwnN=0;for(const g of items)if(ownSet.has(g.id))gOwnN++;
    const lbl=ixState.cat==="relics"?"RELICS":"PETS";
    _ixEl("subLine1").innerHTML='SHOWING <b>'+items.length+'</b> '+lbl+' · <span class="g">'+gOwnN+' OWNED</span> · <span class="m">'+(items.length-gOwnN)+' MISSING</span>';
    _ixEl("subLine2").innerHTML='<span>Permanent Luck Gear · Equip inside Backpack</span>';
    _ixEl("btnNextMissing").style.display="none";
    if(!items.length){
      grid.innerHTML='<div class="ix-empty">NO MATCHING '+lbl+' FOUND</div>';
      _ixLiveCells=[];
      return;
    }
    grid.innerHTML=items.map((g,idx)=>{
      const own=ownSet.has(g.id);
      const srcShort=g.src==="tower"?"TOWER":g.src==="raid"?"WB SHOP":g.src==="premium"?"GEMS":"COINS";
      const gName=_ixGearNameEn(kind,g);
      const gMut=(!g.src||g.src==="coin")?"none":"gold";
      return '<button type="button" class="ix-tile gear'+(own?hzBorderCls(gMut,false,{tile:true,dense:true}):" no-own")+'" data-gear-idx="'+idx+'">'
        +'<img src="'+_ixEsc(thumbSrc(g.img))+'" alt="'+_ixEsc(gName)+'" width="360" height="360" decoding="async">'
        +(own?hzBorderLayerHtml():'<span class="ix-tile-q" aria-hidden="true">?</span>')
        +'<span class="ix-tile-top">'
          +'<span class="ix-tile-tags"><span class="ix-badge">'+srcShort+'</span></span>'
          +'<span class="ix-tile-cnt'+(own?"":" zero")+'">'+(own?"OWNED":"LOCKED")+'</span>'
        +'</span>'
        +'<span class="ix-tile-foot">'
          +'<span class="ix-tile-nm">'+_ixEsc(gName)+'</span>'
          +'<span class="ix-tile-ch" style="color:var(--ok)">+'+g.flat+' FLAT · +'+g.pct+'% LUCK</span>'
        +'</span>'
      +'</button>';
    }).join("");
    _ixLiveCells=[];
    grid.querySelectorAll("[data-gear-idx]").forEach(btn=>{
      btn.onclick=()=>_ixOpenGearInfo(kind,items,Number(btn.dataset.gearIdx));
    });
    return;
  }

  _ixEl("btnNextMissing").style.display="";
  const list=_ixFilterCards(validCards,ownMap);
  const ownedInList=list.filter(c=>_ixCardOwnedInFilter(ownMap[c.char_id])).length;
  _ixEl("subLine1").innerHTML='SHOWING <b>'+list.length+'</b> OF <b>'+totalCards+'</b> CARDS · <span class="g">'+ownedInList+' OWNED</span> · <span class="m">'+(list.length-ownedInList)+' MISSING</span>';

  let rarestOwn=null,easiestMiss=null;
  for(const c of validCards){
    const ch=c.chance||chanceOf(c.tier)||1;
    if(ownMap[c.char_id].owned){if(!rarestOwn||ch>(rarestOwn.chance||1))rarestOwn=c;}
    else{if(!easiestMiss||ch<(easiestMiss.chance||1))easiestMiss=c;}
  }
  _ixEl("subLine2").innerHTML=
    (rarestOwn?'<span>RAREST OWNED: <button type="button" class="ix-jump-link" id="jumpRarest">'+_ixEsc(rarestOwn.name)+' (1/'+fmtChance(rarestOwn.chance||chanceOf(rarestOwn.tier))+')</button></span>':'<span>RAREST OWNED: NONE YET</span>')
    +(easiestMiss?'<span>EASIEST MISSING: <button type="button" class="ix-jump-link miss" id="jumpEasiest">'+_ixEsc(easiestMiss.name)+' (1/'+fmtChance(easiestMiss.chance||chanceOf(easiestMiss.tier))+')</button></span>':'<span>ALL 75 CARDS DISCOVERED!</span>');
  if(_ixEl("jumpRarest"))_ixEl("jumpRarest").onclick=()=>_ixOpenById(rarestOwn.char_id);
  if(_ixEl("jumpEasiest"))_ixEl("jumpEasiest").onclick=()=>_ixOpenById(easiestMiss.char_id);

  if(!list.length){
    grid.innerHTML='<div class="ix-empty">NO MATCHING CARDS FOUND — CLEAR FILTERS OR SEARCH</div>';
    _ixLiveCells=[];
    return;
  }

  grid.innerHTML=list.map((c,idx)=>{
    const ow=ownMap[c.char_id];
    const mut=ixState.mut==="all"?ow.best:ixState.mut;
    const hasMut=!!(mut&&mut!=="none");
    const shActive=ixState.shiny||(ixState.mut==="all"&&ow.anyShiny);
    const ownedF=_ixCardOwnedInFilter(ow);
    const lockBoss=!!((c.raidBoss||c.towerBoss)&&!bossRollUnlocked(c.char_id));

    const chVal=effChance(c.char_id,ixState.mut==="all"?(hasMut?mut:"none"):ixState.mut,ixState.shiny);
    const chTxt="1/"+fmtChance(chVal);
    const chCol=hasMut?(MUT_COLOR[mut]||"rgba(245,245,245,.66)"):"rgba(245,245,245,.66)";

    const cls=["ix-tile"];
    if(!ownedF)cls.push("no-own");
    if(lockBoss)cls.push("boss-locked");
    if(ixState.selectedId===c.char_id)cls.push("sel");
    const tileCls=cls.join(" ")+(ownedF?hzBorderCls(hasMut?mut:"none",shActive,{tile:true,dense:true}):"");

    const tags=[];
    if(ownedF&&shActive)tags.push(shinyStampHtml(true));
    if(ownedF&&hasMut)tags.push(mutStampHtml(mut,true));
    if(c.raidBoss||c.towerBoss)tags.push('<span class="ix-badge boss">'+(lockBoss?"LOCKED":"BOSS")+'</span>');
    else if(c.weatherOnly){
      const w=(typeof WEATHER!=="undefined"&&WEATHER)?WEATHER[c.weatherOnly]:null;
      tags.push('<span class="ix-badge weather" style="--wc:'+(w?w.color:"#22d3ee")+'">'+_ixEsc(w?w.name:c.weatherOnly)+'</span>');
    }

    const bdrHtml=ownedF?hzBorderLayerHtml():"";
    const qMark=ownedF?"":'<span class="ix-tile-q" aria-hidden="true">?</span>';

    return '<button type="button" class="'+tileCls+'" data-card-idx="'+idx+'" data-cid="'+_ixEsc(c.char_id)+'">'
      +'<img src="'+_ixEsc(thumbSrc(c.sprite_asset))+'" alt="'+_ixEsc(c.name)+'" width="360" height="536" decoding="async">'
      +bdrHtml
      +qMark
      +'<span class="ix-tile-top">'
        +'<span class="ix-tile-tags">'+tags.join("")+'</span>'
        +'<span class="ix-tile-cnt'+(ow.variants?"":" zero")+'">'+(ow.variants?"×"+ow.variants:"0/10")+'</span>'
      +'</span>'
      +'<span class="ix-tile-foot">'
        +'<span class="ix-tile-nm">'+_ixEsc(c.name)+'</span>'
        +'<span class="ix-tile-ch'+(hasMut&&mut==="rainbow"&&ownedF?" rb":"")+'"'+(hasMut&&mut!=="rainbow"&&ownedF?' style="color:'+chCol+'"':"")+'>'+chTxt+'</span>'
      +'</span>'
    +'</button>';
  }).join("");

  grid.querySelectorAll("[data-card-idx]").forEach(btn=>{
    btn.onclick=()=>_ixOpenCardInfo(list,Number(btn.dataset.cardIdx));
  });
  ixLiveShimmer();
}

function _ixOpenById(cid){
  const validCards=_ixValidCards();
  const ownMap=_ixBuildOwnMap(validCards);
  let list=_ixFilterCards(validCards,ownMap);
  let idx=list.findIndex(c=>c.char_id===cid);
  if(idx<0){
    ixState.cat="all";ixState.mut="all";ixState.shiny=false;ixState.source="all";ixState.q="";
    if(_ixEl("searchInp"))_ixEl("searchInp").value="";
    ixRender();
    list=_ixFilterCards(validCards,ownMap);
    idx=list.findIndex(c=>c.char_id===cid);
  }
  if(idx>=0)_ixOpenCardInfo(list,idx);
}
function _ixApply3DTransform(){
  const card=_ixEl("ciCard3d");if(!card)return;
  const rx=ixState.dlgMovable?ixState.rotX:0,ry=ixState.dlgMovable?ixState.rotY:0;
  card.style.transform="scale("+ixState.zoom.toFixed(2)+") rotateX("+rx.toFixed(2)+"deg) rotateY("+ry.toFixed(2)+"deg)";
  const zr=_ixEl("ciZoomReset");if(zr)zr.textContent=Math.round(ixState.zoom*100)+"%";
}
function _ixReset3D(){ixState.rotX=0;ixState.rotY=0;ixState.zoom=1;_ixApply3DTransform();}
function _ixOpenCardInfo(list,idx){
  if(!list||!list.length)return;
  const c=list[idx];
  const validCards=_ixValidCards();
  const ownMap=_ixBuildOwnMap(validCards);
  const ow=ownMap[c.char_id];
  ixState.dlgKind="card";ixState.dlgList=list;ixState.dlgIdx=idx;ixState.selectedId=c.char_id;
  ixState.dlgBorder=(ixState.mut!=="all")?ixState.mut:(ow?ow.best:"none");
  ixState.dlgShiny=!!(ixState.shiny||(ixState.mut==="all"&&ow&&ow.anyShiny&&ow.shiny[ixState.dlgBorder]));
  ixState.dlgPeekArt=false;
  _ixReset3D();
  _ixRenderCardInfoDialog();
  const dlg=_ixEl("cardInfoDlg");
  if(dlg&&!dlg.open)dlg.showModal();
  const sc=_ixEl("ciInfoScroll");if(sc)sc.scrollTop=0;
}
function _ixOpenGearInfo(kind,list,idx){
  if(!list||!list.length)return;
  ixState.dlgKind=kind;ixState.dlgList=list;ixState.dlgIdx=idx;ixState.dlgPeekArt=true;
  _ixReset3D();
  _ixRenderCardInfoDialog();
  const dlg=_ixEl("cardInfoDlg");
  if(dlg&&!dlg.open)dlg.showModal();
  const sc=_ixEl("ciInfoScroll");if(sc)sc.scrollTop=0;
}
function _ixRenderCardInfoDialog(){
  const list=ixState.dlgList;if(!list||!list.length)return;
  const item=list[ixState.dlgIdx];
  _ixEl("ciHeadIdx").textContent=(ixState.dlgIdx+1)+" / "+list.length;
  const fBtn=_ixEl("ciFrameBtn");
  fBtn.textContent=ixState.dlgMovable?"FRAME: MOVABLE":"FRAME: LOCKED";
  fBtn.classList.toggle("locked",!ixState.dlgMovable);
  _ixEl("ci3dWrap").classList.toggle("locked",!ixState.dlgMovable);
  _ixApply3DTransform();

  const hideBtn=_ixEl("ciHideTextBtn");
  hideBtn.textContent=ixState.dlgHideText?"SHOW TEXT":"HIDE TEXT";
  hideBtn.classList.toggle("active",ixState.dlgHideText);

  const card3d=_ixEl("ciCard3d");
  if(ixState.dlgKind!=="card"){
    const isRelic=ixState.dlgKind==="relic";
    const ownSet=new Set(isRelic?((state&&state.artOwned)||[]):((state&&state.petOwned)||[]));
    const own=ownSet.has(item.id);
    const gName=_ixGearNameEn(ixState.dlgKind,item);
    const gSrc=_ixGearSourceLabel(item);
    card3d.className="cii-card3d gear"+hzBorderCls("gold",false)+(ixState.dlgHideText?" text-hidden":"")+(own?"":" is-missing peek");
    _ixEl("ciCardStamps").innerHTML="";
    _ixEl("ciArt").src=item.img;
    _ixEl("ciArt").alt=gName;
    _ixEl("ciOvPack").textContent=gSrc;
    _ixEl("ciOvType").textContent=isRelic?"RELIC":"COMPANION PET";
    _ixEl("ciOvName").textContent=gName;
    _ixEl("ciOvSkill").textContent="PASSIVE LUCK BONUS";
    _ixEl("ciOvDesc").textContent="Equip this permanent "+(isRelic?"Relic":"Pet")+" in your Backpack to boost all Gacha Rolls.";
    _ixEl("ciOvHp").textContent="FLAT: +"+item.flat;
    _ixEl("ciOvAtk").textContent="LUCK: +"+item.pct+"%";

    _ixEl("ciHeadLbl").textContent=isRelic?"RELIC INFO":"PET INFO";
    _ixEl("ciTitle").textContent=gName;
    _ixEl("ciChips").innerHTML=
      '<span class="cii-chip '+(own?"ok":"miss")+'">'+(own?"OWNED":"MISSING")+'</span>'
      +'<span class="cii-chip src">'+_ixEsc(gSrc)+'</span>'
      +'<span class="cii-chip tp">'+(isRelic?"RELIC SLOT":"PET SLOT")+'</span>';
    _ixEl("ciRarityK").textContent="ACQUISITION COST";
    _ixEl("ciBorderName").textContent=item.src==="raid"?"WB TOKENS":item.src==="premium"?"GEMS":item.src==="tower"?"TOWER DROP":"COINS";
    const costVal=item.raidCost||item.gemPrice||item.price||0;
    _ixEl("ciRarityV").textContent=costVal?fmt(costVal):"FLOOR DROP";
    _ixEl("ciStat1K").textContent="FLAT LUCK";
    _ixEl("ciStat1V").textContent="+"+item.flat;
    _ixEl("ciStat2K").textContent="LUCK BONUS";
    _ixEl("ciStat2V").textContent="+"+item.pct+"%";
    _ixEl("ciOwnK").textContent="INVENTORY STATUS";
    _ixEl("ciOwnBadge").textContent=own?"EQUIPPABLE":"LOCKED";
    _ixEl("ciOwnVal").textContent=own?"Unlocked permanently in Backpack":"Obtain from "+gSrc;
    _ixEl("ciSkillK").textContent="GEAR EFFECT";
    _ixEl("ciSkillN").textContent="+"+item.flat+" FLAT LUCK · +"+item.pct+"% LUCK";
    _ixEl("ciSkillD").textContent=isRelic
      ?"Equip up to 2 Relics simultaneously in your Backpack for stacking luck multipliers."
      :"Equip 1 Companion Pet alongside your Relics to amplify rare card drop odds.";
    _ixEl("ciBordersWrap").style.display="none";
    return;
  }

  _ixEl("ciBordersWrap").style.display="";
  _ixEl("ciHeadLbl").textContent="CARD INFO";
  const c=item;
  const validCards=_ixValidCards();
  const ow=_ixBuildOwnMap(validCards)[c.char_id]||{owned:false,variants:0,copies:0,anyShiny:false,best:"none",got:{},shiny:{}};
  const mut=ixState.dlgBorder||"none";
  const sh=!!ixState.dlgShiny;
  const st=cardStats(c.char_id,mut,"none",sh);
  const odds=effChance(c.char_id,mut,sh);
  const lockBoss=!!((c.raidBoss||c.towerBoss)&&!bossRollUnlocked(c.char_id));
  const desc=_ixCardDescEn(c);

  card3d.className="cii-card3d"+hzBorderCls(mut,sh)+(ow.owned?"":" is-missing")+(ixState.dlgPeekArt?" peek":"")+(ixState.dlgHideText?" text-hidden":"");
  _ixEl("ciCardStamps").innerHTML=[sh?shinyStampHtml(false):"",mut!=="none"?mutStampHtml(mut,false):""].join("");
  _ixEl("ciArt").src=c.art_image||c.sprite_asset;
  _ixEl("ciArt").alt=c.name;

  _ixEl("ciOvPack").textContent=_ixCardSourceLabel(c);
  _ixEl("ciOvType").textContent=(c.type||"UNIT").toUpperCase();
  _ixEl("ciOvName").textContent=c.name;
  _ixEl("ciOvSkill").textContent=(c.passive&&c.passive.name)||"—";
  _ixEl("ciOvDesc").textContent=desc;
  _ixEl("ciOvHp").textContent="HP: "+fmtStat(st.hp);
  _ixEl("ciOvAtk").textContent="DMG: "+fmtStat(st.atk);

  _ixEl("ciTitle").textContent=c.name;
  let chipsHtml=
    '<span class="cii-chip '+(ow.owned?"ok":"miss")+'">'+(ow.owned?"DISCOVERED":"UNDISCOVERED")+'</span>'
    +'<span class="cii-chip src">'+_ixEsc(_ixCardSourceLabel(c))+'</span>'
    +'<span class="cii-chip tp">'+_ixEsc((c.type||"UNIT").toUpperCase())+'</span>';
  if(lockBoss)chipsHtml+='<span class="cii-chip miss">SHOP LOCKED</span>';
  if(!ow.owned)chipsHtml+='<button type="button" class="cii-peek-btn" id="ciPeekBtn">'+(ixState.dlgPeekArt?"HIDE ART":"PEEK ART")+'</button>';
  _ixEl("ciChips").innerHTML=chipsHtml;
  if(_ixEl("ciPeekBtn")){
    _ixEl("ciPeekBtn").onclick=()=>{ixState.dlgPeekArt=!ixState.dlgPeekArt;_ixRenderCardInfoDialog();};
  }

  _ixEl("ciRarityK").textContent="RARITY";
  _ixEl("ciBorderName").innerHTML='<span class="cii-bdr-stamps">'+mutStampHtml(mut,false,"",true)+(sh?shinyStampHtml(false):"")+'</span>';
  _ixEl("ciRarityV").textContent="1 / "+fmt(Math.round(odds));

  _ixEl("ciStat1K").textContent="HEALTH";
  _ixEl("ciStat1V").textContent=fmt(st.hp);
  _ixEl("ciStat2K").textContent="DAMAGE";
  _ixEl("ciStat2V").textContent=fmt(st.atk);

  _ixEl("ciOwnK").textContent="ARCHIVE OWNERSHIP";
  _ixEl("ciOwnBadge").textContent=ow.variants+" / 10 VARIANTS";
  _ixEl("ciOwnVal").textContent=ow.owned
    ?("Owned ×"+fmt(ow.copies)+" total pulls · Best: "+(MUT_LABEL[ow.best]||"PURE")+(ow.anyShiny?" ★":""))
    :(lockBoss?("Buy in "+_ixCardSourceLabel(c)+" to unlock rolls"):("Not discovered yet — Drop source: "+_ixCardSourceLabel(c)));

  _ixEl("ciSkillK").textContent="SIGNATURE SKILL";
  _ixEl("ciSkillN").textContent=(c.passive&&c.passive.name)||"—";
  _ixEl("ciSkillD").textContent=desc;

  let bdrHtml=IX_MUTS.map(m=>{
    const isOn=(ixState.dlgBorder===m);
    const gotM=!!(ow.got[m]||ow.shiny[m]);
    const mOdds="1/"+fmtChance(effChance(c.char_id,m,sh));
    const col=MUT_COLOR[m]||"#9AA6B2";
    return '<button type="button" class="cii-bdr-btn'+(isOn?" on":"")+'" data-bdr="'+m+'" style="--bc:'+col+'">'
      +mutStampHtml(m,true,"",true)
      +'<span class="cii-bdr-meta">'
        +'<span class="cii-bdr-nm">'+(MUT_LABEL[m]||"PURE")+'</span>'
        +'<span class="cii-bdr-ch">'+mOdds+'</span>'
      +'</span>'
      +(gotM?'<span class="cii-bdr-own" title="Variant owned">✓</span>':'')
    +'</button>';
  }).join("");

  bdrHtml+='<button type="button" class="cii-bdr-btn'+(sh?" on":"")+'" id="ciShinyModBtn" style="--bc:#7DF9FF">'
    +shinyStampHtml(true)
    +'<span class="cii-bdr-meta">'
      +'<span class="cii-bdr-nm" style="color:#7DF9FF">SHINY</span>'
      +'<span class="cii-bdr-ch">'+(sh?"ACTIVE ×5 STATS":"×50 ODDS / ×5")+'</span>'
    +'</span>'
    +(ow.shiny[mut]?'<span class="cii-bdr-own" title="Shiny owned for this border">✓</span>':'')
  +'</button>';

  const bGrid=_ixEl("ciBdrGrid");
  bGrid.innerHTML=bdrHtml;
  bGrid.querySelectorAll("[data-bdr]").forEach(btn=>{
    btn.onclick=()=>{ixState.dlgBorder=btn.dataset.bdr;_ixRenderCardInfoDialog();};
  });
  _ixEl("ciShinyModBtn").onclick=()=>{ixState.dlgShiny=!ixState.dlgShiny;_ixRenderCardInfoDialog();};
}
function _ixBindEvents(){
  if(_ixBound)return;
  _ixBound=true;
  _ixInitVarTabStamps();

  document.querySelectorAll("#catTabs [data-cat]").forEach(b=>{
    b.onclick=()=>{ixState.cat=b.dataset.cat;ixRender();const gs=_ixEl("gridScroll");if(gs)gs.scrollTop=0;};
  });
  document.querySelectorAll("#varTabs [data-mut]").forEach(b=>{
    b.onclick=()=>{ixState.mut=b.dataset.mut;ixRender();};
  });
  const sh=_ixEl("shinyToggle");if(sh)sh.onclick=()=>{ixState.shiny=!ixState.shiny;ixRender();};
  const mm=_ixEl("mobMutSelect");if(mm)mm.onchange=e=>{
    if(e.target.value==="shiny"){ixState.mut="all";ixState.shiny=true;}
    else{ixState.mut=e.target.value;ixState.shiny=false;}
    ixRender();
  };
  const ms=_ixEl("mobSourceSelect");if(ms)ms.onchange=e=>{ixState.source=e.target.value;ixRender();};
  const ss=_ixEl("sortSelect");if(ss)ss.onchange=e=>{ixState.sort=e.target.value;ixRender();};

  let sTimer=null;
  const si=_ixEl("searchInp"),sc=_ixEl("searchClr");
  if(si)si.oninput=()=>{
    ixState.q=si.value;
    clearTimeout(sTimer);
    sTimer=setTimeout(ixRender,90);
  };
  if(sc)sc.onclick=()=>{ixState.q="";if(si){si.value="";si.focus();}ixRender();};

  const doClaim=async()=>{
    if(_ixClaimBusy||typeof claimIndexReward!=="function")return;
    _ixClaimBusy=true;
    ixRender();
    try{await claimIndexReward();}
    finally{_ixClaimBusy=false;ixRender();}
  };
  if(_ixEl("btnClaim"))_ixEl("btnClaim").onclick=doClaim;
  if(_ixEl("mobClaimBtn"))_ixEl("mobClaimBtn").onclick=doClaim;

  if(_ixEl("btnNextMissing"))_ixEl("btnNextMissing").onclick=()=>{
    if(ixState.cat==="relics"||ixState.cat==="pets")ixState.cat="all";
    const validCards=_ixValidCards();
    const ownMap=_ixBuildOwnMap(validCards);
    const list=_ixFilterCards(validCards,ownMap);
    const miss=list.filter(c=>!_ixCardOwnedInFilter(ownMap[c.char_id]));
    if(!miss.length){toast("ARCHIVE COMPLETE","Every card in current filter is already owned!","#6be08a");return;}
    const cur=miss.findIndex(c=>c.char_id===ixState.selectedId);
    const pick=miss[(cur+1)%miss.length];
    ixState.selectedId=pick.char_id;
    const escId=(typeof CSS!=="undefined"&&CSS.escape)?CSS.escape(pick.char_id):String(pick.char_id).replace(/["\\]/g,"");
    const btn=document.querySelector('#cardGrid [data-cid="'+escId+'"]');
    if(btn){
      btn.scrollIntoView({behavior:"smooth",block:"center"});
      btn.classList.remove("pulse");void btn.offsetWidth;btn.classList.add("pulse");
    }
    toast("NEXT MISSING",pick.name+" · 1/"+fmtChance(pick.chance||chanceOf(pick.tier)),"#22d3ee");
  };
  if(_ixEl("btnCardSize"))_ixEl("btnCardSize").onclick=()=>{
    ixState.size=IX_SIZE_ORDER[(IX_SIZE_ORDER.indexOf(ixState.size)+1)%IX_SIZE_ORDER.length];
    ixRender();
  };
  if(_ixEl("btnRandomCard"))_ixEl("btnRandomCard").onclick=()=>{
    if(ixState.cat==="relics"||ixState.cat==="pets"){
      const items=_ixFilterGear(ixState.cat);
      if(items.length)_ixOpenGearInfo(ixState.cat==="relics"?"relic":"pet",items,Math.floor(Math.random()*items.length));
      return;
    }
    const validCards=_ixValidCards();
    const list=_ixFilterCards(validCards,_ixBuildOwnMap(validCards));
    if(list.length)_ixOpenCardInfo(list,Math.floor(Math.random()*list.length));
  };

  const gDlg=_ixEl("guideDlg");
  if(_ixEl("btnGuide"))_ixEl("btnGuide").onclick=()=>{if(gDlg&&!gDlg.open)gDlg.showModal();};
  if(gDlg){
    gDlg.querySelectorAll("[data-guide-close]").forEach(b=>b.onclick=()=>gDlg.close());
    gDlg.addEventListener("click",e=>{if(e.target===gDlg)gDlg.close();});
  }

  const dlg=_ixEl("cardInfoDlg"),wrap=_ixEl("ci3dWrap");
  let _ixJustDragged=false;
  if(dlg){
    if(_ixEl("ciCloseBtn"))_ixEl("ciCloseBtn").onclick=()=>dlg.close();
    if(_ixEl("ciFrameBtn"))_ixEl("ciFrameBtn").onclick=()=>{ixState.dlgMovable=!ixState.dlgMovable;_ixRenderCardInfoDialog();};
    if(_ixEl("ciHideTextBtn"))_ixEl("ciHideTextBtn").onclick=()=>{ixState.dlgHideText=!ixState.dlgHideText;_ixRenderCardInfoDialog();};
    if(_ixEl("ciPrevBtn"))_ixEl("ciPrevBtn").onclick=()=>{
      if(!ixState.dlgList.length)return;
      ixState.dlgIdx=(ixState.dlgIdx-1+ixState.dlgList.length)%ixState.dlgList.length;
      if(ixState.dlgKind==="card")ixState.selectedId=ixState.dlgList[ixState.dlgIdx].char_id;
      _ixRenderCardInfoDialog();
    };
    if(_ixEl("ciNextBtn"))_ixEl("ciNextBtn").onclick=()=>{
      if(!ixState.dlgList.length)return;
      ixState.dlgIdx=(ixState.dlgIdx+1)%ixState.dlgList.length;
      if(ixState.dlgKind==="card")ixState.selectedId=ixState.dlgList[ixState.dlgIdx].char_id;
      _ixRenderCardInfoDialog();
    };
    if(_ixEl("ciZoomOut"))_ixEl("ciZoomOut").onclick=()=>{ixState.zoom=Math.max(0.75,ixState.zoom-0.12);_ixApply3DTransform();};
    if(_ixEl("ciZoomIn"))_ixEl("ciZoomIn").onclick=()=>{ixState.zoom=Math.min(1.55,ixState.zoom+0.12);_ixApply3DTransform();};
    if(_ixEl("ciZoomReset"))_ixEl("ciZoomReset").onclick=_ixReset3D;
    dlg.addEventListener("contextmenu",e=>{e.preventDefault();dlg.close();});
    dlg.addEventListener("click",e=>{if(!_ixJustDragged&&(e.target===dlg||e.target.id==="ciWrap"))dlg.close();});
  }
  if(wrap){
    wrap.addEventListener("pointerdown",e=>{
      if(e.button===2||!ixState.dlgMovable)return;
      ixState.dragging=true;_ixJustDragged=false;ixState.lx=e.clientX;ixState.ly=e.clientY;
      try{wrap.setPointerCapture(e.pointerId);}catch(_e){}
    });
    wrap.addEventListener("pointermove",e=>{
      if(!ixState.dragging||!ixState.dlgMovable)return;
      const dx=e.clientX-ixState.lx,dy=e.clientY-ixState.ly;
      if(Math.abs(dx)+Math.abs(dy)>2)_ixJustDragged=true;
      ixState.lx=e.clientX;ixState.ly=e.clientY;
      ixState.rotY=Math.max(-34,Math.min(34,ixState.rotY+dx*0.35));
      ixState.rotX=Math.max(-28,Math.min(28,ixState.rotX-dy*0.35));
      _ixApply3DTransform();
    });
    const endDrag=()=>{ixState.dragging=false;setTimeout(()=>{_ixJustDragged=false;},60);};
    wrap.addEventListener("pointerup",endDrag);
    wrap.addEventListener("pointercancel",endDrag);
    wrap.addEventListener("wheel",e=>{
      e.preventDefault();
      ixState.zoom=Math.max(0.75,Math.min(1.55,ixState.zoom+(e.deltaY<0?0.08:-0.08)));
      _ixApply3DTransform();
    },{passive:false});
  }
}

function openIndex(){
  idxRewardSync(true);
  _ixBindEvents();
  const gs=_ixEl("gridScroll");if(gs)gs.scrollTop=0;
  ixRender();
  _ixEl("indexModal").classList.add("show");
  document.body.classList.add("index-open");
  ixBannerOpen();
}
function closeIndex(){
  const cDlg=_ixEl("cardInfoDlg");if(cDlg&&cDlg.open)cDlg.close();
  const gDlg=_ixEl("guideDlg");if(gDlg&&gDlg.open)gDlg.close();
  const m=_ixEl("indexModal");
  if(!m||!m.classList.contains("show"))return;
  ixBannerClose(()=>{
    m.classList.remove("show");
    document.body.classList.remove("index-open");
  });
}
/* Keyboard: tutup dialog di Top Layer dulu sebelum layar index; shortcut grid [1-8/S/Z/M/R///Home]. */
document.addEventListener("keydown",e=>{
  const m=_ixEl("indexModal");
  if(!m||!m.classList.contains("show"))return;
  const cDlg=_ixEl("cardInfoDlg"),gDlg=_ixEl("guideDlg");
  if(e.key==="Escape"){
    e.stopPropagation();e.preventDefault();
    if(cDlg&&cDlg.open){cDlg.close();return;}
    if(gDlg&&gDlg.open){gDlg.close();return;}
    closeIndex();return;
  }
  if(cDlg&&cDlg.open){
    if(e.key==="ArrowLeft"){e.preventDefault();_ixEl("ciPrevBtn")&&_ixEl("ciPrevBtn").click();}
    else if(e.key==="ArrowRight"){e.preventDefault();_ixEl("ciNextBtn")&&_ixEl("ciNextBtn").click();}
    return;
  }
  if(gDlg&&gDlg.open)return;
  const tag=(document.activeElement&&document.activeElement.tagName)||"";
  if(tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA")return;
  if(e.key==="/"){e.preventDefault();const si=_ixEl("searchInp");if(si)si.focus();}
  else if(e.key>="1"&&e.key<="8"){
    const cat=IX_CAT_ORDER[Number(e.key)-1];
    if(cat){ixState.cat=cat;ixRender();const gs=_ixEl("gridScroll");if(gs)gs.scrollTop=0;}
  }else if(e.key.toLowerCase()==="s"){
    ixState.sort=IX_SORT_ORDER[(IX_SORT_ORDER.indexOf(ixState.sort)+1)%IX_SORT_ORDER.length];
    ixRender();
  }else if(e.key.toLowerCase()==="z"){
    _ixEl("btnCardSize")&&_ixEl("btnCardSize").click();
  }else if(e.key.toLowerCase()==="m"){
    _ixEl("btnNextMissing")&&_ixEl("btnNextMissing").click();
  }else if(e.key.toLowerCase()==="r"){
    _ixEl("btnRandomCard")&&_ixEl("btnRandomCard").click();
  }else if(e.key==="Home"){
    const gs=_ixEl("gridScroll");if(gs)gs.scrollTo({top:0,behavior:"smooth"});
  }
},true);
/* ===== banner hazard masuk/keluar (#indexCurtain, pola #traitCurtain) ===== */
let ixHzTimers=[];
function ixHzClear(){for(let i=0;i<ixHzTimers.length;i++)clearTimeout(ixHzTimers[i]);ixHzTimers=[];}
function ixHzSetCopy(mode){
  const kick=_ixEl("ixHzKick"),title=_ixEl("ixHzTitle"),
        sub=_ixEl("ixHzSub"),foot=_ixEl("ixHzFoot"),
        serial=_ixEl("ixHzSerial"),water=_ixEl("ixHzWater");
  if(serial)serial.textContent=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(mode==="open"){
    if(kick)kick.innerHTML="// ARCHIVE <b>SYNC</b>";
    if(title)title.textContent="CARD INDEX";
    if(water)water.textContent="IDX";
    if(sub)sub.textContent="75 UNITS · 750 MUTATION VARIANTS · 3D INSPECTOR";
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
  const c=_ixEl("indexCurtain");
  if(!c)return;
  ixHzClear();ixHzSetCopy("open");
  c.className="";void c.offsetWidth;
  c.classList.add("on","smooth","sweep");
  ixHzTimers.push(setTimeout(()=>c.classList.add("revealed"),1080));
  ixHzTimers.push(setTimeout(()=>c.classList.remove("on","smooth","sweep","revealed"),1800));
}
/* EXIT 3 fase: tirai MENUTUP -> konten disembunyikan -> tirai MEMBUKA. */
function ixBannerClose(onCovered){
  const c=_ixEl("indexCurtain");
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
window.ixRender=ixRender;
window.ixBannerOpen=ixBannerOpen;
window.ixBannerClose=ixBannerClose;


/* =============== TRAIT SYNTHESIS V2 (HAZARD NEURAL MATRIX) =============== */
let traitTarget=null;
let pendingRare=null;
let autoRoll=false,autoRollTimer=null,autoRollN=0;
let pendingRareAuto=false;
let autoTargets=new Set(["transiden","demigod","cosmic","bigbang"]);
const AUTO_TICK=95; // ms per auto-roll iteration

const TR2_SORTS=["rarest","az","traited","power"];
const TR2_SORT_LABELS={rarest:"RAREST",az:"A-Z",traited:"TRAITED",power:"POWER"};
const tr2State={
  tab:"reroll",
  filter:"all",
  sortIdx:0,
  search:"",
  sessionRolls:0,
  sessionSpent:0,
  lastRolls:[],
  discovered:new Set()
};

function _trCharOf(id){
  if(!id)return null;
  if(CARDS[id])return id;
  if(state&&Array.isArray(state.stacks)){
    const st=state.stacks.find(x=>x&&x.id===id);
    if(st&&CARDS[st.char])return st.char;
  }
  return null;
}
function trOwnedBaseEntries(){
  if(!state||!Array.isArray(state.stacks))return [];
  const map=new Map();
  for(const s of state.stacks){
    if(!s||!CARDS[s.char])continue;
    let ent=map.get(s.char);
    const ch=(typeof effChance==="function")?effChance(s.char,s.mut||"none",!!s.shiny):((CARDS[s.char]&&CARDS[s.char].chance)||100);
    if(!ent){
      ent={char:s.char,variants:[s],variantCount:1,repStack:s,repChance:ch,trait:charTraitOf(s.char),vault:trVaultOf(s.char)};
      map.set(s.char,ent);
    }else{
      ent.variants.push(s);
      ent.variantCount=ent.variants.length;
      if(ch>ent.repChance){ent.repStack=s;ent.repChance=ch;}
    }
  }
  return [...map.values()];
}
function traitTargetBase(){
  const list=trOwnedBaseEntries();
  if(!list.length){traitTarget=null;return null;}
  const cid=_trCharOf(traitTarget);
  let ent=cid?list.find(b=>b.char===cid):null;
  if(!ent){
    const eq=(typeof equipped==="function"?equipped():null);
    ent=(eq&&list.find(b=>b.char===eq.char))||list[0];
  }
  traitTarget=ent?ent.char:null;
  return ent||null;
}
function traitTargetStack(){
  const b=traitTargetBase();
  return b?b.repStack:null;
}
function trVaultOf(charOrStackId){
  const cid=_trCharOf(charOrStackId);
  if(!state||!state.traitVault||!cid)return null;
  const k=state.traitVault[cid];
  return (k&&k!=="none"&&TRAIT[k])?k:null;
}
function trSetVault(charOrStackId,k){
  const cid=_trCharOf(charOrStackId);
  if(!state||!cid)return;
  if(!state.traitVault||typeof state.traitVault!=="object"||Array.isArray(state.traitVault))state.traitVault={};
  if(!k||k==="none"||!TRAIT[k])delete state.traitVault[cid];
  else state.traitVault[cid]=k;
}
function trHitChance(){
  let sum=0;
  autoTargets.forEach(k=>{if(TRAIT[k]&&TRAIT[k].chance>0)sum+=TRAIT[k].chance;});
  return sum;
}
function trHitText(){
  const hc=trHitChance();
  return hc>=1?(hc.toFixed(2)+"%"):(hc.toFixed(3)+"%");
}
function trCardRarityOdds(bOrChar){
  const cid=typeof bOrChar==="string"?bOrChar:(bOrChar&&bOrChar.char);
  if(!cid)return 100;
  if(typeof effChance==="function")return effChance(cid,"none",false);
  const c=CARDS[cid];
  return (c&&c.chance)||100;
}
function trVariantListText(b){
  if(!b||!Array.isArray(b.variants))return "Normal";
  return b.variants.map(s=>{
    const p=[];
    if(s.shiny)p.push("Shiny");
    if(s.mut&&s.mut!=="none")p.push(String(s.mut).toUpperCase());
    return p.length?p.join(" "):"Normal";
  }).join(", ");
}
function trVariantLabel(b){
  if(!b)return "";
  const n=b.variantCount||1;
  return `BASE · ${n} VARIANT${n>1?"S":""}`;
}
function trSeedDiscovered(){
  if(state&&state.charTraits&&typeof state.charTraits==="object"){
    Object.values(state.charTraits).forEach(k=>{if(k&&k!=="none"&&TRAIT[k])tr2State.discovered.add(k);});
  }
  if(state&&state.traitVault&&typeof state.traitVault==="object"){
    Object.values(state.traitVault).forEach(k=>{if(k&&k!=="none"&&TRAIT[k])tr2State.discovered.add(k);});
  }
  if(!state||!Array.isArray(state.stacks))return;
  state.stacks.forEach(s=>{
    if(s&&s.trait&&s.trait!=="none"&&TRAIT[s.trait])tr2State.discovered.add(s.trait);
  });
}
function trGetVisibleUnits(){
  const entries=trOwnedBaseEntries();
  if(!entries.length)return [];
  const q=tr2State.search.trim().toLowerCase();
  const sortMode=TR2_SORTS[tr2State.sortIdx]||"rarest";
  const rank=k=>{
    if(!k||k==="none")return -1;
    return TRAIT_TIERS.findIndex(t=>t.k===k);
  };
  return entries.filter(b=>{
    if(!b||!CARDS[b.char])return false;
    const hasT=!!(b.trait&&b.trait!=="none"&&TRAIT[b.trait]);
    if(q){
      const nm=cardName(b.char).toLowerCase();
      const tnm=hasT?TRAIT[b.trait].name.toLowerCase():"";
      const vnm=b.vault?TRAIT[b.vault].name.toLowerCase():"";
      if(nm.indexOf(q)<0&&tnm.indexOf(q)<0&&vnm.indexOf(q)<0)return false;
    }
    if(tr2State.filter==="traited")return hasT;
    if(tr2State.filter==="empty")return !hasT;
    if(tr2State.filter==="jackpot")return hasT&&TRAIT[b.trait].atk>=1.5;
    return true;
  }).sort((a,b)=>{
    if(sortMode==="az")return cardName(a.char).localeCompare(cardName(b.char));
    if(sortMode==="traited")return rank(b.trait)-rank(a.trait)||trCardRarityOdds(b.char)-trCardRarityOdds(a.char);
    if(sortMode==="power"){
      const sa=cardStats(a.char,"none",a.trait,false),sb=cardStats(b.char,"none",b.trait,false);
      return (sb.hp+sb.atk)-(sa.hp+sa.atk);
    }
    return trCardRarityOdds(b.char)-trCardRarityOdds(a.char);
  });
}
function trShowToast(msg){
  const el=document.getElementById("tr2Toast");
  if(!el)return;
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(el._tm);
  el._tm=setTimeout(()=>el.classList.remove("show"),2400);
}
function trDialogOpen(){
  const g=document.getElementById("trGuideDlg");
  const r=document.getElementById("trRareDlg");
  return !!((g&&g.open)||(r&&r.open));
}
let trForceRender=false;
function openTrait(){
  autoStop();
  if(typeof syncBaseTraits==="function")syncBaseTraits();
  pendingRare=null;pendingRareAuto=false;
  trSeedDiscovered();
  traitTargetBase();
  trForceRender=true;
  renderTrait();
  trForceRender=false;
  const m=document.getElementById("traitModal");
  if(m){m.classList.add("show");}
  document.body.classList.add("trait-open");
  trBannerOpen();
}
function closeTrait(){
  autoStop();
  const g=document.getElementById("trGuideDlg");if(g&&g.open)g.close();
  const r=document.getElementById("trRareDlg");if(r&&r.open)r.close();
  const m=document.getElementById("traitModal");
  if(!m)return;
  trBannerClose(function(){
    m.classList.remove("show");
    document.body.classList.remove("trait-open");
  });
  hideTraitTip();
}

function trBuildShell(){
  const b=document.getElementById("trBody");
  if(!b)return;
  b.innerHTML=`<div class="tr2-stage" id="tr2Stage">
    <div class="tr2-shell">
      <header class="tr2-banner-bar">
        <div class="tr2-banner-ribbon">
          <div class="tr2-banner-cap">
            <div class="tr2-banner-cap-in">
              <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M24 2 30 18 46 24 30 30 24 46 18 30 2 24 18 18Z"/></svg>
              <span>MATRIX</span>
            </div>
          </div>
          <div class="tr2-banner-mid">
            <div class="tr2-banner-titles">
              <h1 class="tr2-title">TRAITS</h1>
              <span class="tr2-eyebrow">// BASE CARD SYNTHESIS · SHARED VARIANT MODIFIERS · ATTUNEMENT</span>
            </div>
            <div class="tr2-ribbon-slashes" aria-hidden="true"><i></i><i></i><i></i></div>
            <div class="tr2-banner-tags">
              <span class="tr2-banner-tag" id="tr2HdrTraited">TRAITED: 0/0</span>
              <span class="tr2-banner-tag hz">${fmt(TRAIT_COST)} CR / ROLL</span>
            </div>
          </div>
        </div>
        <div class="tr2-banner-right">
          <button type="button" class="tr2-hdr-btn info" id="tr2GuideBtn" aria-label="Trait synthesis guide" title="How Traits Work [?]"><span>!</span></button>
          <button type="button" class="tr2-hdr-btn exit-back" id="tr2ExitBtn" aria-label="Back to Lobby" title="Back to Lobby [ESC]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span>BACK</span>
          </button>
          <div class="tr2-slashes" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </header>
      <div class="tr2-panel">
        <div class="tr2-tape-line" aria-hidden="true"></div>
        <div class="tr2-toolbar" id="tr2Toolbar">
          <div class="tr2-tablist" role="tablist" aria-label="Trait workspace tabs">
            <button type="button" class="tr2-tab" id="tr2TabReroll" role="tab" aria-selected="true" tabindex="0" data-tab="reroll"><span>REROLL</span><span class="tb-k">[1]</span></button>
            <button type="button" class="tr2-tab" id="tr2TabIndex" role="tab" aria-selected="false" tabindex="-1" data-tab="index"><span>INDEX</span><span class="tb-k">[2]</span></button>
          </div>
          <div class="tr2-search-wrap">
            <svg class="tr2-search-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" class="tr2-search" id="tr2UnitSearch" placeholder="Search base cards... [F]" aria-label="Search base cards" autocomplete="off">
            <button type="button" class="tr2-search-clear" id="tr2SearchClear" aria-label="Clear search">&times;</button>
          </div>
          <div class="tr2-filters" role="group" aria-label="Unit trait filter">
            <button type="button" class="tr2-fchip" data-filter="all" aria-pressed="true">ALL</button>
            <button type="button" class="tr2-fchip" data-filter="traited" aria-pressed="false">TRAITED</button>
            <button type="button" class="tr2-fchip" data-filter="empty" aria-pressed="false">EMPTY</button>
            <button type="button" class="tr2-fchip jackpot" data-filter="jackpot" aria-pressed="false">JACKPOT</button>
          </div>
          <div class="tr2-cred-pill" title="Available Credits">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5"/></svg>
            <span>CREDITS</span><b id="tr2TopCredits">0</b>
          </div>
        </div>
        <section class="tr2-tabpanel" id="tr2PanelReroll" role="tabpanel" aria-labelledby="tr2TabReroll" tabindex="0">
          <div class="tr2-grid">
            <div class="tr2-left">
              <div class="tr2-spotlight" id="tr2Spotlight">
                <div class="tr2-unit-focus">
                  <div class="tr2-focus-art" id="tr2FocusArt"></div>
                  <div class="tr2-focus-meta">
                    <div class="tr2-focus-nm" id="tr2FocusName">—</div>
                    <div class="tr2-focus-rar" id="tr2FocusRarity">—</div>
                    <div class="tr2-focus-owned" id="tr2FocusOwned">—</div>
                  </div>
                </div>
                <div class="tr2-active-col" id="tr2ActiveCol">
                  <div class="tr2-sec-kicker">ACTIVE TRAIT</div>
                  <div class="tr2-medallion is-empty" id="tr2Medallion"><span class="tr2-medallion-q">?</span></div>
                  <div class="tr2-active-name-row">
                    <span class="tr2-active-name" id="tr2ActiveName">NO TRAIT</span>
                    <span class="tr2-active-rar empty" id="tr2ActiveRar">NONE</span>
                  </div>
                  <div class="tr2-active-mods" id="tr2ActiveMods"></div>
                  <div class="tr2-active-desc" id="tr2ActiveDesc">No trait bound to this base card yet. Roll to apply across all variants!</div>
                </div>
                <div class="tr2-swap-wrap">
                  <button type="button" class="tr2-swap-btn" id="tr2SwapBtn" aria-label="Swap active trait with The Vault" title="Swap active trait with Vault [X]">SWAP</button>
                  <span class="tr2-swap-key">[X]</span>
                </div>
                <div class="tr2-vault-box" id="tr2VaultBox">
                  <div class="tr2-sec-kicker">THE VAULT</div>
                  <div class="tr2-vault-ring" id="tr2VaultRing"><span class="q">?</span></div>
                  <div class="tr2-vault-name" id="tr2VaultName">Empty</div>
                  <div class="tr2-vault-sub" id="tr2VaultSub">Swap to park your active trait here.</div>
                  <div class="tr2-vault-warn">Stored traits don't work in battle.</div>
                </div>
              </div>
              <div class="tr2-roster-box">
                <div class="tr2-roster-head">
                  <div class="tr2-roster-title-wrap">
                    <span class="tr2-roster-title">BASE CARDS</span>
                    <span class="tr2-roster-count" id="tr2RosterCount">0 / 0 TRAITED</span>
                  </div>
                  <div class="tr2-roster-tools">
                    <button type="button" class="tr2-mini-btn" id="tr2NextEmptyBtn" title="Jump to next untraited base card [N]">NEXT EMPTY [N]</button>
                    <button type="button" class="tr2-mini-btn accent" id="tr2SortBtn" title="Cycle roster sort order">SORT: RAREST</button>
                  </div>
                </div>
                <div class="tr2-unit-scroll" id="tr2UnitScroll"><div class="tr2-unit-grid" id="tr2UnitGrid"></div></div>
              </div>
            </div>
            <aside class="tr2-right" aria-label="Attunement and rolling controls">
              <div class="tr2-attune-head">
                <div class="tr2-attune-titles">
                  <div class="tr2-attune-title"><i></i><span>ATTUNEMENT</span></div>
                  <div class="tr2-attune-summary" id="tr2AttuneSummary">—</div>
                </div>
                <div class="tr2-attune-btns">
                  <button type="button" class="tr2-at-action jack" id="tr2TickJackpots">TICK JACKPOTS</button>
                  <button type="button" class="tr2-at-action clr" id="tr2ClearTicks">CLEAR TICKS</button>
                </div>
              </div>
              <div class="tr2-attune-grid" id="tr2AttuneGrid" role="group" aria-label="Attunement target traits"></div>
              <div class="tr2-telemetry-row">
                <div class="tr2-tel-card" style="--tc:var(--warn)"><span class="tr2-tel-k">EXPECTED ROLLS</span><b class="tr2-tel-v" id="tr2TelExp">—</b><span class="tr2-tel-s" id="tr2TelExpSub">0 ticked</span></div>
                <div class="tr2-tel-card" style="--tc:var(--ok)" id="tr2TelOddsCard"><span class="tr2-tel-k">YOUR ODDS</span><b class="tr2-tel-v" id="tr2TelOdds">0.0%</b><span class="tr2-tel-s" id="tr2TelOddsSub">tick targets above</span></div>
                <div class="tr2-tel-card" style="--tc:var(--gold)"><span class="tr2-tel-k">CREDITS</span><b class="tr2-tel-v" id="tr2TelCredits">0</b><span class="tr2-tel-s" id="tr2TelRolls">0 rolls available</span></div>
              </div>
              <div class="tr2-history-box">
                <div class="tr2-hist-head"><b>LAST ROLLS</b><span id="tr2SessionStats">session: 0 rolls · 0 CR</span></div>
                <div class="tr2-roll-slots" id="tr2RollSlots"></div>
                <div class="tr2-hotkeys">[R] roll · [I] instant · [X] swap · [N] next empty · [↑/↓] units · [F] search · [1/2] tabs</div>
              </div>
              <div class="tr2-cta-deck">
                <div class="tr2-cta-bal" id="tr2CtaBal">YOU HAVE <b>0 CREDITS</b> (${fmt(TRAIT_COST)} CR / ROLL)</div>
                <div class="tr2-cta-btns">
                  <button type="button" class="tr2-cta-btn instant" id="trRoll"><span>INSTANT ROLL</span><span class="cost-tag">${fmt(TRAIT_COST)} CR</span></button>
                  <button type="button" class="tr2-cta-btn auto" id="trAuto"><span id="tr2AutoTxt">AUTO ROLL — COSTS ${fmt(TRAIT_COST)} CR</span><span class="cost-tag" id="tr2AutoTag">STOP AT TARGET</span></button>
                </div>
              </div>
            </aside>
          </div>
        </section>
        <section class="tr2-tabpanel" id="tr2PanelIndex" role="tabpanel" aria-labelledby="tr2TabIndex" hidden>
          <div class="tr2-index-view">
            <div class="tr2-idx-callout">
              <span><b>TRAIT CODEX // 8 MATRIX TIERS</b> — Live base-stat preview reflects selected card (<b id="tr2IdxPreviewUnit">—</b>). Total pool probability equals <b>100.000%</b>.</span>
              <span id="tr2IdxSessionCount">DISCOVERED: <b>0 / 8</b></span>
            </div>
            <div class="tr2-idx-scroll"><div class="tr2-idx-grid" id="tr2IndexGrid"></div></div>
          </div>
        </section>
      </div>
    </div>
    <div class="tr2-toast" id="tr2Toast" role="status" aria-live="polite"></div>
  </div>`;

  /* Bind static shell controls once */
  const stg=document.getElementById("tr2Stage");
  if(stg)stg.onclick=e=>{if(e.target===stg)closeTrait();};
  const ex=document.getElementById("tr2ExitBtn");if(ex)ex.onclick=closeTrait;
  const gb=document.getElementById("tr2GuideBtn");if(gb)gb.onclick=()=>{const d=document.getElementById("trGuideDlg");if(d)d.showModal();};
  const gc=document.getElementById("trGuideClose");if(gc)gc.onclick=()=>{const d=document.getElementById("trGuideDlg");if(d)d.close();};
  const rc=document.getElementById("trRareClose");if(rc)rc.onclick=()=>{const d=document.getElementById("trRareDlg");if(d)d.close();};
  if(!("closedBy" in HTMLDialogElement.prototype)){
    const outside=(e,dlg)=>{const r=dlg.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    ["trGuideDlg","trRareDlg"].forEach(id=>{
      const dlg=document.getElementById(id);if(!dlg||dlg._ldBound)return;dlg._ldBound=true;
      let downOut=false;
      dlg.addEventListener("pointerdown",e=>{downOut=outside(e,dlg);});
      dlg.addEventListener("pointerup",e=>{if(downOut&&outside(e,dlg))dlg.close();});
    });
  }
  const tR=document.getElementById("tr2TabReroll"),tI=document.getElementById("tr2TabIndex");
  if(tR)tR.onclick=()=>trSetTab("reroll");
  if(tI)tI.onclick=()=>trSetTab("index");
  [tR,tI].forEach((tab,idx,arr)=>{
    if(!tab)return;
    tab.onkeydown=e=>{
      if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
        e.preventDefault();
        const next=arr[(idx+(e.key==="ArrowRight"?1:-1)+arr.length)%arr.length];
        if(next){next.focus();trSetTab(next.getAttribute("data-tab"));}
      }
    };
  });
  const si=document.getElementById("tr2UnitSearch"),sc=document.getElementById("tr2SearchClear");
  if(si)si.oninput=()=>{
    tr2State.search=si.value;
    if(sc)sc.classList.toggle("show",!!tr2State.search);
    trPaintRoster();
  };
  if(sc)sc.onclick=()=>{
    tr2State.search="";if(si)si.value="";
    sc.classList.remove("show");
    trPaintRoster();
  };
  b.querySelectorAll(".tr2-fchip").forEach(btn=>{
    btn.onclick=()=>{
      tr2State.filter=btn.getAttribute("data-filter")||"all";
      b.querySelectorAll(".tr2-fchip").forEach(x=>x.setAttribute("aria-pressed",String(x===btn)));
      trPaintRoster();
    };
  });
  const sb=document.getElementById("tr2SortBtn");
  if(sb)sb.onclick=()=>{
    tr2State.sortIdx=(tr2State.sortIdx+1)%TR2_SORTS.length;
    sb.textContent="SORT: "+TR2_SORT_LABELS[TR2_SORTS[tr2State.sortIdx]];
    trPaintRoster();
  };
  const ne=document.getElementById("tr2NextEmptyBtn");if(ne)ne.onclick=trNextEmptyUnit;
  const sw=document.getElementById("tr2SwapBtn");if(sw)sw.onclick=trSwapVault;
  const tj=document.getElementById("tr2TickJackpots");
  if(tj)tj.onclick=()=>{["transiden","demigod","cosmic","bigbang"].forEach(k=>autoTargets.add(k));trPaintAttunement();trPaintButtons();if(tr2State.tab==="index")trPaintIndexTab();};
  const ct=document.getElementById("tr2ClearTicks");
  if(ct)ct.onclick=()=>{autoTargets.clear();trPaintAttunement();trPaintButtons();if(tr2State.tab==="index")trPaintIndexTab();};
  const rb=document.getElementById("trRoll");if(rb)rb.onclick=()=>rollTrait(false);
  const ab=document.getElementById("trAuto");if(ab)ab.onclick=toggleAuto;
}

function trSetTab(name){
  tr2State.tab=name==="index"?"index":"reroll";
  const isR=tr2State.tab==="reroll";
  const tb=document.getElementById("tr2Toolbar");if(tb)tb.classList.toggle("is-index",!isR);
  const tR=document.getElementById("tr2TabReroll"),tI=document.getElementById("tr2TabIndex");
  if(tR){tR.setAttribute("aria-selected",String(isR));tR.tabIndex=isR?0:-1;}
  if(tI){tI.setAttribute("aria-selected",String(!isR));tI.tabIndex=!isR?0:-1;}
  const pR=document.getElementById("tr2PanelReroll"),pI=document.getElementById("tr2PanelIndex");
  if(pR)pR.hidden=!isR;
  if(pI)pI.hidden=isR;
  if(!isR)trPaintIndexTab();
}
function trPaintCredits(){
  const coins=(state&&typeof state.coins==="number")?state.coins:0;
  const txt=fmt(coins);
  const e1=document.getElementById("tr2TopCredits"),e2=document.getElementById("tr2TelCredits"),
        e3=document.getElementById("tr2TelRolls"),e4=document.getElementById("tr2CtaBal"),
        cv=document.getElementById("coinVal");
  if(e1)e1.textContent=txt;
  if(e2)e2.textContent=txt;
  if(cv)cv.textContent=txt;
  const av=Math.floor(coins/TRAIT_COST);
  if(e3)e3.textContent=fmt(av)+(av===1?" roll available":" rolls available");
  if(e4)e4.innerHTML=`YOU HAVE <b>${txt} CREDITS</b> (${fmt(TRAIT_COST)} CR / ROLL)`;
  const bases=trOwnedBaseEntries();
  const trN=bases.filter(b=>b&&b.trait&&b.trait!=="none"&&TRAIT[b.trait]).length;
  const ht=document.getElementById("tr2HdrTraited"),rc=document.getElementById("tr2RosterCount");
  if(ht)ht.textContent=`TRAITED: ${trN}/${bases.length}`;
  if(rc)rc.textContent=`${trN} / ${bases.length} BASE TRAITED`;
}
function trPaintSpotlight(popAnim){
  const tgt=traitTargetBase();
  if(!tgt)return;
  const activeTrait=charTraitOf(tgt.char);
  const stats=cardStats(tgt.char,"none",activeTrait,false);
  const hasT=!!(activeTrait&&activeTrait!=="none"&&TRAIT[activeTrait]);
  const tt=hasT?TRAIT[activeTrait]:null;
  const vk=trVaultOf(tgt.char);
  const vt=vk?TRAIT[vk]:null;

  const art=document.getElementById("tr2FocusArt");
  if(art){
    art.className="tr2-focus-art";
    art.innerHTML=`<img src="${cardThumb(tgt.char)}" alt="${cardName(tgt.char)}"><div class="tr2-focus-stats-pill"><span class="hp">HP ${fmtStat(stats.hp)}</span><span class="atk">ATK ${fmtStat(stats.atk)}</span></div>`;
  }
  const fn=document.getElementById("tr2FocusName"),fr=document.getElementById("tr2FocusRarity"),fo=document.getElementById("tr2FocusOwned");
  if(fn)fn.textContent=cardName(tgt.char);
  if(fr)fr.textContent="1 IN "+fmtChance(trCardRarityOdds(tgt.char));
  if(fo){fo.textContent=trVariantLabel(tgt);fo.title="Applies to owned variants: "+trVariantListText(tgt);}
  const ip=document.getElementById("tr2IdxPreviewUnit");if(ip)ip.textContent=cardName(tgt.char);

  const col=tt?tt.color:"#9A8A8B";
  const ac=document.getElementById("tr2ActiveCol");if(ac)ac.style.setProperty("--tcol",col);
  const med=document.getElementById("tr2Medallion");
  if(med){
    med.classList.toggle("is-empty",!tt);
    med.innerHTML=tt?traitGem(42,tt.k):`<span class="tr2-medallion-q">?</span>`;
    if(popAnim){med.classList.remove("pop");void med.offsetWidth;med.classList.add("pop");}
  }
  const an=document.getElementById("tr2ActiveName"),ar=document.getElementById("tr2ActiveRar"),
        am=document.getElementById("tr2ActiveMods"),ad=document.getElementById("tr2ActiveDesc");
  if(an)an.textContent=tt?tt.name:"NO TRAIT";
  if(ar){ar.textContent=tt?tt.rar:"NONE";ar.classList.toggle("empty",!tt);}
  if(am){
    if(tt){
      am.innerHTML=`<span class="tr2-mod-chip">ATK <b>+${Math.round((tt.atk-1)*100)}%</b></span><span class="tr2-mod-chip">HP <b>+${Math.round((tt.hp-1)*100)}%</b></span>`;
    }else{
      am.innerHTML=`<span class="tr2-mod-chip">BASE STATS <b>1.00x</b></span>`;
    }
  }
  const vScope=tgt.variantCount>1?`all ${tgt.variantCount} variants`:"all variants";
  if(ad){
    ad.textContent=tt
      ? (isRareTrait(tt.k)?`Rare artefact-class modifier active on ${cardName(tgt.char)} & ${vScope}. Swap to Vault [X] before rolling to protect it.`:`Bound to ${cardName(tgt.char)} & ${vScope}. Rolling again overwrites unless parked in Vault.`)
      : `No trait bound to ${cardName(tgt.char)} yet. Roll to apply across ${vScope}!`;
  }

  const vb=document.getElementById("tr2VaultBox"),vr=document.getElementById("tr2VaultRing"),
        vn=document.getElementById("tr2VaultName"),vs=document.getElementById("tr2VaultSub");
  if(vb){
    vb.classList.toggle("has-trait",!!vt);
    vb.style.setProperty("--vcol",vt?vt.color:"rgba(245,245,245,.28)");
  }
  if(vr)vr.innerHTML=vt?traitGem(26,vt.k):`<span class="q">?</span>`;
  if(vn)vn.textContent=vt?vt.name:"Empty";
  if(vs)vs.textContent=vt?`ATK +${Math.round((vt.atk-1)*100)}% · HP +${Math.round((vt.hp-1)*100)}% (${vt.rar})`:"Swap to park your active trait here.";
}
function trPaintRoster(){
  const grid=document.getElementById("tr2UnitGrid");if(!grid)return;
  const scroller=document.getElementById("tr2UnitScroll");
  const prevTop=scroller?scroller.scrollTop:0;
  const tgt=traitTargetBase();const selChar=tgt?tgt.char:null;
  const list=trGetVisibleUnits();
  if(!list.length){
    grid.innerHTML=`<div class="tr2-unit-empty">NO MATCHING BASE CARDS — TRY CLEARING SEARCH OR FILTER</div>`;
    return;
  }
  grid.innerHTML=list.map(b=>{
    const tk=charTraitOf(b.char);
    const hasT=!!(tk&&tk!=="none"&&TRAIT[tk]);
    const tt=hasT?TRAIT[tk]:null;
    const tLine=tt?`${traitGem(13,tt.k)}<span>${tt.name}</span>`:`<span class="qdot">?</span><span>No trait</span>`;
    const vk=trVaultOf(b.char);
    const vSuffix=b.variantCount>1?` · ${b.variantCount} VAR`:"";
    return `<button type="button" class="tr2-unit-card${b.char===selChar?" sel":""}" data-uid="${b.char}" title="${cardName(b.char)} (${trVariantListText(b)})">
      <span class="tr2-uc-thumb"><img src="${cardThumb(b.char)}" alt=""></span>
      <span class="tr2-uc-body">
        <span class="tr2-uc-nm">${cardName(b.char)}</span>
        <span class="tr2-uc-meta">1 IN ${fmtChance(trCardRarityOdds(b.char))}${vSuffix}</span>
        <span class="tr2-uc-trait" style="--tcol:${tt?tt.color:"rgba(245,245,245,.42)"}">${tLine}</span>
      </span>
      ${vk?`<span class="tr2-uc-vault-pip" title="Vaulted: ${TRAIT[vk].name}">VAULT</span>`:""}
    </button>`;
  }).join("");
  grid.querySelectorAll(".tr2-unit-card").forEach(btn=>{
    btn.onclick=()=>{
      if(autoRoll)stopAutoRoll();
      const cid=btn.getAttribute("data-uid");
      if(typeof sfx!=="undefined"&&sfx.hit)sfx.hit();
      traitTarget=cid;
      trPaintSpotlight(true);
      trPaintRoster();
      trPaintAttunement();
      if(tr2State.tab==="index")trPaintIndexTab();
    };
  });
  if(scroller)scroller.scrollTop=prevTop;
}
function trPaintTelemetry(){
  const sumPct=trHitChance(),p=sumPct/100;
  const coins=(state&&typeof state.coins==="number")?state.coins:0;
  const av=Math.floor(coins/TRAIT_COST);
  const nT=autoTargets.size;
  const sumEl=document.getElementById("tr2AttuneSummary"),expEl=document.getElementById("tr2TelExp"),
        expSub=document.getElementById("tr2TelExpSub"),oddEl=document.getElementById("tr2TelOdds"),
        oddSub=document.getElementById("tr2TelOddsSub"),oddCard=document.getElementById("tr2TelOddsCard");
  if(nT===0||p<=0){
    if(sumEl)sumEl.innerHTML=`0 ticked · Tick any trait tiles below to compute expected rolls &amp; odds`;
    if(expEl)expEl.textContent="—";
    if(expSub)expSub.textContent="0 ticked";
    if(oddEl)oddEl.textContent="0.0%";
    if(oddSub)oddSub.textContent="tick targets above";
    if(oddCard)oddCard.style.setProperty("--tc","var(--dim2)");
  }else{
    const exp=Math.max(1,Math.round(1/p));
    const cost=exp*TRAIT_COST;
    const odds=(1-Math.pow(1-p,av))*100;
    const oStr=odds>=99.95?"99.9%+":(odds>=10?odds.toFixed(1)+"%":odds.toFixed(2)+"%");
    const oCol=odds>=50?"var(--ok)":(odds>=15?"var(--warn)":"var(--atk)");
    if(sumEl)sumEl.innerHTML=`<b>${nT} ticked</b> · <b>~${fmt(exp)} rolls</b> expected (${fmtStat(cost)} CR) · <span class="em">${oStr} chance</span> with your credits`;
    if(expEl)expEl.textContent="~"+fmt(exp);
    if(expSub)expSub.textContent=`${fmtStat(cost)} CR · ${nT} ticked`;
    if(oddEl)oddEl.textContent=oStr;
    if(oddSub)oddSub.textContent=`in ${fmt(av)} available rolls`;
    if(oddCard)oddCard.style.setProperty("--tc",oCol);
  }
}
function trPaintAttunement(){
  const grid=document.getElementById("tr2AttuneGrid");if(!grid)return;
  const tgt=traitTargetBase();
  const cur=tgt&&tgt.trait&&tgt.trait!=="none"?tgt.trait:null;
  grid.innerHTML=TRAIT_TIERS.filter(t=>t.chance>0).map(t=>{
    const on=autoTargets.has(t.k);
    const isCur=cur===t.k;
    return `<button type="button" class="tr2-at-tile" data-tk="${t.k}" aria-pressed="${on}" style="--tcol:${t.color}">
      <span class="tr2-at-rar">${t.rar}</span>
      <span class="tr2-at-chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
      ${isCur?`<span class="tr2-at-cur">ACTIVE</span>`:""}
      <span class="tr2-at-emblem">${traitGem(20,t.k)}</span>
      <span class="tr2-at-nm">${t.name}</span>
      <span class="tr2-at-pct">${t.chance}%</span>
    </button>`;
  }).join("");
  grid.querySelectorAll(".tr2-at-tile").forEach(btn=>{
    btn.onclick=()=>{
      const k=btn.getAttribute("data-tk");
      if(autoTargets.has(k))autoTargets.delete(k);else autoTargets.add(k);
      trPaintAttunement();
      trPaintButtons();
      if(tr2State.tab==="index")trPaintIndexTab();
    };
  });
  trPaintTelemetry();
}
function trPaintHistory(){
  const ss=document.getElementById("tr2SessionStats"),rs=document.getElementById("tr2RollSlots");
  if(ss)ss.textContent=`session: ${fmt(tr2State.sessionRolls)} rolls · ${fmt(tr2State.sessionSpent)} CR`;
  if(!rs)return;
  const slots=[];
  for(let i=0;i<10;i++){
    const k=tr2State.lastRolls[i];
    if(k&&TRAIT[k]){
      const t=TRAIT[k];
      slots.push(`<div class="tr2-roll-node hit${i===0?" newest":""}" style="--tcol:${t.color}" title="${t.name} (${t.rar}) · ATK +${Math.round((t.atk-1)*100)}%">${traitGem(17,t.k)}</div>`);
    }else{
      slots.push(`<div class="tr2-roll-node" title="Empty roll slot">?</div>`);
    }
  }
  rs.innerHTML=slots.join("");
}
function trPaintButtons(){
  const coins=(state&&typeof state.coins==="number")?state.coins:0;
  const canAfford=coins>=TRAIT_COST;
  const rBtn=document.getElementById("trRoll"),aBtn=document.getElementById("trAuto"),
        aTxt=document.getElementById("tr2AutoTxt"),aTag=document.getElementById("tr2AutoTag");
  if(rBtn)rBtn.disabled=autoRoll||!canAfford;
  if(aBtn){aBtn.disabled=!autoRoll&&!canAfford;aBtn.classList.toggle("running",autoRoll);}
  if(aTxt)aTxt.textContent=autoRoll?`ABORT AUTO (${fmt(autoRollN)} ROLLED)`:`AUTO ROLL — COSTS ${fmt(TRAIT_COST)} CR`;
  if(aTag)aTag.textContent=autoRoll?"CLICK TO STOP":(autoTargets.size?`${autoTargets.size} ARMED`:"TICK TARGETS");
}
function trPaintIndexTab(){
  const tgt=traitTargetBase();if(!tgt)return;
  const host=document.getElementById("tr2IndexGrid"),sc=document.getElementById("tr2IdxSessionCount");
  const rollables=TRAIT_TIERS.filter(t=>t.chance>0);
  if(sc)sc.innerHTML=`DISCOVERED: <b>${tr2State.discovered.size} / ${rollables.length}</b>`;
  if(!host)return;
  const bases=trOwnedBaseEntries();
  host.innerHTML=rollables.map(t=>{
    const aPct=Math.round((t.atk-1)*100),hPct=Math.round((t.hp-1)*100);
    const pv=cardStats(tgt.char,"none",t.k,false);
    const odds=t.chance>=5?`${t.chance}% weight`:`1 in ${fmt(Math.round(100/t.chance))}`;
    const holders=bases.filter(b=>b.trait===t.k).map(b=>cardName(b.char));
    const armed=autoTargets.has(t.k);
    return `<div class="tr2-idx-card" style="--tcol:${t.color}">
      <div class="tr2-idx-top">
        <div class="tr2-idx-emblem">${traitGem(26,t.k)}</div>
        <div class="tr2-idx-titles"><div class="tr2-idx-nm">${t.name}</div><div class="tr2-idx-odds">${t.chance}% · ${odds}</div></div>
        <span class="tr2-idx-rar">${t.rar}</span>
      </div>
      <div class="tr2-idx-stats"><span>ATK <b>+${aPct}%</b></span><span>HP <b>+${hPct}%</b></span></div>
      <div class="tr2-idx-preview">On <b>${cardName(tgt.char)}</b> (base):<br>ATK <b>${fmtStat(pv.atk)}</b> · HP <b>${fmtStat(pv.hp)}</b></div>
      <div class="tr2-idx-holders">${holders.length?`Equipped on: ${holders.slice(0,2).join(", ")}${holders.length>2?` +${holders.length-2}`:""}`:"Not currently equipped"}</div>
      <button type="button" class="tr2-idx-btn${armed?" armed":""}" data-tk="${t.k}">${armed?"✓ ARMED IN ATTUNEMENT":"+ ARM AUTO TARGET"}</button>
    </div>`;
  }).join("");
  host.querySelectorAll(".tr2-idx-btn").forEach(btn=>{
    btn.onclick=()=>{
      const k=btn.getAttribute("data-tk");
      if(autoTargets.has(k))autoTargets.delete(k);else autoTargets.add(k);
      trPaintIndexTab();
      trPaintAttunement();
      trPaintButtons();
    };
  });
}
function trPaintAll(popAnim){
  trPaintCredits();
  trPaintSpotlight(popAnim);
  trPaintRoster();
  trPaintAttunement();
  trPaintHistory();
  trPaintButtons();
  if(tr2State.tab==="index")trPaintIndexTab();
}
function trSwapVault(){
  if(autoRoll)stopAutoRoll();
  const tgt=traitTargetBase();if(!tgt)return;
  const curKey=charTraitOf(tgt.char);
  const cur=(curKey&&curKey!=="none"&&TRAIT[curKey])?curKey:null;
  const vk=trVaultOf(tgt.char);
  if(!cur&&!vk){trShowToast("Both Active Trait and The Vault are empty.");return;}
  const nextActive=vk||"none";
  setCharTrait(tgt.char,nextActive);
  trSetVault(tgt.char,cur);
  if(typeof sfx!=="undefined"&&sfx.hit)sfx.hit();
  save();
  if(!battleLive()&&typeof render==="function")render();
  trPaintAll(true);
  trShowToast(nextActive!=="none"?`Swapped! ${TRAIT[nextActive].name} active on ${cardName(tgt.char)} & variants.`:`Parked ${TRAIT[cur].name} for ${cardName(tgt.char)} in The Vault.`);
}
function trNextEmptyUnit(){
  const bases=trOwnedBaseEntries();
  if(!bases.length)return;
  const tgt=traitTargetBase();
  const idx=tgt?bases.findIndex(b=>b.char===tgt.char):-1;
  for(let i=1;i<=bases.length;i++){
    const cand=bases[(idx+i)%bases.length];
    if(cand&&(!cand.trait||cand.trait==="none")){
      traitTarget=cand.char;
      trPaintAll(true);
      return;
    }
  }
  trShowToast("All base cards already have traits!");
}

function renderTrait(popAnim){
  const b=document.getElementById("trBody");
  if(!b)return;
  const _m=document.getElementById("traitModal");
  if(_m&&!_m.classList.contains("show")&&!trForceRender)return;
  trSeedDiscovered();
  if(!b.querySelector(".tr2-shell"))trBuildShell();
  if(!state||!Array.isArray(state.stacks)||!state.stacks.length){
    const p=b.querySelector(".tr2-panel");
    if(p){
      p.innerHTML=`<div class="tr2-empty-wrap"><h3>NO UNITS IN MATRIX</h3><p>Roll at least one card from the Summon terminal before synthesizing traits.</p><button type="button" class="tr2-mini-btn accent" id="trEmptyClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>BACK TO LOBBY</span></button></div>`;
      const ec=document.getElementById("trEmptyClose");if(ec)ec.onclick=closeTrait;
    }
    return;
  }
  trSetTab(tr2State.tab);
  trPaintAll(!!popAnim);
}

/* Keyboard shortcuts scoped to #traitModal */
document.addEventListener("keydown",e=>{
  const m=document.getElementById("traitModal");
  if(!m||!m.classList.contains("show"))return;
  if(trDialogOpen())return;
  const tag=((document.activeElement&&document.activeElement.tagName)||"").toUpperCase();
  if(tag==="INPUT"||tag==="TEXTAREA"){
    if(e.key==="Escape"){document.activeElement.blur();}
    return;
  }
  const k=e.key.toLowerCase();
  if(k==="r"||k==="i"){e.preventDefault();rollTrait(false);}
  else if(k==="x"){e.preventDefault();trSwapVault();}
  else if(k==="n"){e.preventDefault();trNextEmptyUnit();}
  else if(k==="f"){e.preventDefault();const si=document.getElementById("tr2UnitSearch");if(si)si.focus();}
  else if(k==="1"){trSetTab("reroll");}
  else if(k==="2"){trSetTab("index");}
  else if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    e.preventDefault();
    const list=trGetVisibleUnits();if(!list.length)return;
    const cur=traitTargetBase();
    const idx=cur?list.findIndex(b=>b.char===cur.char):0;
    const next=list[(idx+(e.key==="ArrowDown"?1:-1)+list.length)%list.length];
    if(next){traitTarget=next.char;trPaintAll(true);}
  }else if(e.key==="Escape"){
    e.preventDefault();closeTrait();
  }
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
    if(sub)sub.textContent="NEURAL MATRIX · ATTUNEMENT · VAULT";
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
  const _tb=traitTargetBase();
  const selId=cardPickCfg?cardPickCfg.getSel():(_tb&&_tb.repStack?_tb.repStack.id:null);
  _dpHtml={};
  b.innerHTML=`<label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="dpSearch" type="text" placeholder="Search card..." autocomplete="off"></label><div class="dp-grid" id="dpGrid">${state.stacks.map((s,i)=>{
    const m=(s.mut&&s.mut!=="none")?s.mut:"";
    const hasT=s.trait&&s.trait!=="none";
    const shBadge=s.shiny?(typeof shinyStampHtml==="function"?shinyStampHtml(true):'<span class="shiny-badge shiny-pill">SHINY</span>'):"";
    const mBadge=m?mutChip(m,typeof mutStampHtml==="function"?mutStampHtml(m,true):mutPill(m,'mut-badge dp-mut')):"";
    const tBadge=hasT?traitChip(s.trait,typeof traitStampHtml==="function"?traitStampHtml(s.trait,true):`<span class="trait-badge dp-gem" style="border-color:${TRAIT_COLOR[s.trait]}">${traitGem(13,s.trait)}</span>`):"";
    const hzCls=(typeof hzBorderCls==="function")?hzBorderCls(m||"none",!!s.shiny,{tile:true,dense:true}):"";
    const hzLayers=(typeof hzBorderLayerHtml==="function")?hzBorderLayerHtml():"";
    const inner=`${hzLayers}<img src="${cardThumb(s.char)}" alt="" width="96" height="96" decoding="async">
      ${(shBadge||mBadge||tBadge)?`<span class="dp-badges">${shBadge}${mBadge}${tBadge}</span>`:""}
      <span class="dp-name">${cardName(s.char)}</span>`;
    _dpHtml[s.id]=inner;const mounted=true;
    return `<button class="dp-card${isFullArt(s.char)?" fa":""}${s.id===selId?" sel":""}${m?(s.shiny?" dp-mut-shiny-"+m:" dp-mut-"+m):""}${s.shiny?" shiny":""}${hzCls}${mounted?"":" lz-ph"}" data-lz="${s.id}" data-tid="${s.id}" data-name="${cardName(s.char).toLowerCase()}">${mounted?inner:""}</button>`;}).join("")}</div><div class="no-result" id="dpSearch-nr">No matching cards.</div>`;
  {const dps=document.getElementById("dpSearch");if(dps){dps.value=dpSearch;dps.oninput=()=>{dpSearch=dps.value;runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));};if(dpSearch)runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));}}
  b.querySelectorAll(".dp-card").forEach(el=>el.onclick=()=>{const tid=el.getAttribute("data-tid");sfx.hit();if(cardPickCfg){cardPickCfg.onPick(tid);}else{const st=state.stacks.find(x=>x&&x.id===tid);traitTarget=st?st.char:tid;closeDeckPick();renderTrait();}});
  lazyMountGrid(b,_dpHtml);
}
/* Trait transiden ke atas = langka; jangan ditimpa tanpa konfirmasi */
const RARE_TRAIT_GUARD=["transiden","demigod","cosmic","bigbang"];
let traitRareBusy=false;
function isRareTrait(k){return RARE_TRAIT_GUARD.indexOf(k)>=0;}
function confirmRareReplace(k,auto){
  const t=TRAIT[k];if(!t)return Promise.resolve(true);
  if(traitRareBusy)return Promise.resolve(false);
  const dlg=document.getElementById("trRareDlg"),body=document.getElementById("trRareDlgBody"),ttl=document.getElementById("trRareTitle");
  const tgt=traitTargetBase();
  if(!dlg||!body||!tgt)return Promise.resolve(true);
  traitRareBusy=true;
  const vaultEmpty=!trVaultOf(tgt.char);
  const vScope=tgt.variantCount>1?` &amp; all ${tgt.variantCount} variants`:"";
  if(ttl)ttl.textContent="RARE TRAIT PROTECTION";
  body.innerHTML=`
    <div class="tr2-rare-hero" style="--tcol:${t.color}">
      ${traitGem(48,t.k)}
      <div class="tr2-rare-hero-nm">${t.name} (${t.rar})</div>
      <div class="tr2-rare-hero-sub">Currently bound to <b>${cardName(tgt.char)}</b>${vScope} · ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</div>
    </div>
    <div class="tr2-dlg-box">
      <b>Warning:</b> ${auto
        ? `Auto roll will start replacing <b class="hz">${t.name}</b>. Only traits ticked in Attunement stop Auto Roll.`
        : `Rolling now will <b class="hz">overwrite ${t.name}</b> across ${cardName(tgt.char)}${tgt.variantCount>1?` and all ${tgt.variantCount} variants`:""}. You can park it safely in <b>THE VAULT [X]</b> first so you do not lose it.`}
      Credits left: <b>${fmt(state.coins)} CR</b>.
    </div>
    <div class="tr2-dlg-actions">
      <button type="button" class="tr2-dlg-btn primary" id="trRareKeep" autofocus>KEEP CURRENT</button>
      ${vaultEmpty?`<button type="button" class="tr2-dlg-btn" id="trRarePark">PARK IN VAULT</button>`:""}
      <button type="button" class="tr2-dlg-btn danger" id="trRareGo">${auto?"CONTINUE AUTO":"OVERWRITE &amp; ROLL"}</button>
    </div>`;
  return new Promise(resolve=>{
    let settled=false;
    const finish=val=>{if(settled)return;settled=true;traitRareBusy=false;if(dlg.open)dlg.close();resolve(val);};
    dlg.addEventListener("close",()=>{if(!settled){settled=true;traitRareBusy=false;resolve(false);}},{once:true});
    dlg.showModal();
    const keep=document.getElementById("trRareKeep");if(keep)keep.onclick=()=>finish(false);
    const park=document.getElementById("trRarePark");
    if(park)park.onclick=()=>{finish(false);trSwapVault();};
    const go=document.getElementById("trRareGo");if(go)go.onclick=()=>finish(true);
  });
}
async function rollTrait(skipGuard){
  if(autoRoll)return;
  if(state.coins<TRAIT_COST){trShowToast(`Need ${fmt(TRAIT_COST)} Credits to roll!`);return;}
  const tgt=traitTargetBase();if(!tgt)return;
  const curTrait=charTraitOf(tgt.char);
  if(!skipGuard&&isRareTrait(curTrait)){
    if(!(await confirmRareReplace(curTrait,false)))return;
    if(autoRoll||state.coins<TRAIT_COST)return;
  }
  coinSpend(TRAIT_COST);
  tr2State.sessionRolls++;
  tr2State.sessionSpent+=TRAIT_COST;
  const k=rollTraitPick();
  setCharTrait(tgt.char,k);
  tr2State.discovered.add(k);
  tr2State.lastRolls.unshift(k);
  if(tr2State.lastRolls.length>10)tr2State.lastRolls.length=10;
  if(typeof sfx!=="undefined"&&sfx.crit)sfx.crit();
  save();
  renderShell();
  if(!battleLive()&&typeof render==="function")render();
  trPaintAll(true);
  if(TRAIT[k]&&TRAIT[k].atk>=1.5){
    if(isRareTrait(k))showRarePrompt(k,false);
    else trShowToast(`NICE ROLL! ${cardName(tgt.char)} & variants unlocked ${TRAIT[k].name} (${TRAIT[k].rar})!`);
  }
}
function showRarePrompt(k,auto){
  const t=TRAIT[k];if(!t)return;
  pendingRare=k;
  pendingRareAuto=!!auto;
  const dlg=document.getElementById("trRareDlg"),body=document.getElementById("trRareDlgBody"),ttl=document.getElementById("trRareTitle");
  if(!dlg||!body)return;
  const tgt=traitTargetBase();
  const canRoll=state.coins>=TRAIT_COST;
  const vaultEmpty=tgt&&!trVaultOf(tgt.char);
  if(ttl)ttl.textContent=auto?"RARE TRAIT · AUTO STOPPED":"JACKPOT TRAIT UNLOCKED";
  body.innerHTML=`
    <div class="tr2-rare-hero" style="--tcol:${t.color}">
      ${traitGem(58,k)}
      <div class="tr2-rare-hero-nm">${t.name} (${t.rar})</div>
      <div class="tr2-rare-hero-sub">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}% · ${traitFxList(k)}</div>
    </div>
    <div class="tr2-dlg-box">
      <b>${t.name}</b> is now bound to <b>${tgt?cardName(tgt.char):"this base card"}</b>${tgt&&tgt.variantCount>1?` and all ${tgt.variantCount} owned variants`:""}. You can keep it active, park it in <b>THE VAULT</b>, or discard &amp; roll again.
    </div>
    <div class="tr2-dlg-actions">
      <button type="button" class="tr2-dlg-btn primary" id="rpSave" autofocus>${auto?"STOP · KEEP THIS":"KEEP THIS TRAIT"}</button>
      ${vaultEmpty?`<button type="button" class="tr2-dlg-btn" id="rpPark">PARK IN VAULT</button>`:""}
      <button type="button" class="tr2-dlg-btn danger" id="rpRoll" ${canRoll?"":"disabled"}>ROLL AGAIN · ${fmt(TRAIT_COST)} CR</button>
    </div>`;
  dlg.showModal();
  const sv=document.getElementById("rpSave");if(sv)sv.onclick=saveRare;
  const pk=document.getElementById("rpPark");
  if(pk)pk.onclick=()=>{pendingRare=null;pendingRareAuto=false;closeRarePrompt();trSwapVault();};
  const rr=document.getElementById("rpRoll");if(rr)rr.onclick=auto?resumeAutoRoll:rerollRare;
}
function closeRarePrompt(){
  const dlg=document.getElementById("trRareDlg");if(dlg&&dlg.open)dlg.close();
  const old=document.getElementById("rarePromptModal");if(old)old.classList.remove("show");
}
function saveRare(){
  const k=pendingRare;autoStop();pendingRareAuto=false;
  const tgt=traitTargetBase();if(tgt&&k)setCharTrait(tgt.char,k);
  pendingRare=null;closeRarePrompt();save();
  if(!battleLive()&&typeof render==="function")render();
  renderTrait();
  if(k&&TRAIT[k])trShowToast(`LOCKED! ${TRAIT[k].name} (${TRAIT[k].rar}) bound to ${tgt?cardName(tgt.char):"base card"} & all variants.`);
}
function rerollRare(){pendingRare=null;pendingRareAuto=false;closeRarePrompt();rollTrait(true);}
/* ===== AUTO ROLL (loop 95ms) ===== */
function targetLabel(){return autoTargets.size?[...autoTargets].map(k=>TRAIT[k]?TRAIT[k].name:"").filter(Boolean).join(" · "):"tick traits in ATTUNEMENT";}
function autoStop(){autoRoll=false;clearTimeout(autoRollTimer);autoRollTimer=null;}
function toggleAuto(){autoRoll?stopAutoRoll():startAutoRoll();}
async function startAutoRoll(){
  if(autoRoll)return;
  if(state.coins<TRAIT_COST){trShowToast(`Need ${fmt(TRAIT_COST)} Credits for Auto Roll!`);return;}
  if(!autoTargets.size){trShowToast("Tick at least one trait in ATTUNEMENT first!");return;}
  const tgt=traitTargetBase();
  const curTrait=tgt?charTraitOf(tgt.char):"none";
  if(tgt&&isRareTrait(curTrait)&&!autoTargets.has(curTrait)){
    if(!(await confirmRareReplace(curTrait,true)))return;
    if(autoRoll||state.coins<TRAIT_COST)return;
  }
  autoRoll=true;autoRollN=0;trPaintButtons();autoTick();
}
function stopAutoRoll(){
  autoStop();
  save();
  renderShell();
  if(!battleLive()&&typeof render==="function")render();
  trPaintAll(false);
}
function autoTick(){
  if(!autoRoll)return;
  if(state.coins<TRAIT_COST){stopAutoRoll();trShowToast("AUTO ROLL STOPPED · OUT OF CREDITS");return;}
  const tgt=traitTargetBase();if(!tgt){stopAutoRoll();return;}
  coinSpend(TRAIT_COST);autoRollN++;
  tr2State.sessionRolls++;
  tr2State.sessionSpent+=TRAIT_COST;
  const k=rollTraitPick();
  setCharTrait(tgt.char,k);
  tr2State.discovered.add(k);
  tr2State.lastRolls.unshift(k);
  if(tr2State.lastRolls.length>10)tr2State.lastRolls.length=10;
  if(autoRollN%10===0&&typeof sfx!=="undefined"&&sfx.crit)sfx.crit();
  if(autoTargets.has(k)){
    autoStop();save();renderShell();
    if(!battleLive()&&typeof render==="function")render();
    trPaintAll(true);
    if(typeof sfx!=="undefined"&&sfx.crit)sfx.crit();
    trShowToast(`TARGET HIT! ${cardName(tgt.char)} & variants gained ${TRAIT[k].name} (${TRAIT[k].rar})!`);
    return;
  }
  if(autoRollN%10===0)save();
  trPaintCredits();
  trPaintSpotlight(true);
  trPaintHistory();
  trPaintButtons();
  if(autoRollN%5===0){trPaintRoster();trPaintAttunement();}
  autoRollTimer=setTimeout(autoTick,AUTO_TICK);
}
function resumeAutoRoll(){pendingRare=null;pendingRareAuto=false;closeRarePrompt();if(!autoRoll){renderTrait();return;}autoRollTimer=setTimeout(autoTick,AUTO_TICK);}
function autoToast(msg){trShowToast(msg);}
function traitNotify(k){const t=TRAIT[k];if(t)trShowToast(`${t.name} (${t.rar}) applied!`);}
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

