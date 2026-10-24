/* Kuota partikel global (~30% lebih sedikit) biar HP lemah gak frame. */
function FXQ(n){return Math.max(1,Math.round((n||0)*0.7));}
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
   Pool HP harian global = 1T (harus sama dengan world_boss_pool_size() di server).
   Damage mentah kartu (puluhan ribu) dikali RAID_DMG_SCALE supaya masuk skala pool. */
const WB_POOL_HP=1000000000000;
const RAID_DMG_SCALE=100;
const RAID_DIFFS=[
  {k:"world",l:"WORLD",hp:1,atk:1,rw:1,color:"#7DF9FF"}
];
/* ========== BOSS RAID (konstanta + helper) ========== */
const RAID_BOSSES=[
  {id:"RAID_ETERNAL_DRAGON",name:"Eternal Dragon",tier:"EX",skill:"Galaxy Roar",hp:WB_POOL_HP,atk:15000,power:15000,img:"assets/cards/art/eternal-dragon.webp",banner:"assets/raid/raid-banner-hd.png",fx:{purple:{chance:100,mult:1}}},
  /* Boss kedua: pool & papan terpisah (world_boss_b). */
  {id:"RAID_SHADOW_KING",name:"Shadow King",tier:"EX",skill:"Umbra Eclipse",hp:WB_POOL_HP,atk:16500,power:16500,img:"assets/cards/art/shadow-king.webp",banner:"assets/raid/raid-banner-hd.png",fx:{purple:{chance:100,mult:1}}}
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
/* ===== Ikon unik per trait tier — Game-Icons.net (Iconify game-icons:*) — CC BY 3.0 =====
   ore → cut-diamond → crystal-growth → amethyst → aura → angel-wings → galaxy → blast.
   Path isi dikasih class gem-body (fill currentColor) biar tetap ikut warna tier + glow .tgem. */
const TRAIT_ICON_VB="0 0 512 512";
const TRAIT_ICONS={
  common:`<path class="gem-body" d="m344.578 493.54l-117.214-2.024L118.9 338.536l14.355-51.353l35.264 9.38l40.145 42.033l-17.467-59.874l23.836-35.358l-42.748-104.034l43.165-79.45l72.434 22.468l46.26 80.46l-29.474 5l-38.478-35.017l22.568 48.064l-.672 37.364l-26.09 18.224l34.95 1.284l47.145 23.835l28.75-27.874l38.488 19.057l10.647 37.578l-18.97-13.784l-78.166 39.967l-44.983-15.39l5.86-27.153l-42.766 3.274l23.573 11.913l-9.49 22.943l58.037 31.285l20.34 79.423l-15.45 34.73l29.397-20.36l66.83-9.438l-71.61 65.81zm-158.524-3.538l-53.48-2.296l27.663-64.006l34.38 49.695zm-86.78-37.04l-11.08-34.875l-35.503-10.204l34.858-11.09l10.212-35.5l11.09 34.855l35.502 10.22l-34.857 11.082l-10.22 35.51zm252.983-33.208l-21.565-84.228l72.042-38.99l53.683 59.322l-18.665 52.23zM169.47 280.677l-59.133-15.612l-20.298-69.16l66.064-37.45l36.94 84.126zm172.106-38.972l-38.385-19.66l1.574-38.86l43.607-9.917l26.753 39.296l-33.547 29.14zm58.845-47.23l-14.234-45.425l-46.14-13.46l45.41-14.262l13.46-46.132l14.252 45.41l46.14 13.478l-45.41 14.235l-13.477 46.156zM327.01 124.9l-28.666-56.762l-28.972-7.96l22.645-41.718l29.312 14.278l17.84 59.542l-12.16 32.62z"/>`,
  rare:`<path class="gem-body" d="m92.906 94.813l60.438 79.75l78.125-79.75H92.905zm189.25 0L359.25 173.5l58.688-78.688H282.155zm-25.344.843l-84.718 86.47H341.53zm177.907 7.906l-58.626 78.563H494.53zm-358.064.75l-57.78 77.813h116.78zm-58.5 96.5L226.562 429.22l-83.218-228.41H18.156zm145.063 0l93.593 256.844l93.593-256.844H163.22zm207.06 0L287.064 429.22l208.405-228.41H370.28z"/>`,
  legendary:`<path class="gem-body" d="m253.8 15.56l-79.9 84.11l2.3 58.83l50.6 36.2l31.9 182l10.8-26.9l11.8-235.4l18.7 1l-9.1 181l28.3-70.8l8.2-108l.9-17.93zm139 50.57l-46.6 50.77l-3.9 51.1l10.6-26.2l30.4-13.7c3.2-20.6 6.3-41.3 9.5-61.97m60.3 51.17l-85.7 38.4l-102.6 255.9l14.6 83.3h7.8l147.6-293.1l16.7 8.4l-143.4 284.7h24.4l146.6-291.8zm-340.2 18.9l-54.11 99.1l69.11 259.6h93.6l-51.1-274.8l18.3-3.4l51.8 278.2h19.9l-50.7-289.4zm358.3 260.4l-65.8-5.2l-49.8 99.2l69.8-36.7zm-435.96-28l42.47 126.7h30.99L80.6 389.9z"/>`,
  superior:`<path class="gem-body" d="M85.183 408.608H26V103.313h59.183zm0-373.513L35.075 85.072h50.108zM408.72 85.15V25.967H103.386v59.184zM35.075 426.849l50.108 50.11v-50.11zM476.978 85.164l-50.109-50.109v50.109zm-68.311 341.685H103.386v59.184h305.281zm.42-323.536v305.124H103.965V103.313h305.124zm-21.91 17.098H121.062v268.482c13.152-230.342 44.059-239.548 266.115-268.482M486 103.313h-59.183v305.295H486zm-59.183 373.619l50.108-50.109h-50.108z"/>`,
  transiden:`<path class="gem-body" d="M320.938 13.28c-16.646 34.584-38.466 60.157-63.094 60.157c-24.522 0-47.035-25.275-63.656-59.593c.366 39.358-9.71 90.884-30.938 105.125s-49.64-12.002-78.844-32.126c17.455 34.04 42.095 67.5 29.78 92.28c-12.21 24.576-59.172 35.96-92.874 35.626c29.338 19.29 78.842 45.803 78.844 74.188c.002 28.384-49.504 53.71-78.844 73c33.702-.333 80.663 11.612 92.876 36.187c12.227 24.61-9.03 56.31-33.75 85.563c44.826-15.413 65.142-5.735 85.374 10.812h31.75c-42.74-35.413-72.062-107.828-72.062-191.563c-.002-118.62 58.92-214.906 131.406-214.906c72.488 0 131.406 96.29 131.406 214.907c0 83.74-29.317 156.153-72.062 191.563h27.313c19.847-14.62 39.796-25.65 89.687-9.28c-26.233-30.264-42.2-62.484-29.97-87.095c12.257-24.665 56.658-36.612 90.533-36.188c-29.4-19.297-75.344-44.584-75.344-73s45.943-54.89 75.342-74.187c-33.874.424-78.273-10.962-90.53-35.625c-12.315-24.78 9.982-58.24 27.437-92.28c-29.202 20.12-57.583 46.385-78.845 32.124c-21.262-14.263-31.382-66.13-30.938-105.69zm-68.97 93.75c-19.56 2.543-37.343 25.564-37.343 55.407c0 16.447 5.67 30.986 14 41.032l10.156 12.218l-15.593 2.937c-10.815 2.035-18.743 7.737-25.53 17.063c-6.79 9.325-11.984 22.344-15.626 37.343c-6.585 27.128-8.078 60.24-8.31 89.47h36.093l.656 8.656l9.124 122.563h76.187l8.095-122.5l.563-8.72h34.375c-.026-29.592-.44-63.166-6.407-90.5c-3.295-15.095-8.287-28.096-15.156-37.313c-6.87-9.216-15.133-14.897-27.28-16.78l-15.94-2.47l10.064-12.593c7.97-9.996 13.375-24.36 13.375-40.406c-.002-31.817-19.884-55.313-41.44-55.313c-2.54 0-3.96-.103-4.03-.094h-.03z"/>`,
  demigod:`<path class="gem-body" d="M92.438 28.97C75.263 47.722 60.826 69.69 49.593 94L167.5 204.656l-12.78 13.625L41.905 112.407c-9.19 24.257-15.377 50.455-18.156 77.844l116.156 58.72l-8.437 16.686L22.312 210.47c-.963 24.45.777 49.666 5.437 75.155l100.53 8.313l-1.53 18.625l-94.97-7.844c.743 3.09 1.515 6.185 2.345 9.28c4.43 16.51 9.94 32.34 16.375 47.438c8.757-1.615 17.808-3.274 27.813-5.157c26.754-5.033 53.093-10.06 53.093-10.06l3.5 18.342s-26.368 5.054-53.156 10.094c-8.012 1.508-15.797 2.97-23.188 4.344c8.65 17.507 18.62 33.887 29.657 49l60.843-34.28L158.22 410l-58.407 32.938c12.202 14.79 25.482 28.186 39.624 40l17.157-20.344c1.38-20.537 4.963-37.725 14.375-51.72c6.338-9.425 15.44-16.826 27.155-21.937C189.86 376.115 183.3 361.62 179 345.594c-14.526-54.15.58-108.49 36.406-138.094L92.436 28.97zm330.843 0L300.314 207.5c35.826 29.604 50.964 83.943 36.437 138.094c-4.26 15.877-10.768 30.237-18.938 42.97c12.345 5.384 21.554 13.502 27.5 23.655c7.81 13.333 10.495 29.117 11.407 47.467l19.592 23.25c14.14-11.813 27.423-25.208 39.625-40L357.5 410l9.188-16.28L427.53 428c11.04-15.117 21.006-31.49 29.658-49c-7.4-1.374-15.207-2.836-23.22-4.344c-26.787-5.04-53.156-10.094-53.156-10.094l3.5-18.343s26.372 5.027 53.125 10.06a8378 8378 0 0 0 27.813 5.19a357 357 0 0 0 16.375-47.47c.83-3.095 1.602-6.19 2.344-9.28L389 312.56l-1.53-18.625l100.53-8.31c4.66-25.49 6.37-50.705 5.406-75.156L384.25 265.655l-8.438-16.687L492 190.25c-2.783-27.4-8.956-53.61-18.156-77.875L361.03 218.28l-12.81-13.624L466.124 94c-11.236-24.31-25.668-46.277-42.844-65.03zM256.095 290.03c-10.452 0-20.172 5.342-27.78 15.126c-7.61 9.784-12.658 23.895-12.658 39.688s5.047 29.903 12.656 39.687c7.61 9.785 17.33 15.158 27.782 15.158s20.14-5.373 27.75-15.157s12.656-23.893 12.656-39.686s-5.047-29.904-12.656-39.688s-17.298-15.125-27.75-15.125zm39.625 111.19c-10.36 11.14-24.236 18.342-39.626 18.342c-14.957 0-28.49-6.798-38.75-17.406c-2.662.66-5.147 1.384-7.438 2.188c-11.464 4.02-18.388 9.46-23.437 16.97c-9.19 13.66-11.542 37.05-11.907 69.248h163.812c-.135-31.55-1.154-55.19-9.188-68.906c-4.42-7.55-10.596-12.946-21.562-17.062c-3.467-1.302-7.433-2.437-11.906-3.375z"/>`,
  cosmic:`<path class="gem-body" d="M342.5 17.9c-3.1 11.63-2.2 21.56-23.8 25.11c20.3-2.7 22.3 9.58 24.8 21.49c-2.8 1.94-5.5 4.11-8.1 6.49c-21.9 20.84-33 41.11-49 61.61c-6.3 1.2 5.3-53.52 31.1-79.87C225.1 40.92 207.6 268.4 236.4 275c-51.7 18.4-72.6-98.3-59.4-157.3c-37.1 3.9-62 39.8-67.9 60c2.8 27.1 6.1 55.1 38.7 80.9c-32.1 3.6-42-27.8-55.31-54C13.9 309.5 198.4 311.4 228.5 299.1c-93 70.5-149.62 52.3-196.77 39c-40.48 85.1 61.46 56 107.57 35.7c-18.4 30.7-72.25 37.6-88.92 41c61.62 51.3 174.42-67 200.02-106.5c2.5 65.7-74.3 134.4-122.8 171.7c43.6 2.2 83.2-17.9 102.4-55.5c0 10.1-4.1 22.6-9.6 35.8c15-2.1 39.6-6.2 48.8-24.2c25-54.1 37.8-93.1 15.3-138.2c29.9 33.5 63.6 65.3 58.4 114.5c26.9-15.6 48.8-33.6 24.7-60.1c14.1 1.4 23.6 7.7 32.8 13.7c13.9-2.8 34.4-19.9 33.7-33c-31.6-29.8-83.4-43.7-133.8-55.9c72.1-19.8 136.9-10.1 175.6 5.6c5-11.7 9.4-29.6 5.9-41.9c-16.4-9.7-62.7-7.8-83.3-5.6c17.7-15.7 56.8-21.1 81.3-21.2c-2-67.7-162.6 27.8-182.2 42.8c32.7-59.1 123.2-112.7 178.7-121.1c-13.2-31.1-37.2-34-64.3-22.4c2.4-9.5 6.7-17.49 23.4-15.29c-21.6-3.51-20.7-13.44-23.8-25.07c-2.4 13.55-4.1 17.11-19.4 26.67c14.3-2.17 16.4 6.69 17.4 14.69c-53.5 24.4-117.8 102.8-135.1 132.5c-22.1-24 51-121.5 107.7-187.46c-3.1-9.48-21.8-6.31-38.2 4.81c1.1-8.63.7-22.16 17.9-19.54c-15.3-9.6-17-13.16-19.4-26.71m-166.3.3c5.4 10.73 12.7 17.53-1 34.56c13.8-16.07 23.7-7.13 33.9.22c-4.6-7.19-16.3-17.67-.7-27.86c-17.8 3.09-21.4 1.57-32.2-6.92M47.71 26.61c-3.08 11.63-2.13 21.56-23.76 25.05c21.02-2.74 22.39 10.55 25.06 22.81c1.43-8.43-.28-23.97 18.14-21.16c-15.27-9.59-16.98-13.15-19.44-26.7m419.39 5.5c1.6 10.83 1.3 13.93-7.8 25.07c13.1-6.8 15.9 5.39 19.1 11.38c-1.2-9.97-3.4-20.36 13.1-23.64c-17.2 2.87-19.1-4.85-24.4-12.81M125.3 84.28c-.6 18.02-12 17.32-22.7 17.92c7 2.4 20.3 3 15.3 18.2c10.2-11.6 13.3-12.5 25.2-12.6c-9.4-4.3-17.8-4.9-17.8-23.52M71.21 153.9c-8.61 8.5-12.85 17.5-33.24 9.6c19.47 8.3 13.98 20.4 10.08 32.4c5.46-6.6 11.9-20.9 26.35-9.1c-8.38-16-8.02-19.9-3.19-32.9M453.9 282.7c-2.4 8.9-1.7 16.5-18.2 19.2c16-2.1 17.1 8.1 19.2 17.5c1.1-6.5-.2-18.4 13.8-16.3c-11.7-7.3-13-10-14.8-20.4M69.25 293.8c-12.82 12.7-16.72 13.5-30.41 12.7c10.55 5.7 20.39 7.1 18.72 29c2.3-21.1 15.46-19.4 28.05-19.1c-7.83-3.3-23.4-5.3-16.36-22.6m394.55 50.7c3.1 11.6 8.9 19.7-8 33.6c16.8-12.9 24.6-2.2 33.2 7.1c-3.1-8-12.4-20.6 4.9-27.4c-18-.5-21.3-2.8-30.1-13.3m-139.2 72.1c-2.7 12.3-4.1 25.5-25.1 22.8c21.6 3.5 20.7 13.4 23.8 25c2.4-13.5 4.1-17.1 19.4-26.6c-18.4 2.8-16.7-12.8-18.1-21.2M83.9 438.2c-2.83 16-4.84 20.2-22.86 31.5c21.68-3.3 19.67 15.1 21.33 25c3.19-14.5 4.84-30.1 29.63-26.9c-25.5-4.2-24.43-15.9-28.1-29.6m366.2 11.4c-7.3 9.6-10.2 19.1-31.5 14.2c20.4 5.4 16.8 18.1 14.6 30.6c4.5-7.3 8.8-22.4 24.8-12.8c-10.6-14.6-10.8-18.6-7.9-32"/>`,
  bigbang:`<path class="gem-body" d="M256 16c-72 0-120 48.094-120 96.093c0 48.416 24.277 66.635 51.563 112.5c-3.476 47.475-3.75 111.834-3.75 199.218c15.588-51.96 28.137-91.943 38.437-121.406C236.71 347.18 249.23 407.97 256 495.997c6.77-88.027 19.288-148.818 33.75-193.593c10.3 29.462 22.85 69.444 38.438 121.407c0-87.915-.21-152.607-3.75-200.156C351.563 178.276 376 160.274 376 112.09c0-48-48-96.09-120-96.09m0 47.813c39.765 0 72.188 26.863 72.188 60c0 13.097-5.516 25.29-14.063 35.156c-10.095-33.71-27.39-46.876-58.125-46.876s-48.03 13.167-58.125 46.875c-8.547-9.866-14.063-22.06-14.063-35.158c0-33.136 32.423-60 72.188-60z"/>`
};
const TRAIT_HOT=new Set(["transiden","demigod","cosmic","bigbang"]);
function traitGem(sz,k,cls){const e=k&&TRAIT_ICONS[k];const icon=e||`<path class="gem-body" d="M15 6h18l9 11-18 25L6 17z"/><path class="gem-line" d="M6 17h36M15 6l4.5 11L24 6l4.5 11L33 6M10.5 17L24 42l13.5-25M19.5 17h9"/>`;const vb=e?TRAIT_ICON_VB:"0 0 48 48";const hot=k&&TRAIT_HOT.has(k)?" tg-hot":"";return `<svg class="tgem${hot}${cls?" "+cls:""}" viewBox="${vb}" width="${sz}" height="${sz}" aria-hidden="true">${icon}</svg>`;}
function traitTipInner(k){const t=TRAIT[k];if(!t)return"";return `<span class="tt-name" style="color:${t.color}">${traitGem(16,k)} ${t.name}</span><span class="tt-rar">RARITY ${t.rar}${t.chance?` · ${t.chance}%`:""}</span><span class="tt-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</span><span class="tt-fx">${traitFxList(k)}</span>`;}
function traitChip(k,html){const t=TRAIT[k];if(!t)return html;return `<span class="trait-hover" data-trait="${k}">${html}</span>`;}
function mutTipInner(mut){const label=MUT_LABEL[mut];if(!label)return"";const col=MUT_COLOR[mut];return `<span class="tt-name" style="color:${col}">${label}</span><span class="tt-rar">MUTASI KARTU</span><span class="tt-fx">Mutasi hasil Roll · menaikkan HP &amp; ATK ×${MUT_MULT[mut]||1} · kelangkaan = kelangkaan kartu dasar ×${MUT_MULT[mut]||1}.</span>`;}
function mutChip(mut,html){const label=MUT_LABEL[mut];if(!label)return html;return `<span class="mut-hover" data-mut="${mut}">${html}</span>`;}
function mutPill(mut,cls="mut-badge"){const label=MUT_LABEL[mut];if(!label)return "";return `<span class="${cls} ix-chip m-${mut} on">${label}</span>`;}
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

