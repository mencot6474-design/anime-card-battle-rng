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
  /* STARTER = kartu koleksi ASLI (CH_GREEN_BEAST), BUKAN STORY_BIBLE.units[0].
     units[0] = CH_UNSTOPPABLE_FIST: template musuh story (noGacha, HP 211/ATK 105) yang
     nama tampilan & file art-nya kembar dengan kartu asli CH_GREEN_BEAST (HP 320, chance
     100k) — jadi akun baru memegang kartu yang tampak seperti di index tapi berisi stat
     story. Fallback defensif: id tidak ada → entri PERTAMA yang bukan noGacha dan punya
     chance; tidak pernah template. Sumber = array yang sudah dibaca kode ini (units),
     supaya tidak bergantung pada urutan muat MASTER_CARD_INDEX/CARDS. */
  const _units=(Array.isArray(STORY_BIBLE.units)?STORY_BIBLE.units:(typeof MASTER_CARD_INDEX!=="undefined"?MASTER_CARD_INDEX:[]));
  const _idOf=c=>c.id||c.char_id;
  const _real=c=>!!c&&!c.noGacha&&typeof c.chance==="number"&&c.chance>0;
  const _want=_units.find(c=>_idOf(c)==="CH_GREEN_BEAST");
  const s0=_real(_want)?_want:(_units.find(c=>_real(c))||null);
  const start=s0?{id:Math.random().toString(36).slice(2,9),char:_idOf(s0),tier:(s0.tier==null?null:s0.tier),fav:false,lock:false,mut:"none",shiny:false,trait:"none",count:1}:null;
  const newState={coins:1000,wbTokens:0,wbStrikerId:null,wbAutoRepeat:false,playerLv:1,xp:0,dailyIndex:0,lastClaim:"",summons:0,totalRolls:0,playSec:0,muted:false,lang:"en",diff:"normal",chap:1,raidDiff:"normal",raidCleared:{normal:false,hard:false,extreme:false,nightmare:false},raidShopOwned:{},towerShopOwned:{},storyGemMilestones:{},dailyGemPending:0,storyCd:{},rebirth:{count:0,essence:0},tower:{best:0,runs:0,auto:false},battleSpeed:1,
    cleared:{},clearedDiff:{normal:{},hard:{},extreme:{},nightmare:{}},equippedId:start?start.id:null,equippedId2:null,deck:[start?start.id:null,null,null,null],stacks:start?[start]:[],charTraits:{},traitVault:{},history:[],rollHistory:[],battle:null,
    player:{luckBase:1,luckFlat:0,luckPercent:0,exp:0,lv:1,sp:0,tree:{}},weather:null,weatherBest:null,potions:0,mythicPotions:0,luckPots:[0,0,0],speedPots:[0,0,0],luckBuffs:[],speedBuffs:[],infTokens:0,
    artOwned:[],artSlots:[null,null],petOwned:[],petEquipped:null,passesOwned:[],intanRolls:0,idxRewardsClaimed:0,premiumGems:50,rollPacks:{r5k:0,r10k:0,r25k:0,r50k:0,r100k:0}};
  console.log('[FRESH STATE] Initialized player:',newState.player);
  return newState;
}
function todayStr(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function nextResetMs(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,0,0,0,0)-n;}
function fmtCountdown(ms){const s=Math.max(0,Math.floor(ms/1000));const p=x=>String(x).padStart(2,"0");const h=Math.floor(s/3600);const m=Math.floor(s%3600/60);const sec=s%60;if(h>0)return p(h)+":"+p(m)+":"+p(sec);return p(m)+":"+p(sec);}
let state=null, currentUser=null;
/* Guard normalisasi template story: sekali per loadStateFor, BUKAN per render. */
let _noGachaMig=false;
/* MIGRASI TEMPLATE STORY -> KARTU ASLI (generalisasi migrasi starter c4dff83 yang cuma
   mengurus CH_UNSTOPPABLE_FIST dan sekadar console.warn untuk noGacha sisanya).
   Setiap unit noGacha di STORY_BIBLE berbagi FILE ART dengan kartu koleksi aslinya, jadi
   stack yang memegang template dipindah ke kembarannya: karakter yang sama, stat asli —
   bukan penghapusan, pemain tidak kehilangan apa pun. Predikat SATU-SATUNYA
   CARDS[char].noGacha === true; kartu cuaca eksklusif dan boss raid/tower LEGIT tidak
   pernah tersentuh (roll math / drop rate / freshState tidak dibaca di sini).
   - kembar ada                  -> char ditulis ulang + tier disegarkan dari CARDS
   - varian kembar sudah dimiliki (char|mut|shiny) -> hasil migrasi dibuang, entri asli
     pemain dipertahankan, deck/equippedId/equippedId2 yang menunjuk stack buangan
     dipindah ke id yang bertahan (DECK MENYIMPAN STACK-ID, bukan char-id)
   - tanpa kembar                -> stack dibuang, slot deck yang menunjuknya di-null */
function migrateNoGachaTemplates(force){
  if(_noGachaMig&&!force)return -1;
  _noGachaMig=true;
  if(!state||!Array.isArray(state.stacks))return 0;
  const isT=s=>!!(s&&CARDS[s.char]&&CARDS[s.char].noGacha===true);
  const tmpl=state.stacks.filter(isT);
  if(!tmpl.length)return 0;
  const pool=Object.values(CARDS), twins={}, many=[];
  for(const t of pool){
    if(t.noGacha!==true)continue;
    const cand=pool.filter(c=>c!==t&&c.noGacha!==true&&c.sprite_asset&&c.sprite_asset===t.sprite_asset);
    if(cand.length>1){ many.push(t.char_id+"x"+cand.length); cand.sort((a,b)=>(a.chance==null?Infinity:a.chance)-(b.chance==null?Infinity:b.chance)); }
    if(cand.length)twins[t.char_id]=cand[0].char_id;
  }
  const _vk=s=>s.char+"|"+(s.mut||"none")+"|"+(s.shiny?1:0);
  const tids=new Set(tmpl.map(s=>s.id)), keeper={};
  state.stacks.forEach(s=>{ if(!tids.has(s.id)&&!keeper[_vk(s)]) keeper[_vk(s)]=s; });
  const drop=new Set(), migrated=[], collided=[], unpaired=[];
  for(const s of tmpl){
    const from=s.char, twin=twins[from];
    if(!twin){ unpaired.push(from); drop.add(s.id); continue; }
    if(state.charTraits&&state.charTraits[from]&&!state.charTraits[twin]){state.charTraits[twin]=state.charTraits[from];delete state.charTraits[from];}
    if(state.traitVault&&state.traitVault[from]&&!state.traitVault[twin]){state.traitVault[twin]=state.traitVault[from];delete state.traitVault[from];}
    s.char=twin; s.tier=(CARDS[twin].tier==null?null:CARDS[twin].tier);
    if(keeper[_vk(s)]){ drop.add(s.id); collided.push(from+"->"+twin); }
    else{ keeper[_vk(s)]=s; migrated.push(from+"->"+twin); }
  }
  const remap=id=>{ if(!id)return id; const s=state.stacks.find(x=>x.id===id); if(!s)return id;
    if(drop.has(s.id)){ const g=keeper[_vk(s)]; return g?g.id:null; } return isT(s)?null:id; };
  state.deck=(Array.isArray(state.deck)?state.deck:[null,null,null,null]).map(remap);
  state.equippedId=remap(state.equippedId);
  state.equippedId2=remap(state.equippedId2);
  state.stacks=state.stacks.filter(s=>!drop.has(s.id));
  console.log('[MIGRATE NOGACHA] pindah '+migrated.length+':'+(migrated.join(',')||'-')+
    ' | varian kembar dibuang '+collided.length+':'+(collided.join(',')||'-')+
    ' | tanpa kembar dihapus '+unpaired.length+':'+(Array.from(new Set(unpaired)).join(',')||'-')+
    (many.length?' | kembar ambigu '+many.length+':'+many.join(',')+' (ambil paling langka)':''));
  return migrated.length+drop.size;
}
function loadStateFor(name){
  KEY="aab-state-v2:"+name;
  _noGachaMig=false;
  _coinSpent=0;
  _xpGained=0;
  _rebirthGained=0;
  _rebirthDo=false;
  /* Unit 4: antrean hasil roll server terikat akun — hasil akun lama jangan ikut
     direveal di akun baru (kartunya sudah tercatat di save akun lama). */
  try{ if(typeof srReset==="function") srReset(); }catch(e){}
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
  if(!state.player.tree||typeof state.player.tree!=="object")state.player.tree={};
  if(typeof state.player.sp!=="number")state.player.sp=0;

  /* REKONSILIASI OTOMATIS SKILL POINT (SP):
     Setiap naik 1 level pemain berhak atas 1 SP (Total SP = playerLv - 1).
     Hitung SP yang sudah terpakai di tree, sisa yang belum terpakai otomatis dipulihkan.
     Menjamin jika pemain level 17 login di browser baru, SP tidak hilang / reset. */
  try {
    const _pLv = Math.max(1, Math.floor(state.playerLv || (state.player && state.player.lv) || 1));
    const _earnedSp = Math.max(0, _pLv - 1);
    let _spentSp = 0;
    if (typeof TREE_NODES !== "undefined" && Array.isArray(TREE_NODES)) {
      TREE_NODES.forEach(n => {
        if (n && n.id !== "root" && state.player.tree[n.id]) {
          _spentSp += (n.cost || 0);
        }
      });
    }
    const _expectedSp = Math.max(0, _earnedSp - _spentSp);
    if ((state.player.sp || 0) < _expectedSp) {
      console.log(`[SP RECONCILE] Recovered SP for LV ${_pLv}: ${_expectedSp} SP (was ${state.player.sp})`);
      state.player.sp = _expectedSp;
    }
  } catch(e) { console.warn("[SP RECONCILE ERR]", e); }
  if(!Array.isArray(state.passesOwned))state.passesOwned=[];
  state.passesOwned=Array.from(new Set(state.passesOwned.filter(id=>typeof passDef==="function"?!!passDef(id):["speed-3x","luck-2x","luck-4x","shiny-2x","shiny-4x"].includes(id))));
  /* BATTLE SPEED: 1x & 2x gratis (player baru langsung bisa pakai), 3x via Pass Premium Shop, 4x dihapus */
  if(typeof state.battleSpeed!=="number"||state.battleSpeed<1||state.battleSpeed>3||Math.floor(state.battleSpeed)!==state.battleSpeed)state.battleSpeed=1;
  {const _max=state.passesOwned.includes("speed-3x")?3:2;if(state.battleSpeed>_max)state.battleSpeed=_max;}
  /* MIGRATE: flag kepemilikan kartu BOSS (TOKO RAID) — unlock roll permanen */
  if(!state.raidShopOwned||typeof state.raidShopOwned!=="object")state.raidShopOwned={};
  /* MIGRATE: flag kepemilikan kartu BOSS (TOKO INF TOWER) — unlock roll permanen */
  if(!state.towerShopOwned||typeof state.towerShopOwned!=="object")state.towerShopOwned={};
  console.log('[LOAD STATE] Initial player state:',state.player);
  
  if(!state.stacks||!state.stacks.length){const st=freshState();state.stacks=st.stacks;state.equippedId=st.equippedId;}
  
  state.stacks=state.stacks.filter(s=>CARDS[s.char]);
  
  /* MIGRASI TEMPLATE STORY (lihat migrateNoGachaTemplates di atas): menggantikan blok
     lama yang hanya menangani CH_UNSTOPPABLE_FIST dan membiarkan noGacha lain sebagai
     hantu. Semua 30 template ditangani; tabrakan varian tetap menyimpan entri pemain. */
  migrateNoGachaTemplates();
  
  /* DEDUP STRICT (v179-dedup): satu entri per varian (char|mut|shiny), count dipaksa 1.
     Copy ekstra dibuang tanpa EXP — hemat bandwidth & storage Supabase. Trait dipertahankan
     dari stack kedua kalau stack pertama belum punya trait. */
  {const seen={};state.stacks.forEach(s=>{const k=s.char+"|"+(s.mut||"none")+"|"+(s.shiny?1:0);if(!seen[k]){s.count=1;seen[k]=s;}else if((s.trait&&s.trait!=="none")&&(!seen[k].trait||seen[k].trait==="none"))seen[k].trait=s.trait;});state.stacks=Object.values(seen);}

  /* Field dup-EXP lama dihapus — tidak ada lagi auto-sell, jadi save tidak menyimpannya. */
  if(state.dupSold!==undefined)delete state.dupSold;
  if(state.dupExp!==undefined)delete state.dupExp;
  
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
  /* TOKEN WORLD BOSS: sumber satu-satunya = klaim reward rank harian.
     Saldo lama (raidTokens) dihapus — tidak dikonversi. */
  if(typeof state.wbTokens!=="number"||state.wbTokens<0)state.wbTokens=0;
  if(typeof state.wbAutoRepeat!=="boolean")state.wbAutoRepeat=false;
  if(typeof state.wbStrikerId!=="string"||!state.wbStrikerId)state.wbStrikerId=null;
  delete state.raidTokens;
  /* Gelar dari reward World Boss (ditulis server) — jaga bentuk array di client. */
  if(!Array.isArray(state.titles))state.titles=[];
  /* KEY INTI: save cloud bisa kembali TANPA key ini (baris cacat, atau ditulis build
     lama/prototipe). Bukan cuma angka salah — renderShell memanggil fmt(state.coins)
     dan fmt(undefined) melempar, jadi seluruh layar mati. Nilai default = sama seperti
     freshState, mengikuti pola premiumGems di bawah. */
  if(typeof state.coins!=="number"||state.coins<0)state.coins=1000;
  if(typeof state.playerLv!=="number"||state.playerLv<1)state.playerLv=state.player.lv||1;
  else state.playerLv=Math.floor(state.playerLv);
  if(state.playerLv!==state.player.lv)state.player.lv=state.playerLv;
  if(typeof state.xp!=="number"||state.xp<0)state.xp=0;
  /* 0026: level/xp sekarang milik server. Save lama punya DUA cermin (top-level
     xp/playerLv dan player.exp/lv) yang bisa berbeda; samakan dulu dengan ambil
     yang terbesar supaya progres lokal tidak hilang sebelum nilai dikunci. */
  if(!state.player||typeof state.player!=="object")state.player={};
  {const _mlv=Math.max(1,Math.floor(state.playerLv)||1,Math.floor(state.player.lv)||1);
   const _mxp=Math.max(0,Math.floor(state.xp)||0,Math.floor(state.player.exp)||0);
   state.playerLv=_mlv;state.xp=_mxp;state.player.lv=_mlv;state.player.exp=_mxp;}
  if(typeof state.summons!=="number"||state.summons<0)state.summons=0;
  if(typeof state.lastClaim!=="string")state.lastClaim="";
  if(typeof state.muted!=="boolean")state.muted=false;
  if(!Array.isArray(state.history))state.history=[];
  if(!Array.isArray(state.rollHistory))state.rollHistory=[];
  if(state.rollHistory.length>10)state.rollHistory.length=10;
  if(!state.cleared||typeof state.cleared!=="object")state.cleared={};
  if(state.weather===undefined)state.weather=null;
  if(state.weatherBest===undefined)state.weatherBest=null;
  /* INDEX REWARD: patch save lama */
  if(typeof state.intanRolls!=="number"||state.intanRolls<0)state.intanRolls=0;
  if(typeof state.premiumGems!=="number"||state.premiumGems<0)state.premiumGems=50;
  if(!state.storyGemMilestones||typeof state.storyGemMilestones!=="object")state.storyGemMilestones={};
  if(typeof state.dailyGemPending!=="number"||state.dailyGemPending<0)state.dailyGemPending=0;
  /* COOLDOWN REPLAY per stage: map "<diff>:<lv>" -> until-ms.
     Scalar storyCdUntil lama mengunci SEMUA stage sekali main — dibuang. */
  if(!state.storyCd||typeof state.storyCd!=="object"||Array.isArray(state.storyCd))state.storyCd={};
  Object.keys(state.storyCd).forEach(k=>{if(!(+state.storyCd[k]>Date.now()))delete state.storyCd[k];});
  delete state.storyCdUntil;
  /* REBIRTH: nilai duplikat kartu masuk sini, BUKAN EXP player. count = jumlah rebirth,
     essence = progress menuju ambang berikutnya (dipakai habis saat rebirth). */
  if(!state.rebirth||typeof state.rebirth!=="object"||Array.isArray(state.rebirth))state.rebirth={count:0,essence:0};
  if(typeof state.rebirth.count!=="number"||state.rebirth.count<0)state.rebirth.count=0;
  if(typeof state.rebirth.essence!=="number"||state.rebirth.essence<0)state.rebirth.essence=0;
  if(!state.rollPacks||typeof state.rollPacks!=="object")state.rollPacks={r5k:0,r10k:0,r25k:0,r50k:0,r100k:0};
  ['r5k','r10k','r25k','r50k','r100k'].forEach(k=>{if(typeof state.rollPacks[k]!=="number"||state.rollPacks[k]<0)state.rollPacks[k]=0;});
  /* 0040: `dailyR100kBalance` (bonus login yang dulu cuma angka localStorage) DIMATIKAN.
     Pack harian sekarang lahir di `player_packs` lewat claim_daily_gem, jadi tidak ada
     lagi saldo bayangan yang harus digabung ke rollPacks — dan tidak ada lagi lubang
     "F12 setDailyR100kBalance(9999)" yang tidak dilihat server. */
  try{ localStorage.removeItem("acb_daily_r100k_v1:"+String(name||"guest").toLowerCase()); }catch(e){}
  delete state.dailyR100kBalance;
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
  syncBaseTraits();
  if(!state.tower||typeof state.tower!=="object")state.tower={best:0,runs:0};
  if(typeof state.tower.best!=="number"||state.tower.best<0)state.tower.best=0;
  if(typeof state.tower.runs!=="number"||state.tower.runs<0)state.tower.runs=0;
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

function _traitRank(k){
  if(!k||k==="none"||typeof TRAIT_TIERS==="undefined")return -1;
  return TRAIT_TIERS.findIndex(t=>t.k===k);
}
function syncBaseTraits(){
  if(!state)return;
  if(!state.charTraits||typeof state.charTraits!=="object"||Array.isArray(state.charTraits))state.charTraits={};
  Object.keys(state.charTraits).forEach(cid=>{
    const tk=state.charTraits[cid];
    if(!CARDS[cid]||!tk||tk==="none"||!TRAIT[tk])delete state.charTraits[cid];
  });
  if(!state.traitVault||typeof state.traitVault!=="object"||Array.isArray(state.traitVault))state.traitVault={};
  const stacks=Array.isArray(state.stacks)?state.stacks:[];
  const byId=new Map();
  const ownedChars=new Set();
  stacks.forEach(s=>{
    if(!s||!CARDS[s.char])return;
    if(s.id)byId.set(s.id,s);
    ownedChars.add(s.char);
  });
  /* Promote unmigrated variant traits -> base card (highest tier wins across variants) */
  const migratedNow=new Set();
  stacks.forEach(s=>{
    if(!s||!CARDS[s.char])return;
    if(s.trait&&s.trait!=="none"&&TRAIT[s.trait]){
      const existing=state.charTraits[s.char];
      if(!existing||!TRAIT[existing]){
        state.charTraits[s.char]=s.trait;
        migratedNow.add(s.char);
      }else if(migratedNow.has(s.char)&&_traitRank(s.trait)>_traitRank(existing)){
        state.charTraits[s.char]=s.trait;
      }
    }
  });
  /* Migrate legacy stackId-keyed traitVault -> charId-keyed traitVault */
  const nextVault={};
  Object.keys(state.traitVault).forEach(key=>{
    const tk=state.traitVault[key];
    if(!tk||tk==="none"||!TRAIT[tk])return;
    let cid=CARDS[key]?key:null;
    if(!cid){const st=byId.get(key);if(st&&CARDS[st.char])cid=st.char;}
    if(!cid||!ownedChars.has(cid))return;
    if(!nextVault[cid]||_traitRank(tk)>_traitRank(nextVault[cid]))nextVault[cid]=tk;
  });
  state.traitVault=nextVault;
  /* Sync base trait onto EVERY variant stack of each base card */
  stacks.forEach(s=>{
    if(!s||!CARDS[s.char])return;
    s.trait=(typeof charTraitOf==="function")?charTraitOf(s.char):(state.charTraits[s.char]||"none");
  });
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
function cellReqText(ch,mode){const ci=DIFFS.findIndex(d=>d.k===mode),idx=ch.no-1;if(idx<0)return"";if(idx===0)return"COMPLETE ALL CHAPTER 1 LEVELS IN MODE "+DIFFS[ci-1].l+" TO UNLOCK THIS MODE";return"SELESAIKAN SEMUA LEVEL BAB "+(ch.no-1)+" DI MODE "+DIFFS[ci].l+" UNTUK BUKA BAB INI DI MODE "+DIFFS[ci].l;}
function mutBox(mut,cls){return mutPill(mut,cls);}
const mutGlow=m=>m&&m!=="none"?` mut-${m}`:"";
const mutEdge=m=>m&&m!=="none"?` style="border-color:${MUT_COLOR[m]}"`:"";
function enemyOf(level){const f=FOES[level];if(!f)return{id:null,name:"Gate Watcher L-"+level,epithet:chapOf(level).zone,img:chapOf(level).art,boss:false,tier:"R"};return{id:f.id,name:f.name,epithet:f.ep,img:f.img,boss:!!f.boss,tier:f.tier};}
function enemyStats(level){const l=STORY_BIBLE.levels[level-1];if(!l)return{hp:120,atk:40};const c=CARDS[l.unit];if(!c)return{hp:120,atk:40};const k=MUT_MULT[diffOf().mut]||1;return{hp:Math.round(c.base_hp*(0.55+0.15*level)*k),atk:Math.round(c.base_atk*(0.35+0.13*level)*k)};}
function firstClearReward(level){const l=STORY_BIBLE.levels[level-1];return (l?l.reward:300)*(diffOf().rw||1);}
/* ===== STORY GEM: DIBAYAR PER STAGE + BONUS "CHAPTER COMPLETE" =====
   Basis per BAB (mode NORMAL) di-skala ke ekonomi Gem (pet 10.000).
   75% basis pecah ke 6 stage MENGIKUT bobot reward coin stage (bos paling besar),
   25% sisanya jadi bonus saat bab tamat. Jadi setiap kemenangan story keluar
   dengan GEM, bukan cuma stage 6. */
const STORY_GEM_BASE={1:40,2:60,3:70,4:90,5:120};
const STORY_GEM_STAGE_SHARE=0.75;
function diffRw(diffKey){const d=DIFFS.find(x=>x.k===diffKey);return d?(d.rw||1):1;}
function storyStageGemReward(lv,diffKey){
  const ch=chapOf(lv);
  if(!ch)return 0;
  const base=STORY_GEM_BASE[ch.no]||0;
  const st=ch.levels[lv-ch.from];
  if(!base||!st)return 0;
  const total=ch.levels.reduce((s,x)=>s+(x.reward||0),0)||1;
  return Math.max(1,Math.round(base*STORY_GEM_STAGE_SHARE*diffRw(diffKey)*((st.reward||0)/total)));
}
function storyChapBonus(chapNo,diffKey){
  const base=STORY_GEM_BASE[chapNo]||0;
  if(!base)return 0;
  return Math.round(base*(1-STORY_GEM_STAGE_SHARE)*diffRw(diffKey));
}
function _storyMsObj(){
  if(!state)return null;
  if(!state.storyGemMilestones||typeof state.storyGemMilestones!=="object")state.storyGemMilestones={};
  return state.storyGemMilestones;
}
function _storyPendingSet(key,on){
  if(typeof window==="undefined")return;
  if(!window.__storyClaimPending||typeof window.__storyClaimPending!=="object")window.__storyClaimPending={};
  if(on)window.__storyClaimPending[key]=true;
  else delete window.__storyClaimPending[key];
}
function _storyMarkCleared(lv,diffKey){
  if(!state)return;
  if(!state.clearedDiff||typeof state.clearedDiff!=="object")state.clearedDiff={};
  if(!state.clearedDiff[diffKey]||typeof state.clearedDiff[diffKey]!=="object")state.clearedDiff[diffKey]={};
  state.clearedDiff[diffKey][lv]=true;
  if(diffKey==="normal"){
    if(!state.cleared||typeof state.cleared!=="object")state.cleared={};
    state.cleared[lv]=true;
  }
}
function _storyUnmarkCleared(lv,diffKey){
  if(!state)return;
  if(state.clearedDiff&&state.clearedDiff[diffKey])delete state.clearedDiff[diffKey][lv];
  if(diffKey==="normal"&&state.cleared)delete state.cleared[lv];
}
/* Satu pintu hasil klaim GEM: toast + rollback kalau server nolak.
   Nominal final datang dari server (res.gems) — client cuma menghitung
   preview untuk layar, bukan untuk pembayaran. */
function _gemDone(res,okTitle,okMsg,onFail){
  if(res&&res.ok){
    try{save();}catch(e){}
    try{renderShell();}catch(e){}
    try{toast(okTitle,okMsg,"#ffd700");}catch(e){}
  }else{
    if(onFail)try{onFail();}catch(e){}
    try{save();}catch(e){}
    const why=(res&&res.msg)==="UNREACHABLE"?"PROGRESS NOT UNLOCKED":((res&&res.msg)||"Try again later");
    try{toast("GEM FAILED",why,"#f87171");}catch(e){}
  }
}
function _gemUser(){
  return (typeof currentUser!=="undefined"&&currentUser)?String(currentUser):"";
}
/* GEM first-clear satu stage — sekali per (stage x mode). Server yang tahu
   nominal & memastikan cuma dibayar sekali (0023 claim_story_gem). */
function claimStageGemAsync(lv,diffKey,opts){
  const cfg=opts||{};
  const ms=_storyMsObj();
  if(!ms)return{preview:0,promise:Promise.resolve({ok:false,gems:0,msg:"NO_STATE"})};
  const key="s"+lv+":"+diffKey;
  if(ms[key]&&!cfg.forceCheck){
    return{preview:0,promise:Promise.resolve({ok:false,gems:0,msg:"ALREADY"})};
  }
  const gems=storyStageGemReward(lv,diffKey);
  if(!gems)return{preview:0,promise:Promise.resolve({ok:false,gems:0,msg:"BAD_STAGE"})};
  ms[key]=true;
  _storyPendingSet(key,true);
  try{save();}catch(e){}
  const promise=(async()=>{
    if(typeof window!=="undefined")window.__storyClaimInFlight=(window.__storyClaimInFlight||0)+1;
    let res;
    try{
      const u=_gemUser();
      if(u&&window.CloudDB&&window.CloudDB.claimStoryGem) res=await window.CloudDB.claimStoryGem(u,lv,diffKey,"stage");
      else{state.premiumGems=(state.premiumGems||0)+gems;res={ok:true,gems};}
    }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
    finally{
      _storyPendingSet(key,false);
      if(typeof window!=="undefined")window.__storyClaimInFlight=Math.max(0,(window.__storyClaimInFlight||1)-1);
    }
    if(res&&res.ok){
      ms[key]=true;
      _storyMarkCleared(lv,diffKey);
      const paid=(typeof res.gems==="number")?res.gems:gems;
      _gemDone(res,"STAGE "+lv+" · "+String(diffKey).toUpperCase(),"+"+paid+" GEM");
      return{ok:true,gems:paid,kind:"stage",label:"STAGE "+lv};
    }
    if(res&&res.msg==="ALREADY"){
      ms[key]=true;
      _storyMarkCleared(lv,diffKey);
      try{save();}catch(e){}
      if(!cfg.noReplayFallback&&!storyInRepeatCdFor(lv,diffKey)){
        return await claimStoryRepeatGemAsync(lv,diffKey,{noStageFallback:true}).promise;
      }
      return{ok:false,gems:0,msg:"ALREADY",label:""};
    }
    _gemDone(res,"STAGE "+lv+" · "+String(diffKey).toUpperCase(),"+"+gems+" GEM",()=>{
      ms[key]=false;
      if(cfg.revertProgOnFail)_storyUnmarkCleared(lv,diffKey);
    });
    return{ok:false,gems:0,msg:(res&&res.msg)||"ERROR",label:""};
  })();
  return{preview:gems,promise};
}
function claimStageGem(lv,diffKey,opts){
  return claimStageGemAsync(lv,diffKey,opts).preview;
}
/* Bonus saat SEMUA stage bab tamat — key lama (chap:diff) tetap dipakai, jadi
   player yang sudah pernah klaim milestone penuh tidak dapat dua kali. */
function claimStoryMilestoneAsync(chapNo,diffKey,opts){
  const cfg=opts||{};
  const ms=_storyMsObj();
  if(!ms)return{preview:0,promise:Promise.resolve({ok:false,gems:0,msg:"NO_STATE"})};
  const key=chapNo+":"+diffKey;
  if(ms[key]&&!cfg.forceCheck){
    return{preview:0,promise:Promise.resolve({ok:false,gems:0,msg:"ALREADY"})};
  }
  const gems=storyChapBonus(chapNo,diffKey);
  if(!gems)return{preview:0,promise:Promise.resolve({ok:false,gems:0,msg:"BAD_CHAPTER"})};
  ms[key]=true;
  _storyPendingSet(key,true);
  try{save();}catch(e){}
  const promise=(async()=>{
    if(typeof window!=="undefined")window.__storyClaimInFlight=(window.__storyClaimInFlight||0)+1;
    let res;
    try{
      const u=_gemUser();
      if(u&&window.CloudDB&&window.CloudDB.claimStoryGem) res=await window.CloudDB.claimStoryGem(u,chapNo,diffKey,"chapter");
      else{state.premiumGems=(state.premiumGems||0)+gems;res={ok:true,gems};}
    }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
    finally{
      _storyPendingSet(key,false);
      if(typeof window!=="undefined")window.__storyClaimInFlight=Math.max(0,(window.__storyClaimInFlight||1)-1);
    }
    if(res&&res.ok){
      ms[key]=true;
      const paid=(typeof res.gems==="number")?res.gems:gems;
      _gemDone(res,"CHAPTER "+chapNo+" COMPLETE · "+String(diffKey).toUpperCase(),"+"+paid+" GEM");
      return{ok:true,gems:paid,kind:"chapter",label:"CHAPTER "+chapNo};
    }
    if(res&&res.msg==="ALREADY"){
      ms[key]=true;
      try{save();}catch(e){}
      return{ok:false,gems:0,msg:"ALREADY",label:""};
    }
    _gemDone(res,"CHAPTER "+chapNo+" COMPLETE · "+String(diffKey).toUpperCase(),"+"+gems+" GEM",()=>{ms[key]=false;});
    return{ok:false,gems:0,msg:(res&&res.msg)||"ERROR",label:""};
  })();
  return{preview:gems,promise};
}
function claimStoryMilestone(chapNo,diffKey,opts){
  return claimStoryMilestoneAsync(chapNo,diffKey,opts).preview;
}
/* ===== REPEAT STORY: GEM PER STAGE + COOLDOWN 5 MENIT PER STAGE =====
   Replay stage yang sudah tamat memberi 20% coin & sebagian GEM-nya.
   Kooldown per stage = satu-satunya pembatas faucet, jadi rotasi antar stage
   bikin gem early game tidak susah. */
const STORY_REPEAT_CD_MS=5*60*1000;
const STORY_REPEAT_GEM_PCT=0.35;
const STORY_REPEAT_GEM_MIN=2;
/* ========== REBIRTH ==========
   Nilai tiap kartu duplikat (tier × mut × shiny) masuk ke state.rebirth.essence,
   BUKAN EXP player — jadi farming jutaan dup naikkan luck tanpa merusak level.
   Ambang bertahap (doubling dari REBIRTH_BASE); luck mult: R0=x1, R1=x5, R2=x10, dst. */
const REBIRTH_BASE=1000000;
/* 0027: essence rebirth server-authoritative. Client mengumpulkan delta
   `_rebirthGain` (transient) dan menandai `_rebirthDo` saat menekan REBIRTH;
   server yang memotong ambang & menaikkan count. Keduanya dikirim di push
   berikutnya dan di-reset setelah merge sukses (pola sama seperti _coinSpend). */
let _rebirthGained=0,_rebirthDo=false;
function rebirthCount(){return (state&&state.rebirth&&state.rebirth.count)||0;}
function rebirthEssence(){return (state&&state.rebirth&&state.rebirth.essence)||0;}
function rebirthThreshold(){return Math.round(REBIRTH_BASE*Math.pow(2,rebirthCount()));}
function rebirthLuckMult(cnt){const c=(typeof cnt==="number"&&isFinite(cnt))?Math.max(0,Math.floor(cnt)):rebirthCount();return c<=0?1:c*5;}
function canRebirth(){return rebirthEssence()>=rebirthThreshold();}
function addRebirthEssence(n){
  if(!state||!n)return 0;
  if(!state.rebirth||typeof state.rebirth!=="object")state.rebirth={count:0,essence:0};
  state.rebirth.essence=(state.rebirth.essence||0)+n;
  _rebirthGained+=n;
  return n;
}
function doRebirth(){
  if(!state||!canRebirth())return false;
  const cost=rebirthThreshold();
  state.rebirth.essence=rebirthEssence()-cost;
  state.rebirth.count=rebirthCount()+1;
  _rebirthDo=true;
  save();
  try{if(typeof pushCloudNow==="function")pushCloudNow();}catch(e){}
  return true;
}
function storyCdKeyFor(lv,diffKey){return (diffKey||(state&&state.diff)||"normal")+":"+lv;}
function storyCdKey(lv){return storyCdKeyFor(lv,state&&state.diff);}
function storyCdLeftFor(lv,diffKey){
  if(!state)return 0;
  return Math.max(0,(+(state.storyCd||{})[storyCdKeyFor(lv,diffKey)]||0)-Date.now());
}
function storyCdLeft(lv){return storyCdLeftFor(lv,state&&state.diff);}
function storyCdText(ms){const s=Math.max(0,Math.ceil((ms||0)/1000));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function storySetCdFor(lv,diffKey){
  if(!state)return;
  if(!state.storyCd||typeof state.storyCd!=="object")state.storyCd={};
  Object.keys(state.storyCd).forEach(k=>{if(!(+state.storyCd[k]>Date.now()))delete state.storyCd[k];});
  state.storyCd[storyCdKeyFor(lv,diffKey)]=Date.now()+STORY_REPEAT_CD_MS;
}
function storySetCd(lv){storySetCdFor(lv,state&&state.diff);}
function storyInRepeatCdFor(lv,diffKey){
  const dk=diffKey||(state&&state.diff)||"normal";
  return !!(state&&state.clearedDiff&&state.clearedDiff[dk]&&state.clearedDiff[dk][lv]&&storyCdLeftFor(lv,dk)>0);
}
function storyInRepeatCd(lv){return storyInRepeatCdFor(lv,state&&state.diff);}
/* Replay gem: dibayar tiap stage. Kooldown 5 menit per stage ditegakkan
   SERVER (0023 claim_story_replay), jadi rotasi stage tetap boleh. */
function claimStoryRepeatGemAsync(lv,diffKey,opts){
  const cfg=opts||{};
  const one=storyStageGemReward(lv,diffKey);
  if(!one)return{preview:0,promise:Promise.resolve({ok:false,gems:0,msg:"BAD_STAGE"})};
  const gems=Math.max(STORY_REPEAT_GEM_MIN,Math.round(one*STORY_REPEAT_GEM_PCT));
  const promise=(async()=>{
    if(typeof window!=="undefined")window.__storyClaimInFlight=(window.__storyClaimInFlight||0)+1;
    let res;
    try{
      const u=_gemUser();
      if(u&&window.CloudDB&&window.CloudDB.claimStoryReplay) res=await window.CloudDB.claimStoryReplay(u,lv,diffKey);
      else{state.premiumGems=(state.premiumGems||0)+gems;res={ok:true,gems};}
    }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
    finally{
      if(typeof window!=="undefined")window.__storyClaimInFlight=Math.max(0,(window.__storyClaimInFlight||1)-1);
    }
    if(res&&res.ok){
      const paid=(typeof res.gems==="number")?res.gems:gems;
      storySetCdFor(lv,diffKey);
      _gemDone(res,"REPLAY STAGE "+lv+" · "+String(diffKey).toUpperCase(),"+"+paid+" GEM");
      return{ok:true,gems:paid,kind:"replay",label:"REPLAY STAGE "+lv};
    }
    if(res&&res.msg==="COOLDOWN"){
      if(storyCdLeftFor(lv,diffKey)<=0)storySetCdFor(lv,diffKey);
      try{save();renderShell();}catch(e){}
      try{toast("REPLAY COOLDOWN","This stage was just paid — wait 5 minutes","#fbbf24");}catch(e){}
      return{ok:false,gems:0,msg:"COOLDOWN",label:""};
    }
    if(res&&res.msg==="UNREACHABLE"&&!cfg.noStageFallback){
      const firstRes=await claimStageGemAsync(lv,diffKey,{forceCheck:true,noReplayFallback:true}).promise;
      if(firstRes&&firstRes.ok)return firstRes;
      if(firstRes&&firstRes.msg==="ALREADY"){
        const u=_gemUser();
        if(u&&window.CloudDB&&window.CloudDB.claimStoryReplay){
          await new Promise(r=>setTimeout(r,250));
          let r2=null;
          try{r2=await window.CloudDB.claimStoryReplay(u,lv,diffKey);}catch(e){r2=null;}
          if(r2&&r2.ok){
            const paid2=(typeof r2.gems==="number")?r2.gems:gems;
            storySetCdFor(lv,diffKey);
            _gemDone(r2,"REPLAY STAGE "+lv+" · "+String(diffKey).toUpperCase(),"+"+paid2+" GEM");
            return{ok:true,gems:paid2,kind:"replay",label:"REPLAY STAGE "+lv};
          }
          if(r2&&r2.msg==="COOLDOWN"){
            if(storyCdLeftFor(lv,diffKey)<=0)storySetCdFor(lv,diffKey);
            try{save();renderShell();}catch(e){}
            try{toast("REPLAY COOLDOWN","This stage was just paid — wait 5 minutes","#fbbf24");}catch(e){}
            return{ok:false,gems:0,msg:"COOLDOWN",label:""};
          }
          res=r2||res;
        }
      }
    }
    _gemDone(res,"REPLAY STAGE "+lv+" · "+String(diffKey).toUpperCase(),"+"+gems+" GEM");
    return{ok:false,gems:0,msg:(res&&res.msg)||"ERROR",label:""};
  })();
  return{preview:gems,promise};
}
function claimStoryRepeatGem(lv,diffKey,opts){
  return claimStoryRepeatGemAsync(lv,diffKey,opts).preview;
}
/* Angka GEM yang bakal dibayar stage ini (first clear vs replay) — display only. */
function storyGemPreview(lv){
  if(!state)return 0;
  const one=storyStageGemReward(lv,state.diff);
  if(!one)return 0;
  if(!diffProg()[state.diff][lv])return one;
  return Math.max(STORY_REPEAT_GEM_MIN,Math.round(one*STORY_REPEAT_GEM_PCT));
}
/* Satu pintu masuk cerita: blok replay saat cooldown masih jalan. */
function startStoryBattle(lv){
  if(storyInRepeatCd(lv)){
    try{toast("REPLAY COOLDOWN","Tunggu "+storyCdText(storyCdLeft(lv))+" sebelum replay stage ini","#fbbf24");}catch(e){}
    if(state.battle){state.battle=null;render();}
    return false;
  }
  try{closeStory();}catch(e){}
  try{closeStart();}catch(e){}
  state.battle={level:lv};render();
  return true;
}
/* Tick 1 detik. Kooldown kini per stage: tiap kartu punya timer sendiri,
   jadi yang di-refresh hanya kartu yang hitungannya sudah lewat. */
function updateStoryCdUI(){
  if(!state)return;
  let expired=false;
  document.querySelectorAll(".sc-card.is-replay-cd").forEach(c=>{
    const left=storyCdLeft(+c.dataset.lv);
    if(left>0){const t=c.querySelector(".sc-cd-timer");if(t)t.textContent=storyCdText(left);}
    else{
      c.classList.remove("is-replay-cd");
      const ov=c.querySelector(".sc-cd-overlay");if(ov)ov.remove();
      expired=true;
    }
  });
  /* Dock = stage terpilih, jadi angkanya ikut kartu yang lagi di tengah. */
  const sel=document.querySelector(".sc-card.pos-0");
  const selLeft=sel?storyCdLeft(+sel.dataset.lv):0;
  const sb=document.getElementById("scBtnBattle");
  if(expired||sb&&sb.dataset.cdRepeat==="1"){
    if(selLeft>0){if(sb)sb.innerHTML="<span>⏱</span> "+storyCdText(selLeft);}
    else{try{updateStoryCarouselPositions(false);}catch(e){}}
  }
  const badge=document.getElementById("scDockCd");
  if(badge&&badge.style.display!=="none"&&selLeft>0)badge.textContent="REPLAY COOLDOWN · "+storyCdText(selLeft);
  const go=document.getElementById("stGo");
  if(go&&go.dataset.cdRepeat==="1"){
    const left=storyCdLeft(startLv);
    if(left>0){go.disabled=true;go.textContent="⏱ COOLDOWN "+storyCdText(left);}
    else{
      go.dataset.cdRepeat="";
      const sm=document.getElementById("startModal");
      if(sm&&sm.classList.contains("show")){try{openStart(startLv);}catch(e){}}
    }
  }
}
setInterval(updateStoryCdUI,1000);
let _cloudSaveTimer=null,_cloudLastPush=0,_cloudPending=false;
/* 0025: coin naik HANYA lewat RPC server. Belanja tetap dikerjakan lokal (biar UI
   langsung responsif) tapi dicatat sebagai delta dan dikirim di push berikutnya
   lewat `_coinSpend`; merge mengurangi saldo server sebesar delta itu, bukan
   mempercayai state.coins. Menurunkan coin sendiri tidak menguntungkan cheater. */
let _coinSpent=0;
function coinSpend(n){
  const amt=Math.max(0,Math.round(Number(n)||0));
  if(!state||!amt)return 0;
  state.coins=Math.max(0,(state.coins||0)-amt);
  _coinSpent+=amt;
  return amt;
}
/* 0026: XP juga server-authoritative. Client hanya boleh MENAMBAH lewat delta
   `_xpGain` (transient, dibuang merge); level dihitung server dengan rumus yang
   sama (xp per level = lv*1000). Dua cermin lama (state.xp/playerLv dan
   state.player.exp/lv) disamakan di sini supaya tidak pernah berbeda lagi. */
let _xpGained=0;
function xpGain(n){
  const amt=Math.max(0,Math.round(Number(n)||0));
  if(!state||!amt)return 0;
  state.playerLv=Math.max(1,Math.floor(state.playerLv)||1);
  state.xp=(state.xp||0)+amt;
  while(state.xp>=state.playerLv*1000){
    state.xp-=state.playerLv*1000;
    state.playerLv++;
    if(state.player)state.player.sp=(state.player.sp||0)+1;
  }
  if(state.player){state.player.lv=state.playerLv;state.player.exp=state.xp;}
  _xpGained+=amt;
  return amt;
}
/* Diff-based push (prioritas 2 riset bandwidth): track JSON key dari state TANPA playSec
   (yang tick tiap detik). Kalau key identik dengan yang terakhir dikirim, skip schedule
   push — playSec-only save otomatis gak makan bandwidth. */
let _lastPushedKey=null;
let _lastPushedUser=null;
/* Inventori (`stacks`, ±100 KB dari total save) tidak perlu ikut tiap push saat roll otomatis
   jalan: selama rolling dikirim maks 1x/menit, dan selalu dikirim penuh begitu roll berhenti. */
let _lastPushedStacksKey=null;
let _cloudLastStacksPush=0;
let _cloudStacksDirty=false;
function _cloudStateKey(){
  if(!state)return "";
  const sk = Object.assign({}, state);
  delete sk.playSec;
  return JSON.stringify(sk);
}
/* HEMAT BANDWIDTH: selama roll otomatis jalan (tick ~75ms) save cloud dibatasi 1x / 30 detik,
   bukan tiap tick. Sisa perubahan terakhir di-flush saat roll berhenti (flushCloudSave). */
const CLOUD_PUSH_MIN_MS=30000;
const CLOUD_STACKS_MIN_MS=60000;
function _cloudRolling(){return typeof rollState!=="undefined" && !!rollState && !!rollState.active;}
/* Ringkasan PUBLIK player: ikut terkirim tiap cloud save supaya player lain bisa
   membuka profilnya dari leaderboard tanpa menarik save lengkap. Sengaja TANPA
   gems/inventori/playSec — playSec dibaca server langsung dari save, dan angka
   yang berubah tiap detik tidak boleh membuat diff-key push selalu berbeda. */
function buildPubSummary(){
  if(!state)return null;
  const p=state.player||{};
  const out={
    lv:p.lv||state.playerLv||1,
    xp:p.exp||0,
    title:state.playerTitle||"ROOKIE",
    rolls:state.totalRolls||0,
    power:(typeof totalPower==="function"?Math.round(totalPower()):0)
  };
  const eq=typeof equipped==="function"?equipped():null;
  if(eq&&eq.char)out.hero={c:eq.char,m:eq.mut||"none",t:eq.trait||"none",s:eq.shiny?1:0};
  /* Kartu paling langka yang DIMILIKI — sama seperti baris "rarest" di profil sendiri. */
  let best=null,bestCh=0;
  for(const s of (state.stacks||[])){
    const ch=typeof effChance==="function"?effChance(s.char,s.mut||"none",!!s.shiny):0;
    if(ch>bestCh){bestCh=ch;best=s;}
  }
  if(best)out.rare={n:(typeof cardName==="function"?cardName(best.char):best.char),
    o:Math.round(bestCh),t:(typeof cardTier==="function"?cardTier(best.char):"")};
  return out;
}
function _cloudPush(opts){
  if(!state||!currentUser||!window.CloudDB)return Promise.resolve(null);
  const forceStacks=!!(opts&&opts.stacks);
  const stacksKey=JSON.stringify(state.stacks||[]);
  /* Saat rolling: hemat bandwidth (skipStacks). Saat tidak rolling atau forceStacks: kirim kartu penuh */
  const sendStacks=forceStacks || !_cloudRolling();
  _cloudLastPush=Date.now();_cloudPending=false;
  /* Snapshot key SEBELUM async push biar save() berikutnya compare against state yang
     memang udah dikirim ke cloud, bukan against state saat ini (yang bisa aja berubah
     di tengah fetch). Push failure di-track optimistis — kalau gagal, perubahan berikutnya
     tetap trigger retry karena key-nya beda. */
  _lastPushedKey=_cloudStateKey();
  _lastPushedUser=currentUser;
  if(sendStacks){_lastPushedStacksKey=stacksKey;_cloudLastStacksPush=Date.now();_cloudStacksDirty=false;}
  else if(stacksKey!==_lastPushedStacksKey)_cloudStacksDirty=true;
  const spent=_coinSpent;
  const gained=_xpGained;
  const rebGain=_rebirthGained;
  const rebDo=_rebirthDo;
  const sentPromise=window.CloudDB.saveState(currentUser, state, {skipStacks:!sendStacks, pub:buildPubSummary(), coinSpend:spent, xpGain:gained, rebirthGain:rebGain, rebirthDo:rebDo});
  if(spent) sentPromise.then(res=>{if(res&&res.ok)_coinSpent=Math.max(0,_coinSpent-spent);}).catch(()=>{});
  if(gained) sentPromise.then(res=>{if(res&&res.ok)_xpGained=Math.max(0,_xpGained-gained);}).catch(()=>{});
  if(rebGain) sentPromise.then(res=>{if(res&&res.ok)_rebirthGained=Math.max(0,_rebirthGained-rebGain);}).catch(()=>{});
  if(rebDo) sentPromise.then(res=>{if(res&&res.ok)_rebirthDo=false;}).catch(()=>{});
  return sentPromise.catch(()=>null);
}
function flushCloudSave(){
  if(_cloudSaveTimer){clearTimeout(_cloudSaveTimer);_cloudSaveTimer=null;}
  if(_cloudPending||_cloudStacksDirty)_cloudPush({stacks:true});
}
/* Flush yang bisa di-await — dipakai RPC yang baca save_data di server (mis. klaim
   reward World Boss). Tanpa ini, spend yang masih antre debounce 400ms hilang saat
   server balikin saldo lama lalu client menimpanya. */
function pushCloudNow(){
  if(_cloudSaveTimer){clearTimeout(_cloudSaveTimer);_cloudSaveTimer=null;}
  return _cloudPush({stacks:true});
}
function save(){
  /* Guard DevTools sudah memicu reset (0031): state lama di memori tidak boleh
     menimpa save baru. Tanpa ini auto-save playSec bisa mengembalikan progres. */
  if(window.__ACB_SAVE_LOCK__)return;
  if(state){
    /* Safety-net dedup sebelum serialize — menjamin payload yang masuk localStorage
       DAN yang dikirim ke Supabase tidak pernah berisi varian (char|mut|shiny) dobel,
       meskipun jalur lain (dev-grant, import save lama, dsb.) sempat menyuntik duplikat. */
    if(typeof dedupStacksInPlace==="function")dedupStacksInPlace();
    localStorage.setItem(KEY,JSON.stringify(state));
    if(currentUser && window.CloudDB){
      /* Diff check: kalau state yang akan dikirim identik dengan yang terakhir kali
         berhasil di-push, skip schedule (cancel pending timer juga). Hemat bandwidth
         terutama buat playSec auto-save / save() yang kepicet tanpa perubahan nyata. */
      const key=_cloudStateKey();
      if(key===_lastPushedKey && currentUser===_lastPushedUser){
        if(_cloudSaveTimer){clearTimeout(_cloudSaveTimer);_cloudSaveTimer=null;}
        _cloudPending=false;
        return;
      }
      const rolling=(typeof rollState!=="undefined" && rollState && rollState.active);
      if(rolling && Date.now()-_cloudLastPush<CLOUD_PUSH_MIN_MS){_cloudPending=true;return;}
      if(_cloudSaveTimer)clearTimeout(_cloudSaveTimer);
      _cloudSaveTimer=setTimeout(_cloudPush, 400);
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

/* =============== AUDIO (AAA HYBRID REAL SFX + SUB-BASS POOL) =============== */
let actx=null;
function actxOf(){
  if(!actx&&(window.AudioContext||window.webkitAudioContext)){
    actx=new (window.AudioContext||window.webkitAudioContext)();
  }
  if(actx&&actx.state==='suspended'){
    actx.resume().catch(()=>{});
  }
  return actx;
}

function beep(freq,dur,type,gain){
  if(typeof state!=='undefined'&&state&&state.muted)return;
  try{
    const a=actxOf();
    if(!a)return;
    const o=a.createOscillator(),g=a.createGain();
    o.type=type||"square";o.frequency.value=freq;
    g.gain.setValueAtTime(gain||.05,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+(dur||.08));
    o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+(dur||.08));
  }catch(e){}
}

/* 50Hz Tactile Sub-Bass Thump Generator (Gives physical weight to actions) */
function playSubBass(freq=55,dur=0.18,vol=0.25){
  if(typeof state!=='undefined'&&state&&state.muted)return;
  try{
    const a=actxOf();
    if(!a)return;
    const now=a.currentTime;
    const osc=a.createOscillator();
    const gain=a.createGain();
    osc.connect(gain);
    gain.connect(a.destination);
    osc.type='sine';
    osc.frequency.setValueAtTime(freq,now);
    osc.frequency.exponentialRampToValueAtTime(25,now+dur);
    gain.gain.setValueAtTime(vol,now);
    gain.gain.exponentialRampToValueAtTime(0.001,now+dur);
    osc.start(now);
    osc.stop(now+dur);
  }catch(e){}
}

/* Real Audio Pool (Glass taps, mechanical switches, crystal jingles, whooshes) */
const _sfxClips = {
  click: 'assets/audio/sfx/interface/click_002.ogg',
  hover: 'assets/audio/sfx/interface/glass_004.ogg',
  deck: 'assets/audio/sfx/interface/drop_002.ogg',
  open: 'assets/audio/sfx/interface/maximize_008.ogg',
  close: 'assets/audio/sfx/interface/minimize_008.ogg',
  confirm: 'assets/audio/sfx/interface/confirmation_001.ogg',
  switch: 'assets/audio/sfx/interface/switch_001.ogg',
  pull: 'assets/audio/sfx/sci-fi/engineCircular_001.ogg',
  impact: 'assets/audio/sfx/sci-fi/impactMetal_001.ogg',
  jingle: 'assets/audio/sfx/jingles/jingles_PIZZI10.ogg',
  win: 'assets/audio/sfx/jingles/jingles_HIT15.ogg',
  lose: 'assets/audio/sfx/jingles/jingles_HIT07.ogg'
};

const _soundPool = {};
try {
  for(const k in _sfxClips){
    _soundPool[k] = [];
    for(let i=0; i<3; i++){
      const aud = new Audio(_sfxClips[k]);
      aud.preload = 'auto';
      _soundPool[k].push(aud);
    }
  }
} catch(e){}

function _playSfxPool(key, vol=0.75){
  if(typeof state!=='undefined'&&state&&state.muted)return;
  try{
    const src = _sfxClips[key] || _sfxClips.click;
    if(!src) return;
    const pool = _soundPool[key];
    let snd = null;
    if(pool && pool.length){
      snd = pool.find(a => a.paused && !a.error);
      if(!snd && pool[0] && !pool[0].error) snd = pool[0];
    }
    if(snd){
      snd.volume = Math.min(1, Math.max(0, vol));
      snd.currentTime = 0;
      const p = snd.play();
      if(p && typeof p.catch === 'function'){
        p.catch(() => {
          try {
            const fresh = new Audio(src);
            fresh.volume = vol;
            fresh.play().catch(()=>{});
          } catch(e){}
        });
      }
    } else {
      const fresh = new Audio(src);
      fresh.volume = vol;
      fresh.play().catch(()=>{});
    }
  }catch(e){}
}

const sfx={
  hit:()=>{
    playSubBass(60, 0.12, 0.22);
    _playSfxPool('click', 0.8);
  },
  click:()=>{
    playSubBass(60, 0.12, 0.22);
    _playSfxPool('click', 0.8);
  },
  hover:()=>{
    _playSfxPool('hover', 0.4);
  },
  crit:()=>{
    playSubBass(55, 0.25, 0.35);
    if(window.CyberSfx)window.CyberSfx.katanaFinisher();
    else _playSfxPool('confirm', 0.8);
  },
  dodge:()=>{
    if(window.CyberSfx)window.CyberSfx.matrixSpace();
    else _playSfxPool('hover', 0.5);
  },
  win:()=>{
    playSubBass(60, 0.35, 0.35);
    _playSfxPool('win', 0.85);
  },
  lose:()=>{
    _playSfxPool('lose', 0.75);
  },
  pull:()=>{
    playSubBass(45, 0.35, 0.4);
    _playSfxPool('pull', 0.75);
    setTimeout(()=>_playSfxPool('jingle', 0.8), 280);
  },
  open:()=>{
    playSubBass(65, 0.16, 0.25);
    _playSfxPool('open', 0.75);
  },
  close:()=>{
    playSubBass(50, 0.14, 0.18);
    _playSfxPool('close', 0.7);
  },
  confirm:()=>{
    playSubBass(70, 0.14, 0.22);
    _playSfxPool('confirm', 0.8);
  },
  deck:()=>{
    playSubBass(60, 0.16, 0.22);
    _playSfxPool('deck', 0.8);
  },
  switch:()=>{
    playSubBass(65, 0.12, 0.18);
    _playSfxPool('switch', 0.7);
  },
  subBass:playSubBass
};

/* Global Tactical AAA UI Audio Delegation (Capturing) */
if(typeof window!=='undefined'){
  let _lastUiHover=0;
  window.addEventListener('mouseover', (e)=>{
    if(typeof state!=='undefined'&&state&&state.muted)return;
    const t=e.target;
    if(!t)return;
    const btn=t.closest('button, .btn, .nav-tab, .cmd-btn, .hub-btn, .card-slot, .loadout-slot, .tree-node, .char-card, .fighter, .sett-btn');
    if(btn&&Date.now()-_lastUiHover>75){
      _lastUiHover=Date.now();
      _playSfxPool('hover', 0.38);
    }
  }, {passive:true, capture:true});

  window.addEventListener('click', (e)=>{
    if(typeof state!=='undefined'&&state&&state.muted)return;
    const t=e.target;
    if(!t)return;
    const btn=t.closest('button, .btn, .nav-tab, .cmd-btn, .hub-btn, .card-slot, .loadout-slot, .tree-node, .char-card, .md-btn, .close-btn, .tab-btn, .sett-btn');
    if(btn){
      playSubBass(60, 0.12, 0.22);
      _playSfxPool('click', 0.8);
    }
  }, {passive:true, capture:true});

  window.testAAA = function(){
    if(typeof state!=='undefined'&&state)state.muted=false;
    sfx.pull();
    console.log('[AAA AUDIO] Test Pull + Sub-Bass triggered!');
  };
}

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
  /* Dentuman lama dihapus sesuai revisi user */
}
/* Dentuman crit: dihapus sesuai revisi user */
function critBoom(){
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
/* =============== BACKGROUND MUSIC (BGM) SYSTEM =============== */
const BGM_SOURCES = {
  lobby: "assets/audio/bgm-lobby.mp3?v=2",
  battle: "assets/audio/bgm-battle.mp3?v=2"
};
const bgmTracks = { lobby: null, battle: null };
let bgmMode = "lobby";
let bgmInitialized = false;

function initBgm(mode = "lobby") {
  const key = mode === "battle" ? "battle" : "lobby";
  if (bgmTracks[key]) return bgmTracks[key];
  const a = new Audio(BGM_SOURCES[key]);
  a.loop = true;
  a.volume = key === "battle" ? 0.36 : 0.35;
  a.preload = "auto";
  bgmTracks[key] = a;
  return a;
}

/* Tower Infinite mempertahankan battle BGM terus menerus selama antar-lantai
   (bt.over = true / bt = null sesaat sebelum towerEnter(f+1) memulai lantai baru). */
function _isBgmBattle() {
  if (battleLive()) return true;
  try {
    if (typeof route === "function" && route() === "#/tower"
        && typeof towerView !== "undefined" && towerView === "battle"
        && typeof towerRun !== "undefined" && towerRun) {
      return true;
    }
  } catch (e) {}
  return false;
}

function playBgm(mode) {
  if (!state || state.muted || document.hidden) return;
  const target = mode === "battle" || (!mode && _isBgmBattle()) ? "battle" : "lobby";
  const other = target === "battle" ? "lobby" : "battle";
  const prevMode = bgmMode;
  bgmMode = target;

  if (bgmTracks[other] && !bgmTracks[other].paused) {
    try { bgmTracks[other].pause(); } catch (e) {}
  }

  const a = initBgm(target);
  if (target === "battle" && prevMode !== "battle") {
    try { a.currentTime = 0; } catch (e) {}
  }
  if (a.paused) {
    a.play().catch(() => {
      /* Browser autoplay block — tunggu interaksi user pertama */
    });
  }
}

function pauseBgm() {
  Object.keys(bgmTracks).forEach(k => {
    const a = bgmTracks[k];
    if (a && !a.paused) {
      try { a.pause(); } catch (e) {}
    }
  });
}

function syncBgmState() {
  if (!state) return;
  if (state.muted || document.hidden) {
    pauseBgm();
  } else if (_isBgmBattle()) {
    playBgm("battle");
  } else {
    playBgm("lobby");
  }
}

window.initBgm = initBgm;
window.playBgm = playBgm;
window.pauseBgm = pauseBgm;
window.syncBgmState = syncBgmState;
window.getBgmState = () => ({
  mode: bgmMode,
  lobbyPaused: !bgmTracks.lobby || bgmTracks.lobby.paused,
  battlePaused: !bgmTracks.battle || bgmTracks.battle.paused,
  lobbySrc: bgmTracks.lobby ? bgmTracks.lobby.src : null,
  battleSrc: bgmTracks.battle ? bgmTracks.battle.src : null
});

// User gesture unlocker untuk browser autoplay policy
function unlockBgmAutoplay() {
  if (bgmInitialized) return;
  bgmInitialized = true;
  initBgm("lobby");
  initBgm("battle");
  syncBgmState();
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    window.removeEventListener(evt, unlockBgmAutoplay, { capture: true });
  });
}
['click', 'touchstart', 'keydown'].forEach(evt => {
  window.addEventListener(evt, unlockBgmAutoplay, { capture: true, once: true });
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseBgm();
  else syncBgmState();
});

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
  if(!state) return;
  try { syncBgmState(); } catch (e) {}
  const cv=document.getElementById("coinVal");if(cv)cv.textContent=fmt(state.coins);
  const gv=document.getElementById("gemVal");if(gv)gv.textContent=fmt(state.premiumGems||0);
  const rv=document.getElementById("raidVal");if(rv)rv.textContent=fmt(state.wbTokens||0);
  const pl=document.getElementById("plvl");if(pl)pl.textContent="LVL "+state.playerLv;
  const wn=document.getElementById("whoName");if(wn)wn.textContent=currentUser||"GUEST";
  /* Profil ringkas di topbar (dipindah dari lobby). */
  if(state&&state.player){
    // Level up check: EXP per level = playerLv * 1000, naik LV setiap penuh -> +1 SP.
    while((state.player.exp||0)>=state.player.lv*1000){
      state.player.exp-=state.player.lv*1000;
      state.player.lv=(state.player.lv||0)+1;
      state.playerLv=state.player.lv;
      state.player.sp=(state.player.sp||0)+1;
    }
    /* Audit tambahan agar SP selalu konsisten dengan player.lv */
    if(typeof state.player.sp==="number"){
      let _curSpent = 0;
      if (typeof TREE_NODES !== "undefined" && Array.isArray(TREE_NODES) && state.player.tree) {
        TREE_NODES.forEach(n => { if (n && n.id !== "root" && state.player.tree[n.id]) _curSpent += (n.cost || 0); });
      }
      const _minSp = Math.max(0, (state.player.lv - 1) - _curSpent);
      if(state.player.sp < _minSp) state.player.sp = _minSp;
    }
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
    const eq=equipped(); const cid=eq&&eq.char;
    const avKey=(state&&state.customAvatar)?("c:"+state.customAvatar):(cid?("k:"+cid):"none");
    if(pav.dataset.avKey!==avKey){
    pav.dataset.avKey=avKey;
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
  }

  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.route===route()));
  try{
    const ql=document.getElementById("l12QsLuck");if(ql&&typeof fmtLobbyLuck==="function")ql.textContent=fmtLobbyLuck();
    const qs=document.getElementById("l12QsShiny");if(qs&&typeof fmtLobbyShiny==="function")qs.textContent=fmtLobbyShiny();
    const qr=document.getElementById("l12QsRolls");if(qr&&state)qr.textContent=fmt(state.totalRolls||0);
  }catch(e){}
  try{if(typeof updateProfileLiveNumbers==="function")updateProfileLiveNumbers();}catch(e){}
  try{renderWeatherDock();renderBuffDock();startWeatherTick();if(typeof l12UpdateWeatherDock==='function')l12UpdateWeatherDock(false);}catch(e){}
  try{if(typeof startGlobalLuckPoll==='function')startGlobalLuckPoll();}catch(e){}
}

/* =============== DAILY LOGIN 7-DAY (INSTANT ROLL PACK 100K) =============== */
const DAILY_PACKS_100K=[1,2,3,4,5,6,10];
const DAILY_PACKS_TOTAL=DAILY_PACKS_100K.reduce((a,b)=>a+b,0);
const DAILY_GEMS=[10,15,20,25,30,40,60];
const DAILY_GEM_TOTAL=DAILY_GEMS.reduce((a,b)=>a+b,0);
const GEM_ICON_SM='<img src="assets/images/premium-currency.webp" width="12" height="12" alt="" style="border-radius:50%;object-fit:contain">';
const DAILY_TOTAL=DAILY_REWARDS.reduce((a,b)=>a+b,0);

/* 0040: `dailyR100kBalance` localStorage mirror REMOVED.
   Daily packs are granted server-side via claim_daily_gem and synced into state.rollPacks.r100k. */

let _dlCurtainT=[];
let _dlClosing=false;
function _dlClearCurtain(){
  for(let i=0;i<_dlCurtainT.length;i++)clearTimeout(_dlCurtainT[i]);
  _dlCurtainT=[];
}
function _dlSetCurtainCopy(mode){
  const kick=document.getElementById("dlHZKick");
  const title=document.getElementById("dlHZTitle");
  const sub=document.getElementById("dlHZSub");
  const foot=document.getElementById("dlHZFoot");
  const serial=document.getElementById("dlHZSerial");
  const water=document.getElementById("dlHZWater");
  if(serial)serial.textContent=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(mode==="open"){
    if(kick)kick.innerHTML="// ATTENDANCE <b>PROTOCOL</b>";
    if(title)title.textContent="DAILY REWARDS";
    if(water)water.textContent="DAILY";
    if(sub)sub.textContent="7-DAY SUPPLY \u2014 31\u00d7 100K PACKS \u00b7 +1M COINS \u00b7 +200 GEMS";
    if(foot)foot.textContent="SYNCING LEDGER";
  }else{
    if(kick)kick.innerHTML="// SUPPLY <b>STAND BY</b>";
    if(title)title.textContent="STANDBY";
    if(water)water.textContent="LOCK";
    if(sub)sub.textContent="ATTENDANCE PROTOCOL SEALED \u2014 TIMERS SYNCED";
    if(foot)foot.textContent="RETURN TO LOBBY";
  }
}
function dlBannerOpen(){
  const c=document.getElementById("dailyCurtain");
  if(!c)return;
  _dlClearCurtain();
  _dlSetCurtainCopy("open");
  c.className="";
  void c.offsetWidth;
  c.classList.add("on","smooth","sweep");
  _dlCurtainT.push(setTimeout(()=>c.classList.add("revealed"),980));
  _dlCurtainT.push(setTimeout(()=>c.classList.remove("on","smooth","sweep","revealed"),1700));
}
function dlBannerClose(onCovered){
  const c=document.getElementById("dailyCurtain");
  if(!c){if(onCovered)onCovered();return;}
  _dlClearCurtain();
  _dlSetCurtainCopy("close");
  c.className="";
  c.classList.add("on","smooth","revealed");
  void c.offsetWidth;
  c.classList.remove("revealed");
  _dlCurtainT.push(setTimeout(()=>{if(onCovered)onCovered();},560));
  _dlCurtainT.push(setTimeout(()=>c.classList.add("revealed"),780));
  _dlCurtainT.push(setTimeout(()=>c.classList.remove("on","smooth","revealed"),1560));
}
window.dlBannerOpen=dlBannerOpen;
window.dlBannerClose=dlBannerClose;

function openBackpackFromDaily(){
  closeDaily({instant:true});
  try{
    if(typeof bpSetTab==="function")bpSetTab("item");
    const p=document.getElementById("backpackPanel");
    if(p&&!p.classList.contains("open")&&typeof toggleBackpack==="function"){
      toggleBackpack();
    }else if(typeof renderBackpackPanel==="function"){
      renderBackpackPanel();
    }
  }catch(e){}
}
window.openBackpackFromDaily=openBackpackFromDaily;

function renderDaily(){
  const ready=state.lastClaim!==todayStr();
  const idx=(typeof state.dailyIndex==="number"?state.dailyIndex:0)%7;
  const displayDayIdx=ready?idx:((idx+6)%7);
  const packIcon="assets/images/instanpack-100k.webp?v=trans1";
  const curBag=(state&&state.rollPacks&&state.rollPacks.r100k)||0;

  const pt=document.getElementById("dlProgTxt");
  if(pt)pt.textContent=`DAY ${displayDayIdx+1} / 7`;
  const bc=document.getElementById("dlBagCnt");
  if(bc)bc.textContent=`\u00d7${fmt(curBag)}`;

  const lockSvg='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const checkSvg='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>';
  const starSvg='<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15 9 22 9 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9 9 9"/></svg>';

  const grid=document.getElementById("dlGrid");
  if(grid)grid.innerHTML=DAILY_PACKS_100K.map((packCnt,i)=>{
    let stateCls="is-locked";
    if(ready){
      if(i<idx)stateCls="is-claimed";
      else if(i===idx)stateCls="is-ready";
    }else{
      if(i<=displayDayIdx)stateCls="is-claimed";
    }
    const isFinale=(i===6);
    const totalPulls=packCnt*100000;
    const pullsTxt=totalPulls>=1000000
      ?(totalPulls/1000000).toFixed(1).replace(/\.0$/,"")+"M INSTANT PULLS"
      :(totalPulls/1000)+"K PULLS";

    let badge=`<span class="dlh-st locked"><span>${lockSvg}LOCKED</span></span>`;
    if(stateCls==="is-claimed")badge=`<span class="dlh-st claimed"><span>${checkSvg}CLAIMED</span></span>`;
    else if(stateCls==="is-ready")badge=`<span class="dlh-st ready"><span>${starSvg}CLAIM!</span></span>`;

    const clickableAttr=(stateCls==="is-ready")
      ?` role="button" tabindex="0" onclick="claimDaily()" aria-label="Claim Day ${i+1} Reward"`
      :"";

    if(isFinale){
      return `<div class="dlh-tile is-finale ${stateCls}"${clickableAttr}>
        <span class="dlh-crn tl"></span><span class="dlh-crn br"></span>
        <div class="dlh-t-top">
          <div class="dlh-t-day">
            <span class="dlh-t-num"><span>7</span></span>
            <span class="dlh-t-lbl">DAY 7</span>
          </div>
          ${badge}
        </div>
        <div class="dlh-t-mid">
          <div class="dlh-name-wrap">
            <div class="dlh-name">100K ROLL PACK</div>
            <div class="dlh-pulls">GRAND FINALE CACHE</div>
          </div>
          <div class="dlh-qty">${packCnt}&times;</div>
        </div>
        <div class="dlh-showcase">
          <span class="dlh-sc-tag">GRAND FINALE</span>
          <div class="dlh-sc-art">
            <div class="dlh-sc-halo"></div>
            <div class="dlh-sc-ring"></div>
            <img src="${packIcon}" alt="10x Instant 100K Pack" onerror="this.style.display='none'">
            ${stateCls==="is-claimed"?'<span class="dlh-claimed-stamp">SECURED</span>':""}
          </div>
          <div class="dlh-sc-cap">
            <b>10&times; INSTANT 100K CACHE</b>
            <span>${fmt(totalPulls)} INSTANT PULLS</span>
          </div>
        </div>
        <div class="dlh-bonus">
          <span class="dlh-b coin">${coinIcon(11)} +${fmt(DAILY_REWARDS[i]||0)}</span>
          <span class="dlh-b gem">${GEM_ICON_SM} +${DAILY_GEMS[i]||0}</span>
        </div>
        <div class="dlh-finale-note">+2 bonus rewards included &middot; Sent straight to Backpack</div>
      </div>`;
    }

    return `<div class="dlh-tile ${stateCls}"${clickableAttr}>
      <span class="dlh-crn tl"></span><span class="dlh-crn br"></span>
      <div class="dlh-t-top">
        <div class="dlh-t-day">
          <span class="dlh-t-num"><span>${i+1}</span></span>
          <span class="dlh-t-lbl">DAY ${i+1}</span>
        </div>
        ${badge}
      </div>
      <div class="dlh-t-mid">
        <div class="dlh-name-wrap">
          <div class="dlh-name">100K ROLL PACK</div>
          <div class="dlh-pulls">${pullsTxt}</div>
        </div>
        <div class="dlh-qty">${packCnt}&times;</div>
      </div>
      <div class="dlh-art">
        <div class="dlh-art-glow"></div>
        <img src="${packIcon}" alt="${packCnt}x Instant 100K Pack" onerror="this.style.display='none'">
        ${stateCls==="is-claimed"?'<span class="dlh-claimed-stamp">CLAIMED</span>':""}
      </div>
      <div class="dlh-bonus">
        <span class="dlh-b coin">${coinIcon(10)} +${fmt(DAILY_REWARDS[i]||0)}</span>
        <span class="dlh-b gem">${GEM_ICON_SM} +${DAILY_GEMS[i]||0}</span>
      </div>
    </div>`;
  }).join("");

  const giftSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M12 8v12M3 13h18M7.5 8C6 8 5 6.8 5 5.5S6 3 7.5 3C9.5 3 12 8 12 8s2.5-5 4.5-5C18 3 19 4.2 19 5.5S18 8 16.5 8"/></svg>';
  const checkBtnSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>';
  const bagSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>';

  const foot=document.getElementById("dlFoot");
  if(foot)foot.innerHTML=`<div class="dlh-foot-row">
    ${ready
      ?`<button type="button" class="dlh-claim" id="dlClaim" aria-label="Claim Day ${idx+1} Reward">${giftSvg}<span>CLAIM</span></button>`
      :`<button type="button" class="dlh-claim" id="dlClaim" disabled aria-label="Day ${displayDayIdx+1} Claimed">${checkBtnSvg}<span>CLAIMED</span></button>`}
    <button type="button" class="dlh-bag-btn" onclick="openBackpackFromDaily()">${bagSvg}<span>BACKPACK (&times;${fmt(curBag)})</span></button>
  </div>
  <div class="dlh-total">
    <span>7-DAY CYCLE: <b>${DAILY_PACKS_TOTAL}&times; 100K PACKS</b> (${fmt(DAILY_PACKS_TOTAL*100000)} PULLS) &middot; <b>+${fmt(DAILY_TOTAL)} COINS</b> &middot; <b>+${DAILY_GEM_TOTAL} GEMS</b></span>
    <span class="haz">DELIVERED TO BACKPACK &rarr; ITEMS</span>
  </div>`;
  if(ready){
    const cb=document.getElementById("dlClaim");
    if(cb)cb.onclick=claimDaily;
  }
  if(state.dailyGemPending>0)flushPendingDailyGems(true);
  tickDaily();
}
function claimDaily(){
  if(state.lastClaim===todayStr())return;
  const idx=(typeof state.dailyIndex==="number"?state.dailyIndex:0)%7;
  const gems=DAILY_GEMS[idx]||0;
  const packQty=DAILY_PACKS_100K[idx]||1;
  /* 0040: pack TIDAK diberi di sini lagi. claim_daily_gem yang membayarnya ke
     `player_packs` (lihat flushPendingDailyGems) — angka client tidak dipercaya. */
  /* 0025: coin daily dibayar server (claim_daily_gem) — jangan ditambah lokal
     kecuali memang offline, kalau tidak push berikutnya akan mengoreksinya balik. */
  const coinsOffline=!(typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.claimDailyGem);
  if(coinsOffline)state.coins+=(DAILY_REWARDS[idx]||0);
  state.dailyGemPending=(state.dailyGemPending||0)+gems;
  state.dailyPackPending=(state.dailyPackPending||0)+packQty;
  state.lastClaim=todayStr();
  state.dailyIndex=(idx+1)%7;
  sfx.win();save();
  try{toast("DAY "+(idx+1)+" REWARD SECURED!","+"+packQty+"\u00d7 100K Pack sent to Backpack \u00b7 +"+fmt(DAILY_REWARDS[idx]||0)+" Coins \u00b7 +"+gems+" Gems","#6be08a");}catch(e){}
  renderShell();renderDaily();
  if(typeof renderLobby==="function"&&typeof route==="function"&&route()==="#/lobby"&&!battleLive()){
    try{renderLobby();}catch(e){}
  }
  if(gems)flushPendingDailyGems(false);
}
/* Gem daily dikredit lewat server (cloud-authoritative, 1x per hari UTC).
   Kalau gagal, nominal disimpan di state.dailyGemPending dan dicoba lagi
   saat modal dibuka. Nominal final = yang dibayar server (siklus 7 hari
   dihitung server, biar tidak bisa digeser lewat console). */
let _dailyGemBusy=false;
async function flushPendingDailyGems(quiet){
  if(_dailyGemBusy||!state||!(state.dailyGemPending>0))return;
  const gems=state.dailyGemPending;
  _dailyGemBusy=true;
  let res;
  try{
    const u=_gemUser();
    if(u&&window.CloudDB&&window.CloudDB.claimDailyGem) res=await window.CloudDB.claimDailyGem(u);
    else{state.premiumGems=(state.premiumGems||0)+gems;res={ok:true,gems,packs:(state.dailyPackPending||0)};}
  }catch(e){res={ok:false,msg:(e&&e.message)||"ERROR"};}
  _dailyGemBusy=false;
  if(res&&(res.ok||res.msg==="ALREADY_TODAY")){
    state.dailyGemPending=0;
    if(typeof res.day_index==="number")state.dailyIndex=res.day_index%7;
    if(typeof res.coins_balance==="number")state.coins=res.coins_balance;
    /* 0040: pack harian bayar di server. `pack_qty` = saldo final di `player_packs`,
       jadi pakai nilai itu apa adanya (bukan +=) supaya cermin client tidak pernah
       bisa lebih besar dari ledger. Offline/ guest: tidak ada ledger, pakai jatah
       lokal — akun begitu memang tidak bisa push save. */
    state.rollPacks = state.rollPacks || {r5k:0,r10k:0,r25k:0,r50k:0,r100k:0};
    if(typeof res.pack_qty==="number")state.rollPacks.r100k=Math.max(0,res.pack_qty);
    else if(res.ok&&(res.packs||0)>0)state.rollPacks.r100k=(state.rollPacks.r100k||0)+res.packs;
    if(res.ok)state.dailyPackPending=0;
    try{save();}catch(e){}
    try{renderShell();}catch(e){}
    try{if(typeof renderBackpackPanel==="function")renderBackpackPanel();}catch(e){}
    try{const dm=document.getElementById("dailyModal");if(dm&&dm.classList.contains("show"))renderDaily();}catch(e){}
    if(res.ok)try{toast("DAILY LOGIN","+"+(res.gems||gems)+" GEMS \u00b7 +"+fmt(res.coins||0)+" COINS"+((res.packs||0)>0?" \u00b7 +"+res.packs+"\u00d7 100K PACK":""),"#ffd700");}catch(e){}
  }else if(!quiet){
    try{toast("DAILY LOGIN SYNC DELAYED",(res&&res.msg)||"Will retry automatically","#fbbf24");}catch(e){}
  }
}
function openDaily(){
  _dlClosing=false;
  renderDaily();
  const m=document.getElementById("dailyModal");
  if(m)m.classList.add("show");
  document.body.classList.add("dl-open","hide-docks-modal");
  dlBannerOpen();
}
function closeDaily(opts){
  const m=document.getElementById("dailyModal");
  if(!m||!m.classList.contains("show"))return;
  if(_dlClosing&&!(opts&&opts.instant))return;
  _dlClosing=true;
  const doHide=()=>{
    _dlClosing=false;
    m.classList.remove("show");
    document.body.classList.remove("dl-open");
    const keepIds=["premiumModal","weatherMachineModal","watchAdsModal","profModal","rankModal","indexModal","traitModal","deckModal","skillModal","titlesModal"];
    const keepHide=keepIds.some(id=>{const el=document.getElementById(id);return el&&el.classList.contains("show");});
    if(!keepHide)document.body.classList.remove("hide-docks-modal");
    if(route()==="#/lobby"&&!battleLive())render();
  };
  if(opts&&opts.instant){_dlClearCurtain();const c=document.getElementById("dailyCurtain");if(c)c.className="";doHide();return;}
  try{dlBannerClose(doHide);}catch(e){doHide();}
}
document.addEventListener("keydown",function(e){
  if(e.key!=="Escape")return;
  const m=document.getElementById("dailyModal");
  if(!m||!m.classList.contains("show"))return;
  e.stopPropagation();
  e.preventDefault();
  closeDaily();
},true);
function tickDaily(){
  const ms=nextResetMs();
  const s=Math.max(0,Math.floor(ms/1000));
  const p=x=>String(x).padStart(2,"0");
  const txt=p(Math.floor(s/3600))+":"+p(Math.floor(s%3600/60))+":"+p(s%60);
  const c=document.getElementById("dlCount");if(c)c.textContent=txt;
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
addEventListener("pagehide",()=>{if(state){save();flushCloudSave();}});
/* Background AFK & Tab Resume Engine (Web Worker Heartbeat + State Recovery) */
(function initAfkHeartbeat(){
  let worker = null;
  try {
    const blob = new Blob([
      "let timer = null;\n" +
      "self.onmessage = function(e){\n" +
      "  if(e.data && e.data.type === 'start'){\n" +
      "    if(timer) clearInterval(timer);\n" +
      "    timer = setInterval(function(){ self.postMessage('tick'); }, 1000);\n" +
      "  } else if(e.data && e.data.type === 'delay'){\n" +
      "    setTimeout(function(){ self.postMessage('roll_tick'); }, Math.max(50, e.data.ms || 100));\n" +
      "  } else if(e.data && e.data.type === 'stop'){\n" +
      "    if(timer) { clearInterval(timer); timer = null; }\n" +
      "  }\n" +
      "};"
    ], { type: "application/javascript" });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = function(e){
      if(e.data === 'tick'){
        if(typeof tickDaily === "function") tickDaily();
        if(document.hidden && state){
          state.playSec = (state.playSec || 0) + 1;
        }
      } else if(e.data === 'roll_tick'){
        if(document.hidden && typeof rollState !== "undefined" && rollState && rollState.active){
          if(typeof window.forceResumeRoll === "function") window.forceResumeRoll();
        }
      }
    };
    worker.postMessage({ type: 'start' });
  } catch(err) {
    console.warn("AFK Worker fallback to timer:", err);
  }

  window.__afkHeartbeat = {
    postDelay: function(ms){
      if(worker && document.hidden){
        worker.postMessage({ type: 'delay', ms: ms });
      }
    }
  };
})();

function handleTabWakeup(){
  try{ document.body.classList.remove("perf-paused"); }catch(e){}
  /* Pastikan invisible overlay tersembunyi tidak memblokir klik */
  try{
    const ov = document.getElementById("rollOverlay");
    if(ov && ov.style.display !== "none" && typeof rollState !== "undefined" && rollState && rollState.hideOverlay){
      ov.style.display = "none";
    }
  }catch(e){}
  /* Bangunkan kembali auto roll jika tertidur/stuck di background */
  try{
    if(typeof rollState !== "undefined" && rollState && rollState.active){
      if(typeof window.forceResumeRoll === "function") window.forceResumeRoll();
    }
  }catch(e){}
}

document.addEventListener("visibilitychange",()=>{
  if(!document.hidden){
    handleTabWakeup();
  } else {
    if(state){save();flushCloudSave();}
    try{document.body.classList.add("perf-paused");}catch(e){}
  }
});
window.addEventListener("focus", handleTabWakeup);

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
    const chip=full?"✓ COMPLETE":(open?"▾ OPEN LEVEL":"🔒 LOCKED");
    return `<button class="story-banner${open?"":" lock"}${full?" full":""}${act?" active":""}" data-c="${c.no}">
      <span class="sb-no">${String(c.no).padStart(2,"0")}</span>
      ${act?'<span class="sb-tag">ACTIVE</span>':""}
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
    if(!diffUnlocked(k)){note.textContent="COMPLETE ALL CHAPTER 1 LEVELS IN MODE "+DIFFS[DIFFS.findIndex(d=>d.k===k)-1].l+" TO UNLOCK THIS MODE";sfx.lose&&sfx.lose();return;}
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
    `<div class="smh-line">GATE ${fmt(gnx)} · POWER ${fmt(pw)} <b class="${okN?"ok":"bad"}">${okN?"READY":"LOW"}</b> · PROGRES ${doneN}/${ch.levels.length}</div>`;
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
      <img class="lvl-art" src="${en.img}" alt="" decoding="async" onerror="this.remove()">
      ${cl?'<span class="chk">✓</span>':""}
      ${unlocked?`<span class="lvl-num">${i+1}</span>${en.boss?'<span class="lvl-bos">BOS</span>':""}<span class="lvl-name">${en.name}</span>`:'<span class="lvl-lock">🔒</span>'}
    </button>`;}).join("");
  document.querySelectorAll("#levels .lvl-btn:not(.locked)").forEach(x=>x.onclick=()=>openStart(+x.dataset.lv));
  /* mission modal ditutup di AKHIR — kalau build melempar error di tengah, user tetap lihat daftar bab (gak "balik ke lobby" tanpa kabar) */
  const mm=document.getElementById("missionModal");if(mm)mm.classList.remove("show");
  document.getElementById("storyModal").classList.add("show");
  }catch(err){
    console.error("openStory error",err);
    try{toast("STORY ERROR",(err&&err.message)||"failed to open story","#ff5c5c");}catch(e){}
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
  const cdLeft=first?0:storyCdLeft(lv);
  const gem=storyGemPreview(lv);
  const pss=en.id&&CARDS[en.id]?CARDS[en.id].passive:null,pw=totalPower(),g=gateOf(lv),ok=pw>=g;
  const bar=Math.max(4,Math.min(100,Math.round(pw/g*100)));
  document.getElementById("startBody").innerHTML=`
    <div class="st-hero">
      <div class="st-port${mutGlow(diffOf().mut)}"${mutEdge(diffOf().mut)}><img src="${en.img}" alt="${en.name}"></div>
      <div class="st-info">
        <div class="eyebrow" style="color:${en.boss?"var(--pink)":"var(--cyan)"}">LEVEL ${lv}${en.boss?" · BOSS":""}</div>
        <div class="st-name">${en.name}</div>
        <div class="st-ep">${en.epithet} ${diffOf().mut&&diffOf().mut!=="none"?mutChip(diffOf().mut,mutBox(diffOf().mut,"st-mut")):""}</div>
        <div class="st-stats"><span class="hp"><i>HP</i> <b>${fmtStat(es.hp)}</b></span><span class="atk"><i>ATK</i> <b>${fmtStat(es.atk)}</b></span></div>
      </div>
    </div>
    <div class="st-gate ${ok?"ok":"bad"}">
      <div class="sg-row"><span>POWER KAMU</span><b>${fmt(pw)}</b></div>
      <div class="sg-bar"><i style="width:${bar}%"></i></div>
      <div class="sg-row"><span>ENEMY GATE</span><b>${fmt(g)}</b></div>
    </div>
    ${pss?`<div class="st-trait"><b>PASSIVE · ${pss.name}</b> ${pss.desc}</div>`:""}
    <div class="st-reward"><span class="st-rw-label">${first?"FIRST CLEAR":"REPLAY (20%)"} · ${diffOf().l} ×${diffOf().rw||1}</span><span class="st-rw-gold">◎ ${fmt(reward)} gold</span></div>
    ${gem?`<div class="st-reward st-reward-gem"><span class="st-rw-label">${first?"GEM FIRST CLEAR":"GEM REPLAY"} ${first?"":"· READY AGAIN "+storyCdText(cdLeft)}</span><span class="st-rw-gem"><img src="assets/images/premium-currency.webp" alt="" width="16" height="16">+${fmt(gem)} GEM</span></div>`:""}
    <div class="st-cd" id="stCd" style="display:${cdLeft>0?"block":"none"}">${cdLeft>0?"REPLAY TERKUNCI · COOLDOWN "+storyCdText(cdLeft):""}</div>
    <div class="st-btns">
      <button class="st-cancel" id="stCancel">BATAL</button>
      <button class="st-go${ok?"":" weak"}" id="stGo" data-cd-repeat="${cdLeft>0?1:0}"${cdLeft>0?" disabled":""}>${cdLeft>0?"⏱ COOLDOWN "+storyCdText(cdLeft):(ok?"⚔ &nbsp;MULAI BATTLE":"⚠ &nbsp;NOT ENOUGH POWER — ENTER")}</button>
    </div>`;
  document.getElementById("startModal").classList.add("show");
  document.getElementById("stCancel").onclick=closeStart;
  document.getElementById("stGo").onclick=()=>{startStoryBattle(startLv);};
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
    let foeAtk=0, foeHp=0, stageCode="BATTLE";

    if(state.battle&&state.battle.level!==undefined&&typeof enemyOf==="function"){
      const lv=state.battle.level;
      const en=enemyOf(lv);
      stageCode="STAGE "+lv;
      if(en){
        foeName=en.name||("STAGE "+lv);
        foeImg=en.img||"";
        foeTier=en.tier||(en.boss?"BOSS":"SR");
        isBoss=!!en.boss;
        subText=isBoss?"BOSS ENCOUNTER":"SECTOR CLEARANCE";
      }
      if(typeof enemyStats==="function"){
        const es=enemyStats(lv);
        foeAtk=es.atk||0;
        foeHp=es.hp||0;
      }
    }else if(typeof raid!=="undefined"&&raid&&raid.boss){
      foeName=raid.boss.name||"RAID BOSS";
      foeImg=raid.boss.img||"";
      foeTier="RAID";
      isBoss=true;
      subText="SECTOR THREAT LEVEL: MAXIMUM";
      foeAtk=999999;
      foeHp=raid.boss.hp||0;
      stageCode="RAID BOSS";
    }else if(typeof towerRun!=="undefined"&&towerRun&&towerRun.waves&&towerRun.waves[towerRun.idx]){
      const w=towerRun.waves[towerRun.idx];
      foeName=w.en?w.en.name:"TOWER GUARDIAN";
      foeImg=w.en?w.en.img:"";
      foeTier="FLOOR "+(towerRun.idx+1);
      subText="INFINITE SPIRE ANOMALY";
      if(w.es){
        foeAtk=w.es.atk||0;
        foeHp=w.es.hp||0;
      }
      stageCode="FLOOR "+(towerRun.idx+1);
    }

    const pSt = (eq && typeof cardStats==="function") ? cardStats(eq.char, eq.mut, eq.trait, eq.shiny) : {atk:0, hp:0};
    const fk = typeof fmtBattleK === "function" ? fmtBattleK : (typeof fmtStat === "function" ? fmtStat : String);

    const scEl=document.getElementById("bioStageCode");
    if(scEl) scEl.textContent=stageCode;

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
        pTier.style.display="none";
      }
      if(pSub)pSub.textContent=`ATK ${fk(pSt.atk)} · HP ${fk(pSt.hp)}`;
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
      fRole.className="entry-tag bio-badge-tag bio-badge-foe bio-badge-side foe"+(isBoss?" boss":"");
    }
    if(fSub)fSub.textContent=`ATK ${fk(foeAtk)} · HP ${fk(foeHp)}`;

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

