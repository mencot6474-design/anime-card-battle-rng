/* Kuota partikel = 0 (semua jumlah partikel FX dipadamkan). Bukan "30% lebih sedikit":
   FXQ() sengaja mengembalikan 0 supaya battle tetap lancar di HP kentang — keputusan user
   2026-10-30, jangan dihidupkan tanpa perintah. */
function FXQ(n){return 0;}
/* Resolusi canvas FX = 1x: overlay glow tak butuh DPR penuh (HP kentang). */
function FXDPR(){return 1;}
const CARDS=Object.fromEntries(MASTER_CARD_INDEX.map(c=>[c.char_id,c]));
function getCardData(id){return CARDS[id]||null;}
/* ===== GATE KARTU BOSS (TOKO RAID + TOKO INF) =====
   raidBoss:true -> terkunci sampai dibeli di Toko Raid (state.raidShopOwned).
   towerBoss:true -> terkunci sampai dibeli di Toko INF Tower (state.towerShopOwned).
   Salah satu flag true -> TIDAK bisa di-roll sebelum unlock; PERMANEN terbuka sesudahnya.
   Fallback: sudah punya stack kartunya (mis. save lama / grant GM). */
function bossRollUnlocked(charId){
  if(state&&state.raidShopOwned&&state.raidShopOwned[charId])return true;
  if(state&&state.towerShopOwned&&state.towerShopOwned[charId])return true;
  return !!(state&&state.stacks||[]).some(s=>s.char===charId);
}
/* Pool roll gacha BERSAMA (rngRoll + instantRollFast): buang noGacha, gate weather, gate boss. */
function gachaPool(){
  const aw=activeWeatherId();
  return MASTER_CARD_INDEX.filter(c=>!c.noGacha&&(!(c.raidBoss||c.towerBoss)||bossRollUnlocked(c.char_id))&&(!c.weatherOnly||c.weatherOnly===aw));
}
function cardImg(id){const c=CARDS[id];return c?c.sprite_asset:"";}
/* Thumbnail ringan untuk tile kecil (index, backpack, picker, dock). Art penuh tetap
   dipakai di battle/popup detail. Semua thumb dihasilkan tools/gen-thumbs.py. */
function thumbSrc(src){
  if(!src)return "";
  const m=/^assets\/(cards\/art|pets|artifacts|images)\/([^/?#]+)\.(?:png|webp|jpe?g)$/i.exec(src);
  if(!m)return src;
  const dir=m[1]==="cards/art"?"cards/thumb":m[1]+"/thumb";
  return "assets/"+dir+"/"+m[2]+".webp";
}
function cardThumb(id){const c=CARDS[id];return c?thumbSrc(c.sprite_asset):"";}
/* Kartu full-art: gambar sudah membawa border/frame sendiri, dirender 2:3 tanpa chrome UI. */
function isFullArt(id){const c=CARDS[id];return !!(c&&c.fullArt);}
function cardName(id){const c=CARDS[id];return c?c.name:"(kartu hilang)";}
function cardType(id){const c=CARDS[id];return c?c.type:"";}
function cardTier(id){const c=CARDS[id];return c?c.tier:"";}
/* KONVENSI JURUS: semua efek serangan digambar di satu canvas bersama
   (anime-archetype-attacks.js: registerFrame) — TIDAK ada layer background video/gambar
   di belakang kartu. FX tidak bercabang per tier. Nambah FX kartu baru:
   daftarkan frame-nya di sana, partikel lewat FXQ, canvas resolusi 1x (FXDPR). */
function passiveName(id){const c=CARDS[id];return c?c.passive.name:"";}
document.addEventListener("error",e=>{
  const t=e.target;
  if(t.tagName==="IMG"&&!t.dataset.ph&&((t.getAttribute("src")||"").indexOf("assets/sprites")===0)&&!/\.(mp4|webm|m4v|mov)(\?|$)/i.test(t.getAttribute("src")||"")){
    t.dataset.ph="1";t.src="assets/sprites/_placeholder.svg";
  }
},true);
/* Kartu EX Jin-Woo pakai art video (.mp4). Observer ini naikkin <img> ber-src video jadi <video>
   yang muter otomatis, dengan mewarisi ukuran/object-fit/radius yang tadi dikasih CSS ke <img>,
   jadi ga perlu nyentuh template/CSS kartu lainnya. */
const ART_VIDEO=/\.(mp4|webm|m4v|mov)(\?.*)?$/i;
function upgradeArtVideo(img){
  if(!img||img.tagName!=="IMG")return;
  const s=img.getAttribute("src")||"";
  if(!ART_VIDEO.test(s)||img.dataset.vdone)return;
  img.dataset.vdone="1";img.dataset.ph="1";
  const cs=getComputedStyle(img);
  const p=img.parentNode;
  if(!p){img.remove&&img.remove();return;}
  /* Ukuran JANGAN disalin inline. CSS penentu ukuran kartu menargetkan <img>, jadi tiap aturan
     itu ikut menargetkan <video> (selector "img,video"). Bekuan px bikin banner flex kepotong,
     persen bikin kartu EX lebih tinggi dari kartu lain di grid yang tinggi kotaknya auto. */
  const v=document.createElement("video");
  v.src=s;
  v.autoplay=true;v.muted=true;v.loop=true;v.playsInline=true;v.setAttribute("playsinline","");v.setAttribute("muted","");v.preload="auto";v.disablePictureInPicture=true;
  v.alt=img.alt||"";
  if(img.className)v.className=img.className;
  v.style.cssText="position:"+cs.position+";inset:"+cs.inset+";z-index:"+cs.zIndex+";object-fit:"+(cs.objectFit||"cover")+";object-position:"+cs.objectPosition+";border-radius:"+cs.borderRadius+";display:"+cs.display+";flex:"+cs.flex+";background:"+cs.background+";"+(img.getAttribute("style")||"");
  p.replaceChild(v,img);
  const pr=v.play&&v.play();if(pr&&pr.catch)pr.catch(()=>{});
}
(function(){
  const scan=el=>{if(!el||el.nodeType!==1)return;if(el.matches&&el.matches('img[src]'))upgradeArtVideo(el);if(el.querySelectorAll)el.querySelectorAll('img[src]').forEach(upgradeArtVideo);};
  window.videoBoot=()=>{
    const obs=new MutationObserver(muts=>{for(const m of muts){if(m.type==="attributes"){if(m.target&&m.target.matches&&m.target.matches('img'))upgradeArtVideo(m.target);continue;}m.addedNodes.forEach(scan);}});
    obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});
    scan(document.body);
  }
})();
/* Mekanik battle per passive (angka), dipisah dari data index untuk step() */
const PASSIVE_FX=Object.fromEntries(STORY_BIBLE.units.map(u=>[u.id,u.fx]));
/* ===== VALIDATOR PASSIVE =====
   FX_KNOWN = keyword fx yang BENERAN diimplement battle engine (single source of truth).
   validateFx() jalan pas boot: keyword di luar daftar = PASSIVE ZONK (desc tampil, efek nol) -> console.warn, bukan diam-diam.
   Nambah keyword baru? Daftarkan ke array INI SETELAH implementasi di kode battle. */

    /* ===== FX BARU — BATCH 22 KARTU NORMAL (asset card normal) =====
       regen:{pct,stopBelow} -> (BLOODMOON DEMON) pulih pct% max HP tiap giliran SEBELUM cek stun (pola heavyRain); berhenti selama HP < stopBelow% max.
       counterHit:{chance,pct,base} -> (DRAGON SIN base:"atk" / BLOODMOON base:"foeMaxHp") enemyPhase: kena serangan -> roll chance% -> musuh rugi FLAT pct% dari ATK kartu ini atau MAX HP penyerang. Sisi pemain.
       stunPunch:{every,chance,turns,atkPct,max} -> (LUCK VOLTIA) serangan kena -> punchCount++; ke-every -> roll chance% stun (guard statusImmune); stun sukses -> stunGain++ (cap max) + atkBuff+=atkPct permanen.
       eightGates:{atkPct,max,selfPct} -> (GREEN BEAST) serangan kena -> gateCount++ (cap max) -> atkBuff+=atkPct; gerbang penuh -> rugi selfPct% max HP; tumbang -> gateKill (mati di akhir giliran, pola dsState).
       deathHex:{turns,atkCut} -> (ICE REAPER) trySave saat BENERAN tumbang: musuh freeze turns (eStun+freezeLeft, guard statusImmune) + ePoison+=atkCut (cap 90).
       meteorShower:{pct,every} -> (CRIMSON WARLORD) entry + tiap every giliran (state msLast[]): aoe flat pct% MAX HP musuh (BOSS NPC kebal) + cadangan menara per-wave. Helper aoeMaxHpFire/armShotFx.
       splash:{pct} -> (LIGHTBORNE ADMIRAL) serangan kena -> flat pct% ATK ke lineup BERIKUTNYA (lineupNextHit) / musuh aktif lagi (story).
       partyDmg:{pct} -> (NOBLE COMPANION) startBattle fx0 + startTowerBattle tfx: SEMUA fighter party atkBuff+=pct sekali per battle.
       statGrow:{pct} -> (SOLAR BRAWLER / ANT KING) tiap giliran sebelum cek stun: pMax & pHp naik pct% + atkBuff+=pct (compound).
       reversal:1 -> (TIME MASTER) serangan mematikan PERTAMA dibalik jadi 1 HP (sekali per battle).
       causality:{atkPct} -> (ASTRAL DEVOURER) fatal -> pHp = hp awal giliran SEBELUMNYA (snapshot causalPrev/causalNow) + atkBuff+=atkPct (sekali).
       eraseOnEntry:1 -> (OMNI SOVEREIGN) entry: total stat (hp+atk) musuh < milik kartu ini -> eHp=0 instan (pola executeOnEntry).
       quake:{pct} -> (TREMOR EMPEROR) entry: aoe flat pct% MAX HP ke SEMUA kartu musuh (boss TETAP kena).
       shockAll:{pct} -> (TREMOR EMPEROR) serangan kena -> flat pct% ATK ke seluruh lineup musuh (lineupAoeHit / aktif di story).
       deathStay:1 -> (TREMOR EMPEROR) fatal -> bertahan 1 giliran extra (pHp=1, defyHold), jatuh di awal enemyPhase berikutnya (pola deathDefy tanpa syarat HP).
       EKSTENSI: double OBJEK {chance,pct} -> hit tambahan x(pct/100) (angka lama tetap). everyNth.next/next all -> hit ke-N ikut flat next% ATK. dodgeAtk.nextOnly -> dodge kasih +pct% damage SATU serangan berikutnya (dodgeNext[]). revive.atkPct -> bangkit +atkPct% ATK. copy:{turns:N} -> ability lawan disalin N giliran (copyLeft tick tiap enemyPhase; resolveFx di-gate). gluttony.healPct / gluttony.noCopy. lowHpAura tanpa burn = aman (guard). */

const FX_KNOWN=["double","crit","pierce","barrage","evasion","lifesteal","void","highHpDmg","lowHpAtk",
  "revive","dmgMult","ignoreDef","purple","domain","ranton","dodgeAtk","everySecond","lastStand",
  "styleSwitching","burst","hpDrain","lifetime","entryCounter","dodgeEvery","everyNth","lowHpAura",
  "executeOnEntry","transform","wallTitans","rumbling","bungeeGum","snatch","arise","prideOfPrince",
  "regression","copy","entryShatter","entryMaxHp","turnMaxHp","splitDeath","deathDefy","openingHit","burn","desperateStrike","statusImmune","iceBlast","psychicBarrier","entryAtkPct","sleepStrike","entryFreeze","iceShell","heavyRain","shockwave","timeStop","killHeal","tripleHit","flood","puppetPoison","puppetBody","sandBurial","autoBlock","unlimitedVoid","dimensionShift","gluttony","seriousPunch","meteorWave","overheat","freezeTransfer","foeEntryFreeze","hitFreeze","berserker","stripAbility","valhalla","dmgCut","inkCorrupt","inkDrain","dupEntry","maxCorrupt","worldCorrupt","deathRear","grieferAtk","senzu","stretch","havocRocket","getExcited","rewind","turret","worldEnder","psychicBarrage","rubberField","bajrangGun","regen","counterHit","stunPunch","eightGates","deathHex","meteorShower","splash","partyDmg","statGrow","reversal","causality","eraseOnEntry","quake","shockAll","deathStay","shadowArmy"];
function validateFx(){const bad=[];(STORY_BIBLE.units||[]).forEach(u=>{const fx=u.fx||{},ks=Object.keys(fx);
  ks.forEach(k=>{if(!FX_KNOWN.includes(k))bad.push(u.id+" :: fx."+k+" TIDAK DIKENAL -> passive TIDAK AKAN JALAN di battle");});
  if((u.desc||"").trim()&&!ks.length)bad.push(u.id+" :: desc ada tapi fx kosong -> murni teks");});
  if(bad.length)console.warn("[FX VALIDATOR] PASSIVE BERMASALAH:\n"+bad.join("\n"));
  else console.log("[FX VALIDATOR] OK - "+STORY_BIBLE.units.length+" unit, "+FX_KNOWN.length+" keyword");
  return bad;}
validateFx();


const FOES=Object.fromEntries(STORY_BIBLE.levels.map((l,i)=>{
  const c=CARDS[l.unit];
  return [i+1,{id:l.unit,name:c?c.name:"(kartu hilang)",ep:c?c.passive.name:"",img:c?c.sprite_asset:"",tier:c?c.tier:"",boss:!!l.boss}];
}));
/* Sistem level kartu DIHAPUS — stat kartu tetap (base x mutasi x trait). */
/* Sistem MUTASI gacha — tiap varian adalah outcome roll sendiri; kelangkaannya = kelangkaan kartu dasar × pengali stat-nya */
const SHINY_MULT=5; // SHINY = stat dikali 5, DIKALIKAN di atas multiplier mutasi (mis. shiny+gold = 5*10 = 50)
const BASE_CRIT={chance:10,mult:1.5}; // crit global TERSEMBUNYI: semua kartu punya peluang dasar ini; kartu bertait crit tetap pakai trait-nya
const MUT_MULT={none:1,gold:10,rainbow:25,secret:50,ultima:100};
/* ==== CHANCE MULTIPLIER (terpisah dari STAT) ====
   Digunakan HANYA untuk peluang roll (effChance / rngRoll / rollCommonScale).
   STAT (cardStats, tooltip, panel) masih pakai SHINY_MULT / MUT_MULT di atas.
   Shiny dan mutasi stacked perkalian (mis. shiny+gold = 50×100 = ×5000). */
const SHINY_CHANCE_MULT=50; // dasar 1 in 100 → shiny 1 in 5000
const MUT_CHANCE_MULT={none:1,gold:100,rainbow:10000,secret:1000000,ultima:100000000}; // gold ×100, rainbow ×10000, secret ×1000000, ultima ×100000000
const MUT_LABEL={none:"",gold:"GOLD",rainbow:"RAINBOW",secret:"SECRET",ultima:"ULTIMA"};
const MUT_COLOR={gold:"#E0BC6E",rainbow:"#B58CFF",secret:"#A855F7",ultima:"#FF0055"};
const MUT_LETTERS={gold:["#F6DFA6","#C99A45"],rainbow:["#FF6B81","#FFB347","#FFE66D","#6BE08A","#B9C2CC","#B98CFF","#FF6BD6"],secret:["#C084FC","#A855F7","#E9D5FF","#9333EA","#FFFFFF","#C084FC"],ultima:["#FF0055","#FF3366","#FF88AA","#FFFFFF","#FF0055","#FFAA00"]};
function mutText(mut,text){if(!mut||mut==='none'||!MUT_LABEL[mut])return text;const cols=MUT_LETTERS[mut]||[MUT_COLOR[mut]];return text.split("").map((ch,i)=>ch===' '?ch:`<span style="color:${cols[i%cols.length]}">${ch}</span>`).join("");}
function shinyName(tag,base,shine,mut,shiny,name){
  const esc=String(name).replace(/"/g,'&quot;');
  if(!shiny){const st=(mut&&mut!=='none')?` style="color:${MUT_COLOR[mut]}"`:'';return `<${tag} class="${base}"${st}>${mutText(mut,name)}</${tag}>`;}
  if(mut==='rainbow'||mut==='secret'||mut==='ultima'){return `<${tag} class="${base} shiny-gloss" data-text="${esc}">${mutText(mut,name)}</${tag}>`;}
  const st=(mut==='gold')?` style="--sh-base:${MUT_COLOR.gold}"`:'';
  return `<${tag} class="${base} ${shine}"${st}>${name}</${tag}>`;
}
function mutBadge(mut){
  const label=MUT_LABEL[mut];if(!label)return "";
  return mutText(mut,label);
}
const shinyCls=s=>s&&s.shiny?" shiny":"";
/* Hadiah login harian 7 hari (coin) — total 950.000, reset tiap 00:00 */
const DAILY_REWARDS=[30000,50000,70000,100000,150000,200000,400000];

/* ========== DIFFICULTY LEVELS ==========
   rw = pengali hadiah coin story per difficulty (sama pola dgn RAID_DIFFS),
   dipakai firstClearReward(). Tanpa rw, semua diff bayar ×1 (bug lama). */
const DIFFS=[
  {k:"normal",l:"NORMAL",mut:"none",rw:1},
  {k:"hard",l:"HARD",mut:"gold",rw:1.5},
  {k:"extreme",l:"EXTREME",mut:"rainbow",rw:2.2},
  {k:"nightmare",l:"NIGHTMARE",mut:"secret",rw:3},
  {k:"apocalypse",l:"APOCALYPSE",mut:"ultima",rw:4.5}
];
/* ========== WORLD BOSS — SATU boss, tanpa tier ==========
   Pool HP harian global = 10B (harus sama dengan world_boss_pool_size() di server).
   Damage yang dikirim ke server = damage kartu APA ADANYA (tanpa pengali), jadi
   plafon server (_wb_dmg_cap) bisa membandingkan langsung dengan stat kartu. */
const WB_POOL_HP=10000000000;
const RAID_DIFFS=[
  {k:"world",l:"WORLD",hp:1,atk:1,rw:1,color:"#7DF9FF"}
];
/* ========== BOSS RAID (konstanta + helper) ========== */
const RAID_BOSSES=[
  {id:"RAID_ETERNAL_DRAGON",name:"Eternal Dragon",tier:"EX",skill:"Galaxy Roar",hp:WB_POOL_HP,atk:15000,power:15000,img:"assets/cards/art/eternal-dragon.webp",banner:"assets/raid/raid-banner-hd.webp",fx:{purple:{chance:100,mult:1}}},
  /* Boss kedua: pool & papan terpisah (world_boss_b). */
  {id:"RAID_SHADOW_KING",name:"Shadow King",tier:"EX",skill:"Umbra Eclipse",hp:WB_POOL_HP,atk:16500,power:16500,img:"assets/cards/art/shadow-king.webp",banner:"assets/raid/raid-banner-hd.webp",fx:{purple:{chance:100,mult:1}}}
];
const RAID_TURNS=10;
function raidDiffOf(){return RAID_DIFFS[0];}
function raidBossOf(diff){
  const d=diff||raidDiffOf();
  /* Ikut boss yang sedang dipilih di hub (WB_BOSSES dari raid.js); fallback boss 0. */
  let b=RAID_BOSSES[0];
  if(typeof WB_BOSSES!=="undefined"&&typeof wbBossIdx==="number"&&WB_BOSSES[wbBossIdx]){
    b=RAID_BOSSES.find(x=>x.id===WB_BOSSES[wbBossIdx].id)||RAID_BOSSES[0];
  }
  return Object.assign({},b,{hp:Math.round(b.hp*d.hp),atk:Math.round(b.atk*d.atk),power:Math.round(b.power*d.hp),rw:d.rw,diffKey:d.k,diffLabel:d.l,diffColor:d.color});
}
function raidDiffUnlocked(k){return true;}
function raidNextUnlock(k){return null;}

/* ========== TRAIT SYSTEM ========== */
const TRAIT_TIERS=[
  {k:"none",name:"NONE",rar:"N/A",atk:1,hp:1,chance:0,fx:{},color:"#9A8A8B"},
  {k:"common",name:"COMMON",rar:"C",atk:1.10,hp:1,chance:55,fx:{},color:"#9A8A8B"},
  {k:"rare",name:"RARE",rar:"R",atk:1.10,hp:1.10,chance:30,fx:{},color:"#6EAC4C"},
  {k:"legendary",name:"LEGENDARY",rar:"SR",atk:1.25,hp:1,chance:12,fx:{},color:"#2F8FE2"},
  {k:"superior",name:"SUPERIOR",rar:"SSR",atk:1.50,hp:1.25,chance:2.5,fx:{},color:"#B58CFF"},
  {k:"transiden",name:"TRANSIDEN",rar:"UR",atk:2.00,hp:1.50,chance:0.486,fx:{},color:"#F6DFA6"},
  {k:"demigod",name:"DEMI-GOD",rar:"EX",atk:3.00,hp:1.50,chance:0.01,fx:{},color:"#FF4D5E"},
  {k:"cosmic",name:"COSMIC",rar:"COS",atk:3.50,hp:3.50,chance:0.003,fx:{},color:"#E56BFF"},
  {k:"bigbang",name:"BIGBANG",rar:"BB",atk:5.00,hp:4.00,chance:0.001,fx:{},color:"#7DF9FF"}
];

const TRAIT=Object.fromEntries(TRAIT_TIERS.map(t=>[t.k,t]));
const TRAIT_ATK=Object.fromEntries(TRAIT_TIERS.map(t=>[t.k,t.atk]));TRAIT_ATK.none=1;
const TRAIT_HP=Object.fromEntries(TRAIT_TIERS.map(t=>[t.k,t.hp]));TRAIT_HP.none=1;
const TRAIT_CHANCE=Object.fromEntries(TRAIT_TIERS.map(t=>[t.k,t.chance]));
const TRAIT_FX=Object.fromEntries(TRAIT_TIERS.map(t=>[t.k,t.fx]));
const TRAIT_COLOR=Object.fromEntries(TRAIT_TIERS.map(t=>[t.k,t.color]));TRAIT_COLOR.none="#9A8A8B";
const TRAIT_COST=500;
const TRAIT_TOTAL=TRAIT_TIERS.reduce((a,t)=>a+(t.chance||0),0);
function rollTraitPick(){let r=Math.random()*TRAIT_TOTAL;for(const t of TRAIT_TIERS){if(!t.chance)continue;r-=t.chance;if(r<=0)return t.k;}return "common";}
function traitLabel(k){const t=TRAIT[k];return t?t.name.toUpperCase():"";}
function traitFxList(k){const t=TRAIT[k];if(!t)return"";const e=[];if(t.fx.pierce)e.push(`+${t.fx.pierce}% tembus defense`);if(t.fx.crit)e.push(`${t.fx.crit.chance}% peluang crit ×${t.fx.crit.mult}`);if(t.fx.lifesteal)e.push(`serap ${t.fx.lifesteal}% damage jadi HP`);if(t.fx.evasion)e.push(`${t.fx.evasion.chance}% peluang hindari serangan`);if(t.fx.double)e.push(`${t.fx.double}% peluang serang dua kali`);return e.length?e.join(" · "):"Tidak ada efek khusus — hanya menaikkan ATK & HP.";}
/* ===== Ikon & Badge Produksi — Locked Hazard Studio Preset =====
   Trait Set A (Common..Demi-God) + Set C (Cosmic/BigBang) di viewBox 0 0 48 48.
   Mutation & SHINY icons di viewBox 0 0 24 24. Semua card badge = SOLID STAMP ICON ONLY. */
const TRAIT_ICON_VB="0 0 48 48";
const TRAIT_ICONS={
  common:`<path class="gem-body" d="M24 4 36 14v20L24 44 12 34V14Z"/><path class="gem-cut" d="M24 10 30 16v15l-6 6-1.5-2V15Z"/>`,
  rare:`<path class="gem-body" d="M24 3 34 17 24 44 14 17Z"/><path class="gem-body" d="M11 21 5 29l9 11Zm26 0 6 8-9 11Z"/><path class="gem-cut" d="M24 11 28 19l-4 14-4-14Z"/>`,
  legendary:`<path class="gem-body" d="M24 3 31 19l-7 21-7-21Z"/><path class="gem-body" d="M9 13 17 24l-3 14-8-10Zm30 0-8 11 3 14 8-10Z"/><path class="gem-body" d="M12 40h24l-4 5H16Z"/><path class="gem-cut" d="M24 11 26.5 19 24 31l-2.5-12Z"/>`,
  superior:`<path class="gem-body" d="M24 2 30 18 46 24 30 30 24 46 18 30 2 24 18 18Z"/><path class="gem-body" d="M10 10 19 15 15 19Zm28 0-9 5 4 4Zm0 28-9-5 4-4Zm-28 0 9-5-4-4Z"/><path class="gem-cut" d="M24 15 31 24 24 33 17 24Z"/><path class="gem-body" d="M24 19.5 27.5 24 24 28.5 20.5 24Z"/>`,
  transiden:`<path class="gem-body" d="M24 4a9.5 3.5 0 1 1 0 7 9.5 3.5 0 0 1 0-7Zm0 2a5.8 1.7 0 1 0 0 3.4A5.8 1.7 0 0 0 24 6Z"/><path class="gem-body" d="M24 13 30 25l-6 18-6-18Z"/><path class="gem-body" d="M18 19 4 11l3 11 9 4Zm12 0 14-8-3 11-9 4Z"/><path class="gem-body" d="M17 28 6 24l3 8 8 3Zm14 0 11-4-3 8-8 3Z"/>`,
  demigod:`<path class="gem-body" d="M6 5c1 10 4 17 10 21l2-5c-3-4-5-9-5-14Zm36 0c-1 10-4 17-10 21l-2-5c3-4 5-9 5-14Z"/><path class="gem-body" d="M24 7 32 23 24 44 16 23Z"/><path class="gem-body" d="M12 29 4 27l10 11 4-3Zm24 0 8-2-10 11-4-3Z"/><path class="gem-cut" d="M24 16 27.5 24 24 33 20.5 24Z"/>`,
  cosmic:`<circle class="gem-body" cx="24" cy="24" r="6.5"/><path class="gem-body" d="M24 7c9 0 16 5.5 17 13-3-5-9-8-16-8-4 0-8 1.5-11 4 2-5.5 5.5-9 10-9ZM24 41c-9 0-16-5.5-17-13 3 5 9 8 16 8 4 0 8-1.5 11-4-2 5.5-5.5 9-10 9Z"/><circle class="gem-body" cx="39" cy="35" r="2.8"/><circle class="gem-body" cx="9" cy="13" r="2.4"/>`,
  bigbang:`<path class="gem-body" d="M24 9a15 15 0 0 1 11.8 5.8l-3 2.5A11 11 0 0 0 24 13a11 11 0 0 0-8.8 4.3l-3-2.5A15 15 0 0 1 24 9ZM24 39a15 15 0 0 1-11.8-5.8l3-2.5A11 11 0 0 0 24 35a11 11 0 0 0 8.8-4.3l3 2.5A15 15 0 0 1 24 39Z"/><path class="gem-body" d="M24 1.5 28.2 19 46.5 24 28.2 29 24 46.5 19.8 29 1.5 24 19.8 19Z"/><path class="gem-cut" d="M24 18.5 29.5 24 24 29.5 18.5 24Z"/>`
};
const TRAIT_HOT=new Set(["transiden","demigod","cosmic","bigbang"]);
function traitGem(sz,k,cls){const e=k&&TRAIT_ICONS[k];const icon=e||`<path class="gem-body" d="M15 6h18l9 11-18 25L6 17z"/><path class="gem-cut" d="M16 14h16l5 4-13 18-13-18Z"/>`;const vb=e?TRAIT_ICON_VB:"0 0 48 48";const hot=k&&TRAIT_HOT.has(k)?" tg-hot":"";return `<svg class="tgem${hot}${cls?" "+cls:""}" viewBox="${vb}" width="${sz}" height="${sz}" aria-hidden="true">${icon}</svg>`;}

const MUT_ICON_VB="0 0 24 24";
const MUT_ICONS={
  shiny:`<path fill="currentColor" d="M12 1.5 14.7 9.3 22.5 12l-7.8 2.7L12 22.5 9.3 14.7 1.5 12l7.8-2.7Z"/><path fill="#050505" fill-opacity=".38" d="M12 7.2 13.4 10.6 16.8 12l-3.4 1.4L12 16.8l-1.4-3.4L7.2 12l3.4-1.4Z"/><circle cx="19" cy="5" r="1.4" fill="currentColor"/><circle cx="5" cy="19" r="1.1" fill="currentColor"/>`,
  gold:`<path fill="currentColor" d="M3 18h18v2.5H3V18Zm0-2L1.8 7.2l5.4 3.6L12 4l4.8 6.8 5.4-3.6L21 16H3Z"/><path fill="#050505" fill-opacity=".5" d="m12 9.6 2 2.9-2 2-2-2 2-2.9Z"/>`,
  rainbow:`<path fill="#FF6B81" d="M2 18A10 10 0 0 1 22 18h-2.5A7.5 7.5 0 0 0 4.5 18Z"/><path fill="#FFE66D" d="M5 18A7 7 0 0 1 19 18h-2.4A4.6 4.6 0 0 0 7.4 18Z"/><path fill="#6BE08A" d="M8 18A4 4 0 0 1 16 18h-2.2a1.8 1.8 0 0 0-3.6 0Z"/><polygon points="12,4 13.7,8.3 18,10 13.7,11.7 12,16 10.3,11.7 6,10 10.3,8.3" fill="#22D3EE"/><circle cx="12" cy="10" r="1.5" fill="#ffffff"/>`,
  secret:`<path fill="currentColor" d="M1.5 12S5.8 5.2 12 5.2 22.5 12 22.5 12 18.2 18.8 12 18.8 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="4.2" fill="#050505"/><path fill="#e9d5ff" d="M12 8.4 13.3 12 12 15.6 10.7 12Z"/><path fill="currentColor" d="M9.5 3.6 12 1.8l2.5 1.8-2.5-.6ZM9.5 20.4 12 22.2l2.5-1.8-2.5.6Z"/>`,
  ultima:`<path fill="currentColor" d="M3 4.5 8.5 10 12 2l3.5 8L21 4.5 19.5 15 12 22.5 4.5 15 3 4.5Z"/><path fill="#050505" d="M12 7.5 15.5 13 12 18.5 8.5 13 12 7.5Z"/><path fill="#ffaa00" d="M12 9.8 13.8 13 12 16.2 10.2 13Z"/>`
};
function mutIconSvg(k,sz=11){
  const paths=MUT_ICONS[k];if(!paths)return "";
  return `<svg class="mb-ic" viewBox="${MUT_ICON_VB}" width="${sz}" height="${sz}" aria-hidden="true">${paths}</svg>`;
}
function shinyStampHtml(micro=true,extraCls=""){
  const cls=`xbadge st-solid v-shiny${micro?" is-micro":""}${extraCls?" "+extraCls:""}`;
  const lbl=micro?"":`<span class="xb-txt">SHINY</span>`;
  return `<span class="${cls}" style="--bc:#7df9ff" title="SHINY" aria-label="SHINY">${mutIconSvg("shiny",micro?12:11)}${lbl}</span>`;
}
function mutStampHtml(mut,micro=true,extraCls=""){
  if(!mut||mut==="none"||!MUT_ICONS[mut])return "";
  const label=MUT_LABEL[mut]||String(mut).toUpperCase();
  const col=MUT_COLOR[mut]||"#f5f5f5";
  const cls=`xbadge st-solid v-${mut}${micro?" is-micro":""}${extraCls?" "+extraCls:""}`;
  const lbl=micro?"":`<span class="xb-txt">${label}</span>`;
  return `<span class="${cls}" style="--bc:${col}" title="${label}" aria-label="${label}">${mutIconSvg(mut,micro?12:11)}${lbl}</span>`;
}
function traitStampHtml(k,micro=true,extraCls=""){
  const t=k&&k!=="none"&&TRAIT[k];if(!t)return "";
  const cls=`xbadge st-solid is-card-trait${micro?" is-micro":""}${extraCls?" "+extraCls:""}`;
  const lbl=micro?"":`<span class="xb-txt">${t.name}</span>`;
  return `<span class="${cls}" style="--bc:${t.color}" title="${t.name}" aria-label="${t.name}">${traitGem(micro?12:11,k)}${lbl}</span>`;
}
function hzBorderCls(mut,shiny,opts){
  const m=(mut&&mut!=="none")?String(mut).toLowerCase():"none";
  const tile=opts&&opts.tile?" hz-tile":"";
  const dense=opts&&opts.dense?" hz-dense":"";
  return ` hz-bdr bdr-bracket sh-orbital anim-on m-${m}${shiny?" is-shiny":""}${tile}${dense}`;
}
function hzBorderLayerHtml(){
  return `<span class="xbdr-foil" aria-hidden="true"></span>`
    +`<span class="xbdr-sheen" aria-hidden="true"></span>`
    +`<span class="xbdr-ring" aria-hidden="true"><span class="xbdr-orbit"></span></span>`
    +`<span class="xbdr-shiny-lip" aria-hidden="true"></span>`
    +`<span class="xbdr-side-rails" aria-hidden="true"></span>`
    +`<span class="xbdr-corners" aria-hidden="true"><span class="xbdr-c tl"></span><span class="xbdr-c tr"></span><span class="xbdr-c bl"></span><span class="xbdr-c br"></span></span>`;
}
function traitTipInner(k){const t=TRAIT[k];if(!t)return"";return `<span class="tt-name" style="color:${t.color}">${traitGem(16,k)} ${t.name}</span><span class="tt-rar">RARITY ${t.rar}${t.chance?` · ${t.chance}%`:""}</span><span class="tt-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</span><span class="tt-fx">${traitFxList(k)}</span>`;}
function traitChip(k,html){const t=TRAIT[k];if(!t)return html;return `<span class="trait-hover" data-trait="${k}">${html}</span>`;}
function mutTipInner(mut){const label=MUT_LABEL[mut];if(!label)return"";const col=MUT_COLOR[mut];return `<span class="tt-name" style="color:${col}">${mutIconSvg(mut,14)} ${label}</span><span class="tt-rar">MUTASI KARTU</span><span class="tt-fx">Mutasi hasil Roll · menaikkan HP &amp; ATK ×${MUT_MULT[mut]||1} · kelangkaan = kelangkaan kartu dasar ×${MUT_MULT[mut]||1}.</span>`;}
function mutChip(mut,html){const label=MUT_LABEL[mut];if(!label)return html;return `<span class="mut-hover" data-mut="${mut}">${html}</span>`;}
function mutPill(mut,cls="mut-badge"){const label=MUT_LABEL[mut];if(!label)return "";return `<span class="${cls} ix-chip m-${mut} on xbadge st-solid v-${mut}" style="--bc:${MUT_COLOR[mut]||"#f5f5f5"}">${mutIconSvg(mut,11)}<span class="xb-txt">${label}</span></span>`;}
function mergeFx(a,b){if(!b||!Object.keys(b).length)return a;const o={...a};for(const k in b){const av=o[k],bv=b[k];if(av==null){o[k]=bv;continue;}if(typeof bv==="number"&&typeof av==="number"){o[k]=av+bv;continue;}if(bv&&typeof bv==="object"&&av&&typeof av==="object"){if(k==="crit")o[k]={chance:Math.min(95,av.chance+bv.chance),mult:Math.max(av.mult,bv.mult)};else if(k==="evasion")o[k]={chance:Math.min(90,av.chance+bv.chance),turns:Math.max(av.turns,bv.turns)};else if(k==="barrage")o[k]={chance:Math.min(95,av.chance+bv.chance),min:Math.max(av.min,bv.min),max:Math.max(av.max,bv.max)};else o[k]=bv;}else o[k]=bv;}return o;}
function fxOf(stack){return mergeFx(PASSIVE_FX[stack.char]||{},TRAIT_FX[stack.trait]||{});}
/* fx aktif pemain; kalau kartu punya {copy:1} (Copy Ninja), salin passive lawan + tetap warisi trait */
function resolveFx(stack,enemyFx){
  let base=fxOf(stack);
  /* GLUTTONY (Demon Slime): kartu aktif nerima ability musuh yang disalin */
  if(bt&&bt.pCopyFx&&stack===bt.eq)base=mergeFx(base,bt.pCopyFx);
  if(!base.copy)return base;if(base.copy&&base.copy.turns&&!(bt&&bt.copyLeft>0))return base;
  const o=Object.assign({},enemyFx||{});
  delete o.copy;
  return mergeFx(o,TRAIT_FX[stack.trait]||{});
}

/* STATUS IMMUNE (fx.statusImmune): tolak status negatif yang menyasar kartu pemegang.
   Sisi pemain: pakai `fx` hasil resolveFx (sudah ada di playerPhase). Sisi lawan: cek di sini. */
function foeStatusImmune(){return !!(bt&&bt.efx&&bt.efx.statusImmune);}
/* HELPER fx batch kartu normal: aoe flat pct% MAX HP musuh (quake/meteor), arming entry (erase/ms/copy), buffer party */
function aoeMaxHpFire(pct,label,noBoss){
  if(!bt||bt.over)return;
  if(noBoss&&bt.en&&bt.en.boss)return;
  const hitW=(w)=>{if(!w||w.dead)return 0;if(w.hp==null)w.hp=w.es.hp;const d=Math.max(1,Math.round(w.es.hp*pct/100));w.hp=Math.max(0,w.hp-d);if(w.hp<=0)w.dead=true;return d;};
  const d=Math.max(1,Math.round(bt.es.hp*pct/100));
  bt.eHp-=d;
  const benchDmgs=[];
  if(bt.tower&&towerRun){
    for(let j=towerRun.idx+1;j<towerRun.waves.length;j++)benchDmgs.push(hitW(towerRun.waves[j]));
    const rail=document.querySelector(".foe-rail");
    if(rail)rail.outerHTML=towerEnemyBenchRail();
  }
  if(typeof window.playOverdriveAoeFx==="function")window.playOverdriveAoeFx(d);
  const sqs=document.querySelectorAll(".foe-rail .bench-sq:not(.empty)");
  sqs.forEach((sq,idx)=>{
    const bd=benchDmgs[idx]||d;
    const wNum=(towerRun&&towerRun.idx!=null)?(towerRun.idx+2+idx):(idx+2);
    setTimeout(()=>{
      if(bt&&!bt.over&&sq)floatText(sq,"-"+fmt(bd),"burn mini","WAVE "+String(wNum).padStart(2,"0"));
    },bsMs(240+idx*85));
  });
  setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe",label+" -"+fmt(d),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(320));
  if(bt.eHp<=0){const _fg=(bt.fgen||0);setTimeout(()=>{if(bt&&!bt.over&&(bt.fgen||0)===_fg)foeDown();},bsMs(760));}
}
function armShotFx(fx,idx){
  if(!fx||idx==null||!bt)return;
  bt.eraseGuard=bt.eraseGuard||new Array(bt.fighters.length).fill(false);
  if(fx.eraseOnEntry)bt.eraseGuard[idx]=true;
  if(fx.copy&&fx.copy.turns)bt.copyLeft=fx.copy.turns;
  if(fx.meteorShower){bt.msLast=bt.msLast||new Array(bt.fighters.length).fill(-99);bt.msLast[idx]=bt.turn;aoeMaxHpFire(fx.meteorShower.pct,"KEDATANGAN BINTANG",true);}
  if(fx.quake)aoeMaxHpFire(fx.quake.pct,"GURA GURA GUM-GUM",false);
}
function partyDmgApply(fx){
  if(!fx||!fx.partyDmg)return;
  for(let i=0;i<bt.fighters.length;i++)bt.atkBuff[i]=(bt.atkBuff[i]||0)+fx.partyDmg.pct;
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","NARASI +"+fx.partyDmg.pct+"% DMG PARTY","heal");},bsMs(420));
}
function cardStats(charId,mut,trait,shiny){const c=CARDS[charId];if(!c)return{hp:0,atk:0,def:0};const base=(MUT_MULT[mut||"none"]||1)*(shiny?SHINY_MULT:1);const hp=Math.round(c.base_hp*base*(TRAIT_HP[trait||"none"]||1)),atk=Math.round(c.base_atk*base*(TRAIT_ATK[trait||"none"]||1));return{hp,atk,def:hp};}
/* POWER = total HP + ATK semua slot deck terisi (maks 4) —
   SAMA dengan jumlah fighter battle (startBattle → equippedList) & tampilan backpack,
   biar topbar/profile/cerita/backpack selalu satu angka. */
function totalPower(){
  return equippedList().reduce((a,c)=>{const st=cardStats(c.char,c.mut,c.trait,c.shiny);return a+st.hp+st.atk;},0);
}
/* GATE = power musuh di level itu (HP + ATK), jadi keduanya dibandingkan apple-to-apple */
function gateOf(level){const e=enemyStats(level);return e.hp+e.atk;}
const ATKIC='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>';
function skillText(charId){const c=CARDS[charId];return c?c.passive.desc:"";}
/* Jangan biarkan satu key hilang mematikan seluruh layar: angka tidak valid tampil 0. */
const fmt=n=>(Number.isFinite(+n)?+n:0).toLocaleString("en-US");
const fmtC=n=>{const a=Math.abs(n);const t=(v,s)=>{let r=(v>=100?Math.round(v):Math.round(v*10)/10);return (r%1?r.toFixed(1):r.toFixed(0))+s;};if(a>=1e9)return t(n/1e9,"B");if(a>=1e6)return t(n/1e6,"M");if(a>=1e3)return t(n/1e3,"K");return String(n);};
function fmtStat(n){
  n=Number(n)||0;const s=n<0?'-':'';n=Math.abs(n);
  if(n<1000)return s+Math.round(n);
  const tr=[{v:1e12,u:'T'},{v:1e9,u:'B'},{v:1e6,u:'M'},{v:1e3,u:'k'}];
  for(let i=0;i<tr.length;i++){
    const t=tr[i];
    if(n>=t.v){
      let val=n/t.v;let r=val>=100?Math.round(val):Math.round(val*10)/10;
      if(r>=1000&&i>0)return s+'1'+tr[i-1].u;
      return s+(r%1===0?r.toFixed(0):r.toFixed(1))+t.u;
    }
  }
  return s+Math.round(n);
}
if(typeof window!=='undefined'){window.fmtStat=fmtStat;}


