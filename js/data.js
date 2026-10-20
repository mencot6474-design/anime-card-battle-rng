"use strict";
/* =============== DATA =============== */
/* UR = setingkat di bawah EX & TIDAK ada di gacha (hanya Toko Raid), jadi dia tidak punya baris DROP_RATES.
   BOSS = kartu beli di TOKO RAID: glitch hitam-putih, terkunci di semua roll SEBELI dibeli, permanen sesudahnya. */
const TIERS=["R","SR","SSR","UR","EX","BOSS"];
const TIER_COLOR={R:"#9A8A8B",SR:"#C8A2A8",SSR:"#B07A9B",UR:"#2F8FE2",EX:"#FF4D5E",BOSS:"#FFFFFF"};
/* TIER = 100% KOSMETIK (warna badge + label). Tidak menentukan drop chance, stat scaling, atau pool.
   Chance tiap kartu di-set manual di field `chance:`. Kalau kartu tidak punya `chance:`, fallback ke
   TIER_CHANCE di bawah (nilai tengah tiap band, supaya card tanpa override tetap masuk akal).
   Bands (batas bawah inklusif): R < 50k ≤ SR < 500k ≤ SSR < 5jt ≤ UR < 500jt ≤ EX.
   BOSS di luar band (chance dasar 25 jt) — label kosmetik khusus kartu Toko Raid. */
const TIER_CHANCE={R:5000,SR:250000,SSR:2500000,UR:50000000,EX:1000000000,BOSS:25000000};
function chanceOf(tier){return TIER_CHANCE[tier]||100;}
// Auto-suggest tier kosmetik berdasarkan chance. Pakai pas nambah kartu baru biar label sesuai rarity.
function tierFromChance(ch){
  if(ch<50000)return "R";
  if(ch<500000)return "SR";
  if(ch<5000000)return "SSR";
  if(ch<500000000)return "UR";
  return "EX";
}
/* Chance ringkas biar gak kepanjangan: 800 → "800", 1500 → "1.5K",
   1jt → "1M", 18jt → "18M", 1000jt → "1B", 1e12 → "1T". */
function fmtChance(n){n=Math.round(Number(n)||0);if(n<1000)return String(n);const u=[[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];for(const[v,s]of u)if(n>=v){const x=n/v;return (x<10?Math.round(x*10)/10:Math.floor(x))+s;}return String(n);}
function rarityText(tier,chance){return "1 in "+fmtChance(chance||chanceOf(tier));}
/* ===== GACHA HONEST (Fix A+B) =====
   ROLL_RARE_DEN = ambang "label 1 in ≥50.000":
   - Varian di ATAS ambang: peluang asli = labelnya (Fix A), bobotnya juga dikali luck (Fix B —
     luck langsung ngefek dari roll pertama, khusus rare; kartu common dibekukan).
   - Varian di BAWAH ambang = common spam: bobotnya di-scale faktor K supaya MENYERAP sisa
     peluang pool (total selalu 100%) — kartu umum memang dibuat gampang by design.
   K ≈ (1 − Σ peluang rare) / Σ peluang common, dihitung dari pool gacha yang lagi aktif. */
const ROLL_RARE_DEN=50000;
function rollCommonScale(){
  if(typeof gachaPool!=="function"||typeof SHINY_MULT==="undefined")return 1;
  const MUTS=["none","gold","rainbow","secret","ultima"];
  let rare=0,common=0;
  for(const c of gachaPool()){
    const base=c.chance||chanceOf(c.tier);
    for(const sh of [1,SHINY_MULT])for(const k of MUTS){
      const den=base*sh*(MUT_MULT[k]||1);
      if(den>=ROLL_RARE_DEN)rare+=1/den;else common+=1/den;
    }
  }
  rare=Math.min(0.5,rare); /* jaga-jaga: Σ rare harus jauh di bawah 1 */
  return common>0?(1-rare)/common:1;
}
/* Peluang efektif sebuah kartu (UNTUK TAMPILAN): tiap lapisan kelangkaan mengali penyebut
   sesuai pengali stat-nya — SHINY ×2, mutasi ×MUT_MULT (gold 5 / rainbow 10 / secret 25).
   Fix A: rare (den ≥ ROLL_RARE_DEN) tampil apa adanya = peluang asli; common tampil 1/P asli (den/K). */
function effChance(charId,mut,shiny){
  const c=CARDS[charId]||{};
  const ch=c.chance||chanceOf(c.tier);
  const den=ch*(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);
  return den>=ROLL_RARE_DEN?den:den/rollCommonScale();
}
// Total luck = (base + flat) × (1 + percent). Base = stat pemain, Flat dari skill tree/artifact/pet, Percent dari artifact/pet.
/* ===== DATA ARTEFAK & PET =====
   Semua passive LUCK (flat + persen) — kuat buat chance ekstrem (1 in miliaran).
   Artefak: beli pakai coin, equip maks 2 slot — LUCK artefak hanya dihitung dari slot terpasang. Pet: beli pakai coin, equip 1. */
const ART_DEFS=[
  {id:"manik", name:"MANIK REZEKI",       icon:"manik", color:"#5eead4", price:10000000, flat:5,  pct:0, img:"assets/artifacts/manik.png"},
  {id:"medal", name:"MEDAL KEBERUNTUNGAN",icon:"medal", color:"#fcd34d", price:20000000, flat:10, pct:10, img:"assets/artifacts/medal.png"},
  {id:"giok",  name:"GIOK HOKI",          icon:"giok",  color:"#4ade80", price:35000000, flat:25, pct:0, img:"assets/artifacts/giok.png"},
  {id:"batu",  name:"BATU UNTUNG",        icon:"batu",  color:"#7DF9FF", price:50000000, flat:0,  pct:25, img:"assets/artifacts/batu.png"},
  {id:"cincin",name:"CINCIN ES",          icon:"cincin",color:"#93c5fd", price:70000000, flat:50, pct:30, img:"assets/artifacts/cincin.png"},
  {id:"intan", name:"INTAN KUASA",        icon:"intan", color:"#f0abfc", price:100000000,flat:75, pct:75, img:"assets/artifacts/intan.png"},
  /* CRAYON V2 — kanal via src: "coin" (Backpack) · "raid" (Toko Raid, cost=token) · "tower" (drop Inf Tower, base rate TANPA luck). */
  {id:"pedang-api",   name:"PEDANG API",   icon:"pedang-api",   color:"#fb923c", src:"tower", flat:120, pct:100, img:"assets/artifacts/pedang-api.png"},
  {id:"helm-abyss",   name:"HELM ABYSS",   icon:"helm-abyss",   color:"#818cf8", src:"raid",  raidCost:5000,  flat:80, pct:120, img:"assets/artifacts/abyss-helm.png"},
  {id:"tameng-surgawi",name:"TAMENG SURGAWI",icon:"tameng-surgawi",color:"#fde68a",src:"coin", price:1000000000,flat:50, pct:200, img:"assets/artifacts/tameng-surgawi.png"},
  {id:"tome-infinity", name:"TOME OF INFINITY", icon:"tome-infinity", color:"#00f0ff", src:"premium", gemPrice:500, flat:150, pct:200, img:"assets/artifacts/tome-infinity.webp?v=1"}
];
const PET_DEFS=[
  {id:"doll",        name:"BONEKA TERKUTUK",img:"assets/pets/doll.png",        emoji:"🎎",price:10000000, flat:10, pct:0},
  {id:"otherworldly",name:"MAKHLUK LAIN",   img:"assets/pets/otherworldly.png",emoji:"👾",price:20000000, flat:25, pct:0},
  {id:"titan",       name:"TITAN BUAS",     img:"assets/pets/titan.png",       emoji:"🗿",price:35000000, flat:50, pct:0},
  {id:"dragon",      name:"BONE DRAGON",    img:"assets/pets/dragon.png",      emoji:"🐉",price:50000000, flat:50, pct:15},
  {id:"nine-tail",   name:"EKOR SEMBILAN",  img:"assets/pets/nine-tail.png",   emoji:"🐺",price:70000000, flat:50, pct:25},
  {id:"bijuu",       name:"BIJUU",          img:"assets/pets/bijuu.png",       emoji:"🦊",price:100000000,flat:100,pct:50},
  /* CRAYON V2 — pet BARU (pet lama tidak ditimpa). src sama seperti artefak. */
  {id:"kyubi",       name:"KYUBI FOX",      img:"assets/pets/kyubi.png",      emoji:"🦊",src:"tower",flat:200,pct:300},
  {id:"nebula-wisp", name:"NEBULA WISP",    img:"assets/pets/nebula-wisp.png",emoji:"🌌",src:"raid", raidCost:15000,flat:150,pct:220},
  {id:"next-bot",    name:"NEXT-BOT",       img:"assets/pets/next-bot.png",   emoji:"🤖",src:"coin", price:5000000000,flat:120,pct:150},
  {id:"cyber-kitsune", name:"CYBER KITSUNE", img:"assets/pets/cyber-kitsune.webp?v=1", emoji:"🦊", src:"premium", gemPrice:1000, flat:250, pct:300}
];
function luckTxt(d){const a=[];if(d.flat)a.push("+"+d.flat+" FLAT");if(d.pct)a.push("+"+d.pct+"%");return a.join(" & ")+" LUCK";}
function artLuckFlat(){return state&&Array.isArray(state.artSlots)?state.artSlots.reduce((a,id)=>a+((ART_DEFS.find(x=>x.id===id)||{}).flat||0),0):0;}
function artLuckPct(){return state&&Array.isArray(state.artSlots)?state.artSlots.reduce((a,id)=>a+((ART_DEFS.find(x=>x.id===id)||{}).pct||0),0):0;}
function petLuckFlat(){const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;return d?(d.flat||0):0;}
function petLuckPct(){const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;return d?(d.pct||0):0;}
function totalLuck(){const p=state?.player||{};const base=p.luckBase??p.luck??1;const flat=(p.luckFlat||0)+treeLuckFlat()+activeLuckBuff()+artLuckFlat()+petLuckFlat();const pct=(p.luckPercent||0)+treeLuckPct()+activeLuckBuffPct()+artLuckPct()+petLuckPct();return (base+flat)*(1+pct)*weatherLuckMult();}
// Chance yang ditampilkan ke user = peluang ASLI ternormalisasi (Fix A): rare = label mentah,
// common = 1/P asli lewat effChance(). Luck tetap jalan di bobot roll (khusus rare) + keliatan di Profil.
function luckChance(charId,mut,shiny){return effChance(charId,mut,shiny);}
/* =============== STORY BIBLE ===============
   Satu-satunya tempat data karakter & alur story.
   CARDS, FOES, pool gacha, dan stat musuh diturunkan otomatis dari blok ini. */
const STORY_BIBLE={
  chapters:[{no:1, zone:"BAB 1", tag:"STORY · BAB 1",
    lore:[
      "Di lembah antara dua gunung, sebuah desa ninja mempertahankan gerbang batu peninggalan leluhur. Enam petarung menjaga jalan masuk, masing-masing membawa satu jurus warisan yang tidak pernah diajarkan keluar desa.",
      "Kabar tentang gerbang yang terbuka itu menyebar cepat: siapa pun yang berhasil menumbangkan seluruh penjaga berhak melewati desa dan mengambil sumber tenaga yang tersimpan di menara tengahnya.",
      "Kamu melangkah masuk dari gerbang luar. Setiap penjaga yang kamu kalahkan akan mencatat jurusnya ke dalam kartumu — jadi kalah sekali pun bukan berarti pulang tangan kosong."
    ],
    levels:[
      {unit:"CH_UNSTOPPABLE_FIST",reward:300},
      {unit:"CH_COPY_NINJA",reward:450},
      {unit:"CH_AWAKENED_DARK_AVENGER",reward:650},
      {unit:"CH_AWAKENED_PROMISED_CHILD",reward:900},
      {unit:"CH_SIX_PATHS_OF_PAIN",reward:1300},
      {unit:"CH_BIJUU_BEAST",reward:2400,boss:true}
    ]},
  {no:2, zone:"BAB 2", tag:"STORY · BAB 2",
    lore:[
      "Gerbang batu desa itu ternyata bukan cuma jalan keluar. Setelah enam penjaganya tumbang, coretan di permukaannya menyala dan membuka satu jalur teleportasi ke planet hijau yang terapung di luar orbit — arena tempat para petarung antariksa mengadu tenaga sejak lama.",
      "Enam jagoan Green Planet tidak menjaga apa pun. Mereka hanya menunggu lawan yang layak, dan masing-masing membawa satu jurus yang sudah mereka asah bertahun-tahun di gravitasi yang jauh lebih berat dari dunia asalmu.",
      "Papan rekor di gerbang planet mencatat tenaga tempur tertinggi 686. Selama rekornya belum dilewati, planet ini akan terus menahan jalanmu — jadi setiap kartu yang kamu kalahkan di sini akan tercatat permanen di indeks kartumu."
    ],
    levels:[
      {unit:"CH_ULTIMATE_WARRIOR",reward:3000},
      {unit:"CH_BODY_SWITCHER",reward:3800},
      {unit:"CH_NAMEKIAN_SAGE",reward:4700},
      {unit:"CH_AWAKENED_PRIDEFUL_PRINCE",reward:5800},
      {unit:"CH_AWAKENED_EARTHS_STRONGEST",reward:7200},
      {unit:"CH_AWAKENED_GALACTIC_TYRANT",reward:11000,boss:true}
    ]},
  {no:3, zone:"BAB 3", tag:"STORY · BAB 3",
    lore:[
      "Setelah planet hijau takluk, jalur teleportasi terbuka lagi dan membawamu ke sebuah stasiun bawah tanah yang seharusnya sudah tutup: Shibuya Station. Lampu darurat berkedip, peron kosong, dan kutukan merayap di balik tiang-tiang beton.",
      "Enam kutukan menempati stasiun ini, masing-masing memegang satu teknik terlarang. Papan tujuan di peron menunjukkan angka tenaga tempur puncak 1.274 — angka yang harus kamu lewati kalau ingin melangkah keluar dari stasiun.",
      "Suara langkah menggema dari dalam terowongan. Setiap kutukan yang kamu kalahkan akan mencatat tekniknya ke dalam kartumu, jadi meski kalah kamu tetap pulang membawa sebagian dari kutukan mereka."
    ],
    levels:[
      {unit:"CH_CURSED_DOLL",reward:14000},
      {unit:"CH_SHADOW_SUMMONER",reward:17000},
      {unit:"CH_CURSED_FIST",reward:20000},
      {unit:"CH_RIKAS_BLESSING",reward:24000},
      {unit:"CH_LIMITLESS_MASTER",reward:29000},
      {unit:"CH_KING_OF_CURSES",reward:40000,boss:true}
    ]},
  {no:4, zone:"BAB 4", tag:"STORY · BAB 4",
    lore:[
      "Teleportasi terakhir mengantarmu ke kota kecil yang nyaris tidak tercatat di peta: Mushima Town. Di sini waktu berjalan seperti air di sungai tenang—tenang sampai kau merasakan hawa dingin di leher sendiri. Tiga entitas purba tidur di bawah tanah, masing-masing mengawetkan satu ritual darah yang sudah dilupakan dunia manusia.",
      "Kota ini penuh dengan penduduk yang 'terlalu sempurna'. Mereka tidak bicara, hanya menunggu pembedahan dari tiga ahli waris yang bangkit kembali untuk menyelesaikan ritual nenek moyang mereka.",
      "Tiap entitas yang kamu taklukkan akan meninggalkan jejak darah di tanganmu. Jejak itu bukan kutukan—tapi tanda bahwa kamu berhak melanjutkan perjalanan ke tempat di mana segalanya bermula."
    ],
    levels:[
      {unit:"CH_PORCO_PILLAR",reward:52000},
      {unit:"CH_AWAKENED_STAND_USER",reward:63000},
      {unit:"CH_GOLD_EXPERIENCE Requiem",reward:76000},
      {unit:"CH_THE WORLD",reward:90000},
      {unit:"CH_OPALESTONE_DREAM",reward:108000},
      {unit:"CH_HEAVENS_DOOR",reward:145000,boss:true}
    ]},
  {no:5, zone:"BAB 5", tag:"STORY · BAB 5",
    lore:[
      "Pintu kayu tua muncul tiba-tiba di ujung jalan, tanpa sambungan ke bangunan apa pun. Kamu masuk dan menemukan istana tanpa batas—ruang ruang yang saling bertumpang tindih tanpa logika arsitektur. Tangga putar menghubungkan lantai yang sama, jendela memperlihatkan langit yang berputar lambat.",
      "Tujuh pemburu iblis berdiri di sudut berbeda istana, masing-masing menguasai satu ruangan yang mustahil. Mereka telah menunggu ribuan tahun untuk pengujian terakhir: siapa yang layak melanjutkan tradisi keluarga Tsuzumi hingga penghujung siklus.",
      "Kau tidak bisa mundur. Setiap ruangan yang kau taklukkan mengunci pintu keluar sebelumnya. Tapi tiap kemenangan mengembalikan satu memori hilang dari masa lalumu—dan pada akhirnya, itu adalah imbalan terbesar."
    ],
    levels:[
      {unit:"CH_TANJIRO_BLADE",reward:165000},
      {unit:"CH_NEZUKO_BAMBOO",reward:188000},
      {unit:"CH Zenitsu_THUNDER",reward:212000},
      {unit:"CH_INUIZO_MASK",reward:240000},
      {unit:"CH_SANEMI_WIND",reward:272000},
      {unit:"CH_SHINOBU_BUTTERFLY",reward:320000,boss:true}
    ]}
  ],
  units:[
    /* ================= TEMPLATE KARTU =================
       Isi ulang array ini dengan kartu baru. Tiap entri = satu kartu, bentuk:
       {id:"CH_...", name:"Nama", tier:"R"|"SR"|"SSR"|"UR"|"EX"|"BOSS", type:"Offensive",
        skill:"Nama Skill", hp:123, atk:45, chance:1000,
        art:"assets/cards/art/slug.webp", fx:{double:15},
        desc:"Deskripsi passive yang tampil di kartu.",
        noGacha:false}
       - id harus unik dan cocok dengan field "unit" di chapter (Story) yang memakainya.
       - chance = peluang drop "1 in N" per kartu. WAJIB diisi manual; ini satu-satunya yang menentukan rarity.
         Kalau kosong, fallback ke TIER_CHANCE[tier] (nilai tengah band tier).
       - tier = 100% KOSMETIK (warna badge + label). Tidak affect drop rate, stat scaling, atau pool.
         Saran band: R<50k, SR<500k, SSR<5jt, UR<500jt, EX>=500jt. Helper `tierFromChance(ch)` tersedia.
       - noGacha:true -> tidak muncul di Roll (hanya hadiah/Toko Raid).
       - raidBoss:true -> kartu BOSS Toko Raid: TIDAK bisa di-roll di mana pun SEBELI dibeli
         (state.raidShopOwned[id]=true lewat pembelian, fallback: sudah punya stack),
         PERMANEN bisa di-roll sesudahnya (lihat bossRollUnlocked + gachaPool).
       - fx = passive. Kunci yang didukung engine battle:
           double:15            -> 15% serang 2x beruntun
           crit:{chance,mult}   -> peluang crit x mult
           pierce:30            -> 30% tembus defense
           barrage:{chance,min,max,mult} -> gelombang N sambaran
           evasion:{chance,turns}        -> peluang hindari serangan
           lifesteal:15         -> serap 15% damage jadi HP
           void:20              -> 20% meniadakan damage musuh (jadi heal)
           highHpDmg:{above,bonus} / lowHpAtk:{below,bonus} -> bonus dmg situasional
           revive:1             -> bangkit 100% HP sekali saat mati
           dmgMult:2            -> SEMUA serangan x2 damage
           ignoreDef:1          -> serangan menembus evasion & void musuh
           purple:{chance,mult} -> Galaxy Roar (eksklusif id CH_ETERNAL_DRAGON)
           domain / ranton      -> khusus id EX tertentu (Gojo / Madara)
           dodgeAtk:{chance,pct,max} -> hindari serangan (chance%), tiap dodge +pct% ATK permanen (stack s/d max)
           everySecond:{mult}   -> tiap serangan GENAP (ke-2,ke-4,..) ×mult damage + tembus damage reduction musuh
           lastStand:{pct}      -> fatal pertama ditahan di 1 HP (sekali) + langsung +pct% ATK
           styleSwitching:1    -> 4 mode bergilir tiap giliran: TRICKSTER(hindari ser. giliran itu) / SWORDMASTER(dmg x1.5) / ROYALGUARD(dmg masuk x0.5 + counter 30%) / GUNSLINGER(splash +40%)
           burst:{turns,mult}  -> untuk N giliran pertama sejak kartu masuk, semua stat (HP & ATK) ×mult. Setelah itu kembali normal.
           hpDrain:{pct}        -> tiap serangan yang kena, kurangi MAX HP musuh sebesar pct% (permanen, compounding).
           lifetime:{turns}     -> setelah N giliran sejak kartu masuk, kartu ini mati instan (self-destruct, trigger tag-in/kalah).
           entryCounter:{mult}  -> saat masuk arena, serangan PERTAMA musuh otomatis meleset lalu kartu ini membalas (counter) sebesar mult× ATK. mult:0 = KLON MURNI menghindar tanpa balasan (counter dilewati). Field opsional `text` mengganti label float dodge (default "AMENOTEJIKARA").
           dodgeEvery:{turns}   -> setiap N giliran sejak masuk, pasti menghindari serangan musuh pada giliran itu (deterministik).
           everyNth:{n,mult}    -> tiap serangan ke-N berubah: ×mult damage + menembus pengurangan damage (seperti SATU PERSEN tapi periodenya n). Field opsional `text` mengganti label float (default "SUSANOO CHIDORI").
           lowHpAura:{below,dr,burn:{pct,turns}} -> di bawah `below`% HP: damage masuk dipangkas `dr`% + serangan membakar musuh `pct`% max HP selama `turns` giliran.
            burn:{chance,pct,turns} -> tiap SERANGAN yang kena (total>0), roll chance% -> musuh terbakar `turns` giliran: tiap giliran rugi pct% dari MAX HP musuh (DoT flat, tick di awal giliran player). Status musuh global (bt.eBurn, renew kalau kena lagi). Dipakai jg sama nested burn lowHpAura.
           executeOnEntry:{pct}  -> saat masuk arena, kalau HP musuh saat ini < pct% dari HP kartu ini, musuh langsung dihancurkan (foeDown). Sekali per masuk.
           entryShatter:{pct} -> saat masuk arena, ledakan pecah: berikan pct% dari total HP musuh saat ini sebagai damage langsung (flat, bypass evasion/void spt wallTitans). Karena arena cuma punya 1 kartu musuh aktif, "sebar rata ke semua kartu" = seluruh damage jatuh ke kartu aktif. Sekali per masuk.
            entryMaxHp:{pct}   -> saat masuk arena, kartu aktif musuh menerima damage FLAT sebesar pct% dari MAX HP musuh (bypass evasion/void spt entryShatter). Boss NPC (bt.en.boss) KEBAL. Sekali per masuk (guard: bt.bioGuard[]).
            turnMaxHp:{pct}    -> tiap giliran kartu ini aktif & hidup (termasuk giliran kena stun), kartu aktif musuh rugi pct% MAX HP sebagai damage flat. Boss NPC KEBAL. Gak jalan waktu kartu lagi dikuasai bayangan (fx={}).
            splitDeath:{pct,times} -> saat MATI (setelah regression, sebelum revive): kalau charge tersisa, badan baru dengan pMax & ATK ×pct/100 (kumulatif antar split), HP penuh, charge--, flag sekali-per-battle di-refresh TAPI efek "saat masuk" TIDAK re-arm. Boss NPC TIDAK menghalangi.
            deathDefy:{pct}    -> saat FATAL DAMAGE dengan HP sebelum pukulan < pct% max: TIDAK tumbang — bertahan di 0 HP untuk 1 giliran ekstra (masih bisa menyerang), lalu jatuh di awal enemyPhase berikutnya (trySave jalan normal). Sekali per battle (bt.defyUsed). Gak jalan saat dikuasai bayangan. Boss TIDAK kebal (tidak disebut di desc).
            openingHit:{pct}   -> serangan PERTAMA ke kartu musuh BARU ×(1+pct%) damage. Guard level battle `bt.openGuard` (bukan per-fighter): di-arm saat musuh masuk arena (startBattle/startTowerAdvance) & tiap gelombang menara baru. Dikonsumsi pada percobaan serangan pertama (miss/evade tetap menghabiskan). Tag-in PEMAIN tidak re-arm. Gak jalan saat dikuasai bayangan (fx={}).
            desperateStrike:{below,mult,text} -> di bawah `below`% HP (cek tiap playerPhase), serangan berikutnya ×mult SEKALI (state bt.dsState[a]: 0->1 armed, 1->2 saat dilepas). Setelah serangan itu, kartu MATI di awal enemyPhase berikutnya ("mati di akhir giliran", pola deathDefy: ko + trySave). Stun menunda (charge tetap tersimpan, gak kebuang).
           statusImmune:1     -> IMMUNE total terhadap status negatif: STUN dibatalkan (float "IMMUNE", giliran tetap jalan), burn/DoT/drain/stun yang menyasar kartu ini ditolak — jalan saat kartu ini PEMAIN maupun LAWAN.
           iceBlast:{chance,pct,hits} -> peluang chance% melempar ICE BLAST: `hits` tembakan @ pct% ATK (menggantikan hit giliran itu, label float "ICE BLAST ×N"). Mis. {chance:50,pct:75,hits:3} = 50% → 3 × 75% ATK.
           transform:{mult}     -> permanen sejak masuk arena: HP & ATK ×mult (gak ada expiry, beda sama burst).
           wallTitans:{every,pct} -> tiap `every` giliran sejak masuk, sambaran BONUS sebesar pct% ATK ke musuh (di luar serangan normal).
           rumbling:{turns,pct}  -> saat kartu ini MATI (bukan revive/lastStand), musuh kena DoT pct% max HP-nya selama `turns` giliran berikutnya, terus jalan walau kartu udah ganti.
           bungeeGum:{turns,bonus} -> tiap kali kartu ini KENA SERANG musuh, tempel "gum" ke musuh selama `turns` giliran; selama gum aktif semua serangan kartu ini ×(1+bonus/100) damage. Gum ikut pindah ke musuh berikutnya kalau yang kena gum mati (counter `bt.gumTurns` di sisi musuh).
           snatch:{pct} -> tiap kali kartu ini MENGALAHKAN kartu musuh (foeDown), curi permanen pct% ATK & pct% max HP musuh yang mati lalu tambah ke stat kartu ini (flat, persist antar tag-in via `bt.snatchAtk[a]`/`bt.snatchHp[a]`).
           psychicBarrier:{dr,turns,healPct} -> saat masuk arena, aktifkan barrier selama `turns` giliran: damage musuh masuk dipangkas `dr`% + tiap serangan yang diredam memulihkan `healPct`% max HP kartu ini (heal permanen). Re-arm tiap kartu ini masuk. (BLIZZARD BADDIE)
           entryAtkPct:{pct} -> saat masuk arena, ledakan serpihan: kartu aktif musuh menerima damage FLAT sebesar `pct`% dari ATK kartu ini (bypass evasion/void spt entryShatter). Sekali per masuk. (PAPER PAL)
            sleepStrike:{turns,mult,text} -> saat masuk arena, kartu TIDUR selama `turns` giliran (melewati serangan, float "TERTIDUR" — self-sleep, gak ke-block statusImmune). Pas tidur habis, serangan berikutnya di-arm ×mult (label float `text`, default "THUNDERCLAP FLASH"). Kalau serangan itu MENGALAHKAN musuh, sisa overkill disimpan di `bt.overflow` dan menghantam musuh berikutnya pas gelombang menara berganti (advanceTowerFoe). Re-arm tiap kartu ini masuk/tag-in/regression. (THUNDER PRODIGY)
           arise:{pct,turns} -> (Shadow Monarch) saat kartu ini membunuh DAN masih ada gelombang musuh berikutnya (menara), bangkitkan musuh yang mati sebagai BAYANGAN dengan pct% ATK & HP-nya. Bayangan MENGAMBIL-ALIH slot kartu ini (HP asli disimpan di `bt.shadow.retHp/retMax`), menyerang dengan atk bayangan (passive Monarch dimatikan: `fx={}` selama possess) selama `turns` giliran ATAU sampai bayangan tumbang (trySave → endPossession, Monarch balik utuh). State: `bt.shadow`.
           prideOfPrince:{pct} -> (Royal Vanguard) tiap KARTU PARTY JATUH (di `trySave`, setelah revive/lastStand gagal), semua kartu di `bt.fighters` yang punya fx ini dapat `bt.atkBuff[i]+=pct` (permanen buat sisa battle, numpuk). `atkBuff` dipakai playerPhase `atk*(1+atkBuff/100)` — jadi pas Vanguard aktif dia udah lebih kuat. Jalan walau Vanguard lagi nunggu di bench (buff nyimpen di index-nya).
           regression:{hpPct} -> (Regressor) kill-banked revive. Tiap Regressor BUNUH musuh (di `foeDown`, blok yang sama dgn snatch/arise): `bt.regressCharges[a]++`. Di `trySave` (SETELAH cek shadow, SEBELUM fx.revive): kalau `fx.regression && bt.regressCharges[a]>0` → `regressCharges[a]--`, `bt.pHp=round(bt.pMax*hpPct/100)`, lalu "skill di-refresh" (reset revUsed/standUsed/burstStart=turn/dodgeCount/atkCount/wtCount, re-arm entryGuard/execGuard). return true (bangkit di tempat, gak tag-in). Tiap kebangkitan "bayar" 1 kill → gak abadi. Butuh kill dulu = butuh mode multi-musuh (menara); story 1 musuh gak bisa demo.
            entryFreeze:{turns,mult} -> saat masuk arena, bekukan kartu aktif musuh selama `turns` giliran (pakai mekanik eStun — musuh dilewati; KEBAL kalau foe statusImmune; float "BEKU"). Counter global `bt.freezeLeft` tick tiap enemyPhase; selama >0 serangan kartu ini ×mult ke target. Re-arm tiap masuk/tag-in/regression. (10TH CAPTAIN)
            iceShell:dr -> selama kartu ini AKTIF di arena, semua damage musuh masuk dipangkas `dr`% permanen (tanpa timer; hilang kalau kartu tag-out). (10TH CAPTAIN)
            heavyRain:{turns,healPct} -> saat masuk arena, pasang hujan `turns` giliran (`bt.rain`): tiap giliran kartu ini pulih `healPct`% max HP — jalan walau kena stun (spt turnMaxHp). Re-arm tiap masuk/tag-in/regression. (OCEAN'S GUARDIAN)
            shockwave:{every,pct} -> setiap serangan ke-`every` (counter `bt.shockCount[a]`, hitungan serangan beneran — stun gak ngitung), kartu aktif musuh kena damage FLAT pct% ATK di luar serangan normal (gaya wallTitans; arena 1 musuh aktif, jadi "semua musuh" jatuh ke kartu aktif). (OCEAN'S GUARDIAN)
            timeStop:{turns,every} -> saat masuk arena + setiap serangan ke-`every` (counter bt.atkCount[a]), stun kartu aktif musuh selama `turns` giliran (mekanik eStun - musuh dilewati; KEBAL kalau foe statusImmune; float "THE WORLD"). Selama time stop aktif, serangan kartu ini MENEMBUS efx.evasion/efx.void musuh ("tidak bisa di-dodge"). Re-arm tiap masuk/tag-in/regression/tower. (IMMORTAL VAMPIRE)
            killHeal:{pct} -> tiap kali kartu ini MENGALAHKAN kartu musuh (di foeDown, blok snatch/regression): heal pct% max HP + float "HISAP DARAH". (IMMORTAL VAMPIRE)
   freezeTransfer:1 -> (ABSOLUTE ZERO) di foeDown blok snatch: musuh tumbang selama bt.freezeLeft>0 (target lagi beku) -> bt.freezeNext=true. Di advanceTowerFoe (musuh gelombang berikutnya masuk): flag habis -> eStun=1 + freezeLeft=1 + float "BEKU" (guard foeStatusImmune), flag di-reset. Story musuh 1 kartu jadi efektifnya di menara.
   foeEntryFreeze:{turns} -> (ICE QUEEN) di advanceTowerFoe: musuh BARU masuk arena -> bekukan turns giliran (eStun+freezeLeft, float "BEKU", KEBAL kalau foe statusImmune). Dicek tiap musuh masuk jadi re-arm otomatis.
   hitFreeze:{chance,turns,mult} -> (ICE QUEEN) di playerPhase: serangan dgn total>0 & musuh masih hidup -> chance% bekukan turns giliran (eStun+freezeLeft, pola burn + guard statusImmune; float "BEKU"). Selama target beku (freezeLeft>0) serangan kartu ini xmult di blok freeze dmgMult.
            tripleHit:{hits,mult} -> tiap serangan pecah jadi `hits` tembakan (array hits di playerPhase), masing-masing ×`mult` damage - total = hits×mult. (SEA SOVEREIGN)
            flood:{every,mult,exec} -> setiap serangan ke-`every` (counter bt.atkCount[a]; kartu ini gak punya everyNth/everySecond jadi counter bebas): ×mult damage + tembus DR; kalau HP musuh <= exec% max saat itu juga, total damage dipaksa >= HP musuh (eksekusi pasti), float "40-DAY FLOOD". (SEA SOVEREIGN)
puppetPoison:{pct} -> tiap serangan kartu ini deal damage (total>0): musuh kehilangan pct% ATK tambahan PERMANEN selama battle (state bt.ePoison, additive s/d 90%, dipotong dari eAtk di enemyPhase let eAtk=bt.es.atk). Reset tiap lawan ganti (blok eBurn=0). Float "PUPPET -pct% ATK". (PUPPETEER)
puppetBody:{dr} -> DR persen terhadap SEMUA damage masuk (state bt.pGuardDr, digabung sama pDr di perhitungan eShots). Re-arm tiap masuk/tag-in/regression/tower -> kartu lain tanpa fx ini gak kebawa. (PUPPETEER)
sandBurial:{every,mult} -> setiap serangan ke-every (counter bt.atkCount[a]; kartu ini gak punya everyNth/everySecond jadi counter bebas): xmult damage + MENEMBUS efx.evasion/efx.void musuh (guaranteed hit via tsLock; game gak punya mekanik stealth jadi void â‰ˆ veil), float "SAND BURIAL". (SAND VESSEL)
autoBlock:{pct} -> DR persen damage masuk, pakai field sama bt.pGuardDr (1 titik implementasi DR). (SAND VESSEL)
unlimitedVoid:{below,turns,healPct} -> cek di awal playerPhase: kalau HP kartu aktif < below% max (sekali per battle, state bt.voidUsed): set HP ke healPct% max + STUN musuh turns giliran (bt.eStun; kalau foe statusImmune stun dibatalkan, heal tetap jalan). (BLESSED SORCERER)
dimensionShift:{turns} -> saat battle dimulai / kartu ini masuk (startBattle fx0, startTowerBattle tfx) dan saat musuh baru masuk (advanceTowerFoe): ability aktif musuh nonaktif selama turns giliran musuh (state bt.eAbilityOff; enemyPhase memakai efx kosong - void/barrage/iceBlast/double/crit/dmgMult/lowHpAtk lawan mati; tick sejajar freezeLeft). (MOON MOTHER)
   revive:{pct,lock} -> di `trySave` waktu kartu ini tumbang: bangkit sekali dgn pct% HP (default 100% kalau gak diisi) + `lock` -> set `bt.eAbilityOff=lock` jadi ability musuh mati selama lock giliran (tick/trigger re-use rantai dimensionShift). Sekali per battle via `bt.revUsed[a]`. (ALMIGHTY TYRANT; kartu lama dgn revive:pct ikut ke-honor desc-nya)
   gluttony:{pct} -> tiap kartu aktif ini MENGALAHKAN musuh (`foeDown`, blok snatch): serap pct% ATK & pct% max HP musuh ke `bt.snatchAtk[a]`/`bt.snatchHp[a]` (flat, persist antar tag-in - pola snatch) lalu `bt.pCopyFx = copy bt.efx` (TERBARU menggantikan, gak numpuk); `resolveFx` ngasih `pCopyFx` ke kartu selama dia `bt.eq` aktif (bench = dormant). (DEMON SLIME)flood +label -> fx.flood.label opsional ganti teks float (default "40-DAY FLOOD"); eksekusi default 20% lewat fx.flood.exec - exec:0 = TANPA eksekusi (HOLLOW PURPLE Blessed Sorcerer / ASH BONES Moon Mother pakai label+exec sendiri).
   seriousPunch:{charge,mult,wavePct,cd} -> GILIRAN kartu ini MENYERANG: (1) `bt.spCd[a]>0` -> skip serangan sambil cd--; (2) `bt.spTurn[a]`++ selama < `charge` -> skip serangan (float CHARGING); (3) giliran ke-`charge`: arm -> x`mult` damage (blok dmgMult) + hit tambahan `wavePct`% (shockwave, blok hits); reset hitung, `bt.spCd=cd`. State per kartu: spCd/spTurn/spArmed/spWave. (BALD KING)
   meteorWave:{pct} -> guard `bt.meteorGuard[a]` (arming 4 titik persis pola bioGuard/entryMaxHp): saat masuk, damage FLAT sebesar pct% MAX HP kartu ini ke musuh aktif (bypass evasion/void). (METEOR CONQUEROR)
   overheat:{delay,pct} -> setelah `delay` giliran sejak masuk (ukur `bt.burstStart[a]`, pola lifetime): tiap giliran kartu ini rugi pct% MAX HP sendiri (float OVERHEAT); kalau HP habis -> tewas (trySave/endBattle spt lifetime). (METEOR CONQUEROR)
    berserker:{selfDmgPct,atkGainPct,lowPct,undyingTurns,atkMult} -> (THE STRUGGLER) playerPhase tiap giliran: rugi selfDmgPct% max HP + bt.atkBuff[a]+=atkGainPct (STACK permanen, kena di blok atk). HP < lowPct% max -> BERSERKER ARMOR: kebal mati (hp boleh < 0; gate pDead di enemyPhase) selama undyingTurns giliran + serangan xatkMult (blok dmgMult); countdown habis -> tewas paksa (endBattle).
    stripAbility:1 -> (WHITE HAWK) di enemyPhase, serangan musuh yang KENA (etotal>0): bt.eAbilityOff=999 -> ability musuh mati permanen (makan mekanik dimensionShift: efx foe kosong). Miss musuh tiap 3 giliran pake fx dodgeEvery {turns:3} yang sudah ada.
    valhalla:{turns,dmgCut,atkPct,healPct,master:{mult,stun}} -> (HEIGHT OF PAINTING) arming entry 4 titik (fx0/nfx/regression fx/tfx): bt.valhallaLeft=turns. playerPhase: +atkPct% ATK/giliran (stack) selama countdown; habis -> heal healPct% max HP. enemyPhase: damage masuk dipangkas dmgCut% + HP floor di 1 (gak bisa tewas selama aktif). Blok dmgMult: serangan ke-3 -> MASTERPIECE xmult (pakai counter bt.paintHits[a]) + stun musuh master.stun giliran (guard statusImmune).
    dmgCut:{pct} -> (INK ANAMLOY) selama kartu AKTIF di arena, damage masuk dipangkas pct% permanen (pola iceShell, tanpa timer; hilang pas tag-out).
    inkCorrupt:{pct,max} -> (INK ANAMLOY) serangan yang KENA (total>0): bt.eInk++ (cap max) + simpan bt.eInkPct; enemyPhase blok eAtk: ATK musuh dipangkas eInk x eInkPct% (permanen selama musuh ini berdiri, reset eInk=0 pas ganti gelombang lewat init bt / ePoison neighbor - TIDAK, eInk persist sengaja).
    inkDrain:{pct,every} -> (INK ANAMLOY) serangan ke-`every` (counter bt.paintHits[a], sama dgn masterpiece): heal pct% max... TIDAK - heal pct% dari damage yang DIBERIKAN serangan itu (total>0). fx.revive ditambah opsi stun:N -> trySave blok revive: musuh kena stun N giliran (guard statusImmune).
    dupEntry:1 -> (GLITCHED ENTITY) arming entry 4 titik (fx0/nfx/regression fx/tfx): stats diduplikasi 2x on entry - bt.pMax x2 + HP penuh + bt.atkBuff[aktif]+100 (ATK x2).
    maxCorrupt:{pct} -> (GLITCHED ENTITY) playerPhase: serangan KENA (total>0, musuh hidup): bt.es.hp turun pct% permanen (max HP musuh corrupt, eHp clamp ke max baru, bar foe update).
    worldCorrupt:{every,pct,dmgUp} -> (THE GRIEFER) arming entry 4 titik: bt.wc={c:0,atk:atk dasar Griefer,every,pct,dmgUp}. enemyPhase: counter tiap giliran musuh; tiap every -> musuh GLITCH: self-hit pct% ATK Griefer (tanpa DR) + semua slot party +dmgUp% ATK (stack, sisa battle).
    deathRear:{hpPct} -> (THE GRIEFER) kematian PERTAMA kali (trySave setelah revive/lastStand): di-remove dari rotasi (tag-in normal) + tandai rearIdx/rearWaiting; saat rantai party habis -> balik jadi kartu terakhir dgn hpPct% HP. Sekali per battle.
    grieferAtk:{mult} -> (THE GRIEFER) playerPhase: total damage serangan ini xmult.
    senzu:{healPct,every,eatMult,strikeMult,atkGain,hpGain,maxMult} -> (DUMB HAIR GUY) playerPhase: heal healPct% max HP tiap giliran; serangan dikali eatMult selama makan; tiap every giliran FINISH MEAL -> serangan xstrikeMult, lalu gain atkGain% damage sbg flat ATK + hpGain% sbg max HP (hingga maxMultx stats dasar).
    stretch:{balloon:{reflect},fireworks:{mult},flop:{healPct}} -> (DUMB STRETCHY GUY) playerPhase: tiap serangan trigger random: BALLOON -> tak damage + reflect reflect% dari hit musuh berikutnya; FIREWORKS -> hit musuh xmult ATK dasar (terpisah dari serangan normal); FLOP -> miss tapi heal healPct% max HP.
    havocRocket:{maxUses,pct} -> (HAVOC WREACKER) setiap masuk arena (aktif langsung): luncurkan roket damage FLAT pct% ATK ke musuh AKTIF + pancar ke SELURUH slot CADANGAN tower via lineupAoeHit (cadangan kehabisan HP -> w.dead / mati). Maksimal maxUses kali per battle.
    getExcited:1 -> (HAVOC WREACKER) foeDown blok freezeTransfer: kartu ini membunuh -> bt.excited=true; di akhir advanceTowerFoe jadwal diganti playerPhase (serangan ekstra) alih-alih enemyPhase.
    rewind:{pct,stun} -> (TIME TRICKSTER) trySave sebelum blok revive, sekali via bt.revUsed: heal pct% max HP + damage musuh SEJUMLAH heal itu + stun stun giliran (guard statusImmune). Kalau lethal, playerPhase berikutnya langsung foeDown (guard eHp<=0).
    turret:{start,every,atkPct,blockPct} -> (YORDLE INVENTOR) arming entry 4 titik: bt.turret=start. playerPhase: tiap every giliran +1 turret (guard bt.turretTurn); serangan: dmgMult*=(1+turret*atkPct/100). enemyPhase: kena hit & random<blockPct -> etotal=0 + turret-- (hancur).
    lineupAoeHit(dmg) -> helper (dekat advanceTowerFoe): TOWER ONLY. Loop waves sisa idx+1: lazy w.hp-=dmg; w.hp<=0 -> w.dead (dilewati advanceTowerFoe, rail KO + bar HP). Re-render .foe-rail + float. Foe AKTIF tidak disentuh (caller sudah).
    worldEnder:{cyc1,cyc2,pierce,healPct,revive:{dr}} -> (DARKIN LORD) playerPhase blok hits (setelah const hits): counter bt.weCount[a] mod 3 -> serangan 1 x cyc1; serangan 2 x cyc2 + lineupAoeHit ke seluruh cadangan; serangan 3 x pierce + lineupNextHit ke cadangan di belakang musuh. Lifesteal: heal healPct% dari total damage giliran ini (total+weExtra), x1.3 setelah revive. trySave blok custom sebelum fx.revive: kematian PERTAMA (revUsed) -> full HP + bt.pDr=dr permanen (pDrTurns 9999) + weRevived.

    psychicBarrage:{rocks,mult,streakPct,reviveRocks} -> (PSYCHIC ESPER) playerPhase blok hits: ganti serangan jadi N batu (bt.pbRocks||rocks) @ mult; tiap batu pilih target - 50% musuh AKTIF (masuk shots) / 50% cadangan tower acak (damage langsung w.hp, rail refresh); streak target sama berturut-turut -> +streakPct% per batu (bt.pbKey/bt.pbStreak). Semua batu jatuh ke cadangan -> push mult 0 biar pipeline crit gak crash. trySave custom: kematian PERTAMA -> full HP + bt.pbRocks=reviveRocks.

    rubberField:{drPct,bouncePct,dizzyPct,dizzyTurns} -> (SUN GOD) arming 4 titik ASSIGNMENT bt.rubber=!!fxX.rubberField (ikut mati pas tag-out). enemyPhase setelah blok dmgCut: etotal dipotong 50% + rbBounce=separuhnya; penyerang kena DIZZY (guard statusImmune): dizzyStack++ + dizzyLeft=9. Setelah hit (dekat royalNow counter): rbBounce dipukulkan balik ke musuh, bisa foeDown. playerPhase blok dmgMult: x(1+dizzyStack*0.2) selama dizzyLeft>0. Tick tiap awal enemyPhase; advanceTowerFoe reset semua.

    lineupNextHit(dmg) -> helper (sebelum lineupAoeHit): TOWER ONLY. damage FLAT ke cadangan tower terdepan yang masih hidup (w.hp lazy-init -> w.dead); story no-op. Re-render .foe-rail + float PIERCE.
       ==================================================== */
        /* ============ MUSUH CERITA (noGacha — hanya lawan di Story) ============ */
    {id:"CH_UNSTOPPABLE_FIST",name:"GREEN BEAST",tier:"R",type:"Offensive",skill:"EIGHT GATES",hp:211,atk:105,art:"assets/cards/art/green-beast.webp",fx:{double:15},noGacha:true,
      desc:"15% peluang membuka serangan dengan dua pukulan beruntun."},
    {id:"CH_COPY_NINJA",name:"COPYBLADE MENTOR",tier:"R",type:"Balanced",skill:"IMPERIAL BLADE FUSION",hp:234,atk:117,art:"assets/cards/art/copyblade-mentor.webp",fx:{copy:1},noGacha:true,
      desc:"Sharingan menyalin SELURUH passive lawan di tiap pertarungan — jurus musuh dipakai balik oleh Copy Ninja."},
    {id:"CH_AWAKENED_DARK_AVENGER",name:"DARKIN LORD",tier:"SR",type:"Offensive",skill:"THE WORLD ENDER",hp:260,atk:130,art:"assets/cards/art/darkin-lord.webp",fx:{crit:{chance:25,mult:1.4}},noGacha:true,
      desc:"25% serangan berubah jadi tusukan arus dengan damage ×1.4."},
    {id:"CH_AWAKENED_PROMISED_CHILD",name:"TRICKSTER ACE",tier:"SR",type:"Balanced",skill:"BUNGEE GUM",hp:293,atk:146,art:"assets/cards/art/trickster-ace.webp",fx:{pierce:30},noGacha:true,
      desc:"30% peluang serangan menembus pertahanan musuh."},
    {id:"CH_SIX_PATHS_OF_PAIN",name:"SIXFOLD PROPHET",tier:"SSR",type:"Defensive",skill:"ALMIGHTY PUSH",hp:330,atk:165,art:"assets/cards/art/sixfold-prophet.webp",fx:{evasion:{chance:25,turns:99}},noGacha:true,
      desc:"25% setiap serangan musuh ditolak sampai tidak menghasilkan damage sama sekali."},
    {id:"CH_BIJUU_BEAST",name:"NINE-TAIL PRODIGY",tier:"SSR",type:"Offensive",skill:"LIFE FORCE DRAIN",hp:362,atk:181,art:"assets/cards/art/nine-tail-prodigy.webp",fx:{barrage:{chance:30,min:2,max:3},lifesteal:15},noGacha:true,
      desc:"30% peluang menyapu 2-3 kali beruntun, lalu menyerap 15% damage jadi HP."},
    {id:"CH_ULTIMATE_WARRIOR",name:"SOLAR BRAWLER",tier:"SR",type:"Offensive",skill:"LIMIT BREAKER",hp:707,atk:354,art:"assets/cards/art/solar-brawler.webp",fx:{crit:{chance:20,mult:1.5}},noGacha:true,
      desc:"20% serangan berubah jadi ledakan Masenko dengan damage ×1.5."},
    {id:"CH_BODY_SWITCHER",name:"GLITCHED ENTITY",tier:"SR",type:"Balanced",skill:"CORRUPTED DATA",hp:846,atk:423,art:"assets/cards/art/glitched-entity.webp",fx:{double:20,lifesteal:12},noGacha:true,
      desc:"20% peluang menyerang dua kali beruntun, lalu menyerap 12% damage jadi HP."},
    {id:"CH_NAMEKIAN_SAGE",name:"OCEAN'S GUARDIAN",tier:"SSR",type:"Offensive",skill:"FISH-MAN KARATE: VAGABOND DRILL",hp:978,atk:489,art:"assets/cards/art/oceans-guardian.webp",fx:{pierce:45},noGacha:true,
      desc:"45% peluang tembakan tembus yang menembus pertahanan musuh."},
    {id:"CH_AWAKENED_PRIDEFUL_PRINCE",name:"ROYAL VANGUARD",tier:"SSR",type:"Offensive",skill:"PRIDE OF THE PRINCE",hp:1120,atk:558,art:"assets/cards/art/royal-vanguard.webp",fx:{highHpDmg:{above:60,bonus:35}},noGacha:true,
      desc:"Selama HP masih di atas 60%, setiap serangan membawa 35% damage tambahan."},
    {id:"CH_AWAKENED_EARTHS_STRONGEST",name:"SUN GOD",tier:"SSR",type:"Offensive",skill:"RUBBER FIELD",hp:1280,atk:641,art:"assets/cards/art/sun-god.webp",fx:{barrage:{chance:25,min:2,max:3}},noGacha:true,
      desc:"25% peluang melepas gelombang 2-3 tembakan beruntun."},
    {id:"CH_AWAKENED_GALACTIC_TYRANT",name:"GALACTIC TYRANT",tier:"SSR",type:"Absolute Defensive",skill:"DEATH BEAM",hp:1370,atk:686,art:"assets/cards/art/galactic-tyrant.webp",fx:{void:20,lifesteal:15},noGacha:true,
      desc:"20% peluang meniadakan damage musuh dan mengubahnya jadi pemulihan HP, plus menyerap 15% damage."},
    {id:"CH_CURSED_DOLL",name:"PUPPETEER",tier:"SR",type:"Balanced",skill:"HITOKUGUTSU - HUMAN PUPPET",hp:1210,atk:603,art:"assets/cards/art/puppeteer.webp",fx:{double:18},noGacha:true,
      desc:"18% peluang membuka serangan dengan dua hantaman palu beruntun."},
    {id:"CH_SHADOW_SUMMONER",name:"SHADOW MONARCH",tier:"SSR",type:"Defensive",skill:"ARISE",hp:1570,atk:783,art:"assets/cards/art/shadow-monarch.webp",fx:{evasion:{chance:24,turns:2}},noGacha:true,
      desc:"Dua turn pertama punya 24% peluang melepas bayangan penangkis sampai damage musuh jadi nol."},
    {id:"CH_CURSED_FIST",name:"THE STRUGGLER",tier:"SSR",type:"Offensive",skill:"BERSERKER ARMOR",hp:1830,atk:915,art:"assets/cards/art/the-struggler.webp",fx:{crit:{chance:30,mult:1.6}},noGacha:true,
      desc:"30% pukulan berubah jadi tinju kutukan dengan damage ×1.6."},
    {id:"CH_RIKAS_BLESSING",name:"NOBLE COMPANION",tier:"SSR",type:"Balanced",skill:"PASSIONATE NARRATION",hp:1990,atk:996,art:"assets/cards/art/noble-companion.webp",fx:{barrage:{chance:30,min:2,max:3},lifesteal:14},noGacha:true,
      desc:"30% peluang mengaum 2-3 kali beruntun, lalu menyerap 14% damage jadi HP."},
    {id:"CH_LIMITLESS_MASTER",name:"BLESSED MAGE",tier:"SSR",type:"Defensive",skill:"SPIRIT OF ZEPHYR",hp:2140,atk:1070,art:"assets/cards/art/blessed-mage.webp",fx:{pierce:40},noGacha:true,
      desc:"40% peluang melepas Purple yang menembus total pertahanan musuh."},
    {id:"CH_KING_OF_CURSES",name:"ALMIGHTY TYRANT",tier:"SSR",type:"Absolute Offensive",skill:"THE ALMIGHTY",hp:2550,atk:1270,art:"assets/cards/art/almighty-tyrant.webp",fx:{void:22,lifesteal:18},noGacha:true,
      desc:"22% peluang meniadakan damage musuh dan mengubahnya jadi pemulihan HP, plus menyerap 18% damage jadi HP."},
        /* ---- Bab 4–5: def baru (art reuse kartu existing) ---- */
    {id:"CH_PORCO_PILLAR",name:"IMMORTAL COLOSSUS",tier:"SSR",type:"Offensive",skill:"THE RUMBLING",hp:2900,atk:1450,art:"assets/cards/art/immortal-colossus.webp",fx:{crit:{chance:30,mult:1.5}},noGacha:true,
      desc:"30% serangan menghantam dengan rahang purba dengan damage ×1.5."},
    {id:"CH_AWAKENED_STAND_USER",name:"NULLBLADE KNIGHT",tier:"SSR",type:"Balanced",skill:"NULL STANCE",hp:3300,atk:1650,art:"assets/cards/art/nullblade-knight.webp",fx:{double:20},noGacha:true,
      desc:"20% peluang memukul dua kali beruntun — stand-nya bergerak lebih cepat dari penggunanya."},
    {id:"CH_GOLD_EXPERIENCE Requiem",name:"BLESSED SORCERER",tier:"SSR",type:"Balanced",skill:"SIX EYES: HOLLOW PURPLE",hp:3750,atk:1875,art:"assets/cards/art/blessed-sorcerer.webp",fx:{lifesteal:20},noGacha:true,
      desc:"Menyerap 20% dari total damage yang diberikan jadi HP — usaha lawan selalu kembali ke nol."},
    {id:"CH_THE WORLD",name:"TIME MASTER",tier:"UR",type:"Absolute Defensive",skill:"THE WORLD",hp:4250,atk:2125,art:"assets/cards/art/time-master.webp",fx:{void:25,lifesteal:15},noGacha:true,
      desc:"25% peluang menghentikan waktu: damage musuh ditiadakan dan berubah jadi pemulihan HP, plus menyerap 15% damage."},
    {id:"CH_OPALESTONE_DREAM",name:"INK ANAMLOY",tier:"UR",type:"Defensive",skill:"THE INK DEMON",hp:4800,atk:2400,art:"assets/cards/art/ink-anamloy.webp",fx:{evasion:{chance:25,turns:99}},noGacha:true,
      desc:"25% setiap serangan musuh dibelokkan oleh mimpi opal putih sampai tidak menghasilkan damage."},
    {id:"CH_HEAVENS_DOOR",name:"HEIGHT OF PAINTING",tier:"UR",type:"Absolute Balanced",skill:"TWILIGHT OF VALHALLA",hp:5500,atk:2750,art:"assets/cards/art/height-of-painting.webp",fx:{pierce:40},noGacha:true,
      desc:"40% peluang serangan menulis ulang halaman pertahanan musuh — menembus total pertahanan."},
    {id:"CH_TANJIRO_BLADE",name:"SUNBREATH SWORDSMAN",tier:"SSR",type:"Offensive",skill:"WATER BREATHING: FIRST FORM",hp:6200,atk:3100,art:"assets/cards/art/sunbreath-swordsman.webp",fx:{barrage:{chance:30,min:2,max:3}},noGacha:true,
      desc:"30% peluang melepas Jurus Matahari 2-3 tebasan beruntun."},
    {id:"CH_NEZUKO_BAMBOO",name:"YOUNG SPIRIT VESSEL",tier:"SSR",type:"Defensive",skill:"SHADOW CLONE DODGE",hp:7000,atk:3500,art:"assets/cards/art/young-spirit-vessel.webp",fx:{lifesteal:18},noGacha:true,
      desc:"Menyerap 18% dari total damage yang diberikan jadi HP — darah iblis memulihkan dirinya sendiri."},
    {id:"CH Zenitsu_THUNDER",name:"THUNDER PRODIGY",tier:"SSR",type:"Offensive",skill:"THUNDERCLAP FLASH",hp:7900,atk:3950,art:"assets/cards/art/thunder-prodigy.webp",fx:{crit:{chance:35,mult:1.7}},noGacha:true,
      desc:"35% serangan menyambar seperti petir dengan damage ×1.7."},
    {id:"CH_INUIZO_MASK",name:"WILDHEART HUNTER",tier:"UR",type:"Offensive",skill:"JAJANKEN - ROCK",hp:8900,atk:4450,art:"assets/cards/art/wildheart-hunter.webp",fx:{double:25},noGacha:true,
      desc:"25% peluang menerkam dua kali beruntun dengan dual gergaji berkarat."},
    {id:"CH_SANEMI_WIND",name:"WHITE HAWK",tier:"UR",type:"Offensive",skill:"GODHAND CAUSALITY",hp:10000,atk:5000,art:"assets/cards/art/white-hawk.webp",fx:{barrage:{chance:35,min:2,max:3}},noGacha:true,
      desc:"35% peluang badai angin menyapu 2-3 kali beruntun."},
    {id:"CH_SHINOBU_BUTTERFLY",name:"MOON MOTHER",tier:"UR",type:"Absolute Balanced",skill:"AMENOMINAKA",hp:11500,atk:5750,art:"assets/cards/art/moon-mother.webp",fx:{pierce:45,lifesteal:15},noGacha:true,
      desc:"45% peluang sengatan beracun menembus total pertahanan, lalu menyerap 15% damage jadi HP."},
    {id:"CH_RULER",name:"RULER",tier:"EX",type:"Absolute",skill:"VENUZDONOA",hp:4787,atk:2394,chance:850000000,art:"assets/cards/art/ruler.webp",
      fx:{revive:1,dmgMult:2,ignoreDef:1},
      desc:"Saat mati, bangkit dengan 100% HP (sekali). Semua serangan memberikan 2x damage. Efek pengurangan damage musuh diabaikan sepenuhnya. Tidak dapat terkena efek status apapun."},
    {id:"CH_OTHERWORLDLY",name:"OTHERWORLD",tier:"EX",type:"Ultra Instinct",skill:"ULTRA INSTINCT: ONE PERCENT",hp:5120,atk:2560,chance:1000000000,art:"assets/cards/art/otherworldly-being.webp",
      fx:{dodgeAtk:{chance:60,pct:15,max:3},everySecond:{mult:2},lastStand:{pct:15}},
      desc:"60% kesempatan menghindari serangan apapun. Setiap kali menghindar, mendapat +15% ATK permanen (menumpuk hingga 3 kali). Setiap serangan ke-2 menggunakan Satu Persen kekuatannya: memberikan 2x damage dan mengabaikan pengurangan damage. Pertama kali menerima damage fatal, bertahan dengan 1 HP dan mendapat +15% ATK."},
    {id:"CH_DEVIL_HUNTER",name:"DEVIL HUNTER",tier:"UR",type:"Style",skill:"STYLE SWITCHING",hp:4026,atk:2013,chance:450000000,art:"assets/cards/art/devil-hunter.webp",
      fx:{styleSwitching:1},
      desc:"Setiap giliran berganti mode secara berurutan: TRICKSTER (menghindari serangan musuh pada giliran itu), SWORDMASTER (damage 1.5x), ROYALGUARD (menerima 50% lebih sedikit damage dan membalas 30% dari damage yang diterima), GUNSLINGER (serangan juga menghantam target berikutnya sebesar 40%)."},
    {id:"CH_NINE_TAIL",name:"NINE-TAIL PRODIGY",tier:"UR",type:"Jinchuriki",skill:"LIFE FORCE DRAIN",hp:3563,atk:1782,chance:450000000,art:"assets/cards/art/nine-tail-prodigy.webp",pos:"center",
      fx:{burst:{turns:4,mult:1.75},hpDrain:{pct:12},lifetime:{turns:4}},
      desc:"Selama 4 giliran, mendapat 1.75x semua stat dan setiap serangan secara permanen mengurangi max HP musuh sebesar 12%. Setelah 4 giliran, kartu ini mati."},
    {id:"CH_SHADOW_HEIR",name:"SHADOW HEIR",tier:"UR",type:"Dojutsu",skill:"AMENOTEJIKARA / SUSANOO CHIDORI",hp:3563,atk:1782,chance:300000000,art:"assets/cards/art/shadow-heir.webp",pos:"center",
      fx:{entryCounter:{mult:15},dodgeEvery:{turns:3},everyNth:{n:4,mult:3},lowHpAura:{below:30,dr:40,burn:{pct:20,turns:2}}},
      desc:"Saat masuk arena, Amenotejikara membuat serangan pertama musuh meleset dan Shadow Heir langsung melakukan counter sebesar 15x damage. Setiap 3 giliran, Shadow Heir menghindari serangan berikutnya. Setiap serangan ke-4 berubah menjadi Susanoo Chidori yang memberikan 3x damage dan mengabaikan pengurangan damage. Di bawah 30% HP, Perfect Susanoo aktif, memberikan 40% pengurangan damage dan membuat serangan membakar musuh sebesar 20% max HP selama 2 giliran."},
    {id:"CH_FABLED_SOLDIER",name:"FABLED SOLDIER",tier:"UR",type:"Vanguard",skill:"SUPERNOVA",hp:3153,atk:1577,chance:200000000,art:"assets/cards/art/fabled-soldier.webp",pos:"center",
      fx:{executeOnEntry:{pct:20},dmgMult:1.3},
      desc:"Saat masuk, jika HP kartu aktif musuh saat ini kurang dari 20% dari stat Fabled Soldier, langsung hancurkan. Serangan memberikan 1.3x base damage."},
    {id:"CH_IMMORTAL_COLOSSUS",name:"IMMORTAL COLOSSUS",tier:"UR",type:"Titan",skill:"THE RUMBLING",hp:3029,atk:1515,chance:175000000,art:"assets/cards/art/immortal-colossus.webp",pos:"center",
      fx:{transform:{mult:1.5},wallTitans:{every:3,pct:20},rumbling:{turns:2,pct:10}},
      desc:"Saat masuk, transform: 1.5x semua stat. Setiap 3 giliran, Wall Titans berbaris memberikan 20% dari serangan Eren ke semua kartu musuh. Saat mati, the Rumbling berlanjut selama 2 giliran lagi - musuh terkena 10% max HP per giliran bahkan setelah Eren jatuh."},
    {id:"CH_TRICKSTER_ACE",name:"TRICKSTER ACE",tier:"UR",type:"Gum",skill:"BUNGEE GUM",hp:2737,atk:1369,chance:125000000,art:"assets/cards/art/trickster-ace.webp",pos:"center",
      fx:{bungeeGum:{turns:2,bonus:30}},
      desc:"Setelah diserang, tempelkan Bungee Gum ke musuh - selama 2 giliran, semua serangan Trickster Ace memberikan 30% bonus damage ke lawan tersebut. Jika lawan yang terkena gum mati, gum berpindah ke kartu musuh berikutnya yang masuk."},
    {id:"CH_UNDYING_ROGUE",name:"UNDYING ROGUE",tier:"UR",type:"Snatcher",skill:"SNATCH",hp:2195,atk:1098,chance:60000000,art:"assets/cards/art/undying-rogue.webp",pos:"center",
      fx:{snatch:{pct:15}},
      desc:"Ketika Undying Rogue mengalahkan sebuah kartu, secara permanen curi 15% dari stat-nya (ATK & HP) dan tambahkan ke stat miliknya sendiri."},
    {id:"CH_SHADOW_MONARCH",name:"SHADOW MONARCH",tier:"EX",type:"Necromancer",skill:"ARISE",hp:1942,atk:971,chance:40000000,art:"assets/cards/art/shadow-monarch.webp",pos:"center",
      fx:{arise:{pct:40,turns:2}},
      desc:"Saat membunuh, bangkitkan kartu yang dikalahkan sebagai bayangan dengan 40% dari stat-nya. Bayangan bertarung menggantikan posisi Shadow Monarch selama 2 giliran, atau sampai bayangan tersebut tumbang."},
    {id:"CH_ROYAL_VANGUARD",name:"ROYAL VANGUARD",tier:"UR",type:"Prince",skill:"PRIDE OF THE PRINCE",hp:1781,atk:891,chance:30000000,art:"assets/cards/art/royal-vanguard.webp",pos:"center",
      fx:{prideOfPrince:{pct:25}},
      desc:"Ketika kartu apapun di party-mu mati, Royal Vanguard mendapatkan +25% serangan secara permanen (menumpuk tiap kali ada kartu party yang jatuh)."},
    {id:"CH_REGRESSOR",name:"REGRESSOR",tier:"UR",type:"Player",skill:"REGRESSION",hp:1527,atk:764,chance:18000000,art:"assets/cards/art/regressor.webp",pos:"center",
      fx:{regression:{hpPct:40}},
      desc:"Saat mati, jika Regressor telah membunuh setidaknya satu kartu dalam pertarungan ini, bangkit kembali dengan 40% HP dan skill-nya di-refresh. Setiap kill menyimpan satu 'regression'; tiap kebangkitan menghabiskan satu."},
    {id:"CH_SIXFOLD_PROPHET",name:"SIXFOLD PROPHET",tier:"UR",type:"Shinobi",skill:"ALMIGHTY PUSH",hp:1352,atk:676,chance:12000000,art:"assets/cards/art/sixfold-prophet.webp",pos:"center",
      fx:{entryShatter:{pct:20}},
      desc:"Saat masuk, berikan 20% dari total HP musuh saat ini yang tersebar merata ke semua kartu mereka sebagai damage."},
    {id:"CH_THRILLER_KING",name:"THRILLER KING",tier:"R",type:"Biokinetic",skill:"BIOKINESIS",hp:1792,atk:896,chance:10000000,art:"assets/cards/art/thriller-king.webp",pos:"center",
      fx:{entryMaxHp:{pct:8},turnMaxHp:{pct:10},splitDeath:{pct:70,times:3}},
      desc:"Saat masuk, semua kartu musuh menerima 8% max HP sebagai damage. Setiap giliran Thriller King hidup, kartu aktif musuh menerima 10% max HP sebagai damage (keduanya tidak berpengaruh pada boss NPC). Saat mati, Thriller King terbelah dengan 70% stat miliknya dan bisa terbelah hingga 3 kali."},
    {id:"CH_THREEBLADE_RONIN",name:"THREEBLADE RONIN",tier:"UR",type:"Samurai",skill:"THREE THOUSAND WORLDS / ASHURA",hp:1240,atk:620,chance:9000000,art:"assets/cards/art/threeblade-ronin.webp",pos:"center",
      fx:{everyNth:{n:4,mult:3,text:"ASHURA"},deathDefy:{pct:20}},
      desc:"Setiap serangan ke-4, Ashura muncul: memberikan 3x damage. Di bawah 20% HP, Threeblade Ronin menolak untuk tumbang — bertahan 1 giliran ekstra setelah mencapai 0 HP, masih bisa menyerang."},
    {id:"CH_WILDHEART_HUNTER",name:"WILDHEART HUNTER",tier:"SR",type:"Beastmaster",skill:"JAJANKEN - ROCK",hp:259,atk:130,chance:50000,art:"assets/cards/art/wildheart-hunter.webp",pos:"center",
      fx:{desperateStrike:{below:30,mult:2.2,text:"JAJANKEN - ROCK"}},
      desc:"Di bawah 30% HP, serangan berikutnya memberikan damage 2.2x. Wildheart Hunter mati di akhir giliran."},
    {id:"CH_SUNBREATH_SWORDSMAN",name:"SUNBREATH SWORDSMAN",tier:"R",type:"Samurai",skill:"WATER BREATHING: FIRST FORM",hp:137,atk:69,chance:6000,art:"assets/cards/art/sunbreath-swordsman.webp",pos:"center",
      fx:{openingHit:{pct:35}},
      desc:"Hit pertama melawan kartu baru manapun memberikan 35% damage lebih."},
    {id:"CH_YOUNG_SHADOW_HEIR",name:"YOUNG SHADOW HEIR",tier:"R",type:"Shinobi",skill:"FIREBALL JUTSU",hp:111,atk:56,chance:3000,art:"assets/cards/art/young-shadow-heir.webp",pos:"center",
      fx:{burn:{chance:50,pct:8,turns:2}},
      desc:"50% chance saat menyerang untuk membakar musuh sebesar 8% max HP per giliran selama 2 giliran."},
    {id:"CH_YOUNG_SPIRIT_VESSEL",name:"YOUNG SPIRIT VESSEL",tier:"R",type:"Shinobi",skill:"SHADOW CLONE DODGE",hp:88,atk:44,chance:1400,art:"assets/cards/art/young-spirit-vessel.webp",pos:"center",
      fx:{entryCounter:{mult:0,text:"SHADOW CLONE"}},
      desc:"Memanggil bayangan klon - menghindari serangan pertama!"},
    /* ===== KARTU EKSKLUSIF WEATHER: AWAKENED ===== */

{id:"CH_DARKIN_LORD",name:"DARKIN LORD",tier:"SSR",type:"Darkin",skill:"THE WORLD ENDER",hp:7040,atk:3520,chance:10000000,art:"assets/cards/art/darkin-lord.webp",pos:"center",weatherOnly:"awakened",

  fx:{worldEnder:{cyc1:1.5,cyc2:0.4,pierce:0.8,healPct:30,revive:{dr:40}}},

  desc:"(Eksklusif cuaca AWAKENED) THE WORLD ENDER: serangan cycle 3 tahap - serangan 1 memberikan 150% damage, serangan 2 memberikan 40% damage ke semua musuh (slot cadangan ikut kena), serangan 3 menembus musuh dan yang di belakangnya masing-masing 80%. Heal 30% dari semua damage yang diberikan. Pertama kali mati: bangkit dengan 40% damage reduction dan heal 30% lebih banyak."},

{id:"CH_PSYCHIC_ESPER",name:"PSYCHIC ESPER",tier:"SSR",type:"Esper",skill:"PSYCHIC BARRAGE",hp:10600,atk:5340,chance:40000000,art:"assets/cards/art/psychic-esper.webp",pos:"center",weatherOnly:"awakened",

  fx:{psychicBarrage:{rocks:5,mult:1.9,streakPct:10,reviveRocks:10}},

  desc:"(Eksklusif cuaca AWAKENED) PSYCHIC BARRAGE: alih-alih menyerang, melempar 5 batu psikis 190% damage ke musuh acak termasuk slot cadangan. Batu beruntun kena musuh yang sama menambah 10% damage per batu. Pertama kali mati: bangkit full HP dan melempar 10 batu tiap serangan."},

{id:"CH_SUN_GOD",name:"SUN GOD",tier:"SSR",type:"Sun",skill:"RUBBER FIELD & BAJRANG GUN",hp:9270,atk:4630,chance:25000000,art:"assets/cards/art/sun-god.webp",pos:"center",weatherOnly:"awakened",

  fx:{rubberField:{drPct:50,bouncePct:50,dizzyPct:20,dizzyTurns:9},bajrangGun:{mult:2.6,aoePct:90,stun:1}},

  desc:"(Eksklusif cuaca AWAKENED) RUBBER FIELD: menerima 50% lebih sedikit damage & memantulkan 50% damage ke penyerang + memberi DIZZY (+20% damage diterima, stack s/d 9 turn). Saat pertama kali menyerang di battle: melepaskan BAJRANG GUN (260% damage menembus pertahanan + STUN 1 turn), dan gelombang kejutnya menghantam SELURUH CADANGAN musuh sebesar 90% ATK (1x per battle)."},/* ===== KARTU EKSKLUSIF WEATHER: ICEAGE ===== */
    {id:"CH_ABSOLUTE_ZERO",name:"ABSOLUTE ZERO",tier:"SSR",type:"Frost",skill:"ICE TIME CAPSULE",hp:1690,atk:848,chance:1600000,art:"assets/cards/art/absolute-zero.webp",pos:"center",weatherOnly:"iceage",
      fx:{entryFreeze:{turns:2,mult:2},freezeTransfer:1},
      desc:"(Eksklusif cuaca ICE AGE) Saat masuk arena, membekukan kartu aktif musuh selama 2 giliran dan memberikan 2x damage ke target yang beku. Membunuh target dalam keadaan beku memindahkan freeze ke kartu musuh berikutnya (1 giliran)."},
    {id:"CH_ICE_QUEEN",name:"ICE QUEEN",tier:"SSR",type:"Frost",skill:"MAHAPADMA - TIME FREEZE",hp:2140,atk:1070,chance:3500000,art:"assets/cards/art/ice-queen.webp",pos:"center",weatherOnly:"iceage",
      fx:{foeEntryFreeze:{turns:1},hitFreeze:{chance:25,turns:1,mult:1.9}},
      desc:"(Eksklusif cuaca ICE AGE) Membekukan musuh 1 giliran setiap mereka masuk arena. Setiap serangan memiliki 25% chance membekukan musuh 1 giliran, dan memberikan 1.9x damage ke target yang beku."},
    /* ===== KARTU EKSKLUSIF WEATHER: ECLIPSE ===== */
    {id:"CH_THE_STRUGGLER",name:"THE STRUGGLER",tier:"SSR",type:"Berserk",skill:"BERSERKER ARMOR",hp:2510,atk:1260,chance:3500000,art:"assets/cards/art/the-struggler.webp",pos:"center",weatherOnly:"eclipse",
      fx:{berserker:{selfDmgPct:5,atkGainPct:15,lowPct:20,undyingTurns:2,atkMult:2}},
      desc:"(Eksklusif cuaca ECLIPSE) Kehilangan 5% max HP setiap giliran, namun mendapatkan +15% ATK permanen tiap giliran (menumpuk). Saat HP di bawah 20%, BERSERKER ARMOR aktif: kebal kematian selama 2 giliran (HP boleh di bawah 0) dengan serangan 2x. Setelah 2 giliran, The Struggler tewas."},
    {id:"CH_WHITE_HAWK",name:"WHITE HAWK",tier:"SSR",type:"Divine",skill:"GODHAND CAUSALITY",hp:2800,atk:1400,chance:5000000,art:"assets/cards/art/white-hawk.webp",pos:"center",weatherOnly:"eclipse",
      fx:{dodgeEvery:{turns:3},stripAbility:1},
      desc:"(Eksklusif cuaca ECLIPSE) Setiap kali diserang, kemampuan musuh dihapus permanen. Setiap 3 giliran, serangan musuh berikutnya dihindari dengan pasti. White Hawk selalu mengontrol medan perang."},
    /* ===== KARTU EKSKLUSIF WEATHER: ARCANE ===== */
{id:"CH_HAVOC_WREACKER",name:"HAVOC WREACKER",tier:"SSR",type:"Arcane",skill:"SUPER MEGA DEATH ROCKET",hp:8430,atk:4210,chance:25000000,art:"assets/cards/art/havoc-wreacker.webp",pos:"center",weatherOnly:"arcane",
  fx:{havocRocket:{maxUses:3,pct:50},getExcited:1},
  desc:"(Eksklusif cuaca ARCANE) SUPER MEGA DEATH ROCKET: setiap masuk aktif langsung meluncurkan roket 50% ATK ke seluruh lineup musuh (maks 3x per battle) - slot cadangan ikut kebakar dan bisa tumbang. Saat membunuh, GET EXCITED!: langsung menyerang lagi tanpa menunggu giliran musuh."},
{id:"CH_TIME_TRICKSTER",name:"TIME TRICKSTER",tier:"SSR",type:"Arcane",skill:"V-DRIVE RESONANCE",hp:7230,atk:3610,chance:15000000,art:"assets/cards/art/time-trickster.webp",pos:"center",weatherOnly:"arcane",
  fx:{rewind:{pct:75,stun:1}},
  desc:"(Eksklusif cuaca ARCANE) V-DRIVE RESONANCE: saat mati, bangkit dengan 75% max HP (sekali), langsung menghantam musuh sebesar HP yang dipulihkan, dan memstun musuh 1 giliran."},
{id:"CH_YORDLE_INVENTOR",name:"YORDLE INVENTOR",tier:"SSR",type:"Arcane",skill:"EVOLUTION TURRET",hp:7630,atk:3810,chance:18000000,art:"assets/cards/art/yordle-inventor.webp",pos:"center",weatherOnly:"arcane",
  fx:{turret:{start:2,every:3,atkPct:25,blockPct:40}},
  desc:"(Eksklusif cuaca ARCANE) EVOLUTION TURRET: saat masuk arena memanggil 2 turret, bertambah 1 setiap 3 giliran. Setiap turret memberi +25% ATK. Saat terkena serangan, 40% chance turret menahan seluruh damage (1 turret hancur)."},/* ===== KARTU EKSKLUSIF WEATHER: GOOFY ===== */
    {id:"CH_DUMB_HAIR_GUY",name:"DUMB HAIR GUY",tier:"SSR",type:"Goofy",skill:"SENZU MUNCH",hp:5540,atk:2770,chance:13000000,art:"assets/cards/art/dumb-hair-guy.webp",pos:"center",weatherOnly:"goofy",
      fx:{senzu:{healPct:25,every:3,eatMult:0.5,strikeMult:4,atkGain:25,hpGain:50,maxMult:10}},
      desc:"(Eksklusif cuaca GOOFY) Won't stop eating: heal 25% Max HP setiap giliran, tapi serangan hanya memberikan 0.5x damage selama makan. Setiap 3 giliran selesai makan: serangan unmissable 4x strike, lalu serapan senzu memberikan +25% dari damage sebagai ATK dan +50% sebagai Max HP (hingga 10x stats dasar). Kemudian mulai makan lagi."},
    {id:"CH_DUMB_STRETCHY_GUY",name:"DUMB STRETCHY GUY",tier:"SSR",type:"Goofy",skill:"GOMU GOMU NO... WAIT WHAT?",hp:5120,atk:2560,chance:13000000,art:"assets/cards/art/dumb-stretchy-guy.webp",pos:"center",weatherOnly:"goofy",
      fx:{stretch:{balloon:{reflect:50},fireworks:{mult:0.5},flop:{healPct:40}}},
      desc:"(Eksklusif cuaca GOOFY) Setiap serangan trigger salah satu kekacauan: Gum-Gum Balloon (serangan meleset, tapi reflect 50% damage dari hit musuh berikutnya), Gum-Gum Fireworks (pukul semua musuh sebesar 50% ATK), atau Gum-Gum Flop (miss tapi heal 40% Max HP)."},
    /* ===== KARTU EKSKLUSIF WEATHER: GLITCH ===== */
    {id:"CH_GLITCHED_ENTITY",name:"GLITCHED ENTITY",tier:"SSR",type:"Corruption",skill:"CORRUPTED DATA",hp:4180,atk:2090,chance:8000000,art:"assets/cards/art/glitched-entity.webp",pos:"center",weatherOnly:"glitch",
      fx:{dupEntry:1,maxCorrupt:{pct:8},statusImmune:1},
      desc:"(Eksklusif cuaca GLITCH) Saat masuk arena, data terduplikasi: stat HP dan ATK menjadi 2x. Setiap serangan yang mengenai musuh merusak Max HP mereka 8% secara permanen (bisa menumpuk). Kebal terhadap semua status negatif."},
    {id:"CH_THE_GRIEFER",name:"THE GRIEFER",tier:"SSR",type:"Troll",skill:"WORLD CORRUPTION",hp:5160,atk:2580,chance:16000000,art:"assets/cards/art/the-griefer.webp",pos:"center",weatherOnly:"glitch",
      fx:{worldCorrupt:{every:3,pct:200,dmgUp:10},deathRear:{hpPct:50},grieferAtk:{mult:1.5}},
      desc:"(Eksklusif cuaca GLITCH) Saat masuk arena, kemampuan musuh ter-corrupt: setiap 3 giliran, musuh glitch dan menghantam dirinya sendiri sebesar 200% ATK The Griefer, sementara seluruh party mendapat +10% damage untuk sisa battle. Serangan The Griefer memberikan 1.5x damage. Pertama kali tumbang, ia di-remove dari lineup dan kembali di belakang kartu terakhirmu dengan 50% HP."},
    /* ===== KARTU EKSKLUSIF WEATHER: DOODLE ===== */
    {id:"CH_HEIGHT_OF_PAINTING",name:"HEIGHT OF PAINTING",tier:"SSR",type:"Painter",skill:"TWILIGHT OF VALHALLA",hp:3670,atk:1840,chance:7000000,art:"assets/cards/art/height-of-painting.webp",pos:"center",weatherOnly:"doodle",
      fx:{valhalla:{turns:4,dmgCut:60,atkPct:15,healPct:40,master:{mult:3,stun:1}}},
      desc:"(Eksklusif cuaca DOODLE) Saat masuk arena, Twilight of Valhalla aktif selama 4 giliran: menerima 60% damage reduction, +15% ATK setiap giliran, dan HP tidak dapat jatuh di bawah 1. Saat lukisan berakhir, memulihkan 40% max HP. Setiap serangan ke-3 adalah Masterpiece: 3x damage dan menstun musuh 1 giliran."},
    {id:"CH_INK_ANAMLOY",name:"INK ANAMLOY",tier:"SSR",type:"Demon",skill:"THE INK DEMON",hp:3420,atk:1710,chance:3500000,art:"assets/cards/art/ink-anamloy.webp",pos:"center",weatherOnly:"doodle",
      fx:{dmgCut:{pct:30},inkCorrupt:{pct:10,max:5},inkDrain:{pct:50,every:3},revive:{pct:50,stun:1}},
      desc:"(Eksklusif cuaca DOODLE) Menerima 30% damage reduction selama di arena. Setiap serangan yang menaikkan Ink Corruption mengurangi Attack musuh 10% permanen (maksimal 5 stack). Setiap serangan ke-3 memulihkan 50% dari damage yang diberikan. Saat mati, sekali bangkit dengan 50% HP dan menstun musuh 1 giliran."},
    /* ===== KARTU EKSKLUSIF WEATHER: WINDY ===== */
    {id:"CH_BLIZZARD_BADDIE",name:"BLIZZARD BADDIE",tier:"SR",type:"Frost",skill:"PSYCHIC BLIZZARD",hp:350,atk:175,chance:80000,art:"assets/cards/art/blizzard-baddie.webp",pos:"center",weatherOnly:"windy",
      fx:{psychicBarrier:{dr:30,turns:3,healPct:10}},
      desc:"(Eksklusif cuaca WINDY) Saat masuk arena, membuat psychic barrier yang mengurangi damage 30% selama 3 giliran. Setiap serangan yang diredam barrier memulihkan 10% max HP."},
    {id:"CH_PAPER_PAL",name:"PAPER PAL",tier:"SR",type:"Trickster",skill:"PAPER STORM",hp:272,atk:136,chance:50000,art:"assets/cards/art/paper-pal.webp",pos:"center",weatherOnly:"windy",
      fx:{entryAtkPct:{pct:10},crit:{chance:25,mult:1.5}},
      desc:"(Eksklusif cuaca WINDY) Saat masuk arena, serpihan kertas memberikan 10% ATK ke semua kartu musuh. Serangan memiliki 25% chance menembus dengan 1.5x damage."},
    /* ===== KARTU EKSKLUSIF WEATHER: LIGHTRAIN ===== */
    {id:"CH_BLESSED_MAGE",name:"BLESSED MAGE",tier:"SR",type:"Mystic",skill:"SPIRIT OF ZEPHYR",hp:379,atk:190,chance:150000,art:"assets/cards/art/blessed-mage.webp",pos:"center",weatherOnly:"lightrain",
      fx:{transform:{mult:1.2},everyNth:{n:2,mult:2,text:"SPIRIT DIVE"}},
      desc:"(Eksklusif cuaca LIGHTRAIN) Mendapat 20% tambahan semua stat sepanjang pertarungan. Setiap 2 giliran, Spirit Dive aktif: serangan berikutnya memberikan 2x damage."},
    {id:"CH_THUNDER_PRODIGY",name:"THUNDER PRODIGY",tier:"SR",type:"Stormcaller",skill:"THUNDERCLAP FLASH",hp:438,atk:219,chance:150000,art:"assets/cards/art/thunder-prodigy.webp",pos:"center",weatherOnly:"lightrain",
      fx:{sleepStrike:{turns:1,mult:4,text:"THUNDERCLAP FLASH"}},
      desc:"(Eksklusif cuaca LIGHTRAIN) Tertidur 1 giliran saat masuk arena. Serangan pertama setelah bangun memberikan 4x damage, dan kelebihan damage yang membunuh target mengenai musuh berikutnya."},
    /* ===== KARTU EKSKLUSIF WEATHER: SNOWFALL ===== */
    {id:"CH_10TH_CAPTAIN",name:"10TH CAPTAIN",tier:"SR",type:"Frost",skill:"BANKAI: DAIGUREN HYORINMARU",hp:435,atk:218,chance:175000,art:"assets/cards/art/10th-captain.webp",pos:"center",weatherOnly:"snowfall",
      fx:{entryFreeze:{turns:2,mult:1.5},iceShell:20},
      desc:"(Eksklusif cuaca SNOWFALL) Saat masuk arena, bekukan kartu aktif musuh selama 2 giliran. Selama musuh beku, serangan memberikan 1.5x damage. Selalu menerima 20% pengurangan damage (ice shell)."},
    {id:"CH_OCEANS_GUARDIAN",name:"OCEAN'S GUARDIAN",tier:"SR",type:"Tideborn",skill:"FISH-MAN KARATE: VAGABOND DRILL",hp:831,atk:416,chance:500000,art:"assets/cards/art/oceans-guardian.webp",pos:"center",weatherOnly:"snowfall",
      fx:{heavyRain:{turns:3,healPct:20},shockwave:{every:3,pct:15}},
      desc:"(Eksklusif cuaca SNOWFALL) Saat masuk arena, hujan deras selama 3 giliran: memulihkan 20% max HP setiap giliran selama hujan. Setiap serangan ke-3 mengirimkan shockwave 15% ATK ke kartu aktif musuh."},
      /* ===== KARTU EKSKLUSIF WEATHER: THUNDERSTORM (baru - engine passives: timeStop/killHeal/tripleHit/flood) ===== */
      {id:"CH_IMMORTAL_VAMPIRE",name:"IMMORTAL VAMPIRE",tier:"SR",type:"Voidkeeper",skill:"THE WORLD: TIME STOP",hp:595,atk:298,chance:330000,art:"assets/cards/art/immortal-vampire.webp",pos:"center",weatherOnly:"thunderstorm",
        fx:{timeStop:{turns:2,every:4},killHeal:{pct:25}},
        desc:"(Eksklusif cuaca THUNDERSTORM) Saat masuk dan setiap 4 giliran menghentikan waktu: kartu aktif musuh stun 2 giliran dan serangan tidak bisa dielakkan selama waktu berhenti. Setiap kill memulihkan 25% max HP."},
      {id:"CH_SEA_SOVEREIGN",name:"SEA SOVEREIGN",tier:"SR",type:"Tideborn",skill:"DIVINE TRIDENT",hp:939,atk:470,chance:700000,art:"assets/cards/art/sea-sovereign.webp",pos:"center",weatherOnly:"thunderstorm",
        fx:{tripleHit:{hits:3,mult:0.5},flood:{every:4,mult:2,exec:20}},
        desc:"(Eksklusif cuaca THUNDERSTORM) Setiap serangan menghantam 3 kali (masing-masing 50% damage). Tiap 4 giliran melepas 40-DAY FLOOD: 2x damage dengan eksekusi pasti untuk musuh di bawah 20% HP."},
{id:"CH_PUPPETEER",name:"PUPPETEER",tier:"SR",type:"Construct",skill:"HITOKUGUTSU - HUMAN PUPPET",hp:567,atk:284,chance:280000,art:"assets/cards/art/puppeteer.webp",pos:"center",weatherOnly:"sandstorm",
fx:{puppetPoison:{pct:10},puppetBody:{dr:20}},
desc:"(Eksklusif cuaca SANDSTORM) Tiap serangan menancapkan puppet poison: -10% ATK musuh permanen (stacking). Tubuh boneka memberi 20% pengurangan damage masuk."},
{id:"CH_SAND_VESSEL",name:"SAND VESSEL",tier:"SR",type:"Desertborn",skill:"SAND BURIAL",hp:631,atk:316,chance:350000,art:"assets/cards/art/sand-vessel.webp",pos:"center",weatherOnly:"sandstorm",
fx:{sandBurial:{every:3,mult:2},autoBlock:{pct:25}},
desc:"(Eksklusif cuaca SANDSTORM) Tiap 3 giliran melepas SAND BURIAL: hit pasti 2x damage yang mengabaikan dodge. Di antara Sand Burial, auto-block 25% damage masuk."},
{id:"CH_BLESSED_SORCERER",name:"BLESSED SORCERER",tier:"SR",type:"Sorcerer",skill:"SIX EYES: HOLLOW PURPLE",hp:1090,atk:548,chance:850000,art:"assets/cards/art/blessed-sorcerer.webp",pos:"center",weatherOnly:"monsoon",
fx:{autoBlock:{pct:50},flood:{every:2,mult:2.5,exec:0,label:"HOLLOW PURPLE"},unlimitedVoid:{below:20,turns:2,healPct:50}},
desc:"(Eksklusif cuaca MONSOON) Limitless Infinity: menerima 50% pengurangan damage dari semua sumber. Tiap serangan ke-2 melepas HOLLOW PURPLE: 2.5x damage yang mengabaikan semua pengurangan damage. Di bawah 20% HP: UNLIMITED VOID - stun musuh 2 giliran dan heal ke 50% (sekali per battle)."},
{id:"CH_MOON_MOTHER",name:"MOON MOTHER",tier:"SR",type:"Moonborn",skill:"AMENOMINAKA",hp:1150,atk:576,chance:1000000,art:"assets/cards/art/moon-mother.webp",pos:"center",weatherOnly:"monsoon",
fx:{dimensionShift:{turns:2},flood:{every:4,mult:3,exec:25,label:"ALL-KILLING ASH BONES"}},
desc:"(Eksklusif cuaca MONSOON) Saat musuh masuk arena, AMENOMINAKA memindahkannya ke dimensi lain: ability aktif musuh nonaktif selama 2 giliran. Tiap serangan ke-4 melepas ALL-KILLING ASH BONES: 3x damage mengabaikan pengurangan damage, dengan eksekusi musuh di bawah 25% HP."},
  {id:"CH_ALMIGHTY_TYRANT",name:"ALMIGHTY TYRANT",tier:"SSR",type:"Tyrant",skill:"THE ALMIGHTY",hp:1210,atk:608,chance:1200000,art:"assets/cards/art/almighty-tyrant.webp",pos:"center",weatherOnly:"aurora",
fx:{dodgeEvery:{turns:3},revive:{pct:60,lock:2}},
desc:"(Eksklusif cuaca AURORA) THE ALMIGHTY: menghindari serangan musuh di giliran ke-3. Saat tumbang, alter the future: bangkit di 60% HP dan nonaktifkan ability musuh selama 2 giliran (sekali per battle)."},
{id:"CH_DEMON_SLIME",name:"DEMON SLIME",tier:"SSR",type:"Slimeborn",skill:"PREDATOR: GLUTTONY",hp:1860,atk:933,chance:2200000,art:"assets/cards/art/demon-slime.webp",pos:"center",weatherOnly:"aurora",
fx:{gluttony:{pct:25}},
desc:"(Eksklusif cuaca AURORA) PREDATOR: GLUTTONY: tiap membunuh, serap 25% ATK & max HP musuh secara permanen (pola snatch) dan salin ability musuh - yang terbaru menggantikan - selama kartu ini aktif di battle."},
    {id:"CH_LUCK_VOLTIA",name:"LUCK VOLTIA",tier:"R",type:"Stormcaller",skill:"LIGHTNING BATTLE FIEND",hp:169,atk:85,chance:12000,art:"assets/cards/art/luck-voltia.webp",fx:{entryAtkPct:{pct:60},stunPunch:{every:3,chance:50,turns:1,atkPct:8,max:5}},desc:"Saat masuk arena, langsung menyerang dgn 60% ATK. Serangan ke-3 punya 50% kesempatan menstun musuh 1 giliran. Tiap stun sukses +8% ATK permanen (maks 5 stack)."},
    {id:"CH_NOBLE_COMPANION",name:"NOBLE COMPANION",tier:"R",type:"Supporter",skill:"PASSIONATE NARRATION",hp:210,atk:105,chance:25000,art:"assets/cards/art/noble-companion.webp",fx:{partyDmg:{pct:20}},desc:"Selama Noble Companion ada di party, semua kartu party mendapat +20% damage."},
    {id:"CH_BLOODMOON_DEMON",name:"BLOODMOON DEMON",tier:"R",type:"Demon",skill:"BLOOD IGNITE",hp:222,atk:111,chance:30000,art:"assets/cards/art/bloodmoon-demon.webp",fx:{regen:{pct:10,stopBelow:20},counterHit:{chance:40,pct:10,base:"foeMaxHp"},lowHpAtk:{below:20,bonus:100}},desc:"Regen 10% max HP tiap giliran (berhenti di bawah 20% HP). Diserang -> 40% bakar darah penyerang 10% max HP mereka. Di bawah 20% HP: mode terbangkitkan, serangan x2."},
    {id:"CH_GREEN_BEAST",name:"GREEN BEAST",tier:"SR",type:"Fighter",skill:"EIGHT GATES",hp:320,atk:160,chance:100000,art:"assets/cards/art/green-beast.webp",fx:{eightGates:{atkPct:15,max:5,selfPct:8}},desc:"Tiap serangan kena buka 1 gerbang: +15% ATK permanen (maks 5). Gerbang penuh -> tiap mukul bayar 8% max HP sendiri."},
    {id:"CH_DRAGON_SIN",name:"DRAGON SIN",tier:"SR",type:"Holy",skill:"FULL COUNTER",hp:394,atk:197,chance:200000,art:"assets/cards/art/dragon-sin.webp",fx:{counterHit:{chance:100,pct:30,base:"atk"}},desc:"Saat diserang, membalas 30% ATK Dragon Sin kembali ke penyerang."},
    {id:"CH_FROST_WIZARD",name:"FROST WIZARD",tier:"SR",type:"Frost",skill:"FROZEN DOUBLE",hp:436,atk:218,chance:280000,art:"assets/cards/art/frost-wizard.webp",fx:{double:{chance:100,pct:40}},desc:"Serangan mengenai dua kali (pukulan kedua 40% damage)."},
    {id:"CH_RUBBERBOUND_CAPTAIN",name:"RUBBERBOUND CAPTAIN",tier:"SR",type:"Grappler",skill:"FIVE STAMP RUSH",hp:485,atk:243,chance:400000,art:"assets/cards/art/rubberbound-captain.webp",fx:{double:{chance:25,pct:75}},desc:"25% kesempatan saat menyerang untuk memukul lagi dengan 75% damage."},
    {id:"CH_ICE_REAPER",name:"ICE REAPER",tier:"SR",type:"Frost",skill:"HAKKA NO TOGAME",hp:485,atk:243,chance:400000,art:"assets/cards/art/ice-reaper.webp",fx:{deathHex:{turns:3,atkCut:30}},desc:"Saat mati, bekukan kartu musuh 3 giliran dan potong ATK mereka 30% permanen."},
    {id:"CH_FROSTBANE",name:"FROSTBANE",tier:"SR",type:"Frost",skill:"STARKFROST ICEFIELD",hp:534,atk:267,chance:550000,art:"assets/cards/art/frostbane.webp",fx:{entryFreeze:{turns:2,mult:1.5}},desc:"Saat masuk, bekukan musuh 2 giliran. Serangan ke target beku memberikan 1.5x damage."},
    {id:"CH_COPYBLADE_MENTOR",name:"COPYBLADE MENTOR",tier:"SSR",type:"Copyist",skill:"IMPERIAL BLADE FUSION",hp:598,atk:299,chance:800000,art:"assets/cards/art/copyblade-mentor.webp",fx:{copy:{turns:6}},desc:"Saat masuk atau musuh masuk, salin ability lawan selama 6 giliran."},
    {id:"CH_NULLBLADE_KNIGHT",name:"NULLBLADE KNIGHT",tier:"SSR",type:"Anti-Magic",skill:"NULL STANCE",hp:658,atk:329,chance:1100000,art:"assets/cards/art/nullblade-knight.webp",fx:{dimensionShift:{turns:2},statusImmune:1,dmgMult:1.3},desc:"Saat masuk, nonaktifkan ability musuh 2 giliran. Kebal ability pengubah stat. Serangan 1.3x damage."},
    {id:"CH_TITAN_HUNTER",name:"TITAN HUNTER",tier:"SSR",type:"Warrior",skill:"BEAST KAMUI",hp:723,atk:362,chance:1500000,art:"assets/cards/art/titan-hunter.webp",fx:{dodgeAtk:{chance:35,pct:40,max:0,nextOnly:1}},desc:"35% kesempatan menghindar serangan apapun. Tiap sukses menghindar, serangan berikutnya +40% damage."},
    {id:"CH_CRIMSON_WARLORD",name:"CRIMSON WARLORD",tier:"SSR",type:"Conqueror",skill:"METEOR SHOWER",hp:763,atk:382,chance:1800000,art:"assets/cards/art/crimson-warlord.webp",fx:{meteorShower:{pct:15,every:4},dmgMult:1.3,dmgCut:{pct:20}},desc:"Saat masuk + tiap 4 giliran: jatuhkan meteor -> SEMUA kartu musuh rugi 15% max HP mereka (boss NPC kebal). Serangan 1.3x. Terima 20% pengurangan damage (Susano'o)."},
    {id:"CH_LIGHTBORNE_ADMIRAL",name:"LIGHTBORNE ADMIRAL",tier:"SSR",type:"Commander",skill:"YASAKANI MAGATAMA",hp:692,atk:346,chance:3000000,art:"assets/cards/art/lightborne-admiral.webp",fx:{splash:{pct:90},dmgMult:1.5,entryCounter:{mult:0,text:"BUTA CAHAYA"}},desc:"Serangan mengenai musuh + kartu lineup berikutnya sebesar 90% damage. Serangan 1.5x. Saat masuk, butakan musuh: serangan pertama mereka meleset."},
    {id:"CH_SOUL_REAPER",name:"SOUL REAPER",tier:"SSR",type:"Wanderer",skill:"SHUKATSU",hp:890,atk:445,chance:3000000,art:"assets/cards/art/soul-reaper.webp",fx:{revive:{pct:50,atkPct:20}},desc:"Saat mati, bangkit lagi dengan 50% HP dan +20% ATK (sekali per battle)."},
    {id:"CH_GALACTIC_TYRANT",name:"GALACTIC TYRANT",tier:"SSR",type:"Alien",skill:"DEATH BEAM",hp:1030,atk:519,chance:5000000,art:"assets/cards/art/galactic-tyrant.webp",fx:{everyNth:{n:3,mult:1,pen:true,next:100,text:"DEATH BEAM"},lowHpAtk:{below:50,bonus:70},lowHpAura:{below:50,dr:25}},desc:"Tiap serangan ke-3 jadi Death Beam: abaikan pengurangan damage + hantam kartu lineup berikutnya. Di bawah 50% HP: evolusi Golden Galactic Tyrant, +70% ATK & 25% pengurangan damage permanen."},
    {id:"CH_SOLAR_BRAWLER",name:"SOLAR BRAWLER",tier:"SSR",type:"Saiyan",skill:"LIMIT BREAKER",hp:1090,atk:549,chance:6000000,art:"assets/cards/art/solar-brawler.webp",fx:{statGrow:{pct:20}},desc:"Setiap giliran, semua stat naik 20% (compound). Makin lama makin mengerikan."},
    {id:"CH_TREMOR_EMPEROR",name:"TREMOR EMPEROR",tier:"UR",type:"Titan",skill:"GURA GURA GUM-GUM",hp:4780,atk:2390,chance:800000000,art:"assets/cards/art/tremor-emperor.webp",fx:{quake:{pct:10},shockAll:{pct:15},deathStay:1},desc:"Saat masuk: gempa -> SEMUA kartu musuh rugi 10% max HP mereka. Tiap serangan shockwave 15% ATK ke seluruh lineup musuh. Fatal -> bertahan 1 giliran extra (masih menyerang)."},
    {id:"CH_ANT_KING",name:"ANT KING",tier:"UR",type:"Chimera",skill:"POST-ROSE METAMORPHOSIS",hp:5120,atk:2560,chance:1000000000,art:"assets/cards/art/ant-king.webp",fx:{statGrow:{pct:5},gluttony:{pct:15,healPct:25,noCopy:1},revive:{pct:50,atkPct:50}},desc:"+5% stat tiap giliran. Tiap membunuh serap 15% stat musuh permanen + heal 25% max HP. Fatal -> bangkit sekali 50% HP +50% ATK."},
    {id:"CH_TIME_MASTER",name:"TIME MASTER",tier:"UR",type:"Requiem",skill:"THE WORLD",hp:7120,atk:3560,chance:3000000000,art:"assets/cards/art/time-master.webp",fx:{dimensionShift:{turns:999},reversal:1},desc:"Saat musuh masuk, nonaktifkan ability mereka permanen. Serangan mematikan pertama dibalikkan - sisa 1 HP (sekali per battle)."},
    {id:"CH_OMNI_SOVEREIGN",name:"OMNI SOVEREIGN",tier:"UR",type:"Deity",skill:"OMNI SCALPEL",hp:8310,atk:4150,chance:5000000000,art:"assets/cards/art/omni-sovereign.webp",fx:{eraseOnEntry:1},desc:"Saat masuk, jika total stat musuh lebih lemah dari Omni Sovereign, hapus mereka dari battle sepenuhnya."},
    {id:"CH_ASTRAL_DEVOURER",name:"ASTRAL DEVOURER",tier:"UR",type:"Cosmic",skill:"ADAPTATION + GAMMA RAY",hp:10200,atk:5120,chance:10000000000,art:"assets/cards/art/astral-devourer.webp",fx:{statGrow:{pct:15},everyNth:{n:2,mult:4,pen:true,next:20,all:1,text:"GAMMA RAY BURST"},causality:{atkPct:15}},desc:"Adaptasi +15% stat tiap giliran. Tiap serangan ke-2: Gamma Ray Burst, 4x damage, tembus semua kartu lineup musuh 20% ATK. Fatal -> balik ke HP awal giliran sebelumnya +15% ATK (sekali)."},    /* ===== KARTU BOSS — TOKO RAID (tier BOSS, glitch hitam-putih) =====
       raidBoss:true -> terkunci di SEMUA roll sebelum dibeli, permanen sesudahnya (bossRollUnlocked).
       chance dasar 1 in 25 juta (skill: ICE BLAST + immune status effect). ===== */
{id:"CH_BALD_KING",name:"BALD KING",tier:"SSR",type:"Heroic",skill:"SERIOUS PUNCH",hp:1680,atk:843,chance:1500000,art:"assets/cards/art/bald-king.webp",pos:"center",weatherOnly:"galactic",
fx:{seriousPunch:{charge:2,mult:5,wavePct:10,cd:3}},
desc:"(Eksklusif cuaca GALACTIC) SERIOUS PUNCH: mengisi 2 giliran tanpa menyerang, lalu giliran ke-3 melepas pukulan 5x damage + shockwave 10% ke seluruh lineup musuh. Cooldown 3 giliran."},
{id:"CH_METEOR_CONQUEROR",name:"METEOR CONQUEROR",tier:"SSR",type:"Conqueror",skill:"METEORIC BURST",hp:1280,atk:640,chance:1000000,art:"assets/cards/art/meteor-conqueror.webp",pos:"center",weatherOnly:"galactic",
fx:{meteorWave:{pct:15},burst:{turns:3,mult:2},overheat:{delay:3,pct:10}},
desc:"(Eksklusif cuaca GALACTIC) METEORIC BURST: saat masuk meledakkan 15% max HP ke musuh + stats x2 selama 3 giliran. Setelahnya overheat: rugi 10% max HP tiap giliran."},
    {id:"CH_ETERNAL_DRAGON",name:"ETERNAL DRAGON",tier:"BOSS",type:"Raid Boss",skill:"ICE BLAST",hp:5200,atk:2600,chance:25000000,art:"assets/cards/art/eternal-dragon.webp",pos:"center",raidBoss:true,
      fx:{statusImmune:true,iceBlast:{chance:50,pct:75,hits:3}},
      desc:"TIDAK PERNAH terkena status effect apapun (stun, burn, dan efek negatif lainnya). 50% peluang menembakkan ICE BLAST: 3 serangan beruntun masing-masing 75% ATK."}
  ]
};
/* ROLL SYSTEM - Pull-based RNG (bukan gacha pool) */
const RNG_ROLL_SPEED=1500; // ms per roll (base)
const RNG_ROLL_MIN=75;     // ms minimum per roll — cap 20× (reveal jadi kilatan cepat di kecepatan penuh)
const RNG_ROLL_MAX_MULT=RNG_ROLL_SPEED/RNG_ROLL_MIN; // 20×
const RNG_TOTAL_WEIGHT=1000000; // total weight untuk probability

