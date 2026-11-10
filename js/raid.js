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

function wbClearHz(){for(let i=0;i<wbHzTimers.length;i++)clearTimeout(wbHzTimers[i]);wbHzTimers=[];}
function stopRaid(){
  clearTimeout(wbAutoTimer);wbAutoTimer=null;
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
    window.location.hash="#/lobby";
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
    window.location.hash="#/lobby";
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

