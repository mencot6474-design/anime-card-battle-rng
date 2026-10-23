/* =============== STATE =============== */
let KEY="aab-state-v2";
const USERS_KEY="aab-users", SESSION_KEY="aab-session";
function hashPass(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h)^s.charCodeAt(i);return (h>>>0).toString(36);}
function coinIcon(sz, extraCls){
  const s = sz || 16;
  return `<svg class="gold-coin-ic${extraCls?' '+extraCls:''}" width="${s}" height="${s}" viewBox="0 0 24 24" style="vertical-align:middle;flex:none"><use href="#coinSvgSymbol"/></svg>`;
}
window.coinIcon = coinIcon;
function getUsers(){try{return JSON.parse(localStorage.getItem(USERS_KEY))||{};}catch(e){return {};}}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u));}
function freshState(){
  const s0=STORY_BIBLE.units[0];
  const start=s0?{id:Math.random().toString(36).slice(2,9),char:s0.id,tier:s0.tier,fav:false,lock:false,mut:"none",shiny:false,trait:"none",count:1}:null;
  const newState={coins:1000,raidTokens:0,playerLv:1,xp:0,dailyIndex:0,lastClaim:"",summons:0,totalRolls:0,playSec:0,muted:false,diff:"normal",chap:1,raidDiff:"normal",raidCleared:{normal:false,hard:false,extreme:false,nightmare:false},raidShopOwned:{},tower:{best:0,auto:false},battleSpeed:1,
    cleared:{},clearedDiff:{normal:{},hard:{},extreme:{},nightmare:{}},equippedId:start?start.id:null,equippedId2:null,deck:[start?start.id:null,null,null,null],stacks:start?[start]:[],history:[],battle:null,
    player:{luckBase:1,luckFlat:0,luckPercent:0,exp:0,lv:1,sp:0,tree:{}},weather:null,weatherBest:null,potions:0,mythicPotions:0,luckPots:[0,0,0],speedPots:[0,0,0],luckBuffs:[],speedBuffs:[],infTokens:0,
    artOwned:[],artSlots:[null,null],petOwned:[],petEquipped:null,intanRolls:0,idxRewardsClaimed:0,premiumGems:50,rollPacks:{r5k:0,r10k:0,r25k:0,r50k:0,r100k:0}};
  console.log('[FRESH STATE] Initialized player:',newState.player);
  return newState;
}
function todayStr(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function nextResetMs(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,0,0,0,0)-n;}
function fmtCountdown(ms){const s=Math.max(0,Math.floor(ms/1000));const p=x=>String(x).padStart(2,"0");const h=Math.floor(s/3600);const m=Math.floor(s%3600/60);const sec=s%60;if(h>0)return p(h)+":"+p(m)+":"+p(sec);return p(m)+":"+p(sec);}
let state=null, currentUser=null;
function loadStateFor(name){
  KEY="aab-state-v2:"+name;
  try{state=JSON.parse(localStorage.getItem(KEY))||freshState();}catch(e){console.warn('Load error, using fresh:', e.message);state=freshState();}
  
  // MIGRATE OLD STATE: pastikan player object + format luck baru (base+flat+percent)
  if(!state.player){
    console.log('[MIGRATE] Old state detected, creating player object');
    state.player={luckBase:1,luckFlat:0,luckPercent:0,exp:state.playerExp||0,lv:state.playerLv||1,sp:0,tree:{}};
  } else if(typeof state.player.luckBase!=="number"){
    // Format lama: {luck:N} -> migrasi ke luckBase, hapus field lama
    const legacyLuck=typeof state.player.luck==="number"?state.player.luck:1;
    state.player.luckBase=legacyLuck;
    state.player.luckFlat=state.player.luckFlat||0;
    state.player.luckPercent=state.player.luckPercent||0;
    delete state.player.luck;
    console.log('[MIGRATE] Legacy luck',legacyLuck,'-> luckBase');
  }
  // MIGRATE: skill tree (SP + node yang dibeli)
  if(typeof state.player.sp!=="number")state.player.sp=0;
  if(!state.player.tree||typeof state.player.tree!=="object")state.player.tree={};
  /* BATTLE SPEED: migrasi save lama + clamp ke unlock level (LV10→2x, LV25→3x, LV50→4x) */
  if(typeof state.battleSpeed!=="number"||state.battleSpeed<1||state.battleSpeed>4||Math.floor(state.battleSpeed)!==state.battleSpeed)state.battleSpeed=1;
  {const _lv=state.playerLv||1,_max=_lv>=50?4:_lv>=25?3:_lv>=10?2:1;if(state.battleSpeed>_max)state.battleSpeed=_max;}
  /* MIGRATE: flag kepemilikan kartu BOSS (TOKO RAID) — unlock roll permanen */
  if(!state.raidShopOwned||typeof state.raidShopOwned!=="object")state.raidShopOwned={};
  console.log('[LOAD STATE] Initial player state:',state.player);
  
  if(!state.stacks||!state.stacks.length){const st=freshState();state.stacks=st.stacks;state.equippedId=st.equippedId;}
  
  state.stacks=state.stacks.filter(s=>CARDS[s.char]);
  
  {const seen={};state.stacks.forEach(s=>{const k=s.char+"|"+(s.mut||"none")+"|"+(s.shiny?1:0);if(!seen[k]){seen[k]=s;s.count=s.count||1;}else{seen[k].count=(seen[k].count||1)+(s.count||1);if((s.trait&&s.trait!=="none")&&(!seen[k].trait||seen[k].trait==="none"))seen[k].trait=s.trait;}});state.stacks=Object.values(seen);}
  
  if(!state.stacks.length){const st=freshState();state.stacks=st.stacks;}
  
  if(!state.stacks.some(s=>s.id===state.equippedId))state.equippedId=state.stacks.length?state.stacks[0].id:null;
  if(!state.stacks.some(s=>s.id===state.equippedId2))state.equippedId2=null;
  /* DECK 4 SLOT: satu-satunya sumber kartu yang dipakai battle. Deck menyimpan stack-id.
     equippedId / equippedId2 diturunkan dari slot 0 & 1 supaya kontrol lobby lama tetap jalan. */
  if(!Array.isArray(state.deck))state.deck=[null,null,null,null];
  state.deck.length=4;
  state.deck=state.deck.map(id=>(id&&state.stacks.some(s=>s.id===id))?id:null);
  if(!state.deck[0])state.deck[0]=state.equippedId||(state.stacks.length?state.stacks[0].id:null);
  if(!state.deck[1]&&state.equippedId2&&state.deck[0]!==state.equippedId2)state.deck[1]=state.equippedId2;
  state.equippedId=state.deck[0];
  state.equippedId2=state.deck[1];
  if(state.cleared)Object.keys(state.cleared).forEach(k=>{if(+k>LEVEL_COUNT)delete state.cleared[k];});
  
  // Safely call diffProg and helpers
  try {
    const dp = diffProg();
    Object.keys(state.clearedDiff).forEach(dk=>Object.keys(state.clearedDiff[dk]).forEach(k=>{if(+k>LEVEL_COUNT)delete state.clearedDiff[dk][k];}));
    if(!Object.keys(state.clearedDiff.normal).length&&Object.keys(state.cleared).length)state.clearedDiff.normal=Object.assign({},state.cleared);
  } catch(e) { console.warn('diffProg error:', e.message); }
  
  // Use safe chap init
  if(!CHAPTERS || !CHAPTERS.length) { 
    console.error('CHAPTERS not found!'); 
    return; 
  }
  if(!CHAPTERS.some(c=>c.no===state.chap))state.chap=1;
  if(typeof state.dailyIndex!=="number")state.dailyIndex=0;
  if(typeof state.raidTokens!=="number")state.raidTokens=0;
  /* INDEX REWARD: patch save lama */
  if(typeof state.intanRolls!=="number"||state.intanRolls<0)state.intanRolls=0;
  if(typeof state.premiumGems!=="number"||state.premiumGems<0)state.premiumGems=50;
  if(!state.rollPacks||typeof state.rollPacks!=="object")state.rollPacks={r5k:0,r10k:0,r25k:0,r50k:0,r100k:0};
  ['r5k','r10k','r25k','r50k','r100k'].forEach(k=>{if(typeof state.rollPacks[k]!=="number"||state.rollPacks[k]<0)state.rollPacks[k]=0;});
  if(typeof state.idxRewardsClaimed!=="number"||state.idxRewardsClaimed<0)state.idxRewardsClaimed=0;
  /* STAT PROFIL: total roll gabungan (dice + instan pack) & waktu bermain.
     Save lama tanpa counter: isi dari jumlah kartu yang sudah dimiliki. */
  if(typeof state.totalRolls!=="number"||state.totalRolls<0){
    state.totalRolls=(state.stacks||[]).reduce((sum,x)=>sum+(x.count||1),0);
  }
  if(typeof state.playSec!=="number"||state.playSec<0)state.playSec=0;
  
  // Safely handle DIFFS and RAID_DIFFS
  if(DIFFS && DIFFS.length && !DIFFS.some(d=>d.k===state.diff))state.diff="normal";
  if(RAID_DIFFS && RAID_DIFFS.length) {
    if(!state.raidCleared||typeof state.raidCleared!=="object")state.raidCleared={normal:false,hard:false,extreme:false,nightmare:false};
    RAID_DIFFS.forEach(d=>{if(typeof state.raidCleared[d.k]!=="boolean")state.raidCleared[d.k]=false;});
    
    // Safe difficulty check - only if all dependencies are ready
    try {
      if(cellUnlocked && activeChap) {
        if(!cellUnlocked(activeChap(),state.diff))state.diff=highestChapDiff(activeChap().no);
      }
    } catch(e) { console.warn('Difficulty check failed:', e.message); }
  }
  
  if(state.stacks)state.stacks.forEach(s=>{if(!s.mut)s.mut="none";if(s.mut==="silver"){s.shiny=true;s.mut="none";}if(typeof s.shiny!=="boolean")s.shiny=false;if(!s.trait||!TRAIT[s.trait])s.trait="none";s.tier=CARDS[s.char].tier;});
  if(!state.tower||typeof state.tower!=="object")state.tower={best:0};
  if(typeof state.tower.best!=="number"||state.tower.best<0)state.tower.best=0;
  /* WEATHER + POTION: migrasi field baru + expire otomatis kalau window real-time udah lewat. */
  if(typeof state.potions!=="number"||state.potions<0)state.potions=0;
  if(typeof state.mythicPotions!=="number"||state.mythicPotions<0)state.mythicPotions=0;
  /* MIGRASI LUCK/SPEED POTION lama (counter tunggal) -> array per level [L1,L2,L3]. */
  if(!Array.isArray(state.luckPots)){state.luckPots=[typeof state.luckPotions==="number"&&state.luckPotions>0?Math.floor(state.luckPotions):0,0,0];delete state.luckPotions;}
  if(!Array.isArray(state.speedPots)){state.speedPots=[typeof state.speedPotions==="number"&&state.speedPotions>0?Math.floor(state.speedPotions):0,0,0];delete state.speedPotions;}
  state.luckPots=state.luckPots.map(v=>typeof v==="number"&&v>0?Math.floor(v):0);
  state.speedPots=state.speedPots.map(v=>typeof v==="number"&&v>0?Math.floor(v):0);
  /* Pity potion: counter roll RARE/AWAKENED (bareng weather + mythic potion). */
  if(!state.wpity||typeof state.wpity.r!=="number"||typeof state.wpity.m!=="number")state.wpity={r:0,m:0};
  if(typeof state.infTokens!=="number"||state.infTokens<0)state.infTokens=0;
  /* ARTEFAK + PET: field baru — player lama mulai kosong, id korup dibuang. */
  if(!Array.isArray(state.artOwned))state.artOwned=[];
  state.artOwned=state.artOwned.filter(id=>ART_DEFS.some(a=>a.id===id));
  if(!Array.isArray(state.artSlots)||state.artSlots.length!==2)state.artSlots=[null,null];
  state.artSlots=state.artSlots.map(id=>(id&&state.artOwned.includes(id))?id:null);
  if(!Array.isArray(state.petOwned))state.petOwned=[];
  state.petOwned=state.petOwned.filter(id=>PET_DEFS.some(p=>p.id===id));
  if(!state.petEquipped||!state.petOwned.includes(state.petEquipped))state.petEquipped=null;
  /* Buff potion -> format PER-LEVEL array. Save lama (objek gabung luckBuff/speedBuff) dimigrasi
     jadi 1 entry lv:0 (efek & sisa durasinya dipertahankan apa adanya, chip generik tanpa "Lx"). */
  if(!Array.isArray(state.luckBuffs)){
    state.luckBuffs=[];
    const ob=state.luckBuff;
    if(ob&&typeof ob.endsAt==="number"&&Date.now()<ob.endsAt)state.luckBuffs.push({lv:0,flat:ob.flat||0,pct:ob.pct||0,endsAt:ob.endsAt});
    delete state.luckBuff;
  }
  if(!Array.isArray(state.speedBuffs)){
    state.speedBuffs=[];
    const ob=state.speedBuff;
    if(ob&&typeof ob.endsAt==="number"&&Date.now()<ob.endsAt)state.speedBuffs.push({lv:0,add:ob.add!=null?ob.add:(ob.mult||0),endsAt:ob.endsAt});
    delete state.speedBuff;
  }
  state.luckBuffs=state.luckBuffs.filter(b=>b&&typeof b.endsAt==="number"&&b.endsAt>Date.now());
  state.speedBuffs=state.speedBuffs.filter(b=>b&&typeof b.endsAt==="number"&&b.endsAt>Date.now());
  if(state.weatherBest&&!WEATHER[state.weatherBest])state.weatherBest=null;
  if(state.weather){if(!WEATHER[state.weather.id]||typeof state.weather.endsAt!=="number")state.weather=null;}
  if(state.weather&&Date.now()>=state.weather.endsAt)state.weather=null;
  state.battle=null;
}

/* ========== DIFFICULTY PROGRESS HELPERS ========== */
const diffOf=()=>DIFFS.find(d=>d.k===(state?state.diff:"normal"))||DIFFS[0];
/* diffProg() = PETA LENGKAP {normal:{lv:true},hard:{...},...}. Caller akses diffProg()[mode]. */
function diffProg(){if(!state.clearedDiff)state.clearedDiff={normal:{},hard:{},extreme:{},nightmare:{}};DIFFS.forEach(d=>{if(!state.clearedDiff[d.k])state.clearedDiff[d.k]={};});return state.clearedDiff;}
function chapProgMode(ch,mode){const cd=diffProg()[mode]||{};let n=0;for(let i=0;i<ch.levels.length;i++)if(cd[ch.from+i])n++;return n;}
function chapClearedMode(ch,mode){const cd=diffProg()[mode]||{};for(let i=0;i<ch.levels.length;i++)if(!cd[ch.from+i])return false;return true;}
/* Tamat di mode aktif — dipakai chapOpen/activeChap (panggil 1 arg). */
const chapDone=(c)=>chapClearedMode(c,state?state.diff:"normal");
/* GEMBOK BERTANGGA PER-BAB: sel (bab C, mode M) terbuka jika bab C-1 mode M tamat; Bab 1 mode M butuh mode sebelumnya di Bab 1 tamat. */
function cellUnlocked(ch,mode){const ci=DIFFS.findIndex(d=>d.k===mode),idx=ch.no-1;if(idx<0)return false;if(idx===0)return ci<=0||chapClearedMode(ch,DIFFS[ci-1].k);return chapClearedMode(CHAPTERS[idx-1],mode);}
function highestChapDiff(ch){if(typeof ch==="number")ch=CHAPTERS.find(c=>c.no===ch)||CHAPTERS[0];let k="normal";DIFFS.forEach(d=>{if(cellUnlocked(ch,d.k))k=d.k;});return k;}
function cellReqText(ch,mode){const ci=DIFFS.findIndex(d=>d.k===mode),idx=ch.no-1;if(idx<0)return"";if(idx===0)return"SELESAIKAN SEMUA LEVEL BAB 1 DI MODE "+DIFFS[ci-1].l+" UNTUK BUKA MODE INI";return"SELESAIKAN SEMUA LEVEL BAB "+(ch.no-1)+" DI MODE "+DIFFS[ci].l+" UNTUK BUKA BAB INI DI MODE "+DIFFS[ci].l;}
function mutBox(mut,cls){return mutPill(mut,cls);}
const mutGlow=m=>m&&m!=="none"?` mut-${m}`:"";
const mutEdge=m=>m&&m!=="none"?` style="border-color:${MUT_COLOR[m]}"`:"";
function enemyOf(level){const f=FOES[level];if(!f)return{id:null,name:"Gate Watcher L-"+level,epithet:chapOf(level).zone,img:chapOf(level).art,boss:false,tier:"R"};return{id:f.id,name:f.name,epithet:f.ep,img:f.img,boss:!!f.boss,tier:f.tier};}
function enemyStats(level){const l=STORY_BIBLE.levels[level-1];if(!l)return{hp:120,atk:40};const c=CARDS[l.unit];if(!c)return{hp:120,atk:40};const k=MUT_MULT[diffOf().mut]||1;return{hp:Math.round(c.base_hp*(0.55+0.15*level)*k),atk:Math.round(c.base_atk*(0.35+0.13*level)*k)};}
function firstClearReward(level){const l=STORY_BIBLE.levels[level-1];return (l?l.reward:300)*(diffOf().rw||1);}
let _cloudSaveTimer=null;
function save(){
  if(state){
    localStorage.setItem(KEY,JSON.stringify(state));
    if(currentUser && window.CloudDB){
      if(_cloudSaveTimer)clearTimeout(_cloudSaveTimer);
      _cloudSaveTimer=setTimeout(()=>{
        window.CloudDB.saveState(currentUser, state).catch(()=>{});
      }, 400);
    }
  }
}
function equipped(){return state.stacks.find(s=>s.id===(state.deck&&state.deck[0]))||state.stacks.find(s=>s.id===state.equippedId)||state.stacks[0];}
function equipped2(){return (state.deck&&state.deck[1])?state.stacks.find(s=>s.id===state.deck[1])||null:null;}
/* Daftar kartu dek (slot 0..3) dalam urutan — sumber fighter battle (maks 4). */
function equippedList(){return (state.deck||[]).map(id=>id?state.stacks.find(s=>s.id===id):null).filter(Boolean);}
/* Pasang/lepas stack-id ke slot dek; jaga equippedId/2 tetap sinkron dgn slot 0/1. */
function setDeckSlot(i,id){
  if(i<0||i>3)return;
  if(id){
    // satu kartu tak boleh menempati dua slot
    const prev=state.deck.indexOf(id);if(prev>=0&&prev!==i)state.deck[prev]=null;
  }
  state.deck[i]=id||null;
  state.equippedId=state.deck[0]||null;
  state.equippedId2=state.deck[1]||null;
  save();
}

/* =============== AUDIO =============== */
let actx=null;
function beep(freq,dur,type,gain){
  if(state.muted)return;
  try{
  actx=actx||new (window.AudioContext||window.webkitAudioContext)();
  const o=actx.createOscillator(),g=actx.createGain();
  o.type=type||"square";o.frequency.value=freq;
  g.gain.setValueAtTime(gain||.05,actx.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+(dur||.08));
  o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+(dur||.08));
  }catch(e){}
}
const sfx={
  hit:()=>{if(window.CyberSfx)window.CyberSfx.katanaSlash(1);else beep(180,.07);},
  crit:()=>{if(window.CyberSfx)window.CyberSfx.katanaFinisher();else beep(560,.12,"sawtooth",.06);},
  dodge:()=>{if(window.CyberSfx)window.CyberSfx.matrixSpace();else beep(760,.06,"sine");},
  win:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.14,"triangle",.06),i*110));},
  lose:()=>{[330,262,196].forEach((f,i)=>setTimeout(()=>beep(f,.18,"sine",.06),i*140));},
  pull:()=>beep(880,.2,"sine",.05)
};

/* Unlock audio: WebView Android/iOS menahan AudioContext yang dibuat tanpa gesture user
   (mis. SFX ronde raid yang dipicu setTimeout) dalam state "suspended" → suara hening.
   Listener dipasang permanen agar konteks ikut resume setelah app balik dari background. */
function unlockGameAudio(){
  try{
    if(!actx&&(window.AudioContext||window.webkitAudioContext))actx=new (window.AudioContext||window.webkitAudioContext)();
    if(actx&&actx.state==="suspended")actx.resume().catch(()=>{});
    (window.__aabAudioUnlockers||[]).forEach(fn=>{try{fn();}catch(e){}});
  }catch(e){}
}
["pointerdown","touchstart","keydown"].forEach(ev=>window.addEventListener(ev,unlockGameAudio,{passive:true}));

/* ---------- ANNOUNCER "FIGHT!" ---------- */
function actxOf(){actx=actx||new (window.AudioContext||window.webkitAudioContext)();return actx;}
function noiseBurst(t,dur,freq,gain){
  const a=actxOf(),n=Math.max(1,Math.floor(a.sampleRate*dur));
  const buf=a.createBuffer(1,n,a.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  const s=a.createBufferSource();s.buffer=buf;
  const bp=a.createBiquadFilter();bp.type="bandpass";bp.frequency.value=freq;bp.Q.value=1.1;
  const g=a.createGain();g.gain.value=gain;
  s.connect(bp);bp.connect(g);g.connect(a.destination);s.start(t);
}
function impactBoom(){
  if(state.muted)return;
  if(window.CyberSfx){window.CyberSfx.cutInActivate();return;}
  try{
    const a=actxOf(),t0=a.currentTime+.4;
    const s=a.createOscillator();s.type="sine";
    s.frequency.setValueAtTime(130,t0);s.frequency.exponentialRampToValueAtTime(36,t0+.5);
    const g=a.createGain();
    g.gain.setValueAtTime(.0001,t0);
    g.gain.exponentialRampToValueAtTime(.34,t0+.04);
    g.gain.exponentialRampToValueAtTime(.0001,t0+.55);
    s.connect(g);g.connect(a.destination);s.start(t0);s.stop(t0+.6);
  }catch(e){}
}
/* Dentuman crit: dialihkan ke CyberSfx supaya tidak menumpuk dengan SFX lama */
function critBoom(){
  if(state.muted)return;
}
const fightAudio=null;
const swordAudio=new Audio("assets/audio/swing-draw.mp3");
const winAudio=new Audio("assets/audio/win-jingle.mp3");
winAudio.preload="auto";
const dodgeAudio=new Audio("assets/audio/slash-oga.ogg");
const purpleAudio=new Audio("assets/audio/fire-spell.ogg");
const domainAudio=new Audio("assets/audio/ice-cast.wav");
const punchAudio=new Audio("assets/audio/hit-heavy.ogg");
const SFXP={};
function sfxPlay(name){
  if(state.muted||!window.CyberSfx)return;
  if(name==="fire")window.CyberSfx.plasmaBurn();
  else if(name==="iceCast"||name==="iceHit")window.CyberSfx.cryoFreeze();
  else if(name==="stun")window.CyberSfx.systemLock();
  else if(name==="dodge")window.CyberSfx.matrixSpace();
  else if(name==="crit")window.CyberSfx.katanaFinisher();
  else window.CyberSfx.katanaSlash(1);
}
function playClip(a){
  if(state.muted)return;
  if(a===winAudio){try{const c=a.cloneNode(true);c.play().catch(()=>{});}catch(e){}return;}
  if(!window.CyberSfx)return;
  if(a===dodgeAudio)window.CyberSfx.matrixSpace();
  else if(a===purpleAudio)window.CyberSfx.plasmaBurn();
  else if(a===domainAudio)window.CyberSfx.cryoFreeze();
  else window.CyberSfx.katanaSlash(1);
}
function playClipDur(a,durMs,fadeMs){
  if(state.muted)return;
  if(window.CyberSfx)window.CyberSfx.cutInActivate();
}
function fanfare(){playClip(winAudio);}
function playDodge(){if(window.CyberSfx)window.CyberSfx.matrixSpace();}
function swing(){/* dinonaktifkan agar murni memakai CyberSfx.katanaSlash saat hit */}
function fightShout(){
  impactBoom();
}
/* ---------- suara serangan Gojo: Hollow Purple (charge → boom tebal + crackle) ---------- */
/* =============== SHELL RENDER =============== */
const app=document.getElementById("app");
const ROUTES={"#/lobby":"LOBBY","#/":"STORY","#/raid":"BOSS RAID","#/tower":"INFINITE TOWER","#/settings":"PENGATURAN"};
function route(){const h=location.hash;return ROUTES[h]?h:"#/lobby";}
/* TRUE selama battle apa pun hidup — story (state.battle), raid, atau tower (bt).
   Dipakai guard polling/loop yang memanggil render(): kalau render() nyasar saat battle,
   arena dibangun ulang, turn balik 0, dan timer lama tetap jalan (battle jadi dobel cepat). */
function battleLive(){
  try{
    if(state&&state.battle)return true;
    if(typeof bt!=="undefined"&&bt&&!bt.over)return true;
    if(typeof raid!=="undefined"&&raid&&!raid.over)return true;
  }catch(e){}
  return false;
}
// Button footer kiri = menu (ikon hamburger statis di index.html).
function renderShell(){
  const cv=document.getElementById("coinVal");if(cv)cv.textContent=fmt(state.coins);
  const gv=document.getElementById("gemVal");if(gv)gv.textContent=fmt(state.premiumGems||0);
  const rv=document.getElementById("raidVal");if(rv)rv.textContent=fmt(state.raidTokens||0);
  const pl=document.getElementById("plvl");if(pl)pl.textContent="LVL "+state.playerLv;
  const wn=document.getElementById("whoName");if(wn)wn.textContent=currentUser||"GUEST";
  /* Profil ringkas di topbar (dipindah dari lobby). */
  if(state&&state.player){
    // Level up check: EXP per level = playerLv * 1000, naik LV setiap penuh -> +1 SP.
    while((state.player.exp||0)>=state.player.lv*1000){
      state.player.exp-=state.player.lv*1000;state.player.lv=(state.player.lv||0)+1;state.playerLv=state.player.lv;state.player.sp=(state.player.sp||0)+1;}
    const xpNeed=state.player.lv*1000,xpPct=Math.max(0,Math.min(100,Math.round(state.player.exp/xpNeed*100)));
    const tf=document.getElementById("tbXpFill");if(tf)tf.style.width=xpPct+"%";
    const txt=document.getElementById("tbXpText");if(txt)txt.textContent=`${state.player.exp} / ${xpNeed}`;
  }else{
    const xpNeed=state.playerLv*1000,xpPct=Math.max(0,Math.min(100,Math.round(state.xp/xpNeed*100)));
    const tf=document.getElementById("tbXpFill");if(tf)tf.style.width=xpPct+"%";
    const txt=document.getElementById("tbXpText");if(txt)txt.textContent=`${state.xp||0} / ${xpNeed}`;
  }
  const tn=document.getElementById("tbName");if(tn)tn.textContent=currentUser||"GUEST";
  const tl=document.getElementById("tbLvl");if(tl)tl.textContent="LVL "+state.playerLv;
  const tp=document.getElementById("tbPw");if(tp)tp.innerHTML="&#9889; "+fmt(totalPower());

  // Render Topbar Cyberpunk Avatar (Support Custom Gallery Photo or Card Art)
  const pav=document.getElementById("profAv");
  if(pav){
    if(state&&state.customAvatar){
      pav.innerHTML=`<img src="${state.customAvatar}" alt="Custom Avatar">`;
    }else{
      const eq=equipped(); const cid=eq&&eq.char;
      const art=(cid&&CARDS[cid])?cardThumb(cid):"";
      if(art){
        const pos=CARDS[cid].pos?` style="object-position:${CARDS[cid].pos}"`:'';
        pav.innerHTML=`<img src="${art}" alt="${cardName(cid)}" ${pos}>`;
      }else{
        pav.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7DF9FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6.5 8-6.5S20 16 20 20"/></svg>';
      }
    }
  }

  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.route===route()));
  try{const pm=document.getElementById("profModal");if(pm&&pm.style.display!=="none"&&pm.style.display!=="")renderProfile();}catch(e){}
  try{renderWeatherDock();renderBuffDock();startWeatherTick();}catch(e){}
  try{if(typeof startGlobalLuckPoll==='function')startGlobalLuckPoll();}catch(e){}
}

/* =============== DAILY LOGIN 7 HARI =============== */
const DAILY_TOTAL=DAILY_REWARDS.reduce((a,b)=>a+b,0);
function renderDaily(){
  const ready=state.lastClaim!==todayStr();
  const idx=state.dailyIndex;
  document.getElementById("dlGrid").innerHTML=DAILY_REWARDS.map((amt,i)=>{
    let cls="locked";
    if(i<idx)cls="claimed";
    else if(i===idx&&ready)cls="ready";
    return `<div class="dl-tile ${cls}">
      <div class="d">DAY ${i+1}</div>
      <div class="ic">${coinIcon(32)}</div>
      <div class="amt">${fmt(amt)}<br><small>COIN</small></div>
    </div>`;
  }).join("");
  const foot=document.getElementById("dlFoot");
  foot.innerHTML=(ready
    ?`<button class="dl-claim" id="dlClaim">KLAIM DAY ${idx+1} · +${fmt(DAILY_REWARDS[idx])} COIN</button>`
    :`<button class="dl-claim" disabled>SUDAH DIKLAIM HARI INI · KEMBALI BESOK</button>`)
    +`<div class="dl-total">Total 7 hari: <b>${fmt(DAILY_TOTAL)}</b> coin · ${idx}/7 diklaim siklus ini</div>`;
  if(ready)document.getElementById("dlClaim").onclick=claimDaily;
  tickDaily();
}
function claimDaily(){
  if(state.lastClaim===todayStr())return;
  const idx=state.dailyIndex;
  state.coins+=DAILY_REWARDS[idx]||0;
  state.lastClaim=todayStr();
  state.dailyIndex=(idx+1)%7;
  sfx.win();save();
  renderShell();renderDaily();
}
function closeDaily(){document.getElementById("dailyModal").classList.remove("show");if(route()==="#/lobby")render();}
function tickDaily(){
  const ms=nextResetMs();
  const c=document.getElementById("dlCount");if(c)c.textContent=fmtCountdown(ms);
}
let _dailyLast=null, _playLast=Date.now(), _playSaveAcc=0;
setInterval(()=>{
  if(!state)return;
  /* Waktu bermain: akumulasi detik saat tab aktif, persist tiap 30 detik. */
  const _now=Date.now();
  const _d=Math.max(0,Math.min(5,(_now-_playLast)/1000));
  _playLast=_now;
  if(!document.hidden){state.playSec=(state.playSec||0)+_d;_playSaveAcc+=_d;if(_playSaveAcc>=30){_playSaveAcc=0;save();}}
  tickDaily();
  if(state.lastClaim===_dailyLast)return;
  _dailyLast=state.lastClaim;renderShell();
  if(document.getElementById("dailyModal").classList.contains("show"))renderDaily();
},1000);
/* Simpan sinkron saat app ditutup/pindah background supaya playtime tidak hilang. */
addEventListener("pagehide",()=>{if(state)save();});
document.addEventListener("visibilitychange",()=>{
  if(state&&document.hidden)save();
  /* Hentikan animasi CSS dekoratif saat tab di background (hemat GPU/baterai). */
  try{document.body.classList.toggle("perf-paused",document.hidden);}catch(e){}
});

/* =============== HOME (Story) — kini nyatu di layar Lobby ===============
   Daftar bab dibangun jadi helper (chapListHTML/bindChapList) supaya bisa
   dipakai renderLobby. Render battle tetap lewat guard state.battle di lobby. */
function chapListHTML(){
  const pw=totalPower(),df=diffOf(),dcol=MUT_COLOR[df.mut]||"var(--pink)";
  return `<div class="chap-list" id="chapList">${CHAPTERS.map(c=>{
    const cd=diffProg()[state.diff];const open=cellUnlocked(c,state.diff),done=chapProgMode(c,state.diff);
    const total=c.levels.length,pct=total?Math.round(done/total*100):0,full=open&&done>=total;
    let nextLv=c.to;for(let i=c.from;i<=c.to;i++){if(!cd[i]){nextLv=i;break;}}
    const tgt=gateOf(nextLv),act=open&&c.no===(state?state.chap:1);
    const chip=full?"✓ SELESAI":(open?"▾ BUKA LEVEL":"🔒 TERKUNCI");
    return `<button class="story-banner${open?"":" lock"}${full?" full":""}${act?" active":""}" data-c="${c.no}">
      <span class="sb-no">${String(c.no).padStart(2,"0")}</span>
      ${act?'<span class="sb-tag">AKTIF</span>':""}
      <span class="sb-chip">${chip}</span>
      <div class="sb-content">
        <div class="gb-kicker">${c.tag} · <b style="color:${dcol}">${df.l}</b></div>
        <div class="sb-name">${c.zone}</div>
        <div class="sb-line">${open?`GATE ${fmt(tgt)} · <span class="sb-pw ${pw>=tgt?"ok":"bad"}">POWER ${fmt(pw)}</span> · PROGRES ${done}/${total}`:cellReqText(c,state.diff)}</div>
      </div>
      <span class="sb-bar"><i class="${full?"full":""}" style="width:${pct}%"></i></span>
    </button>`;
  }).join("")}</div>`;
}
function bindChapList(){
  document.querySelectorAll(".story-banner[data-c]").forEach(b=>b.onclick=()=>{
    const n=+b.dataset.c;
    if(state.chap!==n){state.chap=n;save();}
    openStory();
  });
}
function diffUnlocked(k){const i=DIFFS.findIndex(d=>d.k===k);if(i<=0)return true;return chapClearedMode(CHAPTERS[0],DIFFS[i-1].k);}
function openMission(){
  if (typeof window.openStory === "function") {
    window.openStory();
    return;
  }
  const pw=totalPower();
  const done=CHAPTERS.reduce((a,c)=>a+chapProgMode(c,state.diff),0),tot=CHAPTERS.reduce((a,c)=>a+c.levels.length,0);
  const pct=tot?Math.round(done/tot*100):0,df=diffOf(),dcol=MUT_COLOR[df.mut]||"var(--pink)";
  document.getElementById("mxStats").innerHTML=
    `<div class="mxs-cell"><span class="mxs-lbl">MODE</span><span class="mxs-chip" style="border-color:${dcol};color:${dcol}">${df.l}</span></div>`+
    `<div class="mxs-cell mxs-grow"><span class="mxs-lbl">PROGRES <b>${done}/${tot}</b></span><span class="mxs-bar"><i class="${done>=tot?"full":""}" style="width:${pct}%"></i></span></div>`+
    `<div class="mxs-cell mxs-r"><span class="mxs-lbl">POWER</span><b class="mxs-pw">${fmt(pw)}</b></div>`;
  document.getElementById("mxDiff").innerHTML=DIFFS.map(d=>{const unl=diffUnlocked(d.k),on=d.k===state.diff,col=d.mut==="none"?"var(--pink)":MUT_COLOR[d.mut];return `<button class="diff-btn${on?" on":""}${unl?"":" locked"}" data-d="${d.k}"${on?` style="border-color:${col};color:${col}"`:""}>${unl?d.l:"🔒 "+d.l}</button>`;}).join("");
  const note=document.getElementById("mxNote");note.textContent="";
  document.querySelectorAll("#mxDiff .diff-btn").forEach(b=>b.onclick=()=>{
    const k=b.dataset.d;
    if(!diffUnlocked(k)){note.textContent="SELESAIKAN SEMUA LEVEL BAB 1 DI MODE "+DIFFS[DIFFS.findIndex(d=>d.k===k)-1].l+" UNTUK BUKA MODE INI";sfx.lose&&sfx.lose();return;}
    if(state.diff===k)return;
    state.diff=k;sfx.hit();save();openMission();
  });
  document.getElementById("missionBody").innerHTML=chapListHTML();
  bindChapList();
  document.getElementById("missionModal").classList.add("show");
}
function closeMission(){document.getElementById("missionModal").classList.remove("show");}
function renderHome(){ renderLobby(); }
function openStory(targetChapNo){
  if (typeof window.openStoryCarousel === "function") {
    window.openStoryCarousel(targetChapNo);
    return;
  }
  try{
  const ch=activeChap(),pw=totalPower();
  if(!cellUnlocked(ch,state.diff)){state.diff=highestChapDiff(ch);save();}
  /* tag = "STORY · BAB N" — split defensif: kalau format berubah, jangan .trim() di undefined */
  const kicker=((ch.tag||"").split("·")[1]||("BAB "+ch.no)).trim();
  const skEl = document.getElementById("smKicker"); if(skEl) skEl.textContent="CERITA · "+kicker;
  const stEl = document.getElementById("smTitle"); if(stEl) stEl.textContent=ch.zone;
  /* HERO: art bab + info gate — nyambung visual sama banner lobby (shade + sb-line) */
  const df=diffOf(),dcol=MUT_COLOR[df.mut]||"var(--cyan)";
  let nx=ch.to;const cdh=diffProg()[state.diff];
  for(let i=ch.from;i<=ch.to;i++){if(!cdh[i]){nx=i;break;}}
  const gnx=gateOf(nx),doneN=chapProgMode(ch,state.diff),okN=pw>=gnx;
  const shEl = document.getElementById("smHero");
  if(shEl) shEl.innerHTML=
    `<span class="smh-chip" style="border-color:${dcol};color:${dcol}">${df.l}</span>`+
    `<div class="smh-line">GATE ${fmt(gnx)} · POWER ${fmt(pw)} <b class="${okN?"ok":"bad"}">${okN?"SIAP":"KURANG"}</b> · PROGRES ${doneN}/${ch.levels.length}</div>`;
  const sdEl = document.getElementById("smDiff");
  if(sdEl) sdEl.innerHTML=DIFFS.map(d=>{const unl=cellUnlocked(ch,d.k),on=d.k===state.diff,col=d.mut==="none"?"var(--pink)":MUT_COLOR[d.mut];return `<button class="diff-btn${on?" on":""}${unl?"":" locked"}" data-d="${d.k}"${on?` style="border-color:${col};color:${col}"`:""}>${unl?d.l:"&#128274; "+d.l}</button>`;}).join("");
  const snEl = document.getElementById("smDiffNote"); if(snEl) snEl.textContent="";
  document.querySelectorAll("#smDiff .diff-btn").forEach(b=>b.onclick=()=>{
    const k=b.dataset.d;const note=document.getElementById("smDiffNote");
    if(!cellUnlocked(ch,k)){if(note)note.textContent=cellReqText(ch,k);sfx.lose&&sfx.lose();return;}
    if(state.diff===k){if(note)note.textContent="";return;}
    if(note)note.textContent="";state.diff=k;sfx.hit();save();openStory();
  });
  const lvEl = document.getElementById("levels");
  if(lvEl) lvEl.innerHTML=Array.from({length:ch.levels.length},(_,i)=>{
    const cellOpen=cellUnlocked(ch,state.diff);const cd=diffProg()[state.diff];const lv=ch.from+i,en=enemyOf(lv),cl=cd[lv],unlocked=cellOpen&&(i===0||cd[lv-1]),g=gateOf(lv),ok=pw>=g;
    return `<button class="lvl-btn${unlocked?"":" locked"}${en.boss?" boss":""}${unlocked&&!ok?" weak":""}" data-lv="${lv}" title="${en.name} · GATE ${fmt(g)}" ${unlocked?"":"disabled"}>
      <img class="lvl-art" src="${en.img}" alt="" loading="lazy" onerror="this.remove()">
      ${cl?'<span class="chk">✓</span>':""}
      ${unlocked?`<span class="lvl-num">${i+1}</span>${en.boss?'<span class="lvl-bos">BOS</span>':""}<span class="lvl-name">${en.name}</span>`:'<span class="lvl-lock">🔒</span>'}
    </button>`;}).join("");
  document.querySelectorAll("#levels .lvl-btn:not(.locked)").forEach(x=>x.onclick=()=>openStart(+x.dataset.lv));
  /* mission modal ditutup di AKHIR — kalau build melempar error di tengah, user tetap lihat daftar bab (gak "balik ke lobby" tanpa kabar) */
  const mm=document.getElementById("missionModal");if(mm)mm.classList.remove("show");
  document.getElementById("storyModal").classList.add("show");
  }catch(err){
    console.error("openStory error",err);
    try{toast("STORY ERROR",(err&&err.message)||"gagal membuka cerita","#ff5c5c");}catch(e){}
  }
}
function closeStory(){document.getElementById("storyModal").classList.remove("show");}
let startLv=null;
function openStart(lv){
  startLv=lv;
  /* first clear = PER DIFFICULTY (diffProg), bukan state.cleared global —
     biar clear pertama di HARD/EXTREME/NIGHTMARE tetap bayar 100%, bukan replay 20%. */
  const en=enemyOf(lv),es=enemyStats(lv),first=!diffProg()[state.diff][lv];
  const reward=first?firstClearReward(lv):Math.round(firstClearReward(lv)*.2);
  const pss=en.id&&CARDS[en.id]?CARDS[en.id].passive:null,pw=totalPower(),g=gateOf(lv),ok=pw>=g;
  const bar=Math.max(4,Math.min(100,Math.round(pw/g*100)));
  document.getElementById("startBody").innerHTML=`
    <div class="st-hero">
      <div class="st-port${mutGlow(diffOf().mut)}"${mutEdge(diffOf().mut)}><img src="${en.img}" alt="${en.name}"></div>
      <div class="st-info">
        <div class="eyebrow" style="color:${en.boss?"var(--pink)":"var(--cyan)"}">LEVEL ${lv}${en.boss?" · BOSS":""}</div>
        <div class="st-name">${en.name}</div>
        <div class="st-ep">${en.epithet} ${diffOf().mut&&diffOf().mut!=="none"?mutChip(diffOf().mut,mutBox(diffOf().mut,"st-mut")):""}</div>
        <div class="st-stats"><span>♡ ${fmt(es.hp)}</span><span>${ATKIC} ${fmt(es.atk)}</span></div>
      </div>
    </div>
    <div class="st-gate ${ok?"ok":"bad"}">
      <div class="sg-row"><span>POWER KAMU</span><b>${fmt(pw)}</b></div>
      <div class="sg-bar"><i style="width:${bar}%"></i></div>
      <div class="sg-row"><span>GATE MUSUH</span><b>${fmt(g)}</b></div>
    </div>
    ${pss?`<div class="st-trait"><b>PASSIVE · ${pss.name}</b> ${pss.desc}</div>`:""}
    <div class="st-reward"><span class="st-rw-label">${first?"FIRST CLEAR":"REPLAY (20%)"} · ${diffOf().l} ×${diffOf().rw||1}</span><span class="st-rw-gold">◎ ${fmt(reward)} gold</span></div>
    <div class="st-btns">
      <button class="st-cancel" id="stCancel">BATAL</button>
      <button class="st-go${ok?"":" weak"}" id="stGo">${ok?"⚔ &nbsp;MULAI BATTLE":"⚠ &nbsp;POWER KURANG — MASUK"}</button>
    </div>`;
  document.getElementById("startModal").classList.add("show");
  document.getElementById("stCancel").onclick=closeStart;
  document.getElementById("stGo").onclick=()=>{closeStart();closeStory();const lv=startLv;state.battle={level:lv};render();};
}
function closeStart(){document.getElementById("startModal").classList.remove("show");}
let fightTimer=null;
function playFight(cb,opts){
  /* opts.skipIntro=true -> lewatin cut-in intro (overlay #fightFx) & delay 1350ms.
     Dipakai Infinite Tower supaya tiap naik lantai gak nge-play cut-in lagi. */
  const skipIntro=!!(opts&&opts.skipIntro);
  const f=document.getElementById("fightFx");
  if(!f){ if(typeof cb==="function")cb(); return; }

  // Populate Face-off details if elements exist
  try{
    const eq=equipped();
    let foeName="ENEMY", foeImg="", foeTier="BOSS", isBoss=false, subText="STAGE TARGET";

    if(state.battle&&state.battle.level!==undefined&&typeof enemyOf==="function"){
      const lv=state.battle.level;
      const en=enemyOf(lv);
      if(en){
        foeName=en.name||("STAGE "+lv);
        foeImg=en.img||"";
        foeTier=en.tier||(en.boss?"BOSS":"SR");
        isBoss=!!en.boss;
        subText=isBoss?"BOSS ENCOUNTER":"SECTOR CLEARANCE";
      }
    }else if(typeof raid!=="undefined"&&raid&&raid.boss){
      foeName=raid.boss.name||"RAID BOSS";
      foeImg=raid.boss.img||"";
      foeTier="RAID";
      isBoss=true;
      subText="SECTOR THREAT LEVEL: MAXIMUM";
    }else if(typeof towerRun!=="undefined"&&towerRun&&towerRun.waves&&towerRun.waves[towerRun.idx]){
      const w=towerRun.waves[towerRun.idx];
      foeName=w.en?w.en.name:"TOWER GUARDIAN";
      foeImg=w.en?w.en.img:"";
      foeTier="FLOOR "+(towerRun.idx+1);
      subText="INFINITE SPIRE ANOMALY";
    }

    const pImg=document.getElementById("bioPlayerImg");
    const pName=document.getElementById("bioPlayerName");
    const pTier=document.getElementById("bioPlayerTier");
    const pSub=document.getElementById("bioPlayerSub");

    if(eq){
      const cData=CARDS&&CARDS[eq.char];
      if(pImg){
        pImg.src=(cData&&cardImg(eq.char))||"";
        if(cData&&cData.pos&&cData.pos!=="center"){
          pImg.style.objectPosition=cData.pos;
        }else{
          pImg.style.objectPosition="center 15%";
        }
      }
      if(pName)pName.textContent=cardName(eq.char);
      if(pTier){
        pTier.textContent=eq.tier||"SSR";
        pTier.setAttribute("data-tier",eq.tier||"SSR");
      }
      if(pSub)pSub.textContent=eq.shiny?"SHINY OPERATOR · READY":"TACTICAL OPERATOR · READY";
    }

    const fImg=document.getElementById("bioFoeImg");
    const fName=document.getElementById("bioFoeName");
    const fTier=document.getElementById("bioFoeTier");
    const fRole=document.getElementById("bioFoeRole");
    const fSub=document.getElementById("bioFoeSub");

    if(fImg){
      fImg.src=foeImg;
      pImg && (fImg.style.objectPosition="center 15%");
    }
    if(fName)fName.textContent=foeName;
    if(fTier){
      fTier.textContent=foeTier;
      fTier.setAttribute("data-tier",foeTier);
    }
    if(fRole){
      fRole.textContent=isBoss?"BOSS":"HOSTILE";
      fRole.className="bio-badge-side foe"+(isBoss?" boss":"");
    }
    if(fSub)fSub.textContent=subText;

  }catch(err){
    console.warn("VS Intro populate err:",err);
  }

  // Audio cues: Entrance whoosh followed by impact clash
  if(!state.muted){
    try{
      if(window.CyberSfx&&typeof window.CyberSfx.cutInActivate==="function"){
        window.CyberSfx.cutInActivate();
        setTimeout(()=>{
          if(window.CyberSfx.katanaFinisher)window.CyberSfx.katanaFinisher();
          else if(window.CyberSfx.katanaSlash)window.CyberSfx.katanaSlash(0.9);
        },380);
      }else{
        noiseBurst(actxOf().currentTime,.22,1500,.05);
      }
    }catch(e){}
  }
  fightShout();

  f.classList.remove("go");
  void f.offsetWidth;
  if(!skipIntro) f.classList.add("go");

  clearTimeout(fightTimer);
  if(skipIntro){ if(typeof cb==="function")cb(); return; }
  fightTimer=setTimeout(()=>{
    f.classList.remove("go");
    if(typeof cb==="function")cb();
  },1350);
}

