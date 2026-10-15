const CARDS=Object.fromEntries(MASTER_CARD_INDEX.map(c=>[c.char_id,c]));
function getCardData(id){return CARDS[id]||null;}
/* ===== GATE KARTU BOSS (TOKO RAID) =====
   raidBoss:true -> terkunci di semua roll SEBELI dibeli; state.raidShopOwned[id]=true dibuat
   saat pembelian di Toko Raid (persist via save) -> PERMANEN terbuka sesudahnya.
   Fallback: sudah punya stack kartunya (mis. save lama / grant GM). */
function bossRollUnlocked(charId){
  if(state&&state.raidShopOwned&&state.raidShopOwned[charId])return true;
  return !!(state&&state.stacks||[]).some(s=>s.char===charId);
}
/* Pool roll gacha BERSAMA (rngRoll + instantRollFast): buang noGacha, gate weather, gate boss. */
function gachaPool(){
  const aw=activeWeatherId();
  return MASTER_CARD_INDEX.filter(c=>!c.noGacha&&(!c.raidBoss||bossRollUnlocked(c.char_id))&&(!c.weatherOnly||c.weatherOnly===aw));
}
function cardImg(id){const c=CARDS[id];return c?c.sprite_asset:"";}
function cardName(id){const c=CARDS[id];return c?c.name:"(kartu hilang)";}
function cardType(id){const c=CARDS[id];return c?c.type:"";}
function cardTier(id){const c=CARDS[id];return c?c.tier:"";}
/* KONVENSI JURUS TANDA TANGAN (biar nambah kartu EX/UR nanti gak bikin efek bocor ke tier bawahnya):
   EX = jurus se-layar penuh + background video/gambar sendiri DI BELAKANG kartu (layer *-bgfx, z-1).
   UR dan ke bawah = animasi tetap jalan (bilah, partikel, ledakan) tapi TANPA background sendiri.
   Yang mengizinkan background = TIER kartu, bukan daftar id — jadi kartu baru ikut aturan ini otomatis. */
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
  "regression","copy","entryShatter","entryMaxHp","turnMaxHp","splitDeath","deathDefy","openingHit","burn","desperateStrike","statusImmune","iceBlast","psychicBarrier","entryAtkPct","sleepStrike","entryFreeze","iceShell","heavyRain","shockwave","timeStop","killHeal","tripleHit","flood","puppetPoison","puppetBody","sandBurial","autoBlock","unlimitedVoid","dimensionShift","gluttony","seriousPunch","meteorWave","overheat","freezeTransfer","foeEntryFreeze","hitFreeze","berserker","stripAbility","valhalla","dmgCut","inkCorrupt","inkDrain","dupEntry","maxCorrupt","worldCorrupt","deathRear","grieferAtk","senzu","stretch","havocRocket","getExcited","rewind","turret","worldEnder","psychicBarrage","rubberField","regen","counterHit","stunPunch","eightGates","deathHex","meteorShower","splash","partyDmg","statGrow","reversal","causality","eraseOnEntry","quake","shockAll","deathStay"];
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
const SHINY_MULT=2; // SHINY = stat dikali 2, DIKALIKAN di atas multiplier mutasi (mis. shiny+gold = 2*5 = 10)
const BASE_CRIT={chance:10,mult:1.5}; // crit global TERSEMBUNYI: semua kartu punya peluang dasar ini; kartu bertait crit tetap pakai trait-nya
const MUT_MULT={none:1,gold:5,rainbow:10,secret:25};
const MUT_RANK={none:0,gold:1,rainbow:2,secret:3};
const MUT_LABEL={none:"",gold:"GOLD",rainbow:"RAINBOW",secret:"SECRET"};
const MUT_COLOR={gold:"#E0BC6E",rainbow:"#B58CFF",secret:"#22D3EE"};
const MUT_LETTERS={gold:["#F6DFA6","#C99A45"],rainbow:["#FF6B81","#FFB347","#FFE66D","#6BE08A","#B9C2CC","#B98CFF","#FF6BD6"],secret:["#22D3EE","#7DF9FF","#E0F7FF","#00FFD0","#FFFFFF","#22D3EE"]};
function mutText(mut,text){if(!mut||mut==='none'||!MUT_LABEL[mut])return text;const cols=MUT_LETTERS[mut]||[MUT_COLOR[mut]];return text.split("").map((ch,i)=>ch===' '?ch:`<span style="color:${cols[i%cols.length]}">${ch}</span>`).join("");}
function shinyName(tag,base,shine,mut,shiny,name){
  const esc=String(name).replace(/"/g,'&quot;');
  if(!shiny){const st=(mut&&mut!=='none')?` style="color:${MUT_COLOR[mut]}"`:'';return `<${tag} class="${base}"${st}>${mutText(mut,name)}</${tag}>`;}
  if(mut==='rainbow'||mut==='secret'){return `<${tag} class="${base} shiny-gloss" data-text="${esc}">${mutText(mut,name)}</${tag}>`;}
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
  {k:"nightmare",l:"NIGHTMARE",mut:"secret",rw:3}
];
const RAID_DIFFS=[
  {k:"normal",l:"NORMAL",hp:1,atk:1,rw:1,color:"#6EAC4C"},
  {k:"hard",l:"HARD",hp:2,atk:1.6,rw:1.5,color:"#E07F33"},
  {k:"extreme",l:"EXTREME",hp:4,atk:2.2,rw:2.2,color:"#FF4D5E"},
  {k:"nightmare",l:"NIGHTMARE",hp:8,atk:3,rw:3,color:"#B58CFF"}
];
/* ========== BOSS RAID (konstanta + helper) ========== */
const RAID_BOSSES=[{id:"RAID_ETERNAL_DRAGON",name:"Eternal Dragon",tier:"EX",skill:"Galaxy Roar",hp:30000,atk:15000,power:15000,img:"assets/raid/eternal-dragon-hd.png",banner:"assets/raid/raid-banner-hd.png",fx:{purple:{chance:100,mult:1}}}];
const RAID_TURNS=10;
const RAID_TIERS=[{pct:100,tokens:20},{pct:50,tokens:10},{pct:30,tokens:5}];
function raidDiffOf(){return RAID_DIFFS.find(d=>d.k===(state&&state.raidDiff))||RAID_DIFFS[0];}
function raidBossOf(diff){const d=diff||raidDiffOf(),b=RAID_BOSSES[0];return Object.assign({},b,{hp:Math.round(b.hp*d.hp),atk:Math.round(b.atk*d.atk),power:Math.round(b.power*d.hp),rw:d.rw,diffKey:d.k,diffLabel:d.l,diffColor:d.color});}
function raidDiffUnlocked(k){const i=RAID_DIFFS.findIndex(d=>d.k===k);if(i<=0)return true;return !!(state.raidCleared&&state.raidCleared[RAID_DIFFS[i-1].k]);}
function raidNextUnlock(k){const i=RAID_DIFFS.findIndex(d=>d.k===k);return i>0?RAID_DIFFS[i-1].l:null;}
function raidTokenFor(pct,diff){const rw=(diff&&diff.rw)||((diff?diff:raidDiffOf()).rw)||1;for(const x of RAID_TIERS){if(pct>=x.pct)return Math.round(x.tokens*rw);}return 0;}
function raidNextTier(pct,diff){const rw=(diff&&diff.rw)||((diff?diff:raidDiffOf()).rw)||1;for(let i=RAID_TIERS.length-1;i>=0;i--){if(pct<RAID_TIERS[i].pct)return{pct:RAID_TIERS[i].pct,tokens:Math.round(RAID_TIERS[i].tokens*rw)};}return null;}

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
/* ===== Ikon unik per trait tier =====
   Tiap tier punya siluet berbeda (bukan cuma beda warna): batu polos → permata → mahkota → kristal →
   mata → tengkorak bertanduk → galaksi → supernova. Pola sama dgn gem lama:
   bentuk isi di .gem-body (fill currentColor), detail di .gem-line (stroke). */
const TRAIT_ICONS={
  common:`<path class="gem-body" d="M17 7h14l10 10v14L31 41H17L7 31V17z"/><path class="gem-line" d="M17 7L7 17M31 7l10 10M7 31l10 10M41 31l-10 10M17 17h14v14H17z"/>`,
  rare:`<path class="gem-body" d="M10 18h28L24 42z"/><path class="gem-body" opacity=".8" d="M10 18l6-9h16l6 9z"/><path class="gem-line" d="M10 18h28M16 9l8 9 8-9M24 18v24M16 9l-6 9M32 9l6 9M16 18l4.5 16M32 18l-4.5 16"/>`,
  legendary:`<path class="gem-body" d="M6 14l9 10 9-16 9 16 9-10-5 24H11z"/><path class="gem-line" d="M11 31h26M24 18l3.5 5.5L24 29l-3.5-5.5zM15.2 26.2a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2zM32.8 26.2a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z"/>`,
  superior:`<path class="gem-body" d="M24 5l16 9v20l-16 9-16-9V14z"/><path class="gem-line" d="M24 13.5l9 5v11l-9 5-9-5v-11zM24 19l5.5 5.5L24 30l-5.5-5.5z"/>`,
  transiden:`<path class="gem-body" d="M3 24C7 15.5 14.5 10 24 10s17 5.5 21 14c-4 8.5-11.5 14-21 14S7 32.5 3 24z"/><path class="gem-line" d="M24 16.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15M24 20.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7M12 20c3.6-4 7.7-6.4 12-6.8M36 20c-3.6-4-7.7-6.4-12-6.8"/>`,
  demigod:`<path class="gem-body" d="M10.5 20C6.8 13.3 5.6 7 5.6 7 11.5 8 15.9 12 18 17.4zM37.5 20c3.7-6.7 4.9-13 4.9-13-5.9 1-10.3 5-12.4 10.4z"/><path class="gem-body" d="M24 9c-8.8 0-15 6-15 14.2 0 4.9 2.5 9.2 6.2 11.6V39c0 1.7 1.3 3 3 3h11.6c1.7 0 3-1.3 3-3v-4.2c3.7-2.4 6.2-6.7 6.2-11.6C39 15 32.8 9 24 9z"/><path class="gem-line" d="M17.5 21.5a4.6 4.6 0 100 9.2 4.6 4.6 0 000-9.2zM30.5 21.5a4.6 4.6 0 100 9.2 4.6 4.6 0 000-9.2zM24 30l-3.4-5h6.8zM17 35h14M21 34.5v4M27 34.5v4"/>`,
  cosmic:`<path class="gem-body" d="M44 24L31.4 27.1 38.1 38.1 27.1 31.4 24 44 20.9 31.4 9.9 38.1 16.6 27.1 4 24 16.6 20.9 9.9 9.9 20.9 16.6 24 4 27.1 16.6 38.1 9.9 31.4 20.9z"/><path class="gem-line" d="M24 19.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4"/><ellipse class="gem-line" cx="24" cy="24" rx="20.5" ry="8.5" transform="rotate(-28 24 24)"/>`,
  bigbang:`<path class="gem-body" d="M46 24L30.1 27.5 35 43.1 24 31 13 43.1 17.9 27.5 2 24 17.9 20.5 13 4.9 24 17 35 4.9 30.1 20.5z"/><path class="gem-line" d="M24 18a6 6 0 100 12 6 6 0 000-12M24 21.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5"/>`
};
const TRAIT_HOT=new Set(["transiden","demigod","cosmic","bigbang"]);
function traitGem(sz,k,cls){const icon=(k&&TRAIT_ICONS[k])||`<path class="gem-body" d="M15 6h18l9 11-18 25L6 17z"/><path class="gem-line" d="M6 17h36M15 6l4.5 11L24 6l4.5 11L33 6M10.5 17L24 42l13.5-25M19.5 17h9"/>`;const hot=k&&TRAIT_HOT.has(k)?" tg-hot":"";return `<svg class="tgem${hot}${cls?" "+cls:""}" viewBox="0 0 48 48" width="${sz}" height="${sz}" aria-hidden="true">${icon}</svg>`;}
function traitTipInner(k){const t=TRAIT[k];if(!t)return"";return `<span class="tt-name" style="color:${t.color}">${traitGem(16,k)} ${t.name}</span><span class="tt-rar">RARITY ${t.rar}${t.chance?` · ${t.chance}%`:""}</span><span class="tt-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</span><span class="tt-fx">${traitFxList(k)}</span>`;}
function traitChip(k,html){const t=TRAIT[k];if(!t)return html;return `<span class="trait-hover" data-trait="${k}">${html}</span>`;}
function mutTipInner(mut){const label=MUT_LABEL[mut];if(!label)return"";const col=MUT_COLOR[mut];return `<span class="tt-name" style="color:${col}">${label}</span><span class="tt-rar">MUTASI KARTU</span><span class="tt-fx">Mutasi hasil Roll · menaikkan HP &amp; ATK ×${MUT_MULT[mut]||1} · kelangkaan = kelangkaan kartu dasar ×${MUT_MULT[mut]||1}.</span>`;}
function mutChip(mut,html){const label=MUT_LABEL[mut];if(!label)return html;return `<span class="mut-hover" data-mut="${mut}">${html}</span>`;}
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
  const hitW=(w)=>{if(!w||w.dead)return;if(w.hp==null)w.hp=w.es.hp;const d=Math.max(1,Math.round(w.es.hp*pct/100));w.hp=Math.max(0,w.hp-d);if(w.hp<=0)w.dead=true;};
  const d=Math.max(1,Math.round(bt.es.hp*pct/100));
  bt.eHp-=d;
  if(bt.tower&&towerRun){for(let j=towerRun.idx+1;j<towerRun.waves.length;j++)hitW(towerRun.waves[j]);const rail=document.querySelector(".foe-rail");if(rail)rail.outerHTML=towerEnemyBenchRail();}
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
/* POWER = total HP + ATK semua kartu yang dipakai: kartu utama + TAG (tetap terdeteksi walau cuma 1 kartu) */
function totalPower(){
  const a=equipped(),b=equipped2();
  const s=c=>c?cardStats(c.char,c.mut,c.trait,c.shiny):{hp:0,atk:0};
  const x=s(a),y=s(b);
  return x.hp+x.atk+y.hp+y.atk;
}
/* GATE = power musuh di level itu (HP + ATK), jadi keduanya dibandingkan apple-to-apple */
function gateOf(level){const e=enemyStats(level);return e.hp+e.atk;}
const ATKIC='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>';
function skillText(charId){const c=CARDS[charId];return c?c.passive.desc:"";}
const fmt=n=>n.toLocaleString("en-US");
const fmtC=n=>{const a=Math.abs(n);const t=(v,s)=>{let r=(v>=100?Math.round(v):Math.round(v*10)/10);return (r%1?r.toFixed(1):r.toFixed(0))+s;};if(a>=1e9)return t(n/1e9,"B");if(a>=1e6)return t(n/1e6,"M");if(a>=1e3)return t(n/1e3,"K");return String(n);};

